# Memory System Design - beans-code

## 1. Overview

### Purpose and Goals

The Memory System provides persistent, hierarchical instructions and context that are automatically injected into the LLM system prompt. This enables:

- **User Customization**: Users define preferences, coding standards, and project-specific instructions
- **Persistent Knowledge**: Information survives across sessions without repeated explanation
- **Context Efficiency**: Relevant context loaded automatically, reducing manual re-entry
- **Workspace Awareness**: Different contexts for different projects and environments

### Relationship to gemini-cli GEMINI.md System

This design is directly inspired by and compatible with gemini-cli's GEMINI.md system:

| gemini-cli | beans-code | Description |
|------------|------------|-------------|
| `~/.gemini/GEMINI.md` | `~/.beans/BEANS.md` | Global user instructions |
| `GEMINI.md` (project) | `BEANS.md` (project) | Project-level instructions |
| `@import` | `@import` | Import syntax for composition |
| `save_memory` tool | `save_memory` tool | Runtime memory persistence |

The system supports a configurable memory file name (default: `BEANS.md`) to allow flexibility for different deployment contexts.

---

## 2. Architecture

### Three-Tier Hierarchy

Memory is organized in a priority hierarchy, with later tiers overriding earlier ones:

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: Global (~/.beans/BEANS.md)                        │
│  - User preferences, coding style, general instructions     │
│  - Applied to ALL sessions                                  │
├─────────────────────────────────────────────────────────────┤
│  Tier 2: Plugin/Agent Memory                                │
│  - Plugin-specific knowledge (e.g., code-development)       │
│  - Agent-specific instructions (e.g., code-reviewer.md)     │
├─────────────────────────────────────────────────────────────┤
│  Tier 3: Project (~/.beans/BEANS.md or ./BEANS.md)         │
│  - Workspace-specific instructions                          │
│  - Project conventions, architecture decisions              │
│  - Highest priority (overrides global)                      │
└─────────────────────────────────────────────────────────────┘
```

### File Naming and Locations

**Default memory file name**: `BEANS.md` (configurable via `memoryFileName` in config)

**Storage locations**:

| Tier | Location | Discovery Method |
|------|----------|------------------|
| Global | `~/.beans/BEANS.md` | Direct read |
| Plugin | `plugins/{name}/memory/` | Plugin loader |
| Project | `{workspace}/BEANS.md` | Workspace scan |
| Project (hidden) | `{workspace}/.beans/BEANS.md` | Workspace scan |

**Priority resolution** (highest to lowest):
1. `{workspace}/BEANS.md` (explicit project file)
2. `{workspace}/.beans/BEANS.md` (hidden project file)
3. Plugin memory files (if plugin loaded)
4. `~/.beans/BEANS.md` (global)

### File Format

Memory files are Markdown documents with optional YAML frontmatter:

```markdown
---
version: 1
priority: 100
enabled: true
---

# Project Instructions

## Code Style
- Use 2-space indentation
- Prefer `const` over `let`

## Architecture
This project uses a hexagonal architecture...

@import ./docs/coding-standards.md
@import ./docs/api-conventions.md
```

**Frontmatter fields**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | number | 1 | Schema version for migrations |
| `priority` | number | 0 | Override default tier priority |
| `enabled` | boolean | true | Enable/disable this memory file |

---

## 3. Discovery Pipeline

### File Discovery Algorithm

The discovery pipeline uses a SCATTER-GATHER-CATEGORIZE pattern inspired by gemini-cli:

```typescript
async function discoverMemoryFiles(workspace: string): Promise<MemoryFile[]> {
  // Phase 1: SCATTER - Parallel discovery across tiers
  const [globalFiles, pluginFiles, projectFiles] = await Promise.all([
    discoverGlobalMemory(),
    discoverPluginMemory(),
    discoverProjectMemory(workspace),
  ]);

  // Phase 2: GATHER - Collect and deduplicate
  const allFiles = [...globalFiles, ...pluginFiles, ...projectFiles];
  const deduped = deduplicateByPath(allFiles);

  // Phase 3: CATEGORIZE - Sort by priority
  return sortByPriority(deduped);
}
```

### Concurrency Limits

To prevent resource exhaustion on large projects:

| Operation | Limit | Rationale |
|-----------|-------|-----------|
| File reads | 20 concurrent | Prevent fd exhaustion |
| Directory BFS | 15 concurrent | Prevent stack overflow |
| Import resolution | 10 concurrent | Prevent circular import storms |

### Import Resolution (`@import` syntax)

Memory files can import other files using the `@import` directive:

```markdown
# Main Instructions

