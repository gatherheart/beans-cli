# First 100 MBPP problems: Gemini 3.6 Flash single call and agentic mode

> **Invalid as MBPP performance evidence.** The November 13 audit found that the sanitized dataset uses `prompt`, while the old loader read only `text`; problem statements could therefore be sent as `undefined`. Imports/globals could also be discarded and assertions were rewritten. These files preserve earlier pipeline outputs only. All performance claims require a fresh run with the corrected pipeline. See [the audit](./evaluation-audit-2026-11-13.md).

On November 12, 2026, each mode evaluated the same first 100 sanitized MBPP problems once. Agentic mode used Coder/Critic with up to five attempts per problem. Both runs resumed after their first ten problems and saved a checkpoint after every problem.

| Mode    | Run ID            | Result JSON                                                         | Final passed |
| ------- | ----------------- | ------------------------------------------------------------------- | -----------: |
| Single  | `mwd7rlgk-7z08ss` | [Single call](./mbpp-gemini-3.6-flash-single-100-2026-11-12.json)   |       87/100 |
| Agentic | `mwd7xa48-8kxg79` | [Agentic Mode](./mbpp-gemini-3.6-flash-agentic-100-2026-11-12.json) |       91/100 |

## Cumulative checkpoints every ten problems

Problem IDs and order match between the result files. Times below sum recorded per-problem durations across the first ten and resumed 90 problems; waiting between sessions is excluded. The gap is agentic pass rate minus single-call pass rate, in percentage points.

| Cumulative problems |  Single Passed | Agentic Passed | Pass-rate gap | Single cumulative Time | Agentic cumulative Time | 10-problem segment Passed (Single / Agentic) |
| ------------------: | -------------: | -------------: | ------------: | ---------------------: | ----------------------: | -------------------------------------------: |
|                  10 |   9/10 (90.0%) |   9/10 (90.0%) |         0.0%p |                 53.5 s |                  74.9 s |                                  9/10 / 9/10 |
|                  20 |  17/20 (85.0%) |  19/20 (95.0%) |   **+10.0%p** |                135.1 s |                 184.7 s |                                 8/10 / 10/10 |
|                  30 |  27/30 (90.0%) |  29/30 (96.7%) |        +6.7%p |                197.8 s |                 231.7 s |                                10/10 / 10/10 |
|                  40 |  35/40 (87.5%) |  37/40 (92.5%) |        +5.0%p |                284.3 s |                 408.9 s |                                  8/10 / 8/10 |
|                  50 |  44/50 (88.0%) |  46/50 (92.0%) |        +4.0%p |                336.5 s |                 499.2 s |                                  9/10 / 9/10 |
|                  60 |  52/60 (86.7%) |  55/60 (91.7%) |        +5.0%p |                409.9 s |                 682.8 s |                                  8/10 / 9/10 |
|                  70 |  62/70 (88.6%) |  65/70 (92.9%) |        +4.3%p |                467.3 s |                 744.0 s |                                10/10 / 10/10 |
|                  80 |  70/80 (87.5%) |  74/80 (92.5%) |        +5.0%p |                579.6 s |                 936.0 s |                                  8/10 / 9/10 |
|                  90 |  78/90 (86.7%) |  82/90 (91.1%) |        +4.4%p |                663.1 s |                1224.3 s |                                  8/10 / 8/10 |
|                 100 | 87/100 (87.0%) | 91/100 (91.0%) |        +4.0%p |                744.4 s |                1369.7 s |                                  9/10 / 9/10 |

The largest cumulative gap occurred at 20 problems: agentic passed two more problems (+10 percentage points), arising in problems 11–20. Across all 100 problems, agentic passed four more. Single-only passes were IDs 82, 85, 88, 139, and 163. Agentic-only passes were IDs 56, 61, 77, 84, 87, 100, 126, 138, and 164.

## Time and tokens

| Metric                        |                Single |                Agentic |
| ----------------------------- | --------------------: | ---------------------: |
| Sum of recorded problem times | 744.4 s (12 min 24 s) | 1369.7 s (22 min 50 s) |
| Mean per problem              |                7.44 s |                13.70 s |
| Sum of attempts               |                   100 |                    141 |
| Actual token usage            |          Not recorded |           Not recorded |

Agentic took approximately 1.84 times as long. Token fields are zero because this evaluation path did not propagate API usage metadata at the time; they do not represent zero consumption. Actual tokens and cost cannot be recovered from these files.

This compares one run per mode with different initial prompts. It includes no repeated-run mean or confidence interval and does not isolate the effect of Critic feedback.
