"""Paper 4 - staged FMS investment with a learning (Bayesian) digital twin: extended experiment engine.

Re-uses the thesis models without modifying them (thesis/code/staging.py, flowline.py, rampup_experiment.py,
bayes.py). This module adds
  * configurable risk aversion beta, forgetting factor rho, prior confidence w, number of twin samples N_theta,
    economic parameters, demand-uncertainty width and epistemic-uncertainty scale lambda,
  * further policies:
      STATIC_SP  fixed staged plan optimised at design time against the PRIOR distribution (sample average over
                 prior parameter samples and demand scenarios) - the stochastic-programming plan without recourse
      MYOPIC     re-decides every stage with the twin, but values only the current stage (one-stage look-ahead)
      BN_GREEDY  practitioner rule: buy the option that relieves the twin's predicted bottleneck while the forecast
                 demand of the next stage exceeds the predicted capacity (within the stage budget)
      ADAPT_PAR  re-decides with the twin's parameter samples but keeps the design demand forecast
      PI_PLAN    clairvoyant plan: best complete 4-stage plan for the TRUE parameters and the realised demand
                 (wait-and-see reference; chosen with the screening model, realised with the DES)
  * per-stage records (output, demand, decisions) and decision CPU time.
For the thesis policies (NONE, ALL, STATIC, ADAPT_DEM, ADAPTIVE, PI_RULE) with default settings the results are
identical to thesis/data/staging_b0.0.csv (checked by verify_against_thesis.py).
All money values are reference estimates (placeholders), all outcomes are simulated.
"""
from __future__ import annotations

import math
import os
import random
import statistics
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
THESIS_CODE = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'thesis', 'code'))
if THESIS_CODE not in sys.path:
    sys.path.insert(0, THESIS_CODE)

import flowline                                   # noqa: E402
import staging as stg                             # noqa: E402
from rampup_experiment import StationBelief       # noqa: E402

BASE = {k: getattr(stg, k) for k in ('MARGIN', 'PENALTY', 'DISC', 'BUDGET', 'OPEX')}
BASE_OPTIONS = dict(stg.OPTIONS)
BASE_DEMAND = list(stg.DEMAND)

DEFAULT = dict(beta=0.0, rho=0.7, w=1.0, n_theta=60, eco={}, capex_scale=1.0, dem_scale=1.0, dem_width=0.2, lam=1.0)

ALL_POLICIES = ('NONE', 'ALL', 'STATIC', 'STATIC_SP', 'MYOPIC', 'BN_GREEDY', 'ADAPT_DEM', 'ADAPT_PAR', 'ADAPTIVE',
                'PI_RULE', 'PI_PLAN')
RELIEF = {'HMC': 'PAL', 'GRIND': 'GR2', 'ASSY': 'AS2', 'FINAL': 'FRB'}   # bottleneck -> relieving option


def apply_settings(cfg):
    """Set the module-level economics of thesis staging.py (in this process)."""
    for k, v in BASE.items():
        setattr(stg, k, v)
    for k, v in cfg.get('eco', {}).items():
        setattr(stg, k, v)
    stg.OPTIONS.clear()
    stg.OPTIONS.update({k: (v[0] * cfg.get('capex_scale', 1.0), v[1], v[2]) for k, v in BASE_OPTIONS.items()})
    stg.DEMAND[:] = [d * cfg.get('dem_scale', 1.0) for d in BASE_DEMAND]


def make_scenario(seed, cfg):
    """Hidden true factory and demand level, same random stream as thesis staging.scenario()."""
    lam = cfg.get('lam', 1.0)
    trng = random.Random(20_000 + seed)
    truth = []
    for _ in flowline.compressor_line():
        t = {'f_mtbf': trng.uniform(0.6, 1.1), 'f_mttr': trng.uniform(1.0, 1.5),
             'f_speed': trng.uniform(0.98, 1.12), 'sigma': trng.uniform(0.04, 0.10),
             'f_scrap': trng.uniform(1.0, 2.0)}
        if lam != 1.0:                        # scale the deviation from the design value (epistemic uncertainty)
            for k in ('f_mtbf', 'f_mttr', 'f_speed', 'f_scrap'):
                t[k] = 1.0 + lam * (t[k] - 1.0)
        truth.append(t)
    u = trng.uniform(0.8, 1.2)
    dem_factor = 1.0 + (u - 1.0) * cfg.get('dem_width', 0.2) / 0.2
    return truth, dem_factor


