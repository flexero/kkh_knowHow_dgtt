"""Item 3 acceptance test: tool management (A/B comparison on the virtual plant, speed x50).

    python -m fmsctl.tests.test_item3
Only HMC-01 is online. Its M8 tap group (T10, pockets 11 + 12) is almost worn: pocket 11 = 0 %, pocket 12 = 3 %.
A  without tool check: the controller sends jobs until the tap group expires -> job aborted (alarm 201, NOK part)
B  with tool check:    the job is blocked before it starts, a change request is raised, the setter mounts a tool measured
                       on the presetter (command 14 writes life + offsets into the CNC), production continues, no abort
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

SPEED = 50.0
R = []


def check(name, ok, detail=''):
    R.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} | {name}" + (f' | {detail}' if detail else ''))


def setup(port):
    devs = virtual_plant.start(speed=SPEED, seed=21, base_port=port)
    for m in ('HMC-02', 'HMC-03'):
        devs[m].server.stop()
    devs['HMC-01'].set('cnc.toolLife11', 0)
    devs['HMC-01'].set('cnc.toolLife12', 30)
    return devs, plant.device_table(virtual=True, base_port=port)


def run(ctl, wo, qty, timeout, setter=None):
    ctl.set_mode('auto')
    ctl.create_wo(wo, 2, qty, due=time.time() + 3600)
    t_end = time.time() + timeout
    while time.time() < t_end:
        if setter:
            setter()
        w = ctl.db.q('SELECT * FROM wo WHERE id = ?', (wo,))[0]
        if w['finished']:
            break
        time.sleep(0.2)
    return ctl.db.q('SELECT * FROM wo WHERE id = ?', (wo,))[0]


def main():
    # ---------------- A: without tool check
    devs, table = setup(15900)
    ctlA = CellController(table, os.path.join(tempfile.mkdtemp(), 'a.db'), loop=0.03, tool_check=False)
    ctlA.start(); time.sleep(0.5)
    wA = run(ctlA, 'WO-A', 4, 60)
    abortedA = [j for j in ctlA.db.q("SELECT * FROM job WHERE code = 10 AND status = 'done'") if j['result'] == 2]
    downA = ctlA.live['HMC-01'].get('state') == 4
    check('A (no tool check): worn tap group causes an aborted job', len(abortedA) >= 1,
          f"{len(abortedA)} aborted, HMC-01 {'DOWN alarm ' + str(ctlA.live['HMC-01'].get('alarm')) if downA else 'not down'}, WO-A {wA['done']} good / {wA['scrap']} scrap")
    ctlA.stop()

    # ---------------- B: with tool check
    devs, table = setup(15950)
    ctl = CellController(table, os.path.join(tempfile.mkdtemp(), 'b.db'), loop=0.03, tool_check=True)
    ctl.start(); time.sleep(0.5)
    n = ctl.tools.import_presetter('serial;type;length;radius\nT10-0101;T10;142.315;4.000\nT10-0102;T10;141.982;4.000\nT09-0201;T09;155.040;3.400\n')
    check('presetter CSV import', n == 3, f'{n} tools measured into store')
    mounted = []

    def setter():                                      # the tool setter reacts to every open request
        for r in ctl.tools.requests():
            store = ctl.db.q("SELECT * FROM tool_item WHERE status = 'store' AND type = ?", (r['type'],))
            if store and not ctl.live['HMC-01'].get('busy'):
                try:
                    ctl.tools.complete(r['id'], store[0]['serial'])
                    mounted.append((r['pocket'], store[0]['serial']))
                except Exception:
                    pass
    w = run(ctl, 'WO-B', 4, 120, setter)
    jobs = ctl.db.q('SELECT * FROM job')
    abortedB = [j for j in jobs if j['code'] == 10 and j['result'] == 2]
    blocks = [e for e in ctl.db.q('SELECT * FROM event') if 'tool check blocks' in e['text']]
    check('B: tool check blocked the job before the tap group expired', len(blocks) >= 1, blocks[0]['text'][:110] if blocks else '')
    check('B: change request raised and completed by the setter', len(mounted) >= 1 and not ctl.tools.requests(),
          f'mounted {mounted}')
    tool_jobs = [j for j in jobs if j['code'] == 14]
    hmc = devs['HMC-01']
    check('B: command 14 wrote life 100 % and presetter offsets into the CNC', tool_jobs and hmc.get('tool.lastPocket') in (11, 12)
          and abs(hmc.get('tool.lastLength_mm') - 142.315) < 1e-3, f"pocket {hmc.get('tool.lastPocket')}: L {hmc.get('tool.lastLength_mm'):.3f} R {hmc.get('tool.lastRadius_mm'):.3f}, life {hmc.get('cnc.toolLife%02d' % hmc.get('tool.lastPocket')) / 10:.1f} %")
    check('B: work order finished with no aborted job', w['finished'] is not None and not abortedB, f"{w['done']} good / {w['scrap']} scrap, aborted {len(abortedB)}")
    # checks added after the textbook review (guide 55 ch. 28)
    item = ctl.db.q("SELECT * FROM tool_item WHERE serial = 'T10-0101'")[0]
    mag = ctl.db.q("SELECT serial FROM magazine WHERE machine = 'HMC-01' AND pocket = 11")[0]['serial']
    ev = [e['text'] for e in ctl.db.q('SELECT text FROM event') if 'confirmed by the CNC echo' in e['text']]
    check('tool booked into the magazine only after the CNC echo (registers 340-345) matched', item['status'] == 'machine'
          and mag == 'T10-0101' and ev, ev[0][:100] if ev else 'no echo confirmation')
    n_re = ctl.tools.import_presetter('serial;type;length;radius\nT10-0101;T10;150.000;4.000\n')
    item2 = ctl.db.q("SELECT * FROM tool_item WHERE serial = 'T10-0101'")[0]
    check('presetter re-import of a tool that is in a machine is refused', n_re == 0 and item2['status'] == 'machine'
          and abs(item2['length'] - 142.315) < 1e-6, f"status {item2['status']}, L {item2['length']}")
    sis = {r['pocket']: r['uses'] for r in ctl.db.q("SELECT pocket, uses FROM tool_item WHERE machine = 'HMC-01' AND type = 'T10'")}
    check('uses booked only to the sister tool that worked (no double counting)', sis.get(11, 0) > 0 and sis.get(12, 0) == 0,
          f'uses per pocket {sis} (pocket 12 has no tracked serial or did not work)')
    snap = ctl.tools.snapshot()
    check('tool snapshot: 3 magazines × 18 pockets, store, forecast', all(len(v) == 18 for v in snap['magazines'].values()) and 'forecast' in snap,
          f"store {len(snap['store'])} tools, forecast {len(snap['forecast'])} warnings")
    srv = ThreadingHTTPServer(('127.0.0.1', 18093), make_handler(ctl))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    api = json.loads(urllib.request.urlopen('http://127.0.0.1:18093/api/tools', timeout=5).read())
    page = urllib.request.urlopen('http://127.0.0.1:18093/tools', timeout=5).read()
    check('HTTP: /api/tools and the setter screen', 'magazines' in api and b'Tool management' in page)
    srv.shutdown(); ctl.stop()
    k = sum(R)
    print(f'\n{k} / {len(R)} checks passed')
    return 0 if k == len(R) else 1


if __name__ == '__main__':
    sys.exit(main())
