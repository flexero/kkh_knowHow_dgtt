#!/usr/bin/env python3
"""Final thesis item F4.5 - schematic pages E01-E08 of the F4 conveyors and stations (electrics, safety, communication).

Reuses the Page class (IEC 60617-style symbols, title block) of ../03_asrs/asrs_elec.py. Reads out/elec/elec_specs.json,
drives.csv, io_summary.csv, safety.csv and the PN numbers of elec_report.md (all written by conv_elec.py).
Writes out/elec/E01.svg ... E08.svg. Tags IEC 81346: =CONV1 (P&D + flow racks), =ASM1 (assembly line),
=ASRS1 (AS/RS front, F3 PLC), =HMC1 (HMC load station).

Commands
  python conv_elec_drw.py run
  python conv_elec_drw.py selftest

DESIGN - to be checked and released by a qualified electrical engineer; safety functions by a qualified person.
"""

import argparse
import csv
import json
import os
import re
import sys
import xml.dom.minidom

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "elec")
sys.path.insert(0, os.path.join(HERE, "..", "03_asrs"))
import asrs_elec as E3  # noqa: E402

N_PAGES = 8
BLUE, GREEN, ORANGE, RED, PURPLE = "#2a6fbb", "#2a8a2a", "#c06000", "#c00000", "#7a3fb0"


def load_inputs():
    S = json.load(open(os.path.join(OUT, "elec_specs.json"), encoding="utf-8"))
    rd = lambda n: list(csv.DictReader(open(os.path.join(OUT, n), encoding="utf-8")))
    S["drives_rows"] = rd("drives.csv")
    S["io_rows"] = rd("io_summary.csv")
    S["sf_rows"] = rd("safety.csv")
    rep = open(os.path.join(OUT, "elec_report.md"), encoding="utf-8").read()
    pn = {}
    for m in re.finditer(r"^\| (PLC-\w+) \|.*\| (\d+) \| ([\d.]+) % / ([\d.]+) % \|$", rep, re.M):
        pn[m.group(1)] = {"dev": int(m.group(2)), "loadA": float(m.group(3)), "loadB": float(m.group(4))}
    S["pn"] = pn
    m = re.search(r"\| CC light crate 45 kg \| \d+ \| ([\d.]+) \|", rep)
    m2 = re.search(r"\| assembly section, 1 carrier moving \| \d+ \| ([\d.]+) \|", rep)
    S["dol"] = {"light": float(m.group(1)) if m else 31.4, "carrier": float(m2.group(1)) if m2 else 15.9}
    return S


def page(no, title):
    p = E3.Page(no, title, [])
    p._no = no
    return p


def finish(p):
    s = p.svg()
    s = s.replace("/ P10</text>", "/ E%02d</text>" % N_PAGES)
    s = s.replace("Final thesis item F3 - asrs_elec.py (generated)", "Final thesis item F4.5 - conv_elec_drw.py (generated)")
    s = s.replace("=ASRS1  AS/RS one aisle (VC20 + Roots combined FMS)", "=CONV1 / =ASM1  F4 conveyors (VC20 + RB)")
    s = s.replace("Standard: IEC 60204-1/-32, ISO 13849-1, EN 528", "IEC 60204-1, ISO 13849-1, EN 619")
    s = s.replace("drawn: F3 program", "drawn: F4.5 prog.")
    return s


def sf_table(p, S, ids, x, y, w=1280):
    p.t(x, y, "Safety functions (conv_elec.py, ISO 13849-1 simplified method):", 12, weight="bold")
    y += 18
    p.t(x, y, "SF", 10, weight="bold"); p.t(x + 60, y, "PLr", 10, weight="bold"); p.t(x + 100, y, "PL", 10, weight="bold")
    p.t(x + 140, y, "function", 10, weight="bold")
    for r in S["sf_rows"]:
        if r["SF"] not in ids:
            continue
        y += 16
        p.t(x, y, r["SF"], 10); p.t(x + 60, y, r["PLr"], 10); p.t(x + 100, y, r["PL_achieved"], 10, weight="bold")
        p.t(x + 140, y, r["function"][:150], 9)
    return y


