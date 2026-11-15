"""Paper 3 - all figures as SVG (white background, Arial, Okabe-Ito colour-blind-safe palette, no titles in images).

    python make_figures.py      -> ../figures/fig1 ... fig7 .svg
Data figures read ../data/*.json(l); diagrams are drawn from the design (register map V1.2, fmsctl).
"""
import json
import math
import os
import statistics

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
FIG = os.path.join(HERE, '..', 'figures')
THESIS_DATA = os.path.join(HERE, '..', '..', '..', 'thesis', 'data')

C = {'black': '#000000', 'orange': '#E69F00', 'sky': '#56B4E9', 'green': '#009E73', 'yellow': '#F0E442',
     'blue': '#0072B2', 'red': '#D55E00', 'purple': '#CC79A7', 'grey': '#777777', 'light': '#EEEEEE'}
FONT = 'Arial, Helvetica, sans-serif'


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


class Svg:
    def __init__(self, w, h):
        self.w, self.h, self.el = w, h, []

    def add(self, s):
        self.el.append(s)

    def rect(self, x, y, w, h, fill='none', stroke='#000', sw=1, rx=0, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def line(self, x1, y1, x2, y2, stroke='#000', sw=1, dash=None, arrow=False):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        a = ' marker-end="url(#arr)"' if arrow else ''
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{sw}"{d}{a}/>')

    def poly(self, pts, stroke='#000', sw=1.5, fill='none', dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        p = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
        self.add(f'<polyline points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"{d}/>')

    def text(self, x, y, s, size=13, anchor='start', weight='normal', fill='#000', rot=None, italic=False):
        r = f' transform="rotate({rot} {x:.1f} {y:.1f})"' if rot else ''
        st = ' font-style="italic"' if italic else ''
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" text-anchor="{anchor}" '
                 f'font-weight="{weight}" fill="{fill}"{st}{r}>{esc(s)}</text>')

    def marker(self, x, y, kind, color, size=4.5):
        if kind == 'o':
            self.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{size}" fill="{color}" stroke="#000" stroke-width="0.6"/>')
        elif kind == 's':
            self.rect(x - size, y - size, 2 * size, 2 * size, fill=color, stroke='#000', sw=0.6)
        elif kind == '^':
            self.add(f'<polygon points="{x:.1f},{y - size * 1.2:.1f} {x - size:.1f},{y + size * 0.8:.1f} {x + size:.1f},{y + size * 0.8:.1f}" fill="{color}" stroke="#000" stroke-width="0.6"/>')
        elif kind == 'd':
            self.add(f'<polygon points="{x:.1f},{y - size * 1.2:.1f} {x + size:.1f},{y:.1f} {x:.1f},{y + size * 1.2:.1f} {x - size:.1f},{y:.1f}" fill="{color}" stroke="#000" stroke-width="0.6"/>')
        elif kind == 'x':
            self.line(x - size, y - size, x + size, y + size, color, 1.8)
            self.line(x - size, y + size, x + size, y - size, color, 1.8)

    def save(self, name):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
                '<defs><marker id="arr" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">'
                '<polygon points="0 0, 9 3.5, 0 7" fill="#000"/></marker></defs>'
                f'<rect width="100%" height="100%" fill="#FFFFFF"/>')
        open(os.path.join(FIG, name), 'w', encoding='utf-8').write(head + '\n'.join(self.el) + '</svg>')


