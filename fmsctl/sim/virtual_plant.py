"""Virtual plant – one simulated PLC per device of the compressor FMS, speaking register map V1.2 over Modbus TCP.

Used for virtual commissioning: the FMS control system (items 2–9) is developed and tested against this plant, then
switched to the real IP addresses without changing its code. Behaviour per device type:
  CNC      job (cmd 10): checks pallet / fixture plausibility, runs cycle time × qty, random failures (MTBF / MTTR),
           tool wear, scrap; DONE with result
  PALLET   move (cmd 11): shuttle travel, slot table, rejects impossible moves
  LOAD     operator task (cmd 12): simulated operator time; sets pallet state raw / empty
  STATION  job (cmd 10): cycle time × qty
  TEST     test (cmd 13): ISO 1217 style result values around the variant's specification, pass / fail
  AGV      transport (cmd 20) / charge (cmd 21): travel time from node coordinates, battery
  ASRS     store / retrieve / relocate / park (cmd 30 / 31 / 32 / 33, map V1.2b): crane cycle
           (detailed mirror of the crane PLC: thesis_final/design/03_asrs/asrs_sim.py)
Time runs `speed` times faster than real time (default 20). Values are EXAMPLES from the design (config/factory.json).
Usage: python -m fmsctl.sim.virtual_plant [--speed 20]      (Ctrl+C to stop)
"""
from __future__ import annotations

import argparse
import math
import random
import threading
import time

from fmsctl.core.modbus import ModbusServer
from fmsctl.spec import plant, regmap as R, tooling as TL

SPEC_FAD = {1: 10.0, 2: 20.0, 3: 30.0}         # m³/h nominal per variant
SPEC_KW = {1: 2.2, 2: 4.0, 3: 5.5}


WATCHDOG_S = 5.0                                         # gateway watchdog time (real seconds)


