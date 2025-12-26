import type {
  AgentDefinition,
  AgentResult,
  Message,
  TerminateReason,
  ToolCall,
} from './types.js';
import type { LLMClient } from '../llm/types.js';
import type { ToolRegistry } from '../tools/registry.js';

/**
 * Options for agent execution
 */
export interface ExecuteOptions {
  /** Input values for template substitution */
  inputs?: Record<string, unknown>;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Callback for activity updates */
  onActivity?: (event: AgentActivityEvent) => void;
}

/**
 * Activity event types for observability
 */
export type AgentActivityEvent =
  | { type: 'turn_start'; turnNumber: number }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call_start'; toolCall: ToolCall }
  | { type: 'tool_call_end'; toolCallId: string; result: string }
  | { type: 'content_chunk'; content: string }
  | { type: 'turn_end'; turnNumber: number }
  | { type: 'error'; error: Error };

/**
 * Agent executor - runs the agent loop
 */
export class AgentExecutor {
  constructor(
    private llmClient: LLMClient,
    private toolRegistry: ToolRegistry
  ) {}

  /**
   * Execute an agent with the given definition and options
   */
  async execute<T>(
    definition: AgentDefinition,
    options: ExecuteOptions = {}
  ): Promise<AgentResult<T>> {
    const { inputs = {}, signal, onActivity } = options;
    const messages: Message[] = [];
    let turnCount = 0;
    let terminateReason: TerminateReason = 'complete';

    const maxTurns = definition.runConfig?.maxTurns ?? 50;
    const timeoutMs = definition.runConfig?.timeoutMs ?? 300000; // 5 min default

    // Build system prompt with input substitution
    const systemPrompt = this.substituteInputs(
      definition.promptConfig.systemPrompt,
      inputs
    );

    // Build initial query
    const query = definition.promptConfig.query
      ? this.substituteInputs(definition.promptConfig.query, inputs)
      : undefined;

    // Add initial messages
    if (definition.promptConfig.initialMessages) {
      messages.push(...definition.promptConfig.initialMessages);
    }

    // Add query as user message
    if (query) {
      messages.push({ role: 'user', content: query });
    }

    const startTime = Date.now();

    try {
      // Agent loop
      while (turnCount < maxTurns) {
        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          terminateReason = 'timeout';
          break;
        }

        // Check abort signal
        if (signal?.aborted) {
          terminateReason = 'abort_signal';
          break;
        }

        turnCount++;
        onActivity?.({ type: 'turn_start', turnNumber: turnCount });

        // Call LLM
        const response = await this.llmClient.chat({
          model: definition.modelConfig.model,
          messages,
          systemPrompt,
          tools: this.getToolDefinitions(definition),
          temperature: definition.modelConfig.temperature,
          maxTokens: definition.modelConfig.maxTokens,
        });

        // Handle thinking content
        if (response.thinking) {
          onActivity?.({ type: 'thinking', content: response.thinking });
        }

        // Handle content
        if (response.content) {
          onActivity?.({ type: 'content_chunk', content: response.content });
          messages.push({ role: 'assistant', content: response.content });
        }

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          const toolResults = await this.executeToolCalls(
            response.toolCalls,
            onActivity
          );

          messages.push({
            role: 'assistant',
            content: response.content ?? '',
            toolCalls: response.toolCalls,
          });

          messages.push({
            role: 'tool',
            content: '',
            toolResults,
          });
        } else {
          // No tool calls - agent is done
          onActivity?.({ type: 'turn_end', turnNumber: turnCount });
          break;
        }

        onActivity?.({ type: 'turn_end', turnNumber: turnCount });
      }

      if (turnCount >= maxTurns) {
        terminateReason = 'max_turns';
      }

      // Extract and validate output
      const lastAssistantMessage = [...messages]
        .reverse()
        .find((m) => m.role === 'assistant');
      const rawContent = lastAssistantMessage?.content ?? '';

      let output: T | undefined;
      if (definition.outputConfig) {
        try {
          const parsed = JSON.parse(rawContent);
          output = definition.outputConfig.schema.parse(parsed) as T;
        } catch {
          // Output validation failed, but execution succeeded
        }
      }

      return {
        success: true,
        output,
        rawContent,
        terminateReason,
        turnCount,
        messages,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      onActivity?.({ type: 'error', error: error as Error });

      return {
        success: false,
        rawContent: '',
        terminateReason: 'error',
        error: errorMessage,
        turnCount,
        messages,
      };
    }
  }

  /**
   * Substitute input values into template string
   */
  private substituteInputs(
    template: string,
    inputs: Record<string, unknown>
  ): string {
    return template.replace(/\$\{(\w+)\}/g, (_, key) => {
      const value = inputs[key];
      return value !== undefined ? String(value) : '';
    });
  }

  /**
   * Get tool definitions for the agent
   */
  private getToolDefinitions(definition: AgentDefinition) {
    if (!definition.toolConfig) return undefined;

    const tools = definition.toolConfig.allowAllTools
      ? this.toolRegistry.getAllTools()
      : definition.toolConfig.tools
          ?.map((t) =>
            typeof t === 'string' ? this.toolRegistry.getTool(t) : t
          )
          .filter((t): t is NonNullable<typeof t> => t !== undefined) ?? [];

    return tools.map((t) => t.definition);
  }

  /**
   * Execute tool calls in parallel
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
    onActivity?: (event: AgentActivityEvent) => void
  ) {
    const results = await Promise.all(
      toolCalls.map(async (toolCall) => {
        onActivity?.({ type: 'tool_call_start', toolCall });

        const tool = this.toolRegistry.getTool(toolCall.name);
        if (!tool) {
          const result = {
            toolCallId: toolCall.id,
            content: '',
            error: `Tool not found: ${toolCall.name}`,
          };
          onActivity?.({
            type: 'tool_call_end',
            toolCallId: toolCall.id,
            result: result.error,
          });
          return result;
        }

        try {
          const result = await tool.execute(toolCall.arguments);
          onActivity?.({
            type: 'tool_call_end',
            toolCallId: toolCall.id,
            result: result.content,
          });
          return {
            toolCallId: toolCall.id,
            content: result.content,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          onActivity?.({
            type: 'tool_call_end',
            toolCallId: toolCall.id,
            result: errorMessage,
          });
          return {
            toolCallId: toolCall.id,
            content: '',
            error: errorMessage,
          };
        }
      })
    );

    return results;
  }
}
