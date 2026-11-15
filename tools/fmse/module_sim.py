#!/usr/bin/env python3
"""Module programs M01-M22 of item 10 part B: the generic module program (PackML core + decisions D1-D4 + device FBs
of the library + step sequences + alarm classes + monitors + data block) and the generic plant, in Python.

Python 3 standard library only, offline. Rules = "_rules" of examples/item10b_examples.json, the module DATA
(alarms, classes, cfg, home / start / exec step tables, keep, wires, monitors, plant, partner, ops, cc) and the fault
scenarios of the same file; device FBs = the classes of fb_library.py (item 10A), instances = item-8 module expansion
with the FB types of item 9 codegen. The program is written in the SAME structure as the generated Structured Text
(module_codegen.py -> plc_modules/FB_Module_<unit>.st, PackML core = plc_lib/FB_PackMLCore.st): one cycle =
  1 FB_PackMLCore cycle call (reset pulse) + wire latch      2 device FB calls (IO, commands, wires, reset pulse)
  3 alarm collection (M*1000 + 10*i + a, class table) -> FB_AlarmMgr      4 FB_CmdIf (command echo, rejection)
  5 five passes: [enter steps] command -> [enter] alarm reaction -> [enter] step run -> [enter] state action (SC) ->
    [enter]   (the core executes the transition, the module does the entry actions: safe commands, valve enable,
    module-alarm reset, sequence start)      6 monitors      7 data block (StateCurrent, AlarmNo, WarningNo, Bits)
The harness (events, cell-controller model D1, plant, log) is shared with the ST verification of module_codegen.py:
both programs report the same structured events, the harness writes the log lines.

Usage:
  python tools/fmse/module_sim.py --all                       (all 30 scenarios = the reference text, line by line)
  python tools/fmse/module_sim.py --module M02                (module overview + normal scenario summary)
  python tools/fmse/module_sim.py --module M02 --log          (+ every log line)
  python tools/fmse/module_sim.py --module M02 --scenario F1 --log --trace   (fault scenario, per-tick trace)
  python tools/fmse/module_sim.py --module M04 --events "40:SAFE Curtain=0;46:SAFE Curtain=1" --log
  python tools/fmse/module_sim.py --module M10 --scenario F5 --md f5.md --json
  python tools/fmse/module_sim.py --selftest
"""

import argparse
import json
import random
import re
from pathlib import Path

import fb_library as fbl
from fmse_common import InputError, SelfTest, fmt_table, load_json, run_main

HERE = Path(__file__).resolve().parent
ITEM10B_EXAMPLES = HERE / "examples" / "item10b_examples.json"
ITEM8_EXAMPLES = HERE / "examples" / "item8_examples.json"
ITEM9_EXAMPLES = HERE / "examples" / "item9_examples.json"

ST, SN, CM, CN = fbl.STATES, fbl.SN, fbl.CMDS, fbl.CN
CLASS_NO = {"A": 1, "B": 2, "C": 3}
CLASS_LETTER = {1: "A", 2: "B", 3: "C"}

# ----------------------------------------------------------------------------- PackML core (= FB_PackMLCore.st)
PACKML_EDGES = [["Stopped", "Resetting", "Reset"], ["Resetting", "Idle", "SC"], ["Idle", "Starting", "Start"],
                ["Starting", "Execute", "SC"], ["Execute", "Completing", "SC"], ["Completing", "Complete", "SC"],
                ["Complete", "Resetting", "Reset"], ["Execute", "Holding", "Hold"], ["Holding", "Held", "SC"],
                ["Held", "Unholding", "Unhold"], ["Unholding", "Execute", "SC"], ["Execute", "Suspending", "Suspend"],
                ["Suspending", "Suspended", "SC"], ["Suspended", "Unsuspending", "Unsuspend"],
                ["Unsuspending", "Execute", "SC"], ["Stopping", "Stopped", "SC"], ["Aborting", "Aborted", "SC"],
                ["Aborted", "Clearing", "Clear"], ["Clearing", "Stopped", "SC"]]
EDGE = {(ST[a], lab): ST[b] for a, b, lab in PACKML_EDGES}
DUR_CFG = {ST["Stopping"]: "tStopping_ms", ST["Aborting"]: "tAborting_ms", ST["Holding"]: "tHolding_ms",
           ST["Unholding"]: "tUnholding_ms", ST["Suspending"]: "tSuspending_ms", ST["Unsuspending"]: "tUnsuspending_ms"}
SEQ_STATE = {ST["Resetting"]: 1, ST["Starting"]: 2, ST["Execute"]: 3, ST["Completing"]: 4}
SEQ_NAMES = {1: "home", 2: "start", 3: "exec", 4: "complete"}
SEQ_CONTINUE = 5
BUSY = {ST[s] for s in ("Starting", "Execute", "Completing", "Resetting", "Holding", "Unholding", "Suspending",
                        "Unsuspending", "Stopping", "Aborting", "Clearing")}
REQ_CYCLE, REQ_REACT, REQ_TICK = 0, 10, 11              # E_CoreReq (1..9 = PackML command)
EV_CMD, EV_ABORT, EV_HOLD, EV_SC, EV_CLEARFAIL = 1, 2, 3, 4, 5   # E_CoreEvent
N_MAX = 1000000                                         # GC_N_MAX


