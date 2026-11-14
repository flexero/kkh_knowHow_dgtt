#!/usr/bin/env python3
"""M2b four-bar linkage program - analysis, synthesis, dynamics, tolerances (guide 02b_four_bar_linkage.md).

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python fourbar.py params                     default input (JSON) - copy, edit, use with --in
  python fourbar.py run [--in p.json] [--out folder]   full analysis -> report.md, fourbar.csv, *.svg
  python fourbar.py examples                   worked examples of the guide
  python fourbar.py selftest                   independent cross-checks (must print SELFTEST PASS)
  python fourbar.py ch24 | ch56 | ch711        extra results of guide chapters 2-4, 5-6, 7-11
  python fourbar.py ch6b                       results of guide chapter 6b (path generation)
  python fourbar.py pathparams > track.json    required-track input (edit the points / timing)
  python fourbar.py path [--in track.json] [--out folder]   find a linkage that follows a required track (ch. 6b)
  python fourbar.py run --in examples/swing_arm.json --out swing_out   worked application (chapter 11)

Notation (Norton / Erdman-Sandor style, guide chapter 2)
  a = crank (input, link 2), b = coupler (link 3), c = rocker (output, link 4), d = ground (link 1)
  O2 at the origin, O4 at (d, 0). Angles from the +x axis, counter-clockwise positive.
  theta2 input angle, theta3 coupler angle, theta4 output angle. Loop: a e^(i t2) + b e^(i t3) - c e^(i t4) - d = 0
  branch +1 = open configuration, -1 = crossed configuration
  Coupler point P: distance p from joint A along a line at angle delta to AB.
All default numbers are EXAMPLE values.
"""
import cmath
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # sibling modules (crank, dm_toolkit)

DEFAULT = {
    "name": "Oscillating transfer arm - crank-rocker example",
    "a_mm": 30.0, "b_mm": 100.0, "c_mm": 80.0, "d_mm": 100.0,
    "branch": 1,
    "p_mm": 50.0, "delta_deg": 30.0,          # coupler point
    "rpm": 120.0,                              # constant input speed
    "alpha2": 0.0,                             # input angular acceleration rad/s2
    # mass properties: m kg, CG position on the link (distance from first joint along the link, offset angle), J about CG
    "m2": 0.08, "rg2_mm": 15.0, "J2": 1.0e-5,
    "m3": 0.30, "rg3_mm": 50.0, "dg3_deg": 0.0, "J3": 3.0e-4,
    "m4": 0.25, "rg4_mm": 40.0, "J4": 1.5e-4,
    "T4_load_Nm": -5.0,                        # constant torque on the rocker (spring / weight-like: no net work per cycle)
    "c4_visc_Nms": 0.8,                        # viscous work load on the rocker: T = -c4 * w4 (does net work)
    "F_P_N": [0.0, 0.0],                       # external force at the coupler point
    "gravity": 0.0,                            # set 9.81 and the gravity direction is -y
    "tol_mm": {"a": 0.02, "b": 0.03, "c": 0.03, "d": 0.05},   # link-length tolerances +/- (3 sigma)
    "joint_clearance_mm": 0.02,                # radial clearance per pin joint
    "step_deg": 1.0,
}

# ---------------------------------------------------------------- chapter 2: classification
def grashof(a, b, c, d):
    """Grashof condition and Barker class. Returns dict."""
    L = {"a (crank)": a, "b (coupler)": b, "c (rocker)": c, "d (ground)": d}
    srt = sorted(L.items(), key=lambda kv: kv[1])
    s, l = srt[0][1], srt[-1][1]
    pq = srt[1][1] + srt[2][1]
    val = s + l - pq
    short = srt[0][0]
    if abs(val) < 1e-9:
        kind = "change-point (special Grashof): s + l = p + q, can fold - needs a guide past the flat position"
    elif val < 0:
        kind = {"a (crank)": "Grashof crank-rocker (input crank turns fully, output rocks)",
                "d (ground)": "Grashof double-crank (drag link): both cranks turn fully",
                "b (coupler)": "Grashof double-rocker (coupler turns fully)",
                "c (rocker)": "Grashof rocker-crank (output turns fully, input rocks)"}[short]
    else:
        kind = "non-Grashof triple-rocker: no link turns fully"
    return {"s": s, "l": l, "p_plus_q": pq, "s+l-(p+q)": val, "shortest": short, "class": kind}

# ---------------------------------------------------------------- chapter 3: position
def position(t2, a, b, c, d, branch=1):
    """Position by circle intersection (geometric). Returns theta3, theta4 (rad) and joint points, or None if the
    linkage cannot be assembled at this input angle."""
    A = complex(a * math.cos(t2), a * math.sin(t2))
    O4 = complex(d, 0)
    v = O4 - A
    e = abs(v)
    if e > b + c or e < abs(b - c) or e == 0:
        return None
    # distance from A to the foot of the chord along v
    x = (b * b - c * c + e * e) / (2 * e)
    h = math.sqrt(max(0.0, b * b - x * x))
    u = v / e
    B = A + x * u + branch * h * complex(-u.imag, u.real)
    t3 = cmath.phase(B - A)
    t4 = cmath.phase(B - O4)
    return {"t3": t3, "t4": t4, "A": A, "B": B, "O4": O4}

def freudenstein(t2, a, b, c, d, sign=-1):
    """Closed-form Freudenstein / Norton solution (independent check of position()).
    sign selects the root (-1 = open for the usual set-up)."""
    K1, K2, K3 = d / a, d / c, (a * a - b * b + c * c + d * d) / (2 * a * c)
    A = math.cos(t2) - K1 - K2 * math.cos(t2) + K3
    B = -2 * math.sin(t2)
    C = K1 - (K2 + 1) * math.cos(t2) + K3
    disc = B * B - 4 * A * C
    if disc < 0:
        return None
    t4 = 2 * math.atan2(-B + sign * math.sqrt(disc), 2 * A)
    K4, K5 = d / b, (c * c - d * d - a * a - b * b) / (2 * a * b)
    D = math.cos(t2) - K1 + K4 * math.cos(t2) + K5
    E = -2 * math.sin(t2)
    F = K1 + (K4 - 1) * math.cos(t2) + K5
    t3 = 2 * math.atan2(-E + sign * math.sqrt(E * E - 4 * D * F), 2 * D)
    return t3, t4

def _solve2(a11, a12, a21, a22, b1, b2):
    det = a11 * a22 - a12 * a21
    return (b1 * a22 - a12 * b2) / det, (a11 * b2 - b1 * a21) / det

# ---------------------------------------------------------------- chapter 4: velocity, acceleration
def velocity(t2, t3, t4, w2, a, b, c):
    """Closed form (Norton): w3 = a w2 sin(t4-t2) / (b sin(t3-t4)), w4 = a w2 sin(t2-t3) / (c sin(t4-t3))."""
    w3 = a * w2 * math.sin(t4 - t2) / (b * math.sin(t3 - t4))
    w4 = a * w2 * math.sin(t2 - t3) / (c * math.sin(t4 - t3))
    return w3, w4

def acceleration(t2, t3, t4, w2, w3, w4, al2, a, b, c):
    """Second derivative of the loop equation -> linear 2x2 in alpha3, alpha4.
    real: -a al2 s2 - a w2^2 c2 - b al3 s3 - b w3^2 c3 + c al4 s4 + c w4^2 c4 = 0
    imag:  a al2 c2 - a w2^2 s2 + b al3 c3 - b w3^2 s3 - c al4 c4 + c w4^2 s4 = 0"""
    s2, c2, s3, c3, s4, c4 = (math.sin(t2), math.cos(t2), math.sin(t3), math.cos(t3), math.sin(t4), math.cos(t4))
    r1 = a * al2 * s2 + a * w2 * w2 * c2 + b * w3 * w3 * c3 - c * w4 * w4 * c4
    r2 = -a * al2 * c2 + a * w2 * w2 * s2 + b * w3 * w3 * s3 - c * w4 * w4 * s4
    al3, al4 = _solve2(-b * s3, c * s4, b * c3, -c * c4, r1, r2)
    return al3, al4

def coupler_point(A, t3, w2, w3, al2, al3, t2, a, p, delta):
    """Position, velocity, acceleration of coupler point P = A + p e^(i(t3+delta))."""
    eA = cmath.exp(1j * t2)
    eP = cmath.exp(1j * (t3 + delta))
    P = A + p * eP
    vA = 1j * a * w2 * eA
    aA = (1j * al2 - w2 * w2) * a * eA
    vP = vA + 1j * p * w3 * eP
    aP = aA + (1j * al3 - w3 * w3) * p * eP
    return P, vP, aP

def transmission_angle(t2, a, b, c, d):
    """Transmission angle mu (deg, 0..180) by the cosine law: cos mu = (b^2 + c^2 - a^2 - d^2 + 2 a d cos t2) / (2 b c)."""
    cm = (b * b + c * c - a * a - d * d + 2 * a * d * math.cos(t2)) / (2 * b * c)
    return math.degrees(math.acos(max(-1.0, min(1.0, cm))))

# ---------------------------------------------------------------- chapter 5: limit positions, time ratio
def limit_positions(a, b, c, d):
    """Crank-rocker: rocker extremes when crank and coupler are collinear (extended b+a, folded b-a).
    Returns swing angle psi, crank angle between the limits, time ratio Q."""
    def t4_for(L):         # triangle O2-O4-B with O2B = L
        cosg = (c * c + d * d - L * L) / (2 * c * d)
        return math.acos(max(-1, min(1, cosg)))      # angle at O4 between O4O2 and O4B
    def t2_for(L):
        cosb = (L * L + d * d - c * c) / (2 * L * d)
        return math.acos(max(-1, min(1, cosb)))      # angle at O2 between O2O4 and O2B
    g1, g2 = t4_for(b - a), t4_for(b + a)
    psi = abs(g2 - g1)
    beta1, beta2 = t2_for(b - a), t2_for(b + a)
    # folded: crank points opposite to B -> crank angle = pi + beta1 ; extended: crank angle = beta2
    alpha = abs(math.pi - abs((math.pi + beta1) - beta2))   # angle the crank turns 'less than 180' between limits
    Q = (math.pi + alpha) / (math.pi - alpha)
    return {"psi_deg": math.degrees(psi), "alpha_deg": math.degrees(alpha), "Q": Q,
            "t2_extended_deg": math.degrees(beta2), "t2_folded_deg": math.degrees(math.pi + beta1)}

# ---------------------------------------------------------------- chapter 6: synthesis
def solve_linear(A, bvec):
    n = len(bvec)
    M = [row[:] + [bvec[i]] for i, row in enumerate(A)]
    for k in range(n):
        piv = max(range(k, n), key=lambda i: abs(M[i][k]))
        M[k], M[piv] = M[piv], M[k]
        for i in range(k + 1, n):
            f = M[i][k] / M[k][k]
            for j in range(k, n + 1):
                M[i][j] -= f * M[k][j]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = (M[i][n] - sum(M[i][j] * x[j] for j in range(i + 1, n))) / M[i][i]
    return x

def chebyshev_points(x0, x1, n=3):
    """Chebyshev spacing x_j = (x0+x1)/2 - (x1-x0)/2 cos((2j-1) pi / (2n))."""
    return [(x0 + x1) / 2 - (x1 - x0) / 2 * math.cos((2 * j - 1) * math.pi / (2 * n)) for j in range(1, n + 1)]

def freudenstein_synthesis(pairs, d=1.0):
    """Function generation, 3 precision points. pairs = [(theta2, theta4)] rad.
    Freudenstein: R1 cos t4 - R2 cos t2 + R3 = cos(t2 - t4), R1 = d/a, R2 = d/c, R3 = (a^2-b^2+c^2+d^2)/(2ac)."""
    A = [[math.cos(t4), -math.cos(t2), 1.0] for t2, t4 in pairs]
    rhs = [math.cos(t2 - t4) for t2, t4 in pairs]
    R1, R2, R3 = solve_linear(A, rhs)
    a = d / R1
    c = d / R2
    b2 = a * a + c * c + d * d - 2 * a * c * R3
    if b2 <= 0:
        return None
    # a negative length means that link points the other way: use |length| and add 180 deg to its angle
    off2 = math.pi if a < 0 else 0.0
    off4 = math.pi if c < 0 else 0.0
    return {"R": (R1, R2, R3), "a": abs(a), "b": math.sqrt(b2), "c": abs(c), "d": d,
            "a_signed": a, "c_signed": c, "off2": off2, "off4": off4}

def function_generator_example(t20_deg=30.0, t40_deg=120.0, dt2_deg=90.0, dt4_deg=45.0, n_check=101, x_range=(1.0, 10.0)):
    """Function generator y = log10(x), 1 <= x <= 10 (Chebyshev spacing, Freudenstein, d = 1).
    Default ranges/start angles were chosen by a search so the linkage works over the whole range with a good
    transmission angle (guide chapter 6). Call with (45, 135, 60, 90) to see a linkage with a branch defect.
    Returns link lengths, branch, structural error curve, min transmission angle, or the defect position."""
    x0, x1 = x_range
    dt2, dt4, t20, t40 = (math.radians(v) for v in (dt2_deg, dt4_deg, t20_deg, t40_deg))
    f = math.log10
    def t2_of(x): return t20 + (x - x0) / (x1 - x0) * dt2
    def t4_of(y): return t40 + (y - f(x0)) / (f(x1) - f(x0)) * dt4
    xs = chebyshev_points(x0, x1, 3)
    pairs = [(t2_of(x), t4_of(f(x))) for x in xs]
    sol = freudenstein_synthesis(pairs, 1.0)
    a, b, c, d = sol["a"], sol["b"], sol["c"], sol["d"]
    o2, o4 = sol["off2"], sol["off4"]
    br = None
    for bb in (1, -1):                      # the branch that reproduces the precision points
        if all((lambda q: q is not None and abs(_wrap(q["t4"] - o4 - t4p)) < 1e-6)(position(t2p + o2, a, b, c, d, bb))
               for t2p, t4p in pairs):
            br = bb
    res = {"x_precision": xs, "pairs_deg": [(math.degrees(p), math.degrees(q)) for p, q in pairs],
           "links": (a, b, c, d), "signed": (sol["a_signed"], sol["c_signed"]), "branch": br}
    errs, mus, defect = [], [], None
    for k in range(n_check):
        x = x0 + (x1 - x0) * k / (n_check - 1)
        pos = position(t2_of(x) + o2, a, b, c, d, br) if br else None
        if pos is None:
            defect = x
            break
        y_gen = f(x0) + (_wrap(pos["t4"] - o4 - t40)) / dt4 * (f(x1) - f(x0))
        errs.append((x, y_gen - f(x)))
        mus.append(transmission_angle(t2_of(x) + o2, a, b, c, d))
    res.update({"defect_at_x": defect, "errors": errs,
                "max_error_y": max(abs(e) for _, e in errs) if errs and defect is None else None,
                "mu_min": min(min(mus), 180 - max(mus)) if mus else None})
    if res["max_error_y"] is not None:
        res["error_pct_of_range"] = 100 * res["max_error_y"] / (f(x1) - f(x0))
    return res

def crank_rocker_Q1(c, psi_deg, L_extra, theta4_mid_deg=90.0):
    """Synthesis of a crank-rocker with time ratio Q = 1 (no quick return) for rocker length c and swing psi.
    O4 at origin; rocker extremes B1, B2 symmetric about theta4_mid. O2 lies on line B1B2 extended beyond B1 at
    distance L_extra from B1. Then a = |B1B2|/2, b = L_extra + a, d = |O2 O4|."""
    h = math.radians(psi_deg) / 2
    m = math.radians(theta4_mid_deg)
    B1 = c * cmath.exp(1j * (m + h))
    B2 = c * cmath.exp(1j * (m - h))
    u = (B1 - B2) / abs(B1 - B2)
    O2 = B1 + L_extra * u
    a = abs(B1 - B2) / 2
    b = L_extra + a
    d = abs(O2)
    return {"a": a, "b": b, "c": c, "d": d, "O2": (O2.real, O2.imag), "B1": (B1.real, B1.imag),
            "B2": (B2.real, B2.imag)}

