#!/usr/bin/env python3
"""Final thesis item F4.3 (3D part) - 3D models (binary STL + OpenSCAD) and A3 drawings (SVG) of the load stations.

  pd_station_agv      P&D lane end: PD_end guides, 15 deg lead-in, pop-up stop + 2 PU buffers, muting light-curtain posts,
                      optical data coupler, docked AGV with roller deck (30 mm gap)
  check_station_tu1   TU1 (conv_3d.gen_tu) with portal: vertical light grids at +-(400 + w_lim), horizontal grid at h_lim,
                      4 load cells, runner sensors, ID reader on the operator side
  pick_station_z31    RCX zone Z31, operator platform 300, 2 kit-trolley places, pick-to-light bar, bin shelf, crate with
                      8 bins (2 layers x 4)
  flow_rack_lane      gravity lane 7.0 m at 5.5 %, rollers 60 at pitch 150, brake rollers every 1.05 m, separator at the exit
  flow_rack_vmc       VMC block: one lane per part type + return lane (opposite slope), lane pitch 1.05 m
  hmc_load_station    900 mm table, slewing ring, pallet 500, tombstone 400 x 400 x 800 with 2 crankcases + 6 clamps D20,
                      index motor, hydraulic coupling, jib crane 3 m, light curtain at S from the shuttle, mat, chip tray

Python 3 standard library only, offline. Helpers are imported from conv_3d.py (F4.2) and ../03_asrs/asrs_3d.py (F3).
Inputs: out/stations/stations_specs.json (load_stations.py), out/mech/module_specs.json, out/design_result.json,
out/stations/flow_lanes.csv, out/stations/reject_codes.csv. Guide: Doctor paper/61, chapter 34.
DESIGN - check and release before manufacture.

Commands
  python stations_3d.py run        out/3d/stations/*.stl + *.scad + preview, out/drw/D16..D20 *.svg, dimension rows appended
  python stations_3d.py selftest
"""

import argparse
import csv
import json
import math
import os
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "03_asrs"))
import conv_3d as C3  # noqa: E402
from asrs_3d import Mesh, write_stl, read_stl, Sheet, View, iso_preview  # noqa: E402

OUT = os.path.join(HERE, "out")
D3S = os.path.join(OUT, "3d", "stations")
DRW = os.path.join(OUT, "drw")
STATION_ROWS = ("PD station", "check TU1", "pick Z31", "flow rack", "HMC station")


# ============================================================================ parameters
def params():
    p = C3.params()
    with open(os.path.join(OUT, "stations", "stations_specs.json"), encoding="utf-8") as fh:
        S = json.load(fh)
    p["st"] = S
    with open(os.path.join(OUT, "stations", "flow_lanes.csv"), encoding="utf-8") as fh:
        p["lanes"] = list(csv.DictReader(fh))
    with open(os.path.join(OUT, "stations", "reject_codes.csv"), encoding="utf-8") as fh:
        p["rejects"] = list(csv.DictReader(fh))
    rep = open(os.path.join(OUT, "stations", "stations_report.md"), encoding="utf-8").read()
    p["rep_A"] = [l[2:] for l in rep.split("## B")[0].split("## A")[1].splitlines() if l.startswith("- ")]
    # derived design choices of this sub-item (written to the dimension table)
    c = S["check"]
    p["grid_x"] = p["cW"] / 2 + c["w_lim"]                 # 420: vertical light grids
    p["grid_z"] = p["top"] + c["h_lim"]                    # 1480: horizontal grid (780 above the conveyor top)
    p["grid_y"] = 900.0                                    # emitter / receiver posts at y = -+900 (beams along y)
    p["agv_gap"] = float(S["pd_end"]["transfer_gap"])
    p["agv_L"], p["agv_W"] = 1600.0, 1000.0
    p["slope"] = S["flow"]["slope_pct"] / 100.0
    p["flow_top"] = float(S["flow"].get("entry_mm", 700))
    p["brake_dx"] = S["flow"]["brake_spacing_m"] * 1000.0
    p["lane_w"] = 1050.0
    p["bin"] = (396.0, 594.0, 147.5)                       # VDA RL-KLT 6147 class: fits the crate inner 792 x 1192 x 420
    p["table_top"] = float(S["hmc"]["table_top_mm"])
    p["lc_S"] = float(S["hmc"]["light_curtain_S_mm"])
    p["shuttle_y"] = 1300.0                                # hazard: near edge of the pallet shuttle (pallet change side)
    p["lc_y"] = p["shuttle_y"] - p["lc_S"]                 # light-curtain plane
    p["jib_R"] = S["hmc"]["jib_radius_m"] * 1000.0
    return p


# ============================================================================ mesh with primitive log (for OpenSCAD)
class SMesh(C3.PMesh):
    def bar(self, p0, p1, w, h=None):
        self.prims.append(("bar", tuple(p0), tuple(p1), w, h or w))
        return Mesh.bar(self, p0, p1, w, h)


def _rot(x, y, deg):
    a = math.radians(deg)
    c, s = round(math.cos(a), 12), round(math.sin(a), 12)
    return x * c - y * s, x * s + y * c


def place(dst, src, dx=0.0, dy=0.0, dz=0.0, deg=0):
    """Add src (mesh with prims) to dst, rotated about z by deg (multiple of 90) then moved."""
    dst.tris.extend(C3.rotz(src, deg, dx, dy, dz).tris)
    for pr in getattr(src, "prims", []):
        if pr[0] == "box":
            _, x0, y0, z0, x1, y1, z1 = pr
            a = _rot(x0, y0, deg)
            b = _rot(x1, y1, deg)
            dst.prims.append(("box", min(a[0], b[0]) + dx, min(a[1], b[1]) + dy, z0 + dz, max(a[0], b[0]) + dx, max(a[1], b[1]) + dy, z1 + dz))
        elif pr[0] == "cyl":
            _, c, ax, r, L = pr
            q = _rot(c[0], c[1], deg)
            if ax in ("x", "y") and deg % 180 == 90:
                ax = "y" if ax == "x" else "x"
            dst.prims.append(("cyl", (q[0] + dx, q[1] + dy, c[2] + dz), ax, r, L))
        elif pr[0] == "bar":
            _, p0, p1, w, h = pr
            a = _rot(p0[0], p0[1], deg)
            b = _rot(p1[0], p1[1], deg)
            dst.prims.append(("bar", (a[0] + dx, a[1] + dy, p0[2] + dz), (b[0] + dx, b[1] + dy, p1[2] + dz), w, h))
    return dst


def scad_of(m, title, p):
    s = ["// %s - generated by stations_3d.py from out/stations/stations_specs.json (F4.3) - units mm" % title,
         "// DESIGN - check and release before manufacture. z up, conveyor top z = %g." % p["top"], "",
         "module %s() {" % m.name]
    for pr in m.prims:
        if pr[0] == "box":
            _, x0, y0, z0, x1, y1, z1 = pr
            s.append("  translate([%.2f, %.2f, %.2f]) cube([%.2f, %.2f, %.2f]);" % (x0, y0, z0, x1 - x0, y1 - y0, z1 - z0))
        elif pr[0] == "cyl":
            _, c, ax, r, L = pr
            rot = {"x": "[0, 90, 0]", "y": "[90, 0, 0]", "z": "[0, 0, 0]"}[ax]
            s.append("  translate([%.2f, %.2f, %.2f]) rotate(%s) cylinder(r = %.2f, h = %.2f, center = true, $fn = 32);" % (c[0], c[1], c[2], rot, r, L))
        else:
            _, p0, p1, w, h = pr
            s.append("  hull() { translate([%.2f, %.2f, %.2f]) cube([%.2f, %.2f, %.2f], center = true); translate([%.2f, %.2f, %.2f]) cube([%.2f, %.2f, %.2f], center = true); }" % (
                p0[0], p0[1], p0[2], w, w, h, p1[0], p1[1], p1[2], w, w, h))
    s += ["}", "%s();" % m.name, ""]
    return "\n".join(s)