class Device:
    def __init__(self, info, params, speed, shared, rng):
        self.info, self.type, self.speed, self.shared, self.rng = info, info['type'], speed, shared, rng
        self.p = params or {'cycle': {1: 60.0, 2: 60.0, 3: 60.0}, 'mtbf_h': 200, 'mttr_min': 10, 'scrap': 0.0}
        self.idx = R.index(self.type)
        self.img = [0] * R.MAP_SIZE
        self.lock = threading.RLock()
        self.state, self.ack, self.done_toggle, self.busy = 1, 0, 0, False
        self.counter, self.ring = 0, [(0, 0)] * 8
        self.latched = None                             # job parameters 400-449 copied when a job is accepted
        self.gw_t, self.gw_val, self.wd = 0.0, None, False   # gateway watchdog (register 226, 5 s, armed by the first write)
        self.t0 = time.perf_counter()
        self.set('hdr.mapVersion', R.MAP_VERSION); self.set('hdr.typeCode', R.TYPE_CODES[self.type]); self.set('hdr.unitId', info['unit'])
        self.set('std.mode', 1); self.set_state(1)
        if self.type == 'CNC':
            self.true_life = {}                         # actual life of the tool in each pocket (spread around nominal)
            for i in range(30):
                self.set(f'cnc.toolLife{i + 1:02d}', rng.randint(400, 1000) if (i + 1) in TL.MAGAZINE else 0)
                self.true_life[i + 1] = rng.lognormvariate(0, 0.12)
        if self.type == 'AGV':
            self.set('agv.battery_pct', 90); self.set('agv.node', 9)
        self.handshake(ready=True)
        self.server = ModbusServer(info['host'], info['port'], self.img, self.lock, R.writable, self.on_write)
        threading.Thread(target=self.heartbeat, daemon=True).start()

    # ---------------------------------------------------------- register helpers
    def set(self, name, v):
        a, t = self.idx[name]
        with self.lock:
            self.img[a:a + R.NREG[t]] = R.enc(t, v)

    def get(self, name):
        a, t = self.idx[name]
        with self.lock:
            if self.busy and self.latched and 400 <= a < 450:   # a running job uses the parameters it was started with
                return R.dec(t, self.latched[a - 400:a - 400 + R.NREG[t]])
            return R.dec(t, self.img[a:a + R.NREG[t]])

    def ms(self):
        return int((time.perf_counter() - self.t0) * 1000 * self.speed) & 0xFFFFFFFF

    def set_state(self, s):
        """State change -> status word + event block (counter, time stamp, ring)."""
        with self.lock:
            if s == self.state and self.counter:
                return
            self.state = s
            self.counter += 1
            t = self.ms()
            self.ring = [(s, t)] + self.ring[:7]
            self.set('std.stateCode', s)
            self.set('std.status', {1: 2, 2: 1, 3: 4, 4: 8, 5: 32, 6: 64}.get(s, 0))
            self.set('evt.counter', self.counter); self.set('evt.tLast_ms', t)
            for k, (st, tt) in enumerate(self.ring):
                a = 108 + 3 * k
                self.img[a] = st
                self.img[a + 1:a + 3] = R.enc('UINT32', tt)

    def handshake(self, ready=None, reject=False):
        with self.lock:
            st = (self.ack & 1) | (2 if self.busy else 0) | ((self.done_toggle & 1) << 2) | (8 if reject else 0)
            rdy = (not self.busy and self.state not in (4,) and not self.wd) if ready is None else ready
            st |= 16 if rdy else 0
            self.set('hs.status', st)

    def heartbeat(self):
        hb = 0
        while True:
            time.sleep(1.0)
            hb = (hb + 1) & 0xFFFF
            self.set('hdr.heartbeat', hb)
            if self.gw_t and not self.wd and time.perf_counter() - self.gw_t > WATCHDOG_S:
                self.wd = True                          # gateway heartbeat frozen: no new jobs (running job continues)
                self.handshake()
            if self.type == 'AGV' and self.get('agv.state') == 0:
                self.set('agv.battery_pct', max(0, self.get('agv.battery_pct') - (1 if self.rng.random() < 0.05 else 0)))

    def sleep(self, seconds_real_world):
        time.sleep(max(0.0, seconds_real_world / self.speed))

    # ---------------------------------------------------------- command handling (toggle-bit handshake)
    def on_write(self, addr, vals):
        if addr <= 226 < addr + len(vals):              # gateway heartbeat: must change at least every WATCHDOG_S
            v = vals[226 - addr]
            if v != self.gw_val:
                self.gw_val, self.gw_t = v, time.perf_counter()
                if self.wd:
                    self.wd = False
                    self.handshake()
        if not (addr <= 202 < addr + len(vals)):
            return
        req = self.get('cmd.ctl') & 1
        if req == (self.ack & 1):
            return                                      # no new request
        code, seq = self.get('cmd.code'), self.get('cmd.seq')
        if seq == self.get('hs.ackSeq') and self.counter:     # sequence guard (map V1.2a): stale REQ toggle, e.g. a late
            return                                         # frame of an old TCP connection -> ignore, REQ <> ACK stays
        result = 0
        allowed = {'CNC': (10, 14, 4), 'STATION': (10, 4), 'PALLET': (11, 4), 'LOAD': (12, 4), 'TEST': (13, 4),
                   'AGV': (20, 21, 4), 'ASRS': (30, 31, 32, 33, 4)}[self.type]
        if code not in allowed:
            result = 1
        elif code == 4:
            if self.state == 4:
                self.set('std.alarm', 0); self.set_state(1)
        elif self.busy:
            result = 4
        elif self.state == 4 or self.get('std.mode') != 1 or self.wd:
            result = 2
        else:
            result = self.validate(code)
        with self.lock:
            self.ack = req
            self.set('hs.ackSeq', seq); self.set('hs.result', result)
            if result == 0 and code != 4:
                self.latched = list(self.img[400:450])
                self.busy = True
        self.handshake(reject=result != 0)
        if result == 0 and code != 4:
            threading.Thread(target=self.run_job, args=(code,), daemon=True).start()

    def validate(self, code):
        sh = self.shared
        if self.type == 'CNC' and self.info['id'].startswith('HMC') and code == 10:
            pal = self.get('job.palletId')
            k = int(self.info['id'][-1])
            with sh['lock']:
                if sh['slots'].get(13 + k) != pal or pal == 0:
                    return 3                            # pallet not at this machine's pallet changer
        if self.type == 'CNC' and code == 14:
            return 0 if 1 <= self.get('tool.pocket') <= 30 else 3
        if self.type == 'CNC' and self.get('job.programNo') == 0:
            return 3
        if self.type == 'PALLET':
            pal, src, dst = self.get('move.palletId'), self.get('move.src'), self.get('move.dst')
            with sh['lock']:
                if not (1 <= src <= 16 and 1 <= dst <= 16) or sh['slots'].get(src) != pal or sh['slots'].get(dst, 0) != 0:
                    return 3
        if self.type == 'LOAD':
            with sh['lock']:
                if sh['slots'].get(13) != self.get('task.palletId') or self.get('task.palletId') == 0:
                    return 3
        if self.type == 'AGV' and (self.get('tr.toNode') not in plant.NODES or (self.get('cmd.code') == 20 and self.get('tr.fromNode') not in plant.NODES)):
            return 3
        return 0

    # ---------------------------------------------------------- job execution per device type
    def run_job(self, code):
        t_start = time.perf_counter()
        jid = self.get('job.id')
        res = 0
        try:
            res = getattr(self, 'job_' + self.type.lower())(code)
        except Exception:                               # never leave the device hanging
            res = 2
        with self.lock:
            if getattr(self, 'lose_done', False):       # test hook: PLC restarted and lost the job result
                self.lose_done = False
                jid, res = self.get('job.idDone'), self.get('job.result')
            self.set('job.idDone', jid); self.set('job.result', res)
            self.set('job.cycle_s', (time.perf_counter() - t_start) * self.speed)
            self.busy = False
            self.done_toggle ^= 1
        if self.state != 4:
            self.set_state(1)
        self.handshake()

    def maybe_fail(self, run_s):
        """Operation-dependent failure during run_s seconds of processing."""
        lam = 1.0 / (self.p['mtbf_h'] * 3600.0)
        if self.rng.random() < 1 - math.exp(-lam * run_s):
            self.set('std.alarm', 100 + self.rng.randint(1, 20)); self.set_state(4)
            self.sleep(self.rng.expovariate(1.0 / (self.p['mttr_min'] * 60.0)))
            self.set('std.alarm', 0)
            return True
        return False

    def process(self, seconds, qty):
        self.set('std.order', f'JOB{self.get("job.id")}')
        done = 0
        for _ in range(max(1, qty)):
            self.set_state(2)
            t = seconds * self.rng.lognormvariate(0, 0.04)
            self.maybe_fail(t)
            self.set_state(2)
            self.sleep(t)
            scrap = self.rng.random() < self.p['scrap']
            self.set('std.good' if not scrap else 'std.scrap', self.get('std.good' if not scrap else 'std.scrap') + 1)
            self.set('std.lastCycle_s', t)
            done += 1
            self.set('hs.lotDone', done)
        return 1 if (self.p['scrap'] and scrap) else 0

    def job_cnc(self, code):
        if code == 14:                                  # tool data from the presetter: life + offsets
            p = self.get('tool.pocket')
            self.sleep(2)
            self.set(f'cnc.toolLife{p:02d}', min(1000, self.get('tool.lifeSet')))
            self.true_life[p] = self.rng.lognormvariate(0, 0.12)
            self.set('tool.lastPocket', p); self.set('tool.lastLength_mm', self.get('tool.length_mm')); self.set('tool.lastRadius_mm', self.get('tool.radius_mm'))
            return 0
        v, qty = max(1, min(3, self.get('job.variant'))), max(1, self.get('job.qty'))
        prog = self.get('job.programNo')
        self.set('cnc.programNo', prog)
        if self.info['id'].startswith('HMC'):
            self.set('cnc.palletWork', self.get('job.palletId'))
        # tool-life management: use the first pocket of the group with life left; expired group -> abort with alarm
        plan = []
        for ttype, uses in TL.PROGRAM_TOOLS.get(prog, []):
            need = TL.usage_pct(ttype, uses * qty)
            pockets = [pk for pk, t in TL.MAGAZINE.items() if t == ttype]
            left = need
            for pk in pockets:
                life = self.get(f'cnc.toolLife{pk:02d}')
                if life <= 0 or left <= 0:
                    continue
                take = min(life * self.true_life[pk], left)   # true wear spreads around the nominal
                plan.append((pk, take / self.true_life[pk]))
                left -= take
            if left > 1e-6:
                self.set_state(2); self.sleep(self.p['cycle'][v] * 0.4)
                self.set('std.alarm', 201)                     # tool life expired, no sister tool
                self.set_state(4)
                if self.info['id'].startswith('HMC'):
                    pal = self.get('job.palletId')
                    with self.shared['lock']:
                        self.shared['pstate'][pal] = 3
                    self.shared['sync']()
                    self.set('cnc.palletWork', 0)
                self.set('std.scrap', self.get('std.scrap') + 1)
                return 2
        res = self.process(self.p['cycle'][v], qty)
        for pk, dec in plan:
            self.set(f'cnc.toolLife{pk:02d}', max(0, int(round(self.get(f'cnc.toolLife{pk:02d}') - dec))))
        if self.info['id'].startswith('HMC'):
            pal = self.get('job.palletId')
            with self.shared['lock']:
                self.shared['pstate'][pal] = 3 if res else 2
            self.shared['sync']()
            self.set('cnc.palletWork', 0)
        return res

    def job_station(self, code):
        v, qty = max(1, min(3, self.get('job.variant'))), max(1, self.get('job.qty'))
        self.set('st.serialIn', self.get('job.text'))
        return self.process(self.p['cycle'][v], qty)

    def job_pallet(self, code):
        pal, src, dst = self.get('move.palletId'), self.get('move.src'), self.get('move.dst')
        self.set_state(2); self.set('pal.shuttleBusy', 1)
        self.sleep(12 + 2 * abs(src - dst))             # shuttle travel + transfer [example]
        with self.shared['lock']:
            self.shared['slots'][src] = 0
            self.shared['slots'][dst] = pal
        self.shared['sync']()
        self.set('pal.shuttlePos', dst); self.set('pal.shuttleBusy', 0)
        return 0

    def job_load(self, code):
        typ, pal = self.get('task.type'), self.get('task.palletId')
        self.set_state(2); self.set('load.palletId', pal)
        self.sleep({1: 90, 2: 60, 3: 140, 4: 600}.get(typ, 90) * self.rng.uniform(0.8, 1.3))
        self.set('load.clamped', 1); self.set('load.operatorReady', 1); self.set('load.partPresent', 1 if typ in (1, 3) else 0)
        with self.shared['lock']:
            self.shared['pstate'][pal] = 1 if typ in (1, 3) else 0
        self.shared['sync']()
        return 0

    def job_test(self, code):
        v = max(1, min(3, self.get('job.variant')))
        self.set_state(2)
        self.sleep(self.p['cycle'][v])
        fad = SPEC_FAD[v] * self.rng.gauss(1.0, 0.015)
        kw = SPEC_KW[v] * self.rng.gauss(1.0, 0.02)
        noise = self.rng.gauss(72, 1.5)
        fail = 0
        if fad < 0.95 * SPEC_FAD[v]: fail = 1
        elif kw > 1.06 * SPEC_KW[v]: fail = 2
        elif noise > 76: fail = 3
        elif self.rng.random() < 0.004: fail = 4
        self.set('test.fad_m3h', fad); self.set('test.power_kW', kw); self.set('test.pmax_bar', self.rng.gauss(10.0, 0.05))
        self.set('test.noise_dBA', noise); self.set('test.oilTemp_C', self.rng.gauss(68, 3))
        self.set('test.verdict', 2 if fail else 1); self.set('test.failCode', fail); self.set('test.serial', self.get('job.text'))
        self.set('std.good' if not fail else 'std.scrap', self.get('std.good' if not fail else 'std.scrap') + 1)
        return 1 if fail else 0

    def job_agv(self, code):
        frm, to = self.get('tr.fromNode'), self.get('tr.toNode')
        here = self.get('agv.node')
        dist = lambda a, b: math.dist(plant.NODES[a], plant.NODES[b])
        self.set('agv.targetNode', to)
        if code == 20:
            self.set('agv.state', 1); self.set_state(2); self.sleep(dist(here, frm) / 1.2)
            self.set('agv.node', frm); self.set('agv.state', 2); self.sleep(20); self.set('agv.loaded', 1)
            self.set('agv.state', 1); self.sleep(dist(frm, to) / 1.2)
            self.set('agv.node', to); self.set('agv.state', 2); self.sleep(20); self.set('agv.loaded', 0)
            self.set('agv.battery_pct', max(5, self.get('agv.battery_pct') - 2))
        else:
            self.set('agv.state', 1); self.set_state(2); self.sleep(dist(here, to) / 1.2)
            self.set('agv.node', to); self.set('agv.state', 3); self.sleep(5400 * (100 - self.get('agv.battery_pct')) / 100)
            self.set('agv.battery_pct', 100)
        self.set('agv.state', 0)
        return 0

    def job_asrs(self, code):
        self.set_state(2)
        self.set('asrs.bay', self.get('loc.bay')); self.set('asrs.level', self.get('loc.level'))
        self.set('asrs.loadOnFork', 1); self.sleep(50 * self.rng.uniform(0.9, 1.1))
        if getattr(self, 'fail_next', False):          # test hook: crane fault, load stays on the fork (result 2)
            self.fail_next = False
            return 2
        self.set('asrs.loadOnFork', 0)
        return 0


