#!/usr/bin/env python3
"""Generic closed-loop FMS: discrete-event simulation with replications and confidence intervals,
pallet sweep next to MVA and the closed laws, Welch warm-up curve.

Python 3 standard library only, offline. Port of simFMS() in web/fmse4.js (card 4E of the web page):
same event logic, same random generator (mulberry32), same lognormal (Box-Muller) and exponential samples,
same warm-up rule and the same statistics.

Model (section "fms_sim"):
    N pallets circulate:  load station -> vehicle -> machine -> vehicle -> load station -> ...
    L load stations   : load / unload time lognormal(load, loadCv); the part type is drawn at loading
                        (mix % of section "parts": [name, mix %, machining min, cv])
    V vehicles        : fixed time 'move' per move (2 moves per loop)
    m machines        : identical, any part; machining lognormal(mean, cv) of the type; time-based
                        failures: time to failure exponential(MTTF) of busy time, repair exponential(MTTR)
    dispatching       : FIFO or SPT (shortest mean machining time of the type first)
    run length        : T = days*1440 min ; warm-up = min(10 % of T, 2880 min) ; statistics after warm-up
Results per replication (after warm-up, span = T - warm-up):
    TH  = machine completions / span * 60          [pallets/h]
    uM  = busy machine time / (m*span)  (busy includes repairs) ; dM = repair time / (m*span)
    uL  = busy load-station time / (L*span) ; uV = busy vehicle time / (V*span)
    mQ, lQ = time-average queue at the machines / at the load station [pallets]
    loop = mean time between two load-station finishes of the same pallet [min]
    Little check: N = TH * loop  (TH in pallets/min)
Replications: seeds 1..R (default 10), mean ± t_{R-1,0.975}*s/sqrt(R) (t_9 = 2.262).
Closed laws (as web theory()): tm = mix-weighted machining, A = MTTF/(MTTF+MTTR),
    rates: machines m/(tm/A), load L/load, vehicles V/(2*move); rb = smallest ; T0 = load + 2*move + tm/A ;
    W0 = rb*T0 ; best = min(N/T0, rb) ; PWC = N/(W0+N-1)*rb ; worst = 1/T0
MVA: mva_closed.py with the stations load (L, load), vehicle (V, 2*move), machines (m, tm/A).

Results can differ from the browser in the last digits (different log / cos / exp libraries change a
sample now and then and the paths drift apart), so compare means and CIs of 10 replications, not single runs.
"""

import argparse
import heapq

from fmse_common import (ITEM4_EXAMPLES, InputError, Mulberry32, SelfTest, expo, fmt_ci, fmt_table, load_examples,
                         logn, mean_ci, run_main, text_bar, with_failures, write_csv)
from mva_closed import mva

INF = float("inf")
KPIS = [("th", "Throughput", "pallets/h", 3), ("uM", "Machine utilisation (incl. repairs)", "%", 1),
        ("dM", "  of it breakdown (repair)", "%", 2), ("uL", "Load station utilisation", "%", 1),
        ("uV", "Vehicle utilisation", "%", 1), ("ct", "Pallet loop time", "min", 1),
        ("mQ", "Queue at the machines", "pallets", 2), ("lQ", "Queue at the load station", "pallets", 2),
        ("little", "Little check TH*loop", "pallets", 2)]
PCT = {"uM", "dM", "uL", "uV"}


