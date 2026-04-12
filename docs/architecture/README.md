# Architecture Documentation

## Overview

This directory contains architecture documentation for the Beans Agent project.

## Files

| File                               | Description                                                      |
| ---------------------------------- | ---------------------------------------------------------------- |
| `overview.md`                      | Complete system architecture, data flows, design decisions       |
| `multi-agent-system.md`            | Multi-agent routing, orchestration, and specialized agents       |
| `sub-agent-context-merge.md`       | How sub-agent output is merged back into top-level agent context |
| `memory-system-recommendations.md` | Memory loading and context persistence design recommendations    |

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

## Key Diagrams

1. **System Architecture** in `overview.md` - Three-layer view (Plugin, CLI, Core)
2. **Profile Resolution Flow** in `overview.md` - How agents are loaded
3. **Interactive Chat Flow** in `overview.md` - Message processing loop
4. **Tool Execution Flow** in `overview.md` - Tool call handling
5. **Multi-Agent Flow** in `multi-agent-system.md` - Routing and specialized agent orchestration
6. **Sub-Agent Merge Flow** in `sub-agent-context-merge.md` - How delegated agent output enters parent context

## Related Documentation

| Document               | Location                           | Content                     |
| ---------------------- | ---------------------------------- | --------------------------- |
| LLM Interface          | `../prd/llm-interface.md`          | Request/response format     |
| CLI UI Architecture    | `../guides/cli-ui-architecture.md` | UI components and data flow |
| Development Guidelines | `../sop/`                          | Coding standards, testing   |

## Guidelines

1. **Keep diagrams simple**: Use ASCII art for portability
2. **Document decisions**: Explain WHY, not just WHAT
3. **Reference patterns**: Check `../gemini-cli` and wshobson/agents
4. **Update when code changes**: Architecture docs must match implementation

## Adding New Architecture Docs

When adding new architectural components:

1. Update `overview.md` with component overview
2. Create new file for detailed component docs if needed
3. Update relevant CLAUDE.md/CODEX.md files in code directories
4. Add entry to this file's Files table
