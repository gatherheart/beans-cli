# Ink Input Handling Issues

Issues encountered while implementing keyboard input in the Ink-based CLI.

---

## Issue: Raw Mode Not Supported (When Piping)

### Problem
```
ERROR: Raw mode is not supported on the current process.stdin
```

This occurs when running the CLI with piped input (e.g., `echo "/exit" | node dist/index.js`).

### Solution
This is expected behavior - Ink requires an interactive TTY for keyboard input. The error only appears when stdin is not a TTY.

For testing, run the CLI directly in an interactive terminal:
```bash
node packages/cli/dist/index.js
```

---

## Issue: /help Command Not Working

### Problem
The `/help` command cleared the input but didn't display any help text.

### Solution
1. Add `addSystemMessage` function to ChatContext to display system messages
2. Update InputArea to call `addSystemMessage(HELP_TEXT)` for `/help` command
3. Update Message component to handle `role: 'system'` messages

**Files:**
- `packages/cli/src/ui/contexts/ChatContext.tsx` - Added `addSystemMessage`
- `packages/cli/src/ui/components/InputArea.tsx` - Handle slash commands
- `packages/cli/src/ui/components/Message.tsx` - Display system messages with `ℹ` icon

---

## Issue: Multi-line Input Display

### Problem
When using Shift+Enter to insert newlines, the cursor displayed incorrectly.

### Solution
1. Split input by newlines and render each line separately
2. Show ` > ` prefix for first line, ` . ` for continuation lines
3. Display cursor `█` only at end of last line

```tsx
const lines = input.split('\n');

{lines.map((line, index) => (
  <Box key={`input-line-${index}`}>
    <Text color="cyan">{index === 0 ? ' > ' : ' . '}</Text>
    <Text>{line}</Text>
    {index === lines.length - 1 && <Text color="cyan">█</Text>}
  </Box>
))}
```

**File:** `packages/cli/src/ui/components/InputArea.tsx`

---

## Issue: Multi-line Input Methods

### Problem
Need multiple ways to insert newlines, following gemini-cli patterns.

### Solution
Implement three methods for inserting newlines:

1. **Shift+Enter** - Direct newline insertion
2. **Ctrl+J** - Alternative newline (Unix convention)
3. **Backslash + Enter** - Type `\` at end, press Enter → removes `\` and inserts newline

```typescript
// Ctrl+J: insert newline
if (key.ctrl && char === 'j') {
  setInput(prev => prev + '\n');
  return;
}

// Shift+Enter: insert newline
if (key.return && key.shift) {
  setInput(prev => prev + '\n');
  return;
}

// Enter: check for backslash continuation
if (key.return) {
  if (input.endsWith('\\')) {
    setInput(prev => prev.slice(0, -1) + '\n');
    return;
  }
  handleSubmit(input);
}
```

**File:** `packages/cli/src/ui/components/InputArea.tsx`

---

## Issue: Ink useInput Not Detecting Modifier Keys

### Problem
Ink's `useInput` hook may not reliably detect `key.shift` with `key.return` on all terminals.

### Solution
Provide multiple methods for the same action:

```typescript
// Multiple ways to insert newline
if (key.ctrl && char === 'j') {        // Ctrl+J (reliable)
  setInput(prev => prev + '\n');
  return;
}

if (key.return && key.shift) {          // Shift+Enter (terminal-dependent)
  setInput(prev => prev + '\n');
  return;
}

if (key.return && input.endsWith('\\')) { // Backslash continuation (always works)
  setInput(prev => prev.slice(0, -1) + '\n');
  return;
}
```

This ensures at least one method works regardless of terminal capabilities.

**File:** `packages/cli/src/ui/components/InputArea.tsx`