def _wrap(x):
    return (x + math.pi) % (2 * math.pi) - math.pi

# ---------------------------------------------------------------- chapter 7: dynamics (Newton-Euler)
def dynamics_at(t2, P, branch=None):
    """Inverse dynamics, 9 unknowns: F12x F12y F32x F32y F43x F43y F14x F14y T12.
    Fij = force of link i on link j. Returns forces (N), input torque T12 (N m), shaking force and moment."""
    a, b, c, d = (P["a_mm"] / 1000, P["b_mm"] / 1000, P["c_mm"] / 1000, P["d_mm"] / 1000)
    br = P["branch"] if branch is None else branch
    w2 = P["rpm"] * 2 * math.pi / 60
    al2 = P["alpha2"]
    pos = position(t2, a, b, c, d, br)
    t3, t4 = pos["t3"], pos["t4"]
    w3, w4 = velocity(t2, t3, t4, w2, a, b, c)
    al3, al4 = acceleration(t2, t3, t4, w2, w3, w4, al2, a, b, c)
    A, B, O4 = pos["A"], pos["B"], pos["O4"]
    # CG positions and accelerations
    rg2 = P["rg2_mm"] / 1000
    g2 = rg2 * cmath.exp(1j * t2)
    ag2 = (1j * al2 - w2 * w2) * g2
    rg3, dg3 = P["rg3_mm"] / 1000, math.radians(P["dg3_deg"])
    e3 = cmath.exp(1j * (t3 + dg3))
    g3 = A + rg3 * e3
    aA = (1j * al2 - w2 * w2) * A
    ag3 = aA + (1j * al3 - w3 * w3) * rg3 * e3
    rg4 = P["rg4_mm"] / 1000
    g4 = O4 + rg4 * cmath.exp(1j * t4)
    ag4 = (1j * al4 - w4 * w4) * rg4 * cmath.exp(1j * t4)
    m2, m3, m4, J2, J3, J4 = P["m2"], P["m3"], P["m4"], P["J2"], P["J3"], P["J4"]
    gv = -P["gravity"]
    # coupler point external force
    pP, dP = P["p_mm"] / 1000, math.radians(P["delta_deg"])
    Pp = A + pP * cmath.exp(1j * (t3 + dP))
    FP = complex(*P["F_P_N"])
    T4 = P["T4_load_Nm"] - P.get("c4_visc_Nms", 0.0) * w4
    def cross(r, F):
        return r.real * F.imag - r.imag * F.real
    # unknown vector x = [F12x,F12y,F32x,F32y,F43x,F43y,F14x,F14y,T12]
    # link 2 (pivot O2, pin A): F12 + F32 = m2 ag2 - m2 g ; (O2-g2)xF12 + (A-g2)xF32 + T12 = J2 al2
    # link 3: -F32 + F43 + FP = m3 ag3 ; (A-g3)x(-F32) + (B-g3)xF43 + (Pp-g3)xFP = J3 al3
    # link 4: -F43 + F14 = m4 ag4 ; (B-g4)x(-F43) + (O4-g4)xF14 + T4 = J4 al4
    R12 = 0 - g2; R32 = A - g2
    R23 = A - g3; R43 = B - g3; RP = Pp - g3
    R34 = B - g4; R14 = O4 - g4
    rows = [
        [1, 0, 1, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 1, 0, 0, 0, 0, 0],
        [-R12.imag, R12.real, -R32.imag, R32.real, 0, 0, 0, 0, 1],
        [0, 0, -1, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, -1, 0, 1, 0, 0, 0],
        [0, 0, R23.imag, -R23.real, -R43.imag, R43.real, 0, 0, 0],
        [0, 0, 0, 0, -1, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, -1, 0, 1, 0],
        [0, 0, 0, 0, R34.imag, -R34.real, -R14.imag, R14.real, 0],
    ]
    rhs = [m2 * ag2.real, m2 * ag2.imag - m2 * gv, J2 * al2,
           m3 * ag3.real - FP.real, m3 * ag3.imag - FP.imag - m3 * gv, J3 * al3 - cross(RP, FP),
           m4 * ag4.real, m4 * ag4.imag - m4 * gv, J4 * al4 - T4]
    x = solve_linear(rows, rhs)
    F12, F32, F43, F14, T12 = complex(x[0], x[1]), complex(x[2], x[3]), complex(x[4], x[5]), complex(x[6], x[7]), x[8]
    shake = -(F12 + F14)                       # force of the linkage on the ground (frame) = -(F12+F14)
    shake_M = -(cross(complex(0, 0), F12) + cross(O4, F14)) - T12   # moment on frame about O2 (incl. reaction of T12)
    # energy check: input power = d/dt(kinetic) - external power
    vg2 = 1j * w2 * g2
    vA = 1j * w2 * A
    vg3 = vA + 1j * w3 * rg3 * e3
    vg4 = 1j * w4 * rg4 * cmath.exp(1j * t4)
    vP = vA + 1j * w3 * pP * cmath.exp(1j * (t3 + dP))
    dKE = (m2 * (ag2.real * vg2.real + ag2.imag * vg2.imag) + J2 * al2 * w2 +
           m3 * (ag3.real * vg3.real + ag3.imag * vg3.imag) + J3 * al3 * w3 +
           m4 * (ag4.real * vg4.real + ag4.imag * vg4.imag) + J4 * al4 * w4)
    dPE = -gv * (m2 * vg2.imag + m3 * vg3.imag + m4 * vg4.imag)
    P_ext = T4 * w4 + (FP.real * vP.real + FP.imag * vP.imag)
    T_energy = (dKE + dPE - P_ext) / w2
    return {"t2": t2, "t3": t3, "t4": t4, "w3": w3, "w4": w4, "al3": al3, "al4": al4,
            "F12": F12, "F32": F32, "F43": F43, "F14": F14, "T12": T12, "T_energy": T_energy,
            "shake": shake, "shake_M": shake_M, "P": Pp, "mu": transmission_angle(t2, a, b, c, d)}

# ---------------------------------------------------------------- chapter 9: tolerances
def sensitivity(t2, P, h=1e-4):
    """d theta4 / d(link length) [deg per mm] by central differences."""
    base = {k: P[k + "_mm"] for k in "abcd"}
    out = {}
    for k in "abcd":
        vals = []
        for s in (+1, -1):
            L = dict(base)
            L[k] += s * h
            pos = position(t2, L["a"], L["b"], L["c"], L["d"], P["branch"])
            vals.append(pos["t4"])
        out[k] = math.degrees(_wrap(vals[0] - vals[1])) / (2 * h)
    return out

def tolerance_mc(t2, P, n=20000, seed=1):
    """Monte Carlo of the output angle error: link lengths normal with sigma = tol/3."""
    rnd = random.Random(seed)
    base = position(t2, P["a_mm"], P["b_mm"], P["c_mm"], P["d_mm"], P["branch"])["t4"]
    errs = []
    for _ in range(n):
        L = {k: P[k + "_mm"] + rnd.gauss(0, P["tol_mm"][k] / 3) for k in "abcd"}
        pos = position(t2, L["a"], L["b"], L["c"], L["d"], P["branch"])
        errs.append(math.degrees(_wrap(pos["t4"] - base)))
    m = sum(errs) / n
    sd = math.sqrt(sum((e - m) ** 2 for e in errs) / (n - 1))
    s = sensitivity(t2, P)
    rss = math.sqrt(sum((s[k] * P["tol_mm"][k]) ** 2 for k in "abcd"))
    wc = sum(abs(s[k]) * P["tol_mm"][k] for k in "abcd")
    return {"mean_deg": m, "sd_deg": sd, "3sd_deg": 3 * sd, "rss_3s_deg": rss, "wc_deg": wc, "sens": s}

def clearance_play(P, t2):
    """Output play from joint clearances: each joint lets the chain move by up to 2*clearance along the critical
    direction (rough upper bound). Output angle play ~ sum of joint play / c (deg)."""
    cl = P["joint_clearance_mm"]
    return math.degrees(4 * 2 * cl / P["c_mm"])

# ---------------------------------------------------------------- sweep + report
def sweep(P):
    a, b, c, d = (P[k + "_mm"] for k in "abcd")
    rows = []
    n = int(round(360 / P["step_deg"]))
    w2 = P["rpm"] * 2 * math.pi / 60
    for k in range(n):
        t2 = math.radians(k * P["step_deg"])
        pos = position(t2, a, b, c, d, P["branch"])
        if pos is None:
            rows.append(None)
            continue
        dyn = dynamics_at(t2, P)
        rows.append(dyn)
    return rows

def summary(P, rows):
    a, b, c, d = (P[k + "_mm"] for k in "abcd")
    ok = [r for r in rows if r]
    mus = [r["mu"] for r in ok]
    t4s = [math.degrees(r["t4"]) for r in ok]
    T = [r["T12"] for r in ok]
    n = len(ok)
    w2 = P["rpm"] * 2 * math.pi / 60
    Tm = sum(T) / n
    E, Emin, Emax = 0.0, 0.0, 0.0
    for t in T:
        E += (t - Tm) * 2 * math.pi / n
        Emin, Emax = min(Emin, E), max(Emax, E)
    pin = {k: max(abs(r[k]) for r in ok) for k in ("F12", "F32", "F43", "F14")}
    return {"assemblable_pct": 100 * n / len(rows), "mu_min": min(mus), "mu_max": max(mus),
            "mu_dev_max": max(abs(90 - m) for m in mus),
            "t4_min": min(t4s), "t4_max": max(t4s), "swing": max(t4s) - min(t4s),
            "w4_max": max(abs(r["w4"]) for r in ok), "al4_max": max(abs(r["al4"]) for r in ok),
            "T_mean": Tm, "T_max": max(T), "T_min": min(T), "P_mean_W": Tm * w2, "dE_J": Emax - Emin,
            "pin_max": pin, "shake_max": max(abs(r["shake"]) for r in ok),
            "shakeM_max": max(abs(r["shake_M"]) for r in ok)}

def report_text(P, rows):
    a, b, c, d = (P[k + "_mm"] for k in "abcd")
    g = grashof(a, b, c, d)
    s = summary(P, rows)
    lp = limit_positions(a, b, c, d) if g["class"].startswith("Grashof crank-rocker") else None
    tm = tolerance_mc(math.radians(90), P)
    L = ["# Four-bar linkage report - %s\n" % P["name"],
         "Links a %.2f, b %.2f, c %.2f, d %.2f mm, branch %+d, %.0f rpm" % (a, b, c, d, P["branch"], P["rpm"]),
         "\n## Classification\n- s + l = %.2f, p + q = %.2f -> %s" % (g["s"] + g["l"], g["p_plus_q"], g["class"]),
         "\n## Motion\n- assemblable over %.0f %% of the input turn" % s["assemblable_pct"],
         "- rocker angle %.2f ... %.2f deg, swing %.2f deg; max |w4| %.2f rad/s, max |alpha4| %.1f rad/s2" % (
             s["t4_min"], s["t4_max"], s["swing"], s["w4_max"], s["al4_max"]),
         "- transmission angle %.1f ... %.1f deg (max deviation from 90 deg: %.1f)" % (s["mu_min"], s["mu_max"], s["mu_dev_max"])]
    if lp:
        L.append("- limit positions: swing %.2f deg, crank angle difference alpha %.2f deg, time ratio Q %.4f" % (
            lp["psi_deg"], lp["alpha_deg"], lp["Q"]))
    L += ["\n## Dynamics\n- input torque mean %.3f, max %.3f, min %.3f N m; mean power %.1f W; energy fluctuation %.3f J" % (
              s["T_mean"], s["T_max"], s["T_min"], s["P_mean_W"], s["dE_J"]),
          "- pin forces max: O2 %.1f, A %.1f, B %.1f, O4 %.1f N" % tuple(s["pin_max"][k] for k in ("F12", "F32", "F43", "F14")),
          "- shaking force max %.1f N, shaking moment max %.3f N m" % (s["shake_max"], s["shakeM_max"]),
          "\n## Tolerances (at theta2 = 90 deg)\n- sensitivity dtheta4/dL [deg/mm]: " +
          ", ".join("%s %.4f" % (k, v) for k, v in tm["sens"].items()),
          "- output angle error: Monte Carlo 3 sigma %.4f deg, RSS %.4f deg, worst case %.4f deg; joint play ~%.3f deg" % (
              tm["3sd_deg"], tm["rss_3s_deg"], tm["wc_deg"], clearance_play(P, math.radians(90)))]
    return "\n".join(L)

def run(P, out):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from crank import _svg_line
    os.makedirs(out, exist_ok=True)
    rows = sweep(P)
    ok = [r for r in rows if r]
    with open(os.path.join(out, "fourbar.csv"), "w", encoding="utf-8") as f:
        f.write("theta2_deg,theta3_deg,theta4_deg,w3,w4,al3,al4,mu_deg,Px_mm,Py_mm,T12_Nm,F12_N,F32_N,F43_N,F14_N,shake_N,shakeM_Nm\n")
        for r in ok:
            f.write("%.2f,%.4f,%.4f,%.5f,%.5f,%.3f,%.3f,%.3f,%.3f,%.3f,%.5f,%.3f,%.3f,%.3f,%.3f,%.3f,%.5f\n" % (
                math.degrees(r["t2"]), math.degrees(r["t3"]), math.degrees(r["t4"]), r["w3"], r["w4"], r["al3"], r["al4"],
                r["mu"], r["P"].real * 1e3, r["P"].imag * 1e3, r["T12"], abs(r["F12"]), abs(r["F32"]), abs(r["F43"]),
                abs(r["F14"]), abs(r["shake"]), r["shake_M"]))
    t2 = [math.degrees(r["t2"]) for r in ok]
    a, b, c, d = (P[k + "_mm"] for k in "abcd")
    mech = []
    for ang in (0, 90, 180, 270):
        pos = position(math.radians(ang), a, b, c, d, P["branch"])
        if pos:
            mech.append(("theta2 = %d" % ang, [(0, 0), (pos["A"].real, pos["A"].imag), (pos["B"].real, pos["B"].imag),
                                               (d, 0)], "#999999"))
    svgs = {
        "coupler_curve.svg": _svg_line([("coupler point path", [(r["P"].real * 1e3, r["P"].imag * 1e3) for r in ok], "#d62728")] + mech,
                                       title="Linkage positions and coupler curve [mm]", xl="x [mm]", yl="y [mm]", polar=True),
        "angles.svg": _svg_line([("theta4 [deg]", list(zip(t2, [math.degrees(r["t4"]) for r in ok])), "#1f77b4"),
                                 ("transmission angle [deg]", list(zip(t2, [r["mu"] for r in ok])), "#2ca02c")],
                                title="Output angle and transmission angle", xl="theta2 [deg]", yl="deg"),
        "torque.svg": _svg_line([("input torque T12", list(zip(t2, [r["T12"] for r in ok])), "#d62728")],
                                title="Input torque", xl="theta2 [deg]", yl="N m"),
        "pin_forces.svg": _svg_line([(k, list(zip(t2, [abs(r[k]) for r in ok])), col) for k, col in
                                     (("F12", "#1f77b4"), ("F32", "#ff7f0e"), ("F43", "#2ca02c"), ("F14", "#9467bd"))],
                                    title="Pin forces |F|", xl="theta2 [deg]", yl="N"),
    }
    for k, v in svgs.items():
        with open(os.path.join(out, k), "w", encoding="utf-8") as f:
            f.write(v)
    rep = report_text(P, rows)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    print(rep)
    print("written: report.md, fourbar.csv,", ", ".join(svgs), "->", out)


# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2
def mobility(n, j1, j2=0):
    """Gruebler-Kutzbach mobility of a planar mechanism: M = 3 (n - 1) - 2 j1 - j2.
    n = number of links incl. the ground, j1 = full joints (pin, slider), j2 = half joints (cam, rolling+sliding)."""
    return 3 * (n - 1) - 2 * j1 - j2


def toggle_gain(alpha_deg):
    """Symmetric toggle (two equal links meeting at the knee, angle alpha to the line of action).
    Knee force F_in perpendicular to the line of action -> each link force S = F_in / (2 sin alpha),
    output force along the line F_out = S cos alpha = F_in / (2 tan alpha). Returns F_out / F_in."""
    return 1.0 / (2.0 * math.tan(math.radians(alpha_deg)))


def slider_limit(a, b, R, t2_deg):
    """Four-bar whose rocker (length R, pivot far away at (b, R)) replaces the slider of a slider-crank.
    The circle of B touches the slider axis (x axis) at x = b. Returns (B_x four-bar, s exact slider-crank, error mm)."""
    t2 = math.radians(t2_deg)
    A = complex(a * math.cos(t2), a * math.sin(t2))
    O4 = complex(b, R)
    v = O4 - A
    e = abs(v)
    x = (b * b - R * R + e * e) / (2 * e)
    h = math.sqrt(max(0.0, b * b - x * x))
    u = v / e
    cands = [A + x * u + s * h * complex(-u.imag, u.real) for s in (1, -1)]
    B = min(cands, key=lambda z: abs(z.imag))          # the branch near the slider axis
    s_exact = a * math.cos(t2) + math.sqrt(b * b - (a * math.sin(t2)) ** 2)
    return B.real, s_exact, B.real - s_exact


def assembly_range(a, b, c, d, step_deg=0.5):
    """Input angles (deg) where the linkage can be assembled (|O4 A| inside [|b - c|, b + c])."""
    ok = []
    k = 0.0
    while k < 360.0:
        if position(math.radians(k), a, b, c, d, 1) is not None:
            ok.append(k)
        k += step_deg
    if not ok:
        return []
    # group into continuous ranges
    rng, start, prev = [], ok[0], ok[0]
    for v in ok[1:]:
        if v - prev > step_deg + 1e-9:
            rng.append((start, prev))
            start = v
        prev = v
    rng.append((start, prev))
    if len(rng) > 1 and rng[0][0] == 0.0 and abs(rng[-1][1] - (360 - step_deg)) < 1e-9:
        rng = [(rng[-1][0] - 360, rng[0][1])] + rng[1:-1]
    return rng


# ---------------------------------------------------------------- chapter 4
def instant_centre_I24(t2, a, b, c, d, branch=1):
    """Kennedy: I24 lies on line O2-O4 (I12-I14, here the x axis) and on line A-B (I23-I34).
    Returns x of I24 and the velocity ratio w4/w2 = (I24 - O2)/(I24 - O4) (signed)."""
    pos = position(t2, a, b, c, d, branch)
    A, B = pos["A"], pos["B"]
    dv = B - A
    t = -A.imag / dv.imag
    x24 = A.real + t * dv.real
    return x24, x24 / (x24 - d)


def mechanical_advantage(t2, a, b, c, d, branch=1):
    """Ideal MA = T4/T2 = w2/w4 (power in = power out, no losses).
    Same value from the angles: MA = c sin(t4 - t3) / (a sin(t2 - t3)) = c sin(mu)/(a sin(nu)), nu = angle crank-coupler."""
    pos = position(t2, a, b, c, d, branch)
    t3, t4 = pos["t3"], pos["t4"]
    w3, w4 = velocity(t2, t3, t4, 1.0, a, b, c)
    ma_w = 1.0 / w4
    ma_ang = c * math.sin(t4 - t3) / (a * math.sin(t2 - t3))
    nu = math.degrees(abs(_wrap(t2 - t3)))
    return ma_w, ma_ang, transmission_angle(t2, a, b, c, d), nu


def mu_extremes(a, b, c, d):
    """Extreme transmission angles of a crank-rocker at t2 = 0 and 180 deg:
    cos mu = (b^2 + c^2 - (d -+ a)^2) / (2 b c)."""
    m0 = math.degrees(math.acos((b * b + c * c - (d - a) ** 2) / (2 * b * c)))
    m180 = math.degrees(math.acos((b * b + c * c - (d + a) ** 2) / (2 * b * c)))
    return m0, m180


