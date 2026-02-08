import { z } from 'zod';
import { spawn } from 'child_process';
import { BaseTool } from '../base-tool.js';
import type {
  ToolExecutionResult,
  ToolExecutionOptions,
  ToolConfirmation,
} from '../types.js';

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

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
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

      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        options.onOutput?.(chunk);
      });

      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        options.onOutput?.(`stderr: ${chunk}`);
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
