"""Figures of chapters 5 and 8, edition 2 (OPC UA + MQTT). SVG for print: white background, Arial, thesis palette
(helpers imported from ../make_figures.py). Data figures read data/modern/results.json (analyse_modern.py).
    python make_figures_modern.py          (system Python is enough - standard library only)
"""
from __future__ import annotations

import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from make_figures import BOX, C, DEFS, GRID, INK, INK2, arrow, box as _box, svg  # noqa: E402


def esc(t):
    return str(t).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def box(x, y, w, h, lines, **k):
    return _box(x, y, w, h, [esc(t) for t in lines], **k)

F = os.path.join(HERE, '..', '..', 'figures')
DATA = os.path.join(HERE, '..', '..', 'data', 'modern')
BLUE_L, GREEN_L, ORANGE_L, YELLOW_L, GREY_L = '#eaf2fc', '#eaf7f1', '#fdeee6', '#fdf5e0', '#f4f3ef'


def save(name, w, h, body, title):
    with open(os.path.join(F, name), 'w', encoding='utf-8') as f:
        f.write(svg(w, h, body, title))


def text(x, y, t, fs=12, anchor='start', col=INK, bold=False, italic=False):
    return (f'<text x="{x}" y="{y}" font-size="{fs}" fill="{col}" text-anchor="{anchor}"'
            f'{" font-weight=\"bold\"" if bold else ""}{" font-style=\"italic\"" if italic else ""}>{esc(t)}</text>')


def zone(x, y, w, h, label, col='#9a988f'):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="none" stroke="{col}" stroke-width="1.4" stroke-dasharray="7 5"/>'
            + text(x + 10, y + 17, label, 12, col=INK2, bold=True))


def line(x1, y1, x2, y2, col=INK2, w=1.6, dash=None, head=True):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="{w}"'
            f'{" stroke-dasharray=\"" + dash + "\"" if dash else ""}{" marker-end=\"url(#ah)\"" if head else ""}/>')


# ============================================================================ Figure 5.1 reference architecture
def fig5_1():
    w, h = 1180, 760
    s = DEFS
    s += zone(15, 15, 1150, 120, 'Levels 3-4  Enterprise / office zone (IEC 62443 zone Z3)')
    s += box(40, 45, 200, 70, ['ERP', 'orders, stock, costs'], fill=GREY_L)
    s += box(270, 45, 210, 70, ['MES', 'work orders, bookings, OEE'], fill=GREY_L)
    s += box(510, 45, 250, 70, ['Digital twin (Ch. 4, 6)', 'Sparkplug primary host', 'Bayesian update, prediction'], fill=GREEN_L)
    s += box(790, 45, 170, 70, ['Historian', 'SQLite / time series'], fill=GREY_L)
    s += box(985, 45, 160, 70, ['Engineering', 'browser screens'], fill=GREY_L)
    s += zone(15, 160, 1150, 210, 'Level 2  FMS control / site operations zone (Z2) - one industrial PC + cold spare, offline')
    s += box(40, 195, 330, 150, ['MQTT broker (unified namespace)', 'Mosquitto recommended; amqtt in the lab', 'spBv1.0/fms/{NBIRTH|DBIRTH|DDATA|...}/gw1/<device>',
                                 'spBv1.0/STATE/twin   TLS 1.3, port 8883', 'retained STATE, last will NDEATH'], fill=YELLOW_L)
    s += box(410, 195, 330, 150, ['Edge gateway (OPC UA client -> Sparkplug)', 'subscriptions: events + data changes', 'store-and-forward, seq / bdSeq, aliases',
                                  'replay buffer 4096 events / device', 'one session per OPC UA server'], fill=BLUE_L)
    s += box(780, 195, 365, 150, ['FMS control (Ch. 8)', 'cell controller, tool management, logistics', 'OPC UA client: subscriptions for status,',
                                  'METHOD calls for jobs (JobId = idempotency key)', 'AGV fleet: VDA 5050 over MQTT (option)'], fill=BLUE_L)
    s += zone(15, 395, 1150, 350, 'Levels 0-1  Machine zones (Z1, one VLAN per area) - conduits only through the level-2 firewall')
    s += box(40, 430, 250, 130, ['Embedded OPC UA server', 'new machines: CNC option (e.g.', 'OPC UA for Machine Tools), PLC', 'server (e.g. S7-1500) - ask supplier'], fill=BLUE_L)
    s += box(320, 430, 250, 130, ['Retrofit OPC UA server', 'old CNC / small PLC:', '(edge box) reads Modbus / vendor', 'protocol, exposes the same model'], fill=ORANGE_L)
    s += box(600, 430, 260, 130, ['Information model V2.0', 'Machines/<Device>: Identification,', 'MachineryItemState, OperationMode,', 'Monitoring, Production, Equipment'], fill=GREEN_L)
    s += box(890, 430, 255, 130, ['21 devices of the case FMS', '7 CNC (3 HMC), pallet system,', 'load station, 7 stations, 2 test', 'benches, 2 AGV, 2 AS/RS cranes'], fill=GREY_L)
    s += box(40, 590, 530, 130, ['Background: OPC UA PubSub (Part 14)', 'JSON over MQTT = implementable variant of this design;', 'UADP over UDP / TSN for deterministic cyclic data',
                                 '(motion, safety-related coordination stays in the PLC)'], fill=GREY_L, bold_first=True)
    s += box(600, 590, 545, 130, ['Safety is not networked', 'e-stop chains, guards, light curtains, STO hard-wired per machine;', 'lost network = "no new jobs", never a hazard;',
                                  'machine accepts jobs only while a controller session is alive'], fill=GREY_L)
    # arrows
    s += line(575, 430, 575, 345) + text(582, 395, 'OPC UA SignAndEncrypt', 11.5, col=INK2)
    s += line(165, 430, 520, 348, dash=None)
    s += line(445, 430, 560, 348)
    s += line(410, 270, 372, 270) + text(375, 262, 'publish', 11, col=INK2)
    s += line(205, 195, 560, 117) + text(395, 150, 'subscribe (primary host)', 11, col=INK2)
    s += line(900, 345, 900, 432) + text(906, 395, 'methods + subscriptions', 11.5, col=INK2)
    s += line(860, 195, 640, 117, dash='5 4') + text(800, 150, 'MQTT (status, plans)', 11, col=INK2)
    s += line(375, 117, 300, 193, dash='5 4') + text(325, 150, 'MES/ERP topics', 11, 'end', INK2)
    save('fig5_1_architecture_modern.svg', w, h, s, 'Reference architecture with OPC UA and MQTT')


