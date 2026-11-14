#!/usr/bin/env python3
"""Process selection from tolerance and surface: which process reaches IT grade and Ra?

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item2_examples.json.

1. Required IT grade (ISO 286-1 table it_table_um in the JSON):
       size range: lower < D <= upper  (D <= 3 -> first range)
       required grade g = largest grade k with IT_k <= tolerance width
2. Process capability (table PROC, same rows as the web page web/fmse2_data.js):
       capable     if IT_best <= g  and  Ra_best <= Ra_required
       economical  if capable and also IT_worst <= g and Ra_worst <= Ra_required
       (IT numbers are grades: a smaller number = a finer tolerance)
3. Cheapest capable final operation: machining processes that are not roughing, economical
   first, then by coarser best grade (a process that cannot go much finer is usually cheaper).
4. --chain: process chain of the JSON (bore, from the final size back to the raw part)
       T_i   = IT value of the grade of step i for the size D (in mm, on the diameter)
       z_i   = z_min_i + T_(i-1)/2     (per side; for step 1, T_0 = tolerance of the raw part)
       D_(i-1) = D_i - 2*z_i            (bore: material is removed, the diameter grows)
       start: D_n = mid-tolerance final diameter
5. --fit H7/g6 (optional): hole basis H with shaft f, g or h only (fundamental deviations
   of ISO 286-2 for 0 .. 500 mm that are checked in the self-test). Other letters are refused.
"""

import argparse
import json
import re

from fmse_common import (HERE, ITEM2_EXAMPLES, InputError, SelfTest, fmt_num, fmt_table, load_examples,
                         run_main)

# Copy of PROC in web/fmse2_data.js (the self-test checks that both are still equal).
# [process, domain, IT best, IT worst, Ra best, Ra worst, typical machine / note]
PROC = [
    ["Sand casting", "Primary", 14, 16, 12.5, 25, "Foundry – raw part, machining allowance 2–5 mm"],
    ["Die casting (Al, Zn)", "Primary", 11, 13, 0.8, 3.2, "Die casting cell – near net shape"],
    ["Forging (closed die)", "Primary", 13, 15, 3.2, 12.5, "Forging press – allowance 1–3 mm"],
    ["Injection moulding", "Primary", 10, 13, 0.2, 1.6, "Moulding machine – depends on mould and shrinkage"],
    ["Additive (metal LPBF)", "Primary", 11, 14, 6, 15, "LPBF machine – functional surfaces machined after"],
    ["Laser cutting (sheet)", "Sheet metal", 11, 13, 1.6, 12.5, "Fibre laser – tolerance grows with thickness"],
    ["Punching", "Sheet metal", 10, 12, 3.2, 12.5, "Turret punch – burr side"],
    ["Press-brake bending", "Sheet metal", 12, 14, 3.2, 12.5, "Press brake – angle ± 0.3–0.5°, flange ± 0.1–0.2 mm"],
    ["Rough turning", "Machining", 11, 13, 6.3, 12.5, "CNC lathe"],
    ["Finish turning", "Machining", 7, 9, 0.8, 3.2, "CNC lathe"],
    ["Hard turning (CBN)", "Machining", 6, 7, 0.2, 0.8, "Rigid CNC lathe – replaces some grinding"],
    ["Rough milling", "Machining", 11, 13, 6.3, 12.5, "HMC / VMC"],
    ["Finish milling", "Machining", 8, 9, 1.6, 3.2, "HMC / VMC"],
    ["Drilling", "Machining", 11, 13, 3.2, 6.3, "HMC / VMC / drill"],
    ["Reaming", "Machining", 7, 8, 0.8, 1.6, "HMC / VMC"],
    ["Fine boring", "Machining", 6, 7, 0.4, 1.6, "HMC / VMC with fine-boring head"],
    ["Broaching", "Machining", 7, 8, 0.8, 3.2, "Broaching machine – high volume only"],
    ["Cylindrical grinding", "Machining", 5, 6, 0.1, 0.8, "OD / ID grinder"],
    ["Surface grinding", "Machining", 5, 7, 0.2, 0.8, "Surface grinder"],
    ["Honing", "Machining", 4, 6, 0.05, 0.4, "Honing machine – bores, cylinders"],
    ["Lapping / superfinishing", "Machining", 3, 5, 0.012, 0.1, "Lapping / superfinish – seals, gauges"],
    ["Wire EDM", "Machining", 5, 7, 0.2, 1.6, "Wire EDM – hard materials, dies"],
]

