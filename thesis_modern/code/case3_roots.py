"""Case 3 of thesis chapter 9: Roots blower extension of the compressor FMS (reference design case).

The company will extend the compressor FMS of case 1 to a family of tri-lobe Roots blowers. There are NO real Roots
blower data: products, demand, routings, cycle times, reliability and money values below are [reference estimate]
(engineering estimates of the design phase), exactly like case 2.

  3a static capacity (Eq. 4.2) of the Roots extension alone and load of the SHARED stations (HMC cell, wash, paint,
     packing) with both product families; factory bottleneck before / after the extension
  3b process-level analysis of the shared pallet cell: closed queueing network, mean value analysis (MVA)
       - single-chain models A (product form, exact multi-server) and B (blocking-aware) as in Section 9.2.5
       - three-chain model (fixture types A, B, C) to size the fixture-C pallets and what-if cases
  3c frozen design prediction P0 of the Roots line (prior predictive with design priors, Table 4.4 worths)
  3d transfer test of the Bayesian twin on a virtual Roots ramp-up (20 hidden true factories, as Section 9.3.3)
  3e first investment step of the extension: simplified rolling-horizon screening with the staging logic of Chapter 7
  3f data path: Modbus TCP sizing (edition 1) and OPC UA + MQTT load (edition 2, formulas of edition 2 Section 9.2.4)

Usage:  python case3_roots.py          (about 1-2 min; seeded and reproducible)
Writes: ../data/case3_roots.json, ../data/case3_rampup.csv, ../figures/fig9_*_roots*.svg
Standard library only.
"""
from __future__ import annotations

import csv
import datetime
import itertools
import json
import math
import os
import random
import statistics
from multiprocessing import Pool

import flowline
import staging as stg
import case_study as cs
import make_figures as mf
from rampup_experiment import StationBelief

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
FIG = os.path.join(HERE, '..', 'figures')
H = 330.0                                   # productive hours per month (as chapter 4)

# ============================================================ product family [reference estimate]
MIX_R = {'RB50': 0.35, 'RB100': 0.45, 'RB150': 0.20}
PRODUCTS_R = [  # id, nominal suction flow m3/h, max pressure difference mbar, motor kW, rotor length mm, housing kg, price EUR
    ('RB50', 50, 500, 1.5, 75, 18, 1100), ('RB100', 100, 500, 2.2, 150, 26, 1500), ('RB150', 150, 500, 4.0, 225, 36, 2000)]
DEMAND_R = 400.0                            # mature Roots demand per month
DEMAND_R_PATH = [150, 250, 330, 400, 400]   # half-year stages 1-4 + terminal
DEMAND_C = 6000.0                           # mature compressor programme (terminal design demand, Section 7.2.3)
MARGIN_R = 550.0                            # contribution margin per Roots blower, EUR
MARGIN_C = stg.MARGIN                       # 450 EUR per compressor (Section 7.2.3)

# Roots routing per blower, reduced order (one row per station type)
#   name, shared?, c, cycle s RB50/RB100/RB150, MTBF h, MTTR min, scrap, operation
ROOTS_ST = [
    ('LOADC', True, 1, (336, 367.5, 420), 200, 5, 0.0,
     'cell load station: unload + load one kit pallet (housing + 2 end covers), operator with hoist; 320/350/400 s x 1.05'),
    ('HMCC', True, 3, (1515, 1915, 2365), 30, 20, 0.010,
     'cell HMCs: housing (bores, end faces, flanges, feet, threads) + 2 end covers on one tombstone, incl. 15 s pallet change'),
    ('WASH', True, 1, (170, 200, 240), 80, 10, 0.0, 'washing of housing and covers (case-1 washer)'),
    ('RTURN', False, 1, (530, 660, 830), 30, 15, 0.008, 'CNC lathe: shaft journals and lobe tip diameter, 2 rotors'),
    ('RMILL', False, 1, (1250, 1560, 1950), 25, 25, 0.015, 'rotor profile milling (5-axis / indexing), 2 rotors'),
    ('RGRIND', False, 1, (480, 600, 750), 40, 18, 0.010, 'cylindrical grinding of bearing and gear seats, 2 rotors'),
    ('BAL', False, 1, (360, 420, 500), 100, 10, 0.002, 'dynamic balancing of 2 rotors incl. correction'),
    ('RASSY', False, 2, (2300, 2700, 3200), 120, 10, 0.005,
     'assembly with clearance setting: bearings, end clearance (shims), timing gears and rotor-to-rotor timing'),
    ('RTEST', False, 1, (1980, 2160, 2400), 90, 15, 0.010,
     'run test: run-in to stable temperature, flow / power points, noise, vibration, incl. mounting'),
    ('PAINT', True, 1, (180, 210, 250), 60, 15, 0.006, 'painting (case-1 paint line)'),
    ('PACK', True, 1, (150, 180, 220), 80, 6, 0.0, 'packing (case-1 packing station)'),
]
VAR = list(MIX_R)


def tmean(times, mix=MIX_R):
    return sum(mix[v] * t for v, t in zip(VAR, times))


# ============================================================ 3a static capacity and shared-station load
def comp_static(opts=tuple(stg.OPT)):
    """Compressor station types of the fully implemented FMS (configuration of P0) with mean time and availability."""
    out = {}
    for st in stg.config_line(opts):
        t = sum(flowline.MIX[v] * st.tdesign[v] for v in flowline.MIX)
        A = st.mtbf_h / (st.mtbf_h + st.mttr_h)
        out[st.name] = {'c': st.c, 't': t, 'A': A, 'q': st.scrap}
    out['LOAD147'] = dict(out['LOAD'], t=147.0)        # unload + load per pallet cycle, Section 9.2.5
    return out


def roots_static():
    rows = []
    for name, shared, c, times, mtbf, mttr, q, op in ROOTS_ST:
        A = mtbf / (mtbf + mttr / 60.0)
        t = tmean(times)
        cap = c * A * 3600 * H / t * (1 - q)
        need = DEMAND_R * t / 3600 / (H * 0.75)          # design rule of case 2: ceil(load / (avail x OEE 0.75))
        rows.append({'type': name, 'shared': shared, 'c': c, 't_mean': round(t, 1), 'A': round(A, 4), 'cap_alone': round(cap),
                     'need_oee075': round(need, 2), 'mtbf_h': mtbf, 'mttr_min': mttr, 'scrap_pct': round(100 * q, 2),
                     'times': times, 'op': op})
    return rows


