"""Paper 3 - handshake latency and fault injection on the fmsctl virtual plant (ports 18700-18799 only).

Part L (latency): commands to WASH-01 (device type STATION, command 10, qty 1) on the virtual plant of 21 PLCs.
  Sequences   'devicelink' = fmsctl.core.device.DeviceLink.command() as used by the cell controller
              '3frame'     = minimal sequence: FC16 job block, FC16 code+seq, FC06 REQ, then FC03 8-10 until ACK
                             (controller keeps REQ and seq in memory - no read-before-write)
  PLC timing  scan 0  : virtual plant as is (request served and REQ handled immediately)
              scan 10 : emulated scan-synchronous PLC - every reply delayed U(0, 10) + 1 ms, the REQ toggle is
                        handled one full scan (10 ms) after the write was applied
  ACK poll    20 ms (DeviceLink default) and 5 ms
Part F (fault injection): a Modbus-aware TCP proxy between DeviceLink and WASH-01 drops, duplicates or delays single
  frames; we count how many jobs the PLC really started per command (must be exactly one).
  F7 replays a stale REQ frame after the next command (delayed duplicate across a reconnect); it is run with the
  toggle-only PLC logic of fmsctl V1.2 and with an added sequence guard (accept a toggle only if cmd.seq != ackSeq).

    python bench_handshake.py lat     -> ../data/handshake_latency.json
    python bench_handshake.py fault   -> ../data/handshake_faults.json
All times with time.perf_counter; seeds fixed.
"""
from __future__ import annotations

import json
import os
import random
import socket
import statistics
import struct
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, ROOT)

from fmsctl.core import modbus as MB                      # noqa: E402
from fmsctl.core.device import DeviceLink, HandshakeError  # noqa: E402
from fmsctl.sim import virtual_plant as VP                 # noqa: E402
from fmsctl.spec import plant                              # noqa: E402

BASE = 18700
PROXY = 18760
DEV = 'WASH-01'
PARAMS = {'job.variant': 1, 'job.qty': 1}


def hires_timer():
    try:
        import ctypes
        ctypes.windll.winmm.timeBeginPeriod(1)
    except Exception:
        pass


# ------------------------------------------------------------------ emulated PLC scan (monkeypatch, no file edits)
SCAN = {'ms': 0.0, 'rng': random.Random(5)}
_orig_reply = MB.ModbusServer._reply
_orig_on_write = VP.Device.on_write


def _reply_scan(self, pdu, tid, uid):
    if SCAN['ms'] > 0:
        time.sleep((SCAN['rng'].uniform(0, SCAN['ms']) + 1.0) / 1000.0)
    return _orig_reply(self, pdu, tid, uid)


def _on_write_scan(self, addr, vals):
    if SCAN['ms'] > 0 and addr <= 202 < addr + len(vals):
        threading.Timer(SCAN['ms'] / 1000.0, _dispatch, args=(self, addr, vals)).start()
        return
    _dispatch(self, addr, vals)


GUARD = {'on': False, 'ignored': 0}
STARTS = {}


def _dispatch(self, addr, vals):
    if GUARD['on'] and addr <= 202 < addr + len(vals):
        req = self.get('cmd.ctl') & 1
        if req != (self.ack & 1) and self.get('cmd.seq') == self.get('hs.ackSeq'):
            GUARD['ignored'] += 1                      # stale toggle: sequence number already acknowledged
            return
    _orig_on_write(self, addr, vals)


_orig_run_job = VP.Device.run_job


def _run_job_count(self, code):
    STARTS.setdefault(self.info['id'], []).append((self.get('job.id'), self.get('cmd.seq')))
    return _orig_run_job(self, code)


MB.ModbusServer._reply = _reply_scan
VP.Device.on_write = _on_write_scan
VP.Device.run_job = _run_job_count


class CountingClient(MB.ModbusClient):
    """ModbusClient that logs (t_start, t_end, function code) of every transaction."""
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.trace = []

    def _transact(self, pdu):
        t1 = time.perf_counter()
        try:
            return super()._transact(pdu)
        finally:
            self.trace.append((t1, time.perf_counter(), pdu[0], struct.unpack('>H', pdu[1:3])[0] if len(pdu) >= 3 else -1))


