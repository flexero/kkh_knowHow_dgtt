#!/usr/bin/env python3
"""M2 crank mechanism program - V-type 2-cylinder single-acting piston air compressor (and any slider-crank).

Python standard library only (offline). Every number of guide 02_crank_mechanism.md comes from this file.

Commands
  python crank.py params                 print the default input (JSON) - copy, edit, use with --in
  python crank.py run [--in p.json] [--out folder]   full calculation -> report.md, crank.csv, *.svg
  python crank.py examples               print the worked examples of the guide (default input)
  python crank.py selftest               independent cross-checks (must print SELFTEST PASS)
  python crank.py ch24 | ch58 | ch913    extra results of guide chapters 2-4, 5-8, 9-12

Sign conventions (guide chapter 2)
  theta  crank angle, measured from the vertical (V bisector), positive in the direction of rotation
  phi_i  crank angle seen by cylinder i:  phi_i = theta - gamma_i  (phi_i = 0 -> piston i at TDC)
  s      distance crank centre -> piston pin (largest at TDC)
  x      piston travel from TDC = r + l - s
  F_gas  > 0 pushes the piston towards the crank;  S (rod force) > 0 = compression
  M_drive  torque the motor must give to the crankshaft (positive = motor drives)
All default numbers are EXAMPLE values.
"""
import json
import math
import random
import os
import sys

DEFAULT = {
    "name": "VC20 example - V90 two-cylinder, single-stage",
    "bore_mm": 65.0,             # D
    "stroke_mm": 46.0,           # s = 2 r
    "rod_mm": 90.0,              # l, conrod centre distance
    "n_cyl": 2,
    "cyl_angles_deg": [-45.0, 45.0],   # gamma_i of each cylinder axis from the vertical
    "rpm": 1450.0,
    "p_amb_MPa": 0.1013,         # suction / ambient absolute
    "p_dis_gauge_MPa": 0.8,      # discharge, gauge
    "p_crankcase_MPa": 0.1013,   # pressure under the piston (open crankcase)
    "dp_suction_rel": 0.05,      # suction valve loss as share of p_amb
    "dp_discharge_rel": 0.05,    # discharge valve loss as share of discharge abs pressure
    "clearance_ratio": 0.05,     # c = V_clearance / V_swept
    "n_compression": 1.30,       # polytropic exponents
    "n_expansion": 1.20,
    "lambda_T": 0.92,            # heating + leakage factor for FAD
    "m_piston_kg": 0.30,         # piston + pin + rings + clips, per cylinder
    "m_rod_kg": 0.25,            # conrod complete with bolts and bearing shells
    "rod_cg_from_bigend_mm": 30.0,
    "J_rod_cg_kgm2": 3.6e-4,     # conrod moment of inertia about its CG (for the 3-mass check)
    "m_crank_unbal_kg": 0.40,    # crank pin + web unbalance reduced to radius r (without counterweight)
    "cw_balance_share": 1.0,     # counterweight: share of (m_rot + m_osc) balanced, V90 -> 1.0 kills primary
    "rod_offset_mm": 22.0,       # axial distance between the two conrods on the pin (rocking couple)
    "speed_fluct_coeff": 0.02,   # delta = (w_max - w_min) / w_mean allowed
    "belt_ratio": 2.02,          # motor speed / crank speed (2930 / 1450)
    "J_motor_kgm2": 0.0055,      # motor rotor (example 3 kW 2-pole)
    "pin_d_mm": 30.0, "pin_b_mm": 2 * 18.0,     # crank-pin diameter, total bearing width of both rods
    "rod_bearing_b_mm": 18.0,
    "crank_rotor_mass_kg": 3.0,  # crankshaft with counterweights, for ISO 21940-11
    "balance_grade_G": 6.3,
    "deck_stack": {              # TDC gap stack (piston top to valve plate), +/- tolerances mm
        "nominal_gap_mm": 0.60,
        "tol_mm": {"crank radius": 0.02, "rod centre distance": 0.03, "piston compression height": 0.03,
                    "block deck height": 0.05, "gasket thickness": 0.05, "bearing clearances": 0.02}},
    "step_deg": 0.5,
}

# ---------------------------------------------------------------- chapter 3: kinematics
def kin(phi, r, l, w):
    """Exact slider-crank kinematics. phi rad, r l m, w rad/s.
    Returns s, x, ds/dphi, d2s/dphi2, piston velocity v (= ds/dt) m/s, acceleration a (= d2s/dt2) m/s2, beta rad."""
    sp, cp = math.sin(phi), math.cos(phi)
    root = math.sqrt(l * l - (r * sp) ** 2)
    s = r * cp + root
    ds = -r * sp - r * r * sp * cp / root
    d2s = -r * cp - r * r * math.cos(2 * phi) / root - (r ** 4) * sp * sp * cp * cp / root ** 3
    beta = math.asin(r * sp / l)
    return {"s": s, "x": r + l - s, "ds": ds, "d2s": d2s, "v": ds * w, "a": d2s * w * w, "beta": beta}

def kin_series(phi, r, l, w):
    """Fourier (series) approximation, 2 terms: x = r[(1-cos phi) + lam/2 sin^2 phi],
    a(towards crank) = r w^2 (cos phi + lam cos 2phi)."""
    lam = r / l
    x = r * ((1 - math.cos(phi)) + lam / 2 * math.sin(phi) ** 2)
    a_tc = r * w * w * (math.cos(phi) + lam * math.cos(2 * phi))
    return x, a_tc

# ---------------------------------------------------------------- chapter 4: thermodynamics
def gas_pressure(phi, P, geo):
    """Ideal-valve compressor cycle with constant valve losses. Returns absolute pressure Pa at crank angle phi."""
    A, Vs, Vc, r, l = geo["A"], geo["Vs"], geo["Vc"], geo["r"], geo["l"]
    ps = P["p_amb_MPa"] * 1e6 * (1 - P["dp_suction_rel"])
    pd_abs = (P["p_amb_MPa"] + P["p_dis_gauge_MPa"]) * 1e6
    pd = pd_abs * (1 + P["dp_discharge_rel"])
    ph = phi % (2 * math.pi)
    V = Vc + A * kin(ph, r, l, 1.0)["x"]
    if ph <= math.pi:                       # expansion then suction (TDC -> BDC)
        p = pd * (Vc / V) ** P["n_expansion"]
        return max(p, ps)
    p = ps * ((Vc + Vs) / V) ** P["n_compression"]   # compression then discharge (BDC -> TDC)
    return min(p, pd)

def geometry(P):
    r = P["stroke_mm"] / 2000.0
    l = P["rod_mm"] / 1000.0
    A = math.pi / 4 * (P["bore_mm"] / 1000.0) ** 2
    Vs = A * 2 * r
    return {"r": r, "l": l, "lam": r / l, "A": A, "Vs": Vs, "Vc": P["clearance_ratio"] * Vs,
            "w": P["rpm"] * 2 * math.pi / 60.0}

def cycle(P, geo, n=2880):
    """Numerical p-V loop of one cylinder: indicated work (J), volumetric efficiency, FAD."""
    A, Vs, Vc, r, l = geo["A"], geo["Vs"], geo["Vc"], geo["r"], geo["l"]
    W, Vprev, pprev = 0.0, None, None
    pts = []
    ps = P["p_amb_MPa"] * 1e6 * (1 - P["dp_suction_rel"])
    v_suc_start = None
    for k in range(n + 1):
        ph = 2 * math.pi * k / n
        V = Vc + A * kin(ph, r, l, 1.0)["x"]
        p = gas_pressure(ph, P, geo)
        pts.append((V, p))
        if Vprev is not None:
            W += 0.5 * (p + pprev) * (Vprev - V)      # work done ON the gas = -int p dV
        if v_suc_start is None and ph <= math.pi and p <= ps * (1 + 1e-12) and k > 0:
            v_suc_start = V
        Vprev, pprev = V, p
    pd_abs = (P["p_amb_MPa"] + P["p_dis_gauge_MPa"]) * 1e6
    pd = pd_abs * (1 + P["dp_discharge_rel"])
    # analytic suction start: pd (Vc/V)^ne = ps
    V1 = Vc * (pd / ps) ** (1 / P["n_expansion"])
    lam_V = (Vc + Vs - V1) / Vs                         # volumetric (clearance) efficiency
    lam_p = ps / (P["p_amb_MPa"] * 1e6)                 # pressure factor (suction loss)
    lam_total = lam_V * lam_p * P["lambda_T"]
    fad_m3h = lam_total * Vs * P["n_cyl"] * P["rpm"] * 60
    P_ind = W * P["rpm"] / 60 * P["n_cyl"]
    # isothermal reference power for efficiency
    p1 = P["p_amb_MPa"] * 1e6
    q = fad_m3h / 3600
    P_iso = p1 * q * math.log(pd_abs / p1)
    return {"W_cyl_J": W, "V1": V1, "lam_V": lam_V, "lam_p": lam_p, "lam_total": lam_total,
            "fad_m3h": fad_m3h, "disp_m3h": Vs * P["n_cyl"] * P["rpm"] * 60, "P_ind_W": P_ind,
            "P_iso_W": P_iso, "eta_iso_ind": P_iso / P_ind, "pv": pts,
            "lam_V_ideal_formula": 1 - P["clearance_ratio"] * ((pd / ps) ** (1 / P["n_expansion"]) - 1)}

# ---------------------------------------------------------------- chapter 5: masses
def masses(P):
    """Two-mass conrod split + 3-mass correction term. Returns m_osc, m_rot per cylinder and checks."""
    l = P["rod_mm"] / 1000
    a = P["rod_cg_from_bigend_mm"] / 1000      # CG from big end
    b = l - a                                   # CG from small end
    m = P["m_rod_kg"]
    m_big = m * b / l
    m_small = m * a / l
    J2 = m_big * a * a + m_small * b * b       # inertia of the 2-mass model about CG
    dJ = P["J_rod_cg_kgm2"] - J2               # error of the 2-mass model (3-mass correction)
    return {"m_rod_big": m_big, "m_rod_small": m_small, "m_osc": P["m_piston_kg"] + m_small,
            "m_rot_cyl": m_big, "J_2mass": J2, "J_error": dJ}

