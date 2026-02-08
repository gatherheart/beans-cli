/**
 * ChatView component - displays the chat history
 *
 * Following gemini-cli pattern for flicker prevention:
 * - Use Static for completed messages (not re-rendered on updates)
 * - Only pending/streaming messages are in dynamic Box
 * - Remount Static on terminal resize via key
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, Static } from 'ink';
import { Message } from './Message.js';
import { useChatState } from '../contexts/ChatContext.js';
import { colors } from '../theme/colors.js';

interface ChatViewProps {
  width?: number;
}

export const ChatView = React.memo(function ChatView({ width }: ChatViewProps): React.ReactElement {
  console.log('[ChatView] Rendering ChatView...');
  const { messages, error } = useChatState();
  console.log('[ChatView] messages.length:', messages.length, 'error:', error);
  // Account for padding/borders (2 chars each side)
  const contentWidth = width ? width - 4 : undefined;

  // Track terminal resize to remount Static component
  const [remountKey, setRemountKey] = useState(0);
  useEffect(() => {
    const handleResize = () => setRemountKey(k => k + 1);
    process.stdout.on('resize', handleResize);
    return () => { process.stdout.off('resize', handleResize); };
  }, []);

  // Separate completed messages (for Static) from pending/streaming (for dynamic)
  const completedMessages = messages.filter(m => !m.isStreaming);
  const pendingMessages = messages.filter(m => m.isStreaming);

  return (
    <Box flexDirection="column" width={width}>
      {messages.length === 0 && (
        <Text color={colors.muted}>Type a message to start...</Text>
      )}

      {/* Static: completed messages - not re-rendered on updates */}
      <Static key={remountKey} items={completedMessages}>
        {(message) => (
          <Message key={message.id} message={message} width={contentWidth} />
        )}
      </Static>

      {/* Dynamic: pending/streaming messages */}
      {pendingMessages.map(message => (
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