class PackMLCore(fbl.FB):
    """PackML core of the module standard. Called several times per cycle with a request iReq:
    0 cycle start (reset pulse of this cycle), 1..9 execute this (already accepted) command, 10 alarm reaction
    (A -> Abort, B in Execute -> Hold), 11 state action (acting-state durations, Clearing check, SC of a finished
    sequence; nothing if the state was entered in this cycle). Every call: one-call outputs describe the transition."""
    IN = {"iReq": 0, "iTopClass": 0, "xSeqDone": False}
    CFG = {"tStopping_ms": 100, "tAborting_ms": 100, "tHolding_ms": 100, "tUnholding_ms": 100,
           "tSuspending_ms": 100, "tUnsuspending_ms": 100}
    OUT = {"iState": 2, "xChanged": False, "iEvent": 0, "iFrom": 0, "iTo": 0, "iCmd": 0, "xEnteredCycle": False,
           "xResetReq": False, "xResetPulse": False, "xSafeReq": False, "xSafeAbort": False, "xValveEnable": False,
           "iSeqStart": 0, "xSeqState": False, "xReady": False, "xBusy": False, "xDone": False}

    def init(self):
        self.n = 0
        self.pend = False

    def trans(self, to, ev, cmd=0):
        o = self.o
        frm = o["iState"]
        o["iFrom"], o["iTo"], o["iState"], o["iEvent"], o["iCmd"] = frm, to, to, ev, cmd
        o["xChanged"] = o["xEnteredCycle"] = True
        self.n = 0
        if to in (ST["Resetting"], ST["Clearing"], ST["Unholding"]):
            o["xResetReq"] = True
            self.pend = True
        if to in (ST["Stopping"], ST["Aborting"]):
            o["xSafeReq"] = True
            o["xSafeAbort"] = to == ST["Aborting"]
        o["xValveEnable"] = to == ST["Resetting"]
        if to == ST["Execute"]:
            o["iSeqStart"] = 3 if frm == ST["Starting"] else (SEQ_CONTINUE if frm in (ST["Unholding"],
                                                                                         ST["Unsuspending"]) else 0)
        else:
            o["iSeqStart"] = SEQ_STATE.get(to, 0)

    def run(self):
        i, o, c = self.i, self.o, self.c
        for k in ("xChanged", "xResetReq", "xSafeReq", "xSafeAbort", "xValveEnable"):
            o[k] = False
        for k in ("iEvent", "iFrom", "iTo", "iCmd", "iSeqStart"):
            o[k] = 0
        s, req, top = o["iState"], i["iReq"], i["iTopClass"]
        if req == REQ_CYCLE:
            o["xResetPulse"] = self.pend
            self.pend = False
            o["xEnteredCycle"] = False
        elif 1 <= req <= 9:
            to = EDGE.get((s, CN[req]))
            if to is None:
                to = ST["Stopping"] if req == CM["Stop"] else (ST["Aborting"] if req == CM["Abort"] else 0)
            if to:
                self.trans(to, EV_CMD, req)
        elif req == REQ_REACT:
            if top == 1 and s not in (ST["Aborting"], ST["Aborted"], ST["Clearing"]):
                self.trans(ST["Aborting"], EV_ABORT)
            elif top == 2 and s == ST["Execute"]:
                self.trans(ST["Holding"], EV_HOLD)
        elif req == REQ_TICK and not o["xEnteredCycle"]:
            if s in DUR_CFG:
                self.n = min(self.n + 1, N_MAX)
                if self.n * fbl.DT >= c[DUR_CFG[s]]:
                    self.trans(EDGE[(s, "SC")], EV_SC)
            elif s == ST["Clearing"]:
                self.n = min(self.n + 1, N_MAX)
                if top in (1, 2):
                    self.trans(ST["Aborted"], EV_CLEARFAIL)
                else:
                    self.trans(ST["Stopped"], EV_SC)
            elif s in SEQ_STATE and i["xSeqDone"]:
                self.trans(EDGE[(s, "SC")], EV_SC)
        s = o["iState"]
        o["xSeqState"] = s in SEQ_STATE
        o["xReady"], o["xBusy"], o["xDone"] = s == ST["Idle"], s in BUSY, s == ST["Complete"]


# ----------------------------------------------------------------------------- expressions (rule expr)
TERM = re.compile(r"^(!?)\s*([A-Za-z_][\w.]*)\s*(>=|<=|=|>|<)?\s*([-\d.]*)$")


def parse_expr(expr):
    """'a & !b | c>=3' -> [[(neg, operand, op, value), ...], ...] (OR of AND groups)."""
    groups = []
    for grp in str(expr).split("|"):
        terms = []
        for term in grp.split("&"):
            m = TERM.match(term.strip())
            if not m:
                raise InputError(f"expression '{expr}': bad term '{term.strip()}'")
            neg, opd, op, val = m.groups()
            if op and not val:
                raise InputError(f"expression '{expr}': comparison '{op}' without a number")
            terms.append((bool(neg), opd, op, float(val) if op else None))
        groups.append(terms)
    return groups


def ev(expr, get):
    for terms in parse_expr(expr) if isinstance(expr, str) else expr:
        ok = True
        for neg, opd, op, x in terms:
            v = get(opd)
            r = {">=": v >= x, "<=": v <= x, "=": v == x, ">": v > x, "<": v < x}[op] if op else bool(v)
            if neg:
                r = not r
            if not r:
                ok = False
                break
        if ok:
            return True
    return False


# ----------------------------------------------------------------------------- module data (shared with codegen)
SAFETY = {"FB_Estop", "FB_Door2Ch", "FB_LightCurtain", "FB_SafetyCoupling", "FB_DoorLock"}
VALVES = ("FB_Valve1", "FB_Valve2")
CMD_INIT = {"FB_Valve1": {"xCmdB": False, "xEnable": True}, "FB_Valve2": {"xCmdB": False, "xEnable": True},
            "FB_MotorDol": {"xCmd": False}, "FB_DriveSto": {"xCmdRun": False},
            "FB_Heater": {"xEnable": False, "rSp": 60.0}, "FB_PushButton": {"iLampMode": 0},
            "FB_HandshakeHw": {"xStart": False}, "FB_Scanner": {"iField": 1}}
# plant IO per FB type (inputs of the FB written by the plant / F-program copy) and outputs the plant reads
IO_IN = {"FB_Valve1": ["xPosA", "xPosB"], "FB_Valve2": ["xPosA", "xPosB"], "FB_MotorDol": ["xRunFb", "xTripped"],
         "FB_DriveSto": ["xReady", "xFault", "xSto"], "FB_Heater": ["xOnFb", "xOverTemp"],
         "FB_HandshakeHw": ["xReady", "xBusy", "xDone", "xFault"], "FB_Feeder": ["xSupplyOn"],
         "FB_Ups": ["xUpsOk", "xOnBattery"], "FB_PushButton": ["xPb"], "FB_Estop": ["xOk", "xOk2"],
         "FB_EnableSwitch": ["xOk", "xOk2"], "FB_Door2Ch": ["xClosed", "xClosed2"],
         "FB_LightCurtain": ["xOssd1", "xOssd2", "xWarn"],
         "FB_SafetyCoupling": ["xEstopIn", "xEstopIn2", "xZoneFree", "xZoneFree2"],
         "FB_DoorLock": ["xClosed", "xClosed2", "xLocked", "xLocked2", "xRequest"], "FB_ModeSwitch": ["xAuto", "xMaint"],
         "FB_TwoHand": ["xLeft", "xLeft2", "xRight", "xRight2"], "FB_Scanner": ["xOssd1", "xOssd2", "xWarn"],
         "FB_ZoneOut": ["xCmd", "xFb"], "FB_ContactorPair": ["xCmd", "xEDM"],
         "FB_SafeValve": ["xCmdA", "xCmdB", "xFbA", "xFbB"], "FB_AnalogIn": ["iValue"], "FB_Sensor": ["xOn"],
         "FB_SignalTower": []}
PLANT_OUT = {"FB_Valve1": ["qSol"], "FB_Valve2": ["qSolA", "qSolB"], "FB_MotorDol": ["qRun"], "FB_DriveSto": ["wCtrl"],
             "FB_Heater": ["qOn"], "FB_HandshakeHw": ["qRequest", "qAck"]}
PLANT_VARS = ("jam", "trip", "fault", "dead", "overtemp", "ok")


class Data:
    """The three example files (loaded once)."""

    def __init__(self, path=None):
        self.D = load_json(path or ITEM10B_EXAMPLES)
        for k in ("_rules", "default_classes", "modules", "normal_K", "fault_scenarios"):
            if k not in self.D:
                raise InputError(f"{path or ITEM10B_EXAMPLES}: section '{k}' is missing")
        self.L8 = load_json(ITEM8_EXAMPLES)
        self.FBT = load_json(ITEM9_EXAMPLES)["codegen"]["fb_types"]
        self.defcls = {(a, b): c for a, b, c in self.D["default_classes"]}

    def codes(self):
        return list(self.D["modules"])

    def fault(self, key):
        for f in self.D["fault_scenarios"]:
            if f["name"].split()[0].upper() == key.upper():
                return f
        raise InputError(f"no fault scenario '{key}' ({', '.join(f['name'].split()[0] for f in self.D['fault_scenarios'])})")


