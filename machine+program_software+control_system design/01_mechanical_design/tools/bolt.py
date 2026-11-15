#!/usr/bin/env python3
"""M7 bolted-joint program - concentric single-bolt joint in the style of VDI 2230 Part 1 (2015): calculation steps
R0-R13 - thread geometry (ISO 724), bolt compliance, plate compliance with the deformation-cone / sleeve model, load
factor, embedding loss, required clamp load (slip, sealing, opening), required and permissible assembly preload,
tightening torque, working stress, fatigue (rolled before / after heat treatment), surface pressure, slip safety.
Through-bolt with nut (DSV) or tapped-thread joint (ESV). Guide: 07_bolted_joints.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python bolt.py params | run [--in p.json] [--out folder] | examples | selftest
  python bolt.py ch24 | ch56 | ch78        extra results of guide chapters 2-4, 5-6, 7-8
  python bolt.py run --in examples/bolt_example.json --out example   worked design example (chapter 8)

VDI 2230 is implemented in a SIMPLIFIED form (concentric clamping and loading, load introduction factor n given,
no bending / prying, no temperature change unless given). Tightening factors, friction ranges, embedding amounts,
limiting surface pressures and fatigue values are typical values from the guideline style tables - check VDI 2230
Part 1 (2015) and the bolt supplier before a design is released. All default numbers are EXAMPLES.
"""
import json
import math
import os
import sys

# ISO coarse threads: P, width across flats s, head bearing diameter dw (~ dw,min hex head ISO 4014/4017), hole dh medium (ISO 273)
THREADS = {
    "M6":  {"d": 6.0,  "P": 1.0,  "s": 10.0, "dw": 8.9,  "dh": 6.6},
    "M8":  {"d": 8.0,  "P": 1.25, "s": 13.0, "dw": 11.6, "dh": 9.0},
    "M10": {"d": 10.0, "P": 1.5,  "s": 16.0, "dw": 14.6, "dh": 11.0},
    "M12": {"d": 12.0, "P": 1.75, "s": 18.0, "dw": 16.6, "dh": 13.5},
    "M16": {"d": 16.0, "P": 2.0,  "s": 24.0, "dw": 22.5, "dh": 17.5},
    "M20": {"d": 20.0, "P": 2.5,  "s": 30.0, "dw": 28.2, "dh": 22.0},
    "M24": {"d": 24.0, "P": 3.0,  "s": 36.0, "dw": 33.6, "dh": 26.0},
    "M30": {"d": 30.0, "P": 3.5,  "s": 46.0, "dw": 42.8, "dh": 33.0},
}
CLASSES = {"8.8": {"Rp": 640.0, "Rm": 800.0}, "10.9": {"Rp": 940.0, "Rm": 1040.0}, "12.9": {"Rp": 1100.0, "Rm": 1220.0}}
# clamped-part materials: E (MPa), limiting surface pressure pG (MPa) - typical VDI 2230 table values (check)
PART_MATERIALS = {
    "S235":        {"E": 205000.0, "pG": 490.0},
    "E295":        {"E": 205000.0, "pG": 710.0},
    "C45 (QT)":    {"E": 205000.0, "pG": 630.0},
    "42CrMo4 (QT)": {"E": 205000.0, "pG": 1080.0},
    "EN-GJL-250":  {"E": 110000.0, "pG": 850.0},
    "EN-GJS-400":  {"E": 170000.0, "pG": 600.0},
    "AlMgSi1 F31": {"E": 70000.0,  "pG": 360.0},
}
TIGHTENING = {   # alpha_A typical (VDI 2230 table A8 style, check)
    "torque wrench / precision nut runner": 1.6,
    "impact wrench, adjusted": 2.5,
    "torque-controlled with friction test on the part": 1.4,
    "angle-controlled (yield range)": 1.0,
    "yield-controlled": 1.0,
}

DEFAULT = {
    "name": "Cylinder-head / flange through-bolt joint M12 10.9 of the compressor (example)",
    "thread": "M12", "cls": "10.9",
    "joint": "DSV",                   # DSV through-bolt with nut | ESV tapped thread (bolt in a tapped hole)
    "lK": 40.0,                       # clamp length mm
    "ls": 25.0,                       # shank length with diameter d inside lK mm (rest = free loaded thread)
    "DA": 36.0,                       # outer diameter of the clamped parts at the interface mm (substitute)
    "part_material": "C45 (QT)", "nut_side_material": "C45 (QT)",
    "FA_max": 12000.0, "FA_min": 0.0, # axial working load per bolt N (dynamic between min and max)
    "FQ": 3000.0, "qF": 1, "muT": 0.15,   # transverse load N, number of slip interfaces, interface friction
    "F_seal": 0.0,                    # clamp load needed for sealing N
    "n": 0.5,                         # load introduction factor (check VDI 2230 Part 1, section 5.2.2)
    "tightening": "torque wrench / precision nut runner",
    "muG_min": 0.10, "muG_max": 0.16, "muK_min": 0.10, "muK_max": 0.16,
    "nu": 0.9,                        # utilisation of the yield point at assembly
    "Rz": "<10",                      # surface roughness class for embedding: <10 | 10-40 | 40-160
    "n_interfaces": 1,                # inner interfaces between clamped plates
    "rolled": "before",               # thread rolled before | after heat treatment
    "S_slip_req": 1.8, "S_D_req": 1.2, "S_F_req": 1.0, "S_p_req": 1.0,
}

FZ_TABLE = {   # embedding amounts um (axial load): thread, per head / nut bearing, per inner interface (VDI 2230 table 5 style, check)
    "<10": (3.0, 2.5, 1.5), "10-40": (3.0, 3.0, 2.0), "40-160": (3.0, 4.0, 3.0)}

# ---------------------------------------------------------------- R0: geometry
def thread_geometry(P):
    t = THREADS[P["thread"]]
    d, p = t["d"], t["P"]
    d2 = d - 0.649519 * p
    d3 = d - 1.226869 * p
    dS = 0.5 * (d2 + d3)
    AS = math.pi / 4 * dS ** 2
    Ad3 = math.pi / 4 * d3 ** 2
    AN = math.pi / 4 * d ** 2
    return dict(t, d2=d2, d3=d3, dS=dS, AS=AS, Ad3=Ad3, AN=AN)

# ---------------------------------------------------------------- R3: compliances and load factor
def bolt_compliance(P, g=None):
    g = g or thread_geometry(P)
    ES = 205000.0
    d = g["d"]
    lGew = P["lK"] - P["ls"]
    if lGew < 0:
        raise ValueError("shank length ls must not exceed the clamp length lK")
    dSK = 0.5 * d / (ES * g["AN"])            # head (hex head)
    d1 = P["ls"] / (ES * g["AN"])             # shank
    dGew = lGew / (ES * g["Ad3"])             # free loaded thread
    dG = 0.5 * d / (ES * g["Ad3"])            # engaged thread
    if P["joint"] == "DSV":
        dM = 0.4 * d / (ES * g["AN"])         # nut
    else:
        EBI = PART_MATERIALS[P["nut_side_material"]]["E"]
        dM = 0.33 * d / (EBI * g["AN"])       # tapped hole
    tot = dSK + d1 + dGew + dG + dM
    return {"dSK": dSK, "d1": d1, "dGew": dGew, "dG": dG, "dM": dM, "deltaS": tot, "lGew": lGew}

def cone_angle(P, g=None):
    """tan(phi) of the deformation cone: DSV 0.362 + 0.032 ln(betaL/2) + 0.153 ln(y); ESV 0.348 + 0.013 ln(betaL) + 0.193 ln(y)."""
    g = g or thread_geometry(P)
    bL = P["lK"] / g["dw"]
    y = P["DA"] / g["dw"]
    if P["joint"] == "DSV":
        return 0.362 + 0.032 * math.log(bL / 2) + 0.153 * math.log(y)
    return 0.348 + 0.013 * math.log(bL) + 0.193 * math.log(y)

def plate_compliance(P, g=None):
    g = g or thread_geometry(P)
    EP = PART_MATERIALS[P["part_material"]]["E"]
    dw, dh, lK, DA = g["dw"], g["dh"], P["lK"], P["DA"]
    w = 1.0 if P["joint"] == "DSV" else 2.0
    tp = cone_angle(P, g)
    DAGr = dw + w * lK * tp
    if DA >= DAGr:                            # full cones
        dP = 2 * math.log((dw + dh) * (dw + w * lK * tp - dh) / ((dw - dh) * (dw + w * lK * tp + dh))) / (w * EP * math.pi * dh * tp)
        model = "cones"
    elif DA <= dw:                            # pure sleeve
        dP = 4 * lK / (EP * math.pi * (DA ** 2 - dh ** 2))
        model = "sleeve"
    else:                                     # cone + sleeve
        dP = (2 / (w * dh * tp) * math.log((dw + dh) * (DA - dh) / ((dw - dh) * (DA + dh))) +
              4 / (DA ** 2 - dh ** 2) * (lK - (DA - dw) / (w * tp))) / (EP * math.pi)
        model = "cone + sleeve"
    return {"tan_phi": tp, "phi_deg": math.degrees(math.atan(tp)), "DA_Gr": DAGr, "deltaP": dP, "model": model}

def load_factor(P, g=None):
    g = g or thread_geometry(P)
    dS = bolt_compliance(P, g)["deltaS"]
    dP = plate_compliance(P, g)["deltaP"]
    Phi_K = dP / (dS + dP)
    return {"Phi_K": Phi_K, "Phi_n": P["n"] * Phi_K, "cS": 1 / dS, "cP": 1 / dP}

# ---------------------------------------------------------------- R4: embedding
def embedding(P, g=None):
    g = g or thread_geometry(P)
    ft, fb, fi = FZ_TABLE[P["Rz"]]
    fZ = ft + 2 * fb + fi * P["n_interfaces"]            # um (head + nut bearing; ESV: head only + thread)
    if P["joint"] == "ESV":
        fZ = ft + fb + fi * P["n_interfaces"]
    dS = bolt_compliance(P, g)["deltaS"]
    dP = plate_compliance(P, g)["deltaP"]
    return {"fZ_um": fZ, "FZ": fZ / 1000.0 / (dS + dP)}

# ---------------------------------------------------------------- R2, R5-R7: clamp loads, preload, torque
def required_clamp(P):
    FKQ = P["FQ"] / (P["qF"] * P["muT"]) if P["FQ"] > 0 else 0.0
    return {"FKQ": FKQ, "FKP": P["F_seal"], "FKerf": max(FKQ, P["F_seal"])}

def FM_zul(P, g=None, mu=None):
    """Permissible assembly preload: sigma_red = nu Rp0.2 with tension + torsion (mu = muG_min)."""
    g = g or thread_geometry(P)
    mu = P["muG_min"] if mu is None else mu
    Rp = CLASSES[P["cls"]]["Rp"]
    k = 1.5 * g["d2"] / g["dS"] * (g["P"] / (math.pi * g["d2"]) + 1.155 * mu)
    return P["nu"] * Rp * g["AS"] / math.sqrt(1 + 3 * k ** 2)

def torque_coeff(P, g, muG, muK):
    DKm = 0.5 * (g["dw"] + g["dh"])
    return 0.16 * g["P"] + 0.58 * g["d2"] * muG + 0.5 * DKm * muK      # N mm per N preload

def tightening(P, g=None):
    g = g or thread_geometry(P)
    Fz = FM_zul(P, g)
    MA = Fz * torque_coeff(P, g, P["muG_min"], P["muK_min"]) / 1000.0       # N m
    FM_low_friction = Fz
    FM_high_friction = MA * 1000.0 / torque_coeff(P, g, P["muG_max"], P["muK_max"])
    aA = TIGHTENING[P["tightening"]]
    return {"FMzul": Fz, "MA": MA, "alpha_A": aA, "FM_high_mu": FM_high_friction, "FMmin_from_alphaA": Fz / aA,
            "friction_scatter": FM_low_friction / FM_high_friction}

