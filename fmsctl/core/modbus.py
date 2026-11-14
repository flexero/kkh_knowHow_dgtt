"""Modbus TCP client and server (standard library only) for the FMS control system.

Client: read holding registers (FC03), write single (FC06) / multiple (FC16), automatic reconnect, timeout, typed
helpers through spec.regmap. Server: thread per connection, used by the virtual plant and by tests; the register
image is a list owned by the device model, protected by its lock.
"""
from __future__ import annotations

import socket
import struct
import threading

EXC = {1: 'illegal function', 2: 'illegal data address', 3: 'illegal data value', 4: 'device failure'}


class ModbusError(Exception):
    def __init__(self, kind, code=None):
        super().__init__(f'{kind}' + (f' (exception {code}: {EXC.get(code, "?")})' if code else ''))
        self.kind, self.code = kind, code


class ModbusClient:
    def __init__(self, host, port=502, unit=1, timeout=0.5):
        self.host, self.port, self.unit, self.timeout = host, port, unit, timeout
        self.sock, self.tid, self.lock = None, 0, threading.Lock()

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            finally:
                self.sock = None

    def _connect(self):
        self.sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
        self.sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

    def _recv(self, n):
        buf = b''
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise ModbusError('connection closed')
            buf += chunk
        return buf

    def _transact(self, pdu):
        with self.lock:
            for attempt in (1, 2):
                try:
                    if self.sock is None:
                        self._connect()
                    self.tid = (self.tid + 1) & 0xFFFF
                    self.sock.sendall(struct.pack('>HHHB', self.tid, 0, len(pdu) + 1, self.unit) + pdu)
                    hdr = self._recv(7)
                    tid, _, ln, _ = struct.unpack('>HHHB', hdr)
                    body = self._recv(ln - 1)
                    if tid != self.tid:
                        raise ModbusError('transaction id mismatch')
                    if body[0] & 0x80:
                        raise ModbusError('exception', body[1])
                    return body
                except ModbusError as e:
                    if e.kind == 'exception':
                        raise
                    self.close()
                    if attempt == 2:
                        raise
                except OSError as e:
                    self.close()
                    if attempt == 2:
                        raise ModbusError(f'no connection: {e}')

    def read(self, addr, n):
        out = []
        while n > 0:                      # Modbus limit: 125 registers per request
            k = min(n, 125)
            body = self._transact(struct.pack('>BHH', 3, addr, k))
            out += list(struct.unpack('>%dH' % k, body[2:2 + 2 * k]))
            addr += k
            n -= k
        return out

    def write1(self, addr, value):
        self._transact(struct.pack('>BHH', 6, addr, value & 0xFFFF))

    def write(self, addr, values):
        values = [v & 0xFFFF for v in values]
        self._transact(struct.pack('>BHHB', 16, addr, len(values), 2 * len(values)) + struct.pack('>%dH' % len(values), *values))


class ModbusServer:
    """Serves the register image of one device. `on_write(addr, values)` is called after every accepted write."""

    def __init__(self, host, port, image, lock, writable, on_write=None, unit=1):
        self.image, self.lock, self.writable, self.on_write, self.unit = image, lock, writable, on_write, unit
        self.srv = socket.socket()
        self.srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.srv.bind((host, port))
        self.srv.listen(4)
        self.running = True
        threading.Thread(target=self._accept, daemon=True).start()

    def stop(self):
        self.running = False
        try:
            self.srv.close()
        except OSError:
            pass

    def _accept(self):
        while self.running:
            try:
                conn, _ = self.srv.accept()
            except OSError:
                return
            threading.Thread(target=self._serve, args=(conn,), daemon=True).start()

    def _serve(self, conn):
        conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        try:
            while self.running:
                hdr = b''
                while len(hdr) < 7:
                    c = conn.recv(7 - len(hdr))
                    if not c:
                        return
                    hdr += c
                tid, pid, ln, uid = struct.unpack('>HHHB', hdr)
                pdu = b''
                while len(pdu) < ln - 1:
                    c = conn.recv(ln - 1 - len(pdu))
                    if not c:
                        return
                    pdu += c
                conn.sendall(struct.pack('>HHHB', tid, 0, 0, uid)[:4] + self._reply(pdu, tid, uid))
        except OSError:
            pass
        finally:
            conn.close()

    def _reply(self, pdu, tid, uid):
        fc = pdu[0]

        def frame(body):
            return struct.pack('>HB', len(body) + 1, uid) + body

        def exc(code):
            return frame(bytes([fc | 0x80, code]))
        size = len(self.image)
        if fc in (3, 4):
            addr, n = struct.unpack('>HH', pdu[1:5])
            if n < 1 or n > 125:
                return exc(3)                             # illegal data value (quantity)
            if addr + n > size:
                return exc(2)                             # illegal data address
            with self.lock:
                regs = self.image[addr:addr + n]
            return frame(struct.pack('>BB', fc, 2 * n) + struct.pack('>%dH' % n, *regs))
        if fc == 6:
            addr, val = struct.unpack('>HH', pdu[1:5])
            if addr >= size or not self.writable(addr, 1):
                return exc(2)
            with self.lock:
                self.image[addr] = val
            if self.on_write:
                self.on_write(addr, [val])
            return frame(pdu[:5])
        if fc == 16:
            addr, n, nb = struct.unpack('>HHB', pdu[1:6])
            if n < 1 or n > 123 or nb != 2 * n or len(pdu) < 6 + nb:
                return exc(3)                             # quantity / byte count inconsistent
            vals = list(struct.unpack('>%dH' % n, pdu[6:6 + 2 * n]))
            if addr + n > size or not self.writable(addr, n):
                return exc(2)
            with self.lock:
                self.image[addr:addr + n] = vals
            if self.on_write:
                self.on_write(addr, vals)
            return frame(struct.pack('>BHH', 16, addr, n))
        return exc(1)
