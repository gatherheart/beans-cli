import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { BaseTool } from '../base-tool.js';
import type {
  ToolExecutionResult,
  ToolExecutionOptions,
  ToolConfirmation,
} from '../types.js';

const SaveMemorySchema = z.object({
  content: z.string().describe('The content to save to memory. This will be appended to the BEANS.md file.'),
  target: z
    .enum(['global', 'project'])
    .default('project')
    .describe('Where to save the memory: "global" saves to ~/.beans/BEANS.md (applies to all projects), "project" saves to ./BEANS.md (applies only to current project)'),
  section: z
    .string()
    .optional()
    .describe('Optional section header to add the content under (e.g., "## Coding Style"). If not provided, content is appended to the end.'),
});

type SaveMemoryParams = z.infer<typeof SaveMemorySchema>;

/**
 * Tool for saving persistent instructions to memory files
 *
 * Memory files (BEANS.md) are loaded into the system prompt at session start
 * and provide persistent instructions across sessions.
 */
export class SaveMemoryTool extends BaseTool<SaveMemoryParams> {
  readonly name = 'save_memory';
  readonly description =
    'Save persistent instructions to memory. Memory content is loaded into the system prompt at session start and persists across sessions. Use "project" target for project-specific instructions (./BEANS.md), or "global" target for instructions that apply to all projects (~/.beans/BEANS.md). Use this tool when the user asks you to remember something for future sessions or wants to save coding preferences, project guidelines, or other persistent context.';
  readonly schema = SaveMemorySchema;

  getConfirmation(params: SaveMemoryParams): ToolConfirmation {
    const targetPath = params.target === 'global'
      ? '~/.beans/BEANS.md'
      : './BEANS.md';
    return {
      required: true,
      type: 'write',
      message: `Save memory to ${targetPath}${params.section ? ` (section: ${params.section})` : ''}`,
    };
  }

  async execute(
    params: SaveMemoryParams,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    try {
      const cwd = options?.cwd ?? process.cwd();

      // Determine the file path based on target
      const filePath = params.target === 'global'
        ? path.join(homedir(), '.beans', 'BEANS.md')
        : path.join(cwd, 'BEANS.md');

      // Ensure parent directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Read existing content
      let existingContent = '';
      try {
        existingContent = await fs.readFile(filePath, 'utf-8');
      } catch {
        // File doesn't exist - will create new
      }

      // Prepare the content to append
      let contentToAppend = params.content.trim();

      // If section is specified, add it as a header
      if (params.section) {
        // Ensure section starts with ## if it doesn't already
        const sectionHeader = params.section.startsWith('#')
          ? params.section
          : `## ${params.section}`;

        // Check if section already exists in the file
        const sectionRegex = new RegExp(`^${sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
        if (sectionRegex.test(existingContent)) {
          // Section exists - append content after it
          const lines = existingContent.split('\n');
          const sectionIndex = lines.findIndex(line => line.trim() === sectionHeader.trim());

          if (sectionIndex !== -1) {
            // Find the next section or end of file
            let nextSectionIndex = lines.length;
            for (let i = sectionIndex + 1; i < lines.length; i++) {
              if (lines[i].startsWith('#')) {
                nextSectionIndex = i;
                break;
              }
            }

            // Insert content before the next section
            lines.splice(nextSectionIndex, 0, '', contentToAppend);
            const newContent = lines.join('\n');

            await fs.writeFile(filePath, newContent, 'utf-8');

            return {
              content: `Successfully appended content to section "${params.section}" in ${filePath}`,
              metadata: {
                path: filePath,
                target: params.target,
                section: params.section,
                contentLength: contentToAppend.length,
              },
            };
          }
        } else {
          // Section doesn't exist - create it with content
          contentToAppend = `${sectionHeader}\n\n${contentToAppend}`;
        }
      }

      // Append to file
      const separator = existingContent && !existingContent.endsWith('\n\n')
        ? (existingContent.endsWith('\n') ? '\n' : '\n\n')
        : '';
      const newContent = existingContent + separator + contentToAppend + '\n';

      await fs.writeFile(filePath, newContent, 'utf-8');

      return {
        content: `Successfully saved memory to ${filePath}`,
        metadata: {
          path: filePath,
          target: params.target,
          section: params.section,
          contentLength: contentToAppend.length,
          isNewFile: !existingContent,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error saving memory: ${message}`,
        isError: true,
      };
    }
  }
}
