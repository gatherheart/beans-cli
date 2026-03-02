# Claude Instructions for Beans Agent

## Reference Projects

- **Patterns**: `../gemini-cli` for implementation patterns
- **Agent Structure**: https://github.com/wshobson/agents

## Project Overview

Beans Agent is a dynamic AI agent framework built as a modular CLI. It supports multiple LLM providers (Google, Ollama), includes built-in tools for file operations and shell commands, and features a plugin-based agent system.

## Architecture Overview

```
beans-code/
├── plugins/                          # Plugin-based agent system
│   ├── general-assistant/            # Default general-purpose plugin
│   │   ├── agents/
│   │   │   └── default.md            # Default agent (used when no args)
│   │   ├── commands/                 # (TODO)
│   │   └── skills/                   # (TODO)
│   ├── code-development/             # Code development plugin
│   │   ├── agents/
│   │   │   ├── code-reviewer.md
│   │   │   ├── typescript-expert.md
│   │   │   └── python-pro.md
│   │   ├── commands/
│   │   └── skills/
│   │       └── testing-patterns.md
│   └── devops-operations/            # DevOps plugin
│       ├── agents/
│       │   ├── devops-engineer.md
│       │   └── kubernetes-architect.md
│       ├── commands/
│       └── skills/
│           └── docker-patterns.md
├── packages/
│   ├── core/                         # Core framework
│   │   └── src/
│   │       ├── agents/               # Agent execution engine
│   │       ├── tools/                # Tool system and built-in tools
│   │       ├── llm/                  # LLM client providers
│   │       ├── config/               # Configuration management
│   │       └── context/              # Session and workspace context
│   └── cli/                          # Command line interface
│       └── src/
│           ├── index.ts              # Entry point
│           ├── args.ts               # CLI argument parsing
│           ├── app.tsx               # Main application
│           └── ui/                   # Ink-based React UI
│               ├── App.tsx           # Root component
│               ├── contexts/         # React contexts (gemini-cli pattern)
│               ├── hooks/            # Custom hooks (useChatHistory, useTerminalSize)
│               ├── theme/            # Color palette (colors.ts)
│               ├── utils/            # Formatting utilities
│               └── components/       # UI components
├── docs/
│   ├── sop/                          # Development guidelines
│   ├── prd/                          # Product requirement documents
│   ├── guides/                       # Implementation guides
│   ├── issues/                       # Issues and solutions
│   └── architecture/                 # Architecture documentation
└── CLAUDE.md                         # This file
```

## Plugin System

Following the wshobson/agents architecture with three-layer structure:

### 1. Agents (Markdown with YAML frontmatter)

Domain specialists defined as Markdown files:

```markdown
---
name: code-reviewer
description: Expert code reviewer focusing on quality and security
---

# Code Reviewer

## Purpose

You are an expert code reviewer...

## Capabilities

- Code quality analysis
- Security review
  ...
```

**YAML Frontmatter Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (snake_case) |
| `description` | Yes | Brief one-line description |

### 2. Commands (TODO)

Tools and workflows for the domain.

### 3. Skills

Modular knowledge packages with triggers:

```markdown
---
name: testing-patterns
triggers:
  - write tests
  - unit test
  - mocking
---

# Testing Patterns

## Use When

User requests help with testing...

## Instructions

...
```

## Key Components

### AgentProfile (`packages/core/src/agents/profile.ts`)

- Loads agent profiles from Markdown files
- Parses YAML frontmatter for metadata (name, description)
- Uses Markdown body as system prompt
- `AgentProfileBuilder` generates profiles via LLM

### ChatSession (`packages/core/src/agents/chat-session.ts`)

- Manages continuous chat with accumulated history
- System prompt set once at session start

### AgentExecutor (`packages/core/src/agents/executor.ts`)

- Runs the agent loop (LLM call → tool execution → repeat)
- Handles streaming responses
- Manages turn limits and timeouts

### LLM Client (`packages/core/src/llm/`)

- Unified interface for multiple providers
- Currently supports: Google (Gemini), Ollama
- See `docs/prd/llm-interface.md` for request/response format

