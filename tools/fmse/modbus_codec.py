#!/usr/bin/env python3
"""Modbus TCP codec + module simulator for the standard module data block (item 6, communication).

Python 3 standard library only, offline. Rules = "_formulas.modbus_encode" and "_formulas.modbus_frames" in
examples/item6_examples.json (section "datablock"). The data block (BLOCK = words 0-19, EXTRA = module part from
word 20) is read directly from web/fmse6_data.js. Guide: docs/FMS system design/66_communication.md.

Encoding (this standard): INT = one register, two's complement ; UINT / WORD = one register ; DINT = two
  registers HIGH WORD FIRST ('ABCD') ; REAL = IEEE 754 single, two registers high word first ; STRING[20] =
  10 registers, ASCII, first character in the high byte, padded with 0 ; register bytes big-endian.
Frames: MBAP = transaction id (2) + protocol id 0 (2) + length (2, bytes after it: unit id + PDU) + unit id (1).
  FC03 request 03 start qty -> response 03 bytecount data ; FC06 request = response 06 addr value ;
  FC16 request 10 start qty bytecount data -> response 10 start qty ; exception = (fc + 0x80) code.
  Codes 01 illegal function, 02 illegal data address, 03 illegal data value, 04 server device failure.
  Check order of the example server: function supported -> quantity valid (FC03 1..125, FC16 1..123 and
  bytecount = 2 x qty) -> address range inside the map -> write allowed (only words with direction 'in' or
  'in/out', else 02).
Simulator: --serve serves the block of one module over real Modbus TCP (default 127.0.0.1:1502; port 8080 is
  never used), Status.Heartbeat +1 every second; --poll reads words 0-19 every second (time-out 3 s) and shows the
  decoded values and the heartbeat status (lost if unchanged for 3 s).

Usage:
  python tools/fmse/modbus_codec.py                         (JSON example: encode, word order, 6 frames = --example)
  python tools/fmse/modbus_codec.py --decode "00 01 00 00 00 2B 01 03 28 ..." --start 0
  python tools/fmse/modbus_codec.py --module M04 --unit LS01 --set LS.SerialFirst=SN-2026-0001 --set Job.Id=70005
  python tools/fmse/modbus_codec.py --serve                 (module simulator on 127.0.0.1:1502, Ctrl+C stops)
  python tools/fmse/modbus_codec.py --poll 127.0.0.1 1502 --count 10 --write-hb
  python tools/fmse/modbus_codec.py --json
  python tools/fmse/modbus_codec.py --selftest              (incl. a real socket test on an ephemeral port)
"""

import argparse
import json
import socket
import socketserver
import struct
import threading
import time
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_examples, read_js_const, run_main

HERE = Path(__file__).resolve().parent
ITEM6_EXAMPLES = HERE / "examples" / "item6_examples.json"
WEB_DATA = HERE.parent.parent / "web" / "fmse6_data.js"

STATUS_BITS = ["Ready", "Busy", "Done", "Fault", "Warning", "Auto", "PartPresent", "HS.Ready"]
COMMAND_BITS = ["CmdChangeRequest", "HS.Request", "HS.Ack", "FaultReset"]
EXC_TEXT = {1: "illegal function", 2: "illegal data address", 3: "illegal data value", 4: "server device failure"}
WORD_ORDERS = ("ABCD", "CDAB", "BADC", "DCBA")
FORBIDDEN_PORT = 8080


# ----------------------------------------------------------------------------- the data block
def load_block():
    if not WEB_DATA.is_file():
        raise InputError(f"File not found: {WEB_DATA} (BLOCK / EXTRA of the data block)")
    return read_js_const(WEB_DATA, "BLOCK"), read_js_const(WEB_DATA, "EXTRA")


def nwords(t):
    return 2 if ("DINT" in t or "REAL" in t) else 10 if "STRING[20]" in t else 1


def kind(t):
    if t.startswith("DINT"):
        return "DINT"
    if t.startswith("REAL"):
        return "REAL"
    if t.startswith("STRING"):
        return "STRING"
    if t == "INT":
        return "INT"
    return "UINT"                       # UINT, WORD, 'WORD bit0', 'BOOL→WORD bit0'


class BlockMap:
    """Items [offset, name, type, dir, meaning] of BLOCK + EXTRA[module]; size; direction per word."""

    def __init__(self, module, BLOCK, EXTRA, base=0):
        self.module, self.base = module, base
        self.items = [list(r) for r in BLOCK] + [list(r) for r in EXTRA.get(module, [])]
        self.size = max(r[0] + nwords(r[2]) for r in self.items)
        self.dir = [None] * self.size
        for r in self.items:
            for w in range(r[0], r[0] + nwords(r[2])):
                self.dir[w] = r[3]

    def item(self, name):
        for r in self.items:
            if r[1] == name:
                return r
        raise InputError(f"item '{name}' not in the data block of {self.module}")

    def writable(self, w):
        return self.dir[w] in ("in", "in/out")