# ============================================================================ Figure 5.2 information model
def fig5_2():
    w, h = 1180, 720
    s = DEFS
    rows = [
        (0, 'Objects / Machines', 'folder (OPC 40001-1 entry point)', ''),
        (1, 'HMC-01   : FmsMachineToolType', 'one object per device; type = device class', 'hdr.typeCode'),
        (2, 'Identification', 'Manufacturer, Model, SerialNumber, ProductInstanceUri, DeviceClass, Location', 'hdr.unitId'),
        (2, 'MachineryItemState / CurrentState', 'NotAvailable | OutOfService | NotExecuting | Executing', 'std.status'),
        (2, 'MachineryOperationMode / CurrentState', 'None | Maintenance | Setup | Processing', 'std.mode'),
        (2, 'Monitoring', 'FmsState (0-6), AlarmCode, StateChangeCounter, ElectricalPower, EnergyConsumption, Spindle, Channel', '4-7, 100-107'),
        (2, 'Production', 'ActiveJob/{Identifier, RunsCompleted}, ActiveProgram/ProgramNo, LastJob/{JobId, Result, Duration},', '11, 20-45, 300, 390-395'),
        (3, '', 'PartsGood, PartsScrap, LastCycleTime, JobActive, ReadyForJob', ''),
        (2, 'Equipment / Tools', 'Pocket01..30/RemainingLife [%],  LastToolData/{Pocket, Length, Radius}', '310-345'),
        (2, 'Equipment / PalletChanger', 'WorkPallet, SetupPallet', '301-302'),
        (2, 'Methods', 'StartJob(JobId, ProgramNo, Variant, Quantity, PalletId) -> (Status, Message)', 'cmd 200-226 + job 400-449'),
        (3, '', 'WriteToolData(JobId, Pocket, Length, Radius, LifeSet),  AckAlarm(),  GetJobResult(JobId)', '+ toggle-bit handshake'),
        (1, 'PPS-1 : FmsPalletSystemType', 'PalletSystem/Locations/Location01..16/PalletId, Pallets/Pallet01..16/Content, Shuttle;  MovePallet(...)', '300-345'),
        (1, 'AGV-01 : FmsAgvType', 'Vehicle/{CurrentNode, TargetNode, BatteryCharge, Loaded, VehicleState};  Transport(...), Charge(...)', '300-304'),
        (1, '... 18 further devices', 'LoadStation, Station, TestBench (LastResult/...), AsrsCrane (Crane/...)', ''),
        (0, 'Events (via Server object)', 'FmsStateChangedEventType {NewStateCode, OldStateCode, StateChangeCounter, MachineryItemState}', 'event ring 108-131'),
        (1, '', 'FmsJobFinishedEventType {JobId, Result, Duration};  Time = source time stamp of the machine', 'evt.tLast_ms'),
    ]
    s += text(30, 30, 'Node (browse path)', 13, bold=True) + text(400, 30, 'Content', 13, bold=True) + text(1150, 30, 'Replaces register(s) V1.2', 13, anchor='end', bold=True)
    y = 58
    for lvl, name, content, reg in rows:
        x = 30 + 22 * lvl
        if name:
            fill = {0: BLUE_L, 1: GREEN_L}.get(lvl, BOX)
            s += f'<rect x="{x - 6}" y="{y - 15}" width="{350 - 22 * lvl}" height="22" rx="5" fill="{fill}" stroke="{INK2}" stroke-width="0.8"/>'
            s += text(x, y, name, 12.5, bold=lvl < 2)
            if lvl > 0:
                s += f'<line x1="{x - 16}" y1="{y - 4}" x2="{x - 6}" y2="{y - 4}" stroke="{INK2}"/>'
        s += text(400, y, content, 11.8)
        s += text(1150, y, reg, 11.5, anchor='end', col=INK2)
        y += 36
    s += text(30, h - 18, 'Browse names follow OPC 40001-1 / OPC 40501-1; FMS-specific nodes in namespace urn:compressor-fms:ua:fms (model version 2.0.0).', 11.5, col=INK2, italic=True)
    save('fig5_2_infomodel_modern.svg', w, h, s, 'Information model of the compressor FMS')


