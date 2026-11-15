#!/usr/bin/env python3
"""M5 gear program - cylindrical (spur / helical) involute gear pair: geometry (ISO 21771 style), profile shift,
working centre distance, contact ratios, forces, load capacity in the style of ISO 6336 (pitting + tooth root,
form factor by ISO 6336-3 method B), manufacturing and inspection data (span measurement W_k, dimension over pins/balls,
backlash). Guide: 05_gear_design.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python gear.py params                     default input (JSON) - copy, edit, use with --in
  python gear.py run [--in p.json] [--out folder]   full calculation -> report.md, gear.csv, profile.svg
  python gear.py examples                   worked examples of the guide
  python gear.py selftest                   independent cross-checks (must print SELFTEST PASS)
  python gear.py ch24 | ch5 | ch68          extra results of guide chapters 2-4, 5, 6-8
  python gear.py run --in examples/gear_example.json --out example   worked design example (chapter 8)

Basic rack: ISO 53 profile A style (alpha_n 20 deg, h_aP = 1.0 m, h_fP = 1.25 m, rho_fP = 0.38 m) unless changed.
ISO 6336 is implemented in a simplified form (method B form factors, simplified K_V, K_Hbeta given, life factors 1):
values marked 'check' in the guide must be compared with ISO 6336-1/-2/-3/-5 (2019) before a design report is signed.
All default numbers are EXAMPLE values.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- materials (typical allowable stress numbers)
MATERIALS = {   # sigma_Hlim, sigma_Flim (MPa) - typical ISO 6336-5 quality MQ values (check the standard figures)
    "18CrNiMo7-6 case hardened": {"sHlim": 1500, "sFlim": 500, "E": 206000, "nu": 0.3, "HV": "58-62 HRC"},
    "16MnCr5 case hardened":     {"sHlim": 1450, "sFlim": 460, "E": 206000, "nu": 0.3, "HV": "58-62 HRC"},
    "42CrMo4 nitrided":          {"sHlim": 1200, "sFlim": 420, "E": 206000, "nu": 0.3, "HV": "~600 HV surface"},
    "42CrMo4 induction hardened": {"sHlim": 1200, "sFlim": 360, "E": 206000, "nu": 0.3, "HV": "50-56 HRC"},
    "42CrMo4 QT":                {"sHlim": 770, "sFlim": 320, "E": 206000, "nu": 0.3, "HV": "~300 HB"},
    "C45 normalised":            {"sHlim": 560, "sFlim": 220, "E": 206000, "nu": 0.3, "HV": "~190 HB"},
    "EN-GJS-600-3":              {"sHlim": 560, "sFlim": 220, "E": 174000, "nu": 0.275, "HV": "~220 HB"},
}

DEFAULT = {
    "name": "Helical reducer stage 15 kW for a factory drive (example)",
    "mn": 2.0, "z1": 19, "z2": 60, "alpha_n_deg": 20.0, "beta_deg": 15.0,
    "x1": 0.25, "x2": -0.10,                 # profile shift coefficients
    "a_w": None,                             # working centre distance mm (None -> from x1 + x2)
    "b": 28.0,                               # face width mm (both gears)
    "haP": 1.0, "hfP": 1.25, "rhofP": 0.38,  # basic rack (factors of mn)
    "P_kW": 15.0, "n1_rpm": 1450.0,
    "KA": 1.25,                              # application factor (electric motor, moderate shocks)
    "KHbeta": 1.25,                          # face load factor (given; check with ISO 6336-1 method C/B)
    "KHalpha": 1.0,
    "accuracy_grade": 6,                     # ISO 1328-1 grade for K_V
    "material1": "18CrNiMo7-6 case hardened", "material2": "18CrNiMo7-6 case hardened",
    "SHmin": 1.0, "SFmin": 1.4,              # minimum safeties (typical industrial values)
    "ZLVR": 1.0,                             # lubrication / speed / roughness (ground flanks ~1.0, hobbed ~0.92)
    "life_h": 20000.0,
    "tooth_thickness_allowance_um": [-50, -80],   # upper / lower normal tooth thickness allowance A_sn (each gear)
    "centre_distance_tol_um": 20,            # +/- tolerance of a_w
    "pin_diameter_mm": None,                 # None -> standard ~1.68 mn
}

def inv(a):
    return math.tan(a) - a

def inv_inverse(y):
    """Solve inv(a) = y (Newton), a in rad."""
    a = (3 * y) ** (1 / 3) if y > 0 else 0.0
    for _ in range(60):
        f = math.tan(a) - a - y
        a -= f / (math.tan(a) ** 2)
    return a

# ---------------------------------------------------------------- chapter 3: geometry
def geometry(P):
    """ISO 21771 style geometry of an external pair. Returns all diameters, angles, centre distance, contact ratios."""
    mn, z1, z2 = P["mn"], P["z1"], P["z2"]
    an, be = math.radians(P["alpha_n_deg"]), math.radians(P["beta_deg"])
    at = math.atan(math.tan(an) / math.cos(be))              # transverse pressure angle
    mt = mn / math.cos(be)
    d1, d2 = mt * z1, mt * z2
    db1, db2 = d1 * math.cos(at), d2 * math.cos(at)
    bb = math.atan(math.tan(be) * math.cos(at))               # base helix angle
    a0 = (d1 + d2) / 2
    if P.get("a_w"):
        aw = P["a_w"]
        awt = math.acos(a0 * math.cos(at) / aw)
        xsum = (inv(awt) - inv(at)) * (z1 + z2) / (2 * math.tan(an))
    else:
        xsum = P["x1"] + P["x2"]
        awt = inv_inverse(2 * math.tan(an) * xsum / (z1 + z2) + inv(at))
        aw = a0 * math.cos(at) / math.cos(awt)
    x1, x2 = P["x1"], P["x2"]
    # tip diameters with tip shortening k (keeps the bottom clearance): k mn = a0 + (x1+x2) mn - aw
    k = (a0 + xsum * mn - aw) / mn
    da1 = d1 + 2 * mn * (P["haP"] + x1 - k)
    da2 = d2 + 2 * mn * (P["haP"] + x2 - k)
    df1 = d1 - 2 * mn * (P["hfP"] - x1)
    df2 = d2 - 2 * mn * (P["hfP"] - x2)
    # transverse contact ratio
    ga = 0.5 * (math.sqrt(da1 ** 2 - db1 ** 2) + math.sqrt(da2 ** 2 - db2 ** 2)) - aw * math.sin(awt)
    pbt = math.pi * mt * math.cos(at)
    ea = ga / pbt
    eb = P["b"] * math.sin(be) / (math.pi * mn)
    u = z2 / z1
    # tooth thickness on the reference circle (no allowance), transverse / normal
    sn1 = mn * (math.pi / 2 + 2 * x1 * math.tan(an))
    sn2 = mn * (math.pi / 2 + 2 * x2 * math.tan(an))
    # tip tooth thickness (transverse) - check against pointed teeth (s_a >= 0.25 mn for case hardened)
    def sat(d, da, sn):
        st = sn / math.cos(be)
        aat = math.acos(d * math.cos(at) / da)
        return da * (st / d + inv(at) - inv(aat))
    sa1, sa2 = sat(d1, da1, sn1), sat(d2, da2, sn2)
    # undercut limit z_min (x = 0) and x_min for no undercut
    zmin = 2 * P["haP"] * math.cos(be) / math.sin(at) ** 2
    def xmin(z):
        return P["haP"] - z * math.sin(at) ** 2 / (2 * math.cos(be))
    return {"at": at, "awt": awt, "bb": bb, "mt": mt, "d1": d1, "d2": d2, "db1": db1, "db2": db2,
            "da1": da1, "da2": da2, "df1": df1, "df2": df2, "a0": a0, "aw": aw, "xsum": xsum, "k": k,
            "ea": ea, "eb": eb, "eg": ea + eb, "u": u, "pbt": pbt, "ga": ga, "sn1": sn1, "sn2": sn2,
            "sa1": sa1, "sa2": sa2, "zmin": zmin, "xmin1": xmin(z1), "xmin2": xmin(z2),
            "zn1": z1 / (math.cos(bb) ** 2 * math.cos(be)), "zn2": z2 / (math.cos(bb) ** 2 * math.cos(be))}

# ---------------------------------------------------------------- chapter 4: forces
def forces(P, g):
    T1 = P["P_kW"] * 1000 / (P["n1_rpm"] * 2 * math.pi / 60)          # N m
    Ft = 2 * T1 * 1000 / g["d1"]                                         # N (at the reference circle)
    Fr = Ft * math.tan(g["awt"])                                         # radial (working pressure angle)
    Fa = Ft * math.tan(math.radians(P["beta_deg"]))
    v = math.pi * g["d1"] / 1000 * P["n1_rpm"] / 60                       # m/s
    return {"T1": T1, "T2": T1 * g["u"], "Ft": Ft, "Fr": Fr, "Fa": Fa, "Fn": math.sqrt(Ft ** 2 + Fr ** 2 + Fa ** 2),
            "v": v, "n2": P["n1_rpm"] / g["u"]}

# ---------------------------------------------------------------- chapter 5: ISO 6336 factors
_KV = {"spur": {5: 7.5, 6: 14.9, 7: 26.8, 8: 39.1, 9: 52.8, 10: 76.6}, "helical": {5: 6.7, 6: 13.3, 7: 23.9, 8: 34.8, 9: 47.0, 10: 68.2}}
def KV_factor(P, g, F):
    """Dynamic factor, simplified method (DIN 3990 / ISO 6336-1 method C style):
    K_V = 1 + (K1 / (K_A F_t / b) + K2) z1 v / 100 sqrt(u^2 / (1 + u^2)),  K2 = 0.0193 spur / 0.0087 helical.
    (check ISO 6336-1; valid in the subcritical range z1 v / 100 sqrt(u2/(1+u2)) < 10 m/s)."""
    kind = "spur" if P["beta_deg"] == 0 else "helical"
    K1 = _KV[kind][int(P["accuracy_grade"])]
    K2 = 0.0193 if kind == "spur" else 0.0087
    w = max(P["KA"] * F["Ft"] / P["b"], 100.0)
    return 1 + (K1 / w + K2) * P["z1"] * F["v"] / 100 * math.sqrt(g["u"] ** 2 / (1 + g["u"] ** 2))

def KFbeta(KHb, b, h):
    """K_Fbeta = K_Hbeta^N_F, N_F = (b/h)^2 / (1 + b/h + (b/h)^2)  (ISO 6336-3)."""
    r = b / h
    NF = r * r / (1 + r + r * r)
    return KHb ** NF

def ZH(g):
    """Zone factor Z_H = sqrt(2 cos(beta_b) cos(alpha_wt) / (cos^2(alpha_t) sin(alpha_wt)))."""
    return math.sqrt(2 * math.cos(g["bb"]) * math.cos(g["awt"]) / (math.cos(g["at"]) ** 2 * math.sin(g["awt"])))

def ZE(m1, m2):
    """Elasticity factor Z_E = sqrt(1 / (pi ((1 - nu1^2)/E1 + (1 - nu2^2)/E2)))  [sqrt(MPa)]."""
    return math.sqrt(1 / (math.pi * ((1 - m1["nu"] ** 2) / m1["E"] + (1 - m2["nu"] ** 2) / m2["E"])))

def Zeps(ea, eb):
    """Contact ratio factor: eb < 1: sqrt((4 - ea)/3 (1 - eb) + eb/ea); eb >= 1: sqrt(1/ea)."""
    if eb >= 1:
        return math.sqrt(1 / ea)
    return math.sqrt((4 - ea) / 3 * (1 - eb) + eb / ea)

def Zbeta(beta_deg):
    return 1 / math.sqrt(math.cos(math.radians(beta_deg)))

def form_factor_B(P, g, which=1):
    """Tooth form factor Y_F and stress correction factor Y_S, ISO 6336-3 method B (load at the outer point of single
    tooth contact, 30-degree tangent at the root fillet), external gear, generated with the basic rack.
    Returns Y_F, Y_S, s_Fn, h_Fe, rho_F, alpha_Fen."""
    mn = P["mn"]
    an = math.radians(P["alpha_n_deg"])
    z = P["z%d" % which]
    x = P["x%d" % which]
    zn = g["zn%d" % which]
    hfP, rhofP = P["hfP"] * mn, P["rhofP"] * mn
    E = math.pi / 4 * mn - hfP * math.tan(an) + 0 / math.cos(an) - (1 - math.sin(an)) * rhofP / math.cos(an)
    G = rhofP / mn - hfP / mn + x
    H = 2 / zn * (math.pi / 2 - E / mn) - math.pi / 3
    th = math.pi / 6
    for _ in range(200):
        th_new = 2 * G / zn * math.tan(th) - H
        if abs(th_new - th) < 1e-12:
            break
        th = th_new
    sFn = mn * (zn * math.sin(math.pi / 3 - th) + math.sqrt(3) * (G / math.cos(th) - rhofP / mn))
    rhoF = mn * (rhofP / mn + 2 * G * G / (math.cos(th) * (zn * math.cos(th) ** 2 - 2 * G)))
    # virtual gear for the outer point of single contact
    be = math.radians(P["beta_deg"])
    d = g["d%d" % which]
    da = g["da%d" % which]
    dn = mn * zn
    dbn = dn * math.cos(an)
    dan = dn + da - d
    ean = g["ea"] / math.cos(g["bb"]) ** 2
    den = 2 * math.sqrt((math.sqrt((dan / 2) ** 2 - (dbn / 2) ** 2) - math.pi * d * math.cos(be) * math.cos(an) / z * (ean - 1)) ** 2
                        + (dbn / 2) ** 2)
    aen = math.acos(dbn / den)
    ge = (math.pi / 2 + 2 * x * math.tan(an)) / zn + inv(an) - inv(aen)
    aFen = aen - ge
    hFe = 0.5 * mn * ((math.cos(ge) - math.sin(ge) * math.tan(aFen)) * den / mn - zn * math.cos(math.pi / 3 - th)
                      - G / math.cos(th) + rhofP / mn)
    YF = 6 * (hFe / mn) * math.cos(aFen) / ((sFn / mn) ** 2 * math.cos(an))
    L = sFn / hFe
    qs = sFn / (2 * rhoF)
    YS = (1.2 + 0.13 * L) * qs ** (1 / (1.21 + 2.3 / L))
    return {"YF": YF, "YS": YS, "sFn": sFn, "hFe": hFe, "rhoF": rhoF, "aFen_deg": math.degrees(aFen), "qs": qs}

def Ybeta(eb, beta_deg):
    """Helix angle factor (ISO 6336-3): Y_beta = 1 - eb* beta/120, eb* = min(eb, 1), beta* = min(beta, 30 deg)."""
    return 1 - min(eb, 1.0) * min(beta_deg, 30.0) / 120.0

# ---------------------------------------------------------------- chapter 5: load capacity
def capacity(P):
    g = geometry(P)
    F = forces(P, g)
    m1, m2 = MATERIALS[P["material1"]], MATERIALS[P["material2"]]
    KV = KV_factor(P, g, F)
    h = (P["haP"] + P["hfP"]) * P["mn"]
    KFb = KFbeta(P["KHbeta"], P["b"], h)
    K_H = P["KA"] * KV * P["KHbeta"] * P["KHalpha"]
    K_F = P["KA"] * KV * KFb * P["KHalpha"]
    zh, ze, zeps, zb = ZH(g), ZE(m1, m2), Zeps(g["ea"], g["eb"]), Zbeta(P["beta_deg"])
    sH0 = zh * ze * zeps * zb * math.sqrt(F["Ft"] / (g["d1"] * P["b"]) * (g["u"] + 1) / g["u"])
    sH = sH0 * math.sqrt(K_H)
    res = {"g": g, "F": F, "KV": KV, "KFbeta": KFb, "K_H": K_H, "K_F": K_F, "ZH": zh, "ZE": ze, "Zeps": zeps,
           "Zbeta": zb, "sH0": sH0, "sH": sH}
    Yb = Ybeta(g["eb"], P["beta_deg"])
    res["Ybeta"] = Yb
    for i, m in ((1, m1), (2, m2)):
        sHP = m["sHlim"] * P["ZLVR"] / 1.0          # Z_NT = Z_W = Z_X = 1 (long life, equal hardness) - check
        ff = form_factor_B(P, g, i)
        sF0 = F["Ft"] / (P["b"] * P["mn"]) * ff["YF"] * ff["YS"] * Yb
        sF = sF0 * K_F
        sFP = m["sFlim"] * 2.0 * 1.0                 # Y_ST = 2, Y_NT = Y_delta = Y_R = Y_X = 1 - check
        n = P["n1_rpm"] if i == 1 else F["n2"]
        res["gear%d" % i] = {"sHP_lim": sHP, "SH": sHP / sH, "ff": ff, "sF0": sF0, "sF": sF, "sFE": sFP,
                             "SF": sFP / sF, "N_cycles": n * 60 * P["life_h"],
                             "ok": sHP / sH >= P["SHmin"] and sFP / sF >= P["SFmin"]}
    return res

# ---------------------------------------------------------------- chapter 6: manufacturing data
def span_measurement(P, g, which=1, allowance_um=0.0):
    """Base tangent length over k teeth: W_k = mn cos(an) [ (k - 0.5) pi + z inv(at) + 2 x tan(an) ] + A_sn cos(an).
    k chosen so the measuring points lie near the middle of the flank (k = z at/pi*... rounded)."""
    mn, an = P["mn"], math.radians(P["alpha_n_deg"])
    z, x = P["z%d" % which], P["x%d" % which]
    be = math.radians(P["beta_deg"])
    at = g["at"]
    # contact at mid-flank: diameter ~ d + 2 x mn ; pressure angle there
    dm = g["d%d" % which] + 2 * x * mn
    amt = math.acos(g["db%d" % which] / dm)
    k = max(2, round(z / math.pi * (math.tan(amt) / math.cos(g["bb"]) ** 2 - 2 * x * math.tan(an) / z - inv(at)) + 0.5))
    W = mn * math.cos(an) * ((k - 0.5) * math.pi + z * inv(at) + 2 * x * math.tan(an))
    return {"k": k, "Wk": W + allowance_um / 1000 * math.cos(an), "Wk_nominal": W,
            "fits_face": W * math.sin(g["bb"]) < P["b"]}

def over_pins(P, g, which=1, DM=None, allowance_um=0.0):
    """Dimension over two pins / balls M_d. inv(aMt) = inv(at) + DM/(mn z cos an) - pi/(2 z) + 2 x tan(an)/z + A_sn term;
    dM = d cos(at)/cos(aMt); even z: M = dM + DM ; odd z: M = dM cos(90 deg / z) + DM (spur and helical with balls)."""
    mn, an = P["mn"], math.radians(P["alpha_n_deg"])
    z, x = P["z%d" % which], P["x%d" % which]
    DM = DM or round(1.68 * mn * 4) / 4
    s_add = allowance_um / 1000 / (mn * z)        # thickness allowance as an angle term (normal, small)
    y = inv(g["at"]) + DM / (mn * z * math.cos(an)) - math.pi / (2 * z) + 2 * x * math.tan(an) / z + s_add
    aMt = inv_inverse(y)
    dM = g["d%d" % which] * math.cos(g["at"]) / math.cos(aMt)
    M = dM + DM if z % 2 == 0 else dM * math.cos(math.pi / (2 * z)) + DM
    return {"DM": DM, "M": M, "aMt_deg": math.degrees(aMt)}

def backlash(P, g):
    """Circumferential backlash from the tooth thickness allowances and the centre distance tolerance:
    j_n = -(A_sn1 + A_sn2) cos... -> normal backlash j_n ~ -(A_sn1 + A_sn2) + 2 delta_a sin(alpha_wn) ; j_t = j_n /(cos awt cos bb)."""
    up, lo = P["tooth_thickness_allowance_um"]
    da = P["centre_distance_tol_um"]
    awn = math.atan(math.tan(g["awt"]) * math.cos(g["bb"]))
    jn_min = -(up + up) * math.cos(math.radians(P["alpha_n_deg"])) - 2 * da * math.sin(awn)
    jn_max = -(lo + lo) * math.cos(math.radians(P["alpha_n_deg"])) + 2 * da * math.sin(awn)
    f = 1 / (math.cos(g["awt"]) * math.cos(g["bb"]))
    return {"jn_min_um": jn_min, "jn_max_um": jn_max, "jt_min_um": jn_min * f, "jt_max_um": jn_max * f}

# ---------------------------------------------------------------- involute profile (for drawing / CAM check)
def involute_points(rb, ra, n=40):
    """Points of the involute from the base circle to the tip: x = rb (cos t + t sin t), y = rb (sin t - t cos t)."""
    tmax = math.sqrt((ra / rb) ** 2 - 1)
    return [(rb * (math.cos(t) + t * math.sin(t)), rb * (math.sin(t) - t * math.cos(t))) for t in
            (tmax * i / n for i in range(n + 1))]

# ---------------------------------------------------------------- report / run
def report_text(P):
    R = capacity(P)
    g, F = R["g"], R["F"]
    L = ["# Gear pair report - %s\n" % P["name"],
         "mn %.2f, z %d/%d, alpha_n %.1f, beta %.1f deg, x %.3f/%.3f, b %.1f mm; %s / %s" % (
             P["mn"], P["z1"], P["z2"], P["alpha_n_deg"], P["beta_deg"], P["x1"], P["x2"], P["b"], P["material1"], P["material2"]),
         "\n## Geometry",
         "- ratio u %.4f; d %.3f / %.3f; da %.3f / %.3f; df %.3f / %.3f; db %.3f / %.3f mm" % (
             g["u"], g["d1"], g["d2"], g["da1"], g["da2"], g["df1"], g["df2"], g["db1"], g["db2"]),
         "- a0 %.3f, a_w %.3f mm (x1 + x2 = %.4f, tip shortening k %.4f); alpha_t %.3f, alpha_wt %.3f, beta_b %.3f deg" % (
             g["a0"], g["aw"], g["xsum"], g["k"], math.degrees(g["at"]), math.degrees(g["awt"]), math.degrees(g["bb"])),
         "- contact ratios: eps_alpha %.3f, eps_beta %.3f, total %.3f; tip thickness s_a %.2f / %.2f mm (>= %.2f)" % (
             g["ea"], g["eb"], g["eg"], g["sa1"], g["sa2"], 0.25 * P["mn"]),
         "- undercut: x_min %.3f / %.3f (x %.3f / %.3f -> %s)" % (g["xmin1"], g["xmin2"], P["x1"], P["x2"],
                                                                  "OK" if P["x1"] >= g["xmin1"] and P["x2"] >= g["xmin2"] else "UNDERCUT"),
         "\n## Forces and speed",
         "- T1 %.2f N m, T2 %.2f N m; Ft %.0f N, Fr %.0f N, Fa %.0f N; v %.2f m/s; n2 %.1f rpm" % (
             F["T1"], F["T2"], F["Ft"], F["Fr"], F["Fa"], F["v"], F["n2"]),
         "\n## Load capacity (ISO 6336 style, simplified)",
         "- K_A %.2f, K_V %.3f, K_Hbeta %.2f, K_Fbeta %.3f, K_Halpha %.2f" % (P["KA"], R["KV"], P["KHbeta"], R["KFbeta"], P["KHalpha"]),
         "- Z_H %.3f, Z_E %.1f, Z_eps %.3f, Z_beta %.3f -> sigma_H0 %.0f MPa, sigma_H %.0f MPa" % (
             R["ZH"], R["ZE"], R["Zeps"], R["Zbeta"], R["sH0"], R["sH"]),
         "- Y_beta %.3f" % R["Ybeta"]]
    for i in (1, 2):
        q = R["gear%d" % i]
        L.append("- gear %d: Y_F %.3f, Y_S %.3f (s_Fn %.2f, h_Fe %.2f, rho_F %.2f mm); sigma_F %.0f MPa vs %.0f -> S_F %.2f;"
                 " pitting S_H %.2f; %s" % (i, q["ff"]["YF"], q["ff"]["YS"], q["ff"]["sFn"], q["ff"]["hFe"], q["ff"]["rhoF"],
                                            q["sF"], q["sFE"], q["SF"], q["SH"], "OK" if q["ok"] else "NOT OK"))
    L.append("\n## Manufacturing / inspection data")
    up, lo = P["tooth_thickness_allowance_um"]
    for i in (1, 2):
        w0 = span_measurement(P, g, i)
        wu, wl = span_measurement(P, g, i, up), span_measurement(P, g, i, lo)
        op = over_pins(P, g, i, P.get("pin_diameter_mm"))
        L.append("- gear %d: W_k over k = %d teeth %.3f mm nominal, with allowances %.3f ... %.3f mm; over pins/balls D_M %.2f: M %.3f mm" % (
            i, w0["k"], w0["Wk_nominal"], wl["Wk"], wu["Wk"], op["DM"], op["M"]))
    bl = backlash(P, g)
    L.append("- backlash (allowances + centre distance tol.): j_n %.0f ... %.0f um, j_t %.0f ... %.0f um" % (
        bl["jn_min_um"], bl["jn_max_um"], bl["jt_min_um"], bl["jt_max_um"]))
    return "\n".join(L)

def run(P, out):
    from crank import _svg_line
    os.makedirs(out, exist_ok=True)
    g = geometry(P)
    pts1 = involute_points(g["db1"] / 2, g["da1"] / 2)
    pts2 = involute_points(g["db2"] / 2, g["da2"] / 2)
    with open(os.path.join(out, "gear.csv"), "w", encoding="utf-8") as f:
        f.write("gear,x_mm,y_mm\n")
        for i, pts in ((1, pts1), (2, pts2)):
            for x, y in pts:
                f.write("%d,%.5f,%.5f\n" % (i, x, y))
    svg = _svg_line([("involute pinion", pts1, "#1f77b4"), ("involute wheel", pts2, "#d62728")],
                    title="Involute flank points from base to tip circle [mm]", xl="x", yl="y", polar=True)
    with open(os.path.join(out, "profile.svg"), "w", encoding="utf-8") as f:
        f.write(svg)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    print(rep)
    print("written: report.md, gear.csv, profile.svg ->", out)


# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2: standards, terms, materials
MODULES_I = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50]
MODULES_II = [1.125, 1.375, 1.75, 2.25, 2.75, 3.5, 4.5, 5.5, 7, 9, 11, 14, 18, 22, 28, 36, 45]

def next_module(m_req):
    """Next standard module >= m_req: series I (preferred) and series II (ISO 54 / DIN 780, check the standard)."""
    m1 = min((m for m in MODULES_I if m >= m_req - 1e-12), default=None)
    m2 = min((m for m in MODULES_II if m >= m_req - 1e-12), default=None)
    return {"series_I": m1, "series_II": m2}

BASIC_RACK = {   # ISO 53 profiles (factors of mn): h_aP, h_fP, rho_fP  (check the standard)
    "A": (1.0, 1.25, 0.38), "B": (1.0, 1.25, 0.30), "C": (1.0, 1.25, 0.25), "D": (1.0, 1.40, 0.39)}

def pitches(P):
    """Pitches and tooth heights from the basic rack: p = pi m, p_b = p cos(alpha), c = (h_fP - h_aP) m."""
    mn, an, be = P["mn"], math.radians(P["alpha_n_deg"]), math.radians(P["beta_deg"])
    at = math.atan(math.tan(an) / math.cos(be))
    mt = mn / math.cos(be)
    return {"pn": math.pi * mn, "pt": math.pi * mt, "pbn": math.pi * mn * math.cos(an), "pbt": math.pi * mt * math.cos(at),
            "ha": P["haP"] * mn, "hf": P["hfP"] * mn, "h": (P["haP"] + P["hfP"]) * mn, "c": (P["hfP"] - P["haP"]) * mn,
            "px": math.pi * mn / math.sin(be) if be else float("inf")}

def chd_recommendation(mn):
    """Typical case hardening depth (CHD at 550 HV) ~ 0.15 ... 0.20 mn (rule of thumb, check ISO 6336-5 / supplier)."""
    return {"CHD_min": 0.15 * mn, "CHD_max": 0.20 * mn}

# ---------------------------------------------------------------- chapter 3: sliding along the path of contact
def contact_points(P, g):
    """Distances along the line of action measured from T1 (tangent point on the pinion base circle):
    T1T2 = a_w sin(a_wt); start of contact A: rho2 = sqrt(ra2^2 - rb2^2) -> rho1_A = T1T2 - rho2;
    end of contact E: rho1_E = sqrt(ra1^2 - rb1^2); pitch point C: rho1_C = r_w1 sin(a_wt)."""
    T1T2 = g["aw"] * math.sin(g["awt"])
    r2a = math.sqrt((g["da2"] / 2) ** 2 - (g["db2"] / 2) ** 2)
    r1e = math.sqrt((g["da1"] / 2) ** 2 - (g["db1"] / 2) ** 2)
    rw1 = g["aw"] / (1 + g["u"])
    return {"T1T2": T1T2, "A": T1T2 - r2a, "E": r1e, "C": rw1 * math.sin(g["awt"])}

def specific_sliding(P, g, rho1):
    """Specific sliding at a contact point with pinion radius of curvature rho1 (transverse plane):
    v1 = w1 rho1, v2 = w2 rho2 = w1 rho2/u -> zeta1 = 1 - rho2/(u rho1), zeta2 = 1 - u rho1/rho2."""
    cp = contact_points(P, g)
    rho2 = cp["T1T2"] - rho1
    u = g["u"]
    return {"rho1": rho1, "rho2": rho2, "zeta1": 1 - rho2 / (u * rho1), "zeta2": 1 - u * rho1 / rho2}

def sliding_table(P):
    """Specific sliding at A (pinion root / wheel tip), C (pitch point) and E (pinion tip / wheel root),
    and the sliding velocity v_g = (w1 + w2) * distance from C."""
    g = geometry(P)
    cp = contact_points(P, g)
    w1 = P["n1_rpm"] * 2 * math.pi / 60
    w2 = w1 / g["u"]
    out = {}
    for k in ("A", "C", "E"):
        s = specific_sliding(P, g, cp[k])
        s["vg"] = (w1 + w2) * abs(cp[k] - cp["C"]) / 1000          # m/s
        out[k] = s
    return out

def balance_x1(P, xsum):
    """x1 (with x2 = xsum - x1) for equal specific sliding at the two roots: |zeta1(A)| = |zeta2(E)| (bisection)."""
    def f(x1):
        Q = dict(P, x1=x1, x2=xsum - x1)
        t = sliding_table(Q)
        return abs(t["A"]["zeta1"]) - abs(t["E"]["zeta2"])
    lo, hi = -0.5, 1.0
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if f(lo) * f(mid) <= 0:
            hi = mid
        else:
            lo = mid
    x1 = 0.5 * (lo + hi)
    t = sliding_table(dict(P, x1=x1, x2=xsum - x1))
    return {"x1": x1, "x2": xsum - x1, "zeta1_root": t["A"]["zeta1"], "zeta2_root": t["E"]["zeta2"]}

# ---------------------------------------------------------------- chapter 4: efficiency, shaft/bearing hand-over
def mesh_loss(P, mu_m=0.05):
    """Tooth mesh power loss (Ohlendorf / Niemann): P_V = P mu_m H_V with the gear loss factor
    H_V = pi (u + 1) / (z1 u cos(beta_b)) (1 - eps_a + eps_1^2 + eps_2^2), eps_1 = E-side, eps_2 = A-side addendum
    contact ratios. mu_m ~ 0.04 ... 0.07 for mineral oil (check). eta = 1 - mu_m H_V."""
    g = geometry(P)
    cp = contact_points(P, g)
    e1 = (cp["E"] - cp["C"]) / g["pbt"]            # recess (pinion tip side)
    e2 = (cp["C"] - cp["A"]) / g["pbt"]            # approach
    HV = math.pi * (g["u"] + 1) / (P["z1"] * g["u"] * math.cos(g["bb"])) * (1 - g["ea"] + e1 ** 2 + e2 ** 2)
    PV = P["P_kW"] * 1000 * mu_m * HV
    return {"eps1": e1, "eps2": e2, "HV": HV, "PV_W": PV, "eta": 1 - mu_m * HV}

def pinion_shaft_loads(P, L=100.0, a=50.0):
    """Bearing reactions of the pinion shaft: bearings at x = 0 (A, locating) and x = L (B), pinion at x = a.
    Planes: y = radial Fr (towards the wheel centre) + couple from the axial force Fa d1/2; z = tangential Ft.
    Moment balance about A: R_B L = F a +/- Fa d1/2. A carries Fa (locating). Cross-check of the Ft/Fr part with
    shaft.reactions()."""
    import shaft
    g = geometry(P)
    F = forces(P, g)
    Mfa = F["Fa"] * g["d1"] / 2                          # N mm couple in the y-plane
    RBy = -(-F["Fr"] * a + Mfa) / L                      # forces: -Fr at x = a (y), couple +Mfa
    RAy = F["Fr"] - RBy
    RBz = F["Ft"] * a / L
    RAz = F["Ft"] - RBz
    S = dict(shaft.DEFAULT, segments=[[L, 30, 0]], bearings=[0.0, L], forces=[[a, -F["Fr"], -F["Ft"], "gear"]])
    R = shaft.reactions(S)
    check = abs(R["z"][1] - RBz) < 1e-9 and abs(R["y"][0] + R["y"][1] - F["Fr"]) < 1e-9
    return {"Mfa_Nm": Mfa / 1000, "RA": math.hypot(RAy, RAz), "RB": math.hypot(RBy, RBz), "RAy": RAy, "RAz": RAz,
            "RBy": RBy, "RBz": RBz, "Fa": F["Fa"], "shaft_check": check}

def bearing_handover(P, L=100.0, a=50.0):
    """Feed the pinion shaft reactions into bearing.py: A = 6206 (locating, takes Fa) or 30206; B = 6206 or NU206 floating."""
    import bearing
    r = pinion_shaft_loads(P, L, a)
    BP = dict(bearing.DEFAULT, oil_VG=68, oil_temp_C=70.0, cleanliness="normal cleanliness")
    out = {}
    for name, Fr, Fa in (("6206", r["RA"], r["Fa"]), ("30206", r["RA"], r["Fa"]), ("6206 B", r["RB"], 0.0), ("NU206 B", r["RB"], 0.0)):
        b = bearing.CATALOGUE[name.split()[0]]
        eq = bearing.equivalent_dynamic(b, Fr, Fa)
        ml = bearing.modified_life(b, eq["P"], P["n1_rpm"], BP)
        out[name] = {"Fr": Fr, "Fa": Fa, "P": eq["P"], "X": eq["X"], "Y": eq["Y"], "L10h": ml["L10h"], "Lnmh": ml["Lnmh"],
                     "kappa": ml["kappa"], "a_iso": ml["a_iso"]}
    return r, out

def demo_ch24():
    P = dict(DEFAULT)
    print("== 2.1 next standard module")
    for m in (1.83, 2.1, 2.6, 3.7):
        print("  m_req %.2f -> series I %s, series II %s" % (m, next_module(m)["series_I"], next_module(m)["series_II"]))
    pt = pitches(P)
    print("== 2.2 pitches and heights (default mn 2, beta 15)")
    print("  p_n %.4f, p_t %.4f, p_bn %.4f, p_bt %.4f, axial pitch p_x %.3f mm; h_a %.2f, h_f %.2f, h %.2f, c %.2f mm" % (
        pt["pn"], pt["pt"], pt["pbn"], pt["pbt"], pt["px"], pt["ha"], pt["hf"], pt["h"], pt["c"]))
    for k, v in BASIC_RACK.items():
        print("  ISO 53 profile %s: h_aP %.2f, h_fP %.2f, rho_fP %.2f (x mn)" % (k, *v))
    c = chd_recommendation(P["mn"])
    print("== 2.3 case hardening depth for mn %.1f: %.2f ... %.2f mm" % (P["mn"], c["CHD_min"], c["CHD_max"]))
    g = geometry(P)
    print("== 3.1 involute check: base radius %.4f mm, 5 points (x, y):" % (g["db1"] / 2),
          ", ".join("(%.3f, %.3f)" % q for q in involute_points(g["db1"] / 2, g["da1"] / 2, 4)))
    print("  inv(20 deg) = %.6f, inv(alpha_t) = %.6f, inv(alpha_wt) = %.6f; inv_inverse(0.0149044) = %.4f deg" % (
        inv(math.radians(20)), inv(g["at"]), inv(g["awt"]), math.degrees(inv_inverse(0.0149044))))
    print("  z_min (x = 0, beta 15) = %.2f; spur z_min = %.2f" % (g["zmin"], geometry(dict(P, beta_deg=0.0))["zmin"]))
    cp = contact_points(P, g)
    print("== 3.2 line of action: T1T2 %.3f, A %.3f, C %.3f, E %.3f mm; g_alpha %.3f mm; p_bt %.4f -> eps_alpha %.3f" % (
        cp["T1T2"], cp["A"], cp["C"], cp["E"], cp["E"] - cp["A"], g["pbt"], (cp["E"] - cp["A"]) / g["pbt"]))
    st = sliding_table(P)
    print("== 3.3 specific sliding (default x 0.25 / -0.10)")
    for k in ("A", "C", "E"):
        s = st[k]
        print("  %s: rho1 %.3f, rho2 %.3f mm, zeta1 %+.3f, zeta2 %+.3f, v_g %.3f m/s" % (k, s["rho1"], s["rho2"], s["zeta1"], s["zeta2"], s["vg"]))
    for xs in (0.0, 0.15, 0.5):
        b = balance_x1(P, xs)
        print("  balanced sliding for x1 + x2 = %.2f: x1 %.3f, x2 %.3f (zeta1 root %.3f, zeta2 root %.3f)" % (
            xs, b["x1"], b["x2"], b["zeta1_root"], b["zeta2_root"]))
    st0 = sliding_table(dict(P, x1=0.0, x2=0.15))
    print("  for comparison x1 0, x2 0.15: zeta1 root %.3f, zeta2 root %.3f" % (st0["A"]["zeta1"], st0["E"]["zeta2"]))
    F = forces(P, g)
    print("== 4.1 forces: T1 %.2f N m, Ft %.1f, Fr %.1f, Fa %.1f, Fn %.1f N, v %.3f m/s" % (F["T1"], F["Ft"], F["Fr"], F["Fa"], F["Fn"], F["v"]))
    for mu in (0.04, 0.05, 0.07):
        ml = mesh_loss(P, mu)
        print("== 4.2 mesh loss mu_m %.2f: eps1 %.3f, eps2 %.3f, H_V %.4f -> P_V %.0f W, eta %.4f" % (
            mu, ml["eps1"], ml["eps2"], ml["HV"], ml["PV_W"], ml["eta"]))
    r, b = bearing_handover(P)
    print("== 4.3 pinion shaft (bearings 0 / 100 mm, gear at 50): couple Fa d1/2 %.2f N m; A: y %.1f z %.1f -> %.1f N;"
          " B: y %.1f z %.1f -> %.1f N; Fa %.1f N on A; shaft.py check %s" % (
              r["Mfa_Nm"], r["RAy"], r["RAz"], r["RA"], r["RBy"], r["RBz"], r["RB"], r["Fa"], r["shaft_check"]))
    for k, v in b.items():
        print("  %-7s Fr %.0f Fa %.0f -> P %.0f N (X %.2f Y %.2f), L10h %.0f, kappa %.2f, a_ISO %.2f, L_nm %.0f h" % (
            k, v["Fr"], v["Fa"], v["P"], v["X"], v["Y"], v["L10h"], v["kappa"], v["a_iso"], v["Lnmh"]))

# ================================================================ added with guide chapters (ch5)
KA_TABLE = {   # typical application factors (driving machine x driven machine), ISO 6336-6 annex style - check
    "electric motor -> uniform (generator, conveyor belt, fan)": 1.00,
    "electric motor -> light shocks (machine tool main drive, pumps)": 1.25,
    "electric motor -> moderate shocks (piston compressor, mixer, hoist)": 1.50,
    "electric motor -> heavy shocks (crusher, press, rolling mill)": 1.75,
    "multi-cylinder engine -> moderate shocks": 1.75,
}

def resonance_ratio(P, rho=7.83e-6, c_gamma=20.0):
    """Main resonance speed of the pinion n_E1 = 30000/(pi z1) sqrt(c_gamma / m_red) [rpm] and N = n1 / n_E1.
    m_i* = pi/8 (dm_i/db_i)^2 dm_i^2 rho (kg/mm, per mm face width, solid gears, dm ~ (da + df)/2),
    1/m_red = 1/m1* + 1/m2* (masses reduced to the line of action). c_gamma ~ 20 N/(mm um) for steel (check ISO 6336-1)."""
    g = geometry(P)
    def mstar(i):
        dm = (g["da%d" % i] + g["df%d" % i]) / 2
        return math.pi / 8 * (dm / g["db%d" % i]) ** 2 * dm ** 2 * rho
    m1, m2 = mstar(1), mstar(2)
    mred = m1 * m2 / (m1 + m2)
    nE1 = 30000 / (math.pi * P["z1"]) * math.sqrt(c_gamma / mred)
    N = P["n1_rpm"] / nE1
    zone = "subcritical (N <= 0.85)" if N <= 0.85 else ("main resonance - avoid (0.85 < N <= 1.15)" if N <= 1.15 else "intermediate / supercritical")
    return {"m1": m1, "m2": m2, "m_red": mred, "nE1": nE1, "N": N, "zone": zone}

def KHbeta_estimate(P, F_betay_um, c_gamma=20.0):
    """Face load factor from an effective mesh misalignment F_beta_y (um), method C style (check ISO 6336-1):
    F_m/b = F_t K_A K_V / b ;  if F_betay c_gamma / (2 F_m/b) <= 1: K_Hbeta = 1 + F_betay c_gamma / (2 F_m/b)
    else K_Hbeta = sqrt(2 F_betay c_gamma / (F_m/b))."""
    g = geometry(P)
    F = forces(P, g)
    KV = KV_factor(P, g, F)
    w = F["Ft"] * P["KA"] * KV / P["b"]
    q = F_betay_um * c_gamma / (2 * w)
    K = 1 + q if q <= 1 else math.sqrt(2 * F_betay_um * c_gamma / w)
    return {"Fm_b": w, "q": q, "KHbeta": K}

def _loginterp(N, pts):
    if N <= pts[0][0]:
        return pts[0][1]
    for (n1, v1), (n2, v2) in zip(pts, pts[1:]):
        if N <= n2:
            t = (math.log10(N) - math.log10(n1)) / (math.log10(n2) - math.log10(n1))
            return v1 + t * (v2 - v1)
    return pts[-1][1]

def ZNT(N):
    """Life factor for pitting, case hardened / nitrided steels (log interpolation of typical ISO 6336-2 points;
    the 1e10 value 0.85 applies to 'normal' conditions, up to 1.0 with optimum lubrication/material - check)."""
    return _loginterp(N, [(1e5, 1.6), (5e7, 1.0), (1e10, 0.85)])

def YNT(N):
    """Life factor for tooth root, case hardened steels (typical ISO 6336-3 points - check)."""
    return _loginterp(N, [(1e3, 2.5), (3e6, 1.0), (1e10, 0.85)])

def life_effect(P):
    """Safeties with life factors for the design life (pinion and wheel)."""
    R = capacity(P)
    out = {}
    for i in (1, 2):
        q = R["gear%d" % i]
        N = q["N_cycles"]
        zn, yn = ZNT(N), YNT(N)
        out[i] = {"N": N, "ZNT": zn, "YNT": yn, "SH": q["SH"] * zn, "SF": q["SF"] * yn}
    return out

def form_factor_steps(P, which=1):
    """Same equations as form_factor_B() but returns every intermediate value (for the walkthrough)."""
    g = geometry(P)
    mn = P["mn"]
    an = math.radians(P["alpha_n_deg"])
    z, x, zn = P["z%d" % which], P["x%d" % which], g["zn%d" % which]
    hfP, rhofP = P["hfP"] * mn, P["rhofP"] * mn
    E = math.pi / 4 * mn - hfP * math.tan(an) - (1 - math.sin(an)) * rhofP / math.cos(an)
    G = rhofP / mn - hfP / mn + x
    H = 2 / zn * (math.pi / 2 - E / mn) - math.pi / 3
    th, it = math.pi / 6, 0
    for it in range(1, 201):
        th_new = 2 * G / zn * math.tan(th) - H
        if abs(th_new - th) < 1e-12:
            th = th_new
            break
        th = th_new
    ff = form_factor_B(P, g, which)
    return {"zn": zn, "E": E, "G": G, "H": H, "theta_deg": math.degrees(th), "iterations": it, **ff}

def methodC_compare(P, which=1):
    """Method B Y_F Y_S vs DIN-type method C Y_Fa Y_Sa Y_eps (textbook Y_Fa Y_Sa ~ 4.35 at z 20, x 0)."""
    g = geometry(P)
    ff = form_factor_B(P, g, which)
    yeps = 0.25 + 0.75 / g["ea"]
    return {"YFYS": ff["YF"] * ff["YS"], "Yeps": yeps, "ref": 4.35 * yeps}

def _safeties(P):
    R = capacity(P)
    return R["gear1"]["SH"], min(R["gear1"]["SF"], R["gear2"]["SF"]), R

def module_study(a_target=82.083, mns=(1.75, 2.0, 2.5, 3.0), x1=0.25):
    """Different modules at (nearly) the same centre distance and ratio ~3.16: z from the centre distance,
    a_w fixed, x2 = (x1 + x2) - x1 with x1 + x2 from a_w."""
    rows = []
    be = math.radians(DEFAULT["beta_deg"])
    for mn in mns:
        zs = 2 * a_target * math.cos(be) / mn
        z1 = round(zs / (1 + 60 / 19))
        z2 = int(math.floor(zs - z1))
        P = dict(DEFAULT, mn=mn, z1=z1, z2=z2, a_w=a_target, x1=x1, x2=0.0)
        xs = geometry(P)["xsum"]
        P["x2"] = xs - x1
        SH, SF, R = _safeties(P)
        rows.append({"mn": mn, "z1": z1, "z2": z2, "u": z2 / z1, "x2": P["x2"], "ea": R["g"]["ea"], "SH": SH, "SF": SF})
    return rows

def width_study(bs=(20, 28, 36, 45)):
    rows = []
    for b in bs:
        SH, SF, R = _safeties(dict(DEFAULT, b=float(b)))
        rows.append({"b": b, "KFbeta": R["KFbeta"], "eb": R["g"]["eb"], "SH": SH, "SF": SF})
    return rows

def helix_study(betas=(0, 8, 15, 20, 25)):
    rows = []
    for be in betas:
        SH, SF, R = _safeties(dict(DEFAULT, beta_deg=float(be)))
        rows.append({"beta": be, "ea": R["g"]["ea"], "eb": R["g"]["eb"], "Zeps": R["Zeps"], "Zbeta": R["Zbeta"],
                     "Fa": R["F"]["Fa"], "SH": SH, "SF": SF})
    return rows

def material_study():
    rows = []
    for m in ("42CrMo4 QT", "42CrMo4 induction hardened", "42CrMo4 nitrided", "16MnCr5 case hardened", "18CrNiMo7-6 case hardened"):
        SH, SF, R = _safeties(dict(DEFAULT, material1=m, material2=m))
        rows.append({"mat": m, "SH": SH, "SF": SF})
    return rows

def max_power(P, SH_req=1.0, SF_req=1.4):
    """Largest power (kW) for S_H >= SH_req and for S_F >= SF_req (bisection; each criterion separately)."""
    def solve(key):
        lo, hi = 0.1, 500.0
        for _ in range(60):
            mid = 0.5 * (lo + hi)
            SH, SF, _ = _safeties(dict(P, P_kW=mid))
            okk = SH >= SH_req if key == "H" else SF >= SF_req
            lo, hi = (mid, hi) if okk else (lo, mid)
        return lo
    return {"P_pitting_kW": solve("H"), "P_root_kW": solve("F")}

def flash_temperature(P, mu=0.06, theta_oil=80.0, B=12900.0):
    """Blok flash temperature at the pinion tip (start of recess side contact), line contact, equal materials (check):
    dT = 1.11 mu w' |v1 - v2| / (B sqrt(b_H) (sqrt(v1) + sqrt(v2)))
    w' = normal load per unit length (N/m), v1, v2 = surface velocities along the profile (m/s),
    b_H = Hertz half width (m) = sqrt(4 w' R / (pi E*)), B = sqrt(lambda rho c) ~ 12 900 for steel."""
    g = geometry(P)
    F = forces(P, g)
    KV = KV_factor(P, g, F)
    w1 = 2 * math.pi * P["n1_rpm"] / 60
    w2 = w1 / g["u"]
    rb1, rb2 = g["db1"] / 2, g["db2"] / 2
    rho1 = math.sqrt((g["da1"] / 2) ** 2 - rb1 ** 2)                  # mm, at the pinion tip
    rho2 = g["aw"] * math.sin(g["awt"]) - rho1
    v1, v2 = w1 * rho1 / 1000, w2 * rho2 / 1000                      # m/s
    Fbn = F["Ft"] * P["KA"] * KV / (math.cos(g["awt"]) * math.cos(g["bb"]))
    w_line = Fbn / (P["b"] / math.cos(g["bb"])) * 1000               # N/m over the contact length ~ b / cos(beta_b)
    R = (rho1 * rho2 / (rho1 + rho2)) / math.cos(g["bb"]) / 1000      # normal radius (m)
    Estar = 1 / (2 * (1 - 0.3 ** 2) / 206e9)
    bH = math.sqrt(4 * w_line * R / (math.pi * Estar))
    dT = 1.11 * mu * w_line * abs(v1 - v2) / (B * math.sqrt(bH) * (math.sqrt(v1) + math.sqrt(v2)))
    return {"v1": v1, "v2": v2, "vg": abs(v1 - v2), "w_line_Nmm": w_line / 1000, "bH_mm": bH * 1000, "dT": dT,
            "T_contact": theta_oil + dT}

def film_thickness(P, VG=220, T=80.0, alpha_p=2.0e-8, Rq=0.5):
    """Minimum film thickness at the pitch point, Dowson-Higginson line contact (check):
    h_min = 2.65 R (eta0 u / (E' R))^0.7 (alpha E')^0.54 (w' / (E' R))^-0.13 ; lambda = h_min / (sqrt(2) Rq).
    E' = E/(1 - nu^2) (= 2 E* in this notation), u = mean rolling speed, Rq = rms roughness of one flank (um)."""
    from bearing import nu_from_VG
    g = geometry(P)
    F = forces(P, g)
    nu = nu_from_VG(VG, T)
    eta = nu * 1e-6 * 870.0                                         # Pa s (oil density 870 kg/m3)
    w1 = 2 * math.pi * P["n1_rpm"] / 60
    r1 = g["d1"] / 2 * math.sin(g["awt"]) / 1000
    r2 = g["d2"] / 2 * math.sin(g["awt"]) / 1000
    u = w1 * r1                                                     # rolling speed at the pitch point (both equal)
    R = (r1 * r2 / (r1 + r2)) / math.cos(g["bb"])
    Ep = 206e9 / (1 - 0.3 ** 2)
    wl = F["Ft"] / (math.cos(g["awt"]) * math.cos(g["bb"])) / (P["b"] / math.cos(g["bb"]) / 1000)
    h = 2.65 * R * (eta * u / (Ep * R)) ** 0.7 * (alpha_p * Ep) ** 0.54 * (wl / (Ep * R)) ** -0.13
    lam = h * 1e6 / (math.sqrt(2) * Rq)
    return {"nu": nu, "eta": eta, "u": u, "h_um": h * 1e6, "lambda": lam}

VG_BY_SPEED = [   # rough guide for case-hardened industrial gears, mineral oil, ~40 C ambient (check DIN 51509 / AGMA 9005)
    (1.0, "VG 460 - 680"), (2.5, "VG 320 - 460"), (5.0, "VG 220 - 320"), (10.0, "VG 150 - 220"), (25.0, "VG 68 - 150")]

def vg_for_speed(v):
    for vmax, txt in VG_BY_SPEED:
        if v <= vmax:
            return txt
    return "VG 32 - 68 (spray lubrication)"

def demo_ch5():
    P = dict(DEFAULT)
    R = capacity(P)
    g, F = R["g"], R["F"]
    print("== 5.2 application factors (typical)")
    for k, v in KA_TABLE.items():
        print("  %-70s K_A %.2f" % (k, v))
    print("== 5.3 dynamic factor and resonance")
    rr = resonance_ratio(P)
    print("  m1* %.3e, m2* %.3e, m_red %.3e kg/mm; n_E1 %.0f rpm; N = n1/n_E1 = %.3f -> %s" % (
        rr["m1"], rr["m2"], rr["m_red"], rr["nE1"], rr["N"], rr["zone"]))
    print("  K_V (grade %d) = %.4f; grade 8: %.4f; spur (beta 0, grade 6): %.4f" % (
        P["accuracy_grade"], R["KV"], capacity(dict(P, accuracy_grade=8))["KV"], capacity(dict(P, beta_deg=0.0))["KV"]))
    print("== 5.4 face load factor")
    for fb in (5, 10, 15, 25, 40):
        k = KHbeta_estimate(P, fb)
        print("  F_betay %2d um: F_m/b %.1f N/mm, q %.3f -> K_Hbeta %.3f, K_Fbeta %.3f" % (
            fb, k["Fm_b"], k["q"], k["KHbeta"], KFbeta(k["KHbeta"], P["b"], (P["haP"] + P["hfP"]) * P["mn"])))
    h = (P["haP"] + P["hfP"]) * P["mn"]
    r = P["b"] / h
    print("  b/h = %.3f -> N_F = %.4f; K_Fbeta = 1.25^N_F = %.4f" % (r, r * r / (1 + r + r * r), R["KFbeta"]))
    print("== 5.5 pitting")
    print("  Ft %.1f N, d1 %.3f, b %.1f, u %.4f -> sqrt(Ft/(d1 b) (u+1)/u) = %.3f" % (
        F["Ft"], g["d1"], P["b"], g["u"], math.sqrt(F["Ft"] / (g["d1"] * P["b"]) * (g["u"] + 1) / g["u"])))
    print("  Z_H %.4f, Z_E %.2f, Z_eps %.4f, Z_beta %.4f -> sigma_H0 %.1f MPa; K_H = K_A K_V K_Hb K_Ha = %.4f -> sigma_H %.1f MPa" % (
        R["ZH"], R["ZE"], R["Zeps"], R["Zbeta"], R["sH0"], R["K_H"], R["sH"]))
    print("  sigma_HP (Z_NT=1) %.0f MPa -> S_H %.3f" % (R["gear1"]["sHP_lim"], R["gear1"]["SH"]))
    print("== 5.6 life factors (20 000 h)")
    for i, q in life_effect(P).items():
        print("  gear %d: N %.3e -> Z_NT %.3f, Y_NT %.3f; S_H %.3f, S_F %.3f" % (i, q["N"], q["ZNT"], q["YNT"], q["SH"], q["SF"]))
    for N in (1e5, 1e6, 1e7, 5e7, 1e9, 1e10):
        print("  N %.0e: Z_NT %.3f, Y_NT %.3f" % (N, ZNT(N), YNT(N)))
    print("== 5.7 form factor walkthrough (pinion)")
    s = form_factor_steps(P, 1)
    print("  z_n %.3f, E %.4f mm, G %.4f, H %.4f, theta %.3f deg (%d iterations)" % (s["zn"], s["E"], s["G"], s["H"], s["theta_deg"], s["iterations"]))
    print("  s_Fn %.3f mm, rho_F %.3f mm, h_Fe %.3f mm, alpha_Fen %.3f deg, q_s %.3f -> Y_F %.4f, Y_S %.4f" % (
        s["sFn"], s["rhoF"], s["hFe"], s["aFen_deg"], s["qs"], s["YF"], s["YS"]))
    s2 = form_factor_steps(P, 2)
    print("  wheel: z_n %.3f, theta %.3f deg, s_Fn %.3f, rho_F %.3f, h_Fe %.3f -> Y_F %.4f, Y_S %.4f" % (
        s2["zn"], s2["theta_deg"], s2["sFn"], s2["rhoF"], s2["hFe"], s2["YF"], s2["YS"]))
    print("  Y_beta = 1 - min(eb,1) beta/120 = %.4f" % R["Ybeta"])
    q1 = R["gear1"]
    print("  sigma_F0 = Ft/(b mn) Y_F Y_S Y_beta = %.1f MPa; K_F %.4f -> sigma_F %.1f; sigma_FE = 2 x 500 = %.0f -> S_F %.3f" % (
        q1["sF0"], R["K_F"], q1["sF"], q1["sFE"], q1["SF"]))
    S = dict(DEFAULT, mn=1.0, z1=20, z2=40, x1=0.0, x2=0.0, beta_deg=0.0, b=10.0)
    mc = methodC_compare(S, 1)
    print("  method B vs C (z 20, x 0, spur): Y_F Y_S %.3f vs Y_Fa Y_Sa Y_eps = 4.35 x %.4f = %.3f" % (mc["YFYS"], mc["Yeps"], mc["ref"]))
    print("== 5.9 sensitivity")
    for r_ in module_study():
        print("  mn %.2f: z %d/%d (u %.3f), x2 %+.3f, eps_a %.3f -> S_H %.3f, S_F %.3f" % (r_["mn"], r_["z1"], r_["z2"], r_["u"], r_["x2"], r_["ea"], r_["SH"], r_["SF"]))
    for r_ in width_study():
        print("  b %2d: K_Fb %.3f, eps_b %.3f -> S_H %.3f, S_F %.3f" % (r_["b"], r_["KFbeta"], r_["eb"], r_["SH"], r_["SF"]))
    for r_ in helix_study():
        print("  beta %2d: eps_a %.3f eps_b %.3f Z_eps %.3f Z_beta %.3f Fa %.0f N -> S_H %.3f, S_F %.3f" % (
            r_["beta"], r_["ea"], r_["eb"], r_["Zeps"], r_["Zbeta"], r_["Fa"], r_["SH"], r_["SF"]))
    for r_ in material_study():
        print("  %-28s S_H %.3f, S_F %.3f" % (r_["mat"], r_["SH"], r_["SF"]))
    mp = max_power(P)
    print("  max power: S_H >= 1.0 -> %.2f kW; S_F >= 1.4 -> %.2f kW" % (mp["P_pitting_kW"], mp["P_root_kW"]))
    print("== 5.10 scuffing / micropitting")
    ft = flash_temperature(P)
    print("  pinion tip: v1 %.3f, v2 %.3f, sliding %.3f m/s; w' %.1f N/mm; b_H %.4f mm -> flash %.1f K, contact %.1f C" % (
        ft["v1"], ft["v2"], ft["vg"], ft["w_line_Nmm"], ft["bH_mm"], ft["dT"], ft["T_contact"]))
    for vg in (150, 220, 320):
        fm = film_thickness(P, VG=vg)
        print("  VG %d at 80 C: nu %.1f mm2/s, u %.3f m/s -> h_min %.3f um, lambda %.2f (Rq 0.5 um)" % (vg, fm["nu"], fm["u"], fm["h_um"], fm["lambda"]))
    print("  oil choice for v %.2f m/s: %s" % (F["v"], vg_for_speed(F["v"])))

# ================================================================ added with guide chapters (ch68)
def backlash_thermal(P, g, dT_gear=40.0, dT_housing=25.0, alpha_gear=11.5e-6, alpha_housing=23e-6):
    """Change of normal backlash by temperature: the centre distance grows with the housing, the gears grow with
    their own temperature. delta_a = a_w (alpha_h dT_h) - (d1 + d2)/2 (alpha_g dT_g) [mm]
    (gear growth acts on the pitch radii). delta_j_n = 2 delta_a sin(alpha_wn) [mm]. Positive = more backlash.
    Default: aluminium housing 25 K warmer than assembly, steel gears 40 K warmer (example values)."""
    awn = math.atan(math.tan(g["awt"]) * math.cos(g["bb"]))
    da = g["aw"] * alpha_housing * dT_housing - (g["d1"] + g["d2"]) / 2 * alpha_gear * dT_gear
    dj = 2 * da * math.sin(awn) * 1000
    b0 = backlash(P, g)
    return {"delta_a_um": da * 1000, "delta_jn_um": dj, "jn_min_hot": b0["jn_min_um"] + dj, "jn_max_hot": b0["jn_max_um"] + dj}


def iso1328_2013(mn, d, b, A):
    """Flank tolerances ISO 1328-1:2013 (values in um, grade A, step factor sqrt(2) per grade, base grade 5).
    f_pT and F_pT: formulas as published in ISO 1328-1:2013 (check the standard).
    F_alphaT, F_betaT: APPROXIMATION in the style of the 2013 formulas (check the standard before use).
    F_rT (runout, ISO 1328-2 relation): ~0.9 F_pT (approximation)."""
    k = math.sqrt(2) ** (A - 5)
    fpt = (0.001 * d + 0.4 * mn + 5) * k
    Fp = (0.002 * d + 0.55 * math.sqrt(d) + 0.7 * mn + 12) * k
    Fa = (0.55 * math.sqrt(mn) + 5) * k * 1.0 + 0.0          # approximation
    Fb = (0.07 * math.sqrt(d) + 0.45 * math.sqrt(b) + 4) * k   # approximation
    return {"fpT": fpt, "FpT": Fp, "FalphaT": Fa, "FbetaT": Fb, "FrT": 0.9 * Fp}


def tip_relief(Ft, b, KA=1.0, c_prime=14.0):
    """Tip relief amount ~ tooth deflection under load: C_a = K_A F_t / (b c') [um], c' single-tooth stiffness
    ~ 14 N/(mm um) for steel spur teeth (typical; check ISO 6336-1 / Niemann)."""
    return KA * Ft / (b * c_prime)


def crowning(f_ma=8.0, f_sh=6.0):
    """Helix crowning C_beta ~ 0.5 (f_ma + f_sh): manufacturing misalignment f_ma plus shaft/housing deflection f_sh
    (um, example values; check ISO 6336-1 annex / supplier practice)."""
    return 0.5 * (f_ma + f_sh)


ISO54 = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20]   # module series I (preferred)