# ----------------------------------------------------------------------------- simulation (port of simFMS)
def sim_fms(p, seed, hourly=None):
    """One replication. p: dict m, N, L, V, load, loadCv, move, mttf, mttr, rule, days, parts.
    hourly: optional list; machine completions per hour (from t = 0, incl. warm-up) are added to it."""
    R = Mulberry32(seed)
    T = p["days"] * 1440
    warm = min(T * 0.1, 2880)
    H = []
    seq = [0]

    def push(tt, kind, d):
        heapq.heappush(H, (tt, seq[0], kind, d))      # (time, sequence) = same order as the web heap
        seq[0] += 1

    parts = p["parts"]
    tot = sum(r[1] for r in parts)

    def pick_type():
        x = R() * tot
        for i, r in enumerate(parts):
            x -= r[1]
            if x <= 0:
                return i
        return len(parts) - 1

    M = [{"busy": False, "ttf": expo(R, p["mttf"]) if p["mttf"] > 0 else INF} for _ in range(p["m"])]
    st = {"lFree": p["L"], "vFree": p["V"], "t": 0.0, "last": 0.0}
    loadQ, vehQ, machQ = [], [], []
    S = {"lB": 0.0, "vB": 0.0, "mB": 0.0, "mQ": 0.0, "lQ": 0.0, "down": 0.0, "done": 0,
         "byType": [0] * len(parts), "ct": 0.0, "ctn": 0}

    def acc(tn):
        if tn > warm:
            d = tn - max(st["last"], warm)
            if d > 0:
                S["lB"] += (p["L"] - st["lFree"]) * d
                S["vB"] += (p["V"] - st["vFree"]) * d
                S["mB"] += sum(1 for x in M if x["busy"]) * d
                S["mQ"] += len(machQ) * d
                S["lQ"] += len(loadQ) * d
        st["last"] = tn

    def try_load():
        while st["lFree"] > 0 and loadQ:
            pal = loadQ.pop(0)
            st["lFree"] -= 1
            pal["ty"] = pick_type()
            d = logn(R, p["load"], p["loadCv"])
            push(st["t"] + d, "loadDone", pal)

    def try_veh():
        while st["vFree"] > 0 and vehQ:
            r = vehQ.pop(0)
            st["vFree"] -= 1
            push(st["t"] + p["move"], "moveDone", r)

    def try_mach():
        t = st["t"]
        for k in range(len(M)):
            if not machQ:
                break
            mc = M[k]
            if mc["busy"]:
                continue
            qi = 0
            if p["rule"] == "SPT":
                for i, x in enumerate(machQ):
                    if parts[x["ty"]][2] < parts[machQ[qi]["ty"]][2]:
                        qi = i
            pal = machQ.pop(qi)
            pt = parts[pal["ty"]]
            dur, down, _ = with_failures(R, mc, logn(R, pt[2], pt[3]), p["mttf"], p["mttr"])
            mc["busy"] = True
            if t > warm:
                S["down"] += down
            push(t + dur, "machDone", (pal, k))

    for i in range(p["N"]):
        loadQ.append({"id": i, "ty": 0, "tl": None})
    try_load()
    while H:
        tn, _, kind, d = heapq.heappop(H)
        if tn > T:
            break
        acc(tn)
        st["t"] = t = tn
        if kind == "loadDone":
            st["lFree"] += 1
            if d["tl"] is not None and t > warm:
                S["ct"] += t - d["tl"]
                S["ctn"] += 1
            d["tl"] = t
            vehQ.append((d, "M"))
            try_veh()
            try_load()
        elif kind == "moveDone":
            st["vFree"] += 1
            pal, to = d
            if to == "M":
                machQ.append(pal)
                try_mach()
            else:
                loadQ.append(pal)
                try_load()
            try_veh()
        else:                                          # machDone
            pal, k = d
            M[k]["busy"] = False
            if hourly is not None:
                h = int(t // 60)
                while len(hourly) <= h:
                    hourly.append(0)
                hourly[h] += 1
            if t > warm:
                S["done"] += 1
                S["byType"][pal["ty"]] += 1
            vehQ.append((pal, "L"))
            try_veh()
            try_mach()
    acc(T)
    span = T - warm
    th = S["done"] / span * 60
    ct = S["ct"] / S["ctn"] if S["ctn"] else float("nan")
    return {"th": th, "byType": [x / span * 60 for x in S["byType"]], "uM": S["mB"] / (p["m"] * span),
            "dM": S["down"] / (p["m"] * span), "uL": S["lB"] / (p["L"] * span), "uV": S["vB"] / (p["V"] * span),
            "mQ": S["mQ"] / span, "lQ": S["lQ"] / span, "ct": ct, "little": th / 60 * ct, "warm": warm, "T": T}


def theory(p):
    """Closed laws exactly as web theory(); rates in pallets/min."""
    tot = sum(r[1] for r in p["parts"])
    tm = sum(r[1] / tot * r[2] for r in p["parts"])
    A = p["mttf"] / (p["mttf"] + p["mttr"]) if p["mttf"] > 0 else 1.0
    rates = [("machines", p["m"] / (tm / A)), ("load stations", p["L"] / p["load"]), ("vehicles", p["V"] / (2 * p["move"]))]
    bn = rates[0]
    for r in rates[1:]:
        if r[1] < bn[1]:
            bn = r
    T0 = p["load"] + 2 * p["move"] + tm / A
    W0 = bn[1] * T0
    stations = [["Load station", p["L"], p["load"]], ["Vehicle", p["V"], 2 * p["move"]], ["Machines", p["m"], tm / A]]
    return {"tm": tm, "A": A, "rates": rates, "bn": bn[0], "rb": bn[1], "T0": T0, "W0": W0, "stations": stations,
            "best": lambda n: min(n / T0, bn[1]) * 60, "pwc": lambda n: n / (W0 + n - 1) * bn[1] * 60,
            "worst": lambda n: 60 / T0}


def replicate(p, seeds, hourly_sum=None):
    runs = []
    for s in seeds:
        hl = [] if hourly_sum is not None else None
        runs.append(sim_fms(p, s, hl))
        if hl is not None:
            while len(hourly_sum) < len(hl):
                hourly_sum.append(0)
            for i, x in enumerate(hl):
                hourly_sum[i] += x
    stats = {k: mean_ci([r[k] for r in runs]) for k, *_ in KPIS}
    stats["byType"] = [mean_ci([r["byType"][i] for r in runs]) for i in range(len(p["parts"]))]
    return runs, stats


def check_params(p):
    for k in ("m", "N", "L", "V"):
        if int(p[k]) != p[k] or p[k] < 1:
            raise InputError(f"fms_sim: {k} must be a whole number >= 1")
        p[k] = int(p[k])
    for k in ("load", "loadCv", "move", "mttf", "mttr", "days"):
        if not isinstance(p[k], (int, float)) or p[k] < 0:
            raise InputError(f"fms_sim: {k} must be a number >= 0")
    if p["load"] <= 0 or p["move"] <= 0 or p["days"] <= 0:
        raise InputError("fms_sim: load, move and days must be > 0")
    if p["rule"] not in ("FIFO", "SPT"):
        raise InputError("fms_sim: rule must be FIFO or SPT")
    parts = []
    for r in p["parts"]:
        if len(r) < 4:
            raise InputError("fms_sim: every part needs [name, mix %, machining min, cv]")
        if r[1] > 0 and r[2] > 0:
            parts.append([str(r[0]), float(r[1]), float(r[2]), float(r[3])])
    if not parts:
        raise InputError("fms_sim: enter at least one part type with mix > 0 and machining > 0")
    p["parts"] = parts
    return p


def params_from(sec):
    p = {k: sec[k] for k in ("m", "N", "L", "V", "load", "loadCv", "move", "mttf", "mttr", "rule", "days", "parts")
         if k in sec}
    missing = [k for k in ("m", "N", "L", "V", "load", "loadCv", "move", "mttf", "mttr", "rule", "days", "parts")
               if k not in p]
    if missing:
        raise InputError("fms_sim: missing " + ", ".join(missing))
    return p


# ----------------------------------------------------------------------------- report
def fmt_kpi(st, key, nd):
    if key in PCT:
        return fmt_ci({**st, "mean": st["mean"] * 100, "hw": st["hw"] * 100}, nd)
    return fmt_ci(st, nd)


def show_run(p, seeds, csv_path=None):
    runs, stats = replicate(p, seeds)
    th = theory(p)
    T = p["days"] * 1440
    print(f"GENERIC FMS - DISCRETE-EVENT SIMULATION  m = {p['m']} machines, N = {p['N']} pallets, L = {p['L']}, "
          f"V = {p['V']}, rule {p['rule']}")
    print(f"  load {p['load']:g} min (cv {p['loadCv']:g}), move {p['move']:g} min, MTTF {p['mttf']:g} / MTTR {p['mttr']:g} min, "
          f"{p['days']:g} days, warm-up {min(T*0.1, 2880):g} min, replications {len(seeds)} (seeds {seeds[0]}..{seeds[-1]})")
    print()
    rows = [[name, unit, fmt_kpi(stats[k], k, nd)] for k, name, unit, nd in KPIS]
    print(fmt_table(["KPI (mean ± 95 % half width)", "unit", "value"], rows, "llr"))
    print()
    print("Throughput by type (pallets/h): " + " · ".join(
        f"{r[0].split(' (')[0]} {fmt_ci(stats['byType'][i], 3)}" for i, r in enumerate(p["parts"])))
    lit = stats["little"]["mean"]
    print(f"Little check: N = TH * loop time = {lit:.2f} ~ {p['N']} ({(lit/p['N']-1)*100:+.2f} %)")
    print(f"Theory: bottleneck {th['bn']} rb = {th['rb']*60:.3f} pallets/h ("
          + " · ".join(f"{n} {r*60:.3f}" for n, r in th["rates"]) + f"), T0 = {th['T0']:.2f} min, W0 = {th['W0']:.2f}")
    mv = mva(th["stations"], p["N"])[-1]["X"] * 60
    print(f"        best {th['best'](p['N']):.3f} · PWC {th['pwc'](p['N']):.3f} · worst {th['worst'](p['N']):.3f} · "
          f"MVA {mv:.3f} pallets/h  ->  simulated TH {fmt_ci(stats['th'], 3)} = {stats['th']['mean']/(th['rb']*60)*100:.1f} % of rb")
    print("Machine utilisation check: TH*(tm/A)/m = "
          f"{stats['th']['mean']/60*th['tm']/th['A']/p['m']*100:.1f} % (simulated {stats['uM']['mean']*100:.1f} %)")
    if csv_path:
        keys = [k for k, *_ in KPIS]
        pth = write_csv(csv_path, ["seed"] + keys + [f"th_{r[0].split(' (')[0]}" for r in p["parts"]],
                        [[s] + [round(r[k], 6) for k in keys] + [round(x, 6) for x in r["byType"]]
                         for s, r in zip(seeds, runs)]
                        + [["mean"] + [round(stats[k]["mean"], 6) for k in keys] + [round(x["mean"], 6) for x in stats["byType"]],
                           ["half_width"] + [round(stats[k]["hw"], 6) for k in keys] + [round(x["hw"], 6) for x in stats["byType"]]])
        print(f"CSV written: {pth}")
    return runs, stats


def show_sweep(p, seeds, n_max=None, csv_path=None):
    th = theory(p)
    n_max = n_max or (3 * p["m"] + 6)
    mv = mva(th["stations"], n_max)
    print(f"PALLET SWEEP  N = 1..{n_max}  ({len(seeds)} replications per N, {p['days']:g} days each)")
    print(f"  rb = {th['rb']*60:.3f} pallets/h ({th['bn']}), T0 = {th['T0']:.2f} min, W0 = {th['W0']:.2f} pallets")
    rows, data = [], []
    for n in range(1, n_max + 1):
        _, st = replicate(dict(p, N=n), seeds)
        s = st["th"]
        data.append((n, s, st))
        rows.append([n, fmt_ci(s, 3), f"{mv[n-1]['X']*60:.3f}", f"{th['worst'](n):.3f}", f"{th['pwc'](n):.3f}",
                     f"{th['best'](n):.3f}", f"{st['ct']['mean']:.1f}", f"{st['uM']['mean']*100:.1f}",
                     text_bar(s["mean"], th["rb"] * 60, 25)])
    print(fmt_table(["N", "sim TH ± hw", "MVA", "worst", "PWC", "best", "loop min", "uM %", "(# = rb/25)"], rows,
                    "rrrrrrrrl"))
    top = max(d[1]["mean"] for d in data)
    n95 = next(d[0] for d in data if d[1]["mean"] >= 0.95 * top)
    n95rb = next((d[0] for d in data if d[1]["mean"] >= 0.95 * th["rb"] * 60), None)
    print(f"\nPallets for 95 % of the best simulated TH: {n95}; for 95 % of rb: {n95rb if n95rb else '> ' + str(n_max)}")
    print("Below W0 the machines wait for pallets; above it extra pallets only add waiting (loop = N / TH).")
    if csv_path:
        pth = write_csv(csv_path, ["N", "TH_mean", "TH_half_width", "TH_MVA", "TH_worst", "TH_pwc", "TH_best",
                                   "loop_min", "uM"],
                        [[n, round(s["mean"], 6), round(s["hw"], 6), round(mv[n - 1]["X"] * 60, 6),
                          round(th["worst"](n), 6), round(th["pwc"](n), 6), round(th["best"](n), 6),
                          round(st["ct"]["mean"], 4), round(st["uM"]["mean"], 6)] for n, s, st in data])
        print(f"CSV written: {pth}")
    return data


def show_welch(p, seeds, window, every):
    hs = []
    replicate(p, seeds, hs)
    T = p["days"] * 1440
    nh = int(T // 60)
    y = [(hs[i] if i < len(hs) else 0) / len(seeds) for i in range(nh)]
    th = theory(p)
    print(f"WELCH WARM-UP CURVE  hourly throughput averaged over {len(seeds)} replications, "
          f"moving average window w = {window} h (centred), every {every} h shown")
    print(f"  warm-up used by the statistics: {min(T*0.1, 2880)/60:g} h ; rb = {th['rb']*60:.3f} pallets/h")
    rows = []
    for i in range(0, nh, every):
        lo, hi = max(0, i - window // 2), min(nh, i + window // 2 + 1)
        ma = sum(y[lo:hi]) / (hi - lo)
        rows.append([f"{i}-{i+1}", f"{y[i]:.2f}", f"{ma:.3f}", text_bar(ma, th["rb"] * 60 * 1.1, 30)])
    print(fmt_table(["hour", "avg TH", "moving avg", "(# = 1.1 rb/30)"], rows, "rrrl"))
    print("Warm-up ends where the moving average becomes flat; start the statistics after that point.")
    return y


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("fms_sim")
    _, sec = load_examples(path, "fms_sim")
    p = check_params(params_from(sec))
    th = theory(p)
    t.close("tm = 0.4*56 + 0.35*72 + 0.25*40 = 57.6", th["tm"], 57.6, 1e-12)
    t.close("A = 1200/1260", th["A"], 1200 / 1260, 1e-15)
    t.close("rb = 3/60.48*60 = 2.976 pallets/h", th["rb"] * 60, 3 / 60.48 * 60, 1e-12)
    t.close("T0 = 12 + 3 + 60.48 = 75.48", th["T0"], 75.48, 1e-12)
    t.close("W0 = 3.744", th["W0"], 3 / 60.48 * 75.48, 1e-12)
    a = sim_fms(p, 7)
    b = sim_fms(p, 7)
    t.true("same seed -> identical result", a == b)
    t.true("other seed -> other result", sim_fms(p, 8)["th"] != a["th"])
    t.true(f"seed 7 TH {a['th']:.3f} near the web value 2.91 (+/- 0.08)", abs(a["th"] - 2.91) < 0.08)
    det = check_params({"m": 1, "N": 1, "L": 1, "V": 1, "load": 5, "loadCv": 0, "move": 1, "mttf": 0, "mttr": 0,
                        "rule": "FIFO", "days": 2, "parts": [["X", 100, 10, 0]]})
    r = sim_fms(det, 1)
    t.close("deterministic 1 pallet: loop = 5 + 1 + 10 + 1 = 17 min", r["ct"], 17.0, 1e-9)
    t.close("deterministic 1 pallet: TH = 60/17 (+/- 0.5 %)", r["th"], 60 / 17, 60 / 17 * 0.005)
    t.close("deterministic 1 pallet: machine busy 10/17", r["uM"], 10 / 17, 0.005)
    seeds = list(range(1, 11))
    _, st = replicate(p, seeds)
    n = p["N"]
    m_th = st["th"]["mean"]
    t.true(f"worst {th['worst'](n):.3f} <= TH {m_th:.3f}, CI low {st['th']['lo']:.3f} <= best {th['best'](n):.3f}",
           th["worst"](n) <= m_th and st["th"]["lo"] <= th["best"](n))
    t.true(f"TH {m_th:.3f} >= PWC {th['pwc'](n):.3f}", m_th >= th["pwc"](n))
    t.close("Little: TH*loop = N within 2 %", st["little"]["mean"], n, 0.02 * n)
    u_law = m_th / 60 * th["tm"] / th["A"] / p["m"]
    t.close(f"utilisation law: uM = TH*(tm/A)/m = {u_law:.4f} (+/- 3 %)", st["uM"]["mean"], u_law, 0.03 * u_law)
    t.close("load station law: uL = TH*load/L (+/- 3 %)", st["uL"]["mean"], m_th / 60 * p["load"], 0.03 * m_th / 60 * p["load"])
    t.close("vehicle law: uV = TH*2*move/V (+/- 2 %)", st["uV"]["mean"], m_th / 60 * 3, 0.02 * m_th / 60 * 3)
    t.close("breakdown share dM ~ uM*(1-A) (+/- 25 %)", st["dM"]["mean"], st["uM"]["mean"] * (1 - th["A"]),
            0.25 * st["uM"]["mean"] * (1 - th["A"]))
    t.true(f"CI half width of TH small ({st['th']['hw']:.3f} < 0.1)", st["th"]["hw"] < 0.1)
    _, big = replicate(dict(p, N=25, days=60), [1, 2, 3])
    t.close(f"N = 25, 60 days: TH {big['th']['mean']:.3f} within 2 % of rb", big["th"]["mean"], th["rb"] * 60,
            0.02 * th["rb"] * 60)
    _, spt = replicate(dict(p, rule="SPT"), [1, 2, 3])
    t.true("SPT runs and stays below rb", 0 < spt["th"]["mean"] <= th["rb"] * 60 * 1.01)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/fms_sim.py                       (N = 10, 10 replications, all KPIs)\n"
               "  python tools/fmse/fms_sim.py --N 6 --reps 20 --csv runs.csv\n"
               "  python tools/fmse/fms_sim.py --sweep               (N = 1..3m+6 next to MVA and closed laws)\n"
               "  python tools/fmse/fms_sim.py --welch --window 12   (warm-up curve)\n"
               "  python tools/fmse/fms_sim.py --m 4 --L 2 --rule SPT --mttr 120")
    ap.add_argument("--examples", default=str(ITEM4_EXAMPLES), help="example JSON (default: %(default)s)")
    for k, typ, h in (("m", int, "machines"), ("N", int, "pallets"), ("L", int, "load stations"), ("V", int, "vehicles"),
                      ("load", float, "load / unload time [min]"), ("loadCv", float, "load time variability cv"),
                      ("move", float, "vehicle time per move [min]"), ("mttf", float, "machine MTTF of busy time [min] (0 = none)"),
                      ("mttr", float, "machine MTTR [min]"), ("days", float, "simulated days (24 h)")):
        ap.add_argument("--" + k, type=typ, help=h)
    ap.add_argument("--rule", choices=["FIFO", "SPT"], help="dispatching at the machines")
    ap.add_argument("--reps", type=int, help="replications, seeds seed-from .. (default: JSON, 10)")
    ap.add_argument("--seed-from", type=int, help="first seed (default: JSON, 1)")
    ap.add_argument("--sweep", action="store_true", help="sweep N = 1..3m+6 (or --nmax)")
    ap.add_argument("--nmax", type=int, help="largest N of the sweep")
    ap.add_argument("--welch", action="store_true", help="print the Welch moving average of hourly throughput")
    ap.add_argument("--window", type=int, default=12, help="Welch window in hours (default 12)")
    ap.add_argument("--every", type=int, default=6, help="Welch: print every n-th hour (default 6)")
    ap.add_argument("--csv", help="write the replications (or the sweep table) to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, sec = load_examples(a.examples, "fms_sim")
    p = params_from(sec)
    for k in ("m", "N", "L", "V", "load", "loadCv", "move", "mttf", "mttr", "days", "rule"):
        if getattr(a, k) is not None:
            p[k] = getattr(a, k)
    p = check_params(p)
    reps = a.reps if a.reps is not None else int(sec.get("replications", 10))
    s0 = a.seed_from if a.seed_from is not None else int(sec.get("seeds_from", 1))
    if reps < 1 or reps > 500:
        raise InputError("--reps must be between 1 and 500")
    if s0 < 0:
        raise InputError("--seed-from must be >= 0")
    if a.window < 1 or a.every < 1:
        raise InputError("--window and --every must be >= 1")
    if a.nmax is not None and not 1 <= a.nmax <= 200:
        raise InputError("--nmax must be between 1 and 200")
    seeds = list(range(s0, s0 + reps))
    if a.sweep:
        show_sweep(p, seeds, a.nmax, a.csv)
    elif a.welch:
        show_welch(p, seeds, a.window, a.every)
    else:
        show_run(p, seeds, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
