# Critic Context and Counterexample Pilot Results

Run status: **complete**. Model: `gemini-3.6-flash` via `google`. Completed 3 Main calls and 108 review calls, with 3 planned repetitions per candidate and treatment.

This pilot compares context retention against isolation and general review against explicit counterexample guidance. The outcome is evidence-backed defect detection and unwarranted rejection, not code repair or overall coding accuracy.

Executed evidence on incorrect controls: Retained context, general review 8/9; Isolated context, general review 8/9; Retained context, counterexample guidance 6/9; Isolated context, counterexample guidance 6/9.

There were 11 malformed or schema-invalid responses. Use the outcome tables below to distinguish incomplete structured output from a valid but incorrect judgment. Repeated reviews of three authored defects do not establish a general advantage for a prompting or context policy.

## Conditions

Temperature was 0.7; the output cap was 4096 tokens. Every candidate received the same four treatments. Calls ran serially, with treatment order rotated across candidates and repetitions. All arms used the same system prompt and output schema. No arm received test outcomes, labels, oracle code, reference solutions, tools, or other reviews.

The sample contains 6 authored controls (three correct and three incorrect) and 3 fresh Main outputs across only three problem families. Retained context for live outputs contains the actual Main request and visible response, including its short explanation. For authored controls it is a constructed assistant-message replay, without a genuine model-generated explanation. Context retention therefore includes extra text and prior assistant attribution; this design does not isolate their individual effects.

The general prompt also permits evidence. The directed prompt asks the reviewer to identify a necessary condition and challenge a potentially invalid code decision. Any difference concerns that guidance, not evidence access or a different model.

## Candidate checks

| Candidate               | Provenance       | Failures in 200 private inputs |
| ----------------------- | ---------------- | -----------------------------: |
| C1                      | authored_control |                              0 |
| C2                      | authored_control |                              2 |
| C3                      | authored_control |                              0 |
| C4                      | authored_control |                              0 |
| C5                      | authored_control |                             25 |
| C6                      | authored_control |                              9 |
| main_bounded_route      | live_main        |                              0 |
| main_weighted_intervals | live_main        |                              0 |
| main_bottleneck_route   | live_main        |                              0 |

These are executions of candidate code, not additional Critic trials. The private evaluator enumerates feasible subsets or paths on small inputs. A live output with no observed failure is not proven correct. The authored correct controls additionally have algorithmic correctness arguments.

## Authored control results

| Treatment                                 | Defects identified | Identified with executed evidence | Passing candidates rejected | Passing candidates accepted | Uncertain | Malformed |
| ----------------------------------------- | -----------------: | --------------------------------: | --------------------------: | --------------------------: | --------: | --------: |
| Retained context, general review          |                8/9 |                               8/9 |                         0/9 |                         8/9 |         0 |         2 |
| Isolated context, general review          |                8/9 |                               8/9 |                         0/9 |                         8/9 |         0 |         2 |
| Retained context, counterexample guidance |                6/9 |                               6/9 |                         0/9 |                         9/9 |         0 |         3 |
| Isolated context, counterexample guidance |                6/9 |                               6/9 |                         0/9 |                         8/9 |         0 |         4 |

Denominators count review calls, including repetitions of the same candidate. A zero faulty denominator means no defect-detection estimate is available for that subset.

## Fresh Main output results

| Treatment                                 | Defects identified | Identified with executed evidence | Passing candidates rejected | Passing candidates accepted | Uncertain | Malformed |
| ----------------------------------------- | -----------------: | --------------------------------: | --------------------------: | --------------------------: | --------: | --------: |
| Retained context, general review          |                0/0 |                               0/0 |                         0/9 |                         9/9 |         0 |         0 |
| Isolated context, general review          |                0/0 |                               0/0 |                         0/9 |                         9/9 |         0 |         0 |
| Retained context, counterexample guidance |                0/0 |                               0/0 |                         0/9 |                         9/9 |         0 |         0 |
| Isolated context, counterexample guidance |                0/0 |                               0/0 |                         0/9 |                         9/9 |         0 |         0 |

Denominators count review calls, including repetitions of the same candidate. A zero faulty denominator means no defect-detection estimate is available for that subset.

## Evidence quality

