"""
Ball screw + guide factory (tab "Ball screw + guide factory", item 4) - Modbus TCP REGISTER MAP, IP plan and frame codec.
Guide: docs/43_bsf_communication_modbus_http.md (chapters 5 - 7).  Standard library only.

The SAME algorithm is written in JavaScript in web/bsfcomm_map.js (the page builds its own map). The page self-check
(&bf4test) compares both maps when the server is reachable, so they cannot drift apart.

Source data = copy of web/bsfmfg_data.js (MTYPES, MACHINES) and web/bsfsim.js (SIGFIELDS). If item 2 / 3 change the
machine list, update TYPES below (count = number of instances in MACHINES).

Register map convention (contract docs/40_contract_bsf.md "Communication rule"):
  * holding registers (function code 03, "4xxxx"), 0-based offsets; the same data is also readable with FC 04
  * UINT16 = 1 register; UINT32 = 2 registers, high word first; REAL = IEEE 754 float, 2 registers, big-endian
    word order "ABCD" (register n = bytes A B, register n+1 = bytes C D); ASCII20 = 10 registers, 2 characters per
    register (first character in the high byte), padded with 0x00
  * REAL / UINT32 always start at an even offset (a reserved register fills the gap)
  * blocks: FAST 0 - 11 (poll 0.2 - 1 s), COUNTERS + PROCESS 20 - 99 (1 s), ENERGY 100 - 103 (10 s),
    COMMAND 200 - 226 (MES -> machine, read / write, toggle-bit handshake; 226 = gateway heartbeat since map V1.1)
  * addresses 0 - 226 exist (gaps read as 0 = reserved); >= 227 -> exception 02 (illegal data address)
  * map versions: V1.0 (0x0100) = 226 registers 0 - 225; V1.1 (0x0101, decided 2026-11-13) adds offset 226
    cmd.gwHeartbeat (UINT16, written by the gateway with FC06 once per second, +1 per write, wraps 65535 -> 0) so that a
    PLC without a per-request flag (Delta AS) can run its "gateway lost" watchdog (226 unchanged for 5 s)
ALL VALUES ARE EXAMPLES - check with your machine makers and your network designer.
"""

from __future__ import annotations

import struct

MAP_VERSION = 0x0101          # register 0: map version 1.1 (major byte 1, minor byte 1) - V1.0 was 0x0100
MAP_SIZE = 227                # addresses 0 ... 226 (V1.0: 226 registers 0 ... 225)
GW_HB_ADDR = 226              # V1.1: gateway heartbeat register (written by the gateway, FC06, every gwhb_ms)
MAP_HISTORY = [
    {"version": "V1.0", "value": 0x0100, "date": "2026-11-13", "size": 226, "change": "first release: blocks fast 0 - 11, counters + process 20 - 99, energy 100 - 103, command 200 - 225"},
    {"version": "V1.1", "value": 0x0101, "date": "2026-11-13", "size": 227, "change": "addition: offset 226 cmd.gwHeartbeat (UINT16, gateway writes +1 per second with FC06) for the PLC 'gateway lost' watchdog"},
]
MODBUS_PORT = 502

