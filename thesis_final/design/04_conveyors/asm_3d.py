#!/usr/bin/env python3
"""Final thesis item F4.4 (3D part) - 3D models (binary STL + OpenSCAD) and A3 drawings (SVG) of the assembly carrier line.

  carrier            1800 x 800 carrier: 2 RHS 80 x 40 at gauge 640, cross members, deck, 2 locating bushes, PU bumpers 20 mm
  carrier_vc20       carrier + VC20 adapter (4 rubber-lined saddles) + VC20 envelope (tank 500 x 1550, feet 900 x 380, H 1050)
  carrier_rb100      carrier + RB adapter (4 pins) + RB100 envelope (base frame 900 x 600, blower + motor, H 700)
  main_line_module   2 m twin-strand accumulation chain section (top 500), side guides, damped stopper, lift-transfer (lift 30)
  assy_spur          transfer + 2 m spur + work position on a scissor lift table in a 250 mm pit (carrier top 500;
                     variant assy_spur_low: carrier top 100), lift-and-locate pins, operator floor, balancer shared by 2 spurs
  test_spur          spur + test bench hood + docking slide (air coupling, CEE plug) + lift-and-locate
  load_station       carrier at the load position, tank-rack places (rack = 4 tanks 2 x 2), jib with vacuum tank lifter
  loop_layout        schematic loop 44 x 6 m (= 100 m) with 4 corner units, 9 ASSY + 7 TEST spurs on side 1 (alternating),
                     PAINT + 2 PACK spurs on side 2, LOAD / UNLOAD, 4 drive sections, the carriers of the spec

Python 3 standard library only, offline. Helpers: conv_3d.py (F4.2), stations_3d.py (F4.3), ../03_asrs/asrs_3d.py (F3).
Inputs: out/assembly/assembly_specs.json + out/assembly/assembly_report.md (asm_line.py). Guide: Doctor paper/61, chapter 48.
DESIGN - check and release before manufacture.

Commands
  python asm_3d.py run        out/3d/assembly/*.stl + *.scad + 2 previews, out/drw/D21..D25 *.svg, dimension rows appended
  python asm_3d.py selftest
"""

import argparse
import csv
import json
import math
import os
import re
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "03_asrs"))
import conv_3d as C3  # noqa: E402
import stations_3d as S3  # noqa: E402
from asrs_3d import Mesh, write_stl, read_stl, Sheet, View, iso_preview  # noqa: E402

OUT = os.path.join(HERE, "out")
D3A = os.path.join(OUT, "3d", "assembly")
DRW = os.path.join(OUT, "drw")
ROW_PREFIX = "ASM "
DRAWINGS = ("D21_carrier_adapters", "D22_main_line_transfer_stopper", "D23_assy_spur_lift_table", "D24_loop_plan", "D25_load_station_test_dock")


# ============================================================================ parameters
def params():
    with open(os.path.join(OUT, "assembly", "assembly_specs.json"), encoding="utf-8") as fh:
        S = json.load(fh)
    rep = open(os.path.join(OUT, "assembly", "assembly_report.md"), encoding="utf-8").read()
    c = S["carrier"]
    p = {"S": S, "rep": rep,
         "top": float(S["conveyor_top"]), "cL": float(c["L_mm"]), "cW": float(c["W_mm"]), "gauge": float(c["gauge_mm"]),
         "pitch": c["pitch_m"] * 1000.0, "bumper": float(c["bumper_stroke_mm"]),
         "lift": [float(v) for v in S["lift_table"]], "carriers": int(S["carriers"]), "stations": S["stations"],
         "seg": S["seg_m"], "qp": S["queue_places"], "rack_places": int(S["rack_places"]), "balancers": int(S["balancers"]),
         "sections": int(S["sections"]), "sec_kW": S["section_kW"], "loop_m": float(S["loop_m"]), "transfer": S["transfer"]}
    # derived design choices of this sub-item (written to the dimension table)
    p["rhs_h"], p["rhs_b"] = 80.0, 40.0
    p["deck_t"] = 8.0
    p["c_h"] = p["rhs_h"] + p["deck_t"]                   # 88: carrier height (chain top -> deck top)
    p["bush_x"] = 700.0                                   # locating bushes at x = +-700 on the centre line
    p["saddle_h"] = 70.0                                  # VC20 saddle incl. 10 mm rubber
    p["rb_spacer"] = 10.0
    p["lift_dz"] = 30.0                                   # lift-transfer stroke
    p["spur_len"] = S["transfer"]["spur_m"] * 1000.0      # 2000 spur track
    p["spur_gauge"] = 1200.0                              # spur strands at x = +-600 cross the carrier RHS
    p["pit"] = 250.0
    p["table_closed"] = 230.0                             # scissor table closed height (platform top above its base)
    p["spur_pitch"] = 2600.0                              # spur pitch on one side of the main line (alternating sides -> 1300 along the line)
    p["Lx"], p["Ly"] = 44000.0, 6000.0                    # loop rectangle: 2 x 44 + 2 x 6 = 100 m
    p["s_load"] = 2000.0
    p["hood"] = (2200.0, 1300.0, 1600.0)
    p["rack"] = (1700.0, 1150.0, 1150.0)                  # tank rack 2 x 2: L x W x H
    p["tank_D"], p["tank_L"] = 500.0, 1550.0
    p["jib_R"] = 3500.0
    p["elbow"] = {"P5 female": 960.0, "P95 male": 1185.0}
    p["work_off"] = -100.0
    return p


def rep_rows(p, product):
    m = re.search(r"^\| %s \| ([^\n]*)\|$" % product, p["rep"], re.M)
    return [x.strip() for x in m.group(1).split("|")] if m else []


def rep_line(p, key):
    for l in p["rep"].splitlines():
        if key in l:
            return l
    return ""


SM = S3.SMesh
place = S3.place


def scad_of(m, title, p):
    s = S3.scad_of(m, title, {"top": p["top"]})
    return s.replace("generated by stations_3d.py from out/stations/stations_specs.json (F4.3)",
                     "generated by asm_3d.py from out/assembly/assembly_specs.json (F4.4)")


# ============================================================================ carrier + adapters (origin: carrier centre, z = 0 = chain top)
def gen_carrier(p, name="carrier"):
    m = SM(name)
    L, W, g = p["cL"], p["cW"], p["gauge"]
    hb, hh = p["rhs_b"] / 2, p["rhs_h"]
    for s in (-1, 1):
        m.box(-L / 2, s * g / 2 - hb, 0, L / 2, s * g / 2 + hb, hh)                     # RHS 80 x 40 on the chain strands
    for x in (-L / 2 + 30, -L / 4, 0.0, L / 4, L / 2 - 30):
        m.box(x - 30, -g / 2 + hb, 20, x + 30, g / 2 - hb, hh)                            # cross members 60 x 60
    m.box(-L / 2, -W / 2, hh, L / 2, W / 2, hh + p["deck_t"])                             # deck 8 mm
    for x in (-p["bush_x"], p["bush_x"]):
        m.cyl((x, 0.0, hh / 2), "z", 22, hh, 16)                                          # locating bush (pin from below)
    for s in (-1, 1):
        m.box(s * L / 2, -150, 15, s * (L / 2 + p["bumper"]), 150, 70)                    # PU bumper, stroke 20
    m.meta = {"L": L, "W": W, "gauge": g, "deck_top": hh + p["deck_t"], "bush_x": p["bush_x"], "bumper": p["bumper"]}
    return m


