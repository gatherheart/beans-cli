# Claude Instructions for Beans Agent

## Reference Project

**Always refer to `../gemini-cli` for patterns and best practices.**

## Project Overview

Beans Agent is an AI-powered stock trading assistant built as a modular CLI framework. It supports multiple LLM providers and includes built-in tools for file operations and shell commands.

## Architecture Overview

```
beans-code/
├── packages/
│   ├── core/           # Core framework - agents, tools, LLM clients
│   │   └── src/
│   │       ├── agents/     # Agent execution engine
│   │       ├── tools/      # Tool system and built-in tools
│   │       ├── llm/        # LLM client providers
│   │       ├── config/     # Configuration management
│   │       └── context/    # Session and workspace context
│   └── cli/            # Command line interface
│       └── src/
│           ├── index.ts    # Entry point
│           ├── args.ts     # CLI argument parsing
│           └── app.ts      # Main application
├── docs/
│   ├── prd/            # Product requirement documents
│   └── architecture/   # Architecture documentation
└── CLAUDE.md           # This file
```

## Key Components

### ChatSession (packages/core/src/agents/chat-session.ts)
- Manages continuous chat with accumulated history
- System prompt set once at session start, NOT repeated
- Messages accumulate across turns

### AgentExecutor (packages/core/src/agents/executor.ts)
- Single-shot execution for one-off prompts
- Creates fresh message array for each execute() call

### ToolRegistry (packages/core/src/tools/registry.ts)
- Manages available tools
- Built-in tools: read_file, write_file, shell, glob, grep

### LLM Client (packages/core/src/llm/client.ts)
- Factory pattern for provider-specific clients
- Supports: OpenAI, Anthropic, Google, Ollama

## Development Guidelines

1. **Reference gemini-cli**: Always check `../gemini-cli` for implementation patterns
2. **Session Management**: Use ChatSession for continuous chat, system prompt once
3. **Keep Documentation in Sync**: Update CLAUDE.md files when changing code
4. **Documentation Locations**:
   - Feature specifications: `docs/prd/`
   - Architecture docs: `docs/architecture/`
   - Package docs: `packages/*/CLAUDE.md`

## Session Management Pattern

Following gemini-cli's approach:

```typescript
// CORRECT: Create session once, send multiple messages
const session = new ChatSession(llmClient, toolRegistry, {
  systemPrompt,  // Set once
  modelConfig,
  toolConfig,
});

await session.sendMessage("First message");  // History accumulates
await session.sendMessage("Second message"); // Has context from first
```

```typescript
// WRONG: Creating new execution each time repeats system prompt
for (const msg of messages) {
  await executor.execute({ systemPrompt, query: msg }); // System prompt repeated!
}
```

## File Organization

Each package directory should have:
- `CLAUDE.md` - Instructions and architecture for that package
- `src/index.ts` - Public exports
- Clear separation of concerns

## Before Committing

1. Ensure all CLAUDE.md files are updated
2. Run `npm run build` to verify compilation
3. Run `npm test` if tests exist
4. Update README.md if features changed
