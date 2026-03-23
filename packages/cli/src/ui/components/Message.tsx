/**
 * Message component for displaying chat messages
 *
 * Following claude-code pattern:
 * - Width is passed down for proper text wrapping
 * - Uses wrap="wrap" on Text components
 */

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { WriteFileMetadata, ToolMetadata } from "@beans/core";
import { MarkdownDisplay } from "./MarkdownDisplay.js";
import { DiffDisplay } from "./DiffDisplay.js";
import { PlanningDisplay } from "./PlanningDisplay.js";
import { colors } from "../theme/colors.js";
import type {
  Message as MessageType,
  ToolCallInfo,
} from "../contexts/ChatContext.js";

interface MessageProps {
  message: MessageType;
  width?: number;
}

interface ToolCallsProps {
  tools: ToolCallInfo[];
  showDiffs: boolean;
}

interface MessageBodyProps {
  role: MessageType["role"];
  content: string;
  isStreaming: boolean;
  width?: number;
  marginTop?: number;
}

/**
 * Type guard to check if metadata is WriteFileMetadata
 */
function isWriteFileMetadata(
  metadata: ToolMetadata | undefined,
): metadata is WriteFileMetadata {
  if (!metadata) return false;
  const m = metadata as WriteFileMetadata;
  return (
    typeof m.path === "string" &&
    typeof m.newContent === "string" &&
    typeof m.isNewFile === "boolean"
  );
}

/**
 * Check if tool call has diff metadata (from write_file)
 */
function hasDiffMetadata(tool: ToolCallInfo): boolean {
  return (
    tool.name === "write_file" &&
    tool.isComplete &&
    isWriteFileMetadata(tool.metadata)
  );
}

/**
 * Format completed tools summary - group by name with count
 * e.g., "read_file (5), glob (2), grep" instead of "read_file, read_file, read_file..."
 */
