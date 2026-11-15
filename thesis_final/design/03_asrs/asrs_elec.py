#!/usr/bin/env python3
"""Final thesis item F3, sub-task B - electrical design and safety of the AS/RS (one aisle, one stacker crane).

Python 3 standard library only, offline. Input: out/design_result.json (python asrs_design.py run).
Outputs (out/elec/): devices.csv, io_list.csv, cables.csv, calc_report.md, safety.csv, P01..P10 *.svg schematics.
Guide: Doctor paper/60_final_asrs.md (electrical + safety part). Tag style = docs/33 (IEC 81346-2, =ASRS1).

DESIGN - to be checked and released by a qualified electrical engineer (IEC 60204-1 / -32, IEC 60364) and the safety
functions by a qualified safety engineer (ISO 13849-1/-2, EN 528). Catalogue types are classes ('or equal').

Commands
  python asrs_elec.py selftest
  python asrs_elec.py run [--out out/elec]

Formulas (chapter numbers of the guide part)
  motor current      I_n = P / (sqrt3 * U * cos_phi * eta)
  crane currents     I_th = (k_s * sum P_n + P_aux) / (sqrt3 U cos_phi_in eta_dr) ; I_pk = (sum P_peak + P_aux) / (...)
  fuse (gG)          I_n >= I_b and I_n >= I_pk / 1.5 ; cable I_z >= 1.6 I_n / 1.45 (IEC 60364-4-43, I2 <= 1.45 Iz)
  MCB / MCCB         I_z >= I_n (I2 = 1.45 I_n)
  voltage drop       dU% = sqrt3 * I * L * (R cos_phi + X sin_phi) / U * 100 , R = 1.2 * 18.3/A ohm/km (70 C), X 0.08
  rail               I_rail >= 1.25 I_th and >= I_pk / 1.5 ; dU(x) with R' X' of the rail
  fault loop         Z_s <= 0.8 * U0 / I_a  (IEC 60364-4-41, measured value rule)
  brake resistor     P_brk = m_h (g+a) v eta + (m a - F_roll) v eta ; R <= U_on^2 / (1.2 P_brk)
                     E_cycle = 2 m_h g (h/2) eta + 2 (1/2 m v^2 - F_roll s) eta ; P_avg = E_cycle / t_SC
  24 V PSU           I_PSU >= 1.25 * sum I_device
  ISO 13849-1        n_op = d_op h_op 3600 / t_cycle ; MTTFd = B10d / (0.1 n_op) (cap 100 a) ;
                     Cat 3/4 symmetrisation MTTFd = 2/3 (C1 + C2 - 1/(1/C1 + 1/C2)) ; DCavg = sum(DC_i/MTTFd_i)/sum(1/MTTFd_i)
                     PL by the simplified bar chart (Figure 5) ; combination of subsystems Table 11
"""

import argparse
import csv
import json
import math
import os
import sys
import xml.dom.minidom

HERE = os.path.dirname(os.path.abspath(__file__))
U, U0, G = 400.0, 230.0, 9.81
SQ3 = math.sqrt(3)

# ----------------------------------------------------------------------------- catalogue data (typical IE3 4-pole)
MOTOR_DATA = {0.37: (0.73, 0.70), 0.55: (0.75, 0.78), 0.75: (0.77, 0.80), 1.1: (0.80, 0.845), 1.5: (0.80, 0.855),
              2.2: (0.81, 0.866), 3.0: (0.81, 0.877), 4.0: (0.82, 0.886), 5.5: (0.82, 0.896), 7.5: (0.83, 0.904),
              11.0: (0.84, 0.914), 15.0: (0.85, 0.921)}          # kW: (cos_phi, eta) IEC 60034-30-1 IE3 typical
INVERTER_KW = [0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5, 11.0, 15.0, 18.5, 22.0, 30.0]
INV_CURRENT = {0.37: 1.3, 0.55: 1.7, 0.75: 2.2, 1.1: 3.1, 1.5: 4.1, 2.2: 5.6, 3.0: 7.3, 4.0: 8.8, 5.5: 12.5, 7.5: 16.5,
               11.0: 25.0, 15.0: 31.0, 18.5: 38.0, 22.0: 45.0, 30.0: 60.0}   # rated output current A (heavy duty, 400 V)
FUSES = [2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125]
CABLE_IZ = {1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 96, 35: 119}   # IEC 60364-5-52 B.52.4 method C, PVC, 3 loaded
RAIL_CLASSES = [(25, 2.4, 0.22), (40, 1.60, 0.20), (63, 1.05, 0.18), (100, 0.62, 0.16)]  # A, R' ohm/km, X' ohm/km (assumption)
R_STD = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82, 100]
PSU_A = [5, 10, 20, 40]
BRES_KW = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12]

PARAM = {"L_supply_m": 40.0, "Z_up_ohm": 0.150, "k_theta_40C": 0.87, "k_chain": 0.80, "cos_in": 0.95, "eta_dr": 0.97,
         "k_s": 0.6, "P_aux_kW": 1.5, "U_on": 750.0, "R_min_chopper": 15.0, "d_op": 220, "h_op": 16,
         "conv_kW": 0.75, "n_conv": 3, "P_stat_kVA": 1.0, "lighting_kVA": 1.0, "crane_wiring_m": 6.0}


def load_design(path=None):
    path = path or os.path.join(HERE, "out", "design_result.json")
    if not os.path.exists(path):
        raise SystemExit("run 'python asrs_design.py run' first (missing %s)" % path)
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# ----------------------------------------------------------------------------- 1 electrical calculations
def motor_current(P_kW):
    cph, eta = MOTOR_DATA[P_kW]
    return P_kW * 1000 / (SQ3 * U * cph * eta)


def pick(lst, x):
    for v in lst:
        if v >= x - 1e-9:
            return v
    raise ValueError("no size >= %.2f" % x)


def r70(A):
    return 1.2 * 18.3 / A / 1000.0          # ohm per m


def du_pct(I, L, A=None, Rpm=None, Xpm=0.00008, cphi=0.9):
    R = r70(A) if Rpm is None else Rpm
    s = math.sqrt(1 - cphi ** 2)
    return SQ3 * I * L * (R * cphi + Xpm * s) / U * 100


def size_cable(I_b, I_n, L, kind="fuse", k=1.0, du_max=3.0, I_du=None, cphi=0.9):
    """Smallest cross-section that meets I_z (protection) and the voltage drop at I_du (default I_b)."""
    need = 1.6 * I_n / 1.45 if kind == "fuse" else I_n
    for A, iz in sorted(CABLE_IZ.items()):
        if iz * k >= need and du_pct(I_du or I_b, L, A, cphi=cphi) <= du_max:
            return A, iz * k, du_pct(I_du or I_b, L, A, cphi=cphi)
    raise ValueError("no cable for %.1f A over %.0f m" % (I_b, L))


def calc(D):
    dr = D["crane"]["drives"]
    cri = D["crane"]["input"]
    mass = D["crane"]["mass"]
    rack = D["rack"]
    out = {}
    axes = {"travel": ("-MA11", "-TA11"), "hoist": ("-MA13", "-TA13"), "fork": ("-MA14", "-TA14")}
    motors = {}
    for ax, (mt, it) in axes.items():
        Pn = dr[ax]["motor_kW"]
        Ppk = dr[ax].get("P_peak_kW", dr[ax].get("P_kW", Pn))
        In = motor_current(Pn)
        Ipk = In * max(1.0, Ppk / Pn)
        inv = pick(INVERTER_KW, Pn)
        while INV_CURRENT[inv] < In or 1.5 * INV_CURRENT[inv] < Ipk:
            inv = INVERTER_KW[INVERTER_KW.index(inv) + 1]
        L_m = {"travel": 4.0, "hoist": 4.0, "fork": rack["rack_height_m"] + 3.0}[ax]   # fork motor on the carriage: drag chain up the mast
        A, iz, du = size_cable(In, In, L_m, kind="mcb", k=PARAM["k_theta_40C"] * (PARAM["k_chain"] if ax == "fork" else 1.0),
                               du_max=3.0, cphi=MOTOR_DATA[Pn][0])
        motors[ax] = {"motor": mt, "inverter": it, "P_n": Pn, "P_pk": Ppk, "I_n": In, "I_pk": Ipk, "inv_kW": inv,
                      "inv_I": INV_CURRENT[inv], "cable_mm2": max(A, 1.5), "cable_L": L_m, "cable_du": du}
    out["motors"] = motors
    # crane currents (shared DC link, diode infeed -TA10)
    sumPn = sum(m["P_n"] for m in motors.values())
    sumPpk = sum(m["P_pk"] for m in motors.values())
    den = SQ3 * U * PARAM["cos_in"] * PARAM["eta_dr"]
    I_th = (PARAM["k_s"] * sumPn + PARAM["P_aux_kW"]) * 1000 / den
    I_pk = (sumPpk + PARAM["P_aux_kW"]) * 1000 / den
    out["crane"] = {"sumPn": sumPn, "sumPpk": sumPpk, "I_th": I_th, "I_pk": I_pk,
                    "infeed_kW": pick(INVERTER_KW, sumPpk * 0.8)}
    # rail
    L_rail = rack["length_m"] + 4.0
    for amp, Rr, Xr in RAIL_CLASSES:
        if amp >= 1.25 * I_th and amp >= I_pk / 1.5:
            break
    du_rail = du_pct(I_pk, L_rail, Rpm=Rr / 1000, Xpm=Xr / 1000)
    out["rail"] = {"L": L_rail, "A": amp, "R": Rr, "X": Xr, "du_end": du_rail, "du_centre": du_rail / 2}
    # crane feeder -FC2 (MCCB) and main supply
    In2 = pick(FUSES, max(I_th, I_pk / 1.5))
    conv_In = motor_current(PARAM["conv_kW"])
    I_conv = PARAM["n_conv"] * conv_In
    I_stat = (PARAM["P_stat_kVA"] + PARAM["lighting_kVA"]) * 1000 / (SQ3 * U)
    I_b = I_th + I_conv + I_stat
    I_pk_tot = I_pk + I_conv + I_stat
    In0 = pick(FUSES, max(I_b, I_pk_tot / 1.5))
    A0, iz0, du0 = size_cable(I_b, In0, PARAM["L_supply_m"], kind="fuse", k=PARAM["k_theta_40C"], du_max=3.0, I_du=I_pk_tot)
    S = SQ3 * U * I_b / 1000
    S_pk = SQ3 * U * I_pk_tot / 1000
    out["supply"] = {"I_conv": I_conv, "I_stat": I_stat, "I_b": I_b, "I_pk": I_pk_tot, "fuse": In0, "cable_mm2": A0,
                     "I_z": iz0, "du_supply": du0, "S_kVA": S, "S_pk_kVA": S_pk, "du_total_end": du0 + du_rail,
                     "main_switch_A": pick([32, 40, 63, 80, 100, 125], I_b * 1.25), "FC2_A": In2}
    # feeder cable ground cabinet -> rail feed point (5 m) for -FC2
    A2, iz2, du2 = size_cable(I_th, In2, 5.0, kind="mcb", k=PARAM["k_theta_40C"], I_du=I_pk)
    out["feeder_rail"] = {"mm2": A2, "I_z": iz2, "du": du2}
    # fault loop at the far end of the rail
    Rsup = 2 * PARAM["L_supply_m"] * r70(A0)
    Rrail = 2 * L_rail * Rr / 1000
    Rcr = 2 * PARAM["crane_wiring_m"] * r70(6)
    Zs = PARAM["Z_up_ohm"] + Rsup + Rrail + Rcr
    Ii = 10 * In2
    out["loop"] = {"Zs": Zs, "Ii": Ii, "Zs_max": 0.8 * U0 / Ii, "Ik1": 0.95 * U0 / Zs, "R_sup": Rsup, "R_rail": Rrail, "R_cr": Rcr,
                   "Ik3_gc": 1.05 * U / (SQ3 * PARAM["Z_up_ohm"] / 2 + 1e-9) / 1000}
    # brake resistor (shared DC link chopper)
    m_h = cri["m_carriage_kg"] + D["crate"]["max_gross_kg"]
    m_t = mass["m_crane"] + D["crate"]["max_gross_kg"]
    F_roll = cri["w_roll"] * m_t * G
    P_brk = m_h * (G + cri["a_z"]) * cri["v_z"] * cri["eta_H"] + (m_t * cri["a_x"] - F_roll) * cri["v_x"] * cri["eta_T"]
    R_max = PARAM["U_on"] ** 2 / (1.2 * P_brk)
    R_sel = max(r for r in R_STD if r <= R_max)
    h = rack["top_level_z_m"] - D["io"]["conveyor_top_m"]
    s = cri["v_x"] ** 2 / (2 * cri["a_x"])
    E_cycle = 2 * m_h * G * (h / 2) * cri["eta_H"] + 2 * (0.5 * m_t * cri["v_x"] ** 2 - F_roll * s) * cri["eta_T"]
    t_sc = D["crane"]["fem"]["SC"]
    P_avg = E_cycle / t_sc
    out["brake"] = {"m_h": m_h, "m_t": m_t, "F_roll": F_roll, "P_brk": P_brk, "R_max": R_max, "R_sel": R_sel,
                    "P_peak_R": PARAM["U_on"] ** 2 / R_sel, "h": h, "E_cycle": E_cycle, "t_sc": t_sc, "P_avg": P_avg,
                    "P_cont_kW": pick(BRES_KW, 1.25 * P_avg / 1000), "R_ok_min": R_sel >= PARAM["R_min_chopper"],
                    "E_full_lower_J": m_h * G * h * cri["eta_H"], "P_regen_design_kW": dr["hoist"]["P_regen_kW"]}
    # conveyors
    out["conv"] = {"I_n": conv_In, "inv_kW": pick(INVERTER_KW, PARAM["conv_kW"]), "n": PARAM["n_conv"]}
    return out


