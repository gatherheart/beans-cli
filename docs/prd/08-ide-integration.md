# PRD: IDE Integration

## Overview

IDE Integration enables Beans Agent to work alongside code editors like VS Code, providing a seamless experience where the agent can see what the developer sees and make changes that appear in real-time.

## Problem Statement

CLI-only interaction has limitations:
- Context switching between terminal and editor
- Manual file navigation
- No visibility into editor state
- Changes require manual refresh

IDE integration creates a unified experience.

## Goals

- **G1**: Connect to VS Code and similar editors
- **G2**: Access current editor context (open files, selection)
- **G3**: Apply changes directly in the editor
- **G4**: Provide inline suggestions and fixes
- **G5**: Show agent activity in IDE

## Non-Goals

- Full IDE replacement
- Language server implementation
- Debugging integration

---

## Functional Requirements

### FR1: IDE Connection Protocol

**Description**: Protocol for CLI-to-IDE communication.

**Specification**:
```typescript
interface IDEConnection {
  connect(port: number): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  onRequest(handler: (request: IDERequest) => Promise<IDEResponse>): void;
  sendNotification(notification: IDENotification): void;
}
```

**Transport**: WebSocket on localhost

**Acceptance Criteria**:
- [ ] Connects to IDE extension
- [ ] Bidirectional communication
- [ ] Reconnects on disconnect
- [ ] Secure local-only

### FR2: Editor Context Access

**Description**: Get current state of the editor.

**Specification**:
```typescript
interface EditorContext {
  activeFile?: FileContext;
  openFiles: string[];
  selection?: SelectionContext;
  visibleRanges?: Range[];
  diagnostics: Diagnostic[];
}

interface FileContext {
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
}

interface SelectionContext {
  file: string;
  start: Position;
  end: Position;
  text: string;
}
```

**Acceptance Criteria**:
- [ ] Gets active file content
- [ ] Gets current selection
- [ ] Lists open files
- [ ] Gets diagnostics (errors)

### FR3: Editor Actions

**Description**: Perform actions in the editor.

**Specification**:
```typescript
interface IDEActions {
  // File operations
  openFile(path: string, selection?: Range): Promise<void>;
  closeFile(path: string): Promise<void>;

  // Editing
  applyEdit(edit: TextEdit): Promise<void>;
  applyEdits(edits: TextEdit[]): Promise<void>;

  // UI
  showMessage(message: string, type: 'info' | 'warning' | 'error'): Promise<void>;
  showQuickPick(items: QuickPickItem[]): Promise<string | undefined>;

  // Diagnostics
  showDiagnostic(diagnostic: Diagnostic): void;
  clearDiagnostics(source: string): void;
}

interface TextEdit {
  path: string;
  range: Range;
  newText: string;
}
```

**Acceptance Criteria**:
- [ ] Opens files in editor
- [ ] Applies text edits
- [ ] Shows notifications
- [ ] Quick pick works

### FR4: VS Code Extension

**Description**: Extension to enable IDE integration.

**Features**:
- Starts/stops agent connection
- Shows agent status
- Forwards context
- Applies edits
- Shows agent panel

**Extension Commands**:
- `beans.connect` - Connect to agent
- `beans.disconnect` - Disconnect
- `beans.sendSelection` - Send selection to agent
- `beans.showPanel` - Show agent panel

**Acceptance Criteria**:
- [ ] Installs from marketplace
- [ ] Connects reliably
- [ ] Status bar indicator
- [ ] Panel shows output

### FR5: Real-time Edit Preview

**Description**: Preview changes before applying.

**Specification**:
```typescript
interface EditPreview {
  show(edits: TextEdit[]): Promise<void>;
  accept(): Promise<void>;
  reject(): Promise<void>;
  modify(edits: TextEdit[]): Promise<void>;
}
```

**UI**:
- Diff view showing changes
- Accept/Reject buttons
- Per-hunk accept

**Acceptance Criteria**:
- [ ] Shows diff preview
- [ ] Can accept/reject
- [ ] Partial accept works
- [ ] Undo available

### FR6: Inline Suggestions

**Description**: Show agent suggestions inline in code.

**Specification**:
```typescript
interface InlineSuggestion {
  range: Range;
  text: string;
  description?: string;
  actions: SuggestionAction[];
}

type SuggestionAction = 'accept' | 'reject' | 'modify' | 'explain';
```

**Acceptance Criteria**:
- [ ] Ghost text preview
- [ ] Tab to accept
- [ ] Esc to reject
- [ ] Can request explanation

### FR7: Agent Panel

**Description**: Side panel showing agent interaction.

**Features**:
- Conversation history
- Current activity
- Tool call logs
- Quick actions

