# Memory System Recommendations for Beans-Code

## Executive Summary

This document provides research-backed recommendations for implementing a memory system in beans-code, drawing from analysis of Claude Code's CLAUDE.md, Gemini CLI's GEMINI.md, Cursor's .cursorrules (now .mdc), and GitHub Copilot's workspace indexing systems.

## 1. Recommended Architecture

### 1.1 Three-Tier Hierarchical Memory

Based on industry consensus, implement a three-tier hierarchical structure:

```
~/.beans/                           # Global tier (user-level)
├── BEANS.md                        # Global instructions
├── BEANS.local.md                  # Private global (auto-gitignored)
└── memories/                       # Auto-saved memories

<project-root>/                     # Project tier (repo-level)
├── BEANS.md                        # Project instructions
├── .beans/
│   ├── BEANS.md                    # Alternative location
│   ├── rules/                      # Modular rules (conditional)
│   │   ├── testing.md
│   │   └── security.md
│   └── BEANS.local.md              # Private project (auto-gitignored)

<subdirectory>/                     # Local tier (directory-level)
└── BEANS.md                        # Directory-specific instructions
```

**Rationale**: Claude Code reports a 40% reduction in hallucinations with structured hierarchical memory. The three-tier pattern is consistent across all major systems (Claude, Gemini, Cursor).

### 1.2 Memory Loading Order

Load memory in this order (lower priority first, higher specificity wins):

1. **Global memory** (`~/.beans/BEANS.md`)
2. **Project root memory** (`<project>/BEANS.md` or `<project>/.beans/BEANS.md`)
3. **Modular rules** (`<project>/.beans/rules/*.md`) - loaded on-demand
4. **Subdirectory memory** - JIT loaded when tools access those directories

### 1.3 Memory Types

| Type | Scope | Loading | Typical Content |
|------|-------|---------|-----------------|
| **Instruction Memory** | Global/Project | Startup | Coding standards, preferences, persona |
| **Fact Memory** | Global/Project | Startup | "Database port is 5432", API keys (encrypted) |
| **Session Memory** | Session | Runtime | Conversation context, recent actions |
| **JIT Memory** | Directory | On-demand | Component-specific instructions |

## 2. File Format and Naming Conventions

### 2.1 Primary File Name

**Recommendation**: `BEANS.md`

**Alternatives to support** (via configuration):
```json
{
  "memory": {
    "fileNames": ["BEANS.md", "CLAUDE.md", "GEMINI.md", "CONTEXT.md"]
  }
}
```

### 2.2 Format: Markdown with Optional YAML Frontmatter

```markdown
---
name: testing-rules
triggers:
  - write tests
  - unit test
  - coverage
priority: high
---

# Testing Standards

## Rules
- All new code must have unit tests
- Use Vitest for testing
- Minimum 80% coverage for new files
```

**YAML Frontmatter Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Identifier for the rule (optional) |
| `triggers` | string[] | Keywords that activate this rule (for conditional loading) |
| `priority` | `low\|medium\|high` | Conflict resolution priority |
| `globs` | string[] | File patterns this rule applies to |

### 2.3 Import Syntax

Support modular imports using `@` syntax:

```markdown
# Main BEANS.md

@./rules/coding-style.md
@./rules/testing.md
@../shared/security.md
```

**Safety Features**:
- Circular import detection
- Maximum import depth (default: 5)
- Path validation (prevent path traversal)
- Only allow imports from project directories

## 3. Discovery and Loading Strategy

### 3.1 Startup Loading

```typescript
interface MemoryLoadResult {
  global: string;      // Combined global memory
  project: string;     // Combined project memory
  extension: string;   // MCP/extension provided memory
}

async function loadHierarchicalMemory(
  workingDir: string,
  options: MemoryOptions
): Promise<MemoryLoadResult>
```

**Algorithm**:
1. Find global memory at `~/.beans/BEANS.md`
2. Walk upward from CWD to project root (detected by `.git`)
3. Collect all BEANS.md files in order (root to CWD)
4. Optionally scan downward for subdirectory memories
5. Process imports and concatenate