def demo_ch24():
    P = dict(DEFAULT)
    a, b, c, d = (P[k + "_mm"] for k in "abcd")
    w2 = P["rpm"] * 2 * math.pi / 60
    print("## Chapter 2 - mobility (Gruebler-Kutzbach M = 3(n-1) - 2 j1 - j2)")
    for name, n, j1, j2 in (("four-bar", 4, 4, 0), ("slider-crank", 4, 4, 0), ("Watt / Stephenson six-bar", 6, 7, 0),
                            ("five-bar (two inputs)", 5, 5, 0), ("triangle (structure)", 3, 3, 0),
                            ("cam + roller follower (roller pinned)", 4, 3, 1),
                            ("pneumatic toggle clamp (cylinder + lever + link + arm)", 6, 7, 0)):
        print("  %-55s n %d j1 %d j2 %d -> M = %d" % (name, n, j1, j2, mobility(n, j1, j2)))
    print("## Grashof / Barker classes")
    for L in ((30, 100, 80, 100), (100, 80, 60, 30), (60, 30, 100, 80), (60, 90, 30, 80), (50, 80, 70, 40),
              (70, 100, 60, 80), (40, 80, 40, 80)):
        g = grashof(*L)
        print("  a b c d = %-20s s+l %5.1f p+q %5.1f -> %s" % (L, g["s"] + g["l"], g["p_plus_q"], g["class"]))
    print("## Toggle force gain F_out/F_in = 1/(2 tan alpha)")
    for al in (20, 10, 5, 2, 1):
        print("  alpha %4.1f deg -> gain %7.3f" % (al, toggle_gain(al)))
    print("## Slider-crank as the limit of a four-bar (a 23, b 90 mm, M2 crank) - error of B_x vs exact slider")
    for R in (200, 1000, 5000, 50000):
        e = max(abs(slider_limit(23, 90, R, t)[2]) for t in range(0, 360, 5))
        print("  rocker R %6d mm -> max |error| %.5f mm" % (R, e))
    print("## Chapter 3 - assembly ranges")
    for L in ((30, 100, 80, 100), (70, 100, 60, 80), (60, 30, 100, 80)):
        print("  a b c d = %-18s assemblable theta2 ranges [deg]: %s" % (L, assembly_range(*L)))
    lp = limit_positions(a, b, c, d)
    print("  DEFAULT limit positions: extended theta2 %.3f, folded theta2 %.3f deg, alpha %.3f, swing %.3f deg, Q %.4f" % (
        lp["t2_extended_deg"], lp["t2_folded_deg"], lp["alpha_deg"], lp["psi_deg"], lp["Q"]))
    for name, t2d in (("extended", lp["t2_extended_deg"]), ("folded", lp["t2_folded_deg"])):
        pos = position(math.radians(t2d), a, b, c, d, 1)
        w3, w4 = velocity(math.radians(t2d), pos["t3"], pos["t4"], w2, a, b, c)
        print("    at %-8s theta4 %.3f deg, w4 %.2e rad/s (zero = dead point of the rocker)" % (name, math.degrees(pos["t4"]), w4))
    print("  forward stroke %.3f deg of crank, return %.3f deg; at %.0f rpm: %.4f s / %.4f s" % (
        180 + lp["alpha_deg"], 180 - lp["alpha_deg"], P["rpm"], (180 + lp["alpha_deg"]) / 360 * 60 / P["rpm"],
        (180 - lp["alpha_deg"]) / 360 * 60 / P["rpm"]))
    t2 = math.radians(90)
    for br in (1, -1):
        pos = position(t2, a, b, c, d, br)
        print("  theta2 90: branch %+d -> theta3 %.3f, theta4 %.3f deg, B = (%.3f, %.3f) mm" % (
            br, math.degrees(pos["t3"]), math.degrees(pos["t4"]), pos["B"].real, pos["B"].imag))
    K1, K2, K3 = d / a, d / c, (a * a - b * b + c * c + d * d) / (2 * a * c)
    K4, K5 = d / b, (c * c - d * d - a * a - b * b) / (2 * a * b)
    print("  K1 %.5f K2 %.5f K3 %.5f K4 %.5f K5 %.5f" % (K1, K2, K3, K4, K5))
    for s in (-1, 1):
        t3, t4 = freudenstein(t2, a, b, c, d, s)
        print("  Freudenstein root sign %+d: theta3 %.3f, theta4 %.3f deg" % (s, math.degrees(t3), math.degrees(t4)))
    print("## Chapter 4 - velocity, IC, MA, coupler point (DEFAULT, %.0f rpm, w2 = %.4f rad/s)" % (P["rpm"], w2))
    print("  t2  w4 (closed)  w4/w2  I24_x[mm]  w4/w2 (IC)  MA=T4/T2  MA(angles)  mu  nu")
    for t2d in (0, 45, 90, 135, 180, 225, 270, 315):
        t = math.radians(t2d)
        pos = position(t, a, b, c, d, 1)
        w3, w4 = velocity(t, pos["t3"], pos["t4"], w2, a, b, c)
        x24, r = instant_centre_I24(t, a, b, c, d)
        ma, ma2, mu, nu = mechanical_advantage(t, a, b, c, d)
        print("  %3d %9.4f %8.5f %10.2f %10.5f %9.3f %9.3f %6.2f %6.2f" % (t2d, w4, w4 / w2, x24, r, ma, ma2, mu, nu))
    m0, m180 = mu_extremes(a, b, c, d)
    print("  mu extremes: at theta2 0 -> %.2f deg, at 180 -> %.2f deg" % (m0, m180))
    t = math.radians(90)
    pos = position(t, a, b, c, d, 1)
    w3, w4 = velocity(t, pos["t3"], pos["t4"], w2, a, b, c)
    al3, al4 = acceleration(t, pos["t3"], pos["t4"], w2, w3, w4, 0.0, a, b, c)
    Pp, vP, aP = coupler_point(pos["A"], pos["t3"], w2, w3, 0.0, al3, t, a, P["p_mm"], math.radians(P["delta_deg"]))
    print("  theta2 90: w3 %.4f w4 %.4f rad/s, al3 %.3f al4 %.3f rad/s2" % (w3, w4, al3, al4))
    print("  coupler point P (%.3f, %.3f) mm, |vP| %.4f m/s, |aP| %.3f m/s2" % (Pp.real, Pp.imag, abs(vP) / 1000, abs(aP) / 1000))
    # rocker tip speed / acceleration for design advice (tool 80 mm on rocker)
    rows = sweep(P)
    w4m = max(abs(r["w4"]) for r in rows if r)
    a4m = max(abs(r["al4"]) for r in rows if r)
    print("  rocker max |w4| %.3f rad/s, max |al4| %.2f rad/s2 -> tip (c = 80 mm) v %.3f m/s, tangential a %.2f m/s2" % (
        w4m, a4m, w4m * c / 1000, a4m * c / 1000))
    print("  inertia torque on a 0.002 kg m2 tool on the rocker: J al4 max = %.3f N m" % (0.002 * a4m))
    # speed scaling of inertia torque
    print("  alpha4 scales with rpm^2: at 240 rpm max |al4| = %.1f rad/s2" % (a4m * 4))
    print("  number of instant centres for n = 4 links: %d; n = 6: %d" % (4 * 3 // 2, 6 * 5 // 2))

# ================================================================ added with guide chapters (ch56)
# ---------------------------------------------------------------- chapter 5: coupler curves
def position_general(O2, O4, a, b, c, t2_global, branch=1):
    """Four-bar with ground pivots anywhere (complex O2, O4). Input crank angle t2_global measured from +x.
    Rotates into the standard frame (O4 on +x), calls position(), rotates back. Returns A, B (complex) or None."""
    g = O4 - O2
    d = abs(g)
    rot = cmath.exp(1j * cmath.phase(g))
    pos = position(t2_global - cmath.phase(g), a, b, c, d, branch)
    if pos is None:
        return None
    return {"A": O2 + pos["A"] * rot, "B": O2 + pos["B"] * rot}

def coupler_curve(a, b, c, d, p, delta_deg, branch=1, n=360):
    """Coupler-point path over one input turn (points where the linkage can be assembled).
    Returns list of (theta2_rad, P complex)."""
    dl = math.radians(delta_deg)
    out = []
    for k in range(n):
        t2 = 2 * math.pi * k / n
        pos = position(t2, a, b, c, d, branch)
        if pos:
            out.append((t2, pos["A"] + p * cmath.exp(1j * (pos["t3"] + dl))))
    return out

def _seg_cross(p1, p2, p3, p4):
    def orient(a, b, c):
        return (b.real - a.real) * (c.imag - a.imag) - (b.imag - a.imag) * (c.real - a.real)
    d1, d2, d3, d4 = orient(p3, p4, p1), orient(p3, p4, p2), orient(p1, p2, p3), orient(p1, p2, p4)
    return d1 * d2 < 0 and d3 * d4 < 0

def curve_shape(a, b, c, d, p, delta_deg, branch=1, n=720):
    """Classify a closed coupler curve: number of self-crossings (0 = oval-like, 1 = figure-eight),
    cusp indicator = min speed / mean speed (near 0 -> cusp), size and length."""
    pts = [P for _, P in coupler_curve(a, b, c, d, p, delta_deg, branch, n)]
    m = len(pts)
    segs = [(pts[i], pts[(i + 1) % m]) for i in range(m)]
    cross = 0
    for i in range(m):
        for j in range(i + 2, m):
            if i == 0 and j == m - 1:
                continue
            if _seg_cross(segs[i][0], segs[i][1], segs[j][0], segs[j][1]):
                cross += 1
    lens = [abs(s[1] - s[0]) for s in segs]
    L = sum(lens)
    xs, ys = [q.real for q in pts], [q.imag for q in pts]
    if cross > 10:
        kind = "degenerate: runs back and forth on one arc (rocker pin B)"
    else:
        kind = "figure-eight (crosses itself)" if cross == 1 else ("oval / single loop" if cross == 0 else
                                                                  "%d self-crossings" % cross)
    ratio = min(lens) / (L / m)
    if ratio < 0.05 and cross <= 10:
        kind += ", cusp (point almost stops)"
    return {"crossings": cross, "length": L, "width": max(xs) - min(xs), "height": max(ys) - min(ys),
            "min_speed_ratio": ratio, "kind": kind}

def straightness(a, b, c, d, p, delta_deg, branch, window_deg, n=720):
    """Best straight portion of a coupler curve: over every input window of window_deg, fit a line (least squares,
    principal axis) and take the max perpendicular deviation. Returns the best window: start angle, straight length,
    max deviation, deviation in % of length, speed variation along the line at constant input speed."""
    curve = coupler_curve(a, b, c, d, p, delta_deg, branch, n)
    step = 360.0 / n
    w = int(round(window_deg / step))
    best = None
    if len(curve) < n:          # partly assemblable (double-rocker): use only the continuous part
        pass
    for s0 in range(len(curve) - w if len(curve) < n else len(curve)):
        seg = [curve[(s0 + k) % len(curve)] for k in range(w + 1)]
        if len(curve) < n and any(abs(_wrap(seg[k + 1][0] - seg[k][0]) - math.radians(step)) > 1e-9 for k in range(w)):
            continue
        P = [q for _, q in seg]
        mx = sum(z.real for z in P) / len(P)
        my = sum(z.imag for z in P) / len(P)
        sxx = sum((z.real - mx) ** 2 for z in P)
        syy = sum((z.imag - my) ** 2 for z in P)
        sxy = sum((z.real - mx) * (z.imag - my) for z in P)
        ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
        u = complex(math.cos(ang), math.sin(ang))
        dev = max(abs(((z - complex(mx, my)) / u).imag) for z in P)
        along = [((z - complex(mx, my)) / u).real for z in P]
        length = max(along) - min(along)
        if best is None or dev / length < best["dev"] / best["length"]:
            sp = [abs(along[k + 1] - along[k]) for k in range(w)]
            best = {"start_deg": math.degrees(seg[0][0]), "length": length, "dev": dev, "dev_pct": 100 * dev / length,
                    "speed_var_pct": 100 * (max(sp) - min(sp)) / (sum(sp) / len(sp)), "angle_deg": math.degrees(ang)}
    return best

def cognates(a, b, c, d, p, delta_deg):
    """Roberts-Chebyshev cognates. Original: O2 = 0, O4 = d, coupler point P = A + k (B - A), k = (p/b) e^(i delta).
    Third pivot O6 = O2 + k (O4 - O2). Cognate 2 (pivots O2, O6): links |k| b, |k| a, |k| c, ground |k| d.
    Cognate 3 (pivots O4, O6): links |1-k| b, |1-k| c, |1-k| a, ground |1-k| d. Returns the three linkages."""
    k = (p / b) * cmath.exp(1j * math.radians(delta_deg))
    O2, O4 = 0j, complex(d, 0)
    O6 = O2 + k * (O4 - O2)
    k1 = 1 - k
    return {"k": k, "O6": O6,
            "original": {"O2": O2, "O4": O4, "links": (a, b, c, d)},
            "cognate2": {"O2": O2, "O4": O6, "links": (abs(k) * b, abs(k) * a, abs(k) * c, abs(k) * d)},
            "cognate3": {"O2": O4, "O4": O6, "links": (abs(k1) * b, abs(k1) * c, abs(k1) * a, abs(k1) * d)}}

def cognate_check(a, b, c, d, p, delta_deg, branch=1, n=72):
    """Drive the original, compute P. Drive each cognate with the angle its crank must have (cognate 2 crank moves
    with theta3, cognate 3 crank moves with theta3 too), solve the cognate by position_general (both branches, keep
    the one that fits), and compare its coupler point with P. Returns max distance (same length unit)."""
    cg = cognates(a, b, c, d, p, delta_deg)
    k = cg["k"]
    O6 = cg["O6"]
    O4 = complex(d, 0)
    errs = {"cognate2": 0.0, "cognate3": 0.0}
    for i in range(n):
        t2 = 2 * math.pi * i / n
        pos = position(t2, a, b, c, d, branch)
        if pos is None:
            continue
        A, B = pos["A"], pos["B"]
        P = A + k * (B - A)
        r3 = B - A
        # cognate 2: crank O2 -> D = k r3, coupler D -> E = k r2, rocker O6 -> E; P = D + (E - D)/k
        L2 = cg["cognate2"]["links"]
        best = None
        for br in (1, -1):
            q = position_general(0j, O6, L2[0], L2[1], L2[2], cmath.phase(k * r3), br)
            if q:
                Pc = q["A"] + (q["B"] - q["A"]) / k
                e = abs(Pc - P)
                best = e if best is None else min(best, e)
        errs["cognate2"] = max(errs["cognate2"], best)
        # cognate 3: crank O4 -> F = (k-1) r3, coupler F -> G = (1-k) r4, rocker O6 -> G = (1-k) r2; P = F + r4
        L3 = cg["cognate3"]["links"]
        r4 = B - O4
        best = None
        for br in (1, -1):
            q = position_general(O4, O6, L3[0], L3[1], L3[2], cmath.phase((k - 1) * r3), br)
            if q:
                Pc = q["A"] + (q["B"] - q["A"]) / (1 - k)     # P - F = r4 = (G - F) / (1 - k)
                e = abs(Pc - P)
                best = e if best is None else min(best, e)
        errs["cognate3"] = max(errs["cognate3"], best)
    return errs

def circle_fit(pts):
    """Algebraic (Kasa) circle fit: x^2 + y^2 + D x + E y + F = 0, least squares. Returns centre, radius, max dev."""
    S = [[0.0] * 3 for _ in range(3)]
    r = [0.0] * 3
    for z in pts:
        row = [z.real, z.imag, 1.0]
        rhs = -(z.real ** 2 + z.imag ** 2)
        for i in range(3):
            r[i] += row[i] * rhs
            for j in range(3):
                S[i][j] += row[i] * row[j]
    D, E, F = solve_linear(S, r)
    cen = complex(-D / 2, -E / 2)
    R = math.sqrt(cen.real ** 2 + cen.imag ** 2 - F)
    dev = max(abs(abs(z - cen) - R) for z in pts)
    return cen, R, dev

def dwell_sixbar(a, b, c, d, p, delta_deg, branch, window_deg, r6, n=720):
    """Six-bar dwell: find the coupler-curve part (input window) closest to a circular arc. Link 5 of length R joins
    P to joint C placed at the arc centre; output rocker O6-C (length r6, O6 below C) then stands almost still while P
    runs on the arc. Returns arc data, dwell output motion and the total output swing (deg)."""
    curve = coupler_curve(a, b, c, d, p, delta_deg, branch, n)
    step = 360.0 / n
    w = int(round(window_deg / step))
    best = None
    for s0 in range(len(curve)):
        P = [curve[(s0 + k) % len(curve)][1] for k in range(w + 1)]
        cen, R, dev = circle_fit(P)
        if R > 4 * max(a, b, c, d):          # nearly straight parts are not useful arcs here
            continue
        if best is None or dev / R < best[3] / best[2]:
            best = (s0, cen, R, dev)
    s0, C0, R, dev = best
    O6 = C0 - 1j * r6
    m = len(curve)
    out = [None] * m
    prev = C0
    for k in range(m):                     # start inside the dwell window and follow the branch continuously
        i = (s0 + k) % m
        P = curve[i][1]
        v = O6 - P
        e = abs(v)
        if e > R + r6 or e < abs(R - r6):
            raise ValueError("link 5 / output rocker cannot be assembled at theta2 = %.1f deg" % math.degrees(curve[i][0]))
        x = (R * R - r6 * r6 + e * e) / (2 * e)
        h = math.sqrt(max(0.0, R * R - x * x))
        u = v / e
        cands = [P + x * u + sgn * h * complex(-u.imag, u.real) for sgn in (1, -1)]
        C = min(cands, key=lambda z: abs(z - prev))
        out[i] = (curve[i][0], C)
        prev = C
    ang = [math.degrees(cmath.phase(C - O6)) for _, C in out]
    unw = []
    for k in range(m):                     # unwrap, starting at the dwell window
        v = ang[(s0 + k) % m]
        if unw:
            while v - unw[-1] > 180:
                v -= 360
            while v - unw[-1] < -180:
                v += 360
        unw.append(v)
    dwell = unw[:w + 1]
    ang = unw
    return {"start_deg": math.degrees(curve[s0][0]), "R": R, "centre": C0, "arc_dev": dev,
            "dwell_motion_deg": max(dwell) - min(dwell), "total_swing_deg": max(ang) - min(ang)}

# ---------------------------------------------------------------- chapter 6: synthesis
def dyad_standard_form(deltas, alphas, betas):
    """Erdman-Sandor standard form for one dyad (W from ground pivot to moving pivot, Z from moving pivot to
    coupler point), 3 positions:  W (e^(i beta_j) - 1) + Z (e^(i alpha_j) - 1) = delta_j,  j = 2, 3.
    deltas = (d2, d3) complex displacements of P, alphas = coupler rotations, betas = free link rotations (rad).
    Linear complex 2x2 -> W, Z."""
    a11, a12 = cmath.exp(1j * betas[0]) - 1, cmath.exp(1j * alphas[0]) - 1
    a21, a22 = cmath.exp(1j * betas[1]) - 1, cmath.exp(1j * alphas[1]) - 1
    det = a11 * a22 - a12 * a21
    W = (deltas[0] * a22 - a12 * deltas[1]) / det
    Z = (a11 * deltas[1] - deltas[0] * a21) / det
    return W, Z

def motion_generation_3pos(poses, betas_left, betas_right):
    """Three-position motion generation. poses = [(P complex, coupler angle rad)] x 3.
    Solves a left dyad (input crank) and a right dyad (rocker) with the chosen free rotations.
    Returns pivots, link lengths, the coupler-point ratio and the result of an independent analysis check."""
    P1, g1 = poses[0]
    deltas = (poses[1][0] - P1, poses[2][0] - P1)
    alphas = (poses[1][1] - g1, poses[2][1] - g1)
    WL, ZL = dyad_standard_form(deltas, alphas, betas_left)
    WR, ZR = dyad_standard_form(deltas, alphas, betas_right)
    A1, B1 = P1 - ZL, P1 - ZR
    O2, O4 = A1 - WL, B1 - WR
    a, c = abs(WL), abs(WR)
    b, d = abs(B1 - A1), abs(O4 - O2)
    kP = (P1 - A1) / (B1 - A1)
    # independent check: assemble the linkage, rotate the crank by beta_j, compare P and coupler angle
    check = []
    t2_1 = cmath.phase(WL)
    br = None
    for bb in (1, -1):
        q = position_general(O2, O4, a, b, c, t2_1, bb)
        if q and abs(q["B"] - B1) < 1e-6 * max(a, b, c, d):
            br = bb
    for j, (Pj, gj) in enumerate(poses):
        beta = 0.0 if j == 0 else betas_left[j - 1]
        q = position_general(O2, O4, a, b, c, t2_1 + beta, br) if br else None
        if q is None:
            check.append(None)
            continue
        Pc = q["A"] + kP * (q["B"] - q["A"])
        gam = cmath.phase(q["B"] - q["A"]) - cmath.phase(B1 - A1) + g1
        check.append((abs(Pc - Pj), math.degrees(_wrap(gam - gj))))
    return {"O2": O2, "O4": O4, "A1": A1, "B1": B1, "a": a, "b": b, "c": c, "d": d, "kP": kP, "branch": br,
            "check": check, "grashof": grashof(a, b, c, d)["class"]}

def quick_return(c, psi_deg, Q, s_deg, side=1, theta4_mid_deg=90.0):
    """Crank-rocker with time ratio Q > 1. alpha = 180 (Q-1)/(Q+1). Rocker O4 at origin, extremes B1, B2.
    O2 lies on a circle through B1 and B2 on which the chord B1B2 subtends the inscribed angle alpha
    (radius Rc = |B1B2| / (2 sin alpha), centre at Rc cos(alpha) from the chord; side = +1 / -1 picks one of the
    two mirror circles). s_deg = free position of O2 on that circle. Then
    a = | |O2B2| - |O2B1| | / 2, b = (|O2B1| + |O2B2|) / 2, d = |O2 O4|."""
    al = math.radians(180.0 * (Q - 1) / (Q + 1))
    h = math.radians(psi_deg) / 2
    m = math.radians(theta4_mid_deg)
    B1 = c * cmath.exp(1j * (m + h))
    B2 = c * cmath.exp(1j * (m - h))
    chord = abs(B1 - B2)
    Rc = chord / (2 * math.sin(al))
    M = (B1 + B2) / 2
    n = (B1 - B2) / chord * 1j
    centre = M + side * n * Rc * math.cos(al)
    O2 = centre + Rc * cmath.exp(1j * math.radians(s_deg))
    L1, L2 = abs(O2 - B1), abs(O2 - B2)
    return {"alpha_deg": math.degrees(al), "Rc": Rc, "centre": centre, "O2": O2, "B1": B1, "B2": B2,
            "a": abs(L2 - L1) / 2, "b": (L1 + L2) / 2, "c": c, "d": abs(O2)}

def quick_return_best(c, psi_deg, Q, theta4_mid_deg=90.0, step=1.0, a_min_ratio=0.15):
    """Scan side and s. Keep only Grashof crank-rockers that reproduce the asked swing and Q when analysed by
    limit_positions() (this rejects O2 on the wrong arc, or B1, B2 on opposite sides of line O2O4) and whose crank is
    not tiny (a >= a_min_ratio * c). Return the design with the best minimum transmission angle."""
    best, n_ok = None, 0
    for side in (1, -1):
        s = 0.0
        while s < 360.0:
            q = quick_return(c, psi_deg, Q, s, side, theta4_mid_deg)
            a, b, cc, d = q["a"], q["b"], q["c"], q["d"]
            if a >= a_min_ratio * c and grashof(a, b, cc, d)["class"].startswith("Grashof crank-rocker"):
                lp = limit_positions(a, b, cc, d)
                if abs(lp["psi_deg"] - psi_deg) < 1e-6 and abs(lp["Q"] - Q) < 1e-6:
                    n_ok += 1
                    mus = [transmission_angle(math.radians(k), a, b, cc, d) for k in range(0, 360, 2)]
                    mumin = min(min(mus), 180 - max(mus))
                    if best is None or mumin > best["mu_min"]:
                        best = dict(q, s_deg=s, side=side, mu_min=mumin, check_psi=lp["psi_deg"], check_Q=lp["Q"])
            s += step
    if best:
        best["n_valid"] = n_ok
    return best

def fg_eval(xs, t20, t40, dt2, dt4, x_range=(1.0, 10.0), f=math.log10, n_check=181):
    """Freudenstein function generator with GIVEN precision points xs (not only Chebyshev).
    Returns max structural error (% of output range), min transmission angle, links, or None if defective."""
    x0, x1 = x_range
    def t2_of(x): return t20 + (x - x0) / (x1 - x0) * dt2
    def t4_of(y): return t40 + (y - f(x0)) / (f(x1) - f(x0)) * dt4
    pairs = [(t2_of(x), t4_of(f(x))) for x in xs]
    try:
        sol = freudenstein_synthesis(pairs, 1.0)
    except ZeroDivisionError:
        return None
    if not sol:
        return None
    a, b, c, d = sol["a"], sol["b"], sol["c"], sol["d"]
    o2, o4 = sol["off2"], sol["off4"]
    br = None
    for bb in (1, -1):
        if all((lambda q: q is not None and abs(_wrap(q["t4"] - o4 - t4p)) < 1e-6)(position(t2p + o2, a, b, c, d, bb))
               for t2p, t4p in pairs):
            br = bb
    if br is None:
        return None
    emax, mus = 0.0, []
    for k in range(n_check):
        x = x0 + (x1 - x0) * k / (n_check - 1)
        q = position(t2_of(x) + o2, a, b, c, d, br)
        if q is None:
            return None
        y = f(x0) + _wrap(q["t4"] - o4 - t40) / dt4 * (f(x1) - f(x0))
        emax = max(emax, abs(y - f(x)))
        mus.append(transmission_angle(t2_of(x) + o2, a, b, c, d))
    return {"err_pct": 100 * emax / (f(x1) - f(x0)), "mu_min": min(min(mus), 180 - max(mus)),
            "links": (a, b, c, d), "branch": br}

def fg_optimise(t20_deg=30.0, t40_deg=120.0, dt2_deg=90.0, dt4_deg=45.0, mu_limit=40.0):
    """Move the 3 precision points (start: Chebyshev) to minimise the MAX structural error (minimax), with a
    penalty if the transmission angle falls below mu_limit or the linkage is defective. Nelder-Mead (M1 ch. 29)."""
    from dm_toolkit import nelder_mead
    t20, t40, dt2, dt4 = (math.radians(v) for v in (t20_deg, t40_deg, dt2_deg, dt4_deg))
    x_ch = chebyshev_points(1.0, 10.0, 3)
    def obj(x):
        xs = sorted(x)
        if xs[0] <= 1.0 or xs[-1] >= 10.0 or min(xs[1] - xs[0], xs[2] - xs[1]) < 0.2:
            return 1e3
        r = fg_eval(xs, t20, t40, dt2, dt4)
        if r is None:
            return 1e3
        return r["err_pct"] + 10 * max(0.0, mu_limit - r["mu_min"])
    start = fg_eval(x_ch, t20, t40, dt2, dt4)
    xbest, fbest = nelder_mead(obj, x_ch, step=0.5, tol=1e-6, itmax=600)
    xs = sorted(xbest)
    res = fg_eval(xs, t20, t40, dt2, dt4)
    return {"x_cheb": x_ch, "err_cheb": start["err_pct"], "mu_cheb": start["mu_min"],
            "x_opt": xs, "err_opt": res["err_pct"], "mu_opt": res["mu_min"], "links_opt": res["links"]}

def slope_ratio(x_range, f=math.log10, h=1e-6):
    """Curvature measure of the function to generate: f'(x0) / f'(x1)."""
    x0, x1 = x_range
    d0 = (f(x0 + h) - f(x0)) / h
    d1 = (f(x1) - f(x1 - h)) / h
    return d0 / d1

# ---------------------------------------------------------------- demo (python fourbar.py ch56)
def demo_ch56():
    P = DEFAULT
    a, b, c, d = (P[k + "_mm"] for k in "abcd")
    print("## 5.1 Coupler curve of the default linkage (a 30, b 100, c 80, d 100 mm, p 50 mm, delta 30 deg)")
    s = curve_shape(a, b, c, d, P["p_mm"], P["delta_deg"], P["branch"])
    print("  %s; width %.2f mm, height %.2f mm, length %.2f mm, min/mean speed %.3f" % (
        s["kind"], s["width"], s["height"], s["length"], s["min_speed_ratio"]))
    w2 = P["rpm"] * 2 * math.pi / 60
    print("  mean coupler-point speed at %.0f rpm: %.3f m/s" % (P["rpm"], s["length"] / 1000 * P["rpm"] / 60))
    print("## 5.2 Shapes for other coupler points on the same linkage")
    for p, dl in ((50, 30), (80, -45), (110, 15), (100, 0), (200, 20), (100, 90)):
        q = curve_shape(a, b, c, d, p, dl, 1)
        print("  p %5.0f mm, delta %5.0f deg -> %-58s width %7.2f height %7.2f min/mean speed %.3f" % (
            p, dl, q["kind"], q["width"], q["height"], q["min_speed_ratio"]))
    print("## 5.3 Approximate straight-line linkages (unit lengths)")
    hk = straightness(1.0, 2.5, 2.5, 2.0, 5.0, 0.0, 1, 180.0)
    print("  Hoeken a 1, b 2.5, c 2.5, d 2, P on AB extended at 5 (crank-rocker): best 180 deg window from %.1f deg:"
          " straight length %.4f, max deviation %.5f (%.3f %%), speed variation %.2f %%" % (
              hk["start_deg"], hk["length"], hk["dev"], hk["dev_pct"], hk["speed_var_pct"]))
    hk2 = straightness(1.0, 2.5, 2.5, 2.0, 5.0, 0.0, 1, 120.0)
    print("  Hoeken, 120 deg window: length %.4f, deviation %.6f (%.4f %%), speed variation %.2f %%" % (
        hk2["length"], hk2["dev"], hk2["dev_pct"], hk2["speed_var_pct"]))
    print("  Grashof Hoeken:", grashof(1.0, 2.5, 2.5, 2.0)["class"])
    cg = cognates(1.0, 2.5, 2.5, 2.0, 5.0, 0.0)
    l2 = cg["cognate2"]["links"]
    print("  cognate 2 of Hoeken (pivots O2, O6): crank %.4f, coupler %.4f, rocker %.4f, ground %.4f -> %s" % (
        l2[0], l2[1], l2[2], l2[3], grashof(*l2)["class"]))
    l3 = cg["cognate3"]["links"]
    print("  cognate 3 of Hoeken (pivots O4, O6): crank %.4f, coupler %.4f, rocker %.4f, ground %.4f -> %s" % (
        l3[0], l3[1], l3[2], l3[3], grashof(*l3)["class"]))
    print("## 5.4 Roberts-Chebyshev cognates of the default linkage")
    cg = cognates(a, b, c, d, P["p_mm"], P["delta_deg"])
    print("  k = %.4f %+.4fi (|k| %.4f, angle %.1f deg), O6 = (%.3f, %.3f) mm" % (
        cg["k"].real, cg["k"].imag, abs(cg["k"]), math.degrees(cmath.phase(cg["k"])), cg["O6"].real, cg["O6"].imag))
    for nm in ("original", "cognate2", "cognate3"):
        L = cg[nm]["links"]
        print("  %-9s crank %8.3f coupler %8.3f rocker %8.3f ground %8.3f mm -> %s" % (
            nm, L[0], L[1], L[2], L[3], grashof(*L)["class"]))
    e = cognate_check(a, b, c, d, P["p_mm"], P["delta_deg"])
    print("  check: max distance between coupler points: cognate 2 %.2e mm, cognate 3 %.2e mm" % (
        e["cognate2"], e["cognate3"]))
    print("## 5.5 Six-bar dwell from the default coupler curve (input window 60 deg, output rocker 60 mm)")
    dw = dwell_sixbar(a, b, c, d, P["p_mm"], P["delta_deg"], 1, 60.0, 60.0)
    print("  arc from theta2 = %.1f deg: radius R %.3f mm, centre (%.3f, %.3f), arc deviation %.4f mm" % (
        dw["start_deg"], dw["R"], dw["centre"].real, dw["centre"].imag, dw["arc_dev"]))
    print("  output rocker: moves %.4f deg during the 60 deg dwell window, total swing %.3f deg" % (
        dw["dwell_motion_deg"], dw["total_swing_deg"]))
    print("## 6.2 Three-position motion generation (pick-and-place poses, mm / deg)")
    poses = [(complex(0, 0), 0.0), (complex(60, 40), math.radians(20)), (complex(120, 50), math.radians(45))]
    mg = motion_generation_3pos(poses, (math.radians(120), math.radians(200)), (math.radians(20), math.radians(10)))
    print("  free choices: left dyad (crank) beta2 120, beta3 200 deg; right dyad (rocker) beta2 20, beta3 10 deg")
    print("  O2 (%.3f, %.3f), O4 (%.3f, %.3f), A1 (%.3f, %.3f), B1 (%.3f, %.3f)" % (
        mg["O2"].real, mg["O2"].imag, mg["O4"].real, mg["O4"].imag, mg["A1"].real, mg["A1"].imag, mg["B1"].real, mg["B1"].imag))
    print("  links: crank a %.3f, coupler b %.3f, rocker c %.3f, ground d %.3f mm; branch %s; %s" % (
        mg["a"], mg["b"], mg["c"], mg["d"], mg["branch"], mg["grashof"]))
    t21 = cmath.phase(mg["A1"] - mg["O2"])
    rk = []
    for bet in (0.0, 120.0, 200.0):
        q = position_general(mg["O2"], mg["O4"], mg["a"], mg["b"], mg["c"], t21 + math.radians(bet), mg["branch"])
        rk.append(math.degrees(cmath.phase(q["B"] - mg["O4"])))
    L = (mg["a"], mg["b"], mg["c"], mg["d"])
    mus = [transmission_angle(math.radians(k), *L) for k in range(0, 360, 2)]
    print("  rocker angle at the 3 poses: %.2f, %.2f, %.2f deg; swing %.2f deg; min transmission angle %.1f deg" % (
        rk[0], rk[1], rk[2], limit_positions(*L)["psi_deg"], min(min(mus), 180 - max(mus))))
    for j, ch in enumerate(mg["check"]):
        print("  pose %d: position error %s, angle error %s" % (
            j + 1, "%.2e mm" % ch[0] if ch else "not reachable", "%.2e deg" % ch[1] if ch else "-"))
    print("## 6.3 Crank-rocker Q = 1 (crank_rocker_Q1) and quick return Q > 1")
    cr = crank_rocker_Q1(80.0, 50.0, 70.0)
    lp = limit_positions(cr["a"], cr["b"], cr["c"], cr["d"])
    mus = [transmission_angle(math.radians(k), cr["a"], cr["b"], cr["c"], cr["d"]) for k in range(0, 360, 2)]
    print("  Q = 1: a %.3f b %.3f c %.3f d %.3f; check swing %.3f, Q %.5f; min transmission angle %.1f deg" % (
        cr["a"], cr["b"], cr["c"], cr["d"], lp["psi_deg"], lp["Q"], min(min(mus), 180 - max(mus))))
    for Q in (1.2, 1.5):
        qr = quick_return_best(80.0, 50.0, Q)
        print("  Q = %.1f: alpha %.3f deg, circle R %.3f mm; %d valid positions; best side %+d, s %.0f deg:"
              " a %.3f b %.3f c %.3f d %.3f mm; check swing %.4f deg, Q %.5f; min transmission angle %.1f deg" % (
                  Q, qr["alpha_deg"], qr["Rc"], qr["n_valid"], qr["side"], qr["s_deg"], qr["a"], qr["b"], qr["c"],
                  qr["d"], qr["check_psi"], qr["check_Q"], qr["mu_min"]))
    print("## 6.4 Function generation y = log10 x: range effect")
    for rng in ((1.0, 2.0), (1.0, 10.0)):
        fg = function_generator_example(x_range=rng)
        print("  x %.0f..%.0f: slope ratio f'(x0)/f'(x1) %.2f, max error %.3f %% of output range, min mu %.1f deg" % (
            rng[0], rng[1], slope_ratio(rng), fg["error_pct_of_range"], fg["mu_min"]))
    bad = function_generator_example(45, 135, 60, 90)
    print("  defect example (45, 135, 60, 90): links %.4f %.4f %.4f %.4f, defect at x = %.2f, branch %s" % (
        *bad["links"], bad["defect_at_x"], bad["branch"]))
    print("## 6.5 Optimised precision points (minimax, mu >= 40 deg)")
    op = fg_optimise()
    print("  Chebyshev x %s -> error %.3f %%, mu_min %.1f deg" % (
        ", ".join("%.4f" % v for v in op["x_cheb"]), op["err_cheb"], op["mu_cheb"]))
    print("  optimised x %s -> error %.3f %%, mu_min %.1f deg; links %s" % (
        ", ".join("%.4f" % v for v in op["x_opt"]), op["err_opt"], op["mu_opt"],
        ", ".join("%.4f" % v for v in op["links_opt"])))

# ================================================================ added with guide chapters (ch711)
# ---------------------------------------------------------------- chapter 7: dynamics helpers
def flywheel_crank(P, delta=0.05, rows=None):
    """Flywheel on the crank shaft: J = dE / (delta * w2^2). dE from the input-torque curve (summary)."""
    rows = sweep(P) if rows is None else rows
    s = summary(P, rows)
    w2 = P["rpm"] * 2 * math.pi / 60
    return {"dE_J": s["dE_J"], "w2": w2, "delta": delta, "J_kgm2": s["dE_J"] / (delta * w2 * w2)}

def torque_stats(P, rows=None):
    """Mean, rms, peak input torque and mean power (for motor sizing)."""
    rows = sweep(P) if rows is None else rows
    T = [r["T12"] for r in rows if r]
    n = len(T)
    w2 = P["rpm"] * 2 * math.pi / 60
    Tm = sum(T) / n
    Trms = math.sqrt(sum(t * t for t in T) / n)
    return {"T_mean": Tm, "T_rms": Trms, "T_peak": max(abs(t) for t in T), "P_mean_W": Tm * w2, "P_rms_W": Trms * w2}

def gearmotor_size(P, SF=1.5, eta_gear=0.85, rows=None):
    """Gearmotor choice: output torque rating >= SF * T_rms and >= T_peak / 2 (short peak allowed ~2x, check
    catalogue); motor power >= T_rms * w2 / eta_gear * SF (example rule)."""
    ts = torque_stats(P, rows)
    w2 = P["rpm"] * 2 * math.pi / 60
    T_rated = max(SF * ts["T_rms"], ts["T_peak"] / 2.0)
    P_motor = T_rated * w2 / eta_gear
    return dict(ts, T_rated_min=T_rated, P_motor_min_W=P_motor, SF=SF, eta=eta_gear)

def motor_inertia_effect(P, J_motor=2.0e-4, n_motor=1400.0, rows=None):
    """Speed fluctuation with only the gearmotor rotor as flywheel: J_red = J_motor * i^2, i = n_motor / rpm,
    delta = dE / (J_red * w2^2). Slow linkages need no extra flywheel because i^2 is large."""
    rows = sweep(P) if rows is None else rows
    s = summary(P, rows)
    w2 = P["rpm"] * 2 * math.pi / 60
    i = n_motor / P["rpm"]
    Jr = J_motor * i * i
    return {"i": i, "J_red": Jr, "delta": s["dE_J"] / (Jr * w2 * w2), "dE_J": s["dE_J"]}

def berkof_lowen(P, r_cw2_mm=25.0, r_cw4_mm=50.0):
    """Full shaking-force balance (Berkof-Lowen, linearly independent vectors method).
    Total CG constant if  m2 r2 e^(i phi2) = -m3 a (1 - (r3/b) e^(i phi3))  and
                          m4 r4 e^(i phi4) = -m3 (c/b) r3 e^(i phi3)
    (r2 from O2 along O2A, r3 from A along AB at angle phi3, r4 from O4 along O4B).
    Counterweights (point masses on the extension of links 2 and 4) are added to reach these moments.
    Returns the balanced parameter set and the counterweight data."""
    a, b, c = P["a_mm"] / 1000, P["b_mm"] / 1000, P["c_mm"] / 1000
    m3, r3, ph3 = P["m3"], P["rg3_mm"] / 1000, math.radians(P["dg3_deg"])
    e3 = complex(math.cos(ph3), math.sin(ph3))
    need2 = -m3 * a * (1 - (r3 / b) * e3)        # required m2 r2 vector (link frame)
    need4 = -m3 * (c / b) * r3 * e3
    if abs(need2.imag) > 1e-12 or abs(need4.imag) > 1e-12:
        raise ValueError("coupler CG off the line AB: counterweights need an angle (not in this simple model)")
    out = dict(P)
    res = {}
    for k, need, rcw_mm in (("2", need2.real, r_cw2_mm), ("4", need4.real, r_cw4_mm)):
        m, rg = P["m" + k], P["rg%s_mm" % k] / 1000
        have = m * rg
        add = need - have                          # kg m along the link (negative = opposite side)
        rcw = rcw_mm / 1000
        mcw = abs(add) / rcw
        xcw = math.copysign(rcw, add)
        m_new = m + mcw
        rg_new = need / m_new
        J_pivot = P["J" + k] + m * rg ** 2 + mcw * xcw ** 2   # cw as point mass (add its own J if large)
        J_new = J_pivot - m_new * rg_new ** 2
        out["m" + k], out["rg%s_mm" % k], out["J" + k] = m_new, rg_new * 1000, J_new
        res[k] = {"need_kgm": need, "have_kgm": have, "m_cw": mcw, "x_cw_mm": xcw * 1000, "m_new": m_new,
                  "rg_new_mm": rg_new * 1000, "J_new": J_new}
    return out, res

def compare_balance(P):
    """Run unbalanced vs balanced: shaking force, shaking moment, pin forces, torque."""
    Pb, cw = berkof_lowen(P)
    out = {}
    for name, Q in (("unbalanced", P), ("balanced", Pb)):
        rows = sweep(Q)
        s = summary(Q, rows)
        ts = torque_stats(Q, rows)
        out[name] = {"shake_max": s["shake_max"], "shakeM_max": s["shakeM_max"], "pin_max": s["pin_max"],
                     "T_rms": ts["T_rms"], "T_peak": ts["T_peak"], "dE": s["dE_J"]}
    return out, cw

def gravity_effect(P):
    """Same linkage in a vertical plane (gravity -y) vs horizontal plane: torque and pin forces."""
    out = {}
    for g in (0.0, 9.81):
        Q = dict(P); Q["gravity"] = g
        rows = sweep(Q)
        s = summary(Q, rows)
        ts = torque_stats(Q, rows)
        out[g] = {"T_peak": ts["T_peak"], "T_rms": ts["T_rms"], "P_mean": ts["P_mean_W"], "pin_max": s["pin_max"]}
    return out

# ---------------------------------------------------------------- chapter 8: link and joint design
def coupler_loads(P, rows=None):
    """Axial and transverse components of the pin force at B on the coupler (F43 in coupler frame).
    Axial > 0 = tension (force at B pulls away from A)."""
    rows = sweep(P) if rows is None else rows
    ax, tr = [], []
    for r in rows:
        if not r:
            continue
        u = complex(math.cos(r["t3"]), math.sin(r["t3"]))        # unit vector A -> B
        F = r["F43"]
        ax.append(F.real * u.real + F.imag * u.imag)
        tr.append(-F.real * u.imag + F.imag * u.real)
    return {"axial_max_tension": max(ax), "axial_max_compression": -min(ax), "transverse_max": max(abs(t) for t in tr),
            "axial": ax, "transverse": tr}

def coupler_design(P, h_mm=20.0, t_mm=8.0, E=210000.0, Re=355.0, Rm=510.0, rows=None):
    """Coupler as a pinned-pinned bar, section h (in plane) x t (out of plane), steel S355 (example).
    - axial stress F/A, bending from transverse inertia: q = m3 * a_perp / b, M = q b^2 / 8 (approx.)
    - Euler buckling out of plane: Pcr = pi^2 E I_min / L^2, I_min = h t^3 / 12
    - fatigue: amplitude = (max - min)/2 of axial stress + bending, Goodman via M1 dm_toolkit."""
    rows = sweep(P) if rows is None else rows
    cl = coupler_loads(P, rows)
    L = P["b_mm"]
    A = h_mm * t_mm
    W = t_mm * h_mm ** 2 / 6
    I_min = h_mm * t_mm ** 3 / 12
    # transverse acceleration of coupler CG (a_perp) -> distributed inertia load
    w2 = P["rpm"] * 2 * math.pi / 60
    aperp = 0.0
    for r in rows:
        if not r:
            continue
        # acceleration of CG3 = aA + (i al3 - w3^2) rg3 e^(i t3); perpendicular part to AB
        import cmath
        A_pt = complex(P["a_mm"] / 1000 * math.cos(r["t2"]), P["a_mm"] / 1000 * math.sin(r["t2"]))
        aA = (1j * P["alpha2"] - w2 * w2) * A_pt
        e3 = cmath.exp(1j * r["t3"])
        ag3 = aA + (1j * r["al3"] - r["w3"] ** 2) * P["rg3_mm"] / 1000 * e3
        aperp = max(aperp, abs(-ag3.real * e3.imag + ag3.imag * e3.real))
    q = P["m3"] * aperp / (L / 1000)            # N/m
    M = q * (L / 1000) ** 2 / 8 * 1000          # N mm
    s_ax_t = cl["axial_max_tension"] / A
    s_ax_c = cl["axial_max_compression"] / A
    s_b = M / W
    Pcr = math.pi ** 2 * E * I_min / L ** 2
    sa = (s_ax_t + s_ax_c) / 2 + s_b
    sm = (s_ax_t - s_ax_c) / 2
    try:
        from dm_toolkit import marin_goodman
        g = marin_goodman(Rm, Re, max(t_mm, 2.8), sa, abs(sm), "machined", 99)
        nf = g["n_fatigue"]
    except Exception:
        nf = None
    return {"A_mm2": A, "W_mm3": W, "I_min_mm4": I_min, "a_perp_max": aperp, "M_Nmm": M, "sigma_tension": s_ax_t,
            "sigma_compression": s_ax_c, "sigma_bending": s_b, "Pcr_N": Pcr, "buckling_SF": Pcr / max(1e-9, cl["axial_max_compression"]),
            "sigma_a": sa, "sigma_m": sm, "n_fatigue": nf, "loads": {k: cl[k] for k in ("axial_max_tension", "axial_max_compression", "transverse_max")}}

JOINT_MATERIALS = {   # typical catalogue orders of magnitude - CHECK the maker's data sheet
    "sintered bronze (oil-impregnated)": {"p_max": 10.0, "v_max": 6.0, "pv_max": 1.8},
    "PTFE composite (steel-backed, DU type)": {"p_max": 56.0, "v_max": 2.5, "pv_max": 1.8},
    "needle bearing (rolling)": {"p_max": None, "v_max": None, "pv_max": None},
}

def joint_check(P, d_mm=10.0, L_mm=12.0, rows=None):
    """Pin joints O2, A, B, O4: max force, bush pressure p = F/(d L), sliding speed v = |w_rel| d/2, pv;
    pin in double shear tau = F / (2 pi d^2 / 4); pin bending for a clevis with gap ~ L: M = F L / 8 (example)."""
    rows = sweep(P) if rows is None else rows
    w2 = P["rpm"] * 2 * math.pi / 60
    joints = {"O2": ("F12", lambda r: w2), "A": ("F32", lambda r: r["w3"] - w2),
              "B": ("F43", lambda r: r["w4"] - r["w3"]), "O4": ("F14", lambda r: r["w4"])}
    out = {}
    for j, (key, wrel) in joints.items():
        Fmax = max(abs(r[key]) for r in rows if r)
        vmax = max(abs(wrel(r)) for r in rows if r) * d_mm / 2000
        pvmax = max(abs(r[key]) / (d_mm * L_mm) * abs(wrel(r)) * d_mm / 2000 for r in rows if r)
        tau = Fmax / (2 * math.pi * d_mm ** 2 / 4)
        sb = (Fmax * L_mm / 8) / (math.pi * d_mm ** 3 / 32)
        out[j] = {"F_max": Fmax, "p_MPa": Fmax / (d_mm * L_mm), "v_max": vmax, "pv_max": pvmax, "tau_MPa": tau,
                  "sigma_b_MPa": sb}
    return out

# ---------------------------------------------------------------- chapter 9: tolerances over the cycle
def tolerance_cycle(P, angles=(0, 45, 90, 135, 180, 225, 270, 315)):
    """Output-angle error (MC 3 sigma, RSS, worst case) at several input angles + joint play."""
    out = []
    for ang in angles:
        tm = tolerance_mc(math.radians(ang), P, n=8000)
        out.append((ang, tm["3sd_deg"], tm["rss_3s_deg"], tm["wc_deg"]))
    return out, clearance_play(P, 0.0)

def arc_error_mm(angle_deg, radius_mm):
    """Angular error -> position error at a radius: s = r * angle(rad)."""
    return radius_mm * math.radians(angle_deg)

# ---------------------------------------------------------------- chapter 11: application
APP = {
    "name": "Swing transfer arm for the compressor line - 50 deg, Q = 1, 30 cycles/min",
    "a_mm": 33.809, "b_mm": 103.809, "c_mm": 80.0, "d_mm": 126.623, "branch": 1,
    "p_mm": 0.0, "delta_deg": 0.0, "rpm": 30.0, "alpha2": 0.0,
    "m2": 0.15, "rg2_mm": 15.0, "J2": 4.0e-5,
    "m3": 0.40, "rg3_mm": 51.9, "dg3_deg": 0.0, "J3": 4.0e-4,
    "m4": 1.60, "rg4_mm": 70.0, "J4": 3.0e-3,
    "T4_load_Nm": 0.0, "c4_visc_Nms": 2.0, "F_P_N": [0.0, 0.0], "gravity": 0.0,
    "tol_mm": {"a": 0.02, "b": 0.03, "c": 0.03, "d": 0.05}, "joint_clearance_mm": 0.015, "step_deg": 1.0,
}

def application():
    """Synthesis -> analysis chain for the swing arm example (horizontal plane, gravity 0)."""
    cr = crank_rocker_Q1(80.0, 50.0, 70.0)
    P = dict(DEFAULT); P.update(APP)
    rows = sweep(P)
    s = summary(P, rows)
    lp = limit_positions(P["a_mm"], P["b_mm"], P["c_mm"], P["d_mm"])
    gm = gearmotor_size(P, rows=rows)
    fw = flywheel_crank(P, 0.05, rows)
    jc = joint_check(P, 10.0, 12.0, rows)
    cd = coupler_design(P, rows=rows)
    tc, play = tolerance_cycle(P, (0, 90, 180, 270))
    return {"synth": cr, "summary": s, "limits": lp, "gearmotor": gm, "flywheel": fw, "joints": jc, "coupler": cd,
            "tol": tc, "play": play, "grashof": grashof(P["a_mm"], P["b_mm"], P["c_mm"], P["d_mm"])}

def demo_ch711():
    P = dict(DEFAULT)
    rows = sweep(P)
    print("== ch7 dynamics (default linkage) ==")
    ts = torque_stats(P, rows)
    print("torque mean %.4f, rms %.4f, peak %.4f N m; mean power %.3f W" % (ts["T_mean"], ts["T_rms"], ts["T_peak"], ts["P_mean_W"]))
    P0 = dict(P); P0["c4_visc_Nms"] = 0.0
    print("constant rocker torque only: mean power %.6f W; with viscous 0.8 N m s: %.3f W" % (
        torque_stats(P0)["P_mean_W"], ts["P_mean_W"]))
    for dl in (0.02, 0.05):
        fw = flywheel_crank(P, dl, rows)
        print("flywheel: dE %.4f J, w2 %.4f rad/s, delta %.2f -> J %.4f kg m2" % (fw["dE_J"], fw["w2"], dl, fw["J_kgm2"]))
    ge = gravity_effect(P)
    for g, v in ge.items():
        print("gravity %.2f: T_peak %.4f, T_rms %.4f N m, P_mean %.3f W, pins O2 %.1f A %.1f B %.1f O4 %.1f N" % (
            g, v["T_peak"], v["T_rms"], v["P_mean"], *[v["pin_max"][k] for k in ("F12", "F32", "F43", "F14")]))
    cmp_, cw = compare_balance(P)
    for k, v in cw.items():
        print("link %s: need m r %.5f kg m, have %.5f, counterweight %.4f kg at %.1f mm -> m %.4f kg, rg %.3f mm, J %.3e" % (
            k, v["need_kgm"], v["have_kgm"], v["m_cw"], v["x_cw_mm"], v["m_new"], v["rg_new_mm"], v["J_new"]))
    for k, v in cmp_.items():
        print("%-10s shake max %.3e N, shaking moment max %.4f N m, pins O2 %.1f A %.1f B %.1f O4 %.1f N, T_rms %.4f, T_peak %.4f, dE %.4f" % (
            k, v["shake_max"], v["shakeM_max"], *[v["pin_max"][q] for q in ("F12", "F32", "F43", "F14")], v["T_rms"], v["T_peak"], v["dE"]))
    mi = motor_inertia_effect(P, rows=rows)
    print("gearmotor rotor 2.0e-4 kg m2 at 1400 rpm: i %.2f, J_red %.4f kg m2 -> delta %.4f" % (mi["i"], mi["J_red"], mi["delta"]))
    Pi = dict(P); Pi.update({"T4_load_Nm": 0.0, "c4_visc_Nms": 0.0, "rpm": 300.0})
    ci, _ = compare_balance(Pi)
    for k, v in ci.items():
        print("inertia only, 300 rpm, %-10s shake max %.3e N, shaking moment %.4f N m, pins O2 %.2f A %.2f B %.2f O4 %.2f N, T_rms %.4f N m" % (
            k, v["shake_max"], v["shakeM_max"], *[v["pin_max"][q] for q in ("F12", "F32", "F43", "F14")], v["T_rms"]))
    gm = gearmotor_size(P, rows=rows)
    print("gearmotor: T_rms %.3f -> rated >= %.3f N m (SF %.1f), motor >= %.1f W (eta %.2f)" % (
        gm["T_rms"], gm["T_rated_min"], gm["SF"], gm["P_motor_min_W"], gm["eta"]))
    print("== ch8 links and joints ==")
    cd = coupler_design(P, rows=rows)
    print("coupler loads: tension max %.1f N, compression max %.1f N, transverse max %.1f N" % (
        cd["loads"]["axial_max_tension"], cd["loads"]["axial_max_compression"], cd["loads"]["transverse_max"]))
    print("section 20x8: A %.0f mm2, W %.1f mm3, I_min %.1f mm4; a_perp max %.2f m/s2 -> M %.1f N mm" % (
        cd["A_mm2"], cd["W_mm3"], cd["I_min_mm4"], cd["a_perp_max"], cd["M_Nmm"]))
    print("stress tension %.3f, compression %.3f, bending %.3f MPa; Pcr %.0f N -> buckling SF %.1f; sigma_a %.3f sigma_m %.3f n_f %.1f" % (
        cd["sigma_tension"], cd["sigma_compression"], cd["sigma_bending"], cd["Pcr_N"], cd["buckling_SF"], cd["sigma_a"],
        cd["sigma_m"], cd["n_fatigue"]))
    jc = joint_check(P, 10.0, 12.0, rows)
    for j, v in jc.items():
        print("joint %-2s F %.1f N, p %.3f MPa, v %.4f m/s, pv %.5f MPa m/s, tau %.3f MPa, sigma_b %.3f MPa" % (
            j, v["F_max"], v["p_MPa"], v["v_max"], v["pv_max"], v["tau_MPa"], v["sigma_b_MPa"]))
    print("== ch9 tolerances ==")
    tc, play = tolerance_cycle(P)
    for ang, mc, rss, wc in tc:
        print("theta2 %3d: MC 3s %.4f, RSS %.4f, WC %.4f deg" % (ang, mc, rss, wc))
    print("joint play (4 joints, 0.02 mm) ~ %.4f deg -> at rocker tip r = 80 mm: %.4f mm; MC 3s at 90 deg: %.4f mm" % (
        play, arc_error_mm(play, 80), arc_error_mm(tc[2][1], 80)))
    s9 = sensitivity(math.radians(90), P)
    print("sensitivity at 90 deg [deg/mm]:", ", ".join("%s %.4f" % kv for kv in s9.items()))
    print("== ch11 application ==")
    ap = application()
    cr = ap["synth"]
    print("synthesis: a %.3f b %.3f c %.3f d %.3f mm; %s" % (cr["a"], cr["b"], cr["c"], cr["d"], ap["grashof"]["class"]))
    s, lp = ap["summary"], ap["limits"]
    print("swing %.3f deg, Q %.4f, mu %.1f..%.1f deg, w4 max %.3f rad/s, al4 max %.2f rad/s2" % (
        s["swing"], lp["Q"], s["mu_min"], s["mu_max"], s["w4_max"], s["al4_max"]))
    gm = ap["gearmotor"]
    print("torque mean %.3f rms %.3f peak %.3f N m, P mean %.2f W -> gearmotor rated >= %.2f N m, motor >= %.1f W" % (
        gm["T_mean"], gm["T_rms"], gm["T_peak"], gm["P_mean_W"], gm["T_rated_min"], gm["P_motor_min_W"]))
    print("flywheel delta 0.05: dE %.4f J -> J %.4f kg m2" % (ap["flywheel"]["dE_J"], ap["flywheel"]["J_kgm2"]))
    Pa = dict(DEFAULT); Pa.update(APP)
    mi = motor_inertia_effect(Pa, 1.0e-4, 1400.0)
    print("with gearmotor rotor 1.0e-4 kg m2 at 1400 rpm: i %.2f, J_red %.4f kg m2, delta %.4f" % (mi["i"], mi["J_red"], mi["delta"]))
    print("pins max: O2 %.1f A %.1f B %.1f O4 %.1f N; shake max %.2f N" % (
        *[s["pin_max"][k] for k in ("F12", "F32", "F43", "F14")], s["shake_max"]))
    for j, v in ap["joints"].items():
        print("  joint %-2s p %.3f MPa pv %.5f MPa m/s tau %.2f MPa" % (j, v["p_MPa"], v["pv_max"], v["tau_MPa"]))
    cd = ap["coupler"]
    print("coupler: compression max %.1f N, buckling SF %.0f, sigma_a %.3f MPa, n_f %.1f" % (
        cd["loads"]["axial_max_compression"], cd["buckling_SF"], cd["sigma_a"], cd["n_fatigue"]))
    for ang, mc, rss, wc in ap["tol"]:
        print("  tol theta2 %3d: MC 3s %.4f WC %.4f deg" % (ang, mc, wc))
    print("  joint play %.4f deg -> tip (r 80) %.4f mm" % (ap["play"], arc_error_mm(ap["play"], 80)))


# ================================================================ chapter 6b: path generation (required track)
def path_generation_3pt(points, betas_deg, alphas_deg, gammas_deg):
    """EXACT path generation through 3 points WITH prescribed timing (Erdman-Sandor standard form).
    points = [P1, P2, P3] (complex or (x, y)) the coupler point must pass.
    betas_deg  = crank rotations from position 1 to 2 and 3 (the timing you prescribe).
    alphas_deg = coupler rotations (free choice), gammas_deg = rocker rotations (free choice).
    Left dyad:  WL (e^(i beta) - 1) + ZL (e^(i alpha) - 1) = delta   (crank O2-A, coupler A-P)
    Right dyad: WR (e^(i gamma) - 1) + ZR (e^(i alpha) - 1) = delta  (rocker O4-B, coupler B-P)
    Returns the linkage and an independent analysis check of the three points."""
    P = [q if isinstance(q, complex) else complex(*q) for q in points]
    deltas = (P[1] - P[0], P[2] - P[0])
    al = [math.radians(v) for v in alphas_deg]
    be = [math.radians(v) for v in betas_deg]
    ga = [math.radians(v) for v in gammas_deg]
    try:
        WL, ZL = dyad_standard_form(deltas, al, be)
        WR, ZR = dyad_standard_form(deltas, al, ga)
    except ZeroDivisionError:
        return {"branch": None, "check_mm": [None] * 3, "grashof": "degenerate (singular dyad equations)"}
    A1, B1 = P[0] - ZL, P[0] - ZR
    O2, O4 = A1 - WL, B1 - WR
    a, b, c, d = abs(WL), abs(B1 - A1), abs(WR), abs(O4 - O2)
    if min(a, b, c, d) < 1e-9:
        return {"branch": None, "check_mm": [None] * 3, "grashof": "degenerate (zero-length link)"}
    kP = (P[0] - A1) / (B1 - A1)
    t21 = cmath.phase(WL)
    br = None
    for bb in (1, -1):
        q = position_general(O2, O4, a, b, c, t21, bb)
        if q and abs(q["B"] - B1) < 1e-6 * max(a, b, c, d):
            br = bb
    check = []
    for j in range(3):
        beta = 0.0 if j == 0 else be[j - 1]
        q = position_general(O2, O4, a, b, c, t21 + beta, br) if br else None
        check.append(None if q is None else abs(q["A"] + kP * (q["B"] - q["A"]) - P[j]))
    return {"O2": O2, "O4": O4, "a": a, "b": b, "c": c, "d": d, "kP": kP, "branch": br, "t2_1_deg": math.degrees(t21),
            "check_mm": check, "grashof": grashof(a, b, c, d)["class"]}

def path_3pt_search(points, betas_deg, alpha_range=(-60, 61, 5), gamma_step=5, mu_min=40.0, ratio_max=8.0):
    """Scan the free choices (coupler rotations alpha2, alpha3 = alpha2/2 ... and rocker rotations gamma2 < gamma3)
    of path_generation_3pt and keep exact, assemblable Grashof crank-rockers with the best transmission angle.
    Returns the best solution (or None) and the number of valid candidates."""
    best, n_ok = None, 0
    for a2 in range(*alpha_range):
        for a3 in range(*alpha_range):
            for g2 in range(gamma_step, 120, gamma_step):
                for g3 in range(g2 + gamma_step, 150, gamma_step):
                    q = path_generation_3pt(points, betas_deg, (a2, a3), (g2, g3))
                    if not q["branch"] or any(c is None or c > 1e-6 for c in q["check_mm"]):
                        continue
                    if not q["grashof"].startswith("Grashof crank-rocker"):
                        continue
                    L = (q["a"], q["b"], q["c"], q["d"])
                    if max(L) / min(L) > ratio_max:
                        continue
                    mus = [transmission_angle(math.radians(k), *L) for k in range(0, 360, 5)]
                    m = min(min(mus), 180 - max(mus))
                    if m < mu_min:
                        continue
                    n_ok += 1
                    if best is None or m > best["mu_worst"]:
                        q.update({"mu_worst": m, "alphas": (a2, a3), "gammas": (g2, g3)})
                        best = q
    return best, n_ok

def _path_linkage(x):
    """Decode the design vector of path_synthesis():
    x = [O2x, O2y, a, b, c, d, ground angle th1 (rad), px, py (, theta2 of target 1)];
    coupler point P = A + (px + i py) e^(i theta3)  (px along AB, py perpendicular)."""
    O2 = complex(x[0], x[1])
    O4 = O2 + x[5] * cmath.exp(1j * x[6])
    return O2, O4, x[2], x[3], x[4], x[5], complex(x[7], x[8])

def path_curve(x, branch, n=180):
    """Coupler-point curve (global frame) of design vector x: list of (theta2_global, P); [] if it cannot be
    assembled over the full turn."""
    O2, O4, a, b, c, d, kp = _path_linkage(x)
    out = []
    for k in range(n):
        t2 = x[6] + 2 * math.pi * k / n
        q = position_general(O2, O4, a, b, c, t2, branch)
        if q is None:
            return []
        out.append((t2, q["A"] + kp * (q["B"] - q["A"]) / b))
    return out

def path_error(x, targets, branch, timing=None, mu_min=40.0, n=180, ratio_max=8.0, need_crank=True, max_link=None):
    """Objective of path synthesis: RMS distance of the targets to the coupler curve (mm) + penalties.
    timing = None  -> unprescribed timing: each target uses its nearest curve point; the targets must be met in
                      their given order along the curve (at most one wrap per turn);
    timing = [deg] -> prescribed crank angles relative to target 1; theta2 of target 1 is x[9]."""
    O2, O4, a, b, c, d, kp = _path_linkage(x)
    if min(a, b, c, d) <= 0 or max(a, b, c, d) / min(a, b, c, d) > ratio_max:
        return 1e9, None
    if max_link is not None:                 # size limit (links, coupler point, pivots near the track)
        over = max(0.0, max(a, b, c, d, abs(kp)) - max_link)
        if over > 0:
            return 1e6 + 1e3 * over, None
    g = grashof(a, b, c, d)
    if need_crank and not (g["class"].startswith("Grashof crank-rocker") or g["class"].startswith("Grashof double-crank")):
        return 1e8 + 1e6 * max(0.0, g["s+l-(p+q)"]), None
    pen = 0.0
    for k in range(0, 360, 10):              # transmission angle over the full turn
        mu = transmission_angle(math.radians(k), a, b, c, d)
        pen += max(0.0, mu_min - mu) ** 2 + max(0.0, mu - (180 - mu_min)) ** 2
    T = [complex(*t) for t in targets]
    if timing is None:
        curve = path_curve(x, branch, n)
        if not curve:
            return 1e7, None
        idx, d2 = [], 0.0
        for t in T:
            j = min(range(len(curve)), key=lambda i: abs(curve[i][1] - t))
            idx.append(j)
            d2 += abs(curve[j][1] - t) ** 2
        fwd = sum(1 for i in range(len(idx)) if idx[(i + 1) % len(idx)] < idx[i])
        bwd = sum(1 for i in range(len(idx)) if idx[(i + 1) % len(idx)] > idx[i])
        pen += 1e3 * max(0, min(fwd, bwd) - 1)          # order kept (either running direction of the crank)
        return math.sqrt(d2 / len(T)) + pen, {"idx": idx, "curve": curve}
    d2 = 0.0
    for t, tau in zip(T, timing):
        q = position_general(O2, O4, a, b, c, x[9] + math.radians(tau), branch)
        if q is None:
            return 1e7, None
        d2 += abs(q["A"] + kp * (q["B"] - q["A"]) / b - t) ** 2
    return math.sqrt(d2 / len(T)) + pen, {}

def path_synthesis(targets, timing=None, mu_min=40.0, seed=7, pop=60, gens=120, branches=(1, -1), refine=True,
                   max_link_factor=2.5):
    """Find a four-bar whose coupler point follows a REQUIRED TRACK (N >= 4 points, no upper limit).
    Global search (real-coded GA: tournament 3, BLX-0.5, Gaussian mutation, elitism 2) + Nelder-Mead refinement,
    for both assembly branches. Constraints: Grashof (input crank turns fully), transmission angle within
    [mu_min, 180 - mu_min], link ratio <= 8, assemblable over the full turn, target order kept.
    Returns the best linkage in the global frame and as standard parameters for 'fourbar.py run'."""
    from dm_toolkit import nelder_mead
    T = [complex(*t) for t in targets]
    xs, ys = [t.real for t in T], [t.imag for t in T]
    cx, cy = sum(xs) / len(T), sum(ys) / len(T)
    L = max(max(xs) - min(xs), max(ys) - min(ys))
    ML = max_link_factor * L                 # no link / coupler offset longer than this (practical size)
    lo = [cx - 2.5 * L, cy - 2.5 * L, 0.1 * L, 0.3 * L, 0.3 * L, 0.3 * L, -math.pi, -2 * L, -2 * L]
    hi = [cx + 2.5 * L, cy + 2.5 * L, 1.5 * L, ML, ML, ML, math.pi, 2 * L, 2 * L]
    if timing is not None:
        lo.append(-math.pi)
        hi.append(math.pi)
    rnd = random.Random(seed)
    best = None
    for br in branches:
        def f(x):
            return path_error(x, targets, br, timing, mu_min, 120, max_link=ML)[0]
        P_ = [[rnd.uniform(l, h) for l, h in zip(lo, hi)] for _ in range(pop)]
        F_ = [f(x) for x in P_]
        for _ in range(gens):
            order = sorted(range(pop), key=lambda i: F_[i])
            new = [P_[order[0]][:], P_[order[1]][:]]                       # elitism
            while len(new) < pop:
                i1 = min(rnd.sample(range(pop), 3), key=lambda i: F_[i])
                i2 = min(rnd.sample(range(pop), 3), key=lambda i: F_[i])
                ch = []
                for k, (u, v) in enumerate(zip(P_[i1], P_[i2])):
                    lo_k, hi_k = min(u, v), max(u, v)
                    span = hi_k - lo_k
                    g = rnd.uniform(lo_k - 0.5 * span, hi_k + 0.5 * span)     # BLX-0.5 crossover
                    if rnd.random() < 0.15:
                        g += rnd.gauss(0, 0.1 * (hi[k] - lo[k]))              # mutation
                    ch.append(min(hi[k], max(lo[k], g)))
                new.append(ch)
            P_ = new
            F_ = [f(x) for x in P_]
        k0 = min(range(pop), key=lambda i: F_[i])
        x, fx = P_[k0], F_[k0]
        if refine:
            for _ in range(3):
                x, fx = nelder_mead(lambda z: path_error(z, targets, br, timing, mu_min, 360, max_link=ML)[0], x,
                                    step=0.05 * L, itmax=3000)
        fx, info = path_error(x, targets, br, timing, mu_min, 360, max_link=ML)
        if best is None or fx < best["objective"]:
            best = {"x": x, "branch": br, "objective": fx}
    x, br = best["x"], best["branch"]
    O2, O4, a, b, c, d, kp = _path_linkage(x)
    fx, info = path_error(x, targets, br, timing, mu_min, 360, max_link=ML)
    errs = []
    if timing is None:
        for t, j in zip(T, info["idx"]):
            errs.append(abs(info["curve"][j][1] - t))
    else:
        for t, tau in zip(T, timing):
            q = position_general(O2, O4, a, b, c, x[9] + math.radians(tau), br)
            errs.append(abs(q["A"] + kp * (q["B"] - q["A"]) / b - t))
    mus = [transmission_angle(math.radians(k), a, b, c, d) for k in range(360)]
    std = dict(DEFAULT)
    std.update({"name": "path synthesis result", "a_mm": a, "b_mm": b, "c_mm": c, "d_mm": d, "branch": br,
                "p_mm": abs(kp), "delta_deg": math.degrees(cmath.phase(kp))})
    return {"O2": O2, "O4": O4, "ground_angle_deg": math.degrees(x[6]), "a": a, "b": b, "c": c, "d": d,
            "coupler_point": kp, "branch": br, "rms_mm": math.sqrt(sum(e * e for e in errs) / len(errs)),
            "max_mm": max(errs), "errors_mm": errs, "track_size_mm": L, "mu_min": min(mus), "mu_max": max(mus),
            "grashof": grashof(a, b, c, d)["class"], "params_for_run": std, "x": x,
            "curve": [P for _, P in path_curve(x, br, 360)]}

def path_report(res, targets, out=None):
    """Text report; with out: writes path_report.md, path.svg (track vs coupler curve + linkage) and
    linkage_for_run.json (standard parameters -> python fourbar.py run --in ...)."""
    L = ["# Path synthesis result",
         "- linkage: a %.2f, b %.2f, c %.2f, d %.2f mm, branch %+d -> %s" % (res["a"], res["b"], res["c"], res["d"],
                                                                           res["branch"], res["grashof"]),
         "- frame: O2 (%.2f, %.2f) mm, O4 (%.2f, %.2f) mm, ground angle %.2f deg" % (
             res["O2"].real, res["O2"].imag, res["O4"].real, res["O4"].imag, res["ground_angle_deg"]),
         "- coupler point: p %.2f mm at delta %.2f deg from AB" % (abs(res["coupler_point"]),
                                                                  math.degrees(cmath.phase(res["coupler_point"]))),
         "- track error: RMS %.3f mm, max %.3f mm (track size %.1f mm -> max %.2f %%)" % (
             res["rms_mm"], res["max_mm"], res["track_size_mm"], 100 * res["max_mm"] / res["track_size_mm"]),
         "- transmission angle %.1f ... %.1f deg" % (res["mu_min"], res["mu_max"]),
         "- point errors [mm]: " + ", ".join("%.3f" % e for e in res["errors_mm"])]
    txt = "\n".join(L)
    if out:
        from crank import _svg_line
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, "linkage_for_run.json"), "w", encoding="utf-8") as f:
            json.dump(res["params_for_run"], f, indent=2)
        tg = [complex(*t) for t in targets]
        O2, O4, cur = res["O2"], res["O4"], res["curve"]
        q = position_general(O2, O4, res["a"], res["b"], res["c"], res["x"][6], res["branch"])
        series = [("coupler curve", [(z.real, z.imag) for z in cur + cur[:1]], "#1f77b4"),
                  ("required track (points joined)", [(z.real, z.imag) for z in tg], "#d62728")]
        if q:
            series.append(("linkage at theta2 = ground angle", [(O2.real, O2.imag), (q["A"].real, q["A"].imag),
                                                                 (q["B"].real, q["B"].imag), (O4.real, O4.imag)], "#7f7f7f"))
        with open(os.path.join(out, "path.svg"), "w", encoding="utf-8") as f:
            f.write(_svg_line(series, title="Required track vs synthesised coupler curve [mm]", xl="x [mm]",
                              yl="y [mm]", polar=True))
        with open(os.path.join(out, "path_report.md"), "w", encoding="utf-8") as f:
            f.write(txt + "\n\nNext: python fourbar.py run --in %s --out <folder>   (kinematics, dynamics, tolerances)\n"
                    % os.path.join(out, "linkage_for_run.json"))
    return txt

