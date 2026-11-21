# Static Features and Bayesian Critic Scheduling Walkthrough

The first predictor should estimate how often a fixed Critic produces an independently verified counterexample for a comparable code snapshot under a fixed review budget. Static analysis supplies observable code features; past verified outcomes supply the evidence for the probability. Static analysis does not itself establish that a pruning decision or algorithm is incorrect.

This walkthrough uses real Clang AST extraction from the existing C++ fixture and measured timings from the preceding pilot. Its training counts, probability threshold, minimum overlap threshold, and eight-second build are explicitly hypothetical. No new LLM calls, predictor training, or production scheduling changes are made.

## Outcome and observation rules

Define Y = 1 when a proposed counterexample passes the input constraints and independent execution confirms a specification violation within the configured Critic and verification budgets. Define Y = 0 when a normal, eligible attempt ends without confirmed evidence, including a budget-limited incomplete response. Keep invalid inputs, unsupported claims, and exhausted budgets as distinct diagnostic reasons. Do not label API outages, a broken verifier, or an unavailable runtime as 0.

Use buildable, fixed code snapshots for the first dataset. Track compile failures and their wasted work separately. Keep the review-computation budget and verification budget independent of time spent waiting for a build artifact, so that changing start time does not silently change the label definition. End-to-end time to verified feedback is a separate scheduling metric.

The observation key must include the Critic model, prompt version, token/time budgets, verifier version, language and code snapshot. Do not pool outcomes from different review policies by default. Repeated reviews, translations and revisions of the same problem must stay in the same evaluation group; they are not independent new problems. Both early and deferred reviews should produce labels after completion. A skipped review has an unknown outcome, not label 0. Use separately budgeted random audits or a fully reviewed held-out sample to measure missed opportunities and avoid learning only from selected high-probability cases.

## Features to extract

| Category            | Direct observations or conservative estimates                                          | Interpretation                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Size                | Nonempty source lines, tokens, function count                                          | Size alone is not a defect signal                                                                |
| Control flow        | Explicit loops, maximum syntactic nesting, if/switch branches, recursion when resolved | Branch complexity and loop depth are not asymptotic runtime                                      |
| Data representation | Declared container types, explicit index dimensions, element fields                    | Two-dimensional state is observable; whether it is sufficient requires the problem specification |
| State changes       | Conditional erase, remove, break, continue, early return, overwrite sites              | These identify decisions to inspect, not necessarily invalid pruning                             |
| Operations          | Resolved sorting, searching, heap and container calls                                  | Use declaration information where available; name matching alone is a limited heuristic          |
| Resource growth     | Recognizable input-dependent loop bounds and allocations                               | Emit unknown when the bounds or called functions cannot be justified                             |
| Diagnostics         | Parser status and available compiler/analyzer warnings                                 | Use only diagnostics available before the scheduling decision                                    |

For time and space complexity, record the basis and confidence of any estimate. A nested loop can still have linear total work, and library calls can dominate cost. This demonstration returns unknown for both complexities rather than converting loop depth into an unsupported Big-O claim. Problem constraints should come from explicit task metadata or separately reviewed extraction, not be silently inferred from variable names.

