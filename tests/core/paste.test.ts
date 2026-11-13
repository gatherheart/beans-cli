import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PastePatternAnalyzer,
  PasteRuntime,
  PasteSession,
  invocationKey,
} from "../../packages/core/src/speculation/index.js";
import type {
  PasteEvent,
  PasteOptions,
} from "../../packages/core/src/speculation/index.js";
import { ToolRegistry } from "../../packages/core/src/tools/registry.js";
import type { ToolExecutionResult } from "../../packages/core/src/tools/types.js";
import { AgentExecutor } from "../../packages/core/src/agents/executor.js";
import type { LLMClient } from "../../packages/core/src/llm/types.js";
import { PolicyEngine } from "../../packages/core/src/policy/engine.js";

afterEach(() => vi.restoreAllMocks());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function trace(path: string, target = "lookup"): PasteEvent[] {
  return [
    {
      name: "search",
      arguments: { query: "q" },
      status: "success",
      output: { hits: [{ path }] },
    },
    { name: target, arguments: { path }, status: "success", output: "result" },
  ];
}
function setup(
  execute: (
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<ToolExecutionResult>,
  options: PasteOptions = {},
) {
  const registry = new ToolRegistry();
  registry.register({
    definition: {
      name: "lookup",
      description: "Read-only lookup",
      parameters: { type: "object", properties: {} },
    },
    validate: () => ({ valid: true }),
    execute: (args, config) => execute(args, config?.signal),
  });
  const runtime = new PasteRuntime({
    traces: [trace("a"), trace("b")],
    allowedTools: ["lookup"],
    ...options,
  });
  const session = new PasteSession(runtime, registry, process.cwd());
  session.observe(
    [{ id: "s", name: "search", arguments: {} }],
    [{ content: JSON.stringify({ hits: [{ path: "live" }] }) }],
  );
  const call = { id: "real", name: "lookup", arguments: { path: "live" } };
  return { registry, runtime, session, call };
}

describe("PASTE pattern analyzer", () => {
  it("binds arguments from live payloads using validated structural patterns", () => {
    const analyzer = new PastePatternAnalyzer();
    analyzer.learn([trace("a"), trace("b")]);
    expect(analyzer.predict(trace("new").slice(0, 1))).toEqual([
      {
        call: { name: "lookup", arguments: { path: "new" } },
        probability: 1,
        support: 2,
      },
    ]);
    expect(analyzer.predict([{ ...trace("new")[0], status: "error" }])).toEqual(
      [],
    );
    expect(analyzer.predict([{ ...trace("new")[0], output: {} }])).toEqual([]);
  });

  it("counts no-call outcomes in confidence and requires repeated evidence", () => {
    const analyzer = new PastePatternAnalyzer();
    analyzer.learn([trace("a")]);
    expect(analyzer.predict(trace("c").slice(0, 1))).toEqual([]);
    analyzer.learn([trace("b"), trace("nothing").slice(0, 1)]);
    expect(analyzer.predict(trace("c").slice(0, 1))[0].probability).toBeCloseTo(
      2 / 3,
    );
  });

  it("canonicalizes object order but preserves argument and array differences", () => {
    expect(invocationKey({ name: "x", arguments: { a: 1, b: [1, 2] } })).toBe(
      invocationKey({ name: "x", arguments: { b: [1, 2], a: 1 } }),
    );
    expect(invocationKey({ name: "x", arguments: { b: [1, 2] } })).not.toBe(
      invocationKey({ name: "x", arguments: { b: [2, 1] } }),
    );
  });
});

describe("PASTE isolated execution", () => {
  it("promotes the running exact match without running it twice", async () => {
    const pending = deferred<ToolExecutionResult>();
    const execute = vi.fn(() => pending.promise);
    const { session, call, runtime } = setup(execute);
    session.beginTurn(["lookup"]);
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
    session.confirmBatch([call]);
    const normal = vi.fn(async () => ({ content: "wrong" }));
    const result = session.execute(call, normal);
    pending.resolve({ content: "predicted" });
    expect(await result).toEqual({ content: "predicted" });
    expect(normal).not.toHaveBeenCalled();
    expect(session.metrics.promoted).toBe(1);
    session.finish();
    expect(runtime.active).toBe(0);
    expect(runtime.authoritative).toBe(0);
  });

  it("reuses a completed result only after confirmation", async () => {
    const { session, call, runtime } = setup(async () => ({
      content: "ready",
    }));
    session.beginTurn(["lookup"]);
    await vi.waitFor(() => expect(runtime.active).toBe(0));
    session.confirmBatch([call]);
    const normal = vi.fn(async () => ({ content: "wrong" }));
    expect(await session.execute(call, normal)).toEqual({ content: "ready" });
    expect(session.metrics.reused).toBe(1);
    expect(normal).not.toHaveBeenCalled();
    session.finish();
  });

  it("does not delay a mismatch while an uncancellable prediction is draining", async () => {
    const pending = deferred<ToolExecutionResult>();
    let captured: AbortSignal | undefined;
    const { session, call, runtime } = setup(async (_args, signal) => {
      captured = signal;
      return pending.promise;
    });
    session.beginTurn(["lookup"]);
    await vi.waitFor(() => expect(captured).toBeDefined());
    const other = { ...call, arguments: { path: "other" } };
    session.confirmBatch([other]);
    expect(captured?.aborted).toBe(true);
    expect(
      await session.execute(other, async () => ({ content: "actual" })),
    ).toEqual({ content: "actual" });
    expect(runtime.active).toBe(1);
    pending.resolve({ content: "unused" });
    await vi.waitFor(() => expect(runtime.active).toBe(0));
    session.finish();
  });

  it("falls back after speculative failures", async () => {
    const { session, call, runtime } = setup(async () => {
      throw new Error("temporary");
    });
    session.beginTurn(["lookup"]);
    await vi.waitFor(() => expect(runtime.active).toBe(0));
    session.confirmBatch([call]);
    expect(
      await session.execute(call, async () => ({ content: "retry" })),
    ).toEqual({ content: "retry" });
    expect(session.metrics.failed).toBe(1);
    expect(session.metrics.reused).toBe(0);
    session.finish();
  });

  it("does not retry a promoted tool after the user aborts", async () => {
    const pending = deferred<ToolExecutionResult>();
    const started = deferred<void>();
    let toolSignal: AbortSignal | undefined;
    const { session, call } = setup(async (_args, signal) => {
      toolSignal = signal;
      started.resolve();
      return pending.promise;
    });
    const controller = new AbortController();
    session.beginTurn(["lookup"], controller.signal);
    await started.promise;
    session.confirmBatch([call]);
    const normal = vi.fn(async () => ({ content: "must not retry" }));
    const result = session.execute(call, normal);
    controller.abort();
    expect(toolSignal?.aborted).toBe(true);
    pending.resolve({ content: "cancelled result" });
    await expect(result).rejects.toThrow();
    expect(normal).not.toHaveBeenCalled();
    session.finish();
  });

  it.each([
    "not-allowed",
    "low-confidence",
    "no-budget",
    "blocked",
    "approval",
  ])("skips predictions under %s", (reason) => {
    const execute = vi.fn(async () => ({ content: "must not run" }));
    const { session, registry, runtime } = setup(execute, {
      ...(reason === "not-allowed" ? { allowedTools: [] } : {}),
      ...(reason === "no-budget" ? { maxSpeculations: 0 } : {}),
      ...(reason === "low-confidence"
        ? { traces: [trace("a"), trace("b"), trace("c").slice(0, 1)] }
        : {}),
    });
    let target = session;
    if (reason === "blocked" || reason === "approval") {
      session.finish();
      const policy = new PolicyEngine({
        toolPolicies: [
          { name: "lookup", allowed: reason !== "blocked", autoApprove: false },
        ],
      });
      target = new PasteSession(runtime, registry, process.cwd(), policy);
      target.observe(
        [{ id: "s", name: "search", arguments: {} }],
        [{ content: JSON.stringify({ hits: [{ path: "live" }] }) }],
      );
    }
    target.beginTurn(["lookup"]);
    expect(target.metrics.started).toBe(0);
    expect(execute).not.toHaveBeenCalled();
    target.finish();
  });

  it("expires jobs and cancels them on an abort signal", async () => {
    vi.useFakeTimers();
    try {
      for (const abort of [false, true]) {
        const { session, runtime } = setup(
          async () => ({ content: "cached" }),
          { ttlMs: 100 },
        );
        const controller = new AbortController();
        session.beginTurn(["lookup"], controller.signal);
        if (abort) controller.abort();
        else await vi.advanceTimersByTimeAsync(100);
        expect(session.metrics.discarded).toBe(1);
        session.finish();
        await vi.runAllTimersAsync();
        expect(runtime.active).toBe(0);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("invalidates a read before a parallel mutation and prioritizes other sessions", async () => {
    const { session, call, registry, runtime } = setup(async () => ({
      content: "stale",
    }));
    session.beginTurn(["lookup"]);
    await vi.waitFor(() => expect(runtime.active).toBe(0));
    session.confirmBatch([
      call,
      { id: "w", name: "write_file", arguments: {} },
    ]);
    expect(
      await session.execute(call, async () => ({ content: "fresh" })),
    ).toEqual({ content: "fresh" });
    const other = new PasteSession(runtime, registry, process.cwd());
    other.observe(
      [{ id: "s", name: "search", arguments: {} }],
      [{ content: JSON.stringify({ hits: [{ path: "live" }] }) }],
    );
    other.beginTurn(["lookup"]);
    expect(other.metrics.started).toBe(0);
    session.finish();
    other.beginTurn(["lookup"]);
    expect(other.metrics.started).toBe(1);
    const third = new PasteSession(runtime, registry, process.cwd());
    third.confirmBatch([{ id: "w", name: "write_file", arguments: {} }]);
    expect(other.metrics.discarded).toBe(1);
    third.finish();
    other.finish();
  });

  it.each([false, true])(
    "validates a real file snapshot with external edit = %s",
    async (edited) => {
      const dir = await realpath(await mkdtemp(join(tmpdir(), "beans-paste-")));
      try {
        const path = join(dir, "read.txt");
        await writeFile(path, "old");
        const { ReadFileTool } =
          await import("../../packages/core/src/tools/builtin/read-file.js");
        const registry = new ToolRegistry();
        registry.register(new ReadFileTool());
        const runtime = new PasteRuntime({
          traces: [trace("a", "read_file"), trace("b", "read_file")],
        });
        const session = new PasteSession(runtime, registry, dir);
        const call = { id: "r", name: "read_file", arguments: { path } };
        session.observe(
          [{ id: "s", name: "search", arguments: {} }],
          [{ content: JSON.stringify({ hits: [{ path }] }) }],
        );
        session.beginTurn(["read_file"]);
        await vi.waitFor(() => expect(runtime.active).toBe(0));
        expect(session.metrics.started).toBe(1);
        expect(session.metrics.failed).toBe(0);
        if (edited) await writeFile(path, "updated content");
        session.confirmBatch([call]);
        const normal = vi.fn(async () => ({ content: "fresh" }));
        expect((await session.execute(call, normal)).content).toBe(
          edited ? "fresh" : "1: old",
        );
        expect(session.metrics.reused).toBe(edited ? 0 : 1);
        expect(normal).toHaveBeenCalledTimes(edited ? 1 : 0);
        session.finish();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
});

describe("PASTE AgentExecutor integration", () => {
  it("overlaps a real LLM turn, keeps predictions out of history, and reuses the result", async () => {
    const lookup = deferred<ToolExecutionResult>();
    const started = deferred<void>();
    const { registry } = setup(async () => {
      started.resolve();
      return lookup.promise;
    });
    registry.register({
      definition: {
        name: "search",
        description: "Find",
        parameters: { type: "object", properties: {} },
      },
      validate: () => ({ valid: true }),
      execute: async () => ({
        content: JSON.stringify({ hits: [{ path: "live" }] }),
      }),
    });
    let turns = 0;
    const client = {
      chat: vi.fn(async (request) => {
        turns++;
        if (turns === 1)
          return {
            content: "",
            toolCalls: [{ id: "s", name: "search", arguments: {} }],
          };
        if (turns === 2) {
          await started.promise;
          expect(JSON.stringify(request.messages)).not.toContain(
            "SECRET_RESULT",
          );
          lookup.resolve({ content: "SECRET_RESULT" });
          return {
            content: "",
            toolCalls: [
              { id: "r", name: "lookup", arguments: { path: "live" } },
            ],
          };
        }
        expect(request.messages.at(-1)?.toolResults?.[0].content).toBe(
          "SECRET_RESULT",
        );
        return { content: "done" };
      }),
    } as unknown as LLMClient;
    const executor = new AgentExecutor(client, registry, {
      paste: { traces: [trace("a"), trace("b")], allowedTools: ["lookup"] },
    });
    const result = await executor.execute({
      name: "test",
      description: "test",
      promptConfig: { systemPrompt: "test", query: "test" },
      modelConfig: { model: "mock" },
      toolConfig: { allowAllTools: true },
    });
    expect(result.success).toBe(true);
    expect(result.paste?.started).toBe(1);
    expect((result.paste?.reused ?? 0) + (result.paste?.promoted ?? 0)).toBe(1);
    expect(client.chat).toHaveBeenCalledTimes(3);
    expect(
      result.messages.filter((message) => message.role === "tool"),
    ).toHaveLength(2);
  });
});
