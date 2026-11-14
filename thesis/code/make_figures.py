"""Thesis figures (SVG, print) for chapters 1, 2, 4, 5, 7, 8, 9 – generated from the thesis data. Standard library only.
Palette: reference categorical slots (blue, orange, aqua, yellow); text in neutral ink; white background (print)."""
import csv
import json
import os
import shutil
import statistics

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, '..', 'data')
F = os.path.join(HERE, '..', 'figures')
C = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']
INK, INK2, GRID, BOX = '#1f1f1e', '#5f5e57', '#e4e3df', '#f4f3ef'
FONT = 'font-family="Arial, Helvetica, sans-serif"'


def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" {FONT}>'
            f'<title>{title}</title><rect width="{w}" height="{h}" fill="#ffffff"/>{body}</svg>')


def box(x, y, w, h, lines, fill=BOX, bold_first=True, fs=13):
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}" stroke="{INK2}" stroke-width="1.2"/>'
    ty = y + h / 2 - (len(lines) - 1) * (fs + 3) / 2 + fs / 3
    for i, t in enumerate(lines):
        wgt = ' font-weight="bold"' if (i == 0 and bold_first) else ''
        s += f'<text x="{x + w / 2}" y="{ty + i * (fs + 3):.1f}" font-size="{fs if i == 0 else fs - 1.5}" fill="{INK}" text-anchor="middle"{wgt}>{t}</text>'
    return s


def arrow(x1, y1, x2, y2, label='', dx=0, dy=-6):
    s = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{INK2}" stroke-width="1.6" marker-end="url(#ah)"/>'
    if label:
        s += f'<text x="{(x1 + x2) / 2 + dx}" y="{(y1 + y2) / 2 + dy}" font-size="11.5" fill="{INK2}" text-anchor="middle">{label}</text>'
    return s


DEFS = f'<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{INK2}"/></marker></defs>'


def bars(items, title, ylabel, path, w=760, h=380, fmt='{:.1f}', colors=None, ymax=None, refline=None):
    """Vertical bar chart: items = [(label, value)]."""
    L, R, T, B = 70, 20, 20, 70
    pw, ph = w - L - R, h - T - B
    ym = ymax or max(v for _, v in items) * 1.15
    bw = pw / len(items) * 0.6
    s = ''
    for i in range(6):
        y = T + ph - i / 5 * ph
        s += f'<line x1="{L}" x2="{L + pw}" y1="{y:.1f}" y2="{y:.1f}" stroke="{GRID}"/><text x="{L - 6}" y="{y + 4:.1f}" font-size="11" fill="{INK2}" text-anchor="end">{fmt.format(ym * i / 5)}</text>'
    for i, (lab, v) in enumerate(items):
        x = L + (i + 0.5) * pw / len(items) - bw / 2
        bh = max(0, v) / ym * ph
        col = (colors or [C[0]] * len(items))[i]
        s += f'<path d="M{x:.1f},{T + ph} V{T + ph - bh + 4:.1f} Q{x:.1f},{T + ph - bh:.1f} {x + 4:.1f},{T + ph - bh:.1f} H{x + bw - 4:.1f} Q{x + bw:.1f},{T + ph - bh:.1f} {x + bw:.1f},{T + ph - bh + 4:.1f} V{T + ph}" fill="{col}"/>'
        s += f'<text x="{x + bw / 2:.1f}" y="{T + ph - bh - 6:.1f}" font-size="11.5" fill="{INK}" text-anchor="middle">{fmt.format(v)}</text>'
        for j, part in enumerate(lab.split('|')):
            s += f'<text x="{x + bw / 2:.1f}" y="{T + ph + 18 + j * 14}" font-size="11.5" fill="{INK}" text-anchor="middle">{part}</text>'
    if refline:
        yv, lab = refline
        y = T + ph - yv / ym * ph
        s += f'<line x1="{L}" x2="{L + pw}" y1="{y:.1f}" y2="{y:.1f}" stroke="{INK}" stroke-dasharray="5 4"/><line x1="{L + pw - 190}" x2="{L + pw - 160}" y1="{T + 8}" y2="{T + 8}" stroke="{INK}" stroke-dasharray="5 4"/><text x="{L + pw - 154}" y="{T + 12}" font-size="11.5" fill="{INK}">{lab}</text>'
    s += f'<line x1="{L}" x2="{L + pw}" y1="{T + ph}" y2="{T + ph}" stroke="{INK2}"/>'
    s += f'<text x="16" y="{T + ph / 2}" font-size="12.5" fill="{INK}" text-anchor="middle" transform="rotate(-90 16 {T + ph / 2})">{ylabel}</text>'
    open(path, 'w', encoding='utf-8').write(svg(w, h, s, title))


def lines(series, xs, title, ylabel, path, ymax, xlabel='Month', w=760, h=380, yticks=None, logx=False):
    L, R, T, B = 66, 190, 18, 52
    pw, ph = w - L - R, h - T - B
    import math
    fx = (lambda x: math.log10(x)) if logx else (lambda x: x)
    X = lambda x: L + (fx(x) - fx(xs[0])) / (fx(xs[-1]) - fx(xs[0])) * pw
    Y = lambda y: T + ph - min(y, ymax) / ymax * ph
    s = ''
    for t in (yticks or [ymax * i / 5 for i in range(6)]):
        s += f'<line x1="{L}" x2="{L + pw}" y1="{Y(t):.1f}" y2="{Y(t):.1f}" stroke="{GRID}"/><text x="{L - 6}" y="{Y(t) + 4:.1f}" font-size="11" fill="{INK2}" text-anchor="end">{t:g}</text>'
    for x in xs:
        s += f'<text x="{X(x):.1f}" y="{T + ph + 17}" font-size="11" fill="{INK2}" text-anchor="middle">{x:g}</text>'
    s += f'<line x1="{L}" x2="{L + pw}" y1="{T + ph}" y2="{T + ph}" stroke="{INK2}"/>'
    s += f'<text x="{L + pw / 2}" y="{h - 8}" font-size="12.5" fill="{INK}" text-anchor="middle">{xlabel}</text>'
    s += f'<text x="15" y="{T + ph / 2}" font-size="12.5" fill="{INK}" text-anchor="middle" transform="rotate(-90 15 {T + ph / 2})">{ylabel}</text>'
    ends = []
    for (name, ys, ci, dash) in series:
        pts = [(x, y) for x, y in zip(xs, ys) if y is not None]
        col = INK if ci is None else C[ci]
        d = ' '.join(f'{"M" if i == 0 else "L"}{X(x):.1f},{Y(y):.1f}' for i, (x, y) in enumerate(pts))
        s += f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2"{" stroke-dasharray=\"5 4\"" if dash else ""}/>'
        for x, y in pts:
            s += f'<circle cx="{X(x):.1f}" cy="{Y(y):.1f}" r="3.8" fill="{col}" stroke="#fff" stroke-width="1.5"/>'
        ends.append([Y(pts[-1][1]), name, col])
    ends.sort()
    for j in range(1, len(ends)):
        if ends[j][0] - ends[j - 1][0] < 15:
            ends[j][0] = ends[j - 1][0] + 15
    for y, n, col in ends:
        s += f'<circle cx="{L + pw + 12}" cy="{y:.1f}" r="5" fill="{col}"/><text x="{L + pw + 22}" y="{y + 4:.1f}" font-size="12" fill="{INK}">{n}</text>'
    open(path, 'w', encoding='utf-8').write(svg(w, h, s, title))


