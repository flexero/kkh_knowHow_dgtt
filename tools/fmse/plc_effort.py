#!/usr/bin/env python3
"""PLC software effort estimate (integrator quote): engineering hours from quantities x coefficients, plus test,
documentation, project management and contingency.

Python 3 standard library only, offline. Rule = "_rules.effort" in examples/item9_examples.json, applied EXACTLY.
For the kit case the quantities io_std, io_safe and fb_instances are COMPUTED from the item-8 library kit
(circuit_lib_core.library_kit: DI+DO+AI+AO and FDI+FDO) and from the code generator (st_codegen.kit_fb: FB instances
over the kit module instances); the other quantities come from 'kit_qty'. Guide 69 and the web page give the same
numbers.

  eng   = sum qty_i * coef_h_i            test = test_factor*eng      doc = doc_factor*eng
  pm    = pm_factor*(eng + test + doc)    subtotal = eng + test + doc + pm
  cont  = contingency_factor*subtotal     total = subtotal + cont (round 1) ; person-weeks = total/hours_per_week

Usage:
  python tools/fmse/plc_effort.py                         (= --kit: the FMS kit of the library)
  python tools/fmse/plc_effort.py --kit --md effort.md
  python tools/fmse/plc_effort.py --qty io_std=300,io_safe=40,fb_instances=120,seq_steps=200,alarms=600
  python tools/fmse/plc_effort.py --kit --qty hmi_screens=45 --factor contingency_factor=0.2
  python tools/fmse/plc_effort.py --json
  python tools/fmse/plc_effort.py --selftest
"""

import argparse
import json
from pathlib import Path

import circuit_lib_core as core
from fmse_common import InputError, SelfTest, fmt_table, load_json, run_main
from st_codegen import kit_fb

HERE = Path(__file__).resolve().parent
ITEM9_EXAMPLES = HERE / "examples" / "item9_examples.json"
FACTORS = ("test_factor", "doc_factor", "pm_factor", "contingency_factor", "hours_per_week")


def load_effort(path=None):
    D = load_json(path or ITEM9_EXAMPLES)
    if "effort" not in D or "codegen" not in D:
        raise InputError(f"{path or ITEM9_EXAMPLES}: sections 'effort' and 'codegen' are needed")
    E = D["effort"]
    for k in ("coef_h", "factors", "kit_qty"):
        if k not in E:
            raise InputError(f"effort: '{k}' is missing")
    for k in FACTORS:
        if k not in E["factors"]:
            raise InputError(f"effort factors: '{k}' is missing")
    return D


def kit_quantities(D, L):
    """Quantities of the kit case: computed io_std, io_safe, fb_instances + the given kit_qty."""
    T = core.library_kit(L)["totals"]["used"]
    _, fbk = kit_fb(L, D["codegen"]["fb_types"])
    q = {"io_std": T["DI"] + T["DO"] + T["AI"] + T["AO"], "io_safe": T["FDI"] + T["FDO"], "fb_instances": fbk}
    q.update(D["effort"]["kit_qty"])
    return q


def estimate(qty, coef, fa):
    for k, v in qty.items():
        if k not in coef:
            raise InputError(f"effort: no coefficient for quantity '{k}' ({', '.join(coef)})")
        if v < 0:
            raise InputError(f"effort: quantity '{k}' must be >= 0")
    if fa["hours_per_week"] <= 0:
        raise InputError("effort: hours_per_week must be > 0")
    lines = [(k, qty.get(k, 0), coef[k], qty.get(k, 0) * coef[k]) for k in coef]
    eng = sum(x[3] for x in lines)
    test = fa["test_factor"] * eng
    doc = fa["doc_factor"] * eng
    pm = fa["pm_factor"] * (eng + test + doc)
    sub = eng + test + doc + pm
    cont = fa["contingency_factor"] * sub
    tot = sub + cont
    return {"lines": lines, "qty": {k: qty.get(k, 0) for k in coef}, "eng": round(eng, 1), "test": round(test, 1),
            "doc": round(doc, 1), "pm": round(pm, 1), "sub": round(sub, 1), "cont": round(cont, 1),
            "total": round(tot, 1), "weeks": round(tot / fa["hours_per_week"], 1), "factors": dict(fa)}


def parse_pairs(text, name):
    out = {}
    for part in [p.strip() for p in str(text).split(",") if p.strip()]:
        if "=" not in part:
            raise InputError(f"--{name}: '{part}' must be NAME=VALUE")
        k, v = part.split("=", 1)
        try:
            out[k.strip()] = float(v) if "." in v else int(v)
        except ValueError:
            raise InputError(f"--{name}: value of '{k}' is not a number")
    return out


# ----------------------------------------------------------------------------- output
def g(x):
    return f"{x:g}"


def show(R, title, source):
    fa = R["factors"]
    print(title)
    print(fmt_table(["item", "quantity", "h per unit", "hours", "source"],
                    [[k, g(q), g(c), f"{h:.1f}", source.get(k, "")] for k, q, c, h in R["lines"]], "lrrrl"))
    print()
    print(fmt_table(["part", "rule", "hours"], [
        ["engineering", "sum qty*coef", f"{R['eng']:.1f}"],
        ["test (FAT/SAT prep, I/O check)", f"{g(fa['test_factor'])} x eng", f"{R['test']:.1f}"],
        ["documentation", f"{g(fa['doc_factor'])} x eng", f"{R['doc']:.1f}"],
        ["project management", f"{g(fa['pm_factor'])} x (eng + test + doc)", f"{R['pm']:.1f}"],
        ["subtotal", "", f"{R['sub']:.1f}"],
        ["contingency", f"{g(fa['contingency_factor'])} x subtotal", f"{R['cont']:.1f}"],
        ["TOTAL", "", f"{R['total']:.1f}"]], "llr"))
    print(f"  = {R['weeks']:.1f} person-weeks at {g(fa['hours_per_week'])} h/week")


