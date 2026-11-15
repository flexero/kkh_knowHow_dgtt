"""Shared helpers for the paper-2 experiments (uncertainty-aware twin with sequential conjugate updating).

The thesis modules in thesis/code are IMPORTED, never modified. Byte-code writing is disabled so that importing
does not touch thesis/code/__pycache__.

Design of random streams (new compared with the thesis scripts): every source of randomness has its own seeded
stream, so that adding or removing a predictor never changes the hidden truth or the other predictors.
  truth of scenario s ............ Random('truth-<variant>-<s>')       (all months, sequential)
  Bayesian predictors, month k ... Random('bayes-<s>-<k>')             (same stream for every rho / prior weight:
                                                                         common random numbers -> paired comparison)
  point predictors, month k ...... Random('point-<name>-<s>-<k>')
String seeds are hashed with SHA-512 by the random module and are therefore reproducible across runs and machines.
"""
from __future__ import annotations

import math
import os
import random
import statistics
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
THESIS_CODE = os.path.join(ROOT, 'thesis', 'code')
DATA = os.path.abspath(os.path.join(HERE, '..', 'data'))
FIG = os.path.abspath(os.path.join(HERE, '..', 'figures'))
if THESIS_CODE not in sys.path:
    sys.path.append(THESIS_CODE)          # appended: modules of this folder take precedence (e.g. make_figures)

import bayes                      # noqa: E402  (thesis module)
import flowline                   # noqa: E402  (thesis module)
import rampup_experiment as rx    # noqa: E402  (thesis module: make_truth, StationBelief, point_from_month1, ...)

MONTHS, HOURS, N_THETA, R_POINT = rx.MONTHS, rx.HOURS, rx.N_THETA, rx.R_POINT
QLEVELS = (0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95)


# ------------------------------------------------------------------ simulator with pluggable distributions
def simulate_mm(stations, mix, hours, rng, record=False, ttf_shape=1.0, rep_logsd=None, max_cycles_recorded=300):
    """Copy of thesis flowline.simulate with two optional model-form changes for the TRUTH only:
       ttf_shape  Weibull shape of the time to failure (1.0 = exponential, as in the twin)
       rep_logsd  log-normal repair times with this log-sd (None = exponential, as in the twin)
    Means are preserved (MTBF and MTTR keep their meaning). With the defaults the random-number sequence and the
    result are identical to flowline.simulate (checked in verify_simulator())."""
    if ttf_shape == 1.0:
        def ttf(mean_s):
            return rng.expovariate(1.0 / mean_s)
    else:
        g = math.gamma(1.0 + 1.0 / ttf_shape)

        def ttf(mean_s):
            return rng.weibullvariate(mean_s / g, ttf_shape)
    if rep_logsd is None:
        def rep(mean_s):
            return rng.expovariate(1.0 / mean_s)
    else:
        def rep(mean_s):
            return rng.lognormvariate(math.log(mean_s) - rep_logsd ** 2 / 2.0, rep_logsd)
    M = len(stations)
    H = hours * 3600.0
    variants = list(mix)
    cum, acc = [], 0.0
    for v in variants:
        acc += mix[v]
        cum.append(acc)
    mu_log = [{v: math.log(st.tdesign[v] * st.speed) - st.sigma ** 2 / 2.0 for v in variants} for st in stations]
    free = [[0.0] * st.c for st in stations]
    ttfs = [[ttf(st.mtbf_h * 3600.0) for _ in range(st.c)] for st in stations]
    K = [0] * M
    for j in range(M - 1):
        K[j] = stations[j + 1].buffer + stations[j + 1].c
    starts = [[] for _ in range(M)]
    obs = None
    if record:
        obs = [{'fail': 0, 'busy_h': 0.0, 'repairs_h': [], 'ratios': [], 'parts': 0, 'scrap': 0} for _ in range(M)]
    good = 0
    i = 0
    while True:
        u = rng.random()
        v = variants[-1]
        for idx, cv in enumerate(cum):
            if u <= cv:
                v = variants[idx]
                break
        prev_dep = 0.0
        bad = False
        for j in range(M):
            st = stations[j]
            k = i % st.c
            s = prev_dep if prev_dep > free[j][k] else free[j][k]
            if j == 0 and s > H:
                return good, obs, i
            starts[j].append(s)
            p = rng.lognormvariate(mu_log[j][v], st.sigma)
            work = p
            proc_left = p
            rem = ttfs[j][k]
            while rem < proc_left:
                proc_left -= rem
                r = rep(st.mttr_h * 3600.0)
                work += r
                if record:
                    obs[j]['fail'] += 1
                    obs[j]['repairs_h'].append(r / 3600.0)
                rem = ttf(st.mtbf_h * 3600.0)
            ttfs[j][k] = rem - proc_left
            done = s + work
            if j < M - 1:
                idx = i - K[j]
                if idx >= 0:
                    nxt = starts[j + 1][idx]
                    dep = done if done > nxt else nxt
                else:
                    dep = done
            else:
                dep = done
            free[j][k] = dep
            prev_dep = dep
            if rng.random() < st.scrap:
                bad = True
                if record:
                    obs[j]['scrap'] += 1
            if record:
                o = obs[j]
                o['busy_h'] += p / 3600.0
                o['parts'] += 1
                if len(o['ratios']) < max_cycles_recorded:
                    o['ratios'].append(p / st.tdesign[v])
        if prev_dep <= H and not bad:
            good += 1
        i += 1


