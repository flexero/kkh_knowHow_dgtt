"""Item 2 acceptance test: cell controller on the virtual plant (speed x50).

    python -m fmsctl.tests.test_item2
Three work orders run fully automatically while HMC-03 is OFFLINE; then the HTTP API is tested, the controller is
stopped and restarted on the same database (state recovery) and a fourth work order is completed.
"""
import json
import os
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer

from fmsctl.cell.controller import CellController
from fmsctl.cell.server import make_handler
from fmsctl.sim import virtual_plant
from fmsctl.spec import plant

SPEED, PORT, HTTP = 50.0, 15500, 18091   # x50: faster than real time, controller latency still small
R = []


def check(name, ok, detail=''):
    R.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} | {name}" + (f' | {detail}' if detail else ''))


def wait_wos(ctl, ids, timeout):
    t_end = time.time() + timeout
    while time.time() < t_end:
        ws = {w['id']: w for w in ctl.db.q('SELECT * FROM wo')}
        if all(ws.get(i, {}).get('finished') for i in ids):
            return True
        time.sleep(0.2)
    return False


def main():
    db = os.path.join(tempfile.mkdtemp(), 'cell_test.db')
    devs = virtual_plant.start(speed=SPEED, seed=11, base_port=PORT)
    devs['HMC-03'].server.stop()                                   # machine switched off
    table = plant.device_table(virtual=True, base_port=PORT)
    ctl = CellController(table, db, rule='EDD', loop=0.02)
    ctl.start()
    time.sleep(0.5)
    ctl.set_mode('auto')
    now = time.time()
    ctl.create_wo('WO-A', 2, 6, due=now + 7200)
    ctl.create_wo('WO-B', 3, 3, due=now + 3600)                    # earliest due date
    ctl.create_wo('WO-C', 1, 3, due=now + 10800)
    t0 = time.time()
    ok = wait_wos(ctl, ['WO-A', 'WO-B', 'WO-C'], 400)
    wall = time.time() - t0
    ws = {w['id']: w for w in ctl.db.q('SELECT * FROM wo')}
    check('three work orders finished automatically (12 crankcases)', ok,
          ', '.join(f"{i}: {w['done']} good / {w['scrap']} scrap" for i, w in ws.items()))
    sim_h = wall * SPEED / 3600
    good = sum(w['done'] for w in ws.values())
    check('throughput plausible with 2 HMCs (load station + shuttle limit ≈ 15 / h, 2 HMCs ≤ 20 / h)', 6 <= good / sim_h <= 21,
          f'{good} good in {sim_h:.2f} simulated h = {good / sim_h:.1f} / h ({wall:.1f} s wall)')
    jobs = ctl.db.q('SELECT * FROM job')
    first_load = [j for j in sorted(jobs, key=lambda j: j['id']) if j['code'] == 12][0]
    check('EDD rule: first loading is for WO-B (earliest due date)', json.loads(first_load['params']).get('wo') == 'WO-B', first_load['info'])
    ev = ctl.db.q('SELECT * FROM event')
    check('HMC-03 detected OFFLINE and given no job', any(e['device'] == 'HMC-03' and 'OFFLINE' in e['text'] for e in ev)
          and not [j for j in jobs if j['device'] == 'HMC-03'], 'alarm logged')
    used = {j['device'] for j in jobs if j['code'] == 10}
    check('production ran on the two available machines', used == {'HMC-01', 'HMC-02'}, f'machines used: {sorted(used)}')
    check('no loop errors', not [e for e in ev if e['level'] == 'error'], '')
    rej = [j for j in jobs if j['status'] == 'rejected']
    check('commands rejected by the plant (logic errors)', len(rej) == 0, f'{len(rej)} rejected of {len(jobs)} jobs')
    time.sleep(1.0)
    snap = ctl.snapshot()
    loc = [p.get('location') for p in snap['pallets']]
    check('all 12 pallets located by the pallet system', sum(1 for x in loc if x) == 12, f'locations {sorted(x for x in loc if x)}')
    contents = {p['content'] for p in snap['pallets']}
    check('no pallet left with an unfinished part', contents <= {'empty'}, f'contents {contents}')
    bad_fix = [j for j in jobs if j['code'] == 12 and json.loads(j['params'])['task.type'] in (1, 3)
               and {1: 'A', 2: 'A', 3: 'B'}[json.loads(j['params'])['task.variant']] != ('A' if json.loads(j['params'])['task.palletId'] <= 8 else 'B')]
    check('fixture rule respected (VC30 only on fixture B)', not bad_fix, f'{len(bad_fix)} violations')

    # HTTP API
    srv = ThreadingHTTPServer(('127.0.0.1', HTTP), make_handler(ctl))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    snap = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{HTTP}/api/cell', timeout=5).read())
    req = urllib.request.Request(f'http://127.0.0.1:{HTTP}/api/wo', data=json.dumps({'id': 'WO-D', 'variant': 2, 'qty': 2, 'due_h': 1}).encode(),
                                 headers={'Content-Type': 'application/json'})
    r = json.loads(urllib.request.urlopen(req, timeout=5).read())
    html = urllib.request.urlopen(f'http://127.0.0.1:{HTTP}/', timeout=5).read()
    check('HTTP API: snapshot, new work order, operator screen', snap['mode'] == 'auto' and r.get('ok') and b'FMS cell controller' in html,
          f"{len(snap['devices'])} devices, {len(snap['pallets'])} pallets in snapshot")

    # restart on the same database
    ctl.stop()
    srv.shutdown()
    ctl2 = CellController(table, db, rule='EDD', loop=0.02, speed=SPEED)
    check('restart: safe start in MANUAL mode, work orders recovered from the database',
          ctl2.mode == 'manual' and len(ctl2.db.q('SELECT * FROM wo')) == 4)
    ctl2.start()
    time.sleep(0.5)
    ctl2.set_mode('auto')                                           # operator checked the cell
    devs['PPS-1'].lose_done = True                                  # next shuttle job: PLC 'restart' loses its job result
    t_end, unknown = time.time() + 60, []
    while time.time() < t_end and not unknown:
        unknown = ctl2.db.q("SELECT * FROM job WHERE status = 'unknown'")
        time.sleep(0.2)
    alarm = [e['text'] for e in ctl2.db.q("SELECT text FROM event WHERE level = 'alarm'") if 'not finished after' in e['text']]
    if unknown:
        ctl2.resolve_job(unknown[0]['id'], 'done')                  # operator: the shuttle did move the pallet
    ok = wait_wos(ctl2, ['WO-D'], 200)
    w = ctl2.db.q("SELECT * FROM wo WHERE id = 'WO-D'")[0]
    check('lost job result (PLC restart): job set to unknown + alarm, operator resolves it, production continues',
          bool(unknown) and bool(alarm) and ok, (alarm[0][:95] if alarm else 'no alarm'))
    check('restart: WO-D (created before the restart) completed by the new controller instance', ok, f"{w['done']} good")
    try:
        ctl2.create_wo('WO-X', 4, 2)
        check('input check: work order with variant 4 is refused', False)
    except ValueError as e:
        check('input check: work order with variant 4 is refused', not ctl2.db.q("SELECT id FROM wo WHERE id = 'WO-X'"), str(e))
    ctl2.stop()
    n = sum(R)
    print(f'\n{n} / {len(R)} checks passed')
    return 0 if n == len(R) else 1


if __name__ == '__main__':
    sys.exit(main())
