# @beans/core - AI Agent Framework Core

## Overview

This is the core package containing the fundamental building blocks for the AI agent framework. It provides agents, tools, LLM clients, configuration management, and context handling.

## Architecture

```
packages/core/src/
├── agents/               # Agent execution engine
│   ├── executor.ts       # AgentExecutor - runs the agent loop
│   ├── chat-session.ts   # ChatSession - continuous chat management
│   ├── profile.ts        # AgentProfile - profile loading/generation
│   ├── types.ts          # Agent types and interfaces
│   └── registry.ts       # Agent registry for managing agents
├── tools/                # Tool system
│   ├── registry.ts       # ToolRegistry - manages available tools
│   ├── base-tool.ts      # BaseTool - base class for tools
│   ├── types.ts          # Tool types and interfaces
│   └── builtin/          # Built-in tools
│       ├── read-file.ts
│       ├── write-file.ts
│       ├── shell.ts
│       ├── glob.ts
│       └── grep.ts
├── llm/                  # LLM client providers
│   ├── client.ts         # LLM client factory
│   ├── types.ts          # LLM types and interfaces
│   └── providers/        # Provider implementations
│       ├── google.ts     # Google (Gemini) provider
│       └── ollama.ts     # Ollama provider
├── config/               # Configuration management
│   ├── config.ts         # Config singleton
│   ├── settings.ts       # Settings file management
│   ├── env.ts            # Environment variables
│   └── types.ts          # Config types
└── context/              # Context management
    ├── session.ts        # SessionManager - tracks conversation
    ├── workspace.ts      # WorkspaceService - workspace context
    └── types.ts          # Context types
```

## Key Components

### AgentExecutor (`agents/executor.ts`)

The main agent loop:

1. Takes an `AgentDefinition` with prompt, model, and tool configs
2. Calls the LLM with messages and available tools
3. Executes tool calls in parallel
4. Accumulates messages in conversation history
5. Terminates on: completion, max turns, timeout, or error

```typescript
const executor = new AgentExecutor(llmClient, toolRegistry);
const result = await executor.execute(agentDefinition, { onActivity });
```

### ChatSession (`agents/chat-session.ts`)

Manages continuous chat with persistent history:

```typescript
const session = new ChatSession(llmClient, toolRegistry, {
  systemPrompt,  // Set once
  modelConfig,
  toolConfig,
});

await session.sendMessage("First message");   // History accumulates
await session.sendMessage("Second message");  // Has context from first
```

### AgentProfile (`agents/profile.ts`)

Loads and generates agent profiles:

```typescript
// Load from Markdown file
const profile = await loadAgentProfile('./agents/code-reviewer.md');

// Generate via LLM
const builder = new AgentProfileBuilder(llmClient, 'gemini-2.0-flash');
const profile = await builder.buildProfile({ description: '...' });

// Save to Markdown
await saveAgentProfile(profile, './my-agent.md');
```

**AgentProfile Interface:**
```typescript
interface AgentProfile {
  name: string;          // Unique identifier (snake_case)
  displayName: string;   // Human-readable name
  description: string;   // Brief description
  purpose: string;       // Agent's goals
  systemPrompt: string;  // Complete behavior definition
  version: string;
  createdAt: string;
}
```

### ToolRegistry (`tools/registry.ts`)

Manages available tools:

```typescript
const registry = new ToolRegistry();
registry.register(new ReadFileTool());
registry.register(new ShellTool());

const tool = registry.getTool('read_file');
const definitions = registry.getAllToolDefinitions();
```

### LLM Client (`llm/client.ts`)

Factory pattern for provider-specific clients:

```typescript
const client = createLLMClient('google', { apiKey: '...' });
const response = await client.chat(request);
```

See `docs/prd/llm-interface.md` for complete request/response format.

### Config (`config/config.ts`)

Singleton configuration manager:

```typescript
const config = await Config.getInstance();
const llmClient = config.getLLMClient();
const toolRegistry = config.getToolRegistry();
const llmConfig = config.getLLMConfig();
```

**Default Configuration:**
- Provider: `google`
- Model: `gemini-2.0-flash`
- Supported providers: `google`, `ollama`

## Built-in Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Write/append to files |
| `shell` | Execute shell commands |
| `glob` | File pattern matching |
| `grep` | Content search with regex |

## Type Definitions

### Message Types (`agents/types.ts`)

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResult {
  toolCallId: string;
  content: string;
  error?: string;
}
```

### Tool Types (`tools/types.ts`)

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterDefinition>;
    required?: string[];
  };
}

interface Tool<TParams> {
  readonly definition: ToolDefinition;
  validate(params: TParams): { valid: boolean; error?: string };
  execute(params: TParams, options?: ToolExecutionOptions): Promise<ToolExecutionResult>;
}
```

## Session Management Pattern

Following gemini-cli's approach:

- **System prompt**: Set once in config, NOT repeated in message history
- **Message history**: Accumulates user/assistant/tool messages only
- **Single chat session**: Maintain one ChatSession instance for interactive mode
- **Multi-turn context**: History accumulates automatically

## Development Guidelines

1. **Adding New Tools**: Extend `BaseTool` class, register in `tools/builtin/index.ts`
2. **Adding LLM Providers**: Implement `LLMClient` interface in `llm/providers/`
3. **Message Types**: Use `Message` type from `agents/types.ts`
4. **Export Everything**: Add new exports to the module's `index.ts`
5. **Profile Format**: Only Markdown with YAML frontmatter supported

## Testing

```bash
npm test --workspace @beans/core
```
