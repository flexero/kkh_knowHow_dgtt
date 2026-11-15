#!/usr/bin/env python3
"""M5c worm gear program - cylindrical worm drives (shaft angle 90 deg, flank forms ZA / ZN / ZI / ZK): geometry
(DIN 3975 / ISO/TS 14521 style), sliding velocity, friction and efficiency in both directions, self-locking, forces,
power losses and heat balance (oil temperature), and load capacity in the style of ISO/TS 14521 / DIN 3996 method B:
pitting of the bronze wheel, wear, tooth root of the wheel (new and worn), worm-shaft deflection, temperature.
Blank and inspection data (worm over-wire measurement, wheel throat data). Guide: 05c_worm_gears.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python worm.py params | run [--in p.json] [--out folder] | examples | selftest
  python worm.py ch24 | ch56 | ch78        extra results of guide chapters 2-4, 5-6, 7-8
  python worm.py run --in examples/worm_example.json --out example   worked design example (chapter 8)

ISO/TS 14521 (2020) and DIN 3996 (2019) are implemented in a SIMPLIFIED form: reference friction mu_0T, mean contact
stress parameter p*_m, mean sliding path s*, wear intensity J_W, housing area and heat-transfer coefficient are
approximations or typical values. Values marked 'check' in the guide must be compared with the standards, the bronze
supplier and the gearbox maker's test data before a design is released. All default numbers are EXAMPLES.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # sibling tools (shaft.py, bearing.py)

# wheel materials: E (MPa), nu, sigma_Hlim (MPa), tau_Flim (MPa), Y_W (friction material factor), W_ML (wear material factor)
# typical values in the style of DIN 3996 / ISO/TS 14521 tables - check the standard and the supplier's data
WHEEL_MATERIALS = {
    "CuSn12Ni2-C-GZ (centrifugal cast tin bronze)": {"E": 98100.0, "nu": 0.35, "sHlim": 520.0, "tFlim": 100.0, "YW": 1.00, "WML": 1.0},
    "CuSn12-C-GZ (centrifugal cast tin bronze)":    {"E": 88300.0, "nu": 0.35, "sHlim": 425.0, "tFlim": 92.0,  "YW": 1.00, "WML": 1.6},
    "CuSn12-C-GS (sand cast tin bronze)":           {"E": 88300.0, "nu": 0.35, "sHlim": 400.0, "tFlim": 82.0,  "YW": 1.05, "WML": 2.0},
    "CuAl10Fe5Ni5-C-GZ (aluminium bronze)":         {"E": 122600.0, "nu": 0.35, "sHlim": 660.0, "tFlim": 128.0, "YW": 1.10, "WML": 2.5},
    "EN-GJS-400-15 (ductile iron)":                 {"E": 175000.0, "nu": 0.30, "sHlim": 490.0, "tFlim": 115.0, "YW": 1.05, "WML": 1.5},
}
WORM_E, WORM_NU = 210000.0, 0.30

DEFAULT = {
    "name": "Worm gear stage a 100, i 20.5 for a slow conveyor / turntable drive (example)",
    "profile": "ZI",                  # ZA | ZN | ZI | ZK  (flank form of the worm, DIN 3975)
    "a": 100.0,                       # centre distance mm
    "z1": 2, "z2": 41,                # starts of the worm, teeth of the wheel
    "mx": 4.0,                        # axial module of the worm = transverse module of the wheel, mm
    "d1": 36.0,                       # reference diameter of the worm mm (q = d1/mx)
    "alpha_n_deg": 20.0,              # normal pressure angle
    "haP": 1.0, "cP": 0.2,            # addendum and bottom clearance, factors of mx
    "b2": 28.0,                       # wheel face width mm
    "P1_kW": 3.0, "n1_rpm": 1450.0,   # input power at the worm (worm driving)
    "KA": 1.0,                        # application factor (check; ISO/TS 14521 applies K_A to T2)
    "Lh": 25000.0,                    # required life h
    "wheel_material": "CuSn12Ni2-C-GZ (centrifugal cast tin bronze)",
    "lubricant": "mineral",           # mineral | polyglycol
    "Ra1_um": 0.4,                    # worm flank roughness (ground ~0.3-0.5)
    "mu_static": 0.12,                # friction at rest for the self-locking judgement (check)
    "J_W": None,                      # wear intensity (None -> typical value for the lubricant, check)
    "l1": 160.0,                      # worm bearing spread mm (deflection check)
    "d_shaft1": 28.0, "d_shaft2": 45.0,   # seal diameters mm (seal losses)
    "P_V0_W": 40.0,                   # no-load (churning) loss W - check by measurement
    "A_housing_m2": None,             # housing surface m^2 (None -> 9e-5 a^1.85, finned housing, check)
    "fan": True,                      # fan on the worm shaft
    "theta_0": 20.0, "theta_lim": 90.0,   # ambient and permissible oil sump temperature deg C
    "SHmin": 1.0, "SWmin": 1.1, "SFmin": 1.1, "Sdmin": 1.0,
    "jt_um": 120,                     # circumferential backlash target (wheel reference circle) um
}

# ---------------------------------------------------------------- chapter 3: geometry
def geometry(P):
    z1, z2, mx, d1, a = P["z1"], P["z2"], P["mx"], P["d1"], P["a"]
    u = z2 / z1
    q = d1 / mx
    gam = math.atan(z1 * mx / d1)                       # lead angle at the reference cylinder
    an = math.radians(P["alpha_n_deg"])
    ax = math.atan(math.tan(an) / math.cos(gam))        # axial pressure angle
    px = math.pi * mx
    pz = z1 * px                                        # lead
    mn = mx * math.cos(gam)
    d2 = z2 * mx
    x2 = (2 * a - d1 - d2) / (2 * mx)                   # profile shift of the wheel from the centre distance
    ha, c = P["haP"] * mx, P["cP"] * mx
    da1, df1 = d1 + 2 * ha, d1 - 2 * (ha + c)
    da2 = d2 + 2 * mx * (P["haP"] + x2)
    df2 = d2 - 2 * mx * (P["haP"] + P["cP"] - x2)
    dae2 = da2 + mx                                     # outside (throat edge) diameter, z1 <= 3 (check DIN 3975)
    rk = a - da2 / 2                                    # throat radius of the wheel rim
    ra1, ra2 = da1 / 2, da2 / 2
    b1_geo = 2 * math.sqrt(max(ra2 ** 2 - (a - ra1) ** 2, 0.0))     # wheel tip circle reaches the worm tip cylinder
    b1_emp = (11 + 0.06 * z2) * mx if z1 <= 2 else (12.5 + 0.09 * z2) * mx   # empirical (x2 = 0)
    b2_rec = 0.45 * (da1 + 4 * mx)                      # recommended wheel width (check)
    b2_max = math.sqrt(da1 ** 2 - (d1 - 2 * mx) ** 2) if da1 > d1 - 2 * mx else da1
    wrap = 2 * math.asin(min(P["b2"] / da1, 1.0))       # wrap angle of the wheel on the worm tip cylinder
    gb = math.acos(math.cos(an) * math.cos(gam))        # base lead angle (ZI involute helicoid)
    db1 = d1 * math.tan(gam) / math.tan(gb)
    vg = math.pi * d1 * P["n1_rpm"] / 60000.0 / math.cos(gam)        # sliding velocity m/s
    v1 = math.pi * d1 * P["n1_rpm"] / 60000.0
    v2 = math.pi * d2 * P["n1_rpm"] / u / 60000.0
    return {"u": u, "q": q, "gamma": gam, "gamma_deg": math.degrees(gam), "alpha_x": ax, "alpha_n": an,
            "px": px, "pz": pz, "mn": mn, "d1": d1, "d2": d2, "x2": x2, "da1": da1, "df1": df1, "da2": da2, "df2": df2,
            "dae2": dae2, "rk": rk, "b1_geo": b1_geo, "b1_emp": b1_emp, "b2_rec": b2_rec, "b2_max": b2_max,
            "wrap_deg": math.degrees(wrap), "gamma_b": gb, "db1": db1, "vg": vg, "v1": v1, "v2": v2,
            "n2_rpm": P["n1_rpm"] / u,
            "checks": {"x2_range": -0.5 <= x2 <= 1.0, "b2_le_max": P["b2"] <= b2_max, "q_range": 6 <= q <= 17}}

# ---------------------------------------------------------------- chapter 4: friction, efficiency, self-locking
def mu_0T(vg, lubricant):
    """Reference friction coefficient vs sliding velocity (case-hardened ground worm / CuSn12Ni2 bronze),
    mineral oil curve in the style of DIN 3996; polyglycol about 20 % lower (check)."""
    m = 0.028 + 0.026 / (vg + 0.18)
    return m if lubricant == "mineral" else 0.8 * m

def efficiency(P, g=None):
    g = g or geometry(P)
    mat = WHEEL_MATERIALS[P["wheel_material"]]
    m0 = mu_0T(g["vg"], P["lubricant"])
    YS = math.sqrt(100.0 / P["a"])                   # size factor
    YR = (P["Ra1_um"] / 0.5) ** 0.25                 # roughness factor
    mu = m0 * YS * YR * mat["YW"]
    rho = math.atan(mu / math.cos(g["alpha_n"]))     # friction angle (normal section)
    gam = g["gamma"]
    eta = math.tan(gam) / math.tan(gam + rho)        # worm driving
    eta_rev = math.tan(gam - rho) / math.tan(gam) if gam > rho else 0.0     # wheel driving
    rho_s = math.atan(P["mu_static"] / math.cos(g["alpha_n"]))
    return {"mu0T": m0, "YS": YS, "YR": YR, "YW": mat["YW"], "mu": mu, "rho": rho, "rho_deg": math.degrees(rho),
            "eta_z": eta, "eta_rev": eta_rev, "rho_static_deg": math.degrees(rho_s),
            "self_locking_static": gam < rho_s, "self_locking_dynamic": gam <= rho}

# ---------------------------------------------------------------- chapter 4: forces
def forces(P, g=None, e=None):
    g = g or geometry(P)
    e = e or efficiency(P, g)
    w1 = 2 * math.pi * P["n1_rpm"] / 60.0
    T1 = P["P1_kW"] * 1000.0 / w1
    T2 = T1 * g["u"] * e["eta_z"]
    Ft2 = 2000.0 * T2 / g["d2"]                      # = worm axial force
    Ft1 = Ft2 * math.tan(g["gamma"] + e["rho"])      # = wheel axial force
    Fr = Ft2 * math.tan(g["alpha_n"]) * math.cos(e["rho"]) / math.cos(g["gamma"] + e["rho"])
    Fn = Ft2 / (math.cos(g["alpha_n"]) * math.cos(g["gamma"]) - e["mu"] * math.sin(g["gamma"]))
    return {"T1": T1, "T2": T2, "Ft1": Ft1, "Fa1": Ft2, "Ft2": Ft2, "Fa2": Ft1, "Fr": Fr, "Fn": Fn,
            "P2_kW": P["P1_kW"] * e["eta_z"]}

# ---------------------------------------------------------------- chapter 5: losses and heat balance
def losses(P, g=None, e=None):
    g = g or geometry(P)
    e = e or efficiency(P, g)
    P1 = P["P1_kW"] * 1000.0
    PVz = P1 * (1 - e["eta_z"])                      # mesh
    PVLP = 0.01 * P1                                 # bearings of both shafts (check)
    PVD = 7.69e-6 * (P["d_shaft1"] ** 2 * P["n1_rpm"] + P["d_shaft2"] ** 2 * g["n2_rpm"])   # radial lip seals (check)
    PV0 = P["P_V0_W"]
    PV = PVz + PVLP + PVD + PV0
    A = P["A_housing_m2"] or 9e-5 * P["a"] ** 1.85
    k = 28.0 if P["fan"] else 14.0                   # W/(m^2 K) (check)
    theta = P["theta_0"] + PV / (k * A)
    return {"PVz": PVz, "PVLP": PVLP, "PVD": PVD, "PV0": PV0, "PV": PV, "eta_total": (P1 - PV) / P1,
            "A": A, "k": k, "theta_S": theta, "ok": theta <= P["theta_lim"]}

def thermal_power_limit(P):
    """Input power at which the sump reaches theta_lim (bisection)."""
    lo, hi = 0.01, 200.0
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if losses(dict(P, P1_kW=mid))["theta_S"] > P["theta_lim"]:
            hi = mid
        else:
            lo = mid
    return lo

# ---------------------------------------------------------------- chapter 6: load capacity (ISO/TS 14521 / DIN 3996 style, simplified)
def E_red(mat):
    return 2.0 / ((1 - WORM_NU ** 2) / WORM_E + (1 - mat["nu"] ** 2) / mat["E"])

def p_star_m(P, g):
    """Mean dimensionless contact stress parameter for ZI worms (DIN 3996 method B style approximation, check)."""
    q, u, x2, z2, mx = g["q"], g["u"], g["x2"], P["z2"], P["mx"]
    return 1.03 * (0.4 + x2 / u + 0.01 * z2 - 0.083 * P["b2"] / mx + math.sqrt(q) / 6.9 + (q + 50 * (u + 1) / u) / (15.9 + 37.5 * q))

def s_star(g):
    """Mean sliding path parameter (DIN 3996 style, check)."""
    return 0.78 + 0.21 * g["u"] + 5.6 / math.tan(g["gamma"])

J_W_TYPICAL = {"mineral": 1.0e-9, "polyglycol": 4.0e-10}   # wear intensity, case-hardened ground worm / CuSn12Ni2 (check)

def capacity(P):
    g = geometry(P)
    e = efficiency(P, g)
    F = forces(P, g, e)
    L = losses(P, g, e)
    mat = WHEEL_MATERIALS[P["wheel_material"]]
    Er = E_red(mat)
    T2 = F["T2"] * P["KA"]
    # pitting of the wheel
    pm = p_star_m(P, g)
    sHm = 4 / math.pi * math.sqrt(pm * T2 * 1000.0 * Er / P["a"] ** 3)
    ZN = min((25000.0 / P["Lh"]) ** (1 / 6.0), 1.6)
    Zv = math.sqrt(5.0 / (4.0 + g["vg"]))
    ZS = math.sqrt(3000.0 / (2900.0 + P["a"]))
    Zoil = 1.0 if P["lubricant"] == "mineral" else 0.94
    sHG = mat["sHlim"] * ZN * Zv * ZS * Zoil
    SH = sHG / sHm
    # wear
    NL = g["n2_rpm"] * 60.0 * P["Lh"]
    ss = s_star(g)
    sWm = sHm * P["a"] * NL * ss / Er                 # mean sliding path mm
    JW = (P["J_W"] or J_W_TYPICAL[P["lubricant"]]) * mat["WML"]
    dW = JW * sWm                                     # normal flank wear mm
    dWlim = 0.3 * P["mx"] * math.cos(g["gamma"])      # permissible wear (tooth thinning, check)
    SW = dWlim / dW
    # tooth root of the wheel (new and worn)
    hf2 = (P["haP"] + P["cP"] - g["x2"]) * P["mx"]
    s2 = P["mx"] * (math.pi / 2 + 2 * g["x2"] * math.tan(g["alpha_x"])) - P["jt_um"] / 1000.0
    sft2 = s2 + 2 * hf2 * math.tan(g["alpha_x"])      # rack approximation of the root chord
    sft2_worn = sft2 - dW / math.cos(g["gamma"])
    b2R = g["da1"] * math.asin(min(P["b2"] / g["da1"], 1.0))       # arc length of the wheel on the worm tip cylinder
    Ft2 = F["Ft2"] * P["KA"]
    Yeps, Ygam = 0.5, 1 / math.cos(g["gamma"])
    YF_new, YF_worn = 2.9 * P["mx"] / sft2, 2.9 * P["mx"] / sft2_worn
    tF = Ft2 / (b2R * P["mx"]) * Yeps * YF_new * Ygam
    tF_worn = Ft2 / (b2R * P["mx"]) * Yeps * YF_worn * Ygam
    SF = mat["tFlim"] / tF
    SF_worn = mat["tFlim"] / tF_worn
    # worm deflection
    I = math.pi * g["df1"] ** 4 / 64.0
    dm = P["l1"] ** 3 * math.hypot(F["Ft1"], F["Fr"]) / (48.0 * WORM_E * I)
    dlim = 0.01 * P["mx"]
    Sd = dlim / dm
    # temperature
    ST = P["theta_lim"] / L["theta_S"]
    res = {"g": g, "e": e, "F": F, "L": L, "E_red": Er, "p_star_m": pm, "sHm": sHm, "ZN": ZN, "Zv": Zv, "ZS": ZS,
           "Zoil": Zoil, "sHG": sHG, "SH": SH, "NL": NL, "s_star": ss, "sWm": sWm, "JW": JW, "dW": dW, "dWlim": dWlim, "SW": SW,
           "sft2": sft2, "sft2_worn": sft2_worn, "b2R": b2R, "YF": YF_new, "YF_worn": YF_worn, "tF": tF, "tF_worn": tF_worn,
           "SF": SF, "SF_worn": SF_worn, "delta_m": dm, "delta_lim": dlim, "Sd": Sd, "ST": ST}
    res["ok"] = {"pitting": SH >= P["SHmin"], "wear": SW >= P["SWmin"], "root_worn": SF_worn >= P["SFmin"],
                 "deflection": Sd >= P["Sdmin"], "temperature": L["ok"]}
    return res

# ---------------------------------------------------------------- chapter 7: inspection data
def over_wires(P, g=None, DM=None):
    """Worm over-three-wire measurement, rack approximation in the axial section (exact for ZA at small lead angles;
    for ZN / ZI / ZK the result is an approximation - check DIN 3975 / the gauge maker)."""
    g = g or geometry(P)
    ax = g["alpha_x"]
    sx1 = g["px"] / 2.0                               # nominal axial thickness (backlash put on the wheel)
    DM_use = sx1 / math.cos(ax) if DM is None else DM    # best wire: contact on the reference line
    M = P["d1"] - (g["px"] - sx1) / math.tan(ax) + DM_use * (1 + 1 / math.sin(ax))
    return {"sx1": sx1, "DM": DM_use, "M": M}

# ---------------------------------------------------------------- report / run
def report_text(P):
    R = capacity(P)
    g, e, F, L = R["g"], R["e"], R["F"], R["L"]
    ow = over_wires(P, g)
    flag = lambda b: "OK" if b else "NOT OK"
    Lr = ["# Worm gear report - %s\n" % P["name"],
          "%s worm, a %.1f mm, z1/z2 %d/%d (i %.2f), mx %.3f, d1 %.2f (q %.2f), alpha_n %.1f deg, b2 %.1f mm, wheel %s, %s oil" % (
              P["profile"], P["a"], P["z1"], P["z2"], g["u"], P["mx"], P["d1"], g["q"], P["alpha_n_deg"], P["b2"],
              P["wheel_material"], P["lubricant"]),
          "\n## Geometry",
          "- lead angle %.3f deg; axial pressure angle %.3f deg; px %.4f, lead pz %.4f, mn %.4f mm" % (
              g["gamma_deg"], math.degrees(g["alpha_x"]), g["px"], g["pz"], g["mn"]),
          "- worm d1 %.3f, da1 %.3f, df1 %.3f; wheel d2 %.3f, x2 %+.4f, da2 %.3f, df2 %.3f, dae2 %.3f, throat radius %.3f mm" % (
              g["d1"], g["da1"], g["df1"], g["d2"], g["x2"], g["da2"], g["df2"], g["dae2"], g["rk"]),
          "- worm length b1 >= %.1f (geometric) / %.1f mm (empirical); wheel width b2 %.1f (recommended %.1f, max %.1f); wrap angle %.1f deg" % (
              g["b1_geo"], g["b1_emp"], P["b2"], g["b2_rec"], g["b2_max"], g["wrap_deg"]),
          "- ZI base cylinder db1 %.3f mm (base lead angle %.3f deg); sliding velocity vg %.3f m/s; n2 %.2f rpm" % (
              g["db1"], math.degrees(g["gamma_b"]), g["vg"], g["n2_rpm"]),
          "\n## Friction, efficiency, self-locking",
          "- mu_0T %.4f x Y_S %.3f x Y_R %.3f x Y_W %.2f = mu_z %.4f; friction angle %.3f deg" % (
              e["mu0T"], e["YS"], e["YR"], e["YW"], e["mu"], e["rho_deg"]),
          "- mesh efficiency worm driving %.4f, wheel driving %.4f; self-locking at rest: %s (rho_static %.2f deg), while running: %s" % (
              e["eta_z"], e["eta_rev"], "yes" if e["self_locking_static"] else "no", e["rho_static_deg"],
              "yes" if e["self_locking_dynamic"] else "no"),
          "\n## Forces",
          "- T1 %.2f N m, T2 %.1f N m; Ft1 = Fa2 %.0f N, Ft2 = Fa1 %.0f N, Fr %.0f N, Fn %.0f N; P2 %.3f kW" % (
              F["T1"], F["T2"], F["Ft1"], F["Ft2"], F["Fr"], F["Fn"], F["P2_kW"]),
          "\n## Losses and heat balance",
          "- mesh %.0f W, bearings %.0f W, seals %.1f W, no-load %.0f W -> P_V %.0f W; total efficiency %.4f" % (
              L["PVz"], L["PVLP"], L["PVD"], L["PV0"], L["PV"], L["eta_total"]),
          "- housing A %.3f m^2, k %.0f W/m^2K -> oil sump %.1f deg C (limit %.0f: %s); thermal power limit %.2f kW" % (
              L["A"], L["k"], L["theta_S"], P["theta_lim"], flag(L["ok"]), thermal_power_limit(P)),
          "\n## Load capacity (ISO/TS 14521 / DIN 3996 style, simplified)",
          "- pitting: p*_m %.3f, E_red %.0f MPa -> sigma_Hm %.0f MPa; sigma_HG %.0f (Z_N %.3f, Z_v %.3f, Z_S %.3f, Z_oil %.2f) -> S_H %.2f %s" % (
              R["p_star_m"], R["E_red"], R["sHm"], R["sHG"], R["ZN"], R["Zv"], R["ZS"], R["Zoil"], R["SH"], flag(R["ok"]["pitting"])),
          "- wear: N_L %.3g, s* %.2f, s_Wm %.3g mm, J_W %.3g -> wear %.3f mm (limit %.3f) -> S_W %.2f %s" % (
              R["NL"], R["s_star"], R["sWm"], R["JW"], R["dW"], R["dWlim"], R["SW"], flag(R["ok"]["wear"])),
          "- tooth root wheel: s_ft2 %.3f (worn %.3f) mm, b2R %.1f mm, tau_F %.1f (worn %.1f) MPa -> S_F %.2f (worn %.2f) %s" % (
              R["sft2"], R["sft2_worn"], R["b2R"], R["tF"], R["tF_worn"], R["SF"], R["SF_worn"], flag(R["ok"]["root_worn"])),
          "- worm deflection %.4f mm (limit %.3f) -> S_delta %.2f %s; temperature S_T %.2f" % (
              R["delta_m"], R["delta_lim"], R["Sd"], flag(R["ok"]["deflection"]), R["ST"]),
          "\n## Inspection",
          "- worm axial tooth thickness %.4f mm; over three wires D_M %.4f mm -> M %.3f mm (rack approximation, check)" % (
              ow["sx1"], ow["DM"], ow["M"])]
    return "\n".join(Lr)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    g = geometry(P)
    with open(os.path.join(out, "blank.csv"), "w", encoding="utf-8") as f:
        f.write("item,worm,wheel\n")
        for lab, w, h in (("reference diameter", g["d1"], g["d2"]), ("tip diameter", g["da1"], g["da2"]),
                          ("root diameter", g["df1"], g["df2"]), ("outside diameter", g["da1"], g["dae2"]),
                          ("face width / length", max(g["b1_geo"], g["b1_emp"]), P["b2"])):
            f.write("%s mm,%.4f,%.4f\n" % (lab, w, h))
        f.write("throat radius mm,,%.4f\n" % g["rk"])
    print(rep)
    print("written: report.md, blank.csv ->", out)


# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2: types and flank forms
PROFILE_TYPES = [  # code, flank definition, how it is made, grinding, typical use
    ("ZA", "straight line in the AXIAL section (Archimedean spiral in the transverse section)",
     "lathe tool with straight edges in the axial plane (thread turning) or whirling", "difficult - needs a dressed wheel with a curved profile; mostly not ground",
     "small, slow, unhardened worms; low cost; workshop repair"),
    ("ZN", "straight line in the NORMAL section of the tooth (or of the space)",
     "turning tool set in the normal plane; disc cutter / end mill", "possible with a straight-sided wheel only approximately; small errors",
     "medium sizes; multi-start worms that are milled"),
    ("ZI", "involute helicoid (straight line in a plane tangent to the base cylinder)",
     "hobbing / milling, then grinding with a flat (plane) wheel face on the base-cylinder tangent plane",
     "easy and exact: flat wheel face -> low dressing cost; very common for hardened, ground worms",
     "industrial gearboxes, robots, lifts - the default of this program"),
    ("ZK", "generated by a cone (double-cone disc wheel or milling cutter) set at the lead angle",
     "milling with a disc cutter, then grinding with a biconical wheel", "standard process of most worm-grinding machines; profile depends on the wheel diameter",
     "industrial gearboxes; the flank is slightly convex"),
    ("ZC", "concave flank (circular-arc profile of the tool in the axial section, 'Cavex', 'hollow flank')",
     "convex circular-arc disc wheel", "dedicated profile wheel, dressing with a formed diamond",
     "high-capacity drives: concave-convex contact -> better film, ~15-30 % higher capacity (check maker data)"),
    ("globoid / double-enveloping", "worm enveloping the wheel (hourglass shape) - several teeth in line contact at once",
     "special machines; worm and wheel cut as a set", "difficult; often lapped together",
     "very high torque in a small space (presses, mills); needs exact axial setting"),
]

# preferred axial modules (DIN 780-2 series, check) and common diameter quotients q (DIN 3976 style, check)
MODULES_WORM = [1.0, 1.25, 1.6, 2.0, 2.5, 3.15, 4.0, 5.0, 6.3, 8.0, 10.0, 12.5, 16.0, 20.0]
Q_COMMON = [8.0, 9.0, 10.0, 11.0, 12.5, 14.0, 16.0, 17.0]

def z1_for_ratio(i):
    """Rule of thumb for the number of worm starts vs ratio (check maker practice): many starts for low ratios
    keep the lead angle and the efficiency up; z2 >= 28 ... 30 avoids undercut of the wheel (alpha 20 deg)."""
    if i < 7:
        z1 = 6
    elif i < 10:
        z1 = 4
    elif i < 15:
        z1 = 3
    elif i < 30:
        z1 = 2
    else:
        z1 = 1
    return z1, round(z1 * i)

def lead_angle_table(z1s=(1, 2, 3, 4, 6), qs=(8, 9, 10, 12.5, 16)):
    """Lead angle gamma = atan(z1/q) in degrees."""
    return {(z1, q): math.degrees(math.atan(z1 / q)) for z1 in z1s for q in qs}

def pressure_angles(P=None):
    """Axial vs normal pressure angle: tan(alpha_x) = tan(alpha_n) / cos(gamma)."""
    P = dict(DEFAULT if P is None else P)
    g = geometry(P)
    return {"alpha_n": P["alpha_n_deg"], "alpha_x": math.degrees(g["alpha_x"]),
            "alpha_x_hand": math.degrees(math.atan(math.tan(math.radians(P["alpha_n_deg"])) / math.cos(g["gamma"])))}

def q_study(P=None, qs=(7.0, 8.0, 9.0, 10.0, 12.5, 16.0)):
    """Same mx, z1, z2, b2 - only d1 = q mx changes (centre distance follows with x2 = 0).
    Shows: larger q -> stiffer worm, smaller lead angle, lower efficiency, higher sliding speed."""
    P = dict(DEFAULT if P is None else P)
    rows = []
    for q in qs:
        d1 = q * P["mx"]
        a = (d1 + P["z2"] * P["mx"]) / 2
        Q = dict(P, d1=d1, a=a, b2=round(0.45 * (d1 + 2 * P["mx"] + 4 * P["mx"]), 1))
        R = capacity(Q)
        rows.append({"q": q, "d1": d1, "a": a, "gamma": R["g"]["gamma_deg"], "vg": R["g"]["vg"], "eta": R["e"]["eta_z"],
                     "delta_um": R["delta_m"] * 1000, "Sd": R["Sd"], "SH": R["SH"], "theta": R["L"]["theta_S"]})
    return rows

def x2_fit(P=None, a_targets=(98.0, 100.0, 102.0, 104.0)):
    """Profile shift of the wheel needed to fit a given centre distance with fixed worm (mx, d1) and z2.
    Practical range about -0.5 <= x2 <= +1 (negative x2 -> pointed / weak wheel teeth, positive -> undercut-free)."""
    P = dict(DEFAULT if P is None else P)
    out = []
    for a in a_targets:
        g = geometry(dict(P, a=a))
        out.append((a, g["x2"], g["da2"], g["checks"]["x2_range"]))
    return out

# ---------------------------------------------------------------- chapter 4: efficiency and self-locking
def eta_vs_vg(P=None, vgs=(0.05, 0.2, 0.5, 1.0, 2.0, 2.8, 5.0, 10.0, 15.0)):
    """Mesh efficiency of the default geometry at different sliding speeds (same correction factors Y_S Y_R Y_W)."""
    P = dict(DEFAULT if P is None else P)
    g, e = geometry(P), efficiency(P)
    corr = e["YS"] * e["YR"] * e["YW"]
    rows = []
    for v in vgs:
        mu = mu_0T(v, P["lubricant"]) * corr
        rho = math.atan(mu / math.cos(g["alpha_n"]))
        eta = math.tan(g["gamma"]) / math.tan(g["gamma"] + rho)
        eta_r = math.tan(g["gamma"] - rho) / math.tan(g["gamma"]) if g["gamma"] > rho else 0.0
        rows.append((v, mu, eta, eta_r))
    return rows

def eta_vs_gamma(mu=0.0347, alpha_n_deg=20.0, gammas=(2, 4, 6, 8, 10, 12.53, 15, 20, 25, 30, 40, 45, 50)):
    """eta(gamma) for a fixed friction coefficient: worm driving and wheel driving; maximum at gamma = 45 - rho/2."""
    rho = math.atan(mu / math.cos(math.radians(alpha_n_deg)))
    rows = []
    for gd in gammas:
        gm = math.radians(gd)
        eta = math.tan(gm) / math.tan(gm + rho)
        eta_r = math.tan(gm - rho) / math.tan(gm) if gm > rho else 0.0
        rows.append((gd, eta, eta_r))
    g_opt = 45 - math.degrees(rho) / 2
    return rows, g_opt

def energy_check(P=None):
    """Efficiency from work per worm revolution: input  Ft1 * pi d1 ; output Ft2 * pz (wheel teeth move one lead)."""
    P = dict(DEFAULT if P is None else P)
    g = geometry(P)
    e = efficiency(P, g)
    F = forces(P, g, e)
    W_in = F["Ft1"] * math.pi * g["d1"]
    W_out = F["Ft2"] * g["pz"]
    return W_in, W_out, W_out / W_in, e["eta_z"]

def self_locking_map(P=None, z1s=(1, 2, 3), qs=(8, 10, 12.5, 16), vg_run=None):
    """Static (mu_static) and running (mu at vg) self-locking for z1 x q, same mx."""
    P = dict(DEFAULT if P is None else P)
    rows = []
    for z1 in z1s:
        for q in qs:
            Q = dict(P, z1=z1, z2=P["z2"], d1=q * P["mx"], a=(q * P["mx"] + P["z2"] * P["mx"]) / 2)
            g, e = geometry(Q), efficiency(Q)
            rows.append((z1, q, g["gamma_deg"], e["rho_static_deg"], e["rho_deg"], e["eta_z"], e["eta_rev"],
                         e["self_locking_static"], e["self_locking_dynamic"]))
    return rows

def holding_brake(P=None, T2_load_Nm=None, safety=2.0):
    """Back-driving at rest: a load torque T2 on the wheel drives the worm with T1 = T2 / i * eta_rev,static.
    If eta_rev,static <= 0 the drive holds at rest (statically self-locking) - but vibration can still release it,
    so lifting / holding axes get a brake anyway. Brake torque at the worm shaft = safety * T1_back (at least 0)."""
    P = dict(DEFAULT if P is None else P)
    g = geometry(P)
    F = forces(P, g)
    T2 = F["T2"] if T2_load_Nm is None else T2_load_Nm
    rho_s = math.atan(P["mu_static"] / math.cos(g["alpha_n"]))
    eta_rs = math.tan(g["gamma"] - rho_s) / math.tan(g["gamma"]) if g["gamma"] > rho_s else 0.0
    T1_back = T2 / g["u"] * eta_rs
    # running back-drive (load lowering while turning): mu at vg
    e = efficiency(P, g)
    T1_back_run = T2 / g["u"] * e["eta_rev"]
    return {"T2": T2, "eta_rev_static": eta_rs, "T1_back": T1_back, "T1_back_run": T1_back_run,
            "T_brake": safety * max(T1_back, T1_back_run), "static_lock": eta_rs <= 0}

# ---------------------------------------------------------------- chapter 4: direction of the forces
def axial_force_cases(P=None):
    """Worm axis x, observer at the drive end looking along +x. Wheel above the worm (contact at y = +d1/2).
    Positive rotation about +x appears clockwise (cw) to this observer. A right-hand screw turned cw advances along +x;
    the worm is held axially, so the wheel tooth at the mesh is pushed along -x and the reaction pushes the worm along +x.
    Each change of hand or of rotation reverses both directions.  Returns (hand, rotation, axial force on worm,
    motion of the wheel tooth at the mesh)."""
    P = dict(DEFAULT if P is None else P)
    F = forces(P)
    rows = []
    for hand in ("right", "left"):
        for rot in ("cw", "ccw"):
            s = (1 if hand == "right" else -1) * (1 if rot == "cw" else -1)
            rows.append((hand, rot, s * F["Fa1"], "-x (towards the drive end)" if s > 0 else "+x (away from the drive end)"))
    return rows

# ---------------------------------------------------------------- chapter 4: bearing hand-over (M3 / M4)
EXTRA_BEARINGS = {   # catalogue-style data for the worm and wheel shafts (typical values - check the maker's catalogue)
    "6305":  {"type": "ball", "d": 25, "D": 62, "B": 17, "C": 23.4, "C0": 11.6, "Cu": 0.49, "f0": 12.0, "n_lim": 10000, "m": 0.23},
    "30205": {"type": "taper", "d": 25, "D": 52, "B": 16.25, "C": 32.5, "C0": 33.5, "Cu": 3.6, "e": 0.37, "Y": 1.6, "n_lim": 9500, "m": 0.16},
    "30305": {"type": "taper", "d": 25, "D": 62, "B": 18.25, "C": 46.8, "C0": 40.0, "Cu": 4.4, "e": 0.30, "Y": 2.0, "n_lim": 8500, "m": 0.27},
    "31305": {"type": "taper", "d": 25, "D": 62, "B": 18.25, "C": 38.0, "C0": 36.0, "Cu": 3.9, "e": 0.83, "Y": 0.72, "n_lim": 7500, "m": 0.27},
    "6209":  {"type": "ball", "d": 45, "D": 85, "B": 19, "C": 35.1, "C0": 21.6, "Cu": 0.915, "f0": 14.0, "n_lim": 7000, "m": 0.42},
    "30209": {"type": "taper", "d": 45, "D": 85, "B": 20.75, "C": 64.0, "C0": 83.0, "Cu": 9.5, "e": 0.40, "Y": 1.5, "n_lim": 5600, "m": 0.47},
}

def worm_shaft_reactions(P=None, l1=None):
    """Worm between two bearings A (x = 0, drive end) and B (x = l1), mesh in the middle. Wheel above the worm.
    Radial plane y: Fr acts on the worm at -y; the axial force Fa1 (+x, right hand cw) at y = +d1/2 gives the moment
    M = Fa1 d1/2.  Tangential plane z: Ft1.  Moments about A:  RB_y = Fr/2 + Fa1 d1/(2 l1), RA_y = Fr/2 - Fa1 d1/(2 l1)."""
    P = dict(DEFAULT if P is None else P)
    l1 = P["l1"] if l1 is None else l1
    g = geometry(P)
    F = forces(P, g)
    M = F["Fa1"] * g["d1"] / 2
    RAy, RBy = F["Fr"] / 2 - M / l1, F["Fr"] / 2 + M / l1
    RAz = RBz = F["Ft1"] / 2
    return {"F": F, "M_Nmm": M, "RA": math.hypot(RAy, RAz), "RB": math.hypot(RBy, RBz), "RAy": RAy, "RBy": RBy,
            "RAz": RAz, "RBz": RBz, "Fa": F["Fa1"], "l1": l1}

def worm_reactions_vs_shaft(P=None):
    """Cross-check with shaft.reactions() (M3): the axial-force moment is modelled as a force couple
    (+Fa d1/2 / dx at x = l1/2 - dx/2 and the opposite at l1/2 + dx/2)."""
    import shaft
    r = worm_shaft_reactions(P)
    F, l1 = r["F"], r["l1"]
    dx = 1.0
    c = r["M_Nmm"] / dx
    S = dict(shaft.DEFAULT, segments=[[l1, 30, 0]], bearings=[0.0, l1],
             forces=[[l1 / 2, -F["Fr"], F["Ft1"], "mesh"], [l1 / 2 - dx / 2, c, 0.0, "couple +"], [l1 / 2 + dx / 2, -c, 0.0, "couple -"]])
    R = shaft.reactions(S)
    return (-R["y"][0], -R["y"][1], -R["z"][0]), (r["RAy"], r["RBy"], r["RAz"])

def _taper_pair_X(FrA, FrB, YA, YB, Ka):
    """Two tapered roller bearings in X arrangement (face to face) at the shaft ends; Ka > 0 pushes the shaft
    towards B, which then carries it. Induced forces F_ad = 0.5 Fr / Y (simplified ISO / maker rule)."""
    FadA, FadB = 0.5 * FrA / YA, 0.5 * FrB / YB
    if FadA + Ka >= FadB:
        return FadA, FadA + Ka
    return FadB - Ka, FadB

def worm_bearing_options(P=None, oil_VG=320, rel=90.0, cleanliness="normal cleanliness"):
    """Life of the worm-shaft bearings for three arrangements, n = n1, oil at the sump temperature of losses().
    1 deep groove 6305 locating (all of Fa) + 6305 floating;  2 adjusted 30205 pair (X);  3 adjusted 30305 pair (X);
    4 adjusted steep-angle 31305 pair (X) - the usual answer for worm shafts."""
    import bearing
    P = dict(DEFAULT if P is None else P)
    r = worm_shaft_reactions(P)
    theta = losses(P)["theta_S"]
    Pb = dict(bearing.DEFAULT, oil_VG=oil_VG, oil_temp_C=theta, reliability_pct=rel, cleanliness=cleanliness)
    n = P["n1_rpm"]
    res = []
    def life(name, Fr, Fa):
        b = EXTRA_BEARINGS[name]
        eq = bearing.equivalent_dynamic(b, Fr, max(Fa, 0.0))
        ml = bearing.modified_life(b, eq["P"], n, Pb)
        return {"name": name, "Fr": Fr, "Fa": Fa, "P": eq["P"], "L10h": ml["L10h"], "Lnmh": ml["Lnmh"], "kappa": ml["kappa"],
                "s0": b["C0"] * 1000 / max(eq["P"], 1.0)}
    # 1 fixed-floating with deep groove: the locating bearing (A, drive end) takes all of Fa
    res.append(("6305 locating + 6305 floating", life("6305", r["RA"], r["Fa"]), life("6305", r["RB"], 0.0)))
    for nm in ("30205", "30305", "31305"):
        Y = EXTRA_BEARINGS[nm]["Y"]
        FaA, FaB = _taper_pair_X(r["RA"], r["RB"], Y, Y, r["Fa"])
        res.append(("%s pair, X arrangement" % nm, life(nm, r["RA"], FaA), life(nm, r["RB"], FaB)))
    return r, theta, res

def wheel_shaft_reactions(P=None, l2=110.0):
    """Wheel in the middle of the wheel shaft (bearing spread l2). Forces on the wheel: Ft2 (tangential), Fr (radial,
    towards its axis), axial Fa2 = Ft1 at radius d2/2 -> moment Fa2 d2/2 in the radial plane."""
    P = dict(DEFAULT if P is None else P)
    g = geometry(P)
    F = forces(P, g)
    M = F["Fa2"] * g["d2"] / 2
    RCy, RDy = F["Fr"] / 2 - M / l2, F["Fr"] / 2 + M / l2
    RCz = RDz = F["Ft2"] / 2
    return {"M_Nmm": M, "RC": math.hypot(RCy, RCz), "RD": math.hypot(RDy, RDz), "Fa": F["Fa2"], "T2": F["T2"],
            "n2": g["n2_rpm"], "l2": l2}

def wheel_bearing_life(P=None, l2=110.0, name="6209", oil_VG=320):
    """Fixed-floating with two deep groove bearings: the locating bearing (D, more loaded side) takes Fa2."""
    import bearing
    P = dict(DEFAULT if P is None else P)
    r = wheel_shaft_reactions(P, l2)
    Pb = dict(bearing.DEFAULT, oil_VG=oil_VG, oil_temp_C=losses(P)["theta_S"], cleanliness="normal cleanliness")
    b = EXTRA_BEARINGS[name]
    out = {}
    for side, Fr, Fa in (("C", r["RC"], 0.0), ("D", r["RD"], r["Fa"])):
        eq = bearing.equivalent_dynamic(b, Fr, Fa)
        ml = bearing.modified_life(b, eq["P"], r["n2"], Pb)
        out[side] = {"Fr": Fr, "Fa": Fa, "P": eq["P"], "L10h": ml["L10h"], "Lnmh": ml["Lnmh"], "kappa": ml["kappa"]}
    return r, out

# ---------------------------------------------------------------- demo
def demo_ch24():
    P = dict(DEFAULT)
    print("== Ch. 2 flank forms")
    for c, d, m, gr, u in PROFILE_TYPES:
        print("  %-27s %s\n  %27s made: %s | grinding: %s | use: %s" % (c, d, "", m, gr, u))
    print("\n== Ch. 2 starts vs ratio (rule of thumb)")
    for i in (5, 8, 12, 20.5, 40, 60):
        z1, z2 = z1_for_ratio(i)
        print("  i %5.1f -> z1 %d, z2 %d" % (i, z1, z2))
    print("\n== Ch. 3 lead angle gamma = atan(z1/q) [deg]")
    T = lead_angle_table()
    qs = (8, 9, 10, 12.5, 16)
    print("  z1 \\ q " + "".join("%8s" % q for q in qs))
    for z1 in (1, 2, 3, 4, 6):
        print("  %6d " % z1 + "".join("%8.2f" % T[(z1, q)] for q in qs))
    pa = pressure_angles(P)
    print("\n== Ch. 3 pressure angles: alpha_n %.1f -> alpha_x %.4f deg (hand %.4f)" % (pa["alpha_n"], pa["alpha_x"], pa["alpha_x_hand"]))
    print("\n== Ch. 3 q study (mx 4, z1 2, z2 41, x2 0, b2 = 0.45 (da1 + 4 mx))")
    print("  q     d1     a      gamma   vg     eta    defl um  S_delta  S_H   oil C")
    for r in q_study(P):
        print("  %-5.1f %-6.1f %-6.1f %-7.2f %-6.2f %-6.3f %-8.1f %-8.2f %-5.2f %.1f" % (
            r["q"], r["d1"], r["a"], r["gamma"], r["vg"], r["eta"], r["delta_um"], r["Sd"], r["SH"], r["theta"]))
    print("\n== Ch. 3 x2 to fit a centre distance (mx 4, d1 36, z2 41)")
    for a, x2, da2, okr in x2_fit(P):
        print("  a %.1f -> x2 %+.3f, da2 %.2f mm %s" % (a, x2, da2, "" if okr else "(outside -0.5...+1)"))
    print("\n== Ch. 4 efficiency vs sliding speed (default geometry, gamma 12.53 deg)")
    print("  vg m/s  mu_z     eta worm  eta wheel")
    for v, mu, eta, er in eta_vs_vg(P):
        print("  %-7.2f %-8.4f %-9.3f %.3f" % (v, mu, eta, er))
    rows, gopt = eta_vs_gamma()
    print("\n== Ch. 4 efficiency vs lead angle (mu 0.0347): best gamma = 45 - rho/2 = %.2f deg" % gopt)
    for gd, eta, er in rows:
        print("  gamma %5.2f: eta worm %.3f, eta wheel %.3f" % (gd, eta, er))
    Wi, Wo, eta_w, eta_f = energy_check(P)
    print("\n== Ch. 4 energy check per worm revolution: W_in %.1f N mm, W_out %.1f N mm -> eta %.5f (formula %.5f)" % (Wi, Wo, eta_w, eta_f))
    print("\n== Ch. 4 self-locking map (mu_static %.2f, running mu at vg)" % P["mu_static"])
    print("  z1  q     gamma  rho_s  rho    eta    eta_rev  lock rest  lock running")
    for z1, q, gd, rs, rr, eta, er, ls, ld in self_locking_map(P):
        print("  %-3d %-5.1f %-6.2f %-6.2f %-6.2f %-6.3f %-8.3f %-10s %s" % (z1, q, gd, rs, rr, eta, er, "yes" if ls else "no", "yes" if ld else "no"))
    for Q, lab in ((P, "default z1 2"), (dict(P, z1=1, z2=41), "z1 1 (i 41)")):
        h = holding_brake(Q)
        print("  holding %-13s T2 %.0f N m: eta_rev,static %.3f -> back-drive T1 %.2f N m at rest, %.2f N m running; brake >= %.1f N m (x2)%s" % (
            lab, h["T2"], h["eta_rev_static"], h["T1_back"], h["T1_back_run"], h["T_brake"], " - statically self-locking" if h["static_lock"] else ""))
    print("\n== Ch. 4 direction of forces (observer at the drive end, wheel above the worm)")
    for hand, rot, fa, tooth in axial_force_cases(P):
        print("  %-5s hand, %-3s: axial force on the worm %+6.0f N along x (%s); wheel tooth at the mesh moves %s" % (
            hand, rot, fa, "away from the drive end" if fa > 0 else "towards the drive end", tooth))
    r = worm_shaft_reactions(P)
    print("\n== Ch. 4 worm shaft (l1 %.0f mm, mesh in the middle): M = Fa1 d1/2 = %.0f N mm" % (r["l1"], r["M_Nmm"]))
    print("  radial plane RA %.0f, RB %.0f N; tangential plane %.0f / %.0f N -> RA %.0f N, RB %.0f N; axial %.0f N" % (
        r["RAy"], r["RBy"], r["RAz"], r["RBz"], r["RA"], r["RB"], r["Fa"]))
    s, a = worm_reactions_vs_shaft(P)
    print("  cross-check shaft.reactions(): RAy %.1f / RBy %.1f / RAz %.1f  vs  analytic %.1f / %.1f / %.1f" % (s + a))
    r, th, res = worm_bearing_options(P)
    print("\n== Ch. 4 worm-shaft bearings, n %.0f rpm, oil VG 320 at %.1f C (sump), normal cleanliness" % (P["n1_rpm"], th))
    for lab, A, B in res:
        print("  %-30s A: Fr %5.0f Fa %5.0f P %5.0f L10h %8.3g Lnmh %8.3g | B: Fr %5.0f Fa %5.0f P %5.0f L10h %8.3g Lnmh %8.3g (kappa %.2f)" % (
            lab, A["Fr"], A["Fa"], A["P"], A["L10h"], A["Lnmh"], B["Fr"], B["Fa"], B["P"], B["L10h"], B["Lnmh"], B["kappa"]))
    w, out = wheel_bearing_life(P)
    print("\n== Ch. 4 wheel shaft (l2 %.0f mm), T2 %.0f N m, n2 %.1f rpm, M = Fa2 d2/2 = %.0f N mm, 6209 fixed-floating" % (w["l2"], w["T2"], w["n2"], w["M_Nmm"]))
    for side in ("C", "D"):
        o = out[side]
        print("  %s: Fr %.0f, Fa %.0f, P %.0f N, L10h %.3g h, Lnmh %.3g h (kappa %.2f)" % (side, o["Fr"], o["Fa"], o["P"], o["L10h"], o["Lnmh"], o["kappa"]))

# ================================================================ added with guide chapters (ch56)
# ---------------------------------------------------------------- chapter 5: losses, lubrication, heat balance
def loss_breakdown(P):
    """Each loss in W and in % of the input power."""
    L = losses(P)
    P1 = P["P1_kW"] * 1000.0
    rows = [(n, L[k], 100.0 * L[k] / P1) for n, k in (("mesh (tooth friction)", "PVz"), ("bearings", "PVLP"),
                                                       ("seals", "PVD"), ("no-load (churning)", "PV0"), ("total", "PV"))]
    return rows, L

def temperature_curve(P, powers=(1.0, 2.0, 3.0, 4.0, 5.0, 6.0)):
    """Oil sump temperature vs input power (fan and no fan)."""
    out = []
    for p in powers:
        a = losses(dict(P, P1_kW=p, fan=True))
        b = losses(dict(P, P1_kW=p, fan=False))
        out.append((p, a["PV"], a["theta_S"], b["theta_S"]))
    return out

def housing_study(P, areas=(0.30, 0.451, 0.60, 0.80)):
    """Effect of housing surface (fins, larger housing) and fan on temperature and thermal limit."""
    out = []
    for A in areas:
        for fan in (False, True):
            Q = dict(P, A_housing_m2=A, fan=fan)
            out.append((A, fan, losses(Q)["theta_S"], thermal_power_limit(Q)))
    return out

def lubricant_compare(P):
    """Mineral vs polyglycol on the same drive."""
    out = {}
    for lub in ("mineral", "polyglycol"):
        R = capacity(dict(P, lubricant=lub))
        out[lub] = {"mu": R["e"]["mu"], "eta_z": R["e"]["eta_z"], "PV": R["L"]["PV"], "theta": R["L"]["theta_S"],
                    "SH": R["SH"], "SW": R["SW"], "Pth": thermal_power_limit(dict(P, lubricant=lub))}
    return out

VG_BY_VG = [  # sliding velocity up to (m/s), ISO VG mineral, ISO VG polyglycol - rough guide, check DIN 51509 / maker
    (1.0, 680, 680), (2.5, 460, 460), (5.0, 320, 320), (10.0, 220, 220), (15.0, 150, 150), (99.0, 100, 100)]

def viscosity_for_vg(vg):
    for v, m, pg in VG_BY_VG:
        if vg <= v:
            return m, pg
    return VG_BY_VG[-1][1:]

def oil_change_interval(theta, lubricant="mineral"):
    """Rule of thumb: base life at 80 C (mineral 5000 h, polyglycol 15000 h), halved for every +10 K (check maker)."""
    base = 5000.0 if lubricant == "mineral" else 15000.0
    return base * 2 ** ((80.0 - theta) / 10.0)

def duty_cycle_temperature(P, ED=0.4, t_cycle_min=30.0, mass_kg=28.0, c_J_kgK=650.0):
    """Intermittent duty: losses only while running. First-order thermal model with time constant tau = m c /(k A).
    Returns steady continuous rise, periodic maximum rise and mean rise (housing + oil lumped mass - check)."""
    L = losses(P)
    kA = L["k"] * L["A"]
    tau = mass_kg * c_J_kgK / kA                      # s
    dT_cont = L["PV"] / kA
    t_on, t_c = ED * t_cycle_min * 60.0, t_cycle_min * 60.0
    dT_max = dT_cont * (1 - math.exp(-t_on / tau)) / (1 - math.exp(-t_c / tau))
    return {"tau_min": tau / 60.0, "dT_cont": dT_cont, "dT_max": dT_max, "dT_mean": ED * dT_cont,
            "theta_cont": P["theta_0"] + dT_cont, "theta_max": P["theta_0"] + dT_max}

def startup(P):
    """Start-up from rest: friction mu_static instead of the running value -> lower efficiency, higher worm torque."""
    g, e = geometry(P), efficiency(P)
    F = forces(P, g, e)
    rs = math.atan(P["mu_static"] / math.cos(g["alpha_n"]))
    eta_s = math.tan(g["gamma"]) / math.tan(g["gamma"] + rs)
    T1_start = F["T2"] / (g["u"] * eta_s)            # worm torque needed to give the running output torque from rest
    return {"mu_run": e["mu"], "eta_run": e["eta_z"], "mu_static": P["mu_static"], "eta_start": eta_s,
            "T1_run": F["T1"], "T1_start": T1_start, "ratio": T1_start / F["T1"]}


# ---------------------------------------------------------------- chapter 6: load capacity studies
def pitting_breakdown(P):
    R = capacity(P)
    F = R["F"]
    mat = WHEEL_MATERIALS[P["wheel_material"]]
    return {"T2": F["T2"] * P["KA"], "p_star_m": R["p_star_m"], "E_red": R["E_red"], "a": P["a"], "sHm": R["sHm"],
            "sHlim": mat["sHlim"], "ZN": R["ZN"], "Zv": R["Zv"], "ZS": R["ZS"], "Zoil": R["Zoil"], "sHG": R["sHG"], "SH": R["SH"]}

def wear_life(P):
    """Wear grows linearly with load cycles -> wear rate and hours until the wear limit."""
    R = capacity(P)
    rate = R["dW"] / P["Lh"] * 1000.0                # mm per 1000 h
    return {"dW": R["dW"], "dWlim": R["dWlim"], "rate_mm_1000h": rate, "h_to_limit": R["dWlim"] / rate * 1000.0,
            "SW": R["SW"]}

def worn_root_curve(P, fractions=(0.0, 0.25, 0.5, 0.75, 1.0)):
    """Root safety as the wheel teeth wear down to the wear limit (fraction of delta_Wlim)."""
    R = capacity(P)
    g = R["g"]
    out = []
    for fr in fractions:
        s = R["sft2"] - fr * R["dWlim"] / math.cos(g["gamma"])
        YF = 2.9 * P["mx"] / s
        tF = R["F"]["Ft2"] * P["KA"] / (R["b2R"] * P["mx"]) * 0.5 * YF / math.cos(g["gamma"])
        out.append((fr, fr * R["dWlim"], s, YF, tF, WHEEL_MATERIALS[P["wheel_material"]]["tFlim"] / tF))
    return out

def deflection_study(P, l1s=(120.0, 140.0, 160.0, 180.0, 200.0), d1s=(32.0, 36.0, 40.0)):
    """Worm deflection safety vs bearing spread l1 and worm diameter d1 (a fixed: x2 changes with d1)."""
    out = []
    for d1 in d1s:
        for l1 in l1s:
            R = capacity(dict(P, d1=d1, l1=l1))
            out.append((d1, l1, R["g"]["x2"], R["delta_m"], R["Sd"], R["e"]["eta_z"], R["SH"]))
    return out

def safety_summary(P):
    R = capacity(P)
    return [("pitting S_H", R["SH"], P["SHmin"]), ("wear S_W", R["SW"], P["SWmin"]), ("root (new) S_F", R["SF"], P["SFmin"]),
            ("root (worn) S_F", R["SF_worn"], P["SFmin"]), ("deflection S_delta", R["Sd"], P["Sdmin"]),
            ("temperature theta_lim / theta_S", R["ST"], 1.0)]

def _bisect(P, ok_fn, lo=0.01, hi=100.0):
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if ok_fn(dict(P, P1_kW=mid)):
            lo = mid
        else:
            hi = mid
    return lo

def max_power_criteria(P):
    """Highest input power for each criterion alone -> the smallest one limits the drive."""
    crit = {
        "pitting": lambda Q: capacity(Q)["SH"] >= Q["SHmin"],
        "wear": lambda Q: capacity(Q)["SW"] >= Q["SWmin"],
        "root (worn)": lambda Q: capacity(Q)["SF_worn"] >= Q["SFmin"],
        "deflection": lambda Q: capacity(Q)["Sd"] >= Q["Sdmin"],
        "thermal": lambda Q: losses(Q)["theta_S"] <= Q["theta_lim"],
    }
    res = {k: _bisect(P, f) for k, f in crit.items()}
    lim = min(res, key=res.get)
    return res, lim

def material_study(P):
    out = []
    for m in WHEEL_MATERIALS:
        R = capacity(dict(P, wheel_material=m))
        res, lim = max_power_criteria(dict(P, wheel_material=m))
        out.append((m, R["E_red"], R["SH"], R["SW"], R["SF_worn"], R["e"]["eta_z"], res[lim], lim))
    return out

BRONZE_NOTES = [  # material, structure / why, typical use (check supplier data)
    ("CuSn12Ni2-C-GZ", "tin bronze, about 12 % Sn + 2 % Ni; Ni refines the grain and raises strength and wear resistance; "
     "centrifugal casting gives dense, fine-grained rim", "standard high-duty worm wheels"),
    ("CuSn12-C-GZ", "tin bronze without Ni; alpha + delta structure, hard delta phase carries the load", "medium duty"),
    ("CuSn12-C-GS", "same alloy, sand cast: slow cooling -> coarse grain, porosity -> lower strength and wear resistance",
     "single parts, large wheels, low duty"),
    ("CuAl10Fe5Ni5-C-GZ", "aluminium bronze: high strength, but poor running-in and higher wear against steel; needs a "
     "very hard, finely ground worm (>= 58 HRC) and high viscosity oil", "high load, low speed, shock"),
    ("EN-GJS-400-15", "ductile iron: cheap, good for low sliding speed (< 2 m/s check); poor emergency running",
     "hand drives, slow adjusting drives"),
]


# ---------------------------------------------------------------- demo
def demo_ch56():
    P = dict(DEFAULT)
    print("== 5.1 Loss breakdown (default drive, %.1f kW at %.0f rpm)" % (P["P1_kW"], P["n1_rpm"]))
    rows, L = loss_breakdown(P)
    for n, w, pc in rows:
        print("  %-24s %7.1f W  %5.2f %%" % (n, w, pc))
    print("  total efficiency %.4f" % L["eta_total"])

    print("\n== 5.2 Oil sump temperature vs input power (A %.3f m^2, ambient %.0f C)" % (L["A"], P["theta_0"]))
    print("  P1 kW   P_V W   theta fan C   theta no fan C")
    for p, pv, tf, tn in temperature_curve(P):
        print("  %5.1f  %6.0f   %8.1f      %8.1f" % (p, pv, tf, tn))

    print("\n== 5.3 Housing surface and fan -> temperature at 3 kW and thermal power limit")
    for A, fan, th, pth in housing_study(P):
        print("  A %.3f m^2  fan %-5s  theta %6.1f C   P_th %5.2f kW" % (A, fan, th, pth))

    print("\n== 5.4 Mineral oil vs polyglycol")
    for lub, d in lubricant_compare(P).items():
        print("  %-10s mu_z %.4f  eta_z %.4f  P_V %5.0f W  theta %5.1f C  S_H %.2f  S_W %.2f  P_th %.2f kW" % (
            lub, d["mu"], d["eta_z"], d["PV"], d["theta"], d["SH"], d["SW"], d["Pth"]))

    g = geometry(P)
    m, pg = viscosity_for_vg(g["vg"])
    print("\n== 5.5 Viscosity for vg %.2f m/s: ISO VG %d (mineral) / VG %d (polyglycol)  (check)" % (g["vg"], m, pg))
    for v, a, b in VG_BY_VG:
        print("  vg <= %5.1f m/s : VG %d / %d" % (v, a, b))

    print("\n== 5.6 Oil-change interval vs sump temperature (rule of thumb, check)")
    for th in (60, 70, 80, 90, 100):
        print("  %3d C : mineral %6.0f h   polyglycol %6.0f h" % (th, oil_change_interval(th, "mineral"), oil_change_interval(th, "polyglycol")))

    print("\n== 5.7 Intermittent duty (cycle 30 min) at 4.5 kW")
    Q = dict(P, P1_kW=4.5)
    for ED in (1.0, 0.6, 0.4, 0.25):
        d = duty_cycle_temperature(Q, ED=ED)
        print("  ED %3.0f %%: tau %.0f min, continuous %.1f C, periodic max %.1f C, mean rise %.1f K" % (
            100 * ED, d["tau_min"], d["theta_cont"], d["theta_max"], d["dT_mean"]))

    s = startup(P)
    print("\n== 5.8 Start-up from rest: mu %.3f -> %.3f, eta %.3f -> %.3f, worm torque %.2f -> %.2f N m (x %.2f)" % (
        s["mu_run"], s["mu_static"], s["eta_run"], s["eta_start"], s["T1_run"], s["T1_start"], s["ratio"]))
    for vg in (0.0, 0.1, 0.5, 1.0, 2.8, 5.0, 10.0):
        print("  vg %5.1f m/s : mu_0T %.4f" % (vg, mu_0T(vg, "mineral")))

    print("\n== 6.1 Pitting factor breakdown")
    b = pitting_breakdown(P)
    print("  T2 %.1f N m, p*_m %.3f, E_red %.0f MPa, a %.0f mm -> sigma_Hm %.1f MPa" % (b["T2"], b["p_star_m"], b["E_red"], b["a"], b["sHm"]))
    print("  sigma_Hlim %.0f x Z_N %.3f x Z_v %.3f x Z_S %.3f x Z_oil %.2f = sigma_HG %.1f MPa -> S_H %.3f" % (
        b["sHlim"], b["ZN"], b["Zv"], b["ZS"], b["Zoil"], b["sHG"], b["SH"]))

    w = wear_life(P)
    print("\n== 6.2 Wear life: wear %.3f mm in %.0f h -> %.4f mm / 1000 h; limit %.3f mm reached after %.0f h (S_W %.2f)" % (
        w["dW"], P["Lh"], w["rate_mm_1000h"], w["dWlim"], w["h_to_limit"], w["SW"]))

    print("\n== 6.3 Tooth root while the wheel wears")
    print("  wear fraction  wear mm  s_ft2 mm   Y_F    tau_F MPa   S_F")
    for fr, dw, s2, YF, tF, SF in worn_root_curve(P):
        print("  %10.2f  %8.3f  %8.3f  %6.3f  %8.2f  %6.2f" % (fr, dw, s2, YF, tF, SF))

    print("\n== 6.4 Worm deflection vs worm diameter and bearing spread")
    print("  d1 mm  l1 mm   x2      delta mm  S_delta  eta_z   S_H")
    for d1, l1, x2, dm, Sd, eta, SH in deflection_study(P):
        print("  %5.0f  %5.0f  %+6.3f  %8.4f  %6.2f  %6.4f  %5.2f" % (d1, l1, x2, dm, Sd, eta, SH))

    print("\n== 6.5 Safety summary (default drive)")
    for n, v, mn in safety_summary(P):
        print("  %-32s %6.2f  (min %.2f)  %s" % (n, v, mn, "OK" if v >= mn else "NOT OK"))

    res, lim = max_power_criteria(P)
    print("\n== 6.6 Maximum input power for each criterion")
    for k, v in res.items():
        print("  %-12s %6.2f kW%s" % (k, v, "   <- limits" if k == lim else ""))

    print("\n== 6.7 Wheel material study (same drive, 3 kW)")
    for m, Er, SH, SW, SFw, eta, pmax, lim in material_study(P):
        print("  %-46s E_red %6.0f  S_H %.2f  S_W %.2f  S_F worn %.2f  eta %.3f  P_max %5.2f kW (%s)" % (m, Er, SH, SW, SFw, eta, pmax, lim))

# ================================================================ added with guide chapters (ch78)
import math
import os
import sys

# ---------------------------------------------------------------- 7.1 process chains
PROCESS_CHAINS_WORM = [  # route, DIN 3974 grade typically reached (check), volume, relative cost (1 = lowest)
    ("turned (single-point thread tool) soft, not hardened", "9-10", "single parts, repair, low speed", 1),
    ("thread milled (disc cutter) soft, not hardened", "8-9", "small to medium lots", 2),
    ("whirled soft + case hardened + ground", "5-6", "medium to high volume (standard industrial drives)", 3),
    ("milled / whirled soft + case hardened + ground + polished", "4-5", "high efficiency drives, low wear", 4),
    ("hard whirled after hardening (no grinding)", "6-7", "medium lots, no thread grinder available", 3),
    ("rolled thread (cold forming), induction hardened", "8-9", "very high volume, small modules (actuators)", 1),
]
PROCESS_CHAINS_WHEEL = [  # route, grade, volume, relative cost
    ("bronze rim centrifugal cast, shrunk / bolted on hub, hobbed radially", "8-9", "standard, small lead angle", 2),
    ("bronze rim centrifugal cast, hobbed tangentially (taper hob)", "7-8", "large lead angle, precision", 3),
    ("bronze rim, fly-cutter (single tooth, tangential feed)", "8-9", "prototypes, spare parts, one-offs", 2),
    ("continuous cast / sand cast bronze, hobbed", "9-10", "low duty, large wheels", 1),
    ("injection moulded plastic (POM / PA) wheel", "10-11", "very high volume, small power", 1),
]

# ---------------------------------------------------------------- 7.2 worm blank and heat treatment
def worm_heat_treatment(P=None):
    """Case depth target and grinding stock for a case-hardened worm (rules of thumb - check heat-treatment shop)."""
    P = P or DEFAULT
    g = geometry(P)
    mn = g["mn"]
    chd = min(max(0.15 * mn, 0.3), 1.6)              # case hardening depth (550 HV) after grinding, mm
    stock = 0.08 + 0.02 * mn                         # grinding stock per flank, mm
    chd_before = chd + stock                         # carburise for this depth before grinding
    t_h = (chd_before / 0.5) ** 2 * 2.0              # carburising time h at ~930 C, CHD ~ k sqrt(t), k ~ 0.5 mm/sqrt(2h) (check)
    return {"mn": mn, "CHD_final": chd, "stock_per_flank": stock, "CHD_carburise": chd_before, "t_carburise_h": t_h,
            "surface_HRC": "58-62", "core_MPa": "900-1200 (16MnCr5 / 20MnCr5)"}

# ---------------------------------------------------------------- 7.3 thread cutting cycle time
def worm_thread_time(P=None, method="whirling", vc=None, ap=0.25, f_mill=0.08, n_work=8.0, z_ring=4):
    """Machining time of the worm thread (all starts), one worm. Typical cutting data (check tool maker)."""
    P = P or DEFAULT
    g = geometry(P)
    L = max(g["b1_geo"], g["b1_emp"]) + 2 * g["px"]  # thread length + run-in / run-out
    h = (2 * P["haP"] + P["cP"]) * P["mx"]           # thread depth
    if method == "turning":
        vc = vc or 120.0                             # m/min, carbide, soft 16MnCr5
        n = vc * 1000 / (math.pi * g["da1"])
        n = min(n, 1000.0 * 60 / g["pz"] * 0.1)      # feed per rev = lead: limit the axial speed to 6 m/min
        passes = math.ceil(h / ap) + 2               # + spring passes
        t = P["z1"] * passes * (L / (g["pz"] * n) + 0.05)   # + 3 s return per pass
    elif method == "milling":
        vc = vc or 160.0                             # disc cutter, carbide
        # one pass per start; workpiece turns slowly, feed per cutter tooth f_mill, cutter 12 teeth, D 100 mm
        n_c = vc * 1000 / (math.pi * 100.0)
        vf = f_mill * 12 * n_c                       # mm/min along the helix (approx.)
        helix = L / math.sin(g["gamma"]) if g["gamma"] > 0 else L
        t = P["z1"] * (helix / vf + 0.3)
    elif method == "whirling":
        # whirling ring with z_ring inserts around the worm, workpiece n_work rpm, one pass per start
        t = P["z1"] * (L / (g["pz"] * n_work) + 0.2)
        vc = vc or 200.0
    elif method == "grinding":
        # thread grinding: 3 roughing + 2 finishing passes per flank pair, workpiece 20 rpm, dressing every start
        passes = 5
        t = P["z1"] * (passes * L / (g["pz"] * 20.0) + 0.5)
    else:
        raise ValueError(method)
    return {"method": method, "L_mm": L, "h_mm": h, "t_min": t}

# ---------------------------------------------------------------- 7.4 grinding wheel profile vs flank form
def _ground_profile(P, Rw, n_r=9, alpha_wheel_deg=None):
    """Axial-section flank of a worm ground with a straight-sided (double-cone) disc wheel of tip radius Rw, set at the
    lead angle (ZK-type generation). Numerical envelope: a worm point is removed if, during the screw motion, it
    enters the wheel. Returns list of (r, z_flank)."""
    g = geometry(P)
    r1, rf1, ra1 = g["d1"] / 2, g["df1"] / 2, g["da1"] / 2
    gam, pz = g["gamma"], g["pz"]
    aw = math.radians(alpha_wheel_deg if alpha_wheel_deg is not None else P["alpha_n_deg"])
    A = rf1 + Rw                                     # wheel centre: tip reaches the worm root
    ax = (0.0, -math.sin(gam), math.cos(gam))        # wheel axis (worm axis = z, wheel centre on x)
    t0 = g["px"] * math.cos(gam) / 4 - (r1 - rf1) * math.tan(aw)   # wheel half-width at its tip
    def inside(x, y, z):
        dx, dy, dz = x - A, y, z
        s = dy * ax[1] + dz * ax[2]
        rho = math.sqrt(max(dx * dx + dy * dy + dz * dz - s * s, 0.0))
        return rho <= Rw and abs(s) <= t0 + (Rw - rho) * math.tan(aw)
    phis = [-0.7 + 1.4 * k / 280 for k in range(281)]
    def removed(r, z):
        for ph in phis:                              # point (r, 0, z) after screw motion by phi
            x, y = r * math.cos(ph), r * math.sin(ph)
            if inside(x, y, z + pz * ph / (2 * math.pi)):
                return True
        return False
    out = []
    for k in range(n_r):
        r = rf1 + 0.25 * (r1 - rf1) + (ra1 - rf1 - 0.25 * (r1 - rf1)) * k / (n_r - 1)
        lo, hi = 0.0, g["px"] / 2
        for _ in range(26):
            mid = 0.5 * (lo + hi)
            if removed(r, mid):
                lo = mid
            else:
                hi = mid
        out.append((r, lo))
    return out

def grinding_profile_study(P=None, wheel_diameters=(500.0, 400.0, 300.0, 200.0)):
    """Generated axial flank: angle and convexity (deviation from the chord) vs grinding wheel diameter (check)."""
    P = P or DEFAULT
    rows = []
    for Dw in wheel_diameters:
        pr = _ground_profile(P, Dw / 2)
        (r0, z0), (r9, z9) = pr[0], pr[-1]
        ang = math.degrees(math.atan((z9 - z0) / (r9 - r0)))
        dev = max(abs((z - z0) - (z9 - z0) * (r - r0) / (r9 - r0)) for r, z in pr)
        rows.append({"Dw": Dw, "axial_flank_deg": ang, "convexity_um": dev * 1000, "space_at_r1_mm": 2 * _interp(pr, P["d1"] / 2)})
    return rows

def _interp(pr, r):
    for (ra, za), (rb, zb) in zip(pr, pr[1:]):
        if ra <= r <= rb:
            return za + (zb - za) * (r - ra) / (rb - ra)
    return pr[-1][1]

FLANK_FORMS = [  # form, straight line lies in, tool, grinding
    ("ZA", "axial section (Archimedean spiral in the transverse section)", "lathe tool on centre height",
     "needs a wheel with corrected (convex) profile; hard to grind exactly - used soft or small sizes"),
    ("ZN", "normal section of the thread (or of the space)", "lathe tool tilted to the lead angle; disc cutter",
     "approximate grinding with straight wheel + correction"),
    ("ZI", "transverse section is an involute; straight lines tangent to the base cylinder (involute helicoid)",
     "hob-like or flat-sided wheel tangent to the base cylinder at the base lead angle",
     "exact grinding with the FLAT side of a wheel - preferred for ground worms"),
    ("ZK", "no straight line; generated by a double-cone (straight-sided) disc wheel / cutter",
     "disc milling cutter, then grinding with the same wheel shape",
     "profile depends on wheel diameter: the wheel shrinks by dressing -> CNC dressing compensates"),
    ("ZC", "concave flank (circular-arc wheel profile, Niemann 'Cavex')", "convex circular-arc wheel",
     "convex-concave contact, thick oil film, higher capacity; special grinding"),
]

# ---------------------------------------------------------------- 7.5 hob for the wheel
def hob_design(P=None, k_over=0.15, regrind_depth=0.3, relief_deg=10.0, vc_hob=50.0, f_radial=0.15, f_tang=1.0):
    """Worm-wheel hob: oversize, lead angle mismatch, gashes, number of regrinds, hobbing time (radial / tangential).
    Typical values - check hob maker and DIN 3975 / DIN 8002 style hob data."""
    P = P or DEFAULT
    g = geometry(P)
    mx, z1, z2 = P["mx"], P["z1"], P["z2"]
    d0 = g["d1"] + k_over * mx                       # new hob reference diameter
    gam0 = math.atan(z1 * mx / d0)
    n_g = max(6, round(math.pi * d0 / (1.1 * g["px"])))   # gashes (cutting edges per turn)
    dr_per = regrind_depth * math.tan(math.radians(relief_deg))   # radius loss per regrind
    n_reg = int(((d0 - g["d1"]) / 2) / dr_per)
    h = (2 * P["haP"] + P["cP"]) * mx
    n0 = vc_hob * 1000 / (math.pi * (d0 + 2 * mx))   # hob rpm
    t_wheel_rev = z2 / (z1 * n0)                     # min per wheel revolution
    t_rad = h / f_radial * t_wheel_rev + 3 * t_wheel_rev          # infeed + 3 wheel turns sizing
    L_t = 2 * math.sqrt(max((d0 / 2 + mx * 1.2) ** 2 - (P["a"] - g["da2"] / 2 - 0.0) ** 2, 0.0)) + 3 * g["px"]   # taper + engagement
    t_tan = L_t / f_tang * t_wheel_rev + 2 * t_wheel_rev
    method = "tangential (taper hob)" if g["gamma_deg"] > 8.0 else "radial infeed acceptable"
    return {"d0": d0, "gamma0_deg": math.degrees(gam0), "dgamma_deg": g["gamma_deg"] - math.degrees(gam0), "gashes": n_g,
            "dr_per_regrind": dr_per, "n_regrinds": n_reg, "n0_rpm": n0, "t_wheel_rev_min": t_wheel_rev,
            "t_radial_min": t_rad, "L_tangential_mm": L_t, "t_tangential_min": t_tan, "method": method}

def fly_cutter_time(P=None, vc=45.0, f_t=0.08):
    """Fly-cutter (one tooth on an arbor, tangential feed f_t per wheel revolution)."""
    P = P or DEFAULT
    g = geometry(P)
    D = g["d1"] + 2 * P["mx"]
    n0 = vc * 1000 / (math.pi * D)
    t_rev = P["z2"] / (P["z1"] * n0)
    L_t = 2 * math.sqrt(max((D / 2) ** 2 - (P["a"] - g["da2"] / 2) ** 2, 0.0)) + g["px"]
    return {"n0_rpm": n0, "L_t_mm": L_t, "t_min": L_t / f_t * t_rev, "t_wheel_rev_min": t_rev}

# ---------------------------------------------------------------- 7.6 bronze rim on cast-iron hub
def _shaft():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import shaft  # noqa: E402  (M3: Lame press fit)
    return shaft

def rim_shrink_fit(P=None, rim_under_root=2.0, di_hub=100.0, U_min_um=52.0, U_max_um=117.0, mu=0.12, Re_rim=180.0,
                   alpha_rim=17.5e-6, alpha_hub=11.0e-6, E_hub=169000.0, S_req=2.0):
    """Bronze rim shrunk on a ductile-iron hub (H7/s6 at d ~ 138: U 52 ... 117 um - check ISO 286).
    Uses shaft.press_fit (Lame). The bronze expands more than the iron: interference is LOST when warm."""
    P = P or DEFAULT
    sh = _shaft()
    R = capacity(P)
    g, F, L = R["g"], R["F"], R["L"]
    d = round(g["df2"] - 2 * rim_under_root * P["mx"])
    f = {"d": d, "D_hub": g["df2"], "di_shaft": di_hub, "l": P["b2"], "Rz_shaft": 6.3, "Rz_hub": 6.3,
         "E_shaft": E_hub, "E_hub": WHEEL_MATERIALS[P["wheel_material"]]["E"], "nu": 0.32, "mu": mu, "Re_hub": Re_rim}
    dT = L["theta_S"] - P["theta_0"]
    dU = (alpha_rim - alpha_hub) * dT * d * 1000      # um lost at operating temperature
    cold = sh.press_fit(f, U_min_um)
    warm = sh.press_fit(f, max(U_min_um - dU, 0.0))
    hi = sh.press_fit(f, U_max_um)
    T2, Fa2 = F["T2"] * P["KA"], F["Fa2"]
    Freq = math.hypot(2000 * T2 / d, Fa2)             # tangential + axial force on the joint
    Fcap = lambda r: math.pi * d * P["b2"] * r["p"] * mu
    shrink_dT = (U_max_um / 1000 + 0.001 * d) / (alpha_rim * d)
    lo, hi_u = 0.0, 2000.0                            # interference needed for S_req when warm (bisection)
    for _ in range(50):
        mid = 0.5 * (lo + hi_u)
        if Fcap(sh.press_fit(f, max(mid - dU, 0.0))) / Freq < S_req:
            lo = mid
        else:
            hi_u = mid
    U_req = hi_u
    yield_req = sh.press_fit(f, U_req)["S_hub"]
    return {"U_req_um": U_req, "S_rim_at_U_req": yield_req, "d": d, "D_rim": g["df2"], "dT_oper": dT, "dU_um": dU, "p_cold": cold["p"], "p_warm": warm["p"],
            "S_cold": Fcap(cold) / Freq, "S_warm": Fcap(warm) / Freq, "S_rim_yield": hi["S_hub"], "sv_rim": hi["sv_hub"],
            "shrink_dT": shrink_dT, "ok": Fcap(warm) / Freq >= S_req and hi["S_hub"] >= 1.2}

def rim_bolts(P=None, n=6, d_bolt=8.0, tau_allow=120.0, Dk=None):
    """Bolted rim with fitted bolts (shear only, conservative). tau_allow for 8.8 fitted bolts ~ 0.6 x 640 / S (check)."""
    P = P or DEFAULT
    R = capacity(P)
    g, F = R["g"], R["F"]
    Dk = Dk or g["df2"] - 2 * 2.0 * P["mx"] - 2 * d_bolt
    Fb = 2000 * F["T2"] * P["KA"] / (Dk * n)
    tau = Fb / (math.pi * d_bolt ** 2 / 4)
    return {"Dk": Dk, "F_bolt": Fb, "tau": tau, "S": tau_allow / tau}

# ---------------------------------------------------------------- 7.7 inspection
WIRE_SERIES = [0.17, 0.22, 0.25, 0.29, 0.335, 0.39, 0.455, 0.53, 0.62, 0.725, 0.895, 1.1, 1.35, 1.65, 2.05, 2.55,
               3.2, 4.0, 5.05, 6.35, 8.0, 10.0]   # common measuring-wire diameters mm (check DIN 2269 / gauge maker)

def wire_check(P=None, D=None, A_sx_upper_um=-30.0, A_sx_lower_um=-80.0):
    """Over-wire value with a real wire: contact height on the flank must lie between root clearance and tip.
    Tolerance of M from the axial thickness allowances: dM = dsx / tan(alpha_x) (rack approximation, check)."""
    P = P or DEFAULT
    g = geometry(P)
    ow = over_wires(P, g)
    D = D or min(WIRE_SERIES, key=lambda w: abs(w - ow["DM"]))
    ax = g["alpha_x"]
    e = g["px"] - ow["sx1"]                           # space width at the reference line
    yc = (D / (2 * math.cos(ax)) - e / 2) / math.tan(ax)          # wire centre above the reference line
    y_contact = yc - D / 2 * math.sin(ax)
    M = P["d1"] + 2 * yc + D
    r_c = P["d1"] / 2 + y_contact
    ok = g["df1"] / 2 + P["cP"] * P["mx"] < r_c < g["da1"] / 2 - 0.1 * P["mx"]
    tan_ax = math.tan(ax)
    M_up = M + A_sx_upper_um / 1000 / tan_ax
    M_lo = M + A_sx_lower_um / 1000 / tan_ax
    return {"D_best": ow["DM"], "D": D, "M_nominal": M, "M_max": M_up, "M_min": M_lo, "r_contact": r_c, "contact_ok": ok}

def backlash_budget(P=None, A_s2_um=(-60.0, -140.0), A_sx1_um=(-30.0, -80.0), fa_um=35.0, alpha_housing=11e-6,
                    dT_housing=35.0, dT_worm=45.0, dT_wheel=40.0):
    """Circumferential backlash at the wheel reference circle: tooth-thickness allowances, centre-distance tolerance
    +- fa, temperature (housing grows -> more backlash; gears grow -> less). jt from da: 2 da tan(alpha_x)."""
    P = P or DEFAULT
    g = geometry(P)
    ta = math.tan(g["alpha_x"])
    j_min = -(A_s2_um[0] + A_sx1_um[0]) - 2 * fa_um * ta
    j_max = -(A_s2_um[1] + A_sx1_um[1]) + 2 * fa_um * ta
    da_th = (P["a"] * alpha_housing * dT_housing - g["d1"] / 2 * 11.5e-6 * dT_worm - g["d2"] / 2 * 17.5e-6 * dT_wheel) * 1000
    j_th = 2 * da_th * ta
    return {"j_min_cold": j_min, "j_max_cold": j_max, "da_thermal_um": da_th, "dj_thermal": j_th,
            "j_min_warm": j_min + j_th, "j_max_warm": j_max + j_th, "dj_per_10um_da": 20 * ta}

# ---------------------------------------------------------------- 7.8 contact pattern, wheel axial position
def pattern_gain(frac1, frac2, shim_mm, b2):
    """Calibrate on the first gearbox: mark with blue, move the wheel axially by a known shim, mark again.
    k = pattern movement (mm along the face) per mm of wheel shift."""
    return (frac2 - frac1) * b2 / shim_mm

def pattern_setting(P=None, measured_frac=0.5, k_gain=8.0, target_frac=0.65):
    """Wheel centre-plane setting from a marking-blue print. measured_frac = centre of the pattern measured from the
    ENTRY edge of the wheel face (0 = entry edge, 1 = leaving edge). The hob is oversize, so the pattern is a small
    'bearing island' that moves k_gain times faster than the wheel (k_gain typical 5-15 - calibrate with pattern_gain).
    Axial tolerance of the centre plane: typical guideline vs module (check gearbox maker / DIN 3964)."""
    P = P or DEFAULT
    mx = P["mx"]
    tol = 0.03 if mx <= 3 else (0.05 if mx <= 6 else 0.08)
    shift = (target_frac - measured_frac) * P["b2"] / k_gain     # + = move the wheel towards the leaving side
    return {"tol_mm": tol, "measured": measured_frac, "target": target_frac, "shift_mm": shift,
            "pattern_move_in_tol_mm": k_gain * tol, "ok": 0.55 <= measured_frac <= 0.75}

# ---------------------------------------------------------------- 7.9 running-in
def running_in(P=None, steps=((0.25, 2.0), (0.5, 3.0), (0.75, 5.0), (1.0, 10.0)), mu_factor=1.3):
    """Load steps (fraction of rated power, hours). During running-in friction is higher (mu x mu_factor, check):
    the oil temperature of each step is computed with the raised friction."""
    P = P or DEFAULT
    g = geometry(P)
    rows = []
    for frac, hours in steps:
        Q = dict(P, P1_kW=P["P1_kW"] * frac)
        e = dict(efficiency(Q, g))
        mu = e["mu"] * mu_factor
        rho = math.atan(mu / math.cos(g["alpha_n"]))
        e.update(mu=mu, rho=rho, eta_z=math.tan(g["gamma"]) / math.tan(g["gamma"] + rho))
        Ls = losses(Q, g, e)
        Ln = losses(Q, g)
        rows.append({"frac": frac, "hours": hours, "P1": Q["P1_kW"], "eta_runin": e["eta_z"], "theta_runin": Ls["theta_S"],
                     "theta_after": Ln["theta_S"], "ok": Ls["theta_S"] <= P["theta_lim"]})
    return rows

DEFECTS = [  # symptom, likely cause, remedy
    ("pattern at the entry side, temperature high", "wheel centre plane offset, hob too small / worn", "shift wheel axially, check hob oversize"),
    ("pattern at the tip / root of the wheel tooth", "centre distance error or wrong hob diameter", "check a, hob d0; re-hob with correct hob"),
    ("fast wear, bronze particles in oil, rising backlash", "no running-in, rough worm (Ra > 0.5), wrong oil, too hot", "polish worm, running-in steps, oil change, PG oil"),
    ("pitting on the wheel flanks (grey spots)", "overload, sigma_H too high, oil too thin", "check S_H, larger a or better bronze"),
    ("scuffing / seizure (smeared bronze)", "oil starvation, sharp edges, no entry gap", "oil level, chamfers, pattern to leaving side"),
    ("noise / vibration once per worm turn", "worm run-out, pitch error, bent worm shaft", "check run-out (DIN 3974), worm deflection"),
    ("rim slips on the hub when warm", "bronze expands more than iron; interference lost", "screws / pins in the joint, bolted rim"),
    ("heat: oil above 90-100 C", "power above the thermal limit, no fan, dirty fins", "fan, cooler, PG oil, larger size"),
]

# ---------------------------------------------------------------- chapter 8: worked example
EXAMPLE_WORM = {
    "name": "Lifting-table drive 1.1 kW, i 31, a 80 (worked example chapter 8)",
    "a": 80.0, "z1": 1, "z2": 31, "mx": 4.0, "d1": 36.0, "b2": 27.0,
    "P1_kW": 1.1, "n1_rpm": 1450.0, "KA": 1.25, "Lh": 10000.0,
    "l1": 130.0, "d_shaft1": 25.0, "d_shaft2": 40.0, "P_V0_W": 25.0, "fan": True,
}

def worm_design_example():
    P = dict(DEFAULT, **EXAMPLE_WORM)
    R = capacity(P)
    return P, R

def demo_ch78():
    P = dict(DEFAULT)
    print("== 7.1 process chains (typical, check)")
    for r, gr, v, c in PROCESS_CHAINS_WORM:
        print("  worm  %-58s grade %-5s cost %d  %s" % (r, gr, c, v))
    for r, gr, v, c in PROCESS_CHAINS_WHEEL:
        print("  wheel %-58s grade %-5s cost %d  %s" % (r, gr, c, v))
    print("\n== 7.2 worm heat treatment (rules of thumb, check)")
    h = worm_heat_treatment(P)
    print("  mn %.3f mm: CHD after grinding %.2f mm, grinding stock %.3f mm/flank -> carburise to %.2f mm (~%.1f h at 930 C); %s HRC" % (
        h["mn"], h["CHD_final"], h["stock_per_flank"], h["CHD_carburise"], h["t_carburise_h"], h["surface_HRC"]))
    print("\n== 7.3 thread machining time per worm (typical data, check)")
    for m in ("turning", "milling", "whirling", "grinding"):
        t = worm_thread_time(P, m)
        print("  %-9s L %.1f mm, depth %.1f mm -> %.2f min" % (m, t["L_mm"], t["h_mm"], t["t_min"]))
    print("\n== 7.4 flank forms")
    for f, line, tool, grd in FLANK_FORMS:
        print("  %s: straight in %s | %s | %s" % (f, line, tool, grd))
    print("  ZK generation with a straight-sided disc wheel (alpha 20 deg), axial-section flank vs wheel diameter:")
    for r in grinding_profile_study(P):
        print("    Dw %5.0f mm: axial flank angle %.3f deg, convexity %.1f um, space width at d1 %.4f mm" % (
            r["Dw"], r["axial_flank_deg"], r["convexity_um"], r["space_at_r1_mm"]))
    print("\n== 7.6 wheel hob and hobbing time (typical, check)")
    hb = hob_design(P)
    print("  hob d0 %.2f mm (oversize %.2f mm), lead angle %.3f deg (worm %.3f, difference %.3f deg), %d gashes" % (
        hb["d0"], hb["d0"] - P["d1"], hb["gamma0_deg"], geometry(P)["gamma_deg"], hb["dgamma_deg"], hb["gashes"]))
    print("  radius loss %.3f mm per regrind -> %d regrinds until d0 = d1" % (hb["dr_per_regrind"], hb["n_regrinds"]))
    print("  hob %.0f rpm, %.3f min per wheel turn; radial infeed %.1f min, tangential %.1f min (L %.1f mm) -> %s" % (
        hb["n0_rpm"], hb["t_wheel_rev_min"], hb["t_radial_min"], hb["t_tangential_min"], hb["L_tangential_mm"], hb["method"]))
    fc = fly_cutter_time(P)
    print("  fly-cutter: %.0f rpm, tangential travel %.1f mm -> %.0f min (%.1f h)" % (fc["n0_rpm"], fc["L_t_mm"], fc["t_min"], fc["t_min"] / 60))
    print("\n== 7.5 bronze rim on ductile-iron hub")
    rs = rim_shrink_fit(P)
    print("  joint d %d mm, rim outer %.1f, b2 %.0f; oil %.1f C -> bronze/iron expansion loses %.1f um of interference" % (
        rs["d"], rs["D_rim"], P["b2"], rs["dT_oper"] + P["theta_0"], rs["dU_um"]))
    print("  p cold %.1f MPa -> S_slip %.2f; p warm %.1f MPa -> S_slip %.2f; rim at U_max: sigma_v %.0f MPa, S %.2f; shrink dT %.0f K -> %s" % (
        rs["p_cold"], rs["S_cold"], rs["p_warm"], rs["S_warm"], rs["sv_rim"], rs["S_rim_yield"], rs["shrink_dT"],
        "OK" if rs["ok"] else "NOT OK - add screws / pins or use a bolted rim"))
    print("  interference needed for S_slip 2 when warm: %.0f um (rim yield safety then %.2f) -> a shrink fit alone is not practical" % (
        rs["U_req_um"], rs["S_rim_at_U_req"]))
    for n in (4, 6, 8):
        b = rim_bolts(P, n=n)
        print("  bolted rim: %d fitted bolts M8 on %.1f mm: F %.0f N, tau %.1f MPa, S %.2f" % (n, b["Dk"], b["F_bolt"], b["tau"], b["S"]))
    print("\n== 7.7 inspection")
    w = wire_check(P)
    print("  best wire %.3f mm -> standard wire %.2f mm: M %.3f (max %.3f / min %.3f) mm, contact radius %.3f mm (%s)" % (
        w["D_best"], w["D"], w["M_nominal"], w["M_max"], w["M_min"], w["r_contact"], "on the flank" if w["contact_ok"] else "NOT on the flank"))
    for D in (4.0, 5.05, 8.0):
        w2 = wire_check(P, D)
        print("    wire %.2f: M %.3f, contact radius %.3f (%s)" % (D, w2["M_nominal"], w2["r_contact"], "ok" if w2["contact_ok"] else "not ok"))
    bb = backlash_budget(P)
    print("\n== 7.8 backlash budget")
    print("  backlash cold %.0f ... %.0f um; housing / gears warm: da %+.1f um -> %+.1f um -> warm %.0f ... %.0f um; 10 um of a = %.1f um backlash" % (
        bb["j_min_cold"], bb["j_max_cold"], bb["da_thermal_um"], bb["dj_thermal"], bb["j_min_warm"], bb["j_max_warm"], bb["dj_per_10um_da"]))
    print("\n== 7.9 contact pattern (wheel centre plane)")
    k = pattern_gain(0.40, 0.69, 0.10 * 10, P["b2"])
    print("  calibration: pattern centre 0.40 -> 0.69 of b2 after a 1.0 mm shim -> gain k = %.1f mm per mm" % k)
    for m in (0.30, 0.40, 0.50, 0.65, 0.85):
        ps = pattern_setting(P, m, k_gain=k)
        print("  print centre %.2f of b2 from entry: %-4s -> move wheel %+.3f mm (towards %s); tolerance +-%.2f mm moves the pattern +-%.2f mm" % (
            m, "OK" if ps["ok"] else "move", ps["shift_mm"], "leaving side" if ps["shift_mm"] > 0 else "entry side", ps["tol_mm"], ps["pattern_move_in_tol_mm"]))
    print("\n== 7.10 running-in programme (mu x 1.3 during running-in, check)")
    for r in running_in(P):
        print("  %3.0f %% load (%.2f kW) for %4.1f h: eta %.3f, oil %.1f C running-in / %.1f C after (%s)" % (
            100 * r["frac"], r["P1"], r["hours"], r["eta_runin"], r["theta_runin"], r["theta_after"], "OK" if r["ok"] else "TOO HOT"))
    print("  first oil change after 300-500 h (check maker); then every 4000-8000 h mineral / 10000-20000 h polyglycol")
    print("\n== 7.11 typical defects")
    for s, c, rmd in DEFECTS:
        print("  %-52s | %-58s | %s" % (s, c, rmd))
    print("\n== 8.2 worked example")
    Q0 = dict(DEFAULT, **dict(EXAMPLE_WORM, fan=False))
    print("  iteration 1 (no fan): oil %.1f C, thermal limit %.2f kW -> too hot" % (losses(Q0)["theta_S"], thermal_power_limit(Q0)))
    Q, R = worm_design_example()
    g, e, F, L = R["g"], R["e"], R["F"], R["L"]
    print("  %s" % Q["name"])
    print("  gamma %.3f deg, x2 %+.3f, vg %.2f m/s, n2 %.1f rpm; eta %.3f / reverse %.3f; self-locking rest %s, running %s" % (
        g["gamma_deg"], g["x2"], g["vg"], g["n2_rpm"], e["eta_z"], e["eta_rev"], e["self_locking_static"], e["self_locking_dynamic"]))
    print("  T2 %.1f N m; oil %.1f C (fan); thermal limit %.2f kW; S_H %.2f, S_W %.2f, S_F worn %.2f, S_delta %.2f" % (
        F["T2"], L["theta_S"], thermal_power_limit(Q), R["SH"], R["SW"], R["SF_worn"], R["Sd"]))
    hb = hob_design(Q)
    w = wire_check(Q)
    print("  hob d0 %.2f, %s, hobbing %.1f min; wire %.2f -> M %.3f mm" % (hb["d0"], hb["method"], hb["t_radial_min"], w["D"], w["M_nominal"]))

def cmd_examples():
    P = dict(DEFAULT)
    print(report_text(P))
    print("\n## Number of starts: efficiency and self-locking (same a, mx, d1)")
    for z1, z2 in ((1, 41), (2, 41), (3, 41), (4, 41)):
        Q = dict(P, z1=z1, z2=z2)
        g, e = geometry(Q), efficiency(Q)
        print("  z1 %d: i %5.2f, gamma %5.2f deg, vg %.2f m/s, eta worm %.3f, eta wheel %.3f, self-locking rest %-3s running %s" % (
            z1, g["u"], g["gamma_deg"], g["vg"], e["eta_z"], e["eta_rev"], "yes" if e["self_locking_static"] else "no",
            "yes" if e["self_locking_dynamic"] else "no"))
    print("\n## Wheel materials (same drive)")
    for m in WHEEL_MATERIALS:
        R = capacity(dict(P, wheel_material=m))
        print("  %-46s S_H %.2f, S_W %.2f, S_F worn %.2f, eta %.3f" % (m, R["SH"], R["SW"], R["SF_worn"], R["e"]["eta_z"]))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-64s %s %s" % (name, "OK  " if cond else "FAIL", info))
    P = dict(DEFAULT)
    g = geometry(P)
    e = efficiency(P, g)
    F = forces(P, g, e)
    chk("tan(gamma) = z1 mx / d1 and lead pz = z1 pi mx", abs(math.tan(g["gamma"]) - P["z1"] * P["mx"] / P["d1"]) < 1e-12 and
        abs(g["pz"] - P["z1"] * math.pi * P["mx"]) < 1e-12)
    chk("centre distance a = (d1 + d2)/2 + x2 mx", abs((g["d1"] + g["d2"]) / 2 + g["x2"] * P["mx"] - P["a"]) < 1e-12)
    chk("Ft1 d1/2000 = T1 (torque balance worm)", abs(F["Ft1"] * g["d1"] / 2000 - F["T1"]) < 1e-9, "%.4f" % F["T1"])
    chk("T2 = T1 i eta_z and Ft2 d2/2000 = T2", abs(F["T2"] - F["T1"] * g["u"] * e["eta_z"]) < 1e-9 and abs(F["Ft2"] * g["d2"] / 2000 - F["T2"]) < 1e-9)
    an, gam, mu = g["alpha_n"], g["gamma"], e["mu"]
    Wn = F["Fn"]
    chk("forces from normal force W (cos an sin g + mu cos g) = Ft1", abs(Wn * (math.cos(an) * math.sin(gam) + mu * math.cos(gam)) - F["Ft1"]) < 1e-6)
    chk("radial force Fr = W sin(an)", abs(Wn * math.sin(an) - F["Fr"]) < 1e-6)
    chk("power balance P2 = P1 eta_z (omega2 T2)", abs(F["T2"] * 2 * math.pi * g["n2_rpm"] / 60000 - F["P2_kW"]) < 1e-9)
    Q = dict(P)
    gq = geometry(Q)
    rho = gq["gamma"]
    eta_at = math.tan(rho) / math.tan(2 * rho)
    chk("gamma = rho  ->  eta_z = (1 - tan^2 g)/2 < 0.5", abs(eta_at - (1 - math.tan(rho) ** 2) / 2) < 1e-12 and eta_at < 0.5)
    chk("ZI base cylinder: db1 tan(gb) = d1 tan(g), cos gb = cos an cos g",
        abs(g["db1"] * math.tan(g["gamma_b"]) - g["d1"] * math.tan(g["gamma"])) < 1e-9)
    e1 = efficiency(dict(P, z1=1))
    chk("1-start worm: lower efficiency than 2-start", e1["eta_z"] < e["eta_z"])
    L = losses(P, g, e)
    chk("loss sum and heat balance theta = theta0 + PV/(kA)", abs(L["PV"] - (L["PVz"] + L["PVLP"] + L["PVD"] + L["PV0"])) < 1e-9 and
        abs(L["theta_S"] - P["theta_0"] - L["PV"] / (L["k"] * L["A"])) < 1e-9)
    Pth = thermal_power_limit(P)
    chk("thermal power limit gives theta_lim", abs(losses(dict(P, P1_kW=Pth))["theta_S"] - P["theta_lim"]) < 1e-6, "%.3f kW" % Pth)
    R = capacity(P)
    chk("safeties finite and positive", all(R[k] > 0 for k in ("SH", "SW", "SF", "SF_worn", "Sd", "ST")))
    chk("worn root weaker than new root", R["SF_worn"] < R["SF"])
    ow = over_wires(P, g)
    chk("over-wire: best wire touches on the reference line (M - d1 = DM (1 + sin ax))",
        abs((ow["M"] - P["d1"]) - ow["DM"] * (1 + math.sin(g["alpha_x"]))) < 1e-9, "%.4f" % ow["M"])
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
        out = "worm_out"
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
