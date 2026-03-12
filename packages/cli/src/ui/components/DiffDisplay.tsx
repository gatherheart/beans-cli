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
const FG_ADDED = "#87CEEB"; // light blue text
const FG_REMOVED = "#FFB6C1"; // light pink text

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
              <Text color={colors.muted}>{"     "}</Text>
              <Text color={FG_ADDED}>{String(i + 1).padStart(4)} </Text>
              <Text color={FG_ADDED}>+</Text>
              <Text backgroundColor={BG_ADDED} color={FG_ADDED}>
                {line}
              </Text>
            </Box>
          ))}
        </>
      );
    }

    // Modified file: compute diff
    const diff = Diff.createPatch(
      filePath,
      originalContent || "",
      newContent,
      "original",
      "modified",
    );

    // Parse the patch to extract changed lines
    const lines = diff.split("\n");
    const displayLines: React.ReactNode[] = [];
    let oldLine = 0;
    let newLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip header lines
      if (
        line.startsWith("Index:") ||
        line.startsWith("===") ||
        line.startsWith("---") ||
        line.startsWith("+++")
      ) {
        continue;
      }

      // Hunk header - extract line numbers
      if (line.startsWith("@@")) {
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        displayLines.push(
          <Text key={i} color={colors.primary}>
            {line}
          </Text>,
        );
        continue;
      }

      // Added line - blue background
      // Format: [    ] [NEW] + content (blank OLD column)
      if (line.startsWith("+")) {
        const content = line.slice(1); // Remove the + prefix
        displayLines.push(
          <Box key={i}>
            <Text color={colors.muted}>{"     "}</Text>
            <Text color={FG_ADDED}>{String(newLine).padStart(4)} </Text>
            <Text color={FG_ADDED}>+</Text>
            <Text backgroundColor={BG_ADDED} color={FG_ADDED}>
              {content}
            </Text>
          </Box>,
        );
        newLine++;
        continue;
      }

      // Removed line - red background
      // Format: [OLD] [    ] - content (blank NEW column)
      if (line.startsWith("-")) {
        const content = line.slice(1); // Remove the - prefix
        displayLines.push(
          <Box key={i}>
            <Text color={FG_REMOVED}>{String(oldLine).padStart(4)} </Text>
            <Text color={colors.muted}>{"     "}</Text>
            <Text color={FG_REMOVED}>-</Text>
            <Text backgroundColor={BG_REMOVED} color={FG_REMOVED}>
              {content}
            </Text>
          </Box>,
        );
        oldLine++;
        continue;
      }

      // Context line
      // Format: [OLD] [NEW]   content
      if (line.startsWith(" ")) {
        const content = line.slice(1); // Remove the leading space
        displayLines.push(
          <Box key={i}>
            <Text color={colors.muted}>{String(oldLine).padStart(4)} </Text>
            <Text color={colors.muted}>{String(newLine).padStart(4)} </Text>
            <Text color={colors.muted}> {content}</Text>
          </Box>,
        );
        oldLine++;
        newLine++;
        continue;
      }

      // Other lines (shouldn't happen in normal diffs)
      if (line.trim()) {
        displayLines.push(
          <Text key={i} color={colors.muted}>
            {line}
          </Text>,
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
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.muted}
        paddingX={1}
      >
        {renderDiff()}
      </Box>
    </Box>
  );
});