SHARED_MAP = {'LOADC': 'LOAD147', 'HMCC': 'HMC', 'WASH': 'WASH', 'PAINT': 'PAINT', 'PACK': 'PACK'}


def shared_load(qc=DEMAND_C, qr=DEMAND_R):
    """Utilisation of the shared station types by compressors and Roots blowers, Eq. (4.2) inverted."""
    cs_ = comp_static()
    rs = {r['type']: r for r in roots_static()}
    rows = []
    for rname, cname in list(SHARED_MAP.items()) + [(None, 'LOAD'), (None, 'TEST'), (None, 'LATHE'), (None, 'FINAL')]:
        s = cs_[cname]
        avail = s['c'] * s['A'] * 3600 * H
        uc = qc * s['t'] / (1 - s['q']) / avail
        ur = 0.0
        if rname:
            r = rs[rname]
            ur = qr * r['t_mean'] / (1 - r['scrap_pct'] / 100) / avail if cname != 'HMC' else qr * r['t_mean'] / (1 - 0.010) / avail
        cap_c_alone = avail / s['t'] * (1 - s['q'])
        cap_c_with = max(0.0, (1 - ur)) * cap_c_alone
        rows.append({'station': cname if rname is None else f'{cname} / {rname}', 'cname': cname, 'u_comp': uc, 'u_roots': ur,
                     'u_total': uc + ur, 'cap_comp_alone': round(cap_c_alone), 'cap_comp_with_roots': round(cap_c_with)})
    return rows


def comp_bottleneck(roots=0.0):
    """Static compressor capacity of every station type of the full FMS with `roots` blowers per month sharing."""
    cs_ = comp_static()
    rs = {r['type']: r for r in roots_static()}
    inv = {v: k for k, v in SHARED_MAP.items()}
    out = []
    for name, s in cs_.items():
        avail = s['c'] * s['A'] * 3600 * H
        ur = 0.0
        if name in inv:
            r = rs[inv[name]]
            ur = roots * r['t_mean'] / (1 - r['scrap_pct'] / 100) / avail
        out.append((name, round((1 - ur) * avail / s['t'] * (1 - s['q']))))
    return sorted(out, key=lambda x: x[1])


# ============================================================ 3b mean value analysis of the shared cell
T_PC = 15.0
U_FAC = 1.05
LOADLOC, HMCS, RACK = 13, (14, 15, 16), range(1, 13)
A_HMC = 30.0 / (30.0 + 20.0 / 60.0)


def move(a, b):
    """Shuttle move time rule [example]: 12 s + 2 s per location distance (Section 4.3.3)."""
    return 12.0 + 2.0 * abs(a - b)


def mean_moves(racks=RACK):
    m_LH = sum(move(LOADLOC, h) for h in HMCS) / len(HMCS)
    m_HR = sum(move(h, r) for h in HMCS for r in racks) / (len(HMCS) * len(racks))
    m_RL = sum(move(r, LOADLOC) for r in racks) / len(racks)
    return m_LH, m_HR, m_RL


def mva1(stations, N):
    """Exact single-chain MVA with load-dependent multi-server stations (c >= 2), as in Section 9.2.5."""
    K = len(stations)
    Q = [0.0] * K
    P = [[1.0] + [0.0] * N for _ in range(K)]
    out = []
    for n in range(1, N + 1):
        R = []
        for k, (_, D, c) in enumerate(stations):
            if c == 0:
                R.append(D)
            elif c == 1:
                R.append(D * (1 + Q[k]))
            else:
                corr = sum((c - 1 - j) * P[k][j] for j in range(0, min(c - 1, N + 1)))
                R.append(D / c * (1 + Q[k] + corr))
        X = n / sum(R)
        Qn = [X * r for r in R]
        Pn = []
        for k, (_, D, c) in enumerate(stations):
            p = [0.0] * (N + 1)
            if c >= 2:
                for j in range(1, n + 1):
                    p[j] = X * D / min(j, c) * P[k][j - 1]
                p[0] = max(0.0, 1 - sum(p[1:]))
            Pn.append(p)
        Q, P = Qn, Pn
        out.append({'n': n, 'X_h': X * 3600.0, 'U': [X * D / c if c else None for (_, D, c) in stations]})
    return out


def cell_params(tL=147.0, DH=358.5, cL=1, cH=3, racks=RACK, cv2=0.09):
    m_LH, m_HR, m_RL = mean_moves(racks)
    return {'tL': tL, 'cL': cL, 'cH': cH, 'DH': DH, 'DS': m_LH + m_HR + m_RL, 'nmoves': 3,
            'eL': m_LH + m_RL, 'eH': m_HR + m_LH, 'cv2': cv2}


def modelA1(N, p):
    return mva1([('L', p['tL'], p['cL']), ('S', p['DS'], 1), ('H', p['DH'], p['cH'])], N)[-1]['X_h']


def modelB1(N, p, iters=500):
    W = 0.0
    for _ in range(iters):
        res = mva1([('L', p['tL'] + p['eL'] + (2 * W if p['eL'] else 0.0), p['cL']),
                    ('H', p['DH'] + p['eH'] + (2 * W if p['eH'] else 0.0), p['cH'])], N)
        X = res[-1]['X_h'] / 3600.0
        rho = min(0.95, X * p['DS'])
        Wn = rho * p['DS'] / p['nmoves'] * (1 + p['cv2']) / (2 * (1 - rho))
        if abs(Wn - W) < 1e-10:
            break
        W = 0.5 * W + 0.5 * Wn
    return res[-1]['X_h'], res[-1]['U'], W


def mva_multi(stations, N):
    """Approximate multi-chain MVA (Bard-free exact recursion over population vectors).
    stations: list of (name, {chain: D}, 'Q' queue | 'D' delay). Multi-server stations are entered as a queue with D/c
    plus a delay with D (c - 1) / c (Seidmann approximation). Returns throughput per chain [1/s] and utilisations."""
    C = len(N)
    K = len(stations)
    Qs = {tuple([0] * C): [0.0] * K}
    X = [0.0] * C
    vecs = sorted(itertools.product(*[range(x + 1) for x in N]), key=sum)[1:]
    if True:
        for n in vecs:
            Rc = [[0.0] * K for _ in range(C)]
            X = [0.0] * C
            for c in range(C):
                if n[c] == 0:
                    continue
                nm = list(n)
                nm[c] -= 1
                q = Qs[tuple(nm)]
                for k, (_, D, kind) in enumerate(stations):
                    d = D.get(c, 0.0)
                    Rc[c][k] = d if kind == 'D' else d * (1 + q[k])
                X[c] = n[c] / sum(Rc[c])
            Qs[n] = [sum(X[c] * Rc[c][k] for c in range(C)) for k in range(K)]
    U = [sum(X[c] * D.get(c, 0.0) for c in range(C)) for (_, D, kind) in stations]
    return X, U


