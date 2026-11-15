#!/usr/bin/env python3
"""PackML state machine (ISA-TR88.00.02): run command sequences, show accepted / rejected commands,
print the full transition table.

Python 3 standard library only, offline. Rules = "_formulas.packml" in examples/item5_examples.json; the state
numbers, command numbers, edges and mode rules are copied from web/fmse5_data.js (the self-test checks that
the web file still has the same tables). Guide: docs/FMS system design/65_control_architecture.md, section 6.

Rules:
  - start state Stopped (2); the module is in one mode (Production, Maintenance, Manual)
  - a command is ACCEPTED only if (1) the mode allows it (MODES) and (2) the current state has a transition
    for it; otherwise it is REJECTED: the state does not change and the log says why
  - transitions: the EDGES list (e.g. Idle --Start--> Starting) plus
      Stop  from every state except Stopped, Stopping, Aborting, Aborted, Clearing  -> Stopping
      Abort from every state except Aborting, Aborted                               -> Aborting
  - 'SC' (state complete) finishes an acting state (Resetting, Starting, Execute, Completing, Holding,
    Unholding, Suspending, Unsuspending, Stopping, Aborting, Clearing); in a wait state (Stopped, Idle,
    Complete, Held, Suspended, Aborted) SC is rejected. SC is not an operator command, so no mode check.
  - mode change (write 'Mode=Manual' in a command list) only in Stopped, Idle or Aborted
"""

import argparse
from pathlib import Path

from fmse_common import (ITEM5_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, read_js_const,
                         run_main, write_csv)

WEB_DATA = Path(__file__).resolve().parent.parent.parent / "web" / "fmse5_data.js"

# ---- copied from web/fmse5_data.js (self-test compares) --------------------------------------------------
STATES = {"Clearing": 1, "Stopped": 2, "Starting": 3, "Idle": 4, "Suspended": 5, "Execute": 6, "Stopping": 7,
          "Aborting": 8, "Aborted": 9, "Holding": 10, "Held": 11, "Unholding": 12, "Suspending": 13,
          "Unsuspending": 14, "Resetting": 15, "Completing": 16, "Complete": 17}
CMDS = {"Reset": 1, "Start": 2, "Stop": 3, "Hold": 4, "Unhold": 5, "Suspend": 6, "Unsuspend": 7, "Abort": 8,
        "Clear": 9}
EDGES = [["Stopped", "Resetting", "Reset"], ["Resetting", "Idle", "SC"], ["Idle", "Starting", "Start"],
         ["Starting", "Execute", "SC"], ["Execute", "Completing", "SC"], ["Completing", "Complete", "SC"],
         ["Complete", "Resetting", "Reset"],
         ["Execute", "Holding", "Hold"], ["Holding", "Held", "SC"], ["Held", "Unholding", "Unhold"],
         ["Unholding", "Execute", "SC"],
         ["Execute", "Suspending", "Suspend"], ["Suspending", "Suspended", "SC"],
         ["Suspended", "Unsuspending", "Unsuspend"], ["Unsuspending", "Execute", "SC"],
         ["Stopping", "Stopped", "SC"], ["Aborting", "Aborted", "SC"], ["Aborted", "Clearing", "Clear"],
         ["Clearing", "Stopped", "SC"]]
MODES = {"Production": ["Reset", "Start", "Stop", "Hold", "Unhold", "Suspend", "Unsuspend", "Abort", "Clear"],
         "Maintenance": ["Reset", "Start", "Stop", "Hold", "Unhold", "Abort", "Clear"],
         "Manual": ["Reset", "Start", "Stop", "Abort", "Clear"]}
# ---- rules of _formulas.packml ----------------------------------------------------------------------------
NO_STOP = ("Stopped", "Stopping", "Aborting", "Aborted", "Clearing")
NO_ABORT = ("Aborting", "Aborted")
MODE_CHANGE_OK = ("Stopped", "Idle", "Aborted")
MODE_NO = {"Production": 1, "Maintenance": 2, "Manual": 3}      # PackTags UnitModeCurrent (guide 66, BLOCK)
ALL_CMDS = list(CMDS) + ["SC"]
ACTING = sorted({a for a, _, c in EDGES if c == "SC"}, key=lambda s: STATES[s])
START_STATE = "Stopped"


def target(state, cmd):
    """Next state for (state, command) by the state rules only (no mode check); None = no transition."""
    if cmd == "Stop":
        return None if state in NO_STOP else "Stopping"
    if cmd == "Abort":
        return None if state in NO_ABORT else "Aborting"
    for a, b, c in EDGES:
        if a == state and c == cmd:
            return b
    return None


