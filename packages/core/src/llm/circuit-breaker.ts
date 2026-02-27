/**
 * Circuit Breaker Pattern
 *
 * Prevents repeated calls to a failing service.
 * States: CLOSED (normal) -> OPEN (failing) -> HALF_OPEN (testing)
 */

/**
 * Circuit breaker state
 */
export type CircuitState = "closed" | "open" | "half_open";

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms before attempting to close the circuit */
  resetTimeout: number;
  /** Number of successes required to close the circuit from half-open */
  successThreshold?: number;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  successThreshold: 2,
};

/**
 * Circuit breaker for a single model/service
 */
export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...config,
    } as Required<CircuitBreakerConfig>;
  }

  /**
   * Get the current circuit state
   */
  getState(): CircuitState {
    this.updateState();
    return this.state;
  }

  /**
   * Check if requests are allowed
   */
  isAllowed(): boolean {
    this.updateState();
    return this.state !== "open";
  }

  /**
   * Record a successful call
   */
  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === "half_open") {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = "closed";
        this.successCount = 0;
      }
    }
  }

  /**
   * Record a failed call
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = "open";
    }
  }

  /**
   * Force reset the circuit to closed state
   */
  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
  }

  /**
   * Get metrics for the circuit
   */
  getMetrics(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime?: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Update state based on timeout
   */
  private updateState(): void {
    if (
      this.state === "open" &&
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime >= this.config.resetTimeout
    ) {
      this.state = "half_open";
      this.successCount = 0;
    }
  }
}

/**
 * Circuit breaker registry for multiple models
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultConfig: Partial<CircuitBreakerConfig>;

  constructor(defaultConfig: Partial<CircuitBreakerConfig> = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create a circuit breaker for a model
   */
  get(modelId: string): CircuitBreaker {
    let breaker = this.breakers.get(modelId);
    if (!breaker) {
      breaker = new CircuitBreaker(this.defaultConfig);
      this.breakers.set(modelId, breaker);
    }
    return breaker;
  }

  /**
   * Check if a model is allowed (circuit not open)
   */
  isAllowed(modelId: string): boolean {
    return this.get(modelId).isAllowed();
  }

  /**
   * Record success for a model
   */
  recordSuccess(modelId: string): void {
    this.get(modelId).recordSuccess();
  }

  /**
   * Record failure for a model
   */
  recordFailure(modelId: string): void {
    this.get(modelId).recordFailure();
  }

  /**
   * Get all circuit states
   */
  getAllMetrics(): Map<string, ReturnType<CircuitBreaker["getMetrics"]>> {
    const metrics = new Map<string, ReturnType<CircuitBreaker["getMetrics"]>>();
    for (const [modelId, breaker] of this.breakers) {
      metrics.set(modelId, breaker.getMetrics());
    }
    return metrics;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}
