#!/usr/bin/env python3
"""Device function blocks: FB_AnalogIn (scaling + NAMUR NE 43), limit alarm with hysteresis + on-delay,
FB_MotorDol (direct-on-line motor with run feedback supervision) with a small plant model.

Python 3 standard library only, offline. Rules = "_rules.analog", "_rules.limits" and "_rules.motor" in
examples/item9_examples.json, applied EXACTLY. Guide docs/FMS system design/69_plc_programming.md and the web page
use the same rules, so values and logs are identical line by line.

Rules in short:
  analog  mA = 4 + 16*raw/27648 ; NE 43: <= 3.6 BAD fault low (wire break) ; < 3.8 UNCERTAIN under range ;
          <= 20.5 GOOD ; < 21.0 UNCERTAIN over range ; else BAD fault high. value = lo + (hi-lo)*(mA-4)/16 ;
          value_out = clamp(value) for GOOD / UNCERTAIN, substitute 'lo' for BAD. Round mA 3, value 3.
  limits  H: v >= H for 'delay' consecutive samples -> ON ; OFF at once when v < H - hyst.
          L: v <= L for 'delay' samples -> ON ; OFF when v > L + hyst.
  motor   tick 100 ms, T_fb 500 ms. Per tick: 1 events ; 2 plant from Run of the last tick (contactor = Run_prev or
          welded and closed before ; on counter ; RunFb = on >= 2 and not fb_broken) ; 3 FB: trip -> FAULT alarm 3,
          then CASE STOPPED / STARTING / RUNNING / STOPPING / FAULT (alarms 1..4, reset rules, no auto restart).

Usage:
  python tools/fmse/device_fb.py                          (analog + limits + motor A..E summary; = --example)
  python tools/fmse/device_fb.py --analog
  python tools/fmse/device_fb.py --analog --raw 13824,-6000 --lo 0 --hi 16
  python tools/fmse/device_fb.py --limits
  python tools/fmse/device_fb.py --limits --values 2.5,2.9,3.1 --H 8 --L 3 --hyst 0.2 --delay 2
  python tools/fmse/device_fb.py --motor A                (log of scenario A; --motor ALL for every scenario)
  python tools/fmse/device_fb.py --motor E --trace        (+ per-tick table Cmd, contactor, RunFb, state, Run)
  python tools/fmse/device_fb.py --motor A --events 2:CMD_ON,12:TRIP
  python tools/fmse/device_fb.py --md device.md --json
  python tools/fmse/device_fb.py --selftest
"""

import argparse
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_json, parse_float_list, run_main

HERE = Path(__file__).resolve().parent
ITEM9_EXAMPLES = HERE / "examples" / "item9_examples.json"
RAW_FULL = 27648

MOTOR_ALARMS = {1: "no run feedback after start", 2: "run feedback lost while running",
                3: "motor protection tripped", 4: "run feedback without command (contactor welded?)"}
MOTOR_STATES = {0: "STOPPED", 1: "STARTING", 2: "RUNNING", 3: "STOPPING", 9: "FAULT"}
MOTOR_EVENTS = ("CMD_ON", "CMD_OFF", "RESET", "FB_BROKEN", "FB_OK", "TRIP", "TRIP_CLEAR", "WELD")


def load9(path=None):
    D = load_json(path or ITEM9_EXAMPLES)
    for k in ("analog", "limits", "motor"):
        if k not in D:
            raise InputError(f"{path or ITEM9_EXAMPLES}: section '{k}' is missing")
    return D


