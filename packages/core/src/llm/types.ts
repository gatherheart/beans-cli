import type { ToolDefinition } from "../tools/types.js";
import type { Message, ToolCall } from "../agents/types.js";

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
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | "error";

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
 * Model information
 */
export interface ModelInfo {
  /** Model identifier (e.g., "gpt-4o", "gemini-2.0-flash") */
  id: string;
  /** Display name */
  name?: string;
  /** Model description */
  description?: string;
  /** Max context length in tokens */
  contextWindow?: number;
  /** Supported methods (e.g., ["generateContent", "chat"]) */
  supportedMethods?: string[];
}

/**
 * Request to upload a file for provider-managed workflows such as fine-tuning.
 */
export interface UploadFileRequest {
  /** Absolute or relative local file path */
  path: string;
  /** Intended file purpose */
  purpose: "fine-tune";
}

/**
 * Uploaded file metadata
 */
export interface UploadedFile {
  id: string;
  filename: string;
  bytes: number;
  purpose: string;
  createdAt: number;
}

/**
 * Fine-tuning hyperparameters for supervised jobs.
 */
export interface FineTuningHyperparameters {
  batchSize?: "auto" | number;
  learningRateMultiplier?: "auto" | number;
  nEpochs?: "auto" | number;
}

/**
 * Request to create a fine-tuning job.
 */
export interface CreateFineTuningJobRequest {
  model: string;
  trainingFile: string;
  validationFile?: string;
  suffix?: string;
  hyperparameters?: FineTuningHyperparameters;
}

/**
 * Fine-tuning job metadata.
 */
export interface FineTuningJob {
  id: string;
  model: string;
  status:
    | "validating_files"
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "cancelled";
  createdAt: number;
  finishedAt?: number | null;
  estimatedFinish?: number | null;
  fineTunedModel?: string | null;
  trainingFile: string;
  validationFile?: string | null;
  trainedTokens?: number | null;
  resultFiles?: string[];
  suffix?: string | null;
  error?: {
    code?: string | null;
    message?: string | null;
    param?: string | null;
  } | null;
  hyperparameters?: FineTuningHyperparameters;
}

/**
 * Fine-tuning job event metadata.
 */
export interface FineTuningJobEvent {
  id: string;
  createdAt: number;
  level: "info" | "warn" | "error";
  message: string;
  type?: "message" | "metrics";
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
    request: ChatRequest,
  ): AsyncGenerator<ChatStreamChunk, void, unknown>;

  /**
   * List available models from the provider
   */
  listModels?(): Promise<ModelInfo[]>;

  /**
   * Upload a file for provider-managed workflows
   */
  uploadFile?(request: UploadFileRequest): Promise<UploadedFile>;

  /**
   * Create a fine-tuning job
   */
  createFineTuningJob?(
    request: CreateFineTuningJobRequest,
  ): Promise<FineTuningJob>;

  /**
   * List fine-tuning jobs
   */
  listFineTuningJobs?(): Promise<FineTuningJob[]>;

  /**
   * Retrieve a fine-tuning job
   */
  getFineTuningJob?(jobId: string): Promise<FineTuningJob>;

  /**
   * List events for a fine-tuning job
   */
  listFineTuningEvents?(jobId: string): Promise<FineTuningJobEvent[]>;
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
  /** Debug configuration */
  debug?: {
    /** Enable debug mode */
    enabled: boolean;
    /** Log requests */
    logRequests: boolean;
    /** Log responses */
    logResponses: boolean;
    /** Optional callback for debug events (used by UI) */
    onDebugEvent?: (event: DebugEvent) => void;
  };
  /** Rate limiting configuration (for providers with rate limits) */
  rateLimit?: {
    /** Max requests per minute (default: 60 for paid tier) */
    requestsPerMinute?: number;
    /** Max retries on 429 error (default: 3) */
    maxRetries?: number;
    /** Initial backoff in ms (default: 1000, doubles each retry) */
    initialBackoffMs?: number;
  };
}

/**
 * Debug event emitted by the LLM client
 */
export interface DebugEvent {
  type: "request" | "response";
  data: DebugRequestData | DebugResponseData;
}

/**
 * Debug request data
 */
export interface DebugRequestData {
  model: string;
  systemPrompt?: string;
  messageCount: number;
  toolCount: number;
  messages: Array<{
    role: string;
    contentPreview: string;
    toolCallCount?: number;
    toolResultCount?: number;
  }>;
}

/**
 * Debug response data
 */
export interface DebugResponseData {
  model: string;
  finishReason: string;
  contentPreview: string;
  toolCallCount: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Supported LLM providers
 */
export type LLMProvider = "google" | "ollama" | "openai" | "anthropic";
