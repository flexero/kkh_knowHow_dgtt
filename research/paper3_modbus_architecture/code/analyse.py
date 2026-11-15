"""Paper 3 - analysis of all raw records -> ../data/results.json + Markdown tables printed for Section 6.

    python analyse.py
"""
import json
import math
import os
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
sys.path.insert(0, HERE)
from sizing_model import loss_fraction, p_overflow, state_only_reported, mc_mix  # noqa: E402

T975 = {2: 12.706, 3: 4.303, 4: 3.182, 5: 2.776, 6: 2.571, 7: 2.447, 8: 2.365}


def load(name):
    p = os.path.join(DATA, name)
    return [json.loads(l) for l in open(p, encoding='utf-8')] if os.path.exists(p) else []


def mci(v):
    v = [x for x in v if x is not None]
    if not v:
        return None, None
    m = statistics.mean(v)
    return m, (T975.get(len(v), 1.96) * statistics.stdev(v) / math.sqrt(len(v)) if len(v) > 1 else 0.0)


def fmt(m, h, d=1):
    return f'{m:.{d}f} ± {h:.{d}f}' if m is not None else '–'


def e2():
    runs = load('e2_replication.jsonl')
    tags = []
    for r in runs:
        if r['tag'] not in tags:
            tags.append(r['tag'])
    rows = []
    for t in tags:
        rs = [r for r in runs if r['tag'] == t]
        r0 = rs[0]
        ev = sum(r['events'] for r in rs)
        row = {'tag': t, 'N': r0['n'], 'mode': r0['mode'], 'P': r0['period'], 'scan': r0['scan'], 'seeds': len(rs),
               'events': ev, 'R_lost': sum(r['R_lost'] for r in rs), 'R_wrong': sum(r['R_wrong'] for r in rs),
               'cycle': mci([r['cycle_mean_ms'] for r in rs]), 'rate': mci([r['actual_rate_hz'] for r in rs]),
               'rtt_mean': mci([r['rtt_mean_ms'] for r in rs]), 'rtt_med': mci([r['rtt_pctl_ms']['0.5'] for r in rs]),
               'rtt_p99': mci([r['rtt_pctl_ms']['0.99'] for r in rs]),
               'S': mci([100 * r['S_share_reported'] for r in rs]), 'lat_mean': mci([r['lat_mean_s'] for r in rs]),
               'lat_p95': mci([r['lat_pctl_s']['0.95'] for r in rs]), 'lat_max': max(r['lat_max_s'] for r in rs),
               'cpu': mci([100 * r['cpu_busy_system'] for r in rs if r.get('cpu_busy_system') is not None]),
               'tserr_max_ms': max(r['tserr_max_ms'] or 0 for r in rs)}
        peff = 1 / row['rate'][0]
        row['P_eff'] = peff
        row['S_model_mc'] = 100 * mc_mix(peff, horizon=100000.0, seed=3)[0]
        row['cycle_model_seq'] = r0['n'] * row['rtt_mean'][0] if r0['mode'] == 'seq' else None
        row['cycle_model_par'] = 1.05 + r0['scan'] * r0['n'] / (r0['n'] + 1) + 0.013 * r0['n'] if r0['mode'] == 'par' else None
        row['lat_model_mean'] = peff / 2 + row['rtt_mean'][0] / 1000
        rows.append(row)
    tot_ev = sum(r['events'] for r in rows)
    tot_lost = sum(r['R_lost'] for r in rows)
    out = {'rows': rows, 'runs': len(runs), 'events_total': tot_ev, 'lost_total': tot_lost,
           'wrong_total': sum(r['R_wrong'] for r in rows),
           'loss_upper95': 1 - 0.05 ** (1 / tot_ev) if tot_ev and tot_lost == 0 else None,
           'cpu_range': (min(r['cpu_busy_system'] for r in runs) * 100, max(r['cpu_busy_system'] for r in runs) * 100) if runs else None}
    print('\nE2 replication (mean ± 95 % CI over seeds)')
    print('| N | Gateway | P [s] | t_scan [ms] | Runs | Cycle [ms] (model) | Achieved rate [Hz] | RTT median / p99 [ms] | Events | Event block: lost | State-only reported [%] (model) | Latency mean / p95 / max [s] |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|')
    for r in rows:
        mod = r['cycle_model_seq'] or r['cycle_model_par']
        print(f"| {r['N']} | {'sequential' if r['mode'] == 'seq' else 'parallel'} | {r['P']} | {r['scan']:.0f} | {r['seeds']} | "
              f"{fmt(*r['cycle'])} ({mod:.1f}) | {fmt(*r['rate'], 3)} | {r['rtt_med'][0]:.2f} / {r['rtt_p99'][0]:.2f} | {r['events']} | "
              f"{r['R_lost']} | {fmt(*r['S'])} ({r['S_model_mc']:.1f}) | {r['lat_mean'][0]:.3f} / {r['lat_p95'][0]:.3f} / {r['lat_max']:.3f} |")
    print('total events', tot_ev, 'lost', tot_lost, 'upper95', out['loss_upper95'], 'cpu range', out['cpu_range'])
    return out


