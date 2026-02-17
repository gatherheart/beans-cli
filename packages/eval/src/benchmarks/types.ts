/**
 * Base interface for all benchmark problems
 */
export interface BenchmarkProblem {
  id: string;
}

/**
 * Options for loading benchmark datasets
 */
export interface LoadOptions {
  /** Maximum number of problems to load */
  limit?: number;
  /** Skip first N problems */
  offset?: number;
  /** Load specific problem IDs */
  problemIds?: string[];
  /** Use sanitized subset if available */
  sanitized?: boolean;
}

/**
 * Metrics collected during problem evaluation
 */
export interface ProblemMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  turnCount: number;
  timeMs: number;
}

/**
 * Result of evaluating a single problem
 */
export interface EvaluationResult {
  problemId: string;
  success: boolean;
  passed: number;
  total: number;
  generatedCode: string;
  error?: string;
  metrics: ProblemMetrics;
}

/**
 * Summary statistics for a benchmark run
 */
export interface BenchmarkSummary {
  total: number;
  passed: number;
  passRate: number;
  totalTokens: number;
  totalTimeMs: number;
  avgTimePerProblem: number;
  /** Average iterations per problem (agentic mode only) */
  avgIterations?: number;
}

/**
 * Complete report for a benchmark evaluation
 */
export interface BenchmarkReport {
  benchmarkName: string;
  timestamp: string;
  model: string;
  summary: BenchmarkSummary;
  results: EvaluationResult[];
}

/**
 * Abstract benchmark interface for implementing different benchmarks
 */
export interface Benchmark<T extends BenchmarkProblem> {
  /** Unique name of the benchmark */
  readonly name: string;
  /** Human-readable description */
  readonly description: string;

  /**
   * Load benchmark problems
   */
  load(options?: LoadOptions): Promise<T[]>;

  /**
   * Build a prompt for the LLM from a problem
   */
  buildPrompt(problem: T): string;

  /**
   * Evaluate a generated solution against test cases
   */
  evaluate(problem: T, generatedCode: string): Promise<EvaluationResult>;
}
