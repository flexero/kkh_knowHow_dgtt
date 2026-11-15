"""Result figures 2-7 and the graphical abstract of paper 2 (called from make_figures.py). All values SIMULATED."""
import collections
import csv
import math
import os
import statistics

import p2common as c
from make_figures import (OI, STYLE, INK, INK2, GRID, W1, W2, Svg, Axes, legend, panel_letter, arrow_defs, arrow, box)


def load_csv(name):
    return list(csv.DictReader(open(os.path.join(c.DATA, name), encoding='utf-8')))


def mean_by_month(rows, method, key):
    d = collections.defaultdict(list)
    for r in rows:
        if r['method'] == method:
            d[int(r['month'])].append(float(r[key]))
    return {k: statistics.mean(v) for k, v in sorted(d.items())}


# ---------------------------------------------------------------- Figure 2
def fig2(res):
    rows = load_csv('rampup_main.csv')
    s = Svg(W1, 228, 'True monthly good output of 100 virtual ramp-ups with the frozen design-stage forecasts B0 and P0')
    ax = Axes(s, 46, 10, 200, 140, (0.5, 12.5), (3000, 6000), range(1, 13), [3000, 3500, 4000, 4500, 5000, 5500, 6000],
              'Month of ramp-up', 'Good output (parts/month)')
    tr = res['main']['truth_mean_by_month']
    band = res['main']['truth_p10_p90_by_month']
    ks = range(1, 13)
    p0lo, p0hi, p0m = (mean_by_month(rows, 'P0', q) for q in ('q05', 'q95', 'pred'))
    b0 = mean_by_month(rows, 'B0', 'pred')
    ax.band([(k, p0lo[k]) for k in ks], [(k, p0hi[k]) for k in ks], '#000000', 0.10)
    ax.series([(k, p0m[k]) for k in ks], OI['black'], None, '1,2', 1.2)
    ax.series([(k, b0[k]) for k in ks], OI['grey'], 'square', '', 1.2)
    ax.band([(k, band[str(k)][0]) for k in ks], [(k, band[str(k)][1]) for k in ks], OI['blue'], 0.22)
    ax.series([(k, tr[str(k)]) for k in ks], OI['blue'], 'circle', '', 1.4)
    legend(s, 20, 196, [('True output: mean and 10–90 % band', OI['blue'], 'circle', ''),
                        ('B0 design point forecast', OI['grey'], 'square', '')], dy=11)
    s.add('<rect x="20" y="214" width="16" height="7" fill="#000000" fill-opacity="0.10"/>')
    s.line(20, 217.5, 36, 217.5, OI['black'], 1.2, '1,2')
    s.text(40, 220.6, 'P0 prior predictive: mean and 90 % interval', 9)
    return s.save('fig2_rampup_truth.svg')


ACC_METHODS = ['B0', 'B1', 'B2', 'NV', 'P07', 'P10D', 'P07D']


# ---------------------------------------------------------------- Figure 3
def fig3(res):
    m = res['main']['methods']
    s = Svg(W2, 222, 'Point accuracy of the monthly output forecasts by month (100 scenarios)')
    ks = range(2, 13)
    ax = Axes(s, 44, 12, 212, 140, (1.5, 12.5), (0, 30), ks, [0, 5, 10, 15, 20, 25, 30], 'Month of ramp-up',
              'MAPE (%)')
    ax.hline(5, INK2, '3,2', 0.7)
    for meth in ACC_METHODS:
        lab, col, mk, dash = STYLE[meth]
        ax.series([(k, m[meth]['by_month_ape'][str(k)]) for k in ks], col, mk, dash)
    panel_letter(s, 4, 12, '(a)')
    bx = Axes(s, 320, 12, 212, 140, (1.5, 12.5), (0, 100), ks, [0, 20, 40, 60, 80, 100], 'Month of ramp-up',
              'Scenarios with error < 5 % (%)')
    for meth in ACC_METHODS:
        lab, col, mk, dash = STYLE[meth]
        bx.series([(k, m[meth]['by_month_share_below5'][str(k)]) for k in ks], col, mk, dash)
    panel_letter(s, 282, 12, '(b)')
    legend(s, 22, 192, [STYLE[x] for x in ACC_METHODS], dy=12.5, cols=4, colw=130)
    return s.save('fig3_accuracy.svg')


