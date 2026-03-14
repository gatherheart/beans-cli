/**
 * Diff display component for showing file changes
 *
 * Shows unified diff format with:
 * - Light red background (-) for removed lines
 * - Light blue background (+) for added lines
 * - Line numbers for context
 */

import React from "react";
import { Box, Text } from "ink";
import * as Diff from "diff";
import { colors } from "../theme/colors.js";

interface DiffDisplayProps {
  originalContent: string | null;
  newContent: string;
  filePath: string;
  isNewFile: boolean;
}

// Soft background colors
const BG_ADDED = "#1a2a3a"; // soft blue
const BG_REMOVED = "#3a1a1a"; // soft red
// Use white text for content - only background color indicates change
const FG_CONTENT = "#FFFFFF"; // white text for content
const FG_LINE_NUM_ADDED = "#87CEEB"; // light blue for line numbers
const FG_LINE_NUM_REMOVED = "#FFB6C1"; // light pink for line numbers

// Fixed width for line numbers (handles up to 999999 lines)
const LINE_NUM_WIDTH = 6;

export const DiffDisplay = React.memo(function DiffDisplay({
  originalContent,
  newContent,
  filePath,
  isNewFile,
}: DiffDisplayProps): React.ReactElement {
  const renderDiff = () => {
    if (isNewFile) {
      // New file: show all lines as added with new line numbers
      const lines = newContent.split("\n");

      return (
        <>
          {lines.map((line, i) => (
            <Box key={i}>
              <Text color={FG_LINE_NUM_ADDED}>
                {String(i + 1).padStart(LINE_NUM_WIDTH)}{" "}
              </Text>
              <Text color={FG_LINE_NUM_ADDED}>+</Text>
              <Text backgroundColor={BG_ADDED} color={FG_CONTENT}>
                {line}
              </Text>
            </Box>
          ))}
        </>
      );
    }

    // Modified file: compute diff using structuredPatch for better control
    const patches = Diff.structuredPatch(
      filePath,
      filePath,
      originalContent || "",
      newContent,
    );

    const displayLines: React.ReactNode[] = [];
    let keyIndex = 0;

    for (const hunk of patches.hunks) {
      let oldLine = hunk.oldStart;
      let newLine = hunk.newStart;

      // Render lines in order (not grouped)
      for (const line of hunk.lines) {
        if (line.startsWith("+")) {
          // Added line: show new line number
          displayLines.push(
            <Box key={keyIndex++}>
              <Text color={FG_LINE_NUM_ADDED}>
                {String(newLine).padStart(LINE_NUM_WIDTH)}{" "}
              </Text>
              <Text color={FG_LINE_NUM_ADDED}>+</Text>
              <Text backgroundColor={BG_ADDED} color={FG_CONTENT}>
                {line.slice(1)}
              </Text>
            </Box>,
          );
          newLine++;
        } else if (line.startsWith("-")) {
          // Removed line: show old line number
          displayLines.push(
            <Box key={keyIndex++}>
              <Text color={FG_LINE_NUM_REMOVED}>
                {String(oldLine).padStart(LINE_NUM_WIDTH)}{" "}
              </Text>
              <Text color={FG_LINE_NUM_REMOVED}>-</Text>
              <Text backgroundColor={BG_REMOVED} color={FG_CONTENT}>
                {line.slice(1)}
              </Text>
            </Box>,
          );
          oldLine++;
        } else if (line.startsWith(" ")) {
          // Context line: show new line number
          displayLines.push(
            <Box key={keyIndex++}>
              <Text color={colors.muted}>
                {String(newLine).padStart(LINE_NUM_WIDTH)}{" "}
              </Text>
              <Text color={colors.muted}> </Text>
              <Text color={colors.muted}>{line.slice(1)}</Text>
            </Box>,
          );
          oldLine++;
          newLine++;
        }
        // Skip other lines like "\ No newline at end of file"
      }
    }

    return <>{displayLines}</>;
  };

  return (
    <Box flexDirection="column" marginY={1}>
      <Text color={colors.header} bold>
        {isNewFile ? "📄 New file:" : "📝 Modified:"} {filePath}
      </Text>
      <Box flexDirection="column">{renderDiff()}</Box>
    </Box>
  );
});
