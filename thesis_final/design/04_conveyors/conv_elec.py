#!/usr/bin/env python3
"""Final thesis item F4.5 - electrics, safety and communication of all F4 conveyors and stations.

  1 drive concept   why every conveyor drive needs a ramp (DOL start acceleration vs crate / product limits)
                    -> decentralised drives with integrated inverter + STO on PROFINET
  2 drives & power  drive list per area (AS/RS front, P&D stations + flow racks, assembly line, HMC station),
                    currents, feeders (fuse, cable, voltage drop), power bus with distributed loads, 24 V budget
  3 I/O             I/O per element type -> per area -> remote I/O stations
  4 communication   Case A (built-in PLC ports) and Case B (expansion modules) for PLC-CONV1 and PLC-ASM1
                    (module optimisation of F3 Part D reused), PROFINET load
  5 safety          risk graph -> PLr; safety functions SF-C1..C7 with PL achieved (ISO 13849-1 simplified method,
                    helpers of F3 asrs_elec reused); ISO 13855 distance at the AGV docks; pit safety edge overrun
  6 compressed air  consumption of the pneumatic actuators (input F11)
  7 cost

Python 3 standard library only, offline. Data: elec_data.json + F4.1 (out/modules.csv) + F4.3 (out/stations/stations_specs.json)
+ F3 (asrs_elec helpers, comm_data.json, asrs_comm.select_modules). Outputs (out/elec/): elec_report.md, drives.csv,
io_summary.csv, safety.csv, comm_cases.csv, air.csv, elec_specs.json. Guide: Doctor paper/61 chapters 49-60.

Commands
  python conv_elec.py selftest
  python conv_elec.py run

Formulas
  DOL start   T_out = k_start * P 9550 / n_m * i * eta ; F = T_out / (d0/2) ; a = (F - F_res) / m
  current     I_in = P / (eta_m * eta_inv * sqrt3 * U * cos_in) ; I_b = k_s * sum I_in (>= largest)
  power bus   uniform distributed load: dU% = sqrt3 * I * R' * (L / 2) * cos_phi / U * 100, R' = rho70 / A
  air         V_free = n_acting * (pi/4) d^2 s * (p + 1) / 1 bar ; Q = sum V_free * cycles/h / 60 (+ leaks)
  ISO 13855   multi-beam (body): S = K T + 850 mm ; K = 1600 mm/s
  pit edge    overrun s = v (t_edge + t_valve) <= edge deformation travel
  PL          as F3: MTTFd = B10d / (0.1 n_op), Cat 3 symmetrisation, bar chart, Table 11 combination
"""

import argparse
import copy
import csv
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
F3 = os.path.join(HERE, "..", "03_asrs")
sys.path.insert(0, F3)
import asrs_elec as E3   # noqa: E402
import asrs_comm as AC   # noqa: E402

SQ3 = math.sqrt(3)


def load(path=os.path.join(HERE, "elec_data.json")):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def motor_data(d, P):
    if str(P) in d["small_motor"]:
        return tuple(d["small_motor"][str(P)])
    return E3.MOTOR_DATA[P]


