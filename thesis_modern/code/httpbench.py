"""HTTP side of the architecture (thesis section 5.6): latency and throughput of the twin's JSON API.

Server (separate process): stdlib ThreadingHTTPServer with
  GET  /api/state      -> JSON snapshot of N machines (state, counters, last change, OEE fields)
  POST /api/event      -> accepts one event JSON (e.g. MES booking), answers 204
Clients: k threads with keep-alive connections (http.client) for D seconds; latency per request and total rate.
Usage: python httpbench.py [N_machines]
"""
import http.client
import json
import random
import statistics
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from multiprocessing import Process, Queue

PORT = 18080


def server_proc(n, q):
    rng = random.Random(1)
    machines = [{'id': f'M{i:03d}', 'state': rng.choice(['processing', 'idle', 'blocked', 'down']),
                 'changes': rng.randint(0, 9999), 'last_change_ms': rng.randint(0, 2 ** 31), 'good': rng.randint(0, 99999),
                 'scrap': rng.randint(0, 999), 'cycle_s': round(rng.uniform(60, 400), 1), 'availability': 0.97,
                 'performance': 0.91, 'quality': 0.99, 'oee': 0.875, 'heartbeat': rng.randint(0, 65535)} for i in range(n)]
    events = []

    class H(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def log_message(self, *a):
            pass

        def do_GET(self):
            body = json.dumps({'t': time.time(), 'machines': machines}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            ln = int(self.headers.get('Content-Length', 0))
            events.append(json.loads(self.rfile.read(ln)))
            self.send_response(204)
            self.send_header('Content-Length', '0')
            self.end_headers()

    srv = ThreadingHTTPServer(('127.0.0.1', PORT), H)
    q.put(len(json.dumps({'t': 0, 'machines': machines})))
    srv.serve_forever()


def client(kind, dur, out):
    c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=5)
    ev = json.dumps({'type': 'booking', 'order': 'WO-1001', 'station': 'HMC-01', 'qty': 1}).encode()
    t_end = time.perf_counter() + dur
    while time.perf_counter() < t_end:
        t1 = time.perf_counter()
        if kind == 'GET':
            c.request('GET', '/api/state')
        else:
            c.request('POST', '/api/event', body=ev, headers={'Content-Type': 'application/json'})
        r = c.getresponse()
        r.read()
        out.append(time.perf_counter() - t1)
    c.close()


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 160
    q = Queue()
    p = Process(target=server_proc, args=(n, q))
    p.start()
    size = q.get(timeout=30)
    time.sleep(0.5)
    res = {'N': n, 'snapshot_bytes': size}
    for kind in ('GET', 'POST'):
        for k in (1, 4, 16):
            outs = [[] for _ in range(k)]
            ths = [threading.Thread(target=client, args=(kind, 10.0, outs[i])) for i in range(k)]
            t0 = time.perf_counter()
            for t in ths:
                t.start()
            for t in ths:
                t.join()
            el = time.perf_counter() - t0
            lat = sorted(x for o in outs for x in o)
            res[f'{kind}_k{k}'] = {'req_per_s': round(len(lat) / el, 1), 'median_ms': round(1000 * statistics.median(lat), 2),
                                   'p99_ms': round(1000 * lat[int(0.99 * len(lat))], 2)}
            print(kind, k, res[f'{kind}_k{k}'])
    p.terminate()
    json.dump(res, open('../data/http_bench.json', 'w'), indent=1)
    print(json.dumps(res))


if __name__ == '__main__':
    main()
