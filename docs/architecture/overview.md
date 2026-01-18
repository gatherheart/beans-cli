# Beans Agent Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Plugin Layer                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      plugins/                                │    │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐  │    │
│  │  │ general-assistant│ │ code-development │ │ devops-ops  │  │    │
│  │  │  └─agents/       │ │  └─agents/       │ │  └─agents/  │  │    │
│  │  │    └─default.md  │ │    └─*.md        │ │    └─*.md   │  │    │
│  │  │  └─commands/     │ │  └─commands/     │ │  └─commands/│  │    │
│  │  │  └─skills/       │ │  └─skills/       │ │  └─skills/  │  │    │
│  │  └──────────────────┘ └──────────────────┘ └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           CLI Layer                                  │
│  ┌─────────┐  ┌─────────────┐  ┌────────────────────────────────┐   │
│  │ args.ts │  │   app.ts    │  │    Interactive Chat Loop       │   │
│  │         │──│             │──│    (readline-based)            │   │
│  │ Parsing │  │ ┌─────────┐ │  │                                │   │
│  └─────────┘  │ │ Profile │ │  │  Commands: /help /profile      │   │
│               │ │ Resolver│ │  │            /sop /clear /exit   │   │
│               │ └─────────┘ │  │                                │   │
│               └─────────────┘  └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Core Layer                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                       Agent System                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │
│  │  │ ChatSession │  │AgentExecutor│  │   AgentProfile      │   │  │
│  │  │             │  │             │  │                     │   │  │
│  │  │-systemPrompt│  │-execute()   │  │-loadAgentProfile()  │   │  │
│  │  │-messages[]  │  │-agent loop  │  │-parseMarkdownProfile│   │  │
│  │  │-sendMessage │  │             │  │-AgentProfileBuilder │   │  │
│  │  │-updateSOP() │  │             │  │                     │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                │                                     │
│         ┌──────────────────────┼──────────────────────┐             │
│         ▼                      ▼                      ▼             │
│  ┌─────────────┐        ┌─────────────┐        ┌───────────┐       │
│  │  LLMClient  │        │ ToolRegistry│        │  Config   │       │
│  │             │        │             │        │           │       │
│  │ - chat()    │        │ - getTool() │        │ - load()  │       │
│  │ - stream()  │        │ - register()│        │ - save()  │       │
│  │ - listModels│        │ - getAll()  │        │ - update()│       │
│  └─────────────┘        └─────────────┘        └───────────┘       │
│         │                      │                                    │
│         ▼                      ▼                                    │
│  ┌─────────────┐        ┌─────────────┐                            │
│  │  Providers  │        │ Built-in    │                            │
│  │ - Google    │        │ Tools       │                            │
│  │ - Ollama    │        │ - read_file │                            │
│  │             │        │ - write_file│                            │
│  │ (Planned:)  │        │ - shell     │                            │
│  │ - OpenAI    │        │ - glob      │                            │
│  │ - Anthropic │        │ - grep      │                            │
│  └─────────────┘        └─────────────┘                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Plugin System Architecture

