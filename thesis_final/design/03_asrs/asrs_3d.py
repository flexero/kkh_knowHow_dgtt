#!/usr/bin/env python3
"""Final thesis item F3 (part A) - AS/RS 3D models (binary STL + parametric OpenSCAD) and 2D drawings (SVG, A3, title block).

Python 3 standard library only, offline. All dimensions come from out/design_result.json (written by asrs_design.py run).
Guide: Doctor paper/60_final_asrs.md (3D / drawing chapters).   DESIGN - check and release before manufacture.

Commands
  python asrs_3d.py run        writes out/3d/*.stl, *.scad, preview_iso.svg and out/drw/D01..D05 *.svg, dimension_table.csv
  python asrs_3d.py selftest   mesh / bounding-box / clearance / SVG checks (SELFTEST PASS n/n)

Coordinate system (as docs/31): x along the aisle (0 = I/O transfer point, rack starts at x = 1200 mm),
y across the aisle (crane axis 0, side L = -y, side R = +y), z up from the finished floor. Units: millimetres.
"""

import argparse
import csv
import json
import math
import os
import struct
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
D3 = os.path.join(OUT, "3d")
DRW = os.path.join(OUT, "drw")


# ============================================================================ parameters
def params():
    with open(os.path.join(OUT, "design_result.json"), encoding="utf-8") as fh:
        R = json.load(fh)
    rk, ri, cr, ci = R["rack"], R["rack_input"], R["crate"], R["crane"]["input"]
    p = {
        "bays": rk["bays"], "levels": rk["levels"], "bay": rk["bay_mm"], "L_rack": rk["length_m"] * 1000,
        "H_rack": rk["rack_height_m"] * 1000, "W_rack": rk["width_m"] * 1000, "clear_beam": rk["clear_beam_mm"],
        "z1": ri["z1_m"] * 1000, "pitch": ri["level_pitch_m"] * 1000, "up_w": ri["upright_w_mm"], "gap": ri["gap_mm"],
        "aisle": ri["aisle_mm"], "x0": 1200.0, "front_zone": ri["front_zone_m"] * 1000, "rear_zone": ri["rear_zone_m"] * 1000,
        "clear_h": ri["clear_height_m"] * 1000,
        "cL": cr["L_mm"], "cW": cr["W_mm"], "cH": cr["H_mm"], "c_leg": 160.0, "run_w": 100.0,
        "mast_h": ci["mast"]["h"], "mast_b": ci["mast"]["b"], "mast_t": ci["mast"]["t"],
        "H_mast": R["crane"]["mass"]["H_mast_m"] * 1000, "wheel_D": ci["wheel_D_mm"], "wheelbase": ci["wheelbase_m"] * 1000,
        "stroke": ci["fork_stroke_m"] * 1000, "drum_D": ci["drum_D_mm"], "conv_top": R["io"]["conveyor_top_m"] * 1000,
        "m_crane": R["crane"]["mass"]["m_crane"], "m_mast": R["crane"]["mass"]["m_mast"], "m_carriage": ci["m_carriage_kg"],
        "m_bottom": ci["m_bottom_kg"], "load": cr["max_gross_kg"],
        "P_travel": R["crane"]["drives"]["travel"]["motor_kW"], "P_hoist": R["crane"]["drives"]["hoist"]["motor_kW"],
        "P_fork": R["crane"]["drives"]["fork"]["motor_kW"],
        "i_travel": R["crane"]["drives"]["travel"]["ratio"], "i_hoist": R["crane"]["drives"]["hoist"]["ratio"],
        "i_fork": R["crane"]["drives"]["fork"]["ratio"], "positions": rk["positions"],
        "RAW_pos": R["zones"]["RAW_positions"], "KIT_pos": R["zones"]["KIT_positions"],
    }
    # derived (fixed design choices of this item, written into the dimension table)
    p["up_d"] = 80.0                                   # upright depth across the aisle (y)
    p["y_face"] = p["aisle"] / 2                       # 750: aisle face of the front upright
    p["frame_d"] = (p["W_rack"] - p["aisle"]) / 2      # 1300: frame depth per side
    p["y_rear"] = p["W_rack"] / 2                      # 2050
    p["y_crate0"] = p["y_face"] + 50                   # 800: crate front face (50 mm behind the upright face)
    p["y_crate_c"] = p["y_crate0"] + p["cL"] / 2       # 1400: crate centre (= pick point of the fork)
    p["beam_h"], p["beam_b"] = 120.0, 50.0
    p["tie_top"] = p["H_rack"]                         # longitudinal top tie 12480..12600
    p["z_frame_top"] = 300.0                           # low middle section of the crane bottom frame
    p["z_mast0"] = 300.0
    p["z_top0"] = p["H_mast"] - 200                    # top frame 12900..13100
    p["rail_top_z0"], p["rail_top_z1"] = p["H_mast"] + 30, p["H_mast"] + 150      # top guide rail 13130..13250
    p["tie_z0"], p["tie_z1"] = p["rail_top_z1"], p["rail_top_z1"] + 100          # cross ties 13250..13350
    p["fork_w"] = [450.0, 400.0, 350.0]
    p["fork_t"] = [60.0, 45.0, 35.0]
    p["fork_len"] = 1300.0
    p["carr_x"] = (-500.0, 300.0)                      # carriage x range (crane local)
    p["fork_xc"] = -100.0                              # fork centre x in crane local coordinates
    p["mast_x"] = (-1100.0, -1100.0 + p["mast_h"])     # mast 600 along x
    p["rail_x"] = (-2500.0, p["x0"] + p["L_rack"] + 2000.0)
    return p, R


def level_z(p, l):
    """Beam top (= crate bottom) of level l = 1..levels."""
    return p["z1"] + (l - 1) * p["pitch"]


def crate_x(p, bay, k):
    """Crate centre x of crate k (0/1) in bay (0..bays-1)."""
    xb = p["x0"] + bay * p["bay"]
    return xb + p["up_w"] + p["gap"] + p["cW"] / 2 + k * (p["cW"] + p["gap"])


