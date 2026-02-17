/**
 * Result of executing code
 */
export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  error?: string;
}

/**
 * Options for code execution
 */
export interface ExecutionOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Working directory */
  cwd?: string;
}

/**
 * Test execution result
 */
export interface TestResult {
  passed: boolean;
  assertion: string;
  error?: string;
}

/**
 * Result of running tests
 */
export interface TestExecutionResult {
  success: boolean;
  passed: number;
  total: number;
  results: TestResult[];
  error?: string;
}