@import ./coding-standards.md
@import ../shared/security-guidelines.md
@import ~/.beans/snippets/typescript-patterns.md
```

**Resolution rules**:

1. **Relative paths**: Resolved relative to the importing file
2. **Home directory**: `~` expands to user home
3. **Absolute paths**: Used as-is (must be within trusted folders)

**Import validation**:

```typescript
interface ImportValidation {
  maxDepth: 5;                    // Prevent deep nesting
  maxImportsPerFile: 20;          // Prevent import bombs
  circularPrevention: true;       // Track visited files
  allowedExtensions: ['.md'];     // Security restriction
}
```

**Circular import prevention**:

```typescript
function resolveImports(
  file: MemoryFile,
  visited: Set<string> = new Set(),
  depth: number = 0
): string {
  if (depth > MAX_IMPORT_DEPTH) {
    return `<!-- Import depth exceeded for ${file.path} -->`;
  }

  if (visited.has(file.path)) {
    return `<!-- Circular import detected: ${file.path} -->`;
  }

  visited.add(file.path);

  // Process @import directives
  return file.content.replace(
    /@import\s+(.+)/g,
    (_, importPath) => resolveImport(importPath, file.path, visited, depth + 1)
  );
}
```

---

## 4. Memory Injection

### When Memory Enters System Prompt

Memory is injected **once at session start**, not per-turn:

```typescript
// In app.tsx buildSystemPrompt()
function buildSystemPrompt(
  basePrompt: string,
  workspace: WorkspaceContext,
  memoryContent: string  // NEW: Add memory parameter
): string {
  const sections: string[] = [basePrompt];

  // Inject memory content after base prompt
  if (memoryContent) {
    sections.push('');
    sections.push('## User Instructions');
    sections.push('');
    sections.push(memoryContent);
  }

  // Existing workspace context injection
  sections.push('');
  sections.push('## Current Environment');
  // ... workspace details

  return sections.join('\n');
}
```

### Token Budget Management

Memory content is subject to token budget constraints:

| Budget Type | Percentage | Description |
|-------------|------------|-------------|
| Memory allocation | 10% | Max percentage of context for memory |
| Warning threshold | 8% | Trigger warning when exceeded |
| Hard limit | 15% | Truncate if exceeded |

**Budget calculation**:

```typescript
interface TokenBudget {
  modelContextLimit: number;      // e.g., 128000 for Gemini
  memoryBudgetPercent: number;    // Default: 10%
  maxMemoryTokens: number;        // Calculated limit
  warningThresholdPercent: number; // Default: 8%
}