def encode_value(t, v):
    """Value -> list of 16-bit registers (this standard: high word first, big-endian)."""
    k = kind(t)
    if k == "INT":
        v = int(v)
        if not -32768 <= v <= 32767:
            raise InputError(f"INT value {v} out of range -32768..32767")
        return [v & 0xFFFF]
    if k == "UINT":
        v = int(v)
        if not 0 <= v <= 65535:
            raise InputError(f"UINT / WORD value {v} out of range 0..65535")
        return [v]
    if k == "DINT":
        v = int(v)
        if not -2 ** 31 <= v < 2 ** 31:
            raise InputError(f"DINT value {v} out of range")
        u = v & 0xFFFFFFFF
        return [u >> 16, u & 0xFFFF]
    if k == "REAL":
        u = struct.unpack(">I", struct.pack(">f", float(v)))[0]
        return [u >> 16, u & 0xFFFF]
    b = str(v if v != 0 else "").encode("ascii", "replace")[:20].ljust(20, b"\0")
    return [(b[i] << 8) | b[i + 1] for i in range(0, 20, 2)]


def decode_value(t, regs):
    k = kind(t)
    if k == "INT":
        return regs[0] - 0x10000 if regs[0] & 0x8000 else regs[0]
    if k == "UINT":
        return regs[0]
    if k == "DINT":
        u = (regs[0] << 16) | regs[1]
        return u - 2 ** 32 if u & 0x80000000 else u
    if k == "REAL":
        return struct.unpack(">f", struct.pack(">HH", regs[0], regs[1]))[0]
    return b"".join(struct.pack(">H", r) for r in regs).rstrip(b"\0").decode("ascii", "replace")


def encode_block(bm, values):
    regs = [0] * bm.size
    for off, name, t, d, _ in bm.items:
        if name in values:
            regs[off:off + nwords(t)] = encode_value(t, values[name])
    unknown = [n for n in values if n not in {r[1] for r in bm.items}]
    if unknown:
        raise InputError(f"values for unknown items: {', '.join(unknown)}")
    return regs


def decode_block(bm, regs, start=0):
    """Named values of all items that lie completely inside regs (regs[0] = word `start`)."""
    out = []
    for off, name, t, d, _ in bm.items:
        n = nwords(t)
        if off >= start and off + n <= start + len(regs):
            out.append((off, name, t, decode_value(t, regs[off - start:off - start + n])))
    return out


def bit_names(value, names):
    return [names[i] for i in range(len(names)) if value >> i & 1]


# ----------------------------------------------------------------------------- word order (teaching)
def to_order(regs_abcd, order):
    """2 registers in ABCD -> the same value as sent in another word / byte order."""
    b = struct.pack(">HH", *regs_abcd)                           # A B C D
    idx = {"ABCD": (0, 1, 2, 3), "CDAB": (2, 3, 0, 1), "BADC": (1, 0, 3, 2), "DCBA": (3, 2, 1, 0)}[order]
    return list(struct.unpack(">HH", bytes(b[i] for i in idx)))


def word_order_demo(dint, real):
    out = []
    for t, v in (("DINT", dint), ("REAL", real)):
        regs = encode_value(t, v)
        for o in WORD_ORDERS:
            sent = to_order(regs, o)
            out.append({"type": t, "value": v, "order": o, "regs": sent, "hex": " ".join(f"{r:04X}" for r in sent),
                        "decoded_as_ABCD": decode_value(t, sent)})
    return out


# ----------------------------------------------------------------------------- frames
def hexs(b):
    return " ".join(f"{x:02X}" for x in b)


def unhex(s):
    try:
        return bytes(int(x, 16) for x in s.replace(",", " ").split())
    except ValueError:
        raise InputError("hex string must be bytes like '00 01 00 00 00 06 01 03 00 00 00 14'")


def mbap(tid, unit, pdu):
    return struct.pack(">HHHB", tid, 0, len(pdu) + 1, unit) + pdu


def req_pdu(fr):
    fc = fr["fc"]
    if fc == 3:
        return struct.pack(">BHH", 3, fr["start"], fr["qty"])
    if fc == 6:
        return struct.pack(">BHH", 6, fr["start"], fr["value"])
    if fc == 16:
        v = fr["values"]
        return struct.pack(">BHHB", 16, fr["start"], len(v), 2 * len(v)) + b"".join(struct.pack(">H", x) for x in v)
    return bytes([fc]) + struct.pack(">HH", fr.get("start", 0), fr.get("qty", 1))