def preload_check(P, g=None):
    g = g or thread_geometry(P)
    rc = required_clamp(P)
    lf = load_factor(P, g)
    ez = embedding(P, g)
    t = tightening(P, g)
    FMmin = rc["FKerf"] + (1 - lf["Phi_n"]) * P["FA_max"] + ez["FZ"]
    FMmax = t["alpha_A"] * FMmin
    return {"FMmin_req": FMmin, "FMmax_req": FMmax, "ok": FMmax <= t["FMzul"],
            "utilisation": FMmax / t["FMzul"]}

# ---------------------------------------------------------------- R8-R12: stresses and safeties
def working_stress(P, g=None):
    g = g or thread_geometry(P)
    lf = load_factor(P, g)
    Fz = FM_zul(P, g)
    Rp = CLASSES[P["cls"]]["Rp"]
    FSA = lf["Phi_n"] * P["FA_max"]
    FSmax = Fz + FSA
    sz = FSmax / g["AS"]
    MG = Fz * 0.5 * g["d2"] * (g["P"] / (math.pi * g["d2"]) + 1.155 * P["muG_min"])
    WP = math.pi / 16 * g["dS"] ** 3
    tau = MG / WP
    kt = 0.5                                   # residual torsion after assembly (VDI recommendation)
    sred = math.sqrt(sz ** 2 + 3 * (kt * tau) ** 2)
    return {"FSA": FSA, "FSmax": FSmax, "sigma_z": sz, "tau": tau, "sigma_red": sred, "S_F": Rp / sred,
            "FSA_ok": FSA <= 0.1 * Rp * g["AS"]}

def fatigue(P, g=None):
    g = g or thread_geometry(P)
    lf = load_factor(P, g)
    sa = lf["Phi_n"] * (P["FA_max"] - P["FA_min"]) / (2 * g["AS"])
    sASV = 0.85 * (150.0 / g["d"] + 45.0)
    if P["rolled"] == "after":
        Fz = FM_zul(P, g)
        F02 = CLASSES[P["cls"]]["Rp"] * g["AS"]
        FSm = Fz + lf["Phi_n"] * (P["FA_max"] + P["FA_min"]) / 2
        sAS = (2 - FSm / F02) * sASV
    else:
        sAS = sASV
    return {"sigma_a": sa, "sigma_AS": sAS, "S_D": sAS / sa if sa > 0 else float("inf")}

def surface_pressure(P, g=None):
    g = g or thread_geometry(P)
    Ap = math.pi / 4 * (g["dw"] ** 2 - g["dh"] ** 2)
    Fz = FM_zul(P, g)
    FSmax = working_stress(P, g)["FSmax"]
    pG = min(PART_MATERIALS[P["part_material"]]["pG"], PART_MATERIALS[P["nut_side_material"]]["pG"])
    pM, pB = Fz / Ap, FSmax / Ap
    return {"Ap": Ap, "p_assembly": pM, "p_working": pB, "pG": pG, "S_p": pG / pB}

def slip(P, g=None):
    g = g or thread_geometry(P)
    lf = load_factor(P, g)
    ez = embedding(P, g)
    t = tightening(P, g)
    FKRmin = t["FMzul"] / t["alpha_A"] - (1 - lf["Phi_n"]) * P["FA_max"] - ez["FZ"]
    S = FKRmin * P["qF"] * P["muT"] / P["FQ"] if P["FQ"] > 0 else float("inf")
    return {"FKRmin": FKRmin, "S_G": S, "opens": FKRmin <= 0}

def summary(P):
    g = thread_geometry(P)
    out = {"g": g, "bolt": bolt_compliance(P, g), "plate": plate_compliance(P, g), "lf": load_factor(P, g),
           "emb": embedding(P, g), "req": required_clamp(P), "tight": tightening(P, g), "pre": preload_check(P, g),
           "ws": working_stress(P, g), "fat": fatigue(P, g), "sp": surface_pressure(P, g), "slip": slip(P, g)}
    out["ok"] = {"preload": out["pre"]["ok"], "yield": out["ws"]["S_F"] >= P["S_F_req"], "fatigue": out["fat"]["S_D"] >= P["S_D_req"],
                 "pressure": out["sp"]["S_p"] >= P["S_p_req"], "slip": out["slip"]["S_G"] >= P["S_slip_req"]}
    return out

def select_size(P):
    """Smallest thread of the table and lowest class that pass all checks."""
    for th in THREADS:
        for cl in ("8.8", "10.9", "12.9"):
            Q = dict(P, thread=th, cls=cl)
            if Q["DA"] <= THREADS[th]["dh"] + 1:
                continue
            if all(summary(Q)["ok"].values()):
                return th, cl
    return None

# ---------------------------------------------------------------- report / run
def report_text(P):
    S = summary(P)
    g, b, pl, lf, ez, rq, t, pr, ws, ft, sp, sl = (S[k] for k in ("g", "bolt", "plate", "lf", "emb", "req", "tight", "pre", "ws", "fat", "sp", "slip"))
    fl = lambda x: "OK" if x else "NOT OK"
    L = ["# Bolted joint report (VDI 2230 style, simplified) - %s\n" % P["name"],
         "%s %s, %s, clamp length %.1f mm (shank %.1f, free thread %.1f), DA %.1f mm, parts %s / %s, %s" % (
             P["thread"], P["cls"], P["joint"], P["lK"], P["ls"], b["lGew"], P["DA"], P["part_material"], P["nut_side_material"], P["tightening"]),
         "\n## R0 thread geometry",
         "- d %.1f, P %.2f, d2 %.3f, d3 %.3f, A_S %.2f mm2, A_d3 %.2f mm2; head bearing dw %.1f, hole dh %.1f mm" % (
             g["d"], g["P"], g["d2"], g["d3"], g["AS"], g["Ad3"], g["dw"], g["dh"]),
         "\n## R3 compliances and load factor",
         "- bolt: head %.3g, shank %.3g, free thread %.3g, engaged thread %.3g, nut / tapped hole %.3g -> delta_S %.4g mm/N (c_S %.0f N/mm)" % (
             b["dSK"], b["d1"], b["dGew"], b["dG"], b["dM"], b["deltaS"], lf["cS"]),
         "- plates: tan(phi) %.4f (phi %.2f deg), D_A,Gr %.2f mm -> %s model, delta_P %.4g mm/N (c_P %.0f N/mm)" % (
             pl["tan_phi"], pl["phi_deg"], pl["DA_Gr"], pl["model"], pl["deltaP"], lf["cP"]),
         "- load factor Phi_K %.4f, n %.2f -> Phi_n %.4f" % (lf["Phi_K"], P["n"], lf["Phi_n"]),
         "\n## R2 / R4 / R5 clamp load, embedding, required preload",
         "- required clamp load: slip %.0f N, sealing %.0f N -> F_Kerf %.0f N" % (rq["FKQ"], rq["FKP"], rq["FKerf"]),
         "- embedding f_Z %.1f um -> F_Z %.0f N" % (ez["fZ_um"], ez["FZ"]),
         "- F_Mmin = F_Kerf + (1 - Phi_n) F_Amax + F_Z = %.0f N; F_Mmax = alpha_A %.2f x F_Mmin = %.0f N" % (pr["FMmin_req"], t["alpha_A"], pr["FMmax_req"]),
         "\n## R7 / R13 assembly preload and tightening torque",
         "- F_Mzul (nu %.2f, mu_G %.2f) %.0f N -> utilisation F_Mmax / F_Mzul %.3f %s" % (P["nu"], P["muG_min"], t["FMzul"], pr["utilisation"], fl(pr["ok"])),
         "- tightening torque M_A %.1f N m (mu_G %.2f, mu_K %.2f); at high friction (%.2f / %.2f) the same torque gives %.0f N (scatter %.2f)" % (
             t["MA"], P["muG_min"], P["muK_min"], P["muG_max"], P["muK_max"], t["FM_high_mu"], t["friction_scatter"]),
         "\n## R8 - R12 stresses and safeties",
         "- working: F_SA %.0f N, F_Smax %.0f N, sigma_z %.0f MPa, tau %.0f MPa, sigma_red %.0f MPa (k_tau 0.5) -> S_F %.2f %s" % (
             ws["FSA"], ws["FSmax"], ws["sigma_z"], ws["tau"], ws["sigma_red"], ws["S_F"], fl(S["ok"]["yield"])),
         "- fatigue: sigma_a %.1f MPa, sigma_AS %.1f MPa (rolled %s heat treatment) -> S_D %.2f %s" % (
             ft["sigma_a"], ft["sigma_AS"], P["rolled"], ft["S_D"], fl(S["ok"]["fatigue"])),
         "- surface pressure: A_p %.1f mm2, assembly %.0f MPa, working %.0f MPa, p_G %.0f MPa -> S_p %.2f %s" % (
             sp["Ap"], sp["p_assembly"], sp["p_working"], sp["pG"], sp["S_p"], fl(S["ok"]["pressure"])),
         "- slip: F_KRmin %.0f N -> S_G %.2f (required %.1f) %s" % (sl["FKRmin"], sl["S_G"], P["S_slip_req"], fl(S["ok"]["slip"]))]
    sel = select_size(P)
    L.append("\n## Size selection\n- smallest thread / class of the table that passes all checks: %s" % ("%s %s" % sel if sel else "none"))
    return "\n".join(L)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    S = summary(P)
    with open(os.path.join(out, "assembly.csv"), "w", encoding="utf-8") as f:
        f.write("item,value\n")
        f.write("thread,%s %s\ntightening torque N m,%.1f\npermissible preload N,%.0f\nminimum preload required N,%.0f\nmethod,%s\n" % (
            P["thread"], P["cls"], S["tight"]["MA"], S["tight"]["FMzul"], S["pre"]["FMmin_req"], P["tightening"]))
    print(rep)
    print("written: report.md, assembly.csv ->", out)


# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2: joints, threads, classes, nuts
JOINT_TYPES = [
    ("DSV through-bolt with nut", "bolt + nut clamp the parts; both sides accessible", "flanges, frames, machine bases", "cone from both sides (w = 1)"),
    ("ESV tapped-thread joint", "bolt screwed into a threaded part", "housings, covers, cylinder heads", "cone from the head side only (w = 2)"),
    ("Stud bolt", "stud screwed in, nut on the free end", "frequently opened covers in cast iron / aluminium", "like ESV; thread in the housing protected"),
    ("Eccentric joint", "bolt axis not on the load / clamping axis", "brackets, bearing caps, conrods", "bending of the bolt, opening at one edge (VDI 2230 eccentric model)"),
    ("Multi-bolt flange", "several bolts share load and moment", "pipe flanges, slewing rings, gear rims", "most loaded bolt from the bolt pattern, then single-bolt check"),
]

def iso68_profile(P=None):
    """ISO 68-1 basic profile: H = (sqrt(3)/2) P; d2 = d - 3/4 H x ... = d - 0.6495 P; d3 = d - 1.2269 P (rounded root);
    D1 = d - 1.0825 P (nut minor diameter)."""
    P = P or DEFAULT
    t = THREADS[P["thread"]]
    d, p = t["d"], t["P"]
    H = math.sqrt(3) / 2 * p
    return {"H": H, "d2": d - 0.75 * H, "D1": d - 1.25 * H, "d3": d - 2 * (17.0 / 24.0) * H,
            "d2_factor": 0.75 * H / p, "d3_factor": 2 * 17.0 / 24.0 * H / p}

FINE_THREADS = {"M12x1.25": (12.0, 1.25), "M12x1.5": (12.0, 1.5), "M16x1.5": (16.0, 1.5), "M20x1.5": (20.0, 1.5)}

def _thread_override(d, p, base="M12"):
    """Temporary thread entry with the head data of the coarse thread of the same diameter."""
    key = "M%d" % int(d)
    h = THREADS[key]
    return dict(h, d=d, P=p)

