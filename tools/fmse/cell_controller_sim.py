#!/usr/bin/env python3
"""Cell-controller logic simulation: MES -> job buffer -> load station -> vehicle -> machines -> confirmations.

Python 3 standard library only, offline. Rules = "cell_sim._rules" in examples/item5_examples.json, applied
EXACTLY (no random numbers). The guide (docs/FMS system design/65_control_architecture.md) and the web page
(FMS engineering -> item 5) use the same rules, so the message log must be identical line by line.

One time step per minute, t = 0, 1, ..., T. In every step, in this order:
  1 EXTERNAL     events of this minute (FAULT / REPAIRED of a machine, MES_DOWN / MES_UP of the MES link)
                 FAULT: machine marked faulted (not routable); if executing: remaining = end - t, state Held
                 REPAIRED: fault mark cleared; if remaining stored: end = t + remaining, state Execute
  2 COMPLETIONS  with end == t: vehicle move, then machines by index, then the load station
                 move to a machine  -> START (Execute, end = t + machining time of the pallet's job)
                 move to the LS     -> ARRIVE_LS, pallet joins the LS queue, CONF(job) into the outbox
                 machine end        -> DONE (Complete, pallet waits), vehicle request (pallet -> LS)
                 load station end   -> LOADED, pallet READY with its new job
  3 MES          link up: SEND_CONF every confirmation of the outbox, then receive at most ONE job (JOB)
                 if job buffer < job_buffer_max and the MES still has jobs. Link down: nothing.
  4 DECISIONS    (a) LS free + queue + job in buffer -> LOAD (end = t + load_min)
                     LS free + queue + buffer empty + MES still has jobs -> 1 starved minute
                 (b) READY pallets in READY order -> lowest-index Idle machine (not reserved, not faulted):
                     ROUTE, reserve it, vehicle request (pallet -> machine)
                 (c) vehicle free + requests -> first request (FIFO), MOVE (end = t + move_min);
                     a machine whose pallet is taken away becomes Idle + unreserved at the start of the move
KPIs at T: jobs started, jobs completed, confirmations sent, outbox at T, max outbox, starved minutes,
Execute minutes per machine (minutes t of the run with state Execute, i.e. t in [start, end)), Held minutes.
"""

import argparse

from fmse_common import (ITEM5_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main, write_csv)

GANTT_CHAR = {"Idle": ".", "Execute": "E", "Complete": "C", "Held": "H"}


# ----------------------------------------------------------------------------- model check
def check_cell(C):
    for k in ("T", "load_min", "move_min", "job_buffer_max", "pallets", "machines", "jobs", "events"):
        if k not in C:
            raise InputError(f"cell_sim: value '{k}' is missing")
    for k in ("T", "load_min", "move_min", "job_buffer_max"):
        if not isinstance(C[k], int) or C[k] < (0 if k == "T" else 1):
            raise InputError(f"cell_sim: '{k}' must be a whole number >= {0 if k == 'T' else 1}")
    if not C["pallets"] or not C["machines"]:
        raise InputError("cell_sim: need at least one pallet and one machine")
    for j in C["jobs"]:
        if len(j) != 3 or not isinstance(j[2], int) or j[2] < 1:
            raise InputError(f"cell_sim: job {j!r} must be [id, program, machining minutes >= 1]")
    check_events(C["events"], C["machines"])


def check_events(events, machines):
    for e in events:
        if len(e) != 3 or not isinstance(e[0], int):
            raise InputError(f"cell_sim: event {e!r} must be [minute, type, object]")
        if e[1] not in ("FAULT", "REPAIRED", "MES_DOWN", "MES_UP"):
            raise InputError(f"cell_sim: event type '{e[1]}' unknown (FAULT, REPAIRED, MES_DOWN, MES_UP)")
        if e[1] in ("FAULT", "REPAIRED") and e[2] not in machines:
            raise InputError(f"cell_sim: event {e!r}: machine '{e[2]}' unknown")