class Spec:
    """One module: instances, classes, alarm texts, commands, sequences, monitors, plant parameters."""

    def __init__(self, data, code):
        code = code.upper()
        if code not in data.D["modules"]:
            raise InputError(f"unknown module '{code}' ({', '.join(data.codes())})")
        self.data, self.code, self.M = data, code, int(code[1:])
        md = self.md = data.D["modules"][code]
        L8 = data.L8
        self.unit = L8["unit_codes"][code] + "01"
        self.title = L8["modules"][code].get("title", code)
        self.inst = []                                             # (name, fb type, pattern), i = 1..
        for p, g, k in L8["modules"][code]["instances"]:
            if L8["patterns"][p]["io"]:
                if p not in data.FBT:
                    raise InputError(f"{code}: no FB type for pattern '{p}' in item 9 codegen.fb_types")
                self.inst.append((g, data.FBT[p], p))
        if md.get("partner"):
            self.inst.append((md["partner"]["name"], "FB_HandshakeHw", "PARTNER"))
        self.N = len(self.inst)
        self.types = {g: t for g, t, p in self.inst}
        self.index = {g: i for i, (g, t, p) in enumerate(self.inst, 1)}
        self.cfg = {g: dict(md.get("cfg", {}).get(g, {})) for g, t, p in self.inst}
        for g in md.get("cfg", {}):
            if g not in self.types:
                raise InputError(f"{code}: cfg for unknown instance '{g}'")
        self.cls = {}
        for g, t, p in self.inst:
            for (ft, a), c in data.defcls.items():
                if ft == t:
                    self.cls[(g, a)] = c
        for g, a, c in md.get("classes", []):
            self.cls[(g, a)] = c
        self.malarm = {a: (txt, c) for a, txt, c in md["alarms"]}
        self.keep = set(md.get("keep", []))
        self.cmd_init = {g: dict(CMD_INIT.get(t, {})) for g, t, p in self.inst}
        self.seqs = {n: list(md.get(SEQ_NAMES[n], [])) for n in SEQ_NAMES}
        self.wires = [list(w) for w in md.get("wires", [])]
        self.monitors = [list(m) for m in md.get("monitors", [])]
        self.plant = {g: dict(md.get("plant", {}).get(g, {})) for g, t, p in self.inst}
        self.mode_inst = "Mode" if self.types.get("Mode") == "FB_ModeSwitch" else None
        self.check()

    def check(self):
        proto = {g: fbl.make_py(t, self.cfg[g]) for g, t, p in self.inst}
        self.proto = proto
        for n, steps in self.seqs.items():
            for st in steps:
                if not isinstance(st.get("s"), int) or st["s"] <= 0:
                    raise InputError(f"{self.code} {SEQ_NAMES[n]}: step number must be > 0 ({st})")
                for key in st.get("do", {}):
                    g, c = key.split(".")
                    if c not in self.cmd_init.get(g, {}):
                        raise InputError(f"{self.code} {SEQ_NAMES[n]} S{st['s']}: '{key}' is not a command")
                for e in [st.get("wait", "T")] + ([st["skip_if"]] if st.get("skip_if") else []):
                    self.check_expr(e, f"{SEQ_NAMES[n]} S{st['s']}")
                if st.get("to", 0) > 0 and st.get("al") not in self.malarm:
                    raise InputError(f"{self.code} {SEQ_NAMES[n]} S{st['s']}: alarm {st.get('al')} is not a module alarm")
                if st.get("next") is not None and st["next"] not in [x["s"] for x in steps]:
                    raise InputError(f"{self.code} {SEQ_NAMES[n]} S{st['s']}: next {st['next']} is not a step")
        for a, expr, states, delay in self.monitors:
            self.check_expr(expr, f"monitor {a}")
            if a not in self.malarm:
                raise InputError(f"{self.code}: monitor alarm {a} is not a module alarm")
            for s in states:
                if s != "all" and s not in ST:
                    raise InputError(f"{self.code}: monitor {a}: unknown state '{s}'")
        for tg, src in self.wires:
            g, n = tg.split(".")
            sg, so = src.split(".")
            if g not in proto or n not in proto[g].i or sg not in proto or so not in proto[sg].o:
                raise InputError(f"{self.code}: wire {tg} <- {src}: unknown instance / input / output")

    def check_expr(self, expr, where):
        for terms in parse_expr(expr):
            for neg, opd, op, x in terms:
                if opd in ("T", "F", "t"):
                    continue
                if opd.count(".") != 1 or opd.split(".")[0] not in self.proto or \
                        opd.split(".")[1] not in self.proto[opd.split(".")[0]].o:
                    raise InputError(f"{self.code} {where}: '{opd}' is not 'Inst.output' of the module")

    def out_type(self, opd):
        g, o = opd.split(".")
        return type(self.proto[g].o[o])

    def alarm_text(self, no):
        i, a = (no - self.M * 1000) // 10, (no - self.M * 1000) % 10
        if i == 0:
            return self.malarm[a][0]
        g, t, p = self.inst[i - 1]
        return f"{g}: " + fbl.LIBRARY[t][2].get(a, f"alarm {a}")

    def inst_class(self, i, a):
        return self.malarm[a][1] if i == 0 else self.cls.get((self.inst[i - 1][0], a), "B")

    def alarm_table(self):
        """Every alarm of the module: (number, class, text, source)."""
        rows = [(self.M * 1000 + a, c, txt, "module") for a, (txt, c) in sorted(self.malarm.items())]
        for i, (g, t, p) in enumerate(self.inst, 1):
            for a, txt in sorted(fbl.LIBRARY[t][2].items()):
                rows.append((self.M * 1000 + 10 * i + a, self.inst_class(i, a), f"{g}: {txt}", t))
        rows += [(self.M * 1000 + 900 + c, "C", f"command {CN[c]} rejected (not allowed in this state / mode)",
                  "FB_CmdIf") for c in sorted(CN)]
        return rows


