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

// Paste token marker format: §PASTE:id§
const PASTE_MARKER_REGEX = /§PASTE:(\d+)§/g;

interface PasteToken {
  original: string;
  lineCount: number;
  charCount: number;
}

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
  const [pasteTokens, setPasteTokens] = useState<Map<number, PasteToken>>(new Map());
  const pasteCounterRef = React.useRef(0);
  const { isLoading, profile } = useChatState();
  const { sendMessage, addSystemMessage, clearHistory, getLLMHistory, getSystemPrompt } = useChatActions();

  // Expand paste tokens to original text
  const expandPasteTokens = useCallback((text: string, tokens: Map<number, PasteToken>): string => {
    return text.replace(PASTE_MARKER_REGEX, (_, id) => {
      const token = tokens.get(Number(id));
      return token ? token.original : '';
    });
  }, []);

  // Get display text with paste tokens shown as chips
  const getDisplayText = useCallback((text: string, tokens: Map<number, PasteToken>): string => {
    return text.replace(PASTE_MARKER_REGEX, (_, id) => {
      const token = tokens.get(Number(id));
      if (!token) return '';
      if (token.lineCount > 0) {
        return `[Pasted #${id} +${token.lineCount} lines]`;
      }
      return `[Pasted #${id} ${token.charCount} chars]`;
    });
  }, []);

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
        setPasteTokens(new Map());
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

    // Expand paste tokens to original text
    const expanded = expandPasteTokens(trimmed, pasteTokens);

    setInput('');
    setCursorPos(0);
    setPasteTokens(new Map());

    await sendMessage(expanded);
  }, [sendMessage, addSystemMessage, clearHistory, onExit, profile, getLLMHistory, getSystemPrompt, inputHistory, expandPasteTokens, pasteTokens]);

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
      setPasteTokens(new Map());
      return;
    }

    // Ctrl+J: insert newline (char can be 'j' or '\n' depending on terminal)
    if (key.ctrl && (char === 'j' || char === '\n')) {
      // Check if cursor is inside a paste marker - if so, move to end
      let insertPos = cursorPos;
      const markerRegex = /§PASTE:\d+§/g;
      let match;
      while ((match = markerRegex.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (cursorPos > start && cursorPos < end) {
          insertPos = end;
          break;
        }
      }
      setInput(prev => prev.slice(0, insertPos) + '\n' + prev.slice(insertPos));
      setCursorPos(insertPos + 1);
      return;
    }

    // Left arrow: move cursor left (skip over paste markers)
    if (key.leftArrow) {
      let newPos = Math.max(0, cursorPos - 1);
      // Check if we landed inside a paste marker, skip to its start
      const beforeCursor = input.slice(0, newPos);
      const markerMatch = beforeCursor.match(/§PASTE:\d+§?$/);
      if (markerMatch && !markerMatch[0].endsWith('§')) {
        // We're inside a marker, find its start
        const fullMatch = input.slice(0, cursorPos).match(/(§PASTE:\d+§)$/);
        if (fullMatch) {
          newPos = cursorPos - fullMatch[0].length;
        }
      }
      setCursorPos(newPos);
      return;
    }

    // Right arrow: move cursor right (skip over paste markers)
    if (key.rightArrow) {
      let newPos = Math.min(input.length, cursorPos + 1);
      // Check if we're at the start of a paste marker, skip to its end
      const afterCursor = input.slice(cursorPos);
      const markerMatch = afterCursor.match(/^§PASTE:\d+§/);
      if (markerMatch) {
        newPos = cursorPos + markerMatch[0].length;
      }
      setCursorPos(newPos);
      return;
    }

    // Up arrow: history when empty, move up line when has input
    if (key.upArrow) {
      if (input.length === 0) {
        // History navigation when empty
        if (inputHistory.length === 0) return;

        if (historyIndex === -1) {
          const newIndex = inputHistory.length - 1;
          setHistoryIndex(newIndex);
          setInput(inputHistory[newIndex]);
          setCursorPos(inputHistory[newIndex].length);
        } else if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(inputHistory[newIndex]);
          setCursorPos(inputHistory[newIndex].length);
        }
      } else {
        // Move cursor to previous line
        const beforeCursor = input.slice(0, cursorPos);
        const lastNewline = beforeCursor.lastIndexOf('\n');
        if (lastNewline === -1) {
          // Already on first line, move to start
          setCursorPos(0);
        } else {
          const currentCol = cursorPos - lastNewline - 1;
          const prevLineStart = beforeCursor.lastIndexOf('\n', lastNewline - 1) + 1;
          const prevLineLen = lastNewline - prevLineStart;
          const newCol = Math.min(currentCol, prevLineLen);
          setCursorPos(prevLineStart + newCol);
        }
      }
      return;
    }

    // Down arrow: history when browsing, move down line when has input
    if (key.downArrow) {
      if (historyIndex !== -1) {
        // Continue history navigation
        if (historyIndex < inputHistory.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setInput(inputHistory[newIndex]);
          setCursorPos(inputHistory[newIndex].length);
        } else {
          setHistoryIndex(-1);
          setInput('');
          setCursorPos(0);
        }
      } else if (input.length > 0) {
        // Move cursor to next line
        const beforeCursor = input.slice(0, cursorPos);
        const afterCursor = input.slice(cursorPos);
        const lineStart = beforeCursor.lastIndexOf('\n') + 1;
        const currentCol = cursorPos - lineStart;
        const nextNewline = afterCursor.indexOf('\n');
        if (nextNewline === -1) {
          // Already on last line, move to end
          setCursorPos(input.length);
        } else {
          const nextLineStart = cursorPos + nextNewline + 1;
          const nextLineEnd = input.indexOf('\n', nextLineStart);
          const nextLineLen = nextLineEnd === -1 ? input.length - nextLineStart : nextLineEnd - nextLineStart;
          const newCol = Math.min(currentCol, nextLineLen);
          setCursorPos(nextLineStart + newCol);
        }
      }
      return;
    }

    // Shift+Enter: insert newline
    if (key.return && key.shift) {
      // Check if cursor is inside a paste marker - if so, move to end
      let insertPos = cursorPos;
      const markerRegex = /§PASTE:\d+§/g;
      let match;
      while ((match = markerRegex.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (cursorPos > start && cursorPos < end) {
          insertPos = end;
          break;
        }
      }
      setInput(prev => prev.slice(0, insertPos) + '\n' + prev.slice(insertPos));
      setCursorPos(insertPos + 1);
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

    // Backspace: delete character before cursor (or entire paste token)
    if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        const markerMatch = input.slice(0, cursorPos).match(/§PASTE:(\d+)§$/);
        if (markerMatch) {
          const markerId = Number(markerMatch[1]);
          const markerStart = cursorPos - markerMatch[0].length;
          setInput(prev => prev.slice(0, markerStart) + prev.slice(cursorPos));
          setCursorPos(markerStart);
          setPasteTokens(prev => {
            const next = new Map(prev);
            next.delete(markerId);
            return next;
          });
        } else {
          setInput(prev => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
          setCursorPos(pos => pos - 1);
        }
      }
      return;
    }

    // Detect paste: multiple characters at once (threshold > 3 to avoid fast typing false positives)
    // Also detect shorter pastes if they contain newlines or tabs (but length must be > 1)
    if (char && (char.length > 3 || (char.length > 1 && (char.includes('\n') || char.includes('\t'))))) {
      const lines = char.split(/\r?\n|\r/);
      const lineCount = lines.length - 1;

      pasteCounterRef.current += 1;
      const newId = pasteCounterRef.current;
      const marker = `§PASTE:${newId}§`;

      setPasteTokens(tokens => {
        const next = new Map(tokens);
        next.set(newId, { original: char, lineCount, charCount: char.length });
        return next;
      });

      setInput(prev => prev.slice(0, cursorPos) + marker + prev.slice(cursorPos));
      setCursorPos(cursorPos + marker.length);
      return;
    }

    // Regular character input: insert at cursor position
    if (char && !key.ctrl && !key.meta) {
      // Check if cursor is inside a paste marker - if so, move to end of marker
      let insertPos = cursorPos;
      const markerRegex = /§PASTE:\d+§/g;
      let match;
      while ((match = markerRegex.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (cursorPos > start && cursorPos < end) {
          insertPos = end;
          break;
        }
      }

      setInput(prev => prev.slice(0, insertPos) + char + prev.slice(insertPos));
      setCursorPos(insertPos + char.length);
    }
  });

  // Map raw cursor position to display cursor position
  const getDisplayCursorPos = useCallback((rawCursor: number, rawInput: string, tokens: Map<number, PasteToken>): number => {
    let displayPos = 0;
    let i = 0;
    while (i < rawCursor && i < rawInput.length) {
      const remaining = rawInput.slice(i);
      const markerMatch = remaining.match(/^§PASTE:(\d+)§/);
      if (markerMatch) {
        const token = tokens.get(Number(markerMatch[1]));
        if (token) {
          const chipText = token.lineCount > 0
            ? `[Pasted #${markerMatch[1]} +${token.lineCount} lines]`
            : `[Pasted #${markerMatch[1]} ${token.charCount} chars]`;
          // If cursor is past or at the end of this marker, add full chip length
          if (i + markerMatch[0].length <= rawCursor) {
            displayPos += chipText.length;
            i += markerMatch[0].length;
            continue;
          }
        }
      }
      displayPos++;
      i++;
    }
    return displayPos;
  }, []);

  // Render input with cursor
  const renderInputWithCursor = () => {
    if (!input && !isLoading) {
      if (inputHistory.length > 0) {
        return <Text color="gray">Press ↑ to edit previous messages</Text>;
      }
      return <Text color="gray">Type a message...</Text>;
    }

    const displayText = getDisplayText(input, pasteTokens);
    const displayCursor = getDisplayCursorPos(cursorPos, input, pasteTokens);

    const beforeCursor = displayText.slice(0, displayCursor);
    const charAtCursor = displayText[displayCursor];
    const afterCursor = displayText.slice(displayCursor + 1);

    // Handle cursor on newline or at end - show visible cursor block
    const isOnNewline = charAtCursor === '\n';
    const atCursor = isOnNewline ? ' ' : (charAtCursor || ' ');
    const afterCursorWithNewline = isOnNewline ? '\n' + afterCursor : afterCursor;

    return (
      <Text>
        {beforeCursor}
        <Text inverse={cursorVisible}>{atCursor}</Text>
        {afterCursorWithNewline}
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
