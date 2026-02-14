# Multi-Agent System Architecture

## Overview

The multi-agent system provides orchestration capabilities for complex tasks by routing user input to specialized agents. It follows Claude Code's architecture pattern with UserInputAgent for analysis, AgentManager for orchestration, and specialized agents for execution.

## System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLI Application                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │TaskProvider │  │ChatProvider │  │  ChatView   │  │  InputArea  │    │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘  └─────────────┘    │
│         │                │                                               │
└─────────┼────────────────┼───────────────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           @beans/core                                    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        AgentManager                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │   │
│  │  │ UserInputAgent  │  │  Task Store     │  │ Agent Registry  │  │   │
│  │  │ (analyzeInput)  │  │ (coordination)  │  │ (definitions)   │  │   │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │   │
│  │           │                    │                    │            │   │
│  │           ▼                    ▼                    ▼            │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │                    AgentExecutor                            │ │   │
│  │  │  (runs agent loop with LLM + tools)                         │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ │
│  │   LLM Client   │  │  Tool Registry │  │   Specialized Agents       │ │
│  │ (Google/Ollama)│  │  (built-in +   │  │ ┌──────┐┌───────┐┌──────┐ │ │
│  │                │  │   task tools)  │  │ │ Bash ││Explore││ Plan │ │ │
│  │                │  │                │  │ └──────┘└───────┘└──────┘ │ │
│  └────────────────┘  └────────────────┘  │ ┌─────────────────────┐   │ │
│                                          │ │      General        │   │ │
│                                          │ └─────────────────────┘   │ │
│                                          └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Input Flow Architecture

### High-Level Flow

```
User Input
    │
    ▼
┌─────────────────────────────────────────┐
│           AgentManager.processInput()    │
│                                          │
│  1. Emit: input_analysis_start           │
│  2. Call UserInputAgent.analyzeUserInput │
│  3. Emit: input_analysis_complete        │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │         InputAnalysis Result        │ │
│  │  - intent: UserIntent               │ │
│  │  - requiresPlanning: boolean        │ │
│  │  - suggestedAgent: string           │ │
│  │  - tasks: TaskSuggestion[]          │ │
│  └─────────────────────────────────────┘ │
└────────────────┬────────────────────────┘
                 │
     ┌───────────┴───────────┐
     │                       │
     ▼                       ▼
┌─────────────┐      ┌─────────────────────┐
│   Simple    │      │   Complex Request   │
│   Request   │      │ (requiresPlanning)  │
└──────┬──────┘      └──────────┬──────────┘
       │                        │
       ▼                        ▼
┌─────────────┐      ┌─────────────────────┐
│   spawn()   │      │  executeTaskPlan()  │
│ single agent│      │  multiple agents    │
└──────┬──────┘      └──────────┬──────────┘
       │                        │
       └────────────┬───────────┘
                    │
                    ▼
           ┌───────────────┐
           │ AgentResult   │
           └───────────────┘
```

### Intent Classification

The UserInputAgent classifies user input into one of seven intent categories:

| Intent | Description | Default Agent |
|--------|-------------|---------------|
| `simple_question` | Quick Q&A without tools | general |
| `code_exploration` | Finding/understanding code | explore |
| `code_modification` | Creating or changing code | general |
| `bash_execution` | Shell commands, git, builds | bash |
| `planning` | Architecture/design decisions | plan |
| `multi_step_task` | Complex work needing multiple agents | orchestrator |
| `unknown` | Cannot classify | general |

### Agent Selection Logic

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Selection                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Input matches pattern?                                      │
│  ├─ "run/execute/git/npm..." → bash-agent                   │
│  ├─ "find/search/where..." → explore-agent                  │
│  ├─ "plan/design/architect..." → plan-agent                 │
│  ├─ "create/implement/fix..." → general-agent               │
│  └─ Complex multi-step → Create tasks, execute in order     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Message Flow Sequence

### Sequence 1: Simple Request (Single Agent)

