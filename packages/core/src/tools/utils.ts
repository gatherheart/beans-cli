/**
 * Shared utilities for tools
 */

import * as path from "path";
import * as os from "os";
import type { ToolExecutionResult } from "./types.js";
import { DEFAULT_TOOL_TIMEOUT } from "./types.js";

// Re-export for convenience
export { DEFAULT_TOOL_TIMEOUT };

/**
 * Expand tilde (~) to home directory
 */
export function expandTilde(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  if (filePath === "~") {
    return os.homedir();
  }
  return filePath;
}

/**
 * Error thrown when tool execution times out
 */
export class ToolTimeoutError extends Error {
  constructor(toolName: string, timeoutMs: number) {
    super(`Tool '${toolName}' timed out after ${timeoutMs}ms`);
    this.name = "ToolTimeoutError";
  }
}

/**
 * Wrap a promise with a timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ToolTimeoutError(toolName, timeoutMs));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Execute a tool with timeout enforcement
 */
export async function executeWithTimeout(
  toolName: string,
  executeFn: () => Promise<ToolExecutionResult>,
  timeoutMs: number = DEFAULT_TOOL_TIMEOUT,
): Promise<ToolExecutionResult> {
  try {
    return await withTimeout(executeFn(), timeoutMs, toolName);
  } catch (error) {
    if (error instanceof ToolTimeoutError) {
      return {
        content: error.message,
        isError: true,
        metadata: { timeout: true, timeoutMs },
      };
    }
    throw error;
  }
}
