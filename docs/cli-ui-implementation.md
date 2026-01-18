# CLI UI Implementation - Issues and Solutions

This document describes the issues encountered while implementing the Ink-based CLI UI and their solutions.

## Overview

The goal was to upgrade the CLI from basic `readline` + `console.log` to an Ink (React for CLI) based UI with:
- Visually separated input area
- Markdown-formatted output
- Real-time streaming with final markdown render

---

## Issue 1: React Version Mismatch

### Problem
```
TypeError: Cannot read properties of undefined (reading 'ReactCurrentOwner')
```

Multiple React versions were installed in the monorepo:
- `ink@6.x` requires `react@>=19.0.0`
- `ink-spinner@5.0.0` bundled `ink@5.2.1` which required `react@18.x`
- `ink-text-input@6.0.0` also had version conflicts

### Solution
1. Use exact same versions as gemini-cli reference project:
   ```json
   {
     "ink": "^6.2.3",
     "ink-spinner": "^5.0.0",
     "react": "^19.1.0"
   }
   ```

2. Remove `ink-text-input` (caused conflicts) and implement custom input handling using Ink's `useInput` hook

3. Clean reinstall to dedupe dependencies:
   ```bash
   rm -rf node_modules packages/*/node_modules package-lock.json
   npm install
   ```

**File:** `packages/cli/package.json`

---

## Issue 2: JSX Namespace Not Found

### Problem
```
error TS2503: Cannot find namespace 'JSX'.
```

With React 19 and the new JSX transform, `JSX.Element` is no longer directly available.

### Solution
Replace `JSX.Element` with `React.ReactElement` in all component return types:

```typescript
// Before
function Component(): JSX.Element { ... }

// After
function Component(): React.ReactElement { ... }
```

**Files:** All `.tsx` files in `packages/cli/src/ui/`

---

## Issue 3: Raw Mode Not Supported (When Piping)

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

## Issue 4: /help Command Not Working

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

## Issue 5: Multi-line Input Display

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

## Issue 6: Multi-line Input Methods

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

## Issue 7: UI Flickering When Typing

### Problem
The entire UI flickered on every keystroke because all components re-rendered.

### Solution
1. **Use Ink's `Static` component** for completed messages - prevents re-rendering of finalized content
2. **Use `React.memo`** on Message and MarkdownDisplay components

```tsx
// ChatView.tsx - Separate completed and streaming messages
const completedMessages = messages.filter(m => !m.isStreaming);
const streamingMessages = messages.filter(m => m.isStreaming);

// Completed messages wrapped in Static (never re-render)
<Static items={completedMessages}>
  {(message) => <Message key={message.id} message={message} />}
</Static>

// Only streaming messages are dynamic
{streamingMessages.map(message => (
  <Message key={message.id} message={message} />
))}
```

```tsx
// Message.tsx - Memoized component
export const Message = React.memo(function Message({ message }: MessageProps) {
  // ...
});

// MarkdownDisplay.tsx - Memoized component
export const MarkdownDisplay = React.memo(function MarkdownDisplay({ text }: Props) {
  // ...
});
```

**Files:**
- `packages/cli/src/ui/components/ChatView.tsx`
- `packages/cli/src/ui/components/Message.tsx`
- `packages/cli/src/ui/components/MarkdownDisplay.tsx`

---

## Issue 8: Duplicate React Keys Warning

### Problem
```
Encountered two children with the same key
```

The `renderHastNode` function in MarkdownDisplay was generating duplicate keys for syntax-highlighted code.

### Solution
Use a module-level counter for unique keys:

```typescript
let hastKeyCounter = 0;

function renderHastNode(node: RootContent): React.ReactNode {
  const key = `hast-${hastKeyCounter++}`;
  // ...
}

function renderHighlightedCode(code: string, language: string | null) {
  hastKeyCounter = 0; // Reset counter for each code block
  // ...
}
```

**File:** `packages/cli/src/ui/components/MarkdownDisplay.tsx`

---

## Architecture Summary