### Tool System (`packages/core/src/tools/`)

- Built-in tools: `read_file`, `write_file`, `shell`, `glob`, `grep`
- Extensible via `BaseTool` class
- Tools registered in `ToolRegistry`

### CLI UI (`packages/cli/src/ui/`)

Following gemini-cli patterns for state management:

- **ChatStateContext**: Read-only state (messages, isLoading, error, profile)
- **ChatActionsContext**: Action handlers (sendMessage, addSystemMessage, clearHistory)
- **useChatHistory hook**: Encapsulates message management logic
- **Components**: ChatView, Message, MarkdownDisplay, InputArea

## Profile Resolution Order

When the CLI starts, it resolves the agent profile:

1. `--agent-profile <path>` - Explicit .md file
2. `-a <description>` - Generate via LLM
3. `.beans/agent.md` - Workspace-specific profile
4. `plugins/general-assistant/agents/default.md` - Default agent
5. Hardcoded fallback

## CLI Usage

```bash
# Use default agent
beans

# Use specific agent from plugins
beans --agent-profile ./plugins/code-development/agents/code-reviewer.md

# Generate agent from description
beans -a "A security-focused code reviewer"

# Auto-approve all tool calls
beans --yolo "prompt"

# List available models
beans --list-models

# UI test mode (mock LLM responses)
beans --ui-test

# UI test with specific scenario
beans --ui-test --ui-test-scenario rapid-stream
```

See `docs/guides/ui-testing.md` for complete UI testing documentation.

## Interactive Commands

| Command    | Description                |
| ---------- | -------------------------- |
| `/help`    | Show available commands    |
| `/profile` | View current agent profile |
| `/history` | Show LLM message history   |
| `/memory`  | Show current system prompt |
| `/clear`   | Clear chat history         |
| `/exit`    | Exit application           |

## Input Controls

| Key                 | Action              |
| ------------------- | ------------------- |
| Enter               | Submit message      |
| Shift+Enter, Ctrl+J | Insert newline      |
| Left/Right Arrow    | Move cursor         |
| Ctrl+A / Ctrl+E     | Move to start / end |
| Ctrl+U              | Clear input         |
| Ctrl+C              | Exit                |

## Debug Mode

Use `--debug` flag to log LLM requests/responses to `~/.beans/logs/debug.log`.

## Development Guidelines

1. **Plugin Structure**: Follow `plugins/{domain}/{agents,commands,skills}/` pattern
2. **Agent Format**: Use Markdown with YAML frontmatter (name, description only)
3. **LLM Interface**: See `docs/prd/llm-interface.md` for request/response specs
4. **Tools**: Extend `BaseTool` class, register in `tools/builtin/index.ts`

## Documentation Structure

| Folder               | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| `docs/sop/`          | Development guidelines, coding standards, testing |
| `docs/prd/`          | Feature specifications with task list tracking    |
| `docs/guides/`       | Implementation explanations (how things work)     |
| `docs/issues/`       | Problems encountered and solutions                |
| `docs/architecture/` | System design and component interactions          |

When implementing features or fixing bugs, document issues in `docs/issues/`. See existing files for reference.

## Before Committing

1. Ensure all CLAUDE.md files are updated
2. Run `npm run build` to verify compilation
3. Run `npm test` if tests exist
4. Update documentation if features changed

## Building and Running

Before submitting any changes, validate them by running the full preflight check:

```bash
npm run preflight
```

This command builds the repository, runs all tests, checks for type errors, and lints the code. While you can run individual steps (`build`, `test`, `typecheck`, `lint`) separately, use `npm run preflight` for comprehensive validation.

## Writing Tests

This project uses **Vitest** as its primary testing framework.

### Test Structure and Framework

- **Framework**: All tests use Vitest (`describe`, `it`, `expect`, `vi`)
- **File Location**: Test files (`*.test.ts` for logic, `*.test.tsx` for React components) are co-located with source files
- **Configuration**: Test environments defined in `vitest.config.ts`
- **Setup/Teardown**: Use `beforeEach` and `afterEach`. Call `vi.resetAllMocks()` in `beforeEach` and `vi.restoreAllMocks()` in `afterEach`

