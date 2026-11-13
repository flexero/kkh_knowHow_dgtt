"""
Example GATEWAY for the spindle assembly station ASSY-SP1 - shows how REAL devices send their values
to the live twin (like tools/gateway_example.py does for the machines).

In the real station this script runs on the station PC (or a small industrial PC) next to the devices.
It reads the devices (USB / RS-232 / Ethernet / OPC UA ...) and sends each new measurement to the twin.
Here the readings are faked, so you can test without hardware.

How it works
  1. it tells the twin that the chosen devices are now "real" (action device, proto http or mqtt)
  2. every --interval s it reads GET /api/spst to know the current step and which checks still wait
  3. for each pending check that uses one of its devices it "reads the device" and sends the value
       HTTP:  POST /api/spst/ingest  {"device": "TQ-01", "values": {"torque_nm": 125.3}, "t": 1762851000.0}
       MQTT:  topic vc/asm/ASSY-SP1/TQ-01/torque_nm   payload 125.3
     every 5 s a keep-alive: {"device": "TQ-01", "values": {}, "heartbeat": true}  (MQTT: .../TQ-01/heartbeat)
  4. run-in stand RUN-01: sends speed, temperatures, vibration every interval while the run-in runs and
     follows the speed set-point of the twin (runin.rpm_set) - closed loop
  5. on Ctrl+C it gives the devices back to the simulator (proto sim), unless --keep

Run (the twin must run first; use your own port):
  python tools/spst_gateway.py --server http://localhost:8080 --devices TQ-01,IND-01
  python tools/spst_gateway.py --devices all                       (every device except RUN-01)
  python tools/spst_gateway.py --devices RUN-01                    (run-in stand by HTTP)
  python tools/spst_gateway.py --mode mqtt --mqtt 127.0.0.1:1883 --devices TQ-01
Standard library only.
"""

import argparse
import json
import math
import os
import random
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

NMAX = 10000            # HMC motor spindle max speed, rpm (decided 2026-11-12: 10 000 rpm / 18 kW)


def http(url, payload=None, timeout=5):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"},
                                 method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


# ------------------------------------------------------------------------------------------ device reads
def read_device(dev, key, check, unit):
    """Replace the body of this function with the REAL device read. Examples (check with the supplier):
       SCN-01 scanner      USB keyboard-wedge or USB-CDC (virtual COM port): read one line = the code
       TQ-01 torque wrench  wireless receiver on USB / RS-232 or Ethernet, ASCII or vendor protocol;
                            many tool controllers also offer OPC UA or Open Protocol (check)
       IND-01 probe         USB interface box (HID / virtual COM), send "?" -> value in mm (check)
       SCL-01 scale         RS-232 / USB, SICS-like ASCII "S\r\n" -> "S S   2.291 g" (check)
       BAL-01 balancer      Ethernet: OPC UA / Modbus TCP / CSV export file (check)
       IH-01 heater         often no interface -> temperature by a separate thermocouple logger (check)
       PC-01 particle cnt.  RS-485 Modbus RTU or Ethernet (check)
       RUN-01 run-in PLC    Modbus TCP / OPC UA / MQTT from the PLC (see read_runin)
    Here: a plausible fake value inside the limits of the check."""
    g = random.gauss
    if check["kind"] == "text":
        if check.get("eq") == "sn":
            return unit["sn"]
        if check["id"] == "kit.shaft_sn":
            return unit["shaft_sn"]
        return f"{check.get('pre', 'CODE')} set {random.randint(1, 999999):06d}"
    if check["kind"] == "bool":
        return True
    lo, hi = check.get("lo"), check.get("hi")
    if lo is not None and hi is not None:
        v = (lo + hi) / 2 + g(0, (hi - lo) / 10) if hi > lo else lo
    elif hi is not None:
        v = abs(hi) * 0.4 * abs(g(1, 0.2))
    elif lo is not None:
        v = lo * 1.15 * abs(g(1, 0.03))
    else:
        v = {"standout_um": g(1.1, 1.1), "bore_um": -abs(g(2.4, 0.6)), "len_um": 2.2 + g(0, 0.3),
             "runout_um": abs(g(5, 1.8)) + 1.5, "u1_gmm": abs(g(70, 25)), "u2_gmm": abs(g(55, 20)),
             "force_kn": 18 * g(1.03, 0.025)}.get(key, 1.0)
    if check["id"] == "spacer.ds_meas":
        req = (unit.get("results", {}).get("spacer.ds_req") or {}).get("v")
        v = (req if isinstance(req, (int, float)) else 2.2) + g(0, 0.3)
    if check.get("scale"):
        v = v / check["scale"]                   # the device sends its own unit (PRS-01: bar)
    return round(v, 4)


class RunInStand:
    """Fake run-in stand (replace with the PLC read, e.g. OPC UA node ns=2;s=RunIn.T_Front)."""

    def __init__(self):
        self.rpm, self.dT, self.t_at, self.last_set = 0.0, 0.0, 0.0, 0

    def read(self, rpm_set, dt):
        if rpm_set != self.last_set:
            self.last_set, self.t_at = rpm_set, 0.0
        self.t_at += dt
        self.rpm += max(-200 * dt, min(50 * dt, rpm_set - self.rpm))
        fr = max(0.0, self.rpm / NMAX)
        ch = 6 * fr * math.exp(-(self.t_at / 60) / 10) if rpm_set else 0
        self.dT += (14 * fr ** 1.2 + ch - self.dT) * min(1, dt / 60 / 9)
        w = 20 + random.gauss(0, 0.03)
        return {"rpm": round(self.rpm), "t_front_c": round(w + self.dT, 2), "t_rear_c": round(w + 0.7 * self.dT, 2),
                "t_stator_c": round(w + 4 * fr + 22 * fr ** 1.5, 2), "t_win_c": round(w, 2),
                "t_wout_c": round(w + 5.7 * fr ** 1.5 + 0.2, 2), "vib_mm_s": round(0.12 + 0.3 * fr ** 2 + random.gauss(0, 0.015), 3),
                "flow_lpm": round(4 + random.gauss(0, 0.03), 2)}


