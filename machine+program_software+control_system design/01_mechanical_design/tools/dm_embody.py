#!/usr/bin/env python3
"""Embodiment, materials, manufacturing cost and tolerancing toolkit (guide M1, Part B ch. 21-24).

Python standard library only (offline). All numbers are EXAMPLE values.
  python dm_embody.py examples
  python dm_embody.py selftest
"""
import math
import random
import sys
from statistics import NormalDist

N01 = NormalDist()

# ------------------------------------------------------------------ ch.21 embodiment
def tapered_beam(F, b, sigma, L):
    """Cantilever of equal strength (rectangular, width b constant): h(x) = sqrt(6 F x / (b sigma)).
    Returns h at root and volume saving vs constant section h(L)."""
    h_root = math.sqrt(6 * F * L / (b * sigma))
    # integral of sqrt(x) from 0..L = 2/3 L^1.5 -> mean height = 2/3 h_root
    return {"h_root": h_root, "mean_h": 2 / 3 * h_root, "saving_pct": 100 / 3}

def springs_series(ks):
    return 1.0 / sum(1.0 / k for k in ks)

def springs_parallel(ks):
    return sum(ks)

def stiffness_budget(F, delta_allow, shares):
    """Split allowed deflection by shares -> required stiffness of each element (N/um)."""
    k_tot = F / delta_allow
    ks = [F / (delta_allow * s) for s in shares]
    return {"k_total": k_tot, "k_parts": ks, "check_series": springs_series(ks)}

def bolt_load_factor(E, As, Lk, kp_ratio):
    """Simple bolt stiffness k_b = E*A/L (N/mm) and load factor phi = k_b/(k_b+k_p)."""
    kb = E * As / Lk
    kp = kp_ratio * kb
    return {"k_b": kb, "k_p": kp, "phi": kb / (kb + kp)}

def thermal_growth(alpha, L, dT):
    return alpha * L * dT

def natural_freq(k, m):
    return math.sqrt(k / m) / (2 * math.pi)

def mount_stiffness(m, fn, n_mounts):
    k = m * (2 * math.pi * fn) ** 2
    return {"k_total_N_per_m": k, "k_each_N_per_mm": k / n_mounts / 1000}

def transmissibility(f_exc, fn, zeta=0.0):
    r = f_exc / fn
    return math.sqrt((1 + (2 * zeta * r) ** 2) / ((1 - r * r) ** 2 + (2 * zeta * r) ** 2))

def renard(series):
    """Theoretical Renard values 10^(i/series) for one decade."""
    return [10 ** (i / series) for i in range(series)]

R10_ROUND = [1.00, 1.25, 1.60, 2.00, 2.50, 3.15, 4.00, 5.00, 6.30, 8.00]
R20_ROUND = [1.00, 1.12, 1.25, 1.40, 1.60, 1.80, 2.00, 2.24, 2.50, 2.80,
             3.15, 3.55, 4.00, 4.50, 5.00, 5.60, 6.30, 7.10, 8.00, 9.00]

# ------------------------------------------------------------------ ch.22 materials
# typical values - check certificate / EN standard. E GPa, rho kg/m3, Re/Rp MPa, Rm MPa,
# sw = fatigue strength (rotating bending, unnotched, polished, estimate) MPa, cost = relative cost per kg (S235 = 1)
MATERIALS = {
    "S235JR":           (210, 7850, 235, 360, 180, 1.0),
    "S355J2":           (210, 7850, 355, 470, 235, 1.1),
    "C45+QT":           (210, 7850, 430, 650, 300, 1.3),
    "42CrMo4+QT":       (210, 7850, 750, 1000, 480, 1.8),
    "16MnCr5 case h.":  (210, 7850, 650, 1000, 450, 1.7),
    "18CrNiMo7-6 c.h.": (210, 7850, 850, 1200, 550, 3.0),
    "100Cr6 hardened":  (210, 7830, 1700, 2000, 800, 2.0),
    "EN-GJL-250":       (110, 7200, 165, 250, 110, 1.0),
    "EN-GJS-500-7":     (169, 7100, 320, 500, 224, 1.2),
    "AlSi10Mg T6":      (71, 2680, 220, 260, 80, 3.0),
    "EN AW-6082-T6":    (70, 2700, 260, 310, 90, 3.5),
    "EN AW-7075-T6":    (72, 2810, 500, 570, 160, 7.0),
    "X5CrNi18-10":      (200, 7900, 210, 520, 240, 4.0),
    "PA66-GF30 dry":    (9.5, 1350, 180, 180, 50, 4.0),
    "PTFE":             (0.5, 2170, 12, 25, 6, 15.0),
}

