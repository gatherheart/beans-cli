/**
 * Input area component - visually separated from chat output
 * Uses Ink's useInput hook for text input handling
 *
 * Multi-line input:
 * - Shift+Enter: insert newline
 * - Backslash at end of line + Enter: insert newline (removes backslash)
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { useChatContext } from '../contexts/ChatContext.js';

const HELP_TEXT = `## Available Commands

- **/help** - Show this help message
- **/clear** - Clear chat history
- **/profile** - Show current agent profile
- **/sop <text>** - Update standard operating procedure
- **/exit** - Exit the application

**Multi-line input:**
- Shift+Enter or Ctrl+J to insert newline
- Type \\ at end of line then Enter`;

interface InputAreaProps {
  onExit: () => void;
}

export function InputArea({ onExit }: InputAreaProps): React.ReactElement {
  const [input, setInput] = useState('');
  const { sendMessage, addSystemMessage, clearHistory, updateSOP, isLoading, profile } = useChatContext();

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
        return;
      }

      if (command === 'help') {
        addSystemMessage(HELP_TEXT);
        setInput('');
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
        return;
      }

      if (command.startsWith('sop ')) {
        const sop = trimmed.slice(5).trim();
        if (sop) {
          updateSOP(sop);
          addSystemMessage(`SOP updated successfully.`);
        } else {
          addSystemMessage('Usage: /sop <your sop text>');
        }
        setInput('');
        return;
      }

      // Unknown command
      addSystemMessage(`Unknown command: ${trimmed}. Type /help for available commands.`);
      setInput('');
      return;
    }

    setInput('');
    await sendMessage(trimmed);
  }, [sendMessage, addSystemMessage, clearHistory, updateSOP, onExit, profile]);

  // Handle keyboard input
  useInput((char, key) => {
    if (isLoading) return;

    // Ctrl+C: exit
    if (key.ctrl && char === 'c') {
      onExit();
      return;
    }

    // Ctrl+J: insert newline (like gemini-cli)
    if (key.ctrl && char === 'j') {
      setInput(prev => prev + '\n');
      return;
    }

    // Shift+Enter: insert newline
    if (key.return && key.shift) {
      setInput(prev => prev + '\n');
      return;
    }

    // Enter: check for backslash continuation or submit
    if (key.return) {
      // Backslash at end of input: remove it and insert newline
      if (input.endsWith('\\')) {
        setInput(prev => prev.slice(0, -1) + '\n');
        return;
      }
      handleSubmit(input);
      return;
    }

    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    // Handle regular character input
    if (char && !key.ctrl && !key.meta) {
      setInput(prev => prev + char);
    }
  });

  // Split input by newlines for multi-line display
  const lines = input.split('\n');

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
    >
      <Box>
        <Text color="cyan" bold>Your message</Text>
        {isLoading && <Text color="gray"> (waiting...)</Text>}
      </Box>
      <Box flexDirection="column">
        {lines.map((line, index) => (
          <Box key={`input-line-${index}`}>
            <Text color="cyan">{index === 0 ? ' > ' : ' . '}</Text>
            <Text>{line}</Text>
            {index === lines.length - 1 && <Text color="cyan">█</Text>}
          </Box>
        ))}
      </Box>
      <Box>
        <Text color="gray" dimColor>
          Shift+Enter for newline • /help • /exit
        </Text>
      </Box>
    </Box>
  );
}
