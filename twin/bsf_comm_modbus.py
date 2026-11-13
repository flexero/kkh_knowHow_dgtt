"""
Ball screw + guide factory (item 4) - Modbus TCP SERVER (plant simulator, 73 machines) and Modbus TCP CLIENT.
Guide: docs/43_bsf_communication_modbus_http.md chapters 6 - 8.  Standard library only (socket, socketserver, threading).

PlantSim      register images of all 73 machines (unit id 1 ... 73), updated 10 times per second from
              (a) a twin snapshot (the browser posts B.snapshot() -> POST /api/bsf/snapshot) when it is fresh, or
              (b) a simple own state model (states, counters, process values with noise),
              plus the MES command handshake (cmd.ctl REQ toggle -> hs.status ACK, BUSY, DONE).
ModbusServer  one TCP server (default port 1502; real machines use 502) - the unit id selects the machine, like a
              Modbus gateway. Function codes 01, 03, 04, 05, 06, 16; exceptions 01, 02, 03, 04, 0B. Fault injection
              per unit: offline (no answer), slow (answer after 0.6 s), exc04 (device failure), cdab (REAL words swapped);
              global "netloss" (no answers at all). Writes FC06 / FC16 only to 200 - 226 (map V1.1: 226 = gateway
              heartbeat; each unit remembers when 226 last changed = the PLC "gateway lost" watchdog, 5 s).
ModbusClient  blocking client with time-out, transaction-id check, reconnect after a time-out.
ALL VALUES ARE EXAMPLES.
"""

from __future__ import annotations

import math
import random
import socket
import socketserver
import struct
import threading
import time

from twin.bsf_comm_map import (MACHINES, MACHINE_BY_UNIT, MAP_SIZE, MAP_VERSION, GW_HB_ADDR, TYPE_BY_ID, TYPE_MAPS, SIGFIELDS,
                               encode_value, decode_value, regs_to_ascii, adu, hexs)

STATES = {"OFF": (0, 7), "IDLE": (1, 1), "RUN": (2, 0), "SETUP": (3, 2), "DOWN": (4, 3), "BLOCKED": (5, 5), "STARVED": (6, 6)}
# nominal process values (running value, idle value, noise amplitude) - examples
NOMINAL = {
    "wheelSpeed_ms": (35, 0, 0), "spindlePower_pct": (65, 0, 8), "wheelDia_mm": (398, 398, 0.01), "oilTemp_C": (20, 20, 0.25), "gaugeDev_um": (0, 0, 1.5),
    "workSpeed_rpm": (40, 0, 0), "leadComp_um_m": (-11.5, -11.5, 0.4), "screwTemp_C": (20.2, 20.2, 0.2), "wheelTilt_deg": (5.51, 5.51, 0),
    "freq_kHz": (30, 0, 0), "scan_mm_s": (4, 0, 0), "quenchFlow_l_min": (120, 0, 4), "quenchTemp_C": (25, 25, 1), "polymer_pct": (10, 10, 0.2),
    "energyPart_kJ": (8280, 0, 80), "zone1_C": (920, 850, 2), "zone2_C": (920, 850, 2.5), "zone3_C": (920, 850, 1.8), "zone4_C": (920, 850, 2.2),
    "carbonPot_pct": (1.1, 0.8, 0.02), "co_pct": (20, 20, 0.5), "remain_min": (120, 0, 0), "runoutBefore_um": (300, 0, 40), "runoutAfter_um": (18, 0, 3),
    "force_kN": (45, 0, 10), "stroke_mm": (0.6, 0, 0.3), "ep_um": (12, 12, 6), "vup_um": (14, 14, 4), "v300_um": (9, 9, 3), "v2pi_um": (4, 4, 1.5),
    "matTemp_C": (20, 20, 0.15), "torqueMean_Nm": (0.29, 0, 0.03), "torqueVar_Nm": (0.05, 0, 0.01), "drag_N": (15, 0, 2), "spindle_rpm": (1800, 0, 0),
    "spindleLoad_pct": (60, 0, 10), "bathTemp_C": (55, 55, 1), "conduct_uS": (1800, 1800, 80), "belt_m_min": (1, 0, 0),
}
POWER = {"RUN": 0.55, "SETUP": 0.15, "IDLE": 0.15, "STARVED": 0.15, "BLOCKED": 0.15, "DOWN": 0.05, "OFF": 0.02}


