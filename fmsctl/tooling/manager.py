"""Tool management (item 3): tool items, magazines, presetter import, tool check before a job, change requests.

Sources of truth: the CNC counts the uses and publishes the remaining life per pocket (registers 310-339, 0.1 %);
the tool manager adds what the CNC does not know – which physical tool (serial, presetter offsets) sits in which pocket,
which tools a program needs, and how much life the NEXT job will consume.

    check(machine, program, qty)  -> (ok, reasons)   – called by the cell controller before every HMC job
    requests                      -> change requests for the tool setter (missing / worn / predicted end of life)
    complete(request, serial)     -> mount a measured tool: command 14 writes life 100 % + offsets into the CNC;
                                     the database is changed only when the CNC has FINISHED the command and its echo
                                     (registers 340-345: pocket, L, R) equals what was sent (on_tool_data_done)
    on_job_done(machine, ...)     -> uses are booked to the pocket whose CNC life really dropped (sister tools: only the
                                     tool that worked), not to every tool of the type
    import_presetter(csv_text)    -> tool items from the presetter's CSV export (serial;type;length;radius)
"""
from __future__ import annotations

import csv
import io
import json
import time

from fmsctl.spec import tooling as TL

SCHEMA = """
CREATE TABLE IF NOT EXISTS tool_item (serial TEXT PRIMARY KEY, type TEXT, length REAL, radius REAL, measured REAL,
                                      status TEXT DEFAULT 'store', machine TEXT DEFAULT '', pocket INTEGER DEFAULT 0, uses INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS magazine (machine TEXT, pocket INTEGER, type TEXT, serial TEXT DEFAULT '', PRIMARY KEY (machine, pocket));
CREATE TABLE IF NOT EXISTS tool_req (id INTEGER PRIMARY KEY AUTOINCREMENT, machine TEXT, pocket INTEGER, type TEXT, reason TEXT,
                                     status TEXT DEFAULT 'open', created REAL, done_t REAL, serial TEXT DEFAULT '');
"""
RESERVE = 20          # 0.1 % – keep 2 % reserve after the job


