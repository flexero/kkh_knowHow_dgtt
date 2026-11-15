#!/usr/bin/env python3
"""Final thesis item F4.3 - the load stations of the combined FMS.

  A  AGV P&D station      docking tolerance budget, transfer, end-stop energy, handshake sequences
  B  TU1 check station    contour limits from the F3 rack, light-grid resolution, weighing transfer (load cells, error
                          budget, guard band, settling time), weight plausibility, reject codes
  C  pick station Z31     kitted vs line-fed parts, kit trolley payload, visits per month, pick time per visit,
                          NIOSH lifting check, bin-in-crate concept; feedback into the F4.1 AS/RS front simulation
  D  flow racks           gravity lanes for the line-side buffers: slope, terminal speed, brake rollers, separator force
  E  HMC load station     rotary index table (inertia, drive, slewing ring), hydraulic clamping (force, bore,
                          accumulator), clamping check, load-station time, NIOSH, light curtain distance (ISO 13855)

Python 3 standard library only, offline. Data: ls_data.json + F1 (products) + F3 (part flows) + F4.1 (conv_system).
Outputs (out/stations/): stations_report.md, handshake.csv, reject_codes.csv, kit_visits.csv, flow_lanes.csv,
stations_specs.json (input of the 3D model). Guide: Doctor paper/61 chapters 22-33.

Commands
  python load_stations.py selftest
  python load_stations.py run

Formulas
  A lateral budget     worst = e_y + L sin(psi) + e_floor ; RSS = sqrt(e_y^2 + (L sin psi)^2 + e_floor^2) ; capture = gap + l tan(15)
    end stop           E = m v^2 / 2 ; F_avg = E / s ; a_peak ~ 2 F_avg / m (linear PU spring)
  B width limit        w = gap/2 - e_x - safety ; height h_avail = pitch - beam - lift - e_z - safety
    load cell          per cell = (m_dead + m_max (1 + overload)) / n * k_ecc -> next capacity
    error budget       u = sqrt(n (eps C)^2 + u_vib^2 + u_zero^2) ; accept if W <= W_max - 2u (guard band, k = 2)
    settling           f_n = sqrt(k_tot / m) / 2 pi ; t = 4 / (2 pi f_c) + ln(50) / (zeta 2 pi f_n)
  C kit                n_kit = floor((P_agv - m_trolley) / M_unit) ; units per visit = places * n_kit (<= lot)
                       visits = sum lots * ceil(lot / upv) * types ; t_visit = t0 + n_picks t_pick + n_bins/2 t_bin
    NIOSH (revised)    RWL = LC * (25/H) * (1 - 0.003|V-75|) * (0.82 + 4.5/D) * AM * FM * CM ; LI = m / RWL
  D gravity lane       start: s >= f_light ; v_end = sqrt(2 g L (s - f)) ; separator F = (n-1) m g (s - f_min)
  E rotary table       J = m (a^2 + b^2)/12 (+ m r^2) ; trapezoid 1/3-1/3-1/3: w = theta / (2t/3), alpha = w / (t/3)
                       T = J alpha + mu m g r_b ; P = T w / eta
    clamping           F_clamp = S F_cut / (2 mu n) ; A = F / p ; accumulator p0 V0 = p V (isothermal)
    ISO 13855          S = K T + C , C = 8 (d - 14) ; K = 2000 (if S > 500 -> K = 1600, S >= 500)
"""

import argparse
import csv
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "01_products"))
sys.path.insert(0, os.path.join(HERE, "..", "02_fms"))
sys.path.insert(0, os.path.join(HERE, "..", "03_asrs"))
sys.path.insert(0, HERE)


