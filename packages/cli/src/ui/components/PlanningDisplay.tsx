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

export function PlanningDisplay({
  content,
  isComplete,
}: PlanningDisplayProps): React.ReactElement {
  if (!content) {
    return <></>;
  }

  return (
    <Box marginBottom={1}>
      <Box>
        {!isComplete && (
          <Text color={colors.muted}>
            <Spinner type="dots" />{" "}
          </Text>
        )}
        <Text color={colors.muted} italic>
          {content}
        </Text>
      </Box>
    </Box>
  );
}