def make_link(info, timeout=0.5):
    link = DeviceLink(info, timeout)
    link.cli = CountingClient(info['host'], info['port'], info['unit'], timeout)
    return link


def three_frame(link, state, job_id, poll_s):
    """Minimal 3-frame command; state = {'req': int, 'seq': int} kept by the controller."""
    cli = link.cli
    from fmsctl.spec import regmap as R
    img = {}
    for k, v in [('job.id', job_id)] + list(PARAMS.items()):
        a, t = link.idx[k]
        for i, r in enumerate(R.enc(t, v)):
            img[a + i] = r
    lo, hi = min(img), max(img)
    cli.write(lo, [img.get(a, 0) for a in range(lo, hi + 1)])     # 1 FC16: whole job block 400-405
    state['seq'] = (state['seq'] + 1) & 0xFFFF
    cli.write(200, [10, state['seq']])                             # 2 FC16: code + seq
    state['req'] ^= 1
    cli.write1(202, state['req'])                                  # 3 FC06: REQ toggle
    t_end = time.perf_counter() + 5.0
    while time.perf_counter() < t_end:
        st, ack_seq, res = cli.read(8, 3)                          # FC03 8-10
        if (st & 1) == state['req'] and ack_seq == state['seq']:
            if res:
                raise HandshakeError(f'rejected {res}')
            return job_id
        time.sleep(poll_s)
    raise HandshakeError('no ACK')


def pct(v, p):
    v = sorted(v)
    return v[min(len(v) - 1, int(p * len(v)))]


def ci95(v):
    m = statistics.mean(v)
    if len(v) < 2:
        return m, 0.0
    return m, 1.96 * statistics.stdev(v) / len(v) ** 0.5


def latency(n_cmd=300):
    hires_timer()
    devs = VP.start(speed=1000.0, seed=5, base_port=BASE)
    table = {d['id']: d for d in plant.device_table(virtual=True, base_port=BASE)}
    info = table[DEV]
    out = {'device': DEV, 'n_commands': n_cmd, 'speed': 1000.0, 'runs': []}
    jid = 500000
    for scan in (0.0, 10.0):
        for seqname, poll in (('devicelink', 0.02), ('3frame', 0.02), ('3frame', 0.005)):
            SCAN['ms'], SCAN['rng'] = scan, random.Random(int(scan) * 100 + int(poll * 1000))
            link = make_link(info)
            link.read('hdr.mapVersion')
            state = {'req': link.read('cmd.ctl') & 1, 'seq': link.read('hs.ackSeq')}
            tot, wr, ack, frames, fb = [], [], [], [], []
            for k in range(n_cmd):
                jid += 1
                link.cli.trace.clear()
                t0 = time.perf_counter()
                if seqname == 'devicelink':
                    link.command(10, PARAMS, job_id=jid)
                else:
                    three_frame(link, state, jid, poll)
                t1 = time.perf_counter()
                tr = list(link.cli.trace)
                t_req = [e for e in tr if e[2] == 6 and e[3] == 202][-1][1]    # end of the FC06 REQ transaction
                tot.append(1000 * (t1 - t0)); wr.append(1000 * (t_req - t0)); ack.append(1000 * (t1 - t_req))
                frames.append(len(tr))
                fb.append(1 + max(i for i, e in enumerate(tr) if e[2] == 6 and e[3] == 202))
                link.wait_done(jid, timeout=10, poll=0.002)
                if seqname == '3frame':
                    state['req'] = link.read('cmd.ctl') & 1
            rtt = [1000 * (e[1] - e[0]) for e in link.cli.trace] if link.cli.trace else []
            r = {'scan_ms': scan, 'sequence': seqname, 'ack_poll_ms': 1000 * poll,
                 'frames_mean': statistics.mean(frames), 'frames_min': min(frames), 'frames_max': max(frames)}
            for name, v in (('total', tot), ('write_phase', wr), ('ack_phase', ack)):
                m, h = ci95(v)
                r[name] = {'mean_ms': m, 'ci95_ms': h, 'median_ms': statistics.median(v), 'p95_ms': pct(v, 0.95),
                           'max_ms': max(v)}
            r['frames_before_req_mean'] = statistics.mean(fb)
            out['runs'].append(r)
            print(json.dumps({k: r[k] for k in ('scan_ms', 'sequence', 'ack_poll_ms', 'frames_mean')}),
                  {k: round(r[k]['mean_ms'], 2) for k in ('total', 'write_phase', 'ack_phase')}, flush=True)
            link.cli.close()
    # single-transaction RTT on the virtual plant for the model (FC03 of 3 registers)
    for scan in (0.0, 10.0):
        SCAN['ms'], SCAN['rng'] = scan, random.Random(77)
        cli = MB.ModbusClient('127.0.0.1', info['port'])
        v = []
        for _ in range(2000):
            t = time.perf_counter(); cli.read(8, 3); v.append(1000 * (time.perf_counter() - t))
        cli.close()
        out[f'rtt_fc03_scan{int(scan)}'] = {'mean_ms': statistics.mean(v), 'median_ms': statistics.median(v),
                                            'p99_ms': pct(v, 0.99)}
    for d in devs.values():
        d.server.stop()
    json.dump(out, open(os.path.join(HERE, '..', 'data', 'handshake_latency.json'), 'w'), indent=1)


