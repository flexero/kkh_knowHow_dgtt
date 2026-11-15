#!/usr/bin/env python3
"""M6 cam program - disc cam with translating roller follower (offset e): motion laws in the style of VDI 2143
(cycloidal, simple harmonic, 3-4-5 and 4-5-6-7 polynomials, modified sine, modified trapezoid), motion programme of
rise / dwell / return segments, kinematics, pitch curve and cam profile, pressure angle, radius of curvature and
undercut, base-circle sizing, follower dynamics (inertia, spring, external load, lift-off), camshaft torque,
Hertz contact stress between roller and cam, roller speed, cutter / grinding-wheel centre path and NC profile data.
Guide: 06_cam_design.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python cam.py params | run [--in p.json] [--out folder] | examples | selftest
  python cam.py ch24 | ch56 | ch78        extra results of guide chapters 2-4, 5-6, 7-8
  python cam.py run --in examples/cam_example.json --out example   worked design example (chapter 8)

Allowable pressure angle, allowable Hertz stress, curvature limits and dynamic data are TYPICAL VALUES (check VDI 2143,
VDI 2741, the follower-bearing maker and your material data). All default numbers are EXAMPLES.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

DEFAULT = {
    "name": "Disc cam for a packaging-machine pusher: rise 20 mm / 120 deg, dwell, return, dwell at 300 rpm (example)",
    "segments": [
        {"kind": "rise", "law": "modsine", "beta": 120.0},
        {"kind": "dwell", "beta": 60.0},
        {"kind": "return", "law": "cycloidal", "beta": 120.0},
        {"kind": "dwell", "beta": 60.0},
    ],
    "h": 20.0,                        # stroke mm
    "R0": 40.0,                       # base circle radius of the cam PROFILE mm
    "rr": 10.0,                       # roller radius mm
    "e": 0.0,                         # follower offset mm (positive reduces the rise pressure angle for ccw cam rotation)
    "n_rpm": 300.0,                   # cam speed (counter-clockwise)
    "m": 2.5,                         # reduced follower mass kg (pusher + roller + 1/3 spring)
    "k_spring": 3.0, "F0_spring": 30.0,   # spring rate N/mm, preload at s = 0 N
    "F_ext_rise": 100.0,              # process (external) load acting during the rise N, against the motion
    "phi_allow": 30.0,                # allowable pressure angle deg (translating follower, check)
    "b_roller": 12.0,                 # roller width mm (line contact)
    "E": 210000.0, "nu": 0.3,         # steel roller and cam
    "p_allow": 1650.0,                # allowable Hertz stress MPa (hardened 100Cr6 / 16MnCr5 case hardened, check)
    "rc": 10.0,                       # cutter radius for milling the profile mm
    "rg": 150.0,                      # grinding-wheel radius mm
    "step_deg": 0.5,
}

# ---------------------------------------------------------------- chapter 2: motion laws (normalised, x and y in 0..1)
def _acc_shape(law):
    """Acceleration shape a(x) on 0..1 (any scale); y is obtained by integration and normalised to y(1) = 1."""
    p = math.pi
    if law == "cycloidal":
        return lambda x: math.sin(2 * p * x)
    if law == "harmonic":
        return lambda x: math.cos(p * x)
    if law == "poly345":
        return lambda x: 60 * x - 180 * x ** 2 + 120 * x ** 3
    if law == "poly4567":
        return lambda x: 420 * x ** 2 - 1680 * x ** 3 + 2100 * x ** 4 - 840 * x ** 5
    if law == "modsine":
        def a(x):
            if x <= 0.125:
                return math.sin(4 * p * x)
            if x <= 0.875:
                return math.cos(4 * p / 3 * (x - 0.125))
            return -math.cos(4 * p * (x - 0.875))
        return a
    if law == "modtrap":
        def a(x):
            if x <= 0.125:
                return math.sin(4 * p * x)
            if x <= 0.375:
                return 1.0
            if x <= 0.625:
                return math.cos(4 * p * (x - 0.375))
            if x <= 0.875:
                return -1.0
            return -math.cos(4 * p * (x - 0.875))
        return a
    raise ValueError("unknown motion law " + str(law))

LAWS = ("cycloidal", "harmonic", "poly345", "poly4567", "modsine", "modtrap")
_TABLES = {}

def law_table(law, N=4000):
    """y, y', y'', y''' on N+1 points (integration of the acceleration shape with the trapezoid rule, then normalised)."""
    if (law, N) in _TABLES:
        return _TABLES[(law, N)]
    a = _acc_shape(law)
    xs = [i / N for i in range(N + 1)]
    A = [a(x) for x in xs]
    V = [0.0]
    for i in range(N):
        V.append(V[-1] + 0.5 * (A[i] + A[i + 1]) / N)
    Y = [0.0]
    for i in range(N):
        Y.append(Y[-1] + 0.5 * (V[i] + V[i + 1]) / N)
    c = 1.0 / Y[-1]
    Y = [y * c for y in Y]
    V = [v * c for v in V]
    A = [x * c for x in A]
    J = [(A[min(i + 1, N)] - A[max(i - 1, 0)]) / ((min(i + 1, N) - max(i - 1, 0)) / N) for i in range(N + 1)]
    T = {"x": xs, "y": Y, "v": V, "a": A, "j": J, "N": N}
    _TABLES[(law, N)] = T
    return T

def law_values(law, x):
    T = law_table(law)
    N = T["N"]
    x = min(max(x, 0.0), 1.0)
    i = min(int(x * N), N - 1)
    f = x * N - i
    hstep = 1.0 / N
    def herm(k, dk):                 # cubic Hermite with the stored derivative -> smooth y and y'
        p0, p1, m0, m1 = T[k][i], T[k][i + 1], T[dk][i] * hstep, T[dk][i + 1] * hstep
        f2, f3 = f * f, f * f * f
        return (2 * f3 - 3 * f2 + 1) * p0 + (f3 - 2 * f2 + f) * m0 + (-2 * f3 + 3 * f2) * p1 + (f3 - f2) * m1
    lin = lambda k: T[k][i] + f * (T[k][i + 1] - T[k][i])
    return herm("y", "v"), herm("v", "a"), lin("a"), lin("j")

def characteristic_values(law):
    """C_v = max y', C_a = max |y''|, C_j = max |y'''| (VDI 2143 style characteristic values)."""
    T = law_table(law)
    return {"Cv": max(abs(v) for v in T["v"]), "Ca": max(abs(a) for a in T["a"]), "Cj": max(abs(j) for j in T["j"])}

# ---------------------------------------------------------------- chapter 3: motion programme and kinematics
def check_segments(P):
    tot = sum(s["beta"] for s in P["segments"])
    if abs(tot - 360.0) > 1e-6:
        raise ValueError("segment angles must add up to 360 deg (now %.3f)" % tot)

def motion(P, theta_deg):
    """Follower displacement s (mm), s' = ds/dtheta (mm/rad), s'' (mm/rad^2), s''' (mm/rad^3) at cam angle theta."""
    th = theta_deg % 360.0
    lift = 0.0
    a0 = 0.0
    for seg in P["segments"]:
        b = seg["beta"]
        if th < a0 + b or seg is P["segments"][-1]:
            x = (th - a0) / b
            br = math.radians(b)
            if seg["kind"] == "dwell":
                return lift, 0.0, 0.0, 0.0
            y, v, a, j = law_values(seg["law"], x)
            sg = 1.0 if seg["kind"] == "rise" else -1.0
            h = P["h"]
            base = 0.0 if seg["kind"] == "rise" else h
            return base + sg * h * y, sg * h * v / br, sg * h * a / br ** 2, sg * h * j / br ** 3
        if seg["kind"] == "rise":
            lift = P["h"]
        elif seg["kind"] == "return":
            lift = 0.0
        a0 += b
    return lift, 0.0, 0.0, 0.0

def segment_at(P, theta_deg):
    th = theta_deg % 360.0
    a0 = 0.0
    for seg in P["segments"]:
        if th < a0 + seg["beta"]:
            return seg
        a0 += seg["beta"]
    return P["segments"][-1]

# ---------------------------------------------------------------- chapter 4: geometry
def pitch_point(P, theta_deg):
    """Pitch-curve point in the cam frame, pressure angle, radius of curvature of the pitch curve and of the profile."""
    s, s1, s2, _ = motion(P, theta_deg)
    e, Rp = P["e"], P["R0"] + P["rr"]
    s0 = math.sqrt(Rp ** 2 - e ** 2)
    r = s0 + s
    th = math.radians(theta_deg)
    c, sn = math.cos(-th), math.sin(-th)
    q = (e, r)
    Pt = (c * q[0] - sn * q[1], sn * q[0] + c * q[1])          # rotate by -theta (cam turns +theta, ccw)
    u = (r, s1 - e)                                           # q' - J q
    w = (2 * s1 - e, s2 - r)                                  # q'' - 2 J q' - q
    cross = u[0] * w[1] - u[1] * w[0]
    mag = math.hypot(*u)
    rho_p = -mag ** 3 / cross if cross != 0 else float("inf")    # > 0 convex
    phi = math.atan2(s1 - e, r)                               # pressure angle (Norton convention)
    # tangent in the cam frame and outward normal
    t = (c * u[0] - sn * u[1], sn * u[0] + c * u[1])
    t = (t[0] / mag, t[1] / mag)
    nrm = (t[1], -t[0])
    if nrm[0] * Pt[0] + nrm[1] * Pt[1] < 0:
        nrm = (-nrm[0], -nrm[1])
    prof = (Pt[0] - P["rr"] * nrm[0], Pt[1] - P["rr"] * nrm[1])
    rho_c = rho_p - P["rr"] if rho_p > 0 else rho_p - P["rr"]   # concave: |rho_c| = |rho_p| + rr
    return {"theta": theta_deg, "s": s, "s1": s1, "s2": s2, "pitch": Pt, "profile": prof, "normal": nrm,
            "phi_deg": math.degrees(phi), "rho_pitch": rho_p, "rho_cam": rho_c, "speed_mm_rad": mag}

def sweep(P):
    check_segments(P)
    st = P["step_deg"]
    n = int(round(360.0 / st))
    return [pitch_point(P, i * st) for i in range(n)]

def geometry_summary(P, pts=None):
    pts = pts or sweep(P)
    phis = [p["phi_deg"] for p in pts]
    convex = [p["rho_pitch"] for p in pts if p["rho_pitch"] > 0]
    concave = [-p["rho_pitch"] for p in pts if p["rho_pitch"] < 0]
    rho_p_min = min(convex) if convex else float("inf")
    i_max = max(range(len(pts)), key=lambda i: abs(pts[i]["phi_deg"]))
    return {"phi_max": max(phis), "phi_min": min(phis), "theta_phi_max": pts[i_max]["theta"],
            "rho_pitch_min_convex": rho_p_min, "rho_cam_min_convex": rho_p_min - P["rr"],
            "rho_concave_min": min(concave) + P["rr"] if concave else None,
            "undercut": rho_p_min <= P["rr"], "phi_ok": max(abs(x) for x in phis) <= P["phi_allow"]}

def size_base_circle(P, R_lo=10.0, R_hi=300.0, rho_factor=1.5):
    """Smallest profile base-circle radius R0 with |phi| <= phi_allow and rho_pitch_min >= rho_factor * rr (scan + bisection)."""
    def ok(R):
        g = geometry_summary(dict(P, R0=R, step_deg=1.0))
        return max(abs(g["phi_max"]), abs(g["phi_min"])) <= P["phi_allow"] and g["rho_pitch_min_convex"] >= rho_factor * P["rr"]
    if not ok(R_hi):
        return None
    lo, hi = R_lo, R_hi
    for _ in range(40):
        mid = 0.5 * (lo + hi)
        if ok(mid):
            hi = mid
        else:
            lo = mid
    return hi

# ---------------------------------------------------------------- chapter 5: dynamics and contact
def dynamics(P, pts=None):
    pts = pts or sweep(P)
    w = 2 * math.pi * P["n_rpm"] / 60.0
    out = []
    for p in pts:
        a = p["s2"] * w ** 2 / 1000.0                        # m/s^2
        v = p["s1"] * w / 1000.0                             # m/s
        Fi = P["m"] * a
        Fs = P["F0_spring"] + P["k_spring"] * p["s"]
        seg = segment_at(P, p["theta"])
        Fe = P["F_ext_rise"] if seg["kind"] == "rise" else 0.0
        Fc = Fi + Fs + Fe                                    # force along the follower axis (cam pushes up)
        phi = math.radians(p["phi_deg"])
        Fn = Fc / math.cos(phi)
        T = Fc * p["s1"] / 1000.0                            # N m (power balance T w = Fc v)
        out.append({"theta": p["theta"], "v": v, "a": a, "Fi": Fi, "Fs": Fs, "Fe": Fe, "Fc": Fc, "Fn": Fn,
                    "Fside": Fn * math.sin(phi), "T": T})
    return out

def jump_check(P, dyn=None):
    dyn = dyn or dynamics(P)
    Fmin = min(d["Fc"] for d in dyn)
    # preload that brings the minimum contact force exactly to zero (add your own margin, e.g. 30-50 %)
    need = max(0.0, -(Fmin - P["F0_spring"]))
    return {"Fc_min": Fmin, "lift_off": Fmin <= 0.0, "F0_min_no_jump": need,
            "theta_Fc_min": min(dyn, key=lambda d: d["Fc"])["theta"]}

def hertz_line(F, b, r1, r2, E=210000.0, nu=0.3):
    """Line contact: p_max = sqrt(F (1/r1 + 1/r2) / (pi b 2 (1 - nu^2)/E)); r2 < 0 for a concave body."""
    k = 1.0 / r1 + 1.0 / r2
    if k <= 0 or F <= 0:
        return 0.0
    return math.sqrt(F * k / (math.pi * b * 2 * (1 - nu ** 2) / E))

def contact(P, pts=None, dyn=None):
    pts = pts or sweep(P)
    dyn = dyn or dynamics(P, pts)
    w = 2 * math.pi * P["n_rpm"] / 60.0
    res = []
    for p, d in zip(pts, dyn):
        rc = p["rho_cam"]
        pm = hertz_line(max(d["Fn"], 0.0), P["b_roller"], P["rr"], rc, P["E"], P["nu"])   # rho_cam < 0 on concave parts
        # rolling speed on the profile = pitch speed x rho_cam / rho_pitch
        vprof = w * p["speed_mm_rad"] * abs(rc / p["rho_pitch"]) if p["rho_pitch"] not in (0.0, float("inf")) else w * p["speed_mm_rad"]
        res.append({"theta": p["theta"], "p_max": pm, "n_roller": vprof / P["rr"] * 60 / (2 * math.pi)})
    i = max(range(len(res)), key=lambda k: res[k]["p_max"])
    return {"p_max": res[i]["p_max"], "theta_p_max": res[i]["theta"], "S_H": P["p_allow"] / res[i]["p_max"],
            "n_roller_max": max(r["n_roller"] for r in res), "series": res}

# ---------------------------------------------------------------- chapter 7: manufacturing data
def tool_path(P, r_tool, pts=None):
    """Centre path of a cutter / grinding wheel of radius r_tool: pitch curve offset by (r_tool - rr) along the outward normal.
    Concave regions need |rho_cam| >= r_tool, otherwise the tool cuts too much (gouging)."""
    pts = pts or sweep(P)
    path = [(p["pitch"][0] + (r_tool - P["rr"]) * p["normal"][0], p["pitch"][1] + (r_tool - P["rr"]) * p["normal"][1]) for p in pts]
    conc = [abs(p["rho_cam"]) for p in pts if p["rho_pitch"] < 0]
    return {"path": path, "rho_concave_min": min(conc) if conc else None, "gouge": bool(conc) and min(conc) < r_tool}

# ---------------------------------------------------------------- report / run
def report_text(P):
    pts = sweep(P)
    g = geometry_summary(P, pts)
    dyn = dynamics(P, pts)
    jc = jump_check(P, dyn)
    ct = contact(P, pts, dyn)
    w = 2 * math.pi * P["n_rpm"] / 60.0
    L = ["# Cam report - %s\n" % P["name"],
         "stroke %.1f mm, base circle R0 %.1f (pitch %.1f), roller r %.1f x %.1f mm, offset e %.1f, %.0f rpm (ccw)" % (
             P["h"], P["R0"], P["R0"] + P["rr"], P["rr"], P["b_roller"], P["e"], P["n_rpm"]),
         "\n## Motion programme"]
    for s in P["segments"]:
        if s["kind"] == "dwell":
            L.append("- dwell %.1f deg" % s["beta"])
        else:
            cv = characteristic_values(s["law"])
            br = math.radians(s["beta"])
            L.append("- %s %.1f deg, %s (C_v %.3f, C_a %.3f, C_j %.1f): v_max %.3f m/s, a_max %.1f m/s^2, jerk_max %.0f m/s^3" % (
                s["kind"], s["beta"], s["law"], cv["Cv"], cv["Ca"], cv["Cj"], cv["Cv"] * P["h"] * w / br / 1000,
                cv["Ca"] * P["h"] * w ** 2 / br ** 2 / 1000, cv["Cj"] * P["h"] * w ** 3 / br ** 3 / 1000))
    L += ["\n## Geometry",
          "- pressure angle max %+.2f deg, min %+.2f deg; largest |phi| at %.1f deg (allow %.0f: %s)" % (
              g["phi_max"], g["phi_min"], g["theta_phi_max"], P["phi_allow"], "OK" if g["phi_ok"] else "TOO LARGE"),
          "- smallest convex radius: pitch curve %.2f, profile %.2f mm (roller %.1f: %s); smallest concave profile radius %s" % (
              g["rho_pitch_min_convex"], g["rho_cam_min_convex"], P["rr"], "UNDERCUT" if g["undercut"] else "no undercut",
              "%.2f mm" % g["rho_concave_min"] if g["rho_concave_min"] else "none (profile fully convex)"),
          "- smallest base circle for phi <= %.0f deg and rho_pitch >= 1.5 r: R0 = %.2f mm" % (P["phi_allow"], size_base_circle(P) or float("nan")),
          "\n## Dynamics",
          "- follower force: inertia %.0f..%.0f N, spring %.0f..%.0f N, contact force min %.1f N at %.1f deg (%s)" % (
              min(d["Fi"] for d in dyn), max(d["Fi"] for d in dyn), min(d["Fs"] for d in dyn), max(d["Fs"] for d in dyn),
              jc["Fc_min"], jc["theta_Fc_min"], "LIFT-OFF" if jc["lift_off"] else "keeps contact"),
          "- minimum spring preload for contact: %.1f N (actual %.1f N)" % (jc["F0_min_no_jump"], P["F0_spring"]),
          "- normal force max %.0f N, side force on the guide max %.0f N, camshaft torque %.2f .. %.2f N m (mean %.3f)" % (
              max(d["Fn"] for d in dyn), max(abs(d["Fside"]) for d in dyn), min(d["T"] for d in dyn), max(d["T"] for d in dyn),
              sum(d["T"] for d in dyn) / len(dyn)),
          "\n## Contact",
          "- Hertz stress max %.0f MPa at %.1f deg (allow %.0f) -> S %.2f; roller speed max %.0f rpm" % (
              ct["p_max"], ct["theta_p_max"], P["p_allow"], ct["S_H"], ct["n_roller_max"])]
    tc, tg = tool_path(P, P["rc"], pts), tool_path(P, P["rg"], pts)
    L += ["\n## Manufacturing",
          "- cutter r %.1f mm: %s; grinding wheel r %.1f mm: %s" % (
              P["rc"], "gouges concave parts" if tc["gouge"] else "OK", P["rg"], "gouges concave parts" if tg["gouge"] else "OK")]
    return "\n".join(L)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    pts = sweep(P)
    tc = tool_path(P, P["rc"], pts)
    with open(os.path.join(out, "profile.csv"), "w", encoding="utf-8") as f:
        f.write("theta_deg,s_mm,profile_x,profile_y,pitch_x,pitch_y,cutter_x,cutter_y,phi_deg,rho_cam\n")
        for p, c in zip(pts, tc["path"]):
            f.write("%.2f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.4f,%.4f\n" % (
                p["theta"], p["s"], p["profile"][0], p["profile"][1], p["pitch"][0], p["pitch"][1], c[0], c[1], p["phi_deg"], p["rho_cam"]))
    print(rep)
    print("written: report.md, profile.csv ->", out)


# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2: types
CAM_TYPES = [
    # name, contact closure, typical use, remark
    ("disc (radial) cam", "spring / gravity (force closure)", "packaging, valve trains, feeders", "simplest, cheapest; lift-off risk at speed"),
    ("grooved disc cam (positive drive)", "form closure (roller in a groove)", "presses, sewing and textile machines", "no spring; roller changes rotation at every flank change -> backlash, wear"),
    ("conjugate (double disc) cam", "form closure, two rollers on two discs", "high-speed indexers, printing", "no backlash with preload; two profiles must match (grinding together)"),
    ("cylindrical (barrel) cam", "groove on a cylinder, form closure", "axial strokes, tool changers, assembly", "follower moves parallel to the cam axis"),
    ("globoid cam (roller-gear indexer)", "form closure, several rollers engaged", "rotary indexing tables, ATC", "very stiff, preloaded; made on special 5-axis machines"),
    ("face cam", "groove or rib on a disc face", "light mechanisms", "follower moves radially in the face plane"),
]
FOLLOWER_TYPES = [
    ("translating roller", "low friction (rolling), pressure angle limit ~30 deg", "default of this guide"),
    ("oscillating roller (lever)", "pressure angle limit ~45 deg, stroke amplified by the lever", "chapter 4.8"),
    ("translating flat-faced (mushroom)", "pressure angle 0 (no offset), needs a convex cam (R0 + s + s'' > 0)", "valve trains, chapter 4.9"),
    ("knife edge", "point contact, very high stress and wear", "only instruments / very light loads"),
]

# ---------------------------------------------------------------- chapter 2: VDI 2143 movement tasks
MOTION_TASKS = [
    # code, start, end, boundary conditions of the normalised law (y', y'' at x = 0 and x = 1)
    ("R-R", "dwell (Rast)", "dwell", "y'(0)=y'(1)=0, y''(0)=y''(1)=0 -> cycloidal, modsine, modtrap, 3-4-5, 4-5-6-7"),
    ("R-G", "dwell", "constant velocity (Gleichgeschwindigkeit)", "y'(0)=0, y''(0)=0; y'(1)=v1, y''(1)=0 -> polynomial with end velocity"),
    ("G-R", "constant velocity", "dwell", "mirror of R-G"),
    ("G-G", "constant velocity", "constant velocity", "y'(0)=v0, y'(1)=v1, y''=0 at both ends (velocity change)"),
    ("R-U", "dwell", "reversal (Umkehr)", "y'(0)=0, y''(0)=0; y'(1)=0, y''(1) != 0 (turning point at the top, no dwell)"),
    ("U-U", "reversal", "reversal", "y'=0 at both ends, y'' != 0 -> e.g. simple harmonic is ideal here"),
]

def law_char_table():
    """C_v, C_a, C_j, C_v*C_a, power factor max(y' y''), acceleration at the ends (jump -> infinite jerk at a dwell)."""
    rows = []
    for law in LAWS:
        T = law_table(law)
        c = characteristic_values(law)
        cp = max(abs(v * a) for v, a in zip(T["v"], T["a"]))
        rows.append({"law": law, "Cv": c["Cv"], "Ca": c["Ca"], "Cj": c["Cj"], "CvCa": c["Cv"] * c["Ca"], "Cp": cp,
                     "a0": T["a"][0], "a1": T["a"][-1]})
    return rows

def law_samples(law, n=10):
    return [(i / n,) + law_values(law, i / n) for i in range(n + 1)]

def harmonic_jerk_at_dwell(P=None, beta_deg=120.0):
    """Simple harmonic between dwells: acceleration jumps from 0 to h pi^2/(2 beta^2) omega^2 -> theoretically infinite jerk."""
    P = P or DEFAULT
    w = 2 * math.pi * P["n_rpm"] / 60.0
    b = math.radians(beta_deg)
    return P["h"] * math.pi ** 2 / 2 / b ** 2 * w ** 2 / 1000.0      # m/s^2 jump

# ---------------------------------------------------------------- chapter 3: polynomial with arbitrary boundary conditions
def gauss_solve(A, b):
    """Gaussian elimination with partial pivoting (stdlib)."""
    n = len(b)
    M = [list(map(float, A[i])) + [float(b[i])] for i in range(n)]
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

def poly_bc(y0=0.0, v0=0.0, a0=0.0, y1=1.0, v1=0.0, a1=0.0):
    """5th-order normalised law y = sum c_k x^k with y, y', y'' given at x = 0 and x = 1."""
    rows, rhs = [], []
    for x, (y, v, a) in ((0.0, (y0, v0, a0)), (1.0, (y1, v1, a1))):
        rows.append([x ** k for k in range(6)]); rhs.append(y)
        rows.append([k * x ** (k - 1) if k >= 1 else 0.0 for k in range(6)]); rhs.append(v)
        rows.append([k * (k - 1) * x ** (k - 2) if k >= 2 else 0.0 for k in range(6)]); rhs.append(a)
    return gauss_solve(rows, rhs)

def poly_eval(c, x):
    y = sum(ck * x ** k for k, ck in enumerate(c))
    v = sum(k * ck * x ** (k - 1) for k, ck in enumerate(c) if k >= 1)
    a = sum(k * (k - 1) * ck * x ** (k - 2) for k, ck in enumerate(c) if k >= 2)
    j = sum(k * (k - 1) * (k - 2) * ck * x ** (k - 3) for k, ck in enumerate(c) if k >= 3)
    return y, v, a, j

def poly_char(c, n=2000):
    pts = [poly_eval(c, i / n) for i in range(n + 1)]
    return {"Cv": max(abs(p[1]) for p in pts), "Ca": max(abs(p[2]) for p in pts), "Cj": max(abs(p[3]) for p in pts),
            "y_min": min(p[0] for p in pts), "y_max": max(p[0] for p in pts)}

def r_g_transfer(h1=15.0, beta1_deg=90.0, V_mm_per_deg=0.25):
    """R-G task: rise h1 over beta1 from rest into a constant velocity V (mm per cam degree).
    Normalised end velocity v1 = V beta1 / h1 (y' is per unit x = theta / beta1)."""
    v1 = V_mm_per_deg * beta1_deg / h1
    c = poly_bc(v1=v1)
    return {"v1": v1, "c": c, "char": poly_char(c)}

def velocity_matching_check(P=None, eps=1e-3):
    """Continuity of s, s', s'' across every segment boundary of the motion programme (left / right limits)."""
    P = P or DEFAULT
    out, a0 = [], 0.0
    for seg in P["segments"]:
        a0 += seg["beta"]
        L = motion(P, a0 - eps)
        R = motion(P, (a0 + eps) % 360.0)
        out.append({"theta": a0 % 360.0, "ds": R[0] - L[0], "dv": R[1] - L[1], "da": R[2] - L[2]})
    return out

# ---------------------------------------------------------------- chapter 4: geometry studies
def offset_study(P=None, es=(-10.0, -5.0, 0.0, 5.0, 10.0)):
    P = P or DEFAULT
    out = []
    for e in es:
        g = geometry_summary(dict(P, e=e, step_deg=1.0))
        out.append({"e": e, "phi_max": g["phi_max"], "phi_min": g["phi_min"], "rho_min": g["rho_pitch_min_convex"]})
    return out

def base_circle_curve(P=None, R0s=(10.0, 15.0, 20.0, 30.0, 40.0, 60.0)):
    P = P or DEFAULT
    out = []
    for R0 in R0s:
        g = geometry_summary(dict(P, R0=R0, step_deg=1.0))
        out.append({"R0": R0, "phi_max": max(abs(g["phi_max"]), abs(g["phi_min"])), "rho_p": g["rho_pitch_min_convex"],
                    "rho_cam": g["rho_cam_min_convex"], "undercut": g["undercut"]})
    return out

STEEP_SEGMENTS = [   # fast programme: 20 mm rise in only 60 deg -> sharp nose, undercut risk
    {"kind": "rise", "law": "modsine", "beta": 60.0}, {"kind": "dwell", "beta": 120.0},
    {"kind": "return", "law": "cycloidal", "beta": 60.0}, {"kind": "dwell", "beta": 120.0}]

def roller_size_study(P=None, rrs=(5.0, 10.0, 15.0, 20.0), Rps=(25.0, 35.0, 45.0), segments=None):
    """Keep the PITCH base circle Rp = R0 + rr constant -> same pitch curve; the profile radius rho_cam = rho_pitch - rr
    changes with the roller. Undercut when rho_pitch_min <= rr (profile radius <= 0)."""
    P = dict(P or DEFAULT, segments=segments or STEEP_SEGMENTS)
    out = []
    for Rp in Rps:
        for rr in rrs:
            g = geometry_summary(dict(P, R0=Rp - rr, rr=rr, step_deg=0.5))
            out.append({"Rp": Rp, "rr": rr, "R0": Rp - rr, "rho_p": g["rho_pitch_min_convex"], "rho_cam": g["rho_cam_min_convex"],
                        "conc": g["rho_concave_min"], "phi": max(abs(g["phi_max"]), abs(g["phi_min"])), "undercut": g["undercut"]})
    return out

def phi_max_single(law, beta_deg, Rp_over_h, n=400):
    """Max pressure angle of one rise (e = 0): tan(phi) = (h y'/beta) / (Rp + h y), in units of h."""
    b = math.radians(beta_deg)
    return max(math.degrees(math.atan2(law_values(law, i / n)[1] / b, Rp_over_h + law_values(law, i / n)[0])) for i in range(n + 1))

def nomogram(laws=("cycloidal", "harmonic", "poly345", "modsine", "modtrap"), betas=(60.0, 90.0, 120.0, 180.0), phi_allow=30.0):
    """Flocke-style nomogram data: smallest pitch base radius Rp / h for phi_max = phi_allow (translating, e = 0)."""
    res = {}
    for law in laws:
        row = []
        for b in betas:
            lo, hi = 0.0, 50.0
            for _ in range(50):
                mid = 0.5 * (lo + hi)
                if phi_max_single(law, b, mid) > phi_allow:
                    lo = mid
                else:
                    hi = mid
            row.append(hi)
        res[law] = row
    return res

# ---------------------------------------------------------------- chapter 4: oscillating roller follower
OSC_DEFAULT = {"d": 80.0, "L": 60.0, "Psi_deg": 20.0, "Rp": 50.0}

def osc_center(P, O, theta_deg):
    """Roller centre in the cam frame. Pivot at (d, 0) in the fixed frame, arm length L, angle psi between the arm and
    the line pivot -> cam centre: C = (d - L cos psi, L sin psi); psi = psi0 + Psi * y."""
    d, L = O["d"], O["L"]
    psi0 = math.acos((d ** 2 + L ** 2 - O["Rp"] ** 2) / (2 * d * L))
    s, _, _, _ = motion(P, theta_deg)
    psi = psi0 + math.radians(O["Psi_deg"]) * s / P["h"]
    C = (d - L * math.cos(psi), L * math.sin(psi))
    th = math.radians(theta_deg)
    c, sn = math.cos(-th), math.sin(-th)
    vdir = (L * math.sin(psi), L * math.cos(psi))            # direction of the roller-centre velocity (fixed frame)
    rot = lambda p: (c * p[0] - sn * p[1], sn * p[0] + c * p[1])
    return rot(C), rot(vdir), psi

def osc_point(P, O, theta_deg, h=0.05):
    """Pressure angle and pitch-curve radius of curvature of the oscillating follower (numerical, 3-point)."""
    A, _, _ = osc_center(P, O, theta_deg - h)
    B, v, psi = osc_center(P, O, theta_deg)
    C, _, _ = osc_center(P, O, theta_deg + h)
    T = (C[0] - A[0], C[1] - A[1])
    tm = math.hypot(*T)
    vm = math.hypot(*v)
    phi = math.degrees(math.asin(min(1.0, abs((T[0] * v[0] + T[1] * v[1]) / (tm * vm)))))
    ab, bc, ca = math.dist(A, B), math.dist(B, C), math.dist(C, A)
    cr = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])
    rho = ab * bc * ca / (2 * cr) if cr != 0 else float("inf")
    return {"theta": theta_deg, "phi": phi, "rho": rho, "psi_deg": math.degrees(psi), "center": B}

