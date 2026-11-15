#!/usr/bin/env python3
"""Final thesis item F4.2 (3D part) - 3D models (binary STL + OpenSCAD) and A3 drawings (SVG) of the conveyor modules.

Python 3 standard library only, offline. Geometry helpers (Mesh, STL, Sheet, View, iso preview) are imported from
../03_asrs/asrs_3d.py (item F3). All dimensions come from out/mech/module_specs.json (conv_mech.py run) and the zone
positions from out/design_result.json (conv_system.py run). Guide: Doctor paper/61, chapter 20.
DESIGN - check and release before manufacture.

Commands
  python conv_3d.py run        writes out/3d/*.stl, *.scad, preview_iso.svg and out/drw/D11..D15 *.svg, dimension_table.csv
  python conv_3d.py selftest   mesh / bounding box / orientation / zone / drawing checks

Module coordinates (local): x = travel direction of the module, y across, z up from the floor, origin = module centre on
the floor, conveyor top (chain top / roller top) at z = 700 mm. Assemblies: AS/RS front coordinates of F4.1 (x = 0 transfer
line at the aisle end, x < 0 away from the rack, y across the aisle), units mm.
"""

import argparse
import csv
import json
import math
import os
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "03_asrs"))
from asrs_3d import Mesh, write_stl, read_stl, Sheet, View, iso_preview, dot, cross  # noqa: E402

OUT = os.path.join(HERE, "out")
D3 = os.path.join(OUT, "3d")
DRW = os.path.join(OUT, "drw")


# ============================================================================ parameters
def params():
    with open(os.path.join(OUT, "mech", "module_specs.json"), encoding="utf-8") as fh:
        S = json.load(fh)
    with open(os.path.join(OUT, "design_result.json"), encoding="utf-8") as fh:
        R = json.load(fh)
    cc, rl, tu, cr = S["CC"], S["RL"], S["TU"], S["crate"]
    top = float(S["conveyor_top_mm"])
    p = {"top": top, "cL": cr["L_mm"], "cW": cr["W_mm"], "cH": cr["H_mm"], "run_w": cr["runner_w_mm"], "run_h": cr["runner_h_mm"],
         "run_y": cr["runner_y_mm"],
         "cc_L": cc["length"], "frame_in": cc["width_frames"] / 2.0, "gauge": cc["gauge"], "chain": cc["chain"], "ch_p": cc["pitch"],
         "spr_z": cc["sprocket_z"], "d0": cc["sprocket_d0"], "shaft_d": cc["shaft_d"], "bearing": cc["bearing"], "cc_kW": cc["motor_kW"],
         "cc_i": cc["ratio"], "takeup": cc["takeup_mm"], "leg_pitch": cc["leg_pitch"],
         "rl_L": rl["length"], "rl_pitch": rl["roller_pitch"], "rl_n": rl["rollers"], "rD": rl["roller_D"], "rt": rl["roller_t"],
         "rLen": rl["roller_L"], "rl_frame_in": rl["width_frames"] / 2.0, "axle": rl["axle"], "rl_kW": rl["motor_kW"], "rl_i": rl["ratio"],
         "tu_L": tu["length"], "tu_n": tu["roller_part"]["rollers"], "tu_pitch": tu["roller_part"]["pitch"], "stroke": tu["stroke"],
         "ecc": tu["eccentric_e"], "tu_kW": tu["lift_motor_kW"], "tu_i": tu["lift_ratio"],
         "pd": S["PD_end"], "zones": R["asrs_front_zones"], "stations": R["stations"]}
    # derived design choices of this sub-item (written to the dimension table)
    p["ch_h"] = 16.0                                   # chain plate height 12B (shown as a bar)
    p["ch_b"] = 25.0                                   # chain width over plates (shown)
    p["ch_c"] = top - p["ch_h"] / 2                    # chain centre line, top strand
    p["shaft_z"] = p["ch_c"] - p["d0"] / 2             # sprocket / shaft centre
    p["ret_c"] = p["shaft_z"] - p["d0"] / 2            # return strand centre line
    p["spr_x"] = p["cc_L"] / 2 - 90                    # sprocket centre from module centre (drive +, idler -)
    p["frame_t"], p["frame_h"], p["frame_b"] = 5.0, 160.0, 65.0
    p["frame_top"] = top - 10                          # side frame 10 mm below the conveyor top
    p["leg"] = 80.0
    p["roll_c"] = top - p["rD"] / 2                    # roller centre RL / RCX
    p["tu_roll_len"] = 960.0                           # TU rollers (axis x) kept clear of the chain shafts
    p["tu_down"] = top - 15.0                          # TU roller top, down position (15 mm below the chain top)
    # RCX (Z31) between the TU frames: TU centres +-1400, TU outer width 2 x (655 + 65) -> clear gap 2 x (1400 - 720) = 1360
    p["rcx_L"] = 2 * (abs(p["zones"]["CV2"][-1][3]) * 1000 - (p["frame_in"] + p["frame_b"])) - 20
    return p


# ============================================================================ mesh helpers
class PMesh(Mesh):
    """Mesh that also logs its primitives, so the OpenSCAD source is generated from the same geometry."""

    def __init__(self, name):
        Mesh.__init__(self, name)
        self.prims = []

    def box(self, x0, y0, z0, x1, y1, z1):
        self.prims.append(("box", min(x0, x1), min(y0, y1), min(z0, z1), max(x0, x1), max(y0, y1), max(z0, z1)))
        return Mesh.box(self, x0, y0, z0, x1, y1, z1)

    def cyl(self, c, axis, r, length, n=20):
        self.prims.append(("cyl", c, axis, r, length))
        return Mesh.cyl(self, c, axis, r, length, n)


def rotz(mesh, deg, dx=0.0, dy=0.0, dz=0.0):
    """Rotate about z by deg (rotation keeps the winding), then move."""
    a = math.radians(deg)
    c, s = round(math.cos(a), 12), round(math.sin(a), 12)
    m = Mesh(mesh.name)
    for t in mesh.tris:
        m.tris.append(tuple((v[0] * c - v[1] * s + dx, v[0] * s + v[1] * c + dy, v[2] + dz) for v in t))
    return m


def scad_of(pm, title, p, keys):
    s = ["// %s - generated by conv_3d.py from out/mech/module_specs.json (F4.2) - units mm" % title,
         "// DESIGN - check and release before manufacture. Local axes: x travel, y across, z up, conveyor top z = %g." % p["top"], ""]
    for k in keys:
        s.append("%s = %s;" % (k, repr(p[k]) if not isinstance(p[k], str) else '"%s"' % p[k]))
    s += ["", "module %s() {" % pm.name]
    for pr in pm.prims:
        if pr[0] == "box":
            _, x0, y0, z0, x1, y1, z1 = pr
            s.append("  translate([%.2f, %.2f, %.2f]) cube([%.2f, %.2f, %.2f]);" % (x0, y0, z0, x1 - x0, y1 - y0, z1 - z0))
        else:
            _, c, ax, r, L = pr
            rot = {"x": "[0, 90, 0]", "y": "[90, 0, 0]", "z": "[0, 0, 0]"}[ax]
            s.append("  translate([%.2f, %.2f, %.2f]) rotate(%s) cylinder(r = %.2f, h = %.2f, center = true, $fn = 32);" % (c[0], c[1], c[2], rot, r, L))
    s += ["}", "%s();" % pm.name, ""]
    return "\n".join(s)


# ============================================================================ generators (local coordinates)
def side_frames(m, p, L):
    """Two cold-formed C profiles (web inside at y = +-frame_in, flanges outwards)."""
    z1 = p["frame_top"]
    z0 = z1 - p["frame_h"]
    t, b = p["frame_t"], p["frame_b"]
    for s in (-1, 1):
        yi = s * p["frame_in"]
        yo = s * (p["frame_in"] + t)
        m.box(-L / 2, yi, z0, L / 2, yo, z1)                               # web
        m.box(-L / 2, yi, z1 - t, L / 2, s * (p["frame_in"] + b), z1)      # top flange
        m.box(-L / 2, yi, z0, L / 2, s * (p["frame_in"] + b), z0 + t)      # bottom flange


def legs(m, p, xs, z_top):
    lg = p["leg"]
    for x in xs:
        for s in (-1, 1):
            yc = s * (p["frame_in"] + 40)
            m.box(x - lg / 2, yc - lg / 2, 10, x + lg / 2, yc + lg / 2, z_top)          # leg 80 x 80
            m.box(x - 80, yc - 80, 0, x + 80, yc + 80, 10)                            # base plate 160 x 160 x 10
        m.box(x - 30, -p["frame_in"], z_top - 60, x + 30, p["frame_in"], z_top)        # cross member


