/**
 * Multi-Agent System
 *
 * Provides multi-agent orchestration with specialized agents for different tasks.
 */

// Types
export type {
  Task,
  TaskStatus,
  TaskCreateOptions,
  TaskUpdateOptions,
  SpecializedAgentDefinition,
  UserIntent,
  TaskSuggestion,
  InputAnalysis,
  AgentExecutionResult,
  SpawnOptions,
  MultiAgentEvent,
  AgentManagerConfig,
  TaskStoreListener,
} from './types.js';

// Task Store
export {
  createTask,
  updateTask,
  getTask,
  getAllTasks,
  getTasksByStatus,
  getUnblockedTasks,
  getTasksByOwner,
  deleteTask,
  clearTasks,
  subscribe as subscribeToTasks,
  getTaskCount,
  hasTask,
} from './task-store.js';

// User Input Agent
export {
  analyzeUserInput,
  quickClassifyIntent,
  getToolRecommendations,
} from './user-input-agent.js';

// Tool RAG
export {
  initializeToolRAG,
  retrieveTools,
  suggestAgent,
  isToolRAGInitialized,
  clearRAG,
  toolKnowledgeBase,
  getToolKnowledge,
  getAllToolKnowledge,
  type ToolKnowledge,
  type ToolRecommendation,
} from './tool-rag/index.js';

// Agent Manager
export {
  createAgentManager,
  type AgentManager,
} from './agent-manager.js';

// Specialized Agents
export {
  bashAgent,
  exploreAgent,
  planAgent,
  generalAgent,
  specializedAgents,
  getAgentDefinition,
  getAgentTypes,
} from './specialized/index.js';

// Debug Logger
export {
  setMultiAgentDebug,
  isMultiAgentDebugEnabled,
  logMultiAgentEvent,
  logConversationHistory,
  logOrchestrationSummary,
} from './debug-logger.js';
