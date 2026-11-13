import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { AgentExecutor, ToolRegistry } from "@beans/core";
import type {
  Config,
  LLMClient,
  Message,
  PasteEvent,
  PasteOptions,
  Tool,
} from "@beans/core";
import { z } from "zod";
import { loadMBPP } from "../benchmarks/mbpp/loader.js";
import type { MBPPProblem } from "../benchmarks/mbpp/types.js";
import type { BenchmarkReport, EvaluationResult } from "../benchmarks/types.js";
import type {
  EvalRunnerConfig,
  EvalProgressCallback,
  EvalRunResult,
} from "./types.js";
import { executePython, executeWithTests } from "../execution/python-runner.js";
import { cleanCode } from "../extraction/code-extractor.js";
import {
  createCheckpoint,
  generateRunId,
  loadCheckpoint,
  updateCheckpoint,
  validateResumeConfig,
} from "./checkpoint.js";

export const TOOL_AGENT_SYSTEM_PROMPT = `Solve the Python programming task using the available tools.
Submit a complete Python solution using submit_solution. Then call run_tests with the exact candidateId returned by submit_solution.
If tests fail, inspect the feedback and submit a corrected solution, up to the submission limit stated in the task.
Issue one tool call at a time. You must test the latest submitted candidate before finishing.
After testing, finish with a short summary. The evaluator scores your latest submitted Python code, not your final summary.
Do not attempt file access, networking, subprocesses, or modifications to the test harness. No reference solution is available.`;

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export interface ToolTraining {
  version: 1;
  model: string;
  problems: Array<{ problemId: string; traces: PasteEvent[][] }>;
}

export async function readToolTraining(path?: string): Promise<ToolTraining> {
  if (!path) return { version: 1, model: "", problems: [] };
  const event = z.object({
    name: z.string(),
    arguments: z.record(z.unknown()),
    status: z.enum(["success", "error"]),
    output: z.unknown(),
  });
  const value = z
    .object({
      version: z.literal(1),
      model: z.string(),
      problems: z.array(
        z.object({ problemId: z.string(), traces: z.array(z.array(event)) }),
      ),
    })
    .parse(JSON.parse(await readFile(path, "utf8")));
  // The runtime performs recursive JSON validation before constructing the analyzer.
  return value as ToolTraining;
}

export function validateToolTraining(
  training: ToolTraining,
  ids: string[],
): void {
  const evaluated = new Set(ids);
  if (training.problems.some((problem) => evaluated.has(problem.problemId)))
    throw new Error("PASTE training problems overlap the MBPP evaluation set");
}

export async function checkToolSandbox(): Promise<void> {
  const result = await executePython("print('beans-isolation-ready')", {
    isolated: true,
    timeout: 5000,
  });
  if (!result.success || result.stdout !== "beans-isolation-ready")
    throw new Error(
      `MBPP tool sandbox unavailable: ${result.stderr || result.error || result.exitCode}`,
    );
}

/** Parallel tool batches break sequence contexts instead of inventing an ordering. */
export function collectToolTraces(messages: Message[]): PasteEvent[][] {
  const traces: PasteEvent[][] = [];
  let trace: PasteEvent[] = [];
  for (let i = 0; i < messages.length; i++) {
    const calls = messages[i].toolCalls;
    if (!calls?.length) continue;
    const results = messages[i + 1]?.toolResults;
    if (calls.length !== 1 || results?.length !== 1) {
      if (trace.length) traces.push(trace);
      trace = [];
      continue;
    }
    const result = results[0];
    let output: PasteEvent["output"] = {
      content: result.content,
      lines: result.content.split("\n").slice(0, 32),
    };
    try {
      output = JSON.parse(result.content);
    } catch {
      /* Match the live runtime's text representation. */
    }
    trace.push({
      name: calls[0].name,
      arguments: calls[0].arguments as PasteEvent["arguments"],
      status: result.error ? "error" : "success",
      output,
    });
  }
  if (trace.length) traces.push(trace);
  return traces;
}