# ------------------------------------------------------------------ machine types (copy of MTYPES order + MACHINES counts)
# (type id, name, area, signal groups, instances)
TYPES = [
    ("MS-SAW", "Automatic bandsaw (bar)", "soft", ("std",), 1),
    ("BS-STR", "Hydraulic straightening press 100 kN (soft bars)", "soft", ("std", "press"), 1),
    ("BS-CTR", "Facing + centring machine (both ends)", "soft", ("std", "cnc"), 1),
    ("BS-TRN", "CNC lathe with tailstock + steady rest (≥ 1 200 mm between centres)", "soft", ("std", "cnc"), 2),
    ("BS-ROL", "Thread rolling machine (2-die, through-feed)", "soft", ("std", "cnc"), 0),
    ("BS-IND", "Vertical induction scanning hardening machine 60 kW / 30 kHz", "ht", ("std", "ind"), 1),
    ("HT-TMP", "Air-circulation tempering furnace (≤ 300 °C)", "ht", ("std", "furn"), 1),
    ("BS-STH", "CNC automatic straightening press 100 kN with run-out measurement", "ht", ("std", "press"), 2),
    ("BS-CLP", "Centre-hole grinder", "grind", ("std",), 1),
    ("BS-CGR", "CNC cylindrical grinder (1 000 mm between centres)", "grind", ("std", "grind"), 2),
    ("BS-WHL", "Hard whirling machine", "grind", ("std", "cnc"), 0),
    ("BS-TGR", "CNC external thread grinder (ball screws ≤ 1.5 m)", "grind", ("std", "grind", "tgr"), 8),
    ("QC-LED", "Lead measuring machine (laser) ≤ 2 m", "qc", ("std", "meas"), 3),
    ("AS-WSH", "Through-feed washer + demagnetiser + oiler", "assy", ("std", "wash"), 1),
    ("BN-TRN", "CNC turning centre, main + sub-spindle, driven tools", "soft", ("std", "cnc"), 3),
    ("BN-MC", "Vertical machining centre with 4th axis", "soft", ("std", "cnc"), 3),
    ("HT-CAR", "Sealed-quench carburising furnace line (furnace, washer, temper, loader)", "ht", ("std", "furn"), 2),
    ("BN-HTN", "Precision hard-turning lathe", "grind", ("std", "cnc"), 2),
    ("BN-ITG", "CNC internal thread grinder (ball nuts)", "grind", ("std", "grind", "tgr"), 2),
    ("AS-NAS", "Nut assembly bench (deflector press, gauge-ball fit)", "assy", ("std", "torque"), 2),
    ("LG-SAW", "Circular cold saw (rail + block profiles)", "soft", ("std",), 1),
    ("LG-STR", "Rail straightening press (soft)", "soft", ("std", "press"), 1),
    ("LG-DRL", "CNC rail drilling centre (gantry, 2 spindles)", "soft", ("std", "cnc"), 1),
    ("LG-IND", "Horizontal through-feed induction line for rails", "ht", ("std", "ind"), 1),
    ("LG-STH", "CNC rail straightening press 150 kN, 2 planes", "ht", ("std", "press"), 2),
    ("LG-SGR", "Surface grinder with magnetic chuck 2 000 × 500", "grind", ("std", "grind"), 1),
    ("LG-PGR", "Linear-guide rail profile grinder (multi-head, 4.5 m table)", "grind", ("std", "grind"), 2),
    ("LG-CUT", "Precision cut-off + end machining for rails", "grind", ("std",), 1),
    ("QC-RAL", "Rail measuring bench (hole pitch, straightness, parallelism)", "qc", ("std", "meas"), 1),
    ("LB-MC", "Horizontal machining centre with pallet changer + tombstones", "soft", ("std", "cnc"), 5),
    ("LB-SGR", "Surface grinder for blocks (magnetic chuck)", "grind", ("std", "grind"), 1),
    ("LB-RGR", "Block raceway grinder (internal form grinding, string fixture)", "grind", ("std", "grind"), 2),
    ("QC-INC", "Incoming inspection bench (bought plastic parts)", "qc", ("std",), 1),
    ("AS-BAS", "Block assembly bench (ball feeder, dummy rail)", "assy", ("std",), 3),
    ("QC-MAT", "Block preload matching station (drag force + height)", "qc", ("std", "torque"), 2),
    ("AS-BSA", "Ball screw assembly + preload torque tester", "assy", ("std", "torque"), 3),
    ("AS-RUN", "Run-in stand (servo + torque + noise)", "assy", ("std", "torque"), 2),
    ("AS-GAS", "Guide set assembly + check table", "assy", ("std", "torque"), 1),
    ("AS-MRK", "Fibre laser marker 20 W (class 1 cabin)", "assy", ("std",), 1),
    ("AS-PCK", "Packing station (oil, VCI, tubes, boxes, label printer)", "assy", ("std",), 2),
    ("QC-LAB", "Laboratory: Rockwell + Vickers testers, metallography, roundness, contour, CMM (not in the routing)", "qc", ("std",), 1),
]
TYPE_IDS = [t[0] for t in TYPES]
TYPE_BY_ID = {t[0]: {"id": t[0], "name": t[1], "area": t[2], "sig": list(t[3]), "count": t[4], "code": i + 1}
              for i, t in enumerate(TYPES)}