# ----------------------------------------------------------------------------- 2 devices, I/O, cables
def devices(C):
    m = C["motors"]
    D = [  # tag, description, type class, location, page, 24V mA, safety
        ("=ASRS1+GC-QB1", "Main switch 3-pole, lockable, AC-23B %d A" % C["supply"]["main_switch_A"], "rotary load-break switch", "+GC", "P02", 0, "no"),
        ("=ASRS1+GC-FC0", "Supply fuses gG %d A (in sub-distribution)" % C["supply"]["fuse"], "NH00 / D02 fuse", "sub-distribution", "P02", 0, "no"),
        ("=ASRS1+GC-FC1", "Surge protective device type 2 (SPD)", "SPD T2 3+NPE", "+GC", "P02", 0, "no"),
        ("=ASRS1+GC-FC2", "MCCB crane feeder I_r %d A, I_i 10 x I_r" % C["supply"]["FC2_A"], "MCCB 3-pole electronic trip", "+GC", "P02", 0, "no"),
        ("=ASRS1+GC-QB2", "Rail isolator lockable (LOTO for aisle work)", "load-break switch 3-pole", "+GC", "P02", 0, "no"),
        ("=ASRS1+GC-QA2", "Crane feeder contactor (2nd shutdown path, E-stop cat. 1)", "contactor AC-3 %d A + mirror contact" % pick(FUSES, C["crane"]["I_th"] * 1.3), "+GC", "P02", 0, "yes"),
        ("=ASRS1+GC-FC3", "MCB conveyors C16", "MCB 3-pole C", "+GC", "P02", 0, "no"),
        ("=ASRS1+GC-FC4", "MCB 24 V supply C6", "MCB 1-pole C", "+GC", "P02", 0, "no"),
        ("=ASRS1+GC-FC5", "RCBO 30 mA aisle light + service socket", "RCBO 2-pole B10 30 mA", "+GC", "P02", 0, "no"),
        ("=ASRS1+GC-TB1", "24 V DC PSU ground cabinet", "PSU 1-phase 24 V", "+GC", "P06", 0, "no"),
        ("=ASRS1+GC-KF2", "Safety PLC (F-CPU) PLC-ASRS1, PROFINET/PROFIsafe, Modbus TCP server", "S7-1500 CPU 1515F-2 PN or equal", "+GC", "P07", 900, "yes"),
        ("=ASRS1+GC-KF20", "ET 200SP interface ground station", "ET 200SP IM 155-6 PN HF or equal", "+GC", "P07", 500, "no"),
        ("=ASRS1+GC-KF21", "F-DI 8 x 24 V ground (E-stops, door, curtains)", "ET 200SP F-DI 8x24VDC", "+GC", "P07", 50, "yes"),
        ("=ASRS1+GC-KF22", "F-DQ 4 x 24 V/2 A PM ground (door lock, -QA2)", "ET 200SP F-DQ 4x24VDC/2A PM", "+GC", "P07", 50, "yes"),
        ("=ASRS1+GC-KF25", "DI 16 x 24 V ground", "ET 200SP DI 16x24VDC", "+GC", "P07", 30, "no"),
        ("=ASRS1+GC-KF26", "DQ 16 x 24 V/0.5 A ground", "ET 200SP DQ 16x24VDC/0.5A", "+GC", "P07", 30, "no"),
        ("=ASRS1+GC-KF27", "AI 4 x weighing / analogue ground", "ET 200SP AI 4xU/I or SIWAREX-class", "+GC", "P07", 60, "no"),
        ("=ASRS1+GC-KF28", "F-DI 8 x 24 V ground 2 (I/O curtains, fence door)", "ET 200SP F-DI 8x24VDC", "+GC", "P07", 50, "yes"),
        ("=ASRS1+GC-KF70", "Data light barrier ground side (PROFINET 100 Mbit/s)", "optical data transmission DDLS-class", "field (aisle end)", "P07", 250, "no"),
        ("=ASRS1+GC-KF90", "Managed switch 8-port, VLAN 720 uplink", "industrial managed switch (SCALANCE XC-class)", "+GC", "P10", 300, "no"),
        ("=ASRS1+GC-PF100", "HMI touch panel 12 in (ISA-101 screens)", "HMI 12 in PROFINET", "+GC door", "P10", 800, "no"),
        ("=ASRS1+GC-TA81", "Inverter infeed conveyor CV1 %.2f kW with STO" % C["conv"]["inv_kW"], "micro inverter with STO (G120C / i550 / MS300 class)", "+GC", "P09", 0, "yes"),
        ("=ASRS1+GC-TA82", "Inverter outfeed conveyor CV2 with STO", "micro inverter with STO", "+GC", "P09", 0, "yes"),
        ("=ASRS1+GC-TA83", "Inverter pick-station conveyor CV3 with STO", "micro inverter with STO", "+GC", "P09", 0, "yes"),
        ("=ASRS1+CV1-MA81", "Chain conveyor motor CV1 0.75 kW 4-pole + brake", "geared motor 0.75 kW", "field", "P09", 0, "no"),
        ("=ASRS1+CV2-MA82", "Chain conveyor motor CV2 0.75 kW + brake", "geared motor 0.75 kW", "field", "P09", 0, "no"),
        ("=ASRS1+CV3-MA83", "Pick conveyor motor CV3 0.75 kW + brake", "geared motor 0.75 kW", "field", "P09", 0, "no"),
        ("=ASRS1+CRANE-QA10", "Crane main contactor / circuit breaker in crane cabinet", "MPCB + contactor", "+CC", "P03", 0, "no"),
        ("=ASRS1+CRANE-RA10", "Line reactor 4 % uk", "3-phase reactor", "+CC", "P03", 0, "no"),
        ("=ASRS1+CRANE-TA10", "Infeed module (diode + brake chopper), shared DC link %.0f kW" % C["crane"]["infeed_kW"], "basic line module class", "+CC", "P03", 0, "no"),
        ("=ASRS1+CRANE-RA11", "Brake resistor %d ohm, %.1f kW continuous, IP20 with touch guard" % (C["brake"]["R_sel"], C["brake"]["P_cont_kW"]), "braking resistor", "crane (outside cabinet)", "P03", 0, "no"),
        ("=ASRS1+CRANE-TA11", "Inverter travel %.1f kW, I_rated %.1f A, STO/SS1/SLS via PROFIsafe, SBC" % (m["travel"]["inv_kW"], m["travel"]["inv_I"]), "inverter with STO/SS1/SLS (SINAMICS G120 / Lenze i550 / Delta MS300 class)", "+CC", "P03", 0, "yes"),
        ("=ASRS1+CRANE-TA13", "Inverter hoist %.1f kW, I_rated %.1f A, STO/SS1/SLS/SBC, brake test" % (m["hoist"]["inv_kW"], m["hoist"]["inv_I"]), "inverter with STO/SS1/SLS/SBC", "+CC", "P04", 0, "yes"),
        ("=ASRS1+CRANE-TA14", "Inverter fork %.2f kW, I_rated %.1f A, STO" % (m["fork"]["inv_kW"], m["fork"]["inv_I"]), "inverter with STO", "+CC", "P05", 0, "yes"),
        ("=ASRS1+CRANE-MA11", "Travel geared motor %.1f kW 4-pole IE3, I_n %.1f A" % (m["travel"]["P_n"], m["travel"]["I_n"]), "helical-bevel geared motor", "crane bottom frame", "P03", 0, "no"),
        ("=ASRS1+CRANE-MB11", "Travel motor brake 205 V DC (via rectifier, SBC)", "spring-applied brake", "crane", "P03", 0, "yes"),
        ("=ASRS1+CRANE-BG11", "Travel motor encoder HTL 1024 ppr", "incremental encoder", "crane", "P03", 0, "yes"),
        ("=ASRS1+CRANE-MA13", "Hoist geared motor %.1f kW 4-pole IE3, I_n %.1f A" % (m["hoist"]["P_n"], m["hoist"]["I_n"]), "hoist-duty geared motor", "crane bottom frame", "P04", 0, "no"),
        ("=ASRS1+CRANE-MB13", "Hoist brake 1 (motor brake) + release monitoring", "spring-applied brake", "crane", "P04", 0, "yes"),
        ("=ASRS1+CRANE-MB15", "Hoist brake 2 (drum / second brake) + release monitoring", "spring-applied brake", "crane", "P04", 0, "yes"),
        ("=ASRS1+CRANE-BG13", "Hoist motor encoder HTL 1024 ppr (safe speed channel 1)", "incremental encoder", "crane", "P04", 0, "yes"),
        ("=ASRS1+CRANE-MA14", "Fork geared motor %.2f kW + brake" % m["fork"]["P_n"], "geared motor", "carriage", "P05", 0, "no"),
        ("=ASRS1+CRANE-BG14", "Fork motor encoder", "incremental encoder", "carriage", "P05", 0, "no"),
        ("=ASRS1+CRANE-TB10", "24 V DC PSU crane + buffer module", "PSU 3-phase 24 V + capacitor buffer", "+CC", "P06", 0, "no"),
        ("=ASRS1+CRANE-KF30", "ET 200SP interface crane station (PROFINET via data light barrier)", "ET 200SP IM 155-6 PN HF", "+CC", "P07", 500, "no"),
        ("=ASRS1+CRANE-KF23", "F-DI 8 x 24 V crane 1 (final limits, E-stops)", "ET 200SP F-DI 8x24VDC", "+CC", "P07", 50, "yes"),
        ("=ASRS1+CRANE-KF24", "F-DI 8 x 24 V crane 2 (slack rope, catch, overload, enabling)", "ET 200SP F-DI 8x24VDC", "+CC", "P07", 50, "yes"),
        ("=ASRS1+CRANE-KF31", "DI 16 x 24 V crane 1", "ET 200SP DI 16x24VDC", "+CC", "P07", 30, "no"),
        ("=ASRS1+CRANE-KF34", "DI 16 x 24 V crane 2", "ET 200SP DI 16x24VDC", "+CC", "P07", 30, "no"),
        ("=ASRS1+CRANE-KF32", "DQ 8 x 24 V crane", "ET 200SP DQ 8x24VDC/0.5A", "+CC", "P07", 30, "no"),
        ("=ASRS1+CRANE-KF35", "Load monitor (overload relay) for -BW35", "load monitoring relay PL c", "+CC", "P08", 80, "yes"),
        ("=ASRS1+CRANE-BW35", "Load cell / load pin hoist rope anchor", "load pin 20 kN", "carriage", "P08", 20, "yes"),
        ("=ASRS1+CRANE-KF71", "Data light barrier crane side", "optical data transmission DDLS-class", "crane", "P07", 250, "no"),
        ("=ASRS1+CRANE-BG15", "Laser distance meter travel (0-%.0f m, +-2 mm, PROFINET)" % (D_LEN[0] + 5), "laser distance meter AMS/DL-class", "crane bottom", "P08", 250, "no"),
        ("=ASRS1+CRANE-BG45", "Barcode position system hoist (+-1 mm, PROFINET), safe speed channel 2", "bar-code positioning BPS/OLM-class", "carriage", "P08", 250, "yes"),
        ("=ASRS1+CRANE-XD10", "Current collector trolley 4-pole + double PE", "collector for enclosed conductor rail", "crane", "P02", 0, "no"),
        ("=ASRS1+AISLE-WD1", "Enclosed conductor rail %d A, 4-pole + PE, L = %.1f m, end feed" % (C["rail"]["A"], C["rail"]["L"]), "enclosed conductor rail (VAHLE U10 / Conductix 0815 class)", "aisle", "P02", 0, "no"),
    ]
    return D


D_LEN = [40.0]


