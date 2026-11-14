#!/usr/bin/env python3
"""FMS economics: which system type gives the lowest cost per part?

Compares the system types of the shared example file (stand-alone CNC, FMC, FMS, flexible
transfer line) for each volume-variety scenario. Python 3 standard library only, offline.

Formulas (same as "_formulas" in examples/item1_examples.json):
    Q_total        = variety * q_per_part                     (parts per year)
    N_changeovers  = variety * orders_per_part_year           (one changeover per order)
    CRF            = i(1+i)^n / ((1+i)^n - 1)                 (capital recovery factor)
    units          = ceil(Q_total / cap_per_unit)             (number of systems needed)
    C              = units*I*CRF + units*F + Q_total*v + N_changeovers*c_ch   [EUR / year]
    cost per part  = C / Q_total
    (I and F are given in MEUR in the file and are converted to EUR: x 1 000 000)

Break-even volume between two types (same variety and same number of changeovers):
    The cost of one type is a straight line in Q as long as its number of units does not
    change; it jumps up by I*CRF + F each time one more unit is needed (at Q = k*cap).
    So the difference C_a(Q) - C_b(Q) is a straight line between all unit jumps of both
    types. The tool walks through these segments from Q = 1 to --max-volume and
      - solves the straight line for zero inside each segment (exact break-even), and
      - reports a "jump" crossing when the sign changes exactly at a unit jump.
    There can be several break-even volumes for one pair because of the unit jumps.
"""

import argparse
import math
import sys

from fmse_common import (DEFAULT_EXAMPLES, InputError, SelfTest, fmt_num, fmt_table,
                         load_examples, run_main, write_csv)

DEFAULT_VOLUMES = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 300000]


# ----------------------------------------------------------------------------- core formulas
def crf(i, n):
    """Capital recovery factor: turns an investment into an equal annual payment over n years."""
    if n <= 0:
        raise InputError("n_years must be > 0")
    if i == 0:
        return 1.0 / n
    f = (1 + i) ** n
    return i * f / (f - 1)


def annual_cost(t, q_total, n_changeovers, crf_value):
    """Annual cost of system type t (dict from the JSON) for a volume and number of changeovers.

    Returns a dict with units, capital, fixed, variable, changeover, total (EUR / year), per_part.
    """
    if q_total <= 0:
        raise InputError("Q_total must be > 0")
    units = math.ceil(q_total / t["cap_per_unit"])
    capital = units * t["I_MEUR"] * 1e6 * crf_value
    fixed = units * t["F_MEUR"] * 1e6
    variable = q_total * t["v_EUR"]
    change = n_changeovers * t["c_ch_EUR"]
    total = capital + fixed + variable + change
    return {"units": units, "capital": capital, "fixed": fixed, "variable": variable,
            "changeover": change, "total": total, "per_part": total / q_total}


def scenario_volume(s):
    """Return (Q_total, N_changeovers) of a scenario dict."""
    return s["variety"] * s["q_per_part"], s["variety"] * s["orders_per_part_year"]


def evaluate_scenario(eco, s):
    """Cost of every type for one scenario. Returns (Q, N, list of (type, cost dict), cheapest key)."""
    c = crf(eco["i"], eco["n_years"])
    q, n = scenario_volume(s)
    res = [(t, annual_cost(t, q, n, c)) for t in eco["types"]]
    cheapest = min(res, key=lambda r: r[1]["per_part"])[0]["k"]
    return q, n, res, cheapest


def break_even(ta, tb, n_changeovers, crf_value, q_max=500000):
    """All break-even volumes between type ta and tb in 0 < Q <= q_max (method: see module doc).

    Returns a list of dicts: {"q": volume, "kind": "solve"|"jump", "cheaper_above": key}.
    """
    def parts(t):
        # cost = units*(I*CRF+F) + Q*v + N*c_ch ; unit cost block u_cost
        return t["I_MEUR"] * 1e6 * crf_value + t["F_MEUR"] * 1e6, t["v_EUR"], n_changeovers * t["c_ch_EUR"]

    ua, va, ca = parts(ta)
    ub, vb, cb = parts(tb)
    # all unit-jump points of both types up to q_max
    pts = set([0, q_max])
    for t in (ta, tb):
        cap = t["cap_per_unit"]
        k = 1
        while k * cap < q_max:
            pts.add(k * cap)
            k += 1
    pts = sorted(pts)

    def diff_in_segment(lo):
        """Coefficients (c0, c1) of C_a - C_b on the segment (lo, next point]."""
        na = math.floor(lo / ta["cap_per_unit"]) + 1   # units for Q just above lo
        nb = math.floor(lo / tb["cap_per_unit"]) + 1
        return na * ua + ca - nb * ub - cb, va - vb

    out = []
    prev_end_value = None    # value of the difference at Q = lo (end of previous segment)
    for lo, hi in zip(pts[:-1], pts[1:]):
        c0, c1 = diff_in_segment(lo)
        start_value = c0 + c1 * lo      # limit just above lo
        end_value = c0 + c1 * hi        # value at hi (still this segment)
        # crossing exactly at a jump
        if prev_end_value is not None and prev_end_value != 0 and (prev_end_value > 0) != (start_value > 0):
            out.append({"q": float(lo), "kind": "jump",
                        "cheaper_above": ta["k"] if start_value < 0 else tb["k"]})
        # crossing inside the segment
        if c1 != 0:
            q0 = -c0 / c1
            if lo < q0 < hi or (q0 == hi and hi != q_max):
                out.append({"q": q0, "kind": "solve",
                            "cheaper_above": ta["k"] if c1 < 0 else tb["k"]})
        prev_end_value = end_value
    return out