**Acceptance Criteria**:
- [ ] Shows in sidebar
- [ ] Real-time updates
- [ ] Interactive input
- [ ] File links clickable

### FR8: Diagnostic Integration

**Description**: Use IDE diagnostics for context.

**Flow**:
1. IDE sends diagnostics to agent
2. Agent sees errors/warnings
3. Agent can offer fixes
4. Fixes applied via IDE

**Acceptance Criteria**:
- [ ] Receives diagnostics
- [ ] Can fix errors
- [ ] Shows in context
- [ ] Quick fix integration

---

## Non-Functional Requirements

### NFR1: Performance

- Connection < 500ms
- Edit application < 100ms
- No editor lag

### NFR2: Reliability

- Handles editor restart
- Graceful disconnection
- State recovery

### NFR3: Security

- Localhost only
- No arbitrary code exec
- User approval for changes

---

## Technical Design

### Architecture

```
┌──────────────────┐     WebSocket      ┌──────────────────┐
│   Beans CLI      │◄──────────────────►│   VS Code        │
│                  │                    │   Extension      │
│  ┌────────────┐  │                    │  ┌────────────┐  │
│  │ IDE Client │  │                    │  │ IDE Server │  │
│  └────────────┘  │                    │  └────────────┘  │
└──────────────────┘                    └──────────────────┘
```

### Protocol Messages

```typescript
// Request from CLI to IDE
interface IDERequest {
  id: string;
  type: 'getContext' | 'applyEdit' | 'openFile' | 'showMessage';
  params: Record<string, unknown>;
}

// Response from IDE
interface IDEResponse {
  id: string;
  result?: unknown;
  error?: { message: string; code: number };
}

// Notification (no response)
interface IDENotification {
  type: 'contextChanged' | 'diagnosticsChanged' | 'selectionChanged';
  params: Record<string, unknown>;
}
```

### IDE Client

```typescript
class IDEClient {
  constructor(port: number);

  async connect(): Promise<void>;
  async disconnect(): Promise<void>;

  // Context
  async getContext(): Promise<EditorContext>;
  async getActiveFile(): Promise<FileContext | null>;
  async getSelection(): Promise<SelectionContext | null>;

  // Actions
  async openFile(path: string): Promise<void>;
  async applyEdit(edit: TextEdit): Promise<void>;
  async showMessage(message: string): Promise<void>;

  // Events
  onContextChange(handler: (context: EditorContext) => void): void;
  onDiagnosticsChange(handler: (diagnostics: Diagnostic[]) => void): void;
}
```

### VS Code Extension Structure

```
vscode-beans-agent/
├── package.json
├── src/
│   ├── extension.ts      # Extension entry
│   ├── server.ts         # WebSocket server
│   ├── commands.ts       # VS Code commands
│   ├── panel.ts          # Webview panel
│   └── providers/
│       ├── completion.ts # Inline suggestions
│       └── codeAction.ts # Quick fixes
└── media/
    └── panel.js          # Panel UI
```

---

## Message Examples

### Get Context

```json
// Request
{
  "id": "1",
  "type": "getContext",
  "params": {}
}

// Response
{
  "id": "1",
  "result": {
    "activeFile": {
      "path": "/project/src/main.ts",
      "content": "...",
      "language": "typescript",
      "isDirty": false
    },
    "openFiles": ["/project/src/main.ts", "/project/src/utils.ts"],
    "selection": {
      "file": "/project/src/main.ts",
      "start": { "line": 10, "character": 0 },
      "end": { "line": 15, "character": 20 },
      "text": "selected code here"
    }
  }
}
```

### Apply Edit

```json
// Request
{
  "id": "2",
  "type": "applyEdit",
  "params": {
    "edit": {
      "path": "/project/src/main.ts",
      "range": {
        "start": { "line": 10, "character": 0 },
        "end": { "line": 10, "character": 20 }
      },
      "newText": "const result = calculate();"
    }
  }
}

// Response
{
  "id": "2",
  "result": { "success": true }
}
```

---

## Testing Strategy

### Unit Tests

- Protocol message handling
- Edit transformation
- Context parsing

### Integration Tests

- Mock VS Code API
- Full message flow
- Error scenarios

### Manual Testing

- Real VS Code extension
- Various file types
- Multi-window support

---

## Dependencies

### CLI
- `ws` - WebSocket client

### VS Code Extension
- `vscode` - VS Code API
- `ws` - WebSocket server

---

## Future Enhancements

1. **JetBrains Plugin**: IntelliJ, WebStorm support
2. **Neovim Plugin**: Native Neovim integration
3. **Cursor Integration**: Cursor editor support
4. **Remote Development**: Works over SSH
5. **Collaborative**: Multi-cursor support