### 3.2 Just-In-Time (JIT) Loading

When tools access files in new directories, check for local BEANS.md:

```typescript
async function loadJitMemory(
  targetPath: string,
  trustedRoots: string[],
  alreadyLoaded: Set<string>
): Promise<MemoryLoadResult>
```

**Benefits**:
- Reduces initial context size
- Provides component-specific guidance exactly when needed
- Scales to large monorepos

### 3.3 Memory Refresh

Implement `/memory refresh` command and tool-triggered refresh:

```typescript
interface MemoryManager {
  load(): Promise<void>;           // Initial load
  refresh(): Promise<void>;        // Reload all files
  add(content: string): Promise<void>;  // Add to global memory
  show(): string;                  // Display current memory
  list(): string[];                // List loaded files
}
```

## 4. Token Budget Management

### 4.1 Token Limits

Based on research, enforce these limits:

| Constraint | Recommended Value | Rationale |
|------------|-------------------|-----------|
| Max lines loaded at startup | 200 lines | Claude reports 92% rule application under 200 lines vs 71% over 400 |
| Max total memory tokens | 10% of context window | Reserve 90% for conversation and file content |
| Per-file limit | 500 lines | Cursor best practice |

### 4.2 Token Optimization Strategies

1. **Summarization**: For files exceeding limits, summarize older sections
2. **Deduplication**: Remove redundant rules across hierarchy
3. **Priority-based Truncation**: Keep high-priority rules when truncating
4. **Lazy Loading**: Only load modular rules when triggered

### 4.3 RAG vs Direct Injection Decision Matrix

| Scenario | Approach | Rationale |
|----------|----------|-----------|
| < 100 files, < 50K tokens | Direct injection | Simpler, lower latency |
| Frequently accessed facts | Direct injection | Always available |
| Large knowledge bases | RAG | Cost-effective for large corpora |
| Dynamic/updated content | RAG | No need to reload context |
| Code search | Hybrid | Index for search, inject for context |

**Recommendation for beans-code**: Start with direct injection. Add RAG only if memory exceeds 50K tokens.

## 5. Security Best Practices

### 5.1 Prompt Injection Mitigation

**Critical**: Memory files are user-controlled and can contain malicious instructions.

**Mitigations**:

1. **Folder Trust System** (like Gemini CLI):
   ```typescript
   interface TrustConfig {
     enabled: boolean;
     trustedFolders: string[];
   }
   ```
   - Prompt user to trust new folders
   - Untrusted folders: load only global memory

2. **Content Sanitization**:
   - Detect and warn about instruction-like content in "data" fields
   - Flag Unicode obfuscation attempts

3. **Privilege Separation**:
   - Memory instructions cannot override tool permissions
   - Cannot grant access to files outside project

### 5.2 Path Traversal Prevention

```typescript
function validateImportPath(
  importPath: string,
  basePath: string,
  allowedDirectories: string[]
): boolean {
  const resolved = path.resolve(basePath, importPath);
  const normalized = path.normalize(resolved);

  // Prevent path traversal
  if (normalized.includes('..')) {
    return false;
  }

  // Must be within allowed directories
  return allowedDirectories.some(dir =>
    normalized.startsWith(path.normalize(dir))
  );
}
```

### 5.3 Sensitive File Protection

Never load memory from or allow imports to:
- `.env`, `.env.*`
- `credentials.json`, `secrets.*`
- `~/.ssh/`, `~/.aws/`

### 5.4 Trust Dialog UI

When entering untrusted folder, show:

```
This folder contains project-specific configuration:

  Memory files: 2 (BEANS.md, .beans/rules/testing.md)
  MCP servers: 1 (database-mcp)

  ! Warning: auto-approve is enabled for shell commands

[Trust folder] [Trust parent] [Don't trust]
```

## 6. User Experience Patterns

### 6.1 Memory Commands

| Command | Description |
|---------|-------------|
| `/memory show` | Display full concatenated memory |
| `/memory refresh` | Reload all memory files |
| `/memory add <text>` | Append to global memory |
| `/memory list` | List loaded memory files with sources |

