/**
 * Agentic evaluation runner - uses multi-agent system (Coder + Critic)
 */

import type {
  Benchmark,
  BenchmarkProblem,
  BenchmarkReport,
  BenchmarkSummary,
  EvaluationResult,
  ProblemMetrics,
} from "../benchmarks/types.js";
import type {
  EvalRunnerConfig,
  EvalProgressCallback,
  EvalRunResult,
  Checkpoint,
} from "./types.js";
import {
  generateRunId,
  createCheckpoint,
  loadCheckpoint,
  updateCheckpoint,
  getCompletedIds,
  validateResumeConfig,
} from "./checkpoint.js";
import { MBPPBenchmark } from "../benchmarks/mbpp/index.js";
import type { MBPPProblem } from "../benchmarks/mbpp/types.js";
import { extractCode, cleanCode } from "../extraction/code-extractor.js";
import { executeWithTests } from "../execution/python-runner.js";
import { ChatSession, type Config } from "@beans/core";
import { createCodeGenSession } from "./code-gen-session.js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  CodeSimilarityIndex,
  formatReviewCases,
  DEFAULT_REVIEW_CASES,
  ReviewNeedPredictor,
  prepareNextReview,
} from "../speculation/index.js";
import type {
  SimilarCase,
  ReviewCase,
  PreparationMode,
} from "../speculation/index.js";

const MAX_ITERATIONS = 5;

/**
 * Problem with text and tests (MBPP-style)
 */
type AgenticProblem = MBPPProblem;

/**
 * Critic analysis of what went wrong
 */
interface CriticAnalysis {
  whatWentWrong: string;
  keyRequirement: string;
  hint: string;
}

/**
 * Failed test info with actual/expected values
 */
interface FailedTest {
  assertion: string;
  error?: string;
  actual?: string;
  expected?: string;
}

/**
 * Get benchmark instance by name
 */
function getBenchmark(
  name: string,
  config: EvalRunnerConfig,
): Benchmark<BenchmarkProblem> {
  switch (name.toLowerCase()) {
    case "mbpp":
      return new MBPPBenchmark({ timeout: config.timeout });
    default:
      throw new Error(`Unknown benchmark: ${name}`);
  }
}

/**
 * Build prompt for the Critic Agent
 */
function buildCriticPrompt(
  problem: AgenticProblem,
  code: string,
  failedTests: FailedTest[],
): string {
  const failures = failedTests
    .map((t) => {
      let msg = `Test: ${t.assertion}`;
      if (t.error) msg += `\n  Error: ${t.error}`;
      if (t.actual !== undefined && t.expected !== undefined) {
        msg += `\n  Expected: ${t.expected}`;
        msg += `\n  Got: ${t.actual}`;
      }
      return msg;
    })
    .join("\n\n");

  return `PROBLEM: ${problem.text}

CODE:
${code}

TEST SETUP:
${problem.setupCode || "(none)"}

FAILED TESTS:
${failures}

Analyze the error and respond in this EXACT format:
WRONG: [What specific mistake did the code make?]
KEY: [What key requirement from the problem was missed or misunderstood?]
HINT: [One specific fix suggestion]

Trace the failing call against the code before proposing a fix. Distinguish runtime errors, interface mismatches, and algorithm errors. Ground your diagnosis in the supplied failure; do not invent expected values. Give a concrete correction and check it against the other requirements. If the evidence is insufficient, state the uncertainty. One line per field; the HINT may be detailed.`;
}

/**
 * Build retry prompt with critic feedback
 */
function buildRetryPrompt(
  problem: AgenticProblem,
  previousCode: string,
  criticAnalysis: CriticAnalysis,
): string {
  return `${new MBPPBenchmark().buildPrompt(problem)}

Your previous attempt failed. A separate Critic reviewed it:
MISTAKE: ${criticAnalysis.whatWentWrong}
KEY REQUIREMENT: ${criticAnalysis.keyRequirement}
FIX: ${criticAnalysis.hint}

Previous code:
${previousCode}

Write corrected Python code using the Critic's feedback.`;
}

/**
 * Parse critic response into structured analysis
 */
