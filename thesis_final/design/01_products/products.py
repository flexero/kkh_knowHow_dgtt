#!/usr/bin/env python3
"""Final thesis item F1 - products, parts, routings and machining times of the combined FMS.

Products: VC20 V-twin piston compressor (20 m3/h class) + Roots blower family RB50 / RB100 / RB150.
Python 3 standard library only, offline. Data: products.json (same folder). Guide: Doctor paper/58_final_products_and_parts.md

Commands
  python products.py selftest              formula + data checks (must print SELFTEST PASS)
  python products.py run [--out out]       all outputs: BOM / routing / machine-minutes CSV, report.md, product-tree SVG
  python products.py part C01 [--variant VC20]   feature-by-feature time sheet of one part (shows every formula value)
  python products.py perf                  compressor TDC dimension chain + performance; Roots blower flow, power, motor
  python products.py minutes               machine minutes per unit by machine type and variant (input of item F2)
  python products.py --data other.json ... use another data file (e.g. your own product)

Time formulas (all times per feature; n = spindle speed rpm, capped at the machine n_max):
  face     n = 1000 vc/(pi Dc); vf = fz z n; rows = ceil(W/(0.7 Dc)); layers = ceil(stock/ap)
           t = rows*layers*(L + Dc)/vf                                     [min]
  contour  layers = ceil(depth/Dc); passes = ceil(stock/(0.3 Dc)) + 1;  t = P*layers*passes/vf
  slot     layers = ceil(depth/(0.5 Dc)); t = L*layers/(0.7 vf)          (full-width slot: feed -30 %)
  pocket   Q = ap*ae*vf with ap = ae = 0.5 Dc;  t = V/Q
  surface  (Roots lobe, 4-axis flank milling with A-axis) layers = ceil(L/(1.5 Dc));
           t = perimeter*layers*(ceil(stock/(0.3 Dc))/vf_r + 1/vf_f)/0.6   (0.6 = A-axis interpolation factor)
  drill    t = n_holes*(H + 0.3 D)/(f n)
  tap      t = n_holes*2*(H + 2 P)/(P n)      (synchronous tapping, in + out)
  bore     t = n*(H + 2)/(f z n)              (one pass per feature; z = 2 twin-cutter rough bar, 1 finish)
  turn     passes = ceil(stock/ap); t = passes*(L+2)/(f_r n_r) + (L+2)/(f_f n_f)   (rough + one finish pass)
  groove   t = depth/(f_radial n)
  grind    t = stock/vr*60 + spark  [s]  per diameter, + dress once per op
  hone     t = stock/rate + t_fix   [s]
Non-cutting time per op = probe + per feature (t_feat + (holes-1) t_hole or (n-1) t_index) + tool changes * t_tc.
Batch ops (washing, lapping): fixed_s / batch per part.  Sampled ops (CMM): fixed_s * sample per part.
Cutting power (check):  face/slot  Pc = ap*ae*vf*kc/60e6 [kW];  turn Pc = kc*ap*f*vc/60000 [kW].
"""

import argparse
import csv
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "products.json")
PI = math.pi
HOLE_TYPES = ("drill", "tap")


class InputError(Exception):
    pass


# ----------------------------------------------------------------------------- data + safe expressions
def load(path=DATA):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


_ALLOWED = set("0123456789.+-*/() eE")


def val(x, params):
    """Number or expression like 'L+20' / '2.6+0.040*L' in the variant parameters (no other names allowed)."""
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x)
    for k in sorted(params, key=len, reverse=True):
        s = s.replace(k, "(%r)" % float(params[k]))
    if not set(s) <= _ALLOWED:
        raise InputError("bad expression %r (only numbers, + - * / ( ) and variant parameters %s)" % (x, list(params)))
    return float(eval(s, {"__builtins__": {}}, {}))  # noqa: S307 - character whitelist above


# ----------------------------------------------------------------------------- feature time formulas
def rpm(vc, D, n_max):
    n = 1000.0 * vc / (PI * D)
    return min(n, n_max) if n_max else n