### 6.2 Visual Feedback

Display memory status in footer/status bar:
```
[3 memory files] [Session: 12 turns, 8.5k tokens]
```

### 6.3 Memory Save Tool

Allow LLM to save facts via tool call:

```typescript
interface SaveMemoryTool {
  name: 'save_memory';
  description: 'Save a fact to persistent memory';
  parameters: {
    fact: string;
    scope: 'global' | 'project';
  };
}
```

**Flow**:
1. LLM calls `save_memory` with fact
2. System shows diff preview
3. User approves/rejects
4. Fact appended under `## Auto-saved Memories` section
5. Memory refreshed automatically

### 6.4 Private Memory (.local.md)

Support `BEANS.local.md` files:
- Auto-added to `.gitignore`
- User-specific preferences not shared with team
- Loaded after main BEANS.md (higher priority)

## 7. Implementation Roadmap

### Phase 1: Core Memory (MVP)
- [ ] Global memory loading (`~/.beans/BEANS.md`)
- [ ] Project memory loading (single file)
- [ ] Concatenation with provenance markers
- [ ] `/memory show` command
- [ ] Basic token counting

### Phase 2: Hierarchical Loading
- [ ] Upward directory traversal
- [ ] Import processing (`@file.md` syntax)
- [ ] Circular import detection
- [ ] `/memory refresh` command
- [ ] `/memory list` command

### Phase 3: Advanced Features
- [ ] JIT memory loading
- [ ] Modular rules with triggers
- [ ] Folder trust system
- [ ] `save_memory` tool
- [ ] Memory file count in status bar

### Phase 4: Optimization
- [ ] Token budget enforcement
- [ ] Priority-based truncation
- [ ] Memory deduplication
- [ ] Caching layer

## 8. Code Structure Recommendation

```
packages/core/src/
├── memory/
│   ├── index.ts              # Public API
│   ├── types.ts              # Interfaces
│   ├── discovery.ts          # File discovery
│   ├── loader.ts             # File reading and parsing
│   ├── importer.ts           # Import processing
│   ├── concatenator.ts       # Memory concatenation
│   ├── validator.ts          # Path and content validation
│   ├── trust.ts              # Folder trust management
│   └── manager.ts            # MemoryManager class
└── tools/
    └── save-memory.ts        # save_memory tool implementation
```

## 9. Configuration Schema

```typescript
interface MemoryConfig {
  // File discovery
  fileNames: string[];          // Default: ['BEANS.md']
  searchParents: boolean;       // Default: true
  searchChildren: boolean;      // Default: false
  maxDepth: number;             // Default: 5

  // Token management
  maxLines: number;             // Default: 200
  maxTokens: number;            // Default: 10000

  // Security
  folderTrust: {
    enabled: boolean;           // Default: false
    trustedFolders: string[];
  };

  // Import processing
  imports: {
    enabled: boolean;           // Default: true
    maxDepth: number;           // Default: 5
  };
}
```

## References

### Sources
- [Claude Code Memory Documentation](https://code.claude.com/docs/en/memory)
- [SFEIR Institute - CLAUDE.md Memory System](https://institute.sfeir.com/en/claude-code/claude-code-memory-system-claude-md/)
- [Cursor Rules Documentation](https://cursor.com/docs/context/rules)
- [Cursor Best Practices for Agents](https://cursor.com/blog/agent-best-practices)
- [GitHub Copilot Workspace Context](https://code.visualstudio.com/docs/copilot/reference/workspace-context)
- [GitHub Copilot CLI Changelog](https://github.blog/changelog/2026-01-14-github-copilot-cli-enhanced-agents-context-management-and-new-ways-to-install/)
- [Gemini CLI Memory Context Documentation](https://github.com/google-gemini/gemini-cli/blob/main/docs/core/memory-context.md)
- [Context Engineering Guide](https://smartscope.blog/en/blog/context-engineering-overview/)
- [OWASP LLM Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [Prompt Injection Security Research](https://www.securecodewarrior.com/article/prompt-injection-and-the-security-risks-of-agentic-coding-tools)
