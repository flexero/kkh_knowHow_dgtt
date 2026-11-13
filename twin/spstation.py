"""
SpindleStation - the LIVE digital twin of the motor-spindle assembly station ASSY-SP1 (clean room).

Contract: docs/20_contract_spst.md.  Guide: docs/20_spindle_station_live_twin.md.

What it does
  * keeps the state of the real station: work orders, the spindle in work (serial SPU-YYWW-nnnnn),
    the current step of the 21 assembly steps (same keys as web/asmsp.js), every measured value,
    signatures, NCRs, alarms and an audit trail - in its own SQLite file (WAL)
  * step engine with REAL interlocks (login, start, required checks, limits, NCR, inspector sign-off)
  * device layer: values arrive from gateways (HTTP ingest), Modbus TCP (twin/spdevices.py),
    MQTT 3.1.1 (twin/spdevices.py) or from the built-in simulator; they are mapped to the checks
  * live run-in program (speed profile, stop rules, thermal model when RUN-01 is simulated)
  * SPC, KPIs, CSV export
All limits and example values follow web/asmsp.js simulate() - they are EXAMPLES (check with your
drawings, catalogues and supplier manuals).  Python standard library only.
"""

from __future__ import annotations

import csv
import datetime as _dt
import io
import json
import math
import os
import random
import sqlite3
import statistics
import threading
import time
from collections import deque

from .spdevices import MODBUS_MAP, MODBUS_SIM_UNITS, ModbusPoller, MqttBridge

STATION = "ASSY-SP1"
TICK = 0.5                 # s real time
OFFLINE_S = 10.0           # device offline when no data for 10 s (not for sim devices)
RUNIN_SAMPLE_S = 5.0       # one run-in sample every 5 s process time
RUNIN_ACCEL = 5.0          # run-in process time = real time x sim.speed x 5 (only when the simulator is on)
INSPECTOR_STEPS = ("balance", "clamp", "runin", "test")
ROLES = ("operator", "inspector", "admin")
FAULTS = ("mix", "spacer", "dirt", "grease", "nut", "rotor", "spring", "oring")


# ----------------------------------------------------------------------------------------------- design (spindle.js)
def _design():
    """Example design values of web/spindle.js (SP_DEF + spCalc + packCalc of asmsp.js)."""
    # HMC motor spindle - decided 2026-11-12: 10 000 rpm / 18 kW S1 (115 N·m S1, 22 kW / 140 N·m S6-40 %,
    # base speed 1 500 rpm) - example values, the spindle maker's datasheet decides
    M = dict(nmax=10000, P_S1=18.0, P_S6=22.0, T_S1=115.0, T_S6=140.0, nBase=1500, Fclamp=18.0, iClamp=3.0, dF=70, DF=110, BF=20, dR=60, DR=95, BR=18, Fpre=400.0, cax=160.0,
             dRot=65, mRot=16.0, Gbal=1.0, dRotI=0.06, dT=15.0, Qw=4.0, Ploss=1.6)
    D = dict(M)
    D["Uper"] = 9549 * M["Gbal"] * M["mRot"] / M["nmax"]                       # g.mm  ISO 21940-11
    D["UperPlane"] = D["Uper"] / 2
    D["Trot"] = 20 + (M["dRotI"] + 0.0015 * M["dRot"]) / (11.5e-6 * M["dRot"])   # rotor mounting temperature
    D["dLnose_um"] = 11.5e-6 * 25 * M["dT"] * 1000                              # nose growth (segment x0 = 25 mm)
    vF = 0.15 * math.pi / 4 * (M["DF"] ** 2 - M["dF"] ** 2) * M["BF"] / 1000
    vR = 0.15 * math.pi / 4 * (M["DR"] ** 2 - M["dR"] ** 2) * M["BR"] / 1000
    D["gF"], D["gR"] = 0.15 * vF * 0.9, 0.15 * vR * 0.9                          # g grease per bearing
    D["dTh"] = 0.02 / (11.5e-6 * M["DF"])                                       # K housing heating
    # disc-spring pack (Almen-Laszlo, A 40 x 20.4 x 2.25, h0 0.9, 2 in parallel, stroke 6, p 6 MPa, rod 30)
    S = dict(De=40, Di=20.4, t=2.25, h0=0.9, np=2, stroke=6, p=6, dRod=30)

    def almen(s):
        d = S["De"] / S["Di"]
        K1 = (1 / math.pi) * ((d - 1) / d) ** 2 / ((d + 1) / (d - 1) - 2 / math.log(d))
        return 4 * 206000 / (1 - 0.09) * S["t"] ** 4 / (K1 * S["De"] ** 2) * (s / S["t"]) * \
            ((S["h0"] / S["t"] - s / S["t"]) * (S["h0"] / S["t"] - s / (2 * S["t"])) + 1)
    Fspring = M["Fclamp"] * 1000 / M["iClamp"] * 1.15
    a, b = 0.0, S["h0"]
    for _ in range(50):
        m = (a + b) / 2
        a, b = (m, b) if almen(m) < Fspring / S["np"] else (a, m)
    sc = (a + b) / 2
    ns = math.ceil(S["stroke"] / max(0.01, 0.75 * S["h0"] - sc))
    Fu = S["np"] * almen(sc + S["stroke"] / ns)
    Dp = math.sqrt(4 * (1.1 * Fu / S["p"]) / math.pi + S["dRod"] ** 2)
    D.update(Fspring=Fspring, pk_ns=ns, pk_n=ns * S["np"], pk_L0=ns * (S["h0"] + S["np"] * S["t"]),
             pk_Fc=S["np"] * almen(sc), pk_Dp=Dp, stroke=S["stroke"], p_supply=S["p"])
    D["p_rel"] = D["pk_Fc"] / (math.pi / 4 * (Dp ** 2 - S["dRod"] ** 2))       # MPa where the drawbar moves
    return D


DES = _design()
NMAX = DES["nmax"]


# ----------------------------------------------------------------------------------------------- checks + steps
def C(cid, n, unit="", lo=None, hi=None, kind="num", dev=None, key=None, req=True, note="", **kw):
    """One check. dev+key = which device value fills it.  wlo/whi = warn band outside lo/hi,
    soft = out of limits gives only 'warn' (as asmsp.js), calc = calculated by the station from other
    results, auto = filled by the run-in program, scale = device value x scale, pre = text must start
    with, eq = text must equal the unit serial."""
    d = dict(id=cid, n=n, unit=unit, lo=lo, hi=hi, kind=kind, dev=dev, key=key, req=req, note=note)
    d.update(kw)
    return d


def _r(v, n=3):
    return round(v, n)


_g5 = lambda g: (_r(g * 0.95, 2), _r(g * 1.05, 2))      # noqa: E731
_GF, _GR = _g5(DES["gF"]), _g5(DES["gR"])

