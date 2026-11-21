import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { z } from "zod";
import { Config, type ChatResponse, type Message } from "@beans/core";
import { executePython } from "../packages/eval/src/execution/python-runner.js";
import {
  SYSTEM,
  ARMS,
  mainPrompt,
  reviewMessages,
  parseJSON,
  reviewSchema,
  treatmentOrder,
  type Arm,
  type Candidate,
  type Family,
  type Review,
} from "../packages/eval/src/experiments/critic-evidence.js";

const args = process.argv.slice(2);
function option(name: string, fallback: string): string {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`Missing value for ${name}`);
  return value;
}
const output = option(
  "--output",
  "docs/reports/critic-evidence-2026-11-21.json",
);
const callsDirectory = output.replace(/\.json$/, "") + ".calls";
const responsePath = (id: string) => `${callsDirectory}/${id}.json`;
const rounds = Number(option("--rounds", "3"));
const maxReviews = Number(option("--max-reviews", "108"));
if (
  !Number.isInteger(rounds) ||
  rounds < 1 ||
  !Number.isInteger(maxReviews) ||
  maxReviews < 0
)
  throw new Error("Invalid repetition or review limit");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const config = await Config.getInstance();
const current = config.getLLMConfig();
const settings = {
  model: option("--model", current.model),
  provider: current.provider,
  temperature: current.temperature ?? 0.7,
  maxTokens: current.maxTokens ?? 4096,
};
config.applySessionOverrides({
  llm: { ...current, ...settings },
  debug: { ...config.getDebugConfig(), enabled: false },
});
const client = config.getLLMClient();
const sourceFiles = [
  "scripts/benchmark-critic-evidence.ts",
  "scripts/critic-evidence-validator.py",
  "packages/eval/src/experiments/critic-evidence.ts",
  "packages/eval/src/execution/python-runner.ts",
  "packages/core/src/llm/client.ts",
  "packages/core/dist/llm/client.js",
  "tests/fixtures/critic-evidence/cases.json",
  "docs/reports/critic-evidence-plan-2026-11-21.md",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (p) => [p, sha(await readFile(p, "utf8"))]),
  ),
);
const corpus = JSON.parse(
  await readFile("tests/fixtures/critic-evidence/cases.json", "utf8"),
) as {
  problems: Record<Family, string>;
  controls: Omit<Candidate, "mainMessages">[];
};
const validator = await readFile(
  "scripts/critic-evidence-validator.py",
  "utf8",
);
interface Validation {
  status?: string;
  confirmed?: boolean;
  fully_validated?: boolean;
  count?: number;
  failures?: number;
  [key: string]: unknown;
}
interface Call {
  request: {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    messages: Message[];
  };
  response: ChatResponse;
  elapsedMs: number;
}
interface Row {
  candidateId: string;
  origin: Candidate["origin"];
  round: number;
  arm: Arm;
  call: Call;
  review: Review | null;
  parseError?: string;
  validation: Validation;
  validationMs: number;
}
interface State {
  status: string;
  startedAt: string;
  updatedAt: string;
  error?: string;
  settings: typeof settings;
  rounds: number;
  sourceHashes: Record<string, string>;
  mainCalls: Record<string, Call>;
  candidates: Candidate[];
  bank: Record<string, Validation>;
  rows: Row[];
  pendingCall?: { phase: string; id: string; startedAt: string };
  summary?: unknown;
}
let state: State = {
  status: "running",
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  settings,
  rounds,
  sourceHashes,
  mainCalls: {},
  candidates: [],
  bank: {},
  rows: [],
};
try {
  const previous = JSON.parse(await readFile(output, "utf8")) as State;
  if (
    JSON.stringify(previous.settings) !== JSON.stringify(settings) ||
    previous.rounds !== rounds ||
    JSON.stringify(previous.sourceHashes) !== JSON.stringify(sourceHashes)
  )
    throw new Error(
      "Conditions changed; use a new output file rather than mixing runs",
    );
  if (previous.pendingCall)
    throw new Error(
      "An unresolved prior API call exists. Audit it before resuming to avoid silently repeating a call",
    );
  state = previous;
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
    throw error;
}
await mkdir(dirname(output), { recursive: true });
await mkdir(callsDirectory, { recursive: true });
async function save(): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await writeFile(`${output}.tmp`, JSON.stringify(state, null, 2) + "\n");
  await rename(`${output}.tmp`, output);
}
async function callModel(
  phase: string,
  id: string,
  messages: Message[],
): Promise<Call> {
  state.pendingCall = { phase, id, startedAt: new Date().toISOString() };
  await save();
  const request = {
    model: settings.model,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    systemPrompt: SYSTEM,
    messages,
  };
  const started = performance.now();
  const response = await client.chat(request);
  const call = { request, response, elapsedMs: performance.now() - started };
  // Persist provider output before parsing it. A parse error must not erase a paid call.
  if (phase === "main") state.mainCalls[id] = call;
  else await writeFile(responsePath(id), JSON.stringify(call, null, 2) + "\n");
  delete state.pendingCall;
  await save();
  if (
    response.finishReason === "error" ||
    response.finishReason === "content_filter"
  )
    throw new Error(`Provider returned ${response.finishReason} for ${id}`);
  return call;
}
async function validate(payload: Record<string, unknown>): Promise<Validation> {
  const script = `${validator}\nprint("BEANS_EVIDENCE:" + json.dumps(evaluate(json.loads(${JSON.stringify(JSON.stringify(payload))}))))`;
  const result = await executePython(script, {
    isolated: true,
    timeout: 20000,
  });
  if (!result.success)
    throw new Error(
      `Evidence execution infrastructure failed: ${result.error || result.stderr}`,
    );
  const line = result.stdout
    .split("\n")
    .find((s) => s.startsWith("BEANS_EVIDENCE:"));
  if (!line) throw new Error("No structured evidence result received");
  return JSON.parse(line.slice("BEANS_EVIDENCE:".length));
}
function summarize(): unknown {
  const totals: Record<string, unknown> = {};
  for (const origin of ["authored_control", "live_main"] as const)
    for (const arm of ARMS) {
      const rows = state.rows.filter(
        (r) => r.origin === origin && r.arm === arm,
      );
      const faulty = rows.filter(
        (r) => state.bank[r.candidateId].failures! > 0,
      );
      const passing = rows.filter(
        (r) => state.bank[r.candidateId].failures === 0,
      );
      const usages = rows.map((r) => r.call.response.usage);
      totals[`${origin}/${arm}`] = {
        reviews: rows.length,
        faultyReviews: faulty.length,
        passingReviews: passing.length,
        detected: faulty.filter((r) => r.review?.verdict === "incorrect")
          .length,
        confirmedDetections: faulty.filter(
          (r) => r.review?.verdict === "incorrect" && r.validation.confirmed,
        ).length,
        falseRejections: passing.filter(
          (r) => r.review?.verdict === "incorrect",
        ).length,
        acceptedPassing: passing.filter((r) => r.review?.verdict === "correct")
          .length,
        uncertain: rows.filter((r) => r.review?.verdict === "uncertain").length,
        malformed: rows.filter((r) => !r.review).length,
        evidenceSubmitted: rows.filter((r) => r.review?.evidence).length,
        evidenceConfirmed: rows.filter((r) => r.validation.confirmed).length,
        evidenceFullyValidated: rows.filter((r) => r.validation.fully_validated)
          .length,
        metamorphicSubmitted: rows.filter(
          (r) => r.review?.evidence?.kind === "metamorphic",
        ).length,
        metamorphicConfirmed: rows.filter(
          (r) =>
            r.review?.evidence?.kind === "metamorphic" &&
            r.validation.confirmed,
        ).length,
        promptTokens: usages.every(Boolean)
          ? usages.reduce((sum, u) => sum + u!.promptTokens, 0)
          : null,
        completionTokens: usages.every(Boolean)
          ? usages.reduce((sum, u) => sum + u!.completionTokens, 0)
          : null,
        totalTokens: usages.every(Boolean)
          ? usages.reduce((sum, u) => sum + u!.totalTokens, 0)
          : null,
        callMs: rows.reduce((sum, r) => sum + r.call.elapsedMs, 0),
        validationMs: rows.reduce((sum, r) => sum + r.validationMs, 0),
      };
    }
  return totals;
}
try {
  const probe = await executePython("print('isolation-ok')", {
    isolated: true,
    timeout: 5000,
  });
  if (!probe.success || probe.stdout !== "isolation-ok")
    throw new Error(`Python isolation unavailable: ${probe.stderr}`);
  state.status = "running";
  delete state.error;
  for (const control of corpus.controls)
    if (!state.candidates.some((c) => c.id === control.id)) {
      state.candidates.push({
        ...control,
        mainMessages: [
          {
            role: "user",
            content: mainPrompt(corpus.problems[control.family]),
          },
          {
            role: "assistant",
            content: JSON.stringify({ code: control.code }),
          },
        ],
      });
    }
  await save();
  // Check all authored labels before any model review or live generation.
  for (const c of state.candidates)
    if (!state.bank[c.id]) {
      state.bank[c.id] = await validate({
        mode: "bank",
        family: c.family,
        code: c.code,
      });
      const incorrect = state.bank[c.id].failures! > 0;
      if (
        c.origin === "authored_control" &&
        incorrect !== (c.expectedVerdict === "incorrect")
      )
        throw new Error(`Control label mismatch: ${c.id}`);
      await save();
    }
  for (const [family, problem] of Object.entries(corpus.problems) as [
    Family,
    string,
  ][]) {
    const id = `main_${family}`;
    if (state.candidates.some((c) => c.id === id)) continue;
    const messages: Message[] = [
      { role: "user", content: mainPrompt(problem) },
    ];
    const call = state.mainCalls[id] ?? (await callModel("main", id, messages));
    const result = z
      .object({ approach: z.string(), code: z.string().min(1) })
      .parse(parseJSON(call.response.content ?? ""));
    const candidate: Candidate = {
      id,
      family,
      origin: "live_main",
      code: result.code,
      mainMessages: [
        ...messages,
        { role: "assistant", content: call.response.content! },
      ],
    };
    state.candidates.push(candidate);
    state.bank[id] = await validate({
      mode: "bank",
      family,
      code: candidate.code,
    });
    await save();
    console.log(
      JSON.stringify({
        phase: "main",
        id,
        failures: state.bank[id].failures,
        tokens: call.response.usage?.totalTokens,
      }),
    );
  }
  let count = 0;
  for (let round = 1; round <= rounds; round++)
    for (let i = 0; i < state.candidates.length; i++) {
      const candidate = state.candidates[i];
      for (const arm of treatmentOrder(i, round)) {
        if (
          state.rows.some(
            (r) =>
              r.candidateId === candidate.id &&
              r.round === round &&
              r.arm === arm,
          )
        )
          continue;
        if (count >= maxReviews) {
          state.status = "checkpoint";
          state.summary = summarize();
          await save();
          process.exit(0);
        }
        const id = `${candidate.id}.r${round}.${arm}`;
        let call: Call;
        try {
          call = JSON.parse(await readFile(responsePath(id), "utf8"));
        } catch (error) {
          if (
            !(
              error instanceof Error &&
              "code" in error &&
              error.code === "ENOENT"
            )
          )
            throw error;
          call = await callModel(
            "review",
            id,
            reviewMessages(candidate, corpus.problems[candidate.family], arm),
          );
        }
        let review: Review | null = null;
        let parseError: string | undefined;
        try {
          review = reviewSchema.parse(parseJSON(call.response.content ?? ""));
        } catch (error) {
          parseError = String(error);
        }
        const started = performance.now();
        const validation = review
          ? await validate({
              mode: "evidence",
              family: candidate.family,
              code: candidate.code,
              evidence: review.evidence,
            })
          : { status: "malformed", confirmed: false };
        state.rows.push({
          candidateId: candidate.id,
          origin: candidate.origin,
          round,
          arm,
          call,
          review,
          parseError,
          validation,
          validationMs: performance.now() - started,
        });
        state.summary = summarize();
        await save();
        count++;
        console.log(
          JSON.stringify({
            completed: state.rows.length,
            expected: state.candidates.length * ARMS.length * rounds,
            id,
            verdict: review?.verdict ?? "malformed",
            evidence: validation.status,
            tokens: call.response.usage?.totalTokens,
            seconds: Math.round(call.elapsedMs / 100) / 10,
          }),
        );
      }
    }
  for (const path of sourceFiles)
    if (sha(await readFile(path, "utf8")) !== sourceHashes[path])
      throw new Error(`Source changed during run: ${path}`);
  state.status = "complete";
  state.summary = summarize();
  await save();
} catch (error) {
  state.status = "failed";
  state.error = (
    error instanceof Error ? error.message : String(error)
  ).replace(/([?&]key=)[^&\s]+/g, "$1[REDACTED]");
  await save();
  // Do not print credential-bearing request URLs or provider headers.
  console.error(
    "Experiment stopped. Completed records and the error are saved in the report.",
  );
  process.exitCode = 1;
}
