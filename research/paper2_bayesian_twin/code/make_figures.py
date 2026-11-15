"""Publication figures of paper 2 as SVG (standard library only).

Conventions: white background, Arial, 1 SVG user unit = 1 pt at printed size; single column 90 mm (255 pt) or double
column 190 mm (539 pt); smallest text 9 pt (tick labels 9 pt, axis titles 9.5 pt, panel letters 10 pt bold).
Colours: Okabe-Ito palette (colour-blind safe) + distinct markers / dash patterns as redundant encoding.
No figure titles inside the images (captions are in the manuscript). All plotted values are SIMULATED.
Usage: python make_figures.py      (needs data/results.json from analyse.py)
"""
import json
import os

import p2common as c

MM = 72 / 25.4
W1, W2 = 90 * MM, 190 * MM
FONT = 'Arial, Helvetica, sans-serif'
INK, INK2, GRID, AX = '#1a1a1a', '#4d4d4d', '#e3e3e3', '#666666'
OI = {'blue': '#0072B2', 'orange': '#E69F00', 'green': '#009E73', 'verm': '#D55E00', 'sky': '#56B4E9',
      'purple': '#CC79A7', 'black': '#000000', 'grey': '#999999'}
STYLE = {   # method -> (label, colour, marker, dash)
    'B0': ('B0 design model', OI['grey'], 'square', ''),
    'B1': ('B1 one-time calibration', OI['purple'], 'diamond', '4,2'),
    'B2': ('B2 rolling re-calibration', OI['sky'], 'triangle', '2,2'),
    'NV': ('NV persistence', OI['orange'], 'tri_down', '6,2,1,2'),
    'NVD': ('NVD persistence + discrepancy', OI['orange'], 'tri_down', ''),
    'P0': ('P0 frozen prior predictive', OI['black'], 'circle_open', '1,2'),
    'P10': ('P10 Bayesian, ρ = 1', OI['green'], 'triangle', '4,2'),
    'P07': ('P07 Bayesian, ρ = 0.7', OI['blue'], 'circle', '4,2'),
    'P07D': ('P07D Bayesian + discrepancy', OI['verm'], 'circle', ''),
    'B0D': ('B0D design + discrepancy', OI['grey'], 'square', ''),
    'B2D': ('B2D rolling + discrepancy', OI['sky'], 'triangle', ''),
    'P10D': ('P10D ρ = 1 + discrepancy', OI['green'], 'triangle', ''),
}


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


class Svg:
    def __init__(self, w, h, desc):
        self.w, self.h = w, h
        self.o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w / MM:.1f}mm" height="{h / MM:.1f}mm" '
                  f'viewBox="0 0 {w:.1f} {h:.1f}" font-family="{FONT}">',
                  f'<desc>{esc(desc)}</desc>', f'<rect width="{w:.1f}" height="{h:.1f}" fill="#ffffff"/>']

    def add(self, s):
        self.o.append(s)

    def text(self, x, y, s, size=9, anchor='start', fill=INK, weight='normal', rot=None, italic=False):
        tr = f' transform="rotate({rot} {x:.1f} {y:.1f})"' if rot else ''
        st = ' font-style="italic"' if italic else ''
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="{anchor}" fill="{fill}" '
                 f'font-weight="{weight}"{st}{tr}>{esc(s)}</text>')

    def line(self, x1, y1, x2, y2, col=AX, w=0.6, dash=''):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="{w}"{d}/>')

    def rect(self, x, y, w, h, fill='none', stroke=INK, sw=0.8, rx=0, dash=''):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" '
                 f'stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def marker(self, x, y, kind, col, r=2.6):
        if kind == 'circle':
            self.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{col}" stroke="#ffffff" stroke-width="0.5"/>')
        elif kind == 'circle_open':
            self.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="#ffffff" stroke="{col}" stroke-width="0.9"/>')
        elif kind == 'square':
            self.add(f'<rect x="{x - r:.1f}" y="{y - r:.1f}" width="{2 * r:.1f}" height="{2 * r:.1f}" fill="{col}" stroke="#ffffff" stroke-width="0.5"/>')
        elif kind == 'diamond':
            q = r * 1.3
            self.add(f'<path d="M{x:.1f},{y - q:.1f} L{x + q:.1f},{y:.1f} L{x:.1f},{y + q:.1f} L{x - q:.1f},{y:.1f} Z" fill="{col}" stroke="#ffffff" stroke-width="0.5"/>')
        elif kind in ('triangle', 'tri_down'):
            q = r * 1.25
            sgn = 1 if kind == 'triangle' else -1
            self.add(f'<path d="M{x:.1f},{y - sgn * q:.1f} L{x + q:.1f},{y + sgn * q * 0.8:.1f} L{x - q:.1f},{y + sgn * q * 0.8:.1f} Z" fill="{col}" stroke="#ffffff" stroke-width="0.5"/>')

    def save(self, name):
        self.add('</svg>')
        p = os.path.join(c.FIG, name)
        open(p, 'w', encoding='utf-8').write('\n'.join(self.o))
        return p


