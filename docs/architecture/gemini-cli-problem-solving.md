# Gemini CLI Problem-Solving Architecture

This document analyzes how gemini-cli thinks and solves complex problems, serving as a reference for implementing similar patterns in beans-code.

## Overview

Gemini CLI uses a **tool-augmented agentic loop** with a three-phase development methodology. The key insight is that reasoning emerges through strategic tool calls rather than explicit "thinking" phases.

---

## 1. Boot Sequence & Entry Points

```
main()
  ↓
Load settings → Negotiate auth → Determine sandbox mode
  ↓
Build Config (tool registries, policy engine, model routing, telemetry, GeminiClient)
  ↓
Pre-load extensions, themes, hierarchical memory notebooks
  ↓
Branch: Interactive (Ink UI) or Non-interactive (headless)
```

**Key Entry Points:**

- Interactive: `startInteractiveUI()` → renders `AppContainer` (React + Ink)
- Non-interactive: `runNonInteractive()` → processes stdin or `--prompt` text

---

## 2. Agent Execution Pattern

The core reasoning pattern is **tool-augmented planning**:

```
┌─────────────────────────────────────────────────────┐
│                  AGENTIC LOOP                       │
├─────────────────────────────────────────────────────┤
│  1. Initialize: Model receives system prompt + task │
│                                                     │
│  2. Loop Until Complete:                            │
│     ├── Call Model: Send message with tools         │
│     ├── Parse Response: Extract text + fn calls     │
│     ├── Execute Tools:                              │
│     │   ├── Validate parameters                     │
│     │   ├── Check policy (security/safety)          │
│     │   ├── Execute with constraints                │
│     │   └── Return structured results               │
│     └── Feed Back: Insert tool results              │
│                                                     │
│  3. Termination: Agent calls `complete_task` tool   │
│     └── Returns with reason: GOAL/TIMEOUT/ERROR     │
└─────────────────────────────────────────────────────┘
```

**Key Insight:** No explicit "thinking" phase. Reasoning emerges through tool calls that ground the model in reality.

---

## 3. Three-Phase Development Methodology

The system prompt encodes a structured approach to complex problems:

### Phase 1: Research

Model explores using **read-only tools**:

- `read_file`, `read_many_files`
- `glob`, `grep`, `ls`

**Goal:** Gather context about existing code, conventions, dependencies, and prior work.

### Phase 2: Strategy

Model analyzes findings and decides approach:

- Optionally enters **Plan Mode** via `enter_plan_mode` tool
- In Plan Mode: restricted to read-only tools (safe exploration)
- Creates detailed plan in Markdown file
- Exits with `exit_plan_mode` → presents plan for user approval

### Phase 3: Execution

For each sub-task, follows **Plan → Act → Validate** cycle:

| Step         | Description                                                     |
| ------------ | --------------------------------------------------------------- |
| **Plan**     | Define implementation approach AND testing strategy             |
| **Act**      | Apply surgical changes using `write_file`, `edit_file`, `shell` |
| **Validate** | Run tests, linting, type-checking to verify changes             |

---

## 4. Context Efficiency Guidelines

The system prompt emphasizes strategic tool usage to minimize token waste:

```
┌────────────────────────────────────────────────────────┐
│  CONTEXT EFFICIENCY PRINCIPLES                         │
├────────────────────────────────────────────────────────┤
│  • Combine turns using parallel tool calls             │
│  • Prefer search tools (grep) over reading many files  │
│  • Request enough context in one call                  │
│  • Prioritize reducing turns over minimizing output    │
└────────────────────────────────────────────────────────┘
```

---

## 5. Tool Execution Pipeline

`CoreToolScheduler` orchestrates a multi-stage pipeline:

```
Request → Validation → Policy Check → Confirmation → Execution → Output Processing → Return
```

### Detailed Flow

1. **Validation:** Check parameters against Zod schema
2. **Policy Check:** `PolicyEngine` evaluates rules
   - Allow/deny based on whitelist/blacklist
   - Trigger ASK_USER for interactive confirmation
   - Modes: DEFAULT, AUTO_EDIT, PLAN, YOLO
3. **Confirmation:** If required, prompt user via `MessageBus`
   - Show diffs for edit/write tools
   - Show command for shell execution
   - Options: Proceed, Proceed Always (session), Proceed Always & Save (persistent)
4. **Execution:** Run with constraints
   - Respect workspace boundaries
   - Stream output for long-running operations
   - Capture errors with structured `ToolErrorType`
5. **Output Processing:**
   - Truncate large outputs
   - Mask sensitive data (credentials)
   - Format for model consumption

---

## 6. Context Management Strategy

### No Traditional RAG

Instead of pre-built vector embeddings, uses **agentic retrieval-on-demand**:

- Model decides which files/searches to invoke based on task
- Tools: `read_many_files`, `glob`, `grep`, `memory` fetch context on-demand

### Hierarchical Memory

```
~/.gemini.md          (global preferences)
    ↓
extension/.gemini.md  (extension context)
    ↓
project/GEMINI.md     (project-specific)
```

### Session State

`GeminiChat` maintains:

- Full conversation history
- Session turn count (max 100 turns)
- Loop detection (prevent infinite cycles)
- Chat compression (summarize old turns when context overflows)
- Model selection and routing

---

## 7. Decision-Making Patterns

### System Prompt Architecture

The prompt is **composable and conditional**, built from modular sections:

