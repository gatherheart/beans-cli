import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PolicyEngine,
  createPolicyEngine,
} from "../../../packages/core/src/policy/engine.js";
import type {
  PolicyContext,
  PolicyEvent,
} from "../../../packages/core/src/policy/types.js";

describe("PolicyEngine", () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create with default mode", () => {
      expect(engine.getMode()).toBe("DEFAULT");
    });

    it("should create with custom mode", () => {
      const customEngine = new PolicyEngine({ mode: "YOLO" });
      expect(customEngine.getMode()).toBe("YOLO");
    });
  });

  describe("setMode", () => {
    it("should change the approval mode", () => {
      engine.setMode("PLAN");
      expect(engine.getMode()).toBe("PLAN");
    });
  });

  describe("evaluate - DEFAULT mode", () => {
    it("should auto-approve read_file tool", () => {
      const decision = engine.evaluate({ toolName: "read_file" });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it("should auto-approve glob tool", () => {
      const decision = engine.evaluate({ toolName: "glob" });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it("should auto-approve grep tool", () => {
      const decision = engine.evaluate({ toolName: "grep" });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it("should require approval for write_file tool", () => {
      const decision = engine.evaluate({ toolName: "write_file" });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
    });

    it("should require approval for shell tool", () => {
      const decision = engine.evaluate({ toolName: "shell" });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
    });
  });

  describe("evaluate - PLAN mode", () => {
    beforeEach(() => {
      engine.setMode("PLAN");
    });

    it("should auto-approve read_file tool", () => {
      const decision = engine.evaluate({ toolName: "read_file" });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it("should block write_file tool", () => {
      const decision = engine.evaluate({ toolName: "write_file" });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("blocked");
    });

    it("should block shell tool", () => {
      const decision = engine.evaluate({ toolName: "shell" });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("blocked");
    });

    it("should block delete_file tool", () => {
      const decision = engine.evaluate({ toolName: "delete_file" });

      expect(decision.allowed).toBe(false);
    });
  });

  describe("evaluate - YOLO mode", () => {
    beforeEach(() => {
      engine.setMode("YOLO");
    });

    it("should auto-approve all tools", () => {
      const tools = [
        "read_file",
        "write_file",
        "shell",
        "delete_file",
        "unknown_tool",
      ];

      for (const toolName of tools) {
        const decision = engine.evaluate({ toolName });
        expect(decision.allowed).toBe(true);
        expect(decision.requiresApproval).toBe(false);
      }
    });
  });

  describe("evaluate - AUTO_EDIT mode", () => {
    beforeEach(() => {
      engine.setMode("AUTO_EDIT");
    });

    it("should auto-approve write_file tool", () => {
      const decision = engine.evaluate({ toolName: "write_file" });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it("should require approval for shell tool", () => {
      const decision = engine.evaluate({ toolName: "shell" });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
    });
  });

  describe("addPolicy / removePolicy", () => {
    it("should add custom policy that overrides defaults", () => {
      // By default, shell requires approval
      let decision = engine.evaluate({ toolName: "shell" });
      expect(decision.requiresApproval).toBe(true);

      // Add custom policy to auto-approve shell
      engine.addPolicy({ name: "shell", allowed: true, autoApprove: true });

      decision = engine.evaluate({ toolName: "shell" });
      expect(decision.requiresApproval).toBe(false);
    });

    it("should block a tool with custom policy", () => {
      engine.addPolicy({
        name: "read_file",
        allowed: false,
        blockMessage: "Custom block",
      });

      const decision = engine.evaluate({ toolName: "read_file" });
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("Custom block");
    });

    it("should remove custom policy", () => {
      engine.addPolicy({ name: "shell", allowed: false });
      engine.removePolicy("shell");

      // Should fall back to default behavior
      const decision = engine.evaluate({ toolName: "shell" });
      expect(decision.allowed).toBe(true);
    });
  });

  describe("isToolAllowed", () => {
    it("should return true for allowed tools", () => {
      expect(engine.isToolAllowed("read_file")).toBe(true);
      expect(engine.isToolAllowed("write_file")).toBe(true);
    });

    it("should return false for blocked tools in PLAN mode", () => {
      engine.setMode("PLAN");
      expect(engine.isToolAllowed("write_file")).toBe(false);
      expect(engine.isToolAllowed("read_file")).toBe(true);
    });
  });

  describe("isToolAutoApproved", () => {
    it("should return true for auto-approved tools", () => {
      expect(engine.isToolAutoApproved("read_file")).toBe(true);
    });

    it("should return false for tools requiring approval", () => {
      expect(engine.isToolAutoApproved("shell")).toBe(false);
    });

    it("should return true for all tools in YOLO mode", () => {
      engine.setMode("YOLO");
      expect(engine.isToolAutoApproved("shell")).toBe(true);
      expect(engine.isToolAutoApproved("delete_file")).toBe(true);
    });
  });

  describe("event subscription", () => {
    it("should emit policy_check event on evaluate", () => {
      const events: PolicyEvent[] = [];
      engine.on((event) => events.push(event));

      engine.evaluate({ toolName: "read_file" });

      expect(events).toHaveLength(2); // policy_check + auto_approved
      expect(events[0].type).toBe("policy_check");
    });

    it("should emit tool_blocked event when tool is blocked", () => {
      engine.setMode("PLAN");
      const events: PolicyEvent[] = [];
      engine.on((event) => events.push(event));

      engine.evaluate({ toolName: "write_file" });

      const blockedEvent = events.find((e) => e.type === "tool_blocked");
      expect(blockedEvent).toBeDefined();
    });

    it("should emit auto_approved event for auto-approved tools", () => {
      const events: PolicyEvent[] = [];
      engine.on((event) => events.push(event));

      engine.evaluate({ toolName: "read_file" });

      const autoApprovedEvent = events.find((e) => e.type === "auto_approved");
      expect(autoApprovedEvent).toBeDefined();
    });

    it("should emit approval_required event for tools requiring approval", () => {
      const events: PolicyEvent[] = [];
      engine.on((event) => events.push(event));

      engine.evaluate({ toolName: "shell" });

      const approvalEvent = events.find((e) => e.type === "approval_required");
      expect(approvalEvent).toBeDefined();
    });

    it("should allow unsubscribing from events", () => {
      const events: PolicyEvent[] = [];
      const unsubscribe = engine.on((event) => events.push(event));

      engine.evaluate({ toolName: "read_file" });
      expect(events.length).toBeGreaterThan(0);

      const countBefore = events.length;
      unsubscribe();

      engine.evaluate({ toolName: "write_file" });
      expect(events.length).toBe(countBefore);
    });
  });

  describe("confirmation-based evaluation", () => {
    it("should auto-approve tools with read confirmation type", () => {
      const context: PolicyContext = {
        toolName: "unknown_tool",
        confirmation: { required: false, type: "read" },
      };

      const decision = engine.evaluate(context);
      expect(decision.requiresApproval).toBe(false);
    });

    it("should require approval for tools with destructive confirmation type", () => {
      const context: PolicyContext = {
        toolName: "unknown_tool",
        confirmation: { required: true, type: "destructive" },
      };

      const decision = engine.evaluate(context);
      expect(decision.requiresApproval).toBe(true);
    });
  });

  describe("getConfig", () => {
    it("should return a copy of the current configuration", () => {
      const config = engine.getConfig();

      expect(config.mode).toBe("DEFAULT");
      expect(config).not.toBe(engine.getConfig()); // Should be a copy
    });
  });
});

describe("createPolicyEngine", () => {
  it("should create a policy engine with default config", () => {
    const engine = createPolicyEngine();
    expect(engine.getMode()).toBe("DEFAULT");
  });

  it("should create a policy engine with custom config", () => {
    const engine = createPolicyEngine({ mode: "YOLO" });
    expect(engine.getMode()).toBe("YOLO");
  });
});
