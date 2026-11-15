#!/usr/bin/env python3
"""Control cabinet heat balance: IEC 60890 effective surface, natural dissipation, filter fan flow or cooling unit
for each ambient temperature (item 7).

Python 3 standard library only, offline. Formulas = "_formulas" cabinet_area / cabinet_heat in
examples/item7_examples.json. Guide: docs/FMS system design/67_electrical_safety.md.

  area     (W, H, D in m) free-standing all sides: A = 1.8*H*(W + D) + 1.4*W*D
           against a wall (also wall-hung):       A = 1.4*W*(H + D) + 1.8*D*H
  heat     P_loss = sum of losses [W] ; P_nat = k*A*(Ti - Ta) (negative if Ta > Ti) ; Q = P_loss - P_nat
           Q <= 0 -> no active cooling ; Ta < Ti - 5 -> filter fan V = 3.1*Q/(Ti - Ta) [m3/h] (sea level) ;
           else cooling unit with useful power >= Q [W] ; k = 5.5 W/(m2 K) painted sheet steel

Usage:
  python tools/fmse/cabinet_thermal.py                               (JSON example = --example)
  python tools/fmse/cabinet_thermal.py --W 0.8 --H 2.0 --D 0.6 --mounting free --loss 450 --Ta 20,30,40
  python tools/fmse/cabinet_thermal.py --md cabinet.md --csv cabinet.csv
  python tools/fmse/cabinet_thermal.py --json
  python tools/fmse/cabinet_thermal.py --selftest

All values are EXAMPLES. A real design needs sign-off by a qualified engineer with the current IEC 60890 / IEC 61439
editions, the component makers' loss data and the fan / cooling unit makers' curves.
"""

import argparse
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_examples, parse_float_list, run_main, write_csv

HERE = Path(__file__).resolve().parent
ITEM7_EXAMPLES = HERE / "examples" / "item7_examples.json"
NOTE = ("NOTE: all values are EXAMPLES for teaching. A real design needs sign-off by a qualified engineer using the "
        "current IEC 60890 / IEC 61439 editions and the makers' loss, fan and cooling-unit data.")
MOUNT = {"free": "free", "free-standing": "free", "wall": "wall", "wall-hung": "wall", "against a wall": "wall"}


def area(W, H, D, mounting):
    for v, n in ((W, "W"), (H, "H"), (D, "D")):
        if not isinstance(v, (int, float)) or v <= 0:
            raise InputError(f"cabinet {n} must be > 0 m, got {v!r}")
    m = MOUNT.get(str(mounting).lower())
    if m is None:
        raise InputError(f"mounting '{mounting}' unknown - use free or wall")
    if m == "free":
        return 1.8 * H * (W + D) + 1.4 * W * D
    return 1.4 * W * (H + D) + 1.8 * D * H


def heat_case(P_loss, A, k, Ti, Ta):
    P_nat = k * A * (Ti - Ta)
    Q = P_loss - P_nat
    if Q <= 0:
        sol, val, unit = "no active cooling (natural dissipation is enough)", 0.0, ""
    elif Ta < Ti - 5:
        sol, val, unit = "filter fan", 3.1 * Q / (Ti - Ta), "m3/h"
    else:
        sol, val, unit = "cooling unit", Q, "W"
    return {"Ta": Ta, "P_nat": P_nat, "Q": Q, "solution": sol, "value": val, "unit": unit}


def evaluate(C, loss=None):
    A = area(C["W"], C["H"], C["D"], C["mounting"])
    P = float(loss) if loss is not None else sum(float(x[1]) for x in C["losses"])
    if P < 0:
        raise InputError("losses must be >= 0 W")
    return {"A": A, "P_loss": P, "cases": [heat_case(P, A, float(C["k"]), float(C["Ti"]), float(t))
                                           for t in C["Ta_cases"]]}


HEAD = ["Ta C", "P_nat W", "Q needed W", "solution", "size"]


def rows(R):
    return [[f"{c['Ta']:g}", f"{c['P_nat']:.2f}", f"{c['Q']:.2f}", c["solution"],
             f"{c['value']:.1f} {c['unit']}" if c["unit"] else "-"] for c in R["cases"]]


def show(C, R, own_loss):
    print(f"CABINET  {C.get('_case', 'own cabinet')}")
    print(f"  W {C['W']:g} m, H {C['H']:g} m, D {C['D']:g} m, mounting {C['mounting']}, k {C['k']:g} W/(m2 K), "
          f"inside max Ti {C['Ti']:g} C")
    f = ("1.4*W*(H + D) + 1.8*D*H" if MOUNT[str(C["mounting"]).lower()] == "wall" else "1.8*H*(W + D) + 1.4*W*D")
    print(f"  effective surface A = {f} = {R['A']:.3f} m2")
    if not own_loss:
        print(fmt_table(["loss source", "W"], [[n, f"{w:g}"] for n, w in C["losses"]], "lr"))
    print(f"  P_loss = {R['P_loss']:g} W")
    print()
    print("HEAT BALANCE per ambient  (P_nat = k*A*(Ti - Ta), Q = P_loss - P_nat)")
    print(fmt_table(HEAD, rows(R), "rrrlr"))
    print()
    print(NOTE)