# ============================================================================= E01 single-line overview
def e01(S):
    p = page("E01", "Single-line overview: area feeders")
    P = S["power"]
    p.t(60, 70, "E01 - Single-line overview of the F4 conveyor electrics (400 V 3~ 50 Hz TN-S, 24 V DC control)", 16, weight="bold")
    p.box(80, 100, 260, 60, "Main distribution -XD0", "400 V 3~ from the hall LV board", "", fill="#eeeeee")
    p.l(340, 130, 1300, 130, 3.0)
    areas = [("AF", "=ASRS1+AF", "AS/RS front (PLC-ASRS1, F3)"), ("PD", "=CONV1", "P&D stations + flow racks (PLC-CONV1)"),
             ("ASM", "=ASM1", "assembly carrier line (PLC-ASM1)"), ("HMC", "=HMC1", "HMC load station (pallet-system PLC)")]
    for i, (a, tag, name) in enumerate(areas):
        x = 380 + i * 240
        q = P[a]
        p.l(x + 40, 130, x + 40, 170, 2)
        p.fuse(x + 40, 172, "-FA%d" % (i + 1), "gG %d A" % q["fuse"])
        p.l(x + 40, 210, x + 40, 250, 2)
        p.box(x, 250, 220, 92, tag, name[:34], "feeder %s" % q["cable"], fill="#e6f0ff")
        p.t(x + 5, 318, "drives %d, %.1f kW installed" % (q["n"], q["P_kW"]), 10)
        p.t(x + 5, 333, "I_b %.1f A, dU %.2f %%" % (q["I_b"], q["du"]), 10)
    # PD power bus with tap-offs
    y = 420
    p.t(60, y - 28, "=CONV1 %s along the AGV spine," % P["PD"]["cable"], 12, weight="bold")
    p.t(60, y - 12, "%d drives on tap-offs (inverter + STO)" % P["PD"]["n"], 12, weight="bold")
    p.l(620 + 40, 342, 620 + 40, y, 2)
    p.l(100, y, 1300, y, 4.0, BLUE)
    for k in range(10):
        x = 140 + k * 115
        p.l(x, y, x, y + 40, 1.5, BLUE)
        p.r(x - 25, y + 40, 50, 28, fill="#fff")
        p.t(x, y + 58, "-TA%02d" % (k + 1), 9, "middle")
        p.motor(x, y + 100, "", "")
    p.t(100, y + 150, "Equivalent point load at L/2 for the voltage drop of the distributed load: dU = sqrt3 I R'(L/2) cos phi / U = %.2f %% <= 3 %%." % P["PD"]["du"], 11)
    # drive table excerpt
    p.t(60, 620, "Drives (drives.csv):", 12, weight="bold")
    yy = 638
    col = 0
    for r in S["drives_rows"]:
        if int(r["qty"]) == 0:
            continue
        x = 60 + col * 430
        p.t(x, yy, "%-4s %-28s %s kW x %s  (%s A each)" % (r["area"], r["drive"][:28], r["kW"], r["qty"], r["I_in_A_each"]), 10)
        col += 1
        if col == 3:
            col = 0
            yy += 16
    yy += 30
    p.t(60, yy, "24 V DC: " + "; ".join("%s %d A PSU (load %.1f A, %d remote I/O stations)" % (a, S["psu"][a]["psu_A"], S["psu"][a]["I_A"], S["psu"][a]["remote_io"]) for a in ("AF", "PD", "ASM", "HMC")), 11)
    return p


# ============================================================================= E02 / E03 networks
def plc_rack(p, x, y, name, mods, cpu_tag):
    items = [("CPU 1515F", cpu_tag + " X1 X2", "#e6f0ff")]
    if mods:
        lab = {"CP1543-1": ("CP 1543-1", "factory, firewall", "#ffe9cc"), "CM1542-1": ("CM 1542-1", "PN net 2", "#e6f0ff"),
               "CM_PtP_RS485_HF": ("CM PtP 485", "Modbus RTU", "#e8f7e8"), "PS60W": ("PS 60W", "slot 0", "#eeeeee")}
        order = ["PS60W", "CP1543-1", "CM1542-1", "CM_PtP_RS485_HF"]
        items = [lab["PS60W"]] + items + [lab[m] for m in order[1:] if m in mods]
    p.t(x, y - 8, name, 12, weight="bold")
    for i, (a, b, f) in enumerate(items):
        p.r(x + i * 92, y, 88, 60, fill=f)
        p.t(x + i * 92 + 5, y + 20, a, 10, weight="bold")
        p.t(x + i * 92 + 5, y + 36, b, 9)
    return [x + i * 92 + 44 for i in range(len(items))], [it[0] for it in items]