# ============================================================================ mesh library
def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def mul(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def norm(a):
    L = math.sqrt(dot(a, a))
    return (a[0] / L, a[1] / L, a[2] / L) if L else (0.0, 0.0, 0.0)


class Mesh:
    """Triangle soup + primitive log (the log feeds the iso preview statistics only)."""

    def __init__(self, name):
        self.name = name
        self.tris = []

    def extend(self, other):
        self.tris.extend(other.tris)
        return self

    def _quad(self, a, b, c, d, centre):
        for t in ((a, b, c), (a, c, d)):
            n = cross(sub(t[1], t[0]), sub(t[2], t[0]))
            fc = mul(add(add(t[0], t[1]), t[2]), 1 / 3)
            if dot(n, sub(fc, centre)) < 0:
                t = (t[0], t[2], t[1])
            self.tris.append(t)

    def hexa(self, c):
        """8 corners, index = bu + 2 bv + 4 bd (u, v, d local axes) -> 12 outward triangles."""
        centre = mul(add(c[0], c[7]), 0.5)
        faces = ((0, 2, 6, 4), (1, 3, 7, 5), (0, 1, 5, 4), (2, 3, 7, 6), (0, 1, 3, 2), (4, 5, 7, 6))
        for f in faces:
            self._quad(c[f[0]], c[f[1]], c[f[2]], c[f[3]], centre)
        return self

    def box(self, x0, y0, z0, x1, y1, z1):
        xs, ys, zs = (min(x0, x1), max(x0, x1)), (min(y0, y1), max(y0, y1)), (min(z0, z1), max(z0, z1))
        c = [(xs[i & 1], ys[(i >> 1) & 1], zs[(i >> 2) & 1]) for i in range(8)]
        return self.hexa(c)

    def bar(self, p0, p1, w, h=None):
        """Square/rectangular bar between two points (bracing, diagonals)."""
        h = h or w
        d = norm(sub(p1, p0))
        a = (0.0, 0.0, 1.0) if abs(d[2]) < 0.9 else (1.0, 0.0, 0.0)
        u = norm(cross(d, a))
        v = cross(d, u)
        c = []
        for i in range(8):
            su = (w / 2) * (1 if i & 1 else -1)
            sv = (h / 2) * (1 if i & 2 else -1)
            base = p1 if i & 4 else p0
            c.append(add(add(base, mul(u, su)), mul(v, sv)))
        return self.hexa(c)

    def cyl(self, c, axis, r, length, n=20):
        """Cylinder centred at c, axis 'x'|'y'|'z', total length."""
        idx = "xyz".index(axis)
        e = [0.0, 0.0, 0.0]
        e[idx] = 1.0
        e = tuple(e)
        a = (0.0, 0.0, 1.0) if idx != 2 else (1.0, 0.0, 0.0)
        u = norm(cross(e, a))
        v = cross(e, u)
        p0 = add(c, mul(e, -length / 2))
        p1 = add(c, mul(e, length / 2))
        ring0, ring1 = [], []
        for k in range(n):
            t = 2 * math.pi * k / n
            off = add(mul(u, r * math.cos(t)), mul(v, r * math.sin(t)))
            ring0.append(add(p0, off))
            ring1.append(add(p1, off))
        for k in range(n):
            k2 = (k + 1) % n
            self._quad(ring0[k], ring0[k2], ring1[k2], ring1[k], add(c, mul(e, dot(sub(mul(add(ring0[k], ring1[k2]), 0.5), c), e))))
            for t in ((p0, ring0[k2], ring0[k]), (p1, ring1[k], ring1[k2])):
                nrm = cross(sub(t[1], t[0]), sub(t[2], t[0]))
                fc = mul(add(add(t[0], t[1]), t[2]), 1 / 3)
                if dot(nrm, sub(fc, c)) < 0:
                    t = (t[0], t[2], t[1])
                self.tris.append(t)
        return self

    def tube(self, x0, y0, z0, x1, y1, z1, t):
        """Hollow rectangular tube along z from 4 plates."""
        self.box(x0, y0, z0, x1, y0 + t, z1)
        self.box(x0, y1 - t, z0, x1, y1, z1)
        self.box(x0, y0 + t, z0, x0 + t, y1 - t, z1)
        self.box(x1 - t, y0 + t, z0, x1, y1 - t, z1)
        return self

    def moved(self, dx=0.0, dy=0.0, dz=0.0, mirror_y=False):
        m = Mesh(self.name)
        for t in self.tris:
            q = []
            for v in t:
                q.append((v[0] + dx, (-v[1] if mirror_y else v[1]) + dy, v[2] + dz))
            if mirror_y:
                q = [q[0], q[2], q[1]]          # keep outward winding after mirroring
            m.tris.append(tuple(q))
        return m

    def bbox(self):
        xs = [v[0] for t in self.tris for v in t]
        ys = [v[1] for t in self.tris for v in t]
        zs = [v[2] for t in self.tris for v in t]
        return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def write_stl(mesh, path):
    with open(path, "wb") as fh:
        hdr = ("binary STL %s mm - asrs_3d.py - DESIGN, check before manufacture" % mesh.name).encode("ascii")[:80]
        fh.write(hdr.ljust(80, b" "))
        fh.write(struct.pack("<I", len(mesh.tris)))
        for t in mesh.tris:
            n = norm(cross(sub(t[1], t[0]), sub(t[2], t[0])))
            fh.write(struct.pack("<12fH", *n, *t[0], *t[1], *t[2], 0))


def read_stl(path):
    with open(path, "rb") as fh:
        data = fh.read()
    n = struct.unpack("<I", data[80:84])[0]
    assert len(data) == 84 + 50 * n, "STL size mismatch"
    lo = [1e18] * 3
    hi = [-1e18] * 3
    for i in range(n):
        vals = struct.unpack("<12fH", data[84 + 50 * i: 134 + 50 * i])
        for k in range(3):
            v = vals[3 + 3 * k: 6 + 3 * k]
            for j in range(3):
                lo[j] = min(lo[j], v[j])
                hi[j] = max(hi[j], v[j])
    return n, tuple(lo), tuple(hi)


# ============================================================================ generators
def gen_crate(p, filled=True):
    """Steel box pallet 1200 (y) x 800 (x) x 600 (z, incl. runners): body on 2 runners 100 x 160 along the 1200 side at
    x = +-350 (F4.2 crate base): the fork enters between the runners (opening 600 mm), the runners cross the conveyor chains
    and rollers (final thesis F4.2 ch. 12; updated 2026-11-15 from 4 legs)."""
    m = Mesh("crate")
    W, L, H, leg = p["cW"], p["cL"], p["cH"], p["c_leg"]
    lw = p["run_w"]
    for sx in (-1, 1):
        x = sx * (W / 2 - lw / 2)
        m.box(x - lw / 2, -L / 2, 0, x + lw / 2, L / 2, leg)
    m.box(-W / 2, -L / 2, leg, W / 2, L / 2, leg + 20)                 # floor plate
    t = 4.0
    m.box(-W / 2, -L / 2, leg, W / 2, -L / 2 + t, H)                    # walls (mesh steel shown as plates)
    m.box(-W / 2, L / 2 - t, leg, W / 2, L / 2, H)
    m.box(-W / 2, -L / 2, leg, -W / 2 + t, L / 2, H)
    m.box(W / 2 - t, -L / 2, leg, W / 2, L / 2, H)
    if filled:
        m.box(-W / 2 + 40, -L / 2 + 40, leg + 20, W / 2 - 40, L / 2 - 40, leg + 20 + 0.55 * (H - leg - 20))
    return m


def gen_rack_side(p, side=+1):
    """One rack side (side R: +y). Uprights 100 x 80, bracing, beams 120 x 50, support rails, base plates, top tie."""
    m = Mesh("rack")
    yf0, yf1 = p["y_face"], p["y_face"] + p["up_d"]
    yr0, yr1 = p["y_rear"] - p["up_d"], p["y_rear"]
    for i in range(p["bays"] + 1):
        x = p["x0"] + i * p["bay"]
        for (a, b) in ((yf0, yf1), (yr0, yr1)):
            m.box(x - 25, a - 35, 0, x + p["up_w"] + 25, b + 35, 10)                 # base plate 150 x 150
            m.box(x, a, 10, x + p["up_w"], b, p["H_rack"])                           # upright
        xc = x + p["up_w"] / 2
        z = 150.0
        k = 0
        while z + 1250 <= p["H_rack"] - 100:
            m.bar((xc, yf1, z), (xc, yr0, z), 40)                                   # horizontal brace
            ya, yb = (yf1, yr0) if k % 2 == 0 else (yr0, yf1)
            m.bar((xc, ya, z), (xc, yb, z + 1250), 40)                              # diagonal brace
            z += 1250
            k += 1
        m.bar((xc, yf1, z), (xc, yr0, z), 40)
    for b in range(p["bays"]):
        xa = p["x0"] + b * p["bay"] + p["up_w"]
        xb = xa + p["clear_beam"]
        for l in range(1, p["levels"] + 1):
            zt = level_z(p, l)
            m.box(xa, yf1 - p["beam_b"], zt - p["beam_h"], xb, yf1, zt)              # front beam (aisle side)
            m.box(xa, yr0, zt - p["beam_h"], xb, yr0 + p["beam_b"], zt)              # rear beam
            for k in (0, 1):
                xc = crate_x(p, b, k)
                for sx in (-1, 1):
                    xr = xc + sx * (p["cW"] / 2 - 75)
                    m.box(xr - 20, yf1 - p["beam_b"], zt - 30, xr + 20, yr0 + p["beam_b"], zt)   # crate support rail
    xL, xR = p["x0"], p["x0"] + p["L_rack"]
    for (a, b) in ((yf0, yf1), (yr0, yr1)):
        m.box(xL, a, p["tie_top"] - 120, xR, b, p["tie_top"])                        # longitudinal top tie
    if side < 0:
        m = m.moved(mirror_y=True)
    return m


def gen_rack(p):
    m = Mesh("rack")
    m.extend(gen_rack_side(p, +1)).extend(gen_rack_side(p, -1))
    return m


def gen_rails(p):
    """Bottom rail 50 x 30 on the floor, end buffers, top guide rail 100 x 20 under cross ties on posts."""
    m = Mesh("rails")
    xa, xb = p["rail_x"]
    m.box(xa, -25, 0, xb, 25, 30)
    for x, s in ((xa, 1), (xb, -1)):
        m.box(x if s > 0 else x - 300, -200, 0, x + 300 if s > 0 else x, 200, 600)   # end stop block
        m.cyl((x + s * 360, 0, 450), "x", 80, 120)                                    # PU buffer
    m.box(p["x0"], -10, p["rail_top_z0"], p["x0"] + p["L_rack"], 10, p["rail_top_z1"])
    for i in range(0, p["bays"] + 1, 3):
        x = p["x0"] + i * p["bay"]
        for s in (-1, 1):
            y0 = s * p["y_face"]
            y1 = s * (p["y_face"] + p["up_d"])
            m.box(x, min(y0, y1), p["H_rack"], x + p["up_w"], max(y0, y1), p["tie_z1"])     # post on the front upright
        m.box(x, -(p["y_face"] + p["up_d"]), p["tie_z0"], x + p["up_w"], p["y_face"] + p["up_d"], p["tie_z1"])   # cross tie
        m.box(x + 30, -40, p["rail_top_z1"], x + p["up_w"] - 30, 40, p["tie_z0"] + 1)        # rail hanger
    return m


def gen_fork(p, ext=0.0, side=+1, z0=0.0):
    """3-stage telescopic fork, centred x = 0 (local), y = 0 retracted; ext = top-stage stroke (mm), side +1 / -1."""
    m = Mesh("fork")
    L = p["fork_len"]
    z = z0
    shifts = (0.0, ext / 2, ext)
    for k in range(3):
        w, t = p["fork_w"][k], p["fork_t"][k]
        dy = side * shifts[k]
        m.box(-w / 2, -L / 2 + dy, z, w / 2, L / 2 + dy, z + t)
        z += t
    return m


def gen_crane(p, fork_level=1, ext=0.0, side=+1):
    """Single-mast stacker crane in local coordinates: x = 0 bottom frame centre, fork centre at x = fork_xc."""
    m = Mesh("crane")
    r = p["wheel_D"] / 2
    zc = 30 + r                                                     # wheel centre on the 30 mm rail
    wb = p["wheelbase"] / 2
    # bottom frame: low middle section + wheel boxes at both ends
    for s in (-1, 1):
        m.box(-1500, s * 250, 120, 1600, s * 350, p["z_frame_top"])                        # side members
    for x in (-1450, -800, 800, 1550):
        m.box(x - 50, -250, 120, x + 50, 250, p["z_frame_top"])                           # cross members
    for xw in (-wb, wb):
        for s in (-1, 1):
            m.box(xw - 250, s * 60, 60, xw + 250, s * 250, 650)                            # wheel box cheeks
        m.cyl((xw, 0, zc), "y", r, 80, 28)                                                 # wheel D400
        m.cyl((xw, 0, zc), "y", 45, 520, 12)                                               # axle
    m.box(wb - 100, 260, 130, wb + 100, 340, 330)                                         # travel gearbox (outside cheek)
    m.cyl((wb - 400, 300, 230), "x", 40, 400, 16)                                          # travel motor (slim, along x)
    m.box(wb - 640, 250, 180, wb - 600, 350, 280)                                          # motor fan cover
    # hoist drum + motor at the rear end
    m.cyl((-1300, 0, p["z_frame_top"] + p["drum_D"] / 2 + 10), "y", p["drum_D"] / 2, 380, 24)
    m.box(-1480, 200, p["z_frame_top"], -1120, 340, p["z_frame_top"] + 340)                # hoist gear-motor block
    # mast (hollow box) 600 (x) x 400 (y) x t
    mx0, mx1 = p["mast_x"]
    hb = p["mast_b"] / 2
    m.tube(mx0, -hb, p["z_mast0"], mx1, hb, p["z_top0"], p["mast_t"])
    # top frame + guide rollers on the top rail
    m.box(-1300, -250, p["z_top0"], -300, 250, p["H_mast"])
    for x in (-1000, -600):
        for s in (-1, 1):
            m.box(x - 15, s * 50 - 15, p["H_mast"], x + 15, s * 50 + 15, p["rail_top_z0"] + 5)
            m.cyl((x, s * 50, p["rail_top_z0"] + 55), "z", 40, 100, 16)
    # cabinet on the +y face of the mast, ladder on the -y face
    m.box(mx0, hb, 700, mx1 - 50, hb + 350, 2200)
    for x in (mx0 + 50, mx1 - 50):
        m.box(x - 20, -hb - 60, p["z_mast0"], x + 20, -hb - 20, p["z_top0"])
    z = p["z_mast0"] + 300
    while z < p["z_top0"]:
        m.box(mx0 + 50, -hb - 50, z, mx1 - 50, -hb - 30, z + 20)
        z += 300
    # lifting carriage + fork at the given level (fork 10 mm above the beam top, i.e. under the crate body)
    zf = level_z(p, fork_level) + 10
    cx0, cx1 = p["carr_x"]
    m.box(cx0, -600, zf - 80, cx1, 600, zf)                                                # base plate
    m.box(cx0, -600, zf - 80, cx0 + 60, 600, zf + 420)                                     # back plate on the mast
    for s in (-1, 1):
        m.box(cx0, s * 600 - (20 if s > 0 else -20), zf - 80, cx1, s * 600, zf + 220)       # side plates
    for z in (zf - 40, zf + 380):
        for s in (-1, 1):
            m.cyl((cx0 - 30, s * 150, z), "y", 30, 60, 12)                                 # guide rollers on the mast face
    m.extend(gen_fork(p, ext, side, zf).moved(dx=p["fork_xc"]))
    return m


def gen_io(p):
    """Infeed (side L) and outfeed (side R) chain conveyors ending at the transfer point x = 0, contour gate, pick station."""
    m = Mesh("io")
    top = p["conv_top"]
    yc = p["y_crate_c"]
    for s in (-1, 1):
        x0, x1 = -6000.0, 400.0
        ya, yb = s * (yc - 625), s * (yc + 625)
        lo, hi = min(ya, yb), max(ya, yb)
        m.box(x0, lo, top - 200, x1, lo + 80, top - 50)                                   # side frame
        m.box(x0, hi - 80, top - 200, x1, hi, top - 50)
        for yy in (s * (yc - 450), s * (yc + 450)):
            m.box(x0, yy - 30, top - 50, x1, yy + 30, top)                                # chain strand under the legs
        x = x0 + 100
        while x < x1:
            for yy in (lo + 40, hi - 40):
                m.box(x - 40, yy - 40, 0, x + 40, yy + 40, top - 200)                    # legs
            m.box(x - 30, lo, top - 260, x + 30, hi, top - 200)                           # cross member
            x += 1500
        m.box(-5900, lo + 100, top - 330, -5500, hi - 100, top - 210)                      # drive unit
    # contour / weight / ID check gate on the infeed (side L)
    gx = -3000.0
    for yy in (-(yc + 800), -(yc - 800)):
        m.box(gx - 60, yy - 60, 0, gx + 60, yy + 60, 1700)
    m.box(gx - 60, -(yc + 800) - 60, 1600, gx + 60, -(yc - 800) + 60, 1720)
    # pick (kitting) station in front of the infeed: table, pick-to-light shelf, operator platform
    m.box(-8500, -2300, 850, -6700, -600, 900)
    for x in (-8450, -6750):
        for yy in (-2250, -650):
            m.box(x - 25, yy - 25, 0, x + 25, yy + 25, 850)
    m.box(-8500, -2350, 900, -6700, -2300, 2000)
    for z in (1300, 1650, 2000):
        m.box(-8500, -2350, z - 20, -6700, -2000, z)
    m.box(-8600, -600, 0, -6600, 400, 150)
    return m


def crate_positions(p, fill=0.7):
    out = []
    for s in (-1, 1):
        for b in range(p["bays"]):
            for k in (0, 1):
                for l in range(1, p["levels"] + 1):
                    if ((b * 7 + l * 3 + k * 5 + (s + 1) * 11) % 10) < fill * 10:
                        out.append((crate_x(p, b, k), s * p["y_crate_c"], level_z(p, l), s))
    return out


def gen_assembly(p, demo):
    m = Mesh("asrs_assembly")
    m.extend(gen_rack(p)).extend(gen_rails(p)).extend(gen_io(p))
    cr = gen_crate(p)
    for (x, y, z, s) in crate_positions(p):
        if (abs(x - demo["crate_x"]) < 1 and s == demo["side"] and abs(z - level_z(p, demo["level"])) < 1):
            continue
        m.extend(cr.moved(x, y, z))
    # crane at the demo position, fork extended under a crate that is lifted 150 mm
    cx = demo["crate_x"] - p["fork_xc"]
    m.extend(gen_crane(p, demo["level"], p["stroke"], demo["side"]).moved(dx=cx))
    zl = level_z(p, demo["level"]) + 150
    m.extend(cr.moved(demo["crate_x"], demo["side"] * p["y_crate_c"], zl))
    for k in (-1, 1):                                                   # two crates on the conveyors
        m.extend(cr.moved(-1500.0, k * p["y_crate_c"], p["conv_top"]))
    return m


# ============================================================================ OpenSCAD (parametric source, same parameters)
def scad_header(p, title):
    keys = ["bays", "levels", "bay", "L_rack", "H_rack", "W_rack", "clear_beam", "z1", "pitch", "up_w", "up_d", "gap", "aisle",
            "x0", "y_face", "y_rear", "y_crate_c", "cL", "cW", "cH", "c_leg", "beam_h", "beam_b", "mast_h", "mast_b", "mast_t",
            "H_mast", "wheel_D", "wheelbase", "stroke", "drum_D", "conv_top", "fork_len", "rail_top_z0", "rail_top_z1", "tie_z0", "tie_z1"]
    s = ["// %s - generated by asrs_3d.py from out/design_result.json (F3) - units mm" % title,
         "// DESIGN - to be checked and released by the responsible engineer. Coordinates: x along aisle, y across, z up.", ""]
    for k in keys:
        v = p[k]
        s.append("%s = %s;" % (k, ("%g" % v)))
    s.append("fork_w = [%g, %g, %g];  fork_t = [%g, %g, %g];" % tuple(p["fork_w"] + p["fork_t"]))
    s.append("function lz(l) = z1 + (l - 1) * pitch;     // beam top of level l")
    s.append("function cx(b, k) = x0 + b * bay + up_w + gap + cW / 2 + k * (cW + gap);")
    s.append("module box(a, b) { translate(a) cube([b[0]-a[0], b[1]-a[1], b[2]-a[2]]); }")
    s.append("module brace(a, b, w=40) { hull() { translate(a - [w/2, w/2, w/2]) cube(w); translate(b - [w/2, w/2, w/2]) cube(w); } }")
    s.append("")
    return s


def scad_files(p):
    files = {}
    rack = scad_header(p, "Rack (both sides)") + [
        "module rack_side() {",
        "  yf1 = y_face + up_d; yr0 = y_rear - up_d;",
        "  for (i = [0 : bays]) {",
        "    x = x0 + i * bay;",
        "    for (yy = [[y_face, yf1], [yr0, y_rear]]) { box([x-25, yy[0]-35, 0], [x+up_w+25, yy[1]+35, 10]);",
        "                                        box([x, yy[0], 10], [x+up_w, yy[1], H_rack]); }",
        "    for (k = [0 : floor((H_rack - 250) / 1250) - 1]) {",
        "      z = 150 + k * 1250; xc = x + up_w / 2;",
        "      brace([xc, yf1, z], [xc, yr0, z]);",
        "      if (k % 2 == 0) brace([xc, yf1, z], [xc, yr0, z + 1250]); else brace([xc, yr0, z], [xc, yf1, z + 1250]);",
        "    }",
        "  }",
        "  for (b = [0 : bays - 1], l = [1 : levels]) {",
        "    xa = x0 + b * bay + up_w; zt = lz(l);",
        "    box([xa, yf1 - beam_b, zt - beam_h], [xa + clear_beam, yf1, zt]);",
        "    box([xa, yr0, zt - beam_h], [xa + clear_beam, yr0 + beam_b, zt]);",
        "    for (k = [0, 1], sx = [-1, 1]) { xr = cx(b, k) + sx * (cW / 2 - 75);",
        "      box([xr - 20, yf1 - beam_b, zt - 30], [xr + 20, yr0 + beam_b, zt]); }",
        "  }",
        "  for (yy = [[y_face, y_face + up_d], [y_rear - up_d, y_rear]]) box([x0, yy[0], H_rack - 120], [x0 + L_rack, yy[1], H_rack]);",
        "}",
        "module rack() { rack_side(); mirror([0, 1, 0]) rack_side(); }",
        "rack();"]
    files["rack.scad"] = rack
    crate = scad_header(p, "Crate 1200 x 800 x 600 (box pallet)") + [
        "module crate() {",
        "  lw = 100;   // runner width (F4.2 crate base: 2 runners along the 1200 side)",
        "  for (sx = [-1, 1]) translate([sx * (cW/2 - lw/2) - lw/2, -cL/2, 0]) cube([lw, cL, c_leg]);",
        "  translate([-cW/2, -cL/2, c_leg]) difference() { cube([cW, cL, cH - c_leg]); translate([4, 4, 20]) cube([cW - 8, cL - 8, cH]); }",
        "}",
        "crate();"]
    files["crate.scad"] = crate
    fork = scad_header(p, "Telescopic fork, 3 stages") + [
        "// ext = stroke of the top stage (0 .. stroke), side = +1 right / -1 left",
        "module fork(ext = 0, side = 1, z0 = 0) {",
        "  sh = [0, ext / 2, ext];",
        "  for (k = [0 : 2]) translate([-fork_w[k]/2, -fork_len/2 + side * sh[k], z0 + (k == 0 ? 0 : (k == 1 ? fork_t[0] : fork_t[0] + fork_t[1]))])",
        "    cube([fork_w[k], fork_len, fork_t[k]]);",
        "}",
        "fork(0); translate([0, 0, 300]) fork(stroke, 1); translate([0, 0, 600]) fork(stroke, -1);"]
    files["fork.scad"] = fork
    crane = scad_header(p, "Single-mast stacker crane (local x = bottom frame centre)") + [
        "include <fork.scad>",
        "level = 1; ext = 0; side = 1;",
        "module crane(level = 1, ext = 0, side = 1) {",
        "  r = wheel_D / 2; zc = 30 + r; wb = wheelbase / 2;",
        "  for (s = [-1, 1]) box([-1500, min(s*250, s*350), 120], [1600, max(s*250, s*350), 300]);",
        "  for (x = [-1450, -800, 800, 1550]) box([x - 50, -250, 120], [x + 50, 250, 300]);",
        "  for (xw = [-wb, wb]) { for (s = [-1, 1]) box([xw - 250, min(s*60, s*250), 60], [xw + 250, max(s*60, s*250), 650]);",
        "    translate([xw, 0, zc]) rotate([90, 0, 0]) cylinder(r = r, h = 80, center = true, $fn = 48); }",
        "  translate([wb - 100, 260, 130]) cube([200, 80, 200]);",
        "  translate([-1300, 0, 300 + drum_D / 2 + 10]) rotate([90, 0, 0]) cylinder(r = drum_D / 2, h = 380, center = true, $fn = 48);",
        "  box([-1480, 200, 300], [-1120, 340, 640]);",
        "  translate([-1100, -mast_b / 2, 300]) difference() { cube([mast_h, mast_b, H_mast - 500]);",
        "    translate([mast_t, mast_t, -1]) cube([mast_h - 2*mast_t, mast_b - 2*mast_t, H_mast]); }",
        "  box([-1300, -250, H_mast - 200], [-300, 250, H_mast]);",
        "  for (x = [-1000, -600], s = [-1, 1]) translate([x, s * 50, rail_top_z0 + 5]) cylinder(r = 40, h = 100, $fn = 32);",
        "  box([-1100, mast_b / 2, 700], [-550, mast_b / 2 + 350, 2200]);",
        "  zf = lz(level) + 10;",
        "  box([-500, -600, zf - 80], [300, 600, zf]); box([-500, -600, zf - 80], [-440, 600, zf + 420]);",
        "  translate([-100, 0, 0]) fork(ext, side, zf);",
        "}",
        "crane(level, ext, side);"]
    files["crane.scad"] = crane
    io = scad_header(p, "I/O: infeed / outfeed chain conveyors, contour gate, pick station") + [
        "module conveyor(s) { yc = y_crate_c; lo = min(s*(yc-625), s*(yc+625)); hi = max(s*(yc-625), s*(yc+625));",
        "  box([-6000, lo, conv_top - 200], [400, lo + 80, conv_top - 50]); box([-6000, hi - 80, conv_top - 200], [400, hi, conv_top - 50]);",
        "  for (yy = [s*(yc-450), s*(yc+450)]) box([-6000, yy - 30, conv_top - 50], [400, yy + 30, conv_top]);",
        "  for (x = [-5900 : 1500 : 400], yy = [lo + 40, hi - 40]) box([x - 40, yy - 40, 0], [x + 40, yy + 40, conv_top - 200]); }",
        "conveyor(-1); conveyor(1);",
        "for (yy = [-(y_crate_c + 800), -(y_crate_c - 800)]) box([-3060, yy - 60, 0], [-2940, yy + 60, 1700]);",
        "box([-3060, -(y_crate_c + 860), 1600], [-2940, -(y_crate_c - 860), 1720]);",
        "box([-8500, -2300, 850], [-6700, -600, 900]);"]
    files["io.scad"] = io
    asm = scad_header(p, "AS/RS assembly") + [
        "use <rack.scad>", "use <crate.scad>", "use <crane.scad>", "use <io.scad>",
        "rack();",
        "translate([0, 0, 0]) box([-2500, -25, 0], [x0 + L_rack + 2000, 25, 30]);   // bottom rail",
        "translate([x0, -10, rail_top_z0]) cube([L_rack, 20, rail_top_z1 - rail_top_z0]);   // top guide rail",
        "translate([cx(3, 0) + 100, 0, 0]) crane(4, stroke, 1);",
        "for (b = [0 : bays - 1], k = [0, 1], l = [1 : levels], s = [-1, 1]) if ((b*7 + l*3 + k*5 + (s+1)*11) % 10 < 7)",
        "  translate([cx(b, k), s * y_crate_c, lz(l)]) crate();",
        "conveyor(-1); conveyor(1);"]
    files["asrs_assembly.scad"] = asm
    return files


# ============================================================================ iso preview (painter's algorithm)
def iso_preview(groups, path, title):
    """groups = list of (Mesh, (r, g, b)) - each group keeps its colour."""
    v = norm((-1.0, -0.42, 0.55))           # look down the aisle from the I/O front, slightly from side L, above
    r = norm(cross((0.0, 0.0, 1.0), v))
    u = cross(v, r)
    light = norm((-0.4, -0.7, 1.0))
    items = []
    for mesh, base in groups:
        for t in mesh.tris:
            n = norm(cross(sub(t[1], t[0]), sub(t[2], t[0])))
            if dot(n, v) <= 0:
                continue
            depth = dot(mul(add(add(t[0], t[1]), t[2]), 1 / 3), v)
            shade = 0.30 + 0.70 * max(0.0, dot(n, light))
            items.append((depth, [(dot(q, r), -dot(q, u)) for q in t], shade, base))
    items.sort(key=lambda it: it[0])
    xs = [pt[0] for it in items for pt in it[1]]
    ys = [pt[1] for it in items for pt in it[1]]
    W, Hmax = 1600.0, 1100.0
    s = min((W - 40) / (max(xs) - min(xs)), (Hmax - 80) / (max(ys) - min(ys)))
    H = (max(ys) - min(ys)) * s + 80
    W = max(900.0, (max(xs) - min(xs)) * s + 40)
    ox, oy = 20 - min(xs) * s, 60 - min(ys) * s
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (W, H, W, H),
           '<rect width="100%" height="100%" fill="#ffffff"/>',
           '<text x="20" y="30" font-family="Arial" font-size="20" font-weight="bold">%s</text>' % title,
           '<text x="20" y="52" font-family="Arial" font-size="14" fill="#444">isometric preview generated from the STL triangles (flat shading) - DESIGN, check before manufacture</text>']
    for depth, pts, sh, base in items:
        col = "#%02x%02x%02x" % tuple(int(min(255, c * sh + 30 * (1 - sh))) for c in base)
        out.append('<polygon points="%s" fill="%s" stroke="%s" stroke-width="0.3"/>' % (
            " ".join("%.1f,%.1f" % (ox + a * s, oy + b * s) for a, b in pts), col, col))
    out.append("</svg>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out))
    return len(items)


# ============================================================================ drawings (SVG, A3 landscape, mm)
class Sheet:
    def __init__(self, no, title, scale_txt, material="see parts list"):
        self.no, self.title, self.scale_txt, self.material = no, title, scale_txt, material
        self.e = []

    def line(self, x1, y1, x2, y2, w=0.25, dash=None, col="#000"):
        d = ' stroke-dasharray="%s"' % dash if dash else ""
        self.e.append('<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" stroke="%s" stroke-width="%.2f"%s/>' % (x1, y1, x2, y2, col, w, d))

    def rect(self, x, y, w, h, sw=0.35, fill="none", dash=None):
        d = ' stroke-dasharray="%s"' % dash if dash else ""
        self.e.append('<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="%s" stroke="#000" stroke-width="%.2f"%s/>' % (
            x, y, max(w, 0.01), max(h, 0.01), fill, sw, d))

    def circle(self, cx, cy, r, sw=0.3, fill="none"):
        self.e.append('<circle cx="%.2f" cy="%.2f" r="%.2f" fill="%s" stroke="#000" stroke-width="%.2f"/>' % (cx, cy, r, fill, sw))

    def poly(self, pts, sw=0.3, fill="none", closed=True):
        tag = "polygon" if closed else "polyline"
        self.e.append('<%s points="%s" fill="%s" stroke="#000" stroke-width="%.2f"/>' % (
            tag, " ".join("%.2f,%.2f" % q for q in pts), fill, sw))

    def text(self, x, y, s, size=2.5, anchor="start", bold=False, rot=0, col="#000"):
        s = str(s).replace("&", "&amp;").replace("<", "&lt;")
        tr = ' transform="rotate(%g %.2f %.2f)"' % (rot, x, y) if rot else ""
        self.e.append('<text x="%.2f" y="%.2f" font-family="Arial" font-size="%.2f" text-anchor="%s"%s fill="%s"%s>%s</text>' % (
            x, y, size, anchor, ' font-weight="bold"' if bold else "", col, tr, s))

    def arrow(self, x, y, ang):
        a = math.radians(ang)
        L, w = 2.2, 0.7
        p1 = (x - L * math.cos(a) + w * math.sin(a), y - L * math.sin(a) - w * math.cos(a))
        p2 = (x - L * math.cos(a) - w * math.sin(a), y - L * math.sin(a) + w * math.cos(a))
        self.e.append('<polygon points="%.2f,%.2f %.2f,%.2f %.2f,%.2f" fill="#000"/>' % (x, y, p1[0], p1[1], p2[0], p2[1]))

    def dim_h(self, x1, x2, y_ref, y_dim, label, size=2.5):
        """Horizontal dimension: extension lines from y_ref to y_dim, dimension line at y_dim, text above."""
        for x in (x1, x2):
            self.line(x, y_ref, x, y_dim + (1.5 if y_dim > y_ref else -1.5), 0.18)
        self.line(x1, y_dim, x2, y_dim, 0.18)
        self.arrow(x1, y_dim, 180)
        self.arrow(x2, y_dim, 0)
        self.text((x1 + x2) / 2, y_dim - 0.8, label, size, "middle")

    def dim_v(self, y1, y2, x_ref, x_dim, label, size=2.5):
        for y in (y1, y2):
            self.line(x_ref, y, x_dim + (1.5 if x_dim > x_ref else -1.5), y, 0.18)
        self.line(x_dim, y1, x_dim, y2, 0.18)
        self.arrow(x_dim, min(y1, y2), 270)
        self.arrow(x_dim, max(y1, y2), 90)
        self.text(x_dim - 0.8, (y1 + y2) / 2, label, size, "middle", rot=-90)

    def table(self, x, y, rows, widths, h=4.2, size=2.3, head=True):
        for i, row in enumerate(rows):
            cx = x
            for j, c in enumerate(row):
                self.rect(cx, y + i * h, widths[j], h, 0.18, "#eeeeee" if (head and i == 0) else "none")
                self.text(cx + 1.0, y + i * h + h - 1.2, c, size, bold=(head and i == 0))
                cx += widths[j]

    def frame(self):
        # ISO 5457 A3: trimmed 420 x 297, frame 20 mm left (filing margin), 10 mm elsewhere, centring marks
        self.rect(0.3, 0.3, 419.4, 296.4, 0.2)
        self.rect(20, 10, 390, 277, 0.7)
        for (x1, y1, x2, y2) in ((210, 0, 210, 10), (210, 287, 210, 297), (10, 148.5, 20, 148.5), (410, 148.5, 420, 148.5)):
            self.line(x1, y1, x2, y2, 0.7)
        for i in range(8):                                    # grid reference (columns 1..8, rows A..F)
            self.text(20 + 390 / 8 * (i + 0.5), 7.5, str(i + 1), 2.5, "middle")
        for i, ch in enumerate("ABCDEF"):
            self.text(15, 10 + 277 / 6 * (i + 0.5), ch, 2.5, "middle")

    def title_block(self):
        # ISO 7200 layout, 180 mm wide, bottom right
        x, y = 230.0, 231.0
        w, h = 180.0, 56.0
        self.rect(x, y, w, h, 0.7)
        rows = [
            (y, 10, [("Company / owner", "[company name - fill in]", 90), ("Project", "Combined FMS VC20 + RB - item F3 AS/RS", 90)]),
            (y + 10, 12, [("Title", self.title, 180)]),
            (y + 22, 10, [("Drawing no.", self.no, 50), ("Scale", self.scale_txt, 30), ("Size", "A3", 20), ("Sheet", "1/1", 20), ("Date", "2026-11-15", 30), ("Rev.", "0", 30)]),
            (y + 32, 10, [("Material", self.material, 60), ("General tolerance", "ISO 2768-mK", 40), ("Drawn", "asrs_3d.py", 30), ("Checked / released", "- / -", 50)]),
        ]
        for (yy, hh, cells) in rows:
            cx = x
            for (lab, val, cw) in cells:
                self.rect(cx, yy, cw, hh, 0.25)
                self.text(cx + 1, yy + 2.6, lab, 1.8, col="#444")
                self.text(cx + 1, yy + hh - 2.0, val, 3.2 if lab == "Title" else 2.4, bold=(lab in ("Title", "Drawing no.")))
                cx += cw
        self.rect(x, y + 42, 40, 14, 0.25)
        self.text(x + 1, y + 44.6, "Projection ISO 5456-2", 1.8, col="#444")
        self.first_angle(x + 8, y + 50.5)
        self.rect(x + 40, y + 42, 140, 14, 0.25, "#fff2cc")
        self.text(x + 42, y + 48, "DESIGN - to be checked and released by the responsible engineer", 2.8, bold=True)
        self.text(x + 42, y + 53, "Generated from design_result.json (F3). Do not scale - use the dimensions.", 2.0)

    def first_angle(self, x, y):
        # first angle symbol: truncated cone front view left (narrow end left), end view (two circles) right
        self.poly([(x, y - 1.6), (x + 9, y - 3.2), (x + 9, y + 3.2), (x, y + 1.6)], 0.3)
        self.line(x - 1, y, x + 10, y, 0.15, "1.5 0.6 0.3 0.6")
        cx = x + 17
        self.circle(cx, y, 3.2)
        self.circle(cx, y, 1.6)
        self.line(cx - 4.2, y, cx + 4.2, y, 0.15, "1.5 0.6 0.3 0.6")
        self.line(cx, y - 4.2, cx, y + 4.2, 0.15, "1.5 0.6 0.3 0.6")

    def save(self, path):
        self.frame()
        self.title_block()
        body = "\n".join(self.e)
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 420 297">\n'
               '<rect width="420" height="297" fill="#ffffff"/>\n%s\n</svg>\n' % body)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(svg)