# ------------------------------------------------------------------ SIGFIELDS (copy of web/bsfsim.js)
SIGFIELDS = {
    "std": [["status", "UINT16", "", "bit0 run, bit1 idle, bit2 set-up, bit3 alarm, bit4 e-stop (hard-wired copy), bit5 blocked, bit6 starved, bit7 no shift"],
            ["mode", "UINT16", "", "0 manual, 1 auto, 2 set-up, 3 maintenance"], ["stateCode", "UINT16", "", "0 OFF 1 IDLE 2 RUN 3 SETUP 4 DOWN 5 BLOCKED 6 STARVED"],
            ["good", "UINT32", "pcs", "good parts counter"], ["scrap", "UINT32", "pcs", "scrap counter"], ["lastCycle_s", "REAL", "s", "last cycle time"],
            ["alarm", "UINT16", "", "alarm code (0 = none, ALARMS)"], ["order", "ASCII20", "", "lot / work order no."], ["part", "ASCII20", "", "part code"],
            ["power_kW", "REAL", "kW", "electrical power"], ["energy_kWh", "REAL", "kWh", "energy counter"]],
    "grind": [["wheelSpeed_ms", "REAL", "m/s", "wheel speed vs"], ["spindlePower_pct", "REAL", "%", "spindle power"], ["dressCount", "UINT16", "", "dressing counter"],
              ["wheelDia_mm", "REAL", "mm", "wheel Ø"], ["oilTemp_C", "REAL", "°C", "coolant / oil temperature"], ["gaugeDev_um", "REAL", "µm", "in-process gauge deviation"]],
    "tgr": [["pass", "UINT16", "", "pass no."], ["passes", "UINT16", "", "passes per part"], ["workSpeed_rpm", "REAL", "min⁻¹", "work speed"],
            ["leadComp_um_m", "REAL", "µm/m", "lead compensation"], ["screwTemp_C", "REAL", "°C", "screw temperature"], ["wheelTilt_deg", "REAL", "°", "wheel tilt (lead angle)"]],
    "ind": [["power_kW", "REAL", "kW", "generator power"], ["freq_kHz", "REAL", "kHz", "frequency"], ["scan_mm_s", "REAL", "mm/s", "scan speed"],
            ["quenchFlow_l_min", "REAL", "l/min", "quench flow"], ["quenchTemp_C", "REAL", "°C", "quench temperature"], ["polymer_pct", "REAL", "%", "polymer concentration"],
            ["energyPart_kJ", "REAL", "kJ", "energy per part"], ["energyOK", "UINT16", "", "1 pass, 2 fail"]],
    "furn": [["zone1_C", "REAL", "°C", "zone 1"], ["zone2_C", "REAL", "°C", "zone 2"], ["zone3_C", "REAL", "°C", "zone 3"], ["zone4_C", "REAL", "°C", "zone 4"],
             ["carbonPot_pct", "REAL", "%C", "carbon potential"], ["co_pct", "REAL", "%", "CO"], ["oilTemp_C", "REAL", "°C", "quench oil"],
             ["loadNo", "UINT16", "", "load no."], ["step", "UINT16", "", "program step"], ["remain_min", "REAL", "min", "remaining time"]],
    "press": [["runoutBefore_um", "REAL", "µm", "run-out before"], ["runoutAfter_um", "REAL", "µm", "run-out after"], ["force_kN", "REAL", "kN", "press force"],
              ["stroke_mm", "REAL", "mm", "stroke"], ["bends", "UINT16", "", "bend count per part"]],
    "meas": [["ep_um", "REAL", "µm", "e_p"], ["vup_um", "REAL", "µm", "v_up"], ["v300_um", "REAL", "µm", "v_300"], ["v2pi_um", "REAL", "µm", "v_2π"],
             ["grade", "UINT16", "", "3 = C3, 5 = C5, 7 = C7, 0 = reject"], ["matTemp_C", "REAL", "°C", "material temperature"]],
    "torque": [["torqueMean_Nm", "REAL", "N·m", "preload torque mean"], ["torqueVar_Nm", "REAL", "N·m", "torque variation"], ["drag_N", "REAL", "N", "drag force"],
               ["result", "UINT16", "", "1 OK, 2 NOK"], ["cls", "UINT16", "", "ball / preload class"]],
    "cnc": [["spindle_rpm", "REAL", "min⁻¹", "spindle speed"], ["spindleLoad_pct", "REAL", "%", "spindle load"], ["toolNo", "UINT16", "", "tool no."],
            ["toolLife_pct", "UINT16", "%", "tool life left"], ["feedOvr_pct", "UINT16", "%", "feed override"]],
    "wash": [["bathTemp_C", "REAL", "°C", "bath temperature"], ["conduct_uS", "REAL", "µS/cm", "conductivity"], ["belt_m_min", "REAL", "m/min", "belt speed"]],
}
NREG = {"UINT16": 1, "UINT32": 2, "REAL": 2, "ASCII20": 10}