# ============================================================================ data helpers
def res():
    with open(os.path.join(DATA, 'results.json'), encoding='utf-8') as fh:
        return json.load(fh)


def hbars(items, path, title, xlabel, w=900, h=None, xmax=100, xmin=0, fmt='{:.1f}', label_w=330, ref=None):
    """Horizontal bars: items = [(label, value, err, colour index)]."""
    bh, gap = 22, 10
    h = h or 40 + len(items) * (bh + gap) + 50
    L, R, T = label_w, 70, 20
    pw = w - L - R
    X = lambda v: L + (max(xmin, min(v, xmax)) - xmin) / (xmax - xmin) * pw
    s = ''
    for i in range(6):
        v = xmin + (xmax - xmin) * i / 5
        s += f'<line x1="{X(v):.1f}" x2="{X(v):.1f}" y1="{T}" y2="{T + len(items) * (bh + gap)}" stroke="{GRID}"/>'
        s += text(X(v), T + len(items) * (bh + gap) + 16, fmt.format(v).rstrip('0').rstrip('.') if '.' in fmt.format(v) else fmt.format(v), 11, 'middle', INK2)
    for k, (lab, v, err, ci) in enumerate(items):
        y = T + k * (bh + gap)
        s += text(L - 8, y + bh / 2 + 4, lab, 12, 'end')
        s += f'<rect x="{L}" y="{y}" width="{max(0.5, X(v) - L):.1f}" height="{bh}" rx="3" fill="{C[ci]}"/>'
        if err:
            s += f'<line x1="{X(v - err):.1f}" x2="{X(v + err):.1f}" y1="{y + bh / 2}" y2="{y + bh / 2}" stroke="{INK}" stroke-width="1.3"/>'
        s += text(X(v) + 6, y + bh / 2 + 4, fmt.format(v), 11.5)
    if ref:
        rv, rl = ref
        s += f'<line x1="{X(rv):.1f}" x2="{X(rv):.1f}" y1="{T - 5}" y2="{T + len(items) * (bh + gap)}" stroke="{INK}" stroke-dasharray="5 4"/>'
        s += text(X(rv) - 4, T - 8 + 0, rl, 11, 'end')
    s += text(L + pw / 2, h - 10, xlabel, 12.5, 'middle')
    save(path, w, h, s, title)


