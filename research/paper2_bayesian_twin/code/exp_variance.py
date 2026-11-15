"""Epistemic vs aleatory share of the predictive variance over the ramp-up (law of total variance), SIMULATED.

Extends thesis section 6.5.5: 30 scenarios instead of 10, both rho = 0.7 and rho = 1.0, more check months.
Truth realisations are identical to the 'main' variant of exp_rampup.py (same truth stream).
Nested Monte Carlo: N_T = 40 outer parameter draws x R = 3 inner replications.
  epistemic = Var_i(mean_r Y_ir) - mean_i(Var_r Y_ir)/R   (bias-corrected between-group variance, clipped at 0)
  aleatory  = mean_i(Var_r Y_ir)
Usage: python exp_variance.py [n_scenarios]
"""
import csv
import os
import random
import statistics
import sys
from multiprocessing import Pool

import p2common as c

N_T, R = 40, 3
CHECK = (1, 2, 3, 4, 6, 8, 10, 12)
RHOS = (0.7, 1.0)


def run(s):
    design, truth = c.rx.make_truth(s)
    rng_truth = random.Random(f'truth-tau2.0-mm0-{s}')
    bel = {rho: [c.rx.StationBelief(st, 1.0) for st in design] for rho in RHOS}
    out = []
    for k in range(1, c.MONTHS + 1):
        if k in CHECK:
            for rho in RHOS:
                rng = random.Random(f'var-{s}-{k}')               # common random numbers across rho
                means, within = [], []
                for _ in range(N_T):
                    line = [b.sample(st, rng) for b, st in zip(bel[rho], design)]
                    ys = [c.flowline.simulate(line, c.flowline.MIX, c.HOURS, rng)[0] for _ in range(R)]
                    means.append(statistics.mean(ys))
                    within.append(statistics.variance(ys))
                ale = statistics.mean(within)
                epi = max(statistics.variance(means) - ale / R, 0.0)
                out.append({'scenario': s, 'month': k, 'rho': rho, 'epistemic_var': round(epi, 1),
                            'aleatory_var': round(ale, 1), 'share_epi': round(epi / (epi + ale), 4),
                            'sd_total': round((epi + ale) ** 0.5, 2)})
        _, obs, _ = c.simulate_mm(c.true_line(design, truth, k), c.flowline.MIX, c.HOURS, rng_truth, record=True)
        for rho in RHOS:
            for b, o in zip(bel[rho], obs):
                b.update(o, rho)
    return out


if __name__ == '__main__':
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    with Pool(15) as p:
        res = p.map(run, range(1, n + 1), chunksize=1)
    rows = [r for x in res for r in x]
    with open(os.path.join(c.DATA, 'variance_decomposition.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print('month  rho  epistemic share %  predictive sd')
    for k in CHECK:
        for rho in RHOS:
            rr = [r for r in rows if r['month'] == k and r['rho'] == rho]
            print(f"{k:5d} {rho:4.1f} {100 * statistics.mean(r['share_epi'] for r in rr):10.1f} "
                  f"{statistics.mean(r['sd_total'] for r in rr):10.1f}")