def verify_simulator(n=3):
    """simulate_mm with default arguments must reproduce flowline.simulate exactly."""
    line = flowline.compressor_line()
    for s in range(n):
        a = flowline.simulate(line, flowline.MIX, 50, random.Random(s), record=True)
        b = simulate_mm(line, flowline.MIX, 50, random.Random(s), record=True)
        assert a[0] == b[0] and a[2] == b[2] and a[1][1]['fail'] == b[1][1]['fail'], (a[0], b[0])
    return True


# ------------------------------------------------------------------ truth generator (thesis Table 6.1, parameterised)
def ramp(k, tau):
    if tau <= 0:
        return 0.0
    return math.exp(-(k - 1) / tau)


def true_line(design, truth, k, tau=2.0, tau_q=1.5):
    """Thesis true_line with the ramp-up time constants as parameters (tau = 2, tau_q = 1.5 reproduce the thesis)."""
    r, rq = ramp(k, tau), ramp(k, tau_q)
    out = []
    for st, t in zip(design, truth):
        out.append(flowline.Station(
            st.name, st.c, st.buffer, st.tdesign,
            t['f_speed'] * (1 + 0.08 * r), t['sigma'],
            st.mtbf_h * t['f_mtbf'] * (1 - 0.5 * r),
            st.mttr_h * t['f_mttr'] * (1 + 0.5 * r),
            min(0.5, st.scrap * t['f_scrap'] * (1 + 2 * rq))))
    return out


# ------------------------------------------------------------------ predictors
def summary(vals, y=None):
    """Mean, quantiles and (if truth y given) the empirical CRPS of a predictive sample."""
    v = sorted(vals)
    n = len(v)
    out = {'mean': statistics.mean(v)}
    for q in QLEVELS:
        # same convention as thesis summarise(): lower index floor, upper index ceil-1
        idx = int(q * n) if q < 0.5 else min(n - 1, int(math.ceil(q * n)) - 1)
        out[f'q{int(round(q * 100)):02d}'] = v[idx]
    return out


def crps_sample(vals, y):
    """Empirical CRPS = E|X - y| - 0.5 E|X - X'| (O(n log n) form for the second term)."""
    v = sorted(vals)
    n = len(v)
    t1 = sum(abs(x - y) for x in v) / n
    t2 = sum((2 * (i + 1) - n - 1) * x for i, x in enumerate(v)) / (n * n)   # = 0.5 E|X-X'|
    return t1 - t2


def predict_point(line, rng, reps=R_POINT):
    return [flowline.simulate(line, flowline.MIX, HOURS, rng)[0] for _ in range(reps)]


def predict_bayes(design, beliefs, rng, n_theta=N_THETA, reps=1):
    vals = []
    for _ in range(n_theta):
        line = [b.sample(st, rng) for b, st in zip(beliefs, design)]
        for _ in range(reps):
            vals.append(flowline.simulate(line, flowline.MIX, HOURS, rng)[0])
    return vals


def mle_line(design, obs, fallback=None):
    """Point estimates from ONE month of data (thesis B1 logic); fallback line for stations without events."""
    fb = fallback or design
    line = []
    for st, f, o in zip(design, fb, obs):
        mtbf = o['busy_h'] / o['fail'] if o['fail'] > 0 else f.mtbf_h
        mttr = statistics.mean(o['repairs_h']) if o['repairs_h'] else f.mttr_h
        logs = [math.log(r) for r in o['ratios']]
        speed = math.exp(statistics.mean(logs) + statistics.pvariance(logs) / 2)
        sig = statistics.pstdev(logs) or rx.SIGMA_PRIOR
        q = o['scrap'] / o['parts'] if o['parts'] else f.scrap
        line.append(flowline.Station(st.name, st.c, st.buffer, st.tdesign, speed, sig, mtbf, mttr, q))
    return line


# ------------------------------------------------------------------ static capacities (thesis Eq. 4.2)
def capacities(line):
    out = []
    for st in line:
        tmean = sum(flowline.MIX[v] * st.tdesign[v] * st.speed for v in flowline.MIX)
        c, _ = bayes.station_capacity(st.c, tmean, 0, st.mtbf_h, st.mttr_h, st.scrap, HOURS)
        out.append(c)
    return out


def posterior_line(design, beliefs):
    return [flowline.Station(st.name, st.c, st.buffer, st.tdesign, b.cyc.mean_time(), 0.05,
                             b.fail.mtbf_mean(), b.rep.mttr_mean(), b.scrap.mean()) for st, b in zip(design, beliefs)]


def bn_metrics(cap_pred, cap_true):
    bt = min(range(len(cap_true)), key=lambda j: cap_true[j])
    bp = min(range(len(cap_pred)), key=lambda j: cap_pred[j])
    mape = statistics.mean(abs(a - b) / b for a, b in zip(cap_pred, cap_true))
    return int(bp == bt), mape, bt, bp