```
1. Preamble (identity: interactive vs autonomous agent)
2. Core Mandates (security, context efficiency, engineering standards)
3. Available Sub-Agents (with descriptions)
4. Available Skills (activated on-demand)
5. Hook Context (read-only external context)
6. Primary Workflows (Research → Strategy → Execution)
7. Operational Guidelines (tone, tool usage, safety)
8. Sandbox Mode (if sandboxed: explain constraints)
9. Git Context (if in repo: provide git integration info)
```

### Key Decision Policies

| Policy                               | Description                                           |
| ------------------------------------ | ----------------------------------------------------- |
| **Engineering Standards Precedence** | Local GEMINI.md/CLAUDE.md files override defaults     |
| **Expertise & Intent Alignment**     | Distinguish Directives (do) vs Inquiries (analyze)    |
| **Context Efficiency**               | Minimize extra turns; prefer combining operations     |
| **Proactiveness**                    | Persist through errors; backtrack and adjust strategy |
| **Validation Rigor**                 | Never assume success; exhaustive verification         |

### Intent Classification

```
Inquiries (Analyze Only)
├── Research & propose
├── Don't implement until explicit Directive
└── Wait for user approval

Directives (Do Something)
├── Work autonomously
├── Be thorough
└── Verify everything
```

---

## 8. Hierarchical Planning with Sub-Agents

### Sub-Agent Architecture

`AgentRegistry` loads specialized agents:

```
MainAgent
├── CodebaseInvestigatorAgent (read-only exploration)
├── PlannerAgent (strategy formulation)
└── [Custom agents...]
```

Each agent has:

- Own system prompt
- Restricted tool set (e.g., read-only for exploration)
- Structured output schema (Zod)
- Max turn/time limits

### Execution Isolation

- Sub-agents run in inner loop with their own constraints
- Top-level agent delegates complex sub-tasks
- Results validated against output schema before returning
- Exposed via `SubagentToolWrapper` - callable as a tool

---

## 9. Safety & Approval Model

### Approval Modes

| Mode          | Behavior                                         |
| ------------- | ------------------------------------------------ |
| **DEFAULT**   | Prompt for every write/shell; show diffs         |
| **AUTO_EDIT** | Auto-approve edits; still prompt shell           |
| **PLAN**      | Restrict to read-only tools; block modifications |
| **YOLO**      | Auto-approve everything (skip confirmations)     |

### Safety Guarantees

- Credentials never logged/printed (enforced by policy)
- Source control operations require explicit request
- Sandbox mode isolates from system resources
- Policy engine can deny tools per config
- All tool execution is auditable

---

## 10. Error Recovery & Loop Detection

### Loop Detection

`LoopDetectionService` monitors for infinite cycles:

- Tracks tool call patterns
- If detected: fires event, notifies user, agent adjusts strategy

### Model Routing & Fallback

`ModelRouterService` dynamically swaps models:

- Quota errors → switch to slower model
- Policy triggers → prefer efficient model
- User preference → override default
- Fallback handlers gracefully degrade

### Error Handling

```
Structured error types (ToolErrorType, UnauthorizedError, etc.)
    ↓
Retry logic with exponential backoff
    ↓
Invalid content retries (malformed responses)
    ↓
Comprehensive error telemetry
```

---

## 11. Telemetry & Observability

Rich event system for debugging and monitoring:

| Event                                  | Purpose                    |
| -------------------------------------- | -------------------------- |
| `ToolCallEvent`                        | Log every tool execution   |
| `ContentRetryEvent`                    | Track API retries          |
| `NextSpeakerCheckEvent`                | Validate conversation flow |
| `AgentStartEvent` / `AgentFinishEvent` | Track sub-agent execution  |
| `LoopDetectionEvent`                   | Alert on infinite cycles   |

---

## Summary: Problem-Solving Philosophy

| Aspect             | Approach                                             |
| ------------------ | ---------------------------------------------------- |
| **Planning**       | 3-phase lifecycle: Research → Strategy → Execution   |
| **Reasoning**      | Tool-augmented; emerges through strategic tool calls |
| **Context**        | Demand-driven retrieval; no pre-built embeddings     |
| **Safety**         | Policy-guarded tool pipeline with human approvals    |
| **Decomposition**  | Sub-agents for deep investigations; hierarchical     |
| **Error Recovery** | Retry + routing + fallback with telemetry            |
| **Efficiency**     | Strategic tool usage; minimize context/turns         |
| **Validation**     | Exhaustive verification post-execution               |
| **Extensibility**  | MCP servers, skills, sub-agents, custom tools        |

**Core Philosophy:** _Pragmatic Agency_ - Give the model powerful tools, constrain execution with policy, enable human oversight, and orchestrate with rich telemetry.

---

## Implications for beans-code

### Features to Consider Implementing

1. **Plan Mode** - Safe read-only exploration before execution
2. **Sub-Agents** - Specialized agents for specific tasks
3. **Loop Detection** - Prevent infinite tool call cycles
4. **Policy Engine** - Configurable approval/deny rules
5. **Model Routing** - Dynamic model switching on errors
6. **Chat Compression** - Summarize old turns to save context
7. **Structured Output Validation** - Zod schemas for agent outputs

### System Prompt Patterns to Adopt

1. **Three-phase methodology** in default prompt
2. **Context efficiency guidelines** to reduce turns
3. **Intent classification** (Directive vs Inquiry)
4. **Hierarchical memory** loading from BEANS.md files
5. **Validation mandates** - never assume success
