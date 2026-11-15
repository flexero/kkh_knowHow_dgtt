#!/usr/bin/env python3
"""Final thesis item F3 - virtual stacker crane ASRS-RAW (one aisle, zones KIT + RAW) for virtual commissioning.

The model MIRRORS plc/asrs_crane.scl (FB_Crane + FB_AsrsType): same states, same detail codes, same interlocks, same
job sequences. Motion times use the trapezoid profiles and the fork / positioning times of design F3
(out/design_result.json), so cycle times can be compared with FEM 9.851.

Two faces:
  CraneModel   pure state machine with a simulated clock (fast, deterministic) - throughput and logic tests
  CraneDevice  the model behind a Modbus TCP server with register map V1.2b (fmsctl/spec/regmap.py), built on
               fmsctl.sim.virtual_plant.Device (same toggle-bit handshake, sequence guard, gateway watchdog, event block,
               job result block). The fmsctl logistics manager / DeviceLink talk to it unchanged.

Commands
  python asrs_sim.py selftest            all tests (logic + Modbus handshake + cycle times + throughput)
  python asrs_sim.py serve [--port 15051] [--speed 20]   run the virtual crane for the WMS / a PLC test
  python asrs_sim.py diagram             write out/plc_state_machine.svg
Python standard library only.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, ROOT)

# ----------------------------------------------------------------------------- constants = FB_Crane / FC_AsrsCoord
OFF, HOMING, IDLE, MOVE_TO_SOURCE, PICK, MOVE_TO_DEST, PUT, RETURN, FAULT, MANUAL, MAINTENANCE = range(11)
STATE_NAME = ["OFF", "HOMING", "IDLE", "MOVE_TO_SOURCE", "PICK", "MOVE_TO_DEST", "PUT", "RETURN", "FAULT", "MANUAL", "MAINTENANCE"]
DETAIL = {0: "OK", 11: "position out of range", 12: "command not possible (fork loaded / src = dst)",
          21: "destination occupied (double occupancy)", 22: "source empty", 23: "contour check failed at the infeed",
          24: "I/O point not ready", 31: "safety stop (door / e-stop)", 32: "axis fault", 33: "fork fault / load lost"}
NCOL, NLEV = 38, 10
X_RACK0, UPRIGHT, BAY, FIRST, PITCH2, Z1, PITCH = 1.2, 0.1, 1.925, 0.475, 0.875, 0.45, 1.25
LIFT, Z_IO, X_IO, X_MAINT, Z_MAINT = 0.15, 0.70, 0.0, 0.0, 0.45
KIT_COLS = range(1, 11)          # zone KIT near the I/O point (200 positions), RAW = columns 11 - 38 (560)


def coord(col, level, side):
    """FC_AsrsCoord: returns (ok, x, z)."""
    if not (1 <= col <= NCOL and 1 <= level <= NLEV and side in (1, 2)):
        return False, 0.0, 0.0
    bay = (col + 1) // 2
    k = (col - 1) % 2
    return True, X_RACK0 + UPRIGHT + (bay - 1) * BAY + FIRST + k * PITCH2, Z1 + (level - 1) * PITCH


def zone(col):
    return "KIT" if col in KIT_COLS else "RAW"


def trap(d, v, a):
    if d <= 0:
        return 0.0
    return d / v + v / a if d >= v * v / a else 2 * math.sqrt(d / a)


def load_design(path=os.path.join(HERE, "out", "design_result.json")):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# ----------------------------------------------------------------------------- the mirror model
class CraneModel:
    def __init__(self, design=None):
        d = design or load_design()
        c = d["crane"]["input"]
        self.v_x, self.a_x, self.v_z, self.a_z = c["v_x"], c["a_x"], c["v_z"], c["a_z"]
        self.v_f, self.a_f, self.stroke, self.t_pos, self.t_dead = c["v_f"], c["a_f"], c["fork_stroke_m"], c["t_pos_s"], c["t_dead_s"]
        self.design_sc, self.design_dc = d["crane"]["fem"]["SC"], d["crane"]["fem"]["DC"]
        self.lock = threading.RLock()
        # inputs (as the PLC sees them)
        self.safety_ok = self.door_closed = self.drives_ready = True
        self.auto, self.manual, self.maint = True, False, False
        self.infeed_load, self.infeed_contour_ok, self.outfeed_free = False, True, True
        # plant truth
        self.occ = {(c_, l, s): 0 for c_ in range(1, NCOL + 1) for l in range(1, NLEV + 1) for s in (1, 2)}
        self.fork_crate = 0
        self.infeed_crate = 0
        self.outfeed_crate = 0
        self.x, self.z = X_IO, Z_IO - LIFT
        # state
        self.state, self.step, self.detail = OFF, 0, 0
        self.t = 0.0
        self.job = None
        self.job_active = False
        self.remaining = 0.0          # time left of the current motion segment
        self.events = []              # (t, kind, data)
        self.busy_time = 0.0
        self.cycle_start = None
        self.last_cycle = None        # job start -> RETURN finished (single-cycle time)

    # ---- helpers
    @property
    def load_on_fork(self):
        return self.fork_crate != 0

    def interlock_ok(self):
        return self.safety_ok and self.door_closed and self.drives_ready

    def move_time(self, x, z):
        return max(trap(abs(x - self.x), self.v_x, self.a_x), trap(abs(z - self.z), self.v_z, self.a_z)) + self.t_pos

    def fork_out_in(self):
        return trap(self.stroke, self.v_f, self.a_f)

    def lift_time(self):
        return trap(LIFT, 0.2, self.a_z)

    def ready(self):
        with self.lock:
            return self.state in (IDLE, RETURN) and self.auto and not self.manual and not self.maint and not self.job_active

    # ---- FB_AsrsType.TypeCheck (+ readiness of FB_FmsIf_V12)
    def check(self, code, p):
        """p: dict with dst (col, level, side), src (col, level, side). Returns (hs_result, detail)."""
        with self.lock:
            if code not in (30, 31, 32, 33):
                return 1, 0
            if not self.ready():
                return 2, 0
            okd = coord(*p.get("dst", (0, 0, 0)))[0]
            if code == 30:
                if not okd:
                    return 3, 11
                if not self.load_on_fork and not (self.infeed_load and self.infeed_contour_ok):
                    return 2, 24
            elif code == 31:
                if not okd:
                    return 3, 11
                if self.load_on_fork:
                    return 3, 12
            elif code == 32:
                oks = coord(*p.get("src", (0, 0, 0)))[0]
                if not okd or not oks:
                    return 3, 11
                if tuple(p["src"]) == tuple(p["dst"]) or self.load_on_fork:
                    return 3, 12
            return 0, 0

    def start_job(self, code, p, job_id=0):
        """Called after an accepted command (FB_FmsIf_V12.NewJob -> ASRS_LINK.jobReq)."""
        with self.lock:
            j = {"code": code, "id": job_id, "dst": tuple(p.get("dst", (0, 0, 0))), "src": tuple(p.get("src", (0, 0, 0))),
                 "crate": p.get("crate", 0)}
            if code == 31:
                j["src"] = j["dst"]
            j["srcIsIO"] = code == 30
            j["dstIsIO"] = code == 31
            j["skipPick"] = (code == 30 and self.load_on_fork) or code == 33
            self.job, self.job_active, self.detail = j, True, 0
            self.state = MOVE_TO_DEST if j["skipPick"] else MOVE_TO_SOURCE
            self.step, self.remaining = 0, 0.0
            self.cycle_start = self.t
            self.events.append((self.t, "job_start", job_id))

    def ack(self):
        with self.lock:
            if self.state == FAULT and self.interlock_ok():
                self.detail = 0
                self.state, self.step = HOMING, 0

    def _end_job(self, result, detail):
        self.events.append((self.t, "job_end", (self.job["id"] if self.job else 0, result, detail)))
        self.job_active = False

    def _abort(self, detail):
        if self.job_active:
            self._end_job(2, detail)
        self.detail = detail
        self.state = FAULT
        self.step = 0
        self.remaining = 0.0

    # ---- one simulation step
    def advance(self, dt):
        with self.lock:
            t_end = self.t + dt
            while self.t < t_end - 1e-12:
                # global interlocks (every state except OFF / FAULT / MAINTENANCE)
                if not self.interlock_ok() and self.state not in (OFF, FAULT, MAINTENANCE):
                    self._abort(31)
                    continue
                if self.remaining > 0:
                    h = min(self.remaining, t_end - self.t)
                    self.remaining -= h
                    self.t += h
                    if self.state in (MOVE_TO_SOURCE, PICK, MOVE_TO_DEST, PUT, RETURN):
                        self.busy_time += h
                    if self.remaining > 1e-12:
                        continue
                    self.remaining = 0.0
                    self._segment_done()
                    continue
                if not self._logic():           # nothing to do -> idle until the end of dt
                    self.t = t_end

    def _seg(self, seconds, x=None, z=None):
        """Start a motion segment; position is set at its end (in _segment_done)."""
        self.remaining = max(seconds, 1e-9)
        self._target = (x, z)

    def _segment_done(self):
        x, z = getattr(self, "_target", (None, None))
        if x is not None:
            self.x = x
        if z is not None:
            self.z = z
        self._target = (None, None)
        self.step += 10                          # segment steps are 10, 20, 30 ... (like the SCL step numbers)

    def _logic(self):
        """Executes one transition; returns False if the model waits for something."""
        s, j = self.state, self.job
        if s == OFF:
            if self.interlock_ok():
                self.state, self.step = HOMING, 0
                return True
            return False
        if s == HOMING:
            if self.step == 0:                   # plausibility check of the absolute sensors + fork to centre
                self._seg(self.t_dead)
                return True
            self.state, self.step, self.detail = IDLE, 0, 0
            return True
        if s in (IDLE, RETURN):
            if self.manual:
                self.state = MANUAL
                return True
            if self.maint:
                self.state = MAINTENANCE
                return True
            if s == RETURN:
                if self.step == 0:
                    self._seg(self.move_time(X_IO, Z_IO - LIFT), X_IO, Z_IO - LIFT)
                    return True
                self.state, self.step = IDLE, 0
                if self.cycle_start is not None:
                    self.last_cycle = self.t - self.cycle_start
                    self.cycle_start = None
                return True
            return False
        if s == MOVE_TO_SOURCE:
            if self.step == 0:
                if j["srcIsIO"]:
                    x, z = X_IO, Z_IO - LIFT
                else:
                    _, x, z = coord(*j["src"])
                    z -= LIFT
                self._seg(self.move_time(x, z), x, z)
                return True
            self.state, self.step = PICK, 0
            return True
        if s == PICK:
            if self.step == 0:
                if j["srcIsIO"]:
                    if not self.infeed_load:
                        self._abort(24)
                        return True
                    if not self.infeed_contour_ok:
                        self._abort(23)
                        return True
                elif self.occ[j["src"]] == 0:
                    self._abort(22)              # source empty (look-ahead sensor)
                    return True
                self._seg(self.fork_out_in())    # fork out (step -> 10)
                return True
            if self.step == 10:
                self._seg(self.lift_time(), None, self.z + LIFT)   # lift (step -> 20)
                if j["srcIsIO"]:
                    self.fork_crate, self.infeed_crate, self.infeed_load = self.infeed_crate or 1, 0, False
                else:
                    self.fork_crate, self.occ[j["src"]] = self.occ[j["src"]], 0
                return True
            if self.step == 20:
                self._seg(self.fork_out_in() + self.t_dead)        # fork in + check (step -> 30)
                return True
            if not self.load_on_fork:
                self._abort(33)
                return True
            self.state, self.step = MOVE_TO_DEST, 0
            return True
        if s == MOVE_TO_DEST:
            if self.step == 0:
                if j["code"] == 33:
                    x, z = X_MAINT, Z_MAINT
                elif j["dstIsIO"]:
                    x, z = X_IO, Z_IO
                else:
                    _, x, z = coord(*j["dst"])
                self._seg(self.move_time(x, z), x, z)
                return True
            if j["code"] == 33:
                self._end_job(0, 0)
                self.state, self.step = IDLE, 0
                self.cycle_start = None
                return True
            self.state, self.step = PUT, 0
            return True
        if s == PUT:
            if self.step == 0:
                if j["dstIsIO"]:
                    if not self.outfeed_free:
                        return False             # waits (the PLC times out after 60 s with detail 24)
                elif self.occ[j["dst"]] != 0:
                    self._abort(21)              # DOUBLE OCCUPANCY - load stays on the fork
                    return True
                self._seg(self.fork_out_in())
                return True
            if self.step == 10:
                self._seg(self.lift_time(), None, self.z - LIFT)
                if j["dstIsIO"]:
                    self.outfeed_crate, self.outfeed_free = self.fork_crate, False
                else:
                    self.occ[j["dst"]] = self.fork_crate
                self.fork_crate = 0
                return True
            if self.step == 20:
                self._seg(self.fork_out_in() + self.t_dead)
                return True
            self._end_job(0, 0)
            self.state, self.step = RETURN, 0
            return True
        if s == FAULT:
            return False
        if s == MANUAL:
            if not self.manual:
                self.state, self.step = HOMING, 0
                return True
            return False
        if s == MAINTENANCE:
            if not self.maint:
                self.state = OFF
                return True
            return False
        return False

    def col_level(self):
        col = 0 if self.x <= 1.3 else max(1, min(NCOL, int(round((self.x - 1.3 - 0.475) / 1.925 * 2 + 1))))
        lev = 0 if self.z <= 0.3 else min(NLEV, int((self.z - 0.45) / 1.25) + 1)
        return col, lev

    def run_until_idle(self, limit=600.0, dt=0.05):
        t0 = self.t
        while self.t - t0 < limit:
            self.advance(dt)
            if self.state in (IDLE, FAULT) and not self.job_active:
                return True
        return False


# ----------------------------------------------------------------------------- Modbus face (register map V1.2b)
def make_device(model, host="127.0.0.1", port=15051, speed=20.0):
    from fmsctl.sim import virtual_plant as VP

    class CraneDevice(VP.Device):
        """virtual_plant.Device (handshake, sequence guard, watchdog, events) + the mirror model."""

        def __init__(self):
            self.model = model
            self._done = threading.Event()
            self._end = None
            info = {"id": "ASRS-RAW", "type": "ASRS", "unit": 1, "host": host, "port": port}
            shared = {"lock": threading.RLock(), "sync": lambda: None}
            super().__init__(info, None, speed, shared, random.Random(1))
            threading.Thread(target=self._monitor, daemon=True).start()

        def _params(self):
            return {"dst": (self.get("loc.bay"), self.get("loc.level"), self.get("loc.side")),
                    "src": (self.get("src.bay"), self.get("src.level"), self.get("src.side")),
                    "crate": self.get("crate.id")}

        def validate(self, code):
            res, det = self.model.check(code, self._params())
            self.set("asrs.detail", det)
            return res

        def on_write(self, addr, vals):
            new_ack = False
            if addr <= 202 < addr + len(vals):
                req = self.get("cmd.ctl") & 1
                new_ack = req != (self.ack & 1) and self.get("cmd.code") == 4 and self.get("cmd.seq") != self.get("hs.ackSeq")
            super().on_write(addr, vals)
            if new_ack:
                self.model.ack()

        def job_asrs(self, code):
            p = self._params()
            self._done.clear()
            self.model.start_job(code, p, self.get("job.id"))
            self._done.wait()
            _, res, det = self._end
            self.set("asrs.detail", det)
            if res != 0:
                self.set("std.alarm", det)
                self.set_state(4)
            return res

        def _monitor(self):
            t_last = time.perf_counter()
            seen = 0
            while True:
                time.sleep(0.005)
                now = time.perf_counter()
                self.model.advance((now - t_last) * self.speed)
                t_last = now
                m = self.model
                with m.lock:
                    evs = m.events[seen:]
                    seen = len(m.events)
                    col, lev = m.col_level()
                    self.set("asrs.bay", col); self.set("asrs.level", lev); self.set("asrs.loadOnFork", int(m.load_on_fork))
                    self.set("asrs.ioReady", int(not m.infeed_load)); self.set("asrs.craneState", m.state)
                    self.set("asrs.x_mm", int(m.x * 1000)); self.set("asrs.z_mm", int(m.z * 1000))
                    st, mode = m.state, (3 if m.maint else 0 if m.manual else 1)
                    if m.state == FAULT:
                        self.set("asrs.detail", m.detail)
                for _, kind, data in evs:
                    if kind == "job_end":
                        self._end = data
                        self._done.set()
                self.set("std.mode", mode)
                if st == FAULT:
                    if self.state != 4:
                        self.set("std.alarm", self.model.detail); self.set_state(4)
                elif st in (MOVE_TO_SOURCE, PICK, MOVE_TO_DEST, PUT, RETURN):
                    if self.state not in (2, 4) and self.busy:
                        self.set_state(2)
                    if self.state == 4:
                        self.set("std.alarm", 0); self.set_state(2 if self.busy else 1)
                elif st in (IDLE,) and self.state == 4:
                    self.set("std.alarm", 0); self.set_state(1)
                self.handshake()
                if st == OFF and self.state != 0:
                    self.set_state(0)

    return CraneDevice()


# ----------------------------------------------------------------------------- self-test
def selftest():
    from fmsctl.core.device import DeviceLink, HandshakeError
    from fmsctl.sim import virtual_plant as VP
    from fmsctl.spec import regmap as R
    ok = []
    out = {}

    def check(name, cond, info=""):
        ok.append(bool(cond))
        print("  [%s] %s%s" % ("PASS" if cond else "FAIL", name, (" | " + info) if info else ""))

    d = load_design()
    # ---------------- A geometry
    okc, x, z = coord(13, 4, 2)
    check("coordinates: column 13 (bay 7, first crate) level 4 -> x %.3f m, z %.2f m" % (x, z),
          okc and abs(x - 13.325) < 1e-9 and abs(z - 4.20) < 1e-9)
    check("out of range: column 39 / level 11 / side 3 rejected", not coord(39, 1, 1)[0] and not coord(1, 11, 1)[0] and not coord(1, 1, 3)[0])
    check("760 positions, zones KIT 200 / RAW 560", len(CraneModel(d).occ) == 760 and
          sum(1 for k in CraneModel(d).occ if zone(k[0]) == "KIT") == 200)

    # ---------------- B logic on the model (simulated clock)
    m = CraneModel(d)
    m.advance(5)
    check("power-up: OFF -> HOMING -> IDLE", m.state == IDLE, STATE_NAME[m.state])
    m.infeed_load, m.infeed_crate = True, 5001
    r = m.check(30, {"dst": (20, 6, 1)})
    m.start_job(30, {"dst": (20, 6, 1)}, 1)
    m.run_until_idle()
    check("store I/O -> (20, 6, L): crate in the slot, crane back at I/O", r == (0, 0) and m.occ[(20, 6, 1)] == 5001 and m.state == IDLE)
    m.start_job(32, {"src": (20, 6, 1), "dst": (3, 2, 2)}, 2)
    m.run_until_idle()
    check("relocate (20, 6, L) -> (3, 2, R)", m.occ[(20, 6, 1)] == 0 and m.occ[(3, 2, 2)] == 5001)
    m.outfeed_free = True
    m.start_job(31, {"dst": (3, 2, 2)}, 3)
    m.run_until_idle()
    check("retrieve (3, 2, R) -> outfeed", m.occ[(3, 2, 2)] == 0 and m.outfeed_crate == 5001 and not m.outfeed_free)
    m.outfeed_free = True
    # double occupancy
    m.occ[(8, 3, 1)] = 777
    m.infeed_load, m.infeed_crate = True, 5002
    m.start_job(30, {"dst": (8, 3, 1)}, 4)
    m.run_until_idle()
    ev = [e for e in m.events if e[1] == "job_end"][-1][2]
    check("double occupancy: job aborted, detail 21, load stays on the fork, FAULT",
          ev == (4, 2, 21) and m.load_on_fork and m.state == FAULT and m.occ[(8, 3, 1)] == 777)
    r_busy = m.check(30, {"dst": (9, 3, 1)})
    m.ack(); m.advance(3)
    r2 = m.check(30, {"dst": (9, 3, 1)})
    m.start_job(30, {"dst": (9, 3, 1)}, 5); m.run_until_idle()
    check("recovery: refused in FAULT (2), after acknowledge a new store puts the fork load elsewhere",
          r_busy[0] == 2 and r2 == (0, 0) and m.occ[(9, 3, 1)] == 5002 and not m.load_on_fork)
    m.start_job(31, {"dst": (30, 9, 2)}, 6); m.run_until_idle()
    ev = [e for e in m.events if e[1] == "job_end"][-1][2]
    check("retrieve from an empty slot: detail 22, FAULT", ev == (6, 2, 22) and m.state == FAULT)
    m.ack(); m.advance(3)
    check("range check: column 40 -> rejected (3, 11); retrieve with load on fork impossible",
          m.check(31, {"dst": (40, 1, 1)}) == (3, 11) and m.check(32, {"src": (1, 1, 1), "dst": (1, 1, 1)}) == (3, 12))
    m.infeed_load, m.infeed_contour_ok, m.infeed_crate = True, False, 5003
    check("contour check failed at the infeed -> store not accepted (2, 24)", m.check(30, {"dst": (5, 5, 1)}) == (2, 24))
    m.infeed_contour_ok = True
    # door during the move
    m.start_job(30, {"dst": (38, 10, 2)}, 7)
    m.advance(8.0)
    st_before = m.state
    m.door_closed = False
    m.advance(0.1)
    ev = [e for e in m.events if e[1] == "job_end"][-1][2]
    check("door opened while moving (%s): FAULT, job aborted with detail 31" % STATE_NAME[st_before],
          st_before in (MOVE_TO_DEST, PICK, MOVE_TO_SOURCE) and m.state == FAULT and ev == (7, 2, 31))
    m.ack(); m.advance(1)
    stay = m.state
    m.door_closed = True
    m.ack(); m.advance(3)
    check("acknowledge refused while the door is open; accepted after closing -> HOMING -> IDLE", stay == FAULT and m.state == IDLE)
    m.safety_ok = False; m.advance(0.1)
    e_state = m.state
    m.safety_ok = True; m.ack(); m.advance(3)
    check("E-stop in IDLE -> FAULT (31); reset + acknowledge -> IDLE", e_state == FAULT and m.state == IDLE)
    if m.load_on_fork:                 # the aborted store left its crate on the fork: put it away
        m.start_job(30, {"dst": (11, 1, 1)}, 8); m.run_until_idle()
    m.manual = True; m.advance(0.1)
    check("MANUAL mode: no jobs accepted (2)", m.state == MANUAL and m.check(31, {"dst": (11, 1, 1)})[0] == 2)
    m.manual = False; m.advance(3)

    # ---------------- C cycle times vs FEM 9.851
    L, Hh = d["crane"]["fem"]["travel_L"], d["crane"]["fem"]["lift_H"]
    def nearest(xt, zt):
        best = None
        for c_ in range(1, NCOL + 1):
            for l in range(1, NLEV + 1):
                _, x_, z_ = coord(c_, l, 1)
                dd = abs(x_ - xt) + abs((z_ - Z1) - zt)
                if best is None or dd < best[0]:
                    best = (dd, c_, l)
        return best[1], best[2]
    cyc = []
    for xt, zt in ((L / 5, 2 * Hh / 3), (2 * L / 3, Hh / 5)):
        c_, l = nearest(xt, zt)
        mm = CraneModel(d); mm.advance(5)
        mm.infeed_load, mm.infeed_crate = True, 1
        mm.start_job(30, {"dst": (c_, l, 1)}, 1); mm.run_until_idle(dt=0.01)
        while mm.state != IDLE or mm.last_cycle is None:
            mm.advance(0.01)
        cyc.append((c_, l, mm.last_cycle))
    sc = sum(c[2] for c in cyc) / 2
    out["sc"] = (cyc, sc)
    check("single cycle (store to P1 col %d lev %d: %.1f s, P2 col %d lev %d: %.1f s) mean %.1f s vs FEM 9.851 %.1f s (+-10 %%)" % (
        cyc[0][0], cyc[0][1], cyc[0][2], cyc[1][0], cyc[1][1], cyc[1][2], sc, d["crane"]["fem"]["SC"]),
        abs(sc - d["crane"]["fem"]["SC"]) / d["crane"]["fem"]["SC"] <= 0.10)

    # ---------------- D throughput: 1 h with the peak demand of design F3
    rng = random.Random(42)
    mt = CraneModel(d); mt.advance(5)
    keys = list(mt.occ)
    for k in rng.sample(keys, 456):        # 60 % filled
        mt.occ[k] = rng.randint(1, 99999)
    peak = d["moves"]["peak_h"]
    n = int(round(peak))
    arrivals = sorted(rng.uniform(0, 3600) for _ in range(n))
    queue, done_jobs, t0 = [], 0, mt.t
    mt.busy_time = 0.0
    jid = 100
    while mt.t - t0 < 3600 + 600 and (arrivals or queue or mt.job_active or mt.state != IDLE):
        while arrivals and arrivals[0] <= mt.t - t0:
            arrivals.pop(0); queue.append(rng.random() < 0.5)       # True = store, False = retrieve
        if queue and mt.ready():
            store = queue.pop(0)
            jid += 1
            if store:
                free = [k for k in keys if mt.occ[k] == 0]
                mt.infeed_load, mt.infeed_crate = True, jid
                mt.start_job(30, {"dst": rng.choice(free)}, jid)
            else:
                full = [k for k in keys if mt.occ[k] != 0]
                mt.outfeed_free = True
                mt.start_job(31, {"dst": rng.choice(full)}, jid)
            done_jobs += 1
        mt.advance(0.5)
        mt.outfeed_free = True
    util = mt.busy_time / 3600.0
    expect = peak * d["crane"]["fem"]["SC"] / 3600.0
    out["util"] = (done_jobs, util, expect)
    check("1 h at the peak demand %.1f moves/h: %d jobs, crane busy %.0f %% vs design %.1f x SC / 3600 = %.0f %% (+-15 %% rel.)" % (
        peak, done_jobs, 100 * util, peak, 100 * expect), abs(util - expect) / expect <= 0.15)

    # ---------------- E Modbus face: real handshake through fmsctl DeviceLink
    VP.WATCHDOG_S = 1.5                      # shorter watchdog for the test (real seconds)
    mm = CraneModel(d)
    dev = make_device(mm, port=15051, speed=100.0)
    info = {"id": "ASRS-RAW", "type": "ASRS", "unit": 1, "host": "127.0.0.1", "port": 15051}
    link = DeviceLink(info)
    time.sleep(0.4)
    stop_hb = threading.Event()

    def gw_heartbeat():
        k = 0
        while not stop_hb.is_set():
            k = (k + 1) & 0xFFFF
            try:
                link.write("cmd.gwHeartbeat", k)
            except Exception:
                pass
            time.sleep(0.3)
    threading.Thread(target=gw_heartbeat, daemon=True).start()
    time.sleep(0.4)
    check("Modbus: header map 0x%04X, type 7, crane state IDLE (%d)" % (link.read("hdr.mapVersion"), link.read("asrs.craneState")),
          link.read("hdr.mapVersion") == R.MAP_VERSION and link.read("hdr.typeCode") == 7 and link.read("asrs.craneState") == IDLE)
    mm.infeed_load, mm.infeed_crate = True, 9001
    j = link.command(30, {"loc.bay": 15, "loc.level": 3, "loc.side": 2, "crate.id": 9001})
    r = link.wait_done(j, timeout=30)
    check("Modbus store (cmd 30) col 15 lev 3 R: result 0, slot filled, cycle %.1f s" % r["cycle_s"], r["result"] == 0 and mm.occ[(15, 3, 2)] == 9001)
    j = link.command(32, {"src.bay": 15, "src.level": 3, "src.side": 2, "loc.bay": 2, "loc.level": 1, "loc.side": 1})
    r = link.wait_done(j, timeout=30)
    check("Modbus relocate (cmd 32): result 0", r["result"] == 0 and mm.occ[(2, 1, 1)] == 9001)
    j = link.command(31, {"loc.bay": 2, "loc.level": 1, "loc.side": 1})
    r = link.wait_done(j, timeout=30)
    check("Modbus retrieve (cmd 31): result 0, crate at the outfeed", r["result"] == 0 and mm.outfeed_crate == 9001)
    mm.outfeed_free = True
    try:
        link.command(31, {"loc.bay": 40, "loc.level": 1, "loc.side": 1})
        check("Modbus: position out of range rejected", False)
    except HandshakeError as e:
        check("Modbus: position out of range rejected with 'bad data', detail 11", "bad data" in str(e) and link.read("asrs.detail") == 11, str(e))
    mm.occ[(5, 5, 1)] = 1234
    mm.infeed_load, mm.infeed_crate = True, 9002
    j = link.command(30, {"loc.bay": 5, "loc.level": 5, "loc.side": 1})
    r = link.wait_done(j, timeout=30)
    time.sleep(0.1)
    check("Modbus double occupancy: job.result 2, detail 21, state DOWN, load on fork",
          r["result"] == 2 and link.read("asrs.detail") == 21 and link.read("std.stateCode") == 4 and link.read("asrs.loadOnFork") == 1)
    try:
        link.command(30, {"loc.bay": 6, "loc.level": 5, "loc.side": 1})
        check("Modbus: new job refused while DOWN", False)
    except HandshakeError as e:
        check("Modbus: new job refused while DOWN ('not ready')", "not ready" in str(e), str(e))
    link.command(4)
    time.sleep(0.2)
    j = link.command(30, {"loc.bay": 6, "loc.level": 5, "loc.side": 1})
    r = link.wait_done(j, timeout=30)
    check("Modbus acknowledge (cmd 4) + store of the fork load elsewhere", r["result"] == 0 and mm.occ[(6, 5, 1)] == 9002)
    # door during move
    mm.infeed_load, mm.infeed_crate = True, 9003
    j = link.command(30, {"loc.bay": 38, "loc.level": 10, "loc.side": 2})
    time.sleep(0.08)
    mm.door_closed = False
    r = link.wait_done(j, timeout=30)
    time.sleep(0.1)
    check("Modbus door opened during the move: result 2, detail 31, DOWN", r["result"] == 2 and link.read("asrs.detail") == 31 and link.read("std.stateCode") == 4)
    mm.door_closed = True
    link.command(4); time.sleep(0.2)
    check("Modbus recovery after door closed + acknowledge: IDLE, ready", link.read("asrs.craneState") == IDLE and link.read("hs.status") & 16)
    if mm.load_on_fork:
        j = link.command(30, {"loc.bay": 37, "loc.level": 1, "loc.side": 2}); link.wait_done(j, timeout=30)
    # stale REQ (sequence guard)
    ack0, seq0 = link.read("hs.status") & 1, link.read("hs.ackSeq")
    link.write("cmd.code", 31); link.write("cmd.seq", seq0)
    link.write("cmd.ctl", (link.read("cmd.ctl") & ~1) | (ack0 ^ 1))
    time.sleep(0.2)
    check("Modbus stale REQ with an old sequence number is ignored (ACK unchanged)", (link.read("hs.status") & 1) == ack0 and link.read("hs.ackSeq") == seq0)
    # watchdog loss
    stop_hb.set()
    time.sleep(VP.WATCHDOG_S + 1.3)
    try:
        link.command(33)
        check("Modbus gateway heartbeat lost -> not ready", False)
    except HandshakeError as e:
        check("Modbus gateway heartbeat lost (> %.1f s) -> new jobs refused ('not ready'), READY bit off" % VP.WATCHDOG_S,
              "not ready" in str(e) and not (link.read("hs.status") & 16), str(e))
    dev.server.stop()
    print("SELFTEST %s (%d/%d)" % ("PASS" if all(ok) else "FAIL", sum(ok), len(ok)))
    return (0 if all(ok) else 1), out



# ----------------------------------------------------------------------------- state diagram (SVG)
def diagram(path=os.path.join(HERE, "out", "plc_state_machine.svg")):
    """State machine of FB_Crane / CraneModel as an SVG (states, transitions, conditions)."""
    W, H = 1180, 920
    box = {"OFF": (110, 110), "HOMING": (370, 110), "IDLE": (650, 110), "MANUAL": (980, 60), "MAINTENANCE": (980, 165),
           "MOVE_TO_SOURCE": (200, 340), "RETURN": (980, 340),
           "PICK": (200, 540), "MOVE_TO_DEST": (580, 540), "PUT": (960, 540), "FAULT": (580, 770)}
    num = {n: i for i, n in enumerate(STATE_NAME)}
    bw, bh = 190, 54
    col = {"FAULT": "#f4cccc", "OFF": "#eeeeee", "MANUAL": "#fff2cc", "MAINTENANCE": "#fff2cc", "IDLE": "#d9ead3",
           "RETURN": "#d9ead3", "HOMING": "#cfe2f3"}
    o = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" font-family="Arial" font-size="13">' % (W, H, W, H),
         '<defs><marker id="a" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#333"/></marker>'
         '<marker id="r" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#b00"/></marker></defs>',
         '<rect width="100%" height="100%" fill="#fff"/>',
         '<text x="20" y="28" font-size="17" font-weight="bold">Stacker crane state machine - FB_Crane (asrs_crane.scl) = CraneModel (asrs_sim.py)</text>',
         '<g transform="translate(0,45)">']

    def side(n, where):
        x, y = box[n]
        return {"t": (x, y - bh / 2), "b": (x, y + bh / 2), "l": (x - bw / 2, y), "r": (x + bw / 2, y)}[where] if len(where) == 1 else \
            {"tl": (x - 50, y - bh / 2), "tr": (x + 50, y - bh / 2), "bl": (x - 50, y + bh / 2), "br": (x + 50, y + bh / 2),
             "lt": (x - bw / 2, y - 12), "lb": (x - bw / 2, y + 12), "rt": (x + bw / 2, y - 12), "rb": (x + bw / 2, y + 12)}[where]

    def edge(a, wa, b, wb, label, lpos, ctrl=None, red=False, anchor="middle"):
        (sx, sy), (ex, ey) = side(a, wa), side(b, wb)
        c = "#b00" if red else "#333"
        if ctrl:
            d = "M%.0f,%.0f Q%.0f,%.0f %.0f,%.0f" % (sx, sy, ctrl[0], ctrl[1], ex, ey)
        else:
            d = "M%.0f,%.0f L%.0f,%.0f" % (sx, sy, ex, ey)
        o.append('<path d="%s" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#%s)"%s/>' % (
            d, c, "r" if red else "a", ' stroke-dasharray="6 4"' if red else ""))
        for k, line in enumerate(label.split("|")):
            o.append('<text x="%.0f" y="%.0f" fill="%s" font-size="11.5" text-anchor="%s">%s</text>' % (
                lpos[0], lpos[1] + 13 * k, "#900" if red else "#222", anchor, line))

    edge("OFF", "r", "HOMING", "l", "safety OK +|drives ready", (240, 92))
    edge("HOMING", "r", "IDLE", "l", "positions valid,|fork centred", (510, 92))
    edge("IDLE", "rt", "MANUAL", "l", "selector MANUAL", (790, 70))
    edge("IDLE", "rb", "MAINTENANCE", "l", "key MAINTENANCE", (790, 150))
    edge("MANUAL", "t", "HOMING", "t", "selector AUTO", (650, 30), ctrl=(680, -10))
    edge("MAINTENANCE", "b", "OFF", "b", "key off", (150, 190), ctrl=(500, 300))
    edge("IDLE", "bl", "MOVE_TO_SOURCE", "tr", "new job 30 / 31 / 32|(30 only with fork empty)", (470, 262), anchor="start")
    edge("IDLE", "b", "MOVE_TO_DEST", "t", "30 with load on fork,|33 park", (598, 405), anchor="end")
    edge("MOVE_TO_SOURCE", "b", "PICK", "t", "both axes in position|(low pick height)", (210, 435), anchor="start")
    edge("PICK", "r", "MOVE_TO_DEST", "l", "load on fork,|no overhang", (390, 528))
    edge("MOVE_TO_DEST", "r", "PUT", "l", "in position (high)", (770, 528))
    edge("MOVE_TO_DEST", "br", "IDLE", "br", "33: parked = job done", (760, 300), ctrl=(760, 330), anchor="start")
    edge("PUT", "t", "RETURN", "b", "fork empty:|JOB DONE (result 0)", (978, 445), anchor="start")
    edge("RETURN", "t", "IDLE", "b", "at the I/O point", (840, 220), ctrl=(870, 170))
    edge("RETURN", "l", "MOVE_TO_SOURCE", "r", "new job interrupts RETURN", (590, 332))
    edge("PICK", "b", "FAULT", "lt", "22 source empty, 23 contour,|24 I/O not ready, 33 load lost", (230, 660), ctrl=(220, 760), red=True, anchor="start")
    edge("PUT", "b", "FAULT", "rt", "21 DOUBLE OCCUPANCY (load stays|on the fork), 24, 33", (930, 660), ctrl=(950, 760), red=True, anchor="end")
    edge("FAULT", "t", "HOMING", "b", "acknowledge (cmd 4)|and cause removed", (395, 690), ctrl=(300, 560), anchor="end")
    for n, (x, y) in box.items():
        o.append('<rect x="%d" y="%d" width="%d" height="%d" rx="10" fill="%s" stroke="#333" stroke-width="1.5"/>' % (
            x - bw / 2, y - bh / 2, bw, bh, col.get(n, "#fce5cd")))
        o.append('<text x="%d" y="%d" text-anchor="middle" font-weight="bold">%s</text>' % (x, y - 2, n))
        o.append('<text x="%d" y="%d" text-anchor="middle" font-size="11" fill="#444">state %d (register 304)</text>' % (x, y + 15, num[n]))
    o.append('</g>')
    o.append('<text x="580" y="884" fill="#900" font-size="12" text-anchor="middle">Any state except OFF / FAULT / MAINTENANCE: door open, e-stop or safety PLC -&gt; 31; axis fault -&gt; 32; fork fault -&gt; 33</text>')
    o.append('<text x="580" y="900" fill="#900" font-size="12" text-anchor="middle">(a running job is aborted with job.result 2, the detail code is in register 305)</text>')
    o.append('<text x="20" y="%d" font-size="11.5" fill="#444">Store 30 = I/O infeed -&gt; rack;  retrieve 31 = rack -&gt; I/O outfeed;  relocate 32 = rack -&gt; rack;  park 33 = maintenance position.</text>' % (H - 4))
    o.append("</svg>")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(o))
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd")
    sp.add_parser("selftest")
    s = sp.add_parser("serve"); s.add_argument("--port", type=int, default=15051); s.add_argument("--speed", type=float, default=20.0)
    sp.add_parser("diagram")
    a = ap.parse_args(argv)
    if a.cmd == "diagram":
        print(diagram())
        return 0
    if a.cmd == "selftest":
        return selftest()[0]
    if a.cmd == "serve":
        m = CraneModel()
        make_device(m, port=a.port, speed=a.speed)
        print("virtual crane ASRS-RAW on 127.0.0.1:%d (speed x%g) - Ctrl+C to stop" % (a.port, a.speed))
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            return 0
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
