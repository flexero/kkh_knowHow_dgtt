r"""
PLC layer (ISA-95 level 1) - which PLC controls which station, its live I/O image, and every handshake between
the PLCs and the other real elements of the current factory:

    MES / SCADA ------ OPC UA ------ PLCs ------ PROFINET ------ CNC, robot, drives, remote I/O
                                      |  \----- IO-Link / 4-20 mA --- sensors
                                      |  \----- PROFIsafe ----------- E-stop, light curtain, door switch
                                      |-- PN/PN coupler -- other line PLCs (buffer hand-over)
    AGV fleet manager --- MQTT / VDA 5050 --- AGVs --- optical I/O (E84 style) --- station PLC (docking hand-over)

* One PLC per production line (or per `"plc"` field of a station in the config), one PLC per AS/RS crane.
* The I/O image is calculated from the simulated machine each time it is read (no extra physics).
* Handshakes are detected from what really happens in the twin: a part is clamped, a cycle ends, a buffer level
  changes between two lines, an AGV docks, the crane finishes a job, a machine breaks down, the MES sends a new
  program for a changeover ...
* E-stop is a real command: all stations of that PLC stop and cannot be started (interlock) until it is released.

PLC types, IP addresses, I/O addresses, scan times and device names are EXAMPLE values (Siemens S7-1500 style).
"""

from __future__ import annotations

from collections import deque

from .model import BLOCKED, DOWN, MAINTENANCE, OFFLINE, RUNNING, SETUP, STARVED, STOPPED

FULL = 27648                     # Siemens analog input: 4 mA = 0, 20 mA = 27648
RECENT_S = 60.0                  # a link counts as "active" this long after its last message (sim seconds)

# field devices on the PROFINET / IO-Link network of a station, per station type: (device, protocol, what it does)
DEVICES = {
    "load": [("Operator panel HMI", "PROFINET", "operator confirms 'pallet loaded'"),
             ("RFID reader on the pallet", "IO-Link", "reads the pallet number and the casting model"),
             ("Light curtain + door switch", "PROFIsafe", "safety: stops the pallet shuttle when someone reaches in")],
    "cnc": [("CNC controller (Fanuc 0i / Sinumerik)", "PROFINET", "runs the NC program; PLC sends cycle start, program no."),
            ("Vibration + temperature sensor", "IO-Link", "spindle bearing condition"),
            ("Door interlock", "PROFIsafe", "the door stays locked while the spindle turns")],
    "washer": [("Pump motor VFD", "PROFINET", "washing pump speed"),
               ("Tank temperature", "4-20 mA", "washing water temperature")],
    "robot": [("Robot controller", "PROFINET + PROFIsafe", "robot program number, start, in-position, safe stop"),
              ("Nutrunner (bolting tool)", "PROFINET", "torque and angle of every bolt")],
    "assembly": [("Servo press / screwdriver", "IO-Link", "press force, screw torque"),
                 ("Pick-to-light", "IO-Link", "shows the worker which part to take")],
    "test": [("Flow meter", "4-20 mA", "free air delivery m³/h"),
             ("Pressure transmitter", "4-20 mA", "tank pressure bar"),
             ("Valve terminal", "PROFINET", "test valves open / close")],
    "paint": [("Oven temperature controller", "Modbus TCP", "curing temperature"),
              ("Conveyor VFD", "PROFINET", "hook conveyor speed")],
    "packaging": [("Stretch wrapper", "PROFINET", "wrap program, done signal"),
                  ("Label printer", "TCP/IP", "prints the serial number label")],
}
MOTOR = {"cnc": "Spindle enable", "washer": "Pump motor ON", "robot": "Robot drives ON", "test": "Test valve open",
         "paint": "Conveyor motor ON", "packaging": "Wrapper motor ON", "assembly": "Press enable", "load": "Shuttle motor ON"}


