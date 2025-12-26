import { z } from 'zod';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from '../base-tool.js';
import type {
  ToolExecutionResult,
  ToolExecutionOptions,
  ToolConfirmation,
} from '../types.js';

const execAsync = promisify(exec);

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
    'Execute a shell command. Returns stdout and stderr output.';
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

      const { stdout, stderr } = await execAsync(params.command, {
        cwd,
        timeout: params.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += (output ? '\n' : '') + `stderr: ${stderr}`;

      return {
        content: output || '(no output)',
        metadata: {
          command: params.command,
          cwd,
        },
      };
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
