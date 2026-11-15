#!/usr/bin/env python3
"""M5d cylindrical gear manufacturing program - soft machining (hobbing, shaping, power skiving), heat treatment
(carburising, nitriding, induction), hard finishing (generating grinding, profile grinding, honing), achievable quality,
cycle times, tool data and cost per part of complete process chains. Guide: 05d_gear_manufacturing.md.

Python standard library only (offline). Every number of the guide comes from this file. Uses gear.py (M5) for the
case-depth rule and the ISO 1328 tolerances.

Commands
  python gearmfg.py params | run [--in p.json] [--out folder] | examples | selftest
  python gearmfg.py ch24 | ch56 | ch78        extra results of guide chapters 2-4, 5-6, 7-8
  python gearmfg.py run --in examples/gearmfg_example.json --out example   worked design example (chapter 8)

Cutting data, chip-thickness formula (Hoffmeister), carburising law (Harris), grinding data, machine-hour rates and tool
prices are TYPICAL VALUES or published approximations; values marked 'check' in the guide must be compared with the
tool maker's and machine maker's data and your own shop measurements before planning real production.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gear  # noqa: E402  (M5: case-depth rule, ISO 1328 tolerances)

DEFAULT = {
    "name": "Helical wheel z 60 of the M5 reducer, case hardened and ground (example)",
    # workpiece (the wheel of gear.py DEFAULT)
    "mn": 2.0, "z": 60, "alpha_n_deg": 20.0, "beta_deg": 15.0, "hand": "right", "x": -0.10, "b": 28.0,
    "haP": 1.0, "hfP": 1.25,
    "grade_required": 6,              # ISO 1328-1 flank grade after finishing
    "batch": 500, "annual": 4000,
    # hobbing
    "hob_da0": 70.0, "hob_z0": 2, "hob_gashes": 16, "hob_hand": "right", "hob_vc": 150.0,   # m/min (coated PM-HSS, dry, check)
    "hob_fa": 2.5,                    # axial feed mm per workpiece revolution (roughing / single cut)
    "hob_cuts": 1, "hob_overrun": 3.0,
    "hob_price": 2400.0, "hob_regrinds": 10, "hob_parts_per_regrind": 300, "hob_regrind_cost": 180.0,
    # shaping
    "shp_vc": 40.0, "shp_fc": 0.30, "shp_cuts": 2, "shp_overrun": 3.0, "shp_fr": 0.02,   # fc mm per double stroke on d, fr radial mm/stroke
    # power skiving
    "skv_Sigma_deg": 20.0, "skv_z0": 37, "skv_vc": 150.0, "skv_fa": 0.20, "skv_passes": 10,
    # heat treatment
    "CHD_target": None,               # effective case depth after grinding mm (None -> 0.15..0.20 mn rule, mean)
    "T_carb_C": 930.0, "case_ratio": 0.6,     # effective (550 HV) / total case depth (check)
    "stock_per_flank": 0.10,          # grinding stock per flank mm (distortion + allowance, check)
    # grinding
    "grd_ds": 275.0, "grd_vs": 63.0, "grd_z0": 3, "grd_fa_rough": 0.40, "grd_fa_finish": 0.15, "grd_La": 10.0,
    "pgr_vf": 3000.0, "pgr_passes": 4, "pgr_index_s": 2.0, "pgr_ae": 0.05, "pgr_overrun": 5.0,
    "hon_min": 1.2,                   # honing time per part (check)
    "hon_max_stock": 0.05,            # max. stock per flank honing alone can remove (power honing, check)
    # cost
    "rate": {"hobbing": 85.0, "shaping": 75.0, "skiving": 110.0, "gen_grinding": 140.0, "prof_grinding": 120.0,
             "honing": 130.0, "heat_treat_per_kg": 2.5},      # EUR per machine hour / per kg (check)
    "setup_min": {"hobbing": 45.0, "shaping": 40.0, "skiving": 60.0, "gen_grinding": 60.0, "prof_grinding": 45.0, "honing": 60.0},
    "t_aux_min": 0.5,                 # load / unload / measure per operation
    "rho_steel": 7.85e-6,             # kg/mm^3
}

# ---------------------------------------------------------------- chapter 3: workpiece
def work_geometry(P):
    mn, z = P["mn"], P["z"]
    be, an = math.radians(P["beta_deg"]), math.radians(P["alpha_n_deg"])
    d = mn * z / math.cos(be)
    da = d + 2 * mn * (P["haP"] + P["x"])
    df = d - 2 * mn * (P["hfP"] - P["x"])
    h = (da - df) / 2
    at = math.atan(math.tan(an) / math.cos(be))
    mass = P["rho_steel"] * math.pi / 4 * (da ** 2 - (0.35 * d) ** 2) * P["b"]   # blank with bore 0.35 d (example)
    return {"d": d, "da": da, "df": df, "h": h, "at": at, "db": d * math.cos(at), "mass_kg": mass}

# ---------------------------------------------------------------- chapter 3: hobbing
def hob_setup(P, w=None):
    w = w or work_geometry(P)
    mn, z0 = P["mn"], P["hob_z0"]
    d0 = P["hob_da0"] - 2 * P["hfP"] * mn                     # hob reference diameter (hob addendum = gear dedendum)
    g0 = math.asin(z0 * mn / d0)                               # hob lead angle
    same = P["hand"] == P["hob_hand"]
    be = math.radians(P["beta_deg"])
    eta = be - g0 if same else be + g0                         # swivel (setting) angle
    n0 = 1000 * P["hob_vc"] / (math.pi * P["hob_da0"])
    n_table = n0 * z0 / P["z"]
    return {"d0": d0, "gamma0_deg": math.degrees(g0), "eta_deg": math.degrees(eta), "same_hand": same,
            "n0": n0, "n_table": n_table}

def hob_approach(P, w=None):
    w = w or work_geometry(P)
    h, da0 = w["h"], P["hob_da0"]
    return math.sqrt(h * (da0 - h)) / math.cos(math.radians(P["beta_deg"]))    # helical: longer (approximation, check)

def hob_time(P, w=None):
    w = w or work_geometry(P)
    s = hob_setup(P, w)
    La = hob_approach(P, w)
    L = P["b"] + La + P["hob_overrun"]
    t = P["hob_cuts"] * P["z"] * L / (P["hob_z0"] * s["n0"] * P["hob_fa"])
    return {"La": La, "L": L, "t_cut_min": t, "t_total_min": t + P["t_aux_min"]}

def feed_mark_depth(fa, da0, alpha_n_deg):
    """Depth of the feed marks along the face (scallops left by the hob circle): delta = fa^2 sin(an) / (4 da0)."""
    return fa ** 2 * math.sin(math.radians(alpha_n_deg)) / (4 * da0)

def envelope_depth(P):
    """Depth of the generating (enveloping) flats in profile direction: delta_y = pi^2 z0^2 mn sin(an) / (4 z i0^2)."""
    return math.pi ** 2 * P["hob_z0"] ** 2 * P["mn"] * math.sin(math.radians(P["alpha_n_deg"])) / (4 * P["z"] * P["hob_gashes"] ** 2)

def hoffmeister_hmax(P, w=None):
    """Maximum undeformed chip thickness in hobbing (Hoffmeister, published approximation, check).
    Multi-start hobs: the gashes per start i0/z0 are used as the effective number of gashes (check)."""
    w = w or work_geometry(P)
    mn, z, b, x = P["mn"], P["z"], P["beta_deg"], P["x"]
    T = w["h"]
    ra0 = P["hob_da0"] / 2
    return (4.9 * mn * z ** (9.25e-3 * b - 0.542) * math.exp(-0.015 * b) * math.exp(-0.015 * x) *
            (ra0 / mn) ** (-8.25e-3 * b - 0.225) * (P["hob_gashes"] / P["hob_z0"]) ** (-0.877) * (P["hob_fa"] / mn) ** 0.511 * (T / mn) ** 0.319)

def hob_tool_cost_per_part(P):
    life_parts = (P["hob_regrinds"] + 1) * P["hob_parts_per_regrind"]
    return (P["hob_price"] + P["hob_regrinds"] * P["hob_regrind_cost"]) / life_parts

# ---------------------------------------------------------------- chapter 3: shaping
def shaping_time(P, w=None):
    w = w or work_geometry(P)
    H = P["b"] + 2 * P["shp_overrun"]                          # stroke length
    nDH = 1000 * P["shp_vc"] / (2 * H)                         # double strokes per minute (equal cut / return speed, check)
    t_rot = P["shp_cuts"] * math.pi * w["d"] / (P["shp_fc"] * nDH)
    t_in = w["h"] / (P["shp_fr"] * nDH)
    return {"H": H, "nDH": nDH, "t_cut_min": t_rot + t_in, "t_total_min": t_rot + t_in + P["t_aux_min"]}

# ---------------------------------------------------------------- chapter 3: power skiving
def skiving(P, w=None):
    """Cutting speed from the velocity triangle: v_c = v_w sin(Sigma) / cos(beta0), tool helix beta0 = beta - Sigma."""
    w = w or work_geometry(P)
    S = math.radians(P["skv_Sigma_deg"])
    b0 = math.radians(P["beta_deg"]) - S
    vw = P["skv_vc"] * math.cos(b0) / math.sin(S)              # workpiece circumferential speed m/min
    nw = 1000 * vw / (math.pi * w["d"])
    n0 = nw * P["z"] / P["skv_z0"]
    v0 = vw * math.cos(math.radians(P["beta_deg"])) / math.cos(b0)
    t = P["skv_passes"] * (P["b"] / math.cos(math.radians(P["beta_deg"])) + 2.0) / (P["skv_fa"] * nw)
    return {"beta0_deg": math.degrees(b0), "vw": vw, "v0": v0, "nw": nw, "n0": n0,
            "t_cut_min": t, "t_total_min": t + P["t_aux_min"]}

# ---------------------------------------------------------------- chapter 5: heat treatment
def chd_plan(P):
    r = gear.chd_recommendation(P["mn"])
    chd_final = P["CHD_target"] or 0.5 * (r["CHD_min"] + r["CHD_max"])
    chd_green = chd_final + P["stock_per_flank"]               # flank stock is removed normal to the flank
    chd_root = chd_green                                       # root is not ground (keeps the full case)
    return {"CHD_final": chd_final, "CHD_green": chd_green, "CHD_root": chd_root, "rule": r,
            "stock_on_span": 2 * P["stock_per_flank"]}   # W_k is measured normal to the flanks -> + 2 q

def harris_total_case(t_h, T_C):
    """Harris: total case depth d = 802.6 sqrt(t) / 10^(3720/T) mm (t in h, T in K)."""
    return 802.6 * math.sqrt(t_h) / 10 ** (3720.0 / (T_C + 273.15))

def carburising_time(chd_eff, T_C, case_ratio=0.6):
    k = 802.6 / 10 ** (3720.0 / (T_C + 273.15))
    return (chd_eff / case_ratio / k) ** 2

def nitriding_time(depth_mm, k=0.05):
    """Gas nitriding: nitriding hardness depth ~ k sqrt(t), k ~ 0.05 mm/sqrt(h) for 31CrMoV9 at ~520 C (check)."""
    return (depth_mm / k) ** 2

def induction_depth(f_Hz, rho=1.2e-6, mu_r=1.0):
    """Electrical reference depth delta = 503 sqrt(rho / (mu_r f)) m (above Curie point mu_r = 1)."""
    return 503.0 * math.sqrt(rho / (mu_r * f_Hz)) * 1000.0

# ---------------------------------------------------------------- chapter 6: hard finishing
def gen_grinding_time(P):
    ns = P["grd_vs"] * 60000.0 / (math.pi * P["grd_ds"])
    L = P["b"] / math.cos(math.radians(P["beta_deg"])) + P["grd_La"]
    tr = P["z"] * L / (P["grd_z0"] * ns * P["grd_fa_rough"])
    tf = P["z"] * L / (P["grd_z0"] * ns * P["grd_fa_finish"])
    return {"ns": ns, "L": L, "t_rough": tr, "t_finish": tf, "t_cut_min": tr + tf, "t_total_min": tr + tf + P["t_aux_min"]}

def prof_grinding_time(P):
    L = P["b"] / math.cos(math.radians(P["beta_deg"])) + 2 * P["pgr_overrun"]
    t_gap = L / P["pgr_vf"] * 60 + P["pgr_index_s"]            # s per gap and pass (both flanks at once)
    t = P["z"] * P["pgr_passes"] * t_gap / 60.0
    Qw = P["pgr_ae"] * P["pgr_vf"] / 60.0                      # specific removal rate mm^3/(mm s)
    return {"L": L, "t_gap_s": t_gap, "Qw": Qw, "t_cut_min": t, "t_total_min": t + P["t_aux_min"]}

# ---------------------------------------------------------------- chapter 7: quality, chains, cost
PROCESS_QUALITY = {   # typical achievable ISO 1328 grade range and flank roughness Ra um (check with machine maker)
    "hobbing":        {"grade": (7, 9),  "Ra": (1.6, 3.2), "hard": False},
    "shaping":        {"grade": (7, 9),  "Ra": (1.6, 3.2), "hard": False},
    "skiving":        {"grade": (6, 8),  "Ra": (0.8, 1.6), "hard": False},
    "shaving":        {"grade": (6, 8),  "Ra": (0.4, 0.8), "hard": False},
    "gen_grinding":   {"grade": (3, 6),  "Ra": (0.2, 0.5), "hard": True},
    "prof_grinding":  {"grade": (2, 5),  "Ra": (0.2, 0.5), "hard": True},
    "honing":         {"grade": (5, 7),  "Ra": (0.1, 0.3), "hard": True},
    "hard_skiving":   {"grade": (5, 7),  "Ra": (0.4, 0.8), "hard": True},
}

def op_cost(P, op, t_total_min):
    setup = P["setup_min"].get(op, 0.0) / P["batch"]
    return (t_total_min + setup) / 60.0 * P["rate"][op]

def chain_options(P):
    w = work_geometry(P)
    ht = P["rate"]["heat_treat_per_kg"] * w["mass_kg"]
    hob, shp, skv = hob_time(P, w), shaping_time(P, w), skiving(P, w)
    gg, pg = gen_grinding_time(P), prof_grinding_time(P)
    tool_hob = hob_tool_cost_per_part(P)
    soft = {"hobbing": (hob["t_total_min"], op_cost(P, "hobbing", hob["t_total_min"]) + tool_hob),
            "shaping": (shp["t_total_min"], op_cost(P, "shaping", shp["t_total_min"]) + 0.8 * tool_hob),
            "skiving": (skv["t_total_min"], op_cost(P, "skiving", skv["t_total_min"]) + 1.5 * tool_hob)}
    hard = {"gen_grinding": (gg["t_total_min"], op_cost(P, "gen_grinding", gg["t_total_min"])),
            "prof_grinding": (pg["t_total_min"], op_cost(P, "prof_grinding", pg["t_total_min"])),
            "honing": (P["hon_min"] + P["t_aux_min"], op_cost(P, "honing", P["hon_min"] + P["t_aux_min"]))}
    out = []
    for s, (ts, cs) in soft.items():
        for hname, (th, ch) in hard.items():
            g = PROCESS_QUALITY[hname]["grade"][0]
            feasible = hname != "honing" or P["stock_per_flank"] <= P["hon_max_stock"]
            out.append({"chain": "%s -> carburise -> %s" % (s, hname), "soft": s, "hard": hname,
                        "t_min": ts + th, "cost": cs + ht + ch, "best_grade": g, "feasible": feasible,
                        "meets": feasible and g <= P["grade_required"]})
    out.sort(key=lambda r: (not r["meets"], r["cost"]))
    return out

def tolerances(P):
    w = work_geometry(P)
    return gear.iso1328_2013(P["mn"], w["d"], P["b"], P["grade_required"])

# ---------------------------------------------------------------- report / run
def report_text(P):
    w = work_geometry(P)
    hs, ht = hob_setup(P, w), hob_time(P, w)
    sh, sk = shaping_time(P, w), skiving(P, w)
    c = chd_plan(P)
    gg, pg = gen_grinding_time(P), prof_grinding_time(P)
    tol = tolerances(P)
    L = ["# Gear manufacturing report - %s\n" % P["name"],
         "mn %.2f, z %d, beta %.1f deg %s, x %+.2f, b %.1f mm; d %.3f, da %.3f, df %.3f, h %.3f mm; blank mass %.2f kg" % (
             P["mn"], P["z"], P["beta_deg"], P["hand"], P["x"], P["b"], w["d"], w["da"], w["df"], w["h"], w["mass_kg"]),
         "\n## Hobbing",
         "- hob da0 %.0f, z0 %d, %d gashes, %s hand: d0 %.2f, lead angle %.3f deg, swivel angle %.3f deg (%s hand)" % (
             P["hob_da0"], P["hob_z0"], P["hob_gashes"], P["hob_hand"], hs["d0"], hs["gamma0_deg"], hs["eta_deg"],
             "same" if hs["same_hand"] else "opposite"),
         "- vc %.0f m/min -> n0 %.0f rpm, table %.2f rpm; fa %.2f mm/rev; approach %.1f, path %.1f mm -> %.2f min cut, %.2f min total" % (
             P["hob_vc"], hs["n0"], hs["n_table"], P["hob_fa"], ht["La"], ht["L"], ht["t_cut_min"], ht["t_total_min"]),
         "- feed marks %.2f um, enveloping flats %.2f um; max chip thickness (Hoffmeister) %.3f mm; hob cost %.3f EUR/part" % (
             1000 * feed_mark_depth(P["hob_fa"], P["hob_da0"], P["alpha_n_deg"]), 1000 * envelope_depth(P), hoffmeister_hmax(P, w),
             hob_tool_cost_per_part(P)),
         "\n## Shaping and power skiving (alternatives)",
         "- shaping: stroke %.1f mm, %.0f double strokes/min -> %.2f min total" % (sh["H"], sh["nDH"], sh["t_total_min"]),
         "- skiving: Sigma %.1f deg, tool helix %.2f deg, work %.0f rpm, tool %.0f rpm (v_w %.0f, v_tool %.0f m/min) -> %.2f min total" % (
             P["skv_Sigma_deg"], sk["beta0_deg"], sk["nw"], sk["n0"], sk["vw"], sk["v0"], sk["t_total_min"]),
         "\n## Heat treatment (case hardening)",
         "- CHD rule %.2f-%.2f mm; final %.3f mm + stock %.2f -> green CHD %.3f mm (root keeps %.3f)" % (
             c["rule"]["CHD_min"], c["rule"]["CHD_max"], c["CHD_final"], P["stock_per_flank"], c["CHD_green"], c["CHD_root"]),
         "- carburising at %.0f C: %.2f h to total case %.3f mm (Harris, ratio %.2f, check); span-size stock %.3f mm" % (
             P["T_carb_C"], carburising_time(c["CHD_green"], P["T_carb_C"], P["case_ratio"]), c["CHD_green"] / P["case_ratio"],
             P["case_ratio"], c["stock_on_span"]),
         "\n## Hard finishing",
         "- generating grinding: wheel %.0f mm at %.0f m/s -> %.0f rpm, %d starts; rough %.2f + finish %.2f = %.2f min total" % (
             P["grd_ds"], P["grd_vs"], gg["ns"], P["grd_z0"], gg["t_rough"], gg["t_finish"], gg["t_total_min"]),
         "- profile grinding: %.2f s per gap and pass, %d passes, Q'w %.2f mm3/(mm s) -> %.2f min total" % (
             pg["t_gap_s"], P["pgr_passes"], pg["Qw"], pg["t_total_min"]),
         "\n## Tolerances ISO 1328-1 grade %d (gear.py, check)" % P["grade_required"],
         "- f_pT %.1f, F_pT %.1f, F_alphaT %.1f, F_betaT %.1f, F_rT %.1f um" % (tol["fpT"], tol["FpT"], tol["FalphaT"], tol["FbetaT"], tol["FrT"]),
         "\n## Process chains (batch %d, cost per part, EUR, check rates)" % P["batch"]]
    for r in chain_options(P):
        L.append("- %-42s %6.2f min %7.2f EUR  best grade %d %s" % (r["chain"], r["t_min"], r["cost"], r["best_grade"],
                                                                     "meets" if r["meets"] else ("stock too large for honing alone" if not r["feasible"] else "does NOT meet")))
    return "\n".join(L)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    with open(os.path.join(out, "chains.csv"), "w", encoding="utf-8") as f:
        f.write("chain,time_min,cost_eur,best_grade,meets\n")
        for r in chain_options(P):
            f.write("%s,%.3f,%.3f,%d,%s\n" % (r["chain"], r["t_min"], r["cost"], r["best_grade"], r["meets"]))
    print(rep)
    print("written: report.md, chains.csv ->", out)


# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2: blank
BLANK_ROUTES = [   # route, typical use, material use, fibre flow, relative blank cost (1 = lowest), note
    ("bar stock, sawn + turned", "prototypes, small batches, d < ~150 mm", "poor (chips 40-60 %)", "cut", 1.4, "no tool cost"),
    ("die forging + normalising / isothermal annealing", "series 1 000+", "good", "follows contour", 1.0, "die cost; FP annealing for even hardness"),
    ("ring rolling (seamless rolled ring)", "large rims d > 300 mm", "very good", "circumferential", 1.1, "rims for large wheels"),
    ("casting (steel / ductile iron)", "large, low-stress gears", "good", "none", 0.9, "pores - not for case hardening"),
    ("powder metal (sinter + densify)", "very high volume, small m", "best (near net)", "none", 0.7, "density limits strength"),
]

def it_grade_um(D, IT):
    """ISO 286-1 standard tolerance: i = 0.45 D^(1/3) + 0.001 D (um), IT5..IT11 = 7, 10, 16, 25, 40, 64, 100 i
    (D taken as the nominal size itself, not the geometric mean of the range - check the table)."""
    f = {5: 7, 6: 10, 7: 16, 8: 25, 9: 40, 10: 64, 11: 100}[IT]
    return f * (0.45 * D ** (1 / 3.0) + 0.001 * D)

def blank_tolerances(P, D_face=None):
    """Blank tolerances derived from the flank tolerances: datum face runout gives a helix error over b,
    bore clearance gives eccentricity (radial runout of the teeth)."""
    w = work_geometry(P)
    tol = tolerances(P)
    bore = 0.35 * w["d"]
    D_face = D_face or 0.8 * w["df"]
    face_runout = tol["FbetaT"] / 3 * D_face / P["b"]          # helix share <= 1/3 F_betaT
    return {"bore": bore, "IT6_bore": it_grade_um(bore, 6), "IT7_bore": it_grade_um(bore, 7), "D_face": D_face,
            "face_runout_um": face_runout, "tip_IT11_um": it_grade_um(w["da"], 11), "tip_runout_um": 0.5 * tol["FrT"],
            "FrT": tol["FrT"], "FbetaT": tol["FbetaT"]}

def blank_error_effect(P, bore_clear_um=20.0, face_runout_um=10.0, D_face=None):
    """Eccentric clamping (half the diametral clearance) -> radial runout F_r = 2 e; face runout f_ax over the face
    diameter D_face tilts the blank -> helix slope error ~ f_ax b / D_face."""
    w = work_geometry(P)
    D_face = D_face or 0.8 * w["df"]
    e = bore_clear_um / 2
    tol = tolerances(P)
    return {"e_um": e, "Fr_um": 2 * e, "fHb_um": face_runout_um * P["b"] / D_face, "FrT": tol["FrT"], "FbetaT": tol["FbetaT"]}

# ---------------------------------------------------------------- chapter 3: hob design
HOB_CLASSES = {   # DIN 3968 / ISO 4468 class: typical profile form tolerance (um, m 1..3.5) and achievable soft gear grade (check)
    "AA": {"ff_um": 5, "grade": (6, 7)},
    "A": {"ff_um": 10, "grade": (7, 8)},
    "B": {"ff_um": 20, "grade": (8, 9)},
    "C": {"ff_um": 40, "grade": (9, 10)},
}

def hob_class_for_grade(grade_soft):
    for k in ("C", "B", "A", "AA"):
        if HOB_CLASSES[k]["grade"][0] <= grade_soft:
            return k
    return "AA"

def hob_basic_rack(P, stock=None, prot_extra=0.02):
    """Hob rack for pre-grinding: gear tooth thicker by 2 q / cos(an) (q stock per flank), protuberance
    pr0 = q + extra so the root is undercut and the grinding wheel never touches the root fillet."""
    mn, an = P["mn"], math.radians(P["alpha_n_deg"])
    q = P.get("stock_per_flank", 0.10) if stock is None else stock
    sn_gear = mn * (math.pi / 2 + 2 * P["x"] * math.tan(an))
    sn_pre = sn_gear + 2 * q / math.cos(an)
    s0 = math.pi * mn - sn_pre                                 # hob tooth thickness on its reference line (for x = 0 position)
    return {"ha0": P["hfP"] * mn, "hf0": (P["haP"] + 0.25) * mn, "sn_gear": sn_gear, "sn_pre": sn_pre, "s0": s0,
            "protuberance": q + prot_extra, "tip_chamfer": 0.1 * mn, "rho_a0": 0.38 * mn}

def hob_shift_plan(P, hob_length=90.0, usable=0.9):
    """Shifting: the generating zone uses only a short part of the hob; the hob is shifted axially after each part.
    Active length ~ 2 h / tan(an) + pi mn (check); shift per part = (usable length - active) / parts per regrind."""
    w = work_geometry(P)
    act = 2 * w["h"] / math.tan(math.radians(P["alpha_n_deg"])) + math.pi * P["mn"]
    free = usable * hob_length - act
    parts = P["hob_parts_per_regrind"]
    return {"active": act, "free": free, "shift_per_part": free / parts, "parts": parts,
            "length_cut_per_regrind_m": parts * P["z"] * P["b"] / 1000.0 / math.cos(math.radians(P["beta_deg"]))}

HOB_CUTTING_DATA = [   # tool / coating / coolant, vc m/min, fa mm/rev (roughing m 2..4), note (typical - check tool maker)
    ("PM-HSS uncoated, oil", 60.0, 2.0, "old machines, low rigidity"),
    ("PM-HSS TiN / AlCrN, oil", 120.0, 2.5, "standard wet hobbing"),
    ("PM-HSS AlCrN, dry", 150.0, 2.5, "default of this program"),
    ("carbide AlCrN, dry", 300.0, 2.5, "high-speed dry hobbing, rigid machine"),
]

def cutting_data_study(P):
    out = []
    for name, vc, fa, note in HOB_CUTTING_DATA:
        Q = dict(P, hob_vc=vc, hob_fa=fa)
        t = hob_time(Q)
        out.append({"tool": name, "vc": vc, "fa": fa, "t_cut": t["t_cut_min"], "n0": hob_setup(Q)["n0"], "note": note})
    return out

def differential_rotation(P):
    """Helical hobbing: the work must turn one extra revolution while the hob travels one lead p_z = pi mn z / sin(beta).
    Extra rotation per work revolution = fa / p_z; electronic gearbox: n_table = n0 z0 / z / (1 -+ fa / p_z)."""
    be = math.radians(P["beta_deg"])
    if abs(be) < 1e-12:
        return {"pz": float("inf"), "extra_per_rev": 0.0, "n_table": hob_setup(P)["n_table"], "n_index": hob_setup(P)["n_table"]}
    pz = math.pi * P["mn"] * P["z"] / math.sin(be)
    k = P["hob_fa"] / pz
    n_index = hob_setup(P)["n_table"]
    sign = 1 if P["hand"] == P["hob_hand"] else -1             # sign depends on hand and feed direction (climb, check machine manual)
    n_table = n_index / (1 - sign * k)
    return {"pz": pz, "extra_per_rev": k, "n_index": n_index, "n_table": n_table}

def two_cut_strategy(P, fa_rough=3.5, fa_finish=1.5):
    one = hob_time(P)
    r, f = hob_time(dict(P, hob_fa=fa_rough)), hob_time(dict(P, hob_fa=fa_finish))
    return {"one_cut_min": one["t_cut_min"], "one_mark_um": 1000 * feed_mark_depth(P["hob_fa"], P["hob_da0"], P["alpha_n_deg"]),
            "two_cut_min": r["t_cut_min"] + f["t_cut_min"], "two_mark_um": 1000 * feed_mark_depth(fa_finish, P["hob_da0"], P["alpha_n_deg"])}

def crowning_infeed(c_beta_um, alpha_n_deg=20.0):
    """Flank crowning by changing the centre distance during the axial stroke: flank shift = dr sin(an) -> dr = C / sin(an)."""
    return c_beta_um / math.sin(math.radians(alpha_n_deg))

# ---------------------------------------------------------------- chapter 4: shaping, skiving, run-out space
def shaper_cutter(P, d0_target=75.0):
    z0 = max(12, round(d0_target * math.cos(math.radians(P["beta_deg"])) / P["mn"]))
    d0 = P["mn"] * z0 / math.cos(math.radians(P["beta_deg"]))
    out = {"z0": z0, "d0": d0}
    if P["beta_deg"] != 0:
        out["guide_lead"] = math.pi * P["mn"] * z0 / math.sin(math.radians(P["beta_deg"]))   # helical guide lead mm
    return out

def runout_space(P, groove=6.0):
    """Axial space behind the teeth (to a shoulder) each method needs (approximation, check):
    hob: full approach La; shaping: overrun ~ 2..3 mm + lift; skiving: ~ sqrt(h d0) sin(Sigma)."""
    w = work_geometry(P)
    La = hob_approach(P, w)
    d0 = P["mn"] * P["skv_z0"] / math.cos(math.radians(P["beta_deg"] - P["skv_Sigma_deg"]))
    skv = math.sqrt(w["h"] * d0) * math.sin(math.radians(P["skv_Sigma_deg"])) + 1.0
    shp = P["shp_overrun"]
    return {"hob": La, "shaping": shp, "skiving": skv, "skiving_d0": d0, "groove": groove,
            "fits": {"hobbing": La <= groove, "shaping": shp <= groove, "skiving": skv <= groove}}

def skiving_sigma_study(P, sigmas=(10.0, 15.0, 20.0, 25.0, 30.0)):
    out = []
    for s in sigmas:
        Q = dict(P, skv_Sigma_deg=s)
        k = skiving(Q)
        out.append({"Sigma": s, "beta0": k["beta0_deg"], "nw": k["nw"], "n0": k["n0"], "t": k["t_cut_min"],
                    "runout": runout_space(Q)["skiving"]})
    return out

# ---------------------------------------------------------------- chapter 4: other soft methods
def shaving_data(P, cross_deg=12.0):
    """Shaving before heat treatment: allowance per flank ~ 0.02 + 0.01 mn (check), cutter teeth without a common factor
    with z (hunting), cycle 20..40 s."""
    z = P["z"]
    zc = [k for k in range(67, 90) if math.gcd(k, z) == 1][0]
    return {"cross_deg": cross_deg, "allow_per_flank": 0.02 + 0.01 * P["mn"], "cutter_z": zc, "t_min": 0.5,
            "grade_in": 8, "grade_out": 6}

def gear_milling_time(P, vc=200.0, fz=0.08, zc=12, dc=63.0, passes=2, index_s=3.0):
    """Disk-type (form) milling gap by gap on a 5-axis machine: vf = fz zc n."""
    n = 1000 * vc / (math.pi * dc)
    vf = fz * zc * n
    w = work_geometry(P)
    app = math.sqrt(w["h"] * (dc - w["h"]))
    L = P["b"] / math.cos(math.radians(P["beta_deg"])) + 2 * app
    t = P["z"] * passes * (L / vf + index_s / 60.0)
    return {"n": n, "vf": vf, "L": L, "t_min": t}

def broaching_time(L_broach=900.0, stroke=200.0, v_cut=6.0, v_ret=20.0):
    """Internal gear broaching: one stroke cuts all teeth. Time = (L + stroke)/v_cut + return."""
    s = L_broach + stroke
    return {"t_min": s / 1000 / v_cut + s / 1000 / v_ret}

CHAMFER_METHODS = [  # method, principle, burr, time, note
    ("chamfer rolling (press)", "plastic deformation of the tooth edge", "secondary burr on face + flank bulge", "8-15 s",
     "cheap; bulge must be removed by a 2nd hob cut or shaving"),
    ("chamfer cutting (ChamferCut-type form cutter)", "cutting with a form cutter in mesh", "very small", "5-15 s", "integrated in the hobbing machine"),
    ("deburring brush / file", "removes primary burr only", "edge not defined", "5 s", "no defined chamfer"),
    ("end mill along the edge (5-axis)", "CNC path along the tooth edge", "none", "1-3 min", "prototypes, large gears"),
]

METHOD_CHOICE = [  # condition -> preferred soft method (check)
    ("external, free run-out, any volume", "hobbing"),
    ("external, shoulder close (groove < hob approach)", "shaping or power skiving"),
    ("internal gear, small / medium batch", "shaping"),
    ("internal gear, large batch, rigid machine", "power skiving"),
    ("internal spline / gear, very high volume", "broaching"),
    ("single / prototype, large module, 5-axis available", "gear milling"),
    ("very high volume, small module, ductile steel", "cold rolling"),
]

def choose_soft_method(P, internal=False, groove=None, volume=None):
    volume = volume or P["annual"]
    if internal:
        if volume > 50000:
            return "broaching (or skiving)"
        return "power skiving" if volume > 2000 else "shaping"
    if groove is not None:
        rs = runout_space(P, groove)
        if not rs["fits"]["hobbing"]:
            return "power skiving" if rs["fits"]["skiving"] and volume > 2000 else "shaping"
    return "hobbing"

# ---------------------------------------------------------------- demo
def demo_ch24():
    P = dict(DEFAULT)
    w = work_geometry(P)
    print("## 2.1 Blank routes")
    for r in BLANK_ROUTES:
        print("  %-48s %-36s material %-22s fibre %-17s cost %.1f  %s" % r)
    print("\n## 2.2 Blank tolerances from the flank grade %d" % P["grade_required"])
    bt = blank_tolerances(P)
    print("  bore %.1f mm: IT6 %.1f um, IT7 %.1f um; datum face D %.1f mm runout <= %.1f um (helix share F_betaT/3 = %.1f um)" % (
        bt["bore"], bt["IT6_bore"], bt["IT7_bore"], bt["D_face"], bt["face_runout_um"], bt["FbetaT"] / 3))
    print("  tip diameter %.3f: IT11 %.0f um (size), tip runout <= %.1f um (0.5 F_rT, F_rT %.1f um)" % (
        w["da"], bt["tip_IT11_um"], bt["tip_runout_um"], bt["FrT"]))
    print("\n## 2.3 Blank errors -> tooth errors")
    for c, f in ((10, 5), (20, 10), (40, 20)):
        e = blank_error_effect(P, c, f)
        print("  bore clearance %2d um, face runout %2d um: e %4.1f, F_r %4.1f um (F_rT %.1f), helix slope %.1f um (F_betaT %.1f)" % (
            c, f, e["e_um"], e["Fr_um"], e["FrT"], e["fHb_um"], e["FbetaT"]))
    print("\n## 3.1 Hob class for the soft grade")
    for k, v in HOB_CLASSES.items():
        print("  class %-2s: profile form ~%2d um -> soft gear grade %d-%d" % (k, v["ff_um"], v["grade"][0], v["grade"][1]))
    print("  soft grade 8 before grinding -> class %s; grade 7 -> class %s" % (hob_class_for_grade(8), hob_class_for_grade(7)))
    print("\n## 3.2 Hob basic rack for pre-grinding (stock %.2f mm per flank)" % P["stock_per_flank"])
    hr = hob_basic_rack(P)
    print("  h_a0 %.3f, h_f0 %.3f mm; gear s_n %.4f -> pre-grind s_n %.4f mm; hob s_0 %.4f mm; protuberance %.3f, tip chamfer %.2f, rho_a0 %.2f mm" % (
        hr["ha0"], hr["hf0"], hr["sn_gear"], hr["sn_pre"], hr["s0"], hr["protuberance"], hr["tip_chamfer"], hr["rho_a0"]))
    print("\n## 3.3 Shifting")
    sp = hob_shift_plan(P)
    print("  active zone %.1f mm, free length %.1f mm -> shift %.3f mm per part over %d parts; %.0f m of flank cut per regrind" % (
        sp["active"], sp["free"], sp["shift_per_part"], sp["parts"], sp["length_cut_per_regrind_m"]))
    print("\n## 3.4 Cutting data")
    for r in cutting_data_study(P):
        print("  %-28s vc %5.0f  fa %.1f -> n0 %5.0f rpm, %.2f min  (%s)" % (r["tool"], r["vc"], r["fa"], r["n0"], r["t_cut"], r["note"]))
    print("\n## 3.5 Differential (helical additional rotation)")
    dr = differential_rotation(P)
    print("  lead p_z %.1f mm; extra rotation %.6f rev per work rev; table %.4f rpm (index %.4f rpm)" % (
        dr["pz"], dr["extra_per_rev"], dr["n_table"], dr["n_index"]))
    print("\n## 3.6 One cut vs two cuts")
    tc = two_cut_strategy(P)
    print("  one cut fa %.1f: %.2f min, feed marks %.2f um; two cuts 3.5 + 1.5: %.2f min, feed marks %.2f um" % (
        P["hob_fa"], tc["one_cut_min"], tc["one_mark_um"], tc["two_cut_min"], tc["two_mark_um"]))
    print("\n## 3.7 Crowning by hobbing: radial infeed for flank crowning")
    for c in (5, 10, 15):
        print("  C_beta %2d um -> radial infeed change %.1f um" % (c, crowning_infeed(c, P["alpha_n_deg"])))
    print("\n## 4.1 Shaper cutter")
    sc = shaper_cutter(P)
    print("  z0 %d, d0 %.2f mm; helical guide lead %.1f mm" % (sc["z0"], sc["d0"], sc.get("guide_lead", 0)))
    print("\n## 4.2 Run-out space behind the teeth")
    for g in (4.0, 8.0, 20.0):
        rs = runout_space(P, g)
        print("  groove %4.1f mm: hob needs %.1f, shaping %.1f, skiving %.1f mm -> fits %s" % (
            g, rs["hob"], rs["shaping"], rs["skiving"], ", ".join(k for k, v in rs["fits"].items() if v) or "none"))
    print("\n## 4.3 Skiving: axis cross angle study")
    for r in skiving_sigma_study(P):
        print("  Sigma %4.1f: tool helix %+6.2f deg, work %5.0f rpm, tool %5.0f rpm, %.2f min, run-out %.1f mm" % (
            r["Sigma"], r["beta0"], r["nw"], r["n0"], r["t"], r["runout"]))
    print("\n## 4.4 Shaving, milling, broaching")
    sv = shaving_data(P)
    print("  shaving: cross angle %.0f deg, allowance %.3f mm per flank, cutter z %d (no common factor with %d), %.1f min, grade %d -> %d" % (
        sv["cross_deg"], sv["allow_per_flank"], sv["cutter_z"], P["z"], sv["t_min"], sv["grade_in"], sv["grade_out"]))
    gm = gear_milling_time(P)
    print("  gear milling (disk mill 63 mm, 12 teeth): n %.0f rpm, vf %.0f mm/min, path %.1f mm -> %.2f min" % (gm["n"], gm["vf"], gm["L"], gm["t_min"]))
    print("  broaching internal gear (broach 900 mm): %.2f min per part" % broaching_time()["t_min"])
    print("\n## 4.5 Chamfering methods")
    for r in CHAMFER_METHODS:
        print("  %-46s | %-38s | %-36s | %-7s | %s" % r)
    print("\n## 4.6 Method choice")
    for c, m in METHOD_CHOICE:
        print("  %-52s -> %s" % (c, m))
    for args in ((False, None, None), (False, 8.0, 4000), (False, 8.0, 500), (True, None, 500), (True, None, 20000), (True, None, 100000)):
        print("  internal %-5s groove %-4s volume %-6s -> %s" % (args[0], args[1], args[2], choose_soft_method(P, *args)))

# ================================================================ added with guide chapters (ch56)
# ---------------------------------------------------------------- 5.1 case-hardening steels
# typical Jominy hardness HRC (mean of the H band) at 1.5, 3, 5, 7, 9, 11, 13, 15, 20, 25 mm - check EN ISO 683-3
JOMINY_D = [1.5, 3, 5, 7, 9, 11, 13, 15, 20, 25]
CASE_STEELS = {
    "16MnCr5":    {"C": 0.16, "J": [41, 39, 36, 32, 29, 27, 25, 24, 22, 21], "use": "small / medium gears, mn <= 4"},
    "20MnCr5":    {"C": 0.20, "J": [45, 44, 42, 39, 36, 34, 32, 31, 29, 28], "use": "medium gears, mn <= 6, vehicle gearboxes"},
    "20NiCrMo2-2": {"C": 0.20, "J": [44, 42, 38, 33, 29, 27, 25, 24, 23, 22], "use": "small gears, good toughness, mn <= 3"},
    "18CrNiMo7-6": {"C": 0.18, "J": [44, 44, 43, 42, 41, 40, 39, 38, 37, 36], "use": "large / heavy-duty gears, mn up to ~20"},
}

def jominy_equivalent(mn, quench="oil"):
    """Jominy distance that cools like the middle of the tooth at the root (rough rule, check with the heat treater):
    oil ~ 1.5 + 0.9 mn mm, gas quench (LPC, 10-20 bar) ~ 1.3 times longer."""
    j = 1.5 + 0.9 * mn
    return j * (1.3 if quench == "gas" else 1.0)

def core_hardness(steel, mn, quench="oil"):
    J = CASE_STEELS[steel]["J"]
    x = jominy_equivalent(mn, quench)
    if x <= JOMINY_D[0]:
        return J[0]
    for i in range(1, len(JOMINY_D)):
        if x <= JOMINY_D[i]:
            f = (x - JOMINY_D[i - 1]) / (JOMINY_D[i] - JOMINY_D[i - 1])
            return J[i - 1] + f * (J[i] - J[i - 1])
    return J[-1]

def steel_choice(mns=(2, 4, 6, 10, 16), quench="oil", core_min=30.0):
    rows = []
    for mn in mns:
        r = {"mn": mn, "J": jominy_equivalent(mn, quench)}
        for s in CASE_STEELS:
            h = core_hardness(s, mn, quench)
            r[s] = (h, h >= core_min)
        rows.append(r)
    return rows

# ---------------------------------------------------------------- 5.2 carbon diffusion (Fick)
R_GAS = 8.314

def D_carbon(T_C):
    """Diffusion coefficient of carbon in austenite D = 0.23 exp(-148000 / (R T)) cm^2/s -> mm^2/s (check)."""
    return 0.23 * math.exp(-148000.0 / (R_GAS * (T_C + 273.15))) * 100.0

def carbon_erf(x_mm, t_h, T_C, Cs, C0):
    """Constant surface carbon: C(x,t) = Cs - (Cs - C0) erf(x / (2 sqrt(D t)))."""
    D = D_carbon(T_C)
    return Cs - (Cs - C0) * math.erf(x_mm / (2.0 * math.sqrt(D * t_h * 3600.0)))

def depth_at_carbon(Cx, t_h, T_C, Cs, C0):
    lo, hi = 0.0, 20.0
    for _ in range(80):
        m = 0.5 * (lo + hi)
        if carbon_erf(m, t_h, T_C, Cs, C0) > Cx:
            lo = m
        else:
            hi = m
    return lo

def time_for_carbon_depth(depth_mm, Cx, T_C, Cs, C0):
    """Invert the erf solution: t = (x / (2 erfinv(u)))^2 / D, u = (Cs - Cx)/(Cs - C0) (erfinv by bisection)."""
    u = (Cs - Cx) / (Cs - C0)
    lo, hi = 0.0, 6.0
    for _ in range(100):
        m = 0.5 * (lo + hi)
        if math.erf(m) < u:
            lo = m
        else:
            hi = m
    return (depth_mm / (2 * lo)) ** 2 / D_carbon(T_C) / 3600.0

# hardness of martensite vs carbon (tempered 160-180 C, with retained austenite at high carbon) - typical, check
HV_OF_C = [(0.10, 380), (0.15, 420), (0.20, 470), (0.30, 530), (0.35, 550), (0.40, 600), (0.50, 680), (0.60, 740),
           (0.70, 780), (0.80, 800), (0.90, 795), (1.00, 780), (1.10, 760)]

def hv_from_c(c):
    if c <= HV_OF_C[0][0]:
        return HV_OF_C[0][1]
    for (c0, h0), (c1, h1) in zip(HV_OF_C, HV_OF_C[1:]):
        if c <= c1:
            return h0 + (c - c0) / (c1 - c0) * (h1 - h0)
    return HV_OF_C[-1][1]

def boost_diffuse(T_C=930.0, C0=0.18, C_boost=1.10, C_diff=0.75, t_boost_h=1.0, t_diff_h=0.6, L=3.0, n=150):
    """Explicit finite differences for dC/dt = D d2C/dx2, surface carbon fixed to C_boost, then C_diff (check)."""
    D = D_carbon(T_C)
    dx = L / n
    dt = 0.4 * dx * dx / D
    C = [C0] * (n + 1)
    t, t_end = 0.0, (t_boost_h + t_diff_h) * 3600.0
    while t < t_end:
        C[0] = C_boost if t < t_boost_h * 3600.0 else C_diff
        new = C[:]
        for i in range(1, n):
            new[i] = C[i] + D * dt / dx ** 2 * (C[i + 1] - 2 * C[i] + C[i - 1])
        new[n] = new[n - 1]
        C = new
        t += dt
    xs = [i * dx for i in range(n + 1)]
    def depth_of(cx):
        for i in range(1, n + 1):
            if C[i] <= cx:
                return xs[i - 1] + (C[i - 1] - cx) / (C[i - 1] - C[i]) * dx
        return L
    cmax = max(C[1:])
    return {"x": xs, "C": C, "C_surface": C[1], "C_max": cmax, "x_035": depth_of(0.35),
            "x_030": depth_of(0.30), "CHD_550": depth_of(0.35), "t_total_h": t_boost_h + t_diff_h}

def boost_for_chd(chd_mm, T_C=930.0, diff_ratio=0.6, **kw):
    """Boost time (diffuse = diff_ratio x boost) that gives the CHD (0.35 % C) - bisection on boost_diffuse."""
    lo, hi = 0.05, 12.0
    for _ in range(25):
        m = 0.5 * (lo + hi)
        if boost_diffuse(T_C=T_C, t_boost_h=m, t_diff_h=diff_ratio * m, **kw)["CHD_550"] < chd_mm:
            lo = m
        else:
            hi = m
    b = boost_diffuse(T_C=T_C, t_boost_h=hi, t_diff_h=diff_ratio * hi, **kw)
    b["t_boost_h"], b["t_diff_h"] = hi, diff_ratio * hi
    return b

def hardness_traverse(prof, step=0.1):
    out = []
    x = step
    while x <= 1.5 + 1e-9:
        i = min(int(round(x / (prof["x"][1] - prof["x"][0]))), len(prof["C"]) - 1)
        out.append((x, prof["C"][i], hv_from_c(prof["C"][i])))
        x += step
    return out

# ---------------------------------------------------------------- 5.3 tempering
def hollomon_jaffe(T_C, t_h, Cc=20.0):
    """Tempering parameter P = T (C + log10 t), T in K, t in h (C ~ 20 for steels)."""
    return (T_C + 273.15) * (Cc + math.log10(t_h))

def equivalent_tempering_time(T1_C, t1_h, T2_C, Cc=20.0):
    P = hollomon_jaffe(T1_C, t1_h, Cc)
    return 10 ** (P / (T2_C + 273.15) - Cc)

# ---------------------------------------------------------------- 5.4 distortion and grinding stock
QUENCH_FACTOR = {"oil free": 1.0, "oil press quench": 0.7, "gas LPC": 0.6}   # relative distortion (typical, check)

def distortion_estimate(P, quench="oil free"):
    """Typical distortion of a carburised wheel (rule-of-thumb coefficients, check with own measurements):
    radial runout ~ 0.10 um/mm d + 8 um; helix change ~ 0.25 um/mm b + 3 um; profile slope ~ 1.5 um/mm mn + 3 um;
    bore shrinkage ~ 0.03 % of the bore; span growth ~ +0.02 % of W_k."""
    w = work_geometry(P)
    k = QUENCH_FACTOR[quench]
    bore = 0.35 * w["d"]
    return {"Fr_um": k * (0.10 * w["d"] + 8), "fHb_um": k * (0.25 * P["b"] + 3), "fHa_um": k * (1.5 * P["mn"] + 3),
            "bore_shrink_um": k * 0.0003 * bore * 1000, "bore": bore}

def stock_needed(P, quench="oil free", cleanup_um=20.0):
    """Minimum stock per flank so that every flank cleans up after centring:
    eccentricity e = Fr/2 moves a flank by e sin(an); add helix and profile distortion and a clean-up layer."""
    dd = distortion_estimate(P, quench)
    an = math.radians(P["alpha_n_deg"])
    ecc = dd["Fr_um"] / 2 * math.sin(an)
    need = ecc + 0.5 * dd["fHb_um"] + 0.5 * dd["fHa_um"] + cleanup_um
    return {"ecc_um": ecc, "need_um": need, "dist": dd}

def stock_sharing(left_um, right_um):
    """After measuring the stock on both flanks the grinder 'centres' the wheel in the gap:
    the rotation offset that shares stock equally gives each flank (L + R)/2."""
    mean = (left_um + right_um) / 2
    return {"shift_um": (left_um - right_um) / 2, "each_um": mean}

def case_loss_check(P, quench="oil free"):
    c = chd_plan(P)
    s = stock_needed(P, quench)
    worst = s["need_um"] / 1000 + s["ecc_um"] / 1000
    return {"CHD_green": c["CHD_green"], "stock_nominal": P["stock_per_flank"], "worst_removed": worst,
            "CHD_worst_flank": c["CHD_green"] - worst, "CHD_min_rule": c["rule"]["CHD_min"]}

# ---------------------------------------------------------------- 5.5 nitriding, induction
NITRIDING = {   # typical, check
    "gas nitriding 31CrMoV9":    {"k": 0.050, "T": 520, "surface_HV": 800, "white_k": 0.0015},
    "plasma nitriding 31CrMoV9": {"k": 0.045, "T": 500, "surface_HV": 800, "white_k": 0.0006},
    "gas nitriding 42CrMo4 QT":  {"k": 0.055, "T": 520, "surface_HV": 600, "white_k": 0.0015},
}

def nitriding_plan(depth_mm=0.4):
    out = []
    for name, d in NITRIDING.items():
        t = nitriding_time(depth_mm, d["k"])
        out.append({"process": name, "t_h": t, "white_um": 1000 * d["white_k"] * math.sqrt(t), "HV": d["surface_HV"]})
    return out

def freq_for_depth(depth_mm, rho=1.2e-6):
    """Inverse of the reference depth: f = rho (503 / delta)^2 (delta in m)."""
    d = depth_mm / 1000.0
    return rho * (503.0 / d) ** 2

def induction_choice(mn):
    """Contour hardening: case ~ 0.2..0.3 mn -> the high frequency follows from the reference depth (case ~ 0.5 delta
    with short heating, check); the root / pre-heat frequency ~ 1/10 of it (dual frequency)."""
    case = 0.25 * mn
    f_hi = freq_for_depth(2.0 * case)
    return {"mn": mn, "case_mm": case, "f_high_kHz": f_hi / 1000, "f_low_kHz": f_hi / 10000,
            "delta_check": induction_depth(f_hi)}

# ---------------------------------------------------------------- 6.1 generating grinding with dressing
def gen_grinding_with_dressing(P, parts_per_dress=25, t_dress_min=1.5, dress_depth_mm=0.03, ds_min=200.0):
    g = gen_grinding_time(P)
    share = t_dress_min / parts_per_dress
    dressings = (P["grd_ds"] - ds_min) / (2 * dress_depth_mm)
    return {"t_grind": g["t_total_min"], "dress_share": share, "t_cycle": g["t_total_min"] + share,
            "dressings_per_wheel": dressings, "parts_per_wheel": dressings * parts_per_dress}

def flank_twist(P, C_beta_um=10.0):
    """Twist from lead crowning made by changing the centre distance during generating grinding of a helical gear
    (approximation: S ~ 4 C_beta L_alpha tan(beta_b) / b, check with the machine maker's twist calculation)."""
    w = work_geometry(P)
    rb, ra = w["db"] / 2, w["da"] / 2
    rf = (w["df"] + 0.5 * P["mn"]) / 2                     # start of the active profile (approx.)
    La = math.sqrt(ra ** 2 - rb ** 2) - math.sqrt(max(rf ** 2 - rb ** 2, 0.0))
    bb = math.atan(math.tan(math.radians(P["beta_deg"])) * math.cos(w["at"]))
    return {"L_alpha": La, "beta_b_deg": math.degrees(bb), "twist_um": 4 * C_beta_um * La * math.tan(bb) / P["b"]}

# ---------------------------------------------------------------- 6.2 profile grinding, burn
QW_LIMIT = {"corundum (vitrified)": 3.0, "CBN (vitrified)": 12.0}   # mm^3/(mm s) without burn, typical - check

def burn_check(P, wheel="corundum (vitrified)"):
    pg = prof_grinding_time(P)
    lim = QW_LIMIT[wheel]
    return {"Qw": pg["Qw"], "limit": lim, "ok": pg["Qw"] <= lim, "vf_max": lim * 60 / P["pgr_ae"]}

def prof_grinding_options(P, stock_mm=None, vf=None):
    """Same total stock with fewer, deeper passes: time drops but Q'w rises -> burn risk."""
    stock = stock_mm or P["stock_per_flank"]
    rows = []
    for passes in (2, 3, 4, 6, 8):
        ae = stock / passes * 1.0 + 0.0
        Q = dict(P, pgr_passes=passes, pgr_ae=ae, pgr_vf=vf or P["pgr_vf"])
        pg = prof_grinding_time(Q)
        rows.append({"passes": passes, "ae": ae, "t": pg["t_total_min"], "Qw": pg["Qw"],
                     "corundum": pg["Qw"] <= QW_LIMIT["corundum (vitrified)"], "CBN": pg["Qw"] <= QW_LIMIT["CBN (vitrified)"]})
    return rows

# ---------------------------------------------------------------- 6.3 honing, shot peening
def honing_time(stock_um, removal_um_per_s=0.8, t_aux_s=20.0):
    """Power honing: removal rate ~ 0.5..1 um/s per flank (check)."""
    return (stock_um / removal_um_per_s + t_aux_s) / 60.0

def peening_coverage_time(cov=0.98, t_full_s=60.0):
    """Coverage C = 1 - exp(-k t); k from the time that gives 98 % in a test (Avrami form)."""
    k = -math.log(1 - 0.98) / t_full_s
    return -math.log(1 - cov) / k

def peening_gain(sFlim=500.0, gain=0.15):
    """Shot peening of the root: sigma_Flim + ~10..20 % (compressive residual stress -600..-1000 MPa, check)."""
    return sFlim * (1 + gain)

HARD_FINISH_CHOICE = [
    ("generating grinding", "series mn 1-8, d < 600", "grade 3-6", "short cycle, needs dressing; twist with crowning"),
    ("profile grinding", "large / single gears, internal", "grade 2-5", "slow for small mn, any modification, burn risk"),
    ("power honing", "series after grinding or with small HT stock", "grade 5-7", "low-noise surface, small stock"),
    ("hard skiving", "internal gears, ring gears", "grade 5-7", "fast, tool cost high"),
    ("superfinishing", "aerospace, EV gears", "Ra < 0.1", "low noise, micropitting resistance"),
    ("shot peening", "highly loaded roots", "-", "+10-20 % root strength, after grinding or before"),
]

def demo_ch56():
    P = dict(DEFAULT)
    print("## 5.1 Core hardness HRC at the tooth root vs module (oil quench, core min 30 HRC)")
    for r in steel_choice():
        print("  mn %2d (J %4.1f mm): " % (r["mn"], r["J"]) + ", ".join(
            "%s %.0f%s" % (s, r[s][0], "" if r[s][1] else "!") for s in CASE_STEELS))
    print("  gas quench mn 6: " + ", ".join("%s %.0f" % (s, core_hardness(s, 6, "gas")) for s in CASE_STEELS))
    print("\n## 5.2 Carbon diffusion")
    for T in (900, 930, 960, 980):
        print("  T %d C: D %.3e mm^2/s" % (T, D_carbon(T)))
    c = chd_plan(P)
    t_erf = time_for_carbon_depth(c["CHD_green"], 0.35, 930, 0.80, 0.18)
    print("  erf, Cs 0.80, C0 0.18, 930 C: time for 0.35 %%C at %.3f mm = %.2f h; check depth %.4f mm" % (
        c["CHD_green"], t_erf, depth_at_carbon(0.35, t_erf, 930, 0.80, 0.18)))
    print("  Harris (core): %.2f h for total case %.3f mm" % (carburising_time(c["CHD_green"], 930), c["CHD_green"] / 0.6))
    for tb, td in ((0.5, 0.5), (0.6, 0.6), (0.8, 0.6), (1.0, 0.8)):
        b = boost_diffuse(t_boost_h=tb, t_diff_h=td)
        print("  boost %.1f h @1.10 + diffuse %.1f h @0.75: surface C %.3f, CHD(0.35 %%C) %.3f mm, total %.1f h" % (
            tb, td, b["C_surface"], b["CHD_550"], b["t_total_h"]))
    for T in (930, 960):
        bf = boost_for_chd(c["CHD_green"], T_C=T)
        print("  for CHD %.3f mm at %d C: boost %.2f h + diffuse %.2f h = %.2f h, surface C %.3f" % (
            c["CHD_green"], T, bf["t_boost_h"], bf["t_diff_h"], bf["t_total_h"], bf["C_surface"]))
    b = boost_diffuse(t_boost_h=0.6, t_diff_h=0.6)
    print("  hardness traverse (boost 0.6 + diffuse 0.6 h):")
    for x, cc, hv in hardness_traverse(b)[:8]:
        print("    x %.1f mm: C %.3f %%, %3.0f HV" % (x, cc, hv))
    print("\n## 5.3 Tempering")
    print("  P(180 C, 2 h) = %.0f; same P at 160 C needs %.1f h, at 200 C %.2f h" % (
        hollomon_jaffe(180, 2), equivalent_tempering_time(180, 2, 160), equivalent_tempering_time(180, 2, 200)))
    print("\n## 5.4 Distortion and grinding stock (wheel z 60, d %.1f)" % work_geometry(P)["d"])
    for q in QUENCH_FACTOR:
        s = stock_needed(P, q)
        d = s["dist"]
        print("  %-17s Fr %4.1f, fHb %4.1f, fHa %3.1f, bore -%4.1f um -> stock needed %5.1f um/flank" % (
            q, d["Fr_um"], d["fHb_um"], d["fHa_um"], d["bore_shrink_um"], s["need_um"]))
    sh = stock_sharing(140, 60)
    print("  stock sharing L 140 / R 60 um: rotate %.0f um -> %.0f um each" % (sh["shift_um"], sh["each_um"]))
    cl = case_loss_check(P)
    print("  case after grinding, worst flank: green %.3f - removed %.3f = %.3f mm (rule min %.2f)" % (
        cl["CHD_green"], cl["worst_removed"], cl["CHD_worst_flank"], cl["CHD_min_rule"]))
    print("\n## 5.5 Nitriding (0.40 mm) and induction")
    for r in nitriding_plan(0.4):
        print("  %-27s %5.0f h, white layer %4.1f um, surface %d HV" % (r["process"], r["t_h"], r["white_um"], r["HV"]))
    for mn in (2, 4, 6, 10):
        ic = induction_choice(mn)
        print("  mn %2d: case %.2f mm -> high f %.0f kHz, pre-heat %.0f kHz (delta %.2f mm)" % (
            mn, ic["case_mm"], ic["f_high_kHz"], ic["f_low_kHz"], ic["delta_check"]))
    print("\n## 6.1 Generating grinding with dressing")
    gd = gen_grinding_with_dressing(P)
    print("  grind %.2f + dressing share %.3f = %.2f min; %.0f dressings, %.0f parts per wheel" % (
        gd["t_grind"], gd["dress_share"], gd["t_cycle"], gd["dressings_per_wheel"], gd["parts_per_wheel"]))
    for cb in (5, 10, 15):
        ft = flank_twist(P, cb)
        print("  C_beta %2d um: L_alpha %.2f mm, beta_b %.2f deg -> twist %.1f um" % (cb, ft["L_alpha"], ft["beta_b_deg"], ft["twist_um"]))
    print("\n## 6.2 Profile grinding: passes vs time vs burn (stock 0.10 mm)")
    for r in prof_grinding_options(P):
        print("  %d passes, ae %.3f: %5.2f min, Q'w %5.2f -> corundum %-3s CBN %s" % (
            r["passes"], r["ae"], r["t"], r["Qw"], "ok" if r["corundum"] else "BURN", "ok" if r["CBN"] else "BURN"))
    print("  same stock at vf 9000 mm/min:")
    for r in prof_grinding_options(P, vf=9000.0)[:3]:
        print("  %d passes, ae %.3f: %5.2f min, Q'w %5.2f -> corundum %-4s CBN %s" % (
            r["passes"], r["ae"], r["t"], r["Qw"], "ok" if r["corundum"] else "BURN", "ok" if r["CBN"] else "BURN"))
    bc = burn_check(P)
    print("  default (4 passes, ae %.2f): Q'w %.2f <= %.1f %s; vf max %.0f mm/min" % (P["pgr_ae"], bc["Qw"], bc["limit"], "ok" if bc["ok"] else "BURN", bc["vf_max"]))
    print("\n## 6.3 Honing, shot peening")
    for st in (20, 40, 60):
        print("  honing stock %d um: %.2f min" % (st, honing_time(st)))
    print("  peening coverage 98 %% in 60 s -> 200 %% needs %.0f s (as 2 x 98 %% runs); sigma_Flim 500 -> %.0f MPa" % (
        2 * peening_coverage_time(0.98), peening_gain()))
    print("\n## 6.4 Choice of the hard finishing process")
    for r in HARD_FINISH_CHOICE:
        print("  %-20s | %-42s | %-9s | %s" % r)

# ================================================================ added with guide chapters (ch78)
# ---------------------------------------------------------------- 7.1 tolerances for several grades
def tolerance_grades(P=None, grades=(4, 5, 6, 7, 8, 9)):
    """ISO 1328-1 tolerances of the workpiece for several flank grades (gear.iso1328_2013, check the standard)."""
    P = P or DEFAULT
    w = work_geometry(P)
    return [dict(grade=A, **gear.iso1328_2013(P["mn"], w["d"], P["b"], A)) for A in grades]

def roll_test_tolerances(mn, d, A):
    """Double-flank (radial composite) tolerances in the style of ISO 1328-2:1997 (grade 5 base, step sqrt 2):
    F_i'' = (3.2 mn + 1.01 sqrt(d) + 6.4) k, f_i'' = (2.96 mn + 0.01 sqrt(d) + 0.8) k  [um]. The 2020 edition uses a
    different grade system (R30 ... R50) - check before use."""
    k = math.sqrt(2) ** (A - 5)
    return {"Fi2": (3.2 * mn + 1.01 * math.sqrt(d) + 6.4) * k, "fi2": (2.96 * mn + 0.01 * math.sqrt(d) + 0.8) * k}

DEVIATION_CAUSES = [   # deviation, what it is, typical manufacturing cause, remedy
    ("f_p / F_p (pitch)", "single / cumulative error of tooth spacing", "table / index error, hob runout, workpiece clamping eccentric, z and z0 with common factor",
     "true-running clamping, hunting tooth ratio, check table drive"),
    ("F_r (runout)", "radial position of the tooth gaps vs the datum axis", "blank bore / centre not concentric to the hob path, mandrel runout, heat-treat distortion",
     "machine on the functional datum, grind the bore and the teeth in one clamping"),
    ("f_Halpha (profile slope)", "pressure angle too large / small", "hob or grinding-worm pressure angle error, dressing roll wear, wrong swivel angle",
     "correct the dresser / regrind hob, profile slope correction on the machine"),
    ("f_falpha (profile form)", "waviness / form of the involute", "hob gash spacing, enveloping flats, hob tooth wear, grinding-wheel dressing",
     "more gashes, sharp hob, dress more often"),
    ("f_Hbeta (helix slope)", "helix angle too large / small", "machine axis alignment, differential setting, heat-treat helix 'unwinding'",
     "correct the helix on the grinding machine (lead correction), compensate distortion in the soft stage"),
    ("f_fbeta (helix form)", "waviness along the face", "axial feed marks, machine vibration, clamping deflection",
     "lower feed, rigid clamping, finishing cut"),
    ("growth / distortion", "change of size and form in heat treatment", "carburising + quench: bore shrinks, helix and profile change, tooth thickness grows",
     "measure the shift on first parts, pre-correct the soft geometry, press quench for thin wheels"),
]

# ---------------------------------------------------------------- 7.3 size control: span and pins
def _gear_P(P):
    """gear.py input for the workpiece as gear 2 of a pair (mating gear from gear.DEFAULT)."""
    return dict(gear.DEFAULT, mn=P["mn"], z2=P["z"], x2=P["x"], beta_deg=P["beta_deg"], alpha_n_deg=P["alpha_n_deg"],
                b=P["b"], a_w=None)

def size_control(P=None, allowance_um=(-50, -80)):
    """Base tangent length W_k and dimension over balls M_d after grinding (with the tooth-thickness allowances)
    and in the soft / green state (+ grinding stock on both flanks)."""
    P = P or DEFAULT
    Pg = _gear_P(P)
    g = gear.geometry(Pg)
    up, lo = allowance_um
    W_up = gear.span_measurement(Pg, g, 2, up)
    W_lo = gear.span_measurement(Pg, g, 2, lo)
    M_up = gear.over_pins(Pg, g, 2, allowance_um=up)
    M_lo = gear.over_pins(Pg, g, 2, allowance_um=lo)
    q = P["stock_per_flank"]
    return {"k": W_up["k"], "Wk_nominal": W_up["Wk_nominal"], "Wk_max": W_up["Wk"], "Wk_min": W_lo["Wk"],
            "Wk_green_max": W_up["Wk"] + 2 * q, "Wk_green_min": W_lo["Wk"] + 2 * q,
            "DM": M_up["DM"], "M_max": M_up["M"], "M_min": M_lo["M"], "fits_face": W_up["fits_face"]}

# ---------------------------------------------------------------- 7.4 measurement uncertainty, conformance
def gauge_capability(tol_um, U_um):
    """Ratio of the expanded measurement uncertainty U (k = 2) to the tolerance; acceptance limits shrunk by U
    (ISO 14253-1 conformance). Rule of thumb: U/T <= 0.1 good, <= 0.2 usable (check your QM rules)."""
    r = U_um / tol_um
    return {"ratio": r, "verdict": "good" if r <= 0.1 else ("usable" if r <= 0.2 else "not capable"),
            "acceptance_limit_um": tol_um - U_um}

# ---------------------------------------------------------------- 7.5 SPC
def span_samples(P=None, n=25, sigma_um=4.0, shift_um=0.0, seed=7):
    """ILLUSTRATIVE span measurements (normal distribution around the middle of the tolerance + shift)."""
    import random   # local: the merge keeps only the code after the gearmfg import
    sc = size_control(P)
    mid = 0.5 * (sc["Wk_max"] + sc["Wk_min"])
    r = random.Random(seed)
    return [mid + (shift_um + r.gauss(0.0, sigma_um)) / 1000.0 for _ in range(n)]

def cp_cpk(x, LSL, USL):
    import statistics
    mu, s = statistics.mean(x), statistics.stdev(x)
    return {"mean": mu, "s": s, "Cp": (USL - LSL) / (6 * s), "Cpk": min(USL - mu, mu - LSL) / (3 * s)}

def xbar_r_limits(x, n=5):
    """X-bar / R control chart limits for subgroups of n = 5: A2 0.577, D3 0, D4 2.114, d2 2.326."""
    import statistics
    A2, D3, D4, d2 = 0.577, 0.0, 2.114, 2.326
    groups = [x[i:i + n] for i in range(0, len(x) - n + 1, n)]
    xb = [statistics.mean(g) for g in groups]
    R = [max(g) - min(g) for g in groups]
    Xbb, Rb = statistics.mean(xb), statistics.mean(R)
    return {"groups": len(groups), "Xbar": Xbb, "Rbar": Rb, "UCL_x": Xbb + A2 * Rb, "LCL_x": Xbb - A2 * Rb,
            "UCL_R": D4 * Rb, "LCL_R": D3 * Rb, "sigma_est": Rb / d2, "xbars": xb, "ranges": R}

# ---------------------------------------------------------------- 7.6 machines, bottleneck, lot size
OP_TIMES = ("hobbing", "skiving", "shaping", "gen_grinding", "prof_grinding")

def _op_minutes(P):
    w = work_geometry(P)
    return {"hobbing": hob_time(P, w)["t_total_min"], "skiving": skiving(P, w)["t_total_min"],
            "shaping": shaping_time(P, w)["t_total_min"], "gen_grinding": gen_grinding_time(P)["t_total_min"],
            "prof_grinding": prof_grinding_time(P)["t_total_min"]}

def machines_needed(P=None, ops=("hobbing", "gen_grinding"), hours_year=3680.0, OEE=0.75):
    """Machines per operation: (annual x t + setups per year x setup time) / (available minutes x OEE).
    hours_year 3680 = 2 shifts x 8 h x 230 days (example)."""
    P = P or DEFAULT
    t = _op_minutes(P)
    out = []
    for op in ops:
        load = P["annual"] * t[op] + P["annual"] / P["batch"] * P["setup_min"][op]
        m = load / (hours_year * 60 * OEE)
        out.append({"op": op, "t_min": t[op], "load_h": load / 60, "machines": m, "installed": max(1, math.ceil(m)),
                    "utilisation": m / max(1, math.ceil(m))})
    neck = max(out, key=lambda r: r["machines"])
    return {"ops": out, "bottleneck": neck["op"], "max_annual_one_machine": hours_year * 60 * OEE / neck["t_min"]}

def economic_lot(P=None, op="hobbing", part_value=15.0, interest=0.20, extra_setup_eur=0.0):
    """Economic lot size (Andler / Harris): Q* = sqrt(2 D S / H), S = setup cost per lot, H = holding cost per part
    and year = part value x interest rate (check your company's rate)."""
    P = P or DEFAULT
    S = P["setup_min"][op] / 60.0 * P["rate"][op] + extra_setup_eur
    H = part_value * interest
    D = P["annual"]
    Q = math.sqrt(2 * D * S / H)
    cost = lambda q: D / q * S + q / 2 * H
    return {"S": S, "H": H, "Q_star": Q, "cost_at_Q": cost(Q), "cost_at_batch": cost(P["batch"]), "lots_per_year": D / Q}

# ---------------------------------------------------------------- 7.7 cost per part vs annual volume
SPECIAL_TOOLS = {   # design-specific tools, EUR (amortised over the product life) - check quotations
    "hob": 2400.0, "skiving_tool": 6000.0, "dressing_roll": 7000.0, "fixtures": 3000.0}

def chain_cost_vs_volume(P=None, volumes=(100, 300, 1000, 3000, 10000, 30000), years=3.0):
    """Cost per part of three chains vs annual volume: machine time + setup per lot (lot = min(batch, annual))
    + heat treatment + special tools amortised over 'years' (hob: the larger of wear cost and amortisation)."""
    P = P or DEFAULT
    w = work_geometry(P)
    t = _op_minutes(P)
    ht = P["rate"]["heat_treat_per_kg"] * w["mass_kg"]
    rows = []
    for V in volumes:
        Q = dict(P, batch=min(P["batch"], V))
        n_life = V * years
        hob_tool = max(hob_tool_cost_per_part(Q), SPECIAL_TOOLS["hob"] / n_life)
        fx = SPECIAL_TOOLS["fixtures"] / n_life
        c = {"hob+gen_grind": op_cost(Q, "hobbing", t["hobbing"]) + hob_tool + ht + op_cost(Q, "gen_grinding", t["gen_grinding"])
             + SPECIAL_TOOLS["dressing_roll"] / n_life + fx,
             "hob+prof_grind": op_cost(Q, "hobbing", t["hobbing"]) + hob_tool + ht + op_cost(Q, "prof_grinding", t["prof_grinding"]) + fx,
             "skive+gen_grind": op_cost(Q, "skiving", t["skiving"]) + SPECIAL_TOOLS["skiving_tool"] / n_life + ht
             + op_cost(Q, "gen_grinding", t["gen_grinding"]) + SPECIAL_TOOLS["dressing_roll"] / n_life + fx}
        rows.append({"V": V, **c, "best": min(c, key=c.get)})
    return rows

def break_even_volume(P=None, years=3.0, a="hob+gen_grind", b="hob+prof_grind"):
    """Annual volume where chain a becomes cheaper than chain b (bisection on a log scale)."""
    f = lambda V: chain_cost_vs_volume(P, (V,), years)[0][a] - chain_cost_vs_volume(P, (V,), years)[0][b]
    lo, hi = 1.0, 1e6
    if f(lo) * f(hi) > 0:
        return None
    for _ in range(80):
        mid = math.sqrt(lo * hi)
        if f(lo) * f(mid) <= 0:
            hi = mid
        else:
            lo = mid
    return math.sqrt(lo * hi)

# ---------------------------------------------------------------- 7.8 heat-treat furnace and lead time
def furnace_plan(P=None, load_kg=600.0, fixture_share=0.30, t_heat_h=1.5, t_diffuse_h=1.0, t_quench_h=0.5,
                 hours_year=6000.0, OEE=0.85):
    """Sealed-quench (batch) furnace: parts per load from the net load mass, cycle = heat-up + carburise (Harris) +
    diffuse / cool to hardening temperature + quench; loads per year and furnace utilisation (3-shift furnace)."""
    P = P or DEFAULT
    w = work_geometry(P)
    parts = int(load_kg * (1 - fixture_share) / w["mass_kg"])
    t_carb = carburising_time(chd_plan(P)["CHD_green"], P["T_carb_C"], P["case_ratio"])
    cycle = t_heat_h + t_carb + t_diffuse_h + t_quench_h
    loads = math.ceil(P["annual"] / parts)
    util = loads * cycle / (hours_year * OEE)
    return {"parts_per_load": parts, "t_carb_h": t_carb, "cycle_h": cycle, "loads_per_year": loads,
            "furnace_h": loads * cycle, "utilisation": util, "parts_per_hour": parts / cycle}

def lead_time(P=None, transfer=None, queue_h_per_op=8.0, wait_furnace_h=16.0):
    """Lead time of one lot through soft cell -> furnace -> hard cell: sequential lot processing (whole lot moves) vs
    overlapped (transfer batches of 'transfer' parts), plus queue times (examples, check with your shop)."""
    P = P or DEFAULT
    t = _op_minutes(P)
    n = P["batch"]
    fp = furnace_plan(P)
    loads = math.ceil(n / fp["parts_per_load"])
    soft, hard = n * t["hobbing"] / 60, n * t["gen_grinding"] / 60
    furn = loads * fp["cycle_h"]
    seq = soft + furn + hard + 2 * queue_h_per_op + wait_furnace_h
    tr = transfer or fp["parts_per_load"]
    # overlapped: the furnace starts after the first load is hobbed, grinding after the first load is hardened
    ovl = tr * t["hobbing"] / 60 + max(furn, soft - tr * t["hobbing"] / 60) + tr * t["gen_grinding"] / 60 \
        + max(0.0, hard - furn) + 2 * queue_h_per_op + wait_furnace_h
    return {"lot": n, "loads": loads, "soft_h": soft, "furnace_h": furn, "hard_h": hard, "sequential_h": seq, "overlapped_h": ovl}

# ---------------------------------------------------------------- 8.x design for manufacture: integral pinion shaft
def tool_shoulder_clearance(df, D_sh, d_tool):
    """Axial run-out length a disc-shaped tool (hob, grinding worm) needs in front of a shoulder of diameter D_sh when
    it cuts to the root diameter df: L = sqrt(r0^2 - (df/2 + r0 - D_sh/2)^2) (spur / axial-plane approximation, check).
    Returns 0 if the shoulder is below the root circle."""
    r0 = d_tool / 2
    y = df / 2 + r0 - D_sh / 2
    return math.sqrt(max(r0 ** 2 - y ** 2, 0.0)) if D_sh > df else 0.0

def hunting_check(z, z0):
    """z and the number of hob starts z0 should have no common factor: every hob thread then cuts every gap
    and the thread-to-thread pitch errors are spread instead of repeating."""
    g = math.gcd(int(z), int(z0))
    return {"gcd": g, "hunting": g == 1}

def shaft_mass(segments):
    """Mass of a stepped shaft [(diameter, length), ...] mm -> kg (steel 7.85e-6 kg/mm^3)."""
    return sum(7.85e-6 * math.pi / 4 * d ** 2 * L for d, L in segments)

EXAMPLE_PINION = {
    "name": "M5 pinion z 19 (integral pinion shaft), case hardened and ground (worked example chapter 8)",
    "z": 19, "x": 0.25, "hand": "left", "hob_hand": "left", "hob_da0": 56.0, "hob_z0": 2, "hob_gashes": 14,
    "batch": 400, "annual": 4000, "grade_required": 6,
}
PINION_SHAFT = [(30.0, 40.0), (40.0, 12.0), (44.0, 28.0), (40.0, 12.0), (30.0, 30.0), (25.0, 50.0)]   # (d, L) mm, example

INSPECTION_PLAN = [   # characteristic, method / instrument, frequency, limit (example plan, check with the customer)
    ("blank: bearing seats, face runout", "CMM / runout gauge", "first part + 1 per 50", "IT6, 10 um"),
    ("soft: W_k (green)", "span micrometer at the hobbing machine", "every 10th part + after hob change", "W_k + 2q, +/-20 um"),
    ("soft: profile + helix (first part)", "gear measuring machine (GMM)", "first part, after hob shift / regrind", "grade 8"),
    ("heat treatment: surface / core hardness, CHD", "Vickers traverse on a test piece in every load", "every load", "58-62 HRC, CHD 0.35 +0.15"),
    ("heat treatment: distortion", "W_k, runout on 5 parts per load", "every load", "for stock planning"),
    ("ground: W_k / M_d", "span micrometer / ball gauge at the grinder", "every part (in-process probe) or 1 per 5", "tolerance of the drawing"),
    ("ground: f_Halpha, f_Hbeta, F_alpha, F_beta, f_p, F_p, F_r", "GMM, 4 teeth at 90 deg", "first part + 1 per 50 + after dressing change", "grade 6"),
    ("ground: grinding burn", "nital etch (ISO 14104) or Barkhausen noise", "first part + 1 per lot / 100 % Barkhausen", "class A/B"),
    ("ground: roughness Ra / Rz", "stylus instrument on the flank", "1 per lot", "Ra <= 0.4 um"),
    ("final: double-flank roll test F_i'', f_i''", "roll tester against a master gear", "100 % (fast) or 1 per 20", "grade from 7.2"),
]

def pinion_example():
    P = dict(DEFAULT, **{k: v for k, v in EXAMPLE_PINION.items()})
    w = work_geometry(P)
    hs, ht = hob_setup(P, w), hob_time(P, w)
    gg, pg = gen_grinding_time(P), prof_grinding_time(P)
    D_sh = 40.0
    cl = {"hob da0 70": tool_shoulder_clearance(w["df"], D_sh, 70.0), "hob da0 56": tool_shoulder_clearance(w["df"], D_sh, 56.0),
          "grinding worm 275": tool_shoulder_clearance(w["df"], D_sh, 275.0),
          "grinding worm 150 (small-wheel option)": tool_shoulder_clearance(w["df"], D_sh, 150.0),
          "profile wheel 100": tool_shoulder_clearance(w["df"], D_sh, 100.0)}
    m_shaft = shaft_mass(PINION_SHAFT)
    return {"P": P, "w": w, "hob": hs, "hob_t": ht, "gg": gg, "pg": pg, "clearance": cl, "D_sh": D_sh,
            "hunting": hunting_check(P["z"], P["hob_z0"]), "m_shaft": m_shaft, "chains": chain_options(P),
            "size": size_control(P, (-50, -80)), "machines": machines_needed(P), "furnace": furnace_plan(P),
            "chd": chd_plan(P), "ht_cost_shaft": P["rate"]["heat_treat_per_kg"] * m_shaft,
            "ht_cost_model": P["rate"]["heat_treat_per_kg"] * w["mass_kg"]}

# ---------------------------------------------------------------- demo
def demo_ch78():
    P = dict(DEFAULT)
    w = work_geometry(P)
    print("## 7.1 ISO 1328-1 tolerances of the default wheel (d %.3f, mn %.1f, b %.0f) [um]" % (w["d"], P["mn"], P["b"]))
    print("  grade   f_pT   F_pT  F_aT  F_bT  F_rT   F_i''  f_i''")
    for r in tolerance_grades(P):
        rt = roll_test_tolerances(P["mn"], w["d"], r["grade"])
        print("  %5d %6.1f %6.1f %5.1f %5.1f %5.1f %7.1f %6.1f" % (r["grade"], r["fpT"], r["FpT"], r["FalphaT"], r["FbetaT"], r["FrT"], rt["Fi2"], rt["fi2"]))
    print("\n## 7.2 Deviation -> cause -> remedy")
    for d, what, cause, rem in DEVIATION_CAUSES:
        print("  %-26s | %s | %s | %s" % (d, what, cause, rem))
    print("\n## 7.3 Size control of the default wheel (allowance -50 / -80 um, stock %.2f mm per flank)" % P["stock_per_flank"])
    sc = size_control(P)
    print("  W_k over k = %d teeth: nominal %.4f; ground %.4f ... %.4f; green (before grinding) %.4f ... %.4f mm; fits face: %s" % (
        sc["k"], sc["Wk_nominal"], sc["Wk_min"], sc["Wk_max"], sc["Wk_green_min"], sc["Wk_green_max"], sc["fits_face"]))
    print("  over balls D_M %.2f: M_d %.4f ... %.4f mm" % (sc["DM"], sc["M_min"], sc["M_max"]))
    print("\n## 7.4 Measurement uncertainty vs tolerance (grade 6)")
    tol = gear.iso1328_2013(P["mn"], w["d"], P["b"], 6)
    for name, T, U in (("profile F_alpha, GMM U 1.5 um", tol["FalphaT"], 1.5), ("helix F_beta, GMM U 1.5 um", tol["FbetaT"], 1.5),
                       ("W_k band 30 um, micrometer U 3 um", 30 * math.cos(math.radians(20)), 3.0),
                       ("profile F_alpha, shop-floor GMM U 3 um", tol["FalphaT"], 3.0)):
        gc = gauge_capability(T, U)
        print("  %-40s T %5.1f um -> U/T %.2f (%s), acceptance limit %.1f um" % (name, T, gc["ratio"], gc["verdict"], gc["acceptance_limit_um"]))
    print("\n## 7.5 SPC of the ground span W_k (ILLUSTRATIVE data, 25 parts)")
    for lab, sig, sh in (("stable process sigma 4 um", 4.0, 0.0), ("same, mean shifted +8 um (dresser drift)", 4.0, 8.0), ("worn machine sigma 7 um", 7.0, 0.0)):
        x = span_samples(P, 25, sig, sh)
        c = cp_cpk(x, sc["Wk_min"], sc["Wk_max"])
        print("  %-42s mean %.4f, s %.2f um -> Cp %.2f, Cpk %.2f %s" % (lab, c["mean"], 1000 * c["s"], c["Cp"], c["Cpk"],
                                                                       "capable (>= 1.33)" if c["Cpk"] >= 1.33 else "NOT capable"))
    xr = xbar_r_limits(span_samples(P, 25, 4.0, 0.0))
    print("  X-bar/R chart (5 subgroups of 5): X-bar %.4f, UCL %.4f, LCL %.4f; R-bar %.2f um, UCL_R %.2f um; sigma from R %.2f um" % (
        xr["Xbar"], xr["UCL_x"], xr["LCL_x"], 1000 * xr["Rbar"], 1000 * xr["UCL_R"], 1000 * xr["sigma_est"]))
    print("\n## 7.6 Machines for %d parts/year (2 shifts, OEE 0.75), lot %d" % (P["annual"], P["batch"]))
    mn_ = machines_needed(P, OP_TIMES)
    for r in mn_["ops"]:
        print("  %-14s %5.2f min/part -> load %6.1f h/yr -> %.2f machines (install %d, utilisation %.0f %%)" % (
            r["op"], r["t_min"], r["load_h"], r["machines"], r["installed"], 100 * r["utilisation"]))
    m2 = machines_needed(P, ("hobbing", "gen_grinding"))
    print("  chain hobbing + generating grinding: bottleneck %s, one machine each carries up to %.0f parts/yr" % (m2["bottleneck"], m2["max_annual_one_machine"]))
    hv = machines_needed(dict(P, annual=150000, batch=5000), ("hobbing", "gen_grinding"), hours_year=6000.0, OEE=0.80)
    print("  high volume 150 000 parts/yr (3 shifts 6000 h, OEE 0.80): " + "; ".join("%s %.2f -> install %d" % (r["op"], r["machines"], r["installed"]) for r in hv["ops"]))
    hc = hunting_check(P["z"], P["hob_z0"])
    print("  default wheel z %d with a %d-start hob: common factor %d -> hunting %s" % (P["z"], P["hob_z0"], hc["gcd"], "yes" if hc["hunting"] else "NO (use z0 1 or 3, or accept repeating pattern)"))
    for op, extra in (("hobbing", 0.0), ("gen_grinding", 0.0), ("gen_grinding", 150.0)):
        el = economic_lot(P, op, extra_setup_eur=extra)
        print("  economic lot %-13s (setup %.0f EUR, holding %.1f EUR/part yr): Q* %.0f parts, %.1f lots/yr; cost/yr at Q* %.0f vs at lot %d: %.0f EUR" % (
            op + (" +dress" if extra else ""), el["S"], el["H"], el["Q_star"], el["lots_per_year"], el["cost_at_Q"], P["batch"], el["cost_at_batch"]))
    print("\n## 7.7 Cost per part vs annual volume (3-year product life, special tools amortised) [EUR]")
    print("  volume/yr   hob+gen_grind  hob+prof_grind  skive+gen_grind   cheapest")
    for r in chain_cost_vs_volume(P):
        print("  %9d %14.2f %15.2f %16.2f   %s" % (r["V"], r["hob+gen_grind"], r["hob+prof_grind"], r["skive+gen_grind"], r["best"]))
    be = break_even_volume(P)
    print("  break-even hob+gen_grind vs hob+prof_grind: %.0f parts/yr" % be if be else "  no break-even in range")
    print("\n## 7.8 Heat-treat furnace and lead time")
    fp = furnace_plan(P)
    print("  sealed-quench furnace 600 kg gross: %d parts/load, carburise %.2f h, cycle %.2f h, %d loads/yr -> %.0f furnace h, utilisation %.0f %%, %.1f parts/h" % (
        fp["parts_per_load"], fp["t_carb_h"], fp["cycle_h"], fp["loads_per_year"], fp["furnace_h"], 100 * fp["utilisation"], fp["parts_per_hour"]))
    lt = lead_time(P)
    print("  lot %d: hobbing %.1f h, furnace %.1f h (%d loads), grinding %.1f h -> lead time sequential %.1f h, overlapped %.1f h" % (
        lt["lot"], lt["soft_h"], lt["furnace_h"], lt["loads"], lt["hard_h"], lt["sequential_h"], lt["overlapped_h"]))
    print("\n## 8.2 Worked example - M5 pinion z 19 on an integral pinion shaft")
    E = pinion_example()
    Q, w2 = E["P"], E["w"]
    print("  d %.3f, da %.3f, df %.3f, h %.3f mm; hob da0 %.0f z0 %d (%s hand): lead angle %.3f, swivel %.3f deg; hunting z/z0: %s (gcd %d)" % (
        w2["d"], w2["da"], w2["df"], w2["h"], Q["hob_da0"], Q["hob_z0"], Q["hob_hand"], E["hob"]["gamma0_deg"], E["hob"]["eta_deg"],
        "yes" if E["hunting"]["hunting"] else "no", E["hunting"]["gcd"]))
    print("  hobbing: n0 %.0f rpm, table %.1f rpm, approach %.1f mm -> %.2f min; gen. grinding %.2f min; profile grinding %.2f min" % (
        E["hob"]["n0"], E["hob"]["n_table"], E["hob_t"]["La"], E["hob_t"]["t_total_min"], E["gg"]["t_total_min"], E["pg"]["t_total_min"]))
    print("  run-out length needed in front of the %.0f mm shoulder:" % E["D_sh"])
    for k, v in E["clearance"].items():
        print("    %-40s %.1f mm" % (k, v))
    s = E["size"]
    print("  size: W_k over %d teeth %.4f ... %.4f (green %.4f ... %.4f) mm; M_d over balls %.2f: %.4f ... %.4f mm" % (
        s["k"], s["Wk_min"], s["Wk_max"], s["Wk_green_min"], s["Wk_green_max"], s["DM"], s["M_min"], s["M_max"]))
    print("  heat treatment: CHD final %.3f, green %.3f mm; shaft mass %.2f kg (model blank %.2f kg) -> %.2f EUR (model %.2f EUR)" % (
        E["chd"]["CHD_final"], E["chd"]["CHD_green"], E["m_shaft"], w2["mass_kg"], E["ht_cost_shaft"], E["ht_cost_model"]))
    print("  machines: " + "; ".join("%s %.2f (%d)" % (r["op"], r["machines"], r["installed"]) for r in E["machines"]["ops"]))
    print("  cheapest chain meeting grade %d: %s, %.2f min, %.2f EUR/part" % (Q["grade_required"], E["chains"][0]["chain"], E["chains"][0]["t_min"], E["chains"][0]["cost"]))
    print("\n## 8.3 Inspection plan of the example (what, how, how often)")
    for c, m, f, l in INSPECTION_PLAN:
        print("  %-48s | %-44s | %-40s | %s" % (c, m, f, l))

def cmd_examples():
    P = dict(DEFAULT)
    print(report_text(P))
    print("\n## Hob starts and gashes: time vs surface (same vc, fa)")
    for z0, i0 in ((1, 16), (2, 16), (3, 16), (3, 20)):
        Q = dict(P, hob_z0=z0, hob_gashes=i0)
        print("  z0 %d, %2d gashes: %.2f min, enveloping flats %.2f um, h_max %.3f mm" % (
            z0, i0, hob_time(Q)["t_cut_min"], 1000 * envelope_depth(Q), hoffmeister_hmax(Q)))
    print("\n## Axial feed: time vs feed-mark depth")
    for fa in (1.0, 2.0, 3.0, 4.0):
        Q = dict(P, hob_fa=fa)
        print("  fa %.1f mm/rev: %.2f min, feed marks %.2f um" % (fa, hob_time(Q)["t_cut_min"], 1000 * feed_mark_depth(fa, P["hob_da0"], 20)))
    print("\n## Induction reference depth vs frequency (hot steel)")
    for fq in (3e3, 10e3, 30e3, 100e3, 300e3):
        print("  f %6.0f kHz: %.2f mm" % (fq / 1000, induction_depth(fq)))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-66s %s %s" % (name, "OK  " if cond else "FAIL", info))
    P = dict(DEFAULT)
    w = work_geometry(P)
    hs = hob_setup(P, w)
    chk("hobbing index: n_table z = n0 z0", abs(hs["n_table"] * P["z"] - hs["n0"] * P["hob_z0"]) < 1e-9)
    chk("hob lead angle: sin(g0) = z0 mn / d0", abs(math.sin(math.radians(hs["gamma0_deg"])) - P["hob_z0"] * P["mn"] / hs["d0"]) < 1e-12)
    R = P["hob_da0"] / 2
    exact = (R - math.sqrt(R ** 2 - (P["hob_fa"] / 2) ** 2)) * math.sin(math.radians(20))
    approx = feed_mark_depth(P["hob_fa"], P["hob_da0"], 20)
    chk("feed mark formula = exact circle sagitta x sin(an) (within 0.1 %)", abs(approx / exact - 1) < 1e-3, "%.3f um" % (1000 * exact))
    d16, d32 = envelope_depth(P), envelope_depth(dict(P, hob_gashes=32))
    chk("enveloping flats scale with 1/i0^2", abs(d16 / d32 - 4) < 1e-12)
    t = carburising_time(0.8, 930, 0.6)
    chk("Harris inverse: case after carburising_time = CHD / ratio", abs(harris_total_case(t, 930) - 0.8 / 0.6) < 1e-12, "%.2f h" % t)
    chk("Harris: 4x time -> 2x case", abs(harris_total_case(4, 900) / harris_total_case(1, 900) - 2) < 1e-12)
    sk = skiving(P, w)
    S, be, b0 = math.radians(P["skv_Sigma_deg"]), math.radians(P["beta_deg"]), math.radians(sk["beta0_deg"])
    vw = (0.0, sk["vw"])
    v0 = (-sk["v0"] * math.sin(S), sk["v0"] * math.cos(S))
    vr = (v0[0] - vw[0], v0[1] - vw[1])
    chk("skiving: relative speed is along the tooth line (vector check)", abs(vr[0] * math.sin(be) - vr[1] * math.cos(be)) < 1e-9)
    chk("skiving: |v_rel| = v_c", abs(math.hypot(*vr) - P["skv_vc"]) < 1e-9, "%.3f" % math.hypot(*vr))
    chk("induction depth 10 kHz hot steel ~ 5.5 mm", abs(induction_depth(1e4) - 5.508) < 0.01, "%.3f" % induction_depth(1e4))
    ht = hob_time(P, w)
    chk("hobbing time = z L / (z0 n0 fa)", abs(ht["t_cut_min"] - P["z"] * ht["L"] / (P["hob_z0"] * hs["n0"] * P["hob_fa"])) < 1e-12)
    ch = chain_options(P)
    chk("chains: cheapest chain that meets the grade is listed first", ch[0]["meets"] and
        all(r["cost"] >= ch[0]["cost"] for r in ch if r["meets"]))
    chk("honing alone not feasible with 0.10 mm stock, feasible with 0.04 mm",
        not any(r["meets"] for r in ch if r["hard"] == "honing") and
        any(r["meets"] for r in chain_options(dict(P, stock_per_flank=0.04)) if r["hard"] == "honing"))
    c = chd_plan(P)
    chk("CHD after grinding inside the 0.15..0.20 mn rule", c["rule"]["CHD_min"] <= c["CHD_final"] <= c["rule"]["CHD_max"])
    gg = gen_grinding_time(P)
    chk("generating grinding: finish time / rough time = fa_rough / fa_finish", abs(gg["t_finish"] / gg["t_rough"] - P["grd_fa_rough"] / P["grd_fa_finish"]) < 1e-12)
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
        out = "gearmfg_out"
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
