#!/usr/bin/env python3
"""Final thesis item F3, Case B - the AS/RS with EXPANSION COMMUNICATION MODULES.

Case A (Part B/C of guide 60) uses only the built-in ports of the crane PLC: X1 PROFINET IO, X2 factory Modbus TCP.
Case B adds communication modules to the PLC rack and shows, with numbers, when and why:
  B1 Siemens S7-1500 + CP 1543-1 (factory link with firewall) + CM 1542-1 (2nd PROFINET IO network for the F4
     conveyors) + CM PtP RS-485 (Modbus RTU line: energy meter, weighing terminal, 24 V UPS) + PS 60 W
  B2 Delta AS300 + AS-FEN02 (2nd Ethernet) + AS-FCOPM (CANopen for the crane drives) + built-in RS-485 + external firewall

Python 3 standard library only, offline. Data: comm_data.json (reference estimates, module names [verify]).
Outputs (out/comm/): comm_report.md, case_compare.csv, modules_bom.csv, ip_plan.csv, firewall_rules.csv,
rtu_poll_table.csv, rtu_sim_log.csv, P11.svg (B1 network), P12.svg (RS-485 line), P13.svg (B2 Delta).
Guide: Doctor paper/60_final_asrs.md, Part D.

Commands
  python asrs_comm.py selftest
  python asrs_comm.py run [--out out/comm]
  python asrs_comm.py rtu [--seconds 10] [--fault silent:1]     run the virtual RS-485 line and print the poll log

Formulas (guide Part D)
  module selection   min sum(price_m * n_m)  s.t.  ports_cpu[k] + sum n_m provides_m[k] >= demand[k]  for every k,
                     firewall if required, sum W_m <= W_cpu + sum supply_m, n_comm <= max_comm, cards <= max_cards
                     (exhaustive enumeration: n_m in 0..2, the catalogue is small)
  Modbus RTU         t_char = bits / baud (8E1 = 11 bit) ; gap = 3.5 t_char (>19.2 kbit/s: 1.75 ms)
                     FC03 request 8 byte, response 5 + 2 n byte ; FC06 8 / 8 ; FC16 request 9 + 2 k, response 8
                     t_trans = t_req + gap + t_resp,slave + t_rsp + gap + t_plc
                     round = sum of the slaves due in that round ; update_s <= every_s * worst round
                     offline device: one try per probe -> round + timeout
  Modbus TCP         t_mean = T_poll/2 + t_net + t_OB1 (+ t_CP) ; t_worst = T_poll + 2 t_net + 2 t_OB1 (+ 2 t_CP)
  PROFINET           frame on wire = max(64, 26 + payload) + 20 byte ; load = sum(8 * bytes) / (T_update * 100 Mbit/s)
  CANopen            8-byte frame = 111 bit + 24 stuffing = 135 bit ; SYNC = 47 + 10 bit ;
                     load = (n_frames * 135 + SYNC) / (bitrate * T_cycle) ; length <= table(bitrate) (CiA 301 typical)

DESIGN - network and security concept to be released by the responsible controls engineer (IEC 62443-3-3 zones and
conduits); module types are classes 'or equal' - check them in the current catalogue.
"""

import argparse
import csv
import itertools
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
KINDS = ("PN_IO", "ETH", "RS485", "CAN")


def load(path=os.path.join(HERE, "comm_data.json")):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# ============================================================================= 1 module selection
def select_modules(d, case):
    """Cheapest module set that covers the interface demand of a case. Returns (best, feasible list)."""
    cpu_id = d["case_cpu"][case]
    cpu = d["cpus"][cpu_id]
    dem = d["demand"][case]
    cand = [(k, m) for k, m in d["modules"].items() if m["family"] in (cpu["family"], "any")]
    feas = []
    for counts in itertools.product(*[range(0, 2 if m.get("external") or m.get("supply_W") else 3) for _, m in cand]):
        have = dict(cpu["ports"])
        fw = cpu["firewall"]
        W = 0.0
        sup = cpu["backplane_W"]
        price = cpu["price_EUR"]
        n_comm = cards = slots = 0
        for (k, m), n in zip(cand, counts):
            if not n:
                continue
            for kind, v in m["provides"].items():
                have[kind] = have.get(kind, 0) + n * v
            fw = fw or m["firewall"]
            W += n * m["W"]
            sup += n * m.get("supply_W", 0.0)
            price += n * m["price_EUR"]
            if m.get("card"):
                cards += n
            elif not m.get("external") and not m.get("supply_W"):
                n_comm += n
            slots += n * m["slots"]
        ok = all(have.get(k, 0) >= dem[k] for k in KINDS)
        ok = ok and (fw or not dem["firewall_at_plc"])
        ok = ok and W <= sup + 1e-9
        ok = ok and n_comm <= cpu["max_comm_modules"]
        ok = ok and cards <= d.get("max_cards_DeltaAS", 99) if cpu["family"] == "DeltaAS" else ok
        if ok:
            mods = [(k, n) for (k, _), n in zip(cand, counts) if n]
            feas.append({"case": case, "cpu": cpu_id, "modules": mods, "price_EUR": price,
                         "comm_EUR": price - cpu["price_EUR"], "W": W, "W_avail": sup, "have": have, "firewall": fw,
                         "n_mod": sum(n for _, n in mods)})
    feas.sort(key=lambda r: (r["price_EUR"], r["n_mod"]))
    return (feas[0] if feas else None), feas


def builtin_ok(d, case):
    """Can the CPU alone (no module) meet the demand? -> list of the missing items."""
    cpu = d["cpus"][d["case_cpu"][case]]
    dem = d["demand"][case]
    miss = ["%s %d > %d" % (k, dem[k], cpu["ports"].get(k, 0)) for k in KINDS if dem[k] > cpu["ports"].get(k, 0)]
    if dem["firewall_at_plc"] and not cpu["firewall"]:
        miss.append("firewall at the PLC")
    return miss


# ============================================================================= 2 Modbus RTU codec (bytes)
def crc16(data):
    """CRC-16/MODBUS: poly 0xA001 (reflected 0x8005), init 0xFFFF, low byte first on the wire."""
    crc = 0xFFFF
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc


def frame(pdu):
    c = crc16(pdu)
    return bytes(pdu) + bytes((c & 0xFF, c >> 8))


