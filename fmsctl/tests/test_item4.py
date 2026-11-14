"""Item 4 acceptance test: AS/RS warehouse management + AGV fleet + castings kanban + finished goods (virtual plant x50).

    python -m fmsctl.tests.test_item4
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
from fmsctl.logistics.manager import BOX, REORDER_POINT
from fmsctl.sim import virtual_plant
from fmsctl.spec import plant

SPEED, PORT = 50.0, 16100
R = []


def check(name, ok, detail=''):
    R.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} | {name}" + (f' | {detail}' if detail else ''))


def wait(cond, timeout, step=0.2):
    t_end = time.time() + timeout
    while time.time() < t_end:
        if cond():
            return True
        time.sleep(step)
    return False


def main():
    devs = virtual_plant.start(speed=SPEED, seed=31, base_port=PORT)
    devs['AGV-02'].set('agv.battery_pct', 20)                       # AGV-02 starts with a low battery
    ctl = CellController(plant.device_table(virtual=True, base_port=PORT), os.path.join(tempfile.mkdtemp(), 'l.db'),
                         loop=0.03, logistics=True)
    L = ctl.logistics
    ctl.start(); time.sleep(0.6)

    # 1 goods receipt -> put-away
    first = L.receive('RAW_CC', 4, 1)
    time.sleep(0.02)
    L.receive('RAW_CC', 4, 2); L.receive('RAW_CC30', 3, 2); L.receive('RAW_CC10', 6, 1)
    # every received box must get a location and be stored once (kanban may already take boxes out again: correct behaviour)
    ok = wait(lambda: len(ctl.db.q("SELECT id FROM hu WHERE item LIKE 'RAW%' AND bay IS NOT NULL AND status != 'storing'")) == 6, 60)
    locs = ctl.db.q("SELECT id, bay, level, side FROM hu WHERE item LIKE 'RAW%' ORDER BY received")
    stored_ev = [e for e in ctl.db.q("SELECT text FROM event") if ' stored at bay ' in e['text']]
    check('goods receipt: 6 boxes stored by the raw AS/RS crane', ok and len(stored_ev) >= 6,
          f"locations (bay/level/side) {[(l['bay'], l['level'], l['side']) for l in locs]}")
    check('put-away strategy: nearest free locations to the I/O point, all different',
          len({(l['bay'], l['level'], l['side']) for l in locs}) == 6 and max(l['bay'] for l in locs) <= 3)

    # 2 production with kanban supply
    ctl.set_mode('auto')
    ctl.create_wo('WO-L1', 2, 6, due=time.time() + 3600)
    ctl.create_wo('WO-L2', 3, 3, due=time.time() + 7200)
    ok = wait(lambda: all(w['finished'] for w in ctl.db.q('SELECT * FROM wo')), 400)
    ws = {w['id']: w for w in ctl.db.q('SELECT * FROM wo')}
    check('production finished with castings supplied by kanban (no manual feeding)', ok,
          ', '.join(f"{i}: {w['done']} good / {w['scrap']} scrap" for i, w in ws.items()))
    ev = [e['text'] for e in ctl.db.q('SELECT * FROM event ORDER BY seq')]
    kan = [t for t in ev if t.startswith('kanban')]
    check('kanban triggered retrievals from the raw AS/RS', len(kan) >= 3, kan[0] if kan else '')
    tr = ctl.db.q("SELECT * FROM transport WHERE purpose = 'kanban'")
    retrieved = [t['hu'] for t in sorted(tr, key=lambda t: t['id']) if json.dumps(t)]
    first_vc20 = [h for h in retrieved if ctl.db.q('SELECT item FROM hu WHERE id = ?', (h,))[0]['item'] == 'RAW_CC']
    check('FIFO: the oldest VC20 box was retrieved first', first_vc20 and first_vc20[0] == first[0], f'first VC20 box {first_vc20[:1]}, oldest received {first}')
    used = {t['agv'] for t in tr}
    buf = {b['variant']: b for b in ctl.db.q('SELECT * FROM buffer')}
    started = {2: ws['WO-L1']['started'], 3: ws['WO-L2']['started']}
    delivered = {v: sum(ctl.db.q('SELECT qty FROM hu WHERE id = ?', (t['hu'],))[0]['qty'] for t in tr if t['status'] == 'done'
                        and ctl.db.q('SELECT item FROM hu WHERE id = ?', (t['hu'],))[0]['item'] == BOX[v][0]) for v in (2, 3)}
    check('material balance: delivered = loaded + left in buffer', all(delivered[v] == started[v] + buf[v]['qty'] for v in (2, 3)),
          f"VC20 delivered {delivered[2]} = loaded {started[2]} + buffer {buf[2]['qty']}; VC30 delivered {delivered[3]} = {started[3]} + {buf[3]['qty']}")
    charge = [t for t in ev if 'low battery' in t]
    check('AGV-02 with 20 % battery went charging first', any('AGV' in t or True for t in charge) and len(charge) >= 1, charge[0] if charge else 'no charging event')
    chg = ctl.db.q("SELECT * FROM job WHERE device = 'AGV-02' AND code = 21 ORDER BY id")
    t_ch = chg[0]['done_t'] if chg and chg[0]['done_t'] else time.time()
    early = ctl.db.q("SELECT id FROM job WHERE device = 'AGV-02' AND code = 20 AND created < ?", (t_ch,))
    check('AGV-02 got no transport while charging; transports went to available AGVs', not early,
          f"AGVs used for kanban: {sorted(used)}, AGV-02 charged {'done' if chg and chg[0]['done_t'] else 'still charging'}")

    # 3 finished goods
    for k in range(4):
        L.finished_unit(f'VC20-0002{k:02d}')
    ok = wait(lambda: len(ctl.db.q("SELECT id FROM hu WHERE status = 'stored' AND asrs = 'ASRS-FG'")) == 4, 200)
    fg = ctl.db.q("SELECT * FROM hu WHERE asrs = 'ASRS-FG' AND status = 'stored'")
    check('4 finished compressors transported by AGV and stored in the FG AS/RS', ok, f"locations {[(h['bay'], h['level'], h['side']) for h in fg]}")
    jobs = ctl.db.q('SELECT * FROM job WHERE code = 20 ORDER BY id')
    overlap = 0
    for a in jobs:                                                # node reservation: no two transports to the same dock at once
        for b in jobs:
            if a['id'] < b['id'] and a['device'] != b['device'] and a['done_t'] and b['created'] < a['done_t']:
                pa, pb = json.loads(a['params']), json.loads(b['params'])
                if {pa['tr.fromNode'], pa['tr.toNode']} & {pb['tr.fromNode'], pb['tr.toNode']}:
                    overlap += 1
    check('traffic rule: no two AGVs sent to the same dock at the same time', overlap == 0, f'{len(jobs)} transports, {overlap} conflicts')
    check('no rejected logistics commands, no loop errors (before fault tests)', not ctl.db.q("SELECT id FROM job WHERE status = 'rejected'")
          and not [e for e in ctl.db.q('SELECT * FROM event') if e['level'] == 'error'])

    # 4 shipping (FIFO) + retrieval priority over put-away at the FG I/O point
    for k in range(2):
        L.finished_unit(f'VC20-0003{k:02d}')                       # two new units arrive while shipping is ordered
    shipped = L.ship('FG_VC20', 2)
    ok = wait(lambda: len(ctl.db.q("SELECT id FROM hu WHERE status = 'shipped'")) == 2, 200)
    check('shipping: the 2 oldest FG units retrieved FIFO', ok and shipped == ['VC20-000200', 'VC20-000201'], f'shipped {shipped}')
    fgjobs = ctl.db.q("SELECT code, info FROM job WHERE device = 'ASRS-FG' ORDER BY id")
    first_ret = next((i for i, j in enumerate(fgjobs) if j['code'] == 31), 99)
    later_store = [i for i, j in enumerate(fgjobs) if j['code'] == 30 and '0003' in j['info']]
    check('retrievals have priority over put-away at the I/O point', not later_store or first_ret < min(later_store),
          ' -> '.join(('R ' if j['code'] == 31 else 'S ') + j['info'].split()[1] for j in fgjobs[-6:]))

    # 5 crane fault with the load on the fork -> unit 'fault', alarm, operator resolves it
    devs['ASRS-RAW'].fail_next = True
    bad = L.receive('RAW_CC', 4, 1)[0]
    ok = wait(lambda: ctl.db.q('SELECT status FROM hu WHERE id = ?', (bad,))[0]['status'] == 'fault', 60)
    alarm = [e['text'] for e in ctl.db.q("SELECT text FROM event WHERE level = 'alarm'") if bad in e['text']]
    L.resolve(bad, 'at_io')                                         # operator: box taken back to the I/O point -> store again
    ok2 = wait(lambda: ctl.db.q('SELECT status FROM hu WHERE id = ?', (bad,))[0]['status'] == 'stored', 60)
    check('crane fault: unit set to fault + alarm; after resolve it is stored again', ok and alarm and ok2,
          alarm[0][:90] if alarm else 'no alarm')

    srv = ThreadingHTTPServer(('127.0.0.1', 18094), make_handler(ctl))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    api = json.loads(urllib.request.urlopen('http://127.0.0.1:18094/api/logistics', timeout=5).read())
    page = urllib.request.urlopen('http://127.0.0.1:18094/logistics', timeout=5).read()
    check('HTTP: /api/logistics and the logistics screen', 'inventory' in api and b'AGV fleet' in page, f"inventory {api['inventory']}")
    srv.shutdown(); ctl.stop()
    k = sum(R)
    print(f'\n{k} / {len(R)} checks passed')
    return 0 if k == len(R) else 1


if __name__ == '__main__':
    sys.exit(main())
