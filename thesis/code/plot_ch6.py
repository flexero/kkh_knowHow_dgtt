"""Thesis figures for chapter 6 as print SVG (stdlib only). Palette: reference categorical slots 1-4."""
import csv, statistics, collections

C = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']
INK, INK2, GRID = '#1f1f1e', '#5f5e57', '#e4e3df'


def line_chart(series, ymax, ylabel, title, path, yfmt='{:.0f}', yticks=None, xlabel='Month of ramp-up'):
    W, Hh, L, R, T, B = 760, 420, 70, 150, 50, 60
    pw, ph = W - L - R, Hh - T - B
    xs = sorted({x for _, pts in series for x, _ in pts})
    X = lambda x: L + (x - xs[0]) / (xs[-1] - xs[0]) * pw
    Y = lambda y: T + ph - y / ymax * ph
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{Hh}" viewBox="0 0 {W} {Hh}" font-family="Arial, Helvetica, sans-serif">',
         f'<title>{title}</title><rect width="{W}" height="{Hh}" fill="#ffffff"/>']
    for t in (yticks or [ymax * i / 5 for i in range(6)]):
        o.append(f'<line x1="{L}" x2="{L+pw}" y1="{Y(t):.1f}" y2="{Y(t):.1f}" stroke="{GRID}" stroke-width="1"/>')
        o.append(f'<text x="{L-8}" y="{Y(t)+4:.1f}" font-size="12" fill="{INK2}" text-anchor="end">{yfmt.format(t)}</text>')
    for x in xs:
        o.append(f'<text x="{X(x):.1f}" y="{T+ph+20}" font-size="12" fill="{INK2}" text-anchor="middle">{x}</text>')
    o.append(f'<line x1="{L}" x2="{L+pw}" y1="{T+ph}" y2="{T+ph}" stroke="{INK2}" stroke-width="1"/>')
    o.append(f'<text x="{L+pw/2}" y="{Hh-16}" font-size="13" fill="{INK}" text-anchor="middle">{xlabel}</text>')
    o.append(f'<text x="18" y="{T+ph/2}" font-size="13" fill="{INK}" text-anchor="middle" transform="rotate(-90 18 {T+ph/2})">{ylabel}</text>')
    labels = []
    for i, (name, pts) in enumerate(series):
        d = ' '.join(f'{"M" if j == 0 else "L"}{X(x):.1f},{Y(min(y, ymax)):.1f}' for j, (x, y) in enumerate(pts))
        o.append(f'<path d="{d}" fill="none" stroke="{C[i]}" stroke-width="2"/>')
        for x, y in pts:
            o.append(f'<circle cx="{X(x):.1f}" cy="{Y(min(y, ymax)):.1f}" r="4" fill="{C[i]}" stroke="#ffffff" stroke-width="2"/>')
        labels.append([Y(min(pts[-1][1], ymax)), name, C[i]])
    labels.sort()
    for j in range(1, len(labels)):            # avoid overlapping end labels
        if labels[j][0] - labels[j - 1][0] < 16:
            labels[j][0] = labels[j - 1][0] + 16
    for y, name, col in labels:
        o.append(f'<circle cx="{L+pw+14}" cy="{y:.1f}" r="5" fill="{col}"/>')
        o.append(f'<text x="{L+pw+24}" y="{y+4:.1f}" font-size="13" fill="{INK}">{name}</text>')
    o.append('</svg>')
    open(path, 'w', encoding='utf-8').write('\n'.join(o))


rows = list(csv.DictReader(open('../data/rampup_w1.0.csv', encoding='utf-8')))
by = collections.defaultdict(list)
for r in rows:
    y = float(r['truth'])
    by[(r['method'], int(r['month']))].append(abs(float(r['pred']) - y) / y * 100)
names = {'B0': 'B0 design model', 'B1': 'B1 one-time calibration', 'P07': 'P07 Bayesian twin', 'P07D': 'P07D twin + discrepancy'}
series = [(names[m], [(k, statistics.mean(by[(m, k)])) for k in range(2, 13)]) for m in names]
line_chart(series, 30, 'Mean absolute error of monthly output (%)',
           'Figure 6.3 Prediction error during the virtual ramp-up (30 scenarios)', '../figures/fig6_3_error_by_month.svg',
           yticks=[0, 5, 10, 15, 20, 25, 30])

bn = list(csv.DictReader(open('../data/bottleneck.csv', encoding='utf-8')))
hit = collections.defaultdict(list)
for r in bn:
    hit[(r['method'], int(r['month']))].append(int(r['hit']) * 100)
names2 = {'B0': 'B0 design model', 'P1': 'P1 Bayesian, rho = 1', 'P07': 'P07 Bayesian, rho = 0.7'}
series2 = [(names2[m], [(k, statistics.mean(hit[(m, k)])) for k in range(1, 13)]) for m in names2]
line_chart(series2, 100, 'True bottleneck identified (% of scenarios)',
           'Figure 6.5 Bottleneck identification during the virtual ramp-up', '../figures/fig6_5_bottleneck.svg',
           yticks=[0, 20, 40, 60, 80, 100])
print('figures written')
