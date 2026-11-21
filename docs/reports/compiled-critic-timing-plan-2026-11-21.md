# Compiled Language Critic Timing Pilot

This small feasibility check measures compilation and isolated Critic time for one equivalent weighted-interval implementation in Rust, Java, Kotlin, and C++. Each implementation uses a locally greedy replacement rule with the same known algorithmic defect. The Critic is not told the label and receives no expected answer, supplied counterexample, or test results. This is a timing and evidence demonstration, not an accuracy benchmark.

Compile each implementation three times, using a fresh output directory each time, without deleting operating-system caches. Measure the first invocation and subsequent invocations separately. Rust and C++ include compilation and linking. Java and Kotlin compile to JVM classes; JVM startup is part of subsequent witness execution, not compilation. Kotlin compiler dependencies are resolved from the existing local Gradle cache, with no downloads. Record exact commands and versions.

Use the configured gemini-3.6-flash model, temperature 0.7, with an 8192-token output budget for one isolated counterexample-guided review per language. This budget is larger than the earlier Python pilot and the results must not be pooled as the same experiment. The model may provide a direct counterexample or a permitted metamorphic test, using the same evidence schema. Preserve exact prompts, responses, usage and elapsed time. Malformed responses remain unsuccessful attempts rather than being selectively retried.

Validate each compiled implementation against a private fixed sample before model review. Execute each model-proposed input against the compiled artifact and compute the expected result by enumerating valid job subsets. No evaluator result is sent to the Critic. Record witness validation time separately. Keep code hashes to ensure the reviewed source matches the compiled artifact.

Compare observed compile and Critic durations. Any reported overlap saving is only a scheduling estimate, `min(T_compile, T_critic)`, until a matched sequential-versus-concurrent run is performed. A small standalone program does not represent a large clean build or a real project's incremental rebuild. No delay or artificial project expansion will be added to create an apparent benefit.

The accepted prediction target and future Reviewer-versus-Bayesian comparison are specified in [the scheduling plan](critic-compile-overlap-plan-2026-11-21.md). This pilot implements neither predictor. Stop after the four planned model calls and report the observations, costs and unresolved conditions.