def presize_d1(T1_Nm, u, sHP, K=1.64, psi_d=0.8, ZH_=2.45, ZE_=189.8, Zeps_=0.80, Zbeta_=1.0):
    """Pitting pre-size of the pinion: d1 >= cbrt( 2 K T1 (u + 1) / (psi_d u) (Z_H Z_E Z_eps Z_beta / sigma_HP)^2 ) [mm]
    (from sigma_H = Z.. sqrt(F_t/(d1 b) (u+1)/u K) <= sigma_HP with F_t = 2 T1/d1 and b = psi_d d1)."""
    T = T1_Nm * 1000.0
    return (2 * K * T * (u + 1) / (psi_d * u) * (ZH_ * ZE_ * Zeps_ * Zbeta_ / sHP) ** 2) ** (1 / 3)


EXAMPLE = {
    "name": "Design example: helical stage 5.5 kW, 960 rpm, i ~ 4 (case hardened)",
    "mn": 1.5, "z1": 21, "z2": 83, "beta_deg": 12.0, "x1": 0.2, "x2": 0.0, "b": 26.0,
    "P_kW": 5.5, "n1_rpm": 960.0, "KA": 1.25, "KHbeta": 1.25, "accuracy_grade": 6,
    "material1": "18CrNiMo7-6 case hardened", "material2": "18CrNiMo7-6 case hardened",
    "SHmin": 1.2, "SFmin": 1.6, "tooth_thickness_allowance_um": [-40, -70], "centre_distance_tol_um": 18,
}


