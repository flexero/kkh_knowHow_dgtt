#!/usr/bin/env python3
"""dm_opt.py - optimisation, DOE, testing and quality calculations for guide M1 Part B, chapters 29-33.

Python standard library only (offline factory PC). All inputs are EXAMPLE values.

Usage:
  python dm_opt.py examples     # print every worked example of chapters 29-33
  python dm_opt.py selftest     # check the numbers used in the guide -> SELFTEST PASS
"""
import math
import random
import sys
from statistics import NormalDist

ND = NormalDist()

# =====================================================================================
# common linear algebra
# =====================================================================================
def solve(A, b):
    """Gauss elimination with partial pivoting. A list of lists, b list. Returns x."""
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        if abs(M[p][c]) < 1e-300:
            raise ValueError("singular matrix")
        M[c], M[p] = M[p], M[c]
        for r in range(c + 1, n):
            f = M[r][c] / M[c][c]
            if f:
                for k in range(c, n + 1):
                    M[r][k] -= f * M[c][k]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (M[r][n] - sum(M[r][k] * x[k] for k in range(r + 1, n))) / M[r][r]
    return x

def lstsq(X, y):
    """Least squares beta = (X^T X)^-1 X^T y (normal equations)."""
    p = len(X[0])
    XtX = [[sum(r[i] * r[j] for r in X) for j in range(p)] for i in range(p)]
    Xty = [sum(r[i] * yy for r, yy in zip(X, y)) for i in range(p)]
    return solve(XtX, Xty)

def r2_stats(X, y, beta):
    n, p = len(y), len(beta)
    yh = [sum(b * xi for b, xi in zip(beta, r)) for r in X]
    ym = sum(y) / n
    sse = sum((a - b) ** 2 for a, b in zip(y, yh))
    sst = sum((a - ym) ** 2 for a in y)
    r2 = 1 - sse / sst
    r2a = 1 - (sse / (n - p)) / (sst / (n - 1))
    return {"R2": r2, "R2_adj": r2a, "residuals": [a - b for a, b in zip(y, yh)], "SSE": sse}

# =====================================================================================
# 29 optimisation
# =====================================================================================
def kkt_example(b=4.0):
    """min x1^2 + x2^2  s.t.  x1 + x2 >= b.  Analytic: x = (b/2, b/2), lambda = b, f* = b^2/2.
    Checks the shadow price numerically: df*/db ~ lambda."""
    x = (b / 2, b / 2)
    lam = b                     # from grad f = lambda * grad g: 2*x_i = lambda
    f = b * b / 2
    h = 1e-4
    dfdb = ((b + h) ** 2 / 2 - (b - h) ** 2 / 2) / (2 * h)
    return {"x": x, "lambda": lam, "f": f, "dfdb": dfdb}

def beam_kkt(M=2.0e6, sig=150.0, hmax=120.0):
    """Engineering KKT example: rectangular section b x h, minimise area A = b h,
    bending stress 6M/(b h^2) <= sig, h <= hmax. Optimum: h = hmax (active), b = 6M/(sig h^2).
    Multipliers: lambda_stress = A (scaled per unit relative stress), lambda_h = dA/dhmax."""
    h = hmax
    b = 6 * M / (sig * h * h)
    A = b * h
    # A*(hmax) = 6M/(sig*hmax) -> dA/dhmax = -6M/(sig*hmax^2) = -b
    dA_dh = -6 * M / (sig * h * h)
    dA_dsig = -6 * M / (sig * sig * h)
    return {"b": b, "h": h, "A": A, "dA_dhmax": dA_dh, "dA_dsig": dA_dsig}

def descent_demo():
    """f = (x1-3)^2 + 10 (x2+1)^2 from (0,0). Steepest descent with exact line search vs Newton vs
    steepest descent after scaling x2' = sqrt(10) x2. Returns iteration counts to |grad| < 1e-6."""
    def grad(x):
        return [2 * (x[0] - 3), 20 * (x[1] + 1)]
    H = [[2, 0], [0, 20]]
    x = [0.0, 0.0]
    it = 0
    while True:
        g = grad(x)
        if math.hypot(*g) < 1e-6 or it > 10000:
            break
        # exact step for a quadratic: a = g.g / g.H.g
        gHg = g[0] * H[0][0] * g[0] + g[1] * H[1][1] * g[1]
        a = (g[0] ** 2 + g[1] ** 2) / gHg
        x = [x[0] - a * g[0], x[1] - a * g[1]]
        it += 1
    sd_it = it
    # Newton: x - H^-1 g in one step
    g0 = grad([0.0, 0.0])
    xn = [0 - g0[0] / 2, 0 - g0[1] / 20]
    newton_it = 1 if math.hypot(*grad(xn)) < 1e-9 else 99
    # scaled: f = (x1-3)^2 + (y2 + sqrt10)^2 -> circle -> 1 step
    return {"sd_iterations": sd_it, "newton_iterations": newton_it, "sd_scaled_iterations": 1,
            "x_opt": x, "condition_number": 10.0}