def e3():
    runs = load('e3_lossmodel.jsonl')
    rows = []
    for r in sorted(runs, key=lambda r: (r['lam'], r['period'])):
        cnt = {int(k): v for k, v in r['interval_counts'].items()}
        n_int = sum(cnt.values())
        mean = sum(k * v for k, v in cnt.items()) / n_int
        var = sum(v * (k - mean) ** 2 for k, v in cnt.items()) / (n_int - 1)
        lost_counter = sum(v * max(0, k - r['ring']) for k, v in cnt.items())
        ovf = sum(v for k, v in cnt.items() if k > r['ring'])
        rows.append({'lam': r['lam'], 'P': r['period'], 'mu_nominal': r['lam'] * r['period'], 'mu_hat': mean,
                     'dispersion': var / mean, 'intervals': n_int, 'events': r['events'], 'lost_identity': r['R_lost'],
                     'lost_counter': lost_counter, 'wrong': r['R_wrong'], 'loss_obs': r['R_lost'] / r['events'],
                     'loss_model': loss_fraction(mean, r['ring']), 'ovf_obs': ovf / n_int, 'ovf_model': p_overflow(mean, r['ring']),
                     'S_obs': r['S_share_reported'], 'S_model': state_only_reported(mean),
                     'cpu': 100 * r['cpu_busy_system'] if r.get('cpu_busy_system') is not None else None,
                     'lam_measured': r['lam_measured']})
    print('\nE3 loss model validation')
    print('| λ [1/s] | P [s] | μ̂ (dispersion) | Intervals | Events | Lost (identity / counter) | Loss share obs / Eq. 11 | Overflow share obs / Eq. 10 | State-only reported obs / Eq. 9 |')
    print('|---|---|---|---|---|---|---|---|---|')
    for x in rows:
        print(f"| {x['lam']:.0f} | {x['P']:.4g} | {x['mu_hat']:.2f} ({x['dispersion']:.2f}) | {x['intervals']} | {x['events']} | "
              f"{x['lost_identity']} / {x['lost_counter']} | {x['loss_obs']:.4f} / {x['loss_model']:.4f} | {x['ovf_obs']:.4f} / {x['ovf_model']:.4f} | "
              f"{x['S_obs']:.3f} / {x['S_model']:.3f} |")
    if rows:
        print('max |S_obs - S_model|', max(abs(x['S_obs'] - x['S_model']) for x in rows))
        print('max |loss_obs - loss_model|', max(abs(x['loss_obs'] - x['loss_model']) for x in rows))
    return {'rows': rows}


def http():
    p = os.path.join(DATA, 'http_bench_rep.json')
    if not os.path.exists(p):
        return None
    d = json.load(open(p, encoding='utf-8'))
    print('\nHTTP (mean ± 95 % CI over', d['reps'], 'repetitions)')
    for k, s in d['summary'].items():
        print(f"| {k} | {fmt(s['req_per_s']['mean'], s['req_per_s']['ci95'], 0)} | {fmt(s['median_ms']['mean'], s['median_ms']['ci95'], 2)} | {fmt(s['p99_ms']['mean'], s['p99_ms']['ci95'], 2)} |")
    return d['summary']


def handshake():
    out = {}
    p = os.path.join(DATA, 'handshake_latency.json')
    if os.path.exists(p):
        d = json.load(open(p, encoding='utf-8'))
        print('\nHandshake latency')
        for r in d['runs']:
            print(f"| {r['sequence']} | {r['scan_ms']:.0f} | {r['ack_poll_ms']:.0f} | {r['frames_mean']:.2f} ({r['frames_before_req_mean']:.2f}) | "
                  f"{fmt(r['write_phase']['mean_ms'], r['write_phase']['ci95_ms'], 2)} | {fmt(r['ack_phase']['mean_ms'], r['ack_phase']['ci95_ms'], 2)} | "
                  f"{fmt(r['total']['mean_ms'], r['total']['ci95_ms'], 2)} | {r['total']['median_ms']:.2f} / {r['total']['p95_ms']:.2f} / {r['total']['max_ms']:.2f} |")
        print('rtt', {k: v for k, v in d.items() if k.startswith('rtt')})
        out['latency'] = d
    p = os.path.join(DATA, 'handshake_faults.json')
    if os.path.exists(p):
        d = json.load(open(p, encoding='utf-8'))
        print('\nFault injection')
        for c in d['cases']:
            print(c)
        out['faults'] = d
    return out


def acceptance():
    p = os.path.join(DATA, 'acceptance.json')
    if not os.path.exists(p):
        return None
    d = json.load(open(p, encoding='utf-8'))
    print('\nAcceptance', d['total_passed'], '/', d['total_checks'], {k: (v['passed'], v['checks']) for k, v in d['tests'].items()})
    return d


def timing():
    p = os.path.join(DATA, 'timing_calib.json')
    if not os.path.exists(p):
        return None
    d = json.load(open(p, encoding='utf-8'))
    print('\nTiming calibration')
    for c in d['cases']:
        print(json.dumps(c)[:900])
    return d


if __name__ == '__main__':
    res = {'e2': e2(), 'e3': e3(), 'http': http(), 'handshake': handshake(), 'acceptance': acceptance(), 'timing': timing()}
    json.dump(res, open(os.path.join(DATA, 'results.json'), 'w', encoding='utf-8'), indent=1, default=str)