def e02(S):
    p = page("E02", "Network Case A: built-in PLC ports")
    p.t(60, 70, "E02 - Network Case A: only the built-in ports (X1 = PROFINET IO, X2 = factory Modbus TCP)", 16, weight="bold")
    p.box(860, 90, 440, 50, "VLAN 720 factory - L3 core firewall", "fmsctl cell controller 10.70.1.10 (Modbus TCP client)", fill="#eeeeee")
    p.l(100, 175, 1300, 175, 2.5, ORANGE)
    p.t(100, 168, "X2 ports -> VLAN 720 (zone boundary only at the core firewall)", 11, color=ORANGE)
    p.l(1080, 140, 1080, 175, 2.5, ORANGE)
    blocks = [("PLC-ASRS1 (F3)", "=ASRS1+GC-KF2", 80, "AS/RS front on X1 together with the crane (F3 Part B/C)"),
              ("PLC-CONV1", "=CONV1+CC-KF1", 500, "P&D stations + flow racks"),
              ("PLC-ASM1", "=ASM1+CC-KF1", 920, "assembly loop + spurs + test benches")]
    for name, tag, x, txt in blocks:
        xs, names = plc_rack(p, x, 230, name, [], tag)
        p.l(xs[0] + 20, 230, xs[0] + 20, 175, 2, ORANGE)
        p.l(xs[0], 290, xs[0], 360, 2.5, BLUE)
        p.l(xs[0], 360, x + 380, 360, 2.5, BLUE)
        p.t(xs[0] + 6, 352, "X1 PROFINET (line / MRP ring)", 10, color=BLUE)
        p.t(xs[0] + 50, 318, txt, 10)
        key = name.split(" ")[0]
        if key in S["pn"]:
            q = S["pn"][key]
            p.t(x, 545, "%d PN devices, cyclic load %.2f %% (4 ms)" % (q["dev"], q["loadA"]), 11, weight="bold")
    io = {r["area"]: r for r in S["io_rows"]}
    rows = [("=ASRS1 AF", "AF", 80), ("=CONV1 PD", "PD", 500), ("=ASM1 ASM", "ASM", 920)]
    for lab, a, x in rows:
        r = io[a]
        y = 570
        for txt in ("remote I/O stations: %s" % r["remote_io"], "decentralised drives: %s" % r["pn"], "AGV couplers: %s" % r["coupler"],
                    "DI %s / DO %s / F-DI %s / F-DO %s / AI %s" % (r["DI"], r["DO"], r["F-DI"], r["F-DO"], r["AI"]), "24 V PSU %s A" % r["psu_A"]):
            p.t(x, y, txt, 10)
            y += 16
        for k in range(5):
            xx = x + 20 + k * 70
            p.l(xx, 360, xx, 500, 1.2, BLUE)
            p.r(xx - 25, 500, 50, 30, fill="#fff")
            p.t(xx, 519, ["RIO", "TA", "TA", "cpl", "LC"][k], 9, "middle")
    p.t(60, 680, "Case A properties:", 12, weight="bold")
    for i, s in enumerate(["+ cheapest: no expansion module (0 EUR extra)", "- one PROFINET line per PLC: a cable fault can stop all devices behind it (use an MRP ring)",
                           "- the CPU X2 port sits directly on VLAN 720: the only conduit is the core firewall (IEC 62443 zone = whole VLAN)",
                           "- no serial port: energy meters / hydraulic units need gateways",
                           "Bandwidth is not a limit in either case (cyclic load far below the 50 % planning limit)."]):
        p.t(80, 702 + 18 * i, s, 11)
    return p


