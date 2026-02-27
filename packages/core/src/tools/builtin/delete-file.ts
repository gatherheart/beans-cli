import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { BaseTool } from "../base-tool.js";
import type { ToolExecutionResult, ToolExecutionOptions } from "../types.js";
import { validatePath } from "../utils/path-validator.js";

const DeleteFileSchema = z.object({
  path: z
    .string()
    .describe(
      "Path to the file or directory to delete (absolute or relative to current working directory)",
    ),
  recursive: z
    .boolean()
    .optional()
    .describe(
      "Delete directories and their contents recursively (required for non-empty directories)",
    ),
});

type DeleteFileParams = z.infer<typeof DeleteFileSchema>;

/**
 * Tool for deleting files and directories
 */
export class DeleteFileTool extends BaseTool<DeleteFileParams> {
  readonly name = "delete_file";
  readonly description =
    "Delete a file or directory. For directories, use recursive=true to delete non-empty directories and all their contents. Be careful as this action cannot be undone.";
  readonly schema = DeleteFileSchema;

  async execute(
    params: DeleteFileParams,
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

      const targetPath = validation.resolvedPath;

      // Check if path exists
      let stats;
      try {
        stats = await fs.stat(targetPath);
      } catch {
        return {
          content: `Path does not exist: ${params.path}`,
          isError: true,
        };
      }

      // Safety check: prevent deleting project root or important directories
      const relativePath = path.relative(cwd, targetPath);
      if (relativePath === "" || relativePath === ".") {
        return {
          content: "Cannot delete the project root directory",
          isError: true,
        };
      }

      // Additional safety checks for critical paths
      const criticalDirs = [".git", "node_modules", ".beans"];
      const pathParts = relativePath.split(path.sep);
      if (pathParts.length === 1 && criticalDirs.includes(pathParts[0])) {
        return {
          content: `Refusing to delete critical directory: ${pathParts[0]}. This could cause significant issues.`,
          isError: true,
        };
      }

      if (stats.isDirectory()) {
        // Check if directory is empty
        const entries = await fs.readdir(targetPath);
        if (entries.length > 0 && !params.recursive) {
          return {
            content: `Directory is not empty: ${params.path}. Use recursive=true to delete it and all contents.`,
            isError: true,
          };
        }

        // Delete directory
        await fs.rm(targetPath, { recursive: true, force: true });
        return {
          content: `Successfully deleted directory: ${relativePath}`,
          metadata: {
            path: targetPath,
            type: "directory",
            entriesDeleted: entries.length,
          },
        };
      } else {
        // Delete file
        await fs.unlink(targetPath);
        return {
          content: `Successfully deleted file: ${relativePath}`,
          metadata: {
            path: targetPath,
            type: "file",
          },
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error deleting: ${message}`,
        isError: true,
      };
    }
  }
}
