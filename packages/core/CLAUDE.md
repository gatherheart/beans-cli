# @beans/core - AI Agent Framework Core

## Overview

This is the core package containing the fundamental building blocks for the AI agent framework. It provides agents, tools, LLM clients, configuration management, and context handling.

## Architecture

```
packages/core/src/
├── agents/           # Agent execution engine
│   ├── executor.ts   # AgentExecutor - runs the agent loop
│   ├── types.ts      # Agent types and interfaces
│   └── registry.ts   # Agent registry for managing agents
├── tools/            # Tool system
│   ├── registry.ts   # ToolRegistry - manages available tools
│   ├── base-tool.ts  # BaseTool - base class for tools
│   ├── types.ts      # Tool types and interfaces
│   └── builtin/      # Built-in tools
│       ├── read-file.ts
│       ├── write-file.ts
│       ├── shell.ts
│       ├── glob.ts
│       └── grep.ts
├── llm/              # LLM client providers
│   ├── client.ts     # LLM client factory
│   ├── types.ts      # LLM types and interfaces
│   └── providers/    # Provider implementations
├── config/           # Configuration management
│   ├── config.ts     # Config singleton
│   ├── settings.ts   # Settings file management
│   ├── env.ts        # Environment variables
│   └── types.ts      # Config types
└── context/          # Context management
    ├── session.ts    # SessionManager - tracks conversation
    ├── workspace.ts  # WorkspaceService - workspace context
    └── types.ts      # Context types
```

## Key Components

### AgentExecutor (`agents/executor.ts`)
The main agent loop that:
1. Takes an AgentDefinition with prompt config, model config, and tool config
2. Calls the LLM with messages and available tools
3. Executes tool calls in parallel
4. Accumulates messages in the conversation history
5. Terminates on completion, max turns, timeout, or error

**Important**: The executor creates a new message array for each `execute()` call. For multi-turn chat, pass previous messages via `promptConfig.initialMessages`.

### ToolRegistry (`tools/registry.ts`)
Manages available tools:
- Register/unregister tools
- Get tool by name
- Get all tool definitions for LLM

### LLM Client (`llm/client.ts`)
Factory pattern for creating provider-specific clients:
- OpenAI, Anthropic, Google, Ollama support
- Unified interface for all providers
- Handles tool call formatting per provider

### Config (`config/config.ts`)
Singleton configuration manager:
- Loads settings from `~/.config/beans-agent/settings.json` or `.beans/settings.json`
- Provides LLM config, agent config, tool registry
- Creates LLM client based on configuration

## Session Management Pattern

Following gemini-cli's approach:
- **System instructions**: Set once in config, NOT repeated in message history
- **Message history**: Accumulates user/assistant/tool messages only
- **Single chat session**: Maintain one executor instance for the session

## Development Guidelines

1. **Adding New Tools**: Extend `BaseTool` and register in `tools/builtin/index.ts`
2. **Adding LLM Providers**: Implement `LLMClient` interface in `llm/providers/`
3. **Message Types**: Use `Message` type from `agents/types.ts`
4. **Export Everything**: Add new exports to the module's `index.ts`

## Testing

Run tests with:
```bash
npm test --workspace @beans/core
```