def fig1_1():
    s = DEFS
    s += box(20, 20, 200, 70, ['Problem + gap', 'Ch. 1 Introduction', 'Ch. 2 State of the art (paper 1)'])
    s += box(20, 120, 200, 50, ['Method', 'Ch. 3 Design science'])
    s += box(270, 20, 210, 70, ['Ch. 4 Model', 'FMS as stochastic DES,', 'conjugate priors, staging problem'])
    cols = [('C1 · Ch. 5', 'Modbus TCP + HTTP', 'architecture, event block'), ('C2 · Ch. 6', 'Bayesian twin', '+ discrepancy learning'),
            ('C3 · Ch. 7', 'Stepwise FMS', 'introduction')]
    for i, (a, b, c) in enumerate(cols):
        s += box(270 + i * 160, 130, 150, 70, [a, b, c], fill='#eaf2fc')
    s += box(270, 232, 470, 58, ['C4 · Ch. 8 Implementation · Ch. 9 Reference design cases', 'compressor FMS · ball screw shaft line'], fill='#eaf7f1')
    s += box(270, 320, 470, 44, ['Ch. 10 Discussion · Ch. 11 Conclusions'])
    s += arrow(220, 55, 268, 55) + arrow(120, 90, 120, 118) + arrow(375, 90, 345, 128) + arrow(375, 90, 505, 128) + arrow(375, 90, 665, 128)
    for i in range(3):
        s += arrow(345 + i * 160, 200, 345 + i * 160 + (160 if i == 0 else (0 if i == 1 else -160)) * 0 , 238)
    s += arrow(505, 290, 505, 318)
    open(os.path.join(F, 'fig1_1_structure.svg'), 'w', encoding='utf-8').write(svg(760, 380, s, 'Figure 1.1 Structure of the thesis'))


