/**
 * ToolCallDisplay component for showing individual tool calls
 *
 * Displays tool name with arguments summary and result summary in a
 * vertical format:
 *   ✓ glob(pattern: **\/*.ts)
 *     Found 5 files
 */

import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme/colors.js";
import type { ToolCallInfo } from "../hooks/useChatHistory.js";

interface ToolCallDisplayProps {
  tool: ToolCallInfo;
}

export function ToolCallDisplay({
  tool,
}: ToolCallDisplayProps): React.ReactElement {
  const hasError =
    tool.result?.startsWith("Error:") ||
    tool.result?.includes("Access denied") ||
    tool.result?.includes("rejected") ||
    tool.result?.includes("blocked");

  const statusColor = tool.isComplete
    ? hasError
      ? colors.error
      : colors.success
    : colors.warning;

  const statusIcon = tool.isComplete
    ? hasError
      ? "\u2717"
      : "\u2713"
    : "\u280b";

  return (
    <Box flexDirection="column">
      {/* Tool header: icon + name(args) */}
      <Box>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text color={colors.primary}>{tool.name}</Text>
        {tool.argsSummary && (
          <Text color={colors.muted}>({tool.argsSummary})</Text>
        )}
      </Box>
      {/* Result summary - indented under tool name */}
      {tool.isComplete && tool.resultSummary && (
        <Box marginLeft={2}>
          <Text color={hasError ? colors.error : colors.muted}>
            {tool.resultSummary}
          </Text>
        </Box>
      )}
    </Box>
  );
}
