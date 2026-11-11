"""
SCADA - Level 2: tag database, alarm management, operator commands, audit trail, trends and shift report.

    PLC / CNC (simulated machines)  --tags every scan-->  SCADA  --screens, alarms-->  operator
                                    <--commands, set points--

* Tags: one named value per signal ("HMC-02.Temperature"), with PLC address, unit, quality and time stamp.
  PLC addresses and signal types are example values (Siemens style).
* Alarms follow the ISA-18.2 life cycle:
      ACTIVE + not acknowledged -> ACTIVE + acknowledged -> cleared (and acknowledged) -> gone
      ACTIVE + not acknowledged -> CLEARED + not acknowledged (must still be acknowledged)
  An alarm switches ON at value >= limit and OFF only below (limit - deadband), so it does not chatter.
  Alarms can be shelved (hidden for some hours) and commented.
* SCADA alarm limits are SCADA settings. They do not change the machine physics (the machine still breaks at
  its own vibration limit), exactly like a real SCADA.
* Every operator action is written to the audit trail (who, when, what, result).
"""

from __future__ import annotations

from collections import deque

from . import analytics
from .model import DOWN, MAINTENANCE, OFFLINE, RUNNING, STOPPED

SCAN_S = 2.0                 # simulated seconds between two alarm scans
LEVEL_RANK = {"warning": 1, "serious": 2, "critical": 3}
CHATTER_N, CHATTER_S = 3, 600        # 3 activations within 10 min = chattering alarm
STANDING_S = 3600                    # active for more than 1 h = standing alarm
MACHINE_CMDS = ("start", "stop", "maintenance", "set_speed", "inject_bearing_fault")

# historian column for each trendable signal
TREND_COL = {"Temperature": "temperature_c", "Vibration": "vibration_mm_s", "Power": "power_kw",
             "SpindleSpeed": "spindle_rpm", "ToolWear": "tool_wear_pct", "GoodCount": "good", "ScrapCount": "scrap"}
UNITS = {"Temperature": "°C", "Vibration": "mm/s", "Power": "kW", "SpindleSpeed": "rpm", "ToolWear": "%",
         "GoodCount": "pcs", "ScrapCount": "pcs"}
STATE_CODE = {"RUNNING": 0, "SETUP": 1, "STARVED": 2, "BLOCKED": 3, "DOWN": 4, "MAINTENANCE": 5, "STOPPED": 6, "OFFLINE": 7}


