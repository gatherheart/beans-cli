# Speculative related-code preparation: initial timing experiment

On November 14, 2026, the same 100 saved candidates from the [corrected MBPP evaluation](./mbpp-validated-100-2026-11-13.md) were replayed under three preparation strategies, five times per strategy. This is 15 scheduling runs, not 15 new model evaluations. Four candidates fail their tests; 96 pass. No LLM was called in this experiment.

The intended future task is retrieval of similar code cases for Critic review. A prediction must be made before the current tests finish. A correct prediction allows retrieval to overlap those tests; unnecessary retrieval is discarded and charged. On a prediction miss, the same retrieval runs after failed tests.

## Controls and implementation

All strategies used the same eight generic debugging cases, candidate code, tests, code-similarity algorithm, and retrieval limits. No current test result or reference solution was used to predict or search. Corpus overlap checks reject recorded evaluation problem IDs. The retrieval corpus is generic and does not establish coverage of the four observed failures.

Similarity is 60% cosine similarity of normalized token trigrams plus 40% cosine similarity of AST node-type histograms. These are structural/lexical scores, not probabilities of semantic relevance. The predictor uses Beta(1, 3) priors in three code-feature buckets, updated only after completed past test outcomes, with threshold 0.2.

Each round reset the online predictor. Strategy order rotated by round. Actual Python subprocesses and parsing were measured without inserted sleeps or simulated tool latency. At most one preparation ran alongside each test process. Unused preparation was drained before proceeding, so the primary elapsed measurement includes that cost and process contention.

## Timing results

All figures below are per 100-candidate replay, averaged over five repetitions.

| Metric                                   |    Sequential | Always prefetch | Predictive prefetch |
| ---------------------------------------- | ------------: | --------------: | ------------------: |
| Measured replay wall time                |       9.039 s |         9.695 s |             9.127 s |
| Wall-time range                          | 8.831–9.224 s |   9.612–9.848 s |       9.014–9.243 s |
| Sum of tool durations                    |       8.679 s |         9.399 s |             8.820 s |
| Waiting for context after failed tests   |       0.357 s |         0.012 s |             0.275 s |
| All retrieval wall durations summed      |       0.357 s |         9.620 s |             1.332 s |
| Wasted preparation wall durations summed |           0 s |         9.233 s |             0.964 s |
| Searches started speculatively           |             0 |             100 |                  11 |
| Speculative results adopted              |             0 |               4 |                   1 |
| Speculative results discarded            |             0 |              96 |                  10 |
| Required searches started after failure  |             4 |               0 |                   3 |
| Preparation errors                       |             0 |               0 |                   0 |

Shared index initialization plus dataset loading took approximately 0.441 seconds, outside mode timing. Summed retrieval durations overlap other work and must not be interpreted as CPU time or added to tool duration to reconstruct wall time.

Compared with always-prefetch, predictive prefetch reduced speculative starts by 89%, discarded searches from 96 to 10, and mean wall time by approximately 5.9%. Compared with sequential preparation, it took approximately 1.0% longer on average; their timing ranges overlap. **This experiment does not demonstrate a latency improvement over the sequential control.**

The predictor's prefetch precision was 1/11 (9.1%) and recall was 1/4 (25%) on each replay. The remaining three failures used the on-demand fallback, preserving their available review context. All strategies passed the same 96 candidates and produced identical retrieved review contexts for every failing candidate, verified by content hashes. This equality does not mean the retrieved examples are relevant or improve a Critic's answer.

## Why the initial result is limited

Tests were short (approximately 87 ms each on average in the sequential condition), and review was needed on only 4% of candidates. Each retrieval also starts a Python parser process. Running that additional process can lengthen the current test through contention; the measured tool durations show this effect. This is an inference from the observed timing differences, not an isolated measurement of operating-system scheduling.

The online predictor is only a small baseline, and the corpus is a small set of generic examples. Several high-scoring cases resemble code structure without diagnosing the actual failure. The experiment provides evidence about scheduling overhead and wasted work, not retrieval quality or an LLM planning capability.

No live Critic review or code regeneration was timed here. Additional LLM calls and tokens were both zero. A live integration path exists and is covered by tests that verify the retrieved context reaches a separate Critic session; its accuracy and full-request latency remain unmeasured. The contradictory MBPP task 229 remains in this timing workload, as it was in the saved baseline.

## Next experiments

A stronger experiment needs a disjoint corpus of actual reviewed failures, a predictor fitted on a separate trace set, and workloads with naturally longer tools. The same downstream review context should be held constant when comparing scheduling. Persistent parsing or cheaper feature extraction could reduce preparation overhead, but requires a new measured comparison. Synthetic tool delays should be labeled as simulation if used.

## Artifacts

- [Raw runs, source snapshots, corpus, and hashes](./speculative-review-preparation-2026-11-14.json)
- [Implementation and CLI guide](../guides/speculative-review-preparation.md)

```bash
npm run build
npx tsx scripts/benchmark-review-preparation.ts --baseline docs/reports/mbpp-validated-single-100-2026-11-13.json --repeats 5 --output preparation.json
```

The stored source snapshots preserve the exact pre-formatting code used in this measurement, including the replay script. Their SHA-256 hashes can be checked independently. Formatting and later provenance-validation changes do not retroactively change these measured runs.
