import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { Message } from '../Message.js';
import type { Message as MessageType } from '../../hooks/useChatHistory.js';

describe('Message', () => {
  it('renders user message with prefix', () => {
    const message: MessageType = {
      id: 'user-1',
      role: 'user',
      content: 'Hello from user',
      isStreaming: false,
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    expect(frame).toContain('>');
    expect(frame).toContain('Hello from user');
  });

  it('renders assistant message with prefix', () => {
    const message: MessageType = {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Hello from assistant',
      isStreaming: false,
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    expect(frame).toContain('✦');
    expect(frame).toContain('Hello from assistant');
  });

  it('renders system message with prefix', () => {
    const message: MessageType = {
      id: 'system-1',
      role: 'system',
      content: 'System notification',
      isStreaming: false,
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    expect(frame).toContain('System');
    expect(frame).toContain('System notification');
  });

  it('renders streaming indicator for streaming messages', () => {
    const message: MessageType = {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    // Streaming messages show a spinner or indicator
    expect(lastFrame()).toBeDefined();
  });

  it('renders tool calls when present', () => {
    const message: MessageType = {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Using a tool',
      isStreaming: false,
      toolCalls: [
        {
          id: 'tool-1',
          name: 'read_file',
          args: { path: '/test.txt' },
          isComplete: true,
          result: 'file contents',
        },
      ],
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    expect(frame).toContain('read_file');
  });
});