class Axes:
    """Simple 2-D axes on an Svg; log axes supported."""
    def __init__(self, svg, x, y, w, h, xr, yr, xlog=False, ylog=False):
        self.s, self.x, self.y, self.w, self.h = svg, x, y, w, h
        self.xr, self.yr, self.xlog, self.ylog = xr, yr, xlog, ylog

    def _t(self, v, r, log):
        if log:
            v = max(v, r[0] * 1e-3)
            return (math.log10(v) - math.log10(r[0])) / (math.log10(r[1]) - math.log10(r[0]))
        return (v - r[0]) / (r[1] - r[0])

    def X(self, v):
        return self.x + self.w * self._t(v, self.xr, self.xlog)

    def Y(self, v):
        return self.y + self.h * (1 - self._t(v, self.yr, self.ylog))

    def frame(self, xticks, yticks, xlabel, ylabel, xfmt=str, yfmt=str, grid=True):
        s = self.s
        for v in yticks:
            yy = self.Y(v)
            if grid:
                s.line(self.x, yy, self.x + self.w, yy, '#DDDDDD', 0.8)
            s.line(self.x - 4, yy, self.x, yy)
            s.text(self.x - 7, yy + 4.5, yfmt(v), 12, 'end')
        for v in xticks:
            xx = self.X(v)
            if grid:
                s.line(xx, self.y, xx, self.y + self.h, '#EEEEEE', 0.8)
            s.line(xx, self.y + self.h, xx, self.y + self.h + 4)
            s.text(xx, self.y + self.h + 18, xfmt(v), 12, 'middle')
        s.rect(self.x, self.y, self.w, self.h, stroke='#000', sw=1)
        if xlabel:
            s.text(self.x + self.w / 2, self.y + self.h + 38, xlabel, 13, 'middle')
        if ylabel:
            s.text(self.x - 52, self.y + self.h / 2, ylabel, 13, 'middle', rot=-90)

    def curve(self, xs, ys, color, sw=1.8, dash=None):
        pts = [(self.X(a), self.Y(b)) for a, b in zip(xs, ys) if b is not None and (not self.ylog or b >= self.yr[0])]
        self.s.poly(pts, color, sw, dash=dash)

    def points(self, xs, ys, kind, color, err=None):
        for i, (a, b) in enumerate(zip(xs, ys)):
            if b is None or (self.ylog and b <= 0):
                continue
            if err:
                lo, hi = err[i]
                self.s.line(self.X(a), self.Y(max(lo, self.yr[0]) if self.ylog else lo), self.X(a), self.Y(hi), color, 1.2)
            self.s.marker(self.X(a), self.Y(b), kind, color)


def legend(s, x, y, items, size=12, dy=19):
    for i, (kind, color, label, dash) in enumerate(items):
        yy = y + i * dy
        if kind == 'line':
            s.line(x, yy - 4, x + 26, yy - 4, color, 2, dash)
        else:
            s.marker(x + 13, yy - 4, kind, color)
        s.text(x + 34, yy, label, size)


def load_jsonl(p):
    return [json.loads(l) for l in open(p, encoding='utf-8')] if os.path.exists(p) else []


def mean_ci(v):
    t = {1: 0, 2: 12.706, 3: 4.303, 4: 3.182, 5: 2.776, 6: 2.571, 7: 2.447}
    m = statistics.mean(v)
    return m, (t.get(len(v), 1.96) * statistics.stdev(v) / len(v) ** 0.5 if len(v) > 1 else 0.0)