def gen_carrier_vc20(p):
    pr = p["S"]["products"]["VC20"]
    m = gen_carrier(p, "carrier_vc20")
    z0 = m.meta["deck_top"]
    fx, fy = pr["feet_x_mm"] / 2, pr["feet_y_mm"] / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box(sx * fx - 60, sy * fy - 60, z0, sx * fx + 60, sy * fy + 60, z0 + p["saddle_h"])     # rubber-lined saddle
    zf = z0 + p["saddle_h"]                                                                          # feet bottom
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl((sx * fx, sy * fy, zf + 30), "z", 25, 60, 12)                                     # anti-vibration feet
    r = p["tank_D"] / 2
    zt = zf + 60 + r
    m.cyl((0.0, 0.0, zt), "x", r, p["tank_L"], 28)                                                  # 300 L receiver
    zp = zt + r
    m.box(-300, -200, zp - 10, 300, 200, zp + 10)                                                   # tank plate
    top = zf + pr["H_mm"]
    m.box(-420, -150, zp + 10, -120, 150, top)                                                      # pump + head + pressure switch
    m.box(80, -110, zp + 10, 430, 110, zp + 260)                                                    # motor 3 kW
    m.box(-120, 160, zp + 10, 80, 200, zp + 300)                                                    # belt guard
    m.meta.update({"product": "VC20", "feet_bottom": zf, "top": top, "cg_z": zf + pr["cg_mm"], "feet": (2 * fx, 2 * fy),
                   "tank_axis_z": zt})
    return m


def gen_carrier_rb100(p):
    pr = p["S"]["products"]["RB100"]
    m = gen_carrier(p, "carrier_rb100")
    z0 = m.meta["deck_top"]
    fx, fy = pr["feet_x_mm"] / 2, pr["feet_y_mm"] / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl((sx * fx, sy * fy, z0 + 20), "z", 10, 40, 12)                                     # locating pins D20
    zb = z0 + p["rb_spacer"]
    L, W = pr["L_mm"], pr["W_mm"]
    for s in (-1, 1):
        m.box(-L / 2, s * W / 2 - 40 * (s > 0), zb, L / 2, s * W / 2 + 40 * (s < 0), zb + 60)      # base frame long sides
        m.box(s * L / 2 - 40 * (s > 0), -W / 2 + 40, zb, s * L / 2 + 40 * (s < 0), W / 2 - 40, zb + 60)
    top = zb + pr["H_mm"]
    m.box(-400, -150, zb + 60, 50, 150, top)                                                         # blower + silencers
    m.box(120, -110, zb + 60, 440, 110, zb + 60 + 230)                                               # motor
    m.meta.update({"product": "RB100", "base_bottom": zb, "top": top, "cg_z": zb + pr["cg_mm"], "feet": (2 * fx, 2 * fy)})
    return m