def fine_vs_coarse(mu=0.12):
    rows = []
    for name, (d, p) in [("M12", (12.0, 1.75)), ("M12x1.5", FINE_THREADS["M12x1.5"]), ("M12x1.25", FINE_THREADS["M12x1.25"]),
                         ("M16", (16.0, 2.0)), ("M16x1.5", FINE_THREADS["M16x1.5"])]:
        THREADS["_tmp"] = _thread_override(d, p)
        Q = dict(DEFAULT, thread="_tmp", muG_min=mu, muK_min=mu)
        g = thread_geometry(Q)
        t = tightening(Q)
        lead = math.degrees(math.atan(p / (math.pi * g["d2"])))
        rho = math.degrees(math.atan(1.155 * mu))
        # loosening torque in the thread (positive = self-locking): M_L = F d2/2 tan(rho' - phi)
        ML = t["FMzul"] * g["d2"] / 2 * math.tan(math.radians(rho - lead)) / 1000.0
        rows.append({"thread": name, "AS": g["AS"], "FMzul": t["FMzul"], "MA": t["MA"], "lead_deg": lead, "rho_deg": rho,
                     "M_loosen": ML})
    THREADS.pop("_tmp", None)
    return rows

PROPERTY_CLASS_INFO = {   # ISO 898-1 (check): hardness HV, typical steel, remarks
    "8.8":  {"HV": "250-320", "steel": "C35 / C45, B-alloyed steels, quenched + tempered", "note": "general machine building"},
    "10.9": {"HV": "320-380", "steel": "boron or low-alloy steel (e.g. 34CrMo4), Q+T", "note": "high preload; electroplating needs baking"},
    "12.9": {"HV": "385-435", "steel": "alloy steel (e.g. 42CrMo4, 34CrNiMo6), Q+T", "note": "hydrogen embrittlement risk: no electroplating, use zinc flake; sensitive to notches"},
}

def class_meaning():
    out = []
    for c, v in CLASSES.items():
        a, b = c.split(".")
        out.append({"cls": c, "Rm_nominal": int(a) * 100, "ratio": int(b) / 10.0, "Rp_nominal": int(a) * 100 * int(b) / 10.0,
                    "Rp_used": v["Rp"], "Rm_used": v["Rm"]})
    return out

NUT_MATCH = {"8.8": "nut class 8 (ISO 898-2), height m ~ 0.8 d", "10.9": "nut class 10", "12.9": "nut class 12"}

TAPPED_MATERIALS = {   # Rm (MPa) and shear strength ratio tau_B / Rm (check, VDI 2230 table style)
    "steel C45 (QT)": (700.0, 0.6),
    "steel S235": (360.0, 0.65),
    "EN-GJL-250 (grey iron)": (250.0, 1.0),
    "EN-GJS-400 (ductile iron)": (400.0, 0.9),
    "AlMgSi1 F31": (310.0, 0.6),
    "AlSi9Cu3 (die cast)": (240.0, 0.6),
}

def engagement_length(P=None, mat="AlMgSi1 F31", C3=0.85, k_shear=0.75):
    """Simplified minimum engagement length of a tapped hole: the internal thread must not strip before the bolt breaks.
    Bolt break force Rm A_S = tau_B (pi d k_shear) C3 m_eff  ->  m_eff = Rm A_S / (tau_B pi d k_shear C3), plus 2P for
    the countersink / first threads (simplified VDI 2230 section 5.5.5 idea, check)."""
    P = P or DEFAULT
    g = thread_geometry(P)
    Rm_b = CLASSES[P["cls"]]["Rm"]
    Rm, r = TAPPED_MATERIALS[mat]
    tau = r * Rm
    per_mm = tau * math.pi * g["d"] * k_shear * C3
    m = Rm_b * g["AS"] / per_mm
    return {"F_bolt_break": Rm_b * g["AS"], "tau_B": tau, "strip_per_mm": per_mm, "m_eff": m, "m_total": m + 2 * g["P"],
            "ratio_d": (m + 2 * g["P"]) / g["d"]}

# ---------------------------------------------------------------- chapter 3: joint diagram and compliance studies
def joint_diagram(P=None, FM=None):
    """Corner points of the joint diagram (force vs elongation): bolt line through (0,0)-(f_SM, F_M), plate line from
    (f_SM, F_M) down to (f_SM + f_PM, 0). Working load F_A (concentric, n) gives F_SA, F_PA, F_KR."""
    P = P or DEFAULT
    g = thread_geometry(P)
    dS = bolt_compliance(P, g)["deltaS"]
    dP = plate_compliance(P, g)["deltaP"]
    lf = load_factor(P, g)
    FM = FM or FM_zul(P, g) / TIGHTENING[P["tightening"]]
    FA = P["FA_max"]
    fSM, fPM = FM * dS, FM * dP
    FSA = lf["Phi_n"] * FA
    FPA = (1 - lf["Phi_n"]) * FA
    return {"FM": FM, "f_SM_um": fSM * 1000, "f_PM_um": fPM * 1000, "FA": FA, "FSA": FSA, "FPA": FPA,
            "FS": FM + FSA, "FKR": FM - FPA, "f_extra_um": FSA * dS * 1000,
            "bolt_line": [(0.0, 0.0), (fSM * 1000, FM)], "plate_line": [(fSM * 1000, FM), ((fSM + fPM) * 1000, 0.0)]}

def waisted_bolt_study(P=None, ratios=(None, 1.0, 0.9, 0.8)):
    """Replace the shank (d) by a waist d_T = ratio x d3 over the shank length: more elastic bolt -> smaller Phi and
    smaller alternating stress; the waist limits F_Mzul (tension + plastic torsion in the waist)."""
    P = P or DEFAULT
    g = thread_geometry(P)
    rows = []
    for r in ratios:
        dT = g["d"] if r is None else r * g["d3"]
        AT = math.pi / 4 * dT ** 2
        b = bolt_compliance(P, g)
        dS = b["deltaS"] - b["d1"] + P["ls"] / (205000.0 * AT)
        dP = plate_compliance(P, g)["deltaP"]
        Phi_n = P["n"] * dP / (dS + dP)
        sa = Phi_n * (P["FA_max"] - P["FA_min"]) / (2 * g["AS"])
        k = 1.5 * g["d2"] / dT * (g["P"] / (math.pi * g["d2"]) + 1.155 * P["muG_min"])
        Fz_waist = P["nu"] * CLASSES[P["cls"]]["Rp"] * AT / math.sqrt(1 + 3 * k ** 2)
        Fz = min(FM_zul(P, g), Fz_waist)
        rows.append({"dT": dT, "label": "full shank d" if r is None else "waist %.2f d3" % r, "deltaS": dS, "Phi_n": Phi_n,
                     "sigma_a": sa, "S_D": fatigue(P, g)["sigma_AS"] / sa, "FMzul": Fz})
    return rows

def plate_study(P=None, DAs=(20.0, 28.0, 36.0, 50.0, 80.0), lKs=(20.0, 40.0, 60.0)):
    P = P or DEFAULT
    out = []
    for lK in lKs:
        for DA in DAs:
            Q = dict(P, lK=lK, DA=DA, ls=max(lK - 15.0, 0.0))
            pl = plate_compliance(Q)
            lf = load_factor(Q)
            out.append({"lK": lK, "DA": DA, "model": pl["model"], "DA_Gr": pl["DA_Gr"], "deltaP": pl["deltaP"], "Phi_K": lf["Phi_K"]})
    return out

N_GUIDE = [   # rough guide values of the load introduction factor (check VDI 2230 Part 1 2015, table 4 / figure 23)
    ("SV1", "load introduced close under the head and nut (thick flanges, load at the bolt-near edge)", 0.7),
    ("SV2", "load introduced in the upper third of the plates", 0.5),
    ("SV3", "load introduced in the middle of the plates", 0.4),
    ("SV4", "load introduced near the interface", 0.3),
    ("SV5", "load introduced at the interface, plates loaded far from the bolt", 0.15),
    ("SV6", "load introduced at the interface, thin plates", 0.1),
]

def n_study(P=None):
    P = P or DEFAULT
    out = []
    for name, txt, n in N_GUIDE:
        Q = dict(P, n=n)
        lf = load_factor(Q)
        S = summary(Q)
        out.append({"SV": name, "n": n, "Phi_n": lf["Phi_n"], "FSA": S["ws"]["FSA"], "FKRmin": S["slip"]["FKRmin"],
                    "sigma_a": S["fat"]["sigma_a"]})
    return out

def opening_load(P=None):
    """Concentric opening (separation) load: F_KR = F_V - (1 - Phi_n) F_A = 0  ->  F_Aab = F_V / (1 - Phi_n),
    with F_V = F_M - F_Z the preload after embedding (minimum: F_Mzul/alpha_A - F_Z, maximum: F_Mzul - F_Z)."""
    P = P or DEFAULT
    g = thread_geometry(P)
    lf = load_factor(P, g)
    FZ = embedding(P, g)["FZ"]
    t = tightening(P, g)
    FVmin, FVmax = t["FMzul"] / t["alpha_A"] - FZ, t["FMzul"] - FZ
    return {"FVmin": FVmin, "FVmax": FVmax, "FAab_min": FVmin / (1 - lf["Phi_n"]), "FAab_max": FVmax / (1 - lf["Phi_n"])}

# ---------------------------------------------------------------- chapter 4: torque, friction, embedding
def thread_torque_exact(P=None, F=10000.0, mu=0.12):
    """Inclined plane: M_G = F (d2/2) tan(phi + rho'), phi = atan(P/(pi d2)), rho' = atan(mu / cos 30 deg)."""
    P = P or DEFAULT
    g = thread_geometry(P)
    phi = math.atan(g["P"] / (math.pi * g["d2"]))
    rho = math.atan(mu / math.cos(math.radians(30)))
    exact = F * g["d2"] / 2 * math.tan(phi + rho)
    simple = F * (0.16 * g["P"] + 0.58 * g["d2"] * mu)
    return {"phi_deg": math.degrees(phi), "rho_deg": math.degrees(rho), "MG_exact": exact / 1000, "MG_simple": simple / 1000,
            "error_pct": 100 * (simple / exact - 1)}

def torque_split(P=None, mus=(0.08, 0.10, 0.12, 0.14, 0.16)):
    P = P or DEFAULT
    g = thread_geometry(P)
    DKm = 0.5 * (g["dw"] + g["dh"])
    out = []
    for mu in mus:
        a, b, c = 0.16 * g["P"], 0.58 * g["d2"] * mu, 0.5 * DKm * mu
        tot = a + b + c
        out.append({"mu": mu, "pitch_pct": 100 * a / tot, "thread_pct": 100 * b / tot, "head_pct": 100 * c / tot, "k_mm": tot})
    return out

def friction_band(P=None, tool_scatter=0.05):
    """Preload spread at one tightening torque: friction scatter muG/muK min..max and torque-tool scatter +-x ->
    estimated alpha_A = F_M,max / F_M,min."""
    P = P or DEFAULT
    g = thread_geometry(P)
    MA = tightening(P, g)["MA"] * 1000
    FMmax = MA * (1 + tool_scatter) / torque_coeff(P, g, P["muG_min"], P["muK_min"])
    FMmin = MA * (1 - tool_scatter) / torque_coeff(P, g, P["muG_max"], P["muK_max"])
    return {"MA": MA / 1000, "FMmax": FMmax, "FMmin": FMmin, "alpha_A_est": FMmax / FMmin}

def embedding_study(P=None):
    P = P or DEFAULT
    out = []
    for rz in FZ_TABLE:
        for nif in (0, 1, 3):
            Q = dict(P, Rz=rz, n_interfaces=nif)
            e = embedding(Q)
            FMz = FM_zul(Q)
            out.append({"Rz": rz, "interfaces": nif, "fZ": e["fZ_um"], "FZ": e["FZ"], "pct_of_FMmin": 100 * e["FZ"] / (FMz / TIGHTENING[Q["tightening"]])})
    return out

def lK_embedding(P=None, lKs=(15.0, 25.0, 40.0, 80.0)):
    """Short clamp lengths lose more preload by the same embedding (stiffer joint)."""
    P = P or DEFAULT
    return [{"lK": lK, "FZ": embedding(dict(P, lK=lK, ls=max(lK - 15.0, 0.0)))["FZ"]} for lK in lKs]

