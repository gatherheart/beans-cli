import { spawn, execFile } from "child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import type {
  ExecutionResult,
  ExecutionOptions,
  TestExecutionResult,
  TestResult,
} from "./types.js";

const DEFAULT_TIMEOUT = 30000; // 30 seconds
let pythonRuntime: Promise<{ executable: string; prefix: string }> | undefined;

async function isolatedCommand(
  code: string,
): Promise<{ command: string; args: string[] }> {
  if (process.platform !== "darwin")
    throw new Error(
      "Isolated MBPP tools require macOS sandbox-exec; refusing unsandboxed speculation",
    );
  pythonRuntime ??= promisify(execFile)("python3", [
    "-c",
    "import json,os,sys; print(json.dumps({'executable':os.path.realpath(sys.executable),'prefix':sys.prefix}))",
  ]).then(({ stdout }) => JSON.parse(stdout));
  const python = await pythonRuntime;
  const profile = `(version 1)(allow default)(deny network*)(deny file-write*)(deny process-fork)
    (deny file-read* (subpath ${JSON.stringify(homedir())}) (subpath "/private/tmp") (subpath "/private/var/folders"))
    (allow file-read* (subpath ${JSON.stringify(python.prefix)}))
    (allow file-write* (literal "/dev/null"))`;
  return {
    command: "/usr/bin/sandbox-exec",
    args: ["-p", profile, python.executable, "-I", "-B", "-c", code],
  };
}

/**
 * Execute Python code as a subprocess
 */
export async function executePython(
  code: string,
  options: ExecutionOptions = {},
): Promise<ExecutionResult> {
  const { timeout = DEFAULT_TIMEOUT, cwd, signal } = options;
  signal?.throwIfAborted();
  const command = options.isolated
    ? await isolatedCommand(code)
    : { command: "python3", args: ["-c", code] };
  signal?.throwIfAborted();

  return new Promise((resolve) => {
    const process = spawn(command.command, command.args, {
      cwd: options.isolated ? "/" : cwd,
      stdio: ["pipe", "pipe", "pipe"],
      ...(options.isolated
        ? {
            env: {
              PATH: "/usr/bin:/bin",
              HOME: "/nonexistent",
              LANG: "en_US.UTF-8",
            },
          }
        : {}),
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let outputExceeded = false;
    const abort = () => {
      process.kill("SIGKILL");
    };
    signal?.addEventListener("abort", abort, { once: true });

    process.stdout.on("data", (data: Buffer) => {
      if (stdout.length + data.length > 1024 * 1024 && options.isolated) {
        outputExceeded = true;
        abort();
      } else stdout += data.toString();
    });

    process.stderr.on("data", (data: Buffer) => {
      if (stderr.length + data.length > 1024 * 1024 && options.isolated) {
        outputExceeded = true;
        abort();
      } else stderr += data.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      process.kill("SIGKILL");
    }, timeout);

    process.on("close", (exitCode) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);

      resolve({
        success:
          exitCode === 0 && !timedOut && !signal?.aborted && !outputExceeded,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode ?? -1,
        timedOut,
        error: signal?.aborted
          ? "Execution aborted"
          : outputExceeded
            ? "Execution output limit exceeded"
            : timedOut
              ? "Execution timed out"
              : undefined,
      });
    });

    process.on("error", (err) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);

      resolve({
        success: false,
        stdout: "",
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
  options: ExecutionOptions = {},
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
      results: tests.map((t) => ({
        passed: false,
        assertion: t,
        error: "Timeout",
      })),
      error: "Execution timed out",
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

  // Only accept a structured result for its explicit test index.
  const records = new Map<number, { passed: boolean; error?: string }>();
  for (const line of execResult.stdout.split("\n")) {
    if (!line.startsWith("BEANS_TEST:")) continue;
    try {
      const record = JSON.parse(line.slice("BEANS_TEST:".length));
      if (
        Number.isInteger(record.index) &&
        typeof record.passed === "boolean"
      ) {
        records.set(record.index, record);
      }
    } catch {
      /* Unrelated output is not a test result. */
    }
  }
  for (let index = 0; index < tests.length; index++) {
    const record = records.get(index);
    results.push({
      passed: record?.passed === true,
      assertion: tests[index],
      error:
        record?.error ??
        (record ? undefined : execResult.stderr || "No result received"),
    });
  }

  const passed = results.filter((r) => r.passed).length;

  return {
    success: execResult.success && tests.length > 0 && passed === tests.length,
    passed,
    total: tests.length,
    results,
  };
}

/**
 * Build a Python script that runs tests and reports results
 * Captures actual vs expected values for better feedback
 */
function buildTestScript(
  code: string,
  tests: string[],
  setupCode?: string,
): string {
  const setupSection = setupCode ? `${setupCode}\n` : "";

  // Helper function to evaluate and compare
  const helperCode = `
import json as _beans_json
import traceback as _beans_traceback

def _run_test(test_str, test_idx):
    try:
        exec(test_str, globals())
        result = {"index": test_idx, "passed": True}
    except Exception:
        result = {"index": test_idx, "passed": False, "error": _beans_traceback.format_exc()}
    print("BEANS_TEST:" + _beans_json.dumps(result))
`;

  const testSection = tests
    .map((test, i) => `_run_test(${JSON.stringify(test)}, ${i})`)
    .join("\n");

  return `${setupSection}${code}\n\n${helperCode}\n${testSection}`;
}