# ----------------------------------------------------------------------------- FB_AnalogIn
class FB_AnalogIn:
    """Scaling of a 4..20 mA input (raw 0..27648) with NAMUR NE 43 status and a substitute value."""

    def __init__(self, lo, hi):
        if hi <= lo:
            raise InputError("analog: hi must be > lo")
        self.lo, self.hi = lo, hi

    def __call__(self, raw):
        mA = 4 + 16 * raw / RAW_FULL
        if mA <= 3.6:
            q, st = "BAD", "fault low (wire break)"
        elif mA < 3.8:
            q, st = "UNCERTAIN", "under range"
        elif mA <= 20.5:
            q, st = "GOOD", "ok"
        elif mA < 21.0:
            q, st = "UNCERTAIN", "over range"
        else:
            q, st = "BAD", "fault high"
        v = self.lo + (self.hi - self.lo) * (mA - 4) / 16
        vo = self.lo if q == "BAD" else min(self.hi, max(self.lo, v))
        self.mA, self.quality, self.status, self.value, self.value_out = mA, q, st, v, vo
        return {"raw": raw, "mA": round(mA, 3), "quality": q, "status": st, "value": round(v, 3),
                "value_out": round(vo, 3)}


# ----------------------------------------------------------------------------- limit alarm
class FB_LimitAlarm:
    """H and L limit alarm with on-delay (consecutive samples) and hysteresis for the off-transition."""

    def __init__(self, H, L, hyst, delay):
        if H <= L or hyst < 0 or delay < 1:
            raise InputError("limits: need H > L, hyst >= 0, delay >= 1")
        self.H_lim, self.L_lim, self.hyst, self.delay = H, L, hyst, delay
        self.H = self.L = False
        self.nh = self.nl = 0

    def __call__(self, v):
        ev = []
        self.nh = self.nh + 1 if v >= self.H_lim else 0
        self.nl = self.nl + 1 if v <= self.L_lim else 0
        if not self.H and self.nh >= self.delay:
            self.H = True
            ev.append("H on")
        elif self.H and v < self.H_lim - self.hyst:
            self.H = False
            ev.append("H off")
        if not self.L and self.nl >= self.delay:
            self.L = True
            ev.append("L on")
        elif self.L and v > self.L_lim + self.hyst:
            self.L = False
            ev.append("L off")
        return ev


def limits_run(lm):
    fb = FB_LimitAlarm(lm["H"], lm["L"], lm["hyst"], lm["delay"])
    rows, events = [], []
    for i, v in enumerate(lm["values"]):
        for e in fb(v):
            events.append((i, e))
        rows.append((i, v, int(fb.H), int(fb.L)))
    return rows, events


# ----------------------------------------------------------------------------- FB_MotorDol + plant
def check_motor_events(events):
    for e in events:
        if len(e) != 2 or not isinstance(e[0], int) or e[0] < 0:
            raise InputError(f"motor: event {e!r} must be [tick >= 0, kind]")
        if e[1] not in MOTOR_EVENTS:
            raise InputError(f"motor: event '{e[1]}' unknown ({', '.join(MOTOR_EVENTS)})")


