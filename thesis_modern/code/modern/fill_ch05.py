"""Builds thesis_modern/ch05_architecture.md from ch05_template.md and data/modern/results.json (+ mapping summary).
Every measured number in chapter 5 comes from here.     python fill_ch05.py   (system Python, standard library)
"""
from __future__ import annotations

import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
TM = os.path.join(HERE, '..', '..')
DATA = os.path.join(TM, 'data', 'modern')


def load(n):
    with open(os.path.join(DATA, n), encoding='utf-8') as f:
        return json.load(f)


R = load('results.json')
MAP = load('mapping_v12_to_ua.json')['summary']
HZ = load('cpu_hz.json')['hz']


def table(head, rows):
    s = '| ' + ' | '.join(head) + ' |\n|' + '---|' * len(head) + '\n'
    return s + ''.join('| ' + ' | '.join(str(x) for x in r) + ' |\n' for r in rows)


def m(d, k=None, dig=1, ci=True):
    v = d if k is None else d.get(k)
    if not v or v.get('mean') is None:
        return '–'
    s = f"{v['mean']:,.{dig}f}".replace(',', ' ')
    if ci and v.get('ci') is not None and v['n'] > 1:
        s += f" ± {v['ci']:,.{dig}f}".replace(',', ' ')
    return s


def v(d, k, dig=1):
    x = d[k]['mean'] if isinstance(d[k], dict) else d[k]
    return f"{x:,.{dig}f}".replace(',', ' ')


X = {}
# ---------------------------------------------------------------- Table 5.3 mapping counts
names = {'CNC': 'CNC (7 machines)', 'PALLET': 'pallet system', 'LOAD': 'load station', 'STATION': 'station (7)',
         'TEST': 'test bench (2)', 'AGV': 'AGV (2)', 'ASRS': 'AS/RS crane (2)'}
rows, tot = [], [0, 0, 0, 0, 0]
for k, n in names.items():
    s = MAP[k]
    rows.append([n, s['registers'], s['variable'], s['method argument'], s['replaced'], s['unmapped']])
    for j, kk in enumerate(['registers', 'variable', 'method argument', 'replaced', 'unmapped']):
        tot[j] += s[kk]
rows.append(['**sum over the 7 types**', f'**{tot[0]}**', f'**{tot[1]}**', f'**{tot[2]}**', f'**{tot[3]}**', f'**{tot[4]}**'])
X['T_MAPCOUNT'] = table(['Device type', 'Registers used', 'Variables', 'Method arguments', 'Replaced by OPC UA mechanism', 'Unmapped'], rows)

# ---------------------------------------------------------------- Table 5.5 runs
C, Q, S, B, SE = R['complete'], R['mqtt'], R['scale'], R['bytes'], R['secure']
nruns = sum(d['runs'] for d in C.values()) + sum(d['runs'] for d in Q.values()) + sum(d['runs'] for t in S.values() for d in t.values()) \
    + sum(d['runs'] for d in SE.values()) + 6
X['NRUNS'] = str(nruns)
X['T_RUNS'] = table(['Block', 'Question', 'Configurations', 'Runs'], [
    ['complete', '(i) completeness of OPC UA subscriptions vs event rate', '21 devices, rate × 1 / 4 / 16, 7 parallel subscriptions', sum(d['runs'] for d in C.values())],
    ['mqtt', '(i) MQTT QoS, store-and-forward, replay, broker restart', '21 devices, 7 delivery configurations', sum(d['runs'] for d in Q.values())],
    ['scale', '(ii, iv) latency and resources vs N and topology', 'N = 21 / 50 / 100, one server or server per device', sum(d['runs'] for t in S.values() for d in t.values())],
    ['bytes', '(iii) bytes on the wire', '21 devices, plain and secured, through counting relays', 6],
    ['secure', '(v) security overhead', '21 devices, plain vs SignAndEncrypt + TLS', sum(d['runs'] for d in SE.values())],
    ['cmd', '(vi) command latency', 'OPC UA call (plain, secured) vs Modbus handshake, 3 × 100 commands each', '1 bench'],
])
X['CPUHZ'] = f'{HZ / 1e9:.2f}'

