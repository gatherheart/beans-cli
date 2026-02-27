import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { BaseTool } from "../base-tool.js";
import type { ToolExecutionResult, ToolExecutionOptions } from "../types.js";
import { validatePath } from "../utils/path-validator.js";

const RenameFileSchema = z.object({
  source: z
    .string()
    .describe(
      "Current path of the file or directory (absolute or relative to current working directory)",
    ),
  destination: z
    .string()
    .describe(
      "New path for the file or directory (absolute or relative to current working directory)",
    ),
  overwrite: z
    .boolean()
    .optional()
    .describe("Overwrite destination if it already exists (default: false)"),
});

type RenameFileParams = z.infer<typeof RenameFileSchema>;

/**
 * Tool for renaming or moving files and directories
 */
export class RenameFileTool extends BaseTool<RenameFileParams> {
  readonly name = "rename_file";
  readonly description =
    "Rename or move a file or directory. Can be used to rename files in place or move them to a different location. Use this for reorganizing project structure or renaming files.";
  readonly schema = RenameFileSchema;

  async execute(
    params: RenameFileParams,
    options?: ToolExecutionOptions,
  ): Promise<ToolExecutionResult> {
    try {
      const cwd = options?.cwd ?? process.cwd();

      // Validate source path
      const sourceValidation = await validatePath(params.source, {
        cwd,
        allowOutsideProject: false,
        allowHomeAccess: false,
      });

      if (!sourceValidation.valid) {
        return {
          content: `Access denied for source: ${sourceValidation.error}`,
          isError: true,
        };
      }

      // Validate destination path
      const destValidation = await validatePath(params.destination, {
        cwd,
        allowOutsideProject: false,
        allowHomeAccess: false,
      });

      if (!destValidation.valid) {
        return {
          content: `Access denied for destination: ${destValidation.error}`,
          isError: true,
        };
      }

      const sourcePath = sourceValidation.resolvedPath;
      const destPath = destValidation.resolvedPath;

      // Check if source exists
      try {
        await fs.access(sourcePath);
      } catch {
        return {
          content: `Source does not exist: ${params.source}`,
          isError: true,
        };
      }

      // Check if destination exists (unless overwrite is true)
      if (!params.overwrite) {
        try {
          await fs.access(destPath);
          return {
            content: `Destination already exists: ${params.destination}. Set overwrite=true to replace it.`,
            isError: true,
          };
        } catch {
          // Good, destination doesn't exist
        }
      }

      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await fs.mkdir(destDir, { recursive: true });

      // Perform the rename/move
      await fs.rename(sourcePath, destPath);

      const sourceRelative = path.relative(cwd, sourcePath);
      const destRelative = path.relative(cwd, destPath);

      return {
        content: `Successfully renamed: ${sourceRelative} → ${destRelative}`,
        metadata: {
          source: sourcePath,
          destination: destPath,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error renaming file: ${message}`,
        isError: true,
      };
    }
  }
}
