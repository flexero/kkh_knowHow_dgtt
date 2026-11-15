#!/usr/bin/env python3
"""M8 spring program - cylindrical helical compression springs of round wire in the style of EN 13906-1 (2013):
wire materials (EN 10270-1/-2/-3 tensile strength vs wire diameter), spring rate, stress with the Bergsträsser
correction, lengths (solid length, minimum gaps, working lengths), buckling, natural frequency (surge), fatigue
(Goodman-type Haigh line), spring mass and energy, and design from requirements (two forces + stroke -> d, n, L0).
Default case: the follower spring of the M6 cam (preload >= 50 N, rate ~3 N/mm, stroke 20 mm, 300 rpm).
Guide: 08_springs.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python spring.py params | run [--in p.json] [--out folder] | examples | selftest
  python spring.py ch24 | ch56 | ch78        extra results of guide chapters 2-4, 5-6, 7-8
  python spring.py run --in examples/spring_example.json --out example   worked design example (chapter 8)

Tensile-strength fits, permissible stresses, fatigue strength values and the minimum-gap rule are TYPICAL VALUES in
the style of EN 10270 / EN 13906-1 - check the standards and the wire / spring maker's data before a design is
released. All default numbers are EXAMPLES.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # sibling tools (cam.py for the surge model)

# wire materials: Rm_min = A d^-m (MPa, d in mm; fit to the EN 10270 minimum values, check), G, E (MPa), density,
# fatigue factor: pulsating (tau_kU = 0) endurance stroke stress at 1e7 cycles as a fraction of Rm (check)
MATERIALS = {
    "EN 10270-1 DH (patented, cold drawn)":      {"A": 2230.0, "m": 0.17, "G": 81500.0, "E": 206000.0, "rho": 7.85e-6, "fD0": 0.24, "fD0_peened": 0.30, "T_max": 80},
    "EN 10270-2 VDSiCr (oil tempered, valve)":   {"A": 2080.0, "m": 0.055, "G": 79500.0, "E": 206000.0, "rho": 7.85e-6, "fD0": 0.30, "fD0_peened": 0.38, "T_max": 160},
    "EN 10270-3 1.4310 (stainless)":             {"A": 2000.0, "m": 0.14, "G": 70000.0, "E": 185000.0, "rho": 7.90e-6, "fD0": 0.20, "fD0_peened": 0.25, "T_max": 160},
}
WIRE_D = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.2, 2.5, 2.8, 3.0, 3.2, 3.5, 3.8, 4.0,
          4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 8.0, 9.0, 10.0]   # preferred wire diameters mm (EN 10270 style)
SEATING = {"both ends fixed, guided": 0.5, "one fixed one pinned": 0.7, "both pinned": 1.0, "one fixed one free": 2.0}

DEFAULT = {
    "name": "Follower spring of the M6 cam (packaging pusher, 300 rpm) - helical compression spring (example)",
    "material": "EN 10270-2 VDSiCr (oil tempered, valve)", "shot_peened": True,
    "d": 2.5,                         # wire diameter mm (result of design_from_requirements, chapter 6)
    "D": 25.0,                        # mean coil diameter mm
    "n": 8.5,                         # active coils
    "ends": "closed and ground",      # closed and ground (nt = n + 2) | closed not ground (nt = n + 2) | open (nt = n)
    "L0": 74.0,                       # free length mm
    "L1": 55.0, "L2": 35.0,           # installed (preloaded, cam on base circle) and fully lifted working lengths mm
    "seating": "both ends fixed, guided",
    "dynamic": True,
    "f_exc": 5.0,                     # excitation (cam) frequency Hz
    "harmonic_max": 12,               # highest cam harmonic with noticeable content (check, M6 chapter 5)
    "S_static_req": 1.0, "S_fat_req": 1.1,
    # requirements for design_from_requirements()
    "req": {"F1": 55.0, "F2": 115.0, "stroke": 20.0, "D": 25.0, "Da_max": 30.0},
}

# ---------------------------------------------------------------- chapter 2: material
def Rm_min(P, d=None):
    m = MATERIALS[P["material"]]
    return m["A"] * (P["d"] if d is None else d) ** (-m["m"])

def tau_zul(P, d=None):
    """Permissible static shear stress (uncorrected) 0.5 Rm (EN 13906-1 style, check)."""
    return 0.5 * Rm_min(P, d)

# ---------------------------------------------------------------- chapter 3: rate, stress, geometry
def berg(w):
    """Bergsträsser stress correction factor k = (w + 0.5)/(w - 0.75), w = D/d."""
    return (w + 0.5) / (w - 0.75)

def rate(P):
    G = MATERIALS[P["material"]]["G"]
    return G * P["d"] ** 4 / (8 * P["D"] ** 3 * P["n"])

def stress(P, F):
    tau = 8 * F * P["D"] / (math.pi * P["d"] ** 3)
    return tau, berg(P["D"] / P["d"]) * tau

def total_coils(P):
    return P["n"] + 2 if P["ends"].startswith("closed") else P["n"]

def geometry(P):
    d, D, n = P["d"], P["D"], P["n"]
    nt = total_coils(P)
    Lc = nt * d if P["ends"] == "closed and ground" else (nt + 1.5) * d       # solid length (check EN 13906)
    Sa = (0.0015 * D ** 2 / d + 0.1 * d) * n                                  # sum of minimum gaps
    if P["dynamic"]:
        Sa *= 1.5
    Ln_min = Lc + Sa
    w = D / d
    Da, Di = D + d, D - d
    m = MATERIALS[P["material"]]["rho"] * math.pi ** 2 * d ** 2 * D * nt / 4    # kg
    pitch = (P["L0"] - 2 * d) / n if P["ends"].startswith("closed") else P["L0"] / n
    Da_growth = 0.1 * (pitch ** 2 - 0.8 * pitch * d - 0.2 * d ** 2) / D if pitch > d else 0.0   # EN 13906-1 coil-diameter increase at solid (m = pitch)
    return {"w": w, "k": berg(w), "nt": nt, "Lc": Lc, "Sa": Sa, "Ln_min": Ln_min, "Da": Da, "Di": Di, "mass_kg": m,
            "pitch": pitch, "Da_solid": Da + max(Da_growth, 0.0), "checks": {"w_range": 4 <= w <= 20, "L2_ge_Ln": P["L2"] >= Ln_min}}

def forces(P):
    R = rate(P)
    s1, s2, sc = P["L0"] - P["L1"], P["L0"] - P["L2"], P["L0"] - geometry(P)["Lc"]
    return {"R": R, "s1": s1, "s2": s2, "sc": sc, "F1": R * s1, "F2": R * s2, "Fc": R * sc,
            "W12_J": 0.5 * R * (s2 ** 2 - s1 ** 2) / 1000.0}

# ---------------------------------------------------------------- chapter 4: buckling and natural frequency
def buckling(P):
    """Buckling deflection s_K (EN 13906-1): s_K = L0 * 0.5/(1 - G/E) * [1 - sqrt(1 - (1 - G/E)/(0.5 + G/E) * (pi D/(nu L0))^2)];
    no buckling if the root is imaginary."""
    mat = MATERIALS[P["material"]]
    ge = mat["G"] / mat["E"]
    nu = SEATING[P["seating"]]
    arg = 1 - (1 - ge) / (0.5 + ge) * (math.pi * P["D"] / (nu * P["L0"])) ** 2
    if arg < 0:
        return {"nu": nu, "sK": None, "safe": True, "slenderness": P["L0"] / P["D"]}
    sK = P["L0"] * 0.5 / (1 - ge) * (1 - math.sqrt(arg))
    s2 = P["L0"] - P["L2"]
    return {"nu": nu, "sK": sK, "safe": s2 < sK, "slenderness": P["L0"] / P["D"]}

def natural_frequency(P):
    """First natural frequency of the spring fixed at both ends: f_e = d/(2 pi n D^2) sqrt(G/(2 rho)) (SI units)."""
    mat = MATERIALS[P["material"]]
    d, D = P["d"] / 1000.0, P["D"] / 1000.0
    G, rho = mat["G"] * 1e6, mat["rho"] * 1e9
    fe = d / (2 * math.pi * P["n"] * D ** 2) * math.sqrt(G / (2 * rho))
    ratio = fe / P["f_exc"]
    return {"fe": fe, "ratio": ratio, "resonant_harmonic": ratio <= P["harmonic_max"], "fe_req": P["harmonic_max"] * P["f_exc"]}

# ---------------------------------------------------------------- chapter 5: static and fatigue checks
def static_check(P):
    Fc = forces(P)["Fc"]
    tau_c, _ = stress(P, Fc)
    t2, _ = stress(P, forces(P)["F2"])
    tz = tau_zul(P)
    return {"tau_c": tau_c, "tau_2": t2, "tau_zul": tz, "S_solid": tz / tau_c, "S_2": tz / t2, "block_safe": tau_c <= tz}

def fatigue(P):
    """Goodman-type Haigh line in corrected stresses: tau_kO,lim = tau_D0 + (1 - tau_D0/tau_st) tau_kU,
    tau_D0 = f_D0 Rm (pulsating endurance stroke at 1e7, check), tau_st = 0.5 Rm (static limit)."""
    mat = MATERIALS[P["material"]]
    F = forces(P)
    _, tk1 = stress(P, F["F1"])
    _, tk2 = stress(P, F["F2"])
    Rm = Rm_min(P)
    tD0 = (mat["fD0_peened"] if P["shot_peened"] else mat["fD0"]) * Rm
    tst = 0.5 * Rm
    tkO_lim = tD0 + (1 - tD0 / tst) * tk1
    tkH, tkH_lim = tk2 - tk1, tkO_lim - tk1
    return {"tau_kU": tk1, "tau_kO": tk2, "tau_kH": tkH, "tau_D0": tD0, "tau_kO_lim": tkO_lim, "tau_kH_lim": tkH_lim,
            "S_fat": tkH_lim / tkH if tkH > 0 else float("inf")}

def summary(P):
    g, F, b, fr, st, ft = geometry(P), forces(P), buckling(P), natural_frequency(P), static_check(P), fatigue(P)
    ok = {"index_w": g["checks"]["w_range"], "min_gaps": g["checks"]["L2_ge_Ln"], "static": st["S_2"] >= P["S_static_req"],
          "solid_block": st["block_safe"], "buckling": b["safe"], "surge": not fr["resonant_harmonic"],
          "fatigue": (ft["S_fat"] >= P["S_fat_req"]) if P["dynamic"] else True,
          "outer_diameter": g["Da"] <= P["req"].get("Da_max", 1e9)}
    return {"g": g, "F": F, "buck": b, "freq": fr, "static": st, "fat": ft, "ok": ok}

# ---------------------------------------------------------------- chapter 6: design from requirements
def design_from_requirements(P):
    """For each preferred wire diameter: n from the required rate, L0 from F1, lengths, all checks; return all candidates
    and the lightest one that passes."""
    rq = P["req"]
    R_req = (rq["F2"] - rq["F1"]) / rq["stroke"]
    G = MATERIALS[P["material"]]["G"]
    cands = []
    for d in WIRE_D:
        D = rq["D"]
        w = D / d
        if not 4 <= w <= 20:
            continue
        n = G * d ** 4 / (8 * D ** 3 * R_req)
        n = round(n * 2) / 2                              # half coils
        if n < 3:                                         # fewer than 3 active coils: rate and force not reliable
            continue
        Q = dict(P, d=d, D=D, n=n)
        R = rate(Q)
        s1 = rq["F1"] / R
        g = geometry(Q)
        L2 = g["Ln_min"] + 0.5                             # use the full allowed range, small margin
        L0 = L2 + s1 + rq["stroke"]
        Q.update(L0=L0, L1=L0 - s1, L2=L2)
        S = summary(Q)
        cands.append({"d": d, "n": n, "R": R, "L0": L0, "L1": Q["L1"], "L2": L2, "mass_g": S["g"]["mass_kg"] * 1000,
                      "S_2": S["static"]["S_2"], "S_fat": S["fat"]["S_fat"], "fe": S["freq"]["fe"], "ok": all(S["ok"].values()),
                      "fails": [k for k, v in S["ok"].items() if not v]})
    good = [c for c in cands if c["ok"]]
    return {"R_req": R_req, "candidates": cands, "best": min(good, key=lambda c: c["mass_g"]) if good else None}

# ---------------------------------------------------------------- report / run
def report_text(P):
    S = summary(P)
    g, F, b, fr, st, ft, ok = (S[k] for k in ("g", "F", "buck", "freq", "static", "fat", "ok"))
    fl = lambda x: "OK" if x else "NOT OK"
    L = ["# Compression spring report (EN 13906-1 style) - %s\n" % P["name"],
         "%s%s, d %.2f, D %.2f (Da %.2f, Di %.2f), n %.1f active / %.1f total, %s, L0 %.2f mm" % (
             P["material"], ", shot peened" if P["shot_peened"] else "", P["d"], P["D"], g["Da"], g["Di"], P["n"], g["nt"], P["ends"], P["L0"]),
         "\n## Material",
         "- Rm_min %.0f MPa, tau_zul = 0.5 Rm %.0f MPa, G %.0f MPa" % (Rm_min(P), tau_zul(P), MATERIALS[P["material"]]["G"]),
         "\n## Rate, forces, lengths",
         "- rate R %.4f N/mm; F1 %.1f N at L1 %.1f (s1 %.1f), F2 %.1f N at L2 %.1f (s2 %.1f), at solid %.1f N; work stroke %.3f J" % (
             F["R"], F["F1"], P["L1"], F["s1"], F["F2"], P["L2"], F["s2"], F["Fc"], F["W12_J"]),
         "- spring index w %.2f (%s), Bergstraesser k %.4f; solid length Lc %.2f, minimum gaps Sa %.2f -> Ln_min %.2f mm (L2 %.1f: %s)" % (
             g["w"], fl(ok["index_w"]), g["k"], g["Lc"], g["Sa"], g["Ln_min"], P["L2"], fl(ok["min_gaps"])),
         "- pitch %.3f mm, mass %.1f g, outer diameter at solid ~%.2f mm" % (g["pitch"], g["mass_kg"] * 1000, g["Da_solid"]),
         "\n## Stresses",
         "- tau at L2 %.0f MPa (S %.2f %s), at solid %.0f MPa (%s)" % (st["tau_2"], st["S_2"], fl(ok["static"]), st["tau_c"],
                                                                     "can be compressed to solid" if st["block_safe"] else "NOT solid-safe"),
         "- fatigue (corrected): tau_kU %.0f, tau_kO %.0f, stroke %.0f MPa; tau_D0 %.0f, allowed stroke %.0f MPa -> S %.2f %s" % (
             ft["tau_kU"], ft["tau_kO"], ft["tau_kH"], ft["tau_D0"], ft["tau_kH_lim"], ft["S_fat"], fl(ok["fatigue"])),
         "\n## Stability and dynamics",
         "- buckling: nu %.1f, L0/D %.2f, s_K %s -> %s" % (b["nu"], b["slenderness"], "%.1f mm" % b["sK"] if b["sK"] else "none (stable)", fl(b["safe"])),
         "- natural frequency %.0f Hz = %.1f x excitation %.1f Hz (needs > %d x = %.0f Hz) -> %s" % (
             fr["fe"], fr["ratio"], P["f_exc"], P["harmonic_max"], fr["fe_req"], fl(ok["surge"]))]
    dz = design_from_requirements(P)
    L.append("\n## Design from requirements (F1 %.0f N, F2 %.0f N, stroke %.0f mm, D %.0f mm -> R %.2f N/mm)" % (
        P["req"]["F1"], P["req"]["F2"], P["req"]["stroke"], P["req"]["D"], dz["R_req"]))
    for c in dz["candidates"]:
        L.append("- d %.1f, n %4.1f, R %.2f, L0 %.1f, L2 %.1f, %.0f g, S_static %.2f, S_fat %.2f, f_e %.0f Hz %s" % (
            c["d"], c["n"], c["R"], c["L0"], c["L2"], c["mass_g"], c["S_2"], c["S_fat"], c["fe"], "OK" if c["ok"] else "fails: " + ", ".join(c["fails"])))
    L.append("- lightest passing: %s" % ("d %.1f mm, n %.1f, L0 %.1f mm" % (dz["best"]["d"], dz["best"]["n"], dz["best"]["L0"]) if dz["best"] else "none"))
    return "\n".join(L)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    S = summary(P)
    with open(os.path.join(out, "drawing_data.csv"), "w", encoding="utf-8") as f:
        f.write("item,value\n")
        for k, v in (("wire diameter d mm", P["d"]), ("mean diameter D mm", P["D"]), ("outer diameter Da mm", S["g"]["Da"]),
                     ("active coils n", P["n"]), ("total coils nt", S["g"]["nt"]), ("free length L0 mm", P["L0"]),
                     ("L1 mm / F1 N", "%.2f / %.1f" % (P["L1"], S["F"]["F1"])), ("L2 mm / F2 N", "%.2f / %.1f" % (P["L2"], S["F"]["F2"])),
                     ("solid length Lc mm", S["g"]["Lc"]), ("rate N/mm", S["F"]["R"])):
            f.write("%s,%s\n" % (k, v if isinstance(v, str) else "%.3f" % v))
        f.write("ends,%s\nmaterial,%s\n" % (P["ends"], P["material"]))
    print(rep)
    print("written: report.md, drawing_data.csv ->", out)


# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2: types and materials
SPRING_TYPES = [   # type, load / motion, typical use, design standard
    ("helical compression", "axial push, linear", "valves, cam followers, clutches, dies", "EN 13906-1"),
    ("helical tension", "axial pull, initial tension, hooks / loops", "return springs, doors, levers", "EN 13906-2"),
    ("helical torsion", "rotation, torque about the coil axis", "hinges, ratchets, clips, reels", "EN 13906-3"),
    ("disc (Belleville)", "very high force on small travel, stackable, nonlinear", "bolt preload, clutches, valves", "EN 16983 / EN 16984"),
    ("wave spring", "axial, short solid length", "bearing preload, seals", "maker data"),
    ("leaf / flat spring", "bending, can guide", "vehicles, contacts, snap fits", "beam theory"),
    ("gas spring", "nearly constant force, damped", "lids, chairs, tool lifts", "maker data"),
    ("elastomer / polyurethane", "high damping, nonlinear, creep", "die cushions, buffers", "maker data"),
]

WIRE_CLASSES = [   # standard, grade, condition, typical use, max service temperature C (check)
    ("EN 10270-1", "SL / SM / SH", "patented cold drawn, static", "static springs, low / medium / high stress", 80),
    ("EN 10270-1", "DM / DH", "patented cold drawn, dynamic", "dynamic springs (better surface, lower defect depth)", 80),
    ("EN 10270-2", "FDC / TDC / VDC", "oil hardened + tempered, unalloyed", "F static, T medium fatigue, V valve quality", 120),
    ("EN 10270-2", "FDSiCr / TDSiCr / VDSiCr", "oil hardened + tempered, Si-Cr alloyed", "high fatigue, engine valve springs", 160),
    ("EN 10270-2", "VDSiCrV", "oil hardened + tempered, Si-Cr-V", "highest fatigue, racing valve springs", 160),
    ("EN 10270-3", "1.4310 (NS / HS)", "austenitic stainless, cold drawn", "corrosion, food, medical", 160),
    ("EN 10270-3", "1.4568", "precipitation hardening stainless", "higher strength and temperature than 1.4310", 250),
    ("EN 12166", "CuSn6 / CuBe2", "copper alloys", "electrical contacts, non-magnetic", 100),
]

def rm_table(ds=(1.0, 2.0, 2.5, 3.0, 4.0, 6.0, 8.0)):
    """Rm_min (MPa) of every material of the program for several wire diameters (fit A d^-m, check)."""
    return {m: [(d, Rm_min(dict(DEFAULT, material=m), d)) for d in ds] for m in MATERIALS}

RELAXATION = {   # typical loss of force after 48 h at the given corrected stress and temperature, % (maker data style, check)
    "EN 10270-1 DH (patented, cold drawn)": {"20C": 2, "80C": 6, "120C": 12},
    "EN 10270-2 VDSiCr (oil tempered, valve)": {"20C": 1, "80C": 2, "120C": 4},
    "EN 10270-3 1.4310 (stainless)": {"20C": 2, "80C": 4, "120C": 7},
}

# ---------------------------------------------------------------- chapter 3: rate by torsion of the wire (energy check)
def rate_by_torsion(P):
    """Wire of length l = pi D n twisted by T = F D/2: twist phi = T l/(G Ip), Ip = pi d^4/32; the coil axis moves s = phi D/2."""
    F = 1.0
    G = MATERIALS[P["material"]]["G"]
    T = F * P["D"] / 2
    l = math.pi * P["D"] * P["n"]
    Ip = math.pi * P["d"] ** 4 / 32
    phi = T * l / (G * Ip)
    s = phi * P["D"] / 2
    return {"l_wire": l, "Ip": Ip, "phi_per_N": phi, "R": F / s, "R_core": rate(P)}

def wahl(w):
    """Wahl factor (4w - 1)/(4w - 4) + 0.615/w (curvature + direct shear)."""
    return (4 * w - 1) / (4 * w - 4) + 0.615 / w

def correction_table(ws=(4, 5, 6, 8, 10, 12, 15, 20)):
    return [(w, berg(w), wahl(w), (wahl(w) / berg(w) - 1) * 100) for w in ws]

def end_types(P=None):
    """nt, solid length, pitch and helix angle for the three end types (same n, L0)."""
    P = dict(P or DEFAULT)
    out = []
    for e in ("closed and ground", "closed not ground", "open"):
        Q = dict(P, ends=e)
        g = geometry(Q)
        out.append({"ends": e, "nt": g["nt"], "Lc": g["Lc"], "pitch": g["pitch"],
                    "helix_deg": math.degrees(math.atan(g["pitch"] / (math.pi * P["D"]))), "Ln_min": g["Ln_min"]})
    return out

def min_gap_rule(P=None):
    P = dict(P or DEFAULT)
    st = geometry(dict(P, dynamic=False))
    dy = geometry(dict(P, dynamic=True))
    per_coil = 0.0015 * P["D"] ** 2 / P["d"] + 0.1 * P["d"]
    return {"per_coil": per_coil, "Sa_static": st["Sa"], "Sa_dynamic": dy["Sa"], "Ln_static": st["Ln_min"], "Ln_dynamic": dy["Ln_min"]}

def characteristic(P=None, n_pts=6):
    """Force-length points from L0 to the solid length (linear model) with the working points L1, L2."""
    P = dict(P or DEFAULT)
    R = rate(P)
    g = geometry(P)
    pts = []
    for i in range(n_pts + 1):
        L = P["L0"] - (P["L0"] - g["Lc"]) * i / n_pts
        pts.append((L, R * (P["L0"] - L)))
    return {"R": R, "points": pts, "F1": R * (P["L0"] - P["L1"]), "F2": R * (P["L0"] - P["L2"]),
            "margin_to_solid": P["L2"] - g["Lc"]}

# ---------------------------------------------------------------- chapter 4: coil growth and guides
def coil_growth_EN(P=None):
    """Increase of the outer diameter at solid: Delta_De = 0.1 (m^2 - 0.8 m d - 0.2 d^2)/D with m = pitch of the unloaded spring
    (EN 13906-1 style, check). Compared with the value in geometry()."""
    P = dict(P or DEFAULT)
    g = geometry(P)
    m, d, D = g["pitch"], P["d"], P["D"]
    dDe = 0.1 * (m ** 2 - 0.8 * m * d - 0.2 * d ** 2) / D
    return {"pitch": m, "dDe_EN": dDe, "Da_solid_EN": g["Da"] + dDe, "Da_solid_core": g["Da_solid"]}

def guide_clearance(P=None):
    """Mandrel / sleeve sizes: diametral clearance ~0.02 D plus the coil growth (rule of thumb, check maker data)."""
    P = dict(P or DEFAULT)
    g = geometry(P)
    cg = coil_growth_EN(P)
    c = 0.02 * P["D"]
    return {"mandrel_max": g["Di"] - c, "sleeve_min": cg["Da_solid_EN"] + c, "clearance": c}

def progressive_two_zone(P=None, n_close=3.0, p_close=None):
    """Variable pitch: n_close coils with small pitch p_close close first, then only the other coils work.
    Zone rates R_i = G d^4/(8 D^3 n_i) in series; after zone 1 is solid the rate jumps to R_2."""
    P = dict(P or DEFAULT)
    G = MATERIALS[P["material"]]["G"]
    d, D, n = P["d"], P["D"], P["n"]
    p_close = p_close or d + 0.4 * (geometry(P)["pitch"] - d)
    n2 = n - n_close
    k = G * d ** 4 / (8 * D ** 3)
    R1, R2 = k / n_close, k / n2
    Rs = 1 / (1 / R1 + 1 / R2)
    s_gap1 = n_close * (p_close - d)              # travel until zone 1 is solid (zone 1 deflection)
    F_knee = R1 * s_gap1
    s_knee = F_knee / Rs
    return {"R_start": Rs, "R_after": R2, "F_knee": F_knee, "s_knee": s_knee, "p_close": p_close, "R_check_linear": rate(P)}

def series_parallel(R1, R2):
    return {"series": 1 / (1 / R1 + 1 / R2), "parallel": R1 + R2}

def nested(P=None, d_in=1.8, D_in=18.0, n_in=None):
    """Inner spring inside the outer one, same free length and same deflection: rates add; opposite hand avoids
    interlocking. Radial clearance between the coils must be > ~ (d_out + d_in)/2 + growth (check)."""
    P = dict(P or DEFAULT)
    n_in = n_in or P["n"]                         # same number of active coils as the outer spring (simple)
    Pi = dict(P, d=d_in, D=D_in, n=n_in)
    Ro, Ri = rate(P), rate(Pi)
    s = P["L0"] - P["L2"]
    _, to = stress(P, Ro * s)
    _, ti = stress(Pi, Ri * s)
    gap = (P["D"] - P["d"]) / 2 - (D_in + d_in) / 2
    return {"R_outer": Ro, "R_inner": Ri, "R_total": Ro + Ri, "tau_k_outer": to, "tau_k_inner": ti, "radial_gap": gap}

def buckling_nomogram(L0_over_D=(2, 3, 4, 5, 6, 8, 10)):
    """s_K / L0 for each seating case and slenderness (D 25 mm, VDSiCr): None = stable for any travel."""
    rows = []
    for seat, nu in SEATING.items():
        r = []
        for x in L0_over_D:
            L0 = x * DEFAULT["D"]
            b = buckling(dict(DEFAULT, seating=seat, L0=L0, L1=L0 - 1, L2=L0 - 2))
            r.append(None if b["sK"] is None else b["sK"] / L0)
        rows.append((seat, nu, r))
    return {"L0_over_D": L0_over_D, "rows": rows}

def stable_limit(nu, ge):
    """Slenderness L0/D below which the spring cannot buckle: pi / nu * sqrt((1 - G/E)/(0.5 + G/E))."""
    return math.pi / nu * math.sqrt((1 - ge) / (0.5 + ge))

def demo_ch24():
    P = dict(DEFAULT)
    print("## 2.1 Spring types")
    for t in SPRING_TYPES:
        print("  %-26s %-50s %-38s %s" % t)
    print("\n## 2.2 Wire classes")
    for w in WIRE_CLASSES:
        print("  %-10s %-24s %-38s T_max %3d C  %s" % (w[0], w[1], w[2], w[4], w[3]))
    print("\n## 2.3 Rm_min (MPa) vs wire diameter (fit A d^-m, check)")
    T = rm_table()
    print("  %-42s " % "material" + " ".join("d=%-5g" % d for d, _ in next(iter(T.values()))))
    for m, row in T.items():
        print("  %-42s " % m + " ".join("%-7.0f" % r for _, r in row))
    print("  tau_zul = 0.5 Rm for the default d %.1f: %.0f MPa" % (P["d"], tau_zul(P)))
    print("\n## 2.4 Relaxation (typical, check) - force loss after 48 h, %")
    for m, r in RELAXATION.items():
        print("  %-42s %s" % (m, ", ".join("%s %d" % kv for kv in r.items())))
    print("\n## 3.1 Rate by wire torsion")
    rt = rate_by_torsion(P)
    print("  wire length %.1f mm, Ip %.3f mm4, twist %.6f rad/N -> R %.4f N/mm (core rate() %.4f)" % (rt["l_wire"], rt["Ip"], rt["phi_per_N"], rt["R"], rt["R_core"]))
    print("\n## 3.2 Stress correction: Bergstraesser vs Wahl")
    for w, kb, kw, dv in correction_table():
        print("  w %4.1f: k_B %.4f, k_W %.4f (Wahl %+.2f %%)" % (w, kb, kw, dv))
    print("\n## 3.3 End types (n %.1f, L0 %.1f)" % (P["n"], P["L0"]))
    for e in end_types(P):
        print("  %-18s nt %4.1f, Lc %6.2f, pitch %.3f, helix %.2f deg, Ln_min %.2f" % (e["ends"], e["nt"], e["Lc"], e["pitch"], e["helix_deg"], e["Ln_min"]))
    mg = min_gap_rule(P)
    print("  min gap per coil %.3f mm -> Sa static %.2f / dynamic %.2f mm; Ln_min %.2f / %.2f mm" % (mg["per_coil"], mg["Sa_static"], mg["Sa_dynamic"], mg["Ln_static"], mg["Ln_dynamic"]))
    print("\n## 3.4 Characteristic (linear) with preload")
    ch = characteristic(P)
    for L, F in ch["points"]:
        print("  L %6.2f mm  F %6.1f N" % (L, F))
    print("  working points F1 %.1f N (L1 %.0f), F2 %.1f N (L2 %.0f); L2 - Lc = %.2f mm" % (ch["F1"], P["L1"], ch["F2"], P["L2"], ch["margin_to_solid"]))
    print("\n## 4.1 Coil growth and guides")
    cg = coil_growth_EN(P)
    gc = guide_clearance(P)
    print("  pitch %.3f mm: EN growth %.3f mm -> Da at solid %.2f (core geometry() gives %.2f)" % (cg["pitch"], cg["dDe_EN"], cg["Da_solid_EN"], cg["Da_solid_core"]))
    print("  clearance 0.02 D = %.2f mm: mandrel <= %.2f mm, sleeve >= %.2f mm" % (gc["clearance"], gc["mandrel_max"], gc["sleeve_min"]))
    print("\n## 4.2 Buckling nomogram s_K/L0 (D 25, VDSiCr; '-' = stable)")
    nm = buckling_nomogram()
    print("  %-26s nu   " % "seating" + " ".join("L0/D=%-4g" % x for x in nm["L0_over_D"]))
    for seat, nu, r in nm["rows"]:
        print("  %-26s %.1f  " % (seat, nu) + " ".join("%-9s" % ("-" if v is None else "%.3f" % v) for v in r))
    ge = MATERIALS[P["material"]]["G"] / MATERIALS[P["material"]]["E"]
    print("  stable for any travel if L0/D < " + ", ".join("%.2f (nu %.1f)" % (stable_limit(nu, ge), nu) for nu in SEATING.values()))
    print("\n## 4.3 Progressive spring (3 coils with small pitch)")
    pr = progressive_two_zone(P)
    print("  small pitch %.3f mm: R %.3f N/mm until F %.1f N (s %.2f mm), then R %.3f N/mm (uniform pitch: %.3f)" % (
        pr["p_close"], pr["R_start"], pr["F_knee"], pr["s_knee"], pr["R_after"], pr["R_check_linear"]))
    print("\n## 4.4 Series / parallel / nested")
    R = rate(P)
    sp = series_parallel(R, R)
    print("  two default springs: series %.3f N/mm, parallel %.3f N/mm (single %.3f)" % (sp["series"], sp["parallel"], R))
    ns = nested(P)
    print("  nested inner d 1.8 / D 18 / n %.1f: R outer %.3f + inner %.3f = %.3f N/mm; tau_k at L2 %.0f / %.0f MPa; radial gap %.2f mm" % (
        P["n"], ns["R_outer"], ns["R_inner"], ns["R_total"], ns["tau_k_outer"], ns["tau_k_inner"], ns["radial_gap"]))

# ================================================================ added with guide chapters (ch56)
# ---------------------------------------------------------------- 5.1 static strength
def tau_zul_curve(P, ds=(1.0, 2.0, 3.0, 5.0, 8.0)):
    """tau_zul = 0.5 Rm_min(d) for every material (uncorrected stress, EN 13906-1 style)."""
    return [(m, [(d, Rm_min(dict(P, material=m), d), tau_zul(dict(P, material=m), d)) for d in ds]) for m in MATERIALS]


PRESET_FACTOR = 1.12   # presetting (setting to solid after coiling) raises the usable static stress ~10-15 % (check)


def solid_safe_check(P):
    """Stress at solid length against tau_zul, without and with presetting."""
    F = forces(P)
    tc, _ = stress(P, F["Fc"])
    tz = tau_zul(P)
    return {"tau_c": tc, "tau_zul": tz, "tau_zul_preset": PRESET_FACTOR * tz,
            "solid_safe": tc <= tz, "solid_safe_preset": tc <= PRESET_FACTOR * tz}


# ---------------------------------------------------------------- 5.2 fatigue: Haigh lines, finite life
LIFE_FACTOR = {1e5: 1.45, 1e6: 1.15, 1e7: 1.00}   # tau_D0(N) / tau_D0(1e7) (check EN 13906-1 Annex fatigue diagrams)


def haigh_lines(P, n_pts=6):
    """Upper corrected stress limit tau_kO,lim(tau_kU) for 1e5, 1e6, 1e7 cycles; static limit tau_st = 0.5 Rm."""
    mat = MATERIALS[P["material"]]
    Rm = Rm_min(P)
    tst = 0.5 * Rm
    base = (mat["fD0_peened"] if P["shot_peened"] else mat["fD0"]) * Rm
    out = {}
    for N, fN in LIFE_FACTOR.items():
        tD0 = min(fN * base, 0.95 * tst)
        out[N] = [(tst * i / (n_pts - 1), tD0 + (1 - tD0 / tst) * tst * i / (n_pts - 1)) for i in range(n_pts)]
    return {"tau_st": tst, "lines": out}


def life_estimate(P):
    """Cycles reached by the working stroke (log interpolation between the 1e5 / 1e6 / 1e7 lines)."""
    ft = fatigue(P)
    mat = MATERIALS[P["material"]]
    Rm = Rm_min(P)
    tst = 0.5 * Rm
    base = (mat["fD0_peened"] if P["shot_peened"] else mat["fD0"]) * Rm
    pts = []
    for N, fN in sorted(LIFE_FACTOR.items()):
        tD0 = min(fN * base, 0.95 * tst)
        pts.append((N, tD0 + (1 - tD0 / tst) * ft["tau_kU"]))
    tkO = ft["tau_kO"]
    if tkO <= pts[-1][1]:
        return {"tau_kO": tkO, "N": float("inf"), "pts": pts}
    lo = sorted(pts, key=lambda p: p[0])
    for (Na, ta), (Nb, tb) in ((lo[2], lo[1]), (lo[1], lo[0])):
        if ta <= tkO <= tb:
            f = (tkO - ta) / (tb - ta)
            return {"tau_kO": tkO, "N": 10 ** (math.log10(Na) + f * (math.log10(Nb) - math.log10(Na))), "pts": pts}
    return {"tau_kO": tkO, "N": 0.0, "pts": pts}      # above the 1e5 line: short life / static limit, not covered


def peening_effect(P):
    """Fatigue safety with and without shot peening for every material (same geometry)."""
    rows = []
    for m in MATERIALS:
        a = fatigue(dict(P, material=m, shot_peened=False))["S_fat"]
        b = fatigue(dict(P, material=m, shot_peened=True))["S_fat"]
        rows.append((m, a, b))
    return rows


def fatigue_map(P, L1s=(60.0, 57.5, 55.0, 52.5, 50.0), strokes=(15.0, 20.0, 25.0)):
    """Fatigue safety vs installed length L1 (preload) and stroke (L2 = L1 - stroke)."""
    rows = []
    for L1 in L1s:
        row = []
        for st in strokes:
            Q = dict(P, L1=L1, L2=L1 - st)
            g = geometry(Q)
            ok_len = Q["L2"] >= g["Ln_min"]
            row.append((fatigue(Q)["S_fat"], ok_len))
        rows.append((L1, forces(dict(P, L1=L1))["F1"], row))
    return rows


# ---------------------------------------------------------------- 5.3 relaxation
RELAX = {   # force loss % after 48 h, VDSiCr type oil-tempered wire, vs temperature (rows) and tau/Rm (columns 0.3 / 0.4 / 0.5) - check maker data
    20: (0.5, 1.0, 2.0), 80: (1.5, 3.0, 5.0), 120: (3.0, 5.5, 9.0), 160: (5.0, 9.0, 14.0)}
RELAX_FACTOR = {"EN 10270-1 DH (patented, cold drawn)": 1.8, "EN 10270-2 VDSiCr (oil tempered, valve)": 1.0,
                "EN 10270-3 1.4310 (stainless)": 1.4}


def relaxation(P, T_C):
    """Bilinear interpolation of the relaxation table at the stress of L2 (uncorrected tau / Rm)."""
    F = forces(P)
    t2, _ = stress(P, F["F2"])
    r = t2 / Rm_min(P)
    Ts = sorted(RELAX)
    T = min(max(T_C, Ts[0]), Ts[-1])
    i = max(k for k in range(len(Ts)) if Ts[k] <= T) if T < Ts[-1] else len(Ts) - 2
    Ta, Tb = Ts[i], Ts[i + 1]
    xs = (0.3, 0.4, 0.5)
    rr = min(max(r, 0.3), 0.5)
    j = 0 if rr <= 0.4 else 1
    def lin(row):
        return row[j] + (row[j + 1] - row[j]) * (rr - xs[j]) / (xs[j + 1] - xs[j])
    va, vb = lin(RELAX[Ta]), lin(RELAX[Tb])
    loss = (va + (vb - va) * (T - Ta) / (Tb - Ta)) * RELAX_FACTOR[P["material"]]
    return {"T": T_C, "tau_over_Rm": r, "loss_pct": loss, "F2_after": F["F2"] * (1 - loss / 100), "F1_after": F["F1"] * (1 - loss / 100)}


# ---------------------------------------------------------------- 5.4 dynamics: wave speed, surge, impact
def wave_data(P):
    """Natural frequency and the travel time of the surge wave: f_e = 1/(2 t_wave) for a spring fixed at both ends."""
    fr = natural_frequency(P)
    mat = MATERIALS[P["material"]]
    m_act = mat["rho"] * math.pi ** 2 * P["d"] ** 2 * P["D"] * P["n"] / 4
    La = P["L1"] - 2 * P["d"]                           # active length approx at installation
    return {"fe": fr["fe"], "t_wave_ms": 1000 / (2 * fr["fe"]), "c_axial_m_s": 2 * fr["fe"] * La / 1000,
            "m_active_g": m_act * 1000, "m_eff_g": m_act * 1000 / 3}


def surge_sim(P, n_rpm=300.0, N=10, zeta=0.02, revs=3, cam_P=None):
    """Lumped multi-mass spring (N segments) driven at node 0 by the M6 cam lift, fixed at node N.
    Returns the maximum dynamic force at the fixed end compared with the static force R*s(t), last revolution."""
    import cam                                          # M6 program (sibling tool)
    CP = cam_P or dict(cam.DEFAULT, n_rpm=n_rpm)
    mat = MATERIALS[P["material"]]
    m_act = mat["rho"] * math.pi ** 2 * P["d"] ** 2 * P["D"] * P["n"] / 4      # kg
    R = rate(P) * 1000.0                                # N/m
    k = R * N
    m = m_act / N
    c = 2 * zeta * math.sqrt(k * m)
    w = 2 * math.pi * n_rpm / 60.0
    T_rev = 2 * math.pi / w
    f_top = 2 * math.sqrt(k / m) / (2 * math.pi)        # highest chain frequency
    dt = min(1.0 / (40 * f_top), T_rev / 2000)
    nsteps = int(revs * T_rev / dt)
    u = [0.0] * (N - 1)                                 # interior nodes 1..N-1
    v = [0.0] * (N - 1)
    def base(t):
        return cam.motion(CP, math.degrees(w * t))[0] / 1000.0
    def base_v(t):
        return cam.motion(CP, math.degrees(w * t))[1] / 1000.0 * w
    def acc(t, u, v):
        x0, v0 = base(t), base_v(t)
        a = []
        for i in range(N - 1):
            xl = x0 if i == 0 else u[i - 1]
            vl = v0 if i == 0 else v[i - 1]
            xr = 0.0 if i == N - 2 else u[i + 1]
            vr = 0.0 if i == N - 2 else v[i + 1]
            a.append((k * (xl - u[i]) - k * (u[i] - xr) + c * (vl - v[i]) - c * (v[i] - vr)) / m)
        return a
    t = 0.0
    Fmax_dev = 0.0
    Fdyn_max = 0.0
    Fstat_max = 0.0
    t_last = (revs - 1) * T_rev
    for _ in range(nsteps):
        a1 = acc(t, u, v)
        u2 = [u[i] + 0.5 * dt * v[i] for i in range(N - 1)]; v2 = [v[i] + 0.5 * dt * a1[i] for i in range(N - 1)]
        a2 = acc(t + 0.5 * dt, u2, v2)
        u3 = [u[i] + 0.5 * dt * v2[i] for i in range(N - 1)]; v3 = [v[i] + 0.5 * dt * a2[i] for i in range(N - 1)]
        a3 = acc(t + 0.5 * dt, u3, v3)
        u4 = [u[i] + dt * v3[i] for i in range(N - 1)]; v4 = [v[i] + dt * a3[i] for i in range(N - 1)]
        a4 = acc(t + dt, u4, v4)
        u = [u[i] + dt / 6 * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i]) for i in range(N - 1)]
        v = [v[i] + dt / 6 * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]) for i in range(N - 1)]
        t += dt
        if t >= t_last:
            Fd = k * u[-1]                              # force of the last segment on the frame (dynamic part of the stroke force)
            Fs = R * base(t)
            Fmax_dev = max(Fmax_dev, abs(Fd - Fs))
            Fdyn_max = max(Fdyn_max, Fd)
            Fstat_max = max(Fstat_max, Fs)
    fe = natural_frequency(P)["fe"]
    return {"fe": fe, "f_exc": n_rpm / 60.0, "ratio": fe / (n_rpm / 60.0), "F_stat_max": Fstat_max, "F_dyn_max": Fdyn_max,
            "dev_max": Fmax_dev, "amplification": Fdyn_max / Fstat_max, "dev_pct": 100 * Fmax_dev / Fstat_max,
            "steps": nsteps, "dt_us": dt * 1e6}


SOFT_LONG = {"d": 3.8, "n": 44.0, "L0": 254.9, "L1": 236.4, "L2": 216.7}   # candidate of the design table with f_e ~ 49 Hz


def impact_limit(P):
    """Stress of a velocity step v at the coil end: tau = v sqrt(2 G rho) (k = 1); allowed v from tau_zul - tau(F2)."""
    mat = MATERIALS[P["material"]]
    Z = math.sqrt(2 * mat["G"] * 1e6 * mat["rho"] * 1e9) / 1e6      # MPa per m/s
    t2, _ = stress(P, forces(P)["F2"])
    v_max = (tau_zul(P) - t2) / Z
    return {"MPa_per_m_s": Z, "v_allow": v_max, "tau_at_cam_vmax": Z * 0.600}


# ---------------------------------------------------------------- 6.1 design in depth
def design_2d(P, Ds=(17.5, 20.0, 22.5, 25.0, 27.5)):
    """Design table for several mean diameters D: lightest passing (d, n) for each D and the overall best."""
    rows = []
    for D in Ds:
        Q = dict(P, req=dict(P["req"], D=D))
        dz = design_from_requirements(Q)
        b = dz["best"]
        rows.append((D, b))
    good = [(D, b) for D, b in rows if b]
    best = min(good, key=lambda r: r[1]["mass_g"]) if good else None
    return {"rows": rows, "best": best}


def tradeoff(P):
    """Mass, natural frequency, length and safety of the passing candidates of the core design table."""
    dz = design_from_requirements(P)
    return [c for c in dz["candidates"] if c["ok"]]


# ---------------------------------------------------------------- 6.2 tension springs
TENSION = {"d": 2.0, "D": 16.0, "n": 20.0, "tau0": 60.0, "F": 100.0, "r2_over_d": 2.0,
           "material": "EN 10270-1 DH (patented, cold drawn)"}


def tension_spring(T=None):
    """Helical tension spring with full-loop (German) hooks: initial tension, rate, body and hook stresses."""
    T = dict(TENSION, **(T or {}))
    mat = MATERIALS[T["material"]]
    d, D, n = T["d"], T["D"], T["n"]
    w = D / d
    F0 = math.pi * d ** 3 * T["tau0"] / (8 * D)          # initial tension from the coiling stress tau0
    R = mat["G"] * d ** 4 / (8 * D ** 3 * n)
    s = (T["F"] - F0) / R if T["F"] > F0 else 0.0
    tau_body = berg(w) * 8 * T["F"] * D / (math.pi * d ** 3)
    C1 = w                                             # hook bend radius r1 = D/2
    KA = (4 * C1 ** 2 - C1 - 1) / (4 * C1 * (C1 - 1))
    sigA = T["F"] * (16 * D / (math.pi * d ** 3) * KA + 4 / (math.pi * d ** 2))      # bending + tension in the hook
    C2 = 2 * T["r2_over_d"]
    KB = (4 * C2 - 1) / (4 * C2 - 4)
    tauB = 8 * T["F"] * D / (math.pi * d ** 3) * KB      # torsion at the hook transition
    Rm = mat["A"] * d ** (-mat["m"])
    return {"w": w, "F0": F0, "R": R, "s": s, "tau_body": tau_body, "sigma_hook": sigA, "tau_hook": tauB, "Rm": Rm,
            "tau_allow": 0.45 * Rm, "sigma_allow": 0.70 * Rm,
            "ok": tau_body <= 0.45 * Rm and sigA <= 0.70 * Rm and tauB <= 0.45 * Rm}


# ---------------------------------------------------------------- 6.3 torsion springs
TORSION = {"d": 2.0, "D": 20.0, "n": 6.0, "M": 800.0, "mandrel": 15.0, "material": "EN 10270-1 DH (patented, cold drawn)"}


def torsion_spring(T=None):
    """Helical torsion spring: angular rate, bending stress with q, coil-diameter reduction, mandrel clearance."""
    T = dict(TORSION, **(T or {}))
    mat = MATERIALS[T["material"]]
    d, D, n, M = T["d"], T["D"], T["n"], T["M"]
    w = D / d
    RM = mat["E"] * d ** 4 / (64 * D * n)              # N mm per rad
    phi = M / RM
    q = (w + 0.07) / (w - 0.75)
    sig = q * 32 * M / (math.pi * d ** 3)
    D_loaded = D * n / (n + phi / (2 * math.pi))
    Di_loaded = D_loaded - d
    Rm = mat["A"] * d ** (-mat["m"])
    return {"w": w, "R_M_Nmm_rad": RM, "R_M_Nmm_deg": RM * math.pi / 180, "phi_deg": math.degrees(phi), "q": q,
            "sigma": sig, "sigma_allow": 0.7 * Rm, "D_loaded": D_loaded, "Di_loaded": Di_loaded,
            "clearance_pct": 100 * (Di_loaded - T["mandrel"]) / T["mandrel"], "ok": sig <= 0.7 * Rm}


# ---------------------------------------------------------------- demo
def demo_ch56():
    P = dict(DEFAULT)
    print("## 5.1 Permissible static stress tau_zul = 0.5 Rm_min(d)")
    for m, rows in tau_zul_curve(P):
        print("  %-42s " % m + "  ".join("d %.0f: %4.0f/%3.0f" % (d, Rm, tz) for d, Rm, tz in rows))
    sc = solid_safe_check(P)
    print("  default spring: tau at solid %.0f MPa, tau_zul %.0f, after presetting %.0f -> solid safe %s / %s" % (
        sc["tau_c"], sc["tau_zul"], sc["tau_zul_preset"], sc["solid_safe"], sc["solid_safe_preset"]))
    print("\n## 5.2 Haigh lines (corrected stresses, MPa): tau_kO,lim at tau_kU")
    H = haigh_lines(P)
    for N, pts in H["lines"].items():
        print("  N %.0e: " % N + "  ".join("%3.0f->%3.0f" % p for p in pts))
    ft = fatigue(P)
    le = life_estimate(P)
    print("  default: tau_kU %.0f, tau_kO %.0f MPa -> limit at 1e7 %.0f MPa, expected life %s" % (
        ft["tau_kU"], ft["tau_kO"], ft["tau_kO_lim"], "endurance (> 1e7)" if le["N"] == float("inf") else "%.2e" % le["N"]))
    Q = dict(P, n=5.0, d=2.2, L0=59.2, L1=59.2 - 55 / rate(dict(P, n=5.0, d=2.2)), L2=20.7)
    le2 = life_estimate(Q)
    print("  lightest candidate d 2.2 / n 5: tau_kU %.0f, tau_kO %.0f -> life %s, S_fat %.2f" % (
        fatigue(Q)["tau_kU"], fatigue(Q)["tau_kO"], "endurance (> 1e7)" if le2["N"] == float("inf") else "%.2e" % le2["N"], fatigue(Q)["S_fat"]))
    Q3 = dict(P, n=3.5, d=2.0, L0=53.9, L1=53.9 - 55 / rate(dict(P, n=3.5, d=2.0)), L2=15.0)
    le3 = life_estimate(Q3)
    print("  failing candidate d 2.0 / n 3.5: tau_kO %.0f MPa > 1e5 line %.0f MPa -> %s" % (
        fatigue(Q3)["tau_kO"], le3["pts"][0][1], "less than 1e5 cycles (5.6 h at 5 Hz) - not usable" if le3["N"] == 0 else "%.2e cycles" % le3["N"]))
    print("  shot peening (same geometry): " + "; ".join("%s %.2f -> %.2f" % (m.split(" (")[0], a, b) for m, a, b in peening_effect(P)))
    print("  fatigue safety vs installed length L1 (preload) and stroke:")
    for L1, F1, row in fatigue_map(P):
        print("    L1 %.1f (F1 %5.1f N): " % (L1, F1) + "  ".join("stroke %2.0f: %s" % (st, ("%.2f" % s) + ("" if okl else " (L2 < Ln_min)"))
                                                         for st, (s, okl) in zip((15, 20, 25), row)))
    print("\n## 5.3 Relaxation (force loss after 48 h, check)")
    for T in (20, 80, 120, 160):
        r = relaxation(P, T)
        print("  %3d C: tau/Rm %.3f -> loss %.2f %%, F1 %.1f -> %.1f N, F2 %.1f -> %.1f N" % (
            T, r["tau_over_Rm"], r["loss_pct"], forces(P)["F1"], r["F1_after"], forces(P)["F2"], r["F2_after"]))
    for m in MATERIALS:
        print("  120 C, %-42s loss %.2f %%" % (m, relaxation(dict(P, material=m), 120)["loss_pct"]))
    print("\n## 5.4 Dynamics")
    wd = wave_data(P)
    print("  f_e %.1f Hz, wave travel time %.2f ms, axial wave speed %.1f m/s, active mass %.1f g, effective mass (1/3) %.1f g" % (
        wd["fe"], wd["t_wave_ms"], wd["c_axial_m_s"], wd["m_active_g"], wd["m_eff_g"]))
    s1 = surge_sim(P)
    print("  surge, default spring (f_e %.0f Hz = %.1f x 5 Hz): F_stat,max %.1f N, F_dyn,max %.1f N, max deviation %.2f N (%.1f %%), %d steps dt %.1f us" % (
        s1["fe"], s1["ratio"], s1["F_stat_max"], s1["F_dyn_max"], s1["dev_max"], s1["dev_pct"], s1["steps"], s1["dt_us"]))
    PL = dict(P, **SOFT_LONG)
    s2 = surge_sim(PL)
    print("  surge, soft long spring d 3.8 n 44 (f_e %.0f Hz = %.1f x 5 Hz): F_stat,max %.1f N, F_dyn,max %.1f N, deviation %.1f N (%.1f %%)" % (
        s2["fe"], s2["ratio"], s2["F_stat_max"], s2["F_dyn_max"], s2["dev_max"], s2["dev_pct"]))
    s3 = surge_sim(PL, n_rpm=400.0)
    print("  same soft spring at 400 rpm (ratio %.1f): F_dyn,max %.1f N vs static %.1f N, deviation %.1f N (%.1f %%)" % (
        s3["ratio"], s3["F_dyn_max"], s3["F_stat_max"], s3["dev_max"], s3["dev_pct"]))
    im = impact_limit(P)
    print("  impact: %.1f MPa per m/s; stress from the cam v_max 0.6 m/s %.1f MPa; allowed velocity step %.1f m/s" % (
        im["MPa_per_m_s"], im["tau_at_cam_vmax"], im["v_allow"]))
    print("\n## 6.1 Design: passing candidates of the core table (trade-off)")
    for c in tradeoff(P):
        print("  d %.1f n %4.1f: mass %5.1f g, L0 %6.1f mm, f_e %3.0f Hz, S_static %.2f, S_fat %.2f" % (
            c["d"], c["n"], c["mass_g"], c["L0"], c["fe"], c["S_2"], c["S_fat"]))
    print("  2-D search over D (Da_max %.0f mm):" % P["req"]["Da_max"])
    dd = design_2d(P)
    for D, b in dd["rows"]:
        print("    D %4.1f: %s" % (D, "d %.1f n %.1f, %.1f g, L0 %.1f, f_e %.0f Hz, S_fat %.2f" % (b["d"], b["n"], b["mass_g"], b["L0"], b["fe"], b["S_fat"]) if b else "none passes"))
    if dd["best"]:
        D, b = dd["best"]
        print("  lightest overall: D %.1f, d %.1f, n %.1f, %.1f g" % (D, b["d"], b["n"], b["mass_g"]))
    print("\n## 6.2 Tension spring (d 2, D 16, n 20, tau0 60 MPa, F 100 N, DH wire)")
    t = tension_spring()
    print("  w %.1f, initial tension F0 %.1f N, rate %.3f N/mm, extension %.1f mm; body tau %.0f (allow %.0f), hook sigma %.0f (allow %.0f), hook tau %.0f MPa -> %s" % (
        t["w"], t["F0"], t["R"], t["s"], t["tau_body"], t["tau_allow"], t["sigma_hook"], t["sigma_allow"], t["tau_hook"], "OK" if t["ok"] else "NOT OK"))
    t2 = tension_spring({"F": 160.0})
    print("  F 160 N: body tau %.0f, hook sigma %.0f (allow %.0f) -> %s" % (t2["tau_body"], t2["sigma_hook"], t2["sigma_allow"], "OK" if t2["ok"] else "NOT OK"))
    print("\n## 6.3 Torsion spring (d 2, D 20, n 6, M 800 N mm, mandrel 15 mm)")
    q = torsion_spring()
    print("  w %.1f, rate %.1f N mm/rad = %.2f N mm/deg, angle %.1f deg, q %.4f, sigma %.0f MPa (allow %.0f) -> %s" % (
        q["w"], q["R_M_Nmm_rad"], q["R_M_Nmm_deg"], q["phi_deg"], q["q"], q["sigma"], q["sigma_allow"], "OK" if q["ok"] else "NOT OK"))
    print("  loaded mean diameter %.2f mm, inner diameter %.2f mm -> clearance to mandrel %.1f %%" % (q["D_loaded"], q["Di_loaded"], q["clearance_pct"]))
    q2 = torsion_spring({"M": 1500.0})
    print("  M 1500 N mm: angle %.1f deg, sigma %.0f MPa -> %s, inner diameter %.2f mm, clearance %.1f %%" % (
        q2["phi_deg"], q2["sigma"], "OK" if q2["ok"] else "NOT OK", q2["Di_loaded"], q2["clearance_pct"]))

# ================================================================ added with guide chapters (ch78)
# ---------------------------------------------------------------- 7.1 process chain
PROCESS_CHAIN_SPRING = [   # step, purpose, typical data (check with the spring maker)
    ("wire (EN 10270)", "patented + cold drawn (DH) or oil hardened + tempered (VDSiCr); surface free of seams", "Rm from the wire certificate"),
    ("CNC coiling", "wire fed over rolls, bent at the coiling point, pitch tool sets the pitch, cut-off knife", "feed 30-120 m/min"),
    ("stress relief (tempering)", "removes coiling residual stress, raises elastic limit, stabilises D", "VDSiCr ~420 C 30 min, DH ~280 C 30 min (check)"),
    ("end grinding", "closed ends ground flat and square, double-disc grinder, several passes", "perpendicularity e1"),
    ("shot peening", "compressive residual stress in the surface, raises fatigue strength 20-30 %", "Almen 0.3-0.5 mmA, coverage >= 200 %"),
    ("low-temperature tempering", "after peening, stabilises residual stress (valve springs)", "~220 C 30 min (check)"),
    ("setting (presetting)", "compress to solid once or several times: L0 drops by the set, relaxation in service falls", "cold or hot setting"),
    ("coating", "corrosion protection: oil, phosphate + oil, powder coat, zinc flake (no electroplating for Rm > 1000)", "-"),
    ("100 % test", "force at L1 / L2, sorting into classes, L0, marking", "load tester"),
]
STRESS_RELIEF = {   # temperature C, time min (typical, check with the wire supplier)
    "EN 10270-1 DH (patented, cold drawn)": (280, 30),
    "EN 10270-2 VDSiCr (oil tempered, valve)": (420, 30),
    "EN 10270-3 1.4310 (stainless)": (380, 30),
}

def coiling_tool_diameter(P, yield_ratio=0.85):
    """Spring-back of a fully plastic bend: 1/R_tool - 1/R = M_p/(E I) = 3.395 sigma_y/(E d), sigma_y = yield_ratio x Rm (check)."""
    mat = MATERIALS[P["material"]]
    sy = yield_ratio * Rm_min(P)
    dk = 3.395 * sy / (mat["E"] * P["d"])
    R = P["D"] / 2
    R_tool = 1 / (1 / R + dk)
    return {"sigma_y": sy, "delta_kappa": dk, "D_tool": 2 * R_tool, "springback_pct": 100 * (P["D"] - 2 * R_tool) / P["D"]}

def wire_length(P):
    """Developed wire length L = nt sqrt((pi D)^2 + pitch^2) for the active part (approximation; dead coils at pitch d)."""
    g = geometry(P)
    act = P["n"] * math.hypot(math.pi * P["D"], g["pitch"])
    dead = (g["nt"] - P["n"]) * math.hypot(math.pi * P["D"], P["d"])
    return act + dead

def coiling_time(P, v_feed=60.0, t_cut=0.3):
    L = wire_length(P)
    t = L / (v_feed * 1000 / 60) + t_cut
    return {"L_wire": L, "t_s": t, "parts_per_min": 60 / t}

# ---------------------------------------------------------------- 7.2 setting (presetting)
def set_amount(P, tau_y_ratio=0.55):
    """Elastic-perfectly-plastic torsion of the wire when compressed to solid. tau_el = elastic-equivalent surface stress
    at solid; elastic core ratio rho = tau_y/tau_el; torque -> recoverable stress tau_T = (4/3) tau_y (1 - rho^3/4);
    permanent set = (tau_el - tau_T)/tau_el x s_c. tau_y = tau_y_ratio x Rm (torsional yield, check)."""
    F = forces(P)
    tau_el, _ = stress(P, F["Fc"])
    ty = tau_y_ratio * Rm_min(P)
    if tau_el <= ty:
        return {"tau_el": tau_el, "tau_y": ty, "set_mm": 0.0, "L0_before": P["L0"], "needed": False}
    rho = ty / tau_el
    tT = 4.0 / 3.0 * ty * (1 - rho ** 3 / 4)
    s_set = (tau_el - tT) / tau_el * F["sc"]
    return {"tau_el": tau_el, "tau_y": ty, "rho": rho, "tau_T": tT, "set_mm": s_set, "L0_before": P["L0"] + s_set, "needed": True}

# ---------------------------------------------------------------- 7.3 coating, cost
COATINGS_SPRING = [   # coating, protection, hydrogen risk for Rm > 1000 MPa, note
    ("oiled", "transport / indoor", "none", "standard for valve springs in oil"),
    ("phosphate + oil", "light, indoor", "low (pickling!) - bake within 1 h (check)", "good paint base"),
    ("powder coat (epoxy)", "outdoor, cured ~180 C", "none", "cure acts as low-temperature tempering"),
    ("zinc flake (Geomet / Delta)", "salt spray 480-1000 h", "none", "preferred for high-strength springs"),
    ("electroplated zinc", "medium", "HIGH - avoid for Rm > 1000 MPa or bake 200 C 4 h (check)", "hydrogen embrittlement -> delayed fracture"),
]

def cost_per_spring(P, wire_eur_kg=3.8, rate_coil=60.0, rate_grind=50.0, peen_eur=0.03, relief_eur=0.01, set_test_eur=0.04, batch=5000, setup_min=60):
    g = geometry(P)
    ct = coiling_time(P)
    wire = g["mass_kg"] * 1.03 * wire_eur_kg               # 3 % scrap
    coil = ct["t_s"] / 3600 * rate_coil
    grind = 2.0 / 3600 * rate_grind                        # ~2 s per spring on a double-disc grinder (check)
    setup = setup_min / 60 * rate_coil / batch
    tot = wire + coil + grind + (peen_eur if P["shot_peened"] else 0) + relief_eur + set_test_eur + setup
    return {"wire": wire, "coiling": coil, "grinding": grind, "peening": peen_eur if P["shot_peened"] else 0.0,
            "relief": relief_eur, "set_test": set_test_eur, "setup": setup, "total": tot}

# ---------------------------------------------------------------- 7.4 tolerances (EN 15800 style, simplified)
GRADE_Q = {1: 0.63, 2: 1.0, 3: 1.6}

def tolerances(P, grade=2):
    """Simplified EN 15800 style (check the standard): A_D = +/- 0.010 D q, A_L0 = +/- 0.015 L0 q,
    rate tolerance A_R = +/- 0.05 R q, force tolerance A_F = sqrt((A_R s)^2 + (R A_L0)^2),
    perpendicularity e1 = 0.026 L0 q (~1.5 deg for grade 2), parallelism e2 = 0.015 Da q."""
    q = GRADE_Q[grade]
    F = forces(P)
    g = geometry(P)
    AD = 0.010 * P["D"] * q
    AL0 = 0.015 * P["L0"] * q
    AR = 0.05 * F["R"] * q
    AF1 = math.hypot(AR * F["s1"], F["R"] * AL0)
    AF2 = math.hypot(AR * F["s2"], F["R"] * AL0)
    return {"grade": grade, "AD": AD, "AL0": AL0, "AR": AR, "AF1": AF1, "AF2": AF2,
            "e1": 0.026 * P["L0"] * q, "e1_deg": math.degrees(math.atan(0.026 * q)), "e2": 0.015 * g["Da"] * q}

def preload_scatter(P, grade=2, F_req=50.0):
    """Lowest preload in the batch vs the requirement of the mechanism (M6: preload >= 50 N against lift-off)."""
    t = tolerances(P, grade)
    F1 = forces(P)["F1"]
    return {"F1": F1, "AF1": t["AF1"], "F1_min": F1 - t["AF1"], "ok": F1 - t["AF1"] >= F_req}

# ---------------------------------------------------------------- 7.5 inspection, drawing data, failures
INSPECTION_PLAN = [   # characteristic, method, frequency
    ("wire d, Rm", "certificate 3.1 + micrometer, tensile test per coil lot", "per lot"),
    ("surface of wire", "eddy-current test in the drawing line (seams, laps)", "100 % (wire maker)"),
    ("L0", "height gauge / camera", "100 % or SPC"),
    ("F1, F2 at L1, L2", "load tester, sorting", "100 %"),
    ("D / Da / Di", "go / no-go sleeve and mandrel", "SPC"),
    ("e1, e2", "square and feeler, or camera", "SPC"),
    ("shot-peening intensity", "Almen strip A, coverage by magnifier", "per batch"),
    ("fatigue", "sample test on a spring fatigue machine to 1e7 cycles", "per lot / first article"),
    ("decarburisation, cracks", "metallography, magnetic particle", "first article / per lot"),
]

def drawing_block(P, grade=2):
    """Data required on a compression-spring drawing (EN ISO 2162-1 style) with values from the program."""
    g, F, t = geometry(P), forces(P), tolerances(P, grade)
    return [("wire diameter d", "%.2f mm" % P["d"]), ("outside diameter Da", "%.2f +/- %.2f mm" % (g["Da"], t["AD"])),
            ("guide (mandrel / sleeve)", "Di %.1f mm / Da %.1f mm (min. guide clearance ~0.1 D, check)" % (g["Di"], g["Da"])),
            ("active coils n / total nt", "%.1f / %.1f" % (P["n"], g["nt"])), ("coiling direction", "right hand (unless specified)"),
            ("ends", P["ends"]), ("free length L0 (reference)", "%.1f mm" % P["L0"]),
            ("F1 at L1", "%.1f N +/- %.1f N at %.1f mm" % (F["F1"], t["AF1"], P["L1"])),
            ("F2 at L2", "%.1f N +/- %.1f N at %.1f mm" % (F["F2"], t["AF2"], P["L2"])),
            ("solid length Lc max", "%.2f mm" % g["Lc"]), ("rate R", "%.3f N/mm (reference)" % F["R"]),
            ("perpendicularity e1 / parallelism e2", "%.2f / %.2f mm" % (t["e1"], t["e2"])),
            ("material", P["material"]), ("surface", ("shot peened, " if P["shot_peened"] else "") + "set to solid, oiled"),
            ("tolerance grade", "EN 15800 grade %d" % grade), ("cycles / loading", "dynamic, 1e7 cycles F1 -> F2" if P["dynamic"] else "static")]

FAILURES_SPRING = [   # failure, appearance, cause, remedy
    ("fatigue fracture", "45 deg helical fracture from the inner side of the coil", "stroke stress too high, surface defect, no peening", "lower tau_kH, peening, better wire"),
    ("surge fracture", "breaks near the end coils, high-speed cams / valves", "natural frequency near a cam harmonic", "raise f_e, damping, progressive pitch"),
    ("relaxation / set", "load F1 drops in service", "stress near tau_y, temperature", "presetting, VDSiCr, lower stress"),
    ("buckling / rubbing", "wear marks on coils or guide", "L0/D too large, no guide", "guide on mandrel or sleeve, shorter spring"),
    ("corrosion fatigue", "pits as fracture origin", "humidity, no coating", "zinc flake, stainless"),
    ("hydrogen fracture", "brittle, intergranular, delayed (hours / days)", "electroplating or pickling of high-strength wire", "no electroplating, baking"),
    ("coil clash", "noise, wear at contact points", "L2 below Ln_min, uneven pitch", "keep minimum gaps Sa"),
]

# ---------------------------------------------------------------- chapter 8: worked example
def example_requirements(rpm=400.0, F0=70.0, k=4.0, stroke=20.0, D=25.0, Da_max=30.0):
    """Spring for the M6 cam redesigned for 400 rpm (cam_example.json): preload 70 N on the base circle, 4 N/mm."""
    return {"F1": F0, "F2": F0 + k * stroke, "stroke": stroke, "D": D, "Da_max": Da_max}, rpm / 60.0

def worked_example():
    rq, fexc = example_requirements()
    P = dict(DEFAULT, req=rq, f_exc=fexc, name="Follower spring for the M6 cam at 400 rpm (preload 70 N, 4 N/mm, stroke 20 mm)")
    dz = design_from_requirements(P)
    return P, dz

def example_json(P, cand):
    s1 = P["req"]["F1"] / cand["R"]
    return {"name": P["name"], "d": cand["d"], "D": P["req"]["D"], "n": cand["n"],
            "L0": round(cand["L0"], 1), "L1": round(cand["L0"] - s1, 1), "L2": round(cand["L0"] - s1 - P["req"]["stroke"], 1),
            "f_exc": round(P["f_exc"], 3), "req": P["req"]}

def demo_ch78():
    P = dict(DEFAULT)
    print("## 7.1 Process chain")
    for s in PROCESS_CHAIN_SPRING:
        print("  %-26s %s | %s" % s)
    print("\n## 7.2 Coiling: spring-back and tool diameter, wire length, coiling time")
    c = coiling_tool_diameter(P)
    print("  sigma_y %.0f MPa, curvature change %.5f 1/mm -> coiling diameter %.2f mm for D %.1f (spring-back %.1f %%)" % (
        c["sigma_y"], c["delta_kappa"], c["D_tool"], P["D"], c["springback_pct"]))
    ct = coiling_time(P)
    print("  wire length %.0f mm, coiling %.2f s per spring (%.0f per min) at 60 m/min" % (ct["L_wire"], ct["t_s"], ct["parts_per_min"]))
    t, m = STRESS_RELIEF[P["material"]]
    print("  stress relief %s: %d C, %d min (check)" % (P["material"], t, m))
    print("\n## 7.3 Setting (presetting) to solid")
    for d, n, L0x in ((2.5, 8.5, None), (2.2, 5.0, None), (2.0, 3.5, None), (2.0, 3.5, 70.0), (2.0, 3.5, 90.0)):
        Q = dict(P, d=d, n=n)
        rq = P["req"]
        R = rate(Q)
        s1 = rq["F1"] / R
        g = geometry(Q)
        L2 = g["Ln_min"] + 0.5
        L0 = L0x or (L2 + s1 + rq["stroke"])
        Q.update(L0=L0, L1=L0 - s1, L2=L2)
        st = set_amount(Q)
        print("  d %.1f n %.1f L0 %5.1f: tau at solid %.0f MPa, tau_y %.0f MPa -> %s" % (d, n, L0, st["tau_el"], st["tau_y"],
              "set %.2f mm, coil to L0 %.2f before setting" % (st["set_mm"], st["L0_before"]) if st["needed"] else "no set (elastic)"))
    print("\n## 7.4 Shot peening effect (same spring)")
    for pe in (False, True):
        f = fatigue(dict(P, shot_peened=pe))
        print("  peened %-5s tau_D0 %.0f MPa, allowed stroke %.0f MPa -> S_fat %.2f" % (pe, f["tau_D0"], f["tau_kH_lim"], f["S_fat"]))
    print("\n## 7.5 Coatings")
    for c in COATINGS_SPRING:
        print("  %-28s %-26s H-risk: %s" % c[:3])
    print("\n## 7.6 Cost per spring (batch 5000, check rates)")
    k = cost_per_spring(P)
    print("  " + ", ".join("%s %.3f" % (a, b) for a, b in k.items()) + " EUR")
    print("\n## 7.7 Tolerances (EN 15800 style, simplified) and preload scatter")
    for gr in (1, 2, 3):
        tl = tolerances(P, gr)
        ps = preload_scatter(P, gr)
        print("  grade %d: A_D +/-%.2f, A_L0 +/-%.2f mm, A_R +/-%.3f N/mm, A_F1 +/-%.1f N, A_F2 +/-%.1f N, e1 %.2f mm (%.1f deg), e2 %.2f mm; F1 min %.1f N %s" % (
            gr, tl["AD"], tl["AL0"], tl["AR"], tl["AF1"], tl["AF2"], tl["e1"], tl["e1_deg"], tl["e2"], ps["F1_min"], ">= 50 N OK" if ps["ok"] else "< 50 N"))
    print("\n## 7.8 Inspection plan")
    for r in INSPECTION_PLAN:
        print("  %-24s %-58s %s" % r)
    print("\n## 7.9 Drawing data (EN ISO 2162 style)")
    for a, b in drawing_block(P):
        print("  %-38s %s" % (a, b))
    print("\n## 7.10 Failures")
    for f in FAILURES_SPRING:
        print("  %-18s | %s | %s" % (f[0], f[2], f[3]))
    print("\n## 8.2 Worked example: M6 cam at 400 rpm")
    Q, dz = worked_example()
    print("  requirements F1 %.0f N, F2 %.0f N, stroke %.0f mm, D %.0f -> R %.2f N/mm; excitation %.3f Hz, f_e needed > %.0f Hz" % (
        Q["req"]["F1"], Q["req"]["F2"], Q["req"]["stroke"], Q["req"]["D"], dz["R_req"], Q["f_exc"], Q["harmonic_max"] * Q["f_exc"]))
    for c in dz["candidates"][:8]:
        print("  d %.1f n %4.1f R %.2f L0 %6.1f L2 %5.1f %4.0f g S_st %.2f S_fat %.2f f_e %3.0f Hz %s" % (
            c["d"], c["n"], c["R"], c["L0"], c["L2"], c["mass_g"], c["S_2"], c["S_fat"], c["fe"], "OK" if c["ok"] else "fails: " + ", ".join(c["fails"])))
    b = dz["best"]
    print("  lightest passing: d %.1f n %.1f L0 %.1f" % (b["d"], b["n"], b["L0"]))
    print("  example JSON:", json.dumps(example_json(Q, b)))

def cmd_examples():
    P = dict(DEFAULT)
    print(report_text(P))
    print("\n## Materials (same geometry)")
    for m in MATERIALS:
        Q = dict(P, material=m)
        S = summary(Q)
        print("  %-42s Rm %4.0f, R %.3f, S_static %.2f, S_fat %.2f, f_e %.0f Hz" % (m, Rm_min(Q), S["F"]["R"], S["static"]["S_2"], S["fat"]["S_fat"], S["freq"]["fe"]))
    print("\n## Seating and buckling (L0 varied)")
    for L0 in (70, 100, 130, 160):
        for seat in ("both ends fixed, guided", "both pinned"):
            Q = dict(P, L0=float(L0), L1=L0 - 10.0, L2=L0 - 30.0, seating=seat)
            b = buckling(Q)
            print("  L0 %3d (L0/D %.1f), %-24s s_K %s, s2 30 -> %s" % (L0, L0 / P["D"], seat, "%.1f" % b["sK"] if b["sK"] else "none", "OK" if b["safe"] else "BUCKLES"))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-66s %s %s" % (name, "OK  " if cond else "FAIL", info))
    P = dict(DEFAULT)
    F = forces(P)
    chk("F = R s at both working points", abs(F["F2"] - F["R"] * F["s2"]) < 1e-12 and abs(F["F1"] - F["R"] * F["s1"]) < 1e-12)
    chk("work = (F1 + F2)/2 x stroke", abs(F["W12_J"] - 0.5 * (F["F1"] + F["F2"]) * (F["s2"] - F["s1"]) / 1000) < 1e-12)
    chk("Bergstraesser k -> 1 for large index; k(6) = 1.2857", abs(berg(1e6) - 1) < 1e-5 and abs(berg(6) - 6.5 / 5.25) < 1e-12)
    mat = MATERIALS[P["material"]]
    m_act = mat["rho"] * math.pi ** 2 * P["d"] ** 2 * P["D"] * P["n"] / 4      # kg, active coils
    fe2 = 0.5 * math.sqrt(F["R"] * 1000 / m_act)
    chk("natural frequency = 1/2 sqrt(R / m_active) (fixed-fixed bar)", abs(natural_frequency(P)["fe"] / fe2 - 1) < 1e-9, "%.1f Hz" % fe2)
    # energy of torsion: W = tau^2 V / (4 G) for k = 1 (uniform shear in the wire, solid round bar: 1/4 factor)
    tau, _ = stress(P, F["F2"])
    V = math.pi * P["d"] ** 2 / 4 * math.pi * P["D"] * P["n"]
    W_tau = tau ** 2 * V / (4 * mat["G"]) / 1000
    chk("stored energy 1/2 R s^2 = tau^2 V/(4G) (torsion of the wire)", abs(W_tau / (0.5 * F["R"] * F["s2"] ** 2 / 1000) - 1) < 1e-9)
    b1 = buckling(dict(P, L0=200.0, L1=190.0, L2=170.0, seating="both pinned"))
    b2 = buckling(dict(P, L0=200.0, L1=190.0, L2=170.0, seating="both ends fixed, guided"))
    chk("buckling: pinned ends buckle earlier than fixed ends", b1["sK"] is not None and (b2["sK"] is None or b1["sK"] < b2["sK"]))
    ft = fatigue(P)
    chk("Haigh line passes (0, tau_D0) and (tau_st, tau_st)", abs(ft["tau_D0"] + (1 - ft["tau_D0"] / (0.5 * Rm_min(P))) * 0.5 * Rm_min(P) - 0.5 * Rm_min(P)) < 1e-9)
    dz = design_from_requirements(P)
    best = dz["best"]
    chk("design: lightest passing candidate exists and meets the forces", best is not None and abs(best["R"] * (best["L0"] - best["L1"]) - P["req"]["F1"]) < 1e-6,
        "d %.1f n %.1f" % (best["d"], best["n"]) if best else "")
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
    elif cmd in ("ch24", "ch56", "ch78"):
        {"ch24": demo_ch24, "ch56": demo_ch56, "ch78": demo_ch78}[cmd]()
    elif cmd == "selftest":
        return cmd_selftest()
    elif cmd == "run":
        P = dict(DEFAULT)
        out = "spring_out"
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
