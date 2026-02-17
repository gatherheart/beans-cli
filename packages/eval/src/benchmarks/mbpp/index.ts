import type {
  Benchmark,
  LoadOptions,
  EvaluationResult,
  ProblemMetrics,
} from '../types.js';
import type { MBPPProblem } from './types.js';
import { loadMBPP } from './loader.js';
import { extractCode, cleanCode } from '../../extraction/code-extractor.js';
import { executeWithTests } from '../../execution/python-runner.js';

export type { MBPPProblem } from './types.js';
export { loadMBPP } from './loader.js';

/**
 * MBPP (Mostly Basic Programming Problems) Benchmark
 *
 * A benchmark of 974 crowd-sourced Python programming problems
 * designed to evaluate code generation capabilities.
 */
export class MBPPBenchmark implements Benchmark<MBPPProblem> {
  readonly name = 'mbpp';
  readonly description =
    'Mostly Basic Programming Problems - 974 Python code generation tasks';

  private timeout: number;

  constructor(options: { timeout?: number } = {}) {
    this.timeout = options.timeout ?? 30000;
  }

  async load(options?: LoadOptions): Promise<MBPPProblem[]> {
    return loadMBPP(options);
  }

  buildPrompt(problem: MBPPProblem): string {
    // Build a prompt that asks for a Python function
    // Include example tests to clarify expected behavior
    const exampleTest = problem.tests[0];

    return `Write a Python function to solve the following problem.

Problem: ${problem.text}

Example:
${exampleTest}

Provide only the Python code for the function, no explanations.`;
  }

  async evaluate(
    problem: MBPPProblem,
    generatedCode: string
  ): Promise<EvaluationResult> {
    const startTime = Date.now();

    // Extract code from response
    const extracted = extractCode(generatedCode);

    if (!extracted.found) {
      return {
        problemId: problem.id,
        success: false,
        passed: 0,
        total: problem.tests.length,
        generatedCode: '',
        error: 'No code found in response',
        metrics: this.createMetrics(startTime),
      };
    }

    const code = cleanCode(extracted.code);

    // Execute tests
    const testResult = await executeWithTests(
      code,
      problem.tests,
      problem.setupCode,
      { timeout: this.timeout }
    );

    return {
      problemId: problem.id,
      success: testResult.success,
      passed: testResult.passed,
      total: testResult.total,
      generatedCode: code,
      error: testResult.error,
      metrics: this.createMetrics(startTime),
    };
  }

  private createMetrics(startTime: number): ProblemMetrics {
    // Token metrics will be filled in by the runner
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      turnCount: 1,
      timeMs: Date.now() - startTime,
    };
  }
}
