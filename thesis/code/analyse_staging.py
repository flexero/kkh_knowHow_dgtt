"""Analyse the staging experiment (thesis chapter 7): incremental NPV vs no investment, risk, capital, regret."""
import csv, statistics, sys, collections
P = ['ALL', 'STATIC', 'ADAPT_DEM', 'ADAPTIVE', 'PI_RULE']
def load(fn):
    rows = list(csv.DictReader(open(fn, encoding='utf-8')))
    by = collections.defaultdict(dict)
    for r in rows:
        by[int(r['scenario'])][r['policy']] = r
    return by
def summary(fn):
    by = load(fn); out = {}
    for p in P:
        d = [(float(v[p]['npv']) - float(v['NONE']['npv'])) / 1e6 for v in by.values()]
        cap = [float(v[p]['capital']) / 1e6 for v in by.values()]
        short = [int(v[p]['short_stages']) for v in by.values()]
        worst = sorted(d)[:max(1, len(d) // 10)]
        reg = [(float(v['PI_RULE']['npv']) - float(v[p]['npv'])) / 1e6 for v in by.values()]
        wins = sum(1 for v in by.values() if float(v[p]['npv']) >= max(float(v[q]['npv']) for q in P) - 1)
        out[p] = dict(dnpv=statistics.mean(d), sd=statistics.pstdev(d), cvar=statistics.mean(worst), mn=min(d),
                      cap=statistics.mean(cap), short=statistics.mean(short), p_short=statistics.mean(s > 0 for s in short),
                      regret=statistics.mean(reg), wins=wins)
    # paired comparison ADAPTIVE vs others
    pair = {}
    for q in ('ALL', 'STATIC', 'ADAPT_DEM'):
        diff = [(float(v['ADAPTIVE']['npv']) - float(v[q]['npv'])) / 1e6 for v in by.values()]
        m, s = statistics.mean(diff), statistics.stdev(diff)
        pair[q] = (m, s / len(diff) ** 0.5, sum(x > 0 for x in diff), len(diff))
    finals = {p: collections.Counter(v[p]['final'] for v in by.values()).most_common(3) for p in P}
    return out, pair, finals
if __name__ == '__main__':
    for fn in sys.argv[1:]:
        out, pair, finals = summary(fn)
        print('\n==', fn)
        print('policy     dNPV(M)  sd   CVaR10  min   capital(M)  short_stages  P(short)  regret_vs_PI')
        for p, r in out.items():
            print(f"{p:10} {r['dnpv']:6.2f} {r['sd']:5.2f} {r['cvar']:6.2f} {r['mn']:6.2f} {r['cap']:8.2f} {r['short']:10.2f} {100*r['p_short']:8.0f}% {r['regret']:8.2f}")
        for q, (m, se, k, n) in pair.items():
            print(f'ADAPTIVE - {q}: {m:+.3f} M (SE {se:.3f}), better in {k}/{n}')
        for p, f in finals.items(): print(' ', p, f)
