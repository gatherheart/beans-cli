import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { BaseTool } from "../base-tool.js";
import type { ToolExecutionResult, ToolExecutionOptions } from "../types.js";
import { validatePath } from "../utils/path-validator.js";

const ListDirectorySchema = z.object({
  path: z
    .string()
    .describe(
      "Path to the directory to list (absolute or relative to current working directory)",
    ),
  showHidden: z
    .boolean()
    .optional()
    .describe("Include hidden files (starting with .) in the listing"),
  details: z
    .boolean()
    .optional()
    .describe("Show detailed information (size, modified date) for each entry"),
});

type ListDirectoryParams = z.infer<typeof ListDirectorySchema>;

/**
 * Tool for listing directory contents
 */
export class ListDirectoryTool extends BaseTool<ListDirectoryParams> {
  readonly name = "list_directory";
  readonly description =
    "List the contents of a directory. Returns files and subdirectories with optional details like size and modification date. Use this to explore the structure of a project or find specific files within a directory.";
  readonly schema = ListDirectorySchema;

  async execute(
    params: ListDirectoryParams,
    options?: ToolExecutionOptions,
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

      const dirPath = validation.resolvedPath;

      // Check if path is a directory
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        return {
          content: `Error: ${params.path} is not a directory`,
          isError: true,
        };
      }

      // Read directory contents
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      // Filter hidden files if needed
      const filteredEntries = params.showHidden
        ? entries
        : entries.filter((e) => !e.name.startsWith("."));

      // Sort: directories first, then files, both alphabetically
      const sorted = filteredEntries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      if (params.details) {
        // Detailed listing with size and date
        const lines: string[] = [];
        for (const entry of sorted) {
          const entryPath = path.join(dirPath, entry.name);
          try {
            const entryStats = await fs.stat(entryPath);
            const type = entry.isDirectory() ? "d" : "-";
            const size = entry.isDirectory()
              ? "-"
              : formatSize(entryStats.size);
            const modified = entryStats.mtime.toISOString().split("T")[0];
            const name = entry.isDirectory() ? `${entry.name}/` : entry.name;
            lines.push(`${type} ${size.padStart(10)} ${modified} ${name}`);
          } catch {
            // Skip entries we can't stat
            const name = entry.isDirectory() ? `${entry.name}/` : entry.name;
            lines.push(`? ${"-".padStart(10)} ---------- ${name}`);
          }
        }
        return {
          content: lines.join("\n") || "(empty directory)",
          metadata: {
            path: dirPath,
            entryCount: sorted.length,
          },
        };
      } else {
        // Simple listing
        const lines = sorted.map((entry) =>
          entry.isDirectory() ? `${entry.name}/` : entry.name,
        );
        return {
          content: lines.join("\n") || "(empty directory)",
          metadata: {
            path: dirPath,
            entryCount: sorted.length,
          },
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error listing directory: ${message}`,
        isError: true,
      };
    }
  }
}

/**
 * Format file size in human-readable format
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}
