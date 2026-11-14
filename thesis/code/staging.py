"""Stepwise FMS introduction under uncertainty (thesis chapter 7, hypothesis H4).

A company starts with connected standalone CNC machines (level L1) and can add six options over four half-year
stages. True machine parameters and the demand level are hidden (as in chapter 6). Four policies decide which options
to add at each stage:
  ALL       all options at stage 1 (classic "big bang" FMS investment)
  STATIC    staged plan fixed at design time with design point values and the design demand forecast
  ADAPTIVE  same decision rule, but re-optimised at every stage with the Bayesian-updated twin and the observed demand
  ADAPT_DEM adaptive demand forecast only, design machine values (isolates the value of the Bayesian twin)
  PI_RULE   same rule with the true parameters and true demand (perfect information; same heuristic, so not a strict bound)
plus NONE (no investment) as reference.

Decision rule (rolling horizon, thesis section 7.3): at stage s, enumerate every feasible set of new options
(budget, precedence), evaluate the expected NPV of stages s..S plus terminal value with the configuration fixed
afterwards, using a fast screening model of throughput (validated against the DES, section 7.4.2) over N_THETA
parameter samples; choose the best set, implement it, observe one representative month, update, repeat.
The realised result of every policy is simulated with the DES of chapter 6 and the TRUE parameters.

Usage: python staging.py [n_scenarios] [beta_risk] [out.csv]
All money values are [assumption] placeholders for the case company's quotes.
"""
from __future__ import annotations

import csv
import itertools
import math
import os
import random
import statistics
import sys
from multiprocessing import Pool

import flowline
from rampup_experiment import StationBelief

HOURS = 330                     # productive hours per month [assumption, as chapter 4]
STAGES = 4                      # half-years
MONTHS = 6
MARGIN = 450.0                  # contribution margin per compressor, EUR [assumption]
PENALTY = 50.0                  # extra cost per unit of unmet demand (goodwill, expediting), EUR [assumption]
DISC = 0.05                     # discount rate per half-year [assumption]
TERMINAL = 4                    # half-years of terminal value with the final configuration
BUDGET = 400_000.0              # investment budget per stage for staged policies, EUR [assumption]
OPEX = 0.03                     # maintenance per half-year as share of capex [assumption]
DEMAND = [3500, 4500, 5200, 5800, 6000]   # design demand forecast per month, stages 1-4 and terminal [assumption]
N_THETA = 60

# Options: name -> (capex EUR, description, precedence)  [assumption]
OPTIONS = {
    'PAL': (180_000, 'pallet pool + changers on the 3 HMCs (load/unload hidden: 120 s -> 15 s)', None),
    'GR2': (350_000, 'second crankshaft grinder', None),
    'AS2': (120_000, 'second pump assembly station', None),
    'FRB': (220_000, 'robot-assisted final assembly (cycle -25 %)', None),
    'MES': (150_000, 'cell controller + MES (faster fault response: MTTR / 1.3; scrap x 0.8)', None),
    'AGV': (250_000, 'AGV transport between areas (buffers 2 -> 4)', 'MES'),
}
OPT = list(OPTIONS)


def config_line(opts, truth=None, k=None, sigma=0.05):
    """Line for a set of installed options. truth/k: hidden true factors and month (ramp-up) – None = design values."""
    base = flowline.compressor_line(buffer=2, sigma=sigma)
    out = []
    for j, st in enumerate(base):
        c, td = st.c, dict(st.tdesign)
        mttr, q, buf = st.mttr_h * 1.3, st.scrap, 2
        if st.name == 'HMC' and 'PAL' not in opts:
            td = {v: t + 105 for v, t in td.items()}            # 15 s pallet change -> 120 s manual load/unload
        if st.name == 'GRIND' and 'GR2' in opts:
            c = 2
        if st.name == 'ASSY' and 'AS2' in opts:
            c = 2
        if st.name == 'FINAL' and 'FRB' in opts:
            td = {v: 0.75 * t for v, t in td.items()}
        if 'MES' in opts:
            mttr, q = st.mttr_h, st.scrap * 0.8
        if 'AGV' in opts:
            buf = 4
        speed, sig, mtbf = 1.0, sigma, st.mtbf_h
        if truth is not None:
            t = truth[j]
            r = math.exp(-(k - 1) / 2.0)
            speed = t['f_speed'] * (1 + 0.08 * r)
            sig = t['sigma']
            mtbf = mtbf * t['f_mtbf'] * (1 - 0.5 * r)
            mttr = mttr * t['f_mttr'] * (1 + 0.5 * r)
            q = min(0.5, q * t['f_scrap'] * (1 + 2 * math.exp(-(k - 1) / 1.5)))
        out.append(flowline.Station(st.name, c, buf, td, speed, sig, mtbf, mttr, q))
    return out


