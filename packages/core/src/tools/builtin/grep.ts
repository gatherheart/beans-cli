import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionResult, ToolExecutionOptions } from '../types.js';

const GrepSchema = z.object({
  pattern: z.string().describe('Regular expression pattern to search for'),
  path: z
    .string()
    .optional()
    .describe('File or directory to search in (defaults to current directory)'),
  glob: z
    .string()
    .optional()
    .describe('Glob pattern to filter files (e.g., "*.ts")'),
  caseInsensitive: z
    .boolean()
    .optional()
    .default(false)
    .describe('Case insensitive search'),
  maxResults: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of results to return'),
});

type GrepParams = z.infer<typeof GrepSchema>;

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

/**
 * Tool for searching file contents
 */
export class GrepTool extends BaseTool<GrepParams> {
  readonly name = 'grep';
  readonly description =
    'Search for a pattern in files. Returns matching lines with file paths and line numbers.';
  readonly schema = GrepSchema;

  async execute(
    params: GrepParams,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    try {
      const cwd = options?.cwd ?? process.cwd();
      const searchPath = params.path ? path.resolve(cwd, params.path) : cwd;

      const regex = new RegExp(
        params.pattern,
        params.caseInsensitive ? 'gi' : 'g'
      );

      const matches: GrepMatch[] = [];
      await this.searchDirectory(
        searchPath,
        regex,
        params.glob,
        matches,
        params.maxResults ?? 100
      );

      if (matches.length === 0) {
        return {
          content: `No matches found for pattern: ${params.pattern}`,
        };
      }

      const output = matches
        .map((m) => `${m.file}:${m.line}: ${m.content.trim()}`)
        .join('\n');

      return {
        content: output,
        metadata: {
          pattern: params.pattern,
          path: searchPath,
          matchCount: matches.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error searching: ${message}`,
        isError: true,
      };
    }
  }

  private async searchDirectory(
    dir: string,
    pattern: RegExp,
    glob: string | undefined,
    matches: GrepMatch[],
    maxResults: number
  ): Promise<void> {
    if (matches.length >= maxResults) return;

    const stat = await fs.stat(dir);

    if (stat.isFile()) {
      await this.searchFile(dir, pattern, matches, maxResults);
      return;
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (matches.length >= maxResults) break;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          await this.searchDirectory(
            fullPath,
            pattern,
            glob,
            matches,
            maxResults
          );
        }
      } else if (this.matchesGlob(entry.name, glob)) {
        await this.searchFile(fullPath, pattern, matches, maxResults);
      }
    }
  }

  private async searchFile(
    filePath: string,
    pattern: RegExp,
    matches: GrepMatch[],
    maxResults: number
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
        if (pattern.test(lines[i])) {
          matches.push({
            file: filePath,
            line: i + 1,
            content: lines[i],
          });
        }
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
      }
    } catch {
      // Skip files that can't be read (binary files, etc.)
    }
  }

  private matchesGlob(filename: string, glob?: string): boolean {
    if (!glob) return true;

    // Simple glob matching for common patterns
    const pattern = glob
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${pattern}$`).test(filename);
  }
}
