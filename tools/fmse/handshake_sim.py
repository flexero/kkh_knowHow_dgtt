#!/usr/bin/env python3
"""Handshake + heartbeat simulation: cell controller (CC) <-> module (MOD) over a polled data block.

Python 3 standard library only, offline. Rules = "handshake_sim._rules" in examples/item6_examples.json, applied
EXACTLY (deterministic, no random numbers). Guide docs/FMS system design/66_communication.md and the web page use
the same rules, so the log must be identical line by line.

Model (short form of the rules):
  ticks k = 0..K, one tick = 100 ms = poll period. CC image: Request, Ack, JobId, HB. MOD image: Ready, Busy,
  Done, HSReady, HB, JobId. ONE-TICK DELAY: each actor decides on the snapshot of the other side taken at the
  start of the tick (= end of tick k-1). Order in a tick (and in the log): 1 events, 2 MOD, 3 CC.
  Events: MOD_FREEZE / MOD_RESUME, CC_FREEZE / CC_RESUME, IGNORE_REQ_ON / IGNORE_REQ_OFF, CC_RESET.
  Heartbeat +1 every hb_period ticks; partner heartbeat unchanged for hb_timeout ticks -> loss.
  MOD:  IDLE -(Request)-> ACCEPT -(Request=0)-> EXEC -(end)-> DONE -(Ack)-> IDLE
  CC:   S0 WAIT_READY -> S1 WAIT_ACCEPT -> S2 WAIT_RELEASE -> S3 WAIT_DONE -> S4 WAIT_DONE_CLEAR -> S0
        time-outs -> ERR (waits for CC_RESET); comm loss -> OFFLINE, on return RESYNC (DONE / BUSY / IDLE).
KPIs: log lines, completed jobs with tick, final CC state, HS / JOB time-outs, comm-loss detection delay.

Usage:
  python tools/fmse/handshake_sim.py                     (all 4 scenarios: KPIs; = --example)
  python tools/fmse/handshake_sim.py --scenario B --log  (full log of scenario B)
  python tools/fmse/handshake_sim.py --scenario A --exec 30 --events 60:CC_FREEZE,75:CC_RESUME --log
  python tools/fmse/handshake_sim.py --json --csv log.csv
  python tools/fmse/handshake_sim.py --selftest
"""

import argparse
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_examples, run_main, write_csv

HERE = Path(__file__).resolve().parent
ITEM6_EXAMPLES = HERE / "examples" / "item6_examples.json"
EVENT_KINDS = ("MOD_FREEZE", "MOD_RESUME", "CC_FREEZE", "CC_RESUME", "IGNORE_REQ_ON", "IGNORE_REQ_OFF", "CC_RESET")


def check_hs(H):
    for k in ("K", "tick_ms", "hs_timeout_ticks", "job_timeout_ticks", "hb_period_ticks", "hb_timeout_ticks",
              "scenarios"):
        if k not in H:
            raise InputError(f"handshake_sim: value '{k}' is missing")
    for k in ("K", "hs_timeout_ticks", "job_timeout_ticks", "hb_period_ticks", "hb_timeout_ticks"):
        if not isinstance(H[k], int) or H[k] < 1:
            raise InputError(f"handshake_sim: '{k}' must be a whole number >= 1")


def check_events(events):
    for e in events:
        if len(e) != 2 or not isinstance(e[0], int) or e[0] < 0:
            raise InputError(f"handshake_sim: event {e!r} must be [tick >= 0, kind]")
        if e[1] not in EVENT_KINDS:
            raise InputError(f"handshake_sim: event kind '{e[1]}' unknown ({', '.join(EVENT_KINDS)})")


