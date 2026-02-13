/**
 * Diff display component for showing file changes
 *
 * Shows unified diff format with:
 * - Red (-) for removed lines
 * - Green (+) for added lines
 * - Gray for context lines
 */

import React from 'react';
import { Box, Text } from 'ink';
import * as Diff from 'diff';
import { colors } from '../theme/colors.js';

interface DiffDisplayProps {
  originalContent: string | null;
  newContent: string;
  filePath: string;
  isNewFile: boolean;
  maxLines?: number;
}

export const DiffDisplay = React.memo(function DiffDisplay({
  originalContent,
  newContent,
  filePath,
  isNewFile,
  maxLines = 20,
}: DiffDisplayProps): React.ReactElement {
  const renderDiff = () => {
    if (isNewFile) {
      // New file: show all lines as added
      const lines = newContent.split('\n');
      const displayLines = lines.slice(0, maxLines);
      const hasMore = lines.length > maxLines;

      return (
        <>
          {displayLines.map((line, i) => (
            <Text key={i} color={colors.success}>
              + {line}
            </Text>
          ))}
          {hasMore && (
            <Text color={colors.muted}>... {lines.length - maxLines} more lines</Text>
          )}
        </>
      );
    }

    // Modified file: compute diff
    const diff = Diff.createPatch(
      filePath,
      originalContent || '',
      newContent,
      'original',
      'modified'
    );

    // Parse the patch to extract changed lines
    const lines = diff.split('\n');
    const displayLines: React.ReactNode[] = [];
    let lineCount = 0;

    for (let i = 0; i < lines.length && lineCount < maxLines; i++) {
      const line = lines[i];

      // Skip header lines
      if (
        line.startsWith('Index:') ||
        line.startsWith('===') ||
        line.startsWith('---') ||
        line.startsWith('+++')
      ) {
        continue;
      }

      // Hunk header
      if (line.startsWith('@@')) {
        displayLines.push(
          <Text key={i} color={colors.primary}>
            {line}
          </Text>
        );
        lineCount++;
        continue;
      }

      // Added line
      if (line.startsWith('+')) {
        displayLines.push(
          <Text key={i} color={colors.success}>
            {line}
          </Text>
        );
        lineCount++;
        continue;
      }

      // Removed line
      if (line.startsWith('-')) {
        displayLines.push(
          <Text key={i} color={colors.error}>
            {line}
          </Text>
        );
        lineCount++;
        continue;
      }

      // Context line
      if (line.startsWith(' ')) {
        displayLines.push(
          <Text key={i} color={colors.muted}>
            {line}
          </Text>
        );
        lineCount++;
        continue;
      }

      // Other lines (shouldn't happen in normal diffs)
      if (line.trim()) {
        displayLines.push(
          <Text key={i} color={colors.muted}>
            {line}
          </Text>
        );
        lineCount++;
      }
    }

    const totalChangedLines = lines.filter(
      (l) => l.startsWith('+') || l.startsWith('-')
    ).length;

    return (
      <>
        {displayLines}
        {totalChangedLines > maxLines && (
          <Text color={colors.muted}>
            ... {totalChangedLines - lineCount} more changes
          </Text>
        )}
      </>
    );
  };

  return (
    <Box flexDirection="column" marginLeft={2} marginY={1}>
      <Text color={colors.header} bold>
        {isNewFile ? '📄 New file:' : '📝 Modified:'} {filePath}
      </Text>
      <Box flexDirection="column" marginLeft={1}>
        {renderDiff()}
      </Box>
    </Box>
  );
});
