"""Paper 3 - Modbus TCP measurement bench (extended version of thesis/code/commbench.py).

Differences to the thesis bench:
  * TCP ports 18500 + i only (shared machine; avoids clashes with other writers)
  * explicit seed per run (event streams and emulated PLC delays are reproducible)
  * two event models: 'mix' (thesis: 30 % short pulses U(0.05, 0.5) s, 70 % Exp(mean 5 s))
                      'poisson' (exponential dwell, rate lam per machine -> Poisson event process)
  * ring depth R is a parameter (block = 12 + 3R holding registers)
  * per-interval event counts taken from the change counter (exact), so the Poisson loss model can be tested
  * event-block recovery is checked by IDENTITY (counter, state and PLC time stamp must match the true log)
  * RTT, cycle and latency distributions are stored as percentile vectors / histograms

Process A (machines): N Modbus TCP servers (thread per server, thread per event generator, time.sleep with 1 ms
  timer resolution). Emulated PLC response: delay U(0, scan) + 1 ms when scan > 0.
Process B (gateway): asyncio client, FC03 of the whole block, sequential or parallel, target period P.
Clock: time.perf_counter (QueryPerformanceCounter) in both processes - same system-wide time base on Windows.

Usage: python bench_modbus.py --n 40 --mode par --period 1 --dur 60 --scan 10 --seed 1 --model mix --out ../data/x.jsonl
"""
from __future__ import annotations

import argparse
import asyncio
import json
import math
import platform
import random
import socket
import statistics
import struct
import sys
import threading
import time
from multiprocessing import Process, Queue

BASE_PORT = 18500


def hires_timer():
    try:
        import ctypes
        ctypes.windll.winmm.timeBeginPeriod(1)
    except Exception:
        pass


def u32(x):
    x &= 0xFFFFFFFF
    return [(x >> 16) & 0xFFFF, x & 0xFFFF]


class Machine:
    def __init__(self, idx, seed, model, lam, ring, scan_ms):
        self.idx, self.model, self.lam, self.R, self.scan_ms = idx, model, lam, ring, scan_ms
        self.rng = random.Random(seed)
        self.drng = random.Random(seed + 7919)          # separate stream for emulated PLC delays
        self.state, self.counter, self.t_last, self.good, self.hb = 1, 0, 0, 0, 0
        self.ring = [(0, 0)] * ring
        self.log = []
        self.lock = threading.Lock()

    def dwell(self):
        if self.model == 'mix':
            return self.rng.uniform(0.05, 0.5) if self.rng.random() < 0.3 else self.rng.expovariate(1 / 5.0)
        return self.rng.expovariate(self.lam)

    def regs(self):
        r = [1 if self.state != 4 else 0x8000, self.state] + u32(self.counter) + u32(self.t_last) + \
            u32(self.good) + u32(0) + [1234, self.hb & 0xFFFF]
        for k in range(self.R):                       # newest first
            st, t = self.ring[(self.counter - 1 - k) % self.R] if self.counter > k else (0, 0)
            r += [st] + u32(t)
        return r

    def run_events(self, stop_t):
        t_next = time.perf_counter()
        while True:
            t_next += self.dwell()                    # absolute schedule: sleep overshoot does not accumulate
            if t_next >= stop_t:
                return
            d = t_next - time.perf_counter()
            if d > 0:
                time.sleep(d)
            with self.lock:
                new = self.rng.choice([s for s in (1, 2, 3, 4) if s != self.state])
                t = time.perf_counter()
                self.state = new
                self.counter += 1
                self.t_last = int(t * 1000) & 0xFFFFFFFF
                self.ring[(self.counter - 1) % self.R] = (new, self.t_last)
                if new == 1:
                    self.good += 1
                self.log.append((t, new, self.counter, self.t_last))

    def serve(self, srv, stop_t):
        srv.settimeout(1.0)
        while time.perf_counter() < stop_t:
            try:
                conn, _ = srv.accept()
            except socket.timeout:
                continue
            except OSError:
                return
            conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            conn.settimeout(None)                     # blocking: a partial frame is never discarded by a timeout
            try:
                while True:
                    hdr = _recv_exact(conn, 7)
                    if not hdr:
                        break
                    tid, pid, ln, uid = struct.unpack('>HHHB', hdr)
                    pdu = _recv_exact(conn, ln - 1)
                    if self.scan_ms > 0:              # PLC serves the request at the end of its scan
                        time.sleep((self.drng.uniform(0, self.scan_ms) + 1.0) / 1000.0)
                    with self.lock:                   # snapshot taken when the PLC answers
                        self.hb += 1
                        regs_all = self.regs()
                    if pdu[0] == 3:
                        start, cnt = struct.unpack('>HH', pdu[1:5])
                        regs = (regs_all + [0] * 125)[start:start + cnt]
                        body = struct.pack('>BB', 3, 2 * cnt) + struct.pack('>%dH' % cnt, *regs)
                    else:
                        body = struct.pack('>BB', pdu[0] | 0x80, 1)
                    conn.sendall(struct.pack('>HHHB', tid, 0, len(body) + 1, uid) + body)
            except (ConnectionError, OSError):
                pass
            finally:
                conn.close()


