import type { EvaluationResult, BenchmarkReport } from '../benchmarks/types.js';

/**
 * Configuration for evaluation runner
 */
export interface EvalRunnerConfig {
  /** Benchmark to run (e.g., 'mbpp') */
  benchmark: string;
  /** Model to use for generation */
  model: string;
  /** Maximum problems to evaluate */
  limit?: number;
  /** Skip first N problems */
  offset?: number;
  /** Specific problem IDs to evaluate */
  problemIds?: string[];
  /** Output file path */
  output?: string;
  /** Run ID for resume support */
  runId?: string;
  /** Timeout per problem in ms */
  timeout?: number;
  /** Use sanitized subset */
  sanitized?: boolean;
  /** Enable agentic mode with iteration */
  agentic?: boolean;
  /** Max iterations per problem in agentic mode */
  maxIterations?: number;
}

/**
 * Progress callback for evaluation
 */
export interface EvalProgress {
  current: number;
  total: number;
  problemId: string;
  result?: EvaluationResult;
}

export type EvalProgressCallback = (progress: EvalProgress) => void;

/**
 * Checkpoint data for resuming evaluations
 */
export interface Checkpoint {
  runId: string;
  config: EvalRunnerConfig;
  completedIds: string[];
  results: EvaluationResult[];
  startedAt: string;
  updatedAt: string;
}

/**
 * Result of a complete evaluation run
 */
export interface EvalRunResult {
  report: BenchmarkReport;
  runId: string;
  resumed: boolean;
}