# which finishing processes can make which feature (for --feature)
#   bore      = bore in a prismatic part (housing on a machining centre) - no turning / OD grinding
#   bore_rot  = bore in a rotational part (lathe / ID grinder)
#   shaft     = external cylinder;  face = flat face
FEATURE = {
    "bore": {"Reaming", "Fine boring", "Broaching", "Honing", "Lapping / superfinishing"},
    "bore_rot": {"Finish turning", "Hard turning (CBN)", "Reaming", "Fine boring", "Cylindrical grinding", "Honing",
                 "Lapping / superfinishing"},
    "shaft": {"Finish turning", "Hard turning (CBN)", "Cylindrical grinding", "Lapping / superfinishing"},
    "face": {"Finish turning", "Hard turning (CBN)", "Finish milling", "Broaching", "Surface grinding",
             "Lapping / superfinishing"},
}

# ISO 286-2 fundamental deviations of shafts f, g, h (upper deviation es, µm), same size ranges
# as it_table_um: 0-3, 3-6, 6-10, 10-18, 18-30, 30-50, 50-80, 80-120, 120-180, 180-250,
# 250-315, 315-400, 400-500. (Formula check: f = -5.5*D^0.41, g = -2.5*D^0.34, D = geometric
# mean of the range, rounded by the ISO rules.)
SHAFT_ES = {
    "f": [-6, -10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68],
    "g": [-2, -4, -5, -6, -7, -9, -10, -12, -14, -15, -17, -18, -20],
    "h": [0] * 13,
}

LABEL = {"econ": "economical", "cap": "capable (fine settings, check Cpk)", "no": "not capable"}


# ----------------------------------------------------------------------------- IT table
def range_index(table, D):
    """Index of the size range for nominal size D (lower < D <= upper; D <= 3 -> first)."""
    if D <= 0:
        raise InputError("nominal size D must be > 0")
    rngs = table["ranges_mm"]
    if D > rngs[-1][1]:
        raise InputError(f"D = {D} mm is above the table ({rngs[-1][1]} mm)")
    for k, (lo, hi) in enumerate(rngs):
        if (lo < D <= hi) or (k == 0 and D <= hi):
            return k
    raise InputError(f"no size range for D = {D}")


def it_value(table, grade, D):
    """IT value in µm of a grade for size D."""
    k = range_index(table, D)
    if grade not in table["grades"]:
        raise InputError(f"IT{grade} is not in the table (grades {table['grades'][0]}..{table['grades'][-1]})")
    return table["values"][k][table["grades"].index(grade)]


def required_grade(table, D, tol_um):
    """Largest grade with IT <= tolerance. Returns (grade or None, row of values, note)."""
    k = range_index(table, D)
    row = table["values"][k]
    g = None
    for grade, v in zip(table["grades"], row):
        if v <= tol_um + 1e-9:
            g = grade
    note = ""
    if g is None:
        note = (f"tolerance {tol_um} µm is finer than IT{table['grades'][0]} = {row[0]} µm - "
                f"grade IT{table['grades'][0]-1} or finer is used (check the standard)")
    elif g == table["grades"][-1]:
        note = f"IT{g} is the coarsest grade in the table - the tolerance may be even coarser"
    return g, row, note


# ----------------------------------------------------------------------------- capability
def classify(g, ra):
    """Verdict of every process for required grade g and Ra. Returns list of dicts."""
    out = []
    for p in PROC:
        name, dom, b, w, rb, rw, note = p
        cap = b <= g and rb <= ra + 1e-12
        econ = cap and w <= g and rw <= ra + 1e-12
        out.append({"name": name, "domain": dom, "it_best": b, "it_worst": w, "ra_best": rb,
                    "ra_worst": rw, "note": note, "st": "econ" if econ else "cap" if cap else "no"})
    return out


def final_ops(rows, feature=None):
    """Capable machining finishing operations, cheapest first.

    Rule: the least precise process that is still capable is normally the cheapest one, so sort by
    coarser IT best first, then coarser Ra best (stable: table order on ties). 'economical' / 'capable'
    is shown as information (economical = the requirement is inside the whole normal range)."""
    sel = [r for r in rows if r["st"] != "no" and r["domain"] == "Machining" and not r["name"].startswith("Rough")]
    if feature:
        sel = [r for r in sel if r["name"] in FEATURE[feature]]
    return sorted(sel, key=lambda r: (-r["it_best"], -r["ra_best"]))