# ------------------------------------------------------------------ fault-injection proxy
class Proxy:
    """Modbus-aware TCP proxy. plan: list of dicts {match: fn(fc, addr, pdu) -> bool, action, left}."""

    def __init__(self, listen_port, target_port):
        self.target, self.plan, self.captured = target_port, [], []
        self.srv = socket.socket()
        self.srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.srv.bind(('127.0.0.1', listen_port))
        self.srv.listen(4)
        self.lock = threading.Lock()
        threading.Thread(target=self._accept, daemon=True).start()

    def _accept(self):
        while True:
            try:
                c, _ = self.srv.accept()
            except OSError:
                return
            threading.Thread(target=self._serve, args=(c,), daemon=True).start()

    @staticmethod
    def _frame(sock):
        h = b''
        while len(h) < 7:
            x = sock.recv(7 - len(h))
            if not x:
                return None
            h += x
        ln = struct.unpack('>H', h[4:6])[0]
        b = b''
        while len(b) < ln - 1:
            x = sock.recv(ln - 1 - len(b))
            if not x:
                return None
            b += x
        return h + b

    def _action(self, frame):
        fc = frame[7]
        addr = struct.unpack('>H', frame[8:10])[0] if len(frame) >= 10 else -1
        with self.lock:
            for f in self.plan:
                if f['left'] > 0 and f['match'](fc, addr, frame):
                    f['left'] -= 1
                    if f.get('capture'):
                        self.captured.append(frame)
                    return f['action']
        return 'pass'

    def _serve(self, c):
        s = socket.create_connection(('127.0.0.1', self.target))
        try:
            while True:
                req = self._frame(c)
                if req is None:
                    return
                act = self._action(req)
                if act == 'drop_req':
                    continue
                s.sendall(req)
                resp = self._frame(s)
                if act == 'dup_req':
                    s.sendall(req)
                    self._frame(s)
                if act == 'drop_resp':
                    continue
                if act == 'delay_resp':
                    time.sleep(0.8)
                try:
                    c.sendall(resp)
                except OSError:
                    return
        except OSError:
            return
        finally:
            c.close()
            s.close()


def is_req(fc, addr, fr):
    return fc == 6 and addr == 202


def is_codeseq(fc, addr, fr):
    return fc == 16 and addr == 200


def is_params(fc, addr, fr):
    return fc == 16 and addr == 400


