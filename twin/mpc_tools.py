"""M_P_C tools tab backend - runs the calculation programs of the folder
'machine+program_software+control_system design' (theory + program combined) for the web page.

Single source of truth: the web tab calls exactly the same Python functions as the command line
(01_mechanical_design/tools/dm_toolkit.py, crank.py, fourbar.py ...). Standard library only, offline.
Lazy: nothing is imported before the first /api/mpc/... request.

GET  /api/mpc/catalog                     items, default inputs, guides
GET  /api/mpc/guide?id=M1|M2|M2b          guide text (Markdown)
GET  /api/mpc/selftest                    self-tests of all modules (about 30 s)
POST /api/mpc/dm        {"tool": "decision|gci|rel|goodman|stack|shaftopt", ...}
POST /api/mpc/crank     {"params": {...}}  crank mechanism (M2)
POST /api/mpc/fourbar   {"params": {...}}  four-bar analysis (M2b)
POST /api/mpc/path      {"track": [[x, y], ...], "timing": null | [deg], "mu_min": 40, "max_link_factor": 2.5, "generations": 120}
POST /api/mpc/path3     {"points": [[x, y] x 3], "betas": [b2, b3]}   exact 3-point path generation + free-choice search
POST /api/mpc/shaft     {"params": {...}} | {"handover": true}   stepped shaft: moments, deflection, n_crit, DIN 743 style proof,
                        key, press fit (M3); handover returns the loads from crank.py
"""
import importlib
import json
import math
import os
import subprocess
import sys
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDER = os.path.join(ROOT, "machine+program_software+control_system design")
MECH = os.path.join(FOLDER, "01_mechanical_design")
TOOLS = os.path.join(MECH, "tools")
GUIDES = {"M1": ("01_design_method.md", "M1 Design method"),
          "M2": ("02_crank_mechanism.md", "M2 Crank mechanism"),
          "M2b": ("02b_four_bar_linkage.md", "M2b Four-bar linkage"),
          "M3": ("03_shaft_design.md", "M3 Shaft design")}
_lock = threading.Lock()
_mods = {}


def _mod(name):
    with _lock:
        if name not in _mods:
            if TOOLS not in sys.path:
                sys.path.insert(0, TOOLS)
            _mods[name] = importlib.import_module(name)
        return _mods[name]