# ----------------------------------------------------------------------------- chain
def process_chain(table, chain):
    """Allowance chain per formula. Returns list of step dicts (index 1..n) and summary."""
    D_fin = chain["final_D"]
    steps = chain["steps"]
    T = [chain["raw_tol_mm"]] + [it_value(table, s[1], D_fin) / 1000.0 for s in steps]
    n = len(steps)
    z = [None] + [steps[i - 1][2] + T[i - 1] / 2 for i in range(1, n + 1)]
    D = [None] * (n + 1)
    D[n] = D_fin
    for i in range(n, 0, -1):
        D[i - 1] = D[i] - 2 * z[i]
    out = []
    for i in range(1, n + 1):
        name, it, zmin, ra = steps[i - 1]
        out.append({"i": i, "name": name, "it": it, "T": T[i], "T_prev": T[i - 1], "z_min": zmin,
                    "z": z[i], "D_before": D[i - 1], "D_after": D[i], "ra": ra})
    return out, {"raw_D": D[0], "final_D": D_fin, "z_total": sum(z[1:]), "removal_dia": D_fin - D[0]}


# ----------------------------------------------------------------------------- fit
def fit(table, D, spec):
    """Hole-basis fit like H7/g6. Returns dict with limits (µm) and clearances."""
    m = re.fullmatch(r"\s*H(\d+)\s*/\s*([a-z])(\d+)\s*", spec)
    if not m:
        raise InputError("--fit must look like H7/g6 (hole basis H, shaft letter, grade)")
    gh, letter, gs = int(m.group(1)), m.group(2), int(m.group(3))
    if letter not in SHAFT_ES:
        raise InputError(f"shaft letter '{letter}' not supported - only f, g, h are built in (verified values)")
    k = range_index(table, D)
    IT_h, IT_s = it_value(table, gh, D), it_value(table, gs, D)
    es = SHAFT_ES[letter][k]
    ei = es - IT_s
    return {"hole": (0, IT_h), "shaft": (ei, es), "c_min": 0 - es, "c_max": IT_h - ei,
            "IT_h": IT_h, "IT_s": IT_s, "letter": letter, "gh": gh, "gs": gs}


# ----------------------------------------------------------------------------- web data check
def read_web_proc():
    """PROC rows of web/fmse2_data.js, or None if the file is not there."""
    p = HERE.parent.parent / "web" / "fmse2_data.js"
    if not p.is_file():
        return None
    text = p.read_text(encoding="utf-8")
    m = re.search(r"export const PROC = \[(.*?)\n\];", text, re.S)
    if not m:
        return []
    rows = []
    for ln in m.group(1).splitlines():
        ln = ln.strip().rstrip(",")
        if ln.startswith("["):
            rows.append(json.loads(ln))
    return rows


# ----------------------------------------------------------------------------- report
def report_select(table, D, tol, ra, domain=None, feature=None):
    g, row, note = required_grade(table, D, tol)
    k = range_index(table, D)
    lo, hi = table["ranges_mm"][k]
    print(f"PROCESS SELECTION   D = {D:g} mm   tolerance width = {tol:g} µm   Ra <= {ra:g} µm")
    print(f"ISO 286-1 IT values for {lo} < D <= {hi} mm (µm): " +
          "  ".join(f"IT{gr}={v}" for gr, v in zip(table["grades"], row)))
    g_eff = g if g is not None else table["grades"][0] - 1
    if g is not None:
        nxt = table["grades"].index(g) + 1
        upper = f" < IT{table['grades'][nxt]} = {row[nxt]} µm" if nxt < len(row) else ""
        print(f"Required grade: IT{g}   (IT{g} = {row[table['grades'].index(g)]} µm <= {tol:g} µm{upper})")
    if note:
        print(f"Note: {note}")
    rows = classify(g_eff, ra)
    if domain:
        rows = [r for r in rows if r["domain"].lower() == domain.lower()]
    print()
    print("Rule: capable if IT_best <= required and Ra_best <= Ra; economical if also IT_worst <= required "
          "and Ra_worst <= Ra")
    print(fmt_table(["process", "domain", "IT best-worst", "Ra best-worst µm", "verdict", "typical machine / note"],
                    [[r["name"], r["domain"], f"IT{r['it_best']}-IT{r['it_worst']}", f"{r['ra_best']:g}-{r['ra_worst']:g}",
                      LABEL[r["st"]], r["note"]] for r in rows], "llllll"))
    fo = final_ops(classify(g_eff, ra), feature)
    print()
    if fo:
        print(f"Cheapest capable final operation{' for a ' + feature if feature else ''} "
              f"(least precise capable process first = usually cheapest):")
        for n, r in enumerate(fo, 1):
            print(f"  {n}. {r['name']} ({LABEL[r['st']]}, IT{r['it_best']}-IT{r['it_worst']}, Ra {r['ra_best']:g}-{r['ra_worst']:g})")
        print(f"Suggestion: raw part -> rough machining -> (semi-finish) -> {fo[0]['name']} as the LAST operation.")
        if not feature:
            print("Give the feature for a useful answer: --feature bore (housing) | bore_rot | shaft | face.")
    else:
        print("No capable machining finishing operation - check if the tolerance / Ra is really needed.")
    return g


