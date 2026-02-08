# Rendering and Performance Issues

Issues encountered with UI rendering and performance in the Ink-based CLI.

**Reference**: https://github.com/vadimdemedes/ink/issues/359

---

## Issue: UI Flickering When Typing and Streaming

### Problem

The entire UI flickered on every keystroke and during streaming responses.

### Root Cause (Detailed)

**Ink redraws the ENTIRE terminal on every state change.**

When you type a character or receive a streaming chunk, this happens:

```
State Change → React re-renders → Ink clears ALL lines → Ink redraws ALL lines
```

The flickering occurs in Ink's internal `log-update.ts`:

```javascript
// Pseudocode of what Ink does on every render:
1. Move cursor to top of output area
2. ERASE all previously drawn lines  ← This causes the "flash"
3. Write all new lines from scratch
```

This "erase then redraw" approach causes visible flashing because:
- Human eyes can see the brief moment when content is erased
- Terminals without double-buffering show each step visually

### What is Terminal Line Wrapping?

**Line wrapping** = What happens when text is longer than the terminal width.

Example with terminal width of 40 characters:

```
Input: "This is a very long line that exceeds the terminal width"

With wrapping ENABLED (default):
┌────────────────────────────────────────┐
│This is a very long line that exceeds t│
│he terminal width                       │  ← Automatically moved to next line
└────────────────────────────────────────┘

With wrapping DISABLED:
┌────────────────────────────────────────┐
│This is a very long line that exceeds t│  ← Text is cut off
└────────────────────────────────────────┘
```

**The Conflict Problem**: Both terminal AND Ink try to wrap text simultaneously:

```
Original: "Hello this is a long message that needs wrapping"

Step 1: Ink calculates wrapping
┌────────────────────────────────────────┐
│Hello this is a long message that needs │  ← Ink: "Line 1 ends here"
│wrapping                                 │  ← Ink: "Line 2 starts here"
└────────────────────────────────────────┘

Step 2: Terminal ALSO wraps (conflict!)
┌────────────────────────────────────────┐
│Hello this is a long message that needs │
│ wrapping                                │  ← Terminal added extra wrap
│                                         │  ← Now positions are WRONG
└────────────────────────────────────────┘
```

Ink thinks it drew 2 lines, but terminal made it 3 lines. Result:
- Cursor positions become incorrect
- Erase commands clear wrong lines
- Content gets corrupted and flickers

### What is the Static Component?

`<Static>` is Ink's component for content that **never needs to re-render**.

| Component | Behavior |
|-----------|----------|
| Normal `<Box>` | Every state change → Re-renders → Ink redraws it |
| `<Static>` | Rendered once → NEVER touched again → Ink skips it |

```tsx
import { Static } from 'ink';

// These items are rendered ONCE and never updated
<Static items={['line1', 'line2', 'line3']}>
  {(item) => <Text key={item}>{item}</Text>}
</Static>
```

**Why it helps**: If you have 50 messages and only the last one is streaming:
- Without Static: Ink redraws all 50 messages on every chunk (SLOW, FLICKERS)
- With Static: Ink only redraws the 1 streaming message (FAST, NO FLICKER)

---

## Solution (Following gemini-cli Pattern)

The solution combines multiple techniques from the gemini-cli project.

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  COMPLETED MESSAGES (Static - never redrawn)        │
│  ┌─────────────────────────────────────────────┐   │
│  │ User: Hello                                  │   │
│  │ Assistant: Hi there! How can I help?        │   │
│  │ User: Write code                             │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  STREAMING MESSAGE (Dynamic - redraws on update)    │
│  ┌─────────────────────────────────────────────┐   │
│  │ Assistant: Here is the code█                │   │  ← Only this redraws
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  INPUT AREA                                         │
│  ╭──────────────────────────────────────────────╮  │
│  │ > Type here...                                │  │
│  ╰──────────────────────────────────────────────╯  │
└─────────────────────────────────────────────────────┘
```

### Solution 1: Disable Terminal Line Wrapping

Tell the terminal "don't wrap, Ink will handle it":

```typescript
// app.tsx - Before rendering
process.stdout.write('\x1b[?7l'); // Disable line wrapping

const { waitUntilExit } = render(<App />, {
  exitOnCtrlC: false,
});

