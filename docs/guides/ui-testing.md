# UI Testing Guide

This guide covers the UI testing framework for the Beans Agent CLI, including test scenarios, verification procedures, and common issues to check.

## Quick Start

```bash
# Run with default (basic) scenario
npm run dev -- --ui-test

# Run with specific scenario
npm run dev -- --ui-test --ui-test-scenario rapid-stream

# Run with initial prompt
npm run dev -- --ui-test --ui-test-scenario long-content "test message"
```

## Available Test Scenarios

| Scenario | Purpose | What to Verify |
|----------|---------|----------------|
| `basic` | Default markdown rendering | Headers, code blocks, lists render correctly |
| `long-content` | Scrolling and large output | Content scrolls, no truncation, input remains visible |
| `rapid-stream` | Fast streaming stability | No flickering, input stays visible, no frame drops |
| `tool-calls` | Tool call UI display | Tool names shown, spinners work, completion checkmarks |
| `empty-response` | Empty response handling | Graceful handling, no crashes, appropriate feedback |
| `multi-turn` | Conversation context | Context preserved across turns, history displayed |
| `slow-stream` | Input visibility during slow responses | Can type while streaming, input not hidden |
| `error` | Error handling display | Error message shown, app doesn't crash |

## Verification Procedures

### 1. Visual Rendering Verification

**Test Command:**
```bash
npm run dev -- --ui-test --ui-test-scenario basic "Hello"
```

**Checklist:**
- [ ] Headers render with proper styling (cyan, bold)
- [ ] Code blocks have syntax highlighting
- [ ] Inline `code` renders distinctly
- [ ] **Bold** and *italic* text appear correctly
- [ ] Lists (numbered and bulleted) indent properly
- [ ] Message prefixes show correctly (`>` for user, `✦` for assistant)

### 2. Flickering Detection

**Test Command:**
```bash
npm run dev -- --ui-test --ui-test-scenario rapid-stream "test"
```

