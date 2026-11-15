#!/usr/bin/env python3
"""M10 tolerance program - limits and fits (ISO 286-1/-2 tables: standard tolerances IT1-IT16 and fundamental
deviations of shafts c...u and holes C...U up to 500 mm, incl. the Delta rule for holes K...U), general tolerances
(ISO 2768-1), fit calculation (clearance / transition / interference, probability of interference), fit finder,
rolling-bearing seats (ISO 492 normal class rings), fits at operating temperature (different materials),
interference fits (DIN 7190 style: smoothing, Lame pressure, torque, hub stress, press force, shrink temperature),
1-D tolerance stack-up (worst case, RSS, modified RSS, Monte Carlo, contributions, yield), tolerance allocation
(cost-optimal, Lagrange) and position tolerances (ISO 1101 / ASME Y14.5 fastener formulas, MMC bonus).
Default case: the M2 compressor - crankshaft / bearing / piston / pulley / press-fit seats, the TDC gap stack of M2
and the cylinder-head bolt pattern. Guide: 10_tolerances_fits.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python tol.py params | run [--in p.json] [--out folder] | examples | selftest
  python tol.py fit H7/g6 25          one fit (any ISO zone pair, nominal size mm)
  python tol.py ch24 | ch56 | ch78    extra results of guide chapters 2-4, 5-6, 7-8
  python tol.py run --in examples/tol_example.json --out example   worked design example (chapter 8)

The ISO 286 table values are typed in from the standard (IT1-IT16, deviations d e f g k m n p up to 500 mm and c r s u
in the intermediate steps) - check them against ISO 286-2 before a drawing is released. Bearing-ring tolerances
(ISO 492 normal class), friction coefficients, process capabilities and cost data are TYPICAL VALUES - check.
All default numbers are EXAMPLES.
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- ISO 286-1 tables (um)
MAIN = [3, 6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500]                    # upper limits of the main size steps
SUB = [3, 6, 10, 14, 18, 24, 30, 40, 50, 65, 80, 100, 120, 140, 160, 180, 200, 225, 250, 280, 315, 355, 400, 450, 500]
IT_GRADES = list(range(1, 17))
IT_TABLE = [   # IT1 ... IT16 for each main step (ISO 286-1 table 1)
    [0.8, 1.2, 2, 3, 4, 6, 10, 14, 25, 40, 60, 100, 140, 250, 400, 600],
    [1, 1.5, 2.5, 4, 5, 8, 12, 18, 30, 48, 75, 120, 180, 300, 480, 750],
    [1, 1.5, 2.5, 4, 6, 9, 15, 22, 36, 58, 90, 150, 220, 360, 580, 900],
    [1.2, 2, 3, 5, 8, 11, 18, 27, 43, 70, 110, 180, 270, 430, 700, 1100],
    [1.5, 2.5, 4, 6, 9, 13, 21, 33, 52, 84, 130, 210, 330, 520, 840, 1300],
    [1.5, 2.5, 4, 7, 11, 16, 25, 39, 62, 100, 160, 250, 390, 620, 1000, 1600],
    [2, 3, 5, 8, 13, 19, 30, 46, 74, 120, 190, 300, 460, 740, 1200, 1900],
    [2.5, 4, 6, 10, 15, 22, 35, 54, 87, 140, 220, 350, 540, 870, 1400, 2200],
    [3.5, 5, 8, 12, 18, 25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500],
    [4.5, 7, 10, 14, 20, 29, 46, 72, 115, 185, 290, 460, 720, 1150, 1850, 2900],
    [6, 8, 12, 16, 23, 32, 52, 81, 130, 210, 320, 520, 810, 1300, 2100, 3200],
    [7, 9, 13, 18, 25, 36, 57, 89, 140, 230, 360, 570, 890, 1400, 2300, 3600],
    [8, 10, 15, 20, 27, 40, 63, 97, 155, 250, 400, 630, 970, 1550, 2500, 4000],
]
# shaft fundamental deviations: es for c...h (upper), ei for k...u (lower), um (ISO 286-1 tables 2 and 3)
DEV_MAIN = {
    "d": [-20, -30, -40, -50, -65, -80, -100, -120, -145, -170, -190, -210, -230],
    "e": [-14, -20, -25, -32, -40, -50, -60, -72, -85, -100, -110, -125, -135],
    "f": [-6, -10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68],
    "g": [-2, -4, -5, -6, -7, -9, -10, -12, -14, -15, -17, -18, -20],
    "h": [0] * 13,
    "k": [0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5],          # valid for IT4...IT7; 0 for <= IT3 and >= IT8
    "m": [2, 4, 6, 7, 8, 9, 11, 13, 15, 17, 20, 21, 23],
    "n": [4, 8, 10, 12, 15, 17, 20, 23, 27, 31, 34, 37, 40],
    "p": [6, 12, 15, 18, 22, 26, 32, 37, 43, 50, 56, 62, 68],
}
DEV_SUB = {
    "c": [-60, -70, -80, -95, -95, -110, -110, -120, -130, -140, -150, -170, -180, -200, -210, -230, -240, -260, -280, -300, -330, -360, -400, -440, -480],
    "r": [10, 15, 19, 23, 23, 28, 28, 34, 34, 41, 43, 51, 54, 63, 65, 68, 77, 80, 84, 94, 98, 108, 114, 126, 132],
    "s": [14, 19, 23, 28, 28, 35, 35, 43, 43, 53, 59, 71, 79, 92, 100, 108, 122, 130, 140, 158, 170, 190, 208, 232, 252],
    "u": [18, 23, 28, 33, 33, 41, 48, 60, 70, 87, 102, 124, 144, 170, 190, 210, 236, 258, 284, 315, 350, 390, 435, 490, 540],
}
UPPER_LETTERS = set("cdefgh")          # deviation given = es (upper)
SHAFT_LETTERS = ["c", "d", "e", "f", "g", "h", "js", "k", "m", "n", "p", "r", "s", "u"]
# rolling-bearing rings, ISO 492 normal class (P0): mean bore / mean outside diameter deviation (upper 0), um (typical - check)
BRG_BORE = [(10, -8), (18, -8), (30, -10), (50, -12), (80, -15), (120, -20), (180, -25), (250, -30)]   # (d upper limit, lower dev)
BRG_OD = [(18, -8), (30, -9), (50, -11), (80, -13), (120, -15), (150, -18), (180, -25), (250, -30), (315, -35)]
# ISO 2768-1 general tolerances for linear sizes, +/- mm: (upper limit of range, f, m, c, v)
ISO2768 = [(3, 0.05, 0.1, 0.2, None), (6, 0.05, 0.1, 0.3, 0.5), (30, 0.1, 0.2, 0.5, 1.0), (120, 0.15, 0.3, 0.8, 1.5),
           (400, 0.2, 0.5, 1.2, 2.5), (1000, 0.3, 0.8, 2.0, 4.0), (2000, 0.5, 1.2, 3.0, 6.0), (4000, None, 2.0, 4.0, 8.0)]
PREFERRED_FITS = ["H11/c11", "H9/d9", "H8/f7", "H7/g6", "H7/h6", "H7/k6", "H7/n6", "H7/p6", "H7/s6", "H7/u6",
                  "C11/h11", "D9/h9", "F8/h7", "G7/h6", "K7/h6", "N7/h6", "P7/h6", "S7/h6", "U7/h6"]   # ISO 286 / ANSI B4.2 style

DEFAULT = {
    "name": "Compressor of M2: seats, TDC gap stack and head-bolt pattern (example)",
    "fits": [   # name, D mm, hole zone, shaft zone, alpha hole / shaft 1/K, T hole / shaft in operation C, required clearance range um
        {"name": "6206 inner ring on crankshaft (rotating load)", "D": 30.0, "hole": "brg_bore", "shaft": "k5",
         "alpha": [11.5e-6, 11.5e-6], "T": [90.0, 90.0], "need": [None, -1.0]},
        {"name": "6206 outer ring in crankcase (stationary load)", "D": 62.0, "hole": "H7", "shaft": "brg_od",
         "alpha": [11.0e-6, 11.5e-6], "T": [70.0, 80.0], "need": [0.0, 60.0]},
        {"name": "aluminium piston skirt in cast-iron cylinder", "D": 65.0, "hole": "H7", "shaft": "dev:-110/-130",
         "alpha": [11.0e-6, 23.0e-6], "T": [80.0, 110.0], "need": [10.0, 120.0]},
        {"name": "piston pin in small-end bush (floating)", "D": 18.0, "hole": "H7", "shaft": "g6",
         "alpha": [18.0e-6, 11.5e-6], "T": [100.0, 100.0], "need": [5.0, 50.0]},
        {"name": "crank pulley hub on shaft (keyed)", "D": 25.0, "hole": "H7", "shaft": "k6",
         "alpha": [11.0e-6, 11.5e-6], "T": [40.0, 40.0], "need": [-20.0, 25.0]},
        {"name": "flywheel / gear hub press fit (M3 seat)", "D": 30.0, "hole": "H7", "shaft": "s6",
         "alpha": [11.0e-6, 11.5e-6], "T": [60.0, 60.0], "need": [None, -10.0]},
    ],
    "pressfit": {"fit": "H7/s6", "d": 30.0, "D_hub": 55.0, "di_shaft": 0.0, "l": 16.0, "Rz_shaft": 3.2, "Rz_hub": 6.3,
                 "E_shaft": 210000.0, "E_hub": 210000.0, "nu_shaft": 0.3, "nu_hub": 0.3, "mu": 0.12, "Re_hub": 600.0,
                 "alpha_hub": 11e-6, "T_req_Nm": 71.7, "S_slip": 1.5, "S_hub": 1.2},
    "stack": {   # TDC gap (piston top to valve plate) = sum(sign * nominal); +/- tolerances from M2 deck_stack
        "name": "TDC gap", "LSL": 0.35, "USL": 0.90,
        "items": [["block deck height (crank axis -> deck)", 1, 139.20, 0.05], ["gasket thickness (compressed)", 1, 0.80, 0.05],
                  ["crank radius", -1, 23.00, 0.02], ["rod centre distance", -1, 90.00, 0.03],
                  ["piston compression height", -1, 26.40, 0.03], ["bearing clearances (pin + crank pin)", -1, 0.00, 0.02]]},
    "mc_n": 100000, "mc_seed": 1, "mrss_factor": 1.5,
    "gdt": {"F": 8.0, "H": 9.0, "H_tol": 0.22, "pattern": "M8 head bolts, clearance holes 9 H13"},
}

# ---------------------------------------------------------------- chapter 2: ISO 286 limits
def step(D, table=MAIN):
    """Index of the size step: D in (lower, upper]; 0 ... 3 mm includes 3."""
    if not 0 < D <= table[-1]:
        raise ValueError("nominal size %.3f mm outside 0 ... %d mm" % (D, table[-1]))
    return next(i for i, u in enumerate(table) if D <= u)

def it_um(D, grade):
    """Standard tolerance ITn (um) from the ISO 286-1 table."""
    if grade not in IT_GRADES:
        raise ValueError("IT grade %s not in 1 ... 16" % grade)
    return IT_TABLE[step(D)][grade - 1]

def it_formula(D, grade):
    """Tolerance unit i = 0.45 D^(1/3) + 0.001 D (D = geometric mean of the step) and ITn = k i for IT5 ... IT16."""
    k = {5: 7, 6: 10, 7: 16, 8: 25, 9: 40, 10: 64, 11: 100, 12: 160, 13: 250, 14: 400, 15: 640, 16: 1000}[grade]
    i = step(D)
    lo = 1.0 if i == 0 else MAIN[i - 1]                 # first step: ISO uses D = sqrt(1 x 3)
    Dm = math.sqrt(lo * MAIN[i])
    return k * (0.45 * Dm ** (1 / 3) + 0.001 * Dm)

def fund_dev_shaft(D, letter, grade):
    """Fundamental deviation of a shaft (um): es for c...h, ei for k...u."""
    if letter in DEV_MAIN:
        v = DEV_MAIN[letter][step(D)]
        if letter == "k" and not 4 <= grade <= 7:
            v = 0
        return v
    if letter in DEV_SUB:
        return DEV_SUB[letter][step(D, SUB)]
    raise ValueError("shaft letter %s not in the table" % letter)

def js_half(D, grade):
    t = it_um(D, grade)
    if 7 <= grade <= 11 and t == int(t) and int(t) % 2 == 1:   # ISO 286-1: odd IT values rounded to the lower even number
        t -= 1
    return t / 2

def shaft_limits(D, letter, grade):
    """(ei, es) of a shaft zone in um."""
    t = it_um(D, grade)
    if letter == "js":
        h = js_half(D, grade)
        return -h, h
    v = fund_dev_shaft(D, letter, grade)
    return (v - t, v) if letter in UPPER_LETTERS else (v, v + t)

def hole_limits(D, letter, grade):
    """(EI, ES) of a hole zone in um. General rule EI = -es (A...H), ES = -ei (K...U); special (Delta) rule:
    ES = -ei + Delta, Delta = IT(n) - IT(n-1), for K, M, N up to IT8 and P...U up to IT7 (D > 3 mm);
    N above IT8: ES = 0; K uses the k value of IT4...IT7."""
    l = letter.lower()
    t = it_um(D, grade)
    if l == "js":
        h = js_half(D, grade)
        return -h, h
    if l in UPPER_LETTERS:
        EI = -fund_dev_shaft(D, l, grade)
        return EI, EI + t
    ei = DEV_MAIN["k"][step(D)] if l == "k" else fund_dev_shaft(D, l, grade)
    delta = it_um(D, grade) - it_um(D, grade - 1) if (D > 3 and grade > 1) else 0.0
    if l in ("k", "m", "n"):
        if grade <= 8:
            ES = -ei + delta
        else:
            ES = 0.0 if l in ("k", "n") else -ei
    else:
        ES = -ei + delta if grade <= 7 else -ei
    return ES - t, ES

def parse_zone(z):
    """'H7' -> ('H', 7); 'js6' -> ('js', 6)."""
    i = next(k for k, ch in enumerate(z) if ch.isdigit())
    return z[:i], int(z[i:])

def zone_limits(D, zone, part):
    """Limits (lower, upper) in um of any zone: ISO zone, 'brg_bore' / 'brg_od' (ISO 492 normal class) or 'dev:+a/+b'."""
    if zone.startswith("dev:"):
        a, b = (float(x) for x in zone[4:].split("/"))
        return min(a, b), max(a, b)
    if zone == "brg_bore":
        return next(v for u, v in BRG_BORE if D <= u), 0.0
    if zone == "brg_od":
        return next(v for u, v in BRG_OD if D <= u), 0.0
    letter, grade = parse_zone(zone)
    if part == "hole":
        return hole_limits(D, letter, grade)
    return shaft_limits(D, letter, grade)

def fit(D, hole, shaft):
    """Clearance C = hole - shaft (um): C_max = ES - ei, C_min = EI - es; type; probability of interference with both
    sizes normal, centred, +/-3 sigma = tolerance."""
    EI, ES = zone_limits(D, hole, "hole")
    ei, es = zone_limits(D, shaft, "shaft")
    cmax, cmin = ES - ei, EI - es
    kind = "clearance" if cmin >= 0 else "interference" if cmax <= 0 else "transition"
    mu = (EI + ES) / 2 - (ei + es) / 2
    sd = math.sqrt(((ES - EI) / 6) ** 2 + ((es - ei) / 6) ** 2)
    p_int = 0.5 * math.erfc(mu / (sd * math.sqrt(2))) if sd > 0 else float(mu < 0)
    return {"D": D, "hole": hole, "shaft": shaft, "EI": EI, "ES": ES, "ei": ei, "es": es, "C_max": cmax, "C_min": cmin,
            "C_mean": mu, "sd": sd, "type": kind, "P_interference": p_int, "T_fit": cmax - cmin}

def fit_pair(D, pair):
    h, s = pair.split("/")
    return fit(D, h, s)

def fit_finder(D, c_lo, c_hi, holes=("H6", "H7", "H8", "H9", "H11"), grades=range(5, 12)):
    """All hole-basis fits whose clearance range lies inside [c_lo, c_hi] (um); preferred fits first, then widest
    (= cheapest) fit tolerance."""
    out = []
    for h in holes:
        gh = parse_zone(h)[1]
        for L in SHAFT_LETTERS:
            for g in grades:
                if not gh - 2 <= g <= gh:                  # shaft same grade as the hole or up to 2 grades finer
                    continue
                try:
                    F = fit(D, h, "%s%d" % (L, g))
                except (ValueError, IndexError):
                    continue
                if F["C_min"] >= c_lo and F["C_max"] <= c_hi:
                    pair = "%s/%s%d" % (h, L, g)
                    out.append(dict(F, pair=pair, preferred=pair in PREFERRED_FITS))
    out.sort(key=lambda r: (not r["preferred"], -r["T_fit"]))
    return out

def general_tol(L, cls="m"):
    """ISO 2768-1 permissible deviation +/- mm for a linear size without individual tolerance."""
    col = {"f": 1, "m": 2, "c": 3, "v": 4}[cls]
    if L < 0.5:
        raise ValueError("ISO 2768-1 starts at 0.5 mm")
    row = next(r for r in ISO2768 if L <= r[0])
    return row[col]

# ---------------------------------------------------------------- chapter 3: fits in operation
def fit_hot(F, alpha_h, alpha_s, T_h, T_s, T_ref=20.0):
    """Clearance at operating temperature: C(T) = C(20) + D (alpha_h (T_h - 20) - alpha_s (T_s - 20)) (um)."""
    dC = F["D"] * 1000 * (alpha_h * (T_h - T_ref) - alpha_s * (T_s - T_ref))
    return {"dC": dC, "C_min_hot": F["C_min"] + dC, "C_max_hot": F["C_max"] + dC}

def fit_report(fd):
    F = fit(fd["D"], fd["hole"], fd["shaft"])
    H = fit_hot(F, fd["alpha"][0], fd["alpha"][1], fd["T"][0], fd["T"][1])
    lo, hi = fd["need"]
    ok_cold = (lo is None or F["C_min"] >= lo) and (hi is None or F["C_max"] <= hi)
    ok_hot = (lo is None or H["C_min_hot"] >= lo) and (hi is None or H["C_max_hot"] <= hi)
    return dict(F, **H, name=fd["name"], need=fd["need"], ok_cold=ok_cold, ok_hot=ok_hot)

# ---------------------------------------------------------------- chapter 4: interference fit (DIN 7190 style)
def press_fit(pf, U_um):
    """Lame thick cylinders. Effective interference U_w = U - 0.8 (Rz_shaft + Rz_hub) (smoothing).
    p = U_w / (d [ (1/E_h)((1+Q_h^2)/(1-Q_h^2) + nu_h) + (1/E_s)((1+Q_s^2)/(1-Q_s^2) - nu_s) ]), Q_h = d/D_hub, Q_s = di/d.
    Torque T = p pi d l mu d/2; hub inner-bore von Mises stress (plane stress, sig_r = -p, sig_t = p (1 + Q^2)/(1 - Q^2)):
    sig_v = p sqrt(3 + Q_h^4) / (1 - Q_h^2)."""
    d, D, di = pf["d"], pf["D_hub"], pf["di_shaft"]
    Qh, Qs = d / D, di / d
    Uw = max(0.0, U_um - 0.8 * (pf["Rz_shaft"] + pf["Rz_hub"]))
    K = (1 / pf["E_hub"]) * ((1 + Qh ** 2) / (1 - Qh ** 2) + pf["nu_hub"]) + (1 / pf["E_shaft"]) * ((1 + Qs ** 2) / (1 - Qs ** 2) - pf["nu_shaft"])
    p = Uw / 1000 / (d * K)
    A = math.pi * d * pf["l"]
    T = p * A * pf["mu"] * d / 2 / 1000
    sig_v = p * math.sqrt(3 + Qh ** 4) / (1 - Qh ** 2)
    return {"U": U_um, "U_w": Uw, "p": p, "T_Nm": T, "F_ax_N": p * A * pf["mu"], "sig_v_hub": sig_v, "S_hub": pf["Re_hub"] / sig_v if sig_v else float("inf")}

def press_fit_check(pf):
    h, s = pf["fit"].split("/")
    F = fit(pf["d"], h, s)
    Umin, Umax = -F["C_max"], -F["C_min"]
    lo, hi = press_fit(pf, Umin), press_fit(pf, Umax)
    dT = (Umax / 1000 + 0.001 * pf["d"]) / (pf["alpha_hub"] * pf["d"])        # heating with assembly clearance 0.001 d
    ok = {"slip_at_U_min": lo["T_Nm"] >= pf["S_slip"] * pf["T_req_Nm"], "hub_at_U_max": hi["S_hub"] >= pf["S_hub"], "interference": Umin > 0}
    return {"fit": F, "U_min": Umin, "U_max": Umax, "lo": lo, "hi": hi, "S_slip": lo["T_Nm"] / pf["T_req_Nm"],
            "press_force_kN": hi["F_ax_N"] / 1000, "dT_shrink": dT, "ok": ok}

# ---------------------------------------------------------------- chapter 5: tolerance stack-up
def stack(st, mc_n=100000, seed=1, k_mrss=1.5):
    """Closing dimension G = sum(sign_i x_i). Worst case T = sum t_i; RSS T = sqrt(sum t_i^2) (each +/- t_i = 3 sigma);
    modified RSS = k x RSS (Bender, capped at WC); Monte Carlo with normal (sigma = t/3) and uniform (+/- t) parts."""
    it = st["items"]
    G = sum(s * x for _, s, x, _ in it)
    wc = sum(t for *_, t in it)
    rss = math.sqrt(sum(t * t for *_, t in it))
    mrss = min(wc, k_mrss * rss)
    contrib = [(n, 100 * t * t / rss ** 2) for n, _, _, t in it]
    rnd = random.Random(seed)
    res = {}
    for dist in ("normal", "uniform"):
        s1 = s2 = 0.0
        out = 0
        for _ in range(mc_n):
            g = 0.0
            for _, sg, x, t in it:
                g += sg * (rnd.gauss(x, t / 3) if dist == "normal" else rnd.uniform(x - t, x + t))
            s1 += g
            s2 += g * g
            if g < st["LSL"] or g > st["USL"]:
                out += 1
        m = s1 / mc_n
        res[dist] = {"mean": m, "sd": math.sqrt(max(0.0, s2 / mc_n - m * m)), "out_ppm": 1e6 * out / mc_n}
    sd = rss / 3
    cpk = min(st["USL"] - G, G - st["LSL"]) / (3 * sd)
    ok = {"worst_case": G - wc >= st["LSL"] and G + wc <= st["USL"], "rss": G - rss >= st["LSL"] and G + rss <= st["USL"]}
    return {"G": G, "WC": wc, "RSS": rss, "MRSS": mrss, "G_min_wc": G - wc, "G_max_wc": G + wc, "G_min_rss": G - rss,
            "G_max_rss": G + rss, "contrib": contrib, "mc": res, "Cpk": cpk, "ok": ok}

def allocate(b, T, k=1.0, method="wc"):
    """Minimum cost of sum(b_i / t_i^k) subject to sum t_i = T (WC) or sqrt(sum t_i^2) = T (RSS), Lagrange:
    WC -> t_i ~ b_i^(1/(k+1)); RSS -> t_i ~ b_i^(1/(k+2))."""
    if method == "wc":
        w = [x ** (1 / (k + 1)) for x in b]
        t = [T * x / sum(w) for x in w]
    else:
        w = [x ** (1 / (k + 2)) for x in b]
        t = [T * x / math.sqrt(sum(y * y for y in w)) for x in w]
    return {"t": t, "cost": sum(bi / ti ** k for bi, ti in zip(b, t))}

# ---------------------------------------------------------------- chapter 6: position tolerances (fasteners)
def fastener(F, H):
    """Position tolerance diameter at MMC: floating fastener (clearance holes in both parts) T = H - F per part;
    fixed fastener (threaded / pressed in one part) T1 + T2 = H - F (split equally: T = (H - F)/2)."""
    return {"floating": H - F, "fixed_each": (H - F) / 2}

def bonus(T_mmc, size, mmc, internal=True):
    """MMC bonus: allowed position = T at MMC + departure from MMC."""
    return T_mmc + max(0.0, (size - mmc) if internal else (mmc - size))

def xy_to_position(tx, ty):
    """+/- coordinate tolerances tx, ty -> position zone diameter that has the same corner: 2 sqrt(tx^2 + ty^2)."""
    return 2 * math.hypot(tx, ty)

def gdt_check(g):
    f = fastener(g["F"], g["H"])
    return {"F": g["F"], "H_mmc": g["H"], "H_lmc": g["H"] + g["H_tol"], "T_floating": f["floating"], "T_fixed": f["fixed_each"],
            "T_floating_lmc": bonus(f["floating"], g["H"] + g["H_tol"], g["H"]), "xy_equiv": f["floating"] / (2 * math.sqrt(2))}

# ---------------------------------------------------------------- summary / report / run
def summary(P):
    return {"fits": [fit_report(fd) for fd in P["fits"]], "press": press_fit_check(P["pressfit"]),
            "stack": stack(P["stack"], P["mc_n"], P["mc_seed"], P["mrss_factor"]), "gdt": gdt_check(P["gdt"])}

def report_text(P):
    S = summary(P)
    L = ["# Tolerance report (ISO 286 / ISO 2768 / DIN 7190 / stack-up / position) - %s\n" % P["name"], "## Fits (um; C > 0 clearance, C < 0 interference)"]
    nd = lambda v: "-" if v is None else "%g" % v
    for fd, r in zip(P["fits"], S["fits"]):
        L.append("- %s: %g %s/%s -> hole %+g/%+g, shaft %+g/%+g; C %+.1f ... %+.1f (%s, P(interference) %.1f %%); at T hole %g / shaft %g C: %+.1f ... %+.1f; need %s ... %s -> cold %s, hot %s" % (
            r["name"], r["D"], r["hole"], r["shaft"], r["EI"], r["ES"], r["ei"], r["es"], r["C_min"], r["C_max"], r["type"], 100 * r["P_interference"],
            fd["T"][0], fd["T"][1], r["C_min_hot"], r["C_max_hot"], nd(r["need"][0]), nd(r["need"][1]),
            "OK" if r["ok_cold"] else "NOT OK", "OK" if r["ok_hot"] else "NOT OK"))
    pr, pf = S["press"], P["pressfit"]
    L += ["\n## Interference fit %s, d %g, hub D %g, l %g (DIN 7190 style)" % (pf["fit"], pf["d"], pf["D_hub"], pf["l"]),
          "- interference %.0f ... %.0f um, effective (smoothing 0.8 x (Rz %g + %g)) %.1f ... %.1f um" % (pr["U_min"], pr["U_max"], pf["Rz_shaft"], pf["Rz_hub"], pr["lo"]["U_w"], pr["hi"]["U_w"]),
          "- pressure %.1f ... %.1f MPa; torque %.1f ... %.1f N m vs %.1f x %.1f = %.1f N m required (S %.2f); hub stress %.0f MPa (S %.2f)" % (
              pr["lo"]["p"], pr["hi"]["p"], pr["lo"]["T_Nm"], pr["hi"]["T_Nm"], pf["S_slip"], pf["T_req_Nm"], pf["S_slip"] * pf["T_req_Nm"], pr["S_slip"], pr["hi"]["sig_v_hub"], pr["hi"]["S_hub"]),
          "- press-in force up to %.1f kN or shrink: heat hub by %.0f K -> %s" % (pr["press_force_kN"], pr["dT_shrink"],
              "all checks OK" if all(pr["ok"].values()) else "fails: " + ", ".join(k for k, v in pr["ok"].items() if not v))]
    s, st = S["stack"], P["stack"]
    L += ["\n## Stack-up: %s (limits %.2f ... %.2f mm)" % (st["name"], st["LSL"], st["USL"])]
    for (n, sg, x, t), (_, c) in zip(st["items"], s["contrib"]):
        L.append("- %s %-42s %8.3f +/- %.3f mm (contribution %4.1f %%)" % ("+" if sg > 0 else "-", n, x, t, c))
    L += ["- nominal %.3f mm; worst case +/- %.3f -> %.3f ... %.3f (%s); RSS +/- %.3f -> %.3f ... %.3f (%s); modified RSS +/- %.3f" % (
              s["G"], s["WC"], s["G_min_wc"], s["G_max_wc"], "OK" if s["ok"]["worst_case"] else "NOT OK", s["RSS"], s["G_min_rss"], s["G_max_rss"],
              "OK" if s["ok"]["rss"] else "NOT OK", s["MRSS"]),
          "- Monte Carlo %d: normal sd %.4f mm, %.0f ppm out; uniform sd %.4f mm, %.0f ppm out; Cpk (RSS sigma) %.2f" % (
              P["mc_n"], s["mc"]["normal"]["sd"], s["mc"]["normal"]["out_ppm"], s["mc"]["uniform"]["sd"], s["mc"]["uniform"]["out_ppm"], s["Cpk"])]
    g = S["gdt"]
    L += ["\n## Position tolerance: %s" % P["gdt"]["pattern"],
          "- bolt %.1f, hole %.2f ... %.2f: floating fastener T = H - F = %.2f mm at MMC (up to %.2f at LMC with bonus); fixed fastener (studs) %.2f mm per part; equal +/- x/y %.3f mm" % (
              g["F"], g["H_mmc"], g["H_lmc"], g["T_floating"], g["T_floating_lmc"], g["T_fixed"], g["xy_equiv"])]
    return "\n".join(L)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    rep = report_text(P)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    S = summary(P)
    with open(os.path.join(out, "fit_table.csv"), "w", encoding="utf-8") as f:
        f.write("feature,nominal mm,hole zone,hole lower um,hole upper um,shaft zone,shaft lower um,shaft upper um,C min um,C max um,type\n")
        for r in S["fits"]:
            f.write('"%s",%g,%s,%g,%g,%s,%g,%g,%g,%g,%s\n' % (r["name"], r["D"], r["hole"], r["EI"], r["ES"], r["shaft"], r["ei"], r["es"], r["C_min"], r["C_max"], r["type"]))
    print(rep)
    print("written: report.md, fit_table.csv ->", out)



# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2: ISO 286 tables
HOLE_LETTERS = ["C", "D", "E", "F", "G", "H", "JS", "K", "M", "N", "P", "R", "S", "U"]

def tol_unit(D):
    """Tolerance unit i (um) for the geometric mean of the size step of D."""
    i = step(D)
    lo = 1.0 if i == 0 else MAIN[i - 1]
    Dm = math.sqrt(lo * MAIN[i])
    return Dm, 0.45 * Dm ** (1 / 3) + 0.001 * Dm

def it_rows(Ds=(3, 10, 30, 65, 120, 250, 500), grades=(5, 6, 7, 8, 9, 11, 13)):
    return [(D, [it_um(D, g) for g in grades]) for D in Ds]

def zone_table(D, grades=(6, 7)):
    """All shaft zones of the program at size D: (zone, ei, es) in um."""
    out = []
    for L in SHAFT_LETTERS:
        for g in grades:
            ei, es = shaft_limits(D, L, g)
            out.append(("%s%d" % (L, g), ei, es))
    return out

def hole_table(D, grades=(6, 7, 8)):
    out = []
    for L in HOLE_LETTERS:
        for g in grades:
            EI, ES = hole_limits(D, L, g)
            out.append(("%s%d" % (L, g), EI, ES))
    return out

def delta_rule_demo(D=25.0):
    """General rule ES = -ei against the special rule ES = -ei + Delta for K, M, N, P, S."""
    rows = []
    for L in ("K", "M", "N", "P", "S"):
        for g in (6, 7, 8):
            ei = DEV_MAIN["k"][step(D)] if L == "K" else fund_dev_shaft(D, L.lower(), g)
            delta = it_um(D, g) - it_um(D, g - 1)
            EI, ES = hole_limits(D, L, g)
            rows.append((L + str(g), -ei, delta, ES, EI))
    return rows

def preferred_table(D=30.0):
    out = []
    for pair in PREFERRED_FITS:
        h, s = pair.split("/")
        F = fit(D, h, s)
        out.append((pair, F["C_min"], F["C_max"], F["type"]))
    return out

# ISO 2768-2 general geometric tolerances (mm), classes H / K / L (typical - check the standard)
GT2768_FLAT = [(10, 0.02, 0.05, 0.1), (30, 0.05, 0.1, 0.2), (100, 0.1, 0.2, 0.4), (300, 0.2, 0.4, 0.8),
               (1000, 0.3, 0.6, 1.2), (3000, 0.4, 0.8, 1.6)]            # straightness and flatness, by length
GT2768_PERP = [(100, 0.2, 0.4, 0.6), (300, 0.3, 0.6, 1.0), (1000, 0.4, 0.8, 1.5), (3000, 0.5, 1.0, 2.0)]   # perpendicularity, shorter side
GT2768_RUNOUT = {"H": 0.1, "K": 0.2, "L": 0.5}

def general_geo(L, cls="K", kind="flatness"):
    col = {"H": 1, "K": 2, "L": 3}[cls]
    tab = GT2768_FLAT if kind == "flatness" else GT2768_PERP
    return next(r for r in tab if L <= r[0])[col]

def drawing_note(D, zone, part):
    """How the zone is written: 'Ø30 k5 (+0.011 / +0.002)' and the limit sizes."""
    lo, hi = zone_limits(D, zone, part)
    return "Ø%g %s (%+.3f / %+.3f)" % (D, zone, hi / 1000, lo / 1000), D + hi / 1000, D + lo / 1000

def envelope(D, zone, actual, part="shaft"):
    """Envelope requirement (E), ISO 14405-1 / Taylor: the part must not violate the MMC boundary.
    Allowed form error (e.g. straightness of the axis, as a diameter) = |MMC - actual local size|."""
    lo, hi = zone_limits(D, zone, part)
    mmc = D + (hi if part == "shaft" else lo) / 1000
    return {"MMC": mmc, "form_allowed": abs(mmc - actual)}

# ---------------------------------------------------------------- chapter 3: fits in function
FIT_BY_FUNCTION = [   # class, hole basis, shaft basis, typical use
    ("loose running", "H11/c11", "C11/h11", "agricultural machines, pivots with dirt, wide temperature range"),
    ("free running", "H9/d9", "D9/h9", "large plain bearings at high speed, idler pulleys on axles"),
    ("close running", "H8/f7", "F8/h7", "plain bearings of machine tools and gearboxes, pump shafts"),
    ("sliding", "H7/g6", "G7/h6", "spigots, sliding gears, piston pins, precise guides"),
    ("locational clearance", "H7/h6", "H7/h6", "centring of covers, change gears, parts assembled by hand"),
    ("locational transition", "H7/k6", "K7/h6", "pulleys / couplings with key, bearing seats with light load"),
    ("locational transition, tighter", "H7/n6", "N7/h6", "gears and couplings with key that must not rattle"),
    ("light press", "H7/p6", "P7/h6", "bushes, locating pins, light press fits (no torque by friction)"),
    ("medium drive", "H7/s6", "S7/h6", "gear hubs, flywheels, bronze rims, permanent joints"),
    ("force / shrink", "H7/u6", "U7/h6", "high torque by friction only, shrink fits"),
]

def function_table(D=30.0):
    out = []
    for cls, hb, sb, use in FIT_BY_FUNCTION:
        a, b = fit(D, *hb.split("/")), fit(D, *sb.split("/"))
        out.append((cls, hb, a["C_min"], a["C_max"], sb, b["C_min"], b["C_max"], use))
    return out

# recommended shaft fits for a ROTATING inner-ring load (radial ball bearings, solid steel shaft) by P/C and d (check
# the bearing maker's tables): (P/C upper limit, [(d upper limit, zone), ...])
BRG_SHAFT_FITS = [
    (0.05, [(18, "js5"), (100, "js6"), (140, "k6")]),           # light load (makers often write j5 / j6; tol.py has js)
    (0.10, [(18, "js5"), (40, "k5"), (100, "m5"), (140, "m6")]), # normal load
    (9.99, [(40, "m5"), (65, "m6"), (100, "n6"), (140, "p6")]),  # heavy load
]
BRG_HOUSING_FITS = [   # load case, zone, note
    ("stationary outer ring, normal", "H7", "floating bearing can slide axially"),
    ("stationary outer ring, heat flow through the shaft", "G7", "keeps the floating function when the ring is warmer"),
    ("stationary outer ring, accurate running", "JS7", "less clearance (makers write J7), may still slide"),
    ("rotating outer ring load (e.g. wheel hub, idler)", "N7", "outer ring must not creep"),
    ("rotating outer ring, heavy / thin housing", "P7", "high interference"),
]
C3_6206 = (13.0, 28.0)   # radial internal clearance C3, bore over 24 up to 30 mm, um (ISO 5753 style - check)

def bearing_shaft_zone(d, P_over_C):
    rows = next(r for lim, r in BRG_SHAFT_FITS if P_over_C <= lim)
    return next((z for u, z in rows if d <= u), rows[-1][1])

def bearing_seat_table(d=30.0, ratios=(0.03, 0.08, 0.15)):
    out = []
    for r in ratios:
        z = bearing_shaft_zone(d, r)
        F = fit(d, "brg_bore", z)
        out.append((r, z, -F["C_max"], -F["C_min"]))      # interference min / max um
    return out

def clearance_after_fit(U_min, U_max, d=30.0, F_race=36.5, Rz_shaft=3.2, C=C3_6206):
    """Radial clearance reduction by the inner-ring fit: about 0.9 x effective interference x d / F (M4 ch. 7)."""
    red = [0.9 * max(0.0, U - 0.8 * Rz_shaft) * d / F_race for U in (U_min, U_max)]
    return {"red_min": red[0], "red_max": red[1], "C_min": C[0] - red[1], "C_max": C[1] - red[0]}

PISTON_TYPES = [   # design, effective alpha of the skirt 1/K (typical - check)
    ("plain Al-Si piston (default)", 23.0e-6),
    ("Al-Si piston with steel struts (autothermic)", 17.5e-6),
    ("Al-Si piston, steel ring carrier + struts, hyper-eutectic alloy", 16.0e-6),
    ("grey cast-iron piston", 11.0e-6),
]

def piston_design(D=65.0, T_cyl=80.0, T_pis=110.0, alpha_cyl=11.0e-6, C_hot_min=10.0, band=50.0, C_cold_max=120.0):
    """Required cold clearance so that the hot clearance stays >= C_hot_min, for each piston type; band = hole
    tolerance + piston tolerance (30 + 20 um)."""
    out = []
    for name, a in PISTON_TYPES:
        dC = D * 1000 * (alpha_cyl * (T_cyl - 20) - a * (T_pis - 20))
        cmin = C_hot_min - dC
        out.append((name, a, dC, cmin, cmin + band, cmin + band <= C_cold_max))
    return out

def housing_material(D=62.0, zones=("G7", "H7", "JS7", "K7", "M7"), T_ring=80.0, T_house=70.0):
    """Outer ring 6206 in a cast-iron and an aluminium housing: clearance hot."""
    out = []
    for z in zones:
        F = fit(D, z, "brg_od")
        ci = fit_hot(F, 11.0e-6, 11.5e-6, T_house, T_ring)
        al = fit_hot(F, 23.0e-6, 11.5e-6, T_house, T_ring)
        out.append((z, F["C_min"], F["C_max"], ci["C_min_hot"], ci["C_max_hot"], al["C_min_hot"], al["C_max_hot"]))
    return out

def wear_life(D=30.0, pair="H8/f7", C_limit=120.0, wear_um_per_1000h=4.0):
    """Running fit: life until the largest clearance reaches the functional limit (linear wear of both parts)."""
    F = fit(D, *pair.split("/"))
    return {"C_max": F["C_max"], "C_min": F["C_min"], "h_worst": 1000 * (C_limit - F["C_max"]) / wear_um_per_1000h,
            "h_best": 1000 * (C_limit - F["C_min"]) / wear_um_per_1000h}

RA_FOR_IT = {5: 0.2, 6: 0.4, 7: 0.8, 8: 1.6, 9: 3.2, 10: 3.2, 11: 6.3}   # typical Ra um for ground / turned fits (check)

def roughness_vs_it(D=30.0):
    """Rz ~ 4...6 Ra; the peaks are flattened when an interference fit is pressed (smoothing 0.8 Rz per part)."""
    return [(g, it_um(D, g), RA_FOR_IT[g], 5 * RA_FOR_IT[g], 100 * 5 * RA_FOR_IT[g] / it_um(D, g)) for g in sorted(RA_FOR_IT)]

def shaft_basis_finder(D, c_lo, c_hi, shafts=("h5", "h6", "h7", "h8", "h9"), grades=range(6, 12)):
    out = []
    for s in shafts:
        gs = int(s[1:])
        for L in HOLE_LETTERS:
            for g in grades:
                if not gs <= g <= gs + 2:
                    continue
                try:
                    F = fit(D, "%s%d" % (L, g), s)
                except (ValueError, IndexError):
                    continue
                if F["C_min"] >= c_lo and F["C_max"] <= c_hi:
                    out.append(("%s%d/%s" % (L, g, s), F["C_min"], F["C_max"]))
    out.sort(key=lambda r: -(r[2] - r[1]))
    return out

# ---------------------------------------------------------------- chapter 4: interference fits
HUB_MATERIALS = {   # E MPa, nu, permissible stress MPa (Re for ductile, Rm/2 for grey iron - check), alpha 1/K
    "steel C45 (QT)": (210000.0, 0.30, 490.0, 11.0e-6),
    "steel 42CrMo4 (QT)": (210000.0, 0.30, 750.0, 11.0e-6),
    "ductile iron EN-GJS-400": (169000.0, 0.275, 250.0, 10.5e-6),
    "grey iron EN-GJL-250": (110000.0, 0.26, 125.0, 10.0e-6),
    "aluminium EN AW-6082 T6": (70000.0, 0.33, 250.0, 23.0e-6),
}

def lame_field(pf, U_um, n=5):
    """Radial and hoop stress over the radius in hub (a <= r <= b) and solid / hollow shaft for the effective pressure."""
    p = press_fit(pf, U_um)["p"]
    a, b, c = pf["d"] / 2, pf["D_hub"] / 2, pf["di_shaft"] / 2
    hub = []
    for k in range(n):
        r = a + (b - a) * k / (n - 1)
        sr = -p * a * a / (b * b - a * a) * (b * b / (r * r) - 1)
        st = p * a * a / (b * b - a * a) * (b * b / (r * r) + 1)
        hub.append((r, sr, st))
    shaft = (-p, -p) if c == 0 else (-p, -2 * p * a * a / (a * a - c * c))   # solid: sr = st = -p; hollow: hoop at the bore
    return {"p": p, "hub": hub, "shaft": shaft}

def hub_material_table(pf=None):
    pf = dict(DEFAULT["pressfit"] if pf is None else pf)
    out = []
    for name, (E, nu, Rp, al) in HUB_MATERIALS.items():
        q = dict(pf, E_hub=E, nu_hub=nu, Re_hub=Rp, alpha_hub=al)
        c = press_fit_check(q)
        out.append((name, c["lo"]["p"], c["hi"]["p"], c["lo"]["T_Nm"], c["S_slip"], c["hi"]["sig_v_hub"], c["hi"]["S_hub"]))
    return out

def plastic_limits(pf=None):
    """Hub (plane stress, Tresca-like von Mises at the bore): onset of yield p_el = Re (1 - Q^2)/sqrt(3);
    fully plastic hub p_pl = 2 Re / sqrt(3) x ln(1/Q). Elastic-plastic fits use the range between (DIN 7190-1)."""
    pf = dict(DEFAULT["pressfit"] if pf is None else pf)
    Q = pf["d"] / pf["D_hub"]
    Re = pf["Re_hub"]
    return {"Q": Q, "p_el": Re * (1 - Q * Q) / math.sqrt(3), "p_pl": 2 * Re / math.sqrt(3) * math.log(1 / Q)}

def combined_capacity(pf, U_um, T_Nm, F_ax_N):
    """Torque and axial force together: resultant friction force sqrt((2T/d)^2 + F_ax^2) <= mu p pi d l."""
    r = press_fit(pf, U_um)
    cap = pf["mu"] * r["p"] * math.pi * pf["d"] * pf["l"]
    need = math.hypot(2 * T_Nm * 1000 / pf["d"], F_ax_N)
    return {"capacity_N": cap, "need_N": need, "S": cap / need}

def press_in(pf, U_um, mu_press=0.08):
    """Longitudinal press-in force with a lower press-in friction (oiled) - force for selecting the press."""
    r = press_fit(pf, U_um)
    return r["p"] * math.pi * pf["d"] * pf["l"] * mu_press / 1000

def shrink_assembly(pf, U_max_um, T_room=20.0, alpha_cold=8.5e-6, T_ln2=-196.0, T_hub_max=250.0):
    """Heat the hub by dT = (U_max + 0.001 d)/(alpha d); or cool the shaft in liquid nitrogen (mean alpha ~ 8.5e-6
    between -196 and 20 C - check) and heat the hub only for the rest."""
    need = U_max_um / 1000 + 0.001 * pf["d"]
    dT_hub = need / (pf["alpha_hub"] * pf["d"])
    shrink_shaft = alpha_cold * pf["d"] * (T_room - T_ln2)
    dT_rest = max(0.0, need - shrink_shaft) / (pf["alpha_hub"] * pf["d"])
    return {"need_mm": need, "dT_hub": dT_hub, "T_hub": T_room + dT_hub, "ok_heat_only": T_room + dT_hub <= T_hub_max,
            "shaft_shrink_mm": shrink_shaft, "dT_hub_with_ln2": dT_rest}

def loosening_speed(pf, U_w_um, rho=7.85e-9):
    """Centrifugal expansion of the hub bore (disk with hole) minus that of the solid shaft surface (plane stress):
    u_hub = rho w^2 a /(4E) ((3+nu) b^2 + (1-nu) a^2), u_shaft = (1-nu) rho w^2 a^3 /(4E).
    Loss of diametral interference 2 (u_hub - u_shaft) = U_w gives the loosening speed. rho in t/mm3, E in MPa."""
    a, b = pf["d"] / 2, pf["D_hub"] / 2
    nu, E = pf["nu_hub"], pf["E_hub"]
    k = rho * a / (4 * E) * ((3 + nu) * b * b + (1 - nu) * a * a) - (1 - pf["nu_shaft"]) * rho * a ** 3 / (4 * pf["E_shaft"])
    w = math.sqrt(U_w_um / 1000 / (2 * k)) if U_w_um > 0 else 0.0
    return {"n_loose_rpm": w * 60 / (2 * math.pi), "loss_um_at_1450": 2 * k * (1450 * 2 * math.pi / 60) ** 2 * 1000}

PF_EDGE = [   # measure, effect on the shaft fatigue notch factor at the hub edge (typical - check DIN 743 / FKM)
    ("plain press fit, sharp hub edge", "beta_sigma ~ 2.2 ... 2.8"),
    ("hub edge chamfered / rounded, hub wall thinned at the end", "beta_sigma ~ 1.8 ... 2.2"),
    ("shaft seat raised 5 ... 10 % with a rounded shoulder (relief groove)", "beta_sigma ~ 1.4 ... 1.7"),
    ("seat rolled (deep rolling) or nitrided", "beta_sigma reduced ~ 30 %, fretting resistance up"),
    ("molybdenum / anti-fretting coating, l/d >= 0.5", "less micro-slip at the edges, fretting corrosion delayed"),
]

def redesign_seat(pf=None, fits=("H7/r6", "H7/s6", "H7/u6"), lengths=(16.0, 20.0, 25.0, 30.0), rz=((3.2, 6.3), (1.6, 3.2), (0.8, 1.6)),
                  hubs=(55.0, 65.0), T_hub_max=300.0):
    """Search fit x length x roughness x hub diameter for S_slip >= S_slip_req, hub S >= S_hub_req and hub heating
    temperature <= T_hub_max. Returns all rows and the passing design with the shortest seat, then smallest hub."""
    pf = dict(DEFAULT["pressfit"] if pf is None else pf)
    rows = []
    for f in fits:
        for l in lengths:
            for rs, rh in rz:
                for D in hubs:
                    q = dict(pf, fit=f, l=l, Rz_shaft=rs, Rz_hub=rh, D_hub=D)
                    c = press_fit_check(q)
                    T_hub = 20 + c["dT_shrink"]
                    ok = c["S_slip"] >= pf["S_slip"] and c["hi"]["S_hub"] >= pf["S_hub"] and T_hub <= T_hub_max
                    rows.append({"fit": f, "l": l, "Rz": (rs, rh), "D_hub": D, "U": (c["U_min"], c["U_max"]), "T_min": c["lo"]["T_Nm"],
                                 "S_slip": c["S_slip"], "S_hub": c["hi"]["S_hub"], "T_hub": T_hub, "F_kN": c["press_force_kN"], "ok": ok})
    good = [r for r in rows if r["ok"]]
    best = min(good, key=lambda r: (r["l"], r["D_hub"], -r["Rz"][0])) if good else None
    return {"rows": rows, "best": best}

# ---------------------------------------------------------------- demo
def demo_ch24():
    print("## 2.2 Tolerance unit and IT grades")
    for D in (3, 10, 30, 65, 120, 250, 500):
        Dm, i = tol_unit(D)
        print("  D %3d: step mean %7.2f mm, i = %.3f um, IT7 = 16 i = %5.1f -> table %g um" % (D, Dm, i, 16 * i, it_um(D, 7)))
    print("  IT rows (um)   IT5    IT6    IT7    IT8    IT9   IT11   IT13")
    for D, r in it_rows():
        print("  D %3d  " % D + "".join("%7g" % x for x in r))
    print("\n## 2.3 Shaft zones at D 30 mm (um): zone  ei / es")
    zt = zone_table(30.0)
    for k in range(0, len(zt), 2):
        a, b = zt[k], zt[k + 1]
        print("  %-5s %+5g / %+5g      %-5s %+5g / %+5g" % (a[0], a[1], a[2], b[0], b[1], b[2]))
    print("\n## 2.4 Hole zones at D 30 mm (um): zone  EI / ES")
    ht = hole_table(30.0)
    for k in range(0, len(ht), 3):
        print("  " + "   ".join("%-5s %+5g / %+5g" % h for h in ht[k:k + 3]))
    print("\n## 2.5 Delta rule at D 25 mm (um): zone, -ei (general rule), Delta, ES, EI")
    for z, g, d, ES, EI in delta_rule_demo():
        print("  %-3s  -ei %+4g   Delta %4g   ES %+5g   EI %+5g" % (z, g, d, ES, EI))
    print("\n## 2.6 js rounding: js6/js7/js8 at 25 = +/-%g / +/-%g / +/-%g um (IT %g / %g / %g)" % (
        js_half(25, 6), js_half(25, 7), js_half(25, 8), it_um(25, 6), it_um(25, 7), it_um(25, 8)))
    print("\n## 2.7 Preferred fits at D 30 mm (um)")
    for pair, cmin, cmax, kind in preferred_table():
        print("  %-8s C %+5g ... %+5g  %s" % (pair, cmin, cmax, kind))
    print("\n## 2.8 General tolerances ISO 2768-1 (+/- mm) and ISO 2768-2 (mm)")
    for L in (2, 5, 25, 65, 139.2, 300, 800):
        print("  L %6.1f: f %s  m %s  c %s  v %s" % (L, *[general_tol(L, c) for c in "fmcv"]))
    print("  flatness of a 139 mm deck: H %.2f, K %.2f, L %.2f; perpendicularity 62 mm: K %.2f; run-out K %.1f" % (
        general_geo(139, "H"), general_geo(139, "K"), general_geo(139, "L"), general_geo(62, "K", "perp"), GT2768_RUNOUT["K"]))
    print("\n## 2.9 Drawing notation and envelope requirement")
    for D, z, p in ((30, "k5", "shaft"), (62, "H7", "hole"), (18, "g6", "shaft"), (30, "s6", "shaft")):
        t, up, lo = drawing_note(D, z, p)
        print("  %-28s limits %.3f / %.3f" % (t, up, lo))
    for act in (30.000, 29.995, 29.987):
        e = envelope(30, "h6", act)
        print("  shaft 30 h6 (E), actual local size %.3f: MMC %.3f -> allowed straightness of axis %.3f mm" % (act, e["MMC"], e["form_allowed"]))
    print("\n## 3.1 Fits by function at D 30 mm (um)")
    for cls, hb, a1, a2, sb, b1, b2, use in function_table():
        print("  %-31s %-8s %+5g ... %+5g  | %-8s %+5g ... %+5g  %s" % (cls, hb, a1, a2, sb, b1, b2, use))
    print("\n## 3.2 Bearing seat 6206 (d 30): shaft zone by load P/C, interference min / max (um)")
    for r, z, umin, umax in bearing_seat_table():
        print("  P/C %.2f -> %-4s interference %+5g ... %+5g" % (r, z, umin, umax))
    for name, z, note in BRG_HOUSING_FITS:
        F = fit(62.0, z, "brg_od")
        print("  housing %-50s %-3s C %+5g ... %+5g  %s" % (name, z, F["C_min"], F["C_max"], note))
    k5 = fit(30.0, "brg_bore", "k5")
    cr = clearance_after_fit(-k5["C_max"], -k5["C_min"])
    print("  k5 fit: clearance reduction %.1f ... %.1f um -> C3 %g...%g becomes %.1f ... %.1f um (before thermal effect, see M4)" % (
        cr["red_min"], cr["red_max"], C3_6206[0], C3_6206[1], cr["C_min"], cr["C_max"]))
    print("\n## 3.3 Temperature: piston designs (D 65, cylinder 80 C, skirt 110 C, hot clearance >= 10 um, band 50 um)")
    for name, a, dC, cmin, cmax, ok in piston_design():
        print("  %-62s alpha %4.1fe-6: change %+6.1f um -> cold %5.1f ... %5.1f um %s" % (name, a * 1e6, dC, cmin, cmax, "OK (<= 120)" if ok else "too loose cold (> 120)"))
    print("  6206 outer ring D 62 (ring 80 C, housing 70 C): zone  cold C | cast iron hot | aluminium hot (um)")
    for z, c1, c2, h1, h2, a1, a2 in housing_material():
        print("  %-3s %+5g ... %+5g | %+6.1f ... %+6.1f | %+6.1f ... %+6.1f" % (z, c1, c2, h1, h2, a1, a2))
    w = wear_life()
    print("\n## 3.4 Wear allowance: H8/f7 at 30 (C %+g ... %+g um), limit 120 um, wear 4 um / 1000 h -> life %.0f ... %.0f h" % (
        w["C_min"], w["C_max"], w["h_worst"], w["h_best"]))
    print("\n## 3.5 Roughness vs IT at D 30: grade, IT um, Ra um, Rz ~ 5 Ra, Rz as % of IT")
    for g, t, ra, rz, pc in roughness_vs_it():
        print("  IT%-2d %5g  Ra %4.1f  Rz %5.1f  %5.1f %%" % (g, t, ra, rz, pc))
    print("\n## 3.6 Fit finder")
    print("  hole basis d 30, running clearance 20 ... 80 um:")
    for r in fit_finder(30, 20, 80)[:6]:
        print("    %-9s C %+5g ... %+5g%s" % (r["pair"], r["C_min"], r["C_max"], "  (preferred)" if r["preferred"] else ""))
    print("  hole basis d 30, press fit interference 20 ... 80 um (C -80 ... -20):")
    for r in fit_finder(30, -80, -20)[:6]:
        print("    %-9s C %+5g ... %+5g%s" % (r["pair"], r["C_min"], r["C_max"], "  (preferred)" if r["preferred"] else ""))
    print("  shaft basis d 30, clearance 20 ... 80 um:")
    for p, a, b in shaft_basis_finder(30, 20, 80)[:6]:
        print("    %-9s C %+5g ... %+5g" % (p, a, b))
    pf = dict(DEFAULT["pressfit"])
    c = press_fit_check(pf)
    print("\n## 4.2 Lame stress field, H7/s6 d 30 / D 55 at U_max %.0f um (p %.1f MPa)" % (c["U_max"], c["hi"]["p"]))
    lf = lame_field(pf, c["U_max"])
    for r, sr, st in lf["hub"]:
        print("  hub r %5.2f mm: sigma_r %+7.1f, sigma_t %+7.1f MPa" % (r, sr, st))
    print("  solid shaft: sigma_r = sigma_t = %+.1f MPa" % lf["shaft"][0])
    print("\n## 4.3 Hub material (same seat H7/s6, d 30, D 55, l 16): p min / max MPa, T_min N m, S_slip, sigma_v MPa, S_hub")
    for row in hub_material_table():
        print("  %-26s p %5.1f / %6.1f  T %5.1f  S_slip %.2f  sigma_v %5.0f  S_hub %.2f" % row)
    pl = plastic_limits()
    print("\n## 4.4 Plastic limits of the steel hub (Q %.3f, Re %g): yield onset p_el %.0f MPa, fully plastic %.0f MPa (actual p_max %.1f)" % (
        pl["Q"], pf["Re_hub"], pl["p_el"], pl["p_pl"], c["hi"]["p"]))
    cc = combined_capacity(pf, c["U_min"], 71.7, 2000.0)
    print("\n## 4.5 Combined load at U_min: T 71.7 N m + F_ax 2 kN -> need %.0f N, capacity %.0f N, S %.2f" % (cc["need_N"], cc["capacity_N"], cc["S"]))
    print("\n## 4.6 Assembly")
    print("  press-in force (oiled, mu 0.08): %.1f kN at U_max; with mu 0.12 (core): %.1f kN" % (press_in(pf, c["U_max"]), c["press_force_kN"]))
    sa = shrink_assembly(pf, c["U_max"])
    print("  shrink: need %.3f mm -> heat hub by %.0f K to %.0f C (%s); shaft in liquid nitrogen shrinks %.3f mm -> hub heating %.0f K" % (
        sa["need_mm"], sa["dT_hub"], sa["T_hub"], "OK <= 250 C" if sa["ok_heat_only"] else "too hot", sa["shaft_shrink_mm"], sa["dT_hub_with_ln2"]))
    ls = loosening_speed(pf, c["lo"]["U_w"])
    print("  centrifugal loosening at U_w,min %.1f um: n %.0f rpm; interference lost at 1450 rpm %.3f um" % (c["lo"]["U_w"], ls["n_loose_rpm"], ls["loss_um_at_1450"]))
    print("\n## 4.7 Hub edge and fretting")
    for m, e in PF_EDGE:
        print("  %-68s %s" % (m, e))
    print("\n## 4.8 Redesign of the M3 seat (T_req 71.7 N m, S_slip >= 1.5, S_hub >= 1.2, hub heated to <= 300 C)")
    R = redesign_seat()
    for r in R["rows"]:
        if r["D_hub"] == 55.0 and r["Rz"] in ((3.2, 6.3), (0.8, 1.6)):
            print("  %-6s l %4.0f Rz %.1f/%.1f D %g: U %3.0f...%3.0f um, T_min %6.1f N m, S_slip %.2f, S_hub %.2f, hub %3.0f C, F %4.1f kN %s" % (
                r["fit"], r["l"], r["Rz"][0], r["Rz"][1], r["D_hub"], r["U"][0], r["U"][1], r["T_min"], r["S_slip"], r["S_hub"], r["T_hub"], r["F_kN"], "OK" if r["ok"] else ""))
    b = R["best"]
    print("  passing designs: %d of %d; shortest seat: %s" % (sum(r["ok"] for r in R["rows"]), len(R["rows"]),
          "%s, l %g, Rz %.1f/%.1f, hub D %g: S_slip %.2f, S_hub %.2f, hub %.0f C" % (b["fit"], b["l"], b["Rz"][0], b["Rz"][1], b["D_hub"], b["S_slip"], b["S_hub"], b["T_hub"]) if b else "none"))
    for r in [x for x in R["rows"] if x["ok"]][:12]:
        print("    pass: %-6s l %4.0f Rz %.1f/%.1f D %g: S_slip %.2f, S_hub %.2f, hub %3.0f C, F %4.1f kN" % (
            r["fit"], r["l"], r["Rz"][0], r["Rz"][1], r["D_hub"], r["S_slip"], r["S_hub"], r["T_hub"], r["F_kN"]))
    if b:
        q = dict(pf, fit=b["fit"], l=b["l"], Rz_shaft=b["Rz"][0], Rz_hub=b["Rz"][1], D_hub=b["D_hub"])
        sb = shrink_assembly(q, b["U"][1])
        print("  recommended assembly of %s: hub alone %.0f C, or shaft in liquid nitrogen + hub %.0f C" % (b["fit"], sb["T_hub"], 20 + sb["dT_hub_with_ln2"]))

# ================================================================ added with guide chapters (ch56)
# ================================================================ chapter 5: tolerance stack-up
def st_sym(nominal, lo, hi):
    """Unequal limits nominal +hi/+lo -> mean size and symmetric +/- t (stack calculations use mean +/- t)."""
    return nominal + (lo + hi) / 2, (hi - lo) / 2

def st_loop_table(st):
    """Loop table: sign, nominal, +/- t, min and max contribution to the closing dimension."""
    rows = []
    for n, s, x, t in st["items"]:
        rows.append((n, s, x, t, s * x - t, s * x + t))
    return rows

def st_draw(dist, x, t, shift, rnd):
    """One random size. shift = mean shift as a fraction of t. normal: sigma = t/3; uniform: +/- t; triangular: +/- t;
    skewed: beta(2, 5) on [x - t, x + t] (typical of a size cut towards one limit, e.g. a shaft turned to the upper side)."""
    m = x + shift * t
    if dist == "normal":
        return rnd.gauss(m, t / 3)
    if dist == "uniform":
        return rnd.uniform(m - t, m + t)
    if dist == "triangular":
        return rnd.triangular(m - t, m + t, m)
    if dist == "skewed":
        return m - t + 2 * t * rnd.betavariate(2, 5)
    raise ValueError(dist)

def st_mc(st, dists=None, shifts=None, n=100000, seed=1):
    """Monte Carlo of a linear stack with a distribution and a mean shift per item. Returns mean, sd, ppm out, 0.135 %
    and 99.865 % quantiles (the natural +/-3 sigma limits of a non-normal result)."""
    it = st["items"]
    dists = dists or ["normal"] * len(it)
    shifts = shifts or [0.0] * len(it)
    rnd = random.Random(seed)
    g = []
    for _ in range(n):
        g.append(sum(s * st_draw(d, x, t, sh, rnd) for (_, s, x, t), d, sh in zip(it, dists, shifts)))
    g.sort()
    m = sum(g) / n
    sd = math.sqrt(sum((v - m) ** 2 for v in g) / n)
    out = sum(1 for v in g if v < st["LSL"] or v > st["USL"])
    return {"mean": m, "sd": sd, "ppm": 1e6 * out / n, "q_lo": g[int(0.00135 * n)], "q_hi": g[int(0.99865 * n) - 1]}

def st_cpk_stack(st, Cp=1.33, Cpk=1.0):
    """Statistical stack from process capability: each part sigma_i = t_i / (3 Cp); mean offset |delta_i| = t_i (1 - Cpk/Cp).
    Offsets added linearly in the adverse direction (worst case of the means), sigmas by RSS."""
    sig = [t / (3 * Cp) for *_, t in st["items"]]
    dl = [t * (1 - Cpk / Cp) for *_, t in st["items"]]
    S = math.sqrt(sum(s * s for s in sig))
    D = sum(dl)
    G = sum(s * x for _, s, x, _ in st["items"])
    z_lo = (G - D - st["LSL"]) / S          # mean shifted towards LSL
    z_hi = (st["USL"] - (G + D)) / S        # mean shifted towards USL
    ppm = 1e6 * 0.5 * math.erfc(min(z_lo, z_hi) / math.sqrt(2))
    return {"sigma": S, "delta": D, "G_lo": G - D - 3 * S, "G_hi": G + D + 3 * S, "z_min": min(z_lo, z_hi), "ppm_worst_side": ppm}

def st_bender(st, ks=(1.0, 1.3, 1.5, 1.8)):
    s = stack(st, 2000, 1)
    return [(k, min(s["WC"], k * s["RSS"])) for k in ks]

def st_numeric_sens(f, x, h=1e-6):
    """Central-difference sensitivities df/dx_i."""
    out = []
    for i in range(len(x)):
        xp, xm = list(x), list(x)
        xp[i] += h
        xm[i] -= h
        out.append((f(xp) - f(xm)) / (2 * h))
    return out

def st_nonlinear(f, x, t, n=100000, seed=1):
    """Linearised RSS (sum (df/dx_i t_i)^2) vs Monte Carlo (normal, sigma = t/3) of a nonlinear closing function."""
    sens = st_numeric_sens(f, x)
    f0 = f(x)
    rss = math.sqrt(sum((s * ti) ** 2 for s, ti in zip(sens, t)))
    rnd = random.Random(seed)
    v = [f([rnd.gauss(xi, ti / 3) for xi, ti in zip(x, t)]) for _ in range(n)]
    m = sum(v) / n
    sd = math.sqrt(sum((a - m) ** 2 for a in v) / n)
    return {"f0": f0, "sens": sens, "rss": rss, "mc_mean": m, "mc_sd": sd, "mc_3sd": 3 * sd, "bias": m - f0}

ST_CLEARANCE = {"names": ["bore D mm", "stroke s mm", "TDC gap mm", "valve pocket volume cm3"],
                "x": [65.0, 46.0, 0.60, 2.20], "t": [0.015, 0.04, 0.087, 0.15]}   # gap: RSS result of the TDC stack

def st_clearance_ratio(x):
    """Clearance ratio of the compressor c = V_c / V_s = (A gap + V_pocket) / (A s), A = pi D^2 / 4 (M2 crank.py)."""
    D, s, gap, Vp = x
    A = math.pi * D * D / 4
    return (A * gap + Vp * 1000) / (A * s)

def st_desaxe_tdc(x):
    """Height of the piston pin at TDC with a cylinder-axis offset e (desaxe): y = sqrt((r + l)^2 - e^2)."""
    r, l, e = x
    return math.sqrt((r + l) ** 2 - e * e)

def st_allocate_compare(names, nominals, b, T, k=1.0):
    """Allocation of a worst-case closing tolerance T (+/-) to the items: equal, proportional to the tolerance unit
    D^(1/3), cost-optimal (Lagrange, cost_i = b_i / t_i^k); and the RSS cost-optimal allocation for the same T."""
    n = len(b)
    eq = [T / n] * n
    w = [max(D, 1.0) ** (1 / 3) for D in nominals]
    pr = [T * x / sum(w) for x in w]
    opt = allocate(b, T, k, "wc")["t"]
    rss = allocate(b, T, k, "rss")["t"]
    cost = lambda ts: sum(bi / ti ** k for bi, ti in zip(b, ts))
    return {"names": names, "equal": eq, "unit": pr, "opt": opt, "rss": rss,
            "cost": {"equal": cost(eq), "unit": cost(pr), "opt": cost(opt), "rss": cost(rss)}}

ST_COST_B = [0.40, 0.30, 0.25, 0.20, 0.20, 0.10]   # cost coefficients b_i (EUR mm) of the six TDC-stack items, cost = b / t (typical - check)

def st_selective(hole=(0.0, 30.0), shaft=(-130.0, -110.0), groups=3, n=60000, seed=2, Cp=1.33):
    """Selective assembly (class grading): bore and piston are measured and sorted into `groups` classes of equal width
    over their tolerance; parts of the same class are assembled. Sizes normal, centred, Cp given.
    Returns clearance range per class (um), overall range, class shares of bores and pistons (mismatch = surplus)."""
    rnd = random.Random(seed)
    th, ts = hole[1] - hole[0], shaft[1] - shaft[0]
    sh, ss = th / (6 * Cp), ts / (6 * Cp)
    mh, ms = sum(hole) / 2, sum(shaft) / 2
    cls = lambda v, lo, w: min(groups - 1, max(0, int((v - lo) / w)))
    H = [cls(rnd.gauss(mh, sh), hole[0], th / groups) for _ in range(n)]
    S = [cls(rnd.gauss(ms, ss), shaft[0], ts / groups) for _ in range(n)]
    share_h = [H.count(g) / n for g in range(groups)]
    share_s = [S.count(g) / n for g in range(groups)]
    rng = []
    for g in range(groups):
        h_lo, h_hi = hole[0] + g * th / groups, hole[0] + (g + 1) * th / groups
        s_lo, s_hi = shaft[0] + g * ts / groups, shaft[0] + (g + 1) * ts / groups
        rng.append((h_lo - s_hi, h_hi - s_lo))
    unmatched = sum(abs(a - b) for a, b in zip(share_h, share_s)) / 2
    return {"groups": groups, "ranges": rng, "C_min": min(r[0] for r in rng), "C_max": max(r[1] for r in rng),
            "share_hole": share_h, "share_shaft": share_s, "unmatched": unmatched}

def st_piston_grading(groups=(1, 3, 5), hot_loss=91.6, C_hot_min=10.0, C_cold_max=120.0, t_bore=30.0, t_piston=30.0):
    """Piston / cylinder with class grading: with g classes of equal width w_b = t_bore/g and w_p = t_piston/g the
    clearance range of every class is w_b + w_p = (t_bore + t_piston)/g.
    Choose the piston offset so that the hot clearance >= C_hot_min; check the cold maximum <= C_cold_max (piston slap)."""
    out = []
    for g in groups:
        rng = (t_bore + t_piston) / g
        c_lo = C_hot_min + hot_loss
        out.append({"groups": g, "range": rng, "cold": (c_lo, c_lo + rng), "hot": (C_hot_min, C_hot_min + rng),
                    "ok": c_lo + rng <= C_cold_max})
    return out

ST_AXIAL = {   # axial play of the locating bearing A (6206) between housing shoulder and circlip (DIN 472, 62 mm bore)
    "name": "axial play of 6206 (locating bearing)", "LSL": 0.0, "USL": 0.30,
    "raw": [["shoulder -> circlip groove flank", 1, 18.10, -0.05, 0.05],
            ["bearing width B (ISO 492: 0/-0.12)", -1, 16.00, -0.12, 0.0],
            ["circlip thickness s (DIN 472: 2.0 0/-0.06)", -1, 2.00, -0.06, 0.0]]}

def st_axial_items(raw):
    out = []
    for n, s, nom, lo, hi in raw:
        m, t = st_sym(nom, lo, hi)
        out.append([n, s, m, t])
    return out

# ================================================================ chapter 6: geometric tolerancing
GD_TYPES = [   # family, characteristic, datum needed, typical use in the compressor
    ("form", "straightness", "no", "crankshaft journal axis"),
    ("form", "flatness", "no", "deck face, valve plate, gasket faces"),
    ("form", "roundness", "no", "cylinder bore, bearing seats"),
    ("form", "cylindricity", "no", "cylinder bore (taper + roundness + straightness together)"),
    ("orientation", "parallelism", "yes", "crank pin axis to main axis"),
    ("orientation", "perpendicularity", "yes", "cylinder bore axis to crank axis, deck face to bore"),
    ("orientation", "angularity", "yes", "V-bank angle of the two cylinders (90 deg)"),
    ("location", "position", "yes", "head-bolt holes, dowel holes, bearing bore pair"),
    ("location", "concentricity / coaxiality", "yes", "two main bearing bores (line bore)"),
    ("location", "symmetry", "yes", "keyway to shaft axis"),
    ("run-out", "circular run-out (radial / axial)", "yes", "bearing seats, pulley seat, shoulders"),
    ("run-out", "total run-out", "yes", "seal running surface"),
    ("profile", "profile of a line / surface", "optional", "cam contour (M6), gasket outline, free-form castings"),
]

def gd_virtual(mmc, t, internal=True):
    """Virtual condition (worst-case boundary): hole VC = MMC - t, pin VC = MMC + t (t at MMC).
    Resultant condition at LMC: hole RC = LMC + t + bonus, pin RC = LMC - t - bonus."""
    return mmc - t if internal else mmc + t

def gd_bonus_table(mmc, lmc, t, n=5, internal=True):
    return [(mmc + (lmc - mmc) * i / (n - 1), bonus(t, mmc + (lmc - mmc) * i / (n - 1), mmc, internal)) for i in range(n)]

def gd_envelope(actual, mmc, internal=False):
    """Envelope requirement (E) / Taylor principle: the feature must not cross the perfect form at MMC -> the form error
    allowed = departure of the local size from MMC (0 at MMC)."""
    return max(0.0, (actual - mmc) if internal else (mmc - actual))

def gd_projected(T, L_e, h, F=8.0):
    """Stud screwed into the block: its axis may lie anywhere in a cylinder of diameter T over the thread length L_e.
    Largest radial deviation at height h above the block face: r = T/2 + T h / L_e (tilt from one side to the other).
    Hole needed in the mating part (floating within T there too): H >= F + 2 r + T_mating (here same T)."""
    r = T / 2 + T * h / L_e
    return {"r_top": r, "H_needed": F + 2 * r + T, "H_needed_projected": F + 2 * T}

def gd_xy_area(T):
    """Square zone (+/- T/(2 sqrt 2)) inside the circle of diameter T vs the circle: area ratio pi/2 = 1.571."""
    tx = T / (2 * math.sqrt(2))
    sq = (2 * tx) ** 2
    ci = math.pi * T * T / 4
    return {"tx": tx, "square": sq, "circle": ci, "ratio": ci / sq}

GD_PATTERN = {   # 4 head-bolt holes on a 80 x 80 square (nominal) and measured positions (example CMM report, mm)
    "nominal": [(-40.0, -40.0), (40.0, -40.0), (40.0, 40.0), (-40.0, 40.0)],
    "measured": [(-39.62, -39.71), (40.36, -39.69), (40.33, 40.31), (-39.66, 40.28)],
    "T_plt": 1.0, "T_frt": 0.3}

def gd_pattern_check(pat=None):
    """Composite position: PLTZF (pattern to datums, diameter T_plt) and FRTZF (holes to each other, T_frt: the
    pattern may be translated as a whole - best fit by the mean offset). Position deviation = 2 x radial offset."""
    pat = pat or GD_PATTERN
    dev = [(mx - nx, my - ny) for (nx, ny), (mx, my) in zip(pat["nominal"], pat["measured"])]
    plt = [2 * math.hypot(dx, dy) for dx, dy in dev]
    cx = sum(d[0] for d in dev) / len(dev)
    cy = sum(d[1] for d in dev) / len(dev)
    frt = [2 * math.hypot(dx - cx, dy - cy) for dx, dy in dev]
    return {"plt": plt, "frt": frt, "shift": (cx, cy), "ok_plt": max(plt) <= pat["T_plt"], "ok_frt": max(frt) <= pat["T_frt"]}

def gd_runout(t_radial=0.010, t_axial=0.020, D_shoulder=36.0, m_rotor=4.5, n=1450.0, G=6.3, misalign_arcmin=10.0):
    """Bearing seat run-out (M3/M4): radial run-out t_r -> eccentricity e = t_r / 2 of the mounted part -> unbalance
    U = m e (g mm) vs ISO 21940-11 U_per = 9549 G m / n; axial run-out of the shoulder -> ring tilt = t_ax / D_shoulder."""
    e = t_radial / 2 * 1000                                  # um
    U = m_rotor * e                                         # g mm (kg x um = g mm)
    U_per = 9549 * G * m_rotor / n
    tilt = math.degrees(t_axial / D_shoulder) * 60          # arcmin
    return {"e_um": e, "U_gmm": U, "U_per_gmm": U_per, "share_of_Uper": U / U_per, "tilt_arcmin": tilt, "tilt_ok": tilt <= misalign_arcmin}

def gd_bore_perp(t_perp=0.030, L_ref=80.0, L_skirt=40.0, C_hot_min=18.4):
    """Perpendicularity t of the cylinder bore axis to the crank axis over the bore length L_ref -> tilt t / L_ref; the
    piston (aligned by the rod / crank) is tilted against the bore and uses L_skirt x tilt of its diametral clearance."""
    tilt = t_perp / L_ref
    used = L_skirt * tilt * 1000
    return {"tilt_mrad": tilt * 1000, "used_um": used, "left_um": C_hot_min - used, "share": used / C_hot_min}

def gd_gauge(H_mmc, T_pos, gauge_tol_pct=5.0):
    """Functional GO gauge for a hole pattern: pins at true position with diameter = virtual condition H_mmc - T_pos;
    gauge-maker tolerance (typ. 5 % of the part tolerance, check) put on the pins in the direction that makes the
    gauge stricter (absolute acceptance; Y14.43 style)."""
    vc = H_mmc - T_pos
    gt = gauge_tol_pct / 100 * T_pos
    return {"VC": vc, "pin_min": vc, "pin_max": vc + gt, "gauge_tol": gt}

def gd_zero_mmc(H_mmc, H_lmc, T, cases):
    """Zero position tolerance at MMC: hole size limits become VC ... LMC with position 0 at MMC; every (size, position)
    accepted by the original callout stays accepted, plus undersize holes with a good position."""
    vc = H_mmc - T
    out = []
    for size, pos in cases:
        orig = H_mmc <= size <= H_lmc and pos <= bonus(T, size, H_mmc)
        zero = vc <= size <= H_lmc and pos <= size - vc
        out.append((size, pos, orig, zero))
    return {"VC": vc, "cases": out}

def gd_profile_check(devs, t, bilateral=True):
    """Profile of a surface: all normal deviations must lie in a zone of width t (bilateral: +/- t/2)."""
    lo, hi = (-t / 2, t / 2) if bilateral else (0.0, t)
    bad = [d for d in devs if not lo <= d <= hi]
    return {"min": min(devs), "max": max(devs), "zone": (lo, hi), "ok": not bad, "n_bad": len(bad)}

def gd_datum_shift(datum_size, datum_mmc, internal=True):
    """Datum feature referenced at MMC (e.g. dowel hole A (M)): the pattern may shift by the departure of the datum from MMC
    (diameter value)."""
    return max(0.0, (datum_size - datum_mmc) if internal else (datum_mmc - datum_size))

# ================================================================ demo
def demo_ch56():
    st = DEFAULT["stack"]
    print("## 5.1 Loop table of the TDC gap (mm)")
    for n, s, x, t, a, b in st_loop_table(st):
        print("  %s %-42s %8.3f +/- %.3f   contributes %+9.3f ... %+9.3f" % ("+" if s > 0 else "-", n, x, t, a, b))
    s = stack(st, 100000, 1)
    print("  closing dimension G = %.3f mm; WC +/- %.3f; RSS +/- %.4f; ratio RSS / WC %.2f" % (s["G"], s["WC"], s["RSS"], s["RSS"] / s["WC"]))

    print("\n## 5.2 Modified RSS (Bender factor k)")
    for k, T in st_bender(st):
        print("  k %.1f -> +/- %.3f mm -> %.3f ... %.3f" % (k, T, s["G"] - T, s["G"] + T))

    print("\n## 5.3 Monte Carlo: distributions and mean shifts (100 000 assemblies)")
    cases = [("all normal, centred", None, None),
             ("all uniform (no process knowledge)", ["uniform"] * 6, None),
             ("all triangular", ["triangular"] * 6, None),
             ("gasket + deck skewed (beta 2,5)", ["skewed", "skewed", "normal", "normal", "normal", "normal"], None),
             ("normal, all means +0.5 t in the adverse direction", None, [-0.5, -0.5, 0.5, 0.5, 0.5, 0.5]),
             ("normal, gasket mean -0.8 t (thin gaskets)", None, [0.0, -0.8, 0.0, 0.0, 0.0, 0.0])]
    for name, d, sh in cases:
        r = st_mc(st, d, sh, 100000, 1)
        print("  %-48s mean %.4f, sd %.4f, 0.135 %% ... 99.865 %%: %.3f ... %.3f mm, out %.0f ppm" % (name, r["mean"], r["sd"], r["q_lo"], r["q_hi"], r["ppm"]))

    print("\n## 5.4 Statistical stack from process capability (each part Cp, Cpk)")
    for Cp, Cpk in ((1.0, 1.0), (1.33, 1.33), (1.33, 1.0), (2.0, 1.5), (1.0, 0.5)):
        c = st_cpk_stack(st, Cp, Cpk)
        print("  Cp %.2f Cpk %.2f: sigma %.4f, mean offset %.3f -> %.3f ... %.3f mm, z %.2f, %.2f ppm on the worse side" % (
            Cp, Cpk, c["sigma"], c["delta"], c["G_lo"], c["G_hi"], c["z_min"], c["ppm_worst_side"]))
    six = st_cpk_stack(st, 2.0, 1.5)
    print("  six-sigma rule (Cp 2, shift 1.5 sigma -> Cpk 1.5): range %.3f ... %.3f mm" % (six["G_lo"], six["G_hi"]))

    print("\n## 5.5 Nonlinear stack 1: clearance ratio c = (A gap + V_pocket) / (A s)")
    C = ST_CLEARANCE
    nl = st_nonlinear(st_clearance_ratio, C["x"], C["t"], 100000, 4)
    for nme, x, t, sv in zip(C["names"], C["x"], C["t"], nl["sens"]):
        print("  %-24s %7.3f +/- %.3f  dc/dx %+.6f  -> share %+.5f (%.1f %%)" % (nme, x, t, sv, sv * t, 100 * (sv * t) ** 2 / nl["rss"] ** 2))
    print("  c nominal %.5f; linearised RSS +/- %.5f; Monte Carlo mean %.5f, 3 sd %.5f" % (nl["f0"], nl["rss"], nl["mc_mean"], nl["mc_3sd"]))

    print("\n## 5.6 Nonlinear stack 2: desaxe offset e of the cylinder axis (r 23 +/- 0.02, l 90 +/- 0.03, e 0 +/- 0.3 mm)")
    nd = st_nonlinear(st_desaxe_tdc, [23.0, 90.0, 0.0], [0.02, 0.03, 0.3], 100000, 5)
    print("  sensitivities dy/dr %.4f, dy/dl %.4f, dy/de %.6f (zero at e = 0: invisible to linear RSS)" % tuple(nd["sens"]))
    print("  y nominal %.4f; linear RSS +/- %.4f; MC mean %.5f (bias %.5f mm), 3 sd %.4f" % (nd["f0"], nd["rss"], nd["mc_mean"], nd["bias"], nd["mc_3sd"]))
    for e in (0.3, 1.0, 2.0):
        print("  offset e %.1f mm lowers the TDC height by %.4f mm" % (e, st_desaxe_tdc([23.0, 90.0, 0.0]) - st_desaxe_tdc([23.0, 90.0, e])))

    print("\n## 5.7 Allocation of the TDC tolerance (worst case +/- 0.25 mm available, cost = b / t)")
    names = [i[0] for i in st["items"]]
    A = st_allocate_compare(names, [139.2, 0.8, 23.0, 90.0, 26.4, 1.0], ST_COST_B, 0.25)
    print("  %-42s %6s %8s %8s %8s %8s" % ("item", "b", "equal", "unit^1/3", "optimal", "RSS opt"))
    for i, nme in enumerate(names):
        print("  %-42s %6.2f %8.4f %8.4f %8.4f %8.4f" % (nme, ST_COST_B[i], A["equal"][i], A["unit"][i], A["opt"][i], A["rss"][i]))
    print("  cost (EUR per assembly, model): equal %.2f, unit %.2f, optimal WC %.2f, optimal RSS %.2f" % tuple(A["cost"][k] for k in ("equal", "unit", "opt", "rss")))
    print("  present design (t = %s): cost %.2f" % ("/".join("%.2f" % i[3] for i in st["items"]), sum(b / i[3] for b, i in zip(ST_COST_B, st["items"]))))

    print("\n## 5.8 Selective assembly of piston and cylinder (bore H7 0/+30, piston -110/-130 um, Cp 1.33)")
    for g in (1, 2, 3, 5):
        r = st_selective(groups=g)
        print("  %d class(es): clearance per class %s um, overall %.1f ... %.1f; shares bore %s / piston %s; unmatched %.1f %%" % (
            g, ", ".join("%.0f..%.0f" % c for c in r["ranges"]), r["C_min"], r["C_max"],
            "/".join("%.2f" % x for x in r["share_hole"]), "/".join("%.2f" % x for x in r["share_shaft"]), 100 * r["unmatched"]))
    print("  grading with equal 30 um tolerances (piston cheaper), hot loss 91.6 um, hot min 10 um, cold max 120 um:")
    for r in st_piston_grading():
        print("   %d class(es): clearance range %.1f um -> cold %.1f ... %.1f, hot %.1f ... %.1f um -> %s" % (
            r["groups"], r["range"], r["cold"][0], r["cold"][1], r["hot"][0], r["hot"][1], "OK" if r["ok"] else "piston slap cold"))

    print("\n## 5.9 Axial play of the locating bearing (housing shoulder - bearing - circlip)")
    ax = dict(ST_AXIAL, items=st_axial_items(ST_AXIAL["raw"]))
    sa = stack(ax, 50000, 1)
    for n, s_, x, t in ax["items"]:
        print("  %s %-44s mean %.3f +/- %.3f" % ("+" if s_ > 0 else "-", n, x, t))
    print("  play nominal %.3f mm; WC %.3f ... %.3f (%s); RSS %.3f ... %.3f (%s) for %.2f ... %.2f mm" % (
        sa["G"], sa["G_min_wc"], sa["G_max_wc"], "OK" if sa["ok"]["worst_case"] else "NOT OK", sa["G_min_rss"], sa["G_max_rss"],
        "OK" if sa["ok"]["rss"] else "NOT OK", ax["LSL"], ax["USL"]))
    ax2 = dict(ax, items=[list(i) for i in ax["items"]])
    ax2["items"][0] = ["shoulder -> groove flank 18.07 +/- 0.03", 1, 18.07, 0.03]
    sb = stack(ax2, 50000, 1)
    print("  groove 18.07 +/- 0.03: WC %.3f ... %.3f (%s)" % (sb["G_min_wc"], sb["G_max_wc"], "OK" if sb["ok"]["worst_case"] else "NOT OK"))

    print("\n## 6.1 Geometric characteristics")
    for f in GD_TYPES:
        print("  %-12s %-34s datum %-8s %s" % f)

    print("\n## 6.2 Virtual condition, bonus, envelope")
    g = DEFAULT["gdt"]
    print("  head-bolt hole 9.00 ... 9.22, position 1.0 at MMC -> virtual condition %.2f mm (= bolt diameter)" % gd_virtual(9.0, 1.0))
    for size, T in gd_bonus_table(9.0, 9.22, 1.0):
        print("    hole %.3f -> position allowed %.3f" % (size, T))
    for a in (30.011, 30.008, 30.005, 30.002):
        print("  journal 30 k5 (+0.002/+0.011) with (E): local size %.3f -> form error allowed %.3f mm" % (a, gd_envelope(a, 30.011)))

    print("\n## 6.3 Fasteners and projected tolerance zone (M8)")
    f = fastener(g["F"], g["H"])
    print("  floating (through bolts) T = %.2f per part; fixed (studs) T = %.2f per part" % (f["floating"], f["fixed_each"]))
    for h in (0.0, 10.0, 20.0, 30.0):
        p = gd_projected(0.5, 12.0, h)
        print("  stud T 0.5 over thread 12 mm, part thickness %4.1f: top deviation r %.3f -> hole needed %.2f (projected zone: %.2f)" % (h, p["r_top"], p["H_needed"], p["H_needed_projected"]))

    print("\n## 6.4 Position zone vs +/- coordinates")
    a = gd_xy_area(1.0)
    print("  circle 1.0: +/- %.3f square has area %.3f mm2, circle %.3f mm2 -> circle %.0f %% larger" % (a["tx"], a["square"], a["circle"], 100 * (a["ratio"] - 1)))
    print("  +/- 0.5 x/y coordinates allow a position error up to %.3f (diagonal)" % xy_to_position(0.5, 0.5))

    print("\n## 6.5 Composite position of the head-bolt pattern (CMM report)")
    pc = gd_pattern_check()
    for i, (a_, b_) in enumerate(zip(pc["plt"], pc["frt"])):
        print("  hole %d: position to datums %.3f (PLTZF %.1f), to the pattern %.3f (FRTZF %.1f)" % (i + 1, a_, GD_PATTERN["T_plt"], b_, GD_PATTERN["T_frt"]))
    print("  pattern shift %.3f / %.3f mm -> PLTZF %s, FRTZF %s" % (pc["shift"][0], pc["shift"][1], "OK" if pc["ok_plt"] else "NOT OK", "OK" if pc["ok_frt"] else "NOT OK"))

    print("\n## 6.6 Run-out of the bearing seats (M3 / M4)")
    for tr, ta in ((0.005, 0.010), (0.010, 0.020), (0.030, 0.050), (0.100, 0.100)):
        r = gd_runout(tr, ta)
        print("  radial %.3f / axial %.3f: e %.1f um, U %.1f g mm = %.0f %% of U_per %.1f (G6.3); ring tilt %.1f arcmin %s" % (
            tr, ta, r["e_um"], r["U_gmm"], 100 * r["share_of_Uper"], r["U_per_gmm"], r["tilt_arcmin"], "OK" if r["tilt_ok"] else "too much"))

    print("\n## 6.7 Perpendicularity of the cylinder bore to the crank axis")
    for t in (0.01, 0.02, 0.03, 0.05):
        r = gd_bore_perp(t)
        print("  t %.2f over 80 mm: tilt %.3f mrad, skirt uses %.1f um of the 18.4 um hot clearance (%.0f %%), left %.1f um" % (t, r["tilt_mrad"], r["used_um"], 100 * r["share"], r["left_um"]))

    print("\n## 6.8 Functional gauge, zero tolerance at MMC, profile, datum shift")
    gg = gd_gauge(9.0, 1.0)
    print("  GO gauge pins at true position: %.3f ... %.3f mm (gauge tolerance %.3f)" % (gg["pin_min"], gg["pin_max"], gg["gauge_tol"]))
    z = gd_zero_mmc(9.0, 9.22, 1.0, [(9.10, 1.05), (8.90, 0.85), (8.60, 0.70), (9.22, 1.20), (9.00, 1.05)])
    for size, pos, o, zz in z["cases"]:
        print("  hole %.2f, position %.2f: original callout %s, zero at MMC %s" % (size, pos, "accept" if o else "reject", "accept" if zz else "reject"))
    prof = gd_profile_check([-0.04, 0.02, 0.05, -0.06, 0.03, 0.01, -0.02], 0.10)
    print("  gasket outline profile 0.1: deviations %.2f ... %.2f -> %s (%d point(s) outside)" % (prof["min"], prof["max"], "OK" if prof["ok"] else "NOT OK", prof["n_bad"]))
    print("  dowel datum hole 8 H7 referenced at MMC, measured 8.012: pattern may shift by %.3f mm" % gd_datum_shift(8.012, 8.000))

# ================================================================ added with guide chapters (ch78)
# ---------------------------------------------------------------- chapter 7.1: process capability per process
MF_PROCESS = [   # process, best IT, normal IT, Ra best um, Ra normal um, relative cost per feature (typical - check)
    ("sawing / flame cutting", 13, 15, 6.3, 25.0, 0.5),
    ("sand casting", 14, 16, 12.5, 25.0, 0.6),
    ("die casting / investment casting", 10, 13, 1.6, 3.2, 0.8),
    ("drop forging", 13, 15, 6.3, 12.5, 0.7),
    ("sheet metal punching / bending", 10, 12, 1.6, 3.2, 0.6),
    ("drilling", 10, 12, 3.2, 6.3, 1.0),
    ("turning, rough", 10, 12, 6.3, 12.5, 1.0),
    ("turning, finish", 7, 9, 0.8, 1.6, 1.6),
    ("milling, finish", 7, 9, 0.8, 3.2, 1.8),
    ("boring (fine boring)", 6, 8, 0.4, 1.6, 2.2),
    ("reaming", 6, 8, 0.4, 1.6, 2.0),
    ("cylindrical grinding", 5, 6, 0.1, 0.4, 3.0),
    ("internal grinding", 5, 7, 0.2, 0.8, 3.5),
    ("honing", 4, 6, 0.05, 0.4, 4.0),
    ("lapping / superfinishing", 3, 5, 0.025, 0.1, 6.0),
    ("wire EDM", 6, 8, 0.4, 1.6, 5.0),
]

def mf_processes_for(D, grade):
    """Processes that hold ITgrade at nominal D: 'normal' if the normal IT is good enough, 'best' if only the best IT."""
    T = it_um(D, grade)
    out = []
    for name, best, normal, ra_b, ra_n, c in MF_PROCESS:
        state = "normal" if normal <= grade else "best only" if best <= grade else None
        if state:
            out.append({"process": name, "state": state, "Ra": ra_n if state == "normal" else ra_b, "cost": c if state == "normal" else 1.5 * c})
    return {"D": D, "grade": grade, "T_um": T, "processes": sorted(out, key=lambda r: r["cost"])}

# ---------------------------------------------------------------- chapter 7.2: cost - tolerance models
MF_COST_DATA = [(100, 1.00), (50, 1.25), (25, 1.70), (13, 2.60), (8, 3.80), (5, 6.00)]   # tolerance um, cost index (d 30 turned/ground - check)

def mf_fit_cost():
    """Least-squares fits of the cost-tolerance data: reciprocal C = a + b/t (linear in 1/t) and exponential
    C = a e^(-b t) (linear in ln C). Returns parameters and RMS error of both models."""
    t = [p[0] for p in MF_COST_DATA]
    c = [p[1] for p in MF_COST_DATA]
    n = len(t)
    def lsq(x, y):
        mx, my = sum(x) / n, sum(y) / n
        b = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y)) / sum((xi - mx) ** 2 for xi in x)
        return my - b * mx, b
    a1, b1 = lsq([1 / v for v in t], c)
    la, lb = lsq(t, [math.log(v) for v in c])
    a2, b2 = math.exp(la), -lb
    r1 = math.sqrt(sum((a1 + b1 / ti - ci) ** 2 for ti, ci in zip(t, c)) / n)
    r2 = math.sqrt(sum((a2 * math.exp(-b2 * ti) - ci) ** 2 for ti, ci in zip(t, c)) / n)
    return {"recip": (a1, b1, r1), "exp": (a2, b2, r2)}

def mf_cost_per_grade(D=30.0, grades=(5, 6, 7, 8, 9, 10, 11)):
    """Cost index of one feature per IT grade with the reciprocal model: one grade finer = tolerance / 1.6."""
    a, b, _ = mf_fit_cost()["recip"]
    rows = []
    for g in grades:
        T = it_um(D, g)
        rows.append((g, T, a + b / T))
    return rows

# ---------------------------------------------------------------- chapter 7.3: capability from a sample
def mf_sample(mean, sd, n=50, seed=7):
    rnd = random.Random(seed)
    return [rnd.gauss(mean, sd) for _ in range(n)]

def mf_capability(data, LSL, USL):
    """Cp = (USL - LSL)/(6 s), Cpk = min(USL - x, x - LSL)/(3 s), ppm out from the normal distribution."""
    n = len(data)
    m = sum(data) / n
    s = math.sqrt(sum((x - m) ** 2 for x in data) / (n - 1))
    phi = lambda z: 0.5 * math.erfc(-z / math.sqrt(2))
    ppm = 1e6 * ((1 - phi((USL - m) / s)) + phi((LSL - m) / s))
    return {"n": n, "mean": m, "s": s, "Cp": (USL - LSL) / (6 * s), "Cpk": min(USL - m, m - LSL) / (3 * s), "ppm": ppm,
            "min": min(data), "max": max(data), "out_sample": sum(1 for x in data if x < LSL or x > USL)}

# ---------------------------------------------------------------- chapter 7.4: limit gauges
MF_GAUGE = {"H": 0.15, "z": 0.15, "y": 0.10}   # gauge tolerance, GO offset inside the zone, wear allowance beyond MMC, as fraction of IT (typical style of ISO 1938 / DIN 7150 for IT6-IT8 - check)

def mf_gauges(D, zone, part):
    """GO / NO-GO gauge sizes (um from nominal). Taylor: GO gauge = full form at MMC (checks size + form together),
    NO-GO gauge = two-point at LMC. GO is made z inside the MMC limit with tolerance +/-H/2 and may wear to y beyond MMC."""
    lo, hi = zone_limits(D, zone, part)
    T = hi - lo
    H, z, y = (MF_GAUGE[k] * T for k in ("H", "z", "y"))
    if part == "hole":       # plug gauge: MMC = lower limit
        go = (lo + z - H / 2, lo + z + H / 2)
        wear = lo - y
        nogo = (hi - H / 2, hi + H / 2)
    else:                    # ring / snap gauge: MMC = upper limit
        go = (hi - z - H / 2, hi - z + H / 2)
        wear = hi + y
        nogo = (lo - H / 2, lo + H / 2)
    return {"D": D, "zone": zone, "part": part, "lo": lo, "hi": hi, "T": T, "H": H, "z": z, "y": y, "GO": go, "GO_wear_limit": wear, "NOGO": nogo,
            "lost_tol_pct": 100 * (z + H / 2 + H / 2) / T}

# ---------------------------------------------------------------- chapter 7.5: uncertainty budget and guard band
def mf_uncertainty(L=30.0, res=1.0, s_rep=0.6, U_cal=0.8, dT=2.0, alpha_part=11.5e-6, alpha_gauge=11.5e-6, d_alpha_unc=1.0e-6, T_dev=3.0):
    """GUM budget (um): resolution res/sqrt(12); repeatability s; calibration U_cal/2 (k=2); temperature: deviation
    T_dev from 20 C with alpha difference + uncertainty of the alpha (rectangular). U = 2 u_c."""
    L_um = L * 1000
    comps = [("resolution", res / math.sqrt(12)), ("repeatability", s_rep), ("calibration of the standard", U_cal / 2),
             ("temperature difference part - gauge (+/-%.1f K)" % dT, L_um * alpha_part * dT / math.sqrt(3)),
             ("alpha mismatch at %.1f K from 20 C" % T_dev, L_um * (abs(alpha_part - alpha_gauge) + d_alpha_unc) * T_dev / math.sqrt(3))]
    uc = math.sqrt(sum(u * u for _, u in comps))
    return {"comps": comps, "u_c": uc, "U": 2 * uc}

def mf_guard_band(lo, hi, U):
    """ISO 14253-1: proof of conformance only inside [lo + U, hi - U]; the supplier loses 2U of the tolerance."""
    return {"accept": (lo + U, hi - U), "T": hi - lo, "T_conf": max(0.0, hi - lo - 2 * U), "ratio_T_U": (hi - lo) / U,
            "loss_pct": 100 * min(1.0, 2 * U / (hi - lo))}

# ---------------------------------------------------------------- chapter 7.6: gauge R&R (average and range method)
MF_K = {"K1_2trials": 0.8862, "K2_3ops": 0.5231, "K3_10parts": 0.3146}   # AIAG MSA constants (1/d2*)

def mf_grr_study(T_um, sd_part=4.0, sd_rep=0.5, sd_op=0.3, parts=10, ops=3, trials=2, seed=11):
    """Simulated study: true part sizes ~ N(0, sd_part); operator bias ~ N(0, sd_op); repeatability ~ N(0, sd_rep).
    EV = R_bar K1, AV = sqrt((X_diff K2)^2 - EV^2/(n r)), GRR = sqrt(EV^2 + AV^2), PV = R_p K3, TV = sqrt(GRR^2 + PV^2);
    %GRR of tolerance = 6 GRR / T, ndc = 1.41 PV / GRR."""
    rnd = random.Random(seed)
    true = [rnd.gauss(0, sd_part) for _ in range(parts)]
    bias = [rnd.gauss(0, sd_op) for _ in range(ops)]
    m = [[[true[p] + bias[o] + rnd.gauss(0, sd_rep) for _ in range(trials)] for p in range(parts)] for o in range(ops)]
    R_bar = sum(max(m[o][p]) - min(m[o][p]) for o in range(ops) for p in range(parts)) / (ops * parts)
    op_means = [sum(sum(m[o][p]) for p in range(parts)) / (parts * trials) for o in range(ops)]
    part_means = [sum(sum(m[o][p]) for o in range(ops)) / (ops * trials) for p in range(parts)]
    EV = R_bar * MF_K["K1_2trials"]
    AV = math.sqrt(max(0.0, ((max(op_means) - min(op_means)) * MF_K["K2_3ops"]) ** 2 - EV ** 2 / (parts * trials)))
    GRR = math.hypot(EV, AV)
    PV = (max(part_means) - min(part_means)) * MF_K["K3_10parts"]
    TV = math.hypot(GRR, PV)
    return {"EV": EV, "AV": AV, "GRR": GRR, "PV": PV, "TV": TV, "pct_tol": 100 * 6 * GRR / T_um, "pct_TV": 100 * GRR / TV, "ndc": 1.41 * PV / GRR}

# ---------------------------------------------------------------- chapter 7.7: SPC X-bar / R chart
MF_SPC = {5: {"A2": 0.577, "D3": 0.0, "D4": 2.114, "d2": 2.326}}

def mf_spc(mean, sd, k=20, n=5, seed=3, shift_at=None, shift=0.0):
    """Control limits from k subgroups of n: X-bar chart X_bar_bar +/- A2 R_bar, R chart D3 R_bar ... D4 R_bar;
    sigma = R_bar / d2. Optional mean shift from subgroup shift_at on (to show an out-of-control signal); the limits
    are then computed from the subgroups before the shift (phase I) and applied to all (phase II)."""
    c = MF_SPC[n]
    rnd = random.Random(seed)
    groups = []
    for i in range(k):
        mu = mean + (shift if shift_at is not None and i >= shift_at else 0.0)
        groups.append([rnd.gauss(mu, sd) for _ in range(n)])
    xb = [sum(g) / n for g in groups]
    R = [max(g) - min(g) for g in groups]
    m = shift_at if shift_at else k                       # limits from the stable phase only (phase I), then applied
    xbb, Rb = sum(xb[:m]) / m, sum(R[:m]) / m
    lim = {"UCLx": xbb + c["A2"] * Rb, "LCLx": xbb - c["A2"] * Rb, "UCLr": c["D4"] * Rb, "LCLr": c["D3"] * Rb}
    out = [i + 1 for i, x in enumerate(xb) if not lim["LCLx"] <= x <= lim["UCLx"]]
    return {"xbb": xbb, "Rb": Rb, "sigma": Rb / c["d2"], "lim": lim, "xbar": xb, "R": R, "out": out}

# ---------------------------------------------------------------- chapter 7.8: reference temperature 20 C
def mf_warm_part(L, T_part, alpha_part, T_gauge=20.0, alpha_gauge=11.5e-6):
    """Reading error (um) when a part at T_part is measured with a steel gauge at T_gauge (ISO 1: sizes are defined at
    20 C): e = L (alpha_part (T_part - 20) - alpha_gauge (T_gauge - 20))."""
    return L * 1000 * (alpha_part * (T_part - 20) - alpha_gauge * (T_gauge - 20))

# ---------------------------------------------------------------- chapter 7.9: roughness vs IT
def mf_roughness(D, grade, k_rz=0.2):
    """Rule of thumb: Rz <= k IT (k 0.1 ... 0.25; fits finer than IT7 rather 0.1), Ra ~ Rz / 5 (turned / ground, check);
    and the smoothing loss 0.8 Rz per surface of DIN 7190 for comparison."""
    T = it_um(D, grade)
    Rz = k_rz * T
    return {"T": T, "Rz_max": Rz, "Ra_max": Rz / 5, "smoothing_um": 0.8 * Rz}

MF_RA_SERIES = [0.025, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 6.3, 12.5, 25.0]

def mf_ra_callout(Ra):
    """Next finer value of the preferred Ra series (ISO 1302 style) for the drawing."""
    return max((r for r in MF_RA_SERIES if r <= Ra), default=MF_RA_SERIES[0])

# ---------------------------------------------------------------- chapter 7.10: grinding allowance after heat treatment
def mf_grind_allowance(D, T_prev_um, Rz_prev=12.5, defect_um=20.0, distortion_um=30.0):
    """Minimum diametral stock for grinding: z_min = 2 (Rz_prev + defect layer + distortion (run-out / bending)) and
    the stock varies by the previous tolerance: z_max = z_min + T_prev (typical method, check with the shop)."""
    zmin = 2 * (Rz_prev + defect_um + distortion_um)
    return {"D": D, "z_min": zmin, "z_max": zmin + T_prev_um, "turn_to": "%.3f ... %.3f" % (D + zmin / 1000, D + (zmin + T_prev_um) / 1000)}

# ---------------------------------------------------------------- chapter 7.11: routes of the compressor seats
MF_ROUTES = [   # feature, nominal, zone, part, operations (name, IT reached), final Ra required
    ("6206 seat on crankshaft", 30.0, "k5", "shaft", [("turn rough", 11), ("turn finish (leave 0.3 mm)", 9), ("induction harden journal (optional)", 9), ("cylindrical grind", 5)], 0.4),
    ("6206 bore in crankcase", 62.0, "H7", "hole", [("rough bore", 11), ("fine bore (one set-up with the 2nd bore)", 7)], 0.8),
    ("cylinder bore", 65.0, "H7", "hole", [("rough bore", 11), ("fine bore", 8), ("plateau honing", 6)], 0.4),
    ("small-end bush bore", 18.0, "H7", "hole", [("press bush in", 11), ("fine bore / ream after pressing", 7)], 0.8),
    ("pulley seat", 25.0, "k6", "shaft", [("turn rough", 11), ("turn finish", 8), ("cylindrical grind", 6)], 0.8),
    ("press-fit seat", 30.0, "s6", "shaft", [("turn rough", 11), ("turn finish", 8), ("cylindrical grind", 6)], 0.8),
]

def mf_routes():
    rows = []
    for name, D, zone, part, ops, ra in MF_ROUTES:
        g = parse_zone(zone)[1] if not zone.startswith(("brg", "dev")) else 7
        last = ops[-1][1]
        rows.append({"feature": name, "D": D, "zone": zone, "IT_needed": g, "T": it_um(D, g), "ops": ops, "IT_reached": last, "ok": last <= g, "Ra": ra})
    return rows

MF_DRAWING_CHECK = [
    "every functional size has a tolerance: ISO zone (30 k5) or limits; all others covered by the general tolerance note 'ISO 2768-mK'",
    "independency principle (ISO 8015) is the default: write (E) where size must also control form (fits!) or use GO gauges",
    "datums (ISO 5459) are the functional surfaces - bearing seats for run-out, mating face for position",
    "geometric tolerances smaller than the size tolerance where form matters (cylindricity of bearing seats ~ IT5/2)",
    "roughness on every fitted surface (Ra or Rz), consistent with the IT grade",
    "heat treatment note with hardness, depth and where; grinding allowance on the turned drawing",
    "fit table on the assembly drawing with clearance / interference limits and assembly method (press / shrink temperature)",
    "measurement at 20 C or with a temperature correction; inspection characteristic marked (CTQ) where Cpk is required",
]

# ---------------------------------------------------------------- chapter 8: shrink options, worked example
def mf_shrink_options(pf, T_hub_max=150.0, T_room=20.0, T_cold=(-78.0, -196.0), alpha_shaft=11.5e-6):
    """Assembly temperature needed: interference + assembly clearance 0.001 d must come from heating the hub and / or
    cooling the shaft. Case-hardened gears must stay below about 150 ... 180 C (tempering temperature - check)."""
    R = press_fit_check(pf)
    need = R["U_max"] / 1000 + 0.001 * pf["d"]
    hub_only = need / (pf["alpha_hub"] * pf["d"])
    rows = [("heat hub only", hub_only + T_room, None, hub_only + T_room <= T_hub_max)]
    for Tc in T_cold:
        shrink_shaft = pf["d"] * alpha_shaft * 0.8 * (T_room - Tc)   # alpha falls at low temperature (~0.8 mean factor, check)
        rest = max(0.0, need - shrink_shaft)
        Th = rest / (pf["alpha_hub"] * pf["d"]) + T_room
        rows.append(("cool shaft to %g C + heat hub" % Tc, Th, Tc, Th <= T_hub_max))
    return {"need_mm": need, "rows": rows, "press_kN": R["press_force_kN"]}

def mf_example_params():
    here = os.path.dirname(os.path.abspath(__file__))
    for p in (os.path.join(here, "examples", "tol_example.json"), os.path.join(here, "tol_example.json")):
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                return dict(DEFAULT, **json.load(f))
    raise FileNotFoundError("tol_example.json")

def mf_example_options(P):
    """Decisions of the worked example: floating outer-ring zone (hot), press-fit candidates, axial play by shim."""
    fd = P["fits"][1]
    zones = []
    for h in ("H7", "G7", "F7"):
        r = fit_report(dict(fd, hole=h))
        zones.append((h, r["C_min"], r["C_max"], r["C_min_hot"], r["C_max_hot"]))
    pf = P["pressfit"]
    press = []
    for f_ in ("H7/r6", "H7/s6", "H7/u6"):
        R = press_fit_check(dict(pf, fit=f_))
        press.append((f_, R["U_min"], R["U_max"], R["lo"]["T_Nm"], R["S_slip"], R["hi"]["S_hub"], all(R["ok"].values())))
    st = P["stack"]
    tight = dict(st, items=[list(i) for i in st["items"]])
    tight["items"][0][3] = 0.05
    s_t = stack(tight, 20000, 1)
    step, meas = 0.05, 0.01                                          # shim steps 0.05 mm, measuring uncertainty
    shim = {"T": step / 2 + meas, "range": (st["LSL"], st["USL"])}
    return {"zones": zones, "press": press, "tight": s_t, "shim": shim}

# ---------------------------------------------------------------- demo
def demo_ch78():
    P = dict(DEFAULT)
    print("## 7.1 Process capability per process (typical - check)")
    for name, best, normal, ra_b, ra_n, c in MF_PROCESS:
        print("  %-34s IT%-2d best / IT%-2d normal, Ra %5.3g / %5.3g um, cost %.1f" % (name, best, normal, ra_b, ra_n, c))
    for D, g in ((30, 5), (65, 7), (139.2, 11)):
        r = mf_processes_for(D, g)
        print("  IT%d at %g mm (T %g um): %s" % (g, D, r["T_um"], "; ".join("%s (%s, Ra %g)" % (x["process"], x["state"], x["Ra"]) for x in r["processes"][:4])))
    print("\n## 7.2 Cost - tolerance models (data: d 30, turned / ground - check)")
    cf = mf_fit_cost()
    print("  reciprocal C = %.3f + %.2f / t   (RMS %.3f)" % cf["recip"])
    print("  exponential C = %.3f exp(-%.4f t) (RMS %.3f)" % cf["exp"])
    rows = mf_cost_per_grade()
    for g, T, c in rows:
        print("  IT%-2d T %4g um -> cost index %.2f" % (g, T, c))
    print("  one grade finer at IT6 -> IT5: + %.0f %% cost" % (100 * (rows[0][2] / rows[1][2] - 1)))
    print("\n## 7.3 Capability of the k5 seat from a sample of 50 (simulated measurements, um)")
    lo, hi = zone_limits(30, "k5", "shaft")
    for label, m, sd in (("centred process", 6.5, 1.0), ("shifted process", 9.0, 1.0), ("wide process", 6.5, 1.9)):
        c = mf_capability(mf_sample(m, sd), lo, hi)
        print("  %-16s mean %5.2f s %4.2f -> Cp %.2f, Cpk %.2f, %7.0f ppm (sample %d out, %5.2f ... %5.2f)" % (
            label, c["mean"], c["s"], c["Cp"], c["Cpk"], c["ppm"], c["out_sample"], c["min"], c["max"]))
    print("\n## 7.4 Limit gauges (Taylor principle; H %.2f IT, z %.2f IT, y %.2f IT - check ISO 1938)" % (MF_GAUGE["H"], MF_GAUGE["z"], MF_GAUGE["y"]))
    for D, z, part in ((62, "H7", "hole"), (65, "H7", "hole"), (18, "H7", "hole"), (30, "k5", "shaft"), (30, "s6", "shaft")):
        g = mf_gauges(D, z, part)
        print("  %3g %-3s %-5s zone %+5.1f ... %+5.1f: GO %+6.2f ... %+6.2f (wear limit %+6.2f), NO-GO %+6.2f ... %+6.2f um; tolerance lost to gauging %.0f %%" % (
            D, z, part, g["lo"], g["hi"], g["GO"][0], g["GO"][1], g["GO_wear_limit"], g["NOGO"][0], g["NOGO"][1], g["lost_tol_pct"]))
    print("\n## 7.5 Measurement uncertainty and guard band (k5 at 30, T = %g um)" % (hi - lo))
    for label, kw in (("digital micrometer 1 um", {}), ("dial snap gauge 0.5 um, set to a gauge block", {"res": 0.5, "s_rep": 0.3, "U_cal": 0.3}),
                      ("micrometer on a warm part (+8 K, no correction)", {"T_dev": 8.0, "dT": 8.0})):
        u = mf_uncertainty(**kw)
        gb = mf_guard_band(lo, hi, u["U"])
        print("  %s: U = %.2f um (k = 2) -> accept %+.2f ... %+.2f, T/U %.1f, %.0f %% of the tolerance lost" % (
            label, u["U"], gb["accept"][0], gb["accept"][1], gb["ratio_T_U"], gb["loss_pct"]))
        if label.startswith("digital"):
            for n, v in u["comps"]:
                print("    %-48s u %.3f um" % (n, v))
    print("\n## 7.6 Gauge R&R, 10 parts x 3 operators x 2 trials (simulated, average-range method)")
    for label, rep in (("snap gauge (repeatability 0.5 um)", 0.5), ("hand micrometer (repeatability 1.5 um)", 1.5)):
        g = mf_grr_study(hi - lo, sd_rep=rep)
        print("  %s: EV %.2f, AV %.2f, GRR %.2f, PV %.2f um -> %%GRR of tolerance %.0f %%, of TV %.0f %%, ndc %.1f" % (
            label, g["EV"], g["AV"], g["GRR"], g["PV"], g["pct_tol"], g["pct_TV"], g["ndc"]))
    print("\n## 7.7 SPC X-bar / R chart of the k5 seat (subgroups of 5)")
    for label, kw in (("stable process", {}), ("wheel wear: +2 um shift from subgroup 14", {"shift_at": 13, "shift": 2.0})):
        s = mf_spc(6.5, 1.0, **kw)
        print("  %s: X-bar-bar %.2f, R-bar %.2f, sigma %.2f um; X-bar limits %.2f ... %.2f, R limits %.2f ... %.2f; out of control: %s" % (
            label, s["xbb"], s["Rb"], s["sigma"], s["lim"]["LCLx"], s["lim"]["UCLx"], s["lim"]["LCLr"], s["lim"]["UCLr"], s["out"] or "none"))
    print("\n## 7.8 Reference temperature 20 C (ISO 1)")
    for label, L, T, a in (("steel shaft 30 mm at 28 C", 30, 28, 11.5e-6), ("aluminium piston 65 mm at 26 C (steel gauge at 20 C)", 65, 26, 23e-6),
                           ("cast-iron crankcase bore 62 mm at 35 C after machining", 62, 35, 11e-6)):
        e = mf_warm_part(L, T, a)
        print("  %-54s reading error %+.1f um" % (label, e))
    print("\n## 7.9 Roughness vs IT (Rz <= 0.2 IT, Ra ~ Rz/5 - check)")
    for D, g, name in ((30, 5, "6206 seat k5"), (62, 7, "crankcase bore H7"), (65, 7, "cylinder H7"), (30, 6, "press-fit seat s6")):
        r = mf_roughness(D, g)
        print("  %-18s IT%d %3g um: Rz <= %.1f, Ra <= %.2f -> drawing Ra %g; smoothing loss of this Rz %.1f um" % (
            name, g, r["T"], r["Rz_max"], r["Ra_max"], mf_ra_callout(r["Ra_max"]), r["smoothing_um"]))
    print("\n## 7.10 Grinding allowance after induction hardening (crank journal 30 k5)")
    for dist in (15.0, 30.0, 60.0):
        a = mf_grind_allowance(30.0, it_um(30, 9), distortion_um=dist)
        print("  distortion %2.0f um: stock on diameter %.0f ... %.0f um -> turn to %s mm" % (dist, a["z_min"], a["z_max"], a["turn_to"]))
    print("\n## 7.11 Machining routes of the compressor seats")
    for r in mf_routes():
        print("  %-24s %4g %-3s (IT%d, %g um, Ra %g): %s -> IT%d %s" % (r["feature"], r["D"], r["zone"], r["IT_needed"], r["T"], r["Ra"],
              " > ".join("%s IT%d" % o for o in r["ops"]), r["IT_reached"], "OK" if r["ok"] else "NOT OK"))
    print("\n## 7.12 Drawing check list")
    for i, t in enumerate(MF_DRAWING_CHECK, 1):
        print("  %d. %s" % (i, t))
    print("\n## 8.1 Verification (python tol.py selftest)")
    cmd_selftest()
    print("\n## 8.2 Worked example: gearbox intermediate shaft (examples/tol_example.json)")
    E = mf_example_params()
    print(report_text(E))
    print("\n## 8.3 Decisions of the worked example")
    o = mf_example_options(E)
    for h, a, b, c, d in o["zones"]:
        print("  floating 6207 outer ring %s: cold %+.1f ... %+.1f, hot %+.1f ... %+.1f um" % (h, a, b, c, d))
    for f_, umin, umax, T, S, Sh, ok in o["press"]:
        print("  gear hub %s: U %g ... %g um, torque at U_min %.0f N m (S %.2f), hub S %.2f -> %s" % (f_, umin, umax, T, S, Sh, "OK" if ok else "NOT OK"))
    t = o["tight"]
    print("  axial play with housing width +/-0.05: worst case %.3f ... %.3f, RSS %.3f ... %.3f mm" % (t["G_min_wc"], t["G_max_wc"], t["G_min_rss"], t["G_max_rss"]))
    print("  axial play with a shim (steps 0.05 mm, measuring 0.01 mm): play = target +/- %.3f mm -> 0.30 +/- %.3f inside %.2f ... %.2f" % (
        o["shim"]["T"], o["shim"]["T"], o["shim"]["range"][0], o["shim"]["range"][1]))
    sh = mf_shrink_options(E["pressfit"])
    print("  assembly of the gear (needs %.3f mm diametral expansion): press-in up to %.1f kN, or" % (sh["need_mm"], sh["press_kN"]))
    for name, Th, Tc, ok in sh["rows"]:
        print("    %-34s hub at %5.0f C -> %s" % (name, Th, "OK (<= 150 C for a case-hardened gear)" if ok else "too hot for a case-hardened gear"))

def cmd_examples():
    P = dict(DEFAULT)
    print(report_text(P))
    print("\n## ISO 286 check values (um)")
    for D, z in ((25, "H7"), (25, "g6"), (40, "K6"), (25, "N7"), (25, "S7"), (25, "F8"), (25, "js7"), (100, "H8"), (100, "f7"), (250, "u6")):
        part = "hole" if z[0].isupper() else "shaft"
        lo, hi = zone_limits(D, z, part)
        print("  %3d %-4s %+6g / %+6g" % (D, z, hi, lo))
    print("\n## IT values: table vs formula i = 0.45 D^(1/3) + 0.001 D (D 25 mm)")
    print("  " + "  ".join("IT%d %g/%.1f" % (g, it_um(25, g), it_formula(25, g)) for g in (5, 6, 7, 8, 9, 10, 11)))
    print("\n## Fit finder: d 30, clearance 10 ... 60 um")
    for r in fit_finder(30, 10, 60)[:8]:
        print("  %-9s C %+5.0f ... %+5.0f um%s" % (r["pair"], r["C_min"], r["C_max"], "  (preferred)" if r["preferred"] else ""))
    print("\n## ISO 2768-1 m: " + ", ".join("%g mm +/-%g" % (L, general_tol(L)) for L in (5, 25, 65, 139.2, 500)))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-66s %s %s" % (name, "OK  " if cond else "FAIL", info))
    F = fit(25, "H7", "g6")
    chk("H7/g6 at 25 mm: clearance +7 ... +41 um (ISO 286-2)", F["C_min"] == 7 and F["C_max"] == 41)
    chk("hole K6 at 40: +3/-13, N7 at 25: -7/-28, S7 at 25: -27/-48 (Delta rule)",
        hole_limits(40, "K", 6) == (-13, 3) and hole_limits(25, "N", 7) == (-28, -7) and hole_limits(25, "S", 7) == (-48, -27))
    a, b = fit(25, "H7", "p6"), fit(25, "P7", "h6")
    chk("hole basis H7/p6 = shaft basis P7/h6 (same limits of clearance)", a["C_min"] == b["C_min"] and a["C_max"] == b["C_max"], "%g ... %g" % (a["C_min"], a["C_max"]))
    dev = max(abs(it_formula(D, g) / it_um(D, g) - 1) for D in (5, 25, 65, 150, 450) for g in (6, 7, 8, 9, 10, 11))
    chk("IT table = formula k x i within rounding (< 12 %)", dev < 0.12, "max %.1f %%" % (100 * dev))
    chk("js7 at 25 = +/-10 (IT7 = 21 odd -> rounded down)", shaft_limits(25, "js", 7) == (-10, 10))
    # Lame: radial displacement compatibility u_hub(+) - u_shaft(-) = U_w / 2
    pf = dict(DEFAULT["pressfit"], di_shaft=10.0, E_hub=120000.0)
    r = press_fit(pf, 50.0)
    a_, b_ = pf["d"] / 2, pf["D_hub"] / 2
    u_h = r["p"] * a_ / pf["E_hub"] * ((b_ ** 2 + a_ ** 2) / (b_ ** 2 - a_ ** 2) + pf["nu_hub"])
    c_ = pf["di_shaft"] / 2
    u_s = -r["p"] * a_ / pf["E_shaft"] * ((a_ ** 2 + c_ ** 2) / (a_ ** 2 - c_ ** 2) - pf["nu_shaft"])
    chk("Lame: u_hub - u_shaft = effective interference / 2 (hollow shaft, two E)", abs((u_h - u_s) * 2 * 1000 / r["U_w"] - 1) < 1e-9)
    st = stack(DEFAULT["stack"], 100000, 3)
    chk("stack: Monte Carlo sd (normal) = RSS / 3 within 1 %", abs(st["mc"]["normal"]["sd"] / (st["RSS"] / 3) - 1) < 0.01, "%.4f / %.4f" % (st["mc"]["normal"]["sd"], st["RSS"] / 3))
    chk("stack: uniform MC sd = sqrt(sum t^2 / 3)", abs(st["mc"]["uniform"]["sd"] / math.sqrt(sum(t * t for *_, t in DEFAULT["stack"]["items"]) / 3) - 1) < 0.01)
    b = [4.0, 1.0, 9.0]
    A = allocate(b, 0.3)
    eq = sum(x / 0.1 for x in b)
    chk("allocation: sum t = T and cheaper than equal split", abs(sum(A["t"]) - 0.3) < 1e-12 and A["cost"] < eq, "%.1f < %.1f" % (A["cost"], eq))
    p = fit(30, "H7", "k6")
    z = (0 - p["C_mean"]) / p["sd"]
    chk("transition fit: P(interference) = Phi(-mean / sd)", abs(p["P_interference"] - 0.5 * (1 + math.erf(z / math.sqrt(2)))) < 1e-12)
    chk("floating fastener 8 / 9: T = 1.0; fixed 0.5 per part", fastener(8.0, 9.0) == {"floating": 1.0, "fixed_each": 0.5})
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
    elif cmd == "fit" and len(argv) >= 4:
        F = fit_pair(float(argv[3]), argv[2])
        print("%s at %s mm: hole %+g/%+g um, shaft %+g/%+g um -> C %+g ... %+g um (%s), P(interference) %.2f %%" % (
            argv[2], argv[3], F["ES"], F["EI"], F["es"], F["ei"], F["C_min"], F["C_max"], F["type"], 100 * F["P_interference"]))
    elif cmd in ("ch24", "ch56", "ch78") and ("demo_" + cmd) in globals():
        globals()["demo_" + cmd]()
    elif cmd == "selftest":
        return cmd_selftest()
    elif cmd == "run":
        P = dict(DEFAULT)
        out = "tol_out"
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