class ServerCore:
    """Register image + request processing of the example server (check order per _formulas.modbus_frames)."""

    def __init__(self, bm, regs):
        self.bm = bm
        self.regs = list(regs)
        self.lock = threading.Lock()

    def process_pdu(self, pdu):
        if not pdu:
            return bytes([0x80, 3])
        fc = pdu[0]
        exc = lambda code: bytes([(fc | 0x80) & 0xFF, code])           # noqa: E731
        if fc not in (3, 6, 16):
            return exc(1)
        base, size = self.bm.base, self.bm.size
        if fc == 3:
            if len(pdu) != 5:
                return exc(3)
            start, qty = struct.unpack(">HH", pdu[1:5])
            if not 1 <= qty <= 125:
                return exc(3)
            if start < base or start - base + qty > size:
                return exc(2)
            with self.lock:
                data = self.regs[start - base:start - base + qty]
            return struct.pack(">BB", 3, 2 * qty) + b"".join(struct.pack(">H", r) for r in data)
        if fc == 6:
            if len(pdu) != 5:
                return exc(3)
            addr, val = struct.unpack(">HH", pdu[1:5])
            if addr < base or addr - base >= size:
                return exc(2)
            if not self.bm.writable(addr - base):
                return exc(2)
            with self.lock:
                self.regs[addr - base] = val
            return pdu[:5]
        # FC16
        if len(pdu) < 6:
            return exc(3)
        start, qty, bc = struct.unpack(">HHB", pdu[1:6])
        if not 1 <= qty <= 123 or bc != 2 * qty or len(pdu) != 6 + bc:
            return exc(3)
        if start < base or start - base + qty > size:
            return exc(2)
        if not all(self.bm.writable(w) for w in range(start - base, start - base + qty)):
            return exc(2)
        vals = struct.unpack(f">{qty}H", pdu[6:6 + bc])
        with self.lock:
            self.regs[start - base:start - base + qty] = list(vals)
        return struct.pack(">BHH", 16, start, qty)

    def process_adu(self, adu):
        tid, pid, ln, unit = struct.unpack(">HHHB", adu[:7])
        return mbap(tid, unit, self.process_pdu(adu[7:7 + ln - 1]))


def run_frames(bm, values, frames, unit_id):
    core = ServerCore(bm, encode_block(bm, values))
    out = []
    for fr in frames:
        rq = mbap(fr["tid"], unit_id, req_pdu(fr))
        rs = core.process_adu(rq)
        out.append({"name": fr["name"], "request": hexs(rq), "response": hexs(rs), "meaning": explain(rs)})
    return out, core


def explain(adu):
    tid, _, ln, unit = struct.unpack(">HHHB", adu[:7])
    pdu = adu[7:]
    fc = pdu[0]
    if fc & 0x80:
        return f"exception FC{fc & 0x7F:02d} code {pdu[1]:02d} ({EXC_TEXT.get(pdu[1], '?')})"
    if fc == 3:
        return f"FC03 OK, {pdu[1]} data bytes = {pdu[1] // 2} registers"
    if fc == 6:
        a, v = struct.unpack(">HH", pdu[1:5])
        return f"FC06 OK, word {a} = {v}"
    a, q = struct.unpack(">HH", pdu[1:5])
    return f"FC16 OK, {q} words written from {a}"


def decode_response(adu, start, bm):
    """FC03 response ADU (bytes) + start word -> dict(tid, unit, regs, values) or the exception."""
    if len(adu) < 9:
        raise InputError("response too short (MBAP 7 bytes + function code + data)")
    tid, pid, ln, unit = struct.unpack(">HHHB", adu[:7])
    if pid != 0 or ln != len(adu) - 6:
        raise InputError(f"MBAP wrong: protocol id {pid}, length field {ln} but {len(adu) - 6} bytes follow")
    fc = adu[7]
    if fc & 0x80:
        return {"tid": tid, "unit": unit, "exception": adu[8], "text": EXC_TEXT.get(adu[8], "?")}
    if fc != 3:
        raise InputError(f"only FC03 responses carry values (got FC{fc:02d})")
    bc = adu[8]
    if bc != len(adu) - 9 or bc % 2:
        raise InputError(f"byte count {bc} does not fit the frame")
    regs = list(struct.unpack(f">{bc // 2}H", adu[9:9 + bc]))
    return {"tid": tid, "unit": unit, "regs": regs, "values": decode_block(bm, regs, start - bm.base)}


# ----------------------------------------------------------------------------- real Modbus TCP server / client
def recv_exact(sock, n):
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("connection closed by the partner")
        buf += chunk
    return buf


