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

function createTestConfig(llmClient: LLMClient) {
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
    }),
    getDebugConfig: () => ({
      enabled: false,
      logRequests: false,
      logResponses: false,
    }),
    getPolicyEngine: () => new PolicyEngine(DEFAULT_POLICY_CONFIG),
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
});