class ToolManager:
    def __init__(self, ctl, machines=('HMC-01', 'HMC-02', 'HMC-03')):
        self.ctl, self.db, self.machines = ctl, ctl.db, machines
        with self.db.lock:
            self.db.c.executescript(SCHEMA)
        for m in machines:
            for pk, t in TL.MAGAZINE.items():
                self.db.x('INSERT OR IGNORE INTO magazine (machine, pocket, type) VALUES (?,?,?)', (m, pk, t))
        self.last_block = {}
        self.life_before = {}                         # machine -> CNC life per pocket when the last job was released
        with self.db.lock:
            for sql in ('ALTER TABLE tool_item ADD COLUMN regrinds INTEGER DEFAULT 0',):
                try:
                    self.db.c.execute(sql)
                except Exception:
                    pass

    # ---------------------------------------------------------- life data
    def life(self, machine):
        """Remaining life per pocket from the CNC (0.1 %), via the cell controller's polling."""
        return self.ctl.live.get(machine, {}).get('toolLife') or []

    def group_life(self, machine, ttype):
        lf = self.life(machine)
        return sum(lf[pk - 1] for pk, t in TL.MAGAZINE.items() if t == ttype and len(lf) >= pk)

    # ---------------------------------------------------------- tool check before a job
    def check(self, machine, program, qty=1):
        lf = self.life(machine)
        if not lf:
            return False, ['no tool data from the CNC']
        reasons = []
        for ttype, uses in TL.PROGRAM_TOOLS.get(program, []):
            need = TL.usage_pct(ttype, uses * qty) + RESERVE
            have = self.group_life(machine, ttype)
            if have < need:
                pockets = [pk for pk, t in TL.MAGAZINE.items() if t == ttype]
                worst = min(pockets, key=lambda pk: lf[pk - 1])
                reasons.append(f'{ttype} {TL.TOOL_TYPES[ttype][0]}: {have / 10:.1f} % left in group, job needs {need / 10:.1f} %')
                self.request(machine, worst, ttype, 'life too low for the next job')
        if reasons:
            if self.last_block.get(machine) != tuple(reasons):
                self.db.event('warn', machine, f'tool check blocks O{program}: ' + '; '.join(reasons))
                self.last_block[machine] = tuple(reasons)
            return False, reasons
        self.last_block.pop(machine, None)
        self.life_before[machine] = list(lf)
        return True, []

    def on_job_done(self, machine, program, qty=1):
        """Book the uses to the physical tool that did the work: in a sister group the CNC uses one pocket until it is
        worn, so the pocket whose remaining life dropped gets the uses (fallback: first pocket of the group with life left)."""
        before, now = self.life_before.pop(machine, None), self.life(machine)
        for ttype, uses in TL.PROGRAM_TOOLS.get(program, []):
            pockets = [pk for pk, t in TL.MAGAZINE.items() if t == ttype]
            ok = before and len(now) >= max(pockets) and len(before) >= max(pockets)
            drops = {pk: max(0, before[pk - 1] - now[pk - 1]) for pk in pockets} if ok else {}
            worked = [pk for pk in pockets if drops.get(pk, 0) > 0]
            if not worked:
                first = next((pk for pk in pockets if len(now) >= pk and now[pk - 1] > 0), pockets[0])
                worked, drops = [first], {first: 1}
            total = sum(drops[pk] for pk in worked)
            for pk in worked:                             # a job that switched sisters splits the uses by life drop
                n = round(uses * qty * drops[pk] / total)
                self.db.x("UPDATE tool_item SET uses = uses + ? WHERE machine = ? AND pocket = ? AND status = 'machine'", (n, machine, pk))

    # ---------------------------------------------------------- warnings for the coming shift
    def forecast(self, parts_ahead=20, program=1020):
        """Pockets that will reach the warning limit within `parts_ahead` parts of `program` (setter's work list)."""
        out = []
        for m in self.machines:
            lf = self.life(m)
            if not lf:
                continue
            for ttype, uses in TL.PROGRAM_TOOLS.get(program, []):
                warn = TL.TOOL_TYPES[ttype][2] * 10
                have = self.group_life(m, ttype)
                after = have - TL.usage_pct(ttype, uses * parts_ahead)
                if after < warn:
                    out.append({'machine': m, 'type': ttype, 'name': TL.TOOL_TYPES[ttype][0], 'now_pct': round(have / 10, 1),
                                'after_pct': round(after / 10, 1), 'parts_left': int(max(0, have - warn) / max(1e-9, TL.usage_pct(ttype, uses)))})
        return sorted(out, key=lambda r: r['parts_left'])

    # ---------------------------------------------------------- change requests
    def request(self, machine, pocket, ttype, reason):
        if self.db.q("SELECT id FROM tool_req WHERE machine = ? AND pocket = ? AND status IN ('open', 'mounting')", (machine, pocket)):
            return
        self.db.x('INSERT INTO tool_req (machine, pocket, type, reason, created) VALUES (?,?,?,?,?)', (machine, pocket, ttype, reason, time.time()))
        self.db.event('info', machine, f'tool change requested: pocket {pocket} {ttype} ({reason})')

    def requests(self, status='open'):
        return self.db.q('SELECT * FROM tool_req WHERE status = ? ORDER BY id', (status,))

    def complete(self, req_id, serial):
        """Setter mounted the measured tool `serial` (from the presetter) for request `req_id`."""
        r = self.db.q('SELECT * FROM tool_req WHERE id = ?', (req_id,))
        if not r:
            raise ValueError('unknown request')
        r = r[0]
        it = self.db.q("SELECT * FROM tool_item WHERE serial = ? AND status = 'store'", (serial,))
        if not it:
            raise ValueError(f'tool {serial} not measured / not in store')
        it = it[0]
        if it['type'] != r['type']:
            raise ValueError(f"tool {serial} is {it['type']}, pocket needs {r['type']}")
        if r['status'] != 'open':
            raise ValueError(f"request {req_id} is {r['status']}")
        ok = self.ctl._send(r['machine'], 14, {'tool.pocket': r['pocket'], 'tool.length_mm': it['length'], 'tool.radius_mm': it['radius'],
                                               'tool.lifeSet': 1000, 'req': req_id, 'serial': serial},
                            f"tool data pocket {r['pocket']} <- {serial}")
        if not ok:
            raise RuntimeError('CNC did not accept the tool data (busy / not ready) – retry')
        self.db.x("UPDATE tool_req SET status = 'mounting', serial = ? WHERE id = ?", (serial, req_id))
        self.db.x("UPDATE tool_item SET status = 'mounting' WHERE serial = ?", (serial,))
        return True

    def on_tool_data_done(self, job, result, echo):
        """Command 14 finished. echo = (pocket, length, radius) read back from registers 340-345.
        Only if the CNC reports OK and the echo equals the sent data is the tool booked into the magazine."""
        p = json.loads(job['params'])
        r = self.db.q('SELECT * FROM tool_req WHERE id = ?', (p.get('req'),))
        if not r:
            return
        r, serial = r[0], p['serial']
        good = (result == 0 and echo is not None and echo[0] == p['tool.pocket'] and abs(echo[1] - p['tool.length_mm']) < 1e-3
                and abs(echo[2] - p['tool.radius_mm']) < 1e-3)
        if not good:
            self.db.x("UPDATE tool_req SET status = 'open', serial = '' WHERE id = ?", (r['id'],))
            self.db.x("UPDATE tool_item SET status = 'store' WHERE serial = ?", (serial,))
            self.db.event('alarm', r['machine'], f"tool data for pocket {r['pocket']} NOT confirmed by the CNC (result {result}, echo {echo}) "
                          f"– check the offsets at the CNC before machining")
            return
        old = self.db.q('SELECT serial FROM magazine WHERE machine = ? AND pocket = ?', (r['machine'], r['pocket']))
        if old and old[0]['serial']:
            self.db.x("UPDATE tool_item SET status = 'regrind', machine = '', pocket = 0 WHERE serial = ?", (old[0]['serial'],))
        self.db.x("UPDATE tool_item SET status = 'machine', machine = ?, pocket = ?, uses = 0 WHERE serial = ?", (r['machine'], r['pocket'], serial))
        self.db.x('UPDATE magazine SET serial = ? WHERE machine = ? AND pocket = ?', (serial, r['machine'], r['pocket']))
        self.db.x("UPDATE tool_req SET status = 'done', done_t = ? WHERE id = ?", (time.time(), r['id']))
        self.db.event('info', r['machine'], f"tool {serial} mounted in pocket {r['pocket']} – life 100 %, "
                      f"L {p['tool.length_mm']:.3f} R {p['tool.radius_mm']:.3f} confirmed by the CNC echo")

    # ---------------------------------------------------------- presetter
    def import_presetter(self, text):
        """CSV lines: serial;type;length_mm;radius_mm (header optional; ',' or ';')."""
        n = 0
        dialect = ';' if text.count(';') >= text.count(',') else ','
        for row in csv.reader(io.StringIO(text), delimiter=dialect):
            if len(row) < 4 or row[0].strip().lower() == 'serial':
                continue
            serial, ttype = row[0].strip(), row[1].strip().upper()
            if ttype not in TL.TOOL_TYPES:
                self.db.event('warn', 'TOOLS', f'presetter: unknown tool type {ttype} for {serial}')
                continue
            L, Rr = float(row[2]), float(row[3])
            if not (20.0 <= L <= 400.0 and 0.0 <= Rr <= 100.0):            # plausibility for the tools of these HMCs
                self.db.event('warn', 'TOOLS', f'presetter: {serial} L {L} R {Rr} not plausible – measure again')
                continue
            old = self.db.q('SELECT * FROM tool_item WHERE serial = ?', (serial,))
            if old and old[0]['status'] in ('machine', 'mounting'):
                self.db.event('warn', 'TOOLS', f"presetter: {serial} is in {old[0]['machine'] or 'mounting'} – unload it before measuring again")
                continue
            if old:                                                       # re-measured after regrind (or a repeat measurement)
                regr = (old[0]['regrinds'] or 0) + (1 if old[0]['status'] == 'regrind' else 0)
                self.db.x("UPDATE tool_item SET type = ?, length = ?, radius = ?, measured = ?, status = 'store', uses = 0, regrinds = ? "
                          "WHERE serial = ?", (ttype, L, Rr, time.time(), regr, serial))
            else:
                self.db.x("INSERT INTO tool_item (serial, type, length, radius, measured, status) VALUES (?,?,?,?,?, 'store')",
                          (serial, ttype, L, Rr, time.time()))
            n += 1
        self.db.event('info', 'TOOLS', f'presetter import: {n} tools measured')
        return n

    def snapshot(self):
        mags = {}
        for m in self.machines:
            lf = self.life(m)
            mags[m] = [{'pocket': r['pocket'], 'type': r['type'], 'name': TL.TOOL_TYPES[r['type']][0], 'serial': r['serial'],
                        'life_pct': round(lf[r['pocket'] - 1] / 10, 1) if len(lf) >= r['pocket'] else None,
                        'warn_pct': TL.TOOL_TYPES[r['type']][2]}
                       for r in self.db.q('SELECT * FROM magazine WHERE machine = ? ORDER BY pocket', (m,))]
        return {'magazines': mags, 'requests': self.requests(), 'done': self.requests('done')[-15:],
                'store': self.db.q("SELECT * FROM tool_item WHERE status = 'store' ORDER BY type, serial"),
                'forecast': self.forecast()}
