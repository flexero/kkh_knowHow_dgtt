"""
Ball screw + guide factory (tab "Ball screw + guide factory", item 4) - COMMUNICATION: Modbus TCP gateway + HTTP API.
Guide: docs/43_bsf_communication_modbus_http.md.  Standard library only.

Map V1.1 (2026-11-13): besides the FC03 polls (fast 0 - 11, counters 20 - ..., energy 100 - 103) the gateway writes the
gateway heartbeat register 226 with FC06 once per second per device (+1 per write, wraps 65535 -> 0) - the PLC watchdog.
Load (73 machines, defaults): 226.3 reads/s + 73 heartbeat writes/s = 299.3 requests/s.

Company rule: machines / PLCs <-> gateway = Modbus TCP only; everything above the gateway = HTTP only (REST + JSON,
Server-Sent Events for live push). No MQTT, no OPC UA. Safety is hard-wired.

INERT UNTIL STARTED: importing this module starts nothing. The embedded Modbus simulator (default 127.0.0.1:1502) and
the gateway threads start only with POST /api/bsf/control {"action": "start"} and stop with {"action": "stop"}.

Used by server.py (routes /api/bsf/...) and by tools/bsf_gateway.py (standalone gateway with its own small HTTP server).

HTTP API (all JSON; /api/bsf/v1/... is the same as /api/bsf/...)
  GET  /api/bsf/status                 gateway state, statistics, devices summary
  GET  /api/bsf/machines               73 devices: id, ip, unit, status, rtt, age, main values
  GET  /api/bsf/machine?id=BS-TGR-03   one device: all decoded values + quality + register map
  GET  /api/bsf/frames?n=40[&since=s]  last Modbus frames (hex + decoded)
  GET  /api/bsf/events?since=N&wait=20 report-by-exception changes (long polling)
  GET  /api/bsf/stream                 Server-Sent Events every 1 s (status + changed values)
  GET  /api/bsf/map  | /api/bsf/map.csv register maps, IP plan
  GET  /api/bsf/control                running?, configuration
  POST /api/bsf/control                {"action": "start", "simPort": 1502, "sim": true, "fast_ms": 500, ...}
                                       {"action": "stop"} | {"action": "config", ...} | {"action": "fault", "id": "BS-TGR-03",
                                       "fault": "none|offline|slow|exc04|cdab"} | {"action": "netloss", "on": true}
                                       {"action": "probe", "kind": "badunit|badaddr|badfc|badqty|cdab"}
                                       {"action": "raw", "hex": "00 01 00 00 00 06 0F 03 00 00 00 0C"} (frame builder)
  POST /api/bsf/command                {"id": "BS-TGR-03", "cmd": "order|start|stop|ack|recipe", "order": "WO-1", "part": "...",
                                       "qty": 20, "recipe": 12, "msgId": "uuid"}   (FC16 write + toggle-bit handshake)
  POST /api/bsf/snapshot               twin snapshot from the browser (B.snapshot() reduced) -> feeds the simulator
  GET  /api/bsf/snapshot               the stored snapshot (the standalone simulator can read it)
  GET  /api/bsf/api                    API catalogue (this list as JSON)
  MES / ERP / AGV / printer demo APIs: see twin/bsf_comm_api.py
ALL VALUES ARE EXAMPLES.
"""

from __future__ import annotations

import collections
import json
import threading
import time
import uuid

from twin import bsf_comm_map as MAP
from twin.bsf_comm_modbus import PlantSim, ModbusServer, ModbusClient, ModbusError, check_response, regs_of

VERSION = "bsf_comm 1.1 (map V1.1)"
MAIN_FIELDS = ["std.status", "std.stateCode", "std.alarm", "std.good", "std.scrap", "std.order", "std.power_kW"]
DEADBAND = {"°C": 0.2, "µm": 0.5, "µm/m": 0.5, "%": 1.0, "%C": 0.02, "kW": 0.5, "kWh": 1.0, "s": 0.5, "min⁻¹": 5.0, "N·m": 0.01, "N": 0.5,
            "m/s": 0.5, "mm": 0.05, "kJ": 50.0, "l/min": 2.0, "kN": 1.0, "mm/s": 0.5, "kHz": 0.5, "µS/cm": 20.0, "m/min": 0.1, "°": 0.05, "min": 1.0}
SKIP_EVENTS = {"hdr.heartbeat", "std.energy_kWh"}
META = {t: {r["name"]: r for r in MAP.TYPE_MAPS[t]} for t in MAP.TYPE_IDS}


def _now():
    return time.time()


