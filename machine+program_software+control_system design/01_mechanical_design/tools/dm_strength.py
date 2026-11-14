#!/usr/bin/env python3
"""Strength, fatigue, reliability and FEA/MBD theory toolkit - backs chapters 25-28 of guide M1 (Part B).

Python standard library only (offline). All inputs are EXAMPLE values.
Usage:
  python dm_strength.py examples
  python dm_strength.py selftest
"""
import math
import random
import sys
from statistics import NormalDist

PHI = NormalDist().cdf
PHI_INV = NormalDist().inv_cdf

# =================================================================== 25 strength
def principal_stresses(sx, sy, sz, txy, tyz, txz):
    """Principal stresses from the invariants (trigonometric solution of the cubic)."""
    I1 = sx + sy + sz
    I2 = sx * sy + sy * sz + sz * sx - txy ** 2 - tyz ** 2 - txz ** 2
    I3 = (sx * sy * sz + 2 * txy * tyz * txz - sx * tyz ** 2 - sy * txz ** 2 - sz * txy ** 2)
    # deviatoric invariants
    J2 = I1 ** 2 / 3 - I2
    J3 = 2 * I1 ** 3 / 27 - I1 * I2 / 3 + I3
    if J2 < 1e-12:
        return (I1 / 3,) * 3, (I1, I2, I3)
    r = math.sqrt(J2 / 3)
    cos3t = max(-1.0, min(1.0, J3 / (2 * r ** 3)))
    t = math.acos(cos3t) / 3
    s = sorted([I1 / 3 + 2 * r * math.cos(t - 2 * math.pi * k / 3) for k in range(3)], reverse=True)
    return tuple(s), (I1, I2, I3)

def von_mises_principal(s1, s2, s3):
    return math.sqrt(0.5 * ((s1 - s2) ** 2 + (s2 - s3) ** 2 + (s3 - s1) ** 2))

def shaft_combined(d, M, T, Re):
    """Solid shaft d mm, M and T in N*m. Returns bending, shear, von Mises, Tresca, safety factors."""
    sb = 32 * M * 1e3 / (math.pi * d ** 3)
    tau = 16 * T * 1e3 / (math.pi * d ** 3)
    vm = math.sqrt(sb ** 2 + 3 * tau ** 2)
    tr = math.sqrt(sb ** 2 + 4 * tau ** 2)
    return {"sigma_b": sb, "tau": tau, "vm": vm, "tresca": tr, "n_vm": Re / vm, "n_tresca": Re / tr}

def mohr_coulomb(s1, s3, St, Sc):
    """Brittle Mohr-Coulomb (s1 >= 0 >= s3): 1/n = s1/St - s3/Sc."""
    return 1.0 / (s1 / St - s3 / Sc)

def peterson_q(Rm, r):
    """Peterson notch sensitivity for steels (bending/axial), Rm MPa, r mm."""
    a = 0.0254 * (2070.0 / Rm) ** 1.8
    q = 1.0 / (1.0 + a / r)
    return a, q

def kf_from_kt(Kt, q):
    return 1 + q * (Kt - 1)

def buckling_rod(d, L, K, E, Re, F, n_req=3.5):
    """Euler / Johnson buckling of a solid round rod. Returns slenderness, transition, critical force, safety."""
    A = math.pi * d ** 2 / 4
    rg = d / 4
    lam = K * L / rg
    lam_t = math.pi * math.sqrt(2 * E / Re)
    if lam >= lam_t:
        scr = math.pi ** 2 * E / lam ** 2
        mode = "Euler"
    else:
        scr = Re - (Re * lam / (2 * math.pi)) ** 2 / E
        mode = "Johnson"
    Fcr = scr * A
    return {"lambda": lam, "lambda_t": lam_t, "mode": mode, "sigma_cr": scr, "Fcr_kN": Fcr / 1e3,
            "n": Fcr / F, "ok": Fcr / F >= n_req}

def e_star(E1, nu1, E2, nu2):
    return 1.0 / ((1 - nu1 ** 2) / E1 + (1 - nu2 ** 2) / E2)