def cost_table(eco, n_changeovers, volumes):
    """Cost per part of every type for a list of total volumes (fixed number of changeovers)."""
    c = crf(eco["i"], eco["n_years"])
    rows = []
    for q in volumes:
        costs = [annual_cost(t, q, n_changeovers, c)["per_part"] for t in eco["types"]]
        best = eco["types"][costs.index(min(costs))]["k"]
        rows.append((q, costs, best))
    return rows


# ----------------------------------------------------------------------------- validation
def check_economics(eco):
    """Check that the economics section has the fields we need; raise InputError if not."""
    for key in ("i", "n_years", "scenarios", "types"):
        if key not in eco:
            raise InputError(f"economics: field '{key}' is missing")
    for t in eco["types"]:
        for key in ("k", "name", "I_MEUR", "F_MEUR", "v_EUR", "cap_per_unit", "c_ch_EUR"):
            if key not in t:
                raise InputError(f"economics type {t.get('k', '?')}: field '{key}' is missing")
        if t["cap_per_unit"] <= 0:
            raise InputError(f"economics type {t['k']}: cap_per_unit must be > 0")
    for s in eco["scenarios"]:
        for key in ("id", "name", "variety", "q_per_part", "orders_per_part_year"):
            if key not in s:
                raise InputError(f"economics scenario {s.get('id', '?')}: field '{key}' is missing")


