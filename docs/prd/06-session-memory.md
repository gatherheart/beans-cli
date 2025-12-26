# PRD: Session & Memory

## Overview

Session & Memory management handles the persistence of conversations, the ability to resume work, and long-term memory across sessions. This enables the agent to build knowledge about the user's projects and preferences over time.

## Problem Statement

Users need their AI assistant to:
- Remember the current conversation context
- Save and resume work sessions
- Learn their preferences and patterns
- Maintain project-specific knowledge
- Track what actions were taken

## Goals

- **G1**: Persist conversation state within a session
- **G2**: Save and restore complete sessions
- **G3**: Track session metrics and history
- **G4**: Enable cross-session memory
- **G5**: Provide conversation checkpoints

## Non-Goals

- Permanent knowledge base (separate system)
- User preference learning (v2)
- Multi-user sessions

---

## Functional Requirements

### FR1: Session State

**Description**: Maintain state during an active session.

**Specification**:
```typescript
interface SessionContext {
  sessionId: string;
  startedAt: Date;
  turnCount: number;
  totalTokens: number;
  modifiedFiles: string[];
  commandsExecuted: number;
}
```

**Acceptance Criteria**:
- [ ] Unique session ID generated
- [ ] Turn count tracked accurately
- [ ] Token usage accumulated
- [ ] File modifications logged

### FR2: Conversation History

**Description**: Maintain full conversation history.

**Specification**:
```typescript
interface ConversationTurn {
  turnNumber: number;
  userMessage: string;
  assistantResponse: string;
  toolCalls: TurnToolCall[];
  timestamp: Date;
  tokens: { prompt: number; completion: number };
}
```

**Acceptance Criteria**:
- [ ] All turns preserved
- [ ] Tool calls recorded
- [ ] Timestamps accurate
- [ ] Tokens counted per turn

### FR3: Session Persistence

**Description**: Save sessions to disk for later resumption.

**Storage Format**:
```
~/.config/beans-agent/sessions/
├── current.json          # Active session
├── auto-save/
│   └── {timestamp}.json  # Auto-saved snapshots
└── saved/
    └── {name}.json       # Named saves
```

**Specification**:
```typescript
interface SessionExport {
  session: SessionContext;
  turns: ConversationTurn[];
  workspace: WorkspaceContext;
  savedAt: Date;
  version: string;
}
```

**Acceptance Criteria**:
- [ ] Sessions save to JSON
- [ ] Auto-save on interval
- [ ] Can resume by name/ID
- [ ] Version compatibility checks

### FR4: Session Resume

**Description**: Resume a previously saved session.

**Specification**:
- `beans --continue` - Resume last session
- `beans --continue {name}` - Resume named session
- Context and history restored
- User informed of context

**Acceptance Criteria**:
- [ ] Full context restored
- [ ] Conversation continues naturally
- [ ] Agent aware of history
- [ ] Workspace changes detected

### FR5: Session Metrics

**Description**: Track and report session metrics.

**Specification**:
```typescript
interface SessionMetrics {
  sessionId: string;
  durationMs: number;
  turnCount: number;
  totalTokens: number;
  averageTokensPerTurn: number;
  filesModified: number;
  commandsExecuted: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  toolCallSuccessRate: number;
}
```

**Acceptance Criteria**:
- [ ] Duration tracked accurately
- [ ] All metrics computed
- [ ] Summary displayed on exit
- [ ] Exportable for analysis

### FR6: Checkpoints

**Description**: Save snapshots at key points in the conversation.

**Automatic Checkpoints**:
- Before major file changes
- Every N turns
- On manual save

**Specification**:
```typescript
interface Checkpoint {
  id: string;
  timestamp: Date;
  turnNumber: number;
  description?: string;
  snapshot: SessionExport;
}
```

**Acceptance Criteria**:
- [ ] Automatic checkpoints work
- [ ] Manual checkpoint command
- [ ] Can restore to checkpoint
- [ ] Checkpoint list viewable

### FR7: Long-term Memory

**Description**: Persistent memory across sessions.

**Memory Types**:
1. **Project Memory**: Project-specific facts
2. **Preference Memory**: User preferences
3. **Action Memory**: Past actions taken

**Specification**:
```typescript
interface MemoryEntry {
  id: string;
  type: 'project' | 'preference' | 'action';
  content: string;
  createdAt: Date;
  lastAccessed: Date;
  relevanceScore: number;
  projectPath?: string;
}
```