# ============================================================================ Figure 5.3 completeness
def fig5_3(r):
    lab = [('dc:FmsState:q1:p1000', 'data change, queue 1, 1 000 ms'), ('dc:FmsState:q1:p250', 'data change, queue 1, 250 ms'),
           ('dc:FmsState:q1:p100', 'data change, queue 1, 100 ms'), ('dc:FmsStateSampled:q10:p1000', 'sampled 100 ms, queue 10'),
           ('dc:FmsState:q10:p1000', 'data change, queue 10, 1 000 ms'), ('ev:q0:p1000', 'events, 1 000 ms'), ('ev:q0:p100', 'events, 100 ms')]
    w, h = 1000, 470
    L, R, T, B = 70, 250, 25, 60
    pw, ph = w - L - R, h - T - B
    rates = ['1', '4', '16']
    X = lambda i, j: L + (i + 0.5) * pw / len(rates) + (j - (len(lab) - 1) / 2) * 18
    Y = lambda v: T + ph - v / 100 * ph
    s = ''
    for v in range(0, 101, 20):
        s += f'<line x1="{L}" x2="{L + pw}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="{GRID}"/>' + text(L - 6, Y(v) + 4, v, 11, 'end', INK2)
    cols = ['#b9cfee', '#7fa9e3', C[0], '#eda100', C[1], '#7fd1b3', C[2]]
    for i, rate in enumerate(rates):
        d = r['complete'].get(rate, {})
        for j, (k, name) in enumerate(lab):
            if k not in d:
                continue
            v = d[k]['completeness']['mean']
            s += f'<rect x="{X(i, j) - 7:.1f}" y="{Y(v):.1f}" width="14" height="{Y(0) - Y(v):.1f}" fill="{cols[j]}"/>'
        ev = d.get('events_per_dev_s', {}).get('mean')
        s += text(L + (i + 0.5) * pw / len(rates), T + ph + 20, f'rate x{rate}', 12.5, 'middle')
        if ev:
            s += text(L + (i + 0.5) * pw / len(rates), T + ph + 36, f'{ev:.2f} changes / device / s', 11, 'middle', INK2)
    s += f'<line x1="{L}" x2="{L + pw}" y1="{Y(0)}" y2="{Y(0)}" stroke="{INK2}"/>'
    s += text(16, T + ph / 2, 'State changes delivered [%]', 12.5, 'middle') .replace('<text', f'<text transform="rotate(-90 16 {T + ph / 2})"', 1)
    for j, (k, name) in enumerate(lab):
        y = T + 15 + j * 24
        s += f'<rect x="{L + pw + 18}" y="{y - 10}" width="14" height="14" fill="{cols[j]}"/>' + text(L + pw + 38, y + 2, name, 11.5)
    s += text(L + pw + 18, T + 15 + len(lab) * 24 + 14, 'edition 1, state-only polling:', 11, col=INK2, italic=True)
    s += text(L + pw + 18, T + 15 + len(lab) * 24 + 30, '63-71 % (1 s), 89-91 % (0.25 s), 98 % (0.1 s)', 11, col=INK2, italic=True)
    save('fig5_3_completeness_modern.svg', w, h, s, 'State changes delivered per OPC UA subscription type')