def check(fr):
    return len(fr) >= 4 and crc16(fr[:-2]) == (fr[-2] | fr[-1] << 8)


def req_read(addr, start, n, fc=3):
    return frame(bytes((addr, fc)) + struct.pack(">HH", start, n))


def req_write1(addr, reg, val):
    return frame(bytes((addr, 6)) + struct.pack(">HH", reg, val & 0xFFFF))


def req_writen(addr, start, vals):
    return frame(bytes((addr, 16)) + struct.pack(">HHB", start, len(vals), 2 * len(vals)) + b"".join(struct.pack(">H", v & 0xFFFF) for v in vals))


def parse_resp(fr, addr, fc):
    """-> ('ok', [regs]) | ('exc', code) | ('crc', None) | ('bad', None)"""
    if not check(fr):
        return "crc", None
    if fr[0] != addr:
        return "bad", None
    if fr[1] == fc | 0x80:
        return "exc", fr[2]
    if fr[1] != fc:
        return "bad", None
    if fc in (3, 4):
        n = fr[2] // 2
        return "ok", list(struct.unpack(">%dH" % n, fr[3:3 + 2 * n]))
    return "ok", list(struct.unpack(">HH", fr[2:6]))


def f32_regs(x):
    h = struct.pack(">f", x)
    return [h[0] << 8 | h[1], h[2] << 8 | h[3]]


def regs_f32(r):
    return struct.unpack(">f", bytes((r[0] >> 8, r[0] & 255, r[1] >> 8, r[1] & 255)))[0]


# ============================================================================= 3 RTU timing (formulas)
def rtu_char(baud, bits=11):
    return 1000.0 * bits / baud


def rtu_gap(baud, bits=11):
    return 3.5 * rtu_char(baud, bits) if baud <= 19200 else 1.75


def t_trans(baud, n_req, n_rsp, t_resp, t_plc, bits=11):
    tc = rtu_char(baud, bits)
    return n_req * tc + rtu_gap(baud, bits) + t_resp + n_rsp * tc + rtu_gap(baud, bits) + t_plc


def rtu_table(d, baud=None):
    R = d["rtu"]
    baud = baud or R["baud"]
    rows = []
    for s in R["slaves"]:
        t = t_trans(baud, 8, 5 + 2 * s["n"], s["t_resp_ms"], R["t_plc_ms"], R["bits_per_char"])
        rows.append(dict(s, t_ms=t))
    worst = sum(r["t_ms"] for r in rows)
    for r in rows:
        r["update_worst_ms"] = r["every"] * worst
        r["ok"] = r["update_worst_ms"] <= r["need_ms"]
    avg = sum(r["t_ms"] / r["every"] for r in rows)
    scale = [r for r in rows if r["every"] == 1][0]
    off = max(rows, key=lambda r: r["t_ms"])
    # one device offline (worst: the slowest one): probed with ONE try -> its slot costs the timeout
    worst_off = worst - off["t_ms"] + R["timeout_ms"]
    return {"baud": baud, "rows": rows, "round_worst_ms": worst, "round_avg_ms": avg,
            "scale_alone_ms": scale["t_ms"], "round_offline_ms": worst_off, "offline_dev": off["tag"],
            "scale_need_ms": scale["need_ms"]}


def line_check(d):
    R = d["rtu"]
    n_ul = len(R["slaves"]) + 1
    return {"unit_loads": n_ul, "ul_ok": n_ul <= R["unit_loads_max"], "length_m": R["line_length_m"],
            "len_ok": R["line_length_m"] <= 1200 and R["baud"] <= 100000 or R["line_length_m"] <= 300,
            "termination": "120 ohm at both ends (master -KF5 and last slave -TB12)", "bias": "bias 390 ohm / 390 ohm at the master only"}


# ============================================================================= 4 virtual RS-485 line (simulated time)
class Slave:
    def __init__(self, addr, regs, t_resp_ms, writable=()):
        self.addr, self.regs, self.t_resp, self.writable = addr, regs, t_resp_ms, set(writable)
        self.fault = None          # None | 'silent' | 'crc' | 'exc'
        self.writes = []

    def handle(self, fr):
        if not check(fr) or fr[0] != self.addr or self.fault == "silent":
            return None
        fc = fr[1]
        if self.fault == "exc":
            return frame(bytes((self.addr, fc | 0x80, 4)))           # 04 slave device failure
        if fc in (3, 4):
            start, n = struct.unpack(">HH", fr[2:6])
            if n < 1 or n > 125 or start + n > len(self.regs):
                return frame(bytes((self.addr, fc | 0x80, 2)))       # 02 illegal data address
            out = frame(bytes((self.addr, fc, 2 * n)) + b"".join(struct.pack(">H", v) for v in self.regs[start:start + n]))
        elif fc == 6:
            reg, val = struct.unpack(">HH", fr[2:6])
            if reg not in self.writable:
                return frame(bytes((self.addr, fc | 0x80, 2)))
            self.regs[reg] = val
            self.writes.append((reg, val))
            out = frame(fr[:6])
        elif fc == 16:
            start, n = struct.unpack(">HH", fr[2:6])
            if any(r not in self.writable for r in range(start, start + n)):
                return frame(bytes((self.addr, fc | 0x80, 2)))
            vals = struct.unpack(">%dH" % n, fr[7:7 + 2 * n])
            for i, v in enumerate(vals):
                self.regs[start + i] = v
            self.writes.append((start, list(vals)))
            out = frame(fr[:6])
        else:
            return frame(bytes((self.addr, fc | 0x80, 1)))           # 01 illegal function
        if self.fault == "crc":
            out = out[:-1] + bytes(((out[-1] ^ 0x5A),))
        return out


def make_slaves(d):
    R = d["rtu"]
    t = {s["addr"]: s["t_resp_ms"] for s in R["slaves"]}
    meter = [0] * 30
    for i, v in enumerate([231.0, 230.4, 232.1, 8.4, 7.9, 8.8, 5.62, 1.9, 0.93, 50.0, 128456.5]):
        meter[2 * i:2 * i + 2] = f32_regs(v)       # U1 U2 U3, I1 I2 I3, P kW, Q kvar, cos phi, f Hz, E kWh
    scale = [0, 0, 0b001, 0] + [0] * 8              # 0-1 gross 0.1 kg INT32, 2 status (b0 stable b1 overload b2 zero), 10 cmd
    ups = [0b001, 96, 268, 34, 41, 0]               # b0 mains ok b1 on battery b2 battery low ; SoC % ; V*10 ; load % ; min ; alarms
    return {1: Slave(1, meter, t[1]), 2: Slave(2, scale, t[2], writable=(10, 11)), 3: Slave(3, ups, t[3])}


