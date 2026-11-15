#!/usr/bin/env python3
"""Queueing models for machine capacity: M/M/1, M/M/m (Erlang C), G/G/m (Kingman / Sakasegawa),
breakdown variability, set-up variability and the cycle-time curve.

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item4_examples.json
(card 4B of the web page uses the same G/G/m formula with cr = 1).

mm1   (section "mm1"):  mu = 60/te ; rho = lambda/mu ; Lq = rho^2/(1-rho) ; Wq = Lq/lambda ; W = Wq + 1/mu ; L = lambda*W
mmm   (section "mmm"):  a = lambda/mu ; rho = a/m
                        P0 = 1 / ( sum_{k=0}^{m-1} a^k/k! + a^m/(m!(1-rho)) ) ; C = a^m/(m!(1-rho)) * P0
                        Lq = C*rho/(1-rho) ; Wq = Lq/lambda ; W = Wq + 1/mu ; L = lambda*W
gg    (section "queue"): A = MTTF/(MTTF+MTTR) ; te = t0/A ; ce^2 = c0^2 + (1 + cr^2)*A*(1-A)*MTTR/t0
                        Wq = ((ca^2 + ce^2)/2) * (u^(sqrt(2(m+1)) - 1)/(m(1-u))) * te ; CT = Wq + te
                        WIP = ra*CT with ra = u*m/te                       (Little's law)
breakdown:              the same machine with the same A but MTTF/10 and MTTR/10 (short, frequent stops)
                        and without breakdowns, side by side
setup (section "setup_var"): a set-up of mean ts, variance sigma_s^2 every Ns parts:
                        te = t0 + ts/Ns ; sigma_e^2 = sigma0^2 + sigma_s^2/Ns + (Ns-1)/Ns^2 * ts^2 ; ce^2 = sigma_e^2/te^2
                        with --rate R [parts/h] or --u U: u = ra*te and Wq (Kingman, m = 1, ca of section "queue")
curve:                  CT/te versus u = 0.30 ... 0.97 for the machine, the short-stop machine and no breakdowns
"""

import argparse
import math

from fmse_common import (ITEM4_EXAMPLES, InputError, SelfTest, fmt_num, fmt_table, load_examples, run_main,
                         write_csv)


# ----------------------------------------------------------------------------- formulas
def mm1(lam_h, te_min):
    if lam_h <= 0 or te_min <= 0:
        raise InputError("mm1: lambda and te must be > 0")
    mu = 60.0 / te_min
    rho = lam_h / mu
    if rho >= 1:
        raise InputError(f"mm1: rho = {rho:.3f} >= 1 - the queue grows without limit")
    lq = rho * rho / (1 - rho)
    wq = lq / lam_h
    w = wq + 1 / mu
    return {"mu": mu, "rho": rho, "Lq": lq, "Wq_h": wq, "W_h": w, "L": lam_h * w}


def mmm(lam_h, te_min, m):
    if lam_h <= 0 or te_min <= 0:
        raise InputError("mmm: lambda and te must be > 0")
    if m < 1 or int(m) != m:
        raise InputError("mmm: m must be a whole number >= 1")
    m = int(m)
    mu = 60.0 / te_min
    a = lam_h / mu
    rho = a / m
    if rho >= 1:
        raise InputError(f"mmm: rho = {rho:.3f} >= 1 - the queue grows without limit")
    s = sum(a ** k / math.factorial(k) for k in range(m))
    last = a ** m / (math.factorial(m) * (1 - rho))
    p0 = 1 / (s + last)
    c = last * p0
    lq = c * rho / (1 - rho)
    wq = lq / lam_h
    w = wq + 1 / mu
    return {"mu": mu, "a": a, "rho": rho, "P0": p0, "C": c, "Lq": lq, "Wq_h": wq, "W_h": w, "L": lam_h * w}


