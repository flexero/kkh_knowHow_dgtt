"""Epistemic vs aleatory share of predictive variance over the ramp-up (thesis Eq. 4.13, section 6.5.5)."""
import random, statistics
from multiprocessing import Pool
import flowline
from rampup_experiment import make_truth, true_line, StationBelief, HOURS

N_T, R = 40, 3
CHECK = (1, 2, 4, 8, 12)


def run(seed):
    rng = random.Random(500 + seed)
    design, truth = make_truth(seed)
    bel = [StationBelief(st, 1.0) for st in design]
    out = {}
    for k in range(1, 13):
        if k in CHECK:
            means, within = [], []
            for _ in range(N_T):
                line = [b.sample(st, rng) for b, st in zip(bel, design)]
                ys = [flowline.simulate(line, flowline.MIX, HOURS, rng)[0] for _ in range(R)]
                means.append(statistics.mean(ys)); within.append(statistics.variance(ys))
            epi, ale = statistics.variance(means) - statistics.mean(within) / R, statistics.mean(within)
            epi = max(epi, 0.0)
            out[k] = (epi / (epi + ale), (epi + ale) ** 0.5)
        _, obs, _ = flowline.simulate(true_line(design, truth, k), flowline.MIX, HOURS, rng, record=True)
        for b, o in zip(bel, obs):
            b.update(o, 0.7)
    return out


if __name__ == '__main__':
    with Pool(10) as p:
        res = p.map(run, range(1, 11))
    print('month  epistemic share %  predictive sd (parts)')
    for k in CHECK:
        print(f'{k:5d} {100*statistics.mean(r[k][0] for r in res):10.1f} {statistics.mean(r[k][1] for r in res):14.0f}')