def set_weight(slave, kg, stable=True, overload=False):
    v = int(round(kg * 10))
    slave.regs[0], slave.regs[1] = (v >> 16) & 0xFFFF, v & 0xFFFF
    slave.regs[2] = (1 if stable else 0) | (2 if overload else 0) | (4 if abs(kg) < 0.5 else 0)


class Bus:
    """Half-duplex RS-485 line with a simulated clock (ms). The time of every frame follows the formulas of §3."""

    def __init__(self, slaves, baud=19200, bits=11):
        self.slaves, self.baud, self.bits = slaves, baud, bits
        self.now = 0.0

    def txn(self, req, timeout_ms):
        tc = rtu_char(self.baud, self.bits)
        gap = rtu_gap(self.baud, self.bits)
        self.now += len(req) * tc + gap
        sl = self.slaves.get(req[0])
        rsp = sl.handle(req) if sl else None
        if rsp is None:
            self.now += timeout_ms
            return None
        self.now += sl.t_resp + len(rsp) * tc + gap
        return rsp


class Poller:
    """Python mirror of FB_RtuPoller (PLC code plc/asrs_comm_b.scl / .st): schedule, priority window, timeout,
    retries, offline detection with slow probing, data validity, diagnostics counters, write queue."""

    def __init__(self, d, bus):
        R = d["rtu"]
        self.bus, self.R = bus, R
        self.t_plc = R["t_plc_ms"]
        self.sl = {s["addr"]: dict(s, fails=0, offline=False, data=None, t_ok=-1e9, n_ok=0, n_err=0, n_to=0,
                                   n_crc=0, n_exc=0, last_exc=0) for s in R["slaves"]}
        self.round = 0
        self.weigh_window = False      # set by the infeed sequence: only the scale is polled
        self.writes = []               # queue of (addr, reg, [vals])
        self.log = []

    def _one(self, s, retries):
        for attempt in range(retries + 1):
            t0 = self.bus.now
            rsp = self.bus.txn(req_read(s["addr"], s["start"], s["n"], s["fc"]), self.R["timeout_ms"])
            self.bus.now += self.t_plc
            if rsp is None:
                s["n_to"] += 1
                res = "timeout"
            else:
                res, val = parse_resp(rsp, s["addr"], s["fc"])
                if res == "ok":
                    s.update(data=val, t_ok=self.bus.now, fails=0, offline=False)
                    s["n_ok"] += 1
                    self.log.append((round(t0, 2), s["addr"], "ok", round(self.bus.now - t0, 2)))
                    return True
                if res == "exc":
                    s["n_exc"] += 1
                    s["last_exc"] = val
                    self.log.append((round(t0, 2), s["addr"], "exc%d" % val, round(self.bus.now - t0, 2)))
                    return False          # a definite answer: no retry, device stays online
                s["n_crc"] += 1
            self.log.append((round(t0, 2), s["addr"], res, round(self.bus.now - t0, 2)))
        s["n_err"] += 1
        s["fails"] += 1
        if s["fails"] >= self.R["offline_after"]:
            s["offline"] = True
        return False

    def step(self):
        """One poll round."""
        # 1 acyclic writes first (e.g. tare the scale)
        while self.writes:
            a, reg, vals = self.writes.pop(0)
            req = req_write1(a, reg, vals[0]) if len(vals) == 1 else req_writen(a, reg, vals)
            rsp = self.bus.txn(req, self.R["timeout_ms"])
            self.bus.now += self.t_plc
            ok = rsp is not None and parse_resp(rsp, a, req[1])[0] == "ok"
            self.log.append((round(self.bus.now, 2), a, "write_ok" if ok else "write_fail", 0))
        # 2 cyclic reads
        for a, s in self.sl.items():
            if self.weigh_window and s["every"] != 1:
                continue
            if s["offline"]:
                if self.round % 50 == 0:          # slow probe, one try only
                    self._one(s, 0)
                continue
            if self.round % s["every"] == 0:
                self._one(s, self.R["retries"])
        self.round += 1

    def valid(self, addr, max_age_ms):
        s = self.sl[addr]
        return (not s["offline"]) and s["data"] is not None and self.bus.now - s["t_ok"] <= max_age_ms


def scale_value(p):
    r = p.sl[2]["data"]
    v = (r[0] << 16 | r[1])
    if v & 0x80000000:
        v -= 1 << 32
    return v / 10.0, bool(r[2] & 1), bool(r[2] & 2)


def infeed_weight_check(p, max_kg=300.0, max_age_ms=1000.0):
    """Weight part of the infeed check (F4 contour station). Returns (result, asrs.detail): 0 = OK, 23 = contour reject."""
    if not p.valid(2, max_age_ms):
        return "NO_DATA", 23
    kg, stable, over = scale_value(p)
    if over or kg > max_kg:
        return "OVERWEIGHT", 23
    if not stable:
        return "WAIT_STABLE", 0
    return "OK", 0


def run_rtu(d, seconds=10.0, fault=None):
    sl = make_slaves(d)
    if fault:
        k, a = fault.split(":")
        sl[int(a)].fault = k
    bus = Bus(sl, d["rtu"]["baud"], d["rtu"]["bits_per_char"])
    p = Poller(d, bus)
    while bus.now < seconds * 1000.0:
        p.step()
    return p


# ============================================================================= 5 TCP latency, PROFINET, CANopen
def tcp_latency(d):
    T = d["tcp"]
    out = {}
    for case, cp in (("A", 0.0), ("B1", T["cp_transfer_ms"]), ("B2", 0.0)):
        mean = T["poll_s"] * 500.0 + T["net_ms"] + T["ob1_ms"] + cp
        worst = T["poll_s"] * 1000.0 + 2 * T["net_ms"] + 2 * T["ob1_ms"] + 2 * cp
        out[case] = {"mean_ms": mean, "worst_ms": worst, "ok": worst <= T["req_ms"]}
    return out