def bfgs(f, x0, gtol=1e-6, itmax=200):
    """BFGS with central finite-difference gradients and backtracking (Armijo) line search."""
    n = len(x0)
    def g(x):
        out = []
        for i in range(n):
            h = 1e-6 * max(1.0, abs(x[i]))
            xp = x[:]; xm = x[:]
            xp[i] += h; xm[i] -= h
            out.append((f(xp) - f(xm)) / (2 * h))
        return out
    x = list(x0)
    Hinv = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    gx = g(x)
    it = 0
    while it < itmax and math.sqrt(sum(v * v for v in gx)) > gtol:
        p = [-sum(Hinv[i][j] * gx[j] for j in range(n)) for i in range(n)]
        a, fx = 1.0, f(x)
        slope = sum(pi * gi for pi, gi in zip(p, gx))
        while f([xi + a * pi for xi, pi in zip(x, p)]) > fx + 1e-4 * a * slope and a > 1e-12:
            a *= 0.5
        xn = [xi + a * pi for xi, pi in zip(x, p)]
        gn = g(xn)
        s = [b - c for b, c in zip(xn, x)]
        yv = [b - c for b, c in zip(gn, gx)]
        sy = sum(a1 * b1 for a1, b1 in zip(s, yv))
        if sy > 1e-12:
            Hy = [sum(Hinv[i][j] * yv[j] for j in range(n)) for i in range(n)]
            yHy = sum(yv[i] * Hy[i] for i in range(n))
            for i in range(n):
                for j in range(n):
                    Hinv[i][j] += ((sy + yHy) * s[i] * s[j]) / sy ** 2 - (Hy[i] * s[j] + s[i] * Hy[j]) / sy
        x, gx = xn, gn
        it += 1
    return x, f(x), it

def fd_step(noise_rel, f_val, f2):
    """Optimal forward-difference step: total error = h/2 |f''| + 2 eps/h, eps = noise_rel*|f|.
    h_opt = 2 sqrt(eps/|f''|), error at h_opt = 2 sqrt(eps |f''|)."""
    eps = noise_rel * abs(f_val)
    h = 2 * math.sqrt(eps / abs(f2))
    return {"eps": eps, "h_opt": h, "err_opt": 2 * math.sqrt(eps * abs(f2))}

def nelder_mead(f, x0, step=1.0, tol=1e-10, itmax=5000):
    n = len(x0)
    pts = [list(x0)] + [[x0[j] + (step if j == i else 0) for j in range(n)] for i in range(n)]
    vals = [f(p) for p in pts]
    for _ in range(itmax):
        order = sorted(range(n + 1), key=lambda i: vals[i])
        pts = [pts[i] for i in order]; vals = [vals[i] for i in order]
        if abs(vals[-1] - vals[0]) < tol and max(abs(pts[-1][j] - pts[0][j]) for j in range(n)) < 1e-9:
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

# ---------------- helical compression spring design problem (example values) -------------
SPRING = {"F": 300.0, "k": 10.0, "G": 81500.0, "rho": 7.85e-6, "tau_allow": 650.0,
          "Dout_max": 32.0, "Cmin": 4.0, "Cmax": 12.0, "lam_max": 4.0, "s_work": 30.0, "clear": 0.15}

def spring_eval(d, D, P=SPRING):
    """d wire, D mean coil diameter [mm]. Active coils n from the stiffness target k = G d^4/(8 D^3 n).
    Returns mass [kg] and normalised constraints g_i <= 0."""
    n = P["G"] * d ** 4 / (8 * D ** 3 * P["k"])
    C = D / d
    if C <= 1.5:                      # not a spring - outside the useful range
        return {"m": 1e9, "n": n, "C": C, "tau": 1e9, "L0": 1e9, "g": [1e3] * 6, "Kw": 0.0}
    Kw = (4 * C - 1) / (4 * C - 4) + 0.615 / C
    tau = Kw * 8 * P["F"] * D / (math.pi * d ** 3)
    L0 = (n + 2) * d + P["s_work"] * (1 + P["clear"])
    m = P["rho"] * (math.pi * d * d / 4) * math.pi * D * (n + 2)
    g = [tau / P["tau_allow"] - 1,
         (D + d) / P["Dout_max"] - 1,
         P["Cmin"] / C - 1,
         C / P["Cmax"] - 1,
         (L0 / D) / P["lam_max"] - 1,
         1.0 - n / 2.0]                  # at least 2 active coils
    return {"m": m, "n": n, "C": C, "tau": tau, "L0": L0, "g": g, "Kw": Kw}

BOUNDS = [(1.0, 6.0), (6.0, 40.0)]

def spring_grid(step=0.01):
    """Reference: dense grid (global) for the 2-variable spring problem."""
    best = None
    d = BOUNDS[0][0]
    while d <= BOUNDS[0][1]:
        D = BOUNDS[1][0]
        while D <= BOUNDS[1][1]:
            e = spring_eval(d, D)
            if max(e["g"]) <= 0 and (best is None or e["m"] < best[2]):
                best = (d, D, e["m"])
            D += step * 5
        d += step
    # local refinement
    d0, D0, _ = best
    for dd in [d0 + i * 0.001 for i in range(-20, 21)]:
        for DD in [D0 + j * 0.002 for j in range(-60, 61)]:
            e = spring_eval(dd, DD)
            if max(e["g"]) <= 0 and e["m"] < best[2]:
                best = (dd, DD, e["m"])
    return best

def aug_lagrangian(f_g, x0, mu=10.0, outer=30):
    """Augmented Lagrangian for inequalities (Rockafellar form) with Nelder-Mead inner solver.
    L = f + (mu/2) sum(max(0, g + lam/mu)^2 - (lam/mu)^2); lam <- max(0, lam + mu g)."""
    f0, g0 = f_g(x0)
    lam = [0.0] * len(g0)
    x = list(x0)
    for k in range(outer):
        def L(z):
            f, g = f_g(z)
            return f + 0.5 * mu * sum(max(0.0, gi + li / mu) ** 2 - (li / mu) ** 2 for gi, li in zip(g, lam))
        x, _ = nelder_mead(L, x, step=0.2 * max(1.0, abs(x[0])))
        f, g = f_g(x)
        lam = [max(0.0, li + mu * gi) for li, gi in zip(lam, g)]
        if max(g) < 1e-6 and k > 3:
            break
    return x, f_g(x)[0], lam