# ----------------------------------------------------------------------------- generic plant (rule plant)
class Plant:
    """Plant model per FB type; step() uses the program outputs and the FB inputs of tick k-1."""

    def __init__(self, spec):
        self.sp = spec
        self.pv = {g: self.init_var(g, t) for g, t, p in spec.inst}
        self.forced = {}

    def init_var(self, g, t):
        pp = self.sp.plant[g]
        if t in VALVES:
            return {"x": 0, "spool": "A", "jam": 0}
        if t == "FB_MotorDol":
            return {"run": 0, "trip": 0}
        if t == "FB_DriveSto":
            return {"pos": 0, "dir": 1, "running": 0, "fault": 0}
        if t == "FB_Heater":
            return {"temp": pp.get("temp0", 20.0), "overtemp": 0}
        if t == "FB_AnalogIn":
            return {"n": 0, "v1": pp.get("v1", 0.0), "v0": pp.get("v0", 0.0), "value": pp.get("value", 0.0)}
        if t == "FB_Sensor":
            return {"value": pp.get("value", 0), "latch": pp.get("value", 0)}
        if t == "FB_HandshakeHw":
            return {"ph": "idle", "n": 0, "dead": 0, "fault": 0}
        if t in SAFETY | {"FB_EnableSwitch"}:
            return {"ok": 1}
        return {}

    def event(self, txt, io_names=None):
        """'P Inst.var=v' | 'SET Inst.input=v' | 'SAFE Inst=v'."""
        try:
            kind, rest = txt.split(" ", 1)
            if kind == "P":
                lhs, v = rest.split("=")
                g, var = lhs.split(".")
                v = float(v)
                if g not in self.pv or (var not in self.pv[g] and var != "value"):
                    raise InputError(f"event '{txt}': unknown plant variable")
                if var in PLANT_VARS:
                    self.pv[g][var] = int(v)
                elif var == "value":
                    self.pv[g]["value"] = v
                    self.pv[g]["latch"] = v
                else:
                    self.pv[g][var] = v
            elif kind == "SET":
                lhs, v = rest.split("=")
                g, inp = lhs.split(".")
                if io_names is not None and inp not in io_names.get(g, ()):
                    raise InputError(f"event '{txt}': SET is allowed on plant IO inputs only "
                                     f"({g}: {', '.join(io_names.get(g, [])) or 'none'})")
                self.forced[(g, inp)] = float(v)
            elif kind == "SAFE":
                g, v = rest.split("=")
                if g not in self.pv or "ok" not in self.pv[g]:
                    raise InputError(f"event '{txt}': '{g}' is not a 2-channel safety device")
                self.pv[g]["ok"] = int(float(v))
            else:
                raise InputError(f"event '{txt}': kind must be P, SET or SAFE")
        except ValueError:
            raise InputError(f"event '{txt}': format 'P Inst.var=v', 'SET Inst.input=v' or 'SAFE Inst=v'")

    def pget(self, opd):
        if opd == "T":
            return True
        if opd == "F":
            return False
        _, g, var = opd.split(".")
        return self.pv[g][var]

    def step(self, out, inp, cfg):
        """out[g] = program outputs of tick k-1, inp[g] = FB inputs of tick k-1, cfg[g] = FB configuration."""
        sp = self.sp
        IO = {}
        rel = True
        for g, t, p in sp.inst:
            if t in SAFETY:
                ok = ev(sp.plant[g]["expr2"], self.pget) if (t == "FB_Door2Ch" and "expr2" in sp.plant[g]) \
                    else bool(self.pv[g]["ok"])
                rel = rel and ok
        for g, t, p in sp.inst:
            pp, pv, o = sp.plant[g], self.pv[g], out[g]
            io = {}
            if t in VALVES:
                T = pp.get("T", 10)
                if t == "FB_Valve1":
                    tgt_b = o["qSol"]
                else:
                    if o["qSolB"] and not o["qSolA"]:
                        pv["spool"] = "B"
                    elif o["qSolA"] and not o["qSolB"]:
                        pv["spool"] = "A"
                    tgt_b = pv["spool"] == "B"
                if not pv["jam"]:
                    if tgt_b and pv["x"] < T:
                        pv["x"] += 1
                    elif not tgt_b and pv["x"] > 0:
                        pv["x"] -= 1
                io = {"xPosA": pv["x"] == 0, "xPosB": pv["x"] == T}
            elif t == "FB_MotorDol":
                pv["run"] = pv["run"] + 1 if o["qRun"] else 0
                io = {"xRunFb": pv["run"] >= 2, "xTripped": bool(pv["trip"])}
            elif t == "FB_DriveSto":
                Lm = pp.get("L", 20)
                run = bool(o["wCtrl"] & 2)
                if run and not pv["running"]:
                    if pv["pos"] == 0:
                        pv["dir"] = 1
                    elif pv["pos"] == Lm:
                        pv["dir"] = -1
                pv["running"] = run
                if run:
                    pv["pos"] = max(0, min(Lm, pv["pos"] + pv["dir"]))
                io = {"xReady": not pv["fault"], "xFault": bool(pv["fault"]), "xSto": not rel}
            elif t == "FB_Heater":
                pv["temp"] = round(pv["temp"] + (0.5 if o["qOn"] else -0.1), 6)
                io = {"xOnFb": o["qOn"], "xOverTemp": bool(pv["overtemp"])}
            elif t == "FB_HandshakeHw":
                job = pp.get("job", (sp.md.get("partner") or {}).get("job", 30)) if p == "PARTNER" else pp.get("job", 30)
                ph = pv["ph"]
                if ph == "idle":
                    if o["qRequest"] and not pv["dead"]:
                        pv["ph"], pv["n"] = "wait", 0
                elif ph == "wait":
                    pv["n"] += 1
                    if pv["n"] >= 2:
                        pv["ph"], pv["n"] = "busy", 0
                elif ph == "busy":
                    pv["n"] += 1
                    if pv["n"] >= job:
                        pv["ph"] = "done"
                elif ph == "done" and o["qAck"]:
                    pv["ph"] = "idle"
                ph = pv["ph"]
                io = {"xReady": ph in ("idle", "wait"), "xBusy": ph == "busy", "xDone": ph == "done",
                      "xFault": bool(pv["fault"])}
            elif t == "FB_Feeder":
                io = {"xSupplyOn": True}
            elif t == "FB_Ups":
                io = {"xUpsOk": True, "xOnBattery": False}
            elif t == "FB_PushButton":
                io = {"xPb": False}
            elif t in ("FB_Estop", "FB_EnableSwitch"):
                ok = bool(pv["ok"])
                io = {"xOk": ok, "xOk2": ok}
            elif t == "FB_Door2Ch":
                ok = ev(pp["expr2"], self.pget) if "expr2" in pp else bool(pv["ok"])
                io = {"xClosed": ok, "xClosed2": ok}
            elif t == "FB_LightCurtain":
                ok = bool(pv["ok"])
                io = {"xOssd1": ok, "xOssd2": ok, "xWarn": False}
            elif t == "FB_SafetyCoupling":
                ok = bool(pv["ok"])
                io = {"xEstopIn": ok, "xEstopIn2": ok, "xZoneFree": ok, "xZoneFree2": ok}
            elif t == "FB_DoorLock":
                ok = bool(pv["ok"])
                io = {"xClosed": ok, "xClosed2": ok, "xLocked": ok, "xLocked2": ok, "xRequest": False}
            elif t == "FB_ModeSwitch":
                io = {"xAuto": True, "xMaint": False}
            elif t == "FB_TwoHand":
                io = {"xLeft": False, "xLeft2": False, "xRight": False, "xRight2": False}
            elif t == "FB_Scanner":
                io = {"xOssd1": True, "xOssd2": True, "xWarn": False}
            elif t == "FB_ZoneOut":
                io = {"xCmd": rel, "xFb": not inp[g]["xCmd"]}
            elif t == "FB_ContactorPair":
                io = {"xCmd": rel, "xEDM": not inp[g]["xCmd"]}
            elif t == "FB_SafeValve":
                io = {"xCmdA": rel, "xCmdB": rel, "xFbA": inp[g]["xCmdA"], "xFbB": inp[g]["xCmdB"]}
            IO[g] = io
        # analog inputs + sensors: the links read the plant variables after the actuator update
        for g, t, p in sp.inst:
            pp, pv = sp.plant[g], self.pv[g]
            if t == "FB_AnalogIn":
                if "src" in pp:
                    v = self.pv[pp["src"]]["temp"]
                elif "expr" in pp:
                    pv["n"] = pv["n"] + 1 if ev(pp["expr"], self.pget) else 0
                    v = pv["v1"] if pv["n"] > pp.get("delay", 0) else pv["v0"]
                else:
                    v = pv["value"]
                c = cfg[g]
                IO[g] = {"iValue": int(round((v - c["rLo"]) / (c["rHi"] - c["rLo"]) * 27648))}
            elif t == "FB_Sensor":
                if "expr" in pp:
                    x = ev(pp["expr"], self.pget)
                elif "set" in pp:
                    if ev(pp["set"], self.pget):
                        pv["latch"] = 1
                    elif ev(pp["reset"], self.pget):
                        pv["latch"] = 0
                    x = bool(pv["latch"])
                else:
                    x = bool(pv["value"])
                IO[g] = {"xOn": x}
        for (g, inp_name), v in self.forced.items():          # SET events override the plant
            IO[g][inp_name] = v
        return IO


