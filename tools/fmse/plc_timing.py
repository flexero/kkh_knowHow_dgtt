#!/usr/bin/env python3
"""PLC timing: reaction time DI -> DO, task utilisation + response-time analysis, counter / timer overflow.

Python 3 standard library only, offline. Rules = "_rules.response", "_rules.tasks" and "_rules.overflow" in
examples/item9_examples.json, applied EXACTLY. Guide docs/FMS system design/69_plc_programming.md and the web page
use the same rules, so the numbers are identical.

Rules in short:
  response   t_min = t_in + T_scan + t_out ; t_max = t_in + 2*T_bus + 2*T_scan + t_out  [ms]
             distance during t_max = v*t_max/1000 mm  (t round 2, distance round 1)
  tasks      integer microseconds. U = sum C/T (round 4) ; Liu-Layland bound n*(2^(1/n) - 1) (round 4),
             U <= bound -> schedulable by the bound test (sufficient only).
             RTA in priority order (1 = highest), deadline = period:
             R0 = C_i ; R_{k+1} = C_i + sum_{j higher} ceil(R_k/T_j)*C_j ; stop at R_{k+1} = R_k (OK if <= T_i)
             or R_{k+1} > T_i (MISS, R = first value > T_i). Report R and R/T (round 3).
  overflow   time = max_value/rate_per_s s ; seconds (round 1), days (round 2), years (365 d, round 2)

Usage:
  python tools/fmse/plc_timing.py                         (all three parts with the JSON examples; = --example)
  python tools/fmse/plc_timing.py --response
  python tools/fmse/plc_timing.py --response --t-in 3 --t-bus 2 --t-scan 10 --t-out 0.5 --v 500
  python tools/fmse/plc_timing.py --tasks                 (3 task sets with the RTA iteration list)
  python tools/fmse/plc_timing.py --tasks --task Fast:2000:300:1 --task Main:10000:3500:2
  python tools/fmse/plc_timing.py --overflow
  python tools/fmse/plc_timing.py --overflow --max 32767 --rate 0.5
  python tools/fmse/plc_timing.py --md timing.md --json
  python tools/fmse/plc_timing.py --selftest
"""

import argparse
import json
import math
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_json, run_main

HERE = Path(__file__).resolve().parent
ITEM9_EXAMPLES = HERE / "examples" / "item9_examples.json"


def load9(path=None):
    D = load_json(path or ITEM9_EXAMPLES)
    for k in ("response_cases", "task_sets", "overflow"):
        if k not in D:
            raise InputError(f"{path or ITEM9_EXAMPLES}: section '{k}' is missing")
    return D


# ----------------------------------------------------------------------------- rules
def response(c):
    """Reaction time of one case. c: name, t_in, T_bus, T_scan, t_out [ms], v_mm_s."""
    for k in ("t_in", "T_bus", "T_scan", "t_out", "v_mm_s"):
        if k not in c:
            raise InputError(f"response case: value '{k}' is missing")
        if c[k] < 0:
            raise InputError(f"response case: '{k}' must be >= 0")
    tmin = c["t_in"] + c["T_scan"] + c["t_out"]
    tmax = c["t_in"] + 2 * c["T_bus"] + 2 * c["T_scan"] + c["t_out"]
    return {"name": c.get("name", "own case"), "t_min": round(tmin, 2), "t_max": round(tmax, 2),
            "dist_mm": round(c["v_mm_s"] * tmax / 1000, 1), "v_mm_s": c["v_mm_s"]}


def check_tasks(tasks):
    if not tasks:
        raise InputError("task set is empty")
    for t in tasks:
        if len(t) != 4:
            raise InputError(f"task {t!r} must be [name, T_us, C_us, priority]")
        _, T, C, pr = t
        if not all(isinstance(x, int) for x in (T, C, pr)):
            raise InputError(f"task {t[0]}: T, C and priority must be whole numbers (microseconds)")
        if T <= 0 or C <= 0:
            raise InputError(f"task {t[0]}: T and C must be > 0")
    prs = [t[3] for t in tasks]
    if len(set(prs)) != len(prs):
        raise InputError("task priorities must be different (1 = highest)")