def feature_time(f, cut, mat, mach, tools, params):
    """Return dict(cut_s, holes, tool_key, pc_kW, detail) for one feature (all repetitions f['n'])."""
    t = f["t"]
    c = cut[mat]
    nmax = mach.get("n_max", 0)
    nrep = int(f.get("n", 1))
    g = lambda k: val(f[k], params)  # noqa: E731
    pc = 0.0
    if t == "face":
        tl = tools[f["tool"]]; d = c["face"]
        n = rpm(d["vc"], tl["Dc"], nmax); vf = d["fz"] * tl["z"] * n
        rows = math.ceil(g("W") / (0.7 * tl["Dc"])); layers = math.ceil(g("stock") / d["ap"])
        tmin = rows * layers * (g("L") + tl["Dc"]) / vf * nrep
        ae = min(g("W"), 0.7 * tl["Dc"]); ap = min(g("stock"), d["ap"])
        pc = ap * ae * vf * c["kc"] / 60e6
        det = "n=%.0f vf=%.0f rows=%d layers=%d" % (n, vf, rows, layers); key = f["tool"]
    elif t in ("contour", "slot", "pocket", "surface"):
        tl = tools[f["tool"]]; d = c["endmill"]; Dc = tl["Dc"]
        n = rpm(d["vc"], Dc, nmax); vf = d["fz"] * tl["z"] * n
        if t == "contour":
            layers = math.ceil(g("depth") / Dc); passes = math.ceil(g("stock") / (0.3 * Dc)) + 1
            tmin = g("P") * layers * passes / vf * nrep
            pc = min(g("depth"), Dc) * 0.3 * Dc * vf * c["kc"] / 60e6
            det = "n=%.0f vf=%.0f layers=%d passes=%d" % (n, vf, layers, passes)
        elif t == "slot":
            layers = math.ceil(g("depth") / (0.5 * Dc)); tmin = g("L") * layers / (0.7 * vf) * nrep
            pc = 0.5 * Dc * Dc * 0.7 * vf * c["kc"] / 60e6
            det = "n=%.0f vf=%.0f layers=%d" % (n, 0.7 * vf, layers)
        elif t == "pocket":
            Q = 0.5 * Dc * 0.5 * Dc * vf; tmin = g("V") / Q * nrep
            pc = Q * c["kc"] / 60e6
            det = "n=%.0f vf=%.0f Q=%.1f cm3/min" % (n, vf, Q / 1000)
        else:  # surface - Roots lobe flank milling, A-axis interpolation
            layers = math.ceil(g("L") / (1.5 * Dc)); rp = math.ceil(g("stock") / (0.3 * Dc))
            nf = rpm(1.2 * d["vc"], Dc, nmax); vff = 0.7 * d["fz"] * tl["z"] * nf
            tmin = g("perimeter") * layers * (rp / vf + 1.0 / vff) / 0.6 * nrep
            pc = 1.5 * Dc * 0.3 * Dc * vf * c["kc"] / 60e6
            det = "layers=%d rough passes=%d vf_r=%.0f vf_f=%.0f kA=0.6" % (layers, rp, vf, vff)
        key = f["tool"]
    elif t == "drill":
        d = c["drill"]; D = g("D"); n = rpm(d["vc"], D, nmax)
        tmin = nrep * (g("H") + 0.3 * D) / (d["f"] * n)
        pc = d["f"] * d["vc"] * D * c["kc"] / 240000
        det = "n=%.0f f=%.2f" % (n, d["f"]); key = "DR%.1f" % D
    elif t == "tap":
        d = c["tap"]; D = g("D"); P = g("P"); n = rpm(d["vc"], D, min(nmax or 3000, 3000))
        tmin = nrep * 2 * (g("H") + 2 * P) / (P * n)
        det = "n=%.0f P=%.2f" % (n, P); key = "TAP%.1f" % D
    elif t in ("bore_r", "bore_f"):
        d = c[t]; D = g("D"); n = rpm(d["vc"], D, nmax); z = d.get("z", 1)
        tmin = nrep * (g("H") + 2) / (d["f"] * z * n)
        det = "n=%.0f f=%.2f" % (n, d["f"]); key = "%s%.1f" % (t.upper(), D)
    elif t == "turn":
        dr, df = c["turn_r"], c["turn_f"]; D = g("D"); L = g("L") + 2
        orb = float(f.get("orbital", 1.0))
        nr = rpm(dr["vc"], D, nmax); nf = rpm(df["vc"], D, nmax)
        passes = math.ceil(g("stock") / dr["ap"])
        tmin = nrep * orb * (passes * L / (dr["f"] * nr) + L / (df["f"] * nf))
        pc = c["kc"] * min(g("stock"), dr["ap"]) * dr["f"] * dr["vc"] / 60000
        det = "n_r=%.0f n_f=%.0f passes=%d%s" % (nr, nf, passes, (" orbital x%.1f" % orb) if orb != 1 else "")
        key = "TURN"
    elif t == "groove":
        dr = c["turn_r"]; n = rpm(dr["vc"], g("D"), nmax)
        tmin = nrep * g("depth") / (cut["groove"]["f_radial"] * n)
        det = "n=%.0f f_rad=%.2f" % (n, cut["groove"]["f_radial"]); key = "GROOVE"
    elif t == "grind":
        gd = cut["grind"]; ts = nrep * (g("stock") / gd["vr_mm_min"] * 60 + gd["spark_s"])
        return {"cut_s": ts, "holes": 0, "tool_key": "WHEEL", "pc_kW": 0.0, "nrep": nrep,
                "detail": "vr=%.1f mm/min spark=%ds" % (gd["vr_mm_min"], gd["spark_s"])}
    elif t == "hone":
        hd = cut["hone"]; ts = nrep * (g("stock") / hd["rate_mm_s"] + hd["t_fix_s"])
        return {"cut_s": ts, "holes": 0, "tool_key": "HONE", "pc_kW": 0.0, "nrep": nrep,
                "detail": "rate=%.4f mm/s t_fix=%ds" % (hd["rate_mm_s"], hd["t_fix_s"])}
    else:
        raise InputError("unknown feature type %r" % t)
    return {"cut_s": tmin * 60.0, "holes": nrep if t in HOLE_TYPES else 0, "tool_key": key,
            "pc_kW": pc, "nrep": nrep, "detail": det}


