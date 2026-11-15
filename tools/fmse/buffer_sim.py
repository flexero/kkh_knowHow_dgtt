#!/usr/bin/env python3
"""Buffer between two machines: discrete-event simulation of a 2-machine line with random breakdowns.

Python 3 standard library only, offline. Port of runLine() in web/fmse4.js (card 4C of the web page),
with the same random generator (mulberry32), the same lognormal process times (Box-Muller) and the same
time-based failures (the failure clock runs only while a machine works).

Model (section "buffer_line"):
    M1 -> buffer (B places) -> M2. M1 never starves (raw material always there), M2 never blocks.
    process time  = lognormal(mean t1 or t2, cv)
    failures      = time to failure exponential(MTTF) of working time, repair exponential(MTTR)
    M1 is BLOCKED when it finishes a part, M2 is busy and the buffer is full (B = 0: no place at all).
    TH = parts finished by M2 / T * 60   [parts/h], T = T_min (no warm-up, the line starts empty)
Replications: seeds 1..R (default R = 10), mean, sample std s, half width = t_{R-1,0.975}*s/sqrt(R)
(t_9 = 2.262), CI = mean +/- half width.
Limit       = min(A/t1, A/t2)*60 with A = MTTF/(MTTF+MTTR)  (slowest machine alone, with its breakdowns)
Rule of thumb buffer = MTTR / min(t1, t2) = parts made during one average repair.

The web page shows the mean of the seeds 11 and 23 (--seeds 11,23 gives the same pair here). Python and
the browser use the same random stream, but log/cos/exp of the two math libraries can differ in the
last bit, so long runs may drift apart: compare the 10-replication means and CIs (statistically).
"""

import argparse

from fmse_common import (ITEM4_EXAMPLES, InputError, Mulberry32, SelfTest, expo, fmt_ci, fmt_table, load_examples,
                         logn, mean_ci, parse_float_list, run_main, text_bar, with_failures, write_csv)

INF = float("inf")


# ----------------------------------------------------------------------------- simulation (port of runLine)
def run_line(B, p, seed):
    """One replication. p = dict(t1, t2, cv, mf, mr, T). Returns TH in parts/h."""
    R = Mulberry32(seed)
    T = p["T"]
    m1 = {"ttf": expo(R, p["mf"])}
    m2 = {"ttf": expo(R, p["mf"])}

    def dur(mc, tt):
        return with_failures(R, mc, logn(R, tt, p["cv"]), p["mf"], p["mr"])[0]

    t, buf, done = 0.0, 0, 0
    t1, t2, blocked = dur(m1, p["t1"]), INF, False
    while True:
        tn = min(t1, t2)
        if tn > T:
            break
        t = tn
        if t1 <= t2:                                   # M1 finished a part
            if t2 == INF:
                t2 = t + dur(m2, p["t2"])
                t1 = t + dur(m1, p["t1"])
            elif buf < B:
                buf += 1
                t1 = t + dur(m1, p["t1"])
            else:
                blocked = True
                t1 = INF
        else:                                          # M2 finished a part
            done += 1
            if buf > 0:
                buf -= 1
                t2 = t + dur(m2, p["t2"])
            else:
                t2 = INF
            if blocked:
                blocked = False
                if t2 == INF:
                    t2 = t + dur(m2, p["t2"])
                else:
                    buf += 1
                t1 = t + dur(m1, p["t1"])
    return done / T * 60


def params(bl):
    for k in ("t1", "t2", "cv", "mttf", "mttr", "T_min"):
        if k not in bl:
            raise InputError(f"buffer_line: value '{k}' is missing")
    p = {"t1": float(bl["t1"]), "t2": float(bl["t2"]), "cv": float(bl["cv"]), "mf": float(bl["mttf"]),
         "mr": float(bl["mttr"]), "T": float(bl["T_min"])}
    if p["t1"] <= 0 or p["t2"] <= 0 or p["T"] <= 0:
        raise InputError("buffer_line: t1, t2 and T_min must be > 0")
    if p["cv"] < 0 or p["mf"] < 0 or p["mr"] < 0:
        raise InputError("buffer_line: cv, MTTF and MTTR must be >= 0")
    return p


def limit_rate(p):
    A = p["mf"] / (p["mf"] + p["mr"]) if p["mf"] > 0 else 1.0
    return min(A / p["t1"], A / p["t2"]) * 60, A


