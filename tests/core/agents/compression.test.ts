import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ChatCompressor,
  createCompressor,
  DEFAULT_COMPRESSION_CONFIG,
} from "../../../packages/core/src/agents/compression.js";
import type { Message } from "../../../packages/core/src/agents/types.js";
import type {
  LLMClient,
  ChatResponse,
} from "../../../packages/core/src/llm/types.js";

function createMockMessages(count: number): Message[] {
  const messages: Message[] = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}: ${"Lorem ipsum ".repeat(50)}`,
    });
  }
  return messages;
}

function createMockLLMClient(
  summaryResponse: string = "This is a summary.",
): LLMClient {
  return {
    async chat(): Promise<ChatResponse> {
      return {
        content: summaryResponse,
        model: "test-model",
        finishReason: "stop",
      };
    },
  };
}

describe("ChatCompressor", () => {
  let compressor: ChatCompressor;

  beforeEach(() => {
    compressor = new ChatCompressor();
  });

  describe("constructor", () => {
    it("should use default config when not provided", () => {
      const c = new ChatCompressor();
      expect(c.getConfig()).toEqual(DEFAULT_COMPRESSION_CONFIG);
    });

    it("should merge custom config with defaults", () => {
      const c = new ChatCompressor({ turnThreshold: 10 });
      const config = c.getConfig();
      expect(config.turnThreshold).toBe(10);
      expect(config.tokenThreshold).toBe(
        DEFAULT_COMPRESSION_CONFIG.tokenThreshold,
      );
    });
  });

  describe("shouldCompress", () => {
    it("should return false when disabled", () => {
      const c = new ChatCompressor({ enabled: false });
      const messages = createMockMessages(30);
      expect(c.shouldCompress(messages, 25)).toBe(false);
    });

    it("should return true when turn threshold is exceeded", () => {
      const c = new ChatCompressor({ turnThreshold: 10 });
      const messages = createMockMessages(5);
      expect(c.shouldCompress(messages, 10)).toBe(true);
    });

    it("should return false when below thresholds", () => {
      const c = new ChatCompressor({
        turnThreshold: 20,
        tokenThreshold: 100000,
      });
      const messages = createMockMessages(5);
      expect(c.shouldCompress(messages, 5)).toBe(false);
    });

    it("should return true when token threshold is exceeded", () => {
      // Create messages with lots of content
      const c = new ChatCompressor({ tokenThreshold: 100 });
      const messages = createMockMessages(10);
      expect(c.shouldCompress(messages, 1)).toBe(true);
    });
  });

  describe("compress", () => {
    it("should throw error when LLM client not configured", async () => {
      const messages = createMockMessages(10);
      await expect(compressor.compress(messages)).rejects.toThrow(
        "LLM client not configured",
      );
    });

    it("should return unchanged messages when nothing to compress", async () => {
      const mockClient = createMockLLMClient();
      compressor.setLLMClient(mockClient, "test-model");

      const messages = createMockMessages(3); // Less than preserveRecent
      const result = await compressor.compress(messages);

      expect(result.messagesCompressed).toBe(0);
      expect(result.messages).toHaveLength(3);
      expect(result.summary).toBe("");
    });

    it("should compress old messages and preserve recent ones", async () => {
      const mockClient = createMockLLMClient("Summary of old conversation.");
      compressor.setLLMClient(mockClient, "test-model");

      const c = new ChatCompressor({ preserveRecent: 4 });
      c.setLLMClient(mockClient, "test-model");

      const messages = createMockMessages(10);
      const result = await c.compress(messages);

      // Should have summary message + 4 recent messages
      expect(result.messages).toHaveLength(5);
      expect(result.messages[0].role).toBe("system");
      expect(result.messages[0].content).toContain("[Conversation Summary]");
      expect(result.messagesCompressed).toBe(6);
    });

    it("should generate summary from old messages", async () => {
      const mockClient = createMockLLMClient(
        "The user asked about TypeScript.",
      );
      compressor.setLLMClient(mockClient, "test-model");

      const c = new ChatCompressor({ preserveRecent: 2 });
      c.setLLMClient(mockClient, "test-model");

      const messages = createMockMessages(6);
      const result = await c.compress(messages);

      expect(result.summary).toBe("The user asked about TypeScript.");
      expect(result.messages[0].content).toContain(
        "The user asked about TypeScript.",
      );
    });

    it("should estimate tokens saved", async () => {
      const mockClient = createMockLLMClient("Short summary.");
      const c = new ChatCompressor({ preserveRecent: 2 });
      c.setLLMClient(mockClient, "test-model");

      const messages = createMockMessages(10); // Lots of content
      const result = await c.compress(messages);

      expect(result.tokensSaved).toBeGreaterThan(0);
    });
  });

  describe("setLLMClient", () => {
    it("should configure LLM client for summarization", () => {
      const mockClient = createMockLLMClient();
      compressor.setLLMClient(mockClient, "test-model");

      // Should not throw now
      expect(() => compressor.getConfig()).not.toThrow();
    });
  });

  describe("updateConfig", () => {
    it("should update configuration", () => {
      compressor.updateConfig({ turnThreshold: 50 });
      expect(compressor.getConfig().turnThreshold).toBe(50);
    });

    it("should preserve other config values", () => {
      compressor.updateConfig({ turnThreshold: 50 });
      expect(compressor.getConfig().tokenThreshold).toBe(
        DEFAULT_COMPRESSION_CONFIG.tokenThreshold,
      );
    });
  });

  describe("message formatting", () => {
    it("should include tool calls in summary input", async () => {
      const chatSpy = vi.fn().mockResolvedValue({
        content: "Summary",
        model: "test-model",
        finishReason: "stop",
      });

      const mockClient: LLMClient = {
        chat: chatSpy,
      };

      const c = new ChatCompressor({ preserveRecent: 2 });
      c.setLLMClient(mockClient, "test-model");

      const messages: Message[] = [
        { role: "user", content: "Read the file" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            { id: "1", name: "read_file", arguments: { path: "/test.txt" } },
          ],
        },
        {
          role: "tool",
          content: "File contents",
          toolResults: [{ toolCallId: "1", content: "File contents" }],
        },
        { role: "assistant", content: "Here is the file content" },
        { role: "user", content: "Thanks" },
        { role: "assistant", content: "You are welcome" },
      ];

      await c.compress(messages);

      const callArg = chatSpy.mock.calls[0][0];
      expect(callArg.messages[0].content).toContain("[Called read_file]");
    });
  });
});

describe("createCompressor", () => {
  it("should create a compressor with default config", () => {
    const compressor = createCompressor();
    expect(compressor).toBeInstanceOf(ChatCompressor);
  });

  it("should create a compressor with custom config", () => {
    const compressor = createCompressor({ turnThreshold: 15 });
    expect(compressor.getConfig().turnThreshold).toBe(15);
  });
});

describe("DEFAULT_COMPRESSION_CONFIG", () => {
  it("should have expected default values", () => {
    expect(DEFAULT_COMPRESSION_CONFIG.enabled).toBe(true);
    expect(DEFAULT_COMPRESSION_CONFIG.turnThreshold).toBe(20);
    expect(DEFAULT_COMPRESSION_CONFIG.tokenThreshold).toBe(50000);
    expect(DEFAULT_COMPRESSION_CONFIG.preserveRecent).toBe(6);
    expect(DEFAULT_COMPRESSION_CONFIG.summaryMaxTokens).toBe(1000);
  });
});