def ga(f_pen, bounds, pop=60, gens=150, seed=1, pc=0.9, pm=0.15):
    """Real-coded GA: tournament (2), blend crossover BLX-0.5, Gaussian mutation (10 % of range), elitism 2."""
    rnd = random.Random(seed)
    nv = len(bounds)
    P = [[rnd.uniform(lo, hi) for lo, hi in bounds] for _ in range(pop)]
    F = [f_pen(p) for p in P]
    for _ in range(gens):
        elite = sorted(range(pop), key=lambda i: F[i])[:2]
        newP = [P[i][:] for i in elite]
        while len(newP) < pop:
            def tour():
                a, b = rnd.randrange(pop), rnd.randrange(pop)
                return P[a] if F[a] < F[b] else P[b]
            p1, p2 = tour(), tour()
            if rnd.random() < pc:
                child = []
                for j in range(nv):
                    lo_, hi_ = min(p1[j], p2[j]), max(p1[j], p2[j])
                    I = hi_ - lo_
                    child.append(rnd.uniform(lo_ - 0.5 * I, hi_ + 0.5 * I))
            else:
                child = p1[:]
            for j, (lo, hi) in enumerate(bounds):
                if rnd.random() < pm:
                    child[j] += rnd.gauss(0, 0.1 * (hi - lo))
                child[j] = min(hi, max(lo, child[j]))
            newP.append(child)
        P = newP
        F = [f_pen(p) for p in P]
    i = min(range(pop), key=lambda i: F[i])
    return P[i], F[i]

def spring_pen(x, r=1e3):
    e = spring_eval(*x)
    return e["m"] * (1 + r * sum(max(0.0, gi) ** 2 for gi in e["g"]))

def spring_fg(x):
    e = spring_eval(*x)
    return e["m"], e["g"]

def spring_rsm(log_fit=True):
    """Surrogate: fit quadratic RSM of mass and of tau in (d, D) on a 5x5 grid near the design region,
    optimise the surrogates on a fine grid, then verify with the true model.
    log_fit=True fits ln(m) and ln(tau) (power-law physics -> almost exact); False fits m and tau directly."""
    pts = [(d, D) for d in (3.0, 3.5, 4.0, 4.5, 5.0) for D in (16.0, 20.0, 24.0, 28.0, 32.0)]
    X = [[1, d, D, d * d, D * D, d * D] for d, D in pts]
    tr = (lambda v: math.log(v)) if log_fit else (lambda v: v)
    inv = (lambda v: math.exp(v)) if log_fit else (lambda v: v)
    ym = [tr(spring_eval(d, D)["m"]) for d, D in pts]
    yt = [tr(spring_eval(d, D)["tau"]) for d, D in pts]
    bm = lstsq(X, ym)
    bt = lstsq(X, yt)
    sm = r2_stats(X, ym, bm)["R2"]
    st = r2_stats(X, yt, bt)["R2"]
    def q(b, d, D):
        return inv(b[0] + b[1] * d + b[2] * D + b[3] * d * d + b[4] * D * D + b[5] * d * D)
    best = None
    d = 3.0
    while d <= 5.0 + 1e-9:
        D = 16.0
        while D <= 32.0 + 1e-9:
            e = spring_eval(d, D)
            g_other = e["g"][1:]           # cheap geometric constraints exact, tau from surrogate
            if q(bt, d, D) <= SPRING["tau_allow"] and max(g_other) <= 0:
                mm = q(bm, d, D)
                if best is None or mm < best[2]:
                    best = (d, D, mm)
            D += 0.05
        d += 0.005
    d, D, mpred = best
    true = spring_eval(d, D)
    return {"d": d, "D": D, "m_pred": mpred, "m_true": true["m"], "tau_true": true["tau"],
            "R2_m": sm, "R2_tau": st, "feasible_true": max(true["g"]) <= 1e-9}

WIRE_EN10270 = [2.0, 2.25, 2.5, 2.8, 3.0, 3.2, 3.5, 3.8, 4.0, 4.5, 5.0, 5.5, 6.0]

def spring_discrete():
    """Standard wire diameters: for each d search the lightest feasible D; then round n up to 0.5 coil
    is left to the spring item (M8)."""
    best = None
    rows = []
    for d in WIRE_EN10270:
        bd = None
        D = 6.0
        while D <= 40.0:
            e = spring_eval(d, D)
            if max(e["g"]) <= 0 and (bd is None or e["m"] < bd[1]):
                bd = (D, e["m"])
            D += 0.01
        if bd:
            rows.append((d, bd[0], bd[1]))
            if best is None or bd[1] < best[2]:
                best = (d, bd[0], bd[1])
    return best, rows

def expected_improvement(fmin, mu, s):
    z = (fmin - mu) / s
    return (fmin - mu) * ND.cdf(z) + s * ND.pdf(z)

# =====================================================================================
# 30 DOE + statistics
# =====================================================================================
def betacf(a, b, x):
    MAXIT, EPS, FPMIN = 300, 3e-14, 1e-300
    qab, qap, qam = a + b, a + 1, a - 1
    c, d = 1.0, 1 - qab * x / qap
    d = 1 / (d if abs(d) > FPMIN else FPMIN)
    h = d
    for m in range(1, MAXIT + 1):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1 + aa * d; d = 1 / (d if abs(d) > FPMIN else FPMIN)
        c = 1 + aa / c; c = c if abs(c) > FPMIN else FPMIN
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1 + aa * d; d = 1 / (d if abs(d) > FPMIN else FPMIN)
        c = 1 + aa / c; c = c if abs(c) > FPMIN else FPMIN
        de = d * c
        h *= de
        if abs(de - 1) < EPS:
            break
    return h