| Treatment                                 | Evidence proposed | Fully validated evidence | Metamorphic proposals | Confirmed metamorphic violations |
| ----------------------------------------- | ----------------: | -----------------------: | --------------------: | -------------------------------: |
| Retained context, general review          |                 8 |                        8 |                     0 |                                0 |
| Isolated context, general review          |                 8 |                        8 |                     0 |                                0 |
| Retained context, counterexample guidance |                 6 |                        6 |                     0 |                                0 |
| Isolated context, counterexample guidance |                 6 |                        6 |                     0 |                                0 |

A counterexample is fully validated only when its input is legal, execution violates the specification, and both the claimed expected value and predicted actual value match independent checks. An input can expose a real bug while the Critic describes its numerical outcome incorrectly; those outcomes remain separate in the raw records. Metamorphic evidence requires a valid transformation and a violated output relation; that confirmation does not use an exact-answer oracle.

## Per repetition outcomes

| Repetition | Treatment                                 | Control defects with evidence | Correct controls rejected | Fresh passing outputs rejected |
| ---------: | ----------------------------------------- | ----------------------------: | ------------------------: | -----------------------------: |
|          1 | Retained context, general review          |                           3/3 |                       0/3 |                            0/3 |
|          1 | Isolated context, general review          |                           2/3 |                       0/3 |                            0/3 |
|          1 | Retained context, counterexample guidance |                           2/3 |                       0/3 |                            0/3 |
|          1 | Isolated context, counterexample guidance |                           2/3 |                       0/3 |                            0/3 |
|          2 | Retained context, general review          |                           2/3 |                       0/3 |                            0/3 |
|          2 | Isolated context, general review          |                           3/3 |                       0/3 |                            0/3 |
|          2 | Retained context, counterexample guidance |                           2/3 |                       0/3 |                            0/3 |
|          2 | Isolated context, counterexample guidance |                           2/3 |                       0/3 |                            0/3 |
|          3 | Retained context, general review          |                           3/3 |                       0/3 |                            0/3 |
|          3 | Isolated context, general review          |                           3/3 |                       0/3 |                            0/3 |
|          3 | Retained context, counterexample guidance |                           2/3 |                       0/3 |                            0/3 |
|          3 | Isolated context, counterexample guidance |                           2/3 |                       0/3 |                            0/3 |

## Model usage and elapsed time

| Treatment                                 | Calls | Prompt tokens | Completion tokens | Total tokens | Model seconds | Mean seconds per call |
| ----------------------------------------- | ----: | ------------: | ----------------: | -----------: | ------------: | --------------------: |
| Retained context, general review          |    27 |        26,955 |             5,234 |       80,295 |        282.12 |                 10.45 |
| Isolated context, general review          |    27 |        16,341 |             5,816 |       85,200 |        360.61 |                 13.36 |
| Retained context, counterexample guidance |    27 |        29,250 |             5,006 |       84,942 |        301.00 |                 11.15 |
| Isolated context, counterexample guidance |    27 |        18,636 |             5,456 |       77,932 |        316.76 |                 11.73 |

Main generation used 5,423 provider-reported total tokens and 25.61 model seconds. All reviews used 328,369 total tokens. Evidence validation took 9.29 seconds, recorded separately from model latency.

Provider-reported total tokens may include reasoning tokens not included in the reported completion count. Elapsed call time includes provider and network latency. No monetary cost or end-to-end speedup is inferred.

The existing Google adapter maps non-tool completions to `stop`, so that normalized field does not establish that a response was complete. Incomplete JSON is scored as malformed based on its actual content. Provider-native finish reasons were not retained; token-budget exhaustion is not directly verified. The fixed output cap applies to every treatment.

## Findings requiring inspection