# ----------------------------------------------------------------------------- the simulation
def simulate(C, events=None, buffer_max=None):
    """Run the rules. Returns dict(log=[str], kpi={...}, trace={object: [state per minute 0..T]})."""
    T, LOAD, MOVE = C["T"], C["load_min"], C["move_min"]
    bmax = C["job_buffer_max"] if buffer_max is None else buffer_max
    events = C["events"] if events is None else events
    names = list(C["machines"])
    mt = {j[0]: j[2] for j in C["jobs"]}
    ev = sorted(enumerate(events), key=lambda x: (x[1][0], x[0]))          # time, then list order
    ev = [e for _, e in ev]
    mes_jobs = [j[0] for j in C["jobs"]]                                   # still at the MES
    buf, outbox, ready, requests, ls_queue = [], [], [], [], list(C["pallets"])
    pjob = {p: None for p in C["pallets"]}                                 # job held by each pallet
    M = [{"name": n, "state": "Idle", "end": None, "rem": None, "fault": False, "res": None, "pal": None}
         for n in names]
    idx = {n: k for k, n in enumerate(names)}
    veh = None                                                             # (pallet, from, to, end)
    ls = None                                                              # (pallet, job, end)
    mes_up = True
    log = []
    k = {"started": 0, "done": 0, "sent": 0, "max_outbox": 0, "starved": 0,
         "exec": {n: 0 for n in names}, "held": {n: 0 for n in names}}
    trace = {n: [] for n in names}
    trace["LS"], trace["Vehicle"] = [], []
    ei = 0
    for t in range(T + 1):
        L = lambda s: log.append(f"{t} {s}")
        # 1 external events
        while ei < len(ev) and ev[ei][0] < t:
            ei += 1
        while ei < len(ev) and ev[ei][0] == t:
            _, typ, obj = ev[ei]
            ei += 1
            if typ == "FAULT":
                m = M[idx[obj]]
                m["fault"] = True
                if m["state"] == "Execute":
                    m["rem"], m["end"], m["state"] = m["end"] - t, None, "Held"
                L(f"FAULT {obj} {m['state']}")
            elif typ == "REPAIRED":
                m = M[idx[obj]]
                m["fault"] = False
                if m["rem"] is not None:
                    m["end"], m["rem"], m["state"] = t + m["rem"], None, "Execute"
                L(f"REPAIRED {obj} {m['state']}")
            elif typ == "MES_DOWN":
                mes_up = False
                L("MES_DOWN")
            else:
                mes_up = True
                L("MES_UP")
        # 2 completions: vehicle, machines by index, load station
        if veh and veh[3] == t:
            p, frm, to, _ = veh
            veh = None
            if to == "LS":
                ls_queue.append(p)
                outbox.append(pjob[p])
                L(f"ARRIVE_LS {p} {pjob[p]}")
            else:
                m = M[idx[to]]
                m["pal"] = p
                if m["fault"]:                     # not in the JSON scenarios: arrive at a faulted machine
                    m["state"], m["rem"], m["end"] = "Held", mt[pjob[p]], None
                else:
                    m["state"], m["end"] = "Execute", t + mt[pjob[p]]
                k["started"] += 1
                L(f"START {to} {p} {pjob[p]}")
        for m in M:
            if m["state"] == "Execute" and m["end"] == t:
                m["state"], m["end"] = "Complete", None
                k["done"] += 1
                requests.append((m["pal"], m["name"], "LS"))
                L(f"DONE {m['name']} {m['pal']} {pjob[m['pal']]}")
        if ls and ls[2] == t:
            p, j, _ = ls
            ls = None
            pjob[p] = j
            ready.append(p)
            L(f"LOADED {p} {j}")
        k["max_outbox"] = max(k["max_outbox"], len(outbox))
        # 3 MES
        if mes_up:
            while outbox:
                L(f"SEND_CONF {outbox.pop(0)}")
                k["sent"] += 1
            if len(buf) < bmax and mes_jobs:
                buf.append(mes_jobs.pop(0))
                L(f"JOB {buf[-1]}")
        # 4 decisions
        if ls is None and ls_queue:
            if buf:
                p, j = ls_queue.pop(0), buf.pop(0)
                ls = (p, j, t + LOAD)
                L(f"LOAD {p} {j}")
            elif mes_jobs:
                k["starved"] += 1
        for p in list(ready):
            free = [m for m in M if m["state"] == "Idle" and m["res"] is None and not m["fault"]]
            if not free:
                break
            m = free[0]
            m["res"] = p
            ready.remove(p)
            requests.append((p, "LS", m["name"]))
            L(f"ROUTE {p} {m['name']}")
        if veh is None and requests:
            p, frm, to = requests.pop(0)
            if frm != "LS":
                m = M[idx[frm]]
                m["state"], m["res"], m["pal"] = "Idle", None, None
            veh = (p, frm, to, t + MOVE)
            L(f"MOVE {p} {frm}->{to}")
        # minute statistics (state during minute t = state after the step)
        for m in M:
            if m["state"] == "Execute":
                k["exec"][m["name"]] += 1
            elif m["state"] == "Held":
                k["held"][m["name"]] += 1
            trace[m["name"]].append(m["state"])
        trace["LS"].append("L" if ls else ".")
        trace["Vehicle"].append("M" if veh else ".")
    k["outbox_T"] = len(outbox)
    k["jobs_left_mes"] = len(mes_jobs)
    k["buffer_T"] = len(buf)
    return {"log": log, "kpi": k, "trace": trace, "T": T}


