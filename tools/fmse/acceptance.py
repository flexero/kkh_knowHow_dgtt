#!/usr/bin/env python3
"""Acceptance-test calculator for FMS projects (SAT availability run, cycle time, Cpk).

Offline, Python standard library only. Default inputs: "acceptance_run" in
examples/item1_examples.json.

1) Availability of the acceptance run (formula from the shared JSON):
       A = (T_run - T_owner - T_supplier) / (T_run - T_owner)
   T_run      = length of the run (h)
   T_owner    = stops caused by the owner (no parts, no operator, power cut ...) -> removed
   T_supplier = stops caused by the supplier (machine faults, software errors ...)
   Verdict: PASS if A >= target.

2) Cycle-time check of measured cycle times against the guaranteed cycle time:
       n, mean = sum(x)/n, sample std s = sqrt(sum((x-mean)^2)/(n-1)), min, max,
       share above guaranteed = count(x > guaranteed) / n
   Verdict: PASS if mean <= guaranteed (the contract guarantees the average cycle).
   The share above guaranteed is shown as extra information.

3) Process capability (quality acceptance, e.g. "Cpk >= 1.33 over 50 parts"):
       Cp  = (USL - LSL) / (6 s)
       Cpk = min(USL - mean, mean - LSL) / (3 s)          (s = sample standard deviation)
   Verdict: PASS if Cpk >= --cpk-min (default 1.33).

Values file (--values): numbers separated by new lines, spaces or ';'. A dot or a comma can be the
decimal mark ('57.4' or '57,4'). Lines starting with '#' are comments.
"""

import argparse
import math
import statistics
from pathlib import Path

from fmse_common import DEFAULT_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main

# example for the Cpk self-test and README: bore diameter 52 H7 (52.000 ... 52.030 mm), 10 parts
CPK_EXAMPLE = {"lsl": 52.000, "usl": 52.030,
               "values": [52.017, 52.020, 52.023, 52.019, 52.021, 52.018, 52.022, 52.020, 52.024, 52.016]}


def availability(t_run, t_owner, t_supplier):
    """Availability of the acceptance run. Raises InputError for impossible times."""
    if t_run <= 0:
        raise InputError("T_run must be > 0")
    if t_owner < 0 or t_supplier < 0:
        raise InputError("stop times must be >= 0")
    if t_owner >= t_run:
        raise InputError("T_owner must be smaller than T_run")
    if t_owner + t_supplier > t_run:
        raise InputError("T_owner + T_supplier cannot be larger than T_run")
    return (t_run - t_owner - t_supplier) / (t_run - t_owner)


def cycle_check(values, guaranteed):
    """Statistics of measured cycle times vs the guaranteed time. Returns a dict."""
    if len(values) < 2:
        raise InputError("need at least 2 measured values for a standard deviation")
    mean = statistics.fmean(values)
    above = [x for x in values if x > guaranteed]
    return {"n": len(values), "mean": mean, "std": statistics.stdev(values),
            "min": min(values), "max": max(values), "n_above": len(above),
            "share_above": len(above) / len(values), "pass": mean <= guaranteed}


def cpk(values, lsl, usl):
    """Return dict with n, mean, s, Cp, Cpk for the values and limits (sample std)."""
    if usl <= lsl:
        raise InputError("USL must be larger than LSL")
    if len(values) < 2:
        raise InputError("need at least 2 values for Cp / Cpk")
    mean = statistics.fmean(values)
    s = statistics.stdev(values)
    if s == 0:
        raise InputError("all values are equal (s = 0): Cp / Cpk cannot be calculated")
    return {"n": len(values), "mean": mean, "s": s, "cp": (usl - lsl) / (6 * s),
            "cpk": min(usl - mean, mean - lsl) / (3 * s)}


def read_values(path):
    """Read numbers from a text file (see module help for the format)."""
    p = Path(path)
    if not p.is_file():
        raise InputError(f"values file not found: {p}")
    out = []
    for ln, line in enumerate(p.read_text(encoding="utf-8-sig").splitlines(), start=1):
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        for tok in line.replace(";", " ").replace("\t", " ").split():
            parts = tok.split(",") if ("." in tok or tok.count(",") > 1) else [tok.replace(",", ".")]
            for x in parts:
                if not x:
                    continue
                try:
                    out.append(float(x))
                except ValueError:
                    raise InputError(f"{p} line {ln}: '{x}' is not a number")
    if not out:
        raise InputError(f"{p}: no numbers found")
    return out


