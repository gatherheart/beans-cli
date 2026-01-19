# CLI UI Architecture

This document explains how the Beans Agent CLI UI works, including component hierarchy, data flow, and rendering strategies.

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  runInteractiveChat() in app.tsx                                            │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ <ChatProvider>  (ChatContext.tsx)                                     │  │
│  │                                                                       │  │
│  │   <ChatStateContext.Provider>   (read-only state)                     │  │
│  │     • messages[], isLoading, error, profile                           │  │
│  │                                                                       │  │
│  │     <ChatActionsContext.Provider>   (action handlers)                 │  │
│  │       • sendMessage(), addSystemMessage(), clearHistory()             │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ <App>  (ui/App.tsx)                                             │  │  │
│  │  │                                                                 │  │  │
│  │  │  ┌───────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │ <Header>  - Profile name, version, description            │  │  │  │
│  │  │  └───────────────────────────────────────────────────────────┘  │  │  │
│  │  │                                                                 │  │  │
│  │  │  ┌───────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │ <ChatView>  (components/ChatView.tsx)       flexGrow=1    │  │  │  │
│  │  │  │                                                           │  │  │  │
│  │  │  │  ┌─────────────────────────────────────────────────────┐  │  │  │  │
│  │  │  │  │ <Static>  (completed messages - no re-renders)      │  │  │  │  │
│  │  │  │  │   <Message> × N                                     │  │  │  │  │
│  │  │  │  └─────────────────────────────────────────────────────┘  │  │  │  │
│  │  │  │  ┌─────────────────────────────────────────────────────┐  │  │  │  │
│  │  │  │  │ (streaming messages - re-renders on update)         │  │  │  │  │
│  │  │  │  │   <Message> (isStreaming=true)                      │  │  │  │  │
│  │  │  │  └─────────────────────────────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────────────────────────────┘  │  │  │
│  │  │                                                                 │  │  │
│  │  │  ┌───────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │ <InputArea>  (components/InputArea.tsx)                   │  │  │  │
│  │  │  └───────────────────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Message Component Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ <Message>  (components/Message.tsx)  - React.memo() for performance        │
│                                                                             │
│  User Message (role='user')                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  > Plain text (blue prefix)                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Assistant Message (role='assistant')                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ✦ Streaming: plain text + <Spinner> "Thinking..."                  │   │
│  │  ✦ Complete: <MarkdownDisplay> (green prefix)                       │   │
│  │                                                                     │   │
│  │  Tool Calls (if toolCalls[]):                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ ✓ tool_name (cyan, bold)                                    │   │   │
│  │  │   result text (dimmed, truncated 200 chars)                 │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  System Message (role='system')                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ℹ <MarkdownDisplay> (yellow prefix)                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## InputArea Structure

```
╭─────────────────────────────────────────────────────────────────────────────╮
│ Your message                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ > first line of input                                                       │
│ . second line (multi-line)                                                  │
│ . third line█  (blinking cursor)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Shift+Enter: new line | Enter: send | /help for commands                    │
╰─────────────────────────────────────────────────────────────────────────────╯
```

## MarkdownDisplay Rendering

```
<MarkdownDisplay>  (components/MarkdownDisplay.tsx)

  Input: "# Hello\n```js\nconst x = 1;\n```\n**bold** text"

  Output:
  ┌────────────────────────────────────────────┐
  │ Hello (h1: cyan, bold, marginY)            │
  │                                            │
  │ ╭─ js ─────────────────────────────────╮   │
  │ │ const x = 1;  (syntax highlighted)   │   │
  │ ╰──────────────────────────────────────╯   │
  │                                            │
  │ bold text (bold styling applied)           │
  └────────────────────────────────────────────┘

  Syntax highlighting via: highlight.js → lowlight
```

## Data Flow Diagram

```
User Input
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ InputArea.useInput()                                          │
│   handleSubmit() → processSlashCommand() or sendMessage()     │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ ChatContext.sendMessage(text)                                 │
│   1. Add user message {role: 'user', content, isStreaming: F} │
│   2. Add assistant message {content: '', isStreaming: T}      │
│   3. Set isLoading = true                                     │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ ChatSession.sendMessage() (from @beans/core)                  │
│   Activity listener receives events:                          │
│     • content_chunk → update assistant.content                │
│     • tool_call_start → add to toolCalls[]                    │
│     • tool_call_end → mark tool complete                      │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ ChatView re-renders                                           │
│   • Completed messages in <Static> (no flicker)               │
│   • Streaming message rendered normally                       │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ Message component renders content                             │
│   • Streaming: plain text + spinner                           │
│   • Complete: <MarkdownDisplay> renders markdown              │
└───────────────────────────────────────────────────────────────┘
```

## File Locations

| Component | Path |
|-----------|------|
| Entry | `packages/cli/src/index.ts` |
| App orchestration | `packages/cli/src/app.tsx` |
| Root component | `packages/cli/src/ui/App.tsx` |
| ChatContext | `packages/cli/src/ui/contexts/ChatContext.tsx` |
| useChatHistory hook | `packages/cli/src/ui/hooks/useChatHistory.ts` |
| ChatView | `packages/cli/src/ui/components/ChatView.tsx` |
| Message | `packages/cli/src/ui/components/Message.tsx` |
| MarkdownDisplay | `packages/cli/src/ui/components/MarkdownDisplay.tsx` |
| InputArea | `packages/cli/src/ui/components/InputArea.tsx` |

## Key Design Patterns

### 1. State/Actions Separation (gemini-cli pattern)
Following gemini-cli patterns, contexts are split into:
- **ChatStateContext**: Read-only state (messages, isLoading, error, profile)
- **ChatActionsContext**: Action handlers (sendMessage, addSystemMessage, clearHistory)

This prevents unnecessary re-renders:
- Components using only `useChatState()` won't re-render when actions change
- Components using only `useChatActions()` won't re-render when state changes

### 2. Custom Hook for Domain Logic
Message management is encapsulated in `useChatHistory()` hook:
```typescript
const history = useChatHistory();
history.addUserMessage(content);
history.addAssistantMessage();
history.updateMessageContent(id, content);
history.completeMessage(id);
```

### 3. Performance Optimization
- `<Static>` wrapper for completed messages prevents flickering
- `React.memo()` on Message component reduces unnecessary renders
- `useMemo()` on context values prevents object recreation
- `isStreaming` flag separates complete/incomplete messages

### 4. Lazy Initialization
- ChatSession created on first message (not on mount)
- Stored in `useRef` to persist across renders

### 5. Streaming UX
- Real-time content updates without waiting for completion
- Tool call progress shown with spinners and checkmarks
- Markdown rendering deferred until stream completes

### 6. Markdown Rendering
- Line-by-line parsing with regex patterns
- Special handling for code blocks (accumulated before rendering)
- Syntax highlighting via highlight.js/lowlight

### 7. Input Handling
- `useInput` hook from Ink for low-level keyboard control
- Multi-line support with visual feedback
- Slash command routing via string prefix matching

## Keyboard Shortcuts (InputArea)

| Key | Action |
|-----|--------|
| Enter | Submit input |
| Shift+Enter | Insert newline |
| Ctrl+J | Insert newline (vi-like) |
| Backslash + Enter | Remove backslash, insert newline |
| Ctrl+C | Exit app |

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Display help text |
| `/clear` | Clear chat history |
| `/profile` | Show agent profile info |
| `/exit`, `/quit`, `/q` | Exit application |