# ---------------------------------------------------------------- Table 5.6 completeness
lab = [('dc:FmsState:q1:p1000', 'data change, $q$ = 1, $P$ = 1 000 ms'), ('dc:FmsState:q1:p250', 'data change, $q$ = 1, $P$ = 250 ms'),
       ('dc:FmsState:q1:p100', 'data change, $q$ = 1, $P$ = 100 ms'), ('dc:FmsState:q10:p1000', 'data change, $q$ = 10, $P$ = 1 000 ms'),
       ('dc:FmsStateSampled:q10:p1000', 'sampled ($S$ = 100 ms), $q$ = 10, $P$ = 1 000 ms'), ('ev:q0:p1000', 'events, $P$ = 1 000 ms'),
       ('ev:q0:p100', 'events, $P$ = 100 ms')]
rows = []
for k, name in lab:
    row = [name]
    for rate in ('1', '4', '16'):
        d = C[rate][k]
        mod = f" ({d['model_pct']:.1f})" if 'model_pct' in d else ' (100)'
        row.append(f"{m(d['completeness'], dig=2)}{mod}")
    d = C['1'][k]
    row.append(f"{d['lat_p50_ms']['mean']:.0f} / {d['lat_p95_ms']['mean']:.0f} / {d['lat_max_ms']['max']:.0f}")
    rows.append(row)
ev = [C[r]['events']['mean'] * 3 for r in ('1', '4', '16')]
rows.append(['true state changes per run (mean)', f"{C['1']['events']['mean']:.0f}", f"{C['4']['events']['mean']:.0f}", f"{C['16']['events']['mean']:.0f}", ''])
rows.append(['changes per device and second', f"{C['1']['events_per_dev_s']['mean']:.2f}", f"{C['4']['events_per_dev_s']['mean']:.2f}", f"{C['16']['events_per_dev_s']['mean']:.2f}", ''])
X['T_COMPLETE'] = table(['Subscription', 'delivered [%], rate × 1', 'rate × 4', 'rate × 16', 'latency p50 / p95 / max [ms], × 1'], rows)
X['C_Q1_1000'] = f"{C['1']['dc:FmsState:q1:p1000']['completeness']['mean']:.1f}"
X['C_Q1_250'] = f"{C['1']['dc:FmsState:q1:p250']['completeness']['mean']:.1f}"
X['C_Q1_100'] = f"{C['1']['dc:FmsState:q1:p100']['completeness']['mean']:.1f}"
X['C_Q1_1000_16'] = f"{C['16']['dc:FmsState:q1:p1000']['completeness']['mean']:.1f}"
X['C_Q10_16'] = f"{C['16']['dc:FmsState:q10:p1000']['completeness']['mean']:.1f}"
X['M_Q10_16'] = f"{C['16']['dc:FmsState:q10:p1000']['model_pct']:.1f}"
X['C_S_1'] = f"{C['1']['dc:FmsStateSampled:q10:p1000']['completeness']['mean']:.1f}"
X['C_S_16'] = f"{C['16']['dc:FmsStateSampled:q10:p1000']['completeness']['mean']:.1f}"
X['M_S_1'] = f"{C['1']['dc:FmsStateSampled:q10:p1000']['model_pct']:.1f}"
X['M_S_16'] = f"{C['16']['dc:FmsStateSampled:q10:p1000']['model_pct']:.1f}"
evt = sum(C[r]['ev:q0:p100']['pooled'][1] for r in C)
X['EV_TOTAL'] = f"{evt:,}".replace(',', ' ')
X['EV_RATE16'] = f"{C['16']['events_per_dev_s']['mean']:.1f}"
X['L_EV100_P50'] = f"{C['1']['ev:q0:p100']['lat_p50_ms']['mean']:.0f}"
X['L_EV100_MAX'] = f"{C['1']['ev:q0:p100']['lat_max_ms']['max']:.0f}"
X['L_EV1000_P50'] = f"{C['1']['ev:q0:p1000']['lat_p50_ms']['mean']:.0f}"
X['L_EV1000_MAX'] = f"{C['1']['ev:q0:p1000']['lat_max_ms']['max']:.0f}"

