"""Aggregates the campaign blocks (data/modern/<block>.json) and the command bench into data/modern/results.json and
prints the tables of chapter 5 (Markdown). Means over the 3 seeds with 95 % t intervals; latencies in ms.
    thesis_modern\\.venv\\Scripts\\python.exe analyse_modern.py
"""
from __future__ import annotations

import collections
import json
import math
import os

from common import DATA, dump, load, mean_ci, wilson

WIRE_PER_SEGMENT = 78 + 84      # Ethernet/IP/TCP framing of a data segment + one acknowledgement frame (edition-1 Eq. 5.1)


def blk(name):
    p = os.path.join(DATA, f'{name}.json')
    return load(p) if os.path.exists(p) else []


def mc(xs, scale=1.0):
    xs = [x * scale for x in xs if x is not None]
    m, h = mean_ci(xs)
    return {'mean': m, 'ci': h, 'min': min(xs) if xs else None, 'max': max(xs) if xs else None, 'n': len(xs)}


def group(rows, key):
    g = collections.defaultdict(list)
    for r in rows:
        if r.get('error') or not r.get('valid', False):
            continue
        g[key(r)].append(r)
    return g


def predicted_loss(rate, window, q=1, sample=None, horizon=200000.0, seed=5):
    """Model of section 5.5.4 by Monte Carlo of the edition-1 dwell process (30 % U(0.05,0.5) s, 70 % Exp(5 s), / rate):
    a data-change item with queue size q delivers at most q changes per publishing window; a sampled item sees a change
    only if the state still holds at the next sampling instant. Returns the expected share of changes NOT delivered."""
    import random
    r = random.Random(seed)
    t, times = 0.0, []
    while t < horizon / rate:
        t += (r.uniform(0.05, 0.5) if r.random() < 0.3 else r.expovariate(0.2)) / rate
        times.append(t)
    lost = 0
    if sample:
        nxt = times[1:] + [times[-1] + 1e9]
        for a, b in zip(times, nxt):
            if math.floor(b / sample) == math.floor(a / sample):      # next change before the next sampling instant
                lost += 1
        seen = len(times) - lost
        # sampled values then pass a queue of size q per window
        counts = collections.Counter()
        for a, b in zip(times, nxt):
            if math.floor(b / sample) != math.floor(a / sample):
                counts[math.floor(a / window)] += 1
        lost += sum(max(0, c - q) for c in counts.values())
        return lost / len(times)
    counts = collections.Counter(math.floor(x / window) for x in times)
    return sum(max(0, c - q) for c in counts.values()) / len(times)


def complete():
    out = {}
    for rate, rs in sorted(group(blk('complete'), lambda r: r['cfg']['rate']).items()):
        d = {'runs': len(rs), 'events': mc([r['events'] for r in rs]),
             'events_per_dev_s': mc([r['events'] / (21 * r['cfg']['dur']) for r in rs])}
        tot_true = sum(r['events'] for r in rs)
        for label in rs[0]['subs']:
            got = sum(r['subs'][label]['delivered'] for r in rs)
            lo, hi = wilson(got, tot_true)
            d[label] = {'completeness': mc([r['subs'][label]['completeness'] for r in rs], 100),
                        'pooled': [got, tot_true], 'wilson_lo_pct': 100 * lo,
                        'lat_p50_ms': mc([r['subs'][label]['latency']['p50'] for r in rs], 1000),
                        'lat_p95_ms': mc([r['subs'][label]['latency']['p95'] for r in rs], 1000),
                        'lat_max_ms': mc([r['subs'][label]['latency']['max'] for r in rs], 1000),
                        'notifications': mc([r['subs'][label]['notifications'] for r in rs])}
        d['gw_cpu_pct'] = mc([r['gateway']['cpu_pct'] for r in rs])
        model = {'dc:FmsState:q1:p1000': (1.0, 1, None), 'dc:FmsState:q1:p250': (0.25, 1, None), 'dc:FmsState:q1:p100': (0.1, 1, None),
                 'dc:FmsState:q10:p1000': (1.0, 10, None), 'dc:FmsStateSampled:q10:p1000': (1.0, 10, 0.1)}
        for k, (wnd, q, smp) in model.items():
            if k in d:
                d[k]['model_pct'] = 100 * (1 - predicted_loss(float(rate), wnd, q, smp))
        out[str(rate)] = d
    return out


