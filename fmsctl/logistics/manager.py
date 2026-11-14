"""Logistics (item 4): AS/RS warehouse management + AGV fleet manager + material flows of the compressor FMS.

WMS     the software owns the location table of both AS/RS (bays × levels × sides); put-away: free location nearest to the
        I/O point (bay 1, low levels first); retrieval: FIFO by receipt time. Crane commands 30 store / 31 retrieve.
        At the I/O point RETRIEVALS HAVE PRIORITY over put-away (production must never wait behind a goods receipt).
FLEET   transport orders (pick-up node -> drop node); assignment to the nearest idle AGV (weak battery penalised, AGVs in
        error excluded); node reservation (no two AGVs to the same pick-up / drop node; one AGV per charger);
        charging below LOW_BATTERY.
FLOWS   castings kanban (only in automatic mode, only while unfinished work orders still need castings of that variant):
        buffer at the load station (node 2) per variant at or below its reorder point -> retrieve the oldest box from
        ASRS-RAW (crane to I/O node 1) -> AGV node 1 -> node 2 -> buffer + box size.
        finished goods: unit ready at final assembly (node 7) -> AGV node 7 -> node 8 -> ASRS-FG store.
        shipping: ship(item, n) retrieves the n oldest finished units of an item from ASRS-FG to its I/O point (FIFO).
Results: every crane / AGV job result is checked. A failed job sets the handling unit to 'fault' and raises an alarm;
        the operator decides with resolve(hu, action) after looking at the real situation (load still on the fork, ...).
Time-outs: crane job > CRANE_TIMEOUT_S, AGV job > AGV_TIMEOUT_S -> alarm (once per job).
Gateway heartbeat (register 226) is written to AGVs and cranes once per second; OFFLINE only after 3 failed polls (Wi-Fi).
Chained jobs: a transport waits until its crane retrieval is done; a store waits until the AGV has dropped the load.
The cell controller asks take_casting(variant) before it gives the operator a loading task.
"""
from __future__ import annotations

import json
import math
import threading
import time

from fmsctl.core.device import DeviceLink, HandshakeError
from fmsctl.core.modbus import ModbusError
from fmsctl.spec import plant

DEVICES = ['AGV-01', 'AGV-02', 'ASRS-RAW', 'ASRS-FG']
ASRS_IO = {'ASRS-RAW': 1, 'ASRS-FG': 8}
LAYOUT = {'ASRS-RAW': (28, 7), 'ASRS-FG': (28, 5)}                     # bays × levels (× 2 sides); FG 5 levels (config)
BAYS, LEVELS = LAYOUT['ASRS-RAW']
CHARGERS = [9, 10]
LOW_BATTERY, CHARGED = 25, 95
BATTERY_PENALTY_BELOW, BATTERY_PENALTY_M = 40, 30.0                     # an AGV below 40 % counts as 30 m further away
BOX = {1: ('RAW_CC10', 6), 2: ('RAW_CC', 4), 3: ('RAW_CC30', 3)}       # unit load per box (config/factory.json)
ITEM_VARIANT = {v[0]: k for k, v in BOX.items()}
REORDER_POINT = {1: 2, 2: 2, 3: 2}                                      # castings per variant at the load station
CRANE_TIMEOUT_S, AGV_TIMEOUT_S = 300, 900                               # plant seconds (divided by the virtual speed)
OFFLINE_AFTER = 3                                                       # consecutive failed polls before OFFLINE
HEARTBEAT_S = 1.0

