#!/usr/bin/env python3
"""M12 optimisation-workflow program - the loop  CAD parameters -> CAE solver -> responses -> DOE / surrogate ->
optimiser -> verification, and its coupling to SOLIDWORKS, Ansys, Abaqus, Adams and MATLAB.
Contents: a "virtual CAE" solver (2-D Euler-Bernoulli beam finite elements with consistent mass, point masses and
spring supports: static deflection / bending stress and natural frequencies by Cholesky + Jacobi), the default
design problem (2.5 m compressor package base frame with the receiver, M11, on isolation mounts), a workflow engine (design variables, evaluation
cache with CSV log, failure handling, file-based coupling to any external solver through an input template, a
command and a regex parser), design of experiments (Latin hypercube), surrogates (quadratic response surface,
Kriging with maximum-likelihood width and leave-one-out check), optimisers (bounded Nelder-Mead with penalties,
multi-start), efficient global optimisation (expected improvement infill), CAE model updating to measured
frequencies, and generators for the scripts of the user's tools.
Guide: 12_optimisation_workflows.md.

Python standard library only (offline). Every number of the guide comes from this file.

Commands
  python optflow.py params | run [--in p.json] [--out folder] | examples | selftest
  python optflow.py solve --in design.json --out result.txt   the virtual CAE solver as an external program (file in / file out)
  python optflow.py export --out folder                       write the SOLIDWORKS / Ansys / Abaqus / Adams / MATLAB templates
  python optflow.py ch24 | ch56 | ch78                        extra results of guide chapters 2-4, 5-6, 7-8
  python optflow.py run --in examples/optflow_example.json --out example   worked example (chapter 8)

The frame data, masses, mount data and limits are EXAMPLE VALUES. The exported scripts are TEMPLATES written from the
documented APIs - names of features, parameters and result items must be adapted to the real model and checked
against the installed software version. All default numbers are EXAMPLES.
"""
import json
import math
import os
import random
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- default design problem
DEFAULT = {
    "name": "Compressor package base frame with receiver on isolation mounts (M11): minimum mass with frequency targets (example)",
    "L": 2500.0,                       # frame length mm (two longitudinal RHS beams, modelled as one 2-D beam pair)
    "b": 60.0, "t": 4.0,               # RHS width and wall mm (height h is a design variable)
    "E": 210000.0, "rho": 7.85e-9,     # MPa, t/mm3 (N, mm, s, t units)
    "masses": [[600.0, 0.120], [1250.0, 0.030], [2050.0, 0.065]],   # [x mm, mass t]: compressor 120 kg, motor 30 kg, 150 L receiver 52 kg + fittings (M11)
    "F_shake": 264.0,                  # compressor shaking force amplitude N (M2) at the compressor position
    "dyn": 1.5,                        # factor on gravity for the static stress case
    "n_el": 16,                        # finite elements along the frame (refined at masses and mounts)
    "vars": [   # name, lower, upper, unit
        ["h", 60.0, 160.0, "mm"], ["a", 50.0, 600.0, "mm"], ["k", 20.0, 400.0, "N/mm"]],
    "x0": [100.0, 300.0, 120.0],       # current design: RHS 100x60x4, mounts 300 mm from the ends, 120 N/mm per mount
    "limits": {"f_rigid_max": 10.0, "f_bend_min": 60.3, "sag_max": 6.0, "sigma_max": 100.0},
    "doe_n": 20, "seed": 7, "ego_iter": 12, "starts": 6, "direct_budget": 150,   # budget = solver calls per start of the direct search
    "f_exc": [24.1, 48.2],             # compressor orders Hz (M2, 1450 rpm)
}

# ---------------------------------------------------------------- small linear algebra (stdlib)
def zeros(n, m=None):
    return [[0.0] * (m if m else n) for _ in range(n)]

def solve(A, b):
    """Gauss elimination with partial pivoting (A copied)."""
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        if abs(M[c][c]) < 1e-300:
            raise ValueError("singular matrix")
        for r in range(c + 1, n):
            f = M[r][c] / M[c][c]
            if f:
                for k in range(c, n + 1):
                    M[r][k] -= f * M[c][k]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (M[r][n] - sum(M[r][k] * x[k] for k in range(r + 1, n))) / M[r][r]
    return x

def cholesky(A):
    n = len(A)
    L = zeros(n)
    for i in range(n):
        for j in range(i + 1):
            s = A[i][j] - sum(L[i][k] * L[j][k] for k in range(j))
            if i == j:
                if s <= 0:
                    raise ValueError("matrix not positive definite")
                L[i][i] = math.sqrt(s)
            else:
                L[i][j] = s / L[j][j]
    return L

def jacobi_eig(A, tol=1e-12, sweeps=100):
    """Eigenvalues of a symmetric matrix by cyclic Jacobi rotations (sorted)."""
    n = len(A)
    A = [r[:] for r in A]
    for _ in range(sweeps):
        rotated = False
        for p in range(n - 1):
            for q in range(p + 1, n):
                # relative test per pair: small eigenvalues converge as well as large ones (wide frequency range)
                if abs(A[p][q]) <= tol * 1e-3 * math.sqrt(abs(A[p][p] * A[q][q])) or abs(A[p][q]) < 1e-300:
                    continue
                rotated = True
                th = (A[q][q] - A[p][p]) / (2 * A[p][q])
                t = (1 if th >= 0 else -1) / (abs(th) + math.sqrt(th * th + 1))
                c = 1 / math.sqrt(t * t + 1)
                s = t * c
                for k in range(n):
                    akp, akq = A[k][p], A[k][q]
                    A[k][p], A[k][q] = c * akp - s * akq, s * akp + c * akq
                for k in range(n):
                    apk, aqk = A[p][k], A[q][k]
                    A[p][k], A[q][k] = c * apk - s * aqk, s * apk + c * aqk
        if not rotated:
            break
    return sorted(A[i][i] for i in range(n))

def gen_eig(K, M):
    """K phi = lambda M phi  ->  L^-1 K L^-T y = lambda y with M = L L^T."""
    n = len(K)
    L = cholesky(M)
    # X = L^-1 K  (forward substitution column by column), then A = X L^-T
    X = zeros(n)
    for c in range(n):
        for i in range(n):
            X[i][c] = (K[i][c] - sum(L[i][k] * X[k][c] for k in range(i))) / L[i][i]
    A = zeros(n)
    for r in range(n):
        for i in range(n):
            A[r][i] = (X[r][i] - sum(A[r][k] * L[i][k] for k in range(i))) / L[i][i]
    return jacobi_eig([[0.5 * (A[i][j] + A[j][i]) for j in range(n)] for i in range(n)])

# ---------------------------------------------------------------- chapter 4: virtual CAE - beam finite elements
def rhs_section(h, b, t):
    """RHS h x b x t (sharp corners): A, I (bending about the horizontal axis), W."""
    A = b * h - (b - 2 * t) * (h - 2 * t)
    I = (b * h ** 3 - (b - 2 * t) * (h - 2 * t) ** 3) / 12
    return A, I, 2 * I / h

def beam_k(EI, l):
    c = EI / l ** 3
    return [[12 * c, 6 * l * c, -12 * c, 6 * l * c], [6 * l * c, 4 * l * l * c, -6 * l * c, 2 * l * l * c],
            [-12 * c, -6 * l * c, 12 * c, -6 * l * c], [6 * l * c, 2 * l * l * c, -6 * l * c, 4 * l * l * c]]

def beam_m(rhoA, l):
    c = rhoA * l / 420
    return [[156 * c, 22 * l * c, 54 * c, -13 * l * c], [22 * l * c, 4 * l * l * c, 13 * l * c, -3 * l * l * c],
            [54 * c, 13 * l * c, 156 * c, -22 * l * c], [-13 * l * c, -3 * l * l * c, -22 * l * c, 4 * l * l * c]]

def mesh(L, n_el, special):
    """Uniform nodes plus the special points (mounts, masses). Points closer than tol = 1e-3 L / n_el are merged
    (special points win over grid points), so a mount at 600.0001 next to a mass at 600 never creates a tiny element."""
    tol = 1e-3 * L / n_el
    sp = sorted(s for s in special if 0 <= s <= L)
    pts = sorted(sp + [g for g in (L * i / n_el for i in range(n_el + 1)) if all(abs(g - s) > tol for s in sp)])
    out = []
    for x in pts:
        if not out or x - out[-1] > tol:
            out.append(x)
    return out

def frame_fe(P, h, a, k, n_el=None, EI_factor=1.0, k_factor=1.0):
    """Two RHS beams (one 2-D beam with 2 x EI, 2 x mass), point masses, 4 mounts (2 per position, spring 2k each).
    Returns natural frequencies, static sag, maximum bending stress (gravity x dyn + shaking force), beam mass."""
    L = P["L"]
    A, I, W = rhs_section(h, P["b"], P["t"])
    EI, rhoA = 2 * P["E"] * I * EI_factor, 2 * P["rho"] * A
    sup = [a, L - a]
    xs = mesh(L, n_el or P["n_el"], sup + [m[0] for m in P["masses"]])
    n = 2 * len(xs)
    K, M = zeros(n), zeros(n)
    for e in range(len(xs) - 1):
        l = xs[e + 1] - xs[e]
        ke, me = beam_k(EI, l), beam_m(rhoA, l)
        d = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3]
        for i in range(4):
            for j in range(4):
                K[d[i]][d[j]] += ke[i][j]
                M[d[i]][d[j]] += me[i][j]
    idx = lambda x: min(range(len(xs)), key=lambda i: abs(xs[i] - x))
    for s in sup:
        K[2 * idx(s)][2 * idx(s)] += 2 * k * k_factor
    for x, m in P["masses"]:
        M[2 * idx(x)][2 * idx(x)] += m
    lam = gen_eig(K, M)
    f = [math.sqrt(max(l_, 0.0)) / (2 * math.pi) for l_ in lam]
    # static: gravity x dyn on masses and beam (lumped half-element), + shaking force at the compressor
    g = 9810.0
    Fg = [0.0] * n                     # gravity (1 g) on beam (lumped half elements) and masses
    for e in range(len(xs) - 1):
        l = xs[e + 1] - xs[e]
        for nd in (e, e + 1):
            Fg[2 * nd] -= rhoA * g * l / 2
    for x, m in P["masses"]:
        Fg[2 * idx(x)] -= m * g
    ug = solve(K, Fg)
    sag0 = -0.5 * (ug[2 * idx(sup[0])] + ug[2 * idx(sup[1])])       # mean static compression of the mounts
    F = [P["dyn"] * v for v in Fg]
    F[2 * idx(P["masses"][0][0])] -= P["F_shake"]
    u = solve(K, F)
    Mmax = 0.0
    for e in range(len(xs) - 1):
        l = xs[e + 1] - xs[e]
        w1, t1, w2, t2 = u[2 * e:2 * e + 4]
        for xi in (0.0, 1.0):          # w'' at the element ends (Hermite shape functions)
            B = [(-6 + 12 * xi) / l ** 2, (-4 + 6 * xi) / l, (6 - 12 * xi) / l ** 2, (-2 + 6 * xi) / l]
            Mmax = max(Mmax, abs(EI * (B[0] * w1 + B[1] * t1 + B[2] * w2 + B[3] * t2)))
    return {"f": f, "sag": sag0, "sigma": Mmax / (2 * W), "mass_kg": rhoA * L * 1000, "n_dof": n, "nodes": xs, "u": u}

def responses(P, x, n_el=None):
    """Design point -> responses: beam mass, highest rigid-body (mount) frequency, first bending frequency, sag, stress."""
    h, a, k = x
    r = frame_fe(P, h, a, k, n_el)
    return {"mass_kg": r["mass_kg"], "f_rigid": r["f"][1], "f_bend": r["f"][2], "sag": r["sag"], "sigma": r["sigma"],
            "f": r["f"][:4]}

def constraints(P, R):
    """g <= 0 means satisfied (normalised)."""
    lim = P["limits"]
    return {"f_rigid": R["f_rigid"] / lim["f_rigid_max"] - 1, "f_bend": 1 - R["f_bend"] / lim["f_bend_min"],
            "sag": R["sag"] / lim["sag_max"] - 1, "sigma": R["sigma"] / lim["sigma_max"] - 1}

# ---------------------------------------------------------------- chapter 2/3: workflow engine
class Workflow:
    """Evaluation engine: bounds, cache (no point is solved twice), log of every call, failure -> None."""
    def __init__(self, P, solver=None, log=None):
        self.P, self.solver = P, solver or (lambda x: responses(P, x))
        self.cache, self.log, self.calls, self.fails = {}, log, 0, 0
        self.lo = [v[1] for v in P["vars"]]
        self.hi = [v[2] for v in P["vars"]]

    def key(self, x):
        return tuple(round(v, 6) for v in x)

    def evaluate(self, x):
        k = self.key(x)
        if k in self.cache:
            return self.cache[k]
        self.calls += 1
        try:
            R = self.solver(list(x))
        except Exception as ex:                       # a crashed CAE run must not stop the optimisation
            self.fails += 1
            R = None
            err = str(ex)
        self.cache[k] = R
        if self.log is not None:
            self.log.append({"x": list(k), "R": R, "err": None if R else err})
        return R

    def penalised(self, x, r=1e3):
        """Objective with exterior penalty; out of bounds or failed -> large value."""
        if any(v < l - 1e-9 or v > u + 1e-9 for v, l, u in zip(x, self.lo, self.hi)):
            return 1e9
        R = self.evaluate(x)
        if R is None:
            return 1e8
        g = constraints(self.P, R)
        return R["mass_kg"] + r * sum(max(0.0, v) ** 2 for v in g.values())

def file_solver(P, workdir, cmd=None):
    """File-based coupling as used with any external CAE program: write the input from a template, run a command,
    parse the result file with regular expressions. Default command: this program's own 'solve' (offline demo)."""
    os.makedirs(workdir, exist_ok=True)
    me = os.path.abspath(__file__)
    def solver(x):
        inp, out = os.path.join(workdir, "design.json"), os.path.join(workdir, "result.txt")
        with open(inp, "w", encoding="utf-8") as f:
            json.dump(dict(P, x=x), f)
        c = cmd or [sys.executable, me, "solve", "--in", inp, "--out", out]
        subprocess.run(c, check=True, capture_output=True, timeout=120)
        txt = open(out, encoding="utf-8").read()
        get = lambda name: float(re.search(r"^%s\s*=\s*([-+0-9.eE]+)" % name, txt, re.M).group(1))
        return {"mass_kg": get("MASS"), "f_rigid": get("F_RIGID"), "f_bend": get("F_BEND"), "sag": get("SAG"), "sigma": get("SIGMA"),
                "f": [get("F1"), get("F2"), get("F3"), get("F4")]}
    return solver

def cmd_solve(argv):
    P = json.load(open(argv[argv.index("--in") + 1], encoding="utf-8"))
    R = responses(P, P["x"])
    with open(argv[argv.index("--out") + 1], "w", encoding="utf-8") as f:
        f.write("MASS = %.9g\nF_RIGID = %.9g\nF_BEND = %.9g\nSAG = %.9g\nSIGMA = %.9g\n" % (R["mass_kg"], R["f_rigid"], R["f_bend"], R["sag"], R["sigma"]))
        for i, v in enumerate(R["f"]):
            f.write("F%d = %.9g\n" % (i + 1, v))

# ---------------------------------------------------------------- chapter 5: DOE and surrogates
def lhs(n, lo, hi, seed=1):
    """Latin hypercube: each variable range cut into n strata, one point per stratum, random pairing."""
    rnd = random.Random(seed)
    cols = []
    for l, u in zip(lo, hi):
        p = list(range(n))
        rnd.shuffle(p)
        cols.append([l + (u - l) * (pi + rnd.random()) / n for pi in p])
    return [list(r) for r in zip(*cols)]

def norm(x, lo, hi):
    return [(v - l) / (u - l) for v, l, u in zip(x, lo, hi)]

def quad_terms(z):
    k = len(z)
    return [1.0] + list(z) + [z[i] * z[j] for i in range(k) for j in range(i, k)]

def rsm_fit(Z, y):
    X = [quad_terms(z) for z in Z]
    m = len(X[0])
    XtX = [[sum(r[i] * r[j] for r in X) for j in range(m)] for i in range(m)]
    Xty = [sum(r[i] * yi for r, yi in zip(X, y)) for i in range(m)]
    beta = solve([[XtX[i][j] + (1e-12 if i == j else 0) for j in range(m)] for i in range(m)], Xty)
    return lambda z: sum(b * t for b, t in zip(beta, quad_terms(z)))

