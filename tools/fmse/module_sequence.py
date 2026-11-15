#!/usr/bin/env python3
"""Module program: the APC01 sequence (module M02 pallet changer) inside the PackML state machine, commanded over
the item-6 data block, with a small plant model (rotate cylinder with double solenoid valve, clamp with spring).

Python 3 standard library only, offline. Rule = "_rules.module_run" in examples/item9_examples.json, applied EXACTLY.
The PackML tables (STATES, CMDS, EDGES, MODES) are the ones of item 5 (packml_sim.py = web/fmse5_data.js). Guide
docs/FMS system design/69_plc_programming.md and the web page use the same rule, so the log is identical line by line.

Model in short (tick = 100 ms):
  1 events   CMD <name> -> Command.CntrlCmd + CmdChangeRequest ; JAM_ROT / UNJAM_ROT ; PRESS_LOW / PRESS_OK
  2 plant    (outputs of the last tick) rotate spool A/B (double valve keeps its position), x 0..30 one step per
             tick unless jammed ; clamp x 0 (clamped) .. 8 (unclamped) ; ClampPress 6.0 (3.8 if low) after 3
             clamped ticks, else 0.5 bar
  3 PLC      (a) command accept / reject (PackML rules, mode Production)  (b) acting states count their duration
             -> SC ; Execute: S10 unclamp -> S20 rotate to the other end -> S30 clamp + pressure -> S40 done
             (time-outs: alarm 11 / 12 / 13 -> internal Abort) ; entry actions  (c) outputs  (d) data block
             StateCurrent, AlarmNo, Bits (Ready 1, Busy 2, Done 4, Fault 8, Auto 32, PartPresent 64), count

Usage:
  python tools/fmse/module_sequence.py                    (summary of the scenarios A..E; = --example)
  python tools/fmse/module_sequence.py --scenario B --log
  python tools/fmse/module_sequence.py --scenario A --trace           (per-tick table: state, step, outputs, plant)
  python tools/fmse/module_sequence.py --scenario A --events "2:CMD Reset,10:CMD Start,30:JAM_ROT" --log
  python tools/fmse/module_sequence.py --md run.md --csv log.csv --json
  python tools/fmse/module_sequence.py --selftest
"""

import argparse
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_json, run_main, write_csv
from packml_sim import CMDS, EDGES, MODES, STATES, target

HERE = Path(__file__).resolve().parent
ITEM9_EXAMPLES = HERE / "examples" / "item9_examples.json"
MODE = "Production"

DURATION = {"Resetting": 5, "Starting": 2, "Completing": 2, "Stopping": 2, "Aborting": 1, "Clearing": 2,
            "Holding": 1, "Unholding": 1, "Suspending": 1, "Unsuspending": 1}
BUSY = {"Starting", "Execute", "Completing", "Resetting", "Holding", "Unholding", "Suspending", "Unsuspending",
        "Stopping", "Aborting", "Clearing"}
SEQ_OUT_STATES = ("Execute", "Holding", "Held", "Unholding")
ALARMS = {10: "rotate not in an end position at start", 11: "unclamp timeout", 12: "rotate timeout",
          13: "clamp pressure low / clamp timeout"}
ROT_END, CLAMP_END = 30, 8
T_S10, T_S20, T_S30 = 30, 50, 30
P_MIN = 4.5
PLANT_EVENTS = ("JAM_ROT", "UNJAM_ROT", "PRESS_LOW", "PRESS_OK")
BIT_NAMES = [(1, "Ready"), (2, "Busy"), (4, "Done"), (8, "Fault"), (32, "Auto"), (64, "PartPresent")]


def sc_target(state):
    return next((b for a, b, c in EDGES if a == state and c == "SC"), None)


def check_events(events):
    for e in events:
        if len(e) != 2 or not isinstance(e[0], int) or e[0] < 0:
            raise InputError(f"module_run: event {e!r} must be [tick >= 0, kind]")
        kind = e[1]
        if kind.startswith("CMD "):
            if kind[4:] not in CMDS:
                raise InputError(f"module_run: command '{kind[4:]}' unknown ({', '.join(CMDS)})")
        elif kind not in PLANT_EVENTS:
            raise InputError(f"module_run: event '{kind}' unknown (CMD <name>, {', '.join(PLANT_EVENTS)})")