def design_example():
    T1 = 5.5e3 / (960 * 2 * math.pi / 60)
    sHP = 1500 / 1.2
    d1 = presize_d1(T1, 4.0, sHP)
    mn_raw = d1 * math.cos(math.radians(12)) / 21
    mn = min(m for m in ISO54 if m >= mn_raw)
    P = dict(DEFAULT)
    P.update(EXAMPLE)
    R = capacity(P)
    return {"T1": T1, "sHP": sHP, "d1_min": d1, "mn_raw": mn_raw, "mn": mn, "P": P, "R": R}


def drawing_block(P, which=1):
    g = geometry(P)
    up, lo = P["tooth_thickness_allowance_um"]
    w0 = span_measurement(P, g, which)
    wu, wl = span_measurement(P, g, which, up), span_measurement(P, g, which, lo)
    op = over_pins(P, g, which, P.get("pin_diameter_mm"))
    opu = over_pins(P, g, which, op["DM"], up)
    opl = over_pins(P, g, which, op["DM"], lo)
    hand = ("right" if which == 1 else "left") if P["beta_deg"] else "-"
    return [("Normal module m_n", "%.2f mm" % P["mn"]), ("Number of teeth z", "%d" % P["z%d" % which]),
            ("Normal pressure angle", "%.0f deg" % P["alpha_n_deg"]), ("Helix angle / hand", "%.1f deg / %s" % (P["beta_deg"], hand)),
            ("Profile shift coefficient x", "%+.3f" % P["x%d" % which]), ("Reference diameter d", "%.3f mm" % g["d%d" % which]),
            ("Tip diameter d_a", "%.3f h11 mm" % g["da%d" % which]), ("Root diameter d_f", "%.3f mm (ref.)" % g["df%d" % which]),
            ("Base tangent length W_k, k", "%d teeth: %.3f / %.3f mm (nominal %.3f)" % (w0["k"], wu["Wk"], wl["Wk"], w0["Wk_nominal"])),
            ("Dimension over balls M_d, D_M", "%.3f / %.3f mm, D_M %.2f" % (opu["M"], opl["M"], op["DM"])),
            ("Accuracy grade", "ISO 1328-1:2013 grade %d" % P["accuracy_grade"]),
            ("Mating gear / centre distance", "z %d, a_w %.3f +/- %.3f mm" % (P["z%d" % (3 - which)], g["aw"], P["centre_distance_tol_um"] / 1000)),
            ("Heat treatment", "case hardened 58-62 HRC, CHD550 = 0.3-0.5 mm (check), core >= 30 HRC"),
            ("Flank / root roughness", "Ra 0.4 (ground) / Rz 10 (root, not ground)")]