def indices(name, cost_based=False):
    """Ashby performance indices (bigger = better). E in GPa, strengths in MPa, rho in t/m3 for readable numbers.
    If cost_based, rho is replaced by cost*rho (index per relative cost)."""
    E, rho, Re, Rm, sw, c = MATERIALS[name]
    r = rho / 1000.0 * (c if cost_based else 1.0)
    return {
        "tie_strong  Re/rho": Re / r,
        "tie_stiff   E/rho": E / r,
        "beam_stiff  E^1/2/rho": E ** 0.5 / r,
        "beam_strong Re^2/3/rho": Re ** (2 / 3) / r,
        "plate_stiff E^1/3/rho": E ** (1 / 3) / r,
        "plate_strong Re^1/2/rho": Re ** 0.5 / r,
        "spring_energy sw^2/E": (sw ** 2) / (E * 1000),   # MJ/m3-like (MPa^2/MPa)
    }

def plate_mass_ratio(m_ref, m_new):
    """Mass ratio of two plates of equal bending stiffness = index ratio."""
    a = indices(m_ref)["plate_stiff E^1/3/rho"]
    b = indices(m_new)["plate_stiff E^1/3/rho"]
    return a / b

def penalty_plate(names, alpha, mass_ref_kg, ref):
    """Penalty function Z = C + alpha*m for a plate of fixed stiffness.
    Mass from the plate index relative to 'ref' (mass_ref_kg), cost = mass * relative price * 2 USD/kg (S235=2 USD/kg)."""
    out = {}
    for n in names:
        m = mass_ref_kg * plate_mass_ratio(ref, n)
        C = m * MATERIALS[n][5] * 2.0
        out[n] = {"mass": m, "cost": C, "Z": C + alpha * m}
    return out

# ------------------------------------------------------------------ ch.23 manufacturing + cost
def turning_time(D, L, vc, f, passes=1):
    n = 1000 * vc / (math.pi * D)
    return {"n_rpm": n, "t_min": passes * L / (f * n)}

def drilling_time(D, L, vc, f):
    n = 1000 * vc / (math.pi * D)
    return {"n_rpm": n, "t_min": (L + 0.3 * D) / (f * n)}

def bend_allowance(theta_deg, R, T, K):
    return math.radians(theta_deg) * (R + K * T)

def should_cost(mass_kg, price_kg, scrap, ops, lot):
    """ops: list of (name, t_cycle_min, setup_min, rate_per_h). Returns cost breakdown per part."""
    mat = mass_kg * price_kg * (1 + scrap)
    lines = []
    total_run = total_setup = 0.0
    for name, t, s, rate in ops:
        run = t / 60 * rate
        setup = s / 60 * rate / lot
        total_run += run
        total_setup += setup
        lines.append((name, run, setup))
    return {"material": mat, "ops": lines, "run": total_run, "setup": total_setup,
            "total": mat + total_run + total_setup}

def dfa_efficiency(n_min, times_s, t_ideal=3.0):
    return t_ideal * n_min / sum(times_s)

# ------------------------------------------------------------------ ch.24 tolerances
IT_MULT = {5: 7, 6: 10, 7: 16, 8: 25, 9: 40, 10: 64, 11: 100, 12: 160, 13: 250, 14: 400}

def tol_unit(D_low, D_high):
    D = math.sqrt(D_low * D_high)
    return 0.45 * D ** (1 / 3) + 0.001 * D

def it_value(D_low, D_high, grade):
    return IT_MULT[grade] * tol_unit(D_low, D_high)

def fit(hole, shaft):
    """hole=(EI, ES), shaft=(ei, es) in um. Positive = clearance, negative = interference."""
    EI, ES = hole
    ei, es = shaft
    return {"max_clearance": ES - ei, "min_clearance": EI - es}

def lame_pressure(delta_mm, d, Do, E=210000.0):
    """Solid steel shaft in steel hub (same E, nu cancels): p = E*delta/(2d) * (1 - (d/Do)^2)."""
    return E * delta_mm / (2 * d) * (1 - (d / Do) ** 2)

