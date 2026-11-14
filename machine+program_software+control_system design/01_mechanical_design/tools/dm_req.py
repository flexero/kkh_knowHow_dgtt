#!/usr/bin/env python3
"""Requirements, load spectra, axiomatic design, creativity counts and decision methods.
Backs guide M1 Part B chapters 17-20 (examples R1..R14). Python standard library only (offline).

Usage:
  python dm_req.py examples     # print all worked examples of chapters 17-20
  python dm_req.py selftest     # check them (prints SELFTEST PASS)
All numbers are EXAMPLE values.
"""
import itertools
import math
import sys
from statistics import NormalDist

# ======================================================= 17 requirements + loads
def kano_coeff(A, O, M, I):
    """Kano satisfaction coefficients (Berger et al.): counts of answers Attractive, One-dimensional,
    Must-be, Indifferent. Better = (A+O)/(A+O+M+I), Worse = -(O+M)/(A+O+M+I)."""
    s = A + O + M + I
    return {"better": (A + O) / s, "worse": -(O + M) / s}

def qfd(cust_w, rel):
    """House of Quality. cust_w: list of customer importance (1..5); rel: matrix rows = customer needs,
    columns = engineering characteristics, entries 0/1/3/9. Returns absolute and relative (%) importance."""
    ncol = len(rel[0])
    absw = [sum(cust_w[i] * rel[i][j] for i in range(len(cust_w))) for j in range(ncol)]
    tot = sum(absw)
    return absw, [100.0 * a / tot for a in absw]

def reversals(x):
    """Keep only peaks and valleys (turning points), incl. first and last point."""
    out = [x[0]]
    for i in range(1, len(x) - 1):
        if (x[i] - out[-1]) * (x[i + 1] - x[i]) < 0:
            out.append(x[i])
        elif x[i] == out[-1]:
            continue
    out.append(x[-1])
    # remove points that are not turning points after the reduction
    red = [out[0]]
    for v in out[1:]:
        if len(red) >= 2 and (red[-1] - red[-2]) * (v - red[-1]) >= 0:
            red[-1] = v
        else:
            red.append(v)
    return red

def rainflow(x):
    """ASTM E1049-85 rainflow counting (3-point method with residue as half cycles).
    Returns list of (range, mean, count) with count 0.5 or 1.0."""
    stack, out = [], []
    for p in reversals(x):
        stack.append(p)
        while len(stack) >= 3:
            X = abs(stack[-1] - stack[-2])
            Y = abs(stack[-2] - stack[-3])
            if X < Y:
                break
            if len(stack) == 3:          # Y contains the starting point -> half cycle
                out.append((Y, (stack[0] + stack[1]) / 2, 0.5))
                stack.pop(0)
            else:                        # full cycle, remove both points of Y
                out.append((Y, (stack[-2] + stack[-3]) / 2, 1.0))
                last = stack.pop()
                stack.pop()
                stack.pop()
                stack.append(last)
    for i in range(len(stack) - 1):
        out.append((abs(stack[i + 1] - stack[i]), (stack[i + 1] + stack[i]) / 2, 0.5))
    return out

def rainflow_table(cycles):
    t = {}
    for r, m, c in cycles:
        t[r] = t.get(r, 0) + c
    return dict(sorted(t.items()))

def equivalent_load(n, L, k):
    """Damage-equivalent load L_eq = (sum n_i L_i^k / sum n_i)^(1/k)."""
    return (sum(ni * Li ** k for ni, Li in zip(n, L)) / sum(n)) ** (1.0 / k)

# ISO 6336 / DIN 3990 informative application-factor table (driving x driven machine).
KA_TABLE = {
    "uniform":        {"uniform": 1.00, "light": 1.25, "moderate": 1.50, "heavy": 1.75},
    "light":          {"uniform": 1.10, "light": 1.35, "moderate": 1.60, "heavy": 1.85},
    "moderate":       {"uniform": 1.25, "light": 1.50, "moderate": 1.75, "heavy": 2.00},
    "heavy":          {"uniform": 1.50, "light": 1.75, "moderate": 2.00, "heavy": 2.25},
}

