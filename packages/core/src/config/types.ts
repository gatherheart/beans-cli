import type { LLMProvider } from '../llm/types.js';

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
  /** Telemetry settings */
  telemetry: TelemetryConfig;
  /** UI settings */
  ui: UIConfig;
  /** Debug settings */
  debug: DebugConfig;
}

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
}

/**
 * Auto-approve levels
 */
export type AutoApproveLevel = 'none' | 'safe' | 'all';

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
 * UI configuration
 */
export interface UIConfig {
  /** Color theme */
  theme: 'dark' | 'light' | 'auto';
  /** Show thinking/reasoning */
  showThinking: boolean;
  /** Compact output mode */
  compact: boolean;
  /** Max output lines before truncation */
  maxOutputLines: number;
}