def simulate(H, jobs, exec_ticks, events):
    """Run the rules. Returns dict(log, completions [(job, tick)], final, hs_timeouts, job_timeouts, ...)."""
    check_events(events)
    K, HB_P, HB_T = H["K"], H["hb_period_ticks"], H["hb_timeout_ticks"]
    HS_T, JOB_T = H["hs_timeout_ticks"], H["job_timeout_ticks"]
    cc = {"Request": 0, "Ack": 0, "JobId": 0, "HB": 0}
    md = {"Ready": 1, "Busy": 0, "Done": 0, "HSReady": 0, "HB": 0, "JobId": 0}
    M = {"state": "IDLE", "frozen": False, "f": None, "last": 0, "seen": 0, "lost": False, "ignore": False, "end": None}
    C = {"state": "S0", "t": 0, "frozen": False, "f": None, "last": 0, "seen": 0, "lost": False, "job": None}
    queue = list(jobs)
    log, comp = [], []
    hs_to = job_to = 0
    freeze = {}                                  # 'MOD' / 'CC' -> first freeze tick (for the detection delay)
    loss = {}                                    # 'CC COMM_LOSS' / 'MOD CC_LOSS' -> first tick
    evs = [e for _, e in sorted(enumerate(events), key=lambda x: (x[1][0], x[0]))]
    ei = 0

    def L(k, text):
        log.append(f"{k} {text}")

    for k in range(K + 1):
        snc, snm = dict(cc), dict(md)
        # ---- 1 events
        while ei < len(evs) and evs[ei][0] < k:
            ei += 1                                 # (events before tick 0 are ignored)
        while ei < len(evs) and evs[ei][0] == k:
            kind = evs[ei][1]
            ei += 1
            L(k, f"EVENT {kind}")
            if kind == "MOD_FREEZE":
                M["frozen"], M["f"] = True, k
                freeze.setdefault("MOD", k)
            elif kind == "MOD_RESUME":
                if M["frozen"]:
                    M["frozen"] = False
                    M["last"], M["seen"] = k, snc["HB"]
                    if M["state"] == "EXEC":
                        M["end"] += k - M["f"]
            elif kind == "CC_FREEZE":
                C["frozen"], C["f"] = True, k
                freeze.setdefault("CC", k)
            elif kind == "CC_RESUME":
                if C["frozen"]:
                    C["frozen"] = False
                    C["last"], C["seen"] = k, snm["HB"]
            elif kind == "IGNORE_REQ_ON":
                M["ignore"] = True
            elif kind == "IGNORE_REQ_OFF":
                M["ignore"] = False
            elif kind == "CC_RESET":
                if C["state"] == "ERR":
                    C["state"], C["t"] = "S0", k
        # ---- 2 MOD
        if not M["frozen"]:
            if k > 0 and k % HB_P == 0:
                md["HB"] += 1
            if snc["HB"] != M["seen"]:
                M["seen"], M["last"] = snc["HB"], k
            if not M["lost"] and k - M["last"] >= HB_T:
                M["lost"] = True
                L(k, "MOD CC_LOSS")
                loss.setdefault("MOD CC_LOSS", k)
                if M["state"] == "IDLE":
                    md["Ready"] = 0
            elif M["lost"] and M["last"] == k:
                M["lost"] = False
                L(k, "MOD CC_OK")
                if M["state"] == "IDLE":
                    md["Ready"] = 1
            st = M["state"]
            if st == "IDLE" and not M["lost"] and not M["ignore"] and snc["Request"] == 1:
                md.update(JobId=snc["JobId"], HSReady=1, Busy=1, Ready=0)
                M["state"] = "ACCEPT"
                L(k, f"MOD ACCEPT {md['JobId']}")
            elif st == "ACCEPT" and snc["Request"] == 0:
                md["HSReady"] = 0
                M["end"] = k + exec_ticks
                M["state"] = "EXEC"
                L(k, f"MOD START {md['JobId']}")
            elif st == "EXEC" and k >= M["end"]:
                md["Busy"], md["Done"] = 0, 1
                M["state"] = "DONE"
                L(k, f"MOD DONE {md['JobId']}")
            elif st == "DONE" and snc["Ack"] == 1:
                md["Done"] = 0
                md["Ready"] = 0 if M["lost"] else 1
                M["state"] = "IDLE"
                L(k, f"MOD RELEASE {md['JobId']}")
        # ---- 3 CC
        if C["frozen"]:
            continue
        if k > 0 and k % HB_P == 0:
            cc["HB"] += 1
        if snm["HB"] != C["seen"]:
            C["seen"], C["last"] = snm["HB"], k
        if not C["lost"] and k - C["last"] >= HB_T:
            C["lost"] = True
            cc["Request"] = cc["Ack"] = 0
            if C["state"] != "ERR":
                C["state"], C["t"] = "OFFLINE", k
            L(k, "CC COMM_LOSS")
            loss.setdefault("CC COMM_LOSS", k)
            continue
        if C["lost"] and C["last"] == k:
            C["lost"] = False
            L(k, "CC COMM_OK")
            if C["state"] == "OFFLINE":
                if snm["Done"] == 1:
                    cc["Ack"] = 1
                    C["state"], C["t"] = "S4", k
                    L(k, f"CC RESYNC_DONE {C['job']}")
                elif snm["Busy"] == 1:
                    C["state"], C["t"] = "S3", k
                    L(k, f"CC RESYNC_BUSY {C['job']}")
                else:
                    C["state"], C["t"] = "S0", k
                    L(k, "CC RESYNC_IDLE")
                    if C["job"] is not None:
                        queue.insert(0, C["job"])
                        C["job"] = None
            continue
        if C["lost"]:
            continue
        st, dt, job = C["state"], k - C["t"], C["job"]
        if st == "S0":
            if queue and snm["Ready"] == 1 and snm["Busy"] == 0:
                job = C["job"] = queue.pop(0)
                cc["JobId"], cc["Request"] = job, 1
                C["state"], C["t"] = "S1", k
                L(k, f"CC REQUEST {job}")
        elif st == "S1":
            if snm["HSReady"] == 1:
                cc["Request"] = 0
                C["state"], C["t"] = "S2", k
                L(k, f"CC ACCEPTED {job}")
            elif dt >= HS_T:
                cc["Request"] = 0
                C["state"], C["t"] = "ERR", k
                queue.insert(0, job)
                C["job"] = None
                hs_to += 1
                L(k, f"CC HS_TIMEOUT S1 {job}")
        elif st == "S2":
            if snm["HSReady"] == 0:
                C["state"], C["t"] = "S3", k
                L(k, f"CC RUNNING {job}")
            elif dt >= HS_T:
                C["state"], C["t"] = "ERR", k
                hs_to += 1
                L(k, f"CC HS_TIMEOUT S2 {job}")
        elif st == "S3":
            if snm["Done"] == 1:
                cc["Ack"] = 1
                C["state"], C["t"] = "S4", k
                L(k, f"CC DONE {job}")
            elif dt >= JOB_T:
                C["state"], C["t"] = "ERR", k
                job_to += 1
                L(k, f"CC JOB_TIMEOUT {job}")
        elif st == "S4":
            if snm["Done"] == 0:
                cc["Ack"] = 0
                C["state"], C["t"] = "S0", k
                comp.append((job, k))
                C["job"] = None
                L(k, f"CC COMPLETE {job}")
            elif dt >= HS_T:
                cc["Ack"] = 0
                C["state"], C["t"] = "ERR", k
                hs_to += 1
                L(k, f"CC HS_TIMEOUT S4 {job}")
    delay = {}
    if "MOD" in freeze and "CC COMM_LOSS" in loss:
        delay["CC COMM_LOSS"] = loss["CC COMM_LOSS"] - freeze["MOD"]
    if "CC" in freeze and "MOD CC_LOSS" in loss:
        delay["MOD CC_LOSS"] = loss["MOD CC_LOSS"] - freeze["CC"]
    return {"log": log, "completions": comp, "final": C["state"], "mod_final": M["state"], "hs_timeouts": hs_to,
            "job_timeouts": job_to, "loss": loss, "freeze": freeze, "detection_delay": delay,
            "queue_left": queue}