def compressor_loads(bore=65.0, stroke=46.0, pg=0.8, rpm=1450, ncyl=2, fad_m3h=20.0,
                     n_poly=1.30, eta_mech=0.85, p_atm=0.101325, m_rec=0.35, l_rod=90.0):
    """Basic load data of a single-stage reciprocating air compressor (example values).
    bore, stroke, l_rod mm; pg gauge MPa; m_rec reciprocating mass per cylinder kg."""
    A = math.pi / 4 * bore ** 2                       # mm2
    Vs = A * stroke * 1e-6                            # litre per cylinder (mm3 -> L)
    Vth = Vs * ncyl * rpm * 60 / 1000                 # m3/h theoretical displacement
    lam_v = fad_m3h / Vth                             # volumetric efficiency
    F_gas = pg * A                                    # N (gauge pressure x area)
    pi = (pg + p_atm) / p_atm                         # pressure ratio
    Q = fad_m3h / 3600                                # m3/s at suction state
    P_ind = n_poly / (n_poly - 1) * p_atm * 1e6 * Q * (pi ** ((n_poly - 1) / n_poly) - 1)  # W
    P_shaft = P_ind / eta_mech
    w = rpm * 2 * math.pi / 60
    T_mean = P_shaft / w
    r = stroke / 2
    lam = r / l_rod
    F_in = m_rec * r / 1000 * w ** 2 * (1 + lam)      # N, max inertia force at TDC
    T_peak_bound = F_gas * r / 1000                   # N*m upper bound F*r
    return {"A_mm2": A, "Vs_L": Vs, "Vth_m3h": Vth, "lambda_v": lam_v, "F_gas_N": F_gas,
            "pressure_ratio": pi, "P_ind_W": P_ind, "P_shaft_W": P_shaft, "omega": w,
            "T_mean_Nm": T_mean, "lambda_rod": lam, "F_inertia_N": F_in, "T_peak_bound_Nm": T_peak_bound,
            "f_rot_Hz": rpm / 60}

# ======================================================= 18 axiomatic design
def design_matrix_type(A):
    """Classify a square design matrix (entries 0 / non-zero): uncoupled, decoupled (triangular after a
    permutation of FR/DP pairs) or coupled. Returns (type, order) order = DP setting sequence."""
    n = len(A)
    nz = [[1 if A[i][j] else 0 for j in range(n)] for i in range(n)]
    if all(nz[i][j] == 0 for i in range(n) for j in range(n) if i != j):
        return "uncoupled", list(range(n))
    for perm in itertools.permutations(range(n)):
        if all(nz[perm[i]][perm[j]] == 0 for i in range(n) for j in range(i + 1, n)):
            return "decoupled", list(perm)
    return "coupled", None

def info_uniform(design_lo, design_hi, sys_lo, sys_hi):
    """Information content for a uniform system pdf: P = common range / system range, I = log2(1/P)."""
    common = max(0.0, min(design_hi, sys_hi) - max(design_lo, sys_lo))
    P = common / (sys_hi - sys_lo)
    return P, (math.inf if P == 0 else math.log2(1 / P))

def info_normal(lsl, usl, mu, sigma):
    """Information content for a normal process: P = Phi((USL-mu)/s) - Phi((LSL-mu)/s)."""
    nd = NormalDist(mu, sigma)
    P = nd.cdf(usl) - nd.cdf(lsl)
    return P, math.log2(1 / P)

# ======================================================= 19 creativity
def morph_count(options, incompatible=()):
    """Morphological box: options = list of lists; incompatible = set of frozensets of (row, option) pairs.
    Returns (total combinations, compatible combinations)."""
    total = math.prod(len(o) for o in options)
    inc = [frozenset(p) for p in incompatible]
    ok = 0
    for combo in itertools.product(*[range(len(o)) for o in options]):
        chosen = {(r, c) for r, c in enumerate(combo)}
        if not any(p <= chosen for p in inc):
            ok += 1
    return total, ok