class Kriging:
    """Ordinary Kriging, Gaussian correlation R_ij = exp(-sum theta (z_i - z_j)^2), one theta per variable chosen
    from a grid by maximum concentrated likelihood; small nugget for conditioning."""
    def __init__(self, Z, y, nugget=1e-8, grid=(0.3, 1.0, 3.0, 10.0, 30.0)):
        self.Z, self.y, self.nug = Z, y, nugget
        best = None
        k = len(Z[0])
        import itertools
        for th in itertools.product(grid, repeat=k):
            try:
                fit = self._fit(list(th))
            except ValueError:
                continue
            if best is None or fit["lnL"] > best["lnL"]:
                best = fit
        self.__dict__.update(best)

    def _corr(self, a, b, th):
        return math.exp(-sum(t * (u - v) ** 2 for t, u, v in zip(th, a, b)))

    def _fit(self, th):
        Z, y, n = self.Z, self.y, len(self.y)
        R = [[self._corr(Z[i], Z[j], th) + (self.nug if i == j else 0.0) for j in range(n)] for i in range(n)]
        L = cholesky(R)
        def Rinv(v):
            w = [0.0] * n
            for i in range(n):
                w[i] = (v[i] - sum(L[i][k] * w[k] for k in range(i))) / L[i][i]
            x = [0.0] * n
            for i in range(n - 1, -1, -1):
                x[i] = (w[i] - sum(L[k][i] * x[k] for k in range(i + 1, n))) / L[i][i]
            return x
        one = [1.0] * n
        Ri1, Riy = Rinv(one), Rinv(y)
        mu = sum(Riy) / sum(Ri1)
        res = [yi - mu for yi in y]
        Rir = Rinv(res)
        s2 = sum(r * q for r, q in zip(res, Rir)) / n
        logdet = 2 * sum(math.log(L[i][i]) for i in range(n))
        return {"theta": th, "mu": mu, "s2": max(s2, 1e-300), "w": Rir, "Rinv": Rinv, "Ri1": Ri1, "lnL": -0.5 * (n * math.log(max(s2, 1e-300)) + logdet)}

    def predict(self, z, var=False):
        r = [self._corr(z, zi, self.theta) for zi in self.Z]
        m = self.mu + sum(a * b for a, b in zip(r, self.w))
        if not var:
            return m
        Rir = self.Rinv(r)
        one_term = (1 - sum(Rir)) ** 2 / sum(self.Ri1)
        s2 = self.s2 * max(0.0, 1 - sum(a * b for a, b in zip(r, Rir)) + one_term)
        return m, math.sqrt(s2)

def loo_error(Z, y, make):
    """Leave-one-out: refit without point i, predict it; RMS error relative to the response range."""
    e = []
    for i in range(len(y)):
        s = make(Z[:i] + Z[i + 1:], y[:i] + y[i + 1:])
        e.append(s(Z[i]) - y[i])
    rng = (max(y) - min(y)) or 1.0
    return math.sqrt(sum(v * v for v in e) / len(e)) / rng

# ---------------------------------------------------------------- chapter 6: optimisers, EGO
def nelder_mead(f, x0, step, tol=1e-6, itmax=600, fmax=None):
    n = len(x0)
    S = [list(x0)] + [[x0[j] + (step[j] if j == i else 0.0) for j in range(n)] for i in range(n)]
    F = [f(s) for s in S]
    nf = n + 1
    for _ in range(itmax):
        if fmax and nf >= fmax:                      # evaluation budget (expensive solver)
            break
        nf += 2
        o = sorted(range(n + 1), key=lambda i: F[i])
        S, F = [S[i] for i in o], [F[i] for i in o]
        if abs(F[-1] - F[0]) <= tol * (abs(F[0]) + 1e-12) and max(abs(S[-1][j] - S[0][j]) for j in range(n)) < 1e-6:
            break
        c = [sum(S[i][j] for i in range(n)) / n for j in range(n)]
        xr = [c[j] + (c[j] - S[-1][j]) for j in range(n)]
        fr = f(xr)
        if fr < F[0]:
            xe = [c[j] + 2 * (c[j] - S[-1][j]) for j in range(n)]
            fe = f(xe)
            S[-1], F[-1] = (xe, fe) if fe < fr else (xr, fr)
        elif fr < F[-2]:
            S[-1], F[-1] = xr, fr
        else:
            xc = [c[j] + 0.5 * (S[-1][j] - c[j]) for j in range(n)]
            fc = f(xc)
            if fc < F[-1]:
                S[-1], F[-1] = xc, fc
            else:
                S = [S[0]] + [[S[0][j] + 0.5 * (s[j] - S[0][j]) for j in range(n)] for s in S[1:]]
                F = [F[0]] + [f(s) for s in S[1:]]
    i = min(range(n + 1), key=lambda i: F[i])
    return S[i], F[i]

def multistart(f, lo, hi, starts=6, seed=3, fmax=None):
    """Nelder-Mead from several LHS start points (in normalised space); best result. fmax = evaluation budget per start."""
    best = None
    for z0 in lhs(starts, [0.0] * len(lo), [1.0] * len(lo), seed):
        z, v = nelder_mead(f, z0, [0.15] * len(lo), fmax=fmax)
        if best is None or v < best[1]:
            best = (z, v)
    return best

def phi(x):
    return math.exp(-0.5 * x * x) / math.sqrt(2 * math.pi)

def Phi(x):
    return 0.5 * math.erfc(-x / math.sqrt(2))

def expected_improvement(fmin, mu, s):
    if s <= 1e-12:
        return 0.0
    z = (fmin - mu) / s
    return (fmin - mu) * Phi(z) + s * phi(z)

def surrogate_models(P, X, Rs):
    """Kriging for mass and every constraint response (normalised inputs)."""
    lo, hi = [v[1] for v in P["vars"]], [v[2] for v in P["vars"]]
    Z = [norm(x, lo, hi) for x in X]
    keys = ["mass_kg", "f_rigid", "f_bend", "sag", "sigma"]
    return {k: Kriging(Z, [R[k] for R in Rs]) for k in keys}, Z

def surrogate_optimum(P, models, r=1e3):
    lo, hi = [v[1] for v in P["vars"]], [v[2] for v in P["vars"]]
    def f(z):
        if any(v < 0 or v > 1 for v in z):
            return 1e9
        R = {k: m.predict(z) for k, m in models.items()}
        g = constraints(P, R)
        return R["mass_kg"] + r * sum(max(0.0, v) ** 2 for v in g.values())
    z, v = multistart(f, lo, hi, P["starts"], P["seed"])
    return [l + zi * (u - l) for zi, l, u in zip(z, lo, hi)], v

def feasible(P, R, tol=1e-3):
    return R is not None and all(v <= tol for v in constraints(P, R).values())

def ego(P, wf):
    """DOE -> Kriging -> infill loop: each iteration adds the surrogate optimum (exploitation) and the point of
    maximum constrained expected improvement EI x P(feasible) (exploration); best feasible true design returned."""
    lo, hi = wf.lo, wf.hi
    X = lhs(P["doe_n"], lo, hi, P["seed"])
    Rs = [wf.evaluate(x) for x in X]
    hist = []
    for it in range(P["ego_iter"]):
        ok = [(x, R) for x, R in zip(X, Rs) if R is not None]
        models, Z = surrogate_models(P, [x for x, _ in ok], [R for _, R in ok])
        fe = [R["mass_kg"] for _, R in ok if feasible(P, R)]
        fmin = min(fe) if fe else max(R["mass_kg"] for _, R in ok)
        xs, _ = surrogate_optimum(P, models)
        def neg_cei(z):
            if any(v < 0 or v > 1 for v in z):
                return 1e9
            m, s = models["mass_kg"].predict(z, True)
            pf = 1.0
            for key, sign, lim in (("f_rigid", 1, P["limits"]["f_rigid_max"]), ("f_bend", -1, P["limits"]["f_bend_min"]),
                                   ("sag", 1, P["limits"]["sag_max"]), ("sigma", 1, P["limits"]["sigma_max"])):
                mu_, sd_ = models[key].predict(z, True)
                pf *= Phi(sign * (lim - mu_) / max(sd_, 1e-9))
            return -expected_improvement(fmin, m, s) * pf
        zc, _ = multistart(neg_cei, lo, hi, 4, P["seed"] + it + 1)
        xe = [l + zi * (u - l) for zi, l, u in zip(zc, lo, hi)]
        for xn in (xs, xe):
            if wf.key(xn) not in wf.cache:
                X.append(xn)
                Rs.append(wf.evaluate(xn))
        feas = [(x, R) for x, R in zip(X, Rs) if feasible(P, R)]
        best = min(feas, key=lambda t: t[1]["mass_kg"]) if feas else None
        hist.append({"iter": it + 1, "calls": wf.calls, "best_mass": best[1]["mass_kg"] if best else None, "x": best[0] if best else None})
    feas = [(x, R) for x, R in zip(X, Rs) if feasible(P, R)]
    best = min(feas, key=lambda t: t[1]["mass_kg"]) if feas else None
    return {"X": X, "R": Rs, "hist": hist, "best": best, "calls": wf.calls}

def direct(P, wf):
    """Direct optimisation on the solver (multi-start Nelder-Mead with penalty) - reference for the call count."""
    lo, hi = wf.lo, wf.hi
    f = lambda z: wf.penalised([l + zi * (u - l) for zi, l, u in zip(z, lo, hi)]) if all(0 <= v <= 1 for v in z) else 1e9
    z, v = multistart(f, lo, hi, P["starts"], P["seed"], fmax=P.get("direct_budget", 150))
    x = [l + zi * (u - l) for zi, l, u in zip(z, lo, hi)]
    return {"x": x, "R": wf.evaluate(x), "calls": wf.calls}

# ---------------------------------------------------------------- chapter 4: CAE model updating (calibration)
def calibrate(P, x, f_meas, params=("EI_factor", "k_factor")):
    """Find the stiffness factors (joint flexibility -> EI factor, real mount stiffness -> k factor) so that the
    first frequencies of the model match the measured ones (least squares in log frequency, Nelder-Mead on log factors)."""
    h, a, k = x
    def err(q):
        ef, kf = math.exp(q[0]), math.exp(q[1])
        f = frame_fe(P, h, a, k, EI_factor=ef, k_factor=kf)["f"]
        return sum((math.log(f[i] / fm)) ** 2 for i, fm in enumerate(f_meas) if fm)
    q, v = nelder_mead(err, [0.0, 0.0], [0.2, 0.2], tol=1e-9, itmax=120)
    ef, kf = math.exp(q[0]), math.exp(q[1])
    f = frame_fe(P, h, a, k, EI_factor=ef, k_factor=kf)["f"]
    return {"EI_factor": ef, "k_factor": kf, "f_model": f[:len(f_meas)], "f_meas": f_meas, "rms_pct": 100 * math.sqrt(v / len(f_meas))}

# ---------------------------------------------------------------- chapter 7: script templates for the user's tools
TEMPLATES = {
    "solidworks_design_table.csv": "configuration,h@Sketch_RHS,a@Sketch_Mount,k (custom property)\n{rows}",
    "solidworks_set_and_rebuild.bas": """' SOLIDWORKS VBA macro (template - check feature / dimension names in your model)
' sets the design variables, rebuilds, writes mass and exports STEP for the CAE tool
Dim swApp As Object, Part As Object
Sub main()
    Set swApp = Application.SldWorks
    Set Part = swApp.ActiveDoc
    Part.Parameter("h@Sketch_RHS").SystemValue = {h} / 1000#      ' m
    Part.Parameter("a@Sketch_Mount").SystemValue = {a} / 1000#
    Part.EditRebuild3
    Dim mp As Object: Set mp = Part.Extension.CreateMassProperty
    Open "{work}\\cad_mass.txt" For Output As #1: Print #1, "MASS = " & mp.Mass: Close #1
    Part.SaveAs3 "{work}\\frame.step", 0, 2
End Sub
""",
    "ansys_workbench_update.py": """# Ansys Workbench journal (IronPython, template - check parameter names P1.. in your project)
# run:  RunWB2.exe -B -R ansys_workbench_update.py
Open(FilePath=r"{work}\\frame.wbpj")
dp = Parameters.GetDesignPoint(Name="0")
Parameters.GetParameter(Name="P1").Expression = "{h} [mm]"   # RHS height
Parameters.GetParameter(Name="P2").Expression = "{a} [mm]"   # mount position
Parameters.GetParameter(Name="P3").Expression = "{k} [N mm^-1]"
Update()
f = open(r"{work}\\result.txt", "w")
for name, p in (("F_RIGID", "P4"), ("F_BEND", "P5"), ("SIGMA", "P6"), ("MASS", "P7")):
    f.write("%s = %s\\n" % (name, Parameters.GetParameter(Name=p).Value.Value))
f.close()
""",
    "abaqus_frame.py": """# Abaqus/CAE noGUI script (template)  run:  abaqus cae noGUI=abaqus_frame.py
from abaqus import *
from abaqusConstants import *
h, a, k = {h}, {a}, {k}
m = mdb.Model(name='frame')
# ... build sketch / beam part with BoxProfile(b=60.0, a=h, uniformThickness=ON, t1=4.0), springs, point masses ...
# step: m.FrequencyStep(name='modes', previous='Initial', numEigen=6); job = mdb.Job(name='frame', model='frame'); job.submit(); job.waitForCompletion()
from odbAccess import openOdb
odb = openOdb('frame.odb')
fr = odb.steps['modes'].historyRegions['Assembly ASSEMBLY'].historyOutputs['EIGFREQ'].data
open(r'{work}\\result.txt', 'w').write('\\n'.join('F%d = %g' % (i + 1, v) for i, (_, v) in enumerate(fr)))
""",
    "adams_run.cmd": """! Adams/View command file (template)  run:  adams2023 aview ru-s b adams_run.cmd
variable modify variable_name = .frame.DV_h  real_value = {h}
variable modify variable_name = .frame.DV_a  real_value = {a}
variable modify variable_name = .frame.DV_k  real_value = {k}
simulation single_run transient type = auto_select end_time = 2.0 number_of_steps = 2000 model_name = .frame
numeric_results write result_set_component_name = .frame.Last_Run.MEA_mount_force.Q file_name = "{work}\\mount_force.txt"
""",
    "matlab_driver.m": """% MATLAB driver (template): surrogate-based optimisation calling the external solver through files
lb = [{lo}]; ub = [{hi}];
opts = optimoptions('surrogateopt', 'MaxFunctionEvaluations', 60, 'PlotFcn', 'surrogateoptplot');
[xbest, fbest] = surrogateopt(@objcon, lb, ub, opts);
function s = objcon(x)                 % ONE solver run per design point: objective and constraints from the same result
    R = run_solver(x);
    s.Fval = R.mass;
    s.Ineq = [R.f_rigid/{frm} - 1, 1 - R.f_bend/{fbm}, R.sag/{sgm} - 1, R.sigma/{sim} - 1];
end
function R = run_solver(x)
    P = jsondecode(fileread('problem.json'));   % full problem written by "python optflow.py export"
    P.x = x;
    fid = fopen('design.json', 'w'); fprintf(fid, '%s', jsonencode(P)); fclose(fid);
    system('python optflow.py solve --in design.json --out result.txt');   % or the Ansys / Abaqus batch call
    t = fileread('result.txt');
    g = @(n) str2double(regexp(t, [n ' = ([-+0-9.eE]+)'], 'tokens', 'once'));
    R = struct('mass', g('MASS'), 'f_rigid', g('F_RIGID'), 'f_bend', g('F_BEND'), 'sag', g('SAG'), 'sigma', g('SIGMA'));
end
""",
}

def export_templates(P, out, x=None):
    os.makedirs(out, exist_ok=True)
    x = x or P["x0"]
    rows = "".join("design_%d,%.1f,%.1f,%.1f\n" % (i + 1, *p) for i, p in enumerate(lhs(5, [v[1] for v in P["vars"]], [v[2] for v in P["vars"]], P["seed"])))
    sub = {"h": "%.2f" % x[0], "a": "%.2f" % x[1], "k": "%.2f" % x[2], "work": os.path.abspath(out), "rows": rows,
           "lo": " ".join("%g" % v[1] for v in P["vars"]), "hi": " ".join("%g" % v[2] for v in P["vars"]),
           "frm": P["limits"]["f_rigid_max"], "fbm": P["limits"]["f_bend_min"], "sgm": P["limits"]["sag_max"], "sim": P["limits"]["sigma_max"]}
    written = []
    for name, t in TEMPLATES.items():
        txt = t
        for k_, v in sub.items():
            txt = txt.replace("{%s}" % k_, str(v))
        with open(os.path.join(out, name), "w", encoding="utf-8") as f:
            f.write(txt)
        written.append(name)
    with open(os.path.join(out, "problem.json"), "w", encoding="utf-8") as f:     # full problem for the MATLAB driver
        json.dump(P, f, indent=1)
    written.append("problem.json")
    return written

# ---------------------------------------------------------------- summary / report / run
def summary(P):
    x0 = P["x0"]
    R0 = responses(P, x0)
    wf = Workflow(P)
    E = ego(P, wf)
    wd = Workflow(P)
    Dd = direct(P, wd)
    return {"x0": x0, "R0": R0, "g0": constraints(P, R0), "ego": E, "direct": Dd}

