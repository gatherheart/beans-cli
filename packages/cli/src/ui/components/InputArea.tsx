/**
 * Input area component with cursor navigation and history
 * Following gemini-cli patterns for cleaner input UI
 */

import React, { useCallback, useReducer, useState } from "react";
import { Box, Text, useInput } from "ink";
import chalk from "chalk";
import { useChatState, useChatActions } from "../contexts/ChatContext.js";
import { formatHistoryForDisplay } from "../utils/formatHistory.js";
import { colors, theme } from "../theme/colors.js";

const HELP_TEXT = `## Available Commands

- **/help** - Show this help message
- **/clear** - Clear chat history
- **/profile** - Show current agent profile
- **/history** - Show LLM message history
- **/memory** - Show the current system prompt
- **/model** - Show current model or switch models
- **/exit** - Exit the application

**Multi-line input:**
- Shift+Enter or Ctrl+J to insert newline
- Type \\ at end of line then Enter

**Cursor navigation:**
- Left/Right arrows to move cursor
- Up/Down arrows to navigate input history
- Ctrl+A to move to start, Ctrl+E to move to end
- Ctrl+U to clear line`;

// --- Input State and Actions (following gemini-cli reducer pattern) ---

interface InputState {
  text: string;
  cursorPos: number;
}

type InputAction =
  | { type: "insert"; payload: string }
  | { type: "backspace" }
  | { type: "delete" }
  | { type: "move"; payload: "left" | "right" | "home" | "end" }
  | { type: "move_to"; payload: number }
  | { type: "clear" }
  | { type: "set_text"; payload: { text: string; cursorPos?: number } };

function inputReducer(state: InputState, action: InputAction): InputState {
  switch (action.type) {
    case "insert": {
      const { text, cursorPos } = state;
      const newText =
        text.slice(0, cursorPos) + action.payload + text.slice(cursorPos);
      return {
        text: newText,
        cursorPos: cursorPos + action.payload.length,
      };
    }
    case "backspace": {
      if (state.cursorPos === 0) return state;
      const { text, cursorPos } = state;
      return {
        text: text.slice(0, cursorPos - 1) + text.slice(cursorPos),
        cursorPos: cursorPos - 1,
      };
    }
    case "delete": {
      const { text, cursorPos } = state;
      if (cursorPos >= text.length) return state;
      return {
        text: text.slice(0, cursorPos) + text.slice(cursorPos + 1),
        cursorPos,
      };
    }
    case "move": {
      const { text, cursorPos } = state;
      let newPos = cursorPos;
      switch (action.payload) {
        case "left":
          newPos = Math.max(0, cursorPos - 1);
          break;
        case "right":
          newPos = Math.min(text.length, cursorPos + 1);
          break;
        case "home":
          newPos = 0;
          break;
        case "end":
          newPos = text.length;
          break;
      }
      return { ...state, cursorPos: newPos };
    }
    case "move_to": {
      const newPos = Math.max(0, Math.min(state.text.length, action.payload));
      return { ...state, cursorPos: newPos };
    }
    case "clear":
      return { text: "", cursorPos: 0 };
    case "set_text":
      return {
        text: action.payload.text,
        cursorPos: action.payload.cursorPos ?? action.payload.text.length,
      };
    default:
      return state;
  }
}

// --- Component ---

interface InputAreaProps {
  onExit: () => void;
  width?: number;
}

