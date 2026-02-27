/**
 * LLM Router
 *
 * Dynamic model switching with retry, fallback, and circuit breaker support.
 */

import type {
  LLMClient,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
} from "./types.js";
import {
  classifyError,
  calculateBackoff,
  type ErrorCategory,
} from "./error-classifier.js";
import {
  CircuitBreakerRegistry,
  type CircuitBreakerConfig,
} from "./circuit-breaker.js";

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Primary model to use */
  primary: string;
  /** Fallback models in order of preference */
  fallbacks: string[];
  /** Error categories that trigger fallback */
  fallbackOn: ErrorCategory[];
  /** Maximum retry attempts per model */
  maxRetries: number;
  /** Base retry delay in milliseconds */
  retryDelayMs: number;
  /** Maximum retry delay in milliseconds */
  maxRetryDelayMs: number;
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
  /** Callback when model routing occurs */
  onRouting?: (event: RoutingEvent) => void;
}

/**
 * Routing event for observability
 */
export interface RoutingEvent {
  type: "retry" | "fallback" | "circuit_open" | "success" | "failure";
  model: string;
  attempt?: number;
  fallbackModel?: string;
  error?: Error;
  errorCategory?: ErrorCategory;
}

/**
 * Default router configuration
 */
export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  primary: "gemini-2.0-flash",
  fallbacks: [],
  fallbackOn: ["quota_exceeded", "rate_limit", "server_error"],
  maxRetries: 3,
  retryDelayMs: 1000,
  maxRetryDelayMs: 30000,
};

/**
 * Create a client factory function type
 */
export type ClientFactory = (model: string) => LLMClient | undefined;

/**
 * LLM Router - wraps multiple clients with retry/fallback logic
 */
export class LLMRouter implements LLMClient {
  private config: RouterConfig;
  private clientFactory: ClientFactory;
  private circuitBreakers: CircuitBreakerRegistry;

  constructor(
    clientFactory: ClientFactory,
    config: Partial<RouterConfig> = {},
  ) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
    this.clientFactory = clientFactory;
    this.circuitBreakers = new CircuitBreakerRegistry(config.circuitBreaker);
  }

  /**
   * Chat with retry and fallback logic
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const models = this.getModelChain(request.model);
    let lastError: Error | undefined;

    for (const model of models) {
      // Check circuit breaker
      if (!this.circuitBreakers.isAllowed(model)) {
        this.emitEvent({
          type: "circuit_open",
          model,
        });
        continue;
      }

      const client = this.clientFactory(model);
      if (!client) {
        continue;
      }

      // Try with retries
      for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        try {
          const response = await client.chat({ ...request, model });

          // Record success
          this.circuitBreakers.recordSuccess(model);
          this.emitEvent({
            type: "success",
            model,
            attempt,
          });

          return response;
        } catch (error) {
          lastError = error as Error;
          const classified = classifyError(lastError);

          // Record failure for circuit breaker
          this.circuitBreakers.recordFailure(model);

          // Check if we should retry
          const canRetry =
            classified.retryable && attempt < this.config.maxRetries;

          if (canRetry) {
            // Emit retry event
            this.emitEvent({
              type: "retry",
              model,
              attempt,
              error: lastError,
              errorCategory: classified.category,
            });

            // Calculate retry delay
            const delay = calculateBackoff(
              attempt,
              classified.retryDelayMs ?? this.config.retryDelayMs,
              this.config.maxRetryDelayMs,
            );

            await this.sleep(delay);
          } else {
            // Emit failure event
            this.emitEvent({
              type: "failure",
              model,
              attempt,
              error: lastError,
              errorCategory: classified.category,
            });

            // Check if we should fallback
            if (
              classified.shouldFallback &&
              this.shouldTriggerFallback(classified.category)
            ) {
              this.emitEvent({
                type: "fallback",
                model,
                fallbackModel: models[models.indexOf(model) + 1],
                error: lastError,
                errorCategory: classified.category,
              });
              break; // Move to next model
            }
            throw lastError;
          }
        }
      }
    }

    throw lastError ?? new Error("No available models");
  }

  /**
   * Stream chat with retry and fallback logic
   */
  async *chatStream(
    request: ChatRequest,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const models = this.getModelChain(request.model);
    let lastError: Error | undefined;

    for (const model of models) {
      // Check circuit breaker
      if (!this.circuitBreakers.isAllowed(model)) {
        this.emitEvent({
          type: "circuit_open",
          model,
        });
        continue;
      }

      const client = this.clientFactory(model);
      if (!client?.chatStream) {
        continue;
      }

      // Try with retries
      for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        try {
          const stream = client.chatStream({ ...request, model });

          // Yield chunks from stream
          for await (const chunk of stream) {
            yield chunk;
          }

          // If we got here, stream completed successfully
          this.circuitBreakers.recordSuccess(model);
          this.emitEvent({
            type: "success",
            model,
            attempt,
          });

          return;
        } catch (error) {
          lastError = error as Error;
          const classified = classifyError(lastError);

          // Record failure for circuit breaker
          this.circuitBreakers.recordFailure(model);

          // Check if we should retry
          const canRetry =
            classified.retryable && attempt < this.config.maxRetries;

          if (canRetry) {
            // Emit retry event
            this.emitEvent({
              type: "retry",
              model,
              attempt,
              error: lastError,
              errorCategory: classified.category,
            });

            // Calculate retry delay
            const delay = calculateBackoff(
              attempt,
              classified.retryDelayMs ?? this.config.retryDelayMs,
              this.config.maxRetryDelayMs,
            );

            await this.sleep(delay);
          } else {
            // Emit failure event
            this.emitEvent({
              type: "failure",
              model,
              attempt,
              error: lastError,
              errorCategory: classified.category,
            });

            // Check if we should fallback
            if (
              classified.shouldFallback &&
              this.shouldTriggerFallback(classified.category)
            ) {
              this.emitEvent({
                type: "fallback",
                model,
                fallbackModel: models[models.indexOf(model) + 1],
                error: lastError,
                errorCategory: classified.category,
              });
              break; // Move to next model
            }
            throw lastError;
          }
        }
      }
    }

    throw lastError ?? new Error("No available models");
  }

  /**
   * Get the chain of models to try (primary + fallbacks)
   */
  private getModelChain(requestedModel?: string): string[] {
    const primary = requestedModel ?? this.config.primary;
    return [primary, ...this.config.fallbacks.filter((m) => m !== primary)];
  }

  /**
   * Check if error category should trigger fallback
   */
  private shouldTriggerFallback(category: ErrorCategory): boolean {
    return this.config.fallbackOn.includes(category);
  }

  /**
   * Emit a routing event
   */
  private emitEvent(event: RoutingEvent): void {
    this.config.onRouting?.(event);
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker metrics for all models
   */
  getCircuitMetrics() {
    return this.circuitBreakers.getAllMetrics();
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuits(): void {
    this.circuitBreakers.resetAll();
  }
}

/**
 * Create an LLM router with the given configuration
 */
export function createRouter(
  clientFactory: ClientFactory,
  config?: Partial<RouterConfig>,
): LLMRouter {
  return new LLMRouter(clientFactory, config);
}