# ============================================================================ Figure 5.4 latency vs scale
def fig5_4(r):
    w, h = 1000, 440
    L, R, T, B = 70, 240, 25, 60
    pw, ph = w - L - R, h - T - B
    ns = ['21', '50', '100']
    vmax = 0
    for topo in r['scale']:
        for n in ns:
            d = r['scale'][topo].get(n)
            if d and d['e2e_p99_ms']['mean']:
                vmax = max(vmax, d['e2e_p99_ms']['mean'])
    vmax = max(200, math.ceil(vmax * 1.15 / 50) * 50)
    Y = lambda v: T + ph - min(v, vmax) / vmax * ph
    s = ''
    for i in range(6):
        v = vmax * i / 5
        s += f'<line x1="{L}" x2="{L + pw}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="{GRID}"/>' + text(L - 6, Y(v) + 4, f'{v:.0f}', 11, 'end', INK2)
    series = [('single', 'p50', C[0], 'one server, p50'), ('single', 'p95', '#7fa9e3', 'one server, p95'), ('single', 'p99', '#b9cfee', 'one server, p99'),
              ('perdev', 'p50', C[1], 'server per device, p50'), ('perdev', 'p95', '#f2a07c', 'server per device, p95'), ('perdev', 'p99', '#f8cdb8', 'server per device, p99')]
    for i, n in enumerate(ns):
        cx = L + (i + 0.5) * pw / len(ns)
        for j, (topo, q, col, name) in enumerate(series):
            d = r['scale'].get(topo, {}).get(n)
            if not d:
                continue
            m = d[f'e2e_{q}_ms']
            x = cx + (j - 2.5) * 22
            s += f'<rect x="{x - 9:.1f}" y="{Y(m["mean"]):.1f}" width="18" height="{Y(0) - Y(m["mean"]):.1f}" fill="{col}"/>'
            if m.get('ci'):
                s += f'<line x1="{x}" x2="{x}" y1="{Y(m["mean"] + m["ci"]):.1f}" y2="{Y(max(0, m["mean"] - m["ci"])):.1f}" stroke="{INK}"/>'
        s += text(cx, T + ph + 20, f'{n} devices', 12.5, 'middle')
    s += f'<line x1="{L}" x2="{L + pw}" y1="{Y(0)}" y2="{Y(0)}" stroke="{INK2}"/>'
    s += f'<text transform="rotate(-90 16 {T + ph / 2})" x="16" y="{T + ph / 2}" font-size="12.5" fill="{INK}" text-anchor="middle">Latency machine -> twin [ms]</text>'
    for j, (topo, q, col, name) in enumerate(series):
        y = T + 15 + j * 24
        s += f'<rect x="{L + pw + 18}" y="{y - 10}" width="14" height="14" fill="{col}"/>' + text(L + pw + 38, y + 2, name, 11.5)
    s += text(L + pw + 18, T + 15 + 6 * 24 + 16, 'OPC UA events (100 ms) ->', 11, col=INK2, italic=True)
    s += text(L + pw + 18, T + 15 + 6 * 24 + 32, 'Sparkplug QoS 1 -> twin', 11, col=INK2, italic=True)
    s += text(L + pw + 18, T + 15 + 6 * 24 + 48, 'H1 limit: 1 000 ms', 11, col=INK2, italic=True)
    save('fig5_5_latency_modern.svg', w, h, s, 'End-to-end latency versus number of devices')


# ============================================================================ Figure 5.5 broker restart
def fig5_5(r):
    order = [('q1_sf_rp_steady', 'QoS 1, S&F, replay - no restart', 2), ('q0_nosf_norp_restart', 'QoS 0, no store-and-forward', 1),
             ('q0_sf_norp_restart', 'QoS 0, store-and-forward', 1), ('q1_sf_norp_restart', 'QoS 1, store-and-forward', 3),
             ('q2_sf_norp_restart', 'QoS 2, store-and-forward', 3), ('q0_sf_rp_restart', 'QoS 0, S&F + counter replay', 0),
             ('q1_sf_rp_restart', 'QoS 1, S&F + counter replay', 0)]
    items = []
    for k, name, ci in order:
        d = r['mqtt'].get(k)
        if d:
            items.append((f'{name}', d['completeness']['mean'], None, ci))
    lo = min(v for _, v, _, _ in items)
    xmin = max(0, math.floor(lo / 2) * 2 - 2)
    hbars(items, 'fig5_4_restart_modern.svg', 'State changes reaching the twin across a broker restart', f'State changes delivered to the twin [%] (mean of 3 runs; axis starts at {xmin} %)',
          w=900, xmax=100, xmin=xmin, fmt='{:.2f}', label_w=300)


