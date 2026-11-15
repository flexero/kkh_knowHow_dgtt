"""Analyse the paper-4 experiments -> ../data/results.json and a readable ../data/results_summary.txt

All values in M EUR are incremental NPV versus no investment (policy NONE) of the same scenario [simulated,
money values are reference estimates].
"""
from __future__ import annotations

import collections
import csv
import json
import os
import statistics
import sys

import stats_utils as su

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', 'data'))
OPTS = ('PAL', 'GR2', 'AS2', 'FRB', 'MES', 'AGV')
LINES = []


def out(s=''):
    LINES.append(s)
    print(s)


def load(name):
    fn = os.path.join(DATA, name)
    if not os.path.exists(fn):
        return None
    by = collections.defaultdict(lambda: collections.defaultdict(dict))
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        by[r['setting']][int(r['scenario'])][r['policy']] = r
    return by


def dnpv(sc, p):
    return [(float(v[p]['npv']) - float(v['NONE']['npv'])) / 1e6 for _, v in sorted(sc.items())]


def summary(sc, pols, ref='PI_PLAN'):
    res = {}
    for p in pols:
        d = dnpv(sc, p)
        m, lo, hi, se = su.mean_ci(d)
        cv = su.cvar_low(d)
        clo, chi = su.boot_ci(su.cvar_low, [d], B=2000, seed=11)
        cap = statistics.mean(float(v[p]['capital']) / 1e6 for v in sc.values())
        short = [int(v[p]['short_stages']) for v in sc.values()]
        r = dict(mean=m, lo=lo, hi=hi, sd=statistics.stdev(d), cvar=cv, cvar_lo=clo, cvar_hi=chi, min=min(d),
                 p_loss=sum(x < 0 for x in d) / len(d), capital=cap, short=statistics.mean(short),
                 p_short=sum(s > 0 for s in short) / len(short))
        if ref in next(iter(sc.values())):
            r['regret'] = statistics.mean(dnpv(sc, ref)) - m
        res[p] = r
    return res


def print_summary(res, title):
    out(f'\n### {title}')
    out('| Policy | Mean dNPV [95% CI] | SD | CVaR10 [95% boot CI] | Min | P(loss) | Capital | Short stages | P(short) | Regret vs PI_PLAN |')
    out('|---|---|---|---|---|---|---|---|---|---|')
    for p, r in res.items():
        out(f"| {p} | {r['mean']:.2f} [{r['lo']:.2f}, {r['hi']:.2f}] | {r['sd']:.2f} | {r['cvar']:.2f} [{r['cvar_lo']:.2f}, {r['cvar_hi']:.2f}] "
            f"| {r['min']:.2f} | {100 * r['p_loss']:.1f} % | {r['capital']:.2f} | {r['short']:.2f} | {100 * r['p_short']:.1f} % | {r.get('regret', float('nan')):.2f} |")


def pairs(sc, a, others):
    rows = {}
    for q in others:
        rows[q] = su.paired(dnpv(sc, a), dnpv(sc, q))
        da, dq = dnpv(sc, a), dnpv(sc, q)
        rows[q]['cvar_diff'] = su.cvar_low(da) - su.cvar_low(dq)
        rows[q]['cvar_diff_ci'] = su.boot_ci(lambda x, y: su.cvar_low(x) - su.cvar_low(y), [da, dq], B=2000, seed=12)
    adj = su.holm([r['p_t'] for r in rows.values()])
    adjw = su.holm([r['p_w'] for r in rows.values()])
    for (q, r), h, hw in zip(rows.items(), adj, adjw):
        r['p_holm'], r['pw_holm'] = h, hw
    return rows


def print_pairs(rows, a):
    out(f'\n| Comparison | Mean diff [95% CI] | p (t, Holm) | p (Wilcoxon, Holm) | {a} better | CVaR10 diff [95% boot CI] |')
    out('|---|---|---|---|---|---|')
    for q, r in rows.items():
        lo, hi = r['cvar_diff_ci']
        out(f"| {a} - {q} | {r['mean']:+.2f} [{r['lo']:+.2f}, {r['hi']:+.2f}] | {r['p_holm']:.1e} | {r['pw_holm']:.1e} | "
            f"{r['wins']}/{r['n']} (ties {r['ties']}) | {r['cvar_diff']:+.2f} [{lo:+.2f}, {hi:+.2f}] |")