def motor_run(M, events):
    """Simulate FB_MotorDol + plant for M['K'] ticks. Returns dict(log, final, alarm, run, ticks)."""
    check_motor_events(events)
    TFB, tick = M["T_fb_ms"], M.get("tick_ms", 100)
    cmd = cmdp = fbb = trip = weld = run = cont_prev = False
    on = st = n = nfb = alarm = 0
    log, ticks = [], []
    for k in range(M["K"]):
        reset = False
        for tk, e in events:                     # 1 events in list order
            if tk != k:
                continue
            if e == "CMD_ON":
                cmd = True
            elif e == "CMD_OFF":
                cmd = False
            elif e == "RESET":
                reset = True
            elif e == "FB_BROKEN":
                fbb = True
            elif e == "FB_OK":
                fbb = False
            elif e == "TRIP":
                trip = True
            elif e == "TRIP_CLEAR":
                trip = False
            elif e == "WELD":
                weld = True
            log.append(f"{k} event {e}")
        cont = run or (weld and cont_prev)        # 2 plant from Run of tick k-1
        cont_prev = cont
        on = on + 1 if cont else 0
        runfb = on >= 2 and not fbb
        edge = cmd and not cmdp                   # 3 FB
        st0 = st
        entered = False
        if trip and st != 9:
            st, alarm, entered = 9, 3, True
            log.append(f"{k} {MOTOR_STATES[st0]} -> FAULT alarm 3 {MOTOR_ALARMS[3]}")
        if not entered:
            if st == 0:
                nfb = nfb + 1 if runfb else 0
                if nfb * tick >= TFB:
                    st, alarm = 9, 4
                    log.append(f"{k} STOPPED -> FAULT alarm 4 {MOTOR_ALARMS[4]}")
                elif edge:
                    st, n = 1, 0
                    log.append(f"{k} STOPPED -> STARTING")
            elif st == 1:
                n += 1
                if runfb:
                    st = 2
                    log.append(f"{k} STARTING -> RUNNING")
                elif n * tick >= TFB:
                    st, alarm = 9, 1
                    log.append(f"{k} STARTING -> FAULT alarm 1 {MOTOR_ALARMS[1]}")
            elif st == 2:
                if not cmd:
                    st, n = 3, 0
                    log.append(f"{k} RUNNING -> STOPPING")
                elif not runfb:
                    st, alarm = 9, 2
                    log.append(f"{k} RUNNING -> FAULT alarm 2 {MOTOR_ALARMS[2]}")
            elif st == 3:
                n += 1
                if not runfb:
                    st, nfb = 0, 0
                    log.append(f"{k} STOPPING -> STOPPED")
                elif n * tick >= TFB:
                    st, alarm = 9, 4
                    log.append(f"{k} STOPPING -> FAULT alarm 4 {MOTOR_ALARMS[4]}")
            elif st == 9:
                if reset and not trip and not (alarm == 4 and runfb):
                    st, alarm, nfb = 0, 0, 0
                    log.append(f"{k} FAULT -> STOPPED reset accepted")
                elif reset:
                    log.append(f"{k} reset rejected (alarm {alarm})")
        run = st in (1, 2)
        cmdp = cmd
        ticks.append({"k": k, "Cmd": int(cmd), "contactor": int(cont), "RunFb": int(runfb), "Tripped": int(trip),
                      "state": MOTOR_STATES[st], "Run": int(run), "alarm": alarm})
    return {"log": log, "final": MOTOR_STATES[st], "alarm": alarm, "run": int(run), "ticks": ticks}


def pick_motor(M, name):
    for S in M["scenarios"]:
        if S["name"].split()[0].upper() == name.upper():
            return S
    raise InputError(f"motor scenario '{name}' not found ({', '.join(s['name'].split()[0] for s in M['scenarios'])})")


def parse_events(text):
    out = []
    for part in [p.strip() for p in str(text).split(",") if p.strip()]:
        if ":" not in part:
            raise InputError(f"--events: '{part}' must be TICK:KIND, e.g. 2:CMD_ON")
        k, kind = part.split(":", 1)
        try:
            out.append([int(k), kind.strip().upper()])
        except ValueError:
            raise InputError(f"--events: tick '{k}' is not a whole number")
    check_motor_events(out)
    return out


# ----------------------------------------------------------------------------- output
def text_analog(an, rows):
    out = [f"FB_AnalogIn  raw 0..{RAW_FULL} = 4..20 mA, range {an['lo']:g}..{an['hi']:g} {an.get('unit', '')} "
           f"(NAMUR NE 43 status, BAD -> substitute value lo)"]
    out.append(fmt_table(["raw", "mA", "quality", "status", "value", "value_out"],
                         [[f"{r['raw']:g}", f"{r['mA']:.3f}", r["quality"], r["status"], f"{r['value']:.3f}",
                           f"{r['value_out']:.3f}"] for r in rows], "rrllrr"))
    return "\n".join(out)


def text_limits(lm, rows, ev):
    out = [f"LIMIT ALARM  H {lm['H']:g} (off < {lm['H'] - lm['hyst']:g}), L {lm['L']:g} (off > {lm['L'] + lm['hyst']:g}),"
           f" on-delay {lm['delay']} samples, 1 sample/s"]
    out.append(fmt_table(["sample", "value", "H alarm", "L alarm"], [[i, f"{v:g}", h, l] for i, v, h, l in rows]))
    out.append("  events: " + (", ".join(f"{i} {e}" for i, e in ev) or "-"))
    return "\n".join(out)