function parseCriticResponse(response: string): CriticAnalysis {
  const wrongMatch = response.match(/WRONG:\s*(.+?)(?:\n|$)/i);
  const keyMatch = response.match(/KEY:\s*(.+?)(?:\n|$)/i);
  const hintMatch = response.match(/HINT:\s*(.+?)(?:\n|$)/i);

  return {
    whatWentWrong: wrongMatch?.[1]?.trim() || "Unknown error",
    keyRequirement: keyMatch?.[1]?.trim() || "Check the problem requirements",
    hint: hintMatch?.[1]?.trim() || "Re-read the problem carefully",
  };
}

/**
 * Agentic evaluation runner using multi-agent system
 */
export class AgenticEvalRunner {
  private criticSession: ChatSession;
  private initialSession: ChatSession;
  private verbose: boolean;
  private lastFailedTests: FailedTest[] = [];
  private reviewIndex?: CodeSimilarityIndex;
  private lastReviewCases: SimilarCase[] = [];
  private reviewPredictor = new ReviewNeedPredictor();
  private preparationMode?: PreparationMode;
  private predictionThreshold = 0.2;

  constructor(config: Config, options?: { verbose?: boolean }) {
    this.criticSession = new ChatSession(
      config.getLLMClient(),
      config.getToolRegistry(),
      {
        systemPrompt:
          "You review Python solutions in a fresh context. Identify the root cause using the problem, code, test setup, and observed failures. Check imports, function signatures, data types, edge cases, and the algorithm. Return exactly WRONG, KEY, and HINT fields. Provide a specific repair with a brief reasoning trace. Do not invent missing evidence or reference solutions.",
        modelConfig: config.getLLMConfig(),
        toolConfig: { allowAllTools: false },
        runConfig: { maxTurns: 1 },
      },
    );
    this.initialSession = createCodeGenSession(config);
    this.verbose = options?.verbose ?? false;
  }

