"""Independent bounded evaluator. Never sent to the reviewed model."""
import json
import random
import math
import copy

def valid_input(family, data):
    if not isinstance(data, dict):
        return False
    if family == 'weighted_intervals':
        if set(data) != {'jobs'} or not isinstance(data['jobs'], list) or len(data['jobs']) > 12:
            return False
        return all(isinstance(j, list) and len(j) == 3 and all(type(v) is int for v in j)
                   and 0 <= j[0] < j[1] <= 20 and 1 <= j[2] <= 30 for j in data['jobs'])
    keys={'n','edges','source','target'} | ({'max_edges'} if family == 'bounded_route' else set())
    if set(data) != keys or any(type(data[k]) is not int for k in keys - {'edges'}):
        return False
    n=data['n']
    if not 2 <= n <= 8 or not 0 <= data['source'] < n or not 0 <= data['target'] < n or data['source']==data['target']:
        return False
    if family == 'bounded_route' and not 0 <= data['max_edges'] <= 7:
        return False
    if not isinstance(data['edges'], list):
        return False
    seen=set()
    for edge in data['edges']:
        if not isinstance(edge,list) or len(edge)!=3 or any(type(x) is not int for x in edge):
            return False
        u,v,w=edge
        if not 0<=u<n or not 0<=v<n or u==v or not 1<=w<=20:
            return False
        key=(u,v) if family=='bounded_route' else tuple(sorted((u,v)))
        if key in seen:
            return False
        seen.add(key)
    return True


def oracle(family, data):
    if family == 'weighted_intervals':
        jobs=data['jobs']
        result=0
        for mask in range(1 << len(jobs)):
            selected=sorted((jobs[i] for i in range(len(jobs)) if mask & (1<<i)), key=lambda j:j[0])
            if all(selected[i-1][1] <= selected[i][0] for i in range(1,len(selected))):
                result=max(result,sum(j[2] for j in selected))
        return result
    graph=[[] for _ in range(data['n'])]
    for u,v,w in data['edges']:
        graph[u].append((v,w))
        if family=='bottleneck_route':
            graph[v].append((u,w))
    best=float('inf')
    limit=data.get('max_edges',data['n']-1)
    # Positive edge costs mean removing cycles never worsens either objective.
    def visit(node,seen,used,score):
        nonlocal best
        if score>=best:
            return
        if node==data['target']:
            best=score
            return
        if used==limit:
            return
        for nxt,w in graph[node]:
            if nxt not in seen:
                next_score=score+w if family=='bounded_route' else max(score,w)
                visit(nxt,seen|{nxt},used+1,next_score)
    visit(data['source'],{data['source']},0,0)
    return -1 if best==float('inf') else best


def build_fixtures():
    rng=random.Random(20261121)
    data={
        'bounded_route':[{'n':5,'edges':[[0,1,4],[0,2,1],[2,1,1],[1,3,1],[3,4,1]],'source':0,'target':4,'max_edges':3}],
        'weighted_intervals':[{'jobs':[[0,2,4],[1,5,7],[3,6,4]]}],
        'bottleneck_route':[{'n':4,'edges':[[0,3,9],[0,1,5],[1,2,5],[2,3,5]],'source':0,'target':3}]
    }
    for family in data:
        while len(data[family])<200:
            if family=='weighted_intervals':
                jobs=[]
                for _ in range(rng.randrange(10)):
                    start=rng.randrange(15)
                    end=rng.randint(start+1,20)
                    jobs.append([start,end,rng.randint(1,30)])
                case={'jobs':jobs}
            else:
                n=rng.randint(2,7)
                source,target=rng.sample(range(n),2)
                edges=[]
                for u in range(n):
                    for v in range(n):
                        if u==v or (family=='bottleneck_route' and u>v):
                            continue
                        if rng.random()<0.3:
                            edges.append([u,v,rng.randint(1,20)])
                case={'n':n,'edges':edges,'source':source,'target':target}
                if family=='bounded_route':
                    case['max_edges']=rng.randint(0,7)
            assert valid_input(family,case)
            data[family].append(case)
    return data


