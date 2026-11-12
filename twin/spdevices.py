"""
Protocol adapters for the spindle assembly LIVE station twin (ASSY-SP1).

Python standard library only (socket, struct, threading) - runs on an offline factory PC.

  * ModbusTCP      - minimal Modbus TCP client: FC 3 (read holding registers) + FC 6 (write single register)
  * MODBUS_MAP     - register map per device (scaling, measurement counter, write registers)
  * ModbusPoller   - thread: polls every device whose proto is "modbus" once per second
  * MqttClient     - minimal MQTT 3.1.1 client: CONNECT, SUBSCRIBE (QoS 0), receive PUBLISH,
                     PUBLISH (QoS 0), PINGREQ, automatic reconnect
  * MqttBridge     - thread: one MqttClient per broker address of the devices whose proto is "mqtt",
                     subscribes to vc/asm/ASSY-SP1/#

The station (twin/spstation.py) owns these objects. They call station.ingest_device(dev, values, src)
and read station.outbox (set-points for the run-in stand PLC).
All register numbers and scalings are EXAMPLES - the real PLC programmer defines the map (check).
"""

from __future__ import annotations

import json
import socket
import struct
import threading
import time

TOPIC_ROOT = "vc/asm/ASSY-SP1"

# ----------------------------------------------------------------------------------------------- Modbus map
# Holding registers, address 0 = "40001". Values are signed 16-bit integers; engineering value = raw * scale.
# counter: register that the device increments after every NEW measurement (on-demand gauges). The station
#          takes a value only when the counter changes - one measurement = one result.
# continuous devices (RUN-01) have no counter: every poll is a new sample.
# write:   registers the station writes (FC 6) - only RUN-01 (closed loop: speed set-point).
MODBUS_MAP = {
    "RUN-01": {"start": 0, "count": 10, "counter": None,
               "regs": [("rpm", 0, 1), ("t_front_c", 1, 0.1), ("t_rear_c", 2, 0.1), ("t_stator_c", 3, 0.1),
                        ("t_win_c", 4, 0.1), ("t_wout_c", 5, 0.1), ("vib_mm_s", 6, 0.01), ("flow_lpm", 7, 0.1)],
               "status": 8, "heartbeat": 9,
               "write": {"rpm_set": (100, 1), "time_factor": (101, 1), "cmd": (102, 1)}},
    "BAL-01": {"start": 0, "count": 5, "counter": 4,
               "regs": [("u1_gmm", 0, 0.01), ("a1_deg", 1, 0.1), ("u2_gmm", 2, 0.01), ("a2_deg", 3, 0.1)]},
    "HSK-01": {"start": 0, "count": 2, "counter": 1, "regs": [("force_kn", 0, 0.01)]},
    "FG-01": {"start": 0, "count": 2, "counter": 1, "regs": [("force_kn", 0, 0.01)]},
    "PRS-01": {"start": 0, "count": 2, "counter": 1, "regs": [("p_bar", 0, 0.01)]},
}
# Unit ids used by tools/spst_modbus_sim.py (one TCP server, several unit ids - like a gateway / multi-drop RS-485)
MODBUS_SIM_UNITS = {"RUN-01": 1, "BAL-01": 2, "HSK-01": 3, "FG-01": 4, "PRS-01": 5}


def parse_addr(addr: str, default_port: int):
    """'127.0.0.1:5020/unit1' -> ('127.0.0.1', 5020, 1);  '10.0.0.5' -> ('10.0.0.5', default_port, 1)"""
    addr = (addr or "").strip()
    unit = 1
    if "/" in addr:
        addr, u = addr.split("/", 1)
        u = u.lower().replace("unit", "").strip()
        unit = int(u) if u.isdigit() else 1
    host, port = addr, default_port
    if ":" in addr:
        host, p = addr.rsplit(":", 1)
        port = int(p)
    return host or "127.0.0.1", port, unit


def s16(v: int) -> int:
    return v - 65536 if v >= 32768 else v


class ModbusError(Exception):
    pass