def stage_short(sc, pols):
    res = {}
    for p in pols:
        st = []
        for s in range(1, 5):
            ys = [(float(v[p][f'y{s}']), float(v[p][f'd{s}'])) for v in sc.values()]
            st.append(dict(p_short=sum(y < 0.95 * d for y, d in ys) / len(ys),
                           unmet=statistics.mean(max(0.0, d - y) for y, d in ys)))
        res[p] = st
    return res


def adoption(sc, pols):
    res = {}
    for p in pols:
        r = {}
        for o in OPTS:
            stages = []
            for v in sc.values():
                for s in range(1, 5):
                    if o in v[p][f'a{s}'].split('+'):
                        stages.append(s)
            r[o] = dict(share=len(stages) / len(sc), mean_stage=statistics.mean(stages) if stages else None)
        res[p] = r
    return res


def analyse_main(by):
    sc = by['main']
    pols = ['ALL', 'STATIC', 'STATIC_SP', 'MYOPIC', 'BN_GREEDY', 'ADAPT_DEM', 'ADAPT_PAR', 'ADAPTIVE', 'PI_RULE', 'PI_PLAN']
    R = {'n': len(sc)}
    R['summary'] = summary(sc, pols)
    print_summary(R['summary'], f'Main experiment, {len(sc)} scenarios, beta = 0')
    R['pairs'] = pairs(sc, 'ADAPTIVE', [p for p in pols if p not in ('ADAPTIVE',)])
    print_pairs(R['pairs'], 'ADAPTIVE')
    # thesis replication (scenarios 1-40)
    sub = {k: v for k, v in sc.items() if k <= 40}
    R['first40'] = summary(sub, ['ALL', 'STATIC', 'ADAPT_DEM', 'ADAPTIVE', 'PI_RULE'], ref='PI_RULE')
    print_summary(R['first40'], 'Scenarios 1-40 (must equal thesis Table 7.2)')
    # factorial decomposition of the value of learning
    m = {p: statistics.mean(dnpv(sc, p)) for p in pols}
    dem = ((m['ADAPT_DEM'] - m['STATIC']) + (m['ADAPTIVE'] - m['ADAPT_PAR'])) / 2
    par = ((m['ADAPT_PAR'] - m['STATIC']) + (m['ADAPTIVE'] - m['ADAPT_DEM'])) / 2
    inter = m['ADAPTIVE'] - m['ADAPT_PAR'] - m['ADAPT_DEM'] + m['STATIC']
    R['factorial'] = dict(demand_main=dem, parameter_main=par, interaction=inter,
                          total=m['ADAPTIVE'] - m['STATIC'],
                          par_given_dem=su.paired(dnpv(sc, 'ADAPTIVE'), dnpv(sc, 'ADAPT_DEM')),
                          dem_given_par=su.paired(dnpv(sc, 'ADAPTIVE'), dnpv(sc, 'ADAPT_PAR')),
                          par_alone=su.paired(dnpv(sc, 'ADAPT_PAR'), dnpv(sc, 'STATIC')),
                          dem_alone=su.paired(dnpv(sc, 'ADAPT_DEM'), dnpv(sc, 'STATIC')))
    out(f"\nFactorial: demand main effect {dem:+.2f}, parameter main effect {par:+.2f}, interaction {inter:+.2f}, "
        f"total {m['ADAPTIVE'] - m['STATIC']:+.2f} M EUR")
    # value of information
    voi = dict(evpi_vs_sp=m['PI_PLAN'] - m['STATIC_SP'], evpi_vs_static=m['PI_PLAN'] - m['STATIC'],
               twin_vs_sp=m['ADAPTIVE'] - m['STATIC_SP'], twin_vs_static=m['ADAPTIVE'] - m['STATIC'],
               vss=m['STATIC_SP'] - m['STATIC'])
    voi['share_captured_vs_static'] = voi['twin_vs_static'] / voi['evpi_vs_static'] if voi['evpi_vs_static'] else None
    voi['share_captured_vs_sp'] = voi['twin_vs_sp'] / voi['evpi_vs_sp'] if voi['evpi_vs_sp'] else None
    voi['pi_minus_adaptive'] = su.paired(dnpv(sc, 'PI_PLAN'), dnpv(sc, 'ADAPTIVE'))
    R['voi'] = voi
    out('\nValue of information: ' + ', '.join(f'{k} {v:+.3f}' for k, v in voi.items() if isinstance(v, float)))
    # under-capacity per stage
    R['stage_short'] = stage_short(sc, ['ALL', 'STATIC', 'STATIC_SP', 'ADAPT_DEM', 'ADAPTIVE', 'PI_PLAN', 'NONE'])
    out('\nShare of scenarios with output < 95 % of demand, per stage (unmet units / month):')
    for p, st in R['stage_short'].items():
        out(f'  {p:10s} ' + '  '.join(f"{100 * x['p_short']:5.1f}% ({x['unmet']:5.0f})" for x in st))
    # adoption and timing
    R['adoption'] = adoption(sc, ['ALL', 'STATIC', 'STATIC_SP', 'ADAPT_DEM', 'ADAPTIVE', 'PI_PLAN'])
    out('\nOption adoption share (mean stage):')
    for p, r in R['adoption'].items():
        out(f'  {p:10s} ' + '  '.join(f"{o} {100 * x['share']:3.0f}% ({x['mean_stage'] or 0:.1f})" for o, x in r.items()))
    R['finals'] = {p: collections.Counter(v[p]['final'] for v in sc.values()).most_common(4) for p in pols}
    for p in ('STATIC', 'STATIC_SP', 'ADAPTIVE', 'PI_PLAN'):
        out(f'  final {p}: {R["finals"][p]}')
    R['sp_plan'] = next(iter(sc.values()))['STATIC_SP'].get('sp_plan', '')
    R['static_plan'] = '|'.join(next(iter(sc.values()))['STATIC'][f'a{s}'] for s in range(1, 5))
    out(f"  STATIC plan {R['static_plan']}, STATIC_SP plan {R['sp_plan']}")
    # robustness of the first-stage decision
    a1 = collections.Counter(v['PI_PLAN']['a1'] for v in sc.values())
    R['pi_first_stage'] = a1.most_common()
    out(f'  clairvoyant first-stage actions: {a1.most_common(6)}')
    # by demand level
    terc = sorted(sc.items(), key=lambda kv: float(next(iter(kv[1].values()))['dem_factor']))
    k = len(terc) // 3
    groups = {'low demand': dict(terc[:k]), 'medium demand': dict(terc[k:2 * k]), 'high demand': dict(terc[2 * k:])}
    R['by_demand'] = {}
    for g, sub in groups.items():
        R['by_demand'][g] = {p: statistics.mean(dnpv(sub, p)) for p in ('ALL', 'STATIC', 'STATIC_SP', 'ADAPT_DEM', 'ADAPTIVE', 'PI_PLAN')}
        R['by_demand'][g]['range'] = (min(float(next(iter(v.values()))['dem_factor']) for v in sub.values()),
                                      max(float(next(iter(v.values()))['dem_factor']) for v in sub.values()))
        R['by_demand'][g]['adaptive_minus_static'] = su.paired(dnpv(sub, 'ADAPTIVE'), dnpv(sub, 'STATIC'))
        R['by_demand'][g]['adaptive_minus_all'] = su.paired(dnpv(sub, 'ADAPTIVE'), dnpv(sub, 'ALL'))
        out(f"  {g} {R['by_demand'][g]['range']}: " + ', '.join(f'{p} {v:.2f}' for p, v in R['by_demand'][g].items()
                                                                if isinstance(v, float)))
    R['cpu'] = {p: statistics.mean(float(v[p]['cpu_s']) for v in sc.values()) for p in pols}
    out('  decision CPU s per scenario (4 stages): ' + ', '.join(f'{p} {v:.3f}' for p, v in R['cpu'].items()))
    return R