def chain_demands(roots_tL=None, roots_DH=None):
    """Mean demands per pallet cycle of the three fixture chains: A (VC10 + VC20), B (VC30), C (Roots kit)."""
    lr = {r[0]: r for r in ROOTS_ST}
    a_mach = (0.3 * 270 + 0.5 * 345) / 0.8
    return {
        'tL': [147.0, 147.0, roots_tL if roots_tL is not None else tmean(lr['LOADC'][3])],
        'DH': [a_mach + T_PC, 450.0 + T_PC, roots_DH if roots_DH is not None else tmean(lr['HMCC'][3])],
    }


def modelB_multi(N, p, dem, iters=300):
    """Blocking-aware three-chain model: exchange times e_L, e_H and twice the M/G/1 shuttle wait added to the load
    station and HMC demands of every chain (model B of Section 9.2.5 applied per chain)."""
    W = 0.0
    C = len(N)
    for _ in range(iters):
        DL = {c: (dem['tL'][c] + p['eL'] + (2 * W if p['eL'] else 0.0)) for c in range(C)}
        DH = {c: (dem['DH'][c] + p['eH'] + (2 * W if p['eH'] else 0.0)) for c in range(C)}
        st = []
        for nm, D, cc in (('L', DL, p['cL']), ('H', DH, p['cH'])):
            st.append((nm + 'q', {c: D[c] / cc for c in D}, 'Q'))
            if cc > 1:
                st.append((nm + 'd', {c: D[c] * (cc - 1) / cc for c in D}, 'D'))
        X, U = mva_multi(st, N)
        rho = min(0.95, sum(X) * p['DS'])
        Wn = rho * p['DS'] / p['nmoves'] * (1 + p['cv2']) / (2 * (1 - rho))
        if abs(Wn - W) < 1e-8:
            break
        W = 0.5 * W + 0.5 * Wn
    return [x * 3600 for x in X], W


def demand_rates(qc=DEMAND_C, qr=DEMAND_R):
    return [0.8 * qc / H, 0.2 * qc / H, qr / H]     # pallet cycles per hour required by chain A, B, C


def best_allocation(p, dem, ntot=12, qc=DEMAND_C, qr=DEMAND_R, roots=True):
    """Pallet allocation (N_A, N_B, N_C) with N_A + N_B + N_C = ntot that maximises the fraction phi of the programme
    the cell can deliver; also the compressor output if Roots blowers are served first (X_C >= demand)."""
    req = demand_rates(qc, qr)
    best, best_rp = None, None
    rows = []
    for nc in (range(1, 6) if roots else [0]):
        for nb in range(1, ntot - nc):
            na = ntot - nc - nb
            if na < 1:
                continue
            N = (na, nb, nc) if roots else (na, nb)
            X, W = modelB_multi(N, p, dem if roots else {'tL': dem['tL'][:2], 'DH': dem['DH'][:2]})
            phi = min(X[i] / req[i] for i in range(len(N)))
            comp = min(X[0] / 0.8, X[1] / 0.2) * H
            r = {'N': N, 'X': [round(x, 3) for x in X], 'phi': phi, 'comp_month': comp,
                 'roots_month': X[2] * H if roots else 0.0, 'W': W}
            rows.append(r)
            if best is None or phi > best['phi']:
                best = r
            if roots and X[2] >= req[2] and (best_rp is None or comp > best_rp['comp_month']):
                best_rp = r
    return best, best_rp, rows


def cell_analysis():
    out = {}
    base = cell_params()
    # check against Section 9.2.5 (compressors only)
    out['check_modelA_12'] = modelA1(12, base)
    out['check_modelB_12'] = modelB1(12, base)[0]
    out['check_bound'] = 3600 / 147.0
    dem = chain_demands()
    out['chain_demands'] = dem
    # single-chain aggregate with the combined mix of pallet cycles
    qc, qr = DEMAND_C, DEMAND_R
    w_r = qr / (qc + qr)
    tL_mix = (1 - w_r) * 147.0 + w_r * dem['tL'][2]
    DH_mix = (1 - w_r) * 358.5 + w_r * dem['DH'][2]
    out['mix_cycle_share_roots'] = w_r
    out['tL_mix'], out['DH_mix'] = tL_mix, DH_mix
    curves = {}
    for key, pp in (('comp_B', base), ('comp_A', base),
                    ('mix_B', cell_params(tL=tL_mix, DH=DH_mix)), ('mix_A', cell_params(tL=tL_mix, DH=DH_mix)),
                    ('mix_B_LS2', cell_params(tL=tL_mix, DH=DH_mix, cL=2)), ('mix_A_LS2', cell_params(tL=tL_mix, DH=DH_mix, cL=2))):
        f = modelA1 if key.endswith('_A') or '_A_' in key else (lambda n, q: modelB1(n, q)[0])
        curves[key] = [f(n, pp) for n in range(1, 16)]
    out['curves'] = curves
    out['req_cycles_h'] = (qc + qr) / H
    out['req_comp_only_h'] = qc / H
    out['bound_mix_h'] = 3600 / tL_mix
    # model B of the single-chain combined mix: equivalent monthly output at 12 pallets
    xb = curves['mix_B'][11]
    out['mix_B12_month_cycles'] = xb * H
    # three-chain model: compressor-only check and allocations
    xc, _ = modelB_multi((8, 4), base, {'tL': dem['tL'][:2], 'DH': dem['DH'][:2]})
    out['three_chain_check_8A4B'] = xc
    out['three_chain_check_total'] = sum(xc)
    # what-if cases, 12 pallets (existing rack) unless stated
    near = range(10, 13)
    m_LH, m_HR_n, m_RL_n = mean_moves(near)
    nr = dict(eL=m_LH + m_RL_n, eH=m_HR_n + m_LH, DS=m_LH + m_HR_n + m_RL_n)
    cases = [
        ('Compressors only, 8 A + 4 B (case 1 design)', {}, None, 12, False),
        ('Compressors + Roots, one load station (design)', {}, None, 12, True),
        ('+ pallets stored nearest to the load station', nr, None, 12, True),
        ('+ quick-clamping kit fixture (Roots 350 s -> 250 s)', {}, 'qc', 12, True),
        ('+ two-position load station', {'eL': 0.0}, None, 12, True),
        ('+ second load station', {'cL': 2}, None, 12, True),
        ('+ second load station, 15 pallets (rack extended)', {'cL': 2}, None, 15, True),
        ('+ second load station + two-position HMC changers + nearest rack', dict(cL=2, eH=0.0, eL=nr['eL'], DS=nr['DS']), None, 12, True),
        ('+ fourth HMC, one load station', {'cH': 4}, None, 12, True),
        ('+ fourth HMC + second load station', {'cH': 4, 'cL': 2}, None, 12, True),
    ]
    wi = []
    for name, ch, special, ntot, roots in cases:
        pp = dict(base)
        pp.update(ch)
        d = dem
        if special == 'qc':
            lr = {r[0]: r for r in ROOTS_ST}
            d = chain_demands(roots_tL=tmean(lr['LOADC'][3]) * 250 / 350)
        best, best_rp, rows = best_allocation(pp, d, ntot, roots=roots)
        wi.append({'case': name, 'ntot': ntot, 'best_N': best['N'], 'phi': best['phi'], 'X': best['X'],
                   'cycles_h': sum(best['X']),
                   'comp_month_at_phi': min(best['phi'], 1.0) * DEMAND_C if roots else best['comp_month'],
                   'roots_first_N': best_rp['N'] if best_rp else None,
                   'roots_first_comp_month': best_rp['comp_month'] if best_rp else None,
                   'roots_first_roots_month': best_rp['roots_month'] if best_rp else None,
                   'allocations': [{'N': r['N'], 'phi': round(r['phi'], 4), 'comp': round(r['comp_month']),
                                    'roots': round(r['roots_month'])} for r in rows]})
    out['whatif'] = wi
    return out