def report_chain(table, chain):
    steps, s = process_chain(table, chain)
    print(f"PROCESS CHAIN: {chain.get('feature', '')}")
    print(f"Final diameter (mid tolerance) D = {s['final_D']:.3f} mm, raw-part tolerance T_0 = {chain['raw_tol_mm']} mm")
    print("z_i = z_min_i + T_(i-1)/2 (per side)   D_before = D_after - 2*z_i (bore)")
    print(fmt_table(["step", "process", "IT", "T_i mm", "T_(i-1) mm", "z_min mm", "z_i mm", "D before mm",
                     "D after mm", "Ra µm"],
                    [[x["i"], x["name"], x["it"], f"{x['T']:.3f}", f"{x['T_prev']:.3f}", f"{x['z_min']:.3f}",
                      f"{x['z']:.4f}", f"{x['D_before']:.3f}", f"{x['D_after']:.3f}", f"{x['ra']:g}"] for x in steps],
                    "rlrrrrrrrr"))
    print()
    for x in steps:
        print(f"  step {x['i']}: z = {x['z_min']:.3f} + {x['T_prev']:.3f}/2 = {x['z']:.4f} mm;  "
              f"D = {x['D_after']:.3f} - 2*{x['z']:.4f} = {x['D_before']:.3f} mm")
    print(f"Raw (cast) bore D_0 = {s['raw_D']:.3f} mm   total removal = {s['z_total']:.3f} mm per side "
          f"= {s['removal_dia']:.3f} mm on the diameter")
    return steps, s