def demo_ch24():
    P = dict(DEFAULT)
    print("## 2.1 Joint types")
    for j in JOINT_TYPES:
        print("  %-28s | %-46s | %-46s | %s" % j)
    print("\n## 2.2 ISO 68-1 basic profile (%s)" % P["thread"])
    pr = iso68_profile(P)
    print("  H %.4f mm; d2 = d - %.4f P = %.3f; d3 = d - %.4f P = %.3f; D1 = %.3f mm" % (
        pr["H"], pr["d2_factor"], pr["d2"], pr["d3_factor"], pr["d3"], pr["D1"]))
    print("\n## 2.3 Fine vs coarse thread (mu_G = mu_K = 0.12, nu 0.9, class %s)" % P["cls"])
    for r in fine_vs_coarse():
        print("  %-9s A_S %6.2f mm2, F_Mzul %5.1f kN, M_A %6.1f N m, lead %.2f deg vs rho' %.2f deg, loosening torque %5.1f N m" % (
            r["thread"], r["AS"], r["FMzul"] / 1000, r["MA"], r["lead_deg"], r["rho_deg"], r["M_loosen"]))
    print("\n## 2.4 Property classes (ISO 898-1)")
    for c in class_meaning():
        i = PROPERTY_CLASS_INFO[c["cls"]]
        print("  %-5s Rm %4d (used %4.0f), Rp/Rm %.1f -> Rp %4.0f (used %4.0f) MPa; HV %s; %s; %s; nut: %s" % (
            c["cls"], c["Rm_nominal"], c["Rm_used"], c["ratio"], c["Rp_nominal"], c["Rp_used"], i["HV"], i["steel"], i["note"], NUT_MATCH[c["cls"]]))
    print("\n## 2.5 Minimum engagement length in a tapped hole (%s %s, simplified, check)" % (P["thread"], P["cls"]))
    for m in TAPPED_MATERIALS:
        e = engagement_length(P, m)
        print("  %-26s tau_B %5.0f MPa, %6.0f N/mm -> m_eff %5.1f + 2P = %5.1f mm = %.2f d" % (
            m, e["tau_B"], e["strip_per_mm"], e["m_eff"], e["m_total"], e["ratio_d"]))
    e88 = engagement_length(dict(P, cls="8.8"), "AlMgSi1 F31")
    print("  (8.8 bolt in AlMgSi1: %.2f d)" % e88["ratio_d"])
    print("\n## 3.1 Joint diagram (F_M = F_Mzul / alpha_A)")
    jd = joint_diagram(P)
    print("  F_M %.0f N: bolt elongation %.2f um, plate compression %.2f um" % (jd["FM"], jd["f_SM_um"], jd["f_PM_um"]))
    print("  F_A %.0f N -> F_SA %.0f N, F_PA %.0f N; bolt force %.0f N, residual clamp load %.0f N; extra elongation %.3f um" % (
        jd["FA"], jd["FSA"], jd["FPA"], jd["FS"], jd["FKR"], jd["f_extra_um"]))
    print("  bolt line %s, plate line %s" % (jd["bolt_line"], jd["plate_line"]))
    print("\n## 3.2 Waisted bolt study")
    for r in waisted_bolt_study(P):
        print("  %-14s d_T %6.3f mm: delta_S %.4g mm/N, Phi_n %.4f, sigma_a %.2f MPa, S_D %.2f, F_Mzul %5.1f kN" % (
            r["label"], r["dT"], r["deltaS"], r["Phi_n"], r["sigma_a"], r["S_D"], r["FMzul"] / 1000))
    print("\n## 3.3 Plate compliance vs D_A and l_K")
    for r in plate_study(P):
        print("  l_K %4.0f, D_A %4.0f (D_A,Gr %5.1f): %-13s delta_P %.4g mm/N, Phi_K %.4f" % (
            r["lK"], r["DA"], r["DA_Gr"], r["model"], r["deltaP"], r["Phi_K"]))
    print("\n## 3.4 Load introduction factor n (rough guide, check)")
    for r in n_study(P):
        print("  %s n %.2f: Phi_n %.4f, F_SA %5.0f N, F_KRmin %6.0f N, sigma_a %.2f MPa" % (
            r["SV"], r["n"], r["Phi_n"], r["FSA"], r["FKRmin"], r["sigma_a"]))
    ol = opening_load(P)
    print("\n## 3.5 Opening load: F_V %.0f .. %.0f N -> F_Aab %.0f .. %.0f N (F_Amax %.0f N)" % (
        ol["FVmin"], ol["FVmax"], ol["FAab_min"], ol["FAab_max"], P["FA_max"]))
    print("\n## 4.1 Thread torque: exact inclined plane vs simplified formula (F = 10 kN)")
    for mu in (0.08, 0.12, 0.16):
        t = thread_torque_exact(P, 10000.0, mu)
        print("  mu %.2f: phi %.3f deg, rho' %.3f deg, M_G exact %.3f N m, simplified %.3f N m (%+.2f %%)" % (
            mu, t["phi_deg"], t["rho_deg"], t["MG_exact"], t["MG_simple"], t["error_pct"]))
    print("\n## 4.2 Where the tightening torque goes")
    for r in torque_split(P):
        print("  mu %.2f: pitch %4.1f %%, thread friction %4.1f %%, head friction %4.1f %% (k = %.3f mm)" % (
            r["mu"], r["pitch_pct"], r["thread_pct"], r["head_pct"], r["k_mm"]))
    fb = friction_band(P)
    print("\n## 4.3 Preload band at M_A %.1f N m: %.0f .. %.0f N -> alpha_A estimate %.2f (friction + 5 %% tool)" % (
        fb["MA"], fb["FMmin"], fb["FMmax"], fb["alpha_A_est"]))
    print("\n## 4.4 Embedding (VDI table style, check)")
    for r in embedding_study(P):
        print("  Rz %-6s interfaces %d: f_Z %4.1f um, F_Z %5.0f N = %4.1f %% of F_Mzul/alpha_A" % (
            r["Rz"], r["interfaces"], r["fZ"], r["FZ"], r["pct_of_FMmin"]))
    for r in lK_embedding(P):
        print("  l_K %4.0f mm: F_Z %5.0f N" % (r["lK"], r["FZ"]))

# ================================================================ added with guide chapters (ch56)
# ---------------------------------------------------------------- 5.1 working stress
def ktau_study(P, kts=(0.0, 0.5, 1.0)):
    """Reduced working stress for different residual-torsion factors k_tau (0 = torsion fully relaxed, 1 = none relaxed)."""
    g = thread_geometry(P)
    ws = working_stress(P, g)
    Rp = CLASSES[P["cls"]]["Rp"]
    out = []
    for k in kts:
        sred = math.sqrt(ws["sigma_z"] ** 2 + 3 * (k * ws["tau"]) ** 2)
        out.append({"k_tau": k, "sigma_red": sred, "S_F": Rp / sred})
    return out


def yield_controlled(P):
    """Yield / angle-controlled tightening: preload ~ F_Mzul at nu = 1.0, scatter alpha_A = 1 (only the yield point scatter)."""
    g = thread_geometry(P)
    F_nu1 = FM_zul(dict(P, nu=1.0), g)
    Rp = CLASSES[P["cls"]]["Rp"]
    Rp_max = 1.15 * Rp                                    # upper yield scatter of a class (example, check)
    return {"FM_nu09": FM_zul(P, g), "FM_nu1": F_nu1, "FM_max_yield_scatter": F_nu1 * Rp_max / Rp,
            "slip_S_G": slip(dict(P, tightening="angle-controlled (yield range)"), g)["S_G"]}

# ---------------------------------------------------------------- 5.2 fatigue
def fatigue_finite(P, Ns=(1e4, 1e5, 5e5, 2e6)):
    """Finite-life amplitude: sigma_AZSV = sigma_ASV (N_D / N)^(1/3), N_D = 2e6, valid ~1e4 < N < 2e6 (check VDI 2230)."""
    f = fatigue(P)
    out = []
    for N in Ns:
        s = f["sigma_AS"] * (2e6 / N) ** (1 / 3.0)
        out.append({"N": N, "sigma_AZ": s, "S_D": s / f["sigma_a"] if f["sigma_a"] > 0 else float("inf")})
    return out


def haigh_after_HT(P, ratios=(0.2, 0.4, 0.6, 0.8, 1.0)):
    """Rolled AFTER heat treatment: sigma_ASG = (2 - F_Sm/F_0.2min) sigma_ASV (mean-stress dependent)."""
    g = thread_geometry(P)
    sASV = 0.85 * (150.0 / g["d"] + 45.0)
    return [{"FSm_F02": r, "sigma_ASG": (2 - r) * sASV, "gain": 2 - r} for r in ratios]


def _waisted_deltaS(P, g, dT):
    """Bolt compliance with a waisted shank of diameter dT over the shank length ls."""
    b = bolt_compliance(P, g)
    ES = 205000.0
    return b["deltaS"] - b["d1"] + P["ls"] / (ES * math.pi / 4 * dT ** 2)


def fatigue_measures(P, FA_max=None):
    """Effect of the classic fatigue measures on Phi_n, sigma_a and S_D (FA dynamic 0..FA_max)."""
    FA = FA_max or P["FA_max"]
    Q = dict(P, FA_max=FA, FA_min=0.0)
    g = thread_geometry(Q)
    rows = []

    def row(name, Phi_n, sAS):
        sa = Phi_n * FA / (2 * g["AS"])
        rows.append({"measure": name, "Phi_n": Phi_n, "sigma_a": sa, "sigma_AS": sAS, "S_D": sAS / sa})
    base = load_factor(Q, g)
    row("default (shank d, lK 40)", base["Phi_n"], fatigue(Q, g)["sigma_AS"])
    dT = 0.9 * g["d3"]
    dS_w = _waisted_deltaS(Q, g, dT)
    dP = plate_compliance(Q, g)["deltaP"]
    row("waisted shank dT = 0.9 d3", Q["n"] * dP / (dS_w + dP), fatigue(Q, g)["sigma_AS"])
    L = dict(Q, lK=60.0, ls=45.0)
    gL = thread_geometry(L)
    row("longer clamp lK 60 (sleeve)", load_factor(L, gL)["Phi_n"], fatigue(L, gL)["sigma_AS"])
    A = dict(Q, rolled="after")
    row("thread rolled after heat treatment", base["Phi_n"], fatigue(A, g)["sigma_AS"])
    row("load introduced near interface n = 0.3", 0.3 * base["Phi_K"], fatigue(Q, g)["sigma_AS"])
    return rows

# ---------------------------------------------------------------- 5.3 eccentric loading and opening (beam model)
def eccentric_opening(P, s_sym=8.0, a=20.0, b_int=40.0, c_int=36.0):
    """Simplified beam model of the interface (rectangular b_int x c_int, bolt at s_sym from its centroid axis, load at a).
    Edge pressure = F_K/A_D - M u / I with M = F_A a - F_K s_sym, u = c/2 (edge on the load side).
    Opening limit F_Aab from edge pressure = 0. Phi_en ~ Phi_n (1 + a s_sym A_D / I) (trend form, check VDI 2230 R8-R9)."""
    g = thread_geometry(P)
    lf = load_factor(P, g)
    t = tightening(P, g)
    ez = embedding(P, g)
    AD = b_int * c_int - math.pi / 4 * g["dh"] ** 2
    I = b_int * c_int ** 3 / 12.0
    u = c_int / 2
    FV = t["FMzul"] / t["alpha_A"] - ez["FZ"]
    k1 = 1 / AD + s_sym * u / I
    Phi_en = lf["Phi_n"] * (1 + a * s_sym * AD / I)
    FAab = FV * k1 / (a * u / I + (1 - Phi_en) * k1)
    return {"AD": AD, "I": I, "FV_min": FV, "Phi_n": lf["Phi_n"], "Phi_en": Phi_en, "FA_ab": FAab,
            "FA_ab_centric": FV / (1 - lf["Phi_n"])}


def eccentric_trend(P, avals=(0.0, 10.0, 20.0, 30.0)):
    return [dict(eccentric_opening(P, a=a), a=a) for a in avals]