def op_time(op, part, data, params):
    """Times of one operation per PART: cut, non-cut, total, load (s) + feature sheet."""
    mach = data["machines"][op["machine"]]
    if "fixed_s" in op:
        tot = float(op["fixed_s"])
        if "batch" in op:
            tot /= float(op["batch"])
        if "sample" in op:
            tot *= float(op["sample"])
        return {"cut_s": tot, "noncut_s": 0.0, "total_s": tot, "load_s": 0.0, "pc_max": 0.0, "sheet": [], "tools": 0}
    cut = noncut = 0.0
    sheet = []
    last = None
    ntools = 0
    pcmax = 0.0
    noncut += mach.get("t_probe", 0)
    for f in op.get("features", []):
        r = feature_time(f, data["cutting"], part["mat"], mach, data["tools"], params)
        cut += r["cut_s"]
        if r["holes"]:
            nc = mach["t_feat"] + (r["holes"] - 1) * mach["t_hole"]
        else:
            nc = mach["t_feat"] + (r["nrep"] - 1) * mach.get("t_index", 0)
        if r["tool_key"] != last:
            nc += mach.get("t_tc", 0)
            ntools += 1
            last = r["tool_key"]
        noncut += nc
        pcmax = max(pcmax, r["pc_kW"])
        sheet.append((f["t"], r["nrep"], r["cut_s"], nc, r["pc_kW"], r["detail"]))
    lm = data["load_model"]
    load = 0.0
    if op.get("clamps", 0):
        m = val(part["m_blank"], params)
        load = lm["base"] + lm["per_clamp"] * op["clamps"] + (lm["hoist"] if m > lm["hoist_above_kg"] else 0) + lm["clean"]
    return {"cut_s": cut, "noncut_s": noncut, "total_s": cut + noncut, "load_s": load, "pc_max": pcmax,
            "sheet": sheet, "tools": ntools}


# ----------------------------------------------------------------------------- product level
def variants(data):
    for pk, p in data["products"].items():
        for vk, params in p["variants"].items():
            yield pk, vk, params


def unit_qty(p, pk, parent, qty):
    """Quantity per product unit = own qty x qty of every assembly above it (multi-level explosion)."""
    up = {s[1]: (s[0], s[3]) for s in p["structure"]}
    q = qty
    node = parent
    while node != pk:
        par, sq = up[node]
        q *= sq
        node = par
    return q


def routing_rows(data, pk, vk, params):
    p = data["products"][pk]
    rows = []
    for part in p["parts"]:
        uq = unit_qty(p, pk, part["parent"], part["qty"])
        for op in part["ops"]:
            r = op_time(op, part, data, params)
            rows.append({"variant": vk, "part": part["id"], "name": part["name"], "qty": uq, "op": op["op"],
                         "machine": op["machine"], "alt": "/".join(op.get("alt", [])), "op_name": op["name"],
                         "cut_s": r["cut_s"], "noncut_s": r["noncut_s"], "total_s": r["total_s"], "load_s": r["load_s"],
                         "tools": r["tools"], "pc_max_kW": r["pc_max"]})
    for a in p["assembly"]:
        rows.append({"variant": vk, "part": "ASSY", "name": "product " + vk, "qty": 1, "op": a[0], "machine": a[1], "alt": "",
                     "op_name": a[2], "cut_s": a[3], "noncut_s": 0.0, "total_s": float(a[3]), "load_s": 0.0, "tools": 0,
                     "pc_max_kW": 0.0})
    return rows


