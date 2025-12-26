# PRD: Context Management

## Overview

Context Management handles understanding the working environment - the project structure, programming languages, git state, and other contextual information that helps the AI agent provide relevant assistance.

## Problem Statement

AI agents need to understand the context they're working in:
- What kind of project is this?
- What programming language and framework?
- What's the git state?
- What files are relevant to the current task?

Without context, the agent makes generic suggestions that don't fit the codebase.

## Goals

- **G1**: Automatically detect project type and structure
- **G2**: Track workspace state (files, git, etc.)
- **G3**: Provide relevant context to the LLM
- **G4**: Support context compression for long sessions
- **G5**: Enable smart file selection for context

## Non-Goals

- Full semantic code understanding
- IDE-level indexing
- Real-time file watching (v2)

---

## Functional Requirements

### FR1: Workspace Detection

**Description**: Detect and understand the current workspace.

**Specification**:
```typescript
interface WorkspaceContext {
  rootPath: string;
  isGitRepo: boolean;
  gitBranch?: string;
  projectType?: ProjectType;
  packageManager?: PackageManager;
  primaryLanguage?: string;
}

type ProjectType =
  | 'nodejs' | 'python' | 'rust' | 'go'
  | 'java' | 'dotnet' | 'ruby' | 'unknown';
```

**Detection Rules**:
- `package.json` → Node.js
- `pyproject.toml` / `requirements.txt` → Python
- `Cargo.toml` → Rust
- `go.mod` → Go
- `pom.xml` / `build.gradle` → Java
- `*.csproj` → .NET

**Acceptance Criteria**:
- [ ] Correctly detects major project types
- [ ] Identifies package manager
- [ ] Detects git repository
- [ ] Gets current branch

### FR2: Git Integration

**Description**: Understand git state for context.

**Specification**:
```typescript
interface GitContext {
  isRepo: boolean;
  branch: string;
  hasUncommittedChanges: boolean;
  stagedFiles: string[];
  modifiedFiles: string[];
  untrackedFiles: string[];
  remoteUrl?: string;
}
```

**Acceptance Criteria**:
- [ ] Detect if in git repo
- [ ] Get current branch name
- [ ] List changed files
- [ ] Identify staged vs unstaged

### FR3: File Context Selection

**Description**: Select relevant files for context.

**Strategies**:
1. **Explicit**: User specifies files
2. **Recent**: Recently modified files
3. **Related**: Files related to current task
4. **Smart**: ML-based selection (future)

**Specification**:
```typescript
interface FileContext {
  files: ContextFile[];
  totalTokens: number;
}

interface ContextFile {
  path: string;
  content: string;
  relevanceScore: number;
  tokenCount: number;
}
```

**Acceptance Criteria**:
- [ ] Can manually add files to context
- [ ] Automatically includes relevant files
- [ ] Respects token limits
- [ ] Prioritizes by relevance

### FR4: Context Compression

**Description**: Compress context when approaching token limits.

**Strategies**:
1. **Summarize**: Replace content with summaries
2. **Truncate**: Remove old conversation turns
3. **Selective**: Keep only referenced content
4. **Incremental**: Compress progressively

**Specification**:
```typescript
interface CompressionConfig {
  thresholdPercent: number;  // Compress when reaching X% of limit
  strategy: 'summarize' | 'truncate' | 'selective';
  preserveRecent: number;    // Keep last N turns
}
```

**Acceptance Criteria**:
- [ ] Compression triggers at threshold
- [ ] Recent context preserved
- [ ] Agent informed of compression
- [ ] Graceful degradation

### FR5: Project File Discovery

**Description**: Understand project structure through file discovery.

**Key Files to Detect**:
- Configuration: `package.json`, `tsconfig.json`, `.eslintrc`
- Documentation: `README.md`, `CONTRIBUTING.md`
- Entry points: `src/index.ts`, `main.py`, `main.go`
- Tests: `*.test.ts`, `*_test.py`, `*_test.go`

**Specification**:
```typescript
interface ProjectStructure {
  configFiles: string[];
  sourceDirectories: string[];
  testDirectories: string[];
  entryPoints: string[];
  documentation: string[];
}
```

**Acceptance Criteria**:
- [ ] Finds config files
- [ ] Identifies source directories
- [ ] Locates test files
- [ ] Respects gitignore

### FR6: Context Windowing

**Description**: Manage what's in the conversation context.

**Specification**:
- Fixed window: Last N turns
- Token-based: Up to X tokens
- Semantic: Keep semantically relevant turns

```typescript
interface ContextWindow {
  messages: Message[];
  tokenCount: number;
  maxTokens: number;
  isCompressed: boolean;
}
```

**Acceptance Criteria**:
- [ ] Window respects token limit
- [ ] Old messages are archived
- [ ] Can reference archived context
- [ ] Smooth conversation flow

---

## Non-Functional Requirements

### NFR1: Performance

- Workspace detection < 100ms
- File scanning non-blocking
- Efficient token counting

### NFR2: Accuracy

- Correct project type 95%+ of time
- Accurate token estimates
- Relevant file selection

### NFR3: Reliability

- Works without git
- Handles large directories
- Graceful on permission errors

---

## Technical Design

### Workspace Service

```typescript
class WorkspaceService {
  constructor(rootPath: string);

  async getContext(): Promise<WorkspaceContext>;
  async refresh(): Promise<WorkspaceContext>;

  getRootPath(): string;
  resolvePath(relative: string): string;
  relativePath(absolute: string): string;
}
```

### Context Builder

```typescript
class ContextBuilder {
  constructor(workspace: WorkspaceService);

  addFile(path: string): Promise<void>;
  addDirectory(path: string, pattern?: string): Promise<void>;

  getContext(): FileContext;
  getTokenCount(): number;

  compress(strategy: CompressionStrategy): void;
}
```

### Project Analyzer

```typescript
class ProjectAnalyzer {
  constructor(workspace: WorkspaceService);

  async analyze(): Promise<ProjectStructure>;
  async findRelatedFiles(file: string): Promise<string[]>;
  async getImportGraph(file: string): Promise<ImportGraph>;
}
```

---

## Context Injection Format

```
## Workspace Context

**Project**: Node.js / TypeScript
**Root**: /path/to/project
**Branch**: main (3 uncommitted changes)

### Key Files
- package.json (project config)
- src/index.ts (entry point)
- tsconfig.json (TypeScript config)

### Current Focus
- src/routes/users.ts (modified)
- src/models/user.ts (related)

### File Contents

#### src/routes/users.ts
```typescript
// file contents here
```

#### src/models/user.ts
```typescript
// file contents here
```
```

---

## Testing Strategy

### Unit Tests

- Project type detection
- Git state parsing
- Token counting
- Compression algorithms

### Integration Tests

- Real project analysis
- Git repository operations
- File system scanning

### Fixture Projects

- TypeScript monorepo
- Python Django project
- Rust Cargo workspace
- Go module

---

## Dependencies

- `node:fs/promises` - File system
- `simple-git` - Git operations
- `tiktoken` - Token counting (optional)

---

## Future Enhancements

1. **Semantic Search**: Find files by meaning
2. **Dependency Graph**: Understand imports
3. **Change Impact**: Predict affected files
4. **Code Index**: Fast symbol lookup
5. **Real-time Sync**: Watch for file changes