# ============================================================ 3c / 3d Roots flow line, P0 and transfer test
def roots_line(x_c_h, qc=DEMAND_C, buffer=4, sigma=0.05):
    """Reduced-order flow line of the Roots extension (one blower per job).
    The shared cell is one flow-equivalent station 'CELL' (3 servers) whose rate equals the Roots throughput x_c_h
    [kits / h] of the three-chain MVA with saturated compressor chains; the other shared stations (wash, paint, pack)
    offer Roots the capacity left by the compressor programme qc (time / (1 - u_comp))."""
    cs_ = comp_static()
    out = []
    for name, shared, c, times, mtbf, mttr, q, _ in ROOTS_ST:
        if name == 'LOADC':
            continue
        td = dict(zip(VAR, times))
        if name == 'HMCC':
            tfe = 3 * 3600.0 / x_c_h                              # mean time per kit and server
            m = tmean(times)
            td = {v: tfe * t / m for v, t in td.items()}
            out.append(flowline.Station('CELL', 3, buffer, td, 1.0, sigma, mtbf, mttr / 60.0, q))
            continue
        if shared:
            s = cs_[SHARED_MAP[name]]
            uc = qc * s['t'] / (1 - s['q']) / (s['c'] * s['A'] * 3600 * H)
            td = {v: t / (1 - uc) for v, t in td.items()}
        out.append(flowline.Station(name, c, buffer, td, 1.0, sigma, mtbf, mttr / 60.0, q))
    return out


def line_capacity(line, mix=MIX_R):
    return [(st.name, st.c * st.mtbf_h / (st.mtbf_h + st.mttr_h) * 3600 * H /
             (sum(mix[v] * st.tdesign[v] for v in mix) * st.speed) * (1 - st.scrap)) for st in line]


def frozen_P0(design, n=400, seed=2027):
    rng = random.Random(seed)
    beliefs = [StationBelief(st, 1.0) for st in design]
    vals = [flowline.simulate([b.sample(st, rng) for st, b in zip(design, beliefs)], MIX_R, H, rng)[0] for _ in range(n)]
    det = [flowline.simulate(design, MIX_R, H, rng)[0] for _ in range(20)]
    v = sorted(vals)
    return {'record': 'P0 – frozen design-stage prediction of the Roots line (thesis section 9.4.4)',
            'created': datetime.date.today().isoformat(),
            'model': 'thesis/code/case3_roots.py, reduced-order flow line, shared cell as flow-equivalent station',
            'priors': 'Table 4.4 worths: failures 10 x MTBF hours, repairs 5, cycles 10 (+-10 %), scrap 250 parts',
            'hours_per_month': H, 'deterministic_design_B0_mean': round(statistics.mean(det)),
            'P0_mean': round(statistics.mean(vals)), 'P0_p05': v[int(0.05 * n)], 'P0_p50': v[int(0.5 * n)],
            'P0_p95': v[int(0.95 * n) - 1], 'P_ge_demand': sum(x >= DEMAND_R for x in vals) / n,
            'note': 'Reference design case: no Roots blower production data exist. Replace by P0 v2 with the final design data.'}