def bits_text(b):
    return "+".join(n for v, n in BIT_NAMES if b & v) or "-"


def simulate(K, events):
    """Run the rule for K ticks. Returns dict(log, final state, alarm, count, bits, plant, data block, ticks)."""
    check_events(events)
    S = {"state": "Stopped", "step": 0, "n": 0, "nst": 0, "alarm": 0, "count": 0, "target": None}
    rx, spool, cx, cn, jam, plow, pal = 0, "A", 0, 3, False, False, True
    out = {"ClampSol": False, "SolA": False, "SolB": False}
    cmd = ccr = 0
    log, ticks = [], []

    def bits():
        st = S["state"]
        return ((1 if st == "Idle" else 0) | (2 if st in BUSY else 0) | (4 if st == "Complete" else 0)
                | (8 if S["alarm"] else 0) | 32 | (64 if pal else 0))

    for k in range(K):
        # ---- 1 events
        for tk, e in events:
            if tk != k:
                continue
            if e.startswith("CMD "):
                cmd, ccr = CMDS[e[4:]], 1
            elif e == "JAM_ROT":
                jam = True
            elif e == "UNJAM_ROT":
                jam = False
            elif e == "PRESS_LOW":
                plow = True
            elif e == "PRESS_OK":
                plow = False
            log.append(f"{k} event {e}")
        # ---- 2 plant (outputs of tick k-1)
        if out["SolA"] and not out["SolB"]:
            spool = "A"
        elif out["SolB"] and not out["SolA"]:
            spool = "B"
        if not jam:
            if spool == "A" and rx > 0:
                rx -= 1
            elif spool == "B" and rx < ROT_END:
                rx += 1
        if out["ClampSol"] and cx < CLAMP_END:
            cx += 1
        elif not out["ClampSol"] and cx > 0:
            cx -= 1
        cn = cn + 1 if cx == 0 else 0
        press = (3.8 if plow else 6.0) if cn >= 3 else 0.5
        PosA, PosB, CPA, CPB = rx == 0, rx == ROT_END, cx == 0, cx == CLAMP_END
        s0 = S["state"]
        trans = []                               # (from, to) whose entry actions run in this tick
        # ---- 3a command
        entered = False
        if ccr:
            c = next(x for x, v in CMDS.items() if v == cmd)
            ns = target(S["state"], c) if c in MODES[MODE] else None
            if ns is not None:
                log.append(f"{k} cmd {c} accepted: {S['state']} -> {ns}")
                trans.append((S["state"], ns))
                S["state"], S["nst"], entered = ns, 0, True
            else:
                log.append(f"{k} cmd {c} rejected in {S['state']}")
            cmd = ccr = 0
        # ---- 3b state action (not for a state entered by a command in this tick)
        if not entered:
            st = S["state"]
            if st in DURATION:
                S["nst"] += 1
                if S["nst"] >= DURATION[st]:
                    ns = sc_target(st)
                    log.append(f"{k} SC: {st} -> {ns}")
                    trans.append((st, ns))
                    S["state"], S["nst"] = ns, 0
            elif st == "Execute":
                S["n"] += 1
                adv = al = 0
                step, n = S["step"], S["n"]
                if step == 10:
                    if CPB:
                        adv = 20
                    elif n >= T_S10:
                        al = 11
                elif step == 20:
                    if (PosB if S["target"] == "B" else PosA):
                        adv = 30
                    elif n >= T_S20:
                        al = 12
                elif step == 30:
                    if CPA and press >= P_MIN:
                        adv = 40
                    elif n >= T_S30:
                        al = 13
                if adv:
                    log.append(f"{k} step S{step} -> S{adv}")
                    S["step"], S["n"] = adv, 0
                    if adv == 40:
                        log.append(f"{k} SC: Execute -> Completing (sequence done)")
                        trans.append(("Execute", "Completing"))
                        S["state"], S["nst"] = "Completing", 0
                if al:
                    S["alarm"] = al
                    log.append(f"{k} ALARM {al} {ALARMS[al]} in S{S['step']} -> internal Abort: Execute -> Aborting")
                    trans.append(("Execute", "Aborting"))
                    S["state"], S["nst"] = "Aborting", 0
        # ---- entry actions
        for prev, cur in trans:
            if cur == "Execute" and prev == "Starting":
                if PosA:
                    S["target"] = "B"
                elif PosB:
                    S["target"] = "A"
                else:
                    S["target"], S["alarm"] = None, 10
                    log.append(f"{k} ALARM 10 {ALARMS[10]} -> internal Abort: Execute -> Aborting")
                    S["state"], S["nst"], S["step"] = "Aborting", 0, 0
                    continue
                S["step"], S["n"] = 10, 0
                log.append(f"{k} sequence start: target {S['target']}, step S10")
            if cur == "Clearing":
                S["alarm"] = 0
            if cur == "Complete":
                S["count"] += 1
            if cur in ("Stopped", "Idle", "Aborted", "Completing", "Stopping"):
                S["step"] = 0
        # ---- 3c outputs
        st, step = S["state"], S["step"]
        if st in SEQ_OUT_STATES:
            out = {"ClampSol": step in (10, 20), "SolA": step == 20 and S["target"] == "A",
                   "SolB": step == 20 and S["target"] == "B"}
        else:
            out = {"ClampSol": False, "SolA": False, "SolB": False}
        # ---- 3d data block
        if st != s0:
            log.append(f"{k} state {st} StateCurrent={STATES[st]} AlarmNo={S['alarm']} Bits={bits()} "
                       f"count={S['count']}")
        ticks.append({"k": k, "state": st, "step": step, "n": S["n"], "ClampSol": int(out["ClampSol"]),
                      "SolA": int(out["SolA"]), "SolB": int(out["SolB"]), "rot_x": rx, "spool": spool,
                      "clamp_x": cx, "press": press, "PosA": int(PosA), "PosB": int(PosB), "AlarmNo": S["alarm"],
                      "Bits": bits()})
    st = S["state"]
    db = {"Status.StateCurrent": STATES[st], "Status.Bits": bits(), "Admin.AlarmNo": S["alarm"],
          "Admin.ProdProcessedCount": S["count"], "Command.CntrlCmd": cmd, "Command.CmdChangeRequest": ccr}
    return {"log": log, "final": st, "state_current": STATES[st], "alarm": S["alarm"], "count": S["count"],
            "bits": bits(), "rx": rx, "spool": spool, "clamp_x": cx, "datablock": db, "ticks": ticks}


