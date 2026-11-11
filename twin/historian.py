"""
Historian - stores time-series data in SQLite (a file database, no server needed).
In a large factory you would replace this with InfluxDB / TimescaleDB.
"""

from __future__ import annotations

import csv
import io
import json
import os
import sqlite3
import time


class Historian:
    def __init__(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.path = path
        with self._conn() as c:
            c.execute("PRAGMA journal_mode=WAL")
            c.execute("""CREATE TABLE IF NOT EXISTS samples(
                run_id TEXT, sim_t REAL, wall_t REAL, machine TEXT, state TEXT,
                temperature_c REAL, vibration_mm_s REAL, power_kw REAL,
                spindle_rpm REAL, tool_wear_pct REAL, good INTEGER, scrap INTEGER)""")
            c.execute("""CREATE TABLE IF NOT EXISTS events(
                run_id TEXT, sim_t REAL, wall_t REAL, machine TEXT, level TEXT, text TEXT)""")
            c.execute("CREATE INDEX IF NOT EXISTS ix_samples ON samples(run_id, machine, sim_t)")
            # MES traceability: one row per finished / scrapped unit (genealogy as JSON)
            c.execute("""CREATE TABLE IF NOT EXISTS units(
                run_id TEXT, sn TEXT, wo TEXT, status TEXT, start_t REAL, end_t REAL,
                fad REAL, so TEXT, customer TEXT, shipped_t REAL, data TEXT)""")
            c.execute("CREATE INDEX IF NOT EXISTS ix_units ON units(sn)")
        self.run_id = time.strftime("%Y%m%d-%H%M%S")
        self._writer = None

    def _conn(self):
        return sqlite3.connect(self.path, timeout=10)

    def new_run(self):
        self.run_id = time.strftime("%Y%m%d-%H%M%S")

    # called only from the simulation thread
    def write(self, sim_t: float, machines, events):
        if self._writer is None:
            self._writer = self._conn()
        now = time.time()
        rows = [(self.run_id, sim_t, now, m.id, m.state, m.temperature, m.vibration,
                 m.power, m.rpm, m.tool_wear, m.good_count, m.scrap_count) for m in machines]
        self._writer.executemany("INSERT INTO samples VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", rows)
        if events:
            self._writer.executemany(
                "INSERT INTO events VALUES(?,?,?,?,?,?)",
                [(self.run_id, e["t"], now, e["machine"], e["level"], e["text"]) for e in events])
        self._writer.commit()

    # ------------------------------------------------ traceability (MES)
    def unit_write(self, rec: dict, item: dict):
        if self._writer is None:
            self._writer = self._conn()
        self._writer.execute("INSERT INTO units VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                             (self.run_id, rec["sn"], rec.get("wo"), rec["status"], rec.get("start"),
                              rec.get("end"), rec.get("fad"), None, None, None, json.dumps(item)))

    def unit_ship(self, sn: str, so: str, customer: str, t: float):
        if self._writer is None:
            self._writer = self._conn()
        self._writer.execute("UPDATE units SET status='SHIPPED', so=?, customer=?, shipped_t=? "
                             "WHERE run_id=? AND sn=?", (so, customer, t, self.run_id, sn))

    def unit_get(self, sn: str):
        with self._conn() as c:
            r = c.execute("SELECT run_id, sn, wo, status, start_t, end_t, fad, so, customer, data "
                          "FROM units WHERE sn=? ORDER BY rowid DESC LIMIT 1", (sn,)).fetchone()
        if not r:
            return None
        from .mes import _components
        item = json.loads(r[9])
        where = {"SHIPPED": f"Shipped to {r[8]} ({r[7]})", "SCRAPPED": "Scrapped"}.get(r[3], "Finished goods")
        return {"sn": r[1], "status": r[3], "where": where + f" - run {r[0]}", "wo": r[2], "so": r[7],
                "customer": r[8], "fad": r[6], "start": r[4], "end": r[5],
                "route": item.get("route", []), "components": _components(item)}

    def export_csv(self) -> str:
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["run_id", "sim_time_s", "wall_time", "machine", "state", "temperature_c",
                    "vibration_mm_s", "power_kw", "spindle_rpm", "tool_wear_pct",
                    "good_count", "scrap_count"])
        with self._conn() as c:
            for r in c.execute("SELECT * FROM samples WHERE run_id=? ORDER BY sim_t, machine",
                               (self.run_id,)):
                r = list(r)
                r[2] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(r[2]))
                w.writerow(r)
        return buf.getvalue()
