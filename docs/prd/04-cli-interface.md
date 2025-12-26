# PRD: CLI Interface

## Overview

The CLI Interface is the primary user-facing component of Beans Agent. It provides an interactive terminal experience for developers to interact with the AI agent, view outputs, approve tool calls, and manage sessions.

## Problem Statement

Developers work primarily in terminals. They need:
- A natural, conversational interface to the AI
- Real-time visibility into what the agent is doing
- Control over potentially destructive operations
- A clean, readable output format

## Goals

- **G1**: Intuitive command-line interface
- **G2**: Real-time streaming of agent responses
- **G3**: Interactive approval for tool calls
- **G4**: Clean, themed terminal output
- **G5**: Session management (save/resume)

## Non-Goals

- Web-based interface (separate project)
- Mobile app
- Voice input/output

---

## Functional Requirements

### FR1: Command Line Arguments

**Description**: Parse and handle CLI arguments.

**Specification**:
```bash
beans [options] [prompt]

Options:
  -h, --help       Show help message
  -v, --version    Show version number
  -c, --continue   Continue previous session
  -m, --model      Specify model to use
  --yolo           Auto-approve all tool calls
  --cwd            Working directory
  --verbose        Verbose output
  --config         Path to config file
```

**Acceptance Criteria**:
- [ ] All flags parsed correctly
- [ ] Help displays usage info
- [ ] Version shows current version
- [ ] Unknown flags show error

### FR2: Interactive REPL Mode

**Description**: Start an interactive read-eval-print loop.

**Specification**:
- No prompt argument → enter REPL mode
- `>` prompt for user input
- Multi-line input with `\` continuation
- Special commands: `/help`, `/exit`, `/clear`, `/save`, `/load`

**Acceptance Criteria**:
- [ ] REPL starts without arguments
- [ ] Multi-line input works
- [ ] Commands are recognized
- [ ] Ctrl+C cancels current, Ctrl+D exits

### FR3: Response Streaming

**Description**: Display agent responses in real-time.

**Specification**:
- Text streams character by character
- Tool calls show name and status
- Thinking content shown (configurable)
- Markdown rendered in terminal

**Acceptance Criteria**:
- [ ] Responses stream incrementally
- [ ] Tool calls visually distinct
- [ ] Thinking content styled differently
- [ ] Code blocks formatted correctly

### FR4: Tool Call Approval

**Description**: Interactive approval workflow for tools.

**Specification**:
```
🔧 write_file: /path/to/file.ts
   [Y]es  [N]o  [A]ll  [V]iew

> v
[Shows preview of changes]

> y
✅ File written: 42 lines
```

**Options**:
- `y` - Approve this call
- `n` - Deny this call
- `a` - Approve all remaining
- `v` - View details/preview
- `e` - Edit parameters

**Acceptance Criteria**:
- [ ] Prompt shows tool and parameters
- [ ] All options work
- [ ] Preview shows relevant info
- [ ] Denied calls report to agent

### FR5: Theming and Colors

**Description**: Configurable color themes for output.

**Specification**:
- Light/Dark/Auto themes
- Configurable colors for:
  - User input
  - Agent response
  - Tool calls
  - Errors
  - Thinking content

**Acceptance Criteria**:
- [ ] Colors work on major terminals
- [ ] Auto detects terminal theme
- [ ] Can be disabled (NO_COLOR)
- [ ] High contrast option

### FR6: Progress Indicators

**Description**: Show activity during long operations.

**Specification**:
- Spinner during LLM calls
- Progress bar for file operations
- Timer for shell commands
- Token counter

**Acceptance Criteria**:
- [ ] Spinner animates smoothly
- [ ] Updates don't break output
- [ ] Clear indication of waiting
- [ ] Shows elapsed time

### FR7: Output Formatting

**Description**: Clean, readable output formatting.

**Specification**:
- Markdown rendering (headers, lists, code)
- Syntax highlighting for code
- Table formatting
- Link highlighting

**Acceptance Criteria**:
- [ ] Markdown headers styled
- [ ] Code blocks have syntax colors
- [ ] Tables align correctly
- [ ] Long lines wrap properly

### FR8: Session Commands

**Description**: Commands for session management.

**Commands**:
- `/save [name]` - Save current session
- `/load [name]` - Load a session
- `/list` - List saved sessions
- `/clear` - Clear conversation
- `/history` - Show conversation history
- `/undo` - Undo last action
- `/config` - Show/edit configuration

**Acceptance Criteria**:
- [ ] Sessions persist to disk
- [ ] Load restores full context
- [ ] Clear resets conversation
- [ ] History shows all turns

---

## Non-Functional Requirements

### NFR1: Performance

- Response latency < 50ms after LLM
- Smooth 60fps spinner animation
- Low CPU when idle

### NFR2: Compatibility

- Works on macOS, Linux, Windows
- Supports common terminals (iTerm2, Terminal, Windows Terminal)
- Degrades gracefully in limited terminals

### NFR3: Accessibility

- Screenreader compatible
- High contrast mode
- Keyboard-only operation
- Clear error messages

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────┐
│              CLI Entry Point            │
│  (Argument Parsing, Initialization)     │
├─────────────────────────────────────────┤
│              REPL Controller            │
│  (Input Loop, Command Dispatch)         │
├─────────────────────────────────────────┤
│              UI Components              │
│  (Spinner, Progress, Messages)          │
├─────────────────────────────────────────┤
│              Theme Engine               │
│  (Colors, Styles, Formatting)           │
└─────────────────────────────────────────┘
```