class View:
    """Real mm -> paper mm. h_axis / v_axis pick the coordinates ('x','y','z'); v grows upwards on paper."""

    def __init__(self, ox, oy, scale, h="x", v="z"):
        self.ox, self.oy, self.s, self.h, self.v = ox, oy, 1.0 / scale, h, v

    def P(self, a, b):
        return self.ox + a * self.s, self.oy - b * self.s

    def X(self, a):
        return self.ox + a * self.s

    def Y(self, b):
        return self.oy - b * self.s

    def rect(self, sh, a0, b0, a1, b1, sw=0.3, fill="none", dash=None):
        x0, y0 = self.P(min(a0, a1), max(b0, b1))
        sh.rect(x0, y0, abs(a1 - a0) * self.s, abs(b1 - b0) * self.s, sw, fill, dash)


def draw_D01(p, path):
    sh = Sheet("F3-ASRS-D01", "AS/RS general arrangement - plan, elevation, cross-section", "1:200 / 1:100")
    xr0, xr1 = p["x0"], p["x0"] + p["L_rack"]
    # ---- plan view 1:200 (x right, y up)
    V = View(70, 52, 200, "x", "y")
    sh.text(30, 18, "PLAN VIEW 1:200", 3.0, bold=True)
    for s in (-1, 1):
        V.rect(sh, xr0, s * p["y_face"], xr1, s * p["y_rear"], 0.35, "#dde7f3")
        for i in range(p["bays"] + 1):
            x = xr0 + i * p["bay"]
            sh.line(V.X(x), V.Y(s * p["y_face"]), V.X(x), V.Y(s * p["y_rear"]), 0.15)
    sh.line(V.X(p["rail_x"][0]), V.Y(0), V.X(p["rail_x"][1]), V.Y(0), 0.25, "4 1 1 1")
    V.rect(sh, 7650 - 1500, -350, 7650 + 1600, 350, 0.35, "#f8cbad")
    for s in (-1, 1):
        V.rect(sh, -6000, s * (p["y_crate_c"] - 625), 400, s * (p["y_crate_c"] + 625), 0.3, "#e2efda")
    V.rect(sh, -8500, -2300, -6700, -600, 0.3, "#fff2cc")
    sh.text(V.X(-7600), V.Y(-1450) + 1, "PICK", 2.0, "middle")
    sh.text(V.X(-2800), V.Y(-p["y_crate_c"]) + 1, "INFEED + contour/ID check", 2.0, "middle")
    sh.text(V.X(-2800), V.Y(p["y_crate_c"]) + 1, "OUTFEED to AGV", 2.0, "middle")
    sh.text(V.X(7650), V.Y(0) + 0.8, "crane", 2.0, "middle")
    sh.text(V.X((xr0 + xr1) / 2), V.Y(p["y_rear"]) - 1.5, "side R (+y): %d bays x 2 crates x %d levels" % (p["bays"], p["levels"]), 2.2, "middle")
    sh.text(V.X((xr0 + xr1) / 2), V.Y(-p["y_rear"]) + 3.5, "side L (-y)", 2.2, "middle")
    sh.dim_h(V.X(xr0), V.X(xr1), V.Y(-p["y_rear"]), V.Y(-p["y_rear"]) + 9, "rack %d" % round(p["L_rack"]))
    sh.dim_h(V.X(-p["front_zone"]), V.X(0), V.Y(-p["y_rear"]), V.Y(-p["y_rear"]) + 9, "front zone %d" % p["front_zone"])
    sh.dim_h(V.X(0), V.X(xr0), V.Y(-p["y_rear"]), V.Y(-p["y_rear"]) + 14, "%d" % xr0, 2.0)
    sh.dim_v(V.Y(-p["y_rear"]), V.Y(p["y_rear"]), V.X(xr1), V.X(xr1) + 8, "%d" % p["W_rack"])
    sh.text(V.X(0), V.Y(p["y_rear"]) - 5.5, "x = 0 transfer point", 2.0, "middle")
    sh.line(V.X(0), V.Y(p["y_rear"]) - 4.5, V.X(0), V.Y(-p["y_rear"]), 0.15, "2 1")
    # ---- elevation 1:200 (x right, z up), side R seen from the aisle
    E = View(70, 172, 200, "x", "z")
    sh.text(30, 82, "ELEVATION ALONG THE AISLE (side R) 1:200", 3.0, bold=True)
    for i in range(p["bays"] + 1):
        x = xr0 + i * p["bay"]
        E.rect(sh, x, 0, x + p["up_w"], p["H_rack"], 0.2, "#888")
    for l in range(1, p["levels"] + 1):
        sh.line(E.X(xr0), E.Y(level_z(p, l)), E.X(xr1), E.Y(level_z(p, l)), 0.2)
    E.rect(sh, xr0, p["H_rack"] - 120, xr1, p["H_rack"], 0.2, "#888")
    sh.line(E.X(-p["front_zone"]), E.Y(0), E.X(p["rail_x"][1] + 500), E.Y(0), 0.5)
    sh.line(E.X(-p["front_zone"]), E.Y(p["clear_h"]), E.X(p["rail_x"][1] + 500), E.Y(p["clear_h"]), 0.25, "3 1")
    sh.text(E.X(-p["front_zone"]) + 1, E.Y(p["clear_h"]) - 0.8, "clear height %d (underside of roof structure)" % p["clear_h"], 2.0)
    cxm = 7650
    E.rect(sh, cxm - 1500, 60, cxm + 1600, 650, 0.3, "#f8cbad")
    E.rect(sh, cxm + p["mast_x"][0], p["z_mast0"], cxm + p["mast_x"][1], p["z_top0"], 0.3, "#f8cbad")
    E.rect(sh, cxm - 1300, p["z_top0"], cxm - 300, p["H_mast"], 0.3, "#f8cbad")
    E.rect(sh, xr0, p["rail_top_z0"], xr1, p["tie_z1"], 0.2, "#cccccc")
    E.rect(sh, -6000, 0, 400, p["conv_top"], 0.25, "#e2efda")
    sh.dim_v(E.Y(0), E.Y(p["H_rack"]), E.X(xr1), E.X(xr1) + 8, "%d" % p["H_rack"])
    sh.dim_v(E.Y(0), E.Y(p["H_mast"]), E.X(xr1), E.X(xr1) + 16, "crane %d" % p["H_mast"])
    sh.dim_v(E.Y(0), E.Y(p["tie_z1"]), E.X(xr1), E.X(xr1) + 24, "ties %d" % p["tie_z1"])
    sh.dim_v(E.Y(0), E.Y(level_z(p, 1)), E.X(xr0), E.X(xr0) - 5, "%d" % p["z1"], 2.0)
    sh.text(E.X(xr0 + 16000), E.Y(level_z(p, 2)) - 0.8, "level pitch %d, %d levels, top level %d" % (p["pitch"], p["levels"], level_z(p, p["levels"])), 2.0)
    # ---- cross-section 1:100 (y right, z up)
    C = View(332, 222, 100, "y", "z")
    sh.text(296, 79, "SECTION A-A 1:100", 3.0, bold=True)
    for s in (-1, 1):
        for (a, b) in ((p["y_face"], p["y_face"] + p["up_d"]), (p["y_rear"] - p["up_d"], p["y_rear"])):
            C.rect(sh, s * a, 0, s * b, p["H_rack"], 0.2, "#888")
        for l in range(1, p["levels"] + 1):
            z = level_z(p, l)
            C.rect(sh, s * p["y_crate0"], z, s * (p["y_crate0"] + p["cL"]), z + p["cH"], 0.2, "#dde7f3")
    C.rect(sh, -p["mast_b"] / 2, p["z_mast0"], p["mast_b"] / 2, p["z_top0"], 0.3, "#f8cbad")
    C.rect(sh, -350, 120, 350, 650, 0.3, "#f8cbad")
    sh.line(C.X(-p["y_rear"] - 300), C.Y(0), C.X(p["y_rear"] + 300), C.Y(0), 0.5)
    sh.dim_h(C.X(-p["y_rear"]), C.X(p["y_rear"]), C.Y(0), C.Y(0) + 6, "%d" % p["W_rack"])
    sh.dim_h(C.X(-p["y_face"]), C.X(p["y_face"]), C.Y(p["H_rack"]), C.Y(p["H_rack"]) - 4, "aisle %d" % p["aisle"], 2.0)
    sh.dim_h(C.X(p["y_face"]), C.X(p["y_rear"]), C.Y(p["H_rack"]), C.Y(p["H_rack"]) - 4, "%d" % p["frame_d"], 2.0)
    # ---- key data table
    rows = [["Key data (design)", "Value"],
            ["Positions (RAW / KIT zone)", "%d (%d / %d)" % (p["positions"], p["RAW_pos"], p["KIT_pos"])],
            ["Bays per side x crates x levels", "%d x 2 x %d" % (p["bays"], p["levels"])],
            ["Bay pitch / clear beam", "%d / %d mm" % (p["bay"], p["clear_beam"])],
            ["Crate (L x W x H), max gross", "%dx%dx%d, %d kg" % (p["cL"], p["cW"], p["cH"], p["load"])],
            ["Crane moving mass", "%.0f kg" % p["m_crane"]],
            ["Drives travel / hoist / fork", "%.1f / %.1f / %.1f kW" % (p["P_travel"], p["P_hoist"], p["P_fork"])]]
    sh.table(30, 196, rows, [100, 78], 4.6, 2.3)
    sh.save(path)


