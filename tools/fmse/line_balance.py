#!/usr/bin/env python3
"""Assembly line balancing: assign tasks to stations so that no station exceeds the takt time.

Python 3 standard library only, offline. Formulas = "_formulas" in examples/item2_examples.json.

    takt            = hours*3600 / demand_per_year                 [s]
    min stations    = ceil(sum t / takt)                           (theoretical lower bound)
    positional weight PW_i = t_i + sum of the times of ALL (transitive) successors of task i

Rule rpw (ranked positional weight, Helgeson & Birnie):
    priority list = tasks by descending PW (tie -> lower id).
Rule lcr (largest candidate rule):
    priority list = tasks by descending task time (tie -> lower id).
Assignment (same for both rules):
    open station 1; repeatedly take the FIRST task in the priority list that is not assigned,
    whose predecessors are all assigned, and whose time fits into the remaining station time;
    when no task fits, open a new station.
    efficiency      = sum t / (stations * takt)
    balance delay   = 1 - efficiency
    idle per station = takt - station time

Precedence check: unknown predecessors and cycles are reported (a cycle makes balancing impossible).
Tasks CSV (--tasks): id;name;time_s;predecessors (predecessors separated by ',' or space).
"""

import argparse
import csv
import math
from pathlib import Path

from fmse_common import ITEM2_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main, write_csv


# ----------------------------------------------------------------------------- input
def read_tasks_csv(path):
    p = Path(path)
    if not p.is_file():
        raise InputError(f"File not found: {p}")
    lines = [ln for ln in p.read_text(encoding="utf-8-sig").splitlines() if ln.strip()]
    delim = ";" if lines and lines[0].count(";") >= lines[0].count(",") else ","
    out = []
    for n, r in enumerate(csv.reader(lines, delimiter=delim), 1):
        if n == 1 and r and r[0].strip().lower() == "id":
            continue
        if len(r) < 3:
            raise InputError(f"{p} line {n}: need id;name;time_s;predecessors")
        try:
            tm = float(r[2])
        except ValueError:
            raise InputError(f"{p} line {n}: time '{r[2]}' is not a number")
        preds = (r[3] if len(r) > 3 else "").replace(",", " ").split()
        out.append([r[0].strip(), r[1].strip(), tm, preds])
    return out


def validate(tasks):
    """Check ids, times, predecessors and cycles. Returns dict id -> task; raises InputError."""
    by = {}
    for t in tasks:
        if len(t) < 4:
            raise InputError(f"task {t}: need [id, name, time, [predecessors]]")
        tid = str(t[0])
        if tid in by:
            raise InputError(f"task id {tid} is used twice")
        if not isinstance(t[2], (int, float)) or t[2] <= 0:
            raise InputError(f"task {tid}: time must be > 0")
        by[tid] = {"id": tid, "name": t[1], "t": float(t[2]), "pred": [str(x) for x in t[3]]}
    for tid, t in by.items():
        for p in t["pred"]:
            if p not in by:
                raise InputError(f"task {tid}: unknown predecessor '{p}'")
    cyc = find_cycle(by)
    if cyc:
        raise InputError("precedence cycle: " + " -> ".join(cyc) + " (a task cannot wait for itself)")
    return by


def find_cycle(by):
    """Return one cycle as a list of ids, or None (depth-first search, colours white/grey/black)."""
    colour = {k: 0 for k in by}
    succ = {k: [] for k in by}
    for k, t in by.items():
        for p in t["pred"]:
            succ[p].append(k)
    stack = []

    def dfs(u):
        colour[u] = 1
        stack.append(u)
        for v in succ[u]:
            if colour[v] == 1:
                return stack[stack.index(v):] + [v]
            if colour[v] == 0:
                c = dfs(v)
                if c:
                    return c
        colour[u] = 2
        stack.pop()
        return None

    for k in by:
        if colour[k] == 0:
            c = dfs(k)
            if c:
                return c
    return None


# ----------------------------------------------------------------------------- core
def successors(by):
    """All transitive successors of every task."""
    direct = {k: set() for k in by}
    for k, t in by.items():
        for p in t["pred"]:
            direct[p].add(k)
    memo = {}

    def all_s(k):
        if k not in memo:
            s = set()
            for v in direct[k]:
                s.add(v)
                s |= all_s(v)
            memo[k] = s
        return memo[k]

    return {k: all_s(k) for k in by}


