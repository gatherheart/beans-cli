/**
 * ChatSession - Manages a continuous chat session with message history
 *
 * Following gemini-cli patterns:
 * - System prompt is set once at session start
 * - Messages accumulate across turns
 * - Each sendMessage() adds to existing history
 */

import type {
  Message,
  TerminateReason,
  ToolCall,
  ModelConfig,
  RunConfig,
  ToolConfig,
} from './types.js';
import type { LLMClient } from '../llm/types.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { AgentActivityEvent } from './executor.js';

/**
 * Configuration for creating a chat session
 */
export interface ChatSessionConfig {
  /** System prompt - set once for the session */
  systemPrompt: string;
  /** Model configuration */
  modelConfig: ModelConfig;
  /** Run configuration */
  runConfig?: RunConfig;
  /** Tool configuration */
  toolConfig?: ToolConfig;
}

/**
 * Result from sending a message
 */
export interface SendMessageResult {
  /** Whether the message was processed successfully */
  success: boolean;
  /** The assistant's response content */
  content: string;
  /** Error message if failed */
  error?: string;
  /** Number of turns taken */
  turnCount: number;
  /** Reason for termination */
  terminateReason: TerminateReason;
}

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Callback for activity updates */
  onActivity?: (event: AgentActivityEvent) => void;
}

/**
 * ChatSession - Maintains state for a continuous conversation
 */
export class ChatSession {
  private messages: Message[] = [];
  private readonly systemPrompt: string;
  private readonly modelConfig: ModelConfig;
  private readonly runConfig: RunConfig;
  private readonly toolConfig?: ToolConfig;

  constructor(
    private readonly llmClient: LLMClient,
    private readonly toolRegistry: ToolRegistry,
    config: ChatSessionConfig
  ) {
    this.systemPrompt = config.systemPrompt;
    this.modelConfig = config.modelConfig;
    this.runConfig = config.runConfig ?? {};
    this.toolConfig = config.toolConfig;
  }

  /**
   * Send a message and get a response
   * Messages are accumulated in the session history
   */
  async sendMessage(
    userMessage: string,
    options: SendMessageOptions = {}
  ): Promise<SendMessageResult> {
    const { signal, onActivity } = options;

    // Add user message to history
    this.messages.push({ role: 'user', content: userMessage });

    const maxTurns = this.runConfig.maxTurns ?? 50;
    const timeoutMs = this.runConfig.timeoutMs ?? 300000;
    const startTime = Date.now();
    let turnCount = 0;
    let terminateReason: TerminateReason = 'complete';

    try {
      // Agent loop for this message
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

        // Call LLM with accumulated messages
        const response = await this.llmClient.chat({
          model: this.modelConfig.model,
          messages: this.messages,
          systemPrompt: this.systemPrompt,
          tools: this.getToolDefinitions(),
          temperature: this.modelConfig.temperature,
          maxTokens: this.modelConfig.maxTokens,
        });

        // Handle thinking content
        if (response.thinking) {
          onActivity?.({ type: 'thinking', content: response.thinking });
        }

        // Handle content
        if (response.content) {
          onActivity?.({ type: 'content_chunk', content: response.content });
        }

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          const toolResults = await this.executeToolCalls(
            response.toolCalls,
            onActivity
          );

          // Add assistant message with tool calls
          this.messages.push({
            role: 'assistant',
            content: response.content ?? '',
            toolCalls: response.toolCalls,
          });

          // Add tool results
          this.messages.push({
            role: 'tool',
            content: '',
            toolResults,
          });
        } else {
          // No tool calls - add final response and done
          if (response.content) {
            this.messages.push({ role: 'assistant', content: response.content });
          }
          onActivity?.({ type: 'turn_end', turnNumber: turnCount });
          break;
        }

        onActivity?.({ type: 'turn_end', turnNumber: turnCount });
      }

      if (turnCount >= maxTurns) {
        terminateReason = 'max_turns';
      }

      // Get the last assistant response
      const lastAssistant = [...this.messages]
        .reverse()
        .find((m) => m.role === 'assistant');

      return {
        success: true,
        content: lastAssistant?.content ?? '',
        turnCount,
        terminateReason,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      onActivity?.({ type: 'error', error: error as Error });

      return {
        success: false,
        content: '',
        error: errorMessage,
        turnCount,
        terminateReason: 'error',
      };
    }
  }

  /**
   * Get the current message history
   */
  getHistory(): Message[] {
    return [...this.messages];
  }

  /**
   * Clear the message history
   */
  clearHistory(): void {
    this.messages = [];
  }

  /**
   * Add messages to history (for loading saved sessions)
   */
  addHistory(messages: Message[]): void {
    this.messages.push(...messages);
  }

  /**
   * Get tool definitions for the session
   */
  private getToolDefinitions() {
    if (!this.toolConfig) return undefined;

    const tools = this.toolConfig.allowAllTools
      ? this.toolRegistry.getAllTools()
      : this.toolConfig.tools
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