class PLCNet:
    def __init__(self, factory, config: dict):
        f = self.f = factory
        self.plcs: list = []
        self.by_id: dict = {}
        self.of_machine: dict = {}
        groups: list = []
        for m in f.machines:
            key = m.cfg.get("plc") or m.line
            if key not in groups:
                groups.append(key)
        for k, key in enumerate(groups):
            ms = [m for m in f.machines if (m.cfg.get("plc") or m.line) == key]
            safety = any(m.type in ("robot", "load") or m.mag_sets for m in ms)
            pid = key if ms[0].cfg.get("plc") else f"PLC-{k + 1:02d}"
            self._add({"id": pid, "name": ms[0].line if not ms[0].cfg.get("plc") else key, "kind": "line",
                       "model": "S7-1516F (fail-safe CPU)" if safety else "S7-1513-1 PN", "safety": safety,
                       "ip": f"192.168.10.{11 + k}", "machines": [m.id for m in ms]})
            for m in ms:
                self.of_machine[m.id] = pid
        for j, a in enumerate(f.handling.asrs):
            self._add({"id": f"PLC-{a.id}", "name": f"{a.name} - stacker crane", "kind": "asrs", "asrs": a.id,
                       "model": "S7-1515-2 PN", "safety": True, "ip": f"192.168.10.{31 + j}", "machines": []})
        self.asrs_plc = {p["asrs"]: p["id"] for p in self.plcs if p["kind"] == "asrs"}

        # who owns a buffer (the PLC that sees its sensors): AS/RS crane, else the consuming line, else the producer
        prod, cons = {}, {}
        for m in f.machines:
            if m.output is not None:
                prod.setdefault(m.output.id, set()).add(self.of_machine[m.id])
            bufs = [b for b, _ in m.inputs] + [b for alt in m.alts.values() for b in alt.values()]
            for b in bufs:
                cons.setdefault(b.id, set()).add(self.of_machine[m.id])
        self.owner = {}
        for b in f.buffers:
            a = next((x for x in f.handling.asrs if b in x.buffers), None)
            self.owner[b.id] = (self.asrs_plc.get(a.id) if a else None) or next(iter(sorted(cons.get(b.id, []))), None) \
                or next(iter(sorted(prod.get(b.id, []))), None)
        # buffers between two different line PLCs -> PLC-to-PLC hand-over
        self.couplings = []
        for b in f.buffers:
            for p in sorted(prod.get(b.id, [])):
                for c in sorted(cons.get(b.id, [])):
                    if p != c:
                        self.couplings.append({"buffer": b.id, "name": b.name, "from": p, "to": c})
        self.estop = {p["id"]: False for p in self.plcs}
        f.estop_machines = set()                         # read by SCADA (start interlock)
        self.msgs: deque = deque(maxlen=400)
        self.links: dict = {}
        self.seq = 0
        self.opc = {p["id"]: 0.0 for p in self.plcs}     # OPC UA values published to SCADA (counted only)
        self.prev = {m.id: {"state": m.state, "has": m.has_part, "total": m.total_count} for m in f.machines}
        self.prev_buf = {c["buffer"]: f.buf_by_id[c["buffer"]].count for c in self.couplings}
        self.prev_asrs = {a.id: (a.stores, a.retrievals) for a in f.handling.asrs}
        self.prev_agv = {v.id: v.state for v in f.handling.agvs}

    def _add(self, p):
        self.plcs.append(p)
        self.by_id[p["id"]] = p

    # ------------------------------------------------------------------ message log
    def _msg(self, src, dst, proto, kind, text, data=None, plc=None):
        self.seq += 1
        t = self.f.sim_time
        self.msgs.append({"n": self.seq, "t": round(t, 1), "src": src, "dst": dst, "proto": proto, "kind": kind,
                          "text": text, "data": data or {}, "plc": plc})
        a, b = self._node(src), self._node(dst)
        key = "|".join(sorted((a, b))) + "|" + proto
        L = self.links.setdefault(key, {"a": a, "b": b, "proto": proto, "n": 0, "last": None})
        L["n"] += 1
        L["last"] = t

    @staticmethod
    def _node(x):
        return "AGVS" if str(x).startswith("AGV-") else x

    @staticmethod
    def _sn(m):
        it = m.item or {}
        return it.get("sn") or it.get("id") or "part"

    def _prog(self, m, v=None):
        v = v or m.cur_v or m.setup_v or ""
        i = self.f.machines.index(m) + 1
        digits = "".join(ch for ch in str(v) if ch.isdigit())[:2] or "00"
        return f"O{i:02d}{digits}"

    # ------------------------------------------------------------------ simulation thread
    def step(self, dt: float):
        f = self.f
        for p in self.plcs:
            self.opc[p["id"]] += dt * (8 * len(p["machines"]) + (6 if p["kind"] == "asrs" else 0))
        for m in f.machines:
            pid = self.of_machine[m.id]
            pv = self.prev[m.id]
            if self.estop[pid] and not m.external and m.state not in (STOPPED, DOWN):
                m.command("stop")
                m.reason = f"E-stop pressed ({pid})"
            st = m.state
            if st == SETUP and pv["state"] != SETUP:
                self._msg("MES", pid, "OPC UA", "Recipe",
                          f"Changeover {m.id} to {m.cur_v}: download NC program {self._prog(m)} and tool list",
                          {"node": f"ns=3;s={m.id}.Recipe.ProgramNo", "value": self._prog(m), "method": "LoadRecipe"}, pid)
                if m.type == "cnc":
                    self._msg(pid, m.id, "PROFINET", "Program select",
                              f"PLC selects program {self._prog(m)} in the CNC (model {m.cur_v})",
                              {"DB": f"DB{20 + self.f.machines.index(m)}.ProgNo", "value": self._prog(m)}, pid)
            finished = m.total_count > pv["total"]
            if finished:
                good = m.part_done or (m.item is not None)
                if m.type == "cnc":
                    self._msg(m.id, pid, "PROFINET", "Cycle end",
                              f"CNC reports M30 - cycle complete ({m.last_cycle_s:.0f} s), spindle stopped",
                              {"I": "CycleDone=1, InCycle=0", "M": "M30"}, pid)
                self._msg(pid, "MES", "OPC UA", "Part done",
                          f"{m.id}: part finished, {'good' if good else 'scrap'}, cycle {m.last_cycle_s:.0f} s",
                          {"node": f"ns=3;s={m.id}.Counters", "GoodCount": m.good_count, "ScrapCount": m.scrap_count}, pid)
            # a new part: clamped now, or (pallet changer) the next part was loaded in the same step
            if m.has_part and (not pv["has"] or (finished and not m.part_done)):
                if m.type == "cnc":
                    self._msg(pid, m.id, "PROFINET", "Cycle start",
                              f"Part {self._sn(m)} clamped, door closed -> CYCLE START program {self._prog(m)}",
                              {"Q": "CycleStart=1", "ProgNo": self._prog(m), "check": "DoorClosed=1, Clamped=1, Fault=0"}, pid)
                elif m.type == "robot":
                    self._msg(pid, m.id, "PROFINET", "Robot start",
                              f"Pump {self._sn(m)} in position -> robot program 'bolt heads' start",
                              {"Q": "PgNo=12, Start=1", "safety": "PROFIsafe zone free"}, pid)
                else:
                    self._msg(pid, m.id, "PROFINET", "Start", f"{m.name}: part {self._sn(m)} present -> start",
                              {"Q": f"{MOTOR.get(m.type, 'Motor ON')}=1"}, pid)
            if st == DOWN and pv["state"] != DOWN:
                self._msg(m.id, pid, "PROFINET", "Fault", f"{m.name}: fault - {m.reason}", {"I": "Fault=1"}, pid)
                self._msg(pid, "SCADA", "OPC UA", "Alarm", f"Alarm {m.id}: {m.reason}",
                          {"node": f"ns=3;s={m.id}.Alarm", "event": "AlarmConditionType", "severity": 900}, pid)
            if pv["state"] in (DOWN, MAINTENANCE) and st not in (DOWN, MAINTENANCE):
                self._msg(pid, "SCADA", "OPC UA", "Alarm cleared", f"{m.id} back in service - fault reset",
                          {"node": f"ns=3;s={m.id}.Alarm", "ActiveState": False}, pid)
            pv.update(state=st, has=m.has_part, total=m.total_count)
        f.estop_machines = {mid for p in self.plcs if self.estop[p["id"]] for mid in p["machines"]}

        for c in self.couplings:
            b = f.buf_by_id[c["buffer"]]
            old, new = self.prev_buf[c["buffer"]], b.count
            if new > old:
                self._msg(c["from"], c["to"], "PN/PN coupler", "Part ready",
                          f"{b.name}: {old} -> {new} parts. '{c['from']}' tells '{c['to']}': part ready for you",
                          {"area": f"Coupler output byte {c['buffer']}", "PartReady": 1, "Level": new}, c["from"])
            elif new < old:
                self._msg(c["to"], c["from"], "PN/PN coupler", "Part taken",
                          f"{b.name}: {old} -> {new} parts. '{c['to']}' tells '{c['from']}': part taken, place free",
                          {"area": f"Coupler output byte {c['buffer']}", "PartTaken": 1, "Level": new}, c["to"])
            self.prev_buf[c["buffer"]] = new

        for a in f.handling.asrs:
            s0, r0 = self.prev_asrs[a.id]
            pid = self.asrs_plc[a.id]
            if a.stores > s0:
                self._msg(pid, "FLEET", "OPC UA", "Stored", f"{a.name}: load stored in the rack (crane job done)",
                          {"node": f"ns=4;s={a.id}.Job.Done", "kind": "store"}, pid)
            if a.retrievals > r0:
                self._msg(pid, "FLEET", "OPC UA", "Load ready", f"{a.name}: load retrieved, waiting on the I/O conveyor",
                          {"node": f"ns=4;s={a.id}.IO.LoadReady", "value": True}, pid)
            self.prev_asrs[a.id] = (a.stores, a.retrievals)

        for v in f.handling.agvs:
            old, st = self.prev_agv[v.id], v.state
            if st != old:
                tr = v.task["tr"] if v.task else None
                if st == "TO_PICKUP" and tr:
                    self._msg("FLEET", v.id, "MQTT / VDA 5050", "Order", f"{v.id}: drive order '{tr.name}'",
                              {"topic": f"uagv/v2/plant/{v.id}/order", "nodes": [tr.src.id, tr.dst.id]})
                elif st == "WAIT_CRANE" and tr:
                    self._msg(v.id, self.owner.get(tr.src.id) or "FLEET", "Optical I/O (E84 style)", "Wait",
                              f"{v.id} docked at {tr.src.name}: crane still busy - station answers BUSY",
                              {"AGV": "TR_REQ=1", "Station": "READY=0"}, self.owner.get(tr.src.id))
                elif st in ("LOADING", "UNLOADING") and tr:
                    buf = tr.src if st == "LOADING" else tr.dst
                    own = self.owner.get(buf.id) or "FLEET"
                    self._msg(v.id, own, "Optical I/O (E84 style)", "Hand-over",
                              f"{v.id} {'loads at' if st == 'LOADING' else 'unloads at'} {buf.name}: TR_REQ -> READY -> BUSY -> COMPT",
                              {"AGV": "TR_REQ=1, BUSY=1, COMPT=1", "Station": "L_REQ/U_REQ=1, READY=1"}, own if own.startswith("PLC") else None)
                elif st == "TO_CHARGE":
                    self._msg(v.id, "FLEET", "MQTT / VDA 5050", "State", f"{v.id}: battery {v.battery:.0f} % -> drives to charger",
                              {"topic": f"uagv/v2/plant/{v.id}/state", "batteryCharge": round(v.battery)})
                self.prev_agv[v.id] = st

    # ------------------------------------------------------------------ commands (HTTP thread, under engine lock)
    def action(self, body: dict) -> str:
        a = body.get("action")
        pid = body.get("plc")
        p = self.by_id.get(pid)
        if p is None:
            raise ValueError("unknown PLC")
        if a == "estop":
            on = bool(body.get("on"))
            if p["kind"] != "line":
                raise ValueError("E-stop of the crane PLC is not simulated - only line PLCs")
            if on == self.estop[pid]:
                return f"{pid}: E-stop already {'pressed' if on else 'released'}"
            self.estop[pid] = on
            user = (str(body.get("user") or "Operator").strip() or "Operator")[:30]
            for mid in p["machines"]:
                m = self.f.by_id[mid]
                if m.external:
                    continue
                if on:
                    m.command("stop")
                    m.reason = f"E-stop pressed ({pid})"
                elif m.state == STOPPED:
                    m.command("start")
            self.f.estop_machines = {mid for q in self.plcs if self.estop[q["id"]] for mid in q["machines"]}
            self._msg("Safety", pid, "PROFIsafe", "E-stop" if on else "Reset",
                      f"E-stop {'PRESSED' if on else 'released + reset'} ({user}) - {len(p['machines'])} stations {'stop' if on else 'restart'}",
                      {"F-DI": f"EStop_OK={0 if on else 1}", "F-DQ": f"DrivesEnable={0 if on else 1}"}, pid)
            self._msg(pid, "SCADA", "OPC UA", "Alarm", f"{pid}: emergency stop {'active' if on else 'cleared'}",
                      {"node": f"ns=3;s={pid}.Safety.EStop", "value": on}, pid)
            self.f.events.append({"t": self.f.sim_time, "machine": pid, "level": "critical" if on else "info",
                                  "text": f"{pid} ({p['name']}): E-stop {'pressed' if on else 'released'} by {user}"})
            return f"{pid}: E-stop {'pressed - all stations stopped' if on else 'released - stations restarted'}"
        raise ValueError(f"unknown PLC action {a}")

    # ------------------------------------------------------------------ view
    def _io(self, m, k, pid):
        """I/O image of one station (k = its slot in the PLC)."""
        st = m.state
        out_free = m.output.can_put() if m.output is not None else True
        di = [("DoorClosed", st not in (DOWN, MAINTENANCE), "door switch (PROFIsafe)"),
              ("PartPresent", m.has_part, "proximity sensor"),
              ("Clamped", m.has_part and st == RUNNING, "clamp pressure switch"),
              ("CycleDone", m.part_done or st == BLOCKED, "from CNC / station"),
              ("Fault", st == DOWN, "from CNC / drive"),
              ("EStopOK", not self.estop[pid], "E-stop circuit (F-DI)"),
              ("AutoMode", st not in (STOPPED, MAINTENANCE), "key switch AUTO"),
              ("OutputFree", out_free, "place free in the next buffer")]
        dq = [("CycleStart", st == RUNNING, "to CNC / station"),
              ("Unclamp", m.part_done and out_free, "clamp valve: release the finished part"),
              ("LampGreen", st == RUNNING, "stack light"),
              ("LampYellow", st in (STARVED, BLOCKED, SETUP, STOPPED), "stack light"),
              ("LampRed", st in (DOWN, MAINTENANCE) or self.estop[pid], "stack light"),
              ("Motor", st == RUNNING, MOTOR.get(m.type, "motor contactor"))]
        rows = []
        for j, (sym, val, note) in enumerate(di):
            rows.append({"addr": f"%I{k}.{j}", "sym": sym, "type": "DI", "value": bool(val), "note": note})
        for j, (sym, val, note) in enumerate(dq):
            rows.append({"addr": f"%Q{k}.{j}", "sym": sym, "type": "DQ", "value": bool(val), "note": note})
        w = 64 + 16 * k
        tmp = max(0.0, min(150.0, m.temperature))
        rows.append({"addr": f"%IW{w}", "sym": "Temperature", "type": "AI", "value": round(m.temperature, 1), "unit": "°C",
                     "raw": round(tmp / 150 * FULL), "note": f"4-20 mA = {4 + 16 * tmp / 150:.2f} mA (0-150 °C)"})
        rows.append({"addr": "IO-Link port 1", "sym": "Vibration", "type": "AI", "value": round(m.vib_ewma, 2), "unit": "mm/s",
                     "raw": round(m.vib_ewma * 10), "note": "IO-Link process data, raw × 0.1"})
        rows.append({"addr": f"%IW{w + 2}", "sym": "Power", "type": "AI", "value": round(m.power, 1), "unit": "kW",
                     "raw": round(m.power * 100), "note": "power meter, raw × 0.01"})
        if m.nominal_rpm:
            rows.append({"addr": "CNC / drive", "sym": "SpindleSpeed", "type": "AI", "value": round(m.rpm), "unit": "rpm",
                         "raw": round(m.rpm), "note": "from the spindle drive"})
        if m.flow is not None:
            rows.append({"addr": f"%IW{w + 4}", "sym": "AirFlow", "type": "AI", "value": round(m.flow, 2), "unit": "m³/h",
                         "raw": round(min(40.0, m.flow) / 40 * FULL), "note": "4-20 mA, 0-40 m³/h"})
            rows.append({"addr": f"%IW{w + 6}", "sym": "Pressure", "type": "AI", "value": round(m.pressure or 0, 2), "unit": "bar",
                         "raw": round(min(16.0, m.pressure or 0) / 16 * FULL), "note": "4-20 mA, 0-16 bar"})
        rows.append({"addr": f"DB{20 + k}.DBW0", "sym": "ProgramNo", "type": "DB", "value": self._prog(m) if m.cur_v or m.setup_v else "-",
                     "note": "program / recipe from the MES"})
        rows.append({"addr": f"DB{20 + k}.DBD4", "sym": "GoodCount", "type": "DB", "value": m.good_count, "note": "part counter"})
        return rows

    def view(self) -> dict:
        f, t = self.f, self.f.sim_time
        plcs = []
        for p in self.plcs:
            ms = [f.by_id[i] for i in p["machines"]]
            stations = []
            for k, m in enumerate(ms):
                stations.append({"id": m.id, "name": m.name, "type": m.type, "state": m.state, "reason": m.reason,
                                 "external": m.external, "model": m.cur_v if m.has_part else None,
                                 "devices": [{"name": d, "proto": pr, "use": u} for d, pr, u in DEVICES.get(m.type, [])],
                                 "io": self._io(m, k, p["id"])})
            asrs = None
            if p["kind"] == "asrs":
                a = f.handling.asrs_by_id[p["asrs"]]
                asrs = {"busy": a.cur is not None, "job": a.cur["label"] if a.cur else "", "queue": len(a.jobs),
                        "io_waiting": a.io_waiting(), "target": a.target, "stores": a.stores, "retrievals": a.retrievals,
                        "io": [{"addr": "%I0.0", "sym": "CraneHome", "type": "DI", "value": a.cur is None, "note": "position switch"},
                               {"addr": "%I0.1", "sym": "LoadOnIO", "type": "DI", "value": a.io_waiting() > 0, "note": "photo eye I/O conveyor"},
                               {"addr": "%I0.2", "sym": "EStopOK", "type": "DI", "value": True, "note": "E-stop circuit (F-DI)"},
                               {"addr": "%Q0.0", "sym": "TravelDrive", "type": "DQ", "value": a.cur is not None, "note": "travel axis enable"},
                               {"addr": "%Q0.1", "sym": "Fork", "type": "DQ", "value": a.cur is not None and a.timer < a.cycle * 0.3, "note": "telescopic fork"},
                               {"addr": "%IW64", "sym": "Bay", "type": "AI", "value": a.target[0], "unit": "bay", "raw": a.target[0] * 1400, "note": "laser distance (mm)"},
                               {"addr": "%IW66", "sym": "Level", "type": "AI", "value": a.target[1], "unit": "level", "raw": a.target[1] * 900, "note": "lift encoder (mm)"},
                               {"addr": "DB30.DBD0", "sym": "Jobs done", "type": "DB", "value": a.stores + a.retrievals, "note": "store + retrieve"}]}
            n_io = sum(len(s["io"]) for s in stations) + (len(asrs["io"]) if asrs else 0)
            fault = any(m.state == DOWN for m in ms)
            scan = round(1.5 + 0.035 * n_io + (0.4 if p["safety"] else 0), 1)
            plcs.append({**{k: p[k] for k in ("id", "name", "kind", "model", "safety", "ip", "machines")},
                         "estop": self.estop[p["id"]], "fault": fault, "run": True,
                         "scan_ms": scan, "cpu_load": min(95, round(scan / 10 * 100 * 0.45)), "io_points": n_io,
                         "opc_values": int(self.opc[p["id"]]),
                         "msgs": sum(1 for x in self.msgs if x["plc"] == p["id"]),
                         "stations": stations, "asrs": asrs})
        links = []
        for L in self.links.values():
            links.append({**L, "active": L["last"] is not None and t - L["last"] < RECENT_S})
        for p in self.plcs:
            links.append({"a": p["id"], "b": "SCADA", "proto": "OPC UA (subscription)", "n": int(self.opc[p["id"]]),
                          "last": t, "active": True, "cyclic": True})
        agvs = [{"id": v.id, "state": v.state, "battery": round(v.battery), "task": v.task["tr"].name if v.task else ""}
                for v in f.handling.agvs]
        recent = [x for x in self.msgs if x["t"] > t - 600]
        return {"sim_time": t, "plcs": plcs, "links": links, "couplings": self.couplings, "agvs": agvs,
                "owner": self.owner, "messages": list(self.msgs)[-200:][::-1],
                "kpis": {"plcs": len(self.plcs), "io": sum(p["io_points"] for p in plcs),
                         "stations": len(f.machines), "per_min": round(len(recent) / 10, 1),
                         "plc_plc": sum(L["n"] for L in self.links.values() if L["proto"] == "PN/PN coupler"),
                         "handovers": sum(L["n"] for L in self.links.values() if L["proto"].startswith("Optical")),
                         "estops": sum(1 for v in self.estop.values() if v),
                         "faults": sum(1 for p in plcs if p["fault"])}}