# ============================================================================ Figure 5.6 resources and bytes
def fig5_6(r):
    w, h = 1000, 420
    s = ''
    # left: bytes per device per second
    b = r['bytes']
    pl = b.get('plain', {})
    items = [('Modbus, event block, P = 1 s (ed. 1)', b['modbus_ed1']['event_block_P1s'], 3),
             ('Modbus, event block, P = 0.25 s', b['modbus_ed1']['event_block_P0.25s'], 3),
             ('Modbus, multi-rate scheme (ed. 1)', b['modbus_ed1']['multirate_eq5_2'], 3)]
    if pl:
        items += [('OPC UA subscription leg', pl['opcua_wire']['mean'], 0), ('MQTT gateway -> broker', pl['mqtt_gw_wire']['mean'], 2),
                  ('MQTT broker -> twin', pl['mqtt_twin_wire']['mean'], 2)]
    sc = b.get('secured', {})
    if sc:
        items += [('OPC UA leg, SignAndEncrypt', sc['opcua_wire']['mean'], 1), ('MQTT gateway -> broker, TLS', sc['mqtt_gw_wire']['mean'], 1)]
    vmax = max(v for _, v, _ in items) * 1.18
    L, T, bh, gap, pw = 290, 30, 20, 9, 260
    s += text(20, 18, 'a) Bytes on the wire per device and second [B/s]', 13, bold=True)
    for k, (lab, v, ci) in enumerate(items):
        y = T + k * (bh + gap)
        s += text(L - 8, y + 14, lab, 11.5, 'end')
        s += f'<rect x="{L}" y="{y}" width="{v / vmax * pw:.1f}" height="{bh}" rx="3" fill="{C[ci]}"/>' + text(L + v / vmax * pw + 5, y + 14, f'{v:.0f}', 11.5)
    s += text(20, T + len(items) * (bh + gap) + 18, 'Ethernet framing added: 78 B per segment + 84 B per ACK [calculated]', 10.5, col=INK2, italic=True)
    # right: gateway CPU % and memory vs N
    x0 = 640
    s += text(x0, 18, 'b) Edge gateway CPU [% of one core]', 13, bold=True)
    ns = ['21', '50', '100']
    vals = []
    for topo, col, name in (('single', C[0], 'one server'), ('perdev', C[1], 'server per device')):
        for n in ns:
            d = r['scale'].get(topo, {}).get(n)
            vals.append((topo, n, d['gw_cpu_pct']['mean'] if d else None, d['gw_ws_mb']['mean'] if d else None, col))
    vm = math.ceil(max([v[2] for v in vals if v[2]] + [1]) * 1.2)
    PH, PB = 260, 320
    for i in range(6):
        y = PB - PH * i / 5
        s += f'<line x1="{x0 + 30}" x2="{x0 + 340}" y1="{y:.1f}" y2="{y:.1f}" stroke="{GRID}"/>' + text(x0 + 25, y + 4, f'{vm * i / 5:g}', 11, 'end', INK2)
    for i, n in enumerate(ns):
        cx = x0 + 30 + (i + 0.5) * 310 / 3
        for j, topo in enumerate(('single', 'perdev')):
            v = [x for x in vals if x[0] == topo and x[1] == n][0]
            if v[2] is None:
                continue
            bx = cx - 26 + j * 28
            s += f'<rect x="{bx}" y="{PB - v[2] / vm * PH:.1f}" width="24" height="{v[2] / vm * PH:.1f}" fill="{v[4]}"/>'
            s += text(bx + 12, PB - v[2] / vm * PH - 4, f'{v[2]:.1f}', 10.5, 'middle')
            if v[3]:
                s += text(bx + 12, PB + 30, f'{v[3]:.0f}', 10, 'middle', INK2)
        s += text(cx, PB + 16, f'N = {n}', 11.5, 'middle')
    s += text(x0 + 30, PB + 46, 'second row: gateway working set [MB]', 10.5, col=INK2, italic=True)
    s += f'<rect x="{x0 + 30}" y="{PB + 58}" width="12" height="12" fill="{C[0]}"/>' + text(x0 + 48, PB + 68, 'one server, N objects', 11)
    s += f'<rect x="{x0 + 190}" y="{PB + 58}" width="12" height="12" fill="{C[1]}"/>' + text(x0 + 208, PB + 68, 'one server per device', 11)
    save('fig5_6_resources_modern.svg', w, h + 0, s, 'Bytes on the wire and gateway resources')


# ============================================================================ Figure 8.1 software layers
def fig8_1():
    w, h = 900, 520
    s = DEFS
    layers = [
        ('User entities', 'ERP · MES · browser displays · twin users · engineering', GREY_L),
        ('Twin core + FMS control (offline industrial PC)', 'server.py + twin/ (factory model, MES, ERP, historian) · thesis/code (bayes, flowline, staging) · fmsctl', GREEN_L),
        ('Unified namespace', 'MQTT broker, Sparkplug B topics spBv1.0/fms/... (TLS) · twin = primary host', YELLOW_L),
        ('Edge gateway / controller adapter', 'OPC UA client: subscriptions + events -> Sparkplug, store-and-forward, replay · UaDeviceLink: methods', BLUE_L),
        ('Machines (L1)', 'PLC / CNC with OPC UA server (embedded or retrofit) · information model V2.0 · job methods', GREEN_L),
        ('Field (L0)', 'sensors, drives, safety - hard-wired, not on the network', GREY_L),
    ]
    links = ['HTTP/JSON, Server-Sent Events, MQTT topics', 'MQTT 3.1.1 / 5.0 over TLS (Sparkplug B payloads)', 'MQTT publish / subscribe (QoS 1)',
             'OPC UA binary, SignAndEncrypt, one session per server', 'I/O']
    y = 20
    for k, (a, b, col) in enumerate(layers):
        s += box(40, y, 820, 58, [a, b], fill=col, fs=13)
        if k < len(links):
            s += line(450, y + 58, 450, y + 84, head=False) + text(462, y + 76, links[k], 11.5, col=INK2)
        y += 84
    save('fig8_1_software_modern.svg', w, h, s, 'Software layers of the implementation, edition 2')


