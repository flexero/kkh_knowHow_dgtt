#!/usr/bin/env python3
"""Network calculators for the FMS communication design (item 6).

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item6_examples.json. The first four
(PROFINET load, EtherCAT cycle, Modbus TCP polling, historian volume) are the calculators of the web page
(web/fmse6.js CALC pn / ec / mb / hi) with the same verdict texts; the others are added for the guide
(docs/FMS system design/66_communication.md).

  pn       frame = max(64, io + 10 + 22) ; wire = frame + 20 ; bps = dev*wire*8/(cyc_ms/1000) ;
           load = bps/(spd*1e6) ; OK if load < 0.5
  ec       bytes = max(84, 14+2+12 + dev*bytes_per_slave + 4+20) ; t_wire = bytes*8/spd [us] ;
           t = t_wire + dev*fwd ; cycle_min = 1.25*t ; < 250 us motion, < 1000 us 1 ms possible, else split
  mb       req = ceil(regs/125) ; tr = rtt + resp ; cycle = ceil(dev/max(1,conn))*req*tr [ms] ;
           updates/s = 1000/cycle ; request 12 B, response 9 + 2*min(regs,125) B ; <= 100 ms / <= 500 ms
  hi       vps = tags*rate ; kbit/s = vps*bytes*8/1000 ; GB/day = vps*bytes*86400*comp/1e9 ; total < 500 GB fits
  latency  t_tx = wire_bytes*8/R ; base = (hops+1)*t_tx + hops*t_sw + length*5 ns/m ;
           worst = base + hops*max_wire_bytes*8/R (one maximum frame already on each egress port)
  iolink   bits = 11*((2+pd_out) + (od+pd_in+1)) + 10 ; t_msg = bits/baud ; cycle = max(t_msg, device_min_cycle)
  opcua    notif/s = items/(sampling/1000)*change ; msgs/s = subs/(publishing/1000) ;
           B/s = notif/s*bytes_per_notif + msgs/s*overhead ; kbit/s = B/s*8/1000
  mqtt     msg = 2 + (len(topic)+2) + metrics*bytes_per_metric + header ; in = edges*rate msgs/s ;
           out = in B/s * subscribers ; kbit/s = (in + out)*8/1000
  fibre    loss = km*att + conn*conn_db + splices*splice_db ; budget = tx_min - rx_sens ; margin >= 3 dB OK

Usage:
  python tools/fmse/net_calc.py                    (all JSON cases = --example)
  python tools/fmse/net_calc.py --json             (machine-readable)
  python tools/fmse/net_calc.py pn --dev 30 --io 32 --cyc 2 --spd 100
  python tools/fmse/net_calc.py mb --dev 20 --regs 60 --resp 8 --rtt 1 --conn 4
  python tools/fmse/net_calc.py latency --hops 10 --wire 84 --R 100 --tsw 3 --length 200 --maxwire 1538
  python tools/fmse/net_calc.py --selftest
"""

import argparse
import json
import math
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, fmt_web, load_examples, read_js_const, run_main

HERE = Path(__file__).resolve().parent
ITEM6_EXAMPLES = HERE / "examples" / "item6_examples.json"
WEB_DATA = HERE.parent.parent / "web" / "fmse6_data.js"

V_PN = ("OK – below 50 % (guideline for cyclic real-time traffic)",
        "Too high – longer update time, fewer devices per port, 1 Gbit/s backbone, or split into lines")
V_EC = ("Fast enough for motion at 250 µs", "1 ms cycle possible",
        "Use several frames / segments or a longer cycle")
V_MB = ("Good for states and handshakes (≤ 100 ms)",
        "OK for monitoring, slow for handshakes – more parallel connections",
        "Too slow – poll in parallel, read only changed blocks, or use a faster protocol for handshakes")
V_HI = ("Fits a normal server disk (plan × 2 for back-up)",
        "Large – lower rates for slow signals, deadband, aggregate old data")


# ----------------------------------------------------------------------------- calculators (web CALC)
def pn_load(dev, io, cyc, spd):
    frame = max(64, io + 10 + 22)
    wire = frame + 20
    bps = dev * wire * 8 / (cyc / 1000)
    load = bps / (spd * 1e6)
    return {"frame": frame, "wire": wire, "bps": bps, "Mbit_s": bps / 1e6, "load_pct": load * 100,
            "ok": load < 0.5, "verdict": V_PN[0] if load < 0.5 else V_PN[1]}