# ====================================================================== device state (gateway side)
class Device:
    def __init__(self, m):
        self.m = m
        self.id = m["id"]
        self.type = m["type"]
        self.unit = m["unit"]
        self.groups = MAP.poll_groups(self.type)                     # reads (FC03)
        self.writes = [("gwhb", MAP.GW_HB_ADDR, 1)]                  # map V1.1: gateway heartbeat write (FC06 226, every gwhb_ms)
        self.sched = self.groups + self.writes
        self.gw_hb = 0               # value the gateway writes next into register 226 (+1 per write, wraps 65535 -> 0)
        self.values = {}
        self.t_ok = {}               # group -> last good answer time
        self.next = {}               # group -> next due time
        self.status = "unknown"
        self.err = ""
        self.exc = None
        self.fails = 0
        self.rtt = 0.0               # last round-trip ms
        self.rtt_avg = 0.0
        self.n_ok = self.n_err = 0
        self.changes = 0


class Gateway:
    """Polls all devices with N worker threads. Thread-safe read access through snapshot methods."""

    def __init__(self, cfg):
        self.cfg = dict(MAP.POLL_DEFAULT)
        self.cfg.update({"workers": 4, "target": "sim", "simHost": "127.0.0.1", "simPort": 1502, "order": "ABCD", "frameLog": 400})
        self.cfg.update(cfg or {})
        self.devs = [Device(m) for m in MAP.MACHINES]
        self.by_id = {d.id: d for d in self.devs}
        self.lock = threading.RLock()
        self.frames = collections.deque(maxlen=int(self.cfg["frameLog"]))
        self.fseq = 0
        self.events = collections.deque(maxlen=3000)
        self.eseq = 0
        self.cond = threading.Condition(self.lock)
        self.stats = {"req": 0, "ok": 0, "timeout": 0, "exception": 0, "offline": 0, "tx": 0, "rx": 0, "rttSum": 0.0, "rttMax": 0.0,
                      "reads": 0, "hbWrites": 0}
        self.hist = collections.deque(maxlen=12)       # (t, req, tx + rx, rttSum, ok)
        self.rate = {"reqPerS": 0.0, "bytesPerS": 0.0, "rttAvgMs": 0.0, "okPerS": 0.0}
        self._stop = threading.Event()
        self.threads = []
        self.t_start = 0.0
        self.cmd_cache = collections.OrderedDict()
        self.cmd_tid = 0x7000

    # ---------------------------------------------------------------- addressing
    def addr_of(self, d: Device):
        t = self.cfg["target"]
        if t == "plan":
            return d.m["ip"], d.m["port"]
        if t == "sim":
            return self.cfg["simHost"], int(self.cfg["simPort"])
        host, _, port = str(t).partition(":")
        return host, int(port or 502)

    # ---------------------------------------------------------------- threads
    def start(self):
        self._stop.clear()
        self.t_start = _now()
        n = max(1, int(self.cfg["workers"]))
        now = _now()
        for i, d in enumerate(self.devs):                # spread the first polls over one fast period
            ofs = (i / len(self.devs)) * self.cfg["fast_ms"] / 1000
            d.next = {g: now + ofs + (0.05 if g != "fast" else 0) for g, _, _ in d.sched}
        for w in range(n):
            mine = self.devs[w::n]
            t = threading.Thread(target=self._worker, args=(mine,), name=f"bsf-gw-{w}", daemon=True)
            t.start()
            self.threads.append(t)
        t = threading.Thread(target=self._house, name="bsf-gw-stats", daemon=True)
        t.start()
        self.threads.append(t)

    def stop(self):
        self._stop.set()
        for t in self.threads:
            t.join(2)
        self.threads = []
        with self.cond:
            self.cond.notify_all()

    def period(self, g):
        return {"fast": self.cfg["fast_ms"], "counters": self.cfg["counters_ms"], "energy": self.cfg["energy_ms"],
                "gwhb": self.cfg["gwhb_ms"]}[g] / 1000.0

    def _worker(self, devs):
        clients = {}
        while not self._stop.is_set():
            now = _now()
            due = []
            nxt = now + 0.5
            for d in devs:
                for g, st, q in d.sched:
                    t = d.next.get(g, now)
                    if t <= now:
                        due.append((d, g, st, q))
                    elif t < nxt:
                        nxt = t
            for d, g, st, q in due:
                if self._stop.is_set():
                    break
                key = self.addr_of(d)
                cl = clients.get(key)
                if cl is None:
                    cl = clients[key] = ModbusClient(key[0], key[1], self.cfg["timeout_ms"] / 1000)
                cl.timeout = self.cfg["timeout_ms"] / 1000
                if g == "gwhb":
                    self._hb_write(cl, d, st)
                else:
                    self._poll(cl, d, g, st, q)
                per = self.period(g)
                if d.fails >= 3:                       # back-off: a dead device must not slow the others
                    per = max(per, 2.0) if g == "fast" else max(per, 10.0)
                d.next[g] = _now() + per if d.next.get(g, 0) < _now() - per else d.next[g] + per
            if not due:
                self._stop.wait(max(0.001, min(0.5, nxt - _now())))
        for c in clients.values():
            c.close()

    def _poll(self, cl: ModbusClient, d: Device, g, st, q):
        tid = cl.next_tid()
        req = MAP.req_read(tid, d.unit, st, q)
        tx0, rx0 = cl.tx, cl.rx
        try:
            for attempt in range(int(self.cfg["retries"]) + 1):
                try:
                    resp, rtt = cl.transact(req)
                    break
                except ModbusError as e:
                    if e.kind != "timeout" or attempt >= int(self.cfg["retries"]):
                        raise
                    tid = cl.next_tid()
                    req = MAP.req_read(tid, d.unit, st, q)
            pdu = check_response(req, resp)
            regs = regs_of(pdu)
            vals = MAP.decode_block(d.type, st, regs, self.cfg["order"])
            self._ok(d, g, vals, rtt, req, resp, cl.tx - tx0, cl.rx - rx0)
        except ModbusError as e:
            self._fail(d, g, e, req, cl.tx - tx0, cl.rx - rx0, resp=getattr(e, "resp", None))

    def _hb_write(self, cl: ModbusClient, d: Device, addr):
        """Map V1.1: FC06 write of the gateway heartbeat (+1 per write) - the PLC watchdog sees 'gateway alive'."""
        val = (d.gw_hb + 1) & 0xFFFF
        tid = cl.next_tid()
        req = MAP.req_write1(tid, d.unit, addr, val)
        tx0, rx0 = cl.tx, cl.rx
        try:
            for attempt in range(int(self.cfg["retries"]) + 1):
                try:
                    resp, rtt = cl.transact(req)
                    break
                except ModbusError as e:
                    if e.kind != "timeout" or attempt >= int(self.cfg["retries"]):
                        raise
                    tid = cl.next_tid()
                    req = MAP.req_write1(tid, d.unit, addr, val)
            check_response(req, resp)
            d.gw_hb = val
            ms = rtt * 1000
            with self.lock:
                S = self.stats
                S["req"] += 1
                S["ok"] += 1
                S["hbWrites"] += 1
                S["tx"] += cl.tx - tx0
                S["rx"] += cl.rx - rx0
                S["rttSum"] += ms
                S["rttMax"] = max(S["rttMax"], ms)
                d.rtt = ms
                d.rtt_avg = ms if d.rtt_avg == 0 else 0.9 * d.rtt_avg + 0.1 * ms
                d.n_ok += 1
                d.fails = 0
                d.t_ok["gwhb"] = _now()
                self._log(d, "gwhb", "ok", req, resp, ms, f"FC06 gateway heartbeat {addr} = {val} (echo)")
        except ModbusError as e:
            self._fail(d, "gwhb", e, req, cl.tx - tx0, cl.rx - rx0, resp=getattr(e, "resp", None))

    def _log(self, d, g, kind, req, resp, rtt_ms, text, vals=None):
        self.fseq += 1
        e = {"seq": self.fseq, "t": round(_now(), 3), "id": d.id if d else "-", "unit": d.unit if d else 0, "group": g, "kind": kind,
             "req": MAP.hexs(req) if req else "", "resp": MAP.hexs(resp) if resp else "", "rttMs": round(rtt_ms, 2), "text": text}
        if vals:
            e["values"] = vals
        self.frames.append(e)

    def _ok(self, d: Device, g, vals, rtt, req, resp, tx, rx):
        ms = rtt * 1000
        now = _now()
        with self.lock:
            S = self.stats
            S["req"] += 1
            S["ok"] += 1
            S["reads"] += 1
            S["tx"] += tx
            S["rx"] += rx
            S["rttSum"] += ms
            S["rttMax"] = max(S["rttMax"], ms)
            d.rtt = ms
            d.rtt_avg = ms if d.rtt_avg == 0 else 0.9 * d.rtt_avg + 0.1 * ms
            d.n_ok += 1
            d.fails = 0
            d.status, d.err, d.exc = "online", "", None
            first = g not in d.t_ok
            d.t_ok[g] = now
            # report-by-exception: changes beyond the dead-band (first read of a group: no events)
            regs_meta = META[d.type]
            for k, v in vals.items():
                if first:
                    break
                old = d.values.get(k)
                if k in SKIP_EVENTS or old == v:
                    continue
                if old is not None and isinstance(v, float) and isinstance(old, (int, float)):
                    db = DEADBAND.get(regs_meta.get(k, {}).get("unit", ""), 0.0)
                    if abs(v - old) <= max(db, abs(old) * 0.01):     # dead-band: absolute per unit or 1 % of the value
                        continue
                self.eseq += 1
                d.changes += 1
                self.events.append({"seq": self.eseq, "t": round(now, 3), "id": d.id, "name": k, "old": old, "new": v})
            d.values.update(vals)
            short = {k: vals[k] for k in vals if k in ("std.status", "std.stateCode", "std.alarm", "std.good", "std.power_kW", "hs.status", "std.lastCycle_s", "hdr.heartbeat")}
            self._log(d, g, "ok", req, resp, ms, f"FC03 {g} {len(resp) - 9} B data", short)
            self.cond.notify_all()

    def _fail(self, d: Device, g, e: ModbusError, req, tx, rx, resp=None):
        with self.lock:
            S = self.stats
            S["req"] += 1
            S["tx"] += tx
            S["rx"] += rx
            S[e.kind if e.kind in S else "offline"] += 1
            d.n_err += 1
            d.fails += 1
            d.status = {"timeout": "timeout", "exception": "exception", "offline": "offline"}.get(e.kind, "error")
            d.err = str(e)
            d.exc = e.code
            txt = f"exception {e.code:02X} {MAP.EXC_NAMES.get(e.code, '')}" if e.kind == "exception" else str(e)
            self._log(d, g, e.kind, req, resp, 0, txt)

    def _house(self):
        while not self._stop.is_set():
            with self.lock:
                S = self.stats
                self.hist.append((_now(), S["req"], S["tx"] + S["rx"], S["rttSum"], S["ok"]))
                if len(self.hist) >= 2:
                    a, b = self.hist[0], self.hist[-1]
                    dt = max(1e-6, b[0] - a[0])
                    dok = b[4] - a[4]
                    self.rate = {"reqPerS": round((b[1] - a[1]) / dt, 1), "bytesPerS": round((b[2] - a[2]) / dt, 0),
                                 "rttAvgMs": round((b[3] - a[3]) / dok, 3) if dok else 0.0, "okPerS": round(dok / dt, 1)}
            self._stop.wait(1.0)

    # ---------------------------------------------------------------- views
    def quality(self, d: Device, now=None):
        now = now or _now()
        t = d.t_ok.get("fast")
        age = (now - t) * 1000 if t else None
        limit = 3 * self.cfg["fast_ms"] + self.cfg["timeout_ms"] * (1 + self.cfg["retries"])
        return {"ageMs": round(age) if age is not None else None, "stale": age is None or age > limit, "staleLimitMs": limit}

    def dev_row(self, d: Device, now=None):
        q = self.quality(d, now)
        return {"id": d.id, "type": d.type, "unit": d.unit, "ip": d.m["ip"], "host": d.m["host"], "vlan": d.m["vlan"],
                "status": "stale" if (q["stale"] and d.status == "online") else d.status, "err": d.err, "exc": d.exc,
                "rttMs": round(d.rtt, 2), "rttAvgMs": round(d.rtt_avg, 2), "ok": d.n_ok, "errors": d.n_err, "changes": d.changes,
                "quality": q, "main": {k: d.values.get(k) for k in MAIN_FIELDS}}

    def status(self):
        now = _now()
        with self.lock:
            rows = [self.dev_row(d, now) for d in self.devs]
            S = dict(self.stats)
            S["rttAvgMs"] = round(S.pop("rttSum") / S["ok"], 3) if S["ok"] else 0
            cnt = collections.Counter(r["status"] for r in rows)
            return {"running": True, "uptime_s": round(now - self.t_start, 1), "cfg": self.cfg, "totals": S, "rate": dict(self.rate),
                    "devices": dict(cnt), "online": cnt.get("online", 0), "n": len(rows), "eventSeq": self.eseq, "frameSeq": self.fseq}

    def machines(self):
        now = _now()
        with self.lock:
            return [self.dev_row(d, now) for d in self.devs]

    def machine(self, mid):
        d = self.by_id.get(mid)
        if not d:
            raise KeyError(mid)
        with self.lock:
            r = self.dev_row(d)
            r["values"] = dict(d.values)
            r["groups"] = d.groups
            r["writes"] = d.writes
            r["gwHeartbeat"] = d.gw_hb
            r["tOk"] = {g: round(t, 3) for g, t in d.t_ok.items()}
            return r

    def frames_since(self, n=40, since=0):
        with self.lock:
            out = [f for f in self.frames if f["seq"] > since]
            return out[-n:]

    def events_since(self, since=0, wait=0.0, n=500):
        end = _now() + min(30.0, max(0.0, wait))
        with self.cond:
            while True:
                out = [e for e in self.events if e["seq"] > since]
                if out or _now() >= end or self._stop.is_set():
                    return {"seq": self.eseq, "events": out[-n:]}
                self.cond.wait(max(0.05, end - _now()))

    # ---------------------------------------------------------------- MES -> machine command (FC16 + handshake)
    def command(self, body):
        mid = body.get("id")
        d = self.by_id.get(mid)
        if not d:
            raise KeyError(f"machine {mid}")
        msg = str(body.get("msgId") or "")
        if msg and msg in self.cmd_cache:
            r = dict(self.cmd_cache[msg])
            r["replay"] = True
            return r
        code = {"order": 1, "start": 2, "stop": 3, "ack": 4, "recipe": 5}.get(str(body.get("cmd", "")).lower())
        if code is None:
            code = int(body.get("code", 0) or 0)
        host, port = self.addr_of(d)
        cl = ModbusClient(host, port, max(0.5, self.cfg["timeout_ms"] / 1000))
        cl.tid = self.cmd_tid
        steps, t0 = [], time.perf_counter()

        def tx(frame, text):
            resp, rtt = cl.transact(frame)
            dec = MAP.decode_frame(resp, "resp")
            steps.append({"ms": round((time.perf_counter() - t0) * 1000, 1), "text": text, "req": MAP.hexs(frame), "resp": MAP.hexs(resp),
                          "rttMs": round(rtt * 1000, 2), "decoded": dec.get("text", "")})
            with self.lock:
                self._log(d, "command", "cmd", frame, resp, rtt * 1000, text)
            return check_response(frame, resp)

        try:
            ctl = regs_of(tx(MAP.req_read(cl.next_tid(), d.unit, 200, 3), "1 read cmd.code / cmd.seq / cmd.ctl (200 - 202)"))
            hs = regs_of(tx(MAP.req_read(cl.next_tid(), d.unit, 8, 3), "2 read hs.status / ackSeq / result (8 - 10)"))
            if (ctl[2] & 1) != (hs[0] & 1):
                raise ModbusError("protocol", "previous command still open (REQ != ACK) - wait or reset the machine handshake")
            seq = (ctl[1] + 1) & 0xFFFF
            data = [code, seq, ctl[2]] + MAP.ascii_to_regs(str(body.get("order", "")), 10) + MAP.ascii_to_regs(str(body.get("part", "")), 10) + \
                [int(body.get("recipe", 0) or 0) & 0xFFFF] + MAP.encode_value("UINT32", int(body.get("qty", 0) or 0))
            tx(MAP.req_writen(cl.next_tid(), d.unit, 200, data), f"3 FC16 write command block 200 - 225 (code {code} {MAP.CMD_CODES.get(code, '?')}, seq {seq}), REQ unchanged (226 = gateway heartbeat, written separately)")
            req_new = (ctl[2] ^ 1) & 0xFFFF
            tx(MAP.req_write1(cl.next_tid(), d.unit, 202, req_new), f"4 FC06 toggle REQ: cmd.ctl = {req_new} (written LAST)")
            ack = None
            deadline = time.perf_counter() + 3.0
            n = 0
            while time.perf_counter() < deadline:
                time.sleep(0.1)
                n += 1
                hs = regs_of(tx(MAP.req_read(cl.next_tid(), d.unit, 8, 4), f"5.{n} poll hs.status until ACK = REQ"))
                if (hs[0] & 1) == (req_new & 1) and hs[1] == seq:
                    ack = hs
                    break
            if ack is None:
                res = {"ok": False, "error": "handshake time-out (no ACK within 3 s)", "steps": steps}
            else:
                res = {"ok": ack[2] == 0, "result": ack[2], "resultText": MAP.RESULTS.get(ack[2], "?"), "ackSeq": ack[1],
                       "busy": bool(ack[0] & 2), "reject": bool(ack[0] & 8), "steps": steps}
        except ModbusError as e:
            res = {"ok": False, "error": str(e), "kind": e.kind, "steps": steps}
        finally:
            self.cmd_tid = cl.tid
            cl.close()
        res.update({"id": mid, "code": code, "cmd": MAP.CMD_CODES.get(code, "?"), "ms": round((time.perf_counter() - t0) * 1000, 1), "msgId": msg or None})
        if msg:
            self.cmd_cache[msg] = res
            while len(self.cmd_cache) > 200:
                self.cmd_cache.popitem(last=False)
        return res

    def raw(self, hx):
        """Send one frame built on the page (frame builder) to the Modbus target and return both frames decoded."""
        req = MAP.parse_hex(hx)
        if len(req) < 8 or len(req) > 260:
            raise ValueError("an ADU has 8 ... 260 bytes")
        ln = int.from_bytes(req[4:6], "big")
        if ln != len(req) - 6:
            raise ValueError(f"MBAP length field = {ln}, but {len(req) - 6} bytes follow - fix the length")
        host, port = self.addr_of(self.devs[0])
        cl = ModbusClient(host, port, 0.8)
        try:
            resp, rtt = cl.transact(req)
            out = {"ok": True, "rttMs": round(rtt * 1000, 2), "req": MAP.decode_frame(req, "req"), "resp": MAP.decode_frame(resp, "resp")}
            u = MAP.MACHINE_BY_UNIT.get(req[6])
            if u and req[7] in (3, 4) and not resp[7] & 0x80:
                out["resp"] = MAP.decode_frame(resp, "resp", u["type"], int.from_bytes(req[8:10], "big"), self.cfg["order"])
                out["machine"] = u["id"]
        except ModbusError as e:
            out = {"ok": False, "error": str(e), "req": MAP.decode_frame(req, "req")}
        finally:
            cl.close()
        with self.lock:
            self._log(None, "raw", "raw", req, bytes.fromhex(out["resp"]["hex"].replace(" ", "")) if out.get("resp") else b"", out.get("rttMs", 0),
                      "frame builder: " + (out["resp"].get("text", "") if out.get("resp") else out.get("error", "")))
        return out

    def probe(self, kind, sim=None):
        """Send one deliberately wrong (or special) request and return both frames decoded (fault demo)."""
        d = self.by_id["BS-TGR-03"]
        host, port = self.addr_of(d)
        cl = ModbusClient(host, port, 0.8)
        cl.tid = 0x6F00
        tid = cl.next_tid()
        typ, start = d.type, None
        if kind == "badunit":
            req = MAP.req_read(tid, 200, 0, 12)
        elif kind == "badaddr":
            req = MAP.req_read(tid, d.unit, 300, 4)
        elif kind == "badfc":
            req = MAP.adu(tid, d.unit, bytes([0x08, 0, 0, 0x12, 0x34]))      # FC 08 diagnostics: serial line only
        elif kind == "badqty":
            req = MAP.req_read(tid, d.unit, 0, 200)
        elif kind == "cdab":
            req, start = MAP.req_read(tid, d.unit, 20, MAP.counters_len(typ)), 20
        else:
            req, start = MAP.req_read(tid, d.unit, 0, 12), 0
        old = None
        if kind == "cdab" and sim:
            u = sim.by_id[d.id]
            old, u.fault = u.fault, "cdab"
        try:
            resp, rtt = cl.transact(req)
            out = {"ok": True, "rttMs": round(rtt * 1000, 2), "req": MAP.decode_frame(req, "req"),
                   "resp": MAP.decode_frame(resp, "resp", typ, start, "ABCD")}
            if kind == "cdab" and start is not None and not (resp[7] & 0x80):
                out["respCDAB"] = MAP.decode_frame(resp, "resp", typ, start, "CDAB")
        except ModbusError as e:
            out = {"ok": False, "error": str(e), "req": MAP.decode_frame(req, "req")}
        finally:
            cl.close()
            if old is not None:
                sim.by_id[d.id].fault = old
        out["kind"] = kind
        with self.lock:
            self._log(d, "probe", "probe", req, bytes.fromhex(out["resp"]["hex"].replace(" ", "")) if out.get("resp") else b"", out.get("rttMs", 0),
                      f"probe {kind}: " + (out["resp"].get("text", "") if out.get("resp") else out.get("error", "")))
        return out