def step(state, mode, cmd):
    """Apply one command. Returns (new_state, new_mode, accepted, reason)."""
    if cmd.startswith("Mode="):
        m = cmd[5:]
        if m not in MODES:
            raise InputError(f"unknown mode '{m}' (Production, Maintenance, Manual)")
        if state not in MODE_CHANGE_OK:
            return state, mode, False, f"mode change only in {', '.join(MODE_CHANGE_OK)}"
        return state, m, True, f"mode {mode} -> {m}"
    if cmd not in ALL_CMDS:
        raise InputError(f"unknown command '{cmd}' (use {', '.join(ALL_CMDS)} or Mode=<mode>)")
    if cmd != "SC" and cmd not in MODES[mode]:
        return state, mode, False, f"not allowed in mode {mode}"
    nxt = target(state, cmd)
    if nxt is None:
        if cmd == "SC":
            return state, mode, False, f"{state} is a wait state (no SC)"
        return state, mode, False, f"no transition from {state}"
    return nxt, mode, True, ""


def run(cmds, mode="Production", state=START_STATE):
    """Run a command list. Returns (trace rows, end state, end mode, rejected [(step, cmd, reason)])."""
    if mode not in MODES:
        raise InputError(f"unknown mode '{mode}' (Production, Maintenance, Manual)")
    rows, rej = [], []
    for k, c in enumerate(cmds, 1):
        new, nmode, ok, why = step(state, mode, c)
        rows.append([k, c, f"{state} ({STATES[state]})", f"{new} ({STATES[new]})",
                     "accepted" if ok else "REJECTED", why])
        if not ok:
            rej.append((k, c, why))
        state, mode = new, nmode
    return rows, state, mode, rej


def table_rows(mode=None):
    """Transition table: one row per state (by state number), one column per command + SC."""
    rows = []
    for s in sorted(STATES, key=lambda x: STATES[x]):
        r = [f"{STATES[s]} {s}"]
        for c in ALL_CMDS:
            t = target(s, c)
            if t is None:
                r.append("-")
            elif mode and c != "SC" and c not in MODES[mode]:
                r.append("(mode)")
            else:
                r.append(t)
        rows.append(r)
    return rows


# ----------------------------------------------------------------------------- output
def show_scenario(no, name, mode, cmds, csv_rows=None):
    rows, end, emode, rej = run(cmds, mode)
    print(f"Scenario {no}: {name}   (mode {mode}, start {START_STATE})")
    print(fmt_table(["step", "command", "before", "after", "result", "reason"], rows, "rllllll"[:6]))
    rtxt = ", ".join(f"{c} (step {k})" for k, c, _ in rej) or "none"
    print(f"  END STATE: {end} ({STATES[end]})   mode {emode}   rejected: {rtxt}")
    if csv_rows is not None:
        for r in rows:
            csv_rows.append([no, name, mode] + r)
    return end, rej