def crate(p):
    return C3.gen_crate_runners(p)


# ============================================================================ A  P&D station + AGV
def gen_pd_station_agv(p):
    m = SMesh("pd_station_agv")
    W = 2 * (p["rl_frame_in"] + p["frame_b"])
    rl = C3.gen_rl(p)
    place(m, rl, p["rl_L"] / 2, 0, 0)                                  # first lane zone, x = 0 .. 1400
    place(m, C3.gen_pd_end(p), 320.0, 0, 0, 180)                        # stop flush with the lane end x = 0 (AGV side)
    # muting light curtain at the lane end (posts at both sides) + muting sensors inside the lane
    yc = W / 2 + 150
    for s in (-1, 1):
        m.box(-60, s * yc - 25, 0, -10, s * yc + 25, 1800)
        m.box(-120, s * yc - 60, 0, 50, s * yc + 60, 12)                # post base plate
        m.box(380, s * (W / 2 + 10), p["top"] + 20, 420, s * (W / 2 + 50), p["top"] + 60)   # muting sensor pair
    # optical data coupler (8 bit parallel) at docking height on the lane frame, -y side
    m.box(-40, -(W / 2 + 100), 480, -10, -(W / 2 + 20), 520)            # bracket
    m.box(-70, -(W / 2 + 90), 470, -40, -(W / 2 + 30), 530)             # coupler head
    # AGV docked: front face at x = -gap, roller deck top = conveyor top
    g = p["agv_gap"]
    x1, x0 = -g, -g - p["agv_L"]
    hw = p["agv_W"] / 2
    m.box(x0, -hw, 60, x1, hw, 560)                                     # chassis
    for xx in (x0 + 250, x1 - 250):
        for s in (-1, 1):
            m.cyl((xx, s * (hw - 120), 75), "y", 75, 60, 20)            # wheels
    m.box(x0, -hw, 560, x1, -hw + 60, p["top"] - 15)                    # deck side frames
    m.box(x0, hw - 60, 560, x1, hw, p["top"] - 15)
    r = p["rD"] / 2
    xs = []
    xr = x1 - 30 - r
    while xr - r > x0 + 20:
        xs.append(xr)
        m.cyl((xr, 0.0, p["top"] - r), "y", r, 900, 20)                 # deck rollers, top = conveyor top
        xr -= p["rl_pitch"]
    m.box(x1 - 40, -(hw - 20), 470, x1 - 10, -(hw - 80), 530)           # AGV coupler head (facing the station)
    m.meta = {"deck_top": p["top"], "agv_front": x1, "lane_start": 0.0, "guide_inner": p["cW"] / 2 + p["st"]["pd_end"]["guide_gap"],
              "deck_rollers": xs, "curtain_y": yc}
    cm = Mesh("pd_crates").extend(C3.rotz(crate(p), 90, p["rl_L"] / 2, 0, p["top"]))
    return m, cm


# ============================================================================ B  TU1 check station
def gen_check_tu1(p):
    m = SMesh("check_station_tu1")
    place(m, C3.gen_tu(p, up=True), 0, 0, 0)
    gx, gz, gy = p["grid_x"], p["grid_z"], p["grid_y"]
    post = 60.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box(sx * (gx + 40) - post / 2, sy * gy - post / 2, 0, sx * (gx + 40) + post / 2, sy * gy + post / 2, gz + 120)   # portal posts
            m.box(sx * gx - 15, sy * gy - 20, p["top"] + 20, sx * gx + 15, sy * gy + 20, gz)          # light-grid bars (emitter / receiver)
    for sy in (-1, 1):
        m.box(-(gx + 70), sy * gy - 30, gz + 120, gx + 70, sy * gy + 30, gz + 180)                     # top cross beams
        m.box(-gx, sy * gy - 20, gz - 15, gx, sy * gy + 20, gz + 15)                                   # horizontal height grid
    for sx in (-1, 1):
        m.box(sx * (gx + 70) - 30, -gy, gz + 120, sx * (gx + 70) + 30, gy, gz + 180)
    # 4 load cells under the module (weighing transfer)
    cells = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * 520.0, sy * (p["frame_in"] + 40)
            m.box(cx - 60, cy - 40, 0, cx + 60, cy + 40, 90)
            cells.append((cx, cy))
    # runner sensors under the crate runners (one per runner) (diffuse, looking up)
    sens = []
    for xr in p["run_y"]:
        m.box(xr - 20, -20, p["top"] - 160, xr + 20, 20, p["top"] - 110)
        sens.append(xr)
    # ID reader on the operator side (-x)
    m.box(-(gx + 300) - 30, -30, 0, -(gx + 300) + 30, 30, p["top"] + 400)
    m.box(-(gx + 300), -60, p["top"] + 300, -(gx + 240), 60, p["top"] + 380)
    m.meta = {"grid_x": gx, "grid_z": gz, "cells": cells, "runner_sensors": sens}
    cm = Mesh("tu1_crate").extend(crate(p).moved(0, 0, p["top"] + p["stroke"] - 15))
    return m, cm


# ============================================================================ C  pick station Z31
def gen_pick_z31(p):
    m = SMesh("pick_station_z31")
    rcx = C3.gen_rl(p, "rcx", p["rcx_L"])
    place(m, rcx, 0, 0, 0, 90)                                          # travel along y (1200-leading)
    ph = float(p["st"]["pick"]["platform_h"])
    m.box(-1400, -900, 0, -620, 900, ph)                                # operator platform
    for y in (-950.0, 950.0):                                           # fences between operator and the AGV docks
        for x in (-1400.0, -1000.0, -650.0):
            m.box(x - 25, y - 25, 0, x + 25, y + 25, 1400)
        m.box(-1400, y - 12, 1350, -650, y + 12, 1400)
    # 2 kit-trolley places behind the operator (floor marks + trolleys)
    trolleys = []
    for yc in (-450.0, 450.0):
        x0, x1 = -2300.0, -1500.0
        m.box(x0 - 20, yc - 420, 0, x1 + 20, yc + 420, 5)               # floor marking
        m.box(x0, yc - 400, 150, x1, yc + 400, 180)                     # trolley deck
        for xx in (x0 + 60, x1 - 60):
            for s in (-1, 1):
                m.cyl((xx, yc + s * 340, 75), "y", 60, 40, 16)
        for z in (500.0, 850.0):
            m.box(x0, yc - 400, z, x1, yc + 400, z + 20)                # compartment shelves
        for xx in (x0, x1 - 30):
            for s in (-1, 1):
                m.box(xx, yc + s * 400 - 15, 150, xx + 30, yc + s * 400 + 15, 900)
        trolleys.append(yc)
    # pick-to-light bar above the crate (one light per bin column) on a frame from the platform side
    zb = p["top"] + 1100
    m.box(-560, -30, 0, -500, 30, zb + 60)
    m.box(-560, -620, zb, 300, 620, zb + 40)
    for k in range(4):
        y = -450 + k * 300
        m.box(-40, y - 40, zb - 40, 40, y + 40, zb)
    # side shelf for bins (reach < 63 cm from the operator), -y end of the platform
    m.box(-1380, -880, ph + 800, -640, -620, ph + 830)
    for x in (-1380.0, -670.0):
        m.box(x, -880, ph, x + 30, -850, ph + 830)
    # crate with 8 bins (2 layers x 4)
    cm = Mesh("z31_crate").extend(crate(p).moved(0, 0, p["top"]))
    bx, by, bz = p["bin"]
    z0 = p["top"] + p["run_h"] + 20
    bins = []
    for layer in range(2):
        for i in (-1, 1):
            for j in (-1, 1):
                x = i * bx / 2
                y = j * by / 2
                zz = z0 + layer * bz
                cm.box(x - bx / 2 + 1, y - by / 2 + 1, zz, x + bx / 2 - 1, y + by / 2 - 1, zz + bz - 2)
                bins.append((x - bx / 2 + 1, y - by / 2 + 1, zz, x + bx / 2 - 1, y + by / 2 - 1, zz + bz - 2))
    inner = (-p["cW"] / 2 + 4, -p["cL"] / 2 + 4, z0, p["cW"] / 2 - 4, p["cL"] / 2 - 4, p["top"] + p["cH"])
    m.meta = {"bins": bins, "inner": inner, "platform_h": ph, "trolleys": trolleys, "roller_axis": "x", "runner_axis": "y"}
    return m, cm


