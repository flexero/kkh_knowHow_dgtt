#!/usr/bin/env python3
"""Device function-block library of item 10A as Python classes + the shared unit-test harness.

Python 3 standard library only, offline. Rules = "_rules" of examples/item10a_examples.json (decisions D1-D4,
one rule per FB, alarm manager), applied EXACTLY; FB_MotorDol, FB_AnalogIn and FB_LimitAlarm keep the item-9 rules
(examples/item9_examples.json, device_fb.py). The same FBs exist as IEC 61131-3 Structured Text in
tools/fmse/plc_lib/*.st; st_sim.py runs those .st files with the SAME harness (functions of this file) and must give
the same log lines. The guide docs/FMS system design/70_plc_library_A_standard_fbs.md and the web page use the same rules.

Test bench (rule "common"): one tick = 100 ms, every FB is called once per tick, inputs are persistent and an event
'<tick> name=value' changes an input BEFORE the call of that tick. Edges (xReset, xRequest, xHornAck, xPb,
xCmdChangeRequest) are detected inside the FB. Times: a counter n counts calls, a time is reached when
n*100 >= t_ms. Log: tick 0 = 'init' with all outputs, then one line per tick with the outputs that changed.

Usage:
  python tools/fmse/fb_library.py                        (= --test all: every FB test log, alarm manager, matrix)
  python tools/fmse/fb_library.py --test FB_Valve1       (all tests of one FB; or a test id: --test V3)
  python tools/fmse/fb_library.py --list                 (all library FBs: kind, interface size, alarms, tests)
  python tools/fmse/fb_library.py --interface FB_Valve2  (inputs, configuration, outputs, alarm texts)
  python tools/fmse/fb_library.py --alarms               (alarm manager log, decisions D2 + D3)
  python tools/fmse/fb_library.py --cmdmatrix [--mode 2] (accepted commands per PackML state, decision D1)
  python tools/fmse/fb_library.py --item9                (FB_AnalogIn, limit alarm, FB_MotorDol A..E)
  python tools/fmse/fb_library.py --md fb.md --json
  python tools/fmse/fb_library.py --selftest
"""

import argparse
import json
import random
from pathlib import Path

import device_fb
from fb_library_ref import REF_10A, REF_9_DEVICE
from fmse_common import InputError, SelfTest, fmt_table, load_json, run_main

HERE = Path(__file__).resolve().parent
ITEM10A_EXAMPLES = HERE / "examples" / "item10a_examples.json"
PLC_LIB = HERE / "plc_lib"
LIB_VERSION = "1.0.0"
DT = 100                                       # ms per tick (test bench); GC_CYCLE_MS in plc_lib/TYPES.st


def load10a(path=None):
    D = load_json(path or ITEM10A_EXAMPLES)
    for k in ("fb_tests", "alarm_manager", "fb_interfaces", "_rules"):
        if k not in D:
            raise InputError(f"{path or ITEM10A_EXAMPLES}: section '{k}' is missing")
    return D


# ----------------------------------------------------------------------------- FB base
class FB:
    """Base: IN inputs, CFG configuration (also inputs in ST), OUT outputs; run() = one call."""
    IN = {}
    OUT = {}
    CFG = {}

    def __init__(self, cfg=None):
        self.i = dict(self.IN)
        self.o = dict(self.OUT)
        self.c = dict(self.CFG)
        self.init()
        for k, v in (cfg or {}).items():
            self.set(k, v)

    def init(self):
        pass

    # adapter interface (st_sim.STAdapter has the same three methods)
    def set(self, name, value):
        for d, src in ((self.i, self.IN), (self.c, self.CFG)):
            if name in src:
                d[name] = coerce_like(src[name], value, name)
                return
        raise InputError(f"{type(self).__name__}: '{name}' is not an input of the FB")

    def call(self):
        self.run()

    def outputs(self):
        return dict(self.o)


def coerce_like(default, v, name):
    """Event values to the type of the input (BOOL / INT / REAL), like the ST harness."""
    if isinstance(default, bool):
        return bool(v)
    if isinstance(default, int):
        if isinstance(v, float) and v != int(v):
            raise InputError(f"'{name}' needs a whole number, got {v}")
        return int(v)
    return float(v)


def edge(self, name):
    """Rising edge inside the FB: x AND NOT x_prev, x_prev starts FALSE (= R_TRIG)."""
    k = "_prev_" + name
    e = self.i[name] and not getattr(self, k, False)
    setattr(self, k, self.i[name])
    return e


# ----------------------------------------------------------------------------- base FBs (rules of item 10A)
class Sensor(FB):
    IN = {"xOn": False}
    OUT = {"xValue": False}
    CFG = {"tOn_ms": 0, "tOff_ms": 0}

    def init(self):
        self.cnt = 0

    def run(self):
        x = self.i["xOn"]
        if x != self.o["xValue"]:
            self.cnt += 1
            if self.cnt * DT >= (self.c["tOn_ms"] if x else self.c["tOff_ms"]):
                self.o["xValue"] = x
                self.cnt = 0
        else:
            self.cnt = 0


class Valve(FB):
    IN = {"xPosA": True, "xPosB": False, "xCmdB": False, "xEnable": True, "xReset": False}
    CFG = {"tMove_ms": 2000, "tLost_ms": 300, "tBoth_ms": 200}
    NSOL = 1

    def init(self):
        self.o = ({"qSol": False} if self.NSOL == 1 else {"qSolA": False, "qSolB": False})
        self.o.update({"xAtA": False, "xAtB": False, "xBusy": False, "xError": False, "iAlarm": 0})
        self.prevCmd = None
        self.moving = False
        self.n = self.nl = self.nb = 0

    def run(self):
        i, o, c = self.i, self.o, self.c
        rst = edge(self, "xReset")
        atA = i["xPosA"] and not i["xPosB"]
        atB = i["xPosB"] and not i["xPosA"]
        reached = atB if i["xCmdB"] else atA
        if o["xError"] and rst and not (i["xPosA"] and i["xPosB"]):
            o["xError"] = False
            o["iAlarm"] = 0
            self.moving = not reached
            self.n = self.nl = 0
        if i["xCmdB"] != self.prevCmd:
            self.moving = True
            self.n = 0
        self.nb = self.nb + 1 if (i["xPosA"] and i["xPosB"]) else 0
        if not o["xError"]:
            if self.nb * DT >= c["tBoth_ms"]:
                o["xError"], o["iAlarm"], self.moving = True, 3, False
            elif self.moving:
                self.nl = 0
                if i["xEnable"]:
                    self.n += 1
                    if reached:
                        self.moving = False
                    elif self.n * DT >= c["tMove_ms"]:
                        o["xError"], o["iAlarm"], self.moving = True, 1, False
            elif i["xEnable"]:
                self.nl = self.nl + 1 if not reached else 0
                if self.nl * DT >= c["tLost_ms"]:
                    o["xError"], o["iAlarm"] = True, 2
            else:
                self.nl = 0
        if self.NSOL == 1:
            o["qSol"] = i["xCmdB"] and i["xEnable"]
        else:
            o["qSolB"] = i["xCmdB"] and i["xEnable"]
            o["qSolA"] = (not i["xCmdB"]) and i["xEnable"]
        o["xAtA"], o["xAtB"] = atA, atB
        o["xBusy"] = self.moving and not o["xError"]
        self.prevCmd = i["xCmdB"]


class Valve1(Valve):
    NSOL = 1


class Valve2(Valve):
    NSOL = 2