# ====================================================================== Figure 1 - architecture
def fig1():
    s = Svg(820, 520)
    lv = [(20, 'Level 4/3: ERP, MES, historian, operator screens, digital twin (Bayesian updating, DES)', '#F3F3F3'),
          (130, 'Level 2: FMS control PC (only Modbus client) – gateway, cell controller, tool + logistics managers', '#E8F3FA'),
          (300, 'Level 1: 21 PLCs = Modbus TCP servers, one register map V1.2 (status, event block, command, job blocks)', '#FDF3E1'),
          (440, 'Level 0: machines, sensors, actuators; functional safety hard-wired (never on the network)', '#F3F3F3')]
    hts = [80, 140, 110, 60]
    for (y, lab, col), h in zip(lv, hts):
        s.rect(15, y, 790, h, fill=col, stroke='#888', sw=1, rx=6)
        s.text(25, y + 18, lab, 12.5, weight='bold')
    for i, t in enumerate(['ERP', 'MES', 'Historian', 'Browser HMI', 'Digital twin']):
        s.rect(40 + i * 152, 50, 130, 34, fill='#FFFFFF', stroke=C['grey'])
        s.text(105 + i * 152, 72, t, 12.5, 'middle')
    s.rect(40, 160, 740, 100, fill='#FFFFFF', stroke=C['blue'], sw=1.5, rx=4)
    for i, t in enumerate(['HTTP/JSON API', 'event reconstruction', 'cell controller', 'tool / logistics', 'SQLite log']):
        s.rect(55 + i * 145, 175, 133, 32, fill='#FFFFFF', stroke=C['grey'])
        s.text(121 + i * 145, 196, t, 12, 'middle')
    s.text(410, 232, 'multi-rate poller (FC03) · command writer (FC16 + FC06, toggle-bit handshake) · heartbeat FC06 226', 12, 'middle')
    s.text(410, 250, 'Python standard library, offline PC; one TCP connection per PLC', 12, 'middle', fill='#333')
    for i in range(5):
        s.line(105 + i * 152, 84, 105 + i * 152, 160, C['blue'], 1.3)
    s.rect(225, 110, 380, 18, fill='#FFFFFF', stroke='none')
    s.text(415, 123, 'HTTP/JSON only: GET state, GET events?since=k, POST bookings', 12, 'middle', fill=C['blue'])
    for i in range(12):
        x = 40 + i * 62
        s.rect(x, 330, 52, 44, fill='#FFFFFF', stroke=C['orange'], sw=1.4, rx=3)
        s.text(x + 26, 350, 'PLC', 11, 'middle')
        s.text(x + 26, 366, ['HMC', 'HMC', 'HMC', 'PPS', 'LOAD', 'WASH', 'CNC', 'TEST', 'STN', 'AGV', 'ASRS', '…'][i], 10.5, 'middle')
        s.line(x + 26, 330, x + 26, 260, C['orange'], 1.2)
    s.rect(255, 278, 310, 17, fill='#FFFFFF', stroke='none')
    s.text(410, 291, 'Modbus TCP only: port 502, FC03 / FC06 / FC16', 12, 'middle', fill='#9A5B00')
    s.text(410, 395, 'zone VLANs + firewall conduits (IEC 62443); PLC watchdog on gateway heartbeat (5 s)', 12, 'middle', fill='#333')
    for i in range(12):
        x = 40 + i * 62
        s.line(x + 26, 408, x + 26, 470, '#999', 1, dash='3,3')
    for (y, lab, col), wd in zip(lv, (560, 590, 650, 560)):      # titles on top of the connector lines
        s.rect(20, y + 5, wd, 18, fill=col, stroke='none')
        s.text(25, y + 18, lab, 12.5, weight='bold')
    s.save('fig1_architecture.svg')


# ====================================================================== Figure 2 - event block + reconstruction
def fig2():
    s = Svg(820, 430)
    x0, x1 = 80, 790
    T = 3.0
    X = lambda t: x0 + (x1 - x0) * t / T
    states = [(0, 1), (0.42, 4), (0.55, 1), (1.30, 2), (1.42, 1), (1.47, 2), (2.35, 3), (2.48, 2), (3.0, 2)]
    lvl = {1: 120, 2: 95, 3: 70, 4: 45}
    names = {1: 'RUN', 2: 'IDLE', 3: 'BLOCKED', 4: 'DOWN'}
    for st, y in lvl.items():
        s.text(x0 - 8, y + 4, names[st], 11.5, 'end')
        s.line(x0, y, x1, y, '#EEEEEE', 0.8)
    pts = []
    for (t, st), (t2, _) in zip(states, states[1:]):
        pts += [(X(t), lvl[st]), (X(t2), lvl[st])]
    s.poly(pts, C['black'], 2)
    for k in range(4):
        tp = 0.05 + k * 1.0
        s.line(X(min(tp, 3.0)), 30, X(min(tp, 3.0)), 140, C['blue'], 1.4, dash='5,3')
        s.text(X(min(tp, 3.0)), 24, f'poll {k}', 11.5, 'middle', fill=C['blue'])
    for i, (t, st) in enumerate(states[1:-1], start=1):
        s.add(f'<circle cx="{X(t):.1f}" cy="{lvl[st]:.1f}" r="3.5" fill="{C["red"]}"/>')
        s.text(X(t) + 2, 158 if i % 2 else 172, f'c={i}', 10.5, 'middle', fill=C['red'])
    s.text(x0, 195, 'State-only polling sees RUN, RUN, IDLE, IDLE: 1 change reported, 6 of 7 lost, time error up to P.', 12.5)
    s.text(x0, 214, 'Event block: the change counter c reads 0 → 2 → 5 → 7; the ring returns every change with its PLC time stamp.', 12.5)
    y = 240
    s.text(80, y + 6, 'Event block (registers 104–131, map V1.2)', 13, weight='bold')
    cells = [('104–105', 'change counter c (UINT32)', C['orange']), ('106–107', 'time of last change, ms (UINT32)', C['orange'])] + \
            [(f'{108 + 3 * k}–{110 + 3 * k}', f'ring entry {k}: state + time ms', C['sky']) for k in range(3)] + \
            [('117–131', 'ring entries 3 … 7 (oldest last)', C['sky'])]
    for i, (a, t, col) in enumerate(cells):
        yy = y + 18 + i * 25
        s.rect(80, yy, 80, 22, fill=col, stroke='#000', sw=0.7)
        s.text(120, yy + 15.5, a, 11.5, 'middle')
        s.rect(160, yy, 250, 22, fill='#FFFFFF', stroke='#000', sw=0.7)
        s.text(168, yy + 15.5, t, 11.5)
    s.text(450, y + 6, 'Gateway reconstruction at each poll', 13, weight='bold')
    alg = ['d = (c − c_prev) mod 2³²', 'd = 0: no change', '1 ≤ d ≤ R: read entries d−1 … 0 (oldest first)',
           'd > R: read R entries, flag d − R events lost', 'c < c_prev (restart): re-baseline, flag gap', 'c_prev = c']
    for i, a in enumerate(alg):
        s.text(450, y + 32 + i * 21, a, 12.5)
    s.text(450, y + 170, 'One FC03 per poll; R = 8 entries = 28 registers.', 12, fill='#333')
    s.save('fig2_event_block.svg')