```
User                 AgentManager         UserInputAgent       AgentExecutor        LLMClient
 │                        │                     │                    │                  │
 │  "Find all .ts files"  │                     │                    │                  │
 │───────────────────────>│                     │                    │                  │
 │                        │                     │                    │                  │
 │                        │ analyzeUserInput()  │                    │                  │
 │                        │────────────────────>│                    │                  │
 │                        │                     │                    │                  │
 │                        │                     │──── LLM call ─────>│                  │
 │                        │                     │                    │  chat(analysis)  │
 │                        │                     │                    │─────────────────>│
 │                        │                     │                    │<─────────────────│
 │                        │                     │<───────────────────│                  │
 │                        │                     │                    │                  │
 │                        │ InputAnalysis       │                    │                  │
 │                        │ {intent: "code_exploration",             │                  │
 │                        │  suggestedAgent: "explore"}              │                  │
 │                        │<────────────────────│                    │                  │
 │                        │                     │                    │                  │
 │                        │ spawn("explore", prompt)                 │                  │
 │                        │─────────────────────────────────────────>│                  │
 │                        │                     │                    │                  │
 │                        │                     │   ┌──────────────────────────────┐   │
 │                        │                     │   │      Agent Loop              │   │
 │                        │                     │   │  1. LLM call                 │   │
 │                        │                     │   │  2. Execute tools (glob)     │   │
 │                        │                     │   │  3. LLM call with results    │   │
 │                        │                     │   │  4. Return final answer      │   │
 │                        │                     │   └──────────────────────────────┘   │
 │                        │                     │                    │                  │
 │                        │ AgentExecutionResult│                    │                  │
 │                        │<─────────────────────────────────────────│                  │
 │                        │                     │                    │                  │
 │  Result: "Found 42 .ts files..."             │                    │                  │
 │<───────────────────────│                     │                    │                  │
 │                        │                     │                    │                  │
```

### Sequence 2: Complex Request (Multi-Agent with Tasks)

```
User                 AgentManager         TaskStore          AgentExecutor
 │                        │                   │                    │
 │ "Refactor auth module" │                   │                    │
 │───────────────────────>│                   │                    │
 │                        │                   │                    │
 │                        │ analyzeUserInput()│                    │
 │                        │ Returns:          │                    │
 │                        │ {requiresPlanning: true,               │
 │                        │  tasks: [                              │
 │                        │    {subject: "Explore current auth",   │
 │                        │     suggestedAgent: "explore"},        │
 │                        │    {subject: "Plan refactoring",       │
 │                        │     suggestedAgent: "plan",            │
 │                        │     dependencies: ["0"]},              │
 │                        │    {subject: "Implement changes",      │
 │                        │     suggestedAgent: "general",         │
 │                        │     dependencies: ["1"]}               │
 │                        │  ]}                                    │
 │                        │                   │                    │
 │                        │ ══════════════════════════════════════════════════
 │                        │ Phase 1: Create Tasks                  │
 │                        │ ══════════════════════════════════════════════════
 │                        │                   │                    │
 │                        │ createTask()      │                    │
 │                        │──────────────────>│                    │
 │                        │   Task #1 created │                    │
 │                        │<──────────────────│                    │
 │                        │                   │                    │
 │                        │ createTask()      │                    │
 │                        │──────────────────>│                    │
 │                        │   Task #2 created │                    │
 │                        │<──────────────────│                    │
 │                        │                   │                    │
 │                        │ createTask()      │                    │
 │                        │──────────────────>│                    │
 │                        │   Task #3 created │                    │
 │                        │<──────────────────│                    │
 │                        │                   │                    │
 │                        │ updateTask(#2, blockedBy: [#1])        │
 │                        │──────────────────>│                    │
 │                        │ updateTask(#3, blockedBy: [#2])        │
 │                        │──────────────────>│                    │
 │                        │                   │                    │
 │                        │ ══════════════════════════════════════════════════
 │                        │ Phase 2: Execute Tasks (respecting dependencies)
 │                        │ ══════════════════════════════════════════════════
 │                        │                   │                    │
 │                        │ getUnblockedTasks()                    │
 │                        │──────────────────>│                    │
 │                        │   [Task #1]       │                    │
 │                        │<──────────────────│                    │
 │                        │                   │                    │
 │                        │ spawn("explore", Task #1)              │
 │                        │─────────────────────────────────────-->│
 │                        │   Result: auth module analysis         │
 │                        │<───────────────────────────────────────│
 │                        │                   │                    │
 │                        │ updateTask(#1, status: completed)      │
 │                        │──────────────────>│                    │
 │                        │                   │                    │
 │                        │ getUnblockedTasks()                    │
 │                        │──────────────────>│                    │
 │                        │   [Task #2]       │   (now unblocked)  │
 │                        │<──────────────────│                    │
 │                        │                   │                    │
 │                        │ spawn("plan", Task #2)                 │
 │                        │─────────────────────────────────────-->│
 │                        │   Result: refactoring plan             │
 │                        │<───────────────────────────────────────│
 │                        │                   │                    │
 │                        │ updateTask(#2, status: completed)      │
 │                        │──────────────────>│                    │
 │                        │                   │                    │
 │                        │ getUnblockedTasks()                    │
 │                        │──────────────────>│                    │
 │                        │   [Task #3]       │   (now unblocked)  │
 │                        │<──────────────────│                    │
 │                        │                   │                    │
 │                        │ spawn("general", Task #3)              │
 │                        │─────────────────────────────────────-->│
 │                        │   Result: implementation complete      │
 │                        │<───────────────────────────────────────│
 │                        │                   │                    │
 │                        │ updateTask(#3, status: completed)      │
 │                        │──────────────────>│                    │
 │                        │                   │                    │
 │                        │ ══════════════════════════════════════════════════
 │                        │ Phase 3: Aggregate Results             │
 │                        │ ══════════════════════════════════════════════════
 │                        │                   │                    │
 │  Aggregated Result:    │                   │                    │
 │  ## explore Result     │                   │                    │
 │  ## plan Result        │                   │                    │
 │  ## general Result     │                   │                    │
 │<───────────────────────│                   │                    │
 │                        │                   │                    │
```

