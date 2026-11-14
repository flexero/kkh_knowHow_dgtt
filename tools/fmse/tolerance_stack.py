#!/usr/bin/env python3
"""Hand-over tolerance stack: will the pallet / carrier find its place? (item 3, section 3C)

Python 3 standard library only, offline. Formula = "_formulas.stack" in examples/item3_examples.json,
same logic as the web page (web/fmse3.js, 3C):
  worst case  WC  = sum |t_i|
  statistical RSS = sqrt(sum t_i^2)        (all contributors independent, normal)
  verdict: capture >= WC -> safe;  RSS <= capture < WC -> risk;  capture < RSS -> not OK
  largest contributor = the one to reduce first
  coarse-to-fine catching: guides / funnels -> cones / tapered pins -> locating pins / zero-point
Tolerances are +/- values in mm. Default contributors = JSON "stack".

Your own contributors: --csv file with two columns  name;tolerance  (header line optional, ';' or ',').

Optional --montecarlo N: draws every contributor as normal with sigma = t/3, adds them and reports the
share of hand-overs outside the capture range. This is an extra check only; it is NOT part of the
numbers that the guide, the web page and this tool cross-check.
"""

import argparse
import csv
import math
import random
from pathlib import Path

from fmse_common import ITEM3_EXAMPLES, InputError, SelfTest, fmt_table, fmt_web, load_examples, run_main, text_bar


def stack(contrib, capture, final=0.02):
    """Return dict with WC, RSS, verdict key/text, largest contributor, stage texts."""
    if not contrib:
        raise InputError("no contributors given")
    ts = [abs(float(t)) for _, t in contrib]
    wc = sum(ts)
    rss = math.sqrt(sum(t * t for t in ts))
    if capture < 0:
        raise InputError("capture range must be >= 0")
    fin = final or 0.01                       # web: +fe3Fin.value || 0.01
    key = "safe" if capture >= wc else "risk" if capture >= rss else "no"
    text = {"safe": "safe (≥ worst case)",
            "risk": "only statistical – rare misses possible, add monitoring + retry",
            "no": "too small – the pallet will miss"}[key]
    order = sorted(range(len(contrib)), key=lambda i: -ts[i])      # stable: first of equal values wins
    big = order[0]
    # how much the largest contributor must shrink so that the worst case fits the capture range
    need = wc - capture
    big_to = ts[big] - need if need > 0 else ts[big]
    return {"wc": wc, "rss": rss, "key": key, "text": text, "big": big, "big_name": contrib[big][0],
            "big_t": ts[big], "ts": ts, "fin": fin, "stage1": max(wc, capture), "need": need, "big_to": big_to}


def monte_carlo(ts, capture, n, seed):
    """Share of hand-overs with |sum of errors| > capture; each error ~ N(0, t/3)."""
    if n <= 0:
        raise InputError("--montecarlo N must be > 0")
    rnd = random.Random(seed)
    sig = [t / 3 for t in ts]
    out = 0
    mx = 0.0
    for _ in range(n):
        e = sum(rnd.gauss(0.0, s) for s in sig)
        mx = max(mx, abs(e))
        if abs(e) > capture:
            out += 1
    # analytic value for comparison: total sigma = RSS/3
    st = math.sqrt(sum(s * s for s in sig))
    p = math.erfc(capture / (st * math.sqrt(2))) if st > 0 else 0.0
    return {"n": n, "out": out, "share": out / n, "max": mx, "sigma": st, "p_normal": p}


def read_csv(path):
    p = Path(path)
    if not p.is_file():
        raise InputError(f"File not found: {p}")
    text = p.read_text(encoding="utf-8-sig")
    delim = ";" if ";" in text else ","
    rows = []
    for k, r in enumerate(csv.reader(text.splitlines(), delimiter=delim), start=1):
        if not r or not "".join(r).strip() or r[0].strip().startswith("#"):
            continue
        if len(r) < 2:
            raise InputError(f"{p} line {k}: need two columns name;tolerance")
        try:
            t = float(r[1].replace(",", ".") if delim == ";" else r[1])
        except ValueError:
            if not rows and k == 1:
                continue                     # header line
            raise InputError(f"{p} line {k}: tolerance '{r[1]}' is not a number")
        rows.append([r[0].strip(), t])
    if not rows:
        raise InputError(f"{p}: no contributors found")
    return rows


