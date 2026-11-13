"""
Modbus TCP SERVER that simulates the PLC / gauges of the spindle assembly station ASSY-SP1.
Use it to test the Modbus path of the live twin without real hardware (offline, standard library only).

  unit 1 = RUN-01  run-in stand PLC   (speed + 5 temperatures + vibration + water flow, follows the
                                       speed set-point that the twin writes into register 100)
  unit 2 = BAL-01  balancing machine  (new measurement every --interval s, counter in register 4)
  unit 3 = HSK-01  clamping-force gauge
  unit 4 = FG-01   force gauge
  unit 5 = PRS-01  pressure gauge
Register map: twin/spdevices.py MODBUS_MAP (also in docs/20_spindle_station_live_twin.md, chapter 6).

Run:
  python tools/spst_modbus_sim.py --port 5020                 (default: no faults)
  python tools/spst_modbus_sim.py --port 5020 --fault grease  (grease 3x -> run-in temperature stops)
  python tools/spst_modbus_sim.py --port 5020 --fault dirt    (vibration -> run-in aborted)
Then tell the twin to read RUN-01 by Modbus:
  POST /api/spst {"action": "device", "id": "RUN-01", "proto": "modbus", "addr": "127.0.0.1:5020/unit1"}

Supported function codes: 3 (read holding registers), 6 (write single register), 16 (write multiple).
All values are EXAMPLES.
"""

import argparse
import math
import os
import random
import socketserver
import struct
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from twin.spdevices import MODBUS_MAP, MODBUS_SIM_UNITS  # noqa: E402

NMAX = 10000             # HMC motor spindle max speed (decided 2026-11-12: 10 000 rpm / 18 kW)
LOCK = threading.Lock()
REGS = {u: [0] * 128 for u in MODBUS_SIM_UNITS.values()}     # unit id -> holding registers
ARGS = None


def put(unit, addr, value, scale):
    raw = int(round(value / scale))
    REGS[unit][addr] = raw & 0xFFFF


class RunIn:
    """First-order thermal model of the spindle on the run-in stand (same idea as twin/spstation.py)."""

    def __init__(self, faults):
        self.f = set(faults)
        self.rpm = 0.0
        self.dTf = self.dTr = self.dTs = self.dTw = 0.0
        self.t_at = 0.0          # s at the current set-point
        self.last_set = 0
        self.chK = 1.0
        self.hb = 0

    def step(self, dt, rpm_set, run):
        if not run:
            rpm_set = 0
        if rpm_set != self.last_set:
            if rpm_set == 0 and self.last_set > 0:
                self.chK *= 0.55                      # grease pushed out of the ball path
            self.last_set = rpm_set
            self.t_at = 0.0
        self.t_at += dt
        self.rpm += max(-200 * dt, min(50 * dt, rpm_set - self.rpm))
        fr = max(0.0, self.rpm / NMAX)
        Tss = 14 * fr ** 1.2 + (2.5 * fr if "dirt" in self.f else 0)
        C0 = 6 * (3.6 if "grease" in self.f else 1)
        ch = C0 * fr * self.chK * math.exp(-(self.t_at / 60) / (25 if "grease" in self.f else 10)) if rpm_set > 0 else 0
        m = dt / 60
        self.dTf += (Tss + ch - self.dTf) * min(1, m / 9)
        self.dTr += (0.7 * Tss + 0.5 * ch - self.dTr) * min(1, m / 10)
        self.dTs += (4 * fr + 22 * fr ** 1.5 - self.dTs) * min(1, m / 15)
        self.dTw += (5.7 * fr ** 1.5 + 0.2 - self.dTw) * min(1, m / 2)
        vib = 0.12 + 0.30 * fr ** 2 + random.gauss(0, 0.015)
        if "dirt" in self.f:
            vib += 1.5 * fr ** 1.5 + abs(random.gauss(0, 0.15)) * fr
        win = 20.0 + random.gauss(0, 0.03)
        self.hb = (self.hb + 1) & 0x7FFF
        vals = {"rpm": self.rpm, "t_front_c": win + self.dTf, "t_rear_c": win + self.dTr, "t_stator_c": win + self.dTs,
                "t_win_c": win, "t_wout_c": win + self.dTw, "vib_mm_s": max(0.02, vib),
                "flow_lpm": 4.0 + random.gauss(0, 0.03)}
        return vals


def gauge_value(dev):
    g = random.gauss
    if dev == "BAL-01":
        # first reading after a counter step = initial unbalance, the next one = residual (alternating)
        gauge_value.bal = not getattr(gauge_value, "bal", False)
        if gauge_value.bal:
            return {"u1_gmm": abs(g(70, 25)), "a1_deg": random.random() * 360, "u2_gmm": abs(g(55, 20)), "a2_deg": random.random() * 360}
        return {"u1_gmm": abs(g(0.3, 0.12)) * 6.37, "a1_deg": random.random() * 360,
                "u2_gmm": abs(g(0.3, 0.12)) * 6.37, "a2_deg": random.random() * 360}
    if dev == "HSK-01":
        return {"force_kn": 18 * g(1.03, 0.025) * (0.6 if "spring" in ARGS.fault else 1)}
    if dev == "FG-01":
        return {"force_kn": 6.9 * g(1.01, 0.02) * (0.6 if "spring" in ARGS.fault else 1)}
    if dev == "PRS-01":
        return {"p_bar": abs(g(0.03, 0.02)) if not ARGS.pressure_unclamp else 29.0 * g(1.05, 0.02)}
    return {}