class DriveSto(FB):
    IN = {"xReady": False, "xFault": False, "xSto": True, "xCmdRun": False, "xReset": False}
    OUT = {"wCtrl": 0, "iState": 0, "xWarn": False, "xError": False, "iAlarm": 0}

    def run(self):
        i, o = self.i, self.o
        rst = edge(self, "xReset")
        s, ack = o["iState"], False
        if i["xFault"] and s != 9:
            s, o["iAlarm"] = 9, 1
        elif s == 0:
            if i["xReady"] and not i["xSto"]:
                s = 1
        elif s == 1:
            if i["xSto"] or not i["xReady"]:
                s = 0
            elif i["xCmdRun"]:
                s = 2
        elif s == 2:
            if i["xSto"]:
                s = 0
            elif not i["xReady"]:
                s, o["iAlarm"] = 9, 3
            elif not i["xCmdRun"]:
                s = 1
        elif s == 9:
            if rst and not i["xFault"]:
                s, o["iAlarm"], ack = 0, 0, True
        o["iState"] = s
        o["xError"] = s == 9
        o["xWarn"] = i["xCmdRun"] and i["xSto"]
        o["wCtrl"] = (0 if i["xSto"] else 1) | (2 if s == 2 else 0) | (128 if ack else 0)


class Heater(FB):
    IN = {"xOnFb": False, "xOverTemp": False, "rTemp": 20.0, "xTempGood": True, "xEnable": False, "rSp": 60.0,
          "xReset": False}
    OUT = {"qOn": False, "xError": False, "iAlarm": 0}
    CFG = {"rHyst": 2.0, "tFb_ms": 500}

    def init(self):
        self.heat = False
        self.nfb = self.nw = 0

    def run(self):
        i, o, c = self.i, self.o, self.c
        rst = edge(self, "xReset")
        if o["xError"] and rst and not i["xOverTemp"] and (i["xTempGood"] or not i["xEnable"]) and not i["xOnFb"]:
            o["xError"], o["iAlarm"] = False, 0
            self.nfb = self.nw = 0
        if not o["xError"]:
            if i["xOverTemp"]:
                o["xError"], o["iAlarm"] = True, 1
            elif i["xEnable"] and not i["xTempGood"]:
                o["xError"], o["iAlarm"] = True, 3
        if not i["xEnable"] or o["xError"]:
            self.heat = False
        elif i["rTemp"] <= i["rSp"] - c["rHyst"]:
            self.heat = True
        elif i["rTemp"] >= i["rSp"]:
            self.heat = False
        q = self.heat
        self.nfb = self.nfb + 1 if (q and not i["xOnFb"]) else 0
        self.nw = self.nw + 1 if ((not q) and i["xOnFb"]) else 0
        if not o["xError"] and self.nfb * DT >= c["tFb_ms"]:
            o["xError"], o["iAlarm"] = True, 2
        if not o["xError"] and self.nw * DT >= c["tFb_ms"]:
            o["xError"], o["iAlarm"] = True, 4
        if o["xError"]:
            self.heat = q = False
        o["qOn"] = q