**Checklist:**
- [ ] No visible screen flashing during streaming
- [ ] Input area remains stable (doesn't jump or flicker)
- [ ] Cursor blink continues smoothly
- [ ] No duplicate lines appearing temporarily
- [ ] Scroll position stays consistent

**Known Issue Indicators:**
- Entire screen refreshes on each keystroke
- Text momentarily disappears and reappears
- Layout shifts during streaming

### 3. Input Visibility Verification

**Test Command:**
```bash
npm run dev -- --ui-test --ui-test-scenario slow-stream "test"
```

**Checklist:**
- [ ] Input area visible at all times during streaming
- [ ] Can type new text while response streams
- [ ] Cursor position updates correctly
- [ ] Input border color changes to indicate loading
- [ ] "Processing..." indicator shows during response

**Test Procedure:**
1. Start with slow-stream scenario
2. Send a message
3. While response is streaming, try typing in the input
4. Verify your typing appears correctly
5. Verify you can delete characters

### 4. Output Display Verification

**Test Command:**
```bash
npm run dev -- --ui-test --ui-test-scenario long-content "test"
```

**Checklist:**
- [ ] All content visible (can scroll through)
- [ ] No content truncation
- [ ] Multiple code blocks render correctly
- [ ] Tables display properly (if supported)
- [ ] Final content matches expected output

### 5. Tool Call Display Verification

**Test Command:**
```bash
npm run dev -- --ui-test --ui-test-scenario tool-calls "run tools"
```

**Checklist:**
- [ ] Tool names display with correct colors
- [ ] Spinner shows while tools are "running"
- [ ] Checkmark (✓) appears when complete
- [ ] Tool names: `read_file`, `glob`, `shell` all visible
- [ ] Layout doesn't break with multiple tools

### 6. Multi-turn Context Verification

**Test Command:**
```bash
npm run dev -- --ui-test --ui-test-scenario multi-turn
```

**Procedure:**
1. Send first message: "Hello"
2. Verify response shows "turn 1"
3. Send second message: "How are you?"
4. Verify response shows "turn 2" and references previous messages
5. Send third message: "What did I say first?"
6. Verify context includes all previous messages

**Checklist:**
- [ ] Turn counter increments correctly
- [ ] Previous messages appear in history preview
- [ ] Context is maintained across turns
- [ ] `/history` command shows full conversation

### 7. Error Handling Verification

**Test Command:**
```bash
npm run dev -- --ui-test --ui-test-scenario error "trigger error"
```

**Checklist:**
- [ ] Error message displays clearly
- [ ] Application doesn't crash
- [ ] Can continue to send new messages
- [ ] Input area remains functional
- [ ] Error styling distinct (red/pink color)

### 8. Empty Response Verification

**Test Command:**
```bash
npm run dev -- --ui-test --ui-test-scenario empty-response "test"
```

**Checklist:**
- [ ] No crash on empty response
- [ ] Spinner shows then completes
- [ ] Can send subsequent messages
- [ ] No visual artifacts

## Common Issues and Solutions

### Issue: UI Flickering When Typing

**Symptoms:**
- Screen flashes on every keystroke
- All messages re-render on input

**Solution:**
- Ensure `<Static>` wrapper used for completed messages
- Use `React.memo()` on Message and MarkdownDisplay components
- Separate streaming messages from completed messages

**Files to Check:**
- `packages/cli/src/ui/components/ChatView.tsx`
- `packages/cli/src/ui/components/Message.tsx`

### Issue: Input Disappears During Streaming

**Symptoms:**
- Input area hidden while response streams
- Cannot type during assistant response

**Solution:**
- Ensure flexbox layout with `flexGrow=1` on ChatView
- Input area should be outside scrolling container
- Check that loading state doesn't unmount input

**Files to Check:**
- `packages/cli/src/ui/App.tsx`
- `packages/cli/src/ui/components/InputArea.tsx`

### Issue: Content Truncation

**Symptoms:**
- Long responses cut off
- Scrolling doesn't reach end of content

**Solution:**
- Check terminal height detection (`useTerminalSize` hook)
- Verify overflow handling in ChatView
- Ensure no fixed heights limiting content

**Files to Check:**
- `packages/cli/src/ui/hooks/useTerminalSize.ts`
- `packages/cli/src/ui/components/ChatView.tsx`

### Issue: Markdown Rendering Failures

**Symptoms:**
- Raw markdown symbols visible
- Code blocks not highlighted
- Lists not indented

**Solution:**
- Verify MarkdownDisplay component rendering
- Check syntax highlighter (lowlight) configuration
- Ensure proper HAST node handling

**Files to Check:**
- `packages/cli/src/ui/components/MarkdownDisplay.tsx`

### Issue: Duplicate React Keys

**Symptoms:**
- Console warnings about duplicate keys
- Components re-rendering unexpectedly

**Solution:**
- Use unique keys combining message ID and index
- Reset key counters per code block (for HAST nodes)

**Files to Check:**
- `packages/cli/src/ui/components/Message.tsx`
- `packages/cli/src/ui/components/MarkdownDisplay.tsx`

## Automated Testing Considerations

### Component Testing

Use `ink-testing-library` for component tests:

```typescript
import { render } from 'ink-testing-library';
import { Message } from '../components/Message.js';

describe('Message', () => {
  it('renders user message correctly', () => {
    const { lastFrame } = render(
      <Message message={{ id: '1', role: 'user', content: 'Hello' }} />
    );
    expect(lastFrame()).toContain('> Hello');
  });
});
```

### Snapshot Testing

For visual regression:

```typescript
it('matches markdown rendering snapshot', () => {
  const { lastFrame } = render(
    <MarkdownDisplay text="# Hello\n**Bold** text" />
  );
  expect(lastFrame()).toMatchSnapshot();
});
```

### Streaming Simulation

For async streaming tests:

```typescript
it('handles streaming updates', async () => {
  const { lastFrame, rerender } = render(
    <Message message={{ id: '1', role: 'assistant', content: '', isStreaming: true }} />
  );

  // Simulate streaming updates
  rerender(
    <Message message={{ id: '1', role: 'assistant', content: 'Hello', isStreaming: true }} />
  );

  expect(lastFrame()).toContain('Hello');
});
```

## Performance Benchmarks

When testing performance, measure:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Input latency | < 50ms | Time from keypress to display |
| Stream update | < 16ms | Frame time during streaming |
| Initial render | < 200ms | Time to first frame |
| Markdown parse | < 100ms | Time to render final markdown |

## Test Environment Setup

### Prerequisites

```bash
# Ensure dependencies installed
npm install

# Build packages
npm run build

# Run in development mode
npm run dev -- --ui-test
```

### Terminal Requirements

- True color support (for syntax highlighting)
- Unicode support (for special characters like ✦, ✓)
- Minimum 80x24 terminal size
- Interactive TTY (not piped input)

## Scenario Reference

### basic

Default scenario for general UI testing.

```
Content: Markdown with headers, code block, and lists
Stream delay: 20ms
Purpose: Verify basic markdown rendering
```

### long-content

Tests scrolling and large output handling.

```
Content: ~40 lines of mixed content
Stream delay: 5ms
Purpose: Verify scrolling works correctly
```

### rapid-stream

Tests UI stability under fast updates.

```
Content: Medium markdown content
Stream delay: 1ms (very fast)
Purpose: Detect flickering issues
```

### tool-calls

Tests tool call UI display.

```
Content: Short message + 3 tool calls
Tools: read_file, glob, shell
Purpose: Verify tool UI rendering
```

### empty-response

Tests empty response handling.

```
Content: Empty string
Purpose: Verify graceful empty handling
```

### multi-turn

Tests conversation context preservation.

```
Content: Dynamic with turn count and history
Purpose: Verify context accumulation
```

### slow-stream

Tests input visibility during slow responses.

```
Content: Medium content
Stream delay: 200ms (slow)
Purpose: Verify can type during streaming
```

### error

Tests error handling display.

```
Content: Throws error
Purpose: Verify error UI and recovery
```

## Adding New Scenarios

To add a new test scenario:

1. Edit `packages/core/src/llm/providers/mock.ts`
2. Add scenario to `UITestScenario` type
3. Add configuration to `SCENARIOS` object
4. Update this documentation

Example:

```typescript
// In mock.ts
'my-scenario': {
  content: `Your test content here`,
  streamDelay: 20,
  toolCalls: undefined, // or array of ToolCall
  shouldError: false,
},
```