def gg_model(t0, c0, ca, mttf, mttr, m, cr=1.0):
    """Kingman / Sakasegawa machine model. mttf <= 0 means no breakdowns."""
    if t0 <= 0:
        raise InputError("t0 must be > 0")
    if m < 1:
        raise InputError("m must be >= 1")
    if mttf > 0:
        if mttr < 0:
            raise InputError("MTTR must be >= 0")
        A = mttf / (mttf + mttr)
        ce2 = c0 * c0 + (1 + cr * cr) * A * (1 - A) * mttr / t0
    else:
        A, ce2 = 1.0, c0 * c0
    te = t0 / A

    def wq(u):
        if not 0 < u < 1:
            return float("inf")
        return ((ca * ca + ce2) / 2) * (u ** (math.sqrt(2 * (m + 1)) - 1) / (m * (1 - u))) * te

    return {"A": A, "te": te, "ce2": ce2, "ca": ca, "m": m, "wq": wq, "ct": lambda u: wq(u) + te}


def gg_at(q, u):
    M = gg_model(q["t0"], q["c0"], q["ca"], q["mttf"], q["mttr"], q["m"], q.get("cr", 1.0))
    if not 0 < u < 1:
        raise InputError("utilisation u must be between 0 and 1")
    wq = M["wq"](u)
    ct = wq + M["te"]
    ra = u * q["m"] / M["te"]
    return dict(M, u=u, Wq=wq, CT=ct, ra=ra, WIP=ra * ct)


def setup_table(sv, ra_min=None, ca=1.0):
    """Rows for each Ns: te, sigma_e^2, ce^2 (+ u, Wq at arrival rate ra_min [1/min])."""
    for k in ("t0", "sigma0", "ts", "sigma_s", "Ns_values"):
        if k not in sv:
            raise InputError(f"setup_var: value '{k}' is missing")
    rows = []
    for ns in sv["Ns_values"]:
        if ns < 1:
            raise InputError("setup_var: every Ns must be >= 1")
        te = sv["t0"] + sv["ts"] / ns
        se2 = sv["sigma0"] ** 2 + sv["sigma_s"] ** 2 / ns + (ns - 1) / ns ** 2 * sv["ts"] ** 2
        r = {"Ns": ns, "te": te, "se2": se2, "ce2": se2 / te ** 2}
        if ra_min is not None:
            u = ra_min * te
            r["u"] = u
            r["Wq"] = ((ca * ca + r["ce2"]) / 2) * (u / (1 - u)) * te if u < 1 else float("inf")
        rows.append(r)
    return rows


def curve_us(step):
    us, k = [], 0
    while True:
        u = round(0.30 + k * step, 4)
        if u > 0.97 + 1e-9:
            break
        us.append(u)
        k += 1
    if abs(us[-1] - 0.97) > 1e-9:
        us.append(0.97)
    return us


# ----------------------------------------------------------------------------- report
def show_mm1(d):
    r = mm1(d["lambda_per_h"], d["te_min"])
    print("M/M/1 - ONE MACHINE, RANDOM (POISSON) ARRIVALS, EXPONENTIAL PROCESS TIMES")
    print(f"  lambda = {d['lambda_per_h']:g} /h ; mu = 60/te = 60/{d['te_min']:g} = {r['mu']:g} /h")
    print(f"  rho = lambda/mu = {r['rho']:.4f}")
    print(f"  Lq  = rho^2/(1-rho) = {r['Lq']:.4f} parts waiting")
    print(f"  Wq  = Lq/lambda = {r['Wq_h']:.4f} h = {r['Wq_h']*60:.2f} min")
    print(f"  W   = Wq + 1/mu = {r['W_h']:.4f} h = {r['W_h']*60:.2f} min")
    print(f"  L   = lambda*W = {r['L']:.4f} parts in the system")
    return r


