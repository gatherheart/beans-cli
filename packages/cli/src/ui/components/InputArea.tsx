/**
 * Input area component with cursor navigation and history
 * Following claude-code pattern for proper cursor handling
 *
 * Multi-line input:
 * - Shift+Enter: insert newline
 * - Backslash at end of line + Enter: insert newline (removes backslash)
 *
 * Cursor navigation:
 * - Left/Right arrows: move cursor
 * - Up/Down arrows: navigate input history
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
- Up/Down arrows to navigate input history
- Ctrl+A to move to start, Ctrl+E to move to end
- Ctrl+U to clear line`;

interface InputAreaProps {
  onExit: () => void;
  width?: number;
}

export const InputArea = React.memo(function InputArea({ onExit, width }: InputAreaProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  // Input history for up/down arrow navigation
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means not browsing history
  const [draftInput, setDraftInput] = useState(''); // Store current input when browsing history
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

    // Add to input history (avoid duplicates of the last entry)
    if (trimmed && (inputHistory.length === 0 || inputHistory[inputHistory.length - 1] !== trimmed)) {
      setInputHistory(prev => [...prev, trimmed]);
    }
    // Reset history browsing state
    setHistoryIndex(-1);
    setDraftInput('');

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
  }, [sendMessage, addSystemMessage, clearHistory, onExit, profile, getLLMHistory, getSystemPrompt, inputHistory]);

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

    // Up arrow: go back in history
    if (key.upArrow) {
      if (inputHistory.length === 0) return;

      if (historyIndex === -1) {
        // Starting to browse history - save current input as draft
        setDraftInput(input);
        const newIndex = inputHistory.length - 1;
        setHistoryIndex(newIndex);
        setInput(inputHistory[newIndex]);
        setCursorPos(inputHistory[newIndex].length);
      } else if (historyIndex > 0) {
        // Go further back in history
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(inputHistory[newIndex]);
        setCursorPos(inputHistory[newIndex].length);
      }
      return;
    }

    // Down arrow: go forward in history
    if (key.downArrow) {
      if (historyIndex === -1) return; // Not browsing history

      if (historyIndex < inputHistory.length - 1) {
        // Go forward in history
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(inputHistory[newIndex]);
        setCursorPos(inputHistory[newIndex].length);
      } else {
        // Back to draft input
        setHistoryIndex(-1);
        setInput(draftInput);
        setCursorPos(draftInput.length);
      }
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
      // Show hint about history when available
      if (inputHistory.length > 0) {
        return <Text color="gray">Press ↑ to edit previous messages</Text>;
      }
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

  // Build hint text based on state
  const getHintText = () => {
    const hints: string[] = [];

    if (inputHistory.length > 0 && !input) {
      hints.push('↑ history');
    }
    hints.push('Enter submit');
    hints.push('Ctrl+C exit');
    hints.push('/help');

    return hints.join(' • ');
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
          {getHintText()}
        </Text>
      </Box>
    </Box>
  );
});
