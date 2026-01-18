/**
 * Message component for displaying chat messages
 * Streams plain text during generation, renders markdown when complete
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { MarkdownDisplay } from './MarkdownDisplay.js';
import type { Message as MessageType, ToolCallInfo } from '../contexts/ChatContext.js';

interface MessageProps {
  message: MessageType;
}

function ToolCallDisplay({ toolCall }: { toolCall: ToolCallInfo }): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Box>
        {toolCall.isComplete ? (
          <Text color="green">✓ </Text>
        ) : (
          <Text color="yellow">
            <Spinner type="dots" />
            {' '}
          </Text>
        )}
        <Text bold color="cyan">{toolCall.name}</Text>
      </Box>
      {toolCall.result && (
        <Box paddingLeft={2}>
          <Text color="gray" dimColor>
            {toolCall.result}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export const Message = React.memo(function Message({ message }: MessageProps): React.ReactElement {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Message header with role indicator */}
      <Box>
        {isUser ? (
          <Text color="blue" bold>{'> '}</Text>
        ) : isSystem ? (
          <Text color="yellow" bold>{'ℹ '}</Text>
        ) : (
          <Text color="green" bold>{'✦ '}</Text>
        )}

        {/* Content */}
        <Box flexDirection="column" flexGrow={1}>
          {isUser ? (
            // User messages: plain text
            <Text>{message.content}</Text>
          ) : message.isStreaming ? (
            // Assistant streaming: show plain text + spinner
            <Box flexDirection="column">
              <Text>{message.content}</Text>
              {message.content.length === 0 && (
                <Text color="gray">
                  <Spinner type="dots" /> Thinking...
                </Text>
              )}
            </Box>
          ) : (
            // Assistant/System complete: render markdown
            <MarkdownDisplay text={message.content} />
          )}
        </Box>
      </Box>

      {/* Tool calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <Box flexDirection="column" paddingLeft={2}>
          {message.toolCalls.map((toolCall, index) => (
            <ToolCallDisplay key={`${message.id}-tool-${index}`} toolCall={toolCall} />
          ))}
        </Box>
      )}
    </Box>
  );
});