def bonus_tol(pos_tol, size_actual, size_mmc, hole=True):
    bonus = (size_actual - size_mmc) if hole else (size_mmc - size_actual)
    return pos_tol + max(0.0, bonus)

def stack_mc(dims, signs, lsl, usl, dist="normal", n=200000, seed=1):
    """dims: list of (nominal, +/-t). sign +1/-1. Normal: sigma = t/3; uniform: +/-t."""
    rnd = random.Random(seed)
    out = 0
    s = s2 = 0.0
    for _ in range(n):
        g = 0.0
        for (nom, t), sg in zip(dims, signs):
            x = rnd.gauss(nom, t / 3) if dist == "normal" else rnd.uniform(nom - t, nom + t)
            g += sg * x
        s += g
        s2 += g * g
        if g < lsl or g > usl:
            out += 1
    mean = s / n
    sd = math.sqrt(s2 / n - mean * mean)
    return {"mean": mean, "sd": sd, "out_pct": 100 * out / n}

def allocate(b, T, method="wc"):
    """Cost model c_i = a_i + b_i/t_i. Minimum cost: WC (sum t = T) -> t_i ~ sqrt(b_i);
    RSS (sqrt(sum t^2) = T) -> t_i ~ b_i^(1/3)."""
    if method == "wc":
        w = [math.sqrt(x) for x in b]
        s = sum(w)
        t = [T * x / s for x in w]
    else:
        w = [x ** (1 / 3) for x in b]
        s = math.sqrt(sum(x * x for x in w))
        t = [T * x / s for x in w]
    return {"t": t, "cost": sum(bi / ti for bi, ti in zip(b, t))}

def cp_cpk(lsl, usl, mean, sd):
    cp = (usl - lsl) / (6 * sd)
    cpk = min(usl - mean, mean - lsl) / (3 * sd)
    ppm = (N01.cdf((lsl - mean) / sd) + 1 - N01.cdf((usl - mean) / sd)) * 1e6
    return {"Cp": cp, "Cpk": cpk, "ppm": ppm}

# ------------------------------------------------------------------ examples
def _examples():
    e = {}
    e["21a"] = tapered_beam(2000, 20, 150, 200)
    e["21b"] = stiffness_budget(1000, 10, [0.4, 0.3, 0.3])
    e["21c"] = bolt_load_factor(210000, 58.0, 30.0, 4.0)
    e["21d"] = {"alu": thermal_growth(23e-6, 120, 60), "steel": thermal_growth(11.5e-6, 120, 60),
                "gjl": thermal_growth(10.5e-6, 120, 60)}
    e["21d"]["diff_alu_steel"] = e["21d"]["alu"] - e["21d"]["steel"]
    e["21d"]["diff_gjl_steel"] = e["21d"]["steel"] - e["21d"]["gjl"]
    e["21e"] = mount_stiffness(60, 8.0, 4)
    e["21e"]["T_1st"] = transmissibility(1450 / 60, 8.0)
    e["21e"]["T_1st_z01"] = transmissibility(1450 / 60, 8.0, 0.1)
    e["21e"]["bracket_fn"] = natural_freq(5e6, 3.0)
    e["21f"] = {"R10": renard(10), "R20_ratio": 10 ** (1 / 20)}
    e["22a"] = {n: indices(n) for n in ("EN-GJL-250", "AlSi10Mg T6", "EN-GJS-500-7", "S355J2")}
    e["22b"] = plate_mass_ratio("EN-GJL-250", "AlSi10Mg T6")
    e["22c"] = {a: penalty_plate(["EN-GJL-250", "AlSi10Mg T6", "S355J2"], a, 20.0, "EN-GJL-250") for a in (2, 50)}
    e["22d"] = {n: indices(n)["spring_energy sw^2/E"] for n in ("C45+QT", "42CrMo4+QT", "X5CrNi18-10", "EN AW-7075-T6")}
    e["23a"] = turning_time(30, 40, 180, 0.2)
    e["23b"] = drilling_time(8.5, 20, 80, 0.12)
    e["23c"] = bend_allowance(90, 2, 2, 0.33)
    mass = math.pi / 4 * 36 ** 2 * 180 * 7.85e-6
    e["23d"] = should_cost(mass, 1.6, 0.03,
                           [("saw", 0.5, 5, 40), ("CNC turning", 4.5, 30, 60),
                            ("keyway milling", 2.0, 20, 55), ("grinding seats", 3.0, 40, 70)], 200)
    e["23d"]["mass"] = mass
    e["23e"] = {"before": dfa_efficiency(3, [4, 5, 6, 4, 9, 9, 9, 9]),
                "after": dfa_efficiency(3, [4, 5, 5]), "t_before": 55, "t_after": 14}
    e["24a"] = {"i": tol_unit(18, 30), "IT6": it_value(18, 30, 6), "IT7": it_value(18, 30, 7)}
    e["24b"] = {"H7/g6": fit((0, 21), (-20, -7)), "H7/p6": fit((0, 21), (22, 35)), "H7/k6": fit((0, 21), (2, 15))}
    e["24c"] = lame_pressure(0.035, 30, 60)
    e["24d"] = {"bonus_at_LMC": bonus_tol(0.2, 10.1, 10.0), "virtual_condition": 10.0 - 0.2}
    dims = [(100, 0.10), (40, 0.05), (30, 0.05), (29.7, 0.05)]
    sg = [1, -1, -1, -1]
    e["24e"] = {"wc": sum(t for _, t in dims), "rss": math.sqrt(sum(t * t for _, t in dims)),
                "mc_normal": stack_mc(dims, sg, 0.1, 0.5, "normal"),
                "mc_uniform": stack_mc(dims, sg, 0.1, 0.5, "uniform")}
    e["24f"] = {"wc": allocate([1, 4, 9], 0.3, "wc"), "equal_cost": sum(b / 0.1 for b in (1, 4, 9)),
                "rss": allocate([1, 4, 9], 0.3, "rss")}
    e["24g"] = cp_cpk(0, 21, 12.5, 3.0)
    return e

