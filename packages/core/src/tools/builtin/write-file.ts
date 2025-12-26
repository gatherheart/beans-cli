import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base-tool.js';
import type {
  ToolExecutionResult,
  ToolExecutionOptions,
  ToolConfirmation,
} from '../types.js';

const WriteFileSchema = z.object({
  path: z.string().describe('Absolute path to the file to write'),
  content: z.string().describe('Content to write to the file'),
  createDirectories: z
    .boolean()
    .optional()
    .default(true)
    .describe('Create parent directories if they do not exist'),
});

type WriteFileParams = z.infer<typeof WriteFileSchema>;

/**
 * Tool for writing content to files
 */
export class WriteFileTool extends BaseTool<WriteFileParams> {
  readonly name = 'write_file';
  readonly description =
    'Write content to a file. Creates the file if it does not exist.';
  readonly schema = WriteFileSchema;

  getConfirmation(params: WriteFileParams): ToolConfirmation {
    return {
      required: true,
      type: 'write',
      message: `Write to file: ${params.path}`,
    };
  }

  async execute(
    params: WriteFileParams,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    try {
      const filePath = path.resolve(options?.cwd ?? process.cwd(), params.path);

      // Create parent directories if needed
      if (params.createDirectories) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
      }

      await fs.writeFile(filePath, params.content, 'utf-8');

      const lineCount = params.content.split('\n').length;

      return {
        content: `Successfully wrote ${lineCount} lines to ${filePath}`,
        metadata: {
          path: filePath,
          lineCount,
          size: Buffer.byteLength(params.content, 'utf-8'),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error writing file: ${message}`,
        isError: true,
      };
    }
  }
}