ETA = {2: None, 4: None}        # blocking efficiency of the screening model, calibrated once (section 7.4.2)


def screen_th(line):
    """Screening model: monthly good output = min raw station rate x prod(1 - q) x eta(buffer)."""
    raw = []
    for st in line:
        tm = sum(flowline.MIX[v] * st.tdesign[v] * st.speed for v in flowline.MIX)
        A = st.mtbf_h / (st.mtbf_h + st.mttr_h)
        raw.append(st.c * A * 3600.0 * HOURS / tm)
    good = min(raw) * math.prod(1 - st.scrap for st in line)
    return good * ETA[line[0].buffer]


def calibrate_eta(reps=6):
    rng = random.Random(99)
    for buf, opts in ((2, ()), (4, ('MES', 'AGV'))):
        line = config_line(opts)
        des = statistics.mean(flowline.simulate(line, flowline.MIX, HOURS, rng)[0] for _ in range(reps))
        ETA[buf] = 1.0
        ETA[buf] = des / screen_th(line)
    return dict(ETA)


def validate_screen(n=40, seed=5):
    """Section 7.4.2: screening model vs DES on random configurations and random true factories."""
    rng = random.Random(seed)
    errs = []
    for _ in range(n):
        opts = tuple(o for o in OPT if rng.random() < 0.5)
        if 'AGV' in opts and 'MES' not in opts:
            opts = opts + ('MES',)
        truth = [{'f_mtbf': rng.uniform(0.6, 1.1), 'f_mttr': rng.uniform(1.0, 1.5), 'f_speed': rng.uniform(0.98, 1.12),
                  'sigma': rng.uniform(0.04, 0.10), 'f_scrap': rng.uniform(1.0, 2.0)} for _ in OPT + list(range(7))]
        line = config_line(opts, truth, rng.randint(1, 27))
        des = statistics.mean(flowline.simulate(line, flowline.MIX, HOURS, rng)[0] for _ in range(2))
        errs.append((screen_th(line) - des) / des)
    return statistics.mean(abs(e) for e in errs), statistics.mean(errs), max(abs(e) for e in errs)


def feasible_additions(installed, budget):
    rest = [o for o in OPT if o not in installed]
    out = []
    for r in range(len(rest) + 1):
        for comb in itertools.combinations(rest, r):
            cost = sum(OPTIONS[o][0] for o in comb)
            if cost > budget:
                continue
            new = set(installed) | set(comb)
            if any(OPTIONS[o][2] and OPTIONS[o][2] not in new for o in new):
                continue
            out.append(comb)
    return out


def stage_value(th, demand, s):
    """Discounted margin of one stage (6 months) minus unmet-demand penalty."""
    sold = min(th, demand)
    return (MARGIN * sold - PENALTY * max(0.0, demand - th)) * MONTHS / (1 + DISC) ** s


def line_for(opts, smp, t):
    """Line used by a decision maker for stage t. smp = None (design values) | ('truth', truth) | ('belief', factors)."""
    if smp is None:
        return config_line(opts)
    kind, tr = smp
    if kind == 'truth':
        return config_line(opts, tr, 6 * (t - 1) + 3)
    line = config_line(opts)                  # belief factors are pure machine factors (config effects removed)
    for st, f in zip(line, tr):
        st.speed, st.sigma = f['f_speed'], f['sigma']
        st.mtbf_h *= f['f_mtbf']
        st.mttr_h *= f['f_mttr']
        st.scrap = min(0.5, st.scrap * f['f_scrap'])
    return line


