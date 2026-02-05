# Beans Agent

A dynamic AI agent framework with plugin-based agents, built-in tools, and multi-provider LLM support.

## Features

- **Plugin-based Agent System** - Define agents as Markdown files with YAML frontmatter
- **Multiple LLM Providers** - Google Gemini, Ollama (local)
- **Built-in Tools** - File operations, shell commands, glob, grep
- **Ink-based CLI** - React-powered terminal UI with markdown rendering
- **Streaming Responses** - Real-time output with tool call progress

## Installation

```bash
npm install
npm run build
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and add your API key:

```bash
cp .env.example .env
```

Edit `.env`:
```
# Google AI (default provider)
GOOGLE_API_KEY=AIza...
```

### Settings File

**User settings** (applies globally):
```
~/.config/beans-agent/settings.json
```

**Project settings** (overrides user settings):
```
.beans/settings.json
```

Example settings:
```json
{
  "llm": {
    "provider": "google",
    "model": "gemini-2.0-flash",
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "agent": {
    "maxTurns": 50,
    "timeoutMs": 300000,
    "streaming": true,
    "autoApprove": "none"
  },
  "tools": {
    "enabled": ["read_file", "write_file", "shell", "glob", "grep"],
    "disabled": []
  }
}
```

## Usage

### Interactive Mode

```bash
# Start interactive chat
npm run dev

# With initial prompt
npm run dev -- -i "help me understand this codebase"
```

Interactive commands:
| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/profile` | View current agent profile |
| `/clear` | Clear chat history |
| `/exit` | Exit application |

### Single Prompt Mode

```bash
# Run with a prompt
npm run dev "fix the bug in main.ts"

# With specific model
npm run dev -- --model gemini-2.5-pro "add unit tests"

# List available models
npm run dev -- --list-models

# Auto-approve all tool calls
npm run dev -- --yolo "refactor the auth module"
```

### Agent Profiles

```bash
# Use specific agent from plugins
npm run dev -- --agent-profile ./plugins/code-development/agents/code-reviewer.md

# Generate agent from description
npm run dev -- -a "A security-focused code reviewer"
```

### CLI Options

```
beans [options] [prompt]

Options:
  -h, --help            Show help message
  -v, --version         Show version number
  -m, --model           Specify model to use
  -a, --agent           Generate agent from description
  --agent-profile       Use specific agent profile file
  -i, --interactive     Force interactive mode
  --list-models         List available models
  --yolo                Auto-approve all tool calls
  --verbose             Verbose output
  --debug               Show LLM requests and responses
  --cwd                 Set working directory
```

## Supported Providers

| Provider | Models | API Key |
|----------|--------|---------|
| `google` | `gemini-2.0-flash`, `gemini-2.5-pro` | `GOOGLE_API_KEY` |
| `ollama` | Any local model | (none required) |

### Provider Examples

**Google (default):**
```json
{
  "llm": {
    "provider": "google",
    "model": "gemini-2.0-flash"
  }
}
```

**Ollama (local):**
```json
{
  "llm": {
    "provider": "ollama",
    "model": "llama3.2",
    "baseUrl": "http://localhost:11434"
  }
}
```

## Built-in Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Create or modify files |
| `shell` | Execute shell commands |
| `glob` | Find files matching patterns |
| `grep` | Search file contents |

## Project Structure

```
beans-code/
├── packages/
│   ├── core/                 # Core framework
│   │   └── src/
│   │       ├── agents/       # Agent execution engine
│   │       ├── tools/        # Tool system
│   │       ├── llm/          # LLM providers
│   │       └── config/       # Configuration
│   └── cli/                  # Command line interface
│       └── src/
│           ├── ui/           # Ink-based React UI
│           └── app.tsx       # Main application
├── plugins/                  # Agent definitions
│   ├── general-assistant/    # Default agent
│   ├── code-development/     # Code-focused agents
│   └── devops-operations/    # DevOps agents
├── docs/
│   ├── sop/                  # Development guidelines
│   ├── prd/                  # Feature specifications
│   ├── guides/               # Implementation guides
│   ├── issues/               # Problems and solutions
│   └── architecture/         # System design
└── CLAUDE.md                 # AI assistant instructions
```

## Development

```bash
# Run in development mode
npm run dev

# Build all packages
npm run build

# Run tests
npm test

# Full validation (build, test, typecheck, lint)
npm run preflight
```

## Documentation

| Folder | Purpose |
|--------|---------|
| [docs/sop/](docs/sop/) | Development guidelines, coding standards |
| [docs/prd/](docs/prd/) | Feature specifications with status tracking |
| [docs/guides/](docs/guides/) | Implementation explanations |
| [docs/issues/](docs/issues/) | Problems encountered and solutions |
| [docs/architecture/](docs/architecture/) | System design documentation |

## License

MIT