def pick(MR, name):
    for S in MR["scenarios"]:
        if S["name"].split()[0].upper() == name.upper():
            return S
    raise InputError(f"scenario '{name}' not found ({', '.join(s['name'].split()[0] for s in MR['scenarios'])})")


def parse_events(text):
    """'2:CMD Reset,10:CMD Start,30:JAM_ROT' -> [[2, 'CMD Reset'], ...]."""
    out = []
    for part in [p.strip() for p in str(text).split(",") if p.strip()]:
        if ":" not in part:
            raise InputError(f"--events: '{part}' must be TICK:KIND, e.g. 10:CMD Start")
        k, kind = part.split(":", 1)
        kind = kind.strip()
        if kind.upper().startswith("CMD "):
            name = kind[4:].strip().capitalize()
            kind = "CMD " + name
        else:
            kind = kind.upper()
        try:
            out.append([int(k), kind])
        except ValueError:
            raise InputError(f"--events: tick '{k}' is not a whole number")
    check_events(out)
    return out


# ----------------------------------------------------------------------------- output
def summary_rows(runs):
    return [[S["name"].split()[0], r["final"], r["state_current"], r["alarm"], r["count"],
             f"{r['bits']} ({bits_text(r['bits'])})", r["rx"], r["spool"], len(r["log"])] for S, r in runs]


SUM_HEAD = ["scen.", "final state", "StateCurrent", "AlarmNo", "count", "Bits", "rotate x", "spool", "log lines"]


