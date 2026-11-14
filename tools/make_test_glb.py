"""Make a TEST machine model web/models/hmc_test.glb (standard library only).

It stands in for a model exported from SOLIDWORKS (guide docs/55). It has the
same NODE NAMES and PIVOTS that your real export should have, so the 3D view
can animate it:

    HMC                      root, origin = floor centre of the machine, Y up, +Z = operator side
    +- Base, Enclosure*      fixed
    +- Column   (moves Z)    +- Head (moves Y)  +- Spindle (turns about its own Z axis)
    +- Table    (moves X)    +- B_axis (turns about Y)  +- Workpiece (shown when a part is in)
    +- Door     (slides +X when open)
    +- Magazine (tool disc, turns about X)
    +- APC_Base, APC_Arm (turns 180 deg about Y at each part change) +- Pallet_A, Pallet_B
    +- Andon    (empty marker: where the light tower is put)

Material named "Body" = machine paint; the twin tints it with the state colour.
Units metres. Geometry is simple boxes and cylinders (example only).

Run:  python tools/make_test_glb.py     -> web/models/hmc_test.glb
"""
from __future__ import annotations

import json
import math
import os
import struct

OUT = os.path.join(os.path.dirname(__file__), "..", "web", "models", "hmc_test.glb")

# name: (r, g, b, a, metallic, roughness)
MATS = {
    "Body": (0.89, 0.90, 0.92, 1, 0.0, 0.55),
    "Accent": (0.12, 0.37, 0.66, 1, 0.2, 0.45),
    "Dark": (0.17, 0.19, 0.21, 1, 0.3, 0.6),
    "Grey": (0.60, 0.63, 0.66, 1, 0.3, 0.5),
    "Steel": (0.73, 0.75, 0.78, 1, 0.75, 0.35),
    "Glass": (0.65, 0.80, 0.90, 0.28, 0.0, 0.1),
    "CastIron": (0.35, 0.33, 0.31, 1, 0.4, 0.7),
    "Yellow": (0.95, 0.75, 0.10, 1, 0.0, 0.5),
}


