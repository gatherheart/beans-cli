# Concurrent Counterexample Search During Compiled Language Builds

The [agreed AST and Bayesian Critic workflow](critic-ast-bayesian-workflow-2026-11-21.md) summarizes the current design and its research status for subsequent SOP work. This plan retains the detailed timing and evaluation considerations.

The target workload is Rust, Java, Kotlin, or C++ compilation and builds. Python bytecode compilation from the preliminary review pilot is not representative evidence for or against this proposal.

The objective is to obtain useful, verified feedback while avoiding Critic calls whose expected benefit does not justify their resource cost. For admitted reviews, a second decision determines whether build time can hide some review latency. Similarity retrieval is not part of this design. Context isolation and counterexample guidance remain design choices whose independent benefit must be measured.

## Prediction target and feasibility scope

Predict the probability that a fixed Critic, under a specified time and token budget, produces a counterexample that passes independent execution validation for the current code snapshot. A completed attempt with confirmed evidence has label 1; an attempt without confirmed evidence within the budget has label 0. Infrastructure failures are excluded. This is not the probability that the code is incorrect. Save incomplete responses, unsupported claims, and invalid inputs as separate reasons for an unsuccessful attempt.

For the feasibility pilot, measure one authored implementation of the same small problem in each of Rust, Java, Kotlin, and C++. Run compilation three times per implementation and make one isolated counterexample-guided Critic call per language. Independently execute the proposed witness. These four review calls assess feasibility and timing only; they do not establish comparative language accuracy or predictor quality. Do not implement or train a predictor yet.

## Predictor designs to compare later

The current [conditional probability model specification](critic-conditional-probability-model-2026-11-21.md) maps AST-derived features directly to verified Critic outcome probabilities. The earlier [bucket walkthrough](critic-bayesian-feature-walkthrough-2026-11-21.md) is retained as an illustrative baseline; its manually selected groups and hypothetical counts are not the intended model architecture.

One design sends a partial or completed code snapshot to a lightweight Reviewer, which estimates the probability of a validated Critic counterexample. Include that Reviewer's latency and tokens in the scheduling comparison. Partial-snapshot predictions must record how much code was available and how predictions changed as Coder continued.

A second design extracts static features and updates a Bayesian predictor from prior completed outcomes. Candidate features include source length, branch count, loop nesting, recursion indicators, container types, index dimensions, state-discard branches, and compiler or analyzer diagnostics. These are measurable features or heuristics, not automatic proofs of time or space complexity. General asymptotic complexity inference is not assumed to be exact; unknown estimates remain unknown. Source length and syntactic nesting alone do not establish runtime behavior.

A first feature-based candidate is Bayesian logistic regression: infer coefficient distributions from complete feature/outcome rows and predict the conditional probability for a new feature vector. Preserve continuous features and use a compact set of explicitly specified interactions rather than assigning one independent probability to every hand-built group. Regularize coefficients and evaluate uncertainty and calibration. Beta-Bernoulli counts may serve as a simple comparison baseline, but Beta is not required by this target. Do not fit the conditional model to this four-program timing pilot. Learn only from earlier evaluated candidates, keep repeated or translated versions of the same problem together in a split, and report probability calibration as well as scheduling outcomes.

The current policy has two decisions. First, decide whether a review is worth its expected resource cost; a low-value candidate is skipped, not automatically reviewed after the build. Second, for an admitted review, decide whether to start during the build or queue it for later. Remaining build time, expected Critic duration, resource contention and stale-work risk affect this second decision.

An initial decision rule may compare `predicted probability * value of confirmed feedback` with expected Critic and validation cost, provided value and cost use compatible units. If a credible value cannot be assigned, evaluate under an explicit token or compute budget and measure confirmed findings, missed findings and total cost. A probability threshold is a policy choice, not automatically an output of probability estimation. Skipping requires neither a concurrency limit nor a special overhead: the Critic call itself consumes resources.