# ----------------------------------------------------------------------------- the module program in Python
class PyModule:
    """Generic module program (same structure as the generated FB_Module_<unit>.st)."""

    def __init__(self, spec):
        self.sp = sp = spec
        self.fb = {g: fbl.make_py(t, sp.cfg[g]) for g, t, p in sp.inst}
        self.cmd = {g: dict(c) for g, c in sp.cmd_init.items()}
        self.core = PackMLCore()
        self.cmdif = fbl.make_py("FB_CmdIf")
        self.alarm = fbl.make_py("FB_AlarmMgr", {"iModule": sp.M})
        self.alm_prev = [0] * (sp.N + 1)
        self.mal = [False] * 10
        self.mal_prev = [False] * 10
        self.mon_n = [0] * len(sp.monitors)
        self.fired = {n: [False] * len(st) for n, st in sp.seqs.items()}
        self.seq, self.step, self.t, self.goto_s, self.frm, self.seq_end = 0, None, 0, None, 0, False
        self.rejwarn, self.rej_prev, self.top = 0, False, 0
        self.db = {"State": ST["Stopped"], "AlarmNo": 0, "WarningNo": 0, "Bits": 0, "Ack": False, "Rej": False}
        self.events = []

    # adapter for the harness
    def initial_outputs(self):
        return {g: dict(fb.o) for g, fb in self.fb.items()}

    def cfg_of(self):
        return {g: dict(fb.c) for g, fb in self.fb.items()}

    def get(self, opd):
        if opd == "T":
            return True
        if opd == "F":
            return False
        if opd == "t":
            return self.t
        g, o = opd.split(".")
        return self.fb[g].o[o]

    def cycle(self, io, cntrl, ccr):
        sp, core, E = self.sp, self.core, []
        self.events = E
        core.set("iReq", REQ_CYCLE)
        core.call()
        latch = [(tg, self.fb[src.split(".")[0]].o[src.split(".")[1]]) for tg, src in sp.wires]
        # 2 device FBs
        for g, t, p in sp.inst:
            fb = self.fb[g]
            for n, v in io[g].items():
                fb.set(n, v)
            for n, v in self.cmd[g].items():
                fb.set(n, v)
            for tg, v in latch:
                if tg.split(".")[0] == g:
                    fb.set(tg.split(".")[1], v)
            if t == "FB_SignalTower":
                fb.set("iState", core.o["iState"])
                fb.set("iAlarmClass", self.top)
            if "xReset" in fb.i:
                fb.set("xReset", core.o["xResetPulse"])
            fb.call()
        # 3 alarms: raise in increasing number (module level i = 0 first), then clear
        alm = [0] + [self.fb[g].o.get("iAlarm", 0) for g, t, p in sp.inst]
        for a in range(1, 10):
            if self.mal[a] and not self.mal_prev[a]:
                self.raise_alarm(0, a)
        for i in range(1, sp.N + 1):
            if alm[i] != self.alm_prev[i] and alm[i] != 0:
                self.raise_alarm(i, alm[i])
        for a in range(1, 10):
            if not self.mal[a] and self.mal_prev[a]:
                self.clear_alarm(0, a)
        for i in range(1, sp.N + 1):
            if alm[i] != self.alm_prev[i] and self.alm_prev[i] != 0:
                self.clear_alarm(i, self.alm_prev[i])
        self.alm_prev, self.mal_prev = alm, list(self.mal)
        self.top = self.alarm.o["iAlarmClass"]
        alarm_no = self.alarm.o["iAlarmNo"]
        # 4 command interface
        mode = self.fb[sp.mode_inst].o["iMode"] if sp.mode_inst else 1
        ci = self.cmdif
        ci.set("iCntrlCmd", cntrl)
        ci.set("xCmdChangeRequest", ccr)
        ci.set("iState", core.o["iState"])
        ci.set("iMode", mode)
        ci.call()
        if ci.o["iCmdExec"] == 0 and ci.o["xCmdRej"] and not self.rej_prev:
            self.rejwarn = sp.M * 1000 + 900 + ci.o["iLastCmd"]
            E.append(("rej", ci.o["iLastCmd"], core.o["iState"], self.rejwarn))
        # 5 passes
        for pas in range(1, 6):
            self.enter_steps()
            req = None
            if pas == 1 and ci.o["iCmdExec"]:
                req = ci.o["iCmdExec"]
                self.rejwarn = 0
            elif pas == 2:
                req = REQ_REACT
            elif pas == 3:
                self.seq_end = False
                if not core.o["xEnteredCycle"] and core.o["xSeqState"]:
                    self.run_step()
            elif pas == 4 and not core.o["xEnteredCycle"]:
                req = REQ_TICK
            if req is not None:
                core.set("iReq", req)
                core.set("iTopClass", self.top)
                core.set("xSeqDone", self.seq_end)
                core.call()
                if core.o["xChanged"]:
                    E.append(("core", core.o["iEvent"], core.o["iFrom"], core.o["iTo"], core.o["iCmd"], alarm_no))
                    self.entry_actions()
        # 6 monitors
        for j, (a, expr, states, delay) in enumerate(sp.monitors):
            on = ev(expr, self.get) and ("all" in states or SN[core.o["iState"]] in states)
            self.mon_n[j] = min(self.mon_n[j] + 1, 32767) if on else 0
            if self.mon_n[j] > delay:
                self.mal[a] = True
        # 7 data block
        db = self.db
        db["State"] = core.o["iState"]
        db["AlarmNo"] = alarm_no
        db["WarningNo"] = self.alarm.o["iWarningNo"] or self.rejwarn
        db["Ack"], db["Rej"] = ci.o["xCmdAck"], ci.o["xCmdRej"]
        db["Bits"] = (1 if core.o["xReady"] else 0) | (2 if core.o["xBusy"] else 0) | (4 if core.o["xDone"] else 0) | \
            (8 if alarm_no else 0) | (32 if mode == 1 else 0) | (256 if db["Ack"] else 0) | (512 if db["Rej"] else 0)
        self.rej_prev = ci.o["xCmdRej"]
        return {"events": E, "db": dict(db), "out": {g: dict(fb.o) for g, fb in self.fb.items()}}

    def raise_alarm(self, i, a):
        c = CLASS_NO[self.sp.inst_class(i, a)]
        self.alarm.set("iEvent", 1)
        self.alarm.set("iInst", i)
        self.alarm.set("iCode", a)
        self.alarm.set("iClass", c)
        self.alarm.call()
        self.events.append(("on", self.sp.M * 1000 + 10 * i + a, c))

    def clear_alarm(self, i, a):
        self.alarm.set("iEvent", 2)
        self.alarm.set("iInst", i)
        self.alarm.set("iCode", a)
        self.alarm.call()
        self.events.append(("off", self.sp.M * 1000 + 10 * i + a))

    def entry_actions(self):
        o, sp = self.core.o, self.sp
        if o["xResetReq"]:
            self.mal = [False] * 10
            for n in self.fired:
                self.fired[n] = [False] * len(self.fired[n])
            self.mon_n = [0] * len(sp.monitors)
        if o["xSafeReq"]:
            for g, t, p in sp.inst:
                for k, v in self.cmd[g].items():
                    if f"{g}.{k}" in sp.keep and not o["xSafeAbort"]:
                        continue
                    if k == "iField":
                        self.cmd[g][k] = 1
                    elif k == "rSp":
                        continue
                    elif isinstance(v, bool):
                        self.cmd[g][k] = False
                    elif isinstance(v, int):
                        self.cmd[g][k] = 0
                if t in VALVES:
                    self.cmd[g]["xEnable"] = False
            self.seq, self.step, self.goto_s = 0, None, None
        if o["xValveEnable"]:
            for g, t, p in sp.inst:
                if t in VALVES:
                    self.cmd[g]["xEnable"] = True
        st = o["iSeqStart"]
        if 1 <= st <= 4:
            self.seq, self.step, self.frm = st, None, 0
            self.goto_s = 0 if sp.seqs[st] else None
        elif st == SEQ_CONTINUE:
            self.t = 0

    def enter_steps(self):
        """Enter the requested step (index goto_s, len = end): skip_if / do, chained without a cycle."""
        steps = self.sp.seqs.get(self.seq, [])
        while self.goto_s is not None:
            idx = self.goto_s
            if idx >= len(steps):
                self.events.append(("step", self.seq, self.frm, 0, False))
                self.step, self.goto_s, self.seq_end = None, None, True
                break
            st = steps[idx]
            if st.get("skip_if") and ev(st["skip_if"], self.get):
                self.events.append(("step", self.seq, self.frm, st["s"], True))
                self.frm, self.goto_s = st["s"], idx + 1
                continue
            self.events.append(("step", self.seq, self.frm, st["s"], False))
            for key, v in st.get("do", {}).items():
                g, c = key.split(".")
                cur = self.cmd[g][c]
                self.cmd[g][c] = bool(v) if isinstance(cur, bool) else (float(v) if isinstance(cur, float) else int(v))
            self.step, self.t, self.goto_s = idx, 0, None

    def run_step(self):
        """Run the active step: t + 1, wait -> next step, time-out -> module alarm (class C: continue)."""
        if self.step is None:
            self.seq_end = True
            return
        steps = self.sp.seqs[self.seq]
        st = steps[self.step]
        self.t = min(self.t + 1, 32767)
        if ev(st["wait"], self.get):
            self.frm = st["s"]
            self.goto_s = self.step + 1 if st.get("next") is None else \
                next(i for i, x in enumerate(steps) if x["s"] == st["next"])
        elif st.get("to", 0) > 0 and self.t >= st["to"] and not self.fired[self.seq][self.step]:
            self.fired[self.seq][self.step] = True
            self.mal[st["al"]] = True
            if self.sp.malarm[st["al"]][1] == "C":
                self.frm, self.goto_s = st["s"], self.step + 1

    def trace_row(self, k):
        sp, o = self.sp, self.core.o
        act = ",".join(str(n) for n in self.active_numbers()) or "-"
        cmds = " ".join(f"{g}.{c}={fbl.fmt(v)}" for g in self.cmd for c, v in self.cmd[g].items())
        seq = f"{SEQ_NAMES.get(self.seq, '-')} S{steps_s(sp, self.seq, self.step)} t={self.t}" if self.seq else "-"
        return [k, SN[o["iState"]], seq, self.db["AlarmNo"], self.db["WarningNo"], act, cmds or "-"]

    def active_numbers(self):
        alm = self.alm_prev
        nums = [self.sp.M * 1000 + a for a in range(1, 10) if self.mal_prev[a]]
        nums += [self.sp.M * 1000 + 10 * i + alm[i] for i in range(1, self.sp.N + 1) if alm[i]]
        return sorted(nums)


