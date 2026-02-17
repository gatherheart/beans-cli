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
 * Critic analysis of what went wrong
 */
interface CriticAnalysis {
  whatWentWrong: string;
  keyRequirement: string;
  hint: string;
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
 * Build prompt for the Critic Agent to analyze errors
 */
function buildCriticPrompt(
  problem: AgenticProblem,
  code: string,
  failedTests: FailedTest[]
): string {
  const failures = failedTests
    .map((t) => {
      let msg = `Test: ${t.assertion}`;
      if (t.actual !== undefined && t.expected !== undefined) {
        msg += `\n  Expected: ${t.expected}`;
        msg += `\n  Got: ${t.actual}`;
      }
      return msg;
    })
    .join('\n\n');

  return `You are a code review expert. Analyze why this code is WRONG.

PROBLEM: ${problem.text}

CODE:
${code}

FAILED TESTS:
${failures}

Analyze the error and respond in this EXACT format:
WRONG: [What specific mistake did the code make?]
KEY: [What key requirement from the problem was missed or misunderstood?]
HINT: [One specific fix suggestion]

Be concise. One line each.`;
}

/**
 * Parse critic response into structured analysis
 */
function parseCriticResponse(response: string): CriticAnalysis {
  const wrongMatch = response.match(/WRONG:\s*(.+?)(?:\n|$)/i);
  const keyMatch = response.match(/KEY:\s*(.+?)(?:\n|$)/i);
  const hintMatch = response.match(/HINT:\s*(.+?)(?:\n|$)/i);

  return {
    whatWentWrong: wrongMatch?.[1]?.trim() || 'Unknown error',
    keyRequirement: keyMatch?.[1]?.trim() || 'Check the problem requirements',
    hint: hintMatch?.[1]?.trim() || 'Re-read the problem carefully',
  };
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
 * Failed test info with actual/expected values
 */
interface FailedTest {
  assertion: string;
  error?: string;
  actual?: string;
  expected?: string;
}

/**
 * Build a retry prompt with critic analysis
 */
function buildRetryPromptWithCritic(
  problem: AgenticProblem,
  previousCode: string,
  criticAnalysis: CriticAnalysis,
  tests: string[]
): string {
  return `YOUR CODE IS WRONG. A code reviewer analyzed the error:

** MISTAKE: ${criticAnalysis.whatWentWrong}
** KEY REQUIREMENT: ${criticAnalysis.keyRequirement}
** FIX: ${criticAnalysis.hint}

Problem: ${problem.text}

Your wrong code:
${previousCode}

All tests that must pass:
${tests.map((t) => `  ${t}`).join('\n')}

Write the CORRECTED code. Apply the fix suggested above. Output ONLY Python code, no markdown.`;
}

/**
 * Agentic evaluation runner with iteration support
 */
export class AgenticEvalRunner {
  private session: ChatSession;
  private verbose: boolean;

  constructor(session: ChatSession, options?: { verbose?: boolean }) {
    this.session = session;
    this.verbose = options?.verbose ?? false;
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
   * Solve a single problem with iteration using Critic Agent
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
    const totalTokens = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Build prompt - use critic analysis for retries
      let prompt: string;
      let criticAnalysis: CriticAnalysis | undefined;
      if (iteration === 1) {
        prompt = buildAgenticPrompt(problem, tests);
        if (this.verbose) {
          console.log(`\n${'='.repeat(60)}`);
          console.log(`[Problem ${problem.id}] Iteration ${iteration}`);
          console.log(`${'='.repeat(60)}`);
          console.log(`[CODER AGENT] Generating initial solution...`);
        }
      } else {
        // Use Critic Agent to analyze what went wrong
        if (this.verbose) {
          console.log(`\n[CRITIC AGENT] Analyzing errors...`);
        }
        criticAnalysis = await this.getCriticAnalysis(
          problem,
          lastCode,
          this.lastFailedTests
        );
        if (this.verbose) {
          console.log(`  WRONG: ${criticAnalysis.whatWentWrong}`);
          console.log(`  KEY: ${criticAnalysis.keyRequirement}`);
          console.log(`  HINT: ${criticAnalysis.hint}`);
          console.log(`\n[CODER AGENT] Generating fix based on critic feedback...`);
        }
        prompt = buildRetryPromptWithCritic(problem, lastCode, criticAnalysis, tests);
      }

      // Get code from LLM (Coder Agent)
      let generatedCode: string;
      try {
        const response = await this.session.sendMessage(prompt);
        generatedCode = response.content;
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

      if (this.verbose) {
        console.log(`\n[CODE GENERATED]`);
        console.log('```python');
        console.log(code);
        console.log('```');
      }

      // Run tests
      const testResult = await executeWithTests(code, tests, undefined, { timeout });

      if (this.verbose) {
        console.log(`\n[TEST RESULTS] ${testResult.passed}/${testResult.total} passed`);
        for (const r of testResult.results) {
          const status = r.passed ? '✅' : '❌';
          console.log(`  ${status} ${r.assertion}`);
          if (!r.passed && r.actual && r.expected) {
            console.log(`     Expected: ${r.expected}, Got: ${r.actual}`);
          }
        }
      }

      if (testResult.success) {
        // All tests passed!
        if (this.verbose) {
          console.log(`\n✅ [SUCCESS] Problem ${problem.id} solved in ${iteration} iteration(s)`);
        }
        return {
          problemId: problem.id,
          success: true,
          passed: testResult.passed,
          total: testResult.total,
          generatedCode: code,
          metrics: this.createMetrics(problemStartTime, iteration, totalTokens),
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
          console.log(`\n❌ [FAILED] Problem ${problem.id} failed after ${maxIterations} iterations`);
        }
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

      if (this.verbose) {
        console.log(`\n🔄 [RETRY] Moving to iteration ${iteration + 1}...`);
      }

      // Clear history for fresh retry with critic feedback
      this.session.clearHistory();
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

  /**
   * Critic Agent: Analyzes the error and provides feedback
   */
  private async getCriticAnalysis(
    problem: AgenticProblem,
    code: string,
    failedTests: FailedTest[]
  ): Promise<CriticAnalysis> {
    const criticPrompt = buildCriticPrompt(problem, code, failedTests);

    try {
      const response = await this.session.sendMessage(criticPrompt);
      this.session.clearHistory(); // Clear after critic, before coder
      return parseCriticResponse(response.content);
    } catch {
      // Fallback if critic fails
      return {
        whatWentWrong: 'Code produced incorrect output',
        keyRequirement: 'Re-read the problem carefully',
        hint: 'Check your logic against the expected output',
      };
    }
  }

  private lastFailedTests: FailedTest[] = [];

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
