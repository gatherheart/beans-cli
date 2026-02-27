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
  metadata?: Record<string, unknown>;
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
