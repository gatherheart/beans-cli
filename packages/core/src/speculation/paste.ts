import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { expandTilde } from "../tools/utils.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { ToolExecutionResult } from "../tools/types.js";
import type { PolicyEngine } from "../policy/engine.js";
import type { ToolCall } from "../agents/types.js";
import {
  PastePatternAnalyzer,
  invocationKey,
  invocationSchema,
  jsonValue,
  tracesSchema,
} from "./patterns.js";
import type {
  PasteEvent,
  PasteInvocation,
  PastePrediction,
  JsonValue,
} from "./patterns.js";

export interface PasteOptions {
  traces?: PasteEvent[][];
  confidence?: number;
  maxSpeculations?: number;
  ttlMs?: number;
  /** Explicit side-effect-free and cancellation-aware tools. Defaults to read_file. */
  allowedTools?: string[];
}
export interface PasteMetrics {
  predicted: number;
  started: number;
  reused: number;
  promoted: number;
  discarded: number;
  preempted: number;
  failed: number;
  skipped: number;
  fallback: number;
}
interface Job {
  call: PasteInvocation;
  controller: AbortController;
  promise: Promise<ToolExecutionResult | undefined>;
  settled: boolean;
  timer?: ReturnType<typeof setTimeout>;
  fileVersion?: string;
}

