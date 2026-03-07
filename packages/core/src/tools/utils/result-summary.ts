/**
 * Generates human-readable summaries for tool execution results
 */
import type {
  ToolMetadata,
  GlobMetadata,
  GrepMetadata,
  ReadFileMetadata,
  WriteFileMetadata,
  ShellMetadata,
  DeleteFileMetadata,
  DeleteDirectoryMetadata,
  ListDirectoryMetadata,
  RenameFileMetadata,
  TaskCreateMetadata,
  TaskListMetadata,
  SpawnAgentMetadata,
  TimeoutMetadata,
} from "../types.js";

/**
 * Type guards for metadata types
 */
function isGlobMetadata(m: ToolMetadata): m is GlobMetadata {
  return "pattern" in m && "count" in m;
}

function isGrepMetadata(m: ToolMetadata): m is GrepMetadata {
  return "pattern" in m && "matchCount" in m;
}

function isReadFileMetadata(m: ToolMetadata): m is ReadFileMetadata {
  return "totalLines" in m && "readFrom" in m;
}

function isWriteFileMetadata(m: ToolMetadata): m is WriteFileMetadata {
  return "isNewFile" in m && "newContent" in m && "lineCount" in m;
}

function isShellMetadata(m: ToolMetadata): m is ShellMetadata {
  return "command" in m && "exitCode" in m;
}

function isDeleteFileMetadata(m: ToolMetadata): m is DeleteFileMetadata {
  return "type" in m && m.type === "file";
}

function isDeleteDirectoryMetadata(
  m: ToolMetadata,
): m is DeleteDirectoryMetadata {
  return "type" in m && m.type === "directory" && "entriesDeleted" in m;
}

function isListDirectoryMetadata(m: ToolMetadata): m is ListDirectoryMetadata {
  return "entryCount" in m;
}

function isRenameFileMetadata(m: ToolMetadata): m is RenameFileMetadata {
  return "source" in m && "destination" in m;
}

function isTaskCreateMetadata(m: ToolMetadata): m is TaskCreateMetadata {
  return "taskId" in m;
}

function isTaskListMetadata(m: ToolMetadata): m is TaskListMetadata {
  return "tasks" in m && Array.isArray(m.tasks);
}

function isSpawnAgentMetadata(m: ToolMetadata): m is SpawnAgentMetadata {
  return "agentType" in m && "turnCount" in m;
}

function isTimeoutMetadata(m: ToolMetadata): m is TimeoutMetadata {
  return "timeout" in m && m.timeout === true;
}

/**
 * Count lines in a string
 */
function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Generate a human-readable summary for tool execution results
 *
 * @param toolName - The name of the tool
 * @param result - The raw result string from execution
 * @param metadata - Optional metadata from the tool execution
 * @returns A concise summary string
 */
export function generateResultSummary(
  toolName: string,
  result: string,
  metadata?: ToolMetadata,
): string {
  // Handle metadata-based summaries first
  if (metadata) {
    if (isTimeoutMetadata(metadata)) {
      return `Timed out after ${Math.round(metadata.timeoutMs / 1000)}s`;
    }

    if (isGlobMetadata(metadata)) {
      return `Found ${metadata.count} file${metadata.count !== 1 ? "s" : ""}`;
    }

    if (isGrepMetadata(metadata)) {
      return `${metadata.matchCount} match${metadata.matchCount !== 1 ? "es" : ""}`;
    }

    if (isReadFileMetadata(metadata)) {
      const lines = metadata.readTo - metadata.readFrom + 1;
      return `Read ${lines} line${lines !== 1 ? "s" : ""}`;
    }

    if (isWriteFileMetadata(metadata)) {
      return metadata.isNewFile
        ? `Created (${metadata.lineCount} lines)`
        : `Modified (${metadata.lineCount} lines)`;
    }

    if (isShellMetadata(metadata)) {
      if (metadata.exitCode === 0) {
        return metadata.truncated ? "Success (truncated)" : "Success";
      }
      return `Exit code ${metadata.exitCode}`;
    }

    if (isDeleteFileMetadata(metadata)) {
      return "Deleted";
    }

    if (isDeleteDirectoryMetadata(metadata)) {
      return `Deleted ${metadata.entriesDeleted} entries`;
    }

    if (isListDirectoryMetadata(metadata)) {
      return `${metadata.entryCount} entr${metadata.entryCount !== 1 ? "ies" : "y"}`;
    }

    if (isRenameFileMetadata(metadata)) {
      return "Renamed";
    }

    if (isTaskCreateMetadata(metadata)) {
      return `Created task #${metadata.taskId}`;
    }

    if (isTaskListMetadata(metadata)) {
      return `${metadata.tasks.length} task${metadata.tasks.length !== 1 ? "s" : ""}`;
    }

    if (isSpawnAgentMetadata(metadata)) {
      return `${metadata.agentType} (${metadata.turnCount} turns)`;
    }
  }

  // Fallback: tool-name based heuristics
  const isError =
    result.startsWith("Error:") || result.includes("Access denied");
  if (isError) {
    // Extract first line of error
    const firstLine = result.split("\n")[0];
    return truncate(firstLine, 50);
  }

  // Handle specific tool names without metadata
  switch (toolName) {
    case "glob": {
      const lines = result.split("\n").filter((l) => l.trim());
      return `Found ${lines.length} file${lines.length !== 1 ? "s" : ""}`;
    }
    case "grep": {
      const matches = result.split("\n").filter((l) => l.trim());
      return `${matches.length} match${matches.length !== 1 ? "es" : ""}`;
    }
    case "read_file": {
      const lineCount = countLines(result);
      return `Read ${lineCount} line${lineCount !== 1 ? "s" : ""}`;
    }
    case "write_file":
      return result.includes("Created") ? "Created" : "Modified";
    case "shell":
      return "Completed";
    case "list_directory": {
      const entries = result.split("\n").filter((l) => l.trim());
      return `${entries.length} entr${entries.length !== 1 ? "ies" : "y"}`;
    }
    default: {
      // Default: first line truncated
      const firstLine = result.split("\n")[0].trim();
      return truncate(firstLine, 50) || "Done";
    }
  }
}

/**
 * Format tool arguments into a concise summary string
 *
 * @param args - The tool arguments object
 * @returns A formatted summary like "pattern: **\/*.ts" or "path: src/index.ts"
 */
export function formatArgsSummary(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";

  // Prioritize common argument names
  const priorityKeys = ["pattern", "path", "command", "query", "content"];
  const sortedEntries = entries.sort(([a], [b]) => {
    const aIndex = priorityKeys.indexOf(a);
    const bIndex = priorityKeys.indexOf(b);
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    return 0;
  });

  // Format the main argument(s)
  const formatted = sortedEntries
    .slice(0, 2) // Show at most 2 args
    .map(([key, value]) => {
      const strValue = String(value);
      const truncatedValue = truncate(strValue, 30);
      return `${key}: ${truncatedValue}`;
    })
    .join(", ");

  return formatted;
}