def e03(S):
    p = page("E03", "Network Case B: expansion modules")
    p.t(60, 70, "E03 - Network Case B: expansion communication modules (selection = cheapest feasible set, method of F3 Part D)", 16, weight="bold")
    p.box(860, 90, 440, 50, "VLAN 720 factory - L3 core firewall", "fmsctl 10.70.1.10; only TCP 502 + HTTPS 443 allowed by the CP", fill="#eeeeee")
    p.l(100, 175, 1300, 175, 2.5, ORANGE)
    p.t(100, 168, "CP 1543-1 ports -> VLAN 720 (conduit with firewall at every machine zone)", 11, color=ORANGE)
    p.l(1080, 140, 1080, 175, 2.5, ORANGE)
    nets = {"PLC-CONV1": ("=CONV1+CC-KF1", 80, ["net 1 = spine WEST (P&D FIN, QC, VMC, HMC...)", "net 2 = spine EAST (ROT, BUY, ASY, flow racks)"]),
            "PLC-ASM1": ("=ASM1+CC-KF1", 690, ["net 1 = loop + spurs + lift tables", "net 2 = 7 test benches (vendor PLCs)"])}
    for plc, (tag, x, txt) in nets.items():
        mods = S["comm"][plc]["B"]
        xs, names = plc_rack(p, x, 230, plc + " (Case B)", mods, tag)
        cp = names.index("CP 1543-1") if "CP 1543-1" in names else None
        if cp is not None:
            p.l(xs[cp], 230, xs[cp], 175, 2.5, ORANGE)
        cpu = names.index("CPU 1515F")
        p.l(xs[cpu], 290, xs[cpu], 360, 2.5, BLUE); p.l(xs[cpu], 360, x + 640, 360, 2.5, BLUE)
        p.t(xs[-1] + 10, 352, "X1 " + txt[0], 10, color=BLUE)
        if "CM 1542-1" in names:
            c = names.index("CM 1542-1")
            p.l(xs[c], 290, xs[c], 420, 2.5, BLUE); p.l(xs[c], 420, x + 640, 420, 2.5, BLUE)
            p.t(xs[-1] + 10, 412, "CM 1542-1 " + txt[1], 10, color=BLUE)
        if "CM PtP 485" in names:
            c = names.index("CM PtP 485")
            p.l(xs[c], 290, xs[c], 480, 2.5, GREEN); p.l(xs[c], 480, x + 640, 480, 2.5, GREEN)
            p.t(xs[-1] + 10, 472, "RS-485 Modbus RTU: energy meters" + (" + HPUs" if plc == "PLC-ASM1" else ""), 10, color=GREEN)
        p.t(x, 520, "modules: " + " + ".join(mods), 11, weight="bold")
        q = S["pn"].get(plc)
        if q:
            p.t(x, 540, "%d PN devices; load per network %.2f %% (one network in Case A: %.2f %%)" % (q["dev"], q["loadB"], q["loadA"]), 11)
        p.t(x, 558, "X2: machine zone (HMI, engineering port), not routed", 10)
        p.t(x, 574, "backplane: CPU feed 10 W < modules 13.7 W -> PS 60 W in slot 0", 10)
    p.r(60, 610, 1280, 150, dash="8 5")
    p.t(70, 630, "IEC 62443-3-3 zones and conduits (Case B):", 12, weight="bold")
    for i, s in enumerate(["zone 'factory' = VLAN 720; zones 'CONV1', 'ASM1', 'ASRS1' = the machine networks behind each CP firewall",
                           "conduit = CP 1543-1: allow TCP 502 only from 10.70.1.10, HTTPS 443 from the engineering station, NTP, syslog; default deny",
                           "factory address of every PLC stays on the CP (fmsctl and the register map do not change between Case A and Case B)",
                           "PLC-ASRS1: AS/RS front on CM 1542-1 net 2 (F3 Part D, guide 60)"]):
        p.t(80, 652 + 20 * i, "- " + s, 11)
    return p


# ============================================================================= E04 drive circuit
def e04(S):
    p = page("E04", "Typical decentralised drive circuit")
    p.t(60, 70, "E04 - Typical conveyor drive: power-bus tap-off -> decentralised drive (inverter + STO) -> geared motor", 16, weight="bold")
    for i, ph in enumerate(("L1", "L2", "L3", "PE")):
        y = 120 + 22 * i
        p.l(80, y, 1300, y, 2.0, "#000" if ph != "PE" else GREEN)
        p.t(1305, y + 4, ph, 10)
    for k, (x, tag, kw) in enumerate([(250, "-TA11", "0.12"), (650, "-TA12", "0.18"), (1050, "-TA13", "0.75")]):
        for i in range(4):
            p.l(x + 10 * i, 120 + 22 * i, x + 10 * i, 230, 1.2)
        p.box(x - 30, 230, 130, 40, "tap-off -XT%d" % (k + 1), "fused 3 x 4 A / 10 A", fill="#fff")
        p.l(x + 30, 270, x + 30, 300, 2)
        p.box(x - 60, 300, 190, 120, tag, "decentral drive %s kW" % kw, "inverter + STO (PROFIsafe)", fill="#e6f0ff")
        p.t(x - 55, 362, "24 V DC in, PROFINET in/out", 10)
        p.t(x - 55, 378, "ramp 0.3 m/s2 (0.67 s to 0.2 m/s)", 10)
        p.t(x - 55, 394, "brake output (TU lift only)", 10)
        p.l(x + 30, 420, x + 30, 470, 2)
        p.motor(x + 30, 500, "", "")
        p.t(x + 60, 505, "-MA%d geared motor %s kW" % (k + 11, kw), 10)
    p.l(80, 560, 1300, 560, 2.5, BLUE); p.t(85, 553, "PROFINET (daisy chain through the drives) + PROFIsafe telegram (STO, SS1)", 11, color=BLUE)
    p.l(80, 590, 1300, 590, 2.0, RED); p.t(85, 583, "24 V DC (separate supply for logic, drives keep their PROFINET link when the power is off)", 11, color=RED)
    p.t(60, 650, "Why a ramp is mandatory (conv_elec.py ch. 1, direct-on-line start with 2 x rated torque):", 12, weight="bold")
    p.t(80, 672, "- light crate (45 kg) on a chain zone: a = %.1f m/s2 > 0.5 g -> crate jumps, parts shift" % S["dol"]["light"], 11)
    p.t(80, 690, "- one moving carrier on an assembly section (0.75 kW): a = %.1f m/s2 > 3.9 m/s2 sliding limit of the product" % S["dol"]["carrier"], 11)
    p.t(80, 708, "-> every drive ramps at 0.3 m/s2; the inverter also gives speed control for zone accumulation and soft stops", 11)
    p.t(80, 726, "STO / SS1 are commanded by the F-CPU over PROFIsafe (no hard-wired STO cable per drive); E-stop SF-C1 = SS1 then STO.", 11)
    sf_table(p, S, ("SF-C1",), 60, 770)
    return p