STEPS = [
    ("kit", "Kit + traceability", "Prepare", 30, [
        C("kit.shaft_sn", "Shaft serial (laser, tail face)", kind="text", dev="SCN-01", key="code", pre="SPS-"),
        C("kit.set_front", "Front set 4 x 7014 - same set number, V-line continuous", kind="text", dev="SCN-01", key="code", pre="B-BRG-00041"),
        C("kit.set_rear", "Rear set 2 x 7012", kind="text", dev="SCN-01", key="code", pre="B-BRG-00042"),
        C("kit.motor_kit", "Motor kit rotor + stator (same kit number)", kind="text", dev="SCN-01", key="code", pre="B-MOT-00004"),
        C("kit.open_ncr", "Open NCRs on the parts", "", 0, 0, note="must be 0")]),
    ("clean", "Clean room, wash, soak at 20 °C", "Prepare", 120, [
        C("clean.particles", "Particles ≥ 0.5 µm in the room", "/m³", None, 352000, dev="PC-01", key="p05_m3", note="ISO 14644-1 class 7 limit – check"),
        C("clean.room_t", "Room temperature", "°C", 19.0, 21.0, dev="TH-01", key="t_c", note="20 ±1"),
        C("clean.soak", "Soak time ≥ 12 h, parts covered", kind="bool"),
        C("clean.patch", "Filter patch shaft bore", "mg", None, 2.0, note="≤ 2 – example")]),
    ("meas", "Measure bearings, seats, bores (fits)", "Measure", 120, [
        C("meas.standout_1", "Stand-out deviation bearing 1", "µm", dev="BMS-01", key="standout_um", note="info – used for the spacer"),
        C("meas.standout_2", "Stand-out deviation bearing 2", "µm", dev="BMS-01", key="standout_um", note="info"),
        C("meas.standout_3", "Stand-out deviation bearing 3", "µm", dev="BMS-01", key="standout_um", note="info"),
        C("meas.standout_4", "Stand-out deviation bearing 4", "µm", dev="BMS-01", key="standout_um", note="info"),
        C("meas.bore_mean", "Bore deviation marks Δd (mean of 4)", "µm", dev="BMS-01", key="bore_um", note="info"),
        C("meas.fit_front", "Front fit shaft − bore (interference)", "µm", 0, 5, note="0 … +5 – check catalogue"),
        C("meas.clr_front", "Front housing bore − OD (clearance)", "µm", 2, 8, wlo=0, note="2 … 8 – check; 0 … 2 = warn"),
        C("meas.fit_rear", "Rear fit shaft − bore", "µm", 0, 5, note="0 … +5"),
        C("meas.clr_rear", "Floating sleeve − rear OD (clearance)", "µm", 5, 12, note="5 … 12 – check")]),
    ("spacer", "Grind spacers to the measured offset (preload)", "Measure", 90, [
        C("spacer.ds_req", "Required Lo − Li (Σ of the 2 tandem pairs)", "µm", calc=True, note="calc = (e1+e2)/2 + (e3+e4)/2"),
        C("spacer.ds_meas", "Ground spacers: Lo − Li measured", "µm", dev="CMP-01", key="len_um", note="0.1 µm comparator"),
        C("spacer.ds_err", "Spacer error measured − required", "µm", -1.0, 1.0, calc=True, note="±1 µm"),
        C("spacer.parallel", "Parallelism of the spacer faces", "µm", None, 1.0, note="≤ 1"),
        C("spacer.preload", "Preload expected per bearing", "N", calc=True, note=f"calc, target {DES['Fpre']:.0f} N – info")]),
    ("grease", "Grease the bearings (weighed quantity)", "Measure", 45, [
        C("grease.front", "Grease per front bearing (7014)", "g", _GF[0], _GF[1], dev="SCL-01", key="mass_g", soft=True, note=f"target {DES['gF']:.2f} g ±5 % – catalogue"),
        C("grease.rear", "Grease per rear bearing (7012)", "g", _GR[0], _GR[1], dev="SCL-01", key="mass_g", soft=True, note=f"target {DES['gR']:.2f} g ±5 %"),
        C("grease.spread", "Distributed both sides, turned by hand", kind="bool")]),
    ("front", "Heat + mount the front TBT set", "Shaft unit", 75, [
        C("front.ring_temp", "Inner ring temperature at mounting", "°C", 60, 80, wlo=40, whi=110, dev="IH-01", key="temp_c", note="60–80, never > 110"),
        C("front.vline", "V-line on the outer rings continuous, points to the nose", kind="bool"),
        C("front.seated", "Seated after cooling (axial press, no movement)", kind="bool")]),
    ("nut", "Front lock nut: torque + runout correction", "Shaft unit", 60, [
        C("nut.torque", "Nut final torque M70×1.5", "N·m", 118.8, 131.2, dev="TQ-01", key="torque_nm", note="≈ 125 ±5 % – example, nut catalogue"),
        C("nut.runout_before", "Nut face runout before correction", "µm", dev="IND-01", key="runout_um", note="info"),
        C("nut.runout_after", "Nut face runout after correction", "µm", None, 2.0, dev="IND-01", key="runout_um", note="≤ 2"),
        C("nut.friction", "Friction torque of the front set (preload check)", "N·m", 0.35, 0.70, note="0.35–0.70 – example")]),
    ("fbh", "Front bearing housing over the front set", "Shaft unit", 45, [
        C("fbh.heat_dk", "Bearing housing heated (above room)", "K", note=f"info – bore grows {11.5e-6 * 110 * 20 * 1000:.0f} µm at +20 K"),
        C("fbh.axial_play", "Outer rings seated, axial play", "µm", None, 1.0, dev="IND-01", key="runout_um", note="≤ 1, probe reading")]),
    ("rotor", "Rotor sleeve shrink fit", "Shaft unit", 60, [
        C("rotor.interf", "Rotor interference seat − bore", "mm", _r(DES["dRotI"] - 0.015), _r(DES["dRotI"] + 0.015), soft=True, note="design 0.060 ±0.015"),
        C("rotor.temp", "Rotor temperature at mounting", "°C", None, 250, dev="OV-01", key="temp_c", note=f"calc. {DES['Trot']:.0f} °C – check magnet limit"),
        C("rotor.gap", "Rotor against the shoulder (gap)", "mm", None, 0.05, note="≤ 0.05")]),
    ("rear", "Rear bearings (DB) + rear nut", "Shaft unit", 60, [
        C("rear.torque", "Rear nut final torque M60×1.5", "N·m", 69.4, 76.6, dev="TQ-01", key="torque_nm", note="≈ 73 ±5 % – example"),
        C("rear.runout", "Rear nut face runout after correction", "µm", None, 2.0, dev="IND-01", key="runout_um", note="≤ 2"),
        C("rear.tail_runout", "Tail / encoder seat runout", "µm", None, 3.0, dev="IND-01", key="runout_um", note="≤ 3"),
        C("rear.sleeve", "Floating sleeve slides by hand", kind="bool")]),
    ("draw", "Drawbar + disc-spring pack", "Shaft unit", 60, [
        C("draw.count", f"Number of springs ({DES['pk_ns']} groups × 2 in parallel)", "", DES["pk_n"], DES["pk_n"]),
        C("draw.L0", "Free pack length L0", "mm", _r(DES["pk_L0"] - 0.5, 1), _r(DES["pk_L0"] + 0.5, 1), soft=True, note=f"calc. {DES['pk_L0']:.1f} ±0.5"),
        C("draw.force", "Spring force at clamped length (tool J6)", "kN", _r(DES["Fspring"] * 0.97 / 1000, 2), None, dev="FG-01", key="force_kn", note=f"≥ 0.97 × {DES['Fspring'] / 1000:.2f} kN")]),
    ("balance", "Balance the rotor unit (2 planes)", "Balance", 90, [
        C("balance.u0_1", "Initial unbalance plane 1", "g·mm", dev="BAL-01", key="u1_gmm", note="info (1st BAL-01 reading)"),
        C("balance.u0_2", "Initial unbalance plane 2", "g·mm", dev="BAL-01", key="u2_gmm", note="info"),
        C("balance.ures_1", "Residual unbalance plane 1", "g·mm", None, _r(DES["UperPlane"], 2), dev="BAL-01", key="u1_gmm", note="≤ Uper/2 (2nd BAL-01 reading)"),
        C("balance.ures_2", "Residual unbalance plane 2", "g·mm", None, _r(DES["UperPlane"], 2), dev="BAL-01", key="u2_gmm", note="≤ Uper/2")]),
    ("stator", "Stator + cooling sleeve into the motor housing", "Housing", 90, [
        C("stator.p_drop", "Pressure test cooling jacket 1.5 × p, 15 min – drop", "bar", None, 0.1, dev="PRS-01", key="p_bar", note="≤ 0.1"),
        C("stator.r_ins", "Insulation resistance 500 V DC", "MΩ", 100, None, dev="INS-01", key="r_mohm", note="≥ 100 – example, check motor maker"),
        C("stator.r_bal", "Winding resistance balance U-V / V-W / W-U", "%", None, 2.0, note="≤ 2")]),
    ("insert", "Insert the shaft unit (vertical)", "Housing", 75, [
        C("insert.bolt_torque", "Front bearing housing 8 × M10 (10.9)", "N·m", 63.7, 70.3, dev="TQ-01", key="torque_nm", note="67 ±5 %, crosswise 3 stages"),
        C("insert.gap_1", "Air gap rotor ↔ stator, position 1", "mm", 0.9, 1.1, note="even ±0.1"),
        C("insert.gap_2", "Air gap position 2", "mm", 0.9, 1.1),
        C("insert.gap_3", "Air gap position 3", "mm", 0.9, 1.1),
        C("insert.gap_4", "Air gap position 4", "mm", 0.9, 1.1),
        C("insert.turn_torque", "Turning torque by hand", "N·m", None, 0.8, soft=True, note="even, no noise")]),
    ("cover", "Front cover (labyrinth) + rear sleeve + cover", "Housing", 60, [
        C("cover.torque", "Front cover 6 × M6 (8.8)", "N·m", 9.0, 10.0, dev="TQ-01", key="torque_nm", note="9.5 N·m crosswise"),
        C("cover.lab_1", "Labyrinth gap position 1", "mm", 0.20, 0.30, note="0.20–0.30"),
        C("cover.lab_2", "Labyrinth gap position 2", "mm", 0.20, 0.30),
        C("cover.lab_3", "Labyrinth gap position 3", "mm", 0.20, 0.30),
        C("cover.lab_4", "Labyrinth gap position 4", "mm", 0.20, 0.30),
        C("cover.air", "Sealing air at the labyrinth even all round", kind="bool"),
        C("cover.sleeve_force", "Floating sleeve axial movement force", "N", None, 150, note="≤ 150 – example")]),
    ("unclamp", "Unclamp cylinder + stroke setting", "Clamping", 60, [
        C("unclamp.p_rel", "Pressure where the drawbar starts to move", "MPa", None, 5.99, dev="PRS-01", key="p_bar", scale=0.1,
          note=f"calc. {DES['p_rel']:.2f} MPa; must be < supply {DES['p_supply']} MPa (PRS-01 sends bar × 0.1)"),
        C("unclamp.stroke", "Drawbar stroke clamped → unclamped", "mm", DES["stroke"] - 0.2, DES["stroke"] + 0.2, note="6 ±0.2"),
        C("unclamp.eject", "Tool ejection at the nose", "mm", 0.4, 0.6, note="0.4–0.6 – check clamping set")]),
    ("clamp", "Clamping-force test (HSK gauge)", "Clamping", 45, [
        C("clamp.f_1", "Clamping force reading 1", "kN", dev="HSK-01", key="force_kn", note="info – the mean is judged"),
        C("clamp.f_2", "Clamping force reading 2", "kN", dev="HSK-01", key="force_kn", note="info"),
        C("clamp.f_3", "Clamping force reading 3", "kN", dev="HSK-01", key="force_kn", note="info"),
        C("clamp.f_mean", "Clamping force mean of 3", "kN", _r(DES["Fclamp"] * 0.9, 1), _r(DES["Fclamp"] * 1.15, 1), calc=True, note="0.9 … 1.15 × 18 kN"),
        C("clamp.sensor", "Clamp sensor: unclamped / with tool / without tool switch correctly", kind="bool"),
        C("clamp.eject", "Tool ejected at unclamp", kind="bool")]),
    ("sensors", "Sensors + electrical test", "Clamping", 60, [
        C("sensors.pt_front", "PT100 front bearings at 20 °C", "°C", 18, 22, note="plausible"),
        C("sensors.pt_stator", "PT100 / KTY stator at 20 °C", "°C", 18, 22, note="plausible"),
        C("sensors.enc_a", "Encoder amplitude A", "Vpp", 0.8, 1.2, note="0.8–1.2 – check"),
        C("sensors.enc_b", "Encoder amplitude B", "Vpp", 0.8, 1.2),
        C("sensors.labelled", "Cables labelled + fixed", kind="bool")]),
    ("runin", "Run-in program (grease distribution)", "Test", 300, [
        C("runin.dT_max", "Max. temperature rise front bearings", "K", None, 25.0, whi=27.0, dev="RUN-01", auto="runin", note="stop limit 25 K"),
        C("runin.stops", "Stops (temperature)", "", 0, 0, whi=2, dev="RUN-01", auto="runin", note="0 = ok, 1–2 = warn, > 2 = bad"),
        C("runin.time_h", "Run-in time", "h", dev="RUN-01", auto="runin", note="info"),
        C("runin.dT_end", "Stable rise at nmax", "K", None, 20.0, dev="RUN-01", auto="runin", note="≤ 20"),
        C("runin.vib_end", "Vibration at the end of the run-in", "mm/s", None, 1.0, whi=1.5, dev="RUN-01", auto="runin", note="≤ 1.0, 1.0–1.5 warn – example"),
        C("runin.noise", "Noise during run-in smooth (no rumbling)", kind="bool")]),
    ("test", "Final test: runout, stiffness, thermal growth, vibration", "Test", 180, [
        C("test.runout_taper", "Taper runout (near the nose)", "µm", None, 2.0, dev="PRB-01", key="runout_um", note="≤ 2 – example, check ISO 10791-1 / contract"),
        C("test.runout_300", "Runout at 300 mm (test mandrel)", "µm", None, 5.0, dev="PRB-01", key="runout_um", note="≤ 5 – example (2nd PRB-01 reading)"),
        C("test.k_ax", "Axial stiffness", "N/µm", _r(0.85 * DES["cax"], 0), None, note="≥ 0.85 × design"),
        C("test.k_rad", "Radial stiffness at the nose", "N/µm", 170, None, note="≥ 170 – example design value"),
        C("test.growth", "Thermal growth at the nose, 60 min nmax", "µm", None, 15.0, dev="PRB-01", key="axial_um", note="≤ 15 – example"),
        C("test.vib", "Vibration velocity at nmax", "mm/s", None, 1.0, dev="RUN-01", key="vib_mm_s", note="≤ 1.0 RMS – example"),
        C("test.u_shift", "Unbalance change after run-in", "g·mm", None, _r(DES["UperPlane"], 2), note="≤ Uper/2"),
        C("test.noise", "Noise at 1 m", "dB(A)", None, 75, note="≤ 75 – example"),
        C("test.clamp", "Clamping force re-check", "kN", _r(DES["Fclamp"] * 0.9, 1), None, dev="HSK-01", key="force_kn", note="≥ 0.9 × 18 kN")]),
    ("pack", "Record, transport lock, packing", "Test", 45, [
        C("pack.plate", "Type plate scanned = unit serial", kind="text", dev="SCN-01", key="code", eq="sn"),
        C("pack.record", "Assembly record complete, signed", kind="bool"),
        C("pack.lock", "Transport lock + preservation fitted", kind="bool")]),
]
STEP_KEYS = [s[0] for s in STEPS]
CHECKS = {c["id"]: (i, c) for i, s in enumerate(STEPS) for c in s[4]}
CALC_INPUTS = {"spacer.ds_req": ["meas.standout_1", "meas.standout_2", "meas.standout_3", "meas.standout_4"],
               "spacer.ds_err": ["spacer.ds_meas", "spacer.ds_req"],
               "spacer.preload": ["spacer.ds_meas", "spacer.ds_req"],
               "clamp.f_mean": ["clamp.f_1", "clamp.f_2", "clamp.f_3"]}
# rework of these checks repairs the simulated fault for this unit (the operator really fixed the cause)
FAULT_OF = {"front.vline": "mix", "spacer.ds_err": "spacer", "spacer.ds_meas": "spacer", "nut.runout_after": "nut",
            "draw.force": "spring", "draw.L0": "spring", "stator.p_drop": "oring", "grease.front": "grease",
            "grease.rear": "grease", "rotor.interf": "rotor", "clamp.f_mean": "spring"}

DEVICES = [  # id, name, type, values
    ("SCN-01", "Barcode / DMC scanner", "scanner", ["code"]),
    ("PC-01", "Particle counter", "particles", ["p05_m3"]),
    ("TH-01", "Room thermometer", "temperature", ["t_c"]),
    ("BMS-01", "Bearing measuring stand", "bearing_stand", ["standout_um", "bore_um"]),
    ("CMP-01", "Length comparator 0.1 µm", "comparator", ["len_um"]),
    ("SCL-01", "Precision scale", "scale", ["mass_g"]),
    ("IH-01", "Induction heater", "heater", ["temp_c", "state"]),
    ("OV-01", "Rotor oven", "oven", ["temp_c"]),
    ("TQ-01", "Torque wrench (wireless)", "torque", ["torque_nm", "angle_deg"]),
    ("IND-01", "Electronic indicator / probe", "probe", ["runout_um"]),
    ("FG-01", "Force gauge (press / spring tool)", "force", ["force_kn"]),
    ("BAL-01", "Balancing machine", "balancing", ["u1_gmm", "a1_deg", "u2_gmm", "a2_deg"]),
    ("PRS-01", "Pressure gauge (jacket test, unclamp)", "pressure", ["p_bar"]),
    ("HSK-01", "HSK clamping-force gauge", "clamp_force", ["force_kn"]),
    ("INS-01", "Insulation / winding tester", "insulation", ["r_mohm"]),
    ("RUN-01", "Run-in stand PLC", "runin_plc", ["rpm", "t_front_c", "t_rear_c", "t_stator_c", "t_win_c", "t_wout_c", "vib_mm_s", "flow_lpm"]),
    ("PRB-01", "Capacitive probes (final test)", "probes", ["runout_um", "axial_um"]),
]
DEV_IDS = [d[0] for d in DEVICES]

# run-in profile: [rpm, minimum dwell in minutes] (example - bearing / grease maker gives the real program)
RUNIN_PROFILE = [[1250, 10], [2500, 10], [3750, 10], [5000, 10], [6250, 15], [7500, 15], [8750, 15], [10000, 30]]
RUNIN_MAX_DWELL_MIN = 60
RL = dict(stop=25.0, resume=12.0, hold_dT=20.0, hold_rate=1.0, stable_rate=0.06, vib_stop=1.8, flow_min=2.0, dTw_max=8.0)
RUNIN_RULES = [
    ("stop", f"front bearing ΔT ≥ {RL['stop']:.0f} K → stop, cool to {RL['resume']:.0f} K, repeat this speed step"),
    ("hold_dT", f"front bearing ΔT > {RL['hold_dT']:.0f} K → hold this speed (no step up)"),
    ("hold_rate", f"ΔT rise rate > {RL['hold_rate']:.1f} K/min → hold this speed"),
    ("vib", f"vibration > {RL['vib_stop']:.1f} mm/s → stop + alarm (run-in aborted)"),
    ("cool", f"cooling water flow < {RL['flow_min']:.0f} l/min or water out − in > {RL['dTw_max']:.0f} K → stop + alarm"),
]


def yyww(t=None):
    d = _dt.date.fromtimestamp(t or time.time()).isocalendar()
    return f"{d[0] % 100:02d}{d[1]:02d}"


