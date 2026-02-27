import { describe, it, expect, beforeEach } from "vitest";
import {
  LoopDetector,
  createLoopDetector,
  DEFAULT_LOOP_CONFIG,
} from "../../../packages/core/src/agents/loop-detector.js";
import type { ToolCall } from "../../../packages/core/src/agents/types.js";

function createToolCall(
  name: string,
  args: Record<string, unknown> = {},
): ToolCall {
  return {
    id: `call-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    arguments: args,
  };
}

describe("LoopDetector", () => {
  let detector: LoopDetector;

  beforeEach(() => {
    detector = new LoopDetector();
  });

  describe("constructor", () => {
    it("should use default config when not provided", () => {
      const d = new LoopDetector();
      expect(d).toBeDefined();
    });

    it("should merge custom config with defaults", () => {
      const d = new LoopDetector({ warningThreshold: 5 });
      expect(d).toBeDefined();
    });
  });

  describe("check - no loop", () => {
    it("should not detect loop for single call", () => {
      const result = detector.check(
        createToolCall("read_file", { path: "/a" }),
        1,
      );
      expect(result.isLoop).toBe(false);
      expect(result.shouldStop).toBe(false);
      expect(result.shouldWarn).toBe(false);
    });

    it("should not detect loop for different calls", () => {
      detector.check(createToolCall("read_file", { path: "/a" }), 1);
      detector.check(createToolCall("write_file", { path: "/b" }), 1);
      const result = detector.check(
        createToolCall("glob", { pattern: "*.ts" }),
        1,
      );

      expect(result.isLoop).toBe(false);
      expect(result.shouldStop).toBe(false);
    });

    it("should not detect loop for same tool with different args", () => {
      detector.check(createToolCall("read_file", { path: "/a" }), 1);
      detector.check(createToolCall("read_file", { path: "/b" }), 2);
      const result = detector.check(
        createToolCall("read_file", { path: "/c" }),
        3,
      );

      expect(result.isLoop).toBe(false);
    });
  });

  describe("check - exact repeat detection", () => {
    it("should detect exact repeats at warning threshold", () => {
      detector.check(createToolCall("read_file", { path: "/same" }), 1);
      const result = detector.check(
        createToolCall("read_file", { path: "/same" }),
        2,
      );

      expect(result.isLoop).toBe(true);
      expect(result.shouldWarn).toBe(true);
      expect(result.shouldStop).toBe(false);
    });

    it("should detect exact repeats at stop threshold", () => {
      detector.check(createToolCall("read_file", { path: "/same" }), 1);
      detector.check(createToolCall("read_file", { path: "/same" }), 2);
      const result = detector.check(
        createToolCall("read_file", { path: "/same" }),
        3,
      );

      expect(result.isLoop).toBe(true);
      expect(result.shouldStop).toBe(true);
    });

    it("should emit warning only once", () => {
      detector.check(createToolCall("read_file", { path: "/same" }), 1);
      const first = detector.check(
        createToolCall("read_file", { path: "/same" }),
        2,
      );
      const second = detector.check(
        createToolCall("read_file", { path: "/same" }),
        3,
      );

      expect(first.shouldWarn).toBe(true);
      expect(second.shouldWarn).toBe(false);
    });
  });

  describe("check - pattern detection", () => {
    it("should detect A-B pattern repeating", () => {
      // Pattern: read_file -> write_file -> read_file -> write_file
      detector.check(createToolCall("read_file", { path: "/a" }), 1);
      detector.check(createToolCall("write_file", { path: "/a" }), 1);
      detector.check(createToolCall("read_file", { path: "/a" }), 2);
      const result = detector.check(
        createToolCall("write_file", { path: "/a" }),
        2,
      );

      expect(result.isLoop).toBe(true);
      expect(result.pattern).toBeDefined();
      expect(result.pattern!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("check - disabled detection", () => {
    it("should not detect loops when disabled", () => {
      const disabledDetector = new LoopDetector({ enabled: false });

      disabledDetector.check(createToolCall("read_file", { path: "/same" }), 1);
      disabledDetector.check(createToolCall("read_file", { path: "/same" }), 2);
      const result = disabledDetector.check(
        createToolCall("read_file", { path: "/same" }),
        3,
      );

      expect(result.isLoop).toBe(false);
      expect(result.shouldStop).toBe(false);
    });
  });

  describe("reset", () => {
    it("should clear history", () => {
      detector.check(createToolCall("read_file", { path: "/same" }), 1);
      detector.check(createToolCall("read_file", { path: "/same" }), 2);

      detector.reset();

      const result = detector.check(
        createToolCall("read_file", { path: "/same" }),
        1,
      );
      expect(result.isLoop).toBe(false);
    });

    it("should reset warning flag", () => {
      detector.check(createToolCall("read_file", { path: "/same" }), 1);
      detector.check(createToolCall("read_file", { path: "/same" }), 2);

      detector.reset();

      // Trigger warning again after reset
      detector.check(createToolCall("read_file", { path: "/same" }), 1);
      const result = detector.check(
        createToolCall("read_file", { path: "/same" }),
        2,
      );

      expect(result.shouldWarn).toBe(true);
    });
  });

  describe("getHistory", () => {
    it("should return tracked calls", () => {
      detector.check(createToolCall("read_file", { path: "/a" }), 1);
      detector.check(createToolCall("write_file", { path: "/b" }), 2);

      const history = detector.getHistory();

      expect(history).toHaveLength(2);
      expect(history[0].name).toBe("read_file");
      expect(history[1].name).toBe("write_file");
    });
  });

  describe("suggestion generation", () => {
    it("should provide suggestion for single tool loops", () => {
      detector.check(createToolCall("read_file", { path: "/same" }), 1);
      const result = detector.check(
        createToolCall("read_file", { path: "/same" }),
        2,
      );

      expect(result.suggestion).toContain("read_file");
      expect(result.suggestion).toContain("repeatedly");
    });
  });

  describe("custom thresholds", () => {
    it("should respect custom warning threshold", () => {
      const customDetector = new LoopDetector({ warningThreshold: 3 });

      customDetector.check(createToolCall("read_file", { path: "/same" }), 1);
      const second = customDetector.check(
        createToolCall("read_file", { path: "/same" }),
        2,
      );
      const third = customDetector.check(
        createToolCall("read_file", { path: "/same" }),
        3,
      );

      expect(second.shouldWarn).toBe(false);
      expect(third.shouldWarn).toBe(true);
    });

    it("should respect custom stop threshold", () => {
      const customDetector = new LoopDetector({ stopThreshold: 5 });

      // Should not stop at default threshold (3)
      customDetector.check(createToolCall("read_file", { path: "/same" }), 1);
      customDetector.check(createToolCall("read_file", { path: "/same" }), 2);
      const third = customDetector.check(
        createToolCall("read_file", { path: "/same" }),
        3,
      );

      expect(third.shouldStop).toBe(false);

      customDetector.check(createToolCall("read_file", { path: "/same" }), 4);
      const fifth = customDetector.check(
        createToolCall("read_file", { path: "/same" }),
        5,
      );

      expect(fifth.shouldStop).toBe(true);
    });
  });
});

describe("createLoopDetector", () => {
  it("should create a loop detector with defaults", () => {
    const detector = createLoopDetector();
    expect(detector).toBeInstanceOf(LoopDetector);
  });

  it("should create a loop detector with custom config", () => {
    const detector = createLoopDetector({ warningThreshold: 5 });
    expect(detector).toBeInstanceOf(LoopDetector);
  });
});

describe("DEFAULT_LOOP_CONFIG", () => {
  it("should have expected default values", () => {
    expect(DEFAULT_LOOP_CONFIG.enabled).toBe(true);
    expect(DEFAULT_LOOP_CONFIG.minSequenceLength).toBe(2);
    expect(DEFAULT_LOOP_CONFIG.warningThreshold).toBe(2);
    expect(DEFAULT_LOOP_CONFIG.stopThreshold).toBe(3);
    expect(DEFAULT_LOOP_CONFIG.maxHistorySize).toBe(50);
  });
});
