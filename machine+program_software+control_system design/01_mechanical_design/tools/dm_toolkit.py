#!/usr/bin/env python3
"""Design-method toolkit (item 1 of 'machine+program_software+control_system design').

Python standard library only - runs on an offline factory PC.
Every worked example of guide 01_design_method.md is produced by this file.

Usage:
  python dm_toolkit.py examples          # print all worked examples of the guide
  python dm_toolkit.py selftest          # check the examples against the guide numbers
  python dm_toolkit.py selftest_all      # self-tests of all modules of the folder (M1 + crank + fourbar)
  python dm_toolkit.py gci f1 f2 f3 [r]  # mesh convergence (fine, medium, coarse result)
  python dm_toolkit.py rel muS sS muL sL # stress-strength reliability
  python dm_toolkit.py goodman Rm Re d sa sm [surface] [rel%]
  python dm_toolkit.py stack t1 t2 ...   # tolerance stack: worst case + RSS (+/- values)
  python dm_toolkit.py shaftopt T M L [Re n G phi_deg_per_m tmin domax]
All values are EXAMPLE values unless you enter your own.
"""
import math
import sys
from statistics import NormalDist

# ---------------------------------------------------------------- 1 decision
def decision_matrix(weights, scores):
    """Weighted sum. weights: {criterion: w}, scores: {concept: {criterion: s 1..5}}.
    Returns {concept: (total, total / max_possible)}."""
    wsum = sum(weights.values())
    out = {}
    for c, sc in scores.items():
        tot = sum(weights[k] * sc[k] for k in weights) / wsum
        out[c] = (tot, tot / 5.0)
    return out

# ---------------------------------------------------------------- 2 GCI
def gci(f1, f2, f3, r=2.0, fs=1.25):
    """Roache Grid Convergence Index. f1 fine, f2 medium, f3 coarse; constant ratio r.
    Returns dict with observed order p, extrapolated value, GCI fine (%), asymptotic check."""
    e21 = f2 - f1
    e32 = f3 - f2
    if e21 == 0 or e32 / e21 <= 0:
        raise ValueError("oscillating or no convergence - refine further")
    p = math.log(e32 / e21) / math.log(r)
    f_ext = f1 + (f1 - f2) / (r ** p - 1)
    gci21 = fs * abs((f1 - f2) / f1) / (r ** p - 1)
    gci32 = fs * abs((f2 - f3) / f2) / (r ** p - 1)
    asym = gci32 / (r ** p * gci21)          # ~1.0 = asymptotic range
    return {"p": p, "f_ext": f_ext, "gci_fine_pct": 100 * gci21,
            "gci_med_pct": 100 * gci32, "asymptotic_ratio": asym}

# ---------------------------------------------------------------- 3 reliability
def interference(mu_s, sd_s, mu_l, sd_l):
    """Normal strength S and load-stress L. Returns z, reliability R, failures per million, central SF."""
    z = (mu_s - mu_l) / math.hypot(sd_s, sd_l)
    R = NormalDist().cdf(z)
    return {"z": z, "R": R, "ppm": (1 - R) * 1e6, "sf_central": mu_s / mu_l}

# ---------------------------------------------------------------- 4 fatigue
_KA = {"ground": (1.58, -0.085), "machined": (4.51, -0.265),
       "hot_rolled": (57.7, -0.718), "forged": (272.0, -0.995)}
_KE = {50: 1.000, 90: 0.897, 95: 0.868, 99: 0.814, 99.9: 0.753, 99.99: 0.702}

def marin_goodman(Rm, Re, d, sa, sm, surface="machined", rel=99, kc=1.0, kd=1.0, kf=1.0):
    """Shigley-type endurance limit + modified Goodman + Langer yield check (steel, rotating bending).
    Rm, Re, sa, sm in MPa, d in mm. kf = fatigue notch factor applied to sa and sm."""
    se_p = 0.5 * Rm if Rm <= 1400 else 700.0
    a, b = _KA[surface]
    ka = a * Rm ** b
    if 2.79 <= d <= 51:
        kb = 1.24 * d ** -0.107
    elif d <= 254:
        kb = 1.51 * d ** -0.157
    else:
        raise ValueError("d out of range")
    ke = _KE[rel]
    se = ka * kb * kc * kd * ke * se_p
    sa_e, sm_e = kf * sa, kf * sm
    n_f = 1.0 / (sa_e / se + sm_e / Rm)
    n_y = Re / (sa_e + sm_e)
    return {"Se_prime": se_p, "ka": ka, "kb": kb, "ke": ke, "Se": se,
            "n_fatigue": n_f, "n_yield": n_y}

