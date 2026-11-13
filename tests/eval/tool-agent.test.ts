import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ChatRequest,
  ChatResponse,
  Config,
  PasteEvent,
} from "@beans/core";
import {
  solveToolAgentProblem,
  validateToolTraining,
  readToolTraining,
} from "../../packages/eval/src/runner/tool-agent-runner.js";
import { executePython } from "../../packages/eval/src/execution/python-runner.js";
import { validateResumeConfig } from "../../packages/eval/src/runner/checkpoint.js";

afterEach(() => vi.restoreAllMocks());
const problem = {
  id: "test-only",
  taskId: 1,
  text: "Return n plus one",
  referenceCode: "REFERENCE_MUST_NOT_APPEAR",
  tests: ["assert increment(1) == 2", "assert increment(5) == 6"],
};
function trainingTrace(id: string): PasteEvent[] {
  return [
    {
      name: "submit_solution",
      arguments: { code: `def f(): return '${id}'` },
      status: "success",
      output: { candidateId: id.repeat(64) },
    },
    {
      name: "run_tests",
      arguments: { candidateId: id.repeat(64) },
      status: "success",
      output: { success: true },
    },
  ];
}
const training = {
  version: 1 as const,
  model: "mock",
  problems: [
    { problemId: "train-a", traces: [trainingTrace("a")] },
    { problemId: "train-b", traces: [trainingTrace("b")] },
  ],
};

describe("MBPP tool-agent evaluation", () => {
  it.runIf(process.platform === "darwin").each([false, true])(
    "runs the same authoritative workflow with paste = %s",
    async (paste) => {
      const requests: ChatRequest[] = [];
      const client = {
        chat: vi.fn(async (request: ChatRequest): Promise<ChatResponse> => {
          requests.push(structuredClone(request));
          const base = {
            model: "mock",
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            finishReason: "stop" as const,
          };
          if (requests.length === 1)
            return {
              ...base,
              content: "",
              toolCalls: [
                {
                  id: "submit",
                  name: "submit_solution",
                  arguments: { code: "def increment(n):\n    return n + 1" },
                },
              ],
            };
          if (requests.length === 2) {
            const output =
              request.messages.at(-1)?.toolResults?.[0].content ?? "";
            return {
              ...base,
              content: "",
              toolCalls: [
                {
                  id: "test",
                  name: "run_tests",
                  arguments: { candidateId: JSON.parse(output).candidateId },
                },
              ],
            };
          }
          return { ...base, content: "All tests pass." };
        }),
      };
      const config = {
        getLLMClient: () => client,
        getLLMConfig: () => ({
          model: "mock",
          temperature: 0.7,
          maxTokens: 4096,
        }),
      } as unknown as Config;
      const result = await solveToolAgentProblem(config, problem, {
        paste,
        training,
      });
      expect(result.success).toBe(true);
      expect(result.metrics.totalTokens).toBe(45);
      expect(result.metrics.toolAgent?.llmCalls).toBe(3);
      expect(result.metrics.toolAgent?.testExecutions).toBe(1);
      expect(JSON.stringify(requests)).not.toContain(problem.referenceCode);
      expect(result.toolTraces?.[0].map((event) => event.name)).toEqual([
        "submit_solution",
        "run_tests",
      ]);
      if (paste)
        expect(
          (result.metrics.toolAgent?.paste?.reused ?? 0) +
            (result.metrics.toolAgent?.paste?.promoted ?? 0),
        ).toBe(1);
    },
  );

  it("rejects training/evaluation overlap and changed resume conditions", () => {
    expect(() => validateToolTraining(training, ["train-a"])).toThrow(
      "overlap",
    );
    expect(() =>
      validateResumeConfig(
        { benchmark: "mbpp", model: "mock", toolAgent: true },
        { benchmark: "mbpp", model: "mock", toolAgent: true, paste: true },
      ),
    ).toThrow("differs");
  });

  it("validates training files instead of silently falling back to an empty pool", async () => {
    const dir = await mkdtemp(join(tmpdir(), "beans-training-"));
    try {
      const file = join(dir, "training.json");
      await writeFile(file, JSON.stringify(training));
      expect(await readToolTraining(file)).toEqual(training);
      await writeFile(file, JSON.stringify({ version: 99, problems: [] }));
      await expect(readToolTraining(file)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("stops on missing provider usage rather than reporting zero tokens", async () => {
    const config = {
      getLLMClient: () => ({
        chat: async () => ({
          content: "done",
          model: "mock",
          finishReason: "stop",
        }),
      }),
      getLLMConfig: () => ({ model: "mock" }),
    } as unknown as Config;
    await expect(
      solveToolAgentProblem(config, problem, { paste: false, training }),
    ).rejects.toThrow("token usage");
  });

  it.runIf(process.platform === "darwin")(
    "blocks filesystem writes, network, and home reads in speculative Python",
    async () => {
      const attempts = [
        "open('/tmp/beans-paste-write-must-not-exist', 'w').write('bad')",
        "import socket; socket.socket().connect(('127.0.0.1', 9))",
        `open(${JSON.stringify(join(process.env.HOME ?? "/Users/bean", ".zshrc"))}).read()`,
      ];
      for (const code of attempts) {
        const result = await executePython(code, { isolated: true });
        expect(result.success).toBe(false);
        expect(result.stderr).toContain("PermissionError");
      }
    },
  );

  it("honors cancellation before spawning a speculative process", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      executePython("print('not run')", {
        signal: controller.signal,
        isolated: true,
      }),
    ).rejects.toThrow();
  });
});
