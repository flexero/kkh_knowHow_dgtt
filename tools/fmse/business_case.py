#!/usr/bin/env python3
"""Business case of an FMS investment: NPV, IRR, payback, discounted payback, sensitivity.

Offline, Python standard library only. Default inputs: "business_case" in
examples/item1_examples.json. All money values in MEUR (million euro).

Formulas (same as "_formulas" in the shared JSON):
    CF_t   = annual_saving * ramp_t - extra_opex             t = 1..n  (ramp = ramp-up share)
    NPV    = -I0 + sum_{t=1..n} CF_t / (1+r)^t + residual / (1+r)^n
    IRR    = the rate r where NPV(r) = 0; found by bisection between -0.99 and 1.0,
             stop when the interval is smaller than 1e-7
    Payback            = first year where the cumulative CF reaches I0; inside that year
                         linear interpolation: (t-1) + (I0 - cum_{t-1}) / CF_t
    Discounted payback = the same with CF_t / (1+r)^t
    (the residual value is NOT used for the payback years; it is only in the NPV / IRR)

Sensitivity grid: NPV for annual_saving x (1 + saving_pct/100) and I0 x (1 + invest_pct/100);
ramp, extra opex, residual value and rate are kept constant.
"""

import argparse

from fmse_common import (DEFAULT_EXAMPLES, InputError, SelfTest, fmt_table, load_examples,
                         run_main, write_csv)


def cash_flows(bc):
    """List of yearly cash flows CF_1..CF_n (MEUR)."""
    ramp = list(bc["ramp"])
    n = int(bc["years"])
    if len(ramp) < n:
        ramp += [ramp[-1] if ramp else 1.0] * (n - len(ramp))
    return [bc["annual_saving_MEUR"] * ramp[t] - bc["extra_opex_MEUR"] for t in range(n)]


def npv(rate, i0, cfs, residual=0.0):
    """Net present value at 'rate' of investment i0, cash flows cfs (year 1..n) and residual value."""
    n = len(cfs)
    return -i0 + sum(cf / (1 + rate) ** (t + 1) for t, cf in enumerate(cfs)) + residual / (1 + rate) ** n


def irr(i0, cfs, residual=0.0, lo=-0.99, hi=1.0, tol=1e-7):
    """Internal rate of return by bisection. Returns None if NPV has no sign change in [lo, hi]."""
    f_lo = npv(lo, i0, cfs, residual)
    f_hi = npv(hi, i0, cfs, residual)
    if f_lo == 0:
        return lo
    if f_lo * f_hi > 0:
        return None
    while hi - lo > tol:
        mid = (lo + hi) / 2
        f_mid = npv(mid, i0, cfs, residual)
        if (f_mid > 0) == (f_lo > 0):
            lo, f_lo = mid, f_mid
        else:
            hi = mid
    return (lo + hi) / 2


def payback(i0, flows):
    """Payback in years with linear interpolation inside the year; None if not reached."""
    cum = 0.0
    for t, cf in enumerate(flows):
        if cf > 0 and cum + cf >= i0:
            return t + (i0 - cum) / cf
        cum += cf
    return None


def evaluate(bc):
    """All key results for one business case dict. Returns a dict."""
    for k in ("I0_MEUR", "years", "rate", "residual_MEUR", "annual_saving_MEUR", "ramp", "extra_opex_MEUR"):
        if k not in bc:
            raise InputError(f"business_case: field '{k}' is missing")
    if int(bc["years"]) < 1:
        raise InputError("business_case: years must be >= 1")
    r = bc["rate"]
    cfs = cash_flows(bc)
    disc = [cf / (1 + r) ** (t + 1) for t, cf in enumerate(cfs)]
    return {
        "cf": cfs, "disc": disc,
        "npv": npv(r, bc["I0_MEUR"], cfs, bc["residual_MEUR"]),
        "irr": irr(bc["I0_MEUR"], cfs, bc["residual_MEUR"]),
        "payback": payback(bc["I0_MEUR"], cfs),
        "dpayback": payback(bc["I0_MEUR"], disc),
    }