def text_motor(runs, with_log, with_trace):
    out = []
    for S, r in runs:
        out.append(f"MOTOR {S['name']}: final {r['final']}, alarm {r['alarm']}"
                   f"{(' ' + MOTOR_ALARMS[r['alarm']]) if r['alarm'] else ''}, Run {r['run']}, {len(r['log'])} log lines")
        if with_log:
            out += ["  " + x for x in r["log"]]
        if with_trace:
            out.append(fmt_table(["k", "Cmd", "contactor", "RunFb", "Tripped", "state", "Run", "alarm"],
                                 [[x["k"], x["Cmd"], x["contactor"], x["RunFb"], x["Tripped"], x["state"], x["Run"],
                                   x["alarm"]] for x in r["ticks"]], "rrrrrlrr"))
        out.append("")
    return "\n".join(out).rstrip()


def md_all(an, arows, lm, lrows, lev, runs):
    L = ["# Device function blocks (item 9)", ""]
    if arows:
        L += ["## FB_AnalogIn", "", "| raw | mA | quality | status | value | value_out |", "|---:|---:|---|---|---:|---:|"]
        L += [f"| {r['raw']} | {r['mA']:.3f} | {r['quality']} | {r['status']} | {r['value']:.3f} | {r['value_out']:.3f} |"
              for r in arows]
        L.append("")
    if lrows:
        L += ["## Limit alarm", "", "| sample | value | H | L |", "|---:|---:|---:|---:|"]
        L += [f"| {i} | {v:g} | {h} | {l} |" for i, v, h, l in lrows]
        L += ["", "Events: " + (", ".join(f"{i} {e}" for i, e in lev) or "-"), ""]
    for S, r in runs:
        L += [f"## FB_MotorDol {S['name']}", "", f"final {r['final']}, alarm {r['alarm']}, Run {r['run']}", "", "```"]
        L += r["log"] + ["```", ""]
    return "\n".join(L)


# ----------------------------------------------------------------------------- self-test
REF_AI = [(-6000, 0.528, "BAD", "fault low (wire break)", -2.17, 0.0),
          (-500, 3.711, "UNCERTAIN", "under range", -0.181, 0.0), (-300, 3.826, "GOOD", "ok", -0.109, 0.0),
          (0, 4.0, "GOOD", "ok", 0.0, 0.0), (6912, 8.0, "GOOD", "ok", 2.5, 2.5), (13824, 12.0, "GOOD", "ok", 5.0, 5.0),
          (20736, 16.0, "GOOD", "ok", 7.5, 7.5), (27648, 20.0, "GOOD", "ok", 10.0, 10.0),
          (28800, 20.667, "UNCERTAIN", "over range", 10.417, 10.0), (30000, 21.361, "BAD", "fault high", 10.851, 0.0),
          (32767, 22.962, "BAD", "fault high", 11.851, 0.0)]
REF_LIM = [(0, 0), (0, 1), (0, 1), (0, 0), (0, 0), (0, 0), (0, 0), (1, 0), (1, 0), (1, 0), (1, 0), (0, 0), (0, 0),
           (0, 0), (0, 1), (0, 0)]