def gen_crate_runners(p, filled=True):
    """Crate 1200 (L, along y) x 800 (W, along x) x 600 (H, incl. runners) on 2 runners along L at x = -350 / +350.
    Local: origin = crate centre at the bottom of the runners."""
    m = PMesh("crate_runners")
    W, L, H, rh, rw = p["cW"], p["cL"], p["cH"], p["run_h"], p["run_w"]
    for xr in p["run_y"]:                     # runner positions across the 800 side
        m.box(xr - rw / 2, -L / 2, 0, xr + rw / 2, L / 2, rh)
    m.box(-W / 2, -L / 2, rh, W / 2, L / 2, rh + 20)              # floor plate
    t = 4.0
    m.box(-W / 2, -L / 2, rh, W / 2, -L / 2 + t, H)
    m.box(-W / 2, L / 2 - t, rh, W / 2, L / 2, H)
    m.box(-W / 2, -L / 2 + t, rh, -W / 2 + t, L / 2 - t, H)
    m.box(W / 2 - t, -L / 2 + t, rh, W / 2, L / 2 - t, H)
    if filled:
        m.box(-W / 2 + 40, -L / 2 + 40, rh + 20, W / 2 - 40, L / 2 - 40, rh + 20 + 0.5 * (H - rh - 20))
    return m


def chain_part(m, p, L):
    """2 chain strands (top + return) with guides, drive and idler shafts, sprockets, bearing units, take-up."""
    g2 = p["gauge"] / 2
    hb = p["ch_b"] / 2
    hh = p["ch_h"] / 2
    xs = p["spr_x"]
    for s in (-1, 1):
        y = s * g2
        m.box(-xs, y - hb, p["ch_c"] - hh, xs, y + hb, p["ch_c"] + hh)                  # top strand (chain top = 700)
        m.box(-xs, y - hb, p["ret_c"] - hh, xs, y + hb, p["ret_c"] + hh)                # return strand
        m.box(-xs + 40, y - 20, p["ch_c"] - hh - 22, xs - 40, y + 20, p["ch_c"] - hh)   # C guide + UHMW-PE wear strip
        m.box(-xs + 40, y - 20, p["ret_c"] - hh - 14, xs - 40, y + 20, p["ret_c"] - hh) # return guide
        for x in (-xs, xs):
            m.cyl((x, y, p["shaft_z"]), "y", p["d0"] / 2 + 6, 14, 24)                   # sprocket (tip circle)
    shL = 2 * (p["frame_in"] + 80)
    for x in (-xs, xs):
        m.cyl((x, 0.0, p["shaft_z"]), "y", p["shaft_d"] / 2, shL, 16)                   # shafts
        for s in (-1, 1):                                                                 # insert bearing units outside the webs
            y0 = s * (p["frame_in"] + p["frame_t"] + 2)
            y1 = s * (p["frame_in"] + p["frame_t"] + 42)
            wx = 45 if x > 0 else 45 + p["takeup"] / 2                                   # idler side: take-up slide
            m.box(x - wx, y0, p["shaft_z"] - 35, x + wx, y1, p["shaft_z"] + 35)
    # hollow-shaft helical-bevel gear motor on the drive shaft (y > 0), torque arm to the frame
    yg0 = p["frame_in"] + p["frame_t"] + 46
    m.box(xs - 75, yg0, p["shaft_z"] - 80, xs + 75, yg0 + 120, p["shaft_z"] + 40)        # gear unit
    m.cyl((xs - 75 - 110, yg0 + 60, p["shaft_z"] - 30), "x", 55, 220, 20)                # motor along x
    m.box(xs - 20, yg0 + 10, p["shaft_z"] - 160, xs + 20, yg0 + 30, p["shaft_z"] - 80)   # torque arm
    # sensors (slow-down / stop) on the frame, 250 / 60 mm before the zone end
    for xx in (L / 2 - 250, L / 2 - 60):
        m.box(xx - 15, -p["frame_in"] - 30, p["top"] - 40, xx + 15, -p["frame_in"] - 5, p["top"] - 10)


def gen_cc(p):
    m = PMesh("cc")
    L = p["cc_L"]
    side_frames(m, p, L)
    chain_part(m, p, L)
    legs(m, p, [-L / 2 + 80], p["frame_top"] - p["frame_h"])
    m.box(-30, -p["frame_in"], p["frame_top"] - p["frame_h"], 30, p["frame_in"], p["frame_top"] - p["frame_h"] + 30)  # tie
    return m


def gen_rl(p, name="rl", L=None):
    """Chain-driven live roller zone: rollers axis y, pitch along x; double sprockets and loops on the +y side."""
    p = dict(p, frame_in=p["rl_frame_in"])          # roller zones: own frame width (rollers 1000, F4.2 ch. 17)
    m = PMesh(name)
    L = L or p["rl_L"]
    side_frames(m, p, L)
    r = p["rD"] / 2
    x0 = -(p["rl_n"] - 1) / 2 * p["rl_pitch"]
    xs = [x0 + k * p["rl_pitch"] for k in range(p["rl_n"])]
    y_tube0, y_tube1 = -p["rLen"] / 2, p["rLen"] / 2 - 60
    for x in xs:
        m.cyl((x, (y_tube0 + y_tube1) / 2, p["roll_c"]), "y", r, y_tube1 - y_tube0, 24)        # roller tube
        m.cyl((x, 0.0, p["roll_c"]), "y", p["axle"] / 2, 2 * p["frame_in"] + 2 * p["frame_t"] + 20, 12)   # axle
        m.cyl((x, y_tube1 + 25, p["roll_c"]), "y", 28.5, 30, 20)                              # double sprocket 08B z14
    for k in range(len(xs) - 1):                                                              # chain loops (alternating tracks)
        yy = y_tube1 + (15 if k % 2 == 0 else 35)
        m.box(xs[k], yy - 4, p["roll_c"] - 31, xs[k + 1], yy + 4, p["roll_c"] - 25)
        m.box(xs[k], yy - 4, p["roll_c"] + 25, xs[k + 1], yy + 4, p["roll_c"] + 31)
    # chain guard (EN ISO 13857) over the sprockets, inside the frame, top just below the conveyor top
    m.box(-L / 2, y_tube1 + 3, p["roll_c"] - 45, L / 2, y_tube1 + 5, p["top"] + 10)       # guard: chain on z14 rises 4.4 mm above the roller top
    m.box(-L / 2, y_tube1 + 3, p["top"] + 8, L / 2, p["frame_in"] - 2, p["top"] + 10)
    # gear motor under the last roller, outside the frame (+y), chain to roller 1
    yg = p["frame_in"] + p["frame_t"] + 10
    m.box(xs[-1] - 60, yg, p["roll_c"] - 230, xs[-1] + 60, yg + 110, p["roll_c"] - 110)
    m.cyl((xs[-1] - 60 - 90, yg + 55, p["roll_c"] - 170), "x", 45, 180, 20)
    m.box(xs[-1] - 20, y_tube1 + 20, p["roll_c"] - 150, xs[-1] + 20, yg + 20, p["roll_c"] - 30)   # drive chain cover
    legs(m, p, [-L / 2 + 80], p["frame_top"] - p["frame_h"])
    # sensors
    for xx in (L / 2 - 250, L / 2 - 60):
        m.box(xx - 15, -p["frame_in"] - 30, p["top"] - 40, xx + 15, -p["frame_in"] - 5, p["top"] - 10)
    m.meta = {"roller_x": xs, "roller_top": p["roll_c"] + r, "L": L}
    return m


def gen_tu(p, up=False):
    """Chain part (x) as CC + roller set (rollers axis x, pitch along y) lifted by 2 eccentric shafts (axis y)."""
    m = PMesh("tu_up" if up else "tu")
    L = p["tu_L"]
    side_frames(m, p, L)
    chain_part(m, p, L)
    legs(m, p, [-L / 2 + 80], p["frame_top"] - p["frame_h"])
    dz = p["stroke"] if up else 0.0
    rtop = p["tu_down"] + dz
    rc = rtop - p["rD"] / 2
    ys = [-(p["tu_n"] - 1) / 2 * p["tu_pitch"] + k * p["tu_pitch"] for k in range(p["tu_n"])]
    for y in ys:
        m.cyl((0.0, y, rc), "x", p["rD"] / 2, p["tu_roll_len"], 24)                          # rollers (axis x)
    hl = p["tu_roll_len"] / 2
    for x in (-hl - 15, hl + 15):                                                             # lifting frame side bars
        m.box(x - 15, ys[0] - 40, rc - 50, x + 15, ys[-1] + 40, rc - 20)
    for y in (ys[0] - 40, ys[-1] + 40):
        m.box(-hl - 30, y - 15, rc - 50, hl + 30, y + 15, rc - 30)
    # roller drive (tangential chain under the rollers) + motor
    m.box(-hl, -10, rc - 45, hl, 10, rc - 38)
    m.box(-hl + 40, ys[0] - 40 - 130, rc - 160, -hl + 160, ys[0] - 40 - 10, rc - 60)
    # 2 eccentric shafts (axis y) under the lifting frame, cam followers, coupling chain, lift brake motor
    ze = p["tu_down"] - p["rD"] / 2 - 90                                                      # eccentric shaft centre
    for x in (-300.0, 300.0):
        m.cyl((x, 0.0, ze), "y", 15, 2 * p["frame_in"] - 20, 16)
        for y in (ys[0] + 75, ys[-1] - 75):
            m.cyl((x, y, ze + p["ecc"] * (1 if up else -1) + 0), "y", 22, 20, 16)             # eccentric disc (e = 15)
            m.box(x - 12, y - 8, ze + 22 + (p["ecc"] if up else -p["ecc"]), x + 12, y + 8, rc - 50)   # cam follower post
    m.box(-300, -p["frame_in"] + 30, ze - 6, 300, -p["frame_in"] + 38, ze + 6)               # coupling chain 10B
    m.box(-300 - 70, -p["frame_in"] - p["frame_t"] - 160, ze - 70, -300 + 70, -p["frame_in"] - p["frame_t"] - 10, ze + 50)  # lift motor
    for x in (-hl - 15, hl + 15):                                                             # 4 linear guides
        for y in (ys[0] - 60, ys[-1] + 60):
            m.box(x - 10, y - 10, ze - 40, x + 10, y + 10, rc - 50)
    m.meta = {"roller_y": ys, "roller_top": rtop}
    return m