async function fileVersion(
  call: PasteInvocation,
  cwd: string,
): Promise<string | undefined> {
  if (call.name !== "read_file") return undefined;
  if (typeof call.arguments.path !== "string")
    throw new Error("Missing read path");
  const info = await stat(resolve(cwd, expandTilde(call.arguments.path)), {
    bigint: true,
  });
  if (!info.isFile())
    throw new Error("Only regular files may be read speculatively");
  return `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
}

export async function loadPasteTraces(path: string): Promise<PasteEvent[][]> {
  return tracesSchema.parse(JSON.parse(await readFile(path, "utf8")));
}

/** One shared budget per executor; cancelling a job retains its slot until it settles. */
export class PasteRuntime {
  readonly analyzer = new PastePatternAnalyzer();
  readonly options: Required<Omit<PasteOptions, "traces">>;
  active = 0;
  authoritative = 0;
  readonly sessions = new Set<PasteSession>();
  constructor(options: PasteOptions = {}) {
    this.options = {
      confidence: 0.8,
      maxSpeculations: 2,
      ttlMs: 5000,
      allowedTools: ["read_file"],
      ...options,
    };
    const { confidence, maxSpeculations, ttlMs } = this.options;
    if (
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1 ||
      !Number.isInteger(maxSpeculations) ||
      maxSpeculations < 0 ||
      maxSpeculations > 16 ||
      !Number.isFinite(ttlMs) ||
      ttlMs <= 0
    )
      throw new Error("Invalid PASTE configuration");
    if (options.traces) this.analyzer.learn(tracesSchema.parse(options.traces));
  }
}

/** Session-local shadow jobs: never append a prediction or its result to agent history. */
export class PasteSession {
  readonly metrics: PasteMetrics = {
    predicted: 0,
    started: 0,
    reused: 0,
    promoted: 0,
    discarded: 0,
    preempted: 0,
    failed: 0,
    skipped: 0,
    fallback: 0,
  };
  private history: PasteEvent[] = [];
  private jobs = new Map<string, Job>();
  private allowed = new Set<string>();
  private executing = false;
  private signal?: AbortSignal;
  private promoted = new Set<Job>();

  constructor(
    private readonly runtime: PasteRuntime,
    private readonly registry: ToolRegistry,
    private readonly cwd: string,
    private readonly policy?: PolicyEngine,
  ) {
    runtime.sessions.add(this);
  }

  beginTurn(availableTools: string[], signal?: AbortSignal): void {
    this.discard();
    this.signal = signal;
    this.allowed = new Set(availableTools);
    if (signal?.aborted || this.runtime.authoritative > 0) return;
    const predictions = this.runtime.analyzer.predict(this.history);
    this.metrics.predicted += predictions.length;
    const candidates = new Map<string, PastePrediction>();
    for (const prediction of predictions) {
      const key = invocationKey(prediction.call);
      if ((candidates.get(key)?.probability ?? -1) < prediction.probability)
        candidates.set(key, prediction);
    }
    for (const { call, probability } of [...candidates.values()].sort(
      (a, b) => b.probability - a.probability,
    )) {
      if (
        probability < this.runtime.options.confidence ||
        !this.eligible(call) ||
        this.runtime.active >= this.runtime.options.maxSpeculations
      ) {
        this.metrics.skipped++;
        continue;
      }
      const tool = this.registry.getTool(call.name);
      if (!tool) continue;
      const controller = new AbortController();
      const key = invocationKey(call);
      const abort = () => {
        controller.abort();
        this.drop(key);
      };
      signal?.addEventListener("abort", abort, { once: true });
      const job: Job = {
        call: structuredClone(call),
        controller,
        promise: Promise.resolve(undefined),
        settled: false,
      };
      this.jobs.set(key, job);
      this.runtime.active++;
      this.metrics.started++;
      job.timer = setTimeout(() => this.drop(key), this.runtime.options.ttlMs);
      job.timer.unref();
      job.promise = Promise.resolve()
        .then(async () => {
          job.fileVersion = await fileVersion(call, this.cwd);
          controller.signal.throwIfAborted();
          return tool.execute(structuredClone(call.arguments), {
            cwd: this.cwd,
            signal: controller.signal,
          });
        })
        .then((result) => {
          if (result.isError) {
            this.metrics.failed++;
            return undefined;
          }
          return result;
        })
        .catch(() => {
          this.metrics.failed++;
          return undefined;
        })
        .finally(() => {
          job.settled = true;
          this.runtime.active--;
          signal?.removeEventListener("abort", abort);
        });
    }
  }

  /** Mutation/parallel batches invalidate all reads before any authoritative call starts. */
  confirmBatch(calls: ToolCall[]): void {
    if (!this.executing) {
      this.runtime.authoritative++;
      this.executing = true;
    }
    for (const session of this.runtime.sessions)
      if (session !== this) session.discard(true);
    const parsed =
      calls.length === 1 ? invocationSchema.safeParse(calls[0]) : undefined;
    if (!parsed?.success || !this.eligible(parsed.data)) {
      this.discard();
      return;
    }
    const key = invocationKey(parsed.data);
    for (const candidate of this.jobs.keys())
      if (candidate !== key) this.drop(candidate);
  }

  async execute(
    call: ToolCall,
    normal: () => Promise<ToolExecutionResult>,
  ): Promise<ToolExecutionResult> {
    this.signal?.throwIfAborted();
    const parsed = invocationSchema.safeParse(call);
    const key = parsed.success ? invocationKey(parsed.data) : undefined;
    const job = key ? this.jobs.get(key) : undefined;
    if (job && parsed.success && this.eligible(parsed.data)) {
      this.jobs.delete(key!);
      clearTimeout(job.timer);
      const completed = job.settled;
      this.promoted.add(job);
      const result = await job.promise.finally(() => this.promoted.delete(job));
      this.signal?.throwIfAborted();
      let fresh = false;
      try {
        fresh = job.fileVersion === (await fileVersion(job.call, this.cwd));
      } catch {
        /* Deleted or changed files fall back. */
      }
      if (result && !job.controller.signal.aborted && fresh) {
        if (completed) this.metrics.reused++;
        else this.metrics.promoted++;
        return result;
      }
      this.metrics.discarded++;
    }
    this.metrics.fallback++;
    return normal();
  }

  observe(
    calls: ToolCall[],
    results: Array<{ content: string; error?: string }>,
  ): void {
    this.endExecution();
    this.discard();
    if (calls.length !== 1 || results.length !== 1) {
      this.history = [];
      return;
    }
    const parsed = invocationSchema.safeParse(calls[0]);
    if (!parsed.success || results[0].content.length > 65536) {
      this.history = [];
      return;
    }
    this.runtime.analyzer.observe(this.history, parsed.data);
    const result = results[0];
    let output: JsonValue = {
      content: result.content,
      lines: result.content.split("\n").slice(0, 32),
    };
    try {
      output = jsonValue.parse(JSON.parse(result.content));
    } catch {
      /* Text tools expose indexed lines. */
    }
    this.history.push({
      ...parsed.data,
      status: result.error ? "error" : "success",
      output,
    });
    this.history = this.history.slice(-2);
  }

  finish(completed = false): void {
    if (completed) this.runtime.analyzer.observe(this.history);
    this.discard();
    for (const job of this.promoted) job.controller.abort();
    this.endExecution();
    this.runtime.sessions.delete(this);
    this.history = [];
  }

  private eligible(call: PasteInvocation): boolean {
    try {
      if (
        !this.allowed.has(call.name) ||
        !this.runtime.options.allowedTools.includes(call.name)
      )
        return false;
      const tool = this.registry.getTool(call.name);
      if (
        !tool ||
        !tool.validate(call.arguments).valid ||
        tool.getConfirmation?.(call.arguments).required
      )
        return false;
      return (
        !this.policy ||
        (this.policy.isToolAllowed(call.name) &&
          this.policy.isToolAutoApproved(call.name))
      );
    } catch {
      return false;
    }
  }

  private endExecution(): void {
    if (this.executing) {
      this.runtime.authoritative--;
      this.executing = false;
    }
  }

  private drop(key: string, preempted = false): void {
    const job = this.jobs.get(key);
    if (!job) return;
    this.jobs.delete(key);
    clearTimeout(job.timer);
    job.controller.abort();
    this.metrics.discarded++;
    if (preempted) this.metrics.preempted++;
  }
  private discard(preempted = false): void {
    for (const key of this.jobs.keys()) this.drop(key, preempted);
  }
}
