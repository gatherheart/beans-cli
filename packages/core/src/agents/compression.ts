/**
 * Chat Compression System
 *
 * Summarizes old messages to reduce token usage while preserving context.
 */

import type { Message } from "./types.js";
import type { LLMClient } from "../llm/types.js";

/**
 * Configuration for chat compression
 */
export interface CompressionConfig {
  /** Whether compression is enabled */
  enabled: boolean;
  /** Compress when turn count exceeds this threshold */
  turnThreshold: number;
  /** Compress when estimated tokens exceed this threshold */
  tokenThreshold: number;
  /** Number of recent messages to preserve (not compressed) */
  preserveRecent: number;
  /** Maximum tokens for the summary */
  summaryMaxTokens: number;
  /** Model to use for summarization (optional, uses current model if not specified) */
  summaryModel?: string;
}

/**
 * Result of compression operation
 */
export interface CompressionResult {
  /** Compressed messages (summary + preserved recent) */
  messages: Message[];
  /** The generated summary */
  summary: string;
  /** Number of messages compressed */
  messagesCompressed: number;
  /** Estimated tokens saved */
  tokensSaved: number;
}

/**
 * Default compression configuration
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  enabled: true,
  turnThreshold: 20,
  tokenThreshold: 50000,
  preserveRecent: 6,
  summaryMaxTokens: 1000,
};

/**
 * System prompt for generating conversation summaries
 */
const SUMMARIZATION_PROMPT = `You are a conversation summarizer. Your task is to create a concise but comprehensive summary of a conversation between a user and an AI assistant.

The summary should:
1. Capture the main topics discussed
2. Preserve key decisions, outcomes, and conclusions
3. Include any important file paths, code changes, or technical details mentioned
4. Maintain context needed for continuing the conversation
5. Be written in past tense, third person

Format the summary as a clear narrative, not bullet points. Keep it under ${DEFAULT_COMPRESSION_CONFIG.summaryMaxTokens} tokens.`;

/**
 * Chat compressor for reducing conversation history size
 */
export class ChatCompressor {
  private config: CompressionConfig;
  private llmClient?: LLMClient;
  private model?: string;

  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
  }

  /**
   * Set the LLM client for summarization
   */
  setLLMClient(client: LLMClient, model: string): void {
    this.llmClient = client;
    this.model = model;
  }

  /**
   * Check if compression should be triggered
   */
  shouldCompress(messages: Message[], turnCount: number): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // Check turn threshold
    if (turnCount >= this.config.turnThreshold) {
      return true;
    }

    // Check token threshold (estimate)
    const estimatedTokens = this.estimateTokens(messages);
    if (estimatedTokens >= this.config.tokenThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Compress conversation history
   */
  async compress(messages: Message[]): Promise<CompressionResult> {
    if (!this.llmClient || !this.model) {
      throw new Error("LLM client not configured for compression");
    }

    if (messages.length <= this.config.preserveRecent) {
      // Nothing to compress
      return {
        messages: [...messages],
        summary: "",
        messagesCompressed: 0,
        tokensSaved: 0,
      };
    }

    // Split messages into old (to summarize) and recent (to preserve)
    const oldMessages = messages.slice(0, -this.config.preserveRecent);
    const recentMessages = messages.slice(-this.config.preserveRecent);

    // Estimate tokens before compression
    const tokensBefore = this.estimateTokens(oldMessages);

    // Generate summary
    const summary = await this.generateSummary(oldMessages);

    // Estimate tokens after compression
    const tokensAfter = this.estimateTokens([
      { role: "system", content: summary },
    ]);

    // Create summary message
    const summaryMessage: Message = {
      role: "system",
      content: `[Conversation Summary]\n\n${summary}`,
    };

    return {
      messages: [summaryMessage, ...recentMessages],
      summary,
      messagesCompressed: oldMessages.length,
      tokensSaved: Math.max(0, tokensBefore - tokensAfter),
    };
  }

  /**
   * Generate a summary of messages using LLM
   */
  private async generateSummary(messages: Message[]): Promise<string> {
    if (!this.llmClient || !this.model) {
      throw new Error("LLM client not configured for compression");
    }

    // Format messages for summarization
    const conversationText = this.formatMessagesForSummary(messages);

    const response = await this.llmClient.chat({
      model: this.config.summaryModel ?? this.model,
      systemPrompt: SUMMARIZATION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Please summarize the following conversation:\n\n${conversationText}`,
        },
      ],
      maxTokens: this.config.summaryMaxTokens,
    });

    return response.content ?? "";
  }

  /**
   * Format messages into readable text for summarization
   */
  private formatMessagesForSummary(messages: Message[]): string {
    return messages
      .map((msg) => {
        const role =
          msg.role === "user"
            ? "User"
            : msg.role === "assistant"
              ? "Assistant"
              : "System";
        let content = msg.content || "";

        // Include tool calls if present
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const toolInfo = msg.toolCalls
            .map((tc) => `[Called ${tc.name}]`)
            .join(", ");
          content = `${content}\n${toolInfo}`;
        }

        // Include tool results if present
        if (msg.toolResults && msg.toolResults.length > 0) {
          const resultInfo = msg.toolResults
            .map(
              (tr) =>
                `[Tool result: ${tr.content.slice(0, 100)}${tr.content.length > 100 ? "..." : ""}]`,
            )
            .join("\n");
          content = `${content}\n${resultInfo}`;
        }

        return `${role}: ${content}`;
      })
      .join("\n\n");
  }

  /**
   * Estimate token count for messages (rough approximation)
   */
  private estimateTokens(messages: Message[]): number {
    // Rough estimate: ~4 characters per token on average
    const CHARS_PER_TOKEN = 4;

    let totalChars = 0;

    for (const msg of messages) {
      totalChars += (msg.content || "").length;

      // Add overhead for tool calls
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          totalChars += tc.name.length;
          totalChars += JSON.stringify(tc.arguments).length;
        }
      }

      // Add overhead for tool results
      if (msg.toolResults) {
        for (const tr of msg.toolResults) {
          totalChars += tr.content.length;
        }
      }
    }

    return Math.ceil(totalChars / CHARS_PER_TOKEN);
  }

  /**
   * Get current configuration
   */
  getConfig(): CompressionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a chat compressor with the given configuration
 */
export function createCompressor(
  config?: Partial<CompressionConfig>,
): ChatCompressor {
  return new ChatCompressor(config);
}
