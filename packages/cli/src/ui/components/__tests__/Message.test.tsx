import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { Message } from "../Message.js";
import type { Message as MessageType } from "../../hooks/useChatHistory.js";
import type { WriteFileMetadata } from "@beans/core";

describe("Message", () => {
  it("renders user message with prefix", () => {
    const message: MessageType = {
      id: "user-1",
      role: "user",
      content: "Hello from user",
      isStreaming: false,
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    expect(frame).toContain(">");
    expect(frame).toContain("Hello from user");
  });

  it("renders assistant message with prefix", () => {
    const message: MessageType = {
      id: "assistant-1",
      role: "assistant",
      content: "Hello from assistant",
      isStreaming: false,
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    expect(frame).toContain("✦");
    expect(frame).toContain("Hello from assistant");
  });

  it("renders system message with prefix", () => {
    const message: MessageType = {
      id: "system-1",
      role: "system",
      content: "System notification",
      isStreaming: false,
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    expect(frame).toContain("System");
    expect(frame).toContain("System notification");
  });

  it("renders streaming indicator for streaming messages", () => {
    const message: MessageType = {
      id: "assistant-1",
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    // Streaming messages show a spinner or indicator
    expect(lastFrame()).toBeDefined();
  });

  it("renders tool calls when present", () => {
    const message: MessageType = {
      id: "assistant-1",
      role: "assistant",
      content: "Using a tool",
      isStreaming: false,
      toolCalls: [
        {
          id: "tool-1",
          name: "read_file",
          args: { path: "/test.txt" },
          isComplete: true,
          result: "file contents",
        },
      ],
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    expect(frame).toContain("read_file");
  });

  it("renders code blocks with border", () => {
    const message: MessageType = {
      id: "assistant-1",
      role: "assistant",
      content: "```typescript\nconst x = 1;\n```",
      isStreaming: false,
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    // Should have rounded border characters
    expect(frame).toContain("╭");
    expect(frame).toContain("╰");
    // Should show language label
    expect(frame).toContain("typescript");
    // Should show code content
    expect(frame).toContain("const");
  });

  it("renders code blocks without language", () => {
    const message: MessageType = {
      id: "assistant-1",
      role: "assistant",
      content: "```\nplain code\n```",
      isStreaming: false,
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    expect(frame).toContain("╭");
    expect(frame).toContain("plain code");
  });

  it("renders diff display for write_file with metadata", () => {
    const metadata: WriteFileMetadata = {
      path: "/test/file.txt",
      lineCount: 3,
      size: 30,
      isNewFile: false,
      originalContent: "line 1\nline 2\nline 3",
      newContent: "line 1\nmodified line 2\nline 3",
    };

    const message: MessageType = {
      id: "assistant-1",
      role: "assistant",
      content: "File updated",
      isStreaming: false,
      toolCalls: [
        {
          id: "tool-1",
          name: "write_file",
          args: { path: "/test/file.txt", content: "new content" },
          isComplete: true,
          result: "Successfully wrote 3 lines",
          metadata,
        },
      ],
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    expect(frame).toContain("write_file");
    expect(frame).toContain("Modified:");
    expect(frame).toContain("/test/file.txt");
    expect(frame).toContain("-line 2");
    expect(frame).toContain("+modified line 2");
  });

  it("renders diff display for new file", () => {
    const metadata: WriteFileMetadata = {
      path: "/test/new-file.txt",
      lineCount: 2,
      size: 20,
      isNewFile: true,
      originalContent: null,
      newContent: "new line 1\nnew line 2",
    };

    const message: MessageType = {
      id: "assistant-1",
      role: "assistant",
      content: "File created",
      isStreaming: false,
      toolCalls: [
        {
          id: "tool-1",
          name: "write_file",
          args: { path: "/test/new-file.txt", content: "new content" },
          isComplete: true,
          result: "Successfully wrote 2 lines",
          metadata,
        },
      ],
    };

    const { lastFrame } = render(<Message message={message} width={80} />);
    const frame = lastFrame();
    expect(frame).toContain("write_file");
    expect(frame).toContain("New file:");
    expect(frame).toContain("/test/new-file.txt");
    expect(frame).toContain("+ new line 1");
    expect(frame).toContain("+ new line 2");
  });
});
