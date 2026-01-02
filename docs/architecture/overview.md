# Beans Agent Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────────────────┐  │
│  │ args.ts │  │ app.ts  │  │ Interactive Chat Loop       │  │
│  │         │──│         │──│ (readline-based)            │  │
│  │ Parsing │  │ Router  │  │                             │  │
│  └─────────┘  └─────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Core Layer                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    ChatSession                       │    │
│  │  - System prompt (set once)                         │    │
│  │  - Message history (accumulates)                    │    │
│  │  - sendMessage() → returns response                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│         ┌────────────────────┼────────────────────┐         │
│         ▼                    ▼                    ▼         │
│  ┌─────────────┐      ┌─────────────┐      ┌───────────┐   │
│  │  LLMClient  │      │ ToolRegistry│      │  Config   │   │
│  │             │      │             │      │           │   │
│  │ - chat()    │      │ - getTool() │      │ - load()  │   │
│  │ - stream()  │      │ - register()│      │ - save()  │   │
│  └─────────────┘      └─────────────┘      └───────────┘   │
│         │                    │                               │
│         ▼                    ▼                               │
│  ┌─────────────┐      ┌─────────────┐                       │
│  │  Providers  │      │ Built-in    │                       │
│  │ - OpenAI    │      │ Tools       │                       │
│  │ - Anthropic │      │ - read_file │                       │
│  │ - Google    │      │ - write_file│                       │
│  │ - Ollama    │      │ - shell     │                       │
│  └─────────────┘      │ - glob      │                       │
│                       │ - grep      │                       │
│                       └─────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Interactive Chat Flow

```
User Input
    │
    ▼
┌────────────────┐
│ ChatSession    │
│ sendMessage()  │
│                │
│ 1. Add user    │
│    message to  │
│    history     │
│                │
│ 2. Call LLM    │◄─── System prompt (in config, not repeated)
│    with:       │◄─── All accumulated messages
│    - messages  │◄─── Tool definitions
│    - tools     │
│                │
│ 3. Process     │
│    response    │
│                │
│ 4. If tool     │────► Execute tools in parallel
│    calls:      │◄──── Add results to history
│    loop back   │
│                │
│ 5. Return      │
│    response    │
└────────────────┘
    │
    ▼
Display to User
```

### Single Prompt Flow

```
User Prompt
    │
    ▼
┌────────────────┐
│ AgentExecutor  │
│ execute()      │
│                │
│ 1. Build fresh │
│    messages    │
│                │
│ 2. Execute     │
│    agent loop  │
│                │
│ 3. Return      │
│    result      │
└────────────────┘
    │
    ▼
Exit
```

## Key Design Decisions

### 1. Session Management (gemini-cli pattern)

- **System prompt**: Set once in ChatSession config, NOT in message history
- **History**: Only user/assistant/tool messages accumulate
- **Stateful**: Single ChatSession instance maintains conversation state

### 2. Provider Abstraction

- **LLMClient interface**: Unified API for all providers
- **Factory pattern**: `createLLMClient()` based on config
- **Tool formatting**: Provider-specific tool definition adaptation

### 3. Tool System

- **Registry pattern**: Central registry for tool discovery
- **Base class**: `BaseTool` for consistent interface
- **Parallel execution**: Tool calls executed concurrently

## Module Dependencies

```
@beans/cli
    │
    └──► @beans/core
              │
              ├──► agents/ (ChatSession, AgentExecutor)
              │
              ├──► tools/ (ToolRegistry, built-in tools)
              │
              ├──► llm/ (LLMClient, providers)
              │
              ├──► config/ (Config, settings)
              │
              └──► context/ (SessionManager, WorkspaceService)
```

## Configuration Hierarchy

1. **Default config**: Hardcoded defaults in code
2. **User config**: `~/.config/beans-agent/settings.json`
3. **Project config**: `.beans/settings.json` (overrides user)
4. **CLI flags**: `--model`, `--yolo` (overrides all)

## Error Handling

- **Tool errors**: Caught and returned as tool result with error field
- **LLM errors**: Propagated up, terminate agent loop
- **Config errors**: Graceful fallback to defaults