def _js(o):
    """Make results JSON-safe: complex -> [re, im], tuples -> lists, NaN/inf -> None."""
    if isinstance(o, complex):
        return [_js(o.real), _js(o.imag)]
    if isinstance(o, float):
        return o if math.isfinite(o) else None
    if isinstance(o, dict):
        return {str(k): _js(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_js(v) for v in o]
    return o


def _merge(default, given):
    P = json.loads(json.dumps(default))
    for k, v in (given or {}).items():
        if k in P:
            P[k] = v
    return P


# ---------------------------------------------------------------- catalog / guides / selftest
def catalog():
    cr, fb, sh = _mod("crank"), _mod("fourbar"), _mod("shaft")
    return {"folder": os.path.basename(FOLDER),
            "items": [
                {"id": "1", "title": "M1 Design method – calculators", "guide": "M1"},
                {"id": "2", "title": "M2 Crank mechanism (V-twin compressor)", "guide": "M2"},
                {"id": "3", "title": "M2b Four-bar linkage – analysis + animation", "guide": "M2b"},
                {"id": "4", "title": "M2b Path generation – required track → linkage", "guide": "M2b"},
                {"id": "6", "title": "M3 Shaft design", "guide": "M3"},
                {"id": "5", "title": "Guides + self-test", "guide": None}],
            "crank_default": cr.DEFAULT, "fourbar_default": fb.DEFAULT, "path_example": fb.PATH_EXAMPLE,
            "shaft_default": sh.DEFAULT, "shaft_materials": sorted(sh.MATERIALS),
            "guides": [{"id": k, "file": v[0], "title": v[1]} for k, v in GUIDES.items()]}


def guide(gid):
    if gid not in GUIDES:
        raise KeyError(gid)
    with open(os.path.join(MECH, GUIDES[gid][0]), encoding="utf-8") as f:
        return f.read()


def selftest():
    r = subprocess.run([sys.executable, "-I", os.path.join(TOOLS, "dm_toolkit.py"), "selftest_all"],
                       capture_output=True, text=True, timeout=600)
    return {"ok": r.returncode == 0, "output": r.stdout + r.stderr}


# ---------------------------------------------------------------- M1 calculators
def dm(body):
    t = _mod("dm_toolkit")
    tool = body.get("tool")
    f = lambda k, d=None: float(body.get(k, d))  # noqa: E731
    if tool == "decision":
        return t.decision_matrix(body["weights"], body["scores"])
    if tool == "gci":
        return t.gci(f("f1"), f("f2"), f("f3"), f("r", 2.0))
    if tool == "rel":
        return t.interference(f("muS"), f("sS"), f("muL"), f("sL"))
    if tool == "goodman":
        return t.marin_goodman(f("Rm"), f("Re"), f("d"), f("sa"), f("sm"), body.get("surface", "machined"),
                               int(body.get("rel", 99)))
    if tool == "stack":
        return t.stack([float(v) for v in body["tols"]])
    if tool == "shaftopt":
        return t.shaft_opt(f("T"), f("M"), f("Re", 355), f("n", 2), f("G", 80000), f("phi", 1.0), f("tmin", 3),
                           f("domax", 50))
    raise ValueError("unknown tool " + str(tool))


# ---------------------------------------------------------------- M2 crank
def crank(body):
    cr = _mod("crank")
    P = _merge(cr.DEFAULT, body.get("params"))
    R = cr.compute_all(P)
    rows = R["rows"]
    every = max(1, int(round(2.0 / P["step_deg"])))   # 2-degree resolution for the browser
    sub = rows[::every]
    xy = lambda key: {"x": [r[key][0] for r in sub], "y": [r[key][1] for r in sub]}  # noqa: E731
    ser = {"theta": [math.degrees(r["theta"]) for r in sub],
           "M": [r["M_drive"] for r in sub],
           "p": [[c["p"] / 1e5 for c in r["cyl"]] for r in sub],
           "S": [[c["S"] for c in r["cyl"]] for r in sub],
           "N": [[c["N"] for c in r["cyl"]] for r in sub],
           "pin": xy("F_pin"), "main": xy("F_main"), "shake": xy("shake"), "shake_osc": xy("shake_osc"),
           "rod1": {"x": [r["cyl"][0]["Fp"][0] for r in sub], "y": [r["cyl"][0]["Fp"][1] for r in sub]}}
    pv = R["cyc"]["pv"][::8]
    ser["pv"] = {"V": [v * 1e6 for v, _ in pv], "p": [p / 1e5 for _, p in pv]}
    rep = cr.report_text(P, R["geo"], R["M"], R["cyc"], R["tq"], R["bal"], R["brg"], R["iso"], R["tol"])
    cyc = {k: v for k, v in R["cyc"].items() if k != "pv"}
    return {"params": P, "report": rep, "series": ser, "geo": R["geo"], "masses": R["M"], "cycle": cyc,
            "torque": R["tq"], "balance": R["bal"], "bearings": R["brg"], "iso": R["iso"], "tol": R["tol"]}


# ---------------------------------------------------------------- M2b four-bar
def fourbar(body):
    fb = _mod("fourbar")
    P = _merge(fb.DEFAULT, body.get("params"))
    rows = fb.sweep(P)
    ok = [r for r in rows if r]
    a, b, c, d = (P[k + "_mm"] / 1000 for k in "abcd")
    frames = []
    for r in ok:
        pos = fb.position(r["t2"], a, b, c, d, P["branch"])
        frames.append({"t2": math.degrees(r["t2"]), "A": pos["A"] * 1e3, "B": pos["B"] * 1e3, "P": r["P"] * 1e3,
                       "t4": math.degrees(r["t4"]), "mu": r["mu"], "T": r["T12"], "w4": r["w4"], "al4": r["al4"],
                       "F12": abs(r["F12"]), "F32": abs(r["F32"]), "F43": abs(r["F43"]), "F14": abs(r["F14"]),
                       "shake": abs(r["shake"])})
    g = fb.grashof(*(P[k + "_mm"] for k in "abcd"))
    lp = fb.limit_positions(*(P[k + "_mm"] for k in "abcd")) if g["class"].startswith("Grashof crank-rocker") else None
    return {"params": P, "report": fb.report_text(P, rows), "grashof": g, "limits": lp,
            "summary": fb.summary(P, rows), "frames": frames, "assemblable": len(ok), "total": len(rows)}


def path(body):
    fb = _mod("fourbar")
    track = [tuple(map(float, t)) for t in body["track"]]
    if len(track) < 4:
        raise ValueError("give at least 4 track points (3 points: use the exact 3-point method)")
    timing = body.get("timing")
    if timing is not None:
        timing = [float(v) for v in timing]
        if len(timing) != len(track):
            raise ValueError("timing needs one crank angle per track point")
    gens = max(20, min(400, int(body.get("generations", 120))))
    res = fb.path_synthesis(track, timing, float(body.get("mu_min", 40.0)), gens=gens,
                            max_link_factor=float(body.get("max_link_factor", 2.5)))
    O2, O4 = res["O2"], res["O4"]
    frames = []
    for k in range(0, 360, 3):
        t2 = res["x"][6] + math.radians(k)
        q = fb.position_general(O2, O4, res["a"], res["b"], res["c"], t2, res["branch"])
        if q:
            Pp = q["A"] + res["coupler_point"] * (q["B"] - q["A"]) / res["b"]
            frames.append({"A": q["A"], "B": q["B"], "P": Pp})
    out = {k: v for k, v in res.items() if k not in ("x",)}
    out.update({"frames": frames, "report": fb.path_report(res, track), "track": track})
    return out


def path3(body):
    fb = _mod("fourbar")
    pts = [tuple(map(float, t)) for t in body["points"]][:3]
    betas = [float(v) for v in body.get("betas", [60, 120])][:2]
    best, n = fb.path_3pt_search(pts, betas, alpha_range=(-60, 61, 10), gamma_step=10,
                                 mu_min=float(body.get("mu_min", 40)))
    if not best:
        return {"found": 0, "message": "no valid crank-rocker for these points / timing - change the timing or the points"}
    frames = []
    t21 = math.radians(best["t2_1_deg"])
    for k in range(0, 360, 3):
        q = fb.position_general(best["O2"], best["O4"], best["a"], best["b"], best["c"], t21 + math.radians(k), best["branch"])
        if q:
            frames.append({"A": q["A"], "B": q["B"], "P": q["A"] + best["kP"] * (q["B"] - q["A"])})
    best = dict(best)
    best.update({"found": n, "frames": frames, "points": pts})
    return best


# ---------------------------------------------------------------- M3 shaft
def shaft(body):
    sh = _mod("shaft")
    if body.get("handover"):
        return {"handover": sh.loads_from_crank()}
    P = _merge(sh.DEFAULT, body.get("params"))
    if P["material"] not in sh.MATERIALS:
        raise ValueError("unknown material " + str(P["material"]))
    ds, xs, vr, tr = sh.deflection_summary(P)
    step = max(1, len(xs) // 300)
    xs_s = xs[::step]
    diag = {"x": xs_s, "D": [sh.geometry_at(P, x)[0] for x in xs_s], "My": [], "Mz": [], "M": [], "T": [],
            "v_um": [v * 1000 for v in vr[::step]], "slope": tr[::step]}
    for x in xs_s:
        it = sh.internal(P, x)
        for k in ("My", "Mz", "M", "T"):
            diag[k].append(it[k] / 1000)
    R = sh.reactions(P)
    return {"params": P, "report": sh.report_text(P), "reactions": R, "deflection": ds,
            "critical": sh.critical_speed(P), "torsion": sh.torsion_angle(P), "strength": sh.strength(P),
            "key": sh.key_check(P["key"]), "pressfit": sh.press_fit_design(P["pressfit"], P["T_max_Nm"] * P["load_factor_static"]),
            "diagram": diag}


# ---------------------------------------------------------------- dispatcher
def handle(method, p, q, body):
    """Returns (status, object or text, content type)."""
    sub = p[len("/api/mpc"):].strip("/")
    try:
        if method == "GET":
            if sub in ("", "catalog"):
                return 200, _js(catalog()), "json"
            if sub == "guide":
                return 200, guide(q.get("id", ["M1"])[0]), "text/markdown; charset=utf-8"
            if sub == "selftest":
                return 200, selftest(), "json"
        else:
            fn = {"dm": dm, "crank": crank, "fourbar": fourbar, "path": path, "path3": path3, "shaft": shaft}.get(sub)
            if fn:
                return 200, _js(fn(body or {})), "json"
        return 404, {"error": "not found: " + p}, "json"
    except KeyError as e:
        return 400, {"error": "missing or unknown key: %s" % e}, "json"
    except (ValueError, TypeError, ZeroDivisionError) as e:
        return 400, {"error": str(e)}, "json"