def run_scenario(H, S, exec_ticks=None, events=None):
    return simulate(H, S["jobs"], S["exec_ticks"] if exec_ticks is None else exec_ticks,
                    S["events"] if events is None else events)


def parse_events(text):
    """'80:MOD_FREEZE,140:MOD_RESUME' -> [[80, 'MOD_FREEZE'], [140, 'MOD_RESUME']] ('' -> no events)."""
    out = []
    for part in [p.strip() for p in str(text).split(",") if p.strip()]:
        if ":" not in part:
            raise InputError(f"--events: '{part}' must be TICK:KIND, e.g. 80:MOD_FREEZE")
        k, kind = part.split(":", 1)
        try:
            k = int(k)
        except ValueError:
            raise InputError(f"--events: tick '{k}' is not a whole number")
        out.append([k, kind.strip().upper()])
    check_events(out)
    return out


def pick(H, name):
    for S in H["scenarios"]:
        if S["name"].split()[0].upper() == name.upper():
            return S
    raise InputError(f"scenario '{name}' not found (A, B, C, D)")


# ----------------------------------------------------------------------------- output
def kpi_row(S, r, tick_ms):
    d = r["detection_delay"]
    return [S["name"].split()[0], len(r["log"]), " ".join(f"{j}@{k}" for j, k in r["completions"]) or "-",
            r["final"], r["hs_timeouts"], r["job_timeouts"],
            ", ".join(f"{n} {v} ticks = {v * tick_ms / 1000:.1f} s" for n, v in d.items()) or "-"]


