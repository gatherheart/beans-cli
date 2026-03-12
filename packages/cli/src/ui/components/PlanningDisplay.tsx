/**
 * PlanningDisplay component for showing agent's planning/thinking content
 *
 * Displays the planning content that precedes tool execution in a
 * visually distinct way from the final response.
 */

import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { colors } from "../theme/colors.js";

interface PlanningDisplayProps {
  content: string;
  isComplete: boolean;
}

/**
 * Split content into paragraphs for better readability.
 * Handles both double newlines and single newlines with sentence boundaries.
 */
function splitIntoParagraphs(content: string): string[] {
  // First, normalize the content - trim and collapse multiple spaces
  const normalized = content.trim();

  // Split on double newlines (explicit paragraphs)
  const paragraphs = normalized.split(/\n\n+/);

  // For each paragraph, also split on single newlines if they represent distinct thoughts
  const result: string[] = [];
  for (const para of paragraphs) {
    // Split on single newlines
    const lines = para.split(/\n/).filter((line) => line.trim());
    if (lines.length > 0) {
      result.push(lines.join("\n"));
    }
  }

  return result.filter((p) => p.trim());
}

export function PlanningDisplay({
  content,
  isComplete,
}: PlanningDisplayProps): React.ReactElement {
  if (!content) {
    return <></>;
  }

  const paragraphs = splitIntoParagraphs(content);

  return (
    <Box flexDirection="column" marginBottom={1}>
      {paragraphs.map((paragraph, index) => (
        <Box key={index} marginTop={index > 0 ? 1 : 0}>
          {/* Show spinner only on first paragraph when not complete */}
          {index === 0 && !isComplete && (
            <Text color={colors.muted}>
              <Spinner type="dots" />{" "}
            </Text>
          )}
          {/* Indent non-first paragraphs to align with first */}
          {index > 0 && !isComplete && <Text>{"  "}</Text>}
          <Text color={colors.muted} italic wrap="wrap">
            {paragraph}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