def draw_D02(p, path):
    sh = Sheet("F3-ASRS-D02", "Rack upright frame and beam level detail", "1:75 / 1:20", "S355 galvanised (rack supplier)")
    # frame side view 1:75 (y right, z up), side R
    F = View(40 - p["y_face"] / 75, 262, 75, "y", "z")
    sh.text(26, 18, "UPRIGHT FRAME (side R) 1:75", 3.0, bold=True)
    yf1, yr0 = p["y_face"] + p["up_d"], p["y_rear"] - p["up_d"]
    F.rect(sh, p["y_face"], 10, yf1, p["H_rack"], 0.3, "#999")
    F.rect(sh, yr0, 10, p["y_rear"], p["H_rack"], 0.3, "#999")
    z = 150.0
    k = 0
    while z + 1250 <= p["H_rack"] - 100:
        sh.line(F.X(yf1), F.Y(z), F.X(yr0), F.Y(z), 0.2)
        ya, yb = (yf1, yr0) if k % 2 == 0 else (yr0, yf1)
        sh.line(F.X(ya), F.Y(z), F.X(yb), F.Y(z + 1250), 0.2)
        z += 1250
        k += 1
    sh.line(F.X(yf1), F.Y(z), F.X(yr0), F.Y(z), 0.2)
    for l in range(1, p["levels"] + 1):
        F.rect(sh, yf1 - p["beam_b"], level_z(p, l) - p["beam_h"], yf1, level_z(p, l), 0.2, "#444")
        F.rect(sh, yr0, level_z(p, l) - p["beam_h"], yr0 + p["beam_b"], level_z(p, l), 0.2, "#444")
        sh.text(F.X(p["y_rear"]) + 2, F.Y(level_z(p, l)) + 0.8, "L%d" % l, 2.0)
    sh.dim_v(F.Y(0), F.Y(p["H_rack"]), F.X(p["y_face"]), F.X(p["y_face"]) - 6, "%d" % p["H_rack"])
    sh.dim_h(F.X(p["y_face"]), F.X(p["y_rear"]), F.Y(0), F.Y(0) + 6, "%d" % p["frame_d"], 2.0)
    sh.text(26, 278, "aisle side <-", 2.0)
    # bay detail 1:20 (x right, z up), levels 1-2
    B = View(95, 160, 20, "x", "z")
    sh.text(95, 18, "BAY DETAIL, LEVELS 1-2, SEEN FROM THE AISLE 1:20", 3.0, bold=True)
    xa = 0.0
    for x in (xa, xa + p["bay"]):
        B.rect(sh, x, 0, x + p["up_w"], 2500, 0.3, "#999")
    for l in (1, 2):
        zt = level_z(p, l)
        B.rect(sh, xa + p["up_w"], zt - p["beam_h"], xa + p["bay"], zt, 0.3, "#555")
        for k in (0, 1):
            xc = p["up_w"] + p["gap"] + p["cW"] / 2 + k * (p["cW"] + p["gap"])
            B.rect(sh, xc - p["cW"] / 2, zt, xc + p["cW"] / 2, zt + p["cH"], 0.3, "#dde7f3")
            lw = p["run_w"]
            for sx in (-1, 1):
                B.rect(sh, xc + sx * (p["cW"] / 2 - lw / 2) - lw / 2, zt, xc + sx * (p["cW"] / 2 - lw / 2) + lw / 2, zt + p["c_leg"], 0.25, "#9db5d8")
    sh.line(B.X(-200), B.Y(0), B.X(p["bay"] + 300), B.Y(0), 0.5)
    y1 = B.Y(level_z(p, 2) + p["cH"]) - 4
    xs = [0, p["up_w"], p["up_w"] + p["gap"], p["up_w"] + p["gap"] + p["cW"], p["up_w"] + 2 * p["gap"] + p["cW"],
          p["up_w"] + 2 * p["gap"] + 2 * p["cW"], p["bay"]]
    labels = ["%d" % p["up_w"], "%d" % p["gap"], "%d" % p["cW"], "%d" % p["gap"], "%d" % p["cW"], "%d" % p["gap"]]
    for i in range(6):
        sh.dim_h(B.X(xs[i]), B.X(xs[i + 1]), B.Y(level_z(p, 2) + p["cH"]), y1, labels[i], 2.0)
    sh.dim_h(B.X(0), B.X(p["bay"]), B.Y(level_z(p, 2) + p["cH"]), y1 - 6, "bay pitch %d" % p["bay"])
    sh.dim_v(B.Y(0), B.Y(level_z(p, 1)), B.X(p["bay"] + p["up_w"]), B.X(p["bay"] + p["up_w"]) + 6, "%d" % p["z1"], 2.0)
    sh.dim_v(B.Y(level_z(p, 1)), B.Y(level_z(p, 2)), B.X(p["bay"] + p["up_w"]), B.X(p["bay"] + p["up_w"]) + 12, "%d" % p["pitch"], 2.0)
    sh.text(B.X(p["up_w"]) + 1, B.Y(level_z(p, 1) - p["beam_h"]) + 3.5, "beam box %dx%dx2.0 S355, clear span %d" % (p["beam_h"], p["beam_b"], p["clear_beam"]), 2.0)
    # level table
    rows = [["Level", "Beam top z [mm]", "Crate top z [mm]"]]
    for l in range(1, p["levels"] + 1):
        rows.append(["L%d" % l, "%d" % level_z(p, l), "%d" % (level_z(p, l) + p["cH"])])
    rows.append(["Top tie", "%d - %d" % (p["H_rack"] - 120, p["H_rack"]), "-"])
    sh.table(300, 20, rows, [22, 40, 40], 4.4, 2.3)
    notes = ["Notes (design):",
             "1. Upright 100 x 80 perforated section, bracing 40 x 40 (simplified) - tested section per EN 15512 by the supplier.",
             "2. Beam safety locks on every beam end; beam / upright check: asrs_design.py report section 6.",
             "3. Clearances to EN 15620 class 400; crate support rails 2 per crate under the runners.",
             "4. Load sign per EN 15635: 300 kg per crate, %d kg per beam pair." % (2 * p["load"])]
    for i, t in enumerate(notes):
        sh.text(95, 196 + 5 * i, t, 2.2, bold=(i == 0))
    sh.save(path)