# ------------------------------------------------------------------ network plan (proposal - guide 43 chapter 4)
# Site block 10.60.0.0/16 for the ball screw + guide plant; VLAN 6xx <-> subnet 10.60.xx.0/24 (third byte = VLAN - 600).
VLANS = [
    {"vlan": 610, "name": "BSF-DMZ", "subnet": "10.60.10.0/24", "zone": "DMZ (IT <-> OT)", "level": "3.5", "use": "ERP connector, time server, patch server, remote service"},
    {"vlan": 620, "name": "BSF-OPS", "subnet": "10.60.20.0/24", "zone": "operations (level 3)", "level": "3", "use": "MES, label print server, historian, DNS"},
    {"vlan": 630, "name": "BSF-SUP", "subnet": "10.60.30.0/24", "zone": "supervisory (level 2)", "level": "2", "use": "Modbus gateway, digital twin, AGV fleet manager, engineering station, andon screens"},
    {"vlan": 641, "name": "BSF-SOFT", "subnet": "10.60.41.0/24", "zone": "cell: soft machining", "level": "1", "use": "saws, lathes, machining centres, soft presses", "area": "soft", "code": "smc"},
    {"vlan": 642, "name": "BSF-HT", "subnet": "10.60.42.0/24", "zone": "cell: heat treatment", "level": "1", "use": "induction, furnaces, hardened straightening", "area": "ht", "code": "htr"},
    {"vlan": 643, "name": "BSF-GRIND", "subnet": "10.60.43.0/24", "zone": "cell: grinding room", "level": "1", "use": "grinders, hard turning", "area": "grind", "code": "grd"},
    {"vlan": 644, "name": "BSF-QC", "subnet": "10.60.44.0/24", "zone": "cell: metrology", "level": "1", "use": "lead measuring, rail bench, matching, laboratory", "area": "qc", "code": "qcl"},
    {"vlan": 645, "name": "BSF-ASSY", "subnet": "10.60.45.0/24", "zone": "cell: assembly + packing", "level": "1", "use": "washer, assembly benches, run-in, marker, packing", "area": "assy", "code": "asm"},
    {"vlan": 650, "name": "BSF-AGV", "subnet": "10.60.50.0/24", "zone": "AGV Wi-Fi (own SSID)", "level": "1", "use": "AGVs, chargers (the fleet manager talks HTTP to them or to its own server)"},
    {"vlan": 660, "name": "BSF-UTIL", "subnet": "10.60.60.0/24", "zone": "utilities", "level": "1", "use": "energy meters, compressors, HVAC, door I/O (all Modbus TCP)"},
]
AREA_VLAN = {v["area"]: v for v in VLANS if v.get("area")}
SERVERS = [
    {"host": "vc-bsf-dmz-erpgw01", "ip": "10.60.10.11", "vlan": 610, "role": "ERP connector (HTTP reverse proxy / API gateway between ERP and MES)"},
    {"host": "vc-bsf-dmz-ntp01", "ip": "10.60.10.10", "vlan": 610, "role": "time server (NTP - UDP 123, the one infrastructure exception)"},
    {"host": "vc-bsf-ops-mes01", "ip": "10.60.20.10", "vlan": 620, "role": "MES (HTTP REST + JSON)"},
    {"host": "vc-bsf-ops-prt01", "ip": "10.60.20.11", "vlan": 620, "role": "label print server (HTTP job API -> printers)"},
    {"host": "vc-bsf-ops-hist01", "ip": "10.60.20.12", "vlan": 620, "role": "historian (HTTP write / read)"},
    {"host": "vc-bsf-ops-dns01", "ip": "10.60.20.13", "vlan": 620, "role": "DNS (UDP/TCP 53, infrastructure)"},
    {"host": "vc-bsf-sup-gw01", "ip": "10.60.30.10", "vlan": 630, "role": "Modbus TCP gateway (client to 73 machines, HTTP server)"},
    {"host": "vc-bsf-sup-gw02", "ip": "10.60.30.9", "vlan": 630, "role": "standby gateway (hot standby, polls only when gw01 is silent)"},
    {"host": "vc-bsf-sup-twin01", "ip": "10.60.30.11", "vlan": 630, "role": "digital twin (server.py, HTTP + SSE)"},
    {"host": "vc-bsf-sup-fleet01", "ip": "10.60.30.12", "vlan": 630, "role": "AGV fleet manager (HTTP API)"},
    {"host": "vc-bsf-sup-eng01", "ip": "10.60.30.20", "vlan": 630, "role": "engineering station (PLC / CNC tools, Wireshark)"},
    {"host": "vc-bsf-sup-and01", "ip": "10.60.30.31", "vlan": 630, "role": "andon screen 1 (browser kiosk, HTTP + SSE)"},
    {"host": "erp.corp (IT)", "ip": "10.10.0.20", "vlan": 10, "role": "ERP in the company IT network (only HTTPS to the DMZ connector)"},
]