- C2, repetition 1, isolated_general: verdict `malformed`, evidence status `malformed`. See the exact response and validation in the raw report.
- C2, repetition 1, retained_counterexample: verdict `malformed`, evidence status `malformed`. See the exact response and validation in the raw report.
- C2, repetition 1, isolated_counterexample: verdict `malformed`, evidence status `malformed`. See the exact response and validation in the raw report.
- C4, repetition 1, isolated_general: verdict `malformed`, evidence status `malformed`. See the exact response and validation in the raw report.
- C2, repetition 2, retained_counterexample: verdict `malformed`, evidence status `malformed`. See the exact response and validation in the raw report.
- C2, repetition 2, isolated_counterexample: verdict `malformed`, evidence status `malformed`. See the exact response and validation in the raw report.
- C2, repetition 2, retained_general: verdict `malformed`, evidence status `malformed`. See the exact response and validation in the raw report.
- C4, repetition 2, retained_general: verdict `malformed`, evidence status `malformed`. See the exact response and validation in the raw report.
- C2, repetition 3, isolated_counterexample: verdict `malformed`, evidence status `malformed`. See the exact response and validation in the raw report.
- C2, repetition 3, retained_counterexample: verdict `malformed`, evidence status `malformed`. See the exact response and validation in the raw report.
- C4, repetition 3, isolated_counterexample: verdict `malformed`, evidence status `malformed`. See the exact response and validation in the raw report.

## Supplementary Python compilation timing

For these 9 Python candidates, source-to-bytecode compilation medians ranged from 0.030 to 0.093 ms over 200 repetitions per candidate. This timing was added after the user proposed overlapping Critic work with compilation. It makes no additional model calls. It measures Python compilation only, not a C++ build, a test suite, or actual concurrent execution. The subprocess startup time is stored separately in the raw timing file.

Compilation alone is too short to hide a seconds-long Critic call in this workload. Any useful overlap would need a longer independent operation, such as substantial test execution, or earlier availability of a stable code snapshot.

[Compilation measurements](critic-evidence-2026-11-21.compilation.json)

## Interpretation limits

The effective problem diversity is three families, not the number of review calls. Controls were deliberately selected to contain known algorithm errors, and the retained-context treatment for those controls is synthetic. If all conditions succeed on these examples, the result does not demonstrate a benefit from context isolation or counterexample guidance. Fresh outputs that contain no observed errors cannot establish recovery from naturally occurring Main mistakes.

This run measures single-pass review followed by external evaluation. The Critic does not receive execution feedback or revise its review. There is no Coder repair loop, retrieval system, formal proof checker, or equal-budget independent re-solving baseline. A self-generated expected answer still requires a trustworthy evaluator; a model-proposed test alone is not independent confirmation.

## Next experiment on concurrent counterexample search

The proposed next design removes similarity retrieval from this experiment. After Coder completes a fixed code snapshot, compilation or tests and an isolated Critic run concurrently. The Critic proposes a counterexample, and the proposed input is executed before feedback is returned to Coder. This pilot does not implement that scheduling change.

The intended deployment workload is Rust, Java, Kotlin, or C++ compilation and builds. The Python timing above is not representative evidence against that proposal. The hypothesis is that overlapping counterexample search with compilation or testing reduces time to verified feedback. Finishing within compilation time is a stronger claim and requires actual timing evidence. In a Python workload, bytecode compilation may provide only a small overlap window. Measure compilation, test execution, Critic generation, witness validation, confirmed defects missed by the existing tests, false claims, and tokens separately. Compare against the existing policy that calls Critic only after a failed test; eager review may spend additional tokens on passing candidates. A latency comparison must use the same candidate snapshots and report extra work, discarded results, and resource contention.

## Reproduce and inspect

```sh
./node_modules/.bin/tsx scripts/benchmark-critic-evidence.ts
python3 scripts/report-critic-evidence.py
python3 scripts/check-critic-evidence-oracle.py
./node_modules/.bin/vitest run tests/eval/critic-evidence.test.ts
```

- [Raw requests, responses, validation and hashes](critic-evidence-2026-11-21.json)
- [Exact experiment source snapshots](critic-evidence-2026-11-21.sources.json)
- [Pre-execution plan](critic-evidence-plan-2026-11-21.md)
- [Compiled language overlap plan](critic-compile-overlap-plan-2026-11-21.md)
- [Candidate fixture](../../tests/fixtures/critic-evidence/cases.json)
- [Runner](../../scripts/benchmark-critic-evidence.ts)
- [Independent validator](../../scripts/critic-evidence-validator.py)
- [Oracle cross-check](../../scripts/check-critic-evidence-oracle.py)

Resuming requires identical settings and source hashes. To rerun the unchanged experiment, choose a new output path with `--output`. Provider failures stop the run and are not scored as incorrect answers. Production Critic behavior is unchanged.