def io_list():
    """address, tag, description, type, device (module), safety, page, mA."""
    L = []

    def add(addr, tag, desc, typ, dev, saf, page, mA=30):
        L.append((addr, tag, desc, typ, dev, saf, page, mA))

    # ---- crane F-DI (2-channel = two addresses)
    fdi_c = [("-BG18", "travel final limit front (forced NC, 2 ch)"), ("-BG19", "travel final limit rear (forced NC, 2 ch)"),
             ("-BG37", "hoist upper final limit (forced NC, 2 ch)"), ("-BG39", "hoist lower final limit (forced NC, 2 ch)")]
    for i, (t, d) in enumerate(fdi_c):
        add("%%I20.%d" % (2 * i), "=ASRS1+CRANE" + t + ".1", d + " channel 1", "F-DI", "-KF23", "yes", "P08")
        add("%%I20.%d" % (2 * i + 1), "=ASRS1+CRANE" + t + ".2", d + " channel 2", "F-DI", "-KF23", "yes", "P08")
    fdi_c2 = [("-SF53", "E-stop crane cabinet (2 ch)"), ("-SF54", "E-stop crane maintenance platform (2 ch)"),
              ("-BG34", "slack rope switch (2 ch)"), ("-BG30", "safety catch / overspeed governor contact (2 ch)")]
    for i, (t, d) in enumerate(fdi_c2):
        add("%%I21.%d" % (2 * i), "=ASRS1+CRANE" + t + ".1", d + " channel 1", "F-DI", "-KF24", "yes", "P06" if t.startswith("-SF") else "P08")
        add("%%I21.%d" % (2 * i + 1), "=ASRS1+CRANE" + t + ".2", d + " channel 2", "F-DI", "-KF24", "yes", "P06" if t.startswith("-SF") else "P08")
    # ---- crane DI
    di_c = [("-BG16", "travel slow-down front"), ("-BG17", "travel slow-down rear"), ("-BG36", "hoist upper slow-down"),
            ("-BG38", "hoist lower slow-down"), ("-BG21", "fork centre position"), ("-BG22", "fork left end"),
            ("-BG23", "fork right end"), ("-BG24", "fork left pre-end (slow)"), ("-BG25", "fork right pre-end (slow)"),
            ("-BG26", "load on fork left"), ("-BG27", "load on fork right"), ("-BG28", "crate protrusion front (across carriage)"),
            ("-BG29", "crate protrusion rear (across carriage)"), ("-BG40", "double-occupancy check left slot (diffuse, long range)"),
            ("-BG41", "double-occupancy check right slot"), ("-BG42", "slot fine-position flag (reflex)")]
    for i, (t, d) in enumerate(di_c):
        add("%%I22.%d" % i if i < 8 else "%%I23.%d" % (i - 8), "=ASRS1+CRANE" + t, d, "DI", "-KF31", "no", "P08")
    di_c2 = [("-BG50", "travel brake released (feedback)"), ("-BG51", "hoist brake 1 released"), ("-BG52", "hoist brake 2 released"),
             ("-BG53", "fork brake released"), ("-KF35.11", "overload relay: overload (also F-DI below)"), ("-SF76.1", "crane local mode key: manual"),
             ("-SF76.2", "crane local mode key: maintenance"), ("-SF77.1", "jog travel +"), ("-SF77.2", "jog travel -"),
             ("-SF77.3", "jog hoist up"), ("-SF77.4", "jog hoist down"), ("-SF77.5", "jog fork left"), ("-SF77.6", "jog fork right"),
             ("-BT60", "crane cabinet over-temperature"), ("-QA10.13", "crane main breaker ON"), ("-TA10.RDY", "infeed ready")]
    for i, (t, d) in enumerate(di_c2):
        add("%%I24.%d" % i if i < 8 else "%%I25.%d" % (i - 8), "=ASRS1+CRANE" + t, d, "DI", "-KF34", "no", "P08")
    add("%I26.0", "=ASRS1+CRANE-KF35.21.1", "overload relay safety output channel 1", "F-DI", "-KF24-2", "yes", "P08")
    add("%I26.1", "=ASRS1+CRANE-KF35.21.2", "overload relay safety output channel 2", "F-DI", "-KF24-2", "yes", "P08")
    add("%I26.2", "=ASRS1+CRANE-SF78.1", "3-position enabling switch on pendant channel 1", "F-DI", "-KF24-2", "yes", "P06")
    add("%I26.3", "=ASRS1+CRANE-SF78.2", "3-position enabling switch on pendant channel 2", "F-DI", "-KF24-2", "yes", "P06")
    # ---- crane DQ
    for i, (t, d) in enumerate([("-PF61.1", "crane beacon green (auto)"), ("-PF61.2", "crane beacon yellow (manual / warning)"),
                                ("-PF61.3", "crane beacon red (fault)"), ("-PF62", "crane horn (start warning in manual)"),
                                ("-EA60", "carriage work light"), ("-MB16", "brake test request (to drive)")]):
        add("%%Q20.%d" % i, "=ASRS1+CRANE" + t, d, "DQ", "-KF32", "no", "P08", 100)
    # ---- crane PROFINET / PROFIsafe
    for addr, t, d in [("%IW256..%QW256", "-TA11", "travel inverter telegram 1 + PROFIsafe 30 (STO/SS1/SLS)"),
                       ("%IW272..%QW272", "-TA13", "hoist inverter telegram 1 + PROFIsafe 30 (STO/SS1/SLS/SBC)"),
                       ("%IW288..%QW288", "-TA14", "fork inverter telegram 1 + PROFIsafe 30 (STO)"),
                       ("%IW304", "-TA10", "infeed status word, DC link voltage"),
                       ("%ID320", "-BG15", "travel position laser (mm, 1 ms update)"),
                       ("%ID324", "-BG45", "hoist position bar code (0.1 mm) + speed (safe speed channel 2)"),
                       ("%IW328", "-BW35", "load cell value (via load monitor, kg)")]:
        add(addr, "=ASRS1+CRANE" + t, d, "PROFINET", t, "yes" if "PROFIsafe" in d else "no", "P07", 0)
    # ---- ground F-DI
    fdi_g = [("-SF51", "E-stop ground cabinet"), ("-SF52", "E-stop aisle door"), ("-SF55", "E-stop infeed CV1"),
             ("-SF56", "E-stop outfeed / pick station")]
    for i, (t, d) in enumerate(fdi_g):
        add("%%I0.%d" % (2 * i), "=ASRS1+GC" + t + ".1", d + " channel 1", "F-DI", "-KF21", "yes", "P06")
        add("%%I0.%d" % (2 * i + 1), "=ASRS1+GC" + t + ".2", d + " channel 2", "F-DI", "-KF21", "yes", "P06")
    fdi_g2 = [("-BG56", "aisle door position (separate actuator)"), ("-BG57", "aisle door guard locking monitored"),
              ("-BG81", "light curtain infeed OSSD"), ("-BG83", "light curtain outfeed OSSD")]
    for i, (t, d) in enumerate(fdi_g2):
        add("%%I1.%d" % (2 * i), "=ASRS1+GC" + t + ".1", d + " 1", "F-DI", "-KF28", "yes", "P06" if "door" in d else "P09")
        add("%%I1.%d" % (2 * i + 1), "=ASRS1+GC" + t + ".2", d + " 2", "F-DI", "-KF28", "yes", "P06" if "door" in d else "P09")
    add("%I2.0", "=ASRS1+GC-BG85.1", "light curtain pick station OSSD 1", "F-DI", "-KF28-2", "yes", "P09")
    add("%I2.1", "=ASRS1+GC-BG85.2", "light curtain pick station OSSD 2", "F-DI", "-KF28-2", "yes", "P09")
    add("%I2.2", "=ASRS1+GC-BG58.1", "fence maintenance door I/O area channel 1", "F-DI", "-KF28-2", "yes", "P09")
    add("%I2.3", "=ASRS1+GC-BG58.2", "fence maintenance door I/O area channel 2", "F-DI", "-KF28-2", "yes", "P09")
    # ---- ground F-DQ
    for i, (t, d) in enumerate([("-MB56", "aisle door guard-locking solenoid (power to unlock)"), ("-QA2", "crane feeder contactor coil"),
                                ("-TA8x.STO", "STO conveyors CV1-CV3 (common F-DQ, PM)"), ("-QA2.FB", "spare F-DQ")]):
        add("%%Q0.%d" % i, "=ASRS1+GC" + t, d, "F-DQ", "-KF22", "yes", "P06", 500)
    # ---- ground DI
    di_g = [("-SF57", "request entry aisle (button)"), ("-SF58", "reset safety (button, blue lamp)"), ("-SF76.1", "mode switch: auto"),
            ("-SF76.2", "mode switch: manual"), ("-SF76.3", "mode switch: maintenance"), ("-QB2.13", "rail isolator ON"),
            ("-QA2.21", "crane contactor mirror contact (EDM)"), ("-BG91", "CV1 crate at entry"), ("-BG92", "CV1 crate at contour station"),
            ("-BG93", "CV1 crate at transfer (crane pick-up)"), ("-BG94", "CV2 crate at transfer (crane drop)"), ("-BG95", "CV2 crate at AGV handover"),
            ("-BG96", "CV3 crate at pick position"), ("-BG97", "CV3 crate at return position"), ("-BG101", "contour: height exceeded"),
            ("-BG102", "contour: width protrusion left"), ("-BG103", "contour: width protrusion right"), ("-BG104", "contour: depth protrusion front"),
            ("-BG105", "contour: depth protrusion rear"), ("-BG106", "contour: crate runner / base check"), ("-BG86", "muting sensor infeed A"),
            ("-BG87", "muting sensor infeed B"), ("-BG88", "muting sensor outfeed A"), ("-BG89", "muting sensor outfeed B"),
            ("-SF121", "pick station: pick confirmed"), ("-SF122", "pick station: crate empty"), ("-KF130.1", "AGV handshake: AGV present"),
            ("-KF130.2", "AGV handshake: AGV ready to transfer"), ("-KF130.3", "AGV handshake: transfer complete"), ("-KF130.4", "AGV handshake: AGV fault"),
            ("-FC1.11", "SPD fault contact"), ("-TB1.OK", "24 V PSU OK")]
    for i, (t, d) in enumerate(di_g):
        add("%%I%d.%d" % (3 + i // 8, i % 8), "=ASRS1+GC" + t, d, "DI", "-KF25" if i < 16 else "-KF25-2", "no", "P09" if t[1:3] in ("BG", "KF") and t not in ("-BG86",) else "P06")
    # ---- ground DQ
    dq_g = [("-PF57", "lamp 'entry allowed' at aisle door"), ("-PF58", "reset lamp (blue)"), ("-PF91.1", "I/O beacon green"),
            ("-PF91.2", "I/O beacon yellow"), ("-PF91.3", "I/O beacon red"), ("-PF59", "lamp 'rail live' at aisle door"),
            ("-KF130.5", "AGV handshake: conveyor ready to receive / give"), ("-KF130.6", "AGV handshake: transfer running"),
            ("-KF130.7", "AGV handshake: conveyor fault"), ("-EA61", "aisle maintenance lighting"), ("-PF120.EN", "pick-to-light enable")]
    for i, (t, d) in enumerate(dq_g):
        add("%%Q%d.%d" % (2 + i // 8, i % 8), "=ASRS1+GC" + t, d, "DQ", "-KF26", "no", "P09", 100)
    # ---- ground AI / PROFINET
    add("%IW64", "=ASRS1+GC-BW92", "infeed scale (4 load cells, kg)", "AI", "-KF27", "no", "P09")
    for addr, t, d in [("%IW340..%QW340", "-TA81", "CV1 inverter telegram 1 + PROFIsafe STO"), ("%IW350..%QW350", "-TA82", "CV2 inverter telegram 1 + PROFIsafe STO"),
                       ("%IW360..%QW360", "-TA83", "CV3 inverter telegram 1 + PROFIsafe STO"), ("%IB400 (64 B)", "-BG110", "barcode / DataMatrix scanner infeed (PROFINET, crate ID - item F6)"),
                       ("%IB464 (64 B)", "-BG111", "scanner pick station (PROFINET)"), ("TCP 10.70.20.61", "-PF120", "pick-to-light controller (Ethernet)"),
                       ("Modbus TCP 10.70.20.51:502", "-KF2.MB", "Modbus TCP server V1.2a (WMS / cell controller: regs 0-449, cmd 30 store / 31 retrieve)")]:
        add(addr, "=ASRS1+GC" + t, d, "PROFINET" if "Modbus" not in d and "TCP 10" not in addr else "TCP", t, "yes" if "PROFIsafe" in d else "no", "P10" if "TCP" in addr else "P07", 0)
    return L


def cables(C, D):
    rack_L = D["rack"]["length_m"]
    Hm = D["crane"]["mass"]["H_mast_m"]
    m = C["motors"]
    cb = [  # no, from, to, type, cores, length m, route, emc
        ("W0001", "sub-distribution -FC0", "+GC -QB1", "NYY-J / H07RN-F", "5G%g" % C["supply"]["cable_mm2"], PARAM["L_supply_m"], "cable tray", "-"),
        ("W0002", "+GC -QB2", "rail feed point -WD1 (end)", "H07RN-F", "5G%g" % C["feeder_rail"]["mm2"], 5.0, "tray", "-"),
        ("W0003", "-XD10 collector", "+CC -QA10", "H07RN-F", "5G%g" % C["feeder_rail"]["mm2"], 3.0, "crane", "-"),
        ("W0011", "+CC -TA11", "-MA11 travel motor", "shielded motor cable (2YSLCY-JB)", "4G%g + 2x1.5 (brake)" % m["travel"]["cable_mm2"], m["travel"]["cable_L"], "crane", "360 deg shield both ends (EMC glands)"),
        ("W0012", "-BG11 encoder", "+CC -TA11", "encoder cable shielded", "4x2x0.25", m["travel"]["cable_L"], "crane", "shield both ends"),
        ("W0013", "+CC -TA13", "-MA13 hoist motor", "shielded motor cable", "4G%g + 2x1.5" % m["hoist"]["cable_mm2"], m["hoist"]["cable_L"], "crane", "360 deg shield"),
        ("W0014", "-BG13 encoder", "+CC -TA13", "encoder cable shielded", "4x2x0.25", m["hoist"]["cable_L"], "crane", "shield both ends"),
        ("W0015", "+CC -TA13", "-MB15 second brake", "shielded", "3G1.5", 4.0, "crane", "-"),
        ("W0016", "+CC -TA14", "-MA14 fork motor (carriage)", "chain-flex shielded motor cable", "4G%g + 2x1.0" % m["fork"]["cable_mm2"], m["fork"]["cable_L"], "drag chain on mast", "360 deg shield, chain-approved"),
        ("W0017", "+CC -KF31/34", "carriage junction box -XD20", "chain-flex control cable", "25G0.75", Hm + 3, "drag chain on mast", "-"),
        ("W0018", "+CC -KF30", "carriage -BG45 / -BW35", "PROFINET chain cable", "4x2xAWG22", Hm + 3, "drag chain on mast", "separate from power in chain"),
        ("W0019", "+CC -KF30", "-BG15 laser", "PROFINET cable", "4xAWG22", 3.0, "crane", "-"),
        ("W0020", "+CC -RA11", "+CC -TA10 chopper", "shielded", "2x%g + PE" % 2.5, 2.0, "crane", "short, twisted"),
        ("W0021", "+CC -KF30", "-KF71 data light barrier", "PROFINET cable", "4xAWG22", 3.0, "crane", "-"),
        ("W0022", "+CC -KF23/24", "limit switches + E-stops crane", "control cable", "12G1.0", 14.0, "crane", "-"),
        ("W0101", "+GC -KF2", "-KF70 data light barrier (aisle end)", "PROFINET cable", "4xAWG22", 6.0, "tray", "-"),
        ("W0102", "+GC -KF21/28", "aisle door -BG56/-BG57/-MB56/-SF52", "control cable", "12G1.0", 8.0, "tray", "-"),
        ("W0103", "+GC -KF28", "light curtains -BG81/-BG83/-BG85", "M12 sensor cable", "8x0.25 shielded", 12.0, "tray", "-"),
        ("W0104", "+GC -TA81", "-MA81 CV1", "shielded motor cable", "4G1.5 + 2x1.0", 12.0, "tray", "360 deg shield"),
        ("W0105", "+GC -TA82", "-MA82 CV2", "shielded motor cable", "4G1.5 + 2x1.0", 10.0, "tray", "360 deg shield"),
        ("W0106", "+GC -TA83", "-MA83 CV3", "shielded motor cable", "4G1.5 + 2x1.0", 14.0, "tray", "360 deg shield"),
        ("W0107", "+GC -KF25", "I/O sensors junction box -XD80", "control cable", "25G0.75", 12.0, "tray", "-"),
        ("W0108", "+GC -KF27", "scale -BW92 summing box", "load-cell cable shielded", "6x0.5", 12.0, "tray", "shield one end"),
        ("W0109", "+GC -KF90", "scanners -BG110/-BG111, pick-to-light", "PROFINET / Cat6A", "4xAWG22", 15.0, "tray", "-"),
        ("W0110", "+GC -KF90", "factory network VLAN 720 (cell controller, WMS)", "fibre or Cat6A", "2 fibres / 4x2", 60.0, "tray", "-"),
        ("W0111", "+GC -FC5", "aisle light + service socket", "NYM-J", "3G2.5", rack_L + 10, "aisle", "-"),
    ]
    return cb


# ----------------------------------------------------------------------------- 3 24 V supplies
def psu(io, devs):
    g = c = 0.0
    for t, d, ty, loc, page, mA, saf in devs:
        if "+CRANE" in t:
            c += mA
        else:
            g += mA
    for addr, t, d, ty, dev, saf, page, mA in io:
        if "+CRANE" in t:
            c += mA
        else:
            g += mA
    g_A, c_A = g / 1000, c / 1000
    return {"ground_A": g_A, "crane_A": c_A, "ground_psu": pick(PSU_A, 1.25 * g_A), "crane_psu": pick(PSU_A, 1.25 * c_A)}


# ----------------------------------------------------------------------------- 4 safety (ISO 12100 / ISO 13849-1)
PL_ORDER = "abcde"
RISK_GRAPH = {("S1", "F1", "P1"): "a", ("S1", "F1", "P2"): "b", ("S1", "F2", "P1"): "b", ("S1", "F2", "P2"): "c",
              ("S2", "F1", "P1"): "c", ("S2", "F1", "P2"): "d", ("S2", "F2", "P1"): "d", ("S2", "F2", "P2"): "e"}


def plr(S, F, P):
    return RISK_GRAPH[(S, F, P)]


def mttfd_b10d(B10d, t_cycle_s, d_op=None, h_op=None):
    d_op = d_op or PARAM["d_op"]
    h_op = h_op or PARAM["h_op"]
    nop = d_op * h_op * 3600.0 / t_cycle_s
    return min(B10d / (0.1 * nop), 2500.0), nop


def channel_mttfd(comps):
    return 1.0 / sum(1.0 / c for c in comps)


def sym(c1, c2):
    return 2.0 / 3.0 * (c1 + c2 - 1.0 / (1.0 / c1 + 1.0 / c2))


def mttfd_class(m):
    m = min(m, 100.0)
    return "low" if m < 10 else ("medium" if m < 30 else "high")


def dc_class(dc):
    return "none" if dc < 0.60 else ("low" if dc < 0.90 else ("medium" if dc < 0.99 else "high"))


# simplified method, ISO 13849-1 Figure 5 (bar chart): (category, DC class) -> PL by MTTFd class
BAR = {("B", "none"): {"low": "a", "medium": "b", "high": "b"},
       ("1", "none"): {"low": None, "medium": None, "high": "c"},
       ("2", "low"): {"low": "a", "medium": "b", "high": "c"},
       ("2", "medium"): {"low": "b", "medium": "c", "high": "d"},
       ("3", "low"): {"low": "b", "medium": "c", "high": "d"},
       ("3", "medium"): {"low": "c", "medium": "d", "high": "d"},
       ("4", "high"): {"low": None, "medium": None, "high": "e"}}


def pl_bar(cat, dc, mttfd):
    dcc = dc_class(dc)
    if cat == "3" and dcc == "high":
        dcc = "medium"            # Cat 3 column uses low / medium DC; high DC counts as medium
    if cat == "2" and dcc == "high":
        dcc = "medium"
    if cat in ("B", "1"):
        dcc = "none"
    row = BAR.get((cat, dcc))
    if row is None:
        return None
    return row[mttfd_class(mttfd)]


def combine(pls):
    """ISO 13849-1 Table 11: lowest PL of the series subsystems, reduced by one if too many of them."""
    low = min(pls, key=PL_ORDER.index)
    n = sum(1 for p in pls if p == low)
    limit = {"a": 3, "b": 2, "c": 2, "d": 3, "e": 3}[low]
    if n > limit:
        return PL_ORDER[max(0, PL_ORDER.index(low) - 1)] if low != "a" else None
    return low


def ccf_score(measures):
    pts = {"separation": 15, "diversity": 20, "overvoltage_protection": 15, "proven_components": 5, "fmea": 5,
           "competence": 5, "emc": 25, "environment": 10}
    return sum(pts[m] for m in measures)


def safety(C, D):
    t_sc = D["crane"]["fem"]["SC"]
    risk = [  # hazard, situation, S, F, P, measure (SF)
        ("person in aisle hit by crane", "maintenance / fault clearing in the aisle while the crane can move", "S2", "F1", "P2", "SF2 door interlock + guard locking, SF3 SLS in maintenance"),
        ("person crushed at I/O conveyor transfer", "operator reaches into conveyor end while the crane forks pick", "S2", "F2", "P1", "SF5 light curtain with muting"),
        ("falling load", "rope break, brake failure, crate slides off fork", "S2", "F1", "P2", "SF6 slack rope / catch, SF7 two monitored brakes, protrusion sensors"),
        ("crane overtravel into end structure", "positioning / control fault at full speed", "S2", "F1", "P2", "SF4 final limits + buffers, SF3 SLS near the aisle ends"),
        ("hoist overload / rope overstress", "crate heavier than 300 kg, two crates", "S1", "F2", "P2", "SF6 load monitor + infeed scale"),
        ("fork hits rack or occupied slot", "wrong slot data, double occupancy", "S1", "F1", "P2", "double-occupancy check (functional), protrusion check"),
        ("any hazard - emergency", "person sees danger, presses E-stop", "S2", "F1", "P2", "SF1 E-stop"),
        ("maintenance work on the crane platform", "crane moves with person on board", "S2", "F1", "P2", "SF2 + SF3 + enabling switch, rail isolator LOTO"),
    ]
    rrows = [(h, s, S, F, P, plr(S, F, P), m) for h, s, S, F, P, m in risk]
    # safety functions with subsystem data
    sf = []

    def add(name, plr_, desc, subs):
        res = []
        for sname, kind, data in subs:
            if kind == "certified":
                res.append((sname, data["PL"], "certified %s (PFHd %.1e)" % (data["PL"], data["PFHd"])))
            else:
                ch = []
                for comps in data["channels"]:
                    ch.append(channel_mttfd([mttfd_b10d(B, data["t_cycle"])[0] if B else mt for B, mt in comps]))
                m = sym(*ch) if len(ch) == 2 else ch[0]
                m_cap = min(m, 100.0)
                pl = pl_bar(data["cat"], data["DC"], m_cap)
                res.append((sname, pl, "Cat %s, MTTFd %.0f a (%s), DCavg %.0f %% (%s), CCF %d" % (
                    data["cat"], m_cap, mttfd_class(m_cap), 100 * data["DC"], dc_class(data["DC"]), data.get("ccf", 0))))
        ach = combine([r[1] for r in res])
        sf.append({"id": name, "PLr": plr_, "desc": desc, "subs": res, "PL": ach,
                   "ok": ach is not None and PL_ORDER.index(ach) >= PL_ORDER.index(plr_)})

    ccf = ccf_score(["separation", "overvoltage_protection", "proven_components", "fmea", "competence", "emc", "environment"])
    t_week = 7 * 24 * 3600 / 1                                   # E-stop actuated about once per week (test + use)
    add("SF1", "d", "E-stop (any -SF51...-SF56) -> SS1 (controlled stop) then STO of all drives + -QA2 opens (stop cat. 1)", [
        ("input: E-stop 2 ch, cross-monitored F-DI", "calc", {"channels": [[(100000, 0)], [(100000, 0)]], "t_cycle": t_week, "cat": "3", "DC": 0.99, "ccf": ccf}),
        ("logic: F-CPU -KF2 + F-DI/F-DQ", "certified", {"PL": "e", "PFHd": 1e-9}),
        ("output: drive STO via PROFIsafe (SIL 3)", "certified", {"PL": "e", "PFHd": 1e-9})])
    add("SF2", "d", "Aisle door interlock with guard locking: entry only after crane at standstill + STO; door opening -> STO", [
        ("input: interlock + lock monitoring 2 ch", "calc", {"channels": [[(2000000, 0)], [(2000000, 0)]], "t_cycle": 7200, "cat": "3", "DC": 0.99, "ccf": ccf}),
        ("logic: F-CPU", "certified", {"PL": "e", "PFHd": 1e-9}),
        ("output: drive STO", "certified", {"PL": "e", "PFHd": 1e-9})])
    add("SF3", "d", "Safely limited speed SLS: 0.25 m/s travel / 0.15 m/s hoist in maintenance and in the last 3 m before the aisle ends", [
        ("input: two speed channels (motor encoder + laser / bar code)", "certified", {"PL": "d", "PFHd": 5e-8}),
        ("logic: drive integrated safety + F-CPU", "certified", {"PL": "d", "PFHd": 3e-8}),
        ("output: drive STO", "certified", {"PL": "e", "PFHd": 1e-9})])
    add("SF4", "d", "Final limit switches travel / hoist (forced NC, 2 ch) -> STO + brakes", [
        ("input: forced-NC position switches 2 ch", "calc", {"channels": [[(20000000, 0)], [(20000000, 0)]], "t_cycle": 86400, "cat": "3", "DC": 0.99, "ccf": ccf}),
        ("logic: F-CPU", "certified", {"PL": "e", "PFHd": 1e-9}),
        ("output: drive STO", "certified", {"PL": "e", "PFHd": 1e-9})])
    add("SF5", "d", "Light curtain type 4 at the I/O with muting (crate passes, person stops conveyor + crane fork transfer)", [
        ("input: light curtain type 4", "certified", {"PL": "e", "PFHd": 1.5e-8}),
        ("input: muting sensors 2 ch, plausibility (timing / sequence)", "calc", {"channels": [[(0, 50.0)], [(0, 50.0)]], "t_cycle": 60, "cat": "3", "DC": 0.90, "ccf": ccf}),
        ("logic: F-CPU", "certified", {"PL": "e", "PFHd": 1e-9}),
        ("output: conveyor STO via PROFIsafe", "certified", {"PL": "e", "PFHd": 1e-9})])
    add("SF6", "c", "Overload (load monitor -KF35) and slack rope -BG34 -> stop hoist (STO + brakes)", [
        ("input: load monitor relay", "certified", {"PL": "c", "PFHd": 1e-6}),
        ("input: slack-rope switch (well-tried, Cat 1)", "calc", {"channels": [[(20000000, 0)]], "t_cycle": 86400, "cat": "1", "DC": 0.0, "ccf": 0}),
        ("logic: F-CPU", "certified", {"PL": "e", "PFHd": 1e-9}),
        ("output: drive STO", "certified", {"PL": "e", "PFHd": 1e-9})])
    add("SF7", "d", "Hoist holding: SBC + two monitored brakes, cyclic brake test (load stays up after STO)", [
        ("output: two brakes (B10d 2e6, 2 actuations per cycle), feedback + brake test", "calc",
         {"channels": [[(2000000, 0)], [(2000000, 0)]], "t_cycle": t_sc / 2, "cat": "3", "DC": 0.90, "ccf": ccf}),
        ("logic: drive SBC + F-CPU", "certified", {"PL": "e", "PFHd": 1e-9})])
    # worked-example numbers
    ex = {}
    m1, n1 = mttfd_b10d(100000, t_week)
    m2, n2 = mttfd_b10d(2000000, 7200)
    m7, n7 = mttfd_b10d(2000000, t_sc / 2)
    ex["SF1"] = {"nop": n1, "mttfd": m1}
    ex["SF2"] = {"nop": n2, "mttfd": m2}
    ex["SF7"] = {"nop": n7, "mttfd": m7}
    ex["ccf"] = ccf
    return rrows, sf, ex


def iso13855(K_mm_s=2000, t_curtain_ms=10, t_plc_ms=40, t_drive_ms=60, t_stop_ms=150, d_res_mm=14):
    """Safety distance S = K * T + C, C = 8 (d - 14) for d <= 40 mm (finger / hand detection, vertical field)."""
    T = (t_curtain_ms + t_plc_ms + t_drive_ms + t_stop_ms) / 1000.0
    C = max(0.0, 8.0 * (d_res_mm - 14))
    S = K_mm_s * T + C
    if S > 500:
        K_mm_s = 1600
        S = max(500.0, K_mm_s * T + C)
    return {"T_s": T, "C": C, "S_mm": max(100.0, S), "K": K_mm_s}


# ----------------------------------------------------------------------------- 5 SVG schematics
W, H = 1400, 990
COLS = 10


class Page:
    def __init__(self, no, title, items):
        self.no, self.title, self.items = no, title, items
        self.e = []

    def t(self, x, y, s, size=12, anchor="start", weight="normal", color="#000"):
        s = str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        self.e.append('<text x="%.1f" y="%.1f" font-size="%d" text-anchor="%s" font-weight="%s" fill="%s">%s</text>' % (x, y, size, anchor, weight, color, s))

    def l(self, x1, y1, x2, y2, w=1.5, color="#000", dash=None):
        self.e.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"%s/>' % (
            x1, y1, x2, y2, color, w, ' stroke-dasharray="%s"' % dash if dash else ""))

    def r(self, x, y, w, h, fill="none", stroke="#000", sw=1.5, dash=None):
        self.e.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" stroke="%s" stroke-width="%.1f"%s/>' % (
            x, y, w, h, fill, stroke, sw, ' stroke-dasharray="%s"' % dash if dash else ""))

    def c(self, x, y, r, fill="none"):
        self.e.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke="#000" stroke-width="1.5"/>' % (x, y, r, fill))

    # ---- IEC 60617-style symbols (simplified)
    def fuse(self, x, y, tag, lab=""):
        self.r(x - 6, y, 12, 30); self.l(x, y - 8, x, y + 38); self.t(x + 10, y + 12, tag, 11, weight="bold"); self.t(x + 10, y + 26, lab, 10)

    def contact_no(self, x, y, tag, lab=""):
        self.l(x, y, x, y + 12); self.l(x, y + 12, x + 10, y + 32); self.l(x, y + 34, x, y + 46)
        self.t(x + 12, y + 22, tag, 11, weight="bold"); self.t(x + 12, y + 36, lab, 10)

    def contact_nc(self, x, y, tag, lab="", estop=False):
        self.l(x, y, x, y + 12); self.l(x - 8, y + 12, x + 2, y + 34); self.l(x - 8, y + 12, x, y + 12)
        self.l(x, y + 34, x, y + 46)
        if estop:
            self.e.append('<path d="M %.1f %.1f a 7 7 0 0 1 14 0" fill="#c00" stroke="#000"/>' % (x - 19, y + 22))
            self.l(x - 12, y + 22, x - 4, y + 22, 1.0, dash="2 2")
        self.t(x + 8, y + 22, tag, 11, weight="bold"); self.t(x + 8, y + 36, lab, 10)

    def motor(self, x, y, tag, lab):
        self.c(x, y, 24); self.t(x, y - 2, "M", 14, "middle", "bold"); self.t(x, y + 13, "3~", 10, "middle")
        self.t(x + 30, y - 4, tag, 11, weight="bold"); self.t(x + 30, y + 10, lab, 10)

    def box(self, x, y, w, h, tag, lab="", lab2="", fill="#f7f7f7"):
        self.r(x, y, w, h, fill=fill)
        self.t(x + 5, y + 15, tag, 11, weight="bold")
        if lab:
            self.t(x + 5, y + 30, lab, 10)
        if lab2:
            self.t(x + 5, y + 44, lab2, 10)

    def coil(self, x, y, tag, lab=""):
        self.r(x - 14, y, 28, 18); self.l(x, y - 10, x, y); self.l(x, y + 18, x, y + 28)
        self.t(x + 18, y + 13, tag, 11, weight="bold"); self.t(x + 18, y + 27, lab, 10)

    def lamp(self, x, y, tag, lab=""):
        self.c(x, y, 10); self.l(x - 7, y - 7, x + 7, y + 7, 1.2); self.l(x - 7, y + 7, x + 7, y - 7, 1.2)
        self.t(x + 14, y + 4, tag, 11, weight="bold"); self.t(x + 14, y + 18, lab, 10)

    def resistor(self, x, y, tag, lab=""):
        self.r(x - 7, y, 14, 34); self.t(x + 12, y + 14, tag, 11, weight="bold"); self.t(x + 12, y + 28, lab, 10)

    def xref(self, x, y, s):
        self.t(x, y, s, 10, color="#1f4e9a")

    def svg(self):
        o = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" font-family="Arial">' % (W, H, W, H),
             '<rect width="100%" height="100%" fill="#fff"/>']
        # frame + column grid (current paths 0..9)
        o.append('<rect x="20" y="20" width="%d" height="%d" fill="none" stroke="#000" stroke-width="2"/>' % (W - 40, H - 40))
        cw = (W - 40) / COLS
        for i in range(COLS):
            x = 20 + i * cw
            o.append('<line x1="%.1f" y1="20" x2="%.1f" y2="36" stroke="#000"/>' % (x, x))
            o.append('<text x="%.1f" y="32" font-size="11" text-anchor="middle">%d</text>' % (x + cw / 2, i))
        o.append('<line x1="20" y1="36" x2="%d" y2="36" stroke="#000"/>' % (W - 20))
        # title block
        y0 = H - 110
        o.append('<rect x="20" y="%d" width="%d" height="90" fill="#fafafa" stroke="#000" stroke-width="2"/>' % (y0, W - 40))
        for x in (420, 800, 1060, 1230):
            o.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#000"/>' % (x, y0, x, y0 + 90))
        o.append('<text x="30" y="%d" font-size="13" font-weight="bold">=ASRS1  AS/RS one aisle (VC20 + Roots combined FMS)</text>' % (y0 + 24))
        o.append('<text x="30" y="%d" font-size="11">Final thesis item F3 - asrs_elec.py (generated)</text>' % (y0 + 44))
        o.append('<text x="30" y="%d" font-size="11" fill="#b00000" font-weight="bold">DESIGN - to be checked and released by a qualified engineer</text>' % (y0 + 66))
        o.append('<text x="430" y="%d" font-size="14" font-weight="bold">%s</text>' % (y0 + 30, self.title[:46]))
        o.append('<text x="430" y="%d" font-size="11">IEC 60617 symbols (simplified), IEC 81346-2 tags, columns = current paths</text>' % (y0 + 52))
        o.append('<text x="430" y="%d" font-size="11">cross-reference: /page.column</text>' % (y0 + 70))
        o.append('<text x="810" y="%d" font-size="11">Standard: IEC 60204-1/-32, ISO 13849-1, EN 528</text>' % (y0 + 30))
        o.append('<text x="810" y="%d" font-size="11">Revision A  2026-11-15</text>' % (y0 + 52))
        o.append('<text x="1070" y="%d" font-size="11">drawn: F3 program</text>' % (y0 + 30))
        o.append('<text x="1070" y="%d" font-size="11">checked: ________</text>' % (y0 + 52))
        o.append('<text x="1070" y="%d" font-size="11">released: ________</text>' % (y0 + 72))
        o.append('<text x="1240" y="%d" font-size="13">page</text>' % (y0 + 30))
        o.append('<text x="1240" y="%d" font-size="26" font-weight="bold">%s</text>' % (y0 + 66, self.no))
        o.append('<text x="1330" y="%d" font-size="11">/ P10</text>' % (y0 + 66))
        o += self.e
        o.append("</svg>")
        return "\n".join(o)