# ------------------------------------------------------------------------------------------ main loop
def main():
    ap = argparse.ArgumentParser(description="Example gateway for the spindle station twin ASSY-SP1")
    ap.add_argument("--server", default="http://localhost:8080")
    ap.add_argument("--devices", default="TQ-01,IND-01", help="comma list or 'all' (all except RUN-01)")
    ap.add_argument("--mode", choices=["http", "mqtt"], default="http")
    ap.add_argument("--mqtt", default="127.0.0.1:1883", help="broker host:port (mode mqtt)")
    ap.add_argument("--interval", type=float, default=1.0, help="s between reads")
    ap.add_argument("--keep", action="store_true", help="do not set the devices back to sim at the end")
    ap.add_argument("--once", type=float, default=0, help="stop after N seconds (tests)")
    a = ap.parse_args()
    base = a.server.rstrip("/")
    st = http(base + "/api/spst")
    all_ids = [d["id"] for d in st["devices"]]
    devs = [d for d in all_ids if d != "RUN-01"] if a.devices == "all" else [d.strip() for d in a.devices.split(",") if d.strip()]
    for d in devs:
        if d not in all_ids:
            sys.exit(f"unknown device {d} (known: {', '.join(all_ids)})")
    mq = None
    if a.mode == "mqtt":
        from twin.spdevices import TOPIC_ROOT, MqttClient   # the same stdlib client as the twin
        host, port = a.mqtt.rsplit(":", 1)
        mq = MqttClient(host, int(port), client_id=f"spst-gateway-{random.randint(1000, 9999)}")
        mq.connect()
    # 1. claim the devices
    for d in devs:
        body = {"action": "device", "id": d, "proto": a.mode}
        if a.mode == "mqtt":
            body["addr"] = a.mqtt
        print(http(base + "/api/spst", body).get("message"))

    def send(dev, values):
        if mq:
            for k, v in values.items():
                mq.publish(f"{TOPIC_ROOT}/{dev}/{k}", v)
            return f"MQTT {dev} {values}"
        r = http(base + "/api/spst/ingest", {"device": dev, "values": values, "t": time.time()})
        return r.get("message") or r.get("error")

    stand = RunInStand()
    sent = {}               # check id -> time sent (wait for the twin to take it before sending again)
    t_start, last, hb_last = time.time(), time.time(), 0.0
    print(f"Gateway running for {', '.join(devs)} via {a.mode}  (Ctrl+C to stop)")
    try:
        while not a.once or time.time() - t_start < a.once:
            now = time.time()
            dt, last = now - last, now
            try:
                st = http(base + "/api/spst")
            except OSError as e:          # keep running if the twin restarts
                print("twin not reachable:", e)
                time.sleep(2)
                continue
            u = st.get("unit")
            if mq:
                mq.ping_if_needed()
            # 4. run-in stand: continuous values, follows the set-point of the twin (closed loop)
            ri = st.get("runin") or {}
            if "RUN-01" in devs and (ri.get("active") or (u and u.get("step") == "test")):
                rpm_set = ri.get("rpm_set", 0) if ri.get("active") else NMAX
                vals = stand.read(rpm_set, dt * float(ri.get("time_factor") or 1))
                print(send("RUN-01", vals))
            # keep-alive every 5 s so the twin shows the devices "online" between measurements
            if now - hb_last >= 5:
                hb_last = now
                if mq:
                    for d in devs:
                        mq.publish(f"{TOPIC_ROOT}/{d}/heartbeat", 1)
                else:
                    http(base + "/api/spst/ingest", [{"device": d, "values": {}, "heartbeat": True} for d in devs])
            if u and u["status"] == "in_work" and u["step_state"] in ("running", "wait_confirm"):
                step = st["steps"][u["si"]]
                done_dev = set()
                for c in step["checks"]:
                    dev = c.get("dev")
                    if dev not in devs or c.get("calc") or c.get("auto") or dev in done_dev:
                        continue
                    if dev == "RUN-01":
                        continue                  # RUN-01 values are sent continuously above
                    r = u["results"].get(c["id"], {})
                    if r.get("st", "pending") != "pending":
                        sent.pop(c["id"], None)
                        continue
                    if now - sent.get(c["id"], 0) < 3:
                        done_dev.add(dev)
                        continue
                    # 3. read the device and send ONE measurement (the twin fills the first pending check)
                    v = read_device(dev, c["key"], c, u)
                    print(send(dev, {c["key"]: v}))
                    sent[c["id"]] = now
                    done_dev.add(dev)       # one value per device per cycle (like a real operator)
            time.sleep(a.interval)
    except KeyboardInterrupt:
        pass
    finally:
        if not a.keep:
            for d in devs:
                http(base + "/api/spst", {"action": "device", "id": d, "proto": "sim"})
            print("devices given back to the simulator")
        if mq:
            mq.close()


if __name__ == "__main__":
    main()