class SCADA:
    def __init__(self, factory, config: dict, historian):
        self.f = factory
        self.h = historian
        sc = config.get("scada", {})
        self.db = {"vib": float(sc.get("deadband_vib_mm_s", 0.3)), "temp": float(sc.get("deadband_temp_c", 2.0)),
                   "wear": float(sc.get("deadband_wear_pct", 2.0))}
        # SCADA alarm limits per machine (start values = machine data sheet)
        self.limits = {m.id: {"vib_h": m.vib_warn, "vib_hh": m.vib_alarm, "temp_h": m.temp_limit,
                              "wear_h": 85.0 if m.wear_per_part > 0 else None}
                       for m in factory.machines}
        self.active: dict = {}               # key -> alarm record
        self.journal: deque = deque(maxlen=400)   # every alarm activation (newest last)
        self.audit: deque = deque(maxlen=300)
        self.acts: dict = {}                 # key -> deque of activation times (chattering, bad actors)
        self.count_by_key: dict = {}
        self.total = 0
        self._seq = 0
        self._timer = 0.0
        self.scans = 0

    # ------------------------------------------------------------------ alarm scan (simulation thread)
    def step(self, dt: float):
        self._timer += dt
        if self._timer < SCAN_S:
            return
        self._timer = 0.0
        self.scans += 1
        self._scan()

    def _conditions(self):
        """Yield (key, source, tag, level, text, value, limit, still_on_with_deadband)."""
        for m in self.f.machines:
            L = self.limits[m.id]
            on = lambda k: (m.id + k) in self.active and self.active[m.id + k]["off"] is None
            if m.state == DOWN:
                yield m.id + ".DOWN", m, "State", "critical", f"Breakdown - {m.reason or 'machine stopped'}", m.state, None
            if m.state == OFFLINE:
                yield m.id + ".COMM", m, "State", "warning", "Communication lost - no data from PLC", m.state, None
            v = m.vib_ewma
            if v >= L["vib_hh"] or (on(".VIB_HH") and v >= L["vib_hh"] - self.db["vib"]):
                yield m.id + ".VIB_HH", m, "Vibration", "serious", f"Vibration HIGH-HIGH {v:.2f} mm/s", round(v, 2), L["vib_hh"]
            elif v >= L["vib_h"] or (on(".VIB_H") and v >= L["vib_h"] - self.db["vib"]):
                yield m.id + ".VIB_H", m, "Vibration", "warning", f"Vibration HIGH {v:.2f} mm/s", round(v, 2), L["vib_h"]
            t = m.temperature
            if t >= L["temp_h"] or (on(".TEMP_H") and t >= L["temp_h"] - self.db["temp"]):
                yield m.id + ".TEMP_H", m, "Temperature", "serious", f"Temperature HIGH {t:.1f} °C", round(t, 1), L["temp_h"]
            w = L["wear_h"]
            if w is not None and (m.tool_wear >= w or (on(".WEAR_H") and m.tool_wear >= w - self.db["wear"])):
                yield m.id + ".WEAR_H", m, "ToolWear", "warning", f"Tool wear {m.tool_wear:.0f} % - plan a tool change", round(m.tool_wear, 1), w
        for b in self.f.buffers:
            if b.store and b.count == 0:
                yield b.id + ".EMPTY", b, "Level", "serious", "Stock-out - production will stop", 0, 0
        for a in self.f.handling.agvs:
            if a.battery < 15:
                yield a.id + ".BATT_L", a, "Battery", "warning", f"Battery LOW {a.battery:.0f} %", round(a.battery), 15

    def _scan(self):
        t = self.f.sim_time
        seen = set()
        for key, src, tag, level, text, val, lim in self._conditions():
            seen.add(key)
            a = self.active.get(key)
            if a is None or a["off"] is not None:
                if a is None:
                    self._seq += 1
                    a = {"id": self._seq, "key": key, "src": src.id, "name": getattr(src, "name", src.id),
                         "tag": f"{src.id}.{tag}", "level": level, "text": text, "value": val, "limit": lim,
                         "on": t, "off": None, "ack": False, "ack_by": None, "ack_t": None,
                         "shelved_until": None, "shelved_by": None, "comment": "", "count": 0}
                    self.active[key] = a
                    self.journal.append(a)
                else:                       # came back before it was acknowledged
                    a.update(off=None, on=t, ack=False, ack_by=None, ack_t=None)
                a["count"] += 1
                self.total += 1
                self.count_by_key[key] = self.count_by_key.get(key, 0) + 1
                q = self.acts.setdefault(key, deque(maxlen=20))
                q.append(t)
                self.f.side_events.append({"t": t, "machine": src.id, "level": level, "text": f"SCADA alarm ON: {text}"})
            a.update(text=text, value=val, limit=lim, level=level)
        for key, a in list(self.active.items()):
            if key not in seen and a["off"] is None:
                a["off"] = t
            if a["shelved_until"] is not None and t >= a["shelved_until"]:
                a["shelved_until"] = None
            if a["off"] is not None and a["ack"]:
                del self.active[key]

    # ------------------------------------------------------------------ operator actions (HTTP thread, under lock)
    def _log(self, user, action, target, detail, result):
        self.audit.append({"t": self.f.sim_time, "user": user, "action": action, "target": target,
                           "detail": detail, "result": result})
        return result

    def _find(self, alarm_id):
        for a in self.active.values():
            if a["id"] == alarm_id:
                return a
        raise ValueError(f"alarm {alarm_id} is not active any more")

    def action(self, body: dict) -> str:
        user = (str(body.get("user") or "Operator").strip() or "Operator")[:30]
        a = body.get("action")
        t = self.f.sim_time
        if a == "ack":
            ids = [x["id"] for x in self.active.values() if not x["ack"]] if body.get("id") == "all" else [int(body.get("id", 0))]
            n = 0
            for i in ids:
                al = self._find(i)
                if not al["ack"]:
                    al.update(ack=True, ack_by=user, ack_t=t)
                    n += 1
                    if al["off"] is not None:
                        del self.active[al["key"]]
            return self._log(user, "acknowledge", "all" if body.get("id") == "all" else ids[0], "", f"{n} alarm(s) acknowledged")
        if a == "shelve":
            al = self._find(int(body.get("id", 0)))
            hours = max(0.25, min(24.0, float(body.get("hours", 1))))
            al.update(shelved_until=t + hours * 3600, shelved_by=user)
            reason = str(body.get("reason") or "")[:120]
            if reason:
                al["comment"] = reason
            return self._log(user, "shelve", al["tag"], f"{hours:g} h {reason}".strip(), f"{al['text']} shelved for {hours:g} h")
        if a == "unshelve":
            al = self._find(int(body.get("id", 0)))
            al.update(shelved_until=None, shelved_by=None)
            return self._log(user, "unshelve", al["tag"], "", "alarm visible again")
        if a == "comment":
            al = self._find(int(body.get("id", 0)))
            al["comment"] = str(body.get("text") or "")[:200]
            return self._log(user, "comment", al["tag"], al["comment"], "comment saved")
        if a == "machine":
            m = self.f.by_id.get(body.get("machine"))
            cmd = body.get("cmd")
            if m is None:
                raise ValueError("unknown machine")
            if cmd not in MACHINE_CMDS:
                raise ValueError(f"command must be one of {', '.join(MACHINE_CMDS)}")
            return self._machine(user, m, cmd, body.get("value"))
        if a == "line":
            cmd = body.get("cmd")
            if cmd not in ("start", "stop"):
                raise ValueError("line command must be start or stop")
            ms = [m for m in self.f.machines if m.line == body.get("line")]
            if not ms:
                raise ValueError("unknown line")
            for m in ms:
                self._machine(user, m, cmd, None, log=False)
            return self._log(user, f"line {cmd}", body.get("line"), f"{len(ms)} machines", f"{body.get('line')}: {cmd} sent to {len(ms)} machines")
        if a == "write":
            tag = str(body.get("tag", ""))
            mid, _, name = tag.partition(".")
            m = self.f.by_id.get(mid)
            if m is None or name != "SpeedSetpoint":
                raise ValueError("only <machine>.SpeedSetpoint is writable")
            return self._machine(user, m, "set_speed", body.get("value"))
        if a == "limits":
            mid = body.get("machine")
            if mid not in self.limits:
                raise ValueError("unknown machine")
            L, old, ch = self.limits[mid], dict(self.limits[mid]), []
            for k in ("vib_h", "vib_hh", "temp_h", "wear_h"):
                if body.get(k) not in (None, "") and L.get(k) is not None:
                    v = float(body[k])
                    if v <= 0:
                        raise ValueError(f"{k} must be > 0")
                    L[k] = v
            if L["vib_h"] >= L["vib_hh"]:
                self.limits[mid] = old
                raise ValueError("vibration HIGH must be lower than HIGH-HIGH")
            ch = [f"{k} {old[k]:g} -> {L[k]:g}" for k in L if L[k] is not None and old[k] != L[k]]
            return self._log(user, "alarm limits", mid, ", ".join(ch) or "no change", f"{mid}: limits saved")
        raise ValueError(f"unknown SCADA action {a}")

    def _machine(self, user, m, cmd, value, log=True):
        if m.external:
            raise ValueError(f"{m.id} is a real machine (external): commands go to its own PLC/HMI")
        if cmd == "start" and m.id in getattr(self.f, "estop_machines", ()):
            res = "refused: E-stop is pressed in its PLC - release and reset the E-stop first (interlock)"
        elif cmd == "start" and m.state == DOWN:
            res = "refused: machine is broken down - wait for the repair (interlock)"
        elif cmd == "maintenance" and m.state in (DOWN, MAINTENANCE):
            res = f"refused: machine is already {m.state.lower()}"
        elif cmd == "set_speed":
            if value in (None, ""):
                raise ValueError("speed value missing")
            old = m.speed_pct
            res = m.command("set_speed", value) + f" (was {old:.0f}%)"
        else:
            res = m.command(cmd, value)
        self.f.events.append({"t": self.f.sim_time, "machine": m.id, "level": "info", "text": f"SCADA ({user}): {m.name} {res}"})
        if log:
            self._log(user, cmd.replace("_", " "), m.id, "" if value in (None, "") else f"{value}", f"{m.id}: {res}")
        return f"{m.id}: {res}"

    # ------------------------------------------------------------------ views
    def _tags(self, now):
        out = []
        for i, m in enumerate(self.f.machines):
            q = "Bad - no communication" if m.state == OFFLINE else "Good"
            db, iw = 10 + i, 64 + i * 8
            def tag(name, val, unit, addr, sig, w=False, lim=None):
                out.append({"tag": f"{m.id}.{name}", "src": m.id, "name": name, "value": val, "unit": unit,
                            "addr": addr, "sig": sig, "quality": q, "t": now, "write": w, "lim": lim})
            L = self.limits[m.id]
            tag("State", m.state, "", f"DB{db}.DBW0", f"PLC logic (code {STATE_CODE.get(m.state, 9)})")
            tag("Temperature", round(m.temperature, 1), "°C", f"%IW{iw}", "4-20 mA, 0-150 °C", lim=[L["temp_h"], None])
            tag("Vibration", round(m.vib_ewma, 2), "mm/s", "IO-Link port 1", "IO-Link, raw x 0.1", lim=[L["vib_h"], L["vib_hh"]])
            tag("Power", round(m.power, 1), "kW", "Modbus 40021", "power meter, raw x 0.01")
            if m.nominal_rpm:
                tag("SpindleSpeed", round(m.rpm), "rpm", "CNC var #4119", "CNC")
            if m.wear_per_part > 0:
                tag("ToolWear", round(m.tool_wear, 1), "%", "CNC var #5001", "CNC", lim=[L["wear_h"], None])
            if m.flow is not None:
                tag("AirFlow", round(m.flow, 2), "m³/h", f"%IW{iw + 2}", "4-20 mA, 0-40 m³/h")
                tag("Pressure", round(m.pressure or 0, 2), "bar", f"%IW{iw + 4}", "4-20 mA, 0-16 bar")
            tag("SpeedSetpoint", round(m.speed_pct), "%", f"DB{db}.DBD12", "set point (operator)", w=not m.external)
            tag("GoodCount", m.good_count, "pcs", f"DB{db}.DBD4", "PLC counter")
            tag("ScrapCount", m.scrap_count, "pcs", f"DB{db}.DBD8", "PLC counter")
        for k, b in enumerate(self.f.buffers):
            if b.infinite:
                continue
            out.append({"tag": f"{b.id}.Level", "src": b.id, "name": "Level", "value": b.count, "unit": "pcs",
                        "addr": f"DB90.DBW{k * 2}", "sig": "AS/RS / conveyor PLC", "quality": "Good", "t": now,
                        "write": False, "lim": None})
        for a in self.f.handling.agvs:
            out.append({"tag": f"{a.id}.Battery", "src": a.id, "name": "Battery", "value": round(a.battery), "unit": "%",
                        "addr": "VDA 5050 state", "sig": "MQTT", "quality": "Good", "t": now, "write": False, "lim": [15, None]})
        return out

    def view(self) -> dict:
        f, t = self.f, self.f.sim_time
        hours = max(t / 3600.0, 1e-6)
        alarms = sorted(self.active.values(), key=lambda a: (a["ack"], -LEVEL_RANK[a["level"]], -a["on"]))
        visible = [a for a in alarms if a["shelved_until"] is None]
        last_h = sum(1 for q in self.acts.values() for x in q if x > t - 3600)
        chatter = [k for k, q in self.acts.items() if sum(1 for x in q if x > t - CHATTER_S) >= CHATTER_N]
        standing = [a for a in alarms if a["off"] is None and t - a["on"] > STANDING_S]
        buckets = [0] * 12                                # activations per hour, last 12 h
        for q in self.acts.values():
            for x in q:
                k = int((t - x) // 3600)
                if 0 <= k < 12:
                    buckets[11 - k] += 1
        worst = {}
        for a in visible:
            if a["off"] is None and LEVEL_RANK[a["level"]] > LEVEL_RANK.get(worst.get(a["src"]), 0):
                worst[a["src"]] = a["level"]
        lines = []
        for m in f.machines:
            if not lines or lines[-1]["name"] != m.line:
                lines.append({"name": m.line, "machines": []})
            lines[-1]["machines"].append(m.id)
        machines = []
        report = []
        for m in f.machines:
            oee = analytics.machine_oee(m)
            st = analytics.state_breakdown(m)
            n_al = sum(c for k, c in self.count_by_key.items() if k.startswith(m.id + "."))
            machines.append({"id": m.id, "name": m.name, "line": m.line, "type": m.type, "state": m.state,
                             "reason": m.reason, "speed": round(m.speed_pct), "external": m.external,
                             "temp": round(m.temperature, 1), "vib": round(m.vib_ewma, 2), "power": round(m.power, 1),
                             "rpm": round(m.rpm), "wear": round(m.tool_wear, 1) if m.wear_per_part > 0 else None,
                             "good": m.good_count, "scrap": m.scrap_count, "alarm": worst.get(m.id),
                             "item": (m.item.get("sn") or m.item.get("id")) if m.item else None,
                             "oee": round(oee["oee"], 3), "limits": self.limits[m.id]})
            report.append({"id": m.id, "name": m.name, "good": m.good_count, "scrap": m.scrap_count,
                           "oee": oee["oee"], "availability": oee["availability"], "performance": oee["performance"],
                           "quality": oee["quality"], "run_h": round(st.get("RUNNING", 0) * hours, 2),
                           "down_h": round((st.get("DOWN", 0) + st.get("MAINTENANCE", 0)) * hours, 2),
                           "stop_h": round(st.get("STOPPED", 0) * hours, 2), "alarms": n_al})
        bad = sorted(self.count_by_key.items(), key=lambda kv: -kv[1])[:8]
        return {
            "sim_time": t, "scans": self.scans, "scan_s": SCAN_S, "deadbands": self.db,
            "kpis": {"machines": len(f.machines), "running": sum(1 for m in f.machines if m.state == RUNNING),
                     "stopped": sum(1 for m in f.machines if m.state == STOPPED),
                     "down": sum(1 for m in f.machines if m.state in (DOWN, MAINTENANCE)),
                     "active": sum(1 for a in visible if a["off"] is None),
                     "unack": sum(1 for a in visible if not a["ack"]),
                     "shelved": sum(1 for a in alarms if a["shelved_until"] is not None),
                     "rate_1h": last_h, "rate_avg": round(self.total / hours, 1), "total": self.total,
                     "standing": len(standing), "chattering": len(chatter),
                     "power_kw": round(sum(m.power for m in f.machines), 1), "line_oee": analytics.line_kpis(f)["line_oee"]},
            "lines": lines, "machines": machines,
            "buffers": [{"id": b.id, "name": b.name, "count": b.count, "cap": b.capacity if b.capacity < 10**8 else None,
                         "store": b.store, "finished": b.finished} for b in f.buffers if not b.infinite],
            "agvs": [{"id": a.id, "battery": round(a.battery), "state": a.state} for a in f.handling.agvs],
            "alarms": alarms, "journal": list(self.journal)[-150:][::-1],
            "stats": {"per_hour": buckets, "bad_actors": [{"key": k, "count": c} for k, c in bad],
                      "chattering": chatter, "standing": [a["key"] for a in standing]},
            "audit": list(self.audit)[-150:][::-1],
            "report": report,
            "tags": self._tags(t),
        }

    def trend(self, tags: list, hours: float) -> dict:
        """Read the historian (SQLite) - safe from the HTTP thread (own connection)."""
        t1 = self.f.sim_time
        t0 = max(0.0, t1 - hours * 3600)
        out = []
        with self.h._conn() as c:
            for tg in tags[:4]:
                mid, _, sig = tg.partition(".")
                col = TREND_COL.get(sig)
                if col is None or mid not in self.limits:
                    continue
                rows = c.execute(f"SELECT sim_t, {col} FROM samples WHERE run_id=? AND machine=? AND sim_t>=? ORDER BY sim_t",
                                 (self.h.run_id, mid, t0)).fetchall()
                step = max(1, -(-len(rows) // 300))             # at most 300 points per line
                pts = [[round(r[0]), None if r[1] is None else round(r[1], 3)] for r in rows[::step]]
                L = self.limits[mid]
                lim = {"Temperature": [("HIGH", L["temp_h"])], "Vibration": [("HIGH", L["vib_h"]), ("HIGH-HIGH", L["vib_hh"])],
                       "ToolWear": [("HIGH", L["wear_h"])] if L["wear_h"] else []}.get(sig, [])
                out.append({"tag": tg, "unit": UNITS[sig], "points": pts, "limits": lim})
        return {"t0": t0, "t1": t1, "series": out}
