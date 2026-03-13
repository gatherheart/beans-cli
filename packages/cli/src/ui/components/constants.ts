/**
 * Constants for UI components
 */

// Known slash commands
export const KNOWN_COMMANDS = {
  EXIT: "exit",
  QUIT: "quit",
  Q: "q",
  CLEAR: "clear",
  HELP: "help",
  PROFILE: "profile",
  HISTORY: "history",
  MEMORY: "memory",
  MODEL: "model",
  PLAN: "plan",
  MODE: "mode",
} as const;

export const KNOWN_COMMANDS_SET: Set<string> = new Set(
  Object.values(KNOWN_COMMANDS),
);

export const HELP_TEXT = `## Available Commands

- **/help** - Show this help message
- **/clear** - Clear chat history
- **/profile** - Show current agent profile
- **/history** - Show LLM message history
- **/memory** - Show the current system prompt
- **/model** - Show current model or switch models
- **/plan** - Enter plan mode (read-only, blocks writes)
- **/plan exit** - Exit plan mode
- **/mode** - Show or set approval mode (default/auto/yolo/plan)
- **/exit** - Exit the application

**Multi-line input:**
- Shift+Enter or Ctrl+J to insert newline
- Type \\ at end of line then Enter

**Cursor navigation:**
- Left/Right arrows to move cursor
- Up/Down arrows to navigate input history
- Ctrl+A to move to start, Ctrl+E to move to end
- Ctrl+U to clear line`;