def report_text(P, S=None):
    S = S or summary(P)
    R0, E, Dd = S["R0"], S["ego"], S["direct"]
    fmt = lambda x: "h %.1f mm, a %.1f mm, k %.1f N/mm" % tuple(x)
    def resp(R):
        return "mass %.2f kg, f_rigid %.2f Hz, f_bend %.1f Hz, sag %.2f mm, sigma %.1f MPa" % (R["mass_kg"], R["f_rigid"], R["f_bend"], R["sag"], R["sigma"])
    lim = P["limits"]
    L = ["# Optimisation workflow report - %s\n" % P["name"],
         "Variables: " + ", ".join("%s %g ... %g %s" % tuple(v) for v in P["vars"]),
         "Limits: f_rigid <= %.1f Hz (isolation of %.1f Hz), f_bend >= %.1f Hz (1.25 x %.1f Hz), sag <= %.1f mm, sigma <= %.0f MPa" % (
             lim["f_rigid_max"], P["f_exc"][0], lim["f_bend_min"], P["f_exc"][1], lim["sag_max"], lim["sigma_max"]),
         "\n## Current design",
         "- %s -> %s; first frequencies %s Hz" % (fmt(S["x0"]), resp(R0), ", ".join("%.2f" % f for f in R0["f"])),
         "- constraints (<= 0 OK): " + ", ".join("%s %+.3f" % (k, v) for k, v in S["g0"].items()),
         "\n## Surrogate-based optimisation (LHS %d + Kriging + %d infill iterations)" % (P["doe_n"], P["ego_iter"])]
    for h in E["hist"]:
        L.append("- iteration %2d: %3d solver calls, best feasible mass %s" % (h["iter"], h["calls"], "%.2f kg (%s)" % (h["best_mass"], fmt(h["x"])) if h["best_mass"] else "none yet"))
    if E["best"]:
        L.append("- result: %s -> %s (%d solver calls)" % (fmt(E["best"][0]), resp(E["best"][1]), E["calls"]))
    if Dd is None:                                   # web: surrogate workflow only
        return "\n".join(L)
    L += ["\n## Direct optimisation on the solver (multi-start Nelder-Mead, penalty) - reference",
          "- result: %s -> %s, feasible %s (%d solver calls)" % (fmt(Dd["x"]), resp(Dd["R"]), "yes" if feasible(P, Dd["R"]) else "no", Dd["calls"])]
    if E["best"]:
        L.append("- surrogate workflow used %.0f %% of the solver calls of the direct search; mass saving vs current design %.1f %%" % (
            100 * E["calls"] / Dd["calls"], 100 * (1 - E["best"][1]["mass_kg"] / R0["mass_kg"])))
    return "\n".join(L)

def run(P, out):
    os.makedirs(out, exist_ok=True)
    S = summary(P)
    rep = report_text(P, S)
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as f:
        f.write(rep)
    with open(os.path.join(out, "evaluations.csv"), "w", encoding="utf-8") as f:
        f.write("no," + ",".join(v[0] for v in P["vars"]) + ",mass_kg,f_rigid,f_bend,sag,sigma,feasible\n")
        for i, (x, R) in enumerate(zip(S["ego"]["X"], S["ego"]["R"])):
            if R:
                f.write("%d,%s,%.4f,%.4f,%.4f,%.4f,%.4f,%d\n" % (i + 1, ",".join("%.4f" % v for v in x), R["mass_kg"], R["f_rigid"], R["f_bend"], R["sag"], R["sigma"], feasible(P, R)))
    w = export_templates(P, os.path.join(out, "templates"), S["ego"]["best"][0] if S["ego"]["best"] else None)
    print(rep)
    print("written: report.md, evaluations.csv, templates/ (%s) -> %s" % (", ".join(w), out))



# ================================================================ added with guide chapters (ch24)
# ---------------------------------------------------------------- chapter 2: formulation
FA_MISTAKES = [   # mistake, what happens, remedy
    ("objective = sum of unlike quantities (kg + Hz)", "optimiser trades kg against Hz at an arbitrary rate", "one objective, the rest as constraints g <= 0"),
    ("constraints in raw units (Hz, mm, MPa)", "penalty dominated by the largest number", "normalise: g = value / limit - 1"),
    ("bounds too narrow", "optimum sits on a bound; real optimum outside", "check active bounds; widen and re-run"),
    ("bounds too wide (geometry impossible)", "CAD rebuild fails, mesher crashes", "geometric feasibility check before the solver"),
    ("discrete size treated as continuous and rounded at the end", "rounded design violates a limit", "re-verify after rounding or optimise on the catalogue"),
    ("equality constraint f = 60.3 Hz", "feasible set is a thin surface; optimisers struggle", "use an inequality f >= 60.3 Hz"),
    ("objective insensitive to a variable", "variable drifts, wasted runs", "screen first; freeze unimportant variables"),
    ("limits without margin for model error", "optimum on the edge of a wrong model", "calibrate the model or add a margin (chapter 4)"),
]

def fa_constraint_table(P, x):
    """Raw response, limit, normalised g = value / limit - 1 (or 1 - value / limit for lower limits), state."""
    R = responses(P, x)
    g = constraints(P, R)
    lim = P["limits"]
    rows = [("f_rigid", R["f_rigid"], "<=", lim["f_rigid_max"], g["f_rigid"]), ("f_bend", R["f_bend"], ">=", lim["f_bend_min"], g["f_bend"]),
            ("sag", R["sag"], "<=", lim["sag_max"], g["sag"]), ("sigma", R["sigma"], "<=", lim["sigma_max"], g["sigma"])]
    return [(n, v, op, l, gv, "active" if abs(gv) < 0.02 else ("violated" if gv > 0 else "inactive")) for n, v, op, l, gv in rows]

def fa_scaling(P, x, rel=1e-3):
    """Finite-difference gradient of f_bend in raw units (per mm, per N/mm) and per normalised unit (per full range):
    raw gradients differ by orders of magnitude, normalised ones are comparable -> optimisers work in [0, 1]."""
    lo, hi = [v[1] for v in P["vars"]], [v[2] for v in P["vars"]]
    R0 = responses(P, x)["f_bend"]
    out = []
    for i, (l, u) in enumerate(zip(lo, hi)):
        d = rel * (u - l)
        xp = list(x)
        xp[i] += d
        g_raw = (responses(P, xp)["f_bend"] - R0) / d
        out.append((P["vars"][i][0], P["vars"][i][3], g_raw, g_raw * (u - l)))
    return out

def fa_screening(P, x):
    """One-at-a-time screening: each variable at its lower and upper bound, others at the current design."""
    rows = []
    base = responses(P, x)
    for i, v in enumerate(P["vars"]):
        for side, val in (("low", v[1]), ("high", v[2])):
            xx = list(x)
            xx[i] = val
            R = responses(P, xx)
            rows.append((v[0], side, val, R["mass_kg"], R["f_rigid"], R["f_bend"], R["sag"], R["sigma"]))
    return base, rows

FA_GEOM = {"r_out_per_t": 2.0, "pad": 100.0, "end_plate": 20.0, "clear": 30.0}   # RHS corner radius / t, mount pad width, end plate, clearance mm (check)

def fa_geometry_check(P, x):
    """Geometric feasibility BEFORE the solver (what a CAD rebuild would reject): the RHS must have a flat web between
    the corner radii, the mount pad must fit between end plate and the first load, the mounts must not cross."""
    h, a, k = x
    t, b = P["t"], P["b"]
    r = FA_GEOM["r_out_per_t"] * t
    first_load = min(m[0] for m in P["masses"])
    checks = {"flat web h - 2 r_out > 0": h - 2 * r > 0, "flat flange b - 2 r_out > 0": b - 2 * r > 0,
              "pad inside the frame": a - FA_GEOM["pad"] / 2 >= FA_GEOM["end_plate"],
              "pad clear of the first load": a + FA_GEOM["pad"] / 2 + FA_GEOM["clear"] <= first_load or a >= first_load,
              "mounts do not cross (a < L/2)": a < P["L"] / 2 - FA_GEOM["pad"] / 2}
    return checks

FA_SW_EQUATIONS = '''"h" = 100                                  ' global variable (design variable 1)
"a" = 300                                  ' global variable (design variable 2)
"D1@Sketch_RHS" = "h"                     ' RHS profile height
"D2@Sketch_RHS" = 60                       ' RHS width (fixed)
"D1@Sketch_Mount" = "a"                   ' mount position from the frame end
"D1@Pattern_Mount" = 2500 - 2 * "a"       ' distance between the two mount positions
"Wall@Shell1" = 4'''

FA_SW_PY = '''# Python driving SOLIDWORKS through COM (pywin32; template - check the API calls for your version)
import win32com.client as w32
sw = w32.Dispatch("SldWorks.Application")
model = sw.ActiveDoc
eqm = model.GetEquationMgr
def set_var(name, value):                     # change a global variable in the equation manager
    for i in range(eqm.GetCount):
        if eqm.Equation(i).startswith('"%s"' % name):
            eqm.Equation(i, '"%s" = %g' % (name, value))
for h in (80, 100, 120):
    set_var("h", h); set_var("a", 300)
    ok = model.EditRebuild3()                 # False = rebuild error -> report as failed design
    mass = model.Extension.CreateMassProperty().Mass if ok else None
    model.Extension.SaveAs("C:/work/frame_h%d.x_t" % h, 0, 1, None, 0, 0)   # Parasolid for the CAE tool
    print(h, ok, mass)'''

# ---------------------------------------------------------------- chapter 3: coupling, failures, budget
def fa_failing_solver(P, every=4):
    """Solver that crashes on every 'every'-th call (licence lost, mesher failure) - the workflow must survive."""
    n = [0]
    def s(x):
        n[0] += 1
        if n[0] % every == 0:
            raise RuntimeError("solver crash (simulated): mesh failure")
        return responses(P, x)
    return s

def fa_failure_demo(P, n=12):
    log = []
    wf = Workflow(P, fa_failing_solver(P), log=log)
    X = lhs(n, wf.lo, wf.hi, 11)
    vals = [wf.penalised(x) for x in X]
    return {"calls": wf.calls, "fails": wf.fails, "vals": vals, "log": log}

def fa_save_log(log, path):
    with open(path, "w", encoding="utf-8") as f:
        f.write("h,a,k,mass_kg,f_rigid,f_bend,sag,sigma,error\n")
        for e in log:
            R = e["R"]
            f.write(",".join("%.6f" % v for v in e["x"]) + "," + (",".join("%.9g" % R[k] for k in ("mass_kg", "f_rigid", "f_bend", "sag", "sigma")) if R else ",,,,") + ",%s\n" % (e["err"] or ""))

def fa_load_log(wf, path):
    """Restart: fill the cache of a new workflow from the CSV log -> already solved points cost nothing."""
    n = 0
    for line in open(path, encoding="utf-8").read().splitlines()[1:]:
        c = line.split(",")
        x = [float(v) for v in c[:3]]
        R = None if c[3] == "" else dict(zip(("mass_kg", "f_rigid", "f_bend", "sag", "sigma"), (float(v) for v in c[3:8])))
        if R is not None:
            wf.cache[wf.key(x)] = R
            n += 1
    return n

def fa_budget(t_run_min, calls, parallel=1, licences=1, overhead_min=1.0):
    """Wall-clock hours: calls x (solve + CAD/mesh overhead) / min(parallel jobs, licences)."""
    return calls * (t_run_min + overhead_min) / max(1, min(parallel, licences)) / 60

FA_APDL = '''! APDL macro: compressor base frame (2-D equivalent of the two RHS beams), modal + static (template - check)
! units N, mm, t, s   |  run:  ansys2024R1 -b -i frame.mac -o frame.out
/PREP7
L = {L}  $  A2 = {A2}  $  I2 = {I2}  $  J2 = {J2}  $  KM = {KM}
ET,1,BEAM188                       ! beam (3-D element, kept in the XY plane)
SECTYPE,1,BEAM,ASEC                ! arbitrary section = the pair of RHS beams
SECDATA,A2,I2,0,I2,0,J2
MP,EX,1,210000  $  MP,PRXY,1,0.3  $  MP,DENS,1,7.85e-9
ET,2,COMBIN14  $  KEYOPT,2,2,2  $  R,2,KM          ! vertical spring per mount position (2 mounts)
ET,3,MASS21  $  KEYOPT,3,3,4                         ! 2-D point mass without rotary inertia
{MASSREALS}
*DO,i,1,{NN}
  N,i,(i-1)*L/{NE}
*ENDDO
TYPE,1  $  SECNUM,1  $  MAT,1
*DO,i,1,{NE}
  E,i,i+1
*ENDDO
{MASSELS}
{SPRINGS}
D,ALL,UZ,0  $  D,ALL,ROTX,0  $  D,ALL,ROTY,0  $  D,1,UX,0
FINISH
/SOLU
ANTYPE,MODAL  $  MODOPT,LANB,6  $  MXPAND,6  $  SOLVE
FINISH
/POST1
*DIM,F,ARRAY,6
*DO,i,1,6
  *GET,F(i),MODE,i,FREQ
*ENDDO
*CFOPEN,result,txt
*VWRITE,F(1),F(2),F(3),F(4)
('F1 = ',F12.5,/,'F2 = ',F12.5,/,'F3 = ',F12.5,/,'F4 = ',F12.5)
*CFCLOS
'''

def fa_apdl(P, x, n_el=25):
    """Fill the APDL template with the frame data: nodes every L/n_el (masses and mounts snapped to the nearest node)."""
    h, a, k = x
    A, I, _ = rhs_section(h, P["b"], P["t"])
    J = 2 * (2 * ((P["b"] - P["t"]) * (h - P["t"])) ** 2 * P["t"] / (P["b"] + h - 2 * P["t"]))   # Bredt, two tubes
    nn = n_el + 1
    node = lambda xx: int(round(xx / P["L"] * n_el)) + 1
    mreal = "\n".join("R,%d,%.6g" % (10 + i, m) for i, (_, m) in enumerate(P["masses"]))
    mel = "\n".join("TYPE,3  $  REAL,%d  $  E,%d" % (10 + i, node(xx)) for i, (xx, _) in enumerate(P["masses"]))
    spr = "\n".join("N,%d,%.3f,-100  $  TYPE,2  $  REAL,2  $  E,%d,%d  $  D,%d,ALL,0" % (1000 + j, s, node(s), 1000 + j, 1000 + j)
                    for j, s in enumerate((a, P["L"] - a)))
    t = FA_APDL
    for kk, v in {"L": "%.1f" % P["L"], "A2": "%.1f" % (2 * A), "I2": "%.6g" % (2 * I), "J2": "%.6g" % J, "KM": "%.3f" % (2 * k),
                  "NN": nn, "NE": n_el, "MASSREALS": mreal, "MASSELS": mel, "SPRINGS": spr}.items():
        t = t.replace("{%s}" % kk, str(v))
    return t

FA_ABAQUS = '''# Abaqus/CAE noGUI script: frame modal analysis (template - check names for your Abaqus version)
from abaqus import *
from abaqusConstants import *
import regionToolset
L, h, a, k = {L}, {h}, {a}, {k}
m = mdb.Model(name='frame')
s = m.ConstrainedSketch(name='line', sheetSize=4000.0)
s.Line(point1=(0.0, 0.0), point2=(L, 0.0))
p = m.Part(name='beam', dimensionality=TWO_D_PLANAR, type=DEFORMABLE_BODY)
p.BaseWire(sketch=s)
m.Material(name='steel'); m.materials['steel'].Elastic(table=((210000.0, 0.3),)); m.materials['steel'].Density(table=((7.85e-9,),))
m.GeneralizedProfile(name='pair', area={A2}, i11={I2}, i12=0.0, i22={I2}, j={J2}, gammaO=0.0, gammaW=0.0)
m.BeamSection(name='sec', integration=BEFORE_ANALYSIS, profile='pair', material='steel', poissonRatio=0.3)
p.SectionAssignment(region=(p.edges,), sectionName='sec')
p.assignBeamSectionOrientation(region=(p.edges,), method=N1_COSINES, n1=(0.0, 0.0, -1.0))
for xp in [a, L - a] + [{XM}]:
    p.PartitionEdgeByPoint(edge=p.edges.findAt(((xp * 0.999 + 0.001, 0.0, 0.0),))[0], point=(xp, 0.0, 0.0))
p.seedPart(size=L / 25.0); p.generateMesh()
inst = m.rootAssembly.Instance(name='beam-1', part=p, dependent=ON)
for xp in (a, L - a):
    v = inst.vertices.findAt(((xp, 0.0, 0.0),))
    m.rootAssembly.engineeringFeatures.SpringDashpotToGround(name='mount%d' % int(xp), region=regionToolset.Region(vertices=v),
        orientation=None, dof=2, springBehavior=ON, springStiffness=2 * k)
for i, (xp, ms) in enumerate({MASSES}):
    v = inst.vertices.findAt(((xp, 0.0, 0.0),))
    m.rootAssembly.engineeringFeatures.PointMassInertia(name='m%d' % i, region=regionToolset.Region(vertices=v), mass=ms)
m.FrequencyStep(name='modes', previous='Initial', numEigen=6)
job = mdb.Job(name='frame', model='frame'); job.submit(); job.waitForCompletion()
from odbAccess import openOdb
odb = openOdb('frame.odb')
data = odb.steps['modes'].historyRegions['Assembly ASSEMBLY'].historyOutputs['EIGFREQ'].data
open('result.txt', 'w').write('\\n'.join('F%d = %.6g' % (i + 1, f) for i, (_, f) in enumerate(data)))
'''