def markdown(C, R):
    L = ["# Cabinet heat balance", "", f"- effective surface A = {R['A']:.3f} m2 ({C['mounting']})",
         f"- P_loss = {R['P_loss']:g} W, Ti = {C['Ti']:g} C, k = {C['k']:g} W/(m2 K)", "",
         "| " + " | ".join(HEAD) + " |", "|" + "---|" * len(HEAD)]
    L += ["| " + " | ".join(r) + " |" for r in rows(R)]
    return "\n".join(L + ["", "_" + NOTE + "_"]) + "\n"


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("cabinet_thermal")
    _, C = load_examples(path, "cabinet")
    R = evaluate(C)
    t.close("A (wall) = 1.4*1.2*2.6 + 1.8*0.6*2.0 = 6.528 m2", R["A"], 6.528, 1e-9)
    t.close("A free-standing = 1.8*2*1.8 + 1.4*0.72 = 7.488 m2", area(1.2, 2.0, 0.6, "free"), 7.488, 1e-9)
    t.equal("wall-hung = against a wall", area(1.2, 2.0, 0.6, "wall-hung"), area(1.2, 2.0, 0.6, "wall"))
    t.close("losses 805 W", R["P_loss"], 805, 1e-9)
    c25, c35, c40 = R["cases"]
    t.close("Ta 25: P_nat 359.04 W", c25["P_nat"], 359.04, 1e-6)
    t.close("Ta 25: Q 445.96 W", c25["Q"], 445.96, 1e-6)
    t.equal("Ta 25: filter fan", c25["solution"], "filter fan")
    t.close("Ta 25: fan 138.2 m3/h", c25["value"], 138.2476, 1e-4)
    t.close("Ta 35: P_nat 0", c35["P_nat"], 0, 1e-9)
    t.equal("Ta 35: cooling unit", c35["solution"], "cooling unit")
    t.close("Ta 35: cooling unit 805 W", c35["value"], 805, 1e-9)
    t.close("Ta 40: P_nat -179.52 W (heat flows in)", c40["P_nat"], -179.52, 1e-6)
    t.equal("Ta 40: cooling unit", c40["solution"], "cooling unit")
    t.close("Ta 40: cooling unit 984.52 W", c40["value"], 984.52, 1e-6)
    t.equal("Ta 30 = Ti - 5: no fan (needs Ta < Ti - 5) -> cooling unit",
            heat_case(805, 6.528, 5.5, 35, 30)["solution"], "cooling unit")
    t.equal("Ta 29.9: filter fan", heat_case(805, 6.528, 5.5, 35, 29.9)["solution"], "filter fan")
    low = heat_case(300, 6.528, 5.5, 35, 25)
    t.true("300 W at Ta 25: no active cooling (Q < 0)", low["Q"] < 0 and low["solution"].startswith("no active"))
    t.close("own loss 450 W at Ta 25: fan 3.1*(450-359.04)/10 = 28.2 m3/h", evaluate(C, 450)["cases"][0]["value"],
            28.1976, 1e-4)
    for bad in ((0, 2, 0.6, "wall"), (1.2, 2, 0.6, "roof")):
        try:
            area(*bad)
            t.true(f"bad cabinet {bad} rejected", False)
        except InputError:
            t.true(f"bad cabinet {bad} rejected", True)
    md = markdown(C, R)
    t.true("markdown has the 3 ambient rows and the note",
           all("| " + " | ".join(r) + " |" in md for r in rows(R)) and "EXAMPLES" in md)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM7_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the JSON example (also the default)")
    for k, h in (("W", "width m"), ("H", "height m"), ("D", "depth m"), ("k", "W/(m2 K)"), ("Ti", "inside max C"),
                 ("loss", "total losses W (instead of the JSON list)")):
        ap.add_argument("--" + k, type=float, help=h)
    ap.add_argument("--mounting", help="free or wall (wall-hung = wall)")
    ap.add_argument("--Ta", help="ambient temperatures, comma list, e.g. 25,35,40")
    ap.add_argument("--md", help="write Markdown")
    ap.add_argument("--csv", help="write the per-ambient table as CSV")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, C = load_examples(a.examples, "cabinet")
    C = dict(C)
    own = any(getattr(a, k) is not None for k in ("W", "H", "D", "k", "Ti", "loss", "mounting", "Ta"))
    for k in ("W", "H", "D", "k", "Ti", "mounting"):
        if getattr(a, k) is not None:
            C[k] = getattr(a, k)
    if a.Ta:
        C["Ta_cases"] = parse_float_list(a.Ta, "--Ta")
    if own:
        C["_case"] = "own cabinet (missing values from the JSON example)"
    R = evaluate(C, a.loss)
    if a.json:
        print(json.dumps({**R, "note": NOTE}, indent=1, ensure_ascii=False))
        return 0
    show(C, R, a.loss is not None)
    if a.md:
        p = Path(a.md)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(markdown(C, R), encoding="utf-8")
        print(f"\nMarkdown written: {p}")
    if a.csv:
        print(f"CSV written: {write_csv(a.csv, HEAD, rows(R))}")
    return 0


if __name__ == "__main__":
    run_main(main)