# ============================================================================ D  flow racks
def lane_mesh(m, p, x0, y0, L, z_hi, sign=1, label=""):
    """Gravity lane from x0 (high end, entry) to x0 + L (low end) if sign = 1; sign = -1: high end at x0 + L."""
    s = p["slope"]
    r = p["rD"] / 2
    zt = lambda x: z_hi - s * ((x - x0) if sign == 1 else (x0 + L - x))
    hw = p["rLen"] / 2 + 5
    for sy in (-1, 1):
        m.bar((x0, y0 + sy * hw, zt(x0) - 70), (x0 + L, y0 + sy * hw, zt(x0 + L) - 70), 12, 120)    # side frames (sloped)
    xs = []
    x = x0 + 75
    while x <= x0 + L - 75 + 1e-6:
        m.cyl((x, y0, zt(x) - r), "y", r, p["rLen"], 16)
        xs.append(x)
        x += p["rl_pitch"]
    brakes = []
    k = 0
    while k * p["brake_dx"] + 75 <= L - 75 + 1e-6:
        xb = x0 + 75 + k * p["brake_dx"]
        m.cyl((xb, y0 + p["rLen"] / 2 - 90, zt(xb) - r), "y", r + 6, 120, 16)                          # brake roller (centrifugal brake hub)
        brakes.append(xb)
        k += 1
    xe = x0 + L if sign == 1 else x0
    xin = 1 if sign == 1 else -1
    m.box(xe - xin * 40 - 10, y0 - 300, zt(xe) - 20, xe - xin * 40 + 10, y0 + 300, zt(xe) + 80)        # end stop at the exit
    xsep = xe - xin * 1400
    m.box(xsep - 15, y0 - 60, zt(xsep) - 150, xsep + 15, y0 + 60, zt(xsep) + 40)                      # pallet separator (holds crate 2)
    for xl in [x0 + 100 + 1200 * i for i in range(int(L // 1200) + 1)] + [x0 + L - 100]:
        if x0 <= xl <= x0 + L:
            for sy in (-1, 1):
                m.box(xl - 30, y0 + sy * hw - 30, 0, xl + 30, y0 + sy * hw + 30, zt(xl) - 130)       # legs (height follows the slope)
    return {"x0": x0, "y": y0, "L": L, "roller_x": xs, "roller_top": [zt(x) for x in xs], "brakes": brakes, "sep_x": xsep,
            "exit_top": zt(xe), "entry_top": zt(x0 if sign == 1 else x0 + L), "label": label, "sign": sign}


def gen_flow_lane(p):
    m = SMesh("flow_rack_lane")
    info = lane_mesh(m, p, 0.0, 0.0, p["st"]["flow"]["lane_len_m"] * 1000, p["flow_top"], 1, "part lane (3 crates)")
    cm = Mesh("flow_crates")
    for x in (700.0, 2100.0, 3500.0):
        z = p["flow_top"] - p["slope"] * x
        cm.extend(C3.rotz(crate(p), 90, x, 0, z))
    m.meta = info
    return m, cm


def gen_flow_vmc(p):
    m = SMesh("flow_rack_vmc")
    lanes = [r for r in p["lanes"] if r["dept"] == "VMC"]
    infos = []
    for i, r in enumerate(lanes):
        y = i * p["lane_w"]
        L = float(r["length_m"]) * 1000
        Lp = p["st"]["flow"]["lane_len_m"] * 1000
        ex = p["flow_top"] - p["slope"] * Lp
        if r["part"].startswith("empty"):
            # POWERED return lane: from the exit height at the machine side rising gently to 700 at the AGV side (x = Lp - L)
            q = dict(p, slope=(p["top"] - ex) / Lp)
            info = lane_mesh(m, q, 0.0, y, Lp, p["top"], 1, r["part"])
        else:
            info = lane_mesh(m, p, 0.0, y, Lp, p["flow_top"], 1, r["part"])
        infos.append(info)
    if lanes:
        # ball-transfer deck across all lanes at the exit: crate in use; empties slide sideways to the return lane
        Lp = p["st"]["flow"]["lane_len_m"] * 1000
        ex = p["flow_top"] - p["slope"] * Lp
        m.box(Lp + 20, -p["lane_w"] / 2, ex - 60, Lp + 900, (len(lanes) - 0.5) * p["lane_w"], ex - 20)
    m.meta = {"lanes": infos, "n": len(lanes)}
    return m


# ============================================================================ E  HMC load station
def gen_hmc(p):
    m = SMesh("hmc_load_station")
    H = p["st"]["hmc"]
    tt = p["table_top"]
    m.box(-400, -400, 0, 400, 400, 60)                                  # base plate
    m.box(-300, -300, 60, 300, 300, tt - 120)                           # table body
    m.cyl((0.0, 0.0, tt - 100), "z", 210, 60, 32)                       # slewing ring (d 420)
    m.box(-320, -320, tt - 70, 320, 320, tt)                            # turntable plate (top = 900)
    m.box(300, -90, tt - 300, 520, 90, tt - 140)                        # index gear motor (brake)
    m.box(300, 120, tt - 260, 380, 200, tt - 180)                       # index pin unit
    m.box(-380, -120, tt - 240, -300, 120, tt - 120)                    # hydraulic coupling block (clamping supply)
    pm = H["pallet_mm"]
    m.box(-pm / 2, -pm / 2, tt, pm / 2, pm / 2, tt + 60)                # pallet 500 x 500
    a, b, h = H["tomb_mm"]
    z0 = tt + 60
    m.box(-a / 2, -b / 2, z0, a / 2, b / 2, z0 + h)                     # tombstone 400 x 400 x 800
    clamps = []
    parts = []
    for sx in (-1, 1):                                                  # crankcase on face +x and face -x (OP10 / OP20)
        xf = sx * a / 2
        m.box(xf, -130, z0 + 250, xf + sx * 210, 130, z0 + 550)         # crankcase (envelope)
        parts.append(sx)
        for (yy, zz) in ((-150.0, z0 + 300), (150.0, z0 + 300), (0.0, z0 + 600)):
            m.cyl((xf + sx * 40, yy, zz), "x", H["clamp_bore"] / 2 + 8, 80, 16)          # swing clamp body (bore D20)
            clamps.append((xf, yy, zz))
    # chip tray under the table, floor mat on the operator side (-y)
    m.box(-700, -700, 0, 700, -420, 120)
    m.box(-900, -1600, 0, 900, -750, 15)
    # light curtain between the operator side and the pallet shuttle (+y): plane at y = shuttle - S
    yl = p["lc_y"]
    for sx in (-1, 1):
        m.box(sx * 750 - 25, yl - 25, 0, sx * 750 + 25, yl + 25, 1800)
        m.box(sx * 750 - 60, yl - 60, 0, sx * 750 + 60, yl + 60, 12)
    # pallet shuttle (hazard) beyond the curtain
    ys = p["shuttle_y"]
    m.box(-1500, ys, 0, 1500, ys + 60, 120)                             # rail
    m.box(-400, ys + 60, 120, 400, ys + 760, tt - 60)                   # shuttle carriage
    # jib crane: column at (-1200, -1200), arm 3 m towards +x
    cxj, cyj = -1200.0, -1200.0
    m.box(cxj - 110, cyj - 110, 0, cxj + 110, cyj + 110, 3400)
    m.box(cxj - 300, cyj - 300, 0, cxj + 300, cyj + 300, 30)
    m.box(cxj, cyj - 60, 3300, cxj + p["jib_R"], cyj + 60, 3420)       # arm 3000
    m.box(cxj + 1600, cyj - 80, 3050, cxj + 1800, cyj + 80, 3300)      # chain hoist
    m.cyl((cxj + 1700, cyj, 2100), "z", 6, 1900, 8)                     # chain
    m.box(cxj + 1600, cyj - 120, 1050, cxj + 1800, cyj + 120, 1150)    # gripper
    m.meta = {"table_top": tt, "tomb": (a, b, h), "clamps": clamps, "lc_y": yl, "hazard_y": ys, "jib": (cxj, cyj, p["jib_R"]),
              "tomb_bbox": (-a / 2, -b / 2, z0, a / 2, b / 2, z0 + h)}
    return m


# ============================================================================ drawings
def sheet_save(sh, path):
    sh.save(path)
    s = open(path, encoding="utf-8").read()
    s = s.replace("Combined FMS VC20 + RB - item F3 AS/RS", "Combined FMS VC20 + RB - item F4.3 stations")
    s = s.replace(">asrs_3d.py<", ">stations_3d.py<")
    s = s.replace("Generated from design_result.json (F3).", "Generated from stations_specs.json (F4.3).")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(s)


def notes(sh, x, y, lines, size=2.3, step=4.6):
    for k, t in enumerate(lines):
        sh.text(x, y + step * k, t, size)
    return y + step * len(lines)


def draw_D16(p, path):
    sh = Sheet("F4-ST-D16", "P&D station end + AGV docking detail", "1:20 / 1:5")
    W = 2 * (p["rl_frame_in"] + p["frame_b"])
    V = View(118, 80, 20, "x", "y")
    sh.text(30, 20, "PLAN lane end + docked AGV 1:20", 3.0, bold=True)
    V.rect(sh, 0, -W / 2, p["rl_L"], W / 2, 0.3, "#dde7f3")                          # lane zone
    for x in C3.gen_rl(p).meta["roller_x"]:
        V.rect(sh, x + p["rl_L"] / 2 - 30, -p["rLen"] / 2, x + p["rl_L"] / 2 + 30, p["rLen"] / 2, 0.15, "#ffffff")
    g, gi = p["agv_gap"], p["cW"] / 2 + p["st"]["pd_end"]["guide_gap"]
    for s in (-1, 1):
        V.rect(sh, 150, s * gi, 620, s * (gi + 8), 0.3, "#999999")                       # guides
        sh.line(V.X(0), V.Y(s * (gi + 4 + 150 * math.tan(math.radians(15)))), V.X(150), V.Y(s * (gi + 4)), 0.35)
        V.rect(sh, -60, s * (W / 2 + 150) - 25, -10, s * (W / 2 + 150) + 25, 0.3, "#ffcc66")   # curtain posts
    V.rect(sh, -10, -300, 0, 300, 0.4, "#c00000")                                       # stop plate
    V.rect(sh, -g - p["agv_L"], -p["agv_W"] / 2, -g, p["agv_W"] / 2, 0.3, "#e8e0f5")    # AGV
    sh.text(V.X(-g - p["agv_L"] / 2), V.Y(0) + 1, "AGV (roller deck, top 700)", 2.4, "middle")
    sh.text(V.X(700), V.Y(0) + 1, "lane zone 1 (1200-leading)", 2.4, "middle")
    sh.dim_h(V.X(-g), V.X(0), V.Y(-p["agv_W"] / 2), V.Y(-p["agv_W"] / 2) + 14, "%d gap" % g, 2.2)
    sh.dim_v(V.Y(-gi), V.Y(gi), V.X(p["rl_L"]), V.X(p["rl_L"]) + 10, "%d = 800 + 2 x %d" % (2 * gi, p["st"]["pd_end"]["guide_gap"]), 2.2)
    sh.text(V.X(-50), V.Y(W / 2 + 230), "muting light curtain posts", 2.2, "middle")
    sh.text(V.X(150), V.Y(-(gi + 70)), "lead-in 15 deg / 150 mm", 2.2)
    # elevation detail 1:5 of the transfer gap
    E = View(130, 205, 5, "x", "z")
    sh.text(30, 140, "DETAIL transfer gap, elevation 1:5", 3.0, bold=True)
    r = p["rD"] / 2
    for xx in (-g - r - 30, -g - r - 30 - 150):
        cx, cy = E.P(xx, -r)
        sh.circle(cx, cy, r / 5, 0.3, "#e8e0f5")
    for xx in (75, 225):
        cx, cy = E.P(xx, -r)
        sh.circle(cx, cy, r / 5, 0.3, "#dde7f3")
    E.rect(sh, -300, 0, 300, 25, 0.3, "#ffe699")
    sh.text(E.X(-150), E.Y(25) - 2, "crate runner crossing the gap", 2.2, "middle")
    E.rect(sh, -10, -120, 0, 60, 0.35, "#c00000")
    sh.text(E.X(5) + 2, E.Y(-140), "pop-up stop (lowered during transfer), 2 PU buffers, stroke %d" % p["st"]["pd_end"]["buffer_stroke"], 2.2)
    sh.dim_h(E.X(-g), E.X(0), E.Y(-2 * r), E.Y(-2 * r) + 10, "%d" % g, 2.2)
    sh.text(E.X(-g - 200), E.Y(-2 * r - 60), "AGV deck top 700 +-3 (levelled)", 2.2, "middle")
    import textwrap
    wrapped = [w for t in p["rep_A"] for w in textwrap.wrap(t, 100)]
    rows = [["Budget (stations_report.md A)"]] + [[w] for w in wrapped]
    sh.table(230, 30, rows, [178], 4.6, 2.0)
    notes(sh, 230, 40 + 4.6 * len(rows), ["Handshake (optical coupler, 8 bit each way): AGV_PRESENT, AGV_READY_SEND / RECV, AGV_TRANSFER_DONE;",
                        "station: ST_READY_RECV / SEND, ST_TRANSFER_DONE, ST_FAULT (handshake.csv).",
                        "Rollers of both sides run only while AGV_PRESENT = 1 and ST_FAULT = 0.",
                        "People protection = light curtain with muting (F4.5 / F8), NOT the handshake signals.",
                        "AGV requirements (F5): stop +-10 mm, yaw +-0.5 deg, deck height +-3 mm, gap 30 mm."], 2.2)
    sheet_save(sh, path)


def draw_D17(p, path):
    sh = Sheet("F4-ST-D17", "TU1 check station - contour portal, scale, ID", "1:15")
    gx, gz = p["grid_x"], p["grid_z"]
    E = View(130, 200, 15, "x", "z")
    sh.text(30, 20, "FRONT VIEW (across x) 1:15 - crate on TU1", 3.0, bold=True)
    E.rect(sh, -(gx + 70), 0, -(gx + 10), gz + 180, 0.3, "#cccccc")
    E.rect(sh, gx + 10, 0, gx + 70, gz + 180, 0.3, "#cccccc")
    E.rect(sh, -(gx + 70), gz + 120, gx + 70, gz + 180, 0.3, "#cccccc")
    E.rect(sh, -p["frame_in"] - 65, p["top"] - 170, p["frame_in"] + 65, p["top"] - 10, 0.3, "#dde7f3")
    ct = p["top"] + p["stroke"] - 15
    for xr in p["run_y"]:
        E.rect(sh, xr - 50, ct, xr + 50, ct + p["run_h"], 0.3, "#ffe699")
    E.rect(sh, -p["cW"] / 2, ct + p["run_h"], p["cW"] / 2, ct + p["cH"], 0.35)
    for sx in (-1, 1):
        E.rect(sh, sx * gx - 15, p["top"] + 20, sx * gx + 15, gz, 0.3, "#ff9999")
    E.rect(sh, -gx, gz - 15, gx, gz + 15, 0.3, "#ff9999")
    for sx in (-1, 1):
        E.rect(sh, sx * 520 - 60, 0, sx * 520 + 60, 90, 0.3, "#99cc99")
    for xr in p["run_y"]:
        E.rect(sh, xr - 20, p["top"] - 160, xr + 20, p["top"] - 110, 0.25, "#6699cc")
    sh.dim_h(E.X(-gx), E.X(gx), E.Y(gz + 200), E.Y(gz + 200) - 6, "%d = 800 + 2 x %d" % (2 * gx, p["st"]["check"]["w_lim"]), 2.2)
    sh.dim_v(E.Y(p["top"]), E.Y(gz), E.X(gx + 70), E.X(gx + 70) + 10, "%d above top" % p["st"]["check"]["h_lim"], 2.2)
    sh.dim_v(E.Y(0), E.Y(p["top"]), E.X(-(gx + 70)), E.X(-(gx + 70)) - 10, "%d" % p["top"], 2.2)
    sh.text(E.X(0), E.Y(-30) + 4, "4 load cells %d kg (green), 2 runner sensors (blue)" % p["st"]["check"]["cell_cap_kg"], 2.2, "middle")
    sh.text(E.X(0), E.Y(gz) - 3, "horizontal grid %d mm resolution" % p["st"]["check"]["grid_res"], 2.0, "middle")
    rows = [["Code", "Meaning", "Reaction"]] + [[r["code"], r["meaning"][:46], r["reaction"][:44]] for r in p["rejects"]]
    sh.table(230, 30, rows, [12, 86, 80], 4.6, 2.0)
    notes(sh, 230, 82, ["Contour limits (F3 rack): side overhang <= %d mm per side, front/rear <= %d mm, height <= %d mm" % (
        p["st"]["check"]["w_lim"], p["st"]["check"]["fr_lim"], p["st"]["check"]["h_lim"]),
        "Vertical grids at x = +-%d (beams along y, posts at y = +-%d); horizontal grid at z = %d" % (gx, p["grid_y"], gz),
        "Length (front/rear) measured in motion: 0.2 m/s x 10 ms scan = 2 mm steps",
        "Weighing transfer: 4 x %d kg C3-class cells, u = 0.88 kg, accept W <= 298.2 kg (guard band)" % p["st"]["check"]["cell_cap_kg"],
        "ID reader (F6) on the operator side (-x), 300 mm above the conveyor top; settling 0.58 s << 8 s"], 2.2)
    sheet_save(sh, path)


def draw_D18(p, path):
    sh = Sheet("F4-ST-D18", "Pick / rework station Z31 - plan, section, ergonomics", "1:25 / 1:10")
    V = View(120, 90, 25, "x", "y")
    sh.text(30, 20, "PLAN 1:25 (operator at -x, crate travels along y)", 3.0, bold=True)
    V.rect(sh, -p["rl_frame_in"] - 65, -p["rcx_L"] / 2, p["rl_frame_in"] + 65, p["rcx_L"] / 2, 0.3, "#e8f7e8")
    V.rect(sh, -p["cW"] / 2, -p["cL"] / 2, p["cW"] / 2, p["cL"] / 2, 0.35)
    bx, by, bz = p["bin"]
    for i in (-1, 1):
        for j in (-1, 1):
            V.rect(sh, (0 if i > 0 else -bx) + 1, (0 if j > 0 else -by) + 1, (bx if i > 0 else 0) - 1, (by if j > 0 else 0) - 1, 0.2, "#fff2cc")
    V.rect(sh, -1400, -900, -620, 900, 0.3, "#fff4e6")
    sh.text(V.X(-1010), V.Y(0) + 1, "platform 300", 2.2, "middle")
    for yc in (-450, 450):
        V.rect(sh, -2300, yc - 400, -1500, yc + 400, 0.3, "#dde7f3")
    sh.text(V.X(-1900), V.Y(0) + 1, "2 kit trolleys", 2.2, "middle")
    V.rect(sh, -1380, -880, -640, -620, 0.25, "#cccccc")
    sh.text(V.X(-1010), V.Y(-750) + 1, "bin shelf", 2.0, "middle")
    sh.line(V.X(-620), V.Y(0), V.X(10), V.Y(0), 0.3, "2 1", "#c00000")
    sh.text(V.X(-300), V.Y(0) - 2, "reach <= 63 cm", 2.0, "middle", col="#c00000")
    sh.dim_v(V.Y(-p["rcx_L"] / 2), V.Y(p["rcx_L"] / 2), V.X(p["rl_frame_in"] + 65), V.X(p["rl_frame_in"] + 65) + 8, "%d RCX" % p["rcx_L"], 2.2)
    # section 1:10 (x-z): bin layers
    S = View(70, 245, 10, "x", "z")
    sh.text(30, 160, "SECTION A-A 1:10 - crate with 2 layers x 4 bins", 3.0, bold=True)
    for xr in p["run_y"]:
        S.rect(sh, xr - 50, 0, xr + 50, p["run_h"], 0.3, "#ffe699")
    S.rect(sh, -p["cW"] / 2, p["run_h"], p["cW"] / 2, p["cH"], 0.35)
    z0 = p["run_h"] + 20
    for layer in range(2):
        for i in (-1, 1):
            S.rect(sh, (0 if i > 0 else -bx) + 1, z0 + layer * bz, (bx if i > 0 else 0) - 1, z0 + (layer + 1) * bz - 2, 0.25, "#fff2cc")
    sh.dim_v(S.Y(z0), S.Y(z0 + 2 * bz), S.X(p["cW"] / 2), S.X(p["cW"] / 2) + 8, "2 x %.1f" % bz, 2.2)
    sh.dim_h(S.X(-p["cW"] / 2 + 4), S.X(p["cW"] / 2 - 4), S.Y(p["cH"]), S.Y(p["cH"]) - 5, "inner %d" % (p["cW"] - 8), 2.2)
    sh.text(S.X(0), S.Y(-30), "bins %d x %d x %.1f (RL-KLT 6147 class)" % (by, bx, bz), 2.2, "middle")
    notes(sh, 230, 30, ["NIOSH limits (load_stations.py, ch. C):",
                        "- kit only parts <= 5.0 kg (RWL near picks 5.2 kg); heavier parts are line-fed in crates",
                        "- fill bins to <= 8 kg (RWL bin lift 8.9 kg)",
                        "- horizontal reach H <= 63 cm: a FAR bin is pulled to the near half first",
                        "  pull force 0.4 x 8 x 9.81 = 31 N <= 100 N",
                        "- LI final: near picks 0.88 / 0.89, bin lift 0.90",
                        "",
                        "Pick-to-light bar above the crate (one light per bin column),",
                        "2 kit-trolley places -> 2 kits per crate visit (F4.3 C).",
                        "Platform 300 mm: crate rim at 1300 mm above the platform.",
                        "",
                        "NOTE (F4.3 fork): 8 bins 600 x 400 x 280 in 2 layers do NOT fit",
                        "the crate (inner 792 x 1192 x 420): shown as 8 x 594 x 396 x 147.5",
                        "(RL-KLT 6147 class) or 4 x 594 x 396 x 280 in one layer."], 2.3, 5.0)
    sheet_save(sh, path)


def draw_D19(p, path, lane, vmc):
    sh = Sheet("F4-ST-D19", "Gravity flow rack - lane side view, VMC block plan", "1:30 / 1:100")
    L = lane["L"]
    E = View(40, 110, 30, "x", "z")
    sh.text(30, 20, "SIDE VIEW lane %d m, slope %.1f %% 1:30" % (L / 1000, 100 * p["slope"]), 3.0, bold=True)
    sh.line(E.X(0), E.Y(lane["entry_top"]), E.X(L), E.Y(lane["exit_top"]), 0.5)
    for x, zt in zip(lane["roller_x"], lane["roller_top"]):
        cx, cy = E.P(x, zt - p["rD"] / 2)
        sh.circle(cx, cy, p["rD"] / 2 / 30, 0.15)
    for xb in lane["brakes"]:
        zt = p["top"] - p["slope"] * xb
        cx, cy = E.P(xb, zt - p["rD"] / 2)
        sh.circle(cx, cy, (p["rD"] / 2 + 6) / 30, 0.35, "#c00000")
    sh.line(E.X(0), E.Y(0), E.X(L), E.Y(0), 0.35)
    xs = lane["sep_x"]
    E.rect(sh, xs - 15, p["flow_top"] - p["slope"] * xs - 150, xs + 15, p["flow_top"] - p["slope"] * xs + 40, 0.3, "#333333")
    sh.text(E.X(xs), E.Y(p["flow_top"] - p["slope"] * xs + 120), "separator", 2.2, "middle")
    sh.text(E.X(0), E.Y(lane["entry_top"] + 150), "entry (AGV side) %d" % round(lane["entry_top"]), 2.2)
    sh.text(E.X(L), E.Y(lane["exit_top"] + 150), "exit (machine side) %d" % round(lane["exit_top"]), 2.2, "end")
    sh.dim_h(E.X(lane["brakes"][0]), E.X(lane["brakes"][1]), E.Y(0), E.Y(0) + 8, "%d brake roller pitch" % p["brake_dx"], 2.2)
    sh.dim_h(E.X(0), E.X(L), E.Y(0), E.Y(0) + 16, "%d" % L, 2.2)
    sh.text(30, 150, "Red: brake rollers (v <= 0.30 m/s); a 300 kg crate without brakes would accelerate along the whole lane.", 2.3)
    # VMC block plan 1:50
    V = View(40, 268, 100, "x", "y")
    sh.text(30, 170, "PLAN VMC block 1:100 - one lane per part type + return lane", 3.0, bold=True)
    for info in vmc["lanes"]:
        y = info["y"]
        ret = info["label"].startswith("empty")
        V.rect(sh, 0, y - p["lane_w"] / 2 + 25, info["L"], y + p["lane_w"] / 2 - 25, 0.25, "#ffe0b3" if ret else "#dde7f3")
        sh.text(V.X(info["L"]) + 2, V.Y(y) + 1, "%s  %.1f m  %s" % (info["label"][:26], info["L"] / 1000, "<- powered return" if ret else "->"), 2.0)
    sh.text(V.X(0), V.Y(vmc["lanes"][-1]["y"] + 700), "AGV side (x = 0)", 2.2)
    notes(sh, 230, 30, ["Slope %.1f %% = light-crate resistance 5 %% + 0.5 %% (start of a 45 kg crate)" % (100 * p["slope"]),
                        "Rollers D60 at pitch 150 (runners cross the rollers, 1200-leading)",
                        "Brake rollers every %.2f m: always >= 1 under a crate" % (p["brake_dx"] / 1000),
                        "Separator holds crates 2..n (line pressure 412 N) while crate 1 is in use",
                        "Lane pitch %.2f m; VMC face %.1f m (department width 11.9 m)" % (p["lane_w"] / 1000, vmc["n"] * p["lane_w"] / 1000),
                        "",
                        "Lane <= 3 places (%.1f m): drop %d mm; entry %d mm by the AGV lifting deck," % (L / 1000, round(lane["entry_top"] - lane["exit_top"]), round(lane["entry_top"])),
                        "exit roller top %d mm (crate floor ~%d mm) - normal picking height" % (round(lane["exit_top"]), round(lane["exit_top"] + p["run_h"] + 20)),
                        "Exit: ball-transfer deck across the lanes (crate in use);",
                        "empties slide sideways (~9 N) to the POWERED return lane -> 700 at the AGV side."], 2.3, 5.0)
    sheet_save(sh, path)


def draw_D20(p, path, hm):
    sh = Sheet("F4-ST-D20", "HMC pallet load station - plan and elevation", "1:50 / 1:30")
    V = View(120, 120, 50, "x", "y")
    sh.text(30, 20, "PLAN 1:50 (operator -y, pallet shuttle +y)", 3.0, bold=True)
    V.rect(sh, -320, -320, 320, 320, 0.3, "#dde7f3")
    V.rect(sh, -200, -200, 200, 200, 0.35, "#cccccc")
    sh.text(V.X(0), V.Y(0) + 1, "tombstone", 2.0, "middle")
    yl, ys = hm["lc_y"], hm["hazard_y"]
    sh.line(V.X(-750), V.Y(yl), V.X(750), V.Y(yl), 0.6, "3 1", "#c00000")
    sh.text(V.X(800), V.Y(yl) + 1, "light curtain", 2.2, col="#c00000")
    V.rect(sh, -1500, ys, 1500, ys + 60, 0.3, "#999999")
    V.rect(sh, -400, ys + 60, 400, ys + 760, 0.3, "#f8cbad")
    sh.text(V.X(0), V.Y(ys + 410) + 1, "pallet shuttle (hazard)", 2.2, "middle")
    sh.dim_v(V.Y(yl), V.Y(ys), V.X(-800), V.X(-800) - 8, "S = %d" % p["lc_S"], 2.2)
    V.rect(sh, -900, -1600, 900, -750, 0.2, "#eeeeee")
    sh.text(V.X(0), V.Y(-1200) + 1, "operator mat", 2.2, "middle")
    cxj, cyj, R = hm["jib"]
    cx, cy = V.P(cxj, cyj)
    sh.circle(cx, cy, R / 50, 0.25)
    V.rect(sh, cxj - 110, cyj - 110, cxj + 110, cyj + 110, 0.3, "#999999")
    sh.text(cx, cy + 7, "jib crane R %d, %d kg" % (R, p["st"]["hmc"]["jib_swl_kg"]), 2.2, "middle")
    # elevation 1:30
    E = View(330, 222, 30, "x", "z")
    sh.text(230, 150, "ELEVATION 1:30", 3.0, bold=True)
    tt = hm["table_top"]
    a, b, h = hm["tomb"]
    E.rect(sh, -300, 60, 300, tt - 120, 0.3, "#dde7f3")
    E.rect(sh, -320, tt - 70, 320, tt, 0.3, "#cccccc")
    E.rect(sh, -250, tt, 250, tt + 60, 0.3, "#999999")
    E.rect(sh, -a / 2, tt + 60, a / 2, tt + 60 + h, 0.35, "#eeeeee")
    for sx in (-1, 1):
        E.rect(sh, sx * a / 2, tt + 310, sx * (a / 2 + 210), tt + 610, 0.3, "#ffe699")
        for zz in (tt + 360, tt + 660):
            cx, cy = E.P(sx * (a / 2 + 40), zz)
            sh.circle(cx, cy, 18 / 30 * 2, 0.3, "#ffffff")
    sh.dim_v(E.Y(0), E.Y(tt), E.X(-420), E.X(-420) - 8, "%d" % tt, 2.2)
    sh.dim_v(E.Y(tt + 60), E.Y(tt + 60 + h), E.X(a / 2 + 260), E.X(a / 2 + 260) + 8, "%d" % h, 2.2)
    notes(sh, 230, 30, ["Index 90 deg in %.0f s, brake gear motor %.2f kW + index pin; slewing ring D420" % (3, p["st"]["hmc"]["index_motor_kW"]),
                        "Hydraulic swing clamps bore D%d (7.85 kN at 250 bar), 3 per crankcase" % p["st"]["hmc"]["clamp_bore"],
                        "Clamping check: pressure switch 220 bar + air-gap seat check 2.5 bar",
                        "Raw crankcase 16.5 kg: NIOSH LI 1.62 -> jib crane + gripper (SWL %d kg)" % p["st"]["hmc"]["jib_swl_kg"],
                        "Light curtain: S = K T + C = 1600 x 0.345 + 128 = %d mm from the shuttle" % p["lc_S"],
                        "Load station time FA 172 s / FC 360 s per visit; utilisation 55.5 %",
                        "Chip tray under the table; operator mat on the -y side"], 2.3, 5.0)
    sheet_save(sh, path)


# ============================================================================ dimension table (append)
def dim_rows(p, hm, lane):
    return [["PD station", "AGV gap / guide gap per side", "%d / %d" % (p["agv_gap"], p["st"]["pd_end"]["guide_gap"]), "+-2", "stations_specs"],
            ["PD station", "lead-in angle / length", "15 deg / 150", "+-1 deg", "stations_specs"],
            ["PD station", "AGV deck top", p["top"], "+-3", "F4.3 A (F5 requirement)"],
            ["PD station", "light-curtain posts y", "+-%d" % (p["rl_frame_in"] + p["frame_b"] + 150), "+-10", "stations_3d"],
            ["PD station", "optical coupler height", 500, "+-10", "stations_3d"],
            ["check TU1", "vertical light grids x", "+-%d" % p["grid_x"], "+-2", "800/2 + w_lim"],
            ["check TU1", "horizontal grid height above floor", p["grid_z"], "+-2", "top + h_lim"],
            ["check TU1", "grid posts y", "+-%d" % p["grid_y"], "+-5", "stations_3d"],
            ["check TU1", "load cells (4) x / y", "+-520 / +-%d" % (p["frame_in"] + 40), "+-5", "stations_3d"],
            ["check TU1", "runner sensors x", " / ".join("%+d" % v for v in p["run_y"]), "+-3", "crate runners"],
            ["pick Z31", "platform height / extent x", "300 / -1400..-620", "+-5", "stations_specs"],
            ["pick Z31", "bins (8) L x W x H", "%d x %d x %.1f" % (p["bin"][1], p["bin"][0], p["bin"][2]), "VDA 4500", "stations_3d"],
            ["pick Z31", "pick-to-light bar height", p["top"] + 1100, "+-10", "stations_3d"],
            ["flow rack", "slope", "%.1f %%" % (100 * p["slope"]), "+-0.1 %", "stations_specs"],
            ["flow rack", "brake roller pitch", p["brake_dx"], "+-5", "stations_specs"],
            ["flow rack", "lane pitch", p["lane_w"], "+-5", "ls_data"],
            ["flow rack", "7 m lane entry / exit roller top", "%d / %d" % (round(lane["entry_top"]), round(lane["exit_top"])), "+-3", "stations_3d"],
            ["HMC station", "table top / pallet / tombstone", "%d / 500 x 500 / 400 x 400 x 800" % hm["table_top"], "+-1", "stations_specs"],
            ["HMC station", "light curtain to shuttle", p["lc_S"], "min", "ISO 13855"],
            ["HMC station", "jib crane radius / SWL", "%d / %d kg" % (p["jib_R"], p["st"]["hmc"]["jib_swl_kg"]), "-", "stations_specs"],
            ["HMC station", "swing clamp bore", p["st"]["hmc"]["clamp_bore"], "-", "load_stations E"]]


def append_dims(p, hm, lane):
    path = os.path.join(DRW, "dimension_table.csv")
    with open(path, encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    keep = [r for r in rows if not (r and r[0] in STATION_ROWS)]
    new = dim_rows(p, hm, lane)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        csv.writer(fh).writerows(keep + new)
    return len(keep) - 1, len(new)


# ============================================================================ run / selftest
def build_all(p):
    pd, pdc = gen_pd_station_agv(p)
    chk, chkc = gen_check_tu1(p)
    pk, pkc = gen_pick_z31(p)
    fl, flc = gen_flow_lane(p)
    vmc = gen_flow_vmc(p)
    hm = gen_hmc(p)
    return {"pd_station_agv": (pd, pdc), "check_station_tu1": (chk, chkc), "pick_station_z31": (pk, pkc),
            "flow_rack_lane": (fl, flc), "flow_rack_vmc": (vmc, None), "hmc_load_station": (hm, None)}


def cmd_run():
    os.makedirs(D3S, exist_ok=True)
    os.makedirs(DRW, exist_ok=True)
    p = params()
    B = build_all(p)
    for k, (m, c) in B.items():
        full = Mesh(k).extend(m)
        if c is not None:
            full.extend(c)
        write_stl(full, os.path.join(D3S, k + ".stl"))
        with open(os.path.join(D3S, k + ".scad"), "w", encoding="utf-8") as fh:
            fh.write(scad_of(m, k, p))
    iso_preview([(B["check_station_tu1"][0], (150, 175, 210)), (B["check_station_tu1"][1], (215, 160, 90))],
                os.path.join(D3S, "preview_check_tu1.svg"), "TU1 check station (F4.3) - contour portal, load cells, ID reader")
    iso_preview([(B["hmc_load_station"][0], (150, 175, 210))], os.path.join(D3S, "preview_hmc.svg"),
                "HMC pallet load station (F4.3) - table, tombstone, jib crane, light curtain")
    draw_D16(p, os.path.join(DRW, "D16_pd_station_agv_docking.svg"))
    draw_D17(p, os.path.join(DRW, "D17_check_station_tu1.svg"))
    draw_D18(p, os.path.join(DRW, "D18_pick_station_z31.svg"))
    draw_D19(p, os.path.join(DRW, "D19_flow_rack.svg"), B["flow_rack_lane"][0].meta, B["flow_rack_vmc"][0].meta)
    draw_D20(p, os.path.join(DRW, "D20_hmc_load_station.svg"), B["hmc_load_station"][0].meta)
    nk, nn = append_dims(p, B["hmc_load_station"][0].meta, B["flow_rack_lane"][0].meta)
    print("written: %s (%d STL + SCAD, 2 previews), %s (D16-D20), dimension table %d + %d rows" % (D3S, len(B), DRW, nk, nn))
    return 0


def edges_even(mesh):
    cnt = {}
    for t in mesh.tris:
        vs = [tuple(round(c, 3) for c in v) for v in t]
        for i in range(3):
            e = tuple(sorted((vs[i], vs[(i + 1) % 3])))
            cnt[e] = cnt.get(e, 0) + 1
    return all(v % 2 == 0 for v in cnt.values())


def selftest():
    ok = []

    def check(name, cond):
        ok.append(bool(cond))
        print("  [%s] %s" % ("PASS" if cond else "FAIL", name))

    p = params()
    cmd_run()
    B = build_all(p)
    good = True
    for k in B:
        n, lo, hi = read_stl(os.path.join(D3S, k + ".stl"))
        good &= n > 0
    check("all %d station STL files readable back, triangles > 0" % len(B), good)
    wt = all(edges_even(B[k][0]) for k in ("pd_station_agv", "check_station_tu1", "pick_station_z31", "hmc_load_station"))
    check("station meshes closed (every edge used an even number of times)", wt)
    pd = B["pd_station_agv"][0].meta
    check("AGV deck top %.0f within 700 +-3" % pd["deck_top"], abs(pd["deck_top"] - 700) <= 3)
    check("AGV gap = %d mm (front %.0f, lane start %.0f)" % (p["agv_gap"], pd["agv_front"], pd["lane_start"]), abs(pd["lane_start"] - pd["agv_front"] - p["agv_gap"]) < 1e-6)
    check("guide inner half-width %.0f = 400 + 25" % pd["guide_inner"], abs(pd["guide_inner"] - 425) < 1e-6)
    ck = B["check_station_tu1"][0].meta
    check("contour grids at x = +-%.0f (= 400 + w_lim) and z = %.0f (= top + h_lim %d)" % (ck["grid_x"], ck["grid_z"], p["st"]["check"]["h_lim"]),
          ck["grid_x"] == 400 + p["st"]["check"]["w_lim"] and ck["grid_z"] == p["top"] + p["st"]["check"]["h_lim"])
    check("4 load cells under TU1, one runner sensor per runner", len(ck["cells"]) == 4 and ck["runner_sensors"] == p["run_y"])
    pk = B["pick_station_z31"][0].meta
    ix0, iy0, iz0, ix1, iy1, iz1 = pk["inner"]
    inside = all(b[0] >= ix0 - 1e-6 and b[1] >= iy0 - 1e-6 and b[2] >= iz0 - 1e-6 and b[3] <= ix1 + 1e-6 and b[4] <= iy1 + 1e-6 and b[5] <= iz1 + 1e-6 for b in pk["bins"])
    overlap = any(not (a[3] <= b[0] or b[3] <= a[0] or a[4] <= b[1] or b[4] <= a[1] or a[5] <= b[2] or b[5] <= a[2]) for i, a in enumerate(pk["bins"]) for b in pk["bins"][i + 1:])
    check("8 bins inside the crate inner envelope, no overlap", len(pk["bins"]) == 8 and inside and not overlap)
    big = 2 * 280 <= (iz1 - iz0) and 2 * 400 <= (ix1 - ix0) and 2 * 600 <= (iy1 - iy0)
    check("finding: 8 bins 600 x 400 x 280 (2 layers) do NOT fit the crate inner %.0f x %.0f x %.0f" % (ix1 - ix0, iy1 - iy0, iz1 - iz0), not big)
    check("Z31: crate runners (y) cross the rollers (axis x)", pk["roller_axis"] == "x" and pk["runner_axis"] == "y")
    check("pick platform %d mm, 2 trolley places" % pk["platform_h"], pk["platform_h"] == 300 and len(pk["trolleys"]) == 2)
    fl = B["flow_rack_lane"][0].meta
    sl = (fl["roller_top"][0] - fl["roller_top"][-1]) / (fl["roller_x"][-1] - fl["roller_x"][0])
    check("flow lane slope in the model %.3f %% = 5.5 +- 0.1 %%" % (100 * sl), abs(100 * sl - 5.5) <= 0.1)
    bd = [b - a for a, b in zip(fl["brakes"], fl["brakes"][1:])]
    check("brake rollers every %.0f mm (%d brakes on %.1f m: always >= 1 under a 1200 crate)" % (p["brake_dx"], len(fl["brakes"]), fl["L"] / 1000),
          all(abs(x - 1050) < 1e-6 for x in bd) and len(fl["brakes"]) >= int((fl["L"] - 150) // 1050))
    check("separator 1400 mm before the exit (holds crate 2)", abs(fl["sep_x"] - (fl["x0"] + fl["L"] - 1400)) < 1e-6)
    vm = B["flow_rack_vmc"][0].meta
    want = [r["part"] for r in p["lanes"] if r["dept"] == "VMC"]
    check("VMC block: every flow_lanes.csv lane present (%d)" % len(want), [i["label"] for i in vm["lanes"]] == want)
    ret = [i for i in vm["lanes"] if i["label"].startswith("empty")][0]
    check("powered return lane: AGV-side end = deck height 700, machine-side end = flow-lane exit height",
          abs(ret["entry_top"] - p["top"]) < 1e-6 and abs(ret["exit_top"] - (p["flow_top"] - p["slope"] * p["st"]["flow"]["lane_len_m"] * 1000)) < 1e-6)
    hm = B["hmc_load_station"][0].meta
    check("light curtain %.0f mm from the shuttle hazard (>= %d)" % (hm["hazard_y"] - hm["lc_y"], p["lc_S"]), hm["hazard_y"] - hm["lc_y"] >= p["lc_S"] - 1e-6)
    tb = hm["tomb_bbox"]
    check("table top 900, tombstone 400 x 400 x 800", hm["table_top"] == 900 and (tb[3] - tb[0], tb[4] - tb[1], tb[5] - tb[2]) == (400, 400, 800))
    check("6 swing clamps D%d (3 per crankcase)" % p["st"]["hmc"]["clamp_bore"], len(hm["clamps"]) == 6)
    check("jib crane radius %d mm" % hm["jib"][2], hm["jib"][2] == 3000)
    good = True
    for f in ("D16_pd_station_agv_docking", "D17_check_station_tu1", "D18_pick_station_z31", "D19_flow_rack", "D20_hmc_load_station"):
        try:
            ET.parse(os.path.join(DRW, f + ".svg"))
            txt = open(os.path.join(DRW, f + ".svg"), encoding="utf-8").read()
            good &= "DESIGN - to be checked and released by the responsible engineer" in txt and "F4-ST-D" in txt
        except ET.ParseError:
            good = False
    check("5 drawings D16-D20 well-formed SVG with title block", good)
    good = True
    for f in os.listdir(D3S):
        if f.endswith(".scad"):
            s = open(os.path.join(D3S, f), encoding="utf-8").read()
            good &= s.count("(") == s.count(")") and s.count("[") == s.count("]") and s.count("{") == s.count("}")
    check("OpenSCAD sources balanced (%d files)" % len([f for f in os.listdir(D3S) if f.endswith(".scad")]), good)
    with open(os.path.join(DRW, "dimension_table.csv"), encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    n_old = sum(1 for r in rows[1:] if r[0] not in STATION_ROWS)
    n_new = sum(1 for r in rows[1:] if r[0] in STATION_ROWS)
    check("dimension table: F4.2 rows kept (%d) + station rows appended (%d)" % (n_old, n_new), n_old >= 45 and n_new == len(dim_rows(p, hm, fl)))
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