# ---------------------------------------------------------------- 6.1 surface pressure and washers
PG_TABLE = {   # limiting surface pressure p_G MPa (VDI 2230 table A9 style, typical, check)
    "S235JR": 490, "E295": 710, "C45 normalised": 630, "34CrNiMo6 QT": 1080, "38MnB5 QT": 1100,
    "EN-GJL-250": 850, "EN-GJS-400": 600, "EN-GJS-600": 900, "AlMgSi1 F31": 360, "AlZnMgCu1.5": 370,
    "GD-AlSi9Cu3": 220, "GD-MgAl9Zn1": 140, "hardened washer 300 HV": 1100,
}


def with_washer(P, D_washer=24.0, h_washer=2.5):
    """Hardened washer (ISO 7089 300 HV): the plate sees D_washer instead of dw; one more interface for embedding.
    Load spread through the washer ignored (conservative); the plate compliance uses dw = D_washer (check)."""
    key = P["thread"] + "+washer"
    t0 = THREADS[P["thread"]]
    THREADS[key] = dict(t0, dw=D_washer)
    try:
        Q = dict(P, thread=key, n_interfaces=P["n_interfaces"] + 1, lK=P["lK"] + h_washer)
        S = summary(Q)
    finally:
        del THREADS[key]
    return S


def pressure_options(P):
    g = thread_geometry(P)
    rows = []
    sp = surface_pressure(P, g)
    rows.append(("hex head on C45 (default)", sp["Ap"], sp["p_working"], sp["pG"], sp["S_p"]))
    S = with_washer(P)
    rows.append(("hardened washer D 24 mm", S["sp"]["Ap"], S["sp"]["p_working"], S["sp"]["pG"], S["sp"]["S_p"]))
    Q = dict(P, part_material="42CrMo4 (QT)", nut_side_material="42CrMo4 (QT)")
    sq = surface_pressure(Q, g)
    rows.append(("parts 42CrMo4 QT", sq["Ap"], sq["p_working"], sq["pG"], sq["S_p"]))
    key = P["thread"] + "+flange"
    THREADS[key] = dict(THREADS[P["thread"]], dw=1.55 * THREADS[P["thread"]]["d"] + 2.0)   # flange head ~ (ISO 4162 style, check)
    try:
        sf = surface_pressure(dict(P, thread=key))
    finally:
        del THREADS[key]
    rows.append(("flange bolt (dw ~ 20.6 mm)", sf["Ap"], sf["p_working"], sf["pG"], sf["S_p"]))
    return rows

# ---------------------------------------------------------------- 6.2 embedding and creep
def embedding_table(P):
    out = []
    for rz in FZ_TABLE:
        for ni in (0, 1, 2, 3):
            e = embedding(dict(P, Rz=rz, n_interfaces=ni))
            out.append({"Rz": rz, "interfaces": ni, "fZ": e["fZ_um"], "FZ": e["FZ"],
                        "share": e["FZ"] / tightening(P)["FMzul"]})
    return out

# ---------------------------------------------------------------- 6.3 temperature
ALPHA = {"steel": 11.5e-6, "stainless A2": 16.0e-6, "aluminium": 23.0e-6, "grey cast iron": 10.5e-6, "magnesium": 26.0e-6}


def thermal_preload(P, dT=80.0, part="aluminium", part_material="AlMgSi1 F31", bolt="steel"):
    """Thermal preload change: dF_Vth = (alpha_P - alpha_S) dT lK / (delta_S + delta_P) (>0: preload rises).
    E(T) and creep ignored (check VDI 2230 R4 temperature terms)."""
    Q = dict(P, part_material=part_material, nut_side_material=part_material)
    g = thread_geometry(Q)
    dS = bolt_compliance(Q, g)["deltaS"]
    dP = plate_compliance(Q, g)["deltaP"]
    dF = (ALPHA[part] - ALPHA[bolt]) * dT * P["lK"] / (dS + dP)
    return {"dT": dT, "deltaS": dS, "deltaP": dP, "dF_Vth": dF, "FMzul": FM_zul(Q, g)}

# ---------------------------------------------------------------- 6.4 slip
MU_T = {   # interface friction for slip (dry, typical; check VDI 2230 table A6 / EN 1090-2)
    "steel, machined, degreased": 0.15, "steel, machined, oiled": 0.10, "steel, shot-blasted": 0.40,
    "steel, blasted + zinc silicate": 0.35, "steel, primed / painted": 0.15, "cast iron / steel dry": 0.18,
    "aluminium / steel dry": 0.20, "with friction shim (diamond coated)": 0.50,
}


def slip_study(P):
    g = thread_geometry(P)
    rows = []
    for name, mu in MU_T.items():
        sl = slip(dict(P, muT=mu), g)
        rows.append({"surface": name, "muT": mu, "S_G": sl["S_G"], "static_ok": sl["S_G"] >= 1.2, "dynamic_ok": sl["S_G"] >= 1.8})
    return rows


def bolt_shear_if_slip(P, fit=False):
    """If the joint slips, the shank takes F_Q in shear: tau = F_Q / A (A = shank area d, or fitted bolt d + 1 mm).
    Shear strength ~ 0.6 Rm (check); bearing on the hole wall sigma_L = F_Q / (d lK_min)."""
    g = thread_geometry(P)
    d = g["d"] + (1.0 if fit else 0.0)
    A = math.pi / 4 * d ** 2
    tau = P["FQ"] / A
    tauB = 0.6 * CLASSES[P["cls"]]["Rm"]
    return {"A": A, "tau": tau, "tau_B": tauB, "S": tauB / tau, "bearing": P["FQ"] / (d * P["lK"] / 2)}

# ---------------------------------------------------------------- 6.5 multi-bolt joints
def flange_bolt_loads(n=8, Dt=150.0, M_tilt=0.0, F_axial=0.0, T_torsion=0.0, F_trans=0.0):
    """Bolt circle: axial load per bolt F_A,i = F/n + M y_i / sum(y^2) (rigid flange, check), sum(y^2) = n Dt^2/8;
    transverse per bolt from torque and transverse force F_Q,i = 2 T/(n Dt) + F_Q/n."""
    ys = [Dt / 2 * math.cos(2 * math.pi * i / n) for i in range(n)]
    sy2 = sum(y * y for y in ys)
    FA = [F_axial / n + M_tilt * 1000.0 * y / sy2 for y in ys]
    FQ = 2 * T_torsion * 1000.0 / (n * Dt) + F_trans / n
    return {"FA_max": max(FA), "FA_min": min(FA), "FQ": FQ, "sum_y2": sy2, "sum_y2_formula": n * Dt ** 2 / 8}


def n_bolts_for_head(p_bar=10.0, D_seal=110.0, Dt=150.0, F_seal_per_bolt=0.0, M_tilt=0.0, ns=(4, 6, 8, 10, 12), P=None):
    """Compressor cylinder head: gas force F = p pi D_seal^2 / 4 shared by n bolts; check each n with the bolt program."""
    P = dict(P or DEFAULT)
    F = p_bar * 0.1 * math.pi / 4 * D_seal ** 2
    rows = []
    for n in ns:
        L = flange_bolt_loads(n, Dt, M_tilt, F, 0.0, 0.0)
        Q = dict(P, FA_max=L["FA_max"], FA_min=0.0, FQ=0.0, F_seal=F_seal_per_bolt)
        S = summary(Q)
        rows.append({"n": n, "FA": L["FA_max"], "S_F": S["ws"]["S_F"], "S_D": S["fat"]["S_D"], "util": S["pre"]["utilisation"],
                     "ok": S["ok"]["preload"] and S["ok"]["yield"] and S["ok"]["fatigue"], "pitch": math.pi * Dt / n})
    return {"F_gas": F, "rows": rows}

# ---------------------------------------------------------------- 6.6 safety summary and fixing the default
def safety_summary(P, S=None):
    S = S or summary(P)
    return [("preload F_Mmax/F_Mzul", S["pre"]["utilisation"], "<= 1", S["ok"]["preload"]),
            ("yield S_F", S["ws"]["S_F"], ">= %.1f" % P["S_F_req"], S["ok"]["yield"]),
            ("fatigue S_D", S["fat"]["S_D"], ">= %.1f" % P["S_D_req"], S["ok"]["fatigue"]),
            ("surface pressure S_p", S["sp"]["S_p"], ">= %.1f" % P["S_p_req"], S["ok"]["pressure"]),
            ("slip S_G", S["slip"]["S_G"], ">= %.1f" % P["S_slip_req"], S["ok"]["slip"])]


def fix_default_study(P=None):
    P = dict(P or DEFAULT)
    out = []

    def add(name, S, Q):
        out.append({"variant": name, "util": S["pre"]["utilisation"], "S_F": S["ws"]["S_F"], "S_D": S["fat"]["S_D"],
                    "S_p": S["sp"]["S_p"], "S_G": S["slip"]["S_G"], "MA": S["tight"]["MA"],
                    "all_ok": all(S["ok"].values()) if isinstance(S["ok"], dict) else False})
    add("default M12 10.9", summary(P), P)
    add("+ hardened washer", with_washer(P), P)
    Q = dict(P, tightening="torque-controlled with friction test on the part")
    add("+ washer + torque with friction test (aA 1.4)", with_washer(Q), Q)
    Q = dict(P, tightening="angle-controlled (yield range)")
    add("+ washer + angle-controlled (aA 1.0)", with_washer(Q), Q)
    Q = dict(P, muT=0.40)
    add("+ washer + blasted interface muT 0.40", with_washer(Q), Q)
    Q = dict(P, thread="M16", cls="8.8", DA=44.0)
    add("M16 8.8, DA 44 (no washer)", summary(Q), Q)
    Q = dict(P, FQ=P["FQ"] * 6 / 8)
    add("8 instead of 6 bolts (FQ x 6/8) + washer", with_washer(Q), Q)
    return out

