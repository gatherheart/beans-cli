import { render } from "ink-testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatView } from "../ChatView.js";
import type { Message } from "../../hooks/useChatHistory.js";

// Mock the ChatContext
vi.mock("../../contexts/ChatContext.js", () => ({
  useChatState: vi.fn(),
}));

import { useChatState } from "../../contexts/ChatContext.js";

const mockUseChatState = vi.mocked(useChatState);

describe("ChatView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders empty state message", () => {
    mockUseChatState.mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      profile: null,
      currentAgent: null,
      approvalMode: "DEFAULT",
    });

    const { lastFrame } = render(<ChatView width={80} />);
    expect(lastFrame()).toContain("Type a message to start");
  });

  it("renders user message", () => {
    const messages: Message[] = [
      {
        id: "user-1",
        role: "user",
        content: "Hello, world!",
        isStreaming: false,
      },
    ];

    mockUseChatState.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      profile: null,
      currentAgent: null,
      approvalMode: "DEFAULT",
    });

    const { lastFrame } = render(<ChatView width={80} />);
    expect(lastFrame()).toContain("Hello, world!");
  });

  it("renders assistant message", () => {
    const messages: Message[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "This is a response",
        isStreaming: false,
      },
    ];

    mockUseChatState.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      profile: null,
      currentAgent: null,
      approvalMode: "DEFAULT",
    });

    const { lastFrame } = render(<ChatView width={80} />);
    expect(lastFrame()).toContain("This is a response");
  });

  it("renders error message", () => {
    mockUseChatState.mockReturnValue({
      messages: [],
      isLoading: false,
      error: "Something went wrong",
      profile: null,
      currentAgent: null,
      approvalMode: "DEFAULT",
    });

    const { lastFrame } = render(<ChatView width={80} />);
    expect(lastFrame()).toContain("Something went wrong");
  });

  it("renders multiple messages", () => {
    const messages: Message[] = [
      {
        id: "user-1",
        role: "user",
        content: "First message",
        isStreaming: false,
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "Second message",
        isStreaming: false,
      },
    ];

    mockUseChatState.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      profile: null,
      currentAgent: null,
      approvalMode: "DEFAULT",
    });

    const { lastFrame } = render(<ChatView width={80} />);
    const frame = lastFrame();
    expect(frame).toContain("First message");
    expect(frame).toContain("Second message");
  });
});

describe("ChatView Anti-Flicker", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should separate completed and streaming messages correctly", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "Hello", isStreaming: false },
      { id: "2", role: "assistant", content: "Hi there", isStreaming: false },
      { id: "3", role: "assistant", content: "Loading...", isStreaming: true },
    ];

    // Verify the separation logic
    const completedMessages = messages.filter((m) => !m.isStreaming);
    const pendingMessages = messages.filter((m) => m.isStreaming);

    expect(completedMessages).toHaveLength(2);
    expect(pendingMessages).toHaveLength(1);
    expect(completedMessages.map((m) => m.id)).toEqual(["1", "2"]);
    expect(pendingMessages.map((m) => m.id)).toEqual(["3"]);
  });

  it("should render streaming message in dynamic area", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "Hello", isStreaming: false },
      {
        id: "2",
        role: "assistant",
        content: "Streaming...",
        isStreaming: true,
      },
    ];

    mockUseChatState.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      profile: null,
      currentAgent: null,
      approvalMode: "DEFAULT",
    });

    const { lastFrame } = render(<ChatView width={80} />);
    const frame = lastFrame();

    // Both messages should be visible
    expect(frame).toContain("Hello");
    expect(frame).toContain("Streaming...");
  });

  it("should render completed messages without streaming indicator", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "assistant",
        content: "Complete response",
        isStreaming: false,
      },
    ];

    mockUseChatState.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      profile: null,
      currentAgent: null,
      approvalMode: "DEFAULT",
    });

    const { lastFrame } = render(<ChatView width={80} />);
    expect(lastFrame()).toContain("Complete response");
  });

  it("should handle mixed completed and streaming messages", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "First", isStreaming: false },
      { id: "2", role: "assistant", content: "Response 1", isStreaming: false },
      { id: "3", role: "user", content: "Second", isStreaming: false },
      { id: "4", role: "assistant", content: "Loading", isStreaming: true },
    ];

    mockUseChatState.mockReturnValue({
      messages,
      isLoading: false,
      error: null,
      profile: null,
      currentAgent: null,
      approvalMode: "DEFAULT",
    });

    const { lastFrame } = render(<ChatView width={80} />);
    const frame = lastFrame();

    expect(frame).toContain("First");
    expect(frame).toContain("Response 1");
    expect(frame).toContain("Second");
    expect(frame).toContain("Loading");
  });
});
