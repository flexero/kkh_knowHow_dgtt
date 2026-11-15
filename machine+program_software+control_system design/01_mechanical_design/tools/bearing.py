#!/usr/bin/env python3
"""M4 rolling bearing program - equivalent load, basic and modified life (ISO 281 style), lubrication (kappa),
contamination, reliability, static safety, variable loads (from M2 crank + M3 shaft), friction, fits and internal
clearance, catalogue selection. Guide: 04_rolling_bearings.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python bearing.py params                   default input (JSON) - copy, edit, use with --in
  python bearing.py run [--in p.json] [--out folder]   full calculation -> report.md, bearing.csv, *.svg
  python bearing.py examples                 worked examples of the guide
  python bearing.py selftest                 independent cross-checks (must print SELFTEST PASS)

All catalogue values are TYPICAL values of common bearing series (rounded) - check the current catalogue of your
supplier (SKF, Schaeffler, NSK, NTN, Timken, ...) before you buy. ISO 281:2007 formulas as implemented here must be
compared with the standard for design reports (marked 'check' in the guide). All default numbers are EXAMPLE values.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- chapter 2: catalogue (typical values)
#  name: type, d, D, B (mm), C, C0, Cu (kN), f0 (ball), e, Y (taper), n_lim (rpm, oil), mass kg
CATALOGUE = {
    "6005":   {"type": "ball", "d": 25, "D": 47, "B": 12, "C": 11.9, "C0": 6.55, "Cu": 0.275, "f0": 14.0, "n_lim": 14000, "m": 0.08},
    "6205":   {"type": "ball", "d": 25, "D": 52, "B": 15, "C": 14.8, "C0": 7.8, "Cu": 0.335, "f0": 14.0, "n_lim": 12000, "m": 0.13},
    "6305":   {"type": "ball", "d": 25, "D": 62, "B": 17, "C": 23.4, "C0": 11.6, "Cu": 0.49, "f0": 12.0, "n_lim": 10000, "m": 0.23},
    "6006":   {"type": "ball", "d": 30, "D": 55, "B": 13, "C": 13.8, "C0": 8.3, "Cu": 0.355, "f0": 15.0, "n_lim": 12000, "m": 0.12},
    "6206":   {"type": "ball", "d": 30, "D": 62, "B": 16, "C": 20.3, "C0": 11.2, "Cu": 0.475, "f0": 14.0, "n_lim": 10000, "m": 0.20},
    "6306":   {"type": "ball", "d": 30, "D": 72, "B": 19, "C": 29.6, "C0": 16.0, "Cu": 0.67, "f0": 13.0, "n_lim": 9000, "m": 0.35},
    "NU206":  {"type": "cyl_roller", "d": 30, "D": 62, "B": 16, "C": 44.0, "C0": 36.5, "Cu": 4.5, "n_lim": 11000, "m": 0.21},
    "NU306":  {"type": "cyl_roller", "d": 30, "D": 72, "B": 19, "C": 58.5, "C0": 48.0, "Cu": 6.2, "n_lim": 9500, "m": 0.37},
    "7206B":  {"type": "ang_ball40", "d": 30, "D": 62, "B": 16, "C": 23.8, "C0": 15.6, "Cu": 0.655, "n_lim": 9500, "m": 0.21},
    "30206":  {"type": "taper", "d": 30, "D": 62, "B": 17.25, "C": 40.2, "C0": 44.0, "Cu": 4.8, "e": 0.37, "Y": 1.6, "n_lim": 8500, "m": 0.23},
    "6207":   {"type": "ball", "d": 35, "D": 72, "B": 17, "C": 27.0, "C0": 15.3, "Cu": 0.655, "f0": 14.0, "n_lim": 8500, "m": 0.29},
    "NU207":  {"type": "cyl_roller", "d": 35, "D": 72, "B": 17, "C": 56.0, "C0": 48.0, "Cu": 6.1, "n_lim": 9500, "m": 0.31},
}

DEFAULT = {
    "name": "VC20 crankshaft main bearings (example) - loads from crank.py + shaft.py",
    "rpm": 1450.0,
    "bearing_A": "6206", "bearing_B": "6206",
    "use_crank_loads": True,                # True: loads over one revolution from crank.py through the shaft model
    "Fr_A_N": 1560.0, "Fa_A_N": 0.0,        # used when use_crank_loads is False (constant loads)
    "Fr_B_N": 1351.0, "Fa_B_N": 0.0,
    "Fa_external_N": 0.0,                   # axial load, taken by the locating bearing A
    "target_life_h": 20000.0,
    "reliability_pct": 90.0,
    "oil_VG": 100, "oil_temp_C": 80.0,      # splash-lubricated compressor oil (example)
    "cleanliness": "slight contamination",  # ISO 281 contamination class (typical e_c values)
    "shaft_fit_um": [2, 13],                # k5 on d 30: +2 ... +13 um (check ISO 286)
    "housing_fit_um": [0, 30],              # H7 on D 62 (clearance fit; hole 0 ... +30)
    "temp_diff_inner_outer_K": 10.0,        # inner ring warmer than outer ring in operation
    "clearance_class": "C3",
    "mu_friction": None,                    # None -> typical value per bearing type
    "lambda_load_cycle": 3.0,
}

# ---------------------------------------------------------------- chapter 3: equivalent load
_DG = [(0.172, 0.19, 2.30), (0.345, 0.22, 1.99), (0.689, 0.26, 1.71), (1.03, 0.28, 1.55), (1.38, 0.30, 1.45),
       (2.07, 0.34, 1.31), (3.45, 0.38, 1.15), (5.17, 0.42, 1.04), (6.89, 0.44, 1.00)]   # f0 Fa / C0 -> e, Y

def p_exponent(b):
    return 3.0 if "ball" in b["type"] else 10.0 / 3.0

def equivalent_dynamic(b, Fr, Fa):
    """P = X Fr + Y Fa (ISO 281 style factors).
    ball (deep groove): e, Y interpolated from f0 Fa/C0 (single row, normal clearance); X = 0.56 when Fa/Fr > e.
    ang_ball40: Fa/Fr <= 1.14 -> P = Fr, else 0.35 Fr + 0.57 Fa.  taper: Fa/Fr <= e -> P = Fr, else 0.4 Fr + Y Fa.
    cyl_roller (NU): P = Fr (no axial load)."""
    t = b["type"]
    if Fa <= 0 or t == "cyl_roller":
        return {"P": Fr, "X": 1.0, "Y": 0.0, "e": None}
    if t == "ball":
        q = b["f0"] * Fa / (b["C0"] * 1000)
        pts = _DG
        if q <= pts[0][0]:
            e, Y = pts[0][1], pts[0][2]
        elif q >= pts[-1][0]:
            e, Y = pts[-1][1], pts[-1][2]
        else:
            for (q1, e1, y1), (q2, e2, y2) in zip(pts, pts[1:]):
                if q1 <= q <= q2:
                    t_ = (q - q1) / (q2 - q1)
                    e, Y = e1 + t_ * (e2 - e1), y1 + t_ * (y2 - y1)
                    break
        if Fa / Fr <= e:
            return {"P": Fr, "X": 1.0, "Y": 0.0, "e": e}
        return {"P": 0.56 * Fr + Y * Fa, "X": 0.56, "Y": Y, "e": e}
    if t == "ang_ball40":
        if Fa / Fr <= 1.14:
            return {"P": Fr, "X": 1.0, "Y": 0.0, "e": 1.14}
        return {"P": 0.35 * Fr + 0.57 * Fa, "X": 0.35, "Y": 0.57, "e": 1.14}
    if t == "taper":
        if Fa / Fr <= b["e"]:
            return {"P": Fr, "X": 1.0, "Y": 0.0, "e": b["e"]}
        return {"P": 0.4 * Fr + b["Y"] * Fa, "X": 0.4, "Y": b["Y"], "e": b["e"]}
    raise ValueError("unknown type " + t)

def equivalent_static(b, Fr, Fa):
    """P0 = X0 Fr + Y0 Fa, not smaller than Fr. ball: 0.6 / 0.5; ang_ball40: 0.5 / 0.26; taper: 0.5 / 0.22 cot(alpha)
    ~ 0.5 / (0.5 Y) approx; cyl roller: Fr."""
    t = b["type"]
    if t == "ball":
        P0 = 0.6 * Fr + 0.5 * Fa
    elif t == "ang_ball40":
        P0 = 0.5 * Fr + 0.26 * Fa
    elif t == "taper":
        P0 = 0.5 * Fr + 0.5 * b["Y"] * 0.55 * Fa      # Y0 ~ 0.55 Y (typical catalogue relation, check)
    else:
        P0 = Fr
    return max(P0, Fr)

# ---------------------------------------------------------------- chapter 4: life
A1 = [(90, 1.0), (95, 0.64), (96, 0.55), (97, 0.47), (98, 0.37), (99, 0.25), (99.2, 0.22), (99.4, 0.19),
      (99.6, 0.16), (99.8, 0.12), (99.9, 0.093), (99.92, 0.087), (99.94, 0.080), (99.95, 0.077)]

def a1(rel):
    """Life modification factor for reliability (ISO 281:2007 table, Weibull slope 1.5, t0 offset)."""
    if rel <= 90:
        return 1.0
    for (r1, v1), (r2, v2) in zip(A1, A1[1:]):
        if r1 <= rel <= r2:
            return v1 + (rel - r1) / (r2 - r1) * (v2 - v1)
    return A1[-1][1]

def basic_life(C_kN, P_N, p, rpm):
    """L10 = (C/P)^p million revolutions, L10h = 1e6 L10 / (60 n) hours."""
    L10 = (C_kN * 1000 / P_N) ** p
    return L10, L10 * 1e6 / (60 * rpm)

def nu_from_VG(VG, T):
    """Kinematic viscosity at temperature T (mm2/s) by Ubbelohde-Walther through the 40 C (= VG) and 100 C points
    of a mineral oil with VI ~ 95-100 (typical nu100 values; check the oil data sheet)."""
    nu100 = {32: 5.4, 46: 6.8, 68: 8.7, 100: 11.1, 150: 14.5, 220: 18.9, 320: 23.9, 460: 30.5}[int(VG)]
    def W(nu):
        return math.log10(math.log10(nu + 0.7))
    T1, T2 = math.log10(313.15), math.log10(373.15)
    B = (W(VG) - W(nu100)) / (T2 - T1)
    A = W(VG) + B * T1
    w = A - B * math.log10(T + 273.15)
    return 10 ** (10 ** w) - 0.7

def nu1_rated(rpm, dm):
    """Rated viscosity nu1 (mm2/s) for adequate lubrication (ISO 281:2007):
    n < 1000 rpm: nu1 = 45000 n^-0.83 dm^-0.5 ; n >= 1000 rpm: nu1 = 4500 n^-0.5 dm^-0.5 (dm mm)."""
    if rpm < 1000:
        return 45000 * rpm ** -0.83 * dm ** -0.5
    return 4500 * rpm ** -0.5 * dm ** -0.5

EC = {   # typical e_c for dm < 100 mm (ISO 281 table ranges, mid values; check the standard / ISO 4406 method)
    "extreme cleanliness": 1.0, "high cleanliness": 0.7, "normal cleanliness": 0.55, "slight contamination": 0.4,
    "typical contamination": 0.2, "severe contamination": 0.05, "very severe contamination": 0.0}

def a_iso(kappa, ecCuP, kind="ball"):
    """Life modification factor a_ISO (ISO 281:2007 form, radial bearings). kappa limited to 0.1 ... 4,
    a_ISO <= 50. ball: 0.1 [1 - (2.5671 - k1/kappa^e1)^0.83 (ecCu/P)^(1/3)]^-9.3 ;
    roller: 0.1 [1 - (1.5859 - k1/kappa^e1) (ecCu/P)^0.4]^-9.185   (k1, e1 by kappa range; check the standard)."""
    k = max(0.1, min(4.0, kappa))
    if kind == "ball":
        if k < 0.4:
            k1, e1 = 2.2649, 0.054381
        elif k < 1:
            k1, e1 = 1.9987, 0.19087
        else:
            k1, e1 = 1.9987, 0.071739
        base = max(0.0, 2.5671 - k1 / k ** e1)
        inner = base ** 0.83 * ecCuP ** (1 / 3)
        expo = -9.3
    else:
        if k < 0.4:
            k1, e1 = 1.3993, 0.054381
        elif k < 1:
            k1, e1 = 1.2348, 0.19087
        else:
            k1, e1 = 1.2348, 0.071739
        base = max(0.0, 1.5859 - k1 / k ** e1)
        inner = base * ecCuP ** 0.4
        expo = -9.185
    if inner >= 1:
        return 50.0
    return min(50.0, 0.1 * (1 - inner) ** expo)

def modified_life(b, P_N, rpm, P):
    """L_nm = a1 a_ISO L10 (hours)."""
    p = p_exponent(b)
    L10, L10h = basic_life(b["C"], P_N, p, rpm)
    dm = (b["d"] + b["D"]) / 2
    nu = nu_from_VG(P["oil_VG"], P["oil_temp_C"])
    nu1 = nu1_rated(rpm, dm)
    kappa = nu / nu1
    ec = EC[P["cleanliness"]]
    x = ec * b["Cu"] * 1000 / P_N
    aI = a_iso(kappa, x, "ball" if "ball" in b["type"] else "roller")
    A = a1(P["reliability_pct"])
    return {"L10_Mrev": L10, "L10h": L10h, "dm": dm, "nu": nu, "nu1": nu1, "kappa": kappa, "ec": ec,
            "ecCu_P": x, "a_iso": aI, "a1": A, "Lnmh": A * aI * L10h}

# ---------------------------------------------------------------- chapter 5: variable loads (M2 -> M3 -> M4)
def loads_over_revolution(step_deg=2.0):
    """Bearing reactions over one crank revolution: crank-pin force vector F_pin(theta) from crank.py placed on the
    M3 shaft model (pin plane at x = torque_out_x) plus the constant belt load; reactions by shaft.reactions().
    Returns theta list and (Fr_A, Fr_B) magnitudes [N]."""
    import crank
    import shaft
    R = crank.compute_all()
    P = dict(shaft.DEFAULT)
    belt = [f for f in P["forces"] if "belt" in f[3]][0]
    every = max(1, int(round(step_deg / R["P"]["step_deg"])))
    th, FA, FB = [], [], []
    for r in R["rows"][::every]:
        fx, fy = r["F_pin"]                      # frame axes: x horizontal, y vertical (crank.py)
        forces = [belt, [P["torque_out_x"], fy, fx, "pin"]]      # shaft plane y = vertical, z = horizontal
        Rr = shaft.reactions(dict(P, forces=forces))
        th.append(math.degrees(r["theta"]))
        FA.append(math.hypot(Rr["y"][0], Rr["z"][0]))
        FB.append(math.hypot(Rr["y"][1], Rr["z"][1]))
    return th, FA, FB

def mean_load(F, p=3.0):
    """Equivalent constant load for a load varying over one revolution at constant speed: P_m = (mean F^p)^(1/p).
    (Derived from equal damage: L ~ (C/P)^p, damage per revolution ~ F^p.)"""
    return (sum(f ** p for f in F) / len(F)) ** (1 / p)

def duty_cycle_mean(cases):
    """Several operating states: cases = [(P_N, rpm, time share)]. P_m = (sum P^p n q / sum n q)^(1/p) with p = 3,
    n_m = sum n q. Returns P_m, n_m."""
    p = 3.0
    num = sum(Pi ** p * n * q for Pi, n, q in cases)
    den = sum(n * q for Pi, n, q in cases)
    return (num / den) ** (1 / p), den / sum(q for *_, q in cases)

# ---------------------------------------------------------------- chapter 6: friction, fits, clearance
MU = {"ball": 0.0015, "ang_ball40": 0.0020, "cyl_roller": 0.0011, "taper": 0.0018}   # typical (check catalogue)

def friction(b, P_N, rpm, mu=None):
    """Simple friction moment M = 0.5 mu P d (N mm) and power loss N = M w."""
    m = MU[b["type"]] if mu is None else mu
    M = 0.5 * m * P_N * b["d"]
    return {"mu": m, "M_Nmm": M, "N_W": M / 1000 * rpm * 2 * math.pi / 60}

CLEARANCE = {   # radial internal clearance of deep groove ball bearings, d over 24 to 30 mm (um, ISO 5753 typical)
    "C2": (1, 11), "CN": (5, 20), "C3": (13, 28), "C4": (23, 41)}

def operating_clearance(b, P):
    """Operating radial clearance = initial - fit reduction - thermal reduction.
    Inner ring expansion ~ 0.8 x effective interference (solid steel shaft), outer ring contraction ~ 0 for a clearance
    housing fit; thermal: alpha (T_i - T_o) dm (both rings steel). Effective interference ~ 0.9 x measured (smoothing)."""
    lo, hi = CLEARANCE[P["clearance_class"]]
    alpha = 11.5e-6
    fit = [0.8 * 0.9 * u for u in P["shaft_fit_um"]]
    th = alpha * P["temp_diff_inner_outer_K"] * (b["d"] + b["D"]) / 2 * 1000
    return {"initial": (lo, hi), "fit_reduction": fit, "thermal": th,
            "min": lo - fit[1] - th, "max": hi - fit[0] - th}

# ---------------------------------------------------------------- chapter 7: selection
def select(Fr, Fa, rpm, P, d=None, types=("ball", "cyl_roller", "ang_ball40", "taper")):
    """Evaluate every catalogue bearing of bore d: P, L10h, L_nm, s0; mark those meeting the target life."""
    out = []
    for name, b in CATALOGUE.items():
        if d and b["d"] != d:
            continue
        if b["type"] not in types:
            continue
        if b["type"] == "cyl_roller" and Fa > 0:
            continue
        eq = equivalent_dynamic(b, Fr, Fa)
        ml = modified_life(b, eq["P"], rpm, P)
        s0 = b["C0"] * 1000 / equivalent_static(b, Fr, Fa)
        out.append({"name": name, "type": b["type"], "D": b["D"], "B": b["B"], "m": b["m"], "P": eq["P"],
                    "L10h": ml["L10h"], "Lnmh": ml["Lnmh"], "a_iso": ml["a_iso"], "kappa": ml["kappa"], "s0": s0,
                    "ok": ml["Lnmh"] >= P["target_life_h"] and s0 >= 1.0 and rpm <= b["n_lim"]})
    return sorted(out, key=lambda r: (not r["ok"], r["m"]))

# ---------------------------------------------------------------- analysis of the arrangement
def analyse(P):
    res = {}
    if P["use_crank_loads"]:
        th, FA, FB = loads_over_revolution()
        res["theta"], res["FA"], res["FB"] = th, FA, FB
    for side in ("A", "B"):
        b = CATALOGUE[P["bearing_" + side]]
        p = p_exponent(b)
        if P["use_crank_loads"]:
            F = res["F" + side]
            Fr = mean_load(F, p)
            Fr_max = max(F)
        else:
            Fr = Fr_max = P["Fr_%s_N" % side]
        Fa = (P["Fa_%s_N" % side] + (P["Fa_external_N"] if side == "A" else 0.0))
        eq = equivalent_dynamic(b, Fr, Fa)
        ml = modified_life(b, eq["P"], P["rpm"], P)
        P0 = equivalent_static(b, Fr_max * P.get("static_factor", 1.5), Fa)
        res[side] = {"name": P["bearing_" + side], "b": b, "Fr_eq": Fr, "Fr_max": Fr_max, "Fa": Fa, "eq": eq, "life": ml,
                     "s0": b["C0"] * 1000 / P0, "friction": friction(b, eq["P"], P["rpm"], P["mu_friction"]),
                     "clearance": operating_clearance(b, P) if b["type"] == "ball" else None,
                     "speed_ok": P["rpm"] <= b["n_lim"], "min_load_ok": Fr_max >= 0.01 * b["C"] * 1000}
    return res

def report_text(P, res=None):
    res = res or analyse(P)
    L = ["# Rolling bearing report - %s\n" % P["name"],
         "Speed %.0f rpm, target life %.0f h, reliability %.1f %%, oil ISO VG %d at %.0f C, %s" % (
             P["rpm"], P["target_life_h"], P["reliability_pct"], P["oil_VG"], P["oil_temp_C"], P["cleanliness"])]
    if P["use_crank_loads"]:
        L.append("Loads: over one revolution from crank.py through shaft.py (cubic / 10/3 mean).")
    for side in ("A", "B"):
        r = res[side]
        b, ml, eq = r["b"], r["life"], r["eq"]
        L += ["\n## Bearing %s: %s (%s, d %d, D %d, B %s, C %.1f kN, C0 %.1f kN, Cu %.3f kN)" % (
                  side, r["name"], b["type"], b["d"], b["D"], b["B"], b["C"], b["C0"], b["Cu"]),
              "- radial load: equivalent %.0f N, max %.0f N; axial %.0f N -> P = %.0f N (X %.2f, Y %.2f)" % (
                  r["Fr_eq"], r["Fr_max"], r["Fa"], eq["P"], eq["X"], eq["Y"]),
              "- basic life L10 %.0f Mrev = %.0f h" % (ml["L10_Mrev"], ml["L10h"]),
              "- lubrication: nu %.1f mm2/s, nu1 %.1f mm2/s -> kappa %.2f; e_c %.2f, e_c Cu/P %.4f -> a_ISO %.2f; a1 %.2f" % (
                  ml["nu"], ml["nu1"], ml["kappa"], ml["ec"], ml["ecCu_P"], ml["a_iso"], ml["a1"]),
              "- modified life L_nm %.0f h (target %.0f h) -> %s" % (ml["Lnmh"], P["target_life_h"],
                                                                  "OK" if ml["Lnmh"] >= P["target_life_h"] else "NOT OK"),
              "- static safety s0 %.1f (peak x 1.5); speed %s; minimum load %s" % (
                  r["s0"], "OK" if r["speed_ok"] else "TOO HIGH", "OK" if r["min_load_ok"] else "too low (skidding risk)"),
              "- friction mu %.4f: M %.1f N mm, loss %.2f W" % (r["friction"]["mu"], r["friction"]["M_Nmm"], r["friction"]["N_W"])]
        if r["clearance"]:
            c = r["clearance"]
            L.append("- internal clearance %s %d...%d um - fit %.1f...%.1f - thermal %.1f -> operating %.1f ... %.1f um" % (
                P["clearance_class"], c["initial"][0], c["initial"][1], c["fit_reduction"][0], c["fit_reduction"][1],
                c["thermal"], c["min"], c["max"]))
    return "\n".join(L)

def run(P, out):
    from crank import _svg_line
    os.makedirs(out, exist_ok=True)
    res = analyse(P)
    svgs = {}
    if P["use_crank_loads"]:
        with open(os.path.join(out, "bearing.csv"), "w", encoding="utf-8") as f:
            f.write("theta_deg,Fr_A_N,Fr_B_N\n")
            for t, a, b in zip(res["theta"], res["FA"], res["FB"]):
                f.write("%.1f,%.2f,%.2f\n" % (t, a, b))
        svgs["loads.svg"] = _svg_line([("bearing A", list(zip(res["theta"], res["FA"])), "#1f77b4"),
                                       ("bearing B", list(zip(res["theta"], res["FB"])), "#d62728")],
                                      title="Radial bearing loads over one revolution [N]", xl="crank angle [deg]", yl="N")
    sel = select(res["A"]["Fr_eq"], res["A"]["Fa"], P["rpm"], P, d=CATALOGUE[P["bearing_A"]]["d"])
    svgs["selection.svg"] = _svg_line([("L_nm [h]", [(i, r["Lnmh"]) for i, r in enumerate(sel)], "#2ca02c"),
                                       ("target", [(0, P["target_life_h"]), (len(sel) - 1, P["target_life_h"])], "#d62728")],
                                      title="Modified life of the candidates (bearing A load): " + ", ".join(r["name"] for r in sel),
                                      xl="candidate", yl="h")
    for k, v in svgs.items():
        with open(os.path.join(out, k), "w", encoding="utf-8") as f:
            f.write(v)
    rep = report_text(P, res)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    print(rep)
    print("written: report.md, bearing.csv,", ", ".join(svgs), "->", out)


# ================================================================ added with guide chapters (ch24)
def catalogue_table(d=None):
    """Rows of the catalogue (typical values) for one bore d (or all): name, type, D, B, C, C0, Cu, C/C0, n_lim."""
    rows = []
    for name, b in CATALOGUE.items():
        if d and b["d"] != d:
            continue
        rows.append((name, b["type"], b["d"], b["D"], b["B"], b["C"], b["C0"], b["Cu"], b["C"] / b["C0"], b["n_lim"]))
    return rows


def pair_axial(FrA, FrB, Ka, Y, arrangement="O"):
    """Axial loads in a pair of tapered roller bearings (same Y), simplified catalogue rules (check the maker).
    Induced (internal) axial force of each bearing: F_ad = 0.5 F_r / Y.
    Ka = external axial load, positive when it pushes the shaft towards bearing B (B takes Ka directly).
    The arrangement (X = face-to-face, O = back-to-back) decides which side each bearing supports; with the sign
    convention above both reduce to the same two cases:
      case 1: F_adA + Ka >= F_adB  ->  Fa_A = F_adA,        Fa_B = F_adA + Ka
      case 2: F_adA + Ka <  F_adB  ->  Fa_A = F_adB - Ka,   Fa_B = F_adB
    Returns induced forces, axial loads and which case applies."""
    fa, fb = 0.5 * FrA / Y, 0.5 * FrB / Y
    if fa + Ka >= fb:
        FaA, FaB, case = fa, fa + Ka, 1
    else:
        FaA, FaB, case = fb - Ka, fb, 2
    return {"F_adA": fa, "F_adB": fb, "Fa_A": FaA, "Fa_B": FaB, "case": case, "arrangement": arrangement}


def a1_formula(R):
    """a1 from the Weibull model behind ISO 281:2007 (slope 1.5, life offset 0.05 of L10):
    a1 = 0.95 (ln(1/R) / ln(1/0.9))^(1/1.5) + 0.05, R as fraction."""
    return 0.95 * (math.log(1 / R) / math.log(1 / 0.9)) ** (1 / 1.5) + 0.05


def system_life(lives, e=1.5):
    """Life of a system of bearings in series (all must survive), same Weibull slope e:
    L_sys = (sum L_i^-e)^(-1/e)."""
    return sum(L ** -e for L in lives) ** (-1 / e)


def lp_exponent(c=31 / 3, h=7 / 3, e=10 / 9, contact="point"):
    """Lundberg-Palmgren life exponent from the Weibull fatigue model ln(1/S) ~ tau0^c N^e V / z0^h.
    point contact: p = (c - h + 2) / (3 e)   line contact: p = (c - h + 1) / (2 e)."""
    if contact == "point":
        return (c - h + 2) / (3 * e)
    return (c - h + 1) / (2 * e)


def compressor_duty(P_loaded, P_unloaded, rpm=1450.0, q_loaded=0.55, q_unloaded=0.15, q_off=0.30):
    """Compressor duty: loaded running, unloaded running (belt + inertia only), stopped (no revolutions).
    Mean load (cubic) and mean speed over the clock time; life in clock hours.
    Returns P_m (running states only), n_m (clock mean), L10h of a 6206 over clock time."""
    cases = [(P_loaded, rpm, q_loaded), (P_unloaded, rpm, q_unloaded)]
    Pm, n_run = duty_cycle_mean(cases)
    n_clock = rpm * (q_loaded + q_unloaded) / (q_loaded + q_unloaded + q_off)
    b = CATALOGUE["6206"]
    L10, _ = basic_life(b["C"], Pm, 3.0, rpm)
    L10h_clock = L10 * 1e6 / (60 * n_clock)
    return {"P_m": Pm, "n_running": n_run, "n_clock": n_clock, "L10_Mrev": L10, "L10h_clock": L10h_clock,
            "L10h_running": L10 * 1e6 / (60 * rpm)}


def load_sensitivity(factor, p=3.0):
    """Life ratio when the load is multiplied by factor: L2/L1 = factor^-p; and the factor that halves life."""
    return factor ** -p, 2 ** (1 / p)


def demo_ch24():
    print("== 2 catalogue rows d = 30 (typical values, check catalogue)")
    print("name    type        d   D   B      C kN  C0 kN  Cu kN  C/C0  n_lim")
    for r in catalogue_table(30):
        print("%-7s %-10s %3d %3d %5s %6.1f %6.1f %6.3f %5.2f %6d" % r)
    print("== 3 equivalent load 6206, Fr 1500 N")
    for Fa in (0, 200, 500, 1000):
        e = equivalent_dynamic(CATALOGUE["6206"], 1500, Fa)
        P0 = equivalent_static(CATALOGUE["6206"], 1500, Fa)
        print("  Fa %4d: P %.0f N, P0 %.0f N, s0 = C0/P0 = %.2f" % (Fa, e["P"], P0, CATALOGUE["6206"]["C0"] * 1000 / P0))
    print("== 3 tapered pair 30206 (Y 1.6): FrA 2000, FrB 1200 N")
    for Ka in (0, 300, -500):
        r = pair_axial(2000, 1200, Ka, 1.6)
        eA = equivalent_dynamic(CATALOGUE["30206"], 2000, r["Fa_A"])
        eB = equivalent_dynamic(CATALOGUE["30206"], 1200, r["Fa_B"])
        print("  Ka %5d: F_adA %.1f F_adB %.1f -> case %d: Fa_A %.1f, Fa_B %.1f N; P_A %.0f, P_B %.0f N" % (
            Ka, r["F_adA"], r["F_adB"], r["case"], r["Fa_A"], r["Fa_B"], eA["P"], eB["P"]))
    print("== 3 loads over one revolution (M2 -> M3 -> M4)")
    th, FA, FB = loads_over_revolution()
    for name, F in (("A", FA), ("B", FB)):
        print("  %s: min %.0f, max %.0f, arithmetic mean %.0f, cubic mean %.0f, 10/3 mean %.0f N" % (
            name, min(F), max(F), sum(F) / len(F), mean_load(F, 3), mean_load(F, 10 / 3)))
    k = FA.index(max(FA))
    print("  peak of A at theta %.0f deg" % th[k])
    print("== 3 compressor duty (loaded P = 1211 N, unloaded 450 N, off 30 %)")
    d = compressor_duty(1211.0, 450.0)
    print("  P_m %.0f N, n running %.0f, n clock %.1f rpm, L10 %.0f Mrev = %.0f h running = %.0f h clock" % (
        d["P_m"], d["n_running"], d["n_clock"], d["L10_Mrev"], d["L10h_running"], d["L10h_clock"]))
    print("== 4 Lundberg-Palmgren exponents: point %.3f, line %.3f (ISO uses 10/3 = %.3f for rollers)" % (
        lp_exponent(), lp_exponent(contact="line"), 10 / 3))
    print("== 4 a1: table vs Weibull formula")
    for R in (90, 95, 96, 97, 98, 99, 99.5, 99.9, 99.95):
        print("  R %.2f %%: table %.3f, formula %.3f" % (R, a1(R), a1_formula(R / 100)))
    print("== 4 system life: two main bearings L10h 54179 and 146302 h -> %.0f h; + 2 conrod bearings 30000 h each -> %.0f h" % (
        system_life([54179, 146302]), system_life([54179, 146302, 30000, 30000])))
    b = CATALOGUE["6206"]
    L10, L10h = basic_life(b["C"], 1211, 3, 1450)
    print("== 4 6206, P 1211 N, 1450 rpm: C/P %.2f, L10 %.0f Mrev, L10h %.0f h" % (b["C"] * 1000 / 1211, L10, L10h))
    r, f = load_sensitivity(1.26)
    print("== 4 load +26 %% -> life x %.3f; load factor that halves life %.3f; +10 %% load -> life x %.3f; roller +10 %% -> x %.3f" % (
        r, f, load_sensitivity(1.1)[0], load_sensitivity(1.1, 10 / 3)[0]))
    ml = modified_life(b, 1211, 1450, DEFAULT)
    print("== 4 modified life 6206: kappa %.2f, ecCu/P %.4f, a_ISO %.2f, L_nm %.0f h; at 99 %% reliability %.0f h" % (
        ml["kappa"], ml["ecCu_P"], ml["a_iso"], ml["Lnmh"], ml["Lnmh"] * a1(99)))
    for cl in ("normal cleanliness", "typical contamination", "severe contamination"):
        m2 = modified_life(b, 1211, 1450, dict(DEFAULT, cleanliness=cl))
        print("  %s: e_c %.2f -> a_ISO %.2f, L_nm %.0f h" % (cl, m2["ec"], m2["a_iso"], m2["Lnmh"]))
    for T in (60, 100):
        m3 = modified_life(b, 1211, 1450, dict(DEFAULT, oil_temp_C=T))
        print("  oil %d C: nu %.1f, kappa %.2f, a_ISO %.2f, L_nm %.0f h" % (T, m3["nu"], m3["kappa"], m3["a_iso"], m3["Lnmh"]))

# ================================================================ added with guide chapters (ch56)
# ---------------------------------------------------------------- 5.1 internal geometry and contact load
GEOM_6206 = {"Z": 9, "Dw": 9.525, "dm": 46.0, "f_i": 0.52, "f_o": 0.53, "alpha_deg": 0.0}   # typical, check maker

def q_max(Fr, Z, alpha_deg=0.0):
    """Stribeck: load on the most loaded ball Q_max ~ 5 Fr / (Z cos alpha) (radial bearing, small clearance)."""
    return 5.0 * Fr / (Z * math.cos(math.radians(alpha_deg)))

def contact_radii(g, race="inner"):
    """Equivalent radii of ball-raceway contact [mm]. Rolling direction x: ball r = Dw/2 against the raceway
    radius (dm - Dw)/2 (inner, convex) or (dm + Dw)/2 (outer, concave). Transverse y: ball against the groove
    radius f Dw (concave). 1/Rx = 1/r +- 1/R_race, 1/Ry = 1/r - 1/(f Dw)."""
    r = g["Dw"] / 2
    if race == "inner":
        Rr = (g["dm"] - g["Dw"]) / 2
        Rx = 1 / (1 / r + 1 / Rr)
        f = g["f_i"]
    else:
        Rr = (g["dm"] + g["Dw"]) / 2
        Rx = 1 / (1 / r - 1 / Rr)
        f = g["f_o"]
    Ry = 1 / (1 / r - 1 / (f * g["Dw"]))
    return Rx, Ry

def hertz_ellipse(Q, Rx, Ry, E=210000.0, nu=0.3):
    """Elliptical Hertz contact, Hamrock-Brewe approximations:
    k = 1.0339 (Ry/Rx)^0.636, Ee = 1.0003 + 0.5968 Rx/Ry, R = 1/(1/Rx + 1/Ry), E' = E/(1 - nu^2) (two steels),
    a = (6 k^2 Ee Q R/(pi E'))^(1/3), b = (6 Ee Q R/(pi k E'))^(1/3), p_max = 3 Q/(2 pi a b).  Units N, mm, MPa."""
    k = 1.0339 * (Ry / Rx) ** 0.636
    Ee = 1.0003 + 0.5968 * Rx / Ry
    R = 1 / (1 / Rx + 1 / Ry)
    Ep = E / (1 - nu ** 2)
    a = (6 * k ** 2 * Ee * Q * R / (math.pi * Ep)) ** (1 / 3)
    b = (6 * Ee * Q * R / (math.pi * k * Ep)) ** (1 / 3)
    return {"k": k, "a": a, "b": b, "p_max": 3 * Q / (2 * math.pi * a * b), "Ep": Ep}

# ---------------------------------------------------------------- 5.2 EHL film thickness
def entrainment_speed(g, rpm):
    """Mean rolling (entrainment) speed for a rotating inner ring and fixed outer ring:
    u = w (dm^2 - Dw^2) / (4 dm)  [m/s]  (w rad/s, lengths in m)."""
    w = rpm * 2 * math.pi / 60
    dm, Dw = g["dm"] / 1000, g["Dw"] / 1000
    return w * (dm ** 2 - Dw ** 2) / (4 * dm)

def hamrock_dowson(Q, Rx, Ry, u, nu_mm2s, rho=870.0, alpha_p=2.0e-8, E=210000.0, nu=0.3):
    """Minimum film thickness (Hamrock-Dowson 1977, isothermal):
    H_min = 3.63 U^0.68 G^0.49 W^-0.073 (1 - exp(-0.68 k)),  h_min = H_min Rx.
    U = eta0 u/(E' Rx), G = alpha E', W = Q/(E' Rx^2), k = 1.0339 (Ry/Rx)^0.636.  SI inside, returns um."""
    Ep = E * 1e6 / (1 - nu ** 2)
    Rxm = Rx / 1000
    eta0 = nu_mm2s * 1e-6 * rho
    U = eta0 * u / (Ep * Rxm)
    G = alpha_p * Ep
    W = Q / (Ep * Rxm ** 2)
    k = 1.0339 * (Ry / Rx) ** 0.636
    H = 3.63 * U ** 0.68 * G ** 0.49 * W ** -0.073 * (1 - math.exp(-0.68 * k))
    return {"U": U, "G": G, "W": W, "H_min": H, "h_min_um": H * Rxm * 1e6, "eta0_Pas": eta0}

def film_parameter(h_um, Rq_ball=0.04, Rq_race=0.07):
    """Lambda = h_min / sqrt(Rq1^2 + Rq2^2) (Rq um, typical ground/superfinished values - check).
    Lambda < 1 boundary, 1...3 mixed, > 3 full film."""
    return h_um / math.sqrt(Rq_ball ** 2 + Rq_race ** 2)

# ---------------------------------------------------------------- 5.3 oil choice
def min_VG_for_kappa(target_kappa, rpm, dm, T):
    """Smallest ISO VG grade whose viscosity at T gives kappa >= target. Returns (VG, nu, kappa) or None."""
    nu1 = nu1_rated(rpm, dm)
    for VG in (32, 46, 68, 100, 150, 220, 320, 460):
        nu = nu_from_VG(VG, T)
        if nu / nu1 >= target_kappa:
            return VG, nu, nu / nu1
    return None

def life_vs_cleanliness(name, P_N, rpm, base=None):
    """L_nm of one bearing for every contamination class of EC (other inputs from DEFAULT)."""
    out = []
    for cls in EC:
        Q = dict(base or DEFAULT, cleanliness=cls)
        out.append((cls, modified_life(CATALOGUE[name], P_N, rpm, Q)))
    return out

def life_vs_temperature(name, P_N, rpm, VG=100, temps=(60, 70, 80, 90, 100)):
    out = []
    for T in temps:
        Q = dict(DEFAULT, oil_VG=VG, oil_temp_C=T)
        out.append((T, modified_life(CATALOGUE[name], P_N, rpm, Q)))
    return out

def relub_interval_rule(n, dm, kind="ball"):
    """Rough grease relubrication interval at 70 C (one published-style approximation, for orientation only):
    t_f ~ K / (n sqrt(d)) - 4 d  [h], K = 14e6 ball, 7e6 cyl. roller, 1e6 taper (d = bore mm). Halve every +15 K.
    Check the bearing maker's relubrication diagram before use."""
    K = {"ball": 14e6, "cyl_roller": 7e6, "taper": 1e6}[kind]
    d = dm
    return K / (n * math.sqrt(d)) - 4 * d

# ---------------------------------------------------------------- 6.1 static safety, speed factor
S0_RECOMMENDED = {"smooth, no vibration": 1.0, "normal": 1.5, "shock loads": 2.0, "quiet running required": 2.0}

def static_check(name, Fr_peak, Fa=0.0):
    b = CATALOGUE[name]
    P0 = equivalent_static(b, Fr_peak, Fa)
    return {"P0": P0, "s0": b["C0"] * 1000 / P0}

def speed_factor(rpm, dm):
    """n dm [mm/min]. Typical upper limits for standard deep groove ball bearings (check catalogue):
    grease ~ 0.5e6, oil bath / splash ~ 0.6e6, oil jet / mist ~ 1e6."""
    return rpm * dm

# ---------------------------------------------------------------- 6.2 friction (Palmgren)
def palmgren_friction(name, Fr, rpm, nu, f0=2.0, Fa=0.0):
    """M = M0 + M1 (N mm). M0 (speed, oil): 1e-7 f0 (nu n)^(2/3) dm^3 if nu n >= 2000, else 160e-7 f0 dm^3.
    M1 (load): f1 P1 dm with f1 = 0.0007 (P0/C0)^0.5 (deep groove, typical z = 0.0006 ... 0.0009, y = 0.5),
    P1 = max(Fr, 3 Fa - 0.1 Fr). f0 = 1.5 ... 2 oil splash, 4 oil bath (typical - check)."""
    b = CATALOGUE[name]
    dm = (b["d"] + b["D"]) / 2
    vn = nu * rpm
    M0 = 1e-7 * f0 * vn ** (2 / 3) * dm ** 3 if vn >= 2000 else 160e-7 * f0 * dm ** 3
    P0 = equivalent_static(b, Fr, Fa)
    f1 = 0.0007 * (P0 / (b["C0"] * 1000)) ** 0.5
    P1 = max(Fr, 3 * Fa - 0.1 * Fr)
    M1 = f1 * P1 * dm
    N = (M0 + M1) / 1000 * rpm * 2 * math.pi / 60
    return {"M0": M0, "M1": M1, "M": M0 + M1, "f1": f1, "N_W": N, "dm": dm}

def heat_balance(name, Fr, rpm, T_oil=80.0, VG=100, k=3.2e-4, f0=2.0, iters=50):
    """Steady bearing temperature: bearing loss N = M w must leave through the reference heat-emitting area
    A_r = pi B (d + D) [mm2] with heat transfer k [W/(mm2 K)] (k = 3.2e-4 = ISO 15312 reference flow density
    0.016 W/mm2 at 50 K - check). Loop: T -> nu(T) -> M(nu) -> N -> T = T_oil + N/(k A_r)."""
    b = CATALOGUE[name]
    Ar = math.pi * b["B"] * (b["d"] + b["D"])
    T = T_oil
    hist = []
    for i in range(iters):
        nu = nu_from_VG(VG, T)
        fr = palmgren_friction(name, Fr, rpm, nu, f0)
        Tn = T_oil + fr["N_W"] / (k * Ar)
        hist.append((i, T, nu, fr["N_W"]))
        if abs(Tn - T) < 1e-6:
            T = Tn
            break
        T = Tn
    nu = nu_from_VG(VG, T)
    return {"A_r": Ar, "T": T, "dT": T - T_oil, "nu": nu, "N_W": palmgren_friction(name, Fr, rpm, nu, f0)["N_W"],
            "iterations": len(hist), "history": hist}

# ---------------------------------------------------------------- demo
def demo_ch56():
    P = dict(DEFAULT)
    res = analyse(P)
    FrA, FrA_max = res["A"]["Fr_eq"], res["A"]["Fr_max"]
    g = GEOM_6206
    print("== 5.1 contact of the most loaded ball, 6206, bearing A")
    for lab, F in (("equivalent load", FrA), ("peak load", FrA_max)):
        Q = q_max(F, g["Z"])
        for race in ("inner", "outer"):
            Rx, Ry = contact_radii(g, race)
            h = hertz_ellipse(Q, Rx, Ry)
            print("  %s Fr %.0f N: Q_max %.1f N | %s Rx %.3f Ry %.2f mm, k %.2f, a %.3f b %.3f mm, p_max %.0f MPa" % (
                lab, F, Q, race, Rx, Ry, h["k"], h["a"], h["b"], h["p_max"]))
    print("  C0 check: Q at Fr = C0 = %.0f N" % q_max(CATALOGUE["6206"]["C0"] * 1000, g["Z"]),
          "-> p_max inner %.0f MPa (ISO 76 reference ~4200 MPa for ball bearings)" % hertz_ellipse(
              q_max(CATALOGUE["6206"]["C0"] * 1000, g["Z"]), *contact_radii(g, "inner"))["p_max"])
    print("== 5.2 EHL film (inner race, Q_max at equivalent load)")
    u = entrainment_speed(g, P["rpm"])
    Q = q_max(FrA, g["Z"])
    Rx, Ry = contact_radii(g, "inner")
    for T in (60, 80, 100):
        nu = nu_from_VG(100, T)
        hd = hamrock_dowson(Q, Rx, Ry, u, nu)
        lam = film_parameter(hd["h_min_um"])
        print("  VG100 at %d C: nu %.1f mm2/s, eta0 %.4f Pa s, u %.2f m/s, U %.3e G %.0f W %.3e -> h_min %.3f um, Lambda %.2f"
              % (T, nu, hd["eta0_Pas"], u, hd["U"], hd["G"], hd["W"], hd["h_min_um"], lam))
    print("== 5.3 viscosity, rated viscosity, kappa")
    dm = (CATALOGUE["6206"]["d"] + CATALOGUE["6206"]["D"]) / 2
    print("  nu1(1450 rpm, dm %.0f) = %.2f mm2/s; nu1(900 rpm) = %.2f; nu1(3000 rpm) = %.2f" % (
        dm, nu1_rated(1450, dm), nu1_rated(900, dm), nu1_rated(3000, dm)))
    print("  VG table at 80 C: " + ", ".join("VG%d %.1f (k %.2f)" % (v, nu_from_VG(v, 80), nu_from_VG(v, 80) / nu1_rated(1450, dm))
                                          for v in (46, 68, 100, 150, 220)))
    for tk in (1, 2, 4):
        for T in (70, 80, 90):
            r = min_VG_for_kappa(tk, 1450, dm, T)
            print("  target kappa %d at %d C -> %s" % (tk, T, "VG%d (nu %.1f, kappa %.2f)" % r if r else "none <= VG460"))
    print("== 5.4 life vs oil temperature (6206, P = %.0f N)" % FrA)
    for T, ml in life_vs_temperature("6206", FrA, 1450):
        print("  %d C: nu %.1f kappa %.2f a_ISO %.2f L_nm %.0f h" % (T, ml["nu"], ml["kappa"], ml["a_iso"], ml["Lnmh"]))
    print("== 5.5 life vs cleanliness (6206, P = %.0f N, VG100 80 C)" % FrA)
    for cls, ml in life_vs_cleanliness("6206", FrA, 1450):
        print("  %-26s e_c %.2f -> a_ISO %.2f, L_nm %.0f h (%.1f x L10h)" % (cls, ml["ec"], ml["a_iso"], ml["Lnmh"], ml["Lnmh"] / ml["L10h"]))
    print("== 5.6 grease relubrication rule (orientation only)")
    for n in (1450, 3000):
        print("  6206 grease, %d rpm: t_f ~ %.0f h at 70 C, ~ %.0f h at 85 C" % (n, relub_interval_rule(n, 30), relub_interval_rule(n, 30) / 2))
    print("== 6.1 static safety (peak x 1.5)")
    for name in ("6006", "6206", "6306", "NU206"):
        s = static_check(name, FrA_max * 1.5)
        print("  %-6s P0 %.0f N, s0 %.2f" % (name, s["P0"], s["s0"]))
    s = static_check("6206", 1500, 500)
    print("  6206 with Fr 1500 / Fa 500 N: P0 %.0f N, s0 %.2f" % (s["P0"], s["s0"]))
    print("== 6.2 minimum load and speed factor")
    for name in ("6206", "NU206"):
        b = CATALOGUE[name]
        rule = 0.01 if "ball" in b["type"] else 0.02
        print("  %-6s F_min ~ %.0f N; bearing A min load over the revolution %.0f N" % (name, rule * b["C"] * 1000, min(res["FA"])))
    print("  n dm = %.0f mm/min (1450 x %.0f); n_lim catalogue 6206 %d rpm -> n/n_lim %.2f" % (
        speed_factor(1450, dm), dm, CATALOGUE["6206"]["n_lim"], 1450 / CATALOGUE["6206"]["n_lim"]))
    print("== 6.3 friction: simple mu vs Palmgren (6206, Fr %.0f N, VG100 80 C)" % FrA)
    nu80 = nu_from_VG(100, 80)
    s = friction(CATALOGUE["6206"], FrA, 1450)
    pg = palmgren_friction("6206", FrA, 1450, nu80)
    print("  simple: mu %.4f, M %.1f N mm, %.2f W" % (s["mu"], s["M_Nmm"], s["N_W"]))
    print("  Palmgren: nu n %.0f, M0 %.1f N mm, f1 %.6f, M1 %.1f N mm, M %.1f N mm, %.2f W" % (
        nu80 * 1450, pg["M0"], pg["f1"], pg["M1"], pg["M"], pg["N_W"]))
    for f0 in (1.5, 2.0, 4.0):
        p = palmgren_friction("6206", FrA, 1450, nu80, f0)
        print("  f0 %.1f -> M %.1f N mm, %.2f W" % (f0, p["M"], p["N_W"]))
    print("== 6.4 heat balance iteration (6206, oil 80 C)")
    hb = heat_balance("6206", FrA, 1450)
    for i, T, nu, N in hb["history"][:4]:
        print("  it %d: T %.2f C, nu %.2f, N %.3f W" % (i, T, nu, N))
    print("  converged after %d iterations: A_r %.0f mm2, T %.2f C (+%.2f K), nu %.2f mm2/s, N %.3f W" % (
        hb["iterations"], hb["A_r"], hb["T"], hb["dT"], hb["nu"], hb["N_W"]))
    hb2 = heat_balance("6206", FrA, 6000, f0=4.0)
    print("  same bearing at 6000 rpm, oil bath f0 4: T %.1f C (+%.1f K), N %.2f W" % (hb2["T"], hb2["dT"], hb2["N_W"]))
    ml = modified_life(CATALOGUE["6206"], FrA, 1450, dict(DEFAULT, oil_temp_C=hb["T"]))
    print("  life at the bearing temperature %.1f C: kappa %.2f, L_nm %.0f h" % (hb["T"], ml["kappa"], ml["Lnmh"]))

# ================================================================ added with guide chapters (ch711)
# ---------------------------------------------------------------- chapter 7: fits, clearance, preload
SHAFT_FITS_30 = {   # shaft tolerance zones for d over 18 to 30 mm (um, ISO 286 typical - check)
    "j5": (-4, 5), "k5": (2, 11), "k5 (wide, as DEFAULT)": (2, 13), "m5": (8, 17), "n6": (15, 28)}

def ring_expansion_factor(d, F):
    """Diametral expansion of the inner-ring raceway per unit of diametral interference, solid steel shaft and
    steel ring (Lame, equal E): p = E U (1 - (d/F)^2) / (2 d);  u(F/2) = 2 p a^2 b / (E (b^2 - a^2))
    with a = d/2, b = F/2  ->  expansion = 2 u = U d / F.  F = inner raceway diameter ~ dm - Dw."""
    return d / F

def clearance_fixes(P=None):
    """Operating clearance of bearing A for the default and for the usual fixes (C4, j5 fit, smaller dT, both).
    Returns list of (label, min um, max um)."""
    P = dict(DEFAULT if P is None else P)
    b = CATALOGUE[P["bearing_A"]]
    variants = [
        ("default: C3, k5 (+2...+13), dT 10 K", {}),
        ("C4 instead of C3", {"clearance_class": "C4"}),
        ("j5 fit (-4...+5) instead of k5", {"shaft_fit_um": [-4, 5]}),
        ("dT inner-outer 5 K (better cooling)", {"temp_diff_inner_outer_K": 5.0}),
        ("C4 + k5 + dT 10 K, inner ring heated to 20 K", {"clearance_class": "C4", "temp_diff_inner_outer_K": 20.0}),
        ("CN (normal) + k5, dT 10 K", {"clearance_class": "CN"}),
    ]
    out = []
    for lab, ch in variants:
        Q = dict(P, **ch)
        c = operating_clearance(b, Q)
        out.append((lab, c["min"], c["max"]))
    return out

def preload_force_spring(d, factor=0.01):
    """Spring preload for a deep-groove ball bearing pair (noise, skidding): F = k d, k ~ 0.005 ... 0.01 kN/mm
    (rule of thumb of the large makers - check catalogue). Returns N."""
    return factor * d * 1000 / 1  # kN/mm * mm -> kN ... -> N

# ---------------------------------------------------------------- chapter 8: arrangement, thermal growth, mounting
ALPHA = {"steel": 11.5e-6, "grey iron": 10.5e-6, "aluminium": 23.0e-6}

def thermal_growth(L_mm, dT_shaft, dT_case, shaft="steel", case="grey iron"):
    """Difference of thermal expansion between shaft and housing over the bearing spacing L:
    dL = (alpha_s dT_s - alpha_c dT_c) L  [mm]. Positive: shaft grows more than the case."""
    return (ALPHA[shaft] * dT_shaft - ALPHA[case] * dT_case) * L_mm

def axial_force_if_fixed(dL_mm, L_mm, A_mm2, E=210000.0):
    """If both bearings locate (no floating bearing), the blocked growth acts like compression of the shaft:
    F = E A dL / L (upper bound, stiff housing and bearings)."""
    return E * A_mm2 * dL_mm / L_mm

def heating_temperature(U_um, d_mm, s_um=10.0, alpha=11.5e-6, T_amb=20.0):
    """Mounting by heating the inner ring: dT = (U + s) / (alpha d), s = wanted assembly clearance.
    Returns dT (K) and ring temperature (C)."""
    dT = (U_um + s_um) / 1000.0 / (alpha * d_mm)
    return dT, T_amb + dT

def press_force_bearing(U_um, d, F, B, mu=0.15, E=210000.0):
    """Press-on force of an inner ring on a solid shaft (cold): p = E U (1 - (d/F)^2)/(2 d), F_press = mu p pi d B."""
    p = E * U_um / 1000.0 * (1 - (d / F) ** 2) / (2 * d)
    return p, mu * p * math.pi * d * B

# ---------------------------------------------------------------- chapter 9: defect frequencies, fleet Weibull
GEOM = {"6206": {"Z": 9, "Dw": 9.525, "dm": 46.0, "alpha": 0.0}}   # typical internal geometry - check maker data

def defect_frequencies(rpm, Z, Dw, dm, alpha_deg=0.0):
    """Kinematic bearing frequencies, inner ring rotating, outer stationary (Hz):
    FTF = fr/2 (1 - g), BPFO = Z fr/2 (1 - g), BPFI = Z fr/2 (1 + g), BSF = dm/(2 Dw) fr (1 - g^2), g = Dw cos(a)/dm."""
    fr = rpm / 60.0
    g = Dw * math.cos(math.radians(alpha_deg)) / dm
    return {"fr": fr, "FTF": fr / 2 * (1 - g), "BPFO": Z * fr / 2 * (1 - g), "BPFI": Z * fr / 2 * (1 + g),
            "BSF": dm / (2 * Dw) * fr * (1 - g * g), "2xBSF": dm / Dw * fr * (1 - g * g)}

def fleet_weibull(hours=None):
    """Weibull fit (median ranks) of observed bearing failures in a fleet (example data) and B10 life."""
    from dm_strength import weibull_fit
    t = hours or [9500, 17800, 24100, 31500, 39000, 48500, 61000]
    w = weibull_fit(t)
    B10 = w["eta"] * (-math.log(0.9)) ** (1 / w["beta"])
    return {"beta": w["beta"], "eta": w["eta"], "r2": w["r2"], "B10_h": B10, "n": len(t)}

# ---------------------------------------------------------------- chapter 10: stiffness for M3 / MBD
def ball_bearing_stiffness(Fr, Z, Dw, alpha_deg=0.0, c=4.4e-4):
    """Radial stiffness estimate of a deep-groove ball bearing with zero clearance.
    Max ball load (Stribeck): Q = 5 Fr / (Z cos a). Total elastic approach of the most loaded ball between both
    raceways: delta = c Q^(2/3) Dw^(-1/3) mm (Hertz point contact, c ~ 4.4e-4 for steel and usual osculation -
    estimate, check ISO/TS 16281 / maker). delta_r = delta / cos a. Secant + tangent stiffness: k_tan = 1.5 Fr/delta_r."""
    ca = math.cos(math.radians(alpha_deg))
    Q = 5.0 * Fr / (Z * ca)
    delta = c * Q ** (2.0 / 3.0) * Dw ** (-1.0 / 3.0)
    dr = delta / ca
    return {"Q": Q, "delta_um": delta * 1000, "k_secant": Fr / dr, "k_tangent": 1.5 * Fr / dr}

# ---------------------------------------------------------------- chapter 11: worked selection example
EXAMPLE = {
    "name": "Helical gear shaft (example): d 30, 960 rpm, axial gear force on the locating bearing A",
    "rpm": 960.0,
    "use_crank_loads": False,
    "bearing_A": "6306", "bearing_B": "NU206",
    "Fr_A_N": 3200.0, "Fa_A_N": 0.0, "Fr_B_N": 2100.0, "Fa_B_N": 0.0,
    "Fa_external_N": 1340.0,
    "target_life_h": 20000.0,
    "reliability_pct": 95.0,
    "oil_VG": 68, "oil_temp_C": 70.0,
    "cleanliness": "normal cleanliness",
}

def example_selection():
    P = dict(DEFAULT, **EXAMPLE)
    res = analyse(P)
    candA = select(EXAMPLE["Fr_A_N"], EXAMPLE["Fa_external_N"], EXAMPLE["rpm"], P, d=30)
    candB = select(EXAMPLE["Fr_B_N"], 0.0, EXAMPLE["rpm"], P, d=30)
    return P, res, candA, candB

def demo_ch711():
    print("== 7.2 inner-ring expansion factor d/F (6206: d 30, F = dm - Dw = 46 - 9.525)")
    F = 46.0 - 9.525
    print("  F %.3f mm -> d/F %.3f (program uses 0.8)" % (F, ring_expansion_factor(30, F)))
    print("== 7.4 operating clearance of bearing A (6206) - default and fixes [um]")
    for lab, lo, hi in clearance_fixes():
        print("  %-46s %6.1f ... %5.1f" % (lab, lo, hi))
    print("== 7.6 spring preload rule F = k d")
    for k in (0.005, 0.01):
        print("  k %.3f kN/mm, d 30 mm -> F %.0f N" % (k, preload_force_spring(30, k)))
    print("== 8.2 thermal growth over the bearing spacing L = 120 mm")
    for case, dTs, dTc in (("grey iron", 60, 40), ("grey iron", 60, 20), ("aluminium", 60, 40)):
        dl = thermal_growth(120, dTs, dTc, "steel", case)
        Fax = axial_force_if_fixed(abs(dl), 120, math.pi / 4 * 30 ** 2)
        print("  steel shaft dT %d K, %s case dT %d K: dL %+.4f mm -> if both bearings locate: F up to %.0f N"
              % (dTs, case, dTc, dl, Fax))
    print("== 8.4 mounting the 6206 inner ring on k5 (U max 13 um)")
    for s in (10.0, 30.0):
        dT, T = heating_temperature(13, 30, s)
        print("  assembly clearance %2.0f um: dT %.1f K -> ring at %.0f C" % (s, dT, T))
    p, Fp = press_force_bearing(13, 30, F, 16)
    print("  cold press-on: p %.1f MPa, force %.0f N (mu 0.15)" % (p, Fp))
    print("== 9.3 defect frequencies 6206 at 1450 rpm (Z 9, Dw 9.525, dm 46 - typical, check)")
    g = GEOM["6206"]
    f = defect_frequencies(1450, g["Z"], g["Dw"], g["dm"], g["alpha"])
    print("  fr %.2f, FTF %.2f, BPFO %.2f, BPFI %.2f, BSF %.2f, 2xBSF %.2f Hz" % (
        f["fr"], f["FTF"], f["BPFO"], f["BPFI"], f["BSF"], f["2xBSF"]))
    print("== 9.5 fleet Weibull (example failure hours)")
    w = fleet_weibull()
    print("  n %d, beta %.2f, eta %.0f h, r2 %.3f -> B10 %.0f h" % (w["n"], w["beta"], w["eta"], w["r2"], w["B10_h"]))
    print("== 10.3 radial stiffness of 6206 (zero clearance, estimate)")
    for Fr in (500, 1211, 2046):
        k = ball_bearing_stiffness(Fr, g["Z"], g["Dw"])
        print("  Fr %4d N: Q %.0f N, delta %.1f um, k_secant %.0f N/mm, k_tangent %.0f N/mm" % (
            Fr, k["Q"], k["delta_um"], k["k_secant"], k["k_tangent"]))
    print("== 11 worked selection: helical gear shaft")
    P, res, cA, cB = example_selection()
    print(report_text(P, res))
    print("  candidates A (Fr 3200, Fa 1340, 960 rpm, 95 %):")
    for r in cA:
        print("   %-6s %-10s P %6.0f  L10h %8.0f  L_nm %9.0f  a_ISO %5.2f  kappa %4.2f  s0 %5.1f  %s" % (
            r["name"], r["type"], r["P"], r["L10h"], r["Lnmh"], r["a_iso"], r["kappa"], r["s0"], "ok" if r["ok"] else "no"))
    print("  candidates B (Fr 2100, Fa 0):")
    for r in cB:
        print("   %-6s %-10s P %6.0f  L10h %8.0f  L_nm %9.0f  a_ISO %5.2f  s0 %5.1f  %s" % (
            r["name"], r["type"], r["P"], r["L10h"], r["Lnmh"], r["a_iso"], r["s0"], "ok" if r["ok"] else "no"))

# ---------------------------------------------------------------- examples / selftest
def cmd_examples():
    P = dict(DEFAULT)
    res = analyse(P)
    print(report_text(P, res))
    print("\n## Candidates for bearing A (d 30, load from the revolution)")
    print("name    type        D   B    P[N]   L10h      L_nm h    a_ISO  kappa  s0    OK")
    for r in select(res["A"]["Fr_eq"], 0.0, P["rpm"], P, d=30):
        print("%-7s %-10s %3d %4s %6.0f %9.0f %9.0f %6.2f %5.2f %5.1f %s" % (
            r["name"], r["type"], r["D"], r["B"], r["P"], r["L10h"], r["Lnmh"], r["a_iso"], r["kappa"], r["s0"],
            "yes" if r["ok"] else "no"))
    print("\n## Viscosity of ISO VG 100 vs temperature (Ubbelohde-Walther)")
    print("  " + ", ".join("%d C: %.1f" % (T, nu_from_VG(100, T)) for T in (40, 60, 70, 80, 90, 100)))
    print("\n## a_ISO for a ball bearing vs kappa and e_c Cu/P")
    for x in (0.01, 0.05, 0.1, 0.2):
        print("  e_c Cu/P %.2f: " % x + ", ".join("k %.1f -> %.2f" % (k, a_iso(k, x)) for k in (0.2, 0.5, 1, 2, 4)))
    print("\n## Equivalent load of a 6206 with axial load (Fr 1500 N)")
    for Fa in (0, 200, 500, 1000):
        e = equivalent_dynamic(CATALOGUE["6206"], 1500, Fa)
        print("  Fa %4d N: e %s, X %.2f, Y %.2f -> P %.0f N" % (Fa, "-" if e["e"] is None else "%.3f" % e["e"], e["X"], e["Y"], e["P"]))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-62s %s %s" % (name, "OK  " if cond else "FAIL", info))
    P = dict(DEFAULT)
    b = CATALOGUE["6206"]
    L10, L10h = basic_life(20.3, 2030.0, 3, 1000)
    chk("L10 = (C/P)^3: C/P = 10 -> 1000 Mrev = 16667 h at 1000 rpm", abs(L10 - 1000) < 1e-9 and abs(L10h - 1e9 / 60000) < 1e-6)
    chk("a1(90) = 1, a1(99) = 0.25", a1(90) == 1 and abs(a1(99) - 0.25) < 1e-12)
    chk("P = Fr when Fa = 0", equivalent_dynamic(b, 1234, 0)["P"] == 1234)
    e1 = equivalent_dynamic(b, 1500, 1000)
    chk("deep groove with Fa/Fr > e: P = 0.56 Fr + Y Fa", abs(e1["P"] - (0.56 * 1500 + e1["Y"] * 1000)) < 1e-9 and e1["X"] == 0.56)
    chk("viscosity: nu(40 C) = VG and nu(100 C) = table value (Walther fit)",
        abs(nu_from_VG(100, 40) - 100) < 1e-6 and abs(nu_from_VG(100, 100) - 11.1) < 1e-6)
    chk("a_ISO rises with kappa and with e_c Cu/P; capped at 50",
        a_iso(0.5, 0.1) < a_iso(1, 0.1) < a_iso(2, 0.1) and a_iso(1, 0.05) < a_iso(1, 0.2) and a_iso(4, 5) == 50)
    chk("mean load of a constant load = the load", abs(mean_load([800.0] * 10) - 800) < 1e-9)
    chk("cubic mean >= arithmetic mean", mean_load([100, 900, 400]) >= 1400 / 3)
    th, FA, FB = loads_over_revolution(4.0)
    import crank, shaft
    R = crank.compute_all()
    # equilibrium at one angle: reactions + loads = 0 in both planes
    S = dict(shaft.DEFAULT)
    r0 = R["rows"][0]
    forces = [[f for f in S["forces"] if "belt" in f[3]][0], [S["torque_out_x"], r0["F_pin"][1], r0["F_pin"][0], "pin"]]
    Rr = shaft.reactions(dict(S, forces=forces))
    sy = Rr["y"][0] + Rr["y"][1] + sum(f[1] for f in forces)
    sz = Rr["z"][0] + Rr["z"][1] + sum(f[2] for f in forces)
    chk("hand-over: bearing reactions + loads = 0 at theta = 0", abs(sy) < 1e-9 and abs(sz) < 1e-9)
    chk("hand-over: peak bearing load <= pin peak + belt", max(max(FA), max(FB)) <= 2684.3 + 637 + 1)
    cl = operating_clearance(b, P)
    chk("operating clearance = initial - fit - thermal", abs(cl["min"] - (13 - 0.72 * 13 - cl["thermal"])) < 1e-9)
    Pm, nm = duty_cycle_mean([(1000, 1000, 0.5), (1000, 1000, 0.5)])
    chk("duty cycle of equal states = that state", abs(Pm - 1000) < 1e-9 and abs(nm - 1000) < 1e-9)
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
    elif cmd in ("ch24", "ch56", "ch711"):
        {"ch24": demo_ch24, "ch56": demo_ch56, "ch711": demo_ch711}[cmd]()
    elif cmd == "selftest":
        return cmd_selftest()
    elif cmd == "run":
        P = dict(DEFAULT)
        out = "bearing_out"
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
