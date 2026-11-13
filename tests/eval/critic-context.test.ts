import { describe, expect, it, vi } from "vitest";
import type { Config } from "@beans/core";
import type { ChatRequest } from "@beans/core/llm";
import { AgenticEvalRunner } from "../../packages/eval/src/runner/agentic-runner.js";
import { MBPPBenchmark } from "../../packages/eval/src/benchmarks/mbpp/index.js";

vi.mock("../../packages/eval/src/runner/checkpoint.js", () => ({
  generateRunId: () => "test",
  createCheckpoint: async (_id: string, config: unknown) => ({
    config,
    results: [],
    completedIds: [],
  }),
  loadCheckpoint: async () => null,
  validateResumeConfig: () => undefined,
  getCompletedIds: () => new Set(),
  updateCheckpoint: async (
    checkpoint: { results: unknown[] },
    result: unknown,
  ) => {
    checkpoint.results.push(result);
  },
}));

const problem = {
  id: "test",
  taskId: 1,
  text: "Return the input plus one.",
  referenceCode: "",
  tests: ["assert increment(1) == 2"],
};

describe("evaluation context boundaries", () => {
  it.each([false, true])(
    "isolates requests with blind retry = %s",
    async (blind) => {
      const requests: ChatRequest[] = [];
      const outputs = blind
        ? [
            "def increment(n):\n    return missing",
            "def increment(n):\n    return n + 1",
          ]
        : [
            "def increment(n):\n    return missing",
            "WRONG: missing is undefined\nKEY: Return n plus one\nHINT: Replace missing with n + 1",
            "def increment(n):\n    return n + 1",
          ];
      const client = {
        async *chatStream(request: ChatRequest) {
          requests.push(structuredClone(request));
          yield { content: outputs.shift(), done: false };
          yield {
            done: true,
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          };
        },
      };
      const config = {
        getLLMClient: () => client,
        getToolRegistry: () => ({}),
        getLLMConfig: () => ({
          model: "mock",
          temperature: 0.7,
          maxTokens: 100,
        }),
      } as unknown as Config;
      const load = vi
        .spyOn(MBPPBenchmark.prototype, "load")
        .mockResolvedValue([problem]);
      try {
        const result = await new AgenticEvalRunner(config).run({
          benchmark: "mbpp",
          model: "mock",
          limit: 1,
          maxIterations: 2,
          retryWithoutCritic: blind,
        });
        expect(result.report.summary.passed).toBe(1);
        expect(requests).toHaveLength(blind ? 2 : 3);
        expect(
          requests.every(
            (request) =>
              request.messages.length === 1 && !request.tools?.length,
          ),
        ).toBe(true);
        if (blind) {
          expect(requests[1]).toEqual(requests[0]);
        } else {
          expect(requests[1].messages[0].content).toContain("NameError");
          expect(requests[1].systemPrompt).not.toBe(requests[0].systemPrompt);
          expect(requests[2].systemPrompt).toBe(requests[0].systemPrompt);
          expect(requests[2].messages[0].content).toContain(
            "Replace missing with n + 1",
          );
        }
      } finally {
        load.mockRestore();
      }
    },
  );
});
