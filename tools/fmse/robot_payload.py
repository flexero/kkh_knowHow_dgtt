#!/usr/bin/env python3
"""Robot payload, wrist moment, reach (web calculator) + load inertia check (item 3, robot element).

Python 3 standard library only, offline.
Part 1 - exactly the web calculator "robot" (web/fmse3.js, also element_sizing.py robot):
  m = part + gripper ; M = m*g*e/1000 [N m, e in mm] ; payload use = m/rated ; moment use = M/allowed
  rule: payload and moment <= 80 %, reach >= 105 % of needed
Part 2 - "_formulas.robot_inertia" in examples/item3_examples.json (gripper and part separately):
  gripper = point mass m_g at distance e_g from the wrist axis
  part    = cuboid a x b x c, rotating about the wrist axis (parallel to c), CoG at distance e_p
  J = m_g*e_g^2 + m_p*(a^2 + b^2)/12 + m_p*e_p^2      [kg m2]   (c does not enter: it lies along the axis)
  M = (m_g*e_g + m_p*e_p)*g                            [N m]
  use = J/J_allow and M/M_allow ; rule <= 0.8
Lengths in Part 2 are in metres (JSON), in Part 1 in mm (web).
"""

import argparse

from fmse_common import ITEM3_EXAMPLES, InputError, SelfTest, fmt_table, fmt_web, load_examples, run_main
from element_sizing import CALC, compute

IN_KEYS = ["m_g", "e_g", "m_p", "a", "b", "c", "e_p", "J_allow", "M_allow", "g"]
WEB_KEYS = [k for k, _, _, _ in CALC["robot"][1]]


def inertia(p):
    for k in IN_KEYS:
        if k not in p:
            raise InputError(f"robot_inertia: value '{k}' is missing")
        if p[k] < 0:
            raise InputError(f"robot_inertia: '{k}' must be >= 0")
    if p["J_allow"] <= 0 or p["M_allow"] <= 0:
        raise InputError("J_allow and M_allow must be > 0")
    jg = p["m_g"] * p["e_g"] ** 2
    jo = p["m_p"] * (p["a"] ** 2 + p["b"] ** 2) / 12
    js = p["m_p"] * p["e_p"] ** 2
    J = jg + jo + js
    M = (p["m_g"] * p["e_g"] + p["m_p"] * p["e_p"]) * p["g"]
    uj, um = J / p["J_allow"], M / p["M_allow"]
    return {"jg": jg, "jo": jo, "js": js, "J": J, "M": M, "uJ": uj, "uM": um, "ok": uj <= 0.8 and um <= 0.8}