def path_from_known(n_pts=10, seed_linkage=(30.0, 100.0, 80.0, 100.0, 60.0, 40.0)):
    """Test track: points taken from the coupler curve of a known linkage (an exact solution exists)."""
    a, b, c, d, p, dl = seed_linkage
    cur = coupler_curve(a, b, c, d, p, dl, 1, 360)
    step = len(cur) // n_pts
    return [(cur[i * step][1].real, cur[i * step][1].imag) for i in range(n_pts)]

PATH_EXAMPLE = {
    "name": "pick-and-place D-track: straight transfer 120 mm, lift and return 40 mm",
    "track_mm": [[0, 0], [30, 0], [60, 0], [90, 0], [120, 0], [128, 18], [110, 36], [60, 42], [10, 36], [-8, 18]],
    "timing_deg": None,
    "mu_min_deg": 40.0,
    "max_link_factor": 2.5,      # longest link / coupler offset <= factor x track size
    "generations": 120,          # GA generations (more = slower, often better)
}

def demo_ch6b():
    """All results of guide chapter 6b (path generation)."""
    print("== 6b.3 exact 3-point path generation, prescribed timing (crank 0 / 60 / 120 deg)")
    pts = [(0, 0), (60, 10), (120, 0)]
    q = path_generation_3pt(pts, (60, 120), (-10, 5), (30, 50))
    print("  free choices alpha (-10, 5), gamma (30, 50): a %.3f b %.3f c %.3f d %.3f, O2 (%.2f, %.2f), O4 (%.2f, %.2f)"
          % (q["a"], q["b"], q["c"], q["d"], q["O2"].real, q["O2"].imag, q["O4"].real, q["O4"].imag))
    print("  %s; check errors at the 3 points [mm]: %s" % (q["grashof"], ", ".join("%.1e" % c for c in q["check_mm"])))
    mus = [transmission_angle(math.radians(k), q["a"], q["b"], q["c"], q["d"]) for k in range(0, 360, 5)]
    print("  transmission angle %.1f ... %.1f deg" % (min(mus), max(mus)))
    best, n = path_3pt_search(pts, (60, 120), alpha_range=(-60, 61, 10), gamma_step=10)
    print("  search over free choices: %d valid crank-rockers (mu >= 40); best worst-case mu %.1f deg with alpha %s gamma %s:"
          " a %.2f b %.2f c %.2f d %.2f" % (n, best["mu_worst"], best["alphas"], best["gammas"],
                                            best["a"], best["b"], best["c"], best["d"]))
    print("== 6b.5 timed straight track: 5 points 30 mm apart at crank steps of 30 deg")
    tr = [(0, 0), (30, 0), (60, 0), (90, 0), (120, 0)]
    print(path_report(path_synthesis(tr, timing=[0, 30, 60, 90, 120], gens=80), tr))
    print("== 6b.6 track taken from a known linkage (10 points) - an exact solution exists")
    kn = path_from_known(10)
    print("  points:", ", ".join("(%.1f, %.1f)" % p_ for p_ in kn))
    print(path_report(path_synthesis(kn), kn))
    print("== 6b.7 D-track for pick-and-place (PATH_EXAMPLE, unprescribed timing)")
    print(path_report(path_synthesis(PATH_EXAMPLE["track_mm"], None, 40.0), PATH_EXAMPLE["track_mm"]))
    r = path_synthesis(PATH_EXAMPLE["track_mm"], None, 40.0, max_link_factor=10.0)
    print("  same track without a practical size limit (factor 10): max link %.1f mm, RMS %.3f mm, max %.3f mm"
          % (max(r["a"], r["b"], r["c"], r["d"]), r["rms_mm"], r["max_mm"]))