def draw_D03(p, path):
    sh = Sheet("F3-ASRS-D03", "Stacker crane general arrangement", "1:75 / 1:25", "S355 welded; wheels GJS-700 / 42CrMo4")
    S = View(58, 268, 75, "x", "z")                   # side view, crane local x
    sh.text(26, 18, "SIDE VIEW 1:75", 3.0, bold=True)
    S.rect(sh, -1500, 120, 1600, p["z_frame_top"], 0.3, "#f8cbad")
    wb = p["wheelbase"] / 2
    for xw in (-wb, wb):
        S.rect(sh, xw - 250, 60, xw + 250, 650, 0.3, "#f4b183")
        cx, cy = S.P(xw, 30 + p["wheel_D"] / 2)
        sh.circle(cx, cy, p["wheel_D"] / 2 / 75)
    S.rect(sh, p["mast_x"][0], p["z_mast0"], p["mast_x"][1], p["z_top0"], 0.35, "#fbe5d6")
    S.rect(sh, -1300, p["z_top0"], -300, p["H_mast"], 0.3, "#f8cbad")
    S.rect(sh, -500, 4200 - 70, 300, 4200 + 430, 0.3, "#ffe699")
    sh.text(S.X(320) + 1, S.Y(4300), "carriage + fork (shown at L4)", 2.0)
    S.rect(sh, p["mast_x"][0], 700, p["mast_x"][1] - 50, 2200, 0.25, "#d9d9d9")
    sh.text(S.X(-1700), S.Y(1500), "cabinet", 1.8, "end")
    sh.line(S.X(-2000), S.Y(0), S.X(2100), S.Y(0), 0.5)
    sh.dim_v(S.Y(0), S.Y(p["H_mast"]), S.X(-1500), S.X(-1500) - 6, "%d" % p["H_mast"])
    sh.dim_v(S.Y(p["z_mast0"]), S.Y(p["z_top0"]), S.X(-1500), S.X(-1500) - 12, "mast %d" % (p["z_top0"] - p["z_mast0"]), 2.0)
    sh.dim_h(S.X(-wb), S.X(wb), S.Y(0), S.Y(0) + 6, "wheelbase %d" % p["wheelbase"], 2.0)
    sh.dim_h(S.X(-1500), S.X(1600), S.Y(0), S.Y(0) + 11, "3100", 2.0)
    # front view 1:75 (y right)
    Fv = View(150, 268, 75, "y", "z")
    sh.text(122, 18, "FRONT VIEW 1:75", 3.0, bold=True)
    Fv.rect(sh, -350, 120, 350, 650, 0.3, "#f8cbad")
    Fv.rect(sh, -p["mast_b"] / 2, p["z_mast0"], p["mast_b"] / 2, p["z_top0"], 0.35, "#fbe5d6")
    Fv.rect(sh, -250, p["z_top0"], 250, p["H_mast"], 0.3, "#f8cbad")
    Fv.rect(sh, -600, 4200 - 70, 600, 4200 + 430, 0.3, "#ffe699")
    for s in (-1, 1):
        sh.line(Fv.X(s * p["y_crate0"]), Fv.Y(0), Fv.X(s * p["y_crate0"]), Fv.Y(p["H_mast"]), 0.15, "2 1")
    sh.dim_h(Fv.X(-p["y_crate0"]), Fv.X(p["y_crate0"]), Fv.Y(p["H_mast"]), Fv.Y(p["H_mast"]) - 4, "crate faces %d" % (2 * p["y_crate0"]), 2.0)
    sh.dim_h(Fv.X(-600), Fv.X(600), Fv.Y(0), Fv.Y(0) + 6, "1200", 2.0)
    sh.line(Fv.X(-1000), Fv.Y(0), Fv.X(1000), Fv.Y(0), 0.5)
    # bottom frame detail 1:25
    Dt = View(306, 110, 25, "x", "z")
    sh.text(205, 18, "BOTTOM FRAME DETAIL 1:25 (local x, z)", 3.0, bold=True)
    Dt.rect(sh, -1500, 120, 1600, p["z_frame_top"], 0.3, "#f8cbad")
    for xw in (-wb, wb):
        Dt.rect(sh, xw - 250, 60, xw + 250, 650, 0.3, "#f4b183")
        cx, cy = Dt.P(xw, 30 + p["wheel_D"] / 2)
        sh.circle(cx, cy, p["wheel_D"] / 2 / 25)
    cx, cy = Dt.P(-1300, p["z_frame_top"] + p["drum_D"] / 2 + 10)
    sh.circle(cx, cy, p["drum_D"] / 2 / 25)
    Dt.rect(sh, wb - 100, 130, wb + 100, 330, 0.25, "#d9d9d9")
    Dt.rect(sh, wb - 600, 190, wb - 200, 270, 0.25, "#d9d9d9")
    Dt.rect(sh, p["mast_x"][0], p["z_frame_top"], p["mast_x"][1], 1000, 0.3, "#fbe5d6")
    Dt.rect(sh, -2500, 0, 2100, 30, 0.2, "#888")
    sh.text(cx, cy + 9, "drum D%d" % p["drum_D"], 2.0, "middle")
    sh.text(Dt.X(wb), Dt.Y(-150), "drive wheel D%d" % p["wheel_D"], 2.0, "middle")
    sh.text(Dt.X(-wb), Dt.Y(-150), "idler wheel", 2.0, "middle")
    sh.text(Dt.X(wb - 400), Dt.Y(450), "travel gear-motor %.1f kW i=%.1f" % (p["P_travel"], p["i_travel"]), 2.0, "middle")
    sh.text(Dt.X(-800), Dt.Y(1080), "mast %dx%dx%d" % (p["mast_h"], p["mast_b"], p["mast_t"]), 2.0, "middle")
    sh.dim_v(Dt.Y(0), Dt.Y(30 + p["wheel_D"] / 2), Dt.X(1600), Dt.X(1600) + 6, "%d" % (30 + p["wheel_D"] / 2), 2.0)
    sh.text(Dt.X(-2400), Dt.Y(-60), "rail 50x30", 2.0)
    rows = [["Crane data (design)", "Value"],
            ["Moving mass (incl. mast %.0f kg)" % p["m_mast"], "%.0f kg" % p["m_crane"]],
            ["Bottom frame / carriage + fork", "%d / %d kg" % (p["m_bottom"], p["m_carriage"])],
            ["Max load (crate gross)", "%d kg" % p["load"]],
            ["Travel drive", "%.1f kW, i = %.1f, wheel D%d" % (p["P_travel"], p["i_travel"], p["wheel_D"])],
            ["Hoist drive", "%.1f kW, i = %.1f, drum D%d" % (p["P_hoist"], p["i_hoist"], p["drum_D"])],
            ["Fork drive", "%.1f kW, i = %.1f, stroke +-%d" % (p["P_fork"], p["i_fork"], p["stroke"])],
            ["Mast", "box %dx%dx%d S355" % (p["mast_h"], p["mast_b"], p["mast_t"])],
            ["Top guide", "4 PU rollers D80 on rail 20x120"]]
    sh.table(232, 150, rows, [92, 86], 4.6, 2.2)
    sh.save(path)