# ====================================================================== module state (inert until started)
_LOCK = threading.RLock()
STATE = {"gw": None, "sim": None, "srv": None, "cfg": {}, "started": None, "error": ""}
SNAP = {"t": 0.0, "data": None, "n": 0}


def snapshot_source():
    with _LOCK:
        if SNAP["data"] and _now() - SNAP["t"] < 15:
            return SNAP["data"]
    return None


def running():
    return STATE["gw"] is not None


def start(cfg=None):
    cfg = dict(cfg or {})
    with _LOCK:
        if STATE["gw"]:
            return control_view()
        port = int(cfg.get("simPort", 1502))
        use_sim = cfg.get("sim", True)
        STATE["error"] = ""
        if use_sim:
            sim = PlantSim(snapshot_source)
            try:
                srv = ModbusServer(sim, cfg.get("simHost", "127.0.0.1"), port)
            except OSError as e:
                STATE["error"] = f"Modbus simulator port {port} is in use ({e}) - choose another simPort"
                raise ValueError(STATE["error"])
            sim.start()
            srv.start()
            STATE["sim"], STATE["srv"] = sim, srv
            cfg.setdefault("target", "sim")
        gcfg = {k: cfg[k] for k in ("fast_ms", "counters_ms", "energy_ms", "gwhb_ms", "timeout_ms", "retries", "workers", "target", "simHost", "order") if k in cfg}
        gcfg["simPort"] = port
        for k, lo, hi in (("fast_ms", 100, 5000), ("counters_ms", 200, 60000), ("energy_ms", 1000, 600000), ("gwhb_ms", 200, 2000), ("timeout_ms", 50, 5000), ("retries", 0, 5), ("workers", 1, 16)):
            if k in gcfg:
                gcfg[k] = max(lo, min(hi, int(gcfg[k])))
        gw = Gateway(gcfg)
        gw.start()
        STATE["gw"], STATE["cfg"], STATE["started"] = gw, cfg, _now()
        return control_view()