# ======================================================= 20 evaluation + decision
RI = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49}

def ahp(M, it=200):
    """AHP: principal eigenvector by power iteration, lambda_max, CI, CR (Saaty RI)."""
    n = len(M)
    w = [1.0 / n] * n
    for _ in range(it):
        v = [sum(M[i][j] * w[j] for j in range(n)) for i in range(n)]
        s = sum(v)
        w = [x / s for x in v]
    Mw = [sum(M[i][j] * w[j] for j in range(n)) for i in range(n)]
    lam = sum(Mw[i] / w[i] for i in range(n)) / n
    CI = (lam - n) / (n - 1)
    CR = CI / RI[n] if RI[n] else 0.0
    return w, lam, CI, CR

def vdi2225(g, p_by_variant, cost_by_variant, cost_allow, pmax=4):
    """VDI 2225: technical value x = sum(g p)/(pmax sum g); economic value y = H_ideal / H,
    H_ideal = 0.7 * permissible cost. Combined s = sqrt(x*y) (one common choice)."""
    out = {}
    H_ideal = 0.7 * cost_allow
    for v, p in p_by_variant.items():
        x = sum(gi * pi for gi, pi in zip(g, p)) / (pmax * sum(g))
        y = H_ideal / cost_by_variant[v]
        out[v] = (x, y, math.sqrt(x * y))
    return out

def weighted_total(w, s):
    return sum(wi * si for wi, si in zip(w, s)) / sum(w)

def break_even_weight(w, sA, sB, k, steps=100000):
    """Weight of criterion k (others scaled proportionally, sum 1) at which totals of A and B are equal.
    Returns the weight or None."""
    rest = sum(w) - w[k]
    prev = None
    for i in range(steps + 1):
        wk = i / steps
        ww = [wk if j == k else w[j] * (1 - wk) / rest for j in range(len(w))]
        d = weighted_total(ww, sA) - weighted_total(ww, sB)
        if prev is not None and (d == 0 or (d > 0) != (prev[1] > 0)):
            # linear interpolation
            w0, d0 = prev
            return w0 + (wk - w0) * d0 / (d0 - d)
        prev = (wk, d)
    return None

def decision_uncertainty(payoff, prob):
    """payoff[alternative] = list of payoffs per scenario. Returns expected value, maximin, minimax regret."""
    ns = len(prob)
    best_in = [max(payoff[a][s] for a in payoff) for s in range(ns)]
    res = {}
    for a, row in payoff.items():
        ev = sum(p * v for p, v in zip(prob, row))
        regret = max(best_in[s] - row[s] for s in range(ns))
        res[a] = {"EV": ev, "worst": min(row), "max_regret": regret}
    return res

def rpn(S, O, D):
    return S * O * D