# ============================================================================ Figure 8.2 control hierarchy
def fig8_2():
    w, h = 1180, 715
    s = DEFS
    s += zone(15, 15, 1150, 110, 'Level 3-4: MES / ERP (office zone)')
    s += box(60, 45, 300, 60, ['ERP', 'orders, material, shipping'], fill=GREY_L)
    s += box(420, 45, 300, 60, ['MES', 'work orders -> cell controller'], fill=GREY_L)
    s += box(780, 45, 340, 60, ['Digital twin (read-only)', 'Sparkplug primary host, Ch. 4-6'], fill=GREEN_L)
    s += zone(15, 145, 1150, 250, 'Level 2: FMS control PC (Python, offline) - OPC UA client + MQTT client')
    s += box(40, 180, 260, 120, ['Cell controller', 'dispatching (EDD / FIFO),', 'pallet + job state, SQLite', 'unchanged fmsctl code'], fill=BLUE_L)
    s += box(320, 180, 240, 120, ['Tool management', 'tool list from subscription,', 'Eq. (8.1) check,', 'WriteToolData method'], fill=BLUE_L)
    s += box(580, 180, 260, 120, ['Logistics', 'AS/RS: Store / Retrieve methods', 'AGV: Transport / Charge methods', 'or VDA 5050 order over MQTT'], fill=BLUE_L)
    s += box(860, 180, 280, 198, ['Edge gateway', 'OPC UA subscriptions ->', 'Sparkplug B (unified namespace)', 'store-and-forward + replay', '', 'publishes via the MQTT broker', '(TLS, spBv1.0/fms/#, STATE)'], fill=BLUE_L)
    s += box(40, 318, 800, 60, ['UaDeviceLink adapter: one OPC UA session per server; status = subscription image (no polling);', 'job = method call with JobId (idempotent retry), result = FmsJobFinishedEvent / GetJobResult'], fill=YELLOW_L, bold_first=False, fs=12.5)
    s += zone(15, 415, 1150, 230, 'Level 1: 21 machine controllers, each an OPC UA server (embedded or retrofit) - zone Z1')
    devs = [('LOAD-CC', 'load station'), ('PPS-1', 'pallet system'), ('HMC-01..03', '3 HMC + pallet changer'), ('VMC, HONE,', 'LATHE, GRIND'),
            ('WASH, ASSY, ROBOT,', 'PAINT, FINAL, PACK'), ('TEST-01/02', 'test benches'), ('AGV-01/02', 'Wi-Fi'), ('ASRS-RAW/FG', 'cranes')]
    for i, (a, b) in enumerate(devs):
        s += box(35 + i * 142, 450, 132, 70, [a, b], fill=GREEN_L, fs=12)
    s += text(590, 560, 'each: Machines/<Device> object (Fig. 5.2), events FmsStateChanged / FmsJobFinished, job methods', 12.5, 'middle', INK2)
    s += text(590, 582, 'security: Basic256Sha256 SignAndEncrypt, trust list with the control PC certificate only', 12.5, 'middle', INK2)
    s += text(590, 604, 'watchdog: no active controller session -> no new jobs (replaces register 226 heartbeat)', 12.5, 'middle', INK2)
    s += zone(15, 660, 1150, 40, 'Level 0: safety hard-wired per machine (e-stop, guards, light curtains, STO) - never over the network', '#c2410c')
    s += line(590, 105, 590, 178) + text(598, 150, 'work orders', 11.5, col=INK2)
    s += line(640, 378, 640, 448) + text(648, 441, 'OPC UA methods + subscriptions', 11.5, col=INK2)
    s += line(1000, 448, 1000, 380) + text(992, 441, 'OPC UA events + data changes', 11.5, 'end', INK2)
    s += line(1000, 180, 1000, 108) + text(1008, 140, 'Sparkplug B over MQTT', 11.5, col=INK2)
    save('fig8_2_control_levels_modern.svg', w, h, s, 'Control hierarchy with OPC UA and MQTT')