def demo_ch68():
    P = dict(DEFAULT)
    g = geometry(P)
    F = forces(P, g)
    print("== 6.1 span measurement")
    for i in (1, 2):
        w = span_measurement(P, g, i)
        print("  gear %d: k %d, W_k nominal %.4f mm, W sin(beta_b) %.2f mm < b %.1f: %s" % (
            i, w["k"], w["Wk_nominal"], w["Wk_nominal"] * math.sin(g["bb"]), P["b"], w["fits_face"]))
    for k in (2, 3, 4):
        W = P["mn"] * math.cos(math.radians(20)) * ((k - 0.5) * math.pi + P["z1"] * (math.tan(g["at"]) - g["at"]) + 2 * P["x1"] * math.tan(math.radians(20)))
        print("  gear 1 with k %d: W %.4f mm" % (k, W))
    print("== 6.2 over balls")
    for i in (1, 2):
        for DM in (3.0, 3.25, 3.5):
            o = over_pins(P, g, i, DM)
            print("  gear %d DM %.2f: M %.4f mm, alpha_Mt %.2f deg" % (i, DM, o["M"], o["aMt_deg"]))
    up, lo = P["tooth_thickness_allowance_um"]
    for i in (1, 2):
        o = over_pins(P, g, i, 3.25)
        ou, ol = over_pins(P, g, i, 3.25, up), over_pins(P, g, i, 3.25, lo)
        print("  gear %d DM 3.25 with allowances: M %.4f ... %.4f (nominal %.4f)" % (i, ol["M"], ou["M"], o["M"]))
    print("== 6.3 backlash")
    b = backlash(P, g)
    print("  cold: j_n %.1f ... %.1f um, j_t %.1f ... %.1f um" % (b["jn_min_um"], b["jn_max_um"], b["jt_min_um"], b["jt_max_um"]))
    for case in ((40, 25, 11.5e-6, 23e-6, "aluminium housing"), (40, 25, 11.5e-6, 10.5e-6, "grey iron housing"), (60, 20, 11.5e-6, 23e-6, "Al, cold start")):
        t = backlash_thermal(P, g, *case[:4])
        print("  %s (gears +%d K, housing +%d K): delta a %.1f um, delta j_n %.1f um -> hot j_n %.1f ... %.1f um" % (
            case[4], case[0], case[1], t["delta_a_um"], t["delta_jn_um"], t["jn_min_hot"], t["jn_max_hot"]))
    print("== 6.4 ISO 1328-1:2013 tolerances, grade 6 (fpT, FpT published form; others approximation)")
    for i in (1, 2):
        t = iso1328_2013(P["mn"], g["d%d" % i], P["b"], 6)
        print("  gear %d (d %.1f): f_pT %.1f, F_pT %.1f, F_alpha %.1f, F_beta %.1f, F_r %.1f um" % (
            i, g["d%d" % i], t["fpT"], t["FpT"], t["FalphaT"], t["FbetaT"], t["FrT"]))
    for A in (5, 6, 7, 8):
        t = iso1328_2013(P["mn"], g["d1"], P["b"], A)
        print("  gear 1 grade %d: f_pT %.1f, F_pT %.1f um" % (A, t["fpT"], t["FpT"]))
    print("== 6.5 modifications")
    print("  F_t %.0f N, b %.0f mm: tip relief C_a %.1f um (K_A 1) / %.1f um (K_A 1.25); crowning C_beta %.1f um" % (
        F["Ft"], P["b"], tip_relief(F["Ft"], P["b"]), tip_relief(F["Ft"], P["b"], 1.25), crowning()))
    print("== 6.6 drawing block pinion")
    for k, v in drawing_block(P, 1):
        print("  %-32s %s" % (k, v))
    print("== 8 design example")
    D = design_example()
    print("  T1 %.2f N m, sigma_HP %.0f MPa, d1_min %.2f mm -> mn raw %.3f -> ISO 54 mn %.2f" % (
        D["T1"], D["sHP"], D["d1_min"], D["mn_raw"], D["mn"]))
    R = D["R"]
    g2 = R["g"]
    print("  geometry: d1 %.3f, d2 %.3f, a_w %.3f, u %.4f, eps_a %.3f, eps_b %.3f, b/d1 %.3f" % (
        g2["d1"], g2["d2"], g2["aw"], g2["u"], g2["ea"], g2["eb"], D["P"]["b"] / g2["d1"]))
    print("  forces: Ft %.0f, Fr %.0f, Fa %.0f N, v %.2f m/s" % (R["F"]["Ft"], R["F"]["Fr"], R["F"]["Fa"], R["F"]["v"]))
    print("  sigma_H %.0f MPa, S_H %.2f; S_F1 %.2f, S_F2 %.2f; ok %s %s" % (
        R["sH"], R["gear1"]["SH"], R["gear1"]["SF"], R["gear2"]["SF"], R["gear1"]["ok"], R["gear2"]["ok"]))
    for zz, xx in ((20, 0.0), (21, 0.2), (23, 0.3)):
        Q = dict(D["P"], z1=zz, z2=4 * zz - 1, x1=xx)
        Rq = capacity(Q)
        print("  variant z %d/%d x1 %.1f: a_w %.3f, S_H %.2f, S_F1 %.2f, S_F2 %.2f" % (zz, 4 * zz - 1, xx, Rq["g"]["aw"], Rq["gear1"]["SH"], Rq["gear1"]["SF"], Rq["gear2"]["SF"]))
    bb = backlash(D["P"], g2)
    print("  example backlash j_n %.1f ... %.1f um" % (bb["jn_min_um"], bb["jn_max_um"]))
    for i in (1, 2):
        t = iso1328_2013(D["P"]["mn"], g2["d%d" % i], D["P"]["b"], 6)
        w = span_measurement(D["P"], g2, i)
        print("  example gear %d: W_k k %d %.4f nominal; f_pT %.1f F_pT %.1f um" % (i, w["k"], w["Wk_nominal"], t["fpT"], t["FpT"]))
    print("== 7 FEA comparison reference: sigma_F0 (nominal, no K factors) of the default pair")
    R0 = capacity(P)
    for i in (1, 2):
        print("  gear %d: sigma_F0 %.1f MPa (= F_t/(b m_n) Y_F Y_S Y_beta), Y_F %.3f, Y_S %.3f" % (
            i, R0["gear%d" % i]["sF0"], R0["gear%d" % i]["ff"]["YF"], R0["gear%d" % i]["ff"]["YS"]))