def show(H, runs, with_log, csv_path):
    print(f"HANDSHAKE SIMULATION  K={H['K']} ticks × {H['tick_ms']} ms, HS time-out {H['hs_timeout_ticks']}, "
          f"job time-out {H['job_timeout_ticks']}, heartbeat every {H['hb_period_ticks']} / time-out "
          f"{H['hb_timeout_ticks']} ticks")
    print()
    for S, r in runs:
        print(f"Scenario {S['name']}   jobs {S['jobs']}, exec {S['exec_ticks']} ticks, events "
              f"{', '.join(f'{e[0]} {e[1]}' for e in S['events']) or '-'}")
        if with_log:
            for line in r["log"]:
                print("  " + line)
        print()
    print("KPIs")
    print(fmt_table(["scen.", "log lines", "completed (job@tick)", "final CC", "HS t/o", "JOB t/o",
                     "loss detection delay"], [kpi_row(S, r, H["tick_ms"]) for S, r in runs], "lrllrrl"))
    if csv_path:
        rows = []
        for S, r in runs:
            for n, line in enumerate(r["log"], 1):
                k, text = line.split(" ", 1)
                rows.append([S["name"].split()[0], n, int(k), text])
        p = write_csv(csv_path, ["scenario", "line", "tick", "text"], rows)
        print(f"\nCSV written: {p}")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("handshake_sim")
    _, H = load_examples(path, "handshake_sim")
    check_hs(H)
    R = {S["name"].split()[0]: run_scenario(H, S) for S in H["scenarios"]}
    want_lines = {"A": 27, "B": 32, "C": 32, "D": 31}
    want_comp = {"A": [(70001, 56), (70002, 113), (70003, 170)], "B": [(70001, 56), (70002, 173), (70003, 230)],
                 "C": [(70001, 56), (70002, 176), (70003, 233)], "D": [(70001, 56), (70002, 152), (70003, 209)]}
    for s in "ABCD":
        t.equal(f"{s}: log lines {want_lines[s]} (lead reference)", len(R[s]["log"]), want_lines[s])
        t.equal(f"{s}: completions {want_comp[s]}", R[s]["completions"], want_comp[s])
        t.equal(f"{s}: final CC state S0", R[s]["final"], "S0")
        t.equal(f"{s}: module back in IDLE", R[s]["mod_final"], "IDLE")
    a = R["A"]["log"]
    first = ["0 CC REQUEST 70001", "1 MOD ACCEPT 70001", "2 CC ACCEPTED 70001", "3 MOD START 70001",
             "4 CC RUNNING 70001", "53 MOD DONE 70001", "54 CC DONE 70001", "55 MOD RELEASE 70001",
             "56 CC COMPLETE 70001"]
    t.equal("A: first job = 9 lines by hand (one-tick delay each step, exec 3 + 50 = 53)", a[:9], first)
    t.equal("A: one job cycle = 57 ticks (56 + 1 to the next REQUEST)", a[9], "57 CC REQUEST 70002")
    t.equal("A: no time-outs", (R["A"]["hs_timeouts"], R["A"]["job_timeouts"]), (0, 0))
    b = R["B"]
    t.true("B: 'CC COMM_LOSS' at 101", "101 CC COMM_LOSS" in b["log"])
    t.equal("B: detection delay 101 - 80 = 21 ticks (last MOD HB change seen at 71, + 30)",
            b["detection_delay"].get("CC COMM_LOSS"), 21)
    t.true("B: CC sees the module again and resyncs (BUSY or DONE)",
           any("CC RESYNC_" in x for x in b["log"]) and any("CC COMM_OK" in x for x in b["log"]))
    t.true("B: module end shifted by the freeze (DONE of 70002 after 140)",
           any(x.endswith("MOD DONE 70002") and int(x.split()[0]) > 140 for x in b["log"]))
    c = R["C"]
    t.true("C: 'CC HS_TIMEOUT S1 70002' at 77", "77 CC HS_TIMEOUT S1 70002" in c["log"])
    t.equal("C: one HS time-out", c["hs_timeouts"], 1)
    t.true("C: CC stays in ERR until CC_RESET at 120, next REQUEST 70002 at 120",
           "120 CC REQUEST 70002" in c["log"]
           and not any(78 <= int(x.split()[0]) < 120 and x.split()[1] == "CC" for x in c["log"]))
    d = R["D"]
    t.true("D: 'MOD CC_LOSS' at 121", "121 MOD CC_LOSS" in d["log"])
    t.equal("D: detection delay 121 - 100 = 21 ticks", d["detection_delay"].get("MOD CC_LOSS"), 21)
    t.true("D: 'MOD CC_OK' after CC_RESUME", any(x.endswith("MOD CC_OK") and int(x.split()[0]) > 150 for x in d["log"]))
    t.true("D: CC itself never reports COMM_LOSS (it was frozen, not the module)",
           not any("CC COMM_LOSS" in x for x in d["log"]))
    t.true("log order inside a tick: EVENT before MOD before CC",
           all(_order_ok(R[s]["log"]) for s in "ABCD"))
    # own scenarios
    rr = simulate(H, [1, 2], 10, [])
    t.equal("own: 2 jobs, exec 10 -> completions 16 and 33", rr["completions"], [(1, 16), (2, 33)])
    r2 = simulate(H, [1], 200, [])
    t.true("own: exec 200 > job time-out 80 -> CC JOB_TIMEOUT", r2["job_timeouts"] == 1 and r2["final"] == "ERR")
    t.equal("parse --events", parse_events("80:mod_freeze, 140:MOD_RESUME"), [[80, "MOD_FREEZE"], [140, "MOD_RESUME"]])
    try:
        parse_events("80:EXPLODE")
        t.true("bad event kind -> InputError", False)
    except InputError:
        t.true("bad event kind -> InputError", True)
    return t.finish()