def roots_scenario(args):
    """Virtual ramp-up of the Roots line (generator of Chapter 6 / Section 9.3.3): B0 vs P07 vs P07D + bottleneck."""
    seed, n_theta, x_c_h = args
    rng = random.Random(seed)
    design = roots_line(x_c_h)
    trng = random.Random(40_000 + seed)
    truth = [{'f_mtbf': trng.uniform(0.6, 1.1), 'f_mttr': trng.uniform(1.0, 1.5), 'f_speed': trng.uniform(0.98, 1.12),
              'sigma': trng.uniform(0.04, 0.10), 'f_scrap': trng.uniform(1.0, 2.0)} for _ in design]

    def true_line(k):
        r = math.exp(-(k - 1) / 2.0)
        return [flowline.Station(st.name, st.c, st.buffer, st.tdesign, t['f_speed'] * (1 + 0.08 * r), t['sigma'],
                                 st.mtbf_h * t['f_mtbf'] * (1 - 0.5 * r), st.mttr_h * t['f_mttr'] * (1 + 0.5 * r),
                                 min(0.5, max(st.scrap, 0.001) * t['f_scrap'] * (1 + 2 * math.exp(-(k - 1) / 1.5))))
                for st, t in zip(design, truth)]

    def caps(line):
        return [c for _, c in line_capacity(line)]

    b0 = statistics.mean(flowline.simulate(design, MIX_R, H, rng)[0] for _ in range(10))
    bel = [StationBelief(st, 1.0) for st in design]

    def pred():
        vals = sorted(flowline.simulate([b.sample(st, rng) for b, st in zip(bel, design)], MIX_R, H, rng)[0]
                      for _ in range(n_theta))
        return statistics.mean(vals), vals[int(0.05 * len(vals))], vals[int(0.95 * len(vals)) - 1]
    p07 = pred()
    dm, dk, da, db = 0.0, 1.0, 2.0, 0.05 ** 2
    rows = []
    for k in range(1, 13):
        tl = true_line(k)
        y, obs, _ = flowline.simulate(tl, MIX_R, H, rng, record=True)
        scale = math.sqrt(db * (dk + 1) / (da * dk))
        smc = math.log(p07[2] / p07[1]) / 3.29 if p07[1] > 0 else 0.0
        half = (1.7 if da >= 10 else 1.9 if da >= 4 else 2.3) * math.sqrt(smc ** 2 + scale ** 2)
        c = p07[0] * math.exp(dm)
        capt = caps(tl)
        capb = caps([flowline.Station(st.name, st.c, st.buffer, st.tdesign, b.cyc.mean_time(), 0.05, b.fail.mtbf_mean(),
                                      b.rep.mttr_mean(), b.scrap.mean()) for st, b in zip(design, bel)])
        capd = caps(design)
        am = lambda v: min(range(len(v)), key=lambda j: v[j])
        rows.append({'scenario': seed, 'month': k, 'truth': y, 'B0': b0, 'P07': p07[0], 'P07D': c,
                     'P07D_lo': c * math.exp(-half), 'P07D_hi': c * math.exp(half),
                     'bn_true': design[am(capt)].name, 'bn_twin': design[am(capb)].name, 'bn_design': design[am(capd)].name})
        if k == 12:
            break
        if k >= 2:
            e = math.log(y / p07[0])
            k0, m0, a0, b0_ = 0.7 * dk, dm, 0.7 * da, 0.7 * db
            dk = k0 + 1
            dm = (k0 * m0 + e) / dk
            da = a0 + 0.5
            db = b0_ + k0 * (e - m0) ** 2 / (2 * dk)
        for b, o in zip(bel, obs):
            b.update(o, 0.7)
        p07 = pred()
    return rows


def summarise_rampup(rows):
    out = []
    for k in range(1, 13):
        rr = [r for r in rows if r['month'] == k]
        e = lambda m: 100 * statistics.mean(abs(r[m] - r['truth']) / r['truth'] for r in rr)
        out.append({'month': k, 'truth': statistics.mean(r['truth'] for r in rr), 'B0': e('B0'), 'P07': e('P07'),
                    'P07D': e('P07D'),
                    'cov': 100 * statistics.mean(r['P07D_lo'] <= r['truth'] <= r['P07D_hi'] for r in rr),
                    'bn_twin': 100 * statistics.mean(r['bn_twin'] == r['bn_true'] for r in rr),
                    'bn_design': 100 * statistics.mean(r['bn_design'] == r['bn_true'] for r in rr)})
    return out


# ============================================================ 3e first investment step (simplified screening)
OPTIONS_R = {  # name -> (capex EUR, description)  [reference estimate]
    'LS2': (90_000, 'second load station of the shared cell (+ operator, 2nd shift share)'),
    'RT2': (160_000, 'second Roots run-test bench'),
    'RM2': (420_000, 'second rotor profile milling machine'),
    'NR': (15_000, 'nearest-rack storage rule + rack software change in the cell controller'),
}
OPEX_R = stg.OPEX


def screen_value(opts, cellres, qc, qr, f=None):
    """Screening throughput of both families for an option set.
    cell: three-chain MVA (model B) with the best allocation for the option set -> compressors and Roots per month
    Roots line: min static capacity of the dedicated stations (Eq. 4.2) x eta (blocking efficiency of the DES)
    compressors: min(cell, rest of the factory = P0 mean of case 1)."""
    key = ('LS2' in opts, 'NR' in opts)
    alloc = cellres[key]
    cap_r = roots_dedicated_cap(opts, f) * ETA_R
    best = None
    for a in alloc:                     # Roots programme served first (strategic decision), then most compressors
        comp = min(a['comp'] * A_HMC * (1 - 0.008), P0_COMP, qc)
        roots = min(a['roots'] * A_HMC * (1 - 0.010), cap_r, qr)
        rank = (round(roots), comp)
        if best is None or rank > best[0]:
            v = MARGIN_C * comp + MARGIN_R * roots - stg.PENALTY * (max(0, qc - comp) + max(0, qr - roots))
            best = (rank, v, comp, roots, a['N'])
    return best[1:]


def roots_dedicated_cap(opts, f=None):
    caps = []
    for name, shared, c, times, mtbf, mttr, q, _ in ROOTS_ST:
        if shared:
            continue
        c2 = c + (1 if (name == 'RTEST' and 'RT2' in opts) or (name == 'RMILL' and 'RM2' in opts) else 0)
        t = tmean(times)
        fac = (f or {}).get(name, 1.0)
        A = mtbf / (mtbf + mttr / 60.0)
        caps.append(c2 * A * 3600 * H / (t * fac) * (1 - q))
    return min(caps)


P0_COMP = 6176.0           # case 1 P0 mean (Table 9.2): output of the rest of the compressor factory
ETA_R = 1.0                # calibrated in main()