# ============================================================================ main line, transfer, stopper (origin: module centre on the floor)
def main_line(m, p, x0, x1, y=0.0, along="x"):
    """Twin-strand accumulation chain between x0..x1 (along x) at the line y; top = p['top']."""
    t = p["top"]
    g = p["gauge"]
    for s in (-1, 1):
        if along == "x":
            m.box(x0, y + s * g / 2 - 20, t - 30, x1, y + s * g / 2 + 20, t)                     # chain + rail
            m.box(x0, y + s * (g / 2 + 70) - 25, t - 140, x1, y + s * (g / 2 + 70) + 25, t + 25)  # side frame + guide
        else:
            m.box(y + s * g / 2 - 20, x0, t - 30, y + s * g / 2 + 20, x1, t)
            m.box(y + s * (g / 2 + 70) - 25, x0, t - 140, y + s * (g / 2 + 70) + 25, x1, t + 25)
    n = max(1, int(abs(x1 - x0) // 1000))
    for k in range(n + 1):
        xx = x0 + (x1 - x0) * k / n
        for s in (-1, 1):
            if along == "x":
                m.box(xx - 30, y + s * (g / 2 + 70) - 30, 0, xx + 30, y + s * (g / 2 + 70) + 30, t - 140)
            else:
                m.box(y + s * (g / 2 + 70) - 30, xx - 30, 0, y + s * (g / 2 + 70) + 30, xx + 30, t - 140)


def lift_transfer(m, p, x, y=0.0, up=False):
    """3 transverse belts between the strands (lift 30); belts run along y."""
    t = p["top"]
    zt = t + (p["lift_dz"] - 5 if up else -5)
    for dx in (-500, 0, 500):
        m.box(x + dx - 30, y - p["gauge"] / 2 + 30, zt - 15, x + dx + 30, y + p["gauge"] / 2 - 30, zt)
    m.box(x - 560, y - 200, t - 130, x + 560, y + 200, t - 60)                                       # lift frame + eccentric
    m.box(x + 600, y - 120, t - 260, x + 820, y + 120, t - 90)                                       # drive


def stopper(m, p, x, y=0.0):
    t = p["top"]
    m.box(x - 40, y - 60, t - 120, x + 40, y + 60, t + 40)                                           # damped stopper (raised)
    m.cyl((x - 120, y, t - 20), "x", 18, 160, 12)                                                    # hydraulic shock absorber


def gen_main_line_module(p):
    m = SM("main_line_module")
    main_line(m, p, -1000, 1000)
    lift_transfer(m, p, -300)
    stopper(m, p, 800)
    m.box(-1000, -p["gauge"] / 2 - 160, p["top"] - 330, -700, -p["gauge"] / 2 - 40, p["top"] - 150)   # section drive (shown)
    m.meta = {"top": p["top"], "gauge": p["gauge"], "length": 2000.0, "lift": p["lift_dz"]}
    return m


# ============================================================================ spurs
def gen_assy_spur(p, carrier_top=500.0, name="assy_spur"):
    """Main line along x at y = 0; spur along -y; work position on the lift table (pit) at the spur end."""
    m = SM(name)
    main_line(m, p, -1300, 1300)
    lift_transfer(m, p, 0.0, up=True)
    y0, y1 = -(p["gauge"] / 2 + 250), -(p["gauge"] / 2 + 250 + p["spur_len"])
    for s in (-1, 1):                                                                              # spur strands along y at x = +-600
        m.box(s * p["spur_gauge"] / 2 - 20, y1, p["top"] - 30, s * p["spur_gauge"] / 2 + 20, y0, p["top"])
        for yy in (y0, (y0 + y1) / 2, y1):
            m.box(s * p["spur_gauge"] / 2 - 30, yy - 30, 0, s * p["spur_gauge"] / 2 + 30, yy + 30, p["top"] - 30)
    yc = y1 - 150 - p["cW"] / 2 - 100                                                               # work position centre
    # pit (floor at -250) + walls
    px, py = 1100.0, 600.0
    m.box(-px, yc - py, -p["pit"] - 20, px, yc + py, -p["pit"])
    for s in (-1, 1):
        m.box(-px - 20, yc + s * py - (20 if s > 0 else 0), -p["pit"], px + 20, yc + s * py + (20 if s < 0 else 0), 0)
        m.box(s * px - (20 if s > 0 else 0), yc - py, -p["pit"], s * px + (20 if s < 0 else 0), yc + py, 0)
    # scissor lift table: platform top = carrier top - carrier height
    tt = carrier_top - p["c_h"]
    zb = -p["pit"]
    m.box(-950, yc - 450, tt - 40, 950, yc + 450, tt)                                               # platform 1900 x 900
    for s in (-1, 1):
        m.bar((-800, yc + s * 380, zb + 40), (800, yc + s * 380, tt - 60), 50, 50)                  # scissor arms
        m.bar((800, yc + s * 380, zb + 40), (-800, yc + s * 380, tt - 60), 50, 50)
    m.box(-950, yc - 450, zb, 950, yc + 450, zb + 40)                                               # base frame
    for x in (-p["bush_x"], p["bush_x"]):
        m.cyl((x, yc, tt + 20), "z", 15, 40, 12)                                                    # lift-and-locate pins
    # carrier on the table (envelope) + operator floor + balancer
    m.box(-p["cL"] / 2, yc - p["cW"] / 2, carrier_top - p["c_h"], p["cL"] / 2, yc + p["cW"] / 2, carrier_top)
    m.box(-1200, yc - py - 1600, 0, 1200, yc - py - 20, 15)                                         # operator floor area
    bx = 1300.0
    m.cyl((bx + 200, yc - py - 400, 1500), "z", 100, 3000, 20)                                      # balancer column (shared by 2 spurs)
    m.box(bx + 200 - 2600, yc - py - 460, 2900, bx + 200, yc - py - 340, 3000)                      # arm 2600 towards both spurs
    m.box(-150, yc - py - 480, 2400, 50, yc - py - 320, 2900)                                       # balancer unit + hook
    m.meta = {"carrier_top": carrier_top, "table_top": tt, "pit_floor": -p["pit"], "work_y": yc, "spur": (y0, y1),
              "table_closed_ok": tt >= -p["pit"] + p["table_closed"] - 1e-6}
    return m


def gen_test_spur(p):
    m = SM("test_spur")
    main_line(m, p, -1300, 1300)
    lift_transfer(m, p, 0.0, up=True)
    y0, y1 = -(p["gauge"] / 2 + 250), -(p["gauge"] / 2 + 250 + p["spur_len"])
    for s in (-1, 1):
        m.box(s * p["spur_gauge"] / 2 - 20, y1 - 1200, p["top"] - 30, s * p["spur_gauge"] / 2 + 20, y0, p["top"])
        for yy in (y0, (y0 + y1) / 2, y1, y1 - 1200):
            m.box(s * p["spur_gauge"] / 2 - 30, yy - 30, 0, s * p["spur_gauge"] / 2 + 30, yy + 30, p["top"] - 30)
    yc = y1 - 600
    ct = p["top"] + p["c_h"]
    m.box(-p["cL"] / 2, yc - p["cW"] / 2, p["top"], p["cL"] / 2, yc + p["cW"] / 2, ct)               # carrier
    m.box(-450, yc - 200, ct, 450, yc + 200, ct + 700)                                               # product envelope (VC20 / RB)
    hx, hy, hz = p["hood"]
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box(sx * hx / 2 - 30, yc + sy * hy / 2 - 30, 0, sx * hx / 2 + 30, yc + sy * hy / 2 + 30, p["top"] + hz)
    m.box(-hx / 2, yc - hy / 2, p["top"] + hz - 40, hx / 2, yc + hy / 2, p["top"] + hz)              # hood roof (sound hood)
    m.box(-hx / 2, yc - hy / 2 - 30, p["top"] + 300, hx / 2, yc - hy / 2, p["top"] + hz - 40)        # rear wall
    m.box(hx / 2 + 50, yc - 300, ct + 100, hx / 2 + 450, yc + 300, ct + 160)                         # docking slide rail
    m.box(hx / 2 + 60, yc - 120, ct + 160, hx / 2 + 300, yc + 120, ct + 300)                         # slide carriage
    m.cyl((hx / 2 + 20, yc - 60, ct + 230), "x", 20, 120, 12)                                        # air coupling DN15
    m.box(hx / 2 - 20, yc + 30, ct + 200, hx / 2 + 60, yc + 110, ct + 270)                           # CEE plug 16 A
    for x in (-p["bush_x"], p["bush_x"]):
        m.cyl((x, yc, p["top"] - 20), "z", 15, 40, 12)                                               # lift-and-locate pins
    m.meta = {"work_y": yc, "hood": p["hood"]}
    return m


def gen_load_station(p):
    m = SM("load_station")
    main_line(m, p, -2000, 2000)
    stopper(m, p, 1000)
    ct = p["top"] + p["c_h"]
    m.box(-p["cL"] / 2, -p["cW"] / 2, p["top"], p["cL"] / 2, p["cW"] / 2, ct)                        # carrier at the load position
    rl, rw, rh = p["rack"]
    racks = []
    r = p["tank_D"] / 2
    for i in range(p["rack_places"]):
        x = -2500 + i * (rl + 300) - (p["rack_places"] - 1) * (rl + 300) / 2 + 2500
        y = -(p["gauge"] / 2 + 900 + rw / 2)
        for sx in (-1, 1):
            for sy in (-1, 1):
                m.box(x + sx * rl / 2 - 30 * (sx > 0), y + sy * rw / 2 - 30 * (sy > 0), 0, x + sx * rl / 2 + 30 * (sx < 0), y + sy * rw / 2 + 30 * (sy < 0), rh)
        m.box(x - rl / 2, y - rw / 2, 100, x + rl / 2, y + rw / 2, 140)                                # rack bottom
        m.box(x - rl / 2, y - rw / 2, rh / 2, x + rl / 2, y + rw / 2, rh / 2 + 40)                     # rack middle shelf
        tanks = 0
        if i > 0:                                                                                     # place 0 = empty rack return
            for lev in (0, 1):
                for sy in (-1, 1):
                    m.cyl((x, y + sy * (r + 15), 140 + r + lev * (rh / 2 - 100)), "x", r, p["tank_L"], 20)
                    tanks += 1
        racks.append({"x": x, "y": y, "tanks": tanks})
    jx, jy = 2400.0, -(p["gauge"] / 2 + 500)
    m.cyl((jx, jy, 2000), "z", 110, 4000, 20)                                                        # jib column
    m.box(jx - p["jib_R"], jy - 70, 3700, jx, jy + 70, 3850)                                         # arm 3500
    m.box(jx - 1900, jy - 90, 3400, jx - 1700, jy + 90, 3700)                                        # trolley + hoist
    m.box(jx - 2050, jy - 300, 1300, jx - 1550, jy + 300, 1380)                                      # vacuum lifter beam
    for s in (-1, 1):
        m.cyl((jx - 1800 + s * 180, jy, 1250), "z", 90, 60, 16)                                      # suction pads
    m.meta = {"racks": racks, "jib_R": p["jib_R"], "carrier_top": ct}
    return m


# ============================================================================ loop layout
def s_to_xy(p, s):
    """Loop path: side 1 y = 0, x 0 -> Lx; short side x = Lx; side 2 y = Ly, x Lx -> 0; short side x = 0."""
    Lx, Ly = p["Lx"], p["Ly"]
    P = 2 * (Lx + Ly)
    s = s % P
    if s <= Lx:
        return s, 0.0, 0.0, 1
    if s <= Lx + Ly:
        return Lx, s - Lx, 90.0, 0
    if s <= 2 * Lx + Ly:
        return Lx - (s - Lx - Ly), Ly, 180.0, 2
    return 0.0, Ly - (s - 2 * Lx - Ly), 270.0, 0


def loop_positions(p):
    """Group positions along the loop from the F4.4 segment lengths (seg_m)."""
    order = ["LOAD", "ASSY", "TEST", "PAINT", "PACK", "UNLOAD"]
    pos = {}
    s = p["s_load"]
    for i, k in enumerate(order):
        pos[k] = s
        nxt = order[(i + 1) % 6]
        s += p["seg"]["%s-%s" % (k, nxt)] * 1000.0
    return pos


def gen_loop(p):
    m = SM("loop_layout")
    Lx, Ly = p["Lx"], p["Ly"]
    g = p["gauge"]
    t = p["top"]
    # main line as 4 straights (simplified rails) + 4 corner units
    for (x0, y0, x1, y1) in ((0, 0, Lx, 0), (Lx, 0, Lx, Ly), (Lx, Ly, 0, Ly), (0, Ly, 0, 0)):
        if y0 == y1:
            for s in (-1, 1):
                m.box(min(x0, x1) + 600, y0 + s * g / 2 - 20, t - 30, max(x0, x1) - 600, y0 + s * g / 2 + 20, t)
        else:
            for s in (-1, 1):
                m.box(x0 + s * g / 2 - 20, min(y0, y1) + 600, t - 30, x0 + s * g / 2 + 20, max(y0, y1) - 600, t)
    corners = [(0.0, 0.0), (Lx, 0.0), (Lx, Ly), (0.0, Ly)]
    for (cx, cy) in corners:
        m.cyl((cx, cy, t - 60), "z", 600, 120, 24)                                                   # corner unit (turntable)
    pos = loop_positions(p)
    spurs = []

    def spur(s, side, kind):
        x, y, ang, sd = s_to_xy(p, s)
        depth = 4200.0 if kind in ("ASSY", "TEST") else 3000.0
        dy = -1 if side < 0 else 1
        y0 = y + dy * (g / 2 + 100)
        y1 = y0 + dy * depth
        m.box(x - 450, min(y0, y1), t - 30, x + 450, max(y0, y1), t)
        m.box(x - 950, min(y1, y1 - dy * 900), 0 if kind == "ASSY" else t - 40, x + 950, max(y1, y1 - dy * 900), t)   # work position
        spurs.append({"kind": kind, "s": s, "x": x, "y": y, "side": dy, "work_y": y1 - dy * 450})
    a0 = pos["ASSY"] - 4 * 1300.0
    for i in range(p["stations"]["ASSY"]):
        spur(a0 + i * 1300.0, -1 if i % 2 == 0 else 1, "ASSY")
    t0 = pos["TEST"] - 3 * 1300.0
    for i in range(p["stations"]["TEST"]):
        spur(t0 + i * 1300.0, -1 if i % 2 == 0 else 1, "TEST")
    spur(pos["PAINT"], 1, "PAINT")
    for i in range(p["stations"]["PACK"]):
        spur(pos["PACK"] + (i - 0.5) * 2600.0, 1, "PACK")
    # LOAD / UNLOAD on the line (marker blocks outside), drive sections every 25 m
    for k, side in (("LOAD", -1), ("UNLOAD", 1)):
        x, y, _, _ = s_to_xy(p, pos[k])
        m.box(x - 900, y + side * (g / 2 + 300), 0, x + 900, y + side * (g / 2 + 1500), 1200)
    drives = []
    for k in range(p["sections"]):
        s = k * p["loop_m"] * 1000 / p["sections"] + 1000
        x, y, _, _ = s_to_xy(p, s)
        m.box(x - 150, y - g / 2 - 260, t - 330, x + 150, y - g / 2 - 60, t - 150)
        drives.append(s)
    # carriers: one at LOAD, one per spur (work position), the rest on the line in front of TEST / PAINT
    cars = []
    cm = Mesh("loop_carriers")
    ct = t + p["c_h"]

    def car(x, y, along_x=True, ztop=ct):
        L, W = (p["cL"], p["cW"]) if along_x else (p["cW"], p["cL"])
        cm.box(x - L / 2, y - W / 2, ztop - p["c_h"], x + L / 2, y + W / 2, ztop)
        cars.append((x, y))
    x, y, ang, _ = s_to_xy(p, pos["LOAD"])
    car(x, y)
    for sp in spurs:
        car(sp["x"], sp["work_y"])
    k = 0
    s = pos["TEST"] - 4 * 1300.0 - p["pitch"]
    while len(cars) < p["carriers"]:
        x, y, ang, sd = s_to_xy(p, s - k * p["pitch"])
        car(x, y, along_x=(ang in (0.0, 180.0)))
        k += 1
    perim = 2 * (Lx + Ly)
    m.meta = {"perimeter": perim, "spurs": spurs, "corners": corners, "drives": drives, "carriers": cars, "pos": pos}
    return m, cm


# ============================================================================ drawings
def sheet_save(sh, path):
    sh.save(path)
    s = open(path, encoding="utf-8").read()
    s = s.replace("Combined FMS VC20 + RB - item F3 AS/RS", "Combined FMS VC20 + RB - item F4.4 assembly line")
    s = s.replace(">asrs_3d.py<", ">asm_3d.py<")
    s = s.replace("Generated from design_result.json (F3).", "Generated from assembly_specs.json (F4.4).")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(s)


notes = S3.notes


def draw_D21(p, path, vc, rb):
    sh = Sheet("F4-ASM-D21", "Carrier 1800 x 800 with VC20 and RB adapters", "1:20 / 1:25")
    L, W, g = p["cL"], p["cW"], p["gauge"]
    # top view
    T = View(115, 70, 20, "x", "y")
    sh.text(30, 20, "TOP VIEW carrier 1:20 (travel = x, 1800 leading)", 3.0, bold=True)
    T.rect(sh, -L / 2, -W / 2, L / 2, W / 2, 0.35, "#eef3fa")
    for s in (-1, 1):
        T.rect(sh, -L / 2, s * g / 2 - 20, L / 2, s * g / 2 + 20, 0.3, "#9db5d8")
        T.rect(sh, s * L / 2, -150, s * (L / 2 + p["bumper"]), 150, 0.3, "#ffcc66")
    for x in (-p["bush_x"], p["bush_x"]):
        cx, cy = T.P(x, 0)
        sh.circle(cx, cy, 22 / 20, 0.3, "#ffffff")
    fx, fy = vc.meta["feet"]
    for sx in (-1, 1):
        for sy in (-1, 1):
            T.rect(sh, sx * fx / 2 - 60, sy * fy / 2 - 60, sx * fx / 2 + 60, sy * fy / 2 + 60, 0.25, "#c6e0b4")
    sh.dim_h(T.X(-L / 2), T.X(L / 2), T.Y(-W / 2), T.Y(-W / 2) + 10, "%d" % L)
    sh.dim_v(T.Y(-W / 2), T.Y(W / 2), T.X(L / 2), T.X(L / 2) + 12, "%d" % W)
    sh.dim_v(T.Y(-g / 2), T.Y(g / 2), T.X(-L / 2), T.X(-L / 2) - 8, "gauge %d" % g, 2.2)
    sh.dim_h(T.X(-fx / 2), T.X(fx / 2), T.Y(fy / 2 + 60), T.Y(W / 2) - 8, "VC20 feet %d" % fx, 2.2)
    sh.text(T.X(0), T.Y(-W / 2) + 24, "green = VC20 saddles; blue = RHS 80 x 40 on the chain strands; yellow = PU bumpers %d" % p["bumper"], 2.2, "middle")
    # side views
    E1 = View(75, 238, 25, "x", "z")
    sh.text(30, 125, "SIDE VIEW carrier + VC20 1:25", 3.0, bold=True)
    E1.rect(sh, -L / 2, 0, L / 2, p["c_h"], 0.3, "#eef3fa")
    zf = vc.meta["feet_bottom"]
    for sx in (-1, 1):
        E1.rect(sh, sx * fx / 2 - 60, p["c_h"], sx * fx / 2 + 60, zf, 0.25, "#c6e0b4")
    E1.rect(sh, -p["tank_L"] / 2, zf + 60, p["tank_L"] / 2, zf + 60 + p["tank_D"], 0.3, "#dddddd")
    E1.rect(sh, -420, zf + 60 + p["tank_D"] + 10, -120, vc.meta["top"], 0.3, "#f8cbad")
    E1.rect(sh, 80, zf + 60 + p["tank_D"] + 10, 430, zf + 60 + p["tank_D"] + 260, 0.3, "#f8cbad")
    cx, cy = E1.P(0, vc.meta["cg_z"])
    sh.circle(cx, cy, 1.6, 0.3, "#c00000")
    sh.text(cx + 3, cy + 1, "CG %d above chain top" % vc.meta["cg_z"], 2.2, col="#c00000")
    sh.dim_v(E1.Y(0), E1.Y(vc.meta["top"]), E1.X(L / 2), E1.X(L / 2) + 8, "%d" % vc.meta["top"], 2.2)
    E2 = View(180, 238, 25, "x", "z")
    sh.text(140, 125, "SIDE VIEW carrier + RB100 1:25", 3.0, bold=True)
    E2.rect(sh, -L / 2, 0, L / 2, p["c_h"], 0.3, "#eef3fa")
    zb = rb.meta["base_bottom"]
    E2.rect(sh, -450, zb, 450, zb + 60, 0.3, "#c6e0b4")
    E2.rect(sh, -400, zb + 60, 50, rb.meta["top"], 0.3, "#f8cbad")
    E2.rect(sh, 120, zb + 60, 440, zb + 290, 0.3, "#f8cbad")
    cx, cy = E2.P(0, rb.meta["cg_z"])
    sh.circle(cx, cy, 1.6, 0.3, "#c00000")
    sh.text(cx + 3, cy + 1, "CG %d" % rb.meta["cg_z"], 2.2, col="#c00000")
    sh.dim_v(E2.Y(0), E2.Y(rb.meta["top"]), E2.X(L / 2), E2.X(L / 2) + 8, "%d" % rb.meta["top"], 2.2)
    rows = [["product", "m kg", "a_tip long.", "a_tip lat.", "a_slide", "bumper a", "E-stop"]]
    for k in ("VC20", "RB50", "RB100", "RB150"):
        r = rep_rows(p, k)
        if r:
            rows.append([k, r[0], r[4], r[5], r[6], r[7].split("/")[-1].strip(), r[8]])
    sh.table(240, 24, rows, [22, 16, 22, 22, 20, 20, 18], 4.6, 2.2)
    notes(sh, 240, 24 + 4.6 * len(rows) + 6, [
        "Accelerations in m/s2 from assembly_report.md A (asm_line.py).",
        "Carrier: 2 RHS 80 x 40 x 3 at gauge %d, 5 cross members, deck 8 mm, height %d." % (g, p["c_h"]),
        "2 locating bushes at x = +-%d for the lift-and-locate pins (+-0.5 mm)." % p["bush_x"],
        "PU bumpers stroke %d mm (10 mm gave 4.0 m/s2 > sliding 3.9 m/s2)." % p["bumper"],
        "Adapter VC20: 4 rubber-lined saddles (h %d) under the tank feet." % p["saddle_h"],
        "Adapter RB: 4 pins D20 for the base frame; changeover 2 min, tool-free."], 2.2)
    sheet_save(sh, path)


def draw_D22(p, path, ml):
    sh = Sheet("F4-ASM-D22", "Main line: twin-strand accumulation chain, lift-transfer, stopper", "1:10 / 1:20")
    g, t = p["gauge"], p["top"]
    X = View(110, 150, 10, "y", "z")
    sh.text(30, 20, "SECTION across the main line 1:10 (carrier on the chain)", 3.0, bold=True)
    for s in (-1, 1):
        X.rect(sh, s * g / 2 - 20, t - 30, s * g / 2 + 20, t, 0.3, "#999999")
        X.rect(sh, s * (g / 2 + 70) - 25, t - 140, s * (g / 2 + 70) + 25, t + 25, 0.3, "#dde7f3")
        X.rect(sh, s * g / 2 - 20, t, s * g / 2 + 20, t + p["rhs_h"], 0.3, "#9db5d8")
    X.rect(sh, -p["cW"] / 2, t + p["rhs_h"], p["cW"] / 2, t + p["c_h"], 0.3, "#eef3fa")
    X.rect(sh, -g / 2 + 30, t - 20, g / 2 - 30, t - 5, 0.3, "#c6e0b4")
    sh.text(X.X(0), X.Y(t - 20) + 4, "lift-transfer belts (down: 5 below chain top, up: +%d)" % p["lift_dz"], 2.2, "middle")
    sh.dim_v(X.Y(0), X.Y(t), X.X(-g / 2 - 130), X.X(-g / 2 - 130) - 6, "top %d" % t, 2.2)
    sh.dim_h(X.X(-g / 2), X.X(g / 2), X.Y(t + p["c_h"]), X.Y(t + p["c_h"]) - 8, "gauge %d" % g, 2.2)
    sh.line(X.X(-g / 2 - 200), X.Y(0), X.X(g / 2 + 200), X.Y(0), 0.4)
    # plan of the 2 m module
    P = View(95, 248, 20, "x", "y")
    sh.text(30, 205, "PLAN 2 m module 1:20: transfer at x = -300, stopper at x = +800", 3.0, bold=True)
    for s in (-1, 1):
        P.rect(sh, -1000, s * g / 2 - 20, 1000, s * g / 2 + 20, 0.3, "#999999")
    for dx in (-500, 0, 500):
        P.rect(sh, -300 + dx - 30, -g / 2 + 30, -300 + dx + 30, g / 2 - 30, 0.3, "#c6e0b4")
    P.rect(sh, 760, -60, 840, 60, 0.4, "#c00000")
    sh.text(P.X(800), P.Y(-g / 2 - 60) + 3, "damped stopper", 2.2, "middle")
    sh.text(P.X(-300), P.Y(-g / 2 - 60) + 3, "lift-transfer 90 deg", 2.2, "middle")
    rC = [l for l in p["rep"].split("## C")[1].split("## D")[0].splitlines() if l.strip()][:3]
    rD = [l for l in p["rep"].split("## D")[1].split("## E")[0].splitlines() if l.strip()][:1]
    import textwrap
    lines = ["Accumulation principle: the carriers ride on free-turning rollers of the chain; a stopped",
             "carrier lets the chain run under it with a small back pressure (mu_acc 0.05) -> queues",
             "wait ON the line without stopping the drive.", ""]
    for l in rC + rD:
        lines += textwrap.wrap(l.replace("**", ""), 92)
    notes(sh, 230, 26, lines, 2.2, 4.4)
    notes(sh, 230, 150, ["Drive sections: %d x 25 m, %.2f kW each (asm_line.py C)." % (p["sections"], p["sec_kW"]),
                         "Stopper class 1500 N static / 10 J (damped): line pressure of the largest queue + impact.",
                         "Lift-transfer: 3 belts at 90 deg, stroke %d mm, cycle lift 2 s + spur 10 s + lower 2 s." % p["lift_dz"],
                         "Side guides 25 mm above the chain top keep the carrier in line."], 2.2)
    sheet_save(sh, path)


def draw_D23(p, path, hi, lo):
    sh = Sheet("F4-ASM-D23", "ASSY spur: lift table in a 250 mm pit, balancer", "1:25")
    yc = hi.meta["work_y"]
    E = View(135 - yc / 25.0, 215, 25, "y", "z")
    sh.text(30, 20, "ELEVATION along the spur 1:25 (main line right, operator left)", 3.0, bold=True)
    sh.line(E.X(yc - 2500), E.Y(0), E.X(800), E.Y(0), 0.5)
    E.rect(sh, yc - 600, -p["pit"], yc + 600, 0, 0.3, "#eeeeee")
    sh.text(E.X(yc), E.Y(-p["pit"]) - 1.5, "pit 250", 2.2, "middle")
    for m_, col, lab in ((lo, "#dde7f3", "carrier top %d (low)"), (hi, "#c6e0b4", "carrier top %d")):
        ct = m_.meta["carrier_top"]
        E.rect(sh, yc - p["cW"] / 2, ct - p["c_h"], yc + p["cW"] / 2, ct, 0.3, col)
        sh.text(E.X(yc - p["cW"] / 2) - 2, E.Y(ct) + 1, lab % ct, 2.2, "end")
    E.rect(sh, yc - 400, p["lift"][1] - p["c_h"], yc + 400, p["lift"][1], 0.2, "none", dash="1.5 1")
    sh.text(E.X(yc - p["cW"] / 2) - 2, E.Y(p["lift"][1]) + 1, "carrier top %d (high)" % p["lift"][1], 2.2, "end")
    y_s0, y_s1 = hi.meta["spur"]
    E.rect(sh, y_s1, p["top"] - 30, y_s0, p["top"], 0.3, "#999999")
    sh.text(E.X((y_s0 + y_s1) / 2), E.Y(p["top"] - 30) + 4, "spur 2 m, top %d" % p["top"], 2.2, "middle")
    ox = yc - 1150
    for who, el in p["elbow"].items():
        h = el + p["work_off"]
        sh.line(E.X(ox - 500), E.Y(h), E.X(yc + 400), E.Y(h), 0.25, "2 1", "#c00000")
        sh.text(E.X(ox - 500), E.Y(h) - 1, "%s work height %d (elbow %d - 100)" % (who, h, el), 2.2, col="#c00000")
    vc = p["S"]["products"]["VC20"]
    top_task = [t for t in vc["tasks_mm"] if "top" in t[0]][0]
    for who, el in p["elbow"].items():
        need = el + p["work_off"] - top_task[1]
        sh.text(E.X(ox - 500), E.Y(-p["pit"] - 120) + (0 if "P5" in who else 4.5),
                "VC20 top fittings (%d above the carrier): %s needs carrier top %d -> %s" % (
                    top_task[1], who, need, "within the table range" if p["lift"][0] <= need <= p["lift"][1] else "reach-up %d mm" % (p["lift"][0] - need)), 2.2)
    sh.dim_v(E.Y(p["lift"][0]), E.Y(p["lift"][1]), E.X(yc - 1000), E.X(yc - 1000) - 8, "lift range %d..%d" % tuple(p["lift"]), 2.2)
    E.rect(sh, yc - 1800, 0, yc - 1700, 3000, 0.3, "#dddddd")
    E.rect(sh, yc - 1750, 2900, yc + 300, 3000, 0.3, "#dddddd")
    sh.text(E.X(yc - 1750), E.Y(3000) - 2, "balancer column + arm (1 per 2 spurs, %d in total)" % p["balancers"], 2.2)
    notes(sh, 240, 26, ["Ergonomics (asm_line.py B): light work = elbow - 100 mm;",
                        "P5 female elbow 960 -> 860; P95 male 1185 -> 1085 (DIN 33402 class values).",
                        "Required carrier top over all tasks: -90 .. 705 mm.",
                        "A floor table cannot go below ~350 mm -> scissor table in a 250 mm pit:",
                        "carrier top %d .. %d mm covers 25 of 27 cases;" % tuple(p["lift"]),
                        "VC20 top fittings for P5 / P50 need a short reach-up (190 / 80 mm).",
                        "Lift-and-locate pins on the table platform (+-0.5 mm) at x = +-%d." % p["bush_x"],
                        "Pit: kick plate + toe guard; table with safety edge (EN 1570-1).",
                        "Heavy line-fed parts (crankcase LI 1.50): balancer (asm_line.py G)."], 2.2)
    sheet_save(sh, path)


def draw_D24(p, path, loop):
    sh = Sheet("F4-ASM-D24", "Assembly loop plan - spurs, segments, queues, drive sections", "1:250")
    V = View(38, 120, 250, "x", "y")
    sh.text(30, 20, "PLAN loop 44 x 6 m = %d m (side 1: ASSY + TEST; side 2: PAINT, PACK, UNLOAD)" % (loop.meta["perimeter"] / 1000), 3.0, bold=True)
    Lx, Ly = p["Lx"], p["Ly"]
    sh.rect(V.X(0), V.Y(Ly), Lx / 250, Ly / 250, 0.5)
    for (cx, cy) in loop.meta["corners"]:
        x, y = V.P(cx, cy)
        sh.circle(x, y, 600 / 250, 0.3, "#ffffff")
    col = {"ASSY": "#c6e0b4", "TEST": "#f8cbad", "PAINT": "#ffe699", "PACK": "#dde7f3"}
    for sp in loop.meta["spurs"]:
        d = sp["side"]
        y0 = sp["y"] + d * (p["gauge"] / 2 + 100)
        y1 = y0 + d * (4200.0 if sp["kind"] in ("ASSY", "TEST") else 3000.0)
        V.rect(sh, sp["x"] - 450, min(y0, y1), sp["x"] + 450, max(y0, y1), 0.2, col[sp["kind"]])
    for k, sp0 in (("ASSY", -7.0), ("TEST", -7.0)):
        xs = [sp["x"] for sp in loop.meta["spurs"] if sp["kind"] == k]
        sh.text(V.X(sum(xs) / len(xs)), V.Y(sp0 * 1000) + 1, "%s x %d" % (k, len(xs)), 2.6, "middle", bold=True)
    for k in ("PAINT", "PACK"):
        xs = [sp["x"] for sp in loop.meta["spurs"] if sp["kind"] == k]
        sh.text(V.X(sum(xs) / len(xs)), V.Y(Ly + 4200) - 1, "%s x %d" % (k, len(xs)), 2.6, "middle", bold=True)
    for k in ("LOAD", "UNLOAD"):
        x, y, _, _ = s_to_xy(p, loop.meta["pos"][k])
        side = -1 if k == "LOAD" else 1
        V.rect(sh, x - 900, y + side * (p["gauge"] / 2 + 300), x + 900, y + side * (p["gauge"] / 2 + 1500), 0.3, "#eeeeee")
        sh.text(V.X(x), V.Y(y + side * 2300) + (3 if side < 0 else -1), k, 2.4, "middle", bold=True)
    for (x, y) in loop.meta["carriers"]:
        cx, cy = V.P(x, y)
        sh.circle(cx, cy, 0.9, 0.15, "#c00000")
    for s in loop.meta["drives"]:
        x, y, _, _ = s_to_xy(p, s)
        cx, cy = V.P(x, y)
        sh.rect(cx - 1.2, cy - 1.2, 2.4, 2.4, 0.2, "#000000")
    pitch = p["pitch"]
    rows = [["segment", "length m", "queue cap.", "queue (F4.1)"]]
    for key, v in p["seg"].items():
        nxt = key.split("-")[1]
        rows.append([key, "%d" % v, "%d" % int(v * 1000 // pitch), "%s" % p["qp"].get(nxt, "-")])
    sh.table(240, 160, rows, [40, 22, 24, 26], 4.4, 2.2)
    notes(sh, 30, 230, ["Red dots: the %d carriers (1 at LOAD, 1 per spur work position, the rest queuing on the line)." % len(loop.meta["carriers"]),
                        "Black squares: %d drive sections of 25 m (%.2f kW each). Circles: 4 corner units." % (p["sections"], p["sec_kW"]),
                        "Spurs alternate inside / outside on side 1 (pitch 1.3 m along the line, 2.6 m per side).",
                        "Queue capacity = segment length / carrier pitch 2 m (queues wait on the accumulation chain)."], 2.2)
    sheet_save(sh, path)


def draw_D25(p, path, ls, ts):
    sh = Sheet("F4-ASM-D25", "Load station + tank rack; test-bench docking detail", "1:50 / 1:20")
    V = View(120, 92, 50, "x", "y")
    sh.text(30, 20, "PLAN load station 1:50 (%d rack places, rack = 4 tanks 2 x 2)" % p["rack_places"], 3.0, bold=True)
    g = p["gauge"]
    V.rect(sh, -2000, -g / 2 - 70, 2000, g / 2 + 70, 0.3, "#dde7f3")
    V.rect(sh, -p["cL"] / 2, -p["cW"] / 2, p["cL"] / 2, p["cW"] / 2, 0.3, "#eef3fa")
    rl, rw, rh = p["rack"]
    for i, r in enumerate(ls.meta["racks"]):
        V.rect(sh, r["x"] - rl / 2, r["y"] - rw / 2, r["x"] + rl / 2, r["y"] + rw / 2, 0.3, "#ffe699" if r["tanks"] else "#ffffff")
        sh.text(V.X(r["x"]), V.Y(r["y"]) + 1, "%d tanks" % r["tanks"] if r["tanks"] else "empty rack", 2.2, "middle")
    jx, jy = 2400.0, -(g / 2 + 500)
    cx, cy = V.P(jx, jy)
    sh.circle(cx, cy, p["jib_R"] / 50, 0.2, "none")
    sh.circle(cx, cy, 2.2, 0.3, "#999999")
    sh.text(cx, cy - p["jib_R"] / 50 - 1.5, "jib R %d + vacuum tank lifter (SWL 125 kg)" % p["jib_R"], 2.2, "middle")
    T = View(310, 230, 20, "y", "z")
    sh.text(250, 110, "DETAIL test-bench docking 1:20 (elevation)", 3.0, bold=True)
    hx, hy, hz = p["hood"]
    ct = p["top"] + p["c_h"]
    T.rect(sh, -hy / 2, 0, hy / 2, p["top"] + hz, 0.3, "none")
    T.rect(sh, -p["cW"] / 2, p["top"], p["cW"] / 2, ct, 0.3, "#eef3fa")
    T.rect(sh, -200, ct, 200, ct + 700, 0.3, "#f8cbad")
    T.rect(sh, hy / 2 + 50, ct + 100, hy / 2 + 450, ct + 160, 0.3, "#dddddd")
    T.rect(sh, hy / 2 + 60, ct + 160, hy / 2 + 300, ct + 300, 0.3, "#c6e0b4")
    sh.text(T.X(hy / 2 + 180), T.Y(ct + 320) - 1, "docking slide", 2.2, "middle")
    sh.text(T.X(0), T.Y(p["top"] + hz) - 2, "sound hood (ISO 2151)", 2.2, "middle")
    import textwrap
    lines = []
    for t in p["S"]["test_dock"]:
        lines += textwrap.wrap("- " + t, 70)
    notes(sh, 30, 212, lines, 2.1, 4.2)
    fd = rep_line(p, "Tank rack")
    lines2 = textwrap.wrap(fd.replace("**", ""), 70)
    notes(sh, 30, 190, lines2, 2.1, 4.2)
    sheet_save(sh, path)


# ============================================================================ dimension rows
def dim_rows(p, vc, rb, loop, hi, lo):
    return [[ROW_PREFIX + "carrier", "L x W / gauge (RHS 80 x 40)", "%d x %d / %d" % (p["cL"], p["cW"], p["gauge"]), "+-2", "assembly_specs"],
            [ROW_PREFIX + "carrier", "height chain top -> deck top", p["c_h"], "+-1", "asm_3d"],
            [ROW_PREFIX + "carrier", "locating bushes x", "+-%d" % p["bush_x"], "+-0.2", "asm_3d"],
            [ROW_PREFIX + "carrier", "PU bumper stroke", p["bumper"], "-", "asm_line A"],
            [ROW_PREFIX + "carrier", "VC20 feet / CG / top above chain top", "%d x %d / %d / %d" % (vc.meta["feet"][0], vc.meta["feet"][1], vc.meta["cg_z"], vc.meta["top"]), "-", "assembly_specs"],
            [ROW_PREFIX + "carrier", "RB100 pins / CG / top above chain top", "%d x %d / %d / %d" % (rb.meta["feet"][0], rb.meta["feet"][1], rb.meta["cg_z"], rb.meta["top"]), "+-0.5 pins", "assembly_specs"],
            [ROW_PREFIX + "main line", "chain top", p["top"], "+-2", "assembly_specs"],
            [ROW_PREFIX + "main line", "lift-transfer stroke", p["lift_dz"], "+-1", "asm_3d"],
            [ROW_PREFIX + "spur", "spur track / strands x", "%d / +-%d" % (p["spur_len"], p["spur_gauge"] / 2), "+-2", "asm_3d"],
            [ROW_PREFIX + "spur", "lift table carrier top range", "%d .. %d" % tuple(p["lift"]), "-", "asm_line B"],
            [ROW_PREFIX + "spur", "pit depth", p["pit"], "+-5", "asm_line B"],
            [ROW_PREFIX + "loop", "rectangle / perimeter", "%d x %d / %d" % (p["Lx"], p["Ly"], loop.meta["perimeter"]), "-", "asm_3d"],
            [ROW_PREFIX + "loop", "spur pitch along the line (alternating)", 1300, "+-50", "asm_3d"],
            [ROW_PREFIX + "load station", "tank rack L x W x H / places", "%d x %d x %d / %d" % (p["rack"] + (p["rack_places"],)), "-", "assembly_specs"],
            [ROW_PREFIX + "load station", "jib radius", p["jib_R"], "-", "asm_3d"],
            [ROW_PREFIX + "test spur", "hood L x W x H", "%d x %d x %d" % p["hood"], "-", "asm_3d"]]


def append_dims(p, vc, rb, loop, hi, lo):
    path = os.path.join(DRW, "dimension_table.csv")
    with open(path, encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    keep = [r for r in rows if not (r and r[0].startswith(ROW_PREFIX))]
    new = dim_rows(p, vc, rb, loop, hi, lo)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        csv.writer(fh).writerows(keep + new)
    return len(keep) - 1, len(new)


# ============================================================================ run / selftest
def build_all(p):
    loop, cars = gen_loop(p)
    return {"carrier": (gen_carrier(p), None), "carrier_vc20": (gen_carrier_vc20(p), None), "carrier_rb100": (gen_carrier_rb100(p), None),
            "main_line_module": (gen_main_line_module(p), None), "assy_spur": (gen_assy_spur(p, 500.0), None),
            "assy_spur_low": (gen_assy_spur(p, p["lift"][0], "assy_spur_low"), None), "test_spur": (gen_test_spur(p), None),
            "load_station": (gen_load_station(p), None), "loop_layout": (loop, cars)}


def cmd_run():
    os.makedirs(D3A, exist_ok=True)
    os.makedirs(DRW, exist_ok=True)
    p = params()
    B = build_all(p)
    for k, (m, c) in B.items():
        full = Mesh(k).extend(m)
        if c is not None:
            full.extend(c)
        write_stl(full, os.path.join(D3A, k + ".stl"))
        with open(os.path.join(D3A, k + ".scad"), "w", encoding="utf-8") as fh:
            fh.write(scad_of(m, k, p))
    iso_preview([(B["loop_layout"][0], (150, 175, 210)), (B["loop_layout"][1], (200, 60, 60))], os.path.join(D3A, "preview_loop.svg"),
                "Assembly carrier loop (F4.4) - 100 m, 19 spurs, %d carriers" % p["carriers"])
    iso_preview([(B["assy_spur"][0], (150, 175, 210))], os.path.join(D3A, "preview_spur.svg"),
                "ASSY spur (F4.4) - transfer, spur, lift table in the pit, balancer")
    draw_D21(p, os.path.join(DRW, DRAWINGS[0] + ".svg"), B["carrier_vc20"][0], B["carrier_rb100"][0])
    draw_D22(p, os.path.join(DRW, DRAWINGS[1] + ".svg"), B["main_line_module"][0])
    draw_D23(p, os.path.join(DRW, DRAWINGS[2] + ".svg"), B["assy_spur"][0], B["assy_spur_low"][0])
    draw_D24(p, os.path.join(DRW, DRAWINGS[3] + ".svg"), B["loop_layout"][0])
    draw_D25(p, os.path.join(DRW, DRAWINGS[4] + ".svg"), B["load_station"][0], B["test_spur"][0])
    nk, nn = append_dims(p, B["carrier_vc20"][0], B["carrier_rb100"][0], B["loop_layout"][0], B["assy_spur"][0], B["assy_spur_low"][0])
    print("written: %s (%d STL + SCAD, 2 previews), %s (D21-D25), dimension table %d + %d rows; loop drawn %.1f m" % (
        D3A, len(B), DRW, nk, nn, B["loop_layout"][0].meta["perimeter"] / 1000))
    return 0


def selftest():
    ok = []

    def check(name, cond):
        ok.append(bool(cond))
        print("  [%s] %s" % ("PASS" if cond else "FAIL", name))

    p = params()
    cmd_run()
    B = build_all(p)
    good = all(read_stl(os.path.join(D3A, k + ".stl"))[0] > 0 for k in B)
    check("all %d assembly STL files readable back, triangles > 0" % len(B), good)
    check("carrier, adapters and spurs closed (every edge used an even number of times)",
          all(S3.edges_even(B[k][0]) for k in ("carrier", "carrier_vc20", "carrier_rb100", "main_line_module", "assy_spur", "test_spur", "load_station")))
    lo_, hi_ = B["carrier"][0].bbox()
    check("carrier 1800 x 800 (bbox without bumpers %.0f x %.0f), gauge %d" % (hi_[0] - lo_[0] - 2 * p["bumper"], hi_[1] - lo_[1], B["carrier"][0].meta["gauge"]),
          abs(hi_[0] - lo_[0] - 2 * p["bumper"] - 1800) < 1e-6 and abs(hi_[1] - lo_[1] - 800) < 1e-6 and B["carrier"][0].meta["gauge"] == 640)
    check("PU bumpers stroke %d mm (spec)" % p["bumper"], p["bumper"] == 20)
    ml = B["main_line_module"][0]
    zt = max(v[2] for t in ml.tris for v in t if abs(v[1]) < p["gauge"] / 2 + 21 and abs(v[1]) > p["gauge"] / 2 - 21 and v[0] < 600)
    check("main-line chain top %.0f = 500 +-2" % zt, abs(zt - 500) <= 2)
    hi, lo = B["assy_spur"][0], B["assy_spur_low"][0]
    check("lift table variants: carrier top %d / %d and range %d..%d (spec)" % (hi.meta["carrier_top"], lo.meta["carrier_top"], p["lift"][0], p["lift"][1]),
          hi.meta["carrier_top"] == 500 and lo.meta["carrier_top"] == p["lift"][0] == 100 and p["lift"][1] == 800)
    check("low variant fits the pit: table top %.0f >= pit floor + closed height %.0f" % (lo.meta["table_top"], -p["pit"] + p["table_closed"]), lo.meta["table_closed_ok"])
    vc = B["carrier_vc20"][0]
    pr = p["S"]["products"]["VC20"]
    check("VC20 on the carrier: feet %d x %d, CG %d = feet bottom + %d, height %d" % (vc.meta["feet"][0], vc.meta["feet"][1], vc.meta["cg_z"], pr["cg_mm"], pr["H_mm"]),
          vc.meta["feet"] == (pr["feet_x_mm"], pr["feet_y_mm"]) and abs(vc.meta["cg_z"] - vc.meta["feet_bottom"] - pr["cg_mm"]) < 1e-6
          and abs(vc.meta["top"] - vc.meta["feet_bottom"] - pr["H_mm"]) < 1e-6)
    rb = B["carrier_rb100"][0]
    check("RB100 on the carrier: 4 pins at %d x %d, height %d" % (rb.meta["feet"][0], rb.meta["feet"][1], p["S"]["products"]["RB100"]["H_mm"]),
          abs(rb.meta["top"] - rb.meta["base_bottom"] - p["S"]["products"]["RB100"]["H_mm"]) < 1e-6)
    loop = B["loop_layout"][0]
    per = loop.meta["perimeter"] / 1000
    check("loop drawn %.1f m within +-10 %% of %d m" % (per, p["loop_m"]), abs(per - p["loop_m"]) <= 0.1 * p["loop_m"])
    cnt = {}
    for sp in loop.meta["spurs"]:
        cnt[sp["kind"]] = cnt.get(sp["kind"], 0) + 1
    check("spurs: ASSY %d, TEST %d, PAINT %d, PACK %d (= stations of the spec)" % (cnt.get("ASSY", 0), cnt.get("TEST", 0), cnt.get("PAINT", 0), cnt.get("PACK", 0)),
          all(cnt.get(k, 0) == p["stations"][k] for k in ("ASSY", "TEST", "PAINT", "PACK")))
    side1 = all(abs(sp["y"]) < 1e-6 for sp in loop.meta["spurs"] if sp["kind"] in ("ASSY", "TEST"))
    side2 = all(abs(sp["y"] - p["Ly"]) < 1e-6 and sp["side"] == 1 for sp in loop.meta["spurs"] if sp["kind"] in ("PAINT", "PACK"))
    check("ASSY + TEST on side 1 (alternating), PAINT + PACK on side 2 (outward)", side1 and side2)
    inner_ok = all(4200 + p["gauge"] / 2 + 100 < p["Ly"] for sp in loop.meta["spurs"] if sp["side"] == 1 and sp["kind"] in ("ASSY", "TEST"))
    check("inward spurs (4.3 m + 0.9 m work) fit the 6 m loop interior", inner_ok and 4200 + p["gauge"] / 2 + 100 + 900 / 2 <= p["Ly"])
    check("carriers placed %d = spec %d" % (len(loop.meta["carriers"]), p["carriers"]), len(loop.meta["carriers"]) == p["carriers"])
    check("4 corner units and %d drive sections" % p["sections"], len(loop.meta["corners"]) == 4 and len(loop.meta["drives"]) == p["sections"])
    ls = B["load_station"][0]
    check("load station: %d rack places (spec), racks of 4 tanks (2 x 2)" % len(ls.meta["racks"]),
          len(ls.meta["racks"]) == p["rack_places"] and all(r["tanks"] in (0, 4) for r in ls.meta["racks"]))
    good = True
    for f in DRAWINGS:
        try:
            ET.parse(os.path.join(DRW, f + ".svg"))
            txt = open(os.path.join(DRW, f + ".svg"), encoding="utf-8").read()
            good &= "DESIGN - to be checked and released by the responsible engineer" in txt and "F4-ASM-D2" in txt
        except ET.ParseError:
            good = False
    check("5 drawings D21-D25 well-formed SVG with title block", good)
    good = True
    for f in os.listdir(D3A):
        if f.endswith(".scad"):
            s = open(os.path.join(D3A, f), encoding="utf-8").read()
            good &= s.count("(") == s.count(")") and s.count("[") == s.count("]") and s.count("{") == s.count("}")
    check("OpenSCAD sources balanced (%d files)" % len([f for f in os.listdir(D3A) if f.endswith(".scad")]), good)
    with open(os.path.join(DRW, "dimension_table.csv"), encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    n_old = sum(1 for r in rows[1:] if r and not r[0].startswith(ROW_PREFIX))
    n_new = sum(1 for r in rows[1:] if r and r[0].startswith(ROW_PREFIX))
    check("dimension table: earlier rows kept (%d) + assembly rows appended (%d)" % (n_old, n_new), n_old >= 66 and n_new == 16)
    try:
        ET.parse(os.path.join(D3A, "preview_loop.svg"))
        ET.parse(os.path.join(D3A, "preview_spur.svg"))
        pv = True
    except ET.ParseError:
        pv = False
    check("2 iso previews well-formed", pv)
    print("\nSELFTEST %s (%d/%d)" % ("PASS" if all(ok) else "FAIL", sum(ok), len(ok)))
    return all(ok)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sp = ap.add_subparsers(dest="cmd")
    sp.add_parser("run")
    sp.add_parser("selftest")
    a = ap.parse_args(argv)
    if a.cmd == "run":
        sys.exit(cmd_run())
    elif a.cmd == "selftest":
        sys.exit(0 if selftest() else 1)
    ap.print_help()


if __name__ == "__main__":
    main()
