"""Model-discrepancy learning on top of a predictor (thesis section 6.3.4).

e_k = ln(Y_k / Yhat_k) is the realised log error of month k. A Normal-Inverse-Gamma model with forgetting rho learns
its mean delta (systematic discrepancy) and variance. Prediction for month k+1:
  Yhat' = Yhat * exp(m_n);  log-interval half-width = t_{0.95, 2a_n} * sqrt(s_mc^2 + scale_e^2)
where s_mc is the log-sd of the Monte Carlo interval of the base predictor and scale_e the Student-t scale of e.
Uses only past months -> computable post hoc from the experiment CSV without new simulation.
"""
import csv, math, sys, collections

T95 = {1: 6.314, 2: 2.920, 3: 2.353, 4: 2.132, 5: 2.015, 6: 1.943, 7: 1.895, 8: 1.860, 9: 1.833, 10: 1.812,
       12: 1.782, 15: 1.753, 20: 1.725, 30: 1.697, 1000: 1.645}


def t95(df):
    keys = sorted(T95)
    for k in keys:
        if df <= k:
            return T95[k]
    return 1.645


def add_discrepancy(rows, base, name, rho=0.7, m0=0.0, k0=1.0, a0=2.0, s0=0.05, skip_first=False):
    out = []
    groups = collections.defaultdict(list)
    for r in rows:
        if r['method'] == base:
            groups[(r['scenario'], r['w'])].append(r)
    for key, rs in groups.items():
        rs.sort(key=lambda r: int(r['month']))
        m, k, a, b = m0, k0, a0, s0 ** 2 * (a0 - 1)
        for r in rs:
            pred, lo, hi, y = float(r['pred']), float(r['lo']), float(r['hi']), float(r['truth'])
            scale = math.sqrt(b * (k + 1) / (a * k))
            s_mc = math.log(hi / lo) / (2 * 1.645) if lo > 0 else 0.0
            half = t95(2 * a) * math.sqrt(s_mc ** 2 + scale ** 2)
            c = pred * math.exp(m)
            out.append(dict(r, method=name, pred=round(c, 1), lo=round(c * math.exp(-half)), hi=round(c * math.exp(half))))
            # update with the realised error of this month (forgetting rho)
            if skip_first and int(r['month']) == 1:
                continue   # month-1 forecast came from the prior model, not from the updated twin
            e = math.log(y / pred)
            k0_, m0_, a0_, b0_ = rho * k, m, rho * a, rho * b
            k = k0_ + 1
            m = (k0_ * m0_ + e) / k
            a = a0_ + 0.5
            b = b0_ + k0_ * (e - m0_) ** 2 / (2 * k)
    return out


if __name__ == '__main__':
    f = sys.argv[1]
    rows = list(csv.DictReader(open(f, encoding='utf-8')))
    rows = [r for r in rows if r['method'] in ('B0', 'B1', 'P0', 'P1', 'P07')]
    rows += add_discrepancy(rows, 'P07', 'P07D', skip_first=True) + add_discrepancy(rows, 'B0', 'B0D')
    with open(f, 'w', newline='', encoding='utf-8') as g:
        w = csv.DictWriter(g, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print('added P07D and B0D ->', f, len(rows))
