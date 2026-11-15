"""Analysis of the paper-2 experiments (all numbers SIMULATED). Standard library only.

* adds the discrepancy-corrected predictors post hoc with the thesis function discrepancy.add_discrepancy
  (uses past months only, so it is a valid online procedure);
* computes accuracy, bias, coverage (50/80/90 %), relative interval width, interval score and CRPS;
* scenario-level bootstrap 95 % confidence intervals and paired Wilcoxon signed-rank tests (Holm-adjusted);
* time-to-accuracy (first month from which the error stays below 5 %);
* bottleneck identification and station-capacity error;
writes data/results.json and data/results_summary.txt.
Usage: python analyse.py
"""
import collections
import csv
import json
import math
import os
import random
import statistics

import p2common as c
import discrepancy as dsc          # thesis module

B_BOOT = 2000
ALPHA = 0.10
M_ALL = list(range(2, 13))
M_EARLY = list(range(2, 7))
M_LATE = list(range(7, 13))


def load(variant):
    p = os.path.join(c.DATA, f'rampup_{variant}.csv')
    if not os.path.exists(p):
        return None
    rows = list(csv.DictReader(open(p, encoding='utf-8')))
    for r in rows:
        r['w'] = r['variant']
        r['lo'], r['hi'] = r['q05'], r['q95']
    return rows


def add_d(rows, variant):
    """Discrepancy-corrected predictors. skip_first=True: learn only from errors of data-based forecasts."""
    methods = {r['method'] for r in rows}
    out = []
    spec = []
    for m in sorted(methods):
        if m.startswith('P') and m != 'P0':
            spec.append((m, m + 'D', 0.7, True))
    if 'P07' in methods:
        spec += [('P07', 'P07D_m1', 0.7, False), ('P07', 'P07D_r1', 1.0, True)]
    if 'B0' in methods:
        spec.append(('B0', 'B0D', 0.7, False))
    if 'B2' in methods:
        spec.append(('B2', 'B2D', 0.7, True))
    if 'NV' in methods:
        spec.append(('NV', 'NVD', 0.7, True))
    for base, name, rho, skip in spec:
        out += dsc.add_discrepancy(rows, base, name, rho=rho, skip_first=skip)
    return rows + out


def metrics(r):
    y, p = float(r['truth']), float(r['pred'])
    lo, hi = float(r['lo']), float(r['hi'])
    is_ = (hi - lo) + (2 / ALPHA) * max(lo - y, 0) + (2 / ALPHA) * max(y - hi, 0)
    d = {'ape': abs(p - y) / y, 'bias': (p - y) / y, 'cov90': float(lo <= y <= hi), 'width': (hi - lo) / y,
         'is': is_ / y}
    is_d = r['method'].endswith(('D', 'D_m1', 'D_r1'))     # discrepancy-corrected: only mean and 90 % interval
    if r.get('crps') not in (None, '') and not is_d:
        d['crps'] = float(r['crps']) / y
    if r.get('q25') not in (None, '') and not is_d:
        d['cov50'] = float(float(r['q25']) <= y <= float(r['q75']))
        d['cov80'] = float(float(r['q10']) <= y <= float(r['q90']))
    return d


def per_scenario(rows):
    """{method: {scenario: {month: metrics}}}"""
    out = collections.defaultdict(lambda: collections.defaultdict(dict))
    for r in rows:
        out[r['method']][int(r['scenario'])][int(r['month'])] = metrics(r)
    return out


def scen_mean(ps, m, key, months):
    """per-scenario mean of a metric over months -> list ordered by scenario"""
    res = []
    for s in sorted(ps[m]):
        v = [ps[m][s][k][key] for k in months if k in ps[m][s] and key in ps[m][s][k]]
        if v:
            res.append(statistics.mean(v))
    return res


_IDX = {}


def boot_ci(x, seed=1, b=B_BOOT):
    """Percentile bootstrap over scenarios. One fixed set of resampling indices per sample size (seeded) is
    reused for every metric, so all intervals refer to the same bootstrap resamples."""
    n = len(x)
    if n not in _IDX:
        rng = random.Random(20261114 + n)
        _IDX[n] = [[rng.randrange(n) for _ in range(n)] for _ in range(b)]
    means = sorted(sum(x[i] for i in idx) / n for idx in _IDX[n])
    return sum(x) / n, means[int(0.025 * b)], means[int(0.975 * b) - 1]


def point(x, seed=None):
    m = sum(x) / len(x)
    return m, m, m