# ---------------------------------------------------------------- demo
def demo_ch56():
    P = dict(DEFAULT)
    print("## 5.1 Working stress: residual torsion factor k_tau")
    for r in ktau_study(P):
        print("  k_tau %.1f: sigma_red %.0f MPa, S_F %.2f" % (r["k_tau"], r["sigma_red"], r["S_F"]))
    y = yield_controlled(P)
    print("  yield-controlled: F_M(nu 0.9) %.0f N, F_M(nu 1.0) %.0f N, upper yield scatter %.0f N; slip S_G %.2f" % (
        y["FM_nu09"], y["FM_nu1"], y["FM_max_yield_scatter"], y["slip_S_G"]))
    print("\n## 5.2 Fatigue: finite life (sigma_AS (2e6/N)^(1/3))")
    for r in fatigue_finite(P):
        print("  N %8.0f: sigma_AZ %.1f MPa, S_D %.2f" % (r["N"], r["sigma_AZ"], r["S_D"]))
    print("  rolled after heat treatment, sigma_ASG = (2 - F_Sm/F_0.2) sigma_ASV:")
    for r in haigh_after_HT(P):
        print("    F_Sm/F_0.2 %.1f: sigma_ASG %.1f MPa (x %.1f)" % (r["FSm_F02"], r["sigma_ASG"], r["gain"]))
    print("  fatigue measures at F_A 0..40 kN:")
    for r in fatigue_measures(P, FA_max=40000.0):
        print("    %-40s Phi_n %.4f, sigma_a %5.1f MPa, sigma_AS %5.1f MPa, S_D %.2f" % (r["measure"], r["Phi_n"], r["sigma_a"], r["sigma_AS"], r["S_D"]))
    print("\n## 5.3 Eccentric loading (beam model, s_sym 8 mm, interface 40 x 36 mm)")
    for r in eccentric_trend(P):
        print("  a %4.1f mm: Phi_en %.4f, opening load F_Aab %.0f N (centric limit %.0f N)" % (r["a"], r["Phi_en"], r["FA_ab"], r["FA_ab_centric"]))
    print("\n## 6.1 Surface pressure options (working load)")
    for name, Ap, p, pG, S in pressure_options(P):
        print("  %-30s A_p %6.1f mm2, p %4.0f MPa, p_G %4.0f -> S_p %.2f" % (name, Ap, p, pG, S))
    print("\n## 6.2 Embedding by roughness and number of interfaces")
    for r in embedding_table(P):
        if r["interfaces"] in (0, 1, 3):
            print("  Rz %-6s interfaces %d: f_Z %4.1f um, F_Z %5.0f N (%.1f %% of F_Mzul)" % (r["Rz"], r["interfaces"], r["fZ"], r["FZ"], 100 * r["share"]))
    print("\n## 6.3 Temperature: steel bolt in aluminium parts")
    for dT in (-40.0, 40.0, 80.0, 120.0):
        r = thermal_preload(P, dT)
        print("  dT %+5.0f K: dF_Vth %+6.0f N (F_Mzul %.0f N)" % (dT, r["dF_Vth"], r["FMzul"]))
    r = thermal_preload(P, 80.0, part="stainless A2", part_material="C45 (QT)")
    print("  steel bolt in stainless parts, dT +80 K: dF_Vth %+.0f N" % r["dF_Vth"])
    print("\n## 6.4 Slip: interface friction")
    for r in slip_study(P):
        print("  %-38s muT %.2f: S_G %.2f static %s dynamic %s" % (r["surface"], r["muT"], r["S_G"],
                                                                   "OK" if r["static_ok"] else "--", "OK" if r["dynamic_ok"] else "--"))
    for fit in (False, True):
        b = bolt_shear_if_slip(P, fit)
        print("  bolt in shear after slip (%s): tau %.1f MPa, tau_B %.0f -> S %.1f; bearing %.1f MPa" % (
            "fitted bolt d+1" if fit else "shank d", b["tau"], b["tau_B"], b["S"], b["bearing"]))
    print("\n## 6.5 Multi-bolt joints")
    L = flange_bolt_loads(8, 150.0, M_tilt=600.0, F_axial=40000.0, T_torsion=300.0, F_trans=4000.0)
    print("  8 bolts on 150 mm, F 40 kN, M 600 N m, T 300 N m, F_Q 4 kN: F_A,i %.0f .. %.0f N, F_Q,i %.0f N; sum y^2 %.0f = n Dt^2/8 %.0f" % (
        L["FA_min"], L["FA_max"], L["FQ"], L["sum_y2"], L["sum_y2_formula"]))
    H = n_bolts_for_head(p_bar=10.0, D_seal=110.0, Dt=150.0, P=dict(P, FQ=0.0))
    print("  cylinder head p 10 bar, seal D 110 -> gas force %.0f N:" % H["F_gas"])
    for r in H["rows"]:
        print("    n %2d: F_A %6.0f N, pitch %5.1f mm, S_F %.2f, S_D %.2f, F_Mmax/F_Mzul %.3f %s" % (
            r["n"], r["FA"], r["pitch"], r["S_F"], r["S_D"], r["util"], "OK" if r["ok"] else "fails"))
    print("\n## 6.6 Safety summary of the default and fixing it")
    for name, v, req, ok in safety_summary(P):
        print("  %-24s %6.2f  (%s) %s" % (name, v, req, "OK" if ok else "NOT OK"))
    for r in fix_default_study(P):
        print("  %-46s util %.3f S_F %.2f S_D %5.2f S_p %.2f S_G %.2f M_A %5.1f N m %s" % (
            r["variant"], r["util"], r["S_F"], r["S_D"], r["S_p"], r["S_G"], r["MA"], "ALL OK" if r["all_ok"] else "fails"))

# ================================================================ added with guide chapters (ch78)
# ---------------------------------------------------------------- 7.1 manufacturing of bolts
BOLT_PROCESS_CHAIN = [
    ("wire rod", "cold-heading quality steel (8.8: C35/B-alloyed 20MnB4/C45; 10.9: 32CrB4/34Cr4/42CrMo4; 12.9: 42CrMo4/34CrNiMo6), spheroidise annealed, drawn to size"),
    ("cold heading", "multi-station header forms the head in 3-5 blows at 100-300 parts/min, no chips, unbroken fibre flow"),
    ("thread rolling (8.8 usual)", "flat dies or cylindrical dies; before heat treatment -> residual stress relieved by tempering"),
    ("quench and temper", "austenitise ~850-880 C, oil/polymer quench, temper >= 425 C (8.8) / >= 425 C (10.9) / >= 380 C (12.9) per ISO 898-1 (check)"),
    ("thread rolling after HT (option)", "rolling the hardened bolt keeps compressive residual stress at the thread root -> higher fatigue limit (sigma_ASG)"),
    ("coating", "zinc flake (no hydrogen), electroplated zinc / Zn-Ni + baking for >= 10.9 (hydrogen), phosphate + oil, black oxide"),
    ("friction control", "top coat / wax / lubricant sets the friction class (target mu_tot 0.09-0.14, check)"),
    ("inspection", "hardness, tensile / wedge test (ISO 898-1), decarburisation, thread gauge, 100 % crack / sorting for safety parts"),
]

COATINGS = {   # friction range mu_tot, salt-spray hours to red rust (typical), hydrogen risk - check supplier data
    "zinc flake + top coat (e.g. ISO 10683)": {"mu": (0.09, 0.14), "salt_h": 720, "hydrogen": "none (no acid, no current)"},
    "electroplated zinc + passivation":       {"mu": (0.12, 0.18), "salt_h": 120, "hydrogen": "high for >= 10.9: bake 4-8 h at 200 C within 4 h"},
    "zinc-nickel electroplated":              {"mu": (0.09, 0.15), "salt_h": 720, "hydrogen": "medium, bake for >= 10.9"},
    "phosphate + oil":                        {"mu": (0.10, 0.16), "salt_h": 24,  "hydrogen": "low (pickling) - bake if HRC > 39"},
    "black oxide + oil":                      {"mu": (0.12, 0.18), "salt_h": 12,  "hydrogen": "low"},
    "plain, dry":                             {"mu": (0.16, 0.30), "salt_h": 0,   "hydrogen": "none"},
}

FRICTION_CLASSES = {"A": (0.04, 0.10), "B": (0.08, 0.16), "C": (0.14, 0.24), "D": (0.20, 0.35), "E": (0.30, 0.45)}   # VDI 2230 style (check)

def coating_effect(P=None):
    """Same tightening torque, different coatings: preload range and its effect on the joint."""
    P = dict(P or DEFAULT)
    g = thread_geometry(P)
    MA = tightening(P, g)["MA"] * 1000.0
    rows = []
    for name, c in COATINGS.items():
        lo, hi = c["mu"]
        Fmax = MA / torque_coeff(P, g, lo, lo)
        Fmin = MA / torque_coeff(P, g, hi, hi)
        rows.append({"coating": name, "mu": c["mu"], "Fmin": Fmin, "Fmax": Fmax, "ratio": Fmax / Fmin,
                     "over_FMzul_at_mu_lo": Fmax / FM_zul(P, g, lo)})
    return {"MA_Nm": MA / 1000.0, "rows": rows}

# ---------------------------------------------------------------- 7.2 assembly methods
def torque_scatter(P=None, tool_tol=0.05):
    """Torque control: preload range from the friction range and the tool scatter +/- tool_tol -> alpha_A."""
    P = dict(P or DEFAULT)
    g = thread_geometry(P)
    MA = tightening(P, g)["MA"] * 1000.0
    Fmax = MA * (1 + tool_tol) / torque_coeff(P, g, P["muG_min"], P["muK_min"])
    Fmin = MA * (1 - tool_tol) / torque_coeff(P, g, P["muG_max"], P["muK_max"])
    return {"MA_Nm": MA / 1000.0, "Fmin": Fmin, "Fmax": Fmax, "alpha_A": Fmax / Fmin}

def angle_for_preload(P, F_target, F_snug):
    """Turn-of-nut: angle beyond snug = 360 * (deltaS + deltaP) * (F_target - F_snug) / P (elastic range)."""
    g = thread_geometry(P)
    d = bolt_compliance(P, g)["deltaS"] + plate_compliance(P, g)["deltaP"]
    return 360.0 * d * (F_target - F_snug) / g["P"]

def angle_control(P=None, snug_frac=0.15, angle_tol_deg=3.0):
    """Torque-angle control in the elastic range: target F_Mzul / 1.1; scatter from snug preload and angle tolerance."""
    P = dict(P or DEFAULT)
    g = thread_geometry(P)
    Fz = FM_zul(P, g)
    Ftar = Fz / 1.1
    d = bolt_compliance(P, g)["deltaS"] + plate_compliance(P, g)["deltaP"]
    # snug torque chosen for snug_frac * Fz at mean friction; snug preload varies with friction
    mu_m = 0.5 * (P["muG_min"] + P["muG_max"])
    Msnug = snug_frac * Fz * torque_coeff(P, g, mu_m, mu_m)
    Fs_lo = Msnug / torque_coeff(P, g, P["muG_max"], P["muK_max"])
    Fs_hi = Msnug / torque_coeff(P, g, P["muG_min"], P["muK_min"])
    th = angle_for_preload(P, Ftar, snug_frac * Fz)
    k = g["P"] / (360.0 * d)                         # N per degree
    Fmin = Fs_lo + k * (th - angle_tol_deg)
    Fmax = Fs_hi + k * (th + angle_tol_deg)
    return {"F_target": Ftar, "theta_deg": th, "N_per_deg": k, "Msnug_Nm": Msnug / 1000, "Fmin": Fmin, "Fmax": Fmax,
            "alpha_A": Fmax / Fmin}

def yield_control(P=None):
    """Yield-point (gradient) control: the bolt is tightened to its yield point (nu = 1); preload depends only on
    the thread friction through the torsion share -> range FM(nu=1, muG_max) .. FM(nu=1, muG_min)."""
    P = dict(P or DEFAULT)
    Q = dict(P, nu=1.0)
    g = thread_geometry(Q)
    Fhi = FM_zul(Q, g, P["muG_min"])
    Flo = FM_zul(Q, g, P["muG_max"])
    return {"Fmin": Flo, "Fmax": Fhi, "alpha_A": Fhi / Flo}

def ultrasonic(P=None, F=None, c_L=5900.0, K_ac=2.0):
    """Ultrasonic elongation: delta_L = F * deltaS; time-of-flight change dt = 2 L_eff/c * sigma/E * (1 + K_ac)
    (K_ac acousto-elastic factor ~ 2 for steel, check: calibrate on the actual bolt)."""
    P = dict(P or DEFAULT)
    g = thread_geometry(P)
    F = F or FM_zul(P, g) / 1.1
    b = bolt_compliance(P, g)
    dL = F * b["deltaS"]                             # mm
    L_eff = P["lK"] + 0.5 * g["d"] + 0.4 * g["d"]    # effective length incl. head and nut zones (approx.)
    sigma = F / g["AS"]
    dt_ns = 2 * L_eff / 1000.0 / c_L * sigma / 205000.0 * (1 + K_ac) * 1e9
    return {"F": F, "dL_um": dL * 1000.0, "L_eff": L_eff, "dt_ns": dt_ns, "dL_per_kN_um": 1000.0 * b["deltaS"] * 1000.0}

def hydraulic_tension(P=None, F_residual=None):
    """Bolt tensioner: the tool stretches the bolt, the nut is run down, the load transfers to the nut with a loss.
    Load transfer factor LTF ~ 1 + 1.0 d / lK (rule of thumb, check with the tool maker)."""
    P = dict(P or DEFAULT)
    g = thread_geometry(P)
    F_residual = F_residual or FM_zul(P, g) / 1.1
    LTF = 1 + 1.0 * g["d"] / P["lK"]
    F_tool = LTF * F_residual
    sigma_tool = F_tool / g["AS"]
    return {"LTF": LTF, "F_tool": F_tool, "sigma_tool": sigma_tool, "ok_yield": sigma_tool <= CLASSES[P["cls"]]["Rp"],
            "note": "pure tension during tensioning (no torsion) -> up to ~0.9 Rp0.2 possible"}