# ====================================================================== Figure 3 - handshake state machine
def fig3():
    s = Svg(820, 520)
    s.text(20, 22, 'Controller (FMS PC)', 13.5, weight='bold')
    s.text(430, 22, 'PLC (scan cycle)', 13.5, weight='bold')
    cs = [('IDLE', 'REQ = ACK'), ('WRITE', 'FC16 job 400–405, FC16 code+seq 200–201'), ('TOGGLE', 'FC06 REQ := ¬REQ (202)'),
          ('WAIT ACK', 'FC03 8–10 until ACK = REQ ∧ ackSeq = seq'), ('SENT', 'job running; poll idDone, BUSY'), ('DONE', 'idDone = id ∧ BUSY = 0')]
    for i, (a, b) in enumerate(cs):
        y = 40 + i * 62
        s.rect(20, y, 360, 46, fill='#E8F3FA', stroke=C['blue'], sw=1.4, rx=8)
        s.text(32, y + 19, a, 13, weight='bold')
        s.text(32, y + 37, b, 11.5)
        if i < len(cs) - 1:
            s.line(200, y + 46, 200, y + 62, '#000', 1.2, arrow=True)
    ps = [('WAIT', 'REQ = ACK; READY = 1'), ('VALIDATE', 'REQ ≠ ACK (edge of toggle); code, ready, data'),
          ('ACCEPT / REJECT', 'latch 400–449; write ackSeq, result; then ACK := REQ'), ('BUSY', 'execute job; DONE toggle at end'),
          ('RESULT', 'write idDone, result, duration; then BUSY := 0')]
    for i, (a, b) in enumerate(ps):
        y = 40 + i * 74
        s.rect(430, y, 370, 50, fill='#FDF3E1', stroke=C['orange'], sw=1.4, rx=8)
        s.text(442, y + 20, a, 13, weight='bold')
        s.text(442, y + 39, b, 11.5)
        if i < len(ps) - 1:
            s.line(615, y + 50, 615, y + 74, '#000', 1.2, arrow=True)
    s.line(380, 196, 430, 120, C['grey'], 1.2, dash='4,3', arrow=True)
    s.text(392, 168, 'REQ', 11, fill=C['grey'])
    s.line(430, 215, 380, 245, C['grey'], 1.2, dash='4,3', arrow=True)
    s.text(392, 240, 'ACK', 11, fill=C['grey'])
    notes = [(C['red'], 'Time-out: no ACK within 5 s → job state noack (the PLC may still run it); rejected only if the device is idle and idDone ≠ id.'),
             (C['red'], 'Time-out: accepted but not finished within 3 × the longest cycle → job state unknown + alarm; the operator resolves it.'),
             (C['red'], 'Controller restart: start in manual mode; read REQ, ACK and idDone of every device; never toggle while REQ ≠ ACK.'),
             (C['green'], 'PLC restart: in the first scan ACK := REQ, so an old command is never executed again.'),
             (C['green'], 'Sequence guard (proposed for map V1.3): accept a toggle only if cmd.seq ≠ the last acknowledged sequence number.')]
    for i, (col, t) in enumerate(notes):
        s.text(20, 420 + i * 20, t, 11.5, fill=col)
    s.save('fig3_handshake.svg')