def box_geo(sx, sy, sz, cx=0.0, cy=0.0, cz=0.0):
    """Box centred at (cx, cy, cz): 24 vertices (flat normals), 12 triangles."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    faces = [  # normal, 4 corners (counter-clockwise seen from outside)
        ((1, 0, 0), [(hx, -hy, hz), (hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz)]),
        ((-1, 0, 0), [(-hx, -hy, -hz), (-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz)]),
        ((0, 1, 0), [(-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz), (-hx, hy, -hz)]),
        ((0, -1, 0), [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz), (-hx, -hy, hz)]),
        ((0, 0, 1), [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]),
        ((0, 0, -1), [(hx, -hy, -hz), (-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz)]),
    ]
    pos, nor, idx = [], [], []
    for n, quad in faces:
        b = len(pos)
        for x, y, z in quad:
            pos.append((x + cx, y + cy, z + cz))
            nor.append(n)
        idx += [b, b + 1, b + 2, b, b + 2, b + 3]
    return pos, nor, idx


def cyl_geo(r, h, axis="y", seg=32, cx=0.0, cy=0.0, cz=0.0):
    """Cylinder along 'axis', centred at (cx, cy, cz). Side + 2 caps."""
    def orient(a, b, c):  # (radial1, along, radial2) -> xyz
        if axis == "y":
            return (a, b, c)
        if axis == "x":
            return (b, a, c)
        return (a, c, b)  # z
    pos, nor, idx = [], [], []
    for i in range(seg + 1):  # side
        t = 2 * math.pi * i / seg
        ca, sa = math.cos(t), math.sin(t)
        for s in (-1, 1):
            p = orient(r * ca, s * h / 2, r * sa)
            pos.append((p[0] + cx, p[1] + cy, p[2] + cz))
            nor.append(orient(ca, 0, sa))
    for i in range(seg):
        a, b = 2 * i, 2 * i + 2
        idx += [a, a + 1, b + 1, a, b + 1, b]
    for s in (-1, 1):  # caps
        c0 = len(pos)
        p = orient(0, s * h / 2, 0)
        pos.append((p[0] + cx, p[1] + cy, p[2] + cz)); nor.append(orient(0, s, 0))
        for i in range(seg + 1):
            t = 2 * math.pi * i / seg
            p = orient(r * math.cos(t), s * h / 2, r * math.sin(t))
            pos.append((p[0] + cx, p[1] + cy, p[2] + cz)); nor.append(orient(0, s, 0))
        for i in range(seg):
            a, b = c0 + 1 + i, c0 + 2 + i
            idx += [c0, b, a] if s > 0 else [c0, a, b]
    # winding check is not critical: materials are double-sided below
    return pos, nor, idx


class GLB:
    def __init__(self):
        self.bin = bytearray()
        self.views, self.accs, self.meshes, self.nodes = [], [], [], []
        self.mat_names = list(MATS)

    def _view(self, data: bytes, target: int) -> int:
        while len(self.bin) % 4:
            self.bin.append(0)
        self.views.append({"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data), "target": target})
        self.bin += data
        return len(self.views) - 1

    def mesh(self, name, parts):
        """parts = [(geometry, material_name), ...] -> mesh index."""
        prims = []
        for (pos, nor, idx), mat in parts:
            pv = self._view(struct.pack(f"<{len(pos) * 3}f", *[c for p in pos for c in p]), 34962)
            nv = self._view(struct.pack(f"<{len(nor) * 3}f", *[c for n in nor for c in n]), 34962)
            iv = self._view(struct.pack(f"<{len(idx)}H", *idx), 34963)
            lo = [min(p[k] for p in pos) for k in range(3)]
            hi = [max(p[k] for p in pos) for k in range(3)]
            self.accs += [
                {"bufferView": pv, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": lo, "max": hi},
                {"bufferView": nv, "componentType": 5126, "count": len(nor), "type": "VEC3"},
                {"bufferView": iv, "componentType": 5123, "count": len(idx), "type": "SCALAR"},
            ]
            a = len(self.accs)
            prims.append({"attributes": {"POSITION": a - 3, "NORMAL": a - 2}, "indices": a - 1,
                          "material": self.mat_names.index(mat)})
        self.meshes.append({"name": name, "primitives": prims})
        return len(self.meshes) - 1

    def node(self, name, t=(0, 0, 0), parts=None, children=(), extras=None) -> int:
        n = {"name": name, "translation": list(t)}
        if parts:
            n["mesh"] = self.mesh(name + "_mesh", parts)   # mesh name differs from node name (loader keeps names unique)
        if children:
            n["children"] = list(children)
        if extras:
            n["extras"] = extras
        self.nodes.append(n)
        return len(self.nodes) - 1

    def write(self, path, root):
        mats = [{"name": k, "doubleSided": True,
                 "pbrMetallicRoughness": {"baseColorFactor": list(v[:4]), "metallicFactor": v[4], "roughnessFactor": v[5]},
                 **({"alphaMode": "BLEND"} if v[3] < 1 else {})} for k, v in MATS.items()]
        while len(self.bin) % 4:
            self.bin.append(0)
        doc = {"asset": {"version": "2.0", "generator": "tools/make_test_glb.py (digital twin test model)"},
               "scene": 0, "scenes": [{"nodes": [root]}], "nodes": self.nodes, "meshes": self.meshes,
               "materials": mats, "accessors": self.accs, "bufferViews": self.views,
               "buffers": [{"byteLength": len(self.bin)}]}
        js = json.dumps(doc, separators=(",", ":")).encode()
        js += b" " * (-len(js) % 4)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(struct.pack("<III", 0x46546C67, 2, total))
            fh.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
            fh.write(struct.pack("<II", len(self.bin), 0x004E4942) + self.bin)
        tris = sum(self.accs[p["indices"]]["count"] // 3 for m in self.meshes for p in m["primitives"])
        return total, tris


def build() -> tuple[int, int]:
    g = GLB()
    B = box_geo
    # fixed frame: base + enclosure with a window in the front (x -1.2..0.8, y 1.1..2.4)
    base = g.node("Base", parts=[(B(3.8, 0.35, 2.9, 0, 0.175, 0), "Dark"),
                                 (B(3.82, 0.12, 2.92, 0, 0.41, 0), "Accent")])
    enc = g.node("Enclosure", parts=[
        (B(0.08, 2.45, 2.9, -1.86, 1.575, 0), "Body"), (B(0.08, 2.45, 2.9, 1.86, 1.575, 0), "Body"),  # sides
        (B(3.8, 2.45, 0.08, 0, 1.575, -1.41), "Body"),                                                  # back
        (B(3.8, 0.25, 2.9, 0, 2.925, 0), "Grey"),                                                       # roof
        (B(3.8, 0.75, 0.08, 0, 0.725, 1.41), "Body"), (B(3.8, 0.4, 0.08, 0, 2.6, 1.41), "Body"),       # front low/high
        (B(0.7, 1.3, 0.08, -1.55, 1.75, 1.41), "Body"), (B(1.0, 1.3, 0.08, 1.3, 1.75, 1.41), "Body"),  # pillars
        (B(1.0, 1.3, 0.02, 0.3, 1.75, 1.40), "Glass"),                                                  # fixed glass
        (B(0.06, 0.06, 2.92, 0, 2.8, 0), "Accent"),
        (B(0.5, 1.4, 0.35, 1.55, 1.6, 1.62), "Dark"), (B(0.42, 0.3, 0.02, 1.55, 1.95, 1.80), "Accent"),  # operator panel
        (B(1.2, 0.6, 0.9, -1.1, 0.3, -1.95), "Accent"), (B(0.8, 0.7, 2.2, 0.6, 0.55, -2.4), "Grey"),     # coolant tank, chip conveyor
    ])
    # spindle unit: Column (Z) -> Head (Y) -> Spindle (rotates about its own Z axis)
    spindle = g.node("Spindle", t=(0, 0, 0.35), parts=[
        (cyl_geo(0.11, 0.30, "z", 32), "Steel"), (B(0.04, 0.20, 0.04, 0, 0.06, 0.16), "Yellow"),
        (cyl_geo(0.035, 0.18, "z", 16, 0, 0, 0.24), "Steel")])
    head = g.node("Head", t=(0, 1.75, 0.25), parts=[(B(0.55, 0.5, 0.55, 0, 0, 0), "Grey")], children=[spindle])
    column = g.node("Column", t=(-0.2, 0.47, -0.85), parts=[
        (B(1.0, 0.15, 0.9, 0, 0.075, 0), "Dark"), (B(0.85, 2.0, 0.6, 0, 1.15, -0.05), "Body")], children=[head])
    # table: Table (X) -> B_axis (rotates about Y) -> Workpiece
    work = g.node("Workpiece", t=(0, 0.35, 0), parts=[(B(0.6, 0.45, 0.5, 0, 0.225, 0), "CastIron")])
    baxis = g.node("B_axis", t=(0, 0.3, 0), parts=[(cyl_geo(0.42, 0.08, "y", 40, 0, 0.04, 0), "Steel"),
                                                   (B(0.18, 0.27, 0.5, 0, 0.215, -0.3), "Dark")], children=[work])
    table = g.node("Table", t=(-0.2, 0.47, 0.35), parts=[(B(1.3, 0.3, 1.0, 0, 0.15, 0), "Grey")], children=[baxis])
    # sliding door in front of the window (opens towards +X); extras = travel in metres (read by the twin)
    door = g.node("Door", t=(-0.7, 1.75, 1.47), parts=[(B(1.0, 1.3, 0.03, 0, 0, 0), "Glass"),
                                                       (B(1.0, 0.07, 0.05, 0, 0.62, 0), "Grey"),
                                                       (B(0.05, 0.3, 0.06, 0.42, 0, 0.03), "Dark")],
                  extras={"travel_m": 0.95})
    mag = g.node("Magazine", t=(-2.05, 1.95, -0.6), parts=[(cyl_geo(0.75, 0.25, "x", 40), "Grey"),
                                                           (B(0.27, 0.12, 0.12, 0, 0.7, 0), "Yellow"),
                                                           (B(0.3, 1.2, 0.3, 0.1, -1.2, 0), "Dark")])
    # automatic pallet changer: two pallets on an arm that turns 180 deg about Y
    pals = []
    for nm, dz in (("Pallet_A", -0.48), ("Pallet_B", 0.48)):
        pals.append(g.node(nm, t=(0, 0, dz), parts=[(B(0.8, 0.08, 0.8, 0, 0.04, 0), "Steel"),
                                                    (B(0.18, 0.66, 0.46, 0, 0.41, 0), "Dark"),
                                                    (B(0.36, 0.28, 0.32, 0.22, 0.3, 0), "CastIron")]))
    apc_base = g.node("APC_Base", t=(-2.55, 0, 0.1), parts=[(B(1.0, 0.75, 1.9, 0, 0.375, 0), "Dark"),
                                                            (cyl_geo(0.55, 0.08, "y", 40, 0, 0.79, 0), "Steel")])
    apc_arm = g.node("APC_Arm", t=(-2.55, 0.83, 0.1), children=pals)
    andon = g.node("Andon", t=(1.5, 3.05, -1.2))
    root = g.node("HMC", children=[base, enc, column, table, door, mag, apc_base, apc_arm, andon],
                  extras={"source": "test model - replace with your SOLIDWORKS export (docs/55)"})
    return g.write(OUT, root)


if __name__ == "__main__":
    size, tris = build()
    print(f"wrote {os.path.normpath(OUT)}  {size / 1024:.1f} kB  {tris} triangles")
