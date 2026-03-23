/**
 * ChatView component - displays the chat history
 *
 * Following gemini-cli pattern for flicker prevention:
 * - Use Static for completed messages (not re-rendered on updates)
 * - Only pending/streaming messages are in dynamic Box
 * - Remount Static on terminal resize via key
 */

import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, Static } from "ink";
import { Message } from "./Message.js";
import { useChatState } from "../contexts/ChatContext.js";
import { colors } from "../theme/colors.js";
import type { Message as ChatMessage } from "../contexts/ChatContext.js";

interface ChatViewProps {
  width?: number;
}

function isLiveMessage(message: ChatMessage): boolean {
  return (
    message.isStreaming ||
    Boolean(message.isThinking) ||
    Boolean(message.planningContent && !message.isPlanningComplete) ||
    Boolean(message.toolCalls?.some((tool) => !tool.isComplete))
  );
}

export function partitionMessagesForRender(messages: ChatMessage[]): {
  archivedMessages: ChatMessage[];
  liveMessages: ChatMessage[];
} {
  const firstLiveIndex = messages.findIndex(isLiveMessage);

  if (firstLiveIndex === -1) {
    return {
      archivedMessages: messages,
      liveMessages: [],
    };
  }

  return {
    archivedMessages: messages.slice(0, firstLiveIndex),
    liveMessages: messages.slice(firstLiveIndex),
  };
}

export const ChatView = React.memo(function ChatView({
  width,
}: ChatViewProps): React.ReactElement {
  const { messages, error } = useChatState();
  // Account for padding/borders (2 chars each side)
  const contentWidth = width ? width - 4 : undefined;

  // Track terminal resize to remount Static component
  const [remountKey, setRemountKey] = useState(0);
  useEffect(() => {
    const handleResize = () => setRemountKey((k) => k + 1);
    process.stdout.on("resize", handleResize);
    return () => {
      process.stdout.off("resize", handleResize);
    };
  }, []);

  // Freeze everything above the first active message.
  const { archivedMessages, liveMessages } = useMemo(
    () => partitionMessagesForRender(messages),
    [messages],
  );

  return (
    <Box flexDirection="column" width={width}>
      {messages.length === 0 && (
        <Text color={colors.muted}>Type a message to start...</Text>
      )}

      {/* Static: archived chat history */}
      <Static key={remountKey} items={archivedMessages}>
        {(message) => (
          <Message key={message.id} message={message} width={contentWidth} />
        )}
      </Static>

      {/* Dynamic: only the active tail updates */}
      {liveMessages.map((message) => (
        <Message key={message.id} message={message} width={contentWidth} />
      ))}

      {error && (
        <Box>
          <Text color={colors.error}>✗ {error}</Text>
        </Box>
      )}
    </Box>
  );
});