def show_table(mode=None, csv_path=None):
    rows = table_rows(mode)
    head = ["state"] + [f"{c}" + (f" ({CMDS[c]})" if c in CMDS else "") for c in ALL_CMDS]
    print("PACKML TRANSITION TABLE  (row = current state, column = command, cell = next state, '-' = rejected)"
          + (f"\n  mode {mode}: '(mode)' = transition exists but the mode does not allow the command" if mode else ""))
    print(fmt_table(head, rows, "l" * len(head)))
    n_cmd = sum(1 for r in table_rows() for x in r[1:-1] if x != "-")
    n_sc = sum(1 for r in table_rows() if r[-1] != "-")
    print(f"  {n_cmd} accepted (state, command) pairs + {n_sc} SC transitions; acting states: {', '.join(ACTING)}")
    print(f"  mode change allowed only in: {', '.join(MODE_CHANGE_OK)}")
    for m, cl in MODES.items():
        print(f"  mode {m} ({MODE_NO[m]}) allows: {', '.join(cl)}")
    if csv_path:
        p = write_csv(csv_path, head, rows)
        print(f"\nCSV written: {p}")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("packml_sim")
    data, sc = load_examples(path, "packml_scenarios")
    t.equal("6 scenarios in the JSON", len(sc), 6)
    want = [("Idle", []), ("Execute", []), ("Execute", []), ("Idle", []),
            ("Idle", ["Start", "Unhold"]), ("Stopped", ["Hold", "Suspend"])]
    for k, (s, (we, wr)) in enumerate(zip(sc, want), 1):
        _, end, _, rej = run(s["cmds"], s["mode"])
        t.equal(f"scenario {k} '{s['name']}' ends {we}", end, we)
        t.equal(f"scenario {k} rejected {wr or 'none'}", [c for _, c, _ in rej], wr)
    # hand checks of single rules
    t.equal("Stopped + Start -> rejected (no transition)", step("Stopped", "Production", "Start")[2], False)
    t.equal("Idle + SC -> rejected (wait state)", step("Idle", "Production", "SC")[3], "Idle is a wait state (no SC)")
    t.equal("Execute + SC -> Completing (Execute is an acting state)", step("Execute", "Production", "SC")[0],
            "Completing")
    t.equal("Held + Stop -> Stopping", step("Held", "Production", "Stop")[0], "Stopping")
    t.equal("Clearing + Stop -> rejected", step("Clearing", "Production", "Stop")[2], False)
    t.equal("Stopped + Abort -> Aborting", step("Stopped", "Production", "Abort")[0], "Aborting")
    t.equal("Aborted + Abort -> rejected", step("Aborted", "Production", "Abort")[2], False)
    t.equal("Maintenance: Execute + Suspend -> rejected by mode",
            step("Execute", "Maintenance", "Suspend")[3], "not allowed in mode Maintenance")
    t.equal("mode change in Execute rejected", step("Execute", "Production", "Mode=Manual")[2], False)
    t.equal("mode change in Idle accepted", step("Idle", "Production", "Mode=Manual")[1], "Manual")
    # counts of the table: 8 command edges + Stop from 12 states + Abort from 15 states = 35; 11 SC edges
    n_cmd = sum(1 for r in table_rows() for x in r[1:-1] if x != "-")
    t.equal("table: 8 + 12 + 15 = 35 accepted command pairs", n_cmd, 35)
    t.equal("table: 11 SC transitions (acting states)", len(ACTING), 11)
    t.equal("17 states numbered 1..17", sorted(STATES.values()), list(range(1, 18)))
    try:
        run(["Reset", "Jump"])
        t.true("unknown command -> InputError", False)
    except InputError:
        t.true("unknown command -> InputError", True)
    # the copy must still match the web page
    if WEB_DATA.is_file():
        for name, mine in (("STATES", STATES), ("CMDS", CMDS), ("EDGES", EDGES), ("MODES", MODES)):
            t.equal(f"web/fmse5_data.js {name} = copy in this tool", read_js_const(WEB_DATA, name), mine)
    else:
        print(f"  NOTE  {WEB_DATA} not found - web comparison skipped")
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/packml_sim.py                      (the 6 JSON scenarios)\n"
               "  python tools/fmse/packml_sim.py --scenario 6 --csv trace6.csv\n"
               "  python tools/fmse/packml_sim.py --table --csv packml_table.csv\n"
               "  python tools/fmse/packml_sim.py --table --mode Manual\n"
               "  python tools/fmse/packml_sim.py --mode Maintenance --cmds Reset,SC,Start,SC,Suspend,Hold,SC\n"
               "  python tools/fmse/packml_sim.py --cmds Reset,SC,Mode=Manual,Start,SC,Hold")
    ap.add_argument("--examples", default=str(ITEM5_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--scenario", default="all", help="all or the scenario number 1..6")
    ap.add_argument("--table", action="store_true", help="print the full transition table (state x command)")
    ap.add_argument("--mode", help="mode for --cmds or --table: Production, Maintenance, Manual")
    ap.add_argument("--cmds", help="own command list, e.g. Reset,SC,Start,SC,Hold (Mode=Manual changes mode)")
    ap.add_argument("--csv", help="write the trace (or with --table the table) to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    if a.mode and a.mode not in MODES:
        raise InputError(f"--mode must be one of {', '.join(MODES)}")
    if a.table:
        show_table(a.mode, a.csv)
        return 0
    csv_rows = []
    if a.cmds:
        cmds = [c.strip() for c in a.cmds.split(",") if c.strip()]
        show_scenario("own", "command list from --cmds", a.mode or "Production", cmds, csv_rows)
    else:
        _, sc = load_examples(a.examples, "packml_scenarios")
        if a.scenario == "all":
            sel = list(range(1, len(sc) + 1))
        else:
            try:
                sel = [int(a.scenario)]
            except ValueError:
                raise InputError("--scenario must be 'all' or a number")
            if not 1 <= sel[0] <= len(sc):
                raise InputError(f"--scenario must be 1..{len(sc)}")
        summary = []
        for k, no in enumerate(sel):
            s = sc[no - 1]
            if k:
                print()
            end, rej = show_scenario(no, s["name"], s.get("mode", "Production"), s["cmds"], csv_rows)
            summary.append([no, s["name"], s.get("mode", "Production"), f"{end} ({STATES[end]})",
                            ", ".join(c for _, c, _ in rej) or "-"])
        if len(sel) > 1:
            print()
            print("SUMMARY")
            print(fmt_table(["#", "scenario", "mode", "end state", "rejected"], summary, "rllll"))
    if a.csv:
        p = write_csv(a.csv, ["scenario", "name", "mode", "step", "command", "before", "after", "result", "reason"],
                      csv_rows)
        print(f"\nCSV written: {p}")
    return 0


if __name__ == "__main__":
    run_main(main)
