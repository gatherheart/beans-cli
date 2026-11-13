import { readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Config } from "@beans/core";
import { loadMBPP, solveToolAgentProblem, checkToolSandbox } from "@beans/eval";
import type { EvaluationResult, ToolTraining } from "@beans/eval";

const args = process.argv.slice(2);
function option(name: string, fallback: string): string {
  const position = args.indexOf(name);
  if (position < 0) return fallback;
  const value = args[position + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`Missing value for ${name}`);
  return value;
}
const dataset = option(
  "--dataset",
  "docs/reports/mbpp-paste-dataset-2026-11-14.json",
);
const output = option("--output", "docs/reports/mbpp-paste-20-2026-11-14.json");
const limit = Number(option("--limit", "20"));
const trainingOffset = Number(option("--training-offset", "80"));
const trainingLimit = Number(option("--training-limit", "4"));
const rounds = Number(option("--rounds", "1"));
if (
  ![limit, trainingOffset, trainingLimit, rounds].every(Number.isInteger) ||
  limit < 1 ||
  trainingOffset < limit ||
  trainingLimit < 2 ||
  rounds < 1
)
  throw new Error("Invalid experiment ranges");
const config = await Config.getInstance();
const selectedModel = option("--model", config.getLLMConfig().model);
config.applySessionOverrides({
  llm: { ...config.getLLMConfig(), model: selectedModel },
});
const model = config.getLLMConfig();
const modelSettings = {
  model: model.model,
  provider: model.provider,
  temperature: model.temperature,
  maxTokens: model.maxTokens,
};
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const sourceFiles = [
  "packages/core/src/llm/client.ts",
  "packages/core/src/agents/types.ts",
  "packages/core/src/agents/executor.ts",
  "packages/core/src/speculation/paste.ts",
  "packages/core/src/speculation/patterns.ts",
  "packages/eval/src/runner/tool-agent-runner.ts",
  "packages/eval/src/execution/python-runner.ts",
  "scripts/benchmark-paste-mbpp.ts",
];
const sourceSnapshots = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (path) => [path, await readFile(path, "utf8")]),
  ),
);
const sourceHashes = Object.fromEntries(
  Object.entries(sourceSnapshots).map(([path, contents]) => [
    path,
    sha(contents),
  ]),
);
const datasetBytes = await readFile(dataset, "utf8");
const problems = await loadMBPP({ source: dataset });
if (trainingOffset + trainingLimit > problems.length)
  throw new Error(
    "Dataset does not contain the requested disjoint training range",
  );
const evaluated = problems.slice(0, limit);
const trainingProblems = problems.slice(
  trainingOffset,
  trainingOffset + trainingLimit,
);
const settings = {
  datasetSha256: sha(datasetBytes),
  limit,
  trainingOffset,
  trainingLimit,
  rounds,
  modelSettings,
  sourceHashes,
};
interface Row {
  round: number;
  mode: "sequential" | "paste";
  result: EvaluationResult;
}
let state: {
  status: string;
  error?: string;
  startedAt: string;
  updatedAt: string;
  settings: typeof settings;
  sourceSnapshots: typeof sourceSnapshots;
  trainingResults: EvaluationResult[];
  rows: Row[];
} = {
  status: "running",
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  settings,
  sourceSnapshots,
  trainingResults: [],
  rows: [],
};
try {
  const previous = JSON.parse(await readFile(output, "utf8")) as typeof state;
  if (JSON.stringify(previous.settings) !== JSON.stringify(settings))
    throw new Error(
      "Existing experiment conditions changed; use a new output path",
    );
  state = previous;
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
    throw error;
}
const save = async () => {
  state.updatedAt = new Date().toISOString();
  await writeFile(`${output}.tmp`, JSON.stringify(state, null, 2) + "\n");
  await rename(`${output}.tmp`, output);
};
const training = (): ToolTraining => ({
  version: 1,
  model: model.model,
  problems: state.trainingResults.map((result) => ({
    problemId: result.problemId,
    traces: result.toolTraces ?? [],
  })),
});
try {
  await checkToolSandbox();
  state.status = "running";
  delete state.error;
  for (const problem of trainingProblems) {
    if (state.trainingResults.some((result) => result.problemId === problem.id))
      continue;
    const result = await solveToolAgentProblem(config, problem, {
      paste: false,
      training: { version: 1, model: model.model, problems: [] },
      maxIterations: 3,
    });
    state.trainingResults.push(result);
    await save();
    console.log(
      JSON.stringify({
        phase: "training",
        problemId: result.problemId,
        passed: result.success,
        calls: result.metrics.toolAgent?.llmCalls,
        tokens: result.metrics.totalTokens,
      }),
    );
  }
  await writeFile(
    `${output}.training.json`,
    JSON.stringify(training(), null, 2) + "\n",
  );
  for (let round = 1; round <= rounds; round++) {
    for (let index = 0; index < evaluated.length; index++) {
      const problem = evaluated[index];
      const order =
        (index + round) % 2
          ? (["sequential", "paste"] as const)
          : (["paste", "sequential"] as const);
      for (const mode of order) {
        if (
          state.rows.some(
            (row) =>
              row.round === round &&
              row.mode === mode &&
              row.result.problemId === problem.id,
          )
        )
          continue;
        const result = await solveToolAgentProblem(config, problem, {
          paste: mode === "paste",
          training: training(),
          maxIterations: 3,
        });
        state.rows.push({ round, mode, result });
        await save();
        console.log(
          JSON.stringify({
            phase: "evaluation",
            round,
            mode,
            completed: state.rows.length,
            expected: rounds * limit * 2,
            problemId: problem.id,
            passed: result.success,
            agentMs: Math.round(result.metrics.toolAgent?.agentMs ?? 0),
            tokens: result.metrics.totalTokens,
            paste: result.metrics.toolAgent?.paste,
          }),
        );
      }
    }
  }
  for (const path of sourceFiles)
    if (sha(await readFile(path, "utf8")) !== sourceHashes[path])
      throw new Error(`Source changed during experiment: ${path}`);
  state.status = "complete";
  await save();
} catch (error) {
  state.status = "failed";
  state.error = error instanceof Error ? error.message : String(error);
  await save();
  throw error;
}