def osc_summary(P=None, O=None, step=1.0):
    P, O = P or DEFAULT, O or OSC_DEFAULT
    pts = [osc_point(P, O, i * step) for i in range(int(360 / step))]
    i = max(range(len(pts)), key=lambda k: pts[k]["phi"])
    rhos = [abs(p["rho"]) for p in pts]
    return {"phi_max": pts[i]["phi"], "theta_phi_max": pts[i]["theta"], "rho_min_abs": min(rhos),
            "psi0_deg": pts[0]["psi_deg"], "roller_travel_mm": O["L"] * math.radians(O["Psi_deg"])}

# ---------------------------------------------------------------- chapter 4: flat-faced follower
def flat_faced(P=None, R0=None, step=0.5):
    """Translating flat-faced follower (face normal to the stroke): radius of curvature of the cam rho = R0 + s + s''
    (must be > 0 everywhere), contact point distance from the follower axis x = s' (face half width >= max |s'|)."""
    P = P or DEFAULT
    R0 = P["R0"] if R0 is None else R0
    vals = [motion(P, i * step) for i in range(int(360 / step))]
    rho_min = min(R0 + s + s2 for s, s1, s2, _ in vals)
    need = max(-(s + s2) for s, s1, s2, _ in vals)
    return {"R0": R0, "rho_min": rho_min, "R0_min_convex": need, "x_max": max(s1 for _, s1, _, _ in vals),
            "x_min": min(s1 for _, s1, _, _ in vals)}

