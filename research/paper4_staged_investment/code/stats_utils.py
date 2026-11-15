"""Small statistics toolkit (standard library only): Student-t, paired tests, Wilcoxon, Holm, bootstrap, CVaR."""
from __future__ import annotations

import math
import random
import statistics
from statistics import NormalDist


def _betacf(a, b, x):
    MAXIT, EPS, FPMIN = 300, 3e-14, 1e-300
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    d = 1.0 / (d if abs(d) > FPMIN else FPMIN)
    h = d
    for m in range(1, MAXIT + 1):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > FPMIN else FPMIN)
        c = 1.0 + aa / c
        c = c if abs(c) > FPMIN else FPMIN
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > FPMIN else FPMIN)
        c = 1.0 + aa / c
        c = c if abs(c) > FPMIN else FPMIN
        de = d * c
        h *= de
        if abs(de - 1.0) < EPS:
            break
    return h


def betainc(a, b, x):
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lbt = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1 - x)
    if x < (a + 1) / (a + b + 2):
        return math.exp(lbt) * _betacf(a, b, x) / a
    return 1.0 - math.exp(lbt) * _betacf(b, a, 1 - x) / b


def t_sf2(t, df):
    """Two-sided p-value of Student t."""
    return betainc(df / 2.0, 0.5, df / (df + t * t))


def t_ppf(p, df):
    lo, hi = 0.0, 50.0
    target = 2 * (1 - p)
    for _ in range(200):
        mid = (lo + hi) / 2
        if t_sf2(mid, df) > target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def mean_ci(x, level=0.95):
    n = len(x)
    m = statistics.mean(x)
    se = statistics.stdev(x) / math.sqrt(n)
    h = t_ppf(1 - (1 - level) / 2, n - 1) * se
    return m, m - h, m + h, se


def wilcoxon(d):
    """Wilcoxon signed-rank test, normal approximation with tie correction; zeros dropped. Two-sided p."""
    d = [x for x in d if abs(x) > 1e-9]
    n = len(d)
    if n == 0:
        return 1.0
    a = sorted((abs(x), i) for i, x in enumerate(d))
    ranks = [0.0] * n
    i, ties = 0, 0.0
    while i < n:
        j = i
        while j + 1 < n and abs(a[j + 1][0] - a[i][0]) < 1e-9:
            j += 1
        r = (i + j) / 2.0 + 1
        for k in range(i, j + 1):
            ranks[a[k][1]] = r
        t = j - i + 1
        ties += t ** 3 - t
        i = j + 1
    wp = sum(r for r, x in zip(ranks, d) if x > 0)
    mu = n * (n + 1) / 4.0
    var = n * (n + 1) * (2 * n + 1) / 24.0 - ties / 48.0
    z = (wp - mu) / math.sqrt(var) if var > 0 else 0.0
    return 2 * (1 - NormalDist().cdf(abs(z)))


def paired(a, b):
    """a - b paired: mean, 95 % CI, t p-value, Wilcoxon p-value, wins of a."""
    d = [x - y for x, y in zip(a, b)]
    m, lo, hi, se = mean_ci(d)
    t = m / se if se > 0 else 0.0
    return dict(mean=m, lo=lo, hi=hi, se=se, p_t=t_sf2(t, len(d) - 1) if se > 0 else 1.0, p_w=wilcoxon(d),
                wins=sum(x > 1e-9 for x in d), ties=sum(abs(x) <= 1e-9 for x in d), n=len(d))


def holm(pvals):
    """Holm-Bonferroni adjusted p-values (same order as input)."""
    m = len(pvals)
    order = sorted(range(m), key=lambda i: pvals[i])
    adj, run = [0.0] * m, 0.0
    for rank, i in enumerate(order):
        run = max(run, min(1.0, (m - rank) * pvals[i]))
        adj[i] = run
    return adj


def cvar_low(x, alpha=0.10):
    """Mean of the worst alpha share (lower tail of a value distribution)."""
    s = sorted(x)
    k = max(1, int(round(alpha * len(s))))
    return statistics.mean(s[:k])


def boot_ci(stat, data_cols, B=4000, seed=1, level=0.95):
    """Paired bootstrap of stat(*cols) - data_cols are equally long lists resampled jointly."""
    rng = random.Random(seed)
    n = len(data_cols[0])
    vals = []
    for _ in range(B):
        idx = [rng.randrange(n) for _ in range(n)]
        vals.append(stat(*[[c[i] for i in idx] for c in data_cols]))
    vals.sort()
    return vals[int((1 - level) / 2 * B)], vals[int((1 + level) / 2 * B) - 1]