def gen_pd_end(p):
    """AGV side of a P&D lane: side guides with 15 deg lead-in, pop-up stop plate with 2 PU buffers."""
    m = PMesh("pd_end")
    gap = 25.0
    yg = p["cW"] / 2 + gap                      # crate 1200-leading on the lane: 800 across
    z0, z1 = p["top"] + 10, p["top"] + 70
    Lg = 600.0
    lead = 150.0
    off = lead * math.tan(math.radians(15))
    for s in (-1, 1):
        m.box(-Lg / 2 + lead, s * yg, z0, Lg / 2, s * (yg + 8), z1)                         # straight guide
        m.bar((-Lg / 2, s * (yg + off + 4), (z0 + z1) / 2), (-Lg / 2 + lead, s * (yg + 4), (z0 + z1) / 2), 8, z1 - z0)   # lead-in 15 deg
        m.box(-Lg / 2 + lead, s * (yg + 8), z0 - 80, -Lg / 2 + lead + 40, s * (yg + 40), z1)  # bracket
        m.box(Lg / 2 - 40, s * (yg + 8), z0 - 80, Lg / 2, s * (yg + 40), z1)
    # stop plate (10 mm) + 2 PU buffers, pneumatic-free electric pop-up
    m.box(Lg / 2 + 20, -300, p["top"] - 120, Lg / 2 + 30, 300, p["top"] + 60)
    for y in (-200.0, 200.0):
        m.cyl((Lg / 2 + 10, y, p["top"] + 20), "x", 25, 20, 16)
    m.box(Lg / 2 + 30, -60, p["top"] - 260, Lg / 2 + 110, 60, p["top"] - 120)               # stop actuator
    return m


# ============================================================================ assemblies
def zone_list(p):
    out = []
    for line in ("CV1", "CV2", "CV3"):
        for zid, typ, x, y, txt in p["zones"][line]:
            out.append((zid, typ, x * 1000.0, y * 1000.0, line))
    return out


def gen_front(p):
    """U-loop of F4.1. CC / TU: travel x (800-leading); Z31 RCX: travel y (1200-leading) -> RL rotated 90 deg."""
    cc, tu, rl, cr = gen_cc(p), gen_tu(p), gen_rl(p, "rcx", p["rcx_L"]), gen_crate_runners(p)
    m = Mesh("asrs_front_assembly")
    crates = []
    placed = []
    for zid, typ, x, y, line in zone_list(p):
        if typ == "CC":
            m.extend(cc.moved(x, y, 0))
            placed.append((zid, x, y, p["cc_L"], 2 * (p["frame_in"] + p["frame_b"])))
        elif typ == "TU":
            m.extend(tu.moved(x, y, 0))
            placed.append((zid, x, y, p["tu_L"], 2 * (p["frame_in"] + p["frame_b"])))
        else:
            m.extend(rotz(rl, 90, x, y, 0))
            placed.append((zid, x, y, 2 * (p["rl_frame_in"] + p["frame_b"]), p["rcx_L"]))
        if zid in ("TU1", "Z14", "Z16", "Z26", "Z24", "Z31"):
            crates.append((zid, x, y))
    cm = Mesh("crates")
    for zid, x, y in crates:
        cm.extend(cr.moved(x, y, p["top"]))
    # operator platform + fence posts (x = -7.0 m, between the AGV docks)
    m.box(-7600, -900, 0, -6800, 900, 150)
    for y in (-950.0, 950.0):
        for x in (-8000.0, -7350.0, -6700.0):
            m.box(x - 30, y - 30, 0, x + 30, y + 30, 1400)
        m.box(-8000, y - 15, 1350, -6700, y + 15, 1400)
    return m, cm, placed


def gen_pd_station(p):
    """HMC P&D station of F4.1: inbound lane 10 zones, outbound lane 3 zones, PD_end at the AGV side (x = 0), lanes along +x."""
    st = [s for s in p["stations"] if s["dept"] == "HMC"][0]
    n_in, n_out = st["in_places"], st["out_places"]
    rl, end, cr = gen_rl(p), gen_pd_end(p), gen_crate_runners(p)
    W = 2 * (p["rl_frame_in"] + p["frame_b"])
    ylane = {"in": -(W / 2 + 150), "out": (W / 2 + 150)}
    m = Mesh("pd_station_assembly")
    cm = Mesh("crates_pd")
    for lane, n in (("in", n_in), ("out", n_out)):
        y = ylane[lane]
        for k in range(n):
            x = p["rl_L"] / 2 + k * p["rl_L"]
            m.extend(rl.moved(x, y, 0))
            if (lane == "in" and k in (0, 3, 4, 7, 8, 9)) or (lane == "out" and k == 0):
                cm.extend(rotz(cr, 90, x, y, p["top"]))           # 1200-leading: crate L along the lane (x)
        m.extend(rotz(end, 180, 300.0, y, 0))                     # stop towards the AGV side, lead-in facing the AGV
    return m, cm, {"n_in": n_in, "n_out": n_out, "lane_y": ylane, "W": W}


# ============================================================================ drawings
def sheet_save(sh, path):
    sh.save(path)
    s = open(path, encoding="utf-8").read()
    s = s.replace("Combined FMS VC20 + RB - item F3 AS/RS", "Combined FMS VC20 + RB - item F4.2 conveyors")
    s = s.replace(">asrs_3d.py<", ">conv_3d.py<")
    s = s.replace("Generated from design_result.json (F3).", "Generated from module_specs.json (F4.2).")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(s)


def bom_rows(module):
    with open(os.path.join(OUT, "mech", "bom_modules.csv"), encoding="utf-8") as fh:
        return [r for r in csv.DictReader(fh) if r["module"] == module]


def parts_table(sh, module, x, y, wdesc=128):
    rows = [["Pos", "Description", "Qty"]] + [[r["pos"], r["description"][:70], r["qty_per_module"]] for r in bom_rows(module)]
    sh.table(x, y, rows, [12, wdesc, 12], 4.6, 2.1)
    return y + 4.6 * len(rows)


def balloon(sh, x, y, tx, ty, lab):
    sh.line(x, y, tx, ty, 0.18)
    sh.circle(tx, ty, 3.0, 0.25, "#ffffff")
    sh.text(tx, ty + 1.0, lab, 2.4, "middle", bold=True)


