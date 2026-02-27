import type {
  AgentDefinition,
  AgentResult,
  Message,
  TerminateReason,
  ToolCall,
} from "./types.js";
import type { LLMClient } from "../llm/types.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { MemoryStore } from "../memory/index.js";
import type { PolicyEngine } from "../policy/engine.js";
import { executeWithTimeout, DEFAULT_TOOL_TIMEOUT } from "../tools/utils.js";
import { LoopDetector, type LoopDetectorConfig } from "./loop-detector.js";

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
  /** Working directory for tool execution */
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
  /** Loop detection configuration */
  loopDetection?: Partial<LoopDetectorConfig>;
}

/**
 * Activity event types for observability
 */
export type AgentActivityEvent =
  | { type: "turn_start"; turnNumber: number }
  | { type: "thinking"; content: string }
  | { type: "tool_call_start"; toolCall: ToolCall }
  | {
      type: "tool_call_end";
      toolCallId: string;
      result: string;
      metadata?: Record<string, unknown>;
    }
  | { type: "content_chunk"; content: string }
  | { type: "turn_end"; turnNumber: number }
  | { type: "error"; error: Error }
  | { type: "loop_warning"; pattern: string[]; suggestion: string }
  | { type: "loop_detected"; pattern: string[]; message: string };

/**
 * Agent executor - runs the agent loop
 */
export class AgentExecutor {
  constructor(
    private llmClient: LLMClient,
    private toolRegistry: ToolRegistry,
  ) {}

  /**
   * Execute an agent with the given definition and options
   */
  async execute<T>(
    definition: AgentDefinition,
    options: ExecuteOptions = {},
  ): Promise<AgentResult<T>> {
    const {
      inputs = {},
      signal,
      onActivity,
      cwd = process.cwd(),
      memoryStore,
      policyEngine,
      onApprovalRequest,
      loopDetection,
    } = options;
    const messages: Message[] = [];
    let turnCount = 0;
    let terminateReason: TerminateReason = "complete";

    const maxTurns = definition.runConfig?.maxTurns ?? 50;
    const timeoutMs = definition.runConfig?.timeoutMs ?? 300000; // 5 min default

    // Initialize loop detector
    const loopDetectorConfig = {
      ...definition.runConfig?.loopDetection,
      ...loopDetection,
    };
    const loopDetector = new LoopDetector(loopDetectorConfig);

    // Build system prompt with input substitution
    let systemPrompt = this.substituteInputs(
      definition.promptConfig.systemPrompt,
      inputs,
    );

    // Load and prepend memory content if available
    if (memoryStore) {
      try {
        const memoryContent = await memoryStore.getContent();
        if (memoryContent) {
          systemPrompt = `${memoryContent}\n\n---\n\n${systemPrompt}`;
        }
      } catch {
        // Memory loading failed - continue without it
      }
    }

    // Build initial query
    const query = definition.promptConfig.query
      ? this.substituteInputs(definition.promptConfig.query, inputs)
      : undefined;

    // Add initial messages (conversation history)
    if (definition.promptConfig.initialMessages) {
      messages.push(...definition.promptConfig.initialMessages);
    }

    // Add query as user message
    if (query) {
      messages.push({ role: "user", content: query });
    }

    // Track where new messages start (after initial messages + query)
    const newMessagesStartIndex = messages.length;

    const startTime = Date.now();

    try {
      // Agent loop
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

        // Call LLM with retry on empty response
        const tools = this.getToolDefinitions(definition);
        let response = await this.llmClient.chat({
          model: definition.modelConfig.model,
          messages,
          systemPrompt,
          tools,
          temperature: definition.modelConfig.temperature,
          maxTokens: definition.modelConfig.maxTokens,
        });

        // Retry with higher temperature if response is completely empty
        if (!response.content && !response.toolCalls?.length) {
          response = await this.llmClient.chat({
            model: definition.modelConfig.model,
            messages,
            systemPrompt,
            tools,
            temperature: 0.7, // Use higher temperature on retry
            maxTokens: definition.modelConfig.maxTokens,
          });
        }

        // Second retry with even higher temperature and simplified prompt hint
        if (!response.content && !response.toolCalls?.length) {
          const retryMessages = [
            ...messages,
            {
              role: "user" as const,
              content:
                "(Please respond with either a text answer or use a tool. Do not return an empty response.)",
            },
          ];
          response = await this.llmClient.chat({
            model: definition.modelConfig.model,
            messages: retryMessages,
            systemPrompt,
            tools,
            temperature: 1.0,
            maxTokens: definition.modelConfig.maxTokens,
          });
        }

        // Handle thinking content
        if (response.thinking) {
          onActivity?.({ type: "thinking", content: response.thinking });
        }

        // Handle content - emit chunk for streaming UI
        if (response.content) {
          onActivity?.({ type: "content_chunk", content: response.content });
        }

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          // Check for loops before executing
          for (const toolCall of response.toolCalls) {
            const loopResult = loopDetector.check(toolCall, turnCount);

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
              terminateReason = "error";
              return {
                success: false,
                rawContent: "",
                terminateReason,
                error: `Loop detected: ${loopResult.suggestion}`,
                turnCount,
                messages,
              };
            }
          }

          const toolResults = await this.executeToolCalls(
            response.toolCalls,
            onActivity,
            cwd,
            DEFAULT_TOOL_TIMEOUT,
            policyEngine,
            onApprovalRequest,
          );

          // Push assistant message with content AND tool calls together
          messages.push({
            role: "assistant",
            content: response.content ?? "",
            toolCalls: response.toolCalls,
          });

          messages.push({
            role: "tool",
            content: "",
            toolResults,
          });
        } else {
          // No tool calls - push final assistant message and done
          // Always push a message, even if empty, to ensure we have a response
          const content =
            response.content ||
            "(The assistant did not provide a response. This may indicate an issue with the request or the model.)";
          messages.push({ role: "assistant", content });
          if (!response.content) {
            // Emit the fallback content so UI shows something
            onActivity?.({ type: "content_chunk", content });
          }
          onActivity?.({ type: "turn_end", turnNumber: turnCount });
          break;
        }

