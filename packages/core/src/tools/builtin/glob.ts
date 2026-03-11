import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { BaseTool } from "../base-tool.js";
import type { ToolExecutionResult, ToolExecutionOptions } from "../types.js";
import { expandTilde } from "../utils.js";

const GlobSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files (e.g., "**/*.ts")'),
  path: z
    .string()
    .optional()
    .describe("Directory to search in (defaults to current directory)"),
});

type GlobParams = z.infer<typeof GlobSchema>;

/**
 * Tool for finding files using glob patterns
 */
export class GlobTool extends BaseTool<GlobParams> {
  readonly name = "glob";
  readonly description =
    'Find files matching a glob pattern in the filesystem. Use this tool when you need to discover or list files by name, extension, or path pattern. Examples: "**/*.ts" finds all TypeScript files, "src/**/*.test.js" finds test files in src directory, "*.json" finds JSON files in current directory. Use before read_file to locate files. Does not search file contents - use grep for content search.';
  readonly schema = GlobSchema;

  async execute(
    params: GlobParams,
    options?: ToolExecutionOptions,
  ): Promise<ToolExecutionResult> {
    try {
      const cwd = options?.cwd ?? process.cwd();
      const expandedPath = params.path ? expandTilde(params.path) : undefined;
      const searchPath = expandedPath ? path.resolve(cwd, expandedPath) : cwd;

      // Simple glob implementation - in production use fast-glob
      const matches = await this.simpleGlob(searchPath, params.pattern);

      if (matches.length === 0) {
        return {
          content: `No files matching pattern: ${params.pattern}`,
        };
      }

      // Add strong guidance when many files are found
      const fileList = matches.join("\n");
      let guidance = "";

      if (matches.length > 10) {
        // Use LLM-extracted keywords if available, fall back to simple extraction
        const extractedIntent = options?.context?.extractedIntent as
          | {
              keywords?: string[];
              action?: string;
            }
          | undefined;
        const originalQuery = options?.context?.originalQuery as
          | string
          | undefined;

        const keywords = extractedIntent?.keywords?.length
          ? extractedIntent.keywords
          : originalQuery
            ? this.extractKeywords(originalQuery)
            : [];

        const keywordSuggestion =
          keywords.length > 0
            ? `Suggested: grep("${keywords[0]}") or read files containing "${keywords.join('", "')}" in the name.`
            : 'Use grep("<keyword>") to search for relevant terms.';

        guidance = `\n\n[NEXT STEP] Found ${matches.length} files. ${keywordSuggestion}\nDo NOT describe files - use grep or read_file first.`;
      }

      return {
        content: fileList + guidance,
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

  private async simpleGlob(dir: string, pattern: string): Promise<string[]> {
    const results: string[] = [];
    const regexPattern = this.globToRegex(pattern);

    await this.walkDir(dir, dir, regexPattern, results);

    return results.sort();
  }

  private async walkDir(
    baseDir: string,
    currentDir: string,
    pattern: RegExp,
    results: string[],
  ): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) {
          await this.walkDir(baseDir, fullPath, pattern, results);
        }
      } else if (pattern.test(relativePath)) {
        results.push(relativePath);
      }
    }
  }

  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "{{GLOBSTAR}}")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]")
      .replace(/{{GLOBSTAR}}/g, ".*");

    return new RegExp(`^${escaped}$`);
  }

  /**
   * Extract meaningful keywords from user query for grep suggestions
   */
  private extractKeywords(query: string): string[] {
    // Common stop words to filter out
    const stopWords = new Set([
      "read",
      "find",
      "search",
      "show",
      "list",
      "get",
      "the",
      "a",
      "an",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "and",
      "or",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "can",
      "this",
      "that",
      "these",
      "those",
      "it",
      "its",
      "all",
      "any",
      "some",
      "me",
      "my",
      "i",
      "you",
      "your",
      "we",
      "our",
      "they",
      "their",
      "what",
      "which",
      "who",
      "how",
      "where",
      "when",
      "why",
      "code",
      "file",
      "files",
      "project",
      "directory",
      "folder",
      "understand",
      "explain",
      "about",
      "with",
    ]);

    // Extract words, filter stop words, keep meaningful terms
    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ") // Remove punctuation
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 2 &&
          !stopWords.has(word) &&
          !/^\.+$/.test(word) && // Not just dots
          !/^\d+$/.test(word), // Not just numbers
      );

    // Return unique keywords, max 3
    return [...new Set(words)].slice(0, 3);
  }
}