Skipped candidates have unobserved outcomes and must not be recorded as unsuccessful reviews. Evaluate missed opportunities using a separately budgeted random audit of skipped candidates or a fully reviewed held-out sample; otherwise the policy can reinforce its own low estimates without testing them. If later test failures provide new evidence, reassess the candidate. Reviews that receive those failures have different inputs from source-only reviews, so record the review regime and do not silently pool their outcome counts.

## Execution sequence

1. Coder finishes a code snapshot. Record the problem, source hash, build command, and environment.
2. Start the build and obtain available static features. Estimate the probability of confirmed evidence and expected review cost. Skip, queue, or start an isolated Critic according to the admission and timing decisions. An admitted source-only Critic receives the problem and that exact source snapshot, without an expected answer or supplied counterexample.
3. The Critic proposes a concrete input and the property it claims the implementation violates. A proposed expected answer is not treated as ground truth.
4. Once the matching artifact exists, execute the proposed input against it and independently check the claim. If the build fails, report the compiler diagnostics separately; do not describe an unexecuted counterexample as confirmed.
5. Return confirmed feedback to Coder. Reject stale reviews if the source changes before validation. For skipped code, continue the normal build and test path and reassess only if new evidence or a budgeted audit warrants a review.

## Comparisons

Use the same code snapshots, model settings, review instructions, and validation budget in each timing condition.

| Condition                   | Scheduling                                                       | Purpose                                                             |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Sequential review           | Build, then Critic, then witness validation                      | Matched baseline for the benefit of overlap                         |
| Concurrent review           | Build and Critic together, then witness validation               | Measure actual time to confirmed feedback                           |
| Selective review            | Skip low-value reviews; schedule admitted reviews early or later | Measure resource savings together with findings missed by skipping  |
| Existing conditional policy | Build and tests, invoke Critic after failure                     | Measure additional review cost and defects missed by existing tests |

The conditional policy is a different workload because it supplies observed failure information and skips reviews after passing tests. Report that distinction rather than attributing all differences to scheduling. Measure clean builds and incremental rebuilds separately. Do not add sleeps or artificially enlarge builds to create an overlap window.

For a successful build with no resource contention, a simple timing model is `T_sequential = T_build + T_critic + T_validate` and `T_concurrent = max(T_build, T_critic) + T_validate`. The potential saving is at most `min(T_build, T_critic)` under these assumptions. This is a model, not a measured speedup. Include real process and scheduling overhead in the experiment.

## Measurements

Record compilation or build time, existing test time, Critic time, witness validation time, and end-to-end time to verified feedback. Also record valid counterexample yield, incorrect claims, defects missed by existing tests, tokens, review completion before build completion, discarded or stale results, and failures to compile. Treat the compiler as evidence about build validity, not algorithm correctness.

For the selective policy, also report the skip rate, audited missed-counterexample rate, confirmed findings under a fixed budget, total feature-extraction and review cost, and the quality/cost tradeoff against reviewing every candidate. The earlier pilot measured review behavior and timing; it did not evaluate this admission policy.

A real project or a clearly scoped standalone program must be identified before interpreting timing results. Dependency downloads, cold caches, warmed compiler processes, and incremental caches must be tracked. Avoid comparing a cold full build in one condition with a warm incremental build in another. Run matched repeated measurements and report variation.

## Local readiness

On 2026-11-21, the workspace had working Rust 1.94.1, javac 17.0.15, and Apple clang 17.0.0 commands. Kotlin 2.3.0 was subsequently verified through compiler jars already present in the local Gradle cache. No `kotlinc` executable is on PATH; the pilot invokes the cached compiler through Java without downloads. The beans-code repository itself contains no Rust, Java, Kotlin, or C++ project to use as a representative build workload.

This is the next experiment plan. The current Python pilot evaluates review behavior and does not implement or validate this concurrent compiled-language workflow.