def cmd_examples():
    e = _examples()
    t = e["21a"]; print("21a tapered beam: h_root %.2f mm, mean %.2f mm, saving %.1f %%" % (t["h_root"], t["mean_h"], t["saving_pct"]))
    s = e["21b"]; print("21b stiffness budget: k_tot %.0f N/um, parts %s, series check %.1f" % (s["k_total"], ["%.0f" % k for k in s["k_parts"]], s["check_series"]))
    b = e["21c"]; print("21c bolt: k_b %.0f N/mm, k_p %.0f N/mm, phi %.2f" % (b["k_b"], b["k_p"], b["phi"]))
    d = e["21d"]; print("21d thermal 120 mm, 60 K: alu %.4f, steel %.4f, GJL %.4f mm; alu-steel %.4f, steel-GJL %.4f" % (d["alu"], d["steel"], d["gjl"], d["diff_alu_steel"], d["diff_gjl_steel"]))
    m = e["21e"]; print("21e mounts: k %.0f N/m, each %.1f N/mm, T(24.2 Hz) %.3f, with zeta 0.1 %.3f, bracket fn %.0f Hz" % (m["k_total_N_per_m"], m["k_each_N_per_mm"], m["T_1st"], m["T_1st_z01"], m["bracket_fn"]))
    print("21f R10 theoretical:", ", ".join("%.3f" % v for v in e["21f"]["R10"]), "; R20 ratio %.4f" % e["21f"]["R20_ratio"])
    for n, ix in e["22a"].items():
        print("22a %-14s" % n, "; ".join("%s %.2f" % (k.split()[0], v) for k, v in ix.items()))
    print("22b equal-stiffness plate: m_Al / m_GJL = %.3f (Al plate is %.2f x lighter)" % (e["22b"], 1 / e["22b"]))
    for a, res in e["22c"].items():
        print("22c alpha %3d USD/kg:" % a, "; ".join("%s m %.1f kg C %.1f Z %.1f" % (n, r["mass"], r["cost"], r["Z"]) for n, r in res.items()))
    print("22d spring index sw^2/E:", "; ".join("%s %.3f" % kv for kv in e["22d"].items()))
    print("23a turning: n %.0f rpm, t %.4f min (%.1f s)" % (e["23a"]["n_rpm"], e["23a"]["t_min"], e["23a"]["t_min"] * 60))
    print("23b drilling: n %.0f rpm, t %.4f min (%.1f s)" % (e["23b"]["n_rpm"], e["23b"]["t_min"], e["23b"]["t_min"] * 60))
    print("23c bend allowance %.3f mm" % e["23c"])
    c = e["23d"]
    print("23d should-cost: mass %.3f kg, material %.2f, run %.2f, setup %.2f, total %.2f USD" % (c["mass"], c["material"], c["run"], c["setup"], c["total"]))
    for n, r, s_ in c["ops"]:
        print("    %-15s run %.2f setup %.3f" % (n, r, s_))
    print("23e DFA: before %.1f %%, after %.1f %%" % (100 * e["23e"]["before"], 100 * e["23e"]["after"]))
    a = e["24a"]; print("24a i %.4f um, IT6 %.2f, IT7 %.2f um" % (a["i"], a["IT6"], a["IT7"]))
    for k, v in e["24b"].items():
        print("24b %s max clearance %d, min clearance %d um" % (k, v["max_clearance"], v["min_clearance"]))
    print("24c Lame pressure %.1f MPa" % e["24c"])
    print("24d bonus at LMC %.2f, virtual condition %.2f" % (e["24d"]["bonus_at_LMC"], e["24d"]["virtual_condition"]))
    s = e["24e"]; print("24e stack WC +/-%.3f RSS +/-%.4f; MC normal mean %.4f sd %.4f out %.4f %%; uniform sd %.4f out %.3f %%" % (s["wc"], s["rss"], s["mc_normal"]["mean"], s["mc_normal"]["sd"], s["mc_normal"]["out_pct"], s["mc_uniform"]["sd"], s["mc_uniform"]["out_pct"]))
    f = e["24f"]; print("24f allocation WC t %s cost %.1f (equal t cost %.1f); RSS t %s cost %.1f" % (["%.3f" % x for x in f["wc"]["t"]], f["wc"]["cost"], f["equal_cost"], ["%.3f" % x for x in f["rss"]["t"]], f["rss"]["cost"]))
    g = e["24g"]; print("24g Cp %.3f Cpk %.3f ppm %.0f" % (g["Cp"], g["Cpk"], g["ppm"]))