# ---------------------------------------------------------------- Table 5.7 MQTT
order = [('q1_sf_rp_steady', 'QoS 1, S&F, replay', 'no restart'), ('q0_nosf_norp_restart', 'QoS 0, no store-and-forward', 'restart'),
         ('q0_sf_norp_restart', 'QoS 0, store-and-forward', 'restart'), ('q1_sf_norp_restart', 'QoS 1, store-and-forward', 'restart'),
         ('q2_sf_norp_restart', 'QoS 2, store-and-forward', 'restart'), ('q0_sf_rp_restart', 'QoS 0, S&F + counter replay', 'restart'),
         ('q1_sf_rp_restart', 'QoS 1, S&F + counter replay', 'restart')]
rows = []
for k, name, rs in order:
    d = Q[k]
    lo = d['wilson_lo_pct']
    rows.append([name, rs, f"{d['pooled'][0]} / {d['pooled'][1]}", f"{100 * d['pooled'][0] / d['pooled'][1]:.2f} (≥ {lo:.2f})",
                 f"{d['completeness']['min']:.2f}", d['duplicates'], d['historical'], d['replay_requests'],
                 f"{d['lat_p50_ms']['mean']:.0f} / {d['lat_p95_ms']['mean']:.0f} / {d['lat_max_ms']['max']:.0f}"])
X['T_MQTT'] = table(['Configuration', 'Broker', 'Delivered / true', 'Pooled [%] (Wilson 95 % lower)', 'Worst run [%]', 'Duplicates', 'Historical', 'Replay requests',
                     'Latency p50 / p95 / max [ms]'], rows)

# ---------------------------------------------------------------- Table 5.8 scale
rows = []
for topo, tn in (('single', 'one server'), ('perdev', 'server per device')):
    for n in ('21', '50', '100'):
        d = S.get(topo, {}).get(n)
        if not d:
            continue
        rows.append([tn, n, f"{d['pooled'][0]} / {d['pooled'][1]}", m(d['e2e_p50_ms'], dig=0), m(d['e2e_p95_ms'], dig=0),
                     m(d['e2e_p99_ms'], dig=0), f"{d['e2e_max_ms']['max']:.0f}", m(d['gw_cpu_pct'], dig=1),
                     m(d['gw_ws_mb'], dig=0, ci=False), m(d['broker_cpu_pct'], dig=1, ci=False), m(d['plant_ws_mb'], dig=0, ci=False)])
X['T_SCALE'] = table(['Topology', 'N', 'Delivered / true', 'E2E p50 [ms]', 'p95 [ms]', 'p99 [ms]', 'max [ms]',
                      'Gateway CPU [% core]', 'Gateway MB', 'Broker CPU [%]', 'Plant MB'], rows)

# ---------------------------------------------------------------- Table 5.9 bytes
pl, sc, mb = B['plain'], B['secured'], B['modbus_ed1']
rows = [['OPC UA subscription leg (gateway ↔ server, both directions)', m(pl['opcua_payload'], dig=0), m(pl['opcua_segments'], dig=2, ci=False), m(pl['opcua_wire'], dig=0),
         m(sc['opcua_payload'], dig=0), m(sc['opcua_wire'], dig=0)],
        ['MQTT gateway ↔ broker', m(pl['mqtt_gw_payload'], dig=0), m(pl['mqtt_gw_segments'], dig=2, ci=False), m(pl['mqtt_gw_wire'], dig=0),
         m(sc['mqtt_gw_payload'], dig=0), m(sc['mqtt_gw_wire'], dig=0)],
        ['MQTT broker ↔ twin', m(pl['mqtt_twin_payload'], dig=0), m(pl['mqtt_twin_segments'], dig=2, ci=False), m(pl['mqtt_twin_wire'], dig=0),
         m(sc['mqtt_twin_payload'], dig=0), m(sc['mqtt_twin_wire'], dig=0)],
        ['Modbus, event block 36 registers, $P$ = 1 s (first edition)', '–', '–', f"{mb['event_block_P1s']:.0f} [calc.]", '–', '–'],
        ['Modbus, event block, $P$ = 0.25 s', '–', '–', f"{mb['event_block_P0.25s']:.0f} [calc.]", '–', '–'],
        ['Modbus, multi-rate scheme FAST/EVENT/COUNTERS/ENERGY', '–', '–', f"{mb['multirate_eq5_2']:.0f} [calc.]", '–', '–']]