def sensitivity(bc):
    """NPV grid: rows = saving_pct, cols = invest_pct. Returns (saving_pcts, invest_pcts, grid)."""
    sens = bc.get("sensitivity", {"saving_pct": [-20, -10, 0, 10, 20], "invest_pct": [-10, 0, 10, 20]})
    grid = []
    for sp in sens["saving_pct"]:
        row = []
        for ip in sens["invest_pct"]:
            b = dict(bc)
            b["annual_saving_MEUR"] = bc["annual_saving_MEUR"] * (1 + sp / 100)
            b["I0_MEUR"] = bc["I0_MEUR"] * (1 + ip / 100)
            row.append(npv(b["rate"], b["I0_MEUR"], cash_flows(b), b["residual_MEUR"]))
        grid.append(row)
    return sens["saving_pct"], sens["invest_pct"], grid


def yrs(x, n):
    """Text for a payback value."""
    return f"{x:.2f} years" if x is not None else f"not reached within {n} years"


def report(bc, csv_path=None):
    """Print the full business-case report."""
    res = evaluate(bc)
    n = int(bc["years"])
    r = bc["rate"]
    print("BUSINESS CASE (MEUR)")
    print(f"I0 = {bc['I0_MEUR']}  saving = {bc['annual_saving_MEUR']}/yr  extra opex = "
          f"{bc['extra_opex_MEUR']}/yr  rate = {r*100:.2f} %  years = {n}  residual = {bc['residual_MEUR']}")
    print(f"ramp = {bc['ramp']}")
    print()
    rows, cum, cumd = [], -bc["I0_MEUR"], -bc["I0_MEUR"]
    rows.append([0, "", f"{-bc['I0_MEUR']:.4f}", "1.000000", f"{-bc['I0_MEUR']:.4f}", f"{cum:.4f}", f"{cumd:.4f}"])
    ramp = list(bc["ramp"]) + [bc["ramp"][-1]] * max(0, n - len(bc["ramp"]))
    csv_rows = [[0, "", -bc["I0_MEUR"], 1.0, -bc["I0_MEUR"], cum, cumd]]
    for t, (cf, dcf) in enumerate(zip(res["cf"], res["disc"]), start=1):
        cum += cf
        cumd += dcf
        df = 1 / (1 + r) ** t
        rows.append([t, f"{ramp[t-1]:.2f}", f"{cf:.4f}", f"{df:.6f}", f"{dcf:.4f}", f"{cum:.4f}", f"{cumd:.4f}"])
        csv_rows.append([t, ramp[t - 1], round(cf, 6), round(df, 6), round(dcf, 6), round(cum, 6), round(cumd, 6)])
    resid_pv = bc["residual_MEUR"] / (1 + r) ** n
    print(fmt_table(["year", "ramp", "CF", "1/(1+r)^t", "disc. CF", "cum. CF", "cum. disc. CF"], rows))
    print(f"residual value {bc['residual_MEUR']} in year {n} -> present value {resid_pv:.4f}")
    print()
    print(f"NPV                = {res['npv']:.4f} MEUR  ({res['npv']*1e6:,.0f} EUR)".replace(",", " "))
    print(f"IRR                = {res['irr']*100:.4f} %" if res["irr"] is not None else
          "IRR                = no solution between -99 % and 100 %")
    print(f"Payback            = {yrs(res['payback'], n)}")
    print(f"Discounted payback = {yrs(res['dpayback'], n)}")
    verdict = "NPV >= 0: the investment earns at least the rate" if res["npv"] >= 0 else \
        "NPV < 0: the investment does NOT earn the rate (IRR below rate)"
    print(f"Verdict            : {verdict}")
    sp, ip, grid = sensitivity(bc)
    print()
    print("Sensitivity: NPV (MEUR) for saving change (rows) x investment change (columns)")
    print(fmt_table(["saving \\ invest"] + [f"{x:+d} %" for x in ip],
                    [[f"{s:+d} %"] + [f"{v:.3f}" for v in row] for s, row in zip(sp, grid)]))
    if csv_path:
        p = write_csv(csv_path, ["year", "ramp", "CF_MEUR", "discount_factor", "disc_CF_MEUR",
                                 "cum_CF_MEUR", "cum_disc_CF_MEUR"], csv_rows)
        print(f"\nCSV written: {p}")
    return res