def ec_cycle(dev, bytes, spd, fwd):          # noqa: A002 - same key as the web
    b = max(84, 14 + 2 + 12 + dev * bytes + 4 + 20)
    tw = b * 8 / spd
    tf = dev * fwd
    t = tw + tf
    cmin = t * 1.25
    v = V_EC[0] if cmin < 250 else V_EC[1] if cmin < 1000 else V_EC[2]
    return {"bytes": b, "t_wire_us": tw, "t_fwd_us": tf, "t_us": t, "cycle_min_us": cmin, "verdict": v}


def mb_poll(dev, regs, resp, rtt, conn):
    req = math.ceil(regs / 125)
    tr = rtt + resp
    cyc = math.ceil(dev / max(1, conn)) * req * tr
    rq, rs = 12, 9 + 2 * min(regs, 125)
    v = V_MB[0] if cyc <= 100 else V_MB[1] if cyc <= 500 else V_MB[2]
    return {"req": req, "tr_ms": tr, "cycle_ms": cyc, "updates_s": 1000 / cyc, "request_bytes": rq,
            "response_bytes": rs, "verdict": v}


def hist_volume(tags, rate, bytes, days, comp):    # noqa: A002
    vps = tags * rate
    net = vps * bytes * 8 / 1000
    day = vps * bytes * 86400 * comp / 1e9
    tot = day * days
    return {"vps": vps, "net_kbit_s": net, "GB_day": day, "GB_total": tot,
            "verdict": V_HI[0] if tot < 500 else V_HI[1]}


# ----------------------------------------------------------------------------- added calculators
def latency(wire_bytes, R_Mbit, hops, t_sw_us, length_m, max_wire_bytes):
    R = R_Mbit * 1e6
    t_tx = wire_bytes * 8 / R
    base = (hops + 1) * t_tx + hops * t_sw_us * 1e-6 + length_m * 5e-9
    queue = hops * max_wire_bytes * 8 / R
    return {"t_tx_us": t_tx * 1e6, "tx_total_us": (hops + 1) * t_tx * 1e6, "switch_us": hops * t_sw_us,
            "cable_us": length_m * 5e-3, "base_us": base * 1e6, "queue_us": queue * 1e6,
            "worst_us": (base + queue) * 1e6}


def iolink(pd_in, pd_out, od, device_min_cycle_ms, rates):
    mb, db = 2 + pd_out, od + pd_in + 1
    bits = 11 * (mb + db) + 10
    out = []
    for name, baud in rates:
        t = bits / baud * 1000
        out.append({"com": name, "baud": baud, "t_msg_ms": t, "cycle_ms": max(t, device_min_cycle_ms),
                    "limited_by": "device" if device_min_cycle_ms >= t else "line"})
    return {"master_bytes": mb, "device_bytes": db, "bits": bits, "rates": out}


def opcua_load(items, sampling_ms, change_ratio, bytes_per_notification, subscriptions, publishing_ms,
               overhead_per_message):
    n = items / (sampling_ms / 1000) * change_ratio
    m = subscriptions / (publishing_ms / 1000)
    bps = n * bytes_per_notification + m * overhead_per_message
    return {"notif_s": n, "msgs_s": m, "bytes_s": bps, "kbit_s": bps * 8 / 1000}


def mqtt_load(edges, rate, topic, metrics_per_msg, bytes_per_metric, sparkplug_header, subscribers):
    msg = 2 + (len(topic) + 2) + metrics_per_msg * bytes_per_metric + sparkplug_header
    ins = edges * rate
    inb = ins * msg
    outb = inb * subscribers
    return {"topic_len": len(topic), "msg_bytes": msg, "in_msgs_s": ins, "in_Bps": inb, "out_Bps": outb,
            "kbit_s": (inb + outb) * 8 / 1000}


def fibre(length_km, att_db_km, connectors, conn_db, splices, splice_db, tx_min_dbm, rx_sens_dbm):
    loss = length_km * att_db_km + connectors * conn_db + splices * splice_db
    budget = tx_min_dbm - rx_sens_dbm
    margin = budget - loss
    return {"loss_db": loss, "budget_db": budget, "margin_db": margin, "ok": margin >= 3,
            "verdict": "OK (margin >= 3 dB)" if margin >= 3 else "NOT OK - margin < 3 dB (shorter link, fewer "
                                                                   "connectors, single-mode / better optics)"}


