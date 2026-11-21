# Concurrent Counterexample Search During Compiled Language Builds

The target workload is Rust, Java, Kotlin, or C++ compilation and builds. Python bytecode compilation from the preliminary review pilot is not representative evidence for or against this proposal.

The hypothesis is that a Critic can use build time to prepare a counterexample, allowing the system to return verified feedback earlier than a sequential build-then-review workflow. Similarity retrieval is not part of this design. Context isolation and counterexample guidance remain design choices whose independent benefit must be measured.

## Prediction target and feasibility scope

Predict the probability that a fixed Critic, under a specified time and token budget, produces a counterexample that passes independent execution validation for the current code snapshot. A completed attempt with confirmed evidence has label 1; an attempt without confirmed evidence within the budget has label 0. Infrastructure failures are excluded. This is not the probability that the code is incorrect. Save incomplete responses, unsupported claims, and invalid inputs as separate reasons for an unsuccessful attempt.

For the feasibility pilot, measure one authored implementation of the same small problem in each of Rust, Java, Kotlin, and C++. Run compilation three times per implementation and make one isolated counterexample-guided Critic call per language. Independently execute the proposed witness. These four review calls assess feasibility and timing only; they do not establish comparative language accuracy or predictor quality. Do not implement or train a predictor yet.

## Predictor designs to compare later

One design sends a partial or completed code snapshot to a lightweight Reviewer, which estimates the probability of a validated Critic counterexample. Include that Reviewer's latency and tokens in the scheduling comparison. Partial-snapshot predictions must record how much code was available and how predictions changed as Coder continued.

A second design extracts static features and updates a Bayesian predictor from prior completed outcomes. Candidate features include source length, branch count, loop nesting, recursion indicators, container types, index dimensions, state-discard branches, and compiler or analyzer diagnostics. These are measurable features or heuristics, not automatic proofs of time or space complexity. General asymptotic complexity inference is not assumed to be exact; unknown estimates remain unknown. Source length and syntactic nesting alone do not establish runtime behavior.

Start with a transparent Beta-Bernoulli baseline over a few predeclared feature groups, with shrinkage toward a shared prior. A later model may incorporate more features if the data supports it. Do not learn a large feature model from this four-program timing pilot. Update only from earlier evaluated candidates, keep repeated or translated versions of the same problem together in a split, and report probability calibration as well as scheduling outcomes.

The proposed policy starts Critic during the build when the predicted probability exceeds a preset threshold; otherwise it starts Critic after the build. If every code snapshot is eventually reviewed, this primarily changes timing, not the number of Critic calls. The probability of useful feedback alone is not an optimal scheduler: remaining build time, predicted Critic duration, resource contention, and the cost of stale work also matter. Compare against always-parallel and always-sequential baselines before claiming that prediction adds value.

## Execution sequence

1. Coder finishes a code snapshot. Record the problem, source hash, build command, and environment.
2. Start the build and an isolated Critic concurrently. Give the Critic the problem and that exact source snapshot, without an expected answer or a supplied counterexample.
3. The Critic proposes a concrete input and the property it claims the implementation violates. A proposed expected answer is not treated as ground truth.
4. Once the matching artifact exists, execute the proposed input against it and independently check the claim. If the build fails, report the compiler diagnostics separately; do not describe an unexecuted counterexample as confirmed.
5. Return confirmed feedback to Coder. Reject stale reviews if the source changes before validation.

## Comparisons

Use the same code snapshots, model settings, review instructions, and validation budget in each timing condition.

| Condition                   | Scheduling                                         | Purpose                                                             |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Sequential review           | Build, then Critic, then witness validation        | Matched baseline for the benefit of overlap                         |
| Concurrent review           | Build and Critic together, then witness validation | Measure actual time to confirmed feedback                           |
| Existing conditional policy | Build and tests, invoke Critic after failure       | Measure additional review cost and defects missed by existing tests |

The conditional policy is a different workload because it supplies observed failure information and skips reviews after passing tests. Report that distinction rather than attributing all differences to scheduling. Measure clean builds and incremental rebuilds separately. Do not add sleeps or artificially enlarge builds to create an overlap window.

For a successful build with no resource contention, a simple timing model is `T_sequential = T_build + T_critic + T_validate` and `T_concurrent = max(T_build, T_critic) + T_validate`. The potential saving is at most `min(T_build, T_critic)` under these assumptions. This is a model, not a measured speedup. Include real process and scheduling overhead in the experiment.

## Measurements

Record compilation or build time, existing test time, Critic time, witness validation time, and end-to-end time to verified feedback. Also record valid counterexample yield, incorrect claims, defects missed by existing tests, tokens, review completion before build completion, discarded or stale results, and failures to compile. Treat the compiler as evidence about build validity, not algorithm correctness.

A real project or a clearly scoped standalone program must be identified before interpreting timing results. Dependency downloads, cold caches, warmed compiler processes, and incremental caches must be tracked. Avoid comparing a cold full build in one condition with a warm incremental build in another. Run matched repeated measurements and report variation.

## Local readiness

On 2026-11-21, the workspace had working Rust 1.94.1, javac 17.0.15, and Apple clang 17.0.0 commands. Kotlin 2.3.0 was subsequently verified through compiler jars already present in the local Gradle cache. No `kotlinc` executable is on PATH; the pilot invokes the cached compiler through Java without downloads. The beans-code repository itself contains no Rust, Java, Kotlin, or C++ project to use as a representative build workload.

This is the next experiment plan. The current Python pilot evaluates review behavior and does not implement or validate this concurrent compiled-language workflow.
