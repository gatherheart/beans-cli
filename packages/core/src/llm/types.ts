import type { ToolDefinition } from '../tools/types.js';
import type { Message, ToolCall } from '../agents/types.js';

/**
 * Request for LLM chat completion
 */
export interface ChatRequest {
  /** Model identifier */
  model: string;
  /** Conversation messages */
  messages: Message[];
  /** System prompt */
  systemPrompt?: string;
  /** Available tools */
  tools?: ToolDefinition[];
  /** Temperature (0-2) */
  temperature?: number;
  /** Max tokens in response */
  maxTokens?: number;
  /** Top-p sampling */
  topP?: number;
  /** Stop sequences */
  stopSequences?: string[];
}

/**
 * Response from LLM chat completion
 */
export interface ChatResponse {
  /** Response content */
  content: string | null;
  /** Tool calls requested by the model */
  toolCalls?: ToolCall[];
  /** Reasoning/thinking content (for supported models) */
  thinking?: string;
  /** Token usage statistics */
  usage?: TokenUsage;
  /** Model that generated the response */
  model: string;
  /** Finish reason */
  finishReason: FinishReason;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Cached tokens (for supported providers) */
  cachedTokens?: number;
}

/**
 * Reason for completion finishing
 */
export type FinishReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | 'error';

/**
 * Streaming chunk from LLM
 */
export interface ChatStreamChunk {
  /** Content delta */
  content?: string;
  /** Thinking delta */
  thinking?: string;
  /** Tool call delta */
  toolCallDelta?: Partial<ToolCall>;
  /** Whether this is the final chunk */
  done: boolean;
  /** Finish reason (only on final chunk) */
  finishReason?: FinishReason;
  /** Usage (only on final chunk) */
  usage?: TokenUsage;
}

/**
 * LLM client interface
 */
export interface LLMClient {
  /**
   * Send a chat request and get a response
   */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Send a chat request and stream the response
   */
  chatStream?(
    request: ChatRequest
  ): AsyncGenerator<ChatStreamChunk, void, unknown>;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** API key or auth token */
  apiKey?: string;
  /** Base URL for API */
  baseUrl?: string;
  /** Organization ID (for OpenAI) */
  organizationId?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';