class Unit:
    """Register image + own state model + handshake of one machine."""

    def __init__(self, m, rnd):
        self.m = m
        self.type = m["type"]
        self.unit = m["unit"]
        self.regs = [0] * MAP_SIZE
        self.lock = threading.Lock()
        self.fault = "none"
        self.R = rnd
        self.state = "RUN" if rnd.random() < 0.6 else "IDLE"
        self.until = time.time() + rnd.uniform(20, 120)
        self.good = rnd.randint(200, 5000)
        self.scrap = self.good // 120
        self.energy = rnd.uniform(500, 20000)
        self.cycle = rnd.uniform(60, 900)
        self.last_cycle = self.cycle
        self.kw = rnd.uniform(3, 40)              # example connected power (own model only)
        self.alarm = 0
        self.order = f"LOT-{rnd.randint(1, 999):04d}"
        self.part = ""
        self.phase = rnd.random() * 6.28
        self.hb = 0
        self.next_piece = time.time() + rnd.uniform(5, 30)
        # handshake / MES lot
        self.ack = 0
        self.busy = False
        self.done_t = 0
        self.reject = False
        self.ack_seq = 0
        self.result = 0
        self.lot = None              # {"order", "part", "qty", "done", "next"}
        self.pending_cmd = None      # (time to execute, code, seq)
        self.alarm_cleared_until = 0
        self.recipe = 0
        self.good_ofs = 0
        self.gw_hb_last = None       # last seen value of register 226 (gateway heartbeat, map V1.1)
        self.gw_hb_t = 0.0           # time of the last CHANGE of 226 (PLC watchdog: older than 5 s = gateway lost)
        self.regs[0] = MAP_VERSION
        self.regs[1] = TYPE_BY_ID[self.type]["code"]
        self.regs[2] = self.unit

    # ---------------------------------------------------------------- own model
    def own_values(self, now):
        R = self.R
        if now > self.until:
            r = R.random()
            if self.state == "DOWN":
                self.state, self.alarm = "IDLE", 0
            elif r < 0.62:
                self.state = "RUN"
            elif r < 0.75:
                self.state = "IDLE"
            elif r < 0.85:
                self.state = "SETUP"
            elif r < 0.93:
                self.state = "STARVED"
            else:
                self.state = "DOWN"
                self.alarm = R.choice([101, 102, 201, 202, 301, 401, 501, 601, 701, 801, 152])
            self.until = now + (R.uniform(60, 300) if self.state == "RUN" else R.uniform(15, 90))
        if self.state == "RUN" and now > self.next_piece:
            self.next_piece = now + R.uniform(8, 25)
            if R.random() < 0.01:
                self.scrap += 1
            else:
                self.good += 1
            self.last_cycle = self.cycle * R.uniform(0.95, 1.06)
        run = self.state == "RUN"
        kw = self.kw
        pw = kw * POWER[self.state] * (1 + 0.05 * math.sin(now / 7 + self.phase))
        self.energy += pw * 0.1 / 3600
        sig = {"std": {"status": 1 << STATES[self.state][1], "mode": 2 if self.state == "SETUP" else 1, "stateCode": STATES[self.state][0],
                       "good": self.good, "scrap": self.scrap, "lastCycle_s": round(self.last_cycle, 1), "alarm": self.alarm,
                       "order": self.order if run or self.state == "SETUP" else "", "part": self.part, "power_kW": round(pw, 2), "energy_kWh": round(self.energy, 2)}}
        for g in TYPE_BY_ID[self.type]["sig"]:
            if g == "std":
                continue
            d = {}
            for f, typ, unit, mean in SIGFIELDS[g]:
                if typ == "REAL":
                    a, b, nz = NOMINAL.get(f, (1.0, 0.0, 0.05))
                    if g == "ind" and f == "power_kW":
                        a, b, nz = 36, 0, 1
                    d[f] = round((a if run else b) + nz * math.sin(now / 5.3 + self.phase + len(f)), 3)
                else:
                    d[f] = {"dressCount": self.good // 10, "pass": 1 + int(now / 20) % 7 if run else 0, "passes": 7, "energyOK": 1 if run else 0,
                            "loadNo": self.good // 50, "step": 1 + int(now / 60) % 5 if run else 0, "bends": 2 if run else 0, "grade": 5,
                            "result": 1, "cls": 1, "toolNo": 1 + int(now / 30) % 12 if run else 0, "toolLife_pct": max(0, 100 - (self.good % 200) // 2),
                            "feedOvr_pct": 100}.get(f, 0)
            sig[g] = d
        return sig

    # ---------------------------------------------------------------- write the register image
    def write_values(self, sig):
        vals = {}
        for g, d in sig.items():
            for k, v in d.items():
                vals[f"{g}.{k}"] = v
        st = vals.get("std.stateCode", 1)
        # MES lot overrides (the machine shows the order that the MES loaded)
        if self.lot:
            vals["std.order"] = self.lot["order"]
            vals["std.part"] = self.lot["part"]
        vals["std.good"] = int(vals.get("std.good", 0)) + self.good_ofs
        if self.alarm_cleared_until > time.time():
            vals["std.alarm"] = 0
        vals["hs.status"] = (self.ack & 1) | (2 if self.busy else 0) | (4 if self.done_t & 1 else 0) | (8 if self.reject else 0) | \
            (16 if (not self.busy and vals.get("std.mode", 1) == 1 and st != 4) else 0)
        vals["hs.ackSeq"] = self.ack_seq
        vals["hs.result"] = self.result
        vals["hs.lotDone"] = self.lot["done"] if self.lot else 0
        vals["hdr.heartbeat"] = self.hb
        vals["hdr.mapVersion"] = MAP_VERSION
        vals["hdr.typeCode"] = TYPE_BY_ID[self.type]["code"]
        vals["hdr.unitId"] = self.unit
        with self.lock:
            for r in TYPE_MAPS[self.type]:
                if r["block"] == "command":
                    continue
                if r["name"] in vals:
                    try:
                        enc = encode_value(r["type"], vals[r["name"]])
                    except (TypeError, ValueError):
                        continue
                    self.regs[r["addr"]:r["addr"] + r["n"]] = enc

    # ---------------------------------------------------------------- handshake (machine side, like a PLC program)
    GW_WATCHDOG_S = 5.0

    def gw_ok(self, now=None):
        """PLC watchdog (map V1.1): register 226 changed within the last 5 s."""
        return self.gw_hb_t > 0 and (now or time.time()) - self.gw_hb_t <= self.GW_WATCHDOG_S

    def handshake(self, now, sig):
        with self.lock:
            hbv = self.regs[GW_HB_ADDR]
            if hbv != self.gw_hb_last:
                if self.gw_hb_last is not None:
                    self.gw_hb_t = now
                self.gw_hb_last = hbv
            req = self.regs[202] & 1
            code, seq = self.regs[200], self.regs[201]
            order = regs_to_ascii(self.regs[203:213])
            part = regs_to_ascii(self.regs[213:223])
            recipe = self.regs[223]
            qty = (self.regs[224] << 16) | self.regs[225]
        if req != (self.ack & 1) and self.pending_cmd is None:
            self.pending_cmd = (now + 0.15, code, seq, order, part, qty, recipe)     # PLC needs a few scan cycles
        if self.pending_cmd and now >= self.pending_cmd[0]:
            _, code, seq, order, part, qty, recipe = self.pending_cmd
            self.pending_cmd = None
            std = sig.get("std", {})
            ready = std.get("stateCode", 1) != 4 and std.get("mode", 1) == 1
            res = 0
            if code == 1:
                if not order or qty <= 0 or qty > 100000:
                    res = 3
                elif self.busy:
                    res = 4
                elif not ready:
                    res = 2
                else:
                    self.lot = {"order": order, "part": part, "qty": qty, "done": 0, "next": now + 1.0,
                                "dt": max(0.3, min(2.0, 20.0 / qty))}
                    self.busy = True
                    self.recipe = recipe
            elif code == 2:
                res = 0 if ready else 2
                if ready and self.state != "DOWN":
                    self.state, self.until = "RUN", now + 120
            elif code == 3:
                if self.lot:
                    self.busy = False
                    self.lot = None
                self.state, self.until = "IDLE", now + 60
            elif code == 4:
                self.alarm = 0
                if self.state == "DOWN":
                    self.state, self.until = "IDLE", now + 30
                self.alarm_cleared_until = now + 30
            elif code == 5:
                if recipe == 0:
                    res = 3
                else:
                    self.recipe = recipe
            else:
                res = 1
            self.result, self.reject, self.ack_seq = res, res != 0, seq
            self.ack = req
        if self.lot and now >= self.lot["next"]:
            self.lot["done"] += 1
            self.good_ofs += 1
            self.lot["next"] = now + self.lot["dt"]
            if self.lot["done"] >= self.lot["qty"]:
                self.busy = False
                self.done_t += 1
                self.lot["next"] = 1e18

    def finish_lot_cleanup(self, now):
        if self.lot and not self.busy and self.lot["next"] > 1e17:
            # keep the last lot visible 10 s after DONE, then clear it
            self.lot.setdefault("cleared", now + 10)
            if now > self.lot["cleared"]:
                self.lot = None


class PlantSim:
    """All 73 machines. source() -> snapshot dict {"machines": [...]} or None (then the own model runs)."""

    def __init__(self, source=None, seed=7):
        self.R = random.Random(seed)
        self.units = {m["unit"]: Unit(m, random.Random(seed * 100 + m["unit"])) for m in MACHINES}
        self.by_id = {u.m["id"]: u for u in self.units.values()}
        self.source = source
        self.mode = "own"
        self.netloss = False
        self._stop = threading.Event()
        self._t = None
        self.t_hb = time.time()
        self.updates = 0

    def start(self):
        self._stop.clear()
        self._t = threading.Thread(target=self._run, name="bsf-plantsim", daemon=True)
        self._t.start()

    def stop(self):
        self._stop.set()
        if self._t:
            self._t.join(2)

    def _run(self):
        while not self._stop.is_set():
            try:
                self.step()
            except Exception as e:  # never let the simulator thread die
                print("bsf plant sim:", e)
            self._stop.wait(0.1)

    def step(self):
        now = time.time()
        snap = self.source() if self.source else None
        bymach = {m["id"]: m for m in snap.get("machines", [])} if snap else {}
        self.mode = "twin" if bymach else "own"
        hb = now - self.t_hb >= 1.0
        if hb:
            self.t_hb = now
        for u in self.units.values():
            if hb:
                u.hb = (u.hb + 1) & 0xFFFF
            s = bymach.get(u.m["id"])
            sig = s.get("sig") if s and isinstance(s.get("sig"), dict) and "std" in s["sig"] else u.own_values(now)
            u.handshake(now, sig)
            u.finish_lot_cleanup(now)
            u.write_values(sig)
        self.updates += 1


# ====================================================================== Modbus TCP server
class _Handler(socketserver.BaseRequestHandler):
    def handle(self):
        sock = self.request
        sock.settimeout(None)
        sim: PlantSim = self.server.sim
        buf = b""
        while True:
            try:
                chunk = sock.recv(4096)
            except OSError:
                return
            if not chunk:
                return
            buf += chunk
            while len(buf) >= 7:
                ln = struct.unpack(">H", buf[4:6])[0]
                if ln < 2 or ln > 254:
                    return                                  # garbage: close the connection (as real devices do)
                if len(buf) < 6 + ln:
                    break
                frame, buf = buf[:6 + ln], buf[6 + ln:]
                self.server.frames += 1
                resp, delay = serve(sim, frame)
                if resp is None:
                    continue                                # no answer (offline / net loss)
                if delay:
                    time.sleep(delay)
                try:
                    sock.sendall(resp)
                except OSError:
                    return


def serve(sim: PlantSim, frame: bytes):
    """One request ADU -> (response ADU or None, delay s)."""
    tid, proto, ln, unit = struct.unpack(">HHHB", frame[:7])
    pdu = frame[7:]
    fc = pdu[0]

    def exc(code):
        return adu(tid, unit, bytes([fc | 0x80, code]))

    if proto != 0:
        return None, 0
    if sim.netloss:
        return None, 0
    u = sim.units.get(unit)
    if u is None:
        return exc(0x0B), 0                                  # gateway: target device failed to respond
    if u.fault == "offline":
        return None, 0
    delay = 0.6 if u.fault == "slow" else 0
    if u.fault == "exc04":
        return exc(0x04), delay
    body = pdu[1:]
    try:
        if fc in (3, 4):
            start, qty = struct.unpack(">HH", body[:4])
            if qty < 1 or qty > 125:
                return exc(0x03), delay
            if start + qty > MAP_SIZE:
                return exc(0x02), delay
            with u.lock:
                regs = list(u.regs[start:start + qty])
            if u.fault == "cdab":                            # wrong word order configured in the device
                for r in TYPE_MAPS[u.type]:
                    if r["type"] == "REAL" and r["addr"] >= start and r["addr"] + 2 <= start + qty:
                        i = r["addr"] - start
                        regs[i], regs[i + 1] = regs[i + 1], regs[i]
            return adu(tid, unit, struct.pack(">BB", fc, 2 * qty) + b"".join(struct.pack(">H", v) for v in regs)), delay
        if fc == 1:
            start, qty = struct.unpack(">HH", body[:4])
            if qty < 1 or qty > 2000:
                return exc(0x03), delay
            if start + qty > 32:
                return exc(0x02), delay
            with u.lock:
                word = u.regs[4] | (u.regs[8] << 16)
            bits = [(word >> (start + i)) & 1 for i in range(qty)]
            data = bytearray((qty + 7) // 8)
            for i, b in enumerate(bits):
                data[i // 8] |= b << (i % 8)
            return adu(tid, unit, bytes([1, len(data)]) + bytes(data)), delay
        if fc == 5:
            addr, val = struct.unpack(">HH", body[:4])
            if val not in (0, 0xFF00):
                return exc(0x03), delay
            if addr != 100:
                return exc(0x02), delay
            if val == 0xFF00:                                # coil 100 = acknowledge alarm (shortcut of command 4)
                u.alarm = 0
                u.alarm_cleared_until = time.time() + 30
            return adu(tid, unit, pdu[:5]), delay
        if fc == 6:
            addr, val = struct.unpack(">HH", body[:4])
            if not 200 <= addr < MAP_SIZE:                  # command block 200 - 226 (226 = gateway heartbeat, V1.1)
                return exc(0x02), delay
            with u.lock:
                u.regs[addr] = val
            return adu(tid, unit, pdu[:5]), delay
        if fc == 16:
            start, qty, bc = struct.unpack(">HHB", body[:5])
            if qty < 1 or qty > 123 or bc != 2 * qty or len(body) < 5 + bc:
                return exc(0x03), delay
            if start < 200 or start + qty > MAP_SIZE:
                return exc(0x02), delay
            vals = [struct.unpack(">H", body[5 + 2 * i:7 + 2 * i])[0] for i in range(qty)]
            with u.lock:
                u.regs[start:start + qty] = vals
            return adu(tid, unit, struct.pack(">BHH", 16, start, qty)), delay
    except struct.error:
        return exc(0x03), delay
    return exc(0x01), delay


class ModbusServer(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = False

    def __init__(self, sim: PlantSim, host="127.0.0.1", port=1502):
        self.sim = sim
        self.frames = 0
        super().__init__((host, port), _Handler)

    def start(self):
        self._t = threading.Thread(target=self.serve_forever, kwargs={"poll_interval": 0.2}, name="bsf-modbus-server", daemon=True)
        self._t.start()

    def stop(self):
        try:
            self.shutdown()
        finally:
            self.server_close()


# ====================================================================== Modbus TCP client
class ModbusError(Exception):
    def __init__(self, kind, msg, code=None):
        super().__init__(msg)
        self.kind = kind          # "timeout" | "exception" | "offline" | "protocol"
        self.code = code


class ModbusClient:
    """One TCP connection to one Modbus TCP server (host:port). Not thread-safe - one owner thread."""

    def __init__(self, host, port, timeout=0.3):
        self.host, self.port, self.timeout = host, port, timeout
        self.sock = None
        self.tid = 0
        self.tx = self.rx = 0

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except OSError:
                pass
        self.sock = None

    def _connect(self):
        try:
            self.sock = socket.create_connection((self.host, self.port), timeout=max(0.2, self.timeout))
            self.sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except OSError as e:
            self.sock = None
            raise ModbusError("offline", f"connect {self.host}:{self.port} failed: {e}")

    def next_tid(self):
        self.tid = (self.tid + 1) & 0xFFFF
        return self.tid

    def transact(self, frame: bytes):
        """Send one ADU, return (response ADU, round-trip s). Raises ModbusError."""
        if self.sock is None:
            self._connect()
        tid = struct.unpack(">H", frame[:2])[0]
        t0 = time.perf_counter()
        try:
            self.sock.settimeout(self.timeout)
            self.sock.sendall(frame)
            self.tx += len(frame)
            while True:
                hdr = self._recv(7, t0)
                ln = struct.unpack(">H", hdr[4:6])[0]
                rest = self._recv(ln - 1, t0)
                resp = hdr + rest
                self.rx += len(resp)
                if struct.unpack(">H", hdr[:2])[0] == tid:
                    break                                      # late answers to older requests are dropped
        except socket.timeout:
            self.close()                                       # reconnect: a late answer can never be mixed up
            raise ModbusError("timeout", f"no answer within {self.timeout * 1000:.0f} ms")
        except OSError as e:
            self.close()
            raise ModbusError("offline", f"connection lost: {e}")
        return resp, time.perf_counter() - t0

    def _recv(self, n, t0):
        b = b""
        while len(b) < n:
            left = self.timeout - (time.perf_counter() - t0)
            if left <= 0:
                raise socket.timeout()
            self.sock.settimeout(left)
            c = self.sock.recv(n - len(b))
            if not c:
                raise OSError("closed by the server")
            b += c
        return b


def check_response(req: bytes, resp: bytes):
    """Raise ModbusError for an exception response; return the PDU otherwise."""
    pdu = resp[7:]
    if pdu[0] & 0x80:
        raise ModbusError("exception", f"exception {pdu[1]:02X}", pdu[1])
    if pdu[0] != req[7]:
        raise ModbusError("protocol", "function code of the answer does not match")
    return pdu


def regs_of(pdu: bytes):
    bc = pdu[1]
    return [struct.unpack(">H", pdu[2 + 2 * i:4 + 2 * i])[0] for i in range(bc // 2)]


__all__ = ["PlantSim", "ModbusServer", "ModbusClient", "ModbusError", "check_response", "regs_of", "serve", "hexs", "decode_value"]