def pn_load(devs, update_ms):
    bits_out = sum(8 * (max(64, 26 + o) + 20) for _, o, _ in devs)
    bits_in = sum(8 * (max(64, 26 + i) + 20) for _, _, i in devs)
    return 100.0 * max(bits_out, bits_in) / (update_ms * 1e-3 * 100e6)


def profinet(d):
    P = d["profinet"]
    a = pn_load(P["net1_crane"] + P["net2_conv"], P["update_ms"])
    b1 = pn_load(P["net1_crane"], P["update_ms"])
    b2 = pn_load(P["net2_conv"], P["update_ms"])
    return {"A_one_net_pct": a, "B1_net1_pct": b1, "B1_net2_pct": b2, "limit": P["limit_pct"],
            "n_dev_A": len(P["net1_crane"]) + len(P["net2_conv"]), "ok": max(a, b1, b2) <= P["limit_pct"]}


def canopen(d, bitrate=None):
    C = d["canopen"]
    br = (bitrate or C["bitrate_kbit"]) * 1000.0
    n = C["drives"] * C["pdo_per_drive_each_dir"] * 2
    bits = n * 135 + (57 if C["sync"] else 0)
    load = 100.0 * bits / (br * C["cycle_ms"] * 1e-3)
    lmax = dict((k, v) for k, v in C["length_table"]).get(int(br / 1000), 0)
    return {"bitrate_kbit": br / 1000, "frames": n, "bits": bits, "load_pct": load, "ok": load <= C["limit_pct"],
            "len_max_m": lmax, "len_ok": C["length_m"] <= lmax}