def hertz_line(F, b, R1, R2, Es):
    """Two cylinders (convex R1, R2>0; concave R2<0), length b. Returns half width a, pmax, max shear depth."""
    Rs = 1.0 / (1.0 / R1 + 1.0 / R2)
    a = math.sqrt(4 * F * Rs / (math.pi * b * Es))
    p = 2 * F / (math.pi * a * b)
    return {"R_star": Rs, "a": a, "pmax": p, "tau_max": 0.30 * p, "z_tau": 0.786 * a}

def hertz_point(F, R, Es):
    """Sphere radius R on a flat (R* = R). Returns contact radius, pmax, approach."""
    a = (3 * F * R / (4 * Es)) ** (1 / 3)
    p = 3 * F / (2 * math.pi * a ** 2)
    delta = a ** 2 / R
    return {"a": a, "pmax": p, "delta": delta, "tau_max": 0.31 * p, "z_tau": 0.48 * a}

def lame(p, ri, ro, closed=True):
    """Thick cylinder, internal pressure. Stresses at the bore (MPa)."""
    k = ro ** 2 - ri ** 2
    st = p * (ro ** 2 + ri ** 2) / k
    sr = -p
    sa = p * ri ** 2 / k if closed else 0.0
    vm = von_mises_principal(st, sa, sr)
    return {"sigma_t": st, "sigma_r": sr, "sigma_a": sa, "vm": vm, "thin_wall_estimate": p * ri / (ro - ri)}

# =================================================================== 26 fatigue
def basquin(sf, b, N):
    return sf * (2 * N) ** b

def sn_life(sa, sD, ND=1e6, k=5.0):
    return ND * (sD / sa) ** k

def mean_stress(sa, sm, Se, Rm, Re):
    goodman = 1 / (sa / Se + sm / Rm)
    soder = 1 / (sa / Se + sm / Re)
    r = Rm / sm
    gerber = 0.5 * r ** 2 * (sa / Se) * (-1 + math.sqrt(1 + (2 * sm * Se / (Rm * sa)) ** 2))
    smax = sa + sm
    swt = math.sqrt(smax * sa) if smax > 0 else 0.0
    return {"goodman": goodman, "gerber": gerber, "soderberg": soder, "swt_sa_eq": swt, "n_swt": Se / swt}

def fkm_M(Rm, aM=0.35, bM=-0.1):
    return aM * 1e-3 * Rm + bM

def rainflow(series):
    """ASTM E1049 three-point rainflow. Returns list of (range, mean, count 0.5/1)."""
    # reduce to turning points
    tp = [series[0]]
    for x in series[1:]:
        if x == tp[-1]:
            continue
        if len(tp) >= 2 and (tp[-1] - tp[-2]) * (x - tp[-1]) > 0:
            tp[-1] = x
        else:
            tp.append(x)
    stack, cycles = [], []
    for x in tp:
        stack.append(x)
        while len(stack) >= 3:
            X = abs(stack[-1] - stack[-2])
            Y = abs(stack[-2] - stack[-3])
            if X < Y:
                break
            if len(stack) == 3:
                cycles.append((Y, (stack[-2] + stack[-3]) / 2, 0.5))
                stack.pop(0)
            else:
                cycles.append((Y, (stack[-2] + stack[-3]) / 2, 1.0))
                last = stack.pop()
                stack.pop()
                stack.pop()
                stack.append(last)
    for i in range(len(stack) - 1):
        cycles.append((abs(stack[i + 1] - stack[i]), (stack[i + 1] + stack[i]) / 2, 0.5))
    return cycles

def miner(cycles_amp, sD, ND=1e6, k=5.0, rule="elementary"):
    """cycles_amp: list of (amplitude, count). rule: elementary | original | haibach."""
    D = 0.0
    for sa, n in cycles_amp:
        if sa <= 0:
            continue
        if sa >= sD or rule == "elementary":
            N = ND * (sD / sa) ** k
        elif rule == "original":
            continue
        else:  # haibach: slope 2k-1 below the knee
            N = ND * (sD / sa) ** (2 * k - 1)
        D += n / N
    return D

