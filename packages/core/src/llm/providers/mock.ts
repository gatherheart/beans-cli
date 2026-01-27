/**
 * Mock LLM client for UI testing
 */

import type {
  LLMClient,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
} from '../types.js';

const MOCK_RESPONSE = `This is a **mock response** for UI testing.

## Your Message
The message was received successfully.

## Code Example
\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

This tests markdown rendering:
1. **Bold** and *italic* text
2. Code blocks
3. Lists and headers`;

export class MockLLMClient implements LLMClient {
  async chat(_request: ChatRequest): Promise<ChatResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      content: MOCK_RESPONSE,
      model: 'mock',
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 50,
        totalTokens: 60,
      },
    };
  }

  async *chatStream(_request: ChatRequest): AsyncGenerator<ChatStreamChunk, void, unknown> {
    // Simulate streaming by yielding chunks
    const words = MOCK_RESPONSE.split(' ');
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
      yield {
        content: (i === 0 ? '' : ' ') + words[i],
        done: false,
      };
    }

    yield {
      done: true,
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 50,
        totalTokens: 60,
      },
    };
  }
}