def report_availability(t_run, t_owner, t_supplier, target):
    """Print the availability block and return A."""
    a = availability(t_run, t_owner, t_supplier)
    print("1) AVAILABILITY OF THE ACCEPTANCE RUN")
    print("   A = (T_run - T_owner - T_supplier) / (T_run - T_owner)")
    print(f"     = ({t_run:g} - {t_owner:g} - {t_supplier:g}) / ({t_run:g} - {t_owner:g})"
          f" = {t_run - t_owner - t_supplier:.4g} / {t_run - t_owner:.4g}")
    print(f"     = {a:.6f}  = {a*100:.2f} %   target {target*100:.2f} %   ->  "
          f"{'PASS' if a >= target else 'FAIL'}")
    allowed = (1 - target) * (t_run - t_owner)
    print(f"   Supplier stop time allowed at this target: {allowed:.3f} h (used {t_supplier:g} h)")
    return a


def report_cycle(values, guaranteed):
    """Print the cycle-time block and return the result dict."""
    c = cycle_check(values, guaranteed)
    print("2) CYCLE-TIME CHECK")
    print(f"   values: {', '.join(f'{x:g}' for x in values)}")
    print(fmt_table(["n", "mean", "std (s)", "min", "max", "guaranteed", "> guaranteed"],
                    [[c["n"], f"{c['mean']:.4f}", f"{c['std']:.4f}", f"{c['min']:g}", f"{c['max']:g}",
                      f"{guaranteed:g}", f"{c['n_above']} ({c['share_above']*100:.0f} %)"]], "rrrrrrr"))
    print(f"   mean {c['mean']:.4f} {'<=' if c['pass'] else '>'} guaranteed {guaranteed:g}  ->  "
          f"{'PASS' if c['pass'] else 'FAIL'}")
    if c["pass"] and c["n_above"]:
        print(f"   Note: {c['n_above']} single cycles are above the guaranteed time; agree in the contract "
              "whether the guarantee is for the mean or for every cycle.")
    return c


def report_cpk(values, lsl, usl, cpk_min):
    """Print the Cp / Cpk block and return the result dict."""
    r = cpk(values, lsl, usl)
    print("3) PROCESS CAPABILITY")
    print("   Cp = (USL - LSL) / (6 s)     Cpk = min(USL - mean, mean - LSL) / (3 s)")
    print(f"   n = {r['n']}, mean = {r['mean']:.6g}, s = {r['s']:.6g}, LSL = {lsl:g}, USL = {usl:g}")
    print(f"   Cp = {r['cp']:.4f}   Cpk = {r['cpk']:.4f}   required Cpk >= {cpk_min:g}  ->  "
          f"{'PASS' if r['cpk'] >= cpk_min else 'FAIL'}")
    if r["cp"] - r["cpk"] > 0.05:
        print("   Cpk is clearly below Cp: the process is not centred - move the mean to the middle.")
    if r["n"] < 50:
        print(f"   Note: only {r['n']} values; acceptance usually asks for >= 50 consecutive parts.")
    return r


