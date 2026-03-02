/**
 * Diff display component for showing file changes
 *
 * Shows unified diff format with:
 * - Red background (-) for removed lines
 * - Green background (+) for added lines
 * - Gray for context lines
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

export const DiffDisplay = React.memo(function DiffDisplay({
  originalContent,
  newContent,
  filePath,
  isNewFile,
}: DiffDisplayProps): React.ReactElement {
  const renderDiff = () => {
    if (isNewFile) {
      // New file: show all lines as added
      const lines = newContent.split("\n");

      return (
        <>
          {lines.map((line, i) => (
            <Text key={i} backgroundColor="#1a3d1a" color="#98FB98">
              +{line}
            </Text>
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

      // Hunk header
      if (line.startsWith("@@")) {
        displayLines.push(
          <Text key={i} color={colors.primary}>
            {line}
          </Text>,
        );
        continue;
      }

      // Added line - green background
      if (line.startsWith("+")) {
        displayLines.push(
          <Text key={i} backgroundColor="#1a3d1a" color="#98FB98">
            {line}
          </Text>,
        );
        continue;
      }

      // Removed line - red background
      if (line.startsWith("-")) {
        displayLines.push(
          <Text key={i} backgroundColor="#3d1a1a" color="#FFB6C1">
            {line}
          </Text>,
        );
        continue;
      }

      // Context line
      if (line.startsWith(" ")) {
        displayLines.push(
          <Text key={i} color={colors.muted}>
            {line}
          </Text>,
        );
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
    <Box flexDirection="column" marginLeft={1}>
      <Text color={colors.header} bold>
        {isNewFile ? "📄 New file:" : "📝 Modified:"} {filePath}
      </Text>
      <Box flexDirection="column">{renderDiff()}</Box>
    </Box>
  );
});