def betainc(a, b, x):
    """Regularised incomplete beta I_x(a,b) (Numerical Recipes continued fraction)."""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lbt = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1 - x)
    bt = math.exp(lbt)
    if x < (a + 1) / (a + b + 2):
        return bt * betacf(a, b, x) / a
    return 1 - bt * betacf(b, a, 1 - x) / b

def f_pvalue(F, d1, d2):
    """P(F_{d1,d2} > F) = I_{d2/(d2+d1F)}(d2/2, d1/2)."""
    return betainc(d2 / 2, d1 / 2, d2 / (d2 + d1 * F))

def f_crit(alpha, d1, d2):
    lo, hi = 0.0, 1000.0
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        if f_pvalue(mid, d1, d2) > alpha:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)

def full_factorial(k):
    """Standard (Yates) order, -1/+1."""
    return [tuple(1 if (i >> j) & 1 else -1 for j in range(k)) for i in range(2 ** k)]

def anova_2k(k, Y, names):
    """2^k with r replicates. Y: list of lists (one list per run, standard order).
    Returns rows (term, effect, SS, df, MS, F, p) for all main effects + 2-factor interactions, and error."""
    runs = full_factorial(k)
    r = len(Y[0])
    N = 2 ** k * r
    ybar = [sum(y) / r for y in Y]
    grand = sum(sum(y) for y in Y) / N
    terms = [(i,) for i in range(k)] + [(i, j) for i in range(k) for j in range(i + 1, k)]
    if k >= 3:
        terms += [(i, j, l) for i in range(k) for j in range(i + 1, k) for l in range(j + 1, k)]
    sse = sum((yy - ybar[i]) ** 2 for i, y in enumerate(Y) for yy in y)
    dfe = 2 ** k * (r - 1)
    mse = sse / dfe
    sst = sum((yy - grand) ** 2 for y in Y for yy in y)
    rows = []
    for t in terms:
        contrast = sum(math.prod(runs[i][j] for j in t) * sum(Y[i]) for i in range(2 ** k))
        eff = contrast / (r * 2 ** (k - 1))
        ss = contrast ** 2 / (r * 2 ** k)
        Fv = ss / mse
        rows.append(("x".join(names[j] for j in t), eff, ss, 1, ss, Fv, f_pvalue(Fv, 1, dfe)))
    return {"rows": rows, "SSE": sse, "dfe": dfe, "MSE": mse, "SST": sst, "grand": grand}

def alias_structure(gen_word="ABCD", factors="ABCD"):
    """Aliases in a 2^(4-1) design with defining relation I = ABCD (word multiplication mod 2)."""
    def mult(a, b):
        return "".join(sorted(set(a) ^ set(b))) or "I"
    effects = ["A", "B", "C", "D", "AB", "AC", "AD", "BC", "BD", "CD"]
    out = {}
    for e in effects:
        out[e] = mult(e, gen_word)
    return out

def frac_2_4_1(y):
    """Runs of 2^(4-1), D = ABC. y in standard order of A,B,C. Returns estimates of the alias chains."""
    base = full_factorial(3)
    runs = [(a, b, c, a * b * c) for a, b, c in base]
    est = {}
    cols = {"A": 0, "B": 1, "C": 2, "D": 3}
    for name in ["A", "B", "C", "D", "AB", "AC", "AD"]:
        s = sum(math.prod(r[cols[ch]] for ch in name) * yy for r, yy in zip(runs, y))
        est[name] = s / 4
    return runs, est

def lhs(n, k, seed=3):
    rnd = random.Random(seed)
    cols = []
    for _ in range(k):
        perm = list(range(n))
        rnd.shuffle(perm)
        cols.append([(p + rnd.random()) / n for p in perm])
    return [tuple(cols[j][i] for j in range(k)) for i in range(n)]

def ccd_points(k=2, alpha=None):
    a = alpha if alpha else (2 ** k) ** 0.25
    pts = list(full_factorial(k))
    for j in range(k):
        for s in (-a, a):
            p = [0.0] * k; p[j] = s; pts.append(tuple(p))
    pts.append(tuple([0.0] * k))
    return pts, a