def analyse_settings(by, base_sc, policies, label):
    R = {}
    out(f'\n### {label}')
    out('| Setting | ' + ' | '.join(policies) + ' | ADAPTIVE - STATIC [95% CI] | ADAPTIVE - ALL [95% CI] | CVaR10 ADAPTIVE | CVaR10 ALL | STATIC plan | wins vs STATIC |')
    out('|---' * (len(policies) + 7) + '|')
    items = ([('base (main)', base_sc)] if base_sc else []) + list(by.items())
    for tag, sc in items:
        have = next(iter(sc.values()))
        r = {p: statistics.mean(dnpv(sc, p)) for p in policies if p in have}
        r['cvar'] = {p: su.cvar_low(dnpv(sc, p)) for p in policies if p in have}
        r['capital'] = {p: statistics.mean(float(v[p]['capital']) / 1e6 for v in sc.values()) for p in policies if p in have}
        ps = su.paired(dnpv(sc, 'ADAPTIVE'), dnpv(sc, 'STATIC'))
        r['ad_st'] = ps
        pa = su.paired(dnpv(sc, 'ADAPTIVE'), dnpv(sc, 'ALL')) if 'ALL' in have else None
        r['ad_all'] = pa
        r['static_plan'] = '|'.join(have['STATIC'][f'a{s}'] for s in range(1, 5))
        r['sp_plan'] = have.get('STATIC_SP', {}).get('sp_plan', '')
        r['finals'] = collections.Counter(v['ADAPTIVE']['final'] for v in sc.values()).most_common(3)
        r['n'] = len(sc)
        R[tag] = r
        cells = ' | '.join(f'{r[p]:.2f}' if p in r else '–' for p in policies)
        all_s = f"{pa['mean']:+.2f} [{pa['lo']:+.2f}, {pa['hi']:+.2f}]" if pa else '–'
        out(f"| {tag} | {cells} | {ps['mean']:+.2f} [{ps['lo']:+.2f}, {ps['hi']:+.2f}] | {all_s} | {r['cvar']['ADAPTIVE']:.2f} | "
            f"{r['cvar'].get('ALL', float('nan')):.2f} | {r['static_plan']} | {ps['wins']}/{ps['n']} |")
    return R