def show_mmm(d):
    r = mmm(d["lambda_per_h"], d["te_min"], d["m"])
    print(f"M/M/{d['m']} - ERLANG C ({d['m']} parallel machines, one common queue)")
    print(f"  lambda = {d['lambda_per_h']:g} /h ; mu = 60/{d['te_min']:g} = {r['mu']:g} /h per machine")
    print(f"  a   = lambda/mu = {r['a']:.4f} Erlang ; rho = a/m = {r['rho']:.4f}")
    print(f"  P0  = {r['P0']:.6f}   (probability that the system is empty)")
    print(f"  C   = {r['C']:.6f}   (probability that an arrival must wait)")
    print(f"  Lq  = C*rho/(1-rho) = {r['Lq']:.4f} parts")
    print(f"  Wq  = Lq/lambda = {r['Wq_h']:.4f} h = {r['Wq_h']*60:.2f} min")
    print(f"  W   = Wq + 1/mu = {r['W_h']:.4f} h = {r['W_h']*60:.2f} min")
    print(f"  L   = lambda*W = {r['L']:.4f} parts")
    return r


def show_gg(q, u):
    r = gg_at(q, u)
    m = q["m"]
    print(f"G/G/{m} - KINGMAN / SAKASEGAWA WITH BREAKDOWNS (Factory Physics)")
    print(f"  A    = MTTF/(MTTF+MTTR) = {q['mttf']:g}/({q['mttf']:g}+{q['mttr']:g}) = {r['A']*100:.2f} %")
    print(f"  te   = t0/A = {q['t0']:g}/{r['A']:.6f} = {r['te']:.4f} min")
    print(f"  ce^2 = c0^2 + (1+cr^2)*A*(1-A)*MTTR/t0 = {q['c0']**2:g} + {1 + q.get('cr', 1.0)**2:g}*{r['A']:.6f}*"
          f"{1 - r['A']:.6f}*{q['mttr']:g}/{q['t0']:g} = {r['ce2']:.4f}")
    print(f"  Wq   = ((ca^2+ce^2)/2) * u^(sqrt(2(m+1))-1)/(m(1-u)) * te at u = {u:g}: {r['Wq']:.2f} min")
    print(f"  CT   = Wq + te = {r['CT']:.2f} min = {r['CT']/r['te']:.2f} x te")
    print(f"  WIP  = ra*CT = {r['ra']:.5f} /min * {r['CT']:.2f} = {r['WIP']:.2f} parts   (ra = {r['ra']*60:.3f} /h)")
    return r


def show_breakdown(q, u):
    cases = [("Your machine", q["mttf"], q["mttr"]), ("Same A, 10x shorter stops", q["mttf"] / 10, q["mttr"] / 10),
             ("No breakdowns", 0, 0)]
    print(f"BREAKDOWNS: SHORT AND FREQUENT OR RARE AND LONG?  (u = {u:g}, t0 = {q['t0']:g}, c0 = {q['c0']:g}, "
          f"ca = {q['ca']:g}, m = {q['m']})")
    rows, out = [], []
    for name, f, r_ in cases:
        M = gg_model(q["t0"], q["c0"], q["ca"], f, r_, q["m"], q.get("cr", 1.0))
        wq = M["wq"](u)
        out.append(dict(M, name=name, mttf=f, mttr=r_, Wq=wq, CT=wq + M["te"]))
        rows.append([name, f"{f:g}" if f else "-", f"{r_:g}" if f else "-", f"{M['A']*100:.2f}",
                     f"{M['te']:.3f}", f"{M['ce2']:.4f}", f"{wq:.2f}", f"{wq + M['te']:.2f}",
                     f"{(wq + M['te'])/M['te']:.2f}"])
    print(fmt_table(["case", "MTTF", "MTTR", "A %", "te min", "ce^2", "Wq min", "CT min", "CT/te"], rows))
    print(f"\nSame availability, but the long stops give {out[0]['Wq']/out[1]['Wq']:.2f} x the waiting time of the short ones:")
    print("a 6-hour breakdown hurts more than 36 ten-minute stops. Fight long stops first (spares, diagnosis, MTTR).")
    return out