function calculateMemoryBudget(modelContext: number): TokenBudget {
  const memoryBudgetPercent = 0.10;
  return {
    modelContextLimit: modelContext,
    memoryBudgetPercent,
    maxMemoryTokens: Math.floor(modelContext * memoryBudgetPercent),
    warningThresholdPercent: 0.08,
  };
}
```

**Injection strategy** (for content under 50K tokens):

- **Direct injection**: Memory content embedded directly in system prompt
- **No RAG needed**: Simple concatenation for MVP; advanced retrieval deferred

### Provenance Tracking

Each memory segment includes provenance information for debugging:

```typescript
interface MemorySegment {
  content: string;
  source: {
    tier: 'global' | 'plugin' | 'project';
    path: string;
    importedFrom?: string;    // If this was @import-ed
  };
  tokens: number;
  hash: string;               // For cache invalidation
}
```

Provenance is logged (not injected into prompt) for debugging:

```typescript
function logProvenance(segments: MemorySegment[]): void {
  if (!isDebugMode()) return;

  const log = segments.map(s => ({
    source: s.source.path,
    tier: s.source.tier,
    tokens: s.tokens,
  }));

  debugLog('Memory provenance:', log);
}
```

---

## 5. Runtime Features

### `save_memory` Tool Specification

A built-in tool for persisting runtime discoveries:

```typescript
const saveMemoryTool: ToolDefinition = {
  name: 'save_memory',
  description: `Save important information to persistent memory for future sessions.
Use this when the user asks you to remember something, or when you discover
important project conventions that should be preserved.`,
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The content to save (Markdown format)',
      },
      section: {
        type: 'string',
        description: 'Section header to add content under (e.g., "Code Style")',
      },
      target: {
        type: 'string',
        enum: ['global', 'project'],
        description: 'Where to save: global (~/.beans/) or project (./.beans/)',
        default: 'project',
      },
    },
    required: ['content'],
  },
};
```

**Safety features**:

1. **Diff preview**: Show changes before writing
2. **Allow-listing**: Only write to designated memory files
3. **Sanitization**: Strip potentially harmful content
4. **Session allow-list**: Track what the LLM can modify this session

```typescript
interface SaveMemoryOptions {
  showDiff: boolean;           // Default: true
  requireConfirmation: boolean; // Default: true in interactive mode
  allowedTargets: string[];    // Paths LLM can write to this session
}
```

### Slash Commands

Memory-related slash commands for interactive mode:

| Command | Description |
|---------|-------------|
| `/memory show` | Display current memory content |
| `/memory add <text>` | Add content to project memory |
| `/memory refresh` | Reload memory files from disk |
| `/memory list` | List discovered memory files |
| `/memory edit` | Open memory file in $EDITOR |

**Implementation in InputArea.tsx**:

```typescript
const memoryCommands: Record<string, CommandHandler> = {
  'show': () => {
    const memory = memoryStore.getFormattedContent();
    addSystemMessage(`Current Memory:\n\n${memory}`);
  },
  'add': (text: string) => {
    memoryStore.appendToProject(text);
    addSystemMessage('Added to project memory.');
  },
  'refresh': async () => {
    await memoryStore.reload();
    addSystemMessage('Memory reloaded from disk.');
  },
  'list': () => {
    const files = memoryStore.listFiles();
    addSystemMessage(`Memory files:\n${files.map(f => `- ${f}`).join('\n')}`);
  },
};
```

### Memory Refresh Mechanism

Memory can be refreshed without restarting the session:

```typescript
class MemoryStore {
  private cache: Map<string, MemoryFile> = new Map();
  private lastRefresh: Date = new Date();

  async reload(): Promise<void> {
    this.cache.clear();
    await this.discover();
    this.lastRefresh = new Date();
  }

  // Watch for file changes (optional, Phase 3)
  watch(): void {
    const watcher = fs.watch(this.memoryDir, { recursive: true });
    watcher.on('change', () => this.reload());
  }
}
```

---

## 6. Security

### Folder Trust System

Memory files are only loaded from trusted locations:

```typescript
interface TrustConfig {
  // Always trusted
  trustedPaths: [
    '~/.beans/',           // Global config
    '{workspace}/',        // Current workspace
    '{workspace}/.beans/', // Hidden workspace config
  ];

  // Require explicit trust
  untrustedPaths: [
    '/tmp/',
    '/var/',
  ];