def _host_part(mid: str) -> str:
    return mid.replace("-", "").lower()


def machines():
    """73 machine instances: id, type, unit id (1 ... 73, plant-wide unique), area, VLAN, IP, host name."""
    out, unit, host_no = [], 0, {}
    for tid, name, area, sig, n in TYPES:
        for i in range(n):
            unit += 1
            v = AREA_VLAN[area]
            h = host_no.get(area, 10) + 1
            host_no[area] = h
            mid = f"{tid}-{i + 1:02d}"
            out.append({"id": mid, "type": tid, "name": name, "area": area, "unit": unit, "vlan": v["vlan"],
                        "ip": f"10.60.{v['vlan'] - 600}.{h}", "port": MODBUS_PORT,
                        "host": f"vc-bsf-{v['code']}-{_host_part(mid)}", "groups": list(sig)})
    return out


MACHINES = machines()
MACHINE_BY_ID = {m["id"]: m for m in MACHINES}
MACHINE_BY_UNIT = {m["unit"]: m for m in MACHINES}

# ------------------------------------------------------------------ register map per type
BLOCKS = {"fast": (0, 12), "counters": (20, None), "energy": (100, 4), "command": (200, 27)}
FAST_FIELDS = [  # addr, name, type, unit, rw, meaning
    (0, "hdr.mapVersion", "UINT16", "", "R", "map version 0x0101 = 1.1 (check after a machine software update; 0x0100 = V1.0 without 226)"),
    (1, "hdr.typeCode", "UINT16", "", "R", "machine type code (1 = MS-SAW ... 41 = QC-LAB, order of the type list)"),
    (2, "hdr.unitId", "UINT16", "", "R", "unit id of this machine (plausibility check: wrong cable / wrong IP)"),
    (3, "hdr.heartbeat", "UINT16", "", "R", "+1 every second, wraps 65535 -> 0; frozen = machine program stopped"),
    (4, "std.status", "UINT16", "", "R", SIGFIELDS["std"][0][3]),
    (5, "std.mode", "UINT16", "", "R", SIGFIELDS["std"][1][3]),
    (6, "std.stateCode", "UINT16", "", "R", SIGFIELDS["std"][2][3]),
    (7, "std.alarm", "UINT16", "", "R", SIGFIELDS["std"][6][3]),
    (8, "hs.status", "UINT16", "", "R", "handshake: bit0 ACK toggle (= REQ when accepted), bit1 BUSY (MES lot running), bit2 DONE toggle (lot finished), bit3 REJECT, bit4 READY for an order"),
    (9, "hs.ackSeq", "UINT16", "", "R", "sequence number of the last accepted / rejected command"),
    (10, "hs.result", "UINT16", "", "R", "0 OK, 1 unknown command, 2 not ready (not auto / alarm), 3 bad data, 4 busy"),
    (11, "hs.lotDone", "UINT16", "pcs", "R", "pieces done of the MES lot"),
]
COUNTER_STD = [(20, "good"), (22, "scrap"), (24, "lastCycle_s"), (26, "order"), (36, "part")]
PROC_START = 46
ENERGY_STD = [(100, "power_kW"), (102, "energy_kWh")]
CMD_FIELDS = [
    (200, "cmd.code", "UINT16", "", "RW", "1 load order, 2 start, 3 stop (end of cycle), 4 acknowledge alarm, 5 select recipe"),
    (201, "cmd.seq", "UINT16", "", "RW", "message counter (MES +1 per command) - the machine copies it to hs.ackSeq"),
    (202, "cmd.ctl", "UINT16", "", "RW", "bit0 REQ toggle - change it LAST; the machine answers ACK = REQ"),
    (203, "cmd.order", "ASCII20", "", "RW", "work order / lot no. for command 1"),
    (213, "cmd.part", "ASCII20", "", "RW", "part code for command 1"),
    (223, "cmd.recipe", "UINT16", "", "RW", "recipe / NC program no. for commands 1 and 5"),
    (224, "cmd.lotQty", "UINT32", "pcs", "RW", "lot quantity for command 1 (even offset)"),
    (226, "cmd.gwHeartbeat", "UINT16", "", "W", "V1.1: gateway heartbeat - the GATEWAY writes it with FC06 once per second, +1 per write, wraps 65535 -> 0; the PLC watchdog: unchanged for 5 s = gateway lost"),
]
CMD_CODES = {1: "load order", 2: "start", 3: "stop", 4: "ack alarm", 5: "recipe"}
RESULTS = {0: "OK", 1: "unknown command", 2: "not ready", 3: "bad data", 4: "busy"}
POLL_DEFAULT = {"fast_ms": 500, "counters_ms": 1000, "energy_ms": 10000, "gwhb_ms": 1000, "timeout_ms": 300, "retries": 1}