def mes_events(C, which, mes_down=None):
    """Event list of scenario a / b, or scenario a with the MES outage replaced by [down, up)."""
    if which not in ("a", "b"):
        raise InputError("--scenario must be a or b")
    if which == "b":
        if "events_b" not in C:
            raise InputError("cell_sim: 'events_b' is missing")
        events = C["events_b"]
    else:
        events = C["events"]
    if mes_down:
        try:
            d, u = [int(x) for x in mes_down.split(",")]
        except ValueError:
            raise InputError("--mes-down must be two whole minutes, e.g. 50,140")
        if not 0 <= d < u:
            raise InputError("--mes-down: need 0 <= down < up")
        events = [e for e in events if e[1] not in ("MES_DOWN", "MES_UP")]
        events += [[d, "MES_DOWN", ""], [u, "MES_UP", ""]]
    check_events(events, C["machines"])
    return events


# ----------------------------------------------------------------------------- output
def kpi_rows(C, r):
    k = r["kpi"]
    rows = [["jobs started (START)", k["started"]], ["jobs completed (DONE)", k["done"]],
            ["confirmations sent", k["sent"]], ["outbox at T", k["outbox_T"]], ["max outbox", k["max_outbox"]],
            ["starved minutes (load station)", k["starved"]]]
    for n in C["machines"]:
        rows.append([f"Execute minutes {n}", k["exec"][n]])
    for n in C["machines"]:
        if k["held"][n]:
            rows.append([f"Held minutes {n}", k["held"][n]])
    for n in C["machines"]:
        rows.append([f"utilisation {n} (Execute / {r['T']} min)", f"{100 * k['exec'][n] / r['T']:.1f} %"])
    return rows


