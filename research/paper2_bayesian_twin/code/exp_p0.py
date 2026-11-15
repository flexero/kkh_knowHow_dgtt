"""Re-computation of the frozen design-stage prediction P0 of the fully configured compressor FMS (SIMULATED,
reference design data). Same algorithm and seed as thesis/code/case_study.py::case1_frozen_prediction, but the
record is written to this paper's data folder (the thesis record thesis/data/case1_P0.json is not touched).
Also reports the 50 % and 80 % central intervals and the share of prior-predictive samples below B0.
"""
import json
import os
import random
import statistics

import p2common as c
import staging as stg      # thesis module (configuration of the fully implemented FMS)


def main(n=400, seed=2026):
    rng = random.Random(seed)
    design = stg.config_line(tuple(stg.OPT))
    beliefs = [c.rx.StationBelief(st, 1.0) for st in c.flowline.compressor_line(buffer=4)]
    vals, det = [], []
    for _ in range(n):
        line = [b.sample(st, rng) for st, b in zip(design, beliefs)]
        vals.append(c.flowline.simulate(line, c.flowline.MIX, stg.HOURS, rng)[0])
    for _ in range(20):
        det.append(c.flowline.simulate(design, c.flowline.MIX, stg.HOURS, rng)[0])
    v = sorted(vals)
    b0 = statistics.mean(det)
    rec = {'B0_mean': round(b0), 'P0_mean': round(statistics.mean(vals)), 'P0_p05': v[int(0.05 * n)],
           'P0_p25': v[int(0.25 * n)], 'P0_p50': v[int(0.5 * n)], 'P0_p75': v[int(0.75 * n) - 1],
           'P0_p95': v[int(0.95 * n) - 1], 'P0_sd': round(statistics.stdev(vals), 1),
           'share_below_B0': round(sum(x < b0 for x in vals) / n, 3),
           'P0_vs_B0_pct': round(100 * (statistics.mean(vals) / b0 - 1), 2), 'n': n, 'seed': seed,
           'hours': stg.HOURS}
    json.dump(rec, open(os.path.join(c.DATA, 'p0_full_design.json'), 'w'), indent=1)
    print(rec)


if __name__ == '__main__':
    main()
