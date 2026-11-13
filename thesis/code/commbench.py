"""Laboratory measurement bench for the Modbus TCP + HTTP twin architecture (thesis chapter 5).

Process A (machines): N simulated machines, each a Modbus TCP server on its own port (asyncio, one process).
  Each machine changes state at random times (long states and short pulses) and logs the TRUE time of every change.
  Register block (FC03, 36 holding registers, thesis Table 5.3):
    0 status word | 1 state code | 2-3 change counter (u32) | 4-5 time of last change [ms, u32] | 6-7 good counter |
    8-9 scrap counter | 10 last cycle time [0.1 s] | 11 heartbeat | 12-35 event ring: 8 x (state, t_hi, t_lo)
Process B (gateway): polls all machines with FC03 (36 registers) - sequentially or in parallel - at a target period P,
  and reconstructs events in two ways:
    S  state-only: a change is reported when the state code differs from the previous poll (time = poll time)
    R  ring buffer: the change counter tells how many events happened; up to 8 are recovered with PLC time stamps
Both processes use the same PC clock (time.time), so latencies and losses are measured exactly.

Usage: python commbench.py N mode period duration out.jsonl [plc_scan_ms]   (mode = seq | par)
       python commbench.py rtt                                  (round-trip time vs number of registers)
"""
from __future__ import annotations

import asyncio
import json
import random
import socket
import statistics
import struct
import sys
import time
from multiprocessing import Process, Queue

BASE_PORT = 16000
PLC_SCAN_MS = 0.0   # >0: emulate a PLC that answers Modbus at the end of its scan: delay U(0, scan) + 1 ms


def hires_timer():
    """Windows: 1 ms timer resolution (default 15.6 ms would distort asyncio.sleep)."""
    try:
        import ctypes
        ctypes.windll.winmm.timeBeginPeriod(1)
    except Exception:
        pass

NREG = 36
RING = 8


def u32(x):
    x &= 0xFFFFFFFF
    return [(x >> 16) & 0xFFFF, x & 0xFFFF]


class Machine:
    def __init__(self, idx, rng):
        self.idx, self.rng = idx, rng
        self.state, self.counter, self.t_last = 1, 0, 0
        self.good = self.scrap = 0
        self.hb = 0
        self.ring = [(0, 0)] * RING           # (state, t_ms)
        self.log = []                          # true events (t, state, counter)
        self.t0_ms = int(time.perf_counter() * 1000)
        self.scan_ms = 0.0

    def regs(self):
        r = [1 if self.state != 4 else 0x8000, self.state] + u32(self.counter) + u32(self.t_last) + \
            u32(self.good) + u32(self.scrap) + [1234, self.hb & 0xFFFF]
        # ring ordered newest first
        for k in range(RING):
            st, t = self.ring[(self.counter - 1 - k) % RING] if self.counter > k else (0, 0)
            r += [st] + u32(t)
        return r

    def run_events(self, stop_t):
        """Thread: state changes at random times (time.sleep is accurate to ~1 ms with timeBeginPeriod(1))."""
        states = [1, 2, 3, 4]                  # 1 processing, 2 idle, 3 blocked, 4 down
        while time.perf_counter() < stop_t:
            if self.rng.random() < 0.3:
                dwell = self.rng.uniform(0.05, 0.5)        # short pulse (e.g. brief stop)
            else:
                dwell = self.rng.expovariate(1 / 5.0)      # normal state, mean 5 s
            time.sleep(dwell)
            with self.lock:
                new = self.rng.choice([s for s in states if s != self.state])
                t = time.perf_counter()
                self.state = new
                self.counter += 1
                self.t_last = int(t * 1000) & 0xFFFFFFFF
                self.ring[(self.counter - 1) % RING] = (new, self.t_last)
                if new == 1:
                    self.good += 1
                self.log.append((t, new, self.counter))

    def serve(self, srv_sock, stop_t):
        """Thread: Modbus TCP server of this machine (one client connection, FC03 only)."""
        srv_sock.settimeout(1.0)
        while time.perf_counter() < stop_t:
            try:
                conn, _ = srv_sock.accept()
            except socket.timeout:
                continue
            except OSError:          # listening socket closed at shutdown
                return
            conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            conn.settimeout(1.0)
            rng = random.Random(self.idx)
            try:
                while time.perf_counter() < stop_t:
                    try:
                        hdr = _recv_exact(conn, 7)
                    except socket.timeout:
                        continue
                    if not hdr:
                        break
                    tid, pid, ln, uid = struct.unpack('>HHHB', hdr)
                    pdu = _recv_exact(conn, ln - 1)
                    fc = pdu[0]
                    with self.lock:
                        self.hb += 1
                        regs_all = self.regs()
                    if fc == 3:
                        start, cnt = struct.unpack('>HH', pdu[1:5])
                        regs = (regs_all + [0] * 125)[start:start + cnt]
                        body = struct.pack('>BB', 3, 2 * cnt) + struct.pack('>%dH' % cnt, *regs)
                    else:
                        body = struct.pack('>BB', fc | 0x80, 1)
                    if self.scan_ms > 0:   # PLC answers at the end of its scan: U(0, scan) + 1 ms
                        time.sleep((rng.uniform(0, self.scan_ms) + 1.0) / 1000.0)
                    conn.sendall(struct.pack('>HHHB', tid, 0, len(body) + 1, uid) + body)
            except (ConnectionError, OSError):
                pass
            finally:
                conn.close()