def ramberg_osgood_eps(s, E, Kp, n):
    return s / E + (s / Kp) ** (1 / n)

def neuber_strain_life(Kt, S, E, Kp, n, sf, b, ef, c):
    """Neuber: s*eps = (Kt*S)^2/E with cyclic Ramberg-Osgood curve (amplitudes). Then solve Coffin-Manson for 2N."""
    target = (Kt * S) ** 2 / E
    lo, hi = 1e-6, Kt * S
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        if mid * ramberg_osgood_eps(mid, E, Kp, n) < target:
            lo = mid
        else:
            hi = mid
    s = lo
    e = ramberg_osgood_eps(s, E, Kp, n)
    def cm(x):  # x = log10(2N)
        N2 = 10 ** x
        return sf / E * N2 ** b + ef * N2 ** c - e
    lo, hi = 0.0, 12.0
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        if cm(mid) > 0:
            lo = mid
        else:
            hi = mid
    N2 = 10 ** lo
    return {"sigma_local": s, "eps_local": e, "elastic_sigma": Kt * S, "2N": N2, "N": N2 / 2}

def paris_life(a0, dsig, smax, KIC, Y=1.12, C=6.9e-12, m=3.0):
    """a in m, stresses MPa, K in MPa*sqrt(m). Constant Y. Returns critical crack and cycles."""
    ac = (KIC / (Y * smax)) ** 2 / math.pi
    if m == 2:
        N = math.log(ac / a0) / (C * (Y * dsig * math.sqrt(math.pi)) ** 2)
    else:
        e = 1 - m / 2
        N = (ac ** e - a0 ** e) / (C * (Y * dsig * math.sqrt(math.pi)) ** m * e)
    return {"a_c_mm": ac * 1e3, "N": N}

def fkm_local(Rm, Rp, sa, sm, smax, G, Rz, KV=1.0, fW=0.40, aG=0.5, bG=2700.0, aR=0.22, RmNmin=400.0,
              Kf_tilde=2.0, jD=1.5, jS=1.5, eps_ertr=0.05, Kp=1.7, E=206000.0, aM=0.35, bM=-0.1):
    """Simplified FKM local-stress fatigue + static check (normal stress, constant amplitude, infinite life).
    Table values are typical for wrought steel - check FKM 7th ed. tables."""
    sWzd = fW * Rm
    if G <= 0.1:
        ns = 1 + G * 10 ** -(aG - 0.5 + Rm / bG)
    elif G <= 1:
        ns = 1 + math.sqrt(G) * 10 ** -(aG + Rm / bG)
    else:
        ns = 1 + G ** 0.25 * 10 ** -(aG + Rm / bG)
    KR = 1 - aR * math.log10(Rz) * math.log10(2 * Rm / RmNmin)
    KWK = (1 / ns) * (1 + (1 / Kf_tilde) * (1 / KR - 1)) / KV
    sWK = sWzd / KWK
    M = aM * 1e-3 * Rm + bM
    KAK = 1 / (1 + M * sm / sa)
    sAK = KAK * sWK
    aBK = sa * jD / sAK
    npl = min(math.sqrt(E * eps_ertr / Rp), Kp)
    sSK = Rp * npl
    aSK = smax * jS / sSK
    return {"sigma_W_zd": sWzd, "n_sigma": ns, "K_R": KR, "K_WK": KWK, "sigma_WK": sWK, "M_sigma": M,
            "K_AK": KAK, "sigma_AK": sAK, "a_BK": aBK, "n_pl": npl, "sigma_SK": sSK, "a_SK": aSK}

# =================================================================== 27 reliability
def weibull(beta, eta, t=None, R=None):
    out = {"MTTF": eta * math.gamma(1 + 1 / beta), "B10": eta * (-math.log(0.9)) ** (1 / beta)}
    if t is not None:
        out["R_t"] = math.exp(-(t / eta) ** beta)
        out["h_t"] = beta / eta * (t / eta) ** (beta - 1)
    if R is not None:
        out["t_R"] = eta * (-math.log(R)) ** (1 / beta)
    return out