def show(MR, runs, with_log, with_trace, csv_path):
    print(f"MODULE PROGRAM APC01 (M02)  PackML mode {MODE}, K = {MR['K']} ticks x {MR.get('tick_ms', 100)} ms, "
          f"time-outs S10 {T_S10}, S20 {T_S20}, S30 {T_S30} ticks, clamp pressure >= {P_MIN} bar")
    print()
    for S, r in runs:
        print(f"Scenario {S['name']}   events "
              f"{', '.join(f'{e[0]} {e[1]}' for e in S['events']) or '-'}")
        if with_log:
            for line in r["log"]:
                print("  " + line)
        if with_trace:
            cols = ["k", "state", "step", "n", "ClampSol", "SolA", "SolB", "rot_x", "spool", "clamp_x", "press",
                    "AlarmNo", "Bits"]
            print(fmt_table(cols, [[x[c] for c in cols] for x in r["ticks"]], "rlrrrrrrlrrrr"))
        if with_log or with_trace:
            db = r["datablock"]
            print("  data block at the end: " + ", ".join(f"{k} = {v}" for k, v in db.items()))
        print()
    print("SUMMARY")
    print(fmt_table(SUM_HEAD, summary_rows(runs), "llrrrlrlr"))
    if csv_path:
        rows = []
        for S, r in runs:
            for i, line in enumerate(r["log"], 1):
                k, text = line.split(" ", 1)
                rows.append([S["name"].split()[0], i, int(k), text])
        write_csv(csv_path, ["scenario", "line", "tick", "text"], rows)
        print(f"\nCSV written: {csv_path}")


def md_runs(runs):
    L = ["# Module program APC01 inside PackML (item 9)", "", "| " + " | ".join(SUM_HEAD) + " |",
         "|" + "---|" * len(SUM_HEAD)]
    L += ["| " + " | ".join(str(c) for c in row) + " |" for row in summary_rows(runs)]
    for S, r in runs:
        L += ["", f"## Scenario {S['name']}", "", "```"] + r["log"] + ["```"]
    return "\n".join(L) + "\n"


# ----------------------------------------------------------------------------- self-test
REF_SUM = {"A": ("Idle", 4, 0, 1, 97, 30, "B", 23), "B": ("Complete", 17, 0, 1, 100, 0, "A", 41),
           "C": ("Complete", 17, 0, 1, 100, 0, "A", 42), "D": ("Idle", 4, 0, 1, 97, 30, "B", 33),
           "E": ("Idle", 4, 0, 0, 97, 30, "B", 28)}