# ====================================================================== Figure 4 - RTT distributions (empirical CDF from histograms)
def fig4():
    runs = load_jsonl(os.path.join(DATA, 'e2_replication.jsonl'))
    s = Svg(820, 380)
    ax = Axes(s, 75, 20, 470, 290, (0, 26), (0, 1))
    ax.frame(range(0, 27, 2), [0, 0.2, 0.4, 0.6, 0.8, 1.0], 'Round-trip time of one FC03 request [ms]', 'Cumulative share',
             yfmt=lambda v: f'{v:.1f}')
    groups = [('E2-160-seq-1.0-10', C['blue'], 'scan 10 ms, sequential, N = 160', None),
              ('E2-160-par-1.0-10', C['orange'], 'scan 10 ms, parallel, N = 160', None),
              ('E2-21-par-0.25-10', C['green'], 'scan 10 ms, parallel, N = 21', '6,3'),
              ('E2-160-seq-1.0-20', C['red'], 'scan 20 ms, sequential, N = 160', None)]
    for tag, col, lab, dash in groups:
        h = {}
        for r in runs:
            if r['tag'] == tag:
                for k, v in r['rtt_hist_ms_0.25'].items():
                    h[float(k)] = h.get(float(k), 0) + v
        if not h:
            continue
        tot, acc, xs, ys = sum(h.values()), 0, [0], [0]
        for k in sorted(h):
            acc += h[k]
            xs.append(k + 0.25)
            ys.append(acc / tot)
        ax.curve(xs, ys, col, 2, dash)
    for scan in (10, 20):
        ax.curve([0, 1, 1 + scan, 26], [0, 0, 1, 1], C['grey'], 1.2, '2,3')
    legend(s, 565, 40, [('line', c, l, d) for _, c, l, d in groups] + [('line', C['grey'], 'model U(0, t_scan) + 1 ms', '2,3')])
    s.save('fig4_rtt.svg')


