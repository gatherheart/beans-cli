# LLM Interface Specification

## Overview

This document defines the request/response format for LLM interactions in the Beans Agent framework. The interface is designed to be provider-agnostic while supporting advanced features like tool calling and streaming.

## Source Files

- Types: `packages/core/src/llm/types.ts`
- Client Factory: `packages/core/src/llm/client.ts`
- Providers: `packages/core/src/llm/providers/`

---

## Chat Request

The `ChatRequest` interface defines what is sent to the LLM.

### Interface Definition

```typescript
interface ChatRequest {
  model: string;
  messages: Message[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | `string` | **Yes** | Model identifier (e.g., `gemini-2.0-flash-exp`, `llama3.2`) |
| `messages` | `Message[]` | **Yes** | Conversation history |
| `systemPrompt` | `string` | No | System-level instructions for the model |
| `tools` | `ToolDefinition[]` | No | Available tools for function calling |
| `temperature` | `number` | No | Randomness (0-2, default: 0.7) |
| `maxTokens` | `number` | No | Maximum response tokens |
| `topP` | `number` | No | Nucleus sampling parameter |
| `stopSequences` | `string[]` | No | Sequences that stop generation |

### Example Request

```typescript
const request: ChatRequest = {
  model: 'gemini-2.0-flash-exp',
  messages: [
    { role: 'user', content: 'What files are in the current directory?' }
  ],
  systemPrompt: 'You are a helpful assistant with access to file system tools.',
  tools: [
    {
      name: 'shell',
      description: 'Execute a shell command',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to execute' }
        },
        required: ['command']
      }
    }
  ],
  temperature: 0.7,
  maxTokens: 4096
};
```

---

## Chat Response

The `ChatResponse` interface defines what is returned from the LLM.

### Interface Definition

```typescript
interface ChatResponse {
  content: string | null;
  toolCalls?: ToolCall[];
  thinking?: string;
  usage?: TokenUsage;
  model: string;
  finishReason: FinishReason;
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | `string \| null` | **Yes** | Text response (null if only tool calls) |
| `toolCalls` | `ToolCall[]` | No | Tool invocations requested by the model |
| `thinking` | `string` | No | Reasoning/thinking content (supported models only) |
| `usage` | `TokenUsage` | No | Token consumption statistics |
| `model` | `string` | **Yes** | Model that generated the response |
| `finishReason` | `FinishReason` | **Yes** | Why generation stopped |

### Finish Reasons

```typescript
type FinishReason =
  | 'stop'           // Normal completion
  | 'length'         // Hit max tokens
  | 'tool_calls'     // Model requested tool execution
  | 'content_filter' // Blocked by safety filters
  | 'error';         // Error occurred
```

### Example Response (Text Only)

```typescript
const response: ChatResponse = {
  content: 'The current directory contains the following files:\n- package.json\n- README.md',
  model: 'gemini-2.0-flash-exp',
  finishReason: 'stop',
  usage: {
    promptTokens: 150,
    completionTokens: 45,
    totalTokens: 195
  }
};
```

### Example Response (With Tool Calls)

```typescript
const response: ChatResponse = {
  content: null,
  toolCalls: [
    {
      id: 'call_abc123',
      name: 'shell',
      arguments: { command: 'ls -la' }
    }
  ],
  model: 'gemini-2.0-flash-exp',
  finishReason: 'tool_calls'
};
```

---

## Message Types

Messages represent the conversation history.

### Interface Definition

```typescript
interface Message {
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
```

### Role Types

| Role | Description | Contains |
|------|-------------|----------|
| `user` | Human input | `content` |
| `assistant` | Model output | `content` and/or `toolCalls` |
| `system` | System instructions | `content` (usually in `systemPrompt` instead) |
| `tool` | Tool execution results | `toolResults` |

### Example Conversation

```typescript
const messages: Message[] = [
  // User asks a question
  { role: 'user', content: 'List the files in src/' },

  // Assistant requests tool
  {
    role: 'assistant',
    content: '',
    toolCalls: [
      { id: 'call_1', name: 'shell', arguments: { command: 'ls src/' } }
    ]
  },

  // Tool result
  {
    role: 'tool',
    content: '',
    toolResults: [
      { toolCallId: 'call_1', content: 'index.ts\nutils.ts\nconfig.ts' }
    ]
  },

  // Assistant final response
  {
    role: 'assistant',
    content: 'The src/ directory contains:\n- index.ts\n- utils.ts\n- config.ts'
  }
];
```

---

## Tool Definition

Tools enable the model to perform actions.

### Interface Definition

```typescript
interface ToolDefinition {
  name: string;
  displayName?: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterDefinition>;
    required?: string[];
  };
}

interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: ParameterDefinition;
  properties?: Record<string, ParameterDefinition>;
  default?: unknown;
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | **Yes** | Unique tool identifier |
| `displayName` | `string` | No | Human-readable name |
| `description` | `string` | **Yes** | What the tool does (for model) |
| `parameters` | `object` | **Yes** | JSON Schema for parameters |
| `parameters.type` | `'object'` | **Yes** | Always 'object' |
| `parameters.properties` | `Record` | **Yes** | Parameter definitions |
| `parameters.required` | `string[]` | No | Required parameter names |

### Example Tool Definition

```typescript
const readFileTool: ToolDefinition = {
  name: 'read_file',
  displayName: 'Read File',
  description: 'Read the contents of a file at the specified path',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The file path to read'
      },
      encoding: {
        type: 'string',
        description: 'File encoding',
        enum: ['utf-8', 'ascii', 'base64'],
        default: 'utf-8'
      }
    },
    required: ['path']
  }
};
```

---

## Tool Call and Result

### Tool Call (from model)

```typescript
interface ToolCall {
  id: string;                        // Unique call ID
  name: string;                      // Tool name to invoke
  arguments: Record<string, unknown>; // Parameters for the tool
}
```

### Tool Result (from execution)

```typescript
interface ToolResult {
  toolCallId: string;  // Matches ToolCall.id
  content: string;     // Result content for LLM
  error?: string;      // Error message if failed
}
```

### Example Flow

```typescript
// 1. Model requests tool call
const toolCall: ToolCall = {
  id: 'call_xyz789',
  name: 'read_file',
  arguments: { path: './package.json' }
};