class _Handler(socketserver.BaseRequestHandler):
    def handle(self):
        core = self.server.core
        while True:
            try:
                head = recv_exact(self.request, 7)
                tid, pid, ln, unit = struct.unpack(">HHHB", head)
                if ln < 2 or ln > 254:
                    return
                body = recv_exact(self.request, ln - 1)
                self.request.sendall(mbap(tid, unit, core.process_pdu(body)))
            except (ConnectionError, OSError):
                return


class ModuleServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, host, port, core, hb_period=1.0, verbose=False):
        if port == FORBIDDEN_PORT:
            raise InputError("port 8080 is reserved for the digital-twin web server - use another port (e.g. 1502)")
        super().__init__((host, port), _Handler)
        self.core, self.hb_period, self.verbose = core, hb_period, verbose
        self._stop = threading.Event()
        self._hb = threading.Thread(target=self._heartbeat, daemon=True)

    def _heartbeat(self):
        bm = self.core.bm
        w_hb, w_cc = bm.item("Status.Heartbeat")[0], bm.item("Command.Heartbeat")[0]
        last_cc, last_change, lost = None, time.monotonic(), False
        while not self._stop.wait(self.hb_period):
            with self.core.lock:
                self.core.regs[w_hb] = (self.core.regs[w_hb] + 1) & 0xFFFF
                cc = self.core.regs[w_cc]
            now = time.monotonic()
            if cc != last_cc:
                if lost and self.verbose:
                    print(f"  module: cell-controller heartbeat OK again ({cc})", flush=True)
                last_cc, last_change, lost = cc, now, False
            elif not lost and now - last_change >= 3.0:
                lost = True
                if self.verbose:
                    print(f"  module: cell-controller heartbeat unchanged for 3 s -> CC_LOSS", flush=True)

    def start(self):
        self._hb.start()
        th = threading.Thread(target=self.serve_forever, kwargs={"poll_interval": 0.1}, daemon=True)
        th.start()
        return th

    def stop(self):
        self._stop.set()
        self.shutdown()
        self.server_close()


class Client:
    """Minimal Modbus TCP client (FC03 / FC06 / FC16) with a 3 s time-out."""

    def __init__(self, host, port, unit=1, timeout=3.0):
        if port == FORBIDDEN_PORT:
            raise InputError("port 8080 is reserved for the digital-twin web server")
        self.sock = socket.create_connection((host, port), timeout=timeout)
        self.sock.settimeout(timeout)
        self.unit, self.tid = unit, 0

    def call(self, pdu):
        self.tid = (self.tid + 1) & 0xFFFF
        self.sock.sendall(mbap(self.tid, self.unit, pdu))
        head = recv_exact(self.sock, 7)
        tid, pid, ln, unit = struct.unpack(">HHHB", head)
        body = recv_exact(self.sock, ln - 1)
        if tid != self.tid:
            raise ConnectionError(f"transaction id {tid} != {self.tid}")
        return body

    def read(self, start, qty):
        r = self.call(struct.pack(">BHH", 3, start, qty))
        if r[0] & 0x80:
            return ("exception", r[1])
        return list(struct.unpack(f">{r[1] // 2}H", r[2:]))

    def write1(self, addr, val):
        return self.call(struct.pack(">BHH", 6, addr, val))

    def write(self, start, vals):
        return self.call(struct.pack(">BHHB", 16, start, len(vals), 2 * len(vals))
                         + b"".join(struct.pack(">H", v) for v in vals))

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


def poll(host, port, bm, count, interval, unit, write_hb):
    print(f"POLL {host}:{port} unit {unit}: words 0-19 every {interval} s, time-out 3 s, heartbeat check 3 s "
          f"(Ctrl+C stops)")
    try:
        cl = Client(host, port, unit)
    except OSError as exc:
        raise InputError(f"cannot connect to {host}:{port}: {exc}")
    last_hb, last_change, n, my_hb = None, time.monotonic(), 0, 0
    try:
        while count == 0 or n < count:
            n += 1
            t0 = time.monotonic()
            try:
                regs = cl.read(bm.base, 20)
            except (OSError, ConnectionError) as exc:
                print(f"#{n} COMMUNICATION ERROR: {exc}")
                return 1
            if regs and regs[0] == "exception":
                print(f"#{n} exception {regs[1]} ({EXC_TEXT.get(regs[1], '?')})")
                return 1
            vals = {name: v for _, name, _, v in decode_block(bm, regs, 0)}
            hb = vals["Status.Heartbeat"]
            now = time.monotonic()
            if hb != last_hb:
                st = "OK" if last_hb is not None else "first value"
                last_hb, last_change = hb, now
            else:
                st = "LOST (unchanged >= 3 s)" if now - last_change >= 3.0 else f"unchanged {now - last_change:.1f} s"
            print(f"#{n} state {vals['Status.StateCurrent']} mode {vals['Status.UnitModeCurrent']} "
                  f"bits {vals['Status.Bits']} [{', '.join(bit_names(vals['Status.Bits'], STATUS_BITS)) or '-'}] "
                  f"job {vals['Job.Id']} pallet {vals['Job.PalletId']} count {vals['Admin.ProdProcessedCount']} "
                  f"cycle {vals['Status.LastCycle_s']:.1f} s  HB {hb} {st}", flush=True)
            if write_hb:
                my_hb = (my_hb + 1) & 0xFFFF
                cl.write1(bm.base + bm.item("Command.Heartbeat")[0], my_hb)
            if count == 0 or n < count:
                time.sleep(max(0.0, interval - (time.monotonic() - t0)))
    except KeyboardInterrupt:
        print("stopped")
    finally:
        cl.close()
    return 0