def show_setup(sv, ra_min, ca, csv_path=None):
    rows = setup_table(sv, ra_min, ca)
    print(f"SET-UP VARIABILITY  (t0 = {sv['t0']:g} min, sigma0 = {sv['sigma0']:g}, ts = {sv['ts']:g} min, "
          f"sigma_s = {sv['sigma_s']:g})")
    hdr = ["Ns", "te min", "sigma_e^2", "ce^2"]
    if ra_min is not None:
        hdr += ["u", "Wq min"]
    tab = []
    for r in rows:
        line = [f"{r['Ns']:g}", f"{r['te']:.3f}", f"{r['se2']:.3f}", f"{r['ce2']:.4f}"]
        if ra_min is not None:
            line += [f"{r['u']:.4f}", f"{r['Wq']:.2f}" if r["u"] < 1 else "unstable"]
        tab.append(line)
    print(fmt_table(hdr, tab))
    if ra_min is not None:
        print(f"  arrival rate ra = {ra_min*60:.4f} parts/h, Kingman m = 1, ca = {ca:g}: Wq = ((ca^2+ce^2)/2)*(u/(1-u))*te")
    else:
        print("  add --rate R (parts/h) or --u U (utilisation at the largest Ns) to see u and Wq per batch size")
    print("  Small Ns: much set-up time in te (capacity loss). Large Ns: one long set-up between many parts")
    print("  makes the flow irregular. SMED (shorter ts) helps both.")
    if csv_path:
        p = write_csv(csv_path, hdr, tab)
        print(f"CSV written: {p}")
    return rows


