"""Paper 4 - value-of-information and first-stage robustness in the 'model world'.

For every scenario the plan actually implemented by each policy (columns a1..a4 of the experiment CSV) is valued
with the screening model under the TRUE parameters and the realised demand (Eq. 3 with Y from Eq. 10). In this
metric the clairvoyant plan PI_PLAN is the exact maximum over all 2 695 feasible staged plans, so
  EVPI(policy) = E[V(PI_PLAN)] - E[V(policy)]
is a proper perfect-information bound, free of DES noise. The realised (DES) values are reported in analyse.py.

First-stage robustness: for every feasible first-stage action a1 the clairvoyant regret
  R_i(a1) = max_plan V_i(plan) - max_{plan: first stage = a1} V_i(plan)
is computed per scenario (later stages chosen with hindsight, i.e. the regret of the commitment alone).
Output: ../data/voi.json
"""
from __future__ import annotations

import collections
import csv
import json
import os
import statistics
import sys

import staged as sd
import stats_utils as su
stg = sd.stg
DATA = os.path.normpath(os.path.join(sd.HERE, '..', 'data'))


def parse(a):
    return () if a == '-' else tuple(a.split('+'))


def analyse(fn, setting_cfg):
    rows = list(csv.DictReader(open(os.path.join(DATA, fn), encoding='utf-8')))
    eta = {int(k): v for k, v in json.load(open(os.path.join(DATA, 'eta.json'))).items()}
    stg.ETA.update(eta)
    out = {}
    by = collections.defaultdict(lambda: collections.defaultdict(dict))
    for r in rows:
        by[r['setting']][int(r['scenario'])][r['policy']] = r
    for tag, scs in by.items():
        cfg = dict(sd.DEFAULT, **setting_cfg.get(tag, {}))
        sd.apply_settings(cfg)
        plans = sd.enumerate_plans(stg.BUDGET)
        configs = sd.configs_of(plans) | {tuple(sorted(stg.OPT))}
        firsts = sorted(set(p[0] for p in plans), key=lambda c: (len(c), c))
        V = collections.defaultdict(list)
        reg = collections.defaultdict(list)
        for seed, pols in sorted(scs.items()):
            truth, dem_factor = sd.make_scenario(seed, cfg)
            true_dem = [d * dem_factor for d in stg.DEMAND]
            dem_path = [sd.realised_demand(1000 * seed + 7, true_dem, s) for s in range(1, 5)] + [true_dem[-1]]
            th = {(c, t): stg.screen_th(stg.line_for(c, ('truth', truth), t)) for c in configs for t in range(1, 6)}
            vals = {p: sd.plan_value(p, th, dem_path) for p in plans}
            best = max(vals.values())
            none = vals[((),) * 4]
            for pol, r in pols.items():
                plan = tuple(parse(r[f'a{s}']) for s in range(1, 5))
                v = vals.get(plan)
                if v is None:
                    v = sd.plan_value(plan, th, dem_path)
                V[pol].append((v - none) / 1e6)
            V['CLAIRVOYANT'].append((best - none) / 1e6)
            bestfirst = {}
            for p, v in vals.items():
                if v > bestfirst.get(p[0], -1e18):
                    bestfirst[p[0]] = v
            for a in firsts:
                reg[a].append((best - bestfirst[a]) / 1e6)
        res = {'mean_model_value': {p: statistics.mean(v) for p, v in V.items()}}
        res['evpi'] = {p: statistics.mean(V['CLAIRVOYANT']) - statistics.mean(v) for p, v in V.items()}
        if 'ADAPTIVE' in V:
            res['paired_vs_adaptive'] = {p: su.paired(V['ADAPTIVE'], v) for p, v in V.items() if p != 'ADAPTIVE'}
        if 'STATIC' in V and 'ADAPTIVE' in V:
            gap = statistics.mean(V['CLAIRVOYANT']) - statistics.mean(V['STATIC'])
            res['share_of_gap_closed_from_STATIC'] = {p: (statistics.mean(v) - statistics.mean(V['STATIC'])) / gap
                                                      for p, v in V.items()} if gap > 0 else None
        if 'STATIC_SP' in V and 'ADAPTIVE' in V:
            gap = statistics.mean(V['CLAIRVOYANT']) - statistics.mean(V['STATIC_SP'])
            res['share_of_gap_closed_from_SP'] = (statistics.mean(V['ADAPTIVE']) - statistics.mean(V['STATIC_SP'])) / gap if gap > 0 else None
        res['first_stage_regret'] = {('+'.join(a) or 'wait'): dict(mean=statistics.mean(r), max=max(r),
                                                                    p95=sorted(r)[int(0.95 * len(r)) - 1],
                                                                    p_zero=sum(x < 1e-9 for x in r) / len(r))
                                     for a, r in reg.items()}
        out[tag] = res
        print(f'\n== {fn} [{tag}] model-world value (M EUR vs NONE) and EVPI')
        for p in sorted(V, key=lambda p: -statistics.mean(V[p])):
            print(f'  {p:12s} {statistics.mean(V[p]):6.2f}   EVPI {res["evpi"][p]:5.2f}')
        print('  first-stage commitment regret (mean / p95 / max / share zero):')
        for a, r in sorted(res['first_stage_regret'].items(), key=lambda kv: kv[1]['mean']):
            print(f'    {a:14s} {r["mean"]:5.3f} {r["p95"]:5.3f} {r["max"]:5.3f} {100 * r["p_zero"]:5.1f} %')
    return out


def main():
    res = {'main': analyse('main.csv', {})}
    if os.path.exists(os.path.join(DATA, 'epistemic.csv')):
        res['epistemic'] = analyse('epistemic.csv', {f'lambda={l}': {'lam': l} for l in (0.0, 0.5, 1.5)})
    json.dump(res, open(os.path.join(DATA, 'voi.json'), 'w'), indent=1, default=float)


if __name__ == '__main__':
    main()