# ----------------------------------------------------------------------------- report
def report(eco, ids, volumes, q_max, csv_path=None):
    """Print the full report for the chosen scenarios and optionally write a CSV."""
    c = crf(eco["i"], eco["n_years"])
    print(f"FMS ECONOMICS   i = {eco['i']*100:.1f} %   n = {eco['n_years']} years   "
          f"CRF = {c:.6f}")
    print("Types:")
    for t in eco["types"]:
        print(f"  {t['k']:<4} {t['name']}: I = {t['I_MEUR']} MEUR, F = {t['F_MEUR']} MEUR/yr, "
              f"v = {t['v_EUR']} EUR/part, cap = {t['cap_per_unit']} parts/yr per unit, "
              f"c_ch = {t['c_ch_EUR']} EUR/changeover")
    csv_rows = []
    keys = [t["k"] for t in eco["types"]]
    for s in eco["scenarios"]:
        if s["id"] not in ids:
            continue
        q, n, res, cheapest = evaluate_scenario(eco, s)
        print()
        print(f"=== Scenario {s['id']}: {s['name']} ===")
        print(f"variety = {s['variety']} part numbers, {s['q_per_part']} parts each, "
              f"{s['orders_per_part_year']} orders per part per year")
        print(f"Q_total = {fmt_num(q, 0)} parts/yr, N_changeovers = {fmt_num(n, 0)} /yr")
        rows = []
        for t, r in res:
            mark = "<= cheapest" if t["k"] == cheapest else ""
            rows.append([t["k"], r["units"], fmt_num(r["capital"], 0), fmt_num(r["fixed"], 0),
                         fmt_num(r["variable"], 0), fmt_num(r["changeover"], 0),
                         fmt_num(r["total"], 0), fmt_num(r["per_part"], 2), mark])
            csv_rows.append([s["id"], t["k"], r["units"], round(r["capital"], 2), round(r["fixed"], 2),
                             round(r["variable"], 2), round(r["changeover"], 2), round(r["total"], 2),
                             round(r["per_part"], 4), "yes" if t["k"] == cheapest else ""])
        print(fmt_table(["type", "units", "capital/yr", "fixed/yr", "variable/yr", "changeover/yr",
                         "C EUR/yr", "EUR/part", ""], rows, "lrrrrrrrl"))
        # break-even
        print()
        print(f"Break-even total volumes (variety {s['variety']}, N_changeovers {n} fixed, "
              f"Q = 1 .. {fmt_num(q_max, 0)}):")
        types = eco["types"]
        for a in range(len(types)):
            for b in range(a + 1, len(types)):
                be = break_even(types[a], types[b], n, c, q_max)
                if not be:
                    cheaper = types[a]["k"] if annual_cost(types[a], q_max, n, c)["total"] < \
                        annual_cost(types[b], q_max, n, c)["total"] else types[b]["k"]
                    txt = f"no break-even, {cheaper} always cheaper"
                else:
                    txt = ", ".join(f"{fmt_num(x['q'], 0)}{'*' if x['kind'] == 'jump' else ''}"
                                    f" (then {x['cheaper_above']})" for x in be)
                print(f"  {types[a]['k']:>4} vs {types[b]['k']:<4}: {txt}")
        print("  (* = crossing at a unit jump; '(then X)' = X is cheaper just above this volume)")
        # cost per part vs volume
        print()
        print(f"Cost per part (EUR) vs total volume, N_changeovers = {n}:")
        trows = []
        for vq, costs, best in cost_table(eco, n, volumes):
            trows.append([fmt_num(vq, 0)] + [fmt_num(x, 2) for x in costs] + [best])
        print(fmt_table(["Q_total"] + keys + ["cheapest"], trows))
    if csv_path:
        p = write_csv(csv_path, ["scenario", "type", "units", "capital_EUR_yr", "fixed_EUR_yr",
                                 "variable_EUR_yr", "changeover_EUR_yr", "annual_cost_EUR",
                                 "cost_per_part_EUR", "cheapest"], csv_rows)
        print(f"\nCSV written: {p}")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    """Asserts against values hand-checked in a separate scratch calculation."""
    t = SelfTest("fms_economics")
    _, eco = load_examples(path, "economics")
    check_economics(eco)
    c = crf(eco["i"], eco["n_years"])
    t.close("CRF(8 %, 8 yr)", c, 0.17401476059182205, 1e-12)
    want = {"A": {"cnc": 51.2341, "fmc": 44.2569, "fms": 45.9021, "ftl": 76.5037},
            "B": {"cnc": 87.6022, "fmc": 57.9854, "fms": 110.5314, "ftl": 351.0111},
            "C": {"cnc": 45.2264, "fmc": 36.8448, "fms": 28.3115, "ftl": 11.9711}}
    cheap = {"A": "fmc", "B": "fmc", "C": "ftl"}
    units = {"A": {"fmc": 2}, "C": {"cnc": 8, "fmc": 18, "fms": 6, "ftl": 1}}
    for s in eco["scenarios"]:
        q, n, res, best = evaluate_scenario(eco, s)
        for ty, r in res:
            if s["id"] in want:
                t.close(f"scenario {s['id']} {ty['k']} EUR/part", r["per_part"], want[s["id"]][ty["k"]], 6e-5)
            if ty["k"] in units.get(s["id"], {}):
                t.equal(f"scenario {s['id']} {ty['k']} units", r["units"], units[s["id"]][ty["k"]])
        t.equal(f"scenario {s['id']} cheapest", best, cheap.get(s["id"]))
    t.close("scenario A total cost FMC EUR/yr", evaluate_scenario(eco, eco["scenarios"][0])[2][1][1]["total"],
            796625.09, 0.01)
    # break-even FMC vs FMS in scenario A: hand solution in segment 14 000 < Q <= 28 000
    tp = {x["k"]: x for x in eco["types"]}
    be = break_even(tp["fmc"], tp["fms"], 120, c)
    hand = ((2.6e6 - 2 * 0.85e6) * c + (0.12e6 - 2 * 0.05e6) + 120 * (15 - 40)) / (22 - 14)
    t.close("break-even FMC/FMS (A) first crossing", be[0]["q"] if be else None, hand, 1e-6)
    t.equal("break-even FMC/FMS (A) FMS cheaper above", be[0]["cheaper_above"] if be else None, "fms")
    # CNC vs FMC in scenario A: FMC cheaper at low volume (constant difference > 0 in 1st segment)
    d = annual_cost(tp["cnc"], 1000, 120, c)["total"] - annual_cost(tp["fmc"], 1000, 120, c)["total"]
    t.close("cnc - fmc at Q=1000 (A) EUR", d, 51500.738, 1e-3)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python tools/fmse/fms_economics.py --scenario all --csv economics.csv")
    ap.add_argument("--examples", default=str(DEFAULT_EXAMPLES), help="shared example JSON (default: %(default)s)")
    ap.add_argument("--scenario", default="all", help="scenario id (A, B, C ...) or 'all' (default)")
    ap.add_argument("--csv", help="write the cost results to this CSV file")
    ap.add_argument("--volumes", help="comma list of total volumes for the cost-per-part table "
                                      "(default 1000,...,300000)")
    ap.add_argument("--max-volume", type=int, default=500000, help="upper end of break-even search (default 500000)")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, eco = load_examples(a.examples, "economics")
    check_economics(eco)
    all_ids = [s["id"] for s in eco["scenarios"]]
    ids = all_ids if a.scenario.lower() == "all" else [x.strip().upper() for x in a.scenario.split(",")]
    bad = [x for x in ids if x not in all_ids]
    if bad:
        raise InputError(f"unknown scenario {', '.join(bad)} (available: {', '.join(all_ids)}, all)")
    volumes = DEFAULT_VOLUMES
    if a.volumes:
        try:
            volumes = [int(float(x)) for x in a.volumes.split(",") if x.strip()]
        except ValueError:
            raise InputError("--volumes must be a comma list of numbers, e.g. 1000,5000,20000")
        if any(v <= 0 for v in volumes):
            raise InputError("--volumes must all be > 0")
    if a.max_volume < 1:
        raise InputError("--max-volume must be >= 1")
    report(eco, ids, volumes, a.max_volume, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