def cx(col):
    return 20 + (col + 0.5) * (W - 40) / COLS


def pages(C, D, devs, iol, sf, ps):
    P = []
    m = C["motors"]
    # ---- P01 cover + index
    p = Page("P01", "Cover and page index", [])
    p.t(60, 90, "AS/RS =ASRS1 - electrical schematics (design)", 26, weight="bold")
    p.t(60, 125, "One aisle, one stacker crane, %d positions, rack %.1f x %.1f m; travel %.1f kW, hoist %.1f kW, fork %.2f kW" % (
        D["rack"]["positions"], D["rack"]["length_m"], D["rack"]["rack_height_m"], m["travel"]["P_n"], m["hoist"]["P_n"], m["fork"]["P_n"]), 14)
    p.t(60, 150, "Supply 400 V 3~ 50 Hz TN-S, %.1f kVA design / %.1f kVA peak; control 24 V DC; network VLAN 720, PLC 10.70.20.51 (Modbus TCP V1.2a)" % (
        C["supply"]["S_kVA"], C["supply"]["S_pk_kVA"]), 14)
    idx = [("P01", "Cover and page index"), ("P02", "Main power distribution, conductor rail"), ("P03", "Crane infeed, DC link, travel drive"),
           ("P04", "Hoist drive, two brakes, brake monitoring"), ("P05", "Fork drive"), ("P06", "24 V supplies and safety circuit"),
           ("P07", "PLC, ET 200SP stations, PROFINET via data light barrier"), ("P08", "Positioning and crane sensors"),
           ("P09", "I/O conveyors, contour check, light curtains + muting"), ("P10", "Network, Modbus TCP, VLAN")]
    p.r(60, 190, 820, 34 * len(idx) + 40, fill="#fafafa")
    p.t(80, 215, "Page", 13, weight="bold"); p.t(180, 215, "Content", 13, weight="bold")
    for i, (a, b) in enumerate(idx):
        p.t(80, 250 + 34 * i, a, 13); p.t(180, 250 + 34 * i, b, 13)
    p.t(940, 215, "Locations", 13, weight="bold")
    for i, s in enumerate(["+GC  ground cabinet at the aisle front", "+CC  crane cabinet on the bottom frame", "+CRANE  devices on the crane",
                           "+CV1..3  I/O conveyors", "+AISLE  conductor rail, aisle devices", "field  sensors / actuators"]):
        p.t(940, 250 + 26 * i, s, 12)
    p.t(940, 430, "Totals", 13, weight="bold")
    p.t(940, 456, "devices: %d   I/O points: %d" % (len(devs), len(iol)), 12)
    p.t(940, 480, "safety functions: %s" % ", ".join("%s PL %s" % (s["id"], s["PL"]) for s in sf[:4]), 12)
    p.t(940, 500, "                  %s" % ", ".join("%s PL %s" % (s["id"], s["PL"]) for s in sf[4:]), 12)
    p.t(940, 530, "24 V: ground %.1f A -> PSU %d A; crane %.1f A -> PSU %d A" % (ps["ground_A"], ps["ground_psu"], ps["crane_A"], ps["crane_psu"]), 12)
    P.append(p)

    # ---- P02 main power distribution
    p = Page("P02", "Main power distribution and conductor rail", [])
    y = 70
    for i, ph in enumerate(("L1", "L2", "L3", "PE")):
        yy = y + 18 * i
        p.l(64, yy, W - 40, yy, 2 if ph != "PE" else 1.5, "#000" if ph != "PE" else "#2a8a2a")
        p.t(58, yy + 4, ph, 10, "end")
    p.t(70, 62, "from sub-distribution: -FC0 gG %d A, -W0001 5G%g, %.0f m" % (C["supply"]["fuse"], C["supply"]["cable_mm2"], PARAM["L_supply_m"]), 11)
    x = cx(0)
    p.l(x, 124, x, 150); p.contact_no(x, 150, "-QB1", "main switch %d A" % C["supply"]["main_switch_A"])
    p.box(x - 40, 210, 80, 46, "-FC1", "SPD T2")
    feeders = [(1.7, "-FC2", "MCCB %d A" % C["supply"]["FC2_A"], "crane feeder"), (4.0, "-FC3", "MCB C16", "conveyors /P09.1"),
               (5.6, "-FC4", "MCB C6", "24 V PSU /P06.0"), (7.2, "-FC5", "RCBO 30 mA", "aisle light, socket")]
    p.l(x, 196, cx(8.5), 196, 2)
    for col, tag, lab, use in feeders:
        xx = cx(col)
        p.l(xx, 196, xx, 260); p.fuse(xx, 260, tag, lab); p.l(xx, 298, xx, 330); p.t(xx + 10, 345, use, 11)
    xx = cx(1.7)
    p.contact_no(xx, 360, "-QA2", "crane contactor (F-DQ /P06.6)")
    p.contact_no(xx, 420, "-QB2", "rail isolator (LOTO)")
    p.l(xx, 466, xx, 510)
    p.r(cx(1.0), 510, cx(8.8) - cx(1.0), 50, fill="#eef4ff")
    p.t(cx(1.0) + 10, 530, "-WD1 enclosed conductor rail %d A, 4-pole + PE (double PE collector), L = %.1f m, end feed" % (C["rail"]["A"], C["rail"]["L"]), 12, weight="bold")
    p.t(cx(1.0) + 10, 548, "dU at peak %.1f A, crane at far end: rail %.2f %% + supply %.2f %% = %.2f %% (limit 5 %%)" % (
        C["crane"]["I_pk"], C["rail"]["du_end"], C["supply"]["du_supply"], C["supply"]["du_total_end"]), 11)
    xc = cx(6.0)
    p.box(xc - 70, 600, 140, 50, "-XD10", "collector trolley")
    p.l(xc, 560, xc, 600); p.l(xc, 650, xc, 700); p.xref(xc + 8, 690, "to crane -QA10 /P03.0")
    p.t(60, 760, "Fault loop at far end: Z_s = %.3f ohm <= 0.8 x U0/I_i = %.3f ohm (I_i = %d A); I_k1 = %.0f A" % (
        C["loop"]["Zs"], C["loop"]["Zs_max"], C["loop"]["Ii"], C["loop"]["Ik1"]), 12)
    p.t(60, 780, "Design current I_b = %.1f A (%.1f kVA), peak %.1f A (%.1f kVA); feeder cable to rail 5G%g" % (
        C["supply"]["I_b"], C["supply"]["S_kVA"], C["supply"]["I_pk"], C["supply"]["S_pk_kVA"], C["feeder_rail"]["mm2"]), 12)
    p.t(60, 800, "-QB2 rail isolator lockable in OFF + lamp 'rail live' -PF59 at the aisle door (/P09); the PE is continuous via two collectors (IEC 60204-32).", 12)
    P.append(p)

    # ---- P03 crane infeed + travel
    p = Page("P03", "Crane infeed, shared DC link and travel drive", [])
    x0 = cx(0)
    p.xref(x0 - 10, 60, "from -XD10 /P02.6")
    p.l(x0, 70, x0, 90); p.contact_no(x0, 90, "-QA10", "MPCB + contactor")
    p.box(x0 - 35, 150, 70, 46, "-RA10", "reactor 4 %")
    p.l(x0, 196, x0, 220)
    p.box(x0 - 60, 220, 120, 70, "-TA10", "infeed + chopper", "%.0f kW" % C["crane"]["infeed_kW"])
    p.l(x0 + 60, 240, cx(9.3), 240, 3, "#c00"); p.t(cx(9.3) - 10, 234, "DC+", 11, "end", color="#c00")
    p.l(x0 + 60, 270, cx(9.3), 270, 3, "#00c"); p.t(cx(9.3) - 10, 284, "DC-", 11, "end", color="#00c")
    p.l(x0, 290, x0, 330); p.resistor(x0, 330, "-RA11", "%d ohm / %.1f kW" % (C["brake"]["R_sel"], C["brake"]["P_cont_kW"]))
    p.t(40, 400, "P_brk %.1f kW, R <= %.1f ohm" % (C["brake"]["P_brk"] / 1000, C["brake"]["R_max"]), 10)
    xt = cx(3.5)
    p.l(xt, 240, xt, 300); p.l(xt + 20, 270, xt + 20, 300)
    p.box(xt - 70, 300, 160, 90, "-TA11", "travel inverter %.1f kW" % m["travel"]["inv_kW"], "I_r %.1f A, STO/SS1/SLS/SBC" % m["travel"]["inv_I"])
    p.l(xt, 390, xt, 470); p.t(xt + 8, 440, "-W0011 4G%g shielded, %.0f m" % (m["travel"]["cable_mm2"], m["travel"]["cable_L"]), 10)
    p.motor(xt, 500, "-MA11", "%.1f kW, I_n %.1f A, i = %.1f" % (m["travel"]["P_n"], m["travel"]["I_n"], D["crane"]["drives"]["travel"]["ratio"]))
    p.box(xt + 180, 560, 110, 40, "-MB11", "brake (SBC)")
    p.l(xt + 90, 345, xt + 235, 345, dash="4 3"); p.l(xt + 235, 345, xt + 235, 560, dash="4 3"); p.t(xt + 240, 470, "brake output (SBC)", 10)
    p.box(xt - 150, 540, 100, 40, "-BG11", "encoder")
    p.l(xt - 100, 540, xt - 100, 390, dash="4 3"); p.l(xt - 100, 390, xt - 70, 390, dash="4 3")
    xs = cx(7.0)
    p.box(xs - 80, 300, 210, 110, "STO / safety", "PROFIsafe telegram 30 from F-CPU", "-KF2 /P06.8: STO, SS1, SLS", fill="#fff4e6")
    p.t(xs - 70, 370, "SLS: 0.25 m/s maintenance + last 3 m", 10); p.t(xs - 70, 386, "STO terminals bridged only via PROFIsafe", 10)
    p.l(xt + 90, 330, xs - 80, 330, dash="5 3")
    p.t(60, 690, "Travel: F = %.0f N, P_peak %.2f kW (overload %.2f x P_n allowed 1.5 for 60 s), output %.1f rpm, torque %.0f N m" % (
        D["crane"]["drives"]["travel"]["F_N"], m["travel"]["P_pk"], m["travel"]["P_pk"] / m["travel"]["P_n"], D["crane"]["drives"]["travel"]["n_out_rpm"],
        D["crane"]["drives"]["travel"]["torque_out_Nm"]), 12)
    p.t(60, 712, "Shared DC link: travel braking energy feeds the hoist lifting; surplus -> chopper -> -RA11 (U_on %.0f V)." % PARAM["U_on"], 12)
    p.t(60, 734, "Peak braking (hoist lowering + travel braking): %.1f kW; energy per FEM cycle %.0f kJ -> mean %.2f kW -> resistor %.1f kW continuous." % (
        C["brake"]["P_brk"] / 1000, C["brake"]["E_cycle"] / 1000, C["brake"]["P_avg"] / 1000, C["brake"]["P_cont_kW"]), 12)
    P.append(p)

    # ---- P04 hoist
    p = Page("P04", "Hoist drive, two brakes, brake monitoring", [])
    xh = cx(2.5)
    p.l(cx(0), 90, cx(9.3), 90, 3, "#c00"); p.t(cx(0), 84, "DC+ /P03", 11, color="#c00")
    p.l(cx(0), 116, cx(9.3), 116, 3, "#00c"); p.t(cx(0), 132, "DC- /P03", 11, color="#00c")
    p.l(xh, 90, xh, 160); p.l(xh + 20, 116, xh + 20, 160)
    p.box(xh - 80, 160, 180, 90, "-TA13", "hoist inverter %.1f kW" % m["hoist"]["inv_kW"], "I_r %.1f A, STO/SS1/SLS/SBC, brake test" % m["hoist"]["inv_I"])
    p.l(xh, 250, xh, 330); p.t(xh + 8, 300, "-W0013 4G%g shielded, %.0f m" % (m["hoist"]["cable_mm2"], m["hoist"]["cable_L"]), 10)
    p.motor(xh, 360, "-MA13", "%.1f kW, I_n %.1f A, i = %.1f" % (m["hoist"]["P_n"], m["hoist"]["I_n"], D["crane"]["drives"]["hoist"]["ratio"]))
    p.box(xh - 200, 420, 110, 40, "-BG13", "encoder (ch 1)")
    p.box(xh + 170, 430, 120, 40, "-MB13", "brake 1 (motor)")
    p.box(xh + 320, 430, 130, 40, "-MB15", "brake 2 (drum)")
    p.l(xh + 100, 215, xh + 385, 215, dash="4 3"); p.l(xh + 385, 215, xh + 385, 430, dash="4 3"); p.l(xh + 230, 215, xh + 230, 430, dash="4 3")
    p.t(xh + 240, 300, "SBC 2 outputs", 10)
    xb = cx(7.0)
    p.box(xb - 60, 160, 260, 120, "Brake monitoring", "-BG51 brake 1 released -> DI /P08", "-BG52 brake 2 released -> DI /P08", fill="#fff4e6")
    p.t(xb - 50, 230, "brake test: drive applies 1.3 x load torque", 10)
    p.t(xb - 50, 246, "against each closed brake (daily, at start)", 10)
    p.t(xb - 50, 262, "safe speed ch 2: -BG45 bar code /P08", 10)
    p.box(xb - 60, 330, 260, 80, "-KF35 load monitor", "-BW35 load pin 20 kN", "overload -> F-DI /P07, SF6", fill="#fff4e6")
    d = D["crane"]["drives"]["hoist"]
    p.t(60, 690, "Hoist: P_static %.2f kW, P_peak %.2f kW; drum D%d, %.1f rpm, torque %.0f N m; rope force %.0f N, safety %.1f" % (
        d["P_static_kW"], d["P_peak_kW"], D["crane"]["input"]["drum_D_mm"], d["n_out_rpm"], d["torque_out_Nm"], d["rope_F_N"], d["rope_safety"]), 12)
    p.t(60, 712, "Two independent brakes (EN 528 / hoisting practice): each holds >= 1.6 x the load torque alone; both monitored; SF7 = PL %s." % [s for s in sf if s["id"] == "SF7"][0]["PL"], 12)
    p.t(60, 734, "Lowering energy full height: %.0f kJ into the DC link (eta %.2f); static regenerative power %.2f kW (design result)." % (
        C["brake"]["E_full_lower_J"] / 1000, D["crane"]["input"]["eta_H"], C["brake"]["P_regen_design_kW"]), 12)
    P.append(p)

    # ---- P05 fork
    p = Page("P05", "Fork drive (telescopic fork on the carriage)", [])
    xf = cx(2.5)
    p.l(cx(0), 90, cx(6), 90, 3, "#c00"); p.l(cx(0), 116, cx(6), 116, 3, "#00c")
    p.t(cx(0), 84, "DC+ /P03", 11, color="#c00"); p.t(cx(0), 132, "DC- /P03", 11, color="#00c")
    p.l(xf, 90, xf, 160); p.l(xf + 20, 116, xf + 20, 160)
    p.box(xf - 80, 160, 180, 80, "-TA14", "fork inverter %.2f kW" % m["fork"]["inv_kW"], "I_r %.1f A, STO" % m["fork"]["inv_I"])
    p.l(xf, 240, xf, 340); p.t(xf + 8, 290, "-W0016 4G%g chain-flex, %.1f m (drag chain on the mast)" % (m["fork"]["cable_mm2"], m["fork"]["cable_L"]), 10)
    p.t(xf + 8, 306, "dU at I_n: %.2f %%" % m["fork"]["cable_du"], 10)
    p.motor(xf, 370, "-MA14", "%.2f kW, I_n %.2f A, i = %.1f" % (m["fork"]["P_n"], m["fork"]["I_n"], D["crane"]["drives"]["fork"]["ratio"]))
    p.box(xf - 200, 430, 110, 40, "-BG14", "encoder")
    p.box(xf + 160, 430, 110, 40, "-MB14", "brake")
    p.l(xf + 100, 220, xf + 215, 220, dash="4 3"); p.l(xf + 215, 220, xf + 215, 430, dash="4 3"); p.t(xf + 222, 330, "brake output", 10)
    p.l(xf - 145, 430, xf - 145, 230, dash="4 3"); p.l(xf - 145, 230, xf - 80, 230, dash="4 3")
    p.box(cx(6.5) - 60, 160, 300, 180, "Fork sensors (DI /P08)", "-BG21 centre  -BG22/-BG23 end L/R", "-BG24/-BG25 pre-end L/R (slow)", fill="#fff4e6")
    p.t(cx(6.5) - 50, 222, "-BG26/-BG27 load on fork L/R", 10)
    p.t(cx(6.5) - 50, 238, "-BG28/-BG29 crate protrusion front/rear", 10)
    p.t(cx(6.5) - 50, 254, "-BG40/-BG41 double-occupancy check L/R", 10)
    p.t(cx(6.5) - 50, 270, "interlock: travel / hoist only with -BG21 centre", 10)
    p.t(cx(6.5) - 50, 286, "(software + SLS standstill monitoring)", 10)
    f = D["crane"]["drives"]["fork"]
    p.t(60, 690, "Fork: F = %.0f N, P %.2f kW, 2-stage telescope (x%.0f), pinion %.1f rpm, stroke +-%.2f m" % (
        f["F_N"], f["P_kW"], D["crane"]["input"]["fork_mult"], f["n_out_rpm"], D["crane"]["input"]["fork_stroke_m"]), 12)
    P.append(p)

    # ---- P06 24 V + safety circuit
    p = Page("P06", "24 V supplies and safety circuit", [])
    p.box(cx(0) - 50, 60, 110, 60, "-TB1", "24 V ground", "%d A" % ps["ground_psu"])
    p.box(cx(0) - 50, 140, 110, 60, "-TB10", "24 V crane", "%d A + buffer" % ps["crane_psu"])
    p.xref(cx(0) - 50, 216, "-TB1 from -FC4 /P02.5")
    ys = 260
    p.l(cx(0), ys, cx(9.3), ys, 2, "#c00"); p.t(cx(0) - 10, ys - 6, "+24 V F", 10, color="#c00")
    estops = [("-SF51", "ground cab."), ("-SF52", "aisle door"), ("-SF55", "infeed CV1"), ("-SF56", "outfeed/pick"), ("-SF53", "crane cab."), ("-SF54", "crane platform")]
    for i, (tg, lab) in enumerate(estops):
        xx = cx(0.5 + i * 0.75)
        p.l(xx, ys, xx, ys + 20); p.contact_nc(xx, ys + 20, "", "", estop=True)
        p.l(xx + 26, ys, xx + 26, ys + 20); p.contact_nc(xx + 26, ys + 20, "", "")
        p.l(xx - 21, ys + 42, xx + 26, ys + 42, 1.0, dash="2 2")
        p.t(xx + 13, ys + 84, tg, 11, "middle", "bold"); p.t(xx + 13, ys + 98, lab, 10, "middle")
        p.l(xx, ys + 66, xx, ys + 76); p.l(xx + 26, ys + 66, xx + 26, ys + 76)
        p.l(xx, ys + 100, xx, ys + 110); p.l(xx + 26, ys + 100, xx + 26, ys + 110)
    p.box(cx(0.2), ys + 110, cx(5.0) - cx(0.2), 50, "-KF21 / -KF24  F-DI", "2 channels each, cross-circuit detection by test pulses", "", fill="#fff4e6")
    xd = cx(5.4)
    for j, (tg, lab) in enumerate([("-BG56", "door"), ("-BG57", "lock")]):
        xx = xd + j * 70
        p.l(xx, ys, xx, ys + 20); p.contact_nc(xx, ys + 20, "", "")
        p.t(xx, ys + 84, tg, 11, "middle", "bold"); p.t(xx, ys + 98, lab, 10, "middle")
        p.l(xx, ys + 66, xx, ys + 76); p.l(xx, ys + 100, xx, ys + 110)
    p.box(xd - 30, ys + 110, 130, 50, "-KF28 F-DI", "door + guard lock")
    xk = cx(7.6)
    p.box(xk - 40, ys + 30, 200, 130, "-KF2 F-CPU", "safety program (PL d / SIL 2..3)", "E-stop, door, SLS, muting", fill="#e6f0ff")
    p.l(cx(5.0), ys + 152, xd - 30, ys + 152, dash="5 3"); p.l(xd + 100, ys + 152, xk - 40, ys + 152, dash="5 3")
    yo = ys + 220
    p.box(cx(0.2), yo, cx(4.0) - cx(0.2), 50, "-KF22 F-DQ (PM switching)", "", "", fill="#fff4e6")
    p.l(xk + 40, ys + 160, xk + 40, yo - 20, dash="5 3"); p.l(xk + 40, yo - 20, cx(2.0), yo - 20, dash="5 3"); p.l(cx(2.0), yo - 20, cx(2.0), yo, dash="5 3")
    p.coil(cx(0.8), yo + 80, "-MB56", "guard lock")
    p.coil(cx(2.0), yo + 80, "-QA2", "crane contactor")
    p.coil(cx(3.2), yo + 80, "STO CV1-3", "conveyors")
    for xx in (cx(0.8), cx(2.0), cx(3.2)):
        p.l(xx, yo + 50, xx, yo + 70)
    p.xref(cx(2.0) + 20, yo + 128, "-QA2 contacts /P02.1")
    p.box(cx(5.0), yo, 330, 110, "PROFIsafe to drives", "-TA11 travel  -TA13 hoist  -TA14 fork  (STO, SS1, SLS, SBC)", "-TA81..83 conveyors (STO)", fill="#e6f0ff")
    p.l(xk + 40, ys + 160, xk + 40, yo, dash="5 3")
    p.t(cx(5.0) + 10, yo + 76, "E-stop: SS1 (ramp 0.5 s) -> STO + -QA2 off after 1 s", 10)
    p.t(cx(5.0) + 10, yo + 92, "Reset -SF58 (DI, edge) - no automatic restart", 10)
    y2 = yo + 170
    p.t(60, y2, "Safety functions (program): " + "; ".join("%s PLr %s -> PL %s %s" % (s["id"], s["PLr"], s["PL"], "OK" if s["ok"] else "FAIL") for s in sf), 11)
    P.append(p)

    # ---- P07 PLC + IO overview
    p = Page("P07", "PLC, ET 200SP, PROFINET, data light barrier", [])
    p.box(60, 70, 260, 90, "-KF2 F-CPU (ground +GC)", "S7-1500 1515F-2 PN or equal", "PN X1: devices, X2: factory VLAN 720", fill="#e6f0ff")
    gmods = [("-KF20", "IM PN"), ("-KF21", "F-DI 8"), ("-KF28", "F-DI 8"), ("-KF22", "F-DQ 4"), ("-KF25", "DI 16"), ("-KF26", "DQ 16"), ("-KF27", "AI 4")]
    for i, (tg, lab) in enumerate(gmods):
        p.box(360 + i * 92, 80, 88, 70, tg, lab)
    p.t(360, 70, "ground station (+GC)", 11, weight="bold")
    p.l(190, 160, 190, 240); p.l(190, 240, 1300, 240, 2.5, "#2a6fbb"); p.t(200, 234, "PROFINET (green cable)", 11, color="#2a6fbb")
    for x, tg, lab in [(300, "-TA81", "CV1 inv."), (420, "-TA82", "CV2 inv."), (540, "-TA83", "CV3 inv."), (660, "-BG110", "scanner"), (780, "-BG111", "scanner")]:
        p.l(x + 40, 240, x + 40, 270); p.box(x, 270, 100, 46, tg, lab)
    p.l(1000, 240, 1000, 300); p.box(940, 300, 130, 50, "-KF70", "data light barrier", "ground (aisle end)")
    p.e.append('<path d="M 1005 360 l 0 60" stroke="#c00" stroke-width="2" stroke-dasharray="6 4"/>')
    p.t(1015, 395, "optical link 100 Mbit/s (PROFINET + PROFIsafe)", 11, color="#c00")
    p.box(940, 430, 130, 50, "-KF71", "data light barrier", "crane")
    p.l(1005, 480, 1005, 520); p.l(120, 520, 1300, 520, 2.5, "#2a6fbb"); p.t(130, 514, "PROFINET crane", 11, color="#2a6fbb")
    cmods = [("-KF30", "IM PN"), ("-KF23", "F-DI 8"), ("-KF24", "F-DI 8"), ("-KF31", "DI 16"), ("-KF34", "DI 16"), ("-KF32", "DQ 8")]
    p.t(180, 560, "crane station (+CC)", 11, weight="bold")
    for i, (tg, lab) in enumerate(cmods):
        p.box(120 + i * 92, 570, 88, 70, tg, lab)
    p.l(164, 520, 164, 570)
    for x, tg, lab in [(700, "-TA11", "travel"), (810, "-TA13", "hoist"), (920, "-TA14", "fork"), (1030, "-BG15", "laser x"), (1140, "-BG45", "bar code z")]:
        p.l(x + 45, 520, x + 45, 570); p.box(x, 570, 100, 46, tg, lab)
    nf = sum(1 for r in iol if r[3] == "F-DI"); nd = sum(1 for r in iol if r[3] == "DI"); nq = sum(1 for r in iol if r[3] in ("DQ", "F-DQ"))
    p.t(60, 720, "I/O count: F-DI %d, DI %d, DQ/F-DQ %d, AI %d, PROFINET/TCP devices %d (io_list.csv)." % (
        nf, nd, nq, sum(1 for r in iol if r[3] == "AI"), sum(1 for r in iol if r[3] in ("PROFINET", "TCP"))), 12)
    p.t(60, 742, "Spare capacity >= 20 % per module type (IEC 61131 practice); safety modules on separate 24 V F-group with own PM switching.", 12)
    P.append(p)

    # ---- P08 positioning + sensors
    p = Page("P08", "Positioning and crane sensors", [])
    L = D["rack"]["length_m"]; Hr = D["rack"]["rack_height_m"]
    ox, oy, sx, sz = 190, 640, 840 / (L + 4), 480 / (Hr + 1)
    p.r(ox, oy - Hr * sz, L * sx, Hr * sz, fill="#f3f3f3", dash="4 3"); p.t(ox + 4, oy - Hr * sz - 8, "rack %.1f x %.1f m (side view)" % (L, Hr), 11)
    p.l(ox - 60, oy, ox + (L + 3) * sx, oy, 3)
    xc = ox + 0.3 * L * sx
    p.r(xc - 10, oy - (Hr + 0.5) * sz, 20, (Hr + 0.5) * sz, fill="#ffe8b0"); p.t(xc + 14, oy - 0.3 * Hr * sz, "mast", 10)
    p.r(xc + 10, oy - 0.55 * Hr * sz, 60, 18, fill="#ffd27f"); p.t(xc + 74, oy - 0.55 * Hr * sz + 13, "carriage + fork", 10)
    p.box(xc - 84, oy - 30, 60, 26, "-BG15", "")
    p.l(xc - 84, oy - 17, ox - 50, oy - 17, 1.2, "#c00", "4 3"); p.r(ox - 58, oy - 40, 8, 40, fill="#c00"); p.t(ox - 80, oy - 46, "reflector", 10)
    p.t(ox - 40, oy + 22, "laser x (+-2 mm)", 10)
    p.l(xc - 16, oy - Hr * sz, xc - 16, oy - 34, 3, "#2a6fbb"); p.t(xc - 160, oy - Hr * sz * 0.8, "-BG45 bar-code tape", 10, color="#2a6fbb")
    for xs_, tg in [(ox - 30, "-BG18 final"), (ox - 5, "-BG16 slow"), (ox + L * sx - 10, "-BG17 slow"), (ox + L * sx + 20, "-BG19 final")]:
        p.r(xs_, oy - 14, 10, 14, fill="#555"); p.t(xs_ - 6, oy + 40 + (14 if "final" in tg else 0), tg, 10)
    for zz, tg in [(Hr + 0.25, "-BG37 upper final"), (Hr - 0.35, "-BG36 upper slow"), (0.75, "-BG38 lower slow"), (0.15, "-BG39 lower final")]:
        yy = oy - zz * sz
        p.r(xc + 12, yy - 4, 8, 8, fill="#555"); p.t(xc + 210, yy + (4 if zz > 0.5 else -2), tg, 10); p.l(xc + 22, yy, xc + 205, yy, 0.8, "#888", "2 2")
    tx = 1080
    p.t(tx, 90, "Sensor list (DI unless noted)", 12, weight="bold")
    lines = ["-BG15 laser distance travel, PROFINET", "-BG45 bar code hoist, PROFINET (safe ch 2)", "-BG16/-BG17 travel slow-down",
             "-BG18/-BG19 travel final limit, F-DI 2 ch", "-BG36/-BG38 hoist slow-down", "-BG37/-BG39 hoist final limit, F-DI 2 ch",
             "-BG34 slack rope, F-DI", "-BG30 catch / overspeed, F-DI", "-BW35 load pin + -KF35 monitor", "-BG21..25 fork position",
             "-BG26/27 load on fork", "-BG28/29 protrusion front/rear", "-BG40/41 double occupancy", "-BG42 slot fine position",
             "-BG50..53 brake feedbacks"]
    for i, s in enumerate(lines):
        p.t(tx, 114 + 20 * i, s, 10)
    bx = D.get("_budget", None)
    p.t(60, 720, "Final limits are positioned after the slow-down switches and before the buffers: stop distance from %.1f m/s at 0.5 m/s^2 = %.1f m (travel) - SLS 0.25 m/s near the ends keeps it < 0.1 m." % (
        D["crane"]["input"]["v_x"], D["crane"]["input"]["v_x"] ** 2 / (2 * D["crane"]["input"]["a_x"])), 11)
    P.append(p)

    # ---- P09 conveyors, contour, curtains
    p = Page("P09", "I/O conveyors, contour check, light curtains", [])
    p.l(cx(0), 80, cx(9.3), 80, 2); p.t(cx(0), 74, "3~ from -FC3 /P02.4", 10)
    for i, (tg, mt, lab) in enumerate([("-TA81", "-MA81", "CV1 infeed + contour"), ("-TA82", "-MA82", "CV2 outfeed / AGV"), ("-TA83", "-MA83", "CV3 pick station")]):
        xx = cx(0.8 + i * 2.2)
        p.l(xx, 80, xx, 110); p.box(xx - 50, 110, 120, 56, tg, "%.2f kW STO" % C["conv"]["inv_kW"])
        p.l(xx, 166, xx, 210); p.motor(xx, 236, mt, lab)
    p.r(60, 330, 900, 130, fill="#f7f7f7")
    p.t(70, 350, "CV1 infeed (top 0.70 m, 0.2 m/s):", 12, weight="bold")
    p.r(80, 370, 820, 40, fill="#e8eef8"); p.t(90, 395, "entry -BG91 -> scale -BW92 -> contour -BG101..106 + scanner -BG110 -> transfer -BG93 (crane pick-up)", 11)
    p.t(70, 440, "reject (overweight, protrusion, no ID) -> conveyor reverses to entry, red beacon -PF91.3, HMI message", 11)
    p.r(60, 480, 900, 120, fill="#f7f7f7")
    p.t(70, 500, "Light curtains type 4 (ISO 13855): -BG81 infeed, -BG83 outfeed, -BG85 pick station", 12, weight="bold")
    s13 = iso13855()
    p.t(70, 522, "S = K x T + C = %d mm/s x %.3f s + %.0f mm = %.0f mm  -> mount the curtain >= %.0f mm from the danger point" % (
        s13["K"], s13["T_s"], s13["C"], s13["S_mm"], s13["S_mm"]), 11)
    p.t(70, 544, "Muting: 2 sensors crossed (-BG86/-BG87, -BG88/-BG89), sequence and time window 0.5-4 s in the F-CPU; crate only, persons stop", 11)
    p.t(70, 566, "Muting lamp + override with hold-to-run key only (EN 61496 / IEC 62046).", 11)
    p.r(1000, 330, 340, 270, fill="#fff4e6")
    p.t(1010, 350, "AGV handover -KF130 (item F5)", 12, weight="bold")
    for i, s in enumerate(["DI: AGV present", "DI: AGV ready", "DI: transfer complete", "DI: AGV fault", "DQ: conveyor ready",
                           "DQ: transfer running", "DQ: conveyor fault", "optical / wireless IO coupler,", "parallel 8-bit handshake (VDI 2510 style)"]):
        p.t(1010, 374 + 22 * i, s, 11)
    p.t(60, 700, "Contour check (EN 528 / EN 619): height, width and depth protrusion, crate base - a crate that does not fit never enters the rack.", 12)
    p.t(60, 722, "Weight: 4 load cells, crate > %d kg gross -> reject (SF6 backup at the crane: -BW35)." % D["crate"]["max_gross_kg"], 12)
    P.append(p)

    # ---- P10 network
    p = Page("P10", "Network, Modbus TCP server, VLAN 720", [])
    p.box(560, 70, 280, 60, "Firewall / L3 core", "IEC 62443 zones + conduits", fill="#eeeeee")
    p.box(120, 70, 300, 60, "FMS cell controller 10.70.1.10", "fmsctl (VLAN 701 servers)", fill="#e6f0ff")
    p.l(420, 100, 560, 100, 2)
    p.l(700, 130, 700, 200, 2)
    p.box(560, 200, 280, 60, "-KF90 managed switch +GC", "VLAN 720, 10.70.20.0/24", fill="#e6f0ff")
    devs_n = [(120, "-KF2 F-CPU X2", "10.70.20.51 (Modbus TCP :502)"), (400, "-PF100 HMI", "10.70.20.55"), (680, "-PF120 pick-to-light", "10.70.20.61"),
              (960, "AGV fleet server / Wi-Fi AP", "10.70.20.70-79 (item F5)")]
    for x, tg, lab in devs_n:
        p.box(x, 330, 240, 56, tg, lab)
    p.l(240, 300, 1080, 300, 2); p.l(700, 260, 700, 300, 2)
    for x, _, _ in devs_n:
        p.l(x + 120, 300, x + 120, 330, 2)
    p.box(120, 450, 520, 150, "Modbus TCP V1.2a (MB_SERVER in -KF2)", "registers 0-449 (fmsctl/spec/regmap.py), type code 7 = AS/RS", "status 300 bay, 301 level, 302 load on fork, 303 I/O ready", fill="#fafafa")
    p.t(130, 545, "job 402 bay, 403 level, 404 side; cmd 30 store / 31 retrieve", 10)
    p.t(130, 561, "toggle-bit handshake REQ 202.0 / ACK 8.0, ackSeq 9, sequence guard (V1.2a)", 10)
    p.t(130, 577, "gateway heartbeat 226, watchdog 5 s -> crane finishes move, then IDLE", 10)
    p.box(700, 450, 520, 150, "PROFINET device network (X1, not routed)", "crane + conveyors + scanners in the cabinet / field", "isolated from the factory VLAN (X1 / X2 separate)", fill="#fafafa")
    p.t(710, 545, "PROFIsafe F-addresses unique per F-device (DIP / TIA)", 10)
    p.t(710, 561, "data light barrier: line topology, MRP not possible across the link", 10)
    p.t(60, 700, "Bandwidth: Modbus polling 0.2 s x 1 request of ~140 registers <= 10 kbit/s; the PROFINET cycle 4 ms stays inside the cabinet network.", 12)
    P.append(p)
    return P


