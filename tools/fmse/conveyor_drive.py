#!/usr/bin/env python3
"""Conveyor drive: force and motor power (item 3, element "conveyor / carrier transport").

Python 3 standard library only, offline. Formula = "_formulas.conveyor_drive" in examples/item3_examples.json:
  F = m_total*g*mu_roll + m_total*a      [N]   (rolling resistance + acceleration force)
  P = F*v/eta                            [W]   (at the motor, eta = efficiency of gear + chain/rollers)
m_total = all carriers + parts on the driven section [kg], a = start acceleration [m/s2], v [m/s].
Choose the next larger standard motor; check the start (a) separately for heavy accumulation zones.
"""

import argparse

from fmse_common import ITEM3_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main

KEYS = ["m_total_kg", "mu_roll", "a", "v", "eta", "g"]


def drive(p):
    for k in KEYS:
        if k not in p:
            raise InputError(f"conveyor_drive: value '{k}' is missing")
        if p[k] < 0:
            raise InputError(f"conveyor_drive: '{k}' must be >= 0")
    if p["eta"] <= 0 or p["eta"] > 1:
        raise InputError("eta must be in (0, 1]")
    f_roll = p["m_total_kg"] * p["g"] * p["mu_roll"]
    f_acc = p["m_total_kg"] * p["a"]
    F = f_roll + f_acc
    return {"f_roll": f_roll, "f_acc": f_acc, "F": F, "P": F * p["v"] / p["eta"],
            "P_run": f_roll * p["v"] / p["eta"]}


def show(p):
    r = drive(p)
    print("CONVEYOR DRIVE   " + ", ".join(f"{k} {p[k]:g}" for k in KEYS))
    rows = [["rolling resistance m·g·μ", f"{p['m_total_kg']:g}·{p['g']:g}·{p['mu_roll']:g}", f"{r['f_roll']:.2f} N"],
            ["acceleration force m·a", f"{p['m_total_kg']:g}·{p['a']:g}", f"{r['f_acc']:.2f} N"],
            ["drive force F", f"{r['f_roll']:.2f} + {r['f_acc']:.2f}", f"{r['F']:.2f} N"],
            ["motor power P = F·v/η", f"{r['F']:.2f}·{p['v']:g}/{p['eta']:g}", f"{r['P']:.2f} W"],
            ["(steady running only, without a)", f"{r['f_roll']:.2f}·{p['v']:g}/{p['eta']:g}", f"{r['P_run']:.2f} W"]]
    print(fmt_table(["quantity", "formula with numbers", "result"], rows, "llr"))
    print(f"  Choose the next standard motor above {r['P']:.0f} W (e.g. 0.18 / 0.25 / 0.37 kW). Accumulation conveyors: "
          "add the friction of the parts slipping on the rollers.")
    return r


def selftest(path):
    t = SelfTest("conveyor_drive")
    _, p = load_examples(path, "conveyor_drive")
    r = drive(p)
    t.close("rolling 600*9.81*0.03 = 176.58 N", r["f_roll"], 176.58, 1e-9)
    t.close("acceleration 600*0.3 = 180 N", r["f_acc"], 180.0, 1e-12)
    t.close("F = 356.58 N", r["F"], 356.58, 1e-9)
    t.close("P = 356.58*0.3/0.8 = 133.7175 W", r["P"], 133.7175, 1e-9)
    try:
        drive(dict(p, eta=0))
        t.true("eta 0 rejected", False)
    except InputError:
        t.true("eta 0 rejected", True)
    return t.finish()


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False,
        epilog="Examples:\n  python tools/fmse/conveyor_drive.py\n"
               "  python tools/fmse/conveyor_drive.py --m_total_kg 1200 --v 0.25")
    ap.add_argument("--examples", default=str(ITEM3_EXAMPLES), help="item-3 example JSON (default: %(default)s)")
    for k in KEYS:
        ap.add_argument(f"--{k}", type=float, help=f"override JSON conveyor_drive.{k}")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, p = load_examples(a.examples, "conveyor_drive")
    p = dict(p)
    for k in KEYS:
        if getattr(a, k) is not None:
            p[k] = getattr(a, k)
    show(p)
    return 0


if __name__ == "__main__":
    run_main(main)