def show(contrib, capture, final):
    r = stack(contrib, capture, final)
    print(f"HAND-OVER TOLERANCE STACK   {len(contrib)} contributors, capture range of the first guide ± "
          f"{fmt_web(capture, 2)} mm, final location ± {fmt_web(r['fin'], 3)} mm")
    rows = [[n, f"± {r['ts'][i]:g}", f"{r['ts'][i] ** 2:g}", f"{100 * r['ts'][i] ** 2 / r['rss'] ** 2:.1f} %" if r['rss'] else "-",
             text_bar(r["ts"][i], r["big_t"], 20)] for i, (n, _) in enumerate(contrib)]
    print(fmt_table(["contributor", "t mm", "t²", "share of RSS²", ""], rows, "lrrrl"))
    print()
    ts = r["ts"]
    print(f"Worst case = Σ |tᵢ|  = {' + '.join(f'{t:g}' for t in ts)} = ± {fmt_web(r['wc'], 2)} mm")
    print(f"Statistical (RSS) = √Σ tᵢ² = √{sum(t * t for t in ts):g} = ± {fmt_web(r['rss'], 2)} mm "
          f"(all contributors independent, normal)")
    mark = {"safe": "OK", "risk": "RISK", "no": "NOT OK"}[r["key"]]
    print(f"Capture range ± {fmt_web(capture, 2)} mm -> {mark}: {r['text']}")
    print(f"Largest contributor: {r['big_name']} (± {fmt_web(r['big_t'], 1)} mm) – reduce this first")
    if r["key"] != "safe":
        if r["big_to"] > 0:
            print(f"  To be safe (WC ≤ capture) reduce it from ± {r['big_t']:g} to ± {r['big_to']:g} mm "
                  f"(−{r['need']:g} mm), or make the first guide catch ± {fmt_web(r['wc'], 2)} mm.")
        else:
            print(f"  Reducing only this contributor is not enough (WC exceeds the capture by {r['need']:g} mm): "
                  f"make the first guide catch ± {fmt_web(r['wc'], 2)} mm.")
    print()
    print("Coarse-to-fine catching (stages)")
    print(f"  1. Coarse guides / rollers / funnels catch ± {fmt_web(r['stage1'], 1)} mm -> bring the error to ≈ ± 2–3 mm")
    print("  2. Cones / tapered pins catch ± 2–3 mm -> ≈ ± 0.1–0.2 mm")
    print(f"  3. Locating pins / zero-point / Hirth coupling -> final ± {fmt_web(r['fin'], 3)} mm (clamped)")
    print("  Each stage's capture range must be larger than the error left by the stage before.")
    print("  Precision comes from the station, never from the vehicle (an AGV stops only ± 5–10 mm).")
    return r


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("tolerance_stack")
    data, st = load_examples(path, "stack")
    r = stack(st["contributors"], st["capture_mm"], st["final_mm"])
    t.close("WC = 8+3+2+1+1.5 = 15.5", r["wc"], 15.5, 1e-12)
    t.close("RSS = sqrt(80.25) = 8.958236", r["rss"], 8.9582364, 1e-6)
    t.equal("verdict risk (8.96 <= 12 < 15.5)", r["key"], "risk")
    t.equal("largest = AGV stop position", r["big_name"], "AGV stop position (navigation)")
    t.close("reduce largest to 8 - 3.5 = 4.5", r["big_to"], 4.5, 1e-12)
    t.close("stage 1 catches max(15.5, 12)", r["stage1"], 15.5, 1e-12)
    t.equal("capture 16 -> safe", stack(st["contributors"], 16)["key"], "safe")
    t.equal("capture 15.5 = WC -> safe (>=)", stack(st["contributors"], 15.5)["key"], "safe")
    t.equal("capture 8 -> no", stack(st["contributors"], 8)["key"], "no")
    t.close("final 0 -> 0.01 (web rule)", stack(st["contributors"], 12, 0)["fin"], 0.01, 1e-12)
    t.close("negative tolerance counted as |t|", stack([["a", -3], ["b", 4]], 6)["rss"], 5.0, 1e-12)
    mc = monte_carlo(r["ts"], 3.0, 20000, 1)        # sigma total = 2.986; P(|e|>3) = erfc(1.0046/sqrt2) ~ 0.315
    t.close("Monte Carlo share near normal theory (capture 3 mm)", mc["share"], mc["p_normal"], 0.015)
    t.equal("Monte Carlo reproducible with the same seed", monte_carlo(r["ts"], 3.0, 2000, 7)["out"],
            monte_carlo(r["ts"], 3.0, 2000, 7)["out"])
    try:
        stack([], 1)
        t.true("empty stack rejected", False)
    except InputError:
        t.true("empty stack rejected", True)
    return t.finish()


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/tolerance_stack.py\n"
               "  python tools/fmse/tolerance_stack.py --capture 16\n"
               "  python tools/fmse/tolerance_stack.py --csv my_stack.csv --capture 10 --final 0.01\n"
               "  python tools/fmse/tolerance_stack.py --montecarlo 100000 --seed 1")
    ap.add_argument("--examples", default=str(ITEM3_EXAMPLES), help="item-3 example JSON (default: %(default)s)")
    ap.add_argument("--csv", help="your contributors: CSV name;tolerance (± mm)")
    ap.add_argument("--capture", type=float, help="capture range of the first guide ± mm (default JSON capture_mm)")
    ap.add_argument("--final", type=float, help="final location needed ± mm (default JSON final_mm)")
    ap.add_argument("--montecarlo", type=int, metavar="N", help="extra: Monte Carlo with N hand-overs (not cross-checked)")
    ap.add_argument("--seed", type=int, default=1, help="random seed for --montecarlo (default 1)")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, st = load_examples(a.examples, "stack")
    contrib = read_csv(a.csv) if a.csv else st["contributors"]
    cap = st["capture_mm"] if a.capture is None else a.capture
    fin = st["final_mm"] if a.final is None else a.final
    r = show(contrib, cap, fin)
    if a.montecarlo is not None:
        mc = monte_carlo(r["ts"], cap, a.montecarlo, a.seed)
        print()
        print(f"EXTRA - Monte Carlo (NOT part of the cross-check numbers): {mc['n']} hand-overs, seed {a.seed}, "
              f"each error normal with σ = t/3")
        print(f"  outside ± {cap:g} mm: {mc['out']} of {mc['n']} = {100 * mc['share']:.4f} %   "
              f"(normal theory with σ_total = RSS/3 = {mc['sigma']:.3f} mm: {100 * mc['p_normal']:.4f} %)")
        print(f"  largest error drawn: ± {mc['max']:.2f} mm.  Real errors are often not normal (e.g. AGV stop "
              f"is closer to uniform) - use WC for safety.")
    return 0


if __name__ == "__main__":
    run_main(main)
