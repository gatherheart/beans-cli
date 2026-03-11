/**
 * Animated thinking indicator with cycling text and dots
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { colors } from "../theme/colors.js";

const THINKING_PHRASES = [
  "Thinking",
  "Analyzing",
  "Considering",
  "Processing",
  "Reasoning",
];

const DOT_FRAMES = [".", "..", "...", "..", "."];

interface ThinkingIndicatorProps {
  /** Interval for dot animation in ms */
  dotInterval?: number;
  /** Interval for phrase change in ms */
  phraseInterval?: number;
}

export function ThinkingIndicator({
  dotInterval = 300,
  phraseInterval = 2000,
}: ThinkingIndicatorProps): React.ReactElement {
  const [dotIndex, setDotIndex] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);

  // Animate dots
  useEffect(() => {
    const timer = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % DOT_FRAMES.length);
    }, dotInterval);
    return () => clearInterval(timer);
  }, [dotInterval]);

  // Cycle phrases
  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, phraseInterval);
    return () => clearInterval(timer);
  }, [phraseInterval]);

  const phrase = THINKING_PHRASES[phraseIndex];
  const dots = DOT_FRAMES[dotIndex];

  return (
    <Box>
      <Text color={colors.muted}>
        {phrase}
        {dots}
      </Text>
    </Box>
  );
}
