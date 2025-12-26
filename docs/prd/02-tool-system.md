# PRD: Tool System

## Overview

The Tool System provides a declarative framework for defining, registering, and executing tools that the AI agent can use to interact with the environment. Tools are the hands of the agent - they enable it to read files, write code, execute commands, and more.

## Problem Statement

AI agents need to interact with the real world to be useful. Without tools, they can only generate text. The tool system bridges this gap by:

1. Providing a standard interface for tool definition
2. Validating parameters before execution
3. Supporting confirmation workflows for dangerous operations
4. Enabling extensibility through plugins

## Goals

- **G1**: Define tools declaratively with Zod schemas
- **G2**: Separate validation from execution for safety
- **G3**: Support streaming output for long-running tools
- **G4**: Enable user confirmation for destructive operations
- **G5**: Provide a comprehensive set of built-in tools

## Non-Goals

- Visual tool builder (future)
- Sandboxed execution environments (separate concern)
- Cross-platform shell abstraction

---

## Functional Requirements

### FR1: Tool Definition Interface

**Description**: Tools are defined with schemas and execution logic.

**Specification**:
```typescript
interface Tool<TParams = Record<string, unknown>> {
  readonly definition: ToolDefinition;
  validate(params: TParams): { valid: boolean; error?: string };
  getConfirmation?(params: TParams): ToolConfirmation;
  execute(params: TParams, options?: ToolExecutionOptions): Promise<ToolExecutionResult>;
}

interface ToolDefinition {
  name: string;
  displayName?: string;
  description: string;
  parameters: JSONSchema;
}
```

**Acceptance Criteria**:
- [ ] Tools can be defined with TypeScript classes
- [ ] Zod schemas are converted to JSON Schema
- [ ] Parameters are validated before execution
- [ ] Confirmation is optional

### FR2: Base Tool Class

**Description**: Abstract base class for common tool implementation patterns.

**Specification**:
```typescript
abstract class BaseTool<TParams> implements Tool<TParams> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly schema: z.ZodSchema<TParams>;

  get definition(): ToolDefinition;
  validate(params: TParams): { valid: boolean; error?: string };
  abstract execute(params: TParams, options?: ToolExecutionOptions): Promise<ToolExecutionResult>;
}
```

**Acceptance Criteria**:
- [ ] Subclasses only need to implement execute()
- [ ] Schema validation is automatic
- [ ] JSON Schema is generated from Zod

### FR3: Tool Registry

**Description**: Central registry for discovering and managing tools.

**Specification**:
```typescript
class ToolRegistry {
  register(tool: Tool): void;
  registerAll(tools: Tool[]): void;
  getTool(name: string): Tool | undefined;
  getAllTools(): Tool[];
  getAllDefinitions(): ToolDefinition[];
  has(name: string): boolean;
  unregister(name: string): boolean;
}
```

**Acceptance Criteria**:
- [ ] Tools are registered by name
- [ ] Duplicate names throw errors
- [ ] Definitions can be extracted for LLM

### FR4: Built-in Tools

**Description**: Core set of tools for common operations.

| Tool | Description | Confirmation |
|------|-------------|--------------|
| `read_file` | Read file contents with line numbers | No |
| `write_file` | Write content to a file | Yes |
| `shell` | Execute shell commands | Yes |
| `glob` | Find files by pattern | No |
| `grep` | Search file contents | No |
| `edit` | Replace text in files | Yes |
| `web_search` | Search the web | No |
| `web_fetch` | Fetch URL contents | No |

**Acceptance Criteria**:
- [ ] All tools pass validation tests
- [ ] Destructive tools require confirmation
- [ ] Error messages are helpful

### FR5: Tool Confirmation

**Description**: User approval for potentially destructive operations.

**Specification**:
```typescript
interface ToolConfirmation {
  required: boolean;
  message?: string;
  type?: 'read' | 'write' | 'execute' | 'destructive';
}
```

**Confirmation Modes**:
- `none`: Always require confirmation
- `safe`: Auto-approve read operations
- `all`: Auto-approve everything (yolo mode)