def fault(n_rep=20):
    hires_timer()
    SCAN['ms'] = 0.0
    devs = VP.start(speed=1000.0, seed=6, base_port=BASE)
    table = {d['id']: d for d in plant.device_table(virtual=True, base_port=BASE)}
    info = dict(table[DEV])
    proxy = Proxy(PROXY, info['port'])
    pinfo = dict(info, port=PROXY)
    cases = [
        ('F0 no fault', None, None, 1),
        ('F1 REQ request lost once', is_req, 'drop_req', 1),
        ('F2 REQ response lost once', is_req, 'drop_resp', 1),
        ('F3 REQ request duplicated', is_req, 'dup_req', 1),
        ('F4 REQ response late (0.8 s > 0.5 s time-out)', is_req, 'delay_resp', 1),
        ('F5 code+seq response lost once', is_codeseq, 'drop_resp', 1),
        ('F6 parameter response lost once', is_params, 'drop_resp', 1),
        ('F7 REQ request lost twice (both attempts)', is_req, 'drop_req', 2),
    ]
    res = {'device': DEV, 'n_rep': n_rep, 'client_timeout_s': 0.5, 'cases': []}
    jid = 700000
    for name, match, action, count in cases:
        rows = dict(case=name, commands=0, starts=0, exactly_once=0, errors=0, wrong_params=0, recovered_after_error=0)
        for rep in range(n_rep):
            link = make_link(pinfo)
            STARTS.clear()
            proxy.plan = [] if match is None else [{'match': match, 'action': action, 'left': count}]
            jid += 1
            rows['commands'] += 1
            ok = True
            try:
                link.command(10, PARAMS, job_id=jid)
                link.wait_done(jid, timeout=10, poll=0.002)
            except Exception:
                ok = False
                rows['errors'] += 1
            time.sleep(0.05)
            st = STARTS.get(DEV, [])
            rows['starts'] += len(st)
            rows['exactly_once'] += int(len(st) == 1)
            rows['wrong_params'] += sum(1 for j, _ in st if j != jid)
            if not ok:                       # controller logic: no ACK + device idle + idDone != id -> re-plan
                busy = link.read('hs.status') & 2
                if not busy and link.read('job.idDone') != jid and not st:
                    proxy.plan = []
                    jid += 1
                    link.command(10, PARAMS, job_id=jid)
                    link.wait_done(jid, timeout=10, poll=0.002)
                    rows['recovered_after_error'] += int(len(STARTS.get(DEV, [])) == 1)
            link.cli.close()
        res['cases'].append(rows)
        print(json.dumps(rows), flush=True)
    # F8 stale REQ replay after the next command (cross-connection delayed duplicate)
    for guard in (False, True):
        GUARD['on'], GUARD['ignored'] = guard, 0
        rows = dict(case='F8 stale REQ frame replayed after the next command', seq_guard=guard, commands=0, starts=0,
                    double_starts=0, next_command_ok=0)
        for rep in range(n_rep):
            link = make_link(pinfo)
            proxy.captured.clear()
            proxy.plan = [{'match': is_req, 'action': 'pass', 'left': 1, 'capture': True}]
            STARTS.clear()
            jid += 1
            link.command(10, PARAMS, job_id=jid); link.wait_done(jid, timeout=10, poll=0.002)      # command k
            stale = proxy.captured[0]
            jid += 1
            link.command(10, PARAMS, job_id=jid); link.wait_done(jid, timeout=10, poll=0.002)      # command k+1
            rows['commands'] += 2
            s = socket.create_connection(('127.0.0.1', info['port']))                            # late old frame
            s.sendall(stale); Proxy._frame(s); s.close()
            time.sleep(0.3)
            st = STARTS.get(DEV, [])
            rows['starts'] += len(st)
            rows['double_starts'] += sum(1 for j, _ in st) - len(set(j for j, _ in st))
            try:                                                                                 # does the link recover?
                jid += 1
                link.command(10, PARAMS, job_id=jid); link.wait_done(jid, timeout=10, poll=0.002)
                rows['next_command_ok'] += 1
            except Exception:
                pass
            link.cli.close()
            time.sleep(0.05)
        rows['stale_toggles_ignored'] = GUARD['ignored']
        res['cases'].append(rows)
        print(json.dumps(rows), flush=True)
    GUARD['on'] = False
    proxy.srv.close()
    for d in devs.values():
        d.server.stop()
    json.dump(res, open(os.path.join(HERE, '..', 'data', 'handshake_faults.json'), 'w'), indent=1)


if __name__ == '__main__':
    {'lat': latency, 'fault': fault}[sys.argv[1]](*[int(x) for x in sys.argv[2:]])