class PushButton(FB):
    IN = {"xPb": False, "iLampMode": 0}
    OUT = {"qLamp": False, "xPressed": False, "xClick": False}

    def init(self):
        self.c_ = 0

    def run(self):
        blink = (self.c_ // 5) % 2 == 0
        self.c_ += 1
        m = self.i["iLampMode"]
        self.o["qLamp"] = m == 1 or (m == 2 and blink)
        self.o["xClick"] = edge(self, "xPb")
        self.o["xPressed"] = self.i["xPb"]


class SignalTower(FB):
    IN = {"iState": 2, "iAlarmClass": 0, "xHornAck": False}
    OUT = {"qRed": False, "qYellow": False, "qGreen": False, "qBuzzer": False}

    def init(self):
        self.c_ = 0
        self.prevCls = 0
        self.horn = False

    def run(self):
        i, o = self.i, self.o
        blink = (self.c_ // 5) % 2 == 0
        self.c_ += 1
        s, a = i["iState"], i["iAlarmClass"]
        ack = edge(self, "xHornAck")
        o["qRed"] = a == 1 or s in (8, 9)
        o["qYellow"] = a in (2, 3) or s in (2, 5, 11)
        o["qGreen"] = s in (3, 6, 12, 14, 16) or (s in (4, 17) and blink)
        if a in (1, 2) and a != self.prevCls:
            self.horn = True
        if ack or a == 0:
            self.horn = False
        self.prevCls = a
        o["qBuzzer"] = self.horn


class HandshakeHw(FB):
    IN = {"xReady": False, "xBusy": False, "xDone": False, "xFault": False, "xStart": False, "xReset": False}
    OUT = {"qRequest": False, "qAck": False, "qEnable": False, "qReset": False, "iStep": 0, "xDoneOut": False,
           "xError": False, "iAlarm": 0}
    CFG = {"tHs_ms": 2000, "tJob_ms": 10000}

    def init(self):
        self.n = 0

    def run(self):
        i, o, c = self.i, self.o, self.c
        rst = edge(self, "xReset")
        o["qReset"] = rst
        o["xDoneOut"] = False
        st = o["iStep"]
        if o["xError"]:
            if rst and not i["xFault"]:
                o["xError"], o["iAlarm"], st = False, 0, 0
        elif i["xFault"] and st != 0:
            o["xError"], o["iAlarm"] = True, 4
        elif st == 0:
            if i["xStart"] and i["xReady"]:
                st, self.n = 10, 0
        elif st == 10:
            self.n += 1
            if i["xBusy"]:
                st, self.n = 20, 0
            elif self.n * DT >= c["tHs_ms"]:
                o["xError"], o["iAlarm"] = True, 1
        elif st == 20:
            self.n += 1
            if i["xDone"]:
                st, self.n = 30, 0
            elif self.n * DT >= c["tJob_ms"]:
                o["xError"], o["iAlarm"] = True, 2
        elif st == 30:
            self.n += 1
            if not i["xDone"]:
                st, o["xDoneOut"] = 0, True
            elif self.n * DT >= c["tHs_ms"]:
                o["xError"], o["iAlarm"] = True, 3
        o["iStep"] = st
        e = o["xError"]
        o["qRequest"] = st in (10, 20) and not e
        o["qEnable"] = st in (10, 20) and not e
        o["qAck"] = st == 30 and not e


class Feeder(FB):
    IN = {"xSupplyOn": True}
    OUT = {"xOk": False, "iAlarm": 0}
    CFG = {"tDelay_ms": 200}

    def init(self):
        self.n = 0

    def run(self):
        self.n = self.n + 1 if not self.i["xSupplyOn"] else 0
        self.o["xOk"] = self.i["xSupplyOn"]
        self.o["iAlarm"] = 1 if self.n * DT >= self.c["tDelay_ms"] else 0


class Ups(FB):
    IN = {"xUpsOk": True, "xOnBattery": False}
    OUT = {"xShutdownReq": False, "iAlarm": 0}
    CFG = {"tBuffer_ms": 5000}

    def init(self):
        self.n = 0

    def run(self):
        i, o = self.i, self.o
        self.n = self.n + 1 if i["xOnBattery"] else 0
        o["xShutdownReq"] = self.n * DT >= self.c["tBuffer_ms"]
        o["iAlarm"] = 1 if not i["xUpsOk"] else (2 if i["xOnBattery"] else 0)


class Safe2Ch(FB):
    IN = {"xCh1": False, "xCh2": False, "xReset": False}
    OUT = {"xOk": False, "xResetReq": False, "xDiscErr": False, "iAlarm": 0}
    CFG = {"tDisc_ms": 500}

    def init(self):
        self.latched = True
        self.nd = 0
        self.bothOpen = False

    def run(self):
        i, o, c = self.i, self.o, self.c
        rst = edge(self, "xReset")
        a, b = i["xCh1"], i["xCh2"]
        self.nd = self.nd + 1 if a != b else 0
        if self.nd * DT >= c["tDisc_ms"] and not o["xDiscErr"]:
            o["xDiscErr"], o["iAlarm"], self.bothOpen = True, 1, False
        if o["xDiscErr"] and not a and not b:
            self.bothOpen = True
        if not (a and b):
            self.latched = True
        if rst and a and b:
            if o["xDiscErr"] and self.bothOpen:
                o["xDiscErr"], o["iAlarm"] = False, 0
            if not o["xDiscErr"]:
                self.latched = False
        o["xOk"] = a and b and not self.latched and not o["xDiscErr"]
        o["xResetReq"] = self.latched and a and b and not o["xDiscErr"]


class ModeSwitch(FB):
    IN = {"xAuto": False, "xMaint": False}
    OUT = {"iMode": 3, "xError": False, "iAlarm": 0}
    CFG = {"tDisc_ms": 500}

    def init(self):
        self.n = 0

    def run(self):
        i, o = self.i, self.o
        a, m = i["xAuto"], i["xMaint"]
        self.n = self.n + 1 if (a and m) else 0
        if a and not m:
            o["iMode"] = 1
        elif m and not a:
            o["iMode"] = 2
        elif not a and not m:
            o["iMode"] = 3
        o["xError"] = self.n * DT >= self.c["tDisc_ms"]
        o["iAlarm"] = 1 if o["xError"] else 0


class Edm(FB):
    IN = {"xCmd": False, "xFb": True, "xReset": False}
    OUT = {"xOn": False, "xError": False, "iAlarm": 0}
    CFG = {"tEdm_ms": 300, "bInverted": True}

    def init(self):
        self.n = 0

    def run(self):
        i, o, c = self.i, self.o, self.c
        rst = edge(self, "xReset")
        exp = (not i["xCmd"]) if c["bInverted"] else i["xCmd"]
        okfb = i["xFb"] == exp
        self.n = self.n + 1 if not okfb else 0
        if o["xError"] and rst and okfb:
            o["xError"], o["iAlarm"] = False, 0
        if not o["xError"] and self.n * DT >= c["tEdm_ms"]:
            o["xError"], o["iAlarm"] = True, 1
        o["xOn"] = i["xCmd"] and okfb and not o["xError"]


class TwoHand(FB):
    IN = {"xLeft": False, "xLeft2": False, "xRight": False, "xRight2": False}
    OUT = {"xActuated": False, "xError": False, "iAlarm": 0}
    CFG = {"tSync_ms": 500}

    def init(self):
        self.n = 0
        self.blocked = False

    def run(self):
        i, o, c = self.i, self.o, self.c
        L = i["xLeft"] and i["xLeft2"]
        R = i["xRight"] and i["xRight2"]
        if not L and not R:
            self.blocked, self.n = False, 0
            o["xError"], o["iAlarm"], o["xActuated"] = False, 0, False
            return
        if L != R:
            self.n += 1
            if self.n * DT > c["tSync_ms"] and not o["xActuated"]:
                self.blocked = True
                o["xError"], o["iAlarm"] = True, 1
            o["xActuated"] = False
            return
        o["xActuated"] = not self.blocked


class Scanner(FB):
    IN = {"xOssd1": False, "xOssd2": False, "xWarn": False, "iField": 1}
    OUT = {"qFieldA": False, "qFieldB": False, "xFree": False, "xWarnOut": False, "iAlarm": 0}

    def run(self):
        i, o = self.i, self.o
        f = i["iField"]
        o["qFieldA"], o["qFieldB"] = f == 1, f == 2
        o["xFree"] = i["xOssd1"] and i["xOssd2"]
        o["xWarnOut"] = i["xWarn"]
        o["iAlarm"] = 0 if f in (1, 2) else 2


class DoorLock(FB):
    IN = {"xClosed": True, "xClosed2": True, "xLocked": True, "xLocked2": True, "xRequest": False}
    OUT = {"xClosedOk": False, "xLockedOk": False, "xUnlockReq": False, "xError": False, "iAlarm": 0}
    CFG = {"tDisc_ms": 500}

    def init(self):
        self.nc = self.nl = 0
        self.wasOpen = False

    def run(self):
        i, o, c = self.i, self.o, self.c
        req = edge(self, "xRequest")
        C = i["xClosed"] and i["xClosed2"]
        L = i["xLocked"] and i["xLocked2"]
        self.nc = self.nc + 1 if i["xClosed"] != i["xClosed2"] else 0
        self.nl = self.nl + 1 if i["xLocked"] != i["xLocked2"] else 0
        if self.nc * DT >= c["tDisc_ms"]:
            o["xError"], o["iAlarm"] = True, 1
        elif self.nl * DT >= c["tDisc_ms"]:
            o["xError"], o["iAlarm"] = True, 2
        if L and not C and not o["xError"]:
            o["xError"], o["iAlarm"] = True, 3
        if req and C and L:
            o["xUnlockReq"] = True
        if not i["xClosed"] and not i["xClosed2"]:
            self.wasOpen = True
        if o["xUnlockReq"] and self.wasOpen and C:
            o["xUnlockReq"], self.wasOpen = False, False
        o["xClosedOk"], o["xLockedOk"] = C, L


# ----------------------------------------------------------------------------- command interface (decision D1)
STATES = {"Clearing": 1, "Stopped": 2, "Starting": 3, "Idle": 4, "Suspended": 5, "Execute": 6, "Stopping": 7,
          "Aborting": 8, "Aborted": 9, "Holding": 10, "Held": 11, "Unholding": 12, "Suspending": 13,
          "Unsuspending": 14, "Resetting": 15, "Completing": 16, "Complete": 17}
SN = {v: k for k, v in STATES.items()}
CMDS = {"Reset": 1, "Start": 2, "Stop": 3, "Hold": 4, "Unhold": 5, "Suspend": 6, "Unsuspend": 7, "Abort": 8, "Clear": 9}
CN = {v: k for k, v in CMDS.items()}
EDGES = [["Stopped", "Resetting", "Reset"], ["Complete", "Resetting", "Reset"], ["Idle", "Starting", "Start"],
         ["Execute", "Holding", "Hold"], ["Held", "Unholding", "Unhold"], ["Execute", "Suspending", "Suspend"],
         ["Suspended", "Unsuspending", "Unsuspend"], ["Aborted", "Clearing", "Clear"]]
MODES = {1: ["Reset", "Start", "Stop", "Hold", "Unhold", "Suspend", "Unsuspend", "Abort", "Clear"],
         2: ["Reset", "Start", "Stop", "Hold", "Unhold", "Abort", "Clear"], 3: ["Reset", "Start", "Stop", "Abort", "Clear"]}
MODE_NAMES = {1: "Production", 2: "Maintenance", 3: "Manual"}


def allowed(cmd, st, mode):
    """Item-5 tables: EDGES label, Stop / Abort from (almost) every state, command in MODES[mode]."""
    c, s = CN.get(cmd), SN.get(st)
    if c is None or s is None or c not in MODES.get(mode, []):
        return False
    if any(a == s and lab == c for a, b, lab in EDGES):
        return True
    if c == "Stop":
        return s not in ("Stopped", "Stopping", "Aborting", "Aborted", "Clearing")
    if c == "Abort":
        return s not in ("Aborting", "Aborted")
    return False


class CmdIf(FB):
    """4-phase command echo: edge on CmdChangeRequest -> CmdAck / CmdRej; CC clears the request, module the echo."""
    IN = {"iCntrlCmd": 0, "xCmdChangeRequest": False, "iState": 2, "iMode": 1}
    OUT = {"xCmdAck": False, "xCmdRej": False, "iCmdExec": 0, "iLastCmd": 0, "iRejectCount": 0}

    def run(self):
        i, o = self.i, self.o
        e = edge(self, "xCmdChangeRequest")
        o["iCmdExec"] = 0
        if e:
            ok = allowed(i["iCntrlCmd"], i["iState"], i["iMode"])
            o["iLastCmd"] = i["iCntrlCmd"]
            if ok:
                o["xCmdAck"], o["iCmdExec"] = True, i["iCntrlCmd"]
            else:
                o["xCmdRej"] = True
                o["iRejectCount"] += 1
        if not i["xCmdChangeRequest"]:
            o["xCmdAck"] = o["xCmdRej"] = False


# ----------------------------------------------------------------------------- alarm manager (decisions D2 + D3)
CLASS_NO = {"A": 1, "B": 2, "C": 3}
REACTION = {0: "none", 1: "Abort", 2: "Hold (if Execute)", 3: "none (warning)"}


class AlarmMgr(FB):
    """Active list in activation order; AlarmNo = best (class, order) of the A/B alarms, WarningNo = earliest C."""
    IN = {"iEvent": 0, "iInst": 0, "iCode": 0, "iClass": 0}
    OUT = {"iAlarmNo": 0, "iWarningNo": 0, "iAlarmClass": 0, "iReaction": 0, "iActive": 0, "xOverflow": False}
    CFG = {"iModule": 2}
    MAX_ACT = 32

    def init(self):
        self.active = {}
        self.order = 0

    def run(self):
        i, o = self.i, self.o
        if i["iEvent"]:
            no = self.c["iModule"] * 1000 + 10 * i["iInst"] + i["iCode"]
            if i["iEvent"] == 1 and no not in self.active:
                if len(self.active) < self.MAX_ACT:
                    self.order += 1
                    self.active[no] = (i["iClass"], self.order)
                else:
                    o["xOverflow"] = True
            elif i["iEvent"] == 2:
                self.active.pop(no, None)
        al = [(v[0], v[1], n) for n, v in self.active.items() if v[0] in (1, 2)]
        wa = [(v[1], n) for n, v in self.active.items() if v[0] == 3]
        o["iAlarmNo"] = min(al)[2] if al else 0
        o["iWarningNo"] = min(wa)[1] if wa else 0
        o["iAlarmClass"] = min(al)[0] if al else (3 if wa else 0)
        o["iReaction"] = o["iAlarmClass"]
        o["iActive"] = len(self.active)


# ----------------------------------------------------------------------------- item-9 FBs (same rules as device_fb.py)
MOTOR_STATES = device_fb.MOTOR_STATES
MOTOR_ALARMS = device_fb.MOTOR_ALARMS
QUALITY = {0: "GOOD", 1: "UNCERTAIN", 2: "BAD"}
AI_STATUS = {0: "ok", 1: "fault low (wire break)", 2: "under range", 3: "over range", 4: "fault high"}


class MotorDol(FB):
    """Item-9 FB_MotorDol: states 0 STOPPED, 1 STARTING, 2 RUNNING, 3 STOPPING, 9 FAULT; alarms 1..4."""
    IN = {"xRunFb": False, "xTripped": False, "xCmd": False, "xReset": False}
    OUT = {"qRun": False, "iState": 0, "xError": False, "iAlarm": 0}
    CFG = {"tFb_ms": 500}

    def init(self):
        self.n = self.nfb = 0

    def run(self):
        i, o, c = self.i, self.o, self.c
        ce = edge(self, "xCmd")
        rst = edge(self, "xReset")
        st = o["iState"]
        if i["xTripped"] and st != 9:
            st, o["iAlarm"] = 9, 3
        elif st == 0:
            self.nfb = self.nfb + 1 if i["xRunFb"] else 0
            if self.nfb * DT >= c["tFb_ms"]:
                st, o["iAlarm"] = 9, 4
            elif ce:
                st, self.n = 1, 0
        elif st == 1:
            self.n += 1
            if i["xRunFb"]:
                st = 2
            elif self.n * DT >= c["tFb_ms"]:
                st, o["iAlarm"] = 9, 1
        elif st == 2:
            if not i["xCmd"]:
                st, self.n = 3, 0
            elif not i["xRunFb"]:
                st, o["iAlarm"] = 9, 2
        elif st == 3:
            self.n += 1
            if not i["xRunFb"]:
                st, self.nfb = 0, 0
            elif self.n * DT >= c["tFb_ms"]:
                st, o["iAlarm"] = 9, 4
        elif st == 9:
            if rst and not i["xTripped"] and not (o["iAlarm"] == 4 and i["xRunFb"]):
                st, o["iAlarm"], self.nfb = 0, 0, 0
        o["iState"] = st
        o["qRun"] = st in (1, 2)
        o["xError"] = st == 9


class AnalogIn(FB):
    """Item-9 FB_AnalogIn: raw 0..27648 = 4..20 mA, NAMUR NE 43 quality, substitute value lo for BAD."""
    IN = {"iValue": 0}
    OUT = {"rMa": 0.0, "rValueLin": 0.0, "rValue": 0.0, "iQuality": 0, "iStatus": 0, "xGood": False, "iAlarm": 0}
    CFG = {"rLo": 0.0, "rHi": 10.0}

    def run(self):
        i, o, c = self.i, self.o, self.c
        mA = 4.0 + 16.0 * i["iValue"] / 27648.0
        if mA <= 3.6:
            q, s = 2, 1
        elif mA < 3.8:
            q, s = 1, 2
        elif mA <= 20.5:
            q, s = 0, 0
        elif mA < 21.0:
            q, s = 1, 3
        else:
            q, s = 2, 4
        v = c["rLo"] + (c["rHi"] - c["rLo"]) * (mA - 4.0) / 16.0
        o["rMa"], o["rValueLin"] = mA, v
        o["rValue"] = c["rLo"] if q == 2 else min(c["rHi"], max(c["rLo"], v))
        o["iQuality"], o["iStatus"], o["xGood"] = q, s, q == 0
        o["iAlarm"] = 3 if q != 0 else 0


class LimitAlarm(FB):
    """Item-9 limit alarm: ON after iDelay consecutive samples >= rH (<= rL), OFF at once below rH - rHyst."""
    IN = {"rValue": 0.0}
    OUT = {"xH": False, "xL": False}
    CFG = {"rH": 8.0, "rL": 3.0, "rHyst": 0.2, "iDelay": 2}

    def init(self):
        self.nh = self.nl = 0

    def run(self):
        v, o, c = self.i["rValue"], self.o, self.c
        self.nh = self.nh + 1 if v >= c["rH"] else 0
        self.nl = self.nl + 1 if v <= c["rL"] else 0
        if not o["xH"] and self.nh >= c["iDelay"]:
            o["xH"] = True
        elif o["xH"] and v < c["rH"] - c["rHyst"]:
            o["xH"] = False
        if not o["xL"] and self.nl >= c["iDelay"]:
            o["xL"] = True
        elif o["xL"] and v > c["rL"] + c["rHyst"]:
            o["xL"] = False


# ----------------------------------------------------------------------------- wrappers (rule fb_library)
class Safe2ChWrap(FB):
    """FB_Estop / FB_Door2Ch / FB_EnableSwitch / FB_LightCurtain = FB_Safe2Ch with the codegen signal names."""
    CH = ("xCh1", "xCh2")
    WARN = False
    CFG = {"tDisc_ms": 500}

    def init(self):
        self.b = Safe2Ch()

    def run(self):
        b, i, o = self.b, self.i, self.o
        b.c["tDisc_ms"] = self.c["tDisc_ms"]
        b.i["xCh1"], b.i["xCh2"], b.i["xReset"] = i[self.CH[0]], i[self.CH[1]], i["xReset"]
        b.run()
        o["xSafe"] = b.o["xOk"]
        if self.WARN:
            o["xWarnOut"] = i["xWarn"]
        o["xResetReq"], o["xDiscErr"], o["iAlarm"] = b.o["xResetReq"], b.o["xDiscErr"], b.o["iAlarm"]


class Estop(Safe2ChWrap):
    CH = ("xOk", "xOk2")
    IN = {"xOk": False, "xOk2": False, "xReset": False}
    OUT = {"xSafe": False, "xResetReq": False, "xDiscErr": False, "iAlarm": 0}


class EnableSwitch(Estop):
    pass


class Door2Ch(Safe2ChWrap):
    CH = ("xClosed", "xClosed2")
    IN = {"xClosed": False, "xClosed2": False, "xReset": False}
    OUT = {"xSafe": False, "xResetReq": False, "xDiscErr": False, "iAlarm": 0}


class LightCurtain(Safe2ChWrap):
    CH = ("xOssd1", "xOssd2")
    WARN = True
    IN = {"xOssd1": False, "xOssd2": False, "xWarn": False, "xReset": False}
    OUT = {"xSafe": False, "xWarnOut": False, "xResetReq": False, "xDiscErr": False, "iAlarm": 0}


class SafetyCoupling(FB):
    """Coupling to the neighbour (item 8 COUPLING): one FB_Safe2Ch for EstopIn, one for ZoneFree."""
    IN = {"xEstopIn": False, "xEstopIn2": False, "xZoneFree": False, "xZoneFree2": False, "xReset": False}
    OUT = {"xEstopOk": False, "xZoneOk": False, "xResetReq": False, "xDiscErr": False, "iAlarm": 0}
    CFG = {"tDisc_ms": 500}

    def init(self):
        self.e, self.z = Safe2Ch(), Safe2Ch()

    def run(self):
        i, o = self.i, self.o
        for b, a1, a2 in ((self.e, "xEstopIn", "xEstopIn2"), (self.z, "xZoneFree", "xZoneFree2")):
            b.c["tDisc_ms"] = self.c["tDisc_ms"]
            b.i["xCh1"], b.i["xCh2"], b.i["xReset"] = i[a1], i[a2], i["xReset"]
            b.run()
        o["xEstopOk"], o["xZoneOk"] = self.e.o["xOk"], self.z.o["xOk"]
        o["xResetReq"] = self.e.o["xResetReq"] or self.z.o["xResetReq"]
        o["xDiscErr"] = self.e.o["xDiscErr"] or self.z.o["xDiscErr"]
        o["iAlarm"] = 1 if self.e.o["xDiscErr"] else (2 if self.z.o["xDiscErr"] else 0)


class EdmWrap(FB):
    """FB_ZoneOut / FB_ContactorPair = FB_Edm(bInverted TRUE) with the codegen feedback name."""
    FBN = "xFb"
    CFG = {"tEdm_ms": 300}

    def init(self):
        self.b = Edm({"bInverted": True})

    def run(self):
        b, i, o = self.b, self.i, self.o
        b.c["tEdm_ms"] = self.c["tEdm_ms"]
        b.i["xCmd"], b.i["xFb"], b.i["xReset"] = i["xCmd"], i[self.FBN], i["xReset"]
        b.run()
        o.update(b.o)


class ZoneOut(EdmWrap):
    FBN = "xFb"
    IN = {"xCmd": False, "xFb": True, "xReset": False}
    OUT = {"xOn": False, "xError": False, "iAlarm": 0}


class ContactorPair(EdmWrap):
    FBN = "xEDM"
    IN = {"xCmd": False, "xEDM": True, "xReset": False}
    OUT = {"xOn": False, "xError": False, "iAlarm": 0}


class SafeValve(FB):
    """Safety valve pair (item 8 SAFE_VALVE): 2 x FB_Edm(bInverted FALSE), position feedback TRUE = open."""
    IN = {"xCmdA": False, "xCmdB": False, "xFbA": False, "xFbB": False, "xReset": False}
    OUT = {"xOnA": False, "xOnB": False, "xError": False, "iAlarm": 0}
    CFG = {"tEdm_ms": 300}

    def init(self):
        self.a, self.b = Edm({"bInverted": False, "xFb": False}), Edm({"bInverted": False, "xFb": False})

    def run(self):
        i, o = self.i, self.o
        for e, cm, fb in ((self.a, "xCmdA", "xFbA"), (self.b, "xCmdB", "xFbB")):
            e.c["tEdm_ms"] = self.c["tEdm_ms"]
            e.i["xCmd"], e.i["xFb"], e.i["xReset"] = i[cm], i[fb], i["xReset"]
            e.run()
        o["xOnA"], o["xOnB"] = self.a.o["xOn"], self.b.o["xOn"]
        o["xError"] = self.a.o["xError"] or self.b.o["xError"]
        o["iAlarm"] = 1 if self.a.o["xError"] else (2 if self.b.o["xError"] else 0)


# ----------------------------------------------------------------------------- library table
# name: (class, kind, alarms {code: text})
LIBRARY = {
    "FB_Sensor": (Sensor, "base", {}),
    "FB_Valve1": (Valve1, "base", {1: "end position not reached", 2: "left the end position without command",
                                   3: "both end switches on"}),
    "FB_Valve2": (Valve2, "base", {1: "end position not reached", 2: "left the end position without command",
                                   3: "both end switches on"}),
    "FB_MotorDol": (MotorDol, "item 9", dict(MOTOR_ALARMS)),
    "FB_DriveSto": (DriveSto, "base", {1: "drive fault", 3: "ready lost while running"}),
    "FB_AnalogIn": (AnalogIn, "item 9", {3: "signal quality bad/uncertain (NAMUR NE 43)"}),
    "FB_LimitAlarm": (LimitAlarm, "item 9", {}),
    "FB_Heater": (Heater, "base", {1: "over-temperature (safety thermostat)", 2: "no contactor feedback",
                                   3: "temperature signal bad", 4: "feedback without command (contactor welded?)"}),
    "FB_PushButton": (PushButton, "base", {}),
    "FB_SignalTower": (SignalTower, "base", {}),
    "FB_HandshakeHw": (HandshakeHw, "base", {1: "partner did not start (busy missing)", 2: "job time-out",
                                             3: "done not removed", 4: "partner fault"}),
    "FB_Feeder": (Feeder, "base", {1: "feeder breaker off"}),
    "FB_Ups": (Ups, "base", {1: "UPS fault", 2: "on battery"}),
    "FB_Safe2Ch": (Safe2Ch, "base", {1: "discrepancy"}),
    "FB_Edm": (Edm, "base", {1: "feedback does not follow (welded / not switching)"}),
    "FB_ModeSwitch": (ModeSwitch, "base", {1: "both key positions on (discrepancy)"}),
    "FB_TwoHand": (TwoHand, "base", {1: "not simultaneous - release both"}),
    "FB_Scanner": (Scanner, "base", {2: "invalid field set"}),
    "FB_DoorLock": (DoorLock, "base", {1: "door switch discrepancy", 2: "lock switch discrepancy",
                                       3: "locked but not closed (tongue missing / manipulation)"}),
    "FB_CmdIf": (CmdIf, "module", {}),
    "FB_AlarmMgr": (AlarmMgr, "module", {}),
    "FB_Estop": (Estop, "wrapper", {1: "discrepancy"}),
    "FB_Door2Ch": (Door2Ch, "wrapper", {1: "discrepancy"}),
    "FB_EnableSwitch": (EnableSwitch, "wrapper", {1: "discrepancy"}),
    "FB_LightCurtain": (LightCurtain, "wrapper", {1: "discrepancy"}),
    "FB_SafetyCoupling": (SafetyCoupling, "wrapper", {1: "e-stop coupling discrepancy",
                                                      2: "zone-free coupling discrepancy"}),
    "FB_ZoneOut": (ZoneOut, "wrapper", {1: "feedback does not follow (welded / not switching)"}),
    "FB_ContactorPair": (ContactorPair, "wrapper", {1: "feedback does not follow (welded / not switching)"}),
    "FB_SafeValve": (SafeValve, "wrapper", {1: "valve A feedback does not follow", 2: "valve B feedback does not follow"}),
}
FBS = {k: v[0] for k, v in LIBRARY.items()}
WRAPPER_BASE = {"FB_Estop": "FB_Safe2Ch", "FB_Door2Ch": "FB_Safe2Ch", "FB_EnableSwitch": "FB_Safe2Ch",
                "FB_LightCurtain": "FB_Safe2Ch", "FB_SafetyCoupling": "FB_Safe2Ch", "FB_ZoneOut": "FB_Edm",
                "FB_ContactorPair": "FB_Edm", "FB_SafeValve": "FB_Edm"}


def make_py(name, cfg=None):
    """Adapter factory for the Python FBs (st_sim.py has make_st with the same signature)."""
    if name not in FBS:
        raise InputError(f"unknown FB '{name}' ({', '.join(FBS)})")
    return FBS[name](cfg)


# ----------------------------------------------------------------------------- shared harness (Python and ST)
def conv(v):
    if v in ("1", "TRUE", "True"):
        return True
    if v in ("0", "FALSE", "False"):
        return False
    try:
        return int(v)
    except ValueError:
        try:
            return float(v)
        except ValueError:
            raise InputError(f"event value '{v}' is not 0/1/TRUE/FALSE or a number")


def fmt(v):
    return ("1" if v else "0") if isinstance(v, bool) else (f"{v:g}" if isinstance(v, float) else str(v))


def run_test(make, t):
    """One fb_test: returns the log lines (rule 'common')."""
    fb = make(t["fb"], t.get("cfg") or {})
    log, prev = [], None
    for k in range(t["K"]):
        for tk, *sets in t["events"]:
            if tk == k:
                for s in sets:
                    if "=" not in s:
                        raise InputError(f"{t['name']}: event '{s}' must be name=value")
                    n, v = s.split("=", 1)
                    fb.set(n.strip(), conv(v.strip()))
        fb.call()
        cur = fb.outputs()
        if prev is None:
            log.append(f"{k} init " + " ".join(f"{n}={fmt(v)}" for n, v in cur.items()))
        else:
            ch = [f"{n}={fmt(v)}" for n, v in cur.items() if v != prev[n]]
            if ch:
                log.append(f"{k} " + " ".join(ch))
        prev = cur
    return log


def alarm_log(make, A):
    """Alarm manager log (one line per event) through FB_AlarmMgr."""
    fb = make("FB_AlarmMgr", {"iModule": A["module_code"]})
    cls = {(x[0], x[1]): x[2] for x in A["classes"]}
    log = []
    for t, ev, inst, alarm in A["events"]:
        fbt = "MODULE" if inst == 0 else A["instances"][inst - 1][1]
        if (fbt, alarm) not in cls:
            raise InputError(f"alarm_manager: no class for ({fbt}, {alarm})")
        c = cls[(fbt, alarm)]
        if ev not in ("on", "off"):
            raise InputError(f"alarm_manager: event '{ev}' must be on / off")
        for n, v in (("iEvent", 1 if ev == "on" else 2), ("iInst", inst), ("iCode", alarm), ("iClass", CLASS_NO[c])):
            fb.set(n, v)
        fb.call()
        o = fb.outputs()
        fb.set("iEvent", 0)
        no = A["module_code"] * 1000 + 10 * inst + alarm
        log.append(f"{t} {ev} {no} class {c} -> AlarmNo={o['iAlarmNo']} WarningNo={o['iWarningNo']} "
                   f"AlarmClass={o['iAlarmClass']} reaction={REACTION[o['iReaction']]}")
    return log


def cmd_matrix(allowed_fn, mode=1):
    """[(state name, [accepted command names])] for one mode."""
    return [(s, [c for c in CMDS if allowed_fn(CMDS[c], STATES[s], mode)]) for s in STATES]


def text_10a(tests, logs, alarm_lines, matrix, mode=1):
    out = []
    for t, L in zip(tests, logs):
        out.append(f"TEST {t['fb']} | {t['name']} | {len(L)} lines")
        out += ["    " + x for x in L]
    if alarm_lines is not None:
        out.append("ALARM MANAGER")
        out += ["    " + x for x in alarm_lines]
    if matrix is not None:
        out.append(f"CMD MATRIX ({MODE_NAMES.get(mode, mode)}): rows state, accepted commands")
        out += [f"    {s} {cmds}" for s, cmds in matrix]
    return out


def run_10a(make, allowed_fn, D, select=None):
    """All (or selected) FB tests + alarm manager + matrix -> (tests, logs, alarm lines, matrix, text lines)."""
    tests = [t for t in D["fb_tests"] if select is None or test_matches(t, select)]
    logs = [run_test(make, t) for t in tests]
    full = select is None
    al = alarm_log(make, D["alarm_manager"]) if full else None
    mx = cmd_matrix(allowed_fn) if full else None
    return tests, logs, al, mx, text_10a(tests, logs, al, mx)


def test_matches(t, sel):
    s = sel.upper()
    return s in ("ALL",) or t["fb"].upper() == s or t["name"].split()[0].upper() == s


# ---- item-9 scenarios through any adapter (Python FB or ST FB)
def analog_rows(make, an):
    fb = make("FB_AnalogIn", {"rLo": an["lo"], "rHi": an["hi"]})
    rows = []
    for raw in an["raws"]:
        fb.set("iValue", raw)
        fb.call()
        o = fb.outputs()
        rows.append((raw, round(o["rMa"], 3), QUALITY[o["iQuality"]], AI_STATUS[o["iStatus"]],
                     round(o["rValueLin"], 3), round(o["rValue"], 3)))
    return rows


def limit_rows(make, lm):
    fb = make("FB_LimitAlarm", {"rH": lm["H"], "rL": lm["L"], "rHyst": lm["hyst"], "iDelay": lm["delay"]})
    rows, ev, ph, pl = [], [], False, False
    for i, v in enumerate(lm["values"]):
        fb.set("rValue", v)
        fb.call()
        o = fb.outputs()
        if o["xH"] != ph:
            ev.append((i, "H on" if o["xH"] else "H off"))
        if o["xL"] != pl:
            ev.append((i, "L on" if o["xL"] else "L off"))
        ph, pl = o["xH"], o["xL"]
        rows.append((i, v, int(o["xH"]), int(o["xL"])))
    return rows, ev


def motor_scenario(make, M, events):
    """Item-9 motor plant model (device_fb.motor_run) around FB_MotorDol of the adapter. Returns dict like motor_run."""
    device_fb.check_motor_events(events)
    if M.get("tick_ms", 100) != DT:
        raise InputError(f"motor: tick_ms must be {DT} (time base of the library)")
    fb = make("FB_MotorDol", {"tFb_ms": M["T_fb_ms"]})
    cmd = fbb = trip = weld = run = cont_prev = False
    on, st0, log = 0, 0, []
    alarm = 0
    for k in range(M["K"]):
        reset = False
        for tk, e in events:
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
        cont = run or (weld and cont_prev)
        cont_prev = cont
        on = on + 1 if cont else 0
        runfb = on >= 2 and not fbb
        for n, v in (("xCmd", cmd), ("xRunFb", runfb), ("xTripped", trip), ("xReset", reset)):
            fb.set(n, v)
        fb.call()
        o = fb.outputs()
        st, alarm, run = o["iState"], o["iAlarm"], o["qRun"]
        if st != st0:
            line = f"{k} {MOTOR_STATES[st0]} -> {MOTOR_STATES[st]}"
            if st == 9:
                line += f" alarm {alarm} {MOTOR_ALARMS[alarm]}"
            elif st0 == 9:
                line += " reset accepted"
            log.append(line)
        elif reset and st0 == 9:
            log.append(f"{k} reset rejected (alarm {alarm})")
        st0 = st
    return {"log": log, "final": MOTOR_STATES[st0], "alarm": alarm, "run": int(run)}


def item9_lines(make, D9):
    """The FB_AnalogIn / limit / motor lines in the format of REF_9_DEVICE."""
    out = [f"ai {r[0]} {r[1]} {r[2]} {r[3]} {r[4]} {r[5]}" for r in analog_rows(make, D9["analog"])]
    rows, ev = limit_rows(make, D9["limits"])
    out += [f"lim {i} {v} {h} {l}" for i, v, h, l in rows]
    out.append(f"limev {ev}")
    M = D9["motor"]
    for S in M["scenarios"]:
        r = motor_scenario(make, M, S["events"])
        out.append(f"motor {S['name']} final {r['final']} alarm {r['alarm']} Run {r['run']} lines {len(r['log'])}")
        out += ["    " + x for x in r["log"]]
    return out


def compare_lines(got, want):
    """First difference as text ('' = equal)."""
    for k, (g, w) in enumerate(zip(got, want)):
        if g != w:
            return f"line {k + 1}: got {g!r}, expected {w!r}"
    if len(got) != len(want):
        return f"{len(got)} lines, expected {len(want)}"
    return ""


def fuzz_compare(make_a, make_b, name, ticks=300, seed=1, cfg=None):
    """Random inputs (seeded) to two implementations; returns '' or the first difference."""
    a, b = make_a(name, cfg or {}), make_b(name, cfg or {})
    cls = FBS[name]
    R = random.Random(seed)
    names = list(cls.IN)
    for k in range(ticks):
        for n in names:
            if R.random() < 0.15:
                d = cls.IN[n]
                if isinstance(d, bool):
                    v = R.random() < 0.5
                elif isinstance(d, int):
                    v = R.choice([0, 1, 2, 3, 4, 5, 6, 8, 9, 11, 15, 17, 18]) if n != "iValue" else R.randint(-8000, 32767)
                elif n == "rValue":
                    v = round(R.uniform(1.0, 10.0), 2)
                else:
                    v = round(R.uniform(40, 70), 1)
                a.set(n, v)
                b.set(n, v)
        a.call()
        b.call()
        oa, ob = a.outputs(), b.outputs()
        if oa != ob:
            return f"tick {k}: {oa} != {ob}"
    return ""


# ----------------------------------------------------------------------------- output
def interface_rows(name):
    cls = FBS[name]
    rows = [["IN", n, ptype(v), fmt(v)] for n, v in cls.IN.items()]
    rows += [["CFG", n, ptype(v), fmt(v)] for n, v in cls.CFG.items()]
    proto = cls()
    rows += [["OUT", n, ptype(v), fmt(v)] for n, v in proto.o.items()]
    return rows


def st_title(name):
    """Title from line 2 of the .st header ('  FB_x  -  title')."""
    import re
    p = PLC_LIB / (name + ".st")
    if p.is_file():
        m = re.search(r"^  " + re.escape(name) + r"  -  (.+)$", p.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1).strip()
    return "see rule " + name


def ptype(v):
    return "BOOL" if isinstance(v, bool) else ("INT/DINT" if isinstance(v, int) else "REAL")


def text_interface(name):
    cls, kind, alarms = LIBRARY[name]
    out = [f"{name} ({kind}{', = ' + WRAPPER_BASE[name] if name in WRAPPER_BASE else ''}) - {st_title(name)}",
           f"  ST source: tools/fmse/plc_lib/{name}.st"
           f"{'' if (PLC_LIB / (name + '.st')).is_file() else ' (MISSING)'}",
           fmt_table(["dir", "name", "type", "default"], interface_rows(name), "llll")]
    out.append("  alarms (iAlarm, AlarmNo = M*1000 + 10*i + a): " +
               ("; ".join(f"{a} {t}" for a, t in alarms.items()) or "none"))
    return "\n".join(out)


def list_rows(D):
    ntest = {}
    for t in D["fb_tests"]:
        ntest[t["fb"]] = ntest.get(t["fb"], 0) + 1
    for k in ("FB_MotorDol", "FB_AnalogIn", "FB_LimitAlarm"):
        ntest[k] = {"FB_MotorDol": 5, "FB_AnalogIn": 1, "FB_LimitAlarm": 1}[k]
    ntest["FB_AlarmMgr"] = 1
    rows = []
    for name, (cls, kind, alarms) in LIBRARY.items():
        p = cls()
        rows.append([name, kind, len(cls.IN), len(cls.CFG), len(p.o), len(alarms), ntest.get(name, 0),
                     "yes" if (PLC_LIB / (name + ".st")).is_file() else "MISSING"])
    return rows


def md_report(text_lines, D):
    L = ["# Device FB library (item 10A) - Python reference run", "",
         f"Library version {LIB_VERSION}. All values are examples.", "",
         "| FB | kind | in | cfg | out | alarms | tests | .st |", "|---|---|---:|---:|---:|---:|---:|---|"]
    L += ["| " + " | ".join(str(x) for x in r) + " |" for r in list_rows(D)]
    L += ["", "```"] + text_lines + ["```", ""]
    return "\n".join(L)


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("fb_library")
    D = load10a(path)
    ref = REF_10A.splitlines()
    tests, logs, al, mx, lines = run_10a(make_py, allowed, D)
    t.equal("19 FB tests in the JSON", len(D["fb_tests"]), 19)
    t.equal("complete item-10A output = reference (203 lines)", compare_lines(lines, ref), "")
    # per test: every log line
    pos = 0
    for tt, L in zip(tests, logs):
        head = f"TEST {tt['fb']} | {tt['name']} | {len(L)} lines"
        k = ref.index(head) if head in ref else -1
        want = []
        if k >= 0:
            j = k + 1
            while j < len(ref) and ref[j].startswith("    "):
                want.append(ref[j][4:])
                j += 1
        t.equal(f"{tt['fb']} {tt['name'].split()[0]}: {len(L)} log lines = reference", L, want)
        pos += 1
    ka = ref.index("ALARM MANAGER")
    t.equal("alarm manager: 10 lines = reference", al, [x[4:] for x in ref[ka + 1:ka + 11]])
    km = ka + 11
    t.equal("command matrix (Production): 17 rows = reference", [f"{s} {c}" for s, c in mx],
            [x[4:] for x in ref[km + 1:km + 18]])
    # item 9 through the Python classes
    D9 = device_fb.load9()
    t.equal("item 9: FB_AnalogIn / limit / FB_MotorDol lines = reference (89 lines)",
            compare_lines(item9_lines(make_py, D9), REF_9_DEVICE.splitlines()), "")
    for S in D9["motor"]["scenarios"]:
        r1 = motor_scenario(make_py, D9["motor"], S["events"])
        r2 = device_fb.motor_run(D9["motor"], S["events"])
        t.equal(f"motor {S['name'].split()[0]}: class MotorDol + plant = device_fb.motor_run",
                (r1["log"], r1["final"], r1["alarm"], r1["run"]), (r2["log"], r2["final"], r2["alarm"], r2["run"]))
    # decisions / rules
    t.equal("D2: APC01 Rotate (i 1) alarm 1 -> AlarmNo 2011", al[2].split()[2], "2011")
    t.true("D3: class A beats an earlier class B (25 on 2011 -> Abort)", al[2].endswith("reaction=Abort"))
    t.equal("D1: Maintenance has no Suspend in Execute", [c for c in CMDS if allowed(CMDS[c], 6, 2)],
            ["Stop", "Hold", "Abort"])
    t.equal("D1: Manual in Execute: Stop, Abort only", [c for c in CMDS if allowed(CMDS[c], 6, 3)], ["Stop", "Abort"])
    t.true("D1: unknown command / state / mode rejected", not allowed(10, 4, 1) and not allowed(2, 18, 1)
           and not allowed(2, 4, 4))
    # wrappers = base FB
    E1 = next(x for x in D["fb_tests"] if x["fb"] == "FB_Safe2Ch")
    base = run_test(make_py, E1)
    for w, (a, b) in (("FB_Estop", ("xOk", "xOk2")), ("FB_Door2Ch", ("xClosed", "xClosed2")),
                      ("FB_EnableSwitch", ("xOk", "xOk2")), ("FB_LightCurtain", ("xOssd1", "xOssd2"))):
        t.equal(f"{w} = FB_Safe2Ch (test E1 with renamed inputs, xOk -> xSafe)",
                run_test(make_py, rename_test(E1, w, {"xCh1": a, "xCh2": b})),
                [lc_line(x) if w == "FB_LightCurtain" else x.replace("xOk=", "xSafe=") for x in base])
    Z1 = next(x for x in D["fb_tests"] if x["fb"] == "FB_Edm")
    zb = run_test(make_py, Z1)
    t.equal("FB_ZoneOut = FB_Edm (test Z1)", run_test(make_py, rename_test(Z1, "FB_ZoneOut", {})), zb)
    t.equal("FB_ContactorPair = FB_Edm (test Z1, xFb -> xEDM)",
            run_test(make_py, rename_test(Z1, "FB_ContactorPair", {"xFb": "xEDM"})), zb)
    for name in FBS:
        if name in ("FB_AlarmMgr",):
            continue
        t.equal(f"{name}: deterministic (same random inputs twice give the same outputs)",
                fuzz_compare(make_py, make_py, name, ticks=150, seed=7), "")
    try:
        make_py("FB_Nope")
        t.true("unknown FB -> InputError", False)
    except InputError:
        t.true("unknown FB -> InputError", True)
    try:
        make_py("FB_Valve1").set("xNope", True)
        t.true("unknown input -> InputError", False)
    except InputError:
        t.true("unknown input -> InputError", True)
    return t.finish()


def rename_test(t, fb, ren):
    ev = [[e[0]] + [(ren.get(s.split("=")[0], s.split("=")[0]) + "=" + s.split("=")[1]) for s in e[1:]]
          for e in t["events"]]
    return {"fb": fb, "name": t["name"], "K": t["K"], "cfg": t.get("cfg") or {}, "events": ev}


def lc_line(x):
    """FB_LightCurtain log line from an FB_Safe2Ch line: xOk -> xSafe, init gets xWarnOut=0 after xSafe."""
    x = x.replace("xOk=", "xSafe=")
    if " init " in x:
        x = x.replace("xSafe=0 ", "xSafe=0 xWarnOut=0 ")
    return x


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM10A_EXAMPLES), help="item-10A JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="= --test all (default)")
    ap.add_argument("--test", help="FB name, test id (S1, V3 ...) or all")
    ap.add_argument("--list", action="store_true", help="table of all library FBs")
    ap.add_argument("--interface", help="interface + alarm texts of one FB, e.g. FB_Valve2")
    ap.add_argument("--alarms", action="store_true", help="alarm manager log")
    ap.add_argument("--cmdmatrix", action="store_true", help="accepted commands per PackML state")
    ap.add_argument("--mode", type=int, default=1, help="mode for --cmdmatrix: 1 Production, 2 Maintenance, 3 Manual")
    ap.add_argument("--item9", action="store_true", help="FB_AnalogIn, limit alarm, FB_MotorDol A..E")
    ap.add_argument("--md", help="write a Markdown report")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    D = load10a(a.examples)
    if a.interface:
        name = a.interface if a.interface.startswith("FB_") else "FB_" + a.interface
        if name not in LIBRARY:
            raise InputError(f"unknown FB '{a.interface}' ({', '.join(LIBRARY)})")
        if a.json:
            print(json.dumps({"fb": name, "kind": LIBRARY[name][1], "interface": interface_rows(name),
                              "alarms": LIBRARY[name][2]}, indent=1))
        else:
            print(text_interface(name))
        return 0
    if a.list:
        rows = list_rows(D)
        if a.json:
            print(json.dumps([dict(zip(["fb", "kind", "in", "cfg", "out", "alarms", "tests", "st"], r)) for r in rows],
                             indent=1))
        else:
            print(f"DEVICE FB LIBRARY item 10A, version {LIB_VERSION} ({len(rows)} FBs + function F_CmdAllowed)")
            print(fmt_table(["FB", "kind", "in", "cfg", "out", "alarms", "tests", ".st file"], rows, "llrrrrrl"))
        return 0
    if a.alarms or a.cmdmatrix:
        out = []
        if a.alarms:
            out += ["ALARM MANAGER"] + ["    " + x for x in alarm_log(make_py, D["alarm_manager"])]
        if a.cmdmatrix:
            if a.mode not in MODES:
                raise InputError("--mode must be 1, 2 or 3")
            out += text_10a([], [], None, cmd_matrix(allowed, a.mode), a.mode)
        if a.json:
            print(json.dumps(out, indent=1))
        else:
            print("\n".join(out))
        return 0
    if a.item9:
        out = item9_lines(make_py, device_fb.load9())
        print(json.dumps(out, indent=1) if a.json else "\n".join(out))
        return 0
    sel = None if (not a.test or a.test.upper() == "ALL") else a.test
    tests, logs, al, mx, lines = run_10a(make_py, allowed, D, sel)
    if not tests:
        raise InputError(f"no test matches '{a.test}' (FB name, test id like V3, or all)")
    if a.md:
        Path(a.md).write_text(md_report(lines, D), encoding="utf-8")
    if a.json:
        print(json.dumps({"tests": [{"fb": t["fb"], "name": t["name"], "log": L} for t, L in zip(tests, logs)],
                          "alarm_manager": al, "cmd_matrix": mx}, indent=1))
        return 0
    print("\n".join(lines))
    if a.md:
        print(f"\nMarkdown written: {a.md}")
    return 0


if __name__ == "__main__":
    run_main(main)