def weibull_fit(times):
    """Median-rank regression (Bernard), y on x. Returns beta, eta, r^2, table."""
    t = sorted(times)
    n = len(t)
    xs, ys, tab = [], [], []
    for i, ti in enumerate(t, 1):
        F = (i - 0.3) / (n + 0.4)
        x, y = math.log(ti), math.log(-math.log(1 - F))
        xs.append(x); ys.append(y); tab.append((i, ti, F, x, y))
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    syy = sum((y - my) ** 2 for y in ys)
    beta = sxy / sxx
    a = my - beta * mx
    eta = math.exp(-a / beta)
    return {"beta": beta, "eta": eta, "r2": sxy ** 2 / (sxx * syy), "table": tab}

def lognormal_interference(medS, covS, medL, covL):
    zS = math.log(1 + covS ** 2)
    zL = math.log(1 + covL ** 2)
    beta = math.log(medS / medL) / math.sqrt(zS + zL)
    return {"beta": beta, "R": PHI(beta), "ppm": (1 - PHI(beta)) * 1e6}

def form_hlrf(g, mu, sd, it=50):
    """Hasofer-Lind / Rackwitz-Fiessler for independent normal variables. Returns beta, design point."""
    n = len(mu)
    u = [0.0] * n
    hist = []
    for _ in range(it):
        x = [mu[i] + sd[i] * u[i] for i in range(n)]
        gx = g(x)
        grad = []
        for i in range(n):
            h = 1e-6 * max(1.0, abs(x[i]))
            xp = list(x); xp[i] += h
            grad.append((g(xp) - gx) / h * sd[i])
        gn2 = sum(gi * gi for gi in grad)
        dot = sum(grad[i] * u[i] for i in range(n))
        unew = [(dot - gx) / gn2 * grad[i] for i in range(n)]
        beta = math.sqrt(sum(v * v for v in unew))
        hist.append(beta)
        if max(abs(unew[i] - u[i]) for i in range(n)) < 1e-9:
            u = unew
            break
        u = unew
    beta = math.sqrt(sum(v * v for v in u))
    alpha = [-v / beta for v in u]
    x = [mu[i] + sd[i] * u[i] for i in range(n)]
    return {"beta": beta, "Pf": PHI(-beta), "x_design": x, "alpha": alpha, "iterations": len(hist)}

def monte_carlo(g, mu, sd, N=200000, seed=1):
    rnd = random.Random(seed)
    fails = 0
    for _ in range(N):
        x = [rnd.gauss(m, s) for m, s in zip(mu, sd)]
        if g(x) < 0:
            fails += 1
    p = fails / N
    half = 1.96 * math.sqrt(p * (1 - p) / N) if fails else 3.0 / N
    return {"Pf": p, "ci95": (max(0.0, p - half), p + half), "fails": fails, "cov": math.sqrt((1 - p) / (N * p)) if p else None}

def k_out_of_n(k, n, R):
    return sum(math.comb(n, i) * R ** i * (1 - R) ** (n - i) for i in range(k, n + 1))

def success_run(R, C, L=1.0, beta=1.0):
    n = math.log(1 - C) / (L ** beta * math.log(R))
    return n, math.ceil(n - 1e-9)

def iso281_a1(R):
    return 0.95 * (math.log(100 / R) / math.log(100 / 90)) ** (2 / 3) + 0.05

# =================================================================== 28 FEA / MBD
def solve_linear(K, F):
    n = len(F)
    A = [row[:] + [F[i]] for i, row in enumerate(K)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(A[r][c]))
        A[c], A[p] = A[p], A[c]
        for r in range(c + 1, n):
            f = A[r][c] / A[c][c]
            for j in range(c, n + 1):
                A[r][j] -= f * A[c][j]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (A[r][n] - sum(A[r][j] * x[j] for j in range(r + 1, n))) / A[r][r]
    return x

