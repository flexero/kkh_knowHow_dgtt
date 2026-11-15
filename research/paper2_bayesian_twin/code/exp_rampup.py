"""Virtual ramp-up experiments of paper 2 (extends thesis chapter 6; all results are SIMULATED).

Each hidden true factory follows the thesis generator (Table 6.1) with optional changes of the ramp-up time constant
and of the model form of the truth. Month by month the predictors forecast the good output of month k+1 from data of
months 1..k only (frozen-prediction protocol); the forecast is written before month k+1 is simulated.

Predictors simulated here (discrepancy-corrected variants are added post hoc in analyse.py):
  B0   design point values, stochastic DES (20 reps), never updated
  B1   point estimates (MLE) from month 1, then frozen (thesis)
  B2   NEW: rolling re-calibration - point estimates from the last month only, re-estimated every month
  NV   NEW: naive persistence forecast  Yhat_{k+1} = Y_k (no model)
  P0   prior predictive with design priors, frozen
  Prr  sequential conjugate updating with forgetting factor rho = rr/10 (P10 = rho 1.0, P07 = rho 0.7, ...)
Usage: python exp_rampup.py <variant> [n_scenarios]
  variants: main | w0.25 | w4 | tau1 | tau4 | stat | mm
"""
from __future__ import annotations

import csv
import os
import random
import sys
import time
from multiprocessing import Pool

import p2common as c

VARIANTS = {
    'main':  dict(w=1.0, tau=2.0, tau_q=1.5, mm=False, rhos=(1.0, 0.9, 0.8, 0.7, 0.6, 0.5),
                  base=('B0', 'B1', 'B2', 'NV', 'P0'), bn=True),
    'w0.25': dict(w=0.25, tau=2.0, tau_q=1.5, mm=False, rhos=(1.0, 0.7), base=('P0',), bn=False),
    'w4':    dict(w=4.0, tau=2.0, tau_q=1.5, mm=False, rhos=(1.0, 0.7), base=('P0',), bn=False),
    'tau1':  dict(w=1.0, tau=1.0, tau_q=0.75, mm=False, rhos=(1.0, 0.7), base=('B0', 'NV', 'P0'), bn=False),
    'tau4':  dict(w=1.0, tau=4.0, tau_q=3.0, mm=False, rhos=(1.0, 0.7), base=('B0', 'NV', 'P0'), bn=False),
    'stat':  dict(w=1.0, tau=0.0, tau_q=0.0, mm=False, rhos=(1.0, 0.7), base=('B0', 'NV', 'P0'), bn=False),
    'mm':    dict(w=1.0, tau=2.0, tau_q=1.5, mm=True, rhos=(1.0, 0.7), base=('B0', 'NV', 'P0'), bn=False),
}
MM_TTF_SHAPE, MM_REP_LOGSD = 0.7, 1.0     # model-form mismatch of the truth: Weibull TTF, log-normal repairs


def pname(rho):
    return 'P%02d' % round(rho * 10)


def row(variant, s, k, method, summ, truth, crps=None):
    r = {'variant': variant, 'scenario': s, 'month': k, 'method': method, 'truth': truth,
         'pred': round(summ['mean'], 2)}
    for q in c.QLEVELS:
        key = f'q{int(round(q * 100)):02d}'
        r[key] = summ[key]
    r['crps'] = '' if crps is None else round(crps, 3)
    return r


def run_scenario(args):
    variant, s = args
    cfg = VARIANTS[variant]
    w = cfg['w']
    design, truth = c.rx.make_truth(s)                         # thesis truth parameters for seed s
    tkey = f"tau{cfg['tau']}-mm{int(cfg['mm'])}"
    rng_truth = random.Random(f'truth-{tkey}-{s}')
    sim_kw = dict(ttf_shape=MM_TTF_SHAPE, rep_logsd=MM_REP_LOGSD) if cfg['mm'] else {}
    base = cfg['base']
    rows, bnrows = [], []

    # month-1 forecasts (no data): point predictors use the design model, Bayesian ones the prior predictive
    preds = {}                                                     # method -> sample (list of outputs)
    b0 = c.predict_point(design, random.Random(f'point-B0-{s}-1'))
    for m in ('B0', 'B1', 'B2', 'NV'):
        if m in base:
            preds[m] = b0
    beliefs0 = [c.rx.StationBelief(st, w) for st in design]
    p0 = c.predict_bayes(design, beliefs0, random.Random(f'bayes-{s}-1'))
    if 'P0' in base:
        preds['P0'] = p0
    beliefs = {rho: [c.rx.StationBelief(st, w) for st in design] for rho in cfg['rhos']}
    for rho in cfg['rhos']:
        preds[pname(rho)] = p0
    b2_line = design
    cap_design = c.capacities(design)
    for k in range(1, c.MONTHS + 1):
        tl = true_line = c.true_line(design, truth, k, cfg['tau'], cfg['tau_q'])
        if cfg['bn']:                                              # station-level knowledge before month k
            cap_true = c.capacities(tl)
            cps = {'B0': cap_design, 'B2': c.capacities(b2_line)}
            for rho in cfg['rhos']:
                cps[pname(rho)] = c.capacities(c.posterior_line(design, beliefs[rho]))
            for m, cp in cps.items():
                hit, mape, bt, bp = c.bn_metrics(cp, cap_true)
                bnrows.append({'scenario': s, 'month': k, 'method': m, 'bn_true': design[bt].name,
                               'bn_pred': design[bp].name, 'hit': hit, 'cap_mape': round(mape, 5)})
        y, obs, _ = c.simulate_mm(true_line, c.flowline.MIX, c.HOURS, rng_truth, record=True, **sim_kw)
        for m, vals in preds.items():
            rows.append(row(variant, s, k, m, c.summary(vals), y, c.crps_sample(vals, y)))
        if k == c.MONTHS:
            break
        # ---- learn from month k, forecast month k+1 (stored before month k+1 is simulated)
        kk = k + 1
        if 'B1' in base and k == 1:
            preds['B1'] = c.predict_point(c.mle_line(design, obs), random.Random(f'point-B1-{s}-{kk}'))
        if 'B2' in base:
            b2_line = c.mle_line(design, obs, fallback=b2_line)
            preds['B2'] = c.predict_point(b2_line, random.Random(f'point-B2-{s}-{kk}'))
        if 'NV' in base:
            preds['NV'] = [y]
        for rho, bl in beliefs.items():
            for b, o in zip(bl, obs):
                b.update(o, rho)
            preds[pname(rho)] = c.predict_bayes(design, bl, random.Random(f'bayes-{s}-{kk}'))
    return rows, bnrows


def main():
    variant = sys.argv[1] if len(sys.argv) > 1 else 'main'
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 100
    c.verify_simulator()
    t0 = time.time()
    with Pool(15) as pool:
        res = pool.map(run_scenario, [(variant, s) for s in range(1, n + 1)], chunksize=1)
    rows = [r for a, _ in res for r in a]
    bn = [r for _, b in res for r in b]
    os.makedirs(c.DATA, exist_ok=True)
    out = os.path.join(c.DATA, f'rampup_{variant}.csv')
    with open(out, 'w', newline='', encoding='utf-8') as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(rows)
    if bn:
        with open(os.path.join(c.DATA, f'bottleneck_{variant}.csv'), 'w', newline='', encoding='utf-8') as f:
            wr = csv.DictWriter(f, fieldnames=list(bn[0].keys()))
            wr.writeheader()
            wr.writerows(bn)
    print(f'{variant}: {n} scenarios, {len(rows)} rows, {time.time() - t0:.0f} s wall time ->', out)


if __name__ == '__main__':
    main()
