import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { executePython } from "../packages/eval/src/execution/python-runner.js";

const report =
  process.argv[2] ?? "docs/reports/critic-evidence-2026-11-21.json";
const state = JSON.parse(await readFile(report, "utf8")) as {
  candidates: { id: string; code: string }[];
};
const measurements = [];
for (const candidate of state.candidates) {
  const script = `import json, time, statistics
source = json.loads(${JSON.stringify(JSON.stringify(candidate.code))})
samples = []
for _ in range(200):
    start = time.perf_counter_ns()
    compile(source, "candidate.py", "exec")
    samples.append((time.perf_counter_ns() - start) / 1e6)
print(json.dumps({"repetitions": len(samples), "medianMs": statistics.median(samples), "minMs": min(samples), "maxMs": max(samples)}))`;
  const started = performance.now();
  const result = await executePython(script, { isolated: true, timeout: 5000 });
  if (!result.success)
    throw new Error(result.stderr || "Compilation timing failed");
  measurements.push({
    candidateId: candidate.id,
    ...JSON.parse(result.stdout),
    workerElapsedMs: performance.now() - started,
  });
}
const output = report.replace(/\.json$/, ".compilation.json");
await writeFile(
  output,
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      scope:
        "Supplementary local Python source-to-bytecode compilation timing, requested during the review pilot. No LLM calls. No full build, tests, concurrent scheduling, or end-to-end speedup measured.",
      measurements,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ output, measurements }));
