"""FMS cell controller of the crankcase cell (item 2): pallet pool system PPS-1, load station LOAD-CC, HMC-01..03.

Every LOOP seconds the controller
  1. polls all cell devices (FAST block, job result, type status; pallet locations from PPS-1 = source of truth);
     an OFFLINE device is polled again only every OFFLINE_RETRY_S, so it does not slow the loop,
  2. closes finished jobs (job.idDone == job id and BUSY off) and applies their effect (pallet content, WO counters)
     in ONE database transaction,
  3. watches jobs: an accepted job that is not finished within its time-out -> 'unknown' + alarm (the operator decides
     with resolve_job); a command without ACK -> 'noack' (the PLC may still run it: it is closed normally if it
     finishes, or set to 'rejected' when the device is idle and did not take it),
  4. decides new actions in automatic mode:
       HMC        pallet with a raw part at the machine's pallet changer + machine READY -> job (NC program by variant)
       shuttle    one move at a time, priority: (a) empty a finished machine (or a machine that is down / offline for
                  longer than PARK_AFTER_S), (b) feed the idle machine that has waited longest with a raw pallet,
                  (c) bring a pallet to the load station: a starving fixture first (see below), else the OLDEST
                  machined pallet, else an empty pallet for the next order,
                  (d) take a ready pallet from the load station to the rack
       load st.   operator task: unload (+ load) a machined pallet, or load an empty pallet for the next work order
     Fixture balance: if the most urgent work order needs a fixture type that has no pallet in circulation, the load
     station only unloads pallets of the other fixture and the shuttle brings an empty pallet of the needed fixture
     (prevents the 'lock-in' of the first fixture type and the starvation of VC30).
     Rack storage: nearest free rack location to the load station (shortest shuttle moves).
  5. writes the gateway heartbeat (register 226) to every device once per second.
Work orders are chosen by EDD (earliest due date) or FIFO; fixtures must match the variant (FIXTURE_FOR).
After a restart the controller always starts in MANUAL mode; the operator checks the cell and switches to automatic.
"""
from __future__ import annotations

import json
import struct
import threading
import time

from fmsctl.cell.db import DB
from fmsctl.core.device import DeviceLink, HandshakeError
from fmsctl.core.modbus import ModbusError

CELL = ['PPS-1', 'LOAD-CC', 'HMC-01', 'HMC-02', 'HMC-03']
HMC_SLOT = {'HMC-01': 14, 'HMC-02': 15, 'HMC-03': 16}
LOAD_SLOT, RACK = 13, range(1, 13)
FIXTURE_OF_PALLET = {p: ('A' if p <= 8 else 'B') for p in range(1, 13)}   # [example] 8 fixtures VC10/VC20, 4 fixtures VC30
FIXTURE_FOR = {1: 'A', 2: 'A', 3: 'B'}
NC_PROGRAM = {('HMC', 1): 1010, ('HMC', 2): 1020, ('HMC', 3): 1030}      # [example] O-numbers stored in every HMC
VARIANT_NAME = {1: 'VC10', 2: 'VC20', 3: 'VC30'}
# job time-outs in plant seconds (divided by `speed` on the virtual plant) [design – set from the real cycle times]
JOB_TIMEOUT_S = {10: 3 * 465, 11: 120, 12: 1200, 14: 60}
NOACK_GRACE_S = 3.0                     # wall-clock seconds: a late ACK is still accepted within this time
OFFLINE_RETRY_S = 5.0                   # wall-clock seconds between polls of an OFFLINE device
PARK_AFTER_S = 900                      # raw pallet at a down / offline HMC -> back to the rack after 15 min (plant s)
STALL_ALARM_S = 600                     # no job finished for 10 min while orders are open -> alarm (plant s)
OPEN = ('sent', 'noack', 'unknown')     # job states that still block their device and pallet