REF_LIMEV = [(1, "L on"), (3, "L off"), (7, "H on"), (11, "H off"), (14, "L on"), (15, "L off")]
REF_MOTOR = {
    "A": ("STOPPED", 0, 0, ["2 event CMD_ON", "2 STOPPED -> STARTING", "4 STARTING -> RUNNING", "20 event CMD_OFF",
                            "20 RUNNING -> STOPPING", "21 STOPPING -> STOPPED"]),
    "B": ("STOPPED", 0, 0, ["0 event FB_BROKEN", "2 event CMD_ON", "2 STOPPED -> STARTING",
                            "7 STARTING -> FAULT alarm 1 no run feedback after start", "15 event RESET",
                            "15 FAULT -> STOPPED reset accepted", "18 event CMD_OFF", "20 event FB_OK", "22 event RESET",
                            "25 event CMD_ON", "25 STOPPED -> STARTING", "27 STARTING -> RUNNING", "35 event CMD_OFF",
                            "35 RUNNING -> STOPPING", "36 STOPPING -> STOPPED"]),
    "C": ("RUNNING", 0, 1, ["2 event CMD_ON", "2 STOPPED -> STARTING", "4 STARTING -> RUNNING", "12 event FB_BROKEN",
                            "12 RUNNING -> FAULT alarm 2 run feedback lost while running", "16 event FB_OK",
                            "18 event RESET", "18 FAULT -> STOPPED reset accepted", "20 event CMD_OFF",
                            "22 event CMD_ON", "22 STOPPED -> STARTING", "24 STARTING -> RUNNING"]),
    "D": ("RUNNING", 0, 1, ["2 event CMD_ON", "2 STOPPED -> STARTING", "4 STARTING -> RUNNING", "10 event TRIP",
                            "10 RUNNING -> FAULT alarm 3 motor protection tripped", "14 event RESET",
                            "14 reset rejected (alarm 3)", "16 event TRIP_CLEAR", "18 event RESET",
                            "18 FAULT -> STOPPED reset accepted", "22 event CMD_OFF", "25 event CMD_ON",
                            "25 STOPPED -> STARTING", "27 STARTING -> RUNNING"]),
    "E": ("FAULT", 4, 0, ["2 event CMD_ON", "2 STOPPED -> STARTING", "4 STARTING -> RUNNING", "8 event WELD",
                          "12 event CMD_OFF", "12 RUNNING -> STOPPING",
                          "17 STOPPING -> FAULT alarm 4 run feedback without command (contactor welded?)",
                          "25 event RESET", "25 reset rejected (alarm 4)"])}