### Key Components

1. **Argument Parser**: Handles CLI flags and options
2. **REPL Controller**: Manages the interactive loop
3. **Output Renderer**: Formats and displays content
4. **Input Handler**: Processes user input
5. **Theme Engine**: Applies visual styling

### Terminal Capabilities

Detect and adapt to terminal capabilities:
- Color support (none, 16, 256, truecolor)
- Unicode support
- Window size
- Mouse support

### Input Handling

```typescript
interface InputHandler {
  readLine(prompt: string): Promise<string>;
  readMultiLine(): Promise<string>;
  readConfirmation(message: string): Promise<boolean>;
  readChoice(options: string[]): Promise<number>;
}
```

---

## User Experience Flows

### Single Command Flow

```
$ beans "fix the bug in main.ts"

🤖 Beans Agent v0.1.0
📁 Workspace: /path/to/project
🌿 Branch: main

> fix the bug in main.ts

🔍 Reading main.ts...
📝 Found issue on line 42

🔧 edit: main.ts
   Replace: `const x = undefined`
   With: `const x = getDefaultValue()`
   [Y]es [N]o [V]iew > y

✅ Fixed type error in main.ts

📊 Session: 2 turns, 1,234 tokens
```

### Interactive REPL Flow

```
$ beans

🤖 Beans Agent v0.1.0
📁 Workspace: /path/to/project

> What's in this project?

This is a TypeScript project with the following structure:
- src/ - Main source code
- tests/ - Test files
- package.json - Node.js configuration

> add a new endpoint for /users

🔧 write_file: src/routes/users.ts
   [Y]es [N]o [V]iew > y
✅ Created src/routes/users.ts

🔧 edit: src/app.ts
   [Y]es [N]o [V]iew > y
✅ Updated src/app.ts

I've added a new /users endpoint with GET and POST methods.

> /exit
Goodbye! Session saved.
```

---

## Testing Strategy

### Unit Tests

- Argument parsing
- Output formatting
- Theme application
- Command parsing

### Integration Tests

- Full REPL session
- Tool approval workflow
- Session save/load

### Manual Testing

- Various terminal emulators
- Different color schemes
- Screen reader testing

---

## Dependencies

- `yargs` - Argument parsing
- `chalk` - Terminal colors
- `ink` - React for CLI (optional)
- `ora` - Spinner
- `marked` - Markdown parsing

---

## Future Enhancements

1. **Autocomplete**: Tab completion for files/commands
2. **History Search**: Ctrl+R history search
3. **Split View**: Side-by-side code/output
4. **Notifications**: Desktop notifications for long tasks
5. **Web Dashboard**: Browser-based session viewer