# =====================================================================================
# 31 advanced structural optimisation
# =====================================================================================
def truss_topology(nx=5, ny=3, L=1.0, E=210e9, F=10e3, vol_frac=0.2, iters=60):
    """Ground-structure truss (neighbours + diagonals), cantilever: left column fixed, load F down at the
    right middle node. Minimum compliance with volume limit; OC update A <- A*(E eps^2 / lam)^0.5."""
    nodes = [(i * L, j * L) for i in range(nx) for j in range(ny)]
    idx = lambda i, j: i * ny + j
    bars = []
    for i in range(nx):
        for j in range(ny):
            for di, dj in ((1, 0), (0, 1), (1, 1), (1, -1)):
                ii, jj = i + di, j + dj
                if 0 <= ii < nx and 0 <= jj < ny:
                    bars.append((idx(i, j), idx(ii, jj)))
    fixed = set()
    for j in range(ny):
        fixed |= {2 * idx(0, j), 2 * idx(0, j) + 1}
    free = [d for d in range(2 * len(nodes)) if d not in fixed]
    pos = {d: k for k, d in enumerate(free)}
    load = [0.0] * len(free)
    load[pos[2 * idx(nx - 1, ny // 2) + 1]] = -F
    geo = []
    for a, b in bars:
        dx, dy = nodes[b][0] - nodes[a][0], nodes[b][1] - nodes[a][1]
        l = math.hypot(dx, dy)
        geo.append((l, dx / l, dy / l))
    Vmax_total = sum(g[0] for g in geo) * 1e-3          # reference: all bars 1e-3 m^2
    Vlim = vol_frac * Vmax_total
    A = [Vlim / sum(g[0] for g in geo)] * len(bars)
    Amin = 1e-9
    hist = []
    for it in range(iters):
        K = [[0.0] * len(free) for _ in free]
        for (a, b), (l, c, s), Ai in zip(bars, geo, A):
            k = E * Ai / l
            dofs = [2 * a, 2 * a + 1, 2 * b, 2 * b + 1]
            v = [-c, -s, c, s]
            for p in range(4):
                if dofs[p] in pos:
                    for q in range(4):
                        if dofs[q] in pos:
                            K[pos[dofs[p]]][pos[dofs[q]]] += k * v[p] * v[q]
        u = solve(K, load)
        comp = sum(f * x for f, x in zip(load, u))
        hist.append(comp)
        full_u = [0.0] * (2 * len(nodes))
        for d, k in pos.items():
            full_u[d] = u[k]
        eps = []
        for (a, b), (l, c, s) in zip(bars, geo):
            du = (full_u[2 * b] - full_u[2 * a]) * c + (full_u[2 * b + 1] - full_u[2 * a + 1]) * s
            eps.append(du / l)
        lo, hi = 1e-20, 1e20
        for _ in range(200):
            lam = math.sqrt(lo * hi)
            An = [max(Amin, Ai * math.sqrt(E * e * e / lam)) for Ai, e in zip(A, eps)]
            V = sum(a_ * g[0] for a_, g in zip(An, geo))
            if V > Vlim:
                lo = lam
            else:
                hi = lam
        A = An
    Amax = max(A)
    kept = [(nodes[a], nodes[b], Ai) for (a, b), Ai in zip(bars, A) if Ai > 0.01 * Amax]
    return {"bars_total": len(bars), "kept": kept, "compliance_first": hist[0], "compliance_last": hist[-1],
            "volume": sum(a_ * g[0] for a_, g in zip(A, geo)), "Vlim": Vlim, "hist": hist}

def cantilever_pareto(F=2000.0, L=500.0, E=210000.0, sig=150.0, ratio=4.0, eps_list=(0.5, 1.0, 1.5, 2.0, 4.0)):
    """Rectangular cantilever b x h: f1 = area, f2 = tip deflection 4FL^3/(E b h^3).
    epsilon-constraint: min A s.t. delta <= eps, stress 6FL/(b h^2) <= sig, h <= ratio*b, 5 <= b,h <= 200."""
    out = []
    for eps in eps_list:
        best = None
        b = 5.0
        while b <= 60.0:
            # for given b the area is smallest with the smallest feasible h
            hmin = max(5.0,
                       math.sqrt(6 * F * L / (b * sig)),
                       (4 * F * L ** 3 / (E * b * eps)) ** (1 / 3))
            if hmin <= ratio * b and hmin <= 200:
                A = b * hmin
                if best is None or A < best[2]:
                    best = (b, hmin, A)
            b += 0.01
        bb, hh, A = best
        out.append({"eps": eps, "b": bb, "h": hh, "A": A, "delta": 4 * F * L ** 3 / (E * bb * hh ** 3),
                    "stress": 6 * F * L / (bb * hh * hh)})
    return out

def taguchi_loss(A_cost=5.0, tol=0.02, sigma=0.005, offset=0.003):
    k = A_cost / tol ** 2
    return {"k": k, "loss_per_part": k * (sigma ** 2 + offset ** 2),
            "loss_centered": k * sigma ** 2}

def sn_ratios(y):
    n = len(y)
    m = sum(y) / n
    s2 = sum((v - m) ** 2 for v in y) / (n - 1)
    return {"smaller": -10 * math.log10(sum(v * v for v in y) / n),
            "larger": -10 * math.log10(sum(1 / (v * v) for v in y) / n),
            "nominal": 10 * math.log10(m * m / s2)}

def rbdo_shaft(Mmean=400.0, Mcov=0.15, Smean=300.0, Ssd=20.0, beta_t=3.719, sf_det=2.0):
    """Shaft bending only: stress s = 32 M/(pi d^3). Strength S ~ N(Smean, Ssd), M ~ N(Mmean, cov).
    Mean-value FOSM: beta = (muS - mus)/sqrt(sdS^2 + sds^2), sds = cov*mus (stress linear in M).
    Find d for beta_t; compare with deterministic d for SF on mean values."""
    def beta(d):
        mus = 32 * Mmean * 1e3 / (math.pi * d ** 3)
        return (Smean - mus) / math.hypot(Ssd, Mcov * mus)
    lo, hi = 5.0, 100.0
    for _ in range(100):
        mid = 0.5 * (lo + hi)
        lo, hi = (lo, mid) if beta(mid) >= beta_t else (mid, hi)
    d_rel = hi
    d_det = (32 * Mmean * 1e3 * sf_det / (math.pi * Smean)) ** (1 / 3)
    return {"d_rbdo": d_rel, "beta_at_rbdo": beta(d_rel), "pf_rbdo": ND.cdf(-beta(d_rel)),
            "d_det": d_det, "beta_det": beta(d_det), "pf_det": ND.cdf(-beta(d_det))}

# =====================================================================================
# 32 testing
# =====================================================================================
def bridge(k=2.0, eps=500e-6, Uex=5.0):
    q = k * eps / 4
    return {"quarter_mV": 1000 * Uex * q, "half_mV": 1000 * Uex * 2 * q, "full_mV": 1000 * Uex * 4 * q}

def rosette_rect(ea, eb, ec, E=210000.0, nu=0.3):
    """0/45/90 rectangular rosette (strains in m/m). Principal strains, stresses (MPa), angle (deg)."""
    c = (ea + ec) / 2
    r = math.sqrt((ea - eb) ** 2 + (eb - ec) ** 2) / math.sqrt(2)
    e1, e2 = c + r, c - r
    s1 = E / (1 - nu * nu) * (e1 + nu * e2)
    s2 = E / (1 - nu * nu) * (e2 + nu * e1)
    theta = 0.5 * math.degrees(math.atan2(2 * eb - ea - ec, ea - ec))
    svm = math.sqrt(s1 * s1 - s1 * s2 + s2 * s2)
    return {"e1": e1, "e2": e2, "s1": s1, "s2": s2, "theta_deg": theta, "s_vm": svm}

def fft_plan(fmax=2000.0, N=8192):
    fs = 2.56 * fmax
    return {"fs": fs, "df": fs / N, "T": N / fs, "lines": int(N / 2.56)}

def arrhenius(Ea=0.7, T1C=40.0, T2C=85.0):
    kB = 8.617333e-5
    T1, T2 = T1C + 273.15, T2C + 273.15
    return math.exp(Ea / kB * (1 / T1 - 1 / T2))

def success_run(R=0.9, C=0.9):
    return math.log(1 - C) / math.log(R)

def lipson(R=0.9, C=0.9, Lratio=2.0, beta=2.0):
    return math.log(1 - C) / (Lratio ** beta * math.log(R))

def inverse_power(S1=100.0, S2=130.0, k=8.0):
    return (S2 / S1) ** k

# =====================================================================================
# 33 quality
# =====================================================================================
SPC_N5 = {"A2": 0.577, "D3": 0.0, "D4": 2.114, "d2": 2.326}

def xbar_r(xbarbar=30.002, rbar=0.010, c=SPC_N5):
    return {"UCLx": xbarbar + c["A2"] * rbar, "LCLx": xbarbar - c["A2"] * rbar,
            "UCLr": c["D4"] * rbar, "LCLr": c["D3"] * rbar, "sigma": rbar / c["d2"]}

def capability(mu, sigma, lsl, usl):
    cp = (usl - lsl) / (6 * sigma)
    cpk = min(usl - mu, mu - lsl) / (3 * sigma)
    ppm = 1e6 * (ND.cdf((lsl - mu) / sigma) + 1 - ND.cdf((usl - mu) / sigma))
    return {"Cp": cp, "Cpk": cpk, "ppm": ppm}

def grr(s_ev=0.0012, s_av=0.0008, s_pv=0.0045, tol=0.04):
    s_grr = math.hypot(s_ev, s_av)
    s_tot = math.hypot(s_grr, s_pv)
    return {"s_grr": s_grr, "pct_tol": 100 * 6 * s_grr / tol, "pct_tv": 100 * s_grr / s_tot,
            "ndc": 1.41 * s_pv / s_grr}

# =====================================================================================
# examples + selftest
# =====================================================================================
TURN_Y = [[1.10, 1.16], [0.98, 1.04], [2.45, 2.39], [2.20, 2.28],
          [0.72, 0.78], [0.66, 0.70], [1.58, 1.50], [1.40, 1.46]]
FRAC_Y = [212, 188, 196, 179, 205, 183, 190, 168]
KT_R = [1.0, 1.5, 2.0, 2.5, 3.0]
KT_Y = [2.10, 1.85, 1.68, 1.57, 1.50]

def compute_all():
    R = {}
    R["kkt"] = kkt_example()
    R["beam"] = beam_kkt()
    R["descent"] = descent_demo()
    rosen = lambda x: (1 - x[0]) ** 2 + 100 * (x[1] - x[0] ** 2) ** 2
    R["bfgs"] = bfgs(rosen, [-1.2, 1.0])
    R["fd"] = fd_step(1e-4, 200.0, 50.0)
    R["grid"] = spring_grid()
    R["al"] = aug_lagrangian(spring_fg, [3.5, 25.0])
    R["ga"] = ga(spring_pen, BOUNDS)
    R["rsm"] = spring_rsm(True)
    R["rsm_lin"] = spring_rsm(False)
    R["disc"] = spring_discrete()
    R["ei"] = expected_improvement(0.120, 0.115, 0.010)
    R["anova"] = anova_2k(3, TURN_Y, ["A", "B", "C"])
    R["fcrit"] = f_crit(0.05, 1, 8)
    R["alias"] = alias_structure()
    R["frac"] = frac_2_4_1(FRAC_Y)
    X = [[1, r, r * r] for r in KT_R]
    b = lstsq(X, KT_Y)
    R["kt"] = (b, r2_stats(X, KT_Y, b))
    X1 = [[1, r] for r in KT_R]
    b1 = lstsq(X1, KT_Y)
    R["kt_lin"] = (b1, r2_stats(X1, KT_Y, b1))
    R["ccd"] = ccd_points(2)
    R["lhs"] = lhs(5, 2)
    R["truss"] = truss_topology()
    R["pareto"] = cantilever_pareto()
    R["taguchi"] = taguchi_loss()
    R["sn"] = sn_ratios([0.82, 0.95, 0.88, 0.91])
    R["rbdo"] = rbdo_shaft()
    R["bridge"] = bridge()
    R["rosette"] = rosette_rect(600e-6, 200e-6, -100e-6)
    R["fft"] = fft_plan()
    R["arr"] = arrhenius()
    R["sr"] = success_run()
    R["lip"] = lipson()
    R["ipl"] = inverse_power()
    R["spc"] = xbar_r()
    R["cap"] = capability(30.002, R["spc"]["sigma"], 29.98, 30.02)
    R["grr"] = grr()
    return R

def cmd_examples():
    R = compute_all()
    k = R["kkt"]; print("29 KKT: x =", k["x"], "lambda =", k["lambda"], "f* =", k["f"], "df*/db = %.4f" % k["dfdb"])
    b = R["beam"]; print("29 beam KKT: b = %.2f mm, h = %.0f mm, A = %.1f mm2, dA/dhmax = %.2f mm2/mm, dA/dsig = %.3f mm2/MPa"
                         % (b["b"], b["h"], b["A"], b["dA_dhmax"], b["dA_dsig"]))
    d = R["descent"]; print("29 descent: SD %d iterations, Newton %d, SD scaled %d (cond = %.0f)"
                            % (d["sd_iterations"], d["newton_iterations"], d["sd_scaled_iterations"], d["condition_number"]))
    x, f, it = R["bfgs"]; print("29 BFGS Rosenbrock: x = (%.5f, %.5f), f = %.2e, %d iterations" % (x[0], x[1], f, it))
    fd = R["fd"]; print("29 FD step: eps = %.3f, h_opt = %.4f, error = %.4f" % (fd["eps"], fd["h_opt"], fd["err_opt"]))
    g = R["grid"]; e = spring_eval(g[0], g[1])
    print("29 spring grid: d = %.3f, D = %.2f, m = %.2f g, n = %.2f, C = %.2f, tau = %.1f, L0 = %.1f, L0/D = %.2f"
          % (g[0], g[1], 1000 * g[2], e["n"], e["C"], e["tau"], e["L0"], e["L0"] / g[1]))
    print("   active g:", ["%.4f" % v for v in e["g"]])
    x, m, lam = R["al"]; print("29 aug. Lagrangian: d = %.3f, D = %.2f, m = %.2f g, lambda =" % (x[0], x[1], 1000 * m),
                               ["%.3g" % v for v in lam])
    x, fp = R["ga"]; e = spring_eval(*x); print("29 GA: d = %.3f, D = %.2f, m = %.2f g, max g = %.2e" % (x[0], x[1], 1000 * e["m"], max(e["g"])))
    r = R["rsm"]; print("29 RSM: d = %.3f, D = %.2f, m_pred = %.2f g, m_true = %.2f g, tau_true = %.1f, R2 m = %.4f, R2 tau = %.4f, feasible %s"
                        % (r["d"], r["D"], 1000 * r["m_pred"], 1000 * r["m_true"], r["tau_true"], r["R2_m"], r["R2_tau"], r["feasible_true"]))
    r = R["rsm_lin"]; print("29 RSM (no log): d = %.3f, D = %.2f, m_pred = %.2f g, m_true = %.2f g, tau_true = %.1f, R2 m = %.4f, feasible %s"
                        % (r["d"], r["D"], 1000 * r["m_pred"], 1000 * r["m_true"], r["tau_true"], r["R2_m"], r["feasible_true"]))
    best, rows = R["disc"]; print("29 discrete: best d = %.2f, D = %.2f, m = %.2f g" % (best[0], best[1], 1000 * best[2]))
    for row in rows:
        print("     d %.2f  D %.2f  m %.2f g" % (row[0], row[1], 1000 * row[2]))
    print("29 EI = %.5f" % R["ei"])
    a = R["anova"]
    print("30 ANOVA: grand mean %.4f, SSE %.5f, dfe %d, MSE %.6f, SST %.4f, Fcrit(0.05;1,8) = %.3f"
          % (a["grand"], a["SSE"], a["dfe"], a["MSE"], a["SST"], R["fcrit"]))
    for row in a["rows"]:
        print("     %-6s effect %+.4f  SS %.5f  F %10.1f  p %.2e" % (row[0], row[1], row[2], row[5], row[6]))
    print("30 aliases:", R["alias"])
    runs, est = R["frac"]; print("30 2^(4-1) estimates:", {k: round(v, 2) for k, v in est.items()})
    (bq, sq), (bl, sl) = R["kt"], R["kt_lin"]
    print("30 Kt RSM quadratic: b = %s, R2 = %.4f, R2adj = %.4f, residuals %s" % (["%.4f" % v for v in bq], sq["R2"], sq["R2_adj"], ["%.4f" % v for v in sq["residuals"]]))
    print("30 Kt linear: b = %s, R2 = %.4f, R2adj = %.4f" % (["%.4f" % v for v in bl], sl["R2"], sl["R2_adj"]))
    pts, al = R["ccd"]; print("30 CCD k=2: alpha = %.4f, %d points" % (al, len(pts)))
    print("30 LHS 5x2:", [tuple(round(v, 3) for v in p) for p in R["lhs"]])
    t = R["truss"]; print("31 truss: %d bars in ground structure, %d kept, compliance %.3f -> %.3f J, V %.6f / %.6f m3"
                          % (t["bars_total"], len(t["kept"]), t["compliance_first"], t["compliance_last"], t["volume"], t["Vlim"]))
    for a_, b_, A_ in t["kept"]:
        print("     (%.0f,%.0f)-(%.0f,%.0f)  A = %.1f mm2" % (a_[0], a_[1], b_[0], b_[1], A_ * 1e6))
    for p in R["pareto"]:
        print("31 pareto eps %.1f: b = %.2f, h = %.2f, A = %.1f, delta = %.3f, stress = %.1f" % (p["eps"], p["b"], p["h"], p["A"], p["delta"], p["stress"]))
    tg = R["taguchi"]; print("31 Taguchi: k = %.0f, loss = %.3f, centred = %.4f" % (tg["k"], tg["loss_per_part"], tg["loss_centered"]))
    print("31 S/N:", {k: round(v, 2) for k, v in R["sn"].items()})
    rb = R["rbdo"]; print("31 RBDO: d_rbdo = %.2f (beta %.3f, pf %.2e), d_det = %.2f (beta %.3f, pf %.2e)"
                          % (rb["d_rbdo"], rb["beta_at_rbdo"], rb["pf_rbdo"], rb["d_det"], rb["beta_det"], rb["pf_det"]))
    br = R["bridge"]; print("32 bridge: quarter %.3f mV, half %.3f mV, full %.3f mV" % (br["quarter_mV"], br["half_mV"], br["full_mV"]))
    ro = R["rosette"]; print("32 rosette: e1 %.1f, e2 %.1f um/m, s1 %.1f, s2 %.1f MPa, theta %.1f deg, s_vm %.1f"
                             % (ro["e1"] * 1e6, ro["e2"] * 1e6, ro["s1"], ro["s2"], ro["theta_deg"], ro["s_vm"]))
    ff = R["fft"]; print("32 FFT: fs %.0f Hz, df %.3f Hz, T %.2f s, lines %d" % (ff["fs"], ff["df"], ff["T"], ff["lines"]))
    print("32 Arrhenius AF = %.2f; success run n = %.2f; Lipson n = %.2f; inverse power factor = %.2f"
          % (R["arr"], R["sr"], R["lip"], R["ipl"]))
    s = R["spc"]; print("33 SPC: UCLx %.5f LCLx %.5f UCLr %.5f sigma %.5f" % (s["UCLx"], s["LCLx"], s["UCLr"], s["sigma"]))
    c = R["cap"]; print("33 capability: Cp %.3f Cpk %.3f ppm %.1f" % (c["Cp"], c["Cpk"], c["ppm"]))
    gr = R["grr"]; print("33 GRR: s_grr %.5f, %%tol %.1f, %%TV %.1f, ndc %.2f" % (gr["s_grr"], gr["pct_tol"], gr["pct_tv"], gr["ndc"]))

def cmd_selftest():
    R = compute_all()
    ok = []
    def near(name, a, b, tol):
        good = abs(a - b) <= tol
        ok.append(good)
        print("%-36s %14.6g  expect %14.6g  %s" % (name, a, b, "OK" if good else "FAIL"))
    near("KKT df*/db = lambda", R["kkt"]["dfdb"], 4.0, 1e-6)
    near("beam b", R["beam"]["b"], 5.556, 0.001)
    near("SD iterations > 10", float(R["descent"]["sd_iterations"] > 10), 1.0, 0)
    near("BFGS x1", R["bfgs"][0][0], 1.0, 1e-3)
    near("FD h_opt", R["fd"]["h_opt"], 0.04, 1e-6)
    g = R["grid"]
    near("spring grid mass g", 1000 * g[2], 48.55, 0.05)
    near("AL mass vs grid", 1000 * R["al"][1], 1000 * g[2], 0.1)
    near("GA mass vs grid (within 1 %)", 1000 * spring_eval(*R["ga"][0])["m"], 1000 * g[2], 0.01 * 1000 * g[2])
    near("RSM log tau_true vs allow (1 %)", R["rsm"]["tau_true"], 650.0, 6.5)
    near("RSM log m_true vs grid (2 %)", 1000 * R["rsm"]["m_true"], 1000 * g[2], 0.02 * 1000 * g[2])
    near("RBDO d", R["rbdo"]["d_rbdo"], 28.47, 0.01)
    near("discrete d", R["disc"][0][0], 3.2, 1e-9)
    near("Fcrit(0.05;1,8)", R["fcrit"], 5.318, 0.002)
    near("ANOVA effect B", R["anova"]["rows"][1][1], 1.015, 1e-4)
    near("alias AB", float(R["alias"]["AB"] == "CD"), 1.0, 0)
    near("Kt R2 quadratic", R["kt"][1]["R2"], 0.9993, 0.0002)
    near("truss compliance falls", float(R["truss"]["compliance_last"] < R["truss"]["compliance_first"]), 1.0, 0)
    near("Taguchi loss", R["taguchi"]["loss_per_part"], 0.425, 1e-9)
    near("bridge quarter mV", R["bridge"]["quarter_mV"], 1.25, 1e-9)
    near("rosette e1 um/m", R["rosette"]["e1"] * 1e6, 603.6, 0.1)
    near("FFT df", R["fft"]["df"], 0.625, 1e-9)
    near("Arrhenius AF", R["arr"], 26.0, 0.1)
    near("success run n", R["sr"], 21.85, 0.01)
    near("Lipson n", R["lip"], 5.46, 0.01)
    near("SPC UCLx", R["spc"]["UCLx"], 30.00777, 1e-5)
    near("Cpk", R["cap"]["Cpk"], 1.395, 0.002)
    near("GRR %tol", R["grr"]["pct_tol"], 21.6, 0.1)
    near("ndc", R["grr"]["ndc"], 4.40, 0.01)
    print("SELFTEST", "PASS" if all(ok) else "FAIL")
    return 0 if all(ok) else 1

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "examples":
        cmd_examples()
    elif len(sys.argv) > 1 and sys.argv[1] == "selftest":
        sys.exit(cmd_selftest())
    else:
        print(__doc__)