  /**
   * Run agentic evaluation with iteration
   */
  async run(
    config: EvalRunnerConfig,
    onProgress?: EvalProgressCallback,
  ): Promise<EvalRunResult> {
    const benchmark = getBenchmark(config.benchmark, config);
    const maxIterations = config.maxIterations ?? MAX_ITERATIONS;
    if (
      config.reviewPreparation &&
      (config.baselineReport || config.retryWithoutCritic)
    ) {
      throw new Error(
        "Review preparation requires fresh Critic evaluation; use the preparation replay experiment for cached initial answers",
      );
    }

    // Handle resume
    let checkpoint: Checkpoint | null = null;
    let runId = config.runId ?? generateRunId();
    let resumed = false;

    if (config.runId) {
      checkpoint = await loadCheckpoint(config.runId);
      if (checkpoint) {
        validateResumeConfig(checkpoint.config, config);
        resumed = true;
        runId = checkpoint.runId;
      }
    }

    if (!checkpoint) {
      checkpoint = await createCheckpoint(runId, config);
    }

    // Load problems
    const problems = await benchmark.load({
      limit: config.limit,
      offset: config.offset,
      problemIds: config.problemIds,
      sanitized: config.sanitized ?? true,
    });
    this.preparationMode = config.reviewPreparation;
    this.reviewPredictor = new ReviewNeedPredictor();
    if (config.reviewPreparation && resumed) {
      if (checkpoint.results.length && !checkpoint.reviewPredictorState)
        throw new Error(
          "Resumed review preparation requires a predictor checkpoint",
        );
      this.reviewPredictor.restore(checkpoint.reviewPredictorState ?? {});
    }
    this.predictionThreshold = config.predictionThreshold ?? 0.2;
    if (
      !Number.isFinite(this.predictionThreshold) ||
      this.predictionThreshold < 0 ||
      this.predictionThreshold > 1
    )
      throw new Error("Prediction threshold must be between zero and one");
    let corpusHash: string | undefined;
    if (config.reviewPreparation) {
      const cases = config.reviewCases
        ? (JSON.parse(
            await readFile(config.reviewCases, "utf8"),
          ) as ReviewCase[])
        : DEFAULT_REVIEW_CASES;
      corpusHash = createHash("sha256")
        .update(JSON.stringify(cases))
        .digest("hex");
      if (
        resumed &&
        checkpoint.results.length &&
        checkpoint.reviewCorpusHash !== corpusHash
      )
        throw new Error("Review corpus changed since the checkpoint");
      checkpoint.reviewCorpusHash = corpusHash;
      this.reviewIndex = await CodeSimilarityIndex.create(cases);
    } else {
      this.reviewIndex = undefined;
    }
    this.reviewIndex?.assertDisjoint(problems.map((problem) => problem.id));

    // Filter out already completed problems
    const completedIds = getCompletedIds(checkpoint);
    const remainingProblems = problems.filter((p) => !completedIds.has(p.id));
    let baselineResults: Map<string, EvaluationResult> | undefined;
    if (config.baselineReport) {
      const baseline = JSON.parse(
        await readFile(config.baselineReport, "utf8"),
      ) as BenchmarkReport;
      if (baseline.evaluationValidity?.valid === false) {
        throw new Error(
          "Baseline report is marked invalid; generate a fresh baseline with the corrected pipeline",
        );
      }
      if (
        baseline.model !== config.model ||
        baseline.results.length !== problems.length ||
        baseline.results.some(
          (result, index) => result.problemId !== problems[index].id,
        )
      ) {
        throw new Error(
          "Baseline report must use the same model and ordered problem set",
        );
      }
      baselineResults = new Map(
        baseline.results.map((result) => [result.problemId, result]),
      );
    }

    const startTime = Date.now();

    // Process each problem with iteration
    for (let i = 0; i < remainingProblems.length; i++) {
      const problem = remainingProblems[i] as AgenticProblem;
      const overallIndex = checkpoint.results.length;
      const tests = problem.tests;

      onProgress?.({
        current: overallIndex + 1,
        total: problems.length,
        problemId: problem.id,
      });

      const result = await this.solveProblemWithIteration(
        problem,
        tests,
        maxIterations,
        config.timeout ?? 30000,
        baselineResults?.get(problem.id),
        config.retryWithoutCritic ?? false,
      );

      // Save checkpoint
      if (this.preparationMode)
        checkpoint.reviewPredictorState = this.reviewPredictor.snapshot();
      await updateCheckpoint(checkpoint, result);

      onProgress?.({
        current: overallIndex + 1,
        total: problems.length,
        problemId: problem.id,
        result,
      });
    }

    // Generate report
    const report = this.generateReport(
      benchmark.name,
      config.model,
      checkpoint.results,
      config.baselineReport
        ? checkpoint.results.reduce(
            (sum, result) => sum + result.metrics.timeMs,
            0,
          )
        : Date.now() - startTime,
      config.retryWithoutCritic ?? false,
    );
    if (this.preparationMode && corpusHash)
      report.reviewPreparation = {
        mode: this.preparationMode,
        threshold: this.predictionThreshold,
        corpusHash,
        predictor: "online-beta-bernoulli-v1",
        similarity: "normalized-token-trigram-0.6+ast-histogram-0.4",
      };

    return {
      report,
      runId,
      resumed,
    };
  }

