"""
Tiny MQTT 3.1.1 broker for OFFLINE TESTS of the spindle station twin (standard library only).

  * CONNECT / CONNACK, SUBSCRIBE / SUBACK (granted QoS 0), UNSUBSCRIBE, PUBLISH (QoS 0 forwarding,
    QoS 1 is acknowledged and forwarded as QoS 0), PINGREQ / PINGRESP, DISCONNECT
  * wildcards + and #, retained messages
  * NO security (no user/password, no TLS), no persistence, no QoS 2.
For a real station use a proper broker (e.g. Eclipse Mosquitto, installed from a local file) – check.

Run:   python tools/spst_mqtt_broker.py --port 1883
Then:  POST /api/spst {"action": "device", "id": "TQ-01", "proto": "mqtt", "addr": "127.0.0.1:1883"}
       python tools/spst_gateway.py --mode mqtt --mqtt 127.0.0.1:1883 --devices TQ-01
"""

import argparse
import socketserver
import struct
import threading

LOCK = threading.Lock()
CLIENTS = {}          # handler -> list of topic filters
RETAINED = {}         # topic -> payload
VERBOSE = False


def enc_len(n):
    out = bytearray()
    while True:
        b = n % 128
        n //= 128
        out.append(b | (0x80 if n else 0))
        if not n:
            return bytes(out)


def matches(filt, topic):
    f, t = filt.split("/"), topic.split("/")
    for i, part in enumerate(f):
        if part == "#":
            return True
        if i >= len(t):
            return False
        if part != "+" and part != t[i]:
            return False
    return len(f) == len(t)


def publish_packet(topic, payload, retain=False):
    tb = topic.encode("utf-8")
    body = struct.pack(">H", len(tb)) + tb + payload
    return bytes([0x30 | (1 if retain else 0)]) + enc_len(len(body)) + body


class Handler(socketserver.BaseRequestHandler):
    def recv(self, n):
        buf = b""
        while len(buf) < n:
            c = self.request.recv(n - len(buf))
            if not c:
                raise ConnectionError
            buf += c
        return buf

    def send(self, data):
        with self.wlock:
            self.request.sendall(data)

    def handle(self):
        self.wlock = threading.Lock()
        self.request.settimeout(120)
        cid = "?"
        try:
            while True:
                h = self.recv(1)[0]
                mult, n = 1, 0
                while True:
                    b = self.recv(1)[0]
                    n += (b & 127) * mult
                    mult *= 128
                    if not b & 128:
                        break
                body = self.recv(n) if n else b""
                typ, flags = h >> 4, h & 0x0F
                if typ == 1:                                            # CONNECT
                    pl = struct.unpack(">H", body[:2])[0]
                    pos = 2 + pl + 1 + 1 + 2
                    il = struct.unpack(">H", body[pos:pos + 2])[0]
                    cid = body[pos + 2:pos + 2 + il].decode("utf-8", "replace")
                    with LOCK:
                        CLIENTS[self] = []
                    self.send(bytes([0x20, 0x02, 0x00, 0x00]))
                    if VERBOSE:
                        print("connect", cid, self.client_address)
                elif typ == 8:                                          # SUBSCRIBE
                    pid = body[:2]
                    pos, granted, new = 2, [], []
                    while pos < len(body):
                        tl = struct.unpack(">H", body[pos:pos + 2])[0]
                        filt = body[pos + 2:pos + 2 + tl].decode("utf-8")
                        pos += 2 + tl + 1
                        granted.append(0)
                        new.append(filt)
                    with LOCK:
                        CLIENTS.setdefault(self, []).extend(new)
                        ret = [(t, p) for t, p in RETAINED.items() if any(matches(f, t) for f in new)]
                    self.send(bytes([0x90]) + enc_len(2 + len(granted)) + pid + bytes(granted))
                    for t, p in ret:
                        self.send(publish_packet(t, p, retain=True))
                    if VERBOSE:
                        print("subscribe", cid, new)
                elif typ == 10:                                         # UNSUBSCRIBE
                    pid = body[:2]
                    pos = 2
                    while pos < len(body):
                        tl = struct.unpack(">H", body[pos:pos + 2])[0]
                        filt = body[pos + 2:pos + 2 + tl].decode("utf-8")
                        pos += 2 + tl
                        with LOCK:
                            if filt in CLIENTS.get(self, []):
                                CLIENTS[self].remove(filt)
                    self.send(bytes([0xB0, 0x02]) + pid)
                elif typ == 3:                                          # PUBLISH
                    tl = struct.unpack(">H", body[:2])[0]
                    topic = body[2:2 + tl].decode("utf-8", "replace")
                    pos = 2 + tl
                    qos = (flags >> 1) & 3
                    if qos:
                        pid = body[pos:pos + 2]
                        pos += 2
                        if qos == 1:
                            self.send(bytes([0x40, 0x02]) + pid)
                    payload = body[pos:]
                    if flags & 1:
                        with LOCK:
                            if payload:
                                RETAINED[topic] = payload
                            else:
                                RETAINED.pop(topic, None)
                    pkt = publish_packet(topic, payload)
                    with LOCK:
                        targets = [c for c, fl in CLIENTS.items() if any(matches(f, topic) for f in fl)]
                    for c in targets:
                        try:
                            c.send(pkt)
                        except OSError:
                            pass
                    if VERBOSE:
                        print("publish", topic, payload[:60], "->", len(targets))
                elif typ == 12:                                         # PINGREQ
                    self.send(bytes([0xD0, 0x00]))
                elif typ == 14:                                         # DISCONNECT
                    break
        except (ConnectionError, OSError, struct.error, IndexError):
            pass
        finally:
            with LOCK:
                CLIENTS.pop(self, None)
            if VERBOSE:
                print("disconnect", cid)


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = False


def main():
    global VERBOSE
    ap = argparse.ArgumentParser(description="Tiny MQTT 3.1.1 test broker (QoS 0, no security)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=1883)
    ap.add_argument("-v", "--verbose", action="store_true")
    a = ap.parse_args()
    VERBOSE = a.verbose
    with Server((a.host, a.port), Handler) as srv:
        print(f"MQTT test broker on {a.host}:{a.port} (QoS 0, no security – for tests only)  Ctrl+C to stop")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