def _recv_exact(conn, n):
    buf = b''
    while len(buf) < n:
        chunk = conn.recv(n - len(buf))
        if not chunk:
            return b''
        buf += chunk
    return buf


def machines_process(n, duration, q, seed=1, scan_ms=0.0):
    """Process A: N machines, each with an event thread and a server thread (no asyncio timers - on Windows they
    fire up to one clock tick (15.6 ms) early, which invalidated a first version of this bench)."""
    import threading
    hires_timer()
    rng = random.Random(seed)
    ms = [Machine(i, random.Random(rng.random())) for i in range(n)]
    stop_t = time.perf_counter() + duration
    socks = []
    for i, m in enumerate(ms):
        m.scan_ms = scan_ms
        m.lock = threading.Lock()
        s = socket.socket()
        s.bind(('127.0.0.1', BASE_PORT + i))
        s.listen(1)
        socks.append(s)
    ths = []
    for m, s in zip(ms, socks):
        ths.append(threading.Thread(target=m.serve, args=(s, stop_t + 1), daemon=True))
        ths.append(threading.Thread(target=m.run_events, args=(stop_t,), daemon=True))
    for t in ths:
        t.start()
    q.put('ready')
    while time.perf_counter() < stop_t + 1.5:
        time.sleep(0.2)
    for s in socks:
        s.close()
    q.put([m.log for m in ms])