# ---------------------------------------------------------------- Figure 4
def fig4(res):
    m = res['main']['methods']
    s = Svg(W2, 212, 'Calibration versus sharpness of the 90 % prediction intervals and interval score (months 2-12)')
    ax = Axes(s, 44, 12, 205, 150, (0, 40), (0, 100), [0, 10, 20, 30, 40], [0, 20, 40, 60, 80, 90, 100],
              'Mean relative width of 90 % interval (%)', 'Empirical coverage (%)')
    ax.hline(90, OI['verm'], '3,2', 0.8)
    s.text(ax.X(40) - 2, ax.Y(90) - 4, 'nominal 90 %', 9, 'end', OI['verm'])
    pts = ['B0', 'B1', 'B2', 'P0', 'P10', 'P07', 'B0D', 'B2D', 'NVD', 'P10D', 'P07D']
    lab_pos = {'P10D': (9, 99, 'end'), 'P07D': (25, 99, 'start'), 'NVD': (9, 83, 'end'), 'B2D': (25, 80, 'start'),
               'B0D': (35.2, 100, 'end'), 'B2': (5, 38, 'start'), 'P0': (11, 12, 'start'), 'P07': (6, 20, 'start')}
    for meth in pts:
        lab, col, mk, dash = STYLE[meth]
        x, y = m[meth]['width_all'][0], m[meth]['cov90_all'][0]
        s.marker(ax.X(x), ax.Y(y), mk, col, 3.2)
        if meth in lab_pos:
            lx, ly, an = lab_pos[meth]
            if meth not in ('B0D', 'B2'):
                s.line(ax.X(x), ax.Y(y), ax.X(lx), ax.Y(ly) - 3, INK2, 0.5)
            s.text(ax.X(lx), ax.Y(ly) + (0 if meth != 'B0D' else 3) + (0 if meth != 'B2' else 3), meth, 9, an, INK)
    zero = [q for q in pts if m[q]['cov90_all'][0] < 1]
    s.line(ax.X(2.4), ax.Y(1), ax.X(13), ax.Y(26) + 3, INK2, 0.5)
    s.text(ax.X(13), ax.Y(26), ', '.join(zero) + ': 0 %', 9, 'start', INK)
    panel_letter(s, 4, 12, '(a)')
    order = sorted(pts + ['NV'], key=lambda q: m[q]['is_all'][0])
    x0, x1 = 345, 520
    lo, hi = math.log10(10), math.log10(500)
    X = lambda v: x0 + (math.log10(v) - lo) / (hi - lo) * (x1 - x0)
    top, rowh = 14, 12.4
    for t in (10, 20, 50, 100, 200, 500):
        s.line(X(t), top - 4, X(t), top + rowh * len(order), GRID, 0.5)
        s.text(X(t), top + rowh * len(order) + 11, f'{t}', 9, 'middle', INK2)
    s.text((x0 + x1) / 2, top + rowh * len(order) + 24, 'Interval score / truth (%), log scale', 9.5, 'middle')
    for i, q in enumerate(order):
        y = top + i * rowh
        v = m[q]['is_all'][0]
        col = STYLE.get(q, ('', OI['orange']))[1]
        s.rect(x0, y, X(v) - x0, rowh - 3.5, col, 'none', 0)
        s.text(x0 - 4, y + 7.5, q, 9, 'end', INK)
        s.text(X(v) + 3, y + 7.5, f'{v:.0f}', 9, 'start', INK2)
    panel_letter(s, 290, 12, '(b)')
    return s.save('fig4_calibration.svg')


# ---------------------------------------------------------------- Figure 5
def fig5(res):
    b = res['bottleneck']
    s = Svg(W2, 212, 'Bottleneck identification and station-capacity error by month (100 scenarios)')
    ks = range(1, 13)
    meths = [('B0', 'B0 design model'), ('B2', 'B2 rolling re-calibration'), ('P10', 'P10 Bayesian, ρ = 1'),
             ('P07', 'P07 Bayesian, ρ = 0.7')]
    ax = Axes(s, 44, 12, 212, 140, (0.5, 12.5), (50, 100), ks, [50, 60, 70, 80, 90, 100], 'Month of ramp-up',
              'True bottleneck identified (%)')
    for meth, _ in meths:
        col = STYLE[meth][1]
        if meth in ('B0', 'P07'):
            ax.band([(k, b[meth][str(k)]['hit_ci'][0]) for k in ks], [(k, b[meth][str(k)]['hit_ci'][1]) for k in ks], col, 0.15)
        ax.series([(k, b[meth][str(k)]['hit']) for k in ks], col, STYLE[meth][2], STYLE[meth][3])
    panel_letter(s, 4, 12, '(a)')
    bx = Axes(s, 320, 12, 212, 140, (0.5, 12.5), (0, 18), ks, [0, 3, 6, 9, 12, 15, 18], 'Month of ramp-up',
              'Station-capacity error (%)')
    for meth, _ in meths:
        bx.series([(k, b[meth][str(k)]['cap_mape']) for k in ks], STYLE[meth][1], STYLE[meth][2], STYLE[meth][3])
    panel_letter(s, 282, 12, '(b)')
    legend(s, 22, 196, [(lab, STYLE[mm][1], STYLE[mm][2], STYLE[mm][3]) for mm, lab in meths], dy=12, cols=4, colw=130)
    return s.save('fig5_bottleneck.svg')