// 2. Tool execution returns result
const toolResult: ToolResult = {
  toolCallId: 'call_xyz789',
  content: '{"name": "@beans/agent", "version": "0.1.0"}'
};

// 3. Result sent back to model in message
const message: Message = {
  role: 'tool',
  content: '',
  toolResults: [toolResult]
};
```

---

## Streaming Interface

For real-time response streaming.

### Interface Definition

```typescript
interface ChatStreamChunk {
  content?: string;
  thinking?: string;
  toolCallDelta?: Partial<ToolCall>;
  done: boolean;
  finishReason?: FinishReason;
  usage?: TokenUsage;
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | Content delta (append to previous) |
| `thinking` | `string` | Thinking delta (supported models) |
| `toolCallDelta` | `Partial<ToolCall>` | Partial tool call data |
| `done` | `boolean` | Whether this is the final chunk |
| `finishReason` | `FinishReason` | Present on final chunk |
| `usage` | `TokenUsage` | Present on final chunk |

### Usage Example

```typescript
async function streamResponse(client: LLMClient, request: ChatRequest) {
  const stream = client.chatStream!(request);
  let fullContent = '';

  for await (const chunk of stream) {
    if (chunk.content) {
      fullContent += chunk.content;
      process.stdout.write(chunk.content);
    }

    if (chunk.done) {
      console.log('\nFinished:', chunk.finishReason);
      console.log('Usage:', chunk.usage);
    }
  }

  return fullContent;
}
```

---

## Token Usage

Tracks token consumption for cost monitoring.

```typescript
interface TokenUsage {
  promptTokens: number;      // Tokens in the prompt
  completionTokens: number;  // Tokens in the response
  totalTokens: number;       // Total tokens used
  cachedTokens?: number;     // Cached tokens (provider-specific)
}
```

---

## LLM Client Interface

The unified client interface for all providers.

```typescript
interface LLMClient {
  // Required: Send chat request
  chat(request: ChatRequest): Promise<ChatResponse>;

  // Optional: Stream responses
  chatStream?(request: ChatRequest): AsyncGenerator<ChatStreamChunk, void, unknown>;

  // Optional: List available models
  listModels?(): Promise<ModelInfo[]>;
}
```

### Supported Providers

| Provider | ID | Features |
|----------|-----|----------|
| Google (Gemini) | `google` | chat, chatStream, listModels, tools |
| Ollama | `ollama` | chat, chatStream, listModels, tools |

---

## Provider Configuration

```typescript
interface ProviderConfig {
  apiKey?: string;           // API key or auth token
  baseUrl?: string;          // Base URL for API
  organizationId?: string;   // Organization ID (OpenAI)
  defaultModel?: string;     // Default model to use
  timeout?: number;          // Request timeout in ms
  headers?: Record<string, string>; // Custom headers
}
```

---

## Not Yet Implemented

The following features are defined but not yet implemented:

| Feature | Status | Notes |
|---------|--------|-------|
| `thinkingBudget` | Planned | For models with reasoning capabilities |
| OpenAI Provider | Planned | Need to add `llm/providers/openai.ts` |
| Anthropic Provider | Planned | Need to add `llm/providers/anthropic.ts` |
| Response caching | Planned | Cache repeated identical requests |
| Rate limiting | Planned | Handle provider rate limits gracefully |

---

## Error Handling

Errors should be caught and handled appropriately:

```typescript
try {
  const response = await client.chat(request);
  if (response.finishReason === 'error') {
    console.error('LLM returned error');
  }
} catch (error) {
  if (error instanceof LLMError) {
    console.error('LLM Error:', error.message);
  }
  throw error;
}
```

---

## Best Practices

1. **System Prompt**: Pass via `systemPrompt` field, not as a message
2. **Tool Results**: Always match `toolCallId` with the original `ToolCall.id`
3. **Streaming**: Prefer streaming for interactive applications
4. **Token Limits**: Monitor `usage` to stay within budget
5. **Error Handling**: Check `finishReason` and handle non-'stop' cases