def heat_tightening(P=None, F=None, alpha_th=11.5e-6):
    """Heating the bolt: needed temperature difference = F (deltaS + deltaP) / (alpha * L_heated), L_heated = lK."""
    P = dict(P or DEFAULT)
    g = thread_geometry(P)
    F = F or FM_zul(P, g) / 1.1
    d = bolt_compliance(P, g)["deltaS"] + plate_compliance(P, g)["deltaP"]
    return {"F": F, "elong_um": F * d * 1000, "dT": F * d / (alpha_th * P["lK"])}

def method_comparison(P=None):
    """Preload range and slip safety of each assembly method for the same joint."""
    P = dict(P or DEFAULT)
    g = thread_geometry(P)
    lf, ez = load_factor(P, g), embedding(P, g)
    def SG(Fmin):
        FKR = Fmin - (1 - lf["Phi_n"]) * P["FA_max"] - ez["FZ"]
        return FKR * P["qF"] * P["muT"] / P["FQ"]
    ts, ac, yc = torque_scatter(P), angle_control(P), yield_control(P)
    rows = [("torque control (tool +/-5 %)", ts["Fmin"], ts["Fmax"]),
            ("torque-angle control (elastic)", ac["Fmin"], ac["Fmax"]),
            ("yield-point control", yc["Fmin"], yc["Fmax"])]
    out = []
    for n, lo, hi in rows:
        out.append({"method": n, "Fmin": lo, "Fmax": hi, "alpha_A": hi / lo, "S_G": SG(lo)})
    return out

# ---------------------------------------------------------------- 7.3 tightening sequence (elastic interaction)
def crosstalk(n_bolts=8, F_target=50000.0, c_near=0.15, c_far=0.05, passes=1, order="cross"):
    """Simple elastic-interaction model: tightening bolt j by dF_j lowers every other bolt i by c_ij * dF_j
    (c_near for the two neighbours, c_far for the rest). 'cross' = star pattern 1-5-3-7-2-6-4-8, 'round' = 1..n."""
    STAR = {4: [0, 2, 1, 3], 6: [0, 3, 1, 4, 2, 5], 8: [0, 4, 2, 6, 1, 5, 3, 7], 12: [0, 6, 3, 9, 1, 7, 4, 10, 2, 8, 5, 11]}
    seq = STAR.get(n_bolts, list(range(n_bolts))) if order == "cross" else list(range(n_bolts))
    F = [0.0] * n_bolts
    for _ in range(passes):
        for j in seq:
            dF = F_target - F[j]
            F[j] = F_target
            for i in range(n_bolts):
                if i == j:
                    continue
                near = (abs(i - j) % n_bolts) in (1, n_bolts - 1)
                F[i] -= (c_near if near else c_far) * dF
                F[i] = max(F[i], 0.0)
    return {"sequence": [s + 1 for s in seq], "F": F, "Fmin": min(F), "Fmax": max(F), "scatter": max(F) / max(min(F), 1e-9)}

# ---------------------------------------------------------------- 7.4 friction testing (ISO 16047)
def iso16047(P, MA_Nm, MG_Nm, F):
    """Evaluate a test-rig point: total, thread and head friction from tightening torque, thread torque and preload."""
    g = thread_geometry(P)
    MA, MG = MA_Nm * 1000.0, MG_Nm * 1000.0
    DKm = 0.5 * (g["dw"] + g["dh"])
    muG = (MG / F - 0.16 * g["P"]) / (0.58 * g["d2"])
    muK = (MA - MG) / (F * DKm / 2)
    mutot = (MA / F - 0.16 * g["P"]) / (0.58 * g["d2"] + DKm / 2)
    return {"muG": muG, "muK": muK, "mutot": mutot}

def synthetic_test_points(P=None, muG=0.12, muK=0.11, F_list=(20000.0, 35000.0, 50000.0)):
    """Test-rig readings generated from known friction (to check the evaluation)."""
    P = dict(P or DEFAULT)
    g = thread_geometry(P)
    DKm = 0.5 * (g["dw"] + g["dh"])
    pts = []
    for F in F_list:
        MG = F * (0.16 * g["P"] + 0.58 * g["d2"] * muG) / 1000.0
        MA = MG + F * DKm / 2 * muK / 1000.0
        pts.append((MA, MG, F))
    return pts

# ---------------------------------------------------------------- 7.5 self-loosening
def loosening_torque(P=None, F=None):
    """Torque needed to loosen (untighten) at rest, and the inner loosening torque from the thread pitch alone
    (what remains when transverse slip removes the friction in thread and under the head)."""
    P = dict(P or DEFAULT)
    g = thread_geometry(P)
    F = F or FM_zul(P, g)
    DKm = 0.5 * (g["dw"] + g["dh"])
    ML = F * (-0.16 * g["P"] + 0.58 * g["d2"] * P["muG_min"] + DKm / 2 * P["muK_min"]) / 1000.0
    Mpitch = F * 0.16 * g["P"] / 1000.0
    return {"F": F, "M_loosen_Nm": ML, "M_pitch_Nm": Mpitch, "MA_Nm": tightening(P, g)["MA"]}

def slip_limit_transverse(P=None):
    """Transverse load at which the joint starts to slip with the minimum residual clamp load
    (self-loosening starts when this is exceeded under alternating transverse load - Junker)."""
    P = dict(P or DEFAULT)
    s = slip(P)
    FQ_lim = s["FKRmin"] * P["qF"] * P["muT"]
    return {"FKRmin": s["FKRmin"], "FQ_slip": FQ_lim, "FQ": P["FQ"], "margin": FQ_lim / P["FQ"]}

LOCKING = [   # Junker-test behaviour (VDI 2230 / literature, check)
    ("high preload + enough clamp length (l_K/d > 3..5)", "works - the primary measure"),
    ("wedge-locking washer pair (cam angle > thread lead angle)", "works against rotation (loosening); not against loss of preload by embedding"),
    ("anaerobic adhesive (medium / high strength)", "works; also seals; temperature limit ~150 C; breakaway torque test"),
    ("prevailing-torque nut (all-metal / nylon insert)", "loss-preventing only - loosens partly, stays on the bolt"),
    ("ribbed flange bolts / nuts", "works on steel parts of moderate hardness; damages the surface"),
    ("spring washer (DIN 127), toothed / serrated lock washer, plain lock nut", "INEFFECTIVE - flattened at assembly, withdrawn standards"),
    ("split pin / safety wire", "loss-preventing only (prevents falling off)"),
]

# ---------------------------------------------------------------- 7.6 inspection
def torque_audit(P=None, k_breakaway=(1.05, 1.30), k_continue=(0.95, 1.15)):
    """Acceptance windows of an audit after assembly (typical, check): breakaway torque (static friction) and
    tightening-on torque (start of further rotation)."""
    P = dict(P or DEFAULT)
    MA = tightening(P)["MA"]
    return {"MA": MA, "breakaway": (k_breakaway[0] * MA, k_breakaway[1] * MA),
            "continue": (k_continue[0] * MA, k_continue[1] * MA)}

GALVANIC = {   # free corrosion potential in sea water, V vs SCE (typical, check)
    "magnesium": -1.6, "zinc": -1.03, "aluminium alloy": -0.80, "carbon steel": -0.65, "cast iron": -0.62,
    "zinc-flake coated steel": -0.95, "brass": -0.33, "copper": -0.33, "stainless steel A2/A4 (passive)": -0.08,
    "titanium": -0.05,
}

def galvanic_risk(bolt, part, area_ratio_bolt_to_part=0.05):
    """Potential difference; the less noble metal is the anode. Small anode + large cathode = fast attack."""
    dU = GALVANIC[part] - GALVANIC[bolt]
    anode = bolt if dU > 0 else part
    small_anode = (anode == bolt and area_ratio_bolt_to_part < 1) or (anode == part and area_ratio_bolt_to_part > 1)
    risk = "low" if abs(dU) < 0.15 else ("medium" if abs(dU) < 0.30 else "high")
    if risk != "low" and small_anode:
        risk += " (small anode - worst case)"
    return {"dU": dU, "anode": anode, "risk": risk}

FAILURES = [
    ("fatigue fracture at the first engaged thread (nut side)", "low preload -> high F_SA share, bending, rough thread root",
     "higher / controlled preload, longer clamp length, rolled after HT, thread run-out; check sigma_a"),
    ("fracture under the head / at the shank transition", "bending from inclined bearing faces, small head fillet",
     "flat bearing faces, larger fillet, washers, check perpendicularity"),
    ("thread stripping (nut or tapped hole)", "engagement too short, soft tapped material, oversize tapping",
     "m_eff >= 1.0-1.5 d steel / 2 d aluminium (check), thread inserts, nut class >= bolt class"),
    ("self-loosening (rotation)", "transverse slip from too low residual clamp load",
     "raise preload, more bolts, larger mu_T, pins for transverse loads, wedge-locking washers"),
    ("loss of preload without rotation", "embedding, creep of soft parts / gaskets / coatings, temperature",
     "fewer interfaces, hard washers, re-tighten gaskets, account for F_Z and temperature"),
    ("delayed (hydrogen) fracture hours after assembly", "electroplated >= 10.9 not baked, hydrogen from corrosion",
     "zinc flake, baking, lower hardness, avoid 12.9 electroplated"),
    ("corrosion / seizing", "galvanic pairing, crevice, no coating",
     "coating, isolation washers, same-metal pairing, anti-seize paste (changes friction!)"),
    ("overstressed at assembly (yield / torsion fracture)", "too high torque for the actual friction, impact wrench",
     "friction class control, torque from F_Mzul at mu_min, calibrated tools"),
]

def reuse_rule(method):
    """Re-use of bolts (rule of thumb, check VDI 2230 / supplier)."""
    if method in ("angle-controlled (yield range)", "yield-controlled"):
        return "plastically tightened: re-use only if the elongation is checked (e.g. < 0.3 %) and the supplier allows it; usually replace"
    return "elastically tightened: re-use possible if thread and coating undamaged (friction changes after first use - re-check)"

# ---------------------------------------------------------------- 8 worked example: compressor cylinder head
def gas_load(p_bar=10.0, D_gasket=85.0, n_bolts=4):
    """Head lifting force from the pressure on the area inside the gasket centre line."""
    A = math.pi / 4 * D_gasket ** 2
    F = p_bar * 0.1 * A
    return {"A_mm2": A, "F_total": F, "F_per_bolt": F / n_bolts}

def gasket_clamp(D_in=80.0, D_out=90.0, q_min=20.0, n_bolts=4):
    """Residual clamp load per bolt for the minimum gasket surface pressure q_min (check the gasket maker, EN 1591 style)."""
    A = math.pi / 4 * (D_out ** 2 - D_in ** 2)
    return {"A_gasket": A, "F_seal_total": q_min * A, "F_seal_per_bolt": q_min * A / n_bolts}

EXAMPLE_HEAD = {
    "name": "Compressor cylinder head: 4 bolts M10 8.8 into the cast-iron cylinder (worked example chapter 8)",
    "thread": "M10", "cls": "8.8", "joint": "ESV",
    "lK": 22.0, "ls": 12.0, "DA": 26.0,
    "part_material": "EN-GJS-400", "nut_side_material": "EN-GJL-250",
    "FA_max": 1419.0, "FA_min": 0.0, "FQ": 300.0, "qF": 1, "muT": 0.15, "F_seal": 6676.0,
    "tightening": "torque wrench / precision nut runner",
    "muG_min": 0.09, "muG_max": 0.14, "muK_min": 0.09, "muK_max": 0.14,
    "n_interfaces": 1, "rolled": "before",
}

def head_example_steps():
    gl = gas_load()
    gk = gasket_clamp()
    trials = []
    for th, cl, pm in (("M8", "10.9", "AlMgSi1 F31"), ("M8", "10.9", "EN-GJS-400"), ("M10", "10.9", "EN-GJS-400"), ("M10", "8.8", "AlMgSi1 F31"), ("M10", "8.8", "EN-GJS-400")):
        Q = dict(DEFAULT, **EXAMPLE_HEAD)
        Q.update(thread=th, cls=cl, part_material=pm)
        if th == "M8":
            Q.update(DA=22.0)
        S = summary(Q)
        trials.append({"thread": th, "cls": cl, "part": pm, "ok": S["ok"], "util": S["pre"]["utilisation"],
                       "S_p": S["sp"]["S_p"], "S_G": S["slip"]["S_G"], "S_D": S["fat"]["S_D"], "MA": S["tight"]["MA"]})
    return {"gas": gl, "gasket": gk, "trials": trials}

