"""Paper 4 figures (SVG, standard library only). White background, Arial, Okabe-Ito colour-blind-safe palette,
no titles inside the images (captions are in the manuscript). Run after run_experiments.py, screen_check.py,
voi.py and analyse.py.  Output: ../figures/fig1..fig7.svg
"""
from __future__ import annotations

import collections
import csv
import json
import os
import statistics

import stats_utils as su

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', 'data'))
FIG = os.path.normpath(os.path.join(HERE, '..', 'figures'))
os.makedirs(FIG, exist_ok=True)

INK, MUTED, GRID = '#1a1a1a', '#555555', '#d9d9d9'
COL = {'ALL': '#D55E00', 'STATIC': '#E69F00', 'STATIC_SP': '#CC79A7', 'ADAPTIVE': '#0072B2', 'PI_PLAN': '#000000',
       'CLAIRVOYANT': '#000000', 'ADAPT_DEM': '#56B4E9', 'ADAPT_PAR': '#009E73', 'MYOPIC': '#999999',
       'BN_GREEDY': '#999999', 'PI_RULE': '#666666', 'NONE': '#bbbbbb'}
LABEL = {'ALL': 'All-at-once', 'STATIC': 'Fixed plan (point values)', 'STATIC_SP': 'Fixed plan (stochastic)',
         'ADAPTIVE': 'Adaptive with twin', 'PI_PLAN': 'Clairvoyant plan', 'ADAPT_DEM': 'Adaptive, demand only',
         'ADAPT_PAR': 'Adaptive, parameters only', 'MYOPIC': 'Myopic with twin', 'BN_GREEDY': 'Bottleneck greedy',
         'PI_RULE': 'Rule with true parameters', 'NONE': 'No investment', 'CLAIRVOYANT': 'Clairvoyant plan'}
FONT = "font-family='Arial, Helvetica, sans-serif'"


class Svg:
    def __init__(self, w, h):
        self.w, self.h, self.el = w, h, []

    def add(self, s):
        self.el.append(s)

    def text(self, x, y, s, size=13, anchor='start', color=INK, weight='normal', rotate=None):
        tr = f" transform='rotate({rotate} {x:.1f} {y:.1f})'" if rotate else ''
        s = str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        self.add(f"<text x='{x:.1f}' y='{y:.1f}' font-size='{size}' text-anchor='{anchor}' fill='{color}' "
                 f"font-weight='{weight}'{tr}>{s}</text>")

    def line(self, x1, y1, x2, y2, color=INK, width=1.0, dash=None):
        d = f" stroke-dasharray='{dash}'" if dash else ''
        self.add(f"<line x1='{x1:.1f}' y1='{y1:.1f}' x2='{x2:.1f}' y2='{y2:.1f}' stroke='{color}' stroke-width='{width}'{d}/>")

    def rect(self, x, y, w, h, fill, stroke='none', rx=0, sw=1):
        self.add(f"<rect x='{x:.1f}' y='{y:.1f}' width='{max(0, w):.1f}' height='{max(0, h):.1f}' fill='{fill}' "
                 f"stroke='{stroke}' stroke-width='{sw}' rx='{rx}'/>")

    def marker(self, x, y, shape, color, r=5.5, fill=None):
        f = color if fill is None else fill
        if shape == 'circle':
            self.add(f"<circle cx='{x:.1f}' cy='{y:.1f}' r='{r}' fill='{f}' stroke='{color}' stroke-width='1.6'/>")
        elif shape == 'square':
            self.rect(x - r, y - r, 2 * r, 2 * r, f, color, sw=1.6)
        elif shape == 'diamond':
            self.add(f"<polygon points='{x},{y - r * 1.3} {x + r * 1.3},{y} {x},{y + r * 1.3} {x - r * 1.3},{y}' fill='{f}' stroke='{color}' stroke-width='1.6'/>")
        elif shape == 'triangle':
            self.add(f"<polygon points='{x},{y - r * 1.3} {x + r * 1.2},{y + r * 0.9} {x - r * 1.2},{y + r * 0.9}' fill='{f}' stroke='{color}' stroke-width='1.6'/>")

    def path(self, pts, color, width=2.0, dash=None):
        d = ' '.join(('M' if i == 0 else 'L') + f'{x:.1f},{y:.1f}' for i, (x, y) in enumerate(pts))
        da = f" stroke-dasharray='{dash}'" if dash else ''
        self.add(f"<path d='{d}' fill='none' stroke='{color}' stroke-width='{width}' stroke-linejoin='round'{da}/>")

    def save(self, name, width_mm=174):
        h_mm = width_mm * self.h / self.w
        # width/height in px (760 px = 174 mm double-column width at print scale); double quotes for the builder
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
               f"viewBox='0 0 {self.w} {self.h}' {FONT}>\n<rect width='100%' height='100%' fill='#ffffff'/>\n"
               + '\n'.join(self.el) + '\n</svg>\n')
        open(os.path.join(FIG, name), 'w', encoding='utf-8').write(svg)
        print('written', name)


