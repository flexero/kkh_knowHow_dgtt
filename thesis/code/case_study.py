"""Industrial application (thesis chapter 9): reference design cases.

Case 1 – compressor FMS (design model of this project, config/factory.json, Table 4.2):
  1a frozen design prediction P0 of the designed FMS (prior predictive, design priors) -> data/case1_P0.json
  1b staging decision with reference costs + one-at-a-time sensitivity of the decision and its value
  1c gateway sizing for the case's Modbus devices
Case 2 – ball screw shaft line (design of the "Ball screw + guide factory" tab, web/bsfmfg_data.js, route BS, variant G):
  2a route, machine counts, capacity and bottleneck
  2b transfer test of the Bayesian twin: virtual ramp-up with hidden true factories (as chapter 6)
  2c gateway sizing for the 73 machines of the whole ball screw + guide factory

Reliability values of case 2 and all money values are [reference estimate] (engineering estimates, not supplier data).
Usage: python case_study.py
"""
from __future__ import annotations

import datetime
import json
import math
import os
import random
import re
import statistics
import sys
from multiprocessing import Pool

import bayes
import flowline
import staging as stg
from rampup_experiment import StationBelief

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
WEB = os.path.join(HERE, '..', '..', 'web')


# ============================================================ case 1
def case1_frozen_prediction(n=400, seed=2026):
    """P0: prior predictive of the monthly good output of the DESIGNED FMS (all options, buffers 4) at maturity."""
    rng = random.Random(seed)
    design = stg.config_line(tuple(stg.OPT))                  # full FMS as designed
    beliefs = [StationBelief(st, 1.0) for st in flowline.compressor_line(buffer=4)]
    vals, det = [], []
    for _ in range(n):
        line = [b.sample(st, rng) for st, b in zip(design, beliefs)]   # machine parameters from the design priors
        vals.append(flowline.simulate(line, flowline.MIX, stg.HOURS, rng)[0])
    for _ in range(20):
        det.append(flowline.simulate(design, flowline.MIX, stg.HOURS, rng)[0])
    v = sorted(vals)
    rec = {
        'record': 'P0 – frozen design-stage prediction (thesis section 4.8.2)',
        'created': datetime.date.today().isoformat(),
        'model': 'thesis/code/flowline.py reduced-order DES; design = Table 4.2 + all six options of Table 7.1 (buffers 4, MES)',
        'priors': 'Table 4.4 with worths: failures 10 x MTBF hours, repairs 5, cycles 10 (+-10 %), scrap 250 parts',
        'hours_per_month': stg.HOURS,
        'deterministic_design_B0_mean': round(statistics.mean(det)),
        'P0_mean': round(statistics.mean(vals)),
        'P0_p05': v[int(0.05 * n)], 'P0_p50': v[int(0.5 * n)], 'P0_p95': v[int(0.95 * n) - 1],
        'note': 'Mature-state monthly good output. To be compared with the real factory after ramp-up (section 9.6). '
                'Values are a reference design case until the final design data replace Table 4.2.',
    }
    json.dump(rec, open(os.path.join(DATA, 'case1_P0.json'), 'w'), indent=1)
    return rec


def staging_plan(eco=None, cfg=None, demand_factor=1.0):
    """STATIC decision with design values under modified economics / effects (sensitivity)."""
    saved = {k: getattr(stg, k) for k in ('MARGIN', 'PENALTY', 'DISC', 'BUDGET', 'OPEX')}
    saved_opt = dict(stg.OPTIONS)
    try:
        for k, v in (eco or {}).items():
            setattr(stg, k, v)
        if cfg and 'capex' in cfg:
            stg.OPTIONS.update({k: (v[0] * cfg['capex'], v[1], v[2]) for k, v in saved_opt.items()})
        dem = [d * demand_factor for d in stg.DEMAND]
        inst, plan = (), []
        for t in range(1, stg.STAGES + 1):
            c = stg.decide(inst, t, stg.BUDGET, dem, [None], 0.0)
            plan.append(c)
            inst = tuple(sorted(set(inst) | set(c)))
        # value of the plan vs no investment with the screening model
        def npv(p):
            ins, v = (), 0.0
            for t in range(1, stg.STAGES + 1):
                ins = tuple(sorted(set(ins) | set(p[t - 1])))
                capex = sum(stg.OPTIONS[o][0] for o in p[t - 1])
                th = stg.screen_th(stg.config_line(ins))
                v += stg.stage_value(th, dem[t - 1], t) - capex / (1 + stg.DISC) ** t \
                    - stg.OPEX * sum(stg.OPTIONS[o][0] for o in ins) / (1 + stg.DISC) ** t
            th = stg.screen_th(stg.config_line(ins))
            for t in range(stg.STAGES + 1, stg.STAGES + 1 + stg.TERMINAL):
                v += stg.stage_value(th, dem[-1], t) - stg.OPEX * sum(stg.OPTIONS[o][0] for o in ins) / (1 + stg.DISC) ** t
            return v
        return plan, npv(plan) - npv([()] * stg.STAGES)
    finally:
        for k, v in saved.items():
            setattr(stg, k, v)
        stg.OPTIONS.clear()
        stg.OPTIONS.update(saved_opt)