def fa_abaqus(P, x):
    h, a, k = x
    A, I, _ = rhs_section(h, P["b"], P["t"])
    J = 2 * (2 * ((P["b"] - P["t"]) * (h - P["t"])) ** 2 * P["t"] / (P["b"] + h - 2 * P["t"]))
    t = FA_ABAQUS
    for kk, v in {"L": "%.1f" % P["L"], "h": "%.2f" % h, "a": "%.2f" % a, "k": "%.3f" % k, "A2": "%.1f" % (2 * A), "I2": "%.6g" % (2 * I),
                  "J2": "%.6g" % J, "XM": ", ".join("%.1f" % m[0] for m in P["masses"]), "MASSES": json.dumps(P["masses"])}.items():
        t = t.replace("{%s}" % kk, str(v))
    return t

def fa_file_loop(P, x):
    """One call through the file interface: show what goes out (input file keys) and what comes back (result text)."""
    import tempfile
    d = tempfile.mkdtemp()
    R = file_solver(P, d)(list(x))
    inp = json.load(open(os.path.join(d, "design.json"), encoding="utf-8"))
    txt = open(os.path.join(d, "result.txt"), encoding="utf-8").read()
    return {"keys": sorted(inp), "x": inp["x"], "text": txt, "R": R}

# ---------------------------------------------------------------- chapter 4: virtual CAE credibility
def fa_hermite(xi, l):
    """Hermite cubic shape functions of the beam element (w1, theta1, w2, theta2), xi = x / l in [0, 1]."""
    return [1 - 3 * xi ** 2 + 2 * xi ** 3, l * (xi - 2 * xi ** 2 + xi ** 3), 3 * xi ** 2 - 2 * xi ** 3, l * (-xi ** 2 + xi ** 3)]

def fa_hermite_dd(xi, l):
    """Second derivatives d2N/dx2 (curvature per unit nodal value)."""
    return [(-6 + 12 * xi) / l ** 2, (-4 + 6 * xi) / l, (6 - 12 * xi) / l ** 2, (-2 + 6 * xi) / l]

def fa_element_by_integration(EI=1.0, rhoA=1.0, l=2.0):
    """k = int EI N''^T N'' dx, m = int rhoA N^T N dx by 4-point Gauss quadrature; compare with beam_k / beam_m."""
    gp = [(0.0694318442, 0.1739274226), (0.3300094782, 0.3260725774), (0.6699905218, 0.3260725774), (0.9305681558, 0.1739274226)]
    K, M = zeros(4), zeros(4)
    for xi, w in gp:
        B, N = fa_hermite_dd(xi, l), fa_hermite(xi, l)
        for i in range(4):
            for j in range(4):
                K[i][j] += EI * B[i] * B[j] * w * l
                M[i][j] += rhoA * N[i] * N[j] * w * l
    Kc, Mc = beam_k(EI, l), beam_m(rhoA, l)
    dk = max(abs(K[i][j] - Kc[i][j]) for i in range(4) for j in range(4)) / max(abs(v) for r in Kc for v in r)
    dm = max(abs(M[i][j] - Mc[i][j]) for i in range(4) for j in range(4)) / max(abs(v) for r in Mc for v in r)
    unity = max(abs(sum(fa_hermite(xi, l)[i] for i in (0, 2)) - 1) for xi in (0.0, 0.3, 0.7, 1.0))
    return {"dk": dk, "dm": dm, "unity": unity}

def fa_cantilever(n_el, L=1000.0, EI=1e11, rhoA=1e-5, F=1000.0):
    """Clamped-free beam with the core element matrices: tip deflection F L^3 / (3 EI), first frequency
    1.8751^2 / (2 pi L^2) sqrt(EI / rhoA) - convergence with the number of elements."""
    l = L / n_el
    n = 2 * (n_el + 1)
    K, M = zeros(n), zeros(n)
    for e in range(n_el):
        ke, me = beam_k(EI, l), beam_m(rhoA, l)
        for i in range(4):
            for j in range(4):
                K[2 * e + i][2 * e + j] += ke[i][j]
                M[2 * e + i][2 * e + j] += me[i][j]
    Kr = [r[2:] for r in K[2:]]
    Mr = [r[2:] for r in M[2:]]
    Fv = [0.0] * (n - 2)
    Fv[-2] = F
    w = solve(Kr, Fv)[-2]
    f1 = math.sqrt(gen_eig(Kr, Mr)[0]) / (2 * math.pi)
    return {"w_tip": w, "w_th": F * L ** 3 / (3 * EI), "f1": f1, "f1_th": 1.8751041 ** 2 / (2 * math.pi * L ** 2) * math.sqrt(EI / rhoA)}

def fa_rayleigh(P, h=100.0, m=0.12):
    """Simply supported beam (stiff springs at the ends) with a central mass: FE vs Rayleigh estimate
    f = 1/(2 pi) sqrt(48 EI / L^3 / (m + 0.486 m_beam))."""
    Q = dict(P, masses=[[P["L"] / 2, m]], F_shake=0.0, n_el=20)
    r = frame_fe(Q, h, 1e-6, 1e8)
    A, I, _ = rhs_section(h, P["b"], P["t"])
    EI, mb = 2 * P["E"] * I, 2 * P["rho"] * A * P["L"]
    fr = math.sqrt(48 * EI / P["L"] ** 3 / (m + 0.486 * mb)) / (2 * math.pi)
    fe = [f for f in r["f"] if f > 1.0][0]
    return {"f_fe": fe, "f_rayleigh": fr, "dev_pct": 100 * (fr / fe - 1)}

def fa_gci(P, x, ns=(4, 8, 16)):
    """Mesh study of the frame with the Roache GCI (dm_toolkit.gci)."""
    import dm_toolkit
    rows = [(n, responses(P, x, n)) for n in ns]
    out = {}
    for key in ("f_bend", "sigma"):
        f3, f2, f1 = (r[key] for _, r in rows)
        try:
            out[key] = dm_toolkit.gci(f1, f2, f3, r=2.0)
        except ValueError as ex:
            out[key] = {"error": str(ex)}
    return rows, out

def fa_noisy(P, x, amp=0.003):
    """Response with 'remeshing noise': a different mesh for every geometry changes the result by up to +/- amp
    (deterministic in x, like a real mesher)."""
    R = responses(P, x)
    rnd = random.Random(hash(tuple(round(v, 6) for v in x)))
    R = dict(R)
    R["f_bend"] *= 1 + amp * (2 * rnd.random() - 1)
    R["f_rigid"] *= 1 + amp * (2 * rnd.random() - 1)
    return R

def fa_fd_study(P, x, steps=(10.0, 1.0, 0.1, 0.01, 0.001), amp=0.003):
    """Central finite-difference gradient d f_bend / d h: smooth model vs noisy model. Noise / step dominates small steps."""
    out = []
    for d in steps:
        xp, xm = list(x), list(x)
        xp[0] += d
        xm[0] -= d
        gs = (responses(P, xp)["f_bend"] - responses(P, xm)["f_bend"]) / (2 * d)
        gn = (fa_noisy(P, xp, amp)["f_bend"] - fa_noisy(P, xm, amp)["f_bend"]) / (2 * d)
        out.append((d, gs, gn))
    return out

def fa_noisy_optimisation(P, amp=0.003, budget=90):
    """Same penalised problem, smooth vs noisy solver, Nelder-Mead from the current design with an equal budget."""
    res = {}
    for name, solver in (("smooth", lambda x: responses(P, x)), ("noisy", lambda x: fa_noisy(P, x, amp))):
        wf = Workflow(P, solver)
        lo, hi = wf.lo, wf.hi
        f = lambda z: wf.penalised([l + zi * (u - l) for zi, l, u in zip(z, lo, hi)]) if all(0 <= v <= 1 for v in z) else 1e9
        z0 = [(v - l) / (u - l) for v, l, u in zip(P["x0"], lo, hi)]
        z, v = nelder_mead(f, z0, [0.1] * 3, fmax=budget)
        xb = [l + zi * (u - l) for zi, l, u in zip(z, lo, hi)]
        Rt = responses(P, xb)
        res[name] = {"x": xb, "R_true": Rt, "feasible_true": feasible(P, Rt), "calls": wf.calls}
    return res

def fa_model_freqs(P, x, q, modes):
    h, a, k = x
    f = frame_fe(P, h, a, k, EI_factor=math.exp(q[0]), k_factor=math.exp(q[1]))["f"]
    return [f[i] for i in modes]

def fa_calibrate_gn(P, x, f_meas, modes=(0, 1, 2), it=8):
    """Gauss-Newton on log factors q = (ln EI_factor, ln k_factor), residual r_i = ln(f_model,i / f_meas,i),
    finite-difference Jacobian; returns factors, Jacobian condition (identifiability) and iterations."""
    q = [0.0, 0.0]
    cond = None
    for _ in range(it):
        f0 = fa_model_freqs(P, x, q, modes)
        r = [math.log(a / b) for a, b in zip(f0, f_meas)]
        J = []
        for j in range(2):
            qq = list(q)
            qq[j] += 1e-4
            fj = fa_model_freqs(P, x, qq, modes)
            J.append([(math.log(a / b) - ri) / 1e-4 for a, b, ri in zip(fj, f_meas, r)])
        JtJ = [[sum(J[i][m] * J[j][m] for m in range(len(r))) for j in range(2)] for i in range(2)]
        tr, det = JtJ[0][0] + JtJ[1][1], JtJ[0][0] * JtJ[1][1] - JtJ[0][1] ** 2
        disc = math.sqrt(max(tr * tr / 4 - det, 0.0))
        lmax, lmin = tr / 2 + disc, tr / 2 - disc
        cond = lmax / lmin if lmin > 1e-300 else float("inf")
        if cond > 1e10:
            return {"EI_factor": None, "k_factor": None, "cond": cond, "identifiable": False}
        Jtr = [sum(J[i][m] * r[m] for m in range(len(r))) for i in range(2)]
        dq = solve(JtJ, [-v for v in Jtr])
        q = [a + b for a, b in zip(q, dq)]
        if max(abs(v) for v in dq) < 1e-10:
            break
    return {"EI_factor": math.exp(q[0]), "k_factor": math.exp(q[1]), "cond": cond, "identifiable": True}

def fa_calibration_noise(P, x, true=(0.75, 1.15), noise=0.01, trials=8, seed=4, modes=(0, 1, 2)):
    """Measured frequencies with +/- noise (uniform): scatter of the identified factors."""
    h, a, k = x
    f_all = frame_fe(P, h, a, k, EI_factor=true[0], k_factor=true[1])["f"]
    f_true = [f_all[i] for i in modes]
    rnd = random.Random(seed)
    out = []
    for _ in range(trials):
        fm = [f * (1 + noise * (2 * rnd.random() - 1)) for f in f_true]
        c = fa_calibrate_gn(P, x, fm, modes=modes)
        out.append((c["EI_factor"], c["k_factor"]))
    return f_true, out

def fa_test_plan(f_max=80.0, f_target=60.3, accuracy=0.005):
    """Impact (hammer) modal test: sampling rate >= 2.56 f_max, frequency resolution df <= accuracy x f_target,
    record length T = 1 / df, number of samples N = fs T."""
    fs = 2.56 * f_max * 2.5          # margin for the anti-aliasing filter and a 200 Hz band
    df = accuracy * f_target
    T = 1 / df
    return {"fs": fs, "df": df, "T": T, "N": 2 ** math.ceil(math.log2(fs * T))}

FA_VV = [   # step, question, evidence, owner
    ("code verification", "does the solver solve the equations right?", "analytic cases: cantilever, simply supported, free-free (self-test)", "CAE engineer"),
    ("solution verification", "is the mesh fine enough?", "3-mesh study, GCI < 2 % for the response used", "CAE engineer"),
    ("input check", "are loads, masses, units, supports right?", "mass report vs CAD and scale; reaction sum = weight", "designer"),
    ("validation test", "does the model match reality?", "impact modal test of the built frame, 3+ modes", "test lab"),
    ("calibration", "which uncertain parameters explain the difference?", "identify joint EI factor and mount k from test", "CAE + test"),
    ("validation (blind)", "does the calibrated model predict a NEW case?", "second configuration (e.g. receiver empty / full) predicted then tested", "CAE + test"),
    ("use with margin", "how wrong can it still be?", "remaining error -> margin on limits (e.g. 5 % on frequencies)", "designer"),
]

# ---------------------------------------------------------------- demo
def demo_ch24():
    P = dict(DEFAULT)
    x0 = P["x0"]
    print("## 2.1 Formulation of the default problem (normalised constraints g <= 0)")
    for n, v, op, l, g, st in fa_constraint_table(P, x0):
        print("  %-8s %9.3f %s %7.2f -> g %+.3f  %s" % (n, v, op, l, g, st))
    print("\n## 2.2 Common formulation mistakes")
    for m, w, r in FA_MISTAKES:
        print("  - %s: %s -> %s" % (m, w, r))
    print("\n## 2.3 Scaling: gradient of f_bend in raw and in normalised units")
    for n, u, gr, gn in fa_scaling(P, x0):
        print("  %-2s: d f_bend / d %s = %+.5f Hz per %s,  per full range %+8.3f Hz" % (n, n, gr, u, gn))
    print("\n## 2.4 One-at-a-time screening around the current design")
    base, rows = fa_screening(P, x0)
    print("  base          mass %.2f kg, f_rigid %.2f, f_bend %.1f Hz, sag %.2f mm, sigma %.1f MPa" % (base["mass_kg"], base["f_rigid"], base["f_bend"], base["sag"], base["sigma"]))
    for n, side, val, m, fr, fb, sg, si in rows:
        print("  %s %-4s %6.1f  mass %.2f kg, f_rigid %5.2f, f_bend %6.1f Hz, sag %5.2f mm, sigma %5.1f MPa" % (n, side, val, m, fr, fb, sg, si))
    print("\n## 2.5 Geometric feasibility before the solver (CAD rebuild check)")
    for x in (x0, [60.0, 300.0, 120.0], [100.0, 40.0, 120.0], [100.0, 560.0, 120.0], [15.0, 300.0, 120.0]):
        c = fa_geometry_check(P, x)
        bad = [k for k, v in c.items() if not v]
        print("  h %5.1f a %5.1f: %s" % (x[0], x[1], "OK" if not bad else "REJECT (" + "; ".join(bad) + ")"))
    print("\n## 2.6 SOLIDWORKS equations (global variables drive the dimensions)")
    print(FA_SW_EQUATIONS)
    print("\n## 2.7 SOLIDWORKS driven from Python (COM)")
    print(FA_SW_PY)

    print("\n## 3.1 One call through the file interface")
    F = fa_file_loop(P, x0)
    print("  input file keys: %s" % ", ".join(F["keys"]))
    print("  x = %s" % F["x"])
    print("  result file:\n" + "\n".join("    " + l for l in F["text"].strip().splitlines()))
    print("\n## 3.2 Failure handling: every 4th solver call crashes")
    D = fa_failure_demo(P)
    print("  %d solver calls, %d failures; penalised objective of the 12 DOE points:" % (D["calls"], D["fails"]))
    print("  " + ", ".join("%.4g" % v for v in D["vals"]))
    print("\n## 3.3 Log and restart")
    import tempfile
    path = os.path.join(tempfile.mkdtemp(), "evaluations.csv")
    fa_save_log(D["log"], path)
    wf2 = Workflow(P)
    n = fa_load_log(wf2, path)
    X = lhs(12, wf2.lo, wf2.hi, 11)
    for x in X:
        wf2.evaluate(x)
    print("  log has %d lines, %d successful points loaded into the cache; re-running the same DOE costs %d new solver calls (only the %d failed points)" % (
        len(D["log"]), n, wf2.calls, D["fails"]))
    print("\n## 3.4 Run-time budget (wall-clock hours)")
    for t, calls, par, lic in ((5, 44, 1, 1), (5, 764, 1, 1), (30, 44, 1, 1), (30, 44, 4, 2), (30, 764, 4, 2)):
        print("  %3d min per run, %4d runs, %d parallel, %d licences -> %6.1f h" % (t, calls, par, lic, fa_budget(t, calls, par, lic)))
    print("\n## 3.5 APDL macro for the frame (current design)")
    print(fa_apdl(P, x0))
    print("## 3.6 Abaqus Python script for the frame (current design)")
    print(fa_abaqus(P, x0))

    print("## 4.1 Element matrices by integration of the Hermite shape functions")
    E = fa_element_by_integration()
    print("  max rel. difference to beam_k %.2e, to beam_m %.2e; N1 + N3 = 1 (rigid translation) error %.1e" % (E["dk"], E["dm"], E["unity"]))
    print("\n## 4.2 Cantilever: convergence of tip deflection and first frequency")
    for n in (1, 2, 4, 8):
        c = fa_cantilever(n)
        print("  %d elements: w_tip %.6f mm (theory %.6f), f1 %.4f Hz (theory %.4f, error %+.4f %%)" % (n, c["w_tip"], c["w_th"], c["f1"], c["f1_th"], 100 * (c["f1"] / c["f1_th"] - 1)))
    print("\n## 4.3 Rayleigh check: simply supported frame with the compressor mass at mid-span")
    for h in (80.0, 120.0):
        r = fa_rayleigh(P, h)
        print("  h %.0f: FE %.2f Hz, Rayleigh %.2f Hz (%+.2f %%)" % (h, r["f_fe"], r["f_rayleigh"], r["dev_pct"]))
    print("\n## 4.4 Mesh convergence and GCI (current design)")
    rows, g = fa_gci(P, x0)
    for n, R in rows:
        print("  %2d elements: f_bend %.5f Hz, sigma %.4f MPa" % (n, R["f_bend"], R["sigma"]))
    for key, v in g.items():
        print("  %s: %s" % (key, v.get("error") or "order p %.2f, extrapolated %.5f, GCI fine %.4f %%" % (v["p"], v["f_ext"], v["gci_fine_pct"])))
    print("\n## 4.5 Numerical noise: finite-difference gradient d f_bend / d h (noise +/- 0.3 %)")
    for d, gs, gn in fa_fd_study(P, x0):
        print("  step %7.3f mm: smooth %+.4f Hz/mm, noisy %+10.4f Hz/mm" % (d, gs, gn))
    print("\n## 4.6 Optimisation on a smooth vs a noisy solver (Nelder-Mead, 90 calls)")
    for name, r in fa_noisy_optimisation(P).items():
        R = r["R_true"]
        print("  %-6s: h %.1f, a %.1f, k %.1f -> true mass %.2f kg, f_rigid %.2f, f_bend %.1f Hz, sag %.2f -> feasible %s (%d calls)" % (
            name, r["x"][0], r["x"][1], r["x"][2], R["mass_kg"], R["f_rigid"], R["f_bend"], R["sag"], "yes" if r["feasible_true"] else "no", r["calls"]))
    print("\n## 4.7 Calibration (Gauss-Newton) and identifiability")
    h, a, k = x0
    fm = frame_fe(P, h, a, k, EI_factor=0.75, k_factor=1.15)["f"][:3]
    c = fa_calibrate_gn(P, x0, fm)
    print("  modes 1-3 (2 mount + 1 bending): EI factor %.4f, k factor %.4f, condition %.1f" % (c["EI_factor"], c["k_factor"], c["cond"]))
    c2 = fa_calibrate_gn(P, x0, fm[:2], modes=(0, 1))
    print("  mount modes only:                %s, condition %.3g" % ("identifiable" if c2["identifiable"] else "EI factor NOT identifiable", c2["cond"]))
    f_true, sc = fa_calibration_noise(P, x0)
    eis, ks = [v[0] for v in sc], [v[1] for v in sc]
    print("  +/- 1 %% measurement noise, %d trials, modes 1-3:   EI factor %.3f ... %.3f, k factor %.3f ... %.3f (true 0.75 / 1.15)" % (len(sc), min(eis), max(eis), min(ks), max(ks)))
    f_true2, sc2 = fa_calibration_noise(P, x0, modes=(0, 1))
    e2, k2 = [v[0] for v in sc2 if v[0]], [v[1] for v in sc2 if v[1]]
    print("  +/- 1 %% measurement noise, %d trials, modes 1-2 only: EI factor %.3f ... %.3f, k factor %.3f ... %.3f" % (len(sc2), min(e2), max(e2), min(k2), max(k2)))
    print("\n## 4.8 Impact modal test plan for the built frame")
    tp = fa_test_plan()
    print("  sampling %.0f Hz, resolution %.3f Hz -> record %.1f s, %d samples per average" % (tp["fs"], tp["df"], tp["T"], tp["N"]))
    print("\n## 4.9 Verification and validation plan")
    for s, q, e, o in FA_VV:
        print("  - %s: %s -> %s (%s)" % (s, q, e, o))