# ============================================================================= 6 SVG pages (reuse asrs_elec.Page)
def pages(d, sel):
    import asrs_elec as E
    P = []

    def fin(p):
        return p.svg().replace("/ P10</text>", "/ P13</text>").replace("asrs_elec.py (generated)", "asrs_comm.py (generated) - Case B")

    # ---- P11 Case B1 network
    p = E.Page("P11", "Case B1: expansion comm. modules (S7-1500)", [])
    p.t(60, 70, "Case B1 - S7-1500 rack with expansion communication modules (design, module classes 'or equal' [verify])", 16, weight="bold")
    x0, y0, w = 120, 120, 120
    rack = [("PS 60W", "slot 0", "#eeeeee"), ("CPU 1515F", "-KF2 X1 X2", "#e6f0ff"), ("CP 1543-1", "-KF3 factory", "#ffe9cc"),
            ("CM 1542-1", "-KF4 PN net 2", "#e6f0ff"), ("CM PtP 485", "-KF5 RTU", "#e8f7e8")]
    for i, (a, b, f) in enumerate(rack):
        p.r(x0 + i * w, y0, w - 6, 110, fill=f)
        p.t(x0 + i * w + 8, y0 + 30, a, 12, weight="bold"); p.t(x0 + i * w + 8, y0 + 50, b, 11)
    p.t(820, 205, "backplane: CPU feed %.0f W + PS %.0f W >= modules %.1f W" % (d["cpus"]["S7-1515F-2PN"]["backplane_W"], 60, sel["W"]), 11)
    # factory side
    p.r(820, 110, 470, 70, fill="#eeeeee"); p.t(830, 135, "VLAN 720 factory - L3 core firewall - fmsctl 10.70.1.10", 12, weight="bold")
    p.t(830, 155, "zone 'Factory' (IEC 62443 SL 1-2)", 11)
    p.l(x0 + 2 * w + 57, y0, x0 + 2 * w + 57, 95, 2.5, "#c06000"); p.l(x0 + 2 * w + 57, 95, 1050, 95, 2.5, "#c06000"); p.l(1050, 95, 1050, 110, 2.5, "#c06000")
    p.t(560, 90, "conduit: CP firewall - only TCP 502 from 10.70.1.10, HTTPS 443 from the ES", 11, color="#c06000")
    # machine zone; rows ordered so that no drop line crosses a box: RTU, net 2, X2, net 1
    p.r(60, 330, 1280, 470, dash="8 5"); p.t(900, 350, "zone 'AS/RS machine' (not routed): conduits only through -KF3", 12, weight="bold", color="#555")
    BL, GR = "#2a6fbb", "#2a8a2a"

    def row(xd, y, col, label, boxes, x_start, bw, pitch):
        p.l(xd, y0 + 110, xd, y, 2.5, col); p.l(xd, y, 1300, y, 2.5, col); p.t(xd + 6, y - 8, label, 11, color=col)
        for i, (a, b) in enumerate(boxes):
            xx = x_start + i * pitch
            p.l(xx + 60, y, xx + 60, y + 15, 2, col); p.r(xx, y + 15, bw, 40, fill="#fff")
            p.t(xx + 6, y + 32, a, 11, weight="bold"); p.t(xx + 6, y + 47, b, 10)

    row(x0 + 4 * w + 57, 400, GR, "-KF5 RS-485 Modbus RTU 19.2 kbit/s 8E1 (page P12)",
        [("%s  addr %d" % (s["tag"].split("-")[-1], s["addr"]), s["name"].split(" (")[0][:30]) for s in d["rtu"]["slaves"]], 720, 190, 200)
    row(x0 + 3 * w + 57, 500, BL, "-KF4 PROFINET net 2 (conveyors, F4)",
        [("CV1/CV2/CV3 inverters", "telegram 1 + STO"), ("-BG110/-BG111 scanners", "crate ID (F6)"), ("F4 conveyor IM", "reserve")], 620, 200, 220)
    p.l(x0 + w + 40, y0 + 110, x0 + w + 40, 600, 2.5, BL); p.l(x0 + w + 40, 600, 600, 600, 2.5, BL)
    p.t(x0 + w + 46, 592, "X2 192.168.10.0/24 (machine zone)", 11, color=BL)
    for xx, a, b in ((300, "-PF100 HMI", "192.168.10.55"), (440, "ES port", "service laptop")):
        p.l(xx + 60, 600, xx + 60, 615, 2, BL); p.r(xx, 615, 130, 40, fill="#fff"); p.t(xx + 6, 632, a, 11, weight="bold"); p.t(xx + 6, 647, b, 10)
    row(x0 + w + 15, 700, BL, "X1 PROFINET net 1 (crane) 4 ms",
        [("-KF20 ground IM", "F-DI/DI/DQ"), ("-KF70/-KF71 DDLS", "optical link"), ("-KF30 crane IM", "F-DI/DI/DQ"),
         ("drives travel/hoist/fork", "PROFIsafe STO/SS1"), ("-BG15 laser / -BG45 BPS", "positions")], 260, 190, 210)
    P.append(("P11", fin(p)))

    # ---- P12 RS-485 wiring
    p = E.Page("P12", "Case B: RS-485 Modbus RTU line 1", [])
    p.t(60, 70, "RS-485 Modbus RTU line 1 - wiring (2-wire + common), daisy chain, no stubs > 0.5 m", 16, weight="bold")
    ys = {"D1 (B/+)": 200, "D0 (A/-)": 240, "Common (0 V)": 280}
    for nm, y in ys.items():
        p.l(160, y, 1250, y, 2.0, "#2a8a2a" if "D" in nm else "#666"); p.t(1260, y + 4, nm, 11)
    nodes = [("-KF5 CM PtP", "master, bias + 120 ohm"), ("-PG1 energy meter", "addr 1"), ("-BW92T weighing", "addr 2"), ("-TB12 UPS", "addr 3, 120 ohm")]
    for i, (a, b) in enumerate(nodes):
        x = 200 + i * 320
        p.r(x - 60, 330, 170, 70, fill="#fff"); p.t(x - 52, 355, a, 12, weight="bold"); p.t(x - 52, 375, b, 11)
        for y in ys.values():
            p.l(x, y, x, 330, 1.2); p.c(x, y, 3, "#000")
    for x in (200, 1160):
        p.r(x - 30, 205, 18, 30, fill="#ffeecc"); p.t(x - 70, 195, "120 ohm", 10)
    p.r(110, 115, 30, 40, fill="#ffeecc"); p.t(150, 135, "bias +5 V / 390 ohm (D1), 390 ohm to 0 V (D0) - at the master only", 10)
    p.t(60, 460, "Cable: twisted pair 2 x 2 x 0.25 mm2 shielded, Z0 = 120 ohm (Modbus over serial line spec.); one pair D1/D0, one wire Common.", 12)
    p.t(60, 482, "Shield: both ends to the cabinet EMC rail, 360 degree clamp; potential bonding conductor >= 6 mm2 in parallel (IEC 61000-5-2 practice).", 12)
    lc = line_check(d)
    p.t(60, 504, "Length %d m (limit 1200 m at <= 100 kbit/s), unit loads %d (limit %d). Parity 8E1, 19 200 bit/s; addresses unique 1..247." % (lc["length_m"], lc["unit_loads"], d["rtu"]["unit_loads_max"]), 12)
    rt = rtu_table(d)
    p.t(60, 540, "Poll table (calculated, asrs_comm.py):", 13, weight="bold")
    yy = 562
    for r in rt["rows"]:
        p.t(80, yy, "addr %d %-26s FC%02d reg %d n=%2d  t=%.1f ms  every %d round(s)  update <= %.0f ms (need %d ms) %s" % (
            r["addr"], r["name"].split(" (")[0][:26], r["fc"], r["start"], r["n"], r["t_ms"], r["every"], r["update_worst_ms"], r["need_ms"], "OK" if r["ok"] else "NOT OK"), 11)
        yy += 20
    p.t(80, yy + 6, "worst round %.0f ms; one device offline -> %.0f ms; weighing window (scale only) %.0f ms." % (
        rt["round_worst_ms"], rt["round_offline_ms"], rt["scale_alone_ms"]), 11)
    P.append(("P12", fin(p)))

    # ---- P13 Case B2 Delta
    p = E.Page("P13", "Case B2: Delta AS on the crane + expansion", [])
    p.t(60, 70, "Case B2 - Delta AS300 PLC rides on the crane; expansion cards AS-FEN02 + AS-FCOPM [verify]; hard-wired safety controller", 16, weight="bold")
    p.r(80, 110, 560, 110, fill="#eeeeee"); p.t(90, 135, "VLAN 720 - fmsctl 10.70.1.10 - Modbus TCP client", 12, weight="bold")
    p.r(700, 110, 260, 60, fill="#ffe9cc"); p.t(710, 135, "-KF91 external firewall", 12, weight="bold"); p.t(710, 155, "rules = firewall_rules.csv", 10)
    p.l(640, 140, 700, 140, 2.5, "#c06000")
    p.l(830, 170, 830, 260, 2.5, "#c06000"); p.r(700, 260, 260, 50, fill="#e6f0ff"); p.t(710, 290, "-KF90 switch (ground)", 12, weight="bold")
    p.l(830, 310, 830, 360, 2.5, "#2a6fbb"); p.r(700, 360, 260, 50, fill="#fff"); p.t(710, 390, "-KF70 / -KF71 data light barrier", 11, weight="bold")
    p.l(830, 410, 830, 470, 2.5, "#2a6fbb")
    p.r(640, 470, 520, 120, fill="#e6f0ff"); p.t(650, 495, "crane cabinet +CC: -KF2 AS332P (CPU Ethernet = factory, 10.70.20.51)", 11, weight="bold")
    p.t(650, 515, "card 1 AS-FEN02: 2nd Ethernet 192.168.0.1 -> ground remote I/O (conveyors, scale);", 10)
    p.t(650, 531, "  VLAN 721 tagged over the same DDLS (managed switches at both ends), not routed", 10)
    p.t(650, 551, "card 2 AS-FCOPM: CANopen 500 kbit/s -> travel / hoist / fork drives (nodes 1-3)", 10)
    p.t(650, 571, "COM1 RS-485: Modbus RTU energy meter / UPS on the crane; scale via ground remote I/O", 10)
    p.l(900, 590, 900, 650, 2.5, "#7a3fb0"); p.l(660, 650, 1200, 650, 2.5, "#7a3fb0"); p.t(910, 642, "CANopen (120 ohm both ends)", 11, color="#7a3fb0")
    for i, a in enumerate(["travel drive node 1", "hoist drive node 2", "fork drive node 3"]):
        xx = 680 + i * 180
        p.l(xx + 60, 650, xx + 60, 665, 2, "#7a3fb0"); p.r(xx, 665, 160, 36, fill="#fff"); p.t(xx + 6, 688, a, 11)
    p.r(80, 300, 520, 150, fill="#fff4e6"); p.t(90, 325, "Safety (no PROFIsafe on Delta AS):", 12, weight="bold")
    for i, s in enumerate(["safety controller (configurable, PL e) on the crane + on the ground",
                           "STO hard-wired 2-channel to each drive, SS1 by the safety controller",
                           "ground <-> crane safety signals over a SAFE optical link or",
                           "safety-rated radio (PL d) - NOT over the Modbus/DDLS data link",
                           "=> SF1-SF7 of Part B redesigned at the same PL (item F8)"]):
        p.t(90, 348 + 20 * i, "- " + s, 11)
    cn = canopen(d)
    p.t(80, 760, "CANopen load %.1f %% at %d kbit/s (limit %.0f %%), length %d m <= %d m. Modbus TCP over the DDLS: polling 0.2 s, <= 10 kbit/s." % (
        cn["load_pct"], cn["bitrate_kbit"], d["canopen"]["limit_pct"], d["canopen"]["length_m"], cn["len_max_m"]), 12)
    P.append(("P13", fin(p)))
    return P