def weights(by):
    succ = successors(by)
    return {k: by[k]["t"] + sum(by[s]["t"] for s in succ[k]) for k in by}, succ


def priority(by, rule):
    ids = sorted(by)                                  # tie -> lower id
    if rule == "rpw":
        pw, _ = weights(by)
        return sorted(ids, key=lambda k: -pw[k])
    if rule == "lcr":
        return sorted(ids, key=lambda k: -by[k]["t"])
    raise InputError("rule must be rpw or lcr")


def balance(by, takt, rule):
    """Assign tasks to stations. Returns list of stations (each a list of ids)."""
    long = [k for k in by if by[k]["t"] > takt + 1e-9]
    if long:
        raise InputError(f"task(s) {', '.join(long)} longer than the takt {takt:.1f} s - split the task or "
                         f"use parallel stations")
    order = priority(by, rule)
    done, stations, cur, left = set(), [], [], takt
    while len(done) < len(by):
        pick = None
        for k in order:
            if k not in done and all(p in done for p in by[k]["pred"]) and by[k]["t"] <= left + 1e-9:
                pick = k
                break
        if pick is None:
            stations.append(cur)
            cur, left = [], takt
            continue
        cur.append(pick)
        done.add(pick)
        left -= by[pick]["t"]
    if cur:
        stations.append(cur)
    return stations


def summary(by, stations, takt):
    tot = sum(t["t"] for t in by.values())
    st_t = [sum(by[k]["t"] for k in s) for s in stations]
    eff = tot / (len(stations) * takt)
    return {"sum": tot, "station_t": st_t, "idle": [takt - x for x in st_t], "eff": eff, "delay": 1 - eff,
            "min_st": math.ceil(tot / takt - 1e-9), "n": len(stations)}


