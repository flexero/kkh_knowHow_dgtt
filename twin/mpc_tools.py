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
POST /api/mpc/bearing   {"params": {...}}  rolling bearings: loads over a revolution (M2 -> M3), L10, L_nm, kappa, s0,
                        clearance, candidates (M4)
POST /api/mpc/gear      {"params": {...}}  gear pair: geometry, forces, ISO 6336 style capacity, W_k, pins, backlash (M5)
POST /api/mpc/bevel     {"params": {...}}  bevel pair: cone geometry, virtual gears, forces, ISO 10300 style capacity, blank data (M5b)
POST /api/mpc/worm      {"params": {...}}  worm drive: geometry, efficiency, self-locking, heat balance, ISO/TS 14521 style capacity (M5c)
POST /api/mpc/gearmfg   {"params": {...}}  gear manufacturing: hobbing / shaping / skiving, case depth, grinding, chains + cost (M5d)
POST /api/mpc/cam       {"params": {...}}  disc cam: motion laws, profile, pressure angle, curvature, dynamics + lift-off, Hertz (M6)
POST /api/mpc/bolt      {"params": {...}}  bolted joint VDI 2230 style R0-R13: stiffness, preload, torque, fatigue, slip (M7)
POST /api/mpc/spring    {"params": {...}}  helical compression spring EN 13906 style: rate, stress, buckling, surge, fatigue, design (M8)
POST /api/mpc/drive     {"params": {...}}  V-belt / synchronous belt / roller chain / elastic coupling drive design and comparison (M9)
POST /api/mpc/tol       {"params": {...}, "fit": {"D", "hole", "shaft"}}  ISO 286 fits, press fit, stack-up, position (M10)
POST /api/mpc/weldvessel {"weld": {...}, "vessel": {...}}  weld group, fatigue, air receiver (M11)
POST /api/mpc/optflow   {"params": {...}}  optimisation workflow: virtual CAE, LHS, Kriging, EGO (M12)
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
          "M3": ("03_shaft_design.md", "M3 Shaft design"),
          "M4": ("04_rolling_bearings.md", "M4 Rolling bearings"),
          "M5": ("05_gear_design.md", "M5 Gear design"),
          "M5b": ("05b_bevel_gears.md", "M5b Bevel gears"),
          "M5c": ("05c_worm_gears.md", "M5c Worm gears"),
          "M5d": ("05d_gear_manufacturing.md", "M5d Gear manufacturing"),
          "M6": ("06_cam_design.md", "M6 Cam design"),
          "M7": ("07_bolted_joints.md", "M7 Bolted joints"),
          "M8": ("08_springs.md", "M8 Springs"),
          "M9": ("09_belts_chains_couplings.md", "M9 Belts, chains, couplings"),
          "M10": ("10_tolerances_fits.md", "M10 Tolerances, fits, stack-up"),
          "M11": ("11_welds_frames_vessels.md", "M11 Welds, frames, pressure parts"),
          "M12": ("12_optimisation_workflows.md", "M12 Optimisation workflows")}
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
    cr, fb, sh, br, gr, bv = _mod("crank"), _mod("fourbar"), _mod("shaft"), _mod("bearing"), _mod("gear"), _mod("bevel")
    wm = _mod("worm")
    gm = _mod("gearmfg")
    cm = _mod("cam")
    bt = _mod("bolt")
    sp = _mod("spring")
    dr = _mod("drive")
    tl = _mod("tol")
    wd, vs = _mod("weld"), _mod("vessel")
    of = _mod("optflow")
    return {"folder": os.path.basename(FOLDER),
            "items": [
                {"id": "1", "title": "M1 Design method – calculators", "guide": "M1"},
                {"id": "2", "title": "M2 Crank mechanism (V-twin compressor)", "guide": "M2"},
                {"id": "3", "title": "M2b Four-bar linkage – analysis + animation", "guide": "M2b"},
                {"id": "4", "title": "M2b Path generation – required track → linkage", "guide": "M2b"},
                {"id": "6", "title": "M3 Shaft design", "guide": "M3"},
                {"id": "7", "title": "M4 Rolling bearings", "guide": "M4"},
                {"id": "8", "title": "M5 Gear design", "guide": "M5"},
                {"id": "9", "title": "M5b Bevel gears", "guide": "M5b"},
                {"id": "10", "title": "M5c Worm gears", "guide": "M5c"},
                {"id": "11", "title": "M5d Gear manufacturing", "guide": "M5d"},
                {"id": "12", "title": "M6 Cam design", "guide": "M6"},
                {"id": "13", "title": "M7 Bolted joints", "guide": "M7"},
                {"id": "14", "title": "M8 Springs", "guide": "M8"},
                {"id": "15", "title": "M9 Belts, chains, couplings", "guide": "M9"},
                {"id": "16", "title": "M10 Tolerances, fits, stack-up", "guide": "M10"},
                {"id": "17", "title": "M11 Welds, frames, pressure parts", "guide": "M11"},
                {"id": "18", "title": "M12 Optimisation workflows", "guide": "M12"},
                {"id": "5", "title": "Guides + self-test", "guide": None}],
            "crank_default": cr.DEFAULT, "fourbar_default": fb.DEFAULT, "path_example": fb.PATH_EXAMPLE,
            "shaft_default": sh.DEFAULT, "shaft_materials": sorted(sh.MATERIALS),
            "bearing_default": br.DEFAULT, "bearing_catalogue": br.CATALOGUE, "bearing_cleanliness": list(br.EC),
            "gear_default": gr.DEFAULT, "gear_materials": list(gr.MATERIALS),
            "bevel_default": bv.DEFAULT,
            "worm_default": wm.DEFAULT, "worm_materials": list(wm.WHEEL_MATERIALS),
            "gearmfg_default": gm.DEFAULT,
            "cam_default": cm.DEFAULT, "cam_laws": list(cm.LAWS),
            "bolt_default": bt.DEFAULT, "bolt_options": {"threads": list(bt.THREADS), "classes": list(bt.CLASSES),
                "materials": list(bt.PART_MATERIALS), "tightening": list(bt.TIGHTENING), "Rz": list(bt.FZ_TABLE)},
            "spring_default": sp.DEFAULT, "spring_options": {"materials": list(sp.MATERIALS), "seating": list(sp.SEATING)},
            "drive_default": dr.DEFAULT, "drive_options": {"load_class": list(dr.LOAD_CLASS), "vb_section": list(dr.VBELT), "sy_profile": list(dr.SYNC),
                "ch_chain": list(dr.CHAINS), "cp_spider": list(dr.SPIDER)},
            "tol_default": tl.DEFAULT, "optflow_default": of.DEFAULT,
            "weld_default": wd.DEFAULT, "vessel_default": vs.DEFAULT, "weld_options": {"steels": list(wd.STEELS), "fat": list(wd.FAT),
                "vmat": list(vs.VMAT), "joint": list(vs.JOINT_Z), "heads": list(vs.HEADS)},
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


# ---------------------------------------------------------------- M4 rolling bearings
def bearing(body):
    br = _mod("bearing")
    P = _merge(br.DEFAULT, body.get("params"))
    for k in ("bearing_A", "bearing_B"):
        if P[k] not in br.CATALOGUE:
            raise ValueError("unknown bearing " + str(P[k]))
    if P["cleanliness"] not in br.EC:
        raise ValueError("unknown cleanliness class")
    res = br.analyse(P)
    out = {"params": P, "report": br.report_text(P, res)}
    for side in ("A", "B"):
        r = dict(res[side])
        r.pop("b", None)
        out[side] = r
        out["cand_" + side] = br.select(r["Fr_eq"], r["Fa"], P["rpm"], P, d=br.CATALOGUE[P["bearing_" + side]]["d"])
    if P["use_crank_loads"]:
        out["theta"], out["FA"], out["FB"] = res["theta"], res["FA"], res["FB"]
    temps = list(range(30, 121, 5))
    bA = br.CATALOGUE[P["bearing_A"]]
    out["visc"] = {"T": temps, "nu": [br.nu_from_VG(P["oil_VG"], t) for t in temps],
                   "nu1": br.nu1_rated(P["rpm"], (bA["d"] + bA["D"]) / 2)}
    return out


# ---------------------------------------------------------------- M5 gears
def gear(body):
    gr = _mod("gear")
    P = _merge(gr.DEFAULT, body.get("params"))
    for k in ("material1", "material2"):
        if P[k] not in gr.MATERIALS:
            raise ValueError("unknown material " + str(P[k]))
    R = gr.capacity(P)
    g = R["g"]
    up, lo = P["tooth_thickness_allowance_um"]
    man = {}
    for i in (1, 2):
        w0 = gr.span_measurement(P, g, i)
        man[str(i)] = {"k": w0["k"], "Wk_nom": w0["Wk_nominal"], "Wk_up": gr.span_measurement(P, g, i, up)["Wk"],
                       "Wk_lo": gr.span_measurement(P, g, i, lo)["Wk"], "pins": gr.over_pins(P, g, i, P.get("pin_diameter_mm"))}
    sweep = {"x1": [], "SH": [], "SF1": [], "SF2": [], "ea": [], "sa1": []}
    for k in range(19):
        x = round(-0.4 + 0.05 * k, 2)
        try:
            Rx = gr.capacity(dict(P, x1=x))
        except (ValueError, ZeroDivisionError):
            continue
        sweep["x1"].append(x)
        sweep["SH"].append(Rx["gear1"]["SH"])
        sweep["SF1"].append(Rx["gear1"]["SF"])
        sweep["SF2"].append(Rx["gear2"]["SF"])
        sweep["ea"].append(Rx["g"]["ea"])
        sweep["sa1"].append(Rx["g"]["sa1"] / P["mn"])
    inv1 = gr.involute_points(g["db1"] / 2, g["da1"] / 2)
    inv2 = gr.involute_points(g["db2"] / 2, g["da2"] / 2)
    return {"params": P, "report": gr.report_text(P), "geometry": g, "forces": R["F"],
            "factors": {k: R[k] for k in ("KV", "KFbeta", "K_H", "K_F", "ZH", "ZE", "Zeps", "Zbeta", "Ybeta", "sH0", "sH")},
            "gear1": R["gear1"], "gear2": R["gear2"], "manufacturing": man, "backlash": gr.backlash(P, g),
            "sweep_x1": sweep, "involute": {"1": inv1, "2": inv2}}


# ---------------------------------------------------------------- M5b bevel gears
def bevel(body):
    bv, gr = _mod("bevel"), _mod("gear")
    P = _merge(bv.DEFAULT, body.get("params"))
    for k in ("material1", "material2"):
        if P[k] not in gr.MATERIALS:
            raise ValueError("unknown material " + str(P[k]))
    R = bv.capacity(P)
    g = R["g"]
    return {"params": P, "report": bv.report_text(P), "geometry": g, "forces": R["F"],
            "KV": R["KV"], "KHbeta": R["KHbeta"], "ZH": R["ZH"], "Zeps": R["Zeps"], "Zbeta": R["Zbeta"], "sH": R["sH"],
            "gear1": R["gear1"], "gear2": R["gear2"], "cutter": bv.cutter_data(P, g),
            "chordal": {"1": bv.chordal_thickness(P, g, 1), "2": bv.chordal_thickness(P, g, 2)}}


# ---------------------------------------------------------------- M5c worm gears
def worm(body):
    wm = _mod("worm")
    P = _merge(wm.DEFAULT, body.get("params"))
    if P["wheel_material"] not in wm.WHEEL_MATERIALS:
        raise ValueError("unknown wheel material " + str(P["wheel_material"]))
    if P["lubricant"] not in ("mineral", "polyglycol"):
        raise ValueError("lubricant must be mineral or polyglycol")
    R = wm.capacity(P)
    g = R["g"]
    Pmax = max(2.0 * P["P1_kW"], 1.5 * wm.thermal_power_limit(P))
    curve_P = [[x, wm.losses(dict(P, P1_kW=x))["theta_S"]] for x in [Pmax * k / 20 for k in range(1, 21)]]
    curve_n = []
    for n in (50, 100, 200, 400, 700, 1000, 1450, 2000, 3000):
        Q = dict(P, n1_rpm=float(n))
        e = wm.efficiency(Q)
        curve_n.append([n, wm.geometry(Q)["vg"], e["eta_z"], e["eta_rev"]])
    starts = []
    for z1 in (1, 2, 3, 4):
        Q = dict(P, z1=z1)
        gq, e = wm.geometry(Q), wm.efficiency(Q)
        starts.append({"z1": z1, "i": gq["u"], "gamma_deg": gq["gamma_deg"], "eta": e["eta_z"], "eta_rev": e["eta_rev"],
                       "sl_static": e["self_locking_static"], "sl_dyn": e["self_locking_dynamic"]})
    out = {k: v for k, v in R.items() if k not in ("g", "e", "F", "L")}
    out.update({"params": P, "report": wm.report_text(P), "geometry": g, "eff": R["e"], "forces": R["F"], "losses": R["L"],
                "P_thermal": wm.thermal_power_limit(P), "wires": wm.over_wires(P, g), "curve_P": curve_P,
                "curve_n": curve_n, "starts": starts})
    return out


# ---------------------------------------------------------------- M5d gear manufacturing
def gearmfg(body):
    gm = _mod("gearmfg")
    P = _merge(gm.DEFAULT, body.get("params"))
    for k in ("hand", "hob_hand"):
        if P[k] not in ("right", "left"):
            raise ValueError(k + " must be right or left")
    w = gm.work_geometry(P)
    c = gm.chd_plan(P)
    curve_fa = [[fa, gm.hob_time(dict(P, hob_fa=fa), w)["t_cut_min"], 1000 * gm.feed_mark_depth(fa, P["hob_da0"], P["alpha_n_deg"])]
                for fa in (0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0)]
    curve_carb = [[t, gm.harris_total_case(t, P["T_carb_C"]), P["case_ratio"] * gm.harris_total_case(t, P["T_carb_C"])]
                  for t in [0.25 * k for k in range(1, 33)]]
    return {"params": P, "report": gm.report_text(P), "work": w, "hob_setup": gm.hob_setup(P, w), "hob_time": gm.hob_time(P, w),
            "feed_mark": gm.feed_mark_depth(P["hob_fa"], P["hob_da0"], P["alpha_n_deg"]), "envelope": gm.envelope_depth(P),
            "hmax": gm.hoffmeister_hmax(P, w), "hob_cost": gm.hob_tool_cost_per_part(P), "shaping": gm.shaping_time(P, w),
            "skiving": gm.skiving(P, w), "chd": c, "carb_h": gm.carburising_time(c["CHD_green"], P["T_carb_C"], P["case_ratio"]),
            "gen_grinding": gm.gen_grinding_time(P), "prof_grinding": gm.prof_grinding_time(P), "tol": gm.tolerances(P),
            "chains": gm.chain_options(P), "curve_fa": curve_fa, "curve_carb": curve_carb,
            "ind10": gm.induction_depth(1e4), "ind100": gm.induction_depth(1e5)}


# ---------------------------------------------------------------- M6 cams
def cam(body):
    cm = _mod("cam")
    P = _merge(cm.DEFAULT, body.get("params"))
    for sg in P["segments"]:
        if sg.get("kind") not in ("rise", "dwell", "return"):
            raise ValueError("segment kind must be rise, dwell or return")
        if sg["kind"] != "dwell" and sg.get("law") not in cm.LAWS:
            raise ValueError("law must be one of " + ", ".join(cm.LAWS))
    P["step_deg"] = max(float(P["step_deg"]), 0.25)
    pts = cm.sweep(P)
    dyn = cm.dynamics(P, pts)
    ct = cm.contact(P, pts, dyn)
    g = cm.geometry_summary(P, pts)
    st = max(1, int(round(2.0 / P["step_deg"])))
    ser = [{"th": p["theta"], "s": p["s"], "v": d["v"], "a": d["a"], "Fc": d["Fc"], "Fn": d["Fn"], "T": d["T"],
            "phi": p["phi_deg"], "p": c["p_max"], "px": p["profile"][0], "py": p["profile"][1],
            "qx": p["pitch"][0], "qy": p["pitch"][1]}
           for p, d, c in list(zip(pts, dyn, ct["series"]))[::st]]
    laws = {l: cm.characteristic_values(l) for l in cm.LAWS}
    tc = cm.tool_path(P, P["rc"], pts)
    tg = cm.tool_path(P, P["rg"], pts)
    return {"params": P, "report": cm.report_text(P), "geometry": g, "jump": cm.jump_check(P, dyn),
            "contact": {k: v for k, v in ct.items() if k != "series"}, "series": ser, "laws": laws,
            "R0_min": cm.size_base_circle(P), "gouge_cutter": tc["gouge"], "gouge_wheel": tg["gouge"],
            "Fn_max": max(d["Fn"] for d in dyn), "T_min": min(d["T"] for d in dyn), "T_max": max(d["T"] for d in dyn)}


# ---------------------------------------------------------------- M7 bolted joints
def bolt(body):
    bt = _mod("bolt")
    P = _merge(bt.DEFAULT, body.get("params"))
    for k, tab in (("thread", bt.THREADS), ("cls", bt.CLASSES), ("part_material", bt.PART_MATERIALS),
                   ("nut_side_material", bt.PART_MATERIALS), ("tightening", bt.TIGHTENING), ("Rz", bt.FZ_TABLE)):
        if P[k] not in tab:
            raise ValueError("unknown %s %s" % (k, P[k]))
    if P["joint"] not in ("DSV", "ESV") or P["rolled"] not in ("before", "after"):
        raise ValueError("joint must be DSV / ESV and rolled before / after")
    if P["DA"] <= bt.THREADS[P["thread"]]["dh"]:
        raise ValueError("D_A must be larger than the hole diameter")
    S = bt.summary(P)
    lf, t, ws = S["lf"], S["tight"], S["ws"]
    # joint diagram: bolt and plate lines through the preload point (assembly preload F_Mzul / alpha_A ... F_Mzul)
    dS, dP = S["bolt"]["deltaS"], S["plate"]["deltaP"]
    FV = t["FMzul"] / t["alpha_A"] - S["emb"]["FZ"]          # lowest residual preload after embedding
    fS, fP = FV * dS * 1000, FV * dP * 1000                    # um
    diagram = {"bolt": [[0, 0], [fS, FV], [fS + 0.6 * fS, FV * 1.6]],
               "plate": [[fS, FV], [fS + fP, 0]], "FV": FV, "fS": fS, "fP": fP,
               "FSA": lf["Phi_n"] * P["FA_max"], "FPA": (1 - lf["Phi_n"]) * P["FA_max"]}
    torque_table = []
    for th in ("M8", "M10", "M12", "M16", "M20", "M24"):
        row = {"thread": th}
        for cl in ("8.8", "10.9", "12.9"):
            tq = bt.tightening(dict(P, thread=th, cls=cl))
            row[cl] = [tq["FMzul"], tq["MA"]]
        torque_table.append(row)
    methods = []
    for m in bt.TIGHTENING:
        Sm = bt.summary(dict(P, tightening=m))
        methods.append({"method": m, "alpha_A": bt.TIGHTENING[m], "util": Sm["pre"]["utilisation"], "S_G": Sm["slip"]["S_G"],
                        "all_ok": all(Sm["ok"].values())})
    sel = bt.select_size(P)
    return {"params": P, "report": bt.report_text(P), "g": S["g"], "bolt": S["bolt"], "plate": S["plate"], "lf": lf,
            "emb": S["emb"], "req": S["req"], "tight": t, "pre": S["pre"], "ws": ws, "fat": S["fat"], "sp": S["sp"],
            "slip": S["slip"], "ok": S["ok"], "diagram": diagram, "torque_table": torque_table, "methods": methods,
            "select": sel}


# ---------------------------------------------------------------- M8 springs
def spring(body):
    sp = _mod("spring")
    P = _merge(sp.DEFAULT, body.get("params"))
    if P["material"] not in sp.MATERIALS:
        raise ValueError("unknown material " + str(P["material"]))
    if P["seating"] not in sp.SEATING:
        raise ValueError("unknown seating " + str(P["seating"]))
    if P["ends"] not in ("closed and ground", "closed not ground", "open"):
        raise ValueError("ends must be closed and ground / closed not ground / open")
    if not (P["L0"] > P["L1"] > P["L2"] > 0) or P["D"] <= P["d"]:
        raise ValueError("need L0 > L1 > L2 > 0 and D > d")
    S = sp.summary(P)
    F, g, ft = S["F"], S["g"], S["fat"]
    char = [[0.0, 0.0], [F["s1"], F["F1"]], [F["s2"], F["F2"]], [F["sc"], F["Fc"]]]
    Rm = sp.Rm_min(P)
    tst = 0.5 * Rm
    haigh = {"limit": [[0.0, ft["tau_D0"]], [tst, tst]], "static": [[0.0, tst], [tst, tst]], "diag": [[0.0, 0.0], [tst, tst]],
             "point": [ft["tau_kU"], ft["tau_kO"]]}
    dz = sp.design_from_requirements(P)
    return {"params": P, "report": sp.report_text(P), "geometry": g, "forces": F, "buck": S["buck"], "freq": S["freq"],
            "static": S["static"], "fat": ft, "ok": S["ok"], "Rm": Rm, "char": char, "haigh": haigh, "design": dz}


# ---------------------------------------------------------------- M9 belts, chains, couplings
def drive(body):
    dr = _mod("drive")
    P = _merge(dr.DEFAULT, body.get("params"))
    for k, opts in (("load_class", dr.LOAD_CLASS), ("vb_section", dr.VBELT), ("sy_profile", dr.SYNC), ("ch_chain", dr.CHAINS), ("cp_spider", dr.SPIDER)):
        if P[k] not in opts:
            raise ValueError("unknown %s %s" % (k, P[k]))
    for k in ("sy_z1", "sy_z2", "ch_z1", "ch_z2", "ch_strands"):
        P[k] = int(P[k])
    if P["ch_strands"] not in dr.STRAND_FACTOR:
        raise ValueError("ch_strands must be 1 ... 4")
    if not (P["P_kW"] > 0 and P["n1"] > P["n2"] > 0 and P["a_target"] > 0 and P["vb_d1"] > 0):
        raise ValueError("need P_kW > 0, n1 > n2 > 0 (reduction drive), a_target > 0, vb_d1 > 0")
    if P["sy_z2"] <= P["sy_z1"] or P["ch_z2"] <= P["ch_z1"]:
        raise ValueError("need z2 > z1 for the synchronous belt and the chain")
    S = dr.summary(P)
    V, K, Cp = S["vbelt"], S["chain"], S["coupling"]
    # rating curves of the selected V-belt section at d1 and two neighbouring pulleys
    ds = [d for d in dr.D_SERIES if dr.VBELT[V["section"]]["d_min"] <= d]
    i = min(range(len(ds)), key=lambda j: abs(ds[j] - V["d1"]))
    ns = [100.0 * k for k in range(1, int(max(P["n1"] * 1.4, 1000) / 100) + 1)]
    vb_curves = [{"d": ds[j], "n": ns, "P": [dr.vb_rated(V["section"], ds[j], n)["P_kW"] for n in ns]}
                 for j in sorted({max(0, i - 2), i, min(len(ds) - 1, i + 2)})]
    # chain rating lines (one strand) and requirement
    cap = 3 * K["P_req"] / dr.STRAND_FACTOR[K["strands"]]
    cr = [dr.chain_rating(K["chain"], K["z1"], n) for n in ns]
    ch_curves = {"n": ns, "H1": [min(c["H1_kW"], cap) for c in cr], "H2": [min(c["H2_kW"], cap) for c in cr]}
    # coupling magnification curve of the selected (or largest) size
    b = Cp["best"] or Cp["rows"][-1]
    fs = [b["f_e"] * 0.02 * k for k in range(1, 101)]
    cp_curve = {"f": fs, "V": [min(dr.magnification(f / b["f_e"], b["psi"]), 10.0) for f in fs]}
    return {"params": P, "report": dr.report_text(P), "vbelt": V, "sync": S["sync"], "chain": K, "coupling": Cp,
            "compare": S["compare"], "vb_table": S["vb_table"], "vb_curves": vb_curves, "ch_curves": ch_curves, "cp_curve": cp_curve,
            "cp_sel": b}


# ---------------------------------------------------------------- M10 tolerances, fits, stack-up
def tol(body):
    tl = _mod("tol")
    P = _merge(tl.DEFAULT, body.get("params"))
    calc = body.get("fit") or {"D": 25.0, "hole": "H7", "shaft": "g6"}
    D = float(calc["D"])
    F = tl.fit(D, str(calc["hole"]).strip(), str(calc["shaft"]).strip())
    if not P["fits"] or not P["stack"]["items"]:
        raise ValueError("need at least one fit and one stack item")
    P["mc_n"] = int(min(max(P["mc_n"], 1000), 200000))
    S = tl.summary(P)
    st = P["stack"]
    rnd = tl.random.Random(P["mc_seed"])
    G = [sum(sg * rnd.gauss(x, t / 3) for _, sg, x, t in st["items"]) for _ in range(20000)]
    lo, hi = min(G + [st["LSL"]]), max(G + [st["USL"]])
    nb = 40
    w = (hi - lo) / nb
    cnt = [0] * nb
    for g in G:
        cnt[min(nb - 1, int((g - lo) / w))] += 1
    hist = {"x": [lo + (i + 0.5) * w for i in range(nb)], "n": cnt}
    return {"params": P, "report": tl.report_text(P), "fit": F, "fits": S["fits"], "press": S["press"], "stack": S["stack"],
            "gdt": S["gdt"], "hist": hist, "finder": tl.fit_finder(D, F["C_min"], F["C_max"])[:8]}


# ---------------------------------------------------------------- M11 welds, frames, pressure parts
def _finite(o):
    """JSON has no Infinity / NaN: infinite fatigue lives -> None (shown as infinity in the web page)."""
    if isinstance(o, float) and (math.isinf(o) or math.isnan(o)):
        return None
    if isinstance(o, dict):
        return {k: _finite(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_finite(v) for v in o]
    return o


def weldvessel(body):
    wd, vs = _mod("weld"), _mod("vessel")
    W = _merge(wd.DEFAULT, body.get("weld"))
    V = _merge(vs.DEFAULT, body.get("vessel"))
    if W["steel"] not in wd.STEELS:
        raise ValueError("unknown steel " + str(W["steel"]))
    for k in ("fat_toe", "fat_throat", "fat_shear"):
        if W[k] not in wd.FAT:
            raise ValueError("unknown detail category " + str(W[k]))
    if not W["lines"] or W["a"] <= 0:
        raise ValueError("need at least one weld line and a > 0")
    for k, opts in (("material", vs.VMAT), ("joint", vs.JOINT_Z), ("head", vs.HEADS)):
        if V[k] not in opts:
            raise ValueError("unknown %s %s" % (k, V[k]))
    if not (V["PS_bar"] > 0 and V["Di"] > 0 and V["p_off_bar"] > V["p_on_bar"]):
        raise ValueError("need PS > 0, Di > 0, p_off > p_on")
    SW, SV = wd.summary(W), vs.summary(V)
    g = SW["fatigue"]
    gam = W["gamma_Ff"] * W["gamma_Mf"]
    curves = []
    for key in ("fat_toe", "fat_throat", "fat_shear"):
        fat, m, kind = wd.FAT[W[key]]
        xs, ys = [], []
        for i in range(0, 61):
            N = 10 ** (4 + i * 0.11)
            # invert the S-N curve numerically: range with N cycles (cut-off drawn flat)
            lo, hi = 0.1, 2000.0
            for _ in range(60):
                mid = (lo * hi) ** 0.5
                if wd.sn_cycles(mid, fat, m, kind) > N:
                    lo = mid
                else:
                    hi = mid
            xs.append(4 + i * 0.11)
            ys.append(round(math.log10(hi), 4))
        curves.append({"name": W[key], "x": xs, "y": ys})
    pts = []
    for b in g["blocks"]:
        for key, rng in (("toe", b["ds_toe"]), ("throat", b["ds_w"]), ("shear", b["dt_w"])):
            if rng > 0:
                pts.append({"block": b["name"], "detail": key, "logN": math.log10(b["n"]), "logS": math.log10(gam * rng)})
    heads = []
    for h in vs.HEADS:
        D = vs.design(dict(V, head=h))
        heads.append({"head": h, "e": D["e_head"], "t": D["t_head"], "depth": D["h_head"], "V_head": D["V_head"], "L_total": D["L_total"], "m_kg": D["m_kg"]})
    return _finite({"weld_params": W, "vessel_params": V, "weld_report": wd.report_text(W), "vessel_report": vs.report_text(V),
            "fillet": SW["fillet"], "member": SW["member"], "fatigue": g, "curves": curves, "fat_points": pts,
            "vessel": SV, "heads": heads})


# ---------------------------------------------------------------- M12 optimisation workflows
def optflow(body):
    of = _mod("optflow")
    P = _merge(of.DEFAULT, body.get("params"))
    if len(P["vars"]) != 3 or len(P["x0"]) != 3:
        raise ValueError("the web form solves the 3-variable frame problem (h, a, k)")
    if any(not (v[1] < v[2]) for v in P["vars"]):
        raise ValueError("each variable needs lower < upper")
    P["doe_n"] = int(min(max(P["doe_n"], 6), 40))
    P["ego_iter"] = int(min(max(P["ego_iter"], 0), 15))
    P["n_el"] = int(min(max(P["n_el"], 4), 32))
    R0 = of.responses(P, P["x0"])
    wf = of.Workflow(P)
    E = of.ego(P, wf)
    pts = [{"x": x, "R": R, "feasible": of.feasible(P, R), "doe": i < P["doe_n"]} for i, (x, R) in enumerate(zip(E["X"], E["R"])) if R]
    # 1-D cut through the optimum: mass and first bending frequency over h (true solver, 15 points)
    best = E["best"][0] if E["best"] else P["x0"]
    lo, hi = P["vars"][0][1], P["vars"][0][2]
    hs = [lo + (hi - lo) * i / 14 for i in range(15)]
    cut = [dict(h=h, **{k: v for k, v in of.responses(P, [h, best[1], best[2]]).items() if k != "f"}) for h in hs]
    return {"params": P, "x0": P["x0"], "R0": R0, "g0": of.constraints(P, R0), "hist": E["hist"], "best": E["best"],
            "calls": E["calls"], "points": pts, "cut": cut, "report": of.report_text(P, {"x0": P["x0"], "R0": R0, "g0": of.constraints(P, R0), "ego": E, "direct": None})}


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
            fn = {"dm": dm, "crank": crank, "fourbar": fourbar, "path": path, "path3": path3, "shaft": shaft, "bearing": bearing, "gear": gear, "bevel": bevel, "worm": worm, "gearmfg": gearmfg, "cam": cam, "bolt": bolt, "spring": spring, "drive": drive, "tol": tol, "weldvessel": weldvessel, "optflow": optflow}.get(sub)
            if fn:
                return 200, _js(fn(body or {})), "json"
        return 404, {"error": "not found: " + p}, "json"
    except KeyError as e:
        return 400, {"error": "missing or unknown key: %s" % e}, "json"
    except (ValueError, TypeError, ZeroDivisionError) as e:
        return 400, {"error": str(e)}, "json"
