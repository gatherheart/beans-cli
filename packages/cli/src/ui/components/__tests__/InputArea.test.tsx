import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputArea } from '../InputArea.js';

// Create mock functions at module level so we can track calls
const mockSendMessage = vi.fn();
const mockAddSystemMessage = vi.fn();
const mockClearHistory = vi.fn();
const mockGetLLMHistory = vi.fn(() => []);
const mockGetSystemPrompt = vi.fn(() => 'System prompt');

// Mock the ChatContext
vi.mock('../../contexts/ChatContext.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/ChatContext.js')>();
  return {
    ...actual,
    useChatState: () => ({
      messages: [],
      isLoading: false,
      error: null,
      profile: null,
    }),
    useChatActions: () => ({
      sendMessage: mockSendMessage,
      addSystemMessage: mockAddSystemMessage,
      clearHistory: mockClearHistory,
      getLLMHistory: mockGetLLMHistory,
      getSystemPrompt: mockGetSystemPrompt,
    }),
  };
});

// Helper to wait for state updates
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('InputArea', () => {
  const mockOnExit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('static rendering', () => {
    it('renders input prompt', () => {
      const { lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('>');
    });

    it('shows placeholder text when empty', () => {
      const { lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('Type a message');
    });

    it('shows help hint', () => {
      const { lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('/help');
    });

    it('shows submit instruction', () => {
      const { lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('Enter submit');
    });

    it('shows exit instruction', () => {
      const { lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('Ctrl+C');
    });

    it('renders with border', () => {
      const { lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);
      const frame = lastFrame()!;
      expect(frame).toContain('╭');
      expect(frame).toContain('╰');
    });
  });

  describe('keyboard input', () => {
    it('displays typed characters', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('hello');
      await delay(50);

      expect(lastFrame()).toContain('hello');
    });

    it('removes placeholder when typing', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('a');
      await delay(50);

      expect(lastFrame()).not.toContain('Type a message');
    });

    it('handles backspace to delete characters', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('hello');
      await delay(50);
      stdin.write('\x7F'); // Backspace
      await delay(50);

      expect(lastFrame()).toContain('hell');
      expect(lastFrame()).not.toContain('hello');
    });

    it('clears input with Ctrl+U', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('some text');
      await delay(50);
      stdin.write('\x15'); // Ctrl+U
      await delay(50);

      expect(lastFrame()).toContain('Type a message');
    });
  });

  describe('message submission', () => {
    it('sends message on Enter', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('hello world');
      await delay(50);
      stdin.write('\r'); // Enter
      await delay(50);

      expect(mockSendMessage).toHaveBeenCalledWith('hello world');
    });

    it('clears input after submission', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('test message');
      await delay(50);
      stdin.write('\r'); // Enter
      await delay(50);

      // After submission, input is cleared and history hint appears
      expect(lastFrame()).toContain('Press ↑ to edit previous messages');
    });

    it('does not send empty message', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('\r'); // Enter without any text
      await delay(50);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('slash commands', () => {
    it('calls onExit for /exit command', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('/exit');
      await delay(50);
      stdin.write('\r');
      await delay(50);

      expect(mockOnExit).toHaveBeenCalled();
    });

    it('calls onExit for /quit command', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('/quit');
      await delay(50);
      stdin.write('\r');
      await delay(50);

      expect(mockOnExit).toHaveBeenCalled();
    });

    it('calls onExit for /q command', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('/q');
      await delay(50);
      stdin.write('\r');
      await delay(50);

      expect(mockOnExit).toHaveBeenCalled();
    });

    it('shows help for /help command', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('/help');
      await delay(50);
      stdin.write('\r');
      await delay(50);

      expect(mockAddSystemMessage).toHaveBeenCalled();
      const helpText = mockAddSystemMessage.mock.calls[0][0];
      expect(helpText).toContain('Available Commands');
    });

    it('clears history for /clear command', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('/clear');
      await delay(50);
      stdin.write('\r');
      await delay(50);

      expect(mockClearHistory).toHaveBeenCalled();
    });

    it('shows error for unknown command', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('/unknown');
      await delay(50);
      stdin.write('\r');
      await delay(50);

      expect(mockAddSystemMessage).toHaveBeenCalled();
      const errorText = mockAddSystemMessage.mock.calls[0][0];
      expect(errorText).toContain('Unknown command');
    });
  });

  describe('exit handling', () => {
    it('calls onExit on Ctrl+C', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('\x03'); // Ctrl+C
      await delay(50);

      expect(mockOnExit).toHaveBeenCalled();
    });
  });

  describe('cursor navigation', () => {
    it('moves cursor left with left arrow', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('abc');
      await delay(50);
      stdin.write('\x1B[D'); // Left arrow (ANSI escape)
      await delay(50);
      stdin.write('X');
      await delay(50);

      // 'X' should be inserted before 'c'
      expect(lastFrame()).toContain('abXc');
    });

    it('moves cursor right with right arrow', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('abc');
      await delay(50);
      stdin.write('\x1B[D'); // Left arrow
      await delay(50);
      stdin.write('\x1B[D'); // Left arrow again
      await delay(50);
      stdin.write('\x1B[C'); // Right arrow
      await delay(50);
      stdin.write('X');
      await delay(50);

      expect(lastFrame()).toContain('abXc');
    });
  });

  describe('long text handling', () => {
    it('handles long single-line text', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      const longText = 'a'.repeat(100);
      stdin.write(longText);
      await delay(50);

      const frame = lastFrame()!;
      // Should contain at least part of the long text
      expect(frame).toContain('aaaa');
    });

    it('submits long text correctly', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      const longText = 'This is a very long message that exceeds typical line length';
      stdin.write(longText);
      await delay(50);
      stdin.write('\r');
      await delay(50);

      expect(mockSendMessage).toHaveBeenCalledWith(longText);
    });

    it('handles text with special characters', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      const specialText = 'Hello! @#$%^&*() "quotes" and `backticks`';
      stdin.write(specialText);
      await delay(50);

      expect(lastFrame()).toContain('Hello');
      expect(lastFrame()).toContain('quotes');
    });

    it('handles unicode characters', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('Hello 世界 🌍 émojis');
      await delay(50);

      expect(lastFrame()).toContain('Hello');
    });

    it('handles very long text without crashing', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      // 500 characters
      const veryLongText = 'x'.repeat(500);
      stdin.write(veryLongText);
      await delay(100);

      // Should not crash and should render something
      expect(lastFrame()).toBeDefined();
    });

    it('handles rapid typing of long text', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      // Simulate rapid typing
      for (let i = 0; i < 50; i++) {
        stdin.write('a');
      }
      await delay(100);

      const frame = lastFrame()!;
      expect(frame).toContain('aaaa');
    });

    it('handles backspace on long text', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('a'.repeat(50));
      await delay(50);

      // Delete 10 characters
      for (let i = 0; i < 10; i++) {
        stdin.write('\x7F');
      }
      await delay(50);

      // Should still render correctly
      expect(lastFrame()).toBeDefined();
    });

    it('handles Ctrl+U on long text', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('a'.repeat(100));
      await delay(50);
      stdin.write('\x15'); // Ctrl+U
      await delay(50);

      // Should show placeholder again
      expect(lastFrame()).toContain('Type a message');
    });

    it('handles cursor navigation in long text', async () => {
      const { stdin, lastFrame } = render(<InputArea onExit={mockOnExit} width={80} />);

      stdin.write('abcdefghijklmnopqrstuvwxyz');
      await delay(50);

      // Move cursor to beginning (26 left arrows)
      // Note: delays needed because rapid-fire escape sequences in tests
      // don't simulate real terminal behavior properly
      for (let i = 0; i < 26; i++) {
        stdin.write('\x1B[D');
        await delay(10);
      }
      await delay(50);

      // Insert at beginning
      stdin.write('START');
      await delay(50);

      expect(lastFrame()).toContain('STARTabc');
    });

    it('handles mixed content with code snippets', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      const codeText = 'function test() { return "hello"; }';
      stdin.write(codeText);
      await delay(50);
      stdin.write('\r');
      await delay(50);

      expect(mockSendMessage).toHaveBeenCalledWith(codeText);
    });

    it('handles multi-paragraph text simulation', async () => {
      const { stdin } = render(<InputArea onExit={mockOnExit} width={80} />);

      // Simulate typing a long paragraph
      const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
      stdin.write(paragraph);
      await delay(50);
      stdin.write('\r');
      await delay(50);

      expect(mockSendMessage).toHaveBeenCalledWith(paragraph);
    });
  });
});