def mqtt():
    out = {}
    for name, rs in group(blk('mqtt'), lambda r: r['cfg']['name'].rsplit('_s', 1)[0]).items():
        tot = sum(r['events'] for r in rs)
        got = sum(r['twin']['delivered'] for r in rs)
        lo, hi = wilson(got, tot)
        out[name] = {'runs': len(rs), 'completeness': mc([r['twin']['completeness'] for r in rs], 100), 'pooled': [got, tot],
                     'wilson_lo_pct': 100 * lo, 'lost': sum(r['events'] - r['twin']['delivered'] for r in rs),
                     'duplicates': sum(r['twin']['duplicates'] for r in rs), 'historical': sum(r['twin']['historical'] for r in rs),
                     'replay_requests': sum(r['twin']['stats'].get('replay_requests', 0) for r in rs),
                     'ua_completeness': mc([r['subs']['mqtt-ev']['completeness'] for r in rs], 100),
                     'lat_p50_ms': mc([r['twin']['latency']['p50'] for r in rs], 1000),
                     'lat_p95_ms': mc([r['twin']['latency']['p95'] for r in rs], 1000),
                     'lat_max_ms': mc([r['twin']['latency']['max'] for r in rs], 1000),
                     'missing_times': [r['twin']['missing_times'][:10] for r in rs],
                     'broker_events': [r.get('broker', {}).get('events') for r in rs]}
    return out


def e2e_row(rs):
    return {'runs': len(rs), 'events': mc([r['events'] for r in rs]),
            'twin_completeness': mc([r['twin']['completeness'] for r in rs], 100),
            'pooled': [sum(r['twin']['delivered'] for r in rs), sum(r['events'] for r in rs)],
            'ua_p50_ms': mc([r['subs']['mqtt-ev']['latency']['p50'] for r in rs], 1000),
            'ua_p95_ms': mc([r['subs']['mqtt-ev']['latency']['p95'] for r in rs], 1000),
            'e2e_mean_ms': mc([r['twin']['latency']['mean'] for r in rs], 1000),
            'e2e_p50_ms': mc([r['twin']['latency']['p50'] for r in rs], 1000),
            'e2e_p95_ms': mc([r['twin']['latency']['p95'] for r in rs], 1000),
            'e2e_p99_ms': mc([r['twin']['latency']['p99'] for r in rs], 1000),
            'e2e_max_ms': mc([r['twin']['latency']['max'] for r in rs], 1000),
            'gw_cpu_pct': mc([r['gateway']['cpu_pct'] for r in rs]),
            'gw_ws_mb': mc([r['gateway']['ws_mb'] for r in rs]),
            'gw_connect_s': mc([r['gateway']['connect_s'] for r in rs]),
            'gw_subscribe_s': mc([r['gateway']['subscribe_s'] for r in rs]),
            'plant_ws_mb': mc([r['plant']['ws_mb'] for r in rs]),
            'plant_build_s': mc([r['plant']['build_s'] for r in rs]),
            'plant_cpu_pct': mc([100 * r['plant']['cpu_s'] / r['plant']['wall_s'] for r in rs]),
            'broker_cpu_pct': mc([100 * r['broker']['cpu_s'] / r['cfg']['dur'] for r in rs if r.get('broker', {}).get('cpu_s') is not None]),
            'broker_ws_mb': mc([r['broker']['ws_mb'] for r in rs if r.get('broker')]),
            'twin_cpu_pct': mc([100 * r['twin']['cpu_s'] / r['cfg']['dur'] for r in rs]),
            'msgs_per_s': mc([r['mqtt']['stats'].get('published', 0) / r['cfg']['dur'] for r in rs])}


def scale():
    out = collections.defaultdict(dict)
    for (topo, n), rs in group(blk('scale'), lambda r: (r['cfg']['topology'], r['cfg']['n'])).items():
        out[topo][str(n)] = e2e_row(rs)
    return dict(out)


def secure():
    out = {}
    for sec, rs in group(blk('secure'), lambda r: 'secured' if r['cfg'].get('secure') else 'plain').items():
        out[sec] = e2e_row(rs)
    return out


def nbytes():
    out = {}
    for sec, rs in group(blk('bytes'), lambda r: 'secured' if r['cfg'].get('secure') else 'plain').items():
        legs = collections.defaultdict(list)
        for r in rs:
            w, dur, n = r['proxy']['window'], r['cfg']['dur'], r['cfg']['n']
            ua_b = sum(v[0] for k, v in w.items() if k.startswith('489'))
            ua_c = sum(v[1] for k, v in w.items() if k.startswith('489'))
            g_b = sum(v[0] for k, v in w.items() if k.startswith('18890'))
            g_c = sum(v[1] for k, v in w.items() if k.startswith('18890'))
            t_b = sum(v[0] for k, v in w.items() if k.startswith('18891'))
            t_c = sum(v[1] for k, v in w.items() if k.startswith('18891'))
            for leg, b, c in (('opcua', ua_b, ua_c), ('mqtt_gw', g_b, g_c), ('mqtt_twin', t_b, t_c)):
                legs[leg + '_payload'].append(b / dur / n)
                legs[leg + '_wire'].append((b + WIRE_PER_SEGMENT * c) / dur / n)
                legs[leg + '_segments'].append(c / dur / n)
            legs['events_per_dev_s'].append(r['events'] / dur / n)
            legs['ddata_bytes_app'].append(r['mqtt']['bytes_app'] / max(1, r['mqtt']['stats'].get('published', 1)))
        out[sec] = {k: mc(v) for k, v in legs.items()}
    # edition-1 reference (Eq. 5.1): b(n) = 261 + 2n per request
    b = lambda n: 261 + 2 * n
    out['modbus_ed1'] = {'event_block_P1s': b(36), 'event_block_P0.25s': 4 * b(36), 'multirate_eq5_2': 2 * b(12) + 2 * b(28) + b(80) + 0.1 * b(4)}
    return out


