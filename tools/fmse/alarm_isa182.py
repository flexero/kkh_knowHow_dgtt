#!/usr/bin/env python3
"""ISA-18.2 alarm state machine with annunciation, first-out per group, chattering and standing alarms.

Python 3 standard library only, offline. Rule = "_rules.alarms" in examples/item9_examples.json, applied EXACTLY.
Guide docs/FMS system design/69_plc_programming.md and the web page use the same rule, so the log is identical.

States: NORM, UNACK (active, unacknowledged), ACKED (active, acknowledged), RTNUN (returned, unacknowledged),
SHLVD (shelved), OOS (out of service). Each alarm also tracks the process condition 'active'.
  NORM+act -> UNACK ; UNACK+ack -> ACKED ; UNACK+clr -> RTNUN ; ACKED+clr -> NORM ; RTNUN+ack -> NORM ;
  RTNUN+act -> UNACK ; shelve (shelvable only; from NORM/UNACK/ACKED/RTNUN) -> SHLVD ;
  unshelve -> UNACK if active else NORM ; oos (not from OOS) -> OOS ; ios -> UNACK if active else NORM ;
  everything else: no effect (act / clr still update 'active').
Annunciation = transition INTO UNACK. First-out: group armed at start; first alarm INTO UNACK while armed = first-out,
group disarmed; after each event a group with all alarms NORM is re-armed. Chattering: 3 acts within 60 s.
Standing at the end = UNACK or ACKED.

Usage:
  python tools/fmse/alarm_isa182.py                       (summary of the JSON event list; = --example)
  python tools/fmse/alarm_isa182.py --log                 (every event row)
  python tools/fmse/alarm_isa182.py --events "100:A1:act,110:A1:ack,120:A1:clr" --log
  python tools/fmse/alarm_isa182.py --md alarms.md --csv alarms.csv --json
  python tools/fmse/alarm_isa182.py --selftest
"""

import argparse
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_json, run_main, write_csv

HERE = Path(__file__).resolve().parent
ITEM9_EXAMPLES = HERE / "examples" / "item9_examples.json"
STATES = ("NORM", "UNACK", "ACKED", "RTNUN", "SHLVD", "OOS")
EVENTS = ("act", "clr", "ack", "shelve", "unshelve", "oos", "ios")
CHATTER_N, CHATTER_S = 3, 60
PRIO = {1: "high", 2: "medium", 3: "low"}


def check(AL):
    if "defs" not in AL or "events" not in AL:
        raise InputError("alarms: 'defs' and 'events' are needed")
    ids = set()
    for d in AL["defs"]:
        if len(d) != 5:
            raise InputError(f"alarms: definition {d!r} must be [id, tag, priority, group, shelvable]")
        if d[0] in ids:
            raise InputError(f"alarms: alarm id '{d[0]}' twice")
        ids.add(d[0])
    last = None
    for e in AL["events"]:
        if len(e) != 3 or e[1] not in ids or e[2] not in EVENTS:
            raise InputError(f"alarms: event {e!r} must be [t_s, alarm id, {'/'.join(EVENTS)}] with a defined alarm")
        if last is not None and e[0] < last:
            raise InputError(f"alarms: events must be in time order ({e[0]} after {last})")
        last = e[0]


def next_state(s, ev, active, shelvable):
    if ev == "act" and s in ("NORM", "RTNUN"):
        return "UNACK"
    if ev == "ack" and s == "UNACK":
        return "ACKED"
    if ev == "clr" and s == "UNACK":
        return "RTNUN"
    if ev == "clr" and s == "ACKED":
        return "NORM"
    if ev == "ack" and s == "RTNUN":
        return "NORM"
    if ev == "shelve" and shelvable and s in ("NORM", "UNACK", "ACKED", "RTNUN"):
        return "SHLVD"
    if ev == "unshelve" and s == "SHLVD":
        return "UNACK" if active else "NORM"
    if ev == "oos" and s != "OOS":
        return "OOS"
    if ev == "ios" and s == "OOS":
        return "UNACK" if active else "NORM"
    return s


