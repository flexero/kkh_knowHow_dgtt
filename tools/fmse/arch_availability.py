#!/usr/bin/env python3
"""Availability of the control architecture: components, variants (series of parallel blocks), downtime,
and the production loss of MES outages for different local job-buffer sizes.

Python 3 standard library only, offline. Formulas = "_formulas.availability" and "_formulas.mes_buffer" in
examples/item5_examples.json. Guide: docs/FMS system design/65_control_architecture.md (architecture variants).

Component:   A = MTBF / (MTBF + MTTR)
Parallel:    n identical, independent, redundant units: A_block = 1 - (1 - A)^n
             (general: 1 - product(1 - A_i); assumes perfect, instant switch-over)
Series:      A_chain = product of the block availabilities (any block down = cell stops)
Downtime:    (1 - A) * hours_year   [h/year]
MES buffer:  outage rate f = hours_year / (MTBF + MTTR) of the MES server   [outages / year]
             outage duration exponential with mean MTTR
             a local job buffer of b hours keeps the cell running: P(outage > b) = exp(-b / MTTR)
             expected production loss = f * MTTR * exp(-b / MTTR)   [h/year]
             (= f * E[max(0, D - b)] for an exponential duration D: memoryless, so the excess has mean MTTR)
"""

import argparse
import math

from fmse_common import (ITEM5_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, parse_float_list,
                         run_main, write_csv)


def check_av(A):
    for k in ("hours_year", "components", "variants"):
        if k not in A:
            raise InputError(f"availability: value '{k}' is missing")
    names = set()
    for c in A["components"]:
        if len(c) != 3 or not (c[1] > 0) or not (c[2] >= 0):
            raise InputError(f"availability: component {c!r} must be [name, MTBF h > 0, MTTR h >= 0]")
        names.add(c[0])
    for v in A["variants"]:
        for blk in v.get("chain", []):
            if blk[0] not in names:
                raise InputError(f"availability: variant '{v.get('name')}': component '{blk[0]}' unknown")
            if not isinstance(blk[1], int) or blk[1] < 1:
                raise InputError(f"availability: variant '{v.get('name')}': number in parallel must be >= 1")


def comp_av(A):
    """{name: (MTBF, MTTR, A)}"""
    return {n: (b, r, b / (b + r)) for n, b, r in A["components"]}


def variant_av(A, v):
    """Returns (A_chain, rows [component, n, A_component, A_block, downtime of the block h/year])."""
    ca = comp_av(A)
    tot, rows = 1.0, []
    for name, n in v["chain"]:
        a = ca[name][2]
        ab = 1 - (1 - a) ** n
        tot *= ab
        rows.append([name, n, a, ab, (1 - ab) * A["hours_year"]])
    return tot, rows


def mes_loss(A, buffers, server="MES server"):
    """[(b, P(outage > b), expected loss h/year)] and the outage rate f."""
    ca = comp_av(A)
    if server not in ca:
        raise InputError(f"availability: component '{server}' is missing (needed for the MES buffer table)")
    mtbf, mttr, _ = ca[server]
    f = A["hours_year"] / (mtbf + mttr)
    rows = []
    for b in buffers:
        p = math.exp(-b / mttr) if mttr > 0 else (1.0 if b == 0 else 0.0)
        rows.append((b, p, f * mttr * p))
    return f, mttr, rows