### Mocking (`vi` from Vitest)

- **ES Modules**: Mock with `vi.mock('module-name', async (importOriginal) => { ... })`. Use `importOriginal` for selective mocking
- **Mocking Order**: For critical dependencies (e.g., `os`, `fs`) that affect module-level constants, place `vi.mock` at the top of the test file, before other imports
- **Hoisting**: Use `const myMock = vi.hoisted(() => vi.fn());` if a mock function needs to be defined before its use in a `vi.mock` factory
- **Mock Functions**: Create with `vi.fn()`. Define behavior with `mockImplementation()`, `mockResolvedValue()`, or `mockRejectedValue()`
- **Spying**: Use `vi.spyOn(object, 'methodName')`. Restore spies with `mockRestore()` in `afterEach`

### Commonly Mocked Modules

- **Node.js built-ins**: `fs`, `fs/promises`, `os` (especially `os.homedir()`), `path`, `child_process`
- **External SDKs**: `@google/genai`, `@modelcontextprotocol/sdk`
- **Internal Project Modules**: Dependencies from other project packages

### React Component Testing (CLI UI - Ink)

- Use `render()` from `ink-testing-library`
- Assert output with `lastFrame()`
- Wrap components in necessary `Context.Provider`s
- Mock custom React hooks and complex child components using `vi.mock()`

### Asynchronous Testing

- Use `async/await`
- For timers, use `vi.useFakeTimers()`, `vi.advanceTimersByTimeAsync()`, `vi.runAllTimersAsync()`
- Test promise rejections with `await expect(promise).rejects.toThrow(...)`

## Strict Development Rules

These rules apply strictly to all code modifications (adapted from gemini-cli).

### Testing Guidelines

- **Async/Await**: NEVER use fixed waits (e.g., `await delay(100)`). Always use `waitFor` with a predicate to ensure tests are stable and fast.
- **React Testing**: Use `act` to wrap all blocks in tests that change component state. Use `render` from `ink-testing-library` with proper providers.
- **Snapshots**: Use `toMatchSnapshot` to verify rendering. When modifying snapshots, verify changes are intentional.
- **Parameterized Tests**: Use parameterized tests where it reduces duplicated lines. Give parameters explicit types.
- **Mocks Management**:
  - Mock critical dependencies (`fs`, `os`, `child_process`) ONLY at the top of the file
  - Reuse existing mocks and fakes rather than creating new ones
  - Avoid mocking the file system whenever possible
  - Always call `vi.restoreAllMocks()` in `afterEach` to prevent test pollution
  - Use `vi.useFakeTimers()` for tests involving time-based logic
- **Typing in Tests**: Avoid using `any` in tests; prefer proper types or `unknown` with narrowing.

### React Guidelines (`packages/cli`)

- **`setState` and Side Effects**: NEVER trigger side effects from within the body of a `setState` callback. Use a reducer or `useRef` if necessary.
- **Rendering**: Do not introduce infinite rendering loops. Avoid synchronous file I/O in React components as it will hang the UI.
- **Logging**: Do not leave `console.log`, `console.warn`, or `console.error` in the code.
- **State & Effects**: Ensure state initialization is explicit (e.g., use `undefined` rather than `true` as a default if the state is truly unknown). Carefully manage `useEffect` dependencies. Prefer a reducer whenever practical. NEVER disable `react-hooks/exhaustive-deps`.
- **Context & Props**: Avoid excessive property drilling. Leverage existing providers, extend them, or propose a new one if necessary.
- **Code Structure**: Avoid complex `if` statements where `switch` statements could be used. Keep root components minimal; refactor complex logic into React hooks.

### Core Guidelines (`packages/core`)

- **Services**: Implement services as classes with clear lifecycle management (e.g., `initialize()` methods). Services should be stateless where possible.
- **Exports & Tooling**: Add new tools to `packages/core/src/tools/` and register them in `packages/core/src/tools/builtin/index.ts`. Export all new public services, utilities, and types from `packages/core/src/index.ts`.

