# Input and Paste Handling Issues

## Status: Resolved

## Summary

Refactored input handling to follow gemini-cli patterns. Removed custom paste token system and custom keypress handling. Now uses Ink's built-in `useInput` hook directly.

## Fixes Applied

### Fix 1: React import error
- **Issue**: `React is not defined` error at runtime
- **Cause**: `import type React from 'react'` only imports the type
- **Fix**: Changed to `import React, { ... } from 'react'`

### Fix 2: Character input not detected
- **Issue**: Typing produced no output
- **Cause**: Condition `!key.name` was false for letters (readline sets `key.name` to the letter)
- **Fix**: Check `isSpecialKey` list instead of `!key.name`

### Fix 3: Removed paste token system
- **Issue**: Overly complex paste handling with `§PASTE:id§` markers
- **Fix**: Direct paste insertion following gemini-cli pattern
- **Result**: Reduced InputArea from 556 to ~300 lines

### Fix 4: Refactored to reducer pattern (following gemini-cli)
- **Issue**: Characters typed in wrong order ("tset" instead of "test")
- **Cause**: React state updates are async; multiple keypresses used stale closure values
- **Fix**: Use `useReducer` for atomic state updates (like gemini-cli's TextBuffer)

```typescript
// InputArea.tsx - reducer pattern for atomic updates
interface InputState {
  text: string;
  cursorPos: number;
}

type InputAction =
  | { type: 'insert'; payload: string }
  | { type: 'backspace' }
  | { type: 'delete' }
  | { type: 'move'; payload: 'left' | 'right' | 'home' | 'end' }
  | { type: 'clear' }
  | { type: 'set_text'; payload: { text: string; cursorPos?: number } };

function inputReducer(state: InputState, action: InputAction): InputState {
  switch (action.type) {
    case 'insert': {
      const { text, cursorPos } = state;
      return {
        text: text.slice(0, cursorPos) + action.payload + text.slice(cursorPos),
        cursorPos: cursorPos + action.payload.length,
      };
    }
    // ... other actions
  }
}

// Component uses dispatch for all state changes
const [state, dispatch] = useReducer(inputReducer, { text: '', cursorPos: 0 });
dispatch({ type: 'insert', payload: char });
```

### Fix 5: Removed custom keypress system
- **Issue**: Over-engineered keypress handling with KeypressContext, useKeypress hook, useBracketedPaste
- **Reason**: Since paste is just text insertion (no special handling needed), the complexity was unnecessary
- **Fix**: Use Ink's built-in `useInput` hook directly
- **Deleted files**:
  - `ui/contexts/KeypressContext.tsx`
  - `ui/hooks/useKeypress.ts`
  - `ui/hooks/useBracketedPaste.ts`
  - `ui/utils/platformConstants.ts`

### Fix 6: PTY Enter key compatibility
- **Issue**: Enter key not working in E2E tests with PTY
- **Cause**: Ink's `useInput` doesn't set `key.return` for '\r' sent through PTY
- **Fix**: Check both `key.return` and `char === '\r'` for Enter detection

```typescript
// Enter: submit or backslash continuation
// Check both key.return and char === '\r' for PTY compatibility
if (key.return || char === '\r') {
  handleSubmit(input);
  return;
}
```

## Final Architecture (Simplified)

### InputArea Component
- Uses `useReducer` for atomic state updates
- Uses Ink's `useInput` hook directly for keyboard input
- No custom keypress handling or context providers needed

```typescript
// Uses Ink's useInput instead of custom useKeypress
useInput((char, key) => {
  if (isLoading) return;
  if (key.ctrl && char === 'c') { onExit(); return; }
  if (key.leftArrow) { dispatch({ type: 'move', payload: 'left' }); return; }
  if (char && !key.ctrl && !key.meta) { dispatch({ type: 'insert', payload: char }); }
}, { isActive: !isLoading });
```

## Files Changed

| File | Status |
|------|--------|
| `ui/components/InputArea.tsx` | Simplified, uses `useReducer` + `useInput` |
| `ui/App.tsx` | Removed KeypressProvider and useBracketedPaste |
| `ui/contexts/KeypressContext.tsx` | **Deleted** |
| `ui/hooks/useKeypress.ts` | **Deleted** |
| `ui/hooks/useBracketedPaste.ts` | **Deleted** |
| `ui/utils/platformConstants.ts` | **Deleted** |

## Manual Testing

### Paste Test Commands

```bash
# Test single-line paste with bracketed paste markers
printf '\x1b[200~pasted content\x1b[201~' | timeout 3 npm run dev -- --ui-test

# Test multi-line paste
printf '\x1b[200~line1\nline2\nline3\x1b[201~' | timeout 3 npm run dev -- --ui-test

# Test Windows line endings
printf '\x1b[200~line1\r\nline2\r\nline3\x1b[201~' | timeout 3 npm run dev -- --ui-test

# Test paste without escape sequences (simple pipe)
echo 'hello world' | timeout 3 npm run dev -- --ui-test
```

### Manual Paste Test

1. Run `npm run dev`
2. Copy some text to clipboard
3. Paste into the input area (Cmd+V or Ctrl+V)
4. Verify:
   - Text appears correctly in input area
   - No escape characters visible (like `[200~`)
   - Multi-line content preserves newlines
   - Enter key still submits the message

## Test Results

All tests passing.