# ---------------------------------------------------------------- chapter 6: forces and torque
def forces_at(theta, P, geo, M):
    """All forces at crank angle theta (rad). Returns dict with per-cylinder values and resultants."""
    r, l, w, A = geo["r"], geo["l"], geo["w"], geo["A"]
    pcc = P["p_crankcase_MPa"] * 1e6
    Ppin = (r * math.sin(theta), r * math.cos(theta))            # crank-pin position (x right, y up)
    dP = (r * math.cos(theta), -r * math.sin(theta))             # dP/dtheta
    out = {"cyl": []}
    M_vw = 0.0            # drive torque from virtual work
    F_pin = [0.0, 0.0]    # sum of rod forces on the pin
    shake = [0.0, 0.0]    # shaking force from oscillating masses (inertia forces on the frame)
    for g in P["cyl_angles_deg"]:
        gam = math.radians(g)
        u = (math.sin(gam), math.cos(gam))                          # cylinder axis unit vector (towards head)
        phi = theta - gam
        k = kin(phi, r, l, w)
        p = gas_pressure(phi, P, geo)
        Fg = (p - pcc) * A                                          # towards crank
        m_osc = M["m_osc"]
        Fax = Fg + m_osc * k["a"]                                   # axial force the rod must give the piston
        S = Fax / math.cos(k["beta"])                               # rod force, compression +
        N = Fax * math.tan(k["beta"])                               # piston side force on liner (magnitude by sign)
        Q = (k["s"] * u[0], k["s"] * u[1])                          # piston pin position
        e = ((Q[0] - Ppin[0]) / l, (Q[1] - Ppin[1]) / l)            # unit vector pin -> piston pin
        Fp = (-S * e[0], -S * e[1])                                 # rod force acting on crank pin
        F_pin[0] += Fp[0]
        F_pin[1] += Fp[1]
        M_vw += Fax * k["ds"]                                       # = drive torque (two-mass, constant w)
        shake[0] += -m_osc * k["a"] * u[0]
        shake[1] += -m_osc * k["a"] * u[1]
        Ft = Fp[0] * dP[0] / r + Fp[1] * dP[1] / r                  # tangential (in rotation direction)
        Fr = -(Fp[0] * Ppin[0] + Fp[1] * Ppin[1]) / r               # radial, towards crank centre +
        out["cyl"].append({"phi": phi, "p": p, "Fg": Fg, "Fi": -m_osc * k["a"], "Fax": Fax, "S": S, "N": N,
                           "Ft": Ft, "Fr": Fr, "Fp": Fp, "x": k["x"], "v": k["v"], "a": k["a"]})
    M_vec = -(F_pin[0] * dP[0] + F_pin[1] * dP[1])                  # drive torque from vector forces
    m_rot = M["m_rot_cyl"] * len(P["cyl_angles_deg"]) + P["m_crank_unbal_kg"]
    m_cw = P["cw_balance_share"] * (m_rot + M["m_osc"]) if len(P["cyl_angles_deg"]) == 2 else \
        P["cw_balance_share"] * (m_rot + 0.5 * M["m_osc"])
    cen = (math.sin(theta), math.cos(theta))
    # rotating inertia: unbalanced rotating mass (m_rot - m_cw) at radius r, outward
    F_rot = ((m_rot - m_cw) * r * w * w * cen[0], (m_rot - m_cw) * r * w * w * cen[1])
    shake_tot = (shake[0] + F_rot[0], shake[1] + F_rot[1])
    # crank-pin bearing load per rod and resultant pin load incl. big-end centrifugal force
    big_cf = (M["m_rot_cyl"] * r * w * w * cen[0], M["m_rot_cyl"] * r * w * w * cen[1])
    # main bearing load (both bearings together) = rod forces + all rotating centrifugal - counterweight
    F_main = (F_pin[0] + M["m_rot_cyl"] * 2 * r * w * w * cen[0] + (P["m_crank_unbal_kg"] - m_cw) * r * w * w * cen[0],
              F_pin[1] + M["m_rot_cyl"] * 2 * r * w * w * cen[1] + (P["m_crank_unbal_kg"] - m_cw) * r * w * w * cen[1])
    out.update({"theta": theta, "M_drive": M_vw, "M_drive_vec": M_vec, "F_pin": tuple(F_pin),
                "shake_osc": tuple(shake), "shake": shake_tot, "F_main": F_main, "m_cw": m_cw, "m_rot": m_rot,
                "big_cf": big_cf})
    return out

def sweep(P):
    geo = geometry(P)
    M = masses(P)
    step = P["step_deg"]
    rows = []
    n = int(round(360 / step))
    for k in range(n):
        th = math.radians(k * step)
        rows.append(forces_at(th, P, geo, M))
    return geo, M, rows

# ---------------------------------------------------------------- chapter 7: torque, flywheel
def torque_analysis(P, geo, rows):
    Ms = [r["M_drive"] for r in rows]
    n = len(Ms)
    dth = 2 * math.pi / n
    Mm = sum(Ms) / n
    E, Emin, Emax = 0.0, 0.0, 0.0
    for m in Ms:
        E += (m - Mm) * dth
        Emin, Emax = min(Emin, E), max(Emax, E)
    dE = Emax - Emin
    w = geo["w"]
    J_need = dE / (P["speed_fluct_coeff"] * w * w)
    J_motor_red = P["J_motor_kgm2"] * P["belt_ratio"] ** 2     # motor inertia seen at the crank
    J_fly = max(0.0, J_need - J_motor_red)
    # harmonic content (orders) by DFT
    orders = []
    for h in range(1, 9):
        a = sum(m * math.cos(h * 2 * math.pi * k / n) for k, m in enumerate(Ms)) * 2 / n
        b = sum(m * math.sin(h * 2 * math.pi * k / n) for k, m in enumerate(Ms)) * 2 / n
        orders.append((h, math.hypot(a, b)))
    return {"M_mean": Mm, "M_max": max(Ms), "M_min": min(Ms), "P_shaft_W": Mm * w, "dE_J": dE,
            "J_need": J_need, "J_motor_red": J_motor_red, "J_fly": J_fly,
            "uniformity": (max(Ms) - min(Ms)) / Mm, "orders": orders}

# ---------------------------------------------------------------- chapter 8: balancing
def balancing(P, geo, M, rows):
    r, w, lam = geo["r"], geo["w"], geo["lam"]
    mo = M["m_osc"]
    F1 = mo * r * w * w
    F2 = lam * F1
    num_osc = max(math.hypot(*x["shake_osc"]) for x in rows)
    num_res = max(math.hypot(*x["shake"]) for x in rows)
    # rocking couple: oscillating + rotating forces of the two rods act in planes 'a' apart
    a = P["rod_offset_mm"] / 1000
    couple = F1 * a           # primary of one cylinder x offset (order of magnitude, V90)
    # residual after counterweight: theory V90 = sqrt(2) * F2 (secondary, along horizontal)
    return {"F1_per_cyl": F1, "F2_per_cyl": F2, "V90_secondary_theory": math.sqrt(2) * F2,
            "shake_osc_max": num_osc, "shake_residual_max": num_res, "m_cw_at_r": rows[0]["m_cw"],
            "m_rot": rows[0]["m_rot"], "rocking_couple_Nm": couple}

def iso21940(P):
    """Permissible residual unbalance U_per = 9549 * G * m / n  [g mm]  (ISO 21940-11)."""
    U = 9549 * P["balance_grade_G"] * P["crank_rotor_mass_kg"] / P["rpm"]
    return {"U_per_gmm": U, "e_per_um": U / P["crank_rotor_mass_kg"], "per_plane_gmm": U / 2}

# ---------------------------------------------------------------- chapter 9: bearings and rod
def bearing_loads(P, geo, rows):
    """Peak / cubic-mean loads (input for ISO 281 in M4) + specific pressure of the rod bearing."""
    def cubic_mean(vals):
        return (sum(v ** 3 for v in vals) / len(vals)) ** (1 / 3)
    rod1 = [math.hypot(*x["cyl"][0]["Fp"]) for x in rows]
    pin = [math.hypot(*x["F_pin"]) for x in rows]
    main = [math.hypot(*x["F_main"]) for x in rows]
    S = [c["S"] for x in rows for c in x["cyl"]]
    N = [abs(c["N"]) for x in rows for c in x["cyl"]]
    p_rod = max(rod1) / (P["pin_d_mm"] * P["rod_bearing_b_mm"])     # N/mm2 = MPa
    return {"rod_bearing_max_N": max(rod1), "rod_bearing_cubic_N": cubic_mean(rod1),
            "pin_resultant_max_N": max(pin), "main_total_max_N": max(main), "main_total_cubic_N": cubic_mean(main),
            "rod_S_max_comp_N": max(S), "rod_S_max_tension_N": min(S), "side_force_max_N": max(N),
            "p_rod_bearing_MPa": p_rod}

# ---------------------------------------------------------------- chapter 10: manufacturing tolerances
def tolerance_effects(P):
    """(a) TDC gap stack worst case / RSS; (b) FAD sensitivity to clearance volume (deck height)."""
    st = P["deck_stack"]
    tol = list(st["tol_mm"].values())
    wc = sum(tol)
    rss = math.sqrt(sum(t * t for t in tol))
    g = st["nominal_gap_mm"]
    geo = geometry(P)
    # 0.1 mm more gap -> more clearance volume A*0.1mm
    dVc = geo["A"] * 0.1e-3
    P2 = dict(P)
    P2["clearance_ratio"] = (geo["Vc"] + dVc) / geo["Vs"]
    f1 = cycle(P, geo)["fad_m3h"]
    f2 = cycle(P2, geometry(P2))["fad_m3h"]
    return {"gap_nom": g, "gap_min_wc": g - wc, "gap_min_rss": g - rss, "wc": wc, "rss": rss,
            "c_per_0.1mm": dVc / geo["Vs"], "fad_loss_per_0.1mm_m3h": f1 - f2,
            "fad_loss_per_0.1mm_pct": 100 * (f1 - f2) / f1}