def decide(installed, s, budget, demand_path, samples, beta):
    """Rolling-horizon rule (Eq. 7.3): best feasible set of new options now, configuration kept afterwards."""
    best, best_v = (), -math.inf
    for comb in feasible_additions(installed, budget):
        opts = tuple(sorted(set(installed) | set(comb)))
        opex = OPEX * sum(OPTIONS[o][0] for o in opts) * sum(1 / (1 + DISC) ** t for t in range(s, STAGES + 1 + TERMINAL))
        vals = []
        for smp in samples:
            v = sum(stage_value(screen_th(line_for(opts, smp, t)), demand_path[t - 1], t) for t in range(s, STAGES + 1))
            th_end = screen_th(line_for(opts, smp, STAGES + 1))
            v += sum(stage_value(th_end, demand_path[-1], t) for t in range(STAGES + 1, STAGES + 1 + TERMINAL))
            vals.append(v - opex)
        m = statistics.mean(vals)
        if beta > 0 and len(vals) > 1:                        # risk aversion: penalise the CVaR gap (Eq. 4.16)
            worst = sorted(vals)[:max(1, len(vals) // 10)]
            m -= beta * (m - statistics.mean(worst))
        m -= sum(OPTIONS[o][0] for o in comb) / (1 + DISC) ** s
        if m > best_v + 1e-6:
            best, best_v = comb, m
    return best


def belief_samples(beliefs, rng, n):
    """Parameter samples from the Bayesian twin -> pure per-station factors relative to the design values."""
    design = flowline.compressor_line(buffer=2)
    out = []
    for _ in range(n):
        tr = []
        for st, b in zip(design, beliefs):
            smp = b.sample(st, rng)
            tr.append({'f_mtbf': smp.mtbf_h / st.mtbf_h, 'f_mttr': smp.mttr_h / st.mttr_h, 'f_speed': smp.speed,
                       'sigma': smp.sigma, 'f_scrap': (smp.scrap / st.scrap) if st.scrap > 0 else 1.0})
        out.append(('belief', tr))
    return out


def run_policy(policy, truth, dem_factor, seed, beta):
    rng = random.Random(seed)
    installed, npv, capital, short_stages = (), 0.0, 0.0, 0
    design_line = flowline.compressor_line(buffer=2)
    beliefs = [StationBelief(st, 1.0) for st in design_line]
    true_dem = [d * dem_factor for d in DEMAND]
    observed = []
    static_plan = None
    for s in range(1, STAGES + 1):
        k = 6 * (s - 1) + 3
        if policy == 'NONE':
            comb = ()
        elif policy == 'ALL':
            comb = tuple(o for o in OPT if o not in installed) if s == 1 else ()
        elif policy == 'STATIC':
            if static_plan is None:            # whole plan fixed at design time with design values and forecast
                static_plan, inst = [], ()
                for t in range(1, STAGES + 1):
                    c = decide(inst, t, BUDGET, DEMAND, [None], beta)
                    static_plan.append(c)
                    inst = tuple(sorted(set(inst) | set(c)))
            comb = static_plan[s - 1]
        elif policy == 'PI_RULE':
            comb = decide(installed, s, BUDGET, true_dem, [('truth', truth)], beta)
        elif policy == 'ADAPT_DEM':            # adaptive demand forecast, but design machine values (no twin learning)
            dem_path = [d * statistics.mean(o / dd for o, dd in zip(observed, DEMAND)) for d in DEMAND] if observed else DEMAND
            comb = decide(installed, s, BUDGET, dem_path, [None], beta)
        else:                                  # ADAPTIVE
            if observed:
                f = statistics.mean(o / d for o, d in zip(observed, DEMAND))
                dem_path = [d * f for d in DEMAND]
            else:
                dem_path = DEMAND
            samples = belief_samples(beliefs, rng, N_THETA) if s > 1 else [None]
            comb = decide(installed, s, BUDGET, dem_path, samples, beta)
        installed = tuple(sorted(set(installed) | set(comb)))
        capex = sum(OPTIONS[o][0] for o in comb)
        capital += capex
        npv -= capex / (1 + DISC) ** s
        npv -= OPEX * sum(OPTIONS[o][0] for o in installed) / (1 + DISC) ** s
        # realised production: one representative month with the TRUE parameters (DES), times 6
        line = config_line(installed, truth, k)
        srng = random.Random(seed * 100 + s)           # common random numbers: same stream per stage for all policies
        y, obs, _ = flowline.simulate(line, flowline.MIX, HOURS, srng, record=True)
        y = (y + sum(flowline.simulate(line, flowline.MIX, HOURS, srng)[0] for _ in range(2))) / 3.0
        d = true_dem[s - 1] * random.Random(seed * 100 + 50 + s).uniform(0.95, 1.05)
        observed.append(d)
        npv += stage_value(y, d, s)
        if y < 0.95 * d:
            short_stages += 1
        # Bayesian update (rho = 0.7). Cycle ratios are already relative to the current configuration's design times;
        # repair times and scrap are divided by the configuration effect so that the twin learns pure machine factors.
        mttr_cfg = 1.0 if 'MES' in installed else 1.3
        q_cfg = 0.8 if 'MES' in installed else 1.0
        for b, o in zip(beliefs, obs):
            o = dict(o, repairs_h=[r / mttr_cfg for r in o['repairs_h']], scrap=o['scrap'] / q_cfg)
            b.update(o, 0.7)
    # terminal value with the final configuration (true mature parameters)
    line = config_line(installed, truth, 6 * STAGES + 3)
    trng2 = random.Random(seed * 100 + 99)
    y = statistics.mean(flowline.simulate(line, flowline.MIX, HOURS, trng2)[0] for _ in range(3))
    for t in range(STAGES + 1, STAGES + 1 + TERMINAL):
        npv += stage_value(y, true_dem[-1], t)
        npv -= OPEX * sum(OPTIONS[o][0] for o in installed) / (1 + DISC) ** t
    return {'npv': npv, 'capital': capital, 'short_stages': short_stages, 'final': '+'.join(installed) or '-'}


def scenario(args):
    seed, beta, eta = args
    ETA.update(eta)
    trng = random.Random(20_000 + seed)
    truth = []
    for _ in flowline.compressor_line():
        truth.append({'f_mtbf': trng.uniform(0.6, 1.1), 'f_mttr': trng.uniform(1.0, 1.5),
                      'f_speed': trng.uniform(0.98, 1.12), 'sigma': trng.uniform(0.04, 0.10),
                      'f_scrap': trng.uniform(1.0, 2.0)})
    dem_factor = trng.uniform(0.8, 1.2)
    rows = []
    for pol in ('NONE', 'ALL', 'STATIC', 'ADAPT_DEM', 'ADAPTIVE', 'PI_RULE'):
        r = run_policy(pol, truth, dem_factor, 1000 * seed + 7, beta)   # same random stream for all policies
        rows.append(dict(scenario=seed, beta=beta, dem_factor=round(dem_factor, 3), policy=pol, **r))
    return rows


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    beta = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    out = sys.argv[3] if len(sys.argv) > 3 else f'../data/staging_b{beta}.csv'
    eta = calibrate_eta()
    print('screening efficiency eta (buffer 2 / 4):', {k: round(v, 4) for k, v in eta.items()})
    mape, bias, mx = validate_screen()
    print(f'screening model vs DES on 40 random cases: MAPE {100*mape:.2f} %, bias {100*bias:+.2f} %, max {100*mx:.2f} %')
    with Pool(15) as p:
        res = p.map(scenario, [(s, beta, eta) for s in range(1, n + 1)])
    rows = [r for x in res for r in x]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print('written', out, len(rows))


if __name__ == '__main__':
    main()
