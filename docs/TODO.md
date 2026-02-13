# Beans Agent - Feature Roadmap

Based on Claude Code architecture and extension system.

## Current Status

### Implemented
- [x] Agentic loop (gather context → take action → verify results)
- [x] Multi-turn conversation with streaming
- [x] Input history (up/down arrows)
- [x] Multi-line input (Shift+Enter, Ctrl+J, backslash+Enter)
- [x] History hint ("Press ↑ to edit previous messages" when history available)
- [x] File diff display (shows unified diff when write_file tool is used)
- [x] Markdown rendering with syntax highlighting
- [x] Basic slash commands (/help, /clear, /profile, /history, /memory, /exit)

---

## Extension System (Claude Code Architecture)

### 1. BEANS.md (Memory)
Persistent context loaded every session.

| Feature | Description | Priority |
|---------|-------------|----------|
| [ ] BEANS.md loading | Load from project root at session start | High |
| [ ] Nested BEANS.md | Discover in subdirectories as Claude accesses them | Medium |
| [ ] `@path` imports | Include other files in BEANS.md | Medium |
| [ ] `/init` command | Interactive BEANS.md creation wizard | High |
| [ ] Auto-memory | Learn from corrections, save to BEANS.md | Low |

**Context Cost:** Full content loads every request. Keep under ~500 lines.

### 2. Skills
Reusable knowledge and invocable workflows. Load on demand.

| Feature | Description | Priority |
|---------|-------------|----------|
| [ ] Skill discovery | Scan `.beans/skills/` and `plugins/*/skills/` | High |
| [ ] Skill invocation | `/<skill-name>` to trigger workflows | High |
| [ ] Auto-loading | Claude loads skills based on task relevance | Medium |
| [ ] `disable-model-invocation` | Hide skill until manually invoked | Medium |
| [ ] Skill frontmatter | name, description, triggers, context mode | High |
| [ ] `/skills` command | List available skills | Medium |
| [ ] `context: fork` | Run skill in isolated subagent context | Low |

**Context Cost:** Descriptions load at start, full content on use. Zero cost with `disable-model-invocation: true`.

### 3. Subagents
Isolated workers with fresh context. Return summarized results.

| Feature | Description | Priority |
|---------|-------------|----------|
| [ ] `spawn_agent` tool | Spawn subagent for focused tasks | High |
| [ ] Context isolation | Subagent gets fresh context, not conversation history | High |
| [ ] Skill preloading | Subagent can preload specific skills | Medium |
| [ ] `/agents` command | Configure custom subagents | Medium |
| [ ] Result summarization | Subagent returns summary, not full work | High |

**Context Cost:** Isolated from main session. Use for tasks that read many files.

### 4. MCP (Model Context Protocol)
Connect to external services and tools.

| Feature | Description | Priority |
|---------|-------------|----------|
| [ ] MCP client | Connect to MCP servers | Medium |
| [ ] Tool integration | MCP tools appear as agent tools | Medium |
| [ ] `/mcp` command | Show connected servers, token costs | Medium |
| [ ] Tool search | Load tools up to 10% of context, defer rest | Low |
| [ ] Server configuration | `.beans/settings.json` MCP config | Medium |

**Context Cost:** All tool definitions load at start. Can be significant.

### 5. Hooks
Deterministic scripts that run on lifecycle events.

| Feature | Description | Priority |
|---------|-------------|----------|
| [ ] Hook registration | Define hooks in `.beans/settings.json` | Medium |
| [ ] `PreToolExecution` | Run before tool executes | Medium |
| [ ] `PostToolExecution` | Run after tool completes | High |
| [ ] `SessionStart/End` | Run at session boundaries | Low |
| [ ] `PromptSubmit` | Run before processing user prompt | Low |
| [ ] Hook output | Optionally inject output into context | Medium |

**Context Cost:** Zero unless hook returns context.

**Example Use Cases:**
- Run ESLint after every file edit
- Log all tool executions
- Auto-format code on write

### 6. Plugins
Bundle and distribute feature sets.

| Feature | Description | Priority |
|---------|-------------|----------|
| [ ] Plugin structure | `plugins/<name>/{skills,hooks,agents}/` | Low |
| [ ] Namespaced skills | `/plugin-name:skill-name` | Low |
| [ ] Plugin discovery | Scan plugins directory | Low |

---

## Core Features

