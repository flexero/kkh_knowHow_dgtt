#!/usr/bin/env python3
"""SVG schematic sheets of the module circuit library (item 8): one sheet per circuit pattern and one overview
sheet per module (cabinet with IO station and cards, field devices with IEC 81346 designations and cables, IO tags).

Python 3 standard library only, offline. The sheets are plain SVG text (no fonts, scripts or links to load): they
open in any browser or vector program on an offline PC. Symbols are drawn from lines, rectangles and circles in
the style of IEC 60617 (simplified - not a certified symbol library). Frame = A3 landscape (420 x 297 mm) with a
title block: project, sheet title, designation, sheet number, revision.

Data and rules = examples/item8_examples.json, expanded by circuit_lib_core.py (the same IO addresses,
designations, cables and terminals as circuit_library.py). Guide: docs/FMS system design/68_module_circuits.md.

Sheets:
  pattern sheet   one instance of the pattern in a dummy unit 'XX01' (group 'Grp'): cabinet part (power chain,
                  IO card channels, terminal strip -XD2), cables WDn, field devices
  module sheet    overview of the module: cabinet (IO station, cards with used / spare channels, cabinet
                  devices, PSU, -XD2), field devices + cables per instance, IO list with addresses
  revision 2026-11-15: power cables show the per-instance sized cores text (rule power_cable, e.g. M10 heater
  4G6) with Ib / Ip ; new pattern sheet ZONE_OUT (zone F-DO + EDM F-DI) -> 32 pattern + 22 module = 54 sheets

Usage:
  python tools/fmse/circuit_svg.py --pattern DOL --out sheets          (one pattern sheet)
  python tools/fmse/circuit_svg.py --module M03 --out sheets           (= --example: module overview M03)
  python tools/fmse/circuit_svg.py --all --out sheets                  (every pattern + every module + index)
  python tools/fmse/circuit_svg.py --list                              (names of all sheets)
  python tools/fmse/circuit_svg.py --module M03 --json                 (sheet list + sizes as JSON)
  python tools/fmse/circuit_svg.py --selftest

All drawings are EXAMPLES and NOT for construction. Real schematics are made in an E-CAD system and signed off by
a qualified electrical / safety engineer to IEC 60204-1, IEC 61082 / IEC 81346 and the current standards.
"""

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

from fmse_common import InputError, SelfTest, run_main
import circuit_lib_core as core
from circuit_lib_core import NOTE

W, H = 420, 297
PROJECT = "FMS1 module circuit library (EXAMPLE)"
REVISION = "A"
STAMP = "EXAMPLE - NOT FOR CONSTRUCTION. Sign-off by a qualified engineer (IEC 60204-1, current standards)."
POWER_CLASSES = ("FC", "QA", "TA")


def esc(s):
    return escape(str(s), {'"': "&quot;"})


class Sheet:
    """Collects SVG elements in mm (viewBox 0 0 420 297)."""

    def __init__(self):
        self.el = []

    def line(self, x1, y1, x2, y2, w=0.35, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.el.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="#000" '
                       f'stroke-width="{w}"{d}/>')

    def rect(self, x, y, w, h, sw=0.35, dash=None, fill="none"):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.el.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" fill="{fill}" '
                       f'stroke="#000" stroke-width="{sw}"{d}/>')

    def circle(self, x, y, r, sw=0.35, fill="none"):
        self.el.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{fill}" stroke="#000" '
                       f'stroke-width="{sw}"/>')

    def path(self, d, sw=0.35):
        self.el.append(f'<path d="{d}" fill="none" stroke="#000" stroke-width="{sw}"/>')

    def text(self, x, y, s, size=2.5, anchor="start", bold=False, cls=None):
        b = ' font-weight="bold"' if bold else ""
        c = f' class="{cls}"' if cls else ""
        self.el.append(f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" text-anchor="{anchor}"{b}{c}>'
                       f'{esc(s)}</text>')

    def svg(self, title):
        head = (f'<?xml version="1.0" encoding="UTF-8"?>\n'
                f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}" '
                f'font-family="Arial, Helvetica, sans-serif">\n<title>{esc(title)}</title>\n'
                f'<rect x="0" y="0" width="{W}" height="{H}" fill="#fff"/>\n')
        return head + "\n".join(self.el) + "\n</svg>\n"