def md(R, title):
    L = [f"# {title}", "", "| item | quantity | h per unit | hours |", "|---|---:|---:|---:|"]
    L += [f"| {k} | {g(q)} | {g(c)} | {h:.1f} |" for k, q, c, h in R["lines"]]
    L += ["", "| part | hours |", "|---|---:|"]
    L += [f"| {n} | {R[k]:.1f} |" for n, k in (("engineering", "eng"), ("test", "test"), ("documentation", "doc"),
                                                ("project management", "pm"), ("subtotal", "sub"),
                                                ("contingency", "cont"), ("**total**", "total"))]
    L += ["", f"Person-weeks: **{R['weeks']:.1f}**"]
    return "\n".join(L) + "\n"


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("plc_effort")
    D = load_effort(path)
    L = core.load_library()
    E = D["effort"]
    q = kit_quantities(D, L)
    t.equal("kit quantities computed: io_std 144 (DI 90 + DO 45 + AI 9 + AO 0), io_safe 66 (FDI 49 + FDO 17), "
            "fb_instances 95", (q["io_std"], q["io_safe"], q["fb_instances"]), (144, 66, 95))
    t.equal("kit quantities = reference", q, {"io_std": 144, "io_safe": 66, "fb_instances": 95, "seq_steps": 120,
                                              "safety_functions": 6, "interfaces": 22, "hmi_screens": 30,
                                              "alarms": 400, "recipes_params": 150})
    R = estimate(q, E["coef_h"], E["factors"])
    t.equal("eng 994.5, test 397.8, doc 149.2, pm 154.1, subtotal 1695.6, contingency 254.3",
            (R["eng"], R["test"], R["doc"], R["pm"], R["sub"], R["cont"]),
            (994.5, 397.8, 149.2, 154.1, 1695.6, 254.3))
    t.equal("total 1950.0 h", R["total"], 1950.0)
    t.equal("51.3 person-weeks (38 h/week)", R["weeks"], 51.3)
    t.close("by hand: eng = 144*0.5 + 66*1 + 95*1.5 + 120*1.5 + 6*8 + 22*8 + 30*6 + 400*0.25 + 150*0.2", R["eng"],
            72 + 66 + 142.5 + 180 + 48 + 176 + 180 + 100 + 30, 1e-9)
    R0 = estimate({}, E["coef_h"], E["factors"])
    t.equal("no quantities -> 0 h", R0["total"], 0.0)
    R2 = estimate({"io_std": 100}, E["coef_h"], E["factors"])
    t.close("own: 100 std IO = 50 h eng -> total 50*(1.55*1.1)*1.15 = 98.0", R2["total"], 98.0, 0.05)
    try:
        estimate({"robots": 3}, E["coef_h"], E["factors"])
        t.true("unknown quantity -> InputError", False)
    except InputError:
        t.true("unknown quantity -> InputError", True)
    t.equal("parse --qty", parse_pairs("io_std=10, alarms=2.5", "qty"), {"io_std": 10, "alarms": 2.5})
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM9_EXAMPLES), help="item-9 JSON (default: %(default)s)")
    ap.add_argument("--library", default=str(core.ITEM8_EXAMPLES), help="item-8 library (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="= --kit (default)")
    ap.add_argument("--kit", action="store_true", help="quantities of the library kit (computed + kit_qty)")
    ap.add_argument("--qty", help="own quantities NAME=VALUE,... (with --kit: override single kit values)")
    ap.add_argument("--factor", help="override factors NAME=VALUE,... (test_factor, doc_factor, pm_factor, "
                                     "contingency_factor, hours_per_week)")
    ap.add_argument("--md", help="write a Markdown report")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    D = load_effort(a.examples)
    E = D["effort"]
    own = parse_pairs(a.qty, "qty") if a.qty else {}
    fa = dict(E["factors"])
    if a.factor:
        for k, v in parse_pairs(a.factor, "factor").items():
            if k not in FACTORS:
                raise InputError(f"--factor: unknown factor '{k}' ({', '.join(FACTORS)})")
            fa[k] = v
    source = {}
    if a.kit or not own:
        L = core.load_library(a.library)
        qty = kit_quantities(D, L)
        source = {k: "computed (item 8 kit)" if k in ("io_std", "io_safe") else
                  "computed (st_codegen kit)" if k == "fb_instances" else "kit_qty" for k in qty}
        title = f"PLC SOFTWARE EFFORT  library kit '{L['kit'].get('name', 'kit')}'"
    else:
        qty = {}
        title = "PLC SOFTWARE EFFORT  own quantities"
    for k, v in own.items():
        qty[k] = v
        source[k] = "--qty"
    R = estimate(qty, E["coef_h"], fa)
    if a.md:
        Path(a.md).write_text(md(R, title), encoding="utf-8")
    if a.json:
        print(json.dumps({k: v for k, v in R.items() if k != "lines"}, indent=1))
        return 0
    show(R, title, source)
    if a.md:
        print(f"\nMarkdown written: {a.md}")
    return 0


if __name__ == "__main__":
    run_main(main)
