"""Run the whole experiment plan of the paper in parallel (each run on its own block of 21 ports in 17500-17999).

usage: python batch.py [max_parallel]      – runs already present in data/raw are skipped (restartable)
Plan (all 4 simulated hours, warm-up 0.5 h removed in analyse.py, speed x20 unless stated):
  E1  present rules ('after'), design mix, N = 2, 4, 8, 12 pallets, seeds 101-105
  E2  rule ablation at N = 12, design mix: 'before', 'fb', 'nro' (+ 'after' from E1), seeds 101-105
  E2b first rules ('before') at N = 4 and 8, seeds 101-105
  E3  fixture-B-heavy mix 0.2/0.4/0.4, N = 12, 'before' and 'after', seeds 101-105
  E4  operator times x 100/140 (quick clamping), N = 12, 'after', seeds 101-105
  (all runs: Modbus client time-out 2 s wall, see run_vp.py; a first batch with the production value 0.3 s on a
   loaded host produced false OFFLINE detections and is kept in data/raw_invalid_t03 for transparency)
  E5  time-compression check: 'after', N = 12, seed 101 at x10
"""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'raw')
SEEDS = [101, 102, 103, 104, 105]


def plan():
    P = []
    for s in SEEDS:
        P.append((f'E1_after_N12_s{s}', ['--rules', 'after', '--N', '12', '--seed', str(s)]))
        P.append((f'E2_before_N12_s{s}', ['--rules', 'before', '--N', '12', '--seed', str(s)]))
    for s in SEEDS:
        for n in (2, 4, 8):
            P.append((f'E1_after_N{n}_s{s}', ['--rules', 'after', '--N', str(n), '--seed', str(s)]))
        P.append((f'E2_fb_N12_s{s}', ['--rules', 'fb', '--N', '12', '--seed', str(s)]))
        P.append((f'E2_nro_N12_s{s}', ['--rules', 'nro', '--N', '12', '--seed', str(s)]))
    for s in SEEDS:
        for n in (4, 8):
            P.append((f'E2b_before_N{n}_s{s}', ['--rules', 'before', '--N', str(n), '--seed', str(s)]))
        for r in ('before', 'after'):
            P.append((f'E3_{r}_vc30_N12_s{s}', ['--rules', r, '--N', '12', '--seed', str(s), '--mix', 'vc30']))
        P.append((f'E4_after_op100_N12_s{s}', ['--rules', 'after', '--N', '12', '--seed', str(s), '--opf', f'{100/140:.6f}']))
    P.append(('E5_after_N12_s101_x10', ['--rules', 'after', '--N', '12', '--seed', '101', '--speed', '10']))
    return P


def main():
    maxp = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    todo = [(t, a) for t, a in plan() if not os.path.exists(os.path.join(RAW, t + '.json'))]
    free_ports = [17500 + 25 * k for k in range(20)]
    running = []
    print(f'{len(todo)} runs to do, {maxp} in parallel', flush=True)
    while todo or running:
        for p, port, tag, t0 in running[:]:
            if p.poll() is not None:
                running.remove((p, port, tag, t0)); free_ports.append(port)
                print(f'{time.strftime("%H:%M:%S")} finished {tag} rc={p.returncode} {time.time() - t0:.0f}s', flush=True)
        while todo and len(running) < maxp:
            tag, args = todo.pop(0)
            port = free_ports.pop(0)
            log = open(os.path.join(RAW, tag + '.log'), 'w')
            p = subprocess.Popen([sys.executable, os.path.join(HERE, 'run_vp.py'), '--tag', tag, '--port', str(port),
                                  '--hours', '4'] + args, stdout=log, stderr=subprocess.STDOUT, cwd=HERE)
            running.append((p, port, tag, time.time()))
            print(f'{time.strftime("%H:%M:%S")} started {tag} on {port}', flush=True)
        time.sleep(5)
    print('ALL DONE', flush=True)


if __name__ == '__main__':
    main()