def machine_minutes(data, pk, vk, params):
    """Minutes per product unit by machine type (machining x qty + assembly/test/paint/pack) + load-station minutes."""
    mm = {}
    load = 0.0
    for r in routing_rows(data, pk, vk, params):
        mm[r["machine"]] = mm.get(r["machine"], 0.0) + r["total_s"] * r["qty"] / 60.0
        if r["machine"] in ("HMC",):
            load += r["load_s"] * r["qty"] / 60.0
    mm["LOAD(HMC pallets)"] = load
    return mm


def bom_rows(data, pk, vk, params):
    p = data["products"][pk]
    rows = [{"level": 0, "parent": "", "item": vk, "name": p["name"], "qty": 1, "qty_unit": 1, "make_buy": "", "material": "", "blank": "",
             "m_blank_kg": "", "m_finish_kg": "", "family": "", "note": ""}]
    depth = {pk: 0}
    for par, it, name, q in p["structure"]:
        depth[it] = depth[par] + 1
        rows.append({"level": depth[it], "parent": vk if par == pk else par, "item": it, "name": name, "qty": q,
                     "qty_unit": unit_qty(p, pk, par, q), "make_buy": "A", "material": "", "blank": "", "m_blank_kg": "", "m_finish_kg": "", "family": "", "note": ""})
    for part in p["parts"]:
        rows.append({"level": depth[part["parent"]] + 1, "parent": part["parent"], "item": part["id"], "name": part["name"],
                     "qty": part["qty"], "qty_unit": unit_qty(p, pk, part["parent"], part["qty"]), "make_buy": "M", "material": part["material"], "blank": part["blank"],
                     "m_blank_kg": round(val(part["m_blank"], params), 2), "m_finish_kg": round(val(part["m_finish"], params), 2),
                     "family": part["family"], "note": part["data"]})
    for par, it, name, q, note in p["bought"]:
        rows.append({"level": depth[par if par != pk else pk] + 1 if par != pk else 1, "parent": vk if par == pk else par,
                     "item": it, "name": name, "qty": q, "qty_unit": unit_qty(p, pk, par, q), "make_buy": "B", "material": "", "blank": "", "m_blank_kg": "",
                     "m_finish_kg": "", "family": "B", "note": note})
    return rows


# ----------------------------------------------------------------------------- performance checks
MOTORS = [0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5, 11.0]


def compressor_perf(spec):
    Vs = spec["cylinders"] * PI / 4 * (spec["bore_mm"] / 1000) ** 2 * (spec["stroke_mm"] / 1000)
    disp = Vs * spec["speed_rpm"] * 60
    lam = spec["FAD_m3_h"] / disp
    p_in = spec["shaft_power_W"] / 0.95
    motor = next(m for m in MOTORS if m * 1000 >= p_in)
    return {"swept_L_per_rev": Vs * 1000, "displacement_m3_h": disp, "FAD_m3_h": spec["FAD_m3_h"], "lambda_total": lam,
            "motor_input_W": p_in, "motor_kW": motor, "motor_load": p_in / (spec["motor_kW"] * 1000)}


def tdc_chain(spec):
    """Dimension chain along one cylinder axis (crank axis = 0):
    crown at TDC = r + l + h_c ;  deck top of cylinder = h_d + t_g + L_cyl ;  TDC gap = deck top - crown TDC
    skirt bottom at BDC = (l - r) - (piston length - h_c) ;  spigot bottom = h_d - spigot
    clearances to the swept circle of webs / counterweights (radius R_w) must be >= 2 mm."""
    r = spec["stroke_mm"] / 2; l = spec["rod_mm"]; hc = spec["piston_comp_height_mm"]
    crown = r + l + hc
    top = spec["deck_height_mm"] + spec["base_gasket_mm"] + spec["cyl_length_mm"]
    skirt = (l - r) - (spec["piston_length_mm"] - hc)
    spig = spec["deck_height_mm"] - spec["spigot_mm"]
    return {"crown_TDC": crown, "cyl_top": top, "gap": top - crown, "skirt_BDC": skirt, "spigot_bottom": spig,
            "clear_skirt_web": skirt - spec["web_radius_mm"], "clear_spigot_web": spig - spec["web_radius_mm"],
            "skirt_out_of_bore": max(0.0, spig - skirt)}


def roots_perf(spec, L):
    D = spec["rotor_tip_dia_mm"]
    Vrev = 2 * spec["area_utilisation_phi"] * PI / 4 * D ** 2 * L / 1e9   # m3 per rev of the drive rotor
    Qth = Vrev * spec["speed_rpm"] * 60
    Q = Qth * (1 - spec["slip_fraction_at_500mbar"])
    dp = spec["dp_max_mbar"] * 100.0                                       # Pa
    P = Qth / 3600 * dp / spec["eta_mech"]                                 # isochoric work W = V dp
    Pm = P / spec["eta_belt"] * spec["motor_margin"]
    motor = next(m for m in MOTORS if m * 1000 >= Pm)
    tip = PI * D / 1000 * spec["speed_rpm"] / 60
    return {"V_rev_L": Vrev * 1000, "Q_th_m3_h": Qth, "Q_m3_h": Q, "P_shaft_W": P, "P_motor_need_W": Pm, "motor_kW": motor,
            "tip_speed_m_s": tip, "motor_rpm_check": spec["speed_rpm"] * spec["belt_ratio"]}