def draw_D11(p, path):
    sh = Sheet("F4-CONV-D11", "CC chain zone 1.2 m - side view, top view, parts", "1:15")
    L = p["cc_L"]
    # side view (x right, z up)
    V = View(90, 112, 15, "x", "z")
    sh.text(30, 20, "SIDE VIEW (from -y) 1:15", 3.0, bold=True)
    V.rect(sh, -L / 2, p["frame_top"] - p["frame_h"], L / 2, p["frame_top"], 0.35, "#dde7f3")
    for zc in (p["ch_c"], p["ret_c"]):
        V.rect(sh, -p["spr_x"], zc - p["ch_h"] / 2, p["spr_x"], zc + p["ch_h"] / 2, 0.25, "#cccccc")
    for x in (-p["spr_x"], p["spr_x"]):
        cx, cy = V.P(x, p["shaft_z"])
        sh.circle(cx, cy, (p["d0"] / 2 + 6) / 15, 0.3)
        sh.circle(cx, cy, p["shaft_d"] / 2 / 15, 0.3, "#888888")
    V.rect(sh, -L / 2, 0, -L / 2 + p["leg"], p["frame_top"] - p["frame_h"], 0.3)
    V.rect(sh, -L / 2 - 40, 0, -L / 2 + 120, 10, 0.3)
    sh.line(V.X(-L / 2 - 150), V.Y(0), V.X(L / 2 + 150), V.Y(0), 0.35)
    V.rect(sh, -p["cW"] / 2, p["top"], p["cW"] / 2, p["top"] + p["cH"], 0.25, dash="2 1")
    sh.text(V.X(0), V.Y(p["top"] + p["cH"] / 2), "crate 800-leading (ghost)", 2.2, "middle")
    sh.dim_h(V.X(-L / 2), V.X(L / 2), V.Y(0), V.Y(0) + 8, "%d" % L)
    sh.dim_h(V.X(-p["spr_x"]), V.X(p["spr_x"]), V.Y(p["shaft_z"]), V.Y(0) + 15, "%d (sprocket centres)" % (2 * p["spr_x"]))
    sh.dim_v(V.Y(0), V.Y(p["top"]), V.X(L / 2), V.X(L / 2) + 12, "%d top of chain" % p["top"])
    sh.dim_v(V.Y(0), V.Y(p["shaft_z"]), V.X(-L / 2), V.X(-L / 2) - 10, "%.1f" % p["shaft_z"])
    balloon(sh, V.X(-200), V.Y(p["frame_top"] - 80), V.X(-200), V.Y(p["frame_top"] - 80) + 16, "C1")
    balloon(sh, V.X(100), V.Y(p["ch_c"]), V.X(60), V.Y(p["ch_c"]) - 12, "C2")
    balloon(sh, V.X(250), V.Y(p["ch_c"] - 20), V.X(250), V.Y(p["ch_c"]) - 12, "C3")
    balloon(sh, V.X(p["spr_x"]), V.Y(p["shaft_z"] + 40), V.X(p["spr_x"]) + 10, V.Y(p["shaft_z"]) - 18, "C4")
    balloon(sh, V.X(-L / 2 + 40), V.Y(200), V.X(-L / 2 + 40) - 9, V.Y(200), "C9")
    balloon(sh, V.X(L / 2 - 250), V.Y(p["top"] - 25), V.X(L / 2 - 250) - 6, V.Y(380), "C10")
    # top view (x right, y up)
    T = View(90, 200, 15, "x", "y")
    sh.text(30, 140, "TOP VIEW 1:15", 3.0, bold=True)
    for s in (-1, 1):
        T.rect(sh, -L / 2, s * p["frame_in"], L / 2, s * (p["frame_in"] + p["frame_b"]), 0.3, "#dde7f3")
        T.rect(sh, -p["spr_x"], s * p["gauge"] / 2 - p["ch_b"] / 2, p["spr_x"], s * p["gauge"] / 2 + p["ch_b"] / 2, 0.25, "#cccccc")
    for x in (-p["spr_x"], p["spr_x"]):
        T.rect(sh, x - p["shaft_d"] / 2, -(p["frame_in"] + 80), x + p["shaft_d"] / 2, p["frame_in"] + 80, 0.25, "#888888")
        for s in (-1, 1):
            wx = 45 if x > 0 else 45 + p["takeup"] / 2
            T.rect(sh, x - wx, s * (p["frame_in"] + 7), x + wx, s * (p["frame_in"] + 47), 0.25, "#ffffff")
    yg0 = p["frame_in"] + p["frame_t"] + 46
    T.rect(sh, p["spr_x"] - 75, yg0, p["spr_x"] + 75, yg0 + 120, 0.3, "#f8cbad")
    T.rect(sh, p["spr_x"] - 75 - 220, yg0 + 5, p["spr_x"] - 75, yg0 + 115, 0.3, "#f8cbad")
    sh.dim_v(T.Y(-p["gauge"] / 2), T.Y(p["gauge"] / 2), T.X(-L / 2), T.X(-L / 2) - 8, "%d gauge" % p["gauge"])
    sh.dim_v(T.Y(-p["frame_in"]), T.Y(p["frame_in"]), T.X(-L / 2), T.X(-L / 2) - 16, "%d inside frames" % (2 * p["frame_in"]))
    balloon(sh, T.X(p["spr_x"]), T.Y(0), T.X(p["spr_x"]) + 14, T.Y(-120), "C5")
    balloon(sh, T.X(-p["spr_x"]), T.Y(0), T.X(-p["spr_x"]) + 14, T.Y(-120), "C6")
    balloon(sh, T.X(-p["spr_x"]), T.Y(-p["frame_in"] - 27), T.X(-p["spr_x"]) - 12, T.Y(-p["frame_in"] - 27) + 10, "C7")
    balloon(sh, T.X(p["spr_x"] - 100), T.Y(yg0 + 60), T.X(p["spr_x"] - 100) - 14, T.Y(yg0 + 60) - 8, "C8")
    sh.text(T.X(-p["spr_x"]) - 2, T.Y(-p["frame_in"]) + 13, "take-up %d mm" % p["takeup"], 2.2)
    yb = parts_table(sh, "CC", 228, 20)
    notes = ["Chain ISO 606 %s, p = %.2f, sprockets z = %d, d0 = %.1f" % (p["chain"], p["ch_p"], p["spr_z"], p["d0"]),
             "Drive shaft d %d C45E+N, bearings %s; gear motor %.2f kW, i = %d" % (p["shaft_d"], p["bearing"], p["cc_kW"], p["cc_i"]),
             "Chain top = conveyor top %d +-2 (adjust with the leg screws +-25)" % p["top"],
             "Wear strip UHMW-PE (PE 1000) on C guide, top and return strand",
             "Crate travels 800-leading: the 2 runners cross both chains"]
    for k, t in enumerate(notes):
        sh.text(228, yb + 8 + 5 * k, "- " + t, 2.4)
    sheet_save(sh, path)


def draw_D12(p, path):
    p = dict(p, frame_in=p["rl_frame_in"])
    sh = Sheet("F4-CONV-D12", "RL / RCX roller zone 1.4 m - top view, section A-A", "1:15")
    L = p["rl_L"]
    rl = gen_rl(p)
    xs = rl.meta["roller_x"]
    T = View(95, 75, 15, "x", "y")
    sh.text(30, 20, "TOP VIEW 1:15", 3.0, bold=True)
    for s in (-1, 1):
        T.rect(sh, -L / 2, s * p["frame_in"], L / 2, s * (p["frame_in"] + p["frame_b"]), 0.3, "#dde7f3")
    for x in xs:
        T.rect(sh, x - p["rD"] / 2, -p["rLen"] / 2, x + p["rD"] / 2, p["rLen"] / 2 - 60, 0.25, "#eeeeee")
        T.rect(sh, x - 28, p["rLen"] / 2 - 50, x + 28, p["rLen"] / 2 - 10, 0.2, "#cccccc")
    T.rect(sh, xs[-1] - 60, p["frame_in"] + 15, xs[-1] + 60, p["frame_in"] + 125, 0.3, "#f8cbad")
    sh.dim_h(T.X(xs[0]), T.X(xs[1]), T.Y(-p["rLen"] / 2), T.Y(-p["frame_in"] - p["frame_b"]) + 7, "%d" % p["rl_pitch"])
    sh.dim_h(T.X(-L / 2), T.X(L / 2), T.Y(-p["rLen"] / 2), T.Y(-p["frame_in"] - p["frame_b"]) + 15, "%d" % L)
    sh.dim_v(T.Y(-p["frame_in"]), T.Y(p["frame_in"]), T.X(-L / 2), T.X(-L / 2) - 8, "%d" % (2 * p["frame_in"]))
    sh.text(T.X(0), T.Y(0) + 1, "%d rollers, crate 1200-leading: runners cross the rollers" % p["rl_n"], 2.3, "middle")
    sh.text(T.X(-L / 2) + 2, T.Y(-p["frame_in"] - p["frame_b"]) - 3, "A", 3.0, bold=True)
    sh.text(T.X(-L / 2) + 2, T.Y(p["frame_in"] + p["frame_b"]) + 6, "A", 3.0, bold=True)
    balloon(sh, T.X(L / 2 - 60), T.Y(p["frame_in"] + 30), T.X(L / 2) + 10, T.Y(p["frame_in"] + 30) - 6, "R1")
    balloon(sh, T.X(xs[2]), T.Y(-200), T.X(xs[2]) + 6, T.Y(-200) + 9, "R2")
    balloon(sh, T.X((xs[3] + xs[4]) / 2), T.Y(p["rLen"] / 2 - 30), T.X((xs[3] + xs[4]) / 2), T.Y(p["rLen"] / 2 - 30) - 22, "R3")
    balloon(sh, T.X(xs[-1]), T.Y(p["frame_in"] + 70), T.X(xs[-1]) + 15, T.Y(p["frame_in"] + 70) - 14, "R4")
    # section A-A (y right, z up)
    S = View(95, 250, 15, "y", "z")
    sh.text(30, 160, "SECTION A-A 1:15", 3.0, bold=True)
    for s in (-1, 1):
        S.rect(sh, s * p["frame_in"], p["frame_top"] - p["frame_h"], s * (p["frame_in"] + p["frame_t"]), p["frame_top"], 0.3, "#dde7f3")
        S.rect(sh, s * p["frame_in"], p["frame_top"] - p["frame_t"], s * (p["frame_in"] + p["frame_b"]), p["frame_top"], 0.3, "#dde7f3")
    S.rect(sh, -p["rLen"] / 2, p["roll_c"] - p["rD"] / 2, p["rLen"] / 2 - 60, p["roll_c"] + p["rD"] / 2, 0.3, "#eeeeee")
    S.rect(sh, p["rLen"] / 2 - 50, p["roll_c"] - 28.5, p["rLen"] / 2 - 10, p["roll_c"] + 28.5, 0.25, "#cccccc")
    S.rect(sh, p["rLen"] / 2 - 57, p["roll_c"] - 45, p["frame_in"] - 2, p["top"] - 1, 0.25, dash="1.5 0.8")
    S.rect(sh, -p["cW"] / 2, p["top"], p["cW"] / 2, p["top"] + p["run_h"], 0.2, dash="2 1")
    for yr in p["run_y"]:
        S.rect(sh, yr - p["run_w"] / 2, p["top"], yr + p["run_w"] / 2, p["top"] + p["run_h"], 0.25, "#ffe699")
    sh.text(S.X(0), S.Y(p["top"] + p["run_h"]) - 2, "crate runners 100 x 160 (section across)", 2.2, "middle")
    sh.line(S.X(-760), S.Y(0), S.X(760), S.Y(0), 0.35)
    for s in (-1, 1):
        S.rect(sh, s * (p["frame_in"] + 40) - 40, 10, s * (p["frame_in"] + 40) + 40, p["frame_top"] - p["frame_h"], 0.25)
    sh.dim_v(S.Y(0), S.Y(p["top"]), S.X(-p["frame_in"] - p["frame_b"]), S.X(-p["frame_in"] - p["frame_b"]) - 8, "%d" % p["top"])
    sh.dim_h(S.X(-p["rLen"] / 2), S.X(p["rLen"] / 2), S.Y(p["roll_c"]), S.Y(0) + 10, "%d roller length" % p["rLen"])
    sh.text(S.X(0), S.Y(p["roll_c"]) + 1, "roller %d x %g, axle %d, bearings 6204" % (p["rD"], p["rt"], p["axle"]), 2.2, "middle")
    balloon(sh, S.X(p["rLen"] / 2 - 30), S.Y(p["top"] - 2), S.X(p["rLen"] / 2 - 30) + 10, S.Y(p["top"]) - 16, "R5")
    balloon(sh, S.X(-p["frame_in"] - 40), S.Y(250), S.X(-p["frame_in"] - 40) + 14, S.Y(250), "R6")
    yb = parts_table(sh, "RL", 228, 20)
    notes = ["Chain-driven live roller: %d loops 08B-1, double sprocket z = 14 per roller" % (p["rl_n"]),
             "Gear motor %.2f kW, i = %d, inverter-fed (F4.5)" % (p["rl_kW"], p["rl_i"]),
             "RCX (Z31) = the same design, %d mm long (fits between the TU frames), turned 90 deg" % p["rcx_L"],
             "Roller top = conveyor top %d +-2; rollers parallel within 1 mm / m" % p["top"]]
    for k, t in enumerate(notes):
        sh.text(228, yb + 8 + 5 * k, "- " + t, 2.4)
    sheet_save(sh, path)