def steps_s(sp, seq, step):
    return 0 if step is None or not seq else sp.seqs[seq][step]["s"]


# ----------------------------------------------------------------------------- harness (shared with module_codegen)
def io_names(spec):
    return {g: list(IO_IN[t]) for g, t, p in spec.inst}


def format_event(spec, e):
    k = e[0]
    if k == "on":
        return f"alarm ON {e[1]} class {CLASS_LETTER[e[2]]} {spec.alarm_text(e[1])}"
    if k == "off":
        return f"alarm OFF {e[1]}"
    if k == "rej":
        return f"cmd {CN.get(e[1], e[1])} rejected in {SN[e[2]]} (WarningNo {e[3]})"
    if k == "core":
        ev_, frm, to, cmd, alarm_no = e[1:]
        if ev_ == EV_CMD:
            return f"cmd {CN[cmd]} accepted: {SN[frm]} -> {SN[to]}"
        if ev_ in (EV_ABORT, EV_HOLD):
            return f"internal {'Abort' if ev_ == EV_ABORT else 'Hold'} (alarm {alarm_no}): {SN[frm]} -> {SN[to]}"
        if ev_ == EV_CLEARFAIL:
            return "clear failed: Clearing -> Aborted"
        return f"SC: {SN[frm]} -> {SN[to]}"
    if k == "step":
        return f"{SEQ_NAMES[e[1]]} step S{e[2]} -> S{e[3]}" + (" skip" if e[4] else "")
    raise InputError(f"internal: unknown event {e}")


def run_scenario(spec, prog, events, cc, K, trace=False):
    """Run one scenario. prog = PyModule(spec) or module_codegen.STModule(spec, lib) (same adapter)."""
    plant = Plant(spec)
    names = io_names(spec)
    inp = {g: {n: v for n, v in fbl.make_py(t, spec.cfg[g]).i.items()} for g, t, p in spec.inst}
    out = prog.initial_outputs()
    cfg = prog.cfg_of()
    cc = [list(x) for x in cc]
    db = {"CntrlCmd": 0, "CCR": False, "Ack": False, "Rej": False, "State": ST["Stopped"], "AlarmNo": 0,
          "WarningNo": 0, "Bits": 0}
    log, rows = [], []
    for k in range(K):
        s0 = db["State"]
        for e in events:
            if e[0] == k:
                for txt in e[1:]:
                    log.append(f"{k} event {txt}")
                    plant.event(txt, names)
        if db["CCR"] and (db["Ack"] or db["Rej"]):
            db["CCR"], db["CntrlCmd"] = False, 0
            log.append(f"{k} cc clears request")
        elif not db["CCR"] and cc and db["State"] == ST[cc[0][1]] and k >= cc[0][2]:
            c = cc.pop(0)[0]
            db["CntrlCmd"], db["CCR"] = CM[c], True
            log.append(f"{k} cc sends {c}")
        io = plant.step(out, inp, cfg)
        for g in io:
            inp[g].update(io[g])
        r = prog.cycle(io, db["CntrlCmd"], db["CCR"])
        log += [f"{k} {format_event(spec, e)}" for e in r["events"]]
        for key in ("State", "AlarmNo", "WarningNo", "Bits", "Ack", "Rej"):
            db[key] = r["db"][key]
        if db["State"] != s0:
            log.append(f"{k} state {SN[db['State']]} StateCurrent={db['State']} AlarmNo={db['AlarmNo']} "
                       f"WarningNo={db['WarningNo']} Bits={db['Bits']}")
        out = r["out"]
        if trace:
            rows.append(prog.trace_row(k))
    return {"log": log, "db": dict(db), "rows": rows}