class Axes:
    """Cartesian panel inside an Svg."""

    def __init__(self, svg, x, y, w, h, xr, yr, xticks, yticks, xlabel='', ylabel='', yfmt='{:g}', xfmt='{:g}', grid=True):
        self.s, self.x, self.y, self.w, self.h, self.xr, self.yr = svg, x, y, w, h, xr, yr
        for t in yticks:
            yy = self.Y(t)
            if grid:
                svg.line(x, yy, x + w, yy, GRID, 0.5)
            svg.text(x - 3, yy + 3.1, yfmt.format(t), 9, 'end', INK2)
        for t in xticks:
            svg.line(self.X(t), y + h, self.X(t), y + h + 2.5, AX, 0.6)
            svg.text(self.X(t), y + h + 11, xfmt.format(t), 9, 'middle', INK2)
        svg.line(x, y + h, x + w, y + h, AX, 0.7)
        svg.line(x, y, x, y + h, AX, 0.7)
        if xlabel:
            svg.text(x + w / 2, y + h + 23, xlabel, 9.5, 'middle')
        if ylabel:
            svg.text(x - 28, y + h / 2, ylabel, 9.5, 'middle', rot=-90)

    def X(self, v):
        return self.x + (v - self.xr[0]) / (self.xr[1] - self.xr[0]) * self.w

    def Y(self, v):
        v = max(min(v, self.yr[1]), self.yr[0])
        return self.y + self.h - (v - self.yr[0]) / (self.yr[1] - self.yr[0]) * self.h

    def series(self, pts, col, marker=None, dash='', width=1.3):
        d = ' '.join(f'{"M" if i == 0 else "L"}{self.X(a):.1f},{self.Y(b):.1f}' for i, (a, b) in enumerate(pts))
        dd = f' stroke-dasharray="{dash}"' if dash else ''
        self.s.add(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{width}"{dd} stroke-linejoin="round"/>')
        if marker:
            for a, b in pts:
                self.s.marker(self.X(a), self.Y(b), marker, col)

    def band(self, lo, hi, col, op=0.18):
        pts = [(self.X(a), self.Y(b)) for a, b in lo] + [(self.X(a), self.Y(b)) for a, b in reversed(hi)]
        d = 'M' + ' L'.join(f'{a:.1f},{b:.1f}' for a, b in pts) + ' Z'
        self.s.add(f'<path d="{d}" fill="{col}" fill-opacity="{op}" stroke="none"/>')

    def hline(self, v, col=INK2, dash='3,2', w=0.8):
        self.s.line(self.x, self.Y(v), self.x + self.w, self.Y(v), col, w, dash)


def panel_letter(svg, x, y, s):
    svg.text(x, y, s, 10, 'start', INK, 'bold')


def legend(svg, x, y, items, dy=11.5, cols=1, colw=150):
    for i, (lab, col, mk, dash) in enumerate(items):
        cx = x + (i % cols) * colw
        cy = y + (i // cols) * dy
        dd = f' stroke-dasharray="{dash}"' if dash else ''
        svg.add(f'<line x1="{cx:.1f}" y1="{cy:.1f}" x2="{cx + 16:.1f}" y2="{cy:.1f}" stroke="{col}" stroke-width="1.3"{dd}/>')
        if mk:
            svg.marker(cx + 8, cy, mk, col)
        svg.text(cx + 20, cy + 3.1, lab, 9)


def R():
    return json.load(open(os.path.join(c.DATA, 'results.json'), encoding='utf-8'))


# ====================================================================== Figure 1: method overview (diagram)
def arrow_defs(svg):
    svg.add('<defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">'
            f'<path d="M0,0 L8,4 L0,8 Z" fill="{INK}"/></marker>'
            '<marker id="ahv" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">'
            f'<path d="M0,0 L8,4 L0,8 Z" fill="{OI["verm"]}"/></marker></defs>')


def arrow(svg, pts, col=INK, dash='', label=None, lx=None, ly=None, anchor='middle', mid='ah'):
    d = 'M' + ' L'.join(f'{a:.1f},{b:.1f}' for a, b in pts)
    dd = f' stroke-dasharray="{dash}"' if dash else ''
    svg.add(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="0.9"{dd} marker-end="url(#{mid})"/>')
    if label:
        svg.text(lx, ly, label, 9, anchor, col, italic=True)


def box(svg, x, y, w, h, title, lines, fill='#ffffff', stroke=INK, tcol=INK):
    svg.rect(x, y, w, h, fill, stroke, 0.9, 3)
    svg.text(x + w / 2, y + 13, title, 9.5, 'middle', tcol, 'bold')
    for i, s in enumerate(lines):
        svg.text(x + w / 2, y + 25.5 + 11 * i, s, 9, 'middle', INK)


def fig1():
    s = Svg(W2, 262, 'Information loop of the uncertainty-aware digital twin with sequential conjugate updating')
    arrow_defs(s)
    bw, bh, gx = 118, 56, 16.6
    xs = [8 + i * (bw + gx) for i in range(4)]
    yT, yA, yB = 8, 84, 182
    blue_f, verm_f, grey_f = '#e6f1f8', '#fbe9df', '#f2f2f2'
    box(s, xs[2], yT, bw, 50, 'Design statements', ['MTBF, MTTR, cycle, scrap', 'confidence = equivalent data'], grey_f)
    box(s, xs[3], yT, bw, 50, 'Station-level knowledge', ['capacities, bottleneck', '→ improvement, investment'], grey_f)
    box(s, xs[0], yA, bw, bh, 'Physical FMS', ['here: hidden true factory', '(virtual ramp-up)', 'machine state events'])
    box(s, xs[1], yA, bw, bh, 'Sufficient statistics', ['failures n, exposure T', 'repairs k, Σr; scrap x, N', 'log cycle ratio: n, mean, S'])
    box(s, xs[2], yA, bw, bh, 'Conjugate update', ['Gamma–Poisson, Gamma–', 'exponential, NIG, Beta–', 'binomial; forgetting ρ'], blue_f)
    box(s, xs[3], yA, bw, bh, 'Posterior of θ', ['per station: MTBF, MTTR,', 'speed factor, cycle log-sd,', 'scrap probability'], blue_f)
    box(s, xs[3], yB, bw, bh, 'Nested Monte Carlo', ['outer: draws of θ', '(epistemic)', 'inner: DES runs (aleatory)'], blue_f)
    box(s, xs[2], yB, bw, bh, 'Predictive distribution', ['of Y(k+1): mean, quantiles,', 'epistemic / aleatory', 'variance split'], blue_f)
    box(s, xs[1], yB, bw, bh, 'Discrepancy layer', ['NIG on log error e(k)', 'with forgetting: shifts the', 'mean, widens the interval'], verm_f, OI['verm'])
    box(s, xs[0], yB, bw, bh, 'Frozen prediction record', ['append-only; written', 'before data of k+1 exist', '(P0 at design freeze)'])
    ym = yA + bh / 2
    for i in range(3):
        arrow(s, [(xs[i] + bw, ym), (xs[i + 1] - 2, ym)])

    arrow(s, [(xs[2] + bw / 2, yT + 50), (xs[2] + bw / 2, yA - 2)], label='priors (k = 0)', lx=xs[2] + bw / 2 + 4, ly=yT + 63, anchor='start')
    arrow(s, [(xs[3] + bw / 2, yA), (xs[3] + bw / 2, yT + 52)], label='means', lx=xs[3] + bw / 2 + 4, ly=yT + 63, anchor='start')
    arrow(s, [(xs[3] + bw / 2, yA + bh), (xs[3] + bw / 2, yB - 2)], label='samples of θ', lx=xs[3] + bw / 2 + 4, ly=yA + bh + 22, anchor='start')
    yb = yB + bh / 2
    arrow(s, [(xs[3], yb), (xs[2] + bw + 2, yb)])
    arrow(s, [(xs[2], yb), (xs[1] + bw + 2, yb)])
    arrow(s, [(xs[1], yb - 8), (xs[0] + bw + 2, yb - 8)])
    arrow(s, [(xs[0] + bw, yb + 10), (xs[1] - 2, yb + 10)], col=OI['verm'], label='', mid='ahv')
    s.text(xs[0] + bw + gx / 2, yb + 26, 'e(k)', 9, 'middle', OI['verm'], italic=True)
    arrow(s, [(xs[0] + bw / 2, yA + bh), (xs[0] + bw / 2, yB - 2)], col=OI['verm'], dash='3,2', mid='ahv',
          label='realised Y(k+1)', lx=xs[0] + bw / 2 + 4, ly=yA + bh + 22, anchor='start')
    # loop annotation
    s.text(8, 248, 'Monthly loop: learn from months 1..k → freeze forecast for month k+1 → observe month k+1 → score and learn.', 9, 'start', INK2)
    return s.save('fig1_method_loop.svg')


def main():
    import figs_results
    print(fig1())
    res = R()
    for f in figs_results.ALL:
        print(f(res))


if __name__ == '__main__':
    main()