# ============================================================================= 7 report
def build(d):
    sel = {c: select_modules(d, c) for c in ("A", "B1", "B2")}
    return {"sel": sel, "miss": {c: builtin_ok(d, c) for c in sel}, "rtu": rtu_table(d),
            "rtu_baud": {b: rtu_table(d, b) for b in (9600, 19200, 38400, 115200)}, "line": line_check(d),
            "tcp": tcp_latency(d), "pn": profinet(d), "can": canopen(d), "can250": canopen(d, 250)}


def report(d, R):
    L = ["# AS/RS Case B - expansion communication modules (asrs_comm.py)", "",
         "All values: DESIGN or REFERENCE ESTIMATE. Module names are classes 'or equal' [verify in the current catalogue].", "",
         "## 1 Interface demand and the module selection", "",
         "| Case | CPU | demand PN_IO / ETH / RS485 / CAN / firewall | built-in enough? | cheapest module set | comm. modules EUR | backplane W (avail.) |",
         "|---|---|---|---|---|---|---|"]
    for c, (best, feas) in R["sel"].items():
        dm = d["demand"][c]
        L.append("| %s | %s | %d / %d / %d / %d / %s | %s | %s | %d | %.1f (%.0f) |" % (
            c, best["cpu"], dm["PN_IO"], dm["ETH"], dm["RS485"], dm["CAN"], "yes" if dm["firewall_at_plc"] else "no",
            "yes" if not R["miss"][c] else "no: " + ", ".join(R["miss"][c]),
            " + ".join(("%dx %s" % (n, k) if n > 1 else k) for k, n in best["modules"]) or "none", best["comm_EUR"], best["W"], best["W_avail"]))
    L += ["", "Feasible alternatives (first 3 by price):", ""]
    for c, (best, feas) in R["sel"].items():
        for f in feas[:3]:
            L.append("- %s: %s -> %d EUR" % (c, " + ".join(k if n == 1 else "%dx %s" % (n, k) for k, n in f["modules"]) or "none", f["price_EUR"]))
    rt = R["rtu"]
    L += ["", "## 2 Modbus RTU line (19.2 kbit/s 8E1)", "",
          "| addr | device | FC | regs | t_trans ms | every | update worst ms | need ms | ok |", "|---|---|---|---|---|---|---|---|---|"]
    for r in rt["rows"]:
        L.append("| %d | %s | %02d | %d | %.1f | %d | %.0f | %d | %s |" % (r["addr"], r["name"], r["fc"], r["n"], r["t_ms"], r["every"], r["update_worst_ms"], r["need_ms"], "yes" if r["ok"] else "NO"))
    L += ["", "- Worst round (all due): %.1f ms; mean round %.1f ms." % (rt["round_worst_ms"], rt["round_avg_ms"]),
          "- One device offline (%s, one probe = timeout %d ms): round %.0f ms > %d ms need of the scale -> **weighing window**: during a crate weighing only the scale is polled: %.1f ms." % (
              rt["offline_dev"], d["rtu"]["timeout_ms"], rt["round_offline_ms"], rt["scale_need_ms"], rt["scale_alone_ms"]),
          "", "| baud | worst round ms | scale update ok |", "|---|---|---|"]
    for b, t in R["rtu_baud"].items():
        L.append("| %d | %.1f | %s |" % (b, t["round_worst_ms"], "yes" if t["rows"][1]["ok"] else "NO"))
    lc = R["line"]
    L += ["", "- Line: %d m, %d unit loads; %s; %s." % (lc["length_m"], lc["unit_loads"], lc["termination"], lc["bias"]), "",
          "## 3 Modbus TCP latency of a WMS command", "", "| Case | mean ms | worst ms | requirement | ok |", "|---|---|---|---|---|"]
    for c, t in R["tcp"].items():
        L.append("| %s | %.0f | %.0f | %d | %s |" % (c, t["mean_ms"], t["worst_ms"], d["tcp"]["req_ms"], "yes" if t["ok"] else "NO"))
    pn, cn, c2 = R["pn"], R["can"], R["can250"]
    L += ["", "## 4 PROFINET and CANopen load", "",
          "- PROFINET Case A one network (%d devices): %.2f %%; Case B1 net 1 %.2f %%, net 2 %.2f %% (limit %.0f %%)." % (pn["n_dev_A"], pn["A_one_net_pct"], pn["B1_net1_pct"], pn["B1_net2_pct"], pn["limit"]),
          "  Bandwidth is NOT the reason for the 2nd network; the reasons are fault isolation, F4 commissioning without the crane, and the line topology through the data light barrier.",
          "- CANopen Case B2: %d PDO frames + SYNC per %.0f ms = %d bit -> %.1f %% at %d kbit/s (%.1f %% at 250 kbit/s -> %s); length %d m <= %d m." % (
              cn["frames"], d["canopen"]["cycle_ms"], cn["bits"], cn["load_pct"], cn["bitrate_kbit"], c2["load_pct"], "too high" if not c2["ok"] else "ok", d["canopen"]["length_m"], cn["len_max_m"]),
          "", "## 5 When to choose which case", "",
          "| Question | Case A (built-in) | Case B (expansion modules) |", "|---|---|---|",
          "| Ports needed <= ports of the CPU, no serial devices | yes - cheapest | not needed |",
          "| Plant security asks for a firewall AT the machine (IEC 62443 conduit) | external firewall needed | CP with firewall (B1) |",
          "| Serial devices (energy meter, weighing terminal, UPS, older drives) | gateway needed | RS-485 module / card |",
          "| Separate networks for crane and conveyors (F4) | one network, more devices | 2nd IO controller (B1) |",
          "| PLC family without PROFIsafe (Delta) | - | CANopen drives + hard-wired safety (B2) |",
          "| Extra cost (comm hardware) | 0 | B1 %d EUR, B2 %d EUR |" % (R["sel"]["B1"][0]["comm_EUR"], R["sel"]["B2"][0]["comm_EUR"]), ""]
    return "\n".join(L)