def wilcoxon(d):
    """Two-sided Wilcoxon signed-rank test, normal approximation with tie and zero corrections."""
    d = [x for x in d if abs(x) > 1e-12]
    n = len(d)
    if n == 0:
        return 0.0, 1.0
    a = sorted((abs(x), i) for i, x in enumerate(d))
    ranks = [0.0] * n
    i = 0
    ties = 0.0
    while i < n:
        j = i
        while j + 1 < n and a[j + 1][0] == a[i][0]:
            j += 1
        rk = (i + j) / 2 + 1
        for t in range(i, j + 1):
            ranks[a[t][1]] = rk
        cnt = j - i + 1
        ties += cnt ** 3 - cnt
        i = j + 1
    wplus = sum(r for r, x in zip(ranks, d) if x > 0)
    mu = n * (n + 1) / 4
    sd = math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - ties / 48)
    z = (wplus - mu) / sd if sd > 0 else 0.0
    p = math.erfc(abs(z) / math.sqrt(2))
    return z, p


def holm(pvals):
    idx = sorted(range(len(pvals)), key=lambda i: pvals[i])
    adj = [0.0] * len(pvals)
    run = 0.0
    m = len(pvals)
    for r, i in enumerate(idx):
        run = max(run, min(1.0, (m - r) * pvals[i]))
        adj[i] = run
    return adj


def time_to_acc(ps, m, thr=0.05):
    """first month k >= 2 from which E_j < thr for all j >= k (13 = never within 12 months)"""
    out = []
    for s in sorted(ps[m]):
        first = 13
        for k in range(12, 1, -1):
            if ps[m][s][k]['ape'] < thr:
                first = k
            else:
                break
        out.append(first)
    return out


def summarise_variant(variant, order):
    rows = load(variant)
    if rows is None:
        return None
    rows = add_d(rows, variant)
    ps = per_scenario(rows)
    first = next(m for m in order if m in ps)
    res = {'n_scenarios': len(ps[first]), 'methods': {}}
    for m in order:
        if m not in ps:
            continue
        d = {}
        for lab, months in (('all', M_ALL), ('early', M_EARLY), ('late', M_LATE)):
            for key in ('ape', 'bias', 'cov90', 'width', 'is', 'crps', 'cov50', 'cov80'):
                x = scen_mean(ps, m, key, months)
                if x:
                    f = boot_ci if (lab == 'all' and (variant == 'main' or key in ('ape', 'cov90'))) else point
                    d[f'{key}_{lab}'] = [round(100 * v, 3) for v in f(x)]
        d['by_month_ape'] = {k: round(100 * statistics.mean(ps[m][s][k]['ape'] for s in ps[m]), 3) for k in range(1, 13)}
        d['by_month_bias'] = {k: round(100 * statistics.mean(ps[m][s][k]['bias'] for s in ps[m]), 3) for k in range(1, 13)}
        d['by_month_cov90'] = {k: round(100 * statistics.mean(ps[m][s][k]['cov90'] for s in ps[m]), 2) for k in range(1, 13)}
        d['by_month_share_below5'] = {k: round(100 * statistics.mean(ps[m][s][k]['ape'] < 0.05 for s in ps[m]), 1)
                                      for k in range(1, 13)}
        tta = time_to_acc(ps, m)
        d['tta_median'] = statistics.median(tta)
        d['tta_q25_q75'] = [sorted(tta)[int(0.25 * len(tta))], sorted(tta)[int(0.75 * len(tta)) - 1]]
        d['tta_share_never'] = round(100 * statistics.mean(t == 13 for t in tta), 1)
        d['tta_share_by_m6'] = round(100 * statistics.mean(t <= 6 for t in tta), 1)
        res['methods'][m] = d
    truth = collections.defaultdict(list)
    for r in rows:
        if r['method'] == first:
            truth[int(r['month'])].append(float(r['truth']))
    res['truth_mean_by_month'] = {k: round(statistics.mean(v)) for k, v in sorted(truth.items())}
    res['truth_p10_p90_by_month'] = {k: [sorted(v)[int(0.1 * len(v))], sorted(v)[int(0.9 * len(v)) - 1]]
                                     for k, v in sorted(truth.items())}
    # paired tests against the proposed method P07D (MAPE months 2-12 and early)
    if 'P07D' in ps:
        tests = {}
        others = [m for m in order if m in ps and m != 'P07D']
        for lab, months in (('all', M_ALL), ('early', M_EARLY)):
            pv, recs = [], []
            ref = scen_mean(ps, 'P07D', 'ape', months)
            for m in others:
                x = scen_mean(ps, m, 'ape', months)
                diff = [a - b for a, b in zip(x, ref)]      # >0 means P07D is better
                z, p = wilcoxon(diff)
                ci = boot_ci(diff, seed=hash_seed(variant, m, 'diff', lab))
                recs.append({'method': m, 'mean_diff_pp': round(100 * ci[0], 3), 'ci95': [round(100 * ci[1], 3), round(100 * ci[2], 3)],
                             'z': round(z, 3), 'p': p, 'p_better': round(100 * statistics.mean(v > 0 for v in diff), 1)})
                pv.append(p)
            for rec, pa in zip(recs, holm(pv)):
                rec['p_holm'] = pa
            tests[lab] = recs
        res['tests_vs_P07D'] = tests
    return res