def realised_demand(seed, true_dem, s):
    return true_dem[s - 1] * random.Random(seed * 100 + 50 + s).uniform(0.95, 1.05)


# ----------------------------------------------------------------------------------------------- plan enumeration
def enumerate_plans(budget):
    """All feasible 4-stage plans (sequence of option subsets) under the stage budget and precedence."""
    plans = []

    def rec(inst, s, plan):
        if s > stg.STAGES:
            plans.append(tuple(plan))
            return
        for comb in stg.feasible_additions(inst, budget):
            rec(tuple(sorted(set(inst) | set(comb))), s + 1, plan + [comb])
    rec((), 1, [])
    return plans


def plan_value(plan, th, dem_path):
    """Screening-model NPV of a complete plan. th[(config, t)] = monthly good output; dem_path has 5 entries."""
    inst, v = (), 0.0
    for t in range(1, stg.STAGES + 1):
        comb = plan[t - 1]
        inst = tuple(sorted(set(inst) | set(comb)))
        v += stg.stage_value(th[(inst, t)], dem_path[t - 1], t)
        v -= sum(stg.OPTIONS[o][0] for o in comb) / (1 + stg.DISC) ** t
        v -= stg.OPEX * sum(stg.OPTIONS[o][0] for o in inst) / (1 + stg.DISC) ** t
    for t in range(stg.STAGES + 1, stg.STAGES + 1 + stg.TERMINAL):
        v += stg.stage_value(th[(inst, stg.STAGES + 1)], dem_path[-1], t)
        v -= stg.OPEX * sum(stg.OPTIONS[o][0] for o in inst) / (1 + stg.DISC) ** t
    return v


def configs_of(plans):
    out = set()
    for p in plans:
        inst = ()
        for comb in p:
            inst = tuple(sorted(set(inst) | set(comb)))
            out.add(inst)
    return out


def clairvoyant_plan(truth, dem_path, plans):
    configs = configs_of(plans)
    th = {(c, t): stg.screen_th(stg.line_for(c, ('truth', truth), t)) for c in configs for t in range(1, 6)}
    return max(plans, key=lambda p: plan_value(p, th, dem_path))


