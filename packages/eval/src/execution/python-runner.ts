import { spawn } from 'child_process';
import type {
  ExecutionResult,
  ExecutionOptions,
  TestExecutionResult,
  TestResult,
} from './types.js';

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Execute Python code as a subprocess
 */
export async function executePython(
  code: string,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const { timeout = DEFAULT_TIMEOUT, cwd } = options;

  return new Promise((resolve) => {
    const process = spawn('python3', ['-c', code], {
      cwd,
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    process.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      process.kill('SIGKILL');
    }, timeout);

    process.on('close', (exitCode) => {
      clearTimeout(timer);

      resolve({
        success: exitCode === 0 && !timedOut,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode ?? -1,
        timedOut,
        error: timedOut ? 'Execution timed out' : undefined,
      });
    });

    process.on('error', (err) => {
      clearTimeout(timer);

      resolve({
        success: false,
        stdout: '',
        stderr: err.message,
        exitCode: -1,
        timedOut: false,
        error: err.message,
      });
    });
  });
}

/**
 * Execute Python code with test assertions
 *
 * @param code - The generated code to test
 * @param tests - Array of assertion strings (e.g., "assert func(1) == 2")
 * @param setupCode - Optional setup code to run before tests
 */
export async function executeWithTests(
  code: string,
  tests: string[],
  setupCode?: string,
  options: ExecutionOptions = {}
): Promise<TestExecutionResult> {
  const results: TestResult[] = [];

  // Build test script that reports results as JSON
  const testScript = buildTestScript(code, tests, setupCode);

  const execResult = await executePython(testScript, options);

  if (execResult.timedOut) {
    return {
      success: false,
      passed: 0,
      total: tests.length,
      results: tests.map((t) => ({ passed: false, assertion: t, error: 'Timeout' })),
      error: 'Execution timed out',
    };
  }

  if (!execResult.success && !execResult.stdout) {
    // Complete failure before any tests ran
    return {
      success: false,
      passed: 0,
      total: tests.length,
      results: tests.map((t) => ({
        passed: false,
        assertion: t,
        error: execResult.stderr || execResult.error,
      })),
      error: execResult.stderr || execResult.error,
    };
  }

  // Parse test results from stdout
  try {
    const lines = execResult.stdout.split('\n').filter((l) => l.startsWith('TEST:'));

    for (let i = 0; i < tests.length; i++) {
      const line = lines[i];
      if (line) {
        const passed = line.includes(':PASS');

        // Parse error and actual/expected values
        // Format: TEST:0:FAIL:message|ACTUAL:value|EXPECTED:value
        let error: string | undefined;
        let actual: string | undefined;
        let expected: string | undefined;

        if (!passed) {
          const failMatch = line.match(/:FAIL:([^|]+)/);
          const actualMatch = line.match(/\|ACTUAL:([^|]+)/);
          const expectedMatch = line.match(/\|EXPECTED:(.+)$/);

          error = failMatch ? failMatch[1] : undefined;
          actual = actualMatch ? actualMatch[1] : undefined;
          expected = expectedMatch ? expectedMatch[1] : undefined;
        }

        results.push({
          passed,
          assertion: tests[i],
          error,
          actual,
          expected,
        });
      } else {
        results.push({
          passed: false,
          assertion: tests[i],
          error: 'No result received',
        });
      }
    }
  } catch {
    // Fallback: if we can't parse, check if all assertions passed
    const allPassed = !execResult.stderr && execResult.exitCode === 0;
    return {
      success: allPassed,
      passed: allPassed ? tests.length : 0,
      total: tests.length,
      results: tests.map((t) => ({
        passed: allPassed,
        assertion: t,
        error: allPassed ? undefined : execResult.stderr,
      })),
    };
  }

  const passed = results.filter((r) => r.passed).length;

  return {
    success: passed === tests.length,
    passed,
    total: tests.length,
    results,
  };
}

/**
 * Build a Python script that runs tests and reports results
 * Captures actual vs expected values for better feedback
 */
function buildTestScript(code: string, tests: string[], setupCode?: string): string {
  const setupSection = setupCode ? `${setupCode}\n` : '';

  // Helper function to evaluate and compare
  const helperCode = `
import re

def _run_test(test_str, test_idx):
    """Run a test and capture actual vs expected values."""
    # Try to parse assertion: assert expr == expected or assert expr
    match = re.match(r'assert\\s+(.+?)\\s*==\\s*(.+)$', test_str.strip())
    if match:
        expr, expected_str = match.groups()
        try:
            actual = eval(expr)
            expected = eval(expected_str)
            if actual == expected:
                print(f"TEST:{test_idx}:PASS")
            else:
                print(f"TEST:{test_idx}:FAIL:Expected {repr(expected)}, got {repr(actual)}|ACTUAL:{repr(actual)}|EXPECTED:{repr(expected)}")
        except Exception as e:
            print(f"TEST:{test_idx}:FAIL:{type(e).__name__}: {e}")
    else:
        # Fallback for non-equality assertions
        try:
            exec(test_str)
            print(f"TEST:{test_idx}:PASS")
        except AssertionError as e:
            print(f"TEST:{test_idx}:FAIL:{e}")
        except Exception as e:
            print(f"TEST:{test_idx}:FAIL:{type(e).__name__}: {e}")
`;

  const testSection = tests
    .map((test, i) => `_run_test(${JSON.stringify(test)}, ${i})`)
    .join('\n');

  return `${setupSection}${code}\n\n${helperCode}\n${testSection}`;
}