def scenario_of(data, code, key="normal", extra=()):
    """(title prefix, events, cc, K) of the normal scenario or a fault scenario F1..F8 (+ extra events)."""
    code = code.upper()
    if key.lower() == "normal":
        md = data.D["modules"][code]
        ev_, cc, K, name = list(md.get("ops") or []), md["cc"], data.D["normal_K"], "normal"
    else:
        f = data.fault(key)
        if f["module"] != code:
            raise InputError(f"fault scenario {key} belongs to module {f['module']}, not {code}")
        ev_, cc, K, name = list(f["events"]), f["cc"], f["K"], f["name"]
    return name, sorted(ev_ + list(extra), key=lambda e: e[0]), cc, K


def summary(res, n_lines):
    d = res["db"]
    return (f"final {SN[d['State']]} StateCurrent={d['State']} AlarmNo={d['AlarmNo']} WarningNo={d['WarningNo']} "
            f"lines {n_lines}")


def all_text(data, make_prog):
    """All 30 scenarios as the reference text (22 normal + 8 fault)."""
    out = []
    for code in data.codes():
        sp = Spec(data, code)
        name, ev_, cc, K = scenario_of(data, code)
        r = run_scenario(sp, make_prog(sp), ev_, cc, K)
        out.append(f"NORMAL {code} {sp.unit} | instances {sp.N} | {summary(r, len(r['log']))}")
        out += ["    " + x for x in r["log"]]
    for f in data.D["fault_scenarios"]:
        sp = Spec(data, f["module"])
        r = run_scenario(sp, make_prog(sp), f["events"], f["cc"], f["K"])
        out.append(f"FAULT {f['module']} {f['name']} | {summary(r, len(r['log']))}")
        out += ["    " + x for x in r["log"]]
    return out


def parse_events(text):
    """'40:SET Release.xPb=1;41:SET Release.xPb=0' -> [[40, 'SET Release.xPb=1'], [41, 'SET Release.xPb=0']]."""
    out = []
    for part in [p.strip() for p in str(text or "").split(";") if p.strip()]:
        if ":" not in part:
            raise InputError(f"--events: '{part}' must be TICK:<P|SET|SAFE ...>")
        k, txt = part.split(":", 1)
        try:
            out.append([int(k), txt.strip()])
        except ValueError:
            raise InputError(f"--events: tick '{k}' is not a whole number")
    return out


# ----------------------------------------------------------------------------- output
def overview(sp):
    L = [f"MODULE {sp.code} {sp.unit} - {sp.title}: {sp.N} device FB instances (M = {sp.M})"]
    rows = []
    for i, (g, t, p) in enumerate(sp.inst, 1):
        al = ", ".join(f"{sp.M * 1000 + 10 * i + a}{sp.inst_class(i, a)}" for a in sorted(fbl.LIBRARY[t][2]))
        cmds = ", ".join(sp.cmd_init[g]) or "-"
        rows.append([i, g, t, p, cmds, al or "-"])
    if rows:
        L.append(fmt_table(["i", "instance", "FB type", "pattern", "commands", "alarms (number+class)"], rows, "rlllll"))
    L.append("module alarms: " + "; ".join(f"{sp.M * 1000 + a} {c} {t}" for a, (t, c) in sorted(sp.malarm.items())))
    L.append("sequences: " + ", ".join(f"{SEQ_NAMES[n]} {len(s)} steps" for n, s in sp.seqs.items() if s) +
             f" ; monitors {len(sp.monitors)} ; wires {len(sp.wires)} ; keep {sorted(sp.keep) or '-'}")
    return L


def md_report(title, sp, res, log):
    L = [f"# {title}", "", f"Module {sp.code} {sp.unit} - {sp.title}. All values are examples.", "",
         f"Result: {summary(res, len(log))}", "", "```"] + log + ["```", ""]
    return "\n".join(L)


# ----------------------------------------------------------------------------- self-test
def core_fuzz(make_a, make_b, ticks=2000, seed=3):
    """Random request sequences to two core implementations; '' or the first difference."""
    a, b = make_a(), make_b()
    R = random.Random(seed)
    for k in range(ticks):
        vals = {"iReq": R.choice([0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 11, 12, -1]),
                "iTopClass": R.choice([0, 0, 0, 1, 2, 3]), "xSeqDone": R.random() < 0.3}
        for x in (a, b):
            for n, v in vals.items():
                x.set(n, v)
            x.call()
        if a.outputs() != b.outputs():
            return f"call {k} {vals}: {a.outputs()} != {b.outputs()}"
    return ""


