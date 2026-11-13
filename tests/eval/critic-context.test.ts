import { describe, expect, it, vi } from "vitest";
import type { Config } from "@beans/core";
import type { ChatRequest } from "@beans/core/llm";
import { AgenticEvalRunner } from "../../packages/eval/src/runner/agentic-runner.js";
import { MBPPBenchmark } from "../../packages/eval/src/benchmarks/mbpp/index.js";
import { EvalRunner } from "../../packages/eval/src/runner/eval-runner.js";
import { createCodeGenSession } from "../../packages/eval/src/runner/code-gen-session.js";

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
  it("stops on provider failure instead of scoring it as an incorrect answer", async () => {
    const config = {
      getLLMClient: () => ({
        async *chatStream() {
          yield* [];
          throw new Error("monthly spending cap exceeded");
        },
      }),
      getToolRegistry: () => ({}),
      getLLMConfig: () => ({ model: "mock", maxTokens: 100 }),
    } as unknown as Config;
    const load = vi
      .spyOn(MBPPBenchmark.prototype, "load")
      .mockResolvedValue([problem]);
    try {
      await expect(
        new EvalRunner(createCodeGenSession(config)).run({
          benchmark: "mbpp",
          model: "mock",
        }),
      ).rejects.toThrow("spending cap");
    } finally {
      load.mockRestore();
    }
  });
  it.each([
    [false, undefined],
    [true, undefined],
    [false, "sequential"],
    [false, "predictive"],
  ] as const)(
    "isolates requests with blind retry = %s and preparation = %s",
    async (blind, mode) => {
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
          reviewPreparation: mode,
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
          if (mode) {
            expect(requests[1].messages[0].content).toContain(
              "RELATED HISTORICAL CASES",
            );
            expect(result.report.results[0].metrics.preparation?.length).toBe(
              2,
            );
          }
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
