"""HTTP server of the cell controller: JSON API + operator screen (browser, offline).

    python -m fmsctl.cell.server --virtual            # with the virtual plant (virtual commissioning), port 8090
    python -m fmsctl.cell.server                      # real plant: real IP addresses of fmsctl/spec/plant.py

API  GET  /api/cell                      snapshot (devices, pallets, work orders, jobs, events)
     POST /api/wo      {"id","variant","qty","due_h"}   new work order (released)
     POST /api/release {"id"}            release a work order
     POST /api/mode    {"mode":"auto"|"manual"}
     POST /api/ack     {"device"}         acknowledge a machine alarm
     POST /api/job/resolve {"id","outcome"}  job in state unknown / noack: done | failed (after checking the machine)
     POST /api/pallet  {"id","content","variant","wo"}  manual pallet correction (manual mode only)
     GET  /tools, /api/tools             tool management screen / snapshot (magazines, requests, store, forecast)
     POST /api/tools/import   {"csv"}    presetter CSV (serial;type;length;radius)
     POST /api/tools/complete {"id","serial"}  setter mounted a measured tool for change request id
     GET  /logistics, /api/logistics     AS/RS + AGV screen / snapshot (buffer, inventory, transports, devices)
     POST /api/logistics/receive {"item","qty","boxes","lot"}  goods receipt into the raw AS/RS (RAW_CC10 / RAW_CC / RAW_CC30)
     POST /api/logistics/fg      {"serial"}              finished compressor ready at final assembly -> FG AS/RS
     POST /api/logistics/ship    {"item","n"}            shipping: n oldest finished units (e.g. FG_VC20) to the FG I/O point
     POST /api/logistics/resolve {"hu","action"}         after a crane/AGV fault: stored | at_io | removed
     POST /api/logistics/block   {"asrs","bay","level","side","blocked"}  block / release a rack location
"""
from __future__ import annotations

import argparse
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from fmsctl.cell.controller import CellController
from fmsctl.spec import plant

WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')


def make_handler(ctl):
    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def out(self, code, body, ctype='application/json'):
            b = body if isinstance(body, bytes) else json.dumps(body, default=str).encode()
            self.send_response(code)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(b)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(b)

        def do_GET(self):
            if self.path in ('/', '/cell'):
                return self.out(200, open(os.path.join(WEB, 'cell.html'), 'rb').read(), 'text/html; charset=utf-8')
            if self.path.startswith('/api/cell'):
                return self.out(200, ctl.snapshot())
            if self.path == '/tools':
                return self.out(200, open(os.path.join(WEB, 'tools.html'), 'rb').read(), 'text/html; charset=utf-8')
            if self.path.startswith('/api/tools') and ctl.tools:
                return self.out(200, ctl.tools.snapshot())
            if self.path == '/logistics':
                return self.out(200, open(os.path.join(WEB, 'logistics.html'), 'rb').read(), 'text/html; charset=utf-8')
            if self.path.startswith('/api/logistics') and ctl.logistics:
                return self.out(200, ctl.logistics.snapshot())
            self.out(404, {'error': 'not found'})

        def do_POST(self):
            try:
                n = int(self.headers.get('Content-Length', 0))
                body = json.loads(self.rfile.read(n) or b'{}')
                if self.path == '/api/wo':
                    ctl.create_wo(body['id'], int(body['variant']), int(body['qty']), time.time() + 3600 * float(body.get('due_h', 24)))
                elif self.path == '/api/release':
                    ctl.release_wo(body['id'])
                elif self.path == '/api/mode':
                    ctl.set_mode(body['mode'])
                elif self.path == '/api/ack':
                    ctl.ack_alarm(body['device'])
                elif self.path == '/api/job/resolve':
                    ctl.resolve_job(int(body['id']), body['outcome'])
                elif self.path == '/api/pallet':
                    ctl.set_pallet(int(body['id']), body['content'], int(body.get('variant', 0)), body.get('wo', ''))
                elif self.path == '/api/tools/import':
                    return self.out(200, {'ok': True, 'imported': ctl.tools.import_presetter(body['csv'])})
                elif self.path == '/api/tools/complete':
                    ctl.tools.complete(int(body['id']), body['serial'])
                elif self.path == '/api/logistics/receive':
                    return self.out(200, {'ok': True, 'hu': ctl.logistics.receive(body['item'], int(body['qty']), int(body.get('boxes', 1)))})
                elif self.path == '/api/logistics/fg':
                    ctl.logistics.finished_unit(body['serial'])
                elif self.path == '/api/logistics/ship':
                    return self.out(200, {'ok': True, 'hu': ctl.logistics.ship(body['item'], int(body['n']))})
                elif self.path == '/api/logistics/resolve':
                    ctl.logistics.resolve(body['hu'], body['action'])
                elif self.path == '/api/logistics/block':
                    ctl.logistics.block_location(body['asrs'], int(body['bay']), int(body['level']), int(body['side']), bool(body.get('blocked', True)))
                else:
                    return self.out(404, {'error': 'not found'})
                self.out(200, {'ok': True})
            except Exception as e:
                self.out(400, {'error': f'{type(e).__name__}: {e}'})
    return H


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--virtual', action='store_true', help='start the virtual plant and connect to it')
    ap.add_argument('--speed', type=float, default=20.0)
    ap.add_argument('--port', type=int, default=8090)
    ap.add_argument('--db', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'cell.db'))
    ap.add_argument('--rule', default='EDD', choices=['EDD', 'FIFO'])
    a = ap.parse_args()
    if a.virtual:
        from fmsctl.sim import virtual_plant
        virtual_plant.start(a.speed)
    ctl = CellController(plant.device_table(virtual=a.virtual), a.db, rule=a.rule, logistics=True,
                         speed=a.speed if a.virtual else 1.0)
    ctl.start()
    srv = ThreadingHTTPServer(('0.0.0.0', a.port), make_handler(ctl))
    print(f'cell controller on http://localhost:{a.port}/  ({"virtual plant x" + str(a.speed) if a.virtual else "REAL plant"})')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        ctl.stop()


if __name__ == '__main__':
    main()
