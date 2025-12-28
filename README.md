# Beans Agent

AI-powered coding assistant framework.

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

Edit `.env`:
```
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google AI
GOOGLE_API_KEY=AIza...
```

### Settings File

Create a settings file to configure the default provider and model.

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

### Basic Usage

```bash
# Run with a prompt
npm run dev "fix the bug in main.ts"

# With specific model
npm run dev -- --model gpt-4o "add unit tests"

# List available models for current provider
npm run dev -- --list-models

# Auto-approve all tool calls (use with caution)
npm run dev -- --yolo "refactor the auth module"
```

### CLI Options

```
beans [options] [prompt]

Options:
  -h, --help       Show help message
  -v, --version    Show version number
  -c, --continue   Continue previous session
  -m, --model      Specify model to use
  --list-models    List available models for the current provider
  --yolo           Auto-approve all tool calls
  --verbose        Verbose output
  --cwd            Set working directory
```

## Supported Providers

| Provider   | Models                                      | API Key Env Var     |
|------------|---------------------------------------------|---------------------|
| `openai`   | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`     | `OPENAI_API_KEY`    |
| `anthropic`| `claude-sonnet-4-20250514`, `claude-3-5-sonnet-20241022` | `ANTHROPIC_API_KEY` |
| `google`   | `gemini-2.0-flash`, `gemini-2.5-pro`       | `GOOGLE_API_KEY`    |
| `ollama`   | Any local model                             | (none required)     |

Use `--list-models` to see all available models for your configured provider.

### Provider Examples

**OpenAI (default):**
```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o"
  }
}
```

**Anthropic:**
```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022"
  }
}
```

**Google:**
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

## Available Tools

| Tool         | Description                          |
|--------------|--------------------------------------|
| `read_file`  | Read file contents                   |
| `write_file` | Create or modify files               |
| `shell`      | Execute shell commands               |
| `glob`       | Find files matching patterns         |
| `grep`       | Search file contents                 |

## Development

```bash
# Run in development mode
npm run dev

# Build all packages
npm run build

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

## Project Structure

```
beans-code/
├── packages/
│   ├── core/          # Core framework (agents, tools, LLM clients)
│   └── cli/           # Command line interface
├── .env               # Your API keys (gitignored)
├── .env.example       # Template for environment variables
└── package.json       # Root workspace config
```

## License

MIT
