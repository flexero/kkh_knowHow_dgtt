"""Runs the paper-3 Modbus campaigns sequentially (one bench process at a time, ports 18500-18659).

    python run_campaign.py e2     # replication of the thesis campaign: 8 configurations x 5 seeds x 60 s (mix model)
    python run_campaign.py fill   # re-runs failed E2 runs (max 3 attempts)
    python run_campaign.py e3     # event-loss model validation: Poisson events, lam in {4, 16} 1/s, 8 values of lam*P
Raw results: ../data/e2_replication.jsonl, ../data/e3_lossmodel.jsonl (one JSON line per run, appended).
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')

E2 = [  # (N, mode, P [s], scan [ms])
    (21, 'seq', 0.25, 10), (21, 'par', 0.25, 10),          # case factory size
    (40, 'seq', 1.0, 10), (40, 'par', 1.0, 10),
    (160, 'seq', 1.0, 10), (160, 'par', 1.0, 10),
    (160, 'par', 0.25, 10), (160, 'seq', 1.0, 20),
]
SEEDS = [11, 12, 13, 14, 15]
E3_MU = [1, 2, 4, 6, 8, 10, 12, 16]   # lam * P
E3_LAM = [4.0, 16.0]


def bench(args, out):
    cmd = [sys.executable, os.path.join(HERE, 'bench_modbus.py')] + [str(a) for a in args] + ['--out', out]
    print(' '.join(cmd[2:]), flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    print(r.stdout.strip()[-400:] or r.stderr.strip()[-800:], flush=True)


if __name__ == '__main__':
    which = sys.argv[1]
    if which == 'e2':
        out = os.path.join(DATA, 'e2_replication.jsonl')
        for seed in SEEDS:                       # seeds in the outer loop: drifts in background load spread evenly
            for n, mode, p, scan in E2:
                bench(['--n', n, '--mode', mode, '--period', p, '--dur', 60, '--scan', scan, '--seed', seed,
                       '--model', 'mix', '--tag', f'E2-{n}-{mode}-{p}-{scan}'], out)
    elif which == 'fill':                        # re-run E2 runs that failed (e.g. connection reset at start-up)
        import json
        out = os.path.join(DATA, 'e2_replication.jsonl')
        done = {(r['tag'], r['seed']) for r in map(json.loads, open(out))} if os.path.exists(out) else set()
        for seed in SEEDS:
            for n, mode, p, scan in E2:
                tag = f'E2-{n}-{mode}-{p}-{scan}'
                for attempt in range(3):
                    if (tag, seed) in done:
                        break
                    bench(['--n', n, '--mode', mode, '--period', p, '--dur', 60, '--scan', scan, '--seed', seed,
                           '--model', 'mix', '--tag', tag], out)
                    done = {(r['tag'], r['seed']) for r in map(json.loads, open(out))}
    elif which == 'e3':
        out = os.path.join(DATA, 'e3_lossmodel.jsonl')
        for lam in E3_LAM:
            for mu in E3_MU:
                bench(['--n', 50, '--mode', 'par', '--period', mu / lam, '--dur', 60, '--scan', 0, '--seed', 100 + mu,
                       '--model', 'poisson', '--lam', lam, '--ring', 8, '--tag', f'E3-{lam}-{mu}'], out)