# ----------------------------------------------------------------------------- frame + title block
def frame(S, sheet_title, designation, sheet_no, sheet_total):
    S.rect(5, 5, W - 10, H - 10, 0.7)
    S.rect(10, 10, W - 20, H - 20, 0.5)
    for k in range(8):                                     # column marks 1..8 (IEC 61082 style grid)
        x = 10 + (W - 20) * k / 8
        S.line(x, 5, x, 10, 0.25)
        S.text(x + (W - 20) / 16, 8.8, str(k + 1), 2.5, "middle")
    for k, ch in enumerate("ABCDEF"):
        y = 10 + (H - 20) * k / 6
        S.line(5, y, 10, y, 0.25)
        S.text(7.5, y + (H - 20) / 12, ch, 2.5, "middle")
    x0, y0, w, h = 250, 252, 160, 35
    S.rect(x0, y0, w, h, 0.5)
    for yy in (y0 + 7, y0 + 14, y0 + 21, y0 + 28):
        S.line(x0, yy, x0 + w, yy, 0.25)
    S.line(x0 + 110, y0 + 14, x0 + 110, y0 + 28, 0.25)
    S.text(x0 + 2, y0 + 5, f"Project: {PROJECT}", 2.6, bold=True)
    S.text(x0 + 2, y0 + 12, f"Sheet: {sheet_title}", 2.6)
    S.text(x0 + 2, y0 + 19, f"Designation: {designation}", 2.6, cls="designation")
    S.text(x0 + 112, y0 + 19, f"Rev. {REVISION}", 2.6)
    S.text(x0 + 2, y0 + 26, "Drawn: tools/fmse/circuit_svg.py  Standard: IEC 60617 / 81346 (simplified)", 2.2)
    S.text(x0 + 112, y0 + 26, f"Sheet {sheet_no} / {sheet_total}", 2.6)
    S.text(x0 + 2, y0 + 33, STAMP, 1.9)


# ----------------------------------------------------------------------------- IEC-60617-like symbols
def sym_breaker(S, x, y):
    """Circuit breaker (single-line, 3-pole marks): contact with cross at the fixed point."""
    S.line(x, y - 8, x, y - 4)
    S.line(x, y - 4, x - 3.5, y + 3)
    S.line(x, y + 4, x, y + 8)
    S.line(x - 1.2, y - 5.2, x + 1.2, y - 2.8)
    S.line(x + 1.2, y - 5.2, x - 1.2, y - 2.8)
    sym_3ph(S, x, y + 6)


def sym_contactor(S, x, y):
    """Contactor main contact (NO with semicircle at the fixed point)."""
    S.line(x, y - 8, x, y - 4)
    S.line(x, y - 4 + 0.0, x - 3.5, y + 3)
    S.line(x, y + 4, x, y + 8)
    S.path(f"M {x - 1.3:.2f} {y - 4:.2f} A 1.3 1.3 0 0 0 {x + 1.3:.2f} {y - 4:.2f}")
    sym_3ph(S, x, y + 6)


def sym_3ph(S, x, y):
    for k in (-1, 0, 1):
        S.line(x - 1.2, y + k * 1.0 + 0.6, x + 1.2, y + k * 1.0 - 0.6, 0.25)


def sym_motor(S, x, y, r=6):
    S.circle(x, y, r)
    S.text(x, y - 0.3, "M", r * 0.55, "middle", True)
    S.text(x, y + r * 0.6, "3~", r * 0.4, "middle")


def sym_converter(S, x, y, top="~", bot="~", s=10):
    S.rect(x - s / 2, y - s / 2, s, s)
    S.line(x - s / 2, y + s / 2, x + s / 2, y - s / 2, 0.25)
    S.text(x - s / 4, y - s / 8, top, s * 0.3, "middle")
    S.text(x + s / 4, y + s / 3, bot, s * 0.3, "middle")


def sym_heater(S, x, y, s=10):
    S.rect(x - s / 2, y - s / 4, s, s / 2)
    for k in range(1, 4):
        xx = x - s / 2 + k * s / 4
        S.line(xx, y - s / 4, xx, y + s / 4, 0.25)


def sym_sensor(S, x, y, s=8):
    """Proximity sensor: square with rhombus."""
    S.rect(x - s / 2, y - s / 2, s, s)
    S.path(f"M {x:.2f} {y - s / 3:.2f} L {x + s / 3:.2f} {y:.2f} L {x:.2f} {y + s / 3:.2f} "
           f"L {x - s / 3:.2f} {y:.2f} Z", 0.25)