# ================================================================ added with guide chapters (ch56)
FB_KEYS = ["mass_kg", "f_rigid", "f_bend", "sag"]
FB_CATALOGUE_H = [60, 70, 80, 90, 100, 120, 140, 160]          # RHS heights x 60 x 4 in the stock list (example, check supplier)
FB_TOL = {"k": 0.20, "t": 0.10, "mass": 0.10}                  # +/- ranges: rubber mount stiffness, RHS wall (EN 10219 style), payload masses (check)

# ---------------------------------------------------------------- chapter 5: DOE for computer experiments
def fb_min_dist(Z):
    """Smallest distance between two points of a plan (normalised space) - the maximin criterion."""
    return min(math.dist(Z[i], Z[j]) for i in range(len(Z)) for j in range(i + 1, len(Z)))

def fb_maximin_lhs(n, k, tries=200, seed=1):
    """Best of many random Latin hypercubes: keep the one with the largest smallest distance."""
    best, dbest = None, -1.0
    for s in range(tries):
        Z = lhs(n, [0.0] * k, [1.0] * k, seed + s)
        d = fb_min_dist(Z)
        if d > dbest:
            best, dbest = Z, d
    return best, dbest

def fb_design_compare(n=27, k=3, seed=1):
    """Full factorial 3^3, random, LHS and maximin LHS with the same number of points: smallest distance (space
    filling) and number of different levels per variable (projection: how much each variable alone is explored)."""
    ff = [[i / 2, j / 2, l / 2] for i in range(3) for j in range(3) for l in range(3)]
    rnd = random.Random(seed)
    rd = [[rnd.random() for _ in range(k)] for _ in range(n)]
    lh = lhs(n, [0.0] * k, [1.0] * k, seed)
    mm, _ = fb_maximin_lhs(n, k, 200, seed)
    rows = []
    for name, Z in (("full factorial 3^3", ff), ("random", rd), ("Latin hypercube", lh), ("maximin Latin hypercube", mm)):
        lv = min(len(set(round(z[j], 9) for z in Z)) for j in range(k))
        rows.append((name, len(Z), fb_min_dist(Z), lv))
    return rows

def fb_r2(Z, y):
    """Fit quality of the quadratic response surface: R2 = 1 - SS_res / SS_tot, adjusted R2 = 1 - (1 - R2)(n - 1)/(n - p)."""
    s = rsm_fit(Z, y)
    n, p = len(y), len(quad_terms(Z[0]))
    ym = sum(y) / n
    ss_res = sum((s(z) - v) ** 2 for z, v in zip(Z, y))
    ss_tot = sum((v - ym) ** 2 for v in y)
    r2 = 1 - ss_res / ss_tot
    return {"R2": r2, "R2_adj": 1 - (1 - r2) * (n - 1) / (n - p) if n > p else float("nan"), "n": n, "p": p}

def fb_validation(P, X, Rs):
    """Per response: R2 of the response surface on its own points, and leave-one-out error (RMS / range) of the
    response surface and of Kriging - the honest check, because each point is predicted without having seen it."""
    lo, hi = [v[1] for v in P["vars"]], [v[2] for v in P["vars"]]
    Z = [norm(x, lo, hi) for x in X]
    rows = []
    for key in FB_KEYS:
        y = [R[key] for R in Rs]
        q = fb_r2(Z, y)
        e_rsm = loo_error(Z, y, rsm_fit)
        e_kr = loo_error(Z, y, lambda Zt, yt: Kriging(Zt, yt).predict)
        rows.append({"key": key, "R2": q["R2"], "R2_adj": q["R2_adj"], "loo_rsm": e_rsm, "loo_kriging": e_kr})
    return rows

def fb_testset(P, ns=(10, 20, 30, 40), n_test=80, seed=11):
    """Error on an independent random test set (true solver) versus the number of DOE points (LHS)."""
    lo, hi = [v[1] for v in P["vars"]], [v[2] for v in P["vars"]]
    rnd = random.Random(seed)
    Xt = [[l + (u - l) * rnd.random() for l, u in zip(lo, hi)] for _ in range(n_test)]
    Rt = [responses(P, x) for x in Xt]
    Zt = [norm(x, lo, hi) for x in Xt]
    rows = []
    for n in ns:
        X = lhs(n, lo, hi, P["seed"])
        Rs = [responses(P, x) for x in X]
        Z = [norm(x, lo, hi) for x in X]
        row = {"n": n}
        for key in ("f_bend", "f_rigid"):
            y = [R[key] for R in Rs]
            yt = [R[key] for R in Rt]
            rng = max(yt) - min(yt)
            kr = Kriging(Z, y)
            rs = rsm_fit(Z, y)
            row[key + "_kriging"] = math.sqrt(sum((kr.predict(z) - v) ** 2 for z, v in zip(Zt, yt)) / n_test) / rng
            row[key + "_rsm"] = math.sqrt(sum((rs(z) - v) ** 2 for z, v in zip(Zt, yt)) / n_test) / rng
        rows.append(row)
    return rows

def fb_kriging_info(model):
    """Fitted parameters and the prediction standard deviation at a training point and half-way to its neighbour."""
    Z = model.Z
    i = 0
    j = min(range(1, len(Z)), key=lambda m: math.dist(Z[0], Z[m]))
    mid = [(a + b) / 2 for a, b in zip(Z[i], Z[j])]
    return {"theta": model.theta, "mu": model.mu, "sigma": math.sqrt(model.s2), "sd_train": model.predict(Z[i], True)[1],
            "sd_mid": model.predict(mid, True)[1], "dist": math.dist(Z[i], Z[j])}

def fb_sobol(model, k=3, N=1000, seed=5):
    """First-order Sobol indices S_i = V(E(y|x_i)) / V(y) by Monte Carlo on the surrogate (Jansen form):
    A, B independent uniform samples, A_B^i = A with column i taken from B (shares only x_i with B);
    V - V_i = mean( (f(B) - f(A_B^i))^2 ) / 2."""
    rnd = random.Random(seed)
    A = [[rnd.random() for _ in range(k)] for _ in range(N)]
    B = [[rnd.random() for _ in range(k)] for _ in range(N)]
    fA = [model.predict(a) for a in A]
    fB = [model.predict(b) for b in B]
    allv = fA + fB
    m = sum(allv) / len(allv)
    V = sum((v - m) ** 2 for v in allv) / len(allv)
    S = []
    for i in range(k):
        fABi = [model.predict([b[j] if j == i else a[j] for j in range(k)]) for a, b in zip(A, B)]
        Vi = V - sum((fb_ - fab) ** 2 for fb_, fab in zip(fB, fABi)) / (2 * N)
        S.append(Vi / V if V > 0 else 0.0)
    return S

# ---------------------------------------------------------------- chapter 6: strategies
def fb_sur_obj(P, models, limits=None, r=1e3, fixed=None):
    """Penalised objective on the surrogate in normalised space; limits override; fixed = {index: z value}."""
    Q = dict(P, limits=dict(P["limits"], **(limits or {})))
    def f(z):
        zz = list(z)
        if fixed:
            for i, v in sorted(fixed.items()):
                zz.insert(i, v)
        if any(v < 0 or v > 1 for v in zz):
            return 1e9
        R = {key: m.predict(zz) for key, m in models.items()}
        g = constraints(Q, R)
        return R["mass_kg"] + r * sum(max(0.0, v) ** 2 for v in g.values())
    return f, Q

def fb_from_z(P, z):
    return [v[1] + zi * (v[2] - v[1]) for zi, v in zip(z, P["vars"])]

def fb_to_z(P, x):
    return [(xi - v[1]) / (v[2] - v[1]) for xi, v in zip(x, P["vars"])]

def fb_penalty_study(P, models, z0, rs=(1e2, 1e3, 1e4, 1e5)):
    """Exterior penalty: the minimum of mass + r sum max(0, g)^2 always lies slightly OUTSIDE the feasible region,
    the violation shrinks about like 1/r. Optimum on the surrogate, then verified with the true solver."""
    rows = []
    for r in rs:
        f, _ = fb_sur_obj(P, models, r=r)
        z, v = nelder_mead(f, z0, [0.05] * 3, tol=1e-12, itmax=800)
        x = fb_from_z(P, z)
        R = responses(P, x)
        g = constraints(P, R)
        rows.append({"r": r, "x": x, "mass": R["mass_kg"], "g_max": max(g.values()), "f_bend": R["f_bend"], "feasible": feasible(P, R)})
    return rows

def fb_ei_table(fmin=41.2, mus=(40.5, 41.0, 41.2, 41.5, 42.0), sds=(0.05, 0.3, 1.0)):
    return [(mu, [expected_improvement(fmin, mu, s) for s in sds]) for mu in mus], sds

def fb_final_ei(P, E):
    """Stopping indicator: the largest constrained expected improvement left after the last infill iteration."""
    ok = [(x, R) for x, R in zip(E["X"], E["R"]) if R]
    models, _ = surrogate_models(P, [x for x, _ in ok], [R for _, R in ok])
    fmin = E["best"][1]["mass_kg"]
    def neg(z):
        if any(v < 0 or v > 1 for v in z):
            return 1e9
        m, s = models["mass_kg"].predict(z, True)
        pf = 1.0
        for key, sign, lim in (("f_rigid", 1, P["limits"]["f_rigid_max"]), ("f_bend", -1, P["limits"]["f_bend_min"]),
                               ("sag", 1, P["limits"]["sag_max"]), ("sigma", 1, P["limits"]["sigma_max"])):
            mu_, sd_ = models[key].predict(z, True)
            pf *= Phi(sign * (lim - mu_) / max(sd_, 1e-9))
        return -expected_improvement(fmin, m, s) * pf
    z, v = multistart(neg, [0.0] * 3, [1.0] * 3, 4, 99)
    zb = fb_to_z(P, E["best"][0])
    pf_best = 1.0
    for key, sign, lim in (("f_rigid", 1, P["limits"]["f_rigid_max"]), ("f_bend", -1, P["limits"]["f_bend_min"]), ("sag", 1, P["limits"]["sag_max"])):
        mu_, sd_ = models[key].predict(zb, True)
        pf_best *= Phi(sign * (lim - mu_) / max(sd_, 1e-9))
    return {"ei_max": -v, "x_ei": fb_from_z(P, z), "models": models, "pf_best": pf_best}

def fb_pareto(P, models, z0, eps=(50.0, 55.0, 60.3, 65.0, 70.0, 80.0, 90.0)):
    """Epsilon-constraint: minimise mass with f_bend >= eps for a series of eps (other limits unchanged);
    each surrogate optimum verified with the true solver."""
    rows = []
    for e in eps:
        f, Q = fb_sur_obj(P, models, limits={"f_bend_min": e}, r=1e5)
        z, _ = nelder_mead(f, z0, [0.05] * 3, tol=1e-12, itmax=800)
        x = fb_from_z(P, z)
        m_sur = models["mass_kg"].predict(z)
        R = responses(P, x)
        rows.append({"eps": e, "x": x, "mass_sur": m_sur, "fb_sur": models["f_bend"].predict(z), "mass": R["mass_kg"],
                     "f_bend": R["f_bend"], "feasible": feasible(Q, R), "g": constraints(Q, R)})
    return rows

def fb_catalogue(P, models, z0):
    """Discrete sizes: for every catalogue height (mass then fixed), choose a and k on the surrogate for the largest
    margin - minimise max(g) - verify with the true solver; the lightest verified feasible size wins."""
    rows = []
    for h in FB_CATALOGUE_H:
        zh = (h - P["vars"][0][1]) / (P["vars"][0][2] - P["vars"][0][1])
        def f(z2):
            zz = [zh] + list(z2)
            if any(v < 0 or v > 1 for v in zz):
                return 1e9
            return max(constraints(P, {key: m.predict(zz) for key, m in models.items()}).values())
        z2, _ = nelder_mead(f, z0[1:], [0.05, 0.05], tol=1e-12, itmax=600)
        x = fb_from_z(P, [zh] + list(z2))
        R = responses(P, x)
        rows.append({"h": h, "x": x, "R": R, "feasible": feasible(P, R), "g": constraints(P, R)})
    feas = [r for r in rows if r["feasible"]]
    return rows, (min(feas, key=lambda r: r["R"]["mass_kg"]) if feas else None)

def fb_perturbed(P, x, kf=1.0, tf=1.0, mf=1.0):
    """True solver with mount stiffness factor kf, wall factor tf and payload mass factor mf."""
    Q = dict(P, t=P["t"] * tf, masses=[[xm, m * mf] for xm, m in P["masses"]])
    r = frame_fe(Q, x[0], x[1], x[2], k_factor=kf)
    return {"mass_kg": r["mass_kg"], "f_rigid": r["f"][1], "f_bend": r["f"][2], "sag": r["sag"], "sigma": r["sigma"]}

def fb_robust_mc(P, x, n=250, seed=21):
    """Monte Carlo with uniform tolerances (mount k +/-20 %, wall +/-10 %, payload +/-10 %): probability of
    violating each limit, mean and standard deviation of the bending frequency."""
    rnd = random.Random(seed)
    viol = {"f_rigid": 0, "f_bend": 0, "sag": 0, "any": 0}
    fb = []
    for _ in range(n):
        R = fb_perturbed(P, x, 1 + FB_TOL["k"] * (2 * rnd.random() - 1), 1 + FB_TOL["t"] * (2 * rnd.random() - 1),
                         1 + FB_TOL["mass"] * (2 * rnd.random() - 1))
        g = constraints(P, R)
        bad = False
        for key in ("f_rigid", "f_bend", "sag"):
            if g[key] > 1e-3:
                viol[key] += 1
                bad = True
        viol["any"] += bad
        fb.append(R["f_bend"])
    m = sum(fb) / n
    return {"p": {k: v / n for k, v in viol.items()}, "fb_mean": m, "fb_sd": math.sqrt(sum((v - m) ** 2 for v in fb) / (n - 1))}

