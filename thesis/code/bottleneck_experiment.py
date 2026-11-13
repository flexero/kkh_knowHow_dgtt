"""Does the parameter-level twin identify the true bottleneck and station capacities? (thesis section 6.5.4)

For each scenario and month: true station capacities (Eq. 4.2 with the true month-k parameters) give the true
bottleneck; the design model (B0) and the Bayesian twin (posterior means, rho = 1 and 0.7) give predicted ones.
An output-level correction (B0D) cannot answer this question at all - it has no station-level information.
"""
import csv, random, statistics, sys
from multiprocessing import Pool
import bayes, flowline
from rampup_experiment import make_truth, true_line, StationBelief, MONTHS, HOURS


def capacities(line):
    out = []
    for st in line:
        tmean = sum(flowline.MIX[v] * st.tdesign[v] * st.speed for v in flowline.MIX)
        c, _ = bayes.station_capacity(st.c, tmean, 0, st.mtbf_h, st.mttr_h, st.scrap, HOURS)
        out.append(c)
    return out


def posterior_line(design, beliefs):
    return [flowline.Station(st.name, st.c, st.buffer, st.tdesign, b.cyc.mean_time(), 0.05,
                             b.fail.mtbf_mean(), b.rep.mttr_mean(), b.scrap.mean()) for st, b in zip(design, beliefs)]


def run(seed, w=1.0):
    rng = random.Random(seed)
    design, truth = make_truth(seed)
    beliefs = {1.0: [StationBelief(st, w) for st in design], 0.7: [StationBelief(st, w) for st in design]}
    rows = []
    cap_design = capacities(design)
    for k in range(1, MONTHS + 1):
        tl = true_line(design, truth, k)
        cap_true = capacities(tl)
        bt = min(range(len(tl)), key=lambda j: cap_true[j])
        preds = {'B0': cap_design, 'P1': capacities(posterior_line(design, beliefs[1.0])),
                 'P07': capacities(posterior_line(design, beliefs[0.7]))}
        for name, cp in preds.items():
            bp = min(range(len(cp)), key=lambda j: cp[j])
            mape = statistics.mean(abs(a - b) / b for a, b in zip(cp, cap_true))
            rows.append({'scenario': seed, 'month': k, 'method': name, 'bn_true': tl[bt].name, 'bn_pred': design[bp].name,
                         'hit': int(bp == bt), 'cap_mape': round(mape, 4)})
        _, obs, _ = flowline.simulate(tl, flowline.MIX, HOURS, rng, record=True)
        for rho, bl in beliefs.items():
            for b, o in zip(bl, obs):
                b.update(o, rho)
    return rows


if __name__ == '__main__':
    with Pool(15) as p:
        res = p.map(run, range(1, 31))
    rows = [r for x in res for r in x]
    with open('../data/bottleneck.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print('month  ' + '  '.join(f'{m}:hit% capMAPE%' for m in ('B0', 'P1', 'P07')))
    for k in range(1, MONTHS + 1):
        line = []
        for m in ('B0', 'P1', 'P07'):
            rs = [r for r in rows if r['month'] == k and r['method'] == m]
            line.append(f"{100*statistics.mean(r['hit'] for r in rs):5.0f} {100*statistics.mean(r['cap_mape'] for r in rs):6.1f}")
        print(f'{k:4d}   ' + '     '.join(line))
    from collections import Counter
    print('true bottlenecks month 12:', Counter(r['bn_true'] for r in rows if r['month'] == 12 and r['method'] == 'B0'))