# ---------------------------------------------------------------- demo
def demo_ch24():
    P = dict(DEFAULT)
    print("## 2.1 Cam types")
    for n, cl, use, rem in CAM_TYPES:
        print("  %-36s | %-38s | %-36s | %s" % (n, cl, use, rem))
    print("\n## 2.2 Follower types")
    for n, ch, rem in FOLLOWER_TYPES:
        print("  %-32s | %-66s | %s" % (n, ch, rem))
    print("\n## 2.3 VDI 2143 movement tasks")
    for code, a, b, bc in MOTION_TASKS:
        print("  %-4s %-14s -> %-42s %s" % (code, a, b, bc))
    print("\n## 2.4 Characteristic values (normalised)")
    print("  law        C_v    C_a     C_j    C_v*C_a  max|y'y''|  y''(0)  y''(1)")
    for r in law_char_table():
        print("  %-9s %5.3f  %5.3f  %6.1f   %6.3f     %6.3f   %6.3f  %6.3f" % (
            r["law"], r["Cv"], r["Ca"], r["Cj"], r["CvCa"], r["Cp"], r["a0"], r["a1"]))
    print("\n## 2.5 Sampled modified sine (x, y, y', y'', y''')")
    for x, y, v, a, j in law_samples("modsine", 8):
        print("  x %.3f  y %.5f  y' %.4f  y'' %+.4f  y''' %+8.2f" % (x, y, v, a, j))
    print("\n## 2.6 Simple harmonic between dwells: acceleration jump at the dwell (%.0f rpm, beta 120 deg)" % P["n_rpm"])
    print("  jump %.2f m/s^2 in zero time -> jerk theoretically infinite" % harmonic_jerk_at_dwell(P))
    print("\n## 3.3 Polynomial with arbitrary boundary conditions")
    c = poly_bc()
    print("  zero end conditions -> c = [%s]  (3-4-5 law)" % ", ".join("%.4f" % x for x in c))
    t = r_g_transfer()
    print("  R-G transfer h1 15 mm / 90 deg into V 0.25 mm/deg: v1 = %.3f; c = [%s]" % (t["v1"], ", ".join("%.4f" % x for x in t["c"])))
    print("  C_v %.3f, C_a %.3f, C_j %.1f, y in [%.4f, %.4f]" % (t["char"]["Cv"], t["char"]["Ca"], t["char"]["Cj"], t["char"]["y_min"], t["char"]["y_max"]))
    for v1 in (1.0, 2.0, 3.0):
        ch = poly_char(poly_bc(v1=v1))
        print("  v1 %.1f: C_a %.3f, y_min %.4f, y_max %.4f %s" % (v1, ch["Ca"], ch["y_min"], ch["y_max"], "(overshoot!)" if ch["y_max"] > 1 + 1e-9 else ""))
    print("\n## 3.4 Continuity at the segment boundaries of the default programme")
    for r in velocity_matching_check(P):
        print("  theta %5.1f: jump s %+.2e mm, s' %+.2e mm/rad, s'' %+.2e mm/rad^2" % (r["theta"], r["ds"], r["dv"], r["da"]))
    print("\n## 4.5 Offset study (R0 40, rr 10)")
    for r in offset_study(P):
        print("  e %+5.1f mm: phi_max %+6.2f deg, phi_min %+6.2f deg, rho_pitch_min %.2f mm" % (r["e"], r["phi_max"], r["phi_min"], r["rho_min"]))
    print("\n## 4.6 Base circle study (e 0, rr 10)")
    for r in base_circle_curve(P):
        print("  R0 %5.1f: |phi|max %5.2f deg, rho_pitch_min %6.2f, rho_cam_min %6.2f mm %s" % (
            r["R0"], r["phi_max"], r["rho_p"], r["rho_cam"], "UNDERCUT" if r["undercut"] else ""))
    print("  sized R0 (phi <= 30, rho_p >= 1.5 rr): %.2f mm" % size_base_circle(P))
    print("\n## 4.7 Undercut: steep programme (rise 20 mm in 60 deg modsine, return 60 deg cycloidal), roller vs pitch base circle")
    for r in roller_size_study(P):
        print("  Rp %4.1f rr %4.1f (R0 %4.1f): |phi|max %4.1f deg, rho_pitch_min %5.2f, rho_cam_min %+6.2f, concave min %5.2f mm %s" % (
            r["Rp"], r["rr"], r["R0"], r["phi"], r["rho_p"], r["rho_cam"], r["conc"], "UNDERCUT" if r["undercut"] else ""))
    print("\n## 4.6b Nomogram: smallest Rp/h for phi_max 30 deg (translating, e 0)")
    nm = nomogram()
    print("  law        beta 60   90    120   180")
    for law, row in nm.items():
        print("  %-9s  %s" % (law, "  ".join("%5.2f" % x for x in row)))
    print("\n## 4.8 Oscillating roller follower (d 80, L 60, Psi 20 deg, Rp 50)")
    o = osc_summary(P)
    print("  psi0 %.3f deg, roller travel %.2f mm, phi_max %.2f deg at %.0f deg, smallest |rho_pitch| %.2f mm" % (
        o["psi0_deg"], o["roller_travel_mm"], o["phi_max"], o["theta_phi_max"], o["rho_min_abs"]))
    for L in (40.0, 60.0, 80.0):
        O = dict(OSC_DEFAULT, L=L, Psi_deg=math.degrees(OSC_DEFAULT["L"] * math.radians(20.0) / L))
        o = osc_summary(P, O)
        print("  L %4.0f (Psi %5.2f deg, same travel): phi_max %.2f deg, |rho|min %.2f mm" % (L, O["Psi_deg"], o["phi_max"], o["rho_min_abs"]))
    print("\n## 4.9 Flat-faced follower")
    for R0 in (40.0, 15.0, 10.0):
        f = flat_faced(P, R0)
        print("  R0 %4.1f: rho_min %+.2f mm (%s), R0 needed > %.2f mm; contact offset x %.2f .. %.2f mm" % (
            f["R0"], f["rho_min"], "convex OK" if f["rho_min"] > 0 else "CUSP - not usable", f["R0_min_convex"], f["x_min"], f["x_max"]))

