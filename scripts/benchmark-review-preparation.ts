/** Measure actual test/retrieval scheduling without making any LLM calls. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  CodeSimilarityIndex,
  DEFAULT_REVIEW_CASES,
  ReviewNeedPredictor,
  prepareNextReview,
  executeWithTests,
  loadMBPP,
} from "@beans/eval";
import type {
  BenchmarkReport,
  PreparationMode,
  PreparationMetrics,
  ReviewCase,
} from "@beans/eval";

const sourceFiles = [
  "packages/eval/src/speculation/code-similarity.ts",
  "packages/eval/src/speculation/review-preparation.ts",
  "packages/eval/src/speculation/review-cases.ts",
  "packages/eval/src/execution/python-runner.ts",
  "scripts/benchmark-review-preparation.ts",
];
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const sourceSnapshots = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (path) => [path, await readFile(path, "utf8")]),
  ),
);
const sourceHashes = Object.fromEntries(
  Object.entries(sourceSnapshots).map(([path, value]) => [path, sha(value)]),
);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

const args = process.argv.slice(2);
function option(name: string, fallback: string): string {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--"))
    throw new Error(`Missing value for ${name}`);
  return args[index + 1];
}
const baselinePath = option(
  "--baseline",
  "docs/reports/mbpp-validated-single-100-2026-11-13.json",
);
const output = option(
  "--output",
  "docs/reports/speculative-review-preparation-2026-11-14.json",
);
const repeats = Number(option("--repeats", "5"));
const threshold = Number(option("--threshold", "0.2"));
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20)
  throw new Error("Repeats must be an integer from 1 to 20");
if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)
  throw new Error("Threshold must be between zero and one");
const baselineBytes = await readFile(baselinePath, "utf8");
const baseline = JSON.parse(baselineBytes) as BenchmarkReport;
if (baseline.evaluationValidity?.valid !== true)
  throw new Error("A validated baseline report is required");
const corpusPath = option("--cases", "");
const corpus: ReviewCase[] = corpusPath
  ? JSON.parse(await readFile(corpusPath, "utf8"))
  : DEFAULT_REVIEW_CASES;
const setupStart = performance.now();
const index = await CodeSimilarityIndex.create(corpus);
index.assertDisjoint(baseline.results.map((result) => result.problemId));
const problems = await loadMBPP({
  problemIds: baseline.results.map((result) => result.problemId),
  sanitized: true,
});
if (
  problems.length !== baseline.results.length ||
  problems.some((problem, i) => problem.id !== baseline.results[i].problemId)
)
  throw new Error("Dataset problem set changed");
const setupMs = performance.now() - setupStart;
const expectedContexts = new Map<string, string>();
type Row = PreparationMetrics & {
  problemId: string;
  contextHash?: string;
  cases: Array<{ id: string; similarity: number }>;
};
const runs: Array<{
  round: number;
  mode: PreparationMode;
  wallMs: number;
  rows: Row[];
}> = [];
const modes: PreparationMode[] = ["sequential", "eager", "predictive"];
for (let round = 0; round < repeats; round++) {
  // Rotate order to reduce a fixed first-run/last-run bias. No synthetic delays.
  const order = [...modes.slice(round % 3), ...modes.slice(0, round % 3)];
  for (const mode of order) {
    const predictor = new ReviewNeedPredictor();
    const rows: Row[] = [];
    const start = performance.now();
    for (let position = 0; position < problems.length; position++) {
      const problem = problems[position];
      const sample = baseline.results[position];
      const result = await prepareNextReview({
        code: sample.generatedCode,
        mode,
        predictor,
        threshold,
        runTool: () =>
          executeWithTests(
            sample.generatedCode,
            problem.tests,
            problem.setupCode,
            { timeout: 30000 },
          ),
        needsReview: (tests) => !tests.success,
        prepare: () => index.search(sample.generatedCode),
      });
      if (result.tool.success !== sample.success)
        throw new Error(
          `Test outcome changed for ${problem.id}; stop comparison`,
        );
      const contextHash = result.metrics.needed
        ? sha(JSON.stringify(result.context ?? []))
        : undefined;
      if (contextHash) {
        if (
          expectedContexts.has(problem.id) &&
          expectedContexts.get(problem.id) !== contextHash
        )
          throw new Error(
            `Review context changed across strategies for ${problem.id}`,
          );
        expectedContexts.set(problem.id, contextHash);
      }
      rows.push({
        problemId: problem.id,
        ...result.metrics,
        contextHash,
        cases: (result.context ?? []).map(({ id, similarity }) => ({
          id,
          similarity,
        })),
      });
    }
    const run = {
      round: round + 1,
      mode,
      wallMs: performance.now() - start,
      rows,
    };
    runs.push(run);
    console.log(
      JSON.stringify({
        round: run.round,
        mode,
        wallMs: Math.round(run.wallMs),
        started: rows.filter((row) => row.speculative).length,
        adopted: rows.filter((row) => row.adopted).length,
        discarded: rows.filter((row) => row.discarded).length,
      }),
    );
  }
}
for (const path of sourceFiles) {
  if (sha(await readFile(path, "utf8")) !== sourceHashes[path])
    throw new Error(`Source changed during measurement: ${path}`);
}
const report = {
  experiment: "read-only related-code preparation during Python test execution",
  timestamp: new Date().toISOString(),
  baselinePath,
  baselineSha256: sha(baselineBytes),
  sourceCommit,
  sourceSnapshots,
  sourceHashes,
  corpusSha256: sha(JSON.stringify(corpus)),
  corpusCases: corpus,
  threshold,
  repeats,
  problemCount: problems.length,
  setupMs,
  additionalLlmCalls: 0,
  additionalLlmTokens: 0,
  reviewContextsIdentical: true,
  problemSnapshot: problems.map((problem, position) => ({
    id: problem.id,
    statement: problem.text,
    tests: problem.tests,
    setupCode: problem.setupCode,
    candidateSha256: sha(baseline.results[position].generatedCode),
  })),
  limitations: [
    "Measures only test and retrieval scheduling, not end-to-end agent latency or correctness after Critic.",
    "Preparation durations are wall time, not CPU time.",
    "Local child-process contention is included; unused preparations are drained and charged.",
    "Repeated timing measurements replay the same answers; they are not repeated model samples.",
    "Similarity scores are structural/lexical, not semantic correctness probabilities.",
  ],
  runs,
};
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(`Report saved to ${output}`);