# ---------------------------------------------------------------- 5 tolerance stack
def stack(tols):
    """Symmetric tolerances (+/- t). Worst case, RSS, and RSS with 1.5 shift (Bender)."""
    wc = sum(abs(t) for t in tols)
    rss = math.sqrt(sum(t * t for t in tols))
    return {"worst_case": wc, "rss": rss, "rss_bender": 1.5 * rss}

# ---------------------------------------------------------------- 6 DOE 2^k
def doe_effects(levels, y):
    """Full factorial 2^k. levels: list of tuples of -1/+1, y: responses.
    Returns main effects and 2-factor interactions (effect = mean(+) - mean(-))."""
    k = len(levels[0])
    n = len(y)
    eff = {}
    for i in range(k):
        eff["F%d" % (i + 1)] = 2 * sum(l[i] * yy for l, yy in zip(levels, y)) / n
    for i in range(k):
        for j in range(i + 1, k):
            eff["F%dxF%d" % (i + 1, j + 1)] = 2 * sum(l[i] * l[j] * yy for l, yy in zip(levels, y)) / n
    eff["mean"] = sum(y) / n
    return eff

# ---------------------------------------------------------------- 7 Ashby
def ashby_beam(materials):
    """Light, stiff beam (fixed shape, free size): index M = E^0.5 / rho. E GPa, rho kg/m3.
    Returns {name: (M, mass ratio vs best)}."""
    m = {k: (math.sqrt(E * 1e9) / rho) for k, (E, rho) in materials.items()}
    best = max(m.values())
    return {k: (v, best / v) for k, v in m.items()}

# ---------------------------------------------------------------- 8 optimisation
def shaft_stress(do, di, T, M):
    """von Mises stress (MPa) of a hollow shaft, T and M in N*m, diameters in mm."""
    I4 = do ** 4 - di ** 4
    sb = 32 * M * 1e3 * do / (math.pi * I4)
    tau = 16 * T * 1e3 * do / (math.pi * I4)
    return math.sqrt(sb ** 2 + 3 * tau ** 2)

def shaft_twist_deg_per_m(do, di, T, G=80000.0):
    J = math.pi * (do ** 4 - di ** 4) / 32.0       # mm^4
    return math.degrees(T * 1e3 * 1000.0 / (G * J))  # rad per m -> deg per m

def shaft_opt(T, M, Re=355.0, n=2.0, G=80000.0, phi_max=0.25, tmin=3.0, domax=60.0, step=0.05):
    """Minimum-area (= minimum mass) hollow shaft. Exhaustive search on a 0.05 mm grid
    (robust, no local minima; same answer as fmincon). Constraints:
    g1 von Mises <= Re/n, g2 twist <= phi_max deg/m, g3 wall >= tmin, do <= domax."""
    allow = Re / n
    best = None
    do = 10.0
    while do <= domax + 1e-9:
        # for a given do the area falls when di rises -> largest feasible di
        lo, hi = 0.0, do - 2 * tmin
        if hi < 0:
            do += step
            continue
        def ok(di):
            return shaft_stress(do, di, T, M) <= allow and shaft_twist_deg_per_m(do, di, T, G) <= phi_max
        if ok(lo):
            if ok(hi):
                di = hi
            else:
                for _ in range(60):                  # bisection on di
                    mid = 0.5 * (lo + hi)
                    lo, hi = (mid, hi) if ok(mid) else (lo, mid)
                di = lo
            area = math.pi / 4 * (do ** 2 - di ** 2)
            if best is None or area < best[2]:
                best = (do, di, area)
        do += step
    do, di, area = best
    # solid reference: smallest solid shaft meeting the same constraints
    ds = 10.0
    while not (shaft_stress(ds, 0, T, M) <= allow and shaft_twist_deg_per_m(ds, 0, T, G) <= phi_max):
        ds += 0.01
    return {"do": do, "di": di, "area_mm2": area, "stress": shaft_stress(do, di, T, M),
            "twist": shaft_twist_deg_per_m(do, di, T, G), "allow": allow,
            "d_solid": ds, "area_solid_mm2": math.pi / 4 * ds ** 2,
            "mass_saving_pct": 100 * (1 - area / (math.pi / 4 * ds ** 2))}

