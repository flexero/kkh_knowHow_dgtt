#!/usr/bin/env python3
"""M11 weld program - welded joints and frames: fillet and butt welds in the style of EN 1993-1-8 (directional and
simplified method, throat thickness rules), weld groups by the line method (any set of straight weld lines under
N, Vx, Vy, Mx, My, T), welded member (rectangular hollow section) static check, and fatigue in the style of
EN 1993-1-9 / IIW (detail categories FAT, S-N curves with slopes 3 / 5 and cut-off, Palmgren-Miner damage for load
blocks, thickness effect, partial factors).
Default case: the motor bracket post of the M2/M9 compressor - RHS 80x80x5 welded all round to the base frame,
loaded by the motor weight and the belt pull (M9), fatigue from motor starts and from the torque ripple at 24 Hz.
Pressure parts (air receiver) are in vessel.py. Guide: 11_welds_frames_vessels.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python weld.py params | run [--in p.json] [--out folder] | examples | selftest
  python weld.py ch24 | ch78                 extra results of guide chapters 2-4 and 7-8 (5-6: python vessel.py ch56)
  python weld.py run --in examples/weld_example.json --out example   worked design example (chapter 8)

Material strengths, correlation factors, detail categories and partial factors are TYPICAL VALUES in the style of
EN 1993-1-1 / -1-8 / -1-9 and the IIW recommendations - check the standards before a design is released. All default
numbers are EXAMPLES.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # sibling tools (vessel.py)

# ---------------------------------------------------------------- data (check)
STEELS = {   # fy, fu (t <= 40 mm, EN 1993-1-1 table 3.1 style), beta_w (EN 1993-1-8 table 4.1)
    "S235": {"fy": 235.0, "fu": 360.0, "beta_w": 0.80},
    "S275": {"fy": 275.0, "fu": 430.0, "beta_w": 0.85},
    "S355": {"fy": 355.0, "fu": 510.0, "beta_w": 0.90},
    "S460": {"fy": 460.0, "fu": 540.0, "beta_w": 1.00},
}
GAMMA_M0, GAMMA_M2 = 1.0, 1.25
# fatigue detail categories (EN 1993-1-9 / IIW style): delta_sigma_C (or delta_tau_C) at 2e6 cycles, slope, kind
FAT = {
    "rolled plate, machined edges":                         (160, 3, "normal"),
    "butt weld, ground flush, 100 % NDT":                   (112, 3, "normal"),
    "butt weld, as welded, both sides":                     (90, 3, "normal"),
    "transverse non-load-carrying fillet attachment":       (80, 3, "normal"),
    "load-carrying cruciform, full penetration":            (71, 3, "normal"),
    "RHS welded to plate, fillet, t <= 8 (toe)":            (40, 3, "normal"),
    "fillet weld throat, load-carrying (root)":             (36, 3, "normal"),
    "fillet weld throat, shear":                            (80, 5, "shear"),
}

DEFAULT = {
    "name": "Motor bracket post of the M2/M9 compressor: RHS 80x80x5 welded all round (example)",
    "steel": "S355",
    "a": 3.0,                          # fillet weld throat thickness mm
    "t_max": 10.0, "t_min": 5.0,       # thicker part (base plate) / thinner part (tube wall) mm
    # weld lines [x1, y1, x2, y2] mm in the plane of the joint (here: tube outline welded all round)
    "lines": [[0, 0, 80, 0], [80, 0, 80, 80], [80, 80, 0, 80], [0, 80, 0, 0]],
    # design loads at the weld-group centroid (ULS, already factored): N along z (+ tension), Vx, Vy in plane,
    # Mx, My bending about the in-plane axes, T torsion about z (N, N m)
    "loads": {"N": -612.0, "Vx": 681.0, "Vy": 0.0, "Mx": 0.0, "My": 170.3, "T": 40.9},
    "gamma_F": 1.5,                    # load factor already contained in "loads" (documentation)
    "member": {"b": 80.0, "h": 80.0, "t": 5.0, "L": 250.0},     # RHS of the post (bending at the weld)
    # fatigue load blocks: unfactored ranges at the centroid and number of cycles in the design life
    "fatigue_blocks": [
        {"name": "motor starts (effective pull 2.5 T_N, 6 / h, 4000 h/y, 20 y)", "dVx": 326.0, "dMy": 81.5, "n": 480000},
        {"name": "torque ripple order 1 (24.1 Hz, 20 % of the pull swing, check)", "dVx": 40.0, "dMy": 10.0, "n": 6.9e9}],
    "fat_toe": "RHS welded to plate, fillet, t <= 8 (toe)",
    "fat_throat": "fillet weld throat, load-carrying (root)",
    "fat_shear": "fillet weld throat, shear",
    "gamma_Mf": 1.15, "gamma_Ff": 1.0,
    "n_points": 11,                    # check points per weld line
}

# ---------------------------------------------------------------- chapter 3: weld group, line method
def group_props(lines):
    """Line method (unit throat): length A_l, centroid, I_x = sum int y^2 dl, I_y = sum int x^2 dl about the centroid,
    I_p = I_x + I_y (mm, mm^3)."""
    L = [math.hypot(x2 - x1, y2 - y1) for x1, y1, x2, y2 in lines]
    A = sum(L)
    xc = sum(l * (x1 + x2) / 2 for l, (x1, y1, x2, y2) in zip(L, lines)) / A
    yc = sum(l * (y1 + y2) / 2 for l, (x1, y1, x2, y2) in zip(L, lines)) / A
    Ix = Iy = Ixy = 0.0
    for l, (x1, y1, x2, y2) in zip(L, lines):
        a1, b1, a2, b2 = x1 - xc, y1 - yc, x2 - xc, y2 - yc
        Iy += l * (a1 * a1 + a1 * a2 + a2 * a2) / 3                 # exact integral of a straight line
        Ix += l * (b1 * b1 + b1 * b2 + b2 * b2) / 3
        Ixy += l * (2 * a1 * b1 + a1 * b2 + a2 * b1 + 2 * a2 * b2) / 6
    return {"A_l": A, "xc": xc, "yc": yc, "Ix": Ix, "Iy": Iy, "Ixy": Ixy, "Ip": Ix + Iy, "lengths": L}

def line_forces(lines, loads, n_pts=11):
    """Force per unit weld length (N/mm) at check points: normal to the plane f_n (N, Mx, My), in-plane shear
    f_x, f_y (Vx, Vy, T), split into the component across the weld line f_t and along it f_l.
    Assumes principal axes (I_xy = 0) - true for symmetric groups."""
    G = group_props(lines)
    N, Vx, Vy = loads["N"], loads["Vx"], loads["Vy"]
    Mx, My, T = loads["Mx"] * 1000, loads["My"] * 1000, loads["T"] * 1000
    pts = []
    for k, (x1, y1, x2, y2) in enumerate(lines):
        L = G["lengths"][k]
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        for i in range(n_pts):
            s = i / (n_pts - 1)
            x, y = x1 + s * (x2 - x1) - G["xc"], y1 + s * (y2 - y1) - G["yc"]
            fn = N / G["A_l"] + (Mx * y / G["Ix"] if G["Ix"] else 0) - (My * x / G["Iy"] if G["Iy"] else 0)
            fx = Vx / G["A_l"] - T * y / G["Ip"]
            fy = Vy / G["A_l"] + T * x / G["Ip"]
            fl = fx * ux + fy * uy
            ft = -fx * uy + fy * ux
            pts.append({"line": k, "x": x + G["xc"], "y": y + G["yc"], "fn": fn, "ft": ft, "fl": fl,
                        "f_perp": math.hypot(fn, ft), "f_res": math.sqrt(fn * fn + ft * ft + fl * fl)})
    return G, pts

def fillet_check(P):
    """EN 1993-1-8 4.5.3: directional method sqrt(s_perp^2 + 3 (t_perp^2 + t_par^2)) <= fu / (beta_w gM2) and
    s_perp <= 0.9 fu / gM2, with s_perp = t_perp = f_perp / (a sqrt 2), t_par = f_l / a (fillet at 45 deg);
    simplified method f_res / a <= fvw,d = fu / (sqrt 3 beta_w gM2)."""
    st = STEELS[P["steel"]]
    a = P["a"]
    G, pts = line_forces(P["lines"], P["loads"], P["n_points"])
    lim1 = st["fu"] / (st["beta_w"] * GAMMA_M2)
    lim2 = 0.9 * st["fu"] / GAMMA_M2
    fvw = st["fu"] / (math.sqrt(3) * st["beta_w"] * GAMMA_M2)
    worst = None
    for p in pts:
        sp = tp = p["f_perp"] / (a * math.sqrt(2))
        tl = p["fl"] / a
        eq = math.sqrt(sp * sp + 3 * (tp * tp + tl * tl))
        u = max(eq / lim1, abs(sp) / lim2)
        us = p["f_res"] / a / fvw
        p.update(sigma_perp=sp, tau_par=tl, sigma_eq=eq, util_dir=u, util_simple=us)
        if worst is None or u > worst["util_dir"]:
            worst = p
    rules = throat_rules(P)
    return {"G": G, "points": pts, "worst": worst, "lim_dir": lim1, "lim_perp": lim2, "fvw_d": fvw,
            "util_dir": worst["util_dir"], "util_simple": max(p["util_simple"] for p in pts), "rules": rules}

def throat_rules(P):
    """Practical limits (check national rules): a >= 3 mm, a >= sqrt(t_max) - 0.5, a <= 0.7 t_min, length >= max(30, 6a)."""
    a, tmax, tmin = P["a"], P["t_max"], P["t_min"]
    a_min = max(3.0, math.sqrt(tmax) - 0.5)
    a_max = 0.7 * tmin
    Lmin = max(30.0, 6 * a)
    L = group_props(P["lines"])["lengths"]
    return {"a_min": a_min, "a_max": a_max, "L_min": Lmin, "ok_min": a >= a_min - 1e-9, "ok_max": a <= a_max + 1e-9,
            "ok_len": min(L) >= Lmin}

# ---------------------------------------------------------------- chapter 3: welded member (RHS)
def rhs(b, h, t):
    """Rectangular hollow section (sharp corners, check the rolled section table): A, I_x, I_y, W_x, W_y, I_t (Bredt)."""
    A = b * h - (b - 2 * t) * (h - 2 * t)
    Ix = (b * h ** 3 - (b - 2 * t) * (h - 2 * t) ** 3) / 12
    Iy = (h * b ** 3 - (h - 2 * t) * (b - 2 * t) ** 3) / 12
    Am = (b - t) * (h - t)
    It = 4 * Am ** 2 * t / (2 * ((b - t) + (h - t)) / 1)
    return {"A": A, "Ix": Ix, "Iy": Iy, "Wx": 2 * Ix / h, "Wy": 2 * Iy / b, "It": It, "Wt": 2 * Am * t}

def member_check(P):
    m, L = P["member"], P["loads"]
    S = rhs(m["b"], m["h"], m["t"])
    st = STEELS[P["steel"]]
    sig = abs(L["N"]) / S["A"] + abs(L["Mx"]) * 1000 / S["Wx"] + abs(L["My"]) * 1000 / S["Wy"]
    tau = abs(L["T"]) * 1000 / S["Wt"] + math.hypot(L["Vx"], L["Vy"]) / (S["A"] / 2)
    eq = math.sqrt(sig ** 2 + 3 * tau ** 2)
    return {"sec": S, "sigma": sig, "tau": tau, "sigma_eq": eq, "util": eq / (st["fy"] / GAMMA_M0)}

# ---------------------------------------------------------------- chapter 4: fatigue (EN 1993-1-9 style)
def sn_cycles(d_range, fat, m=3, kind="normal"):
    """Cycles to failure. Normal stress: slope 3 to N_D = 5e6 (d_D = 0.737 d_C), slope 5 to N_L = 1e8 (cut-off
    d_L = 0.549 d_D); shear: slope 5 to N_L = 1e8 (d_L = 0.457 d_C). Below the cut-off: infinite (no damage)."""
    if d_range <= 0:
        return float("inf")
    if kind == "shear":
        dL = fat * (2e6 / 1e8) ** (1 / 5)
        return float("inf") if d_range <= dL else 2e6 * (fat / d_range) ** 5
    dD = fat * (2 / 5) ** (1 / 3)
    dL = dD * (5e6 / 1e8) ** (1 / 5)
    if d_range >= dD:
        return 2e6 * (fat / d_range) ** 3
    if d_range > dL:
        return 5e6 * (dD / d_range) ** 5
    return float("inf")

def thickness_factor(t, t_ref=25.0, n=0.2):
    """Thickness effect k_s = (t_ref / t)^n for t > 25 mm (IIW / EN 1993-1-9 style, check the exponent per detail)."""
    return 1.0 if t <= t_ref else (t_ref / t) ** n

def fatigue(P):
    """Stress ranges per block from the load ranges (weld throat: normal range sigma_w = f_perp / a (across the weld:
    normal to the plate and in-plane transverse), shear range tau_w = f_l / a (along the weld); toe: member bending), damage D = sum n / N(gamma_Ff gamma_Mf range) for each detail."""
    a = P["a"]
    m = rhs(P["member"]["b"], P["member"]["h"], P["member"]["t"])
    res = []
    D = {"toe": 0.0, "throat": 0.0, "shear": 0.0}
    for b in P["fatigue_blocks"]:
        loads = {"N": 0.0, "Vx": b.get("dVx", 0.0), "Vy": b.get("dVy", 0.0), "Mx": b.get("dMx", 0.0), "My": b.get("dMy", 0.0), "T": b.get("dT", 0.0)}
        G, pts = line_forces(P["lines"], loads, P["n_points"])
        ds_w = max(p["f_perp"] for p in pts) / a          # EN 1993-1-9 table 8.5 (8): sqrt(ds_perp^2 + dt_perp^2) = f_perp / a
        dt_w = max(abs(p["fl"]) for p in pts) / a          # shear along the weld: dt_par = f_l / a
        ds_toe = abs(loads["Mx"]) * 1000 / m["Wx"] + abs(loads["My"]) * 1000 / m["Wy"]
        g = P["gamma_Ff"] * P["gamma_Mf"]
        row = {"name": b["name"], "n": b["n"], "ds_toe": ds_toe, "ds_w": ds_w, "dt_w": dt_w}
        for key, rng, fat_name in (("toe", ds_toe, P["fat_toe"]), ("throat", ds_w, P["fat_throat"]), ("shear", dt_w, P["fat_shear"])):
            fat, mm, kind = FAT[fat_name]
            N = sn_cycles(g * rng, fat, mm, kind)
            row["N_" + key] = N
            row["D_" + key] = b["n"] / N
            D[key] += b["n"] / N
        res.append(row)
    return {"blocks": res, "D": D, "ok": all(v <= 1.0 for v in D.values())}

# ---------------------------------------------------------------- summary / report / run
def summary(P):
    return {"fillet": fillet_check(P), "member": member_check(P), "fatigue": fatigue(P)}

def report_text(P):
    S = summary(P)
    F, M, Fa = S["fillet"], S["member"], S["fatigue"]
    G, w, r = F["G"], F["worst"], F["rules"]
    st = STEELS[P["steel"]]
    yn = lambda b: "OK" if b else "NOT OK"
    L = ["# Weld report (EN 1993-1-8 / -1-9 style) - %s\n" % P["name"],
         "%s (fy %.0f, fu %.0f MPa, beta_w %.2f), fillet throat a %.1f mm, %d weld lines, design loads N %.0f N, Vx %.0f N, Vy %.0f N, Mx %.1f, My %.1f, T %.1f N m" % (
             P["steel"], st["fy"], st["fu"], st["beta_w"], P["a"], len(P["lines"]), P["loads"]["N"], P["loads"]["Vx"], P["loads"]["Vy"], P["loads"]["Mx"], P["loads"]["My"], P["loads"]["T"]),
         "\n## Weld group (line method, unit throat)",
         "- length %.0f mm, centroid (%.1f, %.1f), I_x %.0f mm3, I_y %.0f mm3, I_p %.0f mm3" % (G["A_l"], G["xc"], G["yc"], G["Ix"], G["Iy"], G["Ip"]),
         "- worst point line %d at (%.1f, %.1f): f_n %.1f, f_t %.1f, f_l %.1f N/mm -> sigma_perp = tau_perp %.1f, tau_par %.1f, equivalent %.1f MPa" % (
             w["line"], w["x"], w["y"], w["fn"], w["ft"], w["fl"], w["sigma_perp"], w["tau_par"], w["sigma_eq"]),
         "- directional method: limit %.0f MPa (perp. %.0f) -> utilisation %.3f; simplified method f_vw,d %.0f MPa -> utilisation %.3f" % (
             F["lim_dir"], F["lim_perp"], F["util_dir"], F["fvw_d"], F["util_simple"]),
         "- throat rules: a_min %.2f (%s), a_max 0.7 t_min %.2f (%s), weld length >= %.0f mm (%s)" % (
             r["a_min"], yn(r["ok_min"]), r["a_max"], yn(r["ok_max"]), r["L_min"], yn(r["ok_len"])),
         "\n## Member RHS %gx%gx%g at the weld" % (P["member"]["b"], P["member"]["h"], P["member"]["t"]),
         "- A %.0f mm2, W_x %.0f mm3, W_t %.0f mm3; sigma %.1f, tau %.1f, equivalent %.1f MPa -> utilisation %.3f" % (
             M["sec"]["A"], M["sec"]["Wx"], M["sec"]["Wt"], M["sigma"], M["tau"], M["sigma_eq"], M["util"]),
         "\n## Fatigue (gamma_Ff %.2f, gamma_Mf %.2f; toe %s, throat %s, shear %s)" % (P["gamma_Ff"], P["gamma_Mf"], P["fat_toe"], P["fat_throat"], P["fat_shear"])]
    for b in Fa["blocks"]:
        nf = lambda N: "inf" if N == float("inf") else "%.3g" % N
        L.append("- %s: n %.3g; ranges toe %.2f, throat %.2f, shear %.2f MPa -> N %s / %s / %s" % (
            b["name"], b["n"], b["ds_toe"], b["ds_w"], b["dt_w"], nf(b["N_toe"]), nf(b["N_throat"]), nf(b["N_shear"])))
    L.append("- damage sum: toe %.3g, throat %.3g, shear %.3g -> %s" % (Fa["D"]["toe"], Fa["D"]["throat"], Fa["D"]["shear"], yn(Fa["ok"])))
    return "\n".join(L)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    F = fillet_check(P)
    with open(os.path.join(out, "weld_points.csv"), "w", encoding="utf-8") as f:
        f.write("line,x mm,y mm,f_n N/mm,f_t N/mm,f_l N/mm,sigma_eq MPa,utilisation\n")
        for p in F["points"]:
            f.write("%d,%.2f,%.2f,%.3f,%.3f,%.3f,%.3f,%.4f\n" % (p["line"], p["x"], p["y"], p["fn"], p["ft"], p["fl"], p["sigma_eq"], p["util_dir"]))
    print(rep)
    print("written: report.md, weld_points.csv ->", out)



# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2: joints, welds, symbols
WA_JOINTS = [   # joint, parts, typical welds, note
    ("butt joint", "two plates in one plane", "square / V / X / U butt weld", "best fatigue (FAT 90-112); needs edge preparation"),
    ("T-joint", "one plate on the face of another", "fillet (one / both sides), HV / K butt", "the most common joint in frames and brackets"),
    ("corner joint", "two plate edges at an angle", "fillet outside / inside, V butt", "boxes, tanks; check lamellar tearing of the through plate"),
    ("lap joint", "plates overlapping", "fillet along edges, plug / slot welds", "simple fit-up; eccentric load path, crevice corrosion"),
    ("edge (flange) joint", "plate edges side by side", "edge weld", "thin sheet only, no structural load"),
]
WA_WELDS = [   # weld, preparation, penetration, typical use
    ("fillet weld", "none", "partial - to the root only", "T and lap joints; throat a in the design, leg z on the shop floor"),
    ("deep-penetration fillet", "none (MAG spray / SAW)", "beyond the root, credited only with a procedure test", "series production with qualified penetration"),
    ("square butt (I)", "gap 0...3 mm", "full for t <= 4...8 mm (one / both sides)", "thin plates"),
    ("single-V butt", "60 deg included angle, root face", "full with root pass / backing", "plates 4...20 mm"),
    ("double-V (X) butt", "two 60 deg bevels", "full, welded from both sides, half the volume", "plates > 15 mm, less distortion"),
    ("single-U / double-U", "J-shaped bevel radius", "full, smallest weld volume", "thick plates > 25 mm, pressure vessels"),
    ("single-bevel (HV) / K butt", "one plate bevelled 45...50 deg", "full (or partial with a_nom)", "load-carrying T-joints (cruciform)"),
    ("partial-penetration butt", "V or HV to a depth", "throat = prepared depth (minus 2 mm if angle < 60 deg, check)", "where full penetration is not needed"),
    ("plug / slot weld", "hole / slot in the upper plate", "fills the hole", "lap joints, against buckling of cover plates"),
    ("stud weld", "arc stud welding gun", "full cross-section of the stud", "fastening studs, shear connectors"),
]
WA_SYMBOL = [   # element of the ISO 2553 symbol, meaning
    ("arrow line + reference line", "points to the joint; the solid reference line is the arrow side (system A)"),
    ("dashed identification line", "symbol on the dashed line = weld on the OTHER side (ISO 2553 system A)"),
    ("elementary symbol", "triangle = fillet, V = single-V butt, || = square butt, Y = V with root face, K-shape = K butt"),
    ("size left of the symbol", "a5 = throat 5 mm; z7 = leg 7 mm; s8 = penetration 8 mm for butt welds"),
    ("length right of the symbol", "n x l (e) = number of segments x length (gap) for intermittent welds; nothing = full length"),
    ("supplementary symbols", "circle at the knee = weld all round; flag = site weld; flat / convex / concave contour; ground flush"),
    ("tail", "process number (ISO 4063, 135 = MAG, 141 = TIG), quality level (ISO 5817 B / C / D), WPS reference"),
]

def wa_leg_throat(z=None, a=None):
    """Equal-leg fillet at 45 deg: a = z / sqrt 2 = 0.707 z (throat = height of the inscribed isosceles triangle)."""
    if z is not None:
        return {"z": z, "a": z / math.sqrt(2)}
    return {"a": a, "z": a * math.sqrt(2)}

def wa_components(f_perp, f_par, a):
    """Force per unit length f_perp across the weld (normal to the attached plate) and f_par along it.
    The throat plane is at 45 deg: normal stress sigma_perp = f_perp cos45 / a, shear tau_perp = f_perp sin45 / a,
    tau_par = f_par / a. EN 1993-1-8: sigma_eq = sqrt(sigma_perp^2 + 3 (tau_perp^2 + tau_par^2))."""
    sp = f_perp * math.cos(math.pi / 4) / a
    tp = f_perp * math.sin(math.pi / 4) / a
    tl = f_par / a
    return {"sigma_perp": sp, "tau_perp": tp, "tau_par": tl, "sigma_eq": math.sqrt(sp * sp + 3 * (tp * tp + tl * tl))}

def wa_unit_capacity(steel, a, angles=(0, 30, 45, 60, 90)):
    """Design capacity per mm of weld for an in-plane load at angle theta to the weld axis (0 = along, 90 = across):
    directional F = (fu / (beta_w gM2)) a / sqrt(3 cos^2 + 2 sin^2), also sigma_perp <= 0.9 fu / gM2;
    simplified F = fu / (sqrt 3 beta_w gM2) a for every direction."""
    st = STEELS[steel]
    lim = st["fu"] / (st["beta_w"] * GAMMA_M2)
    lim2 = 0.9 * st["fu"] / GAMMA_M2
    fvw = lim / math.sqrt(3)
    rows = []
    for th in angles:
        c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
        F = lim * a / math.sqrt(3 * c * c + 2 * s * s)
        F = min(F, lim2 * a * math.sqrt(2) / s) if s > 1e-12 else F
        rows.append((th, F, fvw * a))
    return {"lim": lim, "lim_perp": lim2, "fvw": fvw, "rows": rows}

def wa_full_strength(steel):
    """Double fillet T-joint loaded across: weld capacity 2 a lim / sqrt 2 = plate capacity t fy / gM0
    -> a / t = fy sqrt 2 / (2 lim gM0) (full-strength fillet)."""
    st = STEELS[steel]
    lim = st["fu"] / (st["beta_w"] * GAMMA_M2)
    return st["fy"] / GAMMA_M0 * math.sqrt(2) / (2 * lim)

def wa_butt(steel, t, a_nom=None, angle_deg=60):
    """Full-penetration butt: same design resistance as the weaker base plate (matching filler). Partial penetration:
    designed like a deep-penetration fillet with a = prepared depth (minus 2 mm when the groove angle < 60 deg, check)."""
    st = STEELS[steel]
    full = t * st["fy"] / GAMMA_M0
    if a_nom is None:
        return {"full_N_per_mm": full}
    a = a_nom - (2.0 if angle_deg < 60 else 0.0)
    lim = st["fu"] / (st["beta_w"] * GAMMA_M2)
    return {"full_N_per_mm": full, "a_eff": a, "partial_N_per_mm": 2 * a * lim / math.sqrt(2), "ratio": 2 * a * lim / math.sqrt(2) / full}

def wa_throat_conflict(t_tube_list=(3.0, 4.0, 5.0, 6.0), t_plate=10.0):
    """The practical rules a >= max(3, sqrt(t_max) - 0.5) and a <= 0.7 t_min cannot both hold for thin tube walls."""
    rows = []
    for t in t_tube_list:
        P = dict(DEFAULT, t_max=t_plate, t_min=t, a=3.0)
        r = throat_rules(P)
        rows.append((t, r["a_min"], r["a_max"], r["a_min"] <= r["a_max"]))
    return rows

def wa_long_joint(Lj, a):
    """EN 1993-1-8 4.11: lap joints longer than 150 a: beta_Lw,1 = 1.2 - 0.2 Lj / (150 a), 0.6 <= beta <= 1.0."""
    return max(0.6, min(1.0, 1.2 - 0.2 * Lj / (150 * a)))

# ---------------------------------------------------------------- chapter 3: weld groups, bracket, frames
def wa_catalog(b=80.0, d=120.0):
    """Line-method properties of common weld shapes (b width in x, d height in y), computed by group_props and compared
    with textbook formulas where they exist."""
    shapes = {
        "single vertical line": ([[0, 0, 0, d]], {"Ix": d ** 3 / 12}),
        "two vertical lines": ([[0, 0, 0, d], [b, 0, b, d]], {"Ix": d ** 3 / 6, "Iy": b * b * d / 2}),
        "two horizontal lines": ([[0, 0, b, 0], [0, d, b, d]], {"Ix": b * d * d / 2, "Iy": b ** 3 / 6}),
        "box (all round)": ([[0, 0, b, 0], [b, 0, b, d], [b, d, 0, d], [0, d, 0, 0]], {"Ix": b * d * d / 2 + d ** 3 / 6, "Iy": d * b * b / 2 + b ** 3 / 6}),
        "C (open right)": ([[b, 0, 0, 0], [0, 0, 0, d], [0, d, b, d]], {"Ix": b * d * d / 2 + d ** 3 / 12}),
        "L (bottom + left)": ([[b, 0, 0, 0], [0, 0, 0, d]], {}),
    }
    out = []
    for name, (lines, ref) in shapes.items():
        G = group_props(lines)
        out.append((name, G, ref))
    return out

WA_BRACKET = {"P": 12000.0, "e": 200.0, "b": 80.0, "d": 150.0, "a": 5.0, "steel": "S355"}

def wa_bracket(B=None):
    """Classic eccentric shear: plate bracket welded to a column flange with a C-shaped fillet weld (two horizontal
    lines b, one vertical d at the column face); vertical load P at distance e from the weld centroid -> V = P, T = P e."""
    B = dict(WA_BRACKET if B is None else B)
    b, d = B["b"], B["d"]
    lines = [[b, 0, 0, 0], [0, 0, 0, d], [0, d, b, d]]
    G = group_props(lines)
    T = -B["P"] * (B["e"] + (b - G["xc"])) / 1000          # load acts e beyond the free ends of the horizontal welds
    P = dict(DEFAULT, lines=lines, a=B["a"], steel=B["steel"], t_min=10.0, t_max=20.0,
             loads={"N": 0.0, "Vx": 0.0, "Vy": -B["P"], "Mx": 0.0, "My": 0.0, "T": T})
    F = fillet_check(P)
    return {"G": G, "T_Nm": T, "F": F, "lever": B["e"] + (b - G["xc"])}

def wa_area_method(B=None):
    """Elastic area method: the welds are thin rectangles of thickness a (throat turned into the plane); polar moment
    includes their own thickness. Compare with the line method (a -> 0)."""
    B = dict(WA_BRACKET if B is None else B)
    b, d, a = B["b"], B["d"], B["a"]
    G = group_props([[b, 0, 0, 0], [0, 0, 0, d], [0, d, b, d]])
    xc, yc = G["xc"], G["yc"]
    rects = [(b / 2, 0.0, b, a), (0.0, d / 2, a, d), (b / 2, d, b, a)]   # centre x, y, width, height
    A = sum(w * h for _, _, w, h in rects)
    Ip = sum(w * h * ((cx - xc) ** 2 + (cy - yc) ** 2) + w * h * (w * w + h * h) / 12 for cx, cy, w, h in rects)
    T = B["P"] * (B["e"] + (b - xc))
    r = math.hypot(b - xc, d - yc)                          # farthest corner (free end of a horizontal weld)
    rx, ry = b - xc, d - yc
    tx, ty = -T * ry / Ip, T * rx / Ip - B["P"] / A          # torsion + direct shear (load downwards)
    tau_area = math.hypot(tx, ty)
    # line method at the same corner, stress = force per length / a
    fx, fy = -T * ry / G["Ip"], T * rx / G["Ip"] - B["P"] / G["A_l"]
    tau_line = math.hypot(fx, fy) / a
    return {"tau_area": tau_area, "tau_line": tau_line, "diff_pct": 100 * (tau_line / tau_area - 1), "r": r}

def wa_base_plate(f_line, c, steel="S355", gamma=1.0):
    """Local bending of the base plate under the tube wall: line load f (N/mm) on a cantilever c (mm) to the support /
    bolt line; m = f c, plastic capacity m_pl = t^2 fy / 4 -> t_req = sqrt(4 f c gamma / fy)."""
    fy = STEELS[steel]["fy"]
    return math.sqrt(4 * f_line * c * gamma / (fy / GAMMA_M0))

# compressor base frame (example, typical section values - check the section table)
WA_UPN100 = {"A": 1350.0, "Iy": 2.06e6, "Wy": 41.2e3, "mass": 10.6}
WA_FRAME = {"m_compressor": 75.0, "m_motor": 32.0, "m_frame": 30.0, "L": 900.0, "n_beams": 2, "E": 210000.0,
            "f_orders": (24.1, 48.2), "F_shake": 264.0, "zeta_mount": 0.05, "n_mounts": 4}

def wa_frame(F=None, sec=None):
    """Two UPN 100 beams on two supports (span L) carry compressor + motor at mid-span (worst case): bending, deflection
    L/500, natural frequency of the mass on the beam springs k = 48 E I / L^3 compared with the compressor orders."""
    F = dict(WA_FRAME if F is None else F)
    s = dict(WA_UPN100 if sec is None else sec)
    m = F["m_compressor"] + F["m_motor"]
    W = m * 9.81 * 1.5                                      # factored, includes dynamic allowance
    M = W / F["n_beams"] * F["L"] / 4                       # N mm per beam
    sig = M / s["Wy"]
    w = (m * 9.81 / F["n_beams"]) * F["L"] ** 3 / (48 * F["E"] * s["Iy"])
    k = F["n_beams"] * 48 * F["E"] * s["Iy"] / F["L"] ** 3 * 1000      # N/m
    m_eff = m + 0.5 * F["m_frame"]
    fn = math.sqrt(k / m_eff) / (2 * math.pi)
    return {"W": W, "sigma": sig, "util": sig / (STEELS["S235"]["fy"] / GAMMA_M0), "w": w, "w_lim": F["L"] / 500, "k": k, "fn": fn,
            "ratios": [fo / fn for fo in F["f_orders"]]}

def wa_column(N_Ed, L_cr, sec, steel="S235", alpha=0.21):
    """EN 1993-1-1 6.3.1 flexural buckling: lambda_bar = sqrt(A fy / N_cr), phi = 0.5 (1 + alpha (lam - 0.2) + lam^2),
    chi = 1 / (phi + sqrt(phi^2 - lam^2)) <= 1; N_b,Rd = chi A fy / gM1 (gM1 = 1.0). alpha 0.21 = curve a (hot-finished RHS)."""
    fy = STEELS[steel]["fy"]
    I = min(sec["Ix"], sec["Iy"])
    Ncr = math.pi ** 2 * 210000.0 * I / L_cr ** 2
    lam = math.sqrt(sec["A"] * fy / Ncr)
    phi = 0.5 * (1 + alpha * (lam - 0.2) + lam * lam)
    chi = min(1.0, 1 / (phi + math.sqrt(phi * phi - lam * lam)))
    Nb = chi * sec["A"] * fy
    return {"Ncr": Ncr, "lam": lam, "phi": phi, "chi": chi, "Nb_Rd": Nb, "util": N_Ed / Nb}

def wa_transmissibility(r, zeta):
    """Force transmissibility of a spring-damper mount: T = sqrt((1 + (2 zeta r)^2) / ((1 - r^2)^2 + (2 zeta r)^2)), r = f / f_n."""
    return math.sqrt((1 + (2 * zeta * r) ** 2) / ((1 - r * r) ** 2 + (2 * zeta * r) ** 2))

def wa_mounts(F=None, ratio=3.0):
    """Choose 4 rubber mounts so that f_n = f_exc / ratio for the 1st compressor order; transmitted shaking force."""
    F = dict(WA_FRAME if F is None else F)
    m = F["m_compressor"] + F["m_motor"] + F["m_frame"]
    fn = F["f_orders"][0] / ratio
    k_tot = m * (2 * math.pi * fn) ** 2
    T1 = wa_transmissibility(ratio, F["zeta_mount"])
    T2 = wa_transmissibility(2 * ratio, F["zeta_mount"])
    return {"m": m, "fn": fn, "k_each": k_tot / F["n_mounts"], "static_defl_mm": m * 9.81 / k_tot * 1000, "T1": T1, "T2": T2,
            "F_transmitted": F["F_shake"] * T1}

# ---------------------------------------------------------------- chapter 4: fatigue details, spectra, methods
WA_FAT_EXT = [   # detail, FAT, failure location, note (EN 1993-1-9 / IIW style - check the exact detail sketches)
    ("rolled plate, machined / ground edges", 160, "base metal", "reference: no weld"),
    ("flame-cut edge, quality per EN 1090", 140, "edge", "machine flame cutting"),
    ("continuous longitudinal fillet / butt weld, automatic, no stop-start", 125, "weld", "girder webs"),
    ("continuous longitudinal fillet, manual / with stop-starts", 100, "weld toe at stop", ""),
    ("transverse butt weld, ground flush, 100 % NDT", 112, "weld", "best transverse joint"),
    ("transverse butt weld, as welded, both sides", 90, "toe", "weld reinforcement <= 10 % of the width"),
    ("transverse butt weld on backing strip", 71, "root", "permanent backing bar"),
    ("intermittent longitudinal fillet weld", 80, "toe at weld end", ""),
    ("transverse non-load-carrying attachment (stiffener), t <= 25", 80, "toe", "gussets, stiffeners"),
    ("cruciform / T, load-carrying, full penetration K-butt", 71, "toe", "load passes through the weld"),
    ("longitudinal attachment L = 50 ... 100 mm", 71, "toe at the end", "lugs welded along a member"),
    ("longitudinal attachment L > 100 mm", 56, "toe at the end", "long gussets"),
    ("cover plate end, t_c <= 20 mm", 56, "toe", "reinforcing plates - avoid in fatigue"),
    ("RHS welded to end plate, fillet, t <= 8", 40, "toe in the tube", "the bracket post of the default"),
    ("load-carrying fillet weld, throat (root)", 36, "root / throat", "partial penetration T-joints"),
    ("fillet weld throat in shear (m = 5)", 80, "throat", "longitudinal shear"),
    ("hot-spot, load-carrying fillet (structural stress)", 90, "toe", "IIW structural hot-spot method"),
    ("hot-spot, non-load-carrying fillet", 100, "toe", "IIW structural hot-spot method"),
    ("effective notch, r = 1 mm (principal stress)", 225, "toe / root", "IIW notch method, t >= 5 mm"),
]

def wa_sn_table(fats=(160, 112, 90, 80, 71, 56, 40, 36), N_list=(1e5, 2e6, 5e6, 1e8)):
    """Allowable range at N cycles for each FAT (inverse of sn_cycles, normal stress)."""
    def rng(fat, N):
        dD = fat * 0.4 ** (1 / 3)
        if N <= 5e6:
            return fat * (2e6 / N) ** (1 / 3)
        if N <= 1e8:
            return dD * (5e6 / N) ** (1 / 5)
        return dD * (5e6 / 1e8) ** (1 / 5)
    return [(fat, [rng(fat, N) for N in N_list]) for fat in fats]

def wa_equivalent_range(blocks, m=3, N_ref=2e6):
    """Equivalent constant-amplitude range at N_ref (single slope m): d_E = (sum n_i d_i^m / N_ref)^(1/m)."""
    return (sum(n * d ** m for d, n in blocks) / N_ref) ** (1 / m)

def wa_miner(blocks, fat, variant="EN"):
    """Damage of a spectrum [(range, n)] with four S-N models: EN (3/5 + cut-off), Haibach (3, then 5 without cut-off),
    no cut-off ... same as Haibach here, elementary (slope 3 down to zero)."""
    dD = fat * 0.4 ** (1 / 3)
    D = 0.0
    for d, n in blocks:
        if variant == "EN":
            N = sn_cycles(d, fat)
        elif variant == "Haibach":
            N = 2e6 * (fat / d) ** 3 if d >= dD else 5e6 * (dD / d) ** 5
        else:
            N = 2e6 * (fat / d) ** 3
        D += n / N
    return D

def wa_rainflow(series):
    """Rainflow counting (ASTM E1049 three-point method): returns [(range, mean, count)], count 1.0 or 0.5."""
    # reduce to turning points
    tp = []
    for x in series:
        if tp and x == tp[-1]:
            continue
        if len(tp) >= 2 and (tp[-1] - tp[-2]) * (x - tp[-1]) > 0:
            tp[-1] = x
        else:
            tp.append(x)
    out, stack = [], []
    for x in tp:
        stack.append(x)
        while len(stack) >= 3:
            X = abs(stack[-1] - stack[-2])
            Y = abs(stack[-2] - stack[-3])
            if X < Y:
                break
            if len(stack) == 3:
                out.append((Y, (stack[-2] + stack[-3]) / 2, 0.5))
                stack.pop(0)
            else:
                out.append((Y, (stack[-2] + stack[-3]) / 2, 1.0))
                last = stack.pop()
                stack.pop()
                stack.pop()
                stack.append(last)
    for a, b in zip(stack, stack[1:]):
        out.append((abs(b - a), (a + b) / 2, 0.5))
    return out

WA_SIGNAL = [0, 60, -10, 40, 5, 80, -20, 30, 10, 70, -15, 20, 0]     # MPa, stress history at a weld toe (example)

def wa_mean_stress_factor(R, condition="as welded"):
    """IIW enhancement factor f(R) on the FAT value: as welded / large residual stress f = 1; stress relieved:
    f = 1.6 (R < -1), -0.4 R + 1.2 (-1 <= R <= 0.5), 1.0 (R > 0.5) - check IIW 2008 / 2016."""
    if condition == "as welded":
        return 1.0
    if R < -1:
        return 1.6
    if R <= 0.5:
        return -0.4 * R + 1.2
    return 1.0

def wa_hot_spot(s04t, s10t, s09t=None, s14t=None):
    """IIW type a hot spot: linear sigma_hs = 1.67 s(0.4t) - 0.67 s(1.0t); quadratic 2.52 s(0.4t) - 2.24 s(0.9t) + 0.72 s(1.4t)."""
    lin = 1.67 * s04t - 0.67 * s10t
    quad = 2.52 * s04t - 2.24 * s09t + 0.72 * s14t if s09t is not None else None
    return {"linear": lin, "quadratic": quad}

def wa_hot_spot_b(s4, s8, s12):
    """IIW type b hot spot (along a plate edge / attachment end): sigma_hs = 3 s(4mm) - 3 s(8mm) + s(12mm)."""
    return 3 * s4 - 3 * s8 + s12

WA_IMPROVE = [   # method, FAT factor on toe classes (typical, check IIW recommendations), condition
    ("burr grinding of the toe", 1.3, "toe failures only, depth 0.5 mm below undercut, inspected"),
    ("TIG dressing", 1.3, "toe failures only, remelted smooth toe"),
    ("hammer / needle peening", 1.3, "compressive residual stress, not for R > 0.5"),
    ("HFMI (high-frequency mechanical impact)", 1.6, "S355 and higher, up to +4 FAT classes, limited R and peak stress"),
    ("none - root failure governs", 1.0, "improvement of the toe does not help a root crack: increase the throat / full penetration"),
]
WA_GAMMA_MF = {("damage tolerant", "low"): 1.00, ("damage tolerant", "high"): 1.15, ("safe life", "low"): 1.15, ("safe life", "high"): 1.35}

def wa_bracket_margin(P=None):
    """How far the default bracket loads must be scaled before the fatigue life becomes finite:
    starts block reaches the allowable range for its n; ripple block reaches the cut-off."""
    P = dict(DEFAULT if P is None else P)
    Fa = fatigue(P)
    out = []
    for b in Fa["blocks"]:
        n = b["n"]
        for key, rng, fat_name in (("toe", b["ds_toe"], P["fat_toe"]), ("throat", b["ds_w"], P["fat_throat"])):
            fat = FAT[fat_name][0]
            # allowable range for n cycles (EN curve) divided by gamma_Mf
            if n <= 5e6:
                allow = fat * (2e6 / n) ** (1 / 3)
            elif n <= 1e8:
                allow = fat * 0.4 ** (1 / 3) * (5e6 / n) ** (1 / 5)
            else:
                allow = fat * 0.4 ** (1 / 3) * (5e6 / 1e8) ** (1 / 5)
            allow /= P["gamma_Mf"] * P["gamma_Ff"]
            out.append((b["name"], key, rng, allow, allow / rng if rng else float("inf")))
    return out

WA_AGV = {"name": "AGV chassis: cross-member to side-member fillet weld (example)",
          "fat": 71, "t": 10.0, "gamma_Mf": 1.15,
          "spectrum": [(100.0, 3.0e4, "floor joints at full load, 0.5 g bumps"), (65.0, 6.0e5, "loaded travel, turns"),
                       (34.0, 8.0e6, "unloaded travel"), (15.0, 1.0e8, "motor / wheel vibration")]}

def wa_agv(A=None):
    A = dict(WA_AGV if A is None else A)
    g = A["gamma_Mf"]
    blocks = [(d * g, n) for d, n, _ in A["spectrum"]]
    res = {v: wa_miner(blocks, A["fat"], v) for v in ("EN", "Haibach", "elementary")}
    dE = wa_equivalent_range([(d, n) for d, n, _ in A["spectrum"]])
    rows = [(txt, d, n, sn_cycles(d * g, A["fat"]), n / sn_cycles(d * g, A["fat"])) for d, n, txt in A["spectrum"]]
    return {"D": res, "dE2": dE, "rows": rows, "life_years_per_10": 10 / res["EN"] if res["EN"] else float("inf")}


def demo_ch24():
    P = dict(DEFAULT)
    print("## 2.1 Joint types")
    for j in WA_JOINTS:
        print("  %-20s %-34s %-42s %s" % j)
    print("\n## 2.2 Weld types")
    for w in WA_WELDS:
        print("  %-28s %-34s %-52s %s" % w)
    print("\n## 2.3 ISO 2553 symbol elements")
    for s in WA_SYMBOL:
        print("  %-30s %s" % s)
    print("\n## 2.4 Leg and throat")
    for z in (4.0, 5.0, 7.0):
        r = wa_leg_throat(z=z)
        print("  leg z %.1f mm -> throat a %.2f mm" % (z, r["a"]))
    print("\n## 2.5 Stress components on the throat (f_perp 300 N/mm, f_par 200 N/mm, a 5 mm)")
    c = wa_components(300.0, 200.0, 5.0)
    print("  sigma_perp %.1f, tau_perp %.1f, tau_par %.1f MPa -> sigma_eq %.1f MPa" % (c["sigma_perp"], c["tau_perp"], c["tau_par"], c["sigma_eq"]))
    print("\n## 2.6 Design capacity per mm of fillet weld, a 5 mm, by load angle (0 = along the weld)")
    for st in ("S235", "S355"):
        u = wa_unit_capacity(st, 5.0)
        print("  %s: limit fu/(beta_w gM2) %.0f MPa, sigma_perp limit %.0f MPa, f_vw,d %.0f MPa" % (st, u["lim"], u["lim_perp"], u["fvw"]))
        for th, F, Fs in u["rows"]:
            print("    theta %2d deg: directional %6.0f N/mm, simplified %6.0f N/mm (ratio %.2f)" % (th, F, Fs, F / Fs))
    print("\n## 2.7 Full-strength double fillet (T-joint across) and butt welds")
    for st in STEELS:
        print("  %s: a / t = %.3f" % (st, wa_full_strength(st)))
    b = wa_butt("S355", 10.0, a_nom=6.0, angle_deg=45)
    print("  S355 t 10: full-penetration butt %.0f N/mm; HV partial 6 mm at 45 deg -> a_eff %.1f mm, both sides %.0f N/mm (%.0f %% of full)" % (
        b["full_N_per_mm"], b["a_eff"], b["partial_N_per_mm"], 100 * b["ratio"]))
    print("\n## 2.8 Throat rules - tube wall vs a >= 3 mm (base plate 10 mm)")
    for t, amin, amax, ok in wa_throat_conflict():
        print("  tube t %.0f mm: a_min %.2f, a_max = 0.7 t %.2f -> %s" % (t, amin, amax, "possible" if ok else "CONFLICT"))
    F = fillet_check(dict(P, member=dict(P["member"], t=4.0), t_min=4.0))
    print("  default joint with RHS 80x80x4: utilisation %.3f, rules a_max %.2f -> %s" % (F["util_dir"], F["rules"]["a_max"], "OK" if F["rules"]["ok_max"] else "NOT OK"))
    print("\n## 2.9 Long lap joints (a 5 mm)")
    for Lj in (500, 750, 1000, 1500, 2500):
        print("  Lj %4d mm (%.1f x 150a): beta_Lw %.3f" % (Lj, Lj / 750, wa_long_joint(Lj, 5.0)))

    print("\n## 3.1 Weld group catalog (b 80, d 120; line method, mm / mm^3)")
    for name, G, ref in wa_catalog():
        refs = ", ".join("%s textbook %.0f" % (k, v) for k, v in ref.items())
        print("  %-22s L %4.0f, centroid (%5.1f, %5.1f), Ix %8.0f, Iy %8.0f, Ip %8.0f  %s" % (name, G["A_l"], G["xc"], G["yc"], G["Ix"], G["Iy"], G["Ip"], refs))
    print("\n## 3.2 Eccentric bracket (C weld b 80 / d 150, a 5, P 12 kN at e 200 mm)")
    B = wa_bracket()
    w = B["F"]["worst"]
    print("  centroid x %.1f mm from the column face, lever %.1f mm, T %.0f N m" % (B["G"]["xc"], B["lever"], B["T_Nm"]))
    print("  worst point (%.0f, %.0f): f_t %.0f, f_l %.0f N/mm -> sigma_eq %.0f MPa, utilisation %.3f (simplified %.3f)" % (
        w["x"], w["y"], w["ft"], w["fl"], w["sigma_eq"], B["F"]["util_dir"], B["F"]["util_simple"]))
    A = wa_area_method()
    print("  same corner: area method tau %.1f MPa, line method %.1f MPa (%+.1f %%)" % (A["tau_area"], A["tau_line"], A["diff_pct"]))
    for a in (4.0, 5.0, 6.0):
        Bq = wa_bracket(dict(WA_BRACKET, a=a))
        print("  a %.0f mm: utilisation %.3f" % (a, Bq["F"]["util_dir"]))
    print("\n## 3.3 Default post: line forces and base plate")
    G, pts = line_forces(P["lines"], P["loads"], P["n_points"])
    fmax = max(abs(p["fn"]) for p in pts)
    print("  max normal line force %.1f N/mm; base plate cantilever 30 mm -> t_req %.1f mm (10 mm used)" % (fmax, wa_base_plate(fmax, 30.0)))
    M = member_check(P)
    print("  RHS 80x80x5: sigma %.1f, tau %.1f MPa, utilisation %.3f" % (M["sigma"], M["tau"], M["util"]))
    print("\n## 3.4 Compressor base frame (2 x UPN 100, span 900 mm, compressor + motor 107 kg at mid-span)")
    Fr = wa_frame()
    print("  factored load %.0f N, sigma %.1f MPa (S235 utilisation %.3f), deflection %.3f mm vs L/500 %.1f mm" % (Fr["W"], Fr["sigma"], Fr["util"], Fr["w"], Fr["w_lim"]))
    print("  stiffness %.3g N/m, natural frequency %.0f Hz; orders 24.1 / 48.2 Hz -> ratio %.2f / %.2f" % (Fr["k"], Fr["fn"], *Fr["ratios"]))
    for L in (900.0, 1500.0, 2500.0):
        Fq = wa_frame(dict(WA_FRAME, L=L))
        print("    span %4.0f mm: f_n %5.1f Hz (ratio to 24.1 Hz %.2f)" % (L, Fq["fn"], 24.1 / Fq["fn"]))
    col = wa_column(1500.0 * 1.5, 600.0 * 2.0, rhs(60, 60, 4))
    print("  frame leg RHS 60x60x4, cantilever 600 mm (L_cr 1200): N_cr %.0f kN, lambda %.2f, chi %.3f, N_b,Rd %.0f kN, utilisation %.3f" % (
        col["Ncr"] / 1000, col["lam"], col["chi"], col["Nb_Rd"] / 1000, col["util"]))
    for Lcr in (1200.0, 3000.0, 5000.0):
        cq = wa_column(10000.0, Lcr, rhs(60, 60, 4))
        print("    L_cr %4.0f mm: lambda %.2f, chi %.3f" % (Lcr, cq["lam"], cq["chi"]))
    print("\n## 3.5 Vibration isolation mounts (4 mounts, f_n = 24.1 / 3 Hz)")
    Mo = wa_mounts()
    print("  mass %.0f kg, f_n %.1f Hz, k %.0f N/mm per mount, static deflection %.1f mm" % (Mo["m"], Mo["fn"], Mo["k_each"] / 1000, Mo["static_defl_mm"]))
    print("  transmissibility order 1 %.3f, order 2 %.3f -> shaking force %.0f N becomes %.0f N on the floor" % (Mo["T1"], Mo["T2"], WA_FRAME["F_shake"], Mo["F_transmitted"]))
    for r in (0.5, 1.0, 1.41, 2.0, 3.0, 5.0):
        print("    r %.2f: T %.3f" % (r, wa_transmissibility(r, 0.05)))

    print("\n## 4.1 Detail categories (extended)")
    for d, fat, loc, note in WA_FAT_EXT:
        print("  FAT %3d  %-66s %-18s %s" % (fat, d, loc, note))
    print("\n## 4.2 Allowable stress range [MPa] at N = 1e5 / 2e6 / 5e6 / >= 1e8")
    for fat, r in wa_sn_table():
        print("  FAT %3d: %6.1f %6.1f %6.1f %6.1f" % (fat, *r))
    print("\n## 4.3 Rainflow counting of a stress history at a weld toe")
    print("  signal: %s MPa" % WA_SIGNAL)
    rf = wa_rainflow(WA_SIGNAL)
    for rng, mean, cnt in sorted(rf, reverse=True):
        print("  range %5.1f MPa, mean %5.1f, count %.1f" % (rng, mean, cnt))
    blocks = [(r, c * 1e6) for r, _, c in rf]
    print("  repeated 1e6 times, FAT 71: equivalent range at 2e6 %.1f MPa; damage EN %.3f, Haibach %.3f, elementary %.3f" % (
        wa_equivalent_range(blocks), wa_miner(blocks, 71, "EN"), wa_miner(blocks, 71, "Haibach"), wa_miner(blocks, 71, "elementary")))
    print("\n## 4.4 Thickness and mean stress")
    for t in (10, 25, 40, 60, 100):
        print("  t %3d mm: k_s %.3f -> FAT 71 becomes %.1f" % (t, thickness_factor(t), 71 * thickness_factor(t)))
    for R in (-1.0, 0.0, 0.5):
        print("  R %+.1f: f(R) as welded %.2f, stress relieved %.2f" % (R, wa_mean_stress_factor(R), wa_mean_stress_factor(R, "stress relieved")))
    print("\n## 4.5 Hot-spot and effective notch (FE readings at a gusset toe, t 12 mm)")
    hs = wa_hot_spot(118.0, 96.0, 99.0, 90.0)
    print("  type a: s(0.4t) 118, s(1.0t) 96 MPa -> linear %.1f MPa; quadratic (0.4/0.9/1.4 t) %.1f MPa" % (hs["linear"], hs["quadratic"]))
    print("  type b: s(4/8/12 mm) 130 / 112 / 101 MPa -> %.1f MPa" % wa_hot_spot_b(130.0, 112.0, 101.0))
    ds_hs = hs["linear"] * 0.8                                 # stress range = 80 % of the peak (R ~ 0.2, example)
    print("  range %.1f MPa (80 %% of the hot-spot peak): hot-spot FAT 90 -> N %.3g; notch (Kw 2.6) %.1f MPa, FAT 225 -> N %.3g" % (
        ds_hs, sn_cycles(ds_hs, 90), 2.6 * ds_hs, sn_cycles(2.6 * ds_hs, 225)))
    print("\n## 4.6 Improvement techniques and partial factors")
    for m, f, cond in WA_IMPROVE:
        print("  %-42s FAT x %.1f  %s" % (m, f, cond))
    for (strat, cons), g in WA_GAMMA_MF.items():
        print("  gamma_Mf %-16s %-5s consequence: %.2f" % (strat, cons, g))
    print("\n## 4.7 Default bracket: margin to finite life (load factor that reaches the allowable range)")
    for name, key, rng, allow, fac in wa_bracket_margin():
        print("  %-62s %-6s range %5.2f MPa, allowable %5.1f MPa -> factor %5.1f" % (name[:62], key, rng, allow, fac))
    print("\n## 4.8 AGV chassis weld, FAT 71, gamma_Mf 1.15, 10-year spectrum")
    Ag = wa_agv()
    for txt, d, n, N, D in Ag["rows"]:
        print("  %5.1f MPa x %.1e: N %s, D %.3f  (%s)" % (d, n, "inf" if N == float("inf") else "%.3g" % N, D, txt))
    print("  damage EN %.3f, Haibach %.3f, elementary %.3f; equivalent range at 2e6 (m 3, unfactored) %.1f MPa; EN life %.1f years" % (
        Ag["D"]["EN"], Ag["D"]["Haibach"], Ag["D"]["elementary"], Ag["dE2"], Ag["life_years_per_10"]))
    for fat in (80, 90):
        A2 = wa_agv(dict(WA_AGV, fat=fat))
        print("  same spectrum with FAT %d: damage EN %.3f -> life %.1f years" % (fat, A2["D"]["EN"], A2["life_years_per_10"]))
    A3 = wa_agv(dict(WA_AGV, fat=71 * 1.3))
    print("  FAT 71 after burr grinding (x 1.3 = %.0f): damage %.3f -> life %.1f years" % (71 * 1.3, A3["D"]["EN"], A3["life_years_per_10"]))

# ================================================================ added with guide chapters (ch78)
# ---------------------------------------------------------------- chapter 7.1: processes
WM_PROCESSES = [   # ISO 4063 number, name, thermal efficiency k (EN 1011-1), deposition kg/h (typical), use (check)
    (111, "manual metal arc (MMA, stick)", 0.8, 1.0, "site work, repairs, all positions; slow, slag"),
    (135, "MAG solid wire", 0.8, 3.0, "workshop standard for steel frames; spatter, needs gas shield from wind"),
    (136, "MAG flux-cored wire (gas shielded)", 0.8, 4.5, "positional welding of thick plate, high deposition"),
    (138, "MAG metal-cored wire", 0.8, 5.0, "robot welding, fillet welds, little slag"),
    (141, "TIG", 0.6, 0.5, "thin sheet, stainless, root runs of pipes and vessels; best quality, slow"),
    (121, "submerged arc (SAW), single wire", 1.0, 8.0, "long seams of vessels and beams, flat position, deep penetration"),
    (52, "laser beam welding", 0.9, 0.0, "thin sheet, car bodies, very low heat input; needs fit-up < 0.1 mm"),
    (21, "resistance spot welding", 1.0, 0.0, "sheet metal 0.5-3 mm, no filler; strength by spot diameter 5 sqrt(t)"),
    (783, "drawn-arc stud welding (ceramic ferrule)", 1.0, 0.0, "shear studs, threaded studs on plates"),
]

def wm_heat_input(U, I, v_mm_min, k=0.8):
    """Heat input Q = k U I / v (kJ/mm), v travel speed: Q = k U I 60 / (1000 v[mm/min])."""
    return k * U * I * 60 / (1000 * v_mm_min)

# ---------------------------------------------------------------- chapter 7.2: preheat, cooling time, hardness
WM_S355_CAST = {"C": 0.18, "Si": 0.30, "Mn": 1.45, "Cr": 0.05, "Cu": 0.10, "Mo": 0.02, "Ni": 0.05}   # example ladle analysis

def wm_cet(c):
    """CET = C + (Mn + Mo)/10 + (Cr + Cu)/20 + Ni/40 (EN 1011-2 annex C)."""
    return c["C"] + (c["Mn"] + c["Mo"]) / 10 + (c["Cr"] + c["Cu"]) / 20 + c["Ni"] / 40

def wm_ce_iiw(c):
    """CE(IIW) = C + Mn/6 + (Cr + Mo + V)/5 + (Ni + Cu)/15."""
    return c["C"] + c["Mn"] / 6 + (c["Cr"] + c["Mo"]) / 5 + (c["Ni"] + c["Cu"]) / 15

def wm_preheat(CET, d, HD, Q):
    """EN 1011-2 annex C (method B): T_p = T_pCET + T_pd + T_pHD + T_pQ (C), valid CET 0.2-0.5, d 10-90 mm,
    HD 1-20 ml/100 g, Q 0.5-4 kJ/mm (check the standard):
    T_pCET = 750 CET - 150; T_pd = 160 tanh(d/35) - 110; T_pHD = 62 HD^0.35 - 100; T_pQ = (53 CET - 32) Q - 53 CET + 32."""
    parts = {"CET": 750 * CET - 150, "d": 160 * math.tanh(d / 35) - 110, "HD": 62 * HD ** 0.35 - 100,
             "Q": (53 * CET - 32) * Q - 53 * CET + 32}
    return {"parts": parts, "T_p": sum(parts.values())}

def wm_t85(Q, d, T0=20.0, F2=0.67, F3=0.67):
    """Cooling time 800 -> 500 C (EN 1011-2 annex D): 3-D (thick plate) t = (6700 - 5 T0) Q (1/(500-T0) - 1/(800-T0)) F3;
    2-D (thin plate) t = (4300 - 4.3 T0) 1e5 Q^2/d^2 ((1/(500-T0))^2 - (1/(800-T0))^2) F2. The larger value applies.
    Shape factors F2, F3 for a single-run fillet weld in a T-joint ~0.67 (check table D.1)."""
    t3 = (6700 - 5 * T0) * Q * (1 / (500 - T0) - 1 / (800 - T0)) * F3
    t2 = (4300 - 4.3 * T0) * 1e5 * Q ** 2 / d ** 2 * ((1 / (500 - T0)) ** 2 - (1 / (800 - T0)) ** 2) * F2
    dt = math.sqrt((4300 - 4.3 * T0) * 1e5 * Q * ((1 / (500 - T0)) ** 2 - (1 / (800 - T0)) ** 2) * F2
                   / ((6700 - 5 * T0) * (1 / (500 - T0) - 1 / (800 - T0)) * F3))
    return {"t_3D": t3, "t_2D": t2, "t85": max(t2, t3), "mode": "2-D (thin)" if t2 > t3 else "3-D (thick)", "d_transition": dt}

def wm_hv_martensite(C):
    """Upper bound of HAZ hardness (fully martensitic, Yurioka style): HV_M = 884 C (1 - 0.3 C^2) + 294 (check)."""
    return 884 * C * (1 - 0.3 * C * C) + 294

# ---------------------------------------------------------------- chapter 7.3: shrinkage and distortion
WM_ALPHA_E_CRHO = 12e-6 * 210000 / 3.74e-3      # alpha E / (c rho) of steel, N/J (12e-6 1/K, 210 GPa, 3.74 J/(cm3 K))

def wm_shrink_force(Q_kJmm):
    """Okerblom: longitudinal shrinkage force of one weld run F = 0.335 alpha E / (c rho) q, q = Q in J/mm (check)."""
    return 0.335 * WM_ALPHA_E_CRHO * Q_kJmm * 1000

def wm_distortion(Q_kJmm, L, A, I, e, n_runs=1, E=210000.0):
    """Shortening dL = F L / (E A) and bowing (camber) f = F e L^2 / (8 E I) of a member with a weld at eccentricity e."""
    F = n_runs * wm_shrink_force(Q_kJmm)
    return {"F": F, "dL": F * L / (E * A), "bow": F * e * L ** 2 / (8 * E * I)}

def wm_transverse_shrink(A_w, t):
    """Transverse shrinkage of a butt weld ~ 0.18 A_w / t (mm; A_w weld cross section mm2, t plate mm) - empirical, check."""
    return 0.18 * A_w / t

# ---------------------------------------------------------------- chapter 7.4: PWHT, execution class, NDT, ISO 5817
def wm_pwht(t, steel="P265GH"):
    """Post-weld heat treatment (EN 13445-4 style, check): holding 580-620 C for 2 min/mm (min 30 min);
    heating and cooling above 400 C at most 5500/t K/h, max 220 K/h."""
    hold = max(30.0, 2.0 * t)
    rate = min(220.0, 5500.0 / t)
    return {"T": (580, 620), "hold_min": hold, "rate_Kh": rate, "time_400_600_h": 2 * 200 / rate}

WM_EXC = [   # EN 1090-2 execution class, typical use, quality level (ISO 5817), extra NDT of welds (check EN 1090-2 table 24)
    ("EXC1", "agricultural / light secondary steelwork, static", "D", "visual only"),
    ("EXC2", "normal buildings, machine frames, cranes in normal duty", "C (B for fatigue details)", "fillet / partial pen.: 5 % MT/PT if a > 12 mm; transverse butt welds 10 % UT/RT"),
    ("EXC3", "large spans, fatigue-loaded structures, cranes", "B", "transverse butt 20 %, fillet 10 % (MT), first 5 joints of a new WPS 100 %"),
    ("EXC4", "bridges, consequences of failure extreme", "B+", "transverse butt 100 %, fillet 20 %"),
]
WM_NDT = [   # method, finds, applicable, standard
    ("VT visual", "surface defects, shape, size, undercut, spatter", "100 % of all welds, before any other NDT", "ISO 17637"),
    ("PT dye penetrant", "surface-open cracks, pores", "all materials, small parts", "ISO 3452 / 23277"),
    ("MT magnetic particle", "surface and near-surface cracks", "ferritic steel only, fillet weld toes", "ISO 17638 / 23278"),
    ("UT ultrasonic (incl. PAUT, TOFD)", "volume defects, lack of fusion, cracks", "t >= 8 mm, butt welds, T-joints", "ISO 17640 / 11666"),
    ("RT radiography (film / digital)", "pores, slag, lack of penetration (volume defects)", "butt welds, vessel seams; radiation protection", "ISO 17636 / 10675"),
]
WM_ISO5817 = [   # imperfection, limit for level B / C / D (t = thickness, b = bead width, h = height) - examples, check ISO 5817
    ("undercut (continuous), h", "0.05 t, max 0.5 mm", "0.1 t, max 0.5 mm", "0.2 t, max 1.0 mm"),
    ("excess weld metal (butt), h", "1 + 0.1 b, max 5 mm", "1 + 0.15 b, max 7 mm", "1 + 0.25 b, max 10 mm"),
    ("throat too small (fillet), h", "not permitted", "0.3 + 0.1 a, max 1 mm (short)", "0.3 + 0.1 a, max 2 mm (short)"),
    ("throat too large (fillet), h", "1 + 0.15 a, max 3 mm", "1 + 0.2 a, max 4 mm", "1 + 0.3 a, max 5 mm"),
    ("surface pore, d", "not permitted", "0.2 s, max 2 mm", "0.3 s, max 3 mm"),
    ("incomplete root penetration", "not permitted", "not permitted", "short: 0.2 t, max 2 mm"),
    ("crack", "not permitted", "not permitted", "not permitted"),
]

# ---------------------------------------------------------------- chapter 7.5: weld metal and cost
def wm_area_fillet(a, excess=0.10):
    """Fillet weld (equal legs z = a sqrt 2): cross section a^2, plus excess (convexity) ~10 %."""
    return a * a * (1 + excess)

def wm_area_butt(t, angle_deg=60.0, gap=2.0, root_face=1.5, cap=1.5, both_sides=False):
    """V-butt weld: (t - c)^2 tan(alpha/2) + g t + cap (width x height x 0.7); X-butt: two halves."""
    if both_sides:
        h = (t - root_face) / 2
        core = 2 * h * h * math.tan(math.radians(angle_deg / 2)) + gap * t
        width = 2 * h * math.tan(math.radians(angle_deg / 2)) + gap + 2
        return core + 2 * 0.7 * width * cap
    core = (t - root_face) ** 2 * math.tan(math.radians(angle_deg / 2)) + gap * t
    width = 2 * (t - root_face) * math.tan(math.radians(angle_deg / 2)) + gap + 2
    return core + 0.7 * width * cap

WM_COST = {"labour_eur_h": 55.0, "wire_eur_kg": 2.8, "gas_l_min": 15.0, "gas_eur_l": 0.012, "power_kW": 8.0,
           "power_eur_kWh": 0.20, "op_factor": 0.35, "deposit_eff": 0.95}      # typical workshop data (check)

def wm_cost_per_m(A_mm2, dep_kgh, c=None):
    """Cost per metre: weld metal m = A rho; arc time = m / deposition; labour time = arc time / operating factor."""
    c = WM_COST if c is None else c
    m = A_mm2 * 1000 * 7.85e-6                       # kg per metre
    t_arc = m / dep_kgh                              # h
    t_lab = t_arc / c["op_factor"]
    cost = {"labour": t_lab * c["labour_eur_h"], "wire": m / c["deposit_eff"] * c["wire_eur_kg"],
            "gas": t_arc * 60 * c["gas_l_min"] * c["gas_eur_l"], "power": t_arc * c["power_kW"] * c["power_eur_kWh"]}
    return {"kg_m": m, "arc_min_m": t_arc * 60, "labour_min_m": t_lab * 60, "cost": cost, "total": sum(cost.values())}

# ---------------------------------------------------------------- chapter 7.6: vessel and frame fabrication
WM_VESSEL_ROUTE = [   # step, method, key data / check
    ("1 material receipt", "plate P265GH with 3.1 certificate (EN 10204), heads bought pressed", "traceability: heat number transferred to every part"),
    ("2 cutting", "plasma or laser cutting of the shell plate, edge preparation", "developed length = pi x mean diameter"),
    ("3 rolling", "3- or 4-roll bending to the cylinder, ends pre-bent", "out-of-roundness <= 1 % (EN 13445-4), peaking at the seam"),
    ("4 longitudinal seam", "SAW (121) or MAG, I- or V-joint, run-on / run-off plates", "production test plate for category III, RT of the seam"),
    ("5 heads", "dished heads pressed / spun from a blank (Kloepper DIN 28011), cylindrical flange 3.5 e", "thinning in the knuckle ~10 % (head_e allowance)"),
    ("6 nozzles and bosses", "set-in nozzles cut by template, full-penetration welds, threaded bosses for drain / gauge / safety valve", "area replacement (vessel.nozzle())"),
    ("7 circumferential seams", "head-to-shell with backing strip or joggle, MAG / SAW on rotator", "alignment (offset) <= 0.1 e + 1 mm, check the code"),
    ("8 supports", "feet / saddles fillet welded to pads, not directly on the shell", "pads avoid local bending at the shell"),
    ("9 NDT", "VT 100 %, RT/UT of seams by testing group, MT of nozzle welds", "joint coefficient z follows the testing group"),
    ("10 pressure test", "hydrostatic test at P_t (vessel.test_pressure()), hold >= 30 min, inspect", "never pneumatic unless approved (stored energy)"),
    ("11 surface", "shot blasting, inside: galvanising or epoxy coating; outside: paint", "corrosion allowance c already in the wall"),
    ("12 marking and papers", "nameplate (PS, TS, V, year, number), CE + notified body number, declaration, instructions", "SPVD / PED documentation, kept 10 years"),
]
WM_FRAME = [   # step, rule
    ("jig / fixture", "locates the members to the drawing datums; prevents distortion; datums = function surfaces later machined"),
    ("tack welding", "tacks 3-4 a long, by qualified welders with the WPS; symmetric sequence, preheat as for the weld"),
    ("welding sequence", "from the centre outwards, alternate sides (balance shrinkage), long welds back-step"),
    ("pre-setting", "pre-bend parts against the expected angular distortion (e.g. 1-2 deg for single fillets)"),
    ("straightening", "flame straightening at 600-650 C (S355, never above 700 C) or press; check fatigue details afterwards"),
    ("machining after welding", "bearing seats, motor feet and mounting faces machined after welding (and stress relief if precision needed)"),
]
INSPECTION_PLAN_WELD = [   # characteristic, method, frequency
    ("welder / operator qualification", "ISO 9606-1 / ISO 14732 certificates, valid", "before start"),
    ("WPS available at the workplace", "visual check", "every job"),
    ("preheat temperature", "contact thermometer / crayon at 75 mm from the joint", "every joint, before the first run"),
    ("heat input (U, I, v)", "weld monitor / measurement", "first part + random"),
    ("throat thickness a", "fillet weld gauge", "every weld (EXC2: 100 % visual + gauge)"),
    ("visual imperfections ISO 5817", "VT ISO 17637", "100 %"),
    ("cracks at fatigue-critical toes", "MT ISO 17638", "per EXC / drawing (e.g. 100 % at the jib root)"),
    ("butt welds", "UT / RT", "per EXC / testing group"),
    ("dimensions after welding", "tape, square, CMM / laser tracker for machined frames", "first article + sampling"),
]
FAILURES_WELD = [   # failure, appearance, cause, remedy
    ("fatigue crack at the weld toe", "crack along the toe, beach marks", "high stress range at a low-FAT detail", "better detail class, toe grinding / HFMI, move the weld out of the stress flow"),
    ("fatigue crack from the root", "crack through the throat of a fillet", "load-carrying fillet too small (FAT 36)", "full-penetration weld or larger throat"),
    ("hydrogen (cold) crack", "crack in the HAZ hours after welding", "hard HAZ + hydrogen + restraint", "preheat (EN 1011-2), low-hydrogen consumables, dry electrodes"),
    ("solidification (hot) crack", "centre-line crack in the weld metal", "deep narrow bead, S/P impurities", "bead width/depth > 1, less current, cleaner wire"),
    ("lamellar tearing", "step-like crack under a T-joint in thick plate", "through-thickness weakness (inclusions)", "Z-quality plate (EN 10164 Z25/Z35), change joint"),
    ("lack of fusion / penetration", "found by UT/RT, or fracture surface", "wrong parameters, angle, access", "WPS, welder training, joint preparation"),
    ("brittle fracture", "flat fracture, chevrons, at low temperature", "low toughness (J0/J2 grade too low), thick plate, notch", "toughness grade per EN 1993-1-10, avoid notches"),
    ("excessive distortion", "parts out of tolerance", "too much heat, wrong sequence", "less weld metal (a not oversize!), sequence, jigs, pre-setting"),
]

# ---------------------------------------------------------------- chapter 8: worked example
WM_EXAMPLE_VARIANTS = [   # label, RHS b=h, t, throat a, toe detail, throat detail
    ("V0 RHS 120x120x6, fillet a 4 all round", 120.0, 6.0, 4.0, "RHS welded to plate, fillet, t <= 8 (toe)", "fillet weld throat, load-carrying (root)"),
    ("V1 RHS 160x160x8, fillet a 5 all round", 160.0, 8.0, 5.0, "RHS welded to plate, fillet, t <= 8 (toe)", "fillet weld throat, load-carrying (root)"),
    ("V2 RHS 120x120x6, full-penetration butt weld to end plate (chosen)", 120.0, 6.0, 6.0, "load-carrying cruciform, full penetration", "load-carrying cruciform, full penetration"),
]

def wm_example_params(path=None):
    p = path or os.path.join(os.path.dirname(os.path.abspath(__file__)), "weld_example.json")
    if not os.path.exists(p):
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "examples", "weld_example.json")
    with open(p, encoding="utf-8") as f:
        return dict(DEFAULT, **json.load(f))

def wm_variant(P, b, t, a, toe, throat):
    s = b
    Q = dict(P, a=a, t_min=t, lines=[[0, 0, s, 0], [s, 0, s, s], [s, s, 0, s], [0, s, 0, 0]],
             member=dict(P["member"], b=b, h=b, t=t), fat_toe=toe, fat_throat=throat)
    return Q, summary(Q)

# ---------------------------------------------------------------- demo
def demo_ch78():
    P = dict(DEFAULT)
    print("## 7.1 Welding processes (ISO 4063) and heat input")
    for no, name, k, dep, use in WM_PROCESSES:
        print("  %3d %-42s k %.1f  deposition %4.1f kg/h  %s" % (no, name, k, dep, use))
    for proc, U, I, v, k in (("135 MAG fillet a 3 (bracket)", 22.0, 200.0, 450.0, 0.8), ("135 MAG fillet a 6", 29.0, 280.0, 300.0, 0.8),
                             ("121 SAW long seam t 4", 28.0, 380.0, 900.0, 1.0), ("141 TIG root", 12.0, 110.0, 80.0, 0.6)):
        print("  %-30s U %4.1f V, I %3.0f A, v %3.0f mm/min -> Q = %.2f kJ/mm" % (proc, U, I, v, wm_heat_input(U, I, v, k)))

    print("\n## 7.2 Carbon equivalent, preheat (EN 1011-2 method B), cooling time, hardness")
    c = WM_S355_CAST
    CET, CE = wm_cet(c), wm_ce_iiw(c)
    print("  S355 example cast: C %.2f Mn %.2f ... -> CET %.3f, CE(IIW) %.3f" % (c["C"], c["Mn"], CET, CE))
    for d, HD, Q in ((10, 5, 0.59), (20, 5, 0.59), (20, 10, 0.59), (40, 5, 1.0), (40, 10, 1.0), (60, 15, 1.0)):
        r = wm_preheat(CET, d, HD, Q)
        print("  d %2d mm, HD %2d, Q %.2f kJ/mm: T_p = %+.0f %+.0f %+.0f %+.0f = %4.0f C -> %s" % (
            d, HD, Q, r["parts"]["CET"], r["parts"]["d"], r["parts"]["HD"], r["parts"]["Q"], r["T_p"],
            "no preheat" if r["T_p"] <= 20 else "preheat %.0f C" % (math.ceil(r["T_p"] / 25) * 25)))
    for Q, d, T0 in ((0.59, 5, 20), (0.59, 10, 20), (1.0, 20, 20), (1.0, 40, 20), (1.0, 40, 100)):
        r = wm_t85(Q, d, T0)
        print("  t8/5: Q %.2f kJ/mm, d %2d mm, T0 %3d C -> 3-D %.1f s, 2-D %.1f s -> %.1f s (%s, transition d %.1f mm)" % (
            Q, d, T0, r["t_3D"], r["t_2D"], r["t85"], r["mode"], r["d_transition"]))
    print("  martensite upper bound HV_M (C %.2f) = %.0f HV; ISO 15614-1 limit without PWHT (group 1) 380 HV10 - check" % (c["C"], wm_hv_martensite(c["C"])))

    print("\n## 7.3 Shrinkage and distortion")
    for Q in (0.59, 1.0, 1.6):
        print("  shrinkage force of one run, Q %.2f kJ/mm: F = 0.335 x %.3f N/J x %.0f J/mm = %.1f kN" % (Q, WM_ALPHA_E_CRHO, Q * 1000, wm_shrink_force(Q) / 1000))
    S = rhs(120, 120, 6)
    d1 = wm_distortion(1.0, 2000.0, S["A"], S["Ix"], 60.0, n_runs=2)
    print("  RHS 120x120x6, 2 m, two runs Q 1.0 on one face (e 60 mm): F %.0f kN, shortening %.3f mm, bow %.2f mm" % (d1["F"] / 1000, d1["dL"], d1["bow"]))
    d2 = wm_distortion(1.0, 2000.0, S["A"], S["Ix"], 0.0, n_runs=4)
    print("  same, welds balanced on both faces (e 0): F %.0f kN, shortening %.3f mm, bow %.2f mm" % (d2["F"] / 1000, d2["dL"], d2["bow"]))
    Aw = wm_area_butt(10, 60, 2, 1.5, 1.5)
    print("  V-butt t 10: weld area %.0f mm2 -> transverse shrinkage ~ 0.18 A_w / t = %.2f mm" % (Aw, wm_transverse_shrink(Aw, 10)))

    print("\n## 7.4 PWHT, execution classes, NDT, ISO 5817")
    for t in (4, 10, 25, 50):
        r = wm_pwht(t)
        print("  t %2d mm: hold %3.0f min at %d-%d C, heating/cooling <= %.0f K/h above 400 C (%.1f h for 400 -> 600 -> 400)" % (
            t, r["hold_min"], r["T"][0], r["T"][1], r["rate_Kh"], r["time_400_600_h"]))
    for e in WM_EXC:
        print("  %s: %-55s level %-24s NDT: %s" % e)
    for m in WM_NDT:
        print("  %-32s finds %-48s | %-44s | %s" % m)
    print("  ISO 5817 (examples):            level B                  level C                          level D")
    for r in WM_ISO5817:
        print("  %-30s %-24s %-32s %s" % r)

    print("\n## 7.5 Weld metal and cost per metre (135 MAG, 3 kg/h unless stated)")
    rows = [("fillet a 3 (bracket post)", wm_area_fillet(3), 3.0), ("fillet a 4", wm_area_fillet(4), 3.0), ("fillet a 6", wm_area_fillet(6), 3.0),
            ("fillet a 8 (2 x a 4 would be cheaper)", wm_area_fillet(8), 4.5), ("V-butt t 6 (60 deg, gap 2)", wm_area_butt(6), 3.0),
            ("V-butt t 10", wm_area_butt(10), 3.0), ("X-butt t 20", wm_area_butt(20, both_sides=True), 4.5),
            ("I-butt t 4, SAW (receiver seam)", 2.0 * 4 + 0.7 * 8 * 1.5, 8.0)]
    for name, A, dep in rows:
        r = wm_cost_per_m(A, dep)
        print("  %-38s A %6.1f mm2, %.3f kg/m, arc %5.1f min/m, labour %5.1f min/m -> %6.2f EUR/m (labour %.2f, wire %.2f, gas %.2f, power %.2f)" % (
            name, A, r["kg_m"], r["arc_min_m"], r["labour_min_m"], r["total"], r["cost"]["labour"], r["cost"]["wire"], r["cost"]["gas"], r["cost"]["power"]))
    print("  fillet weld cost grows with a^2: a 6 instead of a 3 = %.1f x the cost; the bracket post (a 3, 320 mm) costs %.2f EUR" % (
        wm_cost_per_m(wm_area_fillet(6), 3)["total"] / wm_cost_per_m(wm_area_fillet(3), 3)["total"], 0.32 * wm_cost_per_m(wm_area_fillet(3), 3)["total"]))

    print("\n## 7.6 Fabrication of the air receiver (vessel.py default)")
    import vessel
    V = dict(vessel.DEFAULT)
    D = vessel.design(V)
    L_long = D["L_cyl"] / 1000
    L_circ = 2 * math.pi * (V["Di"] + D["t_shell"]) / 1000
    for s, m, k in WM_VESSEL_ROUTE:
        print("  %-24s %-92s %s" % (s, m, k))
    c1 = wm_cost_per_m(2.0 * D["t_shell"] + 0.7 * 8 * 1.5, 8.0)
    c2 = wm_cost_per_m(wm_area_butt(D["t_head"], 60, 1.5, 1.0, 1.0), 3.0)
    c3 = wm_cost_per_m(wm_area_fillet(4), 3.0)
    L_noz = math.pi * (V["nozzle"]["d"] + 2 * V["nozzle"]["tn"]) / 1000 * 4        # outlet, inlet, drain, safety-valve boss
    tot = L_long * c1["total"] + L_circ * c2["total"] + L_noz * c3["total"]
    print("  seams: longitudinal %.2f m (SAW I-butt, %.2f EUR/m), circumferential 2 x %.2f m (MAG V-butt on backing, %.2f EUR/m), 4 nozzles / bosses %.2f m (fillet a 4, %.2f EUR/m)" % (
        L_long, c1["total"], L_circ / 2, c2["total"], L_noz, c3["total"]))
    print("  welding cost of the receiver ~ %.0f EUR (arc time only); test pressure %.2f bar; PWHT not required for t %.0f mm P265GH (check EN 13445-4)" % (
        tot, vessel.test_pressure(V, D)["P_test_bar"], D["t_shell"]))
    print("\n## 7.7 Frame fabrication, inspection plan, failure modes")
    for s, r in WM_FRAME:
        print("  %-24s %s" % (s, r))
    for r in INSPECTION_PLAN_WELD:
        print("  %-38s %-52s %s" % r)
    for r in FAILURES_WELD:
        print("  %-30s | %-36s | %-48s | %s" % r)

    print("\n## 8.1 Verification (both self-tests)")
    print("  weld.py selftest and vessel.py selftest -> see chapter 8.1 of the guide; run: python weld.py selftest / python vessel.py selftest")

    print("\n## 8.2 Worked example: jib-crane arm root joint (weld_example.json)")
    E = wm_example_params()
    print("  task: %s" % E["name"])
    print("  variant                                                       util weld  util member  D toe     D throat  D shear   result")
    for lab, b, t, a, toe, thr in WM_EXAMPLE_VARIANTS:
        Q, S = wm_variant(E, b, t, a, toe, thr)
        F, M, Fa = S["fillet"], S["member"], S["fatigue"]
        print("  %-62s %8.3f %11.3f  %-9.3g %-9.3g %-9.3g %s" % (lab, F["util_dir"], M["util"], Fa["D"]["toe"], Fa["D"]["throat"], Fa["D"]["shear"],
                                                               "OK" if (F["util_dir"] <= 1 and M["util"] <= 1 and Fa["ok"]) else "NOT OK"))
    fat = FAT["load-carrying cruciform, full penetration"][0]
    for n in (1e5, 2e5, 4e5, 1e6):
        print("  allowed range (FAT %d, gamma_Mf %.2f) at %.0e cycles: %.1f MPa" % (fat, E["gamma_Mf"], n, fat * (2e6 / n) ** (1 / 3) / E["gamma_Mf"]))

def cmd_examples():
    P = dict(DEFAULT)
    print(report_text(P))
    print("\n## Throat thickness study (directional utilisation, same loads)")
    for a in (2.0, 2.5, 3.0, 4.0, 5.0):
        Q = dict(P, a=a)
        F = fillet_check(Q)
        print("  a %.1f mm: utilisation %.3f, rules %s" % (a, F["util_dir"], "OK" if all(v for k, v in F["rules"].items() if k.startswith("ok")) else "NOT OK"))
    print("\n## S-N curves: cycles at a range of 30 / 50 / 80 MPa")
    for name, (fat, m, kind) in FAT.items():
        print("  %-48s FAT %3d: " % (name, fat) + "  ".join("%s" % ("inf" if sn_cycles(r, fat, m, kind) == float("inf") else "%.3g" % sn_cycles(r, fat, m, kind)) for r in (30, 50, 80)))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-66s %s %s" % (name, "OK  " if cond else "FAIL", info))
    G = group_props([[0, 0, 0, 100]])
    chk("single line: I_x = L^3 / 12 about its centre", abs(G["Ix"] - 100 ** 3 / 12) < 1e-6 and abs(G["Iy"]) < 1e-9)
    G = group_props(DEFAULT["lines"])
    chk("box 80 x 80: I_x = 2 (b d^2 / 4) + d^3 / 6 (textbook formula)", abs(G["Ix"] - (2 * 80 * 40 ** 2 + 2 * 80 ** 3 / 12)) < 1e-6, "%.0f" % G["Ix"])
    # equilibrium: integrating the line forces gives the loads back
    loads = {"N": 1000.0, "Vx": 500.0, "Vy": -300.0, "Mx": 20.0, "My": -15.0, "T": 12.0}
    Gp, pts = line_forces(DEFAULT["lines"], loads, 401)
    seg = [Gp["lengths"][p["line"]] / 400 * (0.5 if i % 401 in (0, 400) else 1.0) for i, p in enumerate(pts)]
    N = sum(p["fn"] * s for p, s in zip(pts, seg))
    My = -sum(p["fn"] * (p["x"] - Gp["xc"]) * s for p, s in zip(pts, seg)) / 1000
    Tz = 0.0
    for p, s in zip(pts, seg):
        k = p["line"]
        x1, y1, x2, y2 = DEFAULT["lines"][k]
        L = Gp["lengths"][k]
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        fx, fy = p["fl"] * ux - p["ft"] * uy, p["fl"] * uy + p["ft"] * ux
        Tz += ((p["x"] - Gp["xc"]) * fy - (p["y"] - Gp["yc"]) * fx) * s
    chk("line forces integrate back to N, My and T (equilibrium)", abs(N / 1000 - 1) < 1e-3 and abs(My / -15 - 1) < 1e-3 and abs(Tz / 12000 - 1) < 1e-3,
        "N %.1f, My %.2f, T %.2f" % (N, My, Tz / 1000))
    st = STEELS["S355"]
    a = 5.0
    f_trans = st["fu"] / (st["beta_w"] * GAMMA_M2) / math.sqrt(2) * a     # pure transverse (normal) line force at util 1
    f_long = st["fu"] / (st["beta_w"] * GAMMA_M2) / math.sqrt(3) * a      # pure longitudinal
    chk("directional method: transverse fillet sqrt(3/2) = 1.22 x stronger than longitudinal", abs(f_trans / f_long - math.sqrt(1.5)) < 1e-12)
    chk("S-N: N(FAT) = 2e6; constant-amplitude limit 0.737 FAT at 5e6", abs(sn_cycles(80, 80) - 2e6) < 1e-6 and abs(sn_cycles(80 * 0.7368 + 1e-9, 80) / 5e6 - 1) < 1e-3)
    dD = 80 * 0.4 ** (1 / 3)
    chk("S-N: continuous at N_D and cut-off 0.405 FAT at 1e8", abs(sn_cycles(dD * 0.999, 80) / sn_cycles(dD * 1.001, 80) - 1) < 0.02 and sn_cycles(0.404 * 80, 80) == float("inf")
        and sn_cycles(0.406 * 80, 80) < 1.01e8)
    R = rhs(80, 80, 4)
    chk("RHS 80x80x4: A = 1216 mm2 (sharp corners)", abs(R["A"] - 1216) < 1e-9)
    chk("default bracket passes weld, member and fatigue checks", fillet_check(DEFAULT)["util_dir"] < 1 and member_check(DEFAULT)["util"] < 1 and fatigue(DEFAULT)["ok"])
    print("SELFTEST", "PASS" if all(ok) else "FAIL")
    return 0 if all(ok) else 1

def main(argv):
    if len(argv) < 2 or argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd = argv[1]
    if cmd == "params":
        print(json.dumps(DEFAULT, indent=2))
    elif cmd == "examples":
        cmd_examples()
    elif cmd in ("ch24", "ch56", "ch78") and ("demo_" + cmd) in globals():
        globals()["demo_" + cmd]()
    elif cmd == "selftest":
        return cmd_selftest()
    elif cmd == "run":
        P = dict(DEFAULT)
        out = "weld_out"
        if "--in" in argv:
            with open(argv[argv.index("--in") + 1], encoding="utf-8") as f:
                P.update(json.load(f))
        if "--out" in argv:
            out = argv[argv.index("--out") + 1]
        run(P, out)
    else:
        print("unknown command; see --help")
        return 2
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