class CellController:
    def __init__(self, device_table, db_path, rule='EDD', loop=0.05, tool_check=True, logistics=False, speed=1.0):
        self.devices = {d['id']: d for d in device_table if d['id'] in CELL}
        self.links = {i: DeviceLink(d, timeout=0.3) for i, d in self.devices.items()}
        self.db = DB(db_path)
        self.rule, self.loop, self.speed = rule, loop, speed
        was = self.db.get('mode', 'manual')
        self.mode = 'manual'                                # safe start: never automatic after a restart
        self.db.put('mode', 'manual')
        self.live = {i: {'online': False} for i in CELL}
        self.offline_since, self.next_poll = {}, {}
        self.retry_after = {}
        self.down_since = {}
        self.last_end = {m: 0.0 for m in HMC_SLOT}
        self.last_close, self.stall_alarmed = time.time(), False
        self.lock = threading.RLock()
        self.running = False
        self.hb = 0
        if not self.db.q('SELECT id FROM pallet'):
            for p, fx in FIXTURE_OF_PALLET.items():
                self.db.x('INSERT INTO pallet (id, fixture, since) VALUES (?, ?, ?)', (p, fx, time.time()))
        self.job_id = self.db.get('job_id', int(time.time()) % 100000 * 100)
        self.tools = None
        if tool_check:
            from fmsctl.tooling.manager import ToolManager
            self.tools = ToolManager(self)
        self.logistics = None
        if logistics:
            from fmsctl.logistics.manager import Logistics
            self.logistics = Logistics(self, device_table, speed=speed)
        self.waiting_material = set()
        self.db.event('info', 'CELL', f'controller started in MANUAL mode (was {was}), rule {self.rule}'
                      + (f" – {len(self.db.q('SELECT id FROM job WHERE status IN (?,?,?)', OPEN))} open jobs will be checked" if was else ''))

    # ============================================================ public API (HTTP layer calls these)
    def set_mode(self, mode):
        if mode not in ('auto', 'manual'):
            raise ValueError("mode must be 'auto' or 'manual'")
        self.mode = mode
        self.db.put('mode', mode)
        self.db.event('info', 'CELL', f'mode -> {mode}')

    def create_wo(self, wo_id, variant, qty, due=None, release=True):
        wo_id, variant, qty = str(wo_id).strip(), int(variant), int(qty)
        if not wo_id or len(wo_id) > 32:
            raise ValueError('work order id: 1 to 32 characters')
        if variant not in VARIANT_NAME:
            raise ValueError(f'variant must be one of {sorted(VARIANT_NAME)} ({", ".join(VARIANT_NAME.values())})')
        if not 1 <= qty <= 10000:
            raise ValueError('quantity must be 1 ... 10000')
        if self.db.q('SELECT id FROM wo WHERE id = ?', (wo_id,)):
            raise ValueError(f'work order {wo_id} exists already')
        self.db.x('INSERT INTO wo (id, variant, qty, due, created, released) VALUES (?,?,?,?,?,?)',
                  (wo_id, variant, qty, due if due is not None else time.time() + 86400, time.time(), 1 if release else 0))
        self.db.event('info', 'CELL', f'work order {wo_id}: {qty} × {VARIANT_NAME[variant]}' + (' released' if release else ''))

    def release_wo(self, wo_id):
        self.db.x('UPDATE wo SET released = 1 WHERE id = ?', (wo_id,))
        self.db.event('info', 'CELL', f'work order {wo_id} released')

    def ack_alarm(self, device):
        try:
            self.links[device].command(4)
            self.db.event('info', device, 'alarm acknowledged by operator')
        except (HandshakeError, ModbusError) as e:
            self.db.event('warn', device, f'acknowledge failed: {e}')

    def resolve_job(self, job_id, outcome):
        """Operator decision for a job in state 'unknown' / 'noack' (after checking the machine):
        'done'   the job was carried out completely -> its effect is applied (pallet content, WO counters)
        'failed' the job was not carried out (or the part is scrap: set the pallet content with set_pallet)"""
        j = self.db.q('SELECT * FROM job WHERE id = ?', (int(job_id),))
        if not j or j[0]['status'] not in OPEN:
            raise ValueError(f'job {job_id} is not open')
        j = j[0]
        if outcome == 'done':
            with self.db.tx():
                self.db.x("UPDATE job SET status = 'done', done_t = ?, result = 0, info = info || ' (resolved by operator)' WHERE id = ?",
                          (time.time(), j['id']))
                self._apply(j, 0)
        elif outcome == 'failed':
            self.db.x("UPDATE job SET status = 'failed', done_t = ?, info = info || ' (resolved: failed)' WHERE id = ?", (time.time(), j['id']))
        else:
            raise ValueError("outcome must be 'done' or 'failed'")
        self.db.event('info', j['device'], f"operator resolved job {j['id']} ({j['info']}): {outcome}")

    def set_pallet(self, pallet_id, content, variant=0, wo=''):
        """Manual correction of a pallet record (manual mode only) – e.g. after a crash or a manual unload."""
        if self.mode != 'manual':
            raise ValueError('pallet corrections only in manual mode')
        if content not in ('empty', 'raw', 'machined', 'nok'):
            raise ValueError('content: empty | raw | machined | nok')
        self.db.x('UPDATE pallet SET content = ?, variant = ?, wo = ?, since = ? WHERE id = ?',
                  (content, int(variant) if content != 'empty' else 0, wo if content != 'empty' else '', time.time(), int(pallet_id)))
        self.db.event('info', 'CELL', f'operator set pallet {pallet_id}: {content} {VARIANT_NAME.get(int(variant), "")} {wo}'.rstrip())

    def snapshot(self):
        with self.lock:
            live = json.loads(json.dumps(self.live))
        pallets = {p['id']: p for p in self.db.q('SELECT * FROM pallet')}
        slots = live.get('PPS-1', {}).get('slots', {})
        for s, pid in slots.items():
            if pid and int(pid) in pallets:
                pallets[int(pid)]['location'] = int(s)
        return {'mode': self.mode, 'rule': self.rule, 'devices': live, 'pallets': list(pallets.values()),
                'wos': self.db.q('SELECT * FROM wo ORDER BY created'),
                'jobs': self.db.q("SELECT * FROM job ORDER BY id DESC LIMIT 25"),
                'open_problems': self.db.q("SELECT * FROM job WHERE status IN ('unknown', 'noack') ORDER BY id"),
                'events': self.db.events(limit=40)}

    # ============================================================ main loop
    def start(self):
        self.running = True
        threading.Thread(target=self._run, daemon=True).start()
        threading.Thread(target=self._heartbeat, daemon=True).start()
        if self.logistics:
            self.logistics.start()

    def stop(self):
        self.running = False
        if self.logistics:
            self.logistics.stop()
        time.sleep(self.loop * 3)

    def _heartbeat(self):
        while self.running:
            self.hb = (self.hb + 1) & 0xFFFF
            for i, l in self.links.items():
                if self.live[i].get('online'):
                    try:
                        l.cli.write1(226, self.hb)
                    except ModbusError:
                        pass
            time.sleep(1.0)

    def _run(self):
        while self.running:
            t0 = time.time()
            try:
                self.poll()
                self.close_jobs()
                self.watch_jobs()
                if self.mode == 'auto':
                    self.dispatch()
            except Exception as e:                         # the loop must never die
                self.db.event('error', 'CELL', f'loop error: {type(e).__name__}: {e}')
            time.sleep(max(0.0, self.loop - (time.time() - t0)))

    # ============================================================ 1 polling
    def poll(self):
        for i, l in self.links.items():
            if not self.live[i].get('online') and time.time() < self.next_poll.get(i, 0):
                continue                                   # OFFLINE device: retry only every OFFLINE_RETRY_S
            try:
                fast = l.read_block(0, 12)
                res = l.read_block(390, 6)
                d = {'online': True, 'state': fast[6], 'alarm': fast[7], 'hs': fast[8], 'mode': fast[5],
                     'busy': bool(fast[8] & 2), 'ready': bool(fast[8] & 16), 'lotDone': fast[11],
                     'idDone': (res[0] << 16) | res[1], 'result': res[2],
                     'cycle_s': struct.unpack('>f', struct.pack('>HH', res[4], res[5]))[0]}
                if i == 'PPS-1':
                    blk = l.read_block(300, 46)
                    d['slots'] = {s + 1: blk[s] for s in range(16)}
                    d['shuttleBusy'] = blk[21]
                    d['pstate'] = {p + 1: blk[30 + p] for p in range(16)}
                elif i.startswith('HMC'):
                    blk = l.read_block(300, 46)
                    d['program'], d['palletWork'] = blk[0], blk[1]
                    d['toolLife'] = blk[10:40]
                    d['toolEcho'] = (blk[40], struct.unpack('>f', struct.pack('>HH', blk[42], blk[43]))[0],
                                     struct.unpack('>f', struct.pack('>HH', blk[44], blk[45]))[0])
                    used = [blk[10 + pk - 1] for pk in range(1, 31) if blk[10 + pk - 1] > 0]
                    d['toolLifeMin'] = min(used) / 10.0 if used else None
                was = self.live[i]
                if not was.get('online') and i in self.offline_since:
                    self.db.event('info', i, 'back online')
                    self.offline_since.pop(i, None)
                if was.get('online') and was.get('state') != 4 and d['state'] == 4:
                    self.db.event('alarm', i, f'machine DOWN, alarm {d["alarm"]}')
                if was.get('state') == 4 and d['state'] != 4 and was.get('online'):
                    self.db.event('info', i, 'machine back from DOWN')
                if d['state'] == 4:
                    self.down_since.setdefault(i, time.time())
                else:
                    self.down_since.pop(i, None)
                with self.lock:
                    self.live[i] = d
            except ModbusError as e:
                if self.live[i].get('online') or i not in self.offline_since:
                    self.offline_since[i] = time.time()
                    self.db.event('alarm', i, f'OFFLINE – {e}')
                self.next_poll[i] = time.time() + OFFLINE_RETRY_S
                with self.lock:
                    self.live[i] = {'online': False}

    # ============================================================ 2 job completion
    def close_jobs(self):
        for j in self.db.q("SELECT * FROM job WHERE status IN (?,?,?) AND device IN (?,?,?,?,?)", OPEN + tuple(CELL)):
            d = self.live.get(j['device'], {})
            if not d.get('online') or d.get('idDone') != j['id'] or d.get('busy'):
                continue
            res = d['result']
            with self.db.tx():                                    # all effects of one job, or none
                self.db.x("UPDATE job SET status = 'done', done_t = ?, result = ?, cycle_s = ? WHERE id = ?",
                          (time.time(), res, round(d.get('cycle_s') or 0.0, 1), j['id']))
                self._apply(j, res)
            if j['status'] == 'unknown':
                self.db.event('info', j['device'], f"job {j['id']} confirmed by the PLC after the time-out")
            self.last_close, self.stall_alarmed = time.time(), False

    def _apply(self, j, res):
        """Effect of a finished job on the database (called inside a transaction)."""
        p = json.loads(j['params'])
        if j['code'] == 10:                                       # HMC machining finished
            content = 'machined' if res == 0 else 'nok'
            self.db.x('UPDATE pallet SET content = ?, since = ? WHERE id = ?', (content, time.time(), p['job.palletId']))
            self.db.event('info' if res == 0 else 'warn', j['device'], f"pallet {p['job.palletId']} {content} (O{p['job.programNo']})" + (' – job ABORTED (alarm)' if res == 2 else ''))
            self.last_end[j['device']] = time.time()
            if self.tools and res != 2:
                self.tools.on_job_done(j['device'], p['job.programNo'], p['job.qty'])
        elif j['code'] == 12:                                     # operator task finished
            pal = self.db.q('SELECT * FROM pallet WHERE id = ?', (p['task.palletId'],))[0]
            if p['task.type'] in (2, 3) and pal['content'] in ('machined', 'nok') and pal['wo']:
                col = 'done' if pal['content'] == 'machined' else 'scrap'
                self.db.x(f'UPDATE wo SET {col} = {col} + 1 WHERE id = ?', (pal['wo'],))
                self._check_wo_finished(pal['wo'])
            if p['task.type'] in (1, 3):
                self.db.x("UPDATE pallet SET content = 'raw', variant = ?, wo = ?, since = ? WHERE id = ?", (p['task.variant'], p['wo'], time.time(), pal['id']))
                self.db.x('UPDATE wo SET started = started + 1 WHERE id = ?', (p['wo'],))
            else:
                self.db.x("UPDATE pallet SET content = 'empty', variant = 0, wo = '', since = ? WHERE id = ?", (time.time(), pal['id']))
        elif j['code'] == 14 and self.tools:                     # tool data written: confirm with the echo registers
            self.tools.on_tool_data_done(j, res, self.live.get(j['device'], {}).get('toolEcho'))
        elif j['code'] == 11 and res != 0:
            self.db.event('warn', 'PPS-1', f'move job {j["id"]} ended with result {res}')

    def watch_jobs(self):
        now = time.time()
        for j in self.db.q("SELECT * FROM job WHERE status IN ('sent', 'noack') AND device IN (?,?,?,?,?)", tuple(CELL)):
            d = self.live.get(j['device'], {})
            if j['status'] == 'noack':
                # no ACK in time: if the device is idle and has not taken the job, it was never executed
                if now - j['created'] > NOACK_GRACE_S and d.get('online') and not d.get('busy') and d.get('idDone') != j['id']:
                    self.db.x("UPDATE job SET status = 'rejected' WHERE id = ?", (j['id'],))
                    self.db.event('warn', j['device'], f"job {j['id']} not taken by the PLC (no ACK) – will be planned again")
                    if j['code'] == 12 and self.logistics:
                        p = json.loads(j['params'])
                        if p.get('task.type') in (1, 3):
                            self.logistics.return_casting(p['task.variant'])
                continue
            limit = JOB_TIMEOUT_S.get(j['code'], 600) / self.speed
            if now - j['created'] > limit:
                self.db.x("UPDATE job SET status = 'unknown' WHERE id = ?", (j['id'],))
                self.db.event('alarm', j['device'], f"job {j['id']} ({j['info']}) not finished after {limit * self.speed:.0f} s – "
                              f"check the machine, then resolve the job (done / failed)")
        if self.mode == 'auto' and not self.stall_alarmed and self._open_wos() and now - self.last_close > STALL_ALARM_S / self.speed:
            self.stall_alarmed = True
            self.db.event('alarm', 'CELL', f'cell stalled: no job finished for {STALL_ALARM_S / 60:.0f} min while work orders are open')

    def _check_wo_finished(self, wo_id):
        w = self.db.q('SELECT * FROM wo WHERE id = ?', (wo_id,))[0]
        if w['done'] >= w['qty'] and not w['finished']:
            self.db.x('UPDATE wo SET finished = ? WHERE id = ?', (time.time(), wo_id))
            self.db.event('info', 'CELL', f"work order {wo_id} finished: {w['done']} good, {w['scrap']} scrap")

    # ============================================================ 3 dispatching
    def _active(self, device):
        return self.db.q("SELECT * FROM job WHERE status IN (?,?,?) AND device = ?", OPEN + (device,))

    def _pallet_busy(self, pid):
        for j in self.db.q("SELECT params FROM job WHERE status IN (?,?,?)", OPEN):
            p = json.loads(j['params'])
            if pid in (p.get('job.palletId'), p.get('move.palletId'), p.get('task.palletId')):
                return True
        return False

    def new_job_id(self):
        """Unique job id for the cell controller AND the logistics thread (shared counter, protected by the lock)."""
        with self.lock:
            self.job_id += 1
            self.db.put('job_id', self.job_id)
            return self.job_id

    def _send(self, device, code, params, info=''):
        if time.time() < self.retry_after.get(device, 0):
            return False
        jid = self.new_job_id()
        self.db.x("INSERT INTO job (id, device, code, params, status, created, info) VALUES (?,?,?,?,?,?,?)",
                  (jid, device, code, json.dumps(params), 'sent', time.time(), info))
        dev_params = {k: v for k, v in params.items() if '.' in k}
        try:
            self.links[device].command(code, dev_params, job_id=jid)
            return True
        except HandshakeError as e:
            if 'no ACK' in str(e):                       # the PLC may still take it -> not 'rejected' yet
                self.db.x("UPDATE job SET status = 'noack', info = ? WHERE id = ?", (f'{info} – {e}', jid))
                self.db.event('warn', device, f'command {code}: no ACK in time – waiting for the PLC')
                return True                              # caller must not plan the same action again
            self.db.x("UPDATE job SET status = 'rejected', info = ? WHERE id = ?", (str(e), jid))
            self.db.event('warn', device, f'command {code} not accepted: {e}')
        except ModbusError as e:
            self.db.x("UPDATE job SET status = 'noack', info = ? WHERE id = ?", (f'{info} – {e}', jid))
            self.db.event('warn', device, f'command {code}: connection error during the handshake – waiting for the PLC ({e})')
            return True
        self.retry_after[device] = time.time() + 1.0
        return False

    def _open_wos(self, fixture=None):
        order = 'due, created' if self.rule == 'EDD' else 'created'
        out = []
        for w in self.db.q(f'SELECT * FROM wo WHERE released = 1 AND finished IS NULL ORDER BY {order}'):
            if w['started'] - w['scrap'] < w['qty'] and (fixture is None or FIXTURE_FOR[w['variant']] == fixture):   # scrap -> replacement start
                out.append(w)
        return out

    def _casting_ok(self, variant, peek=False):
        """True if a casting of `variant` is at the load station (always True without logistics). peek: do not reserve."""
        if not self.logistics:
            return True
        if peek:
            ok = self.logistics.db.q('SELECT qty FROM buffer WHERE variant = ?', (variant,))[0]['qty'] > 0
        else:
            ok = self.logistics.take_casting(variant)
        if not ok and variant not in self.waiting_material:
            self.waiting_material.add(variant)
            self.db.event('warn', 'LOAD-CC', f'waiting for {VARIANT_NAME[variant]} castings (load-station buffer empty)')
        elif ok:
            self.waiting_material.discard(variant)
        return ok

    def _starving_fixture(self, pallets, where):
        """Fixture type of the most urgent open work order if NO pallet of that type is in circulation (raw / machined
        or at the load station / a machine) and an empty pallet of that type waits in the rack; else None."""
        wos = [w for w in self._open_wos() if self._casting_ok(w['variant'], peek=True)]
        if not wos:
            return None
        fx = FIXTURE_FOR[wos[0]['variant']]
        for pid, p in pallets.items():
            if p['fixture'] == fx and (p['content'] in ('raw', 'machined', 'nok') or where.get(pid) in (LOAD_SLOT, *HMC_SLOT.values())):
                return None
        if any(where.get(pid) in RACK and p['fixture'] == fx and p['content'] == 'empty' for pid, p in pallets.items()):
            return fx
        return None

    def dispatch(self):
        L = self.live
        pps = L.get('PPS-1', {})
        if not pps.get('online'):
            return
        slots = pps['slots']
        pallets = {p['id']: p for p in self.db.q('SELECT * FROM pallet')}
        where = {pid: s for s, pid in slots.items() if pid}
        starving = self._starving_fixture(pallets, where)

        # ---- HMC jobs
        for m, s in HMC_SLOT.items():
            d = L.get(m, {})
            pid = slots.get(s, 0)
            if pid and d.get('online') and d.get('ready') and not d.get('busy') and not self._active(m) \
                    and pallets[pid]['content'] == 'raw' and not self._pallet_busy(pid):
                v = pallets[pid]['variant']
                if self.tools and not self.tools.check(m, NC_PROGRAM[('HMC', v)], 1)[0]:
                    continue                                # tool check failed -> change request, no job
                self._send(m, 10, {'job.palletId': pid, 'job.programNo': NC_PROGRAM[('HMC', v)], 'job.variant': v,
                                   'job.qty': 1, 'job.fixtureId': pid}, f'machine pallet {pid} {VARIANT_NAME[v]}')

        # ---- load station operator task
        lp = slots.get(LOAD_SLOT, 0)
        ld = L.get('LOAD-CC', {})
        if lp and ld.get('online') and ld.get('ready') and not self._active('LOAD-CC') and not self._pallet_busy(lp):
            pal = pallets[lp]
            wos = self._open_wos(pal['fixture'])
            if starving and pal['fixture'] != starving:
                wos = []                                    # do not refill: the other fixture type must come in
            # loading needs a casting in the load-station buffer (item 4: kanban from the raw AS/RS)
            wos = [w for w in wos if self._casting_ok(w['variant'], peek=True)]
            if pal['content'] in ('machined', 'nok'):
                if wos and self._casting_ok(wos[0]['variant']):
                    w = wos[0]
                    if not self._send('LOAD-CC', 12, {'task.type': 3, 'task.palletId': lp, 'task.variant': w['variant'], 'wo': w['id']},
                                      f"unload + load {VARIANT_NAME[w['variant']]} for {w['id']}") and self.logistics:
                        self.logistics.return_casting(w['variant'])
                else:
                    self._send('LOAD-CC', 12, {'task.type': 2, 'task.palletId': lp, 'task.variant': 0, 'wo': ''}, 'unload')
            elif pal['content'] == 'empty' and wos and self._casting_ok(wos[0]['variant']):
                w = wos[0]
                if not self._send('LOAD-CC', 12, {'task.type': 1, 'task.palletId': lp, 'task.variant': w['variant'], 'wo': w['id']},
                                  f"load {VARIANT_NAME[w['variant']]} for {w['id']}") and self.logistics:
                    self.logistics.return_casting(w['variant'])

        # ---- shuttle: one move at a time
        if pps.get('shuttleBusy') or self._active('PPS-1') or not pps.get('ready'):
            return
        # nearest free rack location to the load station first (shuttle time 12 s + 2 s per location distance)
        free_rack = sorted((s for s in RACK if not slots.get(s)), key=lambda s: abs(LOAD_SLOT - s))
        idle_hmc = [m for m, s in HMC_SLOT.items() if not slots.get(s) and L.get(m, {}).get('online')
                    and L[m].get('state') != 4 and not L[m].get('busy')]
        idle_hmc.sort(key=lambda m: self.last_end[m])       # the machine that has waited longest first (even load)

        def move(pid, dst, why):
            return self._send('PPS-1', 11, {'move.palletId': pid, 'move.src': where[pid], 'move.dst': dst}, why)

        # (a) empty a finished machine; park a raw pallet of a machine that is down / offline too long
        for m, s in HMC_SLOT.items():
            pid = slots.get(s, 0)
            if not pid or self._pallet_busy(pid):
                continue
            d = L.get(m, {})
            if pallets[pid]['content'] in ('machined', 'nok', 'empty') and not d.get('busy'):
                if not slots.get(LOAD_SLOT) and (pallets[pid]['content'] != 'empty'):
                    return move(pid, LOAD_SLOT, f'{m} finished -> load station')
                if free_rack:
                    return move(pid, free_rack[0], f'{m} finished -> rack {free_rack[0]}')
            if pallets[pid]['content'] == 'raw' and free_rack and not d.get('busy'):
                since = self.offline_since.get(m) if not d.get('online') else self.down_since.get(m)
                if since and time.time() - since > PARK_AFTER_S / self.speed:
                    return move(pid, free_rack[0], f'{m} down / offline – raw pallet {pid} parked in rack {free_rack[0]}')
        # (b) feed the idle machine with a raw pallet (EDD / FIFO by the pallet's work order)
        if idle_hmc:
            raw = [pid for pid, s in where.items() if pallets[pid]['content'] == 'raw' and (s in RACK or s == LOAD_SLOT)
                   and not self._pallet_busy(pid)]
            if raw:
                due = {w['id']: (w['due'], w['created']) for w in self.db.q('SELECT * FROM wo')}
                raw.sort(key=lambda pid: due.get(pallets[pid]['wo'], (9e18, 9e18)) if self.rule == 'EDD' else due.get(pallets[pid]['wo'], (0, 9e18))[1])
                for pid in raw:                                   # first pallet that an idle machine with fit tools can take
                    prog = NC_PROGRAM[('HMC', pallets[pid]['variant'])]
                    fit = [m for m in idle_hmc if not self.tools or self.tools.check(m, prog, 1)[0]]
                    if fit:
                        return move(pid, HMC_SLOT[fit[0]], f'raw pallet {pid} -> {fit[0]}')
        # (c) serve the load station
        if not slots.get(LOAD_SLOT):
            if starving:                                          # fixture balance: bring the missing fixture type first
                empty = sorted((pid for pid, s in where.items() if s in RACK and pallets[pid]['content'] == 'empty'
                                and pallets[pid]['fixture'] == starving and not self._pallet_busy(pid)), key=lambda pid: abs(LOAD_SLOT - where[pid]))
                if empty:
                    return move(empty[0], LOAD_SLOT, f'empty pallet {empty[0]} (fixture {starving}, none in circulation) -> load station')
            done = sorted((pid for pid, s in where.items() if s in RACK and pallets[pid]['content'] in ('machined', 'nok')
                           and not self._pallet_busy(pid)), key=lambda pid: pallets[pid]['since'] or 0)
            if done:                                              # the OLDEST machined pallet first
                return move(done[0], LOAD_SLOT, f'machined pallet {done[0]} -> load station')
            for w in self._open_wos():
                empty = sorted((pid for pid, s in where.items() if s in RACK and pallets[pid]['content'] == 'empty'
                                and pallets[pid]['fixture'] == FIXTURE_FOR[w['variant']] and not self._pallet_busy(pid)),
                               key=lambda pid: abs(LOAD_SLOT - where[pid]))
                if empty:
                    return move(empty[0], LOAD_SLOT, f"empty pallet {empty[0]} -> load station for {w['id']}")
        # (d) clear the load station when its pallet waits (raw, no idle machine; empty without order / wrong fixture)
        lp = slots.get(LOAD_SLOT, 0)
        if lp and not self._pallet_busy(lp) and free_rack:
            c = pallets[lp]['content']
            if c == 'raw' or (c == 'empty' and (not self._open_wos(pallets[lp]['fixture']) or (starving and pallets[lp]['fixture'] != starving))):
                return move(lp, free_rack[0], f'pallet {lp} load station -> rack {free_rack[0]}')