def fb_corner_factors(P, x):
    """Worst corners of the tolerance box (each limit separately) -> ratio worst / nominal -> tightened limits."""
    R0 = responses(P, x)
    t, kk, mm = FB_TOL["t"], FB_TOL["k"], FB_TOL["mass"]
    fr = max(fb_perturbed(P, x, 1 + kk, tf, mf)["f_rigid"] for tf in (1 - t, 1 + t) for mf in (1 - mm, 1 + mm)) / R0["f_rigid"]
    fbend = min(fb_perturbed(P, x, kf, 1 - t, mf)["f_bend"] for kf in (1 - kk, 1 + kk) for mf in (1 - mm, 1 + mm)) / R0["f_bend"]
    sg = max(fb_perturbed(P, x, 1 - kk, tf, 1 + mm)["sag"] for tf in (1 - t, 1 + t)) / R0["sag"]
    lim = P["limits"]
    return {"r_f_rigid": fr, "r_f_bend": fbend, "r_sag": sg,
            "limits": {"f_rigid_max": lim["f_rigid_max"] / fr, "f_bend_min": lim["f_bend_min"] / fbend, "sag_max": lim["sag_max"] / sg}}

def fb_robust_design(P, models, z0, budget=60):
    """Back-off: optimise with the tightened (corner) limits on the surrogate, then refine locally on the true solver
    (Nelder-Mead, penalty, small budget) - the surrogate is least accurate exactly at the new active limits."""
    C = fb_corner_factors(P, fb_from_z(P, z0))
    f, Q = fb_sur_obj(P, models, limits=C["limits"], r=1e5)
    z, _ = nelder_mead(f, z0, [0.05] * 3, tol=1e-12, itmax=800)
    x_s = fb_from_z(P, z)
    R_s = responses(P, x_s)
    wf = Workflow(Q)
    g = lambda zz: wf.penalised(fb_from_z(P, zz), r=1e5) if all(0 <= v <= 1 for v in zz) else 1e9
    z2, _ = nelder_mead(g, z, [0.02] * 3, tol=1e-10, fmax=budget)
    x_r = fb_from_z(P, z2)
    R_r = responses(P, x_r)
    return {"corner": C, "Q": Q, "x_sur": x_s, "R_sur": R_s, "ok_sur": feasible(Q, R_s), "g_sur": max(constraints(Q, R_s).values()),
            "x": x_r, "R": R_r, "ok": feasible(Q, R_r), "g": max(constraints(Q, R_r).values()), "calls": wf.calls}

# ---------------------------------------------------------------- demo
def demo_ch56():
    P = dict(DEFAULT)
    lo, hi = [v[1] for v in P["vars"]], [v[2] for v in P["vars"]]
    print("## 5.1 Plans for computer experiments (27 points, 3 variables, normalised space)")
    for name, n, d, lv in fb_design_compare():
        print("  %-26s n %2d: smallest distance %.3f, levels per variable %2d" % (name, n, d, lv))
    Zm, dm = fb_maximin_lhs(P["doe_n"], 3, 200, 1)
    print("  maximin LHS for the default DOE (n %d): smallest distance %.3f vs plain LHS (seed %d) %.3f" % (
        P["doe_n"], dm, P["seed"], fb_min_dist(lhs(P["doe_n"], [0.0] * 3, [1.0] * 3, P["seed"]))))

    wf = Workflow(P)
    E = ego(P, wf)
    X0, R0s = E["X"][:P["doe_n"]], E["R"][:P["doe_n"]]
    print("\n## 5.2 Fit quality on the %d DOE points (true solver) - R2 of the response surface vs leave-one-out" % P["doe_n"])
    for r in fb_validation(P, X0, R0s):
        print("  %-8s R2 %.4f, R2_adj %.4f | LOO error / range: RSM %.4f, Kriging %.4f" % (r["key"], r["R2"], r["R2_adj"], r["loo_rsm"], r["loo_kriging"]))

    print("\n## 5.3 Error on 80 independent test points vs number of DOE points (RMS / range)")
    for r in fb_testset(P):
        print("  n %2d: f_bend  Kriging %.4f  RSM %.4f | f_rigid  Kriging %.4f  RSM %.4f" % (
            r["n"], r["f_bend_kriging"], r["f_bend_rsm"], r["f_rigid_kriging"], r["f_rigid_rsm"]))

    Z0 = [norm(x, lo, hi) for x in X0]
    kb = Kriging(Z0, [R["f_bend"] for R in R0s])
    ki = fb_kriging_info(kb)
    print("\n## 5.4 Kriging of f_bend (20 DOE points)")
    print("  theta (h, a, k) %s, mu %.2f Hz, sigma %.2f Hz; prediction sd at a training point %.4f Hz, half-way to the nearest point (distance %.3f) %.3f Hz" % (
        ki["theta"], ki["mu"], ki["sigma"], ki["sd_train"], ki["dist"], ki["sd_mid"]))

    print("\n## 5.5 Sensitivity: first-order Sobol indices on the Kriging (N 1000)")
    for key in FB_KEYS:
        S = fb_sobol(Kriging(Z0, [R[key] for R in R0s]))
        print("  %-8s S_h %.3f, S_a %.3f, S_k %.3f (sum %.3f)" % (key, S[0], S[1], S[2], sum(S)))

    wd = Workflow(P)
    D = direct(P, wd)
    print("\n## 6.1 Direct search vs surrogate workflow (same problem)")
    print("  surrogate (EGO): %d solver calls -> %.2f kg, feasible %s" % (E["calls"], E["best"][1]["mass_kg"], "yes" if feasible(P, E["best"][1]) else "no"))
    print("  direct (multi-start Nelder-Mead, penalty r 1e3, budget %d per start): %d calls -> %.2f kg, feasible %s, max g %+.4f" % (
        P["direct_budget"], D["calls"], D["R"]["mass_kg"], "yes" if feasible(P, D["R"]) else "no", max(constraints(P, D["R"]).values())))
    print("  at 5 min per CAE run: surrogate %.1f h, direct %.1f h" % (E["calls"] * 5 / 60, D["calls"] * 5 / 60))

    F = fb_final_ei(P, E)
    models = F["models"]
    zb = fb_to_z(P, E["best"][0])
    print("\n## 6.2 Penalty factor study (optimum on the final Kriging, verified with the true solver)")
    for r in fb_penalty_study(P, models, zb):
        print("  r %7.0e: h %.2f, a %.1f, k %.2f -> true mass %.3f kg, f_bend %.2f Hz, largest g %+.5f, feasible %s" % (
            r["r"], r["x"][0], r["x"][1], r["x"][2], r["mass"], r["f_bend"], r["g_max"], "yes" if r["feasible"] else "no"))

    print("\n## 6.3 Expected improvement EI(f_min 41.2 kg; mu, s)")
    tab, sds = fb_ei_table()
    print("  mu \\ s  " + "  ".join("%7.2f" % s for s in sds))
    for mu, vals in tab:
        print("  %6.2f  " % mu + "  ".join("%7.4f" % v for v in vals))

    print("\n## 6.4 EGO convergence and stopping")
    prev = None
    for h in E["hist"]:
        gain = (prev - h["best_mass"]) if prev else 0.0
        print("  iteration %2d: %2d calls, best %.3f kg, gain %.3f kg" % (h["iter"], h["calls"], h["best_mass"], gain))
        prev = h["best_mass"]
    print("  largest constrained EI left after the last iteration: %.5f kg at h %.1f, a %.1f, k %.1f" % (F["ei_max"], *F["x_ei"]))
    print("  probability of feasibility of the best point on the surrogate: %.3f" % F["pf_best"])

    print("\n## 6.5 Multi-objective: mass vs bending frequency (epsilon-constraint on the surrogate, true check)")
    for r in fb_pareto(P, models, zb):
        print("  f_bend >= %5.1f Hz: h %6.2f, a %5.1f, k %6.1f -> surrogate %.2f kg / %.1f Hz, true %.2f kg / %.1f Hz, largest g %+.4f (%s) %s" % (
            r["eps"], r["x"][0], r["x"][1], r["x"][2], r["mass_sur"], r["fb_sur"], r["mass"], r["f_bend"], max(r["g"].values()),
            max(r["g"], key=r["g"].get), "feasible" if r["feasible"] else "NOT feasible"))

    print("\n## 6.6 Discrete catalogue heights (a, k re-optimised for each h, true check)")
    rows, best = fb_catalogue(P, models, zb)
    for r in rows:
        print("  RHS %3dx60x4: a %5.1f, k %6.1f -> %.2f kg, f_rigid %.2f, f_bend %.1f, sag %.2f -> %s" % (
            r["h"], r["x"][1], r["x"][2], r["R"]["mass_kg"], r["R"]["f_rigid"], r["R"]["f_bend"], r["R"]["sag"], "feasible" if r["feasible"] else "NOT feasible"))
    if best:
        print("  lightest feasible catalogue size: RHS %dx60x4, a %.1f mm, k %.1f N/mm, %.2f kg" % (best["h"], best["x"][1], best["x"][2], best["R"]["mass_kg"]))

    xb = E["best"][0]
    print("\n## 6.7 Robust design: tolerances k +/-%.0f %%, wall +/-%.0f %%, payload +/-%.0f %% (uniform, 250 samples)" % (
        100 * FB_TOL["k"], 100 * FB_TOL["t"], 100 * FB_TOL["mass"]))
    mc = fb_robust_mc(P, xb)
    print("  deterministic optimum h %.1f, a %.1f, k %.1f: P(f_rigid > 10) %.2f, P(f_bend < 60.3) %.2f, P(sag > 6) %.2f, P(any) %.2f; f_bend %.1f +/- %.1f Hz" % (
        *xb, mc["p"]["f_rigid"], mc["p"]["f_bend"], mc["p"]["sag"], mc["p"]["any"], mc["fb_mean"], mc["fb_sd"]))
    RB = fb_robust_design(P, models, zb)
    c = RB["corner"]
    print("  worst-corner ratios: f_rigid x%.3f, f_bend x%.3f, sag x%.3f -> tightened limits f_rigid <= %.2f Hz, f_bend >= %.1f Hz, sag <= %.2f mm" % (
        c["r_f_rigid"], c["r_f_bend"], c["r_sag"], c["limits"]["f_rigid_max"], c["limits"]["f_bend_min"], c["limits"]["sag_max"]))
    print("  surrogate optimum with tightened limits: h %.1f, a %.1f, k %.1f -> %.2f kg; true check: largest g %+.4f (%s)" % (
        *RB["x_sur"], RB["R_sur"]["mass_kg"], RB["g_sur"], "OK" if RB["ok_sur"] else "NOT OK"))
    print("  after local refinement on the true solver (%d calls): h %.1f, a %.1f, k %.1f -> %.2f kg, f_rigid %.2f, f_bend %.1f, sag %.2f; largest g %+.4f (%s)" % (
        RB["calls"], *RB["x"], RB["R"]["mass_kg"], RB["R"]["f_rigid"], RB["R"]["f_bend"], RB["R"]["sag"], RB["g"], "OK" if RB["ok"] else "NOT OK"))
    mc2 = fb_robust_mc(P, RB["x"])
    print("  robust design: P(f_rigid > 10) %.2f, P(f_bend < 60.3) %.2f, P(sag > 6) %.2f, P(any) %.2f; mass +%.1f %% vs deterministic optimum" % (
        mc2["p"]["f_rigid"], mc2["p"]["f_bend"], mc2["p"]["sag"], mc2["p"]["any"], 100 * (RB["R"]["mass_kg"] / E["best"][1]["mass_kg"] - 1)))

    print("\n## 6.8 Verification of the optimum on the true solver and finer meshes")
    for n in (8, 16, 32):
        R = responses(P, xb, n)
        print("  %2d elements: mass %.3f kg, f_rigid %.4f Hz, f_bend %.3f Hz, sag %.4f mm, sigma %.2f MPa -> %s" % (
            n, R["mass_kg"], R["f_rigid"], R["f_bend"], R["sag"], R["sigma"], "feasible" if feasible(P, R) else "NOT feasible"))

# ================================================================ added with guide chapters (ch78)
# ---------------------------------------------------------------- chapter 7: catalogues (typical values - check)
FC_X_OPT = [79.2, 230.5, 104.7]      # a point on the flat optimum of the default problem (examples: h 79.2, a 233.6, k 105.5 - same 41.20 kg)
FC_RHS = [   # EN 10219 cold-formed RHS h x b x t mm, mass kg/m with corner radii (typical catalogue values - check)
    (60, 40, 4, 5.64), (80, 40, 4, 6.90), (70, 50, 4, 6.97), (80, 60, 4, 8.15), (90, 50, 4, 8.15), (100, 50, 4, 8.78),
    (100, 60, 4, 9.41), (80, 60, 5, 9.99), (120, 60, 4, 10.7), (100, 60, 5, 11.6), (120, 80, 4, 11.9)]
FC_MOUNTS = [   # rubber cylinder / levelling mounts: name, vertical stiffness N/mm, max static load N, price EUR (typical - check)
    ("RM-40", 60.0, 450.0, 9.0), ("RM-50", 90.0, 700.0, 11.0), ("RM-60", 110.0, 1000.0, 14.0), ("RM-60H", 140.0, 1200.0, 16.0),
    ("RM-75", 180.0, 1600.0, 21.0), ("RM-100", 260.0, 2600.0, 32.0)]
FC_COST = {"steel_eur_kg": 1.40, "saw_eur_cut": 2.5, "weld_eur_m": 18.0, "drill_eur_hole": 1.5, "paint_eur_m2": 12.0,
           "plate_eur": 6.0}   # material, sawing, MAG fillet a 3 incl. preparation (M11 cost model), drilling, painting, mount plate (check)
FC_TOL = {"t_rel": 0.10, "k_rel": 0.20, "m_rel": 0.10}   # RHS wall +/-10 % (EN 10219 typical), mount stiffness +/-20 %, masses +/-10 % (check)
FC_CROSS = {"n": 3, "length": 500.0}     # cross members between the two beams (same section), length mm

def fc_section_P(P, h, b, t):
    """Problem with another RHS width / wall (the core keeps b and t in P; h stays a variable)."""
    return dict(P, b=float(b), t=float(t))

def fc_catalogue(P, a, k, n_el=None):
    """Every catalogue RHS with the optimised mount position and stiffness, solved with the true (virtual) solver:
    model mass (sharp corners), catalogue mass, responses, feasibility; the lightest feasible section."""
    rows = []
    for h, b, t, kgm in FC_RHS:
        Q = fc_section_P(P, h, b, t)
        R = responses(Q, [h, a, k], n_el)
        rows.append({"rhs": "%dx%dx%d" % (h, b, t), "h": h, "b": b, "t": t, "kg_m": kgm, "mass_cat": 2 * kgm * P["L"] / 1000,
                     "R": R, "g": constraints(Q, R), "ok": feasible(Q, R)})
    ok = [r for r in rows if r["ok"]]
    return {"rows": rows, "best": min(ok, key=lambda r: r["mass_cat"]) if ok else None}

def fc_retune(Q, h, a0, k0, fix_k=False, budget=80):
    """Inner re-optimisation after a discrete choice: keep the catalogue section h (and the catalogue mount k if
    fix_k) and move the continuous variables (a, k) to minimise the worst normalised constraint (true solver).
    Normalised variables, Nelder-Mead with an evaluation budget."""
    lo = [v[1] for v in Q["vars"]][1:]
    hi = [v[2] for v in Q["vars"]][1:]
    def unpack(z):
        a = lo[0] + z[0] * (hi[0] - lo[0])
        k = k0 if fix_k else lo[1] + z[1] * (hi[1] - lo[1])
        return a, k
    def f(z):
        if any(v < 0 or v > 1 for v in z):
            return 1e9
        a, k = unpack(z)
        return max(constraints(Q, responses(Q, [h, a, k])).values())      # worst normalised constraint (<= 0 feasible)
    z0 = [(a0 - lo[0]) / (hi[0] - lo[0])] + ([] if fix_k else [(k0 - lo[1]) / (hi[1] - lo[1])])
    z, v = nelder_mead(f, z0, [0.1] * len(z0), tol=1e-6, itmax=200, fmax=budget)
    a, k = unpack(z if not fix_k else list(z) + [0.0])
    R = responses(Q, [h, a, k])
    return {"a": a, "k": k, "R": R, "g_max": v, "ok": feasible(Q, R)}

def fc_catalogue_retuned(P, a0, k0):
    """Catalogue sections with a and k re-tuned for each (discrete outer loop, continuous inner loop)."""
    rows = []
    for h, b, t, kgm in FC_RHS:
        Q = fc_section_P(P, h, b, t)
        r = fc_retune(Q, h, a0, k0)
        rows.append(dict(r, rhs="%dx%dx%d" % (h, b, t), h=h, b=b, t=t, kg_m=kgm, mass_cat=2 * kgm * P["L"] / 1000))
    ok = [r for r in rows if r["ok"]]
    return {"rows": rows, "best": min(ok, key=lambda r: r["mass_cat"]) if ok else None}