def draw_D13(p, path):
    sh = Sheet("F4-CONV-D13", "TU transfer unit - section, lift positions, eccentric", "1:10 / 1:2")
    S = View(110, 110, 10, "y", "z")
    sh.text(30, 20, "SECTION through the TU (y right, z up) 1:10 - DOWN position", 3.0, bold=True)
    tu = gen_tu(p)
    ys = tu.meta["roller_y"]
    for s in (-1, 1):
        S.rect(sh, s * p["frame_in"], p["frame_top"] - p["frame_h"], s * (p["frame_in"] + p["frame_t"]), p["frame_top"], 0.3, "#dde7f3")
        S.rect(sh, s * p["gauge"] / 2 - p["ch_b"] / 2, p["ch_c"] - p["ch_h"] / 2, s * p["gauge"] / 2 + p["ch_b"] / 2, p["ch_c"] + p["ch_h"] / 2, 0.3, "#999999")
    for y in ys:
        cx, cy = S.P(y, p["tu_down"] - p["rD"] / 2)
        sh.circle(cx, cy, p["rD"] / 2 / 10, 0.3, "#eeeeee")
        cx, cy = S.P(y, p["tu_down"] + p["stroke"] - p["rD"] / 2)
        sh.circle(cx, cy, p["rD"] / 2 / 10, 0.2, "none")
    sh.line(S.X(-760), S.Y(p["top"]), S.X(760), S.Y(p["top"]), 0.2, "3 1", "#c00000")
    sh.text(S.X(760) + 2, S.Y(p["top"]) + 1, "chain top %d" % p["top"], 2.4, col="#c00000")
    sh.line(S.X(-600), S.Y(p["tu_down"]), S.X(600), S.Y(p["tu_down"]), 0.15, "1 1")
    sh.line(S.X(-600), S.Y(p["tu_down"] + p["stroke"]), S.X(600), S.Y(p["tu_down"] + p["stroke"]), 0.15, "1 1")
    sh.dim_v(S.Y(p["tu_down"]), S.Y(p["tu_down"] + p["stroke"]), S.X(600), S.X(600) + 14, "stroke %d" % p["stroke"])
    sh.text(S.X(-600) - 2, S.Y(p["tu_down"]) + 4, "roller top DOWN %d (-15)" % p["tu_down"], 2.2, "end")
    sh.text(S.X(-600) - 2, S.Y(p["tu_down"] + p["stroke"]) - 2, "roller top UP %d (+15)" % (p["tu_down"] + p["stroke"]), 2.2, "end")
    ze = p["tu_down"] - p["rD"] / 2 - 90
    for y in (ys[0] + 75, ys[-1] - 75):
        cx, cy = S.P(y, ze)
        sh.circle(cx, cy, 1.5, 0.3, "#888888")
        cx2, cy2 = S.P(y, ze - p["ecc"])
        sh.circle(cx2, cy2, 2.2, 0.3)
    S.rect(sh, ys[0] - 40, p["tu_down"] - p["rD"] - 50 + 30, ys[-1] + 40, p["tu_down"] - p["rD"] - 30 + 30, 0.25, "#dde7f3")
    balloon(sh, S.X(p["gauge"] / 2), S.Y(p["ch_c"]), S.X(p["gauge"] / 2) + 6, S.Y(p["ch_c"]) - 14, "T1")
    balloon(sh, S.X(ys[2]), S.Y(p["tu_down"] - 30), S.X(ys[2]) - 4, S.Y(p["tu_down"]) - 14, "T2")
    balloon(sh, S.X(ys[0] + 75), S.Y(ze), S.X(ys[0] + 75) - 10, S.Y(ze) + 12, "T3")
    balloon(sh, S.X(-p["frame_in"]), S.Y(ze - 20), S.X(-p["frame_in"]) - 14, S.Y(ze) + 12, "T4")
    balloon(sh, S.X(ys[-1] + 60), S.Y(ze + 20), S.X(ys[-1] + 60) + 12, S.Y(ze) + 12, "T5")
    balloon(sh, S.X(ys[-1] + 40), S.Y(p["tu_down"] - 80), S.X(ys[-1] + 40) + 16, S.Y(p["tu_down"] - 80) - 6, "T6")
    # detail B 1:2: one chain strand between two rollers, down and up
    B = View(100 - p["gauge"] / 2 / 2, 165 + p["top"] / 2, 2, "y", "z")
    sh.text(30, 140, "DETAIL B 1:2 - chain level vs roller level", 3.0, bold=True)
    B.rect(sh, p["gauge"] / 2 - p["ch_b"] / 2, p["ch_c"] - p["ch_h"] / 2, p["gauge"] / 2 + p["ch_b"] / 2, p["ch_c"] + p["ch_h"] / 2, 0.3, "#999999")
    for yy in (p["gauge"] / 2 - 75, p["gauge"] / 2 + 75):
        for zt, fill in ((p["tu_down"], "#eeeeee"), (p["tu_down"] + p["stroke"], "none")):
            cx, cy = B.P(yy, zt - p["rD"] / 2)
            sh.circle(cx, cy, p["rD"] / 2 / 2, 0.3, fill)
    for zl, lab, col in ((p["top"], "chain top %d" % p["top"], "#c00000"), (p["tu_down"], "down %d" % p["tu_down"], "#000"),
                         (p["tu_down"] + p["stroke"], "up %d" % (p["tu_down"] + p["stroke"]), "#000")):
        sh.line(B.X(p["gauge"] / 2 - 120), B.Y(zl), B.X(p["gauge"] / 2 + 120), B.Y(zl), 0.15, "1 1", col)
        sh.text(B.X(p["gauge"] / 2 + 122), B.Y(zl) + 1, lab, 2.0, col=col)
    sh.dim_v(B.Y(p["tu_down"]), B.Y(p["top"]), B.X(p["gauge"] / 2 - 120), B.X(p["gauge"] / 2 - 120) - 5, "15")
    sh.dim_v(B.Y(p["top"]), B.Y(p["tu_down"] + p["stroke"]), B.X(p["gauge"] / 2 - 120), B.X(p["gauge"] / 2 - 120) - 12, "15")
    # eccentric detail 1:2
    E = View(225, 172, 2, "y", "z")
    sh.text(195, 140, "DETAIL eccentric 1:2 (e = %g mm)" % p["ecc"], 3.0, bold=True)
    for ang, lab in ((-90, "DOWN (0 deg)"), (90, "UP (180 deg)")):
        cy = p["ecc"] * math.sin(math.radians(ang))
        cx0 = -40 if ang < 0 else 40
        c0 = E.P(cx0, 0)
        c1 = E.P(cx0, cy)
        sh.circle(c1[0], c1[1], 22 / 2, 0.35)
        sh.circle(c0[0], c0[1], 15 / 2, 0.3, "#888888")
        sh.text(c0[0], c0[1] + 25, lab, 2.3, "middle")
    sh.text(30, 210, "Top dead centre (UP): the cam follower load passes through the shaft axis -> no holding torque (self-locking).", 2.3)
    sh.text(30, 215, "Lift %d mm in %.1f s (180 deg at 20 rpm), brake gear motor %.2f kW, i = %d." % (p["stroke"], 1.5, p["tu_kW"], p["tu_i"]), 2.3)
    yb = parts_table(sh, "TU", 228, 20)
    notes = ["Chain part (x, 800-leading) identical to CC (drawing D11)",
             "Roller set (y, 1200-leading): %d rollers %d at pitch %d between the chains" % (p["tu_n"], p["rD"], p["tu_pitch"]),
             "Down: rollers 15 below the chain top; up: 15 above (crate on rollers)",
             "Sensors: lift up / lift down / cam position (T5); TU1 adds load cells + contour frame (F4.3)"]
    for k, t in enumerate(notes):
        sh.text(228, yb + 8 + 5 * k, "- " + t, 2.4)
    sheet_save(sh, path)