def draw_D04(p, path):
    sh = Sheet("F3-ASRS-D04", "Telescopic fork - stroke positions and stages", "1:20 / 1:5", "fork: S355 / 42CrMo4 racks, PA guides")
    sh.text(26, 18, "TOP VIEW 1:20 (y right = side R, x up)", 3.0, bold=True)
    states = [("retracted (travel position)", 0.0, 1), ("extended to side R", p["stroke"], 1), ("extended to side L", p["stroke"], -1)]
    yc0 = 160.0
    for i, (lab, ext, side) in enumerate(states):
        V = View(yc0, 60 + i * 55, 20, "y", "x")
        sh.text(30, 60 + i * 55 - 12, lab, 2.5, bold=True)
        for s in (-1, 1):
            V.rect(sh, s * p["y_crate0"], -p["cW"] / 2, s * (p["y_crate0"] + p["cL"]), p["cW"] / 2, 0.2, "none", "2 1")
            sh.line(V.X(s * p["y_face"]), V.Y(-500), V.X(s * p["y_face"]), V.Y(500), 0.3)
        shifts = (0.0, ext / 2, ext)
        for k in range(3):
            w = p["fork_w"][k]
            dy = side * shifts[k]
            V.rect(sh, -p["fork_len"] / 2 + dy, -w / 2, p["fork_len"] / 2 + dy, w / 2, 0.3, ["#d9d9d9", "#bdd7ee", "#f8cbad"][k])
        sh.line(V.X(0), V.Y(-560), V.X(0), V.Y(560), 0.15, "3 1 1 1")
        if ext:
            tip = side * (p["fork_len"] / 2 + ext)
            sh.dim_h(V.X(0), V.X(side * ext), V.Y(p["cW"] / 2), V.Y(p["cW"] / 2) - 5, "stroke %d" % ext, 2.0)
            sh.dim_h(V.X(0), V.X(side * p["y_crate_c"]), V.Y(-p["cW"] / 2), V.Y(-p["cW"] / 2) + 6, "crate centre %d" % p["y_crate_c"], 2.0)
            sh.text(V.X(tip), V.Y(0) - 13, "tip %d" % abs(tip), 2.0, "middle")
        else:
            sh.dim_h(V.X(-p["fork_len"] / 2), V.X(p["fork_len"] / 2), V.Y(p["cW"] / 2), V.Y(p["cW"] / 2) - 5, "%d" % p["fork_len"], 2.0)
            sh.dim_h(V.X(-p["y_face"]), V.X(p["y_face"]), V.Y(-p["cW"] / 2), V.Y(-p["cW"] / 2) + 6, "aisle %d" % p["aisle"], 2.0)
    # stage section 1:5 (x right, z up)
    Sx = View(330, 120, 5, "x", "z")
    sh.text(300, 18, "SECTION OF THE STAGES 1:5", 3.0, bold=True)
    z = 0.0
    for k in range(3):
        w, t = p["fork_w"][k], p["fork_t"][k]
        Sx.rect(sh, -w / 2, z, w / 2, z + t, 0.3, ["#d9d9d9", "#bdd7ee", "#f8cbad"][k])
        sh.text(Sx.X(w / 2) + 2, Sx.Y(z + t / 2) + 0.8, ["base", "middle", "top"][k] + " %dx%d" % (w, t), 2.0)
        z += t
    sh.dim_v(Sx.Y(0), Sx.Y(z), Sx.X(-p["fork_w"][0] / 2), Sx.X(-p["fork_w"][0] / 2) - 5, "%d" % z, 2.0)
    sh.dim_h(Sx.X(-p["fork_w"][0] / 2), Sx.X(p["fork_w"][0] / 2), Sx.Y(0), Sx.Y(0) + 6, "%d" % p["fork_w"][0], 2.0)
    lw = p["run_w"]
    notes = ["Kinematics: middle stage moves stroke/2 (rack and pinion), top stage moves stroke (chain/belt multiplication x2).",
             "Fork enters 10 mm above the beam top between the crate runners (opening %d mm, fork %d mm), lifts %d mm." % (p["cW"] - 2 * lw, p["fork_w"][0], 150),
             "Reach check: tip at %d mm >= crate centre %d mm and <= rack rear %d mm." % (p["fork_len"] / 2 + p["stroke"], p["y_crate_c"], p["y_rear"]),
             "End positions: inductive sensors + absolute encoder; overload by motor current (see item F3 electrical part)."]
    for i, t in enumerate(notes):
        sh.text(268, 140 + 6 * i, t, 2.0)
    sh.save(path)