# ====================================================================== Figure 5 - cycle time vs N
def fig5():
    runs = load_jsonl(os.path.join(DATA, 'e2_replication.jsonl'))
    th = load_jsonl(os.path.join(THESIS_DATA, 'comm_runs.jsonl'))
    s = Svg(820, 400)
    ax = Axes(s, 80, 20, 480, 300, (5, 200), (1, 3000), xlog=True, ylog=True)
    ax.frame([10, 21, 40, 80, 160], [1, 3, 10, 30, 100, 300, 1000, 3000], 'Number of devices N (log scale)',
             'Poll cycle time [ms] (log scale)')
    ns = [5, 10, 21, 40, 80, 160, 200]
    ax.curve(ns, [n * 6.05 for n in ns], C['blue'], 1.4, '6,4')
    ax.curve(ns, [n * 11.05 for n in ns], C['red'], 1.4, '6,4')
    ax.curve(ns, [1.05 + 10 * n / (n + 1) + 0.013 * n for n in ns], C['orange'], 1.4, '6,4')
    for mode, scan, col, kind in (('seq', 10, C['blue'], 'o'), ('par', 10, C['orange'], 's'), ('seq', 20, C['red'], '^')):
        pts = {}
        for r in runs:
            if r['mode'] == mode and r['scan'] == scan:
                pts.setdefault(r['n'], []).append(r['cycle_mean_ms'])
        xs = sorted(pts)
        mc = [mean_ci(pts[n]) for n in xs]
        ax.points(xs, [m for m, _ in mc], kind, col, err=[(m - h, m + h) for m, h in mc])
    for r in th:
        if r['plc_scan_ms'] == 10:
            col = C['blue'] if r['mode'] == 'seq' else C['orange']
            s.add(f'<circle cx="{ax.X(r["N"]):.1f}" cy="{ax.Y(1000 * r["cycle_mean_s"]):.1f}" r="7" fill="none" stroke="{col}" stroke-width="1"/>')
    s.line(ax.X(5), ax.Y(1000), ax.X(200), ax.Y(1000), C['black'], 1, '2,2')
    s.text(ax.X(5.5), ax.Y(1000) - 6, 'P = 1 s', 11.5)
    s.line(ax.X(5), ax.Y(250), ax.X(200), ax.Y(250), C['black'], 1, '2,2')
    s.text(ax.X(5.5), ax.Y(250) - 6, 'P = 0.25 s', 11.5)
    legend(s, 580, 40, [('o', C['blue'], 'sequential, scan 10 ms', None), ('s', C['orange'], 'parallel, scan 10 ms', None),
                        ('^', C['red'], 'sequential, scan 20 ms', None), ('line', C['blue'], 'Eq. (5), E[RTT] = 6.05 ms', '6,4'),
                        ('line', C['red'], 'Eq. (5), E[RTT] = 11.05 ms', '6,4'), ('line', C['orange'], 'Eq. (6), t_gw = 0.013 ms', '6,4')])
    s.text(580, 175, 'Filled: this study, mean ± 95 % CI', 11.5)
    s.text(580, 193, '(5 seeds × 60 s).', 11.5)
    s.text(580, 211, 'Hollow circles: thesis campaign', 11.5)
    s.text(580, 229, '(single 60 s runs).', 11.5)
    s.save('fig5_cycle.svg')


# ====================================================================== Figure 6 - loss model validation
def fig6():
    e3 = load_jsonl(os.path.join(DATA, 'e3_lossmodel.jsonl'))
    sm = json.load(open(os.path.join(DATA, 'sizing_model.json'), encoding='utf-8'))
    pc = sm['poisson_curves']
    mus = [p['mu'] for p in pc]
    s = Svg(820, 420)
    ax = Axes(s, 85, 30, 290, 280, (0, 20), (1e-5, 1), ylog=True)
    ax.frame([0, 4, 8, 12, 16, 20], [1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1], 'Mean events per poll interval λP',
             'Share lost / share of intervals', yfmt=lambda v: {1e-5: '0.00001', 1e-4: '0.0001', 1e-3: '0.001', 1e-2: '0.01', 1e-1: '0.1', 1: '1'}[v])
    ax.curve(mus, [p['loss_R8'] for p in pc], C['black'], 1.8)
    ax.curve(mus, [p['p_overflow_R8'] for p in pc], C['grey'], 1.4, '5,3')
    for lam, col, kind in ((4.0, C['blue'], 'o'), (16.0, C['orange'], 's')):
        rs = sorted([r for r in e3 if r['lam'] == lam], key=lambda r: r['period'])
        xs = [r['lam_measured'] * r['period'] for r in rs]
        ax.points(xs, [r['R_lost'] / r['events'] if r['R_lost'] else None for r in rs], kind, col)
        ax.points(xs, [r['overflow_obs'] / r['intervals'] if r['overflow_obs'] else None for r in rs], 'x', col)
    s.text(80, 18, '(a) event block, ring depth R = 8', 12.5, weight='bold')
    bx = Axes(s, 480, 30, 290, 280, (0, 20), (0, 1))
    bx.frame([0, 4, 8, 12, 16, 20], [0, 0.2, 0.4, 0.6, 0.8, 1.0], 'Mean events per poll interval λP',
             'Share of changes captured', yfmt=lambda v: f'{v:.1f}')
    bx.curve(mus, [p['state_only_reported'] for p in pc], C['black'], 1.8)
    bx.curve(mus, [1 - p['loss_R8'] for p in pc], C['black'], 1.4, '2,2')
    for lam, col, kind in ((4.0, C['blue'], 'o'), (16.0, C['orange'], 's')):
        rs = sorted([r for r in e3 if r['lam'] == lam], key=lambda r: r['period'])
        bx.points([r['lam_measured'] * r['period'] for r in rs], [r['S_share_reported'] for r in rs], kind, col)
        bx.points([r['lam_measured'] * r['period'] for r in rs], [1 - r['R_lost'] / r['events'] for r in rs], 'd', col)
    s.text(475, 18, '(b) state-only polling vs event block', 12.5, weight='bold')
    legend(s, 85, 372, [('line', C['black'], '(a) loss share, Eq. (11); (b) state-only, Eq. (9)', None),
                        ('line', C['grey'], '(a) overflow probability, Eq. (10)', '5,3'),
                        ('line', C['black'], '(b) event block captured, 1 − Eq. (11)', '2,2')], 11.5)
    legend(s, 430, 372, [('o', C['blue'], 'measured, λ = 4 /s', None), ('s', C['orange'], 'measured, λ = 16 /s', None)], 11.5)
    legend(s, 600, 372, [('x', C['black'], '(a) share of intervals > R', None), ('d', C['black'], '(b) event block', None)], 11.5)
    s.save('fig6_loss_model.svg')