# ================================================================ added with guide chapters (ch56)
# ---------------------------------------------------------------- 5.2 guide friction and jamming
def guide_forces(P, a_over=40.0, L_guide=60.0, mu=0.10):
    """Follower in two bushings (spacing L_guide); cam contact a_over below the lower bushing.
    Side force F_n sin(phi) -> bushing reactions R1 = Fs (a + L)/L, R2 = Fs a/L; friction mu (R1 + R2) acts against the motion.
    Moving up: F_n (cos phi - mu sin phi (1 + 2a/L)) = F_load  ->  jamming when tan phi >= 1 / (mu (1 + 2a/L))."""
    k = mu * (1 + 2 * a_over / L_guide)
    phi_jam = math.degrees(math.atan(1 / k))
    pts = sweep(P)
    dyn = dynamics(P, pts)
    worst = None
    for p, d in zip(pts, dyn):
        phi = math.radians(p["phi_deg"])
        sgn = 1.0 if d["v"] >= 0 else -1.0          # friction opposes the follower velocity
        den = math.cos(phi) - sgn * k * abs(math.sin(phi))   # F_n cos(phi) - sign(v) mu (R1 + R2) = F_load
        Fn_mu = d["Fc"] / den if den > 0 else float("inf")
        ratio = Fn_mu / d["Fn"] if d["Fn"] > 1e-9 else 1.0
        if worst is None or ratio > worst["ratio"]:
            worst = {"theta": p["theta"], "phi": p["phi_deg"], "Fn": d["Fn"], "Fn_mu": Fn_mu, "ratio": ratio}
    return {"k": k, "phi_jam": phi_jam, "worst": worst,
            "R1_over_side": (a_over + L_guide) / L_guide, "R2_over_side": a_over / L_guide}

def jam_table(mus=(0.05, 0.10, 0.15, 0.20), ratios=(0.0, 0.5, 1.0, 2.0)):
    """Jamming pressure angle vs friction coefficient and overhang ratio a/L."""
    return [[mu] + [math.degrees(math.atan(1 / (mu * (1 + 2 * r)))) for r in ratios] for mu in mus], ratios

# ---------------------------------------------------------------- 5.3 lift-off speed and spring
def lift_off_speed(P):
    """Contact force Fc = m s'' w^2 + F_s + F_e >= 0. Only points with s'' < 0 can lift off:
    w_lim^2 = min (F_s + F_e) / (-m s'' / 1000)  (s'' in mm/rad^2)."""
    pts = sweep(P)
    best = None
    for p in pts:
        if p["s2"] < 0:
            Fs = P["F0_spring"] + P["k_spring"] * p["s"]
            Fe = P["F_ext_rise"] if segment_at(P, p["theta"])["kind"] == "rise" else 0.0
            w2 = (Fs + Fe) / (-P["m"] * p["s2"] / 1000.0)
            if best is None or w2 < best[0]:
                best = (w2, p["theta"], p["s"], p["s2"])
    w = math.sqrt(best[0])
    return {"n_lim": w * 60 / (2 * math.pi), "theta": best[1], "s": best[2], "s2": best[3]}

def spring_requirement(P, n_design=None, margin=1.3, rates=(1.0, 2.0, 3.0, 4.0, 6.0)):
    """Required preload F0 for each spring rate k: F0 + k s >= margin (-m a - F_e) at every angle (margin check)."""
    n = n_design or P["n_rpm"]
    w = 2 * math.pi * n / 60.0
    pts = sweep(P)
    rows = []
    for k in rates:
        need = 0.0
        for p in pts:
            a = p["s2"] * w ** 2 / 1000.0
            Fe = P["F_ext_rise"] if segment_at(P, p["theta"])["kind"] == "rise" else 0.0
            need = max(need, margin * (-P["m"] * a - Fe) - k * p["s"])
        rows.append({"k": k, "F0": need, "F_max": need + k * P["h"]})
    return rows

def helical_spring(k_req, F_max, d=2.5, D=20.0, G=81500.0, rho=7.85e-6, Rm=1900.0):
    """Cylindrical compression spring: n = G d^4 / (8 D^3 k); Wahl K = (4c-1)/(4c-4) + 0.615/c; tau = K 8 F D / (pi d^3);
    spring mass m = rho pi^2 d^2 D n / 4; surge (first natural) frequency, both ends fixed: f = 0.5 sqrt(k / m)."""
    c = D / d
    n = G * d ** 4 / (8 * D ** 3 * k_req)
    K = (4 * c - 1) / (4 * c - 4) + 0.615 / c
    tau = K * 8 * F_max * D / (math.pi * d ** 3)
    m = rho * math.pi ** 2 * d ** 2 * D * n / 4          # kg
    f = 0.5 * math.sqrt(k_req * 1000.0 / m)              # Hz
    return {"c": c, "n": n, "K": K, "tau": tau, "tau_allow": 0.5 * Rm, "m_kg": m, "f_surge": f}

