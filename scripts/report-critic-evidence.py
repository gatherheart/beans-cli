"""Produce an English report from the immutable experiment records."""
import json
import sys
from pathlib import Path
from collections import Counter

source = Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/reports/critic-evidence-2026-11-21.json')
state = json.loads(source.read_text())
destination = source.with_suffix('.md')
arms = ['retained_general', 'isolated_general', 'retained_counterexample', 'isolated_counterexample']
names = {
    'retained_general': 'Retained context, general review',
    'isolated_general': 'Isolated context, general review',
    'retained_counterexample': 'Retained context, counterexample guidance',
    'isolated_counterexample': 'Isolated context, counterexample guidance',
}


def tokens(rows, field='totalTokens'):
    values = [r['call']['response'].get('usage', {}).get(field) for r in rows]
    return sum(values) if all(isinstance(v, (int, float)) for v in values) else None


def display(value):
    return 'unknown' if value is None else f'{value:,}'


def aggregate(rows):
    faulty = [r for r in rows if state['bank'][r['candidateId']]['failures'] > 0]
    passing = [r for r in rows if state['bank'][r['candidateId']]['failures'] == 0]
    return {
        'faulty': len(faulty), 'passing': len(passing),
        'detected': sum((r.get('review') or {}).get('verdict') == 'incorrect' for r in faulty),
        'confirmed': sum((r.get('review') or {}).get('verdict') == 'incorrect' and r['validation'].get('confirmed', False) for r in faulty),
        'rejected': sum((r.get('review') or {}).get('verdict') == 'incorrect' for r in passing),
        'accepted': sum((r.get('review') or {}).get('verdict') == 'correct' for r in passing),
        'uncertain': sum((r.get('review') or {}).get('verdict') == 'uncertain' for r in rows),
        'malformed': sum(r.get('review') is None for r in rows),
        'proposed': sum(bool((r.get('review') or {}).get('evidence')) for r in rows),
        'fully_validated': sum(r['validation'].get('fully_validated', False) for r in rows),
        'seconds': sum(r['call']['elapsedMs'] for r in rows) / 1000,
    }


rows = state['rows']
counts = Counter(c['origin'] for c in state['candidates'])
main_usage = [c['response'].get('usage', {}).get('totalTokens') for c in state['mainCalls'].values()]
main_tokens = sum(main_usage) if all(isinstance(v, (int, float)) for v in main_usage) else None
main_seconds = sum(c['elapsedMs'] for c in state['mainCalls'].values()) / 1000
lines = [
    '# Critic Context and Counterexample Pilot Results', '',
    f"Run status: **{state['status']}**. Model: `{state['settings']['model']}` via `{state['settings']['provider']}`. "
    f"Completed {len(state['mainCalls'])} Main calls and {len(rows)} review calls, with {state['rounds']} planned repetitions per candidate and treatment.", '',
    'This pilot compares context retention against isolation and general review against explicit counterexample guidance. '
    'The outcome is evidence-backed defect detection and unwarranted rejection, not code repair or overall coding accuracy.', '',
    'Executed evidence on incorrect controls: ' + '; '.join(
        f"{names[arm]} {aggregate([r for r in rows if r['origin'] == 'authored_control' and r['arm'] == arm])['confirmed']}/{aggregate([r for r in rows if r['origin'] == 'authored_control' and r['arm'] == arm])['faulty']}"
        for arm in arms) + '.', '',
    f"There were {sum(not r.get('review') for r in rows)} malformed or schema-invalid responses. "
    'Use the outcome tables below to distinguish incomplete structured output from a valid but incorrect judgment. '
    'Repeated reviews of three authored defects do not establish a general advantage for a prompting or context policy.', '',
    '## Conditions', '',
    f"Temperature was {state['settings']['temperature']}; the output cap was {state['settings']['maxTokens']} tokens. "
    'Every candidate received the same four treatments. Calls ran serially, with treatment order rotated across candidates and repetitions. '
    'All arms used the same system prompt and output schema. No arm received test outcomes, labels, oracle code, reference solutions, tools, or other reviews.', '',
    f"The sample contains {counts['authored_control']} authored controls (three correct and three incorrect) and {counts['live_main']} fresh Main outputs across only three problem families. "
    'Retained context for live outputs contains the actual Main request and visible response, including its short explanation. '
    'For authored controls it is a constructed assistant-message replay, without a genuine model-generated explanation. '
    'Context retention therefore includes extra text and prior assistant attribution; this design does not isolate their individual effects.', '',
    'The general prompt also permits evidence. The directed prompt asks the reviewer to identify a necessary condition and challenge a potentially invalid code decision. '
    'Any difference concerns that guidance, not evidence access or a different model.', '',
    '## Candidate checks', '',
    '| Candidate | Provenance | Failures in 200 private inputs |',
    '| --- | --- | ---: |',
]
for candidate in state['candidates']:
    check = state['bank'][candidate['id']]
    lines.append(f"| {candidate['id']} | {candidate['origin']} | {check['failures']} |")