def fig4_1():
    s = DEFS
    s += box(20, 40, 160, 60, ['Physical FMS', 'machines, PLCs'])
    s += box(270, 40, 160, 60, ['Gateway (Ch. 5)', 'events, counters'])
    s += box(520, 40, 160, 60, ['Bayesian update', '(Section 4.6)'])
    s += box(520, 190, 160, 60, ['DES twin (4.7)', 'predictive p(Y | D)'])
    s += box(270, 190, 160, 60, ['Staging optimisation', '(4.9, Ch. 7)'])
    s += box(20, 190, 160, 60, ['Investment step', 'x_s implemented'])
    s += arrow(180, 70, 268, 70, 'events', dy=-8) + arrow(430, 70, 518, 70, 'data D_k', dy=-8)
    s += arrow(600, 100, 600, 188, 'posterior p(θ | D)', dx=58, dy=4) + arrow(520, 220, 432, 220, 'predictions', dy=-8)
    s += arrow(270, 220, 182, 220, 'decision', dy=-8) + arrow(100, 190, 100, 102, 'new configuration', dx=-48, dy=4)
    open(os.path.join(F, 'fig4_1_loop.svg'), 'w', encoding='utf-8').write(svg(720, 280, s, 'Figure 4.1 Information loop'))


def fig5_1(name='fig5_1_layers.svg', title='Figure 5.1 Layers of the low-cost twin architecture', soft=False):
    s = DEFS
    rows = [('User entities', 'ERP · MES · browser displays · twin users', '#eaf2fc'),
            ('Twin core (offline PC)', 'HTTP/JSON API · Bayesian twin · DES · historian (SQLite)' if not soft else 'server.py + twin/ (factory model, MES, ERP, historian) · thesis/code (bayes, flowline, discrepancy, staging)', '#eaf7f1'),
            ('Gateway', 'Modbus TCP client · multi-rate polling · event reconstruction · quality flags · heartbeat', BOX),
            ('Machines (L1)', 'PLC / CNC with Modbus TCP server · register map V1.1 + event block', BOX),
            ('Field (L0)', 'sensors, drives, safety – hard-wired, not on the network', '#ffffff')]
    for i, (a, b, fill) in enumerate(rows):
        y = 20 + i * 78
        s += box(20, y, 720, 56, [a, b], fill=fill)
        if i < len(rows) - 1:
            lab = ['HTTP/JSON, Server-Sent Events', 'events, counters (HTTP API)', 'Modbus TCP, one connection per PLC, VLAN per zone', 'I/O'][i]
            s += arrow(380, y + 56, 380, y + 76, lab, dx=150, dy=4)
    open(os.path.join(F, name), 'w', encoding='utf-8').write(svg(760, 410, s, title))


def fig4_2():
    rows = [('LOAD', 13343), ('HMC', 9754), ('WASH', 8010), ('VMC', 11620), ('HONE', 13109), ('LATHE', 6902), ('GRIND', 6164),
            ('ASSY', 5945), ('ROBOT', 10802), ('TEST', 6699), ('PAINT', 7396), ('FINAL', 5667), ('PACK', 10055)]
    cols = [C[1] if n in ('FINAL', 'ASSY', 'GRIND') else C[0] for n, _ in rows]
    bars(rows, 'Figure 4.2 Static monthly capacity per station type', 'Good parts per month (Eq. 4.2)',
         os.path.join(F, 'fig4_2_capacity.svg'), w=820, fmt='{:,.0f}', colors=cols, ymax=15000)


def fig5_2():
    runs = [json.loads(l) for l in open(os.path.join(D, 'comm_runs.jsonl'))]
    sel = [r for r in runs if r['mode'] == 'par' and r['plc_scan_ms'] in (10.0, 0.0) and r['N'] in (40, 160)]
    items = []
    for P in (1.0, 0.25, 0.1):
        rr = [r for r in runs if r['period_s'] == P]
        if not rr:
            continue
        items.append((f'state-only|P = {P:g} s', 100 * (1 - statistics.mean(r['S_share_reported'] for r in rr))))
    items.append(('event block|all 15 runs', 100 * statistics.mean(r['R_loss'] for r in runs)))
    bars(items, 'Figure 5.2 Share of state changes not captured', 'State changes not captured [%]',
         os.path.join(F, 'fig5_2_loss.svg'), w=640, colors=[C[1]] * (len(items) - 1) + [C[2]], ymax=40)