def table(rows, head):
    s = '| ' + ' | '.join(head) + ' |\n|' + '---|' * len(head) + '\n'
    for r in rows:
        s += '| ' + ' | '.join(str(x) for x in r) + ' |\n'
    return s


def f(m, d=1, ci=True):
    if m is None or m.get('mean') is None:
        return '–'
    s = f"{m['mean']:.{d}f}"
    if ci and m.get('ci') is not None:
        s += f" ± {m['ci']:.{d}f}"
    return s


def main():
    res = {'complete': complete(), 'mqtt': mqtt(), 'scale': scale(), 'secure': secure(), 'bytes': nbytes()}
    p = os.path.join(DATA, 'cmdbench.json')
    res['cmd'] = load(p) if os.path.exists(p) else None
    p = os.path.join(DATA, 'test_modern.json')
    res['tests'] = {k: v for k, v in load(p).items() if k != 'checks'} if os.path.exists(p) else None
    dump(os.path.join(DATA, 'results.json'), res)
    lab = {'dc:FmsState:q1:p1000': 'data change, queue 1, 1000 ms', 'dc:FmsState:q1:p250': 'data change, queue 1, 250 ms',
           'dc:FmsState:q1:p100': 'data change, queue 1, 100 ms', 'dc:FmsState:q10:p1000': 'data change, queue 10, 1000 ms',
           'dc:FmsStateSampled:q10:p1000': 'sampled 100 ms, queue 10, 1000 ms', 'ev:q0:p1000': 'events, 1000 ms',
           'ev:q0:p100': 'events, 100 ms'}
    rows = []
    for k, t in lab.items():
        row = [t]
        for rate in ('1', '4', '16'):
            d = res['complete'].get(rate, {}).get(k)
            row.append(f"{f(d['completeness'], 2)} (model {d.get('model_pct', 100):.1f})" if d else '–')
        d = res['complete'].get('1', {}).get(k)
        row.append(f"{f(d['lat_p50_ms'], 0, False)} / {f(d['lat_p95_ms'], 0, False)} / {f(d['lat_max_ms'], 0, False)}" if d else '–')
        rows.append(row)
    print(table(rows, ['Subscription', 'x1', 'x4', 'x16', 'latency p50/p95/max x1 [ms]']))
    print({r: (res['complete'][r]['events']['mean'], res['complete'][r]['events_per_dev_s']['mean']) for r in res['complete']})
    rows = []
    for k, d in sorted(res['mqtt'].items()):
        rows.append([k, f"{d['completeness']['mean']:.3f} (min {d['completeness']['min']:.3f})", f"{d['lost']}/{d['pooled'][1]}",
                     d['duplicates'], d['historical'], d['replay_requests'], f(d['lat_p50_ms'], 0, False), f(d['lat_p95_ms'], 0, False), f(d['lat_max_ms'], 0, False)])
    print(table(rows, ['config', 'completeness %', 'lost', 'dup', 'hist', 'replay req', 'p50', 'p95', 'max']))
    rows = []
    for topo, dd in res['scale'].items():
        for n, d in sorted(dd.items(), key=lambda x: int(x[0])):
            rows.append([topo, n, f(d['twin_completeness'], 2, False), f(d['ua_p50_ms'], 0), f(d['e2e_p50_ms'], 0), f(d['e2e_p95_ms'], 0), f(d['e2e_p99_ms'], 0), f(d['e2e_max_ms'], 0, False),
                         f(d['gw_cpu_pct'], 1), f(d['gw_ws_mb'], 0, False), f(d['plant_ws_mb'], 0, False), f(d['plant_build_s'], 1, False), f(d['broker_cpu_pct'], 1, False), f(d['msgs_per_s'], 0, False)])
    print(table(rows, ['topology', 'N', 'compl %', 'UA p50', 'e2e p50', 'p95', 'p99', 'max', 'gw CPU %', 'gw MB', 'plant MB', 'build s', 'broker CPU %', 'msg/s']))
    for sec, d in res['secure'].items():
        print(sec, {k: (round(v['mean'], 3) if v and v.get('mean') is not None else None) for k, v in d.items() if isinstance(v, dict)})
    print(json.dumps({k: {kk: round(vv['mean'], 1) if isinstance(vv, dict) and vv.get('mean') is not None else vv for kk, vv in v.items()} for k, v in res['bytes'].items()}, indent=1))
    print(json.dumps(res['cmd'], indent=1)[:2500] if res['cmd'] else 'no cmdbench')


if __name__ == '__main__':
    main()