### Sequence 3: Agent Execution Loop (Inside spawn())

```
AgentExecutor            LLMClient           ToolRegistry          Tool
     │                       │                    │                  │
     │ ════════════════════════════════════════════════════════════════
     │ Turn 1                                                         │
     │ ════════════════════════════════════════════════════════════════
     │                       │                    │                  │
     │ chat(messages, tools) │                    │                  │
     │──────────────────────>│                    │                  │
     │                       │                    │                  │
     │ Response:             │                    │                  │
     │ {content: "Let me search...",              │                  │
     │  toolCalls: [{name: "glob", args: {...}}]} │                  │
     │<──────────────────────│                    │                  │
     │                       │                    │                  │
     │ getTool("glob")       │                    │                  │
     │───────────────────────────────────────────>│                  │
     │ GlobTool              │                    │                  │
     │<───────────────────────────────────────────│                  │
     │                       │                    │                  │
     │ execute(args)         │                    │                  │
     │────────────────────────────────────────────────────────────-->│
     │ {content: "file1.ts\nfile2.ts\n..."}       │                  │
     │<──────────────────────────────────────────────────────────────│
     │                       │                    │                  │
     │ Add tool result to messages                │                  │
     │                       │                    │                  │
     │ ════════════════════════════════════════════════════════════════
     │ Turn 2                                                         │
     │ ════════════════════════════════════════════════════════════════
     │                       │                    │                  │
     │ chat(messages + tool results)              │                  │
     │──────────────────────>│                    │                  │
     │                       │                    │                  │
     │ Response:             │                    │                  │
     │ {content: "Found 5 TypeScript files...",   │                  │
     │  toolCalls: null}     │  (no more tools)   │                  │
     │<──────────────────────│                    │                  │
     │                       │                    │                  │
     │ ════════════════════════════════════════════════════════════════
     │ Loop terminates (no tool calls)                                │
     │ ════════════════════════════════════════════════════════════════
     │                       │                    │                  │
     │ Return AgentResult    │                    │                  │
     │ {success: true,       │                    │                  │
     │  rawContent: "Found 5 TypeScript files...",│                  │
     │  terminateReason: "complete",              │                  │
     │  turnCount: 2}        │                    │                  │
     │                       │                    │                  │
```

## Event System

### MultiAgentEvent Types

Events are emitted throughout the execution for UI updates and observability:

```typescript
type MultiAgentEvent =
  // Analysis Phase
  | { type: 'input_analysis_start'; input: string }
  | { type: 'input_analysis_complete'; analysis: InputAnalysis }

  // Task Management
  | { type: 'task_created'; task: Task }
  | { type: 'task_updated'; task: Task }

  // Agent Execution
  | { type: 'agent_spawn_start'; agentType: string; taskId?: string }
  | { type: 'agent_spawn_complete'; result: AgentExecutionResult }

  // Turn-Level Events
  | { type: 'turn_start'; turnNumber: number; agentType: string }
  | { type: 'turn_end'; turnNumber: number; agentType: string }

  // Content Streaming
  | { type: 'content_chunk'; content: string; agentType: string }

  // Tool Execution
  | { type: 'tool_call_start'; toolName: string; agentType: string }
  | { type: 'tool_call_end'; toolName: string; result: string; agentType: string }

  // Errors
  | { type: 'error'; error: Error; agentType?: string };
```

### Event Flow Timeline