def case1_sensitivity():
    base_plan, base_v = staging_plan()
    rows = [('base case', base_plan, base_v)]
    for label, eco, cfg, df in (
            ('margin −30 % (315 EUR)', {'MARGIN': 315.0}, None, 1.0), ('margin +30 % (585 EUR)', {'MARGIN': 585.0}, None, 1.0),
            ('capex −30 %', None, {'capex': 0.7}, 1.0), ('capex +30 %', None, {'capex': 1.3}, 1.0),
            ('demand × 0.8', None, None, 0.8), ('demand × 1.2', None, None, 1.2),
            ('discount 2.5 % / half-year', {'DISC': 0.025}, None, 1.0), ('discount 10 % / half-year', {'DISC': 0.10}, None, 1.0),
            ('budget 250 000 EUR / stage', {'BUDGET': 250_000.0}, None, 1.0), ('budget 800 000 EUR / stage', {'BUDGET': 800_000.0}, None, 1.0),
            ('penalty 0 EUR / unit', {'PENALTY': 0.0}, None, 1.0), ('penalty 150 EUR / unit', {'PENALTY': 150.0}, None, 1.0)):
        p, v = staging_plan(eco, cfg, df)
        rows.append((label, p, v))
    return rows


def sizing(N, P, k=1, n=36, scan=10.0, t0=1.0, tnet=0.05):
    rtt = tnet + t0 + scan / 2
    return {'N': N, 'P': P, 'bytes_poll': 261 + 2 * n, 'Mbit_s': N * k * (261 + 2 * n) * 8 / P / 1e6,
            'rtt_ms': rtt, 'Nmax_seq': P * 1000 / (k * rtt), 'cycle_seq_ms': N * k * rtt,
            'cycle_par_ms': k * (tnet + t0 + scan + 0.04 * N), 'lat_max_par_s': P + (tnet + t0 + scan) / 1000}


# ============================================================ case 2
MTBF_EST = {  # [reference estimate] MTBF h, MTTR min per machine class of the ball screw line
    'MS-SAW': (150, 20), 'BS-STR': (120, 20), 'BS-CTR': (90, 25), 'BS-TRN': (60, 30), 'BS-IND': (50, 40),
    'HT-TMP': (300, 60), 'BS-STH': (80, 30), 'BS-CLP': (120, 15), 'BS-CGR': (60, 35), 'BS-TGR': (40, 45),
    'QC-LED': (200, 30), 'AS-WSH': (150, 20),
}


def bs_route():
    """Parse route BS (screw shaft), variant G, from the ball screw factory design (web/bsfmfg_data.js)."""
    src = open(os.path.join(WEB, 'bsfmfg_data.js'), encoding='utf-8').read()
    block = src[src.index('  BS: {'):src.index('  BN: {')]
    ops = []
    for chunk in block.split('{ no: ')[1:]:
        no = re.match(r'"([^"]+)"', chunk).group(1)
        m = re.search(r'\bm: "([^"]+)"', chunk).group(1)
        setup = float(re.search(r'\bsetup: ([\d.]+)', chunk).group(1))
        cm = re.search(r'\bcyc: (\{[^}]*\}|[\d.]+)', chunk).group(1)
        cyc = float(re.search(r'G: ([\d.]+)', cm).group(1)) if cm.startswith('{') else float(cm)
        batch = float(re.search(r'\bbatch: ([\d.]+)', chunk).group(1))
        scrap = float(re.search(r'\bscrap: ([\d.]+)', chunk).group(1))
        vm = re.search(r'\bv: \[([^\]]*)\]', chunk)
        if vm and '"G"' not in vm.group(1):
            continue
        ops.append({'no': no, 'm': m, 'setup': setup, 'cyc_min': cyc, 'batch': batch, 'scrap': scrap / 100.0})
    return ops