Following the [wshobson/agents](https://github.com/wshobson/agents) pattern:

```
plugins/
├── {domain}/
│   ├── agents/           # Agent definitions (Markdown + YAML)
│   │   └── {agent}.md
│   ├── commands/         # Tools and workflows (TODO)
│   └── skills/           # Knowledge modules (Markdown)
│       └── {skill}.md
```

### Agent File Format

```markdown
---
name: agent-name
description: Brief description
---

# Agent Title

## Purpose
What the agent does...

## Capabilities
- Capability 1
- Capability 2

## Guidelines
1. Guideline 1
2. Guideline 2
```

### Skill File Format

```markdown
---
name: skill-name
triggers:
  - trigger phrase 1
  - trigger phrase 2
---

# Skill Title

## Use When
When to activate this skill...

## Instructions
How to apply this knowledge...

## Resources
Examples and references...
```

## Data Flow

### Profile Resolution Flow

```
CLI Start
    │
    ▼
┌────────────────────────────────────────┐
│         resolveAgentProfile()          │
│                                        │
│  1. --agent-profile flag? ──────────►  Load .md file
│         │ No                           │
│         ▼                              │
│  2. -a description? ────────────────►  Generate via LLM
│         │ No                                    │
│         ▼                                       ▼
│  3. .beans/agent.md exists? ────────►  Load workspace profile
│         │ No                           │
│         ▼                              │
│  4. plugins/.../default.md ─────────►  Load default plugin
│         │ No                           │
│         ▼                              │
│  5. DEFAULT_AGENT_PROFILE ──────────►  Hardcoded fallback
│                                        │
└────────────────────────────────────────┘
    │
    ▼
AgentProfile {
  name, displayName, description,
  purpose, systemPrompt, version
}
```

### Interactive Chat Flow

```
User Input
    │
    ▼
┌────────────────────────────────────────┐
│            ChatSession                  │
│            sendMessage()                │
│                                        │
│  1. Check slash commands               │
│     /help, /profile, /sop, /clear      │
│         │                              │
│         ▼                              │
│  2. Add user message to history        │
│         │                              │
│         ▼                              │
│  3. Build ChatRequest:                 │
│     - model                            │
│     - messages (accumulated)           │
│     - systemPrompt (from profile)      │
│     - tools (from registry)            │
│         │                              │
│         ▼                              │
│  4. Call LLMClient.chat()              │
│         │                              │
│         ▼                              │
│  5. Process response:                  │
│     - If tool_calls → execute tools    │
│       → add results to history         │
│       → loop back to step 3            │
│     - If content → add to history      │
│         │                              │
│         ▼                              │
│  6. Return response                    │
└────────────────────────────────────────┘
    │
    ▼
Display to User
```

### Tool Execution Flow

```
LLM Response (with toolCalls)
    │
    ▼
┌────────────────────────────────────────┐
│         Tool Execution Loop            │
│                                        │
│  For each toolCall:                    │
│    │                                   │
│    ▼                                   │
│  ┌──────────────────────────────────┐ │
│  │ 1. Get tool from registry        │ │
│  │ 2. Validate parameters           │ │
│  │ 3. Check confirmation (if needed)│ │
│  │ 4. Execute tool                  │ │
│  │ 5. Capture result/error          │ │
│  └──────────────────────────────────┘ │
│    │                                   │
│    ▼                                   │
│  Collect all ToolResults               │
│  (executed in parallel)                │
└────────────────────────────────────────┘
    │
    ▼
Add tool message to history
Continue agent loop
```

## Key Design Decisions

### 1. Plugin-Based Agent System

**Decision**: Agents defined as Markdown files with YAML frontmatter

**Rationale**:
- Human-readable and editable
- Version control friendly
- Follows wshobson/agents pattern
- Easy to share and distribute

**Structure**:
```
plugins/
├── general-assistant/agents/default.md    # Default
├── code-development/agents/*.md           # Dev tools
└── devops-operations/agents/*.md          # Ops tools
```

### 2. Session Management (gemini-cli pattern)

**Decision**: System prompt set once, messages accumulate

**Rationale**:
- Efficient token usage (no repeated system prompt)
- Natural conversation flow
- Easy to update SOP at runtime

**Implementation**:
```typescript
// System prompt: Set once in ChatSession
const session = new ChatSession({ systemPrompt });

// Messages: Accumulate across turns
await session.sendMessage("First");   // history: [user1]
await session.sendMessage("Second");  // history: [user1, asst1, user2]
```

### 3. Provider Abstraction

**Decision**: Unified LLMClient interface for all providers

**Rationale**:
- Easy to add new providers
- Consistent API across providers
- Provider-specific details hidden

**Interface**:
```typescript
interface LLMClient {
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream?(request: ChatRequest): AsyncGenerator<ChatStreamChunk>;
  listModels?(): Promise<ModelInfo[]>;
}
```

### 4. Tool System

**Decision**: Registry pattern with parallel execution

**Rationale**:
- Central discovery of available tools
- Consistent tool interface via BaseTool
- Parallel execution for performance

**Built-in Tools**:
| Tool | Purpose |
|------|---------|
| `read_file` | Read file contents |
| `write_file` | Write/append files |
| `shell` | Execute commands |
| `glob` | Pattern matching |
| `grep` | Content search |

## Module Dependencies

```
plugins/                          # Agent definitions (Markdown)
    │
    ▼
@beans/cli                        # Command line interface
    │
    ├── args.ts                   # Argument parsing
    ├── app.ts                    # Main application
    │   ├── resolveAgentProfile() # Profile resolution
    │   ├── runSinglePrompt()     # One-shot mode
    │   └── runInteractiveChat()  # Chat mode
    │
    └──► @beans/core              # Core framework
              │
              ├── agents/
              │   ├── profile.ts       # AgentProfile, loading
              │   ├── chat-session.ts  # ChatSession
              │   ├── executor.ts      # AgentExecutor
              │   └── types.ts         # Type definitions
              │
              ├── tools/
              │   ├── registry.ts      # ToolRegistry
              │   ├── base-tool.ts     # BaseTool class
              │   └── builtin/         # Built-in tools
              │
              ├── llm/
              │   ├── client.ts        # Factory function
              │   ├── types.ts         # LLM interfaces
              │   └── providers/       # Google, Ollama
              │
              ├── config/
              │   └── config.ts        # Config singleton
              │
              └── context/
                  ├── session.ts       # SessionManager
                  └── workspace.ts     # WorkspaceService
```

## Configuration Hierarchy

Priority (highest to lowest):

1. **CLI flags**: `--model`, `--yolo`, `--agent-profile`
2. **Environment**: `GOOGLE_API_KEY`, `OLLAMA_HOST`
3. **Project config**: `.beans/settings.json`
4. **User config**: `~/.config/beans-agent/settings.json`
5. **Defaults**: Hardcoded in code

## File Locations

| Type | Location |
|------|----------|
| Default agent | `plugins/general-assistant/agents/default.md` |
| Workspace agent | `.beans/agent.md` |
| Generated profiles | `.beans/agent-profile.md` |
| User settings | `~/.config/beans-agent/settings.json` |
| Project settings | `.beans/settings.json` |

## Error Handling

| Error Type | Handling |
|------------|----------|
| Tool errors | Caught, returned as ToolResult with error field |
| LLM errors | Propagated up, terminate agent loop |
| Profile errors | Fallback to default profile |
| Config errors | Graceful fallback to defaults |

## Future Considerations

| Feature | Status | Notes |
|---------|--------|-------|
| Commands | TODO | Plugin-specific tools/workflows |
| Skills loading | TODO | Trigger-based skill activation |
| OpenAI provider | Planned | Add to llm/providers/ |
| Anthropic provider | Planned | Add to llm/providers/ |
| Plugin marketplace | Future | Discover/install plugins |