def judge(c, v, unit=None):
    """-> 'ok' | 'warn' | 'bad'"""
    k = c["kind"]
    if k == "text":
        s = str(v or "").strip()
        if not s:
            return "bad"
        if c.get("pre") and not s.startswith(c["pre"]):
            return "bad"
        if c.get("eq") == "sn" and unit and s != unit["sn"]:
            return "bad"
        if c["id"] == "kit.shaft_sn" and unit and unit.get("shaft_sn_given") and s != unit["shaft_sn"]:
            return "bad"
        return "ok"
    if k == "bool":
        return "ok" if v is True else "bad"
    lo, hi = c.get("lo"), c.get("hi")
    if (lo is None or v >= lo) and (hi is None or v <= hi):
        return "ok"
    if c.get("soft"):
        return "warn"
    if lo is not None and v < lo and c.get("wlo") is not None and v >= c["wlo"]:
        return "warn"
    if hi is not None and v > hi and c.get("whi") is not None and v <= c["whi"]:
        return "warn"
    return "bad"


def to_value(c, v):
    k = c["kind"]
    if k == "num":
        if isinstance(v, bool):
            raise ValueError(f"{c['id']}: number expected")
        try:
            x = float(v)
        except (TypeError, ValueError):
            raise ValueError(f"{c['id']}: number expected, got {v!r}")
        if math.isnan(x) or math.isinf(x):
            raise ValueError(f"{c['id']}: invalid number")
        return x
    if k == "bool":
        if isinstance(v, str):
            s = v.strip().lower()
            if s in ("1", "true", "yes", "ok", "y", "ja"):
                return True
            if s in ("0", "false", "no", "nok", "n", "nein"):
                return False
            raise ValueError(f"{c['id']}: yes/no expected")
        return bool(v)
    return str(v).strip()


