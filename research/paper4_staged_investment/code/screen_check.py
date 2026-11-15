"""Paper 4 - validation of the screening model against the DES at two levels.

A) output level: 300 random (configuration, true factory, ramp-up month) cases, DES with 5 replications
B) decision level: 40 random decision states (true factory, stage, installed options, demand level). For every
   feasible action the rolling-horizon objective V_s (Eq. 12 of the paper, perfect information) is evaluated once
   with the screening model and once with the DES (3 replications per period, common random numbers). Reported:
   share of states in which both choose the same action, DES-evaluated regret of the screening choice, and the rank
   correlation of the action values.
Output: ../data/screen_check.json, ../data/screen_cases.csv
"""
from __future__ import annotations

import csv
import json
import math
import os
import random
import statistics
from multiprocessing import Pool

import staged as sd
stg, flowline = sd.stg, sd.flowline
DATA = os.path.normpath(os.path.join(sd.HERE, '..', 'data'))


def rand_truth(rng):
    return [{'f_mtbf': rng.uniform(0.6, 1.1), 'f_mttr': rng.uniform(1.0, 1.5), 'f_speed': rng.uniform(0.98, 1.12),
             'sigma': rng.uniform(0.04, 0.10), 'f_scrap': rng.uniform(1.0, 2.0)} for _ in range(13)]


def rand_opts(rng):
    opts = tuple(o for o in stg.OPT if rng.random() < 0.5)
    if 'AGV' in opts and 'MES' not in opts:
        opts = opts + ('MES',)
    return tuple(sorted(opts))


def case_a(i):
    rng = random.Random(70_000 + i)
    opts, truth, k = rand_opts(rng), rand_truth(rng), rng.randint(1, 27)
    line = stg.config_line(opts, truth, k)
    des = [flowline.simulate(line, flowline.MIX, stg.HOURS, random.Random(80_000 + 10 * i + r))[0] for r in range(5)]
    m = statistics.mean(des)
    return dict(case=i, opts='+'.join(opts) or '-', month=k, buffer=line[0].buffer, des=round(m, 1),
                des_sd=round(statistics.stdev(des), 1), screen=round(stg.screen_th(line), 1),
                err=(stg.screen_th(line) - m) / m)


def spearman(a, b):
    def ranks(x):
        order = sorted(range(len(x)), key=lambda i: x[i])
        r = [0.0] * len(x)
        for pos, i in enumerate(order):
            r[i] = pos
        return r
    ra, rb = ranks(a), ranks(b)
    ma, mb = statistics.mean(ra), statistics.mean(rb)
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = math.sqrt(sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb))
    return num / den if den else 1.0


def case_b(i):
    rng = random.Random(90_000 + i)
    truth = rand_truth(rng)
    s = rng.randint(1, 4)
    plans = sd.enumerate_plans(stg.BUDGET)
    p = rng.choice(plans)
    installed = ()
    for c in p[:s - 1]:
        installed = tuple(sorted(set(installed) | set(c)))
    f = rng.uniform(0.8, 1.2)
    dem = [d * f for d in stg.DEMAND]
    cache = {}

    def th_des(opts, t):
        key = (opts, t)
        if key not in cache:
            line = stg.line_for(opts, ('truth', truth), t)
            cache[key] = statistics.mean(flowline.simulate(line, flowline.MIX, stg.HOURS,
                                                           random.Random(95_000 + 100 * i + 10 * t + r))[0]
                                         for r in range(3))
        return cache[key]

    def th_scr(opts, t):
        return stg.screen_th(stg.line_for(opts, ('truth', truth), t))

    def value(comb, th):
        opts = tuple(sorted(set(installed) | set(comb)))
        opex = stg.OPEX * sum(stg.OPTIONS[o][0] for o in opts) * sum(1 / (1 + stg.DISC) ** t
                                                                     for t in range(s, stg.STAGES + 1 + stg.TERMINAL))
        v = sum(stg.stage_value(th(opts, t), dem[t - 1], t) for t in range(s, stg.STAGES + 1))
        v += sum(stg.stage_value(th(opts, stg.STAGES + 1), dem[-1], t)
                 for t in range(stg.STAGES + 1, stg.STAGES + 1 + stg.TERMINAL))
        return v - opex - sum(stg.OPTIONS[o][0] for o in comb) / (1 + stg.DISC) ** s

    acts = stg.feasible_additions(installed, stg.BUDGET)
    vs = [value(a, th_scr) for a in acts]
    vd = [value(a, th_des) for a in acts]
    a_s = max(range(len(acts)), key=lambda j: vs[j])
    a_d = max(range(len(acts)), key=lambda j: vd[j])
    return dict(state=i, stage=s, installed='+'.join(installed) or '-', n_actions=len(acts),
                choice_screen='+'.join(acts[a_s]) or '-', choice_des='+'.join(acts[a_d]) or '-',
                same=a_s == a_d, regret_eur=vd[a_d] - vd[a_s],
                gain_des_eur=vd[a_d] - vd[acts.index(())], spearman=spearman(vs, vd))


def init(eta):
    stg.ETA.update(eta)
    sd.apply_settings(sd.DEFAULT)


def main():
    eta = {int(k): v for k, v in json.load(open(os.path.join(DATA, 'eta.json'))).items()}
    with Pool(15, initializer=init, initargs=(eta,)) as p:
        A = p.map(case_a, range(300))
        B = p.map(case_b, range(40))
    errs = [r['err'] for r in A]
    ae = sorted(abs(e) for e in errs)
    out = {'A_output_level': {
        'n': len(A), 'mape_pct': 100 * statistics.mean(ae), 'bias_pct': 100 * statistics.mean(errs),
        'p95_abs_pct': 100 * ae[int(0.95 * len(ae)) - 1], 'max_abs_pct': 100 * ae[-1],
        'mape_month_le6_pct': 100 * statistics.mean(abs(r['err']) for r in A if r['month'] <= 6),
        'mape_month_gt6_pct': 100 * statistics.mean(abs(r['err']) for r in A if r['month'] > 6),
        'mape_buffer2_pct': 100 * statistics.mean(abs(r['err']) for r in A if r['buffer'] == 2),
        'mape_buffer4_pct': 100 * statistics.mean(abs(r['err']) for r in A if r['buffer'] == 4),
        'mean_des_cv_pct': 100 * statistics.mean(r['des_sd'] / r['des'] for r in A)},
        'B_decision_level': {
            'n_states': len(B), 'same_choice': sum(r['same'] for r in B),
            'mean_regret_eur': statistics.mean(r['regret_eur'] for r in B),
            'max_regret_eur': max(r['regret_eur'] for r in B),
            'mean_gain_des_eur': statistics.mean(r['gain_des_eur'] for r in B),
            'regret_share_of_gain_pct': 100 * sum(r['regret_eur'] for r in B) / max(1.0, sum(r['gain_des_eur'] for r in B)),
            'mean_spearman': statistics.mean(r['spearman'] for r in B),
            'states': B}}
    json.dump(out, open(os.path.join(DATA, 'screen_check.json'), 'w'), indent=1, default=float)
    with open(os.path.join(DATA, 'screen_cases.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(A[0]))
        w.writeheader()
        w.writerows(A)
    print(json.dumps({k: v for k, v in out['A_output_level'].items()}, indent=1))
    print(json.dumps({k: v for k, v in out['B_decision_level'].items() if k != 'states'}, indent=1))


if __name__ == '__main__':
    main()