def staging_screen(cellres, dem_r_path=DEMAND_R_PATH, qc=DEMAND_C, budget=stg.BUDGET, f=None):
    """Rolling-horizon rule of Chapter 7 (Eq. 7.3) with the screening model above and design values (STATIC policy)."""
    S, T_, DISC, M = stg.STAGES, stg.TERMINAL, stg.DISC, stg.MONTHS
    inst, plan, trace = (), [], []

    def value_from(opts, s):
        v = 0.0
        for t in range(s, S + 1 + T_):
            dr = dem_r_path[min(t, S + 1) - 1]
            sv = screen_value(opts, cellres, qc, dr, f)[0]
            v += sv * M / (1 + DISC) ** t - OPEX_R * sum(OPTIONS_R[o][0] for o in opts) / (1 + DISC) ** t
        return v
    for s in range(1, S + 1):
        rest = [o for o in OPTIONS_R if o not in inst]
        best, best_v, cand = (), -math.inf, []
        for r in range(len(rest) + 1):
            for comb in itertools.combinations(rest, r):
                capex = sum(OPTIONS_R[o][0] for o in comb)
                if capex > budget:
                    continue
                opts = tuple(sorted(set(inst) | set(comb)))
                v = value_from(opts, s) - capex / (1 + DISC) ** s
                cand.append((comb, v))
                if v > best_v + 1e-6:
                    best, best_v = comb, v
        plan.append(best)
        trace.append(sorted(cand, key=lambda x: -x[1])[:5])
        inst = tuple(sorted(set(inst) | set(best)))
    none = value_from((), 1)
    return plan, trace, none


def build_cellres(fL=1.0, fH=1.0):
    """Three-chain model B for the four cell configurations (with / without LS2, with / without nearest-rack rule)."""
    lr = {r[0]: r for r in ROOTS_ST}
    dem = chain_demands(roots_tL=tmean(lr['LOADC'][3]) * fL, roots_DH=tmean(lr['HMCC'][3]) * fH)
    pbase = cell_params()
    m_LH, m_HR_n, m_RL_n = mean_moves(range(10, 13))
    nr = dict(eL=m_LH + m_RL_n, eH=m_HR_n + m_LH, DS=m_LH + m_HR_n + m_RL_n)
    cellres = {}
    for ls2 in (False, True):
        for nrr in (False, True):
            pp = dict(pbase)
            if ls2:
                pp['cL'] = 2
            if nrr:
                pp.update(nr)
            _, _, allrows = best_allocation(pp, dem, 12)
            cellres[(ls2, nrr)] = [{'N': a['N'], 'comp': a['comp_month'], 'roots': a['roots_month']} for a in allrows]
    return cellres


def option_singles(cellres, qr=DEMAND_R, qc=DEMAND_C):
    rows = []
    base = screen_value((), cellres, qc, qr)
    for o in [()] + [(k,) for k in OPTIONS_R] + [('LS2', 'NR'), ('LS2', 'RT2')]:
        v, comp, roots, N = screen_value(o, cellres, qc, qr)
        rows.append({'opts': '+'.join(o) or 'none', 'capex': sum(OPTIONS_R[x][0] for x in o), 'comp': comp, 'roots': roots,
                     'N': N, 'dmargin_month': v - base[0],
                     'payback_months': (sum(OPTIONS_R[x][0] for x in o) / (v - base[0])) if v - base[0] > 1 else None})
    return rows


# ============================================================ 3f data path
def ua_mqtt_load(N, T, n_a=3, r_d=0.05, r_e=0.03, k=3):
    """Edition 2, Section 9.2.4: OPC UA + Sparkplug B load in bytes per second and device."""
    bua = 350 / T + 35 * (n_a / T + r_d) + 250 * r_e
    bmq = (150 + 20 * n_a) / T + 20 * r_d + 230 * r_e
    return bua, bmq


def data_path():
    out = {'modbus_28_025': cs.sizing(28, 0.25), 'modbus_21_025': cs.sizing(21, 0.25)}
    for T in (0.25, 0.5, 1.0):
        tot = 0.0
        ua_tot = mq_tot = 0.0
        devs = [(27, 3), (1, 12)]                      # 27 devices as case 1, the run-test bench with 12 analogue values
        for n, na in devs:
            bua, bmq = ua_mqtt_load(n, T, n_a=na)
            ua_tot += n * bua
            mq_tot += n * bmq
            tot += n * (bua + 4 * bmq)
        out[f'ua_T{T}'] = {'ua_kbit_dev': ua_mqtt_load(1, T)[0] * 8 / 1000, 'mq_kbit_dev': ua_mqtt_load(1, T)[1] * 8 / 1000,
                           'ua_Mbit': ua_tot * 8 / 1e6, 'mq_in_Mbit': mq_tot * 8 / 1e6, 'total_Mbit': tot * 8 / 1e6,
                           'msgs_in': 28 * (1 / T + 0.03), 'msgs_out': 3 * 28 * (1 / T + 0.03),
                           'notif': 27 * (3 / T + 0.05 + 0.03) + (12 / T + 0.05 + 0.03), 'publish': 28 / T,
                           'test_bench_kbit': (ua_mqtt_load(1, T, n_a=12)[0] + 4 * ua_mqtt_load(1, T, n_a=12)[1]) * 8 / 1000}
    return out


# ============================================================ figures
def grouped_bars(groups, series, path, title, ylabel, ymax, w=860, h=400, refline=None):
    """groups: labels; series: [(name, values, color)]."""
    L, R, T, B = 70, 20, 40, 64
    pw, ph = w - L - R, h - T - B
    s = ''
    for i in range(6):
        y = T + ph - i / 5 * ph
        s += (f'<line x1="{L}" x2="{L + pw}" y1="{y:.1f}" y2="{y:.1f}" stroke="{mf.GRID}"/>'
              f'<text x="{L - 6}" y="{y + 4:.1f}" font-size="12" fill="{mf.INK2}" text-anchor="end">{ymax * i / 5:.0f}</text>')
    gw = pw / len(groups)
    bw = gw * 0.78 / len(series)
    for gi, g in enumerate(groups):
        for si, (nm, vals, col) in enumerate(series):
            v = vals[gi]
            if v is None:
                continue
            x = L + gi * gw + gw * 0.11 + si * bw
            bh = min(v, ymax) / ymax * ph
            s += f'<rect x="{x:.1f}" y="{T + ph - bh:.1f}" width="{bw - 3:.1f}" height="{bh:.1f}" rx="2" fill="{col}"/>'
            s += f'<text x="{x + (bw - 3) / 2:.1f}" y="{T + ph - bh - 5:.1f}" font-size="11" fill="{mf.INK}" text-anchor="middle">{v:.0f}</text>'
        for j, part in enumerate(g.split('|')):
            s += f'<text x="{L + gi * gw + gw / 2:.1f}" y="{T + ph + 18 + j * 15}" font-size="12" fill="{mf.INK}" text-anchor="middle">{part}</text>'
    if refline is not None:
        y = T + ph - refline[0] / ymax * ph
        s += f'<line x1="{L}" x2="{L + pw}" y1="{y:.1f}" y2="{y:.1f}" stroke="{mf.INK}" stroke-dasharray="5 4"/>'
        s += f'<text x="{L + pw - 4}" y="{y - 6:.1f}" font-size="12" fill="{mf.INK}" text-anchor="end">{refline[1]}</text>'
    lx = L
    for nm, _, col in series:
        s += f'<rect x="{lx}" y="12" width="14" height="14" rx="2" fill="{col}"/><text x="{lx + 20}" y="24" font-size="12.5" fill="{mf.INK}">{nm}</text>'
        lx += 30 + 7.2 * len(nm)
    s += f'<line x1="{L}" x2="{L + pw}" y1="{T + ph}" y2="{T + ph}" stroke="{mf.INK2}"/>'
    s += f'<text x="16" y="{T + ph / 2}" font-size="12.5" fill="{mf.INK}" text-anchor="middle" transform="rotate(-90 16 {T + ph / 2})">{ylabel}</text>'
    open(path, 'w', encoding='utf-8').write(mf.svg(w, h, s, title))