```
Time ──────────────────────────────────────────────────────────────────────────>

User Input
    │
    ├─ input_analysis_start ─────┐
    │                            │ LLM analyzes input
    ├─ input_analysis_complete ──┘
    │
    ├─ task_created (Task #1)
    ├─ task_created (Task #2)
    ├─ task_updated (Task #2 blockedBy: [#1])
    │
    ├─ agent_spawn_start (explore, Task #1) ─────┐
    │   ├─ turn_start (1, explore)               │
    │   ├─ content_chunk ("Searching...")        │ Agent Loop
    │   ├─ tool_call_start (glob)                │
    │   ├─ tool_call_end (glob, results)         │
    │   ├─ turn_end (1, explore)                 │
    │   ├─ turn_start (2, explore)               │
    │   ├─ content_chunk ("Found files...")      │
    │   ├─ turn_end (2, explore)                 │
    ├─ agent_spawn_complete (explore) ───────────┘
    │
    ├─ task_updated (Task #1 completed)
    │
    ├─ agent_spawn_start (plan, Task #2) ────────┐
    │   ├─ turn_start (1, plan)                  │ Agent Loop
    │   ├─ ...                                   │
    ├─ agent_spawn_complete (plan) ──────────────┘
    │
    └─ Final Result
```

## Task Store Architecture

### State Management

```
┌─────────────────────────────────────────────────────────────┐
│                       Task Store                             │
│  (Module-level singleton)                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  tasks: Map<string, Task>                           │    │
│  │                                                     │    │
│  │  Task {                                             │    │
│  │    id: string                                       │    │
│  │    subject: string                                  │    │
│  │    description: string                              │    │
│  │    status: 'pending' | 'in_progress' | 'completed'  │    │
│  │    owner?: string                                   │    │
│  │    blocks: string[]                                 │    │
│  │    blockedBy: string[]                              │    │
│  │    metadata?: Record<string, unknown>               │    │
│  │  }                                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  listeners: Set<TaskStoreListener>                  │    │
│  │                                                     │    │
│  │  - Notified on every state change                   │    │
│  │  - Used by TaskContext for React updates            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Operations                                                  │
│                                                              │
│  createTask(options) ──────> Task                           │
│  updateTask(options) ──────> Task | null                    │
│  getTask(id) ──────────────> Task | undefined               │
│  getAllTasks() ────────────> Task[]                         │
│  getUnblockedTasks() ──────> Task[] (pending, no blockers)  │
│  subscribe(listener) ──────> unsubscribe()                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Resolution

```
Task Dependencies Example:

   Task #1 (Explore)
        │
        │ blocks
        ▼
   Task #2 (Plan)      ←── blockedBy: [#1]
        │
        │ blocks
        ▼
   Task #3 (Implement) ←── blockedBy: [#2]


