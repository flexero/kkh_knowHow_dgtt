"""Conjugate Bayesian models for the input parameters of an FMS digital twin (thesis chapter 4 and 6).

Standard-library only (runs on an offline factory PC). Each model has:
  * a constructor from *design data* (what a supplier or engineer can state at design time),
  * update(...) with new shop-floor observations (optionally with a forgetting factor rho for ramp-up),
  * posterior mean, credible interval, and sampling for Monte Carlo propagation in the DES.

Models (thesis section 4.6):
  FailureRate   Poisson failures, rate lam [1/h]      prior Gamma(a, b)          -> Gamma(a + n, b + T)
  RepairTime    exponential repair, rate mu [1/h]     prior Gamma(a, b)          -> Gamma(a + k, b + sum r)
  CycleTime     log t ~ Normal(m, s2)                 prior Normal-Inverse-Gamma -> NIG (closed form)
  ScrapRate     Bernoulli scrap, probability q        prior Beta(a, b)           -> Beta(a + x, b + n - x)

Intervals are computed by Monte Carlo sampling with a fixed seed (reproducible) - accurate to about +-0.5 %.
"""
from __future__ import annotations

import math
import random
import statistics

N_MC = 40000


def _interval(samples, level=0.90):
    s = sorted(samples)
    lo = s[int((1 - level) / 2 * len(s))]
    hi = s[int((1 + level) / 2 * len(s)) - 1]
    return lo, hi


class FailureRate:
    """Failures of a machine as a Poisson process with rate lam (failures per operating hour).

    Prior from design data: supplier MTBF estimate `mtbf_h` and a confidence expressed as
    `equiv_hours` = how many operating hours of real data the estimate is "worth".
    Gamma(a, b) with b = equiv_hours and a = 1 + b / mtbf_h  (so that E[1/lam] = b / (a - 1) = mtbf_h).
    """

    def __init__(self, mtbf_h: float, equiv_hours: float):
        self.b = float(equiv_hours)
        self.a = 1.0 + self.b / float(mtbf_h)

    def update(self, n_failures: int, uptime_h: float, rho: float = 1.0):
        """rho < 1 discounts old information (power prior / forgetting) - used during ramp-up."""
        self.a = rho * self.a + n_failures
        self.b = rho * self.b + uptime_h
        return self

    def mean_rate(self):
        return self.a / self.b

    def mtbf_mean(self):
        """Posterior mean of MTBF = E[1/lam] = b / (a - 1). For a <= 1 (possible after strong forgetting with
        few failures) the mean is infinite; the point estimate 1/E[lam] = b / a is used instead."""
        return self.b / (self.a - 1.0) if self.a > 1.0 else self.b / self.a

    def sample_mtbf(self, rng, n=N_MC):
        return [1.0 / rng.gammavariate(self.a, 1.0 / self.b) for _ in range(n)]

    def mtbf_interval(self, level=0.90, seed=1):
        return _interval(self.sample_mtbf(random.Random(seed)), level)


class RepairTime:
    """Repair durations exponential with rate mu (repairs per hour); MTTR = 1/mu.

    Prior from design data: MTTR estimate in hours and `equiv_repairs` = worth in number of observed repairs.
    Gamma(a, b) with a = 1 + equiv_repairs, b = equiv_repairs * mttr_h  (E[1/mu] = b / (a - 1) = mttr_h).
    """

    def __init__(self, mttr_h: float, equiv_repairs: float):
        self.a = 1.0 + float(equiv_repairs)
        self.b = float(equiv_repairs) * float(mttr_h)

    def update(self, repair_hours, rho: float = 1.0):
        self.a = rho * self.a + len(repair_hours)
        self.b = rho * self.b + sum(repair_hours)
        return self

    def mttr_mean(self):
        return self.b / (self.a - 1.0) if self.a > 1.0 else self.b / self.a

    def sample_mttr(self, rng, n=N_MC):
        return [1.0 / rng.gammavariate(self.a, 1.0 / self.b) for _ in range(n)]

    def mttr_interval(self, level=0.90, seed=2):
        return _interval(self.sample_mttr(random.Random(seed)), level)


