/**
 * Agent Manager - Orchestrates specialized agents for multi-agent coordination
 */

import type { Config } from "../../config/config.js";
import type { AgentDefinition } from "../types.js";
import { AgentExecutor } from "../executor.js";
import type { AgentActivityEvent } from "../executor.js";
import type {
  SpecializedAgentDefinition,
  AgentExecutionResult,
  SpawnOptions,
  AgentManagerConfig,
} from "./types.js";
import { specializedAgents, getAgentDefinition } from "./specialized/index.js";
import {
  setMultiAgentDebug,
  isMultiAgentDebugEnabled,
  logMultiAgentEvent,
  logConversationHistory,
} from "./debug-logger.js";

/**
 * Create an agent manager for multi-agent orchestration
 *
 * @param config - The application Config instance
 * @param options - Optional overrides for model, maxTurns, and cwd
 */
export function createAgentManager(
  config: Config,
  options: AgentManagerConfig = {},
) {
  const llmClient = config.getLLMClient();
  const toolRegistry = config.getToolRegistry();
  const llmConfig = config.getLLMConfig();
  const agentConfig = config.getAgentConfig();
  const debugConfig = config.getDebugConfig();
  const policyEngine = config.getPolicyEngine();

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
    options: SpawnOptions = {},
  ): AgentDefinition {
    // Build system prompt with mode information
    let systemPrompt = agent.systemPrompt;

    // Add Plan Mode restrictions to system prompt when active
    const currentMode = policyEngine.getMode();
    if (currentMode === "PLAN") {
      systemPrompt += `

## IMPORTANT: Plan Mode is Active

You are currently in **Plan Mode** (read-only mode). This means:

- **ALLOWED**: read_file, glob, grep, list_directory, get_file_info
- **BLOCKED**: write_file, edit_file, delete_file, create_directory, shell, spawn_agent

If the user asks you to write, create, or execute anything, you MUST:
1. Explain that Plan Mode is active and these operations are blocked
2. Tell the user to exit Plan Mode using \`/plan exit\` or \`/mode default\` to enable writing

Do NOT repeatedly ask questions about file paths or permissions. Simply explain that Plan Mode prevents these operations.`;
    }

    return {
      name: agent.type,
      description: agent.description,
      promptConfig: {
        systemPrompt,
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
    options: SpawnOptions = {},
  ): Promise<AgentExecutionResult> {
    const agent = getAgent(agentType);
    if (!agent) {
      return {
        success: false,
        content: "",
        agentType,
        terminateReason: "error",
        error: `Unknown agent type: ${agentType}`,
        turnCount: 0,
        messages: [],
      };
    }

    const definition = toAgentDefinition(agent, prompt, options);

    // Notify spawn start
    const spawnStartEvent = {
      type: "agent_spawn_start" as const,
      agentType,
      taskId: options.taskId,
    };
    options.onActivity?.(spawnStartEvent);
    logMultiAgentEvent(spawnStartEvent);

    try {
      const result = await executor.execute(definition, {
        signal: options.signal,
        cwd: options.cwd ?? defaultCwd,
        policyEngine,
        onActivity: (event: AgentActivityEvent) => {
          // Map executor events to multi-agent events
          switch (event.type) {
            case "turn_start":
              options.onActivity?.({
                type: "turn_start",
                turnNumber: event.turnNumber,
                agentType,
              });
              break;
            case "turn_end":
              options.onActivity?.({
                type: "turn_end",
                turnNumber: event.turnNumber,
                agentType,
              });
              break;
            case "content_chunk":
              options.onActivity?.({
                type: "content_chunk",
                content: event.content,
                agentType,
              });
              break;
            case "tool_call_start":
              options.onActivity?.({
                type: "tool_call_start",
                toolName: event.toolCall.name,
                agentType,
              });
              break;
            case "tool_call_end":
              options.onActivity?.({
                type: "tool_call_end",
                toolName: event.toolCallId,
                result: event.result,
                agentType,
              });
              break;
            case "error":
              options.onActivity?.({
                type: "error",
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

      // Log conversation history in debug mode
      if (isMultiAgentDebugEnabled()) {
        logConversationHistory(agentType, result.messages);
      }

      const spawnCompleteEvent = {
        type: "agent_spawn_complete" as const,
        result: executionResult,
      };
      options.onActivity?.(spawnCompleteEvent);
      logMultiAgentEvent(spawnCompleteEvent);

      return executionResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const executionResult: AgentExecutionResult = {
        success: false,
        content: "",
        taskId: options.taskId,
        agentType,
        terminateReason: "error",
        error: errorMessage,
        turnCount: 0,
        messages: [],
      };

      options.onActivity?.({
        type: "error",
        error: error instanceof Error ? error : new Error(errorMessage),
        agentType,
      });

      return executionResult;
    }
  }

  /**
   * Simple keyword-based agent routing (no LLM call)
   * Following gemini-cli pattern: avoid costly LLM calls for routing
   */
  function routeToAgent(userInput: string): string {
    const input = userInput.toLowerCase();

    // Math problems: probability, calculate, equation, formula, etc.
    if (
      /\b(probability|calculate|equation|formula|solve|math|integral|derivative|statistics|p\(|e\^)\b/i.test(
        input,
      )
    ) {
      return "math";
    }

    // Code exploration: find, search, where is, how does
    if (
      /\b(find|search|where is|how does|show me|list all)\b/i.test(input) &&
      /\b(file|code|function|class|method|variable)\b/i.test(input)
    ) {
      return "explore";
    }

    // Bash/shell commands: run, execute, git, npm, build
    if (
      /^(run|execute|git|npm|yarn|pnpm|make|docker|kubectl)\b/i.test(
        input.trim(),
      )
    ) {
      return "bash";
    }

    // Default to general agent (has all tools)
    return "general";
  }

  /**
   * Process user input through the multi-agent system
   * Uses simple keyword routing instead of LLM-based analysis (cost efficient)
   */
  async function processInput(
    userInput: string,
    options: SpawnOptions = {},
  ): Promise<AgentExecutionResult> {
    // Simple keyword-based routing (no LLM call)
    const agentType = routeToAgent(userInput);

    logMultiAgentEvent({
      type: "input_analysis_complete" as const,
      analysis: {
        intent: "unknown",
        requiresPlanning: false,
        suggestedAgent: agentType,
        originalInput: userInput,
      },
    });

    return spawn(agentType, userInput, options);
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
