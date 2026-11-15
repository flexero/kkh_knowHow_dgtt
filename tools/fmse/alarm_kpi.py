#!/usr/bin/env python3
"""Alarm-system KPIs of a shift (ISA-18.2 / EEMUA 191 style): alarm rate, peaks, floods, priority
distribution, chattering alarms, bad actors, text histogram and a verdict against the targets.

Python 3 standard library only, offline. Rules = "_formulas.alarm_kpi" in examples/item5_examples.json.
Guide: docs/FMS system design/65_control_architecture.md.

Rules:
  windows        10-min windows [0, 600), [600, 1200), ... over the shift (shift_s / 600 windows)
  average rate   alarms / (shift hours) / operators            [alarms per hour per operator]
  peak           largest count in one 10-min window
  flood          a window with MORE than 10 alarms; flood % = flood windows / all windows
  priorities     1 = high, 2 = medium, 3 = low; target low 80 % / medium 15 % / high 5 %
  chattering     the same tag with >= 3 activations within any 60 s (t[i+2] - t[i] <= 60 s)
  bad actors     top 5 tags by count (ties: the tag that appeared first)
  targets        average <= 6 /h acceptable (~1 per 10 min), <= 12 /h manageable, above: over-demanding
Alarm log CSV for --csv-in: t_s;tag;priority (header line optional; ',' also accepted).
"""

import argparse
import csv
from pathlib import Path

from fmse_common import (ITEM5_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main, text_bar,
                         write_csv)

WIN = 600
FLOOD = 10
TARGET = {1: 5.0, 2: 15.0, 3: 80.0}
PNAME = {1: "high", 2: "medium", 3: "low"}


def check_log(L):
    for k in ("shift_s", "operators", "alarms"):
        if k not in L:
            raise InputError(f"alarm_log: value '{k}' is missing")
    if not (L["shift_s"] > 0) or not (L["operators"] >= 1):
        raise InputError("alarm_log: shift_s must be > 0 and operators >= 1")
    for a in L["alarms"]:
        if len(a) != 3 or a[2] not in (1, 2, 3) or not (0 <= a[0] < L["shift_s"]):
            raise InputError(f"alarm_log: alarm {a!r} must be [t_s in the shift, tag, priority 1/2/3]")


def read_csv_log(path):
    p = Path(path)
    if not p.is_file():
        raise InputError(f"File not found: {p}")
    text = p.read_text(encoding="utf-8-sig")
    delim = ";" if text.count(";") >= text.count(",") else ","
    out = []
    for n, row in enumerate(csv.reader(text.splitlines(), delimiter=delim), 1):
        if not row or not "".join(row).strip() or row[0].strip().startswith("#"):
            continue
        try:
            out.append([float(row[0]), row[1].strip(), int(row[2])])
        except (ValueError, IndexError):
            if n == 1:
                continue                      # header
            raise InputError(f"{p} line {n}: need t_s;tag;priority")
    return out


