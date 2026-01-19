# Product Requirements Documents

Feature specifications and implementation status for Beans Agent.

## Status Legend

| Status | Meaning |
|--------|---------|
| Done | Implemented and tested |
| In Progress | Currently being worked on |
| Planned | Specified, not started |
| Future | Needs specification |

## Task List

### Core Features

| PRD | Feature | Status | Notes |
|-----|---------|--------|-------|
| [00-overview](00-overview.md) | Project overview | Done | Foundation document |
| [01-agent-core](01-agent-core.md) | Agent execution engine | Done | ChatSession, AgentExecutor |
| [02-tool-system](02-tool-system.md) | Tool registry & built-ins | Done | read, write, shell, glob, grep |
| [03-llm-integration](03-llm-integration.md) | LLM client interface | Done | Google, Ollama providers |
| [04-cli-interface](04-cli-interface.md) | CLI & interactive mode | Done | Ink-based UI |
| [05-context-management](05-context-management.md) | Workspace context | Done | WorkspaceService |
| [09-list-models](09-list-models.md) | List available models | Done | `--list-models` flag |

### Planned Features

| PRD | Feature | Status | Notes |
|-----|---------|--------|-------|
| [06-session-memory](06-session-memory.md) | Session persistence | Planned | Save/restore conversations |
| [07-mcp-integration](07-mcp-integration.md) | MCP server support | Planned | Model Context Protocol |
| [08-ide-integration](08-ide-integration.md) | IDE plugins | Future | VS Code, etc. |

### Reference Documents

| Document | Description |
|----------|-------------|
| [llm-interface](llm-interface.md) | LLM request/response format specification |

## Adding New PRDs

1. Create `NN-feature-name.md` with next available number
2. Follow existing PRD template structure
3. Add entry to this task list
4. Update status as implementation progresses

## PRD Template

```markdown
# Feature Name

## Overview
Brief description of the feature.

## Goals
- Goal 1
- Goal 2

## Non-Goals
- What this feature won't do

## User Stories
- As a user, I want to...

## Technical Design
### Components
### Data Flow
### API

## Implementation Plan
1. Step 1
2. Step 2

## Open Questions
- Question 1?
```
