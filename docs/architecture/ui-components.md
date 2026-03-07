# UI Component Architecture

## Overview

The CLI uses Ink (React for CLI) to render an interactive terminal interface. This document describes the component hierarchy and data flow.

## Component Tree

```
[APP] packages/cli/src/ui/App.tsx
│
├── [CHAT_PROVIDER] packages/cli/src/ui/contexts/ChatContext.tsx
│   │   Provides: useChatState(), useChatActions()
│   │   Manages: messages, isLoading, error, profile, currentAgent
│   │
│   └── [TASK_PROVIDER] packages/cli/src/ui/contexts/TaskContext.tsx
│       │   Provides: useTaskState()
│       │   Manages: tasks from multi-agent task store
│       │
│       └── [APP_CONTENT] (inside App.tsx)
│           │
│           ├── [HEADER] (inline in App.tsx)
│           │   ┌─────────────────────────────────────────┐
│           │   │ 🤖 Default v1.0.0                       │
│           │   │ 📁 Workspace: /Users/bean/kakao/beans   │
│           │   │ 📋 A helpful general-purpose assistant  │
│           │   │ 📝 Memory: 1 file(s), ~130 tokens       │
│           │   └─────────────────────────────────────────┘
│           │
│           ├── [CHAT_VIEW] packages/cli/src/ui/components/ChatView.tsx
│           │   │   Props: width
│           │   │   Uses: useChatState()
│           │   │
│           │   └── [MESSAGE] * (for each message in messages[])
│           │
│           └── [INPUT_AREA] packages/cli/src/ui/components/InputArea.tsx
│                   Props: width
│                   Uses: useChatState(), useChatActions()
│                   ┌─────────────────────────────────────────┐
│                   │ > user input here_                      │
│                   └─────────────────────────────────────────┘
```

## Message Component

```
[MESSAGE] packages/cli/src/ui/components/Message.tsx
│   Props: message, width
│   Renders based on message.role: "user" | "assistant" | "system"
│
├── [USER MESSAGE]
│   ┌─────────────────────────────────────────┐
│   │ > read this project and tell me        │
│   └─────────────────────────────────────────┘
│
├── [SYSTEM MESSAGE]
│   ┌─────────────────────────────────────────┐
│   │ ℹ Switched to model: gemini-2.0-flash  │
│   └─────────────────────────────────────────┘
│
└── [ASSISTANT MESSAGE]
    │
    ├── [TOOL_CALLS] (if message.toolCalls exists)
    │   │
    │   └── [TOOL_CALL_DISPLAY] * (for each tool)
    │
    ├── [PLANNING_DISPLAY] (if message.planningContent exists)
    │
    └── [CONTENT]
        │
        └── [MARKDOWN_DISPLAY] (if not streaming)
            or
            [TEXT] (if streaming)
```

## Tool Call Display

```
[TOOL_CALL_DISPLAY] packages/cli/src/ui/components/ToolCallDisplay.tsx
│   Props: tool (ToolCallInfo)
│
├── [TOOL HEADER]
│   │   Format: {icon} {name}({argsSummary})
│   │
│   ├── [IN PROGRESS]
│   │   ⠋ glob(pattern: **/*.ts)
│   │
│   ├── [SUCCESS]
│   │   ✓ glob(pattern: **/*.ts)
│   │
│   └── [ERROR]
│       ✗ glob(pattern: **/*.ts)
│
└── [RESULT SUMMARY] (if tool.isComplete && tool.resultSummary)
        Found 5 files
```

**Example Output:**

```
✓ glob(pattern: *.md, path: ./)
  Found 3 files
✓ read_file(path: ./README.md)
  Read 232 lines
✗ shell(command: rm -rf /)
  Blocked by policy
```

## Planning Display

```
[PLANNING_DISPLAY] packages/cli/src/ui/components/PlanningDisplay.tsx
│   Props: content, isComplete
│
├── [IN PROGRESS]
│   ⠋ I'll search for the configuration files...
│
└── [COMPLETE]
    I'll search for the configuration files...
```

**Style:** Italic, muted color (gray)

## Markdown Display

```
[MARKDOWN_DISPLAY] packages/cli/src/ui/components/MarkdownDisplay.tsx
│   Props: text, width
│
├── [HEADERS]
│   # Header 1
│   ## Header 2
│
├── [CODE BLOCKS]
│   ┌──────────────────────────────────────┐
│   │ const foo = "bar";                   │
│   └──────────────────────────────────────┘
│
├── [LISTS]
│   • Item 1
│   • Item 2
│
└── [INLINE]
    **bold** *italic* `code`
```