def _std(name):
    for f in SIGFIELDS["std"]:
        if f[0] == name:
            return f
    raise KeyError(name)


def type_map(tid: str):
    """Register list of one machine type: [{addr, n, name, type, unit, scale, rw, block, meaning}] sorted by address."""
    T = TYPE_BY_ID[tid]
    regs = []
    for a, name, typ, unit, rw, mean in FAST_FIELDS:
        regs.append({"addr": a, "n": NREG[typ], "name": name, "type": typ, "unit": unit, "scale": 1, "rw": rw, "block": "fast", "meaning": mean})
    for a, f in COUNTER_STD:
        s = _std(f)
        regs.append({"addr": a, "n": NREG[s[1]], "name": "std." + f, "type": s[1], "unit": s[2], "scale": 1, "rw": "R", "block": "counters", "meaning": s[3]})
    a = PROC_START
    for g in T["sig"]:
        if g == "std":
            continue
        for f, typ, unit, mean in SIGFIELDS[g]:
            if NREG[typ] == 2 and a % 2:
                a += 1                     # REAL / UINT32 start at an EVEN offset (some PLCs need it, e.g. %MF / %MD mapping)
            regs.append({"addr": a, "n": NREG[typ], "name": f"{g}.{f}", "type": typ, "unit": unit, "scale": 1, "rw": "R", "block": "counters", "meaning": mean})
            a += NREG[typ]
    for a2, f in ENERGY_STD:
        s = _std(f)
        regs.append({"addr": a2, "n": NREG[s[1]], "name": "std." + f, "type": s[1], "unit": s[2], "scale": 1, "rw": "R", "block": "energy", "meaning": s[3]})
    for a2, name, typ, unit, rw, mean in CMD_FIELDS:
        regs.append({"addr": a2, "n": NREG[typ], "name": name, "type": typ, "unit": unit, "scale": 1, "rw": rw, "block": "command", "meaning": mean})
    regs.sort(key=lambda r: r["addr"])
    return regs


def counters_len(tid: str) -> int:
    """Number of registers of the COUNTERS + PROCESS block (read in one FC03 from 20)."""
    end = max(r["addr"] + r["n"] for r in type_map(tid) if r["block"] == "counters")
    return end - BLOCKS["counters"][0]


TYPE_MAPS = {tid: type_map(tid) for tid in TYPE_IDS}


def poll_groups(tid: str):
    """[(group, start, quantity)] - one FC03 per group."""
    return [("fast", 0, 12), ("counters", 20, counters_len(tid)), ("energy", 100, 4)]


def map_json():
    return {
        "version": MAP_VERSION, "size": MAP_SIZE, "port": MODBUS_PORT, "wordOrder": "ABCD (big-endian words, high word first)",
        "addressing": "0-based offsets of holding registers (FC03 / FC06 / FC16; FC04 reads the same data). Offset 0 = '40001' in 1-based tools.",
        "blocks": {"fast": [0, 11], "counters": [20, 99], "energy": [100, 103], "command": [200, 226]},
        "versionText": f"V{MAP_VERSION >> 8}.{MAP_VERSION & 255}", "history": MAP_HISTORY,
        "gwHeartbeat": {"addr": GW_HB_ADDR, "fc": 6, "period_ms": POLL_DEFAULT["gwhb_ms"], "rule": "+1 per write, wraps 65535 -> 0; PLC: unchanged 5 s = gateway lost"},
        "poll": POLL_DEFAULT, "cmdCodes": CMD_CODES, "results": RESULTS,
        "types": [{**TYPE_BY_ID[t], "groups": poll_groups(t), "registers": TYPE_MAPS[t]} for t in TYPE_IDS],
        "machines": MACHINES, "vlans": VLANS, "servers": SERVERS,
        "note": "EXAMPLE - check with your machine makers and your network designer.",
    }


