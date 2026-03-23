import React, { useMemo } from "react";
import { Box } from "ink";
import { useChatState } from "../contexts/ChatContext.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";

function hasLiveMessage(
  messages: ReturnType<typeof useChatState>["messages"],
): boolean {
  return messages.some(
    (message) =>
      message.isStreaming ||
      Boolean(message.isThinking) ||
      Boolean(message.planningContent && !message.isPlanningComplete) ||
      Boolean(message.toolCalls?.some((tool) => !tool.isComplete)),
  );
}

export const LiveStatusBar = React.memo(
  function LiveStatusBar(): React.ReactElement | null {
    const { isLoading, messages } = useChatState();

    const showIndicator = useMemo(
      () => isLoading && hasLiveMessage(messages),
      [isLoading, messages],
    );

    if (!showIndicator) {
      return null;
    }

    return (
      <Box marginTop={1}>
        <ThinkingIndicator />
      </Box>
    );
  },
);
