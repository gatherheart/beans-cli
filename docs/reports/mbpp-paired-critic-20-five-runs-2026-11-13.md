# MBPP paired comparison: single call, blind retry, and Critic

> Evaluation audit (2026-11-13): these results were produced before fixing raw-code extraction that could discard imports and global declarations, and before replacing the assertion parser. Treat them as historical pipeline outputs, not validated model-accuracy estimates. See [the audit](./evaluation-audit-2026-11-13.md).

2026-11-13. Gemini 3.6 Flash; the same first 20 sanitized MBPP problems, repeated five times.

## Method

Each round first generated 20 fresh single-call answers. Both retry arms reused those exact initial answers. Successful answers were retained; failures received up to four additional code-generation attempts (five total). Every result was checkpointed under `~/.beans/eval/`.

- Single call: one answer with the original problem prompt and one example test.
- Blind retry: fresh context and the exact original prompt on every retry. The model received no previous code, failure notification, failed tests, or correction instruction.
- Critic: a separate context received the problem, previous code, and failed tests. A fresh Coder context received the original prompt, previous code, and Critic analysis. Both arms used the same Coder system prompt and model settings.

The first answers were deliberately replayed to control starting conditions; they were not regenerated for each retry arm. The single-call baseline itself made fresh API calls in all five rounds. No local LLM response cache is implemented.

## Results

| Round | Single | Blind retry | Critic | Single time (s) | Blind time (s) | Critic time (s) | Single tokens | Blind tokens | Critic tokens |
| ----: | -----: | ----------: | -----: | --------------: | -------------: | --------------: | ------------: | -----------: | ------------: |
|     1 |  18/20 |       19/20 |  19/20 |           158.9 |          226.3 |           224.3 |        25,984 |       39,203 |        44,198 |
|     2 |  19/20 |       19/20 |  19/20 |           148.1 |          223.0 |           195.4 |        25,022 |       39,364 |        38,153 |
|     3 |  18/20 |       19/20 |  19/20 |           141.4 |          221.0 |           215.2 |        22,790 |       36,061 |        41,468 |
|     4 |  19/20 |       19/20 |  19/20 |           160.6 |          252.1 |           239.5 |        24,455 |       38,693 |        44,113 |
|     5 |  19/20 |       19/20 |  20/20 |           153.9 |          211.4 |           177.1 |        25,664 |       39,294 |        31,783 |

| Mean per 20-problem round |     Single | Blind retry |     Critic |
| ------------------------- | ---------: | ----------: | ---------: |
| Passed                    | 18.6 (93%) |  19.0 (95%) | 19.2 (96%) |
| Time                      |    152.6 s |     226.7 s |    210.3 s |
| Total tokens              |     24,783 |      38,523 |     39,943 |

Time and tokens in the replay arms include the shared baseline costs once. Time is the sum of recorded problem durations, including test replay overhead; it is not the wall time of the replay command alone. Tokens are API-reported total tokens, including categories beyond visible output. No dollar estimate is made.

Of 100 initial answers, 93 passed and seven failed. Both arms rescued problem 4 in rounds 1 and 3. Critic additionally rescued problem 56 in round 5; blind retry did not. Thus Critic finished one problem ahead of blind retry (+1 percentage point), and three ahead of single call (+3 percentage points).

Relative to blind retry, Critic used 1,420 more tokens per round (+3.7%) and recorded 16.5 fewer seconds (-7.3%). Latency is descriptive: blind retry always ran first, the API was not isolated, and request durations varied. These measurements do not establish a general latency advantage.

## Limits and interpretation

This is 20 distinct problems repeated five times, not 100 distinct problems. Only seven initial failures were exposed to the intervention. The one additional rescue is an observed difference, not strong evidence that Critic feedback generalizes. A larger, preregistered problem set and randomized arm order would provide stronger evidence.

Earlier 88% versus 95% results used different initial prompts and independent initial samples. They remain historical observations and should not be cited as an isolated Critic effect. This experiment also does not test speculative preparation or parallel execution; those remain separate hypotheses.

## Raw reports

- Round 1: [matched-single](./mbpp-matched-single-20-r1-2026-11-13.json) · [blind-retry](./mbpp-blind-retry-20-r1-2026-11-13.json) · [critic-replay](./mbpp-critic-replay-20-r1-2026-11-13.json)
- Round 2: [matched-single](./mbpp-matched-single-20-r2-2026-11-13.json) · [blind-retry](./mbpp-blind-retry-20-r2-2026-11-13.json) · [critic-replay](./mbpp-critic-replay-20-r2-2026-11-13.json)
- Round 3: [matched-single](./mbpp-matched-single-20-r3-2026-11-13.json) · [blind-retry](./mbpp-blind-retry-20-r3-2026-11-13.json) · [critic-replay](./mbpp-critic-replay-20-r3-2026-11-13.json)
- Round 4: [matched-single](./mbpp-matched-single-20-r4-2026-11-13.json) · [blind-retry](./mbpp-blind-retry-20-r4-2026-11-13.json) · [critic-replay](./mbpp-critic-replay-20-r4-2026-11-13.json)
- Round 5: [matched-single](./mbpp-matched-single-20-r5-2026-11-13.json) · [blind-retry](./mbpp-blind-retry-20-r5-2026-11-13.json) · [critic-replay](./mbpp-critic-replay-20-r5-2026-11-13.json)

## Reproduce one round

```bash
npm run dev -- --eval --benchmark mbpp --model gemini-3.6-flash --limit 20 --output baseline.json
npm run dev -- --eval --benchmark mbpp --model gemini-3.6-flash --limit 20 --agentic --baseline-report baseline.json --blind-retry --output blind.json
npm run dev -- --eval --benchmark mbpp --model gemini-3.6-flash --limit 20 --agentic --baseline-report baseline.json --output critic.json
```