def map_csv() -> str:
    rows = ["type;addr_0based;addr_1based_4xxxx;registers;name;data_type;unit;scale;rw;block;meaning"]
    for t in TYPE_IDS:
        for r in TYPE_MAPS[t]:
            rows.append(";".join([t, str(r["addr"]), str(40001 + r["addr"]), str(r["n"]), r["name"], r["type"], r["unit"],
                                  str(r["scale"]), r["rw"], r["block"], r["meaning"].replace(";", ",")]))
    rows.append("")
    rows.append("machine;type;unit_id;vlan;ip;port;host")
    for m in MACHINES:
        rows.append(";".join([m["id"], m["type"], str(m["unit"]), str(m["vlan"]), m["ip"], str(m["port"]), m["host"]]))
    return "﻿" + "\r\n".join(rows) + "\r\n"


# ------------------------------------------------------------------ value <-> register encoding
def real_to_regs(v: float, order: str = "ABCD"):
    b = struct.pack(">f", float(v))
    hi, lo = (b[0] << 8) | b[1], (b[2] << 8) | b[3]
    return [hi, lo] if order == "ABCD" else [lo, hi]


def regs_to_real(r0: int, r1: int, order: str = "ABCD") -> float:
    if order != "ABCD":
        r0, r1 = r1, r0
    return struct.unpack(">f", bytes([(r0 >> 8) & 255, r0 & 255, (r1 >> 8) & 255, r1 & 255]))[0]


def ascii_to_regs(s: str, nreg: int = 10):
    b = (s or "").encode("ascii", "replace")[: nreg * 2].ljust(nreg * 2, b"\0")
    return [(b[2 * i] << 8) | b[2 * i + 1] for i in range(nreg)]


def regs_to_ascii(regs) -> str:
    b = bytearray()
    for r in regs:
        b += bytes([(r >> 8) & 255, r & 255])
    return b.split(b"\0", 1)[0].decode("ascii", "replace")


def encode_value(typ: str, v, order: str = "ABCD"):
    if typ == "UINT16":
        return [int(v or 0) & 0xFFFF]
    if typ == "UINT32":
        x = int(v or 0) & 0xFFFFFFFF
        return [x >> 16, x & 0xFFFF]
    if typ == "REAL":
        return real_to_regs(float(v or 0.0), order)
    if typ == "ASCII20":
        return ascii_to_regs(str(v or ""), 10)
    raise ValueError(typ)


def decode_value(typ: str, regs, order: str = "ABCD"):
    if typ == "UINT16":
        return regs[0]
    if typ == "UINT32":
        return (regs[0] << 16) | regs[1]
    if typ == "REAL":
        v = regs_to_real(regs[0], regs[1], order)
        return float(f"{v:.7g}") if v == v and abs(v) != float("inf") else str(v)   # 7 significant digits (float32); NaN / inf as text
    if typ == "ASCII20":
        return regs_to_ascii(regs)
    raise ValueError(typ)


def decode_block(tid: str, start: int, regs, order: str = "ABCD"):
    """Registers of one read (start, values) -> {name: value} for every field fully inside the read."""
    out = {}
    end = start + len(regs)
    for r in TYPE_MAPS[tid]:
        if r["addr"] >= start and r["addr"] + r["n"] <= end:
            i = r["addr"] - start
            try:
                out[r["name"]] = decode_value(r["type"], regs[i:i + r["n"]], order)
            except (struct.error, IndexError):
                out[r["name"]] = None
    return out


# ------------------------------------------------------------------ Modbus TCP frames (MBAP + PDU)
FC_NAMES = {1: "Read Coils", 2: "Read Discrete Inputs", 3: "Read Holding Registers", 4: "Read Input Registers",
            5: "Write Single Coil", 6: "Write Single Register", 15: "Write Multiple Coils", 16: "Write Multiple Registers"}
EXC_NAMES = {1: "ILLEGAL FUNCTION", 2: "ILLEGAL DATA ADDRESS", 3: "ILLEGAL DATA VALUE", 4: "SERVER DEVICE FAILURE",
             5: "ACKNOWLEDGE", 6: "SERVER DEVICE BUSY", 8: "MEMORY PARITY ERROR", 10: "GATEWAY PATH UNAVAILABLE",
             11: "GATEWAY TARGET DEVICE FAILED TO RESPOND"}


def adu(tid: int, unit: int, pdu: bytes) -> bytes:
    """MBAP header (transaction id, protocol id 0, length = unit + PDU) + PDU."""
    return struct.pack(">HHHB", tid & 0xFFFF, 0, len(pdu) + 1, unit & 0xFF) + pdu


def req_read(tid, unit, start, qty, fc=3):
    return adu(tid, unit, struct.pack(">BHH", fc, start, qty))


def req_write1(tid, unit, addr, value):
    return adu(tid, unit, struct.pack(">BHH", 6, addr, value & 0xFFFF))