REF_LOG = {
    "A": ["2 event CMD Reset", "2 cmd Reset accepted: Stopped -> Resetting",
          "2 state Resetting StateCurrent=15 AlarmNo=0 Bits=98 count=0", "7 SC: Resetting -> Idle",
          "7 state Idle StateCurrent=4 AlarmNo=0 Bits=97 count=0", "10 event CMD Start",
          "10 cmd Start accepted: Idle -> Starting", "10 state Starting StateCurrent=3 AlarmNo=0 Bits=98 count=0",
          "12 SC: Starting -> Execute", "12 sequence start: target B, step S10",
          "12 state Execute StateCurrent=6 AlarmNo=0 Bits=98 count=0", "20 step S10 -> S20", "50 step S20 -> S30",
          "60 step S30 -> S40", "60 SC: Execute -> Completing (sequence done)",
          "60 state Completing StateCurrent=16 AlarmNo=0 Bits=98 count=0", "62 SC: Completing -> Complete",
          "62 state Complete StateCurrent=17 AlarmNo=0 Bits=100 count=1", "70 event CMD Reset",
          "70 cmd Reset accepted: Complete -> Resetting", "70 state Resetting StateCurrent=15 AlarmNo=0 Bits=98 count=1",
          "75 SC: Resetting -> Idle", "75 state Idle StateCurrent=4 AlarmNo=0 Bits=97 count=1"],
    "B": ["2 event CMD Reset", "2 cmd Reset accepted: Stopped -> Resetting",
          "2 state Resetting StateCurrent=15 AlarmNo=0 Bits=98 count=0", "7 SC: Resetting -> Idle",
          "7 state Idle StateCurrent=4 AlarmNo=0 Bits=97 count=0", "10 event CMD Start",
          "10 cmd Start accepted: Idle -> Starting", "10 state Starting StateCurrent=3 AlarmNo=0 Bits=98 count=0",
          "12 SC: Starting -> Execute", "12 sequence start: target B, step S10",
          "12 state Execute StateCurrent=6 AlarmNo=0 Bits=98 count=0", "20 step S10 -> S20", "30 event JAM_ROT",
          "70 ALARM 12 rotate timeout in S20 -> internal Abort: Execute -> Aborting",
          "70 state Aborting StateCurrent=8 AlarmNo=12 Bits=106 count=0", "71 SC: Aborting -> Aborted",
          "71 state Aborted StateCurrent=9 AlarmNo=12 Bits=104 count=0", "90 event UNJAM_ROT", "95 event CMD Clear",
          "95 cmd Clear accepted: Aborted -> Clearing", "95 state Clearing StateCurrent=1 AlarmNo=0 Bits=98 count=0",
          "97 SC: Clearing -> Stopped", "97 state Stopped StateCurrent=2 AlarmNo=0 Bits=96 count=0",
          "100 event CMD Reset", "100 cmd Reset accepted: Stopped -> Resetting",
          "100 state Resetting StateCurrent=15 AlarmNo=0 Bits=98 count=0", "105 SC: Resetting -> Idle",
          "105 state Idle StateCurrent=4 AlarmNo=0 Bits=97 count=0", "110 event CMD Start",
          "110 cmd Start accepted: Idle -> Starting", "110 state Starting StateCurrent=3 AlarmNo=0 Bits=98 count=0",
          "112 SC: Starting -> Execute", "112 sequence start: target A, step S10",
          "112 state Execute StateCurrent=6 AlarmNo=0 Bits=98 count=0", "120 step S10 -> S20", "150 step S20 -> S30",
          "160 step S30 -> S40", "160 SC: Execute -> Completing (sequence done)",
          "160 state Completing StateCurrent=16 AlarmNo=0 Bits=98 count=0", "162 SC: Completing -> Complete",
          "162 state Complete StateCurrent=17 AlarmNo=0 Bits=100 count=1"],
    "C": ["0 event PRESS_LOW", "2 event CMD Reset", "2 cmd Reset accepted: Stopped -> Resetting",
          "2 state Resetting StateCurrent=15 AlarmNo=0 Bits=98 count=0", "7 SC: Resetting -> Idle",
          "7 state Idle StateCurrent=4 AlarmNo=0 Bits=97 count=0", "10 event CMD Start",
          "10 cmd Start accepted: Idle -> Starting", "10 state Starting StateCurrent=3 AlarmNo=0 Bits=98 count=0",
          "12 SC: Starting -> Execute", "12 sequence start: target B, step S10",
          "12 state Execute StateCurrent=6 AlarmNo=0 Bits=98 count=0", "20 step S10 -> S20", "50 step S20 -> S30",
          "80 ALARM 13 clamp pressure low / clamp timeout in S30 -> internal Abort: Execute -> Aborting",
          "80 state Aborting StateCurrent=8 AlarmNo=13 Bits=106 count=0", "81 SC: Aborting -> Aborted",
          "81 state Aborted StateCurrent=9 AlarmNo=13 Bits=104 count=0", "100 event PRESS_OK", "105 event CMD Clear",
          "105 cmd Clear accepted: Aborted -> Clearing", "105 state Clearing StateCurrent=1 AlarmNo=0 Bits=98 count=0",
          "107 SC: Clearing -> Stopped", "107 state Stopped StateCurrent=2 AlarmNo=0 Bits=96 count=0",
          "110 event CMD Reset", "110 cmd Reset accepted: Stopped -> Resetting",
          "110 state Resetting StateCurrent=15 AlarmNo=0 Bits=98 count=0", "115 SC: Resetting -> Idle",
          "115 state Idle StateCurrent=4 AlarmNo=0 Bits=97 count=0", "120 event CMD Start",
          "120 cmd Start accepted: Idle -> Starting", "120 state Starting StateCurrent=3 AlarmNo=0 Bits=98 count=0",
          "122 SC: Starting -> Execute", "122 sequence start: target A, step S10",
          "122 state Execute StateCurrent=6 AlarmNo=0 Bits=98 count=0", "130 step S10 -> S20", "160 step S20 -> S30",
          "170 step S30 -> S40", "170 SC: Execute -> Completing (sequence done)",
          "170 state Completing StateCurrent=16 AlarmNo=0 Bits=98 count=0", "172 SC: Completing -> Complete",
          "172 state Complete StateCurrent=17 AlarmNo=0 Bits=100 count=1"],
    "D": ["2 event CMD Reset", "2 cmd Reset accepted: Stopped -> Resetting",
          "2 state Resetting StateCurrent=15 AlarmNo=0 Bits=98 count=0", "7 SC: Resetting -> Idle",
          "7 state Idle StateCurrent=4 AlarmNo=0 Bits=97 count=0", "10 event CMD Start",
          "10 cmd Start accepted: Idle -> Starting", "10 state Starting StateCurrent=3 AlarmNo=0 Bits=98 count=0",
          "12 SC: Starting -> Execute", "12 sequence start: target B, step S10",
          "12 state Execute StateCurrent=6 AlarmNo=0 Bits=98 count=0", "20 step S10 -> S20", "35 event CMD Hold",
          "35 cmd Hold accepted: Execute -> Holding", "35 state Holding StateCurrent=10 AlarmNo=0 Bits=98 count=0",
          "36 SC: Holding -> Held", "36 state Held StateCurrent=11 AlarmNo=0 Bits=96 count=0", "60 event CMD Unhold",
          "60 cmd Unhold accepted: Held -> Unholding", "60 state Unholding StateCurrent=12 AlarmNo=0 Bits=98 count=0",
          "61 SC: Unholding -> Execute", "61 state Execute StateCurrent=6 AlarmNo=0 Bits=98 count=0",
          "62 step S20 -> S30", "72 step S30 -> S40", "72 SC: Execute -> Completing (sequence done)",
          "72 state Completing StateCurrent=16 AlarmNo=0 Bits=98 count=0", "74 SC: Completing -> Complete",
          "74 state Complete StateCurrent=17 AlarmNo=0 Bits=100 count=1", "100 event CMD Reset",
          "100 cmd Reset accepted: Complete -> Resetting",
          "100 state Resetting StateCurrent=15 AlarmNo=0 Bits=98 count=1", "105 SC: Resetting -> Idle",
          "105 state Idle StateCurrent=4 AlarmNo=0 Bits=97 count=1"],
    "E": ["2 event CMD Start", "2 cmd Start rejected in Stopped", "5 event CMD Reset",
          "5 cmd Reset accepted: Stopped -> Resetting", "5 state Resetting StateCurrent=15 AlarmNo=0 Bits=98 count=0",
          "10 SC: Resetting -> Idle", "10 state Idle StateCurrent=4 AlarmNo=0 Bits=97 count=0", "15 event CMD Unhold",
          "15 cmd Unhold rejected in Idle", "20 event CMD Start", "20 cmd Start accepted: Idle -> Starting",
          "20 state Starting StateCurrent=3 AlarmNo=0 Bits=98 count=0", "22 SC: Starting -> Execute",
          "22 sequence start: target B, step S10", "22 state Execute StateCurrent=6 AlarmNo=0 Bits=98 count=0",
          "25 event CMD Start", "25 cmd Start rejected in Execute", "30 step S10 -> S20", "40 event CMD Stop",
          "40 cmd Stop accepted: Execute -> Stopping", "40 state Stopping StateCurrent=7 AlarmNo=0 Bits=98 count=0",
          "42 SC: Stopping -> Stopped", "42 state Stopped StateCurrent=2 AlarmNo=0 Bits=96 count=0",
          "50 event CMD Reset", "50 cmd Reset accepted: Stopped -> Resetting",
          "50 state Resetting StateCurrent=15 AlarmNo=0 Bits=98 count=0", "55 SC: Resetting -> Idle",
          "55 state Idle StateCurrent=4 AlarmNo=0 Bits=97 count=0"]}