def _strip(d):
    return {k: v for k, v in d.items() if not k.startswith("_")}


def run_all(D):
    """All JSON cases -> dict of results."""
    n = D
    return {
        "pn": [dict(case=c.get("_case", ""), **pn_load(**_strip(c))) for c in n["pn"]],
        "ec": [dict(case=c.get("_case", ""), **ec_cycle(**_strip(c))) for c in n["ec"]],
        "mb": [dict(case=c.get("_case", ""), **mb_poll(**_strip(c))) for c in n["mb"]],
        "hi": [dict(case=c.get("_case", ""), **hist_volume(**_strip(c))) for c in n["hi"]],
        "latency": latency(**_strip(n["latency"])),
        "iolink": iolink(**_strip(n["iolink"])),
        "opcua": opcua_load(**_strip(n["opcua"])),
        "mqtt": mqtt_load(**_strip(n["mqtt"])),
        "fibre": fibre(**_strip(n["fibre"])),
    }


# ----------------------------------------------------------------------------- output
def f(x, d=1):
    return fmt_web(x, d)


def show_pn(c, r):
    print(f"PROFINET LOAD  dev {c['dev']}, io {c['io']} B, cycle {c['cyc']} ms, {c['spd']} Mbit/s   {c.get('_case', '')}")
    print(fmt_table(["quantity", "value"], [
        ["Frame = max(64, data + 10 PN header + 22 Ethernet / VLAN / FCS)", f"{f(r['frame'], 0)} bytes"],
        ["On the wire (+ 8 preamble + 12 gap)", f"{f(r['wire'], 0)} bytes"],
        ["Bandwidth per direction = devices × wire × 8 ÷ cycle", f"{f(r['Mbit_s'], 2)} Mbit/s"],
        ["Cyclic load on the controller port", f"{f(r['load_pct'], 1)} %"],
        ["Verdict", r["verdict"]]], "ll"))


def show_ec(c, r):
    print(f"ETHERCAT CYCLE  {c['dev']} slaves × {c['bytes']} B, {c['spd']} Mbit/s, {c['fwd']} µs/slave   {c.get('_case', '')}")
    print(fmt_table(["quantity", "value"], [
        ["Frame = Ethernet + EtherCAT header + datagram + data", f"{f(r['bytes'], 0)} bytes"],
        ["Time on the wire = bytes × 8 ÷ speed", f"{f(r['t_wire_us'], 1)} µs"],
        ["+ forwarding delay of all slaves", f"{f(r['t_fwd_us'], 1)} µs"],
        ["Frame round trip", f"{f(r['t_us'], 1)} µs"],
        ["Shortest cycle (+ 25 % master margin)", f"{f(r['cycle_min_us'], 0)} µs"],
        ["Verdict", r["verdict"]]], "ll"))


def show_mb(c, r):
    print(f"MODBUS TCP POLLING  {c['dev']} devices × {c['regs']} regs, resp {c['resp']} ms, RTT {c['rtt']} ms, "
          f"{c['conn']} connections   {c.get('_case', '')}")
    print(fmt_table(["quantity", "value"], [
        ["Requests per device = ⌈registers ÷ 125⌉ (FC03 limit)", f(r["req"], 0)],
        ["Time per transaction = RTT + device response", f"{f(r['tr_ms'], 1)} ms"],
        ["Poll cycle = ⌈devices ÷ connections⌉ × requests × transaction", f"{f(r['cycle_ms'], 0)} ms"],
        ["Updates per second per device", f"{f(r['updates_s'], 1)} /s"],
        ["Request / response size (TCP payload)", f"{r['request_bytes']} bytes / {r['response_bytes']} bytes"],
        ["Verdict", r["verdict"]]], "ll"))


def show_hi(c, r):
    print(f"HISTORIAN VOLUME  {c['tags']} tags × {c['rate']}/s × {c['bytes']} B, {c['days']} days, "
          f"comp {c['comp']}   {c.get('_case', '')}")
    print(fmt_table(["quantity", "value"], [
        ["Values per second = tags × rate", f"{f(r['vps'], 0)} /s"],
        ["Network (before compression)", f"{f(r['net_kbit_s'], 0)} kbit/s"],
        ["Storage per day", f"{f(r['GB_day'], 2)} GB"],
        ["Storage for the whole period", f"{f(r['GB_total'], 0)} GB"],
        ["Verdict", r["verdict"]]], "ll"))