  // Trust inheritance
  trustWorkspaceSubdirs: true;  // Trust workspace subdirectories
}
```

### Path Validation

All file operations validate paths against allowed locations:

```typescript
function validateMemoryPath(path: string, workspace: string): ValidationResult {
  const resolved = path.resolve(path);

  // Check against deny list
  if (DENIED_PATHS.some(p => resolved.startsWith(p))) {
    return { valid: false, reason: 'Path in denied location' };
  }

  // Check for path traversal
  if (path.includes('..')) {
    const normalized = path.normalize(path);
    if (!normalized.startsWith(workspace) && !normalized.startsWith(homedir())) {
      return { valid: false, reason: 'Path traversal outside allowed directories' };
    }
  }

  // Check extension
  if (!path.endsWith('.md')) {
    return { valid: false, reason: 'Only .md files allowed' };
  }

  return { valid: true };
}
```

### Import Restrictions

Imports have additional security constraints:

| Restriction | Description |
|-------------|-------------|
| Extension whitelist | Only `.md` files |
| Path normalization | Resolve `..` before validation |
| Depth limit | Max 5 levels of imports |
| Size limit | Max 100KB per imported file |
| Count limit | Max 20 imports per file |

### PII Handling (`.local.md` Files)

Sensitive information should be stored in `.local.md` files:

```
~/.beans/
├── BEANS.md           # Committed, shared
└── BEANS.local.md     # Git-ignored, secrets
```

**`.local.md` behavior**:

- Never committed to git (add to `.gitignore`)
- Loaded alongside main memory file
- Higher priority than non-local files
- Suitable for API keys, personal preferences, sensitive paths

---

## 7. Configuration

### MemoryConfig Schema

```typescript
interface MemoryConfig {
  /** Enable memory system */
  enabled: boolean;

  /** Memory file name (default: BEANS.md) */
  fileName: string;

  /** Token budget as percentage of model context */
  tokenBudgetPercent: number;

  /** Maximum import depth */
  maxImportDepth: number;

  /** Enable file watching for auto-refresh */
  watchFiles: boolean;

  /** Paths to exclude from memory discovery */
  excludePaths: string[];

  /** Enable .local.md file loading */
  loadLocalFiles: boolean;

  /** Show provenance in debug mode */
  debugProvenance: boolean;
}
```

### Default Values

```typescript
const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: true,
  fileName: 'BEANS.md',
  tokenBudgetPercent: 10,
  maxImportDepth: 5,
  watchFiles: false,        // Enable in Phase 3
  excludePaths: [
    'node_modules',
    '.git',
    'dist',
    'build',
  ],
  loadLocalFiles: true,
  debugProvenance: false,
};
```

### Settings Locations

Configuration is stored in the standard beans config file:

```yaml
# ~/.beans/config.yaml
memory:
  enabled: true
  fileName: BEANS.md
  tokenBudgetPercent: 10
  maxImportDepth: 5
  watchFiles: false
  excludePaths:
    - node_modules
    - .git
  loadLocalFiles: true
```

---

## 8. Implementation Plan

### Phase 1: MVP (Essential Features)

**Goal**: Basic memory loading and injection

**Tasks**:

- [ ] Create `MemoryStore` class with file discovery
- [ ] Implement three-tier hierarchy loading
- [ ] Add memory injection to `buildSystemPrompt()`
- [ ] Add `/memory show` and `/memory list` commands
- [ ] Add `MemoryConfig` to configuration types
- [ ] Write unit tests for MemoryStore

**Files to create**:
- `packages/core/src/memory/store.ts`
- `packages/core/src/memory/types.ts`
- `packages/core/src/memory/index.ts`

**Files to modify**:
- `packages/core/src/config/types.ts` - Add MemoryConfig
- `packages/core/src/config/config.ts` - Add memory config handling
- `packages/cli/src/app.tsx` - Integrate memory into buildSystemPrompt
- `packages/cli/src/ui/components/InputArea.tsx` - Add memory commands

### Phase 2: Imports and Hierarchy

**Goal**: Full import resolution and plugin memory

**Tasks**:

- [ ] Implement `@import` directive parsing
- [ ] Add circular import prevention
- [ ] Add import depth limiting
- [ ] Implement plugin memory discovery
- [ ] Add `/memory refresh` command
- [ ] Add memory provenance logging

**Files to create**:
- `packages/core/src/memory/import-resolver.ts`
- `packages/core/src/memory/discovery.ts`

### Phase 3: Runtime Features

**Goal**: Dynamic memory modification

**Tasks**:

- [ ] Implement `save_memory` tool
- [ ] Add diff preview for memory writes
- [ ] Implement session allow-list tracking
- [ ] Add `/memory add` and `/memory edit` commands
- [ ] Add file watching (optional)

**Files to create**:
- `packages/core/src/tools/builtin/save-memory.ts`

**Files to modify**:
- `packages/core/src/tools/builtin/index.ts` - Register save_memory

### Phase 4: Optimization

**Goal**: Performance and advanced features

**Tasks**:

- [ ] Implement token counting for memory budget
- [ ] Add memory caching with hash-based invalidation
- [ ] Add JIT loading for large memory files (if needed)
- [ ] Performance profiling and optimization
- [ ] Add memory analytics/stats command

---

## 9. API Reference

### MemoryStore Class Interface

```typescript
class MemoryStore {
  constructor(config: MemoryConfig, workspace: string);