**Acceptance Criteria**:
- [ ] Write tools request confirmation
- [ ] Shell commands request confirmation
- [ ] Confirmation can be auto-approved
- [ ] User sees clear description of action

### FR6: Streaming Output

**Description**: Tools can stream output for real-time feedback.

**Specification**:
```typescript
interface ToolExecutionOptions {
  signal?: AbortSignal;
  onOutput?: (chunk: string) => void;
  cwd?: string;
}
```

**Acceptance Criteria**:
- [ ] Shell tool streams stdout/stderr
- [ ] Output callback is called incrementally
- [ ] AbortSignal cancels execution

---

## Non-Functional Requirements

### NFR1: Performance

- Tool execution overhead < 10ms
- File operations use streaming for large files
- Pattern matching (glob/grep) is optimized

### NFR2: Security

- No arbitrary code execution outside shell tool
- Path traversal attacks prevented
- Command injection mitigated

### NFR3: Reliability

- Tools handle errors gracefully
- Binary files are detected and handled
- Large outputs are truncated

---

## Technical Design

### Built-in Tool Implementations

#### read_file
```typescript
Parameters:
  - path: string (required) - File path
  - offset?: number - Start line (1-based)
  - limit?: number - Max lines to read

Returns: File contents with line numbers
```

#### write_file
```typescript
Parameters:
  - path: string (required) - File path
  - content: string (required) - Content to write
  - createDirectories?: boolean - Create parent dirs

Returns: Success message with byte count
```

#### shell
```typescript
Parameters:
  - command: string (required) - Command to execute
  - timeout?: number - Timeout in ms (default: 120000)

Returns: stdout/stderr output
```

#### glob
```typescript
Parameters:
  - pattern: string (required) - Glob pattern
  - path?: string - Search directory

Returns: List of matching file paths
```

#### grep
```typescript
Parameters:
  - pattern: string (required) - Regex pattern
  - path?: string - File or directory to search
  - glob?: string - File pattern filter
  - caseInsensitive?: boolean
  - maxResults?: number

Returns: Matching lines with file:line: prefix
```

### Error Handling

```typescript
interface ToolExecutionResult {
  content: string;         // What to show LLM
  displayContent?: string; // What to show user
  isError?: boolean;       // Error flag
  metadata?: Record<string, unknown>;
}
```

- File not found: Return helpful error message
- Permission denied: Return with context
- Timeout: Kill process, return partial output
- Binary file: Return indication, not content

---

## API Reference

### ToolRegistry

```typescript
const registry = new ToolRegistry();

// Register built-in tools
registry.registerAll(createBuiltinTools());

// Register custom tool
registry.register(new MyCustomTool());

// Get tool for execution
const tool = registry.getTool('read_file');
if (tool) {
  const result = tool.validate({ path: '/tmp/test.txt' });
  if (result.valid) {
    const output = await tool.execute({ path: '/tmp/test.txt' });
  }
}
```

### Creating Custom Tools

```typescript
import { BaseTool } from '@beans/core';
import { z } from 'zod';

const MyToolSchema = z.object({
  input: z.string().describe('The input to process'),
});

class MyTool extends BaseTool<z.infer<typeof MyToolSchema>> {
  readonly name = 'my_tool';
  readonly description = 'Does something useful';
  readonly schema = MyToolSchema;

  async execute(params: z.infer<typeof MyToolSchema>): Promise<ToolExecutionResult> {
    // Implementation
    return { content: `Processed: ${params.input}` };
  }
}
```

---

## Testing Strategy

### Unit Tests

- Schema validation for all built-in tools
- Parameter edge cases (empty, special chars)
- Error handling paths

### Integration Tests

- File system operations with temp directories
- Shell command execution
- Glob/grep with real file patterns

### Security Tests

- Path traversal attempts
- Command injection attempts
- Timeout enforcement

---

## Dependencies

- `zod` - Schema validation
- `node:fs/promises` - File operations
- `node:child_process` - Shell execution

---

## Future Enhancements

1. **Edit Tool**: Semantic code editing (search/replace)
2. **Web Search**: Internet search integration
3. **Database Tools**: SQL query execution
4. **API Tools**: HTTP request capabilities
5. **Git Tools**: Version control operations
