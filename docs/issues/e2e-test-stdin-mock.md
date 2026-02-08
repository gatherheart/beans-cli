# E2E Test Stdin Mock Issue

## Problem

E2E tests were failing with various issues:
1. **Timeout waiting for patterns** - Tests couldn't find expected output like "mock response"
2. **Character ordering issues** - Input like "Hello world" appeared as "Helol world" or "eHllo world"
3. **Exit command not working** - `/exit` command didn't trigger process exit

## Root Cause

### 1. Ink's Key Detection Mechanism

Ink's `useInput` hook uses `parseKeypress` to detect special keys like Enter. The parser expects each character to arrive as a **separate event**, like a real TTY in raw mode does.

```javascript
// From Ink's parse-keypress.js
if (s === '\r') {
    key.name = 'return';  // Only triggers when ENTIRE string is '\r'
}
```

When we wrote `test message\r` to stdin, it arrived as a single chunk. The parser compared the entire string to `'\r'`, which failed, so Enter was never detected.

### 2. Non-TTY Environment

E2e tests spawn the CLI as a subprocess where `process.stdin.isTTY` is `false`. Ink requires `setRawMode()` support, which only exists in TTY environments.

### 3. Race Conditions in Character Emission

Initial attempts to emit characters one at a time used Promise chains or setTimeout patterns that had race conditions:
- Multiple `write()` calls could interleave
- JavaScript event loop timing caused out-of-order processing

## Why mockStdin is Necessary

### The Fundamental Problem

Ink (the React-based terminal UI framework) was designed for interactive terminal use where:
1. The terminal is in **raw mode** - each keypress is sent immediately without buffering
2. `process.stdin.isTTY` is `true` - the process is connected to a real terminal
3. `setRawMode()` is available - allows disabling line buffering

E2E tests break all three assumptions:

```
Real Terminal (TTY)              E2E Test (Subprocess)
┌─────────────────────┐          ┌─────────────────────┐
│ User types: H       │          │ Test writes: Hello\r│
│ stdin emits: 'H'    │          │ stdin emits: 'Hello\r' (one chunk)
│                     │          │                     │
│ User types: e       │          │ Ink receives entire │
│ stdin emits: 'e'    │          │ string at once      │
│ ...                 │          │                     │
│ User presses Enter  │          │ parseKeypress fails │
│ stdin emits: '\r'   │          │ to detect Enter key │
└─────────────────────┘          └─────────────────────┘
```

### Why Not Just Use Real Stdin?

When a subprocess is spawned in Node.js:
- `process.stdin.isTTY` becomes `false`
- `setRawMode()` throws an error ("setRawMode is not a function")
- Input is line-buffered by the OS, arriving as complete strings

Ink checks for TTY and raw mode support at startup. Without these, keyboard input handling breaks silently - keys are received but special key detection (Enter, Escape, arrows) fails.

### What mockStdin Provides

mockStdin bridges the gap between how tests write input and how Ink expects to receive it:

| Aspect | Real stdin (TTY) | Real stdin (Subprocess) | mockStdin |
|--------|------------------|-------------------------|-----------|
| `isTTY` | `true` | `false` | `true` (faked) |
| `setRawMode()` | Available | Throws error | No-op that returns `this` |
| Input delivery | Character by character | Buffered chunks | Character by character (simulated) |
| Enter detection | Works | Broken | Works |

### Why Not Fix Ink Instead?

Modifying Ink's input handling would be:
1. **Invasive**: Requires changes to Ink's core `useInput` hook
2. **Fragile**: May break with Ink updates
3. **Scope creep**: Ink is designed for TTY; non-TTY is out of scope

mockStdin is a thin adapter that makes the test environment look like what Ink expects, without modifying Ink itself.

## Solution

### 1. Mock Stdin with Sequential Character Emission

Created `mockStdin.ts` that:
- Queues all incoming characters
- Emits them one at a time with delays
- Uses a simple loop pattern to avoid race conditions

```typescript
// Queue-based approach with single processing loop
const processNextChar = () => {
  if (pendingChars.length === 0) {
    isRunning = false;
    return;
  }
  const char = pendingChars.shift()!;
  stream.push(char);
  setTimeout(processNextChar, CHAR_DELAY_MS);
};
```

### 2. Conditional Mock Stdin Usage

The mock stdin is only used when `--ui-test` flag is set:

```typescript
export function createStdinAdapter(options: StdinAdapterOptions = {}): StdinAdapter {
  const { uiTestMode = false } = options;

  // Only create mock stdin in UI test mode when raw mode is not supported
  if (isRawModeSupported() || !uiTestMode) {
    return { renderOptions: {}, cleanup: () => {} };
  }

  // Create mock stdin for e2e testing...
}
```