export async function solveToolAgentProblem(
  config: Config,
  problem: MBPPProblem,
  options: {
    paste: boolean;
    training: ToolTraining;
    maxIterations?: number;
    timeout?: number;
  },
): Promise<EvaluationResult> {
  validateToolTraining(options.training, [problem.id]);
  const started = performance.now();
  const maxIterations = options.maxIterations ?? 3;
  const timeout = options.timeout ?? 30000;
  if (
    !Number.isInteger(maxIterations) ||
    maxIterations < 1 ||
    maxIterations > 10
  )
    throw new Error("Tool-agent iterations must be between 1 and 10");
  const candidates = new Map<string, string>();
  let latest = "";
  let submitted = 0;
  let llmMs = 0;
  let llmCalls = 0;
  let testExecutionMs = 0;
  let testExecutions = 0;
  const pendingTests = new Set<
    Promise<Awaited<ReturnType<typeof executeWithTests>>>
  >();
  let testWaitMs = 0;
  let toolWaitMs = 0;
  const activeCalls = new Map<string, number>();
  const registry = new ToolRegistry();
  const submitSchema = z.object({ code: z.string().min(1).max(100000) });
  const testSchema = z.object({
    candidateId: z.string().regex(/^[a-f0-9]{64}$/),
  });
  const submit: Tool = {
    definition: {
      name: "submit_solution",
      description:
        "Stage a Python candidate and return its candidateId for run_tests.",
      parameters: {
        type: "object",
        properties: { code: { type: "string" } },
        required: ["code"],
      },
    },
    validate: (args) => ({ valid: submitSchema.safeParse(args).success }),
    async execute(args) {
      const { code } = submitSchema.parse(args);
      if (submitted >= maxIterations)
        return {
          content:
            "Submission limit reached. Test the latest candidate and finish.",
          isError: true,
        };
      latest = cleanCode(code);
      const candidateId = hash(latest);
      candidates.set(candidateId, latest);
      submitted++;
      return { content: JSON.stringify({ candidateId }) };
    },
  };
  const tester: Tool = {
    definition: {
      name: "run_tests",
      description:
        "Run all MBPP assertions on a submitted candidate in an isolated read-only Python process. Use the candidateId returned by submit_solution.",
      parameters: {
        type: "object",
        properties: { candidateId: { type: "string" } },
        required: ["candidateId"],
      },
    },
    validate: (args) => ({
      valid:
        testSchema.safeParse(args).success &&
        typeof args.candidateId === "string" &&
        candidates.has(args.candidateId),
    }),
    async execute(args, execution) {
      const { candidateId } = testSchema.parse(args);
      const code = candidates.get(candidateId);
      if (!code)
        return {
          content: "Unknown candidateId. Submit a solution first.",
          isError: true,
        };
      const testStart = performance.now();
      testExecutions++;
      const pending = executeWithTests(code, problem.tests, problem.setupCode, {
        timeout,
        isolated: true,
        signal: execution?.signal,
      });
      pendingTests.add(pending);
      try {
        const result = await pending;
        execution?.signal?.throwIfAborted();
        return { content: JSON.stringify({ candidateId, ...result }) };
      } finally {
        testExecutionMs += performance.now() - testStart;
        pendingTests.delete(pending);
      }
    },
  };
  registry.registerAll([submit, tester]);
  const client = config.getLLMClient();
  const instrumented: LLMClient = {
    async chat(request) {
      const start = performance.now();
      llmCalls++;
      try {
        const response = await client.chat(request);
        if (!response.usage || response.usage.totalTokens <= 0)
          throw new Error(
            "Provider returned no token usage; evaluation cannot report valid token totals",
          );
        return response;
      } finally {
        llmMs += performance.now() - start;
      }
    },
  };
  const paste: PasteOptions | undefined = options.paste
    ? {
        traces: options.training.problems.flatMap((entry) => entry.traces),
        allowedTools: ["run_tests"],
        maxSpeculations: 1,
        ttlMs: 60000,
      }
    : undefined;
  const executor = new AgentExecutor(instrumented, registry, { paste });
  const agent = await executor.execute(
    {
      name: "mbpp-tool-agent",
      description: "MBPP tool-calling evaluation",
      promptConfig: {
        systemPrompt: TOOL_AGENT_SYSTEM_PROMPT,
        query: `Problem: ${problem.text}\n\nExample:\n${problem.tests[0]}\n\nMaximum submitted candidates: ${maxIterations}.`,
      },
      modelConfig: config.getLLMConfig(),
      toolConfig: { allowAllTools: true },
      runConfig: {
        maxTurns: maxIterations * 2 + 2,
        timeoutMs: 300000,
        loopDetection: { enabled: false },
      },
    },
    {
      onActivity: (event) => {
        if (event.type === "tool_call_start")
          activeCalls.set(event.toolCall.id, performance.now());
        if (event.type === "tool_call_end") {
          const duration =
            performance.now() -
            (activeCalls.get(event.toolCallId) ?? performance.now());
          toolWaitMs += duration;
          if (event.toolName === "run_tests") testWaitMs += duration;
        }
      },
    },
  );
  const agentMs = performance.now() - started;
  const drainStarted = performance.now();
  await Promise.allSettled([...pendingTests]);
  const drainMs = performance.now() - drainStarted;
  if (!agent.success)
    throw new Error(
      `Problem ${problem.id}: ${agent.error ?? "agent request failed"}`,
    );
  const verificationStarted = performance.now();
  const verified = latest
    ? await executeWithTests(latest, problem.tests, problem.setupCode, {
        timeout,
        isolated: true,
      })
    : {
        success: false,
        passed: 0,
        total: problem.tests.length,
        error: "No solution submitted",
      };
  const traces = collectToolTraces(agent.messages);
  const lastId = hash(latest);
  const testedLatest = traces
    .flat()
    .some(
      (event) =>
        event.name === "run_tests" &&
        event.arguments.candidateId === lastId &&
        event.status === "success",
    );
  return {
    problemId: problem.id,
    generatedCode: latest,
    success: verified.success && testedLatest,
    passed: verified.passed,
    total: verified.total,
    error: testedLatest
      ? verified.error
      : "Agent did not test its latest submitted candidate",
    metrics: {
      promptTokens: agent.usage?.promptTokens ?? 0,
      completionTokens: agent.usage?.completionTokens ?? 0,
      totalTokens: agent.usage?.totalTokens ?? 0,
      turnCount: agent.turnCount,
      timeMs: performance.now() - started,
      toolAgent: {
        agentMs,
        llmMs,
        llmCalls,
        toolWaitMs,
        testWaitMs,
        testExecutionMs,
        testExecutions,
        submitted,
        verificationMs: performance.now() - verificationStarted,
        drainMs,
        completed: agent.terminateReason === "complete",
        testedLatest,
        paste: agent.paste,
      },
    },
    toolTraces: traces,
  };
}