def run(AL):
    """Process the event list. Returns dict(rows, final, ann, chatter, standing, first_out)."""
    check(AL)
    defs = {a[0]: a for a in AL["defs"]}
    st = {a: "NORM" for a in defs}
    act = {a: False for a in defs}
    groups = {}
    for a in AL["defs"]:
        groups.setdefault(a[3], []).append(a[0])
    armed = {g: True for g in groups}
    fo = {g: None for g in groups}
    ann = {a: 0 for a in defs}
    acts = {a: [] for a in defs}
    chat = set()
    rows = []
    for t, a, ev in AL["events"]:
        s = st[a]
        if ev == "act":
            act[a] = True
            acts[a].append(t)
        elif ev == "clr":
            act[a] = False
        ns = next_state(s, ev, act[a], defs[a][4])
        st[a] = ns
        annunc = ns == "UNACK" and s != "UNACK"
        first = False
        g = defs[a][3]
        if annunc:
            ann[a] += 1
            if armed[g]:
                armed[g], fo[g], first = False, a, True
        if ev == "act":
            x = acts[a]
            if len(x) >= CHATTER_N and x[-1] - x[-CHATTER_N] <= CHATTER_S:
                chat.add(a)
        for gg, mem in groups.items():
            if not armed[gg] and all(st[m] == "NORM" for m in mem):
                armed[gg], fo[gg] = True, None
        rows.append({"t": t, "alarm": a, "ev": ev, "from": s, "to": ns, "effect": ns != s, "ann": annunc,
                     "first_out": first, "active": act[a]})
    return {"rows": rows, "final": st, "ann": ann, "chatter": sorted(chat),
            "standing": [a for a in st if st[a] in ("UNACK", "ACKED")], "first_out": fo, "defs": defs}


def row_text(r):
    to = r["to"] if r["effect"] else f"{r['from']} (no effect)"
    return f"{r['t']} {r['alarm']} {r['ev']} {r['from']} -> {to} {'ANN' if r['ann'] else ''} " \
           f"{'FIRST-OUT' if r['first_out'] else ''}"


def parse_events(text):
    out = []
    for part in [p.strip() for p in str(text).split(",") if p.strip()]:
        p = part.split(":")
        if len(p) != 3:
            raise InputError(f"--events: '{part}' must be T:ALARM:EVENT, e.g. 100:A1:act")
        try:
            out.append([float(p[0]) if "." in p[0] else int(p[0]), p[1].strip(), p[2].strip().lower()])
        except ValueError:
            raise InputError(f"--events: time '{p[0]}' is not a number")
    return out


# ----------------------------------------------------------------------------- output
def show(R, with_log, csv_path):
    print(f"ISA-18.2 ALARM STATE MACHINE  {len(R['defs'])} alarms, {len(R['rows'])} events, "
          f"chattering = {CHATTER_N} acts within {CHATTER_S} s")
    print(fmt_table(["id", "tag", "priority", "group", "shelvable"],
                    [[d[0], d[1], f"{d[2]} {PRIO.get(d[2], '')}", d[3], "yes" if d[4] else "no"]
                     for d in R["defs"].values()], "lllll"))
    if with_log:
        print()
        print(fmt_table(["t s", "alarm", "event", "from", "to", "horn", "first-out"],
                        [[r["t"], r["alarm"], r["ev"], r["from"], r["to"] if r["effect"] else "(no effect)",
                          "ANN" if r["ann"] else "", "FIRST-OUT" if r["first_out"] else ""] for r in R["rows"]],
                        "rllllll"))
    print()
    print("RESULT")
    print(fmt_table(["alarm", "final state", "annunciations", "chattering", "standing"],
                    [[a, s, R["ann"][a], "yes" if a in R["chatter"] else "", "yes" if a in R["standing"] else ""]
                     for a, s in R["final"].items()], "llrll"))
    print("  first-out per group: " + ", ".join(f"{g} {v or '- (armed)'}" for g, v in R["first_out"].items()))
    if csv_path:
        write_csv(csv_path, ["t_s", "alarm", "event", "from", "to", "annunciation", "first_out"],
                  [[r["t"], r["alarm"], r["ev"], r["from"], r["to"], int(r["ann"]), int(r["first_out"])]
                   for r in R["rows"]])
        print(f"\nCSV written: {csv_path}")


def md(R):
    L = ["# ISA-18.2 alarm log (item 9)", "", "| t s | alarm | event | from | to | horn | first-out |",
         "|---:|---|---|---|---|---|---|"]
    L += [f"| {r['t']} | {r['alarm']} | {r['ev']} | {r['from']} | {r['to'] if r['effect'] else '(no effect)'} | "
          f"{'ANN' if r['ann'] else ''} | {'FIRST-OUT' if r['first_out'] else ''} |" for r in R["rows"]]
    L += ["", "| alarm | final | annunciations | chattering | standing |", "|---|---|---:|---|---|"]
    L += [f"| {a} | {s} | {R['ann'][a]} | {'yes' if a in R['chatter'] else ''} | "
          f"{'yes' if a in R['standing'] else ''} |" for a, s in R["final"].items()]
    L += ["", "First-out: " + ", ".join(f"{g} {v or '-'}" for g, v in R["first_out"].items())]
    return "\n".join(L) + "\n"