# ---------------------------------------------------------------- output: SVG + CSV + report
def _svg_line(series, w=640, h=360, title="", xl="", yl="", polar=False):
    """series: list of (label, [(x,y)...], colour). Pure SVG, no libraries."""
    allx = [p[0] for _, s, _ in series for p in s]
    ally = [p[1] for _, s, _ in series for p in s]
    x0, x1, y0, y1 = min(allx), max(allx), min(ally), max(ally)
    if polar:
        m = max(abs(x0), abs(x1), abs(y0), abs(y1))
        x0, x1, y0, y1 = -m, m, -m, m
    if y1 == y0:
        y1 = y0 + 1
    L, R, T, B = 70, 20, 40, 50
    sx = lambda x: L + (x - x0) / (x1 - x0) * (w - L - R)
    sy = lambda y: h - B - (y - y0) / (y1 - y0) * (h - T - B)
    o = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" font-family="sans-serif" font-size="12">' % (w, h),
         '<rect width="100%" height="100%" fill="white"/>',
         '<text x="%d" y="22" font-size="14" font-weight="bold">%s</text>' % (L, title)]
    for i in range(5):
        yy = y0 + (y1 - y0) * i / 4
        xx = x0 + (x1 - x0) * i / 4
        o.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="#ddd"/>' % (L, sy(yy), w - R, sy(yy)))
        o.append('<text x="%d" y="%.1f" text-anchor="end">%.4g</text>' % (L - 4, sy(yy) + 4, yy))
        o.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="#ddd"/>' % (sx(xx), T, sx(xx), h - B))
        o.append('<text x="%.1f" y="%d" text-anchor="middle">%.4g</text>' % (sx(xx), h - B + 16, xx))
    if y0 < 0 < y1:
        o.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="#888"/>' % (L, sy(0), w - R, sy(0)))
    for k, (lab, s, col) in enumerate(series):
        pts = " ".join("%.1f,%.1f" % (sx(a), sy(b)) for a, b in s)
        o.append('<polyline fill="none" stroke="%s" stroke-width="1.6" points="%s"/>' % (col, pts))
        o.append('<text x="%d" y="%d" fill="%s">%s</text>' % (w - R - 200, T + 14 + 14 * k, col, lab))
    o.append('<text x="%d" y="%d" text-anchor="middle">%s</text>' % ((L + w - R) // 2, h - 12, xl))
    o.append('<text x="14" y="%d" transform="rotate(-90 14 %d)" text-anchor="middle">%s</text>' % (h // 2, h // 2, yl))
    o.append('</svg>')
    return "\n".join(o)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    geo, M, rows = sweep(P)
    cyc = cycle(P, geo)
    tq = torque_analysis(P, geo, rows)
    bal = balancing(P, geo, M, rows)
    brg = bearing_loads(P, geo, rows)
    iso = iso21940(P)
    tol = tolerance_effects(P)
    with open(os.path.join(out, "crank.csv"), "w", encoding="utf-8") as f:
        f.write("theta_deg,p1_bar,p2_bar,F_gas1_N,F_in1_N,S1_N,N1_N,M_drive_Nm,Fpin_x_N,Fpin_y_N,Fmain_x_N,Fmain_y_N,shake_x_N,shake_y_N\n")
        for x in rows:
            c1, c2 = x["cyl"][0], x["cyl"][-1]
            f.write("%.2f,%.4f,%.4f,%.2f,%.2f,%.2f,%.2f,%.4f,%.2f,%.2f,%.2f,%.2f,%.3f,%.3f\n" % (
                math.degrees(x["theta"]), c1["p"] / 1e5, c2["p"] / 1e5, c1["Fg"], c1["Fi"], c1["S"], c1["N"],
                x["M_drive"], x["F_pin"][0], x["F_pin"][1], x["F_main"][0], x["F_main"][1], x["shake"][0], x["shake"][1]))
    th = [math.degrees(x["theta"]) for x in rows]
    svgs = {
        "pv.svg": _svg_line([("cylinder p-V", [(v * 1e6, p / 1e5) for v, p in cyc["pv"]], "#1f77b4")],
                            title="p-V diagram (one cylinder)", xl="V [cm3]", yl="p abs [bar]"),
        "torque.svg": _svg_line([("M_drive", list(zip(th, [x["M_drive"] for x in rows])), "#d62728"),
                                 ("mean", [(0, tq["M_mean"]), (360, tq["M_mean"])], "#2ca02c")],
                                title="Drive torque at the crankshaft", xl="crank angle theta [deg]", yl="M [N m]"),
        "pin_polar.svg": _svg_line([("rod 1 force on crank pin", [x["cyl"][0]["Fp"] for x in rows], "#9467bd"),
                                    ("resultant both rods", [x["F_pin"] for x in rows], "#ff7f0e")],
                                   title="Crank-pin load polar diagram (frame axes)", xl="Fx [N]", yl="Fy [N]", polar=True),
        "shaking.svg": _svg_line([("oscillating only", [x["shake_osc"] for x in rows], "#8c564b"),
                                  ("with counterweight", [x["shake"] for x in rows], "#17becf")],
                                 title="Shaking force on the frame", xl="Fx [N]", yl="Fy [N]", polar=True),
    }
    for k, v in svgs.items():
        with open(os.path.join(out, k), "w", encoding="utf-8") as f:
            f.write(v)
    rep = report_text(P, geo, M, cyc, tq, bal, brg, iso, tol)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    print(rep)
    print("written:", ", ".join(["report.md", "crank.csv"] + list(svgs)), "->", out)

def report_text(P, geo, M, cyc, tq, bal, brg, iso, tol):
    L = []
    a = L.append
    a("# Crank mechanism report - %s\n" % P["name"])
    a("Inputs: D %.1f mm, stroke %.1f mm (r %.1f), rod %.1f mm (lambda %.4f), %d cyl at %s deg, %.0f rpm, %.2f MPa g\n" % (
        P["bore_mm"], P["stroke_mm"], geo["r"] * 1e3, P["rod_mm"], geo["lam"], P["n_cyl"], P["cyl_angles_deg"], P["rpm"],
        P["p_dis_gauge_MPa"]))
    a("## Kinematics\n- v_mean = %.2f m/s, a_TDC = %.0f m/s2, a_BDC = %.0f m/s2\n" % (
        2 * 2 * geo["r"] * P["rpm"] / 60, geo["r"] * geo["w"] ** 2 * (1 + geo["lam"]), -geo["r"] * geo["w"] ** 2 * (1 - geo["lam"])))
    a("## Thermodynamics\n- displacement %.2f m3/h, lambda_V %.3f (formula %.3f), lambda_p %.3f, lambda_T %.2f, lambda total %.3f\n"
      "- FAD %.2f m3/h, indicated power %.0f W, isothermal power %.0f W, isothermal efficiency %.3f\n" % (
        cyc["disp_m3h"], cyc["lam_V"], cyc["lam_V_ideal_formula"], cyc["lam_p"], P["lambda_T"], cyc["lam_total"],
        cyc["fad_m3h"], cyc["P_ind_W"], cyc["P_iso_W"], cyc["eta_iso_ind"]))
    a("## Masses\n- m_osc %.4f kg, m_rot per rod %.4f kg, 2-mass inertia %.3e vs real %.3e kg m2 (error %.3e)\n" % (
        M["m_osc"], M["m_rot_cyl"], M["J_2mass"], P["J_rod_cg_kgm2"], M["J_error"]))
    a("## Torque\n- mean %.2f N m (shaft power %.0f W), max %.2f, min %.2f N m, dE %.2f J\n"
      "- J needed %.4f kg m2, motor reflected %.4f, flywheel/pulley to add %.4f kg m2\n- orders: %s\n" % (
        tq["M_mean"], tq["P_shaft_W"], tq["M_max"], tq["M_min"], tq["dE_J"], tq["J_need"], tq["J_motor_red"], tq["J_fly"],
        ", ".join("%d: %.2f" % o for o in tq["orders"][:6])))
    a("## Balancing\n- F1 per cyl %.1f N, F2 per cyl %.1f N, V90 secondary theory %.1f N\n"
      "- shaking max: oscillating only %.1f N, with counterweight %.1f N; counterweight %.4f kg at r; rocking couple ~%.2f N m\n"
      "- ISO 21940-11 G%.1f: U_per %.1f g mm (%.1f per plane), e_per %.1f um\n" % (
        bal["F1_per_cyl"], bal["F2_per_cyl"], bal["V90_secondary_theory"], bal["shake_osc_max"], bal["shake_residual_max"],
        bal["m_cw_at_r"], bal["rocking_couple_Nm"], P["balance_grade_G"], iso["U_per_gmm"], iso["per_plane_gmm"], iso["e_per_um"]))
    a("## Bearings and rod\n- rod bearing max %.0f N (cubic mean %.0f), p = %.2f MPa; pin resultant max %.0f N\n"
      "- main bearings total max %.0f N (cubic mean %.0f); rod force max compression %.0f N, max tension %.0f N; side force max %.0f N\n" % (
        brg["rod_bearing_max_N"], brg["rod_bearing_cubic_N"], brg["p_rod_bearing_MPa"], brg["pin_resultant_max_N"],
        brg["main_total_max_N"], brg["main_total_cubic_N"], brg["rod_S_max_comp_N"], brg["rod_S_max_tension_N"],
        brg["side_force_max_N"]))
    a("## Manufacturing\n- TDC gap %.2f mm: min worst case %.3f, min RSS %.3f mm\n"
      "- +0.1 mm gap -> c +%.4f -> FAD -%.3f m3/h (%.2f %%)\n" % (
        tol["gap_nom"], tol["gap_min_wc"], tol["gap_min_rss"], tol["c_per_0.1mm"], tol["fad_loss_per_0.1mm_m3h"],
        tol["fad_loss_per_0.1mm_pct"]))
    return "\n".join(L)


# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2/3: extra kinematics
def kin_series4(phi, r, l, w):
    """4-term Fourier series (terms up to 6th order). x = r[A0 - cos phi - A2/4 cos2phi + A4/16 cos4phi - A6/36 cos6phi]
    a (towards crank) = r w^2 [cos phi + A2 cos2phi - A4 cos4phi + A6 cos6phi]
    A2 = lam + lam^3/4 + 15 lam^5/128,  A4 = lam^3/4 + 3 lam^5/16,  A6 = 9 lam^5/128."""
    lam = r / l
    A2 = lam + lam ** 3 / 4 + 15 * lam ** 5 / 128
    A4 = lam ** 3 / 4 + 3 * lam ** 5 / 16
    A6 = 9 * lam ** 5 / 128
    x = r * (1 + A2 / 4 - A4 / 16 + A6 / 36
             - math.cos(phi) - A2 / 4 * math.cos(2 * phi) + A4 / 16 * math.cos(4 * phi) - A6 / 36 * math.cos(6 * phi))
    a_tc = r * w * w * (math.cos(phi) + A2 * math.cos(2 * phi) - A4 * math.cos(4 * phi) + A6 * math.cos(6 * phi))
    return x, a_tc, (A2, A4, A6)


def rod_motion(phi, r, l, w):
    """Conrod angle beta, angular velocity w_rod = w lam cos(phi)/cos(beta) and
    angular acceleration alpha_rod = -w^2 lam sin(phi) (1 - lam^2) / cos^3(beta)   (constant crank speed)."""
    lam = r / l
    beta = math.asin(lam * math.sin(phi))
    cb = math.cos(beta)
    w_rod = w * lam * math.cos(phi) / cb
    a_rod = -w * w * lam * math.sin(phi) * (1 - lam * lam) / cb ** 3
    return beta, w_rod, a_rod


def max_piston_speed(r, l, w, n=200000):
    """Crank angle (0..180 deg) where |v| is maximum and the value; numerical scan + refinement."""
    best = (0.0, 0.0)
    for k in range(1, n):
        ph = math.pi * k / n
        v = abs(kin(ph, r, l, w)["v"])
        if v > best[1]:
            best = (ph, v)
    return math.degrees(best[0]), best[1]


def kin_offset(phi, r, l, e, w):
    """Offset (desaxe) slider crank: cylinder axis shifted by e from the crank centre.
    s = r cos phi + sqrt(l^2 - (r sin phi - e)^2); returns s, ds/dphi, beta."""
    sp, cp = math.sin(phi), math.cos(phi)
    q = r * sp - e
    root = math.sqrt(l * l - q * q)
    s = r * cp + root
    ds = -r * sp - q * r * cp / root
    return s, ds, math.asin(q / l)


def offset_stroke(r, l, e):
    """Stroke and TDC/BDC crank angles of an offset crank. stroke = sqrt((l+r)^2-e^2) - sqrt((l-r)^2-e^2)."""
    s_tdc = math.sqrt((l + r) ** 2 - e * e)
    s_bdc = math.sqrt((l - r) ** 2 - e * e)
    phi_tdc = math.asin(e / (l + r))                 # rod and crank in line
    phi_bdc = math.pi + math.asin(e / (l - r))       # crank opposite, folded
    return s_tdc - s_bdc, math.degrees(phi_tdc), math.degrees(phi_bdc)


# ---------------------------------------------------------------- chapter 4: thermodynamics extras
def polytropic_work_closed(P, geo):
    """Closed-form indicated work of one cylinder (J per cycle), same model as cycle():
    W = nc/(nc-1) ps V3 [pi^((nc-1)/nc) - 1] - ne/(ne-1) ps V1 [pi^((ne-1)/ne) - 1],  pi = pd/ps (effective)."""
    ps = P["p_amb_MPa"] * 1e6 * (1 - P["dp_suction_rel"])
    pd = (P["p_amb_MPa"] + P["p_dis_gauge_MPa"]) * 1e6 * (1 + P["dp_discharge_rel"])
    nc, ne = P["n_compression"], P["n_expansion"]
    V3 = geo["Vc"] + geo["Vs"]
    V1 = geo["Vc"] * (pd / ps) ** (1 / ne)
    pi = pd / ps
    Wc = nc / (nc - 1) * ps * V3 * (pi ** ((nc - 1) / nc) - 1)
    We = ne / (ne - 1) * ps * V1 * (pi ** ((ne - 1) / ne) - 1)
    return Wc - We, Wc, We


def discharge_temp(T1_C, p1, p2, n):
    """Polytropic end temperature T2 = T1 (p2/p1)^((n-1)/n). T in deg C in/out, p absolute (same unit)."""
    return (T1_C + 273.15) * (p2 / p1) ** ((n - 1) / n) - 273.15


def isentropic_power(P, fad_m3h, kappa=1.4):
    """Isentropic reference power for the delivered flow (inlet conditions):
    P_s = kappa/(kappa-1) p1 q [(p2/p1)^((kappa-1)/kappa) - 1]."""
    p1 = P["p_amb_MPa"] * 1e6
    p2 = (P["p_amb_MPa"] + P["p_dis_gauge_MPa"]) * 1e6
    q = fad_m3h / 3600
    return kappa / (kappa - 1) * p1 * q * ((p2 / p1) ** ((kappa - 1) / kappa) - 1)


def motor_power(P_ind_W, eta_mech=0.85, eta_belt=0.95, service=1.15):
    """Shaft power = P_ind / eta_mech; motor output = shaft / eta_belt; rated choice >= service x motor output."""
    P_shaft = P_ind_W / eta_mech
    P_motor = P_shaft / eta_belt
    return P_shaft, P_motor, P_motor * service


def design_for_fad(P, target_m3h):
    """Three ways to reach a FAD target: (1) bore, (2) speed, (3) clearance. Each re-checked with cycle()."""
    geo = geometry(P)
    base = cycle(P, geo)
    f0 = base["fad_m3h"]
    out = {"fad0": f0}
    # (1) bore: FAD ~ D^2 (c, lambda unchanged)
    D = P["bore_mm"] * math.sqrt(target_m3h / f0)
    P1 = dict(P); P1["bore_mm"] = D
    c1 = cycle(P1, geometry(P1))
    out["bore"] = (D, c1["fad_m3h"], c1["P_ind_W"])
    # (2) speed: FAD ~ n
    n = P["rpm"] * target_m3h / f0
    P2 = dict(P); P2["rpm"] = n
    c2 = cycle(P2, geometry(P2))
    out["rpm"] = (n, c2["fad_m3h"], c2["P_ind_W"], 2 * P["stroke_mm"] / 1000 * n / 60)
    # (3) clearance: lambda_V needed
    ps = P["p_amb_MPa"] * 1e6 * (1 - P["dp_suction_rel"])
    pd = (P["p_amb_MPa"] + P["p_dis_gauge_MPa"]) * 1e6 * (1 + P["dp_discharge_rel"])
    lamV_need = base["lam_V"] * target_m3h / f0
    c_need = (1 - lamV_need) / ((pd / ps) ** (1 / P["n_expansion"]) - 1)
    P3 = dict(P); P3["clearance_ratio"] = c_need
    c3 = cycle(P3, geometry(P3))
    out["clearance"] = (c_need, lamV_need, c3["fad_m3h"], c3["P_ind_W"])
    # peak gas force scale with bore
    A0 = math.pi / 4 * (P["bore_mm"] / 1000) ** 2
    A1 = math.pi / 4 * (D / 1000) ** 2
    out["peak_gas_force"] = (pd - P["p_crankcase_MPa"] * 1e6) * A0, (pd - P["p_crankcase_MPa"] * 1e6) * A1
    return out


def demo_ch24():
    P = dict(DEFAULT)
    g = geometry(P)
    r, l, w = g["r"], g["l"], g["w"]
    print("geometry: r %.4f m, l %.4f m, lam %.4f, A %.6e m2, Vs %.4e m3 (%.2f cm3), Vc %.4e m3 (%.3f cm3), w %.3f rad/s"
          % (r, l, g["lam"], g["A"], g["Vs"], g["Vs"] * 1e6, g["Vc"], g["Vc"] * 1e6, w))
    print("height crank centre to pin at TDC r+l = %.1f mm" % ((r + l) * 1e3))
    print("--- series 2 vs 4 term vs exact (x mm, a towards crank m/s2)")
    _, _, A = kin_series4(0, r, l, w)
    print("A2 %.6f A4 %.6f A6 %.3e" % A)
    for d in (0, 30, 60, 90, 120, 150, 180):
        ph = math.radians(d)
        k = kin(ph, r, l, w)
        x2, a2 = kin_series(ph, r, l, w)
        x4, a4, _ = kin_series4(ph, r, l, w)
        print("%3d x %.5f %.5f %.5f | a %.2f %.2f %.2f" % (d, k["x"] * 1e3, x2 * 1e3, x4 * 1e3, -k["a"], a2, a4))
    # max error over a revolution
    e2 = max(abs(kin(math.radians(d / 10), r, l, w)["x"] - kin_series(math.radians(d / 10), r, l, w)[0]) for d in range(3600))
    e4 = max(abs(kin(math.radians(d / 10), r, l, w)["x"] - kin_series4(math.radians(d / 10), r, l, w)[0]) for d in range(3600))
    ea2 = max(abs(-kin(math.radians(d / 10), r, l, w)["a"] - kin_series(math.radians(d / 10), r, l, w)[1]) for d in range(3600))
    ea4 = max(abs(-kin(math.radians(d / 10), r, l, w)["a"] - kin_series4(math.radians(d / 10), r, l, w)[1]) for d in range(3600))
    print("max error x: 2-term %.4f mm, 4-term %.2e mm; a: 2-term %.2f, 4-term %.4f m/s2" % (e2 * 1e3, e4 * 1e3, ea2, ea4))
    print("--- rod motion")
    for d in (0, 45, 90, 180):
        b, wr, ar = rod_motion(math.radians(d), r, l, w)
        print("%3d beta %.3f deg, w_rod %.3f rad/s, alpha_rod %.1f rad/s2" % (d, math.degrees(b), wr, ar))
    # check alpha by finite difference
    h = 1e-6
    b1 = rod_motion(0.7 + h, r, l, w)[1]; b0 = rod_motion(0.7 - h, r, l, w)[1]
    print("alpha check FD %.4f vs %.4f" % ((b1 - b0) / (2 * h) * w, rod_motion(0.7, r, l, w)[2]))
    phm, vm = max_piston_speed(r, l, w)
    cm = 2 * P["stroke_mm"] / 1000 * P["rpm"] / 60
    print("max piston speed %.3f m/s at phi %.2f deg; mean %.3f m/s; ratio %.3f; r w = %.3f" % (vm, phm, cm, vm / cm, r * w))
    print("--- offset e = 5 mm")
    st, ptdc, pbdc = offset_stroke(r, l, 0.005)
    print("stroke %.4f mm, TDC at %.3f deg, BDC at %.3f deg, compression-direction stroke %.3f deg vs %.3f"
          % (st * 1e3, ptdc, pbdc, pbdc - ptdc, 360 - (pbdc - ptdc)))
    for d in (90,):
        s0, ds0, b0 = kin_offset(math.radians(d), r, l, 0.0, w)
        s5, ds5, b5 = kin_offset(math.radians(d), r, l, 0.005, w)
        print("phi 90: beta e=0 %.3f deg, e=5 %.3f deg; at 270: e=5 %.3f deg" % (
            math.degrees(b0), math.degrees(b5), math.degrees(kin_offset(math.radians(270), r, l, 0.005, w)[2])))
    print("--- thermodynamics")
    c = cycle(P, g)
    Wcl, Wc, We = polytropic_work_closed(P, g)
    print("W numeric %.4f J, closed %.4f J (Wc %.4f, We %.4f), diff %.3f %%" % (c["W_cyl_J"], Wcl, Wc, We, 100 * (c["W_cyl_J"] / Wcl - 1)))
    print("V1 %.4e m3 = %.3f cm3; lam_V %.4f; lam_p %.3f; lam_total %.4f; FAD %.3f; disp %.3f; P_ind %.1f; P_iso %.1f; eta_iso %.4f"
          % (c["V1"], c["V1"] * 1e6, c["lam_V"], c["lam_p"], c["lam_total"], c["fad_m3h"], c["disp_m3h"], c["P_ind_W"], c["P_iso_W"], c["eta_iso_ind"]))
    ps = P["p_amb_MPa"] * 1e6 * (1 - P["dp_suction_rel"])
    pd = (P["p_amb_MPa"] + P["p_dis_gauge_MPa"]) * 1e6 * (1 + P["dp_discharge_rel"])
    print("ps %.0f Pa pd %.0f Pa ratio eff %.4f nominal %.4f" % (ps, pd, pd / ps, (P["p_amb_MPa"] + P["p_dis_gauge_MPa"]) / P["p_amb_MPa"]))
    # ideal lam_V with c=0 and with n=1.3 compare
    for cc in (0.0, 0.03, 0.05, 0.08):
        print("c %.2f lam_V %.4f" % (cc, 1 - cc * ((pd / ps) ** (1 / P["n_expansion"]) - 1)))
    cmax = 1 / ((pd / ps) ** (1 / P["n_expansion"]) - 1)
    print("c at which lam_V = 0: %.4f;  pressure ratio where lam_V=0 at c=0.05: %.2f" % (cmax, (1 + 1 / 0.05) ** P["n_expansion"]))
    Ps = isentropic_power(P, c["fad_m3h"])
    print("P_isentropic %.1f W, eta_s %.4f" % (Ps, Ps / c["P_ind_W"]))
    for T1 in (20, 40):
        for n in (1.3, 1.4):
            print("T1 %d n %.1f: T2 nominal %.1f C, T2 effective pd/ps %.1f C" % (
                T1, n, discharge_temp(T1, P["p_amb_MPa"], P["p_amb_MPa"] + P["p_dis_gauge_MPa"], n),
                discharge_temp(T1, ps, pd, n)))
    print("T2 at 13 bar abs n=1.3 T1=40: %.1f C" % discharge_temp(40, 1.013, 13.0, 1.3))
    print("pressure ratio for T2=180 C at T1=40, n=1.3: %.2f" % (((180 + 273.15) / (40 + 273.15)) ** (1.3 / 0.3)))
    Psh, Pm, Prated = motor_power(c["P_ind_W"])
    print("shaft %.0f W, motor output %.0f W, with service 1.15: %.0f W" % (Psh, Pm, Prated))
    print("--- design for 20 m3/h")
    d = design_for_fad(P, 20.0)
    print("FAD0 %.3f" % d["fad0"])
    print("bore %.2f mm -> FAD %.3f, P_ind %.1f W" % d["bore"])
    print("rpm %.1f -> FAD %.3f, P_ind %.1f W, c_m %.3f m/s" % d["rpm"])
    print("clearance c %.4f (lam_V %.4f) -> FAD %.3f, P_ind %.1f W" % d["clearance"])
    print("peak gas force %.1f N -> %.1f N (ratio %.4f)" % (d["peak_gas_force"] + (d["peak_gas_force"][1] / d["peak_gas_force"][0],)))
    # bore 70 standard
    P7 = dict(P); P7["bore_mm"] = 70.0
    c7 = cycle(P7, geometry(P7))
    print("bore 70: FAD %.3f, P_ind %.1f, disp %.3f" % (c7["fad_m3h"], c7["P_ind_W"], c7["disp_m3h"]))
    # c 0.03 and bore 68
    P8 = dict(P); P8["clearance_ratio"] = 0.03; P8["bore_mm"] = 68.0
    c8 = cycle(P8, geometry(P8))
    print("c 0.03 + bore 68: FAD %.3f, P_ind %.1f, lam_V %.4f" % (c8["fad_m3h"], c8["P_ind_W"], c8["lam_V"]))
    # clearance height equivalent
    print("Vc %.3f cm3 equals flat gap of %.3f mm over bore" % (g["Vc"] * 1e6, g["Vc"] / g["A"] * 1e3))

# ================================================================ added with guide chapters (ch58)
# ---------------------------------------------------------------- chapter 5: masses
def rod_angle_motion(phi, lam, w):
    """Conrod angle beta, angular velocity and angular acceleration (constant crank speed w).
    sin(beta) = lam sin(phi);  beta_dot = w lam cos(phi)/cos(beta);
    beta_ddot = w^2 lam sin(phi) (lam^2 - 1) / cos(beta)^3."""
    b = math.asin(lam * math.sin(phi))
    cb = math.cos(b)
    bd = w * lam * math.cos(phi) / cb
    bdd = w * w * lam * math.sin(phi) * (lam * lam - 1) / cb ** 3
    return b, bd, bdd


def rod_inertia_correction(P, n=720):
    """3-mass correction: the 2-mass model has the wrong rod inertia (dJ = J_real - J_2mass).
    The missing couple on the rod is M_corr = -dJ * beta_ddot. Returns the amplitude and the
    induced crank torque ripple (couple transferred to the crank: M_corr * (ds/dphi part) approximated by
    the exact virtual-work term dM_crank = -dJ * beta_ddot * dbeta/dphi)."""
    geo = geometry(P)
    M = masses(P)
    lam, w = geo["lam"], geo["w"]
    dJ = M["J_error"]
    amp_rod, amp_crank = 0.0, 0.0
    for k in range(n):
        ph = 2 * math.pi * k / n
        b, bd, bdd = rod_angle_motion(ph, lam, w)
        Mc = -dJ * bdd
        dbdphi = bd / w
        amp_rod = max(amp_rod, abs(Mc))
        amp_crank = max(amp_crank, abs(Mc * dbdphi))
    _, _, bdd_max = rod_angle_motion(math.pi / 2, lam, w)
    return {"dJ": dJ, "beta_ddot_max": abs(bdd_max), "M_corr_rod_max": amp_rod,
            "M_corr_crank_max": amp_crank}


def pendulum_J(m, a, T, g=9.81):
    """Conrod swung as a pendulum about a knife edge in the small-end bore.
    a = distance pivot -> CG [m], T = period [s]. J_O = m g a T^2 / (4 pi^2); J_CG = J_O - m a^2 (Steiner)."""
    JO = m * g * a * T * T / (4 * math.pi ** 2)
    return {"J_O": JO, "J_CG": JO - m * a * a}


def pendulum_period(m, a, J_cg, g=9.81):
    """Inverse of pendulum_J: period for a known J_CG (used to build the worked example)."""
    return 2 * math.pi * math.sqrt((J_cg + m * a * a) / (m * g * a))


def weight_group_effect(P, dm_piston_kg, dm_small_kg=0.0, dm_big_kg=0.0):
    """Mass difference between cylinder 1 and 2 (weight grouping tolerance).
    Counterweight is sized for the nominal mass, so the extra mass dm gives an unbalanced
    primary force amplitude dm_osc r w^2 along cylinder 1 axis (+ secondary lam*that) and
    an unbalanced rotating force dm_big r w^2."""
    geo = geometry(P)
    r, w, lam = geo["r"], geo["w"], geo["lam"]
    dmo = dm_piston_kg + dm_small_kg
    F1 = dmo * r * w * w
    return {"dF1_N": F1, "dF2_N": lam * F1, "dF_rot_N": dm_big_kg * r * w * w,
            "dF_total_max_N": F1 * (1 + lam) + dm_big_kg * r * w * w}


# ---------------------------------------------------------------- chapter 7: torque orders, flywheel, run-up
def single_cyl_orders(P, n=720, kmax=10):
    """DFT of the drive torque of ONE cylinder (cylinder axis gamma = 0). Returns [(order, amplitude, phase_deg)]."""
    P1 = dict(P)
    P1["cyl_angles_deg"] = [0.0]
    geo = geometry(P1)
    M = masses(P1)
    Ms = [forces_at(2 * math.pi * k / n, P1, geo, M)["M_drive"] for k in range(n)]
    out = []
    for h in range(0, kmax + 1):
        a = sum(m * math.cos(h * 2 * math.pi * k / n) for k, m in enumerate(Ms)) * (1 if h == 0 else 2) / n
        b = sum(m * math.sin(h * 2 * math.pi * k / n) for k, m in enumerate(Ms)) * (1 if h == 0 else 2) / n
        out.append((h, math.hypot(a, b), math.degrees(math.atan2(b, a))))
    return out


def twin_order_factor(k, phase_deg=90.0):
    """Amplitude factor of order k when two identical cylinders are shifted by phase_deg crank degrees:
    |1 + exp(-i k phase)| = 2 |cos(k phase / 2)|."""
    return 2 * abs(math.cos(math.radians(k * phase_deg) / 2))


def flywheel_rim(J_need, R_o, R_i, rho=7200.0):
    """Rim-type flywheel / heavy pulley (hollow cylinder): J = m (R_o^2 + R_i^2) / 2.
    Returns width b, mass m, rim speed v at the given rpm is computed outside."""
    m = 2 * J_need / (R_o ** 2 + R_i ** 2)
    b = m / (rho * math.pi * (R_o ** 2 - R_i ** 2))
    return {"m_kg": m, "b_m": b}


def rim_stress(rho, v):
    """Hoop stress of a thin rotating ring: sigma = rho v^2 [Pa]."""
    return rho * v * v


def runup_time(J_total_crank, w_crank, M_motor_avg_crank, M_load_avg):
    """Run-up time estimate with constant average torques: t = J w / (M_motor - M_load)."""
    return J_total_crank * w_crank / (M_motor_avg_crank - M_load_avg)


# ---------------------------------------------------------------- chapter 8: V angle comparison, isolation
def v_angle_compare(P, angles=(60.0, 75.0, 90.0), shares=None):
    """For each V angle: max shaking force without counterweight, with the V90 rule counterweight
    (share 1.0 of m_rot + m_osc) and with the best share (scan). Uses forces_at with changed cyl_angles."""
    if shares is None:
        shares = [i / 100 for i in range(50, 151, 2)]
    res = []
    for V in angles:
        Q = dict(P)
        Q["cyl_angles_deg"] = [-V / 2, V / 2]
        Q["step_deg"] = 2.0

        def mx(share):
            Q["cw_balance_share"] = share
            geo, M, rows = sweep(Q)
            return max(math.hypot(*x["shake"]) for x in rows), max(math.hypot(*x["shake_osc"]) for x in rows), \
                rows[0]["m_rot"], M["m_osc"]
        r1, osc, m_rot, m_osc = mx(1.0)
        # share 0 -> counterweight 0: shaking = osc + full rotating unbalance
        r0, _, _, _ = mx(0.0)
        best = min(((mx(s)[0], s) for s in shares))
        res.append({"V": V, "no_cw": r0, "osc_only": osc, "cw_1.0": r1, "best": best[0], "best_share": best[1],
                    "m_rot": m_rot, "m_osc": m_osc})
    return res


def transmissibility(f, fn, zeta=0.0):
    """Force transmissibility of a 1-DOF mount: TR = sqrt((1+(2 z r)^2) / ((1-r^2)^2 + (2 z r)^2)), r = f/fn."""
    r = f / fn
    return math.sqrt((1 + (2 * zeta * r) ** 2) / ((1 - r * r) ** 2 + (2 * zeta * r) ** 2))


def mount_design(m_kg, f_exc_hz, ratio=3.0, n_mounts=4, zeta=0.05, g=9.81):
    """Choose mounts so that f_exc / f_n = ratio. Returns f_n, total and per-mount stiffness, static deflection,
    transmissibility with and without damping."""
    fn = f_exc_hz / ratio
    k = m_kg * (2 * math.pi * fn) ** 2
    return {"fn_hz": fn, "k_total_N_per_m": k, "k_mount_N_per_mm": k / n_mounts / 1000,
            "static_defl_mm": g / (2 * math.pi * fn) ** 2 * 1000,
            "TR_undamped": transmissibility(f_exc_hz, fn, 0.0), "TR_damped": transmissibility(f_exc_hz, fn, zeta),
            "load_per_mount_N": m_kg * g / n_mounts}


def demo_ch58():
    P = dict(DEFAULT)
    geo = geometry(P)
    M = masses(P)
    r, w, lam = geo["r"], geo["w"], geo["lam"]
    print("== ch5 masses ==")
    print("m_rod_big %.4f, m_rod_small %.4f, m_osc %.4f, J_2mass %.3e, J_real %.3e, dJ %.3e" % (
        M["m_rod_big"], M["m_rod_small"], M["m_osc"], M["J_2mass"], P["J_rod_cg_kgm2"], M["J_error"]))
    rc = rod_inertia_correction(P)
    print("beta_ddot_max %.1f rad/s2, M_corr_rod_max %.4f N m, crank torque from it max %.4f N m" % (
        rc["beta_ddot_max"], rc["M_corr_rod_max"], rc["M_corr_crank_max"]))
    # pendulum worked example: rod 0.25 kg, pivot in small-end bore, CG 60 mm from small end
    a = 0.060
    T = pendulum_period(0.25, a, 3.6e-4)
    pj = pendulum_J(0.25, a, round(T, 4))
    print("pendulum: T = %.4f s -> J_O %.4e, J_CG %.4e (from measured T rounded to 0.1 ms)" % (T, pj["J_O"], pj["J_CG"]))
    pj2 = pendulum_J(0.25, a, round(T, 4) + 0.002)
    print("pendulum sensitivity: T + 2 ms -> J_CG %.4e (%.1f %%)" % (pj2["J_CG"], 100 * (pj2["J_CG"] / pj["J_CG"] - 1)))
    # weighing: big end on scale 0.1667 kg, small end 0.0833 -> CG position
    print("weighing check: CG from big end = l * m_small/m = %.1f mm" % (90 * M["m_rod_small"] / P["m_rod_kg"]))
    for dm in (0.002, 0.005, 0.010):
        e = weight_group_effect(P, dm)
        print("weight group dm_piston %.0f g: dF1 %.2f N, dF2 %.2f N, max %.2f N" % (dm * 1000, e["dF1_N"], e["dF2_N"], e["dF_total_max_N"]))
    e = weight_group_effect(P, 0.0, 0.0, 0.005)
    print("big-end +5 g: dF_rot %.2f N" % e["dF_rot_N"])
    print("crank unbalance at r: m_crank_unbal %.2f kg -> F %.1f N" % (P["m_crank_unbal_kg"], P["m_crank_unbal_kg"] * r * w * w))
    print("== ch6 forces ==")
    geo, M, rows = sweep(P)
    # tangential formula check at theta = 270 (cyl1 phi = 315)
    for d in (270, 300, 330):
        x = rows[int(d / P["step_deg"])]
        c = x["cyl"][0]
        k = kin(c["phi"], r, geo["l"], w)
        Ft_formula = -c["S"] * math.sin(c["phi"] + k["beta"])   # sign: tangential in rotation direction
        Fr_formula = c["S"] * math.cos(c["phi"] + k["beta"])
        print("theta %d: phi1 %.1f, S %.1f, Ft prog %.2f, -S sin(phi+beta) %.2f, Fr prog %.2f, S cos(phi+beta) %.2f, Ft*r %.3f" % (
            d, math.degrees(c["phi"]) % 360, c["S"], c["Ft"], Ft_formula, c["Fr"], Fr_formula, c["Ft"] * r))
    brg = bearing_loads(P, geo, rows)
    print("bearing:", {k: round(v, 1) for k, v in brg.items()})
    # where is the max rod force
    i = max(range(len(rows)), key=lambda j: rows[j]["cyl"][0]["S"])
    print("max S cyl1 at theta %.1f (phi1 %.1f)" % (math.degrees(rows[i]["theta"]), math.degrees(rows[i]["cyl"][0]["phi"]) % 360))
    i = min(range(len(rows)), key=lambda j: rows[j]["cyl"][0]["S"])
    print("min S cyl1 at theta %.1f (phi1 %.1f) S %.1f" % (math.degrees(rows[i]["theta"]), math.degrees(rows[i]["cyl"][0]["phi"]) % 360, rows[i]["cyl"][0]["S"]))
    i = max(range(len(rows)), key=lambda j: abs(rows[j]["cyl"][0]["N"]))
    print("max |N| cyl1 at phi1 %.1f N %.1f" % (math.degrees(rows[i]["cyl"][0]["phi"]) % 360, rows[i]["cyl"][0]["N"]))
    # inertia only tension at TDC
    print("inertia force at TDC = m_osc r w^2 (1+lam) = %.1f N" % (M["m_osc"] * r * w * w * (1 + lam)))
    print("== ch7 torque ==")
    tq = torque_analysis(P, geo, rows)
    print("M_mean %.3f, P %.1f W, M_max %.2f, M_min %.2f, dE %.3f J, J_need %.4f, J_motor_red %.4f, J_fly %.4f, uniformity %.2f" % (
        tq["M_mean"], tq["P_shaft_W"], tq["M_max"], tq["M_min"], tq["dE_J"], tq["J_need"], tq["J_motor_red"], tq["J_fly"], tq["uniformity"]))
    print("twin orders:", ", ".join("%d: %.3f" % o for o in tq["orders"]))
    so = single_cyl_orders(P)
    print("single cylinder orders (amp, phase):", ", ".join("%d: %.3f" % (h, a) for h, a, ph in so))
    print("twin factor 2|cos(k*45)|:", ", ".join("%d: %.3f" % (k, twin_order_factor(k)) for k in range(1, 11)))
    print("predicted twin amp = single*factor:", ", ".join("%d: %.3f" % (h, a * twin_order_factor(h)) for h, a, ph in so[1:9]))
    # flywheel: J_fly at crank; pulley OD 202 mm is driven pulley -> rim Ro 0.101, Ri 0.080
    fr = flywheel_rim(tq["J_fly"], 0.101, 0.080)
    v = 0.101 * w
    print("flywheel rim Ro 101 Ri 80: m %.2f kg, width %.1f mm, rim v %.2f m/s, sigma %.2f MPa" % (
        fr["m_kg"], fr["b_m"] * 1000, v, rim_stress(7200, v) / 1e6))
    fr2 = flywheel_rim(tq["J_fly"], 0.150, 0.125)
    v2 = 0.150 * w
    print("flywheel rim Ro 150 Ri 125: m %.2f kg, width %.1f mm, v %.2f m/s, sigma %.2f MPa" % (
        fr2["m_kg"], fr2["b_m"] * 1000, v2, rim_stress(7200, v2) / 1e6))
    print("grey iron v limit check: v at 35 m/s -> sigma %.2f MPa" % (rim_stress(7200, 35) / 1e6))
    # run-up: motor 3 kW 2930 rpm, T_N = 9550*3/2930
    TN = 9550 * 3 / 2930
    i_b = P["belt_ratio"]
    M_mot_crank = 2.0 * TN * i_b          # average DOL torque ~2 x nominal, at crank
    J_tot = tq["J_need"]                  # flywheel chosen so total = J_need
    t = runup_time(J_tot, w, M_mot_crank, tq["M_mean"])
    print("run-up: T_N %.2f N m motor, x2 avg -> %.2f N m at crank, J_total %.4f, M_load_mean %.2f -> t %.3f s" % (
        TN, M_mot_crank, J_tot, tq["M_mean"], t))
    t_unl = runup_time(J_tot, w, M_mot_crank, 0.0)
    print("run-up unloaded start (valve unloader): t %.3f s" % t_unl)
    print("peak torque vs motor: M_max %.2f at crank = %.2f N m at motor vs T_N %.2f" % (tq["M_max"], tq["M_max"] / i_b, TN))
    print("== ch8 balancing ==")
    bal = balancing(P, geo, M, rows)
    print({k: round(v, 3) for k, v in bal.items()})
    print("m_rot = 2*%.4f + %.2f = %.4f; m_cw at r = %.4f; at r_cw 35 mm: %.4f kg" % (
        M["m_rot_cyl"], P["m_crank_unbal_kg"], bal["m_rot"], bal["m_cw_at_r"], bal["m_cw_at_r"] * 23 / 35))
    print("bob weight (balancing machine, per pin) = m_rot_rods + m_osc share: 2*m_big + 2*m_osc*0.5 = %.4f kg" % (
        2 * M["m_rot_cyl"] + M["m_osc"]))
    # residual direction: find angle of max residual
    i = max(range(len(rows)), key=lambda j: math.hypot(*rows[j]["shake"]))
    sx, sy = rows[i]["shake"]
    print("max residual at theta %.1f: Fx %.1f Fy %.1f" % (math.degrees(rows[i]["theta"]), sx, sy))
    for d in (0, 45, 90):
        sx, sy = rows[int(d / P["step_deg"])]["shake"]
        print("theta %d residual Fx %.2f Fy %.2f  theory sqrt2 F2 cos2theta = %.2f" % (d, sx, sy, math.sqrt(2) * bal["F2_per_cyl"] * math.cos(2 * math.radians(d))))
    va = v_angle_compare(P)
    for x in va:
        print("V %.0f: no cw %.1f, osc only %.1f, cw share 1.0 %.1f, best %.1f at share %.2f" % (
            x["V"], x["no_cw"], x["osc_only"], x["cw_1.0"], x["best"], x["best_share"]))
    iso = iso21940(P)
    print("ISO:", {k: round(v, 2) for k, v in iso.items()})
    for G in (2.5, 6.3, 16):
        print("G%.1f -> U %.1f g mm" % (G, 9549 * G * 3.0 / 1450))
    print("e*w check G6.3: e = %.2f um, e*w = %.3f mm/s" % (iso["e_per_um"], iso["e_per_um"] / 1000 * w))
    # two-plane allocation: planes A,B at 0 and 100 mm; CG at 40 mm from A
    U = iso["U_per_gmm"]
    LA, LB, L = 60.0, 40.0, 100.0
    print("two-plane (CG 40 mm from A, planes 100 mm apart): U_A %.1f, U_B %.1f g mm" % (U * LA / L, U * LB / L))
    print("hole equivalent: 62.2 g mm at radius 40 mm -> %.2f g -> steel drill Ø8 depth %.1f mm" % (
        62.2 / 40, (62.2 / 40) / 1000 / (7850 * math.pi / 4 * 0.008 ** 2) * 1000))
    print("== isolation ==")
    md = mount_design(60.0, P["rpm"] / 60, 3.0, 4, 0.05)
    print({k: round(v, 4) for k, v in md.items()})
    md2 = mount_design(60.0, P["rpm"] / 60, 2.5, 4, 0.05)
    print({k: round(v, 4) for k, v in md2.items()})
    for rr in (0.5, 1.0, 1.414, 2.0, 3.0, 4.0):
        print("r %.3f TR0 %.3f TR(0.05) %.3f TR(0.2) %.3f" % (rr, transmissibility(rr, 1, 0) if rr != 1 else float('inf'),
                                                         transmissibility(rr, 1, 0.05), transmissibility(rr, 1, 0.2)))
    print("transmitted residual force: %.1f N x TR %.3f = %.1f N" % (bal["shake_residual_max"], md["TR_damped"], bal["shake_residual_max"] * md["TR_damped"]))
    print("2nd order (48.3 Hz) TR: %.4f" % transmissibility(2 * P["rpm"] / 60, md["fn_hz"], 0.05))

# ================================================================ added with guide chapters (ch913)
# ---------------------------------------------------------------- chapter 9: load cases
LOAD_CASES = {
    "LC1 normal 0.8 MPa": {},
    "LC2 safety valve 0.99 MPa": {"p_dis_gauge_MPa": 0.99},
    "LC4 fault: sticking discharge valve": {"p_dis_gauge_MPa": 0.99, "dp_discharge_rel": 0.10},
}

def load_case_table(P=None):
    """Run compute_all() for each load case; return the key loads per case."""
    base = dict(DEFAULT if P is None else P)
    out = {}
    for name, upd in LOAD_CASES.items():
        Q = dict(base)
        Q.update(upd)
        R = compute_all(Q)
        out[name] = {"M_max": R["tq"]["M_max"], "M_mean": R["tq"]["M_mean"], "P_ind": R["cyc"]["P_ind_W"],
                     "rod_max": R["brg"]["rod_bearing_max_N"], "rod_cubic": R["brg"]["rod_bearing_cubic_N"],
                     "main_max": R["brg"]["main_total_max_N"], "S_comp": R["brg"]["rod_S_max_comp_N"],
                     "S_tens": R["brg"]["rod_S_max_tension_N"], "N_side": R["brg"]["side_force_max_N"],
                     "p_rod": R["brg"]["p_rod_bearing_MPa"], "fad": R["cyc"]["fad_m3h"]}
    return out

def start_torque(P_motor_kW=3.0, n_motor=2930.0, k_start=2.5, belt_ratio=2.02):
    """LC3 start: motor locked-rotor / breakdown torque reflected to the crank (belt losses ignored)."""
    T_nom = 9550 * P_motor_kW / n_motor
    return {"T_motor_nom": T_nom, "T_motor_start": k_start * T_nom, "T_crank_start": k_start * T_nom * belt_ratio}

def cubic_mean(vals):
    """P_m = (sum |F|^3 / N)^(1/3) - equal angle steps at constant speed = equal time steps."""
    return (sum(abs(v) ** 3 for v in vals) / len(vals)) ** (1.0 / 3.0)

# ---------------------------------------------------------------- chapter 9: two-bearing split
def main_bearing_split(P=None, L_ab_mm=80.0, z_pin_mm=40.0, z_pulley_mm=-45.0, d_pulley_mm=202.0,
                       belt_factor=2.5, belt_dir_deg=90.0):
    """Crankshaft as a beam on bearings A (z=0) and B (z=L_ab). Net crank-pin plane force F_main(theta) at z_pin,
    belt pull F_belt (constant, direction belt_dir_deg from vertical, towards the motor) at z_pulley (overhung, z<0).
    F_belt = belt_factor * F_t, F_t = 2 * M_mean / d_p.  Returns max and cubic-mean load on each bearing."""
    Q = dict(DEFAULT if P is None else P)
    geo, M, rows = sweep(Q)
    tq = torque_analysis(Q, geo, rows)
    Ft = 2 * tq["M_mean"] / (d_pulley_mm / 1000)
    Fb = belt_factor * Ft
    bd = math.radians(belt_dir_deg)
    Fbv = (Fb * math.sin(bd), Fb * math.cos(bd))
    L, zp, zb = L_ab_mm, z_pin_mm, z_pulley_mm
    RA, RB = [], []
    for x in rows:
        F = x["F_main"]
        # moment about A: RB*L + F*zp + Fb*zb = 0 ; force: RA + RB + F + Fb = 0 (reactions on the shaft)
        rbx = -(F[0] * zp + Fbv[0] * zb) / L
        rby = -(F[1] * zp + Fbv[1] * zb) / L
        rax = -F[0] - Fbv[0] - rbx
        ray = -F[1] - Fbv[1] - rby
        RA.append(math.hypot(rax, ray))
        RB.append(math.hypot(rbx, rby))
    return {"F_t": Ft, "F_belt": Fb, "A_max": max(RA), "A_cubic": cubic_mean(RA), "B_max": max(RB),
            "B_cubic": cubic_mean(RB)}

# ---------------------------------------------------------------- chapter 9: conrod checks
def conrod_buckling(S_max, L_mm=90.0, b_mm=10.0, h_mm=16.0, E=75000.0, Rp=140.0, K_in=1.0, K_out=0.5):
    """Rectangular shank b (thin, out of plane) x h (in plane of motion). In plane: pinned-pinned (K=1);
    out of plane: ends nearly clamped by bearing width (K~0.5). Euler / Johnson (J.B. Johnson parabola)."""
    A = b_mm * h_mm
    res = {"A_mm2": A, "sigma_c": S_max / A}
    for plane, I, K in (("in-plane", b_mm * h_mm ** 3 / 12, K_in), ("out-of-plane", h_mm * b_mm ** 3 / 12, K_out)):
        i = math.sqrt(I / A)
        lam = K * L_mm / i
        lam_T = math.pi * math.sqrt(2 * E / Rp)
        if lam >= lam_T:
            scr = math.pi ** 2 * E / lam ** 2
            law = "Euler"
        else:
            scr = Rp - (Rp * lam / (2 * math.pi)) ** 2 / E
            law = "Johnson"
        res[plane] = {"i_mm": i, "lambda": lam, "lambda_T": lam_T, "sigma_cr": scr, "law": law,
                      "n_buckling": scr * A / S_max}
    return res

def conrod_shank_fatigue(S_max, S_min, A_mm2=160.0, Rm=240.0, Se=60.0):
    """Shank axial fatigue: sigma_a, sigma_m and Goodman safety (Se = part endurance limit, example)."""
    sa = (S_max - S_min) / 2 / A_mm2
    sm = (S_max + S_min) / 2 / A_mm2
    n = 1 / (sa / Se + sm / Rm) if sm >= 0 else Se / sa
    return {"sigma_a": sa, "sigma_m": sm, "n_goodman": n}

def crankpin_check(F_pin_max, d_mm=30.0, span_mm=40.0):
    """Crank pin between webs, resultant at mid-span (conservative): M = F L / 4, sigma = 32 M/(pi d^3),
    tau_max (solid round, transverse shear) = 4 V / (3 A) with V = F/2."""
    Mb = F_pin_max * span_mm / 4
    sb = 32 * Mb / (math.pi * d_mm ** 3)
    tau = 4 * (F_pin_max / 2) / (3 * math.pi * d_mm ** 2 / 4)
    return {"M_Nmm": Mb, "sigma_b": sb, "tau": tau}

def gudgeon_pin_check(F, d_mm=16.0, di_mm=9.0, L_boss_mm=36.0, b_small_end_mm=18.0, d_boss_len_mm=None):
    """Gudgeon pin: load spread over small-end width b, reacted at boss centres L apart.
    M = F/8 (2L - b); sigma = M / W, W = pi (d^4 - di^4) / (32 d). Bearing pressure in small end p = F / (d b)."""
    Mb = F / 8 * (2 * L_boss_mm - b_small_end_mm)
    W = math.pi * (d_mm ** 4 - di_mm ** 4) / (32 * d_mm)
    return {"M_Nmm": Mb, "W_mm3": W, "sigma_b": Mb / W, "p_small_end": F / (d_mm * b_small_end_mm)}

# ---------------------------------------------------------------- chapter 10: manufacturing
def gap_monte_carlo(P=None, n=200000, seed=1, gap_min_mm=0.35, dist="normal"):
    """TDC gap = nominal + sum of deviations. Each tolerance +/-t taken as 3 sigma (normal) or uniform +/-t."""
    Q = dict(DEFAULT if P is None else P)
    st = Q["deck_stack"]
    tol = list(st["tol_mm"].values())
    rnd = random.Random(seed)
    below = 0
    gmin, s, s2 = 1e9, 0.0, 0.0
    for _ in range(n):
        dev = 0.0
        for t in tol:
            dev += rnd.gauss(0, t / 3) if dist == "normal" else rnd.uniform(-t, t)
        g = st["nominal_gap_mm"] + dev       # every deviation can open or close the gap (signs folded in)
        gmin = min(gmin, g)
        s += g
        s2 += g * g
        below += g < gap_min_mm
    mean = s / n
    sd = math.sqrt(s2 / n - mean * mean)
    return {"mean": mean, "sd": sd, "min_seen": gmin, "ppm_below": below / n * 1e6,
            "sd_theory": math.sqrt(sum((t / 3) ** 2 for t in tol)) if dist == "normal" else
            math.sqrt(sum(t * t / 3 for t in tol))}

def displacement_tolerance(P=None, d_bore_mm=0.01, d_r_mm=0.02):
    """dVs/Vs = 2 dD/D + dr/r (small changes)."""
    Q = dict(DEFAULT if P is None else P)
    r = Q["stroke_mm"] / 2
    return {"bore_pct": 100 * 2 * d_bore_mm / Q["bore_mm"], "stroke_pct": 100 * d_r_mm / r,
            "total_wc_pct": 100 * (2 * d_bore_mm / Q["bore_mm"] + d_r_mm / r)}

def unequal_mass_shaking(P=None, dm_kg=0.004):
    """Max shaking force with full counterweight when cylinder 2 oscillating mass is dm heavier
    (piston weight groups). Counterweight designed for the nominal mass."""
    Q = dict(DEFAULT if P is None else P)
    geo, M = geometry(Q), masses(Q)
    r, l, w = geo["r"], geo["l"], geo["w"]
    m = [M["m_osc"], M["m_osc"] + dm_kg]
    m_cw_extra = M["m_osc"]                    # counterweight part that balances the V90 primary
    res = []
    for k in range(720):
        th = math.radians(k * 0.5)
        fx = fy = 0.0
        for mi, g in zip(m, Q["cyl_angles_deg"]):
            gam = math.radians(g)
            a = kin(th - gam, r, l, w)["a"]
            fx += -mi * a * math.sin(gam)
            fy += -mi * a * math.cos(gam)
        fx -= m_cw_extra * r * w * w * math.sin(th)
        fy -= m_cw_extra * r * w * w * math.cos(th)
        res.append(math.hypot(fx, fy))
    return {"max_N": max(res), "dm_primary_N": dm_kg * r * w * w}

# ---------------------------------------------------------------- chapter 12: design iteration
def design_options():
    """Variants towards FAD >= 20 m3/h."""
    var = {
        "V0 base (D65, 1450 rpm, c 0.05)": {},
        "V1 speed 1750 rpm": {"rpm": 1750.0},
        "V2 bore 72 mm": {"bore_mm": 72.0},
        "V3 bore 70, c 0.035": {"bore_mm": 70.0, "clearance_ratio": 0.035},
        "V4 bore 70, c 0.035, valve loss 3 %": {"bore_mm": 70.0, "clearance_ratio": 0.035,
                                               "dp_suction_rel": 0.03, "dp_discharge_rel": 0.03},
    }
    out = {}
    for k, u in var.items():
        Q = dict(DEFAULT)
        Q.update(u)
        R = compute_all(Q)
        out[k] = {"fad": R["cyc"]["fad_m3h"], "lam": R["cyc"]["lam_total"], "P_ind": R["cyc"]["P_ind_W"],
                  "P_shaft": R["cyc"]["P_ind_W"] / 0.85, "M_max": R["tq"]["M_max"], "J_fly": R["tq"]["J_fly"],
                  "rod_max": R["brg"]["rod_bearing_max_N"], "v_m": 2 * Q["stroke_mm"] / 1000 * Q["rpm"] / 60,
                  "spec_W_per_m3h": R["cyc"]["P_ind_W"] / 0.85 / R["cyc"]["fad_m3h"],
                  "shake_res": R["bal"]["shake_residual_max"], "m_cw": R["bal"]["m_cw_at_r"]}
    return out

def flywheel_disc(J_add, D_mm=250.0, rho=7200.0, D_pulley_mm=202.0, t_pulley_mm=30.0):
    """Solid disc: J = m D^2 / 8 -> m = 8 J / D^2 ; width t = m / (rho pi D^2 / 4).
    Also the inertia of a solid cast-iron pulley (D_pulley, width t_pulley) that already helps."""
    D = D_mm / 1000
    m = 8 * J_add / D ** 2
    t = m / (rho * math.pi * D ** 2 / 4)
    Dp, tp = D_pulley_mm / 1000, t_pulley_mm / 1000
    mp = rho * math.pi * Dp ** 2 / 4 * tp
    return {"m_disc_kg": m, "t_disc_mm": t * 1000, "m_pulley_kg": mp, "J_pulley": mp * Dp ** 2 / 8}

def demo_ch913():
    print("== 9.1 load cases")
    for k, v in load_case_table().items():
        print("%-38s M_max %.2f M_mean %.2f P_ind %.0f rod_max %.0f rod_cubic %.0f main_max %.0f S_comp %.0f S_tens %.0f N %.0f p_rod %.2f FAD %.2f" % (
            k, v["M_max"], v["M_mean"], v["P_ind"], v["rod_max"], v["rod_cubic"], v["main_max"], v["S_comp"],
            v["S_tens"], v["N_side"], v["p_rod"], v["fad"]))
    print("LC3 start", start_torque())
    print("== 9.3 main bearing split", main_bearing_split())
    lc2 = load_case_table()["LC2 safety valve 0.99 MPa"]
    print("== 9.4 buckling LC2 S", lc2["S_comp"])
    print(conrod_buckling(lc2["S_comp"]))
    lc1 = load_case_table()["LC1 normal 0.8 MPa"]
    print("== shank fatigue LC1", conrod_shank_fatigue(lc1["S_comp"], lc1["S_tens"]))
    print("== crank pin LC2", crankpin_check(compute_all(dict(DEFAULT, p_dis_gauge_MPa=0.99))["brg"]["pin_resultant_max_N"]))
    print("== gudgeon pin LC2", gudgeon_pin_check(lc2["S_comp"]))
    print("== 10 gap MC normal", gap_monte_carlo())
    print("== 10 gap MC uniform", gap_monte_carlo(dist="uniform"))
    print("== 10 displacement tol", displacement_tolerance())
    print("== 10 unequal mass 4 g", unequal_mass_shaking())
    print("== 10 unequal mass 10 g", unequal_mass_shaking(dm_kg=0.010))
    print("== 9.x flywheel V0", flywheel_disc(0.0590), "V3", flywheel_disc(0.0758))
    print("== 12 design options")
    for k, v in design_options().items():
        print("%-38s " % k + " ".join("%s %.4g" % (a, b) for a, b in v.items()))

# ---------------------------------------------------------------- examples / selftest
def compute_all(P=None):
    P = dict(DEFAULT if P is None else P)
    geo, M, rows = sweep(P)
    return {"P": P, "geo": geo, "M": M, "rows": rows, "cyc": cycle(P, geo), "tq": torque_analysis(P, geo, rows),
            "bal": balancing(P, geo, M, rows), "brg": bearing_loads(P, geo, rows), "iso": iso21940(P),
            "tol": tolerance_effects(P)}

def cmd_examples():
    R = compute_all()
    print(report_text(R["P"], R["geo"], R["M"], R["cyc"], R["tq"], R["bal"], R["brg"], R["iso"], R["tol"]))
    g = R["geo"]
    print("## Kinematics table (one cylinder, exact vs 2-term series)")
    print("phi  x_exact[mm]  x_series[mm]  v[m/s]  a_towards_crank_exact  a_series [m/s2]  beta[deg]")
    for d in (0, 30, 60, 90, 120, 150, 180, 270):
        k = kin(math.radians(d), g["r"], g["l"], g["w"])
        xs, asr = kin_series(math.radians(d), g["r"], g["l"], g["w"])
        print("%3d  %10.4f  %11.4f  %7.3f  %12.1f  %12.1f  %7.3f" % (
            d, k["x"] * 1e3, xs * 1e3, -k["v"], -k["a"], asr, math.degrees(k["beta"])))
    print("## Force table cylinder 1 (theta = crank angle from vertical; cylinder 1 TDC at theta = -45 = 315 deg)")
    print("theta  p[bar]  F_gas[N]  F_inertia[N]  S_rod[N]  N_side[N]  M_drive_total[Nm]")
    for d in (315, 0, 45, 90, 135, 180, 225, 270):
        x = R["rows"][int(round(d / R["P"]["step_deg"])) % len(R["rows"])]
        c = x["cyl"][0]
        print("%5d  %6.3f  %8.1f  %10.1f  %8.1f  %8.1f  %8.2f" % (d, c["p"] / 1e5, c["Fg"], c["Fi"], c["S"], c["N"], x["M_drive"]))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-58s %s %s" % (name, "OK  " if cond else "FAIL", info))
    R = compute_all()
    P, g, rows = R["P"], R["geo"], R["rows"]
    # 1 kinematics: derivative by finite difference
    ph, h = 0.7, 1e-6
    k0, kp, km = kin(ph, g["r"], g["l"], 1), kin(ph + h, g["r"], g["l"], 1), kin(ph - h, g["r"], g["l"], 1)
    chk("ds/dphi = finite difference", abs((kp["s"] - km["s"]) / (2 * h) - k0["ds"]) < 1e-8)
    chk("d2s/dphi2 = finite difference", abs((kp["s"] - 2 * k0["s"] + km["s"]) / h ** 2 - k0["d2s"]) < 1e-4)
    k = kin(0, g["r"], g["l"], g["w"])
    chk("a at TDC = r w^2 (1+lam)", abs(-k["a"] - g["r"] * g["w"] ** 2 * (1 + g["lam"])) < 1e-6)
    chk("stroke = x(180) = 2r", abs(kin(math.pi, g["r"], g["l"], 1)["x"] - 2 * g["r"]) < 1e-12)
    # 2 torque: virtual work = vector (pin force) method
    err = max(abs(x["M_drive"] - x["M_drive_vec"]) for x in rows)
    chk("drive torque: virtual work = pin-force vector method", err < 1e-6, "max diff %.2e N m" % err)
    # 3 energy: mean torque * w = indicated power (inertia averages to zero)
    chk("mean torque * w = indicated power (+-0.5 %)",
        abs(R["tq"]["P_shaft_W"] / R["cyc"]["P_ind_W"] - 1) < 0.005,
        "%.1f W vs %.1f W" % (R["tq"]["P_shaft_W"], R["cyc"]["P_ind_W"]))
    # 4 volumetric efficiency: numeric/analytic = textbook formula
    chk("lambda_V analytic = 1 - c((pd/ps)^(1/n)-1)", abs(R["cyc"]["lam_V"] - R["cyc"]["lam_V_ideal_formula"]) < 1e-9)
    # 5 balancing: V90 with full counterweight -> residual = sqrt(2) F2 (+ small higher orders)
    b = R["bal"]
    rad = sum(x["shake_osc"][0] * math.sin(x["theta"]) + x["shake_osc"][1] * math.cos(x["theta"]) for x in rows) / len(rows)
    chk("V90 primary = constant rotating vector m_osc r w^2 (mean radial)", abs(rad / b["F1_per_cyl"] - 1) < 0.01,
        "%.1f vs %.1f N" % (rad, b["F1_per_cyl"]))
    chk("V90 residual with counterweight ~ sqrt(2) F2 (+-10 %)",
        abs(b["shake_residual_max"] / b["V90_secondary_theory"] - 1) < 0.10,
        "%.1f vs %.1f N" % (b["shake_residual_max"], b["V90_secondary_theory"]))
    # 6 inertia only (no gas): mean torque = 0
    P0 = dict(P); P0["p_dis_gauge_MPa"] = 0.0; P0["dp_suction_rel"] = 0.0; P0["dp_discharge_rel"] = 0.0
    R0 = compute_all(P0)
    chk("no gas -> mean drive torque = 0", abs(R0["tq"]["M_mean"]) < 1e-6, "%.2e" % R0["tq"]["M_mean"])
    # 7 displacement
    chk("displacement = 26.56 m3/h", abs(R["cyc"]["disp_m3h"] - 26.56) < 0.01, "%.3f" % R["cyc"]["disp_m3h"])
    # 8 ISO 21940
    chk("ISO 21940 U_per = 9549 G m / n", abs(R["iso"]["U_per_gmm"] - 9549 * 6.3 * 3 / 1450) < 1e-9)
    # 9 force balance on piston: S cos(beta) = Fg + m a
    c = rows[100]["cyl"][0]
    kk = kin(c["phi"], g["r"], g["l"], g["w"])
    chk("piston equilibrium S cos(beta) = Fg + m_osc a", abs(c["S"] * math.cos(kk["beta"]) - (c["Fg"] + R["M"]["m_osc"] * kk["a"])) < 1e-9)
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
        for t, fn in (("chapters 2-4", demo_ch24), ("chapters 5-8", demo_ch58), ("chapters 9-12", demo_ch913)):
            print()
            print("######## extra results " + t)
            fn()
    elif cmd in ("ch24", "ch58", "ch913"):
        {"ch24": demo_ch24, "ch58": demo_ch58, "ch913": demo_ch913}[cmd]()
    elif cmd == "selftest":
        return cmd_selftest()
    elif cmd == "run":
        P = dict(DEFAULT)
        out = "crank_out"
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
