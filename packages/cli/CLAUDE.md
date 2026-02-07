# @beans/cli - Command Line Interface

## Overview

The CLI package provides the command-line interface for the AI agent framework. It supports both single-prompt execution and interactive continuous chat mode with dynamic agent profiles.

## Architecture

```
packages/cli/src/
├── index.ts              # Entry point - parses args and runs app
├── args.ts               # CLI argument parsing
├── app.tsx               # Main application logic and routing
└── ui/
    ├── App.tsx           # Root Ink component
    ├── contexts/
    │   └── ChatContext.tsx    # State and actions contexts (gemini-cli pattern)
    ├── hooks/
    │   ├── useChatHistory.ts  # Custom hook for message management
    │   └── useTerminalSize.ts # Terminal resize detection
    ├── theme/
    │   └── colors.ts          # Centralized pastel color palette
    ├── utils/
    │   └── formatHistory.ts   # LLM history formatting
    └── components/
        ├── ChatView.tsx       # Message history display
        ├── Message.tsx        # Individual message renderer
        ├── MarkdownDisplay.tsx # Markdown terminal rendering
        └── InputArea.tsx      # User input with cursor navigation
```

## Key Components

### Entry Point (`index.ts`)
- Parses command-line arguments via `parseArgs()`
- Displays help and version info
- Handles `--list-models` command
- Calls `runApp()` with parsed arguments

### Argument Parser (`args.ts`)

| Argument | Short | Description |
|----------|-------|-------------|
| `prompt` | - | Initial prompt (positional) |
| `--help` | `-h` | Show help message |
| `--version` | `-v` | Show version |
| `--continue` | `-c` | Continue previous session |
| `--model` | `-m` | Override model |
| `--interactive` | `-i` | Force interactive mode |
| `--agent` | `-a` | Agent description (generates via LLM) |
| `--agent-profile` | - | Path to agent profile (.md file) |
| `--yolo` | - | Auto-approve all tool calls |
| `--verbose` | - | Verbose output |
| `--cwd` | - | Working directory |
| `--list-models` | - | List available models |
| `--debug` | - | Enable debug mode |
| `--ui-test` | - | Enable UI test mode with mock LLM |
| `--ui-test-scenario` | - | UI test scenario (see UI Testing section) |

### Application (`app.tsx`)

**runApp(args)**
1. Initialize Config singleton
2. Apply model/yolo/debug overrides
3. Initialize WorkspaceService and SessionManager
4. Resolve agent profile (see Profile Resolution below)
5. Route to single prompt or interactive mode

**runSinglePrompt()**
- Creates `AgentExecutor` instance
- Executes with streaming output
- Displays tool calls and results
- Prints session summary

**runInteractiveChat()**
- Renders Ink-based React UI
- Uses ChatProvider for state management
- Handles slash commands via InputArea

## UI Architecture (gemini-cli pattern)

### Context Separation

Following gemini-cli patterns, contexts are split for performance:

```typescript
// ChatStateContext - read-only state
const { messages, isLoading, error, profile } = useChatState();

// ChatActionsContext - action handlers
const { sendMessage, addSystemMessage, clearHistory } = useChatActions();

// Combined (deprecated, use separate hooks)
const all = useChatContext();
```

### Custom Hooks

**useChatHistory** - Encapsulates message management:
```typescript
const history = useChatHistory();
history.addUserMessage(content);
history.addAssistantMessage();
history.updateMessageContent(id, content);
history.updateMessageToolCalls(id, toolCalls);
history.completeMessage(id);
history.removeMessage(id);
history.clearMessages();
```

### Component Responsibilities

| Component | Context Usage | Purpose |
|-----------|---------------|---------|
| ChatView | `useChatState()` | Display messages, errors |
| InputArea | `useChatState()` + `useChatActions()` | Handle input, slash commands |
| AppContent | `useChatState()` + `useChatActions()` | Initial prompt, layout |

## Profile Resolution Order

The `resolveAgentProfile()` function resolves profiles in order:

