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
} from "./types.js";
import type { LLMClient } from "../llm/types.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { AgentActivityEvent } from "./executor.js";
import type { MemoryStore } from "../memory/index.js";
import type { PolicyEngine } from "../policy/engine.js";
import { LoopDetector } from "./loop-detector.js";
import {
  ChatCompressor,
  type CompressionConfig,
  type CompressionResult,
} from "./compression.js";

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
  /** Working directory for tool execution (defaults to process.cwd()) */
  cwd?: string;
  /** Memory store for loading persistent instructions */
  memoryStore?: MemoryStore;
  /** Policy engine for tool approval */
  policyEngine?: PolicyEngine;
  /** Callback to request user approval for tools */
  onApprovalRequest?: (
    toolName: string,
    params: Record<string, unknown>,
    message: string,
  ) => Promise<boolean>;
  /** Compression configuration */
  compressionConfig?: Partial<CompressionConfig>;
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
  private systemPrompt: string;
  private readonly modelConfig: ModelConfig;
  private readonly runConfig: RunConfig;
  private readonly toolConfig?: ToolConfig;
  private readonly cwd: string;
  private readonly memoryStore?: MemoryStore;
  private readonly policyEngine?: PolicyEngine;
  private readonly onApprovalRequest?: (
    toolName: string,
    params: Record<string, unknown>,
    message: string,
  ) => Promise<boolean>;
  private readonly loopDetector: LoopDetector;
  private readonly compressor: ChatCompressor;
  private memoryInitialized = false;
  private turnCount = 0;
  private lastCompressionResult?: CompressionResult;

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
    config: ChatSessionConfig,
  ) {
    this.systemPrompt = config.systemPrompt;
    this.modelConfig = config.modelConfig;
    this.runConfig = config.runConfig ?? {};
    this.toolConfig = config.toolConfig;
    this.cwd = config.cwd ?? process.cwd();
    this.memoryStore = config.memoryStore;
    this.policyEngine = config.policyEngine;
    this.onApprovalRequest = config.onApprovalRequest;
    this.loopDetector = new LoopDetector(this.runConfig.loopDetection);
    this.compressor = new ChatCompressor(config.compressionConfig);
    this.compressor.setLLMClient(llmClient, config.modelConfig.model);
  }

  /**
   * Initialize memory by loading content from the memory store.
   *
   * @remarks
   * This method loads persistent instructions from the memory store (BEANS.md files)
   * and prepends them to the system prompt. Memory is only loaded once per session;
   * subsequent calls are no-ops.
   *
   * Call this method before the first `sendMessage()` if you want memory content
   * to be included. If not called explicitly, memory will be automatically
   * initialized on the first `sendMessage()`.
   *
   * @returns A promise that resolves when memory initialization is complete.
   */
  async initializeMemory(): Promise<void> {
    if (this.memoryInitialized || !this.memoryStore) {
      return;
    }

    try {
      const memoryContent = await this.memoryStore.getContent();
      if (memoryContent) {
        // Prepend memory content to system prompt
        this.systemPrompt = `${memoryContent}\n\n---\n\n${this.systemPrompt}`;
      }
    } catch (error) {
      // Log but don't fail - memory is optional
      if (this.runConfig.debug) {
        console.warn("[ChatSession] Failed to load memory:", error);
      }
    }

    this.memoryInitialized = true;
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
    options: SendMessageOptions = {},
  ): Promise<SendMessageResult> {
    const { signal, onActivity } = options;

    // Initialize memory on first message if not already done
    await this.initializeMemory();

    // Check if compression should be triggered before processing
    if (this.compressor.shouldCompress(this.messages, this.turnCount)) {
      try {
        this.lastCompressionResult = await this.compressor.compress(
          this.messages,
        );
        this.messages = this.lastCompressionResult.messages;

        if (this.runConfig.debug) {
          console.log(
            `[ChatSession] Compressed ${this.lastCompressionResult.messagesCompressed} messages, ` +
              `saved ~${this.lastCompressionResult.tokensSaved} tokens`,
          );
        }
      } catch (error) {
        // Compression failed - continue without it
        if (this.runConfig.debug) {
          console.warn("[ChatSession] Compression failed:", error);
        }
      }
    }

    // Add user message to history
    this.messages.push({ role: "user", content: userMessage });

    const maxTurns = this.runConfig.maxTurns ?? 50;
    const timeoutMs = this.runConfig.timeoutMs ?? 300000;
    const startTime = Date.now();
    let turnCount = 0;
    let terminateReason: TerminateReason = "complete";

    try {
      // Agent loop for this message
      while (turnCount < maxTurns) {
        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          terminateReason = "timeout";
          break;
        }

        // Check abort signal
        if (signal?.aborted) {
          terminateReason = "abort_signal";
          break;
        }

        turnCount++;
        onActivity?.({ type: "turn_start", turnNumber: turnCount });

        // Call LLM with accumulated messages
        const tools = this.getToolDefinitions();

        // Debug: Log message history being sent
        if (this.runConfig.debug) {
          console.log(
            `[ChatSession] Turn ${turnCount}: Sending ${this.messages.length} messages to LLM`,
          );
          this.messages.forEach((msg, i) => {
            const preview = msg.content?.substring(0, 80) || "(empty)";
            const suffix = msg.content && msg.content.length > 80 ? "..." : "";
            console.log(`  [${i}] ${msg.role}: ${preview}${suffix}`);
          });
          console.log(
            `  Tools: ${tools?.map((t) => t.name).join(", ") || "none"}`,
          );
        }

        const chatRequest = {
          model: this.modelConfig.model,
          messages: this.messages,
          systemPrompt: this.systemPrompt,
          tools,
          temperature: this.modelConfig.temperature,
          maxTokens: this.modelConfig.maxTokens,
        };

        let content = "";
        let toolCalls: ToolCall[] = [];

        // Use streaming if available
        if (this.llmClient.chatStream) {
          const stream = this.llmClient.chatStream(chatRequest);
          for await (const chunk of stream) {
            if (chunk.content) {
              content += chunk.content;
              onActivity?.({ type: "content_chunk", content: chunk.content });
            }
            if (chunk.thinking) {
              onActivity?.({ type: "thinking", content: chunk.thinking });
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
          content = response.content ?? "";
          toolCalls = response.toolCalls ?? [];

          // Handle thinking content
          if (response.thinking) {
            onActivity?.({ type: "thinking", content: response.thinking });
          }

          // Handle content
          if (content) {
            onActivity?.({ type: "content_chunk", content });
          }
        }

        // Handle tool calls
        if (toolCalls.length > 0) {
          // Check for loops before executing
          for (const toolCall of toolCalls) {
            const loopResult = this.loopDetector.check(toolCall, turnCount);

            if (loopResult.shouldWarn) {
              onActivity?.({
                type: "loop_warning",
                pattern: loopResult.pattern!,
                suggestion: loopResult.suggestion!,
              });
            }

            if (loopResult.shouldStop) {
              onActivity?.({
                type: "loop_detected",
                pattern: loopResult.pattern!,
                message: `Stopping due to detected loop: ${loopResult.pattern!.join(" -> ")}`,
              });
              return {
                success: false,
                content: "",
                error: `Loop detected: ${loopResult.suggestion}`,
                turnCount,
                terminateReason: "error",
              };
            }
          }

          const toolResults = await this.executeToolCalls(
            toolCalls,
            onActivity,
          );

          // Add assistant message with tool calls
          this.messages.push({
            role: "assistant",
            content: content,
            toolCalls: toolCalls,
          });

          // Add tool results
          this.messages.push({
            role: "tool",
            content: "",
            toolResults,
          });
        } else {
          // No tool calls - add final response and done
          if (content) {
            this.messages.push({ role: "assistant", content: content });
          }
          onActivity?.({ type: "turn_end", turnNumber: turnCount });
          break;
        }

        onActivity?.({ type: "turn_end", turnNumber: turnCount });
      }

      if (turnCount >= maxTurns) {
        terminateReason = "max_turns";
      }

      // Update session-level turn count
      this.turnCount += turnCount;

      // Get the last assistant response
      const lastAssistant = [...this.messages]
        .reverse()
        .find((m) => m.role === "assistant");

      return {
        success: true,
        content: lastAssistant?.content ?? "",
        turnCount,
        terminateReason,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      onActivity?.({ type: "error", error: error as Error });

      // Update session-level turn count even on error
      this.turnCount += turnCount;

      return {
        success: false,
        content: "",
        error: errorMessage,
        turnCount,
        terminateReason: "error",
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
    this.turnCount = 0;
    this.lastCompressionResult = undefined;
  }

  /**
   * Manually trigger compression of the message history.
   *
   * @remarks
   * This method compresses the current message history regardless of whether
   * the automatic compression thresholds have been met. It's useful for:
   * - Manually reducing context size when needed
   * - Implementing a /compress slash command
   * - Preparing for long-running sessions
   *
   * @returns A promise that resolves to the compression result, including
   * the summary generated and tokens saved. Returns undefined if there's
   * nothing to compress.
   */
  async compress(): Promise<CompressionResult | undefined> {
    if (this.messages.length <= this.compressor.getConfig().preserveRecent) {
      return undefined;
    }

    try {
      this.lastCompressionResult = await this.compressor.compress(
        this.messages,
      );
      this.messages = this.lastCompressionResult.messages;
      return this.lastCompressionResult;
    } catch (error) {
      if (this.runConfig.debug) {
        console.warn("[ChatSession] Manual compression failed:", error);
      }
      throw error;
    }
  }

  /**
   * Get the last compression result, if any.
   *
   * @returns The result from the last compression operation, or undefined
   * if compression has never been performed.
   */
  getLastCompressionResult(): CompressionResult | undefined {
    return this.lastCompressionResult;
  }

  /**
   * Get the session-level turn count.
   *
   * @returns The total number of turns across all sendMessage calls.
   */
  getSessionTurnCount(): number {
    return this.turnCount;
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
   * Returns the current system prompt.
   *
   * @returns The current system prompt string.
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
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
      : (this.toolConfig.tools
          ?.map((t) =>
            typeof t === "string" ? this.toolRegistry.getTool(t) : t,
          )
          .filter((t): t is NonNullable<typeof t> => t !== undefined) ?? []);

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
   * 2. Checks policy engine if available
   * 3. Looks up the tool in the registry
   * 4. Executes the tool with the provided arguments (if allowed)
   * 5. Emits a `tool_call_end` activity event with the result or error
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
    onActivity?: (event: AgentActivityEvent) => void,
  ) {
    const results = await Promise.all(
      toolCalls.map(async (toolCall) => {
        onActivity?.({ type: "tool_call_start", toolCall });

        const tool = this.toolRegistry.getTool(toolCall.name);
        if (!tool) {
          const result = {
            toolCallId: toolCall.id,
            content: "",
            error: `Tool not found: ${toolCall.name}`,
          };
          onActivity?.({
            type: "tool_call_end",
            toolCallId: toolCall.id,
            result: result.error,
          });
          return result;
        }

        // Check policy if policy engine is available
        if (this.policyEngine) {
          const confirmation = tool.getConfirmation?.(toolCall.arguments);
          const decision = this.policyEngine.evaluate({
            toolName: toolCall.name,
            confirmation,
            params: toolCall.arguments,
          });

          // Tool is blocked
          if (!decision.allowed) {
            const result = {
              toolCallId: toolCall.id,
              content: "",
              error:
                decision.reason ||
                `Tool '${toolCall.name}' is blocked by policy`,
            };
            onActivity?.({
              type: "tool_call_end",
              toolCallId: toolCall.id,
              result: result.error,
            });
            return result;
          }

          // Tool requires approval
          if (decision.requiresApproval && this.onApprovalRequest) {
            const approved = await this.onApprovalRequest(
              toolCall.name,
              toolCall.arguments,
              decision.reason || `Approve ${toolCall.name}?`,
            );

            if (!approved) {
              const result = {
                toolCallId: toolCall.id,
                content: "",
                error: `Tool '${toolCall.name}' was rejected by user`,
              };
              onActivity?.({
                type: "tool_call_end",
                toolCallId: toolCall.id,
                result: result.error,
              });
              return result;
            }
          }
        }

        try {
          const result = await tool.execute(toolCall.arguments, {
            cwd: this.cwd,
          });
          onActivity?.({
            type: "tool_call_end",
            toolCallId: toolCall.id,
            result: result.content,
            metadata: result.metadata,
          });
          return {
            toolCallId: toolCall.id,
            content: result.content,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          onActivity?.({
            type: "tool_call_end",
            toolCallId: toolCall.id,
            result: errorMessage,
          });
          return {
            toolCallId: toolCall.id,
            content: "",
            error: errorMessage,
          };
        }
      }),
    );

    return results;
  }
}