def nice_ticks(lo, hi, n=6):
    span = hi - lo
    raw = span / n
    mag = 10 ** int(f'{raw:e}'.split('e')[1])
    step = min((s * mag for s in (1, 2, 2.5, 5, 10) if s * mag >= raw), default=mag * 10)
    t = (lo // step) * step
    out = []
    while t <= hi + 1e-9:
        if t >= lo - 1e-9:
            out.append(round(t, 10))
        t += step
    return out


def load(name):
    by = collections.defaultdict(lambda: collections.defaultdict(dict))
    for r in csv.DictReader(open(os.path.join(DATA, name), encoding='utf-8')):
        by[r['setting']][int(r['scenario'])][r['policy']] = r
    return by


def dnpv(sc, p):
    return [(float(v[p]['npv']) - float(v['NONE']['npv'])) / 1e6 for _, v in sorted(sc.items())]


# ------------------------------------------------------------------------------------------------------- Fig 1
def fig1():
    s = Svg(760, 330)
    boxes = [
        (20, 40, 150, 70, 'Information state', 'twin posterior p(θ | data)', '+ demand estimate'),
        (215, 40, 160, 70, 'Rolling-horizon rule', 'enumerate feasible sets', '(budget, precedence)'),
        (420, 40, 150, 70, 'Screening model', 'Y = η·min capacity·yield', 'N_θ posterior samples'),
        (610, 40, 135, 70, 'Decision a_s', 'install options', 'pay capex'),
        (610, 200, 135, 70, 'Real factory', '(here: DES with hidden', 'true parameters)'),
        (300, 200, 190, 70, 'Bayesian update (ρ)', 'conjugate, configuration-', 'normalised observations'),
        (20, 200, 150, 70, 'Stage s → s+1', 'realised output, demand,', 'cash flow'),
    ]
    for x, y, w, h, t1, t2, t3 in boxes:
        hl = t1 in ('Information state', 'Bayesian update (ρ)')
        s.rect(x, y, w, h, '#eaf2fa' if hl else '#f4f4f4', '#0072B2' if hl else '#777777', rx=6, sw=1.4)
        s.text(x + w / 2, y + 22, t1, 13.5, 'middle', weight='bold')
        s.text(x + w / 2, y + 42, t2, 12, 'middle', MUTED)
        s.text(x + w / 2, y + 58, t3, 12, 'middle', MUTED)
    s.add("<defs><marker id='ar' markerWidth='10' markerHeight='8' refX='9' refY='4' orient='auto'>"
          "<path d='M0,0 L10,4 L0,8 z' fill='#333'/></marker></defs>")

    def arrow(x1, y1, x2, y2, lab=None, lx=None, ly=None):
        s.add(f"<line x1='{x1}' y1='{y1}' x2='{x2}' y2='{y2}' stroke='#333' stroke-width='1.6' marker-end='url(#ar)'/>")
        if lab:
            s.text(lx, ly, lab, 11.5, 'middle', MUTED)
    arrow(170, 75, 213, 75)
    arrow(375, 75, 418, 75)
    arrow(570, 75, 608, 75)
    arrow(677, 110, 677, 198, 'implement', 715, 158)
    arrow(610, 235, 492, 235, 'machine events', 551, 228)
    arrow(300, 235, 172, 235, 'posterior', 236, 228)
    arrow(95, 200, 95, 112, 'next stage', 50, 158)
    s.text(380, 312, 'Benchmarks: all-at-once · fixed plan (point values / stochastic) · myopic · bottleneck greedy · clairvoyant',
           12, 'middle', MUTED)
    s.save('fig1_framework.svg')


# ------------------------------------------------------------------------------------------------------- Fig 2
def fig2(main):
    sc = main['main']
    pols = ['MYOPIC', 'STATIC', 'ADAPT_DEM', 'BN_GREEDY', 'STATIC_SP', 'ALL', 'PI_RULE', 'PI_PLAN', 'ADAPT_PAR', 'ADAPTIVE']
    stats = {}
    for p in pols:
        d = dnpv(sc, p)
        m, lo, hi, _ = su.mean_ci(d)
        cv = su.cvar_low(d)
        clo, chi = su.boot_ci(su.cvar_low, [d], B=2000, seed=11)
        stats[p] = (m, lo, hi, cv, clo, chi)
    s = Svg(760, 420)
    L, R, T, B = 215, 740, 30, 360
    xmin, xmax = -1.5, 10.0
    X = lambda v: L + (v - xmin) / (xmax - xmin) * (R - L)
    for t in nice_ticks(xmin, xmax, 8):
        s.line(X(t), T, X(t), B, GRID if t else '#888888', 1)
        s.text(X(t), B + 18, f'{t:g}', 12, 'middle', MUTED)
    s.text((L + R) / 2, B + 42, 'Incremental NPV versus no investment [M EUR]', 13, 'middle')
    rowh = (B - T) / len(pols)
    for i, p in enumerate(pols):
        y = T + rowh * (i + 0.5)
        m, lo, hi, cv, clo, chi = stats[p]
        s.text(L - 10, y + 4, LABEL[p], 12.5, 'end', INK, 'bold' if p == 'ADAPTIVE' else 'normal')
        c = COL[p] if p not in ('MYOPIC', 'BN_GREEDY', 'PI_RULE') else '#777777'
        s.line(X(lo), y - 5, X(hi), y - 5, c, 2)
        s.marker(X(m), y - 5, 'circle', c, 5)
        s.line(X(clo), y + 7, X(chi), y + 7, c, 1.2, '3,2')
        s.marker(X(cv), y + 7, 'diamond', c, 4.2, '#ffffff')
    # legend
    s.marker(L + 10, 14, 'circle', INK, 4.5)
    s.text(L + 22, 18, 'mean with 95 % CI', 12, 'start', MUTED)
    s.marker(L + 175, 14, 'diamond', INK, 4, '#ffffff')
    s.text(L + 187, 18, 'CVaR10 (mean of worst 10 %) with 95 % bootstrap CI', 12, 'start', MUTED)
    s.save('fig2_value_risk.svg')


# ------------------------------------------------------------------------------------------------------- Fig 3
def fig3(main):
    sc = main['main']
    s = Svg(760, 360)
    # (a) ECDF
    L, R, T, B = 60, 360, 25, 290
    xmin, xmax = -2, 20
    X = lambda v: L + (v - xmin) / (xmax - xmin) * (R - L)
    Y = lambda q: B - q * (B - T)
    for t in nice_ticks(xmin, xmax, 6):
        s.line(X(t), T, X(t), B, GRID if t else '#888888')
        s.text(X(t), B + 17, f'{t:g}', 12, 'middle', MUTED)
    for q in (0, 0.25, 0.5, 0.75, 1.0):
        s.line(L, Y(q), R, Y(q), GRID)
        s.text(L - 6, Y(q) + 4, f'{q:g}', 12, 'end', MUTED)
    s.text((L + R) / 2, B + 38, 'Incremental NPV [M EUR]', 13, 'middle')
    s.text(18, (T + B) / 2, 'Cumulative share of scenarios', 13, 'middle', rotate=-90)
    s.text(L, T - 8, '(a)', 13, 'start', weight='bold')
    dashes = {'ALL': '6,3', 'STATIC': '2,3', 'STATIC_SP': '8,3,2,3', 'ADAPTIVE': None}
    for p in ('ALL', 'STATIC', 'STATIC_SP', 'ADAPTIVE'):
        d = sorted(dnpv(sc, p))
        n = len(d)
        pts = [(X(d[0]), Y(0))]
        for i, v in enumerate(d):
            pts += [(X(v), Y(i / n)), (X(v), Y((i + 1) / n))]
        s.path(pts, COL[p], 2.2 if p == 'ADAPTIVE' else 1.8, dashes[p])
    ly = 190
    for p in ('ADAPTIVE', 'STATIC_SP', 'ALL', 'STATIC'):
        s.path([(X(10.5), Y(0) - (ly - 25)), (X(13), Y(0) - (ly - 25))], COL[p], 2.2, dashes[p])
        s.text(X(13.4), Y(0) - (ly - 25) + 4, LABEL[p], 11.5, 'start', INK)
        ly -= 20
    # (b) paired differences vs demand factor
    L2, R2 = 450, 740
    dem = [float(next(iter(v.values()))['dem_factor']) for _, v in sorted(sc.items())]
    ad = dnpv(sc, 'ADAPTIVE')
    diffs = {q: [a - b for a, b in zip(ad, dnpv(sc, q))] for q in ('STATIC', 'ALL')}
    ymin, ymax = -2.0, 5.0
    X2 = lambda v: L2 + (v - 0.8) / 0.4 * (R2 - L2)
    Y2 = lambda v: B - (v - ymin) / (ymax - ymin) * (B - T)
    for t in (0.8, 0.9, 1.0, 1.1, 1.2):
        s.line(X2(t), T, X2(t), B, GRID)
        s.text(X2(t), B + 17, f'{t:.1f}', 12, 'middle', MUTED)
    for t in nice_ticks(ymin, ymax, 7):
        s.line(L2, Y2(t), R2, Y2(t), GRID if t else '#888888')
        s.text(L2 - 6, Y2(t) + 4, f'{t:g}', 12, 'end', MUTED)
    s.text((L2 + R2) / 2, B + 38, 'True demand level / forecast', 13, 'middle')
    s.text(L2 - 38, (T + B) / 2, 'Paired difference [M EUR]', 13, 'middle', rotate=-90)
    s.text(L2, T - 8, '(b)', 13, 'start', weight='bold')
    for q, shape in (('ALL', 'triangle'), ('STATIC', 'circle')):
        for x, y in zip(dem, diffs[q]):
            s.marker(X2(x), Y2(max(ymin, min(ymax, y))), shape, COL[q], 3.0, COL[q] if q == 'STATIC' else '#ffffff')
    s.marker(L2 + 12, T + 10, 'circle', COL['STATIC'], 3.5)
    s.text(L2 + 22, T + 14, 'Adaptive − fixed plan (point values)', 11.5)
    s.marker(L2 + 12, T + 28, 'triangle', COL['ALL'], 3.5, '#ffffff')
    s.text(L2 + 22, T + 32, 'Adaptive − all-at-once', 11.5)
    s.save('fig3_distribution.svg')


# ------------------------------------------------------------------------------------------------------- Fig 4
def fig4(voi, res):
    v = voi['main']['mean_model_value']
    f = res['main']['factorial']
    s = Svg(760, 340)
    L, R, T, B = 70, 400, 30, 270
    seq = [('STATIC', 'Fixed plan\n(point values)'), ('STATIC_SP', 'Fixed plan\n(stochastic)'),
           ('ADAPTIVE', 'Adaptive\nwith twin'), ('CLAIRVOYANT', 'Clairvoyant\nplan')]
    ymin, ymax = 7.0, 9.0
    Y = lambda x: B - (x - ymin) / (ymax - ymin) * (B - T)
    for t in nice_ticks(ymin, ymax, 4):
        s.line(L, Y(t), R, Y(t), GRID)
        s.text(L - 6, Y(t) + 4, f'{t:.1f}', 12, 'end', MUTED)
    s.text(20, (T + B) / 2, 'Model-world value [M EUR]', 13, 'middle', rotate=-90)
    s.text(L, T - 10, '(a)', 13, 'start', weight='bold')
    prev = None
    for i, (p, lab) in enumerate(seq):
        cx = L + (R - L) / len(seq) * (i + 0.5)
        val = v[p]
        c = COL[p] if p != 'CLAIRVOYANT' else '#555555'
        if prev is not None:
            px = L + (R - L) / len(seq) * (i - 0.5)
            s.line(px, Y(prev), cx, Y(prev), '#999999', 1.2, '4,3')
            s.line(cx, Y(prev), cx, Y(val), '#0072B2', 2.0)
            s.text(cx + 8, (Y(prev) + Y(val)) / 2 + 4, f'+{val - prev:.2f}', 12, 'start', '#0072B2', 'bold')
        s.marker(cx, Y(val), 'circle', c, 6.5)
        s.text(cx, Y(val) - 12, f'{val:.2f}', 12.5, 'middle')
        for k, part in enumerate(lab.split(chr(10))):
            s.text(cx, B + 17 + 14 * k, part, 11.5, 'middle', MUTED)
        prev = val
    # (b) factorial
    L2, R2 = 520, 740
    items = [('Demand learning\n(main effect)', f['demand_main']), ('Parameter learning\n(main effect)', f['parameter_main']),
             ('Interaction', f['interaction']), ('Total, adaptive −\nfixed (point values)', f['total'])]
    xmin, xmax = -1.0, 2.0
    X = lambda x: L2 + (x - xmin) / (xmax - xmin) * (R2 - L2)
    for t in nice_ticks(xmin, xmax, 6):
        s.line(X(t), T, X(t), B, GRID if t else '#888888')
        s.text(X(t), B + 17, f'{t:g}', 12, 'middle', MUTED)
    s.text((L2 + R2) / 2, B + 38, 'Realised value [M EUR]', 13, 'middle')
    s.text(L2 - 135, T - 10, '(b)', 13, 'start', weight='bold')
    rh = (B - T) / len(items)
    for i, (lab, val) in enumerate(items):
        y = T + rh * (i + 0.5)
        s.rect(min(X(0), X(val)), y - 11, abs(X(val) - X(0)), 22, '#0072B2' if val >= 0 else '#D55E00', rx=2)
        s.text(X(val) + (6 if val >= 0 else -6), y + 4, f'{val:+.2f}', 12, 'start' if val >= 0 else 'end')
        for k, part in enumerate(lab.split('\n')):
            s.text(L2 - 8, y - 2 + 14 * k - (7 if '\n' in lab else -2), part, 11.5, 'end', INK)
    s.save('fig4_value_of_information.svg')


# ------------------------------------------------------------------------------------------------------- Fig 5
def fig5(res):
    st = res['main']['stage_short']
    s = Svg(760, 330)
    pols = ['NONE', 'STATIC', 'STATIC_SP', 'ADAPT_DEM', 'ADAPTIVE', 'ALL']
    L, R, T, B = 70, 560, 25, 270
    Y = lambda q: B - q * (B - T)
    for q in (0, 0.2, 0.4, 0.6, 0.8):
        s.line(L, Y(q), R, Y(q), GRID)
        s.text(L - 6, Y(q) + 4, f'{int(q * 100)} %', 12, 'end', MUTED)
    s.text(20, (T + B) / 2, 'Scenarios with output < 95 % of demand', 13, 'middle', rotate=-90)
    gw = (R - L) / 4
    bw = gw * 0.8 / len(pols)
    for k in range(4):
        x0 = L + gw * k + gw * 0.1
        s.text(L + gw * (k + 0.5), B + 18, f'Stage {k + 1}', 12.5, 'middle')
        for j, p in enumerate(pols):
            q = st[p][k]['p_short']
            s.rect(x0 + j * bw + 1, Y(q), bw - 2, B - Y(q), COL[p], rx=1.5)
    s.line(L, B, R, B, '#888888')
    for j, p in enumerate(pols):
        y = T + 10 + j * 22
        s.rect(585, y - 10, 14, 14, COL[p], rx=2)
        s.text(606, y + 2, LABEL[p], 12)
    s.text(585, T + 10 + len(pols) * 22 + 12, 'Stage demand forecast:', 11.5, 'start', MUTED)
    s.text(585, T + 10 + len(pols) * 22 + 28, '3 500 / 4 500 / 5 200 / 5 800', 11.5, 'start', MUTED)
    s.text(585, T + 10 + len(pols) * 22 + 44, 'units per month', 11.5, 'start', MUTED)
    s.save('fig5_undercapacity.svg')


# ------------------------------------------------------------------------------------------------------- Fig 6
def fig6(res):
    e = res['econ']
    tags = [t for t in e if t != 'base']
    order = ['base'] + tags
    s = Svg(760, 470)
    L, T = 150, 40
    B = T + 26 * len(order)
    panels = [('ad_st', 'Adaptive − fixed plan (point values)', 370, -0.5, 3.0),
              ('ad_all', 'Adaptive − all-at-once', 590, -4.0, 1.0)]
    for i, t in enumerate(order):
        y = T + 26 * (i + 0.5)
        s.text(L - 8, y + 4, t, 12, 'end', INK, 'bold' if t == 'base' else 'normal')
        if i % 2 == 0:
            s.rect(L, y - 13, 590, 26, '#f6f6f6')
    x0 = L + 10
    for key, title, width_end, xmin, xmax in panels:
        x1 = width_end + (0 if key == 'ad_st' else 150)
        xs = x0 if key == 'ad_st' else 560
        xe = 470 if key == 'ad_st' else 740
        X = lambda v, xs=xs, xe=xe, xmin=xmin, xmax=xmax: xs + (v - xmin) / (xmax - xmin) * (xe - xs)
        for tck in nice_ticks(xmin, xmax, 5):
            s.line(X(tck), T, X(tck), B, GRID if tck else '#777777', 1)
            s.text(X(tck), B + 17, f'{tck:g}', 12, 'middle', MUTED)
        s.text((xs + xe) / 2, T - 14, title, 12.5, 'middle', INK, 'bold')
        for i, t in enumerate(order):
            y = T + 26 * (i + 0.5)
            r = e[t][key]
            if not r:
                continue
            c = '#0072B2' if r['lo'] > 0 else ('#D55E00' if r['hi'] < 0 else '#777777')
            s.line(X(max(xmin, r['lo'])), y, X(min(xmax, r['hi'])), y, c, 2.2)
            s.marker(X(max(xmin, min(xmax, r['mean']))), y, 'circle', c, 4.5)
    s.text(450, B + 40, 'Mean paired difference in incremental NPV with 95 % CI [M EUR], 100 scenarios per setting', 12.5, 'middle')
    s.save('fig6_sensitivity.svg')


# ------------------------------------------------------------------------------------------------------- Fig 7
def fig7(voi):
    s = Svg(760, 340)
    lams = [0.0, 0.5, 1.0, 1.5]
    get = {0.0: voi['epistemic']['lambda=0.0'], 0.5: voi['epistemic']['lambda=0.5'], 1.0: voi['main']['main'],
           1.5: voi['epistemic']['lambda=1.5']}
    L, R, T, B = 70, 370, 25, 270
    ymax = 1.6
    X = lambda l: L + l / 1.5 * (R - L)
    Y = lambda v: B - v / ymax * (B - T)
    for t in (0, 0.4, 0.8, 1.2, 1.6):
        s.line(L, Y(t), R, Y(t), GRID)
        s.text(L - 6, Y(t) + 4, f'{t:.1f}', 12, 'end', MUTED)
    for l in lams:
        s.text(X(l), B + 17, f'{l:g}', 12, 'middle', MUTED)
    s.text((L + R) / 2, B + 38, 'Epistemic-uncertainty scale λ', 13, 'middle')
    s.text(20, (T + B) / 2, 'Gap to clairvoyant plan [M EUR]', 13, 'middle', rotate=-90)
    s.text(L, T - 8, '(a)', 13, 'start', weight='bold')
    shapes = {'STATIC': 'circle', 'ALL': 'triangle', 'STATIC_SP': 'square', 'ADAPT_DEM': 'diamond', 'ADAPTIVE': 'circle'}
    for p in ('STATIC', 'ALL', 'ADAPT_DEM', 'STATIC_SP', 'ADAPTIVE'):
        pts = [(X(l), Y(get[l]['evpi'][p])) for l in lams]
        s.path(pts, COL[p], 2.4 if p == 'ADAPTIVE' else 1.7)
        for x, y in pts:
            s.marker(x, y, shapes[p], COL[p], 4.2, COL[p] if p in ('ADAPTIVE', 'STATIC') else '#ffffff')
        lab_y = Y(get[1.5]['evpi'][p])
        s.text(R + 8, lab_y + 4, LABEL[p], 11, 'start', INK)
    # (b) first-stage regret
    fr = voi['main']['main']['first_stage_regret']
    acts = sorted(fr, key=lambda a: fr[a]['mean'])[:8]
    L2, R2 = 570, 725
    xmax = 1.8
    X2 = lambda v: L2 + v / xmax * (R2 - L2)
    rh = (B - T) / len(acts)
    for t in (0, 0.5, 1.0, 1.5):
        s.line(X2(t), T, X2(t), B, GRID if t else '#888888')
        s.text(X2(t), B + 17, f'{t:g}', 12, 'middle', MUTED)
    s.text((L2 + R2) / 2, B + 38, 'Commitment regret [M EUR]', 13, 'middle')
    s.text(L2 - 85, T - 8, '(b)', 13, 'start', weight='bold')
    for i, a in enumerate(acts):
        y = T + rh * (i + 0.5)
        r = fr[a]
        s.text(L2 - 8, y + 4, a.replace('wait', 'wait (nothing)'), 12, 'end', INK, 'bold' if a == 'AS2+FRB' else 'normal')
        s.line(X2(0), y, X2(r['max']), y, '#bbbbbb', 1.5)
        s.marker(X2(r['mean']), y, 'circle', '#0072B2', 4.5)
        s.marker(X2(r['max']), y, 'diamond', '#D55E00', 4, '#ffffff')
    s.marker(L2 - 70, B + 58, 'circle', '#0072B2', 4)
    s.text(L2 - 60, B + 62, 'mean', 11.5)
    s.marker(L2 - 10, B + 58, 'diamond', '#D55E00', 4, '#ffffff')
    s.text(L2, B + 62, 'maximum over 200 scenarios', 11.5)
    s.save('fig7_epistemic_first_stage.svg')


def main():
    res = json.load(open(os.path.join(DATA, 'results.json')))
    voi = json.load(open(os.path.join(DATA, 'voi.json')))
    main_ = load('main.csv')
    fig1()
    fig2(main_)
    fig3(main_)
    fig4(voi['main'], res)
    fig5(res)
    fig6(res)
    fig7(voi)


if __name__ == '__main__':
    main()