def kpis(L):
    shift, ops, al = L["shift_s"], L["operators"], L["alarms"]
    nwin = -(-int(shift) // WIN)
    win = [0] * nwin
    for t, _, _ in al:
        win[int(t // WIN)] += 1
    n = len(al)
    hours = shift / 3600
    flood = [k for k, c in enumerate(win) if c > FLOOD]
    pr = {p: sum(1 for a in al if a[2] == p) for p in (1, 2, 3)}
    by_tag, first = {}, {}
    for k, (t, tag, _) in enumerate(al):
        by_tag.setdefault(tag, []).append(t)
        first.setdefault(tag, k)
    chat = []
    for tag, ts in by_tag.items():
        ts = sorted(ts)
        if any(ts[i + 2] - ts[i] <= 60 for i in range(len(ts) - 2)):
            chat.append((tag, len(ts)))
    top = sorted(by_tag, key=lambda g: (-len(by_tag[g]), first[g]))[:5]
    avg = n / hours / ops
    return {"n": n, "nwin": nwin, "win": win, "avg": avg, "peak": max(win) if win else 0, "flood": flood,
            "flood_pct": 100 * len(flood) / nwin, "in_flood": sum(win[k] for k in flood), "pr": pr,
            "pr_pct": {p: (100 * pr[p] / n if n else 0) for p in pr}, "chat": chat,
            "top": [(g, len(by_tag[g])) for g in top], "hours": hours, "ops": ops}


def verdict(K):
    v = []
    a = K["avg"]
    v.append(("average rate", f"{a:.2f} /h per operator",
              "acceptable (<= 6)" if a <= 6 else "manageable (<= 12)" if a <= 12 else "over-demanding (> 12)"))
    v.append(("peak 10-min count", str(K["peak"]), "flood (> 10)" if K["peak"] > FLOOD else "OK (<= 10)"))
    v.append(("time in flood", f"{K['flood_pct']:.1f} % of windows",
              "OK (< 1 %)" if K["flood_pct"] < 1 else "too high (target < 1 %)"))
    dev = [f"{PNAME[p]} {K['pr_pct'][p]:.0f} % vs {TARGET[p]:.0f} %" for p in (3, 2, 1)]
    ok = K["pr_pct"][1] <= TARGET[1] + 2 and K["pr_pct"][3] >= TARGET[3] - 10
    v.append(("priority distribution", ", ".join(dev), "OK" if ok else "too many high / medium - re-rate"))
    v.append(("chattering tags", str(len(K["chat"])), "OK" if not K["chat"] else "fix (deadband / on-delay)"))
    return v


# ----------------------------------------------------------------------------- output
def mmss(s):
    return f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}"


def show(L, csv_path):
    K = kpis(L)
    print(f"ALARM KPIs  (shift {K['hours']:g} h, {K['ops']} operator(s), {K['n']} alarms, {K['nwin']} windows of 10 min)")
    rows = [["alarms in the shift", K["n"]], ["average per hour per operator", f"{K['avg']:.3f}"],
            ["average per 10 min", f"{K['n'] / K['nwin']:.2f}"], ["peak 10-min count", K["peak"]],
            ["flood windows (> 10)", f"{len(K['flood'])} of {K['nwin']} = {K['flood_pct']:.2f} %"],
            ["alarms inside floods", f"{K['in_flood']} = {100 * K['in_flood'] / K['n']:.1f} %" if K["n"] else "0"]]
    print(fmt_table(["KPI", "value"], rows, "lr"))
    print()
    print("PRIORITY DISTRIBUTION")
    print(fmt_table(["priority", "count", "share", "target"],
                    [[f"{p} {PNAME[p]}", K["pr"][p], f"{K['pr_pct'][p]:.1f} %", f"{TARGET[p]:.0f} %"] for p in (3, 2, 1)]))
    print()
    print("CHATTERING TAGS (>= 3 activations within 60 s)")
    print("  " + (", ".join(f"{g} ({c} activations)" for g, c in K["chat"]) or "none"))
    print()
    print("TOP-5 BAD ACTORS")
    print(fmt_table(["#", "tag", "count", "share"],
                    [[k, g, c, f"{100 * c / K['n']:.1f} %"] for k, (g, c) in enumerate(K["top"], 1)], "rlrr"))
    print()
    print("ALARMS PER 10-MIN WINDOW  (| = flood limit 10)")
    vmax = max(K["peak"], FLOOD + 1)
    for k, c in enumerate(K["win"]):
        bar = text_bar(c, vmax, 30)
        mark = "  FLOOD" if c > FLOOD else ""
        lim = int(round(FLOOD / vmax * 30))
        bar = (bar + " " * 30)[:30]
        bar = bar[:lim] + "|" + bar[lim:]
        print(f"  {mmss(k * WIN)}-{mmss((k + 1) * WIN)} {c:3d} {bar.rstrip()}{mark}")
    print()
    print("VERDICT")
    print(fmt_table(["check", "value", "verdict"], verdict(K), "lll"))
    if csv_path:
        p = write_csv(csv_path, ["window", "start_s", "end_s", "alarms", "flood"],
                      [[k + 1, k * WIN, (k + 1) * WIN, c, "yes" if c > FLOOD else ""] for k, c in enumerate(K["win"])])
        print(f"\nCSV written: {p}")
    return K


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("alarm_kpi")
    _, L = load_examples(path, "alarm_log")
    check_log(L)
    K = kpis(L)
    t.equal("39 alarms (5 + 15 flood + 5 + 6 chatter + 8)", K["n"], 39)
    t.equal("48 windows in 8 h", K["nwin"], 48)
    t.close("average 39 / 8 h / 1 = 4.875 per hour", K["avg"], 4.875, 1e-12)
    t.equal("peak: window [7800, 8400) holds 7800..8060 (14) + 8100 = 15", K["peak"], 15)
    t.equal("peak window index 13", K["win"].index(15), 13)
    t.equal("1 flood window", len(K["flood"]), 1)
    t.close("flood 1/48 = 2.083 %", K["flood_pct"], 100 / 48, 1e-12)
    t.equal("window [16200, 16800): 6 chatter alarms", K["win"][27], 6)
    t.equal("priorities high 4 / medium 13 / low 22", (K["pr"][1], K["pr"][2], K["pr"][3]), (4, 13, 22))
    t.equal("chattering: WASH1.LevelHigh only", [g for g, _ in K["chat"]], ["WASH1.LevelHigh"])
    t.equal("top-5 (ties by first appearance)", K["top"],
            [("WASH1.LevelHigh", 6), ("MC01.CoolantLow", 3), ("MC02.SpindleTemp", 3), ("POOL1.ForkPos", 3),
             ("LS1.LightCurtain", 2)])
    v = {c: x for c, _, x in verdict(K)}
    t.equal("verdict average acceptable", v["average rate"], "acceptable (<= 6)")
    t.equal("verdict peak = flood", v["peak 10-min count"], "flood (> 10)")
    # chattering edge: 3 activations exactly 60 s apart in total count, 61 s do not
    edge = {"shift_s": 600, "operators": 1, "alarms": [[0, "X", 3], [30, "X", 3], [60, "X", 3], [100, "Y", 3],
                                                        [150, "Y", 3], [161, "Y", 3]]}
    t.equal("chatter edge: X (0, 30, 60) yes, Y (100, 150, 161) no", [g for g, _ in kpis(edge)["chat"]], ["X"])
    try:
        check_log({"shift_s": 600, "operators": 1, "alarms": [[10, "X", 4]]})
        t.true("priority 4 -> InputError", False)
    except InputError:
        t.true("priority 4 -> InputError", True)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/alarm_kpi.py\n"
               "  python tools/fmse/alarm_kpi.py --csv windows.csv\n"
               "  python tools/fmse/alarm_kpi.py --csv-in my_alarm_log.csv --shift-h 8 --operators 2")
    ap.add_argument("--examples", default=str(ITEM5_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--csv-in", help="read the alarm log from this CSV (t_s;tag;priority) instead of the JSON")
    ap.add_argument("--shift-h", type=float, help="shift length in hours (default: JSON shift_s)")
    ap.add_argument("--operators", type=int, help="number of operators (default: JSON)")
    ap.add_argument("--csv", help="write the 10-min window counts to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, L = load_examples(a.examples, "alarm_log")
    L = dict(L)
    if a.csv_in:
        L["alarms"] = read_csv_log(a.csv_in)
    if a.shift_h is not None:
        L["shift_s"] = a.shift_h * 3600
    if a.operators is not None:
        L["operators"] = a.operators
    check_log(L)
    show(L, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
