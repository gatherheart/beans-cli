/**
 * Mock LLM client for UI testing
 *
 * Supports multiple test scenarios via constructor parameter:
 * - 'basic': Default markdown response
 * - 'long-content': Tests scrolling and large output
 * - 'rapid-stream': Tests fast streaming without flickering
 * - 'tool-calls': Tests tool call UI display
 * - 'empty-response': Tests empty/minimal response handling
 * - 'multi-turn': Tests conversation context preservation
 * - 'slow-stream': Tests slow streaming with input visibility
 * - 'error': Tests error handling display
 */

import type {
  LLMClient,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
} from '../types.js';
import type { ToolCall } from '../../agents/types.js';

/**
 * Available UI test scenarios
 */
export type UITestScenario =
  | 'basic'
  | 'long-content'
  | 'rapid-stream'
  | 'tool-calls'
  | 'empty-response'
  | 'multi-turn'
  | 'slow-stream'
  | 'error';

/**
 * Scenario definitions with content and behavior
 */
interface ScenarioConfig {
  content: string;
  streamDelay: number;
  toolCalls?: ToolCall[];
  shouldError?: boolean;
}

const SCENARIOS: Record<UITestScenario, ScenarioConfig> = {
  basic: {
    content: `This is a **mock response** for UI testing.

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
3. Lists and headers`,
    streamDelay: 20,
  },

  'long-content': {
    content: `# Long Content Test

This scenario tests scrolling behavior and large output handling.

## Section 1: Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

## Section 2: Code Examples

Here are multiple code blocks to test rendering:

\`\`\`typescript
// Example 1: Complex function
async function processData(input: string[]): Promise<Result[]> {
  const results: Result[] = [];
  for (const item of input) {
    const processed = await transform(item);
    results.push(processed);
  }
  return results;
}
\`\`\`

\`\`\`python
# Example 2: Python equivalent
async def process_data(input_list: list[str]) -> list[Result]:
    results = []
    for item in input_list:
        processed = await transform(item)
        results.append(processed)
    return results
\`\`\`

## Section 3: Tables and Lists

| Feature | Status | Notes |
|---------|--------|-------|
| Scrolling | ✅ | Works correctly |
| Wrapping | ✅ | Text wraps properly |
| Overflow | ⚠️ | Needs testing |

### Nested Lists

1. First level item
   - Second level bullet
   - Another bullet
     - Third level
2. Another first level
   1. Numbered sub-item
   2. Another numbered

## Section 4: More Content

> This is a blockquote that tests how quoted text is displayed.
> It can span multiple lines and should maintain proper formatting.

### Inline Elements

Testing \`inline code\`, **bold text**, *italic text*, and ***bold italic***.

## Section 5: Final Section

This is the end of the long content test. If you can see this, scrolling works correctly.

---

**End of test content.**`,
    streamDelay: 5,
  },

  'rapid-stream': {
    content: `# Rapid Streaming Test

This content streams very quickly to test for UI flickering issues.

The input area should remain visible and stable during rapid updates.

- Item 1: Testing rapid updates
- Item 2: No flickering should occur
- Item 3: Input should not disappear
- Item 4: Cursor should remain visible
- Item 5: Scrolling should be smooth

\`\`\`javascript
// This code block tests syntax highlighting during rapid streaming
const items = ['a', 'b', 'c', 'd', 'e'];
items.forEach((item, index) => {
  console.log(\`Item \${index}: \${item}\`);
});
\`\`\`

End of rapid streaming test.`,
    streamDelay: 1, // Very fast streaming
  },

  'tool-calls': {
    content: `I'll help you with that. Let me use some tools.`,
    streamDelay: 20,
    toolCalls: [
      {
        id: 'call_read_1',
        name: 'read_file',
        arguments: { path: '/path/to/file.ts' },
      },
      {
        id: 'call_glob_1',
        name: 'glob',
        arguments: { pattern: '**/*.ts' },
      },
      {
        id: 'call_shell_1',
        name: 'shell',
        arguments: { command: 'npm test' },
      },
    ],
  },

  'empty-response': {
    content: '',
    streamDelay: 50,
  },

  'multi-turn': {
    content: `I received your message. This is turn {{turn}} of our conversation.

Previous messages in context:
{{history}}

The conversation history is preserved correctly.`,
    streamDelay: 15,
  },

  'slow-stream': {
    content: `# Slow Streaming Test

This... content... streams... slowly...

Each word appears with a delay.

You should be able to type in the input area while this streams.

The input should NOT disappear.

Testing input visibility during slow responses.

End of slow streaming test.`,
    streamDelay: 200, // Slow streaming to test input visibility
  },

  error: {
    content: '',
    streamDelay: 0,
    shouldError: true,
  },
};