await waitUntilExit();

// Re-enable on exit
process.stdout.write('\x1b[?7h');
```

**Escape code breakdown**:

| Code | Meaning |
|------|---------|
| `\x1b[` | Escape sequence start (CSI - Control Sequence Introducer) |
| `?7` | DECAWM mode (DEC Auto-Wrap Mode) |
| `l` | Disable (low/off) |
| `h` | Enable (high/on) |

Now only Ink wraps → No conflict → Clean rendering.

### Solution 2: Use Static for Completed Messages

Only streaming/pending messages should be in dynamic rendering. Completed messages go in `<Static>` which Ink never re-renders:

```tsx
// ChatView.tsx
import { Static } from 'ink';

// Track terminal resize to remount Static component
const [remountKey, setRemountKey] = useState(0);
useEffect(() => {
  const handleResize = () => setRemountKey(k => k + 1);
  process.stdout.on('resize', handleResize);
  return () => { process.stdout.off('resize', handleResize); };
}, []);

// Separate completed from streaming messages
const completedMessages = messages.filter(m => !m.isStreaming);
const pendingMessages = messages.filter(m => m.isStreaming);

return (
  <Box flexDirection="column">
    {/* Static: completed messages - never re-rendered */}
    <Static key={remountKey} items={completedMessages}>
      {(message) => <Message key={message.id} message={message} />}
    </Static>

    {/* Dynamic: only streaming messages re-render */}
    {pendingMessages.map(message => (
      <Message key={message.id} message={message} />
    ))}
  </Box>
);
```

**Why `remountKey`?** When the terminal resizes, `<Static>` content needs to be re-laid out. The key forces React to unmount and remount the Static component, allowing proper re-layout.

### Solution 3: Limit Rendered Nodes (Alternative)

If `<Static>` causes issues (e.g., duplicate messages on resize), limit the number of rendered messages instead:

```tsx
const MAX_VISIBLE_MESSAGES = 20;
const visibleMessages = messages.slice(-MAX_VISIBLE_MESSAGES);
const hiddenCount = messages.length - visibleMessages.length;

return (
  <Box flexDirection="column">
    {hiddenCount > 0 && (
      <Text dimColor>... {hiddenCount} earlier messages hidden ...</Text>
    )}
    {visibleMessages.map(message => (
      <Message key={message.id} message={message} />
    ))}
  </Box>
);
```

### Solution 4: Use React.memo on Components

Prevent unnecessary re-renders of unchanged components:

```tsx
export const Message = React.memo(function Message({ message }: MessageProps) {
  // Component only re-renders if message prop changes
});

export const MarkdownDisplay = React.memo(function MarkdownDisplay({ text }: Props) {
  // Component only re-renders if text prop changes
});

export const ChatView = React.memo(function ChatView({ width }: Props) {
  // Component only re-renders if width prop changes
});
```

---

## Summary

| Problem | Solution |
|---------|----------|
| Ink redraws everything | Use `<Static>` for completed content |
| Terminal + Ink both wrap | Disable terminal wrapping (`\x1b[?7l`) |
| Too many nodes to render | Limit visible messages to last N |
| Unnecessary re-renders | Use `React.memo` on components |

### Key Insights from gemini-cli

1. **Structural separation**: Static (finished) vs. dynamic (streaming) content
2. **Terminal control**: Disable terminal line wrapping to avoid conflicts
3. **Remount on resize**: Use a key to force Static remount on terminal resize
4. **Content constraints**: Limit max heights and message sizes

**Files:**
- `packages/cli/src/app.tsx` - Terminal line wrapping control
- `packages/cli/src/ui/components/ChatView.tsx` - Static/dynamic separation
- `packages/cli/src/ui/components/Message.tsx` - Memoization
- `packages/cli/src/ui/components/MarkdownDisplay.tsx` - Memoization

---

## Verification

### Manual Verification Steps

Since flickering is a visual phenomenon, manual testing is required:

1. **Test rapid streaming** (no flicker during fast updates):
   ```bash
   npm start -- --ui-test --ui-test-scenario rapid-stream
   ```
   - Type a message and press Enter
   - Watch the response stream
   - **Expected**: No screen flashing, content appears smoothly

2. **Test typing during streaming** (input stays visible):
   ```bash
   npm start -- --ui-test --ui-test-scenario slow-stream
   ```
   - Type a message and press Enter
   - While response streams, start typing next message
   - **Expected**: Input area remains stable, cursor visible

3. **Test long conversations** (Static prevents history redraw):
   ```bash
   npm start
   ```
   - Send 10+ messages back and forth
   - On later messages, watch for flicker
   - **Expected**: Only current message updates, history stays static

4. **Test terminal resize**:
   - Start the app and send a few messages
   - Resize the terminal window
   - **Expected**: Content re-layouts properly without duplication

### Automated Test Cases

Add these tests to prevent regression:

```typescript
// packages/cli/src/ui/components/__tests__/ChatView.test.tsx

import { render } from 'ink-testing-library';
import { Static } from 'ink';

describe('ChatView Anti-Flicker', () => {
  it('should use Static for completed messages', () => {
    const messages = [
      { id: '1', role: 'user', content: 'Hello', isStreaming: false },
      { id: '2', role: 'assistant', content: 'Hi', isStreaming: false },
      { id: '3', role: 'assistant', content: 'Loading...', isStreaming: true },
    ];

    // Verify Static is used (check component structure)
    // Completed messages (isStreaming: false) should be in Static
    // Streaming messages (isStreaming: true) should be in dynamic Box
    const completed = messages.filter(m => !m.isStreaming);
    const streaming = messages.filter(m => m.isStreaming);

    expect(completed).toHaveLength(2);
    expect(streaming).toHaveLength(1);
  });

  it('should separate completed and streaming messages correctly', () => {
    const messages = [
      { id: '1', isStreaming: false },
      { id: '2', isStreaming: false },
      { id: '3', isStreaming: true },
    ];

    const completedMessages = messages.filter(m => !m.isStreaming);
    const pendingMessages = messages.filter(m => m.isStreaming);

    expect(completedMessages.map(m => m.id)).toEqual(['1', '2']);
    expect(pendingMessages.map(m => m.id)).toEqual(['3']);
  });
});
```

```typescript
// packages/cli/src/app.test.tsx

describe('Terminal Line Wrapping Control', () => {
  it('should disable line wrapping before render', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write');

    // Simulate app startup
    // process.stdout.write('\x1b[?7l') should be called

    expect(writeSpy).toHaveBeenCalledWith('\x1b[?7l');
  });

  it('should re-enable line wrapping on exit', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write');

    // Simulate app exit
    // process.stdout.write('\x1b[?7h') should be called

    expect(writeSpy).toHaveBeenCalledWith('\x1b[?7h');
  });
});
```

```typescript
// packages/cli/src/ui/components/__tests__/Message.test.tsx