def _order_ok(log):
    rank = {"EVENT": 0, "MOD": 1, "CC": 2}
    prev = (-1, -1)
    for x in log:
        k, who = int(x.split()[0]), x.split()[1]
        cur = (k, rank[who])
        if cur < prev:
            return False
        prev = cur
    return True


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM6_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the 4 JSON scenarios (also the default)")
    ap.add_argument("--scenario", help="only this scenario: A, B, C or D")
    ap.add_argument("--log", action="store_true", help="print the full log")
    ap.add_argument("--exec", type=int, dest="exec_ticks", help="execution ticks per job (own scenario)")
    ap.add_argument("--events", help="own events TICK:KIND,... (replaces the scenario events; '' = none)")
    ap.add_argument("--jobs", help="own job list, e.g. 1,2,3")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--csv", help="write the log(s) to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, H = load_examples(a.examples, "handshake_sim")
    check_hs(H)
    scen = [pick(H, a.scenario)] if a.scenario else list(H["scenarios"])
    if a.exec_ticks is not None and a.exec_ticks < 1:
        raise InputError("--exec must be >= 1")
    ev = parse_events(a.events) if a.events is not None else None
    jobs = None
    if a.jobs:
        try:
            jobs = [int(x) for x in a.jobs.split(",") if x.strip()]
        except ValueError:
            raise InputError("--jobs must be a comma list of whole numbers")
    runs = []
    for S in scen:
        S2 = dict(S)
        if a.exec_ticks is not None:
            S2["exec_ticks"] = a.exec_ticks
        if ev is not None:
            S2["events"] = ev
        if jobs:
            S2["jobs"] = jobs
        if a.exec_ticks is not None or ev is not None or jobs:
            S2["name"] = S["name"].split()[0] + " (own) " + " ".join(S["name"].split()[1:])
        runs.append((S2, run_scenario(H, S2)))
    if a.json:
        print(json.dumps([{"scenario": S["name"], "log": r["log"], "completions": r["completions"],
                           "final": r["final"], "hs_timeouts": r["hs_timeouts"], "job_timeouts": r["job_timeouts"],
                           "detection_delay": r["detection_delay"], "log_lines": len(r["log"])}
                          for S, r in runs], indent=1))
        return 0
    show(H, runs, a.log or bool(a.scenario), a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