# ----------------------------------------------------------------------------- run / report
def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)


def build(D):
    D_LEN[0] = D["rack"]["length_m"]
    C = calc(D)
    devs = devices(C)
    iol = io_list()
    cb = cables(C, D)
    ps = psu(iol, devs)
    risk, sf, ex = safety(C, D)
    return C, devs, iol, cb, ps, risk, sf, ex


def cmd_run(D, out):
    os.makedirs(out, exist_ok=True)
    C, devs, iol, cb, ps, risk, sf, ex = build(D)
    write_csv(os.path.join(out, "devices.csv"), ["tag", "description", "type_class", "location", "page", "mA_24V", "safety"], devs)
    write_csv(os.path.join(out, "io_list.csv"), ["address", "tag", "description", "type", "module", "safety", "page", "mA_24V"], iol)
    write_csv(os.path.join(out, "cables.csv"), ["cable", "from", "to", "type", "cores", "length_m", "route", "emc"], cb)
    write_csv(os.path.join(out, "safety.csv"), ["hazard", "situation", "S", "F", "P", "PLr", "measure"], risk)
    for pg in pages(C, D, devs, iol, sf, ps):
        with open(os.path.join(out, "%s.svg" % pg.no), "w", encoding="utf-8") as fh:
            fh.write(pg.svg())
    m = C["motors"]
    rep = ["# F3 electrical design and safety - generated report", "",
           "Generated by `asrs_elec.py run` from `out/design_result.json`. **DESIGN - to be checked and released by a qualified engineer.**", "",
           "## 1 Motors and inverters", "", "| Axis | Motor | P_n kW | I_n A | P_peak kW | I_peak A | Inverter kW / I_r A | Motor cable | dU % |", "|---|---|---|---|---|---|---|---|---|"]
    for ax, v in m.items():
        rep.append("| %s | %s | %.2f | %.2f | %.2f | %.2f | %.1f / %.1f | 4G%g, %.1f m | %.2f |" % (
            ax, v["motor"], v["P_n"], v["I_n"], v["P_pk"], v["I_pk"], v["inv_kW"], v["inv_I"], v["cable_mm2"], v["cable_L"], v["cable_du"]))
    cr, s, r, lp, b = C["crane"], C["supply"], C["rail"], C["loop"], C["brake"]
    rep += ["", "## 2 Crane and supply", "",
            "- Crane thermal current I_th = (%.1f x %.1f + %.1f) kW / (sqrt3 400 0.95 0.97) = **%.2f A**; peak I_pk = (%.2f + %.1f) kW / ... = **%.2f A**." % (
                PARAM["k_s"], cr["sumPn"], PARAM["P_aux_kW"], cr["I_th"], cr["sumPpk"], PARAM["P_aux_kW"], cr["I_pk"]),
            "- Infeed module -TA10: %.0f kW (sum of peaks x 0.8 simultaneity)." % cr["infeed_kW"],
            "- Conveyors 3 x 0.75 kW: %.2f A; stationary + lighting %.2f A." % (s["I_conv"], s["I_stat"]),
            "- Design current I_b = **%.2f A** (S = %.1f kVA), peak %.2f A (%.1f kVA)." % (s["I_b"], s["S_kVA"], s["I_pk"], s["S_pk_kVA"]),
            "- Supply fuse gG **%d A**, cable **5G%g** (I_z %.1f A at 40 C), dU at peak %.2f %%; main switch %d A; crane MCCB -FC2 %d A, feeder 5G%g." % (
                s["fuse"], s["cable_mm2"], s["I_z"], s["du_supply"], s["main_switch_A"], s["FC2_A"], C["feeder_rail"]["mm2"]),
            "- Conductor rail **%d A** class (R' %.2f, X' %.2f ohm/km - assumption), L = %.1f m, end feed: dU %.2f %% (centre feed %.2f %%); total %.2f %% <= 5 %%." % (
                r["A"], r["R"], r["X"], r["L"], r["du_end"], r["du_centre"], s["du_total_end"]),
            "- Fault loop at far end: Z_s = %.3f + %.3f + %.3f + %.3f = **%.3f ohm** <= %.3f ohm (I_i %d A); I_k1 = %.0f A." % (
                PARAM["Z_up_ohm"], lp["R_sup"], lp["R_rail"], lp["R_cr"], lp["Zs"], lp["Zs_max"], lp["Ii"], lp["Ik1"]),
            "- Short-circuit level at the ground cabinet (estimate from Z_up): I_k3 ~ %.1f kA -> all devices >= 10 kA breaking capacity (or back-up by -FC0)." % lp["Ik3_gc"],
            "", "## 3 Brake resistor", "",
            "- P_brk = %d x (9.81 + %.1f) x %.1f x %.2f + (%.0f x %.1f - %.0f) x %.1f x %.2f = **%.0f W**" % (
                b["m_h"], D["crane"]["input"]["a_z"], D["crane"]["input"]["v_z"], D["crane"]["input"]["eta_H"], b["m_t"], D["crane"]["input"]["a_x"], b["F_roll"],
                D["crane"]["input"]["v_x"], D["crane"]["input"]["eta_T"], b["P_brk"]),
            "- R <= 750^2 / (1.2 x P_brk) = %.1f ohm -> **%d ohm** (peak %.0f W; >= chopper minimum %.0f ohm: %s)" % (b["R_max"], b["R_sel"], b["P_peak_R"], PARAM["R_min_chopper"], b["R_ok_min"]),
            "- E_cycle = %.0f J (h = %.2f m), t_SC %.1f s -> P_avg %.0f W -> continuous rating **%.1f kW**" % (b["E_cycle"], b["h"], b["t_sc"], b["P_avg"], b["P_cont_kW"]),
            "", "## 4 24 V supplies", "",
            "- Ground: %.2f A -> PSU %d A; crane: %.2f A -> PSU %d A (+ capacitor buffer for collector micro-interruptions)." % (
                ps["ground_A"], ps["ground_psu"], ps["crane_A"], ps["crane_psu"]),
            "", "## 5 Safety functions (ISO 13849-1, simplified method)", "",
            "| SF | Function | PLr | Subsystems | PL achieved | OK |", "|---|---|---|---|---|---|"]
    for f in sf:
        rep.append("| %s | %s | %s | %s | **%s** | %s |" % (f["id"], f["desc"], f["PLr"], "<br>".join("%s: %s (%s)" % (a, pl, t) for a, pl, t in f["subs"]), f["PL"], "yes" if f["ok"] else "NO"))
    rep += ["", "Worked numbers: SF1 n_op = %.0f /year -> MTTFd = %.0f a (capped 100); SF2 n_op = %.0f /year -> MTTFd = %.0f a; SF7 brakes n_op = %.0f /year -> MTTFd = %.1f a; CCF score %d (>= 65)." % (
        ex["SF1"]["nop"], ex["SF1"]["mttfd"], ex["SF2"]["nop"], ex["SF2"]["mttfd"], ex["SF7"]["nop"], ex["SF7"]["mttfd"], ex["ccf"])]
    s13 = iso13855()
    rep += ["", "ISO 13855 light curtain: T = %.3f s, S = %d x %.3f + %.0f = **%.0f mm**." % (s13["T_s"], s13["K"], s13["T_s"], s13["C"], s13["S_mm"]),
            "", "## 6 Risk assessment (ISO 12100, risk graph ISO 13849-1 Annex A)", "", "| Hazard | Situation | S | F | P | PLr | Measure |", "|---|---|---|---|---|---|---|"]
    rep += ["| %s | %s | %s | %s | %s | %s | %s |" % row for row in risk]
    rep += ["", "Counts: %d devices, %d I/O points, %d cables, 10 schematic pages." % (len(devs), len(iol), len(cb))]
    with open(os.path.join(out, "calc_report.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(rep) + "\n")
    print("\n".join(rep))
    print("\nwritten:", out)
    return 0


def selftest(D):
    ok = []

    def check(n, c):
        ok.append(bool(c))
        print("  [%s] %s" % ("PASS" if c else "FAIL", n))

    hand = 11000 / (SQ3 * 400 * 0.84 * 0.914)
    check("motor current 11 kW = %.2f A (hand %.2f)" % (motor_current(11.0), hand), abs(motor_current(11.0) - hand) < 1e-9 and 20 < hand < 22)
    check("docs/33 voltage drop: 49.5 A, 35 m, 10 mm2 -> 1.509 %% (%.3f)" % du_pct(49.5, 35, 10), abs(du_pct(49.5, 35, 10) - 1.509) < 0.002)
    check("docs/33 cable rule: gG 40 A needs I_z >= 44.1 A -> 10 mm2 at 40 C", size_cable(30.86, 40, 35, "fuse", 0.87, 3.0, 49.5)[0] == 10)
    check("ISO 13849 MTTFd: B10d 2e6, 7200 s -> 11 364 a, capped at 2500 a; B10d 2e6 at 20.5 s -> 32.4 a",
          abs(2e6 / (0.1 * 220 * 16 * 3600 / 7200) - 11363.6) < 0.1 and mttfd_b10d(2e6, 7200)[0] == 2500.0
          and abs(mttfd_b10d(2e6, 20.5)[0] - 2e6 / (0.1 * 220 * 16 * 3600 / 20.5)) < 1e-9)
    check("symmetrisation equal channels = channel value", abs(sym(50, 50) - 50) < 1e-9)
    check("bar chart: Cat 3, DC medium, MTTFd high -> d; Cat 4 DC high high -> e", pl_bar("3", 0.95, 100) == "d" and pl_bar("4", 0.99, 100) == "e")
    check("Table 11: d,d,d,d -> c ; d,e,e -> d", combine(["d"] * 4) == "c" and combine(["d", "e", "e"]) == "d")
    check("risk graph S2 F1 P2 -> d, S1 F2 P2 -> c", plr("S2", "F1", "P2") == "d" and plr("S1", "F2", "P2") == "c")
    C, devs, iol, cb, ps, risk, sf, ex = build(D)
    for ax, v in C["motors"].items():
        check("%s motor cable dU %.2f %% <= 3 %%" % (ax, v["cable_du"]), v["cable_du"] <= 3.0)
    check("supply dU at peak %.2f %% <= 3 %%" % C["supply"]["du_supply"], C["supply"]["du_supply"] <= 3.0)
    check("rail end total dU %.2f %% <= 5 %%" % C["supply"]["du_total_end"], C["supply"]["du_total_end"] <= 5.0)
    check("fault loop Z_s %.3f <= %.3f ohm" % (C["loop"]["Zs"], C["loop"]["Zs_max"]), C["loop"]["Zs"] <= C["loop"]["Zs_max"])
    check("brake resistor >= chopper minimum and <= R_max", C["brake"]["R_ok_min"] and C["brake"]["R_sel"] <= C["brake"]["R_max"])
    check("inverters: I_r >= I_n and 1.5 I_r >= I_peak", all(v["inv_I"] >= v["I_n"] and 1.5 * v["inv_I"] >= v["I_pk"] for v in C["motors"].values()))
    tags = [d[0] for d in devs]
    motors = [t for t in tags if "-MA" in t]
    feeders_ok = True
    for t in motors:
        num = t.split("-MA")[1]
        drow = [d for d in devs if d[0].endswith("-TA" + num)]
        feeders_ok &= bool(drow) and ("STO" in drow[0][1] or "STO" in drow[0][2])
    check("every motor has its inverter (feeder) with STO (%d motors)" % len(motors), feeders_ok)
    check("device tags unique (%d)" % len(tags), len(tags) == len(set(tags)))
    addrs = [r[0] for r in iol]
    check("I/O addresses unique (%d)" % len(addrs), len(addrs) == len(set(addrs)))
    check("I/O tags unique", len({r[1] for r in iol}) == len(iol))
    check("every safety function PL >= PLr (%s)" % ", ".join("%s %s/%s" % (f["id"], f["PL"], f["PLr"]) for f in sf), all(f["ok"] for f in sf))
    check("risk measures cover every PLr >= d with an SF", all("SF" in r[6] or r[5] < "c" for r in risk))
    good = True
    for pg in pages(C, D, devs, iol, sf, ps):
        try:
            xml.dom.minidom.parseString(pg.svg())
        except Exception:
            good = False
    check("10 SVG pages well-formed", good)
    print("SELFTEST %s (%d/%d)" % ("PASS" if all(ok) else "FAIL", sum(ok), len(ok)))
    return 0 if all(ok) else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--design", default=None)
    sp = ap.add_subparsers(dest="cmd")
    sp.add_parser("selftest")
    r = sp.add_parser("run"); r.add_argument("--out", default=os.path.join(HERE, "out", "elec"))
    a = ap.parse_args(argv)
    D = load_design(a.design)
    if a.cmd == "selftest":
        return selftest(D)
    if a.cmd == "run":
        return cmd_run(D, a.out)
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