def table(p, Bs, seeds):
    lim, _ = limit_rate(p)
    rows = []
    for B in Bs:
        th = [run_line(B, p, s) for s in seeds]
        st = mean_ci(th)
        rows.append({"B": B, "th": th, "st": st, "pct": st["mean"] / lim})
    return rows, lim


# ----------------------------------------------------------------------------- report
def show(p, Bs, seeds, csv_path=None):
    rows, lim = table(p, Bs, seeds)
    _, A = limit_rate(p)
    print(f"TWO MACHINES WITH A BUFFER  t1 = {p['t1']:g}, t2 = {p['t2']:g} min, cv = {p['cv']:g}, "
          f"MTTF = {p['mf']:g}, MTTR = {p['mr']:g} min, T = {p['T']:g} min per run")
    print(f"  replications: {len(seeds)} (seeds {seeds[0]}..{seeds[-1]})" if seeds == list(range(seeds[0], seeds[0] + len(seeds)))
          else f"  replications: {len(seeds)} (seeds {', '.join(map(str, seeds))})")
    print(f"  limit = min(A/t1, A/t2)*60 = {lim:.3f} parts/h   (A = {A:.4f})")
    print()
    tab = []
    for r in rows:
        tab.append([r["B"], fmt_ci(r["st"], 2), f"{r['st']['lo']:.2f} .. {r['st']['hi']:.2f}",
                    f"{r['pct']*100:.1f}", text_bar(r["st"]["mean"], lim, 30)])
    print(fmt_table(["B places", "TH parts/h (mean ± 95 % hw)", "95 % CI", "% of limit", "(# = limit/30)"], tab, "rrrrl"))
    b95 = next((r["B"] for r in rows if r["st"]["mean"] >= 0.95 * lim), None)
    thumb = p["mr"] / min(p["t1"], p["t2"])
    print()
    print(f"Places for 95 % of the limit (mean): {b95 if b95 is not None else '> ' + str(max(Bs))}")
    print(f"Rule of thumb: buffer = MTTR / cycle = {p['mr']:g} / {min(p['t1'], p['t2']):g} = {thumb:.1f} parts "
          "(parts made during one average repair)")
    print("Without a buffer every stop of one machine stops the other (availabilities multiply). More places give")
    print("less and less, but cost space and WIP. In an FMS the pallet pool IS the buffer.")
    if csv_path:
        pth = write_csv(csv_path, ["B", "TH_mean", "half_width", "CI_low", "CI_high", "share_of_limit"]
                        + [f"seed_{s}" for s in seeds],
                        [[r["B"], round(r["st"]["mean"], 6), round(r["st"]["hw"], 6), round(r["st"]["lo"], 6),
                          round(r["st"]["hi"], 6), round(r["pct"], 6)] + [round(x, 6) for x in r["th"]] for r in rows])
        print(f"CSV written: {pth}")
    return rows, lim


# ----------------------------------------------------------------------------- self-test
def js_rng_literal(seed):
    """Second, literal emulation of the JS code (signed int32, ToInt32 / ToUint32) to cross-check Mulberry32."""
    def i32(x):
        x &= 0xFFFFFFFF
        return x - 0x100000000 if x >= 0x80000000 else x

    def u32(x):
        return x & 0xFFFFFFFF

    def imul(x, y):
        return i32(i32(x) * i32(y))

    a = [u32(seed)]

    def R():
        a[0] = u32(a[0] + 0x6D2B79F5)
        t = a[0]
        t = imul(i32(t) ^ (u32(t) >> 15), i32(t) | 1)
        t = i32(t ^ i32(t + imul(i32(t) ^ (u32(t) >> 7), i32(t) | 61)))
        return u32(t ^ (u32(t) >> 14)) / 4294967296
    return R


