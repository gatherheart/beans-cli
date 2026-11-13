# Evaluating PASTE with MBPP tool calls

The [2026-11-14 live comparison](../reports/mbpp-paste-20-2026-11-14.md)
records the completed 20-task paired experiment, raw results, and limitations.

The tool-agent evaluator gives the model two tools: `submit_solution(code)`
stages a candidate in memory and returns its content-derived candidate ID;
`run_tests(candidateId)` executes the original MBPP assertions in an isolated
Python process. The model must choose both calls. It can revise failing code
within the submission limit. The last submitted candidate is scored by an
independent verification run and must also have received an authoritative test
call. Reference solutions are never included in prompts or tool results.

PASTE learns the transition from submission to testing and the mapping from
the submission result's candidate ID to the next test invocation's argument.
It starts the isolated test while the model generates its next tool call.
Only an exact authoritative call can reuse or promote the speculative result.
The sequential control uses the same prompts, tools, model settings, and
submission limit, with speculation disabled.

This is a tool-calling adaptation of MBPP. It is not the conventional one-call
MBPP pass@1 protocol, and it should not be pooled with older single-call or
Coder/Critic scores.

The prompt explicitly requests submission followed by testing, so this is an
easy next-tool prediction workload. It verifies argument binding, overlap,
reuse, and answer preservation; it does not establish prediction accuracy on
unconstrained agent tasks. Test feedback includes the original assertions and
failure details, and the model may repair its solution within the stated limit.

## Commands

```sh
npm run build

# Sequential control
npm run dev -- --eval --benchmark mbpp --tool-agent \
  --dataset-source docs/reports/mbpp-paste-dataset-2026-11-14.json \
  --limit 20 --max-iterations 3 --output sequential.json

# PASTE with actual disjoint training traces
npm run dev -- --eval --benchmark mbpp --paste \
  --dataset-source docs/reports/mbpp-paste-dataset-2026-11-14.json \
  --tool-training docs/reports/mbpp-paste-20-2026-11-14.json.training.json \
  --limit 20 --max-iterations 3 --output paste.json

# Alternating paired experiment, including four disjoint training tasks
node_modules/.bin/tsx scripts/benchmark-paste-mbpp.ts
```

`--tool-training` accepts an envelope with `version: 1`, `model`, and `problems`.
Each problem has a `problemId` and completed `traces` in the PASTE event format.
Any overlap with evaluation IDs is rejected. A new executor is created for
each evaluated task with the same frozen training traces; earlier evaluated
tasks are not used to warm up later ones. Within-task online observations are
still available. Raw `--paste-traces` is for ordinary agents and is rejected
in evaluation because it lacks problem provenance.

## Isolation and accounting

The isolated runner currently requires macOS `sandbox-exec` and fails closed
on unsupported hosts. The child receives a minimal environment, cannot use
network connections, fork, or write files (apart from `/dev/null`), and cannot
read the user's home or temporary data except its Python installation. Each
test starts a fresh interpreter, has a timeout and output-size limit, and
supports cancellation. The ordinary Python runner remains available for older
evaluation modes; the tool-agent path always requests isolation.

Metrics separate model time, authoritative tool wait, test-process time,
agent completion, cancelled-job cleanup, independent verification, and total
problem time. Provider-reported tokens include every LLM call in the agent
loop. Missing usage and provider failures stop the run instead of being scored
as incorrect answers. Speculative testing makes no additional LLM request.
Overlapping test durations must not be added to model time to reconstruct the
wall-clock total.

The CLI checkpoints each problem and rejects changes to dataset, model
settings, or training on resume. The comparison script writes its own atomic
checkpoint after each training task and each evaluated condition. Rerunning
the same command resumes only when all conditions and source hashes match.
It alternates which condition runs first for successive problems. All source
snapshots used for timing are retained in its output JSON.

The experiment uses saved sanitized MBPP statements, assertions, and setup
code from the earlier validated snapshot. The new dataset artifact contains
no reference code. Evaluation uses its first 20 problems; training uses
positions 81–84. These ranges are fixed before new model outputs are observed.

The two live conditions sample model outputs independently. Total latency
differences can therefore include generation variability and different retry
counts. Report accuracy, tokens, per-task results, and tool wait alongside
latency; do not attribute the complete wall-time difference to PASTE. No
synthetic delay or copied model output is used by the live experiment.

## Gemini tool-history compatibility

The Google client retains each function call's opaque `thoughtSignature` and
replays it on that function-call part. It also resolves function-result names
from the corresponding prior call instead of sending the internal call ID as
the function name. This is required for the real multi-step Gemini workflow;
the initial API rejection was an integration failure, not a scored MBPP
failure. See Google's [thought signature rules](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking/thought-signatures).
