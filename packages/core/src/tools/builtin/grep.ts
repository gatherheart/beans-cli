import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { BaseTool } from "../base-tool.js";
import type { ToolExecutionResult, ToolExecutionOptions } from "../types.js";

const GrepSchema = z.object({
  pattern: z.string().describe("Regular expression pattern to search for"),
  path: z
    .string()
    .optional()
    .describe("File or directory to search in (defaults to current directory)"),
  glob: z
    .string()
    .optional()
    .describe('Glob pattern to filter files (e.g., "*.ts")'),
  caseInsensitive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Case insensitive search"),
  maxResults: z
    .number()
    .optional()
    .default(100)
    .describe("Maximum number of results to return"),
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
  readonly name = "grep";
  readonly description =
    "Search for text or regex patterns inside file contents. Use this tool when you need to find code, function definitions, variable usage, error messages, or any text pattern within files. Returns matching lines with file paths and line numbers. Supports regex patterns and case-insensitive search. Use glob filter to limit search to specific file types. Unlike glob which searches file names, grep searches inside files.";
  readonly schema = GrepSchema;

  async execute(
    params: GrepParams,
    options?: ToolExecutionOptions,
  ): Promise<ToolExecutionResult> {
    try {
      const cwd = options?.cwd ?? process.cwd();
      const searchPath = params.path ? path.resolve(cwd, params.path) : cwd;
      const extractedIntent = options?.context?.extractedIntent as
        | { keywords?: string[] }
        | undefined;
      const keywords =
        extractedIntent?.keywords?.map((keyword) => keyword.toLowerCase()) ??
        [];

      const regex = new RegExp(
        params.pattern,
        params.caseInsensitive ? "gi" : "g",
      );

      const matches: GrepMatch[] = [];
      await this.searchDirectory(
        searchPath,
        regex,
        params.glob,
        matches,
        params.maxResults ?? 100,
      );

      if (matches.length === 0) {
        return {
          content: `No matches found for pattern: ${params.pattern}`,
        };
      }

      const rankedMatches = this.rankMatches(matches, keywords);
      const topFiles = this.buildTopFileSuggestions(rankedMatches, keywords);

      const output = rankedMatches
        .map((m) => `${m.file}:${m.line}: ${m.content.trim()}`)
        .join("\n");

      const topFileSection =
        topFiles.length > 0
          ? `\n\n[TOP FILES]\n${topFiles
              .map(
                (file, index) =>
                  `${index + 1}. ${file.file} (${file.matchCount} matches) -> read_file(path="${file.file}", offset=${file.offset}, limit=${file.limit})`,
              )
              .join("\n")}`
          : "";

      const nextStep =
        topFiles.length > 0
          ? "\n\n[NEXT STEP] Read the top files around the suggested line ranges before answering."
          : "";

      return {
        content: output + topFileSection + nextStep,
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
    maxResults: number,
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
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) {
          await this.searchDirectory(
            fullPath,
            pattern,
            glob,
            matches,
            maxResults,
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
    maxResults: number,
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

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
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");

    return new RegExp(`^${pattern}$`).test(filename);
  }

  private rankMatches(matches: GrepMatch[], keywords: string[]): GrepMatch[] {
    return [...matches].sort((a, b) => {
      const scoreDiff =
        this.pathKeywordScore(b.file, keywords) -
        this.pathKeywordScore(a.file, keywords);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      if (a.file !== b.file) {
        return a.file.localeCompare(b.file);
      }

      return a.line - b.line;
    });
  }

  private pathKeywordScore(filePath: string, keywords: string[]): number {
    if (keywords.length === 0) {
      return 0;
    }

    const normalizedPath = filePath.toLowerCase();
    return keywords.reduce((score, keyword) => {
      if (normalizedPath.includes(keyword)) {
        return score + 2;
      }
      return score;
    }, 0);
  }

  private buildTopFileSuggestions(matches: GrepMatch[], keywords: string[]) {
    const grouped = new Map<string, GrepMatch[]>();
    for (const match of matches) {
      const existing = grouped.get(match.file) ?? [];
      existing.push(match);
      grouped.set(match.file, existing);
    }

    return Array.from(grouped.entries())
      .map(([file, fileMatches]) => {
        const minLine = Math.min(...fileMatches.map((match) => match.line));
        const maxLine = Math.max(...fileMatches.map((match) => match.line));
        return {
          file,
          matchCount: fileMatches.length,
          offset: Math.max(1, minLine - 5),
          limit: Math.min(80, maxLine - minLine + 15),
          relevance: this.pathKeywordScore(file, keywords),
        };
      })
      .sort((a, b) => {
        if (b.relevance !== a.relevance) {
          return b.relevance - a.relevance;
        }
        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount;
        }
        return a.file.localeCompare(b.file);
      })
      .slice(0, 3);
  }
}