def selftest(path):
    t = SelfTest("buffer_sim")
    _, bl = load_examples(path, "buffer_line")
    p = params(bl)
    for seed in (1, 7, 11, 23, 4294967295):
        a, b = Mulberry32(seed), js_rng_literal(seed)
        t.true(f"mulberry32 = literal JS int32 emulation, seed {seed}, 2000 numbers",
               all(a() == b() for _ in range(2000)))
    R = Mulberry32(1)
    xs = [R() for _ in range(20000)]
    t.true("uniform in [0, 1)", min(xs) >= 0 and max(xs) < 1)
    t.close("uniform mean ~ 0.5", sum(xs) / len(xs), 0.5, 0.01)
    R = Mulberry32(3)
    ln = [logn(R, 10, 0.3) for _ in range(20000)]
    m = sum(ln) / len(ln)
    sd = (sum((x - m) ** 2 for x in ln) / (len(ln) - 1)) ** 0.5
    t.close("lognormal mean 10 (+/- 1 %)", m, 10, 0.1)
    t.close("lognormal cv 0.3 (+/- 0.01)", sd / m, 0.3, 0.01)
    t.equal("same seed -> same result", run_line(3, p, 5), run_line(3, p, 5))
    t.true("other seed -> other result", run_line(3, p, 5) != run_line(3, p, 6))
    det = dict(p, cv=0.0, mf=0.0, mr=0.0, T=1000.0)
    t.close("no variability, no failures, t1 = t2 = 1: TH = 999 parts in 1000 min", run_line(0, det, 1), 999 / 1000 * 60, 1e-9)
    t.close("no variability, M2 twice as slow: TH = 499 parts in 1000 min",
            run_line(2, dict(det, t2=2.0), 1), 499 / 1000 * 60, 1e-9)
    lim, A = limit_rate(p)
    t.close("limit = 100/110*60 = 54.545 parts/h", lim, 100 / 110 * 60, 1e-12)
    rows, _ = table(p, [0, 10, 20], list(range(1, 11)))
    m0, m10, m20 = (r["st"]["mean"] for r in rows)
    t.true(f"TH(B=0) {m0:.2f} < TH(B=10) {m10:.2f} < TH(B=20) {m20:.2f}", m0 < m10 < m20)
    t.true(f"every mean below the limit {lim:.2f} (+ CI)", all(r["st"]["lo"] <= lim for r in rows))
    t.true(f"no buffer loses > 5 % of the limit ({m0/lim*100:.1f} %)", m0 < 0.95 * lim)
    nf = mean_ci([run_line(50, dict(p, mf=0.0, mr=0.0), s) for s in range(1, 6)])["mean"]
    t.true(f"no failures, cv 0.3, B = 50: TH {nf:.2f} within 2 % of 60/h", abs(nf - 60) < 1.2)
    t.true(f"B=20 reaches > 93 % of the limit ({m20/lim*100:.1f} %)", m20 > 0.93 * lim)
    t.true("half widths small (< 2 % of mean)", all(r["st"]["hw"] < 0.02 * r["st"]["mean"] for r in rows))
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/buffer_sim.py                       (B values of the JSON, 10 replications)\n"
               "  python tools/fmse/buffer_sim.py --B 0,1,2,5,10,20 --reps 20\n"
               "  python tools/fmse/buffer_sim.py --seeds 11,23          (the two seeds of the web page)\n"
               "  python tools/fmse/buffer_sim.py --mttr 30 --csv buffer.csv")
    ap.add_argument("--examples", default=str(ITEM4_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--B", help="buffer sizes, comma list (default: B_values of the JSON)")
    ap.add_argument("--reps", type=int, default=10, help="replications with seeds 1..reps (default 10)")
    ap.add_argument("--seeds", help="explicit seeds, comma list (overrides --reps)")
    for k, h in (("t1", "cycle M1 [min]"), ("t2", "cycle M2 [min]"), ("cv", "cycle variability"),
                 ("mttf", "MTTF of each machine [min]"), ("mttr", "MTTR of each machine [min]"),
                 ("T", "simulated minutes per run")):
        ap.add_argument("--" + k, type=float, help=h)
    ap.add_argument("--csv", help="write the table (with every replication) to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, bl = load_examples(a.examples, "buffer_line")
    bl = dict(bl)
    for k, j in (("t1", "t1"), ("t2", "t2"), ("cv", "cv"), ("mttf", "mttf"), ("mttr", "mttr"), ("T", "T_min")):
        if getattr(a, k) is not None:
            bl[j] = getattr(a, k)
    p = params(bl)
    Bs = parse_float_list(a.B, "--B") if a.B else bl.get("B_values", [0, 1, 2, 5, 10, 20])
    if any(b < 0 or int(b) != b for b in Bs):
        raise InputError("--B must be whole numbers >= 0")
    Bs = [int(b) for b in Bs]
    if a.seeds:
        seeds = parse_float_list(a.seeds, "--seeds")
        if any(s < 0 or int(s) != s for s in seeds):
            raise InputError("--seeds must be whole numbers >= 0")
        seeds = [int(s) for s in seeds]
    else:
        if a.reps < 1 or a.reps > 1000:
            raise InputError("--reps must be between 1 and 1000")
        seeds = list(range(1, a.reps + 1))
    show(p, Bs, seeds, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