def show(web_over, p):
    r = inertia(p)                     # check the inertia inputs before anything is printed
    v, out, verdict = compute("robot", web_over)
    print("PART 1 - PAYLOAD, WRIST MOMENT, REACH (same as the web calculator 'robot')")
    print(fmt_table(["input", "key", "value", "unit"], [[lab, k, f"{v[k]:g}", u] for k, lab, _, u in CALC["robot"][1]], "llrl"))
    print(fmt_table(["result (formula)", "value", "with numbers"],
                    [[o[0], f"{fmt_web(o[1], o[3])} {o[2]}", o[4]] for o in out], "lrl"))
    print(f"Verdict: {verdict}")
    print()
    r = inertia(p)
    print("PART 2 - LOAD INERTIA AND MOMENT (JSON robot_inertia; gripper and part separately)")
    print(f"  gripper m_g {p['m_g']:g} kg at e_g {p['e_g']:g} m; part m_p {p['m_p']:g} kg, cuboid {p['a']:g} x {p['b']:g} x "
          f"{p['c']:g} m, CoG at e_p {p['e_p']:g} m; allowed J {p['J_allow']:g} kg m², M {p['M_allow']:g} N m")
    rows = [["gripper (point mass) m_g·e_g²", f"{p['m_g']:g}·{p['e_g']:g}²", f"{r['jg']:.4f} kg m²"],
            ["part about its own CoG m_p·(a²+b²)/12", f"{p['m_p']:g}·({p['a']:g}² + {p['b']:g}²)/12", f"{r['jo']:.4f} kg m²"],
            ["part offset (Steiner) m_p·e_p²", f"{p['m_p']:g}·{p['e_p']:g}²", f"{r['js']:.4f} kg m²"],
            ["inertia J", f"{r['jg']:.4f} + {r['jo']:.4f} + {r['js']:.4f}", f"{r['J']:.4f} kg m²"],
            ["moment M = (m_g·e_g + m_p·e_p)·g", f"({p['m_g']:g}·{p['e_g']:g} + {p['m_p']:g}·{p['e_p']:g})·{p['g']:g}", f"{r['M']:.3f} N m"],
            ["inertia use J/J_allow", f"{r['J']:.4f}/{p['J_allow']:g}", f"{100 * r['uJ']:.1f} %"],
            ["moment use M/M_allow", f"{r['M']:.3f}/{p['M_allow']:g}", f"{100 * r['uM']:.1f} %"]]
    print(fmt_table(["quantity", "formula with numbers", "result"], rows, "llr"))
    print(f"Verdict: {'OK' if r['ok'] else 'NOT OK'} - rule: inertia use and moment use ≤ 80 %"
          + ("" if r["ok"] else "; choose a bigger robot, a lighter gripper or bring the part CoG closer to the flange."))
    print(f"  Note: the Steiner term m_p·e_p² is {100 * r['js'] / r['J']:.0f} % of J - the offset of the part matters more "
          "than its size. Compare with the maker's load diagram (Z and L distances).")
    return v, out, r


def selftest(path):
    t = SelfTest("robot_payload")
    _, p = load_examples(path, "robot_inertia")
    r = inertia(p)
    t.close("J gripper 8*0.1^2 = 0.08", r["jg"], 0.08, 1e-12)
    t.close("J part own 12*(0.09+0.04)/12 = 0.13", r["jo"], 0.13, 1e-12)
    t.close("J Steiner 12*0.2^2 = 0.48", r["js"], 0.48, 1e-12)
    t.close("J = 0.69 kg m2", r["J"], 0.69, 1e-12)
    t.close("M = (0.8 + 2.4)*9.81 = 31.392 N m", r["M"], 31.392, 1e-9)
    t.close("J use 0.69/1.6 = 0.43125", r["uJ"], 0.43125, 1e-12)
    t.close("M use 31.392/50 = 0.62784", r["uM"], 0.62784, 1e-12)
    t.true("verdict OK", r["ok"])
    t.true("NOT OK when e_p = 0.4 (M use 1.098)", not inertia(dict(p, e_p=0.4))["ok"])
    _, out, vd = compute("robot", {})
    t.close("web moment 23.544 N m", out[2][1], 23.544, 1e-9)
    t.true("web verdict ✓", vd.startswith("✓ "))
    return t.finish()


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False,
        epilog="Examples:\n  python tools/fmse/robot_payload.py\n"
               "  python tools/fmse/robot_payload.py --mp 15 --rp 20\n"
               "  python tools/fmse/robot_payload.py --e_p 0.3 --J_allow 2.5")
    ap.add_argument("--examples", default=str(ITEM3_EXAMPLES), help="item-3 example JSON (default: %(default)s)")
    for k, lab, d, u in CALC["robot"][1]:
        ap.add_argument(f"--{k}", type=float, help=f"web part: {lab} [{u}] (default {d:g})")
    for k in IN_KEYS:
        ap.add_argument(f"--{k}", type=float, help=f"inertia part: override JSON robot_inertia.{k}")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, p = load_examples(a.examples, "robot_inertia")
    p = dict(p)
    for k in IN_KEYS:
        if getattr(a, k) is not None:
            p[k] = getattr(a, k)
    show({k: getattr(a, k) for k in WEB_KEYS}, p)
    return 0


if __name__ == "__main__":
    run_main(main)
