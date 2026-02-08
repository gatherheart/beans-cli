/**
 * E2E Test Helper for CLI
 *
 * Utilities for spawning and interacting with the CLI process in tests.
 */

import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../../packages/cli/dist/index.js');

export interface CLIProcess {
  process: ChildProcess;
  output: string[];
  errors: string[];
  write: (input: string) => void;
  waitForOutput: (pattern: string | RegExp, timeout?: number) => Promise<string>;
  waitForExit: (timeout?: number) => Promise<number>;
  kill: () => void;
}

export interface CLIOptions {
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * Spawn the CLI process for testing
 */
export function spawnCLI(options: CLIOptions = {}): CLIProcess {
  const { args = [], env = {}, timeout = 10000 } = options;

  const output: string[] = [];
  const errors: string[] = [];

  const proc = spawn('node', [CLI_PATH, ...args], {
    env: { ...process.env, ...env, FORCE_COLOR: '0' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Collect stdout
  proc.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    output.push(text);
  });

  // Collect stderr
  proc.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    errors.push(text);
  });

  // Auto-kill after timeout
  const killTimer = setTimeout(() => {
    proc.kill('SIGTERM');
  }, timeout);

  proc.on('exit', () => {
    clearTimeout(killTimer);
  });

  return {
    process: proc,
    output,
    errors,

    write(input: string) {
      proc.stdin?.write(input);
    },

    async waitForOutput(pattern: string | RegExp, waitTimeout = 5000): Promise<string> {
      const startTime = Date.now();
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

      return new Promise((resolve, reject) => {
        const check = () => {
          const fullOutput = output.join('');
          if (regex.test(fullOutput)) {
            resolve(fullOutput);
            return;
          }

          if (Date.now() - startTime > waitTimeout) {
            reject(new Error(`Timeout waiting for pattern: ${pattern}\nOutput: ${fullOutput}`));
            return;
          }

          setTimeout(check, 50);
        };
        check();
      });
    },

    async waitForExit(exitTimeout = 5000): Promise<number> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error('Timeout waiting for process exit'));
        }, exitTimeout);

        proc.on('exit', (code) => {
          clearTimeout(timer);
          resolve(code ?? 0);
        });
      });
    },

    kill() {
      clearTimeout(killTimer);
      if (!proc.killed) {
        proc.kill('SIGTERM');
        // Force kill after a short delay if still running
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 500);
      }
    },
  };
}

/**
 * Get raw output including escape codes
 */
export function getRawOutput(cli: CLIProcess): string {
  return cli.output.join('');
}

/**
 * Check if output contains escape code
 */
export function hasEscapeCode(output: string, code: string): boolean {
  return output.includes(code);
}

/**
 * Common escape codes
 */
export const EscapeCodes = {
  DISABLE_LINE_WRAP: '\x1b[?7l',
  ENABLE_LINE_WRAP: '\x1b[?7h',
  CLEAR_LINE: '\x1b[2K',
  CURSOR_UP: '\x1b[A',
  CURSOR_DOWN: '\x1b[B',
};
