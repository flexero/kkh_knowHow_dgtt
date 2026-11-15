#!/usr/bin/env python3
"""M11 vessel program - air receiver / pressure parts of the compressor: receiver volume for on/off control,
design stress (EN 13445-2/-3 style), cylindrical shell (EN 13445-3 7.4), dished heads (hemispherical, 2:1 ellipsoidal,
torispherical Kloepper / Korbbogen by the ASME VIII-1 UG-32 formulas), allowances and plate thickness, length from
volume, mass, nozzle reinforcement (area replacement), test pressure, PED / SPVD category, pressure-cycle fatigue
(weld S-N curve of weld.py with a stress concentration at the nozzle) and safety-valve sizing (ISO 4126-1 style).
Default case: the receiver of the M2 compressor (FAD 16.6 m3/h, 6 -> 8 bar on/off, PS 11 bar).
Guide: 11_welds_frames_vessels.md (chapters 5-6).

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python vessel.py params | run [--in p.json] [--out folder] | examples | selftest
  python vessel.py ch56                    extra results of guide chapters 5-6

Material values, joint coefficients, PED limits, head formulas (ASME style used with the EN design stress), the
fatigue class and the discharge coefficient are TYPICAL VALUES - the binding code for a receiver in the EU is
EN 13445 (PED 2014/68/EU) or EN 286-1 (simple pressure vessels 2014/29/EU). Check before a design is released.
All default numbers are EXAMPLES.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # sibling tools (weld.py for the S-N curve)

# ---------------------------------------------------------------- data (check)
# proof strength Rp0.2 (Rp1.0 for austenitic) at 20 / 100 / 150 / 200 C, Rm at 20 C, density, austenitic flag
VMAT = {
    "P265GH (EN 10028-2)":            {"Rp": {20: 265, 100: 241, 150: 223, 200: 205}, "Rm": 410, "rho": 7850, "aus": False},
    "P355GH (EN 10028-2)":            {"Rp": {20: 355, 100: 323, 150: 304, 200: 284}, "Rm": 510, "rho": 7850, "aus": False},
    "P235S (EN 10207, simple vessels)": {"Rp": {20: 235, 100: 210, 150: 195, 200: 180}, "Rm": 360, "rho": 7850, "aus": False},
    "1.4301 X5CrNi18-10 (EN 10028-7)": {"Rp": {20: 260, 100: 191, 150: 172, 200: 157}, "Rm": 520, "rho": 7900, "aus": True},
}
JOINT_Z = {"testing group 1/2 (100 % NDT)": 1.0, "testing group 3 (spot NDT)": 0.85, "testing group 4 (visual only)": 0.7}
HEADS = ["hemispherical", "ellipsoidal 2:1", "torispherical Kloepper", "torispherical Korbbogen"]
PLATES = [2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 20.0, 25.0, 30.0]
STD_VOLUMES = [24, 50, 90, 150, 270, 500, 750, 1000, 1500, 2000, 3000, 5000]

DEFAULT = {
    "name": "Air receiver of the M2 compressor (FAD 16.6 m3/h, on/off 6 -> 8 bar, PS 11 bar) (example)",
    "PS_bar": 11.0, "TS_C": 100.0, "T_min_C": -10.0,
    "material": "P265GH (EN 10028-2)", "joint": "testing group 3 (spot NDT)",
    "head": "torispherical Kloepper",
    "Di": 400.0,                        # inside diameter mm
    "V_L": 0.0,                         # volume L (0 = size from the compressor below and round up to a standard size)
    "Q_FAD_m3h": 16.6, "p_in_bar_abs": 1.013, "T_in_C": 20.0, "T_rec_C": 20.0,
    "p_on_bar": 6.0, "p_off_bar": 8.0, "starts_per_h_max": 15.0,
    "c_corr": 1.0, "c_tol": 0.3, "thinning_head": 0.10,
    "e_min_shell": 4.0,                 # minimum shell plate mm: rolling / welding practice and the DN50 nozzle (3 mm fails the area check)
    "nozzle": {"d": 50.0, "tn": 4.0, "name": "DN50 outlet"},
    "hours_year": 4000.0, "years": 20.0, "duty_starts_per_h": 6.0,
    "SCF_nozzle": 2.5, "fat_class": 63.0,
    "sv": {"k": 1.4, "M": 28.96, "Z": 1.0, "K_dr": 0.81, "overpressure": 0.10},
}

# ---------------------------------------------------------------- chapter 5: receiver size, design stress, shell, heads
def receiver_volume(P):
    """On/off control: V = 0.25 q_C p_1 T_0 / (f_max dp T_1) (q_C FAD L/s, f_max max cycles per s, dp switching band)."""
    q = P["Q_FAD_m3h"] * 1000 / 3600
    f = P["starts_per_h_max"] / 3600
    dp = P["p_off_bar"] - P["p_on_bar"]
    V = 0.25 * q * P["p_in_bar_abs"] * (P["T_rec_C"] + 273.15) / (f * dp * (P["T_in_C"] + 273.15))
    return {"V_req_L": V, "V_std_L": next(v for v in STD_VOLUMES if v >= V - 1e-9), "q_Ls": q}

def interp_T(tab, T):
    ks = sorted(tab)
    if T <= ks[0]:
        return tab[ks[0]]
    for a, b in zip(ks, ks[1:]):
        if T <= b:
            return tab[a] + (tab[b] - tab[a]) * (T - a) / (b - a)
    return tab[ks[-1]]

def design_stress(mat, T):
    """EN 13445-3 6.2 style: ferritic f = min(Rp0.2,T / 1.5, Rm,20 / 2.4); austenitic (A >= 35 %) f = Rp1.0,T / 1.5
    (the code allows more with Rm,T / 3 - check). Test condition: f_test = Rp0.2,20 / 1.05."""
    m = VMAT[mat]
    Rp = interp_T(m["Rp"], T)
    f = Rp / 1.5 if m["aus"] else min(Rp / 1.5, m["Rm"] / 2.4)
    return {"Rp_T": Rp, "f": f, "f20": (m["Rp"][20] / 1.5 if m["aus"] else min(m["Rp"][20] / 1.5, m["Rm"] / 2.4)), "f_test": m["Rp"][20] / 1.05}

def shell_e(P_MPa, Di, f, z):
    """Cylinder under internal pressure, EN 13445-3 7.4.2: e = P Di / (2 f z - P) (valid e/De <= 0.16)."""
    return P_MPa * Di / (2 * f * z - P_MPa)

def head_e(kind, P_MPa, Di, f, z):
    """Dished heads, ASME VIII-1 UG-32 style with S = f, E = z (inside dimensions):
    hemispherical t = P R / (2 S E - 0.2 P); ellipsoidal 2:1 t = P D / (2 S E - 0.2 P);
    torispherical t = P L M / (2 S E - 0.2 P), M = (3 + sqrt(L / r)) / 4: Kloepper L = Di, r = 0.1 Di;
    Korbbogen L = 0.8 Di, r = 0.154 Di."""
    den = 2 * f * z - 0.2 * P_MPa
    if kind == "hemispherical":
        return P_MPa * Di / 2 / den, 1.0
    if kind == "ellipsoidal 2:1":
        return P_MPa * Di / den, 1.0
    L, r = (Di, 0.1 * Di) if kind == "torispherical Kloepper" else (0.8 * Di, 0.154 * Di)
    M = 0.25 * (3 + math.sqrt(L / r))
    return P_MPa * L * M / den, M

def head_geometry(kind, Di):
    """Inside volume (L) and inside depth (mm) of a head (DIN 28011 / 28013 style approximations, thin wall)."""
    D = Di / 1000
    if kind == "hemispherical":
        return math.pi * D ** 3 / 12 * 1000, Di / 2
    if kind == "ellipsoidal 2:1":
        return math.pi * D ** 3 / 24 * 1000, Di / 4
    if kind == "torispherical Kloepper":
        return 0.0999 * D ** 3 * 1000, 0.1935 * Di
    return 0.1298 * D ** 3 * 1000, 0.255 * Di

def plate(e_req, P):
    """Nominal plate: required + corrosion + negative plate tolerance, rounded up to the plate series."""
    e = e_req + P["c_corr"] + P["c_tol"]
    return next(t for t in PLATES if t >= e - 1e-9), e

def design(P):
    """Complete receiver design."""
    Pm = P["PS_bar"] / 10
    ds = design_stress(P["material"], P["TS_C"])
    z = JOINT_Z[P["joint"]]
    rv = receiver_volume(P)
    V = P["V_L"] if P["V_L"] > 0 else rv["V_std_L"]
    e_s = shell_e(Pm, P["Di"], ds["f"], z)
    t_s, e_s_all = plate(e_s, P)
    t_s = max(t_s, P.get("e_min_shell", 0.0))
    e_h, M = head_e(P["head"], Pm, P["Di"], ds["f"], 1.0)        # seamless (pressed) heads: z = 1
    t_h, e_h_all = plate(e_h / (1 - P["thinning_head"]), P)
    Vh, hh = head_geometry(P["head"], P["Di"])
    L_cyl = (V / 1000 - 2 * Vh / 1000) / (math.pi / 4 * (P["Di"] / 1000) ** 2) * 1000      # mm
    rho = VMAT[P["material"]]["rho"]
    Dm = (P["Di"] + t_s) / 1000
    m_shell = math.pi * Dm * t_s / 1000 * L_cyl / 1000 * rho
    A_head = {"hemispherical": 2.0, "ellipsoidal 2:1": 1.38, "torispherical Kloepper": 1.08, "torispherical Korbbogen": 1.17}[P["head"]]
    m_heads = 2 * A_head * math.pi / 4 * ((P["Di"] + t_h) / 1000) ** 2 * t_h / 1000 * rho     # surface ~ factor x pi D^2 / 4
    PV = P["PS_bar"] * V
    hoop = Pm * P["Di"] / (2 * (t_s - P["c_corr"] - P["c_tol"]))
    return {"P_MPa": Pm, "ds": ds, "z": z, "rv": rv, "V": V, "e_shell": e_s, "t_shell": t_s, "e_shell_all": e_s_all,
            "e_head": e_h, "M": M, "t_head": t_h, "e_head_all": e_h_all, "V_head": Vh, "h_head": hh, "L_cyl": L_cyl,
            "L_total": L_cyl + 2 * (hh + t_h), "m_kg": m_shell + m_heads, "PV": PV, "hoop": hoop}

# ---------------------------------------------------------------- chapter 6: nozzle, test, category, fatigue, safety valve
def nozzle(P, D):
    """Area replacement (simplified, ASME UG-37 / EN 13445-3 9.5 idea): A_req = d e_req; available = d (e_s - c - e_req)
    + 2 l_n (t_n - c - t_n,req), l_n = 2.5 min(e_s, t_n)."""
    n = P["nozzle"]
    c = P["c_corr"] + P["c_tol"]
    e_req, e_av = D["e_shell"], D["t_shell"] - c
    tn_req = shell_e(D["P_MPa"], n["d"], D["ds"]["f"], 1.0)
    ln = 2.5 * min(D["t_shell"], n["tn"])
    A_req = n["d"] * e_req
    A_av = n["d"] * max(0.0, e_av - e_req) + 2 * ln * max(0.0, n["tn"] - c - tn_req)
    return {"A_req": A_req, "A_av": A_av, "ok": A_av >= A_req, "tn_req": tn_req, "l_n": ln}

def test_pressure(P, D):
    """EN 13445-5: P_t = max(1.25 P f_test... -> 1.25 P f20 / f_T, 1.43 P); EN 286-1 (simple vessels): 1.5 PS."""
    pt = max(1.25 * P["PS_bar"] * D["ds"]["f20"] / D["ds"]["f"], 1.43 * P["PS_bar"])
    sig = pt / 10 * P["Di"] / (2 * (D["t_shell"] - P["c_corr"] - P["c_tol"]))
    return {"P_test_bar": pt, "P_test_SPV_bar": 1.5 * P["PS_bar"], "sigma_test": sig, "f_test": D["ds"]["f_test"], "ok": sig <= D["ds"]["f_test"]}

def ped_category(PS, V):
    """PED 2014/68/EU annex II table 2 (vessels, gas group 2) - check: PS x V <= 50 bar L: art. 4.3 (sound engineering
    practice); <= 200: I; <= 1000: II; <= 3000: III; above: IV. SPVD 2014/29/EU applies to air / nitrogen receivers
    with PS x V <= 10000 bar L, PS <= 30 bar."""
    pv = PS * V
    if PS <= 0.5:
        cat = "outside PED (PS <= 0.5 bar)"
    elif pv <= 50:
        cat = "article 4.3 (sound engineering practice)"
    elif pv <= 200:
        cat = "category I"
    elif pv <= 1000:
        cat = "category II"
    elif pv <= 3000:
        cat = "category III"
    else:
        cat = "category IV"
    return {"PV": pv, "PED": cat, "SPVD": PS <= 30 and pv <= 10000}

def pressure_fatigue(P, D):
    """Pressure cycles (one per motor start) with range dp: membrane hoop range x SCF at the nozzle, weld S-N curve
    (class 63, slope 3/5, cut-off) from weld.py; gamma 1.0 (check EN 13445-3 clause 17/18)."""
    import weld
    dp = (P["p_off_bar"] - P["p_on_bar"]) / 10
    e = D["t_shell"] - P["c_corr"] - P["c_tol"]
    ds = P["SCF_nozzle"] * dp * P["Di"] / (2 * e)
    n = P["duty_starts_per_h"] * P["hours_year"] * P["years"]
    N = weld.sn_cycles(ds, P["fat_class"], 3, "normal")
    return {"dp_MPa": dp, "dsigma": ds, "n": n, "N": N, "D": n / N, "ok": n <= N}

def safety_valve(P, D):
    """ISO 4126-1 style: Q_m = 0.2883 C K_dr A p0 sqrt(M / (Z T)) [kg/h; A mm2, p0 bar abs, T K];
    C = 3.948 sqrt(k (2 / (k + 1))^((k + 1) / (k - 1))). Required: the full compressor mass flow."""
    s = P["sv"]
    k = s["k"]
    C = 3.948 * math.sqrt(k * (2 / (k + 1)) ** ((k + 1) / (k - 1)))
    p0 = P["PS_bar"] * (1 + s["overpressure"]) + 1.013
    T = P["T_rec_C"] + 273.15
    rho_n = 1.013e5 * s["M"] / (8314.46 * (P["T_in_C"] + 273.15))
    Qm = P["Q_FAD_m3h"] * rho_n
    A = Qm / (0.2883 * C * s["K_dr"] * p0 * math.sqrt(s["M"] / (s["Z"] * T)))
    return {"C": C, "p0_bar_abs": p0, "Qm_kgh": Qm, "A_req_mm2": A, "d_req_mm": math.sqrt(4 * A / math.pi)}

def summary(P):
    D = design(P)
    return {"D": D, "nozzle": nozzle(P, D), "test": test_pressure(P, D), "cat": ped_category(P["PS_bar"], D["V"]),
            "fatigue": pressure_fatigue(P, D), "sv": safety_valve(P, D)}

def report_text(P):
    S = summary(P)
    D, N, T, C, F, V = (S[k] for k in ("D", "nozzle", "test", "cat", "fatigue", "sv"))
    yn = lambda b: "OK" if b else "NOT OK"
    L = ["# Pressure vessel report (EN 13445 / ASME VIII-1 style) - %s\n" % P["name"],
         "PS %.1f bar, TS %.0f C, %s, %s (z %.2f), %s heads, Di %.0f mm" % (P["PS_bar"], P["TS_C"], P["material"], P["joint"], D["z"], P["head"], P["Di"]),
         "\n## Volume",
         "- on/off control: FAD %.1f m3/h (%.2f L/s), %.0f ... %.0f bar, max %.0f starts/h -> V_req %.0f L -> standard %d L (used %.0f L)" % (
             P["Q_FAD_m3h"], D["rv"]["q_Ls"], P["p_on_bar"], P["p_off_bar"], P["starts_per_h_max"], D["rv"]["V_req_L"], D["rv"]["V_std_L"], D["V"]),
         "\n## Design stress and wall thickness",
         "- Rp at %.0f C %.0f MPa -> f %.1f MPa (f20 %.1f)" % (P["TS_C"], D["ds"]["Rp_T"], D["ds"]["f"], D["ds"]["f20"]),
         "- shell: e = P Di / (2 f z - P) = %.2f mm (+ c %.1f + tol %.1f = %.2f) -> plate %.1f mm; hoop stress at PS %.0f MPa" % (
             D["e_shell"], P["c_corr"], P["c_tol"], D["e_shell_all"], D["t_shell"], D["hoop"]),
         "- heads (%s, M %.3f): e %.2f mm, / (1 - thinning %.2f) + allowances = %.2f -> plate %.1f mm; head depth %.0f mm, volume %.1f L each" % (
             P["head"], D["M"], D["e_head"], P["thinning_head"], D["e_head_all"], D["t_head"], D["h_head"], D["V_head"]),
         "- cylindrical length %.0f mm, overall length %.0f mm, steel mass about %.0f kg" % (D["L_cyl"], D["L_total"], D["m_kg"]),
         "\n## Nozzle, test, category, fatigue, safety valve",
         "- %s d %.0f, t_n %.1f: area required %.1f mm2, available %.1f mm2 -> %s" % (P["nozzle"]["name"], P["nozzle"]["d"], P["nozzle"]["tn"], N["A_req"], N["A_av"], yn(N["ok"])),
         "- test pressure %.2f bar (EN 13445-5; simple vessel 1.5 PS = %.1f bar): shell stress %.0f MPa vs %.0f MPa -> %s" % (
             T["P_test_bar"], T["P_test_SPV_bar"], T["sigma_test"], T["f_test"], yn(T["ok"])),
         "- PS x V = %.0f bar L -> PED %s; simple pressure vessel directive applicable: %s" % (C["PV"], C["PED"], "yes" if C["SPVD"] else "no"),
         "- pressure cycles: %.3g in %.0f years, range %.0f bar -> nozzle stress range %.1f MPa (SCF %.1f), class %.0f: N %s -> %s" % (
             F["n"], P["years"], F["dp_MPa"] * 10, F["dsigma"], P["SCF_nozzle"], P["fat_class"], "inf" if F["N"] == float("inf") else "%.3g" % F["N"], yn(F["ok"])),
         "- safety valve: %.1f kg/h at p0 %.2f bar abs, C %.3f, K_dr %.2f -> A %.2f mm2 (d %.2f mm)" % (V["Qm_kgh"], V["p0_bar_abs"], V["C"], P["sv"]["K_dr"], V["A_req_mm2"], V["d_req_mm"])]
    return "\n".join(L)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    D = design(P)
    with open(os.path.join(out, "vessel_data.csv"), "w", encoding="utf-8") as f:
        f.write("item,value\n")
        for k, v in (("volume L", D["V"]), ("inside diameter mm", P["Di"]), ("shell plate mm", D["t_shell"]), ("head plate mm", D["t_head"]),
                     ("cylindrical length mm", D["L_cyl"]), ("overall length mm", D["L_total"]), ("PS bar", P["PS_bar"]), ("TS C", P["TS_C"]),
                     ("test pressure bar", test_pressure(P, D)["P_test_bar"]), ("mass kg", D["m_kg"])):
            f.write("%s,%.2f\n" % (k, v))
        f.write("material,%s\nheads,%s\n" % (P["material"], P["head"]))
    print(rep)
    print("written: report.md, vessel_data.csv ->", out)



# ================================================================ added with guide chapters (ch56)
# ---------------------------------------------------------------- chapter 5: stored energy, directives
def vb_stored_energy(p_bar_g, V_L, k=1.4, pa=1.013):
    """Isentropic expansion energy of a gas volume: E = p V / (k - 1) [1 - (pa / p)^((k - 1) / k)] (p absolute).
    TNT equivalent with 4.184 MJ/kg."""
    p = (p_bar_g + pa) * 1e5
    V = V_L / 1000
    E = p * V / (k - 1) * (1 - (pa * 1e5 / p) ** ((k - 1) / k))
    return {"E_J": E, "E_kJ": E / 1000, "TNT_g": E / 4.184e6 * 1000}

VB_PED_TABLES = {   # PED 2014/68/EU annex II, vessels (check): upper PS x V limits (bar L) of art. 4.3, I, II, III; above -> IV
    "gas group 1 (dangerous: flammable, toxic, oxidising)": (25, 50, 200, 1000),
    "gas group 2 (all other gases: air, nitrogen, CO2, steam)": (50, 200, 1000, 3000),
}
VB_MODULES = {   # conformity assessment modules per category (PED annex III, check)
    "article 4.3": "no CE marking, sound engineering practice, instructions",
    "category I": "A (internal production control)",
    "category II": "A2, D1, E1 (notified body monitors production or final check)",
    "category III": "B (design or production type) + D, F, E or C2; or H",
    "category IV": "B (production type) + D or F; or G (unit verification); or H1",
}

def vb_ped_table(PS, V):
    out = []
    for g, lim in VB_PED_TABLES.items():
        pv = PS * V
        names = ["article 4.3", "category I", "category II", "category III"]
        cat = next((n for n, l in zip(names, lim) if pv <= l), "category IV")
        out.append((g, pv, cat, VB_MODULES[cat]))
    return out

# ---------------------------------------------------------------- chapter 5: design stress, membrane, thick wall
def vb_stress_table(Ts=(20, 100, 150, 200)):
    rows = []
    for m in VMAT:
        rows.append((m, [design_stress(m, T)["f"] for T in Ts], design_stress(m, 20)["f_test"]))
    return rows

def vb_membrane(P_MPa, Di, e):
    """Thin shell: hoop sigma_t = P Di / (2 e) (inside), Barlow on the outside diameter P De / (2 e), mean P Dm / (2 e);
    axial sigma_a = P Di^2 / (4 e Dm) ~ P Di / (4 e). Lame (thick): sigma_t,max = P (Ro^2 + Ri^2) / (Ro^2 - Ri^2) at the
    inner surface, sigma_r = -P."""
    Ri, Ro = Di / 2, Di / 2 + e
    return {"hoop_in": P_MPa * Di / (2 * e), "barlow": P_MPa * (Di + 2 * e) / (2 * e), "hoop_mean": P_MPa * (Di + e) / (2 * e),
            "axial": P_MPa * Di ** 2 / (4 * e * (Di + e)), "lame_t": P_MPa * (Ro ** 2 + Ri ** 2) / (Ro ** 2 - Ri ** 2),
            "lame_vm": P_MPa * math.sqrt(3) * Ro ** 2 / (Ro ** 2 - Ri ** 2)}

def vb_thick_study(ratios=(0.01, 0.02, 0.05, 0.1, 0.16, 0.25)):
    """Ratio Lame max hoop / mean-diameter formula vs e / De."""
    out = []
    for r in ratios:
        De = 1000.0
        e = r * De
        Di = De - 2 * e
        m = vb_membrane(1.0, Di, e)
        out.append((r, m["lame_t"] / m["hoop_mean"]))
    return out

# ---------------------------------------------------------------- chapter 5: external pressure
def vb_external(Di, e, L, E=200000.0, nu=0.3, S=3.0):
    """Elastic buckling under external pressure (check EN 13445-3 clause 8):
    long tube p_cr = 2 E / (1 - nu^2) (e / D)^3; short tube (Windenburg-Trilling)
    p_cr = 2.42 E (e / D)^2.5 / ((1 - nu^2)^0.75 (L / D - 0.45 (e / D)^0.5)); allowed p = p_cr / S."""
    D = Di + e
    long_ = 2 * E / (1 - nu * nu) * (e / D) ** 3
    short = 2.42 * E * (e / D) ** 2.5 / ((1 - nu * nu) ** 0.75 * (L / D - 0.45 * (e / D) ** 0.5))
    pcr = max(long_, short)
    return {"p_cr_long_MPa": long_, "p_cr_short_MPa": short, "p_cr_MPa": pcr, "p_allow_bar": pcr / S * 10}

# ---------------------------------------------------------------- chapter 5: heads, cone
def vb_head_compare(P=None):
    """Required thickness of each head type vs the cylinder, plus the EN 13445-3 crown formula e_s = P R / (2 f z - 0.5 P)
    (crown only - the knuckle check of EN 13445 with its beta factor is not programmed, check)."""
    P = dict(DEFAULT if P is None else P)
    Pm, f = P["PS_bar"] / 10, design_stress(P["material"], P["TS_C"])["f"]
    e_cyl = shell_e(Pm, P["Di"], f, 1.0)
    rows = []
    for h in HEADS:
        e, M = head_e(h, Pm, P["Di"], f, 1.0)
        R = {"hemispherical": P["Di"] / 2, "ellipsoidal 2:1": 0.9 * P["Di"], "torispherical Kloepper": P["Di"], "torispherical Korbbogen": 0.8 * P["Di"]}[h]
        e_crown = Pm * R / (2 * f - 0.5 * Pm)
        rows.append((h, e, e / e_cyl, M, e_crown))
    return {"e_cyl": e_cyl, "rows": rows}

def vb_M_curve(ratios=(0.06, 0.1, 0.154, 0.2, 0.3, 0.5)):
    """Stress-intensification factor of the knuckle M = (3 + sqrt(L / r)) / 4 against r / L."""
    return [(r, 0.25 * (3 + math.sqrt(1 / r))) for r in ratios]

def vb_cone(P_MPa, Dc, alpha_deg, f, z):
    """Conical shell (EN 13445-3 7.6.4 style): e = P Dc / (2 f z - P) / cos(alpha); junctions need extra checks."""
    return P_MPa * Dc / (2 * f * z - P_MPa) / math.cos(math.radians(alpha_deg))

# ---------------------------------------------------------------- chapter 5: openings, pads, flanges
def vb_nozzle_study(P=None, shells=(3.0, 4.0, 5.0), tns=(4.0, 5.6)):
    P = dict(DEFAULT if P is None else P)
    out = []
    for es in shells:
        for tn in tns:
            Q = dict(P, e_min_shell=es, nozzle=dict(P["nozzle"], tn=tn))
            D = design(Q)
            n = nozzle(Q, D)
            out.append((D["t_shell"], tn, n["A_req"], n["A_av"], n["ok"]))
    return out

def vb_pad(P=None, e_shell=3.0, D_pad=100.0, t_pad=4.0):
    """Reinforcing pad: extra area (D_pad - d) t_pad (width limited to d on each side); pad of the same material."""
    P = dict(DEFAULT if P is None else P)
    Q = dict(P, e_min_shell=e_shell)
    D = design(Q)
    n = nozzle(Q, D)
    d = P["nozzle"]["d"]
    A_pad = (min(D_pad, 2 * d) - d - 2 * P["nozzle"]["tn"]) * t_pad
    return {"t_shell": D["t_shell"], "A_req": n["A_req"], "A_av": n["A_av"], "A_pad": A_pad, "ok": n["A_av"] + A_pad >= n["A_req"]}

VB_FLANGE_PN16 = {   # EN 1092-1 type 11 (weld neck) PN16, typical (check): D outside, K bolt circle, bolts, C thickness mm
    "DN15": {"D": 95, "K": 65, "n": 4, "bolt": "M12", "C": 16},
    "DN25": {"D": 115, "K": 85, "n": 4, "bolt": "M12", "C": 18},
    "DN50": {"D": 165, "K": 125, "n": 4, "bolt": "M16", "C": 20},
    "DN80": {"D": 200, "K": 160, "n": 8, "bolt": "M16", "C": 20},
    "DN100": {"D": 220, "K": 180, "n": 8, "bolt": "M16", "C": 22},
}
VB_PN16_RATING = {20: 16.0, 100: 14.8, 150: 13.7, 200: 12.8}   # allowable bar, material group 3E0 (P250GH), check EN 1092-1 annex G

def vb_flange(dn="DN50", PS=11.0, T=100.0, G=None, As_M16=157.0, sig_b=0.0):
    """Flange choice: PN rating at temperature >= PS. Rough bolt check: end force P pi G^2 / 4 + gasket seating
    (factor 1.5 on the pressure force, check EN 1591-1) per bolt / stress area."""
    f = VB_FLANGE_PN16[dn]
    rating = interp_T(VB_PN16_RATING, T)
    G = G if G else (f["K"] - 40)                       # gasket mean diameter estimate
    F = PS / 10 * math.pi / 4 * G ** 2 * 1.5
    As = {"M12": 84.3, "M16": 157.0}[f["bolt"]]
    return {"dn": dn, "flange": f, "rating_bar": rating, "ok_rating": rating >= PS, "F_total_N": F, "sigma_bolt": F / (f["n"] * As)}

VB_TESTING_GROUPS = [   # EN 13445-5 testing groups (simplified, check): group, extent of volumetric NDT, z, typical limits
    ("1", "100 % RT/UT", 1.0, "all materials, any thickness"),
    ("2", "10 % ... 100 % (reduced after experience)", 1.0, "limited material groups"),
    ("3", "spot 10 % (longitudinal) / 5 % (circumferential)", 0.85, "group 1.1, 1.2, 8.1; e <= 30 mm (steels)"),
    ("4", "none (visual + pressure test)", 0.7, "group 2 fluids, PS <= 20 bar, limited e; only static load"),
]

def vb_joint_study(P=None):
    P = dict(DEFAULT if P is None else P)
    out = []
    for j, z in JOINT_Z.items():
        e = shell_e(P["PS_bar"] / 10, P["Di"], design_stress(P["material"], P["TS_C"])["f"], z)
        out.append((j, z, e, plate(e, P)[0]))
    return out

def vb_corrosion_life(c=1.0, rates=(0.02, 0.05, 0.1, 0.2)):
    """Years until the corrosion allowance is used: c / rate (mm / mm per year). Typical rates (check): coated inside
    0.02, galvanised 0.05, bare steel with drained condensate 0.1, bare steel with standing water 0.2 mm/y."""
    return [(r, c / r) for r in rates]

# ---------------------------------------------------------------- chapter 6: on/off cycle, volume
def vb_onoff(V_L, q_Ls, dp, p1=1.013, xs=(0.1, 0.25, 0.5, 0.75, 0.9)):
    """Fill time t_f = V dp / (p1 q (1 - x)), empty time t_e = V dp / (p1 q x) at demand x = q_demand / q.
    Cycle t = V dp / (p1 q) / (x (1 - x)) -> shortest at x = 0.5: t = 4 V dp / (p1 q)."""
    base = V_L * dp / (p1 * q_Ls)
    return [(x, base / (1 - x), base / x, base / (x * (1 - x)), 3600 * x * (1 - x) / base) for x in xs]

def vb_volume_study(P=None, dps=(1.0, 2.0, 3.0), starts=(6, 10, 15, 30)):
    P = dict(DEFAULT if P is None else P)
    out = []
    for dp in dps:
        row = []
        for z in starts:
            rv = receiver_volume(dict(P, p_on_bar=P["p_off_bar"] - dp, starts_per_h_max=z))
            row.append(rv["V_req_L"])
        out.append((dp, row))
    return out

def vb_vsd(P=None, q_min_frac=0.3):
    """Variable-speed compressor: on/off only below the minimum speed, with q_min -> V scales with q_min / q."""
    P = dict(DEFAULT if P is None else P)
    rv = receiver_volume(P)
    return {"V_onoff": rv["V_req_L"], "V_vsd": rv["V_req_L"] * q_min_frac}

# ---------------------------------------------------------------- chapter 6: supports
def vb_saddles(P=None, A=150.0, water=True):
    """Horizontal receiver on two saddles (Zick, simplified, check): Q = W / 2;
    M_mid = Q L / 4 [ (1 + 2 (R^2 - H^2) / L^2) / (1 + 4 H / (3 L)) - 4 A / L ];
    M_saddle = Q A [1 - (1 - A / L + (R^2 - H^2) / (2 A L)) / (1 + 4 H / (3 L))]; sigma = M / (pi R^2 t)
    (L tangent length, H head depth, R mean radius, A saddle to tangent line)."""
    P = dict(DEFAULT if P is None else P)
    D = design(P)
    W = (D["m_kg"] + (D["V"] if water else 0.0)) * 9.81
    Q = W / 2
    L, H, R, t = D["L_cyl"], D["h_head"], (P["Di"] + D["t_shell"]) / 2, D["t_shell"] - P["c_corr"] - P["c_tol"]
    k = 1 + 4 * H / (3 * L)
    Mm = Q * L / 4 * ((1 + 2 * (R * R - H * H) / L ** 2) / k - 4 * A / L)
    Ms = Q * A * (1 - (1 - A / L + (R * R - H * H) / (2 * A * L)) / k)
    return {"W_N": W, "Q_N": Q, "M_mid_Nmm": Mm, "M_saddle_Nmm": Ms, "sig_mid": Mm / (math.pi * R * R * t),
            "sig_saddle": abs(Ms) / (math.pi * R * R * t), "sig_axial_pressure": P["PS_bar"] / 10 * P["Di"] / (4 * t)}

def vb_legs(P=None, n=3, d=42.4, t=3.2, Lk=400.0, E=210000.0, fy=235.0):
    """Vertical receiver on n tube legs, full of water: axial force per leg W / n; Euler F_cr = pi^2 E I / Lk^2
    (cantilever leg: Lk = 2 x leg height, check); safety F_cr / F."""
    P = dict(DEFAULT if P is None else P)
    D = design(P)
    W = (D["m_kg"] + D["V"]) * 9.81
    I = math.pi / 64 * (d ** 4 - (d - 2 * t) ** 4)
    A = math.pi / 4 * (d ** 2 - (d - 2 * t) ** 2)
    F = W / n
    Fcr = math.pi ** 2 * E * I / Lk ** 2
    return {"W_N": W, "F_leg": F, "F_cr": Fcr, "S_buckle": Fcr / F, "sigma": F / A, "S_yield": fy / (F / A)}

# ---------------------------------------------------------------- chapter 6: test energy, fatigue study
def vb_test_energy(P=None, K_water=2200.0):
    """Stored energy at test pressure: hydraulic = water compression P_t^2 V / (2 K) (vessel expansion ignored);
    pneumatic = isentropic gas energy."""
    P = dict(DEFAULT if P is None else P)
    D = design(P)
    pt = test_pressure(P, D)["P_test_bar"]
    hyd = (pt / 10) ** 2 * (D["V"] / 1000) / (2 * K_water) * 1e6
    pn = vb_stored_energy(pt, D["V"])["E_J"]
    return {"P_test_bar": pt, "E_hydro_J": hyd, "E_pneu_J": pn, "ratio": pn / hyd}

def vb_fatigue_study(P=None, scfs=(1.0, 2.0, 2.5, 3.0, 4.0), starts=(6, 15, 30), classes=(63, 71, 80)):
    P = dict(DEFAULT if P is None else P)
    D = design(P)
    rows = []
    for s in scfs:
        for z in starts:
            r = pressure_fatigue(dict(P, SCF_nozzle=s, duty_starts_per_h=z), D)
            rows.append((s, z, r["dsigma"], r["n"], r["N"], r["D"]))
    cls = []
    for c in classes:
        r = pressure_fatigue(dict(P, SCF_nozzle=4.0, duty_starts_per_h=30, fat_class=c), D)
        cls.append((c, r["N"], r["D"]))
    return rows, cls

# ---------------------------------------------------------------- chapter 6: condensate
def vb_p_sat(T_C):
    """Saturation pressure of water (Magnus, over water) Pa: 611.2 exp(17.62 T / (243.12 + T))."""
    return 611.2 * math.exp(17.62 * T_C / (243.12 + T_C))

def vb_condensate(P=None, T_amb=20.0, RH=0.70, T_rec=30.0, load=0.6, p_amb=1.013):
    """Water entering with the intake air minus what the saturated air can still carry at receiver pressure and
    temperature: x = 0.622 p_v / (p - p_v) (kg water / kg dry air)."""
    P = dict(DEFAULT if P is None else P)
    pv_in = RH * vb_p_sat(T_amb)
    x_in = 0.622 * pv_in / (p_amb * 1e5 - pv_in)
    p_rec = (P["p_off_bar"] + p_amb) * 1e5
    x_sat = 0.622 * vb_p_sat(T_rec) / (p_rec - vb_p_sat(T_rec))
    m_air = P["Q_FAD_m3h"] * 1.204 * load                          # kg/h dry air (approx.)
    w = max(0.0, x_in - x_sat) * m_air                             # kg/h
    return {"x_in_g": x_in * 1000, "x_sat_g": x_sat * 1000, "m_air_kgh": m_air, "water_Lh": w, "water_L_day": w * 16,
            "water_m3_year": w * P["hours_year"] / 1000}

# ---------------------------------------------------------------- chapter 6: safety valve choice, inspection
VB_SV_D0 = [4.0, 6.0, 8.0, 10.0, 12.0, 16.0, 20.0]          # flow diameters of small certified air safety valves mm (typical, check)

def vb_sv_select(P=None, blowdown=0.12):
    P = dict(DEFAULT if P is None else P)
    D = design(P)
    s = safety_valve(P, D)
    d0 = next(d for d in VB_SV_D0 if math.pi / 4 * d * d >= s["A_req_mm2"])
    A = math.pi / 4 * d0 * d0
    cap = s["Qm_kgh"] * A / s["A_req_mm2"]
    reseat = P["PS_bar"] * (1 - blowdown)
    return {"A_req": s["A_req_mm2"], "d0": d0, "A": A, "capacity_kgh": cap, "set_bar": P["PS_bar"], "full_lift_bar": P["PS_bar"] * 1.1,
            "reseat_bar": reseat, "reseat_above_cutout": reseat > P["p_off_bar"] * 1.1}

VB_INSPECTION = [   # periodic inspection in operation, German BetrSichV style for category III / IV gas vessels (check national law)
    ("external inspection", "2 years", "corrosion outside, supports, safety valve, gauge, drain"),
    ("internal inspection", "5 years", "corrosion inside (wall thickness by UT), cracks at nozzles"),
    ("strength test", "10 years", "hydraulic test at test pressure, or replaced by NDT"),
    ("safety valve function", "yearly (operator)", "lift by hand / bench test of set pressure"),
    ("condensate drain", "daily / automatic", "auto drain with alarm"),
]

# ---------------------------------------------------------------- demo
def demo_ch56():
    P = dict(DEFAULT)
    D = design(P)
    print("## 5.1 Stored energy and why pressure vessels are regulated")
    for pg, V in ((11.0, 150.0), (8.0, 150.0), (11.0, 500.0), (15.73, 150.0)):
        e = vb_stored_energy(pg, V)
        print("  %5.2f bar(g), %4.0f L: E %7.1f kJ = %5.1f g TNT" % (pg, V, e["E_kJ"], e["TNT_g"]))
    print("\n## 5.2 PED category (PS %.0f bar x V %.0f L)" % (P["PS_bar"], D["V"]))
    for g, pv, cat, mod in vb_ped_table(P["PS_bar"], D["V"]):
        print("  %-58s PS x V %5.0f bar L -> %-12s modules: %s" % (g, pv, cat, mod))
    for V in (24, 50, 90, 270, 500):
        c = ped_category(P["PS_bar"], V)
        print("  %4d L: PS x V %5.0f -> %-40s SPVD %s" % (V, c["PV"], c["PED"], "yes" if c["SPVD"] else "no"))
    print("\n## 5.3 Design stress f (MPa) at 20 / 100 / 150 / 200 C and test f")
    for m, fs, ft in vb_stress_table():
        print("  %-34s " % m + "  ".join("%6.1f" % x for x in fs) + "   test %.1f" % ft)
    print("\n## 5.4 Membrane stresses and Lame check (default shell, e_eff = %.1f mm)" % (D["t_shell"] - P["c_corr"] - P["c_tol"]))
    m = vb_membrane(D["P_MPa"], P["Di"], D["t_shell"] - P["c_corr"] - P["c_tol"])
    print("  hoop (Di) %.1f, Barlow (De) %.1f, mean %.1f, axial %.1f, Lame max hoop %.1f, Lame von Mises %.1f MPa" % (
        m["hoop_in"], m["barlow"], m["hoop_mean"], m["axial"], m["lame_t"], m["lame_vm"]))
    for r, q in vb_thick_study():
        print("  e/De %.2f: Lame max hoop / mean-diameter formula = %.3f" % (r, q))
    print("\n## 5.5 External pressure (vacuum after condensation / drain closed)")
    for e in (2.7, 4.0, 6.0):
        x = vb_external(P["Di"], e, D["L_cyl"])
        print("  e %.1f mm: p_cr long %.3f, short %.3f MPa -> allowed (S 3) %.2f bar" % (e, x["p_cr_long_MPa"], x["p_cr_short_MPa"], x["p_allow_bar"]))
    print("\n## 5.6 Heads compared (z 1, f %.1f MPa)" % design_stress(P["material"], P["TS_C"])["f"])
    hc = vb_head_compare()
    print("  cylinder e %.2f mm" % hc["e_cyl"])
    for h, e, r, M, ec in hc["rows"]:
        print("  %-24s e %.2f mm = %.2f x cylinder (M %.3f); EN crown only %.2f mm" % (h, e, r, M, ec))
    print("  knuckle factor M vs r/L: " + ", ".join("r/L %.3f -> M %.3f" % (r, M) for r, M in vb_M_curve()))
    print("  cone 30 deg, Dc 400: e %.2f mm; 45 deg: %.2f mm" % (vb_cone(D["P_MPa"], 400, 30, D["ds"]["f"], 0.85), vb_cone(D["P_MPa"], 400, 45, D["ds"]["f"], 0.85)))
    print("\n## 5.7 Openings: area replacement (DN50, d 50)")
    for ts, tn, Ar, Aa, ok in vb_nozzle_study():
        print("  shell %.1f, nozzle %.1f: required %.1f, available %.1f mm2 -> %s" % (ts, tn, Ar, Aa, "OK" if ok else "NOT OK"))
    pd = vb_pad()
    print("  shell 3.0 + pad 100 x 4: pad %.1f mm2, total %.1f >= %.1f -> %s" % (pd["A_pad"], pd["A_av"] + pd["A_pad"], pd["A_req"], "OK" if pd["ok"] else "NOT OK"))
    print("\n## 5.8 Flanges EN 1092-1 PN16 at %.0f C" % P["TS_C"])
    for dn in ("DN15", "DN25", "DN50"):
        f = vb_flange(dn, P["PS_bar"], P["TS_C"])
        fl = f["flange"]
        print("  %s: D %d, K %d, %d x %s, C %d; rating %.1f bar >= %.0f -> %s; bolt stress (rough) %.0f MPa" % (
            dn, fl["D"], fl["K"], fl["n"], fl["bolt"], fl["C"], f["rating_bar"], P["PS_bar"], "OK" if f["ok_rating"] else "NOT OK", f["sigma_bolt"]))
    print("\n## 5.9 Joint coefficient and testing groups")
    for g, ext, z, lim in VB_TESTING_GROUPS:
        print("  group %s: %-46s z %.2f  %s" % (g, ext, z, lim))
    for j, z, e, t in vb_joint_study():
        print("  %-32s z %.2f: e %.2f mm -> plate %.1f mm" % (j, z, e, t))
    print("  corrosion allowance 1.0 mm lasts: " + ", ".join("%.2f mm/y -> %.0f y" % (r, y) for r, y in vb_corrosion_life()))

    print("\n## 6.1 On/off cycle of the default receiver (V %.0f L, dp %.0f bar)" % (D["V"], P["p_off_bar"] - P["p_on_bar"]))
    rv = receiver_volume(P)
    for x, tf, te, tc, z in vb_onoff(D["V"], rv["q_Ls"], P["p_off_bar"] - P["p_on_bar"], P["p_in_bar_abs"]):
        print("  demand %3.0f %%: fill %5.0f s, empty %5.0f s, cycle %5.0f s -> %4.1f starts/h" % (100 * x, tf, te, tc, z))
    print("\n## 6.2 Required volume (L) vs switching band and starts per hour")
    print("  dp bar   " + "  ".join("%6d/h" % z for z in (6, 10, 15, 30)))
    for dp, row in vb_volume_study():
        print("  %.0f       " % dp + "  ".join("%8.0f" % v for v in row))
    v = vb_vsd()
    print("  variable-speed compressor (min speed 30 %%): %.0f L instead of %.0f L" % (v["V_vsd"], v["V_onoff"]))
    print("\n## 6.3 Supports")
    s = vb_saddles()
    print("  horizontal, 2 saddles A 150 mm, full of water: W %.0f N, Q %.0f N; M mid %.0f N m, M saddle %.0f N m -> sigma %.2f / %.2f MPa (pressure axial %.1f MPa)" % (
        s["W_N"], s["Q_N"], s["M_mid_Nmm"] / 1000, s["M_saddle_Nmm"] / 1000, s["sig_mid"], s["sig_saddle"], s["sig_axial_pressure"]))
    lg = vb_legs()
    print("  vertical, 3 legs 42.4 x 3.2, buckling length 400: F %.0f N per leg, F_cr %.0f N (S %.0f), stress %.1f MPa (S %.0f)" % (
        lg["F_leg"], lg["F_cr"], lg["S_buckle"], lg["sigma"], lg["S_yield"]))
    print("\n## 6.4 Test pressure and test energy")
    t = test_pressure(P, D)
    print("  P_test %.2f bar (EN 13445-5), %.1f bar (EN 286-1); shell stress at test %.0f MPa vs %.0f" % (t["P_test_bar"], t["P_test_SPV_bar"], t["sigma_test"], t["f_test"]))
    te = vb_test_energy()
    print("  stored energy at test: hydraulic %.1f J, pneumatic %.0f J -> pneumatic is %.0f x larger" % (te["E_hydro_J"], te["E_pneu_J"], te["ratio"]))
    print("\n## 6.5 Pressure-cycle fatigue study (nozzle)")
    rows, cls = vb_fatigue_study()
    for s_, z, ds, n, N, Dm in rows:
        print("  SCF %.1f, %2d starts/h: dsigma %5.1f MPa, n %.3g, N %s, D %.3f" % (s_, z, ds, n, "inf" if N == float("inf") else "%.3g" % N, Dm))
    for c, N, Dm in cls:
        print("  worst case SCF 4, 30/h with class %d: N %s, D %.2f" % (c, "inf" if N == float("inf") else "%.3g" % N, Dm))
    print("\n## 6.6 Condensate (intake 20 C 70 %% RH, receiver 30 C at %.0f bar(g), 60 %% load)" % P["p_off_bar"])
    c = vb_condensate()
    print("  water in %.2f g/kg, saturated in receiver %.2f g/kg, air %.1f kg/h -> %.3f L/h, %.1f L per 16 h day, %.2f m3 per year" % (
        c["x_in_g"], c["x_sat_g"], c["m_air_kgh"], c["water_Lh"], c["water_L_day"], c["water_m3_year"]))
    print("\n## 6.7 Safety valve")
    sv = vb_sv_select()
    print("  required %.2f mm2 -> smallest certified d0 %.0f mm (A %.1f mm2, capacity %.0f kg/h); set %.1f, full lift %.1f, reseat %.1f bar -> above 1.1 x cut-out: %s" % (
        sv["A_req"], sv["d0"], sv["A"], sv["capacity_kgh"], sv["set_bar"], sv["full_lift_bar"], sv["reseat_bar"], "yes" if sv["reseat_above_cutout"] else "no"))
    print("\n## 6.8 Inspection in operation (check national law)")
    for a, b, c_ in VB_INSPECTION:
        print("  %-24s %-20s %s" % (a, b, c_))

def cmd_examples():
    P = dict(DEFAULT)
    print(report_text(P))
    print("\n## Head types (same receiver)")
    for h in HEADS:
        D = design(dict(P, head=h))
        print("  %-24s e %.2f mm -> plate %.1f, depth %3.0f mm, head volume %5.1f L, cylinder %4.0f mm, mass %3.0f kg" % (
            h, D["e_head"], D["t_head"], D["h_head"], D["V_head"], D["L_cyl"], D["m_kg"]))
    print("\n## Diameter study (150 L)")
    for Di in (300.0, 350.0, 400.0, 450.0, 500.0):
        D = design(dict(P, Di=Di))
        print("  Di %3.0f: shell %.1f / head %.1f mm, length %4.0f mm (L/D %.1f), mass %3.0f kg" % (Di, D["t_shell"], D["t_head"], D["L_total"], D["L_total"] / Di, D["m_kg"]))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-66s %s %s" % (name, "OK  " if cond else "FAIL", info))
    e = shell_e(1.0, 400.0, 150.0, 1.0)
    sig = 1.0 * (400 + e) / (2 * e)                       # mean-diameter hoop stress
    chk("shell: mean-diameter hoop stress = f at e = P Di / (2 f - P)", abs(sig - 150.0) < 1e-9, "%.3f mm" % e)
    eh, _ = head_e("hemispherical", 1.0, 400.0, 150.0, 1.0)
    chk("hemisphere needs about half the cylinder thickness", 0.45 < eh / e < 0.55, "%.3f" % (eh / e))
    _, M = head_e("torispherical Kloepper", 1.0, 400.0, 150.0, 1.0)
    chk("Kloepper M = (3 + sqrt 10) / 4 = 1.541", abs(M - (3 + math.sqrt(10)) / 4) < 1e-12)
    Ve, _ = head_geometry("ellipsoidal 2:1", 1000.0)
    chk("2:1 ellipsoid volume = pi D^3 / 24", abs(Ve - math.pi / 24 * 1000) < 1e-9)
    P = dict(DEFAULT)
    D = design(P)
    Vtot = D["L_cyl"] / 1000 * math.pi / 4 * (P["Di"] / 1000) ** 2 * 1000 + 2 * D["V_head"]
    chk("length from volume gives the volume back", abs(Vtot - D["V"]) < 1e-9, "%.2f L" % Vtot)
    rv = receiver_volume(P)
    # on/off: one cycle = fill time + empty time; at 50 % load the cycle time is shortest: t = 4 V dp / (q p1)
    t_cycle = 4 * rv["V_req_L"] * (P["p_off_bar"] - P["p_on_bar"]) / (rv["q_Ls"] * P["p_in_bar_abs"])
    chk("receiver: shortest on/off cycle (50 % demand) = 1 / f_max", abs(t_cycle - 3600 / P["starts_per_h_max"]) < 1e-6, "%.0f s" % t_cycle)
    sv = safety_valve(P, D)
    chk("ISO 4126 C(k = 1.4) = 2.703", abs(sv["C"] - 2.7035) < 1e-3, "%.4f" % sv["C"])
    chk("PED: 11 bar x 150 L = 1650 bar L -> category III", ped_category(11, 150)["PED"] == "category III")
    chk("default receiver: nozzle, test and fatigue OK", nozzle(P, D)["ok"] and test_pressure(P, D)["ok"] and pressure_fatigue(P, D)["ok"])
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
    elif cmd in ("ch56",) and ("demo_" + cmd) in globals():
        globals()["demo_" + cmd]()
    elif cmd == "selftest":
        return cmd_selftest()
    elif cmd == "run":
        P = dict(DEFAULT)
        out = "vessel_out"
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