def fig5_3():
    runs = [json.loads(l) for l in open(os.path.join(D, 'comm_runs.jsonl'))]
    Ns = [10, 40, 80, 160]
    seq = [next(1000 * r['cycle_mean_s'] for r in runs if r['N'] == n and r['mode'] == 'seq' and r['period_s'] == 1.0 and r['plc_scan_ms'] == 10.0) for n in Ns]
    par = [next(1000 * r['cycle_mean_s'] for r in runs if r['N'] == n and r['mode'] == 'par' and r['period_s'] == 1.0 and r['plc_scan_ms'] == 10.0) for n in Ns]
    theo = [n * 6.05 for n in Ns]
    lines([('sequential – measured', seq, 0, False), ('sequential – Eq. 5.4', theo, None, True), ('parallel – measured', par, 2, False)],
          Ns, 'Figure 5.3 Poll cycle time versus number of machines', 'Cycle time [ms]', os.path.join(F, 'fig5_3_cycle.svg'),
          1200, xlabel='Machines N (PLC scan 10 ms, logarithmic axis)', yticks=[0, 200, 400, 600, 800, 1000, 1200], logx=True)


def fig7_1():
    import analyse_staging
    out, pair, finals = analyse_staging.summary(os.path.join(D, 'staging_b0.0.csv'))
    order = ['ALL', 'STATIC', 'ADAPT_DEM', 'ADAPTIVE', 'PI_RULE']
    lab = {'ALL': 'all at once', 'STATIC': 'fixed plan', 'ADAPT_DEM': 'demand|only', 'ADAPTIVE': 'adaptive|(twin)', 'PI_RULE': 'perfect|info rule'}
    bars([(lab[p], out[p]['dnpv']) for p in order], 'Figure 7.1 Mean incremental NPV by policy', 'Mean ΔNPV vs no investment [M EUR]',
         os.path.join(F, 'fig7_1_npv.svg'), w=700, fmt='{:.2f}', colors=[C[1], C[1], C[1], C[2], '#9a9990'], ymax=10)
    bars([(lab[p], out[p]['cvar']) for p in order], 'Figure 7.2 Worst-10 % outcome (CVaR) by policy', 'CVaR10 of ΔNPV [M EUR]',
         os.path.join(F, 'fig7_2_cvar.svg'), w=700, fmt='{:.2f}', colors=[C[1], C[1], C[1], C[2], '#9a9990'], ymax=2.5)


def fig9():
    c = json.load(open(os.path.join(D, 'case_study.json'), encoding='utf-8'))
    rows = c['case2_rampup']
    xs = list(range(2, 13))
    def m(key):
        return [100 * statistics.mean(abs(r[key] - r['truth']) / r['truth'] for r in rows if r['month'] == k) for k in xs]
    lines([('B0 design model', m('B0'), 0, False), ('P07 Bayesian twin', m('P07'), 2, False), ('P07D twin + discrepancy', m('P07D'), 3, False)],
          xs, 'Figure 9.1 Transfer test on the ball screw line', 'Mean absolute error of monthly output [%]',
          os.path.join(F, 'fig9_1_transfer.svg'), 50, yticks=[0, 10, 20, 30, 40, 50])
    cap = c['case2_capacity']
    cols = [C[1] if v - min(x[1] for x in cap) < 10 else C[0] for _, v in cap]
    bars([(n.replace('BS-', '').replace('HT-', '').replace('MS-', '').replace('QC-', '').replace('AS-', ''), v) for n, v in cap],
         'Figure 9.2 Static capacity of the ball screw shaft line', 'Good shafts per month (Eq. 4.2)',
         os.path.join(F, 'fig9_2_bs_capacity.svg'), w=820, fmt='{:,.0f}', colors=cols, ymax=18000, refline=(2500, 'target 2 500 / month'))


def main():
    os.makedirs(F, exist_ok=True)
    fig1_1(); fig4_1(); fig4_2(); fig5_1(); fig5_2(); fig5_3(); fig7_1(); fig9()
    fig5_1('fig8_1_software.svg', 'Figure 8.1 Software layers', soft=True)
    shutil.copy(os.path.join(HERE, '..', '..', 'research', 'paper1_slr', 'figures', 'fig1_prisma.svg'), os.path.join(F, 'fig2_1_prisma.svg'))
    print(sorted(os.listdir(F)))


if __name__ == '__main__':
    main()
