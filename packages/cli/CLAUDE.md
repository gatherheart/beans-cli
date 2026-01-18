# @beans/cli - Command Line Interface

## Overview

The CLI package provides the command-line interface for the AI agent framework. It supports both single-prompt execution and interactive continuous chat mode with dynamic agent profiles.

## Architecture

```
packages/cli/src/
├── index.ts          # Entry point - parses args and runs app
├── args.ts           # CLI argument parsing
└── app.ts            # Main application logic
    ├── runApp()              # Main entry, initializes config and loads profile
    ├── runSinglePrompt()     # Single prompt execution (non-interactive)
    ├── runInteractiveChat()  # Continuous chat loop with readline
    ├── resolveAgentProfile() # Profile resolution logic
    └── resolveSOP()          # SOP resolution logic
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
| `--sop` | - | SOP text to inject |
| `--sop-file` | - | Path to SOP file |
| `--yolo` | - | Auto-approve all tool calls |
| `--verbose` | - | Verbose output |
| `--cwd` | - | Working directory |
| `--list-models` | - | List available models |

### Application (`app.ts`)

**runApp(args)**
1. Initialize Config singleton
2. Apply model/yolo overrides
3. Initialize WorkspaceService and SessionManager
4. Resolve agent profile (see Profile Resolution below)
5. Apply SOP if provided
6. Route to single prompt or interactive mode

**runSinglePrompt()**
- Creates `AgentExecutor` instance
- Executes with streaming output
- Displays tool calls and results
- Prints session summary

**runInteractiveChat()**
- Creates `ChatSession` instance (persistent across turns)
- Uses Node.js `readline` for input
- Handles slash commands
- System prompt set once, history accumulates

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
- **SOP updates**: Via `/sop` command or `updateSystemPrompt()`

## Usage Examples

```bash
# Interactive mode (default when no prompt)
npm run dev

# Single prompt mode
npm run dev "your prompt here"

# Interactive with initial prompt
npm run dev -- -i "initial prompt"

# With specific model
npm run dev -- -m gemini-2.0-flash-exp "prompt"

# Auto-approve tools
npm run dev -- --yolo "prompt"

# With custom agent (generates profile via LLM)
npm run dev -- -a "A helpful coding assistant for TypeScript"

# Load agent from profile file
npm run dev -- --agent-profile ./plugins/code-development/agents/code-reviewer.md

# With SOP
npm run dev -- --sop "Always explain step by step"

# With SOP from file
npm run dev -- --sop-file ./sop.txt

# List available models
npm run dev -- --list-models
```

## Slash Commands (Interactive Mode)

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear chat history |
| `/profile` | Show current agent profile |
| `/sop <text>` | Update SOP during session |
| `/exit`, `/quit`, `/q` | Exit the application |

## Development Guidelines

1. **Reference gemini-cli**: Always refer to `../gemini-cli` for patterns
2. **Keep it simple**: Use Node.js readline, not complex UI frameworks
3. **Stream output**: Use `process.stdout.write()` for streaming responses
4. **Handle errors**: Catch and display errors gracefully
5. **Profile format**: Only Markdown files supported (.md)

## Testing

```bash
npm test --workspace @beans/cli
```