def bs_line(ops, qty_day=120, days_month=250 / 12, shifts=2, h_shift=7.5, oee=0.75, buffer=4, sigma=0.05):
    """Flow line of the screw-shaft route. Machine count per type as in the factory design: ceil(load / (avail × OEE)).
    Operations on the same machine type are merged (sequential use of the same machines)."""
    hours = shifts * h_shift * days_month
    merged = {}
    for o in ops:
        eff = o['cyc_min'] + o['setup'] / o['batch']            # min per piece incl. set-up share
        d = merged.setdefault(o['m'], {'eff': 0.0, 'scrap': 0.0, 'ops': []})
        d['eff'] += eff
        d['scrap'] = 1 - (1 - d['scrap']) * (1 - o['scrap'])
        d['ops'].append(o['no'])
    line, table = [], []
    for m, d in merged.items():
        shift_factor = 1.5 if m.startswith('HT-') else 1.0      # heat treatment runs 3 shifts
        need = qty_day * d['eff'] / (shifts * h_shift * 60 * shift_factor * oee)
        c = max(1, math.ceil(need - 1e-9))
        mtbf, mttr = MTBF_EST[m]
        t = d['eff'] * 60 / shift_factor                        # seconds per piece in 2-shift equivalent
        line.append(flowline.Station(m, c, buffer, {'G': t}, 1.0, sigma, mtbf, mttr / 60, d['scrap']))
        table.append({'type': m, 'ops': '+'.join(d['ops']), 'min_per_piece': round(d['eff'], 2), 'need': round(need, 2), 'c': c,
                      'mtbf_h': mtbf, 'mttr_min': mttr, 'scrap_pct': round(100 * d['scrap'], 2)})
    return line, table, hours


def bs_capacity(line, hours):
    out = []
    for st in line:
        A = st.mtbf_h / (st.mtbf_h + st.mttr_h)
        out.append((st.name, st.c * A * 3600 * hours / st.tdesign['G'] * (1 - st.scrap)))
    return out


def bs_scenario(args):
    """Chapter-6 style virtual ramp-up on the ball screw line: B0 vs P07 vs P07D (discrepancy) + bottleneck hit."""
    seed, n_theta = args
    rng = random.Random(seed)
    ops = bs_route()
    design, _, hours = bs_line(ops)
    mix = {'G': 1.0}
    trng = random.Random(30_000 + seed)
    truth = [{'f_mtbf': trng.uniform(0.6, 1.1), 'f_mttr': trng.uniform(1.0, 1.5), 'f_speed': trng.uniform(0.98, 1.12),
              'sigma': trng.uniform(0.04, 0.10), 'f_scrap': trng.uniform(1.0, 2.0)} for _ in design]

    def true_line(k):
        r = math.exp(-(k - 1) / 2.0)
        return [flowline.Station(st.name, st.c, st.buffer, st.tdesign, t['f_speed'] * (1 + 0.08 * r), t['sigma'],
                                 st.mtbf_h * t['f_mtbf'] * (1 - 0.5 * r), st.mttr_h * t['f_mttr'] * (1 + 0.5 * r),
                                 min(0.5, max(st.scrap, 0.001) * t['f_scrap'] * (1 + 2 * math.exp(-(k - 1) / 1.5))))
                for st, t in zip(design, truth)]

    def cap(line):
        return [st.c * st.mtbf_h / (st.mtbf_h + st.mttr_h) * 3600 * hours / (st.tdesign['G'] * st.speed) * (1 - st.scrap) for st in line]

    b0 = statistics.mean(flowline.simulate(design, mix, hours, rng)[0] for _ in range(10))
    bel = [StationBelief(st, 1.0) for st in design]

    def pred():
        vals = [flowline.simulate([b.sample(st, rng) for b, st in zip(bel, design)], mix, hours, rng)[0] for _ in range(n_theta)]
        v = sorted(vals)
        return statistics.mean(v), v[int(0.05 * len(v))], v[int(0.95 * len(v)) - 1]
    p07 = pred()
    dm, dk, da, db = 0.0, 1.0, 2.0, 0.05 ** 2
    rows = []
    for k in range(1, 13):
        tl = true_line(k)
        y, obs, _ = flowline.simulate(tl, mix, hours, rng, record=True)
        scale = math.sqrt(db * (dk + 1) / (da * dk))
        smc = math.log(p07[2] / p07[1]) / 3.29 if p07[1] > 0 else 0.0
        half = (1.7 if da >= 10 else 1.9 if da >= 4 else 2.3) * math.sqrt(smc ** 2 + scale ** 2)
        c = p07[0] * math.exp(dm)
        capt = cap(tl)
        capb = cap([flowline.Station(st.name, st.c, st.buffer, st.tdesign, b.cyc.mean_time(), 0.05, b.fail.mtbf_mean(),
                                     b.rep.mttr_mean(), b.scrap.mean()) for st, b in zip(design, bel)])
        capd = cap(design)
        bt = min(range(len(capt)), key=lambda j: capt[j])
        rows.append({'scenario': seed, 'month': k, 'truth': y, 'B0': b0, 'P07': p07[0], 'P07D': c,
                     'P07D_lo': c * math.exp(-half), 'P07D_hi': c * math.exp(half),
                     'bn_true': design[bt].name, 'bn_twin': design[min(range(len(capb)), key=lambda j: capb[j])].name,
                     'bn_design': design[min(range(len(capd)), key=lambda j: capd[j])].name})
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