### Architectural Audit (Package Boundaries)

- **Logic Placement**: Non-UI logic (e.g., model orchestration, tool implementation, git/filesystem operations) MUST reside in `packages/core`. `packages/cli` should ONLY contain UI/Ink components, command-line argument parsing, and user interaction logic.
- **Environment Isolation**: Core logic must not assume a TUI environment.

### TypeScript Best Practices

- Use `checkExhaustive` in the `default` clause of `switch` statements to ensure all cases are handled.
- Avoid using the non-null assertion operator (`!`) unless absolutely necessary.
- **STRICT TYPING**: Strictly forbid `any` and `unknown` in both CLI and Core packages. `unknown` is only allowed if it is immediately narrowed using type guards or Zod validation.
- NEVER disable `@typescript-eslint/no-floating-promises`.
- Avoid making types nullable unless strictly necessary, as it hurts readability.

### Type Guards Pattern

When narrowing union types, use type guard functions:

```typescript
function isWriteFileMetadata(
  metadata: ToolMetadata | undefined,
): metadata is WriteFileMetadata {
  if (!metadata) return false;
  const m = metadata as WriteFileMetadata;
  return (
    typeof m.path === "string" &&
    typeof m.newContent === "string" &&
    typeof m.isNewFile === "boolean"
  );
}
```

### TUI Best Practices

- **Terminal Compatibility**: Consider how changes might behave differently across terminals (e.g., VSCode terminal, SSH, Kitty, default Mac terminal, iTerm2, Windows terminal).

### Code Cleanup

- **Refactoring**: Actively clean up code duplication, technical debt, and boilerplate when working in the codebase.

## JavaScript/TypeScript Guidelines

### Prefer Plain Objects over Classes

- **Seamless React Integration**: Plain objects can be easily passed as props
- **Reduced Boilerplate**: TypeScript interfaces provide type checking without runtime overhead
- **Enhanced Readability**: No hidden internal state or complex inheritance chains
- **Simplified Immutability**: Create new objects with changes rather than mutating
- **Better Serialization**: Plain objects serialize to JSON easily

### Use ES Module Syntax for Encapsulation

Instead of Java-esque private/public class members, use ES module `import`/`export`:

- Exported items are the public API; unexported items are private
- Encourages testing the public API rather than internal implementation
- If you need to test a private function, consider extracting it to a separate module

### Embrace Array Operators

Use `.map()`, `.filter()`, `.reduce()`, `.slice()`, `.sort()` for:

- **Immutability**: Most operators return new arrays
- **Readability**: Chaining is more expressive than loops
- **Functional Programming**: Pure functions without side effects

## React Guidelines

### Core Principles

1. **Functional Components with Hooks**: No class components or old lifecycle methods
2. **Keep Components Pure**: No side effects during rendering
3. **One-way Data Flow**: Pass data through props, lift state up when needed
4. **Never Mutate State**: Use spread syntax or create new objects/arrays
5. **Follow Rules of Hooks**: Call hooks unconditionally at top level only

### useEffect Best Practices

- **Avoid useEffect when possible**: Think harder to avoid it
- **Primary use**: Synchronizing React with external state
- **Never setState within useEffect**: Degrades performance
- **Include all dependencies**: Don't suppress ESLint rules
- **Return cleanup functions**: Handle subscriptions and unmount

### Performance Guidelines

- **Parallel Data Fetching**: Start multiple requests at once
- **Leverage Suspense**: For data loading
- **Rely on React Compiler**: Omit `useMemo`, `useCallback`, `React.memo` if compiler is enabled
- **Avoid Premature Optimization**: Write clear, simple components

### User Experience

- Show lightweight placeholders (skeleton screens) during loading
- Handle errors gracefully with error boundaries
- Render partial data as it becomes available

## Style Guidelines

### Comments Policy

Only write high-value comments if at all. Avoid talking to the user through comments.

### General Style

- Use hyphens instead of underscores in flag names (e.g., `--my-flag` not `--my_flag`)

## Git

The main branch for this project is called "main"
