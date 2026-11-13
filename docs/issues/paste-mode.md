# PASTE tool prediction mode

## Paper and scope

PASTE means Pattern-Aware Speculative Tool Execution. The original
[v1, sections 4–5](https://arxiv.org/html/2603.18897v1#S4) separates a pattern into
event context, target tool, symbolic argument mapping, and empirical confidence.
It predicts concrete invocations from completed traces and binds arguments to
live payloads. The actual LLM invocation must confirm a prediction before its
result enters agent history.

The [latest v3, sections 4–5](https://arxiv.org/html/2603.18897v3#S4) additionally
coordinates tool speculation with admission and load shaping inside vLLM.
This implementation provides the **tool-side subset**. It does not reproduce
the vLLM co-scheduler, GPU pressure model, resource isolation, or the paper's
performance results. Bounded concurrency is not an OS-level guarantee against
resource contention.

## Usage

```sh
npm run dev -- --paste "Inspect the implementation and its callers"
npm run dev -- --paste --paste-traces /path/to/completed-traces.json "Inspect the implementation"
```

`--paste` applies to `AgentExecutor`, used by both single-prompt CLI execution
and the interactive agent manager. It is off by default and is not persisted
to settings. The default speculative tool is `read_file`. Shell commands,
writes, network calls, and other tools follow their normal authoritative path.
No additional LLM requests or tokens are used for prediction.

MBPP's original `ChatSession` evaluation path has no LLM-selected tool
invocations. A separate [tool-agent evaluator](../guides/paste-mbpp.md) now
supports `--eval --benchmark mbpp --paste`, with `submit_solution` and isolated
`run_tests` tools. The existing `--review-preparation` experiment remains a
different mechanism.

Without a trace file, the analyzer starts empty and learns from completed
authoritative calls during the lifetime of the executor. It requires at least
two matching observations and confidence of 0.8. Learning is retained between
interactive requests in the same manager, but not across process restarts.

## Trace input

The JSON file is an array of completed sessions, each an ordered array of:

```json
{
  "name": "search",
  "arguments": { "query": "example" },
  "status": "success",
  "output": { "hits": [{ "path": "src/example.ts" }] }
}
```

Use actual completed tool traces, ending each array at a genuine session end.
Arguments must be JSON values. A later `read_file` event can establish that
its path comes from `output.hits[0].path`. Plain text outputs in live sessions
are represented as `{content, lines}`. Terminal outcomes count against the
probability of a next call. Parallel call batches reset sequence context;
they are never treated as an ordered causal chain. Keep training and benchmark
evaluation tasks disjoint when measuring performance.

## Runtime behavior

- The analyzer mines suffixes of up to two tool/status events, using at most
  256 observed transitions. Field/index bindings and constants are validated
  against all occurrences of the same context. Missing bindings yield no call.
- Predictions are deduplicated by canonical tool name and JSON arguments,
  ordered by confidence, and limited to two active speculative jobs per executor.
  Jobs expire after five seconds. Tool availability, validation, the explicit
  speculation allowlist, and existing approval policy all apply.
- Predictions run during LLM generation. Completed matches are reused;
  running matches are promoted. Failed predictions fall back to normal execution.
  Only authoritative invocations emit tool activity and enter model history.
- Mismatches, parallel batches, and session termination discard shadow results.
  Authoritative work suppresses speculation in other sessions sharing the runtime.
  Cancellation signals reach file reads, and a cancelled job retains its budget
  slot until its underlying operation settles.
- Before reuse, file identity, size, and nanosecond modification/change times
  are checked. A changed/deleted file forces a fresh authoritative read. This
  is a freshness check, not filesystem transaction isolation against races.
- `AgentResult.paste` reports prediction, execution, reuse, promotion, discard,
  preemption, failure, skip, and normal-execution counts. The single-prompt CLI
  prints the main counters. API users can configure `PasteOptions` explicitly.

Tests use deferred tool/LLM promises, mock clients, and temporary local files;
they do not make model API calls or claim a measured speedup.
