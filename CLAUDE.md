# Claude Instructions for Beans Agent

## Reference Projects

- **Patterns**: `../gemini-cli` for implementation patterns
- **Agent Structure**: https://github.com/wshobson/agents

## Project Overview

Beans Agent is a dynamic AI agent framework built as a modular CLI. It supports multiple LLM providers (Google, Ollama), includes built-in tools for file operations and shell commands, and features a plugin-based agent system.

## Architecture Overview

```
beans-code/
├── plugins/                          # Plugin-based agent system
│   ├── general-assistant/            # Default general-purpose plugin
│   │   ├── agents/
│   │   │   └── default.md            # Default agent (used when no args)
│   │   ├── commands/                 # (TODO)
│   │   └── skills/                   # (TODO)
│   ├── code-development/             # Code development plugin
│   │   ├── agents/
│   │   │   ├── code-reviewer.md
│   │   │   ├── typescript-expert.md
│   │   │   └── python-pro.md
│   │   ├── commands/
│   │   └── skills/
│   │       └── testing-patterns.md
│   └── devops-operations/            # DevOps plugin
│       ├── agents/
│       │   ├── devops-engineer.md
│       │   └── kubernetes-architect.md
│       ├── commands/
│       └── skills/
│           └── docker-patterns.md
├── packages/
│   ├── core/                         # Core framework
│   │   └── src/
│   │       ├── agents/               # Agent execution engine
│   │       ├── tools/                # Tool system and built-in tools
│   │       ├── llm/                  # LLM client providers
│   │       ├── config/               # Configuration management
│   │       └── context/              # Session and workspace context
│   └── cli/                          # Command line interface
│       └── src/
│           ├── index.ts              # Entry point
│           ├── args.ts               # CLI argument parsing
│           └── app.ts                # Main application
├── docs/
│   ├── prd/                          # Product requirement documents
│   └── architecture/                 # Architecture documentation
└── CLAUDE.md                         # This file
```

## Plugin System

Following the wshobson/agents architecture with three-layer structure:

### 1. Agents (Markdown with YAML frontmatter)

Domain specialists defined as Markdown files:

```markdown
---
name: code-reviewer
description: Expert code reviewer focusing on quality and security
---

# Code Reviewer

## Purpose
You are an expert code reviewer...

## Capabilities
- Code quality analysis
- Security review
...
```

**YAML Frontmatter Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (snake_case) |
| `description` | Yes | Brief one-line description |

### 2. Commands (TODO)

Tools and workflows for the domain.

### 3. Skills

Modular knowledge packages with triggers:

```markdown
---
name: testing-patterns
triggers:
  - write tests
  - unit test
  - mocking
---

# Testing Patterns

## Use When
User requests help with testing...

## Instructions
...
```

## Key Components

### AgentProfile (`packages/core/src/agents/profile.ts`)
- Loads agent profiles from Markdown files
- Parses YAML frontmatter for metadata (name, description)
- Uses Markdown body as system prompt
- `AgentProfileBuilder` generates profiles via LLM

### ChatSession (`packages/core/src/agents/chat-session.ts`)
- Manages continuous chat with accumulated history
- System prompt set once at session start
- Supports runtime SOP updates via `updateSystemPrompt()`

### AgentExecutor (`packages/core/src/agents/executor.ts`)
- Runs the agent loop (LLM call → tool execution → repeat)
- Handles streaming responses
- Manages turn limits and timeouts

### LLM Client (`packages/core/src/llm/`)
- Unified interface for multiple providers
- Currently supports: Google (Gemini), Ollama
- See `docs/prd/llm-interface.md` for request/response format

### Tool System (`packages/core/src/tools/`)
- Built-in tools: `read_file`, `write_file`, `shell`, `glob`, `grep`
- Extensible via `BaseTool` class
- Tools registered in `ToolRegistry`

## Profile Resolution Order

When the CLI starts, it resolves the agent profile:

1. `--agent-profile <path>` - Explicit .md file
2. `-a <description>` - Generate via LLM
3. `.beans/agent.md` - Workspace-specific profile
4. `plugins/general-assistant/agents/default.md` - Default agent
5. Hardcoded fallback

## CLI Usage

```bash
# Use default agent
beans

# Use specific agent from plugins
beans --agent-profile ./plugins/code-development/agents/code-reviewer.md

# Generate agent from description
beans -a "A security-focused code reviewer"

# Inject SOP (Standard Operating Procedure)
beans --sop "Always check for SQL injection"

# Load SOP from file
beans --sop-file ./my-sop.txt

# Auto-approve all tool calls
beans --yolo "prompt"

# List available models
beans --list-models
```

## Interactive Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/profile` | View current agent profile |
| `/sop <text>` | Update SOP during session |
| `/clear` | Clear chat history |
| `/exit` | Exit application |

## Development Guidelines

1. **Plugin Structure**: Follow `plugins/{domain}/{agents,commands,skills}/` pattern
2. **Agent Format**: Use Markdown with YAML frontmatter (name, description only)
3. **LLM Interface**: See `docs/prd/llm-interface.md` for request/response specs
4. **Tools**: Extend `BaseTool` class, register in `tools/builtin/index.ts`

## Documenting Issues and Solutions

When implementing features or fixing bugs, document all issues encountered and their solutions:

1. **Create a documentation file** in `docs/` describing:
   - Each issue/error encountered
   - The root cause
   - The solution with code examples
   - Affected files

2. **Include in documentation:**
   - Error messages (exact text)
   - Why the issue occurred
   - Step-by-step solution
   - Code snippets showing before/after

3. **Example:** See `docs/cli-ui-implementation.md` for reference

This helps future developers understand design decisions and troubleshoot similar issues.

## Before Committing

1. Ensure all CLAUDE.md files are updated
2. Run `npm run build` to verify compilation
3. Run `npm test` if tests exist
4. Update documentation if features changed
