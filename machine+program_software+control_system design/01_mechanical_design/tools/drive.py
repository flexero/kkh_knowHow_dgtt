#!/usr/bin/env python3
"""M9 drive program - belt, chain and coupling drives between a motor and a machine:
narrow V-belts (ISO 4184 sections SPZ/SPA/SPB/SPC, DIN 7753 / ISO 5292 design procedure, power rating from a
tension + bending + fatigue model, wrap and length factors, installation tension, shaft load, belt life, test force and
span frequency), synchronous belts (HTD 5M/8M/14M, ISO 13050 profiles, teeth in mesh, width selection), roller chains
(ISO 606 A series = ANSI, ACA link-plate and roller-bushing ratings, length in links, polygon effect, static safety,
lubrication regime) and flexible shaft couplings (elastic jaw coupling, DIN 740-2 selection: nominal, peak and vibratory
torque, two-mass torsional resonance with the compressor torque orders from M2).
Default case: compressor drive of guide M2 - motor 3 kW 2930 rpm -> crank 1450 rpm, centre distance about 400 mm,
plus the alternative "4-pole motor 1445 rpm + elastic coupling, no belt".
Guide: 09_belts_chains_couplings.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python drive.py params | run [--in p.json] [--out folder] | examples | selftest
  python drive.py ch24 | ch56 | ch78        extra results of guide chapters 2-4, 5-6, 7-8
  python drive.py run --in examples/drive_example.json --out example   worked design example (chapter 8)

Belt, chain and coupling data (section dimensions, permissible stresses, specific tooth loads, chain ratings, coupling
torques and stiffnesses) are TYPICAL VALUES in the style of the standards and of maker catalogues - check the
standards and the maker's data before a design is released. All default numbers are EXAMPLES.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # sibling tools (crank.py for the torque orders)

# ---------------------------------------------------------------- data: narrow V-belts (ISO 4184 style, check)
# bd datum width, h belt height, A cord-carrying cross section mm2, m mass kg/m, d_min smallest datum diameter mm,
# L_ref reference datum length mm (length factor c3 = 1), sig_ref permissible max. stress MPa at f_ref and L_h_ref
VBELT = {
    "SPZ": {"bd": 8.5, "top": 9.7, "h": 8.0, "A": 57.0, "m": 0.074, "d_min": 63, "L_ref": 1600, "Lr": (630, 3550), "sig_ref": 9.3},
    "SPA": {"bd": 11.0, "top": 12.7, "h": 10.0, "A": 93.0, "m": 0.123, "d_min": 90, "L_ref": 2500, "Lr": (800, 4500), "sig_ref": 9.0},
    "SPB": {"bd": 14.0, "top": 16.3, "h": 13.0, "A": 151.0, "m": 0.195, "d_min": 140, "L_ref": 3550, "Lr": (1250, 8000), "sig_ref": 8.5},
    "SPC": {"bd": 19.0, "top": 22.0, "h": 18.0, "A": 279.0, "m": 0.377, "d_min": 224, "L_ref": 5600, "Lr": (2000, 12500), "sig_ref": 8.3},
}
VB_MODEL = {"mu_eff": 0.512,      # effective wedge friction used for rating: e^(mu' pi) = 5 (gives the DIN wrap factor c1)
            "E_b": 50.0,          # bending modulus of the belt MPa (sig_b = E_b h / d)
            "f_ref": 20.0,        # reference bending frequency Hz
            "L_h_ref": 25000.0,   # reference life h
            "m_w": 10.0,          # Woehler exponent of the belt (sig^m N = const)
            "L_h_age": 40000.0}   # life limit by ageing of the rubber compound at about 30 C, h (typical, check)
D_SERIES = [50, 56, 63, 67, 71, 75, 80, 85, 90, 95, 100, 106, 112, 118, 125, 132, 140, 150, 160, 170, 180, 190, 200, 212,
            224, 236, 250, 265, 280, 300, 315, 335, 355, 375, 400, 425, 450, 475, 500, 530, 560, 600, 630, 670, 710, 750,
            800, 900, 1000, 1120, 1250]            # datum diameters of pulleys mm (ISO 4183 / R40 style)
LD_SERIES = [630, 710, 800, 900, 1000, 1120, 1250, 1400, 1600, 1800, 2000, 2240, 2500, 2800, 3150, 3550, 4000, 4500,
             5000, 5600, 6300, 7100, 8000, 9000, 10000, 11200, 12500]   # datum lengths mm (R20 style)
# service factor c2 (DIN 2218 / ISO 5292 style): load class x hours per day (<= 10, <= 16, > 16), soft-start motor
LOAD_CLASS = {
    "light (fans, centrifugal pumps)":        (1.0, 1.1, 1.2),
    "medium (screw compressors, conveyors)":  (1.1, 1.2, 1.3),
    "heavy (piston compressors, mills)":      (1.2, 1.3, 1.4),
    "very heavy (crushers, hoists)":          (1.3, 1.4, 1.5),
}

# ---------------------------------------------------------------- data: synchronous belts HTD (ISO 13050 style, check)
# p pitch mm, f_t permissible tooth load N per mm width per tooth in mesh, m_w belt mass kg/m per mm width,
# z_min smallest pulley, widths mm, lengths = catalogue pitch lengths mm (typical)
SYNC = {
    "5M":  {"p": 5.0, "f_t": 1.6, "m_w": 0.0030, "z_min": 14, "widths": [9, 15, 25],
            "lengths": [350, 400, 450, 500, 535, 565, 600, 640, 700, 750, 800, 850, 900, 1000, 1050, 1125, 1200, 1270, 1420, 1500, 1595, 1690, 1790, 2000]},
    "8M":  {"p": 8.0, "f_t": 3.8, "m_w": 0.0055, "z_min": 22, "widths": [20, 30, 50, 85],
            "lengths": [480, 560, 600, 640, 720, 800, 880, 960, 1040, 1120, 1200, 1280, 1440, 1600, 1760, 1800, 2000, 2400, 2600, 2800]},
    "14M": {"p": 14.0, "f_t": 9.0, "m_w": 0.0094, "z_min": 28, "widths": [40, 55, 85, 115, 170],
            "lengths": [966, 1092, 1190, 1400, 1610, 1778, 1890, 2100, 2310, 2450, 2590, 2800, 3150, 3500, 3850, 4326]},
}
Z_E_MAX = 6          # teeth in mesh counted for the rating (catalogue practice, check)

# ---------------------------------------------------------------- data: roller chains ISO 606 A series = ANSI (check)
# p pitch mm, F_B minimum breaking force kN, q mass kg/m, Kr roller-bushing constant of the ACA formula
CHAINS = {
    "06C (ANSI 35)":  {"p": 9.525, "F_B": 7.9, "q": 0.33, "Kr": 29.0},
    "08A (ANSI 40)":  {"p": 12.70, "F_B": 13.9, "q": 0.62, "Kr": 17.0},
    "10A (ANSI 50)":  {"p": 15.875, "F_B": 21.8, "q": 1.02, "Kr": 17.0},
    "12A (ANSI 60)":  {"p": 19.05, "F_B": 31.3, "q": 1.50, "Kr": 17.0},
    "16A (ANSI 80)":  {"p": 25.40, "F_B": 55.6, "q": 2.60, "Kr": 17.0},
    "20A (ANSI 100)": {"p": 31.75, "F_B": 87.0, "q": 3.91, "Kr": 17.0},
    "24A (ANSI 120)": {"p": 38.10, "F_B": 125.0, "q": 5.62, "Kr": 17.0},
}
STRAND_FACTOR = {1: 1.0, 2: 1.7, 3: 2.5, 4: 3.3}
HP = 0.7457          # kW per hp

# ---------------------------------------------------------------- data: elastic jaw coupling (generic catalogue style, check)
# size: T_KN nominal, T_Kmax peak, C_dyn dynamic torsional stiffness N m/rad (92 Sh A), J_hub kg m2 per hub,
# bore_max mm, n_max rpm, dKr permissible radial misalignment mm
JAW = {
    "J14": {"T_KN": 7.5, "T_Kmax": 15.0, "C_dyn": 380.0, "J_hub": 0.000003, "bore_max": 16, "n_max": 19000, "dKr": 0.17},
    "J19": {"T_KN": 10.0, "T_Kmax": 20.0, "C_dyn": 1280.0, "J_hub": 0.00002, "bore_max": 24, "n_max": 14000, "dKr": 0.20},
    "J24": {"T_KN": 35.0, "T_Kmax": 70.0, "C_dyn": 4900.0, "J_hub": 0.0001, "bore_max": 28, "n_max": 10600, "dKr": 0.22},
    "J28": {"T_KN": 95.0, "T_Kmax": 190.0, "C_dyn": 10300.0, "J_hub": 0.0003, "bore_max": 38, "n_max": 8500, "dKr": 0.25},
    "J38": {"T_KN": 190.0, "T_Kmax": 380.0, "C_dyn": 21000.0, "J_hub": 0.0011, "bore_max": 45, "n_max": 7100, "dKr": 0.28},
    "J42": {"T_KN": 265.0, "T_Kmax": 530.0, "C_dyn": 23200.0, "J_hub": 0.0021, "bore_max": 55, "n_max": 6000, "dKr": 0.32},
    "J48": {"T_KN": 310.0, "T_Kmax": 620.0, "C_dyn": 36200.0, "J_hub": 0.0035, "bore_max": 62, "n_max": 5600, "dKr": 0.36},
}
SPIDER = {"92 Sh A": {"T": 1.0, "C": 1.0, "psi": 0.80}, "98 Sh A": {"T": 1.7, "C": 2.4, "psi": 0.80}}
T_KW_RATIO = 0.26    # permissible vibratory torque at 10 Hz / T_KN (typical, check)

DEFAULT = {
    "name": "Compressor drive of M2: motor 3 kW 2930 rpm -> crank 1450 rpm (example)",
    "P_kW": 3.0,                      # motor rated power (design basis)
    "P_load_kW": 1.58,                # actual mean shaft power of the compressor (M2 crank.py, P_shaft)
    "n1": 2930.0, "n2": 1450.0,       # motor speed, required machine speed rpm
    "load_class": "heavy (piston compressors, mills)", "hours_per_day": 16.0,
    "a_target": 400.0,                # wanted centre distance mm (layout of M2 / M3)
    # V-belt
    "vb_section": "SPZ", "vb_d1": 150.0, "vb_slip": 0.01,
    # synchronous belt
    "sy_profile": "8M", "sy_z1": 32, "sy_z2": 65,
    # roller chain
    "ch_chain": "08A (ANSI 40)", "ch_z1": 19, "ch_z2": 38, "ch_strands": 1,
    # direct drive alternative: 4-pole motor + elastic jaw coupling
    "cp_spider": "92 Sh A", "cp_n": 1445.0, "cp_J_motor": 0.0095, "cp_J_load": 0.075,
    "cp_T_harm": [[1, 15.41], [3, 10.35], [4, 10.55], [5, 4.15]],    # compressor torque orders N m (M2 crank.py, DFT)
    "cp_k_start": 2.5, "cp_S_A": 1.8, "cp_starts_h": 6.0, "cp_T_amb": 40.0, "cp_d_motor": 28.0, "cp_d_load": 30.0,
    # energy comparison
    "hours_year": 4000.0, "eur_kWh": 0.20, "eta_motor_2p": 0.871, "eta_motor_4p": 0.877,
    "eta_motor_belt": 0.871,          # efficiency of the motor used with the belt / chain drives (2-pole here, IE3 - check)
}

# ---------------------------------------------------------------- general helpers
def service_factor(P):
    t = LOAD_CLASS[P["load_class"]]
    h = P["hours_per_day"]
    return t[0] if h <= 10 else t[1] if h <= 16 else t[2]

def nearest(x, series):
    return min(series, key=lambda s: abs(s - x))

def open_belt(d1, d2, a):
    """Open belt geometry: approximate and exact length, wrap angles, span length."""
    gam = math.asin((d2 - d1) / (2 * a))
    L_exact = 2 * a * math.cos(gam) + math.pi * (d1 + d2) / 2 + gam * (d2 - d1)
    L_approx = 2 * a + math.pi / 2 * (d1 + d2) + (d2 - d1) ** 2 / (4 * a)
    return {"gamma": gam, "beta1": math.pi - 2 * gam, "beta2": math.pi + 2 * gam, "L_exact": L_exact, "L_approx": L_approx,
            "span": a * math.cos(gam)}

def centre_from_length(L, d1, d2):
    """Inverse of the approximate length formula: a = 1/4 [k + sqrt(k^2 - 2 (d2 - d1)^2)], k = L - pi/2 (d1 + d2)."""
    k = L - math.pi / 2 * (d1 + d2)
    return 0.25 * (k + math.sqrt(k * k - 2 * (d2 - d1) ** 2))

# ---------------------------------------------------------------- chapter 3: narrow V-belt
def vb_c1(beta, mu=None):
    """Wrap factor = friction capacity at beta / at 180 deg (Euler-Eytelwein)."""
    mu = VB_MODEL["mu_eff"] if mu is None else mu
    return (1 - math.exp(-mu * beta)) / (1 - math.exp(-mu * math.pi))

def vb_c3(sec, L):
    """Length factor: a longer belt bends less often -> higher permissible stress (Woehler): (L / L_ref)^(1/m)."""
    return (L / VBELT[sec]["L_ref"]) ** (1 / VB_MODEL["m_w"])

def vb_sig_perm(sec, v, L):
    """Permissible max. belt stress for the reference life at bending frequency f_B = 2 v / L."""
    fB = 2 * v / (L / 1000)
    return VBELT[sec]["sig_ref"] * (VB_MODEL["f_ref"] / fB) ** (1 / VB_MODEL["m_w"]), fB

def vb_rated(sec, d1, n1, L=None, beta=math.pi):
    """Power per belt (kW) from the stress model: F1_max = A (sig_perm - sig_b); F_e = (F1_max - m v^2)(1 - e^(-mu' beta))."""
    S = VBELT[sec]
    L = S["L_ref"] if L is None else L
    v = math.pi * d1 * n1 / 60000
    sp, fB = vb_sig_perm(sec, v, L)
    sb = VB_MODEL["E_b"] * S["h"] / d1
    F1 = S["A"] * (sp - sb)
    Fc = S["m"] * v * v
    Fe = max(0.0, (F1 - Fc) * (1 - math.exp(-VB_MODEL["mu_eff"] * beta)))
    return {"P_kW": Fe * v / 1000, "v": v, "f_B": fB, "sig_perm": sp, "sig_b": sb, "F1_max": F1, "F_c": Fc, "F_e": Fe}

def vbelt(P, sec=None, d1=None):
    """Complete V-belt drive design (DIN 7753-2 / ISO 5292 procedure)."""
    sec = P["vb_section"] if sec is None else sec
    d1 = P["vb_d1"] if d1 is None else d1
    S = VBELT[sec]
    c2 = service_factor(P)
    PB = P["P_kW"] * c2
    d2 = nearest(P["n1"] * d1 * (1 - P["vb_slip"]) / P["n2"], D_SERIES)
    a0 = max(P["a_target"], 0.7 * (d1 + d2))                # wanted centre distance, at least the DIN minimum
    L_th = open_belt(d1, d2, a0)["L_approx"]
    Ld = nearest(L_th, [x for x in LD_SERIES if S["Lr"][0] <= x <= S["Lr"][1]])
    a = centre_from_length(Ld, d1, d2)
    g = open_belt(d1, d2, a)
    r0 = vb_rated(sec, d1, P["n1"])                         # rating at 180 deg and L_ref (catalogue value P_N)
    c1, c3 = vb_c1(g["beta1"]), vb_c3(sec, Ld)
    z = max(1, math.ceil(PB / (r0["P_kW"] * c1 * c3) - 1e-9)) if r0["P_kW"] > 0.01 else 99   # 99 = belt cannot carry power
    v = r0["v"]
    e = math.exp(VB_MODEL["mu_eff"] * g["beta1"])
    FeB = PB * 1000 / (z * v)                               # design effective pull per belt
    Fc = S["m"] * v * v
    T0 = FeB * (e + 1) / (2 * (e - 1)) + Fc                 # static (installation) tension per belt
    F1, F2 = T0 + FeB / 2, T0 - FeB / 2                     # running span forces at design power (incl. Fc)
    F_shaft = 2 * (T0 - Fc) * z * math.sin(g["beta1"] / 2)  # shaft load when running
    F_shaft_static = 2 * T0 * z * math.sin(g["beta1"] / 2)  # shaft load at standstill (installation)
    # life at the actual load (tension set for the design power)
    Fe_act = P["P_load_kW"] * 1000 / (z * v)
    sig_max = (T0 + Fe_act / 2) / S["A"] + VB_MODEL["E_b"] * S["h"] / d1
    fB = 2 * v / (Ld / 1000)
    Lh_fat = VB_MODEL["L_h_ref"] * (VB_MODEL["f_ref"] / fB) * (S["sig_ref"] / sig_max) ** VB_MODEL["m_w"]
    Lh = min(Lh_fat, VB_MODEL["L_h_age"])                  # expected life: fatigue or ageing, whichever comes first
    n2 = P["n1"] * d1 * (1 - P["vb_slip"]) / d2
    test_def = 16.0 * g["span"] / 1000                      # deflection 16 mm per 1000 mm span
    F_test = 4 * T0 * test_def / g["span"]                  # mid-span force for that deflection (string)
    f_span = 1 / (2 * g["span"] / 1000) * math.sqrt(T0 / S["m"])
    ok = {"d1_ge_dmin": d1 >= S["d_min"], "speed_le_42": v <= 42.0, "fB_le_100": fB <= 100.0,
          "a_range": 0.7 * (d1 + d2) <= a <= 2 * (d1 + d2), "beta1_ge_120": math.degrees(g["beta1"]) >= 120.0,
          "belts_le_6": z <= 6, "a_near_target": abs(a / P["a_target"] - 1) <= 0.25, "speed_error_le_3pct": abs(n2 / P["n2"] - 1) <= 0.03}
    return {"section": sec, "c2": c2, "P_B": PB, "d1": d1, "d2": d2, "L_th": L_th, "Ld": Ld, "a": a,
            "beta1_deg": math.degrees(g["beta1"]), "span": g["span"], "P_N": r0["P_kW"], "rating": r0, "c1": c1, "c3": c3,
            "P_per_belt": r0["P_kW"] * c1 * c3, "z": z, "v": v, "f_B": fB, "F_e": FeB, "F_c": Fc, "T0": T0, "F1": F1, "F2": F2,
            "F_shaft": F_shaft, "F_shaft_static": F_shaft_static, "sig_max": sig_max, "L_h_fat": Lh_fat, "L_h": Lh, "n2": n2,
            "i": d2 / (d1 * (1 - P["vb_slip"])), "test_deflection": test_def, "F_test": F_test, "f_span": f_span, "ok": ok}

def vbelt_table(P):
    """All sections x standard small pulleys: number of belts, width, life - the cheapest passing drive."""
    rows = []
    for sec, S in VBELT.items():
        for d1 in D_SERIES:
            if d1 < S["d_min"] or d1 > 2.6 * S["d_min"]:
                continue
            V = vbelt(P, sec, float(d1))
            rows.append({"section": sec, "d1": d1, "d2": V["d2"], "z": V["z"], "width": V["z"] * S["top"], "v": V["v"],
                         "Ld": V["Ld"], "L_h": V["L_h"], "L_h_fat": V["L_h_fat"], "F_shaft": V["F_shaft"], "ok": all(V["ok"].values()),
                         "fails": [k for k, v in V["ok"].items() if not v]})
    good = [r for r in rows if r["ok"] and r["L_h"] >= VB_MODEL["L_h_ref"]]
    best = min(good, key=lambda r: (r["width"], r["d2"])) if good else None
    return {"rows": rows, "best": best}

# ---------------------------------------------------------------- chapter 4: synchronous belt
def sync(P, prof=None, z1=None, z2=None):
    prof = P["sy_profile"] if prof is None else prof
    S = SYNC[prof]
    z1 = int(P["sy_z1"] if z1 is None else z1)
    z2 = int(P["sy_z2"] if z2 is None else z2)
    p = S["p"]
    d1, d2 = z1 * p / math.pi, z2 * p / math.pi
    L_th = open_belt(d1, d2, P["a_target"])["L_approx"]
    Lp = nearest(L_th, S["lengths"])
    a = centre_from_length(Lp, d1, d2)
    g = open_belt(d1, d2, a)
    zm = z1 * g["beta1"] / (2 * math.pi)                    # teeth in mesh on the small pulley
    ze = min(math.floor(zm), Z_E_MAX)
    v = math.pi * d1 * P["n1"] / 60000
    c2 = service_factor(P)
    PB = P["P_kW"] * c2
    per_mm = v * (ze * S["f_t"] - S["m_w"] * v * v) / 1000  # kW per mm width
    b = next((w for w in S["widths"] if w * per_mm >= PB), None)
    bb = b if b else S["widths"][-1]
    Fe = PB * 1000 / v
    T0 = 0.6 * Fe + S["m_w"] * bb * v * v                   # installation span tension (typical rule, check maker)
    n2 = P["n1"] * z1 / z2
    ok = {"z1_ge_zmin": z1 >= S["z_min"], "teeth_in_mesh_ge_6": zm >= 6, "width_found": b is not None,
          "speed_le_40": v <= 40.0, "speed_error_le_3pct": abs(n2 / P["n2"] - 1) <= 0.03}
    return {"profile": prof, "p": p, "z1": z1, "z2": z2, "d1": d1, "d2": d2, "L_th": L_th, "Lp": Lp, "z_belt": Lp / p,
            "a": a, "beta1_deg": math.degrees(g["beta1"]), "z_m": zm, "z_e": ze, "v": v, "c2": c2, "P_B": PB,
            "P_per_mm": per_mm, "b": b, "P_rated": bb * per_mm, "F_e": Fe, "T0": T0, "F_shaft": 2 * T0 * math.sin(g["beta1"] / 2),
            "n2": n2, "ok": ok}

# ---------------------------------------------------------------- chapter 5: roller chain
def chain_rating(name, z1, n1):
    """ACA formulas (hp, pitch in inch): link plate H1 = 0.004 z1^1.08 n1^0.9 p^(3 - 0.07 p);
    roller-bushing H2 = 1000 Kr z1^1.5 p^0.8 / n1^1.5. Rating = min(H1, H2) for one strand (good lubrication)."""
    C = CHAINS[name]
    p = C["p"] / 25.4
    H1 = 0.004 * z1 ** 1.08 * n1 ** 0.9 * p ** (3 - 0.07 * p)
    H2 = 1000 * C["Kr"] * z1 ** 1.5 * p ** 0.8 / n1 ** 1.5
    return {"H1_kW": H1 * HP, "H2_kW": H2 * HP, "P_kW": min(H1, H2) * HP, "limit": "link plate" if H1 < H2 else "roller-bushing"}

def chain_length(z1, z2, a, p):
    """Number of links X = 2a/p + (z1 + z2)/2 + ((z2 - z1)/(2 pi))^2 p / a."""
    return 2 * a / p + (z1 + z2) / 2 + ((z2 - z1) / (2 * math.pi)) ** 2 * p / a

def chain_centre(X, z1, z2, p):
    A = X - (z1 + z2) / 2
    return p / 4 * (A + math.sqrt(A * A - 8 * ((z2 - z1) / (2 * math.pi)) ** 2))

def lubrication(v):
    """Lubrication regime by chain speed (typical maker chart, check)."""
    return "manual / grease" if v <= 2 else "drip" if v <= 4 else "oil bath / slinger" if v <= 7 else "pressure spray (oil pump)"

def chain(P, name=None, z1=None, z2=None, strands=None):
    name = P["ch_chain"] if name is None else name
    C = CHAINS[name]
    z1 = int(P["ch_z1"] if z1 is None else z1)
    z2 = int(P["ch_z2"] if z2 is None else z2)
    k = int(P["ch_strands"] if strands is None else strands)
    p = C["p"]
    r = chain_rating(name, z1, P["n1"])
    Ks = service_factor(P)
    P_req = P["P_kW"] * Ks
    P_all = r["P_kW"] * STRAND_FACTOR[k]
    X = chain_length(z1, z2, P["a_target"], p)
    Xe = 2 * round(X / 2)                                  # even number of links (no cranked link)
    a = chain_centre(Xe, z1, z2, p)
    d1 = p / math.sin(math.pi / z1)
    d2 = p / math.sin(math.pi / z2)
    v = z1 * p * P["n1"] / 60000
    Ft = P["P_kW"] * 1000 / v
    Fc = C["q"] * v * v
    S_static = C["F_B"] * 1000 * k / (Ft * Ks + Fc)
    poly = 1 - math.cos(math.pi / z1)                      # speed variation (v_max - v_min)/v_max of the polygon
    n2 = P["n1"] * z1 / z2
    ok = {"rating": P_all >= P_req, "z1_ge_17": z1 >= 17, "static_safety_ge_7": S_static >= 7.0,
          "a_30_to_80_pitches": 30 <= a / p <= 80, "speed_error_le_3pct": abs(n2 / P["n2"] - 1) <= 0.03, "speed_le_15": v <= 15}
    return {"chain": name, "p": p, "z1": z1, "z2": z2, "strands": k, "d1": d1, "d2": d2, "rating": r, "K_s": Ks,
            "P_req": P_req, "P_allow": P_all, "X_th": X, "X": Xe, "a": a, "v": v, "F_t": Ft, "F_c": Fc, "S_static": S_static,
            "polygon": poly, "lub": lubrication(v), "needs_pressure_oil": v > 7, "F_shaft": 1.15 * Ft, "n2": n2, "ok": ok}

# ---------------------------------------------------------------- chapter 6: flexible coupling (DIN 740-2 style)
def S_t(T):
    return 1.0 if T <= 30 else 1.2 if T <= 40 else 1.4 if T <= 60 else 1.8

def S_z(starts):
    return 1.0 if starts <= 100 else 1.2 if starts <= 200 else 1.4 if starts <= 400 else 1.6

def magnification(eta, psi):
    """V = sqrt(1 + d^2) / sqrt((1 - eta^2)^2 + d^2), d = psi / (2 pi) (hysteretic damping of the elastomer)."""
    d = psi / (2 * math.pi)
    return math.sqrt(1 + d * d) / math.sqrt((1 - eta * eta) ** 2 + d * d)

def coupling_check(P, size, spider=None):
    spider = P["cp_spider"] if spider is None else spider
    J, sp = JAW[size], SPIDER[spider]
    TKN, TKmax = J["T_KN"] * sp["T"], J["T_Kmax"] * sp["T"]
    TKW = T_KW_RATIO * TKN
    C, psi = J["C_dyn"] * sp["C"], sp["psi"]
    JA, JL = P["cp_J_motor"] + J["J_hub"], P["cp_J_load"] + J["J_hub"]
    fe = math.sqrt(C * (JA + JL) / (JA * JL)) / (2 * math.pi)
    st = S_t(P["cp_T_amb"])
    TN = 9550 * P["P_kW"] / P["cp_n"]
    MA, ML = JL / (JA + JL), JA / (JA + JL)                  # share of a drive-side / load-side torque seen by the coupling
    TS = P["cp_k_start"] * TN * MA * P["cp_S_A"] * S_z(P["cp_starts_h"]) * st
    orders = []
    for k, Tk in P["cp_T_harm"]:
        f = k * P["cp_n"] / 60
        eta = f / fe
        V = magnification(eta, psi)
        Tc = Tk * ML * V
        Sf = max(1.0, math.sqrt(f / 10))
        orders.append({"order": k, "f": f, "eta": eta, "V": V, "T_coupling": Tc, "T_check": Tc * st * Sf, "util": Tc * st * Sf / TKW})
    supercritical = [o for o in orders if o["eta"] > 1]
    T_res = max((o["T_coupling"] / o["V"] * magnification(1.0, psi) for o in supercritical), default=0.0) * S_z(P["cp_starts_h"]) * st
    ok = {"bore": max(P["cp_d_motor"], P["cp_d_load"]) <= J["bore_max"], "nominal": TKN >= TN * st, "peak_start": TKmax >= TS,
          "vibratory": all(o["util"] <= 1 for o in orders), "resonance_passage": TKmax >= T_res,
          "no_resonance": all(not 0.8 <= o["eta"] <= 1.3 for o in orders), "speed": P["cp_n"] <= J["n_max"]}
    return {"size": size, "spider": spider, "T_KN": TKN, "T_Kmax": TKmax, "T_KW": TKW, "C_dyn": C, "psi": psi, "J_A": JA, "J_L": JL,
            "f_e": fe, "S_t": st, "T_N": TN, "M_A": MA, "M_L": ML, "T_S": TS, "orders": orders, "T_res": T_res, "ok": ok}

def coupling(P):
    rows = [coupling_check(P, s) for s in JAW]
    best = next((r for r in rows if all(r["ok"].values())), None)
    return {"rows": rows, "best": best}

# ---------------------------------------------------------------- chapter 7: comparison of the drives
def compare(P):
    V, Y, K, Cp = vbelt(P), sync(P), chain(P), coupling(P)
    eta = {"V-belt": 0.95, "synchronous belt": 0.98, "roller chain": 0.97, "direct + coupling": 0.995}   # typical, check
    rows = []
    for name, ok, n2, Fs in (("V-belt", all(V["ok"].values()), V["n2"], V["F_shaft"]),
                             ("synchronous belt", all(Y["ok"].values()), Y["n2"], Y["F_shaft"]),
                             ("roller chain", all(K["ok"].values()), K["n2"], K["F_shaft"]),
                             ("direct + coupling", Cp["best"] is not None, P["cp_n"], 0.0)):
        em = P["eta_motor_4p"] if name.startswith("direct") else P.get("eta_motor_belt", P["eta_motor_2p"])
        P_el = P["P_load_kW"] * n2 / P["n2"] / (eta[name] * em)                       # load power scales ~ with speed
        rows.append({"drive": name, "ok": ok, "n2": n2, "eta_drive": eta[name], "eta_motor": em, "P_el_kW": P_el,
                     "kWh_year": P_el * P["hours_year"], "eur_year": P_el * P["hours_year"] * P["eur_kWh"], "F_shaft": Fs})
    return rows

def summary(P):
    if P["n2"] >= P["n1"]:
        raise ValueError("drive.py rates the small pulley / sprocket on the motor side: only reduction drives (n2 < n1)")
    return {"vbelt": vbelt(P), "sync": sync(P), "chain": chain(P), "coupling": coupling(P), "compare": compare(P),
            "vb_table": vbelt_table(P)}

# ---------------------------------------------------------------- report / run
def report_text(P):
    S = summary(P)
    V, Y, K, Cp, Cm, T = (S[k] for k in ("vbelt", "sync", "chain", "coupling", "compare", "vb_table"))
    fl = lambda ok: "all checks OK" if all(ok.values()) else "fails: " + ", ".join(k for k, v in ok.items() if not v)
    L = ["# Drive report (belts, chain, coupling) - %s\n" % P["name"],
         "Task: %.2f kW motor at %.0f rpm -> %.0f rpm (i %.3f), actual load %.2f kW; %s, %.0f h/day -> service factor c2 %.2f; a about %.0f mm" % (
             P["P_kW"], P["n1"], P["n2"], P["n1"] / P["n2"], P["P_load_kW"], P["load_class"], P["hours_per_day"], V["c2"], P["a_target"]),
         "\n## Narrow V-belt %s (DIN 7753 / ISO 5292 procedure)" % V["section"],
         "- design power P_B = %.2f x %.2f = %.2f kW; pulleys d1 %.0f / d2 %.0f mm, belt speed %.2f m/s" % (P["P_kW"], V["c2"], V["P_B"], V["d1"], V["d2"], V["v"]),
         "- datum length: theoretical %.0f -> standard Ld %.0f mm, centre distance a %.1f mm, wrap angle %.1f deg, span %.0f mm" % (
             V["L_th"], V["Ld"], V["a"], V["beta1_deg"], V["span"]),
         "- rating P_N %.2f kW per belt (180 deg, L_ref); c1 %.3f, c3 %.3f -> %.2f kW per belt -> z = %d belt(s)" % (
             V["P_N"], V["c1"], V["c3"], V["P_per_belt"], V["z"]),
         "- per belt: effective pull %.0f N, centrifugal %.1f N, installation tension T0 %.0f N, F1 %.0f / F2 %.0f N; shaft load %.0f N running (%.0f N at standstill)" % (
             V["F_e"], V["F_c"], V["T0"], V["F1"], V["F2"], V["F_shaft"], V["F_shaft_static"]),
         "- bending frequency %.1f Hz, max stress %.2f MPa at the actual load -> fatigue life %.0f h; expected life %.0f h (ageing limit %.0f h)" % (
             V["f_B"], V["sig_max"], V["L_h_fat"], V["L_h"], VB_MODEL["L_h_age"]),
         "- tension check: %.1f mm deflection at mid-span with %.1f N, or span frequency %.0f Hz; output %.1f rpm -> %s" % (
             V["test_deflection"], V["F_test"], V["f_span"], V["n2"], fl(V["ok"])),
         "- cheapest passing V-belt drive (smallest belt width, life >= %.0f h): %s" % (VB_MODEL["L_h_ref"],
             "%s d1 %d / d2 %d, %d belt(s), width %.1f mm, life %.0f h" % (T["best"]["section"], T["best"]["d1"], T["best"]["d2"], T["best"]["z"], T["best"]["width"], T["best"]["L_h"]) if T["best"] else "none"),
         "\n## Synchronous belt HTD %s" % Y["profile"],
         "- z1 %d / z2 %d, d %.2f / %.2f mm, belt %.0f mm (%.0f teeth), a %.1f mm, wrap %.1f deg, teeth in mesh %.1f (counted %d)" % (
             Y["z1"], Y["z2"], Y["d1"], Y["d2"], Y["Lp"], Y["z_belt"], Y["a"], Y["beta1_deg"], Y["z_m"], Y["z_e"]),
         "- v %.2f m/s, rating %.3f kW per mm width -> width %s mm (%.2f kW >= %.2f kW); T0 %.0f N, shaft load %.0f N; output %.1f rpm -> %s" % (
             Y["v"], Y["P_per_mm"], Y["b"], Y["P_rated"], Y["P_B"], Y["T0"], Y["F_shaft"], Y["n2"], fl(Y["ok"])),
         "\n## Roller chain %s x %d" % (K["chain"], K["strands"]),
         "- z1 %d / z2 %d, d %.1f / %.1f mm, v %.2f m/s, %d links (theory %.1f), a %.1f mm (%.0f pitches)" % (
             K["z1"], K["z2"], K["d1"], K["d2"], K["v"], K["X"], K["X_th"], K["a"], K["a"] / K["p"]),
         "- rating per strand: link plate %.2f kW, roller-bushing %.2f kW -> %.2f kW (%s); allowed %.2f kW vs required %.2f kW" % (
             K["rating"]["H1_kW"], K["rating"]["H2_kW"], K["rating"]["P_kW"], K["rating"]["limit"], K["P_allow"], K["P_req"]),
         "- chain pull %.0f N, centrifugal %.1f N, static safety %.1f; polygon speed variation %.2f %%; lubrication: %s -> %s" % (
             K["F_t"], K["F_c"], K["S_static"], 100 * K["polygon"], K["lub"], fl(K["ok"])),
         "\n## Direct drive: 4-pole motor %.0f rpm + elastic jaw coupling (%s, DIN 740-2 style)" % (P["cp_n"], P["cp_spider"])]
    for r in Cp["rows"]:
        L.append("- %s: T_KN %.0f, T_Kmax %.0f, T_KW %.1f N m, C %.0f N m/rad -> f_e %.0f Hz; start %.1f N m; vib. util. max %.2f -> %s" % (
            r["size"], r["T_KN"], r["T_Kmax"], r["T_KW"], r["C_dyn"], r["f_e"], r["T_S"], max(o["util"] for o in r["orders"]), fl(r["ok"])))
    b = Cp["best"]
    if b:
        L.append("- selected %s: T_N %.1f N m x S_t %.1f; start torque at coupling %.1f N m (M_A %.3f); orders: %s" % (
            b["size"], b["T_N"], b["S_t"], b["T_S"], b["M_A"],
            ", ".join("%d (%.1f Hz, eta %.2f, V %.2f, %.2f N m)" % (o["order"], o["f"], o["eta"], o["V"], o["T_coupling"]) for o in b["orders"])))
    L.append("\n## Comparison (energy at %.0f h/year, %.2f EUR/kWh; efficiencies typical - check)" % (P["hours_year"], P["eur_kWh"]))
    for r in Cm:
        L.append("- %-18s %s, n2 %.0f rpm, eta drive %.3f x motor %.3f -> %.3f kW electric, %.0f kWh/y, %.0f EUR/y, shaft load %.0f N" % (
            r["drive"], "OK     " if r["ok"] else "NOT OK ", r["n2"], r["eta_drive"], r["eta_motor"], r["P_el_kW"], r["kWh_year"], r["eur_year"], r["F_shaft"]))
    return "\n".join(L)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    V = vbelt(P)
    with open(os.path.join(out, "drive_data.csv"), "w", encoding="utf-8") as f:
        f.write("item,value\n")
        for k, v in (("belt", "%d x %s Ld %.0f" % (V["z"], V["section"], V["Ld"])), ("datum diameter d1 mm", V["d1"]),
                     ("datum diameter d2 mm", V["d2"]), ("centre distance a mm", V["a"]), ("wrap angle deg", V["beta1_deg"]),
                     ("installation tension per belt N", V["T0"]), ("test deflection mm / force N", "%.1f / %.1f" % (V["test_deflection"], V["F_test"])),
                     ("span frequency Hz", V["f_span"]), ("shaft load running N", V["F_shaft"]), ("shaft load standstill N", V["F_shaft_static"])):
            f.write("%s,%s\n" % (k, v if isinstance(v, str) else "%.2f" % v))
    print(rep)
    print("written: report.md, drive_data.csv ->", out)



# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2: belt mechanics
BELT_TYPES = [   # type, power transmission, typical speed m/s, efficiency, note
    ("flat belt (polyamide / polyester core)", "friction, flat", "up to 80", "0.97-0.99", "very high speed, needs high tension, crowned pulleys"),
    ("classical V-belt (Z, A, B, C, ISO 4184)", "friction, wedge", "up to 30", "0.92-0.96", "old standard, cheap, low power per belt"),
    ("narrow V-belt (SPZ, SPA, SPB, SPC)", "friction, wedge", "up to 42", "0.94-0.97", "1.5-2 x the power of a classical belt of equal width"),
    ("raw-edge cogged narrow V-belt (XPZ ...)", "friction, wedge, notched", "up to 50", "0.95-0.97", "smaller pulleys, cooler running"),
    ("banded V-belt (joined set)", "friction, wedge", "up to 30", "0.94-0.97", "no belt turn-over on shock loads / long spans"),
    ("ribbed belt (PJ, PK, PL, PM; ISO 9982)", "friction, small wedges", "up to 60", "0.96-0.98", "thin -> very small pulleys, serpentine drives"),
    ("synchronous belt (HTD, GT, AT, T)", "form fit (teeth)", "up to 40-80", "0.97-0.99", "exact ratio, low tension"),
]
CORD_MATERIALS = [   # cord, modulus, elongation, use (typical, check)
    ("polyester", "medium, ~ 8 GPa (cord)", "medium, slight creep", "standard V-belts and ribbed belts"),
    ("aramid", "high, ~ 60 GPa", "very low", "high power, shock, small elongation; poor in compression -> careful at small pulleys"),
    ("glass fibre", "high, ~ 70 GPa", "very low, no creep", "synchronous belts (HTD, GT); must not be kinked before installation"),
    ("carbon fibre", "very high, ~ 230 GPa", "lowest", "high-power synchronous belts (motorcycle, compressor)"),
    ("steel", "very high, ~ 200 GPa", "lowest", "polyurethane synchronous belts (AT, T) for linear axes"),
]
COMPOUNDS = [   # compound, temperature range C, note (typical, check)
    ("CR (chloroprene)", "-30 ... +80", "classical compound, oil resistant, ages above 80 C"),
    ("EPDM", "-40 ... +120", "modern compound, ozone / heat resistant, longer life, not oil resistant"),
    ("HNBR", "-30 ... +120", "synchronous belts with oil contact (engines)"),
    ("PU (polyurethane)", "-20 ... +80", "cast / extruded synchronous belts with steel cords, abrasion resistant"),
]

def capstan_numeric(mu, beta, F2=1.0, n=2000):
    """Integrate dF/dtheta = mu F along the wrap (explicit midpoint steps) -> F1/F2; compare with e^(mu beta)."""
    F, h = F2, beta / n
    for _ in range(n):
        Fm = F + 0.5 * h * mu * F
        F += h * mu * Fm
    return F / F2

def wedge_mu(mu, groove_deg):
    """Wedge effect: the normal force on the two flanks is N / sin(alpha/2) -> mu' = mu / sin(alpha/2)."""
    return mu / math.sin(math.radians(groove_deg) / 2)

def capstan_table(mus=(0.25, 0.512, 0.9), betas=(120, 150, 180, 210)):
    return [(mu, [(b, math.exp(mu * math.radians(b))) for b in betas]) for mu in mus]

EA_VB = {"SPZ": 1.0e5, "SPA": 1.6e5, "SPB": 2.6e5, "SPC": 4.8e5}   # cord stiffness per belt N (typical, check)

def creep_estimate(V):
    """Elastic creep: the belt is longer in the tight span by F1/EA than in the slack span -> speed loss s = (F1 - F2)/EA.
    The real V-belt loss (1 ... 2 %) is larger: radial sinking into the groove and compression of the rubber."""
    EA = EA_VB[V["section"]]
    s = (V["F1"] - V["F2"]) / EA
    return {"EA": EA, "creep": s, "rpm_loss": s * DEFAULT["n2"]}

def power_speed_curve(sec="SPZ", d1=150.0, n_list=None):
    """Rating vs speed for one pulley: P rises with v, centrifugal force m v^2 eats the permissible tension -> maximum.
    With constant F1_perm: dP/dv = 0 -> v_opt = sqrt(F1_perm / (3 m))."""
    n_list = n_list or [500 * k for k in range(1, 25)]
    rows = [(n, vb_rated(sec, d1, n)) for n in n_list]
    best = max(rows, key=lambda r: r[1]["P_kW"])
    r = best[1]
    v_opt_formula = math.sqrt(r["F1_max"] / (3 * VBELT[sec]["m"]))
    return {"rows": rows, "n_best": best[0], "v_best": r["v"], "P_best": r["P_kW"], "v_opt_formula": v_opt_formula}

def belt_stresses(V):
    """Stresses in the tight span at the small pulley: tension F1/A (incl. centrifugal part m v^2 / A) + bending E_b h / d."""
    S = VBELT[V["section"]]
    st = V["F1"] / S["A"]
    sc = V["F_c"] / S["A"]
    sb1 = VB_MODEL["E_b"] * S["h"] / V["d1"]
    sb2 = VB_MODEL["E_b"] * S["h"] / V["d2"]
    return {"sig_t1": st, "sig_c": sc, "sig_t2": V["F2"] / S["A"], "sig_b1": sb1, "sig_b2": sb2, "sig_max": st + sb1,
            "sig_perm": vb_sig_perm(V["section"], V["v"], V["Ld"])[0]}

def crossed_belt(d1, d2, a):
    """Crossed belt (reverses direction): sin(gamma) = (d1 + d2)/(2a), both wraps = pi + 2 gamma,
    L = 2 a cos(gamma) + (pi + 2 gamma)(d1 + d2)/2. Only for flat / round belts."""
    g = math.asin((d1 + d2) / (2 * a))
    return {"gamma_deg": math.degrees(g), "beta_deg": 180 + 2 * math.degrees(g),
            "L": 2 * a * math.cos(g) + (math.pi + 2 * g) * (d1 + d2) / 2}

# ---------------------------------------------------------------- chapter 3: narrow V-belt design details
def section_suggest(P_B, n1):
    """Section-chart logic: smallest section whose belt on a typical pulley (1.6 x d_min) needs at most 4 belts."""
    out = []
    for sec, S in VBELT.items():
        d = nearest(1.6 * S["d_min"], D_SERIES)
        r = vb_rated(sec, d, n1)
        z = math.ceil(P_B / r["P_kW"]) if r["P_kW"] > 0.01 else 99
        out.append((sec, d, r["P_kW"], z, r["v"]))
    pick = next((o for o in out if o[3] <= 4 and o[4] <= 42), None)
    return out, pick

# ISO 4183 style groove data (check): b_above datum, depth below datum h_f, groove pitch e, edge f, d limit for 34 deg
GROOVE = {"SPZ": {"b": 2.0, "hf": 9.0, "e": 12.0, "f": 8.0, "d34": 80},
          "SPA": {"b": 2.75, "hf": 11.0, "e": 15.0, "f": 10.0, "d34": 118},
          "SPB": {"b": 3.5, "hf": 14.0, "e": 19.0, "f": 12.5, "d34": 190},
          "SPC": {"b": 4.8, "hf": 19.0, "e": 25.5, "f": 17.0, "d34": 315}}

def groove_dims(sec, d, z=1):
    """Groove angle 34 deg on small pulleys (belt top widens when it bends), 38 deg on large ones;
    top width b1 = b_d + 2 b tan(alpha/2); outside diameter d_a = d + 2 b; pulley width B = (z - 1) e + 2 f."""
    G, S = GROOVE[sec], VBELT[sec]
    alpha = 34.0 if d <= G["d34"] else 38.0
    b1 = S["bd"] + 2 * G["b"] * math.tan(math.radians(alpha / 2))
    return {"alpha": alpha, "b1": b1, "da": d + 2 * G["b"], "depth": G["b"] + G["hf"], "B": (z - 1) * G["e"] + 2 * G["f"], "e": G["e"], "f": G["f"]}

def adjustment(V, x_rel=0.03, y_rel=0.015):
    """Centre-distance adjustment (DIN 7753 style, check): x >= 3 % Ld to tension and re-tension (belt elongation),
    y >= 1.5 % Ld to slip the belts on without force (never lever belts over the flange)."""
    return {"x": x_rel * V["Ld"], "y": y_rel * V["Ld"], "a_min": V["a"] - y_rel * V["Ld"], "a_max": V["a"] + x_rel * V["Ld"]}

def rating_curves(sec="SPZ", d_list=(80, 100, 125, 150, 200), n_list=(720, 960, 1450, 2000, 2930, 3500, 5000)):
    return [(d, [vb_rated(sec, d, n)["P_kW"] for n in n_list]) for d in d_list], n_list

def life_vs_d1(P, sec="SPZ", d_list=(80, 90, 100, 112, 125, 140, 150, 180)):
    rows = []
    for d in d_list:
        V = vbelt(P, sec, float(d))
        rows.append((d, V["d2"], V["z"], V["v"], V["T0"], V["F_shaft"], V["sig_max"], V["L_h_fat"]))
    return rows

def tension_study(P, factors=(0.6, 0.8, 1.0, 1.3, 1.6, 2.0)):
    """Installation tension k x T0: slip margin at design power and fatigue life at the actual load.
    Slip capacity of one belt: F_e,max = 2 (T - F_c)(e - 1)/(e + 1), e = e^(mu' beta)."""
    V = vbelt(P)
    S = VBELT[V["section"]]
    e = math.exp(VB_MODEL["mu_eff"] * math.radians(V["beta1_deg"]))
    Fe_act = P["P_load_kW"] * 1000 / (V["z"] * V["v"])
    rows = []
    for k in factors:
        T = k * V["T0"]
        Fe_max = 2 * (T - V["F_c"]) * (e - 1) / (e + 1)
        sig = (T + Fe_act / 2) / S["A"] + VB_MODEL["E_b"] * S["h"] / V["d1"]
        Lh = VB_MODEL["L_h_ref"] * (VB_MODEL["f_ref"] / V["f_B"]) * (S["sig_ref"] / sig) ** VB_MODEL["m_w"]
        rows.append((k, T, Fe_max / V["F_e"], sig, Lh, 2 * T * V["z"] * math.sin(math.radians(V["beta1_deg"]) / 2)))
    return rows

RUN_IN = 1.3   # new belts: install with ~1.3 x T0 because they lose tension in the first hours of running (check maker)

def run_in(V):
    T = RUN_IN * V["T0"]
    Fs = 2 * T * V["z"] * math.sin(math.radians(V["beta1_deg"]) / 2)
    f = 1 / (2 * V["span"] / 1000) * math.sqrt(T / VBELT[V["section"]]["m"])
    return {"T0_new": T, "F_shaft_new": Fs, "f_new": f, "F_test_new": 4 * T * V["test_deflection"] / V["span"]}

def frequency_table(V, Ts=None):
    m = VBELT[V["section"]]["m"]
    Ts = Ts or [0.5 * V["T0"], 0.8 * V["T0"], V["T0"], RUN_IN * V["T0"], 1.6 * V["T0"]]
    return [(T, 1 / (2 * V["span"] / 1000) * math.sqrt(T / m)) for T in Ts]

def matched_set(P, P_kW=11.0, dL_rel=(0.0002, 0.0005, 0.002), sec="SPA", d1=125.0):
    """Belts of one set differ in length by +-dL. All are stretched to the same installed length: the shorter belt
    carries more tension: T_i = T0 + EA (L_mean - L_i)/L. With z belts at +-dL the spread is +-EA dL/L."""
    V = vbelt(dict(P, P_kW=P_kW), sec, d1)                # a larger drive that needs several belts
    EA = EA_VB[sec]
    out = []
    for r in dL_rel:
        dT = EA * r
        out.append((r * 100, r * V["Ld"], V["T0"] + dT, max(0.0, V["T0"] - dT), dT / V["T0"]))
    return V, out

ALIGNMENT = [   # drive, max angular misalignment, max offset (typical, check maker)
    ("narrow V-belt", "0.5 deg", "about 1 mm per 100 mm centre distance at most"),
    ("ribbed belt", "0.25 deg", "0.5 mm per 100 mm"),
    ("synchronous belt", "0.25 deg", "0.3 mm per 100 mm; the belt runs against a flange otherwise"),
]
RIBBED = {"PJ": {"pitch": 2.34, "d_min": 20}, "PK": {"pitch": 3.56, "d_min": 45}, "PL": {"pitch": 4.70, "d_min": 75},
          "PM": {"pitch": 9.40, "d_min": 180}}   # ISO 9982 style rib pitch mm and smallest pulley mm (check)

# ---------------------------------------------------------------- chapter 4: synchronous belts
SYNC_PROFILES = [   # profile, tooth form, pitches mm, cord, use
    ("MXL / XL / L / H (trapezoidal, ISO 5296)", "trapezoid", "2.032 / 5.08 / 9.525 / 12.7", "glass", "old inch standard, light drives"),
    ("T5 / T10 / T20 (DIN 7721)", "trapezoid, PU", "5 / 10 / 20", "steel", "linear axes, conveyors"),
    ("AT5 / AT10 / AT20", "trapezoid, wide tooth, PU", "5 / 10 / 20", "steel", "linear axes: stiffer, more teeth load"),
    ("HTD 3M / 5M / 8M / 14M / 20M (ISO 13050)", "round (arc)", "3 / 5 / 8 / 14 / 20", "glass / aramid", "power drives, no tooth-root stress peaks"),
    ("GT / STD (S5M, S8M) modified curvilinear", "modified arc", "2 / 3 / 5 / 8 / 14", "glass / carbon", "less backlash, quieter, higher rating"),
]
EA_SYNC = {"5M": 1500.0, "8M": 3000.0, "14M": 6000.0}   # tension member stiffness per mm belt width, N per mm width (unit strain; check)

def sync_tooth_check(P, Y=None):
    """Tooth load per mm width per counted tooth vs permissible; jump-over margin = slack-span tension / effective pull."""
    Y = Y or sync(P)
    S = SYNC[Y["profile"]]
    b = Y["b"] or S["widths"][-1]
    Fe_act = P["P_load_kW"] * 1000 / Y["v"]
    q = Y["F_e"] / (b * Y["z_e"])
    T2 = Y["T0"] - Y["F_e"] / 2
    return {"b": b, "q": q, "f_t": S["f_t"], "util": q / S["f_t"], "q_act": Fe_act / (b * Y["z_e"]), "T2": T2,
            "jump_margin": T2 / Y["F_e"], "f_mesh": Y["z1"] * P["n1"] / 60}

def sync_width_table(P, cases=(("5M", 40, 81), ("8M", 24, 49), ("8M", 32, 65), ("14M", 28, 57))):
    rows = []
    for prof, z1, z2 in cases:
        Y = sync(P, prof, z1, z2)
        rows.append((prof, z1, z2, Y["d1"], Y["v"], Y["z_m"], Y["P_per_mm"], Y["b"], Y["F_shaft"], all(Y["ok"].values()),
                     [k for k, v in Y["ok"].items() if not v]))
    return rows

def positioning_axis(prof="5M", b=15.0, L_axis=1000.0, x=500.0, m_carriage=5.0, acc=5.0, z=24, backlash=0.15):
    """Linear axis: carriage on a belt between a drive and an idler pulley. The two belt pieces act as springs in
    parallel: k = EA b (1/x + 1/(L - x)). Static error under the acceleration force F = m a: dx = F / k.
    Lowest axis frequency at mid-stroke: f = 1/(2 pi) sqrt(k / m). Backlash of the tooth mesh adds (profile dependent, check)."""
    EA = EA_SYNC[prof] * b
    rows = []
    for xx in (0.1 * L_axis, 0.25 * L_axis, x, 0.75 * L_axis, 0.9 * L_axis):
        k = EA * (1 / xx + 1 / (L_axis - xx)) * 1000           # N/m (lengths in mm)
        F = m_carriage * acc
        rows.append((xx, k / 1000, F / k * 1000, math.sqrt(k / m_carriage) / (2 * math.pi)))
    d = z * SYNC[prof]["p"] / math.pi
    return {"rows": rows, "F": m_carriage * acc, "d": d, "mm_per_rev": z * SYNC[prof]["p"], "backlash": backlash}

# ---------------------------------------------------------------- demo
def demo_ch24():
    P = dict(DEFAULT)
    V = vbelt(P)
    print("## 2.1 Belt types")
    for t in BELT_TYPES:
        print("  %-42s %-24s v %-10s eta %-10s %s" % t)
    print("  cords:")
    for c in CORD_MATERIALS:
        print("    %-12s modulus %-24s elongation %-22s %s" % c)
    print("  compounds:")
    for c in COMPOUNDS:
        print("    %-18s %-13s %s" % c)
    print("\n## 2.2 Capstan (Euler-Eytelwein): F1/F2 = e^(mu beta)")
    for mu, row in capstan_table():
        print("  mu %.3f: " % mu + "  ".join("%3d deg %6.2f" % (b, r) for b, r in row))
    print("  numeric integration mu 0.512, 180 deg: %.5f vs e^(mu pi) %.5f" % (capstan_numeric(0.512, math.pi), math.exp(0.512 * math.pi)))
    print("\n## 2.3 Wedge effect mu' = mu / sin(alpha/2)")
    for mu in (0.2, 0.3):
        print("  mu %.2f: " % mu + "  ".join("groove %d deg -> mu' %.3f" % (a, wedge_mu(mu, a)) for a in (34, 36, 38)))
    print("  rating value mu' %.3f -> equivalent flat-belt mu at 38 deg: %.3f" % (VB_MODEL["mu_eff"], VB_MODEL["mu_eff"] * math.sin(math.radians(19))))
    print("\n## 2.4 Creep")
    c = creep_estimate(V)
    print("  EA %.0f N, F1 - F2 %.0f N -> elastic creep %.3f %% = %.2f rpm at the crank; slip used in design %.1f %%" % (
        c["EA"], V["F1"] - V["F2"], 100 * c["creep"], c["rpm_loss"], 100 * P["vb_slip"]))
    print("\n## 2.5 Centrifugal force and optimum speed (SPZ d1 150)")
    pc = power_speed_curve()
    for n, r in pc["rows"][::3]:
        print("  n %5d rpm  v %5.1f m/s  F1_max %5.0f N  F_c %5.0f N  P_N %5.2f kW" % (n, r["v"], r["F1_max"], r["F_c"], r["P_kW"]))
    print("  maximum: %.2f kW at %d rpm (v %.1f m/s); formula v_opt = sqrt(F1_max/(3 m)) = %.1f m/s" % (pc["P_best"], pc["n_best"], pc["v_best"], pc["v_opt_formula"]))
    print("\n## 2.6 Belt stresses (default drive, design power)")
    s = belt_stresses(V)
    print("  tight span %.2f MPa (centrifugal part %.2f), slack span %.2f MPa, bending small pulley %.2f / large %.2f MPa" % (
        s["sig_t1"], s["sig_c"], s["sig_t2"], s["sig_b1"], s["sig_b2"]))
    print("  max %.2f MPa vs permissible %.2f MPa at f_B %.1f Hz (ratio %.2f)" % (s["sig_max"], s["sig_perm"], V["f_B"], s["sig_max"] / s["sig_perm"]))
    print("\n## 2.7 Geometry open vs crossed (d1 150, d2 300, a 440.2)")
    g = open_belt(150, 300, V["a"])
    cr = crossed_belt(150, 300, V["a"])
    print("  open: beta1 %.1f deg, beta2 %.1f deg, L exact %.1f mm, L approx %.1f mm, span %.1f mm" % (
        math.degrees(g["beta1"]), math.degrees(g["beta2"]), g["L_exact"], g["L_approx"], g["span"]))
    print("  crossed: both wraps %.1f deg, L %.1f mm" % (cr["beta_deg"], cr["L"]))

    print("\n## 3.1 Service factor c2 (hours/day <= 10 / <= 16 / > 16)")
    for k, t in LOAD_CLASS.items():
        print("  %-40s %.1f / %.1f / %.1f" % ((k,) + t))
    print("  default: %s, %.0f h -> c2 %.2f, P_B %.2f kW" % (P["load_class"], P["hours_per_day"], V["c2"], V["P_B"]))
    print("\n## 3.2 Section suggestion (pulley 1.6 x d_min, at most 4 belts)")
    rows, pick = section_suggest(V["P_B"], P["n1"])
    for sec, d, PN, z, v in rows:
        print("  %s d %3d: P_N %5.2f kW, v %5.1f m/s -> z %d" % (sec, d, PN, v, z))
    print("  suggested: %s" % pick[0])
    print("\n## 3.3 Groove dimensions (ISO 4183 style)")
    for sec, d in (("SPZ", 63), ("SPZ", 150), ("SPZ", 300), ("SPA", 125), ("SPB", 200)):
        gd = groove_dims(sec, d, 2)
        print("  %s d %3d: alpha %.0f deg, top width b1 %.2f, d_a %.1f, depth %.2f, e %.1f, f %.1f, width for 2 grooves %.1f mm" % (
            sec, d, gd["alpha"], gd["b1"], gd["da"], gd["depth"], gd["e"], gd["f"], gd["B"]))
    print("\n## 3.4 Pulleys, length, centre distance, adjustment")
    print("  d2 = n1 d1 (1 - s) / n2 = %.0f x %.0f x %.2f / %.0f = %.1f -> %d mm; L_th %.1f -> Ld %d; a %.1f mm" % (
        P["n1"], V["d1"], 1 - P["vb_slip"], P["n2"], P["n1"] * V["d1"] * (1 - P["vb_slip"]) / P["n2"], V["d2"], V["L_th"], V["Ld"], V["a"]))
    ad = adjustment(V)
    print("  adjustment: tensioning x %.0f mm, installing y %.0f mm -> slide range a %.0f ... %.0f mm" % (ad["x"], ad["y"], ad["a_min"], ad["a_max"]))
    print("\n## 3.5 Rating curves P_N [kW] (SPZ, 180 deg, L_ref 1600)")
    cv, ns = rating_curves()
    print("  d1 \\ n " + "".join("%7d" % n for n in ns))
    for d, ps in cv:
        print("  %5d  " % d + "".join("%7.2f" % p for p in ps))
    print("  factors: c1 %.3f (wrap %.1f deg), c3 %.3f (Ld %d); other lengths: " % (V["c1"], V["beta1_deg"], V["c3"], V["Ld"])
          + ", ".join("%d -> %.3f" % (L, vb_c3("SPZ", L)) for L in (800, 1250, 2500, 3550)))
    print("\n## 3.6 Number of belts, tension, shaft load")
    print("  z = P_B/(P_N c1 c3) = %.2f/(%.2f x %.3f x %.3f) = %.2f -> %d" % (V["P_B"], V["P_N"], V["c1"], V["c3"], V["P_B"] / (V["P_N"] * V["c1"] * V["c3"]), V["z"]))
    ri = run_in(V)
    print("  T0 %.0f N (run-in x %.1f: %.0f N), shaft load running %.0f N, standstill %.0f N, new belt standstill %.0f N" % (
        V["T0"], RUN_IN, ri["T0_new"], V["F_shaft"], V["F_shaft_static"], ri["F_shaft_new"]))
    print("\n## 3.7 Life vs small pulley (SPZ, same task)")
    for d, d2, z, v, T0, Fs, sig, Lh in life_vs_d1(P):
        print("  d1 %3d / d2 %3d: z %d, v %5.1f m/s, T0 %4.0f N, shaft %4.0f N, sig_max %5.2f MPa, fatigue life %10.0f h" % (d, d2, z, v, T0, Fs, sig, Lh))
    print("\n## 3.8 Installation tension study (k x T0)")
    for k, T, mar, sig, Lh, Fs in tension_study(P):
        print("  k %.1f: T %4.0f N, slip margin %.2f, sig_max %5.2f MPa, fatigue life %9.0f h, shaft load %4.0f N%s" % (
            k, T, mar, sig, Lh, Fs, "  SLIPS at design power" if mar < 1 else ""))
    print("\n## 3.9 Tension check: span frequency vs tension (span %.0f mm)" % V["span"])
    for T, f in frequency_table(V):
        print("  T %5.0f N -> f %5.1f Hz" % (T, f))
    print("  new belt: install to %.0f Hz (or %.1f N for %.1f mm deflection); after run-in check %.0f Hz" % (
        ri["f_new"], ri["F_test_new"], V["test_deflection"], V["f_span"]))
    print("\n## 3.10 Matched sets (11 kW drive, SPA d1 125, length tolerance)")
    Vm, ms = matched_set(P)
    print("  drive: %d x SPA, Ld %d, T0 %.0f N per belt" % (Vm["z"], Vm["Ld"], Vm["T0"]))
    for pct, dL, Tmax, Tmin, rel in ms:
        print("  +-%.2f %% (+-%.1f mm): shortest belt %4.0f N, longest %4.0f N (+-%3.0f %% of T0)" % (pct, dL, Tmax, Tmin, 100 * rel))
    print("\n## 3.11 Alignment and ribbed belts")
    for a in ALIGNMENT:
        print("  %-18s angle %-9s offset %s" % a)
    for k, r in RIBBED.items():
        print("  ribbed %s: rib pitch %.2f mm, smallest pulley %d mm" % (k, r["pitch"], r["d_min"]))

    print("\n## 4.1 Synchronous belt profiles")
    for t in SYNC_PROFILES:
        print("  %-42s %-26s p %-28s %-15s %s" % t)
    print("\n## 4.2 Tooth check (default 8M)")
    Y = sync(P)
    tc = sync_tooth_check(P, Y)
    print("  width %d mm, z_m %.1f -> counted %d; tooth load %.2f N/mm per tooth vs %.1f permissible (util %.2f; actual load %.2f)" % (
        tc["b"], Y["z_m"], Y["z_e"], tc["q"], tc["f_t"], tc["util"], tc["q_act"]))
    print("  T0 %.0f N, slack span at design power %.0f N -> jump-over margin T2/F_e %.2f; mesh frequency %.0f Hz" % (
        Y["T0"], tc["T2"], tc["jump_margin"], tc["f_mesh"]))
    print("\n## 4.3 Width table (same task)")
    for prof, z1, z2, d1, v, zm, ppm, b, Fs, ok, fails in sync_width_table(P):
        print("  %-3s z %d/%d: d1 %6.2f, v %5.2f m/s, z_m %4.1f, %.3f kW/mm -> width %s, shaft %4.0f N %s" % (
            prof, z1, z2, d1, v, zm, ppm, b, Fs, "OK" if ok else "fails: " + ",".join(fails)))
    print("\n## 4.4 Positioning axis (5M, 15 mm, 1000 mm, 5 kg at 5 m/s2)")
    pa = positioning_axis()
    print("  pulley z 24: d %.2f mm, %.0f mm per revolution, force %.0f N, mesh backlash about %.2f mm (check)" % (pa["d"], pa["mm_per_rev"], pa["F"], pa["backlash"]))
    for x, k, dx, f in pa["rows"]:
        print("  carriage at %4.0f mm: k %6.1f N/mm, error %.3f mm, axis frequency %5.1f Hz" % (x, k, dx, f))

# ================================================================ added with guide chapters (ch56)
# ---------------------------------------------------------------- chapter 5: roller chains
CH_B_SERIES = {   # ISO 606 B series (European, DIN 8187 origin): p mm, F_B kN, q kg/m (typical, check)
    "08B": {"p": 12.70, "F_B": 18.0, "q": 0.70}, "10B": {"p": 15.875, "F_B": 22.4, "q": 0.95},
    "12B": {"p": 19.05, "F_B": 29.0, "q": 1.25}, "16B": {"p": 25.40, "F_B": 60.0, "q": 2.70},
    "20B": {"p": 31.75, "F_B": 95.0, "q": 3.60}, "24B": {"p": 38.10, "F_B": 160.0, "q": 6.70},
}
CH_BEARING_AREA = {   # joint bearing area f = pin diameter x bush length, mm2 (simplex, typical, check)
    "06C (ANSI 35)": 28.0, "08A (ANSI 40)": 44.0, "10A (ANSI 50)": 70.0, "12A (ANSI 60)": 106.0,
    "16A (ANSI 80)": 179.0, "20A (ANSI 100)": 262.0, "24A (ANSI 120)": 394.0,
}
CH_PIN_D = {"06C (ANSI 35)": 3.59, "08A (ANSI 40)": 3.96, "10A (ANSI 50)": 5.08, "12A (ANSI 60)": 5.94,
            "16A (ANSI 80)": 7.92, "20A (ANSI 100)": 9.53, "24A (ANSI 120)": 11.10}   # pin diameter mm (ISO 606)
CH_LUB_FACTOR = {"good (bath / pressure)": 1.0, "drip": 2.0, "manual, irregular": 5.0, "dry": 20.0}   # wear multiplier (check)
CH_K_WEAR = 7.4e-11   # wear coefficient k/H mm2/N of the pin-bush joint, calibrated so that the low-speed case
                      # (08A, z 19/57, 1450 rpm, good lubrication) reaches ~15 000 h = the ACA rating life (check)
CH_FATIGUE_RATIO = 0.25   # link-plate fatigue force / breaking force (typical, check)

def ch_rating_curve(name, z1, speeds=(100, 200, 500, 1000, 1500, 2000, 3000, 4000)):
    """Link-plate (H1) and roller-bushing (H2) limits in kW over the small-sprocket speed."""
    return [(n, chain_rating(name, z1, n)["H1_kW"], chain_rating(name, z1, n)["H2_kW"]) for n in speeds]

def ch_crossover(name, z1):
    """Speed where H1 = H2: n^2.4 = 1000 Kr z1^0.42 p^0.8 / (0.004 p^(3 - 0.07 p)), p in inch."""
    C = CHAINS[name]
    p = C["p"] / 25.4
    return (1000 * C["Kr"] * z1 ** 0.42 * p ** 0.8 / (0.004 * p ** (3 - 0.07 * p))) ** (1 / 2.4)

def ch_polygon(z, p, n):
    """Chordal action: v_max = w R, v_min = w R cos(pi/z), R = p / (2 sin(pi/z)); rise of the chain line;
    roller impact velocity v_imp ~ v sin(2 pi / z) (-> w p for many teeth, check)."""
    R = p / (2 * math.sin(math.pi / z))
    w = 2 * math.pi * n / 60
    vmax = w * R / 1000
    vmin = vmax * math.cos(math.pi / z)
    v = z * p * n / 60000
    return {"R": R, "v_max": vmax, "v_min": vmin, "var_pct": 100 * (1 - math.cos(math.pi / z)),
            "rise_mm": R * (1 - math.cos(math.pi / z)), "v_imp": v * math.sin(2 * math.pi / z), "f_mesh_Hz": z * n / 60}

def ch_impact_energy(name, z, n):
    """Kinetic energy of one link hitting the sprocket: E = 1/2 (q p) v_imp^2 (J)."""
    C = CHAINS[name]
    v_imp = ch_polygon(z, C["p"], n)["v_imp"]
    return 0.5 * C["q"] * C["p"] / 1000 * v_imp ** 2

def ch_hunting(z, X):
    """A tooth meets the same link again after lcm(z, X)/z chain passes; gcd = 1 is best (odd z with even X)."""
    g = math.gcd(z, X)
    return {"gcd": g, "passes_until_repeat": X // g}

def ch_sag(a_mm, q, F_N=None, sag_pct=None):
    """Slack span as a shallow catenary (parabola): f = q g a^2 / (8 F). Give F -> sag, or sag in % of a -> F."""
    a = a_mm / 1000
    if F_N is not None:
        return 1000 * q * 9.81 * a * a / (8 * F_N)
    f = sag_pct / 100 * a
    return q * 9.81 * a * a / (8 * f)

def ch_wear_life(P, lub="good (bath / pressure)", limit=0.03, name=None, z1=None, z2=None):
    """Archard wear of the pin-bush joint: articulation pressure p_G = F_t K_s / f; each pass articulates every joint
    on both sprockets (angles 360/z1 and 360/z2, entering and leaving); sliding way per articulation s = d_pin/2 * angle.
    Pitch elongation = wear depth h = k p_G s_total; life until the elongation limit (3 % of pitch)."""
    K = chain(P, name=name, z1=z1, z2=z2)
    nm = K["chain"]
    f, d = CH_BEARING_AREA[nm] * K["strands"], CH_PIN_D[nm]
    pG = K["F_t"] * K["K_s"] / f
    s_pass = 2 * d / 2 * (2 * math.pi / K["z1"] + 2 * math.pi / K["z2"])    # mm sliding per joint per pass
    passes_h = K["v"] * 3600 / (K["X"] * K["p"] / 1000)
    h_per_h = CH_K_WEAR * CH_LUB_FACTOR[lub] * pG * s_pass * passes_h
    return {"p_G": pG, "s_pass": s_pass, "passes_h": passes_h, "L_h": limit * K["p"] / h_per_h, "lub": lub}

def ch_safety(P, name=None, strands=None):
    K = chain(P, name=name, strands=strands)
    C = CHAINS[K["chain"]]
    Ffat = CH_FATIGUE_RATIO * C["F_B"] * 1000 * STRAND_FACTOR[K["strands"]]
    return {"S_static": K["S_static"], "S_fatigue": Ffat / (K["F_t"] * K["K_s"] + K["F_c"]), "F_fat": Ffat}

def ch_select(P, z1=None):
    """Smallest chain (and fewest strands) that passes all checks of chain()."""
    for k in (1, 2, 3):
        for nm in CHAINS:
            K = chain(P, name=nm, strands=k, z1=z1)
            if all(K["ok"].values()):
                return K
    return None

def ch_low_speed_case():
    """Same 3 kW, but a 4-pole motor 1450 rpm driving a conveyor at 480 rpm - where chains belong."""
    return dict(DEFAULT, n1=1450.0, n2=480.0, ch_z1=19, ch_z2=57, load_class="medium (screw compressors, conveyors)",
                a_target=500.0, vb_d1=125.0, sy_z1=30, sy_z2=90)

def ch_shaft_load(F_t, layout="horizontal"):
    """Shaft load of a chain drive: F_W = k F_t, k 1.15 horizontal, 1.05 vertical (typical, check)."""
    return (1.15 if layout == "horizontal" else 1.05) * F_t

# ---------------------------------------------------------------- chapter 6: couplings
CP_TYPES = [   # type, torsional behaviour, misalignment, damping, typical use
    ("rigid sleeve / flange", "rigid", "none (shafts must be aligned exactly)", "none", "line shafts, vertical pumps"),
    ("shrink disc / clamp", "rigid", "none", "none", "hollow-shaft gearboxes, hub-shaft connection"),
    ("disc pack (steel lamellae)", "torsionally stiff", "angular + axial, radial with spacer", "none", "pumps, compressors, servo"),
    ("gear coupling (crowned teeth)", "torsionally stiff", "angular, radial (double)", "none, needs grease", "heavy drives, rolling mills"),
    ("metal bellows", "torsionally stiff, no backlash", "all three, small", "none", "encoders, ball screws, servo"),
    ("Oldham", "stiff, small backlash", "radial (large)", "low", "small drives, pumps"),
    ("elastic jaw (spider)", "elastic, progressive", "all three, small", "medium (psi ~0.8)", "motors to pumps, fans, compressors"),
    ("tyre coupling", "very elastic", "all three, large", "high", "shock loads, poor alignment"),
    ("pin-and-bush (N-EUPEX type)", "elastic", "all three, medium", "medium", "general industry, fail-safe"),
    ("highly flexible (rubber block)", "very soft", "large", "high", "diesel engines, generator sets"),
]
CP_RADIAL_STIFF = {"J14": 180.0, "J19": 600.0, "J24": 1100.0, "J28": 1400.0, "J38": 1900.0, "J42": 2100.0, "J48": 2600.0}   # N/mm (92 Sh A, check)
CP_P_KW = {"J14": 1.2, "J19": 2.0, "J24": 4.8, "J28": 6.4, "J38": 8.0, "J42": 9.6, "J48": 11.2}   # permissible damping power W at 30 C (check)

def cp_dft_orders(n_orders=6):
    """Torque orders of the M2 compressor (crank.py) by discrete Fourier transform of M_drive(theta)."""
    import crank
    R = crank.compute_all()
    th = [r["theta"] for r in R["rows"]]
    M = [r["M_drive"] for r in R["rows"]]
    N = len(M)
    out = []
    for k in range(1, n_orders + 1):
        a = sum(m * math.cos(k * t) for m, t in zip(M, th)) * 2 / N
        b = sum(m * math.sin(k * t) for m, t in zip(M, th)) * 2 / N
        out.append((k, math.hypot(a, b)))
    return {"mean": sum(M) / N, "orders": out}

def cp_mag_curve(psi, etas=None):
    etas = etas or [i / 20 for i in range(0, 61)]
    return [(e, magnification(e, psi)) for e in etas]

def cp_din740(P, size=None):
    """Full listing of the DIN 740-2 checks for one size (default: selected one)."""
    size = size or coupling(P)["best"]["size"]
    return coupling_check(P, size)

def cp_restoring(size, dKr_mm, dKw_deg=0.0, spider="92 Sh A"):
    """Radial restoring force F_r = C_r dKr; angular restoring moment M_w ~ C_w dKw (C_w ~ 0.35 C_dyn per rad, check)."""
    Cr = CP_RADIAL_STIFF[size] * SPIDER[spider]["C"]
    Cw = 0.35 * JAW[size]["C_dyn"] * SPIDER[spider]["C"]
    return {"F_r": Cr * dKr_mm, "M_w": Cw * math.radians(dKw_deg), "dKr_perm": JAW[size]["dKr"]}

def cp_bearing_from_restoring(F_r, a_brg=120.0, b_overhang=60.0):
    """Extra load on the near / far motor bearing from F_r at the coupling (overhang b from the near bearing)."""
    return {"near": F_r * (a_brg + b_overhang) / a_brg, "far": F_r * b_overhang / a_brg}

def cp_damping_heat(P, size=None):
    """Dissipated power P_W = sum psi T_k^2 / (2 C) f_k (energy per cycle psi W_el, W_el = T^2/(2C))."""
    r = cp_din740(P, size)
    P_W = sum(r["psi"] * o["T_coupling"] ** 2 / (2 * r["C_dyn"]) * o["f"] for o in r["orders"])
    perm = CP_P_KW[r["size"]] * (1.0 if P["cp_T_amb"] <= 30 else 0.8 if P["cp_T_amb"] <= 40 else 0.6)
    return {"P_W": P_W, "P_KW_perm": perm, "size": r["size"]}

def cp_stiffness_study(P, Cs=(150.0, 300.0, 600.0, 1200.0, 2500.0, 5000.0, 10300.0, 24720.0)):
    """Soft vs stiff: J28 hubs/torques, torsional stiffness varied. Highest order torque in operation and the
    resonance passage at start (supercritical orders: T M_L 2 pi / psi)."""
    rows = []
    for C in Cs:
        JAW["_tmp"] = dict(JAW["J28"], C_dyn=C)          # temporary size entry, removed again
        try:
            r = coupling_check(P, "_tmp")
        finally:
            del JAW["_tmp"]
        Tmax = max(o["T_coupling"] for o in r["orders"])
        rows.append({"C": C, "f_e": r["f_e"], "T_op_max": Tmax, "T_res": r["T_res"],
                     "status": "subcritical" if all(o["eta"] < 1 for o in r["orders"]) else "supercritical" if all(o["eta"] > 1 for o in r["orders"]) else "mixed",
                     "ok": all(r["ok"].values()), "fails": [k for k, v in r["ok"].items() if not v]})
    return rows

def cp_holzer(J, k, f_lo=1.0, f_hi=2000.0, steps=4000):
    """Holzer table for a free-free chain J[0]-k[0]-J[1]-k[1]-...: residual torque at the free end; roots = natural
    frequencies (Hz). Returns the frequencies of the elastic modes."""
    def resid(f):
        w2 = (2 * math.pi * f) ** 2
        th, T = 1.0, 0.0
        for i, Ji in enumerate(J):
            T += Ji * w2 * th
            if i < len(k):
                th -= T / k[i]
        return T
    roots, f0, r0 = [], f_lo, resid(f_lo)
    for i in range(1, steps + 1):
        f1 = f_lo + (f_hi - f_lo) * i / steps
        r1 = resid(f1)
        if r0 * r1 < 0:
            a, b = f0, f1
            for _ in range(60):
                m = 0.5 * (a + b)
                if resid(a) * resid(m) <= 0:
                    b = m
                else:
                    a = m
            roots.append(0.5 * (a + b))
        f0, r0 = f1, r1
    return roots

def cp_drive_train(P, size="J28", d_shaft=30.0, L_shaft=150.0, G=81000.0, J_crank=0.003):
    """Motor - coupling - flywheel - crank stub - crank as 3 masses; stub k = G pi d^4 / (32 L)."""
    hub = JAW[size]["J_hub"]
    k_sh = G * math.pi * d_shaft ** 4 / (32 * L_shaft) / 1000          # N m/rad (G MPa, mm -> N mm/rad / 1000)
    J = [P["cp_J_motor"] + hub, P["cp_J_load"] - J_crank + hub, J_crank]
    k = [JAW[size]["C_dyn"] * SPIDER[P["cp_spider"]]["C"], k_sh]
    return {"J": J, "k": k, "f": cp_holzer(J, k), "f_2mass": coupling_check(P, size)["f_e"]}

def cp_cardan(beta_deg, phi_deg):
    """Single universal joint: w2/w1 = cos b / (1 - sin^2 b cos^2 phi); non-uniformity U = tan b sin b."""
    b, ph = math.radians(beta_deg), math.radians(phi_deg)
    return math.cos(b) / (1 - math.sin(b) ** 2 * math.cos(ph) ** 2)

def cp_cardan_double(beta1, beta2, phi_deg, in_phase=True):
    """Two joints (Z or W arrangement). Joint 1: tan phi2 = tan phi1 / cos b1. Joint 2 with forks in phase works
    backwards: tan phi3 = tan phi2 cos b2; forks 90 deg off: tan phi3 = tan phi2 / cos b2. So tan phi3 = c tan phi1 and
    w3/w1 = c / (cos^2 phi1 + c^2 sin^2 phi1): exactly 1 for b1 = b2 with forks in phase."""
    b1, b2, ph = math.radians(beta1), math.radians(beta2), math.radians(phi_deg)
    c = math.cos(b2) / math.cos(b1) if in_phase else 1 / (math.cos(b1) * math.cos(b2))
    return c / (math.cos(ph) ** 2 + c * c * math.sin(ph) ** 2)

def cp_torque_limiter(P, margin_start=1.1, factor_max=0.8):
    """Slip torque: above the start torque at the coupling (x margin), below 80 % of what the weakest part carries."""
    b = coupling(P)["best"]
    lo = b["T_S"] / (P["cp_S_A"] * b["S_t"]) * margin_start          # start torque without safety factors x margin
    hi = factor_max * b["T_Kmax"]
    return {"T_slip_min": lo, "T_slip_max": hi, "T_set": 0.5 * (lo + hi)}

# ---------------------------------------------------------------- demo
def demo_ch56():
    P = dict(DEFAULT)
    print("## 5.1 ISO 606 roller chains: A series (ANSI) in drive.py and B series (European)")
    for nm, C in CHAINS.items():
        print("  %-15s p %6.3f mm  F_B %6.1f kN  q %.2f kg/m  joint area %5.0f mm2  F_B/q %5.1f kN m/kg" % (
            nm, C["p"], C["F_B"], C["q"], CH_BEARING_AREA[nm], C["F_B"] / C["q"]))
    for nm, C in CH_B_SERIES.items():
        print("  %-15s p %6.3f mm  F_B %6.1f kN  q %.2f kg/m" % (nm, C["p"], C["F_B"], C["q"]))

    print("\n## 5.2 Polygon (chordal) effect, 08A at 2930 rpm vs number of teeth")
    for z in (9, 11, 13, 15, 17, 19, 21, 25, 31, 40):
        g = ch_polygon(z, 12.7, 2930)
        print("  z %2d: R %6.2f mm, speed variation %5.2f %%, chain-line rise %.3f mm, v_imp %.2f m/s, E_imp %.3f mJ, mesh %4.0f Hz" % (
            z, g["R"], g["var_pct"], g["rise_mm"], g["v_imp"], 1000 * ch_impact_energy("08A (ANSI 40)", z, 2930), g["f_mesh_Hz"]))

    print("\n## 5.3 Hunting tooth: z1 vs links X")
    for z, X in ((19, 92), (20, 92), (18, 90), (19, 91)):
        h = ch_hunting(z, X)
        print("  z %d, X %d: gcd %d -> a tooth meets the same link every %d passes" % (z, X, h["gcd"], h["passes_until_repeat"]))

    print("\n## 5.4 Rating curves 08A, z1 19 (one strand, good lubrication) - H1 link plate, H2 roller-bushing [kW]")
    for n, h1, h2 in ch_rating_curve("08A (ANSI 40)", 19):
        print("  n1 %4d rpm: H1 %6.2f  H2 %7.2f  -> %6.2f kW (%s)" % (n, h1, h2, min(h1, h2), "link plate" if h1 < h2 else "roller-bushing"))
    print("  crossover speeds (z1 19): " + ", ".join("%s %.0f rpm" % (nm.split()[0], ch_crossover(nm, 19)) for nm in CHAINS))
    print("  08A crossover vs z1: " + ", ".join("z %d %.0f rpm" % (z, ch_crossover("08A (ANSI 40)", z)) for z in (13, 17, 19, 25)))

    print("\n## 5.5 Default task (2930 rpm): strands and sizes")
    for nm in ("06C (ANSI 35)", "08A (ANSI 40)", "10A (ANSI 50)"):
        for k in (1, 2, 3):
            K = chain(P, name=nm, strands=k)
            print("  %-15s x%d: allowed %5.2f kW vs %4.2f, v %5.2f m/s, S_static %5.1f, %s -> %s" % (
                nm, k, K["P_allow"], K["P_req"], K["v"], K["S_static"], K["lub"], "OK" if all(K["ok"].values()) else "fails: " + ",".join(x for x, v in K["ok"].items() if not v)))
    s = ch_select(P)
    print("  smallest passing chain at 2930 rpm: %s x%d (v %.2f m/s, %s)" % (s["chain"], s["strands"], s["v"], s["lub"]) if s else "  none")
    w = ch_wear_life(P, name=s["chain"]) if s else None
    if w:
        print("  wear: p_G %.1f MPa, %.0f passes/h, life to 3 %% elongation %.0f h (good lubrication)" % (w["p_G"], w["passes_h"], w["L_h"]))

    print("\n## 5.8 Low-speed case: 3 kW, 1450 -> 480 rpm, conveyor (where chains belong)")
    Q = ch_low_speed_case()
    s2 = ch_select(Q)
    print("  smallest passing chain: %s x%d, z %d/%d, v %.2f m/s, %d links, a %.1f mm, rating %.2f (%s) vs %.2f kW, S_static %.1f, %s" % (
        s2["chain"], s2["strands"], s2["z1"], s2["z2"], s2["v"], s2["X"], s2["a"], s2["P_allow"], s2["rating"]["limit"], s2["P_req"], s2["S_static"], s2["lub"]))
    for lub in CH_LUB_FACTOR:
        print("  wear life with lubrication '%s': %.0f h" % (lub, ch_wear_life(Q, lub=lub, name=s2["chain"])["L_h"]))
    sf = ch_safety(Q, name=s2["chain"], strands=s2["strands"])
    print("  static safety %.1f, link-plate fatigue safety %.2f (F_fat %.0f N)" % (sf["S_static"], sf["S_fatigue"], sf["F_fat"]))
    V2, Y2 = vbelt(Q), sync(Q)
    print("  compare at 1450 -> 480: chain shaft load %.0f N; V-belt %d x %s d1 %.0f/d2 %.0f shaft load %.0f N (n2 %.0f); HTD %s %s mm shaft load %.0f N (n2 %.0f)" % (
        ch_shaft_load(s2["F_t"]), V2["z"], V2["section"], V2["d1"], V2["d2"], V2["F_shaft"], V2["n2"], Y2["profile"], Y2["b"], Y2["F_shaft"], Y2["n2"]))
    for lay in ("horizontal", "vertical"):
        print("  chain shaft load (%s): %.0f N" % (lay, ch_shaft_load(s2["F_t"], lay)))

    print("\n## 5.9 Sag and tension of the slack span (low-speed case)")
    q = CHAINS[s2["chain"]]["q"]
    for pct in (1.0, 2.0, 3.0):
        print("  sag %.0f %% of a (%.1f mm): span tension from weight %.1f N" % (pct, pct / 100 * s2["a"], ch_sag(s2["a"], q, sag_pct=pct)))
    print("  chain pull %.0f N -> tight-span sag %.3f mm" % (s2["F_t"], ch_sag(s2["a"], q, F_N=s2["F_t"])))

    print("\n## 6.1 Coupling types")
    for t in CP_TYPES:
        print("  %-32s %-28s %-36s %-20s %s" % t)

    print("\n## 6.2 Misalignment: restoring forces of the jaw coupling (92 Sh A)")
    for size in ("J24", "J28", "J38"):
        for dk in (0.05, 0.1, 0.2):
            r = cp_restoring(size, dk, 0.5)
            b = cp_bearing_from_restoring(r["F_r"])
            print("  %s dKr %.2f mm (perm %.2f): F_r %5.0f N, M_w(0.5 deg) %.1f N m -> motor bearing near %.0f N / far %.0f N" % (
                size, dk, r["dKr_perm"], r["F_r"], r["M_w"], b["near"], b["far"]))

    print("\n## 6.3 DIN 740-2 selection, default direct drive (4-pole motor %.0f rpm, %s)" % (P["cp_n"], P["cp_spider"]))
    r = cp_din740(P)
    print("  T_N = 9550 P/n = %.2f N m; S_t(%.0f C) %.1f; S_z(%.0f starts/h) %.1f; S_A %.1f; k_start %.1f" % (
        r["T_N"], P["cp_T_amb"], r["S_t"], P["cp_starts_h"], S_z(P["cp_starts_h"]), P["cp_S_A"], P["cp_k_start"]))
    print("  J_A %.5f, J_L %.5f kg m2 -> M_A %.3f (drive-side share), M_L %.3f (load-side share)" % (r["J_A"], r["J_L"], r["M_A"], r["M_L"]))
    print("  nominal: T_KN %.0f >= T_N S_t %.1f; peak: T_Kmax %.0f >= T_S %.1f; vibratory T_KW %.1f N m" % (r["T_KN"], r["T_N"] * r["S_t"], r["T_Kmax"], r["T_S"], r["T_KW"]))
    for o in r["orders"]:
        print("  order %d: f %.1f Hz, eta %.3f, V %.3f, T at coupling %.2f N m, x S_t x S_f -> %.2f N m, util %.2f" % (
            o["order"], o["f"], o["eta"], o["V"], o["T_coupling"], o["T_check"], o["util"]))
    print("  checks: " + ", ".join("%s %s" % (k, "OK" if v else "NOT OK") for k, v in r["ok"].items()))

    print("\n## 6.4 Compressor torque orders from M2 crank.py (DFT) vs cp_T_harm")
    d = cp_dft_orders()
    tab = dict((k, v) for k, v in P["cp_T_harm"])
    print("  mean %.3f N m; " % d["mean"] + "; ".join("order %d %.3f (cp_T_harm %s)" % (k, v, "%.2f" % tab[k] if k in tab else "-") for k, v in d["orders"]))

    print("\n## 6.5 Magnification V(eta), psi 0.80 (92 Sh A)")
    for e, V in cp_mag_curve(0.8, [0, 0.2, 0.4, 0.6, 0.8, 0.9, 1.0, 1.1, 1.2, 1.414, 2.0, 3.0]):
        print("  eta %.3f: V %.3f" % (e, V))
    print("  resonance V_R = sqrt(1 + (2 pi/psi)^2) = %.2f (~ 2 pi / psi = %.2f)" % (magnification(1.0, 0.8), 2 * math.pi / 0.8))

    print("\n## 6.6 Damping heat in the spider")
    for size in ("J28", "J38"):
        h = cp_damping_heat(P, size)
        print("  %s: P_W %.3f W vs permissible %.1f W at %.0f C" % (size, h["P_W"], h["P_KW_perm"], P["cp_T_amb"]))

    print("\n## 6.7 Soft vs stiff coupling (J28 torques, stiffness varied)")
    for row in cp_stiffness_study(P):
        print("  C %6.0f N m/rad: f_e %6.1f Hz, %-13s max order torque %.2f N m, resonance passage %.1f N m -> %s" % (
            row["C"], row["f_e"], row["status"], row["T_op_max"], row["T_res"], "OK" if row["ok"] else "fails: " + ", ".join(row["fails"])))

    print("\n## 6.8 Holzer: motor - coupling J28 - flywheel - crank stub (d 30, L 150) - crank")
    t = cp_drive_train(P)
    print("  J %s kg m2, k %s N m/rad" % (["%.4f" % x for x in t["J"]], ["%.0f" % x for x in t["k"]]))
    print("  natural frequencies %s Hz; two-mass value %.1f Hz" % (["%.1f" % f for f in t["f"]], t["f_2mass"]))
    t2 = cp_holzer([t["J"][0], t["J"][1] + t["J"][2]], [t["k"][0]])
    print("  Holzer with 2 masses: %.2f Hz (must equal the two-mass formula)" % t2[0])

    print("\n## 6.9 Universal (Cardan) joint")
    for b in (5, 10, 20, 30):
        rs = [cp_cardan(b, ph) for ph in range(0, 360, 5)]
        print("  beta %2d deg: w2/w1 %.4f ... %.4f, U = tan b sin b %.4f (%.2f %%)" % (b, min(rs), max(rs), math.tan(math.radians(b)) * math.sin(math.radians(b)),
                                                                        100 * (max(rs) - min(rs))))
    for b1, b2, inph in ((15, 15, True), (15, 15, False), (15, 10, True)):
        rs = [cp_cardan_double(b1, b2, ph, inph) for ph in range(0, 360, 5)]
        print("  double joint %d/%d deg, forks %s: output ratio %.4f ... %.4f" % (b1, b2, "in phase" if inph else "90 deg off", min(rs), max(rs)))

    print("\n## 6.10 Torque limiter setting (direct drive)")
    tl = cp_torque_limiter(P)
    print("  slip torque between %.1f and %.1f N m -> set %.1f N m" % (tl["T_slip_min"], tl["T_slip_max"], tl["T_set"]))

# ================================================================ added with guide chapters (ch78)
# ---------------------------------------------------------------- chapter 7.1: pulley manufacture
MFG_PULLEY_MAT = {   # material, density kg/m3, permissible rim speed m/s, typical use (check maker / foundry)
    "EN-GJL-250 (grey cast iron)":   {"rho": 7200.0, "v_max": 30.0, "use": "standard catalogue pulleys, damping, cheap in series"},
    "EN-GJS-400-15 (ductile iron)":  {"rho": 7100.0, "v_max": 40.0, "use": "higher speed, shock, larger diameters"},
    "S355 / C45 (steel, welded or turned)": {"rho": 7850.0, "v_max": 45.0, "use": "one-off, high speed, small diameters from bar"},
    "EN AW-6082 T6 (aluminium)":     {"rho": 2700.0, "v_max": 35.0, "use": "light, low inertia (synchronous pulleys, servo axes)"},
}
# ISO 4183 style groove data (check): b above datum, h below datum, e groove pitch (tolerance), f edge distance,
# d34 = largest datum diameter with 34 deg groove angle (above: 38 deg)
MFG_GROOVE = {
    "SPZ": {"b": 2.0, "h": 9.0, "e": 12.0, "e_tol": 0.3, "f": 8.0, "d34": 80.0},
    "SPA": {"b": 2.75, "h": 11.0, "e": 15.0, "e_tol": 0.3, "f": 10.0, "d34": 118.0},
    "SPB": {"b": 3.5, "h": 14.0, "e": 19.0, "e_tol": 0.4, "f": 12.5, "d34": 190.0},
    "SPC": {"b": 4.8, "h": 19.0, "e": 25.5, "e_tol": 0.5, "f": 17.0, "d34": 315.0},
}

def mfg_groove(sec, d, z):
    """Groove angle, outside diameter, pulley face width B = (z - 1) e + 2 f, groove depth."""
    g = MFG_GROOVE[sec]
    alpha = 34.0 if d <= g["d34"] else 38.0
    return {"alpha": alpha, "d_out": d + 2 * g["b"], "B": (z - 1) * g["e"] + 2 * g["f"], "depth": g["b"] + g["h"],
            "e": g["e"], "e_tol": g["e_tol"], "f": g["f"]}

def mfg_groove_gauge(sec, d, Db):
    """Diameter over two gauge balls (or rolls) laid in the groove at opposite sides:
    ball centre above the datum line y = r/sin(phi) - (b_d/2)/tan(phi), phi = alpha/2; K = d + 2 y + 2 r."""
    bd = VBELT[sec]["bd"]
    phi = math.radians(mfg_groove(sec, d, 1)["alpha"] / 2)
    r = Db / 2
    y = r / math.sin(phi) - bd / 2 / math.tan(phi)
    return {"Db": Db, "y": y, "K": d + 2 * y + 2 * r}

def mfg_gauge_sensitivity(sec, d, Db, dalpha_deg=0.5):
    """Change of K when the groove angle is wrong by dalpha (sensitivity of the ball check)."""
    bd = VBELT[sec]["bd"]
    r = Db / 2
    def K(alpha):
        phi = math.radians(alpha / 2)
        return d + 2 * (r / math.sin(phi) - bd / 2 / math.tan(phi)) + 2 * r
    a0 = mfg_groove(sec, d, 1)["alpha"]
    return K(a0 + dalpha_deg) - K(a0)

def mfg_datum_ball(sec, d):
    """Ball that touches the flanks exactly at the datum width: r cos(phi) = b_d / 2 -> D_b = b_d / cos(phi).
    Its contact points lie on the datum line, so K hardly changes with the groove angle (dK/dalpha = 0): this ball
    checks the datum diameter; a second, larger or smaller ball then checks the angle."""
    phi = math.radians(mfg_groove(sec, d, 1)["alpha"] / 2)
    return VBELT[sec]["bd"] / math.cos(phi)

def mfg_rim_speed(d_out_mm, n, material):
    v = math.pi * d_out_mm * n / 60000
    vm = MFG_PULLEY_MAT[material]["v_max"]
    return {"v": v, "v_max": vm, "ok": v <= vm}

def mfg_pulley_mass(d_out, B, d_hub=None, rho=7200.0, fill=0.55):
    """Rough mass of an arm / web pulley: full cylinder x fill factor (0.45...0.65 for web and arm pulleys, check)."""
    return rho * math.pi / 4 * (d_out / 1000) ** 2 * (B / 1000) * fill

def mfg_unbalance(m_kg, n, G=6.3, r_mm=None):
    """ISO 21940-11: permissible residual unbalance U_per = 9549 G m / n [g mm]; e_per = U/m [um];
    the unbalance force at speed F = U w^2."""
    U = 9549 * G * m_kg / n
    w = 2 * math.pi * n / 60
    return {"U_gmm": U, "e_um": U / m_kg, "F_N": U * 1e-6 * w * w, "mass_g_at_r": U / r_mm if r_mm else None}

def mfg_balance_planes(B, d):
    """Rule of thumb (check ISO 21940-11 / maker): narrow disc B/d < 0.25 -> single-plane (static) balancing is enough."""
    return "single plane (static)" if B / d < 0.25 else "two planes (dynamic)"

# ---------------------------------------------------------------- chapter 7.4: coupling hubs, keys
MFG_KEY = [   # d from, d to, b x h, t1 shaft, t2 hub (DIN 6885-1 style, check)
    (17, 22, 6, 6, 3.5, 2.8), (22, 30, 8, 7, 4.0, 3.3), (30, 38, 10, 8, 5.0, 3.3), (38, 44, 12, 8, 5.0, 3.3),
    (44, 50, 14, 9, 5.5, 3.8), (50, 58, 16, 10, 6.0, 4.3), (58, 65, 18, 11, 7.0, 4.4), (65, 75, 20, 12, 7.5, 4.9),
]
MFG_P_ALLOW = {"steel hub": 90.0, "cast iron hub (GJL)": 50.0, "sintered / aluminium hub": 35.0}   # MPa static, check

def mfg_key(d, T_Nm, l_key, hub="steel hub", phi_peak=1.0):
    """Key flank pressure on the hub side: p = 2 T / (d (h - t1) l_eff), l_eff = l - b (round ends, form A)."""
    row = next(r for r in MFG_KEY if r[0] < d <= r[1])
    _, _, b, h, t1, t2 = row
    leff = l_key - b
    p = 2 * T_Nm * 1000 * phi_peak / (d * (h - t1) * leff)
    return {"b": b, "h": h, "t1": t1, "t2": t2, "l_eff": leff, "p": p, "p_allow": MFG_P_ALLOW[hub], "ok": p <= MFG_P_ALLOW[hub]}

# ---------------------------------------------------------------- chapter 7.5: installation, alignment, tensioning
MFG_BELT_ALIGN = {"V-belt": 0.5, "synchronous belt": 0.25, "roller chain": 0.3}   # max angle deg (check maker)

def mfg_belt_alignment(offset_mm, span_mm, kind):
    ang = math.degrees(math.atan(offset_mm / span_mm))
    return {"angle_deg": ang, "allow_deg": MFG_BELT_ALIGN[kind], "ok": ang <= MFG_BELT_ALIGN[kind],
            "max_offset_mm": span_mm * math.tan(math.radians(MFG_BELT_ALIGN[kind]))}

# shaft alignment tolerance for couplings (laser practice, typical table, check): rpm limit, offset mm, angle mm/100 mm
MFG_SHAFT_ALIGN = [(1000, 0.10, 0.08), (2000, 0.07, 0.05), (3000, 0.05, 0.04), (6000, 0.03, 0.03)]

def mfg_coupling_alignment(n, offset_mm, angle_mm_per_100, size=None):
    row = next(r for r in MFG_SHAFT_ALIGN if n <= r[0])
    res = {"tol_offset": row[1], "tol_angle": row[2], "ok": offset_mm <= row[1] and angle_mm_per_100 <= row[2]}
    if size:
        res["coupling_dKr"] = JAW[size]["dKr"]
        res["share_of_coupling_capacity"] = offset_mm / JAW[size]["dKr"]
    return res

MFG_RUNIN = 1.3      # new V-belt: install with 1.3 x T0, re-tension after the run-in (0.5 ... 4 h), check maker

def mfg_tension_plan(P):
    V = vbelt(P)
    S = VBELT[V["section"]]
    Ls = V["span"] / 1000
    f = lambda T: 1 / (2 * Ls) * math.sqrt(T / S["m"])
    Tn = MFG_RUNIN * V["T0"]
    return {"T0": V["T0"], "T_new": Tn, "f_new": f(Tn), "f_run": f(V["T0"]), "f_min": f(0.8 * V["T0"]),
            "F_test_new": 4 * Tn * 0.016, "F_test_run": 4 * V["T0"] * 0.016, "deflection": 16.0 * Ls}

def mfg_take_up(Ld):
    """Centre-distance adjustment (DIN 7753 style, check): x >= 0.03 Ld to tension and take up stretch, y >= 0.015 Ld to fit the belt."""
    return {"x_tension": 0.03 * Ld, "y_fit": 0.015 * Ld}

# ---------------------------------------------------------------- chapter 7.6: maintenance
def mfg_chain_wear_limit(z2, p, n_links=20):
    """Permissible wear elongation: 3 % (DIN 8195 style), but not more than 200/z2 % for large sprockets (check)."""
    lim = min(3.0, 200.0 / z2)
    L0 = n_links * p
    return {"limit_pct": lim, "L_new": L0, "L_replace": L0 * (1 + lim / 100), "n_links": n_links}

MFG_INTERVALS = [   # item, interval, action (typical, check maker)
    ("V-belt (new)", "after 0.5-4 h run-in", "re-tension to T0, check span frequency"),
    ("V-belt", "every 3 months / 1000 h", "tension, cracks, glazing, pulley groove wear (gauge)"),
    ("synchronous belt", "every 6 months / 2000 h", "tension, tooth wear, flange contact, alignment"),
    ("roller chain", "every 500 h / weekly drip", "lubrication, elongation over 20 links, sprocket hook wear"),
    ("elastic coupling", "every 4000 h / yearly", "spider wear (torsional backlash), alignment, hub screws"),
    ("all drives", "after any motor move", "alignment check with laser or straightedge"),
]

INSPECTION_PLAN_DRIVE = [   # characteristic, method, frequency
    ("groove angle / datum diameter", "ball gauge K, groove template", "first article + 1 per batch"),
    ("pulley runout radial / axial", "dial gauge, <= 0.1 mm / 0.1 mm per 100 mm (check)", "each pulley"),
    ("residual unbalance", "balancing machine, ISO 21940-11 G6.3", "each pulley > 1500 rpm / v > 30 m/s"),
    ("bore and keyway", "plug gauge H7, key gauge P9 / JS9", "each hub"),
    ("tooth profile (sprocket, synch. pulley)", "profile template / CMM", "first article"),
    ("tooth hardness (sprocket)", "HRC / HV", "1 per batch"),
    ("belt length / matched set", "measuring machine at defined force", "each set (supplier)"),
    ("installation tension", "span frequency meter / deflection force", "installation + after run-in"),
    ("alignment", "laser / straightedge", "installation, after maintenance"),
]

FAILURES_DRIVE = [   # drive, failure, appearance, cause, remedy
    ("V-belt", "glazing", "shiny hard flanks, squeal", "slip from low tension or overload", "re-tension, check rating, replace"),
    ("V-belt", "base cracking", "transverse cracks on the bottom", "too small pulley, heat, age, back-side idler", "bigger d1, ventilation, inside idler"),
    ("V-belt", "cord break", "belt torn, cord ends frayed", "shock, foreign body, prying the belt on", "shorten centre to fit, guard, shock factor"),
    ("V-belt", "side wear", "flanks worn, belt sits deep", "misalignment, worn grooves, wrong section", "align, gauge grooves, replace pulley"),
    ("V-belt", "unequal length in set", "one belt slack, others overloaded", "mixed old/new or unmatched belts", "always replace the full matched set"),
    ("synchronous belt", "tooth shear", "teeth missing on a length", "overload, too few teeth in mesh, low tension (jump)", "wider belt, more z1, tension"),
    ("synchronous belt", "edge wear", "frayed edge", "misalignment, flange rubbing", "align, check flange"),
    ("roller chain", "wear elongation", "chain rides high on teeth, skips", "poor lubrication, dirt, age", "lubricate, replace at limit with sprockets"),
    ("roller chain", "plate / roller fatigue crack", "cracks at holes, broken rollers", "overload, impact at high speed (small z1)", "bigger chain or z1, check rating"),
    ("roller chain", "galling of pin / bush", "blue / seized joints", "speed above lubrication limit", "pressure lubrication or slower drive"),
    ("elastic coupling", "spider wear", "torsional backlash, knock at start", "overload, misalignment, heat, oil", "replace spider, align, harder spider"),
    ("elastic coupling", "hub slip / fretting", "red rust on bore, key worn", "loose fit, key overload", "H7/k6 fit, check key pressure, clamping hub"),
    ("elastic coupling", "elastomer fatigue / burn", "cracked or melted cams", "resonance, vibratory torque too high", "change stiffness (f_e), check orders"),
]

PROCESS_CHAIN_DRIVE = {   # how the parts are made (typical)
    "cast pulley": ["pattern + sand mould (GJL-250)", "cast, knock out, fettle", "turn bore / taper-bush seat and hub faces",
                    "turn outside and grooves with form tool (one groove after the other or gang tool)", "check grooves with balls / template",
                    "balance (G6.3 or G16, drill material out of the rim / web)", "phosphate or paint, protect grooves"],
    "synchronous pulley": ["bar stock (aluminium / steel) or cast blank", "turn blank, bore", "generate profile by hobbing (or shaping for flanged / small)",
                           "deburr, flanges pressed or rolled on", "anodise / black oxide"],
    "sprocket": ["plate cut (laser / flame) or turned blank", "turn hub and bore", "hob teeth (ISO 606 profile)", "induction harden tooth flanks (45-55 HRC)",
                 "broach / slot keyway", "inspect profile and hardness"],
    "V-belt (raw edge, cogged)": ["build on drum: cover/cushion rubber, tension cord (polyester) wound under constant tension", "compression rubber (EPDM / CR with fibres)",
                                  "vulcanise sleeve in autoclave / press", "cut sleeve into single belts with the flank angle (raw edge)", "grind cogs / flanks", "measure length, sort into matched sets"],
    "synchronous belt": ["cord (glass / aramid / carbon) wound helically on a toothed mould", "rubber (CR / HNBR) or PU poured / pressed into the mould",
                         "nylon facing on the teeth", "vulcanise (rubber) or cure (PU)", "cut sleeve to widths", "check pitch length"],
    "roller chain": ["fine-blank inner / outer plates, then harden + temper", "form bushes (rolled or seamless), carburise",
                     "rollers: cold formed / drawn, case hardened", "pins: cold drawn, through/ case hardened, ground", "press-fit bushes into inner plates, pins into outer plates",
                     "pre-stretch (pre-load ~ 1/3 F_B) to remove initial elongation", "lubricate, cut to length, rivet"],
    "jaw coupling hub": ["sawn bar or casting (steel / GJL / aluminium)", "turn, cut jaws (milling)", "bore H7 after customer order, broach keyway P9 / JS9",
                         "tap set-screw hole over the keyway", "spider: injection moulded PU / TPU, 92 / 98 Sh A"],
}

# ---------------------------------------------------------------- chapter 7.7: life-cycle cost and decision matrix
MFG_COST = {   # purchase EUR, maintenance EUR/year, replacement interval h, replacement EUR (typical 3 kW drive, check quotes)
    "V-belt":            {"buy": 95.0, "maint": 40.0, "repl_h": None, "repl": 12.0},
    "synchronous belt":  {"buy": 140.0, "maint": 20.0, "repl_h": 25000.0, "repl": 45.0},
    "roller chain":      {"buy": 180.0, "maint": 120.0, "repl_h": 15000.0, "repl": 90.0},   # incl. pressure lubrication share
    "direct + coupling": {"buy": 160.0, "maint": 15.0, "repl_h": 24000.0, "repl": 20.0},    # coupling + 4-pole motor premium
}

def mfg_lcc(P, years=10):
    """Life-cycle cost = purchase + years x (energy + maintenance) + replacements over the period."""
    V = vbelt(P)
    rows = []
    for c in compare(P):
        k = MFG_COST[c["drive"]]
        rh = V["L_h"] if c["drive"] == "V-belt" else k["repl_h"]
        hours = P["hours_year"] * years
        n_repl = int(hours // rh) if rh else 0
        total = k["buy"] + years * (c["eur_year"] + k["maint"]) + n_repl * k["repl"]
        rows.append({"drive": c["drive"], "ok": c["ok"], "buy": k["buy"], "energy": years * c["eur_year"], "maint": years * k["maint"],
                     "repl": n_repl * k["repl"], "n_repl": n_repl, "total": total})
    base = min(r["total"] for r in rows if r["ok"])
    for r in rows:
        r["delta"] = r["total"] - base
    return rows

MFG_CRITERIA = [   # criterion, weight
    ("capacity / checks pass", 0.25), ("energy + LCC", 0.25), ("shaft and bearing load", 0.15),
    ("maintenance effort", 0.15), ("noise", 0.10), ("ratio accuracy", 0.10),
]
MFG_SCORES = {   # 1 (poor) ... 5 (very good), engineering judgement for the M2 compressor (check with your team)
    "V-belt":            [5, 3, 4, 3, 5, 3],
    "synchronous belt":  [5, 4, 3, 4, 3, 5],
    "roller chain":      [1, 3, 4, 1, 2, 5],
    "direct + coupling": [5, 5, 5, 5, 4, 4],
}

def mfg_decision(P):
    ok = {c["drive"]: c["ok"] for c in compare(P)}
    rows = []
    for d, s in MFG_SCORES.items():
        s = list(s)
        if not ok[d]:
            s[0] = 1
        rows.append({"drive": d, "scores": s, "total": sum(w * x for (_, w), x in zip(MFG_CRITERIA, s))})
    return sorted(rows, key=lambda r: -r["total"])

# ---------------------------------------------------------------- chapter 8: worked example
EXAMPLE_TASK = {
    "name": "Belt conveyor head drive 7.5 kW 1460 -> 480 rpm (example, chapter 8)",
    "P_kW": 7.5, "P_load_kW": 6.0, "n1": 1460.0, "n2": 480.0,
    "load_class": "medium (screw compressors, conveyors)", "hours_per_day": 16.0, "a_target": 600.0,
    "vb_section": "SPA", "vb_d1": 160.0, "sy_profile": "14M", "sy_z1": 30, "sy_z2": 91,
    "ch_chain": "12A (ANSI 60)", "ch_z1": 19, "ch_z2": 58, "ch_strands": 1,
    "cp_n": 480.0, "cp_J_motor": 0.30, "cp_J_load": 2.0, "cp_T_harm": [[1, 5.0]], "cp_d_motor": 60.0, "cp_d_load": 60.0,
    "eta_motor_4p": 0.90, "hours_year": 4000.0,
}

def example_params():
    P = dict(DEFAULT)
    P.update(EXAMPLE_TASK)
    return P

def example_options(P):
    """Design decisions of the worked example: V-belt section x d1, synchronous profile x z1, chain size x z1."""
    vb = []
    for sec, d1 in (("SPA", 125.0), ("SPA", 160.0), ("SPA", 200.0), ("SPB", 160.0), ("SPB", 200.0)):
        V = vbelt(P, sec, d1)
        vb.append((sec, d1, V["d2"], V["z"], V["a"], V["F_shaft"], V["n2"], all(V["ok"].values())))
    sy = []
    for prof, z1, z2 in (("8M", 34, 104), ("8M", 40, 122), ("14M", 28, 85), ("14M", 30, 91)):
        Y = sync(P, prof, z1, z2)
        sy.append((prof, z1, z2, Y["b"], Y["P_rated"], Y["F_shaft"], Y["n2"], all(Y["ok"].values()), Y["v"]))
    ch = []
    for name, z1, z2 in (("08A (ANSI 40)", 19, 58), ("10A (ANSI 50)", 19, 58), ("12A (ANSI 60)", 17, 52), ("12A (ANSI 60)", 19, 58)):
        K = chain(P, name, z1, z2)
        ch.append((name, z1, z2, K["v"], K["P_allow"], K["P_req"], K["lub"], all(K["ok"].values())))
    return vb, sy, ch

# ---------------------------------------------------------------- demo
def demo_ch78():
    P = dict(DEFAULT)
    V = vbelt(P)
    print("## 7.1 Pulley materials and rim speed (default drive, d2 runs at %.0f rpm)" % P["n2"])
    for mname, m in MFG_PULLEY_MAT.items():
        print("  %-38s rho %5.0f kg/m3, v_max %4.0f m/s - %s" % (mname, m["rho"], m["v_max"], m["use"]))
    for d, n, lab in ((V["d1"], P["n1"], "motor pulley d1"), (V["d2"], V["n2"], "crank pulley d2")):
        g = mfg_groove(V["section"], d, V["z"])
        r = mfg_rim_speed(g["d_out"], n, "EN-GJL-250 (grey cast iron)")
        print("  %s %.0f: groove %.0f deg, d_out %.1f mm, face width B %.1f mm, depth %.2f mm; rim speed %.1f m/s vs %.0f (GJL-250) -> %s" % (
            lab, d, g["alpha"], g["d_out"], g["B"], g["depth"], r["v"], r["v_max"], "OK" if r["ok"] else "NOT OK"))
    print("  rim speed limit check, larger pulleys at 2930 rpm (GJL-250):")
    for d in (150, 180, 200, 224):
        r = mfg_rim_speed(d + 4, 2930, "EN-GJL-250 (grey cast iron)")
        print("    d %3d: v %.1f m/s -> %s" % (d, r["v"], "OK" if r["ok"] else "use GJS / steel"))

    print("\n## 7.2 ISO 4183 groove data and ball gauge")
    for sec, g in MFG_GROOVE.items():
        print("  %s: b %.2f, h %.1f, e %.1f +-%.1f, f %.1f mm, 34 deg up to d %.0f, 38 deg above" % (sec, g["b"], g["h"], g["e"], g["e_tol"], g["f"], g["d34"]))
    Dbd = mfg_datum_ball("SPZ", V["d1"])
    kd = mfg_groove_gauge("SPZ", V["d1"], Dbd)
    print("  ball touching at the datum width: D_b = b_d / cos(alpha/2) = %.3f mm, centre %.3f mm above datum -> K %.3f mm; +0.5 deg changes K by %.4f mm" % (
        Dbd, kd["y"], kd["K"], mfg_gauge_sensitivity("SPZ", V["d1"], Dbd)))
    for Db in (8.0, 9.0, 10.0):
        k = mfg_groove_gauge("SPZ", V["d1"], Db)
        print("  SPZ d %.0f, ball %.1f mm: centre %.3f mm above datum line -> K over balls %.3f mm; +0.5 deg groove angle changes K by %.3f mm" % (
            V["d1"], Db, k["y"], k["K"], mfg_gauge_sensitivity("SPZ", V["d1"], Db)))

    print("\n## 7.3 Balancing ISO 21940-11")
    for d, n, lab in ((V["d1"], P["n1"], "d1"), (V["d2"], V["n2"], "d2")):
        g = mfg_groove(V["section"], d, V["z"])
        m = mfg_pulley_mass(g["d_out"], g["B"])
        for G in (6.3, 16.0):
            u = mfg_unbalance(m, n, G, r_mm=g["d_out"] / 2 - 10)
            print("  %s %.0f mm: mass ~%.2f kg, G%-4s U_per %.1f g mm (e %.1f um), correction mass at r %.0f: %.2f g, force at speed %.1f N; %s" % (
                lab, d, m, G, u["U_gmm"], u["e_um"], g["d_out"] / 2 - 10, u["mass_g_at_r"], u["F_N"], mfg_balance_planes(g["B"], g["d_out"])))

    print("\n## 7.4 Coupling hub: bore, keyway DIN 6885, key pressure (direct drive, J28, motor shaft 28 mm)")
    b = coupling(P)["best"]
    for d, l, hub in ((28.0, 40.0, "steel hub"), (28.0, 40.0, "cast iron hub (GJL)"), (30.0, 40.0, "steel hub")):
        k = mfg_key(d, b["T_N"], l, hub, phi_peak=b["T_S"] / b["T_N"])
        print("  d %.0f H7, key %dx%d, t1 %.1f / t2 %.1f, l %.0f (l_eff %.0f): p at start torque %.0f MPa vs %s %.0f MPa -> %s" % (
            d, k["b"], k["h"], k["t1"], k["t2"], l, k["l_eff"], k["p"], hub, k["p_allow"], "OK" if k["ok"] else "NOT OK"))

    print("\n## 7.5 Installation: alignment and tensioning")
    for kind, off in (("V-belt", 2.0), ("V-belt", 5.0), ("synchronous belt", 2.0)):
        a = mfg_belt_alignment(off, V["span"], kind)
        print("  %-17s offset %.1f mm over span %.0f mm: %.2f deg vs %.2f -> %s (max offset %.1f mm)" % (
            kind, off, V["span"], a["angle_deg"], a["allow_deg"], "OK" if a["ok"] else "NOT OK", a["max_offset_mm"]))
    for off, ang in ((0.05, 0.03), (0.12, 0.05)):
        c = mfg_coupling_alignment(P["cp_n"], off, ang, b["size"])
        print("  coupling at %.0f rpm: offset %.2f mm, angle %.2f mm/100 -> laser tol %.2f / %.2f -> %s; %.0f %% of the coupling's dKr %.2f mm" % (
            P["cp_n"], off, ang, c["tol_offset"], c["tol_angle"], "OK" if c["ok"] else "re-align", 100 * c["share_of_coupling_capacity"], c["coupling_dKr"]))
    t = mfg_tension_plan(P)
    tu = mfg_take_up(V["Ld"])
    print("  tension: new belt %.0f N (f %.0f Hz, test force %.1f N at %.1f mm), after run-in %.0f N (f %.0f Hz, %.1f N); re-tension below %.0f Hz" % (
        t["T_new"], t["f_new"], t["F_test_new"], t["deflection"], t["T0"], t["f_run"], t["F_test_run"], t["f_min"]))
    print("  motor slide travel: + %.0f mm to tension / take up stretch, - %.0f mm to fit the belt without prying" % (tu["x_tension"], tu["y_fit"]))

    print("\n## 7.6 Maintenance: chain wear limit and intervals")
    for z2 in (38, 58, 80, 100):
        w = mfg_chain_wear_limit(z2, CHAINS[P["ch_chain"]]["p"])
        print("  z2 %3d: limit %.2f %% -> 20 links new %.1f mm, replace at %.1f mm" % (z2, w["limit_pct"], w["L_new"], w["L_replace"]))
    for it in MFG_INTERVALS:
        print("  %-18s %-26s %s" % it)

    print("\n## 7.7 Process chains (how the parts are made)")
    for k, steps in PROCESS_CHAIN_DRIVE.items():
        print("  %s: %s" % (k, " -> ".join(steps)))

    print("\n## 7.8 Inspection plan")
    for r in INSPECTION_PLAN_DRIVE:
        print("  %-38s %-52s %s" % r)

    print("\n## 7.9 Failure modes")
    for r in FAILURES_DRIVE:
        print("  %-16s %-26s %-38s | %s | %s" % r)

    print("\n## 7.10 Life-cycle cost over 10 years (default task, costs typical - check quotes)")
    for r in mfg_lcc(P):
        print("  %-18s %s buy %4.0f + energy %6.0f + maint. %5.0f + %d repl. %4.0f = %6.0f EUR (+%.0f)" % (
            r["drive"], "OK    " if r["ok"] else "NOT OK", r["buy"], r["energy"], r["maint"], r["n_repl"], r["repl"], r["total"], r["delta"]))
    print("  decision matrix (weights %s):" % ", ".join("%s %.2f" % c for c in MFG_CRITERIA))
    for r in mfg_decision(P):
        print("  %-18s scores %s -> %.2f" % (r["drive"], r["scores"], r["total"]))

    print("\n## 8.2 Worked example: %s" % EXAMPLE_TASK["name"])
    Q = example_params()
    print("  service factor %.2f -> P_B %.2f kW, i %.3f" % (service_factor(Q), Q["P_kW"] * service_factor(Q), Q["n1"] / Q["n2"]))
    vb, sy, ch = example_options(Q)
    print("  V-belt options:")
    for r in vb:
        print("    %s d1 %3.0f / d2 %3.0f: z %d, a %.0f, shaft load %.0f N, n2 %.1f -> %s" % (r[0], r[1], r[2], r[3], r[4], r[5], r[6], "OK" if r[7] else "fails"))
    print("  synchronous belt options:")
    for r in sy:
        print("    %-3s z %d / %d: v %.1f m/s, width %s mm (%.1f kW), shaft load %.0f N, n2 %.1f -> %s" % (r[0], r[1], r[2], r[8], r[3], r[4], r[5], r[6], "OK" if r[7] else "fails"))
    print("  chain options:")
    for r in ch:
        print("    %-14s z %d / %d: v %.2f m/s, allowed %.2f vs required %.2f kW, %s -> %s" % (r[0], r[1], r[2], r[3], r[4], r[5], r[6], "OK" if r[7] else "fails"))
    print("  LCC 10 years:")
    for r in mfg_lcc(Q):
        print("    %-18s %s total %6.0f EUR (energy %6.0f)" % (r["drive"], "OK    " if r["ok"] else "NOT OK", r["total"], r["energy"]))
    print("  example input file content (examples/drive_example.json):")
    print("  " + json.dumps(EXAMPLE_TASK)[:200] + " ...")

def cmd_examples():
    P = dict(DEFAULT)
    print(report_text(P))
    print("\n## V-belt sections x small pulley (cheapest passing marked *)")
    T = vbelt_table(P)
    for r in T["rows"]:
        if r["d1"] in (63, 80, 100, 125, 150, 160, 200, 250, 315, 400, 500):
            print("  %s d1 %3d d2 %3d: z %2d, width %5.1f mm, v %5.1f m/s, fatigue life %9.0f h %s%s" % (
                r["section"], r["d1"], r["d2"], r["z"], r["width"], r["v"], r["L_h_fat"], "OK" if r["ok"] else "fails: " + ",".join(r["fails"]),
                " *" if r is T["best"] else ""))
    print("\n## Rating P_N per belt (kW, 180 deg, L_ref) vs speed")
    for sec, d in (("SPZ", 100), ("SPZ", 150), ("SPA", 140), ("SPB", 200), ("SPC", 315)):
        print("  %s d %3d: " % (sec, d) + "  ".join("%4.0f rpm %5.2f" % (n, vb_rated(sec, d, n)["P_kW"]) for n in (720, 1450, 2930)))
    print("\n## Chain: rating vs size at %.0f rpm, z1 %d" % (P["n1"], P["ch_z1"]))
    for c in CHAINS:
        K = chain(P, name=c)
        print("  %-15s v %5.2f m/s, rating %5.2f kW (%s), static S %5.1f, %s -> %s" % (
            c, K["v"], K["rating"]["P_kW"], K["rating"]["limit"], K["S_static"], K["lub"], "OK" if all(K["ok"].values()) else "fails"))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-66s %s %s" % (name, "OK  " if cond else "FAIL", info))
    P = dict(DEFAULT)
    g = open_belt(150.0, 300.0, 400.0)
    chk("belt length: approximate formula within 0.05 % of exact geometry", abs(g["L_approx"] / g["L_exact"] - 1) < 5e-4,
        "%.2f / %.2f" % (g["L_approx"], g["L_exact"]))
    chk("centre distance from length is the inverse of the length formula", abs(centre_from_length(g["L_approx"], 150, 300) - 400) < 1e-9)
    chk("wrap factor c1(180 deg) = 1, c1(120 deg) = 0.82 (DIN table)", abs(vb_c1(math.pi) - 1) < 1e-12 and abs(vb_c1(math.radians(120)) - 0.82) < 0.01,
        "%.3f" % vb_c1(math.radians(120)))
    V = vbelt(P)
    e = math.exp(VB_MODEL["mu_eff"] * math.radians(V["beta1_deg"]))
    chk("Euler-Eytelwein: (F1 - Fc)/(F2 - Fc) = e^(mu' beta), F1 - F2 = F_e",
        abs((V["F1"] - V["F_c"]) / (V["F2"] - V["F_c"]) / e - 1) < 1e-9 and abs(V["F1"] - V["F2"] - V["F_e"]) < 1e-9)
    m, Ls = VBELT[V["section"]]["m"], V["span"] / 1000
    T_back = m * (2 * Ls * V["f_span"]) ** 2
    chk("span frequency -> tension (string) gives T0 back", abs(T_back / V["T0"] - 1) < 1e-12, "%.1f N" % T_back)
    S = VBELT["SPZ"]
    v = 20.0
    sp, fB = vb_sig_perm("SPZ", v, S["L_ref"])
    Lh = VB_MODEL["L_h_ref"] * (VB_MODEL["f_ref"] / fB) * (S["sig_ref"] / sp) ** VB_MODEL["m_w"]
    chk("belt life at the permissible stress = reference life", abs(Lh / VB_MODEL["L_h_ref"] - 1) < 1e-9)
    X = chain_length(19, 38, 400.0, 12.7)
    chk("chain: centre distance from links is the inverse of the links formula", abs(chain_centre(X, 19, 38, 12.7) - 400.0) < 1e-6)
    chk("chain: polygon effect -> 0 for many teeth, 1-cos(180/19) = 1.36 %", abs(1 - math.cos(math.pi / 1e5)) < 1e-9 and abs(chain(P)["polygon"] - 0.01363) < 1e-4)
    Y = sync(P)
    chk("synchronous belt: pitch length = teeth x pitch, pitch diameter = z p / pi", abs(Y["Lp"] / Y["p"] - Y["z_belt"]) < 1e-12 and abs(Y["d1"] * math.pi - Y["z1"] * Y["p"]) < 1e-9)
    # coupling: 2-mass time integration with equivalent viscous damping vs magnification formula
    b = coupling(P)["best"] or coupling_check(P, "J28")
    JA, JL, C, psi = b["J_A"], b["J_L"], b["C_dyn"], b["psi"]
    w = 0.6 * 2 * math.pi * b["f_e"]
    c = psi * C / (2 * math.pi * w)
    T = 10.0
    x = [0.0, 0.0, 0.0, 0.0]                                # phiA, phiL, wA, wL
    def f(t, s):
        th, om = s[1] - s[0], s[3] - s[2]
        Tc = C * th + c * om
        return [s[2], s[3], Tc / JA, (T * math.sin(w * t) - Tc) / JL]
    dt = 2 * math.pi / w / 200
    t, amp = 0.0, 0.0
    for i in range(200 * 160):
        k1 = f(t, x); k2 = f(t + dt / 2, [a + dt / 2 * q for a, q in zip(x, k1)])
        k3 = f(t + dt / 2, [a + dt / 2 * q for a, q in zip(x, k2)]); k4 = f(t + dt, [a + dt * q for a, q in zip(x, k3)])
        x = [a + dt / 6 * (p1 + 2 * p2 + 2 * p3 + p4) for a, p1, p2, p3, p4 in zip(x, k1, k2, k3, k4)]
        t += dt
        if i > 200 * 120:
            amp = max(amp, abs(C * (x[1] - x[0]) + c * (x[3] - x[2])))
    form = T * JA / (JA + JL) * magnification(0.6, psi)
    chk("coupling: 2-mass simulation amplitude = T M_L V(eta) (eta 0.6)", abs(amp / form - 1) < 0.02, "%.3f / %.3f N m" % (amp, form))
    chk("default V-belt drive and a coupling pass all checks", all(V["ok"].values()) and coupling(P)["best"] is not None)
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
        out = "drive_out"
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
