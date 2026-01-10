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

  /**
   * Creates a new ChatSession instance.
   *
   * @remarks
   * The ChatSession manages a continuous conversation with an LLM, maintaining
   * message history across multiple turns. Unlike AgentExecutor which creates
   * fresh message arrays for each execution, ChatSession accumulates messages
   * over time, enabling context-aware multi-turn conversations.
   *
   * The system prompt is set once at session creation and remains constant
   * throughout the session lifecycle. This follows the gemini-cli pattern
   * where system instructions are not repeated in the message history.
   *
   * @param llmClient - The LLM client instance used to communicate with the
   * language model provider (e.g., OpenAI, Anthropic, Google).
   * @param toolRegistry - The registry containing available tools that the
   * LLM can invoke during the conversation.
   * @param config - Configuration object containing the system prompt, model
   * settings, and optional run/tool configurations.
   */
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
   * Sends a user message to the LLM and returns the assistant's response.
   *
   * @remarks
   * This method implements the core agent loop for processing a user message.
   * The message is added to the session history before processing, and all
   * subsequent assistant responses and tool interactions are also accumulated
   * in the history.
   *
   * The agent loop continues until one of the following conditions is met:
   * - The assistant provides a response without tool calls (normal completion)
   * - The maximum number of turns is reached (configured via `runConfig.maxTurns`)
   * - The timeout is exceeded (configured via `runConfig.timeoutMs`)
   * - The abort signal is triggered (via `options.signal`)
   * - An error occurs during processing
   *
   * Tool calls are executed in parallel when multiple tools are invoked in a
   * single turn. Activity callbacks are provided throughout the process to
   * enable real-time UI updates.
   *
   * @param userMessage - The user's message content to send to the LLM.
   * @param options - Optional configuration for this message, including abort
   * signal for cancellation and activity callback for progress updates.
   * @returns A promise that resolves to a SendMessageResult containing the
   * success status, assistant's response content, turn count, and termination
   * reason. If an error occurs, the result includes the error message.
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
        const tools = this.getToolDefinitions();

        const chatRequest = {
          model: this.modelConfig.model,
          messages: this.messages,
          systemPrompt: this.systemPrompt,
          tools,
          temperature: this.modelConfig.temperature,
          maxTokens: this.modelConfig.maxTokens,
        };

        let content = '';
        let toolCalls: ToolCall[] = [];

        // Use streaming if available
        if (this.llmClient.chatStream) {
          const stream = this.llmClient.chatStream(chatRequest);
          for await (const chunk of stream) {
            if (chunk.content) {
              content += chunk.content;
              onActivity?.({ type: 'content_chunk', content: chunk.content });
            }
            if (chunk.thinking) {
              onActivity?.({ type: 'thinking', content: chunk.thinking });
            }
            if (chunk.toolCallDelta) {
              // Collect tool calls
              const tc = chunk.toolCallDelta as ToolCall;
              if (tc.id && tc.name) {
                toolCalls.push(tc);
              }
            }
          }
        } else {
          // Fall back to non-streaming
          const response = await this.llmClient.chat(chatRequest);
          content = response.content ?? '';
          toolCalls = response.toolCalls ?? [];

          // Handle thinking content
          if (response.thinking) {
            onActivity?.({ type: 'thinking', content: response.thinking });
          }

          // Handle content
          if (content) {
            onActivity?.({ type: 'content_chunk', content });
          }
        }

        // Handle tool calls
        if (toolCalls.length > 0) {
          const toolResults = await this.executeToolCalls(
            toolCalls,
            onActivity
          );

          // Add assistant message with tool calls
          this.messages.push({
            role: 'assistant',
            content: content,
            toolCalls: toolCalls,
          });

          // Add tool results
          this.messages.push({
            role: 'tool',
            content: '',
            toolResults,
          });
        } else {
          // No tool calls - add final response and done
          if (content) {
            this.messages.push({ role: 'assistant', content: content });
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
   * Returns the current message history for this session.
   *
   * @remarks
   * The history contains all messages exchanged during this session, including
   * user messages, assistant responses, and tool interaction messages. Messages
   * are stored in chronological order.
   *
   * The returned array is a shallow copy of the internal message array, so
   * modifications to the returned array will not affect the session state.
   * However, the individual Message objects are not cloned, so mutating their
   * properties would affect the internal state.
   *
   * This method is useful for:
   * - Displaying conversation history in a UI
   * - Persisting session state for later restoration
   * - Debugging and logging purposes
   *
   * @returns A shallow copy of the message array containing all messages in
   * the session, in chronological order from oldest to newest.
   */
  getHistory(): Message[] {
    return [...this.messages];
  }

  /**
   * Clears all messages from the session history.
   *
   * @remarks
   * This method resets the conversation state by removing all accumulated
   * messages. After calling this method, the session will behave as if it
   * were newly created, with an empty message history.
   *
   * Note that the system prompt and configuration remain unchanged. Only the
   * message history is cleared. This is useful for:
   * - Starting a fresh conversation within the same session
   * - Implementing "new chat" functionality without recreating the session
   * - Freeing memory when the conversation history is no longer needed
   *
   * This operation is irreversible. If you need to preserve the history before
   * clearing, call `getHistory()` first to save a copy.
   *
   * @returns void
   */
  clearHistory(): void {
    this.messages = [];
  }

  /**
   * Appends messages to the existing session history.
   *
   * @remarks
   * This method allows adding pre-existing messages to the session history,
   * which is primarily useful for restoring a previously saved session. The
   * messages are appended to the end of the current history, preserving any
   * existing messages.
   *
   * Common use cases include:
   * - Loading a saved conversation from persistent storage
   * - Migrating history from another session instance
   * - Pre-populating the session with example conversations
   * - Implementing session restoration after application restart
   *
   * The messages should follow the expected format with proper role assignments
   * (user, assistant, tool) and maintain the expected conversation flow. Invalid
   * or improperly formatted messages may cause unexpected behavior in subsequent
   * `sendMessage()` calls.
   *
   * @param messages - An array of Message objects to append to the session
   * history. Messages are added in the order they appear in the array.
   * @returns void
   */
  addHistory(messages: Message[]): void {
    this.messages.push(...messages);
  }

  /**
   * Retrieves the tool definitions to be passed to the LLM.
   *
   * @remarks
   * This method resolves the tool configuration into a list of tool definitions
   * that the LLM can understand and invoke. The resolution process handles two
   * configuration modes:
   *
   * 1. **Allow all tools**: When `toolConfig.allowAllTools` is true, all tools
   *    registered in the ToolRegistry are made available to the LLM.
   *
   * 2. **Specific tools**: When a list of tools is provided via `toolConfig.tools`,
   *    only those specific tools are included. Tools can be specified either as
   *    string names (resolved from the registry) or as direct tool objects.
   *
   * If no tool configuration is provided, the method returns undefined, indicating
   * that no tools should be available for this session.
   *
   * @returns An array of tool definition objects formatted for the LLM, or
   * undefined if no tools are configured for this session.
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
   * Executes multiple tool calls concurrently and returns their results.
   *
   * @remarks
   * This method processes all tool calls from a single LLM response in parallel
   * using `Promise.all`. Each tool call is resolved from the ToolRegistry and
   * executed with its provided arguments.
   *
   * For each tool call, the method:
   * 1. Emits a `tool_call_start` activity event
   * 2. Looks up the tool in the registry
   * 3. Executes the tool with the provided arguments
   * 4. Emits a `tool_call_end` activity event with the result or error
   *
   * Error handling is performed per-tool, meaning one tool's failure does not
   * prevent other tools from executing. Failed tools return an error message
   * in their result object rather than throwing an exception.
   *
   * If a tool is not found in the registry, an error result is returned for
   * that specific tool call without affecting other tool calls.
   *
   * @param toolCalls - An array of ToolCall objects from the LLM response,
   * each containing the tool name, arguments, and a unique call ID.
   * @param onActivity - Optional callback function to receive activity events
   * for tool execution progress, useful for UI updates.
   * @returns A promise that resolves to an array of tool results, each containing
   * the tool call ID, content (on success), and optionally an error message.
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
