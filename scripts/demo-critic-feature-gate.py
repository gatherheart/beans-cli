"""Offline illustration: real C++ AST features, hypothetical Bayesian history.

This does not train or change the production predictor or call an LLM.
"""
import hashlib
import json
import math
from pathlib import Path
import statistics
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'tests/fixtures/compiled-critic/Main.cpp'
OUTPUT = ROOT / 'docs/reports/critic-feature-gate-demo-2026-11-21.json'
LOOPS = {'ForStmt', 'CXXForRangeStmt', 'WhileStmt', 'DoStmt'}


def extract():
    started = time.perf_counter()
    source = SOURCE.read_text()
    command = ['clang++', '-std=c++17', '-Xclang', '-ast-dump=json',
               '-Xclang', '-ast-dump-filter=solve', '-fsyntax-only', str(SOURCE)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuntimeError(result.stderr)
    tree = json.loads(result.stdout)
    if tree.get('kind') != 'FunctionDecl' or tree.get('name') != 'solve':
        raise RuntimeError('Expected exactly one solve function AST')
    features = {'explicit_loop_count': 0, 'max_loop_nesting': 0, 'if_count': 0,
                'conditional_erase_inside_loop': False, 'has_sort_call': False,
                'has_push_back_call': False, 'declared_local_types': {},
                'time_complexity': 'unknown', 'space_complexity': 'unknown'}
    seen = set()
    evidence = []

    def walk(node, loop_depth=0, if_depth=0):
        kind = node.get('kind')
        location = node.get('range', {})
        begin = location.get('begin', {}).get('offset')
        end = location.get('end', {}).get('offset')
        key = (kind, begin, end)
        first = key not in seen
        seen.add(key)
        if kind in LOOPS:
            loop_depth += 1
            features['max_loop_nesting'] = max(features['max_loop_nesting'], loop_depth)
            if first:
                features['explicit_loop_count'] += 1
        if kind == 'IfStmt':
            if_depth += 1
            if first:
                features['if_count'] += 1
        if kind == 'VarDecl' and not node.get('isImplicit'):
            name = node.get('name', '')
            if not name.startswith('__'):
                features['declared_local_types'][name] = node.get('type', {}).get('qualType')
        if kind in {'MemberExpr', 'DeclRefExpr'}:
            name = node.get('name') or node.get('referencedDecl', {}).get('name')
            if name == 'sort':
                features['has_sort_call'] = True
            if name == 'push_back':
                features['has_push_back_call'] = True
            if name == 'erase' and loop_depth > 0 and if_depth > 0:
                features['conditional_erase_inside_loop'] = True
                if first and begin is not None:
                    evidence.append({'feature': 'conditional_erase_inside_loop',
                                     'line': source.count('\n', 0, begin) + 1})
        for child in node.get('inner', []):
            walk(child, loop_depth, if_depth)

    walk(tree)
    span = tree['range']
    start = span['begin']['offset']
    end = span['end']['offset'] + span['end']['tokLen']
    features['nonempty_function_lines'] = sum(bool(line.strip()) for line in source[start:end].splitlines())
    features['bucket'] = f"erase={int(features['conditional_erase_inside_loop'])};nested={int(features['max_loop_nesting'] >= 2)}"
    return {'command': command, 'features': features, 'evidence': evidence,
            'elapsedSeconds': time.perf_counter() - started}


def beta_quantile(q, alpha, beta):
    # Exact integer-shape beta CDF through a binomial sum, then bisection.
    n = alpha + beta - 1
    lo, hi = 0.0, 1.0
    for _ in range(60):
        x = (lo + hi) / 2
        cdf = sum(math.comb(n, j) * x**j * (1-x)**(n-j) for j in range(alpha, n+1))
        if cdf < q:
            lo = x
        else:
            hi = x
    return (lo + hi) / 2


def gate(probability, build_total, analysis_elapsed, critic_duration):
    remaining = max(0, build_total - analysis_elapsed)
    overlap = min(remaining, critic_duration)
    early = probability >= 0.60 and overlap >= 1.0
    return {'buildTotalSeconds': build_total, 'remainingBuildSeconds': remaining,
            'potentialOverlapSeconds': overlap, 'probabilityThreshold': 0.60,
            'minimumOverlapSeconds': 1.0, 'earlySlotAvailable': True,
            'decision': 'start_critic_now' if early else 'defer_until_build_finishes',
            'sequentialFeedbackSecondsExcludingValidation': build_total + critic_duration,
            'earlyFeedbackSecondsExcludingValidation': max(build_total, analysis_elapsed + critic_duration),
            'expectedUsefulFeedbackAdvanceSeconds': probability * overlap}


runs = [extract() for _ in range(3)]
assert all(r['features'] == runs[0]['features'] for r in runs)
features = runs[0]['features']
assert features['explicit_loop_count'] == 3
assert features['max_loop_nesting'] == 2
assert features['if_count'] == 2
assert features['conditional_erase_inside_loop']
analysis_elapsed = statistics.median(r['elapsedSeconds'] for r in runs)

prior_alpha, prior_beta = 1, 3
successes, failures = 8, 2  # Invented teaching counts, never pilot observations.
alpha, beta = prior_alpha + successes, prior_beta + failures
probability = alpha / (alpha + beta)
assert abs(probability - 9/14) < 1e-12

pilot = json.loads((ROOT / 'docs/reports/compiled-critic-timing-2026-11-21.json').read_text())
candidate = next(c for c in pilot['candidates'] if c['language'] == 'cpp')
review = next(r for r in pilot['reviews'] if r['language'] == 'cpp')
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert source_hash == candidate['sourceSha256']
build_seconds = statistics.median(b['seconds'] for b in candidate['builds'])
critic_seconds = review['elapsedMs'] / 1000

report = {
    'scope': 'Offline teaching example. Real AST extraction and prior pilot timing; invented training counts and scheduling thresholds. No trained predictor or new LLM calls.',
    'source': str(SOURCE.relative_to(ROOT)), 'sourceSha256': source_hash,
    'staticAnalysisRuns': runs, 'analysisMedianSeconds': analysis_elapsed,
    'featureSemantics': 'Syntactic observations only; conditional erase does not prove an invalid pruning decision. Complexity is deliberately unknown.',
    'hypotheticalHistory': {'bucket': features['bucket'], 'eligiblePriorExamples': 10,
                            'verifiedWitnesses': successes, 'noVerifiedWitness': failures},
    'posterior': {'priorAlpha': prior_alpha, 'priorBeta': prior_beta,
                  'alpha': alpha, 'beta': beta, 'predictiveProbability': probability,
                  'credibleInterval95': [beta_quantile(0.025, alpha, beta), beta_quantile(0.975, alpha, beta)],
                  'afterConfirmedWitness': {'alpha': alpha+1, 'beta': beta, 'mean': (alpha+1)/(alpha+beta+1)},
                  'afterNoWitnessWithinBudget': {'alpha': alpha, 'beta': beta+1, 'mean': alpha/(alpha+beta+1)},
                  'infrastructureFailure': 'no update'},
    'policyAssumptions': 'One scarce early-review slot, available for this example. Thresholds are illustrative, not optimized. All candidates are eventually reviewed. Without a capacity or cost constraint, always-parallel is the latency baseline to beat.',
    'priorPilotTiming': {'compileMedianSeconds': build_seconds, 'criticSeconds': critic_seconds},
    'observedSmallProgramTimingScenario': gate(probability, build_seconds, analysis_elapsed, critic_seconds),
    'hypotheticalEightSecondBuildScenario': gate(probability, 8.0, analysis_elapsed, critic_seconds),
}
OUTPUT.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'features': features, 'analysisMedianSeconds': analysis_elapsed,
                  'posterior': report['posterior'],
                  'smallProgramDecision': report['observedSmallProgramTimingScenario']['decision'],
                  'hypotheticalLongBuild': report['hypotheticalEightSecondBuildScenario']}, indent=2))
