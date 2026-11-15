"""KPIs of every virtual-plant replication and aggregation per configuration (mean, standard deviation, 95 % CI).

usage: python analyse.py            -> data/runs.csv (one row per replication), data/summary.json (per configuration)
All times are converted to simulated (plant) seconds; the first WARM_H simulated hours are discarded.
"""
import collections
import csv
import glob
import json
import math
import os
import statistics as st
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mva_models as M                                    # noqa: E402

RAW = os.path.join(HERE, '..', 'data', 'raw')
WARM_H = 0.5
T975 = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262}
KIND = lambda s: 'R' if s <= 12 else ('L' if s == 13 else 'H')


def run_kpis(path):
    d = json.load(open(path))
    a = d['args']; sp = a['speed']; t0, t1 = d['t0'], d['t1']
    ws = t0 + WARM_H * 3600 / sp
    win = (t1 - ws) * sp                                   # window length [simulated s]
    J = [j for j in d['jobs'] if j['status'] == 'done' or (j['status'] in ('unknown',) and j['done_t'])]
    for j in d['jobs']:
        j['p'] = json.loads(j['params'])
    J = [j for j in d['jobs'] if j['done_t']]
    inwin = lambda j: ws <= j['done_t'] <= t1
    dur = lambda j: (j['done_t'] - j['created']) * sp

    def busy(code, dev=None):
        s = 0.0
        for j in J:
            if j['code'] == code and (dev is None or j['device'] == dev):
                lo, hi = max(j['created'], ws), min(j['done_t'], t1)
                if hi > lo:
                    s += (hi - lo) * sp
        return s
    H = [j for j in J if j['code'] == 10 and inwin(j)]
    r = {'tag': os.path.basename(path)[:-5], 'exp': r_exp(d), 'rules': a['rules'], 'N': a['N'], 'seed': a['seed'],
         'mix': a['mix'], 'opf': a['opf'], 'speed': sp, 'win_h': win / 3600}
    r['parts'] = len(H)
    r['X'] = len(H) / (win / 3600)
    var = collections.Counter(j['p']['job.variant'] for j in H)
    for v in (1, 2, 3):
        r[f'n_v{v}'] = var.get(v, 0)
    r['share_vc30'] = var.get(3, 0) / max(1, len(H))
    for m in ('HMC-01', 'HMC-02', 'HMC-03'):
        r['U_' + m] = busy(10, m) / win
    r['U_H'] = (r['U_HMC-01'] + r['U_HMC-02'] + r['U_HMC-03']) / 3
    r['U_L'] = busy(12) / win
    r['U_S'] = busy(11) / win
    r['pallets_used'] = len({j['p']['job.palletId'] for j in H})
    r['pallets_used_B'] = len({j['p']['job.palletId'] for j in H if j['p']['job.palletId'] >= 9})
    r['cycle_s'] = r['pallets_used'] / r['X'] * 3600 if r['X'] else 0
    mv = [j for j in J if j['code'] == 11 and inwin(j)]
    r['moves_per_part'] = len(mv) / max(1, len(H))
    kinds = collections.defaultdict(list)
    for j in mv:
        kinds[KIND(j['p']['move.src']) + KIND(j['p']['move.dst'])].append(M.move(j['p']['move.src'], j['p']['move.dst']))
    for k in ('LH', 'HR', 'RL', 'HL', 'RH', 'LR'):
        r['n_' + k] = len(kinds.get(k, []))
        r['m_' + k] = st.mean(kinds[k]) if kinds.get(k) else 0.0
    r['move_nominal_mean'] = st.mean(M.move(j['p']['move.src'], j['p']['move.dst']) for j in mv) if mv else 0
    r['move_meas_mean'] = st.mean(dur(j) for j in mv) if mv else 0
    lt = [j for j in J if j['code'] == 12 and inwin(j)]
    r['op_task_mean'] = st.mean(dur(j) for j in lt) if lt else 0
    r['op_task3_mean'] = st.mean([dur(j) for j in lt if j['p']['task.type'] == 3] or [0])
    r['n_task'] = dict(collections.Counter(j['p']['task.type'] for j in lt))
    r['hmc_job_mean'] = st.mean(dur(j) for j in H) if H else 0
    Ls = sorted([j for j in J if j['code'] == 12], key=lambda j: j['created'])
    gaps = [(b['created'] - x['done_t']) * sp for x, b in zip(Ls, Ls[1:]) if x['done_t'] >= ws and b['created'] <= t1]
    r['L_gap'] = st.mean(gaps) if gaps else 0
    # EDD discipline: start time of each work order = creation of its loading task
    start = {}
    for j in d['jobs']:
        if j['code'] == 12 and j['p'].get('wo') and j['status'] in ('done', 'sent', 'unknown'):
            start.setdefault(j['p']['wo'], j['created'])
    idx = {w['id']: int(w['id'].split('-')[1]) for w in d['wos']}
    vv = {w['id']: w['variant'] for w in d['wos']}
    last = max((idx[w] for w in start), default=-1)
    INF = float('inf')
    over, over30 = 0, 0
    for w, i in idx.items():
        if i > last:
            continue
        si = start.get(w, INF)
        k = sum(1 for w2, i2 in idx.items() if i2 > i and start.get(w2, INF) < si)
        over = max(over, k)
        if vv[w] == 3:
            over30 = max(over30, k)
    r['max_overtaken'] = over
    r['max_overtaken_vc30'] = over30
    r['open_vc30_skipped'] = sum(1 for w, i in idx.items() if i <= last and w not in start and vv[w] == 3)
    r['alarms'] = sum(1 for e in d['events'] if e['level'] == 'alarm')
    r['downs'] = sum(1 for e in d['events'] if 'DOWN' in e['text'])
    r['offline_events'] = sum(1 for e in d['events'] if 'OFFLINE' in e['text'])   # validity: must be 0
    r['unknown_jobs'] = sum(1 for j in d['jobs'] if j['status'] == 'unknown')
    # model B with the measured inputs of this run (operator task, HMC job, exchange moves) at N used
    p = M.params(tL=r['op_task_mean'] or 147, DH=r['hmc_job_mean'] or 358.5)
    def wmean(ks):                       # mean nominal time of the measured moves of the kinds ks
        n = sum(r['n_' + k] for k in ks)
        return sum(r['n_' + k] * r['m_' + k] for k in ks) / n if n else 0.0
    m_out_L, m_in_L = wmean(['LH', 'LR']), wmean(['RL', 'HL'])      # moves that empty / refill location 13
    m_in_H, m_out_H = wmean(['LH', 'RH']), wmean(['HR', 'HL'])      # moves that refill / empty an HMC location
    if m_out_L and m_in_L:
        p['eL'] = m_out_L + m_in_L
    if m_in_H and m_out_H:
        p['eH'] = m_in_H + m_out_H
    r['eL_meas'], r['eH_meas'] = p['eL'], p['eH']
    p['DS'] = r['move_nominal_mean'] * r['moves_per_part'] if mv else p['DS']
    p['nmoves'] = max(1.0, r['moves_per_part'])
    nu = max(1, r['pallets_used'])
    r['A_meas_Nused'] = M.modelA(nu, p)[-1]['X_h']
    r['B_meas_Nused'] = M.modelB(nu, p)[0][-1]['X_h']
    r['B_meas_ceiling'] = M.B_curve(p, 12)[-1]['X_h']
    return r