## Diff Display

```
[DIFF_DISPLAY] packages/cli/src/ui/components/DiffDisplay.tsx
│   Props: originalContent, newContent, filePath, isNewFile
│   Used by: ToolCalls (for write_file tool with metadata)
│
├── [NEW FILE]
│   ┌─────────────────────────────────────────┐
│   │ + line 1                                │
│   │ + line 2                                │
│   └─────────────────────────────────────────┘
│
└── [MODIFIED FILE]
    ┌─────────────────────────────────────────┐
    │ - old line                              │
    │ + new line                              │
    └─────────────────────────────────────────┘
```

## Data Flow

```
[AGENT_MANAGER] packages/core/src/agents/multi-agent/agent-manager.ts
│
├── processInput(userInput)
│   │
│   └── spawn(agentType, prompt)
│       │
│       └── executor.execute(definition, { onActivity })
│           │
│           └── [EVENTS] → ChatContext.onActivity handler
│
└── [EVENTS EMITTED]
    │
    ├── agent_spawn_start
    │   → setCurrentAgent(agentType)
    │
    ├── planning_start
    │   → history.updatePlanningContent(id, "")
    │
    ├── planning_content
    │   → history.updatePlanningContent(id, content)
    │
    ├── planning_end
    │   → history.completePlanning(id)
    │
    ├── tool_call_start
    │   → toolCalls.push({ id, name, args, argsSummary })
    │   → history.updateMessageToolCalls(id, toolCalls)
    │
    ├── tool_call_end
    │   → toolCalls[i] = { ...tool, result, resultSummary, metadata }
    │   → history.updateMessageToolCalls(id, toolCalls)
    │
    ├── content_chunk
    │   → currentContent += content
    │   → history.updateMessageContent(id, currentContent)
    │
    └── agent_spawn_complete
        → history.completeMessage(id)
```

## Message Interface

```typescript
// packages/cli/src/ui/hooks/useChatHistory.ts

interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  argsSummary?: string; // "pattern: *.md, path: ./"
  result?: string;
  resultSummary?: string; // "Found 3 files"
  isComplete: boolean;
  metadata?: ToolMetadata;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming: boolean;
  toolCalls?: ToolCallInfo[];
  agentType?: string;
  planningContent?: string; // Thinking before tools
  isPlanningComplete?: boolean;
}
```

## Color Theme

```
// packages/cli/src/ui/theme/colors.ts

colors.primary    = '#87CEFA'  // Light Sky Blue - input border, tool names
colors.user       = '#DDA0DD'  // Plum - user message prefix ">"
colors.assistant  = '#98FB98'  // Pale Green - assistant prefix "✦"
colors.system     = '#F0E68C'  // Khaki - system prefix "ℹ"
colors.success    = '#98FB98'  // Pale Green - tool success "✓"
colors.warning    = '#F0E68C'  // Khaki - tool in progress
colors.error      = '#FFB6C1'  // Light Pink - tool error "✗"
colors.muted      = 'gray'     // Gray - summaries, planning text
```

## File Locations

| Component       | Path                                                 |
| --------------- | ---------------------------------------------------- |
| App             | `packages/cli/src/ui/App.tsx`                        |
| ChatView        | `packages/cli/src/ui/components/ChatView.tsx`        |
| Message         | `packages/cli/src/ui/components/Message.tsx`         |
| ToolCallDisplay | `packages/cli/src/ui/components/ToolCallDisplay.tsx` |
| PlanningDisplay | `packages/cli/src/ui/components/PlanningDisplay.tsx` |
| MarkdownDisplay | `packages/cli/src/ui/components/MarkdownDisplay.tsx` |
| DiffDisplay     | `packages/cli/src/ui/components/DiffDisplay.tsx`     |
| InputArea       | `packages/cli/src/ui/components/InputArea.tsx`       |
| ChatContext     | `packages/cli/src/ui/contexts/ChatContext.tsx`       |
| TaskContext     | `packages/cli/src/ui/contexts/TaskContext.tsx`       |
| useChatHistory  | `packages/cli/src/ui/hooks/useChatHistory.ts`        |
| colors          | `packages/cli/src/ui/theme/colors.ts`                |
