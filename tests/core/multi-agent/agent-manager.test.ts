import { describe, it, expect } from "vitest";
import { createAgentManager } from "../../../packages/core/src/agents/multi-agent/agent-manager.js";
import type { Config } from "../../../packages/core/src/config/config.js";
import { ToolRegistry } from "../../../packages/core/src/tools/registry.js";
import {
  PolicyEngine,
  DEFAULT_POLICY_CONFIG,
} from "../../../packages/core/src/policy/index.js";
import type {
  ChatRequest,
  ChatResponse,
  LLMClient,
} from "../../../packages/core/src/llm/types.js";

class CapturingLLMClient implements LLMClient {
  requests: ChatRequest[] = [];

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.requests.push(request);
    return {
      content: "captured response",
      model: request.model,
      finishReason: "stop",
    };
  }
}

class SequencedLLMClient implements LLMClient {
  requests: ChatRequest[] = [];

  constructor(private readonly responses: ChatResponse[]) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) {
      throw new Error("No queued response available");
    }
    return response;
  }
}

function createTestConfig(
  llmClient: LLMClient,
  overrides?: {
    memoryContent?: string;
    compression?: {
      enabled: boolean;
      turnThreshold: number;
      tokenThreshold: number;
      preserveRecent: number;
      summaryMaxTokens: number;
    };
  },
) {
  const memoryContent = overrides?.memoryContent ?? "";
  return {
    getLLMClient: () => llmClient,
    getToolRegistry: () => new ToolRegistry(),
    getLLMConfig: () => ({
      provider: "google" as const,
      model: "gemini-2.0-flash",
      temperature: 0.25,
      maxTokens: 2048,
    }),
    getAgentConfig: () => ({
      maxTurns: 12,
      timeoutMs: 45000,
      streaming: true,
      autoApprove: "none" as const,
      compression: overrides?.compression,
    }),
    getDebugConfig: () => ({
      enabled: false,
      logRequests: false,
      logResponses: false,
    }),
    getPolicyEngine: () => new PolicyEngine(DEFAULT_POLICY_CONFIG),
    getMemoryStore: () =>
      ({
        getContent: async () => memoryContent,
        discover: async () => ({
          files: [],
          content: memoryContent,
          totalTokens: memoryContent.length,
          loadedPaths: [],
        }),
      }) as ReturnType<Config["getMemoryStore"]>,
  };
}

describe("createAgentManager", () => {
  it("passes the shared base system prompt to spawned agents", async () => {
    const llmClient = new CapturingLLMClient();
    const config = createTestConfig(llmClient);
    const manager = createAgentManager(config as unknown as Config, {
      baseSystemPrompt: "BASE PROMPT\n\nWorkspace and memory live here.",
      cwd: "/tmp/test-project",
    });

    await manager.spawn("general", "Explain this project");

    expect(llmClient.requests).toHaveLength(1);
    expect(llmClient.requests[0].systemPrompt).toContain("BASE PROMPT");
    expect(llmClient.requests[0].systemPrompt).toContain(
      "Workspace and memory live here.",
    );
    expect(llmClient.requests[0].systemPrompt).toContain(
      "## Multi-Agent Runtime Context",
    );
    expect(llmClient.requests[0].systemPrompt).toContain(
      "You are a helpful AI assistant.",
    );
  });

  it("uses configured model generation settings for spawned agents", async () => {
    const llmClient = new CapturingLLMClient();
    const config = createTestConfig(llmClient);
    const manager = createAgentManager(config as unknown as Config, {
      cwd: "/tmp/test-project",
    });

    await manager.spawn("explore", "Find the entrypoint");

    expect(llmClient.requests).toHaveLength(1);
    expect(llmClient.requests[0].model).toBe("gemini-2.0-flash");
    expect(llmClient.requests[0].temperature).toBe(0.25);
    expect(llmClient.requests[0].maxTokens).toBe(2048);
  });

  it("loads memory store content into spawned agent prompts", async () => {
    const llmClient = new CapturingLLMClient();
    const config = createTestConfig(llmClient, {
      memoryContent: "Project memory: prefer targeted file reads.",
    });
    const manager = createAgentManager(config as unknown as Config, {
      cwd: "/tmp/test-project",
    });

    await manager.spawn("general", "Inspect the project");

    expect(llmClient.requests).toHaveLength(1);
    expect(llmClient.requests[0].systemPrompt).toContain(
      "Project memory: prefer targeted file reads.",
    );
  });

  it("routes processInput using analyzer output instead of regex heuristics", async () => {
    const llmClient = new SequencedLLMClient([
      {
        content: JSON.stringify({
          intent: "planning",
          requiresPlanning: false,
          suggestedAgent: "plan",
          suggestedTools: ["read_file"],
          extractedIntent: {
            action: "understand",
            targetPath: null,
            keywords: ["architecture"],
          },
          tasks: [],
        }),
        model: "gemini-2.0-flash",
        finishReason: "stop",
      },
      {
        content: "planned response",
        model: "gemini-2.0-flash",
        finishReason: "stop",
      },
    ]);
    const config = createTestConfig(llmClient);
    const manager = createAgentManager(config as unknown as Config, {
      cwd: "/tmp/test-project",
    });

    const result = await manager.processInput("show me the code", {
      conversationHistory: [{ role: "user", content: "prior context" }],
    });

    expect(result.agentType).toBe("plan");
    expect(llmClient.requests).toHaveLength(2);
    expect(llmClient.requests[1].systemPrompt).toContain(
      "software architect specializing in implementation planning",
    );
  });

  it("compresses long interactive history before spawning the main agent", async () => {
    const llmClient = new SequencedLLMClient([
      {
        content: JSON.stringify({
          intent: "code_exploration",
          requiresPlanning: false,
          suggestedAgent: "explore",
          suggestedTools: ["glob", "grep"],
          extractedIntent: {
            action: "find",
            targetPath: null,
            keywords: ["auth"],
          },
          tasks: [],
        }),
        model: "gemini-2.0-flash",
        finishReason: "stop",
      },
      {
        content: "Summary of prior conversation",
        model: "gemini-2.0-flash",
        finishReason: "stop",
      },
      {
        content: "exploration result",
        model: "gemini-2.0-flash",
        finishReason: "stop",
      },
    ]);
    const config = createTestConfig(llmClient, {
      compression: {
        enabled: true,
        turnThreshold: 1,
        tokenThreshold: 1,
        preserveRecent: 2,
        summaryMaxTokens: 200,
      },
    });
    const manager = createAgentManager(config as unknown as Config, {
      cwd: "/tmp/test-project",
    });

    await manager.processInput("find auth flow", {
      conversationHistory: [
        { role: "user", content: "message one" },
        { role: "assistant", content: "reply one" },
        { role: "user", content: "message two" },
        { role: "assistant", content: "reply two" },
        { role: "user", content: "message three" },
        { role: "assistant", content: "reply three" },
      ],
    });

    expect(llmClient.requests).toHaveLength(3);
    expect(
      llmClient.requests[2].messages.some(
        (message) =>
          message.role === "system" &&
          message.content.includes("[Conversation Summary]") &&
          message.content.includes("Summary of prior conversation"),
      ),
    ).toBe(true);
  });
});