        onActivity?.({ type: "turn_end", turnNumber: turnCount });
      }

      if (turnCount >= maxTurns) {
        terminateReason = "max_turns";
      }

      // Extract and validate output - only look at NEW messages (not conversation history)
      const newMessages = messages.slice(newMessagesStartIndex);
      const lastAssistantMessage = [...newMessages]
        .reverse()
        .find((m) => m.role === "assistant");
      const rawContent = lastAssistantMessage?.content ?? "";

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
      onActivity?.({ type: "error", error: error as Error });

      return {
        success: false,
        rawContent: "",
        terminateReason: "error",
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
    inputs: Record<string, unknown>,
  ): string {
    return template.replace(/\$\{(\w+)\}/g, (_, key) => {
      const value = inputs[key];
      return value !== undefined ? String(value) : "";
    });
  }

  /**
   * Get tool definitions for the agent
   */
  private getToolDefinitions(definition: AgentDefinition) {
    if (!definition.toolConfig) return undefined;

    const tools = definition.toolConfig.allowAllTools
      ? this.toolRegistry.getAllTools()
      : (definition.toolConfig.tools
          ?.map((t) =>
            typeof t === "string" ? this.toolRegistry.getTool(t) : t,
          )
          .filter((t): t is NonNullable<typeof t> => t !== undefined) ?? []);

    return tools.map((t) => t.definition);
  }

  /**
   * Execute tool calls in parallel with timeout enforcement
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
    onActivity: ((event: AgentActivityEvent) => void) | undefined,
    cwd: string,
    toolTimeout: number = DEFAULT_TOOL_TIMEOUT,
    policyEngine?: PolicyEngine,
    onApprovalRequest?: (
      toolName: string,
      params: Record<string, unknown>,
      message: string,
    ) => Promise<boolean>,
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
        if (policyEngine) {
          const confirmation = tool.getConfirmation?.(toolCall.arguments);
          const decision = policyEngine.evaluate({
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
          if (decision.requiresApproval && onApprovalRequest) {
            const approved = await onApprovalRequest(
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
          // Execute with timeout enforcement
          const result = await executeWithTimeout(
            toolCall.name,
            () =>
              tool.execute(toolCall.arguments, { cwd, timeout: toolTimeout }),
            toolTimeout,
          );
          onActivity?.({
            type: "tool_call_end",
            toolCallId: toolCall.id,
            result: result.content,
            metadata: result.metadata,
          });
          return {
            toolCallId: toolCall.id,
            content: result.content,
            error: result.isError ? result.content : undefined,
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
