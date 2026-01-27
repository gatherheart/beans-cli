/**
 * Message component for displaying chat messages
 *
 * Following claude-code pattern:
 * - Width is passed down for proper text wrapping
 * - Uses wrap="wrap" on Text components
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { MarkdownDisplay } from './MarkdownDisplay.js';
import { colors, getToolColor } from '../theme/colors.js';
import type { Message as MessageType, ToolCallInfo } from '../contexts/ChatContext.js';

interface MessageProps {
  message: MessageType;
  width?: number;
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

export const Message = React.memo(function Message({ message, width }: MessageProps): React.ReactElement {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const hasTools = message.toolCalls && message.toolCalls.length > 0;
  // Account for the prefix (2 chars: symbol + space)
  const textWidth = width ? width - 2 : undefined;

  return (
    <Box flexDirection="column" marginBottom={1}>
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

          <Box flexDirection="column" width={textWidth}>
            {isUser ? (
              <Text wrap="wrap">{message.content}</Text>
            ) : message.isStreaming ? (
              <Text wrap="wrap">{message.content || <Text color="gray"><Spinner type="dots" /></Text>}</Text>
            ) : (
              <MarkdownDisplay text={message.content} width={textWidth} />
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
});