def draw_D14(p, placed, path):
    sh = Sheet("F4-CONV-D14", "AS/RS front U-loop - plan with zone positions", "1:50")
    V = View(220, 118, 50, "x", "y")
    sh.text(30, 20, "PLAN VIEW 1:50 (x = 0 transfer line at the aisle end, crate centre y = +-1400)", 3.0, bold=True)
    V.rect(sh, 600, -2050, 2400, 2050, 0.35, "#eeeeee")
    sh.text(V.X(700), V.Y(0), "rack + aisle", 2.6)
    col = {"CC": "#dde7f3", "TU": "#ffe0b3", "RCX": "#e8f7e8"}
    for zid, x, y, lx, ly in placed:
        typ = [z[1] for z in zone_list(p) if z[0] == zid][0]
        V.rect(sh, x - lx / 2, y - ly / 2, x + lx / 2, y + ly / 2, 0.3, col[typ])
        sh.text(V.X(x), V.Y(y) + 1, zid, 2.6, "middle", bold=True)
    for xd, y in ((-6000, -2750), (-6000, 2750), (-3600, 2750)):
        V.rect(sh, xd - 600, y - 550, xd + 600, y + 550, 0.3, dash="2 1")
    sh.text(V.X(-6000), V.Y(-2750) + 1, "AGV drop", 2.2, "middle")
    sh.text(V.X(-6000), V.Y(2750) + 1, "AGV pick 1", 2.2, "middle")
    sh.text(V.X(-3600), V.Y(2750) + 1, "AGV pick 2", 2.2, "middle")
    V.rect(sh, -7600, -900, -6800, 900, 0.3, "#fff2cc")
    sh.text(V.X(-7200), V.Y(0) + 1, "operator", 2.2, "middle", rot=-90)
    sh.dim_h(V.X(-6000), V.X(0), V.Y(-2050), V.Y(-3400), "6000")
    sh.dim_v(V.Y(-1400), V.Y(1400), V.X(0), V.X(0) + 8, "2800")
    rows = [["Zone", "Type", "x mm", "y mm", "Line"]] + [[z[0], z[1], "%.0f" % z[2], "%.0f" % z[3], z[4]] for z in zone_list(p)]
    sh.table(290, 20, rows, [16, 14, 18, 18, 14], 4.4, 2.2)
    notes = ["Chain zones and TU chain parts: travel x, crate 800-leading", "Z31 (RCX) and the TU roller parts: travel y, crate 1200-leading",
             "The crate keeps the same orientation everywhere (L along y)", "Positions = F4.1 out/design_result.json, tolerance +-5 mm"]
    for k, t in enumerate(notes):
        sh.text(290, 20 + 4.4 * len(rows) + 8 + 5 * k, "- " + t, 2.3)
    sheet_save(sh, path)


def draw_D15(p, info, path):
    sh = Sheet("F4-CONV-D15", "P&D station HMC - plan; crate base detail", "1:75 / 1:10")
    W = info["W"]
    V = View(40, 75, 75, "x", "y")
    sh.text(30, 20, "PLAN P&D station HMC 1:75 (AGV side at x = 0, lanes along +x)", 3.0, bold=True)
    for lane, n in (("in", info["n_in"]), ("out", info["n_out"])):
        y = info["lane_y"][lane]
        for k in range(n):
            x0 = k * p["rl_L"]
            V.rect(sh, x0, y - W / 2, x0 + p["rl_L"], y + W / 2, 0.25, "#dde7f3")
        sh.text(V.X(n * p["rl_L"]) + 3, V.Y(y) + 1, "%s lane %d zones x %d = %d mm" % (lane, n, p["rl_L"], n * p["rl_L"]), 2.4)
        V.rect(sh, -300, y - W / 2 + 120, 0, y + W / 2 - 120, 0.3, "#ffe0b3")
    V.rect(sh, -2200, -1600, -400, 1600, 0.3, dash="2 1")
    sh.text(V.X(-1300), V.Y(0) + 1, "AGV", 2.4, "middle")
    sh.dim_h(V.X(0), V.X(info["n_in"] * p["rl_L"]), V.Y(info["lane_y"]["in"] - W / 2), V.Y(info["lane_y"]["in"] - W / 2) + 8, "%d" % (info["n_in"] * p["rl_L"]))
    # crate base detail 1:10 - on rollers (1200-leading) and on chains (800-leading)
    D = View(60, 200, 10, "x", "z")
    sh.text(30, 125, "DETAIL crate base on the RL rollers (1200-leading) 1:10", 3.0, bold=True)
    rl = gen_rl(p)
    for x in rl.meta["roller_x"]:
        cx, cy = D.P(x + 700, p["roll_c"] - p["top"])
        sh.circle(cx, cy, p["rD"] / 2 / 10, 0.3, "#eeeeee")
    D.rect(sh, 100, 0, 1300, p["run_h"], 0.35, "#ffe699")
    D.rect(sh, 100, p["run_h"], 1300, p["run_h"] + 20, 0.25)
    n_under = sum(1 for x in rl.meta["roller_x"] if 100 <= x + 700 <= 1300)
    sh.text(D.X(700), D.Y(p["run_h"] / 2) + 1, "runner 100 x 160, 1200 long: %d rollers under it (rule >= 3)" % n_under, 2.3, "middle")
    sh.dim_h(D.X(100), D.X(1300), D.Y(0), D.Y(-p["rD"]) + 6, "1200")
    D2 = View(300, 200, 10, "x", "z")
    sh.text(230, 125, "DETAIL crate base on the CC chains (800-leading) 1:10", 3.0, bold=True)
    for xr in p["run_y"]:
        D2.rect(sh, xr - p["run_w"] / 2, 0, xr + p["run_w"] / 2, p["run_h"], 0.35, "#ffe699")
    D2.rect(sh, -p["cW"] / 2, p["run_h"], p["cW"] / 2, p["run_h"] + 20, 0.25)
    D2.rect(sh, -560, -p["ch_h"], 560, 0, 0.3, "#999999")
    sh.text(D2.X(0), D2.Y(-p["ch_h"]) + 5, "section along the travel (x): the 2 runners cross the chain strand", 2.2, "middle")
    sh.text(D2.X(0), D2.Y(-p["ch_h"]) + 9, "2 strands at y = +-%d (gauge %d) -> %d contacts" % (p["gauge"] / 2, p["gauge"], 2 * len(p["run_y"])), 2.2, "middle")
    sh.text(D2.X(0), D2.Y(-p["ch_h"]) + 14, "NOTE: on rollers the runners must also cross the rollers -> rollers only 1200-leading", 2.2, "middle", col="#c00000")
    sh.dim_h(D2.X(-p["cW"] / 2), D2.X(p["cW"] / 2), D2.Y(p["run_h"] + 20), D2.Y(p["run_h"] + 20) - 6, "%d" % p["cW"])
    notes = ["PD_end: side guides with 15 deg lead-in, gap 25 mm per side; stop plate 10 mm + 2 PU buffers",
             "AGV gap %d mm, AGV deck height tolerance +-%d mm" % (p["pd"]["agv_gap_mm"], p["pd"]["agv_height_tol_mm"]),
             "Lane places from F4.1 (Poisson rule + line-side crates)"]
    for k, t in enumerate(notes):
        sh.text(30, 228 + 5 * k, "- " + t, 2.3)
    sheet_save(sh, path)