def hash_seed(*a):
    return int.from_bytes(('|'.join(map(str, a))).encode()[:8].ljust(8, b'0'), 'little') % (2 ** 31)


def bottleneck():
    p = os.path.join(c.DATA, 'bottleneck_main.csv')
    if not os.path.exists(p):
        return None
    rows = list(csv.DictReader(open(p, encoding='utf-8')))
    out = {}
    for m in ('B0', 'B2', 'P10', 'P07'):
        d = {}
        for k in range(1, 13):
            rr = [r for r in rows if r['method'] == m and int(r['month']) == k]
            hit = [int(r['hit']) for r in rr]
            cap = [float(r['cap_mape']) for r in rr]
            hm, hl, hh = boot_ci(hit, seed=k)
            d[k] = {'hit': round(100 * hm, 1), 'hit_ci': [round(100 * hl, 1), round(100 * hh, 1)],
                    'cap_mape': round(100 * statistics.mean(cap), 2)}
        out[m] = d
    true12 = collections.Counter(r['bn_true'] for r in rows if r['method'] == 'B0' and int(r['month']) == 12)
    true1 = collections.Counter(r['bn_true'] for r in rows if r['method'] == 'B0' and int(r['month']) == 1)
    out['true_bn_month12'] = dict(true12)
    out['true_bn_month1'] = dict(true1)
    # hit over months 2-12 pooled with scenario bootstrap
    for m in ('B0', 'B2', 'P10', 'P07'):
        per_s = collections.defaultdict(list)
        for r in rows:
            if r['method'] == m and int(r['month']) >= 2:
                per_s[int(r['scenario'])].append(int(r['hit']))
        x = [statistics.mean(v) for _, v in sorted(per_s.items())]
        out[m]['pooled_2_12'] = [round(100 * v, 1) for v in boot_ci(x, seed=99)]
    return out


def variance():
    p = os.path.join(c.DATA, 'variance_decomposition.csv')
    if not os.path.exists(p):
        return None
    rows = list(csv.DictReader(open(p, encoding='utf-8')))
    out = {}
    for rho in ('0.7', '1.0'):
        d = {}
        for k in sorted({int(r['month']) for r in rows}):
            rr = [r for r in rows if r['rho'] == rho and int(r['month']) == k]
            sh = [float(r['share_epi']) for r in rr]
            m, lo, hi = boot_ci(sh, seed=k)
            d[k] = {'share_epi': round(100 * m, 1), 'ci': [round(100 * lo, 1), round(100 * hi, 1)],
                    'sd_total': round(statistics.mean(float(r['sd_total']) for r in rr), 1),
                    'sd_epi': round(statistics.mean(float(r['epistemic_var']) ** 0.5 for r in rr), 1)}
        out[rho] = d
    out['n'] = len({r['scenario'] for r in rows})
    return out


ORDER_MAIN = ['B0', 'B1', 'B2', 'NV', 'P0', 'P10', 'P09', 'P08', 'P07', 'P06', 'P05',
              'B0D', 'B2D', 'NVD', 'P10D', 'P09D', 'P08D', 'P07D', 'P06D', 'P05D', 'P07D_m1', 'P07D_r1']
ORDER_OTHER = ['B0', 'NV', 'P0', 'P10', 'P07', 'B0D', 'NVD', 'P10D', 'P07D', 'P07D_m1', 'P07D_r1']


def main():
    res = {}
    for v in ('main', 'w0.25', 'w4', 'tau1', 'tau4', 'stat', 'mm'):
        r = summarise_variant(v, ORDER_MAIN if v == 'main' else ORDER_OTHER)
        if r:
            res[v] = r
    res['bottleneck'] = bottleneck()
    res['variance'] = variance()
    for f, k in (('computational_cost.json', 'cost'), ('p0_full_design.json', 'p0_full')):
        p = os.path.join(c.DATA, f)
        if os.path.exists(p):
            res[k] = json.load(open(p))
    json.dump(res, open(os.path.join(c.DATA, 'results.json'), 'w'), indent=1)
    write_text(res)