**Acceptance Criteria**:
- [ ] Memory persists across sessions
- [ ] Relevant memories retrieved
- [ ] Can manually add/remove
- [ ] Privacy controls

### FR8: Session Commands

**Description**: CLI commands for session management.

**Commands**:
- `/save [name]` - Save current session
- `/load [name]` - Load a saved session
- `/list` - List all saved sessions
- `/delete [name]` - Delete a session
- `/checkpoint [name]` - Create checkpoint
- `/rollback [checkpoint]` - Restore checkpoint
- `/history` - Show conversation history
- `/metrics` - Show session metrics

**Acceptance Criteria**:
- [ ] All commands functional
- [ ] Clear feedback on actions
- [ ] Error handling for edge cases
- [ ] Confirmation for destructive actions

---

## Non-Functional Requirements

### NFR1: Performance

- Session save < 100ms
- Session load < 500ms
- Memory query < 50ms

### NFR2: Storage

- Efficient JSON storage
- Compression for large sessions
- Cleanup of old auto-saves

### NFR3: Privacy

- Local storage only (default)
- No telemetry of content
- Secure file permissions

---

## Technical Design

### Session Manager

```typescript
class SessionManager {
  constructor();

  getSession(): SessionContext;
  getSessionId(): string;

  recordTurn(turn: Omit<ConversationTurn, 'turnNumber' | 'timestamp'>): void;

  getTurns(): ConversationTurn[];
  getRecentTurns(count: number): ConversationTurn[];

  getDuration(): number;
  getMetrics(): SessionMetrics;

  export(): SessionExport;
  static import(data: SessionExport): SessionManager;
}
```

### Session Storage

```typescript
class SessionStorage {
  constructor(baseDir: string);

  async save(session: SessionExport, name?: string): Promise<string>;
  async load(nameOrId: string): Promise<SessionExport>;
  async list(): Promise<SessionInfo[]>;
  async delete(nameOrId: string): Promise<boolean>;

  async autoSave(session: SessionExport): Promise<void>;
  async loadLatest(): Promise<SessionExport | null>;
}
```

### Memory Store

```typescript
class MemoryStore {
  constructor(storePath: string);

  async add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessed'>): Promise<string>;
  async get(id: string): Promise<MemoryEntry | null>;
  async search(query: string, limit?: number): Promise<MemoryEntry[]>;
  async delete(id: string): Promise<boolean>;

  async getForProject(projectPath: string): Promise<MemoryEntry[]>;
  async cleanup(maxAge: number): Promise<number>;
}
```

---

## Storage Format

### Session File

```json
{
  "version": "1.0",
  "session": {
    "sessionId": "uuid-here",
    "startedAt": "2024-01-15T10:30:00Z",
    "turnCount": 5,
    "totalTokens": 12500,
    "modifiedFiles": ["src/main.ts"],
    "commandsExecuted": 3
  },
  "turns": [
    {
      "turnNumber": 1,
      "userMessage": "Fix the bug",
      "assistantResponse": "I found the issue...",
      "toolCalls": [...],
      "timestamp": "2024-01-15T10:30:00Z",
      "tokens": { "prompt": 500, "completion": 200 }
    }
  ],
  "workspace": {
    "rootPath": "/path/to/project",
    "isGitRepo": true,
    "gitBranch": "main"
  },
  "savedAt": "2024-01-15T10:45:00Z"
}
```

### Memory File

```json
{
  "version": "1.0",
  "entries": [
    {
      "id": "mem-001",
      "type": "project",
      "content": "Uses ESLint with Prettier for formatting",
      "createdAt": "2024-01-10T00:00:00Z",
      "lastAccessed": "2024-01-15T10:00:00Z",
      "relevanceScore": 0.8,
      "projectPath": "/path/to/project"
    }
  ]
}
```

---

## Testing Strategy

### Unit Tests

- Session ID generation
- Turn recording
- Metrics calculation
- Export/import

### Integration Tests

- File system operations
- Session save/load cycle
- Memory persistence

### Scenario Tests

- Long running sessions
- Session resume workflow
- Checkpoint restore

---

## Dependencies

- `node:fs/promises` - File operations
- `uuid` - ID generation

---

## Future Enhancements

1. **Cloud Sync**: Sync sessions across machines
2. **Session Sharing**: Export/import with others
3. **Analytics Dashboard**: Visual session insights
4. **Smart Resume**: AI-suggested resume points
5. **Memory Graph**: Connected memory entries
