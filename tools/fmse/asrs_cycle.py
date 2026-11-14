#!/usr/bin/env python3
"""AS/RS (stacker crane) cycle times with the FEM 9.851 points, throughput table, crane count.

Python 3 standard library only, offline. Cycle times = exactly the web calculator "asrs"
(web/fmse3.js, also element_sizing.py asrs):
  reference points  P1 = (L/5, 2H/3),  P2 = (2L/3, H/5)            [m from the I/O point]
  move time         t(x, y) = max(t_move(x, vx, ax), t_move(y, vy, ay))   (X and Y move together)
  t_move(s, v, a)   = s/v + v/a  if s > v^2/a (top speed reached), else 2*sqrt(s/a)
  single cycle      t_sc = t(P1) + t(P2) + 2*t_fork + t_dead
  double cycle      t_dc = t(P1) + t(P1->P2) + t(P2) + 4*t_fork + t_dead
  throughput        single 3600/t_sc moves/h ; double 2*3600/t_dc moves/h (2 moves per double cycle)
Extras (not on the web page):
  table of the throughput for other rack lengths / heights (--lengths, --heights)
  cranes for a peak (--peak moves/h): cranes = ceil(peak/(throughput*u_max)), u_max default 0.85,
  with double cycles by default (--cycle single to use single cycles). One crane per aisle.
"""

import argparse
import math

from fmse_common import ITEM3_EXAMPLES, InputError, SelfTest, fmt_table, fmt_web, load_examples, parse_float_list, \
    run_main, t_move, write_csv
from element_sizing import CALC, asrs_cycles, compute

KEYS = [k for k, _, _, _ in CALC["asrs"][1]]


def cranes(peak, v, cycle="double", umax=0.85):
    """Number of cranes (aisles) for a peak number of moves per hour."""
    if peak <= 0:
        raise InputError("--peak must be > 0")
    if not 0 < umax <= 1:
        raise InputError("--umax must be in (0, 1]")
    r = asrs_cycles(v)
    th = r["th_dc"] if cycle == "double" else r["th_sc"]
    n = math.ceil(peak / (th * umax) - 1e-9)
    return {"th": th, "n": n, "u": peak / (n * th)}


def table(v, lengths, heights, which):
    rows = []
    for L in lengths:
        row = [f"{L:g}"]
        for H in heights:
            w = dict(v, L=L, H=H)
            r = asrs_cycles(w)
            row.append(fmt_web(r["th_dc"] if which == "double" else r["th_sc"], 0))
        rows.append(row)
    return rows


def show(v, lengths, heights, peak, cycle, umax, csv_path):
    vv, out, verdict = compute("asrs", v)
    print("AS/RS CYCLE TIMES (FEM 9.851)   same as the web calculator 'asrs'")
    print(fmt_table(["input", "key", "value", "unit"], [[lab, k, f"{vv[k]:g}", u] for k, lab, _, u in CALC["asrs"][1]], "llrl"))
    r = asrs_cycles(vv)
    print()
    rows = []
    for name, (x, y) in (("I/O -> P1", r["P1"]), ("I/O -> P2", r["P2"]),
                         ("P1 -> P2", (abs(r["P2"][0] - r["P1"][0]), abs(r["P2"][1] - r["P1"][1])))):
        tx, ty = t_move(x, vv["vx"], vv["ax"]), t_move(y, vv["vy"], vv["ay"])
        rows.append([name, f"{x:.3f}", f"{tx:.3f}", f"{y:.3f}", f"{ty:.3f}", f"{max(tx, ty):.3f}", "X" if tx >= ty else "Y"])
    print(fmt_table(["move", "x m", "t_x s", "y m", "t_y s", "t = max s", "decides"], rows, "lrrrrrl"))
    print(f"  (top speed reached when the distance > v²/a: travel {vv['vx'] ** 2 / vv['ax']:g} m, hoist {vv['vy'] ** 2 / vv['ay']:g} m)")
    print()
    print(fmt_table(["result (formula)", "value", "with numbers"],
                    [[o[0], o[2] if o[3] < 0 else f"{fmt_web(o[1], o[3])} {o[2]}", o[4]] for o in out], "lrl"))
    print(f"Verdict: {verdict}")
    print()
    hs = "  ".join(f"{h:g}" for h in heights)
    for which in ("single", "double"):
        print(f"Throughput {which} cycles [moves/h] - rows rack length L [m], columns rack height H [m] ({hs}); "
              "other inputs as above")
        print(fmt_table(["L \\ H"] + [f"{h:g}" for h in heights], table(vv, lengths, heights, which)))
        print()
    if peak is not None:
        c = cranes(peak, vv, cycle, umax)
        print(f"CRANES FOR A PEAK OF {peak:g} moves/h ({cycle} cycles, max. utilisation {umax:g})")
        print(f"  cranes = ⌈{peak:g} / ({c['th']:.2f}·{umax:g})⌉ = ⌈{peak / (c['th'] * umax):.3f}⌉ = {c['n']}   "
              f"(utilisation per crane {100 * c['u']:.0f} %; one crane per aisle)")
        if cycle == "double":
            print("  Double cycles need a store AND a retrieve order at the same time; if the peak is one-sided "
                  "(only retrievals), use --cycle single.")
    if csv_path:
        rows = []
        for L in lengths:
            for H in heights:
                r2 = asrs_cycles(dict(vv, L=L, H=H))
                rows.append([L, H, round(r2["tsc"], 3), round(r2["tdc"], 3), round(r2["th_sc"], 2), round(r2["th_dc"], 2)])
        p = write_csv(csv_path, ["L_m", "H_m", "single_cycle_s", "double_cycle_s", "single_moves_h", "double_moves_h"], rows)
        print(f"CSV written: {p}")