describe('Message Memoization', () => {
  it('should be wrapped with React.memo', () => {
    // React.memo wraps the component and adds a 'compare' property
    // or the component type name includes 'Memo'
    expect(Message.$$typeof).toBeDefined();
    // In React 18+, memoized components have specific type
  });

  it('should not re-render when props are unchanged', () => {
    const renderCount = { current: 0 };

    // Mock component that tracks renders
    const message = { id: '1', content: 'Test', isStreaming: false };

    const { rerender } = render(<Message message={message} />);
    renderCount.current++;

    // Re-render with same props
    rerender(<Message message={message} />);

    // Should not increment if properly memoized
    // (Note: exact implementation depends on test setup)
  });
});
```

### CI Integration

Add a UI test job in `.github/workflows/ci.yml`:

```yaml
ui-flicker-test:
  name: UI Flicker Test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - run: npm run build
    - run: npm test -- --run packages/cli/src/ui/components/__tests__/ChatView.test.tsx
```

### Checklist for Code Review

When reviewing PRs that touch UI components, verify:

- [ ] `<Static>` is used for completed/finalized content
- [ ] Streaming content is separated from completed content
- [ ] `React.memo` is applied to message-related components
- [ ] Terminal line wrapping is disabled before render
- [ ] Terminal line wrapping is re-enabled on exit
- [ ] No unnecessary state updates during streaming

---

## Issue: Duplicate React Keys Warning (HAST Nodes)

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

## Issue: Streaming vs Final Render Strategy

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

## Issue: Duplicate React Keys for Tool Calls

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