# ----------------------------------------------------------------------------- self-test
REF_ROWS = [
    "100 A1 act NORM -> UNACK ANN FIRST-OUT", "101 A2 act NORM -> UNACK ANN ", "102 A3 act NORM -> UNACK ANN ",
    "130 A1 ack UNACK -> ACKED  ", "131 A2 ack UNACK -> ACKED  ", "132 A3 ack UNACK -> ACKED  ",
    "160 A1 clr ACKED -> NORM  ", "170 A2 clr ACKED -> NORM  ", "175 A3 clr ACKED -> NORM  ",
    "200 A4 act NORM -> UNACK ANN FIRST-OUT", "205 A4 clr UNACK -> RTNUN  ", "212 A4 act RTNUN -> UNACK ANN ",
    "218 A4 clr UNACK -> RTNUN  ", "224 A4 act RTNUN -> UNACK ANN ", "230 A4 clr UNACK -> RTNUN  ",
    "240 A4 shelve RTNUN -> SHLVD  ", "250 A4 act SHLVD -> SHLVD (no effect)  ",
    "260 A4 clr SHLVD -> SHLVD (no effect)  ", "300 A2 act NORM -> UNACK ANN FIRST-OUT",
    "310 A2 shelve UNACK -> UNACK (no effect)  ", "320 A2 ack UNACK -> ACKED  ", "330 A2 clr ACKED -> NORM  ",
    "340 A2 ack NORM -> NORM (no effect)  ", "400 A3 act NORM -> UNACK ANN FIRST-OUT", "410 A3 clr UNACK -> RTNUN  ",
    "420 A3 act RTNUN -> UNACK ANN ", "430 A3 ack UNACK -> ACKED  ", "500 A5 oos NORM -> OOS  ",
    "510 A5 act OOS -> OOS (no effect)  ", "600 A5 ios OOS -> UNACK ANN FIRST-OUT", "610 A5 ack UNACK -> ACKED  ",
    "700 A1 act NORM -> UNACK ANN ", "705 A1 clr UNACK -> RTNUN  ", "900 A4 unshelve SHLVD -> NORM  ",
    "905 A4 ack NORM -> NORM (no effect)  "]


def selftest(path):
    t = SelfTest("alarm_isa182")
    AL = load_json(path or ITEM9_EXAMPLES)["alarms"]
    R = run(AL)
    got = [row_text(r) for r in R["rows"]]
    t.equal("35 event rows", len(got), 35)
    for i, (g, w) in enumerate(zip(got, REF_ROWS)):
        t.equal(f"row {i + 1}: {w.strip()}", g, w)
    t.equal("final states", R["final"], {"A1": "RTNUN", "A2": "NORM", "A3": "ACKED", "A4": "NORM", "A5": "ACKED"})
    t.equal("annunciations per alarm", R["ann"], {"A1": 2, "A2": 2, "A3": 3, "A4": 3, "A5": 1})
    t.equal("chattering: A4 (acts 200, 212, 224 within 24 s)", R["chatter"], ["A4"])
    t.equal("standing alarms at the end: A3, A5", R["standing"], ["A3", "A5"])
    t.equal("first-out per group", R["first_out"], {"CELL": "A3", "WASH": None, "CMM": "A5"})
    t.true("A2 is not shelvable: shelve has no effect", R["rows"][19]["effect"] is False)
    t.equal("unshelve while active -> UNACK (own)", next_state("SHLVD", "unshelve", True, True), "UNACK")
    for bad, label in (({"defs": AL["defs"], "events": [[1, "A9", "act"]]}, "unknown alarm"),
                       ({"defs": AL["defs"], "events": [[5, "A1", "act"], [4, "A1", "clr"]]}, "time order"),
                       ({"defs": AL["defs"], "events": [[5, "A1", "blink"]]}, "unknown event")):
        try:
            run(bad)
            t.true(f"bad events ({label}) -> InputError", False)
        except InputError:
            t.true(f"bad events ({label}) -> InputError", True)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM9_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="the JSON event list (default)")
    ap.add_argument("--log", action="store_true", help="print every event row")
    ap.add_argument("--events", help="own events T:ALARM:EVENT,... (alarm definitions from the JSON)")
    ap.add_argument("--md", help="write a Markdown report")
    ap.add_argument("--csv", help="write the log to a CSV file")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    AL = dict(load_json(a.examples)["alarms"])
    if a.events is not None:
        AL["events"] = parse_events(a.events)
    R = run(AL)
    if a.md:
        Path(a.md).write_text(md(R), encoding="utf-8")
    if a.json:
        print(json.dumps({"rows": R["rows"], "final": R["final"], "annunciations": R["ann"], "chatter": R["chatter"],
                          "standing": R["standing"], "first_out": R["first_out"]}, indent=1))
        return 0
    show(R, a.log, a.csv)
    if a.md:
        print(f"\nMarkdown written: {a.md}")
    return 0


if __name__ == "__main__":
    run_main(main)