def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)


def cmd_run(d, out):
    os.makedirs(out, exist_ok=True)
    R = build(d)
    with open(os.path.join(out, "comm_report.md"), "w", encoding="utf-8") as fh:
        fh.write(report(d, R))
    rows = []
    for c, (best, _) in R["sel"].items():
        rows.append([c, best["cpu"], " + ".join(k for k, _ in best["modules"]) or "-", best["comm_EUR"], round(best["W"], 1), best["W_avail"],
                     R["tcp"][c]["worst_ms"], "yes" if best["firewall"] else "no"])
    write_csv(os.path.join(out, "case_compare.csv"), ["case", "cpu", "modules", "comm_EUR", "backplane_W", "W_avail", "tcp_worst_ms", "firewall_at_plc"], rows)
    bom = []
    tags = {"CP1543-1": "=ASRS1+GC-KF3", "CM1542-1": "=ASRS1+GC-KF4", "CM_PtP_RS485_HF": "=ASRS1+GC-KF5", "PS60W": "=ASRS1+GC-GB1",
            "AS-FEN02": "=ASRS1+CC-KF2.C1", "AS-FCOPM": "=ASRS1+CC-KF2.C2", "AS00SCM-A": "=ASRS1+CC-KF6", "EXT-FW": "=ASRS1+GC-KF91"}
    for c in ("B1", "B2"):
        for k, n in R["sel"][c][0]["modules"]:
            m = d["modules"][k]
            bom.append([c, tags.get(k, ""), k, n, m["price_EUR"], m["note"]])
    for s in d["rtu"]["slaves"]:
        bom.append(["B1/B2", s["tag"], "Modbus RTU slave", 1, "", s["name"]])
    write_csv(os.path.join(out, "modules_bom.csv"), ["case", "tag", "type", "qty", "price_EUR_ref", "note"], bom)
    write_csv(os.path.join(out, "ip_plan.csv"), ["case", "interface", "address", "network", "use"], d["ip_plan"])
    write_csv(os.path.join(out, "firewall_rules.csv"), ["no", "action", "source", "destination", "service", "purpose"], d["firewall_rules"])
    write_csv(os.path.join(out, "rtu_poll_table.csv"), ["addr", "tag", "device", "fc", "start", "n", "t_trans_ms", "every", "update_worst_ms", "need_ms", "ok"],
              [[r["addr"], r["tag"], r["name"], r["fc"], r["start"], r["n"], round(r["t_ms"], 2), r["every"], round(r["update_worst_ms"], 1), r["need_ms"], r["ok"]] for r in R["rtu"]["rows"]])
    p = run_rtu(d, 5.0, "silent:1")
    write_csv(os.path.join(out, "rtu_sim_log.csv"), ["t_ms", "addr", "result", "duration_ms"], p.log[:400])
    for no, svg in pages(d, R["sel"]["B1"][0]):
        with open(os.path.join(out, no + ".svg"), "w", encoding="utf-8") as fh:
            fh.write(svg)
    print(report(d, R))
    print("\nwritten to", out)


