import { z } from 'zod';
import { spawn } from 'child_process';
import { BaseTool } from '../base-tool.js';
import type {
  ToolExecutionResult,
  ToolExecutionOptions,
  ToolConfirmation,
} from '../types.js';

/**
 * Maximum output size in bytes (1MB)
 * Prevents memory exhaustion from commands like `cat /dev/zero`
 */
const MAX_OUTPUT_SIZE = 1024 * 1024;

/**
 * Dangerous command patterns that should be blocked
 * These patterns indicate potentially malicious intent
 */
const DANGEROUS_PATTERNS = [
  /\brm\s+(-[rf]+\s+)*[\/~]/, // rm -rf / or rm -rf ~
  /\bmkfs\b/,                  // Format filesystem
  /\bdd\s+.*of=\/dev/,         // Write to device
  />\s*\/dev\/sd[a-z]/,        // Redirect to disk device
  /\bchmod\s+777\s+\//,        // chmod 777 on root
  /\bchown\s+.*\s+\//,         // chown on root paths
  /\|.*\bsh\b/,                // Piping to shell
  /\|.*\bbash\b/,              // Piping to bash
  /\bcurl\b.*\|\s*(ba)?sh/,    // curl | bash pattern
  /\bwget\b.*\|\s*(ba)?sh/,    // wget | bash pattern
  /`.*`/,                      // Backtick command substitution
  /\$\(.*\)/,                  // $() command substitution (suspicious in most contexts)
];

/**
 * Check if a command contains dangerous patterns
 */
function isDangerousCommand(command: string): { dangerous: boolean; reason?: string } {
  const normalized = command.toLowerCase();

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        dangerous: true,
        reason: `Command matches dangerous pattern: ${pattern.toString()}`
      };
    }
  }

  return { dangerous: false };
}

const ShellSchema = z.object({
  command: z.string().describe('The shell command to execute'),
  timeout: z
    .number()
    .optional()
    .default(120000)
    .describe('Timeout in milliseconds (default: 120000)'),
});

type ShellParams = z.infer<typeof ShellSchema>;

/**
 * Tool for executing shell commands
 */
export class ShellTool extends BaseTool<ShellParams> {
  readonly name = 'shell';
  readonly description =
    'Execute shell commands in the terminal. Use this tool when you need to run system commands, install packages (npm, pip), run scripts (python, node), compile code, run tests, manage git, or perform any terminal operation. Returns stdout and stderr output. Commands run with stdin disabled, so interactive prompts will fail - pass all inputs via command arguments instead. Default timeout is 2 minutes.';
  readonly schema = ShellSchema;

  getConfirmation(params: ShellParams): ToolConfirmation {
    return {
      required: true,
      type: 'execute',
      message: `Execute command: ${params.command}`,
    };
  }

  async execute(
    params: ShellParams,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    try {
      const cwd = options?.cwd ?? process.cwd();

      // Security check: Block dangerous command patterns
      const dangerCheck = isDangerousCommand(params.command);
      if (dangerCheck.dangerous) {
        return {
          content: `Command blocked for security reasons: ${dangerCheck.reason}`,
          isError: true,
        };
      }

      // For streaming output
      if (options?.onOutput) {
        return this.executeWithStreaming(params, cwd, options);
      }

      // Use spawn instead of exec to support stdio configuration
      // This prevents blocking when subprocess tries to read stdin
      const result = await this.spawnCommand(params.command, cwd, params.timeout);
      return result;
    } catch (error: unknown) {
      const execError = error as {
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: number;
      };
      let output = `Command failed`;
      if (execError.code) output += ` with exit code ${execError.code}`;
      if (execError.stdout) output += `\nstdout: ${execError.stdout}`;
      if (execError.stderr) output += `\nstderr: ${execError.stderr}`;
      if (execError.message && !execError.stdout && !execError.stderr) {
        output += `\n${execError.message}`;
      }

      return {
        content: output,
        isError: true,
      };
    }
  }

  /**
   * Spawn a command with stdin disabled to prevent blocking on input
   */
  private spawnCommand(
    command: string,
    cwd: string,
    timeout?: number
  ): Promise<ToolExecutionResult> {
    return new Promise((resolve) => {
      const child = spawn(command, [], {
        cwd,
        shell: true,
        timeout,
        // Prevent subprocess from blocking on stdin input
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let totalSize = 0;
      let truncated = false;

      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        totalSize += chunk.length;
        if (totalSize <= MAX_OUTPUT_SIZE) {
          stdout += chunk;
        } else if (!truncated) {
          truncated = true;
          stdout += '\n... (output truncated, exceeded 1MB limit)';
        }
      });

      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        totalSize += chunk.length;
        if (totalSize <= MAX_OUTPUT_SIZE) {
          stderr += chunk;
        } else if (!truncated) {
          truncated = true;
          stderr += '\n... (output truncated, exceeded 1MB limit)';
        }
      });

      child.on('close', (code) => {
        let output = stdout;
        if (stderr) output += (output ? '\n' : '') + `stderr: ${stderr}`;

        resolve({
          content: output || '(no output)',
          isError: code !== 0,
          metadata: {
            command,
            cwd,
            exitCode: code,
            truncated,
          },
        });
      });

      child.on('error', (error) => {
        resolve({
          content: `Command failed: ${error.message}`,
          isError: true,
        });
      });
    });
  }

  private executeWithStreaming(
    params: ShellParams,
    cwd: string,
    options: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    return new Promise((resolve) => {
      const child = spawn(params.command, [], {
        cwd,
        shell: true,
        timeout: params.timeout,
        // Prevent subprocess from blocking on stdin input
        // 'ignore' for stdin, 'pipe' for stdout/stderr to capture output
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let totalSize = 0;
      let truncated = false;

      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        totalSize += chunk.length;
        if (totalSize <= MAX_OUTPUT_SIZE) {
          stdout += chunk;
          options.onOutput?.(chunk);
        } else if (!truncated) {
          truncated = true;
          const msg = '\n... (output truncated, exceeded 1MB limit)';
          stdout += msg;
          options.onOutput?.(msg);
        }
      });

      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        totalSize += chunk.length;
        if (totalSize <= MAX_OUTPUT_SIZE) {
          stderr += chunk;
          options.onOutput?.(`stderr: ${chunk}`);
        } else if (!truncated) {
          truncated = true;
          const msg = '\n... (output truncated, exceeded 1MB limit)';
          stderr += msg;
          options.onOutput?.(`stderr: ${msg}`);
        }
      });

      // Handle abort signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          child.kill('SIGTERM');
        });
      }

      child.on('close', (code) => {
        let output = stdout;
        if (stderr) output += (output ? '\n' : '') + `stderr: ${stderr}`;

        resolve({
          content: output || '(no output)',
          isError: code !== 0,
          metadata: {
            command: params.command,
            cwd,
            exitCode: code,
            truncated,
          },
        });
      });

      child.on('error', (error) => {
        resolve({
          content: `Command failed: ${error.message}`,
          isError: true,
        });
      });
    });
  }
}
