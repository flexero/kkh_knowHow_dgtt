#!/usr/bin/env python3
"""Final thesis item F4.2 - mechanical design of the conveyor modules of the combined FMS.

Modules (from F4.1 out/modules.csv):
  CC   chain zone 1.2 m, 2 strands, crate 800-leading (AS/RS front CV1 / CV2)
  TU   transfer unit: chain section (x) + roller set (y, 1200-leading) lifted 30 mm by two eccentric shafts
  RCX  cross roller zone 1.4 m, chain-driven live rollers (Z31 pick place)
  RL   P&D lane zone 1.4 m, chain-driven live rollers, crate 1200-leading (all department P&D stations)

Python 3 standard library only, offline. Data: conv_mech_data.json. Outputs (out/mech/): calc_report.md,
module_specs.json (input of conv_3d.py), bom_modules.csv. Guide: Doctor paper/61 chapters 11-20.

Commands
  python conv_mech.py selftest
  python conv_mech.py run

Formulas (guide chapter numbers)
  12 crate base rule         runners must CROSS the chains / rollers; >= 3 rollers under a runner: pitch <= L_runner / 3
  13 chain pull per strand   F = (m/2 + q L) g f_top + q L g f_ret + (m/2 + 2 q L) a          (one crate per zone)
     chain checks            SF = F_B / (k_s F) >= 8 ; p = k_s F / A <= p_allow ; roller pressure = F_c / (n_r d1 b1)
     sprocket                d0 = p / sin(180 deg / z) ; n = 60 v / (pi d0) ; T = 2 F d0 / 2 / eta_chain
  14 motor                   P = k_s * 2 F v / (eta_gear eta_chain) -> next IEC size ; i = n_motor / n ;
                             start: T_need <= k_start * P 9550 / n_motor * i * eta_gear
  15 shaft                   M = R a ; T in the shaft ; sigma_v = sqrt(sigma_b^2 + 3 tau^2) <= R_e / 2 (static)
                             fatigue (Goodman): 1/SF = K_f sigma_a / S_e + sqrt(3) tau_m / R_m , S_e = 0.5 R_m k_s k_d
                             twist between the sprockets phi = (T/2) l / (G J) <= 0.25 deg/m ; strand offset = phi d0 / 2
  16 bearings                L10h = (C / P)^3 10^6 / (60 n) >= 30 000 h
  17 rollers                 2 point loads (runners) on a simply supported tube: M, delta (superposition) ;
                             delta <= L / 500 ; sigma <= 120 MPa ; ball bearings L10h
     roller drive            F = f m g + m a ; loops eta^n ; T = F D / 2
  18 transfer lift           M_max = F e / eta (eccentric at 90 deg) ; n = 30 / t_lift (180 deg in t_lift) ; P = M omega
                             at 180 deg (top dead centre) the eccentric holds the load without torque (self-locking)
  19 frame                   delta = P L^3 / (48 E I) + 5 q L^4 / (384 E I) <= L / 750 ; sigma = M / W
     stop distance           s = v t_r + v^2 / (2 a_d) -> sensor positions in the zone
"""

import argparse
import csv
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def load(path=os.path.join(HERE, "conv_mech_data.json")):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def next_std(lst, x):
    for v in lst:
        if v >= x - 1e-9:
            return v
    return None