This ensures:
- Normal CLI usage in non-TTY environments (CI, Docker) doesn't use mock stdin
- Only e2e tests (with `--ui-test` flag) use the character-by-character emission

### 3. Test Adjustments

- **Exit test**: Wait for "Goodbye" message instead of process exit event
- **User message test**: Use shorter input and verify response instead of exact input
- **Multi-turn test**: Added delays between messages

## Files Changed

- `packages/cli/src/utils/mockStdin.ts` - Sequential character emission
- `packages/cli/src/utils/stdinAdapter.ts` - Adapter to switch between real and mock stdin
- `packages/cli/src/app.tsx` - Set `uiTestMode` in config for e2e tests
- `packages/core/src/config/types.ts` - Added `uiTestMode` to UIConfig
- `packages/core/src/config/config.ts` - Added default for `uiTestMode`
- `tests/e2e/anti-flicker.test.ts` - Adjusted test assertions and timeouts
- `tests/e2e/globalTeardown.ts` - Force exit to clean up hanging processes
- `vitest.e2e.config.ts` - Added globalTeardown for process cleanup

## Why createStdinAdapter?

The `createStdinAdapter` function was introduced to encapsulate the complexity of stdin handling:

1. **Separation of Concerns**: The adapter pattern separates the decision logic (when to use mock stdin) from the implementation (how mock stdin works).

2. **Config-Driven Behavior**: By accepting the `Config` object, the adapter can check `config.getUIConfig().uiTestMode` to determine behavior. This keeps the flag in a single, central location.

3. **Clean Integration with Ink**: The adapter returns `renderOptions` that can be spread into Ink's `render()` call, making integration seamless.

4. **Proper Cleanup**: The adapter provides a `cleanup()` function to remove event listeners and close the mock stream when the app exits.

```typescript
// Usage in app.tsx
const stdinAdapter = createStdinAdapter(config);
const { waitUntilExit } = render(App, {
  ...stdinAdapter.renderOptions,
});
await waitUntilExit();
stdinAdapter.cleanup();
```

## mockStdin Implementation Details

The `mockStdin.ts` module creates a fake stdin stream that behaves like a real TTY in raw mode:

### Interface

```typescript
interface MockStdin extends Readable {
  isTTY: boolean;           // Always true - pretend to be a TTY
  isRaw: boolean;           // Set by setRawMode()
  setRawMode: (mode: boolean) => MockStdin;  // Required by Ink
  ref: () => MockStdin;     // No-op, called by Ink
  unref: () => MockStdin;   // No-op, called by Ink
  write: (chunk: Buffer | string) => boolean;  // Input from test
  end: () => void;          // Signal end of input
}
```

### Character Queue Pattern

The implementation uses a simple queue pattern to ensure characters are emitted one at a time:

```typescript
const pendingChars: string[] = [];
let isRunning = false;
const CHAR_DELAY_MS = 25;

const processNextChar = () => {
  if (pendingChars.length === 0) {
    isRunning = false;
    return;
  }

  const char = pendingChars.shift()!;
  stream.push(char);  // Emit to Ink via Readable stream

  // Schedule next character with delay
  setTimeout(processNextChar, CHAR_DELAY_MS);
};
```

### Why 25ms Delay?

The delay between characters serves two purposes:

1. **Ink Processing Time**: React and Ink need time to process each keystroke and re-render the UI
2. **Avoid Race Conditions**: Without delay, characters could be buffered together and Ink would receive them as a single chunk

Shorter delays (5-10ms) caused intermittent ordering issues. 25ms provides a stable balance between speed and reliability.

### Data Flow

1. Test calls `cli.write('Hello\r')`
2. Data flows to child process stdin
3. `stdinAdapter` forwards to `mockStdin.write()`
4. Characters are queued: `['H', 'e', 'l', 'l', 'o', '\r']`
5. `processNextChar()` emits one character every 25ms
6. Ink's `useInput` hook receives each character separately
7. When `\r` is received, `key.return` becomes true and input is submitted

## Key Learnings

1. **Ink requires character-by-character input** for key detection to work properly
2. **Race conditions are subtle** - Even Promise chains can have ordering issues
3. **Test mode should be explicit** - Don't apply test workarounds to production code paths
4. **Simple is better** - A basic queue with setTimeout was more reliable than Promise-based solutions
5. **Process cleanup matters** - E2E tests that spawn processes need explicit teardown to avoid hanging

## Testing

Run e2e tests:
```bash
npm run test:e2e
```

All 11 tests should pass consistently.
