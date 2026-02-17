/**
 * Agentic evaluation runner - allows iteration and tool usage
 */

import type {
  Benchmark,
  BenchmarkProblem,
  BenchmarkReport,
  BenchmarkSummary,
  EvaluationResult,
  ProblemMetrics,
} from '../benchmarks/types.js';
import type {
  EvalRunnerConfig,
  EvalProgressCallback,
  EvalRunResult,
  Checkpoint,
} from './types.js';
import {
  generateRunId,
  createCheckpoint,
  loadCheckpoint,
  updateCheckpoint,
  getCompletedIds,
} from './checkpoint.js';
import { MBPPBenchmark } from '../benchmarks/mbpp/index.js';
import { extractCode, cleanCode } from '../extraction/code-extractor.js';
import { executeWithTests } from '../execution/python-runner.js';
import type { ChatSession } from '@beans/core/agents';

const MAX_ITERATIONS = 5;

/**
 * Problem with text and tests (MBPP-style)
 */
interface AgenticProblem extends BenchmarkProblem {
  text: string;
  tests: string[];
}

/**
 * Get benchmark instance by name
 */
function getBenchmark(
  name: string,
  config: EvalRunnerConfig
): Benchmark<BenchmarkProblem> {
  switch (name.toLowerCase()) {
    case 'mbpp':
      return new MBPPBenchmark({ timeout: config.timeout });
    default:
      throw new Error(`Unknown benchmark: ${name}`);
  }
}

/**
 * Build the initial prompt for agentic mode
 */
function buildAgenticPrompt(problem: AgenticProblem, tests: string[]): string {
  return `Write a Python function to solve the following problem.

Problem: ${problem.text}

Your code will be tested with these assertions:
${tests.map((t) => `  ${t}`).join('\n')}

Write the Python function now. Output ONLY the code, no markdown blocks.`;
}

/**
 * Build a retry prompt with test failure feedback
 */
function buildRetryPrompt(
  problem: AgenticProblem,
  previousCode: string,
  failedTests: Array<{ assertion: string; error?: string }>,
  tests: string[]
): string {
  const failures = failedTests
    .map((t) => `  FAILED: ${t.assertion}\n    Error: ${t.error || 'assertion failed'}`)
    .join('\n');

  return `Your previous code failed some tests. Fix it.

Problem: ${problem.text}

Your previous code:
${previousCode}

Test failures:
${failures}

All tests that must pass:
${tests.map((t) => `  ${t}`).join('\n')}

Write the CORRECTED Python function. Output ONLY the code, no markdown blocks.`;
}

/**
 * Agentic evaluation runner with iteration support
 */
export class AgenticEvalRunner {
  private session: ChatSession;

  constructor(session: ChatSession) {
    this.session = session;
  }

  /**
   * Run agentic evaluation with iteration
   */
  async run(
    config: EvalRunnerConfig,
    onProgress?: EvalProgressCallback
  ): Promise<EvalRunResult> {
    const benchmark = getBenchmark(config.benchmark, config);
    const maxIterations = config.maxIterations ?? MAX_ITERATIONS;

    // Handle resume
    let checkpoint: Checkpoint | null = null;
    let runId = config.runId ?? generateRunId();
    let resumed = false;

    if (config.runId) {
      checkpoint = await loadCheckpoint(config.runId);
      if (checkpoint) {
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

    // Filter out already completed problems
    const completedIds = getCompletedIds(checkpoint);
    const remainingProblems = problems.filter((p) => !completedIds.has(p.id));

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
        config.timeout ?? 30000
      );

      // Save checkpoint
      await updateCheckpoint(checkpoint, result);

      onProgress?.({
        current: overallIndex + 1,
        total: problems.length,
        problemId: problem.id,
        result,
      });

      // Clear session history for next problem
      this.session.clearHistory();
    }

    // Generate report
    const report = this.generateReport(
      benchmark.name,
      config.model,
      checkpoint.results,
      Date.now() - startTime
    );

    return {
      report,
      runId,
      resumed,
    };
  }

  /**
   * Solve a single problem with iteration
   */
  private async solveProblemWithIteration(
    problem: AgenticProblem,
    tests: string[],
    maxIterations: number,
    timeout: number
  ): Promise<EvaluationResult> {
    const problemStartTime = Date.now();
    let iteration = 0;
    let lastCode = '';
    let totalTokens = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Build prompt
      const prompt =
        iteration === 1
          ? buildAgenticPrompt(problem, tests)
          : buildRetryPrompt(
              problem,
              lastCode,
              this.lastFailedTests,
              tests
            );

      // Get code from LLM
      let generatedCode: string;
      try {
        const response = await this.session.sendMessage(prompt);
        generatedCode = response.content;
        // Note: token tracking would require LLM response metadata
      } catch (error) {
        return {
          problemId: problem.id,
          success: false,
          passed: 0,
          total: tests.length,
          generatedCode: lastCode,
          error: error instanceof Error ? error.message : String(error),
          metrics: this.createMetrics(problemStartTime, iteration, totalTokens),
        };
      }

      // Extract and clean code
      const extracted = extractCode(generatedCode);
      const code = extracted.found ? cleanCode(extracted.code) : generatedCode.trim();
      lastCode = code;

      // Run tests
      const testResult = await executeWithTests(code, tests, undefined, { timeout });

      if (testResult.success) {
        // All tests passed!
        return {
          problemId: problem.id,
          success: true,
          passed: testResult.passed,
          total: testResult.total,
          generatedCode: code,
          metrics: this.createMetrics(problemStartTime, iteration, totalTokens),
        };
      }

      // Store failed tests for retry prompt
      this.lastFailedTests = testResult.results
        .filter((r) => !r.passed)
        .map((r) => ({ assertion: r.assertion, error: r.error }));

      // If this is the last iteration, return failure
      if (iteration >= maxIterations) {
        return {
          problemId: problem.id,
          success: false,
          passed: testResult.passed,
          total: testResult.total,
          generatedCode: code,
          error: `Failed after ${maxIterations} iterations`,
          metrics: this.createMetrics(problemStartTime, iteration, totalTokens),
        };
      }
    }

    // Should not reach here
    return {
      problemId: problem.id,
      success: false,
      passed: 0,
      total: tests.length,
      generatedCode: lastCode,
      error: 'Unexpected end of iteration loop',
      metrics: this.createMetrics(problemStartTime, iteration, totalTokens),
    };
  }

  private lastFailedTests: Array<{ assertion: string; error?: string }> = [];

  private createMetrics(
    startTime: number,
    iterations: number,
    totalTokens: number
  ): ProblemMetrics {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens,
      turnCount: iterations,
      timeMs: Date.now() - startTime,
    };
  }

  private generateReport(
    benchmarkName: string,
    model: string,
    results: EvaluationResult[],
    totalTimeMs: number
  ): BenchmarkReport {
    const summary = this.calculateSummary(results, totalTimeMs);

    return {
      benchmarkName: `${benchmarkName}-agentic`,
      timestamp: new Date().toISOString(),
      model,
      summary,
      results,
    };
  }

  private calculateSummary(
    results: EvaluationResult[],
    totalTimeMs: number
  ): BenchmarkSummary {
    const total = results.length;
    const passed = results.filter((r) => r.success).length;
    const totalTokens = results.reduce((sum, r) => sum + r.metrics.totalTokens, 0);
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
