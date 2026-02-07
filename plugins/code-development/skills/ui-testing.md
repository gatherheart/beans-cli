---
name: ui-testing
triggers:
  - ui test
  - test ui
  - ui-test
  - flickering
  - input visibility
  - test scenario
  - mock llm
---

# UI Testing

## Use When

User requests help with:
- Testing the CLI user interface
- Checking for UI flickering issues
- Verifying input visibility during streaming
- Running mock LLM scenarios
- Debugging UI display problems

## Quick Start

```bash
# Run with default scenario
npm run dev -- --ui-test

# Run specific scenario
npm run dev -- --ui-test --ui-test-scenario <scenario>
```

## Available Scenarios

| Scenario | Command | Purpose |
|----------|---------|---------|
| `basic` | `--ui-test` | Default markdown rendering |
| `rapid-stream` | `--ui-test-scenario rapid-stream` | Detect flickering (1ms delay) |
| `slow-stream` | `--ui-test-scenario slow-stream` | Test input visibility (200ms delay) |
| `long-content` | `--ui-test-scenario long-content` | Test scrolling and large output |
| `tool-calls` | `--ui-test-scenario tool-calls` | Test tool call UI display |
| `multi-turn` | `--ui-test-scenario multi-turn` | Test conversation context |
| `empty-response` | `--ui-test-scenario empty-response` | Test empty response handling |
| `error` | `--ui-test-scenario error` | Test error display |

## Verification Checklist

### Flickering Test
```bash
npm run dev -- --ui-test --ui-test-scenario rapid-stream "test"
```
- [ ] No screen flashing during streaming
- [ ] Input area remains stable
- [ ] Cursor blink continues smoothly
- [ ] No layout shifts

### Input Visibility Test
```bash
npm run dev -- --ui-test --ui-test-scenario slow-stream "test"
```
- [ ] Input area visible during streaming
- [ ] Can type while response streams
- [ ] Cursor position updates correctly
- [ ] "Processing..." indicator shows

### Output Display Test
```bash
npm run dev -- --ui-test --ui-test-scenario long-content "test"
```
- [ ] All content visible (can scroll)
- [ ] No content truncation
- [ ] Code blocks render correctly
- [ ] Markdown formatting works

### Tool Call Test
```bash
npm run dev -- --ui-test --ui-test-scenario tool-calls "test"
```
- [ ] Tool names display with colors
- [ ] Spinner shows while running
- [ ] Checkmark appears on completion

## Common Issues

### Screen Flickering
**Symptom**: Entire screen flashes on updates
**Solution**: Ensure `<Static>` wrapper on completed messages, use `React.memo()`
**Files**: `ChatView.tsx`, `Message.tsx`

### Input Disappears
**Symptom**: Cannot type during streaming
**Solution**: Check flexbox layout, input outside scroll container
**Files**: `App.tsx`, `InputArea.tsx`

### Content Truncated
**Symptom**: Long responses cut off
**Solution**: Verify terminal height detection, overflow handling
**Files**: `useTerminalSize.ts`, `ChatView.tsx`

## Adding New Scenarios

Edit `packages/core/src/llm/providers/mock.ts`:

```typescript
'my-scenario': {
  content: `Your test content`,
  streamDelay: 20,  // ms between words
  toolCalls: undefined,  // or ToolCall[]
  shouldError: false,
},
```

## Full Documentation

See `docs/guides/ui-testing.md` for complete verification procedures.