def stop():
    with _LOCK:
        gw, srv, sim = STATE["gw"], STATE["srv"], STATE["sim"]
        STATE.update(gw=None, srv=None, sim=None, started=None)
    if gw:
        gw.stop()
    if srv:
        srv.stop()
    if sim:
        sim.stop()
    return control_view()


def control_view():
    gw, sim, srv = STATE["gw"], STATE["sim"], STATE["srv"]
    return {"running": gw is not None, "sim": sim is not None, "simMode": sim.mode if sim else None,
            "simPort": srv.server_address[1] if srv else None, "simFrames": srv.frames if srv else 0,
            "cfg": gw.cfg if gw else None, "started": STATE["started"], "error": STATE["error"],
            "faults": {u.m["id"]: u.fault for u in sim.units.values() if u.fault != "none"} if sim else {},
            "netloss": bool(sim and sim.netloss), "snapshotAge_s": round(_now() - SNAP["t"], 1) if SNAP["t"] else None,
            "mapVersion": f"V{MAP.MAP_VERSION >> 8}.{MAP.MAP_VERSION & 255}", "mapSize": MAP.MAP_SIZE,
            "gwHbOk": sum(1 for u in sim.units.values() if u.gw_ok()) if sim else None,
            "version": VERSION}


def control(body):
    a = str(body.get("action", ""))
    if a == "start":
        return start(body)
    if a == "stop":
        return stop()
    if a == "config":
        gw = STATE["gw"]
        if not gw:
            raise ValueError("gateway not running")
        for k, lo, hi in (("fast_ms", 100, 5000), ("counters_ms", 200, 60000), ("energy_ms", 1000, 600000), ("gwhb_ms", 200, 2000), ("timeout_ms", 50, 5000), ("retries", 0, 5)):
            if k in body:
                gw.cfg[k] = max(lo, min(hi, int(body[k])))
        if body.get("order") in ("ABCD", "CDAB"):
            gw.cfg["order"] = body["order"]
        return control_view()
    if a == "fault":
        sim = STATE["sim"]
        if not sim:
            raise ValueError("embedded simulator not running")
        f = str(body.get("fault", "none"))
        if f not in ("none", "offline", "slow", "exc04", "cdab"):
            raise ValueError("fault must be none|offline|slow|exc04|cdab")
        ids = list(sim.by_id) if body.get("id") == "all" else [body.get("id")]
        for i in ids:
            if i not in sim.by_id:
                raise KeyError(f"machine {i}")
            sim.by_id[i].fault = f
        return control_view()
    if a == "netloss":
        sim = STATE["sim"]
        if not sim:
            raise ValueError("embedded simulator not running")
        sim.netloss = bool(body.get("on", True))
        return control_view()
    if a == "raw":
        gw = STATE["gw"]
        if not gw:
            raise ValueError("gateway not running")
        return gw.raw(str(body.get("hex", "")))
    if a == "probe":
        gw = STATE["gw"]
        if not gw:
            raise ValueError("gateway not running")
        return gw.probe(str(body.get("kind", "")), STATE["sim"])
    raise ValueError("action must be start|stop|config|fault|netloss|probe|raw")