def main():
    res = {}
    by = load('main.csv')
    if by:
        res['main'] = analyse_main(by)
    main_sc = by['main'] if by else None
    for name, pols, label in (('risk.csv', ['ALL', 'STATIC', 'STATIC_SP', 'ADAPTIVE'], 'Risk aversion (200 scenarios)'),
                              ('learning.csv', ['STATIC', 'ADAPTIVE'], 'Twin settings: forgetting rho, prior weight w, samples N_theta (200 scenarios)'),
                              ('econ.csv', ['ALL', 'STATIC', 'STATIC_SP', 'ADAPT_DEM', 'ADAPTIVE', 'PI_PLAN'], 'Economic sensitivity (100 scenarios)'),
                              ('epistemic.csv', ['ALL', 'STATIC', 'STATIC_SP', 'ADAPT_DEM', 'ADAPTIVE', 'PI_PLAN'], 'Epistemic uncertainty scale lambda (100 scenarios)')):
        b = load(name)
        if b and name == 'risk.csv':                       # beta = 1 (pure CVaR) was run separately
            extra = load('risk_b1.csv')
            if extra:
                b = dict(list(extra.items()) + list(b.items()))
        if b:
            base = main_sc if name in ('risk.csv', 'learning.csv') else None
            res[name[:-4]] = analyse_settings(b, base, pols, label)
    sc_fn = os.path.join(DATA, 'screen_check.json')
    if os.path.exists(sc_fn):
        s = json.load(open(sc_fn))
        res['screen'] = {k: v for k, v in s['B_decision_level'].items() if k != 'states'}
        res['screen'].update(s['A_output_level'])
        out('\nScreening check: ' + json.dumps(res['screen']))
    json.dump(res, open(os.path.join(DATA, 'results.json'), 'w'), indent=1, default=str)
    open(os.path.join(DATA, 'results_summary.txt'), 'w', encoding='utf-8').write('\n'.join(LINES) + '\n')


if __name__ == '__main__':
    main()
