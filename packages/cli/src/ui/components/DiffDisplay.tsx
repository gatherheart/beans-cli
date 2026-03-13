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
// Soft background colors
const BG_ADDED = "#1a2a3a"; // soft blue
const BG_REMOVED = "#3a1a1a"; // soft red
const FG_ADDED = "#87CEEB"; // light blue text
const FG_REMOVED = "#FFB6C1"; // light pink text

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
      // New file: show all lines as added
      // Format: [    ] [NEW] + content (blank OLD column)
      const lines = newContent.split("\n");

      return (
        <>
          {lines.map((line, i) => (
            <Box key={i}>
              <Text color={FG_ADDED}>
                {String(i + 1).padStart(LINE_NUM_WIDTH)}{" "}
              </Text>
              <Text color={FG_ADDED}>+</Text>
              <Text backgroundColor={BG_ADDED} color={FG_ADDED}>
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
      // Collect lines by type for grouped display
      const addedLines: { lineNum: number; content: string }[] = [];
      const removedLines: { lineNum: number; content: string }[] = [];
      const contextBefore: {
        oldNum: number;
        newNum: number;
        content: string;
      }[] = [];
      const contextAfter: {
        oldNum: number;
        newNum: number;
        content: string;
      }[] = [];

      let oldLine = hunk.oldStart;
      let newLine = hunk.newStart;
      let inChanges = false;

      for (const line of hunk.lines) {
        if (line.startsWith("+")) {
          inChanges = true;
          addedLines.push({ lineNum: newLine, content: line.slice(1) });
          newLine++;
        } else if (line.startsWith("-")) {
          inChanges = true;
          removedLines.push({ lineNum: oldLine, content: line.slice(1) });
          oldLine++;
        } else {
          // Context line
          const content = line.startsWith(" ") ? line.slice(1) : line;
          if (!inChanges) {
            contextBefore.push({ oldNum: oldLine, newNum: newLine, content });
          } else {
            contextAfter.push({ oldNum: oldLine, newNum: newLine, content });
          }
          oldLine++;
          newLine++;
        }
      }

      // Render context before changes
      for (const ctx of contextBefore) {
        displayLines.push(
          <Box key={keyIndex++}>
            <Text color={colors.muted}>
              {String(ctx.oldNum).padStart(LINE_NUM_WIDTH)}{" "}
            </Text>
            <Text color={colors.muted}> </Text>
            <Text color={colors.muted}>{ctx.content}</Text>
          </Box>,
        );
      }

      // Render added lines first (with new line numbers)
      for (const added of addedLines) {
        displayLines.push(
          <Box key={keyIndex++}>
            <Text color={FG_ADDED}>
              {String(added.lineNum).padStart(LINE_NUM_WIDTH)}{" "}
            </Text>
            <Text color={FG_ADDED}>+</Text>
            <Text backgroundColor={BG_ADDED} color={FG_ADDED}>
              {added.content}
            </Text>
          </Box>,
        );
      }

      // Render removed lines (with old line numbers)
      for (const removed of removedLines) {
        displayLines.push(
          <Box key={keyIndex++}>
            <Text color={FG_REMOVED}>
              {String(removed.lineNum).padStart(LINE_NUM_WIDTH)}{" "}
            </Text>
            <Text color={FG_REMOVED}>-</Text>
            <Text backgroundColor={BG_REMOVED} color={FG_REMOVED}>
              {removed.content}
            </Text>
          </Box>,
        );
      }

      // Render context after changes
      for (const ctx of contextAfter) {
        displayLines.push(
          <Box key={keyIndex++}>
            <Text color={colors.muted}>
              {String(ctx.newNum).padStart(LINE_NUM_WIDTH)}{" "}
            </Text>
            <Text color={colors.muted}> </Text>
            <Text color={colors.muted}>{ctx.content}</Text>
          </Box>,
        );
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
