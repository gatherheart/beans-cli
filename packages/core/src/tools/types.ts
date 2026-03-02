import { z } from "zod";

/**
 * Tool definition for LLM function calling
 */
export interface ToolDefinition {
  /** Unique name for the tool */
  name: string;
  /** Human-readable display name */
  displayName?: string;
  /** Description of what the tool does */
  description: string;
  /** JSON Schema for parameters */
  parameters: {
    type: "object";
    properties: Record<string, ParameterDefinition>;
    required?: string[];
  };
}

/**
 * Parameter definition within tool schema
 */
export interface ParameterDefinition {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: ParameterDefinition;
  properties?: Record<string, ParameterDefinition>;
  default?: unknown;
}

/**
 * Metadata from write_file tool execution
 */
export interface WriteFileMetadata {
  /** File path that was written */
  path: string;
  /** Number of lines written */
  lineCount: number;
  /** File size in bytes */
  size: number;
  /** Whether this was a new file */
  isNewFile: boolean;
  /** Original file content before write (null if new file) */
  originalContent: string | null;
  /** New content that was written */
  newContent: string;
}

/**
 * Metadata from read_file tool execution
 */
export interface ReadFileMetadata {
  /** File path that was read */
  path: string;
  /** Total lines in the file */
  totalLines: number;
  /** Starting line number (1-based) */
  readFrom: number;
  /** Ending line number */
  readTo: number;
}

/**
 * Metadata from glob tool execution
 */
export interface GlobMetadata {
  pattern: string;
  path: string;
  count: number;
}

/**
 * Metadata from grep tool execution
 */
export interface GrepMetadata {
  pattern: string;
  path: string;
  matchCount: number;
}

/**
 * Metadata from shell tool execution
 */
export interface ShellMetadata {
  command: string;
  cwd: string;
  exitCode: number | null;
  truncated: boolean;
}

/**
 * Metadata from delete_file tool execution (file variant)
 */
export interface DeleteFileMetadata {
  path: string;
  type: "file";
}

/**
 * Metadata from delete_file tool execution (directory variant)
 */
export interface DeleteDirectoryMetadata {
  path: string;
  type: "directory";
  entriesDeleted: number;
}

/**
 * Metadata from list_directory tool execution
 */
export interface ListDirectoryMetadata {
  path: string;
  entryCount: number;
}

/**
 * Metadata from rename_file tool execution
 */
export interface RenameFileMetadata {
  source: string;
  destination: string;
}

/**
 * Metadata from task_create tool execution
 */
export interface TaskCreateMetadata {
  taskId: string;
}

/**
 * Metadata from task_update/task_get tool execution
 */
export interface TaskGetMetadata {
  task: {
    id: string;
    subject: string;
    description: string;
    status: string;
    owner?: string;
    blocks: string[];
    blockedBy: string[];
  };
}

/**
 * Metadata from task_list tool execution
 */
export interface TaskListMetadata {
  tasks: Array<{
    id: string;
    subject: string;
    description: string;
    status: string;
    owner?: string;
    blocks: string[];
    blockedBy: string[];
  }>;
}

/**
 * Metadata from save_memory tool execution
 */
export interface SaveMemoryMetadata {
  path: string;
  target: "global" | "project";
  section?: string;
  contentLength: number;
  isNewFile?: boolean;
}

/**
 * Metadata from web_search tool execution (no results)
 */
export interface WebSearchNoResultMetadata {
  query: string;
}

/**
 * Metadata from web_search tool execution (Gemini provider)
 */
export interface WebSearchGeminiMetadata {
  query: string;
  sourceCount: number;
  provider: "gemini-google-search";
}

/**
 * Metadata from web_search tool execution (other providers)
 */
export interface WebSearchResultMetadata {
  resultCount: number;
  hasAnswer?: boolean;
}

/**
 * Metadata from spawn_agent tool execution
 */
export interface SpawnAgentMetadata {
  agentType: string;
  turnCount: number;
  restrictedTools?: string[];
}

/**
 * Metadata from timeout error
 */
export interface TimeoutMetadata {
  timeout: boolean;
  timeoutMs: number;
}

/**
 * Union of all tool metadata types
 */
export type ToolMetadata =
  | WriteFileMetadata
  | ReadFileMetadata
  | GlobMetadata
  | GrepMetadata
  | ShellMetadata
  | DeleteFileMetadata
  | DeleteDirectoryMetadata
  | ListDirectoryMetadata
  | RenameFileMetadata
  | TaskCreateMetadata
  | TaskGetMetadata
  | TaskListMetadata
  | SaveMemoryMetadata
  | WebSearchNoResultMetadata
  | WebSearchGeminiMetadata
  | WebSearchResultMetadata
  | SpawnAgentMetadata
  | TimeoutMetadata;

/**
 * Result from tool execution
 */
export interface ToolExecutionResult {
  /** Content to return to the LLM */
  content: string;
  /** Display content for the user (if different from LLM content) */
  displayContent?: string;
  /** Error flag */
  isError?: boolean;
  /** Additional metadata */
  metadata?: ToolMetadata;
}

/**
 * Confirmation details for destructive operations
 */
export interface ToolConfirmation {
  /** Whether confirmation is required */
  required: boolean;
  /** Message to show the user */
  message?: string;
  /** Type of operation */
  type?: "read" | "write" | "execute" | "destructive";
}

/**
 * Tool interface - main abstraction for tools
 */
export interface Tool<TParams = Record<string, unknown>> {
  /** Tool definition for the LLM */
  readonly definition: ToolDefinition;

  /**
   * Validate parameters before execution
   */
  validate(params: TParams): { valid: boolean; error?: string };

  /**
   * Get confirmation requirements for the operation
   */
  getConfirmation?(params: TParams): ToolConfirmation;

  /**
   * Execute the tool with validated parameters
   */
  execute(
    params: TParams,
    options?: ToolExecutionOptions,
  ): Promise<ToolExecutionResult>;
}

/**
 * Options for tool execution
 */
export interface ToolExecutionOptions {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Callback for streaming output */
  onOutput?: (chunk: string) => void;
  /** Working directory */
  cwd?: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Timeout in milliseconds (default: 120000 = 2 minutes) */
  timeout?: number;
}

/**
 * Default timeout for tool execution (2 minutes)
 */
export const DEFAULT_TOOL_TIMEOUT = 120000;

/**
 * Schema for validating tool parameters using Zod
 */
export type ToolParamsSchema<T> = z.ZodSchema<T>;