export class MockLLMClient implements LLMClient {
  private scenario: UITestScenario;
  private turnCount = 0;
  // Separate counter for streaming turns (used by multi-turn scenario)
  // This avoids counting internal analysis calls that use chat() instead of chatStream()
  private streamTurnCount = 0;

  constructor(scenario: UITestScenario = 'basic') {
    this.scenario = scenario;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.turnCount++;
    // Only count as a user-facing turn if tools are provided (agent execution)
    // Analysis calls don't have tools and shouldn't affect turn numbering
    const hasTools = request.tools && request.tools.length > 0;
    if (hasTools) {
      this.streamTurnCount++;
    }
    const config = SCENARIOS[this.scenario];

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    if (config.shouldError) {
      throw new Error('Mock error for UI testing');
    }

    let content = config.content;

    // Handle multi-turn scenario
    // Use streamTurnCount to avoid counting internal analysis calls
    if (this.scenario === 'multi-turn') {
      const historyPreview = request.messages
        .slice(-3)
        .map(m => `- ${m.role}: ${m.content?.slice(0, 50)}...`)
        .join('\n');
      content = content
        .replace('{{turn}}', String(this.streamTurnCount))
        .replace('{{history}}', historyPreview || '(no previous messages)');
    }

    return {
      content,
      toolCalls: config.toolCalls,
      model: 'mock',
      finishReason: config.toolCalls ? 'tool_calls' : 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: content.split(' ').length,
        totalTokens: 10 + content.split(' ').length,
      },
    };
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<ChatStreamChunk, void, unknown> {
    this.turnCount++;
    this.streamTurnCount++;
    const config = SCENARIOS[this.scenario];

    if (config.shouldError) {
      throw new Error('Mock streaming error for UI testing');
    }

    let content = config.content;

    // Handle multi-turn scenario
    // Use streamTurnCount to avoid counting internal analysis chat() calls
    if (this.scenario === 'multi-turn') {
      const historyPreview = request.messages
        .slice(-3)
        .map(m => `- ${m.role}: ${m.content?.slice(0, 50)}...`)
        .join('\n');
      content = content
        .replace('{{turn}}', String(this.streamTurnCount))
        .replace('{{history}}', historyPreview || '(no previous messages)');
    }

    // Stream tool calls first if present
    if (config.toolCalls) {
      for (const toolCall of config.toolCalls) {
        await new Promise(resolve => setTimeout(resolve, 50));
        yield {
          toolCallDelta: toolCall,
          done: false,
        };
      }
    }

    // Stream content word by word
    if (content) {
      const words = content.split(' ');
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, config.streamDelay));
        yield {
          content: (i === 0 ? '' : ' ') + words[i],
          done: false,
        };
      }
    }

    yield {
      done: true,
      finishReason: config.toolCalls ? 'tool_calls' : 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: content.split(' ').length,
        totalTokens: 10 + content.split(' ').length,
      },
    };
  }

  /**
   * Get current scenario
   */
  getScenario(): UITestScenario {
    return this.scenario;
  }

  /**
   * Reset turn count (useful for testing)
   */
  resetTurnCount(): void {
    this.turnCount = 0;
    this.streamTurnCount = 0;
  }
}