export const InputArea = React.memo(function InputArea({
  onExit,
  width,
}: InputAreaProps): React.ReactElement {
  const [state, dispatch] = useReducer(inputReducer, {
    text: "",
    cursorPos: 0,
  });
  const { text: input, cursorPos } = state;

  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const { isLoading, profile } = useChatState();
  const {
    sendMessage,
    addSystemMessage,
    clearHistory,
    getLLMHistory,
    getSystemPrompt,
    switchModel,
    getCurrentModel,
    listModels,
  } = useChatActions();

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      // Add to input history
      if (
        inputHistory.length === 0 ||
        inputHistory[inputHistory.length - 1] !== trimmed
      ) {
        setInputHistory((prev) => [...prev, trimmed]);
      }
      setHistoryIndex(-1);

      // Handle slash commands
      if (trimmed.startsWith("/")) {
        const command = trimmed.slice(1).toLowerCase();

        if (command === "exit" || command === "quit" || command === "q") {
          onExit();
          return;
        }

        if (command === "clear") {
          clearHistory();
          dispatch({ type: "clear" });
          return;
        }

        if (command === "help") {
          addSystemMessage(HELP_TEXT);
          dispatch({ type: "clear" });
          return;
        }

        if (command === "profile") {
          if (profile) {
            const profileText = `## Current Agent Profile

- **Name:** ${profile.displayName}
- **Version:** ${profile.version}
- **Description:** ${profile.description}
${profile.purpose ? `- **Purpose:** ${profile.purpose}` : ""}`;
            addSystemMessage(profileText);
          } else {
            addSystemMessage("No profile loaded.");
          }
          dispatch({ type: "clear" });
          return;
        }

        if (command === "history") {
          const llmHistory = getLLMHistory();
          addSystemMessage(formatHistoryForDisplay(llmHistory));
          dispatch({ type: "clear" });
          return;
        }

        if (command === "memory") {
          const systemPrompt = getSystemPrompt();
          const memoryText = `## System Prompt\n\n\`\`\`\n${systemPrompt}\n\`\`\``;
          addSystemMessage(memoryText);
          dispatch({ type: "clear" });
          return;
        }

        if (command === "model" || command.startsWith("model ")) {
          const modelArg = command.slice(6).trim();
          if (modelArg) {
            // Switch to specified model
            await switchModel(modelArg);
          } else {
            // Show current model and list available
            const currentModel = getCurrentModel();
            addSystemMessage(
              `Current model: **${currentModel}**\n\nLoading available models...`,
            );
            await listModels();
          }
          dispatch({ type: "clear" });
          return;
        }

        addSystemMessage(
          `Unknown command: ${trimmed}. Type /help for available commands.`,
        );
        dispatch({ type: "clear" });
        return;
      }

      dispatch({ type: "clear" });
      await sendMessage(trimmed);
    },
    [
      sendMessage,
      addSystemMessage,
      clearHistory,
      onExit,
      profile,
      getLLMHistory,
      getSystemPrompt,
      switchModel,
      getCurrentModel,
      listModels,
      inputHistory,
    ],
  );

  // Handle keyboard input using Ink's useInput
  useInput(
    (char, key) => {
      if (isLoading) return;

      // Ctrl+C: exit
      if (key.ctrl && char === "c") {
        onExit();
        return;
      }

      // Ctrl+A: move to start
      if (key.ctrl && char === "a") {
        dispatch({ type: "move", payload: "home" });
        return;
      }

      // Ctrl+E: move to end
      if (key.ctrl && char === "e") {
        dispatch({ type: "move", payload: "end" });
        return;
      }

      // Ctrl+U: clear line
      if (key.ctrl && char === "u") {
        dispatch({ type: "clear" });
        return;
      }

      // Ctrl+J: insert newline
      if (key.ctrl && (char === "j" || char === "\n")) {
        dispatch({ type: "insert", payload: "\n" });
        return;
      }

      // Left arrow
      if (key.leftArrow) {
        dispatch({ type: "move", payload: "left" });
        return;
      }

      // Right arrow
      if (key.rightArrow) {
        dispatch({ type: "move", payload: "right" });
        return;
      }

      // Up arrow: history or move up line
      if (key.upArrow) {
        if (input.length === 0 && inputHistory.length > 0) {
          if (historyIndex === -1) {
            const newIndex = inputHistory.length - 1;
            setHistoryIndex(newIndex);
            dispatch({
              type: "set_text",
              payload: { text: inputHistory[newIndex] },
            });
          } else if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            dispatch({
              type: "set_text",
              payload: { text: inputHistory[newIndex] },
            });
          }
        } else if (input.includes("\n")) {
          // Move to previous line
          const beforeCursor = input.slice(0, cursorPos);
          const lastNewline = beforeCursor.lastIndexOf("\n");
          if (lastNewline === -1) {
            dispatch({ type: "move", payload: "home" });
          } else {
            const currentCol = cursorPos - lastNewline - 1;
            const prevLineStart =
              beforeCursor.lastIndexOf("\n", lastNewline - 1) + 1;
            const prevLineLen = lastNewline - prevLineStart;
            dispatch({
              type: "move_to",
              payload: prevLineStart + Math.min(currentCol, prevLineLen),
            });
          }
        }
        return;
      }

      // Down arrow: history or move down line
      if (key.downArrow) {
        if (historyIndex !== -1) {
          if (historyIndex < inputHistory.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            dispatch({
              type: "set_text",
              payload: { text: inputHistory[newIndex] },
            });
          } else {
            setHistoryIndex(-1);
            dispatch({ type: "clear" });
          }
        } else if (input.includes("\n")) {
          // Move to next line
          const beforeCursor = input.slice(0, cursorPos);
          const afterCursor = input.slice(cursorPos);
          const lineStart = beforeCursor.lastIndexOf("\n") + 1;
          const currentCol = cursorPos - lineStart;
          const nextNewline = afterCursor.indexOf("\n");
          if (nextNewline === -1) {
            dispatch({ type: "move", payload: "end" });
          } else {
            const nextLineStart = cursorPos + nextNewline + 1;
            const nextLineEnd = input.indexOf("\n", nextLineStart);
            const nextLineLen =
              nextLineEnd === -1
                ? input.length - nextLineStart
                : nextLineEnd - nextLineStart;
            dispatch({
              type: "move_to",
              payload: nextLineStart + Math.min(currentCol, nextLineLen),
            });
          }
        }
        return;
      }

      // Shift+Enter or Meta+Enter: insert newline
      if (key.return && (key.shift || key.meta)) {
        dispatch({ type: "insert", payload: "\n" });
        return;
      }

      // Enter: submit or backslash continuation
      // Check both key.return and char === '\r' for PTY compatibility
      // Only treat single '\r' as Enter (not '\r' within pasted content)
      if (key.return || (char === "\r" && char.length === 1)) {
        if (input.endsWith("\\")) {
          dispatch({
            type: "set_text",
            payload: { text: input.slice(0, -1) + "\n" },
          });
          return;
        }
        handleSubmit(input);
        return;
      }

      // Backspace
      if (key.backspace || key.delete) {
        dispatch({ type: "backspace" });
        return;
      }

      // Regular character input (including paste)
      if (char && !key.ctrl && !key.meta) {
        // Filter out bracketed paste mode escape sequences and control characters
        // Terminal sends \x1b[200~ at start and \x1b[201~ at end of paste
        /* eslint-disable no-control-regex */
        const cleanedChar = char
          .replace(/\x1b\[200~/g, "") // Remove paste start marker
          .replace(/\x1b\[201~/g, "") // Remove paste end marker
          .replace(/\x1b\[\d+~/g, "") // Remove any escape sequences like \x1b[200~
          .replace(/\x1b\[[\d;]*[A-Za-z]/g, "") // Remove ANSI escape sequences
          .replace(/\x1b/g, "") // Remove standalone ESC characters
          /* eslint-enable no-control-regex */
          .replace(/\[200~/g, "") // Remove marker without ESC (readline may consume it)
          .replace(/\[201~/g, "") // Remove marker without ESC
          .replace(/\r\n/g, "\n") // Normalize Windows line endings
          .replace(/\r/g, "\n"); // Normalize Mac line endings (but not Enter key)

        if (cleanedChar) {
          dispatch({ type: "insert", payload: cleanedChar });
        }
      }
    },
    { isActive: !isLoading },
  );

  // Render input with cursor (gemini-cli style)
  const renderInputWithCursor = () => {
    const placeholder =
      inputHistory.length > 0
        ? "  Type your message or ↑ for history"
        : "  Type your message";

    // Show placeholder when empty
    if (!input) {
      if (isLoading) {
        return <Text color={theme.text.secondary}>{placeholder}</Text>;
      }
      // Cursor on first character of placeholder when focused
      return (
        <Text>
          {chalk.inverse(placeholder[0] || " ")}
          <Text color={theme.text.secondary}>{placeholder.slice(1)}</Text>
        </Text>
      );
    }

    // Render text with cursor
    const lines = input.split("\n");
    let charCount = 0;

    return (
      <Box flexDirection="column">
        {lines.map((line, lineIdx) => {
          const lineStart = charCount;
          const lineEnd = lineStart + line.length;
          charCount = lineEnd + 1; // +1 for newline

          const isCursorOnLine = cursorPos >= lineStart && cursorPos <= lineEnd;
          const cursorCol = cursorPos - lineStart;

          if (isCursorOnLine) {
            const beforeCursor = line.slice(0, cursorCol);
            const charAtCursor = line[cursorCol] || " ";
            const afterCursor = line.slice(cursorCol + 1);

            return (
              <Text key={lineIdx}>
                {beforeCursor}
                {chalk.inverse(charAtCursor)}
                {afterCursor}
              </Text>
            );
          }

          return <Text key={lineIdx}>{line || " "}</Text>;
        })}
      </Box>
    );
  };

  const lineColor = isLoading ? theme.border.default : colors.border;
  const promptColor = isLoading ? colors.warning : colors.primary;

  return (
    <Box flexDirection="column" width={width}>
      {/* Horizontal line separator (gemini-cli style) */}
      <Box
        width="100%"
        borderStyle="single"
        borderTop={true}
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderColor={lineColor}
      />

      {/* Input content - no box, just prompt and text */}
      <Box paddingX={1} flexDirection="row" alignItems="flex-start">
        {/* Prompt indicator */}
        <Text color={promptColor}>{isLoading ? "●" : ">"} </Text>

        {/* Input content area */}
        <Box flexGrow={1} flexDirection="column">
          {renderInputWithCursor()}
        </Box>
      </Box>
    </Box>
  );
});