def nelder_mead(f, x0, step=1.0, tol=1e-8, itmax=4000):
    """Plain Nelder-Mead (same idea as MATLAB fminsearch). For penalty-formulated problems."""
    n = len(x0)
    pts = [list(x0)] + [[x0[j] + (step if j == i else 0) for j in range(n)] for i in range(n)]
    vals = [f(p) for p in pts]
    for _ in range(itmax):
        order = sorted(range(n + 1), key=lambda i: vals[i])
        pts = [pts[i] for i in order]
        vals = [vals[i] for i in order]
        if abs(vals[-1] - vals[0]) < tol:
            break
        c = [sum(p[j] for p in pts[:-1]) / n for j in range(n)]
        xr = [c[j] + (c[j] - pts[-1][j]) for j in range(n)]
        fr = f(xr)
        if fr < vals[0]:
            xe = [c[j] + 2 * (c[j] - pts[-1][j]) for j in range(n)]
            fe = f(xe)
            pts[-1], vals[-1] = (xe, fe) if fe < fr else (xr, fr)
        elif fr < vals[-2]:
            pts[-1], vals[-1] = xr, fr
        else:
            xc = [c[j] + 0.5 * (pts[-1][j] - c[j]) for j in range(n)]
            fc = f(xc)
            if fc < vals[-1]:
                pts[-1], vals[-1] = xc, fc
            else:
                for i in range(1, n + 1):
                    pts[i] = [pts[0][j] + 0.5 * (pts[i][j] - pts[0][j]) for j in range(n)]
                    vals[i] = f(pts[i])
    return pts[0], vals[0]

# ---------------------------------------------------------------- examples
def _examples():
    ex = {}
    ex["E1"] = decision_matrix(
        {"cost": 0.30, "efficiency": 0.20, "noise": 0.15, "maintenance": 0.20, "size": 0.15},
        {"V-belt": {"cost": 5, "efficiency": 3, "noise": 4, "maintenance": 3, "size": 3},
         "direct coupling": {"cost": 4, "efficiency": 5, "noise": 3, "maintenance": 4, "size": 4},
         "gearbox": {"cost": 2, "efficiency": 4, "noise": 2, "maintenance": 3, "size": 4}})
    ex["E2"] = gci(212.0, 206.5, 190.0)
    ex["E3"] = interference(350, 25, 220, 30)
    ex["E4"] = marin_goodman(650, 430, 30, 80, 60, "machined", 99)
    ex["E5"] = stack([0.05, 0.10, 0.02, 0.03])
    ex["E6"] = doe_effects([(-1, -1, -1), (1, -1, -1), (-1, 1, -1), (1, 1, -1),
                            (-1, -1, 1), (1, -1, 1), (-1, 1, 1), (1, 1, 1)],
                           [182, 151, 168, 139, 176, 147, 160, 133])
    ex["E7"] = ashby_beam({"steel S355": (210, 7850), "Al 6082-T6": (70, 2700),
                           "grey iron EN-GJL-250": (110, 7200), "CFRP (quasi-iso)": (60, 1600)})
    ex["E8"] = shaft_opt(T=200, M=150, phi_max=1.0, domax=50.0)
    # E9: same shaft with Nelder-Mead + penalty (shows the MATLAB fminsearch-style way)
    T, M, allow = 200, 150, 177.5
    def pen(x):
        do, di = x
        if di < 0 or do - di < 2 * 3.0 or do > 50.0:
            return 1e9
        a = math.pi / 4 * (do ** 2 - di ** 2)
        g1 = max(0.0, shaft_stress(do, di, T, M) / allow - 1)
        g2 = max(0.0, shaft_twist_deg_per_m(do, di, T) / 1.0 - 1)
        return a * (1 + 1e4 * (g1 ** 2 + g2 ** 2))
    x, fval = nelder_mead(pen, [45.0, 30.0], step=2.0)
    ex["E9"] = {"do": x[0], "di": x[1], "area_mm2": math.pi / 4 * (x[0] ** 2 - x[1] ** 2)}
    return ex