# ----------------------------------------------------------------------------------------------- station
class SpindleStation:
    def __init__(self, db_path: str):
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        self.db_path = db_path
        self.lock = threading.RLock()
        self.db = sqlite3.connect(db_path, check_same_thread=False, timeout=10)
        self._schema()
        self.rng = random.Random()
        self.sim = {"on": True, "auto": False, "speed": 1, "faults": []}
        self.user = None
        self.unit = None
        self.events = deque(maxlen=60)
        self.alarms = deque(maxlen=60)
        self.sched = []                      # simulated device messages [(due, dev, values)]
        self.auto = {"next": 0.0, "plan": {}, "t0": 0.0, "dur": 1.0, "wait": None}
        self.outbox = {}                     # device -> {set-point name: value} (closed loop to the PLC)
        self.devices = {}
        self._dev_log_t = {}
        self._dev_err_t = {}
        self._kpi_cache = (0.0, None)
        self._stop = threading.Event()
        self._thread = None
        self.runin = None
        self._samples = []
        with self.lock:
            self._load()

    # ------------------------------------------------------------------------------- db
    def _schema(self):
        c = self.db
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript("""
        CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
        CREATE TABLE IF NOT EXISTS workorders(wo TEXT PRIMARY KEY, qty INTEGER, done INTEGER, due REAL,
            status TEXT, created REAL);
        CREATE TABLE IF NOT EXISTS units(sn TEXT PRIMARY KEY, wo TEXT, shaft_sn TEXT, status TEXT, si INTEGER,
            step_state TEXT, started REAL, finished REAL, data TEXT);
        CREATE TABLE IF NOT EXISTS results(id INTEGER PRIMARY KEY AUTOINCREMENT, sn TEXT, check_id TEXT, step TEXT,
            v TEXT, st TEXT, src TEXT, user TEXT, t REAL, superseded INTEGER DEFAULT 0);
        CREATE INDEX IF NOT EXISTS ix_results ON results(sn, check_id);
        CREATE INDEX IF NOT EXISTS ix_results_c ON results(check_id, superseded);
        CREATE TABLE IF NOT EXISTS signatures(id INTEGER PRIMARY KEY AUTOINCREMENT, sn TEXT, si INTEGER, step TEXT,
            user TEXT, role TEXT, t REAL);
        CREATE TABLE IF NOT EXISTS ncr(id TEXT PRIMARY KEY, sn TEXT, check_id TEXT, decision TEXT, text TEXT,
            user TEXT, role TEXT, t REAL, closed INTEGER DEFAULT 0, closed_t REAL);
        CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, t REAL, sn TEXT, user TEXT, text TEXT);
        CREATE TABLE IF NOT EXISTS device_log(id INTEGER PRIMARY KEY AUTOINCREMENT, t REAL, device TEXT, vals TEXT,
            src TEXT, sn TEXT, mapped TEXT);
        CREATE INDEX IF NOT EXISTS ix_devlog ON device_log(sn);
        CREATE TABLE IF NOT EXISTS runin_samples(sn TEXT, run INTEGER, t REAL, wall REAL, rpm REAL, tf REAL, tr REAL,
            ts REAL, win REAL, wout REAL, vib REAL);
        CREATE INDEX IF NOT EXISTS ix_runin ON runin_samples(sn, run);
        CREATE TABLE IF NOT EXISTS alarms(id INTEGER PRIMARY KEY AUTOINCREMENT, t REAL, sev TEXT, text TEXT,
            ack INTEGER DEFAULT 0, ack_user TEXT, ack_t REAL, sn TEXT);
        CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY, proto TEXT, addr TEXT, enabled INTEGER);
        """)
        c.commit()

    def _meta(self, k, default=None):
        r = self.db.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
        return json.loads(r[0]) if r else default

    def _set_meta(self, k, v):
        self.db.execute("INSERT OR REPLACE INTO meta VALUES(?,?)", (k, json.dumps(v)))

    def _next_seq(self, k):
        n = int(self._meta(k, 0)) + 1
        self._set_meta(k, n)
        return n

    def _load(self):
        now = time.time()
        sim = self._meta("sim")
        if isinstance(sim, dict):
            self.sim.update({k: sim[k] for k in ("on", "auto", "speed", "faults") if k in sim})
        self.user = self._meta("user")
        # devices
        for did, n, typ, vals in DEVICES:
            self.devices[did] = {"id": did, "n": n, "type": typ, "values": vals, "proto": "sim", "addr": "",
                                 "enabled": True, "last": {}, "seen": 0.0, "err": "", "online": False}
        for did, proto, addr, en in self.db.execute("SELECT id, proto, addr, enabled FROM devices"):
            if did in self.devices:
                self.devices[did].update(proto=proto, addr=addr or "", enabled=bool(en))
        # events + alarms (load BEFORE creating example work orders, or their events appear twice)
        for t, sn, user, text in self.db.execute("SELECT t, sn, user, text FROM events ORDER BY id DESC LIMIT 60").fetchall():
            self.events.appendleft({"t": t, "text": text, "user": user or "", "sn": sn or ""})
        # work orders: 3 examples at the first start
        if not self.db.execute("SELECT COUNT(*) FROM workorders").fetchone()[0]:
            for qty, days in ((2, 2), (1, 4), (3, 7)):
                self._create_wo(qty, now + days * 86400, "system")
        # last device values (kept across restarts)
        dl = self._meta("dev_last", {}) or {}
        for did, rec in dl.items():
            if did in self.devices and isinstance(rec, dict):
                self.devices[did]["last"] = rec.get("last", {}) or {}
                self.devices[did]["seen"] = float(rec.get("seen", 0.0) or 0.0)
        for aid, t, sev, text, ack, sn in self.db.execute(
                "SELECT id, t, sev, text, ack, sn FROM alarms ORDER BY id DESC LIMIT 60"):
            self.alarms.appendleft({"id": aid, "t": t, "sev": sev, "text": text, "ack": bool(ack), "sn": sn or ""})
        # open unit (survives restart)
        r = self.db.execute("SELECT sn FROM units WHERE status IN ('in_work','hold') ORDER BY started DESC LIMIT 1").fetchone()
        if r:
            self.unit = self._load_unit(r[0])
            self.unit["step_t0"] = now
            self._event(f"Station restarted – unit {self.unit['sn']} reloaded at step {self.unit['si'] + 1} "
                        f"({STEP_KEYS[self.unit['si']]}, {self.unit['step_state']})", "system")
            if self.unit["step_state"] in ("running", "wait_confirm"):
                self._schedule_step_devices(only_pending=True)
        else:   # no open unit: keep the last finished one visible (contract) until the next new_unit
            r = self.db.execute("SELECT sn FROM units ORDER BY started DESC LIMIT 1").fetchone()
            if r:
                self.unit = self._load_unit(r[0])
        self.db.commit()

    def _load_unit(self, sn):
        r = self.db.execute("SELECT sn, wo, shaft_sn, status, si, step_state, started, finished, data FROM units WHERE sn=?",
                            (sn,)).fetchone()
        if not r:
            return None
        data = json.loads(r[8] or "{}")
        u = {"sn": r[0], "wo": r[1], "shaft_sn": r[2], "status": r[3], "si": r[4], "step_state": r[5],
             "started": r[6], "finished": r[7], "results": {}, "signed": [], "ncr": [],
             "ctx": data.get("ctx", {}), "shaft_sn_given": data.get("shaft_sn_given", False), "step_t0": time.time()}
        for cid, v, st, src, user, t in self.db.execute(
                "SELECT check_id, v, st, src, user, t FROM results WHERE sn=? AND superseded=0 ORDER BY id", (sn,)):
            u["results"][cid] = {"v": json.loads(v), "st": st, "src": src, "t": t, "user": user}
        for si, user, t in self.db.execute("SELECT si, user, t FROM signatures WHERE sn=? ORDER BY id", (sn,)):
            u["signed"].append({"si": si, "user": user, "t": t})
        for nid, cid, dec, text, user, t, closed in self.db.execute(
                "SELECT id, check_id, decision, text, user, t, closed FROM ncr WHERE sn=? ORDER BY t", (sn,)):
            u["ncr"].append({"id": nid, "check": cid, "decision": dec, "text": text, "user": user, "t": t, "closed": bool(closed)})
        if u["step_state"] in ("running", "wait_confirm"):
            self._mark_pending(u)
        return u

    def _save_unit(self):
        u = self.unit
        if not u:
            return
        self.db.execute("UPDATE units SET wo=?, shaft_sn=?, status=?, si=?, step_state=?, started=?, finished=?, data=? WHERE sn=?",
                        (u["wo"], u["shaft_sn"], u["status"], u["si"], u["step_state"], u["started"], u["finished"],
                         json.dumps({"ctx": u["ctx"], "shaft_sn_given": u.get("shaft_sn_given", False)}), u["sn"]))

    def _create_wo(self, qty, due, user):
        y = yyww()
        wo = f"WO-SP-{y}-{self._next_seq('wo_seq'):04d}"
        self.db.execute("INSERT INTO workorders VALUES(?,?,?,?,?,?)", (wo, int(qty), 0, due, "open", time.time()))
        self._event(f"Work order {wo} created (qty {qty})", user)
        return wo

    # ------------------------------------------------------------------------------- events / alarms
    def _event(self, text, user=None, sn=None):
        t = time.time()
        user = user if user is not None else (self.user or {}).get("name", "")
        sn = sn if sn is not None else (self.unit["sn"] if self.unit else "")
        self.db.execute("INSERT INTO events(t, sn, user, text) VALUES(?,?,?,?)", (t, sn, user, text))
        self.events.append({"t": t, "text": text, "user": user, "sn": sn})

    def _alarm(self, sev, text):
        t = time.time()
        sn = self.unit["sn"] if self.unit else ""
        cur = self.db.execute("INSERT INTO alarms(t, sev, text, sn) VALUES(?,?,?,?)", (t, sev, text, sn))
        self.alarms.append({"id": cur.lastrowid, "t": t, "sev": sev, "text": text, "ack": False, "sn": sn})

    def log_event(self, text, user="system"):          # used by the protocol threads
        with self.lock:
            self._event(text, user)
            self.db.commit()

    # ------------------------------------------------------------------------------- thread
    def start(self):
        self._thread = threading.Thread(target=self._loop, daemon=True, name="spst-station")
        self._thread.start()
        self.modbus = ModbusPoller(self)
        self.modbus.start()
        self.mqtt = MqttBridge(self)
        self.mqtt.start()

    def stop(self):
        self._stop.set()
        for th in (getattr(self, "modbus", None), getattr(self, "mqtt", None)):
            if th:
                th.stop()
        if self._thread:
            self._thread.join(timeout=2)
        with self.lock:
            self._flush_samples()
            self._save_dev_last()
            self.db.commit()

    def _save_dev_last(self):
        self._set_meta("dev_last", {d["id"]: {"last": d["last"], "seen": d["seen"]} for d in self.devices.values() if d["last"]})

    def _loop(self):
        last = time.time()
        while not self._stop.is_set():
            now = time.time()
            dt = min(2.0, now - last)
            last = now
            try:
                with self.lock:
                    self._tick(now, dt)
                    if now - getattr(self, "_dev_saved", 0.0) > 30:
                        self._dev_saved = now
                        self._save_dev_last()
                    self.db.commit()
            except Exception as e:  # never let the station thread die
                try:
                    with self.lock:
                        self._event(f"internal error in tick: {e!r}", "system")
                        self.db.commit()
                except Exception:
                    pass
            self._stop.wait(TICK)

    def _tick(self, now, dt):
        # 1. simulated device messages that are due
        if self.sched:
            due = [m for m in self.sched if m[0] <= now]
            self.sched = [m for m in self.sched if m[0] > now]
            for _, dev, vals in due:
                d = self.devices.get(dev)
                if d and d["proto"] == "sim" and d["enabled"] and self.sim["on"]:
                    self._ingest(dev, vals, "sim")
        # 2. live run-in
        if self.runin and self.runin["active"]:
            self._runin_advance(now, dt)
        self._flush_samples()
        # 2b. final test: the spindle must turn at nmax for test.vib (closed loop to the run-in stand PLC)
        u = self.unit
        if not (self.runin and self.runin["active"]):
            if u and u["status"] == "in_work" and STEP_KEYS[u["si"]] == "test" and u["step_state"] in ("running", "wait_confirm"):
                box = {"rpm_set": NMAX, "cmd": 1}
            else:
                box = {"rpm_set": 0, "cmd": 0}
            if self.sim["on"]:
                box["time_factor"] = int(self._runin_factor())
            if "RUN-01" in self.outbox or box["cmd"]:
                self.outbox["RUN-01"] = box
        # 3. simulated operator
        self._auto_tick(now)
        # 4. device online / offline
        for d in self.devices.values():
            if d["proto"] == "sim" or not d["enabled"]:
                d["online"] = False
                continue
            on = now - d["seen"] <= OFFLINE_S
            if on != d["online"]:
                d["online"] = on
                if on:
                    self._event(f"Device {d['id']} online ({d['proto']} {d['addr']})", "system")
                elif d["seen"]:
                    self._alarm("warn", f"Device {d['id']} offline – no data for {OFFLINE_S:.0f} s ({d['proto']} {d['addr']})")
                    self._event(f"Device {d['id']} offline", "system")

    # ------------------------------------------------------------------------------- device layer (threads call these)
    def devices_with_proto(self, proto):
        with self.lock:
            out = []
            for d in self.devices.values():
                if d["proto"] == proto and d["enabled"]:
                    addr = d["addr"]
                    if not addr:
                        addr = (f"127.0.0.1:5020/unit{MODBUS_SIM_UNITS.get(d['id'], 1)}" if proto == "modbus"
                                else "127.0.0.1:1883")
                    out.append((d["id"], addr))
            return out

    def outbox_for(self, dev):
        with self.lock:
            return dict(self.outbox.get(dev, {}))

    def device_seen(self, dev):
        with self.lock:
            if dev in self.devices:
                self.devices[dev]["seen"] = time.time()
                self.devices[dev]["err"] = ""

    def device_error(self, dev, text):
        with self.lock:
            d = self.devices.get(dev)
            if not d:
                return
            d["err"] = text
            if time.time() - self._dev_err_t.get(dev, 0) > 60:
                self._dev_err_t[dev] = time.time()
                self._event(f"Device {dev}: {text}", "system")
                self.db.commit()

    def ingest_device(self, dev, values, src):
        """Called by the Modbus / MQTT threads."""
        with self.lock:
            msg = self._ingest(dev, values, src)
            self.db.commit()
            return msg

    def ingest(self, body):
        """POST /api/spst/ingest - gateways. One object or a list."""
        items = body if isinstance(body, list) else [body]
        out = []
        with self.lock:
            for it in items:
                if not isinstance(it, dict):
                    raise ValueError("each message must be a JSON object")
                dev = it.get("device")
                vals = it.get("values")
                if dev not in self.devices:
                    raise ValueError(f"unknown device {dev!r} (known: {', '.join(DEV_IDS)})")
                d = self.devices[dev]
                if it.get("heartbeat") and not vals:
                    if d["proto"] != "http" or not d["enabled"]:
                        raise ValueError(f"device {dev} is not an enabled http device")
                    d["seen"] = time.time()          # keep-alive: device online, no value
                    out.append(f"{dev}: heartbeat")
                    continue
                if not isinstance(vals, dict) or not vals:
                    raise ValueError("values must be an object, e.g. {\"torque_nm\": 125.3}")
                if d["proto"] != "http":
                    raise ValueError(f"device {dev} is set to proto '{d['proto']}' – set it to http first: "
                                     f"POST /api/spst {{\"action\": \"device\", \"id\": \"{dev}\", \"proto\": \"http\"}}")
                if not d["enabled"]:
                    raise ValueError(f"device {dev} is disabled")
                out.append(self._ingest(dev, vals, "device:" + dev))
            self.db.commit()
        return "; ".join(out)

    def _ingest(self, dev, values, src):
        now = time.time()
        d = self.devices[dev]
        d["seen"] = now
        d["err"] = ""
        d["last"] = {**d["last"], **values}
        mapped = []
        u = self.unit
        if u and u["status"] == "in_work" and u["step_state"] in ("running", "wait_confirm"):
            checks = STEPS[u["si"]][4]
            for key, v in values.items():
                for c in checks:
                    if c.get("dev") == dev and c.get("key") == key and not c.get("calc") and not c.get("auto"):
                        if c["id"] == "test.vib" and "rpm" in values and float(values.get("rpm") or 0) < 0.95 * NMAX:
                            break             # vibration counts only at nmax (the stand is still running up)
                        r = u["results"].get(c["id"])
                        if r is None or r["st"] == "pending":
                            try:
                                val = to_value(c, v)
                                if c.get("scale") and c["kind"] == "num":
                                    val = val * c["scale"]
                                self._set_result(c["id"], val, src, (self.user or {}).get("name", "") if src == "manual" else dev)
                                mapped.append(c["id"])
                            except ValueError as e:
                                self._event(f"{dev}: value {key}={v!r} not usable for {c['id']}: {e}", "system")
                            break
        # device log: every mapped message; others max. 1 per 10 s per device
        if mapped or now - self._dev_log_t.get(dev, 0) >= 10:
            self._dev_log_t[dev] = now
            self.db.execute("INSERT INTO device_log(t, device, vals, src, sn, mapped) VALUES(?,?,?,?,?,?)",
                            (now, dev, json.dumps(values), src, u["sn"] if u else "", ",".join(mapped)))
        return f"{dev}: " + (f"filled {', '.join(mapped)}" if mapped else "stored (no pending check of the current step uses it)")

    # ------------------------------------------------------------------------------- results
    def _mark_pending(self, u=None):
        u = u or self.unit
        for c in STEPS[u["si"]][4]:
            if c["id"] not in u["results"]:
                u["results"][c["id"]] = {"v": None, "st": "pending", "src": "", "t": 0, "user": ""}

    def _set_result(self, cid, v, src, user):
        u = self.unit
        si, c = CHECKS[cid]
        st = judge(c, v, u)
        t = time.time()
        if isinstance(v, float):
            v = round(v, 4)
        u["results"][cid] = {"v": v, "st": st, "src": src, "t": t, "user": user}
        self.db.execute("UPDATE results SET superseded=1 WHERE sn=? AND check_id=? AND superseded=0", (u["sn"], cid))
        self.db.execute("INSERT INTO results(sn, check_id, step, v, st, src, user, t) VALUES(?,?,?,?,?,?,?,?)",
                        (u["sn"], cid, STEP_KEYS[si], json.dumps(v), st, src, user, t))
        if cid == "kit.shaft_sn" and st == "ok":
            u["shaft_sn"] = v
        if st == "bad":
            self._alarm("warn", f"{u['sn']} {cid} = {v} {c['unit']} out of limits – NCR needed")
        self._event(f"Result {cid} = {v}{(' ' + c['unit']) if c['unit'] else ''} → {st} ({src})", user)
        # close rework NCRs of this check when the re-measured value is ok / warn
        if st in ("ok", "warn"):
            for n in u["ncr"]:
                if n["check"] == cid and n["decision"] == "rework" and not n["closed"]:
                    n["closed"] = True
                    self.db.execute("UPDATE ncr SET closed=1, closed_t=? WHERE id=?", (t, n["id"]))
        self._recalc()
        self._update_step_state()
        self._save_unit()

    def _reset_result(self, cid):
        u = self.unit
        self.db.execute("UPDATE results SET superseded=1 WHERE sn=? AND check_id=? AND superseded=0", (u["sn"], cid))
        u["results"][cid] = {"v": None, "st": "pending", "src": "", "t": 0, "user": ""}

    def _recalc(self):
        """Calculated checks of the current step (inputs may come from earlier steps)."""
        u = self.unit
        res = u["results"]
        val = lambda k: res[k]["v"] if k in res and res[k]["st"] != "pending" else None   # noqa: E731
        for c in STEPS[u["si"]][4]:
            if not c.get("calc"):
                continue
            r = res.get(c["id"])
            if r and r["st"] != "pending":
                continue
            ins = [val(k) for k in CALC_INPUTS[c["id"]]]
            if any(x is None for x in ins):
                continue
            cid = c["id"]
            if cid == "spacer.ds_req":
                v = (ins[0] + ins[1]) / 2 + (ins[2] + ins[3]) / 2
            elif cid == "spacer.ds_err":
                v = ins[0] - ins[1]
            elif cid == "spacer.preload":
                eps = ins[1] - ins[0]                    # + = more preload (inner spacer too short)
                v = DES["Fpre"] * max(0.05, 1 + eps / 8.0) ** 1.5
            elif cid == "clamp.f_mean":
                v = sum(ins) / 3
            else:
                continue
            self._set_result(cid, v, "calc", "station")
            return                                        # _set_result calls _recalc again

    def _update_step_state(self):
        u = self.unit
        if u["step_state"] not in ("running", "wait_confirm"):
            return
        pend = [c["id"] for c in STEPS[u["si"]][4] if c["req"] and u["results"].get(c["id"], {}).get("st", "pending") == "pending"]
        new = "running" if pend or (self.runin and self.runin["active"]) else "wait_confirm"
        if new != u["step_state"]:
            u["step_state"] = new

    def _has_concession(self, cid):
        r = self.unit["results"].get(cid)
        return any(n["check"] == cid and n["decision"] == "concession" and n["t"] >= (r or {}).get("t", 0)
                   for n in self.unit["ncr"])

    def _pending_and_bad(self):
        u = self.unit
        pend, bad = [], []
        for c in STEPS[u["si"]][4]:
            r = u["results"].get(c["id"])
            if c["req"] and (r is None or r["st"] == "pending"):
                pend.append(c["id"])
            elif r and r["st"] == "bad" and not self._has_concession(c["id"]):
                bad.append(c["id"])
        return pend, bad

    # ------------------------------------------------------------------------------- actions
    def action(self, body):
        if not isinstance(body, dict):
            raise ValueError("JSON object expected")
        a = body.get("action")
        fn = getattr(self, "_a_" + str(a), None)
        if fn is None:
            raise ValueError(f"unknown action {a!r}")
        with self.lock:
            try:
                msg = fn(body)
            except ValueError as e:
                # refused actions go into the audit trail as well
                if a in ("confirm", "record", "start_step", "ncr", "new_unit"):
                    self._event(f"REFUSED {a}: {e}")
                    self.db.commit()
                raise
            self.db.commit()
            return msg

    def _need_user(self, roles=None):
        if not self.user:
            raise ValueError("login required")
        if roles and self.user["role"] not in roles:
            raise ValueError(f"role {'/'.join(roles)} required (logged in: {self.user['name']} as {self.user['role']})")

    def _need_unit(self, in_work=True):
        u = self.unit
        if not u or u["status"] in ("accepted", "rejected"):
            raise ValueError("no unit in work – start one with new_unit")
        if in_work and u["status"] == "hold":
            raise ValueError(f"unit {u['sn']} is on HOLD – release it first")
        return u

    def _a_login(self, b):
        name = str(b.get("user") or "").strip()
        role = b.get("role", "operator")
        if not name:
            raise ValueError("user name required")
        if role not in ROLES:
            raise ValueError(f"role must be one of {ROLES}")
        self.user = {"name": name[:40], "role": role}
        self._set_meta("user", self.user)
        self._event(f"Login {name} ({role})", name)
        return f"logged in as {name} ({role})"

    def _a_logout(self, b):
        if not self.user:
            return "nobody logged in"
        name = self.user["name"]
        self._event(f"Logout {name}", name)
        self.user = None
        self._set_meta("user", None)
        return f"{name} logged out"

    def _a_new_unit(self, b):
        self._need_user()
        if self.unit and self.unit["status"] in ("in_work", "hold"):
            raise ValueError(f"unit {self.unit['sn']} is still in work (step {self.unit['si'] + 1})")
        wo = b.get("wo")
        if wo:
            r = self.db.execute("SELECT status FROM workorders WHERE wo=?", (wo,)).fetchone()
            if not r or r[0] != "open":
                raise ValueError(f"work order {wo} is not open")
        else:
            r = self.db.execute("SELECT wo FROM workorders WHERE status='open' ORDER BY due LIMIT 1").fetchone()
            wo = r[0] if r else self._create_wo(1, time.time() + 3 * 86400, self.user["name"])
        y = yyww()
        n = self._next_seq("sn_seq")
        sn = f"SPU-{y}-{n:05d}"
        shaft = str(b.get("shaft_sn") or "").strip()
        now = time.time()
        self.unit = {"sn": sn, "wo": wo, "shaft_sn": shaft or f"SPS-{y}-{n:05d}", "status": "in_work", "si": 0,
                     "step_state": "idle", "started": now, "finished": None, "results": {}, "signed": [], "ncr": [],
                     "shaft_sn_given": bool(shaft), "step_t0": now,
                     "ctx": {"n": n, "repaired": [], "reworks": {}, "runin_runs": 0, "chK": 1.0,
                             "C0f": 1 + 0.1 * self.rng.gauss(0, 1)}}
        self.db.execute("INSERT INTO units(sn, wo, shaft_sn, status, si, step_state, started, data) VALUES(?,?,?,?,?,?,?,?)",
                        (sn, wo, self.unit["shaft_sn"], "in_work", 0, "idle", now, "{}"))
        self._save_unit()
        self.runin = None
        self.outbox.pop("RUN-01", None)
        self._event(f"New unit {sn} for {wo} (shaft {self.unit['shaft_sn']})")
        return f"unit {sn} started for {wo}"

    def _a_start_step(self, b):
        self._need_user()
        u = self._need_unit()
        if u["step_state"] != "idle":
            raise ValueError(f"step {u['si'] + 1} ({STEP_KEYS[u['si']]}) is already {u['step_state']}")
        u["step_state"] = "running"
        u["step_t0"] = time.time()
        self._mark_pending()
        self._event(f"Start step {u['si'] + 1} {STEPS[u['si']][1]}")
        self._recalc()
        self._schedule_step_devices()
        if STEP_KEYS[u["si"]] == "runin":
            self._runin_start()
        self._update_step_state()
        self._save_unit()
        return f"step {u['si'] + 1} ({STEP_KEYS[u['si']]}) started"

    def _a_record(self, b):
        self._need_user()
        u = self._need_unit()
        cid = b.get("id")
        if cid not in CHECKS:
            raise ValueError(f"unknown check {cid!r}")
        si, c = CHECKS[cid]
        if si != u["si"]:
            raise ValueError(f"{cid} belongs to step {si + 1} ({STEP_KEYS[si]}), current step is {u['si'] + 1} ({STEP_KEYS[u['si']]})")
        if u["step_state"] not in ("running", "wait_confirm"):
            raise ValueError("start the step first (start_step)")
        if c.get("calc"):
            raise ValueError(f"{cid} is calculated by the station – record its inputs")
        r = u["results"].get(cid)
        if r and r["st"] != "pending":
            raise ValueError(f"{cid} already has a value ({r['v']}, {r['st']}) – to measure again raise an NCR with decision rework")
        if "v" not in b:
            raise ValueError("v (value) required")
        v = to_value(c, b["v"])
        self._set_result(cid, v, "sim" if b.get("_sim") else "manual", self.user["name"])
        rr = u["results"][cid]
        return f"{cid} = {rr['v']} → {rr['st']}"

    def _a_confirm(self, b):
        self._need_user()
        u = self._need_unit()
        k = STEP_KEYS[u["si"]]
        if u["step_state"] not in ("running", "wait_confirm"):
            raise ValueError("start the step first (start_step)")
        if k in INSPECTOR_STEPS and self.user["role"] not in ("inspector", "admin"):
            raise ValueError(f"step {k} must be confirmed by an inspector (logged in: {self.user['name']} as {self.user['role']})")
        if k == "runin" and self.runin and self.runin["active"]:
            raise ValueError("run-in program still running")
        pend, bad = self._pending_and_bad()
        if pend:
            raise ValueError(f"interlock: required check(s) still pending: {', '.join(pend)}")
        if bad:
            raise ValueError(f"interlock: check(s) out of limits without NCR decision: {', '.join(bad)} "
                             f"(raise an NCR: rework, scrap or concession)")
        t = time.time()
        self.db.execute("INSERT INTO signatures(sn, si, step, user, role, t) VALUES(?,?,?,?,?,?)",
                        (u["sn"], u["si"], k, self.user["name"], self.user["role"], t))
        u["signed"].append({"si": u["si"], "user": self.user["name"], "t": t})
        self._event(f"Step {u['si'] + 1} {k} confirmed (signed by {self.user['name']}, {self.user['role']})")
        if u["si"] == len(STEPS) - 1:
            u["step_state"] = "done"
            u["status"] = "accepted"
            u["finished"] = t
            self.db.execute("UPDATE workorders SET done=done+1 WHERE wo=?", (u["wo"],))
            self.db.execute("UPDATE workorders SET status='done' WHERE wo=? AND done>=qty", (u["wo"],))
            self._alarm("info", f"Unit {u['sn']} ACCEPTED – lead time {(t - u['started']) / 3600:.2f} h")
            self._event(f"Unit {u['sn']} accepted")
            self._save_unit()
            return f"step {k} confirmed – unit {u['sn']} ACCEPTED"
        u["si"] += 1
        u["step_state"] = "idle"
        self._save_unit()
        return f"step {k} confirmed – next step {u['si'] + 1} ({STEP_KEYS[u['si']]})"

    def _a_ncr(self, b):
        self._need_user()
        u = self._need_unit(in_work=False)
        cid = b.get("id")
        dec = b.get("decision")
        text = str(b.get("text") or "").strip()
        if dec not in ("rework", "scrap", "concession"):
            raise ValueError("decision must be rework, scrap or concession")
        if dec == "scrap":
            if cid not in CHECKS and cid != "unit":
                raise ValueError(f"unknown check {cid!r} (use a check id or \"unit\")")
        else:
            if cid not in CHECKS:
                raise ValueError(f"unknown check {cid!r}")
            if CHECKS[cid][0] != u["si"]:
                raise ValueError(f"{cid} is not a check of the current step {u['si'] + 1} ({STEP_KEYS[u['si']]})")
            if u["status"] == "hold":
                raise ValueError("unit is on HOLD – release it first")
            r = u["results"].get(cid)
            if not r or r["st"] not in ("bad", "warn"):
                raise ValueError(f"{cid} is not out of limits ({(r or {}).get('st', 'pending')}) – NCR not needed")
        if dec == "concession":
            if self.user["role"] not in ("inspector", "admin"):
                raise ValueError("a concession needs the inspector role")
            if not text:
                raise ValueError("a concession needs a text (reason / who decided)")
        t = time.time()
        nid = f"NCR-{self._next_seq('ncr_seq'):04d}"
        closed = dec != "rework"
        n = {"id": nid, "check": cid, "decision": dec, "text": text, "user": self.user["name"], "t": t, "closed": closed}
        u["ncr"].append(n)
        self.db.execute("INSERT INTO ncr(id, sn, check_id, decision, text, user, role, t, closed, closed_t) VALUES(?,?,?,?,?,?,?,?,?,?)",
                        (nid, u["sn"], cid, dec, text, self.user["name"], self.user["role"], t, int(closed), t if closed else None))
        self._event(f"{nid} on {cid}: {dec}{(' – ' + text) if text else ''}")
        self._alarm("info", f"{nid} {u['sn']} {cid}: {dec}")
        if dec == "scrap":
            self._runin_halt("unit scrapped", results=False)
            for o in u["ncr"]:
                if not o["closed"]:
                    o["closed"] = True
                    self.db.execute("UPDATE ncr SET closed=1, closed_t=? WHERE id=?", (t, o["id"]))
            u["status"] = "rejected"
            u["finished"] = t
            u["step_state"] = "done"
            self._alarm("warn", f"Unit {u['sn']} REJECTED (scrap, {nid})")
            self._event(f"Unit {u['sn']} rejected ({nid})")
            self._save_unit()
            return f"{nid}: unit {u['sn']} scrapped (rejected)"
        if dec == "rework":
            ids = self._rework_ids(cid)
            for k in ids:
                self._reset_result(k)
            ctx = u["ctx"]
            ctx["reworks"][cid] = ctx["reworks"].get(cid, 0) + 1
            f = FAULT_OF.get(cid)
            if f and f not in ctx["repaired"]:
                ctx["repaired"].append(f)
            if u["step_state"] == "wait_confirm":
                u["step_state"] = "running"
            self._recalc()
            self._schedule_step_devices(only=ids)
            self._update_step_state()
            self._save_unit()
            return f"{nid}: rework – measure again: {', '.join(ids)}"
        self._update_step_state()
        self._save_unit()
        return f"{nid}: concession for {cid} accepted by {self.user['name']}"

    def _rework_ids(self, cid):
        si, c = CHECKS[cid]
        if c.get("auto") == "runin" or cid == "runin.noise":
            return [x["id"] for x in STEPS[si][4] if x.get("auto") == "runin" or x["id"] == "runin.noise"]
        # closure inside the step: a calculated check brings its inputs, an input brings every calculated
        # check that uses it (spacer.ds_err -> ds_meas, ds_req -> preload)
        ids, grow = {cid}, True
        while grow:
            grow = False
            for k in list(ids):
                new = set(x for x in CALC_INPUTS.get(k, []) if CHECKS[x][0] == si)
                new.update(calc for calc, ins in CALC_INPUTS.items() if k in ins and CHECKS[calc][0] == si)
                if not new <= ids:
                    ids |= new
                    grow = True
        order = [x["id"] for x in STEPS[si][4]]
        return [k for k in order if k in ids]

    def _a_hold(self, b):
        self._need_user()
        u = self._need_unit()
        reason = str(b.get("reason") or "").strip() or "no reason given"
        u["status"] = "hold"
        self._runin_halt("unit on hold", results=False)
        self._save_unit()
        self._event(f"HOLD {u['sn']}: {reason}")
        self._alarm("warn", f"Unit {u['sn']} on HOLD: {reason}")
        return f"unit {u['sn']} on hold"

    def _a_release(self, b):
        self._need_user()
        u = self._need_unit(in_work=False)
        if u["status"] != "hold":
            raise ValueError("unit is not on hold")
        u["status"] = "in_work"
        self._save_unit()
        self._event(f"RELEASE {u['sn']}")
        return f"unit {u['sn']} released"

    def _a_sim(self, b):
        s = self.sim
        if "on" in b:
            s["on"] = bool(b["on"])
        if "auto" in b:
            s["auto"] = bool(b["auto"])
            self.auto["next"] = 0.0
        if "speed" in b:
            try:
                sp = float(b["speed"])
            except (TypeError, ValueError):
                raise ValueError("speed must be a number 1–20")
            s["speed"] = int(sp) if sp == int(sp) else sp
            s["speed"] = max(1, min(20, s["speed"]))
        if "faults" in b:
            fl = b["faults"] or []
            if not isinstance(fl, list) or any(f not in FAULTS for f in fl):
                raise ValueError(f"faults must be a list of {FAULTS}")
            s["faults"] = sorted(set(fl))
        if s["auto"] and not s["on"]:
            s["auto"] = False
        self._set_meta("sim", s)
        self._event(f"Simulator: on={s['on']} auto={s['auto']} speed={s['speed']} faults={','.join(s['faults']) or '-'}")
        return f"simulator on={s['on']} auto={s['auto']} speed={s['speed']} faults={s['faults']}"

    def _a_runin(self, b):
        cmd = b.get("cmd")
        if cmd == "ack":
            n = 0
            for a in self.alarms:
                if not a["ack"] and a["text"].startswith("Run-in"):
                    self._ack(a)
                    n += 1
            if self.runin:
                self.runin["tripped"] = False
            return f"{n} run-in alarm(s) acknowledged"
        self._need_user()
        u = self._need_unit()
        if STEP_KEYS[u["si"]] != "runin" or u["step_state"] not in ("running", "wait_confirm"):
            raise ValueError("the run-in program runs in step 19 (runin) after start_step")
        if cmd == "start":
            if self.runin and self.runin["active"]:
                raise ValueError("run-in already running")
            if self.runin and self.runin.get("tripped"):
                raise ValueError("run-in was aborted by an alarm – acknowledge it first (runin ack)")
            if any(u["results"].get(c["id"], {}).get("st", "pending") != "pending"
                   for c in STEPS[u["si"]][4] if c.get("auto")):
                raise ValueError("run-in results exist – raise a rework NCR on a runin check to repeat the run-in")
            self._runin_start()
            self._update_step_state()
            return "run-in started"
        if cmd == "stop":
            if not (self.runin and self.runin["active"]):
                raise ValueError("run-in is not running")
            self._runin_halt(f"stopped by {self.user['name']}", results=False)
            self._update_step_state()
            return "run-in stopped (no results – start again)"
        raise ValueError("cmd must be start, stop or ack")

    def _ack(self, a):
        a["ack"] = True
        self.db.execute("UPDATE alarms SET ack=1, ack_user=?, ack_t=? WHERE id=?",
                        ((self.user or {}).get("name", ""), time.time(), a["id"]))

    def _a_ack(self, b):
        aid = b.get("id")
        n = 0
        for a in self.alarms:
            if not a["ack"] and (aid == "all" or a["id"] == aid or str(a["id"]) == str(aid)):
                self._ack(a)
                n += 1
        if not n:
            raise ValueError(f"no open alarm {aid!r}")
        self._event(f"Alarm {aid} acknowledged")
        return f"{n} alarm(s) acknowledged"

    def _a_device(self, b):
        did = b.get("id")
        d = self.devices.get(did)
        if not d:
            raise ValueError(f"unknown device {did!r}")
        if "proto" in b:
            if b["proto"] not in ("sim", "http", "modbus", "mqtt"):
                raise ValueError("proto must be sim, http, modbus or mqtt")
            if b["proto"] == "modbus" and did not in MODBUS_MAP:
                raise ValueError(f"no Modbus register map for {did} (maps: RUN-01, BAL-01, HSK-01, FG-01, PRS-01)")
            d["proto"] = b["proto"]
            d["online"] = False
            d["seen"] = 0.0
            d["err"] = ""
        if "addr" in b:
            d["addr"] = str(b["addr"] or "").strip()
        if "enabled" in b:
            d["enabled"] = bool(b["enabled"])
        self.db.execute("INSERT OR REPLACE INTO devices VALUES(?,?,?,?)", (did, d["proto"], d["addr"], int(d["enabled"])))
        who = (self.user or {}).get("name", "") or "system"
        self._event(f"Device {did}: proto={d['proto']} addr={d['addr'] or '-'} enabled={d['enabled']}", who)
        return f"device {did}: proto {d['proto']} addr {d['addr'] or '(default)'} enabled {d['enabled']}"

    # ------------------------------------------------------------------------------- simulator: device values
    def _faults(self):
        rep = set(self.unit["ctx"].get("repaired", [])) if self.unit else set()
        return set(self.sim["faults"]) - rep

    def _feff(self):
        """Preload per bearing from the unit's own spacer results (real coupling) x 2.2 if a bearing is reversed."""
        r = self.unit["results"].get("spacer.preload") if self.unit else None
        f = r["v"] if r and r["st"] != "pending" else DES["Fpre"]
        return f, f * (2.2 if "mix" in self._faults() else 1)

    def _sim_value(self, cid):
        u, F, R = self.unit, self._faults(), self.rng
        N = lambda m, s: m + s * R.gauss(0, 1)     # noqa: E731
        A = abs
        res = u["results"]
        get = lambda k, d=0.0: res[k]["v"] if k in res and res[k]["st"] != "pending" else d   # noqa: E731
        n = u["ctx"]["n"]
        F0, Feff = self._feff()
        mixK = 2.2 if "mix" in F else 1
        V = {
            "kit.shaft_sn": lambda: u["shaft_sn"],
            "kit.set_front": lambda: f"B-BRG-00041 set {23410 + n * 7:06d}",
            "kit.set_rear": lambda: f"B-BRG-00042 set {31870 + n * 5:06d}",
            "kit.motor_kit": lambda: f"B-MOT-00004 kit {5100 + n:06d}",
            "kit.open_ncr": lambda: 0,
            "clean.particles": lambda: round(A(N(90000, 40000))),
            "clean.room_t": lambda: N(20.1, 0.25),
            "clean.soak": lambda: True,
            "clean.patch": lambda: A(N(0.8, 0.3)),
            "meas.standout_1": lambda: N(1.2, 1.1), "meas.standout_2": lambda: N(1.0, 1.1),
            "meas.standout_3": lambda: N(0.9, 1.1), "meas.standout_4": lambda: N(1.3, 1.1),
            "meas.bore_mean": lambda: sum(-A(N(2.4, 0.6)) for _ in range(4)) / 4,
            "meas.fit_front": lambda: N(0.3, 0.6) - get("meas.bore_mean", -2.4),
            "meas.clr_front": lambda: N(1.8, 0.7) + sum(A(N(3.0, 0.8)) for _ in range(4)) / 4,
            "meas.fit_rear": lambda: N(0.2, 0.6) + A(N(2.3, 0.6)),
            "meas.clr_rear": lambda: N(8, 1.2),
            "spacer.ds_meas": lambda: get("spacer.ds_req", 2.2) + (-6 if "spacer" in F else N(0, 0.35)),
            "spacer.parallel": lambda: A(N(0.5, 0.2)),
            "grease.front": lambda: DES["gF"] * (3 if "grease" in F else N(1, 0.02)),
            "grease.rear": lambda: DES["gR"] * (3 if "grease" in F else N(1, 0.02)),
            "grease.spread": lambda: True,
            "front.ring_temp": lambda: N(72, 3),
            "front.vline": lambda: "mix" not in F,
            "front.seated": lambda: True,
            "nut.torque": lambda: N(125, 1.5),
            "nut.runout_before": lambda: A(N(5, 1.8)) + 1.5,
            "nut.runout_after": lambda: get("nut.runout_before", 5) if "nut" in F else A(N(1.0, 0.4)),
            "nut.friction": lambda: 0.15 + 0.35 * Feff / DES["Fpre"] * N(1, 0.05),
            "fbh.heat_dk": lambda: DES["dTh"] + N(4, 1),
            "fbh.axial_play": lambda: A(N(0.3, 0.2)),
            "rotor.interf": lambda: N(0.028, 0.003) if "rotor" in F else N(DES["dRotI"], 0.004),
            "rotor.temp": lambda: DES["Trot"] + N(0, 4),
            "rotor.gap": lambda: A(N(0.02, 0.01)),
            "rear.torque": lambda: N(73, 1.0),
            "rear.runout": lambda: A(N(1.1, 0.4)),
            "rear.tail_runout": lambda: A(N(1.5, 0.6)),
            "rear.sleeve": lambda: True,
            "draw.count": lambda: DES["pk_n"],
            "draw.L0": lambda: DES["pk_L0"] + N(0, 0.15) + (2 * 2.25 if "spring" in F else 0),
            "draw.force": lambda: DES["pk_Fc"] / 1000 * N(1.01, 0.02) * (0.6 if "spring" in F else 1),
            "balance.u0_1": lambda: A(N(70, 25)), "balance.u0_2": lambda: A(N(55, 20)),
            "balance.ures_1": lambda: A(N(0.3, 0.12)) * DES["UperPlane"],
            "balance.ures_2": lambda: A(N(0.3, 0.12)) * DES["UperPlane"],
            "stator.p_drop": lambda: N(1.4, 0.2) if "oring" in F else A(N(0.03, 0.02)),
            "stator.r_ins": lambda: A(N(800, 300)) + 200,
            "stator.r_bal": lambda: A(N(0.6, 0.3)),
            "insert.bolt_torque": lambda: N(67, 0.8),
            "insert.gap_1": lambda: 1 + N(0, 0.04), "insert.gap_2": lambda: 1 + N(0, 0.04),
            "insert.gap_3": lambda: 1 + N(0, 0.04), "insert.gap_4": lambda: 1 + N(0, 0.04),
            "insert.turn_torque": lambda: get("nut.friction", 0.5) + 0.1,
            "cover.torque": lambda: N(9.5, 0.15),
            "cover.lab_1": lambda: 0.25 + N(0, 0.015), "cover.lab_2": lambda: 0.25 + N(0, 0.015),
            "cover.lab_3": lambda: 0.25 + N(0, 0.015), "cover.lab_4": lambda: 0.25 + N(0, 0.015),
            "cover.air": lambda: True,
            "cover.sleeve_force": lambda: A(N(60, 15)),
            "unclamp.p_rel": lambda: DES["p_rel"] * N(1.05, 0.02) * (0.6 if "spring" in F else 1),
            "unclamp.stroke": lambda: DES["stroke"] + N(0, 0.08),
            "unclamp.eject": lambda: N(0.5, 0.05),
            "clamp.f_1": lambda: DES["Fclamp"] * N(1.03, 0.025) * (0.6 if "spring" in F else 1),
            "clamp.f_2": lambda: DES["Fclamp"] * N(1.03, 0.025) * (0.6 if "spring" in F else 1),
            "clamp.f_3": lambda: DES["Fclamp"] * N(1.03, 0.025) * (0.6 if "spring" in F else 1),
            "clamp.sensor": lambda: True, "clamp.eject": lambda: True,
            "sensors.pt_front": lambda: N(20.2, 0.2), "sensors.pt_stator": lambda: N(20.3, 0.2),
            "sensors.enc_a": lambda: N(1.0, 0.03), "sensors.enc_b": lambda: N(1.0, 0.03),
            "sensors.labelled": lambda: True,
            "runin.noise": lambda: "dirt" not in F,
            "test.runout_taper": lambda: A(N(0.9, 0.3)) + (0.35 * get("nut.runout_before", 5) if "nut" in F else 0),
            "test.runout_300": lambda: A(N(2.4, 0.7)) + (1.1 * get("nut.runout_before", 5) if "nut" in F else 0) + (1.5 if "mix" in F else 0),
            "test.k_ax": lambda: DES["cax"] * (F0 / DES["Fpre"]) ** (1 / 3) * (0.6 if "mix" in F else 1) * N(1, 0.04),
            "test.k_rad": lambda: 200 * (F0 / DES["Fpre"]) ** (1 / 3) * (0.75 if "mix" in F else 1) * N(1, 0.05),
            "test.growth": lambda: DES["dLnose_um"] + N(5, 1.2) + (F0 * mixK / DES["Fpre"] - 1) * 4,
            "test.vib": lambda: A(N(0.42, 0.08)) + (1.1 if "dirt" in F else 0) + (0.9 if "rotor" in F else 0) + (0.3 if "mix" in F else 0),
            "test.u_shift": lambda: N(28, 5) if "rotor" in F else A(N(1.2, 0.6)),
            "test.noise": lambda: N(68, 1.5) + (9 if "dirt" in F else 0),
            "test.clamp": lambda: get("clamp.f_mean", 18.5) * N(1, 0.01),
            "pack.plate": lambda: u["sn"],
            "pack.record": lambda: True, "pack.lock": lambda: True,
        }
        fn = V.get(cid)
        if fn is None:
            return None
        v = fn()
        _, c = CHECKS[cid]
        if isinstance(v, float):
            v = round(v, 4 if c["unit"] in ("mm", "g", "Vpp") else 3)
        if c.get("scale") and c["kind"] == "num":
            v = round(v / c["scale"], 3)        # device sends its own unit (PRS-01: bar)
        return v

    def _step_time(self):
        """Real seconds one step takes for the simulated operator (auto)."""
        return (30 + STEPS[self.unit["si"]][3] / 4) / self.sim["speed"]

    def _schedule_step_devices(self, only=None, only_pending=False):
        """Simulated devices answer when a step starts (or after a rework). Real devices: nothing to do."""
        if not self.sim["on"] or not self.unit:
            return
        u = self.unit
        now = time.time()
        msgs = []               # [dev, {key: value}]
        for c in STEPS[u["si"]][4]:
            if not c.get("dev") or not c.get("key") or c.get("calc") or c.get("auto"):
                continue
            if only is not None and c["id"] not in only:
                continue
            if only_pending and u["results"].get(c["id"], {}).get("st", "pending") != "pending":
                continue
            d = self.devices[c["dev"]]
            if d["proto"] != "sim" or not d["enabled"]:
                continue
            v = self._sim_value(c["id"])
            if v is None:
                continue
            last = next((m for m in reversed(msgs) if m[0] == c["dev"]), None)
            if last is not None and c["key"] not in last[1] and last is msgs[-1]:
                last[1][c["key"]] = v
            else:
                msgs.append([c["dev"], {c["key"]: v}])
        for m in msgs:          # plausible extra values of some devices
            dev, vals = m
            if dev == "BAL-01":
                vals.update(a1_deg=round(self.rng.random() * 360, 1), a2_deg=round(self.rng.random() * 360, 1))
            elif dev == "IH-01":
                vals["state"] = "ready"
            elif dev == "TQ-01":
                vals["angle_deg"] = round(abs(self.rng.gauss(12, 4)), 1)
        if self.sim["auto"]:
            dur = self._step_time()
            offs = [dur * (0.1 + 0.45 * (i + 1) / (len(msgs) + 1)) for i in range(len(msgs))]
        else:
            gap = max(0.4, 2.0 / self.sim["speed"])
            offs = [gap * (i + 1) for i in range(len(msgs))]
        for (dev, vals), off in zip(msgs, offs):
            self.sched.append((now + off, dev, vals))

    # ------------------------------------------------------------------------------- simulated operator (sim.auto)
    def _auto_login(self, role):
        name = {"operator": "Sim operator", "inspector": "Sim inspector"}[role]
        if not self.user or self.user["name"] != name:
            self._a_login({"user": name, "role": role})

    def _auto_tick(self, now):
        if not (self.sim["on"] and self.sim["auto"]):
            return
        A = self.auto
        if now < A["next"]:
            return
        sp = self.sim["speed"]
        u = self.unit
        try:
            if u is None or u["status"] in ("accepted", "rejected"):
                if A["wait"] is None:
                    A["wait"] = now + max(1.0, 8.0 / sp)
                    return
                if now < A["wait"]:
                    return
                A["wait"] = None
                self._auto_login("operator")
                self._a_new_unit({})
                A["next"] = now + max(0.5, 4.0 / sp)
                return
            if u["status"] == "hold":
                return
            k = STEP_KEYS[u["si"]]
            insp = k in INSPECTOR_STEPS
            if u["step_state"] == "running" and A.get("key") != (u["sn"], u["si"]):
                # auto switched on while a step was already running (started by a person): make a plan now
                A["key"] = (u["sn"], u["si"])
                A["t0"], A["dur"] = now, self._step_time()
                A["plan"] = {}
                manual = [c["id"] for c in STEPS[u["si"]][4] if not c.get("dev") and not c.get("calc")
                          and u["results"].get(c["id"], {}).get("st", "pending") == "pending"]
                for i, cid in enumerate(manual):
                    A["plan"][cid] = now + A["dur"] * (0.2 + 0.6 * (i + 1) / (len(manual) + 1))
                return
            if u["step_state"] == "idle":
                self._auto_login("operator")
                self._a_start_step({})
                A["key"] = (u["sn"], u["si"])
                A["t0"], A["dur"] = now, self._step_time()
                A["plan"] = {}
                manual = [c["id"] for c in STEPS[u["si"]][4] if not c.get("dev") and not c.get("calc")]
                for i, cid in enumerate(manual):
                    A["plan"][cid] = now + A["dur"] * (0.45 + 0.4 * (i + 1) / (len(manual) + 1))
                return
            # NCR decisions for bad results (one per tick)
            pend, bad = self._pending_and_bad()
            if bad:
                cid = bad[0]
                ctx = u["ctx"]
                if k == "runin":
                    self._auto_login("inspector")
                    if ctx.get("runin_reworks", 0) < 1:
                        ctx["runin_reworks"] = ctx.get("runin_reworks", 0) + 1
                        self._a_ncr({"id": cid, "decision": "rework", "text": "repeat the run-in (grease distribution)"})
                    else:
                        self._a_ncr({"id": cid, "decision": "scrap", "text": "run-in failed twice – disassemble, check bearings"})
                elif k == "test" or ctx["reworks"].get(cid, 0) >= 2:
                    self._auto_login("inspector")
                    self._a_ncr({"id": cid, "decision": "scrap", "text": f"{cid} out of limits – not repairable at the station"})
                else:
                    self._auto_login("operator")
                    self._a_ncr({"id": cid, "decision": "rework", "text": "measure / correct again"})
                    for x in self._rework_ids(cid):
                        if not CHECKS[x][1].get("dev"):
                            A["plan"][x] = now + A["dur"] * 0.2
                A["next"] = now + A["dur"] * 0.2
                return
            # manual entries of the simulated operator
            recorded = False
            for cid, due in sorted(A["plan"].items(), key=lambda kv: kv[1]):
                if due <= now and u["results"].get(cid, {}).get("st", "pending") == "pending":
                    v = self._sim_value(cid)
                    if v is not None:
                        self._auto_login("inspector" if insp else "operator")
                        self._a_record({"id": cid, "v": v, "_sim": True})
                        recorded = True
                    A["plan"].pop(cid, None)
            if recorded:
                return
            # run-in: (re)start the program when needed
            if k == "runin" and u["step_state"] == "running" and not (self.runin and self.runin["active"]):
                autos = [c["id"] for c in STEPS[u["si"]][4] if c.get("auto")]
                if all(u["results"].get(x, {}).get("st", "pending") == "pending" for x in autos):
                    self._auto_login("inspector")
                    if self.runin and self.runin.get("tripped"):
                        self._a_runin({"cmd": "ack"})
                    self._a_runin({"cmd": "start"})
                    if "runin.noise" not in A["plan"] and u["results"].get("runin.noise", {}).get("st") == "pending":
                        A["plan"]["runin.noise"] = now + 2.0
                    return
            if u["step_state"] == "wait_confirm" and now >= A["t0"] + A["dur"]:
                self._auto_login("inspector" if insp else "operator")
                self._a_confirm({})
                if insp:
                    self._auto_login("operator")
                A["next"] = now + max(0.3, 2.0 / sp)
        except ValueError as e:
            self._event(f"Sim operator: {e}", "system")
            A["next"] = now + max(1.0, 5.0 / sp)

    # ------------------------------------------------------------------------------- run-in
    def _runin_factor(self):
        return self.sim["speed"] * RUNIN_ACCEL if self.sim["on"] else 1.0

    def _runin_start(self):
        u = self.unit
        u["ctx"]["runin_runs"] = u["ctx"].get("runin_runs", 0) + 1
        sim = self.devices["RUN-01"]["proto"] == "sim"
        self.runin = {"active": True, "run": u["ctx"]["runin_runs"], "i": 0, "tS": 0.0, "elapsed": 0.0, "running": True,
                      "cooling": False, "stops": 0, "tripped": False, "rpm": 0.0, "rpm_set": float(RUNIN_PROFILE[0][0]),
                      "dTf": 0.0, "dTr": 0.0, "dTs": 0.0, "dTw": 0.0, "vib": 0.0, "flow": 4.0, "win": 20.0,
                      "hist": deque(maxlen=400), "rate": 0.0, "dT_max": 0.0, "last_sample": -RUNIN_SAMPLE_S,
                      "end_buf": deque(maxlen=24), "rules": {k: False for k, _ in RUNIN_RULES}, "sim": sim,
                      "C0": 6 * (3.6 if "grease" in self._faults() else 1) * u["ctx"].get("C0f", 1.0),
                      "tau_c": 25.0 if "grease" in self._faults() else 10.0,     # min - excess grease churns longer
                      "msg": "started", "finished": False, "waiting": False}
        self._runin_outbox()
        self._event(f"Run-in program started (run {self.runin['run']}, source {'simulator' if sim else 'RUN-01 ' + self.devices['RUN-01']['proto']})")

    def _runin_outbox(self):
        R = self.runin
        box = {"rpm_set": int(R["rpm_set"]) if R and R["active"] else 0, "cmd": 1 if R and R["active"] else 0}
        if self.sim["on"]:
            box["time_factor"] = int(self._runin_factor())
        self.outbox["RUN-01"] = box

    def _runin_halt(self, why, results):
        R = self.runin
        if not R or not R["active"]:
            return
        R["active"] = False
        R["running"] = False
        R["rpm_set"] = 0.0
        R["msg"] = why
        self._runin_outbox()
        if results:
            self._runin_results(aborted=True)
        self._event(f"Run-in halted: {why}")

    def _runin_advance(self, now, dt):
        R = self.runin
        u = self.unit
        if not u or u["status"] != "in_work":
            return
        dproc = dt * self._runin_factor()
        dev = self.devices["RUN-01"]
        if not R["sim"]:
            if dev["proto"] == "sim" or now - dev["seen"] > OFFLINE_S:
                R["waiting"] = True
                R["msg"] = "waiting for RUN-01 data"
                return
            R["waiting"] = False
        sub = RUNIN_SAMPLE_S
        steps = max(1, int(round(dproc / sub)))
        h = dproc / steps
        for _ in range(steps):
            if not R["active"]:
                break
            self._runin_substep(h, dev)
        self._runin_outbox()

    def _runin_substep(self, h, dev):
        R, F, rng = self.runin, self._faults(), self.rng
        n_set = R["rpm_set"]
        if R["sim"]:
            # ---- thermal model (first order, same constants as asmsp.js runinSim, time in minutes)
            ramp = 50.0 * h                                     # 50 rpm/s
            R["rpm"] += max(-ramp * 4, min(ramp, n_set - R["rpm"]))
            fr = max(0.0, R["rpm"] / NMAX)
            _, Feff = self._feff()
            pf = (Feff / DES["Fpre"]) ** 0.6
            Tss = 14 * fr ** 1.2 * pf + (2.5 * fr if "dirt" in F else 0)
            ch = R["C0"] * fr * self.unit["ctx"].get("chK", 1.0) * math.exp(-(R["tS"] / 60) / R["tau_c"]) if R["running"] else 0
            m = h / 60
            R["dTf"] += (Tss + ch - R["dTf"]) * min(1, m / 9)
            R["dTr"] += (0.7 * Tss + 0.5 * ch - R["dTr"]) * min(1, m / 10)
            R["dTs"] += (4 * fr + 22 * fr ** 1.5 - R["dTs"]) * min(1, m / 15)
            R["dTw"] += (DES["Ploss"] * 1000 / (DES["Qw"] / 60 * 4186) * fr ** 1.5 + 0.2 - R["dTw"]) * min(1, m / 2)
            R["win"] = 20.0 + rng.gauss(0, 0.03)
            R["flow"] = DES["Qw"] + rng.gauss(0, 0.03)
            vib = 0.12 + 0.30 * fr ** 2 + rng.gauss(0, 0.015)
            if "dirt" in F:
                vib += 1.5 * fr ** 1.5 + abs(rng.gauss(0, 0.15)) * fr
            if "rotor" in F:
                vib += 0.9 * fr ** 2
            if "mix" in F:
                vib += 0.3 * fr
            R["vib"] = max(0.02, vib)
            dT = R["dTf"]
            vals = {"rpm": round(R["rpm"]), "t_front_c": round(R["win"] + dT + rng.gauss(0, 0.03), 2),
                    "t_rear_c": round(R["win"] + R["dTr"] + rng.gauss(0, 0.03), 2),
                    "t_stator_c": round(R["win"] + R["dTs"] + rng.gauss(0, 0.05), 2), "t_win_c": round(R["win"], 2),
                    "t_wout_c": round(R["win"] + R["dTw"], 2), "vib_mm_s": round(R["vib"], 3), "flow_lpm": round(R["flow"], 2)}
            dev["last"] = vals
            dev["seen"] = time.time()
        else:
            v = dev["last"]
            try:
                R["rpm"] = float(v.get("rpm", 0))
                R["win"] = float(v.get("t_win_c", 20))
                dT = float(v.get("t_front_c", R["win"])) - R["win"]
                R["dTf"] = dT
                R["dTr"] = float(v.get("t_rear_c", R["win"])) - R["win"]
                R["dTs"] = float(v.get("t_stator_c", R["win"])) - R["win"]
                R["dTw"] = float(v.get("t_wout_c", R["win"])) - R["win"]
                R["vib"] = float(v.get("vib_mm_s", 0))
                R["flow"] = float(v.get("flow_lpm", DES["Qw"]))
            except (TypeError, ValueError):
                return
        R["elapsed"] += h
        R["tS"] += h
        R["dT_max"] = max(R["dT_max"], dT)
        # rate (K/min) = slope over the last 120 s process time
        R["hist"].append((R["elapsed"], dT))
        old = next((p for p in R["hist"] if p[0] >= R["elapsed"] - 120), R["hist"][0])
        R["rate"] = (dT - old[1]) / max(1e-6, (R["elapsed"] - old[0])) * 60 if R["elapsed"] > old[0] else 0.0
        # sample every 5 s
        if R["elapsed"] - R["last_sample"] >= RUNIN_SAMPLE_S - 1e-6:
            R["last_sample"] = R["elapsed"]
            self._samples.append((self.unit["sn"], R["run"], round(R["elapsed"], 1), time.time(), round(R["rpm"]),
                                  round(R["win"] + dT, 2), round(R["win"] + R["dTr"], 2), round(R["win"] + R["dTs"], 2),
                                  round(R["win"], 2), round(R["win"] + R["dTw"], 2), round(R["vib"], 3)))
        # ---- rules
        rules = R["rules"]
        last_i = len(RUNIN_PROFILE) - 1
        rules["vib"] = R["vib"] > RL["vib_stop"]
        rules["cool"] = R["flow"] < RL["flow_min"] or R["dTw"] > RL["dTw_max"]
        if rules["vib"] and R["rpm"] > 0:
            R["tripped"] = True
            self._alarm("alarm", f"Run-in STOP: vibration {R['vib']:.2f} mm/s > {RL['vib_stop']} at {R['rpm']:.0f} rpm – run-in aborted")
            self._runin_halt("vibration limit", results=True)
            return
        if rules["cool"] and R["rpm"] > 0:
            R["tripped"] = True
            self._alarm("alarm", f"Run-in STOP: cooling water fault (flow {R['flow']:.1f} l/min, ΔT water {R['dTw']:.1f} K)")
            self._runin_halt("cooling water fault", results=True)
            return
        if R["running"] and dT >= RL["stop"]:
            R["running"] = False
            R["cooling"] = True
            R["stops"] += 1
            R["rpm_set"] = 0.0
            self.unit["ctx"]["chK"] = self.unit["ctx"].get("chK", 1.0) * 0.55     # grease pushed out a little more each time
            rules["stop"] = True
            self._alarm("warn", f"Run-in stop {R['stops']}: front bearing ΔT {dT:.1f} K ≥ {RL['stop']:.0f} K at "
                                f"{RUNIN_PROFILE[R['i']][0]} rpm – cooling down to {RL['resume']:.0f} K")
            R["msg"] = f"stop {R['stops']} – cooling"
        elif R["cooling"] and dT <= RL["resume"]:
            R["cooling"] = False
            R["running"] = True
            rules["stop"] = False
            R["tS"] = 0.0
            R["rpm_set"] = float(RUNIN_PROFILE[R["i"]][0])
            R["msg"] = f"restart step {R['i'] + 1}"
            self._event(f"Run-in: ΔT {dT:.1f} K ≤ {RL['resume']:.0f} K – restart at {RUNIN_PROFILE[R['i']][0]} rpm", "system")
        if not R["running"]:
            return
        rules["hold_dT"] = dT > RL["hold_dT"]
        rules["hold_rate"] = R["rate"] > RL["hold_rate"]
        hold = rules["hold_dT"] or rules["hold_rate"]
        dwell = RUNIN_PROFILE[R["i"]][1] * 60
        if R["i"] == last_i:
            R["end_buf"].append((dT, R["vib"]))
            if (R["tS"] >= dwell and not hold and abs(R["rate"]) < 0.1) or R["tS"] >= RUNIN_MAX_DWELL_MIN * 60:
                R["msg"] = "finished"
                R["finished"] = True
                R["active"] = False
                R["running"] = False
                R["rpm_set"] = 0.0
                self._runin_results(aborted=False)
                self._alarm("info", f"Run-in finished: {R['stops']} stops, ΔT max {R['dT_max']:.1f} K, {R['elapsed'] / 3600:.2f} h")
            return
        if not hold and ((R["tS"] >= dwell and abs(R["rate"]) < RL["stable_rate"]) or R["tS"] >= RUNIN_MAX_DWELL_MIN * 60):
            R["i"] += 1
            R["tS"] = 0.0
            R["rpm_set"] = float(RUNIN_PROFILE[R["i"]][0])
            R["msg"] = f"step {R['i'] + 1} / {len(RUNIN_PROFILE)}"
            self._event(f"Run-in step {R['i'] + 1}: {RUNIN_PROFILE[R['i']][0]} rpm (ΔT {dT:.1f} K stable)", "system")

    def _runin_results(self, aborted):
        R = self.runin
        src = "sim" if R["sim"] else "device:RUN-01"
        buf = list(R["end_buf"])[-24:] if R["end_buf"] else [(R["dTf"], R["vib"])]
        dT_end = R["dTf"] if aborted else sum(p[0] for p in buf) / len(buf)
        vib_end = R["vib"] if aborted else sum(p[1] for p in buf) / len(buf)
        vals = {"runin.dT_max": R["dT_max"], "runin.stops": R["stops"], "runin.time_h": R["elapsed"] / 3600,
                "runin.dT_end": dT_end, "runin.vib_end": vib_end}
        for cid, v in vals.items():
            if self.unit["results"].get(cid, {}).get("st", "pending") == "pending":
                self._set_result(cid, round(float(v), 3), src, "RUN-01")
        self._update_step_state()

    def _flush_samples(self):
        if self._samples:
            self.db.executemany("INSERT INTO runin_samples VALUES(?,?,?,?,?,?,?,?,?,?,?)", self._samples)
            self._samples = []

    # ------------------------------------------------------------------------------- views
    def _steps_view(self):
        out = []
        for i, (k, n, ph, t, checks) in enumerate(STEPS):
            out.append({"k": k, "no": i + 1, "n": n, "ph": ph, "t_min": t, "insp": k in INSPECTOR_STEPS,
                        "checks": [{kk: vv for kk, vv in c.items()} for c in checks]})
        return out

    def _kpi(self):
        now = time.time()
        if self._kpi_cache[1] is not None and now - self._kpi_cache[0] < 2:
            return self._kpi_cache[1]
        q = self.db.execute
        units = q("SELECT COUNT(*) FROM units").fetchone()[0]
        acc = q("SELECT COUNT(*) FROM units WHERE status='accepted'").fetchone()[0]
        rej = q("SELECT COUNT(*) FROM units WHERE status='rejected'").fetchone()[0]
        fp = q("SELECT COUNT(*) FROM units u WHERE status='accepted' AND NOT EXISTS (SELECT 1 FROM ncr n WHERE n.sn=u.sn)").fetchone()[0]
        lead = q("SELECT AVG(finished-started) FROM units WHERE status='accepted'").fetchone()[0]
        open_ncr = q("SELECT COUNT(*) FROM ncr WHERE closed=0").fetchone()[0]
        ncr_total = q("SELECT COUNT(*) FROM ncr").fetchone()[0]
        k = {"units": units, "accepted": acc, "rejected": rej, "in_work": units - acc - rej,
             "fpy": round(fp / (acc + rej), 3) if acc + rej else None,
             "yield": round(acc / (acc + rej), 3) if acc + rej else None,
             "avg_lead_h": round(lead / 3600, 3) if lead else None, "open_ncr": open_ncr, "ncr_total": ncr_total}
        self._kpi_cache = (now, k)
        return k

    def _runin_view(self):
        R = self.runin
        prof = RUNIN_PROFILE
        if not R:
            return {"active": False, "phase": "", "rpm": 0, "rpm_set": 0, "profile": prof, "elapsed_s": 0,
                    "T": {"front": None, "rear": None, "stator": None, "win": None, "wout": None},
                    "dT": 0, "rate_k_min": 0, "vib": 0, "stops": 0, "time_factor": self._runin_factor(),
                    "source": "sim" if self.devices["RUN-01"]["proto"] == "sim" else self.devices["RUN-01"]["proto"],
                    "rules": [{"id": k, "n": n, "on": False} for k, n in RUNIN_RULES], "msg": "", "run": 0}
        w = R["win"]
        return {"active": R["active"], "phase": f"step {R['i'] + 1} / {len(prof)}" + (" – cooling" if R["cooling"] else ""),
                "step_i": R["i"], "rpm": round(R["rpm"]), "rpm_set": round(R["rpm_set"]), "profile": prof,
                "elapsed_s": round(R["elapsed"], 1), "step_s": round(R["tS"], 1),
                "T": {"front": round(w + R["dTf"], 2), "rear": round(w + R["dTr"], 2), "stator": round(w + R["dTs"], 2),
                      "win": round(w, 2), "wout": round(w + R["dTw"], 2)},
                "dT": round(R["dTf"], 2), "dT_max": round(R["dT_max"], 2), "rate_k_min": round(R["rate"], 3),
                "vib": round(R["vib"], 3), "flow_lpm": round(R["flow"], 2), "stops": R["stops"], "cooling": R["cooling"],
                "tripped": R["tripped"], "finished": R["finished"], "waiting": R["waiting"], "run": R["run"],
                "time_factor": self._runin_factor(), "source": "sim" if R["sim"] else self.devices["RUN-01"]["proto"],
                "msg": R["msg"], "rules": [{"id": k, "n": n, "on": R["rules"][k]} for k, n in RUNIN_RULES]}

    def _unit_view(self):
        u = self.unit
        if not u:
            return None
        k = STEP_KEYS[u["si"]]
        uu = 0.0
        if u["step_state"] == "wait_confirm" or u["step_state"] == "done":
            uu = 1.0
        elif u["step_state"] == "running":
            if k == "runin" and self.runin:
                R = self.runin
                uu = (R["i"] + min(1.0, R["tS"] / (RUNIN_PROFILE[R["i"]][1] * 60))) / len(RUNIN_PROFILE)
            else:
                req = [c for c in STEPS[u["si"]][4] if c["req"]]
                done = sum(1 for c in req if u["results"].get(c["id"], {}).get("st", "pending") != "pending")
                uu = done / max(1, len(req))
                if self.sim["auto"] and self.sim["on"]:
                    uu = max(uu, min(1.0, (time.time() - self.auto["t0"]) / max(0.1, self.auto["dur"])))
            uu = min(0.95, uu)
        return {"sn": u["sn"], "wo": u["wo"], "shaft_sn": u["shaft_sn"], "status": u["status"], "si": u["si"],
                "step": k, "step_state": u["step_state"], "u": round(uu, 3), "started": u["started"],
                "finished": u["finished"], "step_started": u.get("step_t0"),
                "results": u["results"], "signed": u["signed"], "ncr": u["ncr"],
                "repaired": u["ctx"].get("repaired", [])}

    def _devices_view(self):
        now = time.time()
        out = []
        for d in self.devices.values():
            st = "sim" if d["proto"] == "sim" else ("online" if d["enabled"] and now - d["seen"] <= OFFLINE_S else "offline")
            out.append({"id": d["id"], "n": d["n"], "type": d["type"], "proto": d["proto"], "addr": d["addr"],
                        "enabled": d["enabled"], "state": st, "last": d["last"], "seen": d["seen"], "err": d["err"],
                        "values": d["values"]})
        return out

    def state(self):
        with self.lock:
            q = [{"wo": wo, "qty": qty, "done": done, "due": due} for wo, qty, done, due in self.db.execute(
                "SELECT wo, qty, done, due FROM workorders WHERE status='open' ORDER BY due")]
            return {"t": time.time(), "station": STATION, "sim": dict(self.sim), "user": self.user,
                    "steps": self._steps_cache(), "unit": self._unit_view(), "devices": self._devices_view(),
                    "runin": self._runin_view(),
                    "alarms": list(reversed(self.alarms))[:30],
                    "events": list(reversed(self.events))[:30],
                    "queue": q, "kpi": self._kpi(), "faults_available": list(FAULTS)}

    def _steps_cache(self):
        if not hasattr(self, "_steps_v"):
            self._steps_v = self._steps_view()
        return self._steps_v

    def state_json(self):
        return json.dumps(self.state())

    # ------------------------------------------------------------------------------- history endpoints
    def units(self, limit=200):
        with self.lock:
            out = []
            for sn, wo, shaft, status, started, finished in self.db.execute(
                    "SELECT sn, wo, shaft_sn, status, started, finished FROM units ORDER BY started DESC LIMIT ?", (limit,)):
                nc = self.db.execute("SELECT COUNT(*) FROM ncr WHERE sn=?", (sn,)).fetchone()[0]
                out.append({"sn": sn, "wo": wo, "shaft_sn": shaft, "status": status, "started": started, "finished": finished,
                            "lead_h": round((finished - started) / 3600, 3) if finished else None,
                            "fpy": (status == "accepted" and nc == 0) if status in ("accepted", "rejected") else None,
                            "ncr": nc})
            return out

    def unit_record(self, sn):
        with self.lock:
            r = self.db.execute("SELECT sn, wo, shaft_sn, status, si, step_state, started, finished FROM units WHERE sn=?",
                                (sn,)).fetchone()
            if not r:
                raise KeyError(sn)
            unit = dict(zip(("sn", "wo", "shaft_sn", "status", "si", "step_state", "started", "finished"), r))
            unit["lead_h"] = round((unit["finished"] - unit["started"]) / 3600, 3) if unit["finished"] else None
            res = []
            for cid, step, v, st, src, user, t, sup in self.db.execute(
                    "SELECT check_id, step, v, st, src, user, t, superseded FROM results WHERE sn=? ORDER BY id", (sn,)):
                c = CHECKS.get(cid, (0, {}))[1]
                res.append({"id": cid, "step": step, "n": c.get("n", ""), "unit": c.get("unit", ""), "lo": c.get("lo"),
                            "hi": c.get("hi"), "v": json.loads(v), "st": st, "src": src, "user": user, "t": t,
                            "superseded": bool(sup)})
            sig = [dict(zip(("si", "step", "user", "role", "t"), x)) for x in self.db.execute(
                "SELECT si, step, user, role, t FROM signatures WHERE sn=? ORDER BY id", (sn,))]
            ncr = [dict(zip(("id", "check", "decision", "text", "user", "role", "t", "closed"), x)) for x in self.db.execute(
                "SELECT id, check_id, decision, text, user, role, t, closed FROM ncr WHERE sn=? ORDER BY t", (sn,))]
            ev = [dict(zip(("t", "user", "text"), x)) for x in self.db.execute(
                "SELECT t, user, text FROM events WHERE sn=? ORDER BY id", (sn,))]
            dl = [{"t": t, "device": d, "values": json.loads(v), "src": s, "mapped": m} for t, d, v, s, m in self.db.execute(
                "SELECT t, device, vals, src, mapped FROM device_log WHERE sn=? ORDER BY id DESC LIMIT 500", (sn,))]
            runs = self.db.execute("SELECT COUNT(DISTINCT run) FROM runin_samples WHERE sn=?", (sn,)).fetchone()[0]
            return {"unit": unit, "results": res, "signatures": sig, "ncr": ncr, "events": ev, "device_log": dl,
                    "runin_runs": runs}

    def spc(self, cid):
        if cid not in CHECKS:
            raise KeyError(cid)
        _, c = CHECKS[cid]
        if c["kind"] != "num":
            raise ValueError(f"{cid} is not a numeric check")
        with self.lock:
            rows = self.db.execute("SELECT sn, v, t FROM results WHERE check_id=? AND superseded=0 ORDER BY t", (cid,)).fetchall()
        vals = []
        for sn, v, t in rows:
            try:
                vals.append({"sn": sn, "v": float(json.loads(v)), "t": t})
            except (TypeError, ValueError):
                pass
        xs = [p["v"] for p in vals]
        mean = statistics.fmean(xs) if xs else None
        sigma = statistics.stdev(xs) if len(xs) >= 2 else None
        lo, hi = c.get("lo"), c.get("hi")
        cpk = None
        if sigma and sigma > 0 and (lo is not None or hi is not None):
            parts = []
            if hi is not None:
                parts.append((hi - mean) / (3 * sigma))
            if lo is not None:
                parts.append((mean - lo) / (3 * sigma))
            cpk = round(min(parts), 3)
        cp = round((hi - lo) / (6 * sigma), 3) if sigma and lo is not None and hi is not None and hi > lo else None
        return {"id": cid, "n": len(xs), "name": c["n"], "unit": c["unit"], "lo": lo, "hi": hi, "values": vals,
                "mean": round(mean, 4) if mean is not None else None, "sigma": round(sigma, 4) if sigma is not None else None,
                "cpk": cpk, "cp": cp,
                "note": "Cpk needs ≥ 25–30 units of a stable process to be meaningful (check)" if len(xs) < 25 else ""}

    def runin_samples(self, sn, run=None):
        with self.lock:
            if run is None:
                r = self.db.execute("SELECT MAX(run) FROM runin_samples WHERE sn=?", (sn,)).fetchone()
                run = r[0] if r and r[0] is not None else 0
            rows = self.db.execute("SELECT t, rpm, tf, tr, ts, win, wout, vib FROM runin_samples WHERE sn=? AND run=? ORDER BY t",
                                   (sn, run)).fetchall()
            runs = [x[0] for x in self.db.execute("SELECT DISTINCT run FROM runin_samples WHERE sn=? ORDER BY run", (sn,))]
        return {"sn": sn, "run": run, "runs": runs,
                "samples": [dict(zip(("t", "rpm", "tf", "tr", "ts", "win", "wout", "vib"), x)) for x in rows]}

    def export_csv(self):
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["sn", "wo", "unit_status", "step", "check_id", "check", "value", "unit", "lo", "hi", "status",
                    "source", "user", "time", "superseded"])
        with self.lock:
            rows = self.db.execute("""SELECT r.sn, u.wo, u.status, r.step, r.check_id, r.v, r.st, r.src, r.user, r.t, r.superseded
                                      FROM results r LEFT JOIN units u ON u.sn = r.sn ORDER BY r.id""").fetchall()
        for sn, wo, ust, step, cid, v, st, src, user, t, sup in rows:
            c = CHECKS.get(cid, (0, {}))[1]
            w.writerow([sn, wo, ust, step, cid, c.get("n", ""), json.loads(v), c.get("unit", ""), c.get("lo"), c.get("hi"),
                        st, src, user, time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(t)), sup])
        return buf.getvalue()
