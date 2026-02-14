/**
 * Multi-agent system types
 */

import type { Tool } from '../../tools/types.js';
import type { Message, TerminateReason } from '../types.js';

/**
 * Task status in the task store
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Task in the multi-agent task store
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  /** Brief title for the task */
  subject: string;
  /** Detailed description of what needs to be done */
  description: string;
  /** Present continuous form shown in spinner when in_progress */
  activeForm?: string;
  /** Current task status */
  status: TaskStatus;
  /** Agent that owns/is working on this task */
  owner?: string;
  /** Task IDs that cannot start until this one completes */
  blocks: string[];
  /** Task IDs that must complete before this one can start */
  blockedBy: string[];
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
  /** When the task was created */
  createdAt: string;
  /** When the task was last updated */
  updatedAt: string;
}

/**
 * Options for creating a task
 */
export interface TaskCreateOptions {
  subject: string;
  description: string;
  activeForm?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Options for updating a task
 */
export interface TaskUpdateOptions {
  taskId: string;
  subject?: string;
  description?: string;
  activeForm?: string;
  status?: TaskStatus;
  owner?: string;
  metadata?: Record<string, unknown>;
  addBlocks?: string[];
  addBlockedBy?: string[];
}

/**
 * Specialized agent definition
 */
export interface SpecializedAgentDefinition {
  /** Unique identifier for this agent type */
  type: string;
  /** Human-readable name */
  name: string;
  /** Description of what this agent does */
  description: string;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Tools this agent can use */
  tools?: string[] | Tool[];
  /** Whether to allow all registered tools */
  allowAllTools?: boolean;
  /** Maximum turns for this agent */
  maxTurns?: number;
  /** Model to use (defaults to config model) */
  model?: string;
}

/**
 * Intent classification from user input analysis
 */
export type UserIntent =
  | 'simple_question'
  | 'web_search'
  | 'code_exploration'
  | 'code_modification'
  | 'bash_execution'
  | 'planning'
  | 'multi_step_task'
  | 'unknown';

/**
 * Task suggestion from user input analysis
 */
export interface TaskSuggestion {
  /** Brief task title */
  subject: string;
  /** Detailed task description */
  description: string;
  /** Suggested agent type for this task */
  suggestedAgent: string;
  /** Task IDs this task depends on */
  dependencies?: string[];
}

/**
 * Result from analyzing user input
 */
export interface InputAnalysis {
  /** Classified user intent */
  intent: UserIntent;
  /** Whether this requires task planning */
  requiresPlanning: boolean;
  /** Suggested agent type for simple requests */
  suggestedAgent?: string;
  /** Task breakdown for complex requests */
  tasks?: TaskSuggestion[];
  /** Original user input */
  originalInput: string;
}

/**
 * Result from agent execution
 */
export interface AgentExecutionResult {
  /** Whether the agent completed successfully */
  success: boolean;
  /** Agent output content */
  content: string;
  /** Task ID if this was task execution */
  taskId?: string;
  /** Agent type that executed */
  agentType: string;
  /** Reason for termination */
  terminateReason: TerminateReason;
  /** Number of turns used */
  turnCount: number;
  /** Error message if failed */
  error?: string;
  /** Conversation messages */
  messages: Message[];
}

/**
 * Options for spawning an agent
 */
export interface SpawnOptions {
  /** Task ID to associate with this execution */
  taskId?: string;
  /** Maximum turns override */
  maxTurns?: number;
  /** Working directory */
  cwd?: string;
  /** Abort signal */
  signal?: AbortSignal;
  /** Activity callback */
  onActivity?: (event: MultiAgentEvent) => void;
  /** Conversation history to provide context */
  conversationHistory?: Message[];
}

/**
 * Events emitted by the multi-agent system
 */
export type MultiAgentEvent =
  | { type: 'input_analysis_start'; input: string }
  | { type: 'input_analysis_complete'; analysis: InputAnalysis }
  | { type: 'task_created'; task: Task }
  | { type: 'task_updated'; task: Task }
  | { type: 'agent_spawn_start'; agentType: string; taskId?: string }
  | { type: 'agent_spawn_complete'; result: AgentExecutionResult }
  | { type: 'turn_start'; turnNumber: number; agentType: string }
  | { type: 'turn_end'; turnNumber: number; agentType: string }
  | { type: 'content_chunk'; content: string; agentType: string }
  | { type: 'tool_call_start'; toolName: string; agentType: string }
  | { type: 'tool_call_end'; toolName: string; result: string; agentType: string }
  | { type: 'error'; error: Error; agentType?: string };

/**
 * Configuration for the agent manager
 */
export interface AgentManagerConfig {
  /** Default model to use (overrides config) */
  model?: string;
  /** Default max turns (overrides config) */
  maxTurns?: number;
  /** Working directory */
  cwd?: string;
}

/**
 * Listener for task store updates
 */
export type TaskStoreListener = (tasks: Task[]) => void;