1. **Explicit file** (`--agent-profile <path>`)
2. **Generate via LLM** (`-a <description>`)
3. **Workspace profile** (`.beans/agent.md`)
4. **Default plugin** (`plugins/general-assistant/agents/default.md`)
5. **Hardcoded fallback** (`DEFAULT_AGENT_PROFILE`)

Generated profiles are saved to `.beans/agent-profile.md`.

## Session Management

Following gemini-cli patterns:
- **ChatSession**: Single instance for interactive mode
- **System prompt**: Set once at session creation
- **Message history**: Accumulates across turns

## Usage Examples

```bash
# Interactive mode (default when no prompt)
npm run dev

# Single prompt mode
npm run dev "your prompt here"

# Interactive with initial prompt
npm run dev -- -i "initial prompt"

# With specific model
npm run dev -- -m gemini-2.0-flash "prompt"

# Auto-approve tools
npm run dev -- --yolo "prompt"

# With custom agent (generates profile via LLM)
npm run dev -- -a "A helpful coding assistant for TypeScript"

# Load agent from profile file
npm run dev -- --agent-profile ./plugins/code-development/agents/code-reviewer.md

# List available models
npm run dev -- --list-models

# Enable debug mode
npm run dev -- --debug

# UI test mode with mock LLM
npm run dev -- --ui-test

# UI test with specific scenario
npm run dev -- --ui-test --ui-test-scenario rapid-stream
```

## UI Testing

The CLI includes a comprehensive UI testing framework using mock LLM responses. Use `--ui-test` to enable mock mode, optionally with `--ui-test-scenario` to select a specific scenario.

### Available Scenarios

| Scenario | Purpose |
|----------|---------|
| `basic` | Default markdown rendering test |
| `long-content` | Tests scrolling and large output |
| `rapid-stream` | Tests for flickering (1ms delay) |
| `tool-calls` | Tests tool call UI display |
| `empty-response` | Tests empty response handling |
| `multi-turn` | Tests conversation context |
| `slow-stream` | Tests input visibility (200ms delay) |
| `error` | Tests error handling display |

### Verification Checklist

When testing UI changes, verify:

1. **No Flickering**: Run `rapid-stream` scenario, no screen flashing
2. **Input Visibility**: Run `slow-stream`, can type during streaming
3. **Output Display**: Run `long-content`, all content visible
4. **Tool UI**: Run `tool-calls`, spinners and checkmarks work
5. **Error Handling**: Run `error`, error displays gracefully

See `docs/guides/ui-testing.md` for full verification procedures.

## Slash Commands (Interactive Mode)

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear chat history |
| `/profile` | Show current agent profile |
| `/history` | Show LLM message history |
| `/memory` | Show current system prompt |
| `/exit`, `/quit`, `/q` | Exit the application |

## Input Controls

| Key | Action |
|-----|--------|
| Enter | Submit message |
| Shift+Enter, Ctrl+J | Insert newline |
| `\` + Enter | Insert newline (removes backslash) |
| Left/Right Arrow | Move cursor |
| Ctrl+A | Move cursor to start |
| Ctrl+E | Move cursor to end |
| Ctrl+U | Clear input line |
| Ctrl+C | Exit application |

## Color Theme

Colors are centralized in `ui/theme/colors.ts`:

| Color | Hex | Usage |
|-------|-----|-------|
| primary | #87CEFA | Input border, list bullets |
| user | #DDA0DD | User message prefix |
| assistant | #98FB98 | Assistant message prefix |
| system | #F0E68C | System message prefix |
| success | #98FB98 | Tool completion |
| warning | #F0E68C | Processing indicator |
| error | #FFB6C1 | Error messages |
| header | #B0C4DE | Markdown headers |

## Debug Mode

When `--debug` flag is used, LLM requests and responses are logged to:
```
~/.beans/logs/debug.log
```

## Development Guidelines

1. **Reference gemini-cli**: Always refer to `../gemini-cli` for patterns
2. **Context separation**: Use `useChatState()` and `useChatActions()` separately
3. **Custom hooks**: Extract domain logic into reusable hooks
4. **Stream output**: Use activity callbacks for streaming responses
5. **Profile format**: Only Markdown files supported (.md)

## Testing

```bash
npm test --workspace @beans/cli
```