# ----------------------------------------------------------------------------- outputs
def fmt(x, nd=1):
    return ("%%.%df" % nd) % x if isinstance(x, float) else str(x)


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        for r in rows:
            w.writerow({k: (round(v, 2) if isinstance(v, float) else v) for k, v in r.items()})


def tree_svg(data, pk, vk, params, path):
    rows = bom_rows(data, pk, vk, params)
    rows = [r for r in rows if r["make_buy"] in ("", "A", "M")]
    nb = sum(1 for r in bom_rows(data, pk, vk, params) if r["make_buy"] == "B")
    W, rh = 760, 22
    H = 60 + rh * (len(rows) + 2)
    col = {"": "#1f4e79", "A": "#2e75b6", "M": "#c55a11"}
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" font-family="Arial" font-size="12">' % (W, H, W, H),
           '<rect width="100%" height="100%" fill="#ffffff"/>',
           '<text x="20" y="28" font-size="15" font-weight="bold" fill="#000">Product structure %s (made parts; %d bought items in BOM)</text>' % (vk, nb)]
    y = 50
    for r in rows:
        x = 30 + 28 * r["level"]
        if r["level"]:
            out.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#999"/>' % (x - 18, y - 4, x - 4, y - 4))
        out.append('<rect x="%d" y="%d" width="10" height="10" fill="%s"/>' % (x - 4, y - 13, col[r["make_buy"]]))
        label = "%s  %s  x%s" % (r["item"], r["name"], r["qty"])
        if r["make_buy"] == "M":
            label += "   [%s, %s kg, family %s]" % (r["material"].split(" ")[0], r["m_finish_kg"], r["family"])
        out.append('<text x="%d" y="%d" fill="#000">%s</text>' % (x + 12, y - 3, label.replace("&", "&amp;")))
        y += rh
    y += 6
    out.append('<rect x="30" y="%d" width="10" height="10" fill="#2e75b6"/><text x="46" y="%d">assembly</text>' % (y, y + 9))
    out.append('<rect x="130" y="%d" width="10" height="10" fill="#c55a11"/><text x="146" y="%d">made in the FMS (machined)</text>' % (y, y + 9))
    out.append("</svg>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out))


def cmd_part(data, pid, vk):
    for pk, v, params in variants(data):
        if vk and v != vk:
            continue
        for part in data["products"][pk]["parts"]:
            if part["id"] != pid:
                continue
            print("%s %s  (%s)  material %s, blank %.2f kg -> %.2f kg, qty %d per unit" % (
                v, part["id"], part["name"], part["material"], val(part["m_blank"], params), val(part["m_finish"], params),
                unit_qty(data["products"][pk], pk, part["parent"], part["qty"])))
            tot = 0.0
            for op in part["ops"]:
                r = op_time(op, part, data, params)
                tot += r["total_s"]
                print("  %s %-6s %s" % (op["op"], op["machine"], op["name"]))
                for t, n, cs, nc, pc, det in r["sheet"]:
                    print("      %-8s x%-2d cut %7.1f s  non-cut %5.1f s  Pc %4.1f kW  %s" % (t, n, cs, nc, pc, det))
                print("      -> cut %.1f s + non-cut %.1f s = %.1f s (%.2f min); tools %d; load/unload %.0f s; max Pc %.1f kW" % (
                    r["cut_s"], r["noncut_s"], r["total_s"], r["total_s"] / 60, r["tools"], r["load_s"], r["pc_max"]))
            print("  part total %.1f s = %.2f min per piece" % (tot, tot / 60))
            return 0
    raise InputError("part %s not found" % pid)


def cmd_perf(data):
    out = []
    vc = data["products"]["VC20"]["spec"]
    c = compressor_perf(vc)
    ch = tdc_chain(vc)
    out.append("VC20 TDC chain: crown at TDC %.1f, cylinder top %.1f -> gap %.2f mm; skirt at BDC %.1f, spigot bottom %.1f, web radius %d "
               "-> clearances %.1f / %.1f mm; skirt below bore %.1f mm" % (ch["crown_TDC"], ch["cyl_top"], ch["gap"], ch["skirt_BDC"],
               ch["spigot_bottom"], vc["web_radius_mm"], ch["clear_skirt_web"], ch["clear_spigot_web"], ch["skirt_out_of_bore"]))
    out.append("VC20 compressor: swept %.3f L/rev, displacement %.2f m3/h, FAD %.2f m3/h (lambda %.3f), motor input %.0f W -> %.1f kW "
               "(installed %.1f kW, load %.0f %%)" % (c["swept_L_per_rev"], c["displacement_m3_h"], c["FAD_m3_h"], c["lambda_total"],
                                                   c["motor_input_W"], c["motor_kW"], vc["motor_kW"], 100 * c["motor_load"]))
    rs = data["products"]["RB"]["spec"]
    for v, params in data["products"]["RB"]["variants"].items():
        r = roots_perf(rs, params["L"])
        out.append("%-6s L=%3d mm: V_rev %.3f L, Q_th %.1f m3/h, Q %.1f m3/h at %d mbar, P_shaft %.0f W, need %.0f W -> motor %.1f kW, "
                   "tip speed %.1f m/s" % (v, params["L"], r["V_rev_L"], r["Q_th_m3_h"], r["Q_m3_h"], rs["dp_max_mbar"], r["P_shaft_W"],
                                          r["P_motor_need_W"], r["motor_kW"], r["tip_speed_m_s"]))
    print("\n".join(out))
    return out


def minutes_table(data):
    allm = {}
    for pk, vk, params in variants(data):
        allm[vk] = machine_minutes(data, pk, vk, params)
    keys = []
    for vk in allm:
        for k in allm[vk]:
            if k not in keys:
                keys.append(k)
    return allm, keys


def cmd_minutes(data):
    allm, keys = minutes_table(data)
    print("%-18s" % "machine [min/unit]" + "".join("%9s" % v for v in allm))
    for k in keys:
        print("%-18s" % k + "".join("%9.2f" % allm[v].get(k, 0.0) for v in allm))
    return allm


def cmd_run(data, out):
    os.makedirs(out, exist_ok=True)
    rep = ["# F1 products - generated report", "",
           "Generated by `products.py run` from `products.json` (%s). All values are design values / reference estimates." % data["version"], ""]
    rep.append("## Performance check\n")
    rep += ["- " + s for s in cmd_perf(data)]
    allr = []
    for pk, vk, params in variants(data):
        b = bom_rows(data, pk, vk, params)
        write_csv(os.path.join(out, "bom_%s.csv" % vk), b)
        r = routing_rows(data, pk, vk, params)
        allr += r
        tree_svg(data, pk, vk, params, os.path.join(out, "tree_%s.svg" % vk))
        made = [x for x in b if x["make_buy"] == "M"]
        rep.append("\n## %s - made parts\n" % vk)
        rep.append("| Part | Name | Qty/unit | Material | Blank kg | Finish kg | Family | Machining min/piece |")
        rep.append("|---|---|---|---|---|---|---|---|")
        for x in made:
            t = sum(y["total_s"] for y in r if y["part"] == x["item"]) / 60
            rep.append("| %s | %s | %s | %s | %s | %s | %s | %.2f |" % (x["item"], x["name"], x["qty_unit"], x["material"], x["m_blank_kg"],
                                                                    x["m_finish_kg"], x["family"], t))
        rep.append("\nBought items: %d lines. Casting/forging mass per unit: %.1f kg blank, %.1f kg finished (chips %.1f kg).\n" % (
            sum(1 for x in b if x["make_buy"] == "B"),
            sum(x["m_blank_kg"] * x["qty_unit"] for x in made), sum(x["m_finish_kg"] * x["qty_unit"] for x in made),
            sum((x["m_blank_kg"] - x["m_finish_kg"]) * x["qty_unit"] for x in made)))
    write_csv(os.path.join(out, "routing_all.csv"), allr)
    allm, keys = minutes_table(data)
    mrows = [dict([("machine", k)] + [(v, round(allm[v].get(k, 0.0), 3)) for v in allm]) for k in keys]
    write_csv(os.path.join(out, "machine_minutes.csv"), mrows)
    rep.append("## Machine minutes per product unit (input of item F2)\n")
    rep.append("| Machine | " + " | ".join(allm) + " |")
    rep.append("|---|" + "---|" * len(allm))
    for k in keys:
        rep.append("| %s | " % k + " | ".join("%.2f" % allm[v].get(k, 0.0) for v in allm) + " |")
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(rep) + "\n")
    print("written to", out, ":", ", ".join(sorted(os.listdir(out))))
    return 0