def sp_plan(cfg, n=60, seed=4242):
    """Fixed plan maximising the sample-average (optionally CVaR-penalised) NPV over the prior (design-time)."""
    rng = random.Random(seed)
    design = flowline.compressor_line(buffer=2)
    beliefs = [StationBelief(st, cfg.get('w', 1.0)) for st in design]
    samples = stg.belief_samples(beliefs, rng, n)
    width = cfg.get('dem_width', 0.2)
    dems = [[d * (1 + width * (2 * rng.random() - 1)) for d in stg.DEMAND] for _ in range(n)]
    plans = enumerate_plans(stg.BUDGET)
    configs = configs_of(plans)
    ths = []
    for smp in samples:
        th1 = {c: stg.screen_th(stg.line_for(c, smp, 1)) for c in configs}   # belief lines carry no ramp-up
        ths.append({(c, t): th1[c] for c in configs for t in range(1, 6)})
    beta = cfg.get('beta', 0.0)
    best, best_v = None, -math.inf
    for p in plans:
        vals = [plan_value(p, th, dp) for th, dp in zip(ths, dems)]
        m = statistics.mean(vals)
        if beta > 0:
            worst = sorted(vals)[:max(1, n // 10)]
            m -= beta * (m - statistics.mean(worst))
        if m > best_v + 1e-6:
            best, best_v = p, m
    return best


# ----------------------------------------------------------------------------------------------- policies
def decide_myopic(installed, s, budget, demand_path, samples, beta):
    """One-stage look-ahead: value of the current stage only, full capex charged."""
    best, best_v = (), -math.inf
    for comb in stg.feasible_additions(installed, budget):
        opts = tuple(sorted(set(installed) | set(comb)))
        opex = stg.OPEX * sum(stg.OPTIONS[o][0] for o in opts) / (1 + stg.DISC) ** s
        vals = [stg.stage_value(stg.screen_th(stg.line_for(opts, smp, s)), demand_path[s - 1], s) - opex
                for smp in samples]
        m = statistics.mean(vals)
        if beta > 0 and len(vals) > 1:
            worst = sorted(vals)[:max(1, len(vals) // 10)]
            m -= beta * (m - statistics.mean(worst))
        m -= sum(stg.OPTIONS[o][0] for o in comb) / (1 + stg.DISC) ** s
        if m > best_v + 1e-6:
            best, best_v = comb, m
    return best


def belief_mean(beliefs):
    design = flowline.compressor_line(buffer=2)
    tr = []
    for st, b in zip(design, beliefs):
        tr.append({'f_mtbf': b.fail.mtbf_mean() / st.mtbf_h, 'f_mttr': b.rep.mttr_mean() / st.mttr_h,
                   'f_speed': b.cyc.mean_time(), 'sigma': math.sqrt(b.cyc.sigma2_mean()),
                   'f_scrap': (b.scrap.mean() / st.scrap) if st.scrap > 0 else 1.0})
    return ('belief', tr)


def decide_bn_greedy(installed, s, budget, demand_path, beliefs, use_twin):
    smp = belief_mean(beliefs) if use_twin else None
    target = demand_path[min(s, len(demand_path) - 1)]          # forecast demand of the NEXT stage
    inst, left, bought = set(installed), budget, []
    while True:
        line = stg.line_for(tuple(sorted(inst)), smp, s)
        good = stg.screen_th(line)
        if good >= target:
            break
        rates = []
        for st in line:
            tm = sum(flowline.MIX[v] * st.tdesign[v] * st.speed for v in flowline.MIX)
            rates.append((st.c * st.mtbf_h / (st.mtbf_h + st.mttr_h) * 3600.0 * stg.HOURS / tm, st.name))
        name = min(rates)[1]
        o = RELIEF.get(name, 'MES')
        if o in inst or stg.OPTIONS[o][0] > left:
            break
        inst.add(o)
        bought.append(o)
        left -= stg.OPTIONS[o][0]
    return tuple(bought)


def run_policy(policy, truth, dem_factor, seed, cfg, fixed_plan=None, pi_plans=None):
    beta, rho, w, nth = cfg['beta'], cfg['rho'], cfg['w'], cfg['n_theta']
    rng = random.Random(seed)
    installed, npv, capital, short_stages = (), 0.0, 0.0, 0
    design_line = flowline.compressor_line(buffer=2)
    beliefs = [StationBelief(st, w) for st in design_line]
    true_dem = [d * dem_factor for d in stg.DEMAND]
    observed, static_plan, rec, cpu = [], None, {}, 0.0
    if policy == 'PI_PLAN':
        dem_path = [realised_demand(seed, true_dem, s) for s in range(1, stg.STAGES + 1)] + [true_dem[-1]]
        static_plan = clairvoyant_plan(truth, dem_path, pi_plans)
    if policy == 'STATIC_SP':
        static_plan = fixed_plan
    for s in range(1, stg.STAGES + 1):
        k = 6 * (s - 1) + 3
        t0 = time.process_time()
        if observed:
            f = statistics.mean(o / d for o, d in zip(observed, stg.DEMAND))
            dem_learn = [d * f for d in stg.DEMAND]
        else:
            dem_learn = list(stg.DEMAND)
        if policy == 'NONE':
            comb = ()
        elif policy == 'ALL':
            comb = tuple(o for o in stg.OPT if o not in installed) if s == 1 else ()
        elif policy == 'STATIC':
            if static_plan is None:
                static_plan, inst = [], ()
                for t in range(1, stg.STAGES + 1):
                    c = stg.decide(inst, t, stg.BUDGET, stg.DEMAND, [None], beta)
                    static_plan.append(c)
                    inst = tuple(sorted(set(inst) | set(c)))
            comb = static_plan[s - 1]
        elif policy in ('STATIC_SP', 'PI_PLAN'):
            comb = static_plan[s - 1]
        elif policy == 'PI_RULE':
            comb = stg.decide(installed, s, stg.BUDGET, true_dem, [('truth', truth)], beta)
        elif policy == 'ADAPT_DEM':
            comb = stg.decide(installed, s, stg.BUDGET, dem_learn, [None], beta)
        elif policy == 'ADAPT_PAR':
            samples = stg.belief_samples(beliefs, rng, nth) if s > 1 else [None]
            comb = stg.decide(installed, s, stg.BUDGET, list(stg.DEMAND), samples, beta)
        elif policy == 'MYOPIC':
            samples = stg.belief_samples(beliefs, rng, nth) if s > 1 else [None]
            comb = decide_myopic(installed, s, stg.BUDGET, dem_learn, samples, beta)
        elif policy == 'BN_GREEDY':
            comb = decide_bn_greedy(installed, s, stg.BUDGET, dem_learn, beliefs, s > 1)
        elif policy == 'ADAPTIVE':
            samples = stg.belief_samples(beliefs, rng, nth) if s > 1 else [None]
            comb = stg.decide(installed, s, stg.BUDGET, dem_learn, samples, beta)
        else:
            raise ValueError(policy)
        cpu += time.process_time() - t0
        installed = tuple(sorted(set(installed) | set(comb)))
        capex = sum(stg.OPTIONS[o][0] for o in comb)
        capital += capex
        npv -= capex / (1 + stg.DISC) ** s
        npv -= stg.OPEX * sum(stg.OPTIONS[o][0] for o in installed) / (1 + stg.DISC) ** s
        line = stg.config_line(installed, truth, k)
        srng = random.Random(seed * 100 + s)
        y, obs, _ = flowline.simulate(line, flowline.MIX, stg.HOURS, srng, record=True)
        y = (y + sum(flowline.simulate(line, flowline.MIX, stg.HOURS, srng)[0] for _ in range(2))) / 3.0
        d = realised_demand(seed, true_dem, s)
        observed.append(d)
        npv += stg.stage_value(y, d, s)
        if y < 0.95 * d:
            short_stages += 1
        rec[f'y{s}'], rec[f'd{s}'], rec[f'a{s}'] = round(y, 1), round(d, 1), '+'.join(comb) or '-'
        mttr_cfg = 1.0 if 'MES' in installed else 1.3
        q_cfg = 0.8 if 'MES' in installed else 1.0
        for b, o in zip(beliefs, obs):
            o = dict(o, repairs_h=[r / mttr_cfg for r in o['repairs_h']], scrap=o['scrap'] / q_cfg)
            b.update(o, rho)
    line = stg.config_line(installed, truth, 6 * stg.STAGES + 3)
    trng2 = random.Random(seed * 100 + 99)
    y = statistics.mean(flowline.simulate(line, flowline.MIX, stg.HOURS, trng2)[0] for _ in range(3))
    for t in range(stg.STAGES + 1, stg.STAGES + 1 + stg.TERMINAL):
        npv += stg.stage_value(y, true_dem[-1], t)
        npv -= stg.OPEX * sum(stg.OPTIONS[o][0] for o in installed) / (1 + stg.DISC) ** t
    rec.update(y_term=round(y, 1), d_term=round(true_dem[-1], 1))
    return dict(npv=npv, capital=capital, short_stages=short_stages, final='+'.join(installed) or '-',
                cpu_s=round(cpu, 3), **rec)


_WORKER = {}


def init_worker(cfg, eta, fixed_plan):
    stg.ETA.update(eta)
    apply_settings(cfg)
    _WORKER['cfg'] = cfg
    _WORKER['fixed_plan'] = fixed_plan
    _WORKER['pi_plans'] = enumerate_plans(stg.BUDGET)


def run_scenario(args):
    seed, policies, tag = args
    cfg = _WORKER['cfg']
    truth, dem_factor = make_scenario(seed, cfg)
    rows = []
    for pol in policies:
        r = run_policy(pol, truth, dem_factor, 1000 * seed + 7, cfg, _WORKER['fixed_plan'], _WORKER['pi_plans'])
        rows.append(dict(setting=tag, scenario=seed, dem_factor=round(dem_factor, 4), policy=pol, **r))
    return rows
