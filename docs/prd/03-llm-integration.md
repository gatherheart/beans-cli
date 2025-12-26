# PRD: LLM Integration

## Overview

The LLM Integration layer provides a unified interface for interacting with various Large Language Model providers. This abstraction allows the agent to work with different models (OpenAI, Anthropic, Google, Ollama) through a consistent API.

## Problem Statement

The AI ecosystem has multiple LLM providers, each with:
- Different API formats and authentication methods
- Varying tool/function calling schemas
- Different streaming implementations
- Unique features (e.g., thinking tokens, caching)

Users need flexibility to choose providers based on cost, performance, and features.

## Goals

- **G1**: Unified interface across all LLM providers
- **G2**: Support streaming responses for real-time feedback
- **G3**: Handle tool/function calling consistently
- **G4**: Track token usage for cost management
- **G5**: Easy addition of new providers

## Non-Goals

- Fine-tuning or model training
- Embeddings API (separate concern)
- Image generation (separate concern)

---

## Functional Requirements

### FR1: LLM Client Interface

**Description**: Abstract interface for all LLM operations.

**Specification**:
```typescript
interface LLMClient {
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream?(request: ChatRequest): AsyncGenerator<ChatStreamChunk>;
}

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

interface ChatResponse {
  content: string | null;
  toolCalls?: ToolCall[];
  thinking?: string;
  usage?: TokenUsage;
  model: string;
  finishReason: FinishReason;
}
```

**Acceptance Criteria**:
- [ ] All providers implement LLMClient
- [ ] Chat returns complete response
- [ ] Tool calls are parsed correctly
- [ ] Token usage is reported

### FR2: Provider Factory

**Description**: Factory function to create provider-specific clients.

**Specification**:
```typescript
function createLLMClient(
  provider: LLMProvider,
  config: ProviderConfig
): LLMClient;

type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';

interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  organizationId?: string;
  defaultModel?: string;
  timeout?: number;
  headers?: Record<string, string>;
}
```

**Acceptance Criteria**:
- [ ] Factory creates correct client type
- [ ] Config is validated
- [ ] Unknown providers throw errors

### FR3: OpenAI Provider

**Description**: Client for OpenAI API (and compatible endpoints).

**Supported Models**:
- gpt-4o, gpt-4o-mini
- gpt-4-turbo, gpt-4
- gpt-3.5-turbo

**Features**:
- Function calling with tools
- Streaming with SSE
- System messages
- Token usage reporting

**Acceptance Criteria**:
- [ ] Authentication with API key
- [ ] Tool calls work correctly
- [ ] Streaming produces chunks
- [ ] Errors are properly wrapped

### FR4: Anthropic Provider

**Description**: Client for Anthropic Claude API.

**Supported Models**:
- claude-3-opus
- claude-3-sonnet
- claude-3-haiku
- claude-3-5-sonnet

**Features**:
- Tool use with input_schema
- Extended thinking (if available)
- System prompts
- Token counting

**Acceptance Criteria**:
- [ ] Authentication with x-api-key header
- [ ] Tool use mapping works
- [ ] Thinking tokens captured
- [ ] Message format conversion

### FR5: Google Gemini Provider

**Description**: Client for Google Generative AI API.

**Supported Models**:
- gemini-pro
- gemini-1.5-pro
- gemini-1.5-flash

**Features**:
- Function declarations
- Safety settings
- Multi-modal (future)

**Acceptance Criteria**:
- [ ] API key authentication
- [ ] Function calling works
- [ ] Response format parsing
- [ ] Error handling

### FR6: Ollama Provider

**Description**: Client for local Ollama server.

**Supported Models**:
- llama3, llama3.1
- codellama
- mistral
- Any model available in Ollama

**Features**:
- Local execution (no API key)
- Tool support (model dependent)
- Custom model paths

**Acceptance Criteria**:
- [ ] Works with localhost
- [ ] Custom URLs supported
- [ ] Tool format matches Ollama spec
- [ ] Handles missing Ollama gracefully

### FR7: Token Usage Tracking

**Description**: Track token consumption for cost management.

**Specification**:
```typescript
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}
```

**Acceptance Criteria**:
- [ ] Usage included in all responses
- [ ] Accurate for each provider
- [ ] Session totals can be computed

### FR8: Streaming Support

**Description**: Stream responses for real-time UI updates.

**Specification**:
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

**Acceptance Criteria**:
- [ ] Chunks emit incrementally
- [ ] Final chunk has done=true
- [ ] Tool calls assembled from deltas
- [ ] Async generator pattern used

---

## Non-Functional Requirements

### NFR1: Performance

- Connection pooling for HTTP
- Reasonable timeouts (60s default)
- Efficient JSON parsing

### NFR2: Reliability

- Retry with exponential backoff
- Graceful degradation on errors
- Circuit breaker for failing endpoints

### NFR3: Security

- API keys never logged
- Secure storage recommended
- HTTPS required (except localhost)

---

## Technical Design

### Message Format Conversion

Each provider has different message format requirements:

```
OpenAI:     { role: 'user'|'assistant'|'system'|'tool', content: string }
Anthropic:  { role: 'user'|'assistant', content: string } (system separate)
Google:     { role: 'user'|'model', parts: [{ text: string }] }
Ollama:     { role: 'user'|'assistant'|'system', content: string }
```

Conversion happens at the provider layer, invisible to callers.

### Tool Call Format Conversion

```
OpenAI:     tool_calls: [{ id, type: 'function', function: { name, arguments } }]
Anthropic:  content: [{ type: 'tool_use', id, name, input }]
Google:     candidates[0].content.parts: [{ functionCall: { name, args } }]
Ollama:     message.tool_calls: [{ function: { name, arguments } }]
```

### Error Handling

```typescript
class LLMError extends Error {
  constructor(
    message: string,
    public provider: LLMProvider,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
  }
}
```

Error types:
- Authentication errors (401/403)
- Rate limits (429) - retryable
- Server errors (5xx) - retryable
- Invalid request (400)
- Content filtered

---

## API Reference

### Creating a Client

```typescript
import { createLLMClient } from '@beans/core';

// OpenAI
const openai = createLLMClient('openai', {
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: 'gpt-4o',
});

// Anthropic
const anthropic = createLLMClient('anthropic', {
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-3-5-sonnet-20241022',
});

// Local Ollama
const ollama = createLLMClient('ollama', {
  baseUrl: 'http://localhost:11434',
  defaultModel: 'llama3.1',
});
```

### Making Requests

```typescript
const response = await client.chat({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
  systemPrompt: 'You are a helpful assistant.',
  tools: [...],
  temperature: 0.7,
  maxTokens: 4096,
});

console.log(response.content);
console.log(`Tokens used: ${response.usage?.totalTokens}`);
```

---

## Testing Strategy

### Unit Tests

- Message format conversion
- Tool call parsing
- Error wrapping
- Config validation

### Integration Tests

- Real API calls (limited, rate-limited)
- Mock server responses
- Streaming assembly

### Provider-Specific Tests

- OpenAI: Function calling, streaming
- Anthropic: Tool use, thinking
- Google: Safety filters
- Ollama: Local server connection

---

## Dependencies

- `node:fetch` - HTTP client
- No provider-specific SDKs (reduce bundle)

---

## Future Enhancements

1. **Prompt Caching**: Leverage provider caching features
2. **Multi-Modal**: Image input support
3. **Embeddings**: Text embedding for RAG
4. **Fine-Tuned Models**: Custom model support
5. **Load Balancing**: Multiple API keys/endpoints
