"""
Modbus TCP SERVER that simulates all 73 machines of the ball screw + guide factory (tab "Ball screw + guide factory",
item 4). One TCP port, the unit id selects the machine (1 = MS-SAW-01 ... 73 = QC-LAB-01, see /api/bsf/map or
docs/43_bsf_communication_modbus_http.md chapter 6). Standard library only, offline.

  python tools/bsf_modbus_sim.py                          port 1502 (real machines use 502 - needs admin rights on Linux)
  python tools/bsf_modbus_sim.py --port 15020 --source http://127.0.0.1:8085/api/bsf/snapshot
        --source: take the machine values from the live twin (the browser posts its snapshot to the server)
  python tools/bsf_modbus_sim.py --fault BS-TGR-01=offline --fault BS-TGR-02=cdab
        faults: offline (no answer), slow (answer after 0.6 s), exc04 (device failure), cdab (REAL words swapped)

Then poll it, e.g. with the gateway:  python tools/bsf_gateway.py --target 127.0.0.1:1502
or with any Modbus tool (unit id 12 = BS-TGR-03? see the map): read holding registers 0 ... 11.
Function codes 01, 03, 04, 05, 06, 16. Register map V1.1: 227 registers 0 ... 226 per unit (offset 0 = 0x0101);
writes (FC06 / FC16) only to 200 ... 226 - 226 = gateway heartbeat, written by the gateway once per second; every unit
watches it like a PLC ("gateway lost" if unchanged for 5 s - shown in the 10 s status line). ALL VALUES ARE EXAMPLES.
"""

import argparse
import json
import os
import sys
import threading
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from twin.bsf_comm_modbus import PlantSim, ModbusServer  # noqa: E402
from twin.bsf_comm_map import MACHINES  # noqa: E402

SNAP = {"data": None, "t": 0.0}


def fetch_loop(url):
    while True:
        try:
            with urllib.request.urlopen(url, timeout=3) as r:
                d = json.loads(r.read())
            if d.get("data") and (d.get("age_s") or 99) < 15:
                SNAP["data"], SNAP["t"] = d["data"], time.time()
        except Exception:
            pass
        time.sleep(1.0)


def main():
    ap = argparse.ArgumentParser(description="Modbus TCP simulator of the 73 ball screw + guide factory machines")
    ap.add_argument("--host", default="127.0.0.1", help="0.0.0.0 = reachable from other PCs")
    ap.add_argument("--port", type=int, default=1502)
    ap.add_argument("--source", default="", help="URL of GET /api/bsf/snapshot of the twin server (optional)")
    ap.add_argument("--fault", action="append", default=[], help="ID=offline|slow|exc04|cdab (repeatable)")
    ap.add_argument("--duration", type=float, default=0, help="stop after N seconds (tests); 0 = run until Ctrl+C")
    a = ap.parse_args()

    if a.source:
        threading.Thread(target=fetch_loop, args=(a.source,), daemon=True).start()
    sim = PlantSim(lambda: SNAP["data"] if SNAP["data"] and time.time() - SNAP["t"] < 15 else None)
    for f in a.fault:
        mid, _, kind = f.partition("=")
        if mid in sim.by_id:
            sim.by_id[mid].fault = kind or "offline"
        else:
            print("unknown machine", mid)
    try:
        srv = ModbusServer(sim, a.host, a.port)
    except OSError as e:
        print(f"port {a.port} not free: {e}")
        sys.exit(1)
    sim.start()
    srv.start()
    print(f"BSF Modbus TCP simulator on {a.host}:{a.port} - {len(MACHINES)} machines, unit id 1 ... {len(MACHINES)} (Ctrl+C to stop)")
    print("  example: unit 15 = " + next(m["id"] for m in MACHINES if m["unit"] == 15) + ", read FC03 start 0 qty 12")
    t0, last = time.time(), 0
    try:
        while not a.duration or time.time() - t0 < a.duration:
            time.sleep(0.5)
            if time.time() - last >= 10:
                last = time.time()
                gok = sum(1 for u in sim.units.values() if u.gw_ok())
                print(f"  {time.strftime('%H:%M:%S')}  frames served {srv.frames}, source {sim.mode}, gateway heartbeat 226 alive on {gok}/{len(sim.units)} units")
    except KeyboardInterrupt:
        pass
    print(f"stopping - {srv.frames} frames served")
    srv.stop()
    sim.stop()


if __name__ == "__main__":
    main()