# ---------------------------------------------------------------- demo
def example_json():
    """Keys of bolt.DEFAULT changed for the worked example (saved as examples/bolt_example.json)."""
    return dict(EXAMPLE_HEAD)


def demo_ch78():
    P = dict(DEFAULT)
    g = thread_geometry(P)
    print("## 7.1 Bolt manufacturing chain")
    for s, t in BOLT_PROCESS_CHAIN:
        print("  %-30s %s" % (s, t))
    ce = coating_effect(P)
    print("\n## 7.1 Coatings: same torque M_A %.1f N m (set for mu 0.10) -> preload range" % ce["MA_Nm"])
    for r in ce["rows"]:
        print("  %-40s mu %.2f-%.2f: F %6.0f .. %6.0f N (x%.2f), F_max / F_Mzul(mu_lo) %.2f" % (
            r["coating"], r["mu"][0], r["mu"][1], r["Fmin"], r["Fmax"], r["ratio"], r["over_FMzul_at_mu_lo"]))
    print("\n## 7.2 Assembly methods for the default M12 10.9")
    ts = torque_scatter(P)
    print("  torque control: M_A %.1f N m, F %.0f .. %.0f N -> alpha_A %.2f" % (ts["MA_Nm"], ts["Fmin"], ts["Fmax"], ts["alpha_A"]))
    ac = angle_control(P)
    print("  torque-angle: snug %.1f N m, angle %.1f deg for %.0f N (%.0f N/deg), F %.0f .. %.0f N -> alpha_A %.2f" % (
        ac["Msnug_Nm"], ac["theta_deg"], ac["F_target"], ac["N_per_deg"], ac["Fmin"], ac["Fmax"], ac["alpha_A"]))
    yc = yield_control(P)
    print("  yield control: F %.0f .. %.0f N -> alpha_A %.2f" % (yc["Fmin"], yc["Fmax"], yc["alpha_A"]))
    us = ultrasonic(P)
    print("  ultrasonic: F %.0f N -> elongation %.1f um (%.2f um/kN), L_eff %.1f mm, time-of-flight change %.1f ns" % (
        us["F"], us["dL_um"], us["dL_per_kN_um"], us["L_eff"], us["dt_ns"]))
    ht = hydraulic_tension(P)
    print("  hydraulic tensioner: LTF %.2f -> tool force %.0f N, sigma %.0f MPa (%s)" % (ht["LTF"], ht["F_tool"], ht["sigma_tool"], "OK" if ht["ok_yield"] else "over Rp0.2"))
    hh = heat_tightening(P)
    print("  heat tightening: elongation %.1f um -> dT %.0f K" % (hh["elong_um"], hh["dT"]))
    print("\n## 7.2 Method comparison: preload range and slip safety (required %.1f)" % P["S_slip_req"])
    for r in method_comparison(P):
        print("  %-32s F %6.0f .. %6.0f N, alpha_A %.2f, S_G %.2f %s" % (r["method"], r["Fmin"], r["Fmax"], r["alpha_A"], r["S_G"],
                                                                     "OK" if r["S_G"] >= P["S_slip_req"] else "NOT OK"))
    print("\n## 7.3 Tightening sequence, 8-bolt flange, elastic interaction c_near 0.15 / c_far 0.05, target 50 kN")
    for order in ("round", "cross"):
        for ps in (1, 2, 3):
            c = crosstalk(8, 50000.0, passes=ps, order=order)
            print("  %-5s %d pass(es): seq %s -> F %5.1f .. %5.1f kN (max/min %.2f)" % (
                order, ps, "-".join(str(s) for s in c["sequence"]), c["Fmin"] / 1000, c["Fmax"] / 1000, c["scatter"]))
    print("\n## 7.4 Friction test evaluation (ISO 16047), synthetic readings from mu_G 0.12 / mu_K 0.11")
    for MA, MG, F in synthetic_test_points(P):
        r = iso16047(P, MA, MG, F)
        print("  M_A %6.2f N m, M_G %6.2f N m, F %6.0f N -> mu_G %.4f, mu_K %.4f, mu_tot %.4f" % (MA, MG, F, r["muG"], r["muK"], r["mutot"]))
    print("\n## 7.5 Self-loosening")
    lt = loosening_torque(P)
    print("  at F_Mzul %.0f N: tightening %.1f N m, loosening torque %.1f N m, inner loosening torque from the pitch %.1f N m" % (
        lt["F"], lt["MA_Nm"], lt["M_loosen_Nm"], lt["M_pitch_Nm"]))
    sl = slip_limit_transverse(P)
    print("  transverse slip starts at %.0f N (F_KRmin %.0f N x mu_T); applied %.0f N -> margin %.2f" % (sl["FQ_slip"], sl["FKRmin"], sl["FQ"], sl["margin"]))
    for m, v in LOCKING:
        print("  - %-62s %s" % (m, v))
    print("\n## 7.6 Inspection and corrosion")
    ta = torque_audit(P)
    print("  torque audit for M_A %.1f N m: breakaway %.1f .. %.1f N m, tightening-on %.1f .. %.1f N m" % (
        ta["MA"], ta["breakaway"][0], ta["breakaway"][1], ta["continue"][0], ta["continue"][1]))
    for b, p in (("zinc-flake coated steel", "aluminium alloy"), ("stainless steel A2/A4 (passive)", "aluminium alloy"),
                 ("carbon steel", "cast iron"), ("carbon steel", "stainless steel A2/A4 (passive)")):
        r = galvanic_risk(b, p)
        print("  bolt %-32s in %-32s dU %+.2f V, anode %s, risk %s" % (b, p, r["dU"], r["anode"], r["risk"]))
    print("  re-use: torque method -> %s" % reuse_rule(P["tightening"]))
    print("  re-use: yield method  -> %s" % reuse_rule("yield-controlled"))
    print("\n## 7.7 Typical failures")
    for f, c, r in FAILURES:
        print("  - %s | cause: %s | remedy: %s" % (f, c, r))
    print("\n## 8.2 Worked example: compressor cylinder head")
    hx = head_example_steps()
    print("  gas: 10 bar on D 85 mm -> A %.0f mm2, F %.0f N, per bolt (4) %.0f N" % (hx["gas"]["A_mm2"], hx["gas"]["F_total"], hx["gas"]["F_per_bolt"]))
    print("  gasket: A %.0f mm2 x q_min 20 MPa -> %.0f N, per bolt %.0f N" % (hx["gasket"]["A_gasket"], hx["gasket"]["F_seal_total"], hx["gasket"]["F_seal_per_bolt"]))
    for t in hx["trials"]:
        bad = [k for k, v in t["ok"].items() if not v]
        print("  %-4s %-4s head %-12s util %.2f, S_p %.2f, S_G %.1f, S_D %.2f, M_A %.1f N m -> %s" % (
            t["thread"], t["cls"], t["part"], t["util"], t["S_p"], t["S_G"], t["S_D"], t["MA"], "all OK" if not bad else "fails: " + ", ".join(bad)))

def cmd_examples():
    P = dict(DEFAULT)
    print(report_text(P))
    print("\n## Tightening method (same joint)")
    for m in TIGHTENING:
        S = summary(dict(P, tightening=m))
        print("  %-48s alpha_A %.1f: F_Mmax/F_Mzul %.3f, S_G %.2f %s" % (m, TIGHTENING[m], S["pre"]["utilisation"], S["slip"]["S_G"],
                                                                     "OK" if all(S["ok"].values()) else "fails"))
    print("\n## Thread size and class: permissible preload and torque (mu_G = mu_K = 0.12, nu 0.9)")
    for th in ("M8", "M10", "M12", "M16", "M20"):
        row = []
        for cl in ("8.8", "10.9", "12.9"):
            Q = dict(P, thread=th, cls=cl, muG_min=0.12, muK_min=0.12)
            t = tightening(Q)
            row.append("%s %5.1f kN %6.1f N m" % (cl, t["FMzul"] / 1000, t["MA"]))
        print("  %-4s %s" % (th, " | ".join(row)))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-66s %s %s" % (name, "OK  " if cond else "FAIL", info))
    P = dict(DEFAULT)
    g = thread_geometry(P)
    chk("A_S of M12 = 84.3 mm2 (ISO 898-1)", abs(g["AS"] - 84.3) < 0.05, "%.3f" % g["AS"])
    chk("A_S of M20 = 245 mm2", abs(thread_geometry(dict(P, thread="M20"))["AS"] - 245) < 0.5)
    Fz = FM_zul(P, g)
    Rp = CLASSES[P["cls"]]["Rp"]
    sz = Fz / g["AS"]
    tau = Fz * 0.5 * g["d2"] * (g["P"] / (math.pi * g["d2"]) + 1.155 * P["muG_min"]) / (math.pi / 12 * g["dS"] ** 3)
    chk("F_Mzul: sigma_red (tension + full torsion, plastic W_P = pi d0^3/12) = nu Rp0.2", abs(math.sqrt(sz ** 2 + 3 * tau ** 2) - P["nu"] * Rp) < 1e-6)
    Q12 = dict(P, muG_min=0.12, muK_min=0.12)
    t12 = tightening(Q12)
    chk("M12 10.9, mu 0.12: F_Mzul ~ 63 kN, M_A ~ 117 N m (VDI table order)", 60000 < t12["FMzul"] < 66000 and 110 < t12["MA"] < 125,
        "%.1f kN, %.1f N m" % (t12["FMzul"] / 1000, t12["MA"]))
    # cone + sleeve formula meets the full cone formula at DA = DA_Gr
    pl = plate_compliance(P, g)
    a = plate_compliance(dict(P, DA=pl["DA_Gr"] - 1e-6), g)["deltaP"]
    b = plate_compliance(dict(P, DA=pl["DA_Gr"] + 1e-6), g)["deltaP"]
    chk("plate compliance continuous at D_A = D_A,Gr (cone+sleeve = cones)", abs(a / b - 1) < 1e-5)
    c = plate_compliance(dict(P, DA=g["dw"] + 1e-6), g)["deltaP"]
    s = 4 * P["lK"] / (PART_MATERIALS[P["part_material"]]["E"] * math.pi * ((g["dw"] + 1e-6) ** 2 - g["dh"] ** 2))
    chk("plate compliance -> sleeve formula at D_A = d_w", abs(c / s - 1) < 1e-4)
    lf = load_factor(P, g)
    chk("0 < Phi_n < Phi_K < 1", 0 < lf["Phi_n"] < lf["Phi_K"] < 1)
    b1 = bolt_compliance(P, g)
    chk("bolt compliance = sum of the parts", abs(b1["deltaS"] - (b1["dSK"] + b1["d1"] + b1["dGew"] + b1["dG"] + b1["dM"])) < 1e-15)
    pr = preload_check(P, g)
    sl = slip(P, g)
    t = tightening(P, g)
    chk("residual clamp load identity: F_KRmin = F_Mzul/alpha_A - (F_Mmin_req - F_Kerf)",
        abs(sl["FKRmin"] - (t["FMzul"] / t["alpha_A"] - (pr["FMmin_req"] - required_clamp(P)["FKerf"]))) < 1e-6)
    chk("torque from preload: M_A / F_Mzul = 0.16P + 0.58 d2 muG + DKm/2 muK", abs(t["MA"] * 1000 / t["FMzul"] - torque_coeff(P, g, 0.10, 0.10)) < 1e-9)
    chk("fatigue limit rolled before HT: 0.85 (150/d + 45)", abs(fatigue(P, g)["sigma_AS"] - 0.85 * (150 / 12 + 45)) < 1e-12)
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
        out = "bolt_out"
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