def show_latency(c, r):
    print(f"LATENCY  {c['hops']} switch hops, {c['wire_bytes']} B on the wire, {c['R_Mbit']} Mbit/s, "
          f"{c['t_sw_us']} µs/switch, {c['length_m']} m, max frame {c['max_wire_bytes']} B")
    print(fmt_table(["quantity", "value µs"], [
        ["t_tx = wire bytes × 8 ÷ R (one frame)", f"{r['t_tx_us']:.2f}"],
        ["(hops + 1) × t_tx (store and forward)", f"{r['tx_total_us']:.2f}"],
        ["hops × t_sw", f"{r['switch_us']:.2f}"],
        ["cable 5 ns/m", f"{r['cable_us']:.2f}"],
        ["BASE latency", f"{r['base_us']:.2f}"],
        ["+ hops × one max frame ahead (queue)", f"{r['queue_us']:.2f}"],
        ["WORST CASE latency", f"{r['worst_us']:.2f}"]]))


def show_iolink(c, r):
    print(f"IO-LINK  PD in {c['pd_in']} B, PD out {c['pd_out']} B, OD {c['od']} B, device min cycle "
          f"{c['device_min_cycle_ms']} ms -> master {r['master_bytes']} B + device {r['device_bytes']} B, "
          f"{r['bits']} bits")
    print(fmt_table(["COM", "bit/s", "t_msg ms", "cycle ms", "limited by"],
                    [[x["com"], x["baud"], f"{x['t_msg_ms']:.3f}", f"{x['cycle_ms']:.3f}", x["limited_by"]]
                     for x in r["rates"]], "lrrrl"))


def show_opcua(c, r):
    print(f"OPC UA LOAD  {c['items']} items @ {c['sampling_ms']} ms, change {c['change_ratio']}, "
          f"{c['subscriptions']} subscriptions @ {c['publishing_ms']} ms")
    print(fmt_table(["quantity", "value"], [
        ["notifications/s = items/(sampling s) × change ratio", f"{r['notif_s']:.1f}"],
        ["publish messages/s = subscriptions/(publishing s)", f"{r['msgs_s']:.1f}"],
        ["bytes/s", f"{r['bytes_s']:.1f}"],
        ["kbit/s", f"{r['kbit_s']:.1f}"]]))


def show_mqtt(c, r):
    print(f"MQTT SPARKPLUG LOAD  {c['edges']} edges × {c['rate']}/s, topic '{c['topic']}' ({r['topic_len']} chars), "
          f"{c['metrics_per_msg']} metrics × {c['bytes_per_metric']} B, {c['subscribers']} subscribers")
    print(fmt_table(["quantity", "value"], [
        ["message bytes = 2 + (topic + 2) + metrics + header", r["msg_bytes"]],
        ["messages in /s", f"{r['in_msgs_s']:.1f}"],
        ["broker in B/s", f"{r['in_Bps']:.1f}"],
        ["broker out B/s (× subscribers)", f"{r['out_Bps']:.1f}"],
        ["total kbit/s", f"{r['kbit_s']:.2f}"]]))


def show_fibre(c, r):
    print(f"FIBRE BUDGET  {c['length_km']} km × {c['att_db_km']} dB/km, {c['connectors']} connectors × "
          f"{c['conn_db']} dB, {c['splices']} splices × {c['splice_db']} dB")
    print(fmt_table(["quantity", "dB"], [
        ["link loss", f"{r['loss_db']:.2f}"], ["power budget tx_min - rx_sens", f"{r['budget_db']:.2f}"],
        ["margin", f"{r['margin_db']:.2f}"], ["verdict", r["verdict"]]], "ll"))