def bar_chain(E, areas, lengths, F_end):
    """1D bar elements in series, node 0 fixed, force at last node. Assembly of k_e = EA/L [[1,-1],[-1,1]]."""
    ne = len(areas)
    nn = ne + 1
    K = [[0.0] * nn for _ in range(nn)]
    for e in range(ne):
        k = E * areas[e] / lengths[e]
        K[e][e] += k; K[e][e + 1] -= k; K[e + 1][e] -= k; K[e + 1][e + 1] += k
    Kr = [row[1:] for row in K[1:]]
    Fr = [0.0] * (nn - 1); Fr[-1] = F_end
    u = [0.0] + solve_linear(Kr, Fr)
    stress = [E * (u[e + 1] - u[e]) / lengths[e] for e in range(ne)]
    reaction = sum(K[0][j] * u[j] for j in range(nn))
    return {"u": u, "stress": stress, "reaction": reaction, "K": K}

def gauss2(f):
    g = 1 / math.sqrt(3)
    return f(-g) + f(g)

def wave_dt(E, rho, Le):
    """E MPa, rho t/mm^3, Le mm -> c m/s, dt s."""
    c = math.sqrt(E / rho)  # mm/s
    return c / 1000.0, Le / c

def singular_growth(lam, ratio=2.0):
    return ratio ** (1 - lam)

def mac(a, b):
    ab = sum(x * y for x, y in zip(a, b))
    return ab ** 2 / (sum(x * x for x in a) * sum(y * y for y in b))

def hertz_k_sphere(E, nu, R):
    Es = e_star(E, nu, E, nu)
    return Es, 4 / 3 * Es * math.sqrt(R)

def newton_spring(k, k3, F, u0=0.0, tol=1e-10):
    u, hist = u0, []
    for _ in range(50):
        r = F - (k * u + k3 * u ** 3)
        hist.append((u, r))
        if abs(r) < tol * F:
            break
        u += r / (k + 3 * k3 * u ** 2)
    return u, hist

def mc_cantilever(N=100000, seed=2):
    rnd = random.Random(seed)
    vals = []
    I = 20 ** 4 / 12
    for _ in range(N):
        F = rnd.gauss(1000, 50); E = rnd.gauss(210000, 4200); L = rnd.gauss(200, 1.0)
        vals.append(F * L ** 3 / (3 * E * I))
    m = sum(vals) / N
    s = math.sqrt(sum((v - m) ** 2 for v in vals) / (N - 1))
    lin = {"F": 0.05 ** 2, "E": 0.02 ** 2, "L": (3 * 0.005) ** 2}
    tot = sum(lin.values())
    return {"mean": m, "cov": s / m, "cov_linear": math.sqrt(tot), "shares": {k: v / tot for k, v in lin.items()}}