# ============================================================================= 12 crate base and orientation
def base_rule(d):
    c = d["crate"]
    r = d["rollers"]
    under = int(c["L_mm"] // r["pitch_mm"])
    return {"rollers_under_runner": under, "ok": under >= d["rule_rollers_under_runner"],
            "pitch_max_mm": c["L_mm"] / d["rule_rollers_under_runner"],
            "table": [["CC chain zone (AS/RS CV1, CV2)", "800 leading", "runners cross the 2 chains", "OK"],
                      ["TU chain part (x)", "800 leading", "runners cross the 2 chains", "OK"],
                      ["TU roller part (y)", "1200 leading", "runners cross the rollers", "OK"],
                      ["RCX Z31 / RL P&D lanes", "1200 leading", "runners cross the rollers", "OK"],
                      ["roller conveyor 800 leading", "800 leading", "runners PARALLEL to the rollers", "NOT ALLOWED"]]}


# ============================================================================= 13/14 chain zone
def chain_zone(d, L=None, m=None):
    g = d["g"]
    C, du = d["chain_cc"], d["duty"]
    L = L or C["zone_m"]
    m = m if m is not None else d["crate"]["max_kg"]
    v, a = du["v_m_s"], du["a_m_s2"]
    ks = d["service_factor"]
    names = [c["id"] for c in d["chains_iso606"]]
    imin = names.index(d["chain_min"])
    rows = []
    sel = None
    for i, ch in enumerate(d["chains_iso606"]):
        q = ch["q_kg_m"]
        F_top = (m / 2 + q * L) * g * C["f_roll_top"]
        F_ret = q * L * g * C["f_slide_return"]
        F_acc = (m / 2 + 2 * q * L) * a
        F = F_top + F_ret + F_acc
        SF = ch["FB_kN"] * 1000 / (ks * F)
        p = ks * F / ch["A_mm2"]
        Fc = m * g / (d["crate"]["runners"] * C["strands"]) * d["uneven_factor"]
        n_r = max(1, int(d["crate"]["runner_w_mm"] // ch["p"]))
        pr = Fc / (n_r * ch["d1"] * ch["b1"])
        ok = SF >= C["SF_static"] and p <= C["p_allow_MPa"] and pr <= C["roller_p_allow_MPa"]
        rows.append({"id": ch["id"], "F_top": F_top, "F_ret": F_ret, "F_acc": F_acc, "F": F, "SF": SF, "p": p, "Fc": Fc, "n_r": n_r,
                     "p_roller": pr, "ok": ok, "chain": ch})
        if sel is None and ok and i >= imin:
            sel = rows[-1]
    ch = sel["chain"]
    z = C["sprocket_z"]
    d0 = ch["p"] / math.sin(math.pi / z)
    n = 60 * v / (math.pi * d0 / 1000)
    T = 2 * sel["F"] * d0 / 2000 / C["eta_chain"]
    P_need = ks * 2 * sel["F"] * v / (d["eta_gear_helical_bevel"] * C["eta_chain"])
    Pm = next_std(d["motors_kW"], P_need / 1000)
    i_g = d["motor_rpm"] / n
    T_nom_out = Pm * 9550 / d["motor_rpm"] * i_g * d["eta_gear_helical_bevel"]
    chain_len = 2 * L + math.pi * d0 / 1000
    return {"sel": sel, "rows": rows, "z": z, "d0": d0, "n": n, "T": T, "P_need": P_need, "P_motor": Pm, "i": i_g,
            "T_nom_out": T_nom_out, "start_ok": T * ks <= d["start_torque_ratio"] * T_nom_out,
            "takeup_mm": max(2 * ch["p"], 0.02 * chain_len * 1000), "chain_len_m": chain_len, "links": math.ceil(chain_len * 1000 / ch["p"] / 2) * 2}


# ============================================================================= 15/16 drive shaft + bearings
def shaft(d, cz):
    S = d["shaft"]
    R = cz["sel"]["F"] * 1.1                      # tight strand + 10 % slack-side pre-tension
    a = S["bearing_overhang_mm"]
    M = R * a                                      # N mm, constant between the sprockets
    T = cz["T"] * 1000 * d["service_factor"]      # N mm, motor end -> near sprocket
    l_between = d["chain_cc"]["gauge_mm"]
    out = None
    trial = []
    for dd in S["d_std_mm"]:
        W = math.pi * dd ** 3 / 32
        Wt = 2 * W
        sb, tt = M / W, T / Wt
        sv = math.sqrt(sb ** 2 + 3 * tt ** 2)
        SF_st = S["Re_MPa"] / max(sv, 1e-9)
        Se = 0.5 * S["Rm_MPa"] * 0.85 * (0.85 if dd > 30 else 0.9)
        inv = S["Kf_key"] * sb / Se + math.sqrt(3) * tt / S["Rm_MPa"]
        SF_f = 1 / inv
        J = math.pi * dd ** 4 / 32
        phi = (T / 2) * l_between / (S["G_MPa"] * J)
        phi_deg_m = math.degrees(phi) / (l_between / 1000)
        offset = phi * cz["d0"] / 2
        ok = SF_st >= 2 and SF_f >= S["SF_fatigue"] and phi_deg_m <= S["twist_limit_deg_per_m"] and dd >= 25
        r = {"d": dd, "sigma_b": sb, "tau": tt, "sigma_v": sv, "SF_static": SF_st, "Se": Se, "SF_fatigue": SF_f,
             "twist_deg_m": phi_deg_m, "strand_offset_mm": offset, "ok": ok}
        trial.append(r)
        if ok and out is None:
            out = r
    # bearings (radial load = R, symmetric)
    n = cz["n"]
    brg = None
    for b in d["bearings_ucp"]:
        if b["d"] >= out["d"]:
            L10h = (b["C_kN"] * 1000 / R) ** 3 * 1e6 / (60 * n)
            brg = dict(b, P=R, L10h=L10h, ok=L10h >= d["life_h_min"])
            break
    return {"R": R, "M": M, "T": T, "sel": out, "trial": trial, "bearing": brg}


# ============================================================================= 17 rollers
def roller_beam(L, loads, EI):
    """Simply supported beam, point loads [(a, P)]: max moment and mid-span deflection (superposition)."""
    xs = [L * k / 200 for k in range(201)]
    Mmax = 0.0
    RA = sum(P * (L - a) / L for a, P in loads)
    for x in xs:
        Mx = RA * x - sum(P * (x - a) for a, P in loads if a < x)
        Mmax = max(Mmax, abs(Mx))
    x = L / 2
    dmid = 0.0
    for a, P in loads:
        b = L - a
        if x <= a:
            dmid += P * b * x * (L ** 2 - b ** 2 - x ** 2) / (6 * EI * L)
        else:
            dmid += P * a * (L - x) * (L ** 2 - a ** 2 - (L - x) ** 2) / (6 * EI * L)
    return Mmax, dmid


def rollers(d, zone_m=1.4, m=None):
    g = d["g"]
    r, c, du = d["rollers"], d["crate"], d["duty"]
    m = m if m is not None else c["max_kg"]
    n_zone = int(zone_m * 1000 // r["pitch_mm"])
    n_under = int(c["L_mm"] // r["pitch_mm"])
    F_design = max(m * g / n_under * d["uneven_factor"], m * g / d["rule_rollers_under_runner"])
    L = r["between_frames_mm"]
    loads = [(L / 2 + y, F_design / c["runners"]) for y in c["runner_y_mm"]]
    tube = None
    trial = []
    for D, t in r["tube"]:
        I = math.pi / 64 * (D ** 4 - (D - 2 * t) ** 4)
        Mmax, dl = roller_beam(L, loads, r["E_MPa"] * I)
        sig = Mmax / (I / (D / 2))
        ok_load = sig <= r["sigma_allow_MPa"] and dl <= L / r["defl_limit"]
        ok = ok_load and D >= r["tube_min"][0] and t >= r["tube_min"][1]
        trial.append({"D": D, "t": t, "I": I, "M": Mmax, "sigma": sig, "delta": dl, "ok": ok, "ok_load": ok_load})
        if ok and tube is None:
            tube = trial[-1]
    n_rev = du["v_m_s"] * 60 / (math.pi * tube["D"] / 1000)
    brg = None
    for ax in r["axle_d_mm"]:
        C = r["bearing_C_kN"][str(ax)] * 1000
        L10h = (C / (F_design / 2)) ** 3 * 1e6 / (60 * n_rev)
        if L10h >= d["life_h_min"] and ax >= 20:
            brg = {"axle": ax, "C": C, "P": F_design / 2, "L10h": L10h}
            break
    # drive: chain-driven live roller
    m_roll = n_zone * (math.pi * tube["D"] * tube["t"] * r["length_mm"] * 7.85e-6 + 1.2)   # tube + ends/axle share
    F = r["f_roll"] * m * g + m * du["a_m_s2"] + 0.5 * m_roll * du["a_m_s2"]
    loops = n_zone - 1 + 1
    eta = r["loop_eta"] ** loops
    T_roll = F * tube["D"] / 2000
    v = du["v_m_s"]
    P_need = d["service_factor"] * F * v / (eta * d["eta_gear_helical_bevel"])
    Pm = next_std(d["motors_kW"], P_need / 1000)
    i_g = d["motor_rpm"] / n_rev
    zr = r["sprocket_z_roller"]
    d0 = 12.70 / math.sin(math.pi / zr)
    F_loop1 = T_roll / eta / (d0 / 2000)
    return {"n_zone": n_zone, "n_under": n_under, "F_design": F_design, "tube": tube, "trial": trial, "n_rev": n_rev, "bearing": brg,
            "m_rollers": m_roll, "F_drive": F, "eta_loops": eta, "loops": loops, "T_roll": T_roll, "P_need": P_need, "P_motor": Pm, "i": i_g,
            "F_loop1": F_loop1, "SF_08B": 18000 / (d["service_factor"] * F_loop1)}


# ============================================================================= 18 transfer unit lift
def tu_lift(d):
    g = d["g"]
    T = d["tu"]
    F = (d["crate"]["max_kg"] + T["roller_set_kg"]) * g
    e = T["stroke_mm"] / 2 / 1000
    M = F * e / T["eta_lift"]
    n = 30.0 / T["lift_time_s"]
    P = M * 2 * math.pi * n / 60
    Pm = next_std(d["motors_kW"], d["service_factor"] * P / d["eta_gear_helical_bevel"] / 1000)
    return {"F": F, "e_m": e, "M_max": M, "n_out": n, "P_peak": P, "P_motor": Pm, "i": d["motor_rpm"] / n,
            "E_lift_J": F * T["stroke_mm"] / 1000, "per_point_N": F / T["lift_points"]}


# ============================================================================= 19 frame, stopping
def frame(d, m=None):
    g = d["g"]
    f = d["frame"]
    m = m if m is not None else d["crate"]["max_kg"]
    L = f["leg_pitch_m"] * 1000
    P = m * g / 2
    q = (f["self_kg_m"] + 2.7 + 8.0) * g / 1000          # profile + chain + wear strip/guides per side, N/mm
    EI = f["E_MPa"] * f["Iy_mm4"]
    dl = P * L ** 3 / (48 * EI) + 5 * q * L ** 4 / (384 * EI)
    M = P * L / 4 + q * L ** 2 / 8
    return {"delta": dl, "limit": L / f["defl_limit"], "sigma": M / f["Wy_mm3"], "ok": dl <= L / f["defl_limit"] and M / f["Wy_mm3"] <= f["sigma_allow_MPa"],
            "leg_load_N": P + q * L}


def stopping(d):
    du = d["duty"]
    s = du["v_m_s"] * du["t_react_s"] + du["v_m_s"] ** 2 / (2 * du["decel_m_s2"])
    zone = d["chain_cc"]["zone_m"] * 1000
    gap = zone - d["crate"]["W_mm"]
    return {"s_stop_mm": s * 1000, "gap_mm": gap, "slow_sensor_from_end_mm": 250, "stop_sensor_from_end_mm": 60, "ok": s * 1000 < gap / 4}


# ============================================================================= build / report / outputs
def build(d):
    cz = chain_zone(d)
    sh = shaft(d, cz)
    rl = rollers(d)
    tl = tu_lift(d)
    fr = frame(d)
    st = stopping(d)
    br = base_rule(d)
    du = d["duty"]
    E_zone = (2 * cz["sel"]["F"] * d["chain_cc"]["zone_m"]) / (d["eta_gear_helical_bevel"] * d["chain_cc"]["eta_chain"])
    return {"cz": cz, "sh": sh, "rl": rl, "tl": tl, "fr": fr, "st": st, "br": br, "E_zone_J": E_zone}


def report(d, R):
    cz, sh, rl, tl, fr, st, br = R["cz"], R["sh"], R["rl"], R["tl"], R["fr"], R["st"], R["br"]
    s = cz["sel"]
    L = ["# F4.2 - conveyor modules: mechanical design (conv_mech.py)", "", "All values: DESIGN; catalogue values REFERENCE [verify].", "",
         "## 12 Crate base and conveyor orientation", "",
         "Crate base: %d runners %d x %d mm along the 1200 side. Rollers under one runner at pitch %d mm: %d (rule >= %d, max pitch %.0f mm)." % (
             d["crate"]["runners"], d["crate"]["runner_w_mm"], d["crate"]["runner_h_mm"], d["rollers"]["pitch_mm"], br["rollers_under_runner"],
             d["rule_rollers_under_runner"], br["pitch_max_mm"]), "",
         "| Conveyor | crate orientation | contact | verdict |", "|---|---|---|---|"] + ["| %s | %s | %s | %s |" % tuple(r) for r in br["table"]]
    L += ["", "## 13 Chain zone CC - chain selection (per strand, zone %.1f m, crate %d kg, k_s %.1f)" % (d["chain_cc"]["zone_m"], d["crate"]["max_kg"], d["service_factor"]), "",
          "| chain | F_top N | F_ret N | F_acc N | F N | SF static | p MPa | roller p MPa | ok |", "|---|---|---|---|---|---|---|---|---|"]
    for r in cz["rows"]:
        L.append("| %s | %.0f | %.1f | %.0f | %.0f | %.0f | %.1f | %.2f | %s |" % (r["id"], r["F_top"], r["F_ret"], r["F_acc"], r["F"], r["SF"], r["p"], r["p_roller"], "yes" if r["ok"] else "no"))
    L += ["", "Selected **%s** (minimum %s for robustness). Sprocket z = %d, d0 = %.1f mm, n = %.2f rpm, shaft torque %.1f N m; chain %.2f m = %d links, take-up >= %.0f mm." % (
        s["id"], d["chain_min"], cz["z"], cz["d0"], cz["n"], cz["T"], cz["chain_len_m"], cz["links"], cz["takeup_mm"]), "",
          "## 14 Gear motor CC", "",
          "P needed %.0f W (incl. k_s) -> **%.2f kW**, 4-pole, helical-bevel hollow-shaft gear motor, i = %.0f; output torque nominal %.0f N m vs need %.1f N m; start check %s." % (
              cz["P_need"], cz["P_motor"], cz["i"], cz["T_nom_out"], cz["T"] * d["service_factor"], "OK" if cz["start_ok"] else "NOT OK"), "",
          "## 15 Drive shaft (C45E +N)", "",
          "Radial load per sprocket R = %.0f N, overhang a = %d mm -> M = %.0f N mm; torque (k_s) %.0f N mm." % (sh["R"], d["shaft"]["bearing_overhang_mm"], sh["M"], sh["T"]), "",
          "| d mm | sigma_b MPa | tau MPa | sigma_v MPa | SF static | SF fatigue | twist deg/m | strand offset mm | ok |", "|---|---|---|---|---|---|---|---|---|"]
    for r in sh["trial"]:
        L.append("| %d | %.1f | %.1f | %.1f | %.1f | %.1f | %.3f | %.3f | %s |" % (r["d"], r["sigma_b"], r["tau"], r["sigma_v"], r["SF_static"], r["SF_fatigue"], r["twist_deg_m"], r["strand_offset_mm"], "yes" if r["ok"] else "no"))
    b = sh["bearing"]
    L += ["", "Selected **d = %d mm** (the minimum 25 mm is set by the hollow shaft of the gear motor and the key)." % sh["sel"]["d"], "",
          "## 16 Bearings", "", "**%s** (C = %.1f kN), P = %.0f N, n = %.1f rpm -> L10h = %.2e h (>= %d h): the bearing is chosen by the shaft, not by the load." % (
              b["id"], b["C_kN"], b["P"], cz["n"], b["L10h"], d["life_h_min"]), "",
          "## 17 Roller zones RCX / RL (1.4 m, 1200-leading)", "",
          "%d rollers per zone, %d under the crate; design load per roller %.0f N (max of uneven x share and m g / 3)." % (rl["n_zone"], rl["n_under"], rl["F_design"]), "",
          "| tube D x t | I mm4 | M N mm | sigma MPa | delta mm (limit %.1f) | ok |" % (d["rollers"]["between_frames_mm"] / d["rollers"]["defl_limit"]), "|---|---|---|---|---|---|"]
    for t in rl["trial"]:
        L.append("| %g x %g | %.0f | %.0f | %.1f | %.2f | %s |" % (t["D"], t["t"], t["I"], t["M"], t["sigma"], t["delta"], "yes" if t["ok"] else ("load ok, below robustness minimum" if t["ok_load"] else "no")))
    L += ["", "Selected tube **%g x %g** (robustness minimum %g x %g; by load alone 50 x 1.5 would pass), axle %d mm, bearings L10h %.2e h at %.0f rpm. Drive: F = %.0f N (rolling + acceleration of crate and rollers), %d chain loops eta %.3f, P %.0f W -> **%.2f kW**, i = %.0f; first loop pull %.0f N, 08B safety %.0f." % (
        rl["tube"]["D"], rl["tube"]["t"], d["rollers"]["tube_min"][0], d["rollers"]["tube_min"][1], rl["bearing"]["axle"], rl["bearing"]["L10h"], rl["n_rev"], rl["F_drive"], rl["loops"], rl["eta_loops"], rl["P_need"], rl["P_motor"], rl["i"], rl["F_loop1"], rl["SF_08B"]), "",
          "## 18 Transfer unit lift (eccentric)", "",
          "Lifted mass crate + roller set: F = %.0f N; eccentricity %.0f mm; M_max = %.0f N m at 90 deg; 180 deg in %.1f s -> %.0f rpm; P_peak %.0f W -> **%.2f kW** brake gear motor, i = %.0f. Top dead centre = self-locking (no holding torque); %.0f N per lift point." % (
              tl["F"], tl["e_m"] * 1000, tl["M_max"], d["tu"]["lift_time_s"], tl["n_out"], tl["P_peak"], tl["P_motor"], tl["i"], tl["per_point_N"]), "",
          "## 19 Frame and stopping", "",
          "Side frame %s, leg pitch %.1f m: delta %.2f mm (limit %.2f), sigma %.1f MPa; leg load %.0f N. The profile is chosen by the space for chain guides, sprockets and bearing units, not by strength." % (d["frame"]["profile"], d["frame"]["leg_pitch_m"], fr["delta"], fr["limit"], fr["sigma"], fr["leg_load_N"]),
          "Stopping from %.1f m/s at %.1f m/s^2 with %.0f ms reaction: %.0f mm << gap %.0f mm; slow-down sensor %d mm and stop sensor %d mm before the zone end." % (
              d["duty"]["v_m_s"], d["duty"]["decel_m_s2"], 1000 * d["duty"]["t_react_s"], st["s_stop_mm"], st["gap_mm"], st["slow_sensor_from_end_mm"], st["stop_sensor_from_end_mm"]), "",
          "Energy per crate per chain zone: %.0f J (%.3f Wh)." % (R["E_zone_J"], R["E_zone_J"] / 3600), ""]
    return "\n".join(L)


def specs(d, R):
    cz, sh, rl, tl = R["cz"], R["sh"], R["rl"], R["tl"]
    ch = cz["sel"]["chain"]
    return {
        "_note": "geometry + selected parts for the 3D model and drawings (conv_3d.py); mm",
        "crate": d["crate"], "conveyor_top_mm": 700,
        "CC": {"length": 1200, "width_frames": 1310, "gauge": d["chain_cc"]["gauge_mm"], "chain": ch["id"], "pitch": ch["p"], "roller_d1": ch["d1"],
               "sprocket_z": cz["z"], "sprocket_d0": round(cz["d0"], 1), "shaft_d": sh["sel"]["d"], "bearing": sh["bearing"]["id"],
               "motor_kW": cz["P_motor"], "ratio": round(cz["i"]), "frame": d["frame"]["profile"], "leg_pitch": 1200, "takeup_mm": round(cz["takeup_mm"])},
        "RL": {"length": 1400, "width_frames": d["rollers"]["between_frames_mm"], "roller_pitch": d["rollers"]["pitch_mm"], "rollers": rl["n_zone"],
               "roller_D": rl["tube"]["D"], "roller_t": rl["tube"]["t"], "roller_L": d["rollers"]["length_mm"], "axle": rl["bearing"]["axle"],
               "drive_chain": "08B-1", "motor_kW": rl["P_motor"], "ratio": round(rl["i"])},
        "RCX": {"same_as": "RL", "length": d.get("rcx_length_mm", 1400)},
        "TU": {"length": 1200, "chain_part": "as CC", "roller_part": {"rollers": 8, "pitch": d["rollers"]["pitch_mm"], "D": rl["tube"]["D"]},
               "stroke": d["tu"]["stroke_mm"], "eccentric_e": d["tu"]["stroke_mm"] / 2, "lift_motor_kW": tl["P_motor"], "lift_ratio": round(tl["i"]),
               "roller_motor_kW": rl["P_motor"]},
        "PD_end": {"end_stop": "polyurethane buffer 2x, mechanical stop plate 10 mm", "guides": "side guide rails with lead-in 15 deg, gap 25 mm per side",
                   "agv_gap_mm": 30, "agv_height_tol_mm": 10}}


def cmd_run(d):
    out = os.path.join(HERE, "out", "mech")
    os.makedirs(out, exist_ok=True)
    R = build(d)
    with open(os.path.join(out, "calc_report.md"), "w", encoding="utf-8") as fh:
        fh.write(report(d, R))
    with open(os.path.join(out, "module_specs.json"), "w", encoding="utf-8") as fh:
        json.dump(specs(d, R), fh, indent=1)
    cz, sh, rl, tl = R["cz"], R["sh"], R["rl"], R["tl"]
    rows = [
        ["CC", "C1", "side frame %s, 1200 mm" % d["frame"]["profile"], 2, "S355, galvanised"],
        ["CC", "C2", "roller chain ISO 606 %s, %d links" % (cz["sel"]["id"], cz["links"]), 2, "endless, connecting link"],
        ["CC", "C3", "chain guide C-profile + UHMW-PE wear strip, top + return", 4, "PE 1000"],
        ["CC", "C4", "sprocket %s z=%d (drive) + z=%d (idler, take-up)" % (cz["sel"]["id"], cz["z"], cz["z"]), 4, "C45, hardened teeth"],
        ["CC", "C5", "drive shaft d %d C45E+N with 2 keyways" % sh["sel"]["d"], 1, ""],
        ["CC", "C6", "idler shaft d %d" % sh["sel"]["d"], 1, ""],
        ["CC", "C7", "insert bearing unit %s (drive) + take-up units (idler)" % sh["bearing"]["id"], 4, ""],
        ["CC", "C8", "helical-bevel hollow-shaft gear motor %.2f kW i = %.0f, torque arm" % (cz["P_motor"], cz["i"]), 1, "inverter-fed (F4.5)"],
        ["CC", "C9", "legs 80x80 + base plate + 2 anchors M12, height adjust +-25", 2, "per 1.2 m"],
        ["CC", "C10", "photoelectric sensors (slow-down, stop)", 2, "F4.5"],
        ["RL", "R1", "side frame %s, 1400 mm" % d["frame"]["profile"], 2, ""],
        ["RL", "R2", "roller %g x %g x %d, axle %d, bearings 62%02d, double sprocket 08B z=%d" % (rl["tube"]["D"], rl["tube"]["t"], d["rollers"]["length_mm"], rl["bearing"]["axle"], rl["bearing"]["axle"] // 5, d["rollers"]["sprocket_z_roller"]), rl["n_zone"], "zinc plated"],
        ["RL", "R3", "roller-to-roller chain loops 08B-1", rl["loops"], ""],
        ["RL", "R4", "gear motor %.2f kW i = %.0f + drive sprocket" % (rl["P_motor"], rl["i"]), 1, "inverter-fed"],
        ["RL", "R5", "chain guard (EN ISO 13857)", 1, ""],
        ["RL", "R6", "legs + base plates", 2, ""],
        ["TU", "T1", "chain part as CC (frames, 2 chains, shafts, gear motor)", 1, ""],
        ["TU", "T2", "roller set: 8 rollers as RL in a lifting frame, gear motor %.2f kW" % rl["P_motor"], 1, ""],
        ["TU", "T3", "eccentric shafts e = %.0f mm with 2 cam followers each, coupled by chain 10B" % (d["tu"]["stroke_mm"] / 2), 2, ""],
        ["TU", "T4", "brake gear motor lift %.2f kW i = %.0f" % (tl["P_motor"], tl["i"]), 1, ""],
        ["TU", "T5", "inductive sensors lift up / down + cam position", 3, "F4.5"],
        ["TU", "T6", "vertical guides (4 linear guide blocks)", 4, ""]]
    with open(os.path.join(out, "bom_modules.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["module", "pos", "description", "qty_per_module", "note"])
        w.writerows(rows)
    print(report(d, R))
    print("written to", out)


def selftest(d):
    res = []

    def ck(n, c):
        res.append(bool(c))
        print(("PASS " if c else "FAIL ") + n)
    R = build(d)
    cz, sh, rl, tl, fr, st, br = R["cz"], R["sh"], R["rl"], R["tl"], R["fr"], R["st"], R["br"]
    ck("crate rule: %d rollers under a runner >= 3; roller conveyor 800-leading is not allowed" % br["rollers_under_runner"],
       br["ok"] and br["table"][-1][3] == "NOT ALLOWED")
    # hand value chain pull 12B: (150 + 1.25*1.2)*9.81*0.12 + 1.25*1.2*9.81*0.25 + (150 + 3.0)*0.3
    hand = (150 + 1.5) * 9.81 * 0.12 + 1.5 * 9.81 * 0.25 + 153.0 * 0.3
    r12 = [r for r in cz["rows"] if r["id"] == "12B-1"][0]
    ck("chain pull 12B per strand = hand value %.1f N" % hand, abs(r12["F"] - hand) < 0.01)
    ck("selected chain = 12B-1 (smallest passing >= the robustness minimum), SF %.0f >= 8" % cz["sel"]["SF"], cz["sel"]["id"] == "12B-1" and cz["sel"]["SF"] >= 8)
    ck("sprocket d0 for 12B z=15 = 91.6 mm (p / sin 12 deg)", abs(cz["d0"] - 19.05 / math.sin(math.radians(12))) < 1e-6 and abs(cz["d0"] - 91.6) < 0.1)
    ck("sprocket speed %.1f rpm = 60 v / (pi d0)" % cz["n"], abs(cz["n"] - 60 * 0.2 / (math.pi * cz["d0"] / 1000)) < 1e-9)
    ck("CC gear motor %.2f kW covers the need %.0f W and starts the load" % (cz["P_motor"], cz["P_need"]), cz["P_motor"] * 1000 >= cz["P_need"] and cz["start_ok"])
    ck("shaft d %d mm: static SF %.1f >= 2, fatigue SF %.1f >= 2, twist %.3f deg/m <= 0.25" % (sh["sel"]["d"], sh["sel"]["SF_static"], sh["sel"]["SF_fatigue"], sh["sel"]["twist_deg_m"]), sh["sel"]["ok"])
    ck("bearing %s life %.1e h >= 30 000 h" % (sh["bearing"]["id"], sh["bearing"]["L10h"]), sh["bearing"]["ok"])
    # roller beam check against the closed formula for ONE central load
    EI = 210000 * 1e5
    Mx, dx = roller_beam(1000, [(500, 1000)], EI)
    ck("roller beam: one central load -> M = PL/4, delta = PL^3/(48EI)", abs(Mx - 1000 * 1000 / 4) < 1e-6 and abs(dx - 1000 * 1000 ** 3 / (48 * EI)) < 1e-9)
    Mo, do = roller_beam(1000, [(300, 1000)], EI)
    ck("roller beam: off-centre load (a = 300) mid deflection = P a (L-x)(L^2-a^2-(L-x)^2)/(6EIL)", abs(do - 1000 * 300 * 500 * (1000 ** 2 - 300 ** 2 - 500 ** 2) / (6 * EI * 1000)) < 1e-9)
    ck("roller beam: the same load from the other side gives the same mid deflection (symmetry)", abs(roller_beam(1000, [(700, 1000)], EI)[1] - do) < 1e-12)
    ck("roller tube %g x %g: sigma %.0f MPa <= 120, delta %.2f mm <= L/500" % (rl["tube"]["D"], rl["tube"]["t"], rl["tube"]["sigma"], rl["tube"]["delta"]), rl["tube"]["ok"])
    ck("roller bearings life %.1e h >= 30 000 h, axle %d mm" % (rl["bearing"]["L10h"], rl["bearing"]["axle"]), rl["bearing"]["L10h"] >= 30000)
    ck("roller drive motor %.2f kW >= need %.0f W; 08B loop safety %.0f >= 8" % (rl["P_motor"], rl["P_need"], rl["SF_08B"]), rl["P_motor"] * 1000 >= rl["P_need"] and rl["SF_08B"] >= 8)
    ck("TU lift: M = F e / eta = %.0f N m, 20 rpm for 180 deg in 1.5 s" % tl["M_max"], abs(tl["M_max"] - tl["F"] * 0.015 / 0.85) < 1e-9 and abs(tl["n_out"] - 20) < 1e-9)
    ck("TU lift motor %.2f kW >= peak power x k_s / eta" % tl["P_motor"], tl["P_motor"] * 1000 >= tl["P_peak"] * d["service_factor"] / d["eta_gear_helical_bevel"])
    ck("frame deflection %.2f mm <= %.2f mm and stress %.0f MPa ok" % (fr["delta"], fr["limit"], fr["sigma"]), fr["ok"])
    ck("stopping distance %.0f mm << zone gap %.0f mm" % (st["s_stop_mm"], st["gap_mm"]), st["ok"])
    ck("module specs contain the selected parts for the 3D model", specs(d, R)["CC"]["chain"] == "12B-1" and specs(d, R)["RL"]["rollers"] == rl["n_zone"])
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