# ---------------------------------------------------------------- examples / selftest
def cmd_examples():
    P = dict(DEFAULT)
    print(report_text(P))
    print("\n## Form factors (method B) of a spur gear, mn 1, x = 0, vs number of teeth")
    for z in (14, 17, 20, 25, 30, 40, 60, 100):
        Q = dict(P, z1=z, z2=60, x1=0.0, x2=0.0, beta_deg=0.0, b=10.0, mn=1.0)
        ff = form_factor_B(Q, geometry(Q), 1)
        print("  z %3d: Y_F %.3f, Y_S %.3f, Y_F Y_S %.3f" % (z, ff["YF"], ff["YS"], ff["YF"] * ff["YS"]))
    print("\n## Effect of profile shift on the pinion (z 19, helical default)")
    for x in (-0.2, 0.0, 0.25, 0.5):
        Q = dict(P, x1=x)
        R = capacity(Q)
        print("  x1 %+.2f: a_w %.3f, eps_a %.3f, s_a1 %.2f, Y_F1 %.3f, S_F1 %.2f, S_H %.2f" % (
            x, R["g"]["aw"], R["g"]["ea"], R["g"]["sa1"], R["gear1"]["ff"]["YF"], R["gear1"]["SF"], R["gear1"]["SH"]))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-62s %s %s" % (name, "OK  " if cond else "FAIL", info))
    chk("inv(20 deg) = 0.014904 and inverse", abs(inv(math.radians(20)) - 0.0149044) < 1e-6 and abs(inv_inverse(inv(0.5)) - 0.5) < 1e-12)
    S = dict(DEFAULT, mn=1.0, z1=20, z2=40, x1=0.0, x2=0.0, beta_deg=0.0, b=10.0)
    g = geometry(S)
    chk("standard spur pair: a_w = a0 = m (z1 + z2)/2 = 30", abs(g["aw"] - 30) < 1e-9 and abs(g["k"]) < 1e-9)
    # contact ratio by an independent formula (sum of approach + recess paths)
    r1, r2 = 10.0, 20.0
    rb1, rb2, ra1, ra2 = r1 * math.cos(math.radians(20)), r2 * math.cos(math.radians(20)), 11.0, 21.0
    ea_ind = (math.sqrt(ra1 ** 2 - rb1 ** 2) + math.sqrt(ra2 ** 2 - rb2 ** 2) - 30 * math.sin(math.radians(20))) / (math.pi * math.cos(math.radians(20)))
    chk("contact ratio = path of contact / base pitch (independent)", abs(g["ea"] - ea_ind) < 1e-12, "%.4f" % g["ea"])
    w = span_measurement(dict(S, z1=20), g, 1)
    chk("span measurement z 20, m 1, x 0, k 3: W = 7.660 mm", w["k"] == 3 and abs(w["Wk"] - 7.6604) < 1e-3, "k %d W %.4f" % (w["k"], w["Wk"]))
    # profile shift: x1 + x2 from a given a_w reproduces itself
    P = dict(DEFAULT)
    g1 = geometry(P)
    g2 = geometry(dict(P, a_w=g1["aw"]))
    chk("a_w -> x1 + x2 -> a_w (inverse consistency)", abs(g2["xsum"] - (P["x1"] + P["x2"])) < 1e-9)
    # over pins: pin touches the involute -> dM on the involute (check via the tooth space)
    op = over_pins(S, g, 1, DM=1.68)
    chk("over pins z 20 m 1 DM 1.68: M between d_a and d_a + 2 DM", g["da1"] < op["M"] < g["da1"] + 2 * 1.68, "M %.4f" % op["M"])
    # form factor trends
    ys = []
    for z in (17, 30, 100):
        Q = dict(S, z1=z, z2=60)
        ys.append(form_factor_B(Q, geometry(Q), 1)["YF"])
    chk("Y_F falls with more teeth", ys[0] > ys[1] > ys[2], ", ".join("%.3f" % y for y in ys))
    Qa, Qb = dict(S, x1=0.0), dict(S, x1=0.4)
    chk("Y_F falls with positive profile shift", form_factor_B(Qb, geometry(Qb), 1)["YF"] < form_factor_B(Qa, geometry(Qa), 1)["YF"])
    ff20 = form_factor_B(dict(S, z1=20), g, 1)
    # method B (load at the outer point of single contact) vs DIN method C (tip load): Y_F Y_S ~ Y_Fa Y_Sa Y_eps,
    # textbook Y_Fa Y_Sa ~ 4.35 for z 20, x 0 and Y_eps = 0.25 + 0.75/eps_alpha
    ref = 4.35 * (0.25 + 0.75 / g["ea"])
    chk("Y_F Y_S (method B) ~ Y_Fa Y_Sa Y_eps (method C) within 15 % (z 20, x 0)", abs(ff20["YF"] * ff20["YS"] / ref - 1) < 0.15,
        "%.3f vs %.3f" % (ff20["YF"] * ff20["YS"], ref))
    # Hertz: sigma_H0 = Z_H Z_E sqrt(Ft/(d b) (u+1)/u) equals the line-contact Hertz formula at the pitch point (spur)
    R = capacity(dict(S, KA=1, KHbeta=1, accuracy_grade=6))
    Ft = R["F"]["Ft"]
    rho = 1 / (1 / (r1 * math.sin(math.radians(20))) + 1 / (r2 * math.sin(math.radians(20))))
    Fn = Ft / math.cos(math.radians(20))
    pH = math.sqrt(Fn / 10 / (2 * math.pi * rho) * 206000 / (1 - 0.3 ** 2))
    chk("Z_H Z_E sqrt(...) = Hertz line contact at the pitch point (Z_eps = 1)", abs(R["sH0"] / R["Zeps"] - pH) / pH < 1e-6,
        "%.1f vs %.1f MPa" % (R["sH0"] / R["Zeps"], pH))
    chk("Z_E steel/steel = 189.8 sqrt(MPa)", abs(ZE(MATERIALS["C45 normalised"], MATERIALS["C45 normalised"]) - 189.8) < 0.1)
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
    elif cmd in ("ch24", "ch5", "ch68"):
        {"ch24": demo_ch24, "ch5": demo_ch5, "ch68": demo_ch68}[cmd]()
    elif cmd == "selftest":
        return cmd_selftest()
    elif cmd == "run":
        P = dict(DEFAULT)
        out = "gear_out"
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