class CycleTime:
    """Cycle time t > 0 with log t ~ Normal(m, s2), Normal-Inverse-Gamma prior on (m, s2).

    Prior from design data: most likely time `t_mode_s`, a +-`spread` (e.g. 0.10 = +-10 %) that covers
    about 90 % of cycles, and `equiv_cycles` (worth of the estimate in observed cycles).
      m0 = ln(t_mode) + s2_0          (mode of log-normal = exp(m - s2))
      s0 = ln(1 + spread) / 1.645     (90 % half-width on log scale)
      kappa0 = equiv_cycles, a0 = max(2, equiv_cycles / 2), b0 = s0^2 * (a0 - 1)
    Updates (n observations y_i = ln t_i, mean ybar, sum of squares S):
      kappa_n = kappa0 + n ; m_n = (kappa0 m0 + n ybar) / kappa_n
      a_n = a0 + n/2 ; b_n = b0 + S/2 + kappa0 n (ybar - m0)^2 / (2 kappa_n)
    """

    def __init__(self, t_mode_s: float, spread: float, equiv_cycles: float):
        s0 = math.log(1.0 + spread) / 1.645
        self.m = math.log(t_mode_s) + s0 ** 2
        self.k = float(equiv_cycles)
        self.a = max(2.0, equiv_cycles / 2.0)
        self.b = s0 ** 2 * (self.a - 1.0)

    def update(self, times_s, rho: float = 1.0):
        y = [math.log(t) for t in times_s]
        n = len(y)
        if n == 0:
            return self
        k0, m0, a0, b0 = rho * self.k, self.m, rho * self.a, rho * self.b
        ybar = sum(y) / n
        S = sum((v - ybar) ** 2 for v in y)
        self.k = k0 + n
        self.m = (k0 * m0 + n * ybar) / self.k
        self.a = a0 + n / 2.0
        self.b = b0 + S / 2.0 + k0 * n * (ybar - m0) ** 2 / (2.0 * self.k)
        return self

    def sigma2_mean(self):
        return self.b / (self.a - 1.0) if self.a > 1.0 else self.b / self.a

    def mean_time(self):
        """Posterior estimate of the mean cycle time E[t] = exp(m + s2/2) (plug-in)."""
        return math.exp(self.m + self.sigma2_mean() / 2.0)

    def sample_mean_time(self, rng, n=N_MC):
        out = []
        for _ in range(n):
            s2 = 1.0 / rng.gammavariate(self.a, 1.0 / self.b)
            m = rng.gauss(self.m, math.sqrt(s2 / self.k))
            out.append(math.exp(m + s2 / 2.0))
        return out

    def mean_interval(self, level=0.90, seed=3):
        return _interval(self.sample_mean_time(random.Random(seed)), level)

    def sample_cycle(self, rng):
        """One cycle time from the posterior predictive (parameter + process uncertainty)."""
        s2 = 1.0 / rng.gammavariate(self.a, 1.0 / self.b)
        m = rng.gauss(self.m, math.sqrt(s2 / self.k))
        return math.exp(rng.gauss(m, math.sqrt(s2)))


class ScrapRate:
    """Scrap probability q per part. Prior Beta(a, b) from expected scrap q0 and `equiv_parts`."""

    def __init__(self, q0: float, equiv_parts: float):
        self.a = q0 * equiv_parts
        self.b = (1.0 - q0) * equiv_parts

    def update(self, scrap: int, parts: int, rho: float = 1.0):
        self.a = rho * self.a + scrap
        self.b = rho * self.b + parts - scrap
        return self

    def mean(self):
        return self.a / (self.a + self.b)

    def interval(self, level=0.90, seed=4):
        rng = random.Random(seed)
        return _interval([rng.betavariate(self.a, self.b) for _ in range(N_MC)], level)