def fc_mount_load(P, x, b=None, t=None):
    """Static load per mount (1 g): reaction of each support spring = 2k x compression / 2 mounts."""
    h, a, k = x
    Q = fc_section_P(P, h, b or P["b"], t or P["t"])
    r = frame_fe(dict(Q, dyn=1.0, F_shake=0.0), h, a, k)
    xs, u = r["nodes"], r["u"]
    idx = lambda xx: min(range(len(xs)), key=lambda i: abs(xs[i] - xx))
    loads = [-k * u[2 * idx(s)] for s in (a, P["L"] - a)]     # per mount (each support position has 2 mounts of k)
    return {"F_mount": loads, "F_total": 2 * sum(loads), "weight": 9.81 * (sum(m for _, m in P["masses"]) * 1000 + r["mass_kg"])}

def fc_select_mount(P, x, b=None, t=None):
    """Real mounts: for each catalogue mount solve the frame with its stiffness; feasible and within the load rating."""
    h, a, _ = x
    out = []
    for name, km, Fmax, price in FC_MOUNTS:
        Q = fc_section_P(P, h, b or P["b"], t or P["t"])
        r = fc_retune(Q, h, a, km, fix_k=True, budget=40)             # mount stiffness fixed by the catalogue: move a only
        Fm = max(fc_mount_load(P, [h, r["a"], km], b, t)["F_mount"])
        out.append({"name": name, "k": km, "a": r["a"], "F_max": Fmax, "F": Fm, "price": price, "R": r["R"],
                    "ok": r["ok"] and Fm <= Fmax, "load_ok": Fm <= Fmax})
    ok = [m for m in out if m["ok"]]
    return {"rows": out, "best": min(ok, key=lambda m: m["price"]) if ok else None}

def fc_reverify(P, x, b=None, t=None, meshes=(8, 16, 32, 64)):
    """Final design on finer meshes; margins = distance of each response from its limit in %."""
    h, a, k = x
    Q = fc_section_P(P, h, b or P["b"], t or P["t"])
    lim = P["limits"]
    rows = []
    for n in meshes:
        R = responses(Q, x, n)
        rows.append({"n_el": n, "R": R, "margin": {"f_rigid": 100 * (1 - R["f_rigid"] / lim["f_rigid_max"]),
                                                   "f_bend": 100 * (R["f_bend"] / lim["f_bend_min"] - 1),
                                                   "sag": 100 * (1 - R["sag"] / lim["sag_max"]),
                                                   "sigma": 100 * (1 - R["sigma"] / lim["sigma_max"])}})
    return rows

FC_TOL_PROD = {"t_rel": 0.10, "k_rel": 0.10, "m_rel": 0.03}   # after measures: mounts matched / measured +/-10 %, masses weighed +/-3 % (check)

def fc_tolerance_corners(P, x, b=None, t=None, tol=None):
    """Worst case of the frequencies over the corners wall thickness +/-, mount stiffness +/-, masses +/-
    (2^3 = 8 solver calls). The wall changes I and A; the masses scale all point masses."""
    tol = tol or FC_TOL
    h, a, k = x
    tt = t or P["t"]
    rows = []
    for st in (-1, 1):
        for sk in (-1, 1):
            for sm in (-1, 1):
                Q = fc_section_P(P, h, b or P["b"], tt * (1 + st * tol["t_rel"]))
                Q["masses"] = [[xm, m * (1 + sm * tol["m_rel"])] for xm, m in P["masses"]]
                R = responses(Q, [h, a, k * (1 + sk * tol["k_rel"])])
                rows.append({"t": st, "k": sk, "m": sm, "R": R})
    return {"rows": rows, "f_rigid_max": max(r["R"]["f_rigid"] for r in rows), "f_bend_min": min(r["R"]["f_bend"] for r in rows),
            "sag_max": max(r["R"]["sag"] for r in rows)}

def fc_corners_ok(P, tc):
    lim = P["limits"]
    return tc["f_rigid_max"] <= lim["f_rigid_max"] and tc["f_bend_min"] >= lim["f_bend_min"] and tc["sag_max"] <= lim["sag_max"]

def fc_robust_search(P, sections, mounts, a_grid, tol):
    """Robust design by enumeration: catalogue section x catalogue mount x mount position on a 50 mm grid; a design
    is accepted only if all 8 tolerance corners meet the limits. Lightest, then cheapest mount."""
    rows = []
    for h, b, t, kgm in sections:
        for name, km, Fmax, price in mounts:
            for a in a_grid:
                tc = fc_tolerance_corners(P, [h, a, km], b, t, tol)
                rows.append({"rhs": "%dx%dx%d" % (h, b, t), "h": h, "b": b, "t": t, "kg_m": kgm, "mount": name, "k": km, "price": price,
                             "a": a, "tc": tc, "ok": fc_corners_ok(P, tc)})
    ok = [r for r in rows if r["ok"]]
    return {"rows": rows, "ok": ok, "best": min(ok, key=lambda r: (r["kg_m"], r["price"], -r["a"])) if ok else None}

def fc_cut_list(P, h, b, t, a):
    """Cut list, weld length, mount holes of the welded frame (two long beams, cross members welded all round)."""
    L, cr = P["L"], FC_CROSS
    perim = 2 * (h + b) / 1000
    weld_m = cr["n"] * 2 * perim                       # each cross member: both ends welded all round
    holes = [round(a, 1), round(L - a, 1)]
    return {"parts": [("long beam RHS %dx%dx%d" % (h, b, t), 2, L), ("cross member RHS %dx%dx%d" % (h, b, t), cr["n"], cr["length"]),
                      ("mount plate 100x100x8 S235, hole 13", 4, 100.0)],
            "weld_m": weld_m, "holes": holes, "cuts": 2 + cr["n"] + 4}

def fc_cost(P, h, b, t, kgm, a, mount_price):
    """Frame cost: steel + sawing + welding + drilling + painting + mount plates + 4 mounts (EUR, typical rates)."""
    c = FC_COST
    cl = fc_cut_list(P, h, b, t, a)
    length_m = (2 * P["L"] + FC_CROSS["n"] * FC_CROSS["length"]) / 1000
    steel_kg = kgm * length_m + 4 * 0.1 * 0.1 * 0.008 * 7850
    area = 2 * (h + b) / 1000 * length_m
    parts = {"steel": steel_kg * c["steel_eur_kg"], "sawing": cl["cuts"] * c["saw_eur_cut"], "welding": cl["weld_m"] * c["weld_eur_m"],
             "drilling": 8 * c["drill_eur_hole"], "painting": area * c["paint_eur_m2"], "plates": 4 * c["plate_eur"], "mounts": 4 * mount_price}
    return {"parts": parts, "total": sum(parts.values()), "steel_kg": steel_kg}

def fc_test_plan(P, R, f_max_factor=2.5, n_lines=1600):
    """Impact-hammer modal test: frequency range up to 2.5 x the highest frequency of interest, sampling, resolution,
    record length, hammer tip, acceptance window +/-5 % around the model."""
    fmax = f_max_factor * max(R["f"][:3])
    fs = 2.56 * fmax                                    # analyser practice: fs = 2.56 x bandwidth
    df = fmax / n_lines
    tip = "rubber (soft) tip, up to ~500 Hz" if fmax <= 500 else "plastic tip, up to ~2 kHz" if fmax <= 2000 else "steel tip"
    acc = [(i + 1, f, 0.95 * f, 1.05 * f) for i, f in enumerate(R["f"][:3])]
    return {"f_band": fmax, "fs": fs, "df": df, "T_rec": 1 / df, "tip": tip, "acceptance": acc,
            "points": [round(P["L"] * i / 10) for i in range(11)]}

def fc_after_test(P, x, f_meas):
    """Calibration loop: identify the joint (EI) and mount (k) factors from the test, then check the limits with the
    calibrated model - decide whether the design must change."""
    C = calibrate(P, x, f_meas)
    h, a, k = x
    r = frame_fe(P, h, a, k, EI_factor=C["EI_factor"], k_factor=C["k_factor"])
    Rc = {"f_rigid": r["f"][1], "f_bend": r["f"][2]}
    return {"C": C, "f_rigid": Rc["f_rigid"], "f_bend": Rc["f_bend"],
            "ok": Rc["f_rigid"] <= P["limits"]["f_rigid_max"] and Rc["f_bend"] >= P["limits"]["f_bend_min"]}

def fc_manifest(P, x, R, solver="optflow virtual CAE 2-D beam FE"):
    """Run manifest for data management: input hash (identical inputs -> identical hash), design, results, solver."""
    import hashlib
    blob = json.dumps({"P": P, "x": x}, sort_keys=True).encode("utf-8")
    return {"run_id": hashlib.sha256(blob).hexdigest()[:12], "solver": solver, "x": x,
            "results": {k: round(v, 4) for k, v in R.items() if k != "f"}, "frequencies": [round(f, 3) for f in R["f"]]}

FC_APDL = """! APDL macro (template - check element / section options in your Ansys version)
! two RHS beams as one 2-D beam pair, point masses, spring mounts, modal analysis
/PREP7
h = {h}  $ a = {a}  $ k = {k}  $ L = {L}
ET,1,BEAM188  $ ET,2,MASS21,,,4  $ ET,3,COMBIN14
MP,EX,1,210000 $ MP,PRXY,1,0.3 $ MP,DENS,1,7.85e-9
SECTYPE,1,BEAM,HREC $ SECDATA,{b},h,{t},{t},{t},{t}     ! hollow rectangle b x h, walls t
K,1,0,0 $ K,2,L,0 $ L,1,2 $ LESIZE,ALL,,,{n_el} $ LMESH,ALL
! ... MASS21 at the mass positions (R,2,m,m), COMBIN14 to ground at x = a and x = L - a (R,3,2*k), D,ALL,UZ / ROTX / ROTY ...
/SOLU $ ANTYPE,MODAL $ MODOPT,LANB,6 $ SOLVE $ FINISH
/POST1 $ *GET,F1,MODE,1,FREQ $ *GET,F2,MODE,2,FREQ $ *GET,F3,MODE,3,FREQ
*CFOPEN,result,txt $ *VWRITE,F1,F2,F3 $ ('F1 = ',F12.5,/,'F2 = ',F12.5,/,'F3 = ',F12.5) $ *CFCLOS
"""

def fc_export_apdl(P, x, out):
    os.makedirs(out, exist_ok=True)
    txt = FC_APDL
    for k_, v in {"h": "%.2f" % x[0], "a": "%.2f" % x[1], "k": "%.2f" % x[2], "L": "%.1f" % P["L"], "b": "%g" % P["b"],
                  "t": "%g" % P["t"], "n_el": str(P["n_el"])}.items():
        txt = txt.replace("{%s}" % k_, v)
    p = os.path.join(out, "frame_modal.mac")
    with open(p, "w", encoding="utf-8") as f:
        f.write(txt)
    return p

FC_CHECKLIST = [
    "variables are CAD dimensions that really change the part (rebuild tested at all bounds)",
    "objective and every limit written with unit and source (standard, order of excitation, customer)",
    "solver verified against theory (mesh study, simple load cases) before the loop starts",
    "solver calibrated against a test of a similar part (or margins increased)",
    "batch call works without GUI; failures caught and logged; cache / restart possible",
    "DOE checked: no failed or duplicate points, responses smooth enough for a surrogate (LOO error)",
    "optimum verified with the true solver on a finer mesh; active limits identified",
    "rounded to catalogue / manufacturable values and re-verified; tolerance corners checked",
    "drawing, cut list, weld note and inspection items derived from the final model",
    "test plan with acceptance window written before the prototype is built",
]
FC_EFFORT = [   # task, effort in person-days (typical first project - check)
    ("clean parametric CAD model (SOLIDWORKS equations, design table, rebuild tests)", 2.0),
    ("CAE model in batch mode (Ansys Workbench parameters or Abaqus script), mesh study", 3.0),
    ("coupling script (MATLAB or Python), file exchange, failure handling, logging", 2.0),
    ("DOE + surrogate + optimisation runs, review of results", 1.5),
    ("rounding, re-verification, tolerance study, drawing update", 1.0),
    ("modal test of the prototype and calibration", 2.0),
    ("documentation / report / handover", 1.0),
]
FC_FAILURES = [   # failure of an optimisation project, symptom, prevention
    ("wrong limits", "optimum looks great, product fails", "derive every limit from the load / excitation (M2 orders, M11)"),
    ("CAD does not rebuild at the bounds", "random solver failures, holes in the DOE", "rebuild test at all 2^n corners before the loop"),
    ("mesh changes with the geometry", "noisy responses, optimiser chases noise", "fixed element size, mesh study, smooth surrogate"),
    ("uncalibrated CAE", "the optimum sits on a limit that is 10 % wrong", "calibrate to a test, or keep 10-15 % margin"),
    ("penalty optimiser", "optimum slightly infeasible (direct search: 59.3 < 60.3 Hz)", "verify feasibility with the true solver; small safety offset"),
    ("too many variables", "DOE explodes, surrogate poor", "screening (sensitivity) first, keep 3-8 variables"),
    ("optimum not manufacturable", "odd sizes, no catalogue part", "discrete catalogue step and re-verification (chapter 7.1)"),
    ("results lost / not reproducible", "nobody knows which model gave which number", "run manifest with input hash, evaluation CSV, PDM"),
]

# ---------------------------------------------------------------- chapter 8: worked example
def fc_example():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "examples", "optflow_example.json")
    if not os.path.exists(p):
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "optflow_example.json")
    return json.load(open(p, encoding="utf-8"))