def selftest(path):
    """Asserts against values hand-checked in a separate scratch calculation."""
    t = SelfTest("business_case")
    _, bc = load_examples(path, "business_case")
    res = evaluate(bc)
    t.close("CF year 1 = 0.62*0.5-0.08", res["cf"][0], 0.23, 1e-12)
    t.close("CF year 2 = 0.62*0.85-0.08", res["cf"][1], 0.447, 1e-12)
    t.close("CF year 3..8 = 0.54", res["cf"][7], 0.54, 1e-12)
    t.close("NPV (MEUR)", res["npv"], -0.006906541207868239, 1e-9)
    t.close("IRR", res["irr"], 0.07944947, 2e-7)
    t.close("NPV at IRR ~ 0", npv(res["irr"], bc["I0_MEUR"], res["cf"], bc["residual_MEUR"]), 0.0, 1e-5)
    t.close("payback (years) = 6 + 0.063/0.54", res["payback"], 6 + 0.063 / 0.54, 1e-9)
    t.equal("discounted payback not reached in 8 years", res["dpayback"], None)
    sp, ip, grid = sensitivity(bc)
    t.close("sensitivity 0 %/0 % = base NPV", grid[sp.index(0)][ip.index(0)], res["npv"], 1e-12)
    # simple textbook case: I0 100, 3 x 50, r 10 % -> NPV 24.3426, IRR 23.375 %
    t.close("textbook NPV", npv(0.10, 100, [50, 50, 50]), 24.342599549, 1e-6)
    t.close("textbook IRR", irr(100, [50, 50, 50]), 0.2337519, 2e-7)
    t.close("textbook payback 2.0", payback(100, [50, 50, 50]), 2.0, 1e-12)
    return t.finish()


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python tools/fmse/business_case.py\n"
               "  python tools/fmse/business_case.py --saving 0.70 --invest 2.9 --rate 0.08 --csv cash.csv")
    ap.add_argument("--examples", default=str(DEFAULT_EXAMPLES), help="shared example JSON (default: %(default)s)")
    ap.add_argument("--saving", type=float, help="annual saving at 100 %% ramp, MEUR/yr")
    ap.add_argument("--invest", type=float, help="investment I0, MEUR")
    ap.add_argument("--rate", type=float, help="discount rate as a fraction, e.g. 0.08")
    ap.add_argument("--opex", type=float, help="extra operating cost, MEUR/yr")
    ap.add_argument("--residual", type=float, help="residual value at the end, MEUR")
    ap.add_argument("--years", type=int, help="evaluation period in years")
    ap.add_argument("--csv", help="write the cash-flow table to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, bc = load_examples(a.examples, "business_case")
    bc = dict(bc)
    for arg, key in (("saving", "annual_saving_MEUR"), ("invest", "I0_MEUR"), ("rate", "rate"),
                     ("opex", "extra_opex_MEUR"), ("residual", "residual_MEUR"), ("years", "years")):
        if getattr(a, arg) is not None:
            bc[key] = getattr(a, arg)
    if bc["rate"] <= -1:
        raise InputError("--rate must be > -1 (e.g. 0.08 for 8 %)")
    if bc["rate"] > 1:
        print("WARNING: rate > 1 means more than 100 %. Did you mean a fraction, e.g. 0.08?")
    report(bc, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
