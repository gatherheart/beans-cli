# Compiled Language Critic Timing Results

Status: **complete**. This feasibility pilot compiled one equivalent authored program in each of Rust, Java, Kotlin, and C++, three times per language, and made one isolated Critic call per language.

Each program implements the same locally greedy weighted-interval rule with a known algorithmic defect. The model did not receive that label or a counterexample. These are four translations of one problem, not four independent problems. The sample measures feasibility and timing, not detection accuracy or language superiority.

## Compilation and review measurements

| Language | Three compilation runs in seconds | Median compilation seconds | Critic seconds | Total model tokens | Executed evidence |
| -------- | --------------------------------- | -------------------------: | -------------: | -----------------: | ----------------- |
| rust     | 0.580, 0.177, 0.181               |                      0.181 |         12.193 |               3363 | confirmed         |
| java     | 0.284, 0.253, 0.257               |                      0.257 |         12.806 |               3604 | confirmed         |
| kotlin   | 2.216, 1.867, 1.975               |                      1.975 |         12.862 |               3474 | confirmed         |
| cpp      | 0.583, 0.330, 0.332               |                      0.332 |          9.312 |               2658 | confirmed         |

Compilation used fresh output directories, but operating-system caches were not cleared. These are standalone compiler invocations, not incremental project builds. Rust and C++ include linking; Java and Kotlin produce JVM classes. The compiled JVM programs are launched separately during witness validation. All four programs failed the same 25 of 200 private checks before review, confirming that the intended algorithmic defect survives translation.

The model was gemini-3.6-flash with temperature 0.7 and an 8192-token output budget. No hard Critic latency deadline was enforced in this timing pilot; a deadline must be specified before constructing time-budgeted predictor labels. The earlier Python context experiment used a 4096-token cap, so the two experiments are not pooled. Only problem text and the language-specific source were sent to the Critic. No static-analysis predictor or similarity retrieval was used.

## Verified examples

### rust

Verdict: `incorrect`. Evidence: `confirmed`.

```json
{
  "kind": "counterexample",
  "input": {
    "jobs": [
      [0, 5, 10],
      [5, 10, 10],
      [0, 10, 15]
    ]
  },
  "expected": 20,
  "predicted_actual": 15
}
```

Independent validation: `{"status": "confirmed", "confirmed": true, "expected": 20, "actual": 15, "fullyValidated": true, "executionSeconds": 0.004750667}`.

### java

Verdict: `incorrect`. Evidence: `confirmed`.

```json
{
  "kind": "counterexample",
  "input": {
    "jobs": [
      [0, 4, 10],
      [4, 8, 10],
      [1, 6, 15]
    ]
  },
  "expected": 20,
  "predicted_actual": 15
}
```

Independent validation: `{"status": "confirmed", "confirmed": true, "expected": 20, "actual": 15, "fullyValidated": true, "executionSeconds": 0.09641329200000001}`.

### kotlin

Verdict: `incorrect`. Evidence: `confirmed`.

```json
{
  "kind": "counterexample",
  "input": {
    "jobs": [
      [0, 5, 10],
      [4, 10, 11],
      [9, 15, 10]
    ]
  },
  "expected": 20,
  "predicted_actual": 11
}
```

Independent validation: `{"status": "confirmed", "confirmed": true, "expected": 20, "actual": 11, "fullyValidated": true, "executionSeconds": 0.059824709000000004}`.

### cpp

Verdict: `incorrect`. Evidence: `confirmed`.

```json
{
  "kind": "counterexample",
  "input": {
    "jobs": [
      [0, 10, 10],
      [0, 5, 6],
      [5, 10, 6]
    ]
  },
  "expected": 12,
  "predicted_actual": 10
}
```

Independent validation: `{"status": "confirmed", "confirmed": true, "expected": 12, "actual": 10, "fullyValidated": true, "executionSeconds": 0.0037355000000000027}`.

## What the measurements support

The measured times establish whether there is an overlap window for these small programs. They do not measure a concurrently scheduled pipeline. Under an idealized model with no contention, overlap can hide at most the smaller of compilation time and Critic time. For a small program whose Critic call lasts longer than compilation, most Critic latency remains after the build completes.

| Language | Ideal overlap window in seconds | Validation seconds |
| -------- | ------------------------------: | -----------------: |
| rust     |                           0.181 |              0.072 |
| java     |                           0.257 |              0.156 |
| kotlin   |                           1.975 |              0.133 |
| cpp      |                           0.332 |              0.071 |

The overlap column is calculated, not an observed speedup. A larger clean build or a real incremental rebuild may produce a different window. No sleeps, dependency downloads, or artificial project enlargement were used to make compilation take longer.

## Prediction target and next decision

The accepted prediction target is the probability that the Critic produces an independently confirmed counterexample for the current source snapshot within a fixed time and token budget. A confirmed outcome receives label 1; an attempted review without confirmed evidence within that budget receives label 0. Infrastructure failures are excluded. This target combines the presence of a detectable defect with the Critic's ability to find evidence; it is not simply code incorrectness.

This small pilot does not train a Bayesian predictor or call a separate prediction Reviewer. Their proposed inputs, costs and evaluation safeguards are documented in the scheduling plan. If low-probability candidates are still reviewed after compilation, prediction changes start time rather than eliminating review calls. A later scheduling test must therefore compare predicted scheduling with both always-parallel and always-sequential execution.

## Reproduce and inspect

```sh
python3 scripts/compiled-critic.py prepare
./node_modules/.bin/tsx scripts/benchmark-compiled-critic.ts
python3 scripts/report-compiled-critic.py
```

The preparation script refuses to overwrite an existing report. Preserve the current report and use an isolated checkout or explicitly change the output paths for a new run. The fixture programs and validation logic are local; Kotlin dependencies were found in the existing Gradle cache.

- [Raw commands, sources, responses and measurements](compiled-critic-timing-2026-11-21.json)
- [Exact experiment source snapshots](compiled-critic-timing-2026-11-21.sources.json)
- [Pilot plan](compiled-critic-timing-plan-2026-11-21.md)
- [Prediction and scheduling plan](critic-compile-overlap-plan-2026-11-21.md)
- [Compilation and validation runner](../../scripts/compiled-critic.py)
- [Critic runner](../../scripts/benchmark-compiled-critic.ts)