def dimension_table(p, path):
    M, T2 = "ISO 2768-m", "ISO 2768-mK"
    rows = [["module", "feature", "value_mm", "tolerance", "source"],
            ["all", "conveyor top (chain top / roller top)", p["top"], "+-2", "module_specs"],
            ["crate", "L x W x H", "%d x %d x %d" % (p["cL"], p["cW"], p["cH"]), M, "module_specs"],
            ["crate", "runner width x height", "%d x %d" % (p["run_w"], p["run_h"]), M, "module_specs"],
            ["crate", "runner positions across the 800 side", "-350 / 0 / +350", "+-3", "module_specs"],
            ["CC", "zone length", p["cc_L"], "+-1", "module_specs"],
            ["CC", "inside width between frame webs", 2 * p["frame_in"], "+-2", "module_specs"],
            ["CC", "chain gauge (strand centres)", p["gauge"], "+-1", "module_specs"],
            ["CC", "chain", p["chain"], "-", "ISO 606"],
            ["CC", "sprocket pitch diameter", p["d0"], "-", "p/sin(180/z)"],
            ["CC", "sprocket centres", 2 * p["spr_x"], "+-0.5", "conv_3d"],
            ["CC", "shaft centre height", round(p["shaft_z"], 1), "+-0.5", "top - h/2 - d0/2"],
            ["CC", "return strand centre height", round(p["ret_c"], 1), "+-1", "conv_3d"],
            ["CC", "drive / idler shaft diameter", p["shaft_d"], "k6 at bearing", "module_specs"],
            ["CC", "bearing units", p["bearing"], "-", "module_specs"],
            ["CC", "take-up stroke", p["takeup"], "min", "module_specs"],
            ["CC/RL", "side frame C profile h x b x t", "%d x %d x %d" % (p["frame_h"], p["frame_b"], p["frame_t"]), "EN 10162", "conv_mech_data"],
            ["CC/RL", "frame top below conveyor top", 10, "+-1", "conv_3d"],
            ["CC/RL", "leg 80 x 80, base plate 160 x 160 x 10", "80 / 160", M, "conv_3d"],
            ["CC", "sensor slow-down / stop before zone end", "250 / 60", "+-5", "conv_mech"],
            ["RL", "zone length", p["rl_L"], "+-1", "module_specs"],
            ["RL", "rollers per zone", p["rl_n"], "-", "module_specs"],
            ["RL", "roller pitch", p["rl_pitch"], "+-0.5", "module_specs"],
            ["RL", "roller tube D x t", "%d x %g" % (p["rD"], p["rt"]), "EN 10305-3", "module_specs"],
            ["RL", "roller length", p["rLen"], "+-1", "module_specs"],
            ["RL", "roller centre height", p["roll_c"], "+-0.5", "top - D/2"],
            ["RL", "axle diameter", p["axle"], "h9", "module_specs"],
            ["RL", "roller sprocket 08B z14 d0", 57.1, "-", "ISO 606"],
            ["RCX", "zone length (between the TU1 / TU2 frames)", p["rcx_L"], "+-1", "conv_3d"],
            ["RL", "gear motor kW / ratio", "%.2f / %d" % (p["rl_kW"], p["rl_i"]), "-", "module_specs"],
            ["TU", "zone length", p["tu_L"], "+-1", "module_specs"],
            ["TU", "rollers (axis x) / pitch along y", "%d / %d" % (p["tu_n"], p["tu_pitch"]), "+-0.5", "module_specs"],
            ["TU", "roller length (clear of chain shafts)", p["tu_roll_len"], "+-1", "conv_3d"],
            ["TU", "roller top down", p["tu_down"], "+-1", "top - 15"],
            ["TU", "roller top up", p["tu_down"] + p["stroke"], "+-1", "top + 15"],
            ["TU", "lift stroke", p["stroke"], "+-0.5", "module_specs"],
            ["TU", "eccentricity", p["ecc"], "+-0.1", "module_specs"],
            ["TU", "eccentric shafts x position", "-300 / +300", "+-1", "conv_3d"],
            ["TU", "lift gear motor kW / ratio", "%.2f / %d" % (p["tu_kW"], p["tu_i"]), "-", "module_specs"],
            ["PD_end", "guide gap per side", 25, "+-2", "module_specs"],
            ["PD_end", "lead-in angle", "15 deg", "+-1 deg", "module_specs"],
            ["PD_end", "AGV gap / height tolerance", "%d / +-%d" % (p["pd"]["agv_gap_mm"], p["pd"]["agv_height_tol_mm"]), "-", "module_specs"],
            ["front", "TU1 / TU2 / TU3 centres x", "-6000 / -6000 / -3600", "+-5", "F4.1"],
            ["front", "CV1 / CV2 centre line y", "-1400 / +1400", "+-3", "F3 fork pick point"],
            ["front", "Z31 centre", "x -6000, y 0", "+-5", "F4.1"],
            ["front", "chain zone pitch along x", 1200, "+-2", "F4.1"]]
    keep = []                                       # rows appended by stations_3d.py (F4.3) survive a re-run of this program
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            keep = [r for r in csv.reader(fh) if r and (r[0] in ("PD station", "check TU1", "pick Z31", "flow rack", "HMC station") or r[0].startswith("ASM "))]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        csv.writer(fh).writerows(rows + keep)
    return len(rows) - 1


# ============================================================================ run / selftest
def build_all(p):
    mods = {"crate_runners": gen_crate_runners(p), "cc": gen_cc(p), "rl": gen_rl(p), "rcx": gen_rl(p, "rcx", p["rcx_L"]), "tu": gen_tu(p), "tu_up": gen_tu(p, True), "pd_end": gen_pd_end(p)}
    front, crates, placed = gen_front(p)
    pd, pdc, info = gen_pd_station(p)
    return mods, front, crates, placed, pd, pdc, info


SCAD_KEYS = {"crate_runners": ["cL", "cW", "cH", "run_w", "run_h"], "cc": ["top", "cc_L", "gauge", "d0", "shaft_d", "frame_in", "takeup"],
             "rl": ["top", "rl_L", "rl_pitch", "rl_n", "rD", "rLen", "axle"], "rcx": ["top", "rcx_L", "rl_pitch", "rl_n", "rD"], "tu": ["top", "tu_L", "tu_n", "tu_pitch", "stroke", "ecc"],
             "tu_up": ["top", "tu_L", "stroke"], "pd_end": ["top", "cW"]}