def selftest(path):
    """Asserts against hand-checked values."""
    t = SelfTest("acceptance")
    _, ar = load_examples(path, "acceptance_run")
    a = availability(ar["T_run_h"], ar["T_owner_h"], ar["T_supplier_h"])
    t.close("availability = 67.7/70.8", a, 67.7 / 70.8, 1e-12)
    t.close("availability value", a, 0.9562146892655368, 1e-12)
    t.true("availability >= 0.95 -> PASS", a >= ar["target"])
    c = cycle_check(ar["cycle_check"]["measured_min"], ar["cycle_check"]["guaranteed_min"])
    t.close("cycle mean = 573.9/10", c["mean"], 57.39, 1e-9)
    t.close("cycle sample std", c["std"], math.sqrt(1.729 / 9), 1e-9)
    t.equal("cycle max", c["max"], 58.1)
    t.equal("cycle min", c["min"], 56.8)
    t.equal("cycles above guaranteed (58.1, 57.8, 57.9)", c["n_above"], 3)
    t.true("cycle verdict PASS (mean 57.39 <= 57.6)", c["pass"])
    r = cpk(CPK_EXAMPLE["values"], CPK_EXAMPLE["lsl"], CPK_EXAMPLE["usl"])
    s_hand = math.sqrt(60 / 9) * 1e-3
    t.close("Cpk example mean 52.020", r["mean"], 52.020, 1e-9)
    t.close("Cpk example s = sqrt(60/9) um", r["s"], s_hand, 1e-9)
    t.close("Cp = 0.030 / (6 s) = 1.9365", r["cp"], 0.030 / (6 * s_hand), 1e-6)
    t.close("Cpk = 0.010 / (3 s) = 1.2910", r["cpk"], 0.010 / (3 * s_hand), 1e-6)
    t.true("Cpk example < 1.33 -> FAIL (process not centred)", r["cpk"] < 1.33)
    try:
        availability(10, 11, 0)
        t.true("bad times rejected", False)
    except InputError:
        t.true("bad times rejected", True)
    return t.finish()


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/acceptance.py\n"
               "  python tools/fmse/acceptance.py --run 72 --owner 1.2 --supplier 3.1 --target 0.95\n"
               "  python tools/fmse/acceptance.py --values cycles.txt --guaranteed 57.6\n"
               "  python tools/fmse/acceptance.py --cpk --lsl 52.000 --usl 52.030 "
               "--values tools/fmse/examples/bore_values_example.txt")
    ap.add_argument("--examples", default=str(DEFAULT_EXAMPLES), help="shared example JSON (default: %(default)s)")
    ap.add_argument("--run", type=float, help="T_run: length of the acceptance run (h)")
    ap.add_argument("--owner", type=float, help="T_owner: stop time caused by the owner (h)")
    ap.add_argument("--supplier", type=float, help="T_supplier: stop time caused by the supplier (h)")
    ap.add_argument("--target", type=float, help="availability target as a fraction, e.g. 0.95")
    ap.add_argument("--values", help="text file with measured values (cycle times, or sizes with --cpk)")
    ap.add_argument("--guaranteed", type=float, help="guaranteed cycle time (same unit as the values)")
    ap.add_argument("--cpk", action="store_true", help="calculate Cp / Cpk of --values with --lsl / --usl")
    ap.add_argument("--lsl", type=float, help="lower specification limit")
    ap.add_argument("--usl", type=float, help="upper specification limit")
    ap.add_argument("--cpk-min", type=float, default=1.33, help="required Cpk (default 1.33)")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, ar = load_examples(a.examples, "acceptance_run")
    if a.cpk:
        if a.lsl is None or a.usl is None:
            raise InputError("--cpk needs --lsl and --usl")
        vals = read_values(a.values) if a.values else CPK_EXAMPLE["values"]
        if not a.values:
            print("(no --values given: using the built-in bore example 52 H7)")
        report_cpk(vals, a.lsl, a.usl, a.cpk_min)
        return 0
    if a.target is not None and not 0 < a.target <= 1:
        raise InputError("--target must be a fraction between 0 and 1, e.g. 0.95")
    print("ACCEPTANCE CHECK")
    report_availability(a.run if a.run is not None else ar["T_run_h"],
                        a.owner if a.owner is not None else ar["T_owner_h"],
                        a.supplier if a.supplier is not None else ar["T_supplier_h"],
                        a.target if a.target is not None else ar["target"])
    print()
    vals = read_values(a.values) if a.values else ar["cycle_check"]["measured_min"]
    g = a.guaranteed if a.guaranteed is not None else ar["cycle_check"]["guaranteed_min"]
    report_cycle(vals, g)
    print()
    r = cpk(CPK_EXAMPLE["values"], CPK_EXAMPLE["lsl"], CPK_EXAMPLE["usl"])
    print(f"(Cp / Cpk: run with --cpk --lsl .. --usl .. --values FILE; built-in example 52 H7 gives "
          f"Cp {r['cp']:.3f}, Cpk {r['cpk']:.3f})")
    return 0


if __name__ == "__main__":
    run_main(main)
