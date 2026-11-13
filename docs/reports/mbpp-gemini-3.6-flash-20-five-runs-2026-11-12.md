# First 20 MBPP problems, five runs: single call and Coder/Critic

> Evaluation audit (2026-11-13): these results were produced before fixing raw-code extraction that could discard imports and global declarations, and before replacing the assertion parser. Treat them as historical pipeline outputs, not validated model-accuracy estimates. See [the audit](./evaluation-audit-2026-11-13.md).

The subsequent [paired comparison](./mbpp-paired-critic-20-five-runs-2026-11-13.md) recorded 93/100 single-call passes, 95/100 blind-retry passes, and 96/100 Critic-retry passes. This historical experiment used different initial prompts and does not isolate the effect of Critic feedback.

On November 12, 2026, `gemini-3.6-flash` evaluated the same first 20 sanitized MBPP problems five times per mode. Agentic mode allowed up to five attempts per problem. Each problem was checkpointed under `~/.beans/eval/<run-id>/checkpoint.json`. All ten runs completed all problems with API-reported token usage recorded.

## Per-run results

| Round | Single Passed | Critic Passed |  Difference | Single time | Critic time | Single tokens | Critic tokens | Single checkpoint | Critic checkpoint |
| ----: | ------------: | ------------: | ----------: | ----------: | ----------: | ------------: | ------------: | ----------------- | ----------------- |
|     1 |         19/20 |         19/20 |  0 problems |     129.8 s |     144.8 s |        23,864 |        44,117 | `mwd9renp-fxk5o2` | `mwd9ui8y-mrl4jb` |
|     2 |         18/20 |         19/20 | +1 problems |     120.9 s |     225.8 s |        22,722 |        70,078 | `mwd9y22f-pw8077` | `mwda0nsb-ppg0ir` |
|     3 |         18/20 |         19/20 | +1 problems |     125.6 s |     143.2 s |        24,080 |        45,352 | `mwda5iai-epki0t` | `mwda87oj-f7oj2z` |
|     4 |         16/20 |         19/20 | +3 problems |     133.6 s |     138.5 s |        25,416 |        44,042 | `mwdabag6-vj73aw` | `mwdae5ty-1pgkim` |
|     5 |         17/20 |         19/20 | +2 problems |     119.4 s |     153.9 s |        22,728 |        46,044 | `mwdah56k-k5atks` | `mwdajpkk-hq0gbn` |

- Round 1: [Single](./mbpp-gemini-3.6-flash-single-20-r1-2026-11-12.json) · [Agentic](./mbpp-gemini-3.6-flash-agentic-20-r1-2026-11-12.json)
- Round 2: [Single](./mbpp-gemini-3.6-flash-single-20-r2-2026-11-12.json) · [Agentic](./mbpp-gemini-3.6-flash-agentic-20-r2-2026-11-12.json)
- Round 3: [Single](./mbpp-gemini-3.6-flash-single-20-r3-2026-11-12.json) · [Agentic](./mbpp-gemini-3.6-flash-agentic-20-r3-2026-11-12.json)
- Round 4: [Single](./mbpp-gemini-3.6-flash-single-20-r4-2026-11-12.json) · [Agentic](./mbpp-gemini-3.6-flash-agentic-20-r4-2026-11-12.json)
- Round 5: [Single](./mbpp-gemini-3.6-flash-single-20-r5-2026-11-12.json) · [Agentic](./mbpp-gemini-3.6-flash-agentic-20-r5-2026-11-12.json)

## Means and ranges

| Metric (per 20-problem run)  |        Single call |        Critic Mode |              Difference |
| ---------------------------- | -----------------: | -----------------: | ----------------------: |
| Mean Passed                  |      17.6/20 (88%) |      19.0/20 (95%) | **+1.4 problems, +7%p** |
| Pass range                   |           16~19/20 |              19/20 |                       — |
| Mean elapsed Time            |            125.9 s |            161.3 s |      +35.4 s, **1.28x** |
| Time range                   |      119.4~133.6 s |      138.5~225.8 s |                       — |
| Mean total tokens            |             23,762 |             49,927 |      +26,165, **2.10x** |
| Total-token range            |      22,722~25,416 |      44,042~70,078 |                       — |
| Mean input tokens            |              2,248 |             22,367 |                 +20,119 |
| Mean candidate output tokens |                842 |              1,184 |                    +342 |
| Mean other tokens\*          |             20,672 |             26,376 |                  +5,704 |
| Mean sum of attempts         |               20.0 |               24.8 |                    +4.8 |
| Estimated standard paid cost | approx. $0.082/run | approx. $0.120/run |     approx. +$0.038/run |

Other tokens are calculated as `totalTokenCount - promptTokenCount - candidatesTokenCount`; they include categories such as thinking tokens, which this stored format does not separate. See the [Gemini token documentation](https://ai.google.dev/gemini-api/docs/generate-content/tokens).

The historical cost estimate uses input at $0.75 per million tokens and output plus thinking at $3.75 per million tokens: `(input × 0.75 + (total − input) × 3.75) / 1,000,000`. These were the pricing assumptions recorded for this experiment; actual charges depend on the plan, free allowance, caching, and applicable pricing. See [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Problems with different outcomes

| MBPP Problem ID | Single Passed count / 5 | Critic Passed count / 5 | Difference |
| --------------: | ----------------------: | ----------------------: | ---------: |
|               4 |                       2 |                       0 |         −2 |
|              56 |                       0 |                       5 |         +5 |
|              57 |                       4 |                       5 |         +1 |
|              61 |                       2 |                       5 |         +3 |

The other 16 problems passed in every run in both modes. Problem 56 had the largest gap, but all five agentic answers passed on the first attempt. The gap therefore cannot be attributed to Critic revisions; both the Coder system prompt and problem prompt differed.

Critic primarily intervened on problem 4, which failed after five attempts in all five runs and increased time and tokens. Problem 61 in round two passed on attempt five. Thus only one of 100 agentic problem evaluations was rescued after retrying. Single-call problem 61 in round three failed because no code was returned; usage was still recorded.

These are observations from five repetitions of a small fixed problem set. Sampling variation and prompt differences limit causal interpretation and generalization to the full benchmark.
