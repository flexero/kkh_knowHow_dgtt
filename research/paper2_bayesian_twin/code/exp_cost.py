"""Computational cost and Monte Carlo error of the twin (MEASURED on the author's PC / SIMULATED outputs).

1. wall time of one reduced-order DES month (330 h), without and with event recording (single core);
2. wall time of the conjugate update of all 13 stations with one month of statistics;
3. wall time of one monthly prediction for N_theta = 20, 40, 100, 200 (single core, R = 1);
4. Monte Carlo error of the prediction: 30 independent repetitions of the month-6 prediction of P07 in scenario 1
   (posterior after months 1-5 of the 'main' truth) -> relative SD of mean, 5 % and 95 % quantiles.
Usage: python exp_cost.py
"""
import json
import os
import platform
import random
import statistics
import time
from multiprocessing import Pool

import p2common as c

NTH = (20, 40, 100, 200)
REPS = 30


def posterior_month6(s=1, rho=0.7):
    design, truth = c.rx.make_truth(s)
    rng_truth = random.Random(f'truth-tau2.0-mm0-{s}')
    bel = [c.rx.StationBelief(st, 1.0) for st in design]
    obs_last = None
    for k in range(1, 6):
        _, obs, _ = c.simulate_mm(c.true_line(design, truth, k), c.flowline.MIX, c.HOURS, rng_truth, record=True)
        for b, o in zip(bel, obs):
            b.update(o, rho)
        obs_last = obs
    return design, bel, obs_last


def mc_rep(args):
    n_theta, r = args
    design, bel, _ = posterior_month6()
    vals = c.predict_bayes(design, bel, random.Random(f'mcerr-{n_theta}-{r}'), n_theta=n_theta)
    sm = c.summary(vals)
    return n_theta, sm['mean'], sm['q05'], sm['q95']


def main():
    out = {'machine': f'{platform.processor()} | {platform.system()} {platform.release()} | Python {platform.python_version()}',
           'cpu_count': os.cpu_count()}
    design = c.flowline.compressor_line()
    rng = random.Random(7)
    c.flowline.simulate(design, c.flowline.MIX, c.HOURS, rng)       # warm-up
    t0 = time.perf_counter()
    n = 30
    parts = 0
    for _ in range(n):
        parts += c.flowline.simulate(design, c.flowline.MIX, c.HOURS, rng)[2]
    out['des_run_s'] = (time.perf_counter() - t0) / n
    out['parts_released_per_month'] = parts / n
    t0 = time.perf_counter()
    for _ in range(10):
        _, obs, _ = c.flowline.simulate(design, c.flowline.MIX, c.HOURS, rng, record=True)
    out['des_run_record_s'] = (time.perf_counter() - t0) / 10
    # conjugate update of 13 stations (note: thesis CycleTime.update takes the cycle list; a gateway would pass
    # Welford statistics - the list version is an upper bound on the cost)
    bel = [c.rx.StationBelief(st, 1.0) for st in design]
    t0 = time.perf_counter()
    m = 200
    for _ in range(m):
        for b, o in zip(bel, obs):
            b.update(o, 0.7)
    out['update_13_stations_ms'] = (time.perf_counter() - t0) / m * 1000
    out['hyperparameters_per_station'] = 2 + 2 + 4 + 2
    d6, bel6, _ = posterior_month6()
    for nt in NTH:
        t0 = time.perf_counter()
        c.predict_bayes(d6, bel6, random.Random(1), n_theta=nt)
        out[f'predict_s_Ntheta{nt}'] = time.perf_counter() - t0
    with Pool(15) as p:
        res = p.map(mc_rep, [(nt, r) for nt in NTH for r in range(REPS)], chunksize=1)
    for nt in NTH:
        rr = [x for x in res if x[0] == nt]
        mu = statistics.mean(x[1] for x in rr)
        out[f'mc_Ntheta{nt}'] = {
            'mean_of_means': round(mu, 1),
            'rel_sd_mean_pct': round(100 * statistics.stdev(x[1] for x in rr) / mu, 3),
            'rel_sd_q05_pct': round(100 * statistics.stdev(x[2] for x in rr) / mu, 3),
            'rel_sd_q95_pct': round(100 * statistics.stdev(x[3] for x in rr) / mu, 3),
            'mean_rel_width_90_pct': round(100 * statistics.mean((x[3] - x[2]) for x in rr) / mu, 3)}
    json.dump(out, open(os.path.join(c.DATA, 'computational_cost.json'), 'w'), indent=1)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
