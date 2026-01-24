/**
 * Message component for displaying chat messages
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { MarkdownDisplay } from './MarkdownDisplay.js';
import { colors, getToolColor } from '../theme/colors.js';
import type { Message as MessageType, ToolCallInfo } from '../contexts/ChatContext.js';

interface MessageProps {
  message: MessageType;
}

function ToolCalls({ tools }: { tools: ToolCallInfo[] }): React.ReactElement {
  return (
    <Box gap={1}>
      {tools.map((tool) => (
        <Box key={tool.id}>
          {tool.isComplete ? (
            <Text color={colors.success}>✓ </Text>
          ) : (
            <Text color={colors.warning}><Spinner type="dots" />{' '}</Text>
          )}
          <Text color={getToolColor(tool.name)}>{tool.name}</Text>
        </Box>
      ))}
    </Box>
  );
}

export const Message = React.memo(function Message({ message }: MessageProps): React.ReactElement {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const hasTools = message.toolCalls && message.toolCalls.length > 0;

  return (
    <Box flexDirection="column">
      {/* Tool calls inline */}
      {hasTools && <ToolCalls tools={message.toolCalls!} />}

      {/* Message content */}
      {(message.content || (!hasTools && message.isStreaming)) && (
        <Box>
          {isUser ? (
            <Text color={colors.user} bold>{'> '}</Text>
          ) : isSystem ? (
            <Text color={colors.system} bold>{'ℹ '}</Text>
          ) : (
            <Text color={colors.assistant} bold>{'✦ '}</Text>
          )}

          <Box flexDirection="column" flexGrow={1}>
            {isUser ? (
              <Text>{message.content}</Text>
            ) : message.isStreaming ? (
              <Text>{message.content || <Text color="gray"><Spinner type="dots" /></Text>}</Text>
            ) : (
              <MarkdownDisplay text={message.content} />
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
});