def store_snapshot(body):
    ms = body.get("machines")
    if not isinstance(ms, list):
        raise ValueError("snapshot needs 'machines': [...]")
    slim = {"t": body.get("t"), "clock": body.get("clock"),
            "machines": [{"id": m.get("id"), "state": m.get("state"), "code": m.get("code"), "sig": m.get("sig")} for m in ms if isinstance(m, dict)]}
    with _LOCK:
        SNAP.update(t=_now(), data=slim, n=SNAP["n"] + 1)
    return {"ok": True, "machines": len(slim["machines"]), "n": SNAP["n"], "used": running() and STATE["sim"] is not None}


def stream_payload():
    """One SSE data object (called every 1 s by server.py)."""
    gw = STATE["gw"]
    if not gw:
        return {"running": False, "t": round(_now(), 3), "control": control_view()}
    st = gw.status()
    with gw.lock:
        ev = [e for e in gw.events if e["seq"] > st["eventSeq"] - 60]
        fr = list(gw.frames)[-12:]
    return {"running": True, "t": round(_now(), 3), "status": st, "control": control_view(), "events": ev[-60:], "frames": fr,
            "machines": gw.machines()}


# ====================================================================== HTTP dispatch (used by server.py and tools/bsf_gateway.py)
API = [
    ["GET", "/api/bsf/status", "gateway state, statistics, device counts"],
    ["GET", "/api/bsf/machines", "all 73 devices: id, IP, unit id, status, round-trip, data age, main values"],
    ["GET", "/api/bsf/machine?id=BS-TGR-03", "one device: all decoded values + quality"],
    ["GET", "/api/bsf/frames?n=40&since=0", "last Modbus TCP frames (hex + decoded text)"],
    ["GET", "/api/bsf/events?since=0&wait=20", "report-by-exception changes (long polling, max 30 s)"],
    ["GET", "/api/bsf/stream", "Server-Sent Events: status + changes + frames every 1 s"],
    ["GET", "/api/bsf/map", "register maps of all machine types, machines, VLANs, servers (JSON)"],
    ["GET", "/api/bsf/map.csv", "the same as CSV (Excel, ; separated)"],
    ["GET", "/api/bsf/control", "running? configuration, injected faults"],
    ["POST", "/api/bsf/control", "start | stop | config | fault | netloss | probe | raw"],
    ["POST", "/api/bsf/command", "MES -> machine command: FC16 write + toggle-bit handshake"],
    ["POST", "/api/bsf/snapshot", "twin snapshot from the browser (feeds the Modbus simulator)"],
    ["GET", "/api/bsf/snapshot", "stored twin snapshot"],
    ["GET", "/api/bsf/api", "this catalogue"],
]


