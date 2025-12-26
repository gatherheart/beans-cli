import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionResult, ToolExecutionOptions } from '../types.js';

const GlobSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files (e.g., "**/*.ts")'),
  path: z
    .string()
    .optional()
    .describe('Directory to search in (defaults to current directory)'),
});

type GlobParams = z.infer<typeof GlobSchema>;

/**
 * Tool for finding files using glob patterns
 */
export class GlobTool extends BaseTool<GlobParams> {
  readonly name = 'glob';
  readonly description =
    'Find files matching a glob pattern. Returns list of matching file paths.';
  readonly schema = GlobSchema;

  async execute(
    params: GlobParams,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    try {
      const cwd = options?.cwd ?? process.cwd();
      const searchPath = params.path ? path.resolve(cwd, params.path) : cwd;

      // Simple glob implementation - in production use fast-glob
      const matches = await this.simpleGlob(searchPath, params.pattern);

      if (matches.length === 0) {
        return {
          content: `No files matching pattern: ${params.pattern}`,
        };
      }

      return {
        content: matches.join('\n'),
        metadata: {
          pattern: params.pattern,
          path: searchPath,
          count: matches.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error searching files: ${message}`,
        isError: true,
      };
    }
  }

  private async simpleGlob(
    dir: string,
    pattern: string
  ): Promise<string[]> {
    const results: string[] = [];
    const regexPattern = this.globToRegex(pattern);

    await this.walkDir(dir, dir, regexPattern, results);

    return results.sort();
  }

  private async walkDir(
    baseDir: string,
    currentDir: string,
    pattern: RegExp,
    results: string[]
  ): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          await this.walkDir(baseDir, fullPath, pattern, results);
        }
      } else if (pattern.test(relativePath)) {
        results.push(relativePath);
      }
    }
  }

  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/{{GLOBSTAR}}/g, '.*');

    return new RegExp(`^${escaped}$`);
  }
}