```
packages/cli/src/
├── index.ts                    # Entry point
├── app.tsx                     # Main app, renders Ink
└── ui/
    ├── App.tsx                 # Root Ink component
    ├── contexts/
    │   └── ChatContext.tsx     # State: messages, sendMessage, etc.
    └── components/
        ├── ChatView.tsx        # Message list with Static
        ├── InputArea.tsx       # Input box with useInput
        ├── Message.tsx         # Single message (memoized)
        └── MarkdownDisplay.tsx # Markdown renderer (memoized)
```

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| ink | ^6.2.3 | React renderer for CLI |
| react | ^19.1.0 | React library |
| ink-spinner | ^5.0.0 | Loading spinners |
| lowlight | ^3.3.0 | Syntax highlighting |
| highlight.js | ^11.11.1 | Language detection |

---

## Issue 9: npm Cache Permission Error

### Problem
```
npm error EACCES: permission denied, rename '/Users/bean/.npm/_cacache/tmp/...'
npm error Your cache folder contains root-owned files
```

The global npm cache had permission issues preventing package installation.

### Solution
Use a local cache directory for npm install:

```bash
npm install --cache .npm-cache
```

Add `.npm-cache/` to `.gitignore`:
```
# Cache
.cache/
.npm/
.npm-cache/
```

**File:** `.gitignore`

---

## Issue 10: TSX File Extension Required

### Problem
TypeScript files using JSX syntax (React components) need the `.tsx` extension, but `app.ts` was importing React components.

### Solution
Rename `app.ts` to `app.tsx`:

```bash
mv packages/cli/src/app.ts packages/cli/src/app.tsx
```

The import in `index.ts` (`import { runApp } from './app.js'`) continues to work because TypeScript compiles `.tsx` to `.js`.

**File:** `packages/cli/src/app.tsx`

---

## Issue 11: tsconfig.json JSX Configuration

### Problem
TypeScript wasn't recognizing JSX syntax properly for React 19.

### Solution
Update `tsconfig.json` with proper JSX settings:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "esModuleInterop": true
  },
  "include": ["src/**/*", "src/**/*.tsx"]
}
```

**File:** `packages/cli/tsconfig.json`

---

## Issue 12: Monorepo Dependency Hoisting

### Problem
In a monorepo with npm workspaces, React was installed in multiple locations:
- Root `node_modules/react`
- `packages/cli/node_modules/react`

This caused "Invalid hook call" errors because components used different React instances.

### Solution
1. Keep React in the CLI package's dependencies (not root)
2. Let npm workspaces handle hoisting naturally
3. Clean install to ensure proper deduplication:

```bash
rm -rf node_modules packages/*/node_modules package-lock.json
npm install
```

Verify single React version:
```bash
npm ls react
```

Should show single deduped version:
```
└─┬ @beans/cli@0.1.0
  └── react@19.2.3
```

---

## Issue 13: Ink useInput Not Detecting Modifier Keys

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

---

## Issue 14: Streaming vs Final Render Strategy

### Problem
During streaming, markdown cannot be properly rendered because the content is incomplete (unclosed code blocks, partial lists, etc.).

### Solution
Implement "stream with final render" strategy:

1. **During streaming** (`isStreaming: true`): Show plain text + spinner
2. **After complete** (`isStreaming: false`): Render full markdown

```tsx
{message.isStreaming ? (
  // Plain text during streaming
  <Box flexDirection="column">
    <Text>{message.content}</Text>
    {message.content.length === 0 && (
      <Text color="gray">
        <Spinner type="dots" /> Thinking...
      </Text>
    )}
  </Box>
) : (
  // Markdown after complete
  <MarkdownDisplay text={message.content} />
)}
```

**File:** `packages/cli/src/ui/components/Message.tsx`

---

## Issue 15: Duplicate React Keys for Tool Calls

### Problem
```
Encountered two children with the same key, `call_0`. Keys should be unique...
```

The LLM returns tool call IDs like `call_0`, `call_1` that reset for each message. When multiple messages have tool calls, React encounters duplicate keys across the component tree.

### Solution
Use a combination of message ID and index for unique keys:

```tsx
// Before - toolCall.id may be duplicated across messages
{message.toolCalls.map(toolCall => (
  <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
))}

// After - combine message ID with index for uniqueness
{message.toolCalls.map((toolCall, index) => (
  <ToolCallDisplay key={`${message.id}-tool-${index}`} toolCall={toolCall} />
))}
```

**File:** `packages/cli/src/ui/components/Message.tsx`

---

## Reference

- gemini-cli: `/Users/bean/kakao/gemini-cli` - Reference implementation
- Ink documentation: https://github.com/vadimdemedes/ink
