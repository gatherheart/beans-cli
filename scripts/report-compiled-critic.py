"""Render the small compiled-language timing pilot in English."""
import json
from pathlib import Path
from statistics import median

path = Path('docs/reports/compiled-critic-timing-2026-11-21.json')
state = json.loads(path.read_text())
reviews = {r['language']: r for r in state['reviews']}
lines = [
    '# Compiled Language Critic Timing Results', '',
    f"Status: **{state['status']}**. This feasibility pilot compiled one equivalent authored program in each of Rust, Java, Kotlin, and C++, three times per language, and made one isolated Critic call per language.", '',
    'Each program implements the same locally greedy weighted-interval rule with a known algorithmic defect. The model did not receive that label or a counterexample. '
    'These are four translations of one problem, not four independent problems. The sample measures feasibility and timing, not detection accuracy or language superiority.', '',
    '## Compilation and review measurements', '',
    '| Language | Three compilation runs in seconds | Median compilation seconds | Critic seconds | Total model tokens | Executed evidence |',
    '| --- | --- | ---: | ---: | ---: | --- |',
]
for candidate in state['candidates']:
    language = candidate['language']
    builds = [b['seconds'] for b in candidate['builds']]
    review = reviews.get(language)
    lines.append(f"| {language} | {', '.join(f'{t:.3f}' for t in builds)} | {median(builds):.3f} | " +
                 (f"{review['elapsedMs']/1000:.3f} | {review['response'].get('usage',{}).get('totalTokens','unknown')} | {review['validation']['status']} |" if review else 'pending | pending | pending |'))
lines += ['', 'Compilation used fresh output directories, but operating-system caches were not cleared. These are standalone compiler invocations, not incremental project builds. '
          'Rust and C++ include linking; Java and Kotlin produce JVM classes. The compiled JVM programs are launched separately during witness validation. '
          'All four programs failed the same 25 of 200 private checks before review, confirming that the intended algorithmic defect survives translation.', '',
          'The model was gemini-3.6-flash with temperature 0.7 and an 8192-token output budget. No hard Critic latency deadline was enforced in this timing pilot; a deadline must be specified before constructing time-budgeted predictor labels. '
          'The earlier Python context experiment used a 4096-token cap, so the two experiments are not pooled. '
          'Only problem text and the language-specific source were sent to the Critic. No static-analysis predictor or similarity retrieval was used.', '',
          '## Verified examples', '']
for candidate in state['candidates']:
    row = reviews.get(candidate['language'])
    if not row:
        continue
    review = row.get('review') or {}
    evidence = review.get('evidence')
    validation = row['validation']
    lines += [f"### {candidate['language']}", '', f"Verdict: `{review.get('verdict','malformed')}`. Evidence: `{validation['status']}`.", '']
    if evidence:
        lines += ['```json', json.dumps(evidence, indent=2), '```', '',
                  f"Independent validation: `{json.dumps(validation)}`.", '']
    else:
        lines += ['No executable evidence was returned.', '']
lines += ['## What the measurements support', '',
          'The measured times establish whether there is an overlap window for these small programs. They do not measure a concurrently scheduled pipeline. '
          'Under an idealized model with no contention, overlap can hide at most the smaller of compilation time and Critic time. '
          'For a small program whose Critic call lasts longer than compilation, most Critic latency remains after the build completes.', '',
          '| Language | Ideal overlap window in seconds | Validation seconds |',
          '| --- | ---: | ---: |']
for candidate in state['candidates']:
    row = reviews.get(candidate['language'])
    if row:
        saved = min(median(b['seconds'] for b in candidate['builds']), row['elapsedMs']/1000)
        lines.append(f"| {candidate['language']} | {saved:.3f} | {row['validationMs']/1000:.3f} |")
lines += ['', 'The overlap column is calculated, not an observed speedup. A larger clean build or a real incremental rebuild may produce a different window. '
          'No sleeps, dependency downloads, or artificial project enlargement were used to make compilation take longer.', '',
          '## Prediction target and next decision', '',
          'The accepted prediction target is the probability that the Critic produces an independently confirmed counterexample for the current source snapshot within a fixed time and token budget. '
          'A confirmed outcome receives label 1; an attempted review without confirmed evidence within that budget receives label 0. Infrastructure failures are excluded. '
          'This target combines the presence of a detectable defect with the Critic\'s ability to find evidence; it is not simply code incorrectness.', '',
          'This small pilot does not train a Bayesian predictor or call a separate prediction Reviewer. Their proposed inputs, costs and evaluation safeguards are documented in the scheduling plan. '
          'If low-probability candidates are still reviewed after compilation, prediction changes start time rather than eliminating review calls. '
          'A later scheduling test must therefore compare predicted scheduling with both always-parallel and always-sequential execution.', '',
          '## Reproduce and inspect', '',
          '```sh', 'python3 scripts/compiled-critic.py prepare', './node_modules/.bin/tsx scripts/benchmark-compiled-critic.ts', 'python3 scripts/report-compiled-critic.py', '```', '',
          'The preparation script refuses to overwrite an existing report. Preserve the current report and use an isolated checkout or explicitly change the output paths for a new run. '
          'The fixture programs and validation logic are local; Kotlin dependencies were found in the existing Gradle cache.', '',
          '- [Raw commands, sources, responses and measurements](compiled-critic-timing-2026-11-21.json)',
          '- [Exact experiment source snapshots](compiled-critic-timing-2026-11-21.sources.json)',
          '- [Pilot plan](compiled-critic-timing-plan-2026-11-21.md)',
          '- [Prediction and scheduling plan](critic-compile-overlap-plan-2026-11-21.md)',
          '- [Compilation and validation runner](../../scripts/compiled-critic.py)',
          '- [Critic runner](../../scripts/benchmark-compiled-critic.ts)', '']
destination = path.with_suffix('.md')
destination.write_text('\n'.join(lines))
print(destination)
