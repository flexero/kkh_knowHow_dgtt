"""
Example machine gateway - shows how a REAL machine sends data to the twin.

In a real factory this script runs on a small PC / Raspberry Pi next to the
machine. It reads values from the PLC (OPC UA, Modbus, MQTT, digital inputs...)
and POSTs them to the twin. Here the readings are faked so you can test.

Steps:
  1. In config/factory.json set  "external": true  for the machine (e.g. LATHE-01)
  2. Restart the server:            python server.py
  3. Run this script:               python tools/gateway_example.py --machine LATHE-01
  The machine card shows "LIVE" and its values come from this script.

Message format (JSON, one object or a list of objects):
{
  "machine_id": "LATHE-01",
  "state": "RUNNING",                 # RUNNING/STARVED/BLOCKED/DOWN/MAINTENANCE/STOPPED
  "reason": "",                       # optional text, e.g. alarm code from the PLC
  "sensors": {"temperature_c": 51.2, "vibration_mm_s": 2.1, "power_kw": 9.4,
              "spindle_rpm": 2400, "tool_wear_pct": 37.0},
  "part_done": {"good": true, "cycle_time_s": 41.5}   # only when a part was finished
}
"""

import argparse
import json
import random
import time
import urllib.request


def read_machine(t: float, wear: float) -> dict:
    """Replace this function with real PLC reads, e.g. with the 'asyncua'
    (OPC UA) or 'pymodbus' libraries."""
    return {
        "temperature_c": round(48 + 4 * random.random() + wear * 0.1, 2),
        "vibration_mm_s": round(1.6 + wear * 0.012 + random.gauss(0, 0.08), 3),
        "power_kw": round(9 + random.gauss(0, 0.3), 2),
        "spindle_rpm": 2400 + random.randint(-8, 8),
        "tool_wear_pct": round(wear, 1),
    }


def send(url: str, payload: dict):
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default="http://localhost:8080")
    ap.add_argument("--machine", default="LATHE-01")
    ap.add_argument("--cycle", type=float, default=8.0, help="seconds per part (fast for demo)")
    args = ap.parse_args()
    url = args.server.rstrip("/") + "/api/ingest"

    wear, t0, last_part = 20.0, time.time(), time.time()
    print(f"Sending data for {args.machine} to {url}  (Ctrl+C to stop)")
    while True:
        msg = {"machine_id": args.machine, "state": "RUNNING",
               "sensors": read_machine(time.time() - t0, wear)}
        if time.time() - last_part >= args.cycle:
            last_part = time.time()
            wear = (wear + 1.5) % 100
            msg["part_done"] = {"good": random.random() > 0.03,
                                "cycle_time_s": round(args.cycle + random.gauss(0, 0.3), 1)}
        try:
            print(send(url, msg)["message"], msg["sensors"])
        except Exception as e:  # keep running if the server restarts
            print("send failed:", e)
        time.sleep(1.0)


if __name__ == "__main__":
    main()