function formatCompletedToolsSummary(tools: ToolCallInfo[]): string {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    counts.set(tool.name, (counts.get(tool.name) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => (count > 1 ? `${name} (${count})` : name))
    .join(", ");
}

// Tool calls display - show completed tools with checkmark, spinner when processing
const ToolCalls = React.memo(function ToolCalls({
  tools,
  showDiffs,
  messageId,
}: ToolCallsProps & { messageId: string }): React.ReactElement {
  // Memoize computed values to avoid re-computation on every render
  const { hasRunningTools, completedTools, toolsWithDiff, toolsSummary } =
    useMemo(() => {
      const running = tools.some((tool) => !tool.isComplete);
      const completed = tools.filter((tool) => tool.isComplete);
      const withDiff = completed.filter(
        (tool) => hasDiffMetadata(tool) && isWriteFileMetadata(tool.metadata),
      );
      const summary = formatCompletedToolsSummary(completed);
      return {
        hasRunningTools: running,
        completedTools: completed,
        toolsWithDiff: withDiff,
        toolsSummary: summary,
      };
    }, [tools]);

  return (
    <Box flexDirection="column">
      {/* Single line: spinner (if running) + completed summary */}
      {(completedTools.length > 0 || hasRunningTools) && (
        <Box>
          {/* Keep tool status static; the footer status bar owns animation. */}
          {hasRunningTools && <Text color={colors.warning}>... </Text>}
          {/* Show checkmark when tools completed and none running */}
          {completedTools.length > 0 && !hasRunningTools && (
            <Text color={colors.success}>✓ </Text>
          )}
          {/* Show completed tools summary */}
          {completedTools.length > 0 && (
            <Text color={colors.muted}>{toolsSummary}</Text>
          )}
        </Box>
      )}

      {/* Diffs below (for write_file operations) */}
      {showDiffs &&
        toolsWithDiff.map((tool) => {
          const metadata = tool.metadata as WriteFileMetadata;
          return (
            <DiffDisplay
              key={`${messageId}-${tool.id}-diff`}
              originalContent={metadata.originalContent}
              newContent={metadata.newContent}
              filePath={metadata.path}
              isNewFile={metadata.isNewFile}
            />
          );
        })}
    </Box>
  );
});

const MessageBody = React.memo(function MessageBody({
  role,
  content,
  isStreaming,
  width,
  marginTop = 0,
}: MessageBodyProps): React.ReactElement | null {
  if (!content) {
    return null;
  }

  const isUser = role === "user";
  const isSystem = role === "system";
  // Account for the prefix (2 chars: symbol + space)
  const textWidth = width ? width - 2 : undefined;

  return (
    <Box marginTop={marginTop}>
      {isUser ? (
        <Text color={colors.user} bold>
          {"> "}
        </Text>
      ) : isSystem ? (
        <Text color={colors.system} bold>
          {"\u2139 "}
        </Text>
      ) : (
        <Text color={colors.assistant} bold>
          {"\u2726 "}
        </Text>
      )}

      <Box flexDirection="column" width={textWidth}>
        {isUser ? (
          <Text wrap="wrap">{content}</Text>
        ) : isStreaming ? (
          <Text wrap="wrap">{content}</Text>
        ) : (
          <MarkdownDisplay text={content} width={textWidth} />
        )}
      </Box>
    </Box>
  );
});

const MessageFooter = React.memo(function MessageFooter({
  planningContent,
  isPlanningComplete,
  tools,
  messageId,
  showAfterBody,
  isSettled,
}: {
  planningContent?: string;
  isPlanningComplete?: boolean;
  tools?: ToolCallInfo[];
  messageId: string;
  showAfterBody: boolean;
  isSettled: boolean;
}): React.ReactElement | null {
  const hasPlanning = Boolean(planningContent);
  const hasTools = Boolean(tools && tools.length > 0);
  const hasRunningTools = Boolean(tools?.some((tool) => !tool.isComplete));

  if (!hasPlanning && !hasTools) {
    return null;
  }

  if (!isSettled) {
    if (hasRunningTools || hasTools) {
      return (
        <Box flexDirection="column">
          <Box marginTop={showAfterBody ? 1 : 0}>
            <ToolCalls tools={tools!} showDiffs={false} messageId={messageId} />
          </Box>
        </Box>
      );
    }

    if (hasPlanning) {
      return (
        <Box flexDirection="column">
          <Box marginTop={showAfterBody ? 1 : 0}>
            <PlanningDisplay
              content={planningContent!}
              isComplete={isPlanningComplete ?? false}
            />
          </Box>
        </Box>
      );
    }
  }

  return (
    <Box flexDirection="column">
      {hasPlanning && (
        <Box marginTop={showAfterBody ? 1 : 0}>
          <PlanningDisplay
            content={planningContent!}
            isComplete={isPlanningComplete ?? false}
          />
        </Box>
      )}

      {hasTools && (
        <Box marginTop={showAfterBody || hasPlanning ? 1 : 0}>
          <ToolCalls tools={tools!} showDiffs={true} messageId={messageId} />
        </Box>
      )}
    </Box>
  );
});

export const Message = React.memo(function Message({
  message,
  width,
}: MessageProps): React.ReactElement {
  const showContent = Boolean(message.content);
  const hasLivePlanning = Boolean(
    message.planningContent && !message.isPlanningComplete,
  );
  const hasRunningTools = Boolean(
    message.toolCalls?.some((tool) => !tool.isComplete),
  );
  const isSettled =
    !message.isStreaming &&
    !message.isThinking &&
    !hasLivePlanning &&
    !hasRunningTools;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <MessageBody
        role={message.role}
        content={message.content}
        isStreaming={message.isStreaming}
        width={width}
      />
      <MessageFooter
        planningContent={message.planningContent}
        isPlanningComplete={message.isPlanningComplete}
        tools={message.toolCalls}
        messageId={message.id}
        showAfterBody={showContent}
        isSettled={isSettled}
      />
    </Box>
  );
});