# ----------------------------------------------------------------------------- self-test
def selftest(data):
    ok = []

    def check(name, cond):
        ok.append(bool(cond))
        print("  [%s] %s" % ("PASS" if cond else "FAIL", name))

    cut, tools, m = data["cutting"], data["tools"], data["machines"]
    # 1 face milling by hand: FM100 z7 CI vc240 fz0.18 -> n=763.9, vf=962.5; W180 -> rows ceil(180/70)=3; stock3/ap2.5 -> 2
    r = feature_time({"t": "face", "tool": "FM100", "W": 180, "L": 220, "stock": 3}, cut, "CI", m["HMC"], tools, {})
    n = 1000 * 240 / (PI * 100); vf = 0.18 * 7 * n; hand = 3 * 2 * (220 + 100) / vf * 60
    check("face milling = rows*layers*(L+Dc)/vf (%.2f s)" % hand, abs(r["cut_s"] - hand) < 1e-9)
    # 2 drilling: D11 H20 CI -> n = 2893.8, t = 4*(20+3.3)/(0.25*n)
    r = feature_time({"t": "drill", "D": 11, "H": 20, "n": 4}, cut, "CI", m["HMC"], tools, {})
    n = 1000 * 100 / (PI * 11); hand = 4 * (20 + 3.3) / (0.25 * n) * 60
    check("drilling = n*(H+0.3D)/(f n) (%.2f s)" % hand, abs(r["cut_s"] - hand) < 1e-9 and r["holes"] == 4)
    # 3 tapping M8: n = 1000*15/(pi*8) = 596.8; t = 2*(16+2.5)/(1.25 n)
    r = feature_time({"t": "tap", "D": 8, "P": 1.25, "H": 16}, cut, "CI", m["HMC"], tools, {})
    n = 1000 * 15 / (PI * 8); hand = 2 * (16 + 2.5) / (1.25 * n) * 60
    check("tapping = 2(H+2P)/(P n) (%.2f s)" % hand, abs(r["cut_s"] - hand) < 1e-9)
    # 4 speed cap: tiny drill D4.2 in AL would exceed n_max 12000 on VMC -> capped
    r = feature_time({"t": "drill", "D": 4.2, "H": 8}, cut, "AL", m["VMC"], tools, {})
    hand = (8 + 0.3 * 4.2) / (0.25 * 12000) * 60
    check("spindle speed capped at n_max", abs(r["cut_s"] - hand) < 1e-9)
    # 5 expressions
    check("expression 'L+20' with L=150 -> 170", val("L+20", {"L": 150}) == 170.0)
    try:
        val("__import__('os')", {"L": 1}); bad = False
    except InputError:
        bad = True
    check("unsafe expression refused", bad)
    # 6 grind + hone
    r = feature_time({"t": "grind", "D": 30, "stock": 0.4, "n": 3}, cut, "ST", m["GRIND"], tools, {})
    check("grind = n*(stock/vr*60 + spark) (%.1f s)" % r["cut_s"], abs(r["cut_s"] - 3 * (0.4 / 1.2 * 60 + 8)) < 1e-9)
    r = feature_time({"t": "hone", "D": 70, "stock": 0.075}, cut, "CI", m["HONE"], tools, {})
    check("hone = stock/rate + t_fix (%.1f s)" % r["cut_s"], abs(r["cut_s"] - (0.075 / 0.0015 + 15)) < 1e-9)
    # 7 batch op
    part = data["products"]["VC20"]["parts"][0]
    r = op_time({"op": "X", "machine": "WASH", "fixed_s": 90, "batch": 2}, part, data, {})
    check("batch op = fixed/batch", r["total_s"] == 45)
    # 8 compressor displacement 30.80 m3/h (crank guide ch.12)
    c = compressor_perf(data["products"]["VC20"]["spec"])
    check("VC20 displacement 30.80 m3/h (%.2f)" % c["displacement_m3_h"], abs(c["displacement_m3_h"] - 30.80) < 0.01)
    check("VC20 motor 3 kW sufficient (%.0f W input)" % c["motor_input_W"], c["motor_input_W"] <= 3000)
    ch = tdc_chain(data["products"]["VC20"]["spec"])
    check("TDC gap = target 0.6 mm (%.2f)" % ch["gap"], abs(ch["gap"] - 0.6) < 0.01)
    check("no web clash: skirt %.1f / spigot %.1f mm clearance >= 2" % (ch["clear_skirt_web"], ch["clear_spigot_web"]),
          ch["clear_skirt_web"] >= 2 and ch["clear_spigot_web"] >= 2)
    # 9 Roots: RB100 flow ~ 100 m3/h class and motor 2.2 kW
    rs = data["products"]["RB"]["spec"]
    r100 = roots_perf(rs, 150)
    check("RB100 delivered flow in 95..115 m3/h (%.1f)" % r100["Q_m3_h"], 95 <= r100["Q_m3_h"] <= 115)
    need = r100["P_shaft_W"] / rs["eta_belt"] * rs["motor_margin"]
    check("RB100 motor = smallest standard size >= need (%.0f W -> %.1f kW)" % (need, r100["motor_kW"]),
          r100["motor_kW"] * 1000 >= need and MOTORS[MOTORS.index(r100["motor_kW"]) - 1] * 1000 < need)
    check("Roots flow scales with L (RB150/RB50 = 3)", abs(roots_perf(rs, 225)["Q_m3_h"] / roots_perf(rs, 75)["Q_m3_h"] - 3) < 1e-9)
    check("Roots tip speed < 25 m/s (%.1f)" % r100["tip_speed_m_s"], r100["tip_speed_m_s"] < 25)
    # 10 data integrity
    good = True
    for pk, p in data["products"].items():
        nodes = {pk} | {s[1] for s in p["structure"]}
        for part in p["parts"]:
            good &= part["parent"] in nodes and part["make"] == "M"
            for op in part["ops"]:
                good &= op["machine"] in m and all(a in m for a in op.get("alt", []))
        for b in p["bought"]:
            good &= b[0] in nodes
        for a in p["assembly"]:
            good &= a[1] in m
    check("every parent, machine and alternative exists", good)
    pv = data["products"]["VC20"]
    check("multi-level quantity: cylinder per VC20 = 2 (bank U12 x2)", unit_qty(pv, "VC20", "U12", 1) == 2)
    rv = routing_rows(data, "VC20", "VC20", {})
    check("routing uses quantity per unit (C04 qty 2, C08 qty 2)",
          all(r["qty"] == 2 for r in rv if r["part"] in ("C04", "C08")))
    ids = [part["id"] for p in data["products"].values() for part in p["parts"]]
    check("part ids unique", len(ids) == len(set(ids)))
    # 11 all parts compute, positive, finished < blank, plausible ranges
    fine = True
    rng = []
    for pk, vk, params in variants(data):
        for part in data["products"][pk]["parts"]:
            fine &= 0 < val(part["m_finish"], params) < val(part["m_blank"], params)
            for op in part["ops"]:
                r = op_time(op, part, data, params)
                fine &= r["total_s"] > 0
                if op["machine"] in ("HMC", "VMC", "TMILL", "RMILL", "LATHE"):
                    rng.append(r["total_s"])
                    fine &= r["pc_max"] < 15.0     # fits a 15-18 kW spindle
    check("all ops > 0 s, finish mass < blank, Pc < 15 kW", fine)
    check("machining op times in 20 s .. 40 min (%.0f..%.0f s)" % (min(rng), max(rng)), 20 <= min(rng) and max(rng) <= 2400)
    # 12 monotonic in L for Roots housing
    p = data["products"]["RB"]
    h = p["parts"][0]
    t50 = sum(op_time(o, h, data, {"L": 75})["total_s"] for o in h["ops"])
    t150 = sum(op_time(o, h, data, {"L": 225})["total_s"] for o in h["ops"])
    check("housing time grows with rotor length (%.0f -> %.0f s)" % (t50, t150), t150 > t50)
    # 13 machine minutes: VC20 HMC within +-40 % of existing twin value (doc 62 crankcase 36 min is a teaching value;
    #     config/factory.json HMC 2485 s total work content -> just plausibility 10..60 min)
    mmv = machine_minutes(data, "VC20", "VC20", {})
    check("VC20 HMC minutes plausible 5..60 (%.1f)" % mmv["HMC"], 5 <= mmv["HMC"] <= 60)
    print("SELFTEST %s (%d/%d)" % ("PASS" if all(ok) else "FAIL", sum(ok), len(ok)))
    return 0 if all(ok) else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=DATA)
    sp = ap.add_subparsers(dest="cmd")
    sp.add_parser("selftest")
    r = sp.add_parser("run"); r.add_argument("--out", default=os.path.join(HERE, "out"))
    q = sp.add_parser("part"); q.add_argument("pid"); q.add_argument("--variant", default=None)
    sp.add_parser("perf")
    sp.add_parser("minutes")
    a = ap.parse_args(argv)
    data = load(a.data)
    try:
        if a.cmd == "selftest":
            return selftest(data)
        if a.cmd == "run":
            return cmd_run(data, a.out)
        if a.cmd == "part":
            return cmd_part(data, a.pid, a.variant)
        if a.cmd == "perf":
            cmd_perf(data); return 0
        if a.cmd == "minutes":
            cmd_minutes(data); return 0
        ap.print_help(); return 0
    except InputError as e:
        print("input error:", e, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