def load(path=os.path.join(HERE, "ls_data.json")):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# ============================================================================= A  AGV P&D station
def pd_station(d):
    P = d["pd"]
    L = 1200.0
    yaw = L * math.sin(math.radians(P["agv_yaw_deg"]))
    worst = P["agv_stop_y_mm"] + yaw + P["floor_mm"]
    rss = math.sqrt(P["agv_stop_y_mm"] ** 2 + yaw ** 2 + P["floor_mm"] ** 2)
    capture = P["guide_gap_mm"] + P["lead_in_len_mm"] * math.tan(math.radians(P["lead_in_deg"]))
    step_worst = P["deck_height_tol_mm"] + P["floor_mm"]
    step_rss = math.hypot(P["deck_height_tol_mm"], P["floor_mm"])
    rollers_bridge = int((L - P["transfer_gap_mm"]) // 150)
    t_transfer = P["zone_m"] / P["v_m_s"] + P["handshake_s"]
    m = 300.0
    E = 0.5 * m * P["v_m_s"] ** 2
    F_avg = E / (P["buffer_stroke_mm"] / 1000)
    a_peak = 2 * F_avg / m
    return {"yaw_mm": yaw, "lat_worst": worst, "lat_rss": rss, "capture": capture, "lat_ok": worst <= capture,
            "step_worst": step_worst, "step_rss": step_rss, "step_ok_rss": step_rss <= P["step_max_mm"], "step_ok_worst": step_worst <= P["step_max_mm"],
            "deck_req_mm": P["step_max_mm"] - P["floor_mm"], "rollers_bridge": rollers_bridge, "t_transfer": t_transfer,
            "E_J": E, "F_avg": F_avg, "a_peak_g": a_peak / d["g"], "stop_ok": a_peak / d["g"] <= P["decel_limit_g"]}


def handshake_sequences():
    drop = [["1", "AGV docks, AGV_PRESENT = 1", "station checks: first zone empty, no fault", "-"],
            ["2", "station: lowers end stop, starts lane rollers inwards, ST_READY_RECV = 1", "", "10 s after AGV_PRESENT"],
            ["3", "AGV: AGV_READY_SEND = 1, runs deck rollers outwards", "crate moves onto the lane (both conveyors at 0.2 m/s)", "-"],
            ["4", "AGV: AGV_TRANSFER_DONE = 1 when its deck sensors are free", "station: ST_TRANSFER_DONE = 1 when the crate is fully in zone 1", "15 s for the transfer"],
            ["5", "station raises the end stop, resets ST_READY_RECV; AGV resets its signals and leaves", "job closed in fmsctl (crate id at the lane)", "-"]]
    pick = [["1", "AGV docks, AGV_PRESENT = 1", "station: crate at the lane end (zone 1), no fault", "-"],
            ["2", "AGV: AGV_READY_RECV = 1, deck rollers inwards", "station lowers the end stop, ST_READY_SEND = 1, lane rollers outwards", "10 s"],
            ["3", "crate moves onto the AGV", "", "15 s"],
            ["4", "AGV_TRANSFER_DONE = 1 (deck sensors occupied, end sensor)", "ST_TRANSFER_DONE = 1 (zone 1 free)", "-"],
            ["5", "station raises the stop, stops the rollers; AGV leaves", "job closed in fmsctl", "-"]]
    rules = ["Rollers of BOTH sides run only while AGV_PRESENT = 1 and ST_FAULT = 0 (interlock in both PLCs).",
             "A timeout in any step: both sides stop their rollers, the station raises nothing while a crate is over the gap, the job goes to 'transfer error' -> operator.",
             "Loss of AGV_PRESENT during a transfer = immediate stop of both conveyors (the crate stays on the gap; recovery by the operator in manual mode).",
             "The signals are NOT safety functions: people are protected by the light curtain with muting (F4.5 / F8)."]
    return drop, pick, rules


# ============================================================================= B  TU1 check station
def check_station(d):
    C = d["check"]
    g = d["g"]
    w_side = C["rack_gap_mm"] / 2 - C["pos_tol_x_mm"] - C["safety_mm"]
    w_lim = math.floor(w_side / 5) * 5
    front_rear = min(C["rack_front_mm"], C["frame_depth_mm"] - C["rack_front_mm"] - 1200) - 10 - C["safety_mm"]
    fr_lim = min(20, math.floor(front_rear / 5) * 5)
    h_avail = C["level_pitch_mm"] - C["beam_h_mm"] - C["fork_lift_mm"] - C["pos_tol_z_mm"] - C["safety_mm"]
    h_lim = C["crate_h_total_mm"] + C["rim_rule_mm"]
    res_grid = 14 if C["detect_min_mm"] >= 14 else 10
    # load cells
    per_cell = (C["tu_dead_kg"] + C["max_kg"] * (1 + C["overload_share"])) / C["cells"] * C["ecc_factor"]
    cap = next(c for c in C["cell_caps_kg"] if c >= per_cell)
    eps = C["cell_class_ppm"] * 1e-6
    u_cells = math.sqrt(C["cells"]) * eps * cap
    u = math.sqrt(u_cells ** 2 + C["vib_kg"] ** 2 + C["zero_drift_kg"] ** 2)
    accept = C["max_kg"] - 2 * u
    k_tot = C["cells"] * cap * g / (C["cell_defl_mm"] / 1000)
    m_tot = C["tu_dead_kg"] + C["max_kg"]
    fn = math.sqrt(k_tot / m_tot) / (2 * math.pi)
    zeta = 0.05
    t_settle = 4 / (2 * math.pi * C["filter_hz"]) + math.log(50) / (zeta * 2 * math.pi * fn)
    return {"w_side_avail": w_side, "w_lim": w_lim, "fr_avail": front_rear, "fr_lim": fr_lim, "h_avail": h_avail, "h_lim": h_lim,
            "h_ok": h_lim <= h_avail, "grid_res": res_grid, "scan_mm": 0.2 * 10, "per_cell_kg": per_cell, "cap": cap,
            "u_cells": u_cells, "u": u, "accept_max": accept, "k_tot": k_tot, "fn": fn, "t_settle": t_settle, "settle_ok": t_settle < 8.0}


def plausibility(d, chk, pf):
    C = d["check"]
    rows = []
    for key, f in pf.items():
        if "-" in key and not key.endswith("RB100"):
            continue
        m = f["m_kg"]
        W = 45 + f["ppc_raw"] * m
        tol = max(C["plausibility_tol"] * W, 2 * chk["u"])
        rows.append([key, f["ppc_raw"], round(m, 2), round(W, 1), round(tol, 1), "yes" if m > tol else "no"])
    return rows


def reject_codes():
    return [["0", "OK", "-", "store"],
            ["1", "overweight (W > accept limit)", "scale", "back to the AGV -> rework area (split the crate)"],
            ["2", "height above the rim rule", "horizontal light grid", "back to the AGV / Z31 rework: re-stack"],
            ["3", "side overhang left / right > limit", "vertical light grids", "rework: push parts in, close the separator"],
            ["4", "front / rear overhang > limit (length measured in motion)", "grid edge timing", "rework"],
            ["5", "no ID read", "ID reader (F6)", "rework: new label"],
            ["6", "ID unknown in the WMS / wrong destination", "WMS", "back to the AGV -> clarification"],
            ["7", "weight not plausible (|W - W_expected| > tol)", "scale + WMS content", "rework: count the parts"],
            ["8", "crate base damaged (runner missing / bent) - runner sensors", "2 diffuse sensors under TU1 (one per runner)", "crate out of service"]]


# ============================================================================= C  pick station Z31 (kitting)
def niosh_limits(d):
    """Ergonomic limits of the pick station derived from the NIOSH RWL (not chosen by feeling):
    heavy limit = RWL of the near picks (rounded down to 0.5 kg); bin filling limit = RWL of the bin lift (rounded down)."""
    cs = niosh(d, 0.0)
    near = min(c["RWL"] for c in cs if "near" in c["case"])
    binl = [c["RWL"] for c in cs if "lift" in c["case"]][0]
    return {"heavy_limit_kg": math.floor(2 * near) / 2, "bin_kg_max": float(math.floor(binl)), "rwl_near": near, "rwl_bin": binl}


def kit_analysis(d, lim=None, pf=None):
    import products as P
    import fms_design as F2
    K = dict(d["kit"])
    if lim:
        K["heavy_limit_kg"], K["bin_kg_max"] = lim["heavy_limit_kg"], lim["bin_kg_max"]
    d2, pdata = F2.load_all()
    dem = d2["programme"]["demand_month"]
    lots = d2["programme"]["lot"]
    per = {}
    for pk, vk, params in P.variants(pdata):
        q = dem.get(vk, 0)
        if not q:
            continue
        prod = pdata["products"][pk]
        kitted, heavy = [], []
        for part in prod["parts"]:
            if part.get("make") != "M":
                continue
            uq = P.unit_qty(prod, pk, part["parent"], part["qty"])
            mf = P.val(part["m_finish"], params)
            (kitted if mf <= K["heavy_limit_kg"] else heavy).append((part["id"], uq, mf))
        Mu = sum(uq * mf for _, uq, mf in kitted)
        n_kit = int((K["agv_payload_kg"] - K["trolley_tare_kg"]) // Mu)
        upv = min(K["trolley_places"] * n_kit, lots[vk])
        lots_m = q / lots[vk]
        visits_per_type = lots_m * math.ceil(lots[vk] / upv)
        rows = []
        for pid, uq, mf in kitted:
            n_picks = upv * uq
            cls = "light" if mf <= K["light_max_kg"] else ("medium" if mf <= K["medium_max_kg"] else "heavy")
            key = pid if vk == "VC20" else pid + "-" + vk
            ppc_m = pf[key]["ppc_mach"] if pf and key in pf else 10 ** 6
            per_bin = max(1, int(K["bin_kg_max"] // mf))
            ppc = min(ppc_m, K["bins_per_crate"] * per_bin)          # parts per crate in bins
            crates = math.ceil(n_picks / ppc)                          # crate visits for ONE kit visit
            picks_c = n_picks / crates
            bins_c = math.ceil(picks_c / per_bin)
            t = K["t_fixed_s"] + picks_c * K["t_pick_s"][cls] + 0.5 * bins_c * K["t_bin_s"]
            rows.append({"part": pid, "uq": uq, "m": mf, "cls": cls, "picks": n_picks, "ppc": ppc, "crates": crates, "bins": bins_c,
                         "t_visit": t, "visits": visits_per_type * crates})
        per[vk] = {"M_unit": Mu, "n_kit": n_kit, "upv": upv, "kitted": rows, "heavy": heavy, "visits": sum(r["visits"] for r in rows)}
    visits = sum(v["visits"] for v in per.values())
    t_mean = sum(r["t_visit"] * r["visits"] for v in per.values() for r in v["kitted"]) / visits
    return {"per": per, "visits_month": visits, "t_mean": t_mean}


def niosh(d, m_pick):
    N = d["kit"]["niosh"]
    out = []
    for name, H, V, D, FM in N["cases"]:
        HM = 0.0 if H > 63 else min(1.0, 25.0 / H)
        VM = 1 - 0.003 * abs(V - 75)
        DM = min(1.0, 0.82 + 4.5 / max(D, 25))
        RWL = N["LC"] * HM * VM * DM * 1.0 * FM * N["coupling"]
        m = d["kit"].get("_bin_kg", 15.0) if "bin" in name and "lift" in name else m_pick
        out.append({"case": name, "H": H, "V": V, "D": D, "HM": HM, "VM": VM, "DM": DM, "FM": FM, "RWL": RWL, "m": m,
                    "LI": (m / RWL) if RWL > 0 else float("inf")})
    return out


def des_feedback(d, ka, hours=150):
    import conv_system as CS
    dc = CS.load()
    I = CS.inputs()
    mv = I["r3"]["moves"]
    f3_visits = mv["batches_month"] * 10.0
    base = CS.run_front(dc, I, hours=hours)
    new = CS.run_front(dc, I, hours=hours, kit_factor=ka["visits_month"] / f3_visits, pick_mean=ka["t_mean"])
    return {"f3_visits": f3_visits, "base": base, "new": new}


# ============================================================================= D  flow racks
def flow_racks(d, bf_map):
    F = d["flow"]
    g = d["g"]
    s = F["f_light"] + 0.005
    L = F["lane_max_crates"] * F["crate_pitch_m"]
    v_end = math.sqrt(max(0.0, 2 * g * L * (s - F["f_roll"])))
    F_sep = (F["lane_max_crates"] - 1) * F["max_kg"] * g * (s - 0.02)
    exit_mm = F["entry_mm"] - s * L * 1000
    lanes = []
    depts = sorted(bf_map)
    for dept in depts:
        for part, crates in bf_map[dept]:
            n = crates + 1
            k = math.ceil(n / F["lane_max_crates"])
            lanes.append([dept, part, crates, n, k, round(min(n, F["lane_max_crates"]) * F["crate_pitch_m"], 1)])
        lanes.append([dept, "empty-crate return (powered)", 0, 3, F["return_lane_per_dept"], round(L, 1)])
    cost = sum(F["lane_eur"] * r[4] + F["per_place_eur"] * r[3] for r in lanes if not r[1].startswith("empty"))
    cost += len(depts) * (F["ball_deck_eur"] + 3 * F["return_zone_eur"])
    F_slide = F["ball_f"] * F["tare_kg"] * g
    rise = (700 - exit_mm) / (L * 1000)
    places = sum(r[3] for r in lanes)
    import conv_system as CS
    areas = CS.inputs()["areas"]
    dc = CS.load()
    face = {}
    for r in lanes:
        face[r[0]] = face.get(r[0], 0.0) + r[4] * F["lane_width_m"]
    width = {k: areas.get(k, 0) * dc["assembly"]["area_factor"] / dc["assembly"]["row_depth_m"] for k in face}
    line_side = sum(r[2] for r in lanes)
    rl_saved = line_side * dc["cost_EUR"]["RL"]
    return {"slope": s, "slope_deg": math.degrees(math.atan(s)), "L": L, "v_end": v_end, "brakes": v_end > F["v_max_m_s"],
            "brake_spacing_m": 1.05, "F_sep": F_sep, "lanes": lanes, "cost": cost, "places": places, "face": face, "width": width,
            "rl_saved": rl_saved, "delta": cost - rl_saved, "line_side": line_side, "exit_mm": exit_mm, "F_slide": F_slide, "rise": rise}


def bf_by_dept():
    import asrs_design as A3
    a3 = A3.load()
    pf, d2 = A3.part_flows(a3)
    bf = A3.buffers(a3, pf, d2)
    dc = json.load(open(os.path.join(HERE, "conv_data.json"), encoding="utf-8"))
    out, rb = {}, {}
    for part, ph, need, cr in bf:
        base = part.split("-")[0]
        dept = dc["first_op_dept"][base]
        if "-" in part:
            rb[(dept, base)] = max(rb.get((dept, base), 0), cr)
        else:
            out.setdefault(dept, []).append((part, cr))
    for (dept, base), cr in rb.items():
        out.setdefault(dept, []).append((base + " (running RB variant)", cr))
    return out, pf


# ============================================================================= E  HMC pallet load station
def hmc_station(d):
    H = d["hmc"]
    g = d["g"]
    out = {}
    a = H["pallet_mm"] / 1000
    tb = H["tomb_mm"]
    for cls in ("FA", "FC"):
        parts = H["positions"][cls]
        m_parts = sum(p[1] * p[3] / 2 for p in parts)          # on average half the positions carry a part of the raw mass... both
        m_parts = sum(p[1] * p[3] for p in parts)              # design: all positions loaded with raw parts (heaviest case)
        m = H["pallet_kg"] + H["tomb_kg"][cls] + m_parts
        J = H["pallet_kg"] * (a ** 2 + a ** 2) / 12 + H["tomb_kg"][cls] * ((tb[0] / 1000) ** 2 + (tb[1] / 1000) ** 2) / 12 + m_parts * 0.25 ** 2
        th = math.radians(H["index_deg"])
        w = th / (2 * H["index_s"] / 3)
        al = w / (H["index_s"] / 3)
        T = J * al + H["mu_bearing"] * m * g * H["r_bearing_m"]
        P = T * w / H["eta"]
        out[cls] = {"m": m, "J": J, "w": w, "alpha": al, "T": T, "P": P}
    worst = max(out.values(), key=lambda r: r["P"])
    motors = [0.12, 0.18, 0.25, 0.37, 0.55]
    Pm = next(x for x in motors if x * 1000 >= 1.4 * worst["P"])
    m_max = max(r["m"] for r in out.values())
    Fa = m_max * g
    M_tilt = max(p[1] for c in H["positions"].values() for p in c) * g * H["impact"] * H["part_r_m"]
    slew_fs_a = H["slew_C0a_kN"] * 1000 / Fa
    slew_fs_m = H["slew_M0_kNm"] * 1000 / M_tilt
    # clamping (C01 OP10: 3 clamps)
    n = H["clamps"]["C01"]
    Fc = H["S_clamp"] * H["F_cut_N"] / (2 * H["mu_clamp"] * n)
    A_req = Fc / (H["p_bar"] / 10)
    d_req = math.sqrt(4 * A_req / math.pi)
    bore = next(b for b in H["clamp_bores_mm"] if b >= d_req)
    F_bore = math.pi * bore ** 2 / 4 * H["p_bar"] / 10
    # accumulator (isothermal)
    pV = H["acc_p0_bar"] * H["acc_V0_cm3"]
    V1 = pV / H["p_bar"]
    p_end = pV / (V1 + H["leak_cm3_min"] * H["machining_min"])
    t_switch = (pV / H["p_switch_bar"] - V1) / H["leak_cm3_min"]
    # load-station time (F1 model) per visit
    LM = H["ls_model"]
    ls = {}
    for cls, parts in H["positions"].items():
        t = 0.0
        for pid, mr, mm, pos in parts:
            t += pos * (LM["base"] + LM["per_clamp"] * H["clamps"][pid] + (LM["hoist"] if mr > LM["hoist_above_kg"] else 0) + LM["clean"])
        extra = 3 * H["index_s"] + 5.0
        ls[cls] = {"t_f1_s": t, "t_f1_min": t / 60, "extra_s": extra, "t_total_s": t + extra}
    util = sum(H["visits_h"][c] * ls[c]["t_total_s"] for c in ls) / 3600
    # NIOSH manual loading of the raw crankcase (why the hoist)
    N = H["niosh"]
    HM = 25.0 / N["H"]
    VM = 1 - 0.003 * abs(N["V"] - 75)
    DM = 0.82 + 4.5 / N["D"]
    RWL = 23.0 * HM * VM * DM * N["FM"] * N["CM"]
    LI = 16.5 / RWL
    # ISO 13855 light curtain
    lc = H["lc"]
    T = (lc["t_curtain_ms"] + lc["t_plc_ms"] + lc["t_stop_ms"]) / 1000
    C = 8 * (lc["d_mm"] - 14)
    S2000 = 2000 * T * 1000 / 1000 + C
    S = S2000 if S2000 <= 500 else max(500.0, 1600 * T + C)
    return {"cls": out, "P_motor": Pm, "Fa": Fa, "M_tilt": M_tilt, "fs_a": slew_fs_a, "fs_m": slew_fs_m,
            "F_clamp": Fc, "d_req": d_req, "bore": bore, "F_bore": F_bore, "p_end": p_end, "t_switch_min": t_switch,
            "ls": ls, "util": util, "RWL": RWL, "LI": LI, "T_stop_s": T, "S2000": S2000, "S": S, "C": C}


# ============================================================================= build / report / outputs
def build(d, des=True):
    bfm, pf = bf_by_dept()
    A = pd_station(d)
    B = check_station(d)
    B["plaus"] = plausibility(d, B, pf)
    lim = niosh_limits(d)
    nio0 = niosh(d, 7.25)       # the first design (8 kg limit -> heaviest kitted part = RB100 rotor 7.25 kg, 15 kg bins)
    ka = kit_analysis(d, lim, pf)
    m_pick = max(r["m"] for v in ka["per"].values() for r in v["kitted"])
    d["kit"]["_bin_kg"] = lim["bin_kg_max"]
    nio = niosh(d, m_pick)
    d["kit"]["_bin_kg"] = 15.0
    fb = des_feedback(d, ka) if des else None
    D = flow_racks(d, bfm)
    E = hmc_station(d)
    return {"A": A, "B": B, "kit": ka, "niosh": nio, "niosh0": nio0, "lim": lim, "m_pick": m_pick, "des": fb, "D": D, "E": E}


def report(d, R):
    A, B, ka, nio, fb, D, E = R["A"], R["B"], R["kit"], R["niosh"], R["des"], R["D"], R["E"]
    L = ["# F4.3 - load stations (load_stations.py)", "", "All values: DESIGN / REFERENCE ESTIMATE; DES = SIMULATED.", "",
         "## A AGV P&D station", "",
         "- Lateral: AGV %d mm + yaw %.1f deg over 1200 mm (%.1f mm) + floor %d mm -> worst %.1f mm, RSS %.1f mm; capture of guides + lead-in %.1f mm -> %s." % (
             d["pd"]["agv_stop_y_mm"], d["pd"]["agv_yaw_deg"], A["yaw_mm"], d["pd"]["floor_mm"], A["lat_worst"], A["lat_rss"], A["capture"], "OK" if A["lat_ok"] else "NOT OK"),
         "- Height step deck/lane: worst %.0f mm, RSS %.1f mm, allowed %d mm -> requirement for F5: deck height +-%d mm (actively levelled)." % (
             A["step_worst"], A["step_rss"], d["pd"]["step_max_mm"], A["deck_req_mm"]),
         "- Transfer gap %d mm: %d rollers stay under each runner while crossing; transfer time %.0f s (F4.1 assumed 10 s)." % (d["pd"]["transfer_gap_mm"], A["rollers_bridge"], A["t_transfer"]),
         "- End stop (control fault): E = %.0f J, PU stroke %d mm -> F_avg %.0f N, peak %.2f g (limit %.1f g) -> %s." % (
             A["E_J"], d["pd"]["buffer_stroke_mm"], A["F_avg"], A["a_peak_g"], d["pd"]["decel_limit_g"], "OK" if A["stop_ok"] else "NOT OK"), "",
         "## B TU1 check station", "",
         "- Width overhang allowed per side: gap/2 %.1f - x tolerance %.1f - safety %d = %.1f mm -> limit **%d mm**." % (
             d["check"]["rack_gap_mm"] / 2, d["check"]["pos_tol_x_mm"], d["check"]["safety_mm"], B["w_side_avail"], B["w_lim"]),
         "- Front/rear overhang: available %.0f mm -> limit **%d mm**. Height: available %.0f mm above the beam; rule crate %d + %d = **%d mm** -> %s." % (
             B["fr_avail"], B["fr_lim"], B["h_avail"], d["check"]["crate_h_total_mm"], d["check"]["rim_rule_mm"], B["h_lim"], "OK" if B["h_ok"] else "NOT OK"),
         "- Light grids resolution %d mm (detects >= %d mm objects); length measured in motion: 0.2 m/s x 10 ms scan = %.0f mm steps." % (B["grid_res"], d["check"]["detect_min_mm"], B["scan_mm"]),
         "- Load cells: per cell (%.0f + %.0f) / %d x %.1f = %.0f kg -> **%d kg** cells; uncertainty u = sqrt(cells %.2f^2 + vibration %.1f^2 + zero %.1f^2) = **%.2f kg**; accept if W <= %.1f kg (guard band 2u)." % (
             d["check"]["tu_dead_kg"], d["check"]["max_kg"] * (1 + d["check"]["overload_share"]), d["check"]["cells"], d["check"]["ecc_factor"], B["per_cell_kg"], B["cap"],
             B["u_cells"], d["check"]["vib_kg"], d["check"]["zero_drift_kg"], B["u"], B["accept_max"]),
         "- Settling: k = %.1f MN/m, m = %d kg -> f_n = %.0f Hz; filter %.0f Hz -> stable after %.2f s (budget 8 s)." % (
             B["k_tot"] / 1e6, d["check"]["tu_dead_kg"] + d["check"]["max_kg"], B["fn"], d["check"]["filter_hz"], B["t_settle"]), "",
         "| part (raw crate) | parts/crate | kg/part | crate kg | tolerance kg | one missing part detectable |", "|---|---|---|---|---|---|"]
    for r in B["plaus"]:
        L.append("| %s | %d | %.2f | %.1f | %.1f | %s |" % tuple(r))
    L += ["", "## C Pick / rework station Z31", ""]
    for vk, v in ka["per"].items():
        L.append("- **%s**: kitted mass %.1f kg/unit -> %d units per trolley, %d units per visit (2 trolley places, lot limit); heavy parts line-fed in crates: %s." % (
            vk, v["M_unit"], v["n_kit"], v["upv"], ", ".join("%s %.1f kg" % (h[0], h[2]) for h in v["heavy"]) or "none"))
    L += ["", "| variant | part | qty/unit | kg | class | picks per kit visit | parts/crate in bins | crate visits | bins per crate visit | t per crate visit s | crate visits/month |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for vk, v in ka["per"].items():
        for r in v["kitted"]:
            L.append("| %s | %s | %d | %.2f | %s | %d | %d | %d | %d | %.0f | %.1f |" % (vk, r["part"], r["uq"], r["m"], r["cls"], r["picks"], r["ppc"], r["crates"], r["bins"], r["t_visit"], r["visits"]))
    L += ["", "Kit visits **%.0f per month** (F3 assumed %.0f), mean pick time **%.0f s** per visit (F4.1 assumed 90 s)." % (ka["visits_month"], fb["f3_visits"] if fb else 0, ka["t_mean"]), ""]
    if fb:
        b, n = fb["base"], fb["new"]
        L += ["| AS/RS front busiest hour (simulated) | F4.1 assumptions | F4.3 kitting values |", "|---|---|---|",
              "| kit visits per h | %.1f | %.1f |" % (b["lam_kit_h"], n["lam_kit_h"]),
              "| crane utilisation | %.1f %% | %.1f %% |" % (100 * b["crane_util"], 100 * n["crane_util"]),
              "| AGV wait p95 at TU1 | %.0f s | %.0f s |" % (b["agv_wait_p95_s"], n["agv_wait_p95_s"]),
              "| crane blocked by full P&D out | %.2f %% | %.2f %% |" % (100 * b["cv2_block_share"], 100 * n["cv2_block_share"]),
              "| kit visits done per h | %.1f | %.1f |" % (b["kit_h"], n["kit_h"]),
              "| open orders at the end | %d | %d |" % (b["backlog_end"], n["backlog_end"]), ""]
    L += ["NIOSH - FIRST design (kit limit 8 kg, bins 15 kg): heaviest kitted part 7.3 kg (RB100 rotor):", "", "| case | RWL kg | load kg | LI |", "|---|---|---|---|"]
    for c in R["niosh0"]:
        L.append("| %s | %.1f | %.1f | %s |" % (c["case"], c["RWL"], c["m"], "%.2f" % c["LI"] if c["LI"] != float("inf") else "not allowed"))
    L += ["", "-> LI > 1: the limits are now DERIVED from the RWL: kit only parts <= **%.1f kg** (RWL near picks %.2f kg), fill bins to <= **%.0f kg** (RWL bin lift %.2f kg)." % (
        R["lim"]["heavy_limit_kg"], R["lim"]["rwl_near"], R["lim"]["bin_kg_max"], R["lim"]["rwl_bin"]), "",
          "NIOSH - FINAL design, heaviest kitted part %.2f kg:" % R["m_pick"], "", "| case | H | V | D | FM | RWL kg | load kg | LI |", "|---|---|---|---|---|---|---|---|"]
    for c in nio:
        L.append("| %s | %d | %d | %d | %.2f | %.1f | %.1f | %s |" % (c["case"], c["H"], c["V"], c["D"], c["FM"], c["RWL"], c["m"], "%.2f" % c["LI"] if c["LI"] != float("inf") else "not allowed (H > 63 cm)"))
    pull = d["kit"]["pull_mu"] * R["lim"]["bin_kg_max"] * d["g"]
    L += ["", "Bin-in-crate: the operator pulls a far bin (%.0f kg) to the near half: F = %.1f x %.0f x 9.81 = %.0f N <= %d N." % (
        R["lim"]["bin_kg_max"], d["kit"]["pull_mu"], R["lim"]["bin_kg_max"], pull, d["kit"]["pull_limit_N"]), "",
          "## D Gravity flow racks (line-side buffers)", "",
          "Slope %.1f %% (%.2f deg) = light-crate resistance %.0f %% + 0.5 %%; lane %.1f m (max 3 places); without brakes a 300 kg crate reaches %.2f m/s -> brake rollers every %.2f m (v <= %.2f m/s); separator holding force %.0f N." % (
              100 * D["slope"], D["slope_deg"], 100 * d["flow"]["f_light"], D["L"], D["v_end"], D["brake_spacing_m"], d["flow"]["v_max_m_s"], D["F_sep"]), "",
          "| dept | part | buffer crates | places (+1 in use) | lanes | length m |", "|---|---|---|---|---|---|"]
    for r in D["lanes"]:
        L.append("| %s | %s | %d | %d | %d | %.1f |" % tuple(r))
    L += ["", "Heights: entry %d mm (AGV lifting deck, requirement F5), exit %.0f mm (>= %d mm for picking). Empties: ball-transfer deck at the exit (slide force %.0f N for a 45 kg crate) -> powered return lane rising %.1f %% to 700 mm." % (
        d["flow"]["entry_mm"], D["exit_mm"], d["flow"]["exit_min_mm"], D["F_slide"], 100 * D["rise"]),
          "", "Flow racks: %d places, %.0f EUR (reference, incl. ball decks and powered return lanes)." % (D["places"], D["cost"]),
          "Face width along the AGV aisle (lane %.2f m): " % d["flow"]["lane_width_m"] + ", ".join("%s %.1f m of %.1f m" % (k, D["face"][k], D["width"][k]) for k in sorted(D["face"])) + ".",
          "The %d line-side crates leave the motorised inbound lanes of F4.1 (-%.0f EUR); net change **%+.0f EUR**. F4.1 had put all line-side crates of a department into ONE lane - that is not FIFO per part: the operator could not reach the part that is needed. One lane per part type is a functional correction, not a saving." % (
              D["line_side"], D["rl_saved"], D["delta"]), "",
          "## E HMC pallet load station", "",
          "| class | mass kg | J kg m2 | omega rad/s | alpha rad/s2 | T N m | P W |", "|---|---|---|---|---|---|---|"]
    for c, r in E["cls"].items():
        L.append("| %s | %.0f | %.1f | %.3f | %.3f | %.1f | %.1f |" % (c, r["m"], r["J"], r["w"], r["alpha"], r["T"], r["P"]))
    L += ["", "Index drive **%.2f kW** brake gear motor + index pin; slewing ring: axial %.1f kN (fs %.1f), tilting %.2f kN m from a %d kg part dropped by the hoist (fs %.1f)." % (
        E["P_motor"], E["Fa"] / 1000, E["fs_a"], E["M_tilt"] / 1000, int(max(p[1] for c in d["hmc"]["positions"].values() for p in c)), E["fs_m"]),
          "Clamping C01 (3 clamps): F = 2 x %d / (2 x %.2f x 3) = %.0f N per clamp -> bore %.1f mm -> **%d mm** swing clamp (%.0f N at %d bar)." % (
              d["hmc"]["F_cut_N"], d["hmc"]["mu_clamp"], E["F_clamp"], E["d_req"], E["bore"], E["F_bore"], d["hmc"]["p_bar"]),
          "Pallet accumulator: after %d min machining p = %.1f bar (switch %d bar reached only after %.0f min)." % (d["hmc"]["machining_min"], E["p_end"], d["hmc"]["p_switch_bar"], E["t_switch_min"]), ""]
    for c, r in E["ls"].items():
        L.append("- %s: F1 model %.0f s = %.2f min (F2 used %.2f min) + index/check %.0f s -> %.0f s per visit." % (c, r["t_f1_s"], r["t_f1_min"], d["hmc"]["f2_ls_min"][c], r["extra_s"], r["t_total_s"]))
    L += ["- Load-station utilisation %.1f %% (F2 MVA 57 %%)." % (100 * E["util"]),
          "- NIOSH manual loading of the raw crankcase 16.5 kg: RWL %.1f kg, LI %.2f -> **lifting aid required** (jib crane + gripper)." % (E["RWL"], E["LI"]),
          "- Light curtain operator / shuttle side: T = %.0f ms, C = %.0f mm: S(K=2000) = %.0f mm > 500 -> K = 1600: **S = %.0f mm**." % (1000 * E["T_stop_s"], E["C"], E["S2000"], E["S"]), ""]
    return "\n".join(L)


def specs(d, R):
    A, B, D, E = R["A"], R["B"], R["D"], R["E"]
    return {"_note": "input of conv_3d stations / drawings D16-D20 (mm)",
            "pd_end": {"guide_gap": d["pd"]["guide_gap_mm"], "lead_in_deg": d["pd"]["lead_in_deg"], "lead_in_len": d["pd"]["lead_in_len_mm"],
                       "transfer_gap": d["pd"]["transfer_gap_mm"], "buffer_stroke": d["pd"]["buffer_stroke_mm"], "light_curtain": "muting, at the lane end"},
            "check": {"w_lim": B["w_lim"], "fr_lim": B["fr_lim"], "h_lim": B["h_lim"], "grid_res": B["grid_res"], "cells": d["check"]["cells"], "cell_cap_kg": B["cap"],
                      "frame": "portal over TU1: 2 vertical light grids at +-(400 + w_lim), 1 horizontal grid at h_lim above the conveyor top, ID reader on the operator side"},
            "pick": {"trolley_places": d["kit"]["trolley_places"], "bins_per_crate": d["kit"]["bins_per_crate"], "bin": "600 x 400 x 147.5 (VDA RL-KLT 6147 class), 2 layers x 4",
                     "platform_h": 300, "pick_to_light": True, "shelf_for_bins": True},
            "flow": {"slope_pct": round(100 * D["slope"], 2), "lane_len_m": D["L"], "brake_spacing_m": D["brake_spacing_m"], "lanes": D["lanes"],
                     "entry_mm": d["flow"]["entry_mm"], "exit_mm": round(D["exit_mm"]), "return": "powered, ball-transfer deck at the exit"},
            "hmc": {"table_top_mm": 900, "pallet_mm": d["hmc"]["pallet_mm"], "tomb_mm": d["hmc"]["tomb_mm"], "index_motor_kW": E["P_motor"],
                    "clamp_bore": E["bore"], "light_curtain_S_mm": round(E["S"]), "jib_radius_m": 3.0, "jib_swl_kg": 125}}


def cmd_run(d):
    out = os.path.join(HERE, "out", "stations")
    os.makedirs(out, exist_ok=True)
    R = build(d)
    with open(os.path.join(out, "stations_report.md"), "w", encoding="utf-8") as fh:
        fh.write(report(d, R))
    drop, pick, rules = handshake_sequences()

    def w(name, head, rows):
        with open(os.path.join(out, name), "w", newline="", encoding="utf-8") as fh:
            c = csv.writer(fh)
            c.writerow(head)
            c.writerows(rows)
    w("handshake.csv", ["id", "direction", "signal", "meaning"], d["handshake"])
    w("handshake_sequences.csv", ["sequence", "step", "AGV / station action", "other side", "timeout"],
      [["drop-off"] + r for r in drop] + [["pick-up"] + r for r in pick] + [["rule", str(i + 1), r, "", ""] for i, r in enumerate(rules)])
    w("reject_codes.csv", ["code", "meaning", "detected by", "reaction"], reject_codes())
    w("kit_visits.csv", ["variant", "part", "qty_unit", "kg", "class", "picks_kit_visit", "parts_per_crate", "crate_visits", "bins_per_crate_visit", "t_crate_visit_s", "crate_visits_month"],
      [[vk, r["part"], r["uq"], round(r["m"], 2), r["cls"], r["picks"], r["ppc"], r["crates"], r["bins"], round(r["t_visit"]), round(r["visits"], 1)] for vk, v in R["kit"]["per"].items() for r in v["kitted"]])
    w("flow_lanes.csv", ["dept", "part", "buffer_crates", "places", "lanes", "length_m"], R["D"]["lanes"])
    with open(os.path.join(out, "stations_specs.json"), "w", encoding="utf-8") as fh:
        json.dump(specs(d, R), fh, indent=1)
    print(report(d, R))
    print("written to", out)


def selftest(d):
    res = []

    def ck(n, c):
        res.append(bool(c))
        print(("PASS " if c else "FAIL ") + n)
    R = build(d, des=True)
    A, B, ka, nio, fb, D, E = R["A"], R["B"], R["kit"], R["niosh"], R["des"], R["D"], R["E"]
    ck("A lateral: worst %.1f mm inside the guide capture %.1f mm" % (A["lat_worst"], A["capture"]), A["lat_ok"])
    ck("A height step: RSS %.1f mm ok, worst %.0f mm NOT ok -> deck levelling requirement +-%d mm handed to F5" % (A["step_rss"], A["step_worst"], A["deck_req_mm"]),
       A["step_ok_rss"] and not A["step_ok_worst"] and A["deck_req_mm"] == 3)
    ck("A end stop: E = m v^2/2 = 6 J, peak %.2f g <= 0.5 g" % A["a_peak_g"], abs(A["E_J"] - 6.0) < 1e-9 and A["stop_ok"])
    ck("A transfer time %.0f s = F4.1 assumption 10 s" % A["t_transfer"], abs(A["t_transfer"] - 10.0) < 1e-9)
    ck("B width limit %d mm from gap/2 - x tolerance - safety (F3 data)" % B["w_lim"], B["w_lim"] == 20)
    ck("B height rule %d mm <= available %.0f mm" % (B["h_lim"], B["h_avail"]), B["h_ok"])
    ck("B load cell %d kg >= design per-cell load %.0f kg" % (B["cap"], B["per_cell_kg"]), B["cap"] >= B["per_cell_kg"] and B["cap"] == 500)
    ck("B uncertainty %.2f kg -> accept limit %.1f kg < 300 kg (guard band)" % (B["u"], B["accept_max"]), B["accept_max"] < 300 and B["u"] < 1.5)
    ck("B settling %.2f s << 8 s check time" % B["t_settle"], B["settle_ok"])
    c01 = [r for r in B["plaus"] if r[0] == "C01"][0]
    c08 = [r for r in B["plaus"] if r[0] == "C08"][0]
    ck("B plausibility: one missing crankcase detectable, one missing con-rod not", c01[5] == "yes" and c08[5] == "no")
    vc = ka["per"]["VC20"]
    lim = R["lim"]
    ck("C limits derived from NIOSH: kit <= %.1f kg, bins <= %.0f kg" % (lim["heavy_limit_kg"], lim["bin_kg_max"]), lim["heavy_limit_kg"] == 5.0 and lim["bin_kg_max"] == 8.0)
    ck("C first design (8 kg / 15 kg bins) violates NIOSH: LI %.2f / %.2f > 1" % (R["niosh0"][0]["LI"], R["niosh0"][3]["LI"]), R["niosh0"][0]["LI"] > 1 and R["niosh0"][3]["LI"] > 1)
    ck("C VC20: crankcase and flywheel are line-fed, 7 small parts kitted", {h[0] for h in vc["heavy"]} == {"C01", "C09"} and len(vc["kitted"]) == 7)
    ck("C kit trolley payload: %d units x %.1f kg <= 240 kg" % (vc["n_kit"], vc["M_unit"]), vc["n_kit"] * vc["M_unit"] <= 240 and (vc["n_kit"] + 1) * vc["M_unit"] > 240)
    c04 = [r for r in vc["kitted"] if r["part"] == "C04"][0]
    ck("C crate capacity in bins: C04 %d parts/crate (8 bins x %d) -> %d crate visits per kit visit" % (c04["ppc"], int(8 // 3.3), c04["crates"]), c04["ppc"] <= 16 and c04["crates"] == math.ceil(52 / c04["ppc"]))
    ck("C every crate visit: picks x mass <= 8 bins x 8 kg", all(r["picks"] / r["crates"] * r["m"] <= 64.0 + 1e-9 for v in ka["per"].values() for r in v["kitted"]))
    ck("C kit crate visits %.0f/month and mean %.0f s per visit (F3: %.0f visits; F4.1: 90 s)" % (ka["visits_month"], ka["t_mean"], fb["f3_visits"]), ka["visits_month"] > 0 and ka["t_mean"] > 0)
    n = fb["new"]
    ck("C AS/RS front with real kitting values: stable (backlog %d), crane %.0f %%, AGV wait p95 %.0f s" % (n["backlog_end"], 100 * n["crane_util"], n["agv_wait_p95_s"]),
       n["backlog_end"] < 15 and n["crane_util"] < 0.6 and n["agv_wait_p95_s"] <= 60 and abs(n["kit_h"] - n["lam_kit_h"]) / n["lam_kit_h"] < 0.2)
    far = [c for c in nio if "FAR" in c["case"]][0]
    ck("C NIOSH final: near picks and bin lift LI < 1, far bin not allowed (H > 63 cm) -> bin pulling",
       far["RWL"] == 0 and all(c["LI"] < 1 for c in nio if "FAR" not in c["case"]))
    hm = 25 / 45
    ck("C NIOSH hand value near/top: 23 x 25/45 x (1-0.003x45) x (0.82+4.5/25) x 0.5 x 0.95", abs(nio[0]["RWL"] - 23 * hm * (1 - 0.003 * 45) * (0.82 + 4.5 / 25) * 0.5 * 0.95) < 1e-9)
    ck("D gravity lane needs brake rollers: v_end %.2f m/s > 0.3 m/s" % D["v_end"], D["brakes"])
    ck("D one lane per part type + one return lane per department; places %d" % D["places"], all(r[4] >= 1 for r in D["lanes"]) and any(r[1].startswith("empty-crate return") for r in D["lanes"]))
    ck("D exit height %.0f mm >= %d mm (entry %d mm by the AGV lift); slide force %.0f N; return lane rise %.1f %% <= 2 %%" % (D["exit_mm"], d["flow"]["exit_min_mm"], d["flow"]["entry_mm"], D["F_slide"], 100 * D["rise"]),
       D["exit_mm"] >= d["flow"]["exit_min_mm"] and D["F_slide"] < 20 and D["rise"] <= 0.02)
    ck("D flow-rack faces fit the department widths (%s)" % ", ".join("%s %.1f/%.1f" % (k, D["face"][k], D["width"][k]) for k in sorted(D["face"])), all(D["face"][k] <= D["width"][k] for k in D["face"]))
    fa = E["cls"]["FA"]
    ck("E trapezoid: omega = (pi/2)/(2 s) = 0.785, alpha = 0.785 rad/s^2", abs(fa["w"] - math.pi / 4) < 1e-9 and abs(fa["alpha"] - math.pi / 4) < 1e-9)
    ck("E clamp C01: %.0f N -> bore %d mm gives %.0f N" % (E["F_clamp"], E["bore"], E["F_bore"]), E["F_bore"] >= E["F_clamp"])
    ck("E accumulator keeps %.1f bar >= 220 after 15 min" % E["p_end"], E["p_end"] >= d["hmc"]["p_switch_bar"])
    ck("E load-station time F1 model = F2 values (FA %.2f, FC %.2f min)" % (E["ls"]["FA"]["t_f1_min"], E["ls"]["FC"]["t_f1_min"]),
       abs(E["ls"]["FA"]["t_f1_min"] - d["hmc"]["f2_ls_min"]["FA"]) < 0.01 and abs(E["ls"]["FC"]["t_f1_min"] - d["hmc"]["f2_ls_min"]["FC"]) < 0.01)
    ck("E NIOSH LI %.2f > 1 -> lifting aid (agrees with the F1 hoist rule > 15 kg)" % E["LI"], E["LI"] > 1)
    ck("E ISO 13855: S = %.0f mm (K = 1600 branch, >= 500)" % E["S"], E["S2000"] > 500 and abs(E["S"] - (1600 * E["T_stop_s"] + E["C"])) < 1e-9)
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
