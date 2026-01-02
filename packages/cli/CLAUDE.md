# @beans/cli - Command Line Interface

## Overview

The CLI package provides the command-line interface for the AI agent framework. It supports both single-prompt execution and interactive continuous chat mode.

## Architecture

```
packages/cli/src/
├── index.ts          # Entry point - parses args and runs app
├── args.ts           # CLI argument parsing
└── app.ts            # Main application logic
    ├── runApp()              # Main entry, initializes config and executor
    ├── runSinglePrompt()     # Single prompt execution (non-interactive)
    └── runInteractiveChat()  # Continuous chat loop with readline
```

## Key Components

### Entry Point (`index.ts`)
- Parses command-line arguments via `parseArgs()`
- Calls `runApp()` with parsed arguments
- Handles errors and exits

### Argument Parser (`args.ts`)
Supported arguments:
- `prompt` - Initial prompt (positional)
- `-h, --help` - Show help
- `-v, --version` - Show version
- `-c, --continue` - Continue previous session
- `-m, --model <name>` - Override model
- `-i, --interactive` - Force interactive mode
- `--yolo` - Auto-approve all tool calls
- `--verbose` - Verbose output
- `--cwd <path>` - Working directory
- `--list-models` - List available models

### Application (`app.ts`)

**runApp(args)**
1. Initialize Config singleton
2. Apply model/yolo overrides
3. Initialize WorkspaceService and SessionManager
4. Create AgentExecutor with LLM client and tool registry
5. Route to single prompt or interactive mode

**runSinglePrompt()**
- Execute once with the provided prompt
- Stream output and tool calls to console
- Print session summary and exit

**runInteractiveChat()**
- Uses Node.js `readline` for input
- Maintains `conversationHistory: Message[]` for multi-turn context
- Supports slash commands: `/help`, `/clear`, `/exit`
- Passes previous messages via `initialMessages` for context

## Session Management

Following gemini-cli patterns:
- **Single session**: One AgentExecutor instance per chat session
- **History accumulation**: Messages added to `conversationHistory` array
- **System prompt**: Passed once in `promptConfig.systemPrompt`, not in history
- **Multi-turn context**: Previous messages passed via `initialMessages`

## Usage

```bash
# Interactive mode (default when no prompt)
npm run dev

# Single prompt mode
npm run dev "your prompt here"

# Interactive with initial prompt
npm run dev -- -i "initial prompt"

# With specific model
npm run dev -- -m gpt-4o "prompt"

# Auto-approve tools
npm run dev -- --yolo "prompt"
```

## Slash Commands (Interactive Mode)

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear chat history |
| `/exit`, `/quit`, `/q` | Exit the application |

## Development Guidelines

1. **Reference gemini-cli**: Always refer to `../gemini-cli` for patterns
2. **Keep it simple**: Use Node.js readline, not complex UI frameworks
3. **Stream output**: Use `process.stdout.write()` for streaming responses
4. **Handle errors**: Catch and display errors gracefully

## Testing

```bash
npm test --workspace @beans/cli
```