def show_curve(q, step, csv_path=None):
    cases = [("machine", q["mttf"], q["mttr"]), ("short stops", q["mttf"] / 10, q["mttr"] / 10), ("no breakdowns", 0, 0)]
    Ms = [gg_model(q["t0"], q["c0"], q["ca"], f, r, q["m"], q.get("cr", 1.0)) for _, f, r in cases]
    us = curve_us(step)
    rows = [[f"{u:.2f}"] + [f"{M['ct'](u)/M['te']:.2f}" for M in Ms] for u in us]
    print(f"CYCLE TIME / te VERSUS UTILISATION  (MTTF {q['mttf']:g} / MTTR {q['mttr']:g}; "
          f"short stops {q['mttf']/10:g} / {q['mttr']/10:g}; m = {q['m']})")
    print(fmt_table(["u", "machine", "short stops", "no breakdowns"], rows))
    print("  Waiting grows like u/(1-u): from 80 % to 95 % it becomes 4-5 x longer - plan bottlenecks at 80-85 %.")
    if csv_path:
        p = write_csv(csv_path, ["u", "CT_te_machine", "CT_te_short_stops", "CT_te_no_breakdowns"],
                      [[u] + [round(M["ct"](u) / M["te"], 6) for M in Ms] for u in us])
        print(f"CSV written: {p}")
    return rows


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("queueing")
    data, d1 = load_examples(path, "mm1")
    r = mm1(d1["lambda_per_h"], d1["te_min"])
    t.close("M/M/1 rho = 5/6", r["rho"], 5 / 6, 1e-12)
    t.close("M/M/1 Lq = 4.1667", r["Lq"], 25 / 6, 1e-12)
    t.close("M/M/1 Wq = 50 min", r["Wq_h"] * 60, 50.0, 1e-9)
    t.close("M/M/1 W = 60 min", r["W_h"] * 60, 60.0, 1e-9)
    t.close("M/M/1 L = 5", r["L"], 5.0, 1e-12)
    r = mmm(data["mmm"]["lambda_per_h"], data["mmm"]["te_min"], data["mmm"]["m"])
    t.close("Erlang C a = 2.5", r["a"], 2.5, 1e-12)
    t.close("Erlang C rho = 0.8333", r["rho"], 2.5 / 3, 1e-12)
    t.close("Erlang C P0 = 1/22.25", r["P0"], 1 / 22.25, 1e-12)
    t.close("Erlang C C = 15.625/22.25", r["C"], 15.625 / 22.25, 1e-12)
    t.close("Erlang C Lq = 5*C = 3.5112", r["Lq"], 5 * 15.625 / 22.25, 1e-12)
    t.close("Erlang C Wq = 21.067 min", r["Wq_h"] * 60, 6 * 15.625 / 22.25 * 5, 1e-9)
    t.close("Erlang C W = Wq + 15 min", r["W_h"] * 60, 6 * 15.625 / 22.25 * 5 + 15, 1e-9)
    t.close("Erlang C L = Lq + a", r["L"], 5 * 15.625 / 22.25 + 2.5, 1e-12)
    t.close("M/M/1 = M/M/m with m = 1 (Lq)", mmm(5, 10, 1)["Lq"], 25 / 6, 1e-12)
    q = data["queue"]
    g = gg_at(q, q["u"])
    t.close("A = 600/660", g["A"], 600 / 660, 1e-12)
    t.close("te = 11 min", g["te"], 11.0, 1e-12)
    t.close("ce^2 = 0.25 + 2*A*(1-A)*6 = 1.24174", g["ce2"], 0.25 + 12 * (10 / 11) * (1 / 11), 1e-12)
    wq = (1 + g["ce2"]) / 2 * 0.85 / 0.15 * 11
    t.close("Kingman Wq (m=1: exponent 1) = 69.87 min", g["Wq"], wq, 1e-9)
    t.close("CT = Wq + 11 = 80.87 min", g["CT"], wq + 11, 1e-9)
    t.close("WIP = 0.85/11*CT", g["WIP"], 0.85 / 11 * (wq + 11), 1e-9)
    short = gg_model(q["t0"], q["c0"], q["ca"], 60, 6, 1)
    t.close("short stops ce^2 = 0.25 + 2*A*(1-A)*0.6 = 0.34917", short["ce2"], 0.25 + 1.2 * (10 / 11) * (1 / 11), 1e-12)
    t.close("short stops same te", short["te"], 11.0, 1e-12)
    t.close("no breakdowns Wq = 0.625*0.85/0.15*10", gg_model(10, 0.5, 1, 0, 0, 1)["wq"](0.85), 0.625 * 0.85 / 0.15 * 10, 1e-9)
    t.close("Sakasegawa m=3 exponent sqrt(8)-1", gg_model(10, 1, 1, 0, 0, 3)["wq"](0.8),
            0.8 ** (math.sqrt(8) - 1) / (3 * 0.2) * 10, 1e-12)
    rows = setup_table(data["setup_var"])
    want = [(5, 22, 681), (10, 16, 389), (20, 13, 216), (40, 11.5, 122.75)]
    for r_, (ns, te, se2) in zip(rows, want):
        t.close(f"set-up Ns {ns}: te", r_["te"], te, 1e-12)
        t.close(f"set-up Ns {ns}: sigma_e^2", r_["se2"], se2, 1e-9)
        t.close(f"set-up Ns {ns}: ce^2", r_["ce2"], se2 / te ** 2, 1e-12)
    r4 = setup_table(data["setup_var"], 0.8 / 11.5, 1.0)[-1]
    t.close("set-up Wq at u = 0.8 (Ns 40)", r4["Wq"], (1 + 122.75 / 132.25) / 2 * 4 * 11.5, 1e-9)
    us = curve_us(0.05)
    t.true("curve u from 0.30 to 0.97", abs(us[0] - 0.30) < 1e-12 and abs(us[-1] - 0.97) < 1e-12 and len(us) == 15)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/queueing.py                    (all models with the example data)\n"
               "  python tools/fmse/queueing.py mmm --lam 11\n"
               "  python tools/fmse/queueing.py gg --u 0.9 --m 2\n"
               "  python tools/fmse/queueing.py breakdown\n"
               "  python tools/fmse/queueing.py setup --rate 4.5\n"
               "  python tools/fmse/queueing.py curve --step 0.01 --csv curve.csv")
    ap.add_argument("cmd", nargs="?", choices=["mm1", "mmm", "gg", "breakdown", "setup", "curve", "all"], default="all",
                    help="model to show (default: all)")
    ap.add_argument("--examples", default=str(ITEM4_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--lam", type=float, help="mm1 / mmm: arrival rate lambda [1/h]")
    ap.add_argument("--te", type=float, help="mm1 / mmm: mean process time [min]")
    ap.add_argument("--m", type=int, help="mmm / gg / breakdown / curve: parallel machines")
    ap.add_argument("--u", type=float, help="gg / breakdown: utilisation; setup: utilisation at the largest Ns")
    ap.add_argument("--t0", type=float, help="gg: process time without failures [min]")
    ap.add_argument("--c0", type=float, help="gg: process time variability c0")
    ap.add_argument("--ca", type=float, help="gg / setup: arrival variability ca")
    ap.add_argument("--mttf", type=float, help="gg: MTTF [min] (0 = no breakdowns)")
    ap.add_argument("--mttr", type=float, help="gg: MTTR [min]")
    ap.add_argument("--cr", type=float, help="gg: repair time variability cr (1 = exponential)")
    ap.add_argument("--rate", type=float, help="setup: arrival rate [parts/h] for u and Wq")
    ap.add_argument("--step", type=float, default=0.05, help="curve: step of u (default 0.05)")
    ap.add_argument("--csv", help="setup / curve: write the table to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    data, _ = load_examples(a.examples, "queue")
    for sec in ("mm1", "mmm", "queue", "setup_var"):
        if sec not in data:
            raise InputError(f"section '{sec}' is missing in the JSON")
    q = dict(data["queue"])
    q.setdefault("cr", 1.0)
    for k in ("t0", "c0", "ca", "mttf", "mttr", "cr", "m"):
        if getattr(a, k) is not None:
            q[k] = getattr(a, k)
    u = q["u"] if a.u is None or a.cmd == "setup" else a.u
    if not 0 < u < 1:
        raise InputError("--u must be between 0 and 1")
    if a.step <= 0 or a.step > 0.67:
        raise InputError("--step must be in (0, 0.67]")
    show = (lambda c: a.cmd in (c, "all"))
    blocks = []
    if show("mm1"):
        d = dict(data["mm1"])
        if a.lam is not None:
            d["lambda_per_h"] = a.lam
        if a.te is not None:
            d["te_min"] = a.te
        blocks.append(lambda: show_mm1(d))
    if show("mmm"):
        d2 = dict(data["mmm"])
        if a.lam is not None:
            d2["lambda_per_h"] = a.lam
        if a.te is not None:
            d2["te_min"] = a.te
        if a.m is not None:
            d2["m"] = a.m
        blocks.append(lambda: show_mmm(d2))
    if show("gg"):
        blocks.append(lambda: show_gg(q, u))
    if show("breakdown"):
        blocks.append(lambda: show_breakdown(q, u))
    if show("setup"):
        sv = data["setup_var"]
        ra = None
        if a.rate is not None:
            if a.rate <= 0:
                raise InputError("--rate must be > 0")
            ra = a.rate / 60
        elif a.u is not None and a.cmd == "setup":
            ra = a.u / setup_table(sv)[-1]["te"]
        blocks.append(lambda: show_setup(sv, ra, q["ca"], a.csv if a.cmd == "setup" else None))
    if show("curve"):
        blocks.append(lambda: show_curve(q, a.step, a.csv if a.cmd == "curve" else None))
    for k, b in enumerate(blocks):
        if k:
            print()
        b()
    return 0


if __name__ == "__main__":
    run_main(main)