# ======================================================= examples
def _examples():
    ex = {}
    ex["R1"] = kano_coeff(A=12, O=38, M=40, I=10)               # 'low noise' survey of 100 customers
    ex["R1b"] = kano_coeff(A=45, O=20, M=5, I=30)               # 'remote monitoring'
    cust = [5, 4, 5, 3, 2]   # FAD, low noise, long life, low cost, compact
    rel = [  # EC: swept volume, crank speed, bearing C/P, valve lift, fan flow, mass
        [9, 9, 0, 3, 1, 0],
        [1, 9, 0, 3, 3, 1],
        [0, 3, 9, 3, 3, 0],
        [3, 3, 3, 0, 1, 9],
        [3, 3, 0, 0, 0, 9],
    ]
    ex["R2"] = qfd(cust, rel)
    hist = [-2, 1, -3, 5, -1, 3, -4, 4, -2]                     # ASTM E1049 example history
    ex["R3"] = rainflow_table(rainflow(hist))
    hist2 = [0, 12, 4, 10, 2, 49, 0, 12, 6, 14, 0]              # crank torque N*m: start + running ripples
    ex["R4"] = rainflow_table(rainflow(hist2))
    n = [0.90e9, 0.09e9, 0.01e9]
    L = [12.4, 25.0, 49.4]
    ex["R5"] = {k: equivalent_load(n, L, k) for k in (3, 10 / 3, 6.6, 8.7)}
    ex["R6"] = compressor_loads()
    fault = compressor_loads(pg=0.99)
    ex["R6f"] = fault["F_gas_N"]
    ex["R7"] = KA_TABLE["uniform"]["moderate"]
    ex["R8"] = design_matrix_type([[1, 0, 0], [1, 1, 0], [0, 1, 1]])
    ex["R8b"] = design_matrix_type([[1, 1], [1, 1]])
    ex["R8c"] = design_matrix_type([[1, 1, 0], [0, 1, 0], [0, 1, 1]])
    ex["R9"] = info_normal(65.000, 65.030, 65.012, 0.006)      # bore 65 H7 on HMC + honing
    ex["R9b"] = info_normal(65.000, 65.030, 65.015, 0.010)     # same bore, older machine
    ex["R9c"] = info_uniform(0.10, 0.30, 0.05, 0.35)           # valve lift design range vs system range
    opts = [["V-belt", "direct", "gear"], ["ball", "roller", "plain"], ["fins+fan", "water", "oil"],
            ["reed", "ring plate", "poppet"]]
    inc = [{(0, 1), (2, 1)},        # direct drive + water jacket (example rule)
           {(1, 2), (2, 0)},        # plain bearings need oil circuit -> not with dry fins concept
           {(3, 2), (0, 0)}]        # poppet valve too slow for belt-speed concept (example rule)
    ex["R10"] = morph_count(opts, inc)
    M = [[1, 3, 5, 7],      # cost vs efficiency, noise, size
         [1 / 3, 1, 3, 5],
         [1 / 5, 1 / 3, 1, 3],
         [1 / 7, 1 / 5, 1 / 3, 1]]
    ex["R11"] = ahp(M)
    Mbad = [[1, 3, 1 / 3], [1 / 3, 1, 3], [3, 1 / 3, 1]]
    ex["R11b"] = ahp(Mbad)
    ex["R12"] = vdi2225([3, 2, 2, 1], {"A V-belt": [3, 2, 3, 2], "B direct": [3, 4, 2, 3], "C gear": [2, 3, 1, 3]},
                        {"A V-belt": 52.0, "B direct": 61.0, "C gear": 88.0}, cost_allow=70.0)
    w = [0.30, 0.20, 0.15, 0.20, 0.15]
    belt = [5, 3, 4, 3, 3]
    direct = [4, 5, 3, 4, 4]
    ex["R13"] = break_even_weight(w, belt, direct, 0)          # weight of cost where belt = direct
    ex["R14"] = decision_uncertainty({"make crankshaft in-house": [-120, 60, 210],
                                      "buy from supplier": [10, 50, 90],
                                      "make + buy split": [-40, 70, 150]}, [0.25, 0.50, 0.25])
    ex["R15"] = [rpn(8, 4, 5), rpn(8, 2, 3), rpn(5, 6, 4)]
    return ex