class ModbusTCP:
    """Minimal Modbus TCP client (Modbus Application Protocol V1.1b3 + Modbus TCP implementation guide)."""

    def __init__(self, host: str, port: int = 502, timeout: float = 2.0):
        self.host, self.port, self.timeout = host, port, timeout
        self.sock = None
        self.tid = 0

    def connect(self):
        self.close()
        self.sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
        self.sock.settimeout(self.timeout)

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except OSError:
                pass
        self.sock = None

    def _recv(self, n: int) -> bytes:
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise ModbusError("connection closed")
            buf += chunk
        return buf

    def _request(self, unit: int, pdu: bytes) -> bytes:
        if not self.sock:
            self.connect()
        self.tid = (self.tid + 1) & 0xFFFF
        # MBAP header: transaction id, protocol id (0), length (unit id + PDU), unit id
        self.sock.sendall(struct.pack(">HHHB", self.tid, 0, len(pdu) + 1, unit) + pdu)
        tid, pid, length, _unit = struct.unpack(">HHHB", self._recv(7))
        body = self._recv(length - 1)
        if tid != self.tid or pid != 0:
            raise ModbusError("bad transaction id")
        if body[0] & 0x80:
            raise ModbusError(f"exception code {body[1]} for function {body[0] & 0x7F}")
        return body

    def read_holding(self, unit: int, addr: int, count: int):
        body = self._request(unit, struct.pack(">BHH", 3, addr, count))
        n = body[1]
        return list(struct.unpack(">" + "H" * (n // 2), body[2:2 + n]))

    def write_single(self, unit: int, addr: int, value: int):
        self._request(unit, struct.pack(">BHH", 6, addr, int(value) & 0xFFFF))


class ModbusPoller(threading.Thread):
    """Polls all devices with proto == 'modbus' (1 s). Writes RUN-01 set-points from station.outbox."""

    def __init__(self, station, period: float = 1.0):
        super().__init__(daemon=True, name="spst-modbus")
        self.st, self.period = station, period
        self.conns = {}         # (host, port) -> ModbusTCP
        self.counters = {}      # device -> last counter value
        self.written = {}       # (device, reg) -> last written value
        self._stop = threading.Event()

    def stop(self):
        self._stop.set()

    def _conn(self, host, port):
        c = self.conns.get((host, port))
        if c is None:
            c = self.conns[(host, port)] = ModbusTCP(host, port, timeout=1.5)
        return c

    def run(self):
        while not self._stop.is_set():
            t0 = time.time()
            for dev, addr in self.st.devices_with_proto("modbus"):
                m = MODBUS_MAP.get(dev)
                if not m:
                    continue
                host, port, unit = parse_addr(addr, 502)
                c = self._conn(host, port)
                try:
                    regs = c.read_holding(unit, m["start"], m["count"])
                    vals = {k: round(s16(regs[i]) * sc, 4) for k, i, sc in m["regs"]}
                    cnt = m.get("counter")
                    if cnt is not None:
                        prev = self.counters.get(dev)
                        self.counters[dev] = regs[cnt]
                        if prev is None or prev == regs[cnt]:
                            self.st.device_seen(dev)      # alive, but no new measurement
                        else:
                            self.st.ingest_device(dev, vals, "device:" + dev)
                    else:
                        self.st.ingest_device(dev, vals, "device:" + dev)
                    # closed loop: write set-points (only when changed, and once per 10 s as a refresh)
                    for name, value in self.st.outbox_for(dev).items():
                        reg = m.get("write", {}).get(name)
                        if not reg:
                            continue
                        raw = int(round(value / reg[1]))
                        key = (dev, reg[0])
                        last = self.written.get(key)
                        if last is None or last[0] != raw or time.time() - last[1] > 10:
                            c.write_single(unit, reg[0], raw)
                            self.written[key] = (raw, time.time())
                except (OSError, ModbusError, struct.error, IndexError) as e:
                    c.close()
                    self.counters.pop(dev, None)
                    self.written = {k: v for k, v in self.written.items() if k[0] != dev}
                    self.st.device_error(dev, f"modbus {host}:{port}/unit{unit}: {e}")
            self._stop.wait(max(0.05, self.period - (time.time() - t0)))
        for c in self.conns.values():
            c.close()


# ----------------------------------------------------------------------------------------------- MQTT 3.1.1
def _enc_len(n: int) -> bytes:
    out = bytearray()
    while True:
        b = n % 128
        n //= 128
        out.append(b | (0x80 if n else 0))
        if not n:
            return bytes(out)


def _enc_str(s: str) -> bytes:
    b = s.encode("utf-8")
    return struct.pack(">H", len(b)) + b


class MqttClient:
    """Minimal MQTT 3.1.1 client, QoS 0 (OASIS MQTT Version 3.1.1, 2014)."""

    def __init__(self, host: str, port: int = 1883, client_id: str = "spst-twin", keepalive: int = 30):
        self.host, self.port, self.client_id, self.keepalive = host, port, client_id, keepalive
        self.sock = None
        self.pid = 0
        self.last_tx = 0.0
        self.lock = threading.Lock()

    def _send(self, data: bytes):
        with self.lock:
            self.sock.sendall(data)
            self.last_tx = time.time()

    def _recv(self, n: int) -> bytes:
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("broker closed the connection")
            buf += chunk
        return buf

    def read_packet(self):
        """Returns (type, flags, body) or None on timeout."""
        try:
            h = self.sock.recv(1)
        except socket.timeout:
            return None
        if not h:
            raise ConnectionError("broker closed the connection")
        mult, n = 1, 0
        while True:
            b = self._recv(1)[0]
            n += (b & 127) * mult
            mult *= 128
            if not b & 128:
                break
        self.sock.settimeout(5)
        body = self._recv(n) if n else b""
        self.sock.settimeout(1.0)
        return h[0] >> 4, h[0] & 0x0F, body

    def connect(self):
        self.close()
        self.sock = socket.create_connection((self.host, self.port), timeout=5)
        vh = _enc_str("MQTT") + bytes([4, 0x02]) + struct.pack(">H", self.keepalive)   # level 4, clean session
        pl = _enc_str(self.client_id)
        self._send(bytes([0x10]) + _enc_len(len(vh) + len(pl)) + vh + pl)
        self.sock.settimeout(5)
        p = self.read_packet()
        if not p or p[0] != 2 or len(p[2]) < 2 or p[2][1] != 0:
            raise ConnectionError(f"CONNACK refused: {p}")
        self.sock.settimeout(1.0)

    def subscribe(self, topic: str, qos: int = 0):
        self.pid = (self.pid % 65535) + 1
        body = struct.pack(">H", self.pid) + _enc_str(topic) + bytes([qos])
        self._send(bytes([0x82]) + _enc_len(len(body)) + body)

    def publish(self, topic: str, payload, retain=False):
        if isinstance(payload, (dict, list)):
            payload = json.dumps(payload)
        data = payload if isinstance(payload, bytes) else str(payload).encode("utf-8")
        body = _enc_str(topic) + data
        self._send(bytes([0x30 | (1 if retain else 0)]) + _enc_len(len(body)) + body)

    def ping_if_needed(self):
        if time.time() - self.last_tx > self.keepalive / 2:
            self._send(bytes([0xC0, 0x00]))

    def puback(self, pid: int):
        self._send(bytes([0x40, 0x02]) + struct.pack(">H", pid))

    def close(self):
        if self.sock:
            try:
                self.sock.sendall(bytes([0xE0, 0x00]))   # DISCONNECT
            except OSError:
                pass
            try:
                self.sock.close()
            except OSError:
                pass
        self.sock = None


def parse_publish(flags: int, body: bytes):
    """-> (topic, payload bytes, packet id or None)"""
    tl = struct.unpack(">H", body[:2])[0]
    topic = body[2:2 + tl].decode("utf-8", "replace")
    pos, pid = 2 + tl, None
    if (flags >> 1) & 3:            # QoS 1/2 -> packet id follows
        pid = struct.unpack(">H", body[pos:pos + 2])[0]
        pos += 2
    return topic, body[pos:], pid


def topic_to_values(topic: str, payload: bytes):
    """vc/asm/ASSY-SP1/<device>/<value>  payload number or JSON  ->  (device, {value: v})
       vc/asm/ASSY-SP1/<device>          payload JSON object      ->  (device, {...})"""
    parts = topic.split("/")
    root = TOPIC_ROOT.split("/")
    if parts[:3] != root or len(parts) not in (4, 5):
        return None, None
    dev = parts[3]
    text = payload.decode("utf-8", "replace").strip()
    try:
        v = json.loads(text)
    except ValueError:
        v = text
    if len(parts) == 4:
        return (dev, v) if isinstance(v, dict) else (None, None)
    key = parts[4]
    if isinstance(v, dict):         # {"v": 12.3, "t": ...} style payload
        v = v.get("v", v.get("value"))
    return dev, {key: v}


class MqttBridge(threading.Thread):
    """Connects to every broker named by an mqtt device (addr host:port), subscribes vc/asm/ASSY-SP1/#."""

    def __init__(self, station):
        super().__init__(daemon=True, name="spst-mqtt")
        self.st = station
        self.clients = {}       # (host, port) -> [MqttClient, next_retry]
        self.published = {}     # topic -> (value, t)
        self._stop = threading.Event()

    def stop(self):
        self._stop.set()

    def run(self):
        while not self._stop.is_set():
            wanted = {}
            for dev, addr in self.st.devices_with_proto("mqtt"):
                host, port, _ = parse_addr(addr, 1883)
                wanted.setdefault((host, port), []).append(dev)
            for key in list(self.clients):
                if key not in wanted:
                    self.clients.pop(key)[0].close()
            if not wanted:
                self._stop.wait(1.0)
                continue
            for key, devs in wanted.items():
                ent = self.clients.get(key)
                if ent is None:
                    ent = self.clients[key] = [MqttClient(key[0], key[1], client_id=f"spst-twin-{int(time.time()) % 100000}"), 0.0]
                cl = ent[0]
                try:
                    if cl.sock is None:
                        if time.time() < ent[1]:
                            continue
                        cl.connect()
                        cl.subscribe(TOPIC_ROOT + "/#")
                        self.st.log_event(f"MQTT connected to {key[0]}:{key[1]}, subscribed {TOPIC_ROOT}/#", "system")
                    # read everything that is waiting (socket timeout 1 s / number of brokers)
                    cl.sock.settimeout(max(0.1, 1.0 / len(wanted)))
                    t_end = time.time() + 1.0 / len(wanted)
                    while time.time() < t_end:
                        p = cl.read_packet()
                        if p is None:
                            break
                        typ, flags, body = p
                        if typ == 3:                       # PUBLISH
                            topic, payload, pid = parse_publish(flags, body)
                            if pid is not None and (flags >> 1) & 3 == 1:
                                cl.puback(pid)
                            dev, vals = topic_to_values(topic, payload)
                            if dev in devs and vals:
                                self.st.ingest_device(dev, vals, "device:" + dev)
                    cl.ping_if_needed()
                    # closed loop: publish set-points for mqtt devices
                    for dev in devs:
                        for name, value in self.st.outbox_for(dev).items():
                            topic = f"{TOPIC_ROOT}/{dev}/cmd/{name}"
                            last = self.published.get(topic)
                            if last is None or last[0] != value or time.time() - last[1] > 10:
                                cl.publish(topic, value)
                                self.published[topic] = (value, time.time())
                except (OSError, ConnectionError, struct.error, ValueError) as e:
                    cl.close()
                    ent[1] = time.time() + 5.0              # retry after 5 s
                    for dev in devs:
                        self.st.device_error(dev, f"mqtt {key[0]}:{key[1]}: {e}")
        for ent in self.clients.values():
            ent[0].close()
