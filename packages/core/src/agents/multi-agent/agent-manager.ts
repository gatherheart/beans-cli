/**
 * Agent Manager - Orchestrates specialized agents for multi-agent coordination
 */

import type { Config } from '../../config/config.js';
import type { AgentDefinition } from '../types.js';
import { AgentExecutor } from '../executor.js';
import type { AgentActivityEvent } from '../executor.js';
import type {
  SpecializedAgentDefinition,
  AgentExecutionResult,
  SpawnOptions,
  AgentManagerConfig,
  InputAnalysis,
} from './types.js';
import { analyzeUserInput } from './user-input-agent.js';
import {
  createTask,
  updateTask,
  getUnblockedTasks,
} from './task-store.js';
import { specializedAgents, getAgentDefinition } from './specialized/index.js';
import {
  setMultiAgentDebug,
  isMultiAgentDebugEnabled,
  logMultiAgentEvent,
  logConversationHistory,
  logOrchestrationSummary,
} from './debug-logger.js';

/**
 * Create an agent manager for multi-agent orchestration
 *
 * @param config - The application Config instance
 * @param options - Optional overrides for model, maxTurns, and cwd
 */
export function createAgentManager(
  config: Config,
  options: AgentManagerConfig = {}
) {
  const llmClient = config.getLLMClient();
  const toolRegistry = config.getToolRegistry();
  const llmConfig = config.getLLMConfig();
  const agentConfig = config.getAgentConfig();
  const debugConfig = config.getDebugConfig();

  const executor = new AgentExecutor(llmClient, toolRegistry);
  const registeredAgents = new Map<string, SpecializedAgentDefinition>();

  // Register default specialized agents
  for (const agent of specializedAgents) {
    registeredAgents.set(agent.type, agent);
  }

  const defaultModel = options.model ?? llmConfig.model;
  const defaultMaxTurns = options.maxTurns ?? agentConfig.maxTurns;
  const defaultCwd = options.cwd ?? process.cwd();

  // Enable debug logging based on config
  setMultiAgentDebug(debugConfig.enabled);

  /**
   * Register a specialized agent definition
   */
  function register(agent: SpecializedAgentDefinition): void {
    registeredAgents.set(agent.type, agent);
  }

  /**
   * Get a registered agent definition
   */
  function getAgent(type: string): SpecializedAgentDefinition | undefined {
    return registeredAgents.get(type) ?? getAgentDefinition(type);
  }

  /**
   * Get all registered agent types
   */
  function getAgentTypes(): string[] {
    return Array.from(registeredAgents.keys());
  }

  /**
   * Convert specialized agent definition to AgentDefinition for executor
   */
  function toAgentDefinition(
    agent: SpecializedAgentDefinition,
    prompt: string,
    options: SpawnOptions = {}
  ): AgentDefinition {
    return {
      name: agent.type,
      description: agent.description,
      promptConfig: {
        systemPrompt: agent.systemPrompt,
        // Include conversation history as initial messages for context
        initialMessages: options.conversationHistory,
        query: prompt,
      },
      modelConfig: {
        model: agent.model ?? defaultModel,
      },
      runConfig: {
        maxTurns: options.maxTurns ?? agent.maxTurns ?? defaultMaxTurns,
      },
      toolConfig: agent.allowAllTools
        ? { allowAllTools: true }
        : { tools: agent.tools },
    };
  }

  /**
   * Spawn a specialized agent to handle a prompt
   */
  async function spawn(
    agentType: string,
    prompt: string,
    options: SpawnOptions = {}
  ): Promise<AgentExecutionResult> {
    const agent = getAgent(agentType);
    if (!agent) {
      return {
        success: false,
        content: '',
        agentType,
        terminateReason: 'error',
        error: `Unknown agent type: ${agentType}`,
        turnCount: 0,
        messages: [],
      };
    }

    const definition = toAgentDefinition(agent, prompt, options);

    // Notify spawn start
    const spawnStartEvent = {
      type: 'agent_spawn_start' as const,
      agentType,
      taskId: options.taskId,
    };
    options.onActivity?.(spawnStartEvent);
    logMultiAgentEvent(spawnStartEvent);

    // Update task status if associated with a task
    if (options.taskId) {
      updateTask({
        taskId: options.taskId,
        status: 'in_progress',
        owner: agentType,
      });
    }

    try {
      const result = await executor.execute(definition, {
        signal: options.signal,
        cwd: options.cwd ?? defaultCwd,
        onActivity: (event: AgentActivityEvent) => {
          // Map executor events to multi-agent events
          switch (event.type) {
            case 'turn_start':
              options.onActivity?.({
                type: 'turn_start',
                turnNumber: event.turnNumber,
                agentType,
              });
              break;
            case 'turn_end':
              options.onActivity?.({
                type: 'turn_end',
                turnNumber: event.turnNumber,
                agentType,
              });
              break;
            case 'content_chunk':
              options.onActivity?.({
                type: 'content_chunk',
                content: event.content,
                agentType,
              });
              break;
            case 'tool_call_start':
              options.onActivity?.({
                type: 'tool_call_start',
                toolName: event.toolCall.name,
                agentType,
              });
              break;
            case 'tool_call_end':
              options.onActivity?.({
                type: 'tool_call_end',
                toolName: event.toolCallId,
                result: event.result,
                agentType,
              });
              break;
            case 'error':
              options.onActivity?.({
                type: 'error',
                error: event.error,
                agentType,
              });
              break;
          }
        },
      });

      const executionResult: AgentExecutionResult = {
        success: result.success,
        content: result.rawContent,
        taskId: options.taskId,
        agentType,
        terminateReason: result.terminateReason,
        turnCount: result.turnCount,
        error: result.error,
        messages: result.messages,
      };

      // Update task status on completion
      if (options.taskId) {
        updateTask({
          taskId: options.taskId,
          status: result.success ? 'completed' : 'pending',
        });
      }

      // Log conversation history in debug mode
      if (isMultiAgentDebugEnabled()) {
        logConversationHistory(agentType, result.messages);
      }

      const spawnCompleteEvent = {
        type: 'agent_spawn_complete' as const,
        result: executionResult,
      };
      options.onActivity?.(spawnCompleteEvent);
      logMultiAgentEvent(spawnCompleteEvent);

      return executionResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const executionResult: AgentExecutionResult = {
        success: false,
        content: '',
        taskId: options.taskId,
        agentType,
        terminateReason: 'error',
        error: errorMessage,
        turnCount: 0,
        messages: [],
      };

      options.onActivity?.({
        type: 'error',
        error: error instanceof Error ? error : new Error(errorMessage),
        agentType,
      });

      return executionResult;
    }
  }

  /**
   * Process user input through the multi-agent system
   */
  async function processInput(
    userInput: string,
    options: SpawnOptions = {}
  ): Promise<AgentExecutionResult> {
    // Notify analysis start
    const analysisStartEvent = {
      type: 'input_analysis_start' as const,
      input: userInput,
    };
    options.onActivity?.(analysisStartEvent);
    logMultiAgentEvent(analysisStartEvent);

    // Analyze user input
    let analysis: InputAnalysis;
    try {
      analysis = await analyzeUserInput(userInput, llmClient, defaultModel);
    } catch {
      // Fallback to general agent on analysis failure
      analysis = {
        intent: 'unknown',
        requiresPlanning: false,
        suggestedAgent: 'general',
        originalInput: userInput,
      };
    }

    // Notify analysis complete
    const analysisCompleteEvent = {
      type: 'input_analysis_complete' as const,
      analysis,
    };
    options.onActivity?.(analysisCompleteEvent);
    logMultiAgentEvent(analysisCompleteEvent);

    // Simple request - spawn single agent
    if (!analysis.requiresPlanning || !analysis.tasks?.length) {
      const agentType = analysis.suggestedAgent ?? 'general';
      return spawn(agentType, userInput, options);
    }

    // Complex request - create tasks and execute
    return executeTaskPlan(analysis, options);
  }

  /**
   * Execute a task plan with dependencies
   */
  async function executeTaskPlan(
    analysis: InputAnalysis,
    options: SpawnOptions = {}
  ): Promise<AgentExecutionResult> {
    const tasks = analysis.tasks ?? [];
    const taskIdMap = new Map<string, string>();
    const results: AgentExecutionResult[] = [];
    const agentsUsed = new Set<string>();

    // Create all tasks first
    for (let i = 0; i < tasks.length; i++) {
      const taskSuggestion = tasks[i];
      const task = createTask({
        subject: taskSuggestion.subject,
        description: taskSuggestion.description,
        metadata: {
          suggestedAgent: taskSuggestion.suggestedAgent,
          originalIndex: i,
        },
      });
      taskIdMap.set(String(i), task.id);

      const taskCreatedEvent = {
        type: 'task_created' as const,
        task,
      };
      options.onActivity?.(taskCreatedEvent);
      logMultiAgentEvent(taskCreatedEvent);
    }

    // Set up dependencies
    for (let i = 0; i < tasks.length; i++) {
      const taskSuggestion = tasks[i];
      const taskId = taskIdMap.get(String(i));
      if (taskId && taskSuggestion.dependencies?.length) {
        const blockedBy = taskSuggestion.dependencies
          .map(dep => taskIdMap.get(dep))
          .filter((id): id is string => id !== undefined);

        if (blockedBy.length > 0) {
          const updatedTask = updateTask({
            taskId,
            addBlockedBy: blockedBy,
          });
          if (updatedTask) {
            const taskUpdatedEvent = {
              type: 'task_updated' as const,
              task: updatedTask,
            };
            options.onActivity?.(taskUpdatedEvent);
            logMultiAgentEvent(taskUpdatedEvent);
          }
        }
      }
    }

    // Execute tasks in dependency order
    let hasMoreTasks = true;
    while (hasMoreTasks) {
      const unblockedTasks = getUnblockedTasks();
      if (unblockedTasks.length === 0) {
        hasMoreTasks = false;
        break;
      }

      // Execute unblocked tasks (could be parallel, but keeping sequential for simplicity)
      for (const task of unblockedTasks) {
        const agentType = (task.metadata?.suggestedAgent as string) ?? 'general';
        agentsUsed.add(agentType);
        const result = await spawn(agentType, task.description, {
          ...options,
          taskId: task.id,
        });
        results.push(result);
      }
    }

    // Log orchestration summary
    const totalTurns = results.reduce((sum, r) => sum + r.turnCount, 0);
    const completedCount = results.filter(r => r.success).length;
    logOrchestrationSummary(
      tasks.length,
      completedCount,
      totalTurns,
      Array.from(agentsUsed)
    );

    // Aggregate results
    const allSuccess = results.every(r => r.success);
    const aggregatedContent = results
      .map(r => `## ${r.agentType} Result\n${r.content}`)
      .join('\n\n');

    return {
      success: allSuccess,
      content: aggregatedContent,
      agentType: 'orchestrator',
      terminateReason: allSuccess ? 'complete' : 'error',
      turnCount: totalTurns,
      messages: results.flatMap(r => r.messages),
    };
  }

  return {
    register,
    getAgent,
    getAgentTypes,
    spawn,
    processInput,
  };
}

export type AgentManager = ReturnType<typeof createAgentManager>;