# ---------------------------------------------------------------- 5.4 follower vibration (single DOF, RK4)
def sdof_rise(law, T_rise, fn, zeta=0.05, h=20.0, n_steps=4000, dwell_factor=2.0):
    """Base excitation by the cam: x'' = -2 zeta wn (x' - s') - wn^2 (x - s); s from the motion law over T_rise, then a dwell.
    Returns the peak inertia ratio max|x''| / max|s''| during the rise and the residual amplitude in the dwell (mm)."""
    wn = 2 * math.pi * fn
    T_end = T_rise * (1 + dwell_factor)
    dt = T_end / n_steps
    def base(t):
        if t >= T_rise:
            return h, 0.0, 0.0
        y, v, a, _ = law_values(law, t / T_rise)
        return h * y, h * v / T_rise, h * a / T_rise ** 2
    def f(t, x, xd):
        s, sd, _ = base(t)
        return -2 * zeta * wn * (xd - sd) - wn ** 2 * (x - s)
    x, xd, t = 0.0, 0.0, 0.0
    amax_x = amax_s = 0.0
    resid = 0.0
    for _ in range(n_steps):
        k1v, k1x = f(t, x, xd), xd
        k2v, k2x = f(t + dt / 2, x + dt / 2 * k1x, xd + dt / 2 * k1v), xd + dt / 2 * k1v
        k3v, k3x = f(t + dt / 2, x + dt / 2 * k2x, xd + dt / 2 * k2v), xd + dt / 2 * k2v
        k4v, k4x = f(t + dt, x + dt * k3x, xd + dt * k3v), xd + dt * k3v
        x += dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x)
        xd += dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v)
        t += dt
        if t <= T_rise:
            amax_x = max(amax_x, abs(f(t, x, xd)))
            amax_s = max(amax_s, abs(base(t)[2]))
        else:
            resid = max(resid, math.hypot(x - h, xd / wn))   # amplitude of the free vibration around h
    return {"amp_ratio": amax_x / amax_s, "residual_mm": resid}

def residual_table(laws=("harmonic", "cycloidal", "poly345", "modsine", "modtrap"), ratios=(2.0, 2.5, 4.0, 4.5, 6.0, 6.5, 9.5, 10.0), zeta=0.0, h=20.0):
    """Residual vibration amplitude after a rise vs ratio T_rise / T_n (T_n = 1/fn), undamped by default."""
    rows = []
    for law in laws:
        rows.append([law] + [sdof_rise(law, r, 1.0, zeta, h)["residual_mm"] for r in ratios])
    return rows, ratios

def follower_vibration(P, k_f=2.0e6, zeta=0.05):
    """Default follower: stiffness of follower + roller pin + guide k_f (N/m), mass m -> fn; rise time from rpm."""
    fn = math.sqrt(k_f / P["m"]) / (2 * math.pi)
    seg = P["segments"][0]
    T_rise = seg["beta"] / 360.0 * 60.0 / P["n_rpm"]
    r = sdof_rise(seg["law"], T_rise, fn, zeta, P["h"])
    return {"fn": fn, "T_rise": T_rise, "ratio": T_rise * fn, **r}

# ---------------------------------------------------------------- 5.5 camshaft torque, harmonics, flywheel
def torque_harmonics(P, nh=6):
    dyn = dynamics(P)
    N = len(dyn)
    th = [math.radians(d["theta"]) for d in dyn]
    T = [d["T"] for d in dyn]
    mean = sum(T) / N
    out = []
    for k in range(1, nh + 1):
        a = 2.0 / N * sum(Ti * math.cos(k * t) for Ti, t in zip(T, th))
        b = 2.0 / N * sum(Ti * math.sin(k * t) for Ti, t in zip(T, th))
        out.append({"k": k, "amp": math.hypot(a, b), "f_hz": k * P["n_rpm"] / 60.0})
    return {"mean": mean, "harm": out}

def flywheel(P, delta=0.02):
    """Energy fluctuation dE = max - min of the integral of (T - T_mean) d theta; J = dE / (delta w^2); powers."""
    dyn = dynamics(P)
    dth = math.radians(P["step_deg"])
    Tm = sum(d["T"] for d in dyn) / len(dyn)
    E, Emin, Emax = 0.0, 0.0, 0.0
    for d in dyn:
        E += (d["T"] - Tm) * dth
        Emin, Emax = min(Emin, E), max(Emax, E)
    w = 2 * math.pi * P["n_rpm"] / 60.0
    dE = Emax - Emin
    return {"T_mean": Tm, "T_max": max(d["T"] for d in dyn), "dE": dE, "J": dE / (delta * w ** 2),
            "P_mean": Tm * w, "P_peak": max(d["T"] for d in dyn) * w, "delta": delta}

# ---------------------------------------------------------------- 6.1 contact: materials, crowned roller
CONTACT_MATERIALS = [   # allowable Hertz stress (line contact, ~1e8 load cycles, lubricated) MPa - typical, check
    ("100Cr6 through-hardened 60 HRC", 1650),
    ("16MnCr5 case hardened 58-62 HRC", 1600),
    ("42CrMo4 induction hardened 52-56 HRC", 1300),
    ("31CrMoV9 gas nitrided", 1200),
    ("C45 quenched + tempered 250 HB", 650),
    ("EN-GJS-700 (ductile iron)", 600),
]

def crowned_contact(F, rr, rho_cam, R_crown=500.0, E=210000.0, nu=0.3):
    """Crowned roller on the cam: point contact (Hamrock-Brewe approximation).
    Rx = 1/(1/rr + 1/rho_cam), Ry = R_crown (cam straight across); k = 1.0339 (Ry/Rx)^0.636, Ebar = 1.0003 + 0.5968 Rx/Ry,
    E' = E/(1-nu^2); a = (6 k^2 Ebar F R / (pi E'))^(1/3) (along the roller axis), b = (6 Ebar F R / (pi k E'))^(1/3), p = 3F/(2 pi a b)."""
    Rx = 1.0 / (1.0 / rr + 1.0 / rho_cam)
    Ry = R_crown
    R = 1.0 / (1.0 / Rx + 1.0 / Ry)
    k = 1.0339 * (Ry / Rx) ** 0.636
    Eb = 1.0003 + 0.5968 * Rx / Ry
    Ep = E / (1 - nu ** 2)
    a = (6 * k ** 2 * Eb * F * R / (math.pi * Ep)) ** (1 / 3.0)
    b = (6 * Eb * F * R / (math.pi * k * Ep)) ** (1 / 3.0)
    return {"a": a, "b": b, "p": 3 * F / (2 * math.pi * a * b), "k": k}

def contact_detail(P, R_crown=500.0):
    pts = sweep(P)
    dyn = dynamics(P, pts)
    ct = contact(P, pts, dyn)
    i = max(range(len(pts)), key=lambda j: ct["series"][j]["p_max"])
    F = dyn[i]["Fn"]
    rc = pts[i]["rho_cam"]
    cr = crowned_contact(F, P["rr"], rc, R_crown, P["E"], P["nu"])
    q = F / P["b_roller"]
    bh = math.sqrt(8 * F * (1 - P["nu"] ** 2) / (math.pi * P["b_roller"] * P["E"] * (1 / P["rr"] + 1 / rc)))   # half width
    return {"theta": pts[i]["theta"], "F": F, "rho_cam": rc, "q": q, "p_line": ct["p_max"], "half_width": bh,
            "crown": cr, "edge_ok": 2 * cr["a"] < P["b_roller"], "z_max": 0.78 * bh, "tau_max": 0.30 * ct["p_max"]}

# ---------------------------------------------------------------- 6.2 track-roller life
def track_roller_life(P, C_w=3300.0, lim_h=20000.0):
    """Roller bearing life: equivalent load = cubic mean of F_n weighted with the roller revolutions,
    L10 = (C_w / P)^(10/3) 10^6 roller revolutions (C_w: effective dynamic capacity as track roller, check maker)."""
    pts = sweep(P)
    dyn = dynamics(P, pts)
    ct = contact(P, pts, dyn)
    num = den = 0.0
    for d, c in zip(dyn, ct["series"]):
        F = max(d["Fn"], 0.0)
        num += F ** 3 * c["n_roller"]
        den += c["n_roller"]
    Peq = (num / den) ** (1 / 3.0)
    n_mean = den / len(dyn)
    L10_rev = (C_w / Peq) ** (10 / 3.0) * 1e6
    L10_h = L10_rev / (n_mean * 60.0)
    return {"P_eq": Peq, "n_roller_mean": n_mean, "L10_rev": L10_rev, "L10_h": L10_h, "ok": L10_h >= lim_h, "C_w": C_w}

# ---------------------------------------------------------------- 6.3 lubrication film and roller slip
def film_thickness(P, eta0=0.09, alpha=2.0e-8, Rq=0.3):
    """Line contact EHL (Dowson-Higginson): h_min = 2.65 R U^0.7 G^0.54 W^-0.13 with U = eta0 u / (E' R), G = alpha E',
    W = w / (E' R) (w load per length), u = mean rolling (entraining) speed; lambda = h_min / sqrt(Rq1^2 + Rq2^2)."""
    pts = sweep(P)
    dyn = dynamics(P, pts)
    ct = contact(P, pts, dyn)
    Ep = P["E"] / (1 - P["nu"] ** 2) * 1e6               # Pa
    worst = None
    for p, d, c in zip(pts, dyn, ct["series"]):
        if d["Fn"] <= 0:
            continue
        Rx = 1.0 / (1.0 / P["rr"] + 1.0 / p["rho_cam"]) / 1000.0     # m
        u = c["n_roller"] * 2 * math.pi / 60 * P["rr"] / 1000.0      # rolling speed m/s (roller surface)
        if u <= 0:
            continue
        w = d["Fn"] / (P["b_roller"] / 1000.0)
        U, G, W = eta0 * u / (Ep * Rx), alpha * Ep, w / (Ep * Rx)
        h = 2.65 * Rx * U ** 0.7 * G ** 0.54 * W ** -0.13 * 1e6      # um
        lam = h / math.sqrt(2) / Rq
        if worst is None or lam < worst["lambda"]:
            worst = {"theta": p["theta"], "u": u, "h_um": h, "lambda": lam}
    return worst

def roller_slip(P, mu=0.05, M0=0.003, ri_frac=0.5, rho=7.85e-6):
    """Roller (ring r_o = rr, r_i = ri_frac rr, width b) must be accelerated by the cam friction:
    J alpha_r + M0 <= mu F_n rr (else the roller skids). J = m (r_o^2 + r_i^2)/2, alpha_r = d omega_r / d theta x omega."""
    pts = sweep(P)
    dyn = dynamics(P, pts)
    ct = contact(P, pts, dyn)
    ro, ri = P["rr"], ri_frac * P["rr"]
    m = rho * math.pi * (ro ** 2 - ri ** 2) * P["b_roller"]           # kg
    J = m * ((ro / 1000) ** 2 + (ri / 1000) ** 2) / 2                  # kg m^2
    w = 2 * math.pi * P["n_rpm"] / 60.0
    dth = math.radians(P["step_deg"])
    s = ct["series"]
    N = len(s)
    worst = None
    for i in range(N):
        wr1 = s[(i + 1) % N]["n_roller"] * 2 * math.pi / 60
        wr0 = s[i - 1]["n_roller"] * 2 * math.pi / 60
        alpha = (wr1 - wr0) / (2 * dth) * w
        need = J * abs(alpha) + M0
        avail = mu * max(dyn[i]["Fn"], 0.0) * ro / 1000.0
        ratio = avail / need
        if worst is None or ratio < worst["ratio"]:
            worst = {"theta": s[i]["theta"], "alpha": alpha, "need": need, "avail": avail, "ratio": ratio}
    return {"m_roller": m, "J": J, **worst}