def figures(res):
    os.makedirs(FIG, exist_ok=True)
    # Figure: utilisation of shared stations, compressors only vs with Roots
    sl = [r for r in res['shared_load'] if r['cname'] in ('LOAD147', 'HMC', 'WASH', 'PAINT', 'PACK', 'TEST', 'LATHE', 'FINAL')]
    lab = {'LOAD147': 'Load station|(147 s)', 'HMC': 'HMC group|(3 HMCs)', 'WASH': 'Wash', 'PAINT': 'Paint', 'PACK': 'Pack',
           'TEST': 'Test|(compr. only)', 'LATHE': 'Lathe|(compr. only)', 'FINAL': 'Final|(compr. only)'}
    grouped_bars([lab[r['cname']] for r in sl],
                 [('compressors only (6 000 / month)', [100 * r['u_comp'] for r in sl], mf.C[0]),
                  ('compressors + 400 Roots blowers / month', [100 * r['u_total'] for r in sl], mf.C[1])],
                 os.path.join(FIG, 'fig9_4_roots_shared_load.svg'), 'Static load of the shared stations',
                 'Utilisation, Eq. (4.2) [%]', 125, refline=(100, '100 %'))
    # Figure: cell throughput vs pallets, combined mix, model A / B, 1 and 2 load stations
    cv = res['cell']['curves']
    xs = list(range(1, 16))
    req = res['cell']['req_cycles_h']
    mf.lines([('Compressors only, model B', cv['comp_B'], 0, False),
              ('With Roots kits, model A', cv['mix_A'], 1, True),
              ('With Roots kits, model B', cv['mix_B'], 1, False),
              ('With Roots, 2 load st., B', cv['mix_B_LS2'], 2, False),
              (f'Required {req:.1f} cycles / h', [req] * len(xs), None, True)],
             xs, 'Throughput of the shared cell', 'Pallet cycles per hour', os.path.join(FIG, 'fig9_5_roots_cell_mva.svg'),
             30, xlabel='Number of pallets in the cell', w=820, yticks=[0, 5, 10, 15, 20, 25, 30])
    # Figure: static capacity of the Roots line (flow-equivalent cell)
    cap = res['roots_line_capacity']
    mn = min(c for _, c in cap)
    shared = {'CELL', 'WASH', 'PAINT', 'PACK'}
    mf.bars([(n + ('|(shared)' if n in shared else '|(new)'), c) for n, c in cap], 'Static capacity of the Roots line', 'Roots blowers per month (Eq. 4.2)',
            os.path.join(FIG, 'fig9_6_roots_capacity.svg'), w=820, fmt='{:,.0f}',
            colors=[mf.C[1] if c - mn < 1 else mf.C[0] for _, c in cap], ymax=3200, refline=(DEMAND_R, 'demand 400 / month'))
    # Figure: transfer test
    sm = res['rampup_summary']
    xs = list(range(2, 13))
    g = lambda key: [r[key] for r in sm if r['month'] in xs]
    mf.lines([('B0 design model', g('B0'), 0, False), ('P07 Bayesian twin', g('P07'), 2, False),
              ('P07D twin + discrepancy', g('P07D'), 3, False)],
             xs, 'Transfer test on the Roots line', 'Mean absolute error of monthly output [%]',
             os.path.join(FIG, 'fig9_7_roots_transfer.svg'), 50, yticks=[0, 10, 20, 30, 40, 50])


