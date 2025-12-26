import { z } from 'zod';
import type { Tool } from '../tools/types.js';

/**
 * Configuration for the agent's system prompt and initial messages
 */
export interface PromptConfig {
  /** System prompt that defines the agent's behavior */
  systemPrompt: string;
  /** Initial messages to seed the conversation */
  initialMessages?: Message[];
  /** Query template with ${variable} substitution */
  query?: string;
}

/**
 * Configuration for the LLM model
 */
export interface ModelConfig {
  /** Model identifier (e.g., 'gpt-4', 'claude-3', 'gemini-pro') */
  model: string;
  /** Temperature for response generation (0-2) */
  temperature?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Thinking/reasoning budget for supported models */
  thinkingBudget?: number;
}

/**
 * Configuration for agent execution limits
 */
export interface RunConfig {
  /** Maximum number of turns before termination */
  maxTurns?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Whether to stream responses */
  streaming?: boolean;
}

/**
 * Configuration for available tools
 */
export interface ToolConfig {
  /** List of tool names or tool instances available to the agent */
  tools?: (string | Tool)[];
  /** Whether to allow all registered tools */
  allowAllTools?: boolean;
}

/**
 * Configuration for agent inputs
 */
export interface InputConfig {
  /** Input parameter definitions */
  inputs: Record<string, InputDefinition>;
}

/**
 * Definition of an input parameter
 */
export interface InputDefinition {
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Whether the parameter is required */
  required?: boolean;
  /** Default value if not provided */
  default?: unknown;
  /** Description of the parameter */
  description?: string;
}

/**
 * Configuration for structured agent output
 */
export interface OutputConfig<T extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Name of the output field */
  outputName: string;
  /** Zod schema for output validation */
  schema: T;
  /** Description of the expected output */
  description?: string;
}

/**
 * Complete agent definition
 */
export interface AgentDefinition<TOutput extends z.ZodTypeAny = z.ZodAny> {
  /** Unique name for the agent */
  name: string;
  /** Human-readable description */
  description: string;
  /** Prompt configuration */
  promptConfig: PromptConfig;
  /** Model configuration */
  modelConfig: ModelConfig;
  /** Execution configuration */
  runConfig?: RunConfig;
  /** Tool configuration */
  toolConfig?: ToolConfig;
  /** Input configuration */
  inputConfig?: InputConfig;
  /** Output configuration */
  outputConfig?: OutputConfig<TOutput>;
  /** Custom output processor */
  processOutput?: (output: z.infer<TOutput>) => string;
}

/**
 * Message role types
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Message structure
 */
export interface Message {
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

/**
 * Tool call from the model
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Result from tool execution
 */
export interface ToolResult {
  toolCallId: string;
  content: string;
  error?: string;
}

/**
 * Reason for agent termination
 */
export type TerminateReason =
  | 'complete'
  | 'max_turns'
  | 'timeout'
  | 'error'
  | 'user_cancelled'
  | 'abort_signal';

/**
 * Result from agent execution
 */
export interface AgentResult<T = unknown> {
  /** Whether the agent completed successfully */
  success: boolean;
  /** Parsed output if output schema was defined */
  output?: T;
  /** Raw response content */
  rawContent: string;
  /** Reason for termination */
  terminateReason: TerminateReason;
  /** Error message if failed */
  error?: string;
  /** Number of turns executed */
  turnCount: number;
  /** Conversation history */
  messages: Message[];
}