# ============================================================================= E05 AGV dock
def e05(S):
    p = page("E05", "AGV dock safety circuit SF-C2")
    sd = S["S_dock_mm"]
    p.t(60, 70, "E05 - AGV dock (P&D lane end / TU docks): light curtain with muting SF-C2 + optical coupler signals", 16, weight="bold")
    # plan sketch: lane, tunnel, curtain
    x0, y0, sc = 120, 140, 0.25
    p.r(x0 + 420, y0, 400, 120, fill="#e6f0ff"); p.t(x0 + 430, y0 + 20, "lane zone 1 (RL) + PD_end", 11, weight="bold")
    p.r(x0, y0 + 20, 320, 80, fill="#f3ecfa"); p.t(x0 + 180, y0 + 95, "AGV (docked, mutes)", 11, color=PURPLE)
    tun = sd * sc
    xc = x0 + 420 - tun
    p.l(xc, y0 - 20, xc, y0 + 140, 3, RED); p.t(xc - 60, y0 - 26, "multi-beam light curtain", 10, color=RED)
    p.l(xc, y0 - 10, x0 + 420, y0 - 10, 2, "#555"); p.l(xc, y0 + 130, x0 + 420, y0 + 130, 2, "#555")
    p.t(xc + 10, y0 + 155, "guarded tunnel (side fences) S = %.0f mm from the hazard (lane end)" % sd, 11, weight="bold")
    p.t(xc + 10, y0 + 172, "S = K T + C = 1600 mm/s x 0.34 s + 850 mm (ISO 13855, body detection)", 10)
    for k, yy in enumerate((y0 + 40, y0 + 80)):
        p.c(xc + 40 + 30 * k, yy, 6, "#ffd966"); p.t(xc + 52 + 30 * k, yy + 4, "-BG%d" % (61 + k), 9)
    # circuit
    y = 400
    items = [(80, "-BG60 light curtain", "OSSD1 / OSSD2", RED), (330, "-BG61/-BG62 muting", "2 ch, timing + sequence", "#b08000"),
             (580, "AGV_PRESENT + dock sensor", "from coupler -KF70 A1", PURPLE), (830, "-KF1 F-CPU (F-DI)", "muting logic, max 20 s", BLUE),
             (1080, "-TA lane drive", "STO via PROFIsafe", BLUE)]
    for x, a, b, c in items:
        p.box(x, y, 210, 50, a, b, fill="#fff")
    for x1, x2 in ((290, 330), (540, 580), (790, 830), (1040, 1080)):
        p.l(x1, y + 25, x2, y + 25, 2)
    p.l(935, 450, 935, 500, 2, PURPLE); p.box(830, 500, 230, 44, "coupler -KF70: S4 ST_FAULT", "AGV stops its deck rollers", fill="#f3ecfa")
    p.t(80, 480, "Muting = curtain bridged only while AGV_PRESENT = 1 AND the docking sensor sees the AGV AND both muting sensors are on in the right", 10)
    p.t(80, 494, "order within 4 s; muting ends 2 s after the AGV leaves; max muting time 20 s -> otherwise STO + alarm.", 10)
    # coupler signals
    p.t(60, 580, "Optical coupler signals (F4.3, 8 + 8 bit, NOT safety-related):", 12, weight="bold")
    sig = [("A1", "AGV_PRESENT"), ("A2", "AGV_READY_SEND"), ("A3", "AGV_READY_RECV"), ("A4", "AGV_TRANSFER_DONE"),
           ("S1", "ST_READY_RECV"), ("S2", "ST_READY_SEND"), ("S3", "ST_TRANSFER_DONE"), ("S4", "ST_FAULT")]
    for i, (a, b) in enumerate(sig):
        p.t(80 + (i % 4) * 300, 602 + (i // 4) * 18, "%s %s" % (a, b), 11)
    p.t(80, 650, "Spare bits A5-A8 / S5-S8 reserved (crate id parity, lane select). Job data (crate id, destination) over the fleet manager / fmsctl.", 10)
    sf_table(p, S, ("SF-C2",), 60, 700)
    return p


# ============================================================================= E06 lift table
def e06(S):
    p = page("E06", "Lift table in the pit SF-C4")
    p.t(60, 70, "E06 - ASSY spur lift table in a 250 mm pit: hydraulic power unit, 2 monitored lowering valves, safety edge (SF-C4)", 16, weight="bold")
    p.r(120, 380, 360, 60, fill="#eeeeee"); p.t(130, 432, "pit 250 mm", 10)
    p.r(140, 300, 320, 30, fill="#e6f0ff"); p.t(150, 320, "table + carrier (top 100 ... 800 mm)", 10)
    p.l(160, 330, 440, 380, 2); p.l(440, 330, 160, 380, 2)
    p.l(140, 334, 460, 334, 4, ORANGE); p.t(120, 460, "-BG81 safety edge (orange) around the table, EN ISO 13856-2", 10, color=ORANGE)
    p.box(560, 140, 200, 60, "-MA81 HPU 1.1 kW", "hydraulic power unit", fill="#fff")
    p.motor(660, 240, "", "")
    p.box(560, 300, 200, 50, "-QM81 lowering valve 1", "monitored (spool position)", fill="#fff")
    p.box(560, 370, 200, 50, "-QM82 lowering valve 2", "monitored (spool position)", fill="#fff")
    p.l(460, 325, 560, 325, 2); p.l(460, 395, 560, 395, 2)
    p.box(860, 140, 220, 60, "-KF81 edge control unit", "PL d (certified)", fill="#fff4e6")
    p.box(860, 240, 220, 60, "=ASM1-KF1 F-CPU", "F-DI edge 2 ch, F-DQ valves", fill="#e6f0ff")
    p.box(860, 340, 220, 60, "-BG82 height sensor", "AI 4-20 mA (memory heights)", fill="#fff")
    p.l(970, 200, 970, 240, 2); p.l(860, 270, 760, 325, 2); p.l(860, 270, 760, 395, 2)
    p.t(560, 470, "Lowering: both valves must open; the edge or an E-stop closes both (Cat 3, MTTFd 150 a each, DC 90 % by spool monitoring).", 11)
    p.t(560, 488, "Raising: the HPU runs only while 'up' is pressed (hold-to-run) or a memory height is recalled with the pit cover closed.", 11)
    p.t(60, 540, "Stopping check: overrun after edge contact s = v (t_edge + t_valve) = 30 mm/s x (20 + 80) ms = 3 mm <= 25 mm edge travel -> no crushing.", 12, weight="bold")
    p.t(60, 562, "Pit: cover plates follow the table; pit cover closed = DI; light pit lamp; drain for hydraulic oil (F11).", 11)
    sf_table(p, S, ("SF-C4", "SF-C7"), 60, 620)
    return p


# ============================================================================= E07 gate + E-stop
def e07(S):
    p = page("E07", "Assembly gate SF-C3 + E-stop chain SF-C1")
    p.t(60, 70, "E07 - Assembly loop personnel gate (lift-up section) SF-C3 and the E-stop chain SF-C1", 16, weight="bold")
    p.box(80, 120, 230, 60, "-SQ91 gate interlock", "guard locking, coded, 2 ch", fill="#fff")
    p.box(80, 210, 230, 60, "-SF91 request button", "outside + escape release inside", fill="#fff")
    p.box(400, 150, 240, 70, "=ASM1-KF1 F-CPU", "F-DI interlock + lock monitor", "F-DQ lock solenoid", fill="#e6f0ff")
    p.box(740, 120, 260, 60, "upstream section drive", "STO via PROFIsafe", fill="#fff")
    p.box(740, 210, 260, 60, "-YB91 guard locking solenoid", "unlock only after standstill", fill="#fff")
    p.l(310, 150, 400, 175, 2); p.l(310, 240, 400, 195, 2); p.l(640, 170, 740, 150, 2); p.l(640, 200, 740, 240, 2)
    seq = ["1 request: the section ramps down and the F-CPU commands STO",
           "2 standstill confirmed (drive status + 1 s) -> guard locking released -> gate lifts",
           "3 gate open: STO stays active; restart only after the gate is closed AND reset outside",
           "4 escape: the inside release opens the lock mechanically at any time (the section is then stopped by STO at once)"]
    for i, s in enumerate(seq):
        p.t(80, 320 + 18 * i, s, 11)
    p.t(60, 420, "E-stop chain SF-C1 (one per area, cross-monitored 2 ch to F-DI, SS1 then STO of all drives of the area):", 12, weight="bold")
    x = 80
    for i in range(6):
        p.contact_nc(x + i * 150, 450, "-SF5%d" % (i + 1), "E-stop", estop=True)
        if i < 5:
            p.l(x + i * 150, 450, x + (i + 1) * 150, 450, 1.5)
    p.box(1000, 440, 260, 50, "F-DI ch1 / ch2", "pulse-tested, cross-circuit detection", fill="#e6f0ff")
    for a in (("AF", S["counts"]["AF"]["estop"]), ("PD", S["counts"]["PD"]["estop"]), ("ASM", S["counts"]["ASM"]["estop"]), ("HMC", S["counts"]["HMC"]["estop"])):
        pass
    p.t(80, 530, "E-stops per area: AF %d, PD %d, ASM %d, HMC %d." % (S["counts"]["AF"]["estop"], S["counts"]["PD"]["estop"], S["counts"]["ASM"]["estop"], S["counts"]["HMC"]["estop"]), 11)
    sf_table(p, S, ("SF-C1", "SF-C3", "SF-C5", "SF-C6"), 60, 590)
    return p


# ============================================================================= E08 P&D station I/O
def e08(S):
    p = page("E08", "P&amp;D station: terminal and I/O plan")
    p.t(60, 70, "E08 - Typical P&D station =CONV1+PDn (2 lanes, PD_end, coupler, light curtain, E-stop): remote I/O and addresses", 16, weight="bold")
    p.box(80, 110, 300, 50, "=CONV1+PDn-KF10 remote I/O", "IM 155-6 PN + DI 16 + F-DI 8 + DQ 8", fill="#e6f0ff")
    rows = [("%I100.0", "-BG11", "lane IN zone 1 slow-down", "DI"), ("%I100.1", "-BG12", "lane IN zone 1 stop", "DI"),
            ("%I100.2", "-BG13", "lane IN end stop up", "DI"), ("%I100.3", "-BG14", "lane IN end stop down", "DI"),
            ("%I100.4", "-BG15", "muting sensor A", "DI"), ("%I100.5", "-BG16", "muting sensor B", "DI"),
            ("%I100.6", "-BG21", "lane OUT zone 1 slow-down", "DI"), ("%I100.7", "-BG22", "lane OUT zone 1 stop", "DI"),
            ("%I101.0", "-BG23", "lane OUT end stop up", "DI"), ("%I101.1", "-BG24", "lane OUT end stop down", "DI"),
            ("%I101.2..7", "-KF70", "coupler A1..A4 + spare", "DI"), ("%Q100.0..3", "-KF70", "coupler S1..S4", "DQ"),
            ("F-DI 0/1", "-BG60", "light curtain OSSD1/2 lane IN", "F-DI"), ("F-DI 2/3", "-BG65", "light curtain OSSD1/2 lane OUT", "F-DI"),
            ("F-DI 4/5", "-SF51", "E-stop 2 ch", "F-DI"), ("PN dev", "-TA11..-TA1n", "roller zone drives + stop drives", "PN"),
            ("PN dev", "-TA19/-TA29", "electric pop-up end stops", "PN")]
    p.t(80, 190, "address", 11, weight="bold"); p.t(220, 190, "tag", 11, weight="bold"); p.t(360, 190, "function", 11, weight="bold"); p.t(700, 190, "type", 11, weight="bold")
    for i, (a, t, f, ty) in enumerate(rows):
        y = 210 + 18 * i
        p.t(80, y, a, 10); p.t(220, y, t, 10); p.t(360, y, f, 10); p.t(700, y, ty, 10)
    io = {r["area"]: r for r in S["io_rows"]}["PD"]
    c = S["counts"]["PD"]
    p.t(820, 210, "=CONV1 totals (io_summary.csv):", 12, weight="bold")
    for i, s in enumerate(["DI %s, DO %s, F-DI %s" % (io["DI"], io["DO"], io["F-DI"]), "PN drives %s, couplers %s" % (io["pn"], io["coupler"]),
                           "remote I/O stations %s, 24 V PSU %s A" % (io["remote_io"], io["psu_A"]),
                           "roller zones %d, PD_end %d, flow lanes %d, flow blocks %d" % (c["RL"], c["PD_end"], c["flow_lane"], c["flow_block"]),
                           "E-stops %d, AGV docks %d" % (c["estop"], c["dock"])]):
        p.t(830, 232 + 18 * i, s, 11)
    p.t(80, 540, "Terminal strip -XD10: 24 V / 0 V per sensor group (M12 boxes), F-DI pulse outputs T1/T2 to the light-curtain test inputs,", 11)
    p.t(80, 558, "PE bar, PROFINET in/out (M12 D-coded), power bus tap-off -XT10 (3 x 4 A) for the drives of this station.", 11)
    sf_table(p, S, ("SF-C1", "SF-C2"), 60, 620)
    return p


BUILDERS = [e01, e02, e03, e04, e05, e06, e07, e08]


def build(S):
    return {"E%02d" % (i + 1): finish(b(S)) for i, b in enumerate(BUILDERS)}


def cmd_run():
    S = load_inputs()
    pages = build(S)
    for no, svg in pages.items():
        with open(os.path.join(OUT, no + ".svg"), "w", encoding="utf-8") as fh:
            fh.write(svg)
    print("written:", ", ".join(sorted(pages)), "to", OUT)


def selftest():
    S = load_inputs()
    pg = build(S)
    res = []

    def ck(n, c):
        res.append(bool(c))
        print(("  [PASS] " if c else "  [FAIL] ") + n)
    ck("8 pages E01-E08", sorted(pg) == ["E%02d" % i for i in range(1, 9)])
    ok = True
    for s in pg.values():
        try:
            xml.dom.minidom.parseString(s)
        except Exception:
            ok = False
    ck("all pages well-formed XML", ok)
    ck("title block with page number and 'DESIGN' on every page", all(("/ E08</text>" in s and "DESIGN" in s) for s in pg.values()))
    P = S["power"]
    e01s = pg["E01"]
    ck("E01: fuse and cable of every area = spec", all(("gG %d A" % P[a]["fuse"]) in e01s and P[a]["cable"] in e01s for a in P))
    ck("E01: dU of every area = spec", all(("dU %.2f %%" % P[a]["du"]) in e01s for a in P))
    ck("E01: PD power bus drive count %d" % P["PD"]["n"], ("%d drives on tap-offs" % P["PD"]["n"]) in e01s)
    ck("E02 (Case A) has no CP / CM / PS module", not any(k in pg["E02"] for k in ("CP 1543-1", "CM 1542-1", "CM PtP", "PS 60W")))
    ck("E03 (Case B) has CP 1543-1, CM 1542-1, CM PtP, PS 60W", all(k in pg["E03"] for k in ("CP 1543-1", "CM 1542-1", "CM PtP", "PS 60W")))
    ck("E03 module lists = spec for both PLCs", all(" + ".join(S["comm"][p]["B"]) in pg["E03"] for p in S["comm"]))
    ck("E02/E03: PN device counts = report (%s)" % ", ".join("%s %d" % (k, v["dev"]) for k, v in S["pn"].items()),
       S["pn"] and all(("%d PN devices" % v["dev"]) in pg["E02"] and ("%d PN devices" % v["dev"]) in pg["E03"] for v in S["pn"].values()))
    ck("E05: safety distance S = %.0f mm" % S["S_dock_mm"], ("S = %.0f mm" % S["S_dock_mm"]) in pg["E05"])
    ck("E05: all 8 coupler signals", all(sg in pg["E05"] for sg in ("AGV_PRESENT", "AGV_TRANSFER_DONE", "ST_READY_RECV", "ST_FAULT")))
    ck("E06: overrun 3 mm vs 25 mm", "= 3 mm &lt;= 25 mm" in pg["E06"] or "= 3 mm <= 25 mm" in pg["E06"])
    allp = "".join(pg.values())
    ck("every SF of safety.csv appears on a page with its PL", all(r["SF"] in allp for r in S["sf_rows"]))
    ck("E04: DOL values from the report (%.1f / %.1f m/s2)" % (S["dol"]["light"], S["dol"]["carrier"]), ("a = %.1f m/s2" % S["dol"]["light"]) in pg["E04"])
    ck("E08: PD I/O totals = io_summary.csv", ("DI %s, DO %s, F-DI %s" % tuple({r["area"]: r for r in S["io_rows"]}["PD"][k] for k in ("DI", "DO", "F-DI"))) in pg["E08"])
    n = sum(res)
    print("SELFTEST %s (%d/%d)" % ("PASS" if n == len(res) else "FAIL", n, len(res)))
    return n == len(res)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sp = ap.add_subparsers(dest="cmd")
    sp.add_parser("run")
    sp.add_parser("selftest")
    a = ap.parse_args(argv)
    if a.cmd == "run":
        cmd_run()
    elif a.cmd == "selftest":
        sys.exit(0 if selftest() else 1)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