def demo_ch78():
    P = dict(DEFAULT)
    h, a, k = FC_X_OPT
    print("## 7.1 Catalogue rounding: every EN 10219 RHS with the optimum a %.1f mm, k %.1f N/mm (true solver)" % (a, k))
    cat = fc_catalogue(P, a, k)
    for r in cat["rows"]:
        R = r["R"]
        print("  RHS %-9s %5.2f kg/m -> frame %5.1f kg (model %5.1f): f_rigid %5.2f, f_bend %6.1f Hz, sag %4.2f mm, sigma %5.1f MPa -> %s" % (
            r["rhs"], r["kg_m"], r["mass_cat"], R["mass_kg"], R["f_rigid"], R["f_bend"], R["sag"], R["sigma"],
            "OK" if r["ok"] else "fails " + ", ".join(n for n, v in r["g"].items() if v > 1e-3)))
    print("  feasible with the optimum a and k unchanged: %d of %d sections" % (sum(r["ok"] for r in cat["rows"]), len(cat["rows"])))
    print("\n  ... the same sections with a and k re-tuned for each section (inner loop, max. 80 solver calls each):")
    ct = fc_catalogue_retuned(P, a, k)
    for r in ct["rows"]:
        R = r["R"]
        print("  RHS %-9s frame %5.1f kg: a %5.1f mm, k %5.1f N/mm -> f_rigid %5.2f, f_bend %6.1f Hz, sag %4.2f mm, worst g %+.3f -> %s" % (
            r["rhs"], r["mass_cat"], r["a"], r["k"], R["f_rigid"], R["f_bend"], R["sag"], r["g_max"], "OK" if r["ok"] else "fails"))
    best = ct["best"]
    print("  lightest feasible catalogue section: RHS %s, %.1f kg with a %.1f mm, k %.1f N/mm (continuous optimum h %.1f x 60 x 4: model %.2f kg)" % (
        best["rhs"], best["mass_cat"], best["a"], best["k"], h, responses(P, FC_X_OPT)["mass_kg"]))
    B = best
    a, k = best["a"], best["k"]
    xb = [B["h"], a, k]

    print("\n## 7.2 Real isolation mounts (catalogue stiffness and load rating, RHS %s; a re-tuned for each mount)" % B["rhs"])
    ld = fc_mount_load(P, xb, B["b"], B["t"])
    print("  static load per mount (1 g): %.0f / %.0f N, sum of 4 mounts %.0f N = weight %.0f N" % (ld["F_mount"][0], ld["F_mount"][1], ld["F_total"], ld["weight"]))
    ms = fc_select_mount(P, xb, B["b"], B["t"])
    for m in ms["rows"]:
        R = m["R"]
        print("  %-7s k %5.0f N/mm, rating %5.0f N (load %4.0f N): a %5.1f mm -> f_rigid %5.2f Hz, sag %4.2f mm, f_bend %5.1f Hz, %5.2f EUR -> %s" % (
            m["name"], m["k"], m["F_max"], m["F"], m["a"], R["f_rigid"], R["sag"], R["f_bend"], m["price"], "OK" if m["ok"] else "NOT OK"))
    mb = ms["best"]
    print("  selected: %s (k %.0f N/mm) with a %.1f mm" % (mb["name"], mb["k"], mb["a"]) if mb else "  no catalogue mount fits")
    if mb:
        a = round(mb["a"] / 5) * 5                          # drawing value: hole position on a 5 mm grid
    xf = [B["h"], a, mb["k"] if mb else k]
    QB = fc_section_P(P, B["h"], B["b"], B["t"])
    Rq = responses(QB, xf)
    print("  drawing value a = %.0f mm -> f_rigid %.2f Hz, f_bend %.1f Hz, sag %.2f mm, feasible %s" % (a, Rq["f_rigid"], Rq["f_bend"], Rq["sag"], feasible(QB, Rq)))

    print("\n## 7.3 Re-verification of the final design (RHS %s, a %.1f, %s) on finer meshes; margins to the limits" % (B["rhs"], a, mb["name"] if mb else "-"))
    for r in fc_reverify(P, xf, B["b"], B["t"]):
        R, mg = r["R"], r["margin"]
        print("  %2d elements: f_rigid %.4f, f_bend %.3f Hz, sag %.4f mm, sigma %.2f MPa | margins f_rigid %+.1f %%, f_bend %+.1f %%, sag %+.1f %%, sigma %+.1f %%" % (
            r["n_el"], R["f_rigid"], R["f_bend"], R["sag"], R["sigma"], mg["f_rigid"], mg["f_bend"], mg["sag"], mg["sigma"]))

    print("\n## 7.4 Tolerance corners: wall +/-%.0f %%, mount stiffness +/-%.0f %%, masses +/-%.0f %% (8 solver calls)" % (
        100 * FC_TOL["t_rel"], 100 * FC_TOL["k_rel"], 100 * FC_TOL["m_rel"]))
    tc = fc_tolerance_corners(P, xf, B["b"], B["t"])
    for r in tc["rows"]:
        print("  t %+d, k %+d, m %+d: f_rigid %5.2f Hz, f_bend %5.1f Hz, sag %4.2f mm" % (r["t"], r["k"], r["m"], r["R"]["f_rigid"], r["R"]["f_bend"], r["R"]["sag"]))
    print("  worst case: f_rigid %.2f Hz (limit %.1f), f_bend %.1f Hz (limit %.1f), sag %.2f mm (limit %.1f)" % (
        tc["f_rigid_max"], P["limits"]["f_rigid_max"], tc["f_bend_min"], P["limits"]["f_bend_min"], tc["sag_max"], P["limits"]["sag_max"]))
    tc_opt = fc_tolerance_corners(P, FC_X_OPT)
    print("  same corners for the unrounded optimum (h %.1f, a %.1f, k %.1f): f_rigid %.2f Hz, f_bend %.1f Hz, sag %.2f mm" % (
        FC_X_OPT[0], FC_X_OPT[1], FC_X_OPT[2], tc_opt["f_rigid_max"], tc_opt["f_bend_min"], tc_opt["sag_max"]))
    print("  -> an optimum with < 1 %% margin on its active limits fails at the tolerance corners: %s" % ("OK" if fc_corners_ok(P, tc) else "NOT OK"))

    print("\n## 7.4b Robust choice: catalogue section x catalogue mount x position (50 mm grid), all 8 corners must pass")
    sections = [s for s in FC_RHS if s[3] >= 8.15][:3]
    s20 = fc_robust_search(P, sections, FC_MOUNTS[1:5], (250.0, 350.0, 450.0, 550.0), FC_TOL)
    print("  with the raw tolerances (mounts +/-%.0f %%, masses +/-%.0f %%): %d of %d combinations pass" % (
        100 * FC_TOL["k_rel"], 100 * FC_TOL["m_rel"], len(s20["ok"]), len(s20["rows"])))
    sp = fc_robust_search(P, sections, FC_MOUNTS[1:5], (250.0, 350.0, 450.0, 550.0), FC_TOL_PROD)
    print("  with production measures (mounts matched +/-%.0f %%, masses weighed +/-%.0f %%): %d of %d combinations pass:" % (
        100 * FC_TOL_PROD["k_rel"], 100 * FC_TOL_PROD["m_rel"], len(sp["ok"]), len(sp["rows"])))
    for r in sp["ok"]:
        tcr = r["tc"]
        print("    RHS %-9s %-7s a %3.0f mm: worst f_rigid %.2f Hz, f_bend %.1f Hz, sag %.2f mm" % (r["rhs"], r["mount"], r["a"], tcr["f_rigid_max"], tcr["f_bend_min"], tcr["sag_max"]))
    rb = sp["best"]
    if rb:
        print("  robust final design: RHS %s, %s (k %.0f N/mm), mounts at a = %.0f mm" % (rb["rhs"], rb["mount"], rb["k"], rb["a"]))
        B = {"rhs": rb["rhs"], "h": rb["h"], "b": rb["b"], "t": rb["t"], "kg_m": rb["kg_m"]}
        mb = {"name": rb["mount"], "k": rb["k"], "price": rb["price"]}
        a = rb["a"]
        xf = [B["h"], a, mb["k"]]
        QB = fc_section_P(P, B["h"], B["b"], B["t"])
        Rr = responses(QB, xf)
        print("  nominal: mass %.2f kg (model), f_rigid %.2f Hz, f_bend %.1f Hz, sag %.2f mm, sigma %.1f MPa; mount load %.0f N <= rating %.0f N" % (
            Rr["mass_kg"], Rr["f_rigid"], Rr["f_bend"], Rr["sag"], Rr["sigma"], max(fc_mount_load(P, xf, B["b"], B["t"])["F_mount"]),
            [m[2] for m in FC_MOUNTS if m[0] == mb["name"]][0]))

    print("\n## 7.5 Drawing data: cut list, welds, mount holes")
    cl = fc_cut_list(P, B["h"], B["b"], B["t"], a)
    for name, n, l in cl["parts"]:
        print("  %d x %-38s length %.0f mm" % (n, name, l))
    print("  welds: %d cross members welded all round at both ends -> %.2f m fillet a 3 (M11); mount holes at x = %.1f / %.1f mm on both beams; %d saw cuts" % (
        FC_CROSS["n"], cl["weld_m"], cl["holes"][0], cl["holes"][1], cl["cuts"]))

    print("\n## 7.6 Cost of frame variants (typical rates - check)")
    variants = [("current RHS 100x60x4, RM-60H", 100, 60, 4, 9.41, 300.0, 16.0),
                ("nominal optimum RHS 80x60x4, RM-60", 80, 60, 4, 8.15, 265.0, 14.0),
                ("robust final RHS %s, %s" % (B["rhs"], mb["name"] if mb else "-"), B["h"], B["b"], B["t"], B["kg_m"], a, mb["price"] if mb else 14.0),
                ("stiffer RHS 120x60x4, RM-60H", 120, 60, 4, 10.7, 300.0, 16.0)]
    base = None
    for name, hh, bb, tt, kgm, aa, pr in variants:
        c = fc_cost(P, hh, bb, tt, kgm, aa, pr)
        base = base or c["total"]
        print("  %-32s steel %5.1f kg: " % (name, c["steel_kg"]) + ", ".join("%s %.1f" % (n, v) for n, v in c["parts"].items()) +
              " -> %.1f EUR (%+.1f %%)" % (c["total"], 100 * (c["total"] / base - 1)))

    print("\n## 7.7 Modal test plan (impact hammer) and acceptance window")
    Rf = responses(fc_section_P(P, *xf[:1], B["b"], B["t"]), xf)
    tp = fc_test_plan(P, Rf)
    print("  band 0 ... %.0f Hz, sampling %.0f Hz, 1600 lines -> resolution %.3f Hz, record %.1f s, %s" % (tp["f_band"], tp["fs"], tp["df"], tp["T_rec"], tp["tip"]))
    print("  impact / response points (mm): %s" % ", ".join(str(p) for p in tp["points"]))
    for i, f, lo, hi in tp["acceptance"]:
        print("  mode %d: model %.2f Hz -> accept %.2f ... %.2f Hz" % (i, f, lo, hi))

    print("\n## 7.8 Test deviates: calibration loop (example: joints 15 % softer, mounts 10 % stiffer than modelled)")
    fm = frame_fe(fc_section_P(P, B["h"], B["b"], B["t"]), *xf, EI_factor=0.85, k_factor=1.10)["f"][:3]
    at = fc_after_test(fc_section_P(P, B["h"], B["b"], B["t"]), xf, fm)
    print("  measured %s Hz -> EI factor %.3f, k factor %.3f (rms %.4f %%); calibrated model: f_rigid %.2f Hz, f_bend %.1f Hz -> %s" % (
        ", ".join("%.2f" % f for f in fm), at["C"]["EI_factor"], at["C"]["k_factor"], at["C"]["rms_pct"], at["f_rigid"], at["f_bend"],
        "limits still met" if at["ok"] else "LIMIT VIOLATED - change the design"))
    if not at["ok"]:
        for r in sp["ok"]:                                  # next robust candidate, evaluated with the calibrated factors
            if r["rhs"] == B["rhs"]:
                continue
            rr = frame_fe(fc_section_P(P, r["h"], r["b"], r["t"]), r["h"], r["a"], r["k"], EI_factor=at["C"]["EI_factor"], k_factor=at["C"]["k_factor"])
            Qc = fc_section_P(P, r["h"], r["b"], r["t"])
            print("  next robust candidate RHS %s, %s, a %.0f with the calibrated factors: f_rigid %.2f Hz, f_bend %.1f Hz -> %s (frame +%.1f kg)" % (
                r["rhs"], r["mount"], r["a"], rr["f"][1], rr["f"][2],
                "OK" if rr["f"][1] <= P["limits"]["f_rigid_max"] and rr["f"][2] >= P["limits"]["f_bend_min"] else "NOT OK",
                2 * (r["kg_m"] - B["kg_m"]) * P["L"] / 1000))
            break

    print("\n## 7.9 Run manifest (data management)")
    print("  " + json.dumps(fc_manifest(P, xf, Rf)))
    print("  same inputs again -> same run_id: %s" % (fc_manifest(P, xf, Rf)["run_id"] == fc_manifest(dict(P), list(xf), Rf)["run_id"]))

    print("\n## 7.10 Templates for your tools (filled with the final design)")
    import tempfile
    d = tempfile.mkdtemp()
    QB = fc_section_P(P, B["h"], B["b"], B["t"])
    names = export_templates(QB, d, xf) + [os.path.basename(fc_export_apdl(QB, xf, d))]
    print("  APDL macro filled: " + " | ".join(l for l in open(os.path.join(d, "frame_modal.mac"), encoding="utf-8").read().splitlines()[3:6]))
    for n in names:
        lines = open(os.path.join(d, n), encoding="utf-8").read().splitlines()
        print("  %-32s %3d lines; first: %s" % (n, len(lines), lines[0][:80]))

    print("\n## 7.11 Checklist, effort, failure modes")
    for i, c in enumerate(FC_CHECKLIST, 1):
        print("  [%2d] %s" % (i, c))
    print("  effort of a first loop: " + "; ".join("%s %.1f d" % (t_, d_) for t_, d_ in FC_EFFORT) + " -> total %.1f person-days" % sum(d_ for _, d_ in FC_EFFORT))
    for f_, s_, p_ in FC_FAILURES:
        print("  %-36s | %-48s | %s" % (f_, s_, p_))

    print("\n## 8.1 Worked example input (examples/optflow_example.json)")
    E = fc_example()
    print("  " + json.dumps(E))

def cmd_examples():
    P = dict(DEFAULT)
    S = summary(P)
    print(report_text(P, S))
    print("\n## Mesh convergence of the virtual CAE (current design)")
    for n in (4, 8, 16, 32):
        R = responses(P, P["x0"], n)
        print("  %2d elements: f_rigid %.4f Hz, f_bend %.3f Hz, sigma %.2f MPa" % (n, R["f_rigid"], R["f_bend"], R["sigma"]))
    print("\n## Calibration to a 'measured' frame (true joints 25 % softer, mounts 15 % stiffer)")
    h, a, k = P["x0"]
    fm = frame_fe(P, h, a, k, EI_factor=0.75, k_factor=1.15)["f"][:3]
    C = calibrate(P, P["x0"], fm)
    print("  measured %s Hz -> EI factor %.3f, k factor %.3f, model %s Hz (rms %.3f %%)" % (
        ", ".join("%.2f" % v for v in fm), C["EI_factor"], C["k_factor"], ", ".join("%.2f" % v for v in C["f_model"]), C["rms_pct"]))

def cmd_selftest():
    ok = []
    def chk(name, cond, info=""):
        ok.append(bool(cond))
        print("%-66s %s %s" % (name, "OK  " if cond else "FAIL", info))
    # free-free beam (very soft springs): first bending frequency (4.730^2 / (2 pi L^2)) sqrt(EI / rho A)
    P = dict(DEFAULT, L=1600.0, masses=[[800.0, 1e-9]], F_shake=0.0, n_el=40)
    A, I, _ = rhs_section(100, 60, 4)
    r = frame_fe(P, 100, 400, 1e-6)
    f_th = 4.7300407 ** 2 / (2 * math.pi * P["L"] ** 2) * math.sqrt(2 * P["E"] * I / (2 * P["rho"] * A))
    chk("free-free beam: 1st bending frequency = 4.730^2/(2 pi L^2) sqrt(EI/rhoA)", abs(r["f"][2] / f_th - 1) < 2e-3, "%.2f / %.2f Hz" % (r["f"][2], f_th))
    # rigid beam on two springs, mass in the middle: bounce f = sqrt(2 * 2k / m) / 2 pi (2 springs of 2k each)
    P2 = dict(DEFAULT, L=1600.0, E=1e9, rho=1e-15, masses=[[800.0, 0.1]], F_shake=0.0)
    r2 = frame_fe(P2, 100, 400, 50.0)
    fb = math.sqrt(2 * 2 * 50.0 / 0.1) / (2 * math.pi)
    chk("rigid beam on springs: bounce frequency sqrt(sum k / m) / 2 pi", abs(r2["f"][0] / fb - 1) < 1e-4, "%.3f Hz" % fb)
    # static: simply supported (stiff springs at the ends), central load -> deflection F L^3 / (48 EI)
    P3 = dict(DEFAULT, L=1600.0, masses=[[800.0, 1e-12]], F_shake=1000.0, dyn=0.0, rho=1e-15, n_el=20)
    r3 = frame_fe(P3, 100, 1e-9, 1e9)
    w_mid = -r3["u"][2 * r3["nodes"].index(800.0)]
    w_th = 1000.0 * P3["L"] ** 3 / (48 * 2 * P3["E"] * I)
    chk("simply supported beam: midspan deflection F L^3 / (48 EI)", abs(w_mid / w_th - 1) < 1e-3, "%.4f mm" % w_th)
    Z = lhs(10, [0.0, 0.0], [1.0, 1.0], 5)
    chk("Latin hypercube: one point in each of the 10 strata per variable", all(sorted(int(z[j] * 10) for z in Z) == list(range(10)) for j in range(2)))
    q = lambda z: 3 + 2 * z[0] - z[1] + 4 * z[0] * z[1] + 0.5 * z[1] ** 2
    Zq = lhs(12, [0.0, 0.0], [1.0, 1.0], 2)
    s = rsm_fit(Zq, [q(z) for z in Zq])
    chk("response surface recovers an exact quadratic", abs(s([0.3, 0.7]) - q([0.3, 0.7])) < 1e-8)
    kr = Kriging(Zq, [math.sin(5 * z[0]) + z[1] for z in Zq])
    chk("Kriging interpolates its training points", max(abs(kr.predict(z) - (math.sin(5 * z[0]) + z[1])) for z in Zq) < 1e-4)
    xr, fr = nelder_mead(lambda x: (1 - x[0]) ** 2 + 100 * (x[1] - x[0] ** 2) ** 2, [-1.2, 1.0], [0.5, 0.5], tol=1e-14, itmax=5000)
    chk("Nelder-Mead solves Rosenbrock (1, 1)", abs(xr[0] - 1) < 1e-3 and abs(xr[1] - 1) < 1e-3)
    chk("expected improvement: EI(mu = fmin, s) = s / sqrt(2 pi)", abs(expected_improvement(1.0, 1.0, 0.3) - 0.3 / math.sqrt(2 * math.pi)) < 1e-12)
    import tempfile
    P = dict(DEFAULT)
    d = tempfile.mkdtemp()
    Rf = file_solver(P, d)(P["x0"])
    Rd = responses(P, P["x0"])
    chk("file-based coupling (template -> external run -> parse) = direct call", all(abs(Rf[k] / Rd[k] - 1) < 1e-8 for k in ("mass_kg", "f_rigid", "f_bend", "sag", "sigma")))
    h, a, k = P["x0"]
    C = calibrate(P, P["x0"], frame_fe(P, h, a, k, EI_factor=0.8, k_factor=1.2)["f"][:3])
    chk("calibration recovers the hidden stiffness factors 0.8 / 1.2", abs(C["EI_factor"] - 0.8) < 2e-3 and abs(C["k_factor"] - 1.2) < 2e-3, "%.4f / %.4f" % (C["EI_factor"], C["k_factor"]))
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
    elif cmd == "solve":
        cmd_solve(argv)
    elif cmd == "export":
        out = argv[argv.index("--out") + 1] if "--out" in argv else "optflow_templates"
        print("written:", ", ".join(export_templates(dict(DEFAULT), out)), "->", out)
    elif cmd in ("ch24", "ch56", "ch78") and ("demo_" + cmd) in globals():
        globals()["demo_" + cmd]()
    elif cmd == "selftest":
        return cmd_selftest()
    elif cmd == "run":
        P = dict(DEFAULT)
        out = "optflow_out"
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