lines += ['', 'These are executions of candidate code, not additional Critic trials. The private evaluator enumerates feasible subsets or paths on small inputs. '
          'A live output with no observed failure is not proven correct. The authored correct controls additionally have algorithmic correctness arguments.', '']

for origin, title in [('authored_control', 'Authored control results'), ('live_main', 'Fresh Main output results')]:
    lines += ['## ' + title, '',
              '| Treatment | Defects identified | Identified with executed evidence | Passing candidates rejected | Passing candidates accepted | Uncertain | Malformed |',
              '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for arm in arms:
        subset = [r for r in rows if r['origin'] == origin and r['arm'] == arm]
        a = aggregate(subset)
        lines.append(f"| {names[arm]} | {a['detected']}/{a['faulty']} | {a['confirmed']}/{a['faulty']} | {a['rejected']}/{a['passing']} | {a['accepted']}/{a['passing']} | {a['uncertain']} | {a['malformed']} |")
    lines += ['', 'Denominators count review calls, including repetitions of the same candidate. A zero faulty denominator means no defect-detection estimate is available for that subset.', '']

lines += ['## Evidence quality', '',
          '| Treatment | Evidence proposed | Fully validated evidence | Metamorphic proposals | Confirmed metamorphic violations |',
          '| --- | ---: | ---: | ---: | ---: |']
for arm in arms:
    subset = [r for r in rows if r['arm'] == arm]
    a = aggregate(subset)
    meta = [r for r in subset if ((r.get('review') or {}).get('evidence') or {}).get('kind') == 'metamorphic']
    lines.append(f"| {names[arm]} | {a['proposed']} | {a['fully_validated']} | {len(meta)} | {sum(r['validation'].get('confirmed', False) for r in meta)} |")
lines += ['', 'A counterexample is fully validated only when its input is legal, execution violates the specification, and both the claimed expected value and predicted actual value match independent checks. '
          'An input can expose a real bug while the Critic describes its numerical outcome incorrectly; those outcomes remain separate in the raw records. '
          'Metamorphic evidence requires a valid transformation and a violated output relation; that confirmation does not use an exact-answer oracle.', '',
          '## Per repetition outcomes', '',
          '| Repetition | Treatment | Control defects with evidence | Correct controls rejected | Fresh passing outputs rejected |',
          '| ---: | --- | ---: | ---: | ---: |']
for repetition in range(1, state['rounds'] + 1):
    for arm in arms:
        subset = [r for r in rows if r['arm'] == arm and r['round'] == repetition]
        control = aggregate([r for r in subset if r['origin'] == 'authored_control'])
        live = aggregate([r for r in subset if r['origin'] == 'live_main'])
        lines.append(f"| {repetition} | {names[arm]} | {control['confirmed']}/{control['faulty']} | {control['rejected']}/{control['passing']} | {live['rejected']}/{live['passing']} |")

lines += ['', '## Model usage and elapsed time', '',
          '| Treatment | Calls | Prompt tokens | Completion tokens | Total tokens | Model seconds | Mean seconds per call |',
          '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for arm in arms:
    subset = [r for r in rows if r['arm'] == arm]
    seconds = aggregate(subset)['seconds']
    lines.append(f"| {names[arm]} | {len(subset)} | {display(tokens(subset, 'promptTokens'))} | {display(tokens(subset, 'completionTokens'))} | {display(tokens(subset))} | {seconds:.2f} | {seconds / len(subset) if subset else 0:.2f} |")
lines += ['', f"Main generation used {display(main_tokens)} provider-reported total tokens and {main_seconds:.2f} model seconds. "
          f"All reviews used {display(tokens(rows))} total tokens. Evidence validation took {sum(r['validationMs'] for r in rows) / 1000:.2f} seconds, recorded separately from model latency.", '',
          'Provider-reported total tokens may include reasoning tokens not included in the reported completion count. '
          'Elapsed call time includes provider and network latency. No monetary cost or end-to-end speedup is inferred.', '',
          'The existing Google adapter maps non-tool completions to `stop`, so that normalized field does not establish that a response was complete. '
          'Incomplete JSON is scored as malformed based on its actual content. Provider-native finish reasons were not retained; token-budget exhaustion is not directly verified. '
          'The fixed output cap applies to every treatment.', '',
          '## Findings requiring inspection', '']
notable = []
for row in rows:
    review = row.get('review') or {}
    faulty = state['bank'][row['candidateId']]['failures'] > 0
    if (review.get('verdict') == 'incorrect' and (not faulty or not row['validation'].get('fully_validated'))) or not review or (faulty and review.get('verdict') != 'incorrect'):
        notable.append(row)
if not notable:
    lines.append('No incorrect-control miss, passing-candidate rejection, malformed response, or incompletely validated defect claim was recorded.')
for row in notable:
    lines.append(f"- {row['candidateId']}, repetition {row['round']}, {row['arm']}: verdict `{(row.get('review') or {}).get('verdict', 'malformed')}`, evidence status `{row['validation'].get('status')}`. See the exact response and validation in the raw report.")
compilation_path = source.with_suffix('.compilation.json')
if compilation_path.exists():
    compilation = json.loads(compilation_path.read_text())
    measures = compilation['measurements']
    medians = [m['medianMs'] for m in measures]
    lines += ['', '## Supplementary Python compilation timing', '',
              f"For these {len(measures)} Python candidates, source-to-bytecode compilation medians ranged from {min(medians):.3f} to {max(medians):.3f} ms over 200 repetitions per candidate. "
              'This timing was added after the user proposed overlapping Critic work with compilation. It makes no additional model calls. '
              'It measures Python compilation only, not a C++ build, a test suite, or actual concurrent execution. '
              'The subprocess startup time is stored separately in the raw timing file.', '',
              'Compilation alone is too short to hide a seconds-long Critic call in this workload. '
              'Any useful overlap would need a longer independent operation, such as substantial test execution, or earlier availability of a stable code snapshot.', '',
              f"[Compilation measurements]({compilation_path.name})", '']
lines += ['', '## Interpretation limits', '',
          'The effective problem diversity is three families, not the number of review calls. Controls were deliberately selected to contain known algorithm errors, and the retained-context treatment for those controls is synthetic. '
          'If all conditions succeed on these examples, the result does not demonstrate a benefit from context isolation or counterexample guidance. '
          'Fresh outputs that contain no observed errors cannot establish recovery from naturally occurring Main mistakes.', '',
          'This run measures single-pass review followed by external evaluation. The Critic does not receive execution feedback or revise its review. '
          'There is no Coder repair loop, retrieval system, formal proof checker, or equal-budget independent re-solving baseline. '
          'A self-generated expected answer still requires a trustworthy evaluator; a model-proposed test alone is not independent confirmation.', '',
          '## Next experiment on concurrent counterexample search', '',
          'The proposed next design removes similarity retrieval from this experiment. After Coder completes a fixed code snapshot, compilation or tests and an isolated Critic run concurrently. '
          'The Critic proposes a counterexample, and the proposed input is executed before feedback is returned to Coder. '
          'This pilot does not implement that scheduling change.', '',
          'The intended deployment workload is Rust, Java, Kotlin, or C++ compilation and builds. '
          'The Python timing above is not representative evidence against that proposal. '
          'The hypothesis is that overlapping counterexample search with compilation or testing reduces time to verified feedback. '
          'Finishing within compilation time is a stronger claim and requires actual timing evidence. In a Python workload, bytecode compilation may provide only a small overlap window. '
          'Measure compilation, test execution, Critic generation, witness validation, confirmed defects missed by the existing tests, false claims, and tokens separately. '
          'Compare against the existing policy that calls Critic only after a failed test; eager review may spend additional tokens on passing candidates. '
          'A latency comparison must use the same candidate snapshots and report extra work, discarded results, and resource contention.', '',
          '## Reproduce and inspect', '',
          '```sh', './node_modules/.bin/tsx scripts/benchmark-critic-evidence.ts',
          'python3 scripts/report-critic-evidence.py', 'python3 scripts/check-critic-evidence-oracle.py',
          './node_modules/.bin/vitest run tests/eval/critic-evidence.test.ts', '```', '',
          f"- [Raw requests, responses, validation and hashes]({source.name})",
          '- [Exact experiment source snapshots](critic-evidence-2026-11-21.sources.json)',
          '- [Pre-execution plan](critic-evidence-plan-2026-11-21.md)',
          '- [Compiled language overlap plan](critic-compile-overlap-plan-2026-11-21.md)',
          '- [Candidate fixture](../../tests/fixtures/critic-evidence/cases.json)',
          '- [Runner](../../scripts/benchmark-critic-evidence.ts)',
          '- [Independent validator](../../scripts/critic-evidence-validator.py)',
          '- [Oracle cross-check](../../scripts/check-critic-evidence-oracle.py)', '',
          'Resuming requires identical settings and source hashes. To rerun the unchanged experiment, choose a new output path with `--output`. '
          'Provider failures stop the run and are not scored as incorrect answers. Production Critic behavior is unchanged.', '']
destination.write_text('\n'.join(lines))
print(destination)
