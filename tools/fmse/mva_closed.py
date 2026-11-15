#!/usr/bin/env python3
"""Closed queueing network of an FMS: exact Mean Value Analysis (MVA, Seidmann for parallel servers)
and the closed laws of Factory Physics (best case, practical worst case, worst case).

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item4_examples.json.

Input (section "mva"): stations [name, servers m, demand D per pallet loop in minutes].
A pallet circulates for ever: load station -> vehicle -> machine -> vehicle -> load station ...
N pallets are in the loop (closed system: a finished pallet is loaded again at once).

MVA with Seidmann (exact for exponential times and one server per station):
    a station with m servers and demand D = one single-server queue with D/m + a pure delay D*(m-1)/m
    Q_k(0) = 0 ; for n = 1..N:
        R_k(n) = (D_k/m_k)*(1 + Q_k(n-1))          queue part
        R_d    = D_k*(m_k-1)/m_k                   delay part (no waiting)
        X(n)   = n / sum_k (R_k(n) + R_d)          [pallets/min] ; report *60 = pallets/h
        Q_k(n) = X(n)*R_k(n)
    station residence = R_k + R_d ; pallets at the station = X*(R_k + R_d) ; loop time = n/X (Little)
Closed laws:
    rb = min_k m_k/D_k (bottleneck rate) ; T0 = sum_k D_k (raw loop time) ; W0 = rb*T0 (critical WIP)
    TH_best(N) = min(N/T0, rb) ; TH_pwc(N) = N/(W0 + N - 1)*rb ; TH_worst(N) = 1/T0
"""

import argparse
import csv
from pathlib import Path

from fmse_common import (ITEM4_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main, text_bar,
                         write_csv)


# ----------------------------------------------------------------------------- formulas
def check_stations(st):
    if not st:
        raise InputError("mva: no stations")
    out = []
    for i, s in enumerate(st, 1):
        if not isinstance(s, (list, tuple)) or len(s) < 3:
            raise InputError(f"mva station {i}: need [name, servers, demand]")
        name, m, d = str(s[0]), s[1], s[2]
        try:
            m, d = float(m), float(d)
        except (TypeError, ValueError):
            raise InputError(f"mva station {name}: servers and demand must be numbers")
        if m < 1 or int(m) != m:
            raise InputError(f"mva station {name}: servers must be a whole number >= 1")
        if d <= 0:
            raise InputError(f"mva station {name}: demand must be > 0")
        out.append((name, int(m), d))
    return out


def mva(stations, n_max):
    """Exact MVA with Seidmann. Returns a list of dicts for n = 1..n_max (minutes, X in pallets/min)."""
    st = check_stations(stations)
    if n_max < 1:
        raise InputError("N must be >= 1")
    dq = [d / m for _, m, d in st]
    dd = [d * (m - 1) / m for _, m, d in st]
    q = [0.0] * len(st)
    rows = []
    for n in range(1, n_max + 1):
        rq = [dq[k] * (1 + q[k]) for k in range(len(st))]
        x = n / (sum(rq) + sum(dd))
        q = [x * r for r in rq]
        res = [rq[k] + dd[k] for k in range(len(st))]
        rows.append({"n": n, "R": res, "Rq": rq, "X": x, "Q": [x * r for r in res], "Qq": q[:],
                     "loop": n / x})
    return rows


def closed_laws(stations):
    st = check_stations(stations)
    rates = [(name, m / d) for name, m, d in st]
    bn = min(rates, key=lambda r: r[1])
    t0 = sum(d for _, _, d in st)
    w0 = bn[1] * t0
    return {"rates": rates, "bn": bn[0], "rb": bn[1], "T0": t0, "W0": w0,
            "best": lambda n: min(n / t0, bn[1]), "pwc": lambda n: n / (w0 + n - 1) * bn[1],
            "worst": lambda n: 1 / t0}


def n_for_share(stations, share=0.95, limit=2000):
    """Smallest N with X_MVA(N) >= share*rb (None if not reached up to limit)."""
    rb = closed_laws(stations)["rb"]
    for r in mva(stations, limit):
        if r["X"] >= share * rb - 1e-12:
            return r["n"], r["X"]
    return None, None


