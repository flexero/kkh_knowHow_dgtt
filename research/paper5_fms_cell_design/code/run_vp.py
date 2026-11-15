"""One replication: the real cell controller (rule variant from rules.py) against the virtual plant (21 Modbus PLCs).

usage: python run_vp.py --tag T --rules after --N 12 --seed 101 --hours 4 --speed 20 --port 17500 [--mix design|vc30]
                        [--opf 1.0]
Writes data/raw/<tag>.json with the job, work-order and event tables of the controller database.
Base ports must lie in 17500-17999 (21 consecutive ports per run).
"""
import argparse
import json
import os
import random
import sys
import tempfile
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, ROOT)
sys.path.insert(0, HERE)

from fmsctl.sim import virtual_plant                     # noqa: E402
from fmsctl.spec import plant, tooling as TL             # noqa: E402
from rules import RULESETS, RuleController               # noqa: E402

# pallets placed in the rack for N pallets (fixture A = pallets 1-8, fixture B = 9-12; both types always present)
SETS = {2: [1, 9], 3: [1, 2, 9], 4: [1, 2, 3, 9], 6: [1, 2, 3, 4, 9, 10], 8: [1, 2, 3, 4, 5, 6, 9, 10],
        12: list(range(1, 13))}
# order blocks of 10 (variant 1 = VC10, 2 = VC20, 3 = VC30)
MIXES = {'design': [1] * 3 + [2] * 5 + [3] * 2,          # 0.3 / 0.5 / 0.2
         'vc30': [1] * 2 + [2] * 4 + [3] * 4}             # 0.2 / 0.4 / 0.4 (fixture-B heavy)


def patch_operator(factor):
    """Scale the simulated operator task times of the virtual load station (what-if: quick-clamping fixtures)."""
    def job_load(self, code):
        typ, pal = self.get('task.type'), self.get('task.palletId')
        self.set_state(2); self.set('load.palletId', pal)
        self.sleep({1: 90, 2: 60, 3: 140, 4: 600}.get(typ, 90) * factor * self.rng.uniform(0.8, 1.3))
        self.set('load.clamped', 1); self.set('load.operatorReady', 1); self.set('load.partPresent', 1 if typ in (1, 3) else 0)
        with self.shared['lock']:
            self.shared['pstate'][pal] = 1 if typ in (1, 3) else 0
        self.shared['sync']()
        return 0
    virtual_plant.Device.job_load = job_load


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tag', required=True)
    ap.add_argument('--rules', default='after', choices=sorted(RULESETS))
    ap.add_argument('--N', type=int, default=12)
    ap.add_argument('--seed', type=int, default=101)
    ap.add_argument('--hours', type=float, default=4.0)
    ap.add_argument('--speed', type=float, default=20.0)
    ap.add_argument('--port', type=int, default=17500)
    ap.add_argument('--mix', default='design', choices=sorted(MIXES))
    ap.add_argument('--opf', type=float, default=1.0)
    ap.add_argument('--orders', type=int, default=400)
    ap.add_argument('--timeout', type=float, default=2.0,
                    help='Modbus client time-out [wall s]; production value 0.3 s, raised for a loaded host')
    a = ap.parse_args()
    assert 17500 <= a.port and a.port + 21 <= 18000, 'base port outside 17500-17999'
    if a.opf != 1.0:
        patch_operator(a.opf)

    devs = virtual_plant.start(speed=a.speed, seed=a.seed, base_port=a.port)
    sh = devs['PPS-1'].shared
    with sh['lock']:
        for p in range(1, 13):
            if p not in SETS[a.N]:
                sh['slots'][p] = 0
    sh['sync']()
    stop = [False]

    def refill():                      # tool setter keeps all tools alive (tooling is not part of this study)
        while not stop[0]:
            for m in ('HMC-01', 'HMC-02', 'HMC-03'):
                for pk in TL.MAGAZINE:
                    devs[m].set(f'cnc.toolLife{pk:02d}', 1000)
            time.sleep(0.5)
    threading.Thread(target=refill, daemon=True).start()

    db = os.path.join(tempfile.mkdtemp(), 'cell.db')
    ctl = RuleController(plant.device_table(virtual=True, base_port=a.port), db, rule='EDD', loop=0.02,
                         tool_check=False, logistics=False, speed=a.speed, **RULESETS[a.rules])
    for link in ctl.links.values():    # harness setting only: avoids false OFFLINE detections when the host is loaded
        link.cli.timeout = a.timeout
    ctl.start(); time.sleep(0.5); ctl.set_mode('auto')
    rng = random.Random(a.seed)
    seq = []
    while len(seq) < a.orders:          # seeded shuffle inside each block of 10 orders: exact mix, random sequence
        blk = list(MIXES[a.mix]); rng.shuffle(blk); seq += blk
    now = time.time()
    for k, v in enumerate(seq[:a.orders]):
        ctl.create_wo(f'WO-{k:03d}', v, 1, due=now + 60 * k)
    t0 = time.time()
    time.sleep(a.hours * 3600 / a.speed)
    t1 = time.time()
    ctl.stop(); stop[0] = True
    out = {'args': vars(a), 't0': t0, 't1': t1, 'pallets_placed': SETS[a.N],
           'jobs': ctl.db.q('SELECT * FROM job'), 'wos': ctl.db.q('SELECT * FROM wo'),
           'events': ctl.db.q("SELECT * FROM event WHERE level IN ('alarm', 'error', 'warn')")}
    path = os.path.join(HERE, '..', 'data', 'raw', a.tag + '.json')
    with open(path, 'w') as f:
        json.dump(out, f)
    print('done', a.tag, len(out['jobs']), flush=True)
    os._exit(0)


if __name__ == '__main__':
    main()
