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
import { MarkdownDisplay } from "./MarkdownDisplay.js";
import { DiffDisplay } from "./DiffDisplay.js";
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

// Check if tool call has diff metadata (from write_file)
function hasDiffMetadata(tool: ToolCallInfo): boolean {
  return (
    tool.name === "write_file" &&
    tool.isComplete &&
    tool.metadata !== undefined &&
    typeof tool.metadata.newContent === "string"
  );
}

// Individual tool display - no memoization to ensure updates
function ToolCallItem({ tool }: { tool: ToolCallInfo }) {
  const showDiff = hasDiffMetadata(tool);
  // Use status-based colors: green for success, red for error, gray for in-progress
  const hasError =
    tool.result?.startsWith("Error:") || tool.result?.includes("Access denied");
  const statusColor = tool.isComplete
    ? hasError
      ? colors.error
      : colors.success
    : colors.muted;

  return (
    <Box flexDirection="column">
      <Box>
        {tool.isComplete ? (
          <Text color={hasError ? colors.error : colors.success}>
            {hasError ? "✗ " : "✓ "}
          </Text>
        ) : (
          <Text color={colors.warning}>⠋ </Text>
        )}
        <Text color={statusColor}>{tool.name}</Text>
      </Box>
      {showDiff && (
        <DiffDisplay
          originalContent={tool.metadata?.originalContent as string | null}
          newContent={tool.metadata?.newContent as string}
          filePath={tool.metadata?.path as string}
          isNewFile={tool.metadata?.isNewFile as boolean}
        />
      )}
    </Box>
  );
}

// Tool calls display - single spinner for all in-progress tools
function ToolCalls({
  tools,
  messageId,
}: ToolCallsProps & { messageId: string }): React.ReactElement {
  const hasInProgress = tools.some((t) => !t.isComplete);

  return (
    <Box gap={1}>
      {hasInProgress && (
        <Text color={colors.warning}>
          <Spinner type="dots" />
        </Text>
      )}
      {tools.map((tool) => (
        <ToolCallItem key={`${messageId}-${tool.id}`} tool={tool} />
      ))}
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
  // Account for the prefix (2 chars: symbol + space)
  const textWidth = width ? width - 2 : undefined;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Tool calls inline */}
      {hasTools && (
        <ToolCalls tools={message.toolCalls!} messageId={message.id} />
      )}

      {/* Message content */}
      {(message.content || (!hasTools && message.isStreaming)) && (
        <Box>
          {isUser ? (
            <Text color={colors.user} bold>
              {"> "}
            </Text>
          ) : isSystem ? (
            <Text color={colors.system} bold>
              {"ℹ "}
            </Text>
          ) : (
            <Text color={colors.assistant} bold>
              {"✦ "}
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