def selftest(path):
    t = SelfTest("device_fb")
    D = load9(path)
    an = D["analog"]
    fb = FB_AnalogIn(an["lo"], an["hi"])
    rows = [fb(r) for r in an["raws"]]
    for r, w in zip(rows, REF_AI):
        t.equal(f"analog raw {w[0]}: mA, quality, status, value, value_out", tuple(r.values()), w)
    t.equal("NE 43 edge 3.6 mA (raw -691.2) -> BAD", FB_AnalogIn(0, 10)(-691.2)["quality"], "BAD")
    t.equal("raw 28500 (20.493 mA <= 20.5) GOOD, raw 28520 (20.505 mA) UNCERTAIN",
            (FB_AnalogIn(0, 10)(28500)["quality"], FB_AnalogIn(0, 10)(28520)["quality"]), ("GOOD", "UNCERTAIN"))
    lrows, lev = limits_run(D["limits"])
    t.equal("limits: H / L per sample = reference", [(h, l) for _, _, h, l in lrows], REF_LIM)
    t.equal("limits: events = reference", lev, REF_LIMEV)
    t.true("limits: 7.9 at sample 8 does NOT clear H (7.9 >= 8 - 0.2 = 7.8, hysteresis)", lrows[8][2] == 1)
    M = D["motor"]
    for S in M["scenarios"]:
        key = S["name"].split()[0]
        r = motor_run(M, S["events"])
        w = REF_MOTOR[key]
        t.equal(f"motor {key}: final {w[0]}, alarm {w[1]}, Run {w[2]}", (r["final"], r["alarm"], r["run"]), w[:3])
        t.equal(f"motor {key}: {len(w[3])} log lines = reference", r["log"], w[3])
    rA = motor_run(M, M["scenarios"][0]["events"])
    t.equal("motor A: run feedback 2 ticks after the start (plant on >= 2)",
            [x["RunFb"] for x in rA["ticks"][2:5]], [0, 0, 1])
    rD = motor_run(M, M["scenarios"][3]["events"])
    t.true("motor D: no automatic restart after the reset at 18 (Cmd still TRUE, STOPPED until the new edge at 25)",
           all(x["state"] == "STOPPED" for x in rD["ticks"][18:25]))
    t.equal("parse --events", parse_events("2:cmd_on, 12:TRIP"), [[2, "CMD_ON"], [12, "TRIP"]])
    try:
        parse_events("2:EXPLODE")
        t.true("bad motor event -> InputError", False)
    except InputError:
        t.true("bad motor event -> InputError", True)
    try:
        FB_AnalogIn(5, 5)
        t.true("analog hi <= lo -> InputError", False)
    except InputError:
        t.true("analog hi <= lo -> InputError", True)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM9_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="all three parts with the JSON examples (default)")
    ap.add_argument("--analog", action="store_true", help="FB_AnalogIn table")
    ap.add_argument("--raw", help="own raw values, e.g. 13824,-6000")
    ap.add_argument("--lo", type=float, help="own range low")
    ap.add_argument("--hi", type=float, help="own range high")
    ap.add_argument("--limits", action="store_true", help="limit alarm table + events")
    ap.add_argument("--values", help="own samples, e.g. 2.5,2.9,3.1")
    ap.add_argument("--H", type=float, help="own H limit")
    ap.add_argument("--L", type=float, help="own L limit")
    ap.add_argument("--hyst", type=float, help="own hysteresis")
    ap.add_argument("--delay", type=int, help="own on-delay in samples")
    ap.add_argument("--motor", help="motor scenario A..E (log) or ALL")
    ap.add_argument("--events", help="own motor events TICK:KIND,... (replaces the scenario events)")
    ap.add_argument("--trace", action="store_true", help="motor: per-tick table")
    ap.add_argument("--md", help="write a Markdown report")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    D = load9(a.examples)
    any_part = a.analog or a.limits or a.motor
    an = dict(D["analog"])
    if a.lo is not None:
        an["lo"] = a.lo
    if a.hi is not None:
        an["hi"] = a.hi
    if a.raw:
        an["raws"] = parse_float_list(a.raw, "--raw")
    lm = dict(D["limits"])
    for k in ("H", "L", "hyst", "delay"):
        if getattr(a, k) is not None:
            lm[k] = getattr(a, k)
    if a.values:
        lm["values"] = parse_float_list(a.values, "--values")
    arows = [FB_AnalogIn(an["lo"], an["hi"])(r) for r in an["raws"]] if (a.analog or not any_part) else []
    lrows, lev = limits_run(lm) if (a.limits or not any_part) else ([], [])
    M = D["motor"]
    runs = []
    if a.motor or not any_part:
        scen = list(M["scenarios"]) if (not a.motor or a.motor.upper() == "ALL") else [pick_motor(M, a.motor)]
        ev = parse_events(a.events) if a.events is not None else None
        for S in scen:
            S2 = dict(S)
            if ev is not None:
                S2["events"] = ev
                S2["name"] = S["name"].split()[0] + " (own events)"
            runs.append((S2, motor_run(M, S2["events"])))
    if a.md:
        Path(a.md).write_text(md_all(an, arows, lm, lrows, lev, runs), encoding="utf-8")
    if a.json:
        print(json.dumps({"analog": arows, "limits": {"rows": lrows, "events": lev},
                          "motor": [{"scenario": S["name"], "final": r["final"], "alarm": r["alarm"], "Run": r["run"],
                                     "log": r["log"], "log_lines": len(r["log"])} for S, r in runs]}, indent=1))
        return 0
    blocks = []
    if arows:
        blocks.append(text_analog(an, arows))
    if lrows:
        blocks.append(text_limits(lm, lrows, lev))
    if runs:
        blocks.append(text_motor(runs, bool(a.motor), a.trace))
    print("\n\n".join(blocks))
    if a.md:
        print(f"\nMarkdown written: {a.md}")
    return 0


if __name__ == "__main__":
    run_main(main)
