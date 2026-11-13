# Corrected MBPP evaluation: single call versus iterative Critic feedback

On November 13, 2026, Gemini 3.6 Flash evaluated sanitized MBPP positions 101–200 (offset 100, limit 100). This is one run on 100 distinct problems, following the [evaluation pipeline audit](./evaluation-audit-2026-11-13.md). Earlier invalid scores are not pooled with these results.

## Protocol

Source commit: `a834474fb900771e4048ca5fc3620f53d41e59b8`. Temperature: 0.7. Maximum output tokens: 4,096. Python test timeout: 30 seconds per problem. Each problem was checkpointed locally. Both modes used the same Coder system instructions and model settings, with no tools or project memory.

Single-call generation received the complete problem statement and the first example test, then generated one answer. The evaluator ran all supplied tests, including required test imports. The Critic condition replayed those exact initial answers. Initial successes were retained; initial failures were eligible for up to four corrections, giving five Coder attempts in total.

For each correction, a separate Critic context received the problem, candidate code, test setup, and observed failed assertions and exceptions. A fresh Coder context then received the original problem prompt, previous code, and Critic feedback. Neither model received the reference solution. Critic and Coder histories were cleared between requests.

The full pool was fixed before observing its answers. Its four initial failures form an operationally difficult subset, not an independently selected or officially labeled hard benchmark. The initial pool remained easy for this model.

## Results

| Metric                          |  Single call | With iterative Critic feedback |                        Difference |
| ------------------------------- | -----------: | -----------------------------: | --------------------------------: |
| Passed                          | 96/100 (96%) |                   99/100 (99%) | +3 problems, +3 percentage points |
| Sum of recorded problem times   |    622.063 s |                      793.198 s |               +171.135 s (+27.5%) |
| API-reported total tokens       |      110,176 |                        144,287 |                  +34,111 (+31.0%) |
| Input tokens                    |       13,981 |                         19,801 |                            +5,820 |
| Visible candidate output tokens |        5,564 |                          7,179 |                            +1,615 |
| Coder generations               |          100 |                            107 |                                +7 |
| Critic analyses                 |            0 |                              7 |                                +7 |

Total tokens include categories beyond visible output, such as thinking tokens. The stored usage does not separate all such categories. No dollar-cost estimate is made. Critic totals include the shared initial generation costs once; the replay command itself took approximately 171.4 seconds. The initial command took approximately 622.4 seconds; command wall time includes overhead beyond recorded problem durations.

| Initially failed problem | Single-call issue                                                                     | Final Critic outcome | Total Coder attempts |
| ------------------------ | ------------------------------------------------------------------------------------- | -------------------- | -------------------: |
| 229                      | Stable partition matched the written requirement but contradicted one expected result | Failed               |                    5 |
| 311                      | All-bits-set boundary case                                                            | Passed               |                    2 |
| 398                      | Nested-list input caused a TypeError                                                  | Passed               |                    2 |
| 407                      | Return convention when no larger permutation exists                                   | Passed               |                    2 |

Critic recovered three of four initial failures. It did not change any initial success, because successful answers were not re-generated. This is a conditional test-guided repair result, not an independent second pass@1 measurement.

## Data-quality concern: problem 229

The statement requires preserving the relative order of both negative and positive elements. For `[-1, 2, -3, 4, 5, 6, -7, 8, 9]`, a test instead expects `[-1, -3, -7, 4, 5, 6, 2, 8, 9]`, moving positive `2` behind `4, 5, 6`. This conflicts with the stated stable-order requirement.

The official-test aggregate retains the task and reports the failure. As a post-hoc sensitivity check only, excluding this task gives 96/99 initially and 99/99 after Critic corrections. That exclusion was identified after inspecting failures and must not be presented as a predefined benchmark result.

## Interpretation

The iterative Critic workflow gained three passing answers in this run at additional time and token cost. Extra attempts and access to failed-test evidence are part of the treatment; this experiment does not isolate Critic reasoning from those factors. It does not establish statistical significance, general benchmark superiority, or benefits from speculative preparation or parallel execution. Only four initial failures were available, one with a contradictory test.

A stronger follow-up should use a benchmark with independently specified difficulty and a larger failure sample, then repeat the same fixed protocol. This result provides evidence of a small accuracy-versus-compute tradeoff in the tested setting and should be described with that scope in an SOP.

## Artifacts and reproduction

- [Single-call JSON](./mbpp-validated-single-100-2026-11-13.json), run `mwektj4u-o6cnkc`
- [Critic JSON](./mbpp-validated-critic-100-2026-11-13.json), run `mwel705c-oivd76`
- [Initial failure diagnostics](./mbpp-validated-failure-diagnostics-2026-11-13.json)

```bash
npm run build
npm run dev -- --eval --benchmark mbpp --model gemini-3.6-flash --offset 100 --limit 100 --output baseline.json
npm run dev -- --eval --benchmark mbpp --model gemini-3.6-flash --offset 100 --limit 100 --agentic --baseline-report baseline.json --output critic.json
```

The default loader fetches the upstream dataset at execution time; the report does not claim that the upstream URL is a pinned dataset snapshot. Repeated results can differ because of sampling and provider behavior.