def sym_pushbutton(S, x, y, s=8, estop=False):
    """NO contact with push actuator (dashed stem); e-stop: mushroom head."""
    S.line(x, y + s / 2, x, y + s / 4)
    S.line(x, y + s / 4, x - s / 3, y - s / 6)
    S.line(x, y - s / 4, x, y - s / 2)
    S.line(x - s / 6, y + s / 20, x - s / 1.6, y + s / 20, 0.25, "0.8 0.6")
    if estop:
        S.path(f"M {x - s / 1.6:.2f} {y - s / 6:.2f} A {s / 5:.2f} {s / 5:.2f} 0 0 0 {x - s / 1.6:.2f} "
               f"{y + s / 4:.2f}")
    else:
        S.line(x - s / 1.6, y - s / 6, x - s / 1.6, y + s / 4)


def sym_coil(S, x, y, s=8, slash=True):
    S.rect(x - s / 3, y - s / 2, s / 1.5, s)
    if slash:
        S.line(x - s / 3, y + s / 2, x + s / 3, y - s / 2, 0.25)


def sym_lamp(S, x, y, r=3.5):
    S.circle(x, y, r)
    S.line(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7, 0.25)
    S.line(x - r * 0.7, y + r * 0.7, x + r * 0.7, y - r * 0.7, 0.25)


def sym_box(S, x, y, label, s=9):
    S.rect(x - s / 2, y - s / 2.5, s, s / 1.25)
    S.text(x, y + 0.9, label, 2.2, "middle")


def sym_transmitter(S, x, y, letter, r=3.8):
    S.circle(x, y, r)
    S.text(x, y + 1.0, letter, 2.8, "middle", True)


def draw_device(S, d, x, y):
    """Draw the symbol of a device dict at (x, y) by its class code."""
    c = d["class"]
    if c == "FC":
        sym_breaker(S, x, y)
    elif c == "QA":
        sym_contactor(S, x, y)
    elif c == "MA":
        sym_motor(S, x, y)
    elif c == "TA":
        sym_converter(S, x, y, "~", "~")
    elif c == "TB":
        sym_converter(S, x, y, "~", "=")
    elif c == "EB":
        sym_heater(S, x, y)
    elif c == "BG":
        sym_sensor(S, x, y)
    elif c == "SF":
        sym_pushbutton(S, x, y, estop="mergency" in d["description"])
    elif c == "MB":
        sym_coil(S, x, y)
    elif c == "PF":
        sym_lamp(S, x, y)
    elif c in ("BP", "BT"):
        sym_transmitter(S, x, y, c[1])
    else:
        sym_box(S, x, y, c)


# ----------------------------------------------------------------------------- pattern sheet
def pattern_module(L, pname):
    """A one-instance dummy module 'XX' with the pattern (example params for power patterns)."""
    if pname not in L["patterns"]:
        raise InputError(f"unknown pattern '{pname}'; patterns are {', '.join(L['patterns'])}")
    L2 = core.broken_copy(L)
    par = {"kW": 4} if L["patterns"][pname].get("power") in ("motor", "vfd", "heater") else {}
    if L["patterns"][pname].get("power") == "load":
        par = {"kW": 10, "ku": 0.6, "cos": 0.9}
    L2["unit_codes"]["PAT"] = "XX"
    L2["modules"]["PAT"] = {"title": f"pattern {pname}", "instances": [[pname, "Grp", par]]}
    return core.expand_module(L2, "PAT")


def pcab_text(x):
    """One-line power cable sizing text of a power_cables entry (rule '_rules.power_cable')."""
    return (f"power cable {x['cable']}: Ib {x['Ib']:.2f} A -> Ip {x['Ip']:g} A ({x['ip_kind']}) -> Iz req "
            f"{x['Iz_req']:.2f} A -> {x['A']:g} mm2 -> {x['cores']}")