# ====================================================================== Figure 7 - handshake latency
def fig7():
    p = os.path.join(DATA, 'handshake_latency.json')
    if not os.path.exists(p):
        return
    d = json.load(open(p, encoding='utf-8'))
    s = Svg(820, 380)
    runs = d['runs']
    labels = [f"{'DeviceLink' if r['sequence'] == 'devicelink' else '3-frame'}, ACK poll {int(r['ack_poll_ms'])} ms" for r in runs]
    ymax = max(r['total']['p95_ms'] for r in runs) * 1.1
    ax = Axes(s, 250, 20, 430, 280, (0, ymax), (0, len(runs)))
    ax.frame([], [], '', '', grid=False)
    step = 20 if ymax > 60 else 10
    for v in range(0, int(ymax) + 1, step):
        xx = ax.X(v)
        s.line(xx, 20, xx, 300, '#E5E5E5', 0.8)
        s.line(xx, 300, xx, 304)
        s.text(xx, 318, str(v), 12, 'middle')
    s.text(465, 342, 'Time from first frame until the ACK is confirmed [ms]', 13, 'middle')
    s.text(465, 360, '(bar = mean, split into write and ACK phase; whisker = 95th percentile)', 12, 'middle', fill='#333')
    for i, r in enumerate(runs):
        y = ax.Y(len(runs) - i - 0.5)
        wp, ap = r['write_phase']['mean_ms'], r['ack_phase']['mean_ms']
        s.rect(ax.X(0), y - 11, max(0.8, ax.X(wp) - ax.X(0)), 22, fill=C['sky'], stroke='#000', sw=0.6)
        s.rect(ax.X(wp), y - 11, max(0.8, ax.X(wp + ap) - ax.X(wp)), 22, fill=C['orange'], stroke='#000', sw=0.6)
        s.line(ax.X(wp + ap), y, ax.X(r['total']['p95_ms']), y, '#000', 1.2)
        s.line(ax.X(r['total']['p95_ms']), y - 6, ax.X(r['total']['p95_ms']), y + 6, '#000', 1.2)
        s.text(242, y - 1, labels[i], 12, 'end')
        s.text(242, y + 14, f"PLC scan {int(r['scan_ms'])} ms · {r['frames_mean']:.1f} frames", 11, 'end', fill='#444')
        s.text(ax.X(r['total']['p95_ms']) + 6, y + 4, f"{r['total']['mean_ms']:.1f}", 11, fill='#222')
    legend(s, 695, 50, [('s', C['sky'], 'write phase', None), ('s', C['orange'], 'ACK phase', None)], 12)
    s.save('fig7_handshake_latency.svg')


if __name__ == '__main__':
    os.makedirs(FIG, exist_ok=True)
    for f in (fig1, fig2, fig3, fig4, fig5, fig6, fig7):
        try:
            f()
            print('ok', f.__name__)
        except Exception as e:
            print('FAILED', f.__name__, repr(e))
