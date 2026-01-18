# Architecture Documentation

## Overview

This directory contains architecture documentation for the Beans Agent project.

## Files

| File | Description |
|------|-------------|
| `overview.md` | Complete system architecture, data flows, design decisions |

## Architecture Summary

```
plugins/              → Agent definitions (Markdown)
    ↓
@beans/cli            → CLI layer (args, app, interactive loop)
    ↓
@beans/core           → Core framework
    ├── agents/       → ChatSession, AgentExecutor, AgentProfile
    ├── tools/        → ToolRegistry, built-in tools
    ├── llm/          → LLMClient, providers (Google, Ollama)
    ├── config/       → Config singleton
    └── context/      → Session and workspace management
```

## Key Diagrams in overview.md

1. **System Architecture** - Three-layer view (Plugin, CLI, Core)
2. **Plugin System** - Agent/Command/Skill structure
3. **Profile Resolution Flow** - How agents are loaded
4. **Interactive Chat Flow** - Message processing loop
5. **Tool Execution Flow** - Tool call handling

## Related Documentation

| Document | Location | Content |
|----------|----------|---------|
| LLM Interface | `../prd/llm-interface.md` | Request/response format |
| Root CLAUDE.md | `/CLAUDE.md` | Project overview |
| CLI CLAUDE.md | `/packages/cli/CLAUDE.md` | CLI specifics |
| Core CLAUDE.md | `/packages/core/CLAUDE.md` | Core framework |

## Guidelines

1. **Keep diagrams simple**: Use ASCII art for portability
2. **Document decisions**: Explain WHY, not just WHAT
3. **Reference patterns**: Check `../gemini-cli` and wshobson/agents
4. **Update when code changes**: Architecture docs must match implementation

## Adding New Architecture Docs

When adding new architectural components:

1. Update `overview.md` with component overview
2. Create new file for detailed component docs if needed
3. Update relevant CLAUDE.md files in code directories
4. Add entry to this file's Files table
