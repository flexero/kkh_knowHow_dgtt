"""Virtual ramp-up experiment (thesis chapter 6): does sequential Bayesian updating predict better?

For each scenario s a hidden "true factory" is generated: its mature parameters deviate from the design estimates
and it shows ramp-up behaviour (early failures, slower cycles, more scrap, longer repairs that improve over time).
Month by month (k = 1..12) the true factory is simulated; its machine-level observations are given to the
predictors, which forecast the good output of the next month BEFORE that month is simulated.

Predictors (thesis section 4.8):
  B0   design model, point values, stochastic DES (aleatory spread only), never updated
  B1   one-time calibration with month-1 data (point estimates), then frozen
  P0   Bayesian prior predictive (design priors), never updated (frozen design prediction with uncertainty)
  P1   sequential Bayesian updating, rho = 1.0
  P07  sequential Bayesian updating with forgetting, rho = 0.7
Outputs: CSV with one row per scenario, month and predictor (prediction, 90 % interval, truth).

Usage: python rampup_experiment.py [n_scenarios] [prior_weight] [out.csv]
"""
from __future__ import annotations

import csv
import math
import random
import statistics
import sys
from multiprocessing import Pool

import bayes
import flowline

MONTHS = 12
HOURS = 330
N_THETA = 40          # outer (epistemic) samples per Bayesian prediction
R_POINT = 20          # replications for point-value predictors
SIGMA_PRIOR = 0.05    # design assumption for cycle-time log-sd


def ramp(k, tau=2.0):
    return math.exp(-(k - 1) / tau)


def make_truth(seed):
    """Hidden true factory: mature deviation factors per station [assumption, see section 6.4.1]."""
    rng = random.Random(10_000 + seed)
    design = flowline.compressor_line(sigma=SIGMA_PRIOR)
    truth = []
    for st in design:
        truth.append({
            'f_mtbf': rng.uniform(0.6, 1.1),     # mature MTBF / design MTBF
            'f_mttr': rng.uniform(1.0, 1.5),
            'f_speed': rng.uniform(0.98, 1.12),  # mature cycle time / design cycle time
            'sigma': rng.uniform(0.04, 0.10),
            'f_scrap': rng.uniform(1.0, 2.0),
        })
    return design, truth


def true_line(design, truth, k):
    out = []
    for st, t in zip(design, truth):
        out.append(flowline.Station(
            st.name, st.c, st.buffer, st.tdesign,
            t['f_speed'] * (1 + 0.08 * ramp(k)), t['sigma'],
            st.mtbf_h * t['f_mtbf'] * (1 - 0.5 * ramp(k)),
            st.mttr_h * t['f_mttr'] * (1 + 0.5 * ramp(k)),
            min(0.5, st.scrap * t['f_scrap'] * (1 + 2 * ramp(k, 1.5)))))
    return out


class StationBelief:
    """Bayesian state of one station (thesis Table 4.4)."""

    def __init__(self, st, w):
        self.fail = bayes.FailureRate(st.mtbf_h, equiv_hours=10 * st.mtbf_h * w)
        self.rep = bayes.RepairTime(st.mttr_h, equiv_repairs=5 * w)
        self.cyc = bayes.CycleTime(1.0, spread=0.10, equiv_cycles=10 * w)   # on ratio t / t_design
        self.scrap = bayes.ScrapRate(max(st.scrap, 1e-4), equiv_parts=250 * w)

    def update(self, o, rho):
        self.fail.update(o['fail'], o['busy_h'], rho)
        self.rep.update(o['repairs_h'], rho)
        self.cyc.update(o['ratios'], rho)
        self.scrap.update(o['scrap'], o['parts'], rho)

    def sample(self, st, rng):
        mtbf = 1.0 / rng.gammavariate(self.fail.a, 1.0 / self.fail.b)
        mttr = 1.0 / rng.gammavariate(self.rep.a, 1.0 / self.rep.b)
        s2 = 1.0 / rng.gammavariate(self.cyc.a, 1.0 / self.cyc.b)
        m = rng.gauss(self.cyc.m, math.sqrt(s2 / self.cyc.k))
        speed = math.exp(m + s2 / 2.0)
        q = rng.betavariate(self.scrap.a, self.scrap.b)
        return flowline.Station(st.name, st.c, st.buffer, st.tdesign, speed, math.sqrt(s2), mtbf, mttr, q)


def summarise(values):
    v = sorted(values)
    n = len(v)
    return statistics.mean(v), v[int(0.05 * n)], v[min(n - 1, int(math.ceil(0.95 * n)) - 1)]


def predict_point(line, rng):
    return summarise([flowline.simulate(line, flowline.MIX, HOURS, rng)[0] for _ in range(R_POINT)])


def predict_bayes(design, beliefs, rng):
    vals = []
    for _ in range(N_THETA):
        line = [b.sample(st, rng) for b, st in zip(beliefs, design)]
        vals.append(flowline.simulate(line, flowline.MIX, HOURS, rng)[0])
    return summarise(vals)


def point_from_month1(design, obs):
    line = []
    for st, o in zip(design, obs):
        mtbf = o['busy_h'] / o['fail'] if o['fail'] > 0 else st.mtbf_h
        mttr = statistics.mean(o['repairs_h']) if o['repairs_h'] else st.mttr_h
        logs = [math.log(r) for r in o['ratios']]
        speed = math.exp(statistics.mean(logs) + statistics.pvariance(logs) / 2)
        sig = statistics.pstdev(logs) or SIGMA_PRIOR
        q = o['scrap'] / o['parts'] if o['parts'] else st.scrap
        line.append(flowline.Station(st.name, st.c, st.buffer, st.tdesign, speed, sig, mtbf, mttr, q))
    return line


def run_scenario(args):
    seed, w = args
    rng = random.Random(seed)
    design, truth = make_truth(seed)
    rows = []
    b0 = predict_point(design, rng)
    beliefs0 = [StationBelief(st, w) for st in design]
    p0 = predict_bayes(design, beliefs0, rng)
    beliefs = {1.0: [StationBelief(st, w) for st in design], 0.7: [StationBelief(st, w) for st in design]}
    preds = {'B0': b0, 'B1': b0, 'P0': p0, 'P1': p0, 'P07': p0}   # month 1: no data yet
    b1_line = None
    for k in range(1, MONTHS + 1):
        y, obs, _ = flowline.simulate(true_line(design, truth, k), flowline.MIX, HOURS, rng, record=True)
        for name, (m, lo, hi) in preds.items():
            rows.append({'scenario': seed, 'w': w, 'month': k, 'method': name, 'pred': round(m, 1),
                         'lo': lo, 'hi': hi, 'truth': y})
        # learn from month k, predict month k+1
        if k == MONTHS:
            break
        if k == 1:
            b1_line = point_from_month1(design, obs)
            preds['B1'] = predict_point(b1_line, rng)
        for rho, bl in beliefs.items():
            for b, o in zip(bl, obs):
                b.update(o, rho)
        preds['P1'] = predict_bayes(design, beliefs[1.0], rng)
        preds['P07'] = predict_bayes(design, beliefs[0.7], rng)
    return rows


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    w = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
    out = sys.argv[3] if len(sys.argv) > 3 else f'../data/rampup_w{w}.csv'
    with Pool(15) as pool:
        results = pool.map(run_scenario, [(s, w) for s in range(1, n + 1)])
    rows = [r for res in results for r in res]
    import os
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', newline='', encoding='utf-8') as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(rows)
    print('written', out, len(rows), 'rows')


if __name__ == '__main__':
    main()