def cmd_selftest():
    e = _examples()
    res = []
    def near(name, a, b, tol):
        ok = abs(a - b) <= tol
        res.append(ok)
        print("%-30s %12.5f expect %12.5f %s" % (name, a, b, "OK" if ok else "FAIL"))
    near("21a h_root", e["21a"]["h_root"], 28.284, 0.005)
    near("21b series check", e["21b"]["check_series"], 100.0, 0.01)
    near("21c phi", e["21c"]["phi"], 0.20, 1e-9)
    near("21d alu-steel", e["21d"]["diff_alu_steel"], 0.0828, 0.0001)
    near("21e k each N/mm", e["21e"]["k_each_N_per_mm"], 37.9, 0.1)
    near("21e T", e["21e"]["T_1st"], 0.123, 0.001)
    near("21f R20 ratio", e["21f"]["R20_ratio"], 1.1220, 0.0001)
    near("22b m_Al/m_GJL", e["22b"], 0.431, 0.001)
    near("23a turning s", e["23a"]["t_min"] * 60, 6.28, 0.02)
    near("23c bend allowance", e["23c"], 4.178, 0.002)
    near("23d total USD", e["23d"]["total"], 13.03, 0.01)
    near("23e DFA after %", 100 * e["23e"]["after"], 64.3, 0.1)
    near("24a IT7 um", e["24a"]["IT7"], 20.92, 0.02)
    near("24b H7/g6 max", e["24b"]["H7/g6"]["max_clearance"], 41, 0)
    near("24b H7/p6 max interf.", e["24b"]["H7/p6"]["min_clearance"], -35, 0)
    near("24c Lame MPa", e["24c"], 91.9, 0.1)
    near("24e uniform out %", e["24e"]["mc_uniform"]["out_pct"], 0.27, 0.05)
    near("24f WC cost", e["24f"]["wc"]["cost"], 120.0, 0.01)
    near("24g Cpk", e["24g"]["Cpk"], 0.9444, 0.0005)
    print("SELFTEST", "PASS" if all(res) else "FAIL")
    return 0 if all(res) else 1

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "selftest":
        sys.exit(cmd_selftest())
    elif len(sys.argv) > 1 and sys.argv[1] == "examples":
        cmd_examples()
    else:
        print(__doc__)
