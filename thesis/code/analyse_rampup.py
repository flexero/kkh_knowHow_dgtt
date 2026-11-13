"""Analyse virtual ramp-up results (thesis chapter 6): error, coverage, width per method and month."""
import csv, statistics, sys, collections
f = sys.argv[1] if len(sys.argv) > 1 else '../data/rampup_w1.0.csv'
rows = list(csv.DictReader(open(f, encoding='utf-8')))
M = ['B0', 'B1', 'P0', 'P1', 'P07', 'B0D', 'P07D']
by = collections.defaultdict(list)
for r in rows:
    y = float(r['truth']); p = float(r['pred']); lo = float(r['lo']); hi = float(r['hi'])
    by[(r['method'], int(r['month']))].append((abs(p - y) / y, lo <= y <= hi, (hi - lo) / y, (p - y) / y))
months = sorted({k[1] for k in by})
print('MAPE % by month (rows) and method (cols)')
print('month ' + ' '.join(f'{m:>7}' for m in M))
for k in months:
    print(f'{k:5d} ' + ' '.join(f'{100*statistics.mean(e[0] for e in by[(m,k)]):7.2f}' for m in M))
def agg(m, ks):
    v = [e for k in ks for e in by[(m, k)]]
    return (100*statistics.mean(x[0] for x in v), 100*statistics.mean(x[1] for x in v),
            100*statistics.mean(x[2] for x in v), 100*statistics.mean(x[3] for x in v))
for label, ks in (('months 2-12', months[1:]), ('months 2-6', months[1:6]), ('months 7-12', months[6:])):
    print('\n' + label + ':  method  MAPE%  coverage90%  width%  bias%')
    for m in M:
        a = agg(m, ks); print(f'   {m:5} {a[0]:6.2f} {a[1]:8.1f} {a[2]:8.2f} {a[3]:7.2f}')
# months until error < 5 % for good (per scenario, first month from which E<5% stays)
print('\nshare of scenarios with E<5% per month')
for k in months:
    print(f'{k:3d} ' + ' '.join(f'{100*statistics.mean(e[0] < 0.05 for e in by[(m,k)]):6.0f}' for m in M))
truth = collections.defaultdict(list)
for r in rows:
    if r['method'] == 'B0': truth[int(r['month'])].append(float(r['truth']))
print('\nmean true output by month:', [round(statistics.mean(truth[k])) for k in months])
print('B0 prediction:', round(statistics.mean(float(r['pred']) for r in rows if r['method']=='B0')))