# ============================================================ main
def main():
    global ETA_R
    os.makedirs(DATA, exist_ok=True)
    res = {'products': PRODUCTS_R, 'mix': MIX_R, 'demand_roots': DEMAND_R, 'demand_comp': DEMAND_C}
    print('== 3a static capacity')
    rs = roots_static()
    res['roots_static'] = rs
    for r in rs:
        print(f"{r['type']:7} c={r['c']} t={r['t_mean']:7.1f} A={r['A']:.4f} cap_alone={r['cap_alone']:6d} need={r['need_oee075']}")
    res['shared_load'] = shared_load()
    for r in res['shared_load']:
        print(f"{r['station']:16} u_comp {100*r['u_comp']:5.1f}  u_roots {100*r['u_roots']:5.1f}  total {100*r['u_total']:5.1f}"
              f"  cap_comp {r['cap_comp_alone']} -> {r['cap_comp_with_roots']}")
    res['comp_bottleneck_alone'] = comp_bottleneck(0.0)[:6]
    res['comp_bottleneck_with_roots'] = comp_bottleneck(DEMAND_R)[:6]
    res['comp_bottleneck_design_Table43'] = None
    print('compressor static ranking, alone   :', res['comp_bottleneck_alone'])
    print('compressor static ranking, + Roots :', res['comp_bottleneck_with_roots'])

    print('== 3b MVA of the shared cell')
    cell = cell_analysis()
    res['cell'] = cell
    print('check vs 9.2.5: model A(12) %.2f  model B(12) %.2f  bound %.2f' % (cell['check_modelA_12'], cell['check_modelB_12'], cell['check_bound']))
    print('three-chain model B, 8A+4B:', [round(x, 2) for x in cell['three_chain_check_8A4B']], 'total %.2f' % cell['three_chain_check_total'])
    print('combined mix: Roots share of cycles %.3f, tL %.1f s, DH %.1f s, bound %.2f /h, required %.2f /h'
          % (cell['mix_cycle_share_roots'], cell['tL_mix'], cell['DH_mix'], cell['bound_mix_h'], cell['req_cycles_h']))
    for key, v in cell['curves'].items():
        print(f'{key:10}', ' '.join(f'{x:5.2f}' for x in v))
    for w in cell['whatif']:
        print(f"{w['case']:66} N*={w['best_N']} phi={w['phi']:.3f} X={w['X']} total={w['cycles_h']:.2f} comp@phi={w['comp_month_at_phi']:.0f}"
              f" | roots-first N={w['roots_first_N']} comp={w['roots_first_comp_month']} roots={w['roots_first_roots_month']}")

    # design allocation of the base configuration (Roots served first) -> flow-equivalent cell for the Roots line
    base = cell['whatif'][1]
    x_c = (base['roots_first_roots_month'] or base['X'][2] * H) / H
    res['design_alloc'] = base['roots_first_N']
    res['x_c_h'] = x_c
    design = roots_line(x_c)
    capl = line_capacity(design)
    res['roots_line_capacity'] = [(n, round(c)) for n, c in capl]
    print('Roots line (flow-equivalent cell %.3f kits/h):' % x_c, res['roots_line_capacity'])
    rng = random.Random(11)
    des = [flowline.simulate(design, MIX_R, H, rng)[0] for _ in range(20)]
    res['roots_des_mean'] = statistics.mean(des)
    ETA_R = res['roots_des_mean'] / min(c for _, c in capl)
    res['eta_R'] = ETA_R
    print('DES Roots per month (design): %.0f, eta %.3f' % (res['roots_des_mean'], ETA_R))

    print('== 3c frozen design prediction P0')
    p0 = frozen_P0(design)
    res['P0'] = p0
    json.dump(p0, open(os.path.join(DATA, 'case3_P0.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(p0)

    print('== 3d transfer test (20 scenarios)')
    with Pool(15) as p:
        out = p.map(roots_scenario, [(s, 30, x_c) for s in range(1, 21)])
    rows = [r for x in out for r in x]
    with open(os.path.join(DATA, 'case3_rampup.csv'), 'w', newline='', encoding='utf-8') as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(rows)
    sm = summarise_rampup(rows)
    res['rampup_summary'] = sm
    for r in sm:
        print(f"{r['month']:2d} truth {r['truth']:6.0f} B0 {r['B0']:5.1f} P07 {r['P07']:5.1f} P07D {r['P07D']:5.1f} cov {r['cov']:5.1f}"
              f" BN twin {r['bn_twin']:4.0f} design {r['bn_design']:4.0f}")
    bn = {}
    for r in rows:
        if r['month'] == 12:
            bn[r['bn_true']] = bn.get(r['bn_true'], 0) + 1
    res['true_bottlenecks_month12'] = bn
    print('true bottleneck in month 12:', bn)

    print('== 3e first investment step (screening)')
    cellres = build_cellres()
    singles = option_singles(cellres)
    res['option_singles'] = singles
    for r in singles:
        print(r)
    plan, trace, none = staging_screen(cellres)
    res['plan_base'] = [list(x) for x in plan]
    res['npv_none_M'] = none / 1e6
    res['dnpv_plan_M'] = trace[0][0][1] / 1e6 - none / 1e6
    print('NPV no investment %.3f M EUR, plan dNPV %.3f M EUR' % (res['npv_none_M'], res['dnpv_plan_M']))
    res['plan_trace_stage1'] = [['+'.join(c) or '-', round(v / 1e6, 3)] for c, v in trace[0]]
    print('plan (design values):', plan)
    print('stage-1 ranking:', res['plan_trace_stage1'])
    sens = []
    for label, kw in (('Roots demand x 0.8', {'dem_r_path': [d * 0.8 for d in DEMAND_R_PATH]}),
                      ('Roots demand x 1.5', {'dem_r_path': [d * 1.5 for d in DEMAND_R_PATH]}),
                      ('compressor demand 5 000 / month', {'qc': 5000.0}),
                      ('test time + 30 % (run test longer)', {'f': {'RTEST': 1.3}}),
                      ('rotor milling time + 40 %', {'f': {'RMILL': 1.4}}),
                      ('budget 150 000 EUR / stage', {'budget': 150_000.0})):
        pl, _, _ = staging_screen(cellres, **kw)
        sens.append({'case': label, 'plan': [list(x) for x in pl]})
        print(f'{label:36}', pl)
    res['plan_sensitivity'] = sens
    # robustness over design-prior samples: Roots cell times (load, HMC) and dedicated cycle times, lognormal 10 %
    rng = random.Random(77)
    wins, second = {}, {}
    for _ in range(40):
        f = {name: math.exp(rng.gauss(0.0, 0.10)) for name, sh, *_ in ROOTS_ST if not sh}
        cr = build_cellres(math.exp(rng.gauss(0.0, 0.10)), math.exp(rng.gauss(0.0, 0.10)))
        pl, _, _ = staging_screen(cr, f=f)
        k = '+'.join(pl[0]) or '-'
        wins[k] = wins.get(k, 0) + 1
        k2 = '+'.join(pl[1]) or '-'
        second[k2] = second.get(k2, 0) + 1
        pl15, _, _ = staging_screen(cr, f=f, dem_r_path=[d * 1.5 for d in DEMAND_R_PATH])
        k3 = ' / '.join('+'.join(x) or '-' for x in pl15)
        res.setdefault('plan_prior_samples_dem15', {})
        res['plan_prior_samples_dem15'][k3] = res['plan_prior_samples_dem15'].get(k3, 0) + 1
    res['first_step_prior_samples'] = wins
    res['second_step_prior_samples'] = second
    print('first step over 40 prior samples:', wins, 'second:', second)
    print('plans with Roots demand x 1.5 over prior samples:', res['plan_prior_samples_dem15'])

    print('== 3f data path')
    res['data_path'] = data_path()
    print(json.dumps(res['data_path'], indent=1, default=str))

    json.dump(res, open(os.path.join(DATA, 'case3_roots.json'), 'w', encoding='utf-8'), indent=1, default=str, ensure_ascii=False)
    figures(res)
    print('written data/case3_roots.json, case3_rampup.csv, case3_P0.json and figures fig9_4..fig9_7')


if __name__ == '__main__':
    main()
