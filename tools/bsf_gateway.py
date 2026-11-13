"""
STANDALONE Modbus TCP -> HTTP GATEWAY of the ball screw + guide factory (item 4) - the same code that server.py uses
(twin/bsf_comm.py), but as its own program, like it would run on the gateway PC vc-bsf-sup-gw01 (10.60.30.10).
Standard library only, offline.

  Modbus side: client, polls all 73 machines (fast 500 ms, counters 1 s, energy 10 s - configurable) and writes the
               gateway heartbeat register 226 (map V1.1, FC06, +1 per write) every 1 s per machine = 73 writes/s;
               total 226.3 reads/s + 73 writes/s = 299.3 requests/s (defaults)
  HTTP side:   its own small HTTP server with the /api/bsf/... routes (status, machines, machine, frames, events,
               stream (SSE), command, map, map.csv, control, MES / ERP / AGV / printer demo APIs)

  python tools/bsf_modbus_sim.py --port 15020 &                         (simulator, or real machines)
  python tools/bsf_gateway.py --target 127.0.0.1:15020 --http 8091
        then: http://127.0.0.1:8091/api/bsf/status   /api/bsf/machines   /api/bsf/frames?n=10
  python tools/bsf_gateway.py --target plan            poll every machine at its planned IP 10.60.4x.y:502 (real plant)
  python tools/bsf_gateway.py --target 127.0.0.1:15020 --duration 10 --print     (test: print a summary and stop)
ALL VALUES ARE EXAMPLES.
"""

import argparse
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from twin import bsf_comm  # noqa: E402


class H(BaseHTTPRequestHandler):
    server_version = "BSF-Gateway/1.0"

    def log_message(self, *a):
        pass

    def _out(self, code, obj, ctype):
        data = (obj if isinstance(obj, str) else json.dumps(obj)).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path in ("/api/bsf/stream", "/api/bsf/v1/stream"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                for b in bsf_comm.sse_lines():
                    self.wfile.write(b.encode("utf-8"))
                    self.wfile.flush()
            except OSError:
                return
            return
        if u.path == "/":
            return self._out(200, {"gateway": bsf_comm.VERSION, "api": "/api/bsf/api"}, "application/json")
        self._out(*bsf_comm.handle("GET", u.path, parse_qs(u.query), None, self.headers))

    def do_POST(self):
        u = urlparse(self.path)
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n).decode("utf-8") or "{}") if n else {}
        except ValueError as e:
            return self._out(400, {"title": "bad JSON", "detail": str(e), "status": 400}, "application/problem+json")
        self._out(*bsf_comm.handle("POST", u.path, parse_qs(u.query), body, self.headers))


def main():
    ap = argparse.ArgumentParser(description="BSF Modbus TCP -> HTTP gateway")
    ap.add_argument("--target", default="127.0.0.1:1502", help="host:port of one Modbus TCP server (simulator / Modbus gateway) or 'plan' (IP plan)")
    ap.add_argument("--http", type=int, default=8091, help="HTTP port of the gateway API (0 = no HTTP server)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--fast-ms", type=int, default=500)
    ap.add_argument("--counters-ms", type=int, default=1000)
    ap.add_argument("--energy-ms", type=int, default=10000)
    ap.add_argument("--gwhb-ms", type=int, default=1000, help="period of the gateway heartbeat write FC06 226 (map V1.1), 200 ... 2000 ms")
    ap.add_argument("--timeout-ms", type=int, default=300)
    ap.add_argument("--retries", type=int, default=1)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--order", default="ABCD", choices=["ABCD", "CDAB"])
    ap.add_argument("--duration", type=float, default=0, help="stop after N s (tests)")
    ap.add_argument("--print", action="store_true", help="print a status line every 2 s")
    a = ap.parse_args()

    cfg = {"sim": False, "target": a.target, "fast_ms": a.fast_ms, "counters_ms": a.counters_ms, "energy_ms": a.energy_ms, "gwhb_ms": a.gwhb_ms,
           "timeout_ms": a.timeout_ms, "retries": a.retries, "workers": a.workers, "order": a.order}
    bsf_comm.start(cfg)
    httpd = None
    if a.http:
        httpd = ThreadingHTTPServer((a.host, a.http), H)
        httpd.daemon_threads = True
        import threading
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        print(f"BSF gateway: Modbus target {a.target}, HTTP API http://{a.host}:{a.http}/api/bsf/status (Ctrl+C to stop)")
    t0, last = time.time(), 0
    try:
        while not a.duration or time.time() - t0 < a.duration:
            time.sleep(0.25)
            if a.print and time.time() - last >= 2:
                last = time.time()
                s = bsf_comm.STATE["gw"].status()
                r = s["rate"]
                print(f"  online {s['online']}/{s['n']}  {r['reqPerS']} req/s ({s['totals']['reads']} reads, {s['totals']['hbWrites']} heartbeat writes 226)  "
                      f"{r['bytesPerS']:.0f} B/s  rtt {r['rttAvgMs']} ms  "
                      f"timeouts {s['totals']['timeout']}  exceptions {s['totals']['exception']}  offline {s['totals']['offline']}")
    except KeyboardInterrupt:
        pass
    if a.print and bsf_comm.STATE["gw"]:
        m = bsf_comm.STATE["gw"].machine("BS-TGR-03")
        print("  BS-TGR-03:", {k: m["values"].get(k) for k in ("hdr.mapVersion", "std.stateCode", "std.good", "std.lastCycle_s", "std.order", "grind.oilTemp_C", "std.power_kW")},
              "gateway heartbeat 226 =", m["gwHeartbeat"])
    bsf_comm.stop()
    if httpd:
        httpd.shutdown()
    print("gateway stopped")


if __name__ == "__main__":
    main()