# ---------------------------------------------------------------- demo
def demo_ch56():
    P = dict(DEFAULT)
    print("# M6 chapters 5-6 - dynamics, contact, roller bearing, lubrication (default cam, %.0f rpm)" % P["n_rpm"])
    g = guide_forces(P)
    wv = g["worst"]
    print("\n## 5.2 Guide friction (a = 40 mm overhang, L = 60 mm bushing spacing, mu 0.10)")
    print("  bushing reactions R1 = %.3f x side force, R2 = %.3f x side force; k = mu (1 + 2a/L) = %.4f" % (
        g["R1_over_side"], g["R2_over_side"], g["k"]))
    print("  jamming pressure angle %.2f deg; worst point %.1f deg (phi %+.2f): F_n %.1f -> %.1f N with friction (x%.3f)" % (
        g["phi_jam"], wv["theta"], wv["phi"], wv["Fn"], wv["Fn_mu"], wv["ratio"]))
    rows, rat = jam_table()
    print("  jamming angle [deg] vs mu (rows) and a/L (columns %s):" % ", ".join("%.1f" % r for r in rat))
    for r in rows:
        print("   mu %.2f: " % r[0] + "  ".join("%6.2f" % x for x in r[1:]))
    lo = lift_off_speed(P)
    print("\n## 5.3 Lift-off speed and spring")
    print("  lift-off speed %.1f rpm (critical point %.1f deg, s %.3f mm, s'' %.2f mm/rad^2)" % (lo["n_lim"], lo["theta"], lo["s"], lo["s2"]))
    jc = jump_check(P)
    print("  at %.0f rpm: Fc_min %.1f N at %.1f deg; minimum preload %.1f N" % (P["n_rpm"], jc["Fc_min"], jc["theta_Fc_min"], jc["F0_min_no_jump"]))
    print("  preload needed with margin 1.3 at 400 rpm:")
    for r in spring_requirement(P, 400.0):
        print("   k %.1f N/mm: F0 >= %6.1f N, F_max %6.1f N" % (r["k"], r["F0"], r["F_max"]))
    sp = [r for r in spring_requirement(P, 400.0) if r["k"] == 3.0][0]
    hs = helical_spring(3.0, sp["F_max"])
    print("  helical spring for k 3 N/mm, F_max %.1f N (d 2.5, D 20, G 81500): c %.1f, n_a %.2f, Wahl K %.4f, tau %.0f MPa (allow ~%.0f, check),"
          " mass %.4f kg, surge frequency %.1f Hz = %.1f x cam frequency at 400 rpm" % (
              sp["F_max"], hs["c"], hs["n"], hs["K"], hs["tau"], hs["tau_allow"], hs["m_kg"], hs["f_surge"], hs["f_surge"] / (400 / 60.0)))
    print("\n## 5.4 Follower vibration (single DOF, RK4)")
    fv = follower_vibration(P)
    print("  k_f 2.0e6 N/m, m %.1f kg -> fn %.1f Hz; rise %.4f s -> T_rise/T_n %.2f; inertia amplification %.3f, residual %.4f mm" % (
        P["m"], fv["fn"], fv["T_rise"], fv["ratio"], fv["amp_ratio"], fv["residual_mm"]))
    rows, rat = residual_table()
    print("  residual amplitude [mm] after a 20 mm rise, undamped, vs T_rise/T_n (%s):" % ", ".join("%.1f" % r for r in rat))
    for r in rows:
        print("   %-9s " % r[0] + "  ".join("%7.4f" % x for x in r[1:]))
    print("  inertia amplification vs T_rise/T_n (modsine, zeta 0.05):")
    for r in (3.0, 5.0, 10.0, 20.0):
        q = sdof_rise("modsine", r, 1.0, 0.05, 20.0)
        print("   ratio %4.1f: max|x''|/max|s''| %.3f, residual %.4f mm" % (r, q["amp_ratio"], q["residual_mm"]))
    print("\n## 5.5 Camshaft torque, harmonics, flywheel")
    th = torque_harmonics(P)
    print("  mean torque %.4f N m; harmonics: " % th["mean"] + ", ".join("%d: %.3f N m (%.0f Hz)" % (h["k"], h["amp"], h["f_hz"]) for h in th["harm"]))
    fw = flywheel(P)
    print("  energy fluctuation %.4f J -> J %.5f kg m^2 for delta %.2f; mean power %.1f W, peak %.1f W" % (
        fw["dE"], fw["J"], fw["delta"], fw["P_mean"], fw["P_peak"]))
    print("\n## 6.1 Contact stress detail")
    cd = contact_detail(P)
    print("  worst point %.1f deg: F_n %.1f N, rho_cam %.2f mm, q %.2f N/mm, p_line %.0f MPa, half width %.4f mm, tau_max %.0f MPa at depth %.4f mm" % (
        cd["theta"], cd["F"], cd["rho_cam"], cd["q"], cd["p_line"], cd["half_width"], cd["tau_max"], cd["z_max"]))
    c = cd["crown"]
    print("  crowned roller R_crown 500 mm: ellipse a %.3f (axial) x b %.4f mm, k %.2f, p_max %.0f MPa; ellipse inside width: %s" % (
        c["a"], c["b"], c["k"], c["p"], "yes" if cd["edge_ok"] else "NO - edge loading"))
    for R in (100.0, 250.0, 1000.0, 2000.0):
        q = crowned_contact(cd["F"], P["rr"], cd["rho_cam"], R)
        print("   R_crown %6.0f mm: 2a %.2f mm, p_max %.0f MPa" % (R, 2 * q["a"], q["p"]))
    print("  allowable Hertz stress (check):")
    for name, pa in CONTACT_MATERIALS:
        print("   %-38s %5d MPa -> S %.2f" % (name, pa, pa / cd["p_line"]))
    print("\n## 6.2 Track-roller life")
    tr = track_roller_life(P)
    print("  C_w %.0f N; equivalent load %.1f N; mean roller speed %.0f rpm; L10 %.3g rev = %.0f h (%s)" % (
        tr["C_w"], tr["P_eq"], tr["n_roller_mean"], tr["L10_rev"], tr["L10_h"], "OK" if tr["ok"] else "too short"))
    print("\n## 6.3 Lubrication film and roller slip")
    ft = film_thickness(P)
    print("  thinnest film at %.1f deg: u %.3f m/s, h_min %.3f um, lambda %.2f" % (ft["theta"], ft["u"], ft["h_um"], ft["lambda"]))
    rs = roller_slip(P)
    print("  roller m %.4f kg, J %.3e kg m^2; worst %.1f deg: alpha %.0f rad/s^2, needed %.4f N m, friction %.4f N m -> ratio %.2f (%s)" % (
        rs["m_roller"], rs["J"], rs["theta"], rs["alpha"], rs["need"], rs["avail"], rs["ratio"], "no slip" if rs["ratio"] >= 1 else "SKIDDING"))
    for n in (300, 400, 600):
        q = roller_slip(dict(P, n_rpm=n, F0_spring=max(P["F0_spring"], jump_check(dict(P, n_rpm=n))["F0_min_no_jump"] * 1.3)))
        print("   %d rpm (preload for contact x1.3): ratio %.2f at %.1f deg" % (n, q["ratio"], q["theta"]))

# ================================================================ added with guide chapters (ch78)
# ---------------------------------------------------------------- 7.1 process chains and materials
PROCESS_CHAINS_CAM = [   # route, typical use, profile tolerance mm, surface hardness, relative cost (1 = lowest) - check
    ("laser / flame cut plate -> mill contour -> induction harden -> grind", "single cams, machine building, medium load", 0.01, "55-60 HRC", 3),
    ("bar / forging -> turn -> mill contour -> case harden (16MnCr5) -> grind", "high load, high speed, series", 0.005, "58-62 HRC", 4),
    ("mill from QT steel (42CrMo4) -> nitride (no grinding)", "medium load, low distortion, complex grooves", 0.015, "600-700 HV", 3),
    ("chilled cast iron camshaft -> grind", "engine camshafts, large series", 0.01, "48-55 HRC (chill)", 1),
    ("mill from tool steel (1.2379) hardened -> wire EDM / grind", "small cams, tool-like cams, prototypes", 0.005, "58-62 HRC", 5),
    ("mill aluminium / plastic (POM, PA) -> no hardening", "light duty, low speed, noise-sensitive", 0.03, "-", 1),
    ("additive (L-PBF 1.2709 maraging) -> age -> grind", "integrated / hollow cams, prototypes", 0.01, "50-54 HRC", 6),
]

CAM_MATERIALS = {   # material: heat treatment, surface hardness HRC, allowable Hertz stress MPa (line contact, 1e8 cycles, check)
    "C45 induction hardened": ("induction, 1.5-3 mm", 55, 1100),
    "42CrMo4 induction hardened": ("induction, 2-4 mm", 56, 1250),
    "42CrMo4 nitrided": ("gas nitriding 0.3-0.5 mm", 60, 1150),
    "16MnCr5 case hardened": ("carburise CHD 0.8-1.2 mm", 60, 1650),
    "100Cr6 through hardened": ("through hardened 60-62 HRC", 61, 1650),
    "GJS-700 / chilled cast iron": ("chill / induction", 50, 900),
    "POM / PA6 (plastic)": ("-", 0, 40),
}

# ---------------------------------------------------------------- 7.2 NC data: chordal error, step, adaptive points
def chord_error(L, rho):
    """Sagitta of a chord L on a circle of radius rho: e = rho - sqrt(rho^2 - L^2/4) ~ L^2 / (8 rho)."""
    return rho - math.sqrt(rho ** 2 - L ** 2 / 4.0)

def profile_speed(p):
    """Arc length of the PROFILE per radian of cam angle: pitch speed x rho_cam / rho_pitch."""
    return p["speed_mm_rad"] * abs(p["rho_cam"] / p["rho_pitch"])

def nc_step_for_tol(P, tol_mm=0.001, pts=None):
    """Largest constant cam-angle step whose polyline chord error stays below tol everywhere on the profile."""
    pts = pts or sweep(P)
    worst = None
    for p in pts:
        rho = abs(p["rho_cam"])
        L = math.sqrt(8 * rho * tol_mm)           # chord length allowed by the tolerance
        dth = math.degrees(L / profile_speed(p))
        if worst is None or dth < worst[0]:
            worst = (dth, p["theta"], rho)
    return {"step_deg": worst[0], "theta": worst[1], "rho": worst[2], "points": int(math.ceil(360.0 / worst[0]))}

def adaptive_points(P, tol_mm=0.001, pts=None):
    """Number of points if each step is chosen from the local radius (curvature-adaptive NC data)."""
    pts = pts or sweep(P)
    st = math.radians(P["step_deg"])
    n = 0.0
    for p in pts:
        L = math.sqrt(8 * abs(p["rho_cam"]) * tol_mm)
        n += profile_speed(p) * st / L
    return int(math.ceil(n))

def profile_length(P, pts=None):
    pts = pts or sweep(P)
    L = 0.0
    for a, b in zip(pts, pts[1:] + pts[:1]):
        L += math.dist(a["profile"], b["profile"])
    return L

def milling_time(P, stock_mm=3.0, ae_rough=1.5, f_rough=600.0, f_finish=300.0, t_setup_min=0.0, pts=None):
    """Contour milling time: roughing passes = ceil(stock / ae) at f_rough, one finishing pass at f_finish (mm/min)."""
    L = profile_length(P, pts)
    nr = math.ceil(stock_mm / ae_rough)
    t = nr * L / f_rough + L / f_finish
    return {"L": L, "passes_rough": nr, "t_min": t + t_setup_min}