def rta(tasks):
    """Utilisation, bound and response-time analysis. Returns dict with U, bound, bound_ok and rows per task."""
    check_tasks(tasks)
    ts = sorted(tasks, key=lambda x: x[3])
    n = len(ts)
    U = sum(C / T for _, T, C, _ in ts)
    bound = n * (2 ** (1 / n) - 1)
    rows = []
    for i, (nm, T, C, pr) in enumerate(ts):
        R = C
        it = [R]
        while True:
            Rn = C + sum(-(-R // Tj) * Cj for _, Tj, Cj, _ in ts[:i])     # integer ceil
            it.append(Rn)
            if Rn > T:
                R, ok = Rn, False
                break
            if Rn == R:
                ok = True
                break
            R = Rn
        rows.append({"name": nm, "T": T, "C": C, "prio": pr, "R": R, "R_T": round(R / T, 3), "ok": ok,
                     "iterations": it})
    return {"U": round(U, 4), "bound": round(bound, 4), "bound_ok": U <= bound, "tasks": rows,
            "all_ok": all(r["ok"] for r in rows)}


def overflow(name, mx, rate):
    if rate <= 0 or mx <= 0:
        raise InputError(f"overflow '{name}': max value and rate must be > 0")
    s = mx / rate
    return {"name": name, "max": mx, "rate": rate, "s": round(s, 1), "days": round(s / 86400, 2),
            "years": round(s / 86400 / 365, 2)}


def time_dhms(ms):
    """2147483647 -> '24 d 20 h 31 min 23.647 s'."""
    s, msr = divmod(int(ms), 1000)
    d, s = divmod(s, 86400)
    h, s = divmod(s, 3600)
    m, s = divmod(s, 60)
    return f"{d} d {h} h {m} min {s}.{msr:03d} s"


# ----------------------------------------------------------------------------- output
def g(x):
    return f"{x:g}" if isinstance(x, float) else str(x)


def text_response(rs):
    out = ["REACTION TIME DI -> DO  t_min = t_in + T_scan + t_out ; t_max = t_in + 2*T_bus + 2*T_scan + t_out"]
    out.append(fmt_table(["case", "t_min ms", "t_max ms", "travel during t_max mm"],
                         [[r["name"], f"{r['t_min']:.2f}", f"{r['t_max']:.2f}", f"{r['dist_mm']:.1f}"] for r in rs]))
    return "\n".join(out)


def text_tasks(sets):
    out = []
    for name, r in sets:
        out.append(f"TASK SET {name}:  U = {r['U']:.4f}, Liu-Layland bound = {r['bound']:.4f} -> "
                   f"{'schedulable by the bound test' if r['bound_ok'] else 'bound test fails (not a proof of a miss)'}"
                   f" ; RTA: {'all deadlines met' if r['all_ok'] else 'DEADLINE MISS'}")
        out.append(fmt_table(["task", "prio", "T us", "C us", "R us", "R/T", "result", "iterations R0, R1, ..."],
                             [[t["name"], t["prio"], t["T"], t["C"], t["R"], f"{t['R_T']:.3f}",
                               "OK" if t["ok"] else "MISS", ", ".join(str(x) for x in t["iterations"])]
                              for t in r["tasks"]], "lrrrrrll"))
        out.append("")
    return "\n".join(out).rstrip()


def text_overflow(rows):
    out = ["OVERFLOW  time = max value / increments per second"]
    out.append(fmt_table(["counter / timer", "max", "per s", "seconds", "days", "years"],
                         [[r["name"], g(r["max"]), f"{r['rate']:.6g}", f"{r['s']:.1f}", f"{r['days']:.2f}",
                           f"{r['years']:.2f}"] for r in rows]))
    out.append(f"  TIME (32-bit signed ms) max 2147483647 ms = {time_dhms(2147483647)} -> use differences "
               f"(now - start), never absolute end times")
    return "\n".join(out)


def md_all(rs, sets, ov):
    L = ["# PLC timing (item 9)", ""]
    if rs:
        L += ["## Reaction time DI -> DO", "", "| case | t_min ms | t_max ms | travel mm |", "|---|---:|---:|---:|"]
        L += [f"| {r['name']} | {r['t_min']:.2f} | {r['t_max']:.2f} | {r['dist_mm']:.1f} |" for r in rs]
        L.append("")
    for name, r in sets:
        L += [f"## Task set {name}", "", f"U = {r['U']:.4f}, bound = {r['bound']:.4f}, bound test "
              f"{'passes' if r['bound_ok'] else 'fails'}; RTA {'OK' if r['all_ok'] else 'MISS'}", "",
              "| task | prio | T us | C us | R us | R/T | result | iterations |", "|---|---:|---:|---:|---:|---:|---|---|"]
        L += [f"| {t['name']} | {t['prio']} | {t['T']} | {t['C']} | {t['R']} | {t['R_T']:.3f} | "
              f"{'OK' if t['ok'] else 'MISS'} | {', '.join(str(x) for x in t['iterations'])} |" for t in r["tasks"]]
        L.append("")
    if ov:
        L += ["## Overflow", "", "| counter | max | per s | seconds | days | years |", "|---|---:|---:|---:|---:|---:|"]
        L += [f"| {r['name']} | {g(r['max'])} | {r['rate']:.6g} | {r['s']:.1f} | {r['days']:.2f} | {r['years']:.2f} |"
              for r in ov]
    return "\n".join(L) + "\n"


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("plc_timing")
    D = load9(path)
    want_r = [(13.5, 23.5, 11.8), (13.5, 27.5, 13.8), (2.2, 6.2, 3.1), (13.5, 223.5, 111.8)]
    for c, w in zip(D["response_cases"], want_r):
        r = response(c)
        t.equal(f"response '{c['name'][:34]}' t_min/t_max/dist = {w}", (r["t_min"], r["t_max"], r["dist_mm"]), w)
    want_t = {"Typical": (0.66, 0.7568, True, [(300, 0.15, True), (4400, 0.44, True), (26700, 0.267, True),
                                              (129000, 0.129, True)]),
              "Tight": (0.91, 0.7568, False, [(300, 0.15, True), (7200, 0.72, True), (49500, 0.495, True),
                                              (357700, 0.358, True)]),
              "Overloaded": (1.14, 0.7568, False, [(300, 0.15, True), (8500, 0.85, True), (100900, 1.009, False),
                                                   (1020900, 1.021, False)])}
    for s in D["task_sets"]:
        key = s["name"].split()[0]
        w = want_t[key]
        r = rta(s["tasks"])
        t.equal(f"tasks {key}: U {w[0]}, bound {w[1]}, bound_ok {w[2]}", (r["U"], r["bound"], r["bound_ok"]), w[:3])
        t.equal(f"tasks {key}: R, R/T, OK per task", [(x["R"], x["R_T"], x["ok"]) for x in r["tasks"]], w[3])
    r = rta(D["task_sets"][0]["tasks"])
    t.equal("Typical Main iterations 3500 -> 4100 -> 4400 -> 4400 (by hand: 3500 + ceil(R/2000)*300)",
            r["tasks"][1]["iterations"], [3500, 4100, 4400, 4400])
    t.equal("Fast_Motion (highest priority) R = C = 300 at once", r["tasks"][0]["iterations"], [300, 300])
    ro = rta(D["task_sets"][2]["tasks"])
    t.true("Overloaded Comm: last iteration is the first value > T (100900 > 100000)",
           ro["tasks"][2]["iterations"][-1] == 100900 and ro["tasks"][2]["iterations"][-2] <= 100000)
    t.true("Tight: the bound test fails but every task passes the RTA (bound is only sufficient)",
           not rta(D["task_sets"][1]["tasks"])["bound_ok"] and rta(D["task_sets"][1]["tasks"])["all_ok"])
    want_o = [(2147483.6, 24.86, 0.07), (3932040.0, 45.51, 0.12), (6553.5, 0.08, 0.0), (429496729.5, 4971.03, 13.62),
              (2147483647.0, 24855.13, 68.1)]
    for (nm, mx, rate), w in zip(D["overflow"], want_o):
        o = overflow(nm, mx, rate)
        t.equal(f"overflow '{nm[:32]}' = {w}", (o["s"], o["days"], o["years"]), w)
    t.equal("TIME max = 24 d 20 h 31 min 23.647 s", time_dhms(2147483647), "24 d 20 h 31 min 23.647 s")
    t.equal("own: one task alone, bound = 1.0", rta([["A", 1000, 500, 1]])["bound"], 1.0)
    t.equal("own: two tasks bound 2*(sqrt 2 - 1) = 0.8284", rta([["A", 10, 1, 1], ["B", 20, 2, 2]])["bound"], 0.8284)
    for bad, label in (([["A", 1000, 500, 1], ["B", 2000, 100, 1]], "equal priorities"),
                       ([["A", 1000.5, 500, 1]], "non-integer period"), ([["A", 0, 1, 1]], "period 0")):
        try:
            rta(bad)
            t.true(f"bad task set ({label}) -> InputError", False)
        except InputError:
            t.true(f"bad task set ({label}) -> InputError", True)
    t.equal("parse --task", parse_task("Fast:2000:300:1"), ["Fast", 2000, 300, 1])
    return t.finish()


def parse_task(text):
    p = text.split(":")
    if len(p) != 4:
        raise InputError(f"--task '{text}' must be NAME:T_us:C_us:PRIO, e.g. Main:10000:3500:2")
    try:
        return [p[0], int(p[1]), int(p[2]), int(p[3])]
    except ValueError:
        raise InputError(f"--task '{text}': T, C and PRIO must be whole numbers")


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM9_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="all three parts with the JSON examples (default)")
    ap.add_argument("--response", action="store_true", help="reaction time DI -> DO")
    ap.add_argument("--t-in", type=float, help="own case: input delay ms")
    ap.add_argument("--t-bus", type=float, default=0.0, help="own case: bus cycle ms (0 = local IO)")
    ap.add_argument("--t-scan", type=float, help="own case: task cycle ms")
    ap.add_argument("--t-out", type=float, default=0.5, help="own case: output delay ms")
    ap.add_argument("--v", type=float, default=500, help="own case: speed mm/s for the travel distance")
    ap.add_argument("--tasks", action="store_true", help="utilisation, Liu-Layland bound and RTA")
    ap.add_argument("--task", action="append", help="own task NAME:T_us:C_us:PRIO (repeat)")
    ap.add_argument("--overflow", action="store_true", help="time to overflow of counters / timers")
    ap.add_argument("--max", type=float, help="own overflow: max value")
    ap.add_argument("--rate", type=float, help="own overflow: increments per second")
    ap.add_argument("--md", help="write a Markdown report to this file")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    D = load9(a.examples)
    parts = [p for p in ("response", "tasks", "overflow") if getattr(a, p)] or ["response", "tasks", "overflow"]
    rs, sets, ov = [], [], []
    if "response" in parts:
        if a.t_in is not None or a.t_scan is not None:
            if a.t_in is None or a.t_scan is None:
                raise InputError("own response case needs --t-in and --t-scan")
            rs = [response({"name": "own case", "t_in": a.t_in, "T_bus": a.t_bus, "T_scan": a.t_scan,
                            "t_out": a.t_out, "v_mm_s": a.v})]
        else:
            rs = [response(c) for c in D["response_cases"]]
    if "tasks" in parts:
        if a.task:
            sets = [("own", rta([parse_task(x) for x in a.task]))]
        else:
            sets = [(s["name"], rta(s["tasks"])) for s in D["task_sets"]]
    if "overflow" in parts:
        if a.max is not None or a.rate is not None:
            if a.max is None or a.rate is None:
                raise InputError("own overflow needs --max and --rate")
            ov = [overflow("own counter", a.max, a.rate)]
        else:
            ov = [overflow(*x) for x in D["overflow"]]
    if a.md:
        Path(a.md).write_text(md_all(rs, sets, ov), encoding="utf-8")
    if a.json:
        print(json.dumps({"response": rs, "tasks": [{"set": n, **r} for n, r in sets], "overflow": ov}, indent=1))
        return 0
    blocks = []
    if rs:
        blocks.append(text_response(rs))
    if sets:
        blocks.append(text_tasks(sets))
    if ov:
        blocks.append(text_overflow(ov))
    print("\n\n".join(blocks))
    if a.md:
        print(f"\nMarkdown written: {a.md}")
    return 0


if __name__ == "__main__":
    run_main(main)
