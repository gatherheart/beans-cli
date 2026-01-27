import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatView } from '../ChatView.js';
import type { Message } from '../../hooks/useChatHistory.js';

// Mock the ChatContext
vi.mock('../../contexts/ChatContext.js', () => ({
  useChatState: vi.fn(),
}));

import { useChatState } from '../../contexts/ChatContext.js';

const mockUseChatState = vi.mocked(useChatState);

describe('ChatView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders empty state message', () => {
    mockUseChatState.mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      profile: null,
    });

    const { lastFrame } = render(<ChatView width={80} />);
    expect(lastFrame()).toContain('Type a message to start');
  });

  it('renders user message', () => {
    const messages: Message[] = [
      {
        id: 'user-1',
        role: 'user',
        content: 'Hello, world!',
        isStreaming: false,
      },
    ];

    mockUseChatState.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      profile: null,
    });

    const { lastFrame } = render(<ChatView width={80} />);
    expect(lastFrame()).toContain('Hello, world!');
  });

  it('renders assistant message', () => {
    const messages: Message[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'This is a response',
        isStreaming: false,
      },
    ];

    mockUseChatState.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      profile: null,
    });

    const { lastFrame } = render(<ChatView width={80} />);
    expect(lastFrame()).toContain('This is a response');
  });

  it('renders error message', () => {
    mockUseChatState.mockReturnValue({
      messages: [],
      isLoading: false,
      error: 'Something went wrong',
      profile: null,
    });

    const { lastFrame } = render(<ChatView width={80} />);
    expect(lastFrame()).toContain('Something went wrong');
  });

  it('renders multiple messages', () => {
    const messages: Message[] = [
      {
        id: 'user-1',
        role: 'user',
        content: 'First message',
        isStreaming: false,
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Second message',
        isStreaming: false,
      },
    ];

    mockUseChatState.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      profile: null,
    });

    const { lastFrame } = render(<ChatView width={80} />);
    const frame = lastFrame();
    expect(frame).toContain('First message');
    expect(frame).toContain('Second message');
  });
});