export class ToolAgentEvalRunner {
  constructor(private readonly config: Config) {}
  async run(
    config: EvalRunnerConfig,
    onProgress?: EvalProgressCallback,
  ): Promise<EvalRunResult> {
    if (config.benchmark !== "mbpp")
      throw new Error("Tool-agent evaluation currently supports MBPP only");
    if (
      config.baselineReport ||
      config.retryWithoutCritic ||
      config.reviewPreparation
    )
      throw new Error(
        "Tool-agent evaluation cannot be combined with Critic replay or review preparation",
      );
    await checkToolSandbox();
    const problems = await loadMBPP({
      source: config.datasetSource,
      limit: config.limit,
      offset: config.offset,
      problemIds: config.problemIds,
      sanitized: config.sanitized,
    });
    const training = await readToolTraining(config.toolTraining);
    validateToolTraining(
      training,
      problems.map((problem) => problem.id),
    );
    const provenance = {
      datasetHash: hash(JSON.stringify(problems)),
      trainingHash: hash(JSON.stringify(training)),
      modelConfigHash: hash(JSON.stringify(this.config.getLLMConfig())),
    };
    const runId = config.runId ?? generateRunId();
    const previous = config.runId ? await loadCheckpoint(runId) : null;
    if (previous) {
      validateResumeConfig(previous.config, config);
      if (
        JSON.stringify(previous.toolAgentProvenance) !==
        JSON.stringify(provenance)
      )
        throw new Error(
          "Tool-agent dataset, training traces, or model settings changed since checkpoint",
        );
    }
    const checkpoint = previous ?? (await createCheckpoint(runId, config));
    checkpoint.toolAgentProvenance = provenance;
    for (const problem of problems) {
      if (checkpoint.completedIds.includes(problem.id)) continue;
      onProgress?.({
        current: checkpoint.results.length + 1,
        total: problems.length,
        problemId: problem.id,
      });
      const result = await solveToolAgentProblem(this.config, problem, {
        paste: config.paste ?? false,
        training,
        maxIterations: config.maxIterations,
        timeout: config.timeout,
      });
      await updateCheckpoint(checkpoint, result);
      onProgress?.({
        current: checkpoint.results.length,
        total: problems.length,
        problemId: problem.id,
        result,
      });
    }
    const results = checkpoint.results;
    const total = results.length;
    const passed = results.filter((result) => result.success).length;
    const totalTimeMs = results.reduce(
      (sum, result) => sum + result.metrics.timeMs,
      0,
    );
    const report: BenchmarkReport = {
      benchmarkName: "mbpp-tool-agent",
      timestamp: new Date().toISOString(),
      model: config.model,
      evaluationValidity: { valid: true },
      toolAgent: {
        mode: config.paste ? "paste" : "sequential",
        ...provenance,
        trainingProblemIds: training.problems.map((p) => p.problemId),
      },
      results,
      summary: {
        total,
        passed,
        passRate: total ? passed / total : 0,
        totalTimeMs,
        totalTokens: results.reduce(
          (sum, result) => sum + result.metrics.totalTokens,
          0,
        ),
        avgTimePerProblem: total ? totalTimeMs / total : 0,
      },
    };
    return { report, runId, resumed: !!previous };
  }
}