# ---------------------------------------------------------------- 7.4 X-C grinding
def wheel_centre_radius(P, rg, pts=None, step_deg=None):
    """X-C grinding: the wheel centre moves on a fixed line through the C axis (= a radial roller follower of radius rg).
    For every C angle the profile is turned and X = max over profile points (|x| <= rg) of y + sqrt(rg^2 - x^2)."""
    pts = pts or sweep(P)
    prof = [p["profile"] for p in pts]
    st = step_deg or P["step_deg"]
    out = []
    n = int(round(360.0 / st))
    for i in range(n):
        ph = math.radians(i * st)
        c, s = math.cos(ph), math.sin(ph)
        best = -1e9
        for (x0, y0) in prof:
            x = c * x0 - s * y0                      # profile turned by +C (same sense as the cam rotation in cam.py)
            if abs(x) <= rg:
                y = s * x0 + c * y0
                v = y + math.sqrt(rg * rg - x * x)
                if v > best:
                    best = v
        out.append((i * st, best))
    return out

def xc_axis_demand(P, rg, C_rpm=30.0, pts=None, step_deg=1.0):
    """X velocity / acceleration of the grinding slide at constant C speed (numerical derivatives of X(C))."""
    X = wheel_centre_radius(P, rg, pts, step_deg)
    n = len(X)
    w = 2 * math.pi * C_rpm / 60.0
    h = math.radians(step_deg)
    v = [(X[(i + 1) % n][1] - X[i - 1][1]) / (2 * h) * w for i in range(n)]          # mm/s
    a = [(X[(i + 1) % n][1] - 2 * X[i][1] + X[i - 1][1]) / h ** 2 * w ** 2 for i in range(n)]   # mm/s^2
    return {"X_min": min(x for _, x in X), "X_max": max(x for _, x in X), "v_max": max(abs(x) for x in v),
            "a_max": max(abs(x) for x in a) / 1000.0, "X": X}

def constant_surface_speed(P, v_w_m_min=20.0, pts=None):
    """Variable C speed for a constant work surface speed v_w: omega_C = v_w / (ds_profile / dC). Returns the C-speed range
    and the time for one revolution (one grinding pass)."""
    pts = pts or sweep(P)
    vw = v_w_m_min * 1000.0 / 60.0                       # mm/s
    st = math.radians(P["step_deg"])
    t = 0.0
    rpm = []
    for p in pts:
        sp = profile_speed(p)                            # mm/rad
        wC = vw / sp                                     # rad/s
        rpm.append(wC * 60 / (2 * math.pi))
        t += st / wC
    return {"C_rpm_min": min(rpm), "C_rpm_max": max(rpm), "t_rev_s": t}

def grinding_time(P, stock_mm=0.15, ae_rough=0.01, ae_finish=0.003, n_spark=2, v_w_m_min=15.0, pts=None):
    """Passes: roughing to leave 0.01 mm, finishing passes, spark-out revolutions; time per pass from constant surface speed."""
    cs = constant_surface_speed(P, v_w_m_min, pts)
    nr = math.ceil((stock_mm - 0.01) / ae_rough)
    nf = math.ceil(0.01 / ae_finish)
    n = nr + nf + n_spark
    return {"passes": n, "rough": nr, "finish": nf, "t_rev_s": cs["t_rev_s"], "t_min": n * cs["t_rev_s"] / 60.0}

def grinding_burn_check(ae_mm, v_w_m_min, Qw_limit=3.0):
    """Specific removal rate Q'w = ae v_w (mm^3 / (mm s)); corundum wheels on hardened steel ~ 1..3 safe, CBN higher (check)."""
    Qw = ae_mm * v_w_m_min * 1000.0 / 60.0
    return {"Qw": Qw, "burn_risk": Qw > Qw_limit}

# ---------------------------------------------------------------- 7.6 inspection
def lift_with_probe(P, r_probe, pts=None, step_deg=1.0):
    """Lift curve measured with a radial probe roller of radius r_probe (same as wheel_centre_radius, minus its minimum)."""
    X = wheel_centre_radius(P, r_probe, pts, step_deg)
    base = min(x for _, x in X)
    return [(th, x - base) for th, x in X]

def probe_vs_design(P, r_probe, pts=None):
    """Difference between the lift seen by a probe of another radius and the design lift (radial follower, e = 0)."""
    L = lift_with_probe(P, r_probe, pts, 1.0)
    diff = [abs(l - motion(P, th)[0]) for th, l in L]
    return max(diff)

# ---------------------------------------------------------------- 7.7 harmonic profile errors
def harmonic_error_effect(P, A_um, k, n_rpm=None):
    """Lift error A sin(k theta): extra acceleration A k^2 omega^2 and extra force m A k^2 omega^2."""
    n = n_rpm or P["n_rpm"]
    w = 2 * math.pi * n / 60.0
    da = A_um * 1e-6 * k ** 2 * w ** 2
    return {"k": k, "da": da, "dF": P["m"] * da, "f_Hz": k * n / 60.0}

def k_for_liftoff(P, A_um, n_rpm=None):
    """Harmonic order at which an error of amplitude A uses up the whole contact-force margin Fc_min."""
    Q = dict(P, n_rpm=n_rpm or P["n_rpm"])
    Fm = jump_check(Q)["Fc_min"]
    w = 2 * math.pi * Q["n_rpm"] / 60.0
    if Fm <= 0:
        return 0.0
    return math.sqrt(Fm / (P["m"] * A_um * 1e-6 * w ** 2))

def synthetic_lift_error(n=720, seed=7):
    """Synthetic measured lift error (um): eccentricity k1, grinding-machine C-axis k8, wheel / chatter k23, noise."""
    import random                      # local: the merge keeps only the code after the cam import
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        th = 2 * math.pi * i / n
        e = 4.0 * math.sin(th + 0.3) + 2.5 * math.sin(8 * th + 1.1) + 1.2 * math.sin(23 * th) + rnd.gauss(0.0, 0.3)
        out.append(e)
    return out

def dft_amplitudes(err, kmax=40):
    """Single-sided amplitude spectrum: A_k = 2/N |sum e_i exp(-j k theta_i)|."""
    n = len(err)
    res = []
    for k in range(1, kmax + 1):
        re = sum(e * math.cos(2 * math.pi * k * i / n) for i, e in enumerate(err))
        im = sum(e * math.sin(2 * math.pi * k * i / n) for i, e in enumerate(err))
        res.append((k, 2.0 / n * math.hypot(re, im)))
    return res

# ---------------------------------------------------------------- 7.8 timing and assembly
def timing_error(P, backlash_mm=0.02, r_mm=15.0, pts=None):
    """Angular play of a key / clamp at radius r: d_theta = backlash / r; lift error = max |s'| d_theta."""
    pts = pts or sweep(P)
    dth = backlash_mm / r_mm
    return {"dtheta_deg": math.degrees(dth), "ds_max_mm": max(abs(p["s1"]) for p in pts) * dth}

def roller_misalignment(b_mm, tilt_deg, Fn, E=210000.0, nu=0.3):
    """Tilted roller: edge gap g = b tan(tilt); if g exceeds the elastic approach the load runs on part of the width only.
    Elastic approach ~ 2 F (1 - nu^2) / (pi E b) * (ln(...)); here a simple estimate: effective width b_eff = b
    if g < 2 um else proportional (check - use the roller maker's crowning data)."""
    g = b_mm * math.tan(math.radians(tilt_deg)) * 1000.0   # um
    b_eff = b_mm if g <= 2.0 else max(b_mm * 2.0 / g, 0.2 * b_mm)
    return {"gap_um": g, "b_eff": b_eff, "stress_factor": math.sqrt(b_mm / b_eff)}

DEFECTS_CAM = [
    ("noise / knocking at one angle", "lift-off (jump) or backlash reversal", "check Fc_min, raise preload, smoother law"),
    ("pitting near the nose / on the flank of max force", "Hertz stress too high, poor hardness", "larger base circle / roller, harder material, wider roller"),
    ("scuffing / smearing", "roller skidding (does not roll), poor lubrication", "lower roller inertia, minimum load, better oil"),
    ("flat spots on the roller", "skidding at high acceleration changes", "check roller drag torque, preload"),
    ("wavy wear pattern", "profile harmonics, grinding chatter", "DFT of lift error, dress wheel, balance"),
    ("worn edge of the track", "roller tilt / not crowned", "align, use crowned track roller"),
    ("wrong timing of the machine", "key play, wrong phasing, slipped clamp", "taper / shrink disc, check timing with encoder"),
    ("cracks after grinding", "grinding burn / re-hardening", "nital etch, lower Q'w, sharper wheel"),
]

# ---------------------------------------------------------------- chapter 8: worked example (pusher at 400 rpm)
EXAMPLE_CAM = {
    "name": "Packaging pusher redesigned for 400 rpm: modified-sine rise 130 deg, modified-sine return 150 deg (example)",
    "segments": [
        {"kind": "rise", "law": "modsine", "beta": 130.0},
        {"kind": "dwell", "beta": 40.0},
        {"kind": "return", "law": "modsine", "beta": 150.0},
        {"kind": "dwell", "beta": 40.0},
    ],
    "n_rpm": 400.0,
    "k_spring": 4.0, "F0_spring": 70.0,
    "R0": 35.0,
}

def worked_example():
    P = dict(DEFAULT, **EXAMPLE_CAM)
    rows = []
    for tag, Q in (("default at 300 rpm", dict(DEFAULT)), ("default at 400 rpm", dict(DEFAULT, n_rpm=400.0)),
                   ("step 1: return modsine 150 deg", dict(DEFAULT, n_rpm=400.0, segments=EXAMPLE_CAM["segments"])),
                   ("step 2: + spring 4 N/mm, 70 N", dict(DEFAULT, n_rpm=400.0, segments=EXAMPLE_CAM["segments"], k_spring=4.0, F0_spring=70.0)),
                   ("step 3: + R0 35 (final)", P)):
        pts = sweep(Q)
        g, dy = geometry_summary(Q, pts), dynamics(Q, pts)
        jc, ct = jump_check(Q, dy), contact(Q, pts, dy)
        rows.append((tag, max(abs(g["phi_max"]), abs(g["phi_min"])), g["rho_cam_min_convex"], jc["Fc_min"],
                     max(d["Fn"] for d in dy), ct["p_max"], max(d["T"] for d in dy)))
    return P, rows

