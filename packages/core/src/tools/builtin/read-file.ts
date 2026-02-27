import { z } from 'zod';
import * as fs from 'fs/promises';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionResult, ToolExecutionOptions } from '../types.js';
import { validatePath } from '../utils/path-validator.js';

const ReadFileSchema = z.object({
  path: z.string().describe('Path to the file to read (absolute or relative to current working directory)'),
  offset: z
    .number()
    .optional()
    .describe('Line number to start reading from (1-based)'),
  limit: z.number().optional().describe('Number of lines to read'),
});

type ReadFileParams = z.infer<typeof ReadFileSchema>;

/**
 * Tool for reading file contents
 */
export class ReadFileTool extends BaseTool<ReadFileParams> {
  readonly name = 'read_file';
  readonly description =
    'Read the contents of a file from the filesystem. Use this tool when you need to view, analyze, or understand the content of a specific file. Returns the file content with line numbers. Supports reading partial files using offset and limit parameters for large files. Use glob tool first if you need to find files, then read_file to view their contents.';
  readonly schema = ReadFileSchema;

  async execute(
    params: ReadFileParams,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    try {
      const cwd = options?.cwd ?? process.cwd();

      // Validate path to prevent traversal attacks
      const validation = await validatePath(params.path, {
        cwd,
        allowOutsideProject: false,
        allowHomeAccess: false,
      });

      if (!validation.valid) {
        return {
          content: `Access denied: ${validation.error}`,
          isError: true,
        };
      }

      const filePath = validation.resolvedPath;
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const offset = params.offset ?? 1;
      const limit = params.limit ?? lines.length;

      const startIndex = Math.max(0, offset - 1);
      const endIndex = Math.min(lines.length, startIndex + limit);
      const selectedLines = lines.slice(startIndex, endIndex);

      // Format with line numbers
      const numberedLines = selectedLines.map(
        (line, idx) => `${startIndex + idx + 1}: ${line}`
      );

      return {
        content: numberedLines.join('\n'),
        metadata: {
          path: filePath,
          totalLines: lines.length,
          readFrom: startIndex + 1,
          readTo: endIndex,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error reading file: ${message}`,
        isError: true,
      };
    }
  }
}