def simulate():
    run = RunIn(ARGS.fault)
    u_run = MODBUS_SIM_UNITS["RUN-01"]
    w = MODBUS_MAP["RUN-01"]["write"]
    last, next_gauge = time.time(), time.time() + ARGS.interval
    while True:
        time.sleep(0.2)
        now = time.time()
        dt = now - last
        last = now
        with LOCK:
            r = REGS[u_run]
            rpm_set = r[w["rpm_set"][0]]
            factor = max(1, r[w["time_factor"][0]] or 1) if not ARGS.realtime else 1
            cmd = r[w["cmd"][0]]
            vals = run.step(dt * factor, rpm_set if rpm_set < 32768 else 0, cmd == 1)
            for k, i, sc in MODBUS_MAP["RUN-01"]["regs"]:
                put(u_run, i, vals[k], sc)
            r[MODBUS_MAP["RUN-01"]["status"]] = (1 if run.rpm > 10 else 0)
            r[MODBUS_MAP["RUN-01"]["heartbeat"]] = run.hb
            if ARGS.interval > 0 and now >= next_gauge:
                next_gauge = now + ARGS.interval
                for dev in ("BAL-01", "HSK-01", "FG-01", "PRS-01"):
                    m, u = MODBUS_MAP[dev], MODBUS_SIM_UNITS[dev]
                    v = gauge_value(dev)
                    for k, i, sc in m["regs"]:
                        put(u, i, v.get(k, 0), sc)
                    REGS[u][m["counter"]] = (REGS[u][m["counter"]] + 1) & 0x7FFF


class Handler(socketserver.BaseRequestHandler):
    def recv(self, n):
        buf = b""
        while len(buf) < n:
            c = self.request.recv(n - len(buf))
            if not c:
                raise ConnectionError
            buf += c
        return buf

    def handle(self):
        if not ARGS.quiet:
            print("client connected", self.client_address)
        try:
            while True:
                tid, pid, length, unit = struct.unpack(">HHHB", self.recv(7))
                pdu = self.recv(length - 1)
                fc = pdu[0]
                regs = REGS.get(unit)
                if regs is None:
                    resp = bytes([fc | 0x80, 0x0B])                  # gateway target failed to respond
                elif fc == 3:
                    addr, cnt = struct.unpack(">HH", pdu[1:5])
                    if cnt < 1 or cnt > 125 or addr + cnt > len(regs):
                        resp = bytes([0x83, 0x02])                   # illegal data address
                    else:
                        with LOCK:
                            data = regs[addr:addr + cnt]
                        resp = struct.pack(">BB", 3, cnt * 2) + struct.pack(">" + "H" * cnt, *data)
                elif fc == 6:
                    addr, val = struct.unpack(">HH", pdu[1:5])
                    if addr >= len(regs):
                        resp = bytes([0x86, 0x02])
                    else:
                        with LOCK:
                            regs[addr] = val
                        resp = pdu[:5]
                        if not ARGS.quiet:
                            print(f"write unit {unit} register {addr} = {val}")
                elif fc == 16:
                    addr, cnt, _bc = struct.unpack(">HHB", pdu[1:6])
                    vals = struct.unpack(">" + "H" * cnt, pdu[6:6 + 2 * cnt])
                    with LOCK:
                        regs[addr:addr + cnt] = list(vals)
                    resp = struct.pack(">BHH", 16, addr, cnt)
                else:
                    resp = bytes([fc | 0x80, 0x01])                  # illegal function
                self.request.sendall(struct.pack(">HHHB", tid, 0, len(resp) + 1, unit) + resp)
        except (ConnectionError, OSError, struct.error):
            pass


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = False


def main():
    global ARGS
    ap = argparse.ArgumentParser(description="Modbus TCP simulator for ASSY-SP1 (RUN-01, BAL-01, HSK-01, FG-01, PRS-01)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=5020, help="502 is the standard port (needs admin rights on some PCs)")
    ap.add_argument("--fault", action="append", default=[], choices=["dirt", "grease", "spring"],
                    help="simulate a fault (can be repeated)")
    ap.add_argument("--interval", type=float, default=4.0, help="s between new gauge measurements (0 = never)")
    ap.add_argument("--pressure-unclamp", action="store_true", help="PRS-01 sends unclamp pressures (~29 bar) instead of leak drops")
    ap.add_argument("--realtime", action="store_true", help="ignore the time factor register 101")
    ap.add_argument("--quiet", action="store_true")
    ARGS = ap.parse_args()
    threading.Thread(target=simulate, daemon=True).start()
    with Server((ARGS.host, ARGS.port), Handler) as srv:
        print(f"Modbus TCP simulator on {ARGS.host}:{ARGS.port}  units: " +
              ", ".join(f"{u}={d}" for d, u in MODBUS_SIM_UNITS.items()) + f"  faults: {ARGS.fault or '-'}  (Ctrl+C to stop)")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
