"""Compile the four local fixtures and validate structured model witnesses."""
import hashlib
import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'docs/reports/compiled-critic-timing-2026-11-21.json'
BUILD = ROOT / 'node_modules/.cache/compiled-critic-pilot-2026-11-21'
HELPERS = runpy.run_path(str(ROOT / 'scripts/critic-evidence-validator.py'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(command, input_text=None):
    start = time.perf_counter()
    result = subprocess.run(command, input=input_text, text=True, capture_output=True, timeout=90)
    return {'command': list(map(str, command)), 'seconds': time.perf_counter() - start,
            'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}


def jar(group, artifact, version):
    root = Path.home() / '.gradle/caches/modules-2/files-2.1' / group / artifact / version
    matches = sorted(p for p in root.glob('*/*.jar') if '-sources' not in p.name and '-javadoc' not in p.name)
    if not matches:
        raise RuntimeError(f'Required cached dependency is missing: {group}:{artifact}:{version}')
    return str(matches[0])


def encode(cases):
    lines = [str(len(cases))]
    for case in cases:
        lines.append(str(len(case['jobs'])))
        lines.extend(' '.join(map(str, job)) for job in case['jobs'])
    return '\n'.join(lines) + '\n'


def execute(candidate, cases):
    result = run(candidate['executionCommand'], encode(cases))
    if result['exitCode'] != 0:
        raise RuntimeError('Candidate execution failed: ' + result['stderr'])
    values = [int(line) for line in result['stdout'].splitlines()]
    if len(values) != len(cases):
        raise RuntimeError('Candidate returned the wrong number of results')
    return values, result


def prepare():
    if REPORT.exists():
        raise RuntimeError('A compiled pilot already exists; preserve it instead of overwriting')
    compiler = jar('org.jetbrains.kotlin', 'kotlin-compiler-embeddable', '2.3.0')
    stdlib = jar('org.jetbrains.kotlin', 'kotlin-stdlib', '2.3.0')
    annotations = jar('org.jetbrains', 'annotations', '13.0')
    dependencies = [compiler, stdlib, annotations,
                    jar('org.jetbrains.kotlin', 'kotlin-script-runtime', '2.3.0'),
                    jar('org.jetbrains.kotlin', 'kotlin-daemon-embeddable', '2.3.0'),
                    jar('org.jetbrains.kotlin', 'kotlin-reflect', '1.6.10'),
                    jar('org.jetbrains.kotlinx', 'kotlinx-coroutines-core-jvm', '1.8.0')]
    kotlin = ['java', '-cp', os.pathsep.join(dependencies), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler']
    versions = {
        'rust': run(['rustc', '--version']), 'java': run(['javac', '-version']),
        'cpp': run(['clang++', '--version']), 'kotlin': run(kotlin + ['-version']),
    }
    for language, result in versions.items():
        if result['exitCode'] != 0:
            raise RuntimeError(f'{language} compiler unavailable: {result["stderr"]}')
    state = {'status': 'compiling', 'versions': versions, 'candidates': [], 'reviews': [],
             'sourceHashes': {p: digest(ROOT / p) for p in ['scripts/compiled-critic.py', 'scripts/critic-evidence-validator.py', 'docs/reports/compiled-critic-timing-plan-2026-11-21.md']}}
    fixtures = ROOT / 'tests/fixtures/compiled-critic'
    for language, filename in [('rust', 'main.rs'), ('java', 'Main.java'), ('kotlin', 'Main.kt'), ('cpp', 'Main.cpp')]:
        source = fixtures / filename
        candidate = {'language': language, 'sourcePath': str(source.relative_to(ROOT)), 'source': source.read_text(), 'sourceSha256': digest(source), 'builds': []}
        for repetition in range(1, 4):
            output = BUILD / language / str(repetition)
            output.mkdir(parents=True, exist_ok=False)
            if language == 'rust':
                command = ['rustc', '--edition=2021', '-O', str(source), '-o', str(output / 'candidate')]
                execution = [str(output / 'candidate')]
            elif language == 'cpp':
                command = ['clang++', '-std=c++17', '-O2', str(source), '-o', str(output / 'candidate')]
                execution = [str(output / 'candidate')]
            elif language == 'java':
                command = ['javac', '-d', str(output), str(source)]
                execution = ['java', '-cp', str(output), 'Main']
            else:
                command = kotlin + ['-no-stdlib', '-no-reflect', '-classpath', os.pathsep.join([stdlib, annotations]), '-d', str(output), str(source)]
                execution = ['java', '-cp', os.pathsep.join([str(output), stdlib]), 'MainKt']
            result = run(command)
            candidate['builds'].append({'repetition': repetition, **result})
            if result['exitCode'] != 0:
                raise RuntimeError(f'Compilation failed for {language}: {result["stderr"]}')
            candidate['executionCommand'] = execution
        cases = HELPERS['build_fixtures']()['weighted_intervals']
        actual, execution = execute(candidate, cases)
        expected = [HELPERS['oracle']('weighted_intervals', c) for c in cases]
        candidate['privateCheck'] = {'inputs': len(cases), 'failures': sum(a != e for a, e in zip(actual, expected)), 'executionSeconds': execution['seconds']}
        assert candidate['privateCheck']['failures'] > 0
        state['candidates'].append(candidate)
        REPORT.write_text(json.dumps(state, indent=2) + '\n')
        print(json.dumps({'language': language, 'compileSeconds': [b['seconds'] for b in candidate['builds']], 'privateFailures': candidate['privateCheck']['failures']}), flush=True)
    state['status'] = 'ready_for_review'
    REPORT.write_text(json.dumps(state, indent=2) + '\n')


def validate(language, evidence):
    state = json.loads(REPORT.read_text())
    candidate = next(c for c in state['candidates'] if c['language'] == language)
    if digest(ROOT / candidate['sourcePath']) != candidate['sourceSha256']:
        raise RuntimeError('Reviewed source changed after compilation')
    if evidence is None:
        return {'status': 'no_evidence', 'confirmed': False}
    case = evidence['input']
    if not HELPERS['valid_input']('weighted_intervals', case):
        return {'status': 'invalid_input', 'confirmed': False}
    if evidence['kind'] == 'counterexample':
        expected = HELPERS['oracle']('weighted_intervals', case)
        values, execution = execute(candidate, [case])
        actual = values[0]
        confirmed = actual != expected
        return {'status': 'confirmed' if confirmed else 'not_confirmed', 'confirmed': confirmed,
                'expected': expected, 'actual': actual,
                'fullyValidated': confirmed and expected == evidence['expected'] and actual == evidence['predicted_actual'],
                'executionSeconds': execution['seconds']}
    followup = evidence['followup_input']
    if not HELPERS['valid_relation']('weighted_intervals', evidence['relation'], case, followup):
        return {'status': 'invalid_transformation', 'confirmed': False}
    values, execution = execute(candidate, [case, followup])
    confirmed = values[0] != values[1]
    return {'status': 'confirmed' if confirmed else 'not_confirmed', 'confirmed': confirmed,
            'fullyValidated': confirmed, 'oracleFree': True, 'values': values,
            'executionSeconds': execution['seconds']}


if __name__ == '__main__':
    if sys.argv[1] == 'prepare':
        prepare()
    elif sys.argv[1] == 'validate':
        print(json.dumps(validate(sys.argv[2], json.load(sys.stdin))))
    else:
        raise SystemExit('Expected prepare or validate LANGUAGE')