def main():
    os.makedirs(DATA, exist_ok=True)
    stg.calibrate_eta()
    out = {}
    print('== Case 1a: frozen design prediction P0')
    out['case1_P0'] = case1_frozen_prediction()
    print(out['case1_P0'])
    print('== Case 1b: staging decision + sensitivity')
    sens = case1_sensitivity()
    out['case1_sensitivity'] = [{'case': a, 'plan': [list(x) for x in p], 'dnpv_M': round(v / 1e6, 3)} for a, p, v in sens]
    for r in out['case1_sensitivity']:
        print(f"{r['case']:28} {r['plan']} {r['dnpv_M']}")
    print('== Case 1c: gateway sizing (16 stations + 4 AGVs + 2 AS/RS cranes + 3 conveyors/transfers = 25 devices)')
    out['case1_sizing'] = sizing(25, 0.25)
    print(out['case1_sizing'])
    print('== Case 2a: ball screw shaft line')
    ops = bs_route()
    line, table, hours = bs_line(ops)
    out['case2_route'] = ops
    out['case2_table'] = table
    out['case2_hours'] = hours
    cap = bs_capacity(line, hours)
    out['case2_capacity'] = [[n, round(c)] for n, c in cap]
    for t, (n, c) in zip(table, cap):
        print(t, round(c))
    rng = random.Random(3)
    des = [flowline.simulate(line, {'G': 1.0}, hours, rng)[0] for _ in range(10)]
    out['case2_des_mean'] = round(statistics.mean(des))
    print('DES good shafts / month (design):', out['case2_des_mean'], 'target', round(120 * 250 / 12))
    print('== Case 2b: transfer test (20 scenarios)')
    with Pool(15) as p:
        res = p.map(bs_scenario, [(s, 30) for s in range(1, 21)])
    rows = [r for x in res for r in x]
    out['case2_rampup'] = rows
    for k in range(1, 13):
        rr = [r for r in rows if r['month'] == k]
        e = lambda m: 100 * statistics.mean(abs(r[m] - r['truth']) / r['truth'] for r in rr)
        cov = 100 * statistics.mean(r['P07D_lo'] <= r['truth'] <= r['P07D_hi'] for r in rr)
        hit_t = 100 * statistics.mean(r['bn_twin'] == r['bn_true'] for r in rr)
        hit_d = 100 * statistics.mean(r['bn_design'] == r['bn_true'] for r in rr)
        print(f"{k:2d} truth {statistics.mean(r['truth'] for r in rr):7.0f}  B0 {e('B0'):5.1f}  P07 {e('P07'):5.1f}  P07D {e('P07D'):5.1f} cov {cov:5.1f}  BN twin {hit_t:4.0f} design {hit_d:4.0f}")
    print('== Case 2c: gateway sizing (73 machines of the ball screw + guide factory)')
    out['case2_sizing'] = sizing(73, 0.25)
    out['case2_sizing_seq_1s'] = sizing(73, 1.0)
    print(out['case2_sizing'], out['case2_sizing_seq_1s'])
    json.dump(out, open(os.path.join(DATA, 'case_study.json'), 'w'), indent=1, default=str)
    print('written data/case_study.json')


if __name__ == '__main__':
    main()