def cmd_run():
    os.makedirs(D3, exist_ok=True)
    os.makedirs(DRW, exist_ok=True)
    p = params()
    mods, front, crates, placed, pd, pdc, info = build_all(p)
    for k, m in mods.items():
        write_stl(m, os.path.join(D3, k + ".stl"))
        with open(os.path.join(D3, k + ".scad"), "w", encoding="utf-8") as fh:
            fh.write(scad_of(m, k, p, SCAD_KEYS[k]))
    fa = Mesh("asrs_front_assembly").extend(front).extend(crates)
    write_stl(fa, os.path.join(D3, "asrs_front_assembly.stl"))
    pa = Mesh("pd_station_assembly").extend(pd).extend(pdc)
    write_stl(pa, os.path.join(D3, "pd_station_assembly.stl"))
    # assembly SCAD: module placements
    s = ["// AS/RS front U-loop - generated by conv_3d.py (F4.2) from out/design_result.json (F4.1) - mm",
         "use <cc.scad>", "use <tu.scad>", "use <rcx.scad>", "use <crate_runners.scad>", ""]
    for zid, typ, x, y, line in zone_list(p):
        call = {"CC": "cc();", "TU": "tu();", "RCX": "rcx();"}[typ]
        rot = 90 if typ == "RCX" else 0
        s.append("translate([%.1f, %.1f, 0]) rotate([0, 0, %d]) %s   // %s" % (x, y, rot, call, zid))
    for zid in ("TU1", "Z14", "Z16", "Z26", "Z24", "Z31"):
        z = [q for q in zone_list(p) if q[0] == zid][0]
        s.append("translate([%.1f, %.1f, %.1f]) crate_runners();" % (z[2], z[3], p["top"]))
    with open(os.path.join(D3, "asrs_front_assembly.scad"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(s) + "\n")
    s = ["// P&D station HMC - generated by conv_3d.py (F4.2) - mm", "use <rl.scad>", "use <pd_end.scad>", ""]
    for lane, n in (("in", info["n_in"]), ("out", info["n_out"])):
        y = info["lane_y"][lane]
        for k in range(n):
            s.append("translate([%.1f, %.1f, 0]) rl();   // %s lane zone %d" % (p["rl_L"] / 2 + k * p["rl_L"], y, lane, k + 1))
        s.append("translate([300, %.1f, 0]) rotate([0, 0, 180]) pd_end();" % y)
    with open(os.path.join(D3, "pd_station_assembly.scad"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(s) + "\n")
    iso_preview([(front, (150, 175, 210)), (crates, (215, 160, 90))], os.path.join(D3, "preview_iso.svg"),
                "AS/RS front U-loop (F4.2) - chain zones, transfer units, Z31, crates")
    draw_D11(p, os.path.join(DRW, "D11_chain_zone_CC.svg"))
    draw_D12(p, os.path.join(DRW, "D12_roller_zone_RL.svg"))
    draw_D13(p, os.path.join(DRW, "D13_transfer_unit_TU.svg"))
    draw_D14(p, placed, os.path.join(DRW, "D14_asrs_front_U_loop.svg"))
    draw_D15(p, info, os.path.join(DRW, "D15_pd_station_crate_base.svg"))
    n = dimension_table(p, os.path.join(DRW, "dimension_table.csv"))
    print("written: %s (%d STL), %s (5 drawings, dimension table %d rows)" % (D3, len(mods) + 2, DRW, n))
    return 0


def selftest():
    ok = []

    def check(name, cond):
        ok.append(bool(cond))
        print("  [%s] %s" % ("PASS" if cond else "FAIL", name))

    p = params()
    vol = sum(dot(t[0], cross(t[1], t[2])) / 6 for t in rotz(Mesh("t").box(0, 0, 0, 10, 20, 30), 90, 5, 5).tris)
    check("rotation keeps outward winding (signed volume %.0f = 6000)" % vol, abs(vol - 6000) < 1e-6)
    cmd_run()
    names = ["crate_runners", "cc", "rl", "rcx", "tu", "tu_up", "pd_end", "asrs_front_assembly", "pd_station_assembly"]
    bb, good = {}, True
    for k in names:
        n, lo, hi = read_stl(os.path.join(D3, k + ".stl"))
        bb[k] = (lo, hi)
        good &= n > 0
    check("all %d STL files readable back, triangles > 0" % len(names), good)
    mods = build_all(p)[0]
    closed = True
    for k in ("cc", "rl", "tu"):
        v = sum(dot(t[0], cross(t[1], t[2])) / 6 for t in mods[k].tris)
        closed &= v > 0
    check("module meshes closed primitives with positive signed volume (CC, RL, TU)", closed)
    lo, hi = bb["cc"]
    check("CC length (x extent) %.1f = %d" % (hi[0] - lo[0], p["cc_L"]), abs((hi[0] - lo[0]) - p["cc_L"]) < 0.5)
    check("CC conveyor top (max z) %.1f = %d +-2" % (hi[2], p["top"]), abs(hi[2] - p["top"]) <= 2)
    ys = [v[1] for t in mods["cc"].tris for v in t if abs(v[2] - p["top"]) < 1e-6]
    g = (max(ys) - p["ch_b"] / 2) - (min(ys) + p["ch_b"] / 2)
    check("CC chain gauge from the mesh (top-strand vertices) %.1f = %d" % (g, p["gauge"]), abs(g - p["gauge"]) < 0.5)
    rl = mods["rl"]
    xs = rl.meta["roller_x"]
    check("RL %d rollers at pitch %d inside the %d mm zone" % (len(xs), p["rl_pitch"], p["rl_L"]),
          len(xs) == p["rl_n"] and all(abs(xs[k + 1] - xs[k] - p["rl_pitch"]) < 1e-9 for k in range(len(xs) - 1)) and xs[-1] - xs[0] + p["rD"] <= p["rl_L"])
    lo, hi = bb["rl"]
    check("RL roller top %.1f = %d +-2 (guard top %.0f outside the crate width), length %.0f = %d" % (rl.meta["roller_top"], p["top"], hi[2], hi[0] - lo[0], p["rl_L"]),
          abs(rl.meta["roller_top"] - p["top"]) <= 2 and hi[2] <= p["top"] + 12 and abs(hi[0] - lo[0] - p["rl_L"]) < 0.5)
    rx = gen_rl(p, "rcx", p["rcx_L"])
    check("RCX (Z31) shortened to %.0f mm fits between TU1 and TU2 and still carries %d rollers" % (p["rcx_L"], len(rx.meta["roller_x"])),
          p["rcx_L"] >= rx.meta["roller_x"][-1] - rx.meta["roller_x"][0] + p["rD"] and len(rx.meta["roller_x"]) == p["rl_n"])
    td, tu_ = mods["tu"].meta["roller_top"], mods["tu_up"].meta["roller_top"]
    check("TU roller top up - down = %.1f = stroke %d" % (tu_ - td, p["stroke"]), abs(tu_ - td - p["stroke"]) < 1e-9)
    check("TU rollers below the chain top when down (%.0f) and above when up (%.0f)" % (td, tu_), td < p["top"] < tu_)
    yr = mods["tu"].meta["roller_y"]
    clear = min(abs(abs(y) - p["gauge"] / 2) for y in yr) - p["rD"] / 2 - p["ch_b"] / 2
    check("TU rollers clear of the chain strands (%.1f mm side gap)" % clear, clear >= 10)
    _, _, placed, _, _, info = build_all(p)[1:]
    zl = {z[0]: z for z in zone_list(p)}
    R = json.load(open(os.path.join(OUT, "design_result.json"), encoding="utf-8"))["asrs_front_zones"]
    good = all(abs(zl[z[0]][2] - z[2] * 1000) < 1e-6 and abs(zl[z[0]][3] - z[3] * 1000) < 1e-6 for ln in R.values() for z in ln) and len(placed) == 13
    check("U-loop: 13 modules placed at the F4.1 zone positions", good)
    ov = 0.0
    boxes = [(zid, x - lx / 2, y - ly / 2, x + lx / 2, y + ly / 2) for zid, x, y, lx, ly in placed]
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            dx = min(a[3], b[3]) - max(a[1], b[1])
            dy = min(a[4], b[4]) - max(a[2], b[2])
            if dx > 1 and dy > 1:
                ov = max(ov, min(dx, dy))
    check("U-loop module footprints do not overlap (max overlap %.1f mm)" % ov, ov <= 1)
    # orientation: runner direction (crate L axis) vs chain direction / roller axis
    run_dir_cc = (0.0, 1.0)            # crate L along y on CC (800-leading, travel x)
    chain_dir = (1.0, 0.0)
    run_dir_rl = (1.0, 0.0)            # crate rotated 90 deg on the lane: L along x (1200-leading)
    roller_axis = (0.0, 1.0)
    check("runners cross the chains on CC (runner . chain = %.0f) and the rollers on RL (runner . roller axis = %.0f)" % (
        run_dir_cc[0] * chain_dir[0] + run_dir_cc[1] * chain_dir[1], run_dir_rl[0] * roller_axis[0] + run_dir_rl[1] * roller_axis[1]),
        abs(run_dir_cc[0] * chain_dir[0] + run_dir_cc[1] * chain_dir[1]) < 1e-12 and abs(run_dir_rl[0] * roller_axis[0] + run_dir_rl[1] * roller_axis[1]) < 1e-12)
    cr = mods["crate_runners"]
    rot = rotz(cr, 90)
    rx = [v[0] for t in rot.tris for v in t if v[2] < p["run_h"] - 1e-6]
    under = sum(1 for x in xs if min(rx) <= x <= max(rx))
    check("crate on RL (1200-leading): %d rollers under the runners >= 3" % under, under >= 3 and abs(max(rx) - min(rx) - p["cL"]) < 1e-6)
    lo, hi = bb["crate_runners"]
    rz = [v for t in cr.tris for v in t if v[2] <= p["run_h"] + 1e-6]
    check("crate: 2 runners %d x %d, bbox %.0f x %.0f x %.0f" % (p["run_w"], p["run_h"], hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]),
          abs(hi[1] - lo[1] - p["cL"]) < 1e-6 and abs(hi[0] - lo[0] - p["cW"]) < 1e-6 and abs(hi[2] - lo[2] - p["cH"]) < 1e-6 and len(cr.prims) >= 3)
    check("P&D station HMC: inbound %d and outbound %d zones (F4.1)" % (info["n_in"], info["n_out"]),
          info["n_in"] == [s for s in p["stations"] if s["dept"] == "HMC"][0]["in_places"] and info["n_out"] >= 2)
    svgs = sorted(f for f in os.listdir(DRW) if f.endswith(".svg") and f[:3] in ("D11", "D12", "D13", "D14", "D15"))
    good = len(svgs) == 5
    texts = {}
    for f in svgs:
        try:
            root = ET.parse(os.path.join(DRW, f)).getroot()
            txt = " ".join((e.text or "") for e in root.iter() if e.tag.endswith("text"))
            texts[f] = txt
            good &= ("DESIGN - to be checked and released by the responsible engineer" in txt) and ("F4-CONV-D1" in txt) and ("F4.2" in txt)
        except ET.ParseError:
            good = False
    check("5 drawings D11-D15 well-formed SVG with title block and status", good)
    pos_ok = True
    for f, mod in (("D11_chain_zone_CC.svg", "CC"), ("D12_roller_zone_RL.svg", "RL"), ("D13_transfer_unit_TU.svg", "TU")):
        for r in bom_rows(mod):
            pos_ok &= texts.get(f, "").count(r["pos"] + " ") + texts.get(f, "").split().count(r["pos"]) >= 2   # parts list + balloon
    check("every BOM position appears on its drawing (parts list + balloon)", pos_ok)
    try:
        ET.parse(os.path.join(D3, "preview_iso.svg"))
        check("iso preview well-formed", True)
    except ET.ParseError:
        check("iso preview well-formed", False)
    good, nsc = True, 0
    for f in os.listdir(D3):
        if f.endswith(".scad"):
            nsc += 1
            s = open(os.path.join(D3, f), encoding="utf-8").read()
            good &= s.count("{") == s.count("}") and s.count("(") == s.count(")") and s.count("[") == s.count("]")
    check("OpenSCAD sources: %d files, brackets balanced" % nsc, good and nsc == 9)
    with open(os.path.join(DRW, "dimension_table.csv"), encoding="utf-8") as fh:
        nrow = sum(1 for _ in fh) - 1
    check("dimension table >= 40 rows (%d)" % nrow, nrow >= 40)
    print("SELFTEST %s (%d/%d)" % ("PASS" if all(ok) else "FAIL", sum(ok), len(ok)))
    return 0 if all(ok) else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd")
    sp.add_parser("run")
    sp.add_parser("selftest")
    a = ap.parse_args(argv)
    if a.cmd == "run":
        return cmd_run()
    if a.cmd == "selftest":
        return selftest()
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