X['T_BYTES'] = table(['Leg', 'TCP payload [B/s]', 'Segments [1/s]', 'Wire, Eq. (5.8) [B/s]', 'Payload, secured [B/s]', 'Wire, secured [B/s]'], rows)

# ---------------------------------------------------------------- Table 5.10 security
p_, s_ = SE['plain'], SE['secured']
rows = [['Delivered / true state changes', f"{p_['pooled'][0]} / {p_['pooled'][1]}", f"{s_['pooled'][0]} / {s_['pooled'][1]}"],
        ['OPC UA leg latency p50 [ms]', m(p_['ua_p50_ms'], dig=1), m(s_['ua_p50_ms'], dig=1)],
        ['End-to-end latency p50 [ms]', m(p_['e2e_p50_ms'], dig=1), m(s_['e2e_p50_ms'], dig=1)],
        ['End-to-end latency p99 [ms]', m(p_['e2e_p99_ms'], dig=1), m(s_['e2e_p99_ms'], dig=1)],
        ['End-to-end latency max [ms]', f"{p_['e2e_max_ms']['max']:.0f}", f"{s_['e2e_max_ms']['max']:.0f}"],
        ['Gateway CPU [% of one core]', m(p_['gw_cpu_pct'], dig=2), m(s_['gw_cpu_pct'], dig=2)],
        ['Plant (OPC UA server) CPU [% of one core]', m(p_['plant_cpu_pct'], dig=2), m(s_['plant_cpu_pct'], dig=2)],
        ['Broker CPU [% of one core]', m(p_['broker_cpu_pct'], dig=2), m(s_['broker_cpu_pct'], dig=2)],
        ['Gateway working set [MB]', m(p_['gw_ws_mb'], dig=0), m(s_['gw_ws_mb'], dig=0)],
        ['OPC UA connect (secure channel + session) [ms]', m(p_['gw_connect_s'], dig=1) if False else f"{1000 * p_['gw_connect_s']['mean']:.1f}",
         f"{1000 * s_['gw_connect_s']['mean']:.1f}"]]
X['T_SECURE'] = table(['Quantity', 'Unsecured', 'SignAndEncrypt + TLS'], rows)

# ---------------------------------------------------------------- Table 5.11 commands
cmd = R['cmd']
rows = []
for k, name in (('modbus_toggle_bit', 'Modbus TCP toggle-bit handshake (first edition, fmsctl)'), ('opcua_none', 'OPC UA method call, no security'),
                ('opcua_sign_encrypt', 'OPC UA method call, Basic256Sha256 SignAndEncrypt')):
    d = cmd[k]
    st = d['stats']
    rows.append([name, f"{st['mean_ms']:.2f} ± {st['ci95_ms']:.2f}", f"{st['p50_ms']:.2f}", f"{st['p95_ms']:.2f}", f"{st['p99_ms']:.2f}", f"{st['max_ms']:.1f}",
                 f"{d.get('transactions_per_command', 1):.0f}", f"{d['bytes_per_command']:.0f}", f"{d['segments_per_command']:.1f}"])
X['T_CMD'] = table(['Command path', 'Mean ± CI [ms]', 'p50 [ms]', 'p95 [ms]', 'p99 [ms]', 'max [ms]', 'Request/response pairs', 'TCP payload [B/command]', 'Segments / command'], rows)

# ---------------------------------------------------------------- narrative pieces (texts in fill_texts.py)
from fill_texts import texts  # noqa: E402
X.update(texts(R, X))

tpl = open(os.path.join(HERE, 'ch05_template.md'), encoding='utf-8').read()
missing = sorted(set(re.findall(r'@@([A-Z0-9_]+)@@', tpl)) - set(X))
if missing:
    raise SystemExit(f'missing markers: {missing}')
out = re.sub(r'@@([A-Z0-9_]+)@@', lambda mo: X[mo.group(1)], tpl)
out = out.replace('> Draft v2.0 (second edition) – 2026-11-15. Generated from `thesis_modern/code/modern/ch05_template.md` by\n> `fill_ch05.py`',
                  '> Draft v2.0 (second edition) – 2026-11-15. Generated from `code/modern/ch05_template.md` by\n> `code/modern/fill_ch05.py`')
open(os.path.join(TM, 'ch05_architecture.md'), 'w', encoding='utf-8').write(out)
print('ch05_architecture.md written,', len(out.split()), 'words')