def r_exp(d):
    a = d['args']
    return f"{a['rules']}|N{a['N']}|{a['mix']}|op{a['opf']:.3f}|x{a['speed']:.0f}"


def ci(xs):
    n = len(xs)
    m = st.mean(xs)
    if n < 2:
        return m, 0.0, 0.0
    s = st.stdev(xs)
    return m, s, T975.get(n - 1, 1.96) * s / math.sqrt(n)


def main():
    rows = [run_kpis(p) for p in sorted(glob.glob(os.path.join(RAW, '*.json')))]
    keys = [k for k in rows[0] if k != 'n_task']
    with open(os.path.join(HERE, '..', 'data', 'runs.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=keys + ['n_task'])
        w.writeheader()
        for r in rows:
            w.writerow({k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()})
    groups = collections.defaultdict(list)
    for r in rows:
        groups[r['exp']].append(r)
    summ = {}
    num = [k for k in keys if isinstance(rows[0][k], (int, float)) and k not in ('N', 'seed', 'opf', 'speed')]
    for g, rs in sorted(groups.items()):
        summ[g] = {'n': len(rs), 'tags': [r['tag'] for r in rs]}
        for k in num:
            m, s, h = ci([r[k] for r in rs])
            summ[g][k] = {'mean': m, 'sd': s, 'ci95': h, 'min': min(r[k] for r in rs), 'max': max(r[k] for r in rs)}
    with open(os.path.join(HERE, '..', 'data', 'summary.json'), 'w') as f:
        json.dump(summ, f, indent=1)
    show = ['X', 'U_H', 'U_L', 'U_S', 'pallets_used', 'share_vc30', 'moves_per_part', 'L_gap', 'op_task_mean',
            'move_nominal_mean', 'max_overtaken', 'B_meas_Nused', 'A_meas_Nused', 'offline_events']
    print('config'.ljust(34), 'n', ' '.join(s[:9].rjust(10) for s in show))
    for g, sm in summ.items():
        print(g.ljust(34), sm['n'], ' '.join(f"{sm[k]['mean']:6.2f}±{sm[k]['ci95']:<4.2f}"[:10].rjust(10) for k in show))


if __name__ == '__main__':
    main()