# ----------------------------------------------------------------------------- report
def report(by, takt, rules, demand=None, hours=None, csv_path=None):
    tot = sum(t["t"] for t in by.values())
    print(f"LINE BALANCING   {len(by)} tasks, sum of task times = {tot:g} s")
    if demand:
        print(f"takt = {hours:g} h * 3600 / {demand:g} parts = {takt:.2f} s")
    else:
        print(f"takt = {takt:.2f} s (given)")
    print(f"min stations = ceil({tot:g} / {takt:.2f}) = {math.ceil(tot / takt - 1e-9)}")
    print("Precedence check: all predecessors known, no cycle - OK")
    pw, succ = weights(by)
    print()
    print("Positional weights PW = own time + times of all successors:")
    print(fmt_table(["task", "name", "t s", "predecessors", "all successors", "PW s"],
                    [[k, by[k]["name"], f"{by[k]['t']:g}", ",".join(by[k]["pred"]) or "-",
                      ",".join(sorted(succ[k])) or "-", f"{pw[k]:g}"] for k in sorted(by)], "llrllr"))
    csv_rows = []
    for rule in rules:
        stations = balance(by, takt, rule)
        s = summary(by, stations, takt)
        print()
        name = "RANKED POSITIONAL WEIGHT (RPW)" if rule == "rpw" else "LARGEST CANDIDATE RULE (LCR)"
        print(f"=== {name} ===")
        print("priority list: " + " ".join(priority(by, rule)))
        rows = []
        for n, (st, stt, idle) in enumerate(zip(stations, s["station_t"], s["idle"]), 1):
            rows.append([n, " ".join(st), f"{stt:g}", f"{idle:.1f}", f"{stt/takt*100:.1f}"])
            for k in st:
                csv_rows.append([rule, n, k, by[k]["name"], by[k]["t"], round(stt, 3), round(idle, 3)])
        print(fmt_table(["station", "tasks", "time s", "idle s", "load %"], rows, "rlrrr"))
        print(f"stations = {s['n']} (min {s['min_st']})   efficiency = {s['sum']:g}/({s['n']}*{takt:.2f}) = "
              f"{s['eff']*100:.2f} %   balance delay = {s['delay']*100:.2f} %   idle total = {sum(s['idle']):.1f} s")
        print()
        print(f"Gantt per station (1 char = {takt/50:.2f} s, | = takt):")
        scale = 50 / takt
        for n, st in enumerate(stations, 1):
            line = ""
            for k in st:
                w = max(1, int(round(by[k]["t"] * scale)))
                seg = (k + "=" * (w - 1))[:w]
                line += seg
            line = line.ljust(50) + "|"
            print(f"  S{n:<2} {line} {s['station_t'][n-1]:g} s")
    if csv_path:
        p = write_csv(csv_path, ["rule", "station", "task", "name", "time_s", "station_time_s", "idle_s"], csv_rows)
        print(f"\nCSV written: {p}")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("line_balance")
    _, lb = load_examples(path, "line_balance")
    by = validate(lb["tasks"])
    takt = lb["hours"] * 3600 / lb["demand_per_year"]
    t.close("takt = 3840*3600/120000", takt, 115.2, 1e-12)
    t.close("sum t", sum(x["t"] for x in by.values()), 460, 1e-12)
    pw, _ = weights(by)
    t.equal("positional weights", {k: int(v) for k, v in pw.items()},
            {"A": 460, "B": 330, "C": 360, "D": 210, "E": 275, "F": 165, "G": 185, "H": 130, "I": 125,
             "J": 110, "K": 80, "L": 25})
    st = balance(by, takt, "rpw")
    t.equal("RPW stations", st, [["A", "C"], ["B", "E", "D"], ["G", "F", "H"], ["I", "J"], ["K", "L"]])
    s = summary(by, st, takt)
    t.equal("min stations", s["min_st"], 4)
    t.close("RPW efficiency = 460/(5*115.2)", s["eff"], 460 / 576, 1e-12)
    t.close("RPW station 3 time", s["station_t"][2], 115.0, 1e-12)
    st2 = balance(by, takt, "lcr")
    t.equal("LCR stations", st2, [["A", "C"], ["F", "B", "E"], ["D", "G", "H"], ["I", "J"], ["K", "L"]])
    t.close("LCR efficiency", summary(by, st2, takt)["eff"], 460 / 576, 1e-12)
    st3 = balance(by, 120, "rpw")
    t.equal("RPW at takt 120 s", st3, [["A", "C"], ["B", "E", "D"], ["G", "F", "H"], ["I", "J"], ["K", "L"]])
    cyc = [["A", "a", 1, ["C"]], ["B", "b", 1, ["A"]], ["C", "c", 1, ["B"]]]
    try:
        validate(cyc)
        t.true("cycle A->B->C->A detected", False)
    except InputError as e:
        t.true("cycle A->B->C->A detected", "cycle" in str(e))
    try:
        validate([["A", "a", 1, ["Z"]]])
        t.true("unknown predecessor detected", False)
    except InputError:
        t.true("unknown predecessor detected", True)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/line_balance.py                 (RPW and LCR)\n"
               "  python tools/fmse/line_balance.py --rule lcr --takt 100\n"
               "  python tools/fmse/line_balance.py --tasks my_tasks.csv --takt 60 --csv stations.csv")
    ap.add_argument("--examples", default=str(ITEM2_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--tasks", help="tasks CSV instead of the JSON (id;name;time_s;predecessors)")
    ap.add_argument("--rule", choices=["rpw", "lcr", "both"], default="both", help="balancing rule (default both)")
    ap.add_argument("--takt", type=float, help="takt time in s (default: hours*3600/demand from the JSON)")
    ap.add_argument("--csv", help="write the station assignment to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    demand = hours = None
    if a.tasks:
        tasks = read_tasks_csv(a.tasks)
        if a.takt is None:
            raise InputError("--tasks needs --takt")
    else:
        _, lb = load_examples(a.examples, "line_balance")
        tasks = lb["tasks"]
        if a.takt is None:
            demand, hours = lb["demand_per_year"], lb["hours"]
            if demand <= 0 or hours <= 0:
                raise InputError("line_balance: demand_per_year and hours must be > 0")
    takt = a.takt if a.takt is not None else hours * 3600 / demand
    if takt <= 0:
        raise InputError("--takt must be > 0")
    by = validate(tasks)
    rules = ["rpw", "lcr"] if a.rule == "both" else [a.rule]
    report(by, takt, rules, demand, hours, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
