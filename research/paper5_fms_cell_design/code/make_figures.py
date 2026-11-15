"""All figures of paper 5 as SVG (standard library only). White background, Arial, Okabe-Ito colours, no titles.

usage: python make_figures.py      (needs data/mva_results.json from mva_models.py and data/summary.json, data/raw/*.json)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mva_models as M                                   # noqa: E402

FIG = os.path.join(HERE, '..', 'figures')
DATA = os.path.join(HERE, '..', 'data')
BLUE, VERM, GREEN, PURP, ORNG, SKY, BLACK, GREY, LGREY = ('#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00',
                                                          '#56B4E9', '#000000', '#666666', '#BBBBBB')
W = 660                                                    # viewBox width; printed at 174 mm -> 12 px = 9 pt


class SVG:
    def __init__(self, h, w=W, mm=174):
        self.w, self.h, self.mm, self.e = w, h, mm, []

    def add(self, s):
        self.e.append(s)

    def line(self, x1, y1, x2, y2, c=BLACK, sw=1.0, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{c}" stroke-width="{sw}"{d}/>')

    def poly(self, pts, c=BLACK, sw=2.0, dash=None, fill='none'):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        p = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
        self.add(f'<polyline points="{p}" fill="{fill}" stroke="{c}" stroke-width="{sw}" stroke-linejoin="round"{d}/>')

    def rect(self, x, y, w, h, fill='none', c=BLACK, sw=1.0, rx=0):
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" stroke="{c}" stroke-width="{sw}"/>')

    def circle(self, x, y, r, fill=BLACK, c='white', sw=1.0):
        self.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}" stroke="{c}" stroke-width="{sw}"/>')

    def marker(self, x, y, kind, c, r=4.5):
        if kind == 'o':
            self.circle(x, y, r, fill=c, c='white', sw=1.2)
        elif kind == 's':
            self.add(f'<rect x="{x - r:.1f}" y="{y - r:.1f}" width="{2 * r}" height="{2 * r}" fill="{c}" stroke="white" stroke-width="1.2"/>')
        elif kind == '^':
            self.add(f'<polygon points="{x:.1f},{y - r - 1:.1f} {x - r - 0.5:.1f},{y + r:.1f} {x + r + 0.5:.1f},{y + r:.1f}" fill="{c}" stroke="white" stroke-width="1.2"/>')
        elif kind == 'd':
            self.add(f'<polygon points="{x:.1f},{y - r - 1:.1f} {x + r + 1:.1f},{y:.1f} {x:.1f},{y + r + 1:.1f} {x - r - 1:.1f},{y:.1f}" fill="{c}" stroke="white" stroke-width="1.2"/>')

    def text(self, x, y, s, size=12, anchor='start', c=BLACK, weight='normal', rot=None, italic=False):
        t = f' transform="rotate({rot} {x:.1f} {y:.1f})"' if rot else ''
        st = ' font-style="italic"' if italic else ''
        s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="{anchor}" fill="{c}" font-weight="{weight}"{st}{t}>{s}</text>')

    def arrow(self, x1, y1, x2, y2, c=BLACK, sw=1.4, dash=None):
        mid = 'a' + c.strip('#')
        if not any(f'id="{mid}"' in e for e in self.e):
            self.e.insert(0, f'<defs><marker id="{mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
                             f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker></defs>')
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{c}" stroke-width="{sw}" marker-end="url(#{mid})"{d}/>')

    def save(self, name):
        hmm = self.mm * self.h / self.w
        s = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" '
             f'font-family="Arial, Helvetica, sans-serif">\n<rect width="100%" height="100%" fill="white"/>\n' + '\n'.join(self.e) + '\n</svg>\n')
        with open(os.path.join(FIG, name), 'w', encoding='utf-8') as f:
            f.write(s)
        print('wrote', name)


class Axes:
    def __init__(self, svg, x, y, w, h, xr, yr, xt, yt, xlabel, ylabel, grid=True, xfmt=str, yfmt=str):
        self.s, self.x, self.y, self.w, self.h, self.xr, self.yr = svg, x, y, w, h, xr, yr
        if grid:
            for v in yt:
                svg.line(x, self.Y(v), x + w, self.Y(v), c='#E5E5E5', sw=0.8)
        svg.line(x, y + h, x + w, y + h, c=GREY, sw=1)
        svg.line(x, y, x, y + h, c=GREY, sw=1)
        for v in xt:
            svg.line(self.X(v), y + h, self.X(v), y + h + 4, c=GREY)
            svg.text(self.X(v), y + h + 17, xfmt(v), 11, 'middle', GREY)
        for v in yt:
            svg.line(x - 4, self.Y(v), x, self.Y(v), c=GREY)
            svg.text(x - 7, self.Y(v) + 4, yfmt(v), 11, 'end', GREY)
        svg.text(x + w / 2, y + h + 36, xlabel, 12, 'middle')
        svg.text(x - 42, y + h / 2, ylabel, 12, 'middle', rot=-90)

    def X(self, v):
        return self.x + (v - self.xr[0]) / (self.xr[1] - self.xr[0]) * self.w

    def Y(self, v):
        return self.y + self.h - (v - self.yr[0]) / (self.yr[1] - self.yr[0]) * self.h


def load():
    mva = json.load(open(os.path.join(DATA, 'mva_results.json')))
    summ = json.load(open(os.path.join(DATA, 'summary.json')))
    return mva, summ


def g(summ, rules, N=12, mix='design', op=1.0, speed=20):
    return summ.get(f'{rules}|N{N}|{mix}|op{op:.3f}|x{speed}')


# ====================================================================== Fig 1 cell layout
def fig_layout():
    s = SVG(300)
    y0 = 40
    s.text(20, 22, 'Pallet rack (locations 1-12)', 12, weight='bold')
    bw, gap = 32, 4
    for i in range(12):
        x = 20 + i * (bw + gap)
        fx = BLUE if i < 8 else ORNG
        s.rect(x, y0, bw, 40, fill='#F2F2F2', c=GREY)
        s.text(x + bw / 2, y0 + 25, str(i + 1), 12, 'middle')
    # rail
    ry = 120
    s.rect(14, ry - 6, 640, 12, fill='#E8E8E8', c=GREY, sw=0.8)
    s.text(230, ry + 4, 'shuttle rail - one move at a time: t = 12 s + 2 s x |source - destination|', 11, 'middle', GREY)
    s.rect(472, ry - 14, 46, 28, fill=GREY, c=BLACK, sw=1)
    s.text(495, ry + 5, 'S', 13, 'middle', 'white', 'bold')
    # stations 13-16
    names = [('13', 'Load station L', '1 operator: unload + load'), ('14', 'HMC-01', ''), ('15', 'HMC-02', ''), ('16', 'HMC-03', '')]
    xs = [490, 535, 580, 625]
    xs = [20 + 12 * (bw + gap) + 14 + k * 46 for k in range(4)]
    for k, (loc, nm, sub) in enumerate(names):
        x = xs[k]
        s.rect(x, y0, 38, 40, fill='#FFFFFF', c=BLACK, sw=1.4)
        s.text(x + 19, y0 + 25, loc, 12, 'middle', weight='bold')
    s.text(xs[0] + 19, y0 - 6, 'L', 12, 'middle', weight='bold')
    s.text(xs[2] + 19, y0 - 6, 'HMC group H', 11, 'middle')
    # boxes below: machines and load station
    by = 160
    s.rect(xs[0] - 4, by, 46, 70, fill='#FFF7E6', c=BLACK)
    s.text(xs[0] + 19, by + 20, 'L', 13, 'middle', weight='bold')
    s.text(xs[0] + 19, by + 38, '147 s', 11, 'middle')
    s.text(xs[0] + 19, by + 54, 'per part', 11, 'middle')
    for k in range(1, 4):
        s.rect(xs[k] - 3, by, 44, 70, fill='#EAF3FA', c=BLACK)
        s.text(xs[k] + 19, by + 20, f'H{k}', 13, 'middle', weight='bold')
        s.text(xs[k] + 19, by + 38, '358.5 s', 11, 'middle')
        s.text(xs[k] + 19, by + 54, 'per part', 11, 'middle')
    for k in range(4):
        s.line(xs[k] + 19, y0 + 40, xs[k] + 19, by, c=GREY, sw=1, dash='3,3')
    # typical 3-move cycle
    s.text(20, 182, 'Typical pallet cycle when L is busy (3 moves):', 12, weight='bold')
    cyc = [('1', 'L (13) -> HMC (14-16) with a raw casting', '16 s mean'),
           ('2', 'HMC -> rack with the machined part', '29 s mean'),
           ('3', 'rack -> L for unload + reload', '25 s mean')]
    for i, (n, t, m) in enumerate(cyc):
        yy = 204 + i * 20
        s.circle(30, yy - 4, 8, fill=VERM, c='white')
        s.text(30, yy, n, 10, 'middle', 'white', 'bold')
        s.text(44, yy, t, 11)
        s.text(330, yy, m, 11, 'start', GREY)
    s.text(20, 276, 'Pallets 1-8: fixture A (VC10, VC20)   Pallets 9-12: fixture B (VC30)   N <= 12 pallets in 16 locations',
           11, 'start', GREY)
    for i in range(12):
        x = 20 + i * (bw + gap)
        s.rect(x + 4, y0 + 30, bw - 8, 6, fill=BLUE if i < 8 else ORNG, c='none', sw=0)
    s.rect(20, 288, 12, 6, fill=BLUE, c='none', sw=0); s.text(36, 295, 'fixture A', 10, 'start', GREY)
    s.rect(100, 288, 12, 6, fill=ORNG, c='none', sw=0); s.text(116, 295, 'fixture B', 10, 'start', GREY)
    s.save('fig1_cell_layout.svg')


# ====================================================================== Fig 2 network + exchange time line
def fig_network(mva):
    s = SVG(330)
    s.text(10, 18, '(a)', 12, weight='bold')
    # stations as queues
    def station(x, y, label, sub, c, servers=1):
        s.rect(x, y, 60, 34, fill='white', c=BLACK)
        for k in range(1, 4):
            s.line(x + 15 * k, y, x + 15 * k, y + 34, c=GREY, sw=0.8)
        for j in range(servers):
            cy = y + 17 + (j - (servers - 1) / 2) * 30
            s.circle(x + 92, cy, 14, fill=c, c=BLACK, sw=1)
            s.line(x + 60, y + 17, x + 78, cy, c=BLACK, sw=1)
            s.line(x + 106, cy, x + 122, y + 17, c=BLACK, sw=1)
        s.text(x + 30, y - 8 - (servers - 1) * 15, label, 12, 'middle', weight='bold')
        s.text(x + 60, y + 52 + (servers - 1) * 15, sub, 11, 'middle', GREY)
        return x + 122
    xL = station(30, 80, 'Load station L', 'c = 1, D = 147 s', '#FFF1D6')
    xS = station(240, 80, 'Shuttle S', 'c = 1, D = 70 s (3 moves)', '#E5E5E5')
    xH = station(450, 80, 'HMC group H', 'c = 3, D = 358.5 s', '#DCEBF7', servers=3)
    s.arrow(xL, 97, 240, 97); s.arrow(xS, 97, 450, 97)
    s.poly([(xH, 97), (xH + 10, 97), (xH + 10, 180), (14, 180), (14, 97)], c=BLACK, sw=1.4)
    s.arrow(14, 97, 30, 97)
    s.text(330, 196, 'N pallets circulate (closed network, WIP = N)', 11, 'middle', GREY)
    # (b) time line of the single load-station location
    s.text(10, 222, '(b)', 12, weight='bold')
    B12 = mva['B'][-1]
    W = B12['W']
    segs = [('operator: unload + load', 147.0, '#F3C97A'), ('move out 16 s', 16.0, LGREY),
            ('wait W', W, '#FFFFFF'), ('move in 25 s', 25.0, LGREY), ('wait W', W, '#FFFFFF')]
    x0, y0, sc = 30, 240, 2.9
    x = x0
    for nm, d, c in segs:
        s.rect(x, y0, d * sc, 30, fill=c, c=BLACK, sw=0.8)
        x += d * sc
    s.text(x0 + 147 * sc / 2, y0 + 20, 'operator task t_L = 147 s', 11, 'middle')
    s.text(x0 + (147 + 8) * sc, y0 - 6, 'e_L = 41 s', 11, 'middle')
    s.text(x, y0 + 48, f'incl. 2W = {2 * W:.1f} s waiting for the busy shuttle', 11, 'end', GREY)
    s.line(x0, y0 + 36, x0, y0 + 64, c=GREY); s.line(x, y0 + 36, x, y0 + 64, c=GREY)
    tot = 147 + 41 + 2 * W
    s.arrow(x0 + 2, y0 + 72, x - 2, y0 + 72, c=GREY, sw=1); s.arrow(x - 2, y0 + 72, x0 + 2, y0 + 72, c=GREY, sw=1)
    s.text((x0 + x) / 2, y0 + 88, f"location 13 held per part: D_L' = {tot:.1f} s  ->  ceiling 3600/{tot:.1f} = {3600 / tot:.1f} parts/h",
           11, 'middle')
    s.save('fig2_network_blocking.svg')


# ====================================================================== Fig 3 throughput vs N
def fig_throughput(mva, summ):
    s = SVG(400)
    ax = Axes(s, 70, 20, 380, 310, (0, 12.5), (0, 32), list(range(0, 13, 2)), list(range(0, 33, 4)),
              'Number of pallets N', 'Throughput X [parts/h]')
    Ns = list(range(1, 13))
    A = [a['X_h'] for a in mva['A']]
    Bv = [b['X_h'] for b in mva['B']]
    C = mva['composite']
    s.line(ax.X(0), ax.Y(mva['static'][1]), ax.X(12.5), ax.Y(mva['static'][1]), c=GREY, sw=1.5, dash='6,4')
    s.line(ax.X(0), ax.Y(mva['bounds']['Xmax_h']), ax.X(12.5), ax.Y(mva['bounds']['Xmax_h']), c=BLACK, sw=1.2, dash='2,3')
    s.poly([(ax.X(0), ax.Y(0)), (ax.X(mva['bounds']['Nstar']), ax.Y(mva['bounds']['Xmax_h']))], c=BLACK, sw=1.2, dash='2,3')
    s.poly([(ax.X(n), ax.Y(x)) for n, x in zip(Ns, A)], c=BLUE, sw=2)
    s.poly([(ax.X(n), ax.Y(x)) for n, x in zip(Ns, Bv)], c=VERM, sw=2)
    s.poly([(ax.X(n), ax.Y(b['X_h'])) for n, b in zip(Ns, mva['B_nearest'])], c=VERM, sw=2, dash='7,3')
    # measurements
    def pts(rules, Nlist, kind, col, dx):
        for N in Nlist:
            e = g(summ, rules, N)
            if not e:
                continue
            m, h = e['X']['mean'], e['X']['ci95']
            x = ax.X(N + dx)
            s.line(x, ax.Y(m - h), x, ax.Y(m + h), c=col, sw=1.4)
            s.line(x - 4, ax.Y(m - h), x + 4, ax.Y(m - h), c=col, sw=1.4)
            s.line(x - 4, ax.Y(m + h), x + 4, ax.Y(m + h), c=col, sw=1.4)
            s.marker(x, ax.Y(m), kind, col)
    pts('before', [4, 8, 12], 's', PURP, -0.18)
    pts('after', [2, 4, 8, 12], 'o', GREEN, 0.18)
    # labels / legend
    lx, ly = 468, 30
    items = [('line', GREY, '6,4', 'Static capacity of 3 HMCs'), ('line', BLACK, '2,3', 'Asymptotic bounds (L-bound)'),
             ('line', BLUE, None, 'Model A (exact MVA)'), ('line', VERM, None, 'Model B (blocking-aware)'),
             ('line', VERM, '7,3', 'Model B, nearest-rack'), ('mk', PURP, 's', 'Virtual plant, first rules'),
             ('mk', GREEN, 'o', 'Virtual plant, revised rules')]
    for i, (t, c, d, lab) in enumerate(items):
        yy = ly + i * 22
        if t == 'line':
            s.line(lx, yy, lx + 26, yy, c=c, sw=2 if d is None else 1.5, dash=d)
        else:
            s.marker(lx + 13, yy, d, c)
        s.text(lx + 32, yy + 4, lab, 10)
    s.text(lx, ly + 7 * 22 + 6, 'error bars: 95 % CI, 5 replications', 10, 'start', GREY)
    s.save('fig3_throughput_vs_pallets.svg')


# ====================================================================== Fig 4 rule study (small multiples)
def fig_rules(summ):
    s = SVG(300)
    cfg = [('before', 'First rules'), ('fb', '+ Fixture balance'), ('nro', 'Storage/pick rules'), ('after', 'All revised')]
    cols = [PURP, SKY, ORNG, GREEN]
    panels = [('X', 'Throughput [parts/h]', (0, 24), [0, 6, 12, 18, 24]),
              ('pallets_used', 'Pallets circulating', (0, 8), [0, 2, 4, 6, 8]),
              ('max_overtaken', 'Max. orders overtaken', (0, 60), [0, 20, 40, 60])]
    pw = 160
    for p, (key, lab, yr, yt) in enumerate(panels):
        x0 = 60 + p * (pw + 52)
        ax = Axes(s, x0, 26, pw, 190, (0, 4), yr, [], yt, '', lab)
        s.text(x0 - 40, 16, '(' + 'abc'[p] + ')', 12, weight='bold')
        for i, (r, nm) in enumerate(cfg):
            e = g(summ, r)
            if not e:
                continue
            m, h = e[key]['mean'], e[key]['ci95']
            bx = ax.X(i + 0.18)
            bwid = ax.X(0.64) - ax.X(0)
            s.add(f'<path d="M{bx:.1f},{ax.Y(0):.1f} L{bx:.1f},{ax.Y(m) + 3:.1f} Q{bx:.1f},{ax.Y(m):.1f} {bx + 3:.1f},{ax.Y(m):.1f} '
                  f'L{bx + bwid - 3:.1f},{ax.Y(m):.1f} Q{bx + bwid:.1f},{ax.Y(m):.1f} {bx + bwid:.1f},{ax.Y(m) + 3:.1f} L{bx + bwid:.1f},{ax.Y(0):.1f} Z" fill="{cols[i]}"/>')
            cx = bx + bwid / 2
            s.line(cx, ax.Y(max(yr[0], m - h)), cx, ax.Y(min(yr[1], m + h)), c=BLACK, sw=1)
            s.text(cx, ax.Y(min(yr[1], m + h)) - 4, f'{m:.1f}' if key == 'X' else f'{m:.1f}', 10, 'middle', GREY)
    for i, (r, nm) in enumerate(cfg):
        x = 60 + i * 150
        s.rect(x, 268, 12, 12, fill=cols[i], c='none', sw=0)
        s.text(x + 17, 278, nm, 11)
    s.save('fig5_rule_study.svg')


# ====================================================================== Fig 5 pallet occupancy timeline (lock-in)
def fig_timeline():
    s = SVG(400)
    runs = [('E2_before_N12_s101', '(a) first rules'), ('E1_after_N12_s101', '(b) revised rules')]
    for k, (tag, lab) in enumerate(runs):
        p = os.path.join(os.environ.get('P5RAW', os.path.join(DATA, 'raw')), tag + '.json')
        if not os.path.exists(p):
            continue
        d = json.load(open(p))
        sp, t0 = d['args']['speed'], d['t0']
        y0 = 22 + k * 175
        ax = Axes(s, 70, y0, 560, 132, (0, 4), (12.5, 0.5), [0, 1, 2, 3, 4] if k == 1 else [], [1, 4, 8, 9, 12],
                  'Simulated time [h]' if k == 1 else '', 'Pallet', grid=False)
        s.text(70, y0 - 6, lab, 12, weight='bold')
        for j in d['jobs']:
            if j['code'] != 10 or not j['done_t']:
                continue
            pr = json.loads(j['params'])
            pid = pr['job.palletId']
            a, b = (j['created'] - t0) * sp / 3600, (j['done_t'] - t0) * sp / 3600
            c = BLUE if pid <= 8 else ORNG
            s.rect(ax.X(a), ax.Y(pid) - 4, max(0.8, ax.X(b) - ax.X(a)), 8, fill=c, c='none', sw=0)
        s.line(ax.X(0.5), y0, ax.X(0.5), y0 + 132, c=GREY, sw=1, dash='3,3')
        if k == 0:
            s.text(ax.X(0.5) + 4, y0 + 128, 'end of warm-up', 10, 'start', GREY)
    s.rect(70, 384, 12, 8, fill=BLUE, c='none', sw=0); s.text(86, 392, 'machining, fixture A pallet (VC10/VC20)', 11)
    s.rect(360, 384, 12, 8, fill=ORNG, c='none', sw=0); s.text(376, 392, 'machining, fixture B pallet (VC30)', 11)
    s.save('fig4_pallet_timeline.svg')


# ====================================================================== Fig 6 what-if
def fig_whatif(mva, summ):
    wi = mva['whatif']
    order = [w for w in wi]
    s = SVG(30 + 26 * len(order) + 70)
    ax = Axes(s, 316, 16, 250, 26 * len(order), (0, 32), (len(order), 0), [0, 8, 16, 24, 32], [], 'Throughput at N = 12 [parts/h]', '', grid=False)
    for v in (8, 16, 24, 32):
        s.line(ax.X(v), 16, ax.X(v), 16 + 26 * len(order), c='#E5E5E5', sw=0.8)
    base = wi[0]['X12']
    e0, e1, e4 = g(summ, 'before'), g(summ, 'after'), g(summ, 'after', op=round(100 / 140, 3))
    meas = {0: e0, 1: e1, 4: e4}
    for i, w in enumerate(order):
        y = ax.Y(i + 0.5)
        col = VERM if i == 0 else BLUE
        s.add(f'<rect x="{ax.X(0):.1f}" y="{y - 8:.1f}" width="{ax.X(w["X12"]) - ax.X(0):.1f}" height="16" rx="3" fill="{col}"/>')
        s.text(308, y + 4, w['case'], 10.5, 'end')
        xr = max(w['X12'], meas[i]['X']['mean'] + 0.6 if meas.get(i) else 0)
        s.text(ax.X(xr) + 5, y + 4, f"{w['X12']:.1f} ({(w['X12'] / base - 1) * 100:+.0f} %)", 10, 'start', GREY)
    s.line(ax.X(mva['static'][1]), 16, ax.X(mva['static'][1]), 16 + 26 * len(order), c=GREY, sw=1.5, dash='6,4')
    s.text(ax.X(mva['static'][1]) - 3, 12, 'static 29.6', 10, 'end', GREY)
    # measured points on the virtual plant
    hy = s.h - 22
    for e, row, k, c in ((e0, 0, 's', PURP), (e1, 1, 'd', GREEN), (e4, 4, 'd', GREEN)):
        if e:
            s.marker(ax.X(e['X']['mean']), ax.Y(row + 0.5), k, c, 5)
    s.marker(160, hy, 's', PURP, 5)
    s.text(170, hy + 4, 'virtual plant, first rules', 10, 'start', GREY)
    s.marker(330, hy, 'd', GREEN, 5)
    s.text(340, hy + 4, 'virtual plant, revised rules (mean of 5 runs)', 10, 'start', GREY)
    s.save('fig6_whatif.svg')


# ====================================================================== Fig 7 sensitivity
def fig_sens(mva):
    s = SVG(330)
    op = mva['sens_op']
    ax = Axes(s, 70, 20, 240, 230, (80, 212), (0, 36), [80, 110, 140, 170, 200], [0, 6, 12, 18, 24, 30, 36],
              'Mean operator time per part t_L [s]', 'X_B(12) [parts/h]')
    s.text(30, 14, '(a)', 12, weight='bold')
    series = [('L1H3', BLUE, None, '1 load station, 3 HMC'), ('L1H4', SKY, '5,3', '1 load station, 4 HMC'),
              ('L2H3', VERM, None, '2 load stations, 3 HMC'), ('L2H4', ORNG, '5,3', '2 load stations, 4 HMC')]
    for key, c, d, lab in series:
        s.poly([(ax.X(r['t_op']), ax.Y(r[key])) for r in op], c=c, sw=2, dash=d)
    s.line(ax.X(80), ax.Y(op[0]['static3']), ax.X(212), ax.Y(op[0]['static3']), c=GREY, sw=1.5, dash='6,4')
    s.line(ax.X(147), ax.Y(0), ax.X(147), ax.Y(36), c=GREY, sw=1, dash='2,3')
    s.text(ax.X(147) + 3, ax.Y(34), 'design 147 s', 10, 'start', GREY)
    mx = mva['sens_mix']
    ax2 = Axes(s, 400, 20, 240, 230, (0, 0.6), (0, 36), [0, 0.2, 0.4, 0.6], [0, 6, 12, 18, 24, 30, 36],
               'Share of VC30 in the mix', '', xfmt=lambda v: f'{v:.1f}')
    s.text(360, 14, '(b)', 12, weight='bold')
    s.poly([(ax2.X(r['vc30']), ax2.Y(r['L1'])) for r in mx], c=BLUE, sw=2)
    s.poly([(ax2.X(r['vc30']), ax2.Y(r['L2'])) for r in mx], c=VERM, sw=2)
    s.poly([(ax2.X(r['vc30']), ax2.Y(r['static'])) for r in mx], c=GREY, sw=1.5, dash='6,4')
    for i, (key, c, d, lab) in enumerate(series):
        x = 30 + (i % 2) * 200
        y = 300 + (i // 2) * 18
        s.line(x, y - 4, x + 24, y - 4, c=c, sw=2, dash=d)
        s.text(x + 30, y, lab, 10.5)
    s.line(440, 296, 464, 296, c=GREY, sw=1.5, dash='6,4')
    s.text(470, 300, 'static capacity, 3 HMC', 10.5)
    s.save('fig7_sensitivity.svg')


def main():
    os.makedirs(FIG, exist_ok=True)
    mva, summ = load()
    fig_layout()
    fig_network(mva)
    fig_throughput(mva, summ)
    fig_rules(summ)
    fig_timeline()
    fig_whatif(mva, summ)
    fig_sens(mva)


if __name__ == '__main__':
    main()
