import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base-tool.js';
import type {
  ToolExecutionResult,
  ToolExecutionOptions,
  ToolConfirmation,
} from '../types.js';
import { expandTilde } from '../utils.js';

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
    'Write or overwrite content to a file on the filesystem. Use this tool when you need to create a new file, save code, update configuration, or modify existing files. Creates parent directories automatically if they do not exist. Requires an absolute file path. Use read_file first to view existing content before overwriting.';
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
      const expandedPath = expandTilde(params.path);
      const filePath = path.resolve(options?.cwd ?? process.cwd(), expandedPath);

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