SCHEMA = """
CREATE TABLE IF NOT EXISTS loc (asrs TEXT, bay INTEGER, level INTEGER, side INTEGER, hu TEXT DEFAULT '', blocked INTEGER DEFAULT 0,
                                PRIMARY KEY (asrs, bay, level, side));
CREATE TABLE IF NOT EXISTS hu (id TEXT PRIMARY KEY, item TEXT, qty INTEGER, asrs TEXT, bay INTEGER, level INTEGER, side INTEGER,
                               status TEXT, received REAL, lot TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS buffer (variant INTEGER PRIMARY KEY, qty INTEGER DEFAULT 0, on_way INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS transport (id INTEGER PRIMARY KEY AUTOINCREMENT, frm INTEGER, too INTEGER, load INTEGER, hu TEXT,
                                      purpose TEXT, status TEXT, agv TEXT DEFAULT '', wait_job INTEGER DEFAULT 0, created REAL, done_t REAL);
"""


class Logistics:
    def __init__(self, ctl, device_table, loop=0.05, speed=1.0):
        self.ctl, self.db, self.loop, self.speed = ctl, ctl.db, loop, speed
        with self.db.lock:
            self.db.c.executescript(SCHEMA)
            for tbl, col in (('loc', 'blocked INTEGER DEFAULT 0'), ('hu', "lot TEXT DEFAULT ''")):   # databases of older versions
                try:
                    self.db.c.execute(f'ALTER TABLE {tbl} ADD COLUMN {col}')
                except Exception:
                    pass
        self.links = {d['id']: DeviceLink(d, timeout=0.3) for d in device_table if d['id'] in DEVICES}
        self.live = {i: {'online': False} for i in DEVICES}
        self.fails = {i: 0 for i in DEVICES}
        self.timeout_alarmed = set()
        if not self.db.q('SELECT asrs FROM loc LIMIT 1'):
            with self.db.lock:
                self.db.c.executemany('INSERT INTO loc (asrs, bay, level, side) VALUES (?,?,?,?)',
                                      [(a, b, l, s) for a, (nb, nl) in LAYOUT.items()
                                       for b in range(1, nb + 1) for l in range(1, nl + 1) for s in (1, 2)])
        for v in BOX:
            self.db.x('INSERT OR IGNORE INTO buffer (variant) VALUES (?)', (v,))
        self.hu_seq = self.db.get('hu_seq', 1000)
        self.hb, self.hb_t = 0, 0.0
        self.running = False

    # ============================================================ public
    def start(self):
        self.running = True
        threading.Thread(target=self._run, daemon=True).start()

    def stop(self):
        self.running = False

    def receive(self, item, qty, n_boxes=1, lot=''):
        """Goods receipt: boxes of `item` arrive at the raw AS/RS I/O point -> put-away (crane store)."""
        if item not in ITEM_VARIANT:
            raise ValueError(f'unknown item {item}')
        ids = []
        for _ in range(n_boxes):
            self.hu_seq += 1
            self.db.put('hu_seq', self.hu_seq)
            hid = f'HU{self.hu_seq}'
            self.db.x("INSERT INTO hu (id, item, qty, status, received, lot) VALUES (?,?,?,?,?,?)",
                      (hid, item, qty, 'at_io_raw', time.time(), lot))
            ids.append(hid)
            self.db.event('info', 'ASRS-RAW', f'goods receipt {hid}: {qty} × {item}' + (f' lot {lot}' if lot else ''))
            time.sleep(0.001)
        return ids

    def finished_unit(self, serial):
        """A finished compressor waits at final assembly (node 7) -> AGV to the FG AS/RS -> store."""
        self.db.x("INSERT INTO hu (id, item, qty, status, received) VALUES (?,?,?,?,?)", (serial, 'FG_' + serial.split('-')[0], 1, 'at_final', time.time()))
        self.db.x("INSERT INTO transport (frm, too, load, hu, purpose, status, created) VALUES (7, 8, 4, ?, 'fg', 'open', ?)", (serial, time.time()))
        self.db.event('info', 'FLEET', f'finished unit {serial} ready at node 7')

    def ship(self, item, n):
        """Shipping: retrieve the n oldest stored finished units of `item` (e.g. 'FG_VC20') to the FG I/O point (FIFO)."""
        units = self.db.q("SELECT * FROM hu WHERE item = ? AND status = 'stored' AND asrs = 'ASRS-FG' ORDER BY received LIMIT ?", (item, n))
        for h in units:
            self.db.x("UPDATE hu SET status = 'reserved' WHERE id = ?", (h['id'],))
            self.db.x("INSERT INTO transport (frm, too, load, hu, purpose, status, created) VALUES (8, 0, 4, ?, 'ship', 'need_retrieval', ?)",
                      (h['id'], time.time()))
        self.db.event('info', 'ASRS-FG', f'shipping order: {len(units)} of {n} × {item} (FIFO)')
        return [h['id'] for h in units]

    def resolve(self, hu, action):
        """Operator decision after a failed crane / AGV job, a cycle count or a lost unit.
        'stored'  the unit is really in its booked location
        'at_io'   the unit stands at the I/O point of its AS/RS -> it is stored again (new location)
        'removed' the unit is not in the system any more: location freed, unit written off"""
        h = self.db.q('SELECT * FROM hu WHERE id = ?', (hu,))
        if not h:
            raise ValueError(f'unknown handling unit {hu}')
        h = h[0]
        if action == 'stored':
            self.db.x("UPDATE hu SET status = 'stored' WHERE id = ?", (hu,))
        elif action in ('at_io', 'removed'):
            self.db.x("UPDATE loc SET hu = '' WHERE hu = ?", (hu,))
            st = ('at_io_fg' if h['asrs'] == 'ASRS-FG' else 'at_io_raw') if action == 'at_io' else 'removed'
            self.db.x("UPDATE hu SET status = ?, bay = NULL, level = NULL, side = NULL WHERE id = ?", (st, hu))
        else:
            raise ValueError("action must be 'stored', 'at_io' or 'removed'")
        self.db.event('info', h['asrs'] or 'WMS', f'operator resolved {hu}: {action}')

    def block_location(self, asrs, bay, level, side, blocked=True):
        """Block a damaged or unsure location (no put-away until it is released again)."""
        self.db.x('UPDATE loc SET blocked = ? WHERE asrs = ? AND bay = ? AND level = ? AND side = ?', (int(blocked), asrs, bay, level, side))
        self.db.event('info', asrs, f"location bay {bay} level {level} side {side} {'blocked' if blocked else 'released'}")

    def take_casting(self, variant):
        """Called by the cell controller before a loading task; reserves one casting from the load-station buffer."""
        with self.db.lock:
            b = self.db.q('SELECT qty FROM buffer WHERE variant = ?', (variant,))[0]['qty']
            if b <= 0:
                return False
            self.db.x('UPDATE buffer SET qty = qty - 1 WHERE variant = ?', (variant,))
            return True

    def return_casting(self, variant):
        self.db.x('UPDATE buffer SET qty = qty + 1 WHERE variant = ?', (variant,))

    def inventory(self):
        return self.db.q("SELECT asrs, item, COUNT(*) AS boxes, SUM(qty) AS qty FROM hu WHERE status = 'stored' GROUP BY asrs, item")

    def snapshot(self):
        return {'devices': self.live, 'buffer': self.db.q('SELECT * FROM buffer'), 'inventory': self.inventory(),
                'transports': self.db.q('SELECT * FROM transport ORDER BY id DESC LIMIT 25'),
                'stored': self.db.q("SELECT * FROM hu WHERE status = 'stored' ORDER BY asrs, bay, level, side LIMIT 60"),
                'faults': self.db.q("SELECT * FROM hu WHERE status = 'fault'"),
                'reorder_point': REORDER_POINT,
                'size': {a: nb * nl * 2 for a, (nb, nl) in LAYOUT.items()},
                'free': {a: self.db.q("SELECT COUNT(*) AS n FROM loc WHERE asrs = ? AND hu = '' AND blocked = 0", (a,))[0]['n'] for a in ASRS_IO}}

    # ============================================================ loop
    def _run(self):
        while self.running:
            t0 = time.time()
            try:
                self.poll()
                self.heartbeat()
                self.close_jobs()
                self.watch_timeouts()
                self.wms()
                self.kanban()
                self.fleet()
            except Exception as e:
                self.db.event('error', 'LOGISTICS', f'loop error: {type(e).__name__}: {e}')
            time.sleep(max(0.0, self.loop - (time.time() - t0)))

    def poll(self):
        for i, l in self.links.items():
            try:
                fast = l.read_block(0, 12)
                res = l.read_block(390, 3)
                d = {'online': True, 'state': fast[6], 'busy': bool(fast[8] & 2), 'ready': bool(fast[8] & 16),
                     'idDone': (res[0] << 16) | res[1], 'result': res[2]}
                blk = l.read_block(300, 5)
                if i.startswith('AGV'):
                    d.update(node=blk[0], target=blk[1], battery=blk[2], loaded=blk[3], agv_state=blk[4])
                else:
                    d.update(bay=blk[0], level=blk[1], loadOnFork=blk[2])
                if self.fails[i] >= OFFLINE_AFTER:
                    self.db.event('info', i, 'ONLINE again')
                self.fails[i] = 0
                self.live[i] = d
            except ModbusError:
                self.fails[i] += 1                                 # one lost frame on Wi-Fi is not yet a fault
                if self.fails[i] == OFFLINE_AFTER:
                    self.db.event('alarm', i, f'OFFLINE ({OFFLINE_AFTER} polls failed)')
                if self.fails[i] >= OFFLINE_AFTER:
                    self.live[i] = {'online': False}

    def heartbeat(self):
        """Gateway heartbeat (register 226) to AGVs and cranes once per second – their PLC watchdog blocks new jobs if it freezes."""
        if time.time() - self.hb_t < HEARTBEAT_S:
            return
        self.hb_t, self.hb = time.time(), (self.hb + 1) & 0xFFFF
        for i, l in self.links.items():
            if self.live[i].get('online'):
                try:
                    l.cli.write1(226, self.hb)
                except ModbusError:
                    pass

    def _send(self, device, code, params, info):
        jid = self.ctl.new_job_id()
        self.db.x("INSERT INTO job (id, device, code, params, status, created, info) VALUES (?,?,?,?,?,?,?)",
                  (jid, device, code, json.dumps(params), 'sent', time.time(), info))
        try:
            self.links[device].command(code, {k: v for k, v in params.items() if '.' in k}, job_id=jid)
            return jid
        except (HandshakeError, ModbusError) as e:
            self.db.x("UPDATE job SET status = 'rejected', info = ? WHERE id = ?", (str(e), jid))
            self.db.event('warn', device, f'command {code} not accepted: {e}')
            return 0

    def _active(self, device):
        return self.db.q("SELECT * FROM job WHERE status = 'sent' AND device = ?", (device,))

    # ============================================================ job completion
    def close_jobs(self):
        for j in self.db.q("SELECT * FROM job WHERE status = 'sent' AND device IN ('AGV-01','AGV-02','ASRS-RAW','ASRS-FG')"):
            d = self.live.get(j['device'], {})
            if not d.get('online') or d.get('idDone') != j['id'] or d.get('busy'):
                continue
            p, ok = json.loads(j['params']), d['result'] == 0
            self.db.x("UPDATE job SET status = 'done', done_t = ?, result = ? WHERE id = ?", (time.time(), d['result'], j['id']))
            self.timeout_alarmed.discard(j['id'])
            if j['code'] in (30, 31) and not ok:                   # crane fault: the stock record is unsure -> operator decides
                self.db.x("UPDATE hu SET status = 'fault' WHERE id = ?", (p['hu'],))
                for tr in self.db.q("SELECT * FROM transport WHERE hu = ? AND status IN ('open', 'need_retrieval')", (p['hu'],)):
                    self.db.x("UPDATE transport SET status = 'fault' WHERE id = ?", (tr['id'],))
                    if tr['purpose'] == 'kanban':
                        h = self.db.q('SELECT item, qty FROM hu WHERE id = ?', (p['hu'],))[0]
                        self.db.x('UPDATE buffer SET on_way = on_way - ? WHERE variant = ?', (h['qty'], ITEM_VARIANT[h['item']]))
                self.db.event('alarm', j['device'], f"{'store' if j['code'] == 30 else 'retrieve'} of {p['hu']} failed (result {d['result']}, "
                              f"load on fork {d.get('loadOnFork')}) – check the crane, then resolve the unit (stored / at_io / removed)")
            elif j['code'] == 30:                                  # stored
                self.db.x("UPDATE hu SET status = 'stored' WHERE id = ?", (p['hu'],))
                self.db.event('info', j['device'], f"{p['hu']} stored at bay {p['loc.bay']} level {p['loc.level']} side {p['loc.side']}")
            elif j['code'] == 31:                                  # retrieved to the I/O point
                self.db.x("UPDATE loc SET hu = '' WHERE asrs = ? AND bay = ? AND level = ? AND side = ?",
                          (j['device'], p['loc.bay'], p['loc.level'], p['loc.side']))
                ship = self.db.q("SELECT * FROM transport WHERE hu = ? AND purpose = 'ship' AND status = 'open'", (p['hu'],))
                if ship:                                           # shipping: the unit is at the truck-loading point
                    self.db.x("UPDATE transport SET status = 'done', done_t = ? WHERE id = ?", (time.time(), ship[0]['id']))
                    self.db.x("UPDATE hu SET status = 'shipped', bay = NULL, level = NULL, side = NULL WHERE id = ?", (p['hu'],))
                    self.db.event('info', j['device'], f"{p['hu']} retrieved for shipping")
                else:
                    self.db.x("UPDATE hu SET status = 'at_io' WHERE id = ?", (p['hu'],))
            elif j['code'] == 20:                                  # AGV transport done
                t = self.db.q('SELECT * FROM transport WHERE id = ?', (p['transport'],))[0]
                if not ok:
                    self.db.x("UPDATE transport SET status = 'fault', done_t = ? WHERE id = ?", (time.time(), t['id']))
                    self.db.event('alarm', j['device'], f"transport {t['id']} ({t['hu']}) failed (result {d['result']}) – find the load, then resolve the unit")
                    continue
                self.db.x("UPDATE transport SET status = 'done', done_t = ? WHERE id = ?", (time.time(), t['id']))
                if t['purpose'] == 'kanban':
                    h = self.db.q('SELECT item, qty FROM hu WHERE id = ?', (t['hu'],))[0]
                    v, q = ITEM_VARIANT[h['item']], h['qty']
                    self.db.x('UPDATE buffer SET qty = qty + ?, on_way = on_way - ? WHERE variant = ?', (q, q, v))
                    self.db.x("UPDATE hu SET status = 'consumed_at_cell' WHERE id = ?", (t['hu'],))
                    self.db.event('info', j['device'], f"{t['hu']} delivered to the load station: +{q} castings")
                elif t['purpose'] == 'fg':
                    self.db.x("UPDATE hu SET status = 'at_io_fg' WHERE id = ?", (t['hu'],))
            elif j['code'] == 21:
                self.db.event('info', j['device'], f"charged to {d.get('battery')} %")

    def watch_timeouts(self):
        now = time.time()
        for j in self.db.q("SELECT * FROM job WHERE status = 'sent' AND code IN (20, 30, 31)"):
            limit = (AGV_TIMEOUT_S if j['code'] == 20 else CRANE_TIMEOUT_S) / self.speed
            if now - j['created'] > limit and j['id'] not in self.timeout_alarmed:
                self.timeout_alarmed.add(j['id'])
                self.db.event('alarm', j['device'], f"job {j['id']} ({j['info']}) not finished after {limit * self.speed:.0f} s – check the device")

    # ============================================================ WMS
    def _free_location(self, asrs):
        r = self.db.q("SELECT * FROM loc WHERE asrs = ? AND hu = '' AND blocked = 0 ORDER BY bay + level, bay, level, side LIMIT 1", (asrs,))
        return r[0] if r else None

    def wms(self):
        for asrs, io_status in (('ASRS-RAW', 'at_io_raw'), ('ASRS-FG', 'at_io_fg')):
            d = self.live.get(asrs, {})
            if not d.get('online') or not d.get('ready') or self._active(asrs):
                continue
            # 1 retrievals first: production supply (kanban) and shipping never wait behind a goods receipt
            req = self.db.q("SELECT t.* FROM transport t JOIN hu h ON h.id = t.hu WHERE t.status = 'need_retrieval' AND h.asrs = ? "
                            "ORDER BY t.id LIMIT 1", (asrs,))
            if req:
                t = req[0]
                h = self.db.q('SELECT * FROM hu WHERE id = ?', (t['hu'],))[0]
                jid = self._send(asrs, 31, {'loc.bay': h['bay'], 'loc.level': h['level'], 'loc.side': h['side'], 'job.text': h['id'], 'hu': h['id']},
                                 f"retrieve {h['id']} {h['item']} (FIFO, {t['purpose']})")
                if jid:
                    self.db.x("UPDATE transport SET status = 'open', wait_job = ? WHERE id = ?", (jid, t['id']))
                continue
            # 2 put-away
            hu = self.db.q('SELECT * FROM hu WHERE status = ? ORDER BY received LIMIT 1', (io_status,))
            if hu:
                loc = self._free_location(asrs)
                if not loc:
                    self.db.event('alarm', asrs, 'AS/RS full')
                    continue
                h = hu[0]
                self.db.x("UPDATE loc SET hu = ? WHERE asrs = ? AND bay = ? AND level = ? AND side = ?", (h['id'], asrs, loc['bay'], loc['level'], loc['side']))
                self.db.x("UPDATE hu SET asrs = ?, bay = ?, level = ?, side = ?, status = 'storing' WHERE id = ?", (asrs, loc['bay'], loc['level'], loc['side'], h['id']))
                jid = self._send(asrs, 30, {'loc.bay': loc['bay'], 'loc.level': loc['level'], 'loc.side': loc['side'], 'job.text': h['id'], 'hu': h['id']},
                                 f"store {h['id']} {h['item']}")
                if not jid:                                        # not accepted: undo the booking, try again next loop
                    self.db.x("UPDATE loc SET hu = '' WHERE asrs = ? AND bay = ? AND level = ? AND side = ?", (asrs, loc['bay'], loc['level'], loc['side']))
                    self.db.x("UPDATE hu SET status = ?, bay = NULL, level = NULL, side = NULL WHERE id = ?", (io_status, h['id']))

    # ============================================================ kanban castings
    def _demand(self, variant):
        """Castings still needed by unfinished work orders of this variant (scrap replacement included)."""
        rows = self.db.q('SELECT qty, started, scrap FROM wo WHERE variant = ? AND finished IS NULL', (variant,))
        need = sum(max(0, w['qty'] - (w['started'] - w['scrap'])) for w in rows)
        # castings already taken by a loading task that is still running (counted as 'started' only when it is done)
        loading = sum(1 for j in self.db.q("SELECT params FROM job WHERE status = 'sent' AND code = 12")
                      if (lambda p: p.get('task.type') in (1, 3) and p.get('task.variant') == variant)(json.loads(j['params'])))
        return max(0, need - loading)

    def kanban(self):
        if self.ctl.mode != 'auto':
            return                                                 # no supply moves while the cell is in manual mode
        for b in self.db.q('SELECT * FROM buffer'):
            v = b['variant']
            have = b['qty'] + b['on_way']
            if have > REORDER_POINT[v] or self._demand(v) <= have:
                continue
            item, n = BOX[v]
            hu = self.db.q("SELECT * FROM hu WHERE item = ? AND status = 'stored' AND asrs = 'ASRS-RAW' ORDER BY received LIMIT 1", (item,))
            if not hu:
                continue
            h = hu[0]
            self.db.x("UPDATE hu SET status = 'reserved' WHERE id = ?", (h['id'],))
            self.db.x('UPDATE buffer SET on_way = on_way + ? WHERE variant = ?', (h['qty'], v))
            self.db.x("INSERT INTO transport (frm, too, load, hu, purpose, status, created) VALUES (1, 2, 1, ?, 'kanban', 'need_retrieval', ?)",
                      (h['id'], time.time()))
            self.db.event('info', 'FLEET', f"kanban {item}: buffer {b['qty']} ≤ {REORDER_POINT[v]} -> retrieve {h['id']} ({h['qty']} pcs, oldest)")

    # ============================================================ AGV fleet
    def _reserved_nodes(self):
        nodes = set()
        for t in self.db.q("SELECT * FROM transport WHERE status = 'assigned'"):
            nodes |= {t['frm'], t['too']}
        for j in self.db.q("SELECT params FROM job WHERE status = 'sent' AND code = 21"):
            nodes.add(json.loads(j['params'])['tr.toNode'])
        return nodes

    def fleet(self):
        agvs = {a: self.live[a] for a in ('AGV-01', 'AGV-02') if self.live[a].get('online')}
        idle = [a for a, d in agvs.items() if d.get('ready') and not d.get('busy') and d.get('agv_state') != 4 and not self._active(a)]
        reserved = self._reserved_nodes()
        # charging: a charger is free only if it is not reserved and no AGV stands on it
        for a in list(idle):
            if agvs[a]['battery'] < LOW_BATTERY:
                free = [c for c in CHARGERS if c not in reserved and not any(d.get('node') == c for d in agvs.values())]
                if free and self._send(a, 21, {'tr.toNode': free[0]}, f"battery {agvs[a]['battery']} % -> charger {free[0]}"):
                    self.db.event('info', a, f"low battery {agvs[a]['battery']} % – going to charger node {free[0]}")
                    reserved.add(free[0])
                idle.remove(a)
        # transport orders (too = 0: shipping, no AGV needed)
        for t in self.db.q("SELECT * FROM transport WHERE status = 'open' AND too != 0 ORDER BY id"):
            if not idle:
                return
            if t['wait_job']:
                w = self.db.q('SELECT status FROM job WHERE id = ?', (t['wait_job'],))
                if not w or w[0]['status'] != 'done':
                    continue                                      # crane has not delivered the box to the I/O point yet
            if t['frm'] in reserved or t['too'] in reserved:
                continue                                          # another AGV is heading to this dock

            def cost(a):                                          # distance to the pick-up + penalty for a weak battery
                dd = math.dist(plant.NODES[agvs[a]['node'] or 9], plant.NODES[t['frm']])
                return dd + (BATTERY_PENALTY_M if agvs[a]['battery'] < BATTERY_PENALTY_BELOW else 0.0)
            a = min(idle, key=cost)
            jid = self._send(a, 20, {'tr.fromNode': t['frm'], 'tr.toNode': t['too'], 'tr.loadType': t['load'], 'transport': t['id']},
                             f"transport {t['id']} {t['purpose']}: node {t['frm']} -> {t['too']}")
            if jid:
                self.db.x("UPDATE transport SET status = 'assigned', agv = ? WHERE id = ?", (a, t['id']))
                reserved |= {t['frm'], t['too']}
                idle.remove(a)