### Session Management
| Feature | Description | Priority |
|---------|-------------|----------|
| [ ] Session persistence | Save conversation to disk | High |
| [ ] `--continue` | Resume most recent session | High |
| [ ] `--resume` | Pick session from list | Medium |
| [ ] `--fork-session` | Branch from current session | Medium |
| [ ] Session-scoped permissions | Remember approvals within session | Medium |

### Checkpoints & Safety
| Feature | Description | Priority |
|---------|-------------|----------|
| [ ] File snapshots | Snapshot before every edit | High |
| [ ] Esc twice to rewind | Restore previous checkpoint | High |
| [ ] `/undo` command | Undo last file change | High |
| [ ] Permission modes | Default, Auto-accept, Plan mode | Medium |
| [ ] Shift+Tab cycling | Cycle through permission modes | Medium |

### Context Management
| Feature | Description | Priority |
|---------|-------------|----------|
| [ ] `/context` command | Show context window usage | High |
| [ ] `/compact` command | Manual compaction with focus | Medium |
| [ ] Auto-compaction | Clear old tool outputs when near limit | Medium |
| [ ] Compact instructions | BEANS.md section preserved during compaction | Low |

---

## Tools

### Implemented
- [x] `read_file` - Read file contents
- [x] `write_file` - Write/create files (with diff display)
- [x] `shell` - Execute shell commands
- [x] `glob` - Find files by pattern
- [x] `grep` - Search file contents
- [x] `web_search` - Search the web

### To Implement
| Tool | Description | Priority |
|------|-------------|----------|
| [ ] `edit_file` | Surgical edits (not full rewrite) | High |
| [ ] `spawn_agent` | Spawn subagent for tasks | High |
| [ ] `list_directory` | List directory contents | Medium |
| [ ] `rename_file` | Rename/move files | Medium |
| [ ] `delete_file` | Delete files | Medium |

---

## Slash Commands

### Implemented
- [x] `/help` - Show available commands
- [x] `/profile` - View current agent profile
- [x] `/clear` - Clear chat history
- [x] `/history` - Show LLM message history
- [x] `/memory` - Show current system prompt
- [x] `/exit`, `/quit`, `/q` - Exit application

### To Implement
| Command | Description | Priority |
|---------|-------------|----------|
| [ ] `/init` | Initialize BEANS.md for project | High |
| [ ] `/context` | Show context window usage | High |
| [ ] `/undo` | Undo last file change | High |
| [ ] `/model` | Switch model during session | Medium |
| [ ] `/compact` | Manually compact context | Medium |
| [ ] `/skills` | List available skills | Medium |
| [ ] `/agents` | Configure custom subagents | Medium |
| [ ] `/mcp` | Show MCP server status | Medium |
| [ ] `/doctor` | Diagnose installation issues | Low |

---

## LLM Providers

### Implemented
- [x] Google Gemini
- [x] Ollama (local)
- [x] Mock (for testing)

### To Implement
- [ ] Anthropic Claude
- [ ] OpenAI GPT
- [ ] `/model` command to switch providers

---

## UI Improvements

### Implemented
- [x] Markdown rendering
- [x] Syntax highlighting in code blocks
- [x] Table rendering
- [x] Tool call indicators with spinners
- [x] Streaming output
- [x] File diff display

### To Implement
| Feature | Description | Priority |
|---------|-------------|----------|
| [ ] Permission mode indicator | Show current mode in status bar | High |
| [ ] Context usage bar | Visual indicator of context fill | Medium |
| [ ] Progress indicators | Long operation progress | Medium |
| [ ] Image display | Multimodal support | Low |
| [ ] Themes | Color customization | Low |

---

## Implementation Phases

### Phase 1: Core UX (Current)
1. ~~Input history (up/down arrows)~~ ✓
2. ~~Diff display for file writes~~ ✓
3. BEANS.md support
4. Session persistence (`--continue`)

### Phase 2: Safety & Control
5. File checkpoints (snapshot before edit)
6. `/undo` command
7. Permission modes (Shift+Tab)

### Phase 3: Context Management
8. `/context` command
9. `/compact` command
10. Auto-compaction

### Phase 4: Extensibility
11. Skills system (discovery, invocation)
12. Subagents (spawn_agent tool)
13. Hooks (post-tool execution)

### Phase 5: External Integration
14. MCP client
15. More LLM providers
16. Plugin system