def draw_D05(p, path):
    sh = Sheet("F3-ASRS-D05", "Rail and floor layout, anchor points, tolerances", "1:200", "rail S355 flat bar 50x30 on grout")
    V = View(55, 110, 200, "x", "y")
    sh.text(26, 18, "FLOOR PLAN 1:200 - base plates (+), anchors 2 x M12 each, bottom rail", 3.0, bold=True)
    n = 0
    for s in (-1, 1):
        for i in range(p["bays"] + 1):
            x = p["x0"] + i * p["bay"] + p["up_w"] / 2
            for yy in (p["y_face"] + p["up_d"] / 2, p["y_rear"] - p["up_d"] / 2):
                cx, cy = V.P(x, s * yy)
                sh.line(cx - 0.9, cy, cx + 0.9, cy, 0.25)
                sh.line(cx, cy - 0.9, cx, cy + 0.9, 0.25)
                n += 1
    xa, xb = p["rail_x"]
    V.rect(sh, xa, -25, xb, 25, 0.4, "#555")
    V.rect(sh, xa, -200, xa + 300, 200, 0.3, "#999")
    V.rect(sh, xb - 300, -200, xb, 200, 0.3, "#999")
    sh.dim_h(V.X(xa), V.X(xb), V.Y(-p["y_rear"]), V.Y(-p["y_rear"]) + 10, "bottom rail %d" % (xb - xa))
    sh.dim_h(V.X(p["x0"]), V.X(p["x0"] + p["bay"]), V.Y(p["y_rear"]), V.Y(p["y_rear"]) - 5, "%d" % p["bay"], 2.0)
    sh.dim_v(V.Y(-p["y_rear"]), V.Y(p["y_rear"]), V.X(xb), V.X(xb) + 7, "%d" % p["W_rack"], 2.0)
    sh.text(V.X(xa), V.Y(0) + 4.5, "end stop + PU buffer", 2.0)
    sh.text(V.X(xb), V.Y(0) + 4.5, "end stop + PU buffer", 2.0, "end")
    sh.text(30, 140, "Base plates: %d pcs 150 x 150 x 10, each 2 x M12 chemical anchors (load per upright: see asrs_design.py report 6)." % n, 2.4)
    rows = [["Tolerance item (design targets - confirm with EN 15620 / FEM 9.831 and the supplier)", "Target"],
            ["Floor flatness under the rack and rail (class for VNA / AS-RS, EN 15620 / DIN 15185)", "per standard, check slab"],
            ["Bottom rail straightness (lateral) over the full length", "+-3 mm, +-1 mm per 2 m"],
            ["Bottom rail height (level) over the full length", "+-3 mm, +-1 mm per 2 m"],
            ["Top guide rail lateral position to bottom rail (plumb line)", "+-3 mm"],
            ["Upright plumb (each frame)", "H/750, max 15 mm (confirm)"],
            ["Beam level to nominal", "+-5 mm (asrs_design budget)"],
            ["Bay pitch (cumulative along the aisle)", "+-3 mm per bay, +-10 mm total"],
            ["Rail joints: step / gap", "<= 0.5 mm / <= 2 mm"]]
    sh.table(30, 150, rows, [140, 50], 5.0, 2.2)
    notes = ["Installation sequence: 1 slab check + survey grid; 2 rail on grout (alignment laser, shims), anchors;",
             "3 rack frames + beams, plumb and level; 4 top ties + guide rail aligned to the bottom rail (plumb);",
             "5 crane erection, wheel alignment, buffers; 6 survey record of every tolerance item before commissioning.",
             "Design values only - the slab design (thickness, reinforcement, joints away from the rail) is done by the structural engineer."]
    for i, t in enumerate(notes):
        sh.text(30, 206 + 5.5 * i, t, 2.2)
    sh.save(path)


# ============================================================================ dimension table
def dimension_table(p, path):
    rows = [["part", "feature", "value_mm", "tolerance", "source"]]
    T = "EN 15620 class 400 / supplier"
    M = "ISO 2768-mK"
    rows += [["rack", "rack length", round(p["L_rack"]), T, "design_result rack.length_m"],
             ["rack", "rack height (top of top tie)", round(p["H_rack"]), T, "design_result rack.rack_height_m"],
             ["rack", "overall width over both sides", round(p["W_rack"]), T, "design_result rack.width_m"],
             ["rack", "bays per side", p["bays"], "-", "design_result rack.bays"],
             ["rack", "levels", p["levels"], "-", "design_result rack.levels"],
             ["rack", "bay pitch", p["bay"], "+-3 per bay", "design_result rack.bay_mm"],
             ["rack", "clear beam span", p["clear_beam"], T, "design_result"],
             ["rack", "upright section x (along aisle)", p["up_w"], "supplier", "asrs_data rack.upright_w_mm"],
             ["rack", "upright section y (depth)", p["up_d"], "supplier", "asrs_3d design choice"],
             ["rack", "gap upright-crate / crate-crate", p["gap"], T, "asrs_data rack.gap_mm"],
             ["rack", "frame depth per side", round(p["frame_d"]), T, "(W - aisle)/2"],
             ["rack", "aisle width (upright faces)", p["aisle"], "+-5", "asrs_data rack.aisle_mm"],
             ["rack", "rack start x (from transfer point)", round(p["x0"]), "+-10", "asrs_design I/O 1.2 m"],
             ["rack", "beam section h x b x t", "120 x 50 x 2.0", "supplier", "asrs_data rack.beam"],
             ["rack", "crate front face y", round(p["y_crate0"]), "+-10", "aisle/2 + 50"],
             ["rack", "crate centre y (fork pick point)", round(p["y_crate_c"]), "+-10", "crate front + L/2"]]
    for l in range(1, p["levels"] + 1):
        rows.append(["rack", "beam top level L%d" % l, round(level_z(p, l)), "+-5", "z1 + (l-1) pitch"])
    rows += [["crate", "length x width x height", "%d x %d x %d" % (p["cL"], p["cW"], p["cH"]), "+-5", "asrs_data crate"],
             ["crate", "runner height (fork entry)", p["c_leg"], "+-3", "F4.2 crate base"],
             ["crate", "fork entry opening between the 2 runners", round(p["cW"] - 2 * p["run_w"]), "+-3", "F4.2 crate base"],
             ["crane", "top of crane (top frame) above floor", round(p["H_mast"]), "+-10", "design_result crane.mass.H_mast_m"],
             ["crane", "mast tube length", round(p["z_top0"] - p["z_mast0"]), M, "top frame - bottom frame"],
             ["crane", "mast section h(x) x b(y) x t", "%d x %d x %d" % (p["mast_h"], p["mast_b"], p["mast_t"]), "EN 10219", "asrs_data crane.mast"],
             ["crane", "mast position x (local)", "%d .. %d" % p["mast_x"], M, "asrs_3d"],
             ["crane", "bottom frame length x width", "3100 x 700", M, "asrs_3d"],
             ["crane", "wheel diameter", p["wheel_D"], "h9 tread", "asrs_data crane.wheel_D_mm"],
             ["crane", "wheelbase", round(p["wheelbase"]), "+-1", "asrs_data crane.wheelbase_m"],
             ["crane", "wheel centre height", round(30 + p["wheel_D"] / 2), M, "rail 30 + D/2"],
             ["crane", "hoist drum diameter", p["drum_D"], "grooved, ISO 2768-mK", "asrs_data crane.drum_D_mm"],
             ["crane", "carriage x range (local) / width", "-500 .. 300 / 1200", M, "asrs_3d"],
             ["crane", "max half width in aisle (carriage)", 600, M, "clearance to crate face 200"],
             ["fork", "stage widths base/middle/top", "450 / 400 / 350", M, "asrs_3d"],
             ["fork", "stage thickness base/middle/top", "60 / 45 / 35", M, "asrs_3d"],
             ["fork", "stage length", round(p["fork_len"]), M, "asrs_3d"],
             ["fork", "stroke each side", round(p["stroke"]), "+-2", "asrs_data crane.fork_stroke_m"],
             ["fork", "lift above beam (fork in / lift)", "10 / 150", "+-2", "asrs_data fork_lift_m"],
             ["rails", "bottom rail section / length", "50 x 30 / %d" % round(p["rail_x"][1] - p["rail_x"][0]), "see D05", "asrs_design bom A6"],
             ["rails", "top guide rail z range", "%d .. %d" % (p["rail_top_z0"], p["rail_top_z1"]), "+-3", "asrs_3d"],
             ["rails", "cross ties z range (every 3rd frame)", "%d .. %d" % (p["tie_z0"], p["tie_z1"]), "+-5", "asrs_3d"],
             ["building", "clear height required (underside roof)", round(p["clear_h"]), ">= value", "asrs_data rack.clear_height_m"],
             ["io", "conveyor top (transfer level)", round(p["conv_top"]), "+-2", "design_result io"],
             ["io", "conveyor length / width", "6400 / 1250", M, "asrs_3d"],
             ["io", "contour gate x", -3000, "+-20", "asrs_3d"],
             ["io", "pick station x range", "-8500 .. -6700", "+-50", "asrs_3d"]]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        csv.writer(fh).writerows(rows)
    return len(rows) - 1