def report_fit(table, D, spec):
    f = fit(table, D, spec)
    print(f"FIT {spec} at D = {D:g} mm (hole basis; shaft deviations of ISO 286-2, f/g/h only)")
    print(f"  hole  H{f['gh']}: EI = 0, ES = +{f['hole'][1]} µm  -> {D:.3f} / {D + f['hole'][1]/1000:.3f} mm")
    print(f"  shaft {f['letter']}{f['gs']}: es = {f['shaft'][1]} µm, ei = es - IT{f['gs']} = {f['shaft'][1]} - {f['IT_s']} "
          f"= {f['shaft'][0]} µm  -> {D + f['shaft'][0]/1000:.3f} / {D + f['shaft'][1]/1000:.3f} mm")
    print(f"  clearance min = EI - es = {f['c_min']} µm, max = ES - ei = {f['c_max']} µm "
          f"({'clearance fit' if f['c_min'] >= 0 else 'not a clearance fit'})")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("tolerance_process")
    data, table = load_examples(path, "it_table_um")
    t.equal("range index D = 52 (50-80)", range_index(table, 52), 6)
    t.equal("range index D = 50 (30-50, upper bound inclusive)", range_index(table, 50), 5)
    t.equal("range index D = 2 (first range)", range_index(table, 2), 0)
    g, row, _ = required_grade(table, 52, 30)
    t.equal("required grade D 52, 30 µm", g, 7)
    t.equal("required grade D 52, 29 µm", required_grade(table, 52, 29)[0], 6)
    t.equal("required grade D 52, 10 µm (finer than IT5)", required_grade(table, 52, 10)[0], None)
    rows = {r["name"]: r["st"] for r in classify(7, 0.8)}
    t.equal("Finish turning IT7/Ra0.8 capable", rows["Finish turning"], "cap")
    t.equal("Hard turning economical", rows["Hard turning (CBN)"], "econ")
    t.equal("Fine boring capable (Ra worst 1.6 > 0.8)", rows["Fine boring"], "cap")
    t.equal("Finish milling not capable (IT8)", rows["Finish milling"], "no")
    t.equal("Honing economical", rows["Honing"], "econ")
    n_econ = sum(1 for v in rows.values() if v == "econ")
    n_cap = sum(1 for v in rows.values() if v == "cap")
    t.equal("economical count", n_econ, 5)
    t.equal("capable (not economical) count", n_cap, 5)
    fo = [r["name"] for r in final_ops(classify(7, 0.8))]
    t.equal("cheapest final ops (first 3)", fo[:3], ["Finish turning", "Reaming", "Broaching"])
    fb = [r["name"] for r in final_ops(classify(7, 0.8), "bore")]
    t.equal("final ops for a housing bore IT7 Ra 0.8", fb, ["Reaming", "Broaching", "Fine boring", "Honing", "Lapping / superfinishing"])
    fs = [r["name"] for r in final_ops(classify(6, 0.4), "shaft")]
    t.equal("final ops for a shaft IT6 Ra 0.4", fs, ["Hard turning (CBN)", "Cylindrical grinding", "Lapping / superfinishing"])
    steps, s = process_chain(table, data["process_chain"])
    t.close("T rough IT11 = 0.190 mm", steps[0]["T"], 0.190, 1e-12)
    t.close("z1 = 0.30 + 2.0/2", steps[0]["z"], 1.30, 1e-12)
    t.close("z2 = 0.10 + 0.190/2", steps[1]["z"], 0.195, 1e-12)
    t.close("z3 = 0.05 + 0.074/2", steps[2]["z"], 0.087, 1e-12)
    t.close("D before fine boring", steps[2]["D_before"], 51.841, 1e-9)
    t.close("D before semi-finish", steps[1]["D_before"], 51.451, 1e-9)
    t.close("raw bore D0", s["raw_D"], 48.851, 1e-9)
    t.close("total removal per side", s["z_total"], 1.582, 1e-9)
    f = fit(table, 52, "H7/g6")
    t.equal("H7/g6 at 52: shaft limits µm", f["shaft"], (-29, -10))
    t.equal("H7/g6 at 52: clearance min/max", (f["c_min"], f["c_max"]), (10, 59))
    t.equal("f at 30-50 = -25 µm", SHAFT_ES["f"][5], -25)
    web = read_web_proc()
    if web is None:
        t.true("web/fmse2_data.js not found - PROC copy check skipped", True)
    else:
        t.equal("PROC copy equals web/fmse2_data.js", web, PROC)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/tolerance_process.py --D 52 --tol 30 --ra 0.8\n"
               "  python tools/fmse/tolerance_process.py --chain\n"
               "  python tools/fmse/tolerance_process.py --D 52 --fit H7/g6")
    ap.add_argument("--examples", default=str(ITEM2_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--D", type=float, default=52, help="nominal size [mm] (default 52)")
    ap.add_argument("--tol", type=float, default=30, help="tolerance width [µm] (default 30)")
    ap.add_argument("--ra", type=float, default=0.8, help="required roughness Ra [µm] (default 0.8)")
    ap.add_argument("--domain", choices=["Primary", "Machining", "Sheet metal"], help="show only one domain")
    ap.add_argument("--feature", choices=sorted(FEATURE), help="limit the final-operation suggestion to a feature")
    ap.add_argument("--chain", action="store_true", help="compute the process chain of the JSON (allowances)")
    ap.add_argument("--fit", help="hole-basis fit, e.g. H7/g6 (shaft letters f, g, h)")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    if a.tol <= 0 or a.ra <= 0:
        raise InputError("--tol and --ra must be > 0")
    data, table = load_examples(a.examples, "it_table_um")
    if a.fit:
        fit(table, a.D, a.fit)            # check the fit spec before printing anything
    report_select(table, a.D, a.tol, a.ra, a.domain, a.feature)
    if a.fit:
        print()
        report_fit(table, a.D, a.fit)
    if a.chain:
        if "process_chain" not in data:
            raise InputError("section 'process_chain' is missing in the JSON")
        print()
        report_chain(table, data["process_chain"])
    return 0


if __name__ == "__main__":
    run_main(main)