The [Clang AST documentation](https://clang.llvm.org/docs/IntroductionToTheClangAST.html) describes the declarations, statements and AST-dump facility used for the real C++ observations.

## A small concrete example

The weighted-interval fixture sorts jobs by ending time, keeps a vector of selected jobs, and conditionally removes overlapping selections before inserting a new job. The current extractor found:

| Feature                         | Observed value                       |
| ------------------------------- | ------------------------------------ |
| Nonempty lines in solve         | 20                                   |
| Explicit loops                  | 3                                    |
| Maximum loop nesting            | 2                                    |
| If statements                   | 2                                    |
| Selected-state container        | std::vector of fixed-size job arrays |
| Sort call                       | Present                              |
| Push-back call                  | Present                              |
| Conditional erase within a loop | Present                              |
| Time complexity                 | Unknown to this extractor            |
| Space complexity                | Unknown to this extractor            |

These facts are extracted from the AST, without asking an LLM to interpret the code. The prototype is scoped to this source fixture and is not a general multi-language analyzer. Conditional erase is a syntactic feature; it does not prove a greedy rule is invalid.

## Transparent initial Bayesian model

Start with four feature groups formed by two binary observations:

`group = (conditional erase within a loop, maximum loop nesting >= 2)`

The example belongs to `(true, true)`. Initially only these two features select the group. Record the other features for later investigation; do not imply that they already influence this predictor. Four groups are a small baseline, not evidence that these are the best features. More features would create sparse groups and require more data or a different model.

For each group g, use `p_g ~ Beta(alpha0, beta0)` and model eligible outcomes as Bernoulli observations. After s confirmed counterexamples and f attempts without one:

`posterior = Beta(alpha0 + s, beta0 + f)`

`P(next Y = 1 | group, history) = (alpha0 + s) / (alpha0 + beta0 + s + f)`

This is feature-conditioned frequency estimation with prior smoothing and posterior uncertainty. It does not reason about the correctness of the algorithm. The [MIT conjugate-prior lecture](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/mit18_05_s22_lec15.pdf) describes the underlying Beta/Bernoulli update.

For illustration only, choose Beta(1, 3), with prior mean 0.25. This is an assumed prior, not a measured base rate. Suppose ten distinct earlier eligible examples in this group produced eight verified counterexamples and two unsuccessful attempts. Then:

`Beta(1 + 8, 3 + 2) = Beta(9, 5)`

`predicted probability = 9 / 14 = 0.642857`

The equal-tailed 95 percent credible interval for the group's rate is approximately 0.386 to 0.861 under this model. Ten observations leave substantial uncertainty. The interval concerns uncertainty about the estimated rate, not a proof about this code. No observations from the small pilot are being passed off as those ten training examples.

After a new confirmed counterexample, update to Beta(10, 5), mean 0.667. After an eligible attempt without evidence within budget, update to Beta(9, 6), mean 0.600. An infrastructure failure leaves the posterior unchanged. Update after the result, never before the scheduling decision for that same snapshot.

## Decide whether to review and then when to start

The current policy first decides whether the expected usefulness of a Critic call justifies its resource cost. Low-value candidates may be skipped altogether, with reassessment if tests later reveal new evidence. A possible rule is `predicted probability * value of confirmed feedback > expected review and validation cost`, using compatible units. Alternatively, impose an explicit token or compute budget and evaluate the resulting findings/cost tradeoff. These policy choices are separate from the probability model; no resource threshold has been fitted or validated yet.

The following timing calculation applies only after a review has passed that admission decision. The existing demonstration script implements this timing calculation and hypothetical posterior arithmetic, not the new skip-versus-review admission layer.

For a deliberately simple teaching policy, suppose there is one scarce early-review slot and it is currently available. Start Critic early only if the posterior predictive mean is at least 0.60 and the possible overlap is at least one second. Both thresholds are illustrative and unoptimized.

`remaining build = max(0, estimated total build time - elapsed analysis time)`

`possible overlap = min(remaining build, estimated Critic time)`

The three AST extraction runs had a median of about 0.257 seconds. The preceding C++ pilot measured a median compile time of 0.332 seconds and a Critic time of 9.312 seconds. These were separate measurements, not a concurrent build experiment. Using them as estimates leaves only about 0.075 seconds of possible overlap after analysis, so the teaching policy defers review despite the hypothetical probability of 0.643.

Now assume an eight-second build for a different workload; that duration is not a measurement. If build and analysis start together, the decision at approximately 0.257 seconds sees about 7.743 seconds of remaining build time. Both gates pass, so Critic starts immediately at that point. Ignoring contention and validation time:

- Build-then-review finishes at about `8 + 9.312 = 17.312` seconds.
- Analysis-then-early-review finishes at about `max(8, 0.257 + 9.312) = 9.569` seconds.
- The calculated advance is about 7.743 seconds. It is not an observed speedup.

Feature extraction is part of the cost. A separate compiler front-end pass may consume most of a short build window. Future options include obtaining features while Coder generates a stable snapshot or reusing compiler-produced information early enough; neither option is assumed free or implemented here.

## Verify and update

The earlier C++ pilot independently confirmed this Critic-proposed input:

`jobs = [[0, 10, 10], [0, 5, 6], [5, 10, 6]]`

The program returned 10, while choosing the two touching five-unit jobs yields 12. The example demonstrates what confirmed evidence looks like. It was not supplied to the feature extractor or used as one of the invented historical observations above. A real future success would update only its matching posterior group after validation.

## What must be established before using prediction

The Critic's own tokens and compute are part of the optimization objective. Skipping low-value calls can therefore be useful even without concurrency limits. Always-parallel and always-sequential review remain comparison policies, but neither represents the selective policy's goal. Report resource savings alongside the verified counterexamples missed through skipping; do not call a lower token count an improvement without that quality comparison.

Among reviews already admitted, starting immediately can reduce latency when overlap is possible and introduces no interference. The earlier always-parallel observation applies only to that timing subproblem, not to whether every candidate should be reviewed.

Keep probability estimation, statistical uncertainty, review admission and runtime scheduling separate. A high predicted witness probability does not mean high model uncertainty, and it does not guarantee enough build time to hide a review. Evaluate calibration on held-out problem groups, audited missed findings, time to confirmed feedback, analysis overhead and total resource cost against both always-parallel and always-sequential baselines.

The existing [ReviewNeedPredictor](../../packages/eval/src/speculation/review-preparation.ts) uses loop/branch/plain regex groups and learns whether a test outcome needs review. That label is different from verified counterexample generation. Its old counts and checkpoints must not be reused under the new meaning; the production predictor remains unchanged.

## Reproduce this illustration

```sh
python3 scripts/demo-critic-feature-gate.py
```

- [Measured features and labeled hypothetical calculations](critic-feature-gate-demo-2026-11-21.json)
- [Standalone inspection script](../../scripts/demo-critic-feature-gate.py)
- [Original compiled timing pilot](compiled-critic-timing-2026-11-21.md)

The command makes three local Clang inspections and overwrites only its demonstration output. Timing varies between runs. It neither calls a model nor trains or modifies the production predictor.