# ---------------------------------------------------------------- examples / selftest
def cmd_examples():
    P = dict(DEFAULT)
    rows = sweep(P)
    print(report_text(P, rows))
    a, b, c, d = (P[k + "_mm"] for k in "abcd")
    print("\n## Kinematics table (theta2 deg: theta3, theta4 deg, w3, w4 rad/s, alpha3, alpha4 rad/s2, mu deg, T12 N m)")
    for ang in (0, 45, 90, 135, 180, 225, 270, 315):
        r = rows[int(round(ang / P["step_deg"]))]
        print("%4d  %8.3f %8.3f  %7.3f %7.3f  %8.2f %8.2f  %6.2f  %7.3f" % (
            ang, math.degrees(r["t3"]), math.degrees(r["t4"]), r["w3"], r["w4"], r["al3"], r["al4"], r["mu"], r["T12"]))
    print("\n## Grashof classes of example linkages")
    for L in ((30, 100, 80, 100), (100, 80, 60, 30), (60, 30, 100, 80), (60, 90, 30, 80), (50, 80, 70, 40), (70, 100, 60, 80)):
        print("  a b c d = %s -> %s" % (L, grashof(*L)["class"]))
    fg = function_generator_example()
    print("\n## Function generator y = log10(x), 1..10 (Chebyshev, Freudenstein, d = 1); input 90 deg from 30, output 45 deg from 120")
    print("  precision x:", ", ".join("%.4f" % x for x in fg["x_precision"]))
    print("  (theta2, theta4) deg:", ", ".join("(%.3f, %.3f)" % p for p in fg["pairs_deg"]))
    print("  a %.4f, b %.4f, c %.4f, d %.4f (signed a %.4f, c %.4f), branch %+d" % (*fg["links"], *fg["signed"], fg["branch"]))
    print("  max structural error |dy| %.5f = %.3f %% of output range; min transmission angle %.1f deg" % (
        fg["max_error_y"], fg["error_pct_of_range"], fg["mu_min"]))
    print("  error curve (x: dy):", ", ".join("%.2f: %+.5f" % e for e in fg["errors"][::10]))
    nar = function_generator_example(30, 120, 90, 45, x_range=(1.0, 2.0))
    print("  same method over the narrower range 1 <= x <= 2: max error %.3f %% of output range" % nar["error_pct_of_range"])
    bad = function_generator_example(45, 135, 60, 90)
    print("  input 60 deg from 45, output 90 deg from 135: a %.4f b %.4f c %.4f d %.4f -> BRANCH DEFECT:"
          " cannot be assembled at x = %.2f (it passes the 3 precision points only)" % (*bad["links"], bad["defect_at_x"]))
    cr = crank_rocker_Q1(80.0, 50.0, 70.0)
    print("\n## Crank-rocker synthesis Q = 1: c 80 mm, swing 50 deg, O2 70 mm beyond B1")
    print("  a %.3f, b %.3f, c %.3f, d %.3f mm" % (cr["a"], cr["b"], cr["c"], cr["d"]))
    lp = limit_positions(cr["a"], cr["b"], cr["c"], cr["d"])
    print("  check: swing %.3f deg, Q %.5f, grashof: %s" % (lp["psi_deg"], lp["Q"], grashof(cr["a"], cr["b"], cr["c"], cr["d"])["class"]))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-60s %s %s" % (name, "OK  " if cond else "FAIL", info))
    P = dict(DEFAULT)
    a, b, c, d = (P[k + "_mm"] for k in "abcd")
    # 1 position: loop closure and Freudenstein agreement
    errs, ferr = [], []
    for k in range(0, 360, 7):
        t2 = math.radians(k)
        pos = position(t2, a, b, c, d, 1)
        loop = a * cmath.exp(1j * t2) + b * cmath.exp(1j * pos["t3"]) - c * cmath.exp(1j * pos["t4"]) - d
        errs.append(abs(loop))
        best = min((freudenstein(t2, a, b, c, d, s) for s in (-1, 1)),
                   key=lambda r: abs(_wrap(r[1] - pos["t4"])))
        ferr.append(max(abs(_wrap(best[0] - pos["t3"])), abs(_wrap(best[1] - pos["t4"]))))
    chk("loop closure |a e^it2 + b e^it3 - c e^it4 - d| < 1e-9 mm", max(errs) < 1e-9, "%.1e" % max(errs))
    chk("circle intersection = Freudenstein closed form", max(ferr) < 1e-9, "%.1e rad" % max(ferr))
    # 2 velocity / acceleration vs finite differences
    w2, h = 1.0, 1e-6
    t2 = math.radians(37)
    def t34(x):
        p = position(x, a, b, c, d, 1)
        return p["t3"], p["t4"]
    p0, pp, pm = t34(t2), t34(t2 + h), t34(t2 - h)
    w3, w4 = velocity(t2, p0[0], p0[1], w2, a, b, c)
    chk("w3, w4 closed form = finite difference", abs((pp[0] - pm[0]) / (2 * h) - w3) < 1e-6 and abs((pp[1] - pm[1]) / (2 * h) - w4) < 1e-6)
    al3, al4 = acceleration(t2, p0[0], p0[1], w2, w3, w4, 0.0, a, b, c)
    chk("alpha3, alpha4 = finite difference", abs((pp[0] - 2 * p0[0] + pm[0]) / h ** 2 - al3) < 1e-3 and abs((pp[1] - 2 * p0[1] + pm[1]) / h ** 2 - al4) < 1e-3)
    # 3 transmission angle cosine law = angle between coupler and rocker
    pos = position(t2, a, b, c, d, 1)
    mu_geo = math.degrees(abs(_wrap(pos["t4"] - pos["t3"])))
    mu_geo = mu_geo if mu_geo <= 180 else 360 - mu_geo
    chk("transmission angle: cosine law = |theta4 - theta3|", abs(mu_geo - transmission_angle(t2, a, b, c, d)) < 1e-9)
    # 4 dynamics: Newton-Euler torque = energy method torque
    rows = sweep(P)
    err = max(abs(r["T12"] - r["T_energy"]) for r in rows if r)
    chk("input torque: Newton-Euler = energy (power) method", err < 1e-9, "max diff %.1e N m" % err)
    # 5 with gravity + coupler force: still equal
    P2 = dict(P); P2["gravity"] = 9.81; P2["F_P_N"] = [20.0, -35.0]
    err2 = max(abs(r["T12"] - r["T_energy"]) for r in sweep(P2) if r)
    chk("same with gravity + coupler force", err2 < 1e-9, "%.1e" % err2)
    # 6 mean input power = mean load power (-T4 * w4 averages ... ) : mean T12*w2 = -mean(T4*w4)
    s = summary(P, rows)
    w2r = P["rpm"] * 2 * math.pi / 60
    load = sum(P["c4_visc_Nms"] * r["w4"] ** 2 for r in rows if r) / len([r for r in rows if r])
    chk("mean input power = mean load power (inertia does no net work)", abs(s["P_mean_W"] - load) < 1e-6 * max(1, load),
        "%.4f vs %.4f W" % (s["P_mean_W"], load))
    P3 = dict(P); P3["c4_visc_Nms"] = 0.0
    chk("constant rocker torque alone: mean input power = 0", abs(summary(P3, sweep(P3))["P_mean_W"]) < 1e-9)
    # 7 swing from sweep = limit-position formula
    lp = limit_positions(a, b, c, d)
    chk("rocker swing: sweep = limit-position formula (+-0.05 deg)", abs(s["swing"] - lp["psi_deg"]) < 0.05,
        "%.3f vs %.3f" % (s["swing"], lp["psi_deg"]))
    # 8 Freudenstein synthesis reproduces precision points exactly
    fg = function_generator_example()
    perr = []
    for (t2p, t4p) in fg["pairs_deg"]:
        q = position(math.radians(t2p) + (math.pi if fg["signed"][0] < 0 else 0), *fg["links"], fg["branch"])
        perr.append(abs(_wrap(q["t4"] - (math.pi if fg["signed"][1] < 0 else 0) - math.radians(t4p))))
    chk("function generator: exact at the 3 precision points", max(perr) < 1e-9, "%.1e rad" % max(perr))
    chk("function generator: works over the whole range, error < 10 % of range", fg["defect_at_x"] is None and
        fg["error_pct_of_range"] < 10, "%.3f %%" % fg["error_pct_of_range"])
    # 9 crank-rocker Q=1 synthesis gives Q = 1 and the asked swing
    cr = crank_rocker_Q1(80.0, 50.0, 70.0)
    lq = limit_positions(cr["a"], cr["b"], cr["c"], cr["d"])
    chk("Q = 1 synthesis -> Q = 1.0000, swing 50.000 deg", abs(lq["Q"] - 1) < 1e-6 and abs(lq["psi_deg"] - 50) < 1e-6,
        "Q %.6f psi %.4f" % (lq["Q"], lq["psi_deg"]))
    # 10 Monte Carlo 3 sigma ~ RSS (linear) within 5 %
    tm = tolerance_mc(math.radians(90), P)
    chk("Monte Carlo 3 sigma = linear RSS (+-5 %)", abs(tm["3sd_deg"] / tm["rss_3s_deg"] - 1) < 0.05,
        "%.4f vs %.4f deg" % (tm["3sd_deg"], tm["rss_3s_deg"]))
    # 11 path generation (required track)
    q3 = path_generation_3pt([(0, 0), (60, 10), (120, 0)], (60, 120), (-10, 5), (30, 50))
    chk("exact 3-point path generation: analysis passes the 3 points", q3["branch"] is not None and
        max(q3["check_mm"]) < 1e-9, "%.1e mm" % max(q3["check_mm"]))
    tr = [(0, 0), (30, 0), (60, 0), (90, 0), (120, 0)]
    rt = path_synthesis(tr, timing=[0, 30, 60, 90, 120], gens=80)
    chk("timed straight-line track: max error < 2 % of track", rt["max_mm"] < 0.02 * 120 and rt["mu_min"] >= 39.9,
        "%.3f mm, mu_min %.1f" % (rt["max_mm"], rt["mu_min"]))
    kn = path_from_known(8)
    rk = path_synthesis(kn)                  # default GA size (about 15 s)
    chk("track from a known linkage (8 points): max error < 3 % of track", rk["max_mm"] < 0.03 * rk["track_size_mm"],
        "%.3f mm of %.1f" % (rk["max_mm"], rk["track_size_mm"]))
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
    elif cmd == "path":
        cfg = dict(PATH_EXAMPLE)
        out = "path_out"
        if "--in" in argv:
            with open(argv[argv.index("--in") + 1], encoding="utf-8") as f:
                cfg.update(json.load(f))
        if "--out" in argv:
            out = argv[argv.index("--out") + 1]
        res = path_synthesis(cfg["track_mm"], cfg.get("timing_deg"), cfg.get("mu_min_deg", 40.0),
                             gens=cfg.get("generations", 120), max_link_factor=cfg.get("max_link_factor", 2.5))
        print(path_report(res, cfg["track_mm"], out))
        print("written: path_report.md, path.svg, linkage_for_run.json ->", out)
    elif cmd == "ch6b":
        demo_ch6b()
    elif cmd == "pathparams":
        print(json.dumps(PATH_EXAMPLE, indent=2))
    elif cmd in ("ch24", "ch56", "ch711"):
        {"ch24": demo_ch24, "ch56": demo_ch56, "ch711": demo_ch711}[cmd]()
    elif cmd == "selftest":
        return cmd_selftest()
    elif cmd == "run":
        P = dict(DEFAULT)
        out = "fourbar_out"
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
