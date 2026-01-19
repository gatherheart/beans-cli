# Rendering and Performance Issues

Issues encountered with UI rendering and performance in the Ink-based CLI.

---

## Issue: UI Flickering When Typing

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
