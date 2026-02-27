import type { LLMProvider } from "../llm/types.js";
import type { MemoryConfig } from "../memory/types.js";
import type { PolicyConfig } from "../policy/types.js";
import type { ErrorCategory } from "../llm/error-classifier.js";
import type { CircuitBreakerConfig } from "../llm/circuit-breaker.js";
import type { CompressionConfig } from "../agents/compression.js";

/**
 * Main application configuration
 */
export interface AppConfig {
  /** LLM provider settings */
  llm: LLMConfig;
  /** Agent settings */
  agent: AgentConfig;
  /** Tool settings */
  tools: ToolsConfig;
  /** Policy settings */
  policy: PolicyConfig;
  /** Telemetry settings */
  telemetry: TelemetryConfig;
  /** UI settings */
  ui: UIConfig;
  /** Debug settings */
  debug: DebugConfig;
  /** Memory settings */
  memory: MemoryConfig;
  /** Runtime-only settings (never persisted) */
  runtime: RuntimeConfig;
}

// Re-export MemoryConfig for convenience
export type { MemoryConfig } from "../memory/types.js";

/**
 * Debug configuration
 */
export interface DebugConfig {
  /** Enable debug mode */
  enabled: boolean;
  /** Log LLM requests */
  logRequests: boolean;
  /** Log LLM responses */
  logResponses: boolean;
}

/**
 * LLM configuration
 */
export interface LLMConfig {
  /** Active provider */
  provider: LLMProvider;
  /** API key (or env var name) */
  apiKey?: string;
  /** Default model */
  model: string;
  /** Temperature for responses */
  temperature?: number;
  /** Max tokens per response */
  maxTokens?: number;
  /** Custom base URL */
  baseUrl?: string;
  /** Model routing configuration */
  routing?: RoutingConfig;
}

/**
 * Model routing configuration
 */
export interface RoutingConfig {
  /** Enable model routing with fallbacks */
  enabled: boolean;
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
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Max turns per session */
  maxTurns: number;
  /** Session timeout in ms */
  timeoutMs: number;
  /** Enable streaming responses */
  streaming: boolean;
  /** Auto-approve tool calls */
  autoApprove: AutoApproveLevel;
  /** Chat compression configuration */
  compression?: CompressionConfig;
}

/**
 * Auto-approve levels
 */
export type AutoApproveLevel = "none" | "safe" | "all";

/**
 * Tools configuration
 */
export interface ToolsConfig {
  /** Enabled built-in tools */
  enabled: string[];
  /** Disabled tools */
  disabled: string[];
  /** MCP servers to connect */
  mcpServers?: MCPServerConfig[];
  /** Shell command timeout */
  shellTimeout: number;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Server name */
  name: string;
  /** Command to start server */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Enable telemetry */
  enabled: boolean;
  /** Telemetry endpoint */
  endpoint?: string;
  /** Log prompts (sensitive) */
  logPrompts: boolean;
}

/**
 * UI configuration (persisted to settings file)
 */
export interface UIConfig {
  /** Color theme */
  theme: "dark" | "light" | "auto";
  /** Show thinking/reasoning */
  showThinking: boolean;
  /** Compact output mode */
  compact: boolean;
  /** Max output lines before truncation */
  maxOutputLines: number;
}

/**
 * Runtime-only configuration (never persisted)
 *
 * These settings are set via CLI flags and only apply to the current session.
 */
export interface RuntimeConfig {
  /** UI test mode for e2e testing (--ui-test flag) */
  uiTestMode: boolean;
}