# ============================================================================ run / selftest
DEMO = {"bay": 3, "k": 0, "level": 4, "side": 1}


def build_all(p):
    demo = dict(DEMO)
    demo["crate_x"] = crate_x(p, demo["bay"], demo["k"])
    meshes = {"rack": gen_rack(p), "rails": gen_rails(p), "crane": gen_crane(p, 1, 0.0, 1),
              "fork": gen_fork(p, 0.0), "fork_ext": gen_fork(p, p["stroke"], 1), "io": gen_io(p), "crate": gen_crate(p)}
    meshes["asrs_assembly"] = gen_assembly(p, demo)
    return meshes, demo


def cmd_run():
    p, R = params()
    os.makedirs(D3, exist_ok=True)
    os.makedirs(DRW, exist_ok=True)
    meshes, demo = build_all(p)
    for k, m in meshes.items():
        write_stl(m, os.path.join(D3, k + ".stl"))
        print("  %-14s %7d triangles  bbox %s .. %s" % (k + ".stl", len(m.tris), tuple(round(v) for v in m.bbox()[0]), tuple(round(v) for v in m.bbox()[1])))
    for name, lines in scad_files(p).items():
        with open(os.path.join(D3, name), "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines) + "\n")
    # iso preview of the front part (bays 0..5) + crane + I/O, to keep the SVG small
    q = dict(p)
    q["bays"] = 6
    q["L_rack"] = 6 * p["bay"] + p["up_w"]
    q["rail_x"] = (p["rail_x"][0], q["x0"] + q["L_rack"] + 1000)
    steel = Mesh("steel").extend(gen_rack(q)).extend(gen_rails(q))
    crates = Mesh("crates")
    cr = gen_crate(q, filled=False)
    for (x, y, z, s) in crate_positions(q):
        if abs(x - demo["crate_x"]) < 1 and s == demo["side"] and abs(z - level_z(q, demo["level"])) < 1:
            continue
        crates.extend(cr.moved(x, y, z))
    crane = gen_crane(q, demo["level"], q["stroke"], demo["side"]).moved(dx=demo["crate_x"] - q["fork_xc"])
    load = cr.moved(demo["crate_x"], demo["side"] * q["y_crate_c"], level_z(q, demo["level"]) + 150)
    groups = [(steel, (80, 110, 160)), (crates, (170, 185, 200)), (gen_io(q), (110, 160, 95)),
              (crane, (225, 120, 40)), (load, (240, 200, 60))]
    ntri = iso_preview(groups, os.path.join(D3, "preview_iso.svg"), "AS/RS F3 - front 6 bays, crane at bay 4 level 4 with the fork extended to side R")
    print("  preview_iso.svg %d visible triangles" % ntri)
    draw_D01(p, os.path.join(DRW, "D01_asrs_general_arrangement.svg"))
    draw_D02(p, os.path.join(DRW, "D02_rack_frame_beam_detail.svg"))
    draw_D03(p, os.path.join(DRW, "D03_stacker_crane_GA.svg"))
    draw_D04(p, os.path.join(DRW, "D04_telescopic_fork.svg"))
    draw_D05(p, os.path.join(DRW, "D05_rail_floor_layout.svg"))
    n = dimension_table(p, os.path.join(DRW, "dimension_table.csv"))
    print("  drawings D01..D05 + dimension_table.csv (%d rows) written to %s" % (n, DRW))
    return 0


def selftest():
    ok = []

    def check(name, cond):
        ok.append(bool(cond))
        print("  [%s] %s" % ("PASS" if cond else "FAIL", name))

    p, R = params()
    # mesh library
    m = Mesh("t").box(0, 0, 0, 10, 20, 30)
    vol = 0.0
    for t in m.tris:
        vol += dot(t[0], cross(t[1], t[2])) / 6
    check("box: 12 triangles, outward winding (signed volume %.0f = 6000)" % vol, len(m.tris) == 12 and abs(vol - 6000) < 1e-6)
    c = Mesh("c").cyl((0, 0, 0), "z", 10, 20, 64)
    vol = sum(dot(t[0], cross(t[1], t[2])) / 6 for t in c.tris)
    check("cylinder volume -> pi r2 h (%.0f vs %.0f)" % (vol, math.pi * 100 * 20), abs(vol - math.pi * 100 * 20) / (math.pi * 2000) < 0.01)
    b = Mesh("b").bar((0, 0, 0), (0, 300, 400), 40)
    vol = sum(dot(t[0], cross(t[1], t[2])) / 6 for t in b.tris)
    check("diagonal bar volume = 40 x 40 x 500 (%.0f)" % vol, abs(vol - 800000) < 1)
    mm = Mesh("m").box(0, 100, 0, 10, 200, 10).moved(mirror_y=True)
    vol = sum(dot(t[0], cross(t[1], t[2])) / 6 for t in mm.tris)
    check("mirror keeps outward winding (volume +%.0f)" % vol, abs(vol - 10000) < 1e-6)
    # build + files
    cmd_run()
    names = ["rack", "rails", "crane", "fork", "fork_ext", "io", "crate", "asrs_assembly"]
    bb = {}
    good = True
    for k in names:
        n, lo, hi = read_stl(os.path.join(D3, k + ".stl"))
        bb[k] = (lo, hi)
        good &= n > 0
    check("all %d STL files readable back, triangles > 0" % len(names), good)
    lo, hi = bb["rack"]
    check("rack bbox length %.1f = %d (bbox - 2 x 25 base-plate overhang)" % (hi[0] - lo[0] - 50, round(p["L_rack"])), abs((hi[0] - lo[0] - 50) - p["L_rack"]) <= 1)
    check("rack bbox height %.1f = %d" % (hi[2] - lo[2], round(p["H_rack"])), abs((hi[2] - lo[2]) - p["H_rack"]) <= 1)
    check("rack bbox width %.1f = %d" % (hi[1] - lo[1] - 70, round(p["W_rack"])), abs((hi[1] - lo[1] - 70) - p["W_rack"]) <= 1)  # base plates +35 each side
    cm = gen_crane(p, 1, 0.0, 1)
    top_frame = max(v[2] for t in cm.tris for v in t if abs(v[0] + 800) <= 500 and abs(v[1]) <= 250 and v[2] <= p["H_mast"] + 0.5)
    check("crane top frame = H_mast %d (%.1f)" % (round(p["H_mast"]), top_frame), abs(top_frame - p["H_mast"]) <= 1)
    lo, hi = bb["crane"]
    half = max(abs(lo[1]), abs(hi[1]))
    check("crane (fork retracted) half width %.0f -> clearance to crate faces %.0f mm >= 50" % (half, p["y_crate0"] - half), p["y_crate0"] - half >= 50)
    check("crane inside the aisle between upright faces (+-%d)" % p["y_face"], half <= p["y_face"])
    lo, hi = bb["fork_ext"]
    check("fork extended: tip %.0f >= crate centre %d and <= rack rear %d" % (hi[1], p["y_crate_c"], p["y_rear"]),
          p["y_crate_c"] <= hi[1] <= p["y_rear"])
    fork_centre = (hi[1] + lo[1]) / 2 + 0  # top stage centre is ext; check top stage covers the crate centre
    check("top stage covers the crate centre (top stage %.0f..%.0f)" % (p["stroke"] - p["fork_len"] / 2, p["stroke"] + p["fork_len"] / 2),
          p["stroke"] - p["fork_len"] / 2 <= p["y_crate_c"] <= p["stroke"] + p["fork_len"] / 2)
    lw = p["run_w"]
    check("fork %d fits between the crate runners (opening %.0f, >= 25 mm each side)" % (p["fork_w"][0], p["cW"] - 2 * lw), p["cW"] - 2 * lw - p["fork_w"][0] >= 50 - 1e-9)
    check("fork (140 mm) + 10 mm entry fits under the crate body (runners %d)" % p["c_leg"], 10 + sum(p["fork_t"]) <= p["c_leg"])
    lo, hi = bb["crane"]
    check("wheels stand on the 30 mm rail (crane min z %.1f)" % lo[2], abs(lo[2] - 30) < 0.5)
    lo, hi = bb["rails"]
    check("ties top %.0f below building clear height %d" % (hi[2], round(p["clear_h"])), hi[2] <= p["clear_h"])
    check("top-level crate top %.0f below rack top tie %d" % (level_z(p, p["levels"]) + p["cH"], round(p["H_rack"] - 120)),
          level_z(p, p["levels"]) + p["cH"] <= p["H_rack"] - 120)
    check("carriage at top level stays below the top frame", level_z(p, p["levels"]) + 10 + 420 < p["z_top0"])
    check("carriage at level 1 above the low bottom frame (%.0f > %.0f)" % (level_z(p, 1) + 10 - 80, p["z_frame_top"]),
          level_z(p, 1) + 10 - 80 > p["z_frame_top"])
    # SVG + scad + csv
    svgs = sorted(f for f in os.listdir(DRW) if f.endswith(".svg"))
    good = len(svgs) == 5
    for f in svgs:
        try:
            root = ET.parse(os.path.join(DRW, f)).getroot()
            txt = " ".join((e.text or "") for e in root.iter() if e.tag.endswith("text"))
            good &= ("DESIGN - to be checked and released by the responsible engineer" in txt) and ("ISO 2768-mK" in txt) and ("F3-ASRS-D0" in txt)
        except ET.ParseError:
            good = False
    check("5 drawings well-formed SVG with title block, tolerance and status", good)
    try:
        ET.parse(os.path.join(D3, "preview_iso.svg"))
        check("iso preview well-formed", True)
    except ET.ParseError:
        check("iso preview well-formed", False)
    good = True
    for f in os.listdir(D3):
        if f.endswith(".scad"):
            s = open(os.path.join(D3, f), encoding="utf-8").read()
            good &= s.count("{") == s.count("}") and s.count("(") == s.count(")") and s.count("[") == s.count("]")
    check("OpenSCAD sources: 6 files, brackets balanced", good and len([f for f in os.listdir(D3) if f.endswith(".scad")]) == 6)
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