# =================================================================== examples
def _ex():
    X = {}
    (s1, s2, s3), inv = principal_stresses(120, -40, 0, 50, 0, 20)
    X["S1"] = {"s": (s1, s2, s3), "inv": inv, "vm": von_mises_principal(s1, s2, s3), "tresca": s1 - s3,
               "vm_direct": math.sqrt(0.5 * ((120 + 40) ** 2 + 40 ** 2 + 120 ** 2) + 3 * (50 ** 2 + 20 ** 2))}
    X["S2"] = shaft_combined(30, 150, 200, 430)
    X["S3"] = mohr_coulomb(60, -120, 250, 840)
    a, q = peterson_q(650, 1.6)
    X["S4"] = {"a": a, "q": q, "Kf": kf_from_kt(1.9, q), "a1000": peterson_q(1000, 1.6)[0], "q1000": peterson_q(1000, 1.6)[1],
               "Kf1000": kf_from_kt(1.9, peterson_q(1000, 1.6)[1])}
    F = math.pi / 4 * 63 ** 2 * 10.0
    X["S5a"] = buckling_rod(25, 600, 1.0, 210000, 500, F)
    X["S5b"] = buckling_rod(25, 400, 1.0, 210000, 500, F)
    X["S5c"] = buckling_rod(25, 600, 2.0, 210000, 500, F)
    X["S5F"] = F
    Es = e_star(210000, 0.3, 210000, 0.3)
    X["S6a"] = hertz_line(1500, 12, 12.5, 30, Es)
    X["S6b"] = hertz_point(500, 5, Es)
    X["S6Es"] = Es
    X["S7"] = lame(16, 31.5, 38)
    X["S7tank"] = 1.1 * 300 / (2 * 3)
    X["S8"] = {"rect": 1.5, "circ": 16 / (3 * math.pi)}
    # fatigue
    X["F1"] = {"Basquin_1e6": basquin(1345, -0.085, 1e6), "N_at_1.2sD": sn_life(1.2, 1.0, 1e6, 5)}
    X["F2"] = mean_stress(150, 200, 300, 1000, 850)
    X["F2M"] = fkm_M(1000)
    X["F2eq"] = 150 + fkm_M(1000) * 200
    hist = [0, 100, -50, 80, -80, 120, -20, 60, -100, 0]
    cyc = rainflow(hist)
    X["F3cyc"] = cyc
    rep = 1e5
    amps = [(r / 2, c * rep) for r, m, c in cyc]
    X["F3"] = {r: miner(amps, 60, 1e6, 5, r) for r in ("elementary", "haibach", "original")}
    X["F4"] = neuber_strain_life(2.5, 200, 206000, 1200, 0.15, 1200, -0.09, 0.6, -0.6)
    X["F5"] = paris_life(0.5e-3, 150, 150, 60)
    X["F6"] = fkm_local(Rm=1000, Rp=750, sa=180, sm=90, smax=270, G=1.0, Rz=10)
    X["F6rolled"] = fkm_local(Rm=1000, Rp=750, sa=180, sm=90, smax=270, G=1.0, Rz=10, KV=1.3)
    # reliability
    X["R1"] = weibull(1.5, 12000, t=5000)
    X["R2"] = weibull_fit([410, 730, 1050, 1320, 1700, 2350])
    X["R3"] = lognormal_interference(350, 0.08, 220, 0.12)
    g = lambda x: x[0] - 32 * 800e3 / (math.pi * x[1] ** 3)
    X["R4"] = form_hlrf(g, [430, 30], [30, 0.6])
    X["R5"] = monte_carlo(g, [430, 30], [30, 0.6])
    X["R6"] = {"series5": 0.99 ** 5, "parallel2": 1 - 0.1 ** 2, "2oo3": k_out_of_n(2, 3, 0.9)}
    X["R7"] = {"plain": success_run(0.9, 0.9), "lipson": success_run(0.9, 0.9, 2.0, 1.5)}
    X["R8"] = {R: iso281_a1(R) for R in (90, 95, 99)}
    X["R9"] = 0.95 ** 0.25
    # FEA/MBD
    X["T1"] = bar_chain(210000, [200, 100], [100, 100], 10000)
    X["T2"] = {"exact": 2 / 1 * 0 + 10 / 3, "gauss2": gauss2(lambda x: x ** 3 + 2 * x ** 2 + 1),
               "gauss2_x4": gauss2(lambda x: x ** 4), "exact_x4": 0.4}
    X["T3"] = {"steel": wave_dt(210000, 7.85e-9, 1.0), "alu": wave_dt(70000, 2.7e-9, 1.0)}
    X["T4"] = {"corner90": singular_growth(0.5445), "crack": singular_growth(0.5)}
    X["T5"] = {"pair": mac([0.10, 0.45, 0.80, 1.00], [0.12, 0.43, 0.82, 1.00]),
               "cross": mac([0.10, 0.45, 0.80, 1.00], [1.00, 0.60, -0.40, -0.90])}
    Es2, k = hertz_k_sphere(210000, 0.3, 10)
    X["T6"] = {"E_star": Es2, "k": k, "delta_1000N": (1000 / k) ** (2 / 3), "k_secant": 1000 / (1000 / k) ** (2 / 3)}
    X["T7"] = newton_spring(1000, 50, 5000)
    X["T8"] = [(f, t, 100 * (f - t) / t) for f, t in ((212, 205), (455, 470), (780, 760))]
    X["T9"] = mc_cantilever()
    return X

