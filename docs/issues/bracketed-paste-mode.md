# Bracketed Paste Mode Implementation

Issues encountered while implementing proper paste detection in the Ink-based CLI.

---

## Issue: Fast Typing Falsely Detected as Paste

### Problem
The original paste detection used a character count heuristic:
```typescript
if (char.length > 3 || (char.length > 1 && (char.includes('\n') || char.includes('\t')))) {
  // Treat as paste
}
```

This caused false positives when typing quickly, as multiple keystrokes could arrive in a single `useInput` callback.

### Solution
Implement **bracketed paste mode**, a terminal protocol where:
- Terminal sends `\x1b[200~` before pasted content
- Terminal sends `\x1b[201~` after pasted content

Enable with `\x1b[?2004h`, disable with `\x1b[?2004l`.

**Files:**
- `packages/cli/src/ui/components/InputArea.tsx`

---

## Issue: ESC Character Stripped by Readline

### Problem
When detecting paste markers in `useInput`, the ESC character (`\x1b`) is sometimes stripped by readline before reaching the callback. Instead of receiving `\x1b[200~`, we receive `[200~`.

### Debug Finding
Added debug logging to see actual input:
```
char: "[200~🤖 Default v1.0.0\r📁 Workspace...\u001b[201~", len: 113
```

The start marker has ESC stripped (`[200~`), but the end marker retains it (`\u001b[201~`).

### Solution
Check for both variants of paste markers:
```typescript
const hasStartMarker = combined.includes('\x1b[200~') || combined.includes('[200~');
const hasEndMarker = combined.includes('\x1b[201~') || combined.includes('[201~');
```

**File:** `packages/cli/src/ui/components/InputArea.tsx`

---

## Issue: Incorrect Marker Length When Slicing

### Problem
When removing the stripped start marker `[200~`, the code used length 6:
```typescript
char = char.slice(startIdxStripped + 6); // WRONG
```

But `[200~` is only 5 characters (the 6th would be ESC). This caused the first character of pasted content to be corrupted:
```
🤖 Default v1.0.0  →  � Default v1.0.0
```

### Solution
Use correct length for stripped markers:
```typescript
if (startIdx !== -1) {
  char = char.slice(startIdx + PASTE_START.length); // 6 chars with ESC
} else if (startIdxStripped !== -1) {
  char = char.slice(startIdxStripped + 5); // 5 chars without ESC: '[200~'
}
```

**File:** `packages/cli/src/ui/components/InputArea.tsx`

---

## Issue: Carriage Return Overwrites Previous Lines

### Problem
Pasted content from some sources uses `\r` (carriage return) as line separator instead of `\n`. When displayed or expanded:
```
🤖 Default v1.0.0\r📁 Workspace...\r📋 A helpful assistant
```

The `\r` moves cursor to line start, causing each line to overwrite the previous. Only the last line was visible.

### Debug Finding
```
char: "[200~🤖 Default v1.0.0\r📁 Workspace: /Users/bean/kakao/beans-code\r📋 A helpful general-purpose AI assistant\u001b[201~"
```

### Solution
Normalize line endings when handling paste:
```typescript
const handlePasteContent = useCallback((content: string) => {
  // Normalize line endings: \r\n -> \n, \r -> \n
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = normalizedContent.split('\n');
  const lineCount = lines.length - 1;

  // Save normalizedContent, not original
  setPasteTokens(tokens => {
    const next = new Map(tokens);
    next.set(newId, { original: normalizedContent, lineCount, charCount: normalizedContent.length });
    return next;
  });
}, [cursorPos, isLoading]);
```

**File:** `packages/cli/src/ui/components/InputArea.tsx`

---

## Issue: Test Environment Pollution

### Problem
During tests, the escape sequences for enabling/disabling bracketed paste mode polluted test output:
```
[?2004h[?2004l[?2004h[?2004l...
```

Also caused `MaxListenersExceededWarning` from adding too many process listeners.

### Solution
Skip escape sequences and process listeners in test environment:
```typescript
useEffect(() => {
  const isTestEnv = process.env['NODE_ENV'] === 'test' || process.env['VITEST'];
  if (!isTestEnv) {
    process.stdout.write(ENABLE_BRACKETED_PASTE);
  }

  // Only add process listeners in non-test environment
  if (!isTestEnv) {
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  return () => {
    // Cleanup...
  };
}, []);
```

**File:** `packages/cli/src/ui/components/InputArea.tsx`

---

## Summary: Final Implementation

The bracketed paste mode implementation:

1. **Enable bracketed paste** on mount via `\x1b[?2004h`
2. **Detect paste markers** in `useInput` callback (handles both full and ESC-stripped variants)
3. **Buffer paste content** between start and end markers
4. **Normalize line endings** (`\r` → `\n`)
5. **Create paste token** with unique ID and display as `[Pasted #N +X lines]`
6. **Expand tokens** to original content on submit

### Key Code Sections

```typescript
// Constants
const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
const ENABLE_BRACKETED_PASTE = '\x1b[?2004h';
const DISABLE_BRACKETED_PASTE = '\x1b[?2004l';

// Detection in useInput
const hasStartMarker = combined.includes(PASTE_START) || combined.includes('[200~');
const hasEndMarker = combined.includes(PASTE_END) || combined.includes('[201~');

if (hasStartMarker) {
  isPastingRef.current = true;
  pasteBufferRef.current = '';
  // Slice off marker (5 chars without ESC, 6 with)
  char = char.slice(startIdxStripped + 5);
}

if (hasEndMarker) {
  contentBeforeEnd = char.slice(0, endIdx);
  pasteBufferRef.current += contentBeforeEnd;
  handlePasteContent(pasteBufferRef.current);
  return;
}

if (isPastingRef.current) {
  pasteBufferRef.current += char;
  return;
}
```

### References
- gemini-cli `KeypressContext.tsx` - Uses PassThrough stream approach
- Terminal bracketed paste mode: https://cirw.in/blog/bracketed-paste