def fmt(ci, d=1):
    return f'{ci[0]:.{d}f} [{ci[1]:.{d}f}, {ci[2]:.{d}f}]'


def write_text(res):
    L = []
    for v, r in res.items():
        if not isinstance(r, dict) or 'methods' not in r:
            continue
        L.append(f'\n=== variant {v}  (n = {r["n_scenarios"]} scenarios) ===')
        L.append('truth mean by month: ' + str(r['truth_mean_by_month']))
        L.append(f'{"method":9} {"MAPE2-12":>22} {"MAPE2-6":>22} {"MAPE7-12":>22} {"bias2-12":>22} {"cov90":>22} '
                 f'{"width":>8} {"IS/y":>8} {"CRPS/y":>8} {"cov50":>6} {"cov80":>6} tta_med tta_never tta<=6')
        for m, d in r['methods'].items():
            L.append(f'{m:9} {fmt(d["ape_all"]):>22} {fmt(d["ape_early"]):>22} {fmt(d["ape_late"]):>22} '
                     f'{fmt(d["bias_all"]):>22} {fmt(d["cov90_all"]):>22} {d["width_all"][0]:8.1f} {d["is_all"][0]:8.1f} '
                     f'{(d["crps_all"][0] if "crps_all" in d else float("nan")):8.2f} '
                     f'{(d["cov50_all"][0] if "cov50_all" in d else float("nan")):6.1f} '
                     f'{(d["cov80_all"][0] if "cov80_all" in d else float("nan")):6.1f} '
                     f'{d["tta_median"]:7} {d["tta_share_never"]:9} {d["tta_share_by_m6"]:6}')
        L.append('MAPE by month:')
        ms = list(r['methods'])
        L.append('month ' + ' '.join(f'{m:>8}' for m in ms))
        for k in range(1, 13):
            L.append(f'{k:5d} ' + ' '.join(f'{r["methods"][m]["by_month_ape"][k]:8.2f}' for m in ms))
        L.append('share E<5% by month:')
        for k in range(1, 13):
            L.append(f'{k:5d} ' + ' '.join(f'{r["methods"][m]["by_month_share_below5"][k]:8.0f}' for m in ms))
        L.append('coverage90 by month:')
        for k in range(1, 13):
            L.append(f'{k:5d} ' + ' '.join(f'{r["methods"][m]["by_month_cov90"][k]:8.0f}' for m in ms))
        if 'tests_vs_P07D' in r:
            for lab, recs in r['tests_vs_P07D'].items():
                L.append(f'paired tests vs P07D, months {lab}: method  diff(pp) [CI]  z  p  p_holm  %scen P07D better')
                for t in recs:
                    L.append(f'   {t["method"]:8} {t["mean_diff_pp"]:7.2f} [{t["ci95"][0]:6.2f},{t["ci95"][1]:6.2f}] '
                             f'{t["z"]:7.2f} {t["p"]:.2e} {t["p_holm"]:.2e} {t["p_better"]:5.1f}')
    if res.get('bottleneck'):
        b = res['bottleneck']
        L.append('\n=== bottleneck (main) ===  hit% [CI] / capacity MAPE %')
        for k in range(1, 13):
            L.append(f'{k:3d} ' + '  '.join(f'{m}: {b[m][k]["hit"]:5.1f} [{b[m][k]["hit_ci"][0]:5.1f},{b[m][k]["hit_ci"][1]:5.1f}] {b[m][k]["cap_mape"]:5.2f}'
                                         for m in ('B0', 'B2', 'P10', 'P07')))
        L.append('pooled months 2-12: ' + str({m: b[m]['pooled_2_12'] for m in ('B0', 'B2', 'P10', 'P07')}))
        L.append('true bottleneck month 1: ' + str(b['true_bn_month1']) + '  month 12: ' + str(b['true_bn_month12']))
    if res.get('variance'):
        L.append('\n=== variance decomposition ===')
        for rho in ('0.7', '1.0'):
            for k, d in res['variance'][rho].items():
                L.append(f'rho {rho} month {k:2}: epistemic share {d["share_epi"]:5.1f} % {d["ci"]}  sd {d["sd_total"]:6.1f}  sd_epi {d["sd_epi"]:6.1f}')
    for k in ('cost', 'p0_full'):
        if k in res:
            L.append(f'\n=== {k} ===\n' + json.dumps(res[k], indent=1))
    open(os.path.join(c.DATA, 'results_summary.txt'), 'w', encoding='utf-8').write('\n'.join(L))
    print('\n'.join(L))


if __name__ == '__main__':
    main()