  /**
   * Solve a single problem with Coder-Critic iteration
   */
  private async solveProblemWithIteration(
    problem: AgenticProblem,
    tests: string[],
    maxIterations: number,
    timeout: number,
    baseline?: EvaluationResult,
    retryWithoutCritic = false,
  ): Promise<EvaluationResult> {
    const problemStartTime = Date.now();
    const preparationMetrics: NonNullable<ProblemMetrics["preparation"]> = [];
    this.lastReviewCases = [];
    this.lastFailedTests = [];
    if (baseline && (baseline.success || maxIterations <= 1)) return baseline;
    let iteration = baseline ? 1 : 0;
    let lastCode = baseline?.generatedCode ?? "";
    const usage = {
      promptTokens: baseline?.metrics.promptTokens ?? 0,
      completionTokens: baseline?.metrics.completionTokens ?? 0,
      totalTokens: baseline?.metrics.totalTokens ?? 0,
    };
    if (baseline) {
      const initialTests = await executeWithTests(
        lastCode,
        tests,
        problem.setupCode,
        { timeout },
      );
      this.lastFailedTests = initialTests.results
        .filter((result) => !result.passed)
        .map((result) => ({
          assertion: result.assertion,
          error: result.error,
          actual: result.actual,
          expected: result.expected,
        }));
    }

    while (iteration < maxIterations) {
      iteration++;

      // Build prompt - use critic analysis for retries
      let prompt: string;
      let criticAnalysis: CriticAnalysis | undefined;

      if (iteration === 1) {
        prompt = new MBPPBenchmark().buildPrompt(problem);
        if (this.verbose) {
          console.log(`\n${"=".repeat(60)}`);
          console.log(`[Problem ${problem.id}] Iteration ${iteration}`);
          console.log(`${"=".repeat(60)}`);
          console.log(`[CODER AGENT] Generating initial solution...`);
        }
      } else {
        // Blind retries receive no failed code, tests, or error feedback.
        if (this.verbose) {
          console.log(
            retryWithoutCritic
              ? "\n[CODER] Fresh sample with the original prompt..."
              : "\n[CRITIC] Analyzing errors...",
          );
        }
        if (retryWithoutCritic) {
          prompt = new MBPPBenchmark().buildPrompt(problem);
        } else {
          criticAnalysis = await this.runCriticAgent(problem, lastCode, usage);
          prompt = buildRetryPrompt(problem, lastCode, criticAnalysis);
        }
        if (this.verbose && criticAnalysis) {
          console.log(`  WRONG: ${criticAnalysis.whatWentWrong}`);
          console.log(`  KEY: ${criticAnalysis.keyRequirement}`);
          console.log(`  HINT: ${criticAnalysis.hint}`);
          console.log(
            `\n[CODER AGENT] Generating fix based on critic feedback...`,
          );
        }
      }

      // Run Coder Agent
      let generatedCode: string;
      try {
        const result = await this.initialSession.sendMessage(prompt);
        this.initialSession.clearHistory();
        this.addUsage(usage, result.usage);
        if (!result.success)
          throw new Error(result.error ?? "LLM request failed");
        generatedCode = result.content;
      } catch (error) {
        this.initialSession.clearHistory();
        throw new Error(
          `Evaluation stopped on problem ${problem.id}: Coder request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Extract and clean code
      const extracted = extractCode(generatedCode);
      if (!extracted.found) {
        lastCode = generatedCode;
        this.lastFailedTests = [
          {
            assertion: "Return an executable Python function",
            error: "No code found in response",
          },
        ];
        if (iteration < maxIterations) continue;
        return {
          problemId: problem.id,
          success: false,
          passed: 0,
          total: tests.length,
          generatedCode: "",
          error: "No code found in response",
          metrics: this.createMetrics(
            problemStartTime,
            iteration,
            usage,
            baseline,
            preparationMetrics,
          ),
        };
      }
      const code = cleanCode(extracted.code);
      lastCode = code;

      if (this.verbose) {
        console.log(`\n[CODE GENERATED]`);
        console.log("```python");
        console.log(code);
        console.log("```");
      }

      // Run tests
      const runTests = () =>
        executeWithTests(code, tests, problem.setupCode, { timeout });
      let testResult;
      if (this.reviewIndex && this.preparationMode) {
        const index = this.reviewIndex;
        const prepared = await prepareNextReview({
          code,
          mode: this.preparationMode,
          predictor: this.reviewPredictor,
          threshold: this.predictionThreshold,
          runTool: runTests,
          needsReview: (result) => !result.success,
          prepare: () => index.search(code),
        });
        testResult = prepared.tool;
        this.lastReviewCases = prepared.context ?? [];
        preparationMetrics.push({
          ...prepared.metrics,
          iteration,
          cases: this.lastReviewCases.map(({ id, similarity }) => ({
            id,
            similarity,
          })),
        });
      } else {
        testResult = await runTests();
      }

      if (this.verbose) {
        console.log(
          `\n[TEST RESULTS] ${testResult.passed}/${testResult.total} passed`,
        );
        for (const r of testResult.results) {
          const status = r.passed ? "✅" : "❌";
          console.log(`  ${status} ${r.assertion}`);
          if (!r.passed && r.actual && r.expected) {
            console.log(`     Expected: ${r.expected}, Got: ${r.actual}`);
          }
        }
      }

      if (testResult.success) {
        // All tests passed!
        if (this.verbose) {
          console.log(
            `\n✅ [SUCCESS] Problem ${problem.id} solved in ${iteration} iteration(s)`,
          );
        }
        return {
          problemId: problem.id,
          success: true,
          passed: testResult.passed,
          total: testResult.total,
          generatedCode: code,
          metrics: this.createMetrics(
            problemStartTime,
            iteration,
            usage,
            baseline,
            preparationMetrics,
          ),
        };
      }

      // Store failed tests for critic analysis
      this.lastFailedTests = testResult.results
        .filter((r) => !r.passed)
        .map((r) => ({
          assertion: r.assertion,
          error: r.error,
          actual: r.actual,
          expected: r.expected,
        }));

      // If this is the last iteration, return failure
      if (iteration >= maxIterations) {
        if (this.verbose) {
          console.log(
            `\n❌ [FAILED] Problem ${problem.id} failed after ${maxIterations} iterations`,
          );
        }
        return {
          problemId: problem.id,
          success: false,
          passed: testResult.passed,
          total: testResult.total,
          generatedCode: code,
          error: `Failed after ${maxIterations} iterations`,
          metrics: this.createMetrics(
            problemStartTime,
            iteration,
            usage,
            baseline,
            preparationMetrics,
          ),
        };
      }

      if (this.verbose) {
        console.log(`\n🔄 [RETRY] Moving to iteration ${iteration + 1}...`);
      }
    }

    // Should not reach here
    return {
      problemId: problem.id,
      success: false,
      passed: 0,
      total: tests.length,
      generatedCode: lastCode,
      error: "Unexpected end of iteration loop",
      metrics: this.createMetrics(
        problemStartTime,
        iteration,
        usage,
        baseline,
        preparationMetrics,
      ),
    };
  }

  /**
   * Run Critic Agent to analyze errors
   */
  private async runCriticAgent(
    problem: AgenticProblem,
    code: string,
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    },
  ): Promise<CriticAnalysis> {
    const prompt =
      buildCriticPrompt(problem, code, this.lastFailedTests) +
      formatReviewCases(this.lastReviewCases);

    try {
      const result = await this.criticSession.sendMessage(prompt);
      this.addUsage(usage, result.usage);
      if (!result.success)
        throw new Error(result.error ?? "Critic request failed");
      if (
        !["WRONG", "KEY", "HINT"].every((field) =>
          new RegExp(`^${field}:\\s*\\S`, "m").test(result.content),
        )
      ) {
        throw new Error("Critic returned an invalid analysis format");
      }
      return parseCriticResponse(result.content);
    } finally {
      this.criticSession.clearHistory();
    }
  }

