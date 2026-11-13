# MBPP benchmark results: February 16–24, 2026

> Evaluation audit (2026-11-13): these results were produced before fixing raw-code extraction that could discard imports and global declarations, and before replacing the assertion parser. Treat them as historical pipeline outputs, not validated model-accuracy estimates. See [the audit](./evaluation-audit-2026-11-13.md).

Results are consolidated from `~/.beans/eval/<run-id>/checkpoint.json`. All runs used MBPP with `sanitized: true` and a 30-second test timeout per problem.

## Gemini 2.0 Flash

Nine completed runs evaluated the same ten problems (IDs 2, 3, 4, 6, 7, 8, 9, 11, 12, 14): two single-call runs and seven agentic runs. The valid single-call result was 8/10 (80%); the best agentic result was 10/10 (100%), a two-problem, 20-percentage-point gap.

| Mode    | Updated (UTC)    | Run ID            | Passed | Pass rate |
| ------- | ---------------- | ----------------- | -----: | --------: |
| Single  | 2026-02-16 14:41 | `mlpa86m3-y1s3ez` |   0/10 |        0% |
| Single  | 2026-02-16 14:44 | `mlpabzqi-wm93mf` |   8/10 |       80% |
| Agentic | 2026-02-16 14:55 | `mlpapuyz-otd47b` |   8/10 |       80% |
| Agentic | 2026-02-16 14:57 | `mlpash0z-p0067o` |   8/10 |       80% |
| Agentic | 2026-02-16 14:59 | `mlpavksz-t2r2en` |   8/10 |       80% |
| Agentic | 2026-02-17 13:27 | `mlqn0e6z-zlknjc` |   9/10 |       90% |
| Agentic | 2026-02-17 13:28 | `mlqn1ifn-0nh6pj` |   9/10 |       90% |
| Agentic | 2026-02-17 13:33 | `mlqn90zb-vy9nyi` |  10/10 |      100% |
| Agentic | 2026-02-17 14:03 | `mlqob3ia-bu07um` |  10/10 |      100% |

The first 0/10 run reported `No code found in response` on every problem and should not be treated as a valid model-performance measurement. Problems 12 and 14 failed in the other single-call run and passed in the 13:33 agentic run, on attempts two and one respectively. The seven agentic results were 8/10 three times, 9/10 twice, and 10/10 twice. The maximum was reproduced twice, but not consistently. Different execution times and prompts prevent attributing the gap solely to the agentic workflow.

## Qwen 2.5 3B: February 24, 2026

| Metric               |                     Single call |                                      Agentic Mode |
| -------------------- | ------------------------------: | ------------------------------------------------: |
| Run ID               |               `mm0os2p1-de6n9j` |                                 `mm0oso1o-41sj3a` |
| Execution time (UTC) |    2026-02-24 14:14:02–14:14:08 |                      2026-02-24 14:14:29–14:16:20 |
| Model                |                    `qwen2.5:3b` |                                      `qwen2.5:3b` |
| Problems             |                               5 |                                                10 |
| Passed               |                               3 |                                                 6 |
| Pass rate            |                             60% |                                               60% |
| Settings             | `sanitized: true`, 30 s timeout | `sanitized: true`, 30 s timeout, up to 5 attempts |

The runs evaluated different numbers of problems, so aggregate pass rates do not establish a mode advantage. On their five shared problems (2, 3, 4, 6, 7), both passed the same three problems (2, 3, 6).

## Per-problem results

| Problem ID | Single call  | Agentic Mode | Agentic attempts |
| ---------: | ------------ | ------------ | ---------------: |
|          2 | Passed (3/3) | Passed (3/3) |                1 |
|          3 | Passed (4/4) | Passed (4/4) |                2 |
|          4 | Failed (0/3) | Failed (0/3) |                5 |
|          6 | Passed (6/6) | Passed (6/6) |                1 |
|          7 | Failed (0/3) | Failed (0/3) |                5 |
|          8 | Not run      | Passed (3/3) |                1 |
|          9 | Not run      | Failed (0/3) |                5 |
|         11 | Not run      | Passed (3/3) |                2 |
|         12 | Not run      | Failed (0/3) |                5 |
|         14 | Not run      | Passed (3/3) |                3 |

Parentheses show passed tests divided by total tests. Agentic failures on problems 4, 7, 9, and 12 exhausted five attempts. Both checkpoints recorded zero tokens because usage was not propagated; these values cannot support a token-usage comparison.
