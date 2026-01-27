/**
 * ChatView component - displays the chat history
 *
 * Following claude-code pattern (from docs/issues/terminal-resize-handling.md):
 * - Don't use Static (causes duplicate messages on resize)
 * - Use React.memo on child components for performance
 * - Pass width for proper text wrapping
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Message } from './Message.js';
import { useChatState } from '../contexts/ChatContext.js';
import { colors } from '../theme/colors.js';

interface ChatViewProps {
  width?: number;
}

export function ChatView({ width }: ChatViewProps): React.ReactElement {
  const { messages, error } = useChatState();
  // Account for padding/borders (2 chars each side)
  const contentWidth = width ? width - 4 : undefined;

  return (
    <Box flexDirection="column" width={width}>
      {messages.map(message => (
        <Message key={message.id} message={message} width={contentWidth} />
      ))}

      {messages.length === 0 && (
        <Text color={colors.muted}>Type a message to start...</Text>
      )}

      {error && (
        <Box>
          <Text color={colors.error}>✗ {error}</Text>
        </Box>
      )}
    </Box>
  );
}
