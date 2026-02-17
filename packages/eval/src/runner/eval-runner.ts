import type {
  Benchmark,
  BenchmarkProblem,
  BenchmarkReport,
  BenchmarkSummary,
  EvaluationResult,
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
import type { ChatSession } from '@beans/core/agents';

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
 * Main evaluation runner
 */
export class EvalRunner {
  private session: ChatSession;

  constructor(session: ChatSession) {
    this.session = session;
  }

  /**
   * Run evaluation with the given configuration
   */
  async run(
    config: EvalRunnerConfig,
    onProgress?: EvalProgressCallback
  ): Promise<EvalRunResult> {
    const benchmark = getBenchmark(config.benchmark, config);

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

    // Process each problem
    for (let i = 0; i < remainingProblems.length; i++) {
      const problem = remainingProblems[i];
      const overallIndex = checkpoint.results.length;

      onProgress?.({
        current: overallIndex + 1,
        total: problems.length,
        problemId: problem.id,
      });

      // Get solution from LLM
      const prompt = benchmark.buildPrompt(problem);
      const llmStartTime = Date.now();

      let generatedCode: string;
      try {
        const response = await this.session.sendMessage(prompt);
        generatedCode = response.content;
      } catch (error) {
        // LLM error - record as failure
        const result: EvaluationResult = {
          problemId: problem.id,
          success: false,
          passed: 0,
          total: 3, // Assume standard test count
          generatedCode: '',
          error: error instanceof Error ? error.message : String(error),
          metrics: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            turnCount: 1,
            timeMs: Date.now() - llmStartTime,
          },
        };

        await updateCheckpoint(checkpoint, result);

        onProgress?.({
          current: overallIndex + 1,
          total: problems.length,
          problemId: problem.id,
          result,
        });

        continue;
      }

      // Evaluate the solution
      const result = await benchmark.evaluate(problem, generatedCode);

      // Update metrics with LLM timing
      result.metrics.timeMs = Date.now() - llmStartTime;

      // Save checkpoint
      await updateCheckpoint(checkpoint, result);

      onProgress?.({
        current: overallIndex + 1,
        total: problems.length,
        problemId: problem.id,
        result,
      });

      // Clear session history to avoid context buildup
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

  private generateReport(
    benchmarkName: string,
    model: string,
    results: EvaluationResult[],
    totalTimeMs: number
  ): BenchmarkReport {
    const summary = this.calculateSummary(results, totalTimeMs);

    return {
      benchmarkName,
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

    return {
      total,
      passed,
      passRate: total > 0 ? passed / total : 0,
      totalTokens,
      totalTimeMs,
      avgTimePerProblem: total > 0 ? totalTimeMs / total : 0,
    };
  }
}
