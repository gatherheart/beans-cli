import { render } from "ink-testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LiveStatusBar } from "../LiveStatusBar.js";

vi.mock("../../contexts/ChatContext.js", () => ({
  useChatState: vi.fn(),
}));

import { useChatState } from "../../contexts/ChatContext.js";

const mockUseChatState = vi.mocked(useChatState);

describe("LiveStatusBar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders while a message is active", () => {
    mockUseChatState.mockReturnValue({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "",
          isStreaming: true,
        },
      ],
      isLoading: true,
      error: null,
      profile: null,
      currentAgent: null,
      approvalMode: "DEFAULT",
    });

    const { lastFrame } = render(<LiveStatusBar />);
    expect(lastFrame()).toContain("Thinking");
  });

  it("renders nothing when idle", () => {
    mockUseChatState.mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      profile: null,
      currentAgent: null,
      approvalMode: "DEFAULT",
    });

    const { lastFrame } = render(<LiveStatusBar />);
    expect(lastFrame()).toBe("");
  });
});