# ----------------------------------------------------------------------------- output
def show(A, buffers, csv_path):
    H = A["hours_year"]
    ca = comp_av(A)
    print(f"COMPONENTS  (A = MTBF / (MTBF + MTTR), downtime = (1 - A) x {H} h/year)")
    print(fmt_table(["component", "MTBF h", "MTTR h", "A", "downtime h/year"],
                    [[n, f"{b:g}", f"{r:g}", f"{a:.6f}", f"{(1 - a) * H:.3f}"] for n, (b, r, a) in ca.items()]))
    res = []
    for v in A["variants"]:
        tot, rows = variant_av(A, v)
        res.append((v["name"], tot))
        print()
        print(f"VARIANT: {v['name']}  (series of blocks; block = n units in parallel, A_block = 1 - (1 - A)^n)")
        print(fmt_table(["block", "n", "A unit", "A block", "downtime h/year"],
                        [[n, k, f"{a:.6f}", f"{ab:.9f}", f"{d:.4f}"] for n, k, a, ab, d in rows]))
        print(f"  A chain = {tot:.7f}   downtime = {(1 - tot) * H:.2f} h/year = {(1 - tot) * H * 60:.0f} min/year")
    print()
    print("COMPARISON")
    base = res[0][1]
    print(fmt_table(["variant", "A", "downtime h/year", "saved vs first h/year"],
                    [[n, f"{a:.7f}", f"{(1 - a) * H:.2f}", f"{((1 - base) - (1 - a)) * H:.2f}"] for n, a in res], "lrrr"))
    if len(res) > 1:
        print("  The single cell PLC (no redundancy) is now the biggest part of the downtime in the redundant variant."
              "\n  Redundancy only counts if the switch-over really works: test it at the FAT / SAT.")
    f, mttr, rows = mes_loss(A, buffers)
    print()
    print(f"MES OUTAGES AND THE LOCAL JOB BUFFER  (MES server: f = {H} / (MTBF + MTTR) = {f:.4f} outages/year,"
          f" mean duration {mttr:g} h)")
    print(fmt_table(["buffer b h", "P(outage > b)", "expected loss h/year"],
                    [[f"{b:g}", f"{p:.4f}", f"{l:.3f}"] for b, p, l in rows]))
    print("  P = exp(-b / MTTR); loss = f x MTTR x exp(-b / MTTR). A buffer of 2 x MTTR removes ~86 % of the loss.")
    if csv_path:
        out = [["component", n, "", f"{a:.9f}", f"{(1 - a) * H:.4f}"] for n, (_, _, a) in ca.items()]
        out += [["variant", n, "", f"{a:.9f}", f"{(1 - a) * H:.4f}"] for n, a in res]
        out += [["mes_buffer", f"b={b:g} h", f"{p:.6f}", "", f"{l:.4f}"] for b, p, l in rows]
        p = write_csv(csv_path, ["kind", "name", "P(outage > b)", "A", "h/year"], out)
        print(f"\nCSV written: {p}")
    return res, rows


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("arch_availability")
    _, A = load_examples(path, "availability")
    check_av(A)
    ca = comp_av(A)
    t.close("MES server 8000/8004", ca["MES server"][2], 8000 / 8004, 1e-15)
    t.close("core switch 50000/50002 = 0.99996", ca["Core switch"][2], 0.99996000159994, 1e-12)
    t.close("cell controller PC 20000/20008", ca["Cell controller PC"][2], 0.99960015993603, 1e-12)
    a1, _ = variant_av(A, A["variants"][0])
    hand1 = (50000 / 50002) * (20000 / 20008) * (100000 / 100004)
    t.close("variant 1 = A_sw * A_pc * A_plc", a1, hand1, 1e-15)
    t.close("variant 1 downtime ~ (2/50002 + 8/20008 + 4/100004) * 8760 = 4.20 h", (1 - a1) * 8760, 4.2034, 2e-3)
    a2, rows2 = variant_av(A, A["variants"][1])
    hand2 = (1 - (2 / 50002) ** 2) * (1 - (8 / 20008) ** 2) * (100000 / 100004)
    t.close("variant 2 = (1-q_sw^2)(1-q_pc^2) A_plc", a2, hand2, 1e-15)
    t.close("variant 2 downtime ~ 0.352 h/year", (1 - a2) * 8760, 0.3518, 1e-3)
    t.true("redundant variant better", a2 > a1)
    t.true("variant 2: cell PLC block has the largest downtime", max(rows2, key=lambda r: r[4])[0] == "Cell PLC")
    f, mttr, rows = mes_loss(A, A["mes_buffer_h"])
    t.close("f = 8760 / 8004 = 1.09445 outages/year", f, 8760 / 8004, 1e-12)
    t.close("b = 0: loss = f * 4 = 4.378 h/year", rows[0][2], 4 * 8760 / 8004, 1e-12)
    t.close("b = 4: P = exp(-1) = 0.3679", rows[3][1], math.exp(-1), 1e-12)
    t.close("b = 8: loss = 4.378 * exp(-2) = 0.592", rows[4][2], 4 * 8760 / 8004 * math.exp(-2), 1e-12)
    # independent check of the loss formula: f * integral_b^inf P(D > x) dx by the trapezoid rule
    b, n, h = 2.0, 200000, 0.0004
    integ = sum(math.exp(-(b + k * h) / mttr) for k in range(1, n)) * h + 0.5 * h * (
        math.exp(-b / mttr) + math.exp(-(b + n * h) / mttr))
    t.close("b = 2: f * E[max(0, D - b)] (numeric) = formula", f * integ, rows[2][2], 2e-4)
    try:
        check_av({"hours_year": 8760, "components": [["X", 0, 1]], "variants": []})
        t.true("MTBF 0 -> InputError", False)
    except InputError:
        t.true("MTBF 0 -> InputError", True)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/arch_availability.py\n"
               "  python tools/fmse/arch_availability.py --buffers 0,0.5,1,2,4,8,12 --csv availability.csv")
    ap.add_argument("--examples", default=str(ITEM5_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--buffers", help="job-buffer sizes in hours (default: mes_buffer_h of the JSON)")
    ap.add_argument("--csv", help="write all results to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, A = load_examples(a.examples, "availability")
    check_av(A)
    buffers = parse_float_list(a.buffers, "--buffers") if a.buffers else A.get("mes_buffer_h", [0, 1, 2, 4, 8])
    if any(b < 0 for b in buffers):
        raise InputError("--buffers must be >= 0")
    show(A, buffers, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