def show_all(D, R):
    for c, r in zip(D["pn"], R["pn"]):
        show_pn(c, r); print()
    for c, r in zip(D["ec"], R["ec"]):
        show_ec(c, r); print()
    for c, r in zip(D["mb"], R["mb"]):
        show_mb(c, r); print()
    for c, r in zip(D["hi"], R["hi"]):
        show_hi(c, r); print()
    show_latency(D["latency"], R["latency"]); print()
    show_iolink(D["iolink"], R["iolink"]); print()
    show_opcua(D["opcua"], R["opcua"]); print()
    show_mqtt(D["mqtt"], R["mqtt"]); print()
    show_fibre(D["fibre"], R["fibre"])


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("net_calc")
    _, D = load_examples(path, "net_calc")
    R = run_all(D)
    p1, p2 = R["pn"]
    t.equal("pn web: frame max(64, 32+32) = 64", p1["frame"], 64)
    t.equal("pn web: wire 84", p1["wire"], 84)
    t.close("pn web: 30*84*8/0.002 = 10.08 Mbit/s", p1["Mbit_s"], 10.08, 1e-9)
    t.close("pn web: load 10.08 %", p1["load_pct"], 10.08, 1e-9)
    t.true("pn web: verdict OK", p1["ok"] and p1["verdict"].startswith("OK"))
    t.equal("pn 2: frame 250+32 = 282", p2["frame"], 282)
    t.close("pn 2: 60*302*8/0.001 = 144.96 Mbit/s", p2["Mbit_s"], 144.96, 1e-9)
    t.close("pn 2: load 144.96 %", p2["load_pct"], 144.96, 1e-9)
    t.true("pn 2: too high", not p2["ok"] and p2["verdict"].startswith("Too high"))
    e1, e2 = R["ec"]
    t.equal("ec web: bytes 28 + 640 + 24 = 692", e1["bytes"], 692)
    t.close("ec web: t_wire 692*8/100 = 55.36 us", e1["t_wire_us"], 55.36, 1e-9)
    t.close("ec web: round trip 55.36 + 24 = 79.36 us", e1["t_us"], 79.36, 1e-9)
    t.close("ec web: cycle_min 99.2 us", e1["cycle_min_us"], 99.2, 1e-9)
    t.equal("ec web: verdict motion at 250 us", e1["verdict"], V_EC[0])
    t.equal("ec 2: bytes 852", e2["bytes"], 852)
    t.close("ec 2: round trip 68.16 + 60 = 128.16 us", e2["t_us"], 128.16, 1e-9)
    t.close("ec 2: cycle_min 160.2 us", e2["cycle_min_us"], 160.2, 1e-9)
    m1, m2, m3 = R["mb"]
    t.equal("mb web: 1 request, cycle 5*1*9 = 45 ms", (m1["req"], m1["cycle_ms"]), (1, 45))
    t.close("mb web: 22.2 updates/s", m1["updates_s"], 1000 / 45, 1e-12)
    t.equal("mb web: request 12 B / response 129 B", (m1["request_bytes"], m1["response_bytes"]), (12, 129))
    t.equal("mb web: verdict good (<= 100 ms)", m1["verdict"], V_MB[0])
    t.equal("mb 1 connection: cycle 180 ms, monitoring", (m2["cycle_ms"], m2["verdict"]), (180, V_MB[1]))
    t.equal("mb 200 regs: 2 requests, cycle 3*2*9 = 54 ms", (m3["req"], m3["cycle_ms"]), (2, 54))
    t.equal("mb 200 regs: response 9 + 250 = 259 B", m3["response_bytes"], 259)
    h1, h2 = R["hi"]
    t.close("hi web: 384 kbit/s", h1["net_kbit_s"], 384, 1e-9)
    t.close("hi web: 1.24416 GB/day", h1["GB_day"], 1.24416, 1e-12)
    t.close("hi web: 908.2368 GB total", h1["GB_total"], 908.2368, 1e-9)
    t.equal("hi web: verdict large (>= 500 GB)", h1["verdict"], V_HI[1])
    t.close("hi 2: 41.472 GB/day, 30274.56 GB", h2["GB_total"], 30274.56, 1e-6)
    t.equal("hi: 400 GB total -> fits", hist_volume(1000, 1, 10, 400, 1.0 / 0.864)["verdict"], V_HI[0])
    L = R["latency"]
    t.close("latency: t_tx 84*8/100 Mbit = 6.72 us", L["t_tx_us"], 6.72, 1e-9)
    t.close("latency: base 73.92 + 30 + 1 = 104.92 us", L["base_us"], 104.92, 1e-9)
    t.close("latency: queue 10*1538*8/100 = 1230.4 us", L["queue_us"], 1230.4, 1e-9)
    t.close("latency: worst 1335.32 us", L["worst_us"], 1335.32, 1e-9)
    I = R["iolink"]
    t.equal("iolink: 2 + 4 bytes, 11*6+10 = 76 bits", (I["master_bytes"], I["device_bytes"], I["bits"]), (2, 4, 76))
    t.close("iolink COM1: 76/4800 = 15.833 ms", I["rates"][0]["cycle_ms"], 76 / 4800 * 1000, 1e-12)
    t.close("iolink COM2: 1.979 ms", I["rates"][1]["cycle_ms"], 76 / 38400 * 1000, 1e-12)
    t.close("iolink COM3: t_msg 0.330 ms -> cycle = device min 1.0 ms", I["rates"][2]["cycle_ms"], 1.0, 1e-12)
    t.equal("iolink COM3 limited by the device", I["rates"][2]["limited_by"], "device")
    O = R["opcua"]
    t.close("opcua: 600/0.25*0.2 = 480 notifications/s", O["notif_s"], 480, 1e-9)
    t.close("opcua: 15/0.5 = 30 messages/s", O["msgs_s"], 30, 1e-9)
    t.close("opcua: 14400 + 4500 = 18900 B/s", O["bytes_s"], 18900, 1e-9)
    t.close("opcua: 151.2 kbit/s", O["kbit_s"], 151.2, 1e-9)
    Q = R["mqtt"]
    t.equal("mqtt: topic 27 chars, msg 2 + 29 + 600 + 10 = 641 B", (Q["topic_len"], Q["msg_bytes"]), (27, 641))
    t.close("mqtt: in 12820 B/s, out 38460 B/s", Q["out_Bps"], 38460, 1e-9)
    t.close("mqtt: 410.24 kbit/s", Q["kbit_s"], 410.24, 1e-9)
    F = R["fibre"]
    t.close("fibre: loss 1.05 + 3.0 + 0.2 = 4.25 dB", F["loss_db"], 4.25, 1e-9)
    t.close("fibre: budget 7.5 dB", F["budget_db"], 7.5, 1e-9)
    t.close("fibre: margin 3.25 dB", F["margin_db"], 3.25, 1e-9)
    t.true("fibre: OK (>= 3 dB)", F["ok"])
    t.true("fibre: 6 connectors -> margin 1.75 dB not OK",
           not fibre(0.3, 3.5, 6, 0.75, 2, 0.1, -9.5, -17.0)["ok"])
    if WEB_DATA.is_file():
        for key, const in (("pn", "PN0"), ("ec", "EC0"), ("mb", "MB0"), ("hi", "HI0")):
            t.equal(f"JSON {key} case 1 = web default {const}", _strip(D[key][0]), read_js_const(WEB_DATA, const))
    else:
        print(f"  NOTE  {WEB_DATA} not found - web comparison skipped")
    web_js = HERE.parent.parent / "web" / "fmse6.js"
    if web_js.is_file():
        js = web_js.read_text(encoding="utf-8")
        t.true("web verdict texts present in web/fmse6.js",
               all(v in js for v in V_PN + V_EC + V_MB + V_HI))
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM6_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run all JSON cases (also the default)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    sub = ap.add_subparsers(dest="cmd")
    s = sub.add_parser("pn", help="PROFINET load")
    for k, d in (("dev", 30), ("io", 32), ("cyc", 2), ("spd", 100)):
        s.add_argument("--" + k, type=float, default=d)
    s = sub.add_parser("ec", help="EtherCAT cycle")
    for k, d in (("dev", 40), ("bytes", 16), ("spd", 100), ("fwd", 0.6)):
        s.add_argument("--" + k, type=float, default=d)
    s = sub.add_parser("mb", help="Modbus TCP polling")
    for k, d in (("dev", 20), ("regs", 60), ("resp", 8), ("rtt", 1), ("conn", 4)):
        s.add_argument("--" + k, type=float, default=d)
    s = sub.add_parser("hi", help="historian volume")
    for k, d in (("tags", 3000), ("rate", 1), ("bytes", 16), ("days", 730), ("comp", 0.3)):
        s.add_argument("--" + k, type=float, default=d)
    s = sub.add_parser("latency", help="switch-line latency")
    for k, d in (("wire", 84), ("R", 100), ("hops", 10), ("tsw", 3), ("length", 200), ("maxwire", 1538)):
        s.add_argument("--" + k, type=float, default=d)
    s = sub.add_parser("iolink", help="IO-Link cycle per COM rate")
    for k, d in (("pd_in", 2), ("pd_out", 0), ("od", 1), ("min_cycle", 1.0)):
        s.add_argument("--" + k, type=float, default=d)
    s = sub.add_parser("opcua", help="OPC UA subscription load")
    for k, d in (("items", 600), ("sampling", 250), ("change", 0.2), ("bpn", 30), ("subs", 15),
                 ("publishing", 500), ("overhead", 150)):
        s.add_argument("--" + k, type=float, default=d)
    s = sub.add_parser("mqtt", help="MQTT Sparkplug broker load")
    for k, d in (("edges", 20), ("rate", 1), ("metrics", 50), ("bpm", 12), ("header", 10), ("subs", 3)):
        s.add_argument("--" + k, type=float, default=d)
    s.add_argument("--topic", default="spBv1.0/PLT1/DDATA/CC1/MC01")
    s = sub.add_parser("fibre", help="fibre optic power budget")
    for k, d in (("km", 0.3), ("att", 3.5), ("conn", 4), ("conn_db", 0.75), ("splices", 2), ("splice_db", 0.1),
                 ("tx", -9.5), ("rx", -17.0)):
        s.add_argument("--" + k, type=float, default=d)
    for sp in sub.choices.values():
        sp.add_argument("--json", action="store_true", default=argparse.SUPPRESS, help="machine-readable output")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    if a.cmd:
        def pos(name, x, allow0=False):
            if x < 0 or (x == 0 and not allow0):
                raise InputError(f"--{name} must be > 0")
            return x
        if a.cmd == "pn":
            c = {"dev": a.dev, "io": a.io, "cyc": pos("cyc", a.cyc), "spd": pos("spd", a.spd)}
            r = pn_load(**c); fn = show_pn
        elif a.cmd == "ec":
            c = {"dev": a.dev, "bytes": a.bytes, "spd": pos("spd", a.spd), "fwd": a.fwd}
            r = ec_cycle(**c); fn = show_ec
        elif a.cmd == "mb":
            c = {"dev": pos("dev", a.dev), "regs": pos("regs", a.regs), "resp": a.resp, "rtt": a.rtt, "conn": a.conn}
            if a.resp + a.rtt <= 0:
                raise InputError("--resp + --rtt must be > 0")
            r = mb_poll(**c); fn = show_mb
        elif a.cmd == "hi":
            c = {"tags": a.tags, "rate": a.rate, "bytes": a.bytes, "days": a.days, "comp": a.comp}
            r = hist_volume(**c); fn = show_hi
        elif a.cmd == "latency":
            c = {"wire_bytes": a.wire, "R_Mbit": pos("R", a.R), "hops": a.hops, "t_sw_us": a.tsw,
                 "length_m": a.length, "max_wire_bytes": a.maxwire}
            r = latency(**c); fn = show_latency
        elif a.cmd == "iolink":
            c = {"pd_in": a.pd_in, "pd_out": a.pd_out, "od": a.od, "device_min_cycle_ms": a.min_cycle,
                 "rates": [["COM1", 4800], ["COM2", 38400], ["COM3", 230400]]}
            r = iolink(**c); fn = show_iolink
        elif a.cmd == "opcua":
            c = {"items": a.items, "sampling_ms": pos("sampling", a.sampling), "change_ratio": a.change,
                 "bytes_per_notification": a.bpn, "subscriptions": a.subs,
                 "publishing_ms": pos("publishing", a.publishing), "overhead_per_message": a.overhead}
            r = opcua_load(**c); fn = show_opcua
        elif a.cmd == "mqtt":
            c = {"edges": a.edges, "rate": a.rate, "topic": a.topic, "metrics_per_msg": a.metrics,
                 "bytes_per_metric": a.bpm, "sparkplug_header": a.header, "subscribers": a.subs}
            r = mqtt_load(**c); fn = show_mqtt
        else:
            c = {"length_km": a.km, "att_db_km": a.att, "connectors": a.conn, "conn_db": a.conn_db,
                 "splices": a.splices, "splice_db": a.splice_db, "tx_min_dbm": a.tx, "rx_sens_dbm": a.rx}
            r = fibre(**c); fn = show_fibre
        if a.json:
            print(json.dumps({"input": c, "result": r}, indent=1, ensure_ascii=False))
        else:
            fn(c, r)
        return 0
    _, D = load_examples(a.examples, "net_calc")
    R = run_all(D)
    if a.json:
        print(json.dumps(R, indent=1, ensure_ascii=False))
    else:
        show_all(D, R)
    return 0


if __name__ == "__main__":
    run_main(main)