  // Discovery and loading
  async discover(): Promise<MemoryFile[]>;
  async reload(): Promise<void>;

  // Content access
  getContent(): string;
  getFormattedContent(): string;
  getSegments(): MemorySegment[];

  // File management
  listFiles(): string[];
  getFile(path: string): MemoryFile | null;

  // Modification
  async appendToGlobal(content: string): Promise<void>;
  async appendToProject(content: string): Promise<void>;
  async saveMemory(options: SaveMemoryOptions): Promise<SaveResult>;

  // Token management
  getTokenCount(): number;
  isWithinBudget(): boolean;

  // Cache management
  clearCache(): void;
  getCacheStats(): CacheStats;
}
```

### MemoryEntry Type

```typescript
interface MemoryFile {
  path: string;
  content: string;
  tier: 'global' | 'plugin' | 'project';
  priority: number;
  metadata: MemoryMetadata;
  imports: string[];
  tokens: number;
  hash: string;
  loadedAt: Date;
}

interface MemoryMetadata {
  version: number;
  enabled: boolean;
  priority?: number;
}

interface MemorySegment {
  content: string;
  source: MemorySource;
  tokens: number;
  hash: string;
}

interface MemorySource {
  tier: 'global' | 'plugin' | 'project';
  path: string;
  importedFrom?: string;
}
```

### Memory Commands Interface

```typescript
interface MemoryCommands {
  show(): void;
  list(): void;
  refresh(): Promise<void>;
  add(content: string): Promise<void>;
  edit(): void;
}

// Usage in InputArea.tsx
const handleMemoryCommand = async (subcommand: string, args: string): Promise<void> => {
  switch (subcommand) {
    case 'show':
      return memoryCommands.show();
    case 'list':
      return memoryCommands.list();
    case 'refresh':
      return memoryCommands.refresh();
    case 'add':
      return memoryCommands.add(args);
    case 'edit':
      return memoryCommands.edit();
    default:
      addSystemMessage(`Unknown memory command: ${subcommand}`);
  }
};
```

---

## 10. Open Questions

### Decisions Still Needed

1. **Memory file name**: Should we use `BEANS.md` or allow configuration?
   - **Recommendation**: Use `BEANS.md` as default, configurable via `memoryFileName`

2. **Token counting implementation**: Use external library (tiktoken) or estimate?
   - **Recommendation**: Start with estimation (chars/4), add tiktoken in Phase 4

3. **Import syntax**: Exact syntax for imports?
   - **Recommendation**: Use `@import path/to/file.md` (one per line)

4. **Plugin memory structure**: How do plugins define their memory?
   - **Recommendation**: `plugins/{name}/memory/BEANS.md` discovered automatically

5. **Watch mode**: Should file watching be enabled by default?
   - **Recommendation**: Off by default, enable via config for power users

6. **Memory versioning**: How to handle schema migrations?
   - **Recommendation**: Version field in frontmatter, migrate on load

7. **Memory merging**: How to merge conflicting instructions from different tiers?
   - **Recommendation**: Later tiers override earlier (project > plugin > global)

8. **Maximum memory size**: What's the absolute max size for memory content?
   - **Recommendation**: 50KB raw content, warn above 30KB

### Future Considerations

- **Semantic search**: Index memory for relevant retrieval (Phase 4+)
- **Memory sync**: Cloud sync for multi-machine users
- **Team memory**: Shared team instructions separate from project
- **Memory analytics**: Track which memories are most used
- **AI-suggested memories**: LLM proposes additions based on session patterns
