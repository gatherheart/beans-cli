/**
 * Message component for displaying chat messages
 *
 * Following claude-code pattern:
 * - Width is passed down for proper text wrapping
 * - Uses wrap="wrap" on Text components
 */

import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { WriteFileMetadata, ToolMetadata } from "@beans/core";
import { MarkdownDisplay } from "./MarkdownDisplay.js";
import { DiffDisplay } from "./DiffDisplay.js";
import { PlanningDisplay } from "./PlanningDisplay.js";
import { ToolCallDisplay } from "./ToolCallDisplay.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";
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

// Tool calls display - only show running tools, completed tools shown as summary
function ToolCalls({
  tools,
  messageId,
}: ToolCallsProps & { messageId: string }): React.ReactElement {
  // Separate running and completed tools
  const runningTools = tools.filter((tool) => !tool.isComplete);
  const completedTools = tools.filter((tool) => tool.isComplete);

  // Collect tools with diff metadata (for write_file)
  const toolsWithDiff = completedTools.filter(
    (tool) => hasDiffMetadata(tool) && isWriteFileMetadata(tool.metadata),
  );

  return (
    <Box flexDirection="column">
      {/* Completed tools summary - collapsed into one line */}
      {completedTools.length > 0 && (
        <Box>
          <Text color={colors.success}>✓ </Text>
          <Text color={colors.muted}>
            {completedTools.map((t) => t.name).join(", ")}
          </Text>
        </Box>
      )}

      {/* Only show currently running tools with spinner */}
      {runningTools.map((tool) => (
        <ToolCallDisplay key={`${messageId}-${tool.id}`} tool={tool} />
      ))}

      {/* Diffs below (for write_file operations) */}
      {toolsWithDiff.map((tool) => {
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
}

export const Message = React.memo(function Message({
  message,
  width,
}: MessageProps): React.ReactElement {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const hasTools = message.toolCalls && message.toolCalls.length > 0;
  const hasPlanning = Boolean(message.planningContent);
  // Account for the prefix (2 chars: symbol + space)
  const textWidth = width ? width - 2 : undefined;

  // Show final response content (separate from planning content)
  // Planning content is shown via PlanningDisplay, content is the final response
  const showContent = Boolean(message.content);
  const showStreamingSpinner =
    message.isStreaming && !message.content && !hasTools && !hasPlanning;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* 1. Tool calls (shown first) */}
      {hasTools && (
        <ToolCalls tools={message.toolCalls!} messageId={message.id} />
      )}

      {/* 1.5. Thinking indicator (when waiting for LLM after tools) */}
      {message.isThinking && (
        <Box marginTop={1}>
          <ThinkingIndicator />
        </Box>
      )}

      {/* 2. Planning content (shown after tools, with spacing) */}
      {hasPlanning && (
        <Box marginTop={hasTools ? 1 : 0}>
          <PlanningDisplay
            content={message.planningContent!}
            isComplete={message.isPlanningComplete ?? false}
          />
        </Box>
      )}

      {/* 3. Final response */}
      {(showContent || showStreamingSpinner) && (
        <Box>
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
              <Text wrap="wrap">{message.content}</Text>
            ) : message.isStreaming ? (
              <Text wrap="wrap">
                {message.content || (
                  <Text color="gray">
                    <Spinner type="dots" />
                  </Text>
                )}
              </Text>
            ) : (
              <MarkdownDisplay text={message.content} width={textWidth} />
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
});
