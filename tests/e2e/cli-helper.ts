/**
 * E2E Test Helper for CLI
 *
 * Uses @lydell/node-pty to create a pseudo-terminal for testing.
 * This allows Ink to render properly in CI environments.
 *
 * Based on gemini-cli integration-tests/test-helper.ts pattern.
 */

import * as pty from '@lydell/node-pty';
import stripAnsi from 'strip-ansi';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../../packages/cli/dist/index.js');

// Get timeout based on environment
function getDefaultTimeout(): number {
  if (process.env['CI']) return 60000; // 1 minute in CI
  return 15000; // 15s locally
}

/**
 * Poll until predicate returns true or timeout
 */
export async function poll(
  predicate: () => boolean,
  timeout: number,
  interval: number
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (predicate()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return false;
}

/**
 * Interactive CLI run - wraps a PTY process
 */
export class InteractiveRun {
  ptyProcess: pty.IPty;
  public output = '';

  constructor(ptyProcess: pty.IPty) {
    this.ptyProcess = ptyProcess;
    ptyProcess.onData((data) => {
      this.output += data;
      if (process.env['VERBOSE'] === 'true') {
        process.stdout.write(data);
      }
    });
  }

  /**
   * Wait for text to appear in output
   */
  async expectText(text: string, timeout?: number): Promise<void> {
    if (!timeout) {
      timeout = getDefaultTimeout();
    }
    const found = await poll(
      () => stripAnsi(this.output).toLowerCase().includes(text.toLowerCase()),
      timeout,
      100
    );
    if (!found) {
      throw new Error(
        `Timeout waiting for text: "${text}"\nOutput:\n${stripAnsi(this.output)}`
      );
    }
  }

  /**
   * Wait for pattern (regex) to appear in output
   */
  async expectPattern(pattern: RegExp, timeout?: number): Promise<void> {
    if (!timeout) {
      timeout = getDefaultTimeout();
    }
    const found = await poll(
      () => pattern.test(stripAnsi(this.output)),
      timeout,
      100
    );
    if (!found) {
      throw new Error(
        `Timeout waiting for pattern: ${pattern}\nOutput:\n${stripAnsi(this.output)}`
      );
    }
  }

  /**
   * Type text slowly (one char at a time with echo verification)
   */
  async type(text: string): Promise<void> {
    let typedSoFar = '';
    for (const char of text) {
      this.ptyProcess.write(char);
      typedSoFar += char;

      const found = await poll(
        () => stripAnsi(this.output).includes(typedSoFar),
        5000,
        10
      );

      if (!found) {
        throw new Error(
          `Timeout waiting for typed text: "${typedSoFar}"\nOutput:\n${stripAnsi(this.output)}`
        );
      }
    }
  }

  /**
   * Send keys without waiting for echo (for commands, enter, etc.)
   */
  async sendKeys(text: string): Promise<void> {
    const delay = 5;
    for (const char of text) {
      this.ptyProcess.write(char);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Send a line (text + Enter)
   */
  async sendLine(text: string): Promise<void> {
    await this.sendKeys(text + '\r');
  }

  /**
   * Get raw output including ANSI codes
   */
  getRawOutput(): string {
    return this.output;
  }

  /**
   * Get cleaned output (no ANSI codes)
   */
  getCleanOutput(): string {
    return stripAnsi(this.output);
  }

  /**
   * Kill the process
   */
  kill(): void {
    try {
      this.ptyProcess.kill();
    } catch {
      // Process may already be dead
    }
  }

  /**
   * Wait for process to exit
   */
  expectExit(timeout = 60000): Promise<number> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for process exit'));
      }, timeout);

      this.ptyProcess.onExit(({ exitCode }) => {
        clearTimeout(timer);
        resolve(exitCode);
      });
    });
  }
}

export interface CLIOptions {
  args?: string[];
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  cwd?: string;
}

/**
 * Spawn CLI in interactive mode with PTY
 */
export async function spawnInteractive(
  options: CLIOptions = {}
): Promise<InteractiveRun> {
  const {
    args = [],
    env = {},
    cols = 120,
    rows = 30,
    cwd = process.cwd(),
  } = options;

  // Filter out undefined env values (required for node-pty)
  const filteredEnv = Object.fromEntries(
    Object.entries({ ...process.env, ...env, FORCE_COLOR: '0' })
      .filter(([, v]) => v !== undefined)
  ) as Record<string, string>;

  // Log spawn info in CI for debugging
  if (process.env['CI']) {
    console.log(`[E2E] Spawning CLI with args: ${args.join(' ')}`);
    console.log(`[E2E] CLI_PATH: ${CLI_PATH}`);
  }

  const ptyProcess = pty.spawn(process.execPath, [CLI_PATH, ...args], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: filteredEnv,
  });

  const run = new InteractiveRun(ptyProcess);

  // Wait for the app to be ready with longer timeout for CI
  const timeout = process.env['CI'] ? 60000 : 30000;

  try {
    await run.expectText('Type a message', timeout);
  } catch (error) {
    // Log full output for debugging
    console.error('[E2E] Failed to find "Type a message"');
    console.error('[E2E] Raw output:', run.getRawOutput());
    console.error('[E2E] Clean output:', run.getCleanOutput());
    throw error;
  }

  return run;
}

/**
 * Spawn CLI for non-interactive commands (--help, --version)
 */
export async function spawnCommand(
  args: string[],
  options: Omit<CLIOptions, 'args'> = {}
): Promise<{ output: string; exitCode: number }> {
  const { env = {}, cols = 120, rows = 30, cwd = process.cwd() } = options;

  let output = '';

  const ptyProcess = pty.spawn(process.execPath, [CLI_PATH, ...args], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      ...env,
      FORCE_COLOR: '0',
    } as Record<string, string>,
  });

  ptyProcess.onData((data) => {
    output += data;
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      ptyProcess.kill();
      reject(new Error('Timeout waiting for command'));
    }, 10000);

    ptyProcess.onExit(({ exitCode }) => {
      clearTimeout(timer);
      resolve(exitCode);
    });
  });

  return { output: stripAnsi(output), exitCode };
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

/**
 * Debug spawn - captures output without waiting for specific text
 * Used for debugging CI issues
 */
export async function spawnInteractiveDebug(
  options: CLIOptions & { timeout?: number }
): Promise<{ rawOutput: string; cleanOutput: string; exitCode?: number }> {
  const {
    args = [],
    env = {},
    cols = 120,
    rows = 30,
    cwd = process.cwd(),
    timeout = 10000,
  } = options;

  const filteredEnv = Object.fromEntries(
    Object.entries({ ...process.env, ...env, FORCE_COLOR: '0' })
      .filter(([, v]) => v !== undefined)
  ) as Record<string, string>;

  console.log(`[DEBUG] Spawning CLI: ${CLI_PATH}`);
  console.log(`[DEBUG] Args: ${args.join(' ')}`);
  console.log(`[DEBUG] PTY cols=${cols}, rows=${rows}`);

  let output = '';
  let exitCode: number | undefined;

  const ptyProcess = pty.spawn(process.execPath, [CLI_PATH, ...args], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: filteredEnv,
  });

  ptyProcess.onData((data) => {
    output += data;
  });

  ptyProcess.onExit(({ exitCode: code }) => {
    exitCode = code;
  });

  // Wait for timeout or process exit
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      ptyProcess.kill();
      resolve();
    }, timeout);

    ptyProcess.onExit(() => {
      clearTimeout(timer);
      resolve();
    });
  });

  return {
    rawOutput: output,
    cleanOutput: stripAnsi(output),
    exitCode,
  };
}