def selftest(path):
    t = SelfTest("module_sequence")
    MR = load_json(path or ITEM9_EXAMPLES)["module_run"]
    R = {S["name"].split()[0]: simulate(MR["K"], S["events"]) for S in MR["scenarios"]}
    for s, w in REF_SUM.items():
        r = R[s]
        t.equal(f"{s}: final, StateCurrent, AlarmNo, count, Bits, rotate x, spool, log lines = {w}",
                (r["final"], r["state_current"], r["alarm"], r["count"], r["bits"], r["rx"], r["spool"],
                 len(r["log"])), w)
        t.equal(f"{s}: whole log ({len(REF_LOG[s])} lines) = reference", r["log"], REF_LOG[s])
    a = R["A"]["ticks"]
    t.equal("A: S10 unclamp takes 8 ticks (clamp x 0 -> 8), S20 rotate 30 ticks, S30 clamp 8 + 2 pressure ticks",
            (20 - 12, 50 - 20, 60 - 50), (8, 30, 10))
    t.equal("A: outputs in S20 = ClampSol + SolB (target B)", (a[30]["ClampSol"], a[30]["SolA"], a[30]["SolB"]),
            (1, 0, 1))
    b = R["B"]["ticks"]
    t.true("B: after the abort the clamp spring clamps, the rotate valve keeps spool B (after UNJAM the rotation "
           "continues to B = 30 without a command - energy isolation needs the safety valve)",
           b[72]["ClampSol"] == 0 and b[72]["spool"] == "B" and b[95]["rot_x"] < 30 and b[111]["rot_x"] == 30)
    d = R["D"]["ticks"]
    t.true("D: Held keeps step S20 and its outputs (rotation completes while held)",
           all(x["step"] == 20 and x["SolB"] == 1 for x in d[36:60]) and d[59]["rot_x"] == 30)
    t.equal("data block of A at the end", R["A"]["datablock"],
            {"Status.StateCurrent": 4, "Status.Bits": 97, "Admin.AlarmNo": 0, "Admin.ProdProcessedCount": 1,
             "Command.CntrlCmd": 0, "Command.CmdChangeRequest": 0})
    t.equal("bits text 106 = Busy+Fault+Auto+PartPresent", bits_text(106), "Busy+Fault+Auto+PartPresent")
    # own scenario: Clear + Reset + Start while the rotate is still jammed in the middle -> alarm 10 at the start
    own = simulate(200, [[2, "CMD Reset"], [10, "CMD Start"], [30, "JAM_ROT"], [90, "CMD Clear"], [95, "CMD Reset"],
                         [110, "CMD Start"]])
    t.equal("own: start with the rotate jammed between A and B -> alarm 10, Aborted",
            (own["alarm"], own["final"]), (10, "Aborted"))
    t.equal("own: alarm 10 lines (Starting -> Aborting in one tick, no Execute state line)", own["log"][-5:-2],
            ["112 SC: Starting -> Execute",
             "112 ALARM 10 rotate not in an end position at start -> internal Abort: Execute -> Aborting",
             "112 state Aborting StateCurrent=8 AlarmNo=10 Bits=106 count=0"])
    t.equal("parse --events", parse_events("2:cmd reset, 30:jam_rot"), [[2, "CMD Reset"], [30, "JAM_ROT"]])
    try:
        parse_events("2:CMD Explode")
        t.true("unknown command -> InputError", False)
    except InputError:
        t.true("unknown command -> InputError", True)
    t.equal("PackML tables reused from packml_sim (17 states, 9 commands)", (len(STATES), len(CMDS)), (17, 9))
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM9_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="all scenarios: summary (default)")
    ap.add_argument("--scenario", help="only this scenario: A..E")
    ap.add_argument("--log", action="store_true", help="print the full log (always with --scenario)")
    ap.add_argument("--trace", action="store_true", help="print a per-tick table")
    ap.add_argument("--events", help="own events TICK:KIND,... (replaces the scenario events)")
    ap.add_argument("--K", type=int, help="own number of ticks")
    ap.add_argument("--md", help="write a Markdown report")
    ap.add_argument("--csv", help="write the log(s) to a CSV file")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    MR = dict(load_json(a.examples)["module_run"])
    if a.K is not None:
        if a.K < 1:
            raise InputError("--K must be >= 1")
        MR["K"] = a.K
    scen = [pick(MR, a.scenario)] if a.scenario else list(MR["scenarios"])
    ev = parse_events(a.events) if a.events is not None else None
    runs = []
    for S in scen:
        S2 = dict(S)
        if ev is not None:
            S2["events"] = ev
            S2["name"] = S["name"].split()[0] + " (own events)"
        runs.append((S2, simulate(MR["K"], S2["events"])))
    if a.md:
        Path(a.md).write_text(md_runs(runs), encoding="utf-8")
    if a.json:
        print(json.dumps([{"scenario": S["name"], "final": r["final"], "state_current": r["state_current"],
                           "alarm": r["alarm"], "count": r["count"], "bits": r["bits"], "rotate_x": r["rx"],
                           "spool": r["spool"], "datablock": r["datablock"], "log": r["log"],
                           "log_lines": len(r["log"])} for S, r in runs], indent=1))
        return 0
    show(MR, runs, a.log or bool(a.scenario), a.trace, a.csv)
    if a.md:
        print(f"\nMarkdown written: {a.md}")
    return 0


if __name__ == "__main__":
    run_main(main)