# ---------------------------------------------------------------- demo
def demo_ch78():
    P = dict(DEFAULT)
    pts = sweep(P)
    print("## 7.1 Process chains for cams (check)")
    for r, use, tol, hard, cost in PROCESS_CHAINS_CAM:
        print("  %-72s tol %.3f mm, %-17s cost %d  | %s" % (r, tol, hard, cost, use))
    print("\n## 7.1 Materials (allowable Hertz stress, check)")
    for m, (ht, hrc, pa) in CAM_MATERIALS.items():
        print("  %-28s %-28s %2d HRC  p_allow %4d MPa" % (m, ht, hrc, pa))
    ct = contact(P, pts)
    print("  default p_max %.0f MPa -> lowest material with S >= 1.5: %s" % (
        ct["p_max"], min((pa, m) for m, (_, _, pa) in CAM_MATERIALS.items() if pa >= 1.5 * ct["p_max"])[1]))

    print("\n## 7.2 NC data: chord error and step")
    for L in (0.5, 1.0, 2.0):
        print("  chord %.1f mm on rho 37.77 mm: exact %.4f um, L^2/(8 rho) %.4f um" % (L, 1000 * chord_error(L, 37.77), 1000 * L * L / (8 * 37.77)))
    for tol in (0.001, 0.0005, 0.0001):
        s = nc_step_for_tol(P, tol, pts)
        print("  tol %.4f mm: constant step %.3f deg (%d points, decided at %.1f deg, rho %.2f) / adaptive %d points" % (
            tol, s["step_deg"], s["points"], s["theta"], s["rho"], adaptive_points(P, tol, pts)))
    mt = milling_time(P, pts=pts)
    print("  profile length %.2f mm; milling: %d roughing passes + 1 finish -> %.2f min" % (mt["L"], mt["passes_rough"], mt["t_min"]))
    for rc in (6.0, 10.0, 20.0):
        tp = tool_path(P, rc, pts)
        print("  cutter r %4.1f: gouge %s (smallest concave radius %s)" % (rc, tp["gouge"], tp["rho_concave_min"]))

    print("\n## 7.4 X-C grinding (wheel centre on a fixed line through the C axis)")
    Xr = wheel_centre_radius(P, P["rr"], pts, 1.0)
    dev = max(abs(x - (P["R0"] + P["rr"] + motion(P, th)[0])) for th, x in Xr)
    print("  check: wheel radius = roller radius -> X = R0 + rr + s, max deviation %.5f mm" % dev)
    for rg in (50.0, 150.0, 250.0):
        d = xc_axis_demand(P, rg, 30.0, pts, 1.0)
        print("  wheel r %5.1f: X %.3f .. %.3f mm, at C 30 rpm: v_X max %.1f mm/s, a_X max %.2f m/s^2" % (rg, d["X_min"], d["X_max"], d["v_max"], d["a_max"]))
    for C in (10.0, 30.0, 60.0):
        d = xc_axis_demand(P, 150.0, C, pts, 1.0)
        print("  wheel r 150, C %4.0f rpm: v_X max %6.1f mm/s, a_X max %.3f m/s^2" % (C, d["v_max"], d["a_max"]))
    cs = constant_surface_speed(P, 15.0, pts)
    print("  constant surface speed 15 m/min: C %.1f .. %.1f rpm, %.2f s per revolution" % (cs["C_rpm_min"], cs["C_rpm_max"], cs["t_rev_s"]))
    gt = grinding_time(P, pts=pts)
    print("  grinding stock 0.15 mm: %d rough + %d finish + 2 spark-out = %d passes -> %.2f min" % (gt["rough"], gt["finish"], gt["passes"], gt["t_min"]))
    for ae, vw in ((0.003, 15.0), (0.01, 15.0), (0.02, 20.0)):
        b = grinding_burn_check(ae, vw)
        print("  ae %.3f mm, v_w %.0f m/min: Q'w %.2f mm3/(mm s) %s" % (ae, vw, b["Qw"], "BURN RISK" if b["burn_risk"] else "ok"))

    print("\n## 7.6 Inspection: lift seen by a probe of another radius")
    for rp in (5.0, 10.0, 15.0):
        print("  probe r %4.1f mm: max difference to the design lift %.4f mm" % (rp, probe_vs_design(P, rp, pts)))

    print("\n## 7.7 Harmonic profile errors (A = 5 um, default %0.f rpm, a_max design %.1f m/s^2, Fc_min %.1f N)" % (
        P["n_rpm"], characteristic_values("cycloidal")["Ca"] * P["h"] * (2 * math.pi * P["n_rpm"] / 60) ** 2 / math.radians(120) ** 2 / 1000,
        jump_check(P)["Fc_min"]))
    for k in (1, 5, 10, 20, 30, 50):
        r = harmonic_error_effect(P, 5.0, k)
        print("  k %2d: f %6.1f Hz, extra acceleration %6.2f m/s^2, extra force %6.2f N" % (k, r["f_Hz"], r["da"], r["dF"]))
    for n in (300.0, 400.0):
        kk = k_for_liftoff(P, 5.0, n)
        if kk > 0:
            print("  %0.f rpm: a 5 um error at k >= %.1f uses up the whole contact margin" % (n, kk))
        else:
            print("  %0.f rpm: the default already lifts off without any profile error" % n)
    err = synthetic_lift_error()
    amp = dft_amplitudes(err, 30)
    big = sorted(amp, key=lambda t: -t[1])[:4]
    print("  synthetic measured error: peak-peak %.2f um; largest DFT amplitudes: %s" % (
        max(err) - min(err), ", ".join("k%d %.2f um" % (k, a) for k, a in big)))
    for k, a in big[:3]:
        r = harmonic_error_effect(P, a, k)
        print("    k %2d (%.2f um): extra force %.2f N" % (k, a, r["dF"]))

    print("\n## 7.8 Timing and assembly")
    for bl, r in ((0.02, 15.0), (0.05, 15.0), (0.0, 15.0)):
        t = timing_error(P, bl, r, pts)
        print("  key play %.3f mm at r %.0f: timing error %.3f deg, lift error up to %.3f mm" % (bl, r, t["dtheta_deg"], t["ds_max_mm"]))
    for tilt in (0.005, 0.02, 0.05):
        m = roller_misalignment(P["b_roller"], tilt, 200.0)
        print("  roller tilt %.3f deg: edge gap %.1f um, effective width %.1f mm, stress x %.2f" % (tilt, m["gap_um"], m["b_eff"], m["stress_factor"]))
    print("  defects:")
    for d in DEFECTS_CAM:
        print("   - %s | cause: %s | remedy: %s" % d)

    print("\n## 8.2 Worked example: pusher at 400 rpm")
    Pex, rows = worked_example()
    print("  %-32s %8s %9s %9s %8s %8s %8s" % ("variant", "phi_max", "rho_cam", "Fc_min", "Fn_max", "p_max", "T_max"))
    for r in rows:
        print("  %-32s %7.2f° %8.2f %8.1f N %6.0f N %5.0f MPa %5.2f Nm" % r)
    for tag, Q in (("step 1", dict(DEFAULT, n_rpm=400.0, segments=EXAMPLE_CAM["segments"])), ("final", Pex)):
        dy = dynamics(Q)
        print("  %-7s preload needed for contact %.1f N (actual %.0f N); 5 um error uses the margin at k >= %.1f" % (
            tag, jump_check(Q, dy)["F0_min_no_jump"], Q["F0_spring"], k_for_liftoff(Q, 5.0)))
    print("  smallest base circle for the final programme: R0 = %.2f mm (search starts at 10 mm)" % size_base_circle(Pex))
    st = nc_step_for_tol(Pex, 0.001)
    print("  NC step for 1 um: %.3f deg (%d points); grinding %.2f min" % (st["step_deg"], st["points"], grinding_time(Pex)["t_min"]))

def cmd_examples():
    P = dict(DEFAULT)
    print(report_text(P))
    print("\n## Characteristic values of the motion laws (VDI 2143 style)")
    for law in LAWS:
        c = characteristic_values(law)
        print("  %-9s C_v %.3f  C_a %.3f  C_j %8.1f" % (law, c["Cv"], c["Ca"], c["Cj"]))
    print("\n## Same programme, rise law changed")
    for law in LAWS:
        Q = dict(P, segments=[dict(P["segments"][0], law=law)] + P["segments"][1:])
        g, jc, ct = geometry_summary(Q), jump_check(Q), contact(Q)
        print("  %-9s phi_max %5.2f deg, Fc_min %6.1f N, p_max %5.0f MPa" % (law, g["phi_max"], jc["Fc_min"], ct["p_max"]))
    print("\n## Speed: contact force and lift-off")
    for n in (200, 300, 400, 500, 600):
        jc = jump_check(dict(P, n_rpm=n))
        print("  %4d rpm: Fc_min %7.1f N %s, preload needed %.0f N" % (n, jc["Fc_min"], "LIFT-OFF" if jc["lift_off"] else "", jc["F0_min_no_jump"]))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-66s %s %s" % (name, "OK  " if cond else "FAIL", info))
    P = dict(DEFAULT)
    ref = {"cycloidal": (2.0, 2 * math.pi), "harmonic": (math.pi / 2, math.pi ** 2 / 2), "poly345": (1.875, 5.7735),
           "poly4567": (2.1875, 7.5132), "modsine": (1.7596, 5.5280), "modtrap": (2.0, 4.8881)}
    for law, (cv, ca) in ref.items():
        c = characteristic_values(law)
        chk("%-9s C_v %.4f, C_a %.4f (published)" % (law, cv, ca), abs(c["Cv"] - cv) < 2e-3 and abs(c["Ca"] - ca) < 3e-3,
            "%.4f / %.4f" % (c["Cv"], c["Ca"]))
    x = 0.3
    y, v, a, _ = law_values("cycloidal", x)
    chk("cycloidal closed form y = x - sin(2 pi x)/(2 pi)", abs(y - (x - math.sin(2 * math.pi * x) / (2 * math.pi))) < 1e-6)
    chk("poly345 closed form y = 10x^3 - 15x^4 + 6x^5", abs(law_values("poly345", x)[0] - (10 * x ** 3 - 15 * x ** 4 + 6 * x ** 5)) < 1e-6)
    pts = sweep(P)
    i = 100
    p = pts[i]
    d = math.hypot(p["pitch"][0] - p["profile"][0], p["pitch"][1] - p["profile"][1])
    chk("profile point lies one roller radius from the pitch point", abs(d - P["rr"]) < 1e-9)
    # numerical derivative of the pitch curve: radius of curvature by three points
    h = 0.05
    A, B, C = (pitch_point(P, p["theta"] + k * h)["pitch"] for k in (-1, 0, 1))
    ab, bc, ca = math.dist(A, B), math.dist(B, C), math.dist(C, A)
    area2 = abs((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]))
    rho3 = ab * bc * ca / (2 * area2)
    chk("radius of curvature = circle through 3 near pitch points", abs(rho3 / abs(p["rho_pitch"]) - 1) < 1e-3, "%.3f / %.3f" % (rho3, p["rho_pitch"]))
    s_a, _, _, _ = motion(P, 50.0)
    s_b, _, _, _ = motion(P, 50.0 + 1e-3)
    chk("s' = ds/dtheta (numerical)", abs((s_b - s_a) / math.radians(1e-3) - motion(P, 50.0)[1]) < 1e-2)
    th_r = 50.0
    pp = pitch_point(P, th_r)
    rp = math.hypot(*pp["pitch"])
    chk("e = 0: pitch radius = R0 + rr + s", abs(rp - (P["R0"] + P["rr"] + pp["s"])) < 1e-9)
    chk("e = 0: tan(phi) = s'/(Rp + s)", abs(math.tan(math.radians(pp["phi_deg"])) - pp["s1"] / (P["R0"] + P["rr"] + pp["s"])) < 1e-12)
    dyn = dynamics(P, pts)
    w = 2 * math.pi * P["n_rpm"] / 60.0
    work = sum(dd["T"] for dd in dyn) * math.radians(P["step_deg"])
    chk("energy: camshaft work per revolution = external work (spring and inertia return)", abs(work - P["F_ext_rise"] * P["h"] / 1000) < 0.02,
        "%.4f J vs %.4f J" % (work, P["F_ext_rise"] * P["h"] / 1000))
    chk("Hertz: equal cylinders r, F/b = 100 N/mm -> p = sqrt(100 x 2/r x E / (2 pi (1-nu^2)))",
        abs(hertz_line(1000, 10, 10, 10) - math.sqrt(100 * 0.2 * 210000 / (2 * math.pi * 0.91))) < 1e-9)
    R0 = size_base_circle(P)
    g = geometry_summary(dict(P, R0=R0, step_deg=1.0))
    chk("sized base circle meets phi_allow", max(abs(g["phi_max"]), abs(g["phi_min"])) <= P["phi_allow"] + 1e-6, "R0 %.2f" % R0)
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
        out = "cam_out"
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