# ============================================================================= element counts (from F4.1 - F4.4)
def counts(d):
    mods = {}
    with open(os.path.join(HERE, "out", "modules.csv"), encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            mods[r["module"]] = int(float(r["qty"]))
    st = json.load(open(os.path.join(HERE, "out", "stations", "stations_specs.json"), encoding="utf-8"))
    lanes = st["flow"]["lanes"]
    part_lanes = sum(r[4] for r in lanes if not r[1].startswith("empty"))
    depts = sorted({r[0] for r in lanes})
    line_side = sum(r[2] for r in lanes)
    rl_pd = mods["RL"] - line_side + 3 * len(depts)
    asm = {}
    with open(os.path.join(HERE, "out", "assembly", "modules_assembly.csv"), encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            asm[r["module"]] = int(float(r["qty"]))
    gates = next(v for k, v in asm.items() if k.startswith("gate_section"))
    lt = next(v for k, v in asm.items() if k.startswith("lift_table"))
    ll = next(v for k, v in asm.items() if k.startswith("lift_locate"))
    return {
        "AF": {"CC": mods["CC"], "TU": mods["TU"], "RCX": mods["RCX"], "check_TU1": 1, "estop": d["estops"]["AF"], "dock_tu": 3, "dock": 3},
        "PD": {"RL": rl_pd, "PD_end": mods["PD_end"], "flow_lane": part_lanes, "flow_block": len(depts), "estop": d["estops"]["PD"],
               "dock": mods["PD_end"] + len(depts), "_line_side_moved": line_side},
        "ASM": {"section": asm["section_drive"], "corner": asm["corner_unit"], "spur": asm["spur_unit"], "stopper": asm["stopper"],
                "lift_locate": ll, "lift_table": lt, "test_dock": asm["test_dock"], "gate": gates, "load_station": 1, "estop": d["estops"]["ASM"]},
        "HMC": {"hmc_station": 1, "estop": d["estops"]["HMC"]}}


# ============================================================================= 1 drive concept
def dol_check(d):
    dc = d["dol_check"]
    g = 9.81
    d0 = 0.0916
    out = {}
    # chain zone CC: 0.18 kW, i 34, both strands
    Tn = 0.18 * 9550 / 1400
    T_out = dc["T_start_ratio"] * Tn * 34 * 0.92
    F = T_out / (d0 / 2)
    for name, m in (("light crate 45 kg", dc["light_crate_kg"]), ("full crate 300 kg", dc["full_crate_kg"])):
        Fres = m * g * 0.12 + 2 * 1.25 * 1.2 * g * 0.25
        a = (F - Fres) / (m + 2 * 1.25 * 2.6)
        out["CC " + name] = {"F": F, "a": a, "limit": dc["content_limit_g"] * g, "ok": a <= dc["content_limit_g"] * g}
    # assembly section 0.75 kW, i 34, one carrier moving (the others accumulate)
    Tn = 0.75 * 9550 / 1400
    T_out = dc["T_start_ratio"] * Tn * 34 * 0.92
    F = T_out / (d0 / 2)
    m = dc["carrier_product_kg"]
    a = (F - m * g * 0.05) / (m + 2 * 2 * 25 * 2)
    out["assembly section, 1 carrier moving"] = {"F": F, "a": a, "limit": dc["slide_limit"], "ok": a <= dc["slide_limit"]}
    ramp = {"a_ramp": 0.3, "t_ramp_s": 0.2 / 0.3}
    return out, ramp


# ============================================================================= 2 drives, power, 24 V
def drives(d, C):
    rows = []
    mapping = {"AF": {"CC": "CC", "TU": "TU", "RCX": "RCX"}, "PD": {"RL": "RL", "PD_end": "PD_end"},
               "ASM": {"section": "section", "corner": "corner", "spur": "spur", "lift_table": "lift_table", "load_station": "load_station"},
               "HMC": {"hmc_station": "hmc_index"}}
    for area, m in mapping.items():
        for elem, dkey in m.items():
            n = C[area].get(elem, 0)
            for name, P in d["drives"][dkey]:
                cph, eta = motor_data(d, P)
                I_in = P * 1000 / (eta * d["inverter_eta"] * SQ3 * d["U"] * d["inverter_cos_in"])
                rows.append([area, elem, name, P, n, round(I_in, 3), round(n * I_in, 2), round(n * P, 2)])
    return rows


def power(d, C, drv):
    out = {}
    fuses = [10, 16, 20, 25, 32, 40, 50, 63]
    for area, a in d["areas"].items():
        rs = [r for r in drv if r[0] == area]
        I_sum = sum(r[6] for r in rs)
        I_max = max((r[5] for r in rs), default=0)
        P_sum = sum(r[7] for r in rs)
        I_b = max(d["k_s"] * I_sum, I_max) + 2.0                 # + 24 V PSU, controls, lighting of the station
        I_n = next(f for f in fuses if f >= I_b)
        L = a["feeder_m"]
        if area == "PD":
            # power bus with the drives distributed along the spine: equivalent point load at L/2
            pb = d["power_bus"]
            sel = None
            for A in pb["A_mm2"]:
                du = SQ3 * I_b * (pb["R70"] / A) * (L / 2) * 0.9 / d["U"] * 100
                if du <= pb["du_max"] and E3.CABLE_IZ.get(A, 99) >= 1.6 * I_n / 1.45:
                    sel = (A, du)
                    break
            out[area] = {"P_kW": P_sum, "I_sum": I_sum, "I_b": I_b, "fuse": I_n, "cable": "power bus %g mm2" % sel[0], "du": sel[1], "A": sel[0], "n": sum(r[4] for r in rs)}
        else:
            A, iz, du = E3.size_cable(I_b, I_n, L)
            out[area] = {"P_kW": P_sum, "I_sum": I_sum, "I_b": I_b, "fuse": I_n, "cable": "5G%g" % A, "du": du, "A": A, "n": sum(r[4] for r in rs)}
    return out


def io_summary(d, C):
    rows = {}
    for area, elems in C.items():
        tot = {"DI": 0, "DO": 0, "F-DI": 0, "F-DO": 0, "AI": 0, "pn": 0, "coupler": 0}
        for e, n in elems.items():
            if e.startswith("_") or e == "dock":
                continue
            spec = d["io"].get(e, {})
            for k in tot:
                tot[k] += n * spec.get(k, 0)
        rows[area] = tot
    return rows


def psu(d, io, C):
    m = d["psu_mA"]
    out = {}
    for area, t in io.items():
        n_rio = math.ceil((t["DI"] + t["DO"] + t["F-DI"] + t["F-DO"] + t["AI"]) / 48.0)
        lc = C[area].get("dock", 0) + (1 if area in ("AF", "HMC") else 0)
        mA = t["DI"] * m["DI"] + t["DO"] * m["DO"] * 0.3 + t["F-DI"] * m["F-DI"] + t["F-DO"] * m["F-DO"] + t["AI"] * m["AI"] + \
            n_rio * m["remote_io"] + t["coupler"] * m["coupler"] + lc * m["light_curtain"] + 2 * m["pn_switch"]
        I = 1.25 * mA / 1000
        out[area] = {"remote_io": n_rio, "I_A": mA / 1000, "I_psu": I, "psu_A": next(p for p in (5, 10, 20, 40) if p >= I)}
    return out


# ============================================================================= 4 communication cases
def comm(d, C, io, rio):
    base = AC.load()
    out = {}
    for plc, area in (("PLC-CONV1", "PD"), ("PLC-ASM1", "ASM")):
        dd = copy.deepcopy(base)
        dd["demand"] = {"A": d["comm"][plc]["A"], "B": d["comm"][plc]["B"]}
        dd["case_cpu"] = {"A": "S7-1515F-2PN", "B": "S7-1515F-2PN"}
        res = {}
        for case in ("A", "B"):
            best, feas = AC.select_modules(dd, case)
            res[case] = {"modules": best["modules"], "comm_EUR": best["comm_EUR"], "W": best["W"], "W_avail": best["W_avail"], "n_feas": len(feas)}
        n_drv = io[area]["pn"]
        devs = [("drive", *d["comm"]["drive_bytes"])] * n_drv + [("rio", *d["comm"]["rio_bytes"])] * rio[area]["remote_io"] + \
               [("dev", *d["comm"]["dev_bytes"])] * (io[area]["coupler"])
        load_A = AC.pn_load(devs, d["comm"]["update_ms"])
        half = devs[: len(devs) // 2]
        load_B = AC.pn_load(half, d["comm"]["update_ms"])
        res["pn_devices"] = len(devs)
        res["load_A_pct"] = load_A
        res["load_B_pct"] = load_B
        res["why_B"] = d["comm"][plc]["why_B"]
        out[plc] = res
    return out


# ============================================================================= 5 safety
def safety(d):
    S = d["safety"]
    PARAM = dict(E3.PARAM, d_op=S["d_op"], h_op=S["h_op"])
    E3.PARAM.update(PARAM)
    risk = [
        ("person reaches into the lane end while the AGV transfers (rollers, crate, stop plate)", "S1", "F2", "P2", "SF-C2 light curtain + muting at every AGV dock"),
        ("person caught between two carriers / at a transfer on the assembly loop", "S1", "F2", "P1", "fixed guards + SF-C3 gate interlock"),
        ("person inside the loop when a gate section lifts / closes, or the loop restarts", "S2", "F1", "P2", "SF-C3 gate interlock with guard locking"),
        ("foot crushed under the lowering lift table at the pit edge", "S2", "F2", "P1", "SF-C4 safety edge + two lowering valves"),
        ("hand caught at the HMC pallet shuttle", "S2", "F1", "P2", "SF-C5 light curtain S = 680 mm (F4.3)"),
        ("hand in the crate at Z31 while the crate moves out / TU lifts", "S1", "F2", "P2", "SF-C6 pick-window light curtain"),
        ("finger at the test docking slide", "S1", "F1", "P2", "SF-C7 force-limited slide + hood interlock"),
        ("any hazard - emergency", "S2", "F1", "P2", "SF-C1 E-stop per area")]
    rr = [(h, s, f, p, E3.plr(s, f, p), m) for h, s, f, p, m in risk]
    ccf = E3.ccf_score(["separation", "overvoltage_protection", "proven_components", "fmea", "competence", "emc", "environment"])
    sf = []

    def add(name, plr_, desc, subs):
        res = []
        for sname, kind, data in subs:
            if kind == "certified":
                res.append((sname, data["PL"], "certified %s (PFHd %.1e)" % (data["PL"], data["PFHd"])))
            else:
                ch = [E3.channel_mttfd([E3.mttfd_b10d(B, data["t_cycle"])[0] if B else mt for B, mt in comps]) for comps in data["channels"]]
                m = E3.sym(*ch) if len(ch) == 2 else ch[0]
                mc = min(m, 100.0)
                pl = E3.pl_bar(data["cat"], data["DC"], mc)
                res.append((sname, pl, "Cat %s, MTTFd %.0f a (%s), DCavg %.0f %%, CCF %d" % (data["cat"], mc, E3.mttfd_class(mc), 100 * data["DC"], ccf)))
        ach = E3.combine([r[1] for r in res])
        sf.append({"id": name, "PLr": plr_, "desc": desc, "subs": res, "PL": ach, "ok": ach is not None and E3.PL_ORDER.index(ach) >= E3.PL_ORDER.index(plr_)})
    logic = ("logic: F-CPU + F-DI/F-DQ", "certified", {"PL": "e", "PFHd": 1e-9})
    sto = ("output: decentralised drive STO via PROFIsafe", "certified", {"PL": "e", "PFHd": 1e-9})
    add("SF-C1", "d", "E-stop per area -> SS1 then STO of all drives of the area", [
        ("input: E-stop 2 ch, cross-monitored", "calc", {"channels": [[(100000, 0)], [(100000, 0)]], "t_cycle": 7 * 24 * 3600, "cat": "3", "DC": 0.99}), logic, sto])
    add("SF-C2", "c", "AGV dock: light curtain (multi-beam) with muting while AGV_PRESENT + docking sensor; a person -> STO of lane + AGV rollers stop (ST_FAULT)", [
        ("input: multi-beam light curtain type 4", "certified", {"PL": "e", "PFHd": 1.5e-8}),
        ("input: muting sensors 2 ch + timing / sequence plausibility", "calc", {"channels": [[(0, 50.0)], [(0, 50.0)]], "t_cycle": 120, "cat": "3", "DC": 0.90}), logic, sto])
    add("SF-C3", "d", "Assembly gate section: interlock + guard locking; unlock only after STO of the upstream section; opening from inside always possible (escape release)", [
        ("input: interlock with guard locking, 2 ch (ISO 14119 type 4 coded)", "calc", {"channels": [[(2000000, 0)], [(2000000, 0)]], "t_cycle": 4 * 3600, "cat": "3", "DC": 0.99}), logic, sto])
    add("SF-C4", "d", "Lift table in the pit: safety edge (EN ISO 13856-2) around the table -> both lowering valves close", [
        ("input: safety edge + control unit", "certified", {"PL": "d", "PFHd": 1.0e-7}), logic,
        ("output: two monitored lowering valves (hydraulic, MTTFd 150 a each)", "calc", {"channels": [[(0, 150.0)], [(0, 150.0)]], "t_cycle": 600, "cat": "3", "DC": 0.90})])
    add("SF-C5", "d", "HMC load station light curtain (S = 680 mm) -> STO of the pallet shuttle", [
        ("input: light curtain type 4, 30 mm", "certified", {"PL": "e", "PFHd": 1.5e-8}), logic, ("output: shuttle drive STO", "certified", {"PL": "e", "PFHd": 1e-9})])
    add("SF-C6", "c", "Z31 pick window light curtain: no crate movement into / out of Z31 and no TU1/TU2 lift while hands are inside", [
        ("input: light curtain type 4, 30 mm", "certified", {"PL": "e", "PFHd": 1.5e-8}), logic, sto])
    add("SF-C7", "c", "Test docking slide: force-limited pressure (< 150 N) + hood interlock 2 ch", [
        ("input: hood interlock 2 ch", "calc", {"channels": [[(2000000, 0)], [(2000000, 0)]], "t_cycle": 1800, "cat": "3", "DC": 0.90}), logic,
        ("output: 5/3 valve centre closed + exhaust valve", "calc", {"channels": [[(10000000, 0)], [(10000000, 0)]], "t_cycle": 1800, "cat": "3", "DC": 0.60})])
    lc = S["dock_lc"]
    T = (lc["t_curtain_ms"] + lc["t_plc_ms"] + lc["t_stop_ms"]) / 1000
    S_dock = lc["K"] * T + lc["C_multibeam_mm"]
    pe = S["pit_edge"]
    over = pe["v_lower_mm_s"] * (pe["t_edge_ms"] + pe["t_valve_ms"]) / 1000
    return rr, sf, {"T_dock": T, "S_dock": S_dock, "pit_overrun": over, "pit_ok": over <= pe["edge_travel_mm"]}


# ============================================================================= 6 air
def air(d, C, bal_lifts_h=12.9):
    A = d["air"]
    n_map = {"assembly stopper": C["ASM"]["stopper"], "lift-and-locate": C["ASM"]["lift_locate"], "test docking slide": C["ASM"]["test_dock"],
             "flow-rack separator": C["PD"]["flow_lane"]}
    rows = []
    for name, bore, stroke, da, cyc in A["actuators"]:
        V = math.pi / 4 * (bore / 1000) ** 2 * (stroke / 1000) * (2 if da else 1) * (A["p_bar"] + 1) * 1000   # free-air litres per cycle
        n = n_map[name]
        q = V * cyc * n / 60
        rows.append([name, n, bore, stroke, round(V, 3), cyc, round(q, 2)])
    q_bal = bal_lifts_h * A["balancer_NL_per_lift"] / 60
    rows.append(["balancers", 5, "-", "-", A["balancer_NL_per_lift"], bal_lifts_h, round(q_bal, 2)])
    tot = sum(r[6] for r in rows) * (1 + A["leak_share"])
    return rows, tot


# ============================================================================= build / report
def build(d):
    C = counts(d)
    dol, ramp = dol_check(d)
    drv = drives(d, C)
    pw = power(d, C, drv)
    io = io_summary(d, C)
    ps = psu(d, io, C)
    cm = comm(d, C, io, ps)
    rr, sf, sx = safety(d)
    ar, at = air(d, C)
    return {"C": C, "dol": dol, "ramp": ramp, "drv": drv, "pw": pw, "io": io, "ps": ps, "cm": cm, "risk": rr, "sf": sf, "sx": sx, "air": ar, "air_tot": at}


def cost(d, R):
    c = d["cost_EUR"]
    n_drv = sum(r[4] for r in R["drv"])
    n_rio = sum(p["remote_io"] for p in R["ps"].values())
    n_coup = R["C"]["AF"]["dock"] + R["C"]["PD"]["dock"]
    n_lc = n_coup + 2
    n_es = sum(d["estops"].values())
    rows = [["decentralised drives (inverter + STO, PROFINET)", n_drv, c["decentral_drive"]], ["remote I/O stations (incl. F-modules)", n_rio, c["remote_io_station"]],
            ["optical AGV couplers", n_coup, c["coupler"]], ["light curtains with muting / pick window / HMC", n_lc, c["light_curtain_muting"]],
            ["E-stops", n_es, c["estop"]], ["safety edges (lift tables)", R["C"]["ASM"]["lift_table"], c["safety_edge"]], ["gate locks", R["C"]["ASM"]["gate"], c["gate_lock"]],
            ["F-CPU PLC-CONV1 + PLC-ASM1", 2, c["plc_cpu_f"]], ["control cabinets", 3, c["cabinet"]], ["power bus (m)", 75 + 100, c["power_bus_m"]],
            ["PROFINET cable (m)", 600, c["pn_cable_m"]], ["energy meters", 4, c["energy_meter"]]]
    for r in rows:
        r.append(r[1] * r[2])
    base = sum(r[3] for r in rows)
    caseB = sum(R["cm"][p]["B"]["comm_EUR"] for p in R["cm"])
    return rows, base, caseB


def report(d, R):
    L = ["# F4.5 - electrics, safety, communication of the F4 conveyors (conv_elec.py)", "", "All values: DESIGN / REFERENCE ESTIMATE.", "",
         "## 1 Drive concept - why every drive needs a ramp", "", "| case | start force N | acceleration m/s2 | limit m/s2 | DOL acceptable |", "|---|---|---|---|---|"]
    for k, v in R["dol"].items():
        L.append("| %s | %.0f | %.1f | %.1f | %s |" % (k, v["F"], v["a"], v["limit"], "yes" if v["ok"] else "NO"))
    L += ["", "-> decentralised drives with integrated inverter (ramp %.1f m/s2 = %.2f s to 0.2 m/s), STO via PROFIsafe, on PROFINET; one drive per zone / function." % (R["ramp"]["a_ramp"], R["ramp"]["t_ramp_s"]), "",
          "## 2 Drives and power per area", "", "| area | drives | kW installed | I_sum A | I_b A | fuse A | feeder | dU % |", "|---|---|---|---|---|---|---|---|"]
    for a, p in R["pw"].items():
        L.append("| %s %s | %d | %.1f | %.1f | %.1f | %d | %s | %.2f |" % (a, d["areas"][a]["name"], p["n"], p["P_kW"], p["I_sum"], p["I_b"], p["fuse"], p["cable"], p["du"]))
    L += ["", "| area | element | drive | kW | qty | I_in A each |", "|---|---|---|---|---|---|"] + ["| %s | %s | %s | %.2f | %d | %.2f |" % (r[0], r[1], r[2], r[3], r[4], r[5]) for r in R["drv"] if r[4]]
    L += ["", "## 3 I/O per area", "", "| area | DI | DO | F-DI | F-DO | AI | PN drives/devices | AGV couplers | remote I/O stations | 24 V A (PSU) |", "|---|---|---|---|---|---|---|---|---|---|"]
    for a, t in R["io"].items():
        p = R["ps"][a]
        L.append("| %s | %d | %d | %d | %d | %d | %d | %d | %d | %.1f (%d A) |" % (a, t["DI"], t["DO"], t["F-DI"], t["F-DO"], t["AI"], t["pn"], t["coupler"], p["remote_io"], p["I_A"], p["psu_A"]))
    L += ["", "P&D roller zones: %d (F4.1 RL %d - %d line-side places moved to the flow racks + 3 powered return zones per flow-rack department)." % (
        R["C"]["PD"]["RL"], R["C"]["PD"]["RL"] + R["C"]["PD"]["_line_side_moved"] - 9, R["C"]["PD"]["_line_side_moved"]), "",
          "## 4 Communication - Case A (built-in ports) and Case B (expansion modules)", "",
          "| PLC | Case A modules | Case B modules | Case B extra EUR | backplane W (avail.) | PN devices | PN load one net / per net B |", "|---|---|---|---|---|---|---|"]
    for plc, r in R["cm"].items():
        L.append("| %s | %s | %s | %d | %.1f (%.0f) | %d | %.2f %% / %.2f %% |" % (plc, " + ".join(k for k, _ in r["A"]["modules"]) or "none (X1 PN IO, X2 factory)",
                                                                       " + ".join(k for k, _ in r["B"]["modules"]), r["B"]["comm_EUR"], r["B"]["W"], r["B"]["W_avail"], r["pn_devices"], r["load_A_pct"], r["load_B_pct"]))
    for plc, r in R["cm"].items():
        L.append("- %s Case B: %s." % (plc, r["why_B"]))
    L += ["- PLC-ASRS1 (AS/RS front): Case A = X1 together with the crane, Case B = CM 1542-1 net 2 (already designed in F3 Part D).", "",
          "## 5 Safety", "", "| hazard | S | F | P | PLr | measure |", "|---|---|---|---|---|---|"] + ["| %s | %s | %s | %s | %s | %s |" % r for r in R["risk"]]
    L += ["", "| SF | PLr | function | subsystems | PL achieved | ok |", "|---|---|---|---|---|---|"]
    for s in R["sf"]:
        L.append("| %s | %s | %s | %s | **%s** | %s |" % (s["id"], s["PLr"], s["desc"], "; ".join("%s: %s (%s)" % (a, b, c) for a, b, c in s["subs"]), s["PL"], "yes" if s["ok"] else "NO"))
    sx = R["sx"]
    L += ["", "AGV dock light curtain (multi-beam, body): T = %.0f ms -> S = 1600 x %.3f + 850 = **%.0f mm** from the lane end: the dock is a guarded tunnel of this length; the AGV mutes the curtain." % (1000 * sx["T_dock"], sx["T_dock"], sx["S_dock"]),
          "Pit safety edge: overrun after contact = %d mm/s x %d ms = %.1f mm <= edge travel %d mm -> %s." % (d["safety"]["pit_edge"]["v_lower_mm_s"], d["safety"]["pit_edge"]["t_edge_ms"] + d["safety"]["pit_edge"]["t_valve_ms"], sx["pit_overrun"], d["safety"]["pit_edge"]["edge_travel_mm"], "OK" if sx["pit_ok"] else "NO"), "",
          "## 6 Compressed air (input F11)", "", "| actuator | qty | bore | stroke | NL per cycle | cycles/h | NL/min |", "|---|---|---|---|---|---|---|"] + ["| %s | %s | %s | %s | %s | %s | %s |" % tuple(r) for r in R["air"]]
    L += ["", "Total with %.0f %% leakage: **%.0f NL/min** at %.0f bar." % (100 * d["air"]["leak_share"], R["air_tot"], d["air"]["p_bar"]), ""]
    rows, base, caseB = cost(d, R)
    L += ["## 7 Cost (electrics, controls hardware, safety components)", "", "| item | qty | EUR each | EUR |", "|---|---|---|---|"] + ["| %s | %s | %s | %.0f |" % tuple(r) for r in rows]
    L += ["", "Case A total **%.0f EUR**; Case B adds %.0f EUR (both PLCs)." % (base, caseB), ""]
    return "\n".join(L)


def cmd_run(d):
    out = os.path.join(HERE, "out", "elec")
    os.makedirs(out, exist_ok=True)
    R = build(d)
    with open(os.path.join(out, "elec_report.md"), "w", encoding="utf-8") as fh:
        fh.write(report(d, R))

    def w(name, head, rows):
        with open(os.path.join(out, name), "w", newline="", encoding="utf-8") as fh:
            c = csv.writer(fh)
            c.writerow(head)
            c.writerows(rows)
    w("drives.csv", ["area", "element", "drive", "kW", "qty", "I_in_A_each", "I_in_A_total", "kW_total"], R["drv"])
    w("io_summary.csv", ["area", "DI", "DO", "F-DI", "F-DO", "AI", "pn", "coupler", "remote_io", "I24_A", "psu_A"],
      [[a] + [t[k] for k in ("DI", "DO", "F-DI", "F-DO", "AI", "pn", "coupler")] + [R["ps"][a]["remote_io"], round(R["ps"][a]["I_A"], 2), R["ps"][a]["psu_A"]] for a, t in R["io"].items()])
    w("safety.csv", ["SF", "PLr", "function", "PL_achieved", "ok"], [[s["id"], s["PLr"], s["desc"], s["PL"], s["ok"]] for s in R["sf"]])
    w("comm_cases.csv", ["plc", "case", "modules", "extra_EUR"], [[p, c, " + ".join(k for k, _ in r[c]["modules"]), r[c]["comm_EUR"]] for p, r in R["cm"].items() for c in ("A", "B")])
    w("air.csv", ["actuator", "qty", "bore", "stroke", "NL_cycle", "cycles_h", "NL_min"], R["air"])
    spec = {"counts": R["C"], "power": R["pw"], "io": R["io"], "psu": R["ps"], "comm": {p: {c: [k for k, _ in r[c]["modules"]] for c in ("A", "B")} for p, r in R["cm"].items()},
            "pn": {p: {"devices": r["pn_devices"], "load_A_pct": round(r["load_A_pct"], 2), "load_B_pct": round(r["load_B_pct"], 2)} for p, r in R["cm"].items()},
            "dol": {k: {"F_N": round(v["F"]), "a_m_s2": round(v["a"], 1), "limit": round(v["limit"], 1), "ok": v["ok"]} for k, v in R["dol"].items()},
            "S_dock_mm": R["sx"]["S_dock"], "sf": [[s["id"], s["PLr"], s["PL"], s["desc"]] for s in R["sf"]]}
    with open(os.path.join(out, "elec_specs.json"), "w", encoding="utf-8") as fh:
        json.dump(spec, fh, indent=1)
    print(report(d, R))
    print("written to", out)


def selftest(d):
    res = []

    def ck(n, c):
        res.append(bool(c))
        print(("PASS " if c else "FAIL ") + n)
    R = build(d)
    dol = R["dol"]
    ck("DOL start: light crate on CC %.0f m/s2 > 0.5 g, assembly carrier %.0f m/s2 > slide limit 3.9 -> ramps needed" % (
        dol["CC light crate 45 kg"]["a"], dol["assembly section, 1 carrier moving"]["a"]),
       not dol["CC light crate 45 kg"]["ok"] and not dol["assembly section, 1 carrier moving"]["ok"])
    ck("ramp 0.3 m/s2 < every limit (0.5 g, 3.9)", R["ramp"]["a_ramp"] < 3.9)
    C = R["C"]
    ck("counts from F4.1-F4.4: AF 9 CC + 3 TU + 1 RCX; ASM 4 sections, 19 spurs, 9 lift tables, 2 gates",
       C["AF"]["CC"] == 9 and C["AF"]["TU"] == 3 and C["ASM"]["section"] == 4 and C["ASM"]["spur"] == 19 and C["ASM"]["lift_table"] == 9 and C["ASM"]["gate"] == 2)
    ck("P&D roller zones = F4.1 RL - line-side places moved to flow racks + 9 return zones (%d)" % C["PD"]["RL"], C["PD"]["RL"] == 71 - 28 + 9)
    i018 = 0.18 * 1000 / (0.64 * 0.97 * SQ3 * 400 * 0.9)
    ck("inverter input current 0.18 kW = %.3f A (hand value)" % i018, any(abs(r[5] - round(i018, 3)) < 1e-9 for r in R["drv"] if r[3] == 0.18))
    ck("all feeders: voltage drop <= 3 %% (%s)" % ", ".join("%s %.2f" % (a, p["du"]) for a, p in R["pw"].items()), all(p["du"] <= 3.0 for p in R["pw"].values()))
    ck("PD power bus selected: %s" % R["pw"]["PD"]["cable"], R["pw"]["PD"]["A"] in d["power_bus"]["A_mm2"])
    ck("24 V PSUs cover 1.25 x load in every area", all(p["psu_A"] >= p["I_psu"] for p in R["ps"].values()))
    cm = R["cm"]
    ck("Case A: no expansion module for PLC-CONV1 / PLC-ASM1", cm["PLC-CONV1"]["A"]["modules"] == [] and cm["PLC-ASM1"]["A"]["modules"] == [])
    ck("Case B: CP 1543-1 + CM 1542-1 + CM PtP + PS 60 W (same optimum as F3 Part D)",
       sorted(k for k, _ in cm["PLC-ASM1"]["B"]["modules"]) == sorted(["CP1543-1", "CM1542-1", "CM_PtP_RS485_HF", "PS60W"]))
    ck("PROFINET load one network < 50 %% (CONV1 %.2f %%, ASM1 %.2f %%)" % (cm["PLC-CONV1"]["load_A_pct"], cm["PLC-ASM1"]["load_A_pct"]),
       cm["PLC-CONV1"]["load_A_pct"] < 50 and cm["PLC-ASM1"]["load_A_pct"] < 50)
    ck("PN devices per controller <= 256 (CONV1 %d, ASM1 %d)" % (cm["PLC-CONV1"]["pn_devices"], cm["PLC-ASM1"]["pn_devices"]), all(r["pn_devices"] <= 256 for r in cm.values()))
    ck("all safety functions reach PLr (%s)" % ", ".join("%s %s/%s" % (s["id"], s["PL"], s["PLr"]) for s in R["sf"]), all(s["ok"] for s in R["sf"]))
    sx = R["sx"]
    ck("ISO 13855 dock: S = 1600 x 0.34 + 850 = %.0f mm" % sx["S_dock"], abs(sx["S_dock"] - (1600 * 0.34 + 850)) < 1e-6)
    ck("pit safety edge overrun %.1f mm <= 25 mm" % sx["pit_overrun"], sx["pit_ok"])
    V = math.pi / 4 * 0.032 ** 2 * 0.025 * 2 * 7 * 1000
    ck("air: stopper 32 x 25 double acting at 6 bar = %.3f NL per cycle" % V, abs(R["air"][0][4] - round(V, 3)) < 1e-9)
    ck("air total %.0f NL/min > 0 (input F11)" % R["air_tot"], R["air_tot"] > 0)
    rows, base, caseB = cost(d, R)
    ck("cost Case A %.0f EUR, Case B +%.0f EUR" % (base, caseB), base > 0 and caseB > 0)
    print("\n%d/%d checks passed" % (sum(res), len(res)))
    return all(res)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sp = ap.add_subparsers(dest="cmd")
    sp.add_parser("selftest")
    sp.add_parser("run")
    a = ap.parse_args(argv)
    d = load()
    if a.cmd == "selftest":
        sys.exit(0 if selftest(d) else 1)
    elif a.cmd == "run":
        cmd_run(d)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