def selftest(path):
    from module_sim_ref import REF_10B
    t = SelfTest("module_sim")
    data = Data(path)
    ref = REF_10B.splitlines()
    t.equal("reference: 1048 lines", len(ref), 1048)
    got = all_text(data, PyModule)
    t.equal("--all: 30 scenarios = reference text line by line", fbl.compare_lines(got, ref), "")
    heads = [k for k, x in enumerate(ref) if not x.startswith("    ")] + [len(ref)]
    gheads = [k for k, x in enumerate(got) if not x.startswith("    ")] + [len(got)]
    for j in range(len(heads) - 1):
        blk = ref[heads[j]:heads[j + 1]]
        gb = got[gheads[j]:gheads[j + 1]] if j < len(gheads) - 1 else []
        t.equal(f"{' '.join(blk[0].split()[:3])}: header + {len(blk) - 1} log lines = reference", gb, blk)
    for k, line in enumerate(ref):
        if k < len(got) and got[k] != line:
            t.equal(f"reference line {k + 1}", got[k], line)
    t.equal("every reference line asserted (1048 / 1048 equal)", sum(1 for a, b in zip(got, ref) if a == b), 1048)
    # rules / decisions spot checks
    t.true("D2: M02 Rotate jam -> alarm 2011 class A (F1)", "    30 event P Rotate.jam=1" in ref and any(
        x.startswith("    ") and "alarm ON 2011 class A Rotate: end position not reached" in x for x in got))
    t.true("D3: class B module alarm 2004 -> internal Hold (F2)",
           any("internal Hold (alarm 2004): Execute -> Holding" in x for x in got))
    t.true("D1: rejected Start in Stopped -> WarningNo 3902 (F8)",
           any("cmd Start rejected in Stopped (WarningNo 3902)" in x for x in got))
    t.true("class C warning (F6): 16005 stays WarningNo, oil level 16006 class A aborts",
           got[[k for k, x in enumerate(got) if x.startswith("FAULT M16")][0]].endswith(
               "final Aborted StateCurrent=9 AlarmNo=16006 WarningNo=16005 lines 49"))
    sp = Spec(data, "M02")
    t.equal("M02: 5 instances, i of ClampPress = 5", (sp.N, sp.index["ClampPress"]), (5, 5))
    t.equal("M02: alarm 2011 = class A (module override), 2021 = B (library default)",
            (sp.inst_class(1, 1), sp.inst_class(2, 1)), ("A", "B"))
    t.equal("M02 alarm table: 4 module + 3 + 3 + 1 instance alarms + 9 rejection warnings",
            len(sp.alarm_table()), 20)
    sp1 = Spec(data, "M01")
    t.equal("M01: bus partner 'Machine' is the last instance (i 4, FB_HandshakeHw)",
            sp1.inst[-1], ("Machine", "FB_HandshakeHw", "PARTNER"))
    t.equal("M20: no device instances (only the core)", Spec(data, "M20").N, 0)
    # PackML core
    c = PackMLCore()
    seqv = []
    for req, top in ((0, 0), (CM["Reset"], 0), (0, 0), (REQ_TICK, 0)):
        c.set("iReq", req)
        c.set("iTopClass", top)
        c.call()
        seqv.append((SN[c.o["iState"]], c.o["xChanged"], c.o["xResetPulse"], c.o["iSeqStart"]))
    t.equal("core: Reset -> Resetting (home starts), reset pulse in the next cycle call",
            seqv, [("Stopped", False, False, 0), ("Resetting", True, False, 1), ("Resetting", False, True, 0),
                   ("Resetting", False, True, 0)])
    c.set("iReq", REQ_TICK)
    c.set("xSeqDone", True)
    c.call()
    t.equal("core: state action with xSeqDone: Resetting -> Idle (SC)", (SN[c.o["iState"]], c.o["iEvent"]),
            ("Idle", EV_SC))
    c2 = PackMLCore()
    for req, top in ((CM["Abort"], 0), (0, 1), (REQ_TICK, 1), (0, 1), (CM["Clear"], 1), (0, 1), (REQ_TICK, 1)):
        c2.set("iReq", req)
        c2.set("iTopClass", top)
        c2.call()
    t.equal("core: Clearing with an active class A alarm -> back to Aborted (clear failed)",
            (SN[c2.o["iState"]], c2.o["iEvent"]), ("Aborted", EV_CLEARFAIL))
    c3 = PackMLCore()
    c3.set("iReq", CM["Reset"])
    c3.call()
    c3.set("iReq", REQ_REACT)
    c3.set("iTopClass", 1)
    c3.call()
    t.equal("core: class A in Resetting -> internal Abort, safe commands incl. 'keep'",
            (SN[c3.o["iState"]], c3.o["xSafeReq"], c3.o["xSafeAbort"]), ("Aborting", True, True))
    c3.set("iReq", REQ_TICK)
    c3.call()
    t.equal("core: no state action in the cycle of entry", SN[c3.o["iState"]], "Aborting")
    try:
        import st_sim
        lib = st_sim.load_library()
        mk_st = lambda: st_sim.STAdapter(lib, "FB_PackMLCore")
        t.equal("FB_PackMLCore.st = class PackMLCore on 2000 random requests", core_fuzz(mk_st, PackMLCore), "")
        t.equal("FB_PackMLCore.st = class PackMLCore (2nd seed, 2000 requests)",
                core_fuzz(mk_st, PackMLCore, 2000, 11), "")
        pou = lib.pous["fb_packmlcore"]
        t.equal("FB_PackMLCore.st interface = class PackMLCore (inputs + configuration, outputs in order)",
                ([d.name for d in pou.section("VAR_INPUT")], [d.name for d in pou.section("VAR_OUTPUT")]),
                (list(PackMLCore.IN) + list(PackMLCore.CFG), list(PackMLCore.OUT)))
    except InputError as exc:
        t.true(f"FB_PackMLCore.st loads: {exc}", False)
    # errors
    for bad, what in (("M99", "unknown module"),):
        try:
            Spec(data, bad)
            t.true(f"{what} -> InputError", False)
        except InputError:
            t.true(f"{what} -> InputError", True)
    try:
        parse_expr("Clamp.xAtA & >=")
        t.true("bad expression -> InputError", False)
    except InputError:
        t.true("bad expression -> InputError", True)
    try:
        Plant(sp).event("SET Rotate.xCmdB=1", io_names(sp))
        t.true("SET on a command input -> InputError (only plant IO can be forced)", False)
    except InputError:
        t.true("SET on a command input -> InputError (only plant IO can be forced)", True)
    try:
        scenario_of(data, "M02", "F3")
        t.true("fault scenario of another module -> InputError", False)
    except InputError:
        t.true("fault scenario of another module -> InputError", True)
    r = run_scenario(sp, PyModule(sp), parse_events("30:P Rotate.jam=1"), sp.md["cc"], 200)
    t.true("--events: jam at 30 in the normal M02 run -> 2011 class A and Abort",
           any("internal Abort (alarm 2011)" in x for x in r["log"]))
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM10B_EXAMPLES), help="item-10B JSON (default: %(default)s)")
    ap.add_argument("--all", action="store_true", help="all 30 scenarios (= reference text)")
    ap.add_argument("--module", help="one module, e.g. M02")
    ap.add_argument("--scenario", default="normal", help="normal (default) or a fault scenario F1..F8 of the module")
    ap.add_argument("--events", help="extra events 'TICK:P Inst.var=v;TICK:SET Inst.input=v;TICK:SAFE Inst=v'")
    ap.add_argument("--ticks", type=int, help="number of ticks (default: scenario K)")
    ap.add_argument("--log", action="store_true", help="print every log line")
    ap.add_argument("--trace", action="store_true", help="one row per tick: state, step, alarms, commands")
    ap.add_argument("--md", help="write a Markdown report")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    data = Data(a.examples)
    if a.all or not a.module:
        lines = all_text(data, PyModule)
        if a.md:
            Path(a.md).write_text("# Module programs M01-M22 (item 10B), all scenarios\n\nAll values are examples.\n\n"
                                  "```\n" + "\n".join(lines) + "\n```\n", encoding="utf-8")
        if a.json:
            print(json.dumps(lines, indent=1))
        else:
            print("\n".join(lines))
        return 0
    sp = Spec(data, a.module)
    name, ev_, cc, K = scenario_of(data, sp.code, a.scenario, parse_events(a.events))
    if a.ticks is not None:
        if a.ticks < 1:
            raise InputError("--ticks must be >= 1")
        K = a.ticks
    prog = PyModule(sp)
    res = run_scenario(sp, prog, ev_, cc, K, trace=a.trace)
    title = f"{'NORMAL' if name == 'normal' else 'FAULT'} {sp.code} {sp.unit} | {name}"
    if a.md:
        Path(a.md).write_text(md_report(title, sp, res, res["log"]), encoding="utf-8")
    if a.json:
        print(json.dumps({"module": sp.code, "unit": sp.unit, "scenario": name, "K": K, "final": res["db"],
                          "log": res["log"], "trace": res["rows"]}, indent=1))
        return 0
    print("\n".join(overview(sp)))
    print()
    print(f"{title} | K {K} | {summary(res, len(res['log']))}")
    if a.log:
        print("\n".join("    " + x for x in res["log"]))
    if a.trace:
        print(fmt_table(["k", "state", "sequence", "AlarmNo", "WarningNo", "active alarms", "commands"], res["rows"],
                        "rllrrll"))
    if a.md:
        print(f"\nMarkdown written: {a.md}")
    return 0


if __name__ == "__main__":
    run_main(main)