# ---------------------------------------------------------------------------------------------
# Deterministic capacity model used in section 4.3 (bottleneck analysis before simulation)
# ---------------------------------------------------------------------------------------------

def availability(mtbf_h, mttr_h):
    return mtbf_h / (mtbf_h + mttr_h)


def station_capacity(n_servers, t_mean_s, handling_s, mtbf_h, mttr_h, scrap, hours):
    """Good parts per period: c * A * 3600 * H / (t + h) * (1 - q)."""
    A = availability(mtbf_h, mttr_h)
    return n_servers * A * 3600.0 * hours / (t_mean_s + handling_s) * (1.0 - scrap), A


def chapter4_examples():
    """All worked numbers quoted in chapter 4 (re-run to reproduce)."""
    out = {}
    # Example 4.1 - failures of HMC (design estimate MTBF 30 h, worth 300 h)
    f = FailureRate(mtbf_h=30, equiv_hours=300)
    out['ex41_prior'] = (f.a, f.b, f.mtbf_mean(), f.mtbf_interval())
    f.update(n_failures=14, uptime_h=310)
    out['ex41_post1'] = (f.a, f.b, f.mtbf_mean(), f.mtbf_interval())
    f.update(n_failures=24, uptime_h=640)
    out['ex41_post2'] = (f.a, f.b, f.mtbf_mean(), f.mtbf_interval())
    # Example 4.2 - repair (MTTR 20 min worth 5 repairs), observed repairs in minutes
    r = RepairTime(mttr_h=20 / 60, equiv_repairs=5)
    out['ex42_prior'] = (r.a, r.b, r.mttr_mean() * 60, tuple(x * 60 for x in r.mttr_interval()))
    obs = [m / 60 for m in (12, 35, 28, 41, 19, 55, 23, 30, 26, 38, 17, 44, 31, 22)]
    r.update(obs)
    out['ex42_post'] = (r.a, r.b, r.mttr_mean() * 60, tuple(x * 60 for x in r.mttr_interval()), statistics.mean(obs) * 60)
    # Example 4.3 - HMC cycle time VC20: supplier 345 s +-10 %, worth 10 cycles; 40 measured cycles
    c = CycleTime(t_mode_s=345, spread=0.10, equiv_cycles=10)
    out['ex43_prior'] = (c.m, c.k, c.a, c.b, c.mean_time(), c.mean_interval())
    rng = random.Random(43)
    meas = [math.exp(rng.gauss(math.log(372), 0.05)) for _ in range(40)]   # simulated measurement set
    c.update(meas)
    out['ex43_post'] = (c.m, c.k, c.a, c.b, c.mean_time(), c.mean_interval(), statistics.mean(meas))
    # Example 4.4 - scrap HMC: design 0.8 % worth 250 parts; observed 9 scrap in 400
    q = ScrapRate(q0=0.008, equiv_parts=250)
    out['ex44_prior'] = (q.a, q.b, q.mean(), q.interval())
    q.update(9, 400)
    out['ex44_post'] = (q.a, q.b, q.mean(), q.interval())
    # Example 4.5 - forgetting factor during ramp-up: early month 18 failures / 300 h, later 6 / 300 h
    for rho in (1.0, 0.7):
        g = FailureRate(mtbf_h=30, equiv_hours=300)
        g.update(18, 300, rho)
        g.update(6, 300, rho)
        out[f'ex45_rho{rho}'] = (g.a, g.b, g.mtbf_mean())
    return out


if __name__ == '__main__':
    for k, v in chapter4_examples().items():
        print(k, tuple(round(x, 4) if isinstance(x, float) else (tuple(round(y, 2) for y in x) if isinstance(x, tuple) else x) for x in v))