# ============================================================================ Figure 8.3 method call vs handshake
def fig8_3(r):
    w, h = 1180, 560
    s = DEFS
    cmd = (r or {}).get('cmd') or {}
    mb = cmd.get('modbus_toggle_bit', {})
    ua_ = cmd.get('opcua_none', {})
    sec = cmd.get('opcua_sign_encrypt', {})
    # left: edition 1
    s += text(30, 28, 'a) Edition 1: toggle-bit handshake over Modbus TCP', 14, bold=True)
    s += text(30, 48, f"fmsctl DeviceLink.command(): {mb['transactions_per_command']:.0f} request/response transactions per job [measured]" if mb else 'fmsctl DeviceLink.command()', 12, col=INK2)
    s += line(130, 70, 130, 520, head=False, col=INK) + line(470, 70, 470, 520, head=False, col=INK)
    s += box(70, 60, 120, 30, ['FMS controller'], fill=BLUE_L, fs=12) + box(410, 60, 120, 30, ['PLC (V1.2 map)'], fill=GREEN_L, fs=12)
    steps = ['FC03 read cmd.ctl', 'FC03 read hs.status', 'FC16 job id (400-401)', 'FC16 parameters (404-405)', 'FC16 serial (410-419)',
             'FC03 read hs.ackSeq', 'FC16 cmd.code + seq (200-201)', 'FC06 flip REQ (202) - last', 'FC03 hs.status: ACK = REQ ?', 'FC03 hs.ackSeq = seq ?', 'FC03 hs.result']
    y = 112
    for st in steps:
        s += line(132, y, 466, y + 8, w=1.3) + text(300, y - 3, st, 11, 'middle')
        s += line(468, y + 14, 134, y + 22, w=1, dash='4 3')
        y += 36
    # right: edition 2
    s += text(620, 28, 'b) Edition 2: OPC UA method call', 14, bold=True)
    s += text(620, 48, 'one Call service request/response; JobId = idempotency key', 12, col=INK2)
    s += line(720, 70, 720, 520, head=False, col=INK) + line(1060, 70, 1060, 520, head=False, col=INK)
    s += box(660, 60, 120, 30, ['FMS controller'], fill=BLUE_L, fs=12) + box(1000, 60, 120, 30, ['OPC UA server'], fill=GREEN_L, fs=12)
    s += line(722, 120, 1056, 132, w=1.6) + text(890, 114, 'Call StartJob(JobId, ProgramNo, Variant, Qty, PalletId)', 11.5, 'middle')
    s += text(1068, 150, 'validate, start job', 11, col=INK2)
    s += line(1058, 160, 724, 172, w=1.3, dash='4 3') + text(890, 182, '(Status = 0 OK | 2 not ready | 3 bad data | 4 busy, Message)', 11.5, 'middle')
    s += line(722, 230, 1056, 242, w=1.3, col=C[1]) + text(890, 224, 'reply lost? -> repeat with the SAME JobId', 11.5, 'middle', C[1])
    s += line(1058, 255, 724, 267, w=1.3, dash='4 3', col=C[1]) + text(890, 282, 'Status 0 "duplicate": job is not started twice', 11.5, 'middle', C[1])
    s += line(1058, 380, 724, 392, w=1.6, col=C[2]) + text(890, 374, 'FmsJobFinishedEvent {JobId, Result, Duration} (subscription)', 11.5, 'middle', C[2])
    s += text(890, 420, 'or GetJobResult(JobId) after a restart (reconciliation)', 11.5, 'middle', INK2)
    if mb and ua_:
        s += box(640, 450, 500, 70, ['Measured command time (loopback, median / p99) [ms]',
                                     f"Modbus handshake {mb['stats']['p50_ms']:.2f} / {mb['stats']['p99_ms']:.2f}   OPC UA call {ua_['stats']['p50_ms']:.2f} / {ua_['stats']['p99_ms']:.2f}",
                                     f"OPC UA SignAndEncrypt {sec['stats']['p50_ms']:.2f} / {sec['stats']['p99_ms']:.2f}" if sec else ''], fill=YELLOW_L, fs=12.5)
    save('fig8_3_method_modern.svg', w, h, s, 'Job command: method call versus toggle-bit handshake')


def main():
    fig5_1()
    fig5_2()
    fig8_1()
    fig8_2()
    r = None
    if os.path.exists(os.path.join(DATA, 'results.json')):
        r = res()
        if r.get('complete'):
            fig5_3(r)
        if r.get('scale'):
            fig5_4(r)
        if r.get('mqtt'):
            fig5_5(r)
        if r.get('bytes') and r.get('scale'):
            fig5_6(r)
    fig8_3(r)
    print('figures written to', os.path.abspath(F))


if __name__ == '__main__':
    main()