Execution Order:
1. getUnblockedTasks() → [Task #1]  (only #1 has no blockers)
2. Execute Task #1, mark completed
3. getUnblockedTasks() → [Task #2]  (#2 now unblocked)
4. Execute Task #2, mark completed
5. getUnblockedTasks() → [Task #3]  (#3 now unblocked)
6. Execute Task #3, mark completed
7. getUnblockedTasks() → []         (all done)
```

## Specialized Agent Configurations

| Agent | Tools | Max Turns | Use Case |
|-------|-------|-----------|----------|
| bash | `shell` | 10 | Command execution, git, builds |
| explore | `glob`, `grep`, `read_file` | 15 | Code search, structure analysis |
| plan | `glob`, `grep`, `read_file` | 20 | Architecture, implementation design |
| general | All tools | 50 | Complex multi-tool tasks |

## File Structure

```
packages/core/src/agents/multi-agent/
├── index.ts                    # Module exports
├── types.ts                    # Type definitions
├── task-store.ts               # Task state management
├── user-input-agent.ts         # Input analysis
├── agent-manager.ts            # Main orchestrator
└── specialized/
    ├── index.ts                # Agent registry
    ├── bash-agent.ts           # Shell commands
    ├── explore-agent.ts        # Code exploration
    ├── plan-agent.ts           # Implementation planning
    └── general-agent.ts        # General purpose

packages/core/src/tools/builtin/
└── task-tools.ts               # TaskCreate, TaskUpdate, TaskList, TaskGet

packages/cli/src/ui/contexts/
└── TaskContext.tsx             # React context for task UI
```

## Integration Points

### CLI Integration

The CLI's `ChatContext.tsx` uses AgentManager for all message processing:

```typescript
// ChatContext.tsx
import { Config, createAgentManager, clearTasks } from '@beans/core';
import type { AgentManager, MultiAgentEvent } from '@beans/core';

// Create agent manager from Config
const agentManager = createAgentManager(config, {
  cwd: process.cwd(),
});

// Process user input through multi-agent system
const result = await agentManager.processInput(userInput, {
  onActivity: (event: MultiAgentEvent) => {
    switch (event.type) {
      case 'input_analysis_complete':
        // Show which agent is handling the request
        setCurrentAgent(event.analysis.suggestedAgent);
        break;

      case 'content_chunk':
        // Stream content to UI
        currentContent += event.content;
        updateUI(currentContent);
        break;

      case 'tool_call_start':
        // Show tool being used
        addToolCall(event.toolName);
        break;

      case 'tool_call_end':
        // Mark tool as complete
        completeToolCall(event.toolName, event.result);
        break;

      case 'agent_spawn_complete':
        // Final result from agent
        setFinalContent(event.result.content);
        break;

      case 'error':
        setError(event.error.message);
        break;
    }
  },
});
```

### State Management

The `ChatStateValue` now includes `currentAgent` to show which agent is processing:

```typescript
interface ChatStateValue {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  profile: AgentProfile | null;
  currentAgent: string | null;  // 'bash', 'explore', 'plan', 'general', etc.
}
```

### React Integration

```tsx
// TaskProvider wraps the app
<TaskProvider>
  <ChatProvider>
    <App />
  </ChatProvider>
</TaskProvider>

// Components use hooks
function TaskList() {
  const { tasks, pendingCount } = useTaskState();
  const { updateTask } = useTaskActions();
  // ...
}
```

## Debug Mode

When running with `--debug`, the multi-agent system logs detailed conversations between agents to `~/.beans/logs/multi-agent.log`.

### Enabling Debug Mode

```bash
# Run with debug mode
npm run dev -- --debug

# The log file will be created at:
# ~/.beans/logs/multi-agent.log
```

### Debug Log Contents

The debug log includes:

1. **Input Analysis**
   - User input text
   - Classified intent
   - Task breakdown (if complex)

2. **Task Events**
   - Task creation with full description
   - Task status updates
   - Dependency information

3. **Agent Conversations**
   - Full message history for each agent
   - User/Assistant/Tool message roles
   - Tool calls with arguments
   - Tool results (truncated for readability)

4. **Orchestration Summary**
   - Total tasks completed
   - Total turns across all agents
   - List of agents used

### Sample Debug Log

```
[2024-01-15T10:30:45.123Z]
======================================================================
  INPUT ANALYSIS
======================================================================

User Input:
Find all TypeScript files and count the lines

----------------------------------------------------------------------
  ANALYSIS RESULT
----------------------------------------------------------------------

Intent: code_exploration
Requires Planning: false
Suggested Agent: explore

**********************************************************************
  AGENT SPAWN: EXPLORE
**********************************************************************

======================================================================
  FULL CONVERSATION: EXPLORE
======================================================================

--- Message 1 [USER] ---
Find all TypeScript files and count the lines

--- Message 2 [ASSISTANT] ---
I'll help you find all TypeScript files and count the lines.

Tool Calls:
  glob:
    {
      "pattern": "**/*.ts"
    }

--- Message 3 [TOOL] ---
Tool Results:
  [call_0]:
    src/index.ts
    src/app.ts
    ...

----------------------------------------------------------------------
  [+] EXPLORE COMPLETE
----------------------------------------------------------------------

Success: true
Turns: 2
Terminate Reason: complete

Output:
Found 42 TypeScript files with a total of 5,234 lines.
```

### How Debug Mode Works

Debug logging is automatically enabled when `config.getDebugConfig().enabled` is `true`. The AgentManager reads from the Config instance:

```typescript
import { Config, createAgentManager } from '@beans/core';

const config = await Config.getInstance();

// Enable debug mode via config
await config.updateConfig({
  debug: { enabled: true, logRequests: true, logResponses: true },
});

// AgentManager automatically uses debug config
const agentManager = createAgentManager(config);
// Debug logging is now enabled for all agent conversations
```

The CLI enables this automatically when `--debug` flag is passed.

## Design Principles

1. **Reuse existing infrastructure**: Multi-agent system uses `AgentExecutor` for all agent execution
2. **Event-based communication**: Loose coupling via `MultiAgentEvent` union type
3. **Dependency-aware execution**: Tasks execute only when dependencies complete
4. **Fallback behavior**: System gracefully handles analysis failures with sensible defaults
5. **Reactive UI updates**: Task store subscriptions enable real-time UI updates
6. **Comprehensive debugging**: Full conversation logging in debug mode for troubleshooting
