"""Laboratory measurement campaign of chapter 5 (edition 2): orchestrates plant, broker, gateway, twin (and proxy) as
separate processes on one PC, then evaluates every run against the logged truth.

    thesis_modern\\.venv\\Scripts\\python.exe campaign.py <block> [--seeds 1,2,3] [--dur 60]
blocks:
  smoke     one short run of every component (sanity check)
  complete  (i)   completeness vs event rate: 21 devices, rate x1 / x4 / x16, OPC UA subscriptions in parallel:
                  data change queue 1 at 1000 / 250 / 100 ms, queue 10 at 1000 ms, sampled variable (100 ms) queue 10,
                  events at 100 / 1000 ms
  mqtt      (i)   OPC UA events -> Sparkplug -> twin with a broker restart (5 s down) for QoS 0 / 1 / 2, with and
                  without store-and-forward, plus a no-restart reference
  scale     (ii, iv) 21 / 50 / 100 devices, single server vs one server per device, OPC UA -> MQTT (QoS 1) -> twin
  bytes     (iii) bytes on the wire through counting relays, plain and secured
  secure    (v)   OPC UA SignAndEncrypt Basic256Sha256 + MQTT over TLS vs unsecured (latency, CPU, set-up time)
Raw data: data/modern/raw/<block>/<run>/ ; summaries: data/modern/<block>.json
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import shutil
import subprocess
import sys
import time

import common
from common import DATA, RAW, dump, load, mean_ci, pct, wilson

PY = sys.executable
HERE = common.HERE


def popen(script, args, out):
    log = open(os.path.join(out, script.replace('.py', '.log')), 'w')
    return subprocess.Popen([PY, os.path.join(HERE, script)] + [str(x) for x in args], cwd=HERE, stdout=log, stderr=subprocess.STDOUT)


def run_one(block, cfg):
    name = cfg['name']
    out = os.path.join(RAW, block, name)
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(out)
    n, dur = cfg['n'], cfg['dur']
    setup = cfg.get('setup') or ((10 + 0.12 * n) if cfg['topology'] == 'single' else (20 + 1.3 * n)) * (2 if cfg.get('secure') else 1)
    t0 = time.perf_counter() + setup
    end = t0 + dur
    procs = []
    ua_port = None
    mqtt_port_gw = mqtt_port_twin = None
    tls = cfg.get('tls', False)
    base_mqtt = common.MQTT_TLS_PORT if tls else common.MQTT_PORT
    if cfg.get('proxy'):
        pairs = []
        if cfg['topology'] == 'single':
            pairs.append(f'48900:{common.UA_SINGLE}')
            ua_port = 48900
        else:
            pairs += [f'{48700 + i}:{common.UA_PERDEV + i}' for i in range(n)]
            ua_port = 48700
        if cfg.get('mqtt'):
            pairs += [f'18890:{base_mqtt}', f'18891:{base_mqtt}']
            mqtt_port_gw, mqtt_port_twin = 18890, 18891
        procs.append(popen('proxy.py', ['--pairs', ','.join(pairs), '--t0', t0, '--dur', dur, '--grace', 8, '--out', out], out))
    if cfg.get('mqtt'):
        bargs = ['--until', end + 9, '--t0', t0, '--dur', dur, '--out', out] + (['--tls'] if tls else [])
        if cfg.get('restart'):
            bargs += ['--restart_at', t0 + dur * 0.5, '--down', cfg.get('down', 5)]
        procs.append(popen('broker.py', bargs, out))
    pargs = ['gen', '--n', n, '--topology', cfg['topology'], '--rate', cfg.get('rate', 1), '--seed', cfg['seed'],
             '--t0', t0, '--dur', dur, '--grace', 6, '--out', out] + (['--secure'] if cfg.get('secure') else [])
    procs.append(popen('vplant_ua.py', pargs, out))
    time.sleep(1.0)
    if cfg.get('mqtt'):
        targs = ['--n', n, '--qos', cfg.get('qos', 1), '--t0', t0, '--dur', dur, '--grace', 7, '--out', out] + (['--tls'] if tls else [])             + ([] if cfg.get('replay', True) else ['--no-replay'])
        if mqtt_port_twin:
            targs += ['--port', mqtt_port_twin]
        procs.append(popen('twin_sub.py', targs, out))
    gargs = ['--n', n, '--topology', cfg['topology'], '--t0', t0, '--dur', dur, '--grace', 4, '--out', out, '--subs', cfg.get('subs', '')]
    if ua_port:
        gargs += ['--ua_port', ua_port]
    if cfg.get('secure'):
        gargs.append('--secure')
    if cfg.get('mqtt'):
        gargs += ['--mqtt', '--qos', cfg.get('qos', 1)] + (['--sf'] if cfg.get('sf', True) else []) + (['--tls'] if tls else [])
        if mqtt_port_gw:
            gargs += ['--mqtt_port', mqtt_port_gw]
    # wait for the plant to be up before the gateway connects
    t_wait = time.perf_counter() + setup
    while not os.path.exists(os.path.join(out, 'plant.ready')) and time.perf_counter() < t_wait:
        time.sleep(0.1)
    procs.append(popen('gateway.py', gargs, out))
    for p in procs:
        try:
            p.wait(timeout=setup + dur + 60)
        except subprocess.TimeoutExpired:
            p.kill()
    s = evaluate(out, cfg)
    dump(os.path.join(out, 'summary.json'), s)
    return s


# ====================================================================== evaluation
def lat_stats(xs):
    if not xs:
        return None
    return {'n': len(xs), 'mean': sum(xs) / len(xs), 'p50': pct(xs, 50), 'p95': pct(xs, 95), 'p99': pct(xs, 99), 'max': max(xs)}


def evaluate(out, cfg):
    s = {'cfg': cfg}
    try:
        tr = load(os.path.join(out, 'truth.json'))
        gw = load(os.path.join(out, 'gateway.json'))
    except FileNotFoundError as e:
        s['error'] = f'missing {e.filename}'
        return s
    truth = {(i, k): t for i, k, st, t in tr['events']}
    by_us = {(i, round(t * 1e6)): k for i, k, st, t in tr['events']}
    s['events'] = len(truth)
    s['valid'] = gw['subscribed_at'] < tr['t0']
    s['plant'] = {k: tr[k] for k in ('build_s', 'cpu_s', 'wall_s', 'ws_mb', 'peak_mb')}
    s['gateway'] = {k: gw[k] for k in ('connect_s', 'subscribe_s', 'sessions', 'cpu_s', 'wall_s', 'ws_mb', 'peak_mb')}
    s['gateway']['cpu_pct'] = 100 * gw['cpu_s'] / gw['wall_s']
    subs = {}
    for label, rows in gw['recv'].items():
        first = {}
        if label.startswith('dc:'):
            for i, src, t in rows:
                if src is None:
                    continue
                k = by_us.get((i, round(src * 1e6)))
                if k is not None and (i, k) not in first:
                    first[(i, k)] = t
            nrec = len(rows)
        else:
            for i, k, src, t in rows:
                if (i, k) in truth and (i, k) not in first:
                    first[(i, k)] = t
            nrec = len(rows)
        got = len(first)
        lo, hi = wilson(got, len(truth))
        subs[label] = {'delivered': got, 'completeness': got / len(truth) if truth else None, 'wilson95': [lo, hi],
                       'notifications': nrec, 'latency': lat_stats([first[x] - truth[x] for x in first])}
    s['subs'] = subs
    if cfg.get('mqtt'):
        try:
            tw = load(os.path.join(out, 'twin.json'))
        except FileNotFoundError:
            s['error'] = 'missing twin.json'
            return s
        first, dup, hist = {}, 0, 0
        for i, k, t, h in tw['recv']:
            if (i, k) in first:
                dup += 1
                continue
            if (i, k) in truth:
                first[(i, k)] = t
                hist += 1 if h else 0
        got = len(first)
        lo, hi = wilson(got, len(truth))
        missing = sorted(set(truth) - set(first), key=lambda x: truth[x])
        s['twin'] = {'delivered': got, 'completeness': got / len(truth), 'wilson95': [lo, hi], 'duplicates': dup,
                     'historical': hist, 'latency': lat_stats([first[x] - truth[x] for x in first]),
                     'stats': tw['stats'], 'bytes_app': tw['bytes_app'], 'cpu_s': tw['cpu_s'], 'ws_mb': tw['ws_mb'],
                     'missing_times': [round(truth[x] - tr['t0'], 3) for x in missing[:50]]}
        s['mqtt'] = gw.get('mqtt')
        try:
            s['broker'] = load(os.path.join(out, 'broker.json'))
            for ev in s['broker']['events']:
                ev.append(round(ev[1] - tr['t0'], 3))
        except FileNotFoundError:
            pass
    if cfg.get('proxy'):
        try:
            px = load(os.path.join(out, 'proxy.json'))
            s['proxy'] = px
        except FileNotFoundError:
            pass
    return s


# ====================================================================== blocks
DC_SUBS = 'dc:FmsState:q1:p1000,dc:FmsState:q1:p250,dc:FmsState:q1:p100,dc:FmsState:q10:p1000,dc:FmsStateSampled:q10:p1000,ev:q0:p100,ev:q0:p1000'


def block_cfgs(block, seeds, dur):
    cf = []
    if block == 'smoke':
        cf.append(dict(name='smoke_ua', n=21, topology='single', seed=1, dur=15, subs=DC_SUBS))
        cf.append(dict(name='smoke_mqtt', n=21, topology='single', seed=1, dur=15, subs='', mqtt=True, qos=1, sf=True, restart=True, down=3))
    elif block == 'complete':
        for rate in (1, 4, 16):
            for s in seeds:
                cf.append(dict(name=f'r{rate}_s{s}', n=21, topology='single', rate=rate, seed=s, dur=dur, subs=DC_SUBS))
    elif block == 'mqtt':
        for qos, sf, rp, restart in ((1, True, True, False), (0, False, False, True), (0, True, False, True), (1, True, False, True),
                                     (2, True, False, True), (1, True, True, True), (0, True, True, True)):
            for s in seeds:
                cf.append(dict(name=f'q{qos}_{"sf" if sf else "nosf"}_{"rp" if rp else "norp"}_{"restart" if restart else "steady"}_s{s}',
                               n=21, topology='single', seed=s, dur=dur, subs='', mqtt=True, qos=qos, sf=sf, replay=rp,
                               restart=restart, down=5))
    elif block == 'scale':
        for topo in ('single', 'perdev'):
            for n in (21, 50, 100):
                for s in seeds:
                    cf.append(dict(name=f'{topo}_n{n}_s{s}', n=n, topology=topo, seed=s, dur=dur, subs='', mqtt=True, qos=1, sf=True))
    elif block == 'bytes':
        for sec in (False, True):
            for s in seeds:
                cf.append(dict(name=f'{"sec" if sec else "plain"}_s{s}', n=21, topology='single', seed=s, dur=dur, subs='',
                               mqtt=True, qos=1, sf=True, proxy=True, secure=sec, tls=sec))
    elif block == 'secure':
        for sec in (False, True):
            for s in seeds:
                cf.append(dict(name=f'{"sec" if sec else "plain"}_s{s}', n=21, topology='single', seed=s, dur=dur, subs='',
                               mqtt=True, qos=1, sf=True, secure=sec, tls=sec))
    return cf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('block')
    ap.add_argument('--seeds', default='1,2,3')
    ap.add_argument('--dur', type=float, default=60)
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    seeds = [int(x) for x in a.seeds.split(',')]
    path = os.path.join(DATA, f'{a.block}.json')
    res = load(path) if (a.only and os.path.exists(path)) else []
    for cfg in block_cfgs(a.block, seeds, a.dur):
        if a.only and a.only not in cfg['name']:
            continue
        t = time.perf_counter()
        s = run_one(a.block, cfg)
        res = [r for r in res if r['cfg']['name'] != cfg['name']] + [s]
        brief = {k: (round(v['completeness'], 4) if v.get('completeness') is not None else None) for k, v in s.get('subs', {}).items()}
        if 'twin' in s:
            brief['twin'] = round(s['twin']['completeness'], 4)
            brief['twin_p95_ms'] = round(1000 * s['twin']['latency']['p95'], 1) if s['twin']['latency'] else None
        print(f"{cfg['name']:28} {time.perf_counter() - t:5.0f} s  events {s.get('events')} valid {s.get('valid')} {s.get('error', '')} {json.dumps(brief)}", flush=True)
        dump(path, res)


if __name__ == '__main__':
    main()