def req_writen(tid, unit, start, values):
    return adu(tid, unit, struct.pack(">BHHB", 16, start, len(values), 2 * len(values)) + b"".join(struct.pack(">H", v & 0xFFFF) for v in values))


def hexs(b: bytes) -> str:
    return " ".join(f"{x:02X}" for x in b)


def parse_hex(s: str) -> bytes:
    s = s.replace("0x", "").replace(",", " ").replace(":", " ")
    s = "".join(ch for ch in s if ch in "0123456789abcdefABCDEF")
    if len(s) % 2:
        raise ValueError("odd number of hex digits")
    return bytes.fromhex(s)


def decode_frame(b: bytes, direction: str = "auto", tid_type: str | None = None, req_start: int | None = None, order: str = "ABCD"):
    """Decode one Modbus TCP ADU. direction: 'req' | 'resp' | 'auto' (guess). Returns a dict (JSON-serialisable)."""
    d = {"hex": hexs(b), "len": len(b), "ok": False}
    if len(b) < 8:
        d["error"] = "too short - an ADU has at least 7 bytes MBAP + 1 byte function code"
        return d
    t, proto, ln, unit = struct.unpack(">HHHB", b[:7])
    d["mbap"] = {"transactionId": t, "protocolId": proto, "length": ln, "unitId": unit}
    if proto != 0:
        d["error"] = "protocol id must be 0 for Modbus"
    if ln != len(b) - 6:
        d["error"] = f"MBAP length {ln} but {len(b) - 6} bytes follow (unit id + PDU)"
    pdu = b[7:]
    fc = pdu[0]
    d["fc"] = fc
    if fc & 0x80:
        code = pdu[1] if len(pdu) > 1 else 0
        d.update(dir="resp", exception=code, text=f"EXCEPTION fc {fc & 0x7F:02d} code {code:02X} {EXC_NAMES.get(code, '?')}")
        d["ok"] = "error" not in d
        return d
    d["fcName"] = FC_NAMES.get(fc, "unknown function")
    body = pdu[1:]
    if direction == "auto":
        if fc in (3, 4, 1, 2):
            direction = "resp" if len(body) >= 1 and body[0] == len(body) - 1 and len(body) != 4 else "req"
        elif fc == 16:
            direction = "req" if len(body) >= 5 and body[4] == len(body) - 5 else "resp"
        else:
            direction = "req"
    d["dir"] = direction
    try:
        if fc in (3, 4) and direction == "req":
            st, q = struct.unpack(">HH", body[:4])
            d.update(start=st, qty=q, text=f"read {q} register(s) from {st} ({40001 + st} 1-based)")
        elif fc in (3, 4):
            bc = body[0]
            regs = [struct.unpack(">H", body[1 + 2 * i:3 + 2 * i])[0] for i in range(bc // 2)]
            d.update(byteCount=bc, regs=regs, text=f"{bc // 2} register(s)")
            if tid_type and req_start is not None:
                d["values"] = decode_block(tid_type, req_start, regs, order)
        elif fc in (1, 2) and direction == "req":
            st, q = struct.unpack(">HH", body[:4])
            d.update(start=st, qty=q, text=f"read {q} bit(s) from {st}")
        elif fc in (1, 2):
            bc = body[0]
            bits = [(body[1 + i // 8] >> (i % 8)) & 1 for i in range(bc * 8)]
            d.update(byteCount=bc, bits=bits, text=f"{bc} byte(s) of bits")
        elif fc == 5:
            a, v = struct.unpack(">HH", body[:4])
            d.update(addr=a, value=v, text=f"coil {a} {'ON' if v == 0xFF00 else 'OFF' if v == 0 else 'bad value'}")
        elif fc == 6:
            a, v = struct.unpack(">HH", body[:4])
            d.update(addr=a, value=v, text=f"register {a} = {v} (0x{v:04X})" + (" (echo)" if direction == "resp" else ""))
        elif fc == 16 and direction == "req":
            st, q, bc = struct.unpack(">HHB", body[:5])
            regs = [struct.unpack(">H", body[5 + 2 * i:7 + 2 * i])[0] for i in range(q)]
            d.update(start=st, qty=q, byteCount=bc, regs=regs, text=f"write {q} register(s) from {st}")
        elif fc == 16:
            st, q = struct.unpack(">HH", body[:4])
            d.update(start=st, qty=q, text=f"{q} register(s) written from {st}")
        else:
            d["text"] = "function code not decoded"
        d["ok"] = "error" not in d
    except struct.error:
        d["error"] = "PDU too short for this function code"
    return d