# ============================================================================= 8 self-test
def selftest(d):
    res = []

    def ck(name, c):
        res.append((name, bool(c)))
        print(("PASS " if c else "FAIL ") + name)

    R = build(d)
    a, b1, b2 = R["sel"]["A"][0], R["sel"]["B1"][0], R["sel"]["B2"][0]
    ck("Case A: built-in ports are enough, no module", not R["miss"]["A"] and a["modules"] == [])
    ck("Case B1: built-in NOT enough (PN_IO, ETH, RS485, firewall missing)", len(R["miss"]["B1"]) == 4)
    ck("Case B1 optimum = CP1543-1 + CM1542-1 + CM PtP + PS60W", sorted(k for k, _ in b1["modules"]) == sorted(["CP1543-1", "CM1542-1", "CM_PtP_RS485_HF", "PS60W"]))
    ck("Case B1 backplane: modules %.1f W > CPU feed 10 W, so the PS is required" % b1["W"], b1["W"] > 10.0 and b1["W"] <= b1["W_avail"])
    ck("Case B2 optimum = AS-FEN02 + AS-FCOPM + external firewall (RS-485 built in)", sorted(k for k, _ in b2["modules"]) == sorted(["AS-FEN02", "AS-FCOPM", "EXT-FW"]))
    # brute-force cross-check of the optimiser: no cheaper feasible set exists
    feas = R["sel"]["B1"][1]
    ck("optimiser: best = minimum of all %d feasible B1 sets" % len(feas), all(b1["price_EUR"] <= f["price_EUR"] for f in feas))
    # codec
    ck("CRC-16/MODBUS known vector 01 03 00 00 00 0A -> C5 CD", req_read(1, 0, 10)[-2:] == bytes((0xC5, 0xCD)))
    ck("CRC check '123456789' = 0x4B37 (CRC catalogue)", crc16(b"123456789") == 0x4B37)
    ck("FC03 frame lengths: request 8, response 5+2n", len(req_read(1, 0, 30)) == 8 and len(make_slaves(d)[1].handle(req_read(1, 0, 30))) == 65)
    ck("float32 big-endian word order round trip", abs(regs_f32(f32_regs(128456.5)) - 128456.5) < 0.01)
    sl = make_slaves(d)
    ck("exception 02 for an illegal address", parse_resp(sl[2].handle(req_read(2, 0, 50)), 2, 3) == ("exc", 2))
    ck("FC06 write to a protected register -> exception", parse_resp(sl[2].handle(req_write1(2, 0, 5)), 2, 6)[0] == "exc")
    ck("FC16 write tare command -> echo + register set", parse_resp(sl[2].handle(req_writen(2, 10, [1, 0])), 2, 16)[0] == "ok" and sl[2].regs[10] == 1)
    # timing: simulation == formula
    rt = R["rtu"]
    p = run_rtu(d, 3.0)
    dur = {}
    for t0, adr, r, dt in p.log:
        dur.setdefault(adr, dt)
    ok = all(abs(dur[r["addr"]] - r["t_ms"]) < 0.05 for r in rt["rows"])
    ck("simulated transaction times = formula (%s ms)" % ", ".join("%.1f" % dur[k] for k in sorted(dur)), ok)
    ck("19.2 kbit/s: scale update worst %.0f ms <= 200 ms" % rt["rows"][1]["update_worst_ms"], rt["rows"][1]["ok"])
    ck("9.6 kbit/s: scale update NOT ok (%.0f ms) -> 19.2 kbit/s chosen" % R["rtu_baud"][9600]["rows"][1]["update_worst_ms"], not R["rtu_baud"][9600]["rows"][1]["ok"])
    ck("one device offline breaks the 200 ms (%.0f ms) -> weighing window gives %.1f ms" % (rt["round_offline_ms"], rt["scale_alone_ms"]),
       rt["round_offline_ms"] > 200 and rt["scale_alone_ms"] < 200)
    # fault handling in the mirror poller
    p = run_rtu(d, 5.0, "silent:1")
    s1 = p.sl[1]
    ck("silent meter -> offline after 3 failed polls, scale still valid", s1["offline"] and p.valid(2, 1000) and s1["n_to"] >= 3 * (d["rtu"]["retries"] + 1))
    p.bus.slaves[1].fault = None
    t_end = p.bus.now + 15000
    while p.bus.now < t_end:
        p.step()
    ck("meter back -> found by the slow probe, online again", not p.sl[1]["offline"] and p.valid(1, 15000))
    p = run_rtu(d, 3.0, "crc:3")
    ck("CRC errors counted, UPS data never accepted", p.sl[3]["n_crc"] > 0 and p.sl[3]["data"] is None)
    p = run_rtu(d, 2.0, "exc:3")
    ck("exception -> no retry, device not offline, code 4 stored", not p.sl[3]["offline"] and p.sl[3]["last_exc"] == 4 and p.sl[3]["n_to"] == 0)
    # weighing / infeed logic
    sl = make_slaves(d)
    bus = Bus(sl, 19200)
    p = Poller(d, bus)
    set_weight(sl[2], 286.4)
    p.weigh_window = True
    p.step(); p.step()
    r1 = infeed_weight_check(p)
    set_weight(sl[2], 312.0)
    p.step()
    r2 = infeed_weight_check(p)
    set_weight(sl[2], 250.0, stable=False)
    p.step()
    r3 = infeed_weight_check(p)
    sl[2].fault = "silent"
    t_end = bus.now + 1500
    while bus.now < t_end:
        p.step()
    r4 = infeed_weight_check(p)
    ck("infeed weight check: 286.4 kg OK, 312 kg reject 23, unstable wait, scale dead -> reject 23",
       r1 == ("OK", 0) and r2 == ("OVERWEIGHT", 23) and r3 == ("WAIT_STABLE", 0) and r4 == ("NO_DATA", 23))
    sl[2].fault = None
    p.writes.append((2, 10, [1]))
    p.step()
    ck("acyclic write (tare) executed before the cyclic reads", sl[2].writes and sl[2].writes[-1] == (10, 1))
    # TCP, PROFINET, CANopen, network
    t = R["tcp"]
    ck("Modbus TCP worst latency A %.0f / B1 %.0f ms <= 1000 ms (CP adds %.0f ms)" % (t["A"]["worst_ms"], t["B1"]["worst_ms"], t["B1"]["worst_ms"] - t["A"]["worst_ms"]),
       t["A"]["ok"] and t["B1"]["ok"] and t["B1"]["worst_ms"] > t["A"]["worst_ms"])
    ck("PROFINET loads < 50 %% (A %.2f %%, B1 %.2f / %.2f %%)" % (R["pn"]["A_one_net_pct"], R["pn"]["B1_net1_pct"], R["pn"]["B1_net2_pct"]), R["pn"]["ok"])
    ck("CANopen 500 kbit/s load %.1f %% ok, length ok; 250 kbit/s too high (%.1f %%)" % (R["can"]["load_pct"], R["can250"]["load_pct"]),
       R["can"]["ok"] and R["can"]["len_ok"] and not R["can250"]["ok"])
    ips = [r[2] for r in d["ip_plan"] if "/" in r[2]]
    per_case = {}
    for r in d["ip_plan"]:
        if "/" in r[2]:
            per_case.setdefault(r[0], []).append(r[2].split("/")[0])
    ck("IP plan: addresses unique within each case; factory address 10.70.20.51 kept in all cases (fmsctl unchanged)",
       all(len(v) == len(set(v)) for v in per_case.values()) and all("10.70.20.51" in v for v in per_case.values()) and ips)
    fr = d["firewall_rules"]
    ck("firewall: last rule default deny, Modbus 502 only from the cell controller", fr[-1][1] == "deny" and fr[-1][2] == "any"
       and all(r[2] == "10.70.1.10" for r in fr if "502" in r[4] and r[1] == "allow"))
    ck("RS-485 line: unit loads and length inside the limits", R["line"]["ul_ok"] and R["line"]["len_ok"])
    n = sum(1 for _, c in res if c)
    print("\n%d/%d checks passed" % (n, len(res)))
    return n == len(res)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sp = ap.add_subparsers(dest="cmd")
    sp.add_parser("selftest")
    r = sp.add_parser("run"); r.add_argument("--out", default=os.path.join(HERE, "out", "comm"))
    q = sp.add_parser("rtu"); q.add_argument("--seconds", type=float, default=10.0); q.add_argument("--fault", default=None)
    a = ap.parse_args(argv)
    d = load()
    sys.path.insert(0, HERE)
    if a.cmd == "selftest":
        sys.exit(0 if selftest(d) else 1)
    elif a.cmd == "run":
        cmd_run(d, a.out)
    elif a.cmd == "rtu":
        p = run_rtu(d, a.seconds, a.fault)
        for row in p.log[:80]:
            print("%9.2f ms  addr %d  %-9s %6.2f ms" % row)
        for k, s in p.sl.items():
            print("addr %d ok %d err %d timeouts %d crc %d exc %d offline %s" % (k, s["n_ok"], s["n_err"], s["n_to"], s["n_crc"], s["n_exc"], s["offline"]))
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
