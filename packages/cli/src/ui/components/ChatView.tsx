/**
 * ChatView component - displays the chat history
 * Uses Static for completed messages to prevent flickering
 */

import React from 'react';
import { Box, Text, Static } from 'ink';
import { Message } from './Message.js';
import { useChatContext } from '../contexts/ChatContext.js';
import type { Message as MessageType } from '../contexts/ChatContext.js';

export function ChatView(): React.ReactElement {
  const { messages, error } = useChatContext();

  // Separate completed and streaming messages
  const completedMessages = messages.filter(m => !m.isStreaming);
  const streamingMessages = messages.filter(m => m.isStreaming);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {/* Completed messages - Static prevents re-rendering */}
      {completedMessages.length > 0 && (
        <Static items={completedMessages}>
          {(message: MessageType) => (
            <Message key={message.id} message={message} />
          )}
        </Static>
      )}

      {/* Streaming messages - dynamic */}
      {streamingMessages.map(message => (
        <Message key={message.id} message={message} />
      ))}

      {/* Empty state */}
      {messages.length === 0 && (
        <Box marginY={1}>
          <Text color="gray">Start a conversation by typing below...</Text>
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Box marginY={1}>
          <Text color="red" bold>Error: </Text>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