def cmd_examples():
    ex = _examples()
    print("E1 weighted decision matrix (total 1..5, share of max):")
    for k, (t, s) in sorted(ex["E1"].items(), key=lambda kv: -kv[1][0]):
        print("   %-16s %.2f  (%.0f %%)" % (k, t, 100 * s))
    g = ex["E2"]
    print("E2 GCI: p = %.2f, extrapolated = %.1f MPa, GCI fine = %.2f %%, GCI medium = %.2f %%, asymptotic ratio = %.3f"
          % (g["p"], g["f_ext"], g["gci_fine_pct"], g["gci_med_pct"], g["asymptotic_ratio"]))
    r = ex["E3"]
    print("E3 interference: z = %.2f, R = %.5f, %.0f failures per million, central SF = %.2f"
          % (r["z"], r["R"], r["ppm"], r["sf_central"]))
    m = ex["E4"]
    print("E4 Marin/Goodman: Se' = %.0f, ka = %.3f, kb = %.3f, ke = %.3f, Se = %.1f MPa, n_f = %.2f, n_y = %.2f"
          % (m["Se_prime"], m["ka"], m["kb"], m["ke"], m["Se"], m["n_fatigue"], m["n_yield"]))
    s = ex["E5"]
    print("E5 stack: worst case +/-%.3f, RSS +/-%.4f, RSS*1.5 +/-%.4f" % (s["worst_case"], s["rss"], s["rss_bender"]))
    print("E6 DOE effects (MPa):", ", ".join("%s %.2f" % (k, v) for k, v in ex["E6"].items()))
    print("E7 Ashby index E^0.5/rho (mass ratio vs best):")
    for k, (v, mr) in ex["E7"].items():
        print("   %-22s M = %.2f   mass x%.2f" % (k, v, mr))
    o = ex["E8"]
    print("E8 shaft optimum: do = %.2f, di = %.2f mm, A = %.1f mm2, stress %.1f / %.1f MPa, twist %.3f deg/m;"
          " solid d = %.2f mm, A = %.1f mm2, saving %.1f %%"
          % (o["do"], o["di"], o["area_mm2"], o["stress"], o["allow"], o["twist"], o["d_solid"],
             o["area_solid_mm2"], o["mass_saving_pct"]))
    e9 = ex["E9"]
    print("E9 Nelder-Mead penalty: do = %.2f, di = %.2f, A = %.1f mm2" % (e9["do"], e9["di"], e9["area_mm2"]))

def cmd_selftest():
    ex = _examples()
    chk = []
    def near(name, a, b, tol):
        ok = abs(a - b) <= tol
        chk.append(ok)
        print("%-34s %10.4f  expect %10.4f  %s" % (name, a, b, "OK" if ok else "FAIL"))
    near("E1 direct coupling total", ex["E1"]["direct coupling"][0], 4.05, 0.005)
    near("E1 V-belt total", ex["E1"]["V-belt"][0], 3.75, 0.005)
    near("E2 order p", ex["E2"]["p"], 1.585, 0.002)
    near("E2 extrapolated", ex["E2"]["f_ext"], 214.75, 0.01)
    near("E2 GCI fine %", ex["E2"]["gci_fine_pct"], 1.62, 0.01)
    near("E3 z", ex["E3"]["z"], 3.329, 0.002)
    near("E3 ppm", ex["E3"]["ppm"], 436, 2)
    near("E4 Se", ex["E4"]["Se"], 184.8, 0.2)
    near("E4 n_fatigue", ex["E4"]["n_fatigue"], 1.90, 0.01)
    near("E5 RSS", ex["E5"]["rss"], 0.1175, 0.0002)
    near("E6 effect F1", ex["E6"]["F1"], -29.0, 0.01)
    near("E8 area", ex["E8"]["area_mm2"], ex["E9"]["area_mm2"], 0.01 * ex["E8"]["area_mm2"])
    near("E8 saving %", ex["E8"]["mass_saving_pct"], 61.0, 0.5)
    print("SELFTEST", "PASS" if all(chk) else "FAIL")
    return 0 if all(chk) else 1

def main(argv):
    if len(argv) < 2 or argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0
    c, a = argv[1], [float(v) if v.replace('.', '', 1).replace('-', '', 1).isdigit() else v for v in argv[2:]]
    if c == "examples":
        cmd_examples()
    elif c == "selftest":
        return cmd_selftest()
    elif c == "selftest_all":
        import os, subprocess
        here = os.path.dirname(os.path.abspath(__file__))
        bad = 0
        for m in ("dm_toolkit", "dm_req", "dm_embody", "dm_strength", "dm_opt", "crank", "fourbar", "shaft"):
            r = subprocess.run([sys.executable, "-I", os.path.join(here, m + ".py"), "selftest"],
                               capture_output=True, text=True)
            last = (r.stdout.strip().splitlines() or ["no output"])[-1]
            print("%-12s %s" % (m, last))
            bad += r.returncode != 0 or "PASS" not in last
        print("ALL", "PASS" if bad == 0 else "FAIL")
        return 1 if bad else 0
    elif c == "gci":
        print(gci(*a))
    elif c == "rel":
        print(interference(*a))
    elif c == "goodman":
        Rm, Re, d, sa, sm = a[:5]
        surf = a[5] if len(a) > 5 else "machined"
        rel = int(a[6]) if len(a) > 6 else 99
        print(marin_goodman(Rm, Re, d, sa, sm, surf, rel))
    elif c == "stack":
        print(stack(a))
    elif c == "shaftopt":
        print(shaft_opt(*a))
    else:
        print("unknown command - see --help")
        return 2
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
