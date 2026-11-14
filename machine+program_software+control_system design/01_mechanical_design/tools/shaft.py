#!/usr/bin/env python3
"""M3 shaft program - stepped shaft on two bearings: loads, bending + torsion, deflection, slopes, critical speed,
strength proof in the style of DIN 743 (static + fatigue at every notch), feather keys (DIN 6885 / 6892 simple method),
interference fits (Lame / DIN 7190 elastic), manufacturing data. Guide: 03_shaft_design.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python shaft.py params                     default input (JSON) - copy, edit, use with --in
  python shaft.py run [--in p.json] [--out folder]   full calculation -> report.md, shaft.csv, *.svg
  python shaft.py examples                   worked examples of the guide
  python shaft.py selftest                   independent cross-checks (must print SELFTEST PASS)
  python shaft.py ch24 | ch56 | ch711        extra results of guide chapters 2-4, 5-6, 7-11
  python shaft.py run --in examples/shaft_redesign.json --out redesign   lighter redesign (chapter 11)

Coordinates: x along the shaft [mm] from the left end; loads in two planes y and z [N]; torque T [N m].
Units inside: N, mm, MPa (N/mm2), N mm. All default numbers are EXAMPLE values.
IMPORTANT: the DIN 743 factors are implemented from the published formulas as far as they are known to the author;
values marked 'check' in the guide must be compared with DIN 743-1..-4 (2012) before a design report is signed.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- materials (typical, d <= 16 mm reference values)
MATERIALS = {   # Rm, Re (MPa) for reference diameter dB = 16 mm; E, G (MPa); rho kg/m3; kind for K1 law
    "C45+N":       {"Rm": 620, "Re": 340, "E": 210000, "G": 81000, "rho": 7850, "kind": "normalised"},
    "C45+QT":      {"Rm": 700, "Re": 490, "E": 210000, "G": 81000, "rho": 7850, "kind": "QT"},
    "42CrMo4+QT":  {"Rm": 1100, "Re": 900, "E": 210000, "G": 81000, "rho": 7850, "kind": "QT"},
    "34CrNiMo6+QT": {"Rm": 1200, "Re": 1000, "E": 210000, "G": 81000, "rho": 7850, "kind": "QT"},
    "16MnCr5 (core)": {"Rm": 1000, "Re": 695, "E": 210000, "G": 81000, "rho": 7850, "kind": "case"},
    "S355J2":      {"Rm": 490, "Re": 355, "E": 210000, "G": 81000, "rho": 7850, "kind": "structural"},
}

DEFAULT = {
    "name": "VC20 crankshaft as stepped shaft (example) - loads from crank.py",
    "material": "C45+QT",
    # segments from the left (pulley) end: [length mm, outer d mm, bore mm]
    "segments": [[40, 25, 0], [20, 30, 0], [100, 35, 0], [20, 30, 0], [10, 25, 0]],
    "bearings": [50.0, 170.0],                 # bearing centres x [mm]: A (locating), B (floating)
    "forces": [                                 # [x mm, Fy N, Fz N, label]
        [20.0, 0.0, -637.0, "belt pull on pulley (2 x 2 T_max / d_p, from crank.py)"],
        [110.0, -2684.0, 0.0, "crank-pin load (M2, peak)"]],
    "masses": [[20.0, 3.1, "flywheel pulley"]],   # [x, kg, label] for critical speed
    "torque_in_x": 20.0, "torque_out_x": 110.0,  # torque enters at the pulley, leaves at the crank pin
    "T_mean_Nm": 17.6, "T_amp_Nm": 30.2,         # torque mean + amplitude (from the M2 torque curve)
    "T_max_Nm": 47.8,                            # peak torque for the static proof
    "bending_rotating": True,                    # rotating shaft, constant load direction -> fully reversed bending
    "load_factor_static": 1.5,                   # peak / nominal for the static proof (start, fault) - example
    "rpm": 1450.0,
    "notches": [   # [x mm, type, parameters] type: shoulder | keyway | pressfit | groove | plain
        [40.0, "shoulder", {"D": 30, "d": 25, "r": 1.0, "Rz": 6.3}],
        [60.0, "shoulder", {"D": 35, "d": 30, "r": 1.0, "Rz": 6.3}],
        [20.0, "keyway", {"d": 25, "Rz": 6.3}],
        [50.0, "pressfit", {"d": 30, "Rz": 3.2}],
        [160.0, "shoulder", {"D": 35, "d": 30, "r": 1.0, "Rz": 6.3}],
        [110.0, "plain", {"d": 35, "Rz": 3.2}]],
    "S_min": 1.2,                                # DIN 743 minimum safety (static and fatigue)
    "key": {"d": 25, "l": 32, "hub": "cast iron", "T_Nm": 47.8, "K_A": 1.25},
    "pressfit": {"d": 30, "D_hub": 55, "di_shaft": 0, "l": 16, "U_min_um": 18, "U_max_um": 48, "Rz_shaft": 3.2,
                 "Rz_hub": 6.3, "E_shaft": 210000, "E_hub": 210000, "nu": 0.3, "mu": 0.12, "Re_hub": 600,
                 "alpha_hub": 11e-6},
    "slope_limit_rad": 0.001,                    # bearing misalignment limit (example; check bearing catalogue)
    "deflection_limit_mm": 0.05,
    "step_mm": 0.5,
}

# ---------------------------------------------------------------- chapter 3: section properties
def section(D, di=0.0):
    """Area A, second moment I, polar Ip, section moduli Wb, Wt of a (hollow) round section, mm units."""
    A = math.pi / 4 * (D ** 2 - di ** 2)
    I = math.pi / 64 * (D ** 4 - di ** 4)
    return {"A": A, "I": I, "Ip": 2 * I, "Wb": I / (D / 2), "Wt": 2 * I / (D / 2)}

def geometry_at(P, x):
    """Outer and inner diameter at position x (left segment wins at a step)."""
    s = 0.0
    for L, D, di in P["segments"]:
        if x <= s + L + 1e-9:
            return D, di
        s += L
    return P["segments"][-1][1], P["segments"][-1][2]

def length(P):
    return sum(L for L, _, _ in P["segments"])

# ---------------------------------------------------------------- chapter 4: loads, reactions, moments
def reactions(P):
    """Two bearings A, B (statically determinate). Sum of forces and moments in each plane."""
    xa, xb = P["bearings"]
    out = {}
    for k, idx in (("y", 1), ("z", 2)):
        F = sum(f[idx] for f in P["forces"])
        Mb = sum(f[idx] * (f[0] - xa) for f in P["forces"])   # moments about A
        RB = -Mb / (xb - xa)
        RA = -F - RB
        out[k] = (RA, RB)
    return out

def internal(P, x):
    """Bending moments My(x) (from y-forces), Mz(x) (from z-forces) [N mm], resultant M, torque T [N mm].
    Moment at x = sum over loads left of x of F (x - xF)."""
    R = reactions(P)
    xa, xb = P["bearings"]
    loads = [(xa, R["y"][0], R["z"][0]), (xb, R["y"][1], R["z"][1])] + [(f[0], f[1], f[2]) for f in P["forces"]]
    My = sum(Fy * (x - xf) for xf, Fy, Fz in loads if xf < x)
    Mz = sum(Fz * (x - xf) for xf, Fy, Fz in loads if xf < x)
    t1, t2 = sorted((P["torque_in_x"], P["torque_out_x"]))
    T = P["T_max_Nm"] * 1000 if t1 <= x <= t2 else 0.0
    return {"My": My, "Mz": Mz, "M": math.hypot(My, Mz), "T": T}

# ---------------------------------------------------------------- chapter 5: deflection, slope, critical speed
def deflection(P, plane="y", extra_forces=None):
    """Exact elastic line of the stepped shaft by numerical double integration of M/(E I(x)) (trapezoid, fine
    step), with v = 0 at both bearings. Returns x list, slope list (rad), deflection list (mm)."""
    E = MATERIALS[P["material"]]["E"]
    Q = dict(P)
    if extra_forces is not None:
        Q = dict(P, forces=extra_forces)
    n = int(round(length(Q) / Q["step_mm"]))
    xs = [i * Q["step_mm"] for i in range(n + 1)]
    key = "My" if plane == "y" else "Mz"
    k = []
    for x in xs:
        D, di = geometry_at(Q, x)
        k.append(internal(Q, x)[key] / (E * section(D, di)["I"]))   # curvature v''
    th = [0.0]
    v = [0.0]
    for i in range(1, len(xs)):
        h = xs[i] - xs[i - 1]
        th.append(th[-1] + 0.5 * (k[i] + k[i - 1]) * h)
        v.append(v[-1] + 0.5 * (th[i] + th[i - 1]) * h)
    xa, xb = Q["bearings"]
    def at(arr, x):
        j = min(range(len(xs)), key=lambda i: abs(xs[i] - x))
        return arr[j]
    # add rigid-body line C1 x + C0 so that v(xa) = v(xb) = 0
    va, vb = at(v, xa), at(v, xb)
    C1 = -(vb - va) / (xb - xa)
    C0 = -va - C1 * xa
    v = [vi + C1 * x + C0 for vi, x in zip(v, xs)]
    th = [ti + C1 for ti in th]
    return xs, th, v

def deflection_summary(P):
    xs, thy, vy = deflection(P, "y")
    _, thz, vz = deflection(P, "z")
    vr = [math.hypot(a, b) for a, b in zip(vy, vz)]
    tr = [math.hypot(a, b) for a, b in zip(thy, thz)]
    def at(arr, x):
        return arr[min(range(len(xs)), key=lambda i: abs(xs[i] - x))]
    out = {"v_max": max(vr), "x_vmax": xs[vr.index(max(vr))],
           "slope_A": at(tr, P["bearings"][0]), "slope_B": at(tr, P["bearings"][1])}
    for f in P["forces"]:
        out["v_at_%s" % f[3].split()[0]] = at(vr, f[0])
    return out, xs, vr, tr

def critical_speed(P):
    """Bending critical speed (Rayleigh): static deflection of the shaft under its own weight (segment masses)
    plus attached masses, both applied in one plane: w = sqrt(g sum(m y) / sum(m y^2)).
    Also Dunkerley lower bound for comparison."""
    rho = MATERIALS[P["material"]]["rho"]
    g = 9810.0                                    # mm/s2
    lumps = []
    s = 0.0
    for L, D, di in P["segments"]:
        m = rho * math.pi / 4 * (D ** 2 - di ** 2) * L * 1e-9   # kg
        lumps.append((s + L / 2, m))
        s += L
    lumps += [(m_[0], m_[1]) for m_ in P["masses"]]
    forces = [[x, -m * g / 1000.0, 0.0, "w"] for x, m in lumps]   # N (m kg * g m/s2)
    xs, _, v = deflection(P, "y", extra_forces=forces)
    def at(x):
        return v[min(range(len(xs)), key=lambda i: abs(xs[i] - x))]
    ys = [abs(at(x)) for x, _ in lumps]
    num = sum(m * y for (x, m), y in zip(lumps, ys))
    den = sum(m * y * y for (x, m), y in zip(lumps, ys))
    w = math.sqrt(g * num / den)                   # rad/s (y in mm, g in mm/s2)
    n_crit = w * 60 / (2 * math.pi)
    # Dunkerley: 1/w^2 = sum 1/w_i^2 with each mass alone
    inv = 0.0
    for x, m in lumps:
        xs1, _, v1 = deflection(P, "y", extra_forces=[[x, -1.0, 0.0, "unit"]])
        a = abs(v1[min(range(len(xs1)), key=lambda i: abs(xs1[i] - x))])     # mm per N
        inv += m * a * 1e-3                       # kg * m/N
    w_d = math.sqrt(1 / inv)
    return {"n_crit_rpm": n_crit, "n_dunkerley_rpm": w_d * 60 / (2 * math.pi), "ratio": n_crit / P["rpm"],
            "mass_total_kg": sum(m for _, m in lumps)}

def torsion_angle(P):
    """Twist between torque input and output: phi = sum T L / (G Ip)."""
    G = MATERIALS[P["material"]]["G"]
    t1, t2 = sorted((P["torque_in_x"], P["torque_out_x"]))
    n = 400
    phi = 0.0
    h = (t2 - t1) / n
    for i in range(n):
        x = t1 + (i + 0.5) * h
        D, di = geometry_at(P, x)
        phi += P["T_max_Nm"] * 1000 * h / (G * section(D, di)["Ip"])
    return {"phi_rad": phi, "phi_deg": math.degrees(phi), "deg_per_m": math.degrees(phi) / ((t2 - t1) / 1000)}

# ---------------------------------------------------------------- chapter 6: notch factors (Kt fits)
_KT_BEND = {6.0: (0.87868, -0.33243), 3.0: (0.89334, -0.30860), 2.0: (0.90879, -0.28598), 1.5: (0.93836, -0.25759),
            1.2: (0.97098, -0.21796), 1.1: (0.95120, -0.23757), 1.07: (0.97527, -0.20958), 1.05: (0.98137, -0.19653),
            1.03: (0.98061, -0.18381), 1.02: (0.96048, -0.17711), 1.01: (0.91938, -0.17032)}
_KT_TORS = {2.0: (0.86331, -0.23865), 1.33: (0.84897, -0.23161), 1.2: (0.83425, -0.21649), 1.09: (0.90337, -0.12692)}

def kt_shoulder(D, d, r, load="bending"):
    """Stress concentration factor of a shoulder fillet, curve fits Kt = A (r/d)^b of Peterson's charts
    (coefficients as tabulated by R. L. Norton, Machine Design). Linear interpolation in D/d."""
    tab = _KT_BEND if load == "bending" else _KT_TORS
    q = D / d
    keys = sorted(tab)
    if q <= keys[0]:
        A, b = tab[keys[0]]
    elif q >= keys[-1]:
        A, b = tab[keys[-1]]
    else:
        k1 = max(k for k in keys if k <= q)
        k2 = min(k for k in keys if k >= q)
        t = 0 if k2 == k1 else (q - k1) / (k2 - k1)
        A = tab[k1][0] + t * (tab[k2][0] - tab[k1][0])
        b = tab[k1][1] + t * (tab[k2][1] - tab[k1][1])
    return max(1.0, A * (r / d) ** b)

# ---------------------------------------------------------------- chapter 7: DIN 743 style strength proof
def K1(d, mat):
    """Technological size factor (strength of the blank falls with size). Reference dB = 16 mm.
    QT / case: K1 = 1 - 0.26 lg(d/dB) for 16 < d <= 300 (form as in DIN 743-2; check the table there)."""
    if d <= 16:
        return 1.0
    return max(0.5, 1 - 0.26 * math.log10(d / 16.0))

def K2(d):
    """Geometric size factor (fatigue): 1 - 0.2 lg(d/7.5)/lg 20 for 7.5 <= d < 150, 0.8 above."""
    if d <= 7.5:
        return 1.0
    if d >= 150:
        return 0.8
    return 1 - 0.2 * math.log10(d / 7.5) / math.log10(20)

def KF(Rz, Rm):
    """Surface roughness factor: KF_sigma = 1 - 0.22 lg(Rz/um) (lg(Rm/20 MPa) - 1); KF_tau = 0.575 KF_sigma + 0.425."""
    ks = 1 - 0.22 * math.log10(max(Rz, 1.0)) * (math.log10(Rm / 20.0) - 1)
    return ks, 0.575 * ks + 0.425

def support_n(G1, Re_d):
    """Support number from the relative stress gradient G' [1/mm]: n = 1 + sqrt(G' mm) 10^-(0.33 + Re(d)/712)."""
    return 1 + math.sqrt(max(G1, 0.0)) * 10 ** -(0.33 + Re_d / 712.0)

def notch_betas(ntype, prm, Rm_d, Re_d):
    """Fatigue notch factors beta_sigma (bending), beta_tau (torsion) for the notch types.
    shoulder: Kt from fits, G' = 2.3 (1 + phi)/r (bending), 1.15/r (torsion), phi = 1/(4 sqrt(t/r) + 2), t = (D-d)/2.
    keyway (end-milled): beta_s = 3.0 (Rm/1000)^0.38, beta_t = 0.56 beta_s + 0.1  (reference d 40 mm)
    pressfit: beta_s = 2.7 (Rm/1000)^0.43, beta_t = 0.65 beta_s                     (reference d 40 mm)
    groove (retaining ring): Kt from a shoulder approximation with t = groove depth (rough)
    plain: 1, 1."""
    if ntype == "plain":
        return 1.0, 1.0, {"Kt_b": 1.0, "Kt_t": 1.0}
    if ntype == "shoulder" or ntype == "groove":
        D, d, r = prm["D"], prm["d"], prm["r"]
        ktb, ktt = kt_shoulder(D, d, r, "bending"), kt_shoulder(D, d, r, "torsion")
        t = (D - d) / 2
        phi = 1 / (4 * math.sqrt(t / r) + 2) if t / d <= 0.25 else 0.0
        nb = support_n(2.3 * (1 + phi) / r, Re_d)
        nt = support_n(1.15 / r, Re_d)
        if ntype == "groove":
            ktb, ktt = ktb * 1.3, ktt * 1.3          # rough: a groove is sharper than a shoulder (check DIN 743-2)
        return ktb / nb, ktt / nt, {"Kt_b": ktb, "Kt_t": ktt, "n_b": nb, "n_t": nt}
    if ntype == "keyway":
        bs = 3.0 * (Rm_d / 1000) ** 0.38
        return bs, 0.56 * bs + 0.1, {}
    if ntype == "pressfit":
        bs = 2.7 * (Rm_d / 1000) ** 0.43
        return bs, 0.65 * bs, {}
    raise ValueError("unknown notch type " + ntype)

def din743_point(P, x, ntype, prm):
    """Static and fatigue safety at one cross-section (simplified DIN 743 procedure, guide chapter 7)."""
    mat = MATERIALS[P["material"]]
    d = prm["d"]
    _, di = geometry_at(P, x)
    sec = section(d, di if di < d else 0)
    k1 = K1(d, mat)
    Rm_d, Re_d = k1 * mat["Rm"], k1 * mat["Re"]
    sbW, ttW = 0.5 * mat["Rm"], 0.3 * mat["Rm"]           # specimen fatigue limits at dB (DIN 743-3 approximations)
    bs, bt, info = notch_betas(ntype, prm, Rm_d, Re_d)
    k2 = K2(d)
    kfs, kft = KF(prm.get("Rz", 6.3), Rm_d)
    KV = 1.0
    Ks = (bs / k2 + 1 / kfs - 1) / KV
    Kt = (bt / k2 + 1 / kft - 1) / KV
    sbWK = sbW * k1 / Ks
    ttWK = ttW * k1 / Kt
    psi_s = sbWK / (2 * k1 * mat["Rm"] - sbWK)
    psi_t = ttWK / (2 * k1 * mat["Rm"] - ttWK)
    it = internal(P, x)
    Mnom = it["M"]                                          # N mm (with the peak pin load)
    sba = Mnom / sec["Wb"] if P["bending_rotating"] else 0.0
    sbm = 0.0 if P["bending_rotating"] else Mnom / sec["Wb"]
    t1, t2 = sorted((P["torque_in_x"], P["torque_out_x"]))
    carries_T = t1 <= x <= t2
    tta = P["T_amp_Nm"] * 1000 / sec["Wt"] if carries_T else 0.0
    ttm = P["T_mean_Nm"] * 1000 / sec["Wt"] if carries_T else 0.0
    smv = math.sqrt(sbm ** 2 + 3 * ttm ** 2)
    tmv = smv / math.sqrt(3)
    sADK = sbWK / (1 + psi_s * smv / sba) if sba > 0 else sbWK
    tADK = ttWK / (1 + psi_t * tmv / tta) if tta > 0 else ttWK
    S_f = 1 / math.sqrt((sba / sADK) ** 2 + (tta / tADK) ** 2) if (sba or tta) else float("inf")
    # static: peak values x load factor
    LF = P["load_factor_static"]
    sbmax = LF * Mnom / sec["Wb"]
    ttmax = LF * (P["T_max_Nm"] * 1000 / sec["Wt"] if carries_T else 0.0)
    gF = 1.0 if ntype == "plain" else 1.1                  # static notch increase factor (simplified)
    K2F = 1.2
    sbFK = k1 * K2F * gF * mat["Re"]
    ttFK = k1 * K2F * gF * mat["Re"] / math.sqrt(3)
    S_s = 1 / math.sqrt((sbmax / sbFK) ** 2 + (ttmax / ttFK) ** 2) if (sbmax or ttmax) else float("inf")
    return {"x": x, "type": ntype, "d": d, "K1": k1, "K2": k2, "KFs": kfs, "KFt": kft, "beta_s": bs, "beta_t": bt,
            "K_sigma": Ks, "K_tau": Kt, "sbWK": sbWK, "ttWK": ttWK, "psi_s": psi_s, "sADK": sADK, "tADK": tADK,
            "M_Nm": Mnom / 1000, "sba": sba, "tta": tta, "ttm": ttm, "S_fatigue": S_f, "S_static": S_s,
            "ok": S_f >= P["S_min"] and S_s >= P["S_min"], **info}

def strength(P):
    return [din743_point(P, n[0], n[1], n[2]) for n in P["notches"]]

# ---------------------------------------------------------------- chapter 8: feather keys, press fits
KEYS = [  # d_from, d_to, b, h, t1 (shaft groove depth), DIN 6885-1 (common values)
    (6, 8, 2, 2, 1.2), (8, 10, 3, 3, 1.8), (10, 12, 4, 4, 2.5), (12, 17, 5, 5, 3.0), (17, 22, 6, 6, 3.5),
    (22, 30, 8, 7, 4.0), (30, 38, 10, 8, 5.0), (38, 44, 12, 8, 5.0), (44, 50, 14, 9, 5.5), (50, 58, 16, 10, 6.0),
    (58, 65, 18, 11, 7.0), (65, 75, 20, 12, 7.5), (75, 85, 22, 14, 9.0), (85, 95, 25, 14, 9.0), (95, 110, 28, 16, 10.0)]
P_ALLOW = {"steel": 150.0, "cast iron": 90.0, "aluminium": 60.0}   # typical static allowable pressure MPa (check)

def key_size(d):
    for lo, hi, b, h, t1 in KEYS:
        if lo < d <= hi:
            return {"b": b, "h": h, "t1": t1}
    raise ValueError("d outside key table")

def key_check(k):
    """Feather key, simple method (DIN 6892 method C idea): flank pressure p = 2 T K_A / (d (h - t1) l_tr),
    l_tr = l - b (round ends), shear tau = 2 T K_A / (d b l_tr). Hub material decides p_allow."""
    s = key_size(k["d"])
    ltr = k["l"] - s["b"]
    T = k["T_Nm"] * 1000 * k["K_A"]
    p = 2 * T / (k["d"] * (s["h"] - s["t1"]) * ltr)
    tau = 2 * T / (k["d"] * s["b"] * ltr)
    pa = P_ALLOW[k["hub"]]
    l_min = 2 * T / (k["d"] * (s["h"] - s["t1"]) * pa) + s["b"]
    return {**s, "l_tr": ltr, "p": p, "p_allow": pa, "S_p": pa / p, "tau": tau, "l_min": l_min}

def press_fit(f, U_um):
    """Elastic interference fit (Lame, DIN 7190 style). Effective interference after smoothing:
    U_eff = U - 0.8 (Rz_shaft + Rz_hub) (classic smoothing rule; check DIN 7190-1:2017 which uses 0.4 per part).
    xi = U_eff / d ; p = xi / (K_hub/E_hub + K_shaft/E_shaft),
    K_hub = (1 + Q_A^2)/(1 - Q_A^2) + nu, K_shaft = (1 + Q_I^2)/(1 - Q_I^2) - nu, Q_A = d/D_hub, Q_I = di/d."""
    d = f["d"]
    Ue = max(0.0, U_um - 0.8 * (f["Rz_shaft"] + f["Rz_hub"])) / 1000.0     # mm
    QA, QI = d / f["D_hub"], f["di_shaft"] / d
    KA = (1 + QA ** 2) / (1 - QA ** 2) + f["nu"]
    KI = (1 + QI ** 2) / (1 - QI ** 2) - f["nu"]
    p = (Ue / d) / (KA / f["E_hub"] + KI / f["E_shaft"])
    T = math.pi / 2 * d ** 2 * f["l"] * p * f["mu"] / 1000.0               # N m
    Fax = math.pi * d * f["l"] * p * f["mu"]                                # N
    s_hub = p * (1 + QA ** 2) / (1 - QA ** 2)                               # tangential stress at hub bore
    sv_hub = 2 * p / (1 - QA ** 2)                                          # von Mises at the hub bore (approx.)
    return {"U_eff_um": Ue * 1000, "p": p, "T_Nm": T, "F_ax_N": Fax, "sigma_t_hub": s_hub, "sv_hub": sv_hub,
            "S_hub": f["Re_hub"] / sv_hub if sv_hub else float("inf")}

def press_fit_design(f, T_req_Nm):
    """Min / max interference results + shrink temperature (hub heated) for assembly clearance 0.001 d."""
    lo, hi = press_fit(f, f["U_min_um"]), press_fit(f, f["U_max_um"])
    dT = (f["U_max_um"] / 1000 + 0.001 * f["d"]) / (f["alpha_hub"] * f["d"])
    return {"min": lo, "max": hi, "T_req": T_req_Nm, "S_slip_min": lo["T_Nm"] / T_req_Nm if T_req_Nm else None,
            "shrink_dT_K": dT}

# ---------------------------------------------------------------- chapter 2: loads from M2 (crank.py)
def loads_from_crank(pulley_d_mm=300.0, belt_factor=2.0):
    """Hand-over M2 -> M3: torque statistics and the peak crank-pin load from crank.py (default compressor).
    Belt shaft load ~ belt_factor x effective pull F_e = 2 T_max / d_p (peak torque; V-belt rule of thumb 1.5 ... 2.5,
    check the belt maker's method)."""
    import crank
    R = crank.compute_all()
    Ms = [r["M_drive"] for r in R["rows"]]
    Tm = sum(Ms) / len(Ms)
    Ta = (max(Ms) - min(Ms)) / 2
    pins = [math.hypot(*r["F_pin"]) for r in R["rows"]]
    k = pins.index(max(pins))
    Fe = 2 * max(Ms) / (pulley_d_mm / 1000)
    # T_mean = time average (power), T_mid = (T_max + T_min)/2 = mean stress level for fatigue (with T_amp)
    return {"T_mean": Tm, "T_mid": (max(Ms) + min(Ms)) / 2, "T_amp": Ta, "T_max": max(Ms), "T_min": min(Ms), "pin_max": max(pins),
            "theta_at_pin_max": math.degrees(R["rows"][k]["theta"]), "F_belt": belt_factor * Fe, "F_e": Fe}

# ---------------------------------------------------------------- report / run
def report_text(P):
    R = reactions(P)
    ds, *_ = deflection_summary(P)
    cs = critical_speed(P)
    ta = torsion_angle(P)
    st = strength(P)
    kc = key_check(P["key"])
    pf = press_fit_design(P["pressfit"], P["T_max_Nm"] * P["load_factor_static"])
    L = ["# Shaft report - %s\n" % P["name"],
         "Material %s, length %.0f mm, bearings at %s mm, %.0f rpm" % (P["material"], length(P), P["bearings"], P["rpm"]),
         "\n## Reactions [N]\n- A: y %.1f, z %.1f (resultant %.1f)\n- B: y %.1f, z %.1f (resultant %.1f)" % (
             R["y"][0], R["z"][0], math.hypot(R["y"][0], R["z"][0]), R["y"][1], R["z"][1], math.hypot(R["y"][1], R["z"][1])),
         "\n## Stiffness\n- max deflection %.4f mm at x = %.1f mm (limit %.3f)" % (ds["v_max"], ds["x_vmax"], P["deflection_limit_mm"]),
         "- slope at A %.5f rad, at B %.5f rad (limit %.4f)" % (ds["slope_A"], ds["slope_B"], P["slope_limit_rad"]),
         "- twist %.4f deg (%.3f deg/m) at T_max" % (ta["phi_deg"], ta["deg_per_m"]),
         "- critical speed (Rayleigh) %.0f rpm, Dunkerley %.0f rpm -> %.1f x operating speed" % (
             cs["n_crit_rpm"], cs["n_dunkerley_rpm"], cs["ratio"]),
         "\n## Strength (DIN 743 style, S_min %.2f)" % P["S_min"],
         "x[mm] type      d   M[Nm]  sba   tta   beta_s K_sig  sADK   S_fat  S_stat"]
    for s in st:
        L.append("%5.1f %-9s %3.0f %6.1f %5.1f %5.1f %6.2f %5.2f %6.1f %6.2f %6.2f %s" % (
            s["x"], s["type"], s["d"], s["M_Nm"], s["sba"], s["tta"], s["beta_s"], s["K_sigma"], s["sADK"],
            s["S_fatigue"], s["S_static"], "OK" if s["ok"] else "NOT OK"))
    L += ["\n## Feather key d %d: %d x %d, t1 %.1f, l_tr %.0f mm: p %.1f MPa (allow %.0f, %s hub) -> S %.2f; tau %.1f MPa; l_min %.1f mm" % (
              P["key"]["d"], kc["b"], kc["h"], kc["t1"], kc["l_tr"], kc["p"], kc["p_allow"], P["key"]["hub"], kc["S_p"],
              kc["tau"], kc["l_min"]),
          "\n## Interference fit d %d, hub %d, l %d mm" % (P["pressfit"]["d"], P["pressfit"]["D_hub"], P["pressfit"]["l"]),
          "- U_min %d um -> U_eff %.1f, p %.1f MPa, T %.1f N m (slip safety %.2f vs %.1f N m)" % (
              P["pressfit"]["U_min_um"], pf["min"]["U_eff_um"], pf["min"]["p"], pf["min"]["T_Nm"], pf["S_slip_min"], pf["T_req"]),
          "- U_max %d um -> p %.1f MPa, hub von Mises %.1f MPa (S %.2f); shrink: heat hub by %.0f K" % (
              P["pressfit"]["U_max_um"], pf["max"]["p"], pf["max"]["sv_hub"], pf["max"]["S_hub"], pf["shrink_dT_K"])]
    return "\n".join(L)

def run(P, out):
    from crank import _svg_line
    os.makedirs(out, exist_ok=True)
    ds, xs, vr, tr = deflection_summary(P)
    rows = [(x, internal(P, x)) for x in xs]
    with open(os.path.join(out, "shaft.csv"), "w", encoding="utf-8") as f:
        f.write("x_mm,D_mm,My_Nm,Mz_Nm,M_Nm,T_Nm,deflection_mm,slope_rad\n")
        for (x, it), v, t in zip(rows, vr, tr):
            f.write("%.2f,%.1f,%.4f,%.4f,%.4f,%.4f,%.6f,%.7f\n" % (x, geometry_at(P, x)[0], it["My"] / 1000, it["Mz"] / 1000,
                                                                 it["M"] / 1000, it["T"] / 1000, v, t))
    svgs = {
        "moments.svg": _svg_line([("M resultant", [(x, it["M"] / 1000) for x, it in rows], "#d62728"),
                                  ("My", [(x, it["My"] / 1000) for x, it in rows], "#1f77b4"),
                                  ("Mz", [(x, it["Mz"] / 1000) for x, it in rows], "#2ca02c"),
                                  ("T", [(x, it["T"] / 1000) for x, it in rows], "#9467bd")],
                                 title="Bending moments and torque [N m]", xl="x [mm]", yl="N m"),
        "deflection.svg": _svg_line([("deflection [um]", [(x, v * 1000) for x, v in zip(xs, vr)], "#1f77b4")],
                                    title="Resultant deflection [um]", xl="x [mm]", yl="um"),
        "geometry.svg": _svg_line([("outer contour", [(x, geometry_at(P, x)[0] / 2) for x in xs] +
                                    [(x, -geometry_at(P, x)[0] / 2) for x in reversed(xs)], "#555555")],
                                  title="Shaft geometry [mm]", xl="x [mm]", yl="r [mm]", polar=False),
    }
    for k, v in svgs.items():
        with open(os.path.join(out, k), "w", encoding="utf-8") as f:
            f.write(v)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    print(rep)
    print("written: report.md, shaft.csv,", ", ".join(svgs), "->", out)


# ================================================================ added with guide chapters (ch24)
def presize_torsion(T_Nm, tau_allow=25.0):
    """Pre-size from torsion only: tau = 16 T / (pi d^3) <= tau_allow  ->  d = (16 T / (pi tau_allow))^(1/3).
    tau_allow is LOW on purpose (20...40 MPa) because bending, notches and fatigue are not yet known."""
    return (16 * T_Nm * 1000 / (math.pi * tau_allow)) ** (1 / 3)


def presize_combined(M_Nm, T_Nm, sigma_allow=60.0):
    """Pre-size from bending + torsion (von Mises): sigma_v = 32/(pi d^3) sqrt(M^2 + 0.75 T^2) <= sigma_allow."""
    Mv = math.sqrt(M_Nm ** 2 + 0.75 * T_Nm ** 2) * 1000
    return (32 * Mv / (math.pi * sigma_allow)) ** (1 / 3), Mv / 1000


def gear_forces(T_Nm, d_mm, alpha_n_deg=20.0, beta_deg=0.0):
    """Spur / helical gear: F_t = 2 T / d, F_r = F_t tan(alpha_n) / cos(beta), F_a = F_t tan(beta)."""
    Ft = 2 * T_Nm * 1000 / d_mm
    Fr = Ft * math.tan(math.radians(alpha_n_deg)) / math.cos(math.radians(beta_deg))
    Fa = Ft * math.tan(math.radians(beta_deg))
    return {"Ft": Ft, "Fr": Fr, "Fa": Fa, "F_radial_total": math.hypot(Ft, Fr), "M_axial_Nm": Fa * d_mm / 2 / 1000}


def belt_load(T_Nm, dp_mm, factor=2.0):
    """Effective pull F_e = 2 T / d_p; shaft load ~ factor x F_e (V-belt 1.5...2.5, flat belt 2...3, chain ~1.1)."""
    Fe = 2 * T_Nm * 1000 / dp_mm
    return {"F_e": Fe, "F_shaft": factor * Fe}


def coupling_force(offset_mm, k_radial_N_per_mm):
    """Radial restoring force of a flexible coupling from parallel misalignment: F = k_r * offset (check maker data)."""
    return k_radial_N_per_mm * offset_mm


def shaft_mass(P=None):
    """Mass of the stepped shaft from the segments [kg] and its weight [N]."""
    P = P or DEFAULT
    rho = MATERIALS[P["material"]]["rho"]
    m = sum(rho * math.pi / 4 * (D ** 2 - di ** 2) * L * 1e-9 for L, D, di in P["segments"])
    return m, m * 9.81


def load_cases(T_nom_Nm, cases=(("normal", 1.0), ("peak (start, K_A)", 1.5), ("fault (blocked valve)", 2.5))):
    """Torque for each load case = factor x nominal."""
    return [(n, f, f * T_nom_Nm) for n, f in cases]


def moment_table(P=None, xs=(0, 20, 40, 50, 60, 80, 110, 140, 160, 170, 190)):
    """My, Mz, M, T [N m] and the nominal stresses at chosen x positions."""
    P = P or DEFAULT
    out = []
    for x in xs:
        it = internal(P, x)
        D, di = geometry_at(P, x)
        s = section(D, di)
        sb = it["M"] / s["Wb"]
        tt = it["T"] / s["Wt"]
        out.append((x, D, it["My"] / 1000, it["Mz"] / 1000, it["M"] / 1000, it["T"] / 1000, sb, tt,
                    math.sqrt(sb ** 2 + 3 * tt ** 2)))
    return out


def hollow_vs_solid(D, di):
    """Hollow shaft vs solid shaft of the same outer diameter: ratios of mass, I (stiffness), Wb (strength)."""
    s, h = section(D), section(D, di)
    return {"mass_ratio": h["A"] / s["A"], "I_ratio": h["I"] / s["I"], "W_ratio": h["Wb"] / s["Wb"]}


def equiv_stress(M_Nm, T_Nm, d_mm):
    """Nominal pre-check: sigma_b = M/Wb, tau_t = T/Wt, sigma_v = sqrt(sigma_b^2 + 3 tau_t^2) (MPa)."""
    s = section(d_mm)
    sb, tt = M_Nm * 1000 / s["Wb"], T_Nm * 1000 / s["Wt"]
    return sb, tt, math.sqrt(sb ** 2 + 3 * tt ** 2)


def demo_ch24():
    print("== 2 pre-sizing")
    for t in (20, 25, 40):
        print("  compressor T_max 47.8 N m, tau_allow %d MPa: d = %.2f mm" % (t, presize_torsion(47.8, t)))
    d, Mv = presize_combined(81.1, 47.8, 60)
    print("  compressor M 81.1 N m (pin peak) + T 47.8 N m, sigma_allow 60 MPa: M_v %.1f N m -> d = %.2f mm" % (Mv, d))
    print("  gearbox T 500 N m, tau_allow 25 MPa: d = %.2f mm" % presize_torsion(500, 25))
    g = gear_forces(500, 200, 20, 15)
    print("== 3 gear forces, T 500 N m, d 200 mm, alpha_n 20, beta 15: Ft %.1f Fr %.1f Fa %.1f N, radial total %.1f N, axial moment %.1f N m"
          % (g["Ft"], g["Fr"], g["Fa"], g["F_radial_total"], g["M_axial_Nm"]))
    g0 = gear_forces(500, 200, 20, 0)
    print("  spur (beta 0): Ft %.1f Fr %.1f Fa %.1f N" % (g0["Ft"], g0["Fr"], g0["Fa"]))
    d2, Mv2 = presize_combined(0.5 * g["F_radial_total"] * 0.06, 500, 60)
    print("  gearbox pre-size with M = (F_rad/2) x 60 mm = %.1f N m + T 500: d = %.2f mm" % (0.5 * g["F_radial_total"] * 0.06, d2))
    lc = loads_from_crank()
    print("== 3 hand-over M2: T_mean %.2f T_amp %.2f T_max %.2f T_min %.2f N m, pin max %.0f N at %.1f deg" % (
        lc["T_mean"], lc["T_amp"], lc["T_max"], lc["T_min"], lc["pin_max"], lc["theta_at_pin_max"]))
    for f in (1.5, 2.0, 2.5):
        b = belt_load(lc["T_max"], 300, f)
        print("  belt d_p 300 mm, T_max: F_e %.1f N, factor %.1f -> shaft load %.0f N" % (b["F_e"], f, b["F_shaft"]))
    bm = belt_load(lc["T_mean"], 300, 2.0)
    print("  same with T_mean: F_e %.1f N -> %.0f N" % (bm["F_e"], bm["F_shaft"]))
    print("  coupling offset 0.2 mm, k_r 500 N/mm: F = %.0f N" % coupling_force(0.2, 500))
    m, W = shaft_mass()
    print("  shaft mass %.3f kg, weight %.2f N (vs pin load 2684 N)" % (m, W))
    for n, f, T in load_cases(lc["T_max"]):
        print("  load case %-22s factor %.1f -> T %.1f N m" % (n, f, T))
    R = reactions(DEFAULT)
    print("== 4 reactions: A y %.1f z %.1f res %.1f N; B y %.1f z %.1f res %.1f N" % (
        R["y"][0], R["z"][0], math.hypot(*[R["y"][0], R["z"][0]]), R["y"][1], R["z"][1], math.hypot(R["y"][1], R["z"][1])))
    print("  x    D   My     Mz     M      T      sigma_b tau_t  sigma_v")
    for r in moment_table():
        print("  %3.0f %3.0f %6.2f %6.2f %6.2f %6.2f %6.2f %6.2f %6.2f" % r)
    for di in (15, 20, 25):
        h = hollow_vs_solid(35, di)
        print("  hollow 35/%d: mass %.3f, I %.3f, Wb %.3f of solid" % (di, h["mass_ratio"], h["I_ratio"], h["W_ratio"]))
    sb, tt, sv = equiv_stress(81.1, 47.8, 35)
    print("  pre-check d 35, M 81.1, T 47.8: sigma_b %.2f tau %.2f sigma_v %.2f MPa" % (sb, tt, sv))
    s = section(35, 20)
    print("  section 35/20: A %.1f mm2, I %.0f mm4, Ip %.0f mm4, Wb %.1f mm3, Wt %.1f mm3" % (s["A"], s["I"], s["Ip"], s["Wb"], s["Wt"]))

# ================================================================ added with guide chapters (ch56)
def slope_arcmin(rad):
    """Slope in arc minutes (bearing catalogues give misalignment limits in arcmin)."""
    return math.degrees(rad) * 60


def slender_example(L=800.0, d=30.0, m_disc=25.0, rpm=None):
    """A slender shaft where the critical speed matters: solid shaft d on two end bearings, heavy disc at mid-span.
    Returns the Rayleigh / Dunkerley critical speeds and the speed that is 0.7 x n_crit."""
    P = dict(DEFAULT, segments=[[L, d, 0]], bearings=[0.0, L], forces=[[L / 2, -1.0, 0.0, "unit"]],
             masses=[[L / 2, m_disc, "disc"]], step_mm=1.0)
    cs = critical_speed(P)
    return {"n_crit": cs["n_crit_rpm"], "n_dunk": cs["n_dunkerley_rpm"], "n_07": 0.7 * cs["n_crit_rpm"],
            "mass": cs["mass_total_kg"]}


def critical_speed_kb(P, k_b):
    """Rayleigh critical speed WITH bearing stiffness k_b [N/mm] (same at A and B).
    The shaft deflection line under the weight forces gets an extra rigid-body line through the bearing
    displacements RA/k_b and RB/k_b (shaft and bearings act as springs in series)."""
    rho = MATERIALS[P["material"]]["rho"]
    g = 9810.0
    lumps = []
    s = 0.0
    for L, D, di in P["segments"]:
        lumps.append((s + L / 2, rho * math.pi / 4 * (D ** 2 - di ** 2) * L * 1e-9))
        s += L
    lumps += [(m_[0], m_[1]) for m_ in P["masses"]]
    forces = [[x, -m * g / 1000.0, 0.0, "w"] for x, m in lumps]
    Q = dict(P, forces=forces)
    xs, _, v = deflection(Q, "y")
    RA, RB = reactions(Q)["y"]
    xa, xb = P["bearings"]
    ua, ub = -RA / k_b, -RB / k_b               # bearing displacement (same sign as the load = downwards)
    def at(x):
        return v[min(range(len(xs)), key=lambda i: abs(xs[i] - x))] + ua + (ub - ua) * (x - xa) / (xb - xa)
    ys = [abs(at(x)) for x, _ in lumps]
    num = sum(m * y for (x, m), y in zip(lumps, ys))
    den = sum(m * y * y for (x, m), y in zip(lumps, ys))
    return math.sqrt(g * num / den) * 60 / (2 * math.pi)


def torsional_2mass(J_motor=0.0055, ratio=2.02, J_fly=0.059, J_crank=0.003, EA_belt=1.0e5, n_belts=2,
                    span_mm=400.0, r_crank_pulley_mm=150.0):
    """Torsional natural frequency of the drive train, reduced to the crankshaft:
    J1 = J_motor * i^2 (motor rotor seen at the crank), J2 = J_fly + J_crank.
    Belt: each span is a spring k_s = n EA / L_span; with pre-tension both spans work -> k_t = 2 k_s r^2
    (r = crank pulley radius). f = 1/(2 pi) sqrt(k_t (J1 + J2) / (J1 J2)).
    EA per belt is an example value (check the belt maker; it depends on the cord material)."""
    J1 = J_motor * ratio ** 2
    J2 = J_fly + J_crank
    ks = n_belts * EA_belt / (span_mm / 1000)          # N/m
    r = r_crank_pulley_mm / 1000
    kt = 2 * ks * r * r                                 # N m / rad
    f = math.sqrt(kt * (J1 + J2) / (J1 * J2)) / (2 * math.pi)
    return {"J1": J1, "J2": J2, "k_span": ks, "k_t": kt, "f_Hz": f, "order1_Hz": 1450 / 60, "order2_Hz": 2 * 1450 / 60,
            "ratio_to_order2": f / (2 * 1450 / 60)}


def jeffcott(e_um, ratio):
    """Jeffcott rotor (no damping): whirl radius r = e (w/wn)^2 / (1 - (w/wn)^2) for unbalance eccentricity e."""
    return e_um * ratio ** 2 / (1 - ratio ** 2)


def kt_cross_hole_bending(a, D):
    """Transverse (oil) hole of diameter a in a solid shaft D, bending, nominal stress on the gross section:
    Kt = 3.0 - 3.13 (a/D) + 3.66 (a/D)^2 - 1.53 (a/D)^3 (polynomial fit of Peterson data; check Peterson / Pilkey)."""
    q = a / D
    return 3.0 - 3.13 * q + 3.66 * q * q - 1.53 * q ** 3


DIN509_TYPICAL = [  # r x t (radius x depth) mm, typical shaft diameter range (form E / F) - check DIN 509
    (0.6, 0.2, "d <= 18 (light)"), (0.6, 0.3, "> 18 ... 80"), (1.0, 0.2, "d <= 18"), (1.0, 0.4, "> 18 ... 80"),
    (1.6, 0.3, "> 18 ... 80"), (2.5, 0.4, "> 80"), (4.0, 0.5, "> 80")]


def din743_point_kv(P, x, ntype, prm, KV=1.0):
    """Same as din743_point but with a surface strengthening factor KV (rolling, shot peening, induction
    hardening). K_sigma = (beta/K2 + 1/KF - 1)/KV, then the mean-stress and safety steps are repeated."""
    pt = din743_point(P, x, ntype, prm)
    mat = MATERIALS[P["material"]]
    k1, k2 = pt["K1"], pt["K2"]
    Ks = (pt["beta_s"] / k2 + 1 / pt["KFs"] - 1) / KV
    Kt = (pt["beta_t"] / k2 + 1 / pt["KFt"] - 1) / KV
    sbWK = 0.5 * mat["Rm"] * k1 / Ks
    ttWK = 0.3 * mat["Rm"] * k1 / Kt
    psi_t = ttWK / (2 * k1 * mat["Rm"] - ttWK)
    tmv = math.sqrt(3 * pt["ttm"] ** 2) / math.sqrt(3)
    sADK = sbWK                                       # rotating bending: no bending mean stress
    tADK = ttWK / (1 + psi_t * tmv / pt["tta"]) if pt["tta"] > 0 else ttWK
    S = 1 / math.sqrt((pt["sba"] / sADK) ** 2 + (pt["tta"] / tADK) ** 2)
    return {"K_sigma": Ks, "sADK": sADK, "S_fatigue": S}


def radius_table(radii=(0.4, 0.6, 1.0, 1.6, 2.5)):
    """Fatigue safety at the 30/25 shoulder (x = 40 mm, default compressor shaft) versus fillet radius."""
    P = dict(DEFAULT)
    out = []
    for r in radii:
        pt = din743_point(P, 40.0, "shoulder", {"D": 30, "d": 25, "r": r, "Rz": 6.3})
        out.append((r, pt["Kt_b"], pt["n_b"], pt["beta_s"], pt["K_sigma"], pt["sADK"], pt["S_fatigue"]))
    return out


def slender_stress_case():
    """Same 30/25 shoulder, but loads x 6 (a heavier drive) to show where the design limit is reached."""
    P = dict(DEFAULT, forces=[[f[0], 6 * f[1], 6 * f[2], f[3]] for f in DEFAULT["forces"]],
             T_mean_Nm=6 * DEFAULT["T_mean_Nm"], T_amp_Nm=6 * DEFAULT["T_amp_Nm"], T_max_Nm=6 * DEFAULT["T_max_Nm"])
    rows = []
    for r in (0.4, 1.0, 2.5):
        a = din743_point(P, 40.0, "shoulder", {"D": 30, "d": 25, "r": r, "Rz": 6.3})
        b = din743_point_kv(P, 40.0, "shoulder", {"D": 30, "d": 25, "r": r, "Rz": 6.3}, KV=1.3)
        rows.append((r, a["S_fatigue"], b["S_fatigue"]))
    return rows


def demo_ch56():
    P = dict(DEFAULT)
    print("== 5.2 stepped shaft deflection (default compressor shaft)")
    ds, xs, vr, tr = deflection_summary(P)
    print("  max deflection %.4f mm at x = %.1f mm; slope A %.5f rad = %.2f arcmin, B %.5f rad = %.2f arcmin" % (
        ds["v_max"], ds["x_vmax"], ds["slope_A"], slope_arcmin(ds["slope_A"]), ds["slope_B"], slope_arcmin(ds["slope_B"])))
    for k, v in ds.items():
        if k.startswith("v_at_"):
            print("  deflection at load '%s': %.4f mm" % (k[5:], v))
    print("== 5.4 twist")
    ta = torsion_angle(P)
    print("  phi %.5f rad = %.4f deg over the torque-carrying length, %.3f deg/m" % (ta["phi_rad"], ta["phi_deg"], ta["deg_per_m"]))
    print("== 5.5 critical speed")
    cs = critical_speed(P)
    print("  compressor shaft: Rayleigh %.0f rpm, Dunkerley %.0f rpm, mass %.3f kg, ratio to 1450 rpm %.1f" % (
        cs["n_crit_rpm"], cs["n_dunkerley_rpm"], cs["mass_total_kg"], cs["ratio"]))
    se = slender_example()
    print("  slender shaft L 800, d 30, disc 25 kg mid-span: Rayleigh %.0f rpm, Dunkerley %.0f rpm, 0.7 n_crit = %.0f rpm, mass %.2f kg" % (
        se["n_crit"], se["n_dunk"], se["n_07"], se["mass"]))
    Ps = dict(DEFAULT, segments=[[800.0, 30.0, 0]], bearings=[0.0, 800.0], forces=[[400.0, -1.0, 0.0, "u"]],
              masses=[[400.0, 25.0, "disc"]], step_mm=1.0)
    for kb in (1e6, 2e5, 5e4, 2e4):
        print("  slender shaft with bearing stiffness %.0e N/mm: n_crit %.0f rpm" % (kb, critical_speed_kb(Ps, kb)))
    for kb in (2e5, 5e4):
        print("  compressor shaft with bearing stiffness %.0e N/mm: n_crit %.0f rpm" % (kb, critical_speed_kb(P, kb)))
    for q in (0.5, 0.7, 0.9, 1.2, 2.0):
        print("  Jeffcott e = 10 um, w/wn = %.1f: whirl radius %.1f um" % (q, jeffcott(10, q)))
    tw = torsional_2mass()
    print("  torsional: J1 (motor at crank) %.4f, J2 %.4f kg m2, belt span k %.3e N/m, k_t %.0f N m/rad -> f %.1f Hz"
          " (orders %.1f / %.1f Hz, f / 2nd order = %.1f)" % (tw["J1"], tw["J2"], tw["k_span"], tw["k_t"], tw["f_Hz"],
                                                            tw["order1_Hz"], tw["order2_Hz"], tw["ratio_to_order2"]))
    tw2 = torsional_2mass(EA_belt=1.0e4, n_belts=1)
    print("  same with one soft belt (EA 1e4 N): k_t %.0f N m/rad -> f %.1f Hz (f / 2nd order %.2f)" % (
        tw2["k_t"], tw2["f_Hz"], tw2["ratio_to_order2"]))
    print("== 6.2 Kt of the shoulder 30/25 versus radius (bending)")
    print("  r     Kt_b   n_b    beta_s K_sigma sADK   S_fat")
    for r, kt, nb, bs, Ks, sA, S in radius_table():
        print("  %.1f  %.3f  %.3f  %.3f  %.3f  %6.1f  %.2f" % (r, kt, nb, bs, Ks, sA, S))
    print("== 6.6 cross hole (oil hole) in bending, D = 35 mm")
    for a in (3, 5, 7, 10):
        print("  a %2d mm (a/D %.3f): Kt %.3f" % (a, a / 35, kt_cross_hole_bending(a, 35)))
    print("== 6.8 heavier drive (loads x 6): S_fatigue at the 30/25 shoulder without / with KV = 1.3 (rolled)")
    for r, s1, s2 in slender_stress_case():
        print("  r %.1f: S %.2f -> %.2f" % (r, s1, s2))
    print("== 6.7 DIN 509 relief grooves (typical r x t, check DIN 509)")
    for r, t, rng in DIN509_TYPICAL:
        print("  r %.1f x t %.1f  %s" % (r, t, rng))

# ================================================================ added with guide chapters (ch711)
# ---------------------------------------------------------------- chapter 7: sensitivity, comparisons, crankshaft
def critical_notch(P):
    """Notch with the lowest fatigue safety."""
    return min(strength(P), key=lambda s: s["S_fatigue"])

def sensitivity_study(x=40.0):
    """Fatigue safety at the shoulder x = 40 mm (D/d 30/25, r 1.0) for material, roughness and load level."""
    base = dict(DEFAULT)
    n = [k for k in base["notches"] if abs(k[0] - x) < 1e-9][0]
    rows = []
    for mat in ("C45+N", "C45+QT", "42CrMo4+QT"):
        for Rz in (1.6, 6.3, 25.0):
            for lf in (1, 2, 3):
                P = dict(base, material=mat,
                         forces=[[f[0], f[1] * lf, f[2] * lf, f[3]] for f in base["forces"]],
                         T_mean_Nm=base["T_mean_Nm"] * lf, T_amp_Nm=base["T_amp_Nm"] * lf, T_max_Nm=base["T_max_Nm"] * lf)
                prm = dict(n[2], Rz=Rz)
                s = din743_point(P, x, n[1], prm)
                rows.append((mat, Rz, lf, s["S_fatigue"], s["S_static"], s["K_sigma"], s["sADK"]))
    return rows

def shigley_compare(x=40.0):
    """Same section with the M1 method (Shigley/Marin + Goodman, dm_toolkit.marin_goodman) for comparison.
    Kf = 1 + q (Kt - 1) with Peterson q (dm_strength.peterson_q); von Mises equivalent amplitude / mean."""
    from dm_toolkit import marin_goodman
    from dm_strength import peterson_q
    P = dict(DEFAULT)
    s = din743_point(P, x, "shoulder", {"D": 30, "d": 25, "r": 1.0, "Rz": 6.3})
    mat = MATERIALS[P["material"]]
    _, q = peterson_q(mat["Rm"], 1.0)
    Kfb = 1 + q * (s["Kt_b"] - 1)
    Kft = 1 + q * (s["Kt_t"] - 1)
    sa = math.sqrt((Kfb * s["sba"]) ** 2 + 3 * (Kft * s["tta"]) ** 2)
    sm = math.sqrt(3) * Kft * s["ttm"]
    r = marin_goodman(mat["Rm"], mat["Re"], 25, sa, sm, "machined", 99)
    return {"q": q, "Kf_b": Kfb, "Kf_t": Kft, "sa_eq": sa, "sm_eq": sm, "Se": r["Se"], "n_f": r["n_fatigue"],
            "din743_S": s["S_fatigue"]}

def fkm_compare(x=40.0):
    """FKM local approach (dm_strength.fkm_local, bending only) at the shoulder: local stresses = Kt x nominal."""
    from dm_strength import fkm_local
    P = dict(DEFAULT)
    s = din743_point(P, x, "shoulder", {"D": 30, "d": 25, "r": 1.0, "Rz": 6.3})
    mat = MATERIALS[P["material"]]
    k1 = s["K1"]
    G = 2.3 / 1.0                                       # relative stress gradient of the fillet, r = 1 mm
    sa_loc = s["Kt_b"] * s["sba"]
    r = fkm_local(k1 * mat["Rm"], k1 * mat["Re"], sa_loc, 0.0, 1.5 * sa_loc, G, 6.3)
    return {"sa_local": sa_loc, "sigma_AK": r["sigma_AK"], "a_BK": r["a_BK"], "S_equiv": 1 / r["a_BK"] * 1.5,
            "n_sigma": r["n_sigma"]}

def web_fillet_check(Kt, r=1.5, d=30.0, Rz=1.6, KV=1.0, M_scale=1.0):
    """Crank-pin / web fillet estimate: nominal bending amplitude of the pin section from the straight-beam model
    (moment at the pin x = 110 mm) on the pin diameter d, with an assumed Kt (2.5 ... 4 typical for web fillets,
    check FEA). KV = surface treatment factor (rolling, nitriding; typical, check DIN 743-2)."""
    P = dict(DEFAULT)
    mat = MATERIALS[P["material"]]
    M = internal(P, 110.0)["M"] * M_scale
    sba = M / section(d)["Wb"]
    k1 = K1(d, mat)
    n = support_n(2.3 / r, k1 * mat["Re"])
    beta = Kt / n
    kfs, _ = KF(Rz, k1 * mat["Rm"])
    Ks = (beta / K2(d) + 1 / kfs - 1) / KV
    sWK = 0.5 * mat["Rm"] * k1 / Ks
    return {"Kt": Kt, "KV": KV, "sba": sba, "beta": beta, "K_sigma": Ks, "sWK": sWK, "S": sWK / sba}

# ---------------------------------------------------------------- chapter 8: corrected interference fit
ISO_30 = {   # deviations in um for nominal 24 < d <= 30 (ISO 286-2; check the table): hole H7, shafts
    "H7": (0, 21), "p6": (22, 35), "r6": (28, 41), "s6": (35, 48), "u6": (48, 61)}

def fit_interference(shaft_fit, hole="H7"):
    EI, ES = ISO_30[hole]
    ei, es = ISO_30[shaft_fit]
    return ei - ES, es - EI                             # U_min, U_max [um]

def press_fit_fix(T_req=71.7, S_slip=1.5, dT_max=200.0, mu_press=0.08):
    """Search ISO fits x lengths x shaft roughness for S_slip >= 1.5 at U_min, hub S >= 1.2 at U_max and
    shrink temperature <= dT_max (else press-in force). Returns all rows and the lightest acceptable design."""
    base = dict(DEFAULT["pressfit"])
    rows = []
    for fit in ("p6", "r6", "s6", "u6"):
        Umin, Umax = fit_interference(fit)
        for l in (16, 20, 25, 30):
            for Rz_s in (3.2, 1.6):
                f = dict(base, l=l, Rz_shaft=Rz_s, U_min_um=Umin, U_max_um=Umax)
                lo, hi = press_fit(f, Umin), press_fit(f, Umax)
                dT = (Umax / 1000 + 0.001 * f["d"]) / (f["alpha_hub"] * f["d"])
                F_press = math.pi * f["d"] * l * hi["p"] * mu_press
                ok = lo["T_Nm"] / T_req >= S_slip and hi["S_hub"] >= 1.2
                rows.append({"fit": "H7/" + fit, "l": l, "Rz_shaft": Rz_s, "U": (Umin, Umax), "S_slip": lo["T_Nm"] / T_req,
                             "S_hub": hi["S_hub"], "dT": dT, "F_press_kN": F_press / 1000, "ok": ok,
                             "shrink_ok": dT <= dT_max})
    good = [r for r in rows if r["ok"]]
    best = min(good, key=lambda r: (r["l"], r["U"][1])) if good else None
    return rows, best

# ---------------------------------------------------------------- chapter 11: redesign example
REDESIGN = {
    "name": "VC20 crankshaft - lighter redesign (example)",
    "segments": [[40, 20, 0], [20, 25, 0], [100, 28, 0], [20, 25, 0], [10, 20, 0]],
    "notches": [[40.0, "shoulder", {"D": 25, "d": 20, "r": 1.0, "Rz": 6.3}],
                [60.0, "shoulder", {"D": 28, "d": 25, "r": 1.0, "Rz": 6.3}],
                [20.0, "keyway", {"d": 20, "Rz": 6.3}],
                [50.0, "pressfit", {"d": 25, "Rz": 3.2}],
                [160.0, "shoulder", {"D": 28, "d": 25, "r": 1.0, "Rz": 6.3}],
                [110.0, "plain", {"d": 28, "Rz": 3.2}]],
    "key": {"d": 20, "l": 32, "hub": "cast iron", "T_Nm": 47.8, "K_A": 1.25},
}

def redesign():
    P = dict(DEFAULT)
    P.update(REDESIGN)
    st = strength(P)
    ds, *_ = deflection_summary(P)
    cs = critical_speed(P)
    kc = key_check(P["key"])
    mass = lambda Q: sum(7850 * math.pi / 4 * (D ** 2 - di ** 2) * L * 1e-9 for L, D, di in Q["segments"])  # noqa: E731
    return {"S_fat_min": min(s["S_fatigue"] for s in st), "S_stat_min": min(s["S_static"] for s in st),
            "v_max": ds["v_max"], "slope_A": ds["slope_A"], "slope_B": ds["slope_B"], "n_crit": cs["n_crit_rpm"],
            "key": kc, "mass_new": mass(P), "mass_old": mass(DEFAULT), "table": st}

# ---------------------------------------------------------------- demo
def demo_ch711():
    P = dict(DEFAULT)
    c = critical_notch(P)
    print("== 7 critical notch: x %.1f mm %s d %d: K1 %.3f K2 %.3f KFs %.3f beta_s %.3f K_sigma %.3f sbWK %.1f psi_s %.4f"
          " sADK %.1f tADK %.1f sba %.2f tta %.2f ttm %.2f -> S_fat %.2f, S_stat %.2f" % (
              c["x"], c["type"], c["d"], c["K1"], c["K2"], c["KFs"], c["beta_s"], c["K_sigma"], c["sbWK"], c["psi_s"],
              c["sADK"], c["tADK"], c["sba"], c["tta"], c["ttm"], c["S_fatigue"], c["S_static"]))
    print("   Kt_b %.3f n_b %.3f Kt_t %.3f n_t %.3f" % (c["Kt_b"], c["n_b"], c["Kt_t"], c["n_t"]))
    print("== 7 sensitivity at x = 40 (material, Rz, load factor): S_fat, S_stat, K_sigma, sADK")
    for r in sensitivity_study():
        print("   %-11s Rz %4.1f x%d : S_fat %6.2f  S_stat %6.2f  K_sig %.3f  sADK %6.1f" % r)
    sh = shigley_compare()
    print("== 7 M1 Shigley/Marin at x = 40: q %.3f Kf_b %.3f Kf_t %.3f sa_eq %.2f sm_eq %.2f Se %.1f -> n_f %.2f (DIN 743 style S %.2f)"
          % (sh["q"], sh["Kf_b"], sh["Kf_t"], sh["sa_eq"], sh["sm_eq"], sh["Se"], sh["n_f"], sh["din743_S"]))
    fk = fkm_compare()
    print("== 7 FKM local (bending) at x = 40: local amplitude %.2f MPa, sigma_AK %.1f MPa, utilisation a_BK %.3f (j_D 1.5)"
          " -> equivalent safety %.2f, n_sigma %.3f" % (fk["sa_local"], fk["sigma_AK"], fk["a_BK"], fk["S_equiv"], fk["n_sigma"]))
    print("== 7 crank-pin web fillet estimate (d 30, r 1.5, Rz 1.6), straight-beam moment at x = 110:")
    for Kt in (2.5, 3.0, 4.0):
        for KV in (1.0, 1.3):
            w = web_fillet_check(Kt, KV=KV)
            print("   Kt %.1f KV %.1f: sba %.2f MPa beta %.3f K_sigma %.3f sWK %.1f -> S %.2f" % (
                Kt, KV, w["sba"], w["beta"], w["K_sigma"], w["sWK"], w["S"]))
    w = web_fillet_check(4.0, KV=1.0, M_scale=3.0)
    print("   worst case Kt 4, moment x3 (webs, real crank geometry, fault): S %.2f" % w["S"])
    k = key_check(P["key"])
    print("== 8 key d 25: b %d h %d t1 %.1f l_tr %d p %.1f tau %.1f S_p %.2f l_min %.1f" % (
        k["b"], k["h"], k["t1"], k["l_tr"], k["p"], k["tau"], k["S_p"], k["l_min"]))
    for hub in ("steel", "cast iron", "aluminium"):
        kk = key_check(dict(P["key"], hub=hub))
        print("   hub %-9s p_allow %.0f -> S_p %.2f, l_min %.1f mm" % (hub, kk["p_allow"], kk["S_p"], kk["l_min"]))
    rows, best = press_fit_fix()
    print("== 8 interference fit search d 30 / hub 55 (T_req 71.7 N m, S_slip >= 1.5, hub S >= 1.2):")
    for r in rows:
        if r["Rz_shaft"] == 1.6 or r["fit"] == "H7/s6":
            print("   %-6s l %2d Rz_s %.1f U %2d..%2d um: S_slip %.2f S_hub %.2f dT %.0f K F_press %.1f kN %s" % (
                r["fit"], r["l"], r["Rz_shaft"], r["U"][0], r["U"][1], r["S_slip"], r["S_hub"], r["dT"], r["F_press_kN"],
                "OK" if r["ok"] else "-"))
    print("   chosen:", best["fit"], "l", best["l"], "Rz_shaft", best["Rz_shaft"], "U", best["U"],
          "S_slip %.2f S_hub %.2f dT %.0f K F_press %.1f kN" % (best["S_slip"], best["S_hub"], best["dT"], best["F_press_kN"]))
    rd = redesign()
    print("== 11 redesign: S_fat_min %.2f S_stat_min %.2f v_max %.4f mm slope A %.5f B %.5f rad n_crit %.0f rpm;"
          " key p %.1f MPa S %.2f; mass %.3f -> %.3f kg (%.1f %%)" % (
              rd["S_fat_min"], rd["S_stat_min"], rd["v_max"], rd["slope_A"], rd["slope_B"], rd["n_crit"], rd["key"]["p"],
              rd["key"]["S_p"], rd["mass_old"], rd["mass_new"], 100 * (rd["mass_new"] / rd["mass_old"] - 1)))
    for s in rd["table"]:
        print("   x %5.1f %-9s d %2d: S_fat %6.2f S_stat %6.2f" % (s["x"], s["type"], s["d"], s["S_fatigue"], s["S_static"]))
    for l in (36, 40):
        kk = key_check(dict(REDESIGN["key"], l=l))
        print("   key fix d 20 (6 x 6): l %d -> l_tr %d p %.1f MPa S_p %.2f (l_min %.1f)" % (l, kk["l_tr"], kk["p"], kk["S_p"], kk["l_min"]))

# ---------------------------------------------------------------- examples / selftest
def cmd_examples():
    P = dict(DEFAULT)
    lc = loads_from_crank()
    print("## Hand-over from M2 (crank.py default compressor)")
    print("  torque time-average %.2f (power), mid-range %.2f + amplitude %.2f (fatigue), max %.2f, min %.2f N m;"
          " crank-pin load max %.0f N at theta %.1f deg;"
          " belt: F_e %.1f N, shaft load %.0f N" % (lc["T_mean"], lc["T_mid"], lc["T_amp"], lc["T_max"], lc["T_min"], lc["pin_max"],
                                                     lc["theta_at_pin_max"], lc["F_e"], lc["F_belt"]))
    print()
    print(report_text(P))
    print("\n## Kt of the shoulder fillet D/d = 30/25 vs radius")
    for r in (0.4, 0.6, 1.0, 1.6, 2.5):
        print("  r %.1f mm: Kt bending %.3f, torsion %.3f" % (r, kt_shoulder(30, 25, r), kt_shoulder(30, 25, r, "torsion")))
    print("\n## DIN 743 factors for C45+QT")
    for d in (16, 25, 40, 80, 160):
        print("  d %3d: K1 %.3f  K2 %.3f  KF(Rz 6.3) %.3f / %.3f" % (d, K1(d, None), K2(d), *KF(6.3, 700 * K1(d, None))))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-62s %s %s" % (name, "OK  " if cond else "FAIL", info))
    P = dict(DEFAULT)
    # 1 equilibrium
    R = reactions(P)
    for k, idx in (("y", 1), ("z", 2)):
        Fs = sum(f[idx] for f in P["forces"]) + R[k][0] + R[k][1]
        Ms = sum(f[idx] * f[0] for f in P["forces"]) + R[k][0] * P["bearings"][0] + R[k][1] * P["bearings"][1]
        chk("equilibrium plane %s: sum F = 0, sum M = 0" % k, abs(Fs) < 1e-9 and abs(Ms) < 1e-6)
    # 2 moment at the right end = 0
    chk("bending moment beyond the last load = 0", abs(internal(P, length(P))["M"]) < 1e-6)
    # 3 uniform shaft, central load: deflection = F L^3 / (48 E I), slope = F L^2/(16 E I)
    U = dict(P, segments=[[200, 30, 0]], bearings=[0.0, 200.0], forces=[[100.0, -1000.0, 0.0, "F"]], step_mm=0.25)
    xs, th, v = deflection(U, "y")
    I = section(30)["I"]
    ex = 1000 * 200 ** 3 / (48 * 210000 * I)
    chk("uniform beam, central load: v_max = F L^3/(48 E I) (+-0.1 %)", abs(abs(min(v)) / ex - 1) < 1e-3,
        "%.6f vs %.6f mm" % (abs(min(v)), ex))
    chk("uniform beam: slope at support = F L^2/(16 E I) (+-0.2 %)", abs(abs(th[0]) / (1000 * 200 ** 2 / (16 * 210000 * I)) - 1) < 2e-3)
    # 4 overhung load: tip deflection F a^2 (L + a)/(3 E I)
    O = dict(P, segments=[[250, 30, 0]], bearings=[0.0, 200.0], forces=[[250.0, -500.0, 0.0, "tip"]], step_mm=0.25)
    xs, th, v = deflection(O, "y")
    ex2 = 500 * 50 ** 2 * (200 + 50) / (3 * 210000 * I)
    chk("overhung load: tip deflection = F a^2 (L + a)/(3 E I) (+-0.2 %)", abs(abs(v[-1]) / ex2 - 1) < 2e-3,
        "%.6f vs %.6f mm" % (abs(v[-1]), ex2))
    # 5 critical speed: massless-shaft approximation with one big central mass ~ sqrt(k/m)
    C = dict(U, masses=[[100.0, 20.0, "disc"]], material="C45+QT")
    cs = critical_speed(C)
    k = 48 * 210000 * I / 200 ** 3 * 1000           # N/m
    m_eff = 20 + 0.4857 * MATERIALS["C45+QT"]["rho"] * section(30)["A"] * 200 * 1e-9   # Rayleigh effective shaft mass
    n_ex = math.sqrt(k / m_eff) * 60 / (2 * math.pi)
    chk("critical speed: Rayleigh = sqrt(k/m_eff) for a central disc (+-2 %)", abs(cs["n_crit_rpm"] / n_ex - 1) < 0.02,
        "%.0f vs %.0f rpm" % (cs["n_crit_rpm"], n_ex))
    chk("Dunkerley <= Rayleigh (lower bound)", cs["n_dunkerley_rpm"] <= cs["n_crit_rpm"] * 1.0001)
    # 6 factors
    chk("K2(7.5) = 1, K2(150) = 0.8", abs(K2(7.5) - 1) < 1e-12 and abs(K2(150) - 0.8) < 1e-12)
    chk("Kt decreases with larger fillet radius", kt_shoulder(30, 25, 0.5) > kt_shoulder(30, 25, 1.0) > kt_shoulder(30, 25, 2.0))
    # 7 press fit: same E, solid shaft -> p = E U/(2d) (1 - Q^2)  (compare with dm_embody.lame_pressure if present)
    f = dict(P["pressfit"], Rz_shaft=0, Rz_hub=0)
    r1 = press_fit(f, 30)
    exp = 210000 * 0.030 / (2 * 30) * (1 - (30 / 55) ** 2)
    chk("press fit: Lame p = E U/(2 d)(1 - Q^2) for equal E, solid shaft", abs(r1["p"] / exp - 1) < 1e-9,
        "%.3f vs %.3f MPa" % (r1["p"], exp))
    # 8 key table + check consistency: l_min gives S = 1
    kc = key_check(dict(P["key"], l=key_check(P["key"])["l_min"]))
    chk("key: at l = l_min the pressure safety is 1", abs(kc["S_p"] - 1) < 1e-9)
    # 9 hand-over from crank.py consistent with M2 guide numbers
    lc = loads_from_crank()
    chk("M2 hand-over: T_mean 10.41, T_max 47.77, pin max 2684 N", abs(lc["T_mean"] - 10.41) < 0.01 and
        abs(lc["T_max"] - 47.77) < 0.01 and abs(lc["pin_max"] - 2684) < 1, "%.2f %.2f %.0f" % (lc["T_mean"], lc["T_max"], lc["pin_max"]))
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
        out = "shaft_out"
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