# ---------------------------------------------------------------- Figure 6
def fig6(res):
    v = res['variance']
    s = Svg(W1, 300, 'Epistemic share of predictive variance and predictive standard deviation by month')
    ks = [int(k) for k in v['0.7']]
    ax = Axes(s, 46, 12, 196, 100, (0.5, 12.5), (0, 100), range(1, 13), [0, 20, 40, 60, 80, 100], '',
              'Epistemic share (%)')
    bx = Axes(s, 46, 146, 196, 100, (0.5, 12.5), (0, 140), range(1, 13), [0, 35, 70, 105, 140], 'Month of ramp-up',
              'Predictive SD (parts)')
    for rho, col, mk, dash in (('0.7', OI['blue'], 'circle', '4,2'), ('1.0', OI['green'], 'triangle', '')):
        ax.band([(k, v[rho][str(k)]['ci'][0]) for k in ks], [(k, v[rho][str(k)]['ci'][1]) for k in ks], col, 0.15)
        ax.series([(k, v[rho][str(k)]['share_epi']) for k in ks], col, mk, dash)
        bx.series([(k, v[rho][str(k)]['sd_total']) for k in ks], col, mk, dash)
    panel_letter(s, 4, 12, '(a)')
    panel_letter(s, 4, 146, '(b)')
    legend(s, 30, 290, [('ρ = 0.7', OI['blue'], 'circle', '4,2'), ('ρ = 1 (no forgetting)', OI['green'], 'triangle', '')],
           dy=12, cols=2, colw=86)
    return s.save('fig6_epistemic.svg')


# ---------------------------------------------------------------- Figure 7
def fig7(res):
    m = res['main']['methods']
    s = Svg(W2, 228, 'Effect of the forgetting factor and robustness of the discrepancy-corrected twin')
    rhos = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    key = lambda r: 'P%02d' % round(r * 10)
    ax = Axes(s, 44, 12, 196, 150, (0.47, 1.03), (0, 12), rhos, [0, 2, 4, 6, 8, 10, 12], 'Forgetting factor ρ',
              'MAPE (%)', xfmt='{:.1f}')
    ser = [('no discrepancy, months 2–12', OI['blue'], 'circle', '4,2', lambda r: m[key(r)]['ape_all'][0]),
           ('discrepancy, months 2–6', OI['verm'], 'diamond', '', lambda r: m[key(r) + 'D']['ape_early'][0]),
           ('discrepancy, months 7–12', OI['purple'], 'circle', '2,2', lambda r: m[key(r) + 'D']['ape_late'][0]),
           ('discrepancy, months 2–12', OI['black'], 'square', '', lambda r: m[key(r) + 'D']['ape_all'][0])]
    for lab, col, mk, dash, f in ser:
        ax.series([(r, f(r)) for r in rhos], col, mk, dash)
    legend(s, 8, 200, [(a, b, cc, d) for a, b, cc, d, _ in ser], dy=12, cols=2, colw=148)
    panel_letter(s, 4, 12, '(a)')
    conds = [('main', 'Reference experiment'), ('w0.25', 'Weak prior (× 0.25)'), ('w4', 'Strong prior (× 4)'),
             ('tau1', 'Fast ramp-up (τ = 1)'), ('tau4', 'Slow ramp-up (τ = 4)'), ('stat', 'No ramp-up'),
             ('mm', 'Model-form mismatch')]
    meths = [('P07', OI['blue'], 'circle_open'), ('NVD', OI['orange'], 'tri_down'), ('B0D', OI['grey'], 'square'),
             ('P10D', OI['green'], 'triangle'), ('P07D', OI['verm'], 'circle')]
    x0, x1, top, rowh = 378, 490, 14, 21
    X = lambda v: x0 + v / 10 * (x1 - x0)
    for t in (0, 2, 4, 6, 8, 10):
        s.line(X(t), top - 4, X(t), top + rowh * len(conds) - 6, GRID, 0.5)
        s.text(X(t), top + rowh * len(conds) + 5, f'{t}', 9, 'middle', INK2)
    s.text((x0 + x1) / 2, top + rowh * len(conds) + 17, 'MAPE months 2–12 (%)', 9.5, 'middle')
    s.text(x1 + 21, top - 2, 'P07D cov.', 9, 'middle', INK2)
    for i, (v, lab) in enumerate(conds):
        y = top + i * rowh + 6
        s.text(x0 - 6, y + 3, lab, 9, 'end')
        for meth, col, mk in meths:
            if meth in res[v]['methods']:
                s.marker(X(min(res[v]['methods'][meth]['ape_all'][0], 10)), y, mk, col, 3.0)
        s.text(x1 + 21, y + 3, f"{res[v]['methods']['P07D']['cov90_all'][0]:.0f} %", 9, 'middle')
    legend(s, 300, 200, [(mm, col, mk, '') for mm, col, mk in meths], dy=12, cols=5, colw=47)
    panel_letter(s, 270, 12, '(b)')
    return s.save('fig7_forgetting_robustness.svg')


