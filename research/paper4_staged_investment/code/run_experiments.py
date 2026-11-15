"""Run the paper-4 experiments (seeded, reproducible). Results -> ../data/*.csv

Usage: python run_experiments.py [main|risk|learning|econ|epistemic|all] [n_scenarios]
  main       11 policies, 200 scenarios, beta = 0                         -> data/main.csv
  risk       beta in {0.5, 2, 5}                                          -> data/risk.csv
  learning   rho in {0.5, 0.85, 1.0}, prior weight w in {0.25, 4}, N_theta in {20, 120} -> data/learning.csv
  econ       one-at-a-time economic sensitivity (100 scenarios)           -> data/econ.csv
  epistemic  scale lambda of the true-factory deviation in {0, 0.5, 1.5} (100 scenarios) -> data/epistemic.csv
Wall time on 15 worker processes: main ~6 min, all ~35 min.
"""
from __future__ import annotations

import csv
import json
import os
import sys
import time
from multiprocessing import Pool

import staged as sd

DATA = os.path.normpath(os.path.join(sd.HERE, '..', 'data'))
WORKERS = 15


def eta_once():
    fn = os.path.join(DATA, 'eta.json')
    if os.path.exists(fn):
        return {int(k): v for k, v in json.load(open(fn)).items()}
    sd.apply_settings(sd.DEFAULT)
    eta = sd.stg.calibrate_eta()
    json.dump(eta, open(fn, 'w'), indent=1)
    return eta


def run_setting(tag, cfg_over, policies, n):
    cfg = dict(sd.DEFAULT, **cfg_over)
    eta = eta_once()
    sd.stg.ETA.update(eta)
    sd.apply_settings(cfg)
    fixed = sd.sp_plan(cfg) if 'STATIC_SP' in policies else None
    t0 = time.time()
    with Pool(WORKERS, initializer=sd.init_worker, initargs=(cfg, eta, fixed)) as p:
        res = p.map(sd.run_scenario, [(s, policies, tag) for s in range(1, n + 1)], chunksize=1)
    rows = [r for x in res for r in x]
    for r in rows:
        r['sp_plan'] = '|'.join('+'.join(c) or '-' for c in fixed) if fixed else ''
    print(f'{tag:28s} {n} scenarios, {len(policies)} policies, {time.time() - t0:6.1f} s', flush=True)
    return rows


def write(rows, name):
    os.makedirs(DATA, exist_ok=True)
    keys = []
    for r in rows:
        for k in r:
            if k not in keys:
                keys.append(k)
    with open(os.path.join(DATA, name), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)
    print('written', name, len(rows), 'rows', flush=True)


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else 'main'
    n = int(sys.argv[2]) if len(sys.argv) > 2 else None
    core = ('NONE', 'ALL', 'STATIC', 'STATIC_SP', 'ADAPTIVE')
    if what in ('main', 'all'):
        write(run_setting('main', {}, sd.ALL_POLICIES, n or 200), 'main.csv')
    if what in ('risk', 'all'):
        rows = []
        for b in (0.5, 2.0, 5.0):
            rows += run_setting(f'beta={b}', {'beta': b}, core, n or 200)
        write(rows, 'risk.csv')
    if what in ('learning', 'all'):
        rows = []
        for tag, over in (('rho=0.5', {'rho': 0.5}), ('rho=0.85', {'rho': 0.85}), ('rho=1.0', {'rho': 1.0}),
                          ('w=0.25', {'w': 0.25}), ('w=4', {'w': 4.0}),
                          ('ntheta=20', {'n_theta': 20}), ('ntheta=120', {'n_theta': 120})):
            rows += run_setting(tag, over, ('NONE', 'STATIC', 'ADAPTIVE'), n or 200)
        write(rows, 'learning.csv')
    if what in ('econ', 'all'):
        rows = []
        pols = ('NONE', 'ALL', 'STATIC', 'STATIC_SP', 'ADAPT_DEM', 'ADAPTIVE', 'PI_PLAN')
        for tag, over in (('base', {}),
                          ('margin -30%', {'eco': {'MARGIN': 315.0}}), ('margin +30%', {'eco': {'MARGIN': 585.0}}),
                          ('capex -30%', {'capex_scale': 0.7}), ('capex +30%', {'capex_scale': 1.3}),
                          ('budget 250k', {'eco': {'BUDGET': 250_000.0}}), ('budget 800k', {'eco': {'BUDGET': 800_000.0}}),
                          ('penalty 0', {'eco': {'PENALTY': 0.0}}), ('penalty 150', {'eco': {'PENALTY': 150.0}}),
                          ('discount 2.5%', {'eco': {'DISC': 0.025}}), ('discount 10%', {'eco': {'DISC': 0.10}}),
                          ('demand width 0.1', {'dem_width': 0.1}), ('demand width 0.3', {'dem_width': 0.3}),
                          ('forecast x1.15', {'dem_scale': 1.15})):
            rows += run_setting(tag, over, pols, n or 100)
        write(rows, 'econ.csv')
    if what in ('epistemic', 'all'):
        rows = []
        pols = ('NONE', 'ALL', 'STATIC', 'STATIC_SP', 'ADAPT_DEM', 'ADAPTIVE', 'PI_PLAN')
        for lam in (0.0, 0.5, 1.5):
            rows += run_setting(f'lambda={lam}', {'lam': lam}, pols, n or 100)
        write(rows, 'epistemic.csv')


if __name__ == '__main__':
    main()