def cmd_examples():
    ex = _examples()
    print("R1 Kano 'low noise': better %.2f worse %.2f | 'remote monitoring': better %.2f worse %.2f"
          % (ex["R1"]["better"], ex["R1"]["worse"], ex["R1b"]["better"], ex["R1b"]["worse"]))
    a, r = ex["R2"]
    print("R2 QFD absolute:", a, " relative %:", ", ".join("%.1f" % v for v in r))
    print("R3 rainflow ASTM example (range: cycles):", ex["R3"])
    print("R4 rainflow crank torque (range N*m: cycles):", ex["R4"])
    print("R5 equivalent torque N*m:", ", ".join("k=%.2f: %.2f" % (k, v) for k, v in ex["R5"].items()))
    c = ex["R6"]
    print("R6 compressor: A %.1f mm2, Vs %.4f L, Vth %.2f m3/h, lambda_v %.3f, F_gas %.0f N, ratio %.2f, "
          "P_ind %.0f W, P_shaft %.0f W, T_mean %.2f N*m, F_inertia %.0f N, T_bound %.1f N*m, lambda %.3f; fault F %.0f N"
          % (c["A_mm2"], c["Vs_L"], c["Vth_m3h"], c["lambda_v"], c["F_gas_N"], c["pressure_ratio"], c["P_ind_W"],
             c["P_shaft_W"], c["T_mean_Nm"], c["F_inertia_N"], c["T_peak_bound_Nm"], c["lambda_rod"], ex["R6f"]))
    print("R7 K_A electric motor + piston compressor (moderate shocks):", ex["R7"])
    print("R8 design matrices:", ex["R8"], ex["R8b"], ex["R8c"])
    print("R9 info normal good %.5f / I %.4f bit | old %.5f / I %.4f bit | R9c uniform P %.3f I %.3f bit"
          % (ex["R9"][0], ex["R9"][1], ex["R9b"][0], ex["R9b"][1], ex["R9c"][0], ex["R9c"][1]))
    print("R10 morphological box total / compatible:", ex["R10"])
    w, lam, CI, CR = ex["R11"]
    print("R11 AHP w:", ", ".join("%.3f" % x for x in w), "lambda %.3f CI %.3f CR %.3f" % (lam, CI, CR))
    w, lam, CI, CR = ex["R11b"]
    print("R11b AHP inconsistent: lambda %.3f CI %.3f CR %.3f" % (lam, CI, CR))
    for v, (x, y, s) in ex["R12"].items():
        print("R12 VDI 2225 %-10s x %.3f y %.3f s %.3f" % (v, x, y, s))
    print("R13 break-even weight of cost: %.3f" % ex["R13"])
    for a, d in ex["R14"].items():
        print("R14 %-26s EV %.1f worst %.0f max regret %.0f" % (a, d["EV"], d["worst"], d["max_regret"]))
    print("R15 RPN:", ex["R15"])

def cmd_selftest():
    ex = _examples()
    chk = []
    def near(name, a, b, tol):
        ok = abs(a - b) <= tol
        chk.append(ok)
        print("%-36s %12.5f expect %12.5f %s" % (name, a, b, "OK" if ok else "FAIL"))
    t = ex["R3"]
    near("R3 range 3 cycles", t.get(3, 0), 0.5, 1e-9)
    near("R3 range 4 cycles", t.get(4, 0), 1.5, 1e-9)
    near("R3 range 6 cycles", t.get(6, 0), 0.5, 1e-9)
    near("R3 range 8 cycles", t.get(8, 0), 1.0, 1e-9)
    near("R3 range 9 cycles", t.get(9, 0), 0.5, 1e-9)
    near("R2 rel. importance crank speed %", ex["R2"][1][1], 31.27, 0.01)
    near("R5 L_eq k=3", ex["R5"][3], 16.30, 0.01)
    c = ex["R6"]
    near("R6 F_gas N", c["F_gas_N"], 2654.6, 0.5)
    near("R6 Vth m3/h", c["Vth_m3h"], 26.56, 0.01)
    near("R6 P_shaft W", c["P_shaft_W"], 1883, 3)
    near("R9 info bits", ex["R9"][1], 0.0352, 0.0002)
    near("R10 compatible", ex["R10"][1], 55, 0)
    near("R11 CR", ex["R11"][3], 0.044, 0.002)
    near("R13 break-even", ex["R13"], 0.4615, 0.0005)
    near("R14 EV in-house", ex["R14"]["make crankshaft in-house"]["EV"], 52.5, 1e-6)
    ok = all(chk) and ex["R8"][0] == "decoupled" and ex["R8b"][0] == "coupled" and ex["R8c"][0] == "decoupled"
    print("R8 classification", "OK" if ok else "FAIL")
    print("SELFTEST", "PASS" if ok else "FAIL")
    return 0 if ok else 1

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "--help"
    if cmd == "examples":
        cmd_examples()
    elif cmd == "selftest":
        sys.exit(cmd_selftest())
    else:
        print(__doc__)
