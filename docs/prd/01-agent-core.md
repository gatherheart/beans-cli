# PRD: Agent Core System

## Overview

The Agent Core is the central orchestration layer that manages the agent loop - the fundamental cycle of receiving input, calling the LLM, executing tools, and returning output. This is the brain of the AI agent.

## Problem Statement

Developers need an AI assistant that can:
1. Understand complex, multi-step coding tasks
2. Use tools to interact with the file system and execute commands
3. Handle errors gracefully and recover from failures
4. Operate within defined constraints (turns, time, tokens)

## Goals

- **G1**: Implement a robust agent loop that can handle multi-turn interactions
- **G2**: Support configurable execution limits (max turns, timeout)
- **G3**: Provide real-time activity events for UI responsiveness
- **G4**: Enable structured output validation with Zod schemas
- **G5**: Support subagent invocation for complex workflows

## Non-Goals

- Building a visual agent designer (future consideration)
- Supporting non-TypeScript agent definitions
- Real-time collaboration between multiple agents

---

## Functional Requirements

### FR1: Agent Definition

**Description**: Define agents as strongly-typed configuration objects.

**Specification**:
```typescript
interface AgentDefinition<TOutput> {
  name: string;                    // Unique identifier
  description: string;             // Human-readable description
  promptConfig: PromptConfig;      // System prompt, initial messages
  modelConfig: ModelConfig;        // Model, temperature, tokens
  runConfig?: RunConfig;           // Max turns, timeout
  toolConfig?: ToolConfig;         // Available tools
  inputConfig?: InputConfig;       // Input parameters
  outputConfig?: OutputConfig<TOutput>;  // Validated output
}
```

**Acceptance Criteria**:
- [ ] Agents can be defined using TypeScript interfaces
- [ ] All configuration is validated at startup
- [ ] Template substitution works for `${variable}` syntax

### FR2: Agent Loop Execution

**Description**: Execute the agent loop with proper turn management.

**Specification**:
```
LOOP until terminated:
  1. Call LLM with messages + tools
  2. If tool_calls present:
     a. Execute tools in parallel
     b. Append results to messages
     c. Continue loop
  3. Else:
     a. Return content as final output
  4. Check termination conditions:
     - Max turns reached
     - Timeout exceeded
     - Abort signal received
     - Agent signaled completion
```

**Acceptance Criteria**:
- [ ] Loop terminates after max_turns
- [ ] Loop terminates after timeout_ms
- [ ] AbortSignal cancels execution
- [ ] Tool calls are executed in parallel
- [ ] Messages accumulate correctly

### FR3: Activity Events

**Description**: Emit events for observability and UI updates.

**Specification**:
```typescript
type AgentActivityEvent =
  | { type: 'turn_start'; turnNumber: number }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call_start'; toolCall: ToolCall }
  | { type: 'tool_call_end'; toolCallId: string; result: string }
  | { type: 'content_chunk'; content: string }
  | { type: 'turn_end'; turnNumber: number }
  | { type: 'error'; error: Error };
```

**Acceptance Criteria**:
- [ ] Events emit in correct order
- [ ] All tool calls emit start/end events
- [ ] Errors are captured as events
- [ ] Content streaming works via chunks

### FR4: Agent Registry

**Description**: Central registry for managing agent definitions.

**Specification**:
- `register(definition)`: Add an agent
- `get(name)`: Retrieve by name
- `getAll()`: List all agents
- `unregister(name)`: Remove an agent

**Acceptance Criteria**:
- [ ] Duplicate names throw errors
- [ ] Lookup by name is O(1)
- [ ] Registry is singleton per app

### FR5: Output Validation

**Description**: Validate and parse structured output using Zod.

**Specification**:
```typescript
outputConfig: {
  outputName: 'result',
  schema: z.object({
    summary: z.string(),
    files: z.array(z.string()),
  }),
}
```

**Acceptance Criteria**:
- [ ] Valid output is parsed and returned typed
- [ ] Invalid output returns raw content with flag
- [ ] Schema errors don't crash execution

---

## Non-Functional Requirements

### NFR1: Performance

- Agent loop iteration < 100ms overhead
- Tool execution parallelization when independent
- Memory usage < 500MB for typical sessions

### NFR2: Reliability

- Graceful handling of LLM API errors
- Retry logic with exponential backoff
- Transaction-like tool execution (log before execute)

### NFR3: Observability

- Structured logging for all events
- Metrics for turn count, token usage, duration
- Trace IDs for request correlation

---

## Technical Design

### Component Diagram

```
┌──────────────────────────────────────────────────┐
│                 AgentExecutor                     │
│  ┌───────────────────────────────────────────┐   │
│  │           Agent Loop                       │   │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │ LLM Call│→ │Tool Exec │→ │ Validate │  │   │
│  │  └─────────┘  └──────────┘  └──────────┘  │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
        ↓                    ↓
┌──────────────┐    ┌───────────────┐
│  LLMClient   │    │ ToolRegistry  │
└──────────────┘    └───────────────┘
```

### Data Flow

1. User provides AgentDefinition + inputs
2. Executor builds system prompt with substitutions
3. Loop: Call LLM → Execute tools → Accumulate messages
4. Return AgentResult with output, messages, metrics

### Error Handling

- **LLM Errors**: Retry up to 3 times, then fail
- **Tool Errors**: Capture in result, continue loop
- **Validation Errors**: Return raw output, flag as unvalidated
- **Timeout**: Terminate immediately, return partial result

---

## API Reference

### AgentExecutor

```typescript
class AgentExecutor {
  constructor(llmClient: LLMClient, toolRegistry: ToolRegistry);

  execute<T>(
    definition: AgentDefinition,
    options?: ExecuteOptions
  ): Promise<AgentResult<T>>;
}

interface ExecuteOptions {
  inputs?: Record<string, unknown>;
  signal?: AbortSignal;
  onActivity?: (event: AgentActivityEvent) => void;
}

interface AgentResult<T> {
  success: boolean;
  output?: T;
  rawContent: string;
  terminateReason: TerminateReason;
  error?: string;
  turnCount: number;
  messages: Message[];
}
```

---

## Testing Strategy

### Unit Tests

- AgentDefinition validation
- Template substitution
- Termination condition checks
- Output schema validation

### Integration Tests

- Full agent loop with mock LLM
- Tool execution with mock tools
- Error handling scenarios
- Timeout and abort behavior

### E2E Tests

- Real LLM calls (limited, expensive)
- Complete task scenarios
- Performance benchmarks

---

## Dependencies

- `@beans/core/tools` - Tool system
- `@beans/core/llm` - LLM client
- `zod` - Schema validation

---

## Open Questions

1. Should agents be able to spawn other agents? (Tentative: Yes)
2. How to handle very long conversations exceeding context window?
3. Should we support agent checkpointing for resume?