def cmd_examples():
    X = _ex()
    s = X["S1"]
    print("S1 principal %.2f %.2f %.2f | I1 %.1f I2 %.1f I3 %.1f | vM %.2f (direct %.2f) Tresca %.2f"
          % (*s["s"], *s["inv"], s["vm"], s["vm_direct"], s["tresca"]))
    v = X["S2"]; print("S2 shaft sb %.2f tau %.2f vM %.2f Tresca %.2f n_vM %.2f n_Tr %.2f" % (v["sigma_b"], v["tau"], v["vm"], v["tresca"], v["n_vm"], v["n_tresca"]))
    print("S3 Mohr-Coulomb n %.2f" % X["S3"])
    v = X["S4"]; print("S4 a %.4f q %.3f Kf %.3f | Rm1000 a %.4f q %.3f Kf %.3f" % (v["a"], v["q"], v["Kf"], v["a1000"], v["q1000"], v["Kf1000"]))
    print("S5 F = %.0f N" % X["S5F"])
    for k in ("S5a", "S5b", "S5c"):
        v = X[k]; print("  %s lam %.1f lam_t %.1f %s scr %.1f Fcr %.1f kN n %.2f" % (k, v["lambda"], v["lambda_t"], v["mode"], v["sigma_cr"], v["Fcr_kN"], v["n"]))
    print("S6 E* %.0f" % X["S6Es"])
    v = X["S6a"]; print("  line R* %.3f a %.4f pmax %.0f tau %.0f z %.3f" % (v["R_star"], v["a"], v["pmax"], v["tau_max"], v["z_tau"]))
    v = X["S6b"]; print("  point a %.4f pmax %.0f delta %.5f tau %.0f z %.3f" % (v["a"], v["pmax"], v["delta"], v["tau_max"], v["z_tau"]))
    v = X["S7"]; print("S7 Lame st %.1f sr %.1f sa %.1f vM %.1f thin %.1f | tank %.1f" % (v["sigma_t"], v["sigma_r"], v["sigma_a"], v["vm"], v["thin_wall_estimate"], X["S7tank"]))
    print("S8 shape factors rect %.2f circ %.3f" % (X["S8"]["rect"], X["S8"]["circ"]))
    print("F1 Basquin sa(1e6) %.1f | N at 1.2 sD %.0f" % (X["F1"]["Basquin_1e6"], X["F1"]["N_at_1.2sD"]))
    v = X["F2"]; print("F2 Goodman %.3f Gerber %.3f Soderberg %.3f SWT sa_eq %.1f n_SWT %.3f | M %.3f eq %.1f n_FKM %.3f"
                       % (v["goodman"], v["gerber"], v["soderberg"], v["swt_sa_eq"], v["n_swt"], X["F2M"], X["F2eq"], 300 / X["F2eq"]))
    print("F3 cycles:", [(round(r, 1), round(m, 1), c) for r, m, c in X["F3cyc"]])
    print("   D", {k: round(v, 4) for k, v in X["F3"].items()})
    v = X["F4"]; print("F4 Neuber sigma %.1f eps %.5f (elastic %.0f) 2N %.0f N %.0f" % (v["sigma_local"], v["eps_local"], v["elastic_sigma"], v["2N"], v["N"]))
    v = X["F5"]; print("F5 Paris a_c %.2f mm N %.0f" % (v["a_c_mm"], v["N"]))
    for k in ("F6", "F6rolled"):
        v = X[k]; print("%s " % k + " ".join("%s %.3f" % (kk, vv) for kk, vv in v.items()))
    v = X["R1"]; print("R1 MTTF %.0f B10 %.0f R(5000) %.4f h %.3e" % (v["MTTF"], v["B10"], v["R_t"], v["h_t"]))
    v = X["R2"]; print("R2 beta %.3f eta %.1f r2 %.4f" % (v["beta"], v["eta"], v["r2"]))
    for row in v["table"]:
        print("   i %d t %d F %.4f x %.4f y %.4f" % row)
    v = X["R3"]; print("R3 lognormal beta %.3f R %.6f ppm %.1f" % (v["beta"], v["R"], v["ppm"]))
    v = X["R4"]; print("R4 FORM beta %.3f Pf %.3e x* %.2f %.3f alpha %.3f %.3f it %d" % (v["beta"], v["Pf"], *v["x_design"], *v["alpha"], v["iterations"]))
    v = X["R5"]; print("R5 MC Pf %.3e CI %.3e..%.3e fails %d" % (v["Pf"], *v["ci95"], v["fails"]))
    print("R6", {k: round(v, 5) for k, v in X["R6"].items()})
    print("R7", X["R7"])
    print("R8", {k: round(v, 3) for k, v in X["R8"].items()}, "R9 %.4f" % X["R9"])
    v = X["T1"]; print("T1 u", [round(x, 5) for x in v["u"]], "stress", [round(x, 1) for x in v["stress"]], "reaction %.1f" % v["reaction"])
    print("T2", X["T2"])
    print("T3 steel c %.0f m/s dt %.3e s | alu c %.0f dt %.3e" % (*X["T3"]["steel"], *X["T3"]["alu"]))
    print("T4", {k: round(v, 3) for k, v in X["T4"].items()})
    print("T5", {k: round(v, 4) for k, v in X["T5"].items()})
    v = X["T6"]; print("T6 E* %.0f k %.0f N/mm^1.5 delta %.5f mm secant %.0f N/mm" % (v["E_star"], v["k"], v["delta_1000N"], v["k_secant"]))
    u, h = X["T7"]; print("T7 u %.5f it %d" % (u, len(h)), [(round(a, 4), round(b, 2)) for a, b in h])
    print("T8", [(f, t, round(e, 2)) for f, t, e in X["T8"]])
    v = X["T9"]; print("T9 mean %.4f cov %.4f lin %.4f shares" % (v["mean"], v["cov"], v["cov_linear"]), {k: round(s, 3) for k, s in v["shares"].items()})

