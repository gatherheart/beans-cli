import type { EvaluationResult, BenchmarkReport } from "../benchmarks/types.js";

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
  /** JSON report whose initial answers are replayed in both retry arms. */
  baselineReport?: string;
  /** Retry with the original prompt only, without failure feedback. */
  retryWithoutCritic?: boolean;
  /** Prepare related-code review context after tests or speculatively during tests. */
  reviewPreparation?: "sequential" | "eager" | "predictive";
  /** Optional JSON review-case corpus; defaults to generic debugging cases. */
  reviewCases?: string;
  predictionThreshold?: number;
  toolAgent?: boolean;
  paste?: boolean;
  toolTraining?: string;
  datasetSource?: string;
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
  reviewPredictorState?: Record<string, { failures: number; total: number }>;
  reviewCorpusHash?: string;
  toolAgentProvenance?: {
    datasetHash: string;
    trainingHash: string;
    modelConfigHash: string;
  };
}

/**
 * Result of a complete evaluation run
 */
export interface EvalRunResult {
  report: BenchmarkReport;
  runId: string;
  resumed: boolean;
}