def candidate_call(code, data):
    namespace = {"__name__": "candidate"}
    try:
        exec(compile(code, "candidate.py", "exec"), namespace)
        result = namespace["solve"](**copy.deepcopy(data))
        if type(result) is not int:
            return {"value": None, "error": "Return value is not an integer"}
        return {"value": result, "error": None}
    except Exception as error:
        return {"value": None, "error": type(error).__name__ + ": " + str(error)}


def normalize_edges(family, edges):
    return sorted((u, v, w) if family == 'bounded_route' else (min(u, v), max(u, v), w)
                  for u, v, w in edges)


def valid_relation(family, relation, before, after):
    if not valid_input(family, before) or not valid_input(family, after):
        return False
    if relation == 'input_permutation':
        field = 'jobs' if family == 'weighted_intervals' else 'edges'
        return ({k: v for k, v in before.items() if k != field} ==
                {k: v for k, v in after.items() if k != field}
                and sorted(map(tuple, before[field])) == sorted(map(tuple, after[field])))
    if relation == 'edge_addition' and family != 'weighted_intervals':
        return ({k: v for k, v in before.items() if k != 'edges'} ==
                {k: v for k, v in after.items() if k != 'edges'}
                and set(normalize_edges(family, before['edges'])) <
                set(normalize_edges(family, after['edges'])))
    if relation == 'budget_relaxation' and family == 'bounded_route':
        return ({k: v for k, v in before.items() if k != 'max_edges'} ==
                {k: v for k, v in after.items() if k != 'max_edges'}
                and after['max_edges'] > before['max_edges'])
    return False


def evaluate(payload):
    family, code = payload['family'], payload['code']
    if payload['mode'] == 'bank':
        cases = build_fixtures()[family]
        failures = []
        for case in cases:
            actual = candidate_call(code, case)
            expected = oracle(family, case)
            if actual['error'] or actual['value'] != expected:
                failures.append({'input': case, 'expected': expected, 'actual': actual})
        return {'count': len(cases), 'failures': len(failures), 'first_failure': next(iter(failures), None)}
    evidence = payload.get('evidence')
    if evidence is None:
        return {'status': 'no_evidence', 'confirmed': False}
    data = evidence.get('input')
    if not valid_input(family, data):
        return {'status': 'invalid_input', 'confirmed': False}
    if evidence['kind'] == 'counterexample':
        expected = oracle(family, data)
        actual = candidate_call(code, data)
        confirmed = bool(actual['error']) or actual['value'] != expected
        expected_matches = expected == evidence['expected']
        predicted_matches = actual['value'] == evidence['predicted_actual']
        return {'status': 'confirmed' if confirmed else 'not_confirmed',
                'confirmed': confirmed, 'oracle_expected': expected, 'actual': actual,
                'expected_matches': expected_matches, 'predicted_matches': predicted_matches,
                'fully_validated': confirmed and expected_matches and predicted_matches}
    after = evidence.get('followup_input')
    relation = evidence.get('relation')
    if not valid_relation(family, relation, data, after):
        return {'status': 'invalid_transformation', 'confirmed': False}
    first, second = candidate_call(code, data), candidate_call(code, after)
    if first['error'] or second['error']:
        return {'status': 'execution_error', 'confirmed': False, 'before': first, 'after': second}
    if relation == 'input_permutation':
        confirmed = first['value'] != second['value']
    else:
        value1 = math.inf if first['value'] == -1 else first['value']
        value2 = math.inf if second['value'] == -1 else second['value']
        confirmed = value2 > value1
    return {'status': 'confirmed' if confirmed else 'not_confirmed',
            'confirmed': confirmed, 'fully_validated': confirmed,
            'oracle_free': True, 'before': first, 'after': second}