# ----------------------------------------------------------------------------- self-test
def selftest():
    t = SelfTest("asrs_cycle")
    v = {k: float(d) for k, _, d, _ in CALC["asrs"][1]}
    r = asrs_cycles(v)
    t.close("t(P1): x 8 m -> 2*sqrt(16) = 8 s, y 8 m -> 10 + 1.6 = 11.6 s", r["t1"], 11.6, 1e-12)
    t.close("t(P2): x 26.667 -> 8.889 + 6 = 14.889 s", r["t2"], 14.888888889, 1e-8)
    t.close("t(P1->P2): x 18.667 -> 6.222 + 6 = 12.222 s", r["t12"], 12.222222222, 1e-8)
    t.close("single cycle 46.4889 s", r["tsc"], 46.488888889, 1e-8)
    t.close("double cycle 74.7111 s", r["tdc"], 74.711111111, 1e-8)
    t.close("single throughput 3600/46.4889", r["th_sc"], 77.4378585, 1e-6)
    t.close("double throughput 7200/74.7111", r["th_dc"], 96.3712076, 1e-6)
    c = cranes(150, v)
    t.equal("150 moves/h -> ceil(150/(96.37*0.85)) = 2 cranes", c["n"], 2)
    t.equal("80 moves/h single, umax 1 -> ceil(1.033) = 2", cranes(80, v, "single", 1.0)["n"], 2)
    # triangle profile check: L = 10 -> P1 x = 2 m < 18 m -> 2*sqrt(4) = 4 s
    t.close("short rack: t_x(2 m) = 4 s", asrs_cycles(dict(v, L=10, H=0.3))["t1"],
            max(4.0, 2 * math.sqrt(0.2 / 0.5)), 1e-12)
    try:
        cranes(0, v)
        t.true("peak 0 rejected", False)
    except InputError:
        t.true("peak 0 rejected", True)
    return t.finish()


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False,
        epilog="Examples:\n  python tools/fmse/asrs_cycle.py\n"
               "  python tools/fmse/asrs_cycle.py --peak 150\n"
               "  python tools/fmse/asrs_cycle.py --L 60 --H 18 --vx 4 --peak 200 --cycle single\n"
               "  python tools/fmse/asrs_cycle.py --lengths 20,40,60,80 --heights 8,12,16 --csv asrs.csv")
    ap.add_argument("--examples", default=str(ITEM3_EXAMPLES), help="item-3 example JSON (default: %(default)s)")
    for k, lab, d, u in CALC["asrs"][1]:
        ap.add_argument(f"--{k}", type=float, help=f"{lab} [{u}] (web default {d:g})")
    ap.add_argument("--lengths", default="20,30,40,60,80,100", help="rack lengths for the table [m] (default %(default)s)")
    ap.add_argument("--heights", default="6,9,12,18,24", help="rack heights for the table [m] (default %(default)s)")
    ap.add_argument("--peak", type=float, help="peak moves per hour -> number of cranes")
    ap.add_argument("--cycle", choices=["double", "single"], default="double", help="cycle type for --peak")
    ap.add_argument("--umax", type=float, default=0.85, help="max. crane utilisation for --peak (default 0.85)")
    ap.add_argument("--csv", help="write the throughput table to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    load_examples(a.examples, "basic_calculators")
    lengths = parse_float_list(a.lengths, "--lengths")
    heights = parse_float_list(a.heights, "--heights")
    if min(lengths) <= 0 or min(heights) <= 0:
        raise InputError("--lengths and --heights must be > 0")
    if a.peak is not None and a.peak <= 0:
        raise InputError("--peak must be > 0")
    if not 0 < a.umax <= 1:
        raise InputError("--umax must be in (0, 1]")
    show({k: getattr(a, k) for k in KEYS}, lengths, heights, a.peak, a.cycle, a.umax, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
