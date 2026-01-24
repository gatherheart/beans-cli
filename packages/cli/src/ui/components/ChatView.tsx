/**
 * ChatView component - displays the chat history
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

  return (
    <Box flexDirection="column" flexGrow={1} width={width} justifyContent="flex-end">
      {messages.map(message => (
        <Message key={message.id} message={message} />
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