def read_stations_csv(path):
    """CSV with columns name;servers;demand_min (header optional, ';' or ',')."""
    p = Path(path)
    if not p.is_file():
        raise InputError(f"File not found: {p}")
    text = p.read_text(encoding="utf-8-sig")
    delim = ";" if ";" in text.splitlines()[0] else ","
    out = []
    for k, row in enumerate(csv.reader(text.splitlines(), delimiter=delim), 1):
        if not row or not "".join(row).strip() or row[0].strip().startswith("#"):
            continue
        if len(row) < 3:
            raise InputError(f"{p} line {k}: need name;servers;demand_min")
        try:
            out.append([row[0].strip(), float(row[1]), float(row[2])])
        except ValueError:
            if k == 1:
                continue                                    # header line
            raise InputError(f"{p} line {k}: servers and demand must be numbers")
    return out


# ----------------------------------------------------------------------------- report
def show(stations, n_max, csv_path=None):
    st = check_stations(stations)
    rows = mva(stations, n_max)
    cl = closed_laws(stations)
    short = [s[0].split(" (")[0] for s in st]
    print("CLOSED NETWORK - STATIONS PER PALLET LOOP")
    print(fmt_table(["station", "servers", "demand D min", "Seidmann queue D/m", "delay D(m-1)/m", "rate m/D per h"],
                    [[n, m, f"{d:g}", f"{d/m:.4f}", f"{d*(m-1)/m:.4f}", f"{m/d*60:.4f}"] for n, m, d in st]))
    print()
    print(f"MVA (exact, Seidmann)  N = 1..{n_max}   R = residence time per visit [min], Q = pallets at the station")
    hdr = ["n"] + [f"R {s}" for s in short] + ["X pal/h", "loop min"] + [f"Q {s}" for s in short]
    tab = []
    for r in rows:
        tab.append([r["n"]] + [f"{x:.2f}" for x in r["R"]] + [f"{r['X']*60:.4f}", f"{r['loop']:.2f}"]
                   + [f"{x:.2f}" for x in r["Q"]])
    print(fmt_table(hdr, tab))
    print()
    print("CLOSED LAWS (Factory Physics)")
    print("  rates m/D: " + " · ".join(f"{n.split(' (')[0]} {r*60:.4f}/h" for n, r in cl["rates"]))
    print(f"  rb = {cl['rb']*60:.4f} pallets/h ({cl['bn'].split(' (')[0]})   T0 = {cl['T0']:g} min   W0 = rb*T0 = {cl['W0']:.4f} pallets")
    print()
    tab2 = []
    for r in rows:
        n = r["n"]
        tab2.append([n, f"{cl['worst'](n)*60:.4f}", f"{cl['pwc'](n)*60:.4f}", f"{r['X']*60:.4f}",
                     f"{cl['best'](n)*60:.4f}", f"{r['X']/cl['rb']*100:.1f}",
                     text_bar(r["X"], cl["rb"], 30)])
    print(fmt_table(["N", "worst", "PWC", "MVA", "best", "MVA % of rb", "MVA (# = rb/30)"], tab2, "rrrrrrl"))
    n95, x95 = n_for_share(stations, 0.95)
    if n95:
        print(f"\nPallets for 95 % of rb: N = {n95} (X = {x95*60:.4f} pallets/h = {x95/cl['rb']*100:.1f} % of rb)")
    print("Below W0 the bottleneck waits for pallets; above it extra pallets only add waiting (loop time = N/X).")
    print("MVA is exact for exponential times; real (less variable) times give a little more throughput -")
    print("check with the simulation (fms_sim.py --sweep).")
    if csv_path:
        p = write_csv(csv_path, ["n"] + [f"R_{s}" for s in short] + ["X_per_h", "loop_min"] + [f"Q_{s}" for s in short]
                      + ["TH_worst", "TH_pwc", "TH_best"],
                      [[r["n"]] + [round(x, 6) for x in r["R"]] + [round(r["X"] * 60, 6), round(r["loop"], 6)]
                       + [round(x, 6) for x in r["Q"]]
                       + [round(cl["worst"](r["n"]) * 60, 6), round(cl["pwc"](r["n"]) * 60, 6),
                          round(cl["best"](r["n"]) * 60, 6)] for r in rows])
        print(f"CSV written: {p}")
    return rows, cl


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("mva_closed")
    _, d = load_examples(path, "mva")
    st = d["stations"]
    rows = mva(st, 15)
    cl = closed_laws(st)
    # hand check n = 1: R = D for every station, X = 1/T0
    t.close("T0 = 12 + 3 + 60.48", cl["T0"], 75.48, 1e-12)
    t.close("X(1) = 1/T0", rows[0]["X"], 1 / 75.48, 1e-15)
    # n = 2 by hand: Q(1) = X(1)*Rq ; R(2) = Dq*(1+Q(1))
    x1 = 1 / 75.48
    rq2 = [12 * (1 + 12 * x1), 3 * (1 + 3 * x1), 20.16 * (1 + 20.16 * x1)]
    x2 = 2 / (sum(rq2) + 40.32)
    t.close("X(2) by hand", rows[1]["X"], x2, 1e-15)
    t.close("rb = 3/60.48 per min (machines)", cl["rb"], 3 / 60.48, 1e-15)
    t.equal("bottleneck = machines", cl["bn"].startswith("Machines"), True)
    t.close("W0 = rb*T0 = 3.744", cl["W0"], 3 / 60.48 * 75.48, 1e-12)
    t.close("PWC(1) = 1/T0", cl["pwc"](1), 1 / 75.48, 1e-15)
    t.close("best(15) = rb", cl["best"](15), cl["rb"], 1e-15)
    ok = all(cl["worst"](r["n"]) - 1e-12 <= r["X"] <= cl["best"](r["n"]) + 1e-12 for r in rows)
    t.true("worst <= X_MVA <= best for N = 1..15", ok)
    ok = all(rows[k]["X"] > rows[k - 1]["X"] for k in range(1, 15))
    t.true("X_MVA rises with N", ok)
    t.true("Little: sum Q = N for every N", all(abs(sum(r["Q"]) - r["n"]) < 1e-9 for r in rows))
    t.true("X_MVA(15) < rb", rows[-1]["X"] < cl["rb"])
    t.true("X_MVA >= PWC for N >= 2 (exponential network, balanced-ish)",
           all(r["X"] >= cl["pwc"](r["n"]) - 1e-12 for r in rows))
    # single station, single server: X(N) = 1/D for every N
    t.close("one server only: X = 1/D", mva([["M", 1, 5]], 4)[-1]["X"], 0.2, 1e-15)
    # two equal single-server stations D: X(N) = N/((N+1)*D) (balanced network, exact)
    t.close("balanced 2 stations: X(3) = 3/(4*D)", mva([["a", 1, 10], ["b", 1, 10]], 3)[-1]["X"], 3 / 40, 1e-15)
    n95, _ = n_for_share(st, 0.95)
    t.true("pallets for 95 % of rb found and > W0", n95 is not None and n95 > cl["W0"])
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/mva_closed.py                  (N = 1..15, example FMS)\n"
               "  python tools/fmse/mva_closed.py --N 30 --csv mva.csv\n"
               "  python tools/fmse/mva_closed.py --stations my_stations.csv   (name;servers;demand_min)")
    ap.add_argument("--examples", default=str(ITEM4_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--N", type=int, help="largest number of pallets (default: N_max of the JSON, 15)")
    ap.add_argument("--stations", help="CSV file name;servers;demand_min instead of the JSON stations")
    ap.add_argument("--csv", help="write the MVA + closed-law table to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, d = load_examples(a.examples, "mva")
    st = read_stations_csv(a.stations) if a.stations else d.get("stations")
    n = a.N if a.N is not None else int(d.get("N_max", 15))
    if n < 1 or n > 2000:
        raise InputError("--N must be between 1 and 2000")
    show(st, n, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
