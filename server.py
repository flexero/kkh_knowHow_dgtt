"""
Digital Twin server.

Run:   python server.py            then open http://localhost:8080
Options: --port 8080 --config config/factory.json

Uses only the Python standard library (no installation needed).

HTTP API
  GET  /api/state               current snapshot (JSON)
  GET  /api/stream              live snapshots (Server-Sent Events)
  GET  /api/trend?machine=ID    recent temperature / vibration / power samples
  GET  /api/config              factory configuration
  GET  /api/export.csv          history of this run as CSV (open in Excel)
  POST /api/command             {"action": "stop|start|maintenance|inject_bearing_fault|set_speed",
                                 "machine": "MILL-01", "value": 110}
                                {"action": "pause|resume|reset|time_scale", "value": 60}
                                {"action": "reset", "mode": "manual"}   empty factory, manual mode
                                {"action": "step", "value": 600}        advance 600 simulated seconds
                                {"action": "rule", "value": "FIFO|EDD|SPT|SETUP", "max_batch": 20}
  GET  /api/fms                 flexible manufacturing: models, FMS cell, tool magazines, kanban,
                                changeovers, dispatching queue
  GET  /api/comm[?since=N]      communication layers (ISA-95), protocols, end-to-end workflow steps
                                and the live message log (messages with id > N)
  POST /api/ingest              real machine data (see README, tools/gateway_example.py)
  POST /api/whatif              {"changes": {...}, "hours": 8, "replications": 3}

  MES (work orders, traceability, quality, maintenance)
  GET  /api/mes                 work orders, units, SPC, maintenance orders
  GET  /api/mes/unit?sn=VC20-000012   genealogy of one compressor
  POST /api/mes                 {"action": "create_wo", "qty": 40, "due_h": 24, "release": true, "product": "VC30"}
                                {"action": "release|hold|close", "id": "WO-0003"}
                                {"action": "mwo_start|mwo_close", "id": "MWO-0007"}
  ERP (sales, MRP, purchasing, inventory, cost)
  GET  /api/erp
  POST /api/erp                 {"action": "create_so", "customer": "...", "qty": 20, "due_h": 48, "product": "VC10"}
                                {"action": "create_po", "sku": "CC-CAST", "qty": 120}
                                {"action": "run_mrp"} | {"action": "ship", "id": "SO-0004"}
                                {"action": "settings", "settings": {"auto_demand": false}}
                                {"action": "mode", "mode": "auto|manual"}
  PLC layer (which PLC controls which station, live I/O image, handshakes PLC <-> PLC / CNC / AGV / MES / SCADA)
  GET  /api/plc                 PLCs, stations, I/O image, devices, links, message log, KPIs
  POST /api/plc                 {"action": "estop", "plc": "PLC-01", "on": true | false, "user": "Anna"}
  SCADA (tags, alarms, operator commands, audit trail, trends, shift report)
  GET  /api/scada               KPIs, mimic data, tag database, active alarms, journal, statistics, audit, report
  GET  /api/scada/trend?tags=HMC-02.Temperature,HMC-02.Vibration&hours=4   historian trend (max 4 tags)
  POST /api/scada               {"action": "ack", "id": 12 | "all", "user": "Anna"}
                                {"action": "shelve", "id": 12, "hours": 2, "reason": "..."} | {"action": "unshelve", "id": 12}
                                {"action": "comment", "id": 12, "text": "..."}
                                {"action": "machine", "machine": "HMC-02", "cmd": "start|stop|maintenance|set_speed|
                                 inject_bearing_fault", "value": 90}
                                {"action": "line", "line": "Cylinder machining", "cmd": "start|stop"}
                                {"action": "write", "tag": "HMC-02.SpeedSetpoint", "value": 90}
                                {"action": "limits", "machine": "HMC-02", "vib_h": 4.5, "vib_hh": 7.1, "temp_h": 75, "wear_h": 85}
  Order flow (one customer order from ERP to the machines and back)
  GET  /api/order?so=SO-0001    stages, route with every unit, material check, log
  POST /api/erp                 {"action": "create_so", "customer": "...", "qty": 50, "due_h": 48,
                                 "mto": true, "auto": false}
                                {"action": "plan_so", "id": "SO-0001", "release": false}
                                {"action": "buy_so", "id": "SO-0001"}
                                {"action": "receive_now", "id": "PO-0003"}   (training shortcut)
                                {"action": "so_auto", "id": "SO-0001", "auto": true}
  Spindle assembly LIVE station ASSY-SP1 (twin/spstation.py, guide docs/20_spindle_station_live_twin.md)
  GET  /api/spst                full station state (unit, steps + checks, devices, run-in, alarms, KPIs)
  GET  /api/spst/stream         the same state every 1 s (Server-Sent Events)
  GET  /api/spst/units          all spindles, newest first
  GET  /api/spst/unit?sn=SPU-2646-00001   full record: results, signatures, NCRs, events, device log
  GET  /api/spst/spc?id=nut.runout_after  SPC of one numeric check (mean, sigma, Cpk)
  GET  /api/spst/runin?sn=...[&run=1]     run-in samples (1 per 5 s process time)
  GET  /api/spst/export.csv     all results as CSV
  POST /api/spst                {"action": "login", "user": "Anna", "role": "operator|inspector|admin"} | logout
                                new_unit {wo?, shaft_sn?} | start_step | record {id, v} | confirm
                                ncr {id, decision: rework|scrap|concession, text} | hold {reason} | release
                                sim {on?, auto?, speed?, faults?} | runin {cmd: start|stop|ack} | ack {id}
                                device {id, proto: sim|http|modbus|mqtt, addr?, enabled?}
  POST /api/spst/ingest         {"device": "TQ-01", "values": {"torque_nm": 125.3}} (or a list) - gateways
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

from twin.engine import TwinEngine  # noqa: E402
from twin.spstation import SpindleStation  # noqa: E402

WEB = os.path.join(ROOT, "web")
ENGINE: TwinEngine | None = None
SPST: SpindleStation | None = None


class Handler(BaseHTTPRequestHandler):
    server_version = "DigitalTwin/1.0"

    def log_message(self, fmt, *args):  # keep the console quiet
        pass

    # ---------------------------------------------------------- helpers
    def _send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj))

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 2_000_000:
            raise ValueError("body too large")
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    # ---------------------------------------------------------- GET
    def do_GET(self):
        url = urlparse(self.path)
        p = url.path
        try:
            if p == "/api/state":
                return self._send(200, ENGINE.snapshot_json)
            if p == "/api/stream":
                return self._stream()
            if p == "/api/trend":
                mid = parse_qs(url.query).get("machine", [""])[0]
                return self._json(200, {"machine": mid, "points": ENGINE.trend(mid)})
            if p == "/api/config":
                return self._json(200, ENGINE.config_view())
            if p == "/api/mes":
                return self._json(200, ENGINE.mes_view())
            if p == "/api/mes/unit":
                sn = parse_qs(url.query).get("sn", [""])[0]
                return self._json(200, ENGINE.unit(sn))
            if p == "/api/erp":
                return self._json(200, ENGINE.erp_view())
            if p == "/api/fms":
                return self._json(200, ENGINE.fms_view())
            if p == "/api/scada":
                return self._json(200, ENGINE.scada_view())
            if p == "/api/plc":
                return self._json(200, ENGINE.plc_view())
            if p == "/api/scada/trend":
                q = parse_qs(url.query)
                tags = [t for t in q.get("tags", [""])[0].split(",") if t]
                try:
                    hours = float(q.get("hours", ["2"])[0])
                except ValueError:
                    hours = 2.0
                return self._json(200, ENGINE.scada_trend(tags, hours))
            if p == "/api/comm":
                since = parse_qs(url.query).get("since", ["0"])[0]
                return self._json(200, ENGINE.comm_view(int(since) if since.isdigit() else 0))
            if p == "/api/order":
                so = parse_qs(url.query).get("so", [""])[0]
                try:
                    return self._json(200, ENGINE.order_view(so))
                except ValueError as e:
                    return self._json(404, {"error": str(e)})
            if p.startswith("/api/spst"):
                return self._spst_get(p, parse_qs(url.query))
            if p == "/api/export.csv":
                return self._send(200, ENGINE.historian.export_csv(), "text/csv; charset=utf-8",
                                  {"Content-Disposition": "attachment; filename=twin_history.csv"})
            return self._static(p)
        except KeyError as e:
            self._json(404, {"error": f"not found: {e}"})
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def _spst_get(self, p, q):
        arg = lambda k, d="": q.get(k, [d])[0]  # noqa: E731
        if p == "/api/spst":
            return self._send(200, SPST.state_json())
        if p == "/api/spst/stream":
            return self._spst_stream()
        if p == "/api/spst/units":
            return self._json(200, SPST.units())
        if p == "/api/spst/unit":
            try:
                return self._json(200, SPST.unit_record(arg("sn")))
            except KeyError:
                return self._json(404, {"error": f"unit {arg('sn')} not found"})
        if p == "/api/spst/spc":
            try:
                return self._json(200, SPST.spc(arg("id")))
            except KeyError:
                return self._json(404, {"error": f"check {arg('id')} not found"})
            except ValueError as e:
                return self._json(400, {"error": str(e)})
        if p == "/api/spst/runin":
            run = arg("run")
            return self._json(200, SPST.runin_samples(arg("sn"), int(run) if run.isdigit() else None))
        if p == "/api/spst/export.csv":
            return self._send(200, SPST.export_csv(), "text/csv; charset=utf-8",
                              {"Content-Disposition": "attachment; filename=spst_results.csv"})
        return self._json(404, {"error": "not found"})

    def _spst_stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        try:
            while True:
                self.wfile.write(("data: " + SPST.state_json() + "\n\n").encode("utf-8"))
                self.wfile.flush()
                time.sleep(1.0)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            return

    def _static(self, p):
        if p == "/":
            p = "/index.html"
        full = os.path.normpath(os.path.join(WEB, p.lstrip("/")))
        if not full.startswith(WEB) or not os.path.isfile(full):
            return self._json(404, {"error": "not found"})
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as fh:
            self._send(200, fh.read(), ctype)

    def _stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        version = -1
        try:
            while True:
                version, snap = ENGINE.wait_snapshot(version)
                self.wfile.write(f"data: {snap}\n\n".encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            return

    # ---------------------------------------------------------- POST
    def do_POST(self):
        p = urlparse(self.path).path
        try:
            body = self._body()
            if p == "/api/command":
                return self._json(200, {"ok": True, "message": ENGINE.command(body)})
            if p == "/api/ingest":
                return self._json(200, {"ok": True, "message": ENGINE.ingest(body)})
            if p == "/api/whatif":
                return self._json(200, ENGINE.what_if(body))
            if p == "/api/mes":
                return self._json(200, {"ok": True, "message": ENGINE.mes_action(body)})
            if p == "/api/erp":
                return self._json(200, {"ok": True, "message": ENGINE.erp_action(body)})
            if p == "/api/scada":
                return self._json(200, {"ok": True, "message": ENGINE.scada_action(body)})
            if p == "/api/plc":
                return self._json(200, {"ok": True, "message": ENGINE.plc_action(body)})
            if p == "/api/spst":
                return self._json(200, {"ok": True, "message": SPST.action(body)})
            if p == "/api/spst/ingest":
                return self._json(200, {"ok": True, "message": SPST.ingest(body)})
            self._json(404, {"error": "not found"})
        except (ValueError, KeyError, TypeError) as e:
            self._json(400, {"ok": False, "error": str(e)})


class Server(ThreadingHTTPServer):
    # The browser closes connections all the time (page reload, tab closed, live stream
    # restarted). Windows reports this as WinError 10053/10054 - harmless, so stay quiet.
    def handle_error(self, request, client_address):
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionAbortedError, ConnectionResetError, BrokenPipeError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def main():
    global ENGINE, SPST
    ap = argparse.ArgumentParser(description="Smart factory digital twin")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--host", default="127.0.0.1",
                    help="use 0.0.0.0 to allow other computers on the network")
    ap.add_argument("--config", default=os.path.join(ROOT, "config", "factory.json"))
    ap.add_argument("--db", default=os.path.join(ROOT, "data", "history.db"))
    args = ap.parse_args()

    # On Windows "reuse address" lets a second server silently share the port with an
    # old one (the old one may keep answering). Refuse instead, with a clear message.
    if os.name == "nt":
        Server.allow_reuse_address = False
    try:
        httpd = Server((args.host, args.port), Handler)
    except OSError:
        print(f"Port {args.port} is already in use - is the twin already running?\n"
              f"Close the other window, or start with another port: python server.py --port {args.port + 1}")
        sys.exit(1)
    ENGINE = TwinEngine(args.config, args.db)
    ENGINE.start()
    SPST = SpindleStation(os.path.join(os.path.dirname(os.path.abspath(args.db)), "spstation.db"))
    SPST.start()
    httpd.daemon_threads = True
    print(f"Digital Twin running:  http://localhost:{args.port}   (Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("stopping...")
        ENGINE.stop()
        SPST.stop()


if __name__ == "__main__":
    main()