def _q(query, k, d=""):
    v = query.get(k, [d])
    return v[0] if isinstance(v, list) else v


def problem(status, title, detail="", typ="about:blank"):
    return status, {"type": typ, "title": title, "status": status, "detail": detail}, "application/problem+json; charset=utf-8"


def handle(method, path, query=None, body=None, headers=None):
    """-> (status, obj | str, content type). Never raises."""
    query = query or {}
    if path.startswith("/api/bsf/v1/"):
        path = "/api/bsf/" + path[len("/api/bsf/v1/"):]
    J = "application/json; charset=utf-8"
    try:
        from twin import bsf_comm_api as BAPI
        sub = path[len("/api/bsf/"):] if path.startswith("/api/bsf/") else ""
        if sub.split("/")[0] in ("mes", "erp", "agv", "printer"):
            return BAPI.handle(method, sub, query, body or {}, headers)
        gw = STATE["gw"]
        if method == "GET":
            if path == "/api/bsf/api":
                return 200, {"version": VERSION, "routes": API + BAPI.API, "rule": "Modbus TCP below the gateway, HTTP (REST + JSON + SSE) above. No MQTT, no OPC UA."}, J
            if path == "/api/bsf/health":
                return 200, {"ok": True, "running": running(), "version": VERSION, "t": _now()}, J
            if path == "/api/bsf/map":
                return 200, MAP.map_json(), J
            if path == "/api/bsf/map.csv":
                return 200, MAP.map_csv(), "text/csv; charset=utf-8"
            if path == "/api/bsf/control":
                return 200, control_view(), J
            if path == "/api/bsf/snapshot":
                with _LOCK:
                    return 200, {"age_s": round(_now() - SNAP["t"], 1) if SNAP["t"] else None, "n": SNAP["n"], "data": SNAP["data"]}, J
            if path in ("/api/bsf/status", "/api/bsf/machines", "/api/bsf/machine", "/api/bsf/frames", "/api/bsf/events"):
                if not gw:
                    if path == "/api/bsf/status":
                        return 200, {"running": False, "control": control_view()}, J
                    return problem(409, "gateway not running", "POST /api/bsf/control {\"action\": \"start\"} first")
                if path == "/api/bsf/status":
                    return 200, gw.status(), J
                if path == "/api/bsf/machines":
                    return 200, {"t": _now(), "machines": gw.machines()}, J
                if path == "/api/bsf/machine":
                    mid = _q(query, "id")
                    try:
                        return 200, gw.machine(mid), J
                    except KeyError:
                        return problem(404, "unknown machine", f"id={mid}")
                if path == "/api/bsf/frames":
                    n = int(_q(query, "n", "40") or 40)
                    since = int(_q(query, "since", "0") or 0)
                    return 200, {"seq": gw.fseq, "frames": gw.frames_since(max(1, min(400, n)), since)}, J
                if path == "/api/bsf/events":
                    since = int(_q(query, "since", "0") or 0)
                    wait = float(_q(query, "wait", "0") or 0)
                    return 200, gw.events_since(since, wait), J
            return problem(404, "not found", path)
        if method == "POST":
            body = body or {}
            if path == "/api/bsf/control":
                return 200, control(body), J
            if path == "/api/bsf/snapshot":
                return 200, store_snapshot(body), J
            if path == "/api/bsf/command":
                if not gw:
                    return problem(409, "gateway not running", "start it with POST /api/bsf/control")
                r = gw.command(body)
                return (200 if r.get("ok") else 422), r, J
            return problem(404, "not found", path)
        return problem(405, "method not allowed", method)
    except KeyError as e:
        return problem(404, "not found", str(e))
    except (ValueError, TypeError) as e:
        return problem(400, "bad request", str(e))
    except Exception as e:  # keep the main server alive whatever happens here
        return problem(500, "internal error", f"{type(e).__name__}: {e}")


def sse_lines():
    """Generator of SSE text blocks (one per second) - used by server.py for GET /api/bsf/stream."""
    n = 0
    yield "retry: 3000\n\n"
    while True:
        n += 1
        yield f"id: {n}\nevent: bsf\ndata: {json.dumps(stream_payload())}\n\n"
        time.sleep(1.0)


def new_msg_id():
    return str(uuid.uuid4())


__all__ = ["handle", "sse_lines", "start", "stop", "running", "control", "store_snapshot", "stream_payload", "Gateway", "STATE"]
