"""Fast reduced-order DES of the FMS as a flow line (thesis chapter 6 experiments).

Exact departure-time recursion for a serial line with
  * station types j = 0..M-1, each with c_j parallel servers (cyclic assignment, order preserving),
  * finite buffers B_j in front of station j, blocking after service (BAS),
  * log-normal cycle times per product variant, scaled by a station speed factor,
  * operation-dependent failures (time to failure counted in processing time) and repair times,
  * scrap detected at end-of-line test (scrapped parts consume capacity, are not good output).
Infinite raw-material supply at the first station. Standard library only.

Recursion (part i, station j, server k = i mod c_j):
  start[j][i] = max(dep[j-1][i], free[j][k])
  done        = start + processing (+ repairs if failures occur during processing)
  dep[j][i]   = max(done, start[j+1][i - (B_{j+1} + c_{j+1})])   # wait for space downstream (BAS)
  free[j][k]  = dep[j][i]
The recursion is computed part by part; start[j+1][i-K] always refers to an earlier part.
"""
from __future__ import annotations

import math
import random


class Station:
    __slots__ = ('name', 'c', 'buffer', 'tdesign', 'speed', 'sigma', 'mtbf_h', 'mttr_h', 'scrap')

    def __init__(self, name, c, buffer, tdesign, speed, sigma, mtbf_h, mttr_h, scrap):
        self.name, self.c, self.buffer = name, c, buffer
        self.tdesign = tdesign          # dict variant -> design cycle time [s] (incl. handling)
        self.speed = speed              # true/assumed factor on design time (1.0 = as designed)
        self.sigma = sigma              # log-sd of cycle times
        self.mtbf_h, self.mttr_h, self.scrap = mtbf_h, mttr_h, scrap


def simulate(stations, mix, hours, rng, record=False, max_cycles_recorded=300):
    """Simulate `hours` of production. Returns good output and (optionally) per-station observations."""
    M = len(stations)
    H = hours * 3600.0
    variants = list(mix)
    cum, acc = [], 0.0
    for v in variants:
        acc += mix[v]
        cum.append(acc)
    # per-station constants
    mu_log = []
    for st in stations:
        mu_log.append({v: math.log(st.tdesign[v] * st.speed) - st.sigma ** 2 / 2.0 for v in variants})
    free = [[0.0] * st.c for st in stations]
    ttf = [[rng.expovariate(1.0 / (st.mtbf_h * 3600.0)) for _ in range(st.c)] for st in stations]
    K = [0] * M
    for j in range(M - 1):
        K[j] = stations[j + 1].buffer + stations[j + 1].c
    starts = [[] for _ in range(M)]          # start times per station (index = part)
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
        # first station start must be within horizon
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
            rem = ttf[j][k]                      # processing time left until the next failure
            while rem < proc_left:
                proc_left -= rem
                rep = rng.expovariate(1.0 / (st.mttr_h * 3600.0))
                work += rep
                if record:
                    obs[j]['fail'] += 1
                    obs[j]['repairs_h'].append(rep / 3600.0)
                rem = rng.expovariate(1.0 / (st.mtbf_h * 3600.0))
            ttf[j][k] = rem - proc_left
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


def compressor_line(buffer=4, sigma=0.05):
    """Reduced-order compressor FMS from config/factory.json design estimates (thesis Table 4.2)."""
    data = [  # name, c, VC10, VC20, VC30, handling, MTBF h, MTTR min, scrap
        ('LOAD', 1, 80, 90, 100, 0, 200, 5, 0.0),
        ('HMC', 3, 270, 345, 450, 15, 30, 20, 0.008),
        ('WASH', 1, 130, 150, 170, 0, 80, 10, 0.0),
        ('VMC', 1, 85, 100, 125, 0, 35, 15, 0.010),
        ('HONE', 1, 75, 90, 110, 0, 45, 12, 0.008),
        ('LATHE', 1, 140, 170, 210, 0, 30, 15, 0.010),
        ('GRIND', 1, 160, 190, 230, 0, 40, 18, 0.012),
        ('ASSY', 1, 170, 200, 240, 0, 120, 8, 0.003),
        ('ROBOT', 1, 95, 110, 130, 0, 70, 10, 0.002),
        ('TEST', 2, 300, 360, 420, 0, 90, 10, 0.0),
        ('PAINT', 1, 130, 160, 200, 0, 60, 15, 0.006),
        ('FINAL', 1, 180, 210, 250, 0, 120, 8, 0.002),
        ('PACK', 1, 100, 120, 140, 0, 80, 6, 0.0),
    ]
    out = []
    for n, c, a, b, d, h, mtbf, mttr, q in data:
        out.append(Station(n, c, buffer, {'VC10': a + h, 'VC20': b + h, 'VC30': d + h}, 1.0, sigma, mtbf, mttr / 60.0, q))
    return out


MIX = {'VC10': 0.3, 'VC20': 0.5, 'VC30': 0.2}

if __name__ == '__main__':
    import time
    rng = random.Random(1)
    t0 = time.time()
    res = [simulate(compressor_line(), MIX, 330, rng)[0] for _ in range(10)]
    print('good output per month (10 reps):', res, 'mean', sum(res) / len(res))
    print('seconds per run:', (time.time() - t0) / 10)