def start(speed=20.0, seed=1, base_port=15100):
    """Start all devices; returns {id: Device}."""
    rng = random.Random(seed)
    params = plant.station_params()
    shared = {'lock': threading.RLock(), 'slots': {i: 0 for i in range(1, 17)}, 'pstate': {i: 0 for i in range(1, 17)}}
    for p in range(1, 13):                               # 12 pallets with fixtures in rack locations 1-12, all empty
        shared['slots'][p] = p
    devs = {}

    def sync():
        """Copy shared pallet data into the pallet system's registers."""
        d = devs.get('PPS-1')
        if not d:
            return
        with shared['lock']:
            for i in range(1, 17):
                d.set(f'pal.slot{i:02d}', shared['slots'][i])
                d.set(f'pal.state{i:02d}', shared['pstate'][i])
    shared['sync'] = sync
    for info in plant.device_table(virtual=True, base_port=base_port):
        devs[info['id']] = Device(info, params.get(info['id']), speed, shared, random.Random(rng.random()))
    sync()
    return devs


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--speed', type=float, default=20.0)
    a = ap.parse_args()
    devs = start(a.speed)
    print(f'virtual plant: {len(devs)} devices on 127.0.0.1:15100-{15100 + len(devs) - 1}, speed x{a.speed}')
    for d in devs.values():
        print(f"  {d.info['id']:9} {d.type:8} 127.0.0.1:{d.info['port']}  (real: {d.info['ip']}:502)")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
