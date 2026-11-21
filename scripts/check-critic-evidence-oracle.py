"""Cross-check the private enumerators against different algorithms, offline."""
import json
import runpy
from pathlib import Path

helpers = runpy.run_path(str(Path(__file__).with_name('critic-evidence-validator.py')))


def alternate(family, data):
    if family == 'weighted_intervals':
        # Integer-time dynamic programming, rather than subset enumeration.
        dp = [0] * 21
        for t in range(1, 21):
            dp[t] = max([dp[t - 1]] + [dp[s] + w for s, e, w in data['jobs'] if e == t])
        return dp[20]
    if family == 'bounded_route':
        # Synchronous edge relaxation, rather than path enumeration.
        dist = [float('inf')] * data['n']
        dist[data['source']] = 0
        for _ in range(data['max_edges']):
            updated = dist.copy()
            for u, v, w in data['edges']:
                updated[v] = min(updated[v], dist[u] + w)
            dist = updated
        return -1 if dist[data['target']] == float('inf') else dist[data['target']]
    # Reachability at each weight threshold, rather than path enumeration.
    for limit in sorted({w for u, v, w in data['edges']}):
        seen = {data['source']}
        changed = True
        while changed:
            changed = False
            for u, v, w in data['edges']:
                if w <= limit and ((u in seen) != (v in seen)):
                    seen.update([u, v])
                    changed = True
        if data['target'] in seen:
            return limit
    return -1


report = {}
for family, cases in helpers['build_fixtures']().items():
    mismatches = sum(alternate(family, case) != helpers['oracle'](family, case) for case in cases)
    report[family] = {'inputs': len(cases), 'oracle_disagreements': mismatches}
    assert mismatches == 0, report[family]
print(json.dumps(report, indent=2))