# ----------------------------------------------------------------------------- output
def show_example(D, bm, regs, frames, demo):
    print(f"STANDARD DATA BLOCK  module {D['module']}, unit {D['unit']}, unit id {D['unit_id']}, base {D['base']}: "
          f"{bm.size} registers")
    rows = []
    for off, name, t, d, _ in bm.items:
        n = nwords(t)
        v = D["values"].get(name, 0 if kind(t) != "STRING" else "")
        rows.append([f"{off}" + (f"-{off + n - 1}" if n > 1 else ""), name, t, d, v,
                     " ".join(f"{r:04X}" for r in regs[off:off + n])])
    print(fmt_table(["word", "name", "type", "dir", "value", "registers (hex)"], rows, "llllrl"))
    print(f"  registers (dec): {regs}")
    print(f"  Status.Bits {D['values'].get('Status.Bits', 0)} = 0x{D['values'].get('Status.Bits', 0):04X} = "
          f"{' + '.join(bit_names(D['values'].get('Status.Bits', 0), STATUS_BITS)) or 'none'} ; Command.Bits "
          f"{D['values'].get('Command.Bits', 0)} = {' + '.join(bit_names(D['values'].get('Command.Bits', 0), COMMAND_BITS)) or 'none'}")
    print()
    print("WORD ORDER DEMO  (bytes A B C D of the 32-bit value; this standard sends ABCD = high word first)")
    print(fmt_table(["type", "value", "server sends", "registers", "you decode ABCD -> you read"],
                    [[x["type"], x["value"], x["order"], x["hex"],
                      (f"{x['decoded_as_ABCD']:,}" if x["type"] == "DINT" else f"{x['decoded_as_ABCD']:.7g}")]
                     for x in demo], "lrlll"))
    print()
    print("FRAMES  (example server = the module above; hex bytes)")
    for k, f in enumerate(frames, 1):
        print(f"{k}. {f['name']}")
        print(f"   request : {f['request']}")
        print(f"   response: {f['response']}")
        print(f"   -> {f['meaning']}")
    print()
    dec = decode_response(unhex(frames[0]["response"]), D["frames"][0]["start"], bm)
    print("DECODE OF RESPONSE 1 (back to named values)")
    print(fmt_table(["word", "name", "type", "value"],
                    [[o, n, t, (f"{v:g}" if isinstance(v, float) else v)] for o, n, t, v in dec["values"]], "lllr"))


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("modbus_codec")
    _, D = load_examples(path, "datablock")
    BLOCK, EXTRA = load_block()
    bm = BlockMap(D["module"], BLOCK, EXTRA, D["base"])
    t.equal("M01 map: 20 standard + words 20-24 = 25 registers", bm.size, 25)
    regs = encode_block(bm, D["values"])
    want = [6, 1, 0, 0, 98, 1, 0, 0, 0, 1412, 0, 23, 1, 4465, 0, 3, 17637, 20480, 4711, 4710, 0, 0, 0, 0, 0]
    t.equal("25 encoded registers (hand: 70001 = 0x0001 1171, 1834.5 = 0x44E5 5000)", regs, want)
    t.equal("REAL 1834.5 -> 44E5 5000", encode_value("REAL", 1834.5), [0x44E5, 0x5000])
    t.equal("DINT 70001 -> 0001 1171", encode_value("DINT", 70001), [1, 0x1171])
    t.equal("INT -1 -> FFFF, decodes back to -1", (encode_value("INT", -1), decode_value("INT", [0xFFFF])),
            ([0xFFFF], -1))
    t.equal("DINT -2 -> FFFF FFFE", encode_value("DINT", -2), [0xFFFF, 0xFFFE])
    t.equal("STRING[20] 'SN-1' -> 'SN' '-1' high byte first + 8 zero registers",
            encode_value("STRING[20]", "SN-1"), [0x534E, 0x2D31] + [0] * 8)
    t.equal("STRING round trip", decode_value("STRING[20]", encode_value("STRING[20]", "SN-2026-0001")), "SN-2026-0001")
    t.equal("M04 map: 22 + STRING 10 words = 32 registers", BlockMap("M04", BLOCK, EXTRA).size, 32)
    t.equal("Status.Bits 98 = Busy + Auto + PartPresent", bit_names(98, STATUS_BITS), ["Busy", "Auto", "PartPresent"])
    t.equal("Command.Bits 1 = CmdChangeRequest", bit_names(1, COMMAND_BITS), ["CmdChangeRequest"])
    demo = {(x["type"], x["order"]): x for x in word_order_demo(70001, 1834.5)}
    t.equal("DINT CDAB registers 1171 0001", demo[("DINT", "CDAB")]["regs"], [0x1171, 0x0001])
    t.equal("DINT CDAB read as ABCD = 0x11710001 = 292618241", demo[("DINT", "CDAB")]["decoded_as_ABCD"], 292618241)
    t.equal("DINT BADC 0100 7111, DCBA 7111 0100", (demo[("DINT", "BADC")]["regs"], demo[("DINT", "DCBA")]["regs"]),
            ([0x0100, 0x7111], [0x7111, 0x0100]))
    t.equal("REAL CDAB registers 5000 44E5", demo[("REAL", "CDAB")]["regs"], [0x5000, 0x44E5])
    t.close("REAL CDAB read as ABCD = 0x500044E5 = 8.607995e9 (garbage)", demo[("REAL", "CDAB")]["decoded_as_ABCD"],
            struct.unpack(">f", bytes([0x50, 0x00, 0x44, 0xE5]))[0], 0)
    t.equal("ABCD decodes to the true value", (demo[("DINT", "ABCD")]["decoded_as_ABCD"],
                                              demo[("REAL", "ABCD")]["decoded_as_ABCD"]), (70001, 1834.5))
    frames, core = run_frames(bm, D["values"], D["frames"], D["unit_id"])
    data_hex = " ".join(f"{r >> 8:02X} {r & 255:02X}" for r in want[:20])
    exp = [("00 01 00 00 00 06 01 03 00 00 00 14", "00 01 00 00 00 2B 01 03 28 " + data_hex),
           ("00 02 00 00 00 0B 01 10 00 02 00 02 04 00 02 00 01", "00 02 00 00 00 06 01 10 00 02 00 02"),
           ("00 03 00 00 00 0F 01 10 00 0C 00 04 08 00 01 11 72 00 00 00 04", "00 03 00 00 00 06 01 10 00 0C 00 04"),
           ("00 04 00 00 00 06 01 03 00 00 00 C8", "00 04 00 00 00 03 01 83 03"),
           ("00 05 00 00 00 06 01 03 03 E8 00 0A", "00 05 00 00 00 03 01 83 02"),
           ("00 06 00 00 00 06 01 06 00 00 00 05", "00 06 00 00 00 03 01 86 02")]
    for k, (f, (rq, rs)) in enumerate(zip(frames, exp), 1):
        t.equal(f"frame {k} request", f["request"], rq)
        t.equal(f"frame {k} response", f["response"], rs)
    t.equal("after frames 2+3: CntrlCmd 2, Bits 1, Job.Id 70002, PalletId 4, StateCurrent still 6",
            (core.regs[2], core.regs[3], decode_value("DINT", core.regs[12:14]), decode_value("DINT", core.regs[14:16]),
             core.regs[0]), (2, 1, 70002, 4, 6))
    dec = decode_response(unhex(frames[0]["response"]), 0, bm)
    dv = {n: v for _, n, _, v in dec["values"]}
    t.equal("decode response 1: 15 items of words 0-19", len(dec["values"]), 15)
    t.equal("decode: Job.Id 70001, LastCycle 1834.5, Heartbeat 4711",
            (dv["Job.Id"], dv["Status.LastCycle_s"], dv["Status.Heartbeat"]), (70001, 1834.5, 4711))
    t.equal("decode exception frame 4 -> code 3", decode_response(unhex(frames[3]["response"]), 0, bm)["exception"], 3)
    t.equal("FC16 qty 124 -> exception 03", core.process_pdu(struct.pack(">BHHB", 16, 2, 124, 248) + b"\0" * 248),
            bytes([0x90, 3]))
    t.equal("FC16 bytecount wrong -> 03", core.process_pdu(struct.pack(">BHHB", 16, 2, 2, 3) + b"\0" * 3),
            bytes([0x90, 3]))
    t.equal("FC03 qty 0 -> 03", core.process_pdu(struct.pack(">BHH", 3, 0, 0)), bytes([0x83, 3]))
    t.equal("FC03 qty 125 inside map? no (25 regs) -> 02", core.process_pdu(struct.pack(">BHH", 3, 0, 125)),
            bytes([0x83, 2]))
    t.equal("FC03 words 20-24 OK (5 regs)", core.process_pdu(struct.pack(">BHH", 3, 20, 5))[:2], bytes([3, 10]))
    t.equal("FC03 words 20-25 -> 02", core.process_pdu(struct.pack(">BHH", 3, 20, 6)), bytes([0x83, 2]))
    t.equal("FC16 words 18-19 (18 out) -> 02", core.process_pdu(struct.pack(">BHHB", 16, 18, 2, 4) + b"\0" * 4),
            bytes([0x90, 2]))
    t.equal("FC06 word 21 (2nd word of NC.ProgramNo, in) allowed", core.process_pdu(struct.pack(">BHH", 6, 21, 7))[0], 6)
    t.equal("FC01 -> 01 illegal function", core.process_pdu(struct.pack(">BHH", 1, 0, 1)), bytes([0x81, 1]))
    bm100 = BlockMap("M01", BLOCK, EXTRA, base=100)
    c100 = ServerCore(bm100, encode_block(bm100, D["values"]))
    t.equal("base 100: FC03 at 100 OK, at 0 -> 02", (c100.process_pdu(struct.pack(">BHH", 3, 100, 1)),
                                                     c100.process_pdu(struct.pack(">BHH", 3, 0, 1))),
            (bytes([3, 2, 0, 6]), bytes([0x83, 2])))
    try:
        ModuleServer("127.0.0.1", 8080, core)
        t.true("port 8080 refused", False)
    except InputError:
        t.true("port 8080 refused", True)
    # ---- real socket test on an ephemeral port
    srv = ModuleServer("127.0.0.1", 0, ServerCore(bm, encode_block(bm, D["values"])), hb_period=0.1)
    port = srv.server_address[1]
    srv.start()
    try:
        cl = Client("127.0.0.1", port, D["unit_id"])
        r = cl.read(0, 25)
        t.equal(f"socket (port {port}): FC03 0..24 = encoded registers (heartbeat word aside)",
                r[:18] + r[19:], want[:18] + want[19:])
        t.true("socket: heartbeat word >= 4711", r[18] >= 4711)
        hb0 = cl.read(18, 1)[0]
        time.sleep(0.45)
        hb1 = cl.read(18, 1)[0]
        t.true(f"socket: heartbeat counts up ({hb0} -> {hb1})", hb1 >= hb0 + 2)
        t.equal("socket: FC06 word 2 = 2 echoed", cl.write1(2, 2), struct.pack(">BHH", 6, 2, 2))
        t.equal("socket: read back word 2", cl.read(2, 1), [2])
        t.equal("socket: FC06 word 0 (out) -> 86 02", cl.write1(0, 5), bytes([0x86, 2]))
        t.equal("socket: FC16 Job.Id 70002 + Pallet 4", cl.write(12, [1, 4466, 0, 4]), struct.pack(">BHH", 16, 12, 4))
        t.equal("socket: read back Job.Id 70002", decode_value("DINT", cl.read(12, 2)), 70002)
        t.equal("socket: FC16 to LastCycle (out) -> 90 02", cl.write(16, [0, 0]), bytes([0x90, 2]))
        t.equal("socket: FC03 qty 200 -> exception 03", cl.read(0, 200), ("exception", 3))
        t.equal("socket: FC03 start 1000 -> exception 02", cl.read(1000, 10), ("exception", 2))
        t.equal("socket: FC05 -> 85 01", cl.call(struct.pack(">BHH", 5, 0, 0xFF00)), bytes([0x85, 1]))
        cl.sock.sendall(bytes.fromhex("1234 0000 0006 07 03 0000 0001"))
        raw = recv_exact(cl.sock, 11)
        t.equal("socket: tid 0x1234 and unit 7 echoed, length 5", raw[:7], bytes.fromhex("1234 0000 0005 07"))
        cl2 = Client("127.0.0.1", port, 1)
        t.equal("socket: second client in parallel reads StateCurrent 6", cl2.read(0, 1), [6])
        cl2.write1(19, 999)
        t.equal("socket: write of client 2 seen by client 1 (Command.Heartbeat 999)", cl.read(19, 1), [999])
        cl2.close()
        cl.close()
    finally:
        srv.stop()
    try:
        Client("127.0.0.1", port, 1, timeout=1.0)
        t.true("server stopped: connection refused", False)
    except OSError:
        t.true("server stopped: connection refused", True)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def parse_sets(sets, bm):
    vals = {}
    for s in sets or []:
        if "=" not in s:
            raise InputError(f"--set '{s}' must be NAME=VALUE")
        n, v = s.split("=", 1)
        r = bm.item(n.strip())
        k = kind(r[2])
        try:
            vals[r[1]] = float(v) if k == "REAL" else v if k == "STRING" else int(v, 0)
        except ValueError:
            raise InputError(f"--set {n}: '{v}' is not a valid {r[2]} value")
    return vals


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM6_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the JSON example (also the default)")
    ap.add_argument("--module", help="module code (default JSON datablock.module, M01)")
    ap.add_argument("--unit", help="unit name (only for the printout)")
    ap.add_argument("--base", type=int, help="base register (PDU address of word 0)")
    ap.add_argument("--set", action="append", metavar="NAME=VALUE", help="own values (replace the JSON values)")
    ap.add_argument("--decode", metavar="HEX", help="decode an FC03 response frame (hex bytes)")
    ap.add_argument("--start", type=int, default=0, help="start word of the request that gave --decode")
    ap.add_argument("--serve", nargs="?", type=int, const=1502, metavar="PORT",
                    help="run the module simulator (default port 1502; never 8080)")
    ap.add_argument("--host", default="127.0.0.1", help="bind / connect address (default 127.0.0.1)")
    ap.add_argument("--poll", nargs=2, metavar=("HOST", "PORT"), help="poll words 0-19 of a server every second")
    ap.add_argument("--count", type=int, default=0, help="--poll: number of cycles (0 = until Ctrl+C)")
    ap.add_argument("--interval", type=float, default=1.0, help="--poll: cycle time in s")
    ap.add_argument("--write-hb", action="store_true", help="--poll: also write Command.Heartbeat +1 per cycle")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, D = load_examples(a.examples, "datablock")
    BLOCK, EXTRA = load_block()
    module = a.module or D["module"]
    if module not in ("M%02d" % i for i in range(1, 20)):
        raise InputError(f"module '{module}' has no data block (M01..M19)")
    bm = BlockMap(module, BLOCK, EXTRA, D["base"] if a.base is None else a.base)
    if a.set is not None:
        values = parse_sets(a.set, bm)
    else:
        values = dict(D["values"]) if module == D["module"] else {}
    D2 = dict(D, module=module, unit=a.unit or (D["unit"] if module == D["module"] else module), values=values,
              base=bm.base)
    if a.poll:
        try:
            port = int(a.poll[1])
        except ValueError:
            raise InputError("--poll PORT must be a number")
        return poll(a.poll[0], port, bm, a.count, a.interval, D["unit_id"], a.write_hb)
    if a.serve is not None:
        try:
            srv = ModuleServer(a.host, a.serve, ServerCore(bm, encode_block(bm, values)), verbose=True)
        except OSError as exc:
            raise InputError(f"cannot open {a.host}:{a.serve}: {exc}")
        print(f"MODULE SIMULATOR {D2['unit']} ({module}) on {a.host}:{srv.server_address[1]}  "
              f"{bm.size} registers from PDU address {bm.base}; Status.Heartbeat +1/s; writable only 'in' / 'in/out' "
              "words.  Ctrl+C stops.", flush=True)
        srv.start()
        try:
            while True:
                time.sleep(0.5)
        except KeyboardInterrupt:
            print("stopping")
        finally:
            srv.stop()
        return 0
    if a.decode:
        r = decode_response(unhex(a.decode), a.start, bm)
        if a.json:
            print(json.dumps(r, indent=1))
        elif "exception" in r:
            print(f"tid {r['tid']} unit {r['unit']}: exception {r['exception']:02d} ({r['text']})")
        else:
            print(f"tid {r['tid']} unit {r['unit']}: {len(r['regs'])} registers from word {a.start}")
            rows = []
            for o, n, ty, v in r["values"]:
                extra = ""
                if n == "Status.Bits":
                    extra = " = " + "+".join(bit_names(v, STATUS_BITS))
                elif n == "Command.Bits":
                    extra = " = " + "+".join(bit_names(v, COMMAND_BITS))
                rows.append([o, n, ty, (f"{v:g}" if isinstance(v, float) else str(v)) + extra])
            print(fmt_table(["word", "name", "type", "value"], rows, "lllr"))
        return 0
    regs = encode_block(bm, values)
    frames = run_frames(bm, values, D["frames"], D["unit_id"])[0] if module == D["module"] else []
    wd = D.get("word_order_demo", {"DINT": 70001, "REAL": 1834.5})
    demo = word_order_demo(wd["DINT"], wd["REAL"])
    if a.json:
        print(json.dumps({"module": module, "registers": regs, "word_order": demo, "frames": frames}, indent=1))
        return 0
    if frames:
        show_example(D2, bm, regs, frames, demo)
    else:
        show_example(D2, bm, regs, run_frames(bm, values, D["frames"][:1], D["unit_id"])[0], demo)
    return 0


if __name__ == "__main__":
    run_main(main)
