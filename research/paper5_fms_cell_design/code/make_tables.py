"""Print the result tables of the manuscript (Markdown) from data/summary.json and data/mva_results.json.
usage: python make_tables.py > ../data/tables.md
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mva_models as M                                    # noqa: E402

S = json.load(open(os.path.join(HERE, '..', 'data', 'summary.json')))
V = json.load(open(os.path.join(HERE, '..', 'data', 'mva_results.json')))


def g(rules, N=12, mix='design', op=1.0, speed=20):
    return S.get(f'{rules}|N{N}|{mix}|op{op:.3f}|x{speed}')


def f(e, k, d=1, ci=True):
    if e is None:
        return '–'
    m, h = e[k]['mean'], e[k]['ci95']
    return f'{m:.{d}f} ± {h:.{d}f}' if ci and e['n'] > 1 else f'{m:.{d}f}'


p = M.params()
print('## Validation table: models vs virtual plant (revised rules, design mix)')
print('| N placed | X measured | pallets used | U_H | U_L | U_S | A(N placed) | A(N used) | composite | B design(N) | B meas. inputs (N used) |')
print('|---|---|---|---|---|---|---|---|---|---|---|')
for N in (2, 4, 8, 12):
    e = g('after', N)
    if not e:
        continue
    nu = e['pallets_used']['mean']
    XA = M.modelA(N, p)[-1]['X_h']
    XAu = M.modelA(max(1, round(nu)), p)[-1]['X_h']
    print(f"| {N} | {f(e, 'X', 2)} | {f(e, 'pallets_used')} | {f(e, 'U_H', 2)} | {f(e, 'U_L', 2)} | {f(e, 'U_S', 2)} | "
          f"{XA:.2f} | {XAu:.2f} | {M.composite(N, p):.2f} | {M.B_curve(p, N)[-1]['X_h']:.2f} | {f(e, 'B_meas_Nused', 2)} |")
print()
print('## Rule study (N = 12)')
print('| mix | rules | X | pallets used | B pallets used | VC30 share | max overtaken | max overtaken VC30 | moves/part | nominal move [s] | L gap [s] | U_H | U_L | U_S | offline |')
print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for mix in ('design', 'vc30'):
    for r in ('before', 'fb', 'nro', 'after'):
        e = g(r, 12, mix)
        if not e:
            continue
        print(f"| {mix} | {r} | {f(e, 'X', 2)} | {f(e, 'pallets_used')} | {f(e, 'pallets_used_B')} | {f(e, 'share_vc30', 2)} | "
              f"{f(e, 'max_overtaken', 1)} | {f(e, 'max_overtaken_vc30', 1)} | {f(e, 'moves_per_part', 2)} | {f(e, 'move_nominal_mean', 1)} | "
              f"{f(e, 'L_gap', 1)} | {f(e, 'U_H', 2)} | {f(e, 'U_L', 2)} | {f(e, 'U_S', 2)} | {e['offline_events']['max']:.0f} |")
print()
print('## Before rules at N = 4, 8')
for N in (4, 8, 12):
    for r in ('before', 'after'):
        e = g(r, N)
        if e:
            print(f"N={N} {r}: X {f(e, 'X', 2)} pallets {f(e, 'pallets_used')} vc30 {f(e, 'share_vc30', 2)} overtaken {f(e, 'max_overtaken')}"
                  f" min/max X {e['X']['min']:.2f}/{e['X']['max']:.2f}")
print()
print('## Quick clamping (op x 100/140) and time compression')
for lab, e in (('after x20', g('after')), ('after op100', g('after', op=round(100 / 140, 3))), ('after x10', g('after', speed=10))):
    if e:
        print(lab, 'X', f(e, 'X', 2), 'U_L', f(e, 'U_L', 2), 'U_H', f(e, 'U_H', 2), 'op task', f(e, 'op_task_mean', 1),
              'L gap', f(e, 'L_gap', 1), 'pallets', f(e, 'pallets_used'), 'B meas', f(e, 'B_meas_Nused', 2), 'B ceiling meas', f(e, 'B_meas_ceiling', 2))
print()
print('## HMC balance (after / before, N = 12)')
for r in ('before', 'after'):
    e = g(r)
    if e:
        print(r, ' / '.join(f"{e['U_' + m]['mean']:.2f}" for m in ('HMC-01', 'HMC-02', 'HMC-03')))
print()
print('## What-if (model B, N = 12)')
for w in V['whatif']:
    print(f"| {w['case']} | {w['X4']:.1f} | {w['X8']:.1f} | {w['X12']:.1f} | {(w['X12'] / V['whatif'][0]['X12'] - 1) * 100:+.0f} % | {w['month']:.0f} | {w['UL']:.2f} | {w['UH']:.2f} | {w['bound']:.1f} |")