# ---------------------------------------------------------------- graphical abstract
def graphical_abstract(res):
    m = res['main']['methods']
    b = res['bottleneck']
    w, h = 664, 266
    s = Svg(w, h, 'Graphical abstract: uncertainty-aware digital twin with sequential conjugate Bayesian updating for FMS ramp-up')
    arrow_defs(s)
    s.text(16, 28, 'Uncertainty-aware digital twin for FMS ramp-up (simulation study)', 15, 'start', INK, 'bold')
    box(s, 16, 48, 180, 64, 'Design stage', ['priors from design statements', 'frozen forecast P0 + interval'], '#f2f2f2')
    box(s, 16, 136, 180, 64, 'Ramp-up, every month', ['machine events → conjugate', 'update with forgetting'], '#e6f1f8')
    box(s, 232, 48, 180, 64, 'Nested Monte Carlo DES', ['epistemic × aleatory', 'uncertainty of output'], '#e6f1f8')
    box(s, 232, 136, 180, 64, 'Discrepancy layer', ['learns the lag of a', 'stationary model'], '#fbe9df', OI['verm'])
    arrow(s, [(106, 112), (106, 134)])
    arrow(s, [(196, 160), (230, 90)])
    arrow(s, [(322, 112), (322, 134)])
    arrow(s, [(412, 168), (444, 168)])
    s.rect(448, 44, 204, 176, '#ffffff', INK, 0.9, 3)
    s.text(550, 62, 'Results (100 virtual ramp-ups)', 11, 'middle', INK, 'bold')
    items = [('Output error, months 2–12', f"{m['B0']['ape_all'][0]:.1f} %", f"{m['P07D']['ape_all'][0]:.1f} %", 'B0 → P07D'),
             ('Coverage of 90 % interval', f"{m['P07']['cov90_all'][0]:.0f} %", f"{m['P07D']['cov90_all'][0]:.0f} %", 'P07 → P07D'),
             ('Bottleneck found, months 2–12', f"{b['B0']['pooled_2_12'][0]:.1f} %", f"{b['P07']['pooled_2_12'][0]:.1f} %", 'B0 → P07'),
             ('Epistemic variance share', f"{res['variance']['0.7']['1']['share_epi']:.0f} %", f"{res['variance']['0.7']['2']['share_epi']:.0f} %", 'month 1 → 2')]
    for i, (lab, a, bb, sub) in enumerate(items):
        y = 84 + i * 37
        s.text(460, y, lab, 10.5, 'start', INK)
        s.text(460, y + 16, a, 12, 'start', OI['grey'], 'bold')
        s.text(504, y + 16, '→', 12, 'start', INK)
        s.text(522, y + 16, bb, 12, 'start', OI['verm'], 'bold')
        s.text(644, y + 16, sub, 9, 'end', INK2)
    s.text(16, 244, 'All factory data are design estimates; all results are simulated. A field-validation protocol is provided.', 10, 'start', INK2)
    p = s.save('graphical_abstract.svg')
    # the graphical abstract belongs in the paper folder root
    import shutil
    dst = os.path.join(os.path.dirname(c.FIG), 'graphical_abstract.svg')
    shutil.move(p, dst)
    return dst


ALL = (fig2, fig3, fig4, fig5, fig6, fig7, graphical_abstract)