async def read_regs(reader, writer, tid, count=NREG):
    writer.write(struct.pack('>HHHBBHH', tid & 0xFFFF, 0, 6, 1, 3, 0, count))
    await writer.drain()
    hdr = await reader.readexactly(7)
    ln = struct.unpack('>H', hdr[4:6])[0]
    pdu = await reader.readexactly(ln - 1)
    return struct.unpack('>%dH' % (pdu[1] // 2), pdu[2:])


def decode(r):
    cnt = (r[2] << 16) | r[3]
    ring = [(r[12 + 3 * k], (r[13 + 3 * k] << 16) | r[14 + 3 * k]) for k in range(RING)]
    return r[1], cnt, ring


async def gateway(n, mode, period, duration):
    conns = []
    for i in range(n):
        conns.append(await asyncio.open_connection('127.0.0.1', BASE_PORT + i))
    last = [None] * n
    last_poll = [0.0] * n
    first_poll = [None] * n
    det_S, det_R, rtts, cycles = [[] for _ in range(n)], [[] for _ in range(n)], [], []
    tid = 0

    async def poll(i):
        nonlocal tid
        tid += 1
        t1 = time.perf_counter()
        r = await read_regs(*conns[i], tid)
        t2 = time.perf_counter()
        rtts.append(t2 - t1)
        last_poll[i] = t1
        if first_poll[i] is None:
            first_poll[i] = t2
        st, cnt, ring = decode(r)
        if last[i] is not None:
            pst, pcnt = last[i]
            if st != pst:
                det_S[i].append(t2)
            new = cnt - pcnt
            for k in range(min(new, RING) - 1, -1, -1):
                det_R[i].append((t2, ring[k][1], cnt - k))
        last[i] = (st, cnt)

    t_end = time.perf_counter() + duration
    while time.perf_counter() < t_end:
        c0 = time.perf_counter()
        if mode == 'seq':
            for i in range(n):
                await poll(i)
        else:
            await asyncio.gather(*(poll(i) for i in range(n)))
        dt = time.perf_counter() - c0
        cycles.append(dt)
        deadline = c0 + period
        while time.perf_counter() < deadline:          # asyncio timers may fire one tick early on Windows
            await asyncio.sleep(max(0.0, deadline - time.perf_counter()) or 0.001)
    for r, w in conns:
        w.close()
    return det_S, det_R, rtts, cycles, (first_poll, last_poll)


def analyse(true_logs, det_S, det_R, t_start, t_stop, last_poll=None):
    res = {'events': 0, 'S_reported': 0, 'R_recovered': 0, 'R_lost': 0, 'lat_R': [], 'tserr_S': [], 'tserr_R': []}
    for i, log in enumerate(true_logs):
        # only events between the baseline (first) poll and the last poll of this machine can be detected
        t_beg_i = max(t_start + 1, last_poll[0][i] + 0.001) if last_poll else t_start + 1
        t_end_i = min(t_stop - 1, last_poll[1][i] - 0.001) if last_poll else t_stop - 1
        evs = [e for e in log if t_beg_i <= e[0] <= t_end_i]
        res['events'] += len(evs)
        res['S_reported'] += sum(1 for t in det_S[i] if t_start + 1 <= t <= t_stop - 1)
        rec = {c: (tdet, tplc) for tdet, tplc, c in det_R[i]}
        for t, st, c in evs:
            if c in rec:
                res['R_recovered'] += 1
                tdet, tplc = rec[c]
                res['lat_R'].append(tdet - t)
                res['tserr_R'].append(abs(tplc / 1000.0 - (int(t * 1000) & 0xFFFFFFFF) / 1000.0))
            else:
                res['R_lost'] += 1
    return res


def pct(v, p):
    v = sorted(v)
    return v[min(len(v) - 1, int(p * len(v)))] if v else float('nan')


def run(n, mode, period, duration, scan_ms=0.0):
    hires_timer()
    q = Queue()
    pr = Process(target=machines_process, args=(n, duration + 4, q, 1, scan_ms))
    pr.start()
    assert q.get(timeout=60) == 'ready'
    time.sleep(0.5)
    t_start = time.perf_counter()
    det_S, det_R, rtts, cycles, last_poll = asyncio.run(gateway(n, mode, period, duration))
    t_stop = time.perf_counter()
    logs = q.get(timeout=120)
    pr.join()
    a = analyse(logs, det_S, det_R, t_start, t_stop, last_poll)
    # state-only latency for long states: time from true change to first poll after it (estimated per cycle)
    out = {
        'N': n, 'mode': mode, 'period_s': period, 'duration_s': duration, 'plc_scan_ms': scan_ms,
        'cycle_mean_s': statistics.mean(cycles), 'cycle_p95_s': pct(cycles, 0.95), 'cycle_max_s': max(cycles),
        'achieved_rate_hz': 1 / max(statistics.mean(cycles), period),
        'rtt_median_ms': 1000 * statistics.median(rtts), 'rtt_p99_ms': 1000 * pct(rtts, 0.99),
        'events': a['events'],
        'S_share_reported': a['S_reported'] / a['events'],
        'R_loss': a['R_lost'] / a['events'],
        'lat_R_mean_s': statistics.mean(a['lat_R']), 'lat_R_p95_s': pct(a['lat_R'], 0.95),
        'lat_R_max_s': max(a['lat_R']),
        'tserr_R_max_ms': 1000 * max(a['tserr_R']),
        'bytes_per_cycle_payload': n * (12 + 9 + 2 * NREG),
    }
    return out


def rtt_bench():
    q = Queue()
    pr = Process(target=machines_process, args=(1, 20, q))
    pr.start()
    q.get(timeout=60)
    s = socket.create_connection(('127.0.0.1', BASE_PORT))
    s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    out = {}
    for cnt in (1, 16, 36, 64, 125):
        ts = []
        for k in range(2000):
            t1 = time.perf_counter()
            s.sendall(struct.pack('>HHHBBHH', k, 0, 6, 1, 3, 0, cnt))
            need, buf = 9 + 2 * cnt, b''
            while len(buf) < need:
                buf += s.recv(need - len(buf))
            ts.append(time.perf_counter() - t1)
        out[cnt] = (1000 * statistics.median(ts), 1000 * pct(ts, 0.99))
    s.close()
    pr.terminate()
    return out


if __name__ == '__main__':
    if sys.argv[1] == 'rtt':
        r = rtt_bench()
        print(json.dumps(r))
        json.dump(r, open('../data/comm_rtt.json', 'w'))
    else:
        n, mode, period, dur, out = int(sys.argv[1]), sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
        scan = float(sys.argv[6]) if len(sys.argv) > 6 else 0.0
        r = run(n, mode, period, dur, scan)
        print(json.dumps(r))
        with open(out, 'a') as f:
            f.write(json.dumps(r) + '\n')
