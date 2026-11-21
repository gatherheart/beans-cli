import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { Config } from "@beans/core";
import {
  parseJSON,
  reviewPrompt,
  reviewSchema,
} from "../packages/eval/src/experiments/critic-evidence.js";

const output = "docs/reports/compiled-critic-timing-2026-11-21.json";
const callsDirectory = "docs/reports/compiled-critic-timing-2026-11-21.calls";
const state = JSON.parse(await readFile(output, "utf8"));
const corpus = JSON.parse(
  await readFile("tests/fixtures/critic-evidence/cases.json", "utf8"),
);
const config = await Config.getInstance();
const current = config.getLLMConfig();
const settings = {
  model: current.model,
  provider: current.provider,
  temperature: 0.7,
  maxTokens: 8192,
};
config.applySessionOverrides({
  llm: { ...current, ...settings },
  debug: { ...config.getDebugConfig(), enabled: false },
});
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const sources = [
  "scripts/benchmark-compiled-critic.ts",
  "packages/eval/src/experiments/critic-evidence.ts",
  "packages/core/dist/llm/client.js",
];
const hashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (p) => [p, sha(await readFile(p, "utf8"))]),
  ),
);
if (
  state.reviewSettings &&
  JSON.stringify(state.reviewSettings) !== JSON.stringify(settings)
)
  throw new Error("Review settings changed");
if (
  state.reviewSourceHashes &&
  JSON.stringify(state.reviewSourceHashes) !== JSON.stringify(hashes)
)
  throw new Error("Review source changed");
if (state.pendingCall)
  throw new Error("Audit the pending call before resuming");
state.reviewSettings = settings;
state.reviewSourceHashes = hashes;
await mkdir(callsDirectory, { recursive: true });
const save = () => writeFile(output, JSON.stringify(state, null, 2) + "\n");
function validate(language: string, evidence: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "python3",
      ["scripts/compiled-critic.py", "validate", language],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    child.stdout.on("data", (data) => (out += data));
    child.stderr.on("data", (data) => (err += data));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(err));
      else {
        try {
          resolve(JSON.parse(out));
        } catch (error) {
          reject(error);
        }
      }
    });
    child.stdin.end(JSON.stringify(evidence));
  });
}
try {
  state.status = "reviewing";
  for (const candidate of state.candidates) {
    if (
      state.reviews.some(
        (r: { language: string }) => r.language === candidate.language,
      )
    )
      continue;
    if (
      sha(await readFile(candidate.sourcePath, "utf8")) !==
      candidate.sourceSha256
    )
      throw new Error("Source changed after build");
    const statement =
      corpus.problems.weighted_intervals +
      " The implementation is in " +
      candidate.language +
      ". The driver reads a case count, then for each case a job count followed by that many start/end/reward triples. Review solve and its use by the driver. Inputs satisfy the stated constraints.";
    const request = {
      ...settings,
      systemPrompt:
        "You are a programming assistant. Follow the current request. No tools or external resources are available.",
      messages: [
        {
          role: "user" as const,
          content: reviewPrompt(statement, candidate.source, true).replace(
            "```python\n",
            "```" + candidate.language + "\n",
          ),
        },
      ],
    };
    state.pendingCall = {
      language: candidate.language,
      startedAt: new Date().toISOString(),
    };
    await save();
    const start = performance.now();
    const response = await config.getLLMClient().chat(request);
    const elapsedMs = performance.now() - start;
    await writeFile(
      `${callsDirectory}/${candidate.language}.json`,
      JSON.stringify({ request, response, elapsedMs }, null, 2) + "\n",
    );
    delete state.pendingCall;
    let review = null;
    let parseError;
    try {
      review = reviewSchema.parse(parseJSON(response.content ?? ""));
    } catch (error) {
      parseError = String(error);
    }
    const validateStart = performance.now();
    const validation = review
      ? await validate(candidate.language, review.evidence)
      : { status: "malformed", confirmed: false };
    state.reviews.push({
      language: candidate.language,
      request,
      response,
      elapsedMs,
      review,
      parseError,
      validation,
      validationMs: performance.now() - validateStart,
    });
    await save();
    console.log(
      JSON.stringify({
        language: candidate.language,
        criticSeconds: elapsedMs / 1000,
        tokens: response.usage?.totalTokens,
        verdict: review?.verdict,
        validation,
      }),
    );
  }
  for (const path of sources)
    if (sha(await readFile(path, "utf8")) !== hashes[path])
      throw new Error(`Source changed: ${path}`);
  state.status = "complete";
  await save();
} catch (error) {
  state.status = "failed";
  state.error = String(error).replace(/([?&]key=)[^&\s]+/g, "$1[REDACTED]");
  await save();
  console.error(
    "Compiled pilot stopped. Completed records and error are saved.",
  );
  process.exitCode = 1;
}
