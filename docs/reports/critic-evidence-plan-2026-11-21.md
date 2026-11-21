# Critic Context and Counterexample Pilot Plan

This pilot tests whether separating the review context and changing the review instructions helps a Critic find algorithm errors with independently checkable evidence. It measures review behavior, not code repair or end-to-end agent speedup.

## Questions and comparisons

Use a paired two-by-two design. Every candidate receives all four treatments under the same model settings.

| Treatment               | Context                                         | Review instructions                                          |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| retained_general        | Include the preceding Main request and response | General correctness review                                   |
| isolated_general        | Problem and candidate only                      | General correctness review                                   |
| retained_counterexample | Include the preceding Main request and response | Identify a necessary condition and seek a falsifying example |
| isolated_counterexample | Problem and candidate only                      | Identify a necessary condition and seek a falsifying example |

Both instruction variants use the same JSON output schema and may return correct, incorrect, or uncertain. Both may supply a counterexample or a metamorphic test. The directed variant changes the search guidance, not the available evidence types or tool budget. All calls use the same neutral system prompt. Reviewers receive no tools, reference implementations, labels, evaluator inputs, failed assertions, other reviews, or oracle answers.

## Candidate set and context provenance

Reuse six authored controls from the earlier algorithm experiment: three incorrect and three correct implementations across weighted interval scheduling, edge-limited shortest paths, and bottleneck paths. These have explicit problem constraints and independent exhaustive evaluators for small inputs.

Also generate one new Main answer per problem, recording its complete request and visible response. Ask for a short algorithm explanation and code. Review all three outputs, regardless of their test results; do not select only failures. This produces nine candidates and 108 review calls over three repetitions, plus three Main calls.

For live Main outputs, retained context uses the actual preceding messages, including the visible explanation. For authored controls, retained context is a constructed replay containing the task and supplied code as an assistant message. It is not a genuine Main generation trace. Report these subsets separately. No hidden reasoning is captured or replayed.

There are only three distinct problem families. Repeated calls and paired implementations are not independent benchmark problems. Prior selection and familiar algorithms limit generalization. Live outputs that pass bounded tests are described as having no failure found, not proven correct.

## Execution and evidence checks

Use the configured beans-code provider and model, currently Google gemini-3.6-flash, with temperature 0.7 and a 4096-token output cap. Use the existing LLM client directly with explicit messages to avoid project-memory injection. Save the resolved settings and exact requests and responses. Alternate treatment order across candidates and repetitions, run calls serially, and record per-call latency and provider-reported token usage. Do not retry a review because its answer is unfavorable or malformed.

Before review, check candidates on 200 fixed valid inputs per family using independent subset or path enumeration. Keep these results private from the model. Authored correct controls also have algorithmic justifications; finite tests alone are not proofs. Abort on a control-label mismatch.

After review, execute a proposed witness in the existing isolated Python runner. Check that inputs satisfy the specification. Independently compute a counterexample's expected answer and compare it with the candidate's actual output and the Critic's predictions. Record a real failure separately from a fully accurate explanation of that failure.

For metamorphic evidence, allow only explicitly validated transformations: adding optional graph edges, increasing an edge budget, or permuting input order. Check the transformation's preconditions before comparing outputs. For graph minimization, treat -1 as infinity. These tests can reveal an inconsistency without an exact expected answer; a passing relation does not establish correctness.

## Measures

- Incorrect-control detection and missed defects, with uncertain and malformed outputs shown separately.
- False rejection of correct controls; report live passing-output rejection separately.
- Executable evidence yield, invalid inputs, unconfirmed claims, and fully validated numerical predictions.
- Metamorphic evidence that demonstrates a violation without relying on the oracle.
- Prompt, completion, and total tokens as reported by the provider; elapsed model-call time and evaluator time separately. Missing usage is unknown, not zero. Monetary cost is not estimated without verified pricing.
- Paired outcomes and costs by repetition, candidate, treatment, and provenance. Do not interpret repeated samples as independent problem counts.

## Reproducibility and stopping rules

Save the candidate corpus, source hashes, prompts, responses, validation results, and incremental checkpoints. Resume only when settings and source hashes match. Provider or billing errors stop the run and remain infrastructure failures, not wrong model answers. Preserve completed work. Do not change production Critic behavior, send repository source to the model, commit, or push as part of this pilot.

A result favoring isolated_counterexample is preliminary support only. A ceiling result, increased false positives, or greater cost without stronger evidence is a valid negative result. Compare context and instruction effects separately rather than attributing the entire difference to either one.