def pattern_sheet(L, pname, sheet_no=1, sheet_total=1):
    m = pattern_module(L, pname)
    P = L["patterns"][pname]
    S = Sheet()
    frame(S, f"Pattern {pname}", f"{m['location']} (example unit)", sheet_no, sheet_total)
    S.text(20, 20, f"Circuit pattern {pname}: {P.get('title', '')}", 4, bold=True)
    par = m["instances"][0]["params"]
    S.text(20, 26, f"io {len(P['io'])}, devices {len(P['dev'])}, cables {len(P['cab'])}, 24 V {P.get('i24', 0)} A, "
                   f"loss {P.get('loss', 0)} W, supply terminals {P.get('tx', 0)}"
                   + (f", example parameters {par}" if par else ""), 2.6)
    for k, x in enumerate(m["power_cables"]):
        S.text(20, 30 + k * 3.5, pcab_text(x) + ("" if x["sized"] else "  (pattern has no 'pcab': default text)"),
               2.4, cls="pcab")
    # cabinet and field zones
    cx0, cy0, cx1, cy1 = 20, 32, 400, 150
    S.rect(cx0, cy0, cx1 - cx0, cy1 - cy0, 0.35, "3 1.5")
    S.text(cx0 + 2, cy0 + 4, f"Control cabinet {m['location']}", 2.8, bold=True)
    fy0, fy1 = 185, 245
    S.rect(cx0, fy0, cx1 - cx0, fy1 - fy0, 0.35, "3 1.5")
    S.text(cx0 + 2, fy0 + 4, "Field", 2.8, bold=True)
    cab_devs = [d for d in m["devices"] if d["location"] == "cabinet"]
    field = [d for d in m["devices"] if d["location"] == "field"]
    power = [d for d in cab_devs if d["class"] in POWER_CLASSES] if P.get("power") else []
    other_cab = [d for d in cab_devs if d not in power]
    pos = {}
    # power chain: bus L1 L2 L3 PE, then FC -> QA / TA vertically
    if power:
        S.line(cx0 + 4, 42, cx0 + 90, 42, 0.5)
        S.text(cx0 + 92, 43, "L1 L2 L3 PE  400 V AC (from the module feeder)", 2.4)
        sym_3ph(S, cx0 + 60, 42)
        x, y = 50, 42
        for d in power:
            y += 20
            S.line(x, y - 20, x, y - 8)
            draw_device(S, d, x, y)
            S.text(x + 6, y - 1, d["short"], 2.8, bold=True, cls="designation")
            S.text(x + 6, y + 2.5, d["description"][:70], 2.2)
            pos[d["short"]] = (x, y + 8)
            if d["class"] == "TA":
                y += 4
    # other cabinet devices (KF, TB ...)
    xo = 50 if not power else 130
    for k, d in enumerate(other_cab):
        x, y = xo + k * 40, 60
        draw_device(S, d, x, y)
        S.text(x, y + 9, d["short"], 2.8, "middle", True, cls="designation")
        S.text(x, y + 12, d["description"][:30], 2.0, "middle")
        pos[d["short"]] = (x, y + 6)
    # IO channels (one small box per io entry) and terminal strip -XD2
    io_x0 = 200
    S.text(io_x0, 40, "IO station: channels (address = TYPE card.channel)", 2.6, bold=True)
    tpos = {}
    for k, e in enumerate(m["io"]):
        x, y = io_x0 + (k % 3) * 66, 44 + (k // 3) * 9
        S.rect(x, y, 62, 7, 0.3)
        S.text(x + 1.5, y + 4.8, f"{e['address']}  {e['signal']}", 2.4, cls="address")
    nt = len(m["terminals"])
    ty = 138
    if nt:
        S.text(cx0 + 2, ty - 4, "-XD2", 2.8, bold=True, cls="designation")
        step = min(10, 330 / max(nt, 1))
        t0 = io_x0 + 10 if io_x0 + 10 + nt * step <= 395 else 75
        for k, t in enumerate(m["terminals"]):
            x = t0 + k * step
            S.rect(x - 2, ty - 2, 4, 4, 0.3)
            S.text(x, ty + 5.5, str(t["terminal"]), 2.2, "middle")
            S.text(x, ty - 3, "" if t["kind"] == "io" else t["kind"], 1.8, "middle")
            tpos[t["terminal"]] = x
            if t["kind"] == "io":
                k_io = [e["tag"] for e in m["io"]].index(t["tag"])
                bx, by = io_x0 + (k_io % 3) * 66 + 31, 44 + (k_io // 3) * 9 + 7
                S.line(x, ty - 2, x, ty - 6, 0.2)
                S.line(x, ty - 6, bx, by + 2, 0.15, "0.6 0.6")
    # field devices along the bottom zone
    fx = {}
    nf = len(field)
    for k, d in enumerate(field):
        x = 50 + k * min(60, 330 / max(nf, 1))
        y = 215
        draw_device(S, d, x, y)
        S.text(x, y + 13, d["short"], 2.8, "middle", True, cls="designation")
        S.text(x, y + 16.5, d["description"][:34], 2.0, "middle")
        fx[d["short"]] = x
    # cables: power cable from the last power device to the motor / heater, others from -XD2 to field devices
    targets = [d["short"] for d in field if d["class"] not in ("MA", "EB")]
    ti = 0
    for k, c in enumerate(m["cables"]):
        if power and k == 0 and P.get("power") in ("motor", "vfd", "heater", "load"):
            x1, y1 = pos[power[-1]["short"]]
            tgt = next((d["short"] for d in field if d["class"] in ("MA", "EB")), None)
        else:
            x1 = ((tpos[min(tpos)] + tpos[max(tpos)]) / 2 + k * 4) if tpos else 300 + k * 10
            y1 = ty + 2
            tgt = targets[ti] if ti < len(targets) else None
            ti += 1
        x2 = fx.get(tgt, x1)
        if tgt:
            S.line(x1, y1, x1, 165, 0.5)
            S.line(x1, 165, x2, 170, 0.5)
            S.line(x2, 170, x2, 205, 0.5)
        else:
            S.line(x1, y1, x1, 170, 0.5)
            S.text(x1 + 1, 174, "to switch / IO station bus" if "Ethernet" in c["description"]
                   else f"to the field: {c['description']}", 2.0)
        lx = x1 + 1.5
        S.text(lx, 158 - (k % 2) * 4, f"{c['cable']} {c['cores']} {c['length']:g} m", 2.4, cls="cable")
    # IO list block
    S.text(20, 252, "IO list", 2.8, bold=True)
    for k, e in enumerate(m["io"][:9]):
        S.text(20 + (k // 3) * 75, 257 + (k % 3) * 4.5, f"{e['address']} {e['group']}.{e['signal']} ({e['type']})",
               2.3)
    S.text(20, 284, "Tags: PLT1.MACH.FMS1.<unit>.<group>.<signal> ; designations =FMS1.<unit>-<class><n>", 2.2)
    return S.svg(f"Pattern {pname}"), m


# ----------------------------------------------------------------------------- module overview sheet
def module_sheet(L, code, sheet_no=1, sheet_total=1, unit=None):
    m = core.expand_module(L, code, unit)
    S = Sheet()
    frame(S, f"Module {code} overview", m["location"], sheet_no, sheet_total)
    S.text(15, 18, f"Module {code} {m['location']}: {m['title']}", 4, bold=True)
    S.text(15, 23, f"io {len(m['io'])}, IO cards {m['n_cards']}, devices {len(m['devices'])}, cables "
                   f"{len(m['cables'])} = {m['cable_metres']:g} m, terminals -XD2 {len(m['terminals'])}, 24 V "
                   f"{m['i24']:.3f} A -> PSU {m['psu']:g} A, feeder {m['feeder']['In']:g} A / "
                   f"{m['feeder']['A']:g} mm2", 2.6)
    # cabinet
    x0, y0, x1, y1 = 15, 28, 140, 245
    S.rect(x0, y0, x1 - x0, y1 - y0, 0.5, "3 1.5")
    S.text(x0 + 2, y0 + 5, f"Control cabinet {m['location']}", 2.8, bold=True)
    y = y0 + 9
    if m["feeder"]["In"]:
        S.text(x0 + 3, y + 2, f"supply {m['feeder']['designation']} {m['feeder']['In']:g} A, "
                              f"{m['feeder']['A']:g} mm2 (main board)", 2.2)
        y += 5
    if m["station"]:
        S.rect(x0 + 3, y, 119, 7, 0.35)
        S.text(x0 + 5, y + 4.8, "IO station: bus interface (PROFINET / Modbus TCP)", 2.4)
        y += 9
        for t in core.IO_TYPES:
            n, ch, used = m["cards"].get(t, 0), m["channels"].get(t, 0), m["used"].get(t, 0)
            for c in range(n):
                u = max(0, min(ch, used - c * ch))
                S.rect(x0 + 3, y, 119, 6, 0.3)
                S.rect(x0 + 3, y, 119 * u / ch, 6, 0.0, fill="#ddd")
                S.rect(x0 + 3, y, 119, 6, 0.3)
                S.text(x0 + 5, y + 4.2, f"{t}{c + 1}: {t} {ch} card, used {u}, spare {ch - u}", 2.3, cls="card")
                y += 7
    if m["psu"]:
        sym_converter(S, x0 + 9, y + 6, "~", "=", 8)
        S.text(x0 + 16, y + 7, f"24 V power supply {m['psu']:g} A (load {m['i24']:.2f} A)", 2.3)
        y += 13
    cab = [d for d in m["devices"] if d["location"] == "cabinet"]
    rowh = min(9.0, (y1 - 14 - y) / max(len(cab), 1))
    for d in cab:
        S.text(x0 + 4, y + rowh * 0.6, f"{d['designation']}", 2.3, bold=True, cls="designation")
        S.text(x0 + 40, y + rowh * 0.6, f"{d['description'][:60]}", 2.0)
        y += rowh
    if m["terminals"]:
        S.text(x0 + 3, y1 - 4, f"-XD2 terminal strip: 1..{len(m['terminals'])}", 2.4, bold=True)
    # field devices per instance with cables
    fx0 = 200
    S.text(fx0, y0 + 5, "Field devices and cables", 2.8, bold=True)
    rows = []
    for inst in m["instances"]:
        fd = [d for d in inst["dev"] if d["location"] == "field"]
        rows.append((inst, fd))
    n_rows = sum(max(1, len(fd)) for inst, fd in rows if fd or inst["cab"])
    rh = min(12.0, (y1 - y0 - 12) / max(n_rows, 1))
    y = y0 + 10
    for inst, fd in rows:
        if not fd and not inst["cab"]:
            continue
        top = y
        for d in fd or [None]:
            if d:
                s = min(1.0, rh / 12)
                draw_device_small(S, d, fx0 + 5, y + rh / 2, s)
                S.text(fx0 + 13, y + rh / 2 - 0.4, d["designation"], 2.3, bold=True, cls="designation")
                S.text(fx0 + 13, y + rh / 2 + 2.6, f"{inst['group']}: {d['description'][:40]}", 1.9)
            else:
                S.text(fx0 + 13, y + rh / 2 + 1, f"{inst['group']} ({inst['pattern']}): cabinet device only", 2.0)
            y += rh
        mid = (top + y) / 2
        S.line(x1, mid, fx0 - 2, mid, 0.4)
        pz = inst.get("pcab")
        for j, c in enumerate(inst["cab"]):
            extra = (f" (Ib {pz['Ib']:.1f} A, Ip {pz['Ip']:g} A)" if c.get("power_cable") and pz else "")
            S.text(x1 + 1.5, mid - 0.8 + j * 2.6, f"{c['cable']} {c['cores']} {c['length']:g} m{extra}", 1.9,
                   cls="cable")
    # IO list
    ix0 = 297
    S.text(ix0, y0 + 5, "IO list (address, tag)", 2.8, bold=True)
    n_io = len(m["io"])
    rh = min(5.0, (250 - y0 - 12) / max(n_io, 1))
    fs = min(2.2, rh * 0.8)
    for k, e in enumerate(m["io"]):
        yy = y0 + 10 + k * rh + rh * 0.8
        S.text(ix0, yy, e["address"], fs, cls="address")
        S.text(ix0 + 13, yy, e["tag"], fs, cls="tag")
    if not m["io"]:
        S.text(ix0, y0 + 12, "no hard-wired IO in this module", 2.4)
    return S.svg(f"Module {code} overview"), m


def draw_device_small(S, d, x, y, s):
    sub = Sheet()
    draw_device(sub, d, 0, 0)
    S.el.append(f'<g transform="translate({x:.2f},{y:.2f}) scale({0.7 * s:.3f})">' + "".join(sub.el) + "</g>")


# ----------------------------------------------------------------------------- sheet set
def sheet_names(L):
    return [f"pattern_{p}.svg" for p in L["patterns"]] + [f"module_{c}.svg" for c in L["modules"]]


def write_all(L, out):
    d = Path(out)
    d.mkdir(parents=True, exist_ok=True)
    names = sheet_names(L)
    total = len(names)
    files = []
    for k, p in enumerate(L["patterns"], 1):
        svg, _ = pattern_sheet(L, p, k, total)
        files.append(write_svg(d / f"pattern_{p}.svg", svg))
    for k, c in enumerate(L["modules"], len(L["patterns"]) + 1):
        svg, _ = module_sheet(L, c, k, total)
        files.append(write_svg(d / f"module_{c}.svg", svg))
    idx = ["<!DOCTYPE html>", "<html><head><meta charset='utf-8'><title>Module circuit sheets</title></head><body>",
           "<h1>Module circuit library: SVG sheets (EXAMPLES)</h1>", f"<p>{esc(NOTE)}</p>", "<ol>"]
    idx += [f"<li><a href='{n}'>{n}</a></li>" for n in names]
    idx += ["</ol></body></html>"]
    (d / "index.html").write_text("\n".join(idx) + "\n", encoding="utf-8")
    return files


def write_svg(path, svg):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(svg, encoding="utf-8")
    return p


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    import tempfile
    import xml.etree.ElementTree as ET
    t = SelfTest("circuit_svg")
    L = core.load_library(path)
    ns = "{http://www.w3.org/2000/svg}"

    def texts(svg):
        root = ET.fromstring(svg.encode("utf-8"))
        return root, [el.text or "" for el in root.iter(ns + "text")]

    names = sheet_names(L)
    t.equal("sheet set: 32 pattern + 22 module sheets", len(names), 54)
    t.true("ZONE_OUT pattern sheet is in the set", "pattern_ZONE_OUT.svg" in names)
    ok_all, bad = True, []
    for p in L["patterns"]:
        svg, m = pattern_sheet(L, p)
        try:
            root, tx = texts(svg)
            joined = "\n".join(tx)
            if not all(d["short"] in joined for d in m["devices"]) or not all(e["address"] in joined for e in m["io"]):
                ok_all = False
                bad.append(p)
        except ET.ParseError as exc:
            ok_all = False
            bad.append(f"{p}: {exc}")
    t.true("all 32 pattern sheets are well-formed XML and show every designation + address", ok_all, str(bad))
    svg, m = pattern_sheet(L, "DOL")
    root, tx = texts(svg)
    joined = "\n".join(tx)
    t.equal("DOL sheet root is <svg> with viewBox 0 0 420 297", (root.tag, root.get("viewBox")),
            (ns + "svg", "0 0 420 297"))
    t.true("DOL sheet: FC1, QA1, MA1, DO1.00 Run, DI1.00 RunFb, WD1 4G1.5",
           all(s in joined for s in ("FC1", "QA1", "MA1", "DO1.00  Run", "DI1.00  RunFb", "WD1 4G1.5 15 m")))
    t.true("DOL sheet: title block with project, designation, revision, sheet number",
           all(s in joined for s in ("Project: " + PROJECT, "Designation: =FMS1.XX01", "Rev. A", "Sheet 1 / 1")))
    t.true("DOL sheet: motor symbol (circle) present", len(list(root.iter(ns + "circle"))) >= 1)
    t.true("DOL sheet: power cable sizing line Ib 8.00 A -> Ip 8 A (MPCB setting) -> 1.5 mm2 -> 4G1.5",
           "power cable WD1: Ib 8.00 A -> Ip 8 A (MPCB setting) -> Iz req 11.94 A -> 1.5 mm2 -> 4G1.5" in joined)
    zj = "\n".join(texts(pattern_sheet(L, "ZONE_OUT")[0])[1])
    t.true("ZONE_OUT sheet: FDO1.00 Release, FDI1.00 Fb, XD1, WD1 4x0.75 20 m",
           all(s in zj for s in ("FDO1.00  Release", "FDI1.00  Fb", "XD1", "WD1 4x0.75 20 m")))
    for pn, txt in (("HEATER", "4G1.5"), ("VFD_STO", "4G1.5 + shield"), ("FEEDER_EXT", "4G2.5")):
        pj = "\n".join(texts(pattern_sheet(L, pn)[0])[1])
        t.true(f"{pn} sheet: sized power cable WD1 {txt} (example parameters) with Ib / Ip line",
               f"WD1 {txt} " in pj and "power cable WD1: Ib" in pj)
    t.true("COUPLING title with '<->' is escaped and parses", "<->" in "\n".join(texts(pattern_sheet(L, "COUPLING")[0])[1]))
    svg, m = module_sheet(L, "M03")
    root, tx = texts(svg)
    joined = "\n".join(tx)
    t.true("M03 sheet: all 22 device designations present", all(d["designation"] in joined for d in m["devices"]))
    t.true("M03 sheet: all 31 tags + addresses present", all(e["tag"] in joined and e["address"] in joined
                                                            for e in m["io"]))
    t.true("M03 sheet: all 16 cable numbers present", all(f"{c['cable']} " in joined for c in m["cables"]))
    t.true("M03 sheet: cards FDI1, FDI2, FDO1, FDO2 with used / spare",
           all(f"{c}: " in joined for c in ("FDI1", "FDI2", "FDO1", "FDO2")) and "used 3, spare 5" in joined)
    t.true("M03 sheet: PSU 5 A and supply feeder =FMS1.POOL01-FC4 40 A shown",
           "24 V power supply 5 A" in joined and
           "=FMS1.POOL01-FC4 40 A" in joined)
    t.true("M03 sheet: sized motor cables WD1 4G4 + shield, WD3 4G2.5 + shield with Ib / Ip",
           "WD1 4G4 + shield 15 m (Ib 22.0 A, Ip 22 A)" in joined and "WD3 4G2.5 + shield 15 m" in joined)
    j10 = "\n".join(texts(module_sheet(L, "M10")[0])[1])
    t.true("M10 sheet: heater cable WD3 4G6 10 m (Ib 26.0 A, Ip 32 A), spray pump WD1 4G2.5",
           "WD3 4G6 10 m (Ib 26.0 A, Ip 32 A)" in j10 and "WD1 4G2.5 15 m" in j10)
    j16 = "\n".join(texts(module_sheet(L, "M16")[0])[1])
    t.true("M16 sheet: hydraulic pump cable 4G6", "4G6 " in j16)
    svg18, m18 = module_sheet(L, "M18")
    j18 = "\n".join(texts(svg18)[1])
    t.true("M18 sheet: 4 zones Zone1..Zone4 Release/Fb tags, FDO1 card used 4, 4 zone cables 4x0.75 20 m",
           all(f"PLT1.MACH.FMS1.SAFE01.Zone{z}.Release" in j18 and f"PLT1.MACH.FMS1.SAFE01.Zone{z}.Fb" in j18
               for z in range(1, 5)) and "FDO1: FDO 4 card, used 4, spare 0" in j18 and
           sum(1 for c in m18["cables"] if f"{c['cable']} 4x0.75 20 m" in j18) == 4)
    t.true("M18 sheet: designations XD1..XD4 (zone interface terminal blocks)",
           all(f"=FMS1.SAFE01-XD{z}" in j18 for z in range(1, 5)))
    svg21, _ = module_sheet(L, "M21")
    t.true("M21 sheet (no circuits) is well-formed and says 'no hard-wired IO'",
           "no hard-wired IO" in "\n".join(texts(svg21)[1]))
    big = max(L["modules"], key=lambda c: len(core.expand_module(L, c)["io"]))
    svgb, mb = module_sheet(L, big)
    t.true(f"largest module {big} ({len(mb['io'])} io): every tag inside the sheet (y <= 250)",
           all(float(el.get("y")) <= 250.5 for el in texts(svgb)[0].iter(ns + "text") if el.get("class") == "tag"))
    try:
        pattern_sheet(L, "NOPE")
        t.true("unknown pattern rejected", False)
    except InputError:
        t.true("unknown pattern rejected", True)
    with tempfile.TemporaryDirectory() as d:
        files = write_all(L, d)
        t.equal("--all writes 54 SVG files + index.html", (len(files), (Path(d) / "index.html").is_file()), (54, True))
        allok = True
        for f in files:
            try:
                ET.parse(str(f))
            except ET.ParseError:
                allok = False
        t.true("every written SVG file parses with xml.etree", allok)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(core.ITEM8_EXAMPLES), help="library JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="module overview M03 (also the default)")
    ap.add_argument("--pattern", help="one pattern sheet, e.g. DOL")
    ap.add_argument("--module", help="one module overview sheet, e.g. M03")
    ap.add_argument("--all", action="store_true", help="every pattern + module sheet + index.html")
    ap.add_argument("--list", action="store_true", help="list the sheet names")
    ap.add_argument("--out", default="circuit_sheets", help="output folder (default: %(default)s)")
    ap.add_argument("--json", action="store_true", help="machine-readable list of written sheets")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    L = core.load_library(a.examples)
    if a.list:
        for k, n in enumerate(sheet_names(L), 1):
            print(f"{k:3d}  {n}")
        return 0
    if a.all:
        files = write_all(L, a.out)
    elif a.pattern:
        p = a.pattern.upper()
        files = [write_svg(Path(a.out) / f"pattern_{p}.svg", pattern_sheet(L, p)[0])]
    else:
        c = (a.module or "M03").upper()
        files = [write_svg(Path(a.out) / f"module_{c}.svg", module_sheet(L, c)[0])]
    if a.json:
        print(json.dumps({"sheets": [str(f) for f in files], "note": NOTE}, indent=1, ensure_ascii=False))
        return 0
    for f in files:
        print(f"SVG written: {f}")
    if a.all:
        print(f"index: {Path(a.out) / 'index.html'}")
    print()
    print(NOTE)
    return 0


if __name__ == "__main__":
    run_main(main)