def _recv_exact(conn, n):
    buf = b''
    while len(buf) < n:
        c = conn.recv(n - len(buf))
        if not c:
            return b''
        buf += c
    return buf


def machines_process(cfg, q):
    hires_timer()
    master = random.Random(cfg['seed'])
    ms = [Machine(i, master.randrange(1 << 30), cfg['model'], cfg['lam'], cfg['ring'], cfg['scan']) for i in range(cfg['n'])]
    stop_t = time.perf_counter() + cfg['dur'] + 4
    socks = []
    for i in range(cfg['n']):
        s = socket.socket()
        s.bind(('127.0.0.1', BASE_PORT + i))
        s.listen(1)
        socks.append(s)
    for m, s in zip(ms, socks):
        threading.Thread(target=m.serve, args=(s, stop_t + 1), daemon=True).start()
        threading.Thread(target=m.run_events, args=(stop_t,), daemon=True).start()
    q.put('ready')
    while time.perf_counter() < stop_t + 1.5:
        time.sleep(0.2)
    for s in socks:
        s.close()
    q.put([m.log for m in ms])


async def gateway(cfg):
    n, R = cfg['n'], cfg['ring']
    nreg = 12 + 3 * R
    conns = [await asyncio.open_connection('127.0.0.1', BASE_PORT + i) for i in range(n)]
    polls = [[] for _ in range(n)]        # (t1, t2, state, counter, ring)
    rtts, cycles = [], []
    tid = 0

    async def poll(i):
        nonlocal tid
        tid = (tid + 1) & 0xFFFF
        rd, wr = conns[i]
        t1 = time.perf_counter()
        wr.write(struct.pack('>HHHBBHH', tid, 0, 6, 1, 3, 0, nreg))
        await wr.drain()
        hdr = await rd.readexactly(7)
        ln = struct.unpack('>H', hdr[4:6])[0]
        pdu = await rd.readexactly(ln - 1)
        t2 = time.perf_counter()
        r = struct.unpack('>%dH' % (pdu[1] // 2), pdu[2:])
        rtts.append(t2 - t1)
        ring = [(r[12 + 3 * k], (r[13 + 3 * k] << 16) | r[14 + 3 * k]) for k in range(R)]
        polls[i].append((t1, t2, r[1], (r[2] << 16) | r[3], ring))

    t_end = time.perf_counter() + cfg['dur']
    while time.perf_counter() < t_end:
        c0 = time.perf_counter()
        if cfg['mode'] == 'seq':
            for i in range(n):
                await poll(i)
        else:
            await asyncio.gather(*(poll(i) for i in range(n)))
        cycles.append(time.perf_counter() - c0)
        deadline = c0 + cfg['period']
        while time.perf_counter() < deadline:           # asyncio timers may fire one tick early on Windows
            await asyncio.sleep(max(0.0, deadline - time.perf_counter()) or 0.001)
    for _, w in conns:
        w.close()
    return polls, rtts, cycles


def cpu_times():
    """System-wide (idle, kernel+user) 100-ns ticks via GetSystemTimes (Windows); None elsewhere."""
    try:
        import ctypes
        from ctypes import wintypes
        i, k, u = wintypes.FILETIME(), wintypes.FILETIME(), wintypes.FILETIME()
        ctypes.windll.kernel32.GetSystemTimes(ctypes.byref(i), ctypes.byref(k), ctypes.byref(u))
        f = lambda t: (t.dwHighDateTime << 32) | t.dwLowDateTime
        return f(i), f(k) + f(u)
    except Exception:
        return None


def cpu_busy(a, b):
    if not a or not b:
        return None
    di, dt = b[0] - a[0], b[1] - a[1]
    return 1.0 - di / dt if dt else None


def pois_tail_excess(mu, R):
    """E[(N - R)+] and P(N > R) for N ~ Poisson(mu)."""
    p, cdf, ex_le = math.exp(-mu), 0.0, 0.0
    for k in range(R + 1):
        cdf += p
        ex_le += (R - k) * p       # E[(R-N)+]
        p *= mu / (k + 1)
    # E[(N-R)+] = E[N] - R + E[(R-N)+]
    return mu - R + ex_le, 1.0 - cdf


def pctl(v, ps=(0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99, 0.999)):
    v = sorted(v)
    return {str(p): v[min(len(v) - 1, int(p * len(v)))] for p in ps} if v else {}


def analyse(cfg, logs, polls):
    R, lam = cfg['ring'], cfg['lam']
    tot = dict(events=0, R_ok=0, R_wrong=0, S_reported=0, intervals=0, overflow_obs=0, lost_by_counter=0,
               pred_lost=0.0, pred_overflow=0.0, pred_S=0.0, obs_time=0.0)
    lat, tserr, ncount = [], [], {}
    for i, log in enumerate(logs):
        p = polls[i]
        if len(p) < 2:
            continue
        by_c = {c: (t, st, tms) for t, st, c, tms in log}
        c_first, c_last = p[0][3], p[-1][3]
        tot['events'] += c_last - c_first
        tot['obs_time'] += p[-1][1] - p[0][1]
        for (a1, a2, sa, ca, _), (b1, b2, sb, cb, ring) in zip(p, p[1:]):
            d = cb - ca
            dt = (b1 + b2) / 2 - (a1 + a2) / 2
            tot['intervals'] += 1
            ncount[d] = ncount.get(d, 0) + 1
            if d > R:
                tot['overflow_obs'] += 1
                tot['lost_by_counter'] += d - R
            if sb != sa:
                tot['S_reported'] += 1
            for k in range(min(d, R) - 1, -1, -1):  # oldest first
                c = cb - k
                st, tms = ring[k]
                tr = by_c.get(c)
                if tr and tr[1] == st and tr[2] == tms:
                    tot['R_ok'] += 1
                    lat.append(b2 - tr[0])
                    tserr.append(abs(tms / 1000.0 - (int(tr[0] * 1000) & 0xFFFFFFFF) / 1000.0))
                else:
                    tot['R_wrong'] += 1
            if cfg['model'] == 'poisson':
                ex, pov = pois_tail_excess(lam * dt, R)
                tot['pred_lost'] += ex
                tot['pred_overflow'] += pov
                tot['pred_S'] += 0.75 * (1 - math.exp(-4 * lam * dt / 3))
    tot['R_lost'] = tot['events'] - tot['R_ok']
    tot['lam_measured'] = tot['events'] / tot['obs_time'] if tot['obs_time'] else float('nan')
    return tot, lat, tserr, ncount


def run(cfg):
    hires_timer()
    q = Queue()
    pr = Process(target=machines_process, args=(cfg, q))
    pr.start()
    assert q.get(timeout=60) == 'ready'
    time.sleep(0.5)
    c0 = cpu_times()
    polls, rtts, cycles = asyncio.run(gateway(cfg))
    busy = cpu_busy(c0, cpu_times())
    logs = q.get(timeout=180)
    pr.join()
    tot, lat, tserr, ncount = analyse(cfg, logs, polls)
    rtt_ms = [1000 * x for x in rtts]
    hist = {}
    for x in rtt_ms:
        b = round(math.floor(x / 0.25) * 0.25, 2)
        hist[b] = hist.get(b, 0) + 1
    out = dict(cfg)
    out.update({
        'host': platform.platform(), 'python': platform.python_version(),
        'polls': len(rtts), 'cpu_busy_system': busy,
        'actual_rate_hz': statistics.mean((len(p) - 1) / (p[-1][1] - p[0][1]) for p in polls if len(p) > 1), 'cycle_mean_ms': 1000 * statistics.mean(cycles),
        'cycle_pctl_ms': {k: 1000 * v for k, v in pctl(cycles).items()},
        'achieved_rate_hz': 1 / max(statistics.mean(cycles), cfg['period']),
        'rtt_mean_ms': statistics.mean(rtt_ms), 'rtt_sd_ms': statistics.pstdev(rtt_ms), 'rtt_pctl_ms': pctl(rtt_ms),
        'rtt_hist_ms_0.25': {str(k): v for k, v in sorted(hist.items())},
        'lat_mean_s': statistics.mean(lat) if lat else None, 'lat_pctl_s': pctl(lat),
        'lat_max_s': max(lat) if lat else None,
        'tserr_max_ms': 1000 * max(tserr) if tserr else None,
        'interval_counts': {str(k): v for k, v in sorted(ncount.items())},
    })
    out.update(tot)
    out['S_share_reported'] = tot['S_reported'] / tot['events'] if tot['events'] else None
    out['R_loss_share'] = tot['R_lost'] / tot['events'] if tot['events'] else None
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=10)
    ap.add_argument('--mode', default='par')
    ap.add_argument('--period', type=float, default=1.0)
    ap.add_argument('--dur', type=float, default=60.0)
    ap.add_argument('--scan', type=float, default=10.0)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--model', default='mix')
    ap.add_argument('--lam', type=float, default=0.0)
    ap.add_argument('--ring', type=int, default=8)
    ap.add_argument('--tag', default='')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    cfg = dict(n=a.n, mode=a.mode, period=a.period, dur=a.dur, scan=a.scan, seed=a.seed, model=a.model, lam=a.lam,
               ring=a.ring, tag=a.tag)
    assert BASE_PORT + a.n - 1 <= 18999
    t0 = time.time()
    r = run(cfg)
    r['wall_start'] = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(t0))
    short = {k: r[k] for k in ('tag', 'n', 'mode', 'period', 'scan', 'seed', 'model', 'lam', 'events', 'R_lost',
                               'R_wrong', 'S_share_reported', 'cycle_mean_ms', 'actual_rate_hz', 'rtt_mean_ms', 'lat_max_s', 'cpu_busy_system')}
    print(json.dumps(short))
    with open(a.out, 'a') as f:
        f.write(json.dumps(r) + '\n')