def cmd_selftest():
    X = _ex()
    res = []
    def near(name, a, b, tol):
        ok = abs(a - b) <= tol
        res.append(ok)
        print("%-28s %14.6g expect %14.6g %s" % (name, a, b, "OK" if ok else "FAIL"))
    s = X["S1"]
    near("S1 vM principal=direct", s["vm"], s["vm_direct"], 1e-6)
    near("S1 sum principal=I1", sum(s["s"]), s["inv"][0], 1e-9)
    near("S2 vM", X["S2"]["vm"], 86.44, 0.01)
    near("S4 Kf", X["S4"]["Kf"], 1.798, 0.002)
    near("S5a n", X["S5a"]["n"], 3.54, 0.01)
    near("S6a pmax", X["S6a"]["pmax"], 721.3, 0.5)
    near("S7 sigma_t", X["S7"]["sigma_t"], 86.29, 0.01)
    near("F2 Goodman", X["F2"]["goodman"], 1/0.7, 1e-9)
    near("F3 elementary D", X["F3"]["elementary"], 2.261, 0.002)
    near("F5 a_c mm", X["F5"]["a_c_mm"], 40.60, 0.01)
    near("F6 a_BK", X["F6"]["a_BK"], 0.73, 0.01)
    near("R1 B10", X["R1"]["B10"], 2677, 1)
    near("R4 FORM vs MC", X["R4"]["Pf"], X["R5"]["Pf"], 0.15 * X["R5"]["Pf"])
    near("R6 2oo3", X["R6"]["2oo3"], 0.972, 1e-9)
    near("R8 a1(99)", X["R8"][99], 0.25, 0.005)
    near("T1 u_end", X["T1"]["u"][-1], 0.0714286, 1e-6)
    near("T1 reaction", X["T1"]["reaction"], -10000, 1e-6)
    near("T2 gauss exact cubic", X["T2"]["gauss2"], 10 / 3, 1e-12)
    near("T5 MAC pair", X["T5"]["pair"], 0.9994, 0.0001)
    near("T9 cov MC vs linear", X["T9"]["cov"], X["T9"]["cov_linear"], 0.003)
    print("SELFTEST", "PASS" if all(res) else "FAIL")
    return 0 if all(res) else 1

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__); sys.exit(0)
    if sys.argv[1] == "examples":
        cmd_examples()
    elif sys.argv[1] == "selftest":
        sys.exit(cmd_selftest())
    else:
        print("unknown command"); sys.exit(2)