  private createMetrics(
    startTime: number,
    iterations: number,
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    },
    baseline?: EvaluationResult,
    preparation?: ProblemMetrics["preparation"],
  ): ProblemMetrics {
    return {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      turnCount: iterations,
      timeMs: (baseline?.metrics.timeMs ?? 0) + Date.now() - startTime,
      preparation: preparation?.length ? preparation : undefined,
    };
  }

  private addUsage(
    total: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    },
    value?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    },
  ): void {
    if (!value) return;
    total.promptTokens += value.promptTokens;
    total.completionTokens += value.completionTokens;
    total.totalTokens += value.totalTokens;
  }

  private generateReport(
    benchmarkName: string,
    model: string,
    results: EvaluationResult[],
    totalTimeMs: number,
    retryWithoutCritic: boolean,
  ): BenchmarkReport {
    const summary = this.calculateSummary(results, totalTimeMs);

    return {
      benchmarkName: `${benchmarkName}-${retryWithoutCritic ? "blind-retry" : "agentic"}`,
      timestamp: new Date().toISOString(),
      model,
      summary,
      results,
    };
  }

  private calculateSummary(
    results: EvaluationResult[],
    totalTimeMs: number,
  ): BenchmarkSummary {
    const total = results.length;
    const passed = results.filter((r) => r.success).length;
    const totalTokens = results.reduce(
      (sum, r) => sum + r.metrics.totalTokens,
      0,
    );
    const avgIterations =
      total > 0
        ? results.reduce((sum, r) => sum + r.metrics.turnCount, 0) / total
        : 0;

    return {
      total,
      passed,
      passRate: total > 0 ? passed / total : 0,
      totalTokens,
      totalTimeMs,
      avgTimePerProblem: total > 0 ? totalTimeMs / total : 0,
      avgIterations,
    };
  }
}
