/**
 * Input area component with cursor navigation
 * Following claude-code pattern for proper cursor handling
 *
 * Multi-line input:
 * - Shift+Enter: insert newline
 * - Backslash at end of line + Enter: insert newline (removes backslash)
 *
 * Cursor navigation:
 * - Left/Right arrows: move cursor
 * - Ctrl+A: move to start
 * - Ctrl+E: move to end
 * - Ctrl+U: clear line
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useChatState, useChatActions } from '../contexts/ChatContext.js';
import { formatHistoryForDisplay } from '../utils/formatHistory.js';
import { colors } from '../theme/colors.js';

const HELP_TEXT = `## Available Commands

- **/help** - Show this help message
- **/clear** - Clear chat history
- **/profile** - Show current agent profile
- **/history** - Show LLM message history
- **/memory** - Show the current system prompt
- **/exit** - Exit the application

**Multi-line input:**
- Shift+Enter or Ctrl+J to insert newline
- Type \\ at end of line then Enter

**Cursor navigation:**
- Left/Right arrows to move cursor
- Ctrl+A to move to start, Ctrl+E to move to end
- Ctrl+U to clear line`;

interface InputAreaProps {
  onExit: () => void;
  width?: number;
}

export function InputArea({ onExit, width }: InputAreaProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const { isLoading, profile } = useChatState();
  const { sendMessage, addSystemMessage, clearHistory, getLLMHistory, getSystemPrompt } = useChatActions();

  // Cursor blink effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(v => !v);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Keep cursor position in sync with input length
  useEffect(() => {
    if (cursorPos > input.length) {
      setCursorPos(input.length);
    }
  }, [input, cursorPos]);

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Handle slash commands
    if (trimmed.startsWith('/')) {
      const command = trimmed.slice(1).toLowerCase();

      if (command === 'exit' || command === 'quit' || command === 'q') {
        onExit();
        return;
      }

      if (command === 'clear') {
        clearHistory();
        setInput('');
        setCursorPos(0);
        return;
      }

      if (command === 'help') {
        addSystemMessage(HELP_TEXT);
        setInput('');
        setCursorPos(0);
        return;
      }

      if (command === 'profile') {
        if (profile) {
          const profileText = `## Current Agent Profile

- **Name:** ${profile.displayName}
- **Version:** ${profile.version}
- **Description:** ${profile.description}
${profile.purpose ? `- **Purpose:** ${profile.purpose}` : ''}`;
          addSystemMessage(profileText);
        } else {
          addSystemMessage('No profile loaded.');
        }
        setInput('');
        setCursorPos(0);
        return;
      }

      if (command === 'history') {
        const llmHistory = getLLMHistory();
        addSystemMessage(formatHistoryForDisplay(llmHistory));
        setInput('');
        setCursorPos(0);
        return;
      }

      if (command === 'memory') {
        const systemPrompt = getSystemPrompt();
        const memoryText = `## System Prompt\n\n\`\`\`\n${systemPrompt}\n\`\`\``;
        addSystemMessage(memoryText);
        setInput('');
        setCursorPos(0);
        return;
      }

      // Unknown command
      addSystemMessage(`Unknown command: ${trimmed}. Type /help for available commands.`);
      setInput('');
      setCursorPos(0);
      return;
    }

    setInput('');
    setCursorPos(0);
    await sendMessage(trimmed);
  }, [sendMessage, addSystemMessage, clearHistory, onExit, profile, getLLMHistory, getSystemPrompt]);

  // Handle keyboard input
  useInput((char, key) => {
    if (isLoading) return;

    // Ctrl+C: exit
    if (key.ctrl && char === 'c') {
      onExit();
      return;
    }

    // Ctrl+A: move to start
    if (key.ctrl && char === 'a') {
      setCursorPos(0);
      return;
    }

    // Ctrl+E: move to end
    if (key.ctrl && char === 'e') {
      setCursorPos(input.length);
      return;
    }

    // Ctrl+U: clear line
    if (key.ctrl && char === 'u') {
      setInput('');
      setCursorPos(0);
      return;
    }

    // Ctrl+J: insert newline
    if (key.ctrl && char === 'j') {
      setInput(prev => prev.slice(0, cursorPos) + '\n' + prev.slice(cursorPos));
      setCursorPos(pos => pos + 1);
      return;
    }

    // Left arrow: move cursor left
    if (key.leftArrow) {
      setCursorPos(pos => Math.max(0, pos - 1));
      return;
    }

    // Right arrow: move cursor right
    if (key.rightArrow) {
      setCursorPos(pos => Math.min(input.length, pos + 1));
      return;
    }

    // Shift+Enter: insert newline
    if (key.return && key.shift) {
      setInput(prev => prev.slice(0, cursorPos) + '\n' + prev.slice(cursorPos));
      setCursorPos(pos => pos + 1);
      return;
    }

    // Enter: check for backslash continuation or submit
    if (key.return) {
      // Backslash at end of input: remove it and insert newline
      if (input.endsWith('\\')) {
        setInput(prev => prev.slice(0, -1) + '\n');
        setCursorPos(input.length); // cursor at end after newline
        return;
      }
      handleSubmit(input);
      return;
    }

    // Backspace: delete character before cursor
    if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        setInput(prev => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
        setCursorPos(pos => pos - 1);
      }
      return;
    }

    // Regular character input: insert at cursor position
    if (char && !key.ctrl && !key.meta) {
      setInput(prev => prev.slice(0, cursorPos) + char + prev.slice(cursorPos));
      setCursorPos(pos => pos + char.length);
    }
  });

  // Render input with cursor
  const renderInputWithCursor = () => {
    if (!input && !isLoading) {
      return <Text color="gray">Type a message...</Text>;
    }

    const beforeCursor = input.slice(0, cursorPos);
    const atCursor = input[cursorPos] || ' ';
    const afterCursor = input.slice(cursorPos + 1);

    return (
      <Text>
        {beforeCursor}
        <Text inverse={cursorVisible}>{atCursor}</Text>
        {afterCursor}
      </Text>
    );
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isLoading ? colors.muted : colors.border}
      width={width}
      paddingX={1}
    >
      <Box>
        <Text color={isLoading ? colors.warning : colors.primary}>
          {isLoading ? '● Processing...' : '>'}{' '}
        </Text>
        {renderInputWithCursor()}
      </Box>
      <Box>
        <Text color={colors.muted} dimColor>
          Enter to submit • Ctrl+C to exit • /help
        </Text>
      </Box>
    </Box>
  );
}