def gantt(C, r, step=10):
    """One character per `step` minutes = the state with most minutes in that slot (ties: first seen).

    Vehicle row: the number of minutes it is moving in the slot (moves last only move_min minutes).
    """
    T = r["T"]
    lines = []
    scale = "".join(str((s * step // 100) % 10) if (s * step) % 100 == 0 else " " for s in range(T // step + 1))
    lines.append(f"{'':8} {scale}   (digit = hundreds of minutes, 1 char = {step} min)")
    for name in list(C["machines"]) + ["LS", "Vehicle"]:
        tr = r["trace"][name]
        s = ""
        for a in range(0, T + 1, step):
            seg = tr[a:a + step]
            if name == "Vehicle":              # moves are short: show the busy minutes in the slot
                n = seg.count("M")
                s += "." if n == 0 else (str(n) if n < 10 else "X")
                continue
            cnt = {}
            for x in seg:
                cnt[x] = cnt.get(x, 0) + 1
            best = max(cnt, key=lambda x: (cnt[x], -seg.index(x)))
            s += GANTT_CHAR.get(best, best)
        lines.append(f"{name:8} {s}")
    lines.append("legend: E Execute  H Held  C Complete (pallet waits for the vehicle)  . idle  "
                 "L loading")
    lines.append("        vehicle row: number of moving minutes in the 10-min slot (X = 10)")
    return "\n".join(lines)


def show(C, which, r, show_log, csv_path):
    print(f"CELL-CONTROLLER SIMULATION - scenario {which.upper()}  (T = {r['T']} min, "
          f"buffer max {r['buf_max']}, events {r['events']})")
    if show_log:
        print()
        for line in r["log"]:
            print("  " + line)
        print(f"  ({len(r['log'])} log lines)")
    print()
    print(fmt_table(["KPI at T", "value"], kpi_rows(C, r)))
    print()
    print(gantt(C, r))
    if csv_path:
        rows = []
        for line in r["log"]:
            parts = line.split(" ", 3)
            rows.append([parts[0], parts[1], parts[2] if len(parts) > 2 else "", parts[3] if len(parts) > 3 else ""])
        p = write_csv(csv_path, ["t_min", "event", "object", "details"], rows)
        print(f"\nCSV written: {p}")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("cell_controller_sim")
    _, C = load_examples(path, "cell_sim")
    check_cell(C)
    ra = simulate(C)
    k = ra["kpi"]
    t.equal("A: started 12", k["started"], 12)
    t.equal("A: done 12", k["done"], 12)
    t.equal("A: confirmations sent 12", k["sent"], 12)
    t.equal("A: outbox at T 0", k["outbox_T"], 0)
    t.equal("A: max outbox 1", k["max_outbox"], 1)
    t.equal("A: starved 0", k["starved"], 0)
    t.equal("A: Execute minutes MC01 150 / MC02 140 / MC03 130",
            (k["exec"]["MC01"], k["exec"]["MC02"], k["exec"]["MC03"]), (150, 140, 130))
    t.equal("A: MC02 held 25 (60..84)", k["held"]["MC02"], 25)
    first = ["0 JOB J01", "0 LOAD P1 J01", "1 JOB J02", "2 JOB J03", "3 JOB J04", "10 LOADED P1 J01",
             "10 LOAD P2 J02", "10 ROUTE P1 MC01", "10 MOVE P1 LS->MC01", "11 JOB J05", "12 START MC01 P1 J01"]
    t.equal("A: first 11 log lines = lead reference", ra["log"][:11], first)
    t.true("A: 'FAULT MC02 Held' and 'REPAIRED MC02 Execute' logged",
           "60 FAULT MC02 Held" in ra["log"] and "85 REPAIRED MC02 Execute" in ra["log"])
    # hand check: total Execute minutes = sum of machining times of the 12 jobs (all done before T)
    t.equal("A: sum Execute = sum machining times 420", sum(k["exec"].values()), sum(j[2] for j in C["jobs"]))
    # hand check: P1 J01 starts 12 and is done at 12 + 30 = 42
    t.true("A: 42 DONE MC01 P1 J01", "42 DONE MC01 P1 J01" in ra["log"])
    rb = simulate(C, C["events_b"])
    kb = rb["kpi"]
    t.equal("B: max outbox 6", kb["max_outbox"], 6)
    t.equal("B: starved 52", kb["starved"], 52)
    t.equal("B: Execute MC01 180 / MC02 110 / MC03 130",
            (kb["exec"]["MC01"], kb["exec"]["MC02"], kb["exec"]["MC03"]), (180, 110, 130))
    t.equal("B: MC02 held 25", kb["held"]["MC02"], 25)
    t.true("B: no confirmation sent while the MES is down (50..139)",
           not any(l.split()[1] == "SEND_CONF" and 50 <= int(l.split()[0]) < 140 for l in rb["log"]))
    t.true("B: no job received while the MES is down",
           not any(l.split()[1] == "JOB" and 50 <= int(l.split()[0]) < 140 for l in rb["log"]))
    t.equal("--mes-down 50,80 reproduces scenario A", simulate(C, mes_events(C, "a", "50,80"))["log"], ra["log"])
    rbig = simulate(C, C["events_b"], buffer_max=12)
    t.equal("B with buffer 12: no starved minutes", rbig["kpi"]["starved"], 0)
    try:
        mes_events(C, "a", "90,40")
        t.true("bad --mes-down -> InputError", False)
    except InputError:
        t.true("bad --mes-down -> InputError", True)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/cell_controller_sim.py                 (scenario A: KPIs + Gantt)\n"
               "  python tools/fmse/cell_controller_sim.py --log           (full message log)\n"
               "  python tools/fmse/cell_controller_sim.py --scenario b --log --csv log_b.csv\n"
               "  python tools/fmse/cell_controller_sim.py --scenario b --buffer 6\n"
               "  python tools/fmse/cell_controller_sim.py --mes-down 50,200")
    ap.add_argument("--examples", default=str(ITEM5_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--scenario", default="a", choices=["a", "b", "A", "B"], help="a = events, b = events_b")
    ap.add_argument("--log", action="store_true", help="print the full message log")
    ap.add_argument("--csv", help="write the log to this CSV file")
    ap.add_argument("--buffer", type=int, help="job buffer size (default: job_buffer_max of the JSON)")
    ap.add_argument("--mes-down", help="replace the MES outage by DOWN,UP minutes, e.g. 50,140")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, C = load_examples(a.examples, "cell_sim")
    check_cell(C)
    which = a.scenario.lower()
    if a.buffer is not None and a.buffer < 1:
        raise InputError("--buffer must be >= 1")
    events = mes_events(C, which, a.mes_down)
    r = simulate(C, events, a.buffer)
    r["buf_max"] = a.buffer or C["job_buffer_max"]
    r["events"] = ", ".join(f"{e[0]} {e[1]}{(' ' + e[2]) if e[2] else ''}" for e in events)
    show(C, which, r, a.log, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
