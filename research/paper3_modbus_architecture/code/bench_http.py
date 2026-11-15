"""Paper 3 - HTTP/JSON API benchmark with repetitions (extends thesis/code/httpbench.py; port 18800 only).

Server (separate process): stdlib ThreadingHTTPServer, HTTP/1.1 keep-alive
  GET  /api/state            JSON snapshot of N = 160 machines (same content generator as the thesis bench, seed 1)
  GET  /api/events?since=k   up to 100 events newer than sequence number k (historian / MES catch-up)
  POST /api/event            one MES booking (JSON), 204
Clients: k threads (k = 1, 4, 16) in the benchmark process, http.client keep-alive, 10 s per configuration,
5 repetitions in rotating order. Reported: throughput and latency percentiles; mean and 95 % CI over repetitions.

    python bench_http.py   -> ../data/http_bench_rep.json
"""
import http.client
import json
import os
import platform
import random
import statistics
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from multiprocessing import Process, Queue

PORT = 18800
HERE = os.path.dirname(os.path.abspath(__file__))
T975 = {2: 12.706, 3: 4.303, 4: 3.182, 5: 2.776, 6: 2.571, 8: 2.365, 10: 2.262}


def server_proc(n, q):
    rng = random.Random(1)
    machines = [{'id': f'M{i:03d}', 'state': rng.choice(['processing', 'idle', 'blocked', 'down']),
                 'changes': rng.randint(0, 9999), 'last_change_ms': rng.randint(0, 2 ** 31), 'good': rng.randint(0, 99999),
                 'scrap': rng.randint(0, 999), 'cycle_s': round(rng.uniform(60, 400), 1), 'availability': 0.97,
                 'performance': 0.91, 'quality': 0.99, 'oee': 0.875, 'heartbeat': rng.randint(0, 65535)} for i in range(n)]
    events = [{'seq': k, 'machine': f'M{rng.randrange(n):03d}', 'state': rng.randint(1, 4), 't_plc_ms': 1000 * k}
              for k in range(1, 20001)]
    lock = threading.Lock()

    class H(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def log_message(self, *a):
            pass

        def _send(self, body, code=200):
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path.startswith('/api/events'):
                k = int(self.path.split('since=')[1]) if 'since=' in self.path else 0
                with lock:
                    sel = events[k:k + 100]
                self._send(json.dumps({'events': sel, 'next': k + len(sel)}).encode())
            else:
                self._send(json.dumps({'t': time.time(), 'machines': machines}).encode())

        def do_POST(self):
            ln = int(self.headers.get('Content-Length', 0))
            ev = json.loads(self.rfile.read(ln))
            with lock:
                ev['seq'] = len(events) + 1
                events.append(ev)
            self.send_response(204)
            self.send_header('Content-Length', '0')
            self.end_headers()

    srv = ThreadingHTTPServer(('127.0.0.1', PORT), H)
    q.put({'snapshot_bytes': len(json.dumps({'t': 0, 'machines': machines})),
           'events_page_bytes': len(json.dumps({'events': events[:100], 'next': 100}))})
    srv.serve_forever()


def client(kind, dur, out, seed):
    c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=5)
    ev = json.dumps({'type': 'booking', 'order': 'WO-1001', 'station': 'HMC-01', 'qty': 1}).encode()
    rng = random.Random(seed)
    t_end = time.perf_counter() + dur
    while time.perf_counter() < t_end:
        t1 = time.perf_counter()
        if kind == 'GET_state':
            c.request('GET', '/api/state')
        elif kind == 'GET_events':
            c.request('GET', f'/api/events?since={rng.randrange(0, 19900)}')
        else:
            c.request('POST', '/api/event', body=ev, headers={'Content-Type': 'application/json'})
        r = c.getresponse()
        r.read()
        out.append(time.perf_counter() - t1)
    c.close()


def pct(v, p):
    return v[min(len(v) - 1, int(p * len(v)))]


def main(reps=5, dur=10.0):
    q = Queue()
    p = Process(target=server_proc, args=(160, q))
    p.start()
    sizes = q.get(timeout=30)
    time.sleep(0.5)
    configs = [(k, c) for k in ('GET_state', 'GET_events', 'POST_event') for c in (1, 4, 16)]
    raw = {f'{k}_c{c}': [] for k, c in configs}
    for rep in range(reps):
        order = configs[rep % len(configs):] + configs[:rep % len(configs)]
        for kind, nc in order:
            outs = [[] for _ in range(nc)]
            ths = [threading.Thread(target=client, args=(kind, dur, outs[i], 1000 * rep + i)) for i in range(nc)]
            t0 = time.perf_counter()
            for t in ths:
                t.start()
            for t in ths:
                t.join()
            el = time.perf_counter() - t0
            lat = sorted(x for o in outs for x in o)
            raw[f'{kind}_c{nc}'].append({'req_per_s': len(lat) / el, 'median_ms': 1000 * statistics.median(lat),
                                         'p99_ms': 1000 * pct(lat, 0.99), 'n': len(lat)})
            print(rep, kind, nc, raw[f'{kind}_c{nc}'][-1], flush=True)
    p.terminate()
    summ = {}
    for key, rs in raw.items():
        s = {}
        for m in ('req_per_s', 'median_ms', 'p99_ms'):
            v = [r[m] for r in rs]
            s[m] = {'mean': statistics.mean(v), 'ci95': T975[len(v)] * statistics.stdev(v) / len(v) ** 0.5 if len(v) > 1 else 0}
        summ[key] = s
    res = {'host': platform.platform(), 'python': platform.python_version(), 'reps': reps, 'dur_s': dur, 'N': 160,
           **sizes, 'summary': summ, 'raw': raw}
    json.dump(res, open(os.path.join(HERE, '..', 'data', 'http_bench_rep.json'), 'w'), indent=1)


if __name__ == '__main__':
    main(*(int(x) for x in sys.argv[1:]))
