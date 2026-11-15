#!/usr/bin/env python3
"""Final thesis item F3 - AS/RS core design: crates, storage positions, throughput, rack, stacker crane, FEM 9.851 cycle,
drives, structure, positioning, energy, availability buffers, option one aisle vs two aisles.

Python 3 standard library only, offline. Inputs: asrs_data.json + F1 routings + F2 programme / layout.
Output: out/design_result.json (input of the 3D, electrical and PLC programs of this item), out/report.md, out/bom_mech.csv
Guide: Doctor paper/60_final_asrs.md (formulas = docs/31 section 17, generalised).

Commands
  python asrs_design.py selftest
  python asrs_design.py run [--out out]
"""

import argparse
import copy
import csv
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "01_products"))
sys.path.insert(0, os.path.join(HERE, "..", "02_fms"))
import products as P  # noqa: E402
import fms_design as F2  # noqa: E402

DATA = os.path.join(HERE, "asrs_data.json")
G = 9.81


def load(path=DATA):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# ----------------------------------------------------------------------------- 1 crates and stock
def part_flows(a):
    """Pieces per month of every made part (raw = machined), mass, raw and machined parts per crate."""
    d2, pdata = F2.load_all()
    dem = d2["programme"]["demand_month"]
    c = a["crate"]
    out = {}
    for pk, vk, params in P.variants(pdata):
        q = dem.get(vk, 0)
        if not q:
            continue
        prod = pdata["products"][pk]
        for part in prod["parts"]:
            key = part["id"] + ("" if pk == "VC20" else "-" + vk)
            uq = P.unit_qty(prod, pk, part["parent"], part["qty"])
            m = P.val(part["m_blank"], params)
            ppc = min(a["parts_per_crate_raw"][part["id"]], int((c["max_gross_kg"] - c["tare_kg"]) // m))
            ppm = max(1, int(ppc * a["machined_fill"]))
            out[key] = {"part": part["id"], "variant": vk, "pcs_month": q * uq, "m_kg": m, "ppc_raw": ppc, "ppc_mach": ppm,
                        "crate_kg_raw": c["tare_kg"] + ppc * m}
    return out, d2


def storage(a, flows):
    s = a["stock"]
    days = s["work_days_month"]
    rows = []
    tot = {"raw_pos": 0, "kit_pos": 0, "raw_crates_m": 0.0, "kit_crates_m": 0.0}
    for k, f in sorted(flows.items()):
        daily = f["pcs_month"] / days
        cr_raw_d = daily / f["ppc_raw"]
        cr_kit_d = daily / f["ppc_mach"]
        raw_pos = max(s["min_crates_per_part"], math.ceil(cr_raw_d * (s["raw_lot_days"] + s["raw_safety_days"])))
        kit_pos = max(s["min_crates_per_part"], math.ceil(cr_kit_d * (s["kit_avg_days"] + s["kit_safety_days"])))
        rows.append((k, f["pcs_month"], f["ppc_raw"], f["ppc_mach"], round(f["crate_kg_raw"], 1), cr_raw_d * days, cr_kit_d * days, raw_pos, kit_pos))
        tot["raw_pos"] += raw_pos
        tot["kit_pos"] += kit_pos
        tot["raw_crates_m"] += cr_raw_d * days
        tot["kit_crates_m"] += cr_kit_d * days
    return rows, tot


def moves(a, tot, d2):
    s = a["stock"]
    H = d2["programme"]["H_month"]
    units = sum(d2["programme"]["demand_month"].values())
    batches = units / s["kit_batch_units"]
    m_raw = 2 * tot["raw_crates_m"]                                       # store from truck + retrieve to cell
    m_kit = 2 * tot["kit_crates_m"] + 2 * batches * s["kit_crate_visits_per_batch"]   # store + final out + pick visits (out + back)
    avg = (m_raw + m_kit) / H
    return {"raw_month": m_raw, "kit_month": m_kit, "batches_month": batches, "avg_h": avg, "peak_h": avg * s["peak_factor"]}


# ----------------------------------------------------------------------------- 2 rack geometry
def rack_geometry(a, positions):
    r, c = a["rack"], a["crate"]
    levels = int((r["clear_height_m"] - r["top_clearance_m"] - r["z1_m"] - c["H_mm"] / 1000) // r["level_pitch_m"]) + 1
    bay_mm = r["upright_w_mm"] + (r["crates_per_bay"] + 1) * r["gap_mm"] + r["crates_per_bay"] * c["W_mm"]
    per_bay = 2 * r["crates_per_bay"] * levels
    need = math.ceil(positions / r["fill_factor"])
    bays = math.ceil(need / per_bay)
    L = (bays * bay_mm + r["upright_w_mm"]) / 1000
    top_level_z = r["z1_m"] + (levels - 1) * r["level_pitch_m"]
    Hr = top_level_z + c["H_mm"] / 1000 + 0.3
    width = (2 * c["L_mm"] + r["aisle_mm"] + 2 * r["upright_w_mm"]) / 1000
    return {"levels": levels, "bay_mm": bay_mm, "bays": bays, "positions": bays * per_bay, "need": need, "length_m": L,
            "rack_height_m": Hr, "top_level_z_m": top_level_z, "width_m": width,
            "footprint_m2": (L + r["front_zone_m"] + r["rear_zone_m"]) * width, "clear_beam_mm": bay_mm - r["upright_w_mm"]}


# ----------------------------------------------------------------------------- 3 crane, FEM 9.851
def trap(d, v, acc):
    """Trapezoid move time: d >= v^2/a: t = d/v + v/a ; else t = 2 sqrt(d/a)."""
    if d <= 0:
        return 0.0
    return d / v + v / acc if d >= v * v / acc else 2 * math.sqrt(d / acc)


def crane_masses(a, geo):
    cr = a["crane"]
    m = cr["mast"]
    area = 2 * (m["b"] + m["h"]) * m["t"] - 4 * m["t"] ** 2          # mm2
    H_mast = geo["rack_height_m"] + 0.5
    m_mast = area * 1e-6 * H_mast * cr["rho_steel"]
    tot = cr["m_bottom_kg"] + cr["m_top_kg"] + cr["m_carriage_kg"] + cr["m_rest_kg"] + m_mast
    return {"mast_area_mm2": area, "H_mast_m": H_mast, "m_mast": m_mast, "m_crane": tot}


def fem9851(a, geo):
    cr = a["crane"]
    L = geo["length_m"] + 1.2                       # I/O transfer point 1.2 m in front of the rack
    Hh = geo["top_level_z_m"] - a["rack"]["z1_m"]
    P1 = (L / 5, 2 * Hh / 3)
    P2 = (2 * L / 3, Hh / 5)

    def move(p, q):
        tx = trap(abs(q[0] - p[0]), cr["v_x"], cr["a_x"])
        tz = trap(abs(q[1] - p[1]), cr["v_z"], cr["a_z"])
        return max(tx, tz) + cr["t_pos_s"]

    t_fork = 2 * trap(cr["fork_stroke_m"], cr["v_f"], cr["a_f"]) + trap(cr["fork_lift_m"], 0.2, cr["a_z"]) + cr["t_dead_s"]
    O = (0.0, 0.0)
    sc = (2 * move(O, P1) + 2 * move(O, P2)) / 2 + 2 * t_fork
    dc = move(O, P1) + move(P1, P2) + move(P2, O) + 4 * t_fork
    return {"P1": P1, "P2": P2, "t_fork": t_fork, "SC": sc, "DC": dc, "moves_h_SC": 3600 / sc, "moves_h_DC": 2 * 3600 / dc,
            "travel_L": L, "lift_H": Hh}


def capacity(fem, p_dual):
    """Moves per hour when a share p of the moves can be paired into dual cycles."""
    return 3600.0 / (p_dual * fem["DC"] / 2 + (1 - p_dual) * fem["SC"])


# ----------------------------------------------------------------------------- 4 drives
def next_motor(a, kw):
    return next(m for m in a["motors_kW"] if m >= kw)


def drives(a, ms):
    cr = a["crane"]
    load = a["crate"]["max_gross_kg"]
    mt = ms["m_crane"] + load
    # travel
    F_tr = mt * cr["a_x"] * cr["k_rot"] + cr["w_roll"] * mt * G
    P_tr_peak = F_tr * cr["v_x"] / cr["eta_T"] / 1000
    P_tr_cont = cr["w_roll"] * mt * G * cr["v_x"] / cr["eta_T"] / 1000
    n_wheel = cr["v_x"] / (math.pi * cr["wheel_D_mm"] / 1000) * 60
    tr = {"F_N": F_tr, "P_peak_kW": P_tr_peak, "P_cont_kW": P_tr_cont, "motor_kW": next_motor(a, max(P_tr_peak / cr["overload"], P_tr_cont)),
          "n_out_rpm": n_wheel, "ratio": cr["motor_rpm"] / n_wheel, "torque_out_Nm": F_tr * cr["wheel_D_mm"] / 2000}
    # hoist
    mh = cr["m_carriage_kg"] + load
    P_h_st = mh * G * cr["v_z"] / cr["eta_H"] / 1000
    P_h_pk = mh * (G + cr["a_z"]) * cr["v_z"] / cr["eta_H"] / 1000
    n_drum = cr["v_z"] * cr["reeving"] / (math.pi * cr["drum_D_mm"] / 1000) * 60
    rope_F = mh * (G + cr["a_z"]) / cr["reeving"] * 1.0
    ho = {"P_static_kW": P_h_st, "P_peak_kW": P_h_pk, "motor_kW": next_motor(a, max(P_h_st, P_h_pk / cr["overload"])),
          "n_out_rpm": n_drum, "ratio": cr["motor_rpm"] / n_drum, "rope_F_N": rope_F, "rope_safety": cr["rope_Fmin_kN"] * 1000 / rope_F,
          "torque_out_Nm": rope_F * cr["drum_D_mm"] / 2000, "P_regen_kW": mh * G * cr["v_z"] * cr["eta_back"] / 1000}
    # fork (2-stage telescopic: top stage moves fork_mult x the pinion rack speed)
    mf = cr["fork_m_moving_kg"] + load
    F_f = mf * (cr["a_f"] + 0.05 * G)
    P_f = F_f * cr["v_f"] / cr["eta_F"] / 1000
    n_pin = cr["v_f"] / cr["fork_mult"] / (math.pi * cr["fork_pinion_D_mm"] / 1000) * 60
    fo = {"F_N": F_f, "P_kW": P_f, "motor_kW": next_motor(a, P_f), "n_out_rpm": n_pin, "ratio": cr["motor_rpm"] / n_pin}
    return {"travel": tr, "hoist": ho, "fork": fo}


# ----------------------------------------------------------------------------- 5 structure
def structure(a, geo, ms):
    r, cr = a["rack"], a["crane"]
    E = r["E"]
    Q = a["crate"]["max_gross_kg"]
    bm = r["beam"]
    I = (bm["b"] * bm["h"] ** 3 - (bm["b"] - 2 * bm["t"]) * (bm["h"] - 2 * bm["t"]) ** 3) / 12
    W = I / (bm["h"] / 2)
    P = Q * G / 2                                             # each crate on two beams -> per beam one point load / crate side
    Lb = geo["clear_beam_mm"]
    aa = (Lb - (r["crates_per_bay"] - 1) * r["gap_mm"] - r["crates_per_bay"] * a["crate"]["W_mm"]) / 2 + a["crate"]["W_mm"] / 2
    M = P * aa / 1000
    sig = r["gamma_Q"] * M * 1000 / W
    defl = P * aa * (3 * Lb ** 2 - 4 * aa ** 2) / (24 * E * I)
    up = r["upright"]
    N_k = Q * G * geo["levels"] / 1000                        # kN per upright (two half-crates from each side ~ one crate)
    N_g = up["m_per_level_kg"] * geo["levels"] * G / 1000
    N_Ed = r["gamma_Q"] * N_k + r["gamma_G"] * N_g
    lam1 = math.pi * math.sqrt(E / up["fy"])
    lam = (up["L_cr"] / up["i"]) / lam1
    phi = 0.5 * (1 + 0.34 * (lam - 0.2) + lam ** 2)
    chi = 1 / (phi + math.sqrt(phi ** 2 - lam ** 2))
    N_bRd = chi * up["A_eff"] * up["fy"] / 1000
    floor = (N_k + N_g) * 1000 / r["base_plate_mm2"]
    # crane wheel loads (load at the far end of the mast side, simplified 60/40 split + tilt from acceleration)
    mt = ms["m_crane"] + Q
    R1 = 0.55 * mt * G / 1000
    R2 = mt * G / 1000 - R1
    h_cg = 0.35 * ms["H_mast_m"]
    dR = 0.5 * mt * cr["a_x"] * h_cg / cr["wheelbase_m"] / 1000
    Rmax = cr["phi"] * R1 + dR
    Pmean = (min(R1, R2) + 2 * Rmax) / 3
    Pal = cr["p_lim"] * cr.get("rail_b_eff_mm", cr["rail_b_mm"]) * cr["wheel_D_mm"] * cr["c1"] * cr["c2"] / 1000
    # mast
    m = cr["mast"]
    Im = (m["b"] * m["h"] ** 3 - (m["b"] - 2 * m["t"]) * (m["h"] - 2 * m["t"]) ** 3) / 12
    Hm = ms["H_mast_m"] * 1000
    q = ms["m_mast"] * cr["a_x"] / Hm                         # N/mm
    Pt = (cr["m_carriage_kg"] + Q + cr["m_top_kg"]) * cr["a_x"]
    d_mast = q * Hm ** 4 / (8 * E * Im) + Pt * Hm ** 3 / (3 * E * Im)
    k = 3 * E * Im / Hm ** 3 * 1000                            # N/m
    m_eq = cr["m_top_kg"] + cr["m_carriage_kg"] + 0.24 * ms["m_mast"] + Q / 3
    f1 = math.sqrt(k / m_eq) / (2 * math.pi)
    return {"beam_I": I, "beam_W": W, "beam_M_Nm": M, "beam_sig": sig, "beam_util": sig / bm["fy"], "beam_defl": defl,
            "beam_defl_lim": Lb / 200, "up_N_Ed": N_Ed, "up_chi": chi, "up_N_bRd": N_bRd, "up_util": N_Ed / N_bRd,
            "floor_Nmm2": floor, "R1_kN": R1, "R2_kN": R2, "Rmax_kN": Rmax, "Pmean_kN": Pmean, "Pal_kN": Pal,
            "wheel_util": Pmean / Pal, "mast_I": Im, "mast_defl_mm": d_mast, "mast_f1_Hz": f1, "settle_s": 3.0 / (2 * math.pi * f1 * 0.03) / 10}


def budget(a):
    pz = a["positioning"]
    out = {}
    for ax in ("x", "z"):
        vals = [v for _, v in pz[ax]]
        out[ax] = {"rss": math.sqrt(sum(v * v for v in vals)), "sum": sum(vals), "allow": pz["allow_%s_mm" % ax]}
    return out


def energy(a, ms, fem):
    cr = a["crane"]
    mt = (ms["m_crane"] + a["crate"]["max_gross_kg"]) * cr["k_rot"]
    Ekin = 0.5 * mt * cr["v_x"] ** 2                           # J per acceleration
    mh = cr["m_carriage_kg"] + a["crate"]["max_gross_kg"]
    Epot = mh * G * fem["lift_H"] / 2                          # mean lift in a cycle
    Eroll = cr["w_roll"] * ms["m_crane"] * G * fem["travel_L"]
    no = (2 * Ekin / cr["eta_T"] + Epot / cr["eta_H"] + Eroll / cr["eta_T"]) / 3600
    regen = no - (Ekin * cr["eta_back"] + Epot * cr["eta_back"]) / 3600
    return {"Wh_SC_no_regen": no, "Wh_SC_regen": regen, "saving": 1 - regen / no}


# ----------------------------------------------------------------------------- 6 availability -> line-side buffers
def buffers(a, flows, d2):
    cr = a["crane"]
    H = d2["programme"]["H_month"]
    out = []
    for k, f in flows.items():
        per_h = f["pcs_month"] / H
        need = per_h * cr["mttr_p95_h"]
        out.append((k, per_h, need, math.ceil(need / f["ppc_raw"])))
    return out


# ----------------------------------------------------------------------------- 7 option: one aisle (RAW + KIT) vs two aisles
def option_compare(a, tot, mv, geo_one):
    d2, pdata = F2.load_all()
    rows = F2.routing(pdata)
    g, _ = F2.loads(d2, rows)
    sol = F2.optimise(d2, g)
    counts = sol["counts"]
    res = {}
    for name, alias in (("two aisles (RAW at dock, KIT mid-hall)", {}), ("one aisle RAW+KIT at dock", {"KIT": "RAW"})):
        dd = copy.deepcopy(d2)
        dd["layout"]["dept_alias"] = alias
        A = F2.dept_areas(dd, counts)
        Fl = F2.flows(dd, rows, pdata)
        lr = F2.optimise_layout(dd, A, Fl)
        _, pos = F2.layout_cost(lr["rows"], A, Fl, dd["layout"])
        agv = F2.agv_estimate(Fl, pos, H=dd["programme"]["H_month"])
        res[name] = {"layout_cost": lr["cost"], "agv_hours": agv["agv_hours"], "agvs": agv["agvs"], "rows": lr["rows"]}
    c = a["cost"]
    hm = geo_one["rack_height_m"]

    def aisle_cost(npos):
        return c["crane_base_EUR"] + c["crane_per_m_height_EUR"] * hm + c["rack_per_position_EUR"] * npos + \
            2 * c["conveyor_station_EUR"] + c["contour_check_EUR"] + c["controls_per_aisle_EUR"] + c["install_per_aisle_EUR"]
    one = aisle_cost(geo_one["positions"]) + c["pick_station_EUR"] + res["one aisle RAW+KIT at dock"]["agvs"] * c["agv_per_unit_EUR"]
    geo_r = rack_geometry(a, tot["raw_pos"])
    geo_k = rack_geometry(a, tot["kit_pos"])
    two = aisle_cost(geo_r["positions"]) + aisle_cost(geo_k["positions"]) + c["pick_station_EUR"] + \
        res["two aisles (RAW at dock, KIT mid-hall)"]["agvs"] * c["agv_per_unit_EUR"]
    return res, {"one_aisle_EUR": one, "two_aisles_EUR": two, "geo_raw": geo_r, "geo_kit": geo_k}


# ----------------------------------------------------------------------------- run
def design(a):
    flows, d2 = part_flows(a)
    srows, tot = storage(a, flows)
    mv = moves(a, tot, d2)
    geo = rack_geometry(a, tot["raw_pos"] + tot["kit_pos"])
    ms = crane_masses(a, geo)
    fem = fem9851(a, geo)
    dr = drives(a, ms)
    st = structure(a, geo, ms)
    bu = budget(a)
    en = energy(a, ms, fem)
    bf = buffers(a, flows, d2)
    return {"flows": flows, "srows": srows, "tot": tot, "moves": mv, "geo": geo, "mass": ms, "fem": fem, "drives": dr,
            "struct": st, "budget": bu, "energy": en, "buffers": bf, "d2": d2}


def cmd_run(a, out):
    os.makedirs(out, exist_ok=True)
    R = design(a)
    tot, mv, geo, ms, fem, dr, st, bu, en = (R[k] for k in ("tot", "moves", "geo", "mass", "fem", "drives", "struct", "budget", "energy"))
    opt, cost = option_compare(a, tot, mv, geo)
    cap50 = capacity(fem, 0.5)
    util = mv["peak_h"] / cap50
    rep = ["# F3 AS/RS core design - generated report", "",
           "Generated by `asrs_design.py run` (%s) from F1 routings + F2 programme. Design values / reference estimates." % a["version"], "",
           "## 1 Crates and storage positions", "",
           "| Part | pcs/month | raw/crate | machined/crate | raw crate kg | raw crates/month | machined crates/month | RAW positions | KIT positions |",
           "|---|---|---|---|---|---|---|---|---|"]
    for r in R["srows"]:
        rep.append("| %s | %.0f | %d | %d | %.0f | %.1f | %.1f | %d | %d |" % r)
    rep += ["", "Totals: RAW %d positions (%.0f crates in/month), KIT %d positions (%.0f crates in/month); with fill factor %.2f -> **%d positions needed**." % (
        tot["raw_pos"], tot["raw_crates_m"], tot["kit_pos"], tot["kit_crates_m"], a["rack"]["fill_factor"], geo["need"]), "",
        "## 2 Throughput", "",
        "Crane moves per month: RAW %.0f (in + out), KIT %.0f (in + out + %.0f kit batches x %d visits x 2). Average **%.1f moves/h**, peak (x %.1f) **%.1f moves/h**." % (
            mv["raw_month"], mv["kit_month"], mv["batches_month"], a["stock"]["kit_crate_visits_per_batch"], mv["avg_h"], a["stock"]["peak_factor"], mv["peak_h"]), "",
        "## 3 Rack (one aisle, double-sided, single-deep)", "",
        "| Item | Value |", "|---|---|",
        "| Levels | %d (z1 %.2f m, pitch %.2f m, top level %.2f m) |" % (geo["levels"], a["rack"]["z1_m"], a["rack"]["level_pitch_m"], geo["top_level_z_m"]),
        "| Bay | %d mm (clear beam %d mm, %d crates) |" % (geo["bay_mm"], geo["clear_beam_mm"], a["rack"]["crates_per_bay"]),
        "| Bays per side | %d |" % geo["bays"],
        "| Positions | **%d** (need %d) |" % (geo["positions"], geo["need"]),
        "| Rack length x height x width | %.2f x %.2f x %.2f m |" % (geo["length_m"], geo["rack_height_m"], geo["width_m"]),
        "| Footprint incl. front zone %.0f m and rear %.1f m | %.0f m2 |" % (a["rack"]["front_zone_m"], a["rack"]["rear_zone_m"], geo["footprint_m2"]), "",
        "## 4 Stacker crane and FEM 9.851", "",
        "Mast %.2f m, mast mass %.0f kg, moving mass %.0f kg (+ load %d kg)." % (ms["H_mast_m"], ms["m_mast"], ms["m_crane"], a["crate"]["max_gross_kg"]), "",
        "Reference points P1 (%.1f m, %.2f m), P2 (%.1f m, %.2f m); fork cycle %.2f s. **Single cycle %.1f s -> %.0f moves/h; dual cycle %.1f s -> %.0f moves/h.**" % (
            fem["P1"][0], fem["P1"][1], fem["P2"][0], fem["P2"][1], fem["t_fork"], fem["SC"], fem["moves_h_SC"], fem["DC"], fem["moves_h_DC"]), "",
        "Capacity with 50 %% dual cycles: %.0f moves/h; peak demand %.1f -> **crane utilisation %.0f %%** (one crane is enough)." % (cap50, mv["peak_h"], 100 * util), "",
        "## 5 Drives", "",
        "| Axis | Force / power | Motor | Output speed | Ratio | Output torque |", "|---|---|---|---|---|---|",
        "| Travel | F %.0f N, P_peak %.2f kW, P_cont %.2f kW | **%.1f kW** | %.1f rpm (wheel D%d) | %.1f | %.0f N m |" % (
            dr["travel"]["F_N"], dr["travel"]["P_peak_kW"], dr["travel"]["P_cont_kW"], dr["travel"]["motor_kW"], dr["travel"]["n_out_rpm"],
            a["crane"]["wheel_D_mm"], dr["travel"]["ratio"], dr["travel"]["torque_out_Nm"]),
        "| Hoist | P_static %.2f kW, P_peak %.2f kW; rope %.0f N, safety %.1f | **%.1f kW** | %.1f rpm (drum D%d) | %.1f | %.0f N m |" % (
            dr["hoist"]["P_static_kW"], dr["hoist"]["P_peak_kW"], dr["hoist"]["rope_F_N"], dr["hoist"]["rope_safety"], dr["hoist"]["motor_kW"],
            dr["hoist"]["n_out_rpm"], a["crane"]["drum_D_mm"], dr["hoist"]["ratio"], dr["hoist"]["torque_out_Nm"]),
        "| Fork | F %.0f N, P %.2f kW | **%.2f kW** | %.1f rpm (pinion D%d, x%.0f telescope) | %.1f | - |" % (
            dr["fork"]["F_N"], dr["fork"]["P_kW"], dr["fork"]["motor_kW"], dr["fork"]["n_out_rpm"], a["crane"]["fork_pinion_D_mm"],
            a["crane"]["fork_mult"], dr["fork"]["ratio"]), "",
        "Hoist regenerative power when lowering: %.2f kW -> braking resistor or common DC link with regenerative unit." % dr["hoist"]["P_regen_kW"], "",
        "## 6 Structure checks (simplified - final by the rack / crane supplier)", "",
        "| Check | Result | Limit |", "|---|---|---|",
        "| Beam stress (design) | %.1f N/mm2 (%.0f %%) | 355 |" % (st["beam_sig"], 100 * st["beam_util"]),
        "| Beam deflection | %.2f mm | L/200 = %.1f mm |" % (st["beam_defl"], st["beam_defl_lim"]),
        "| Upright N_Ed / N_b,Rd | %.1f / %.1f kN (%.0f %%, chi %.3f) | 100 %% |" % (st["up_N_Ed"], st["up_N_bRd"], 100 * st["up_util"], st["up_chi"]),
        "| Floor pressure under base plate | %.2f N/mm2 | slab check by structural engineer |" % st["floor_Nmm2"],
        "| Wheel R_max / P_mean / P_allowed | %.1f / %.1f / %.1f kN (%.0f %%) | 100 %% |" % (st["Rmax_kN"], st["Pmean_kN"], st["Pal_kN"], 100 * st["wheel_util"]),
        "| Mast top deflection (travel acceleration) | %.2f mm | < 5 mm |" % st["mast_defl_mm"],
        "| Mast first natural frequency | %.2f Hz | >= 1.5-2 Hz |" % st["mast_f1_Hz"], "",
        "## 7 Positioning budget", "",
        "x: RSS %.1f mm, worst-case sum %.1f mm, allowance +-%d mm; z: RSS %.1f mm, sum %.1f mm, allowance +-%d mm." % (
            bu["x"]["rss"], bu["x"]["sum"], bu["x"]["allow"], bu["z"]["rss"], bu["z"]["sum"], bu["z"]["allow"]), "",
        "## 8 Energy", "",
        "Per single cycle: %.1f Wh without regeneration, %.1f Wh with regeneration (%.0f %% saving)." % (
            en["Wh_SC_no_regen"], en["Wh_SC_regen"], 100 * en["saving"]), "",
        "## 9 Availability -> line-side buffers (crane MTTR p95 %.0f h)" % a["crane"]["mttr_p95_h"], "",
        "| Part | pcs/h | pcs for %.0f h | crates line-side |" % a["crane"]["mttr_p95_h"], "|---|---|---|---|"]
    for k, ph, need, cr_ in sorted(R["buffers"], key=lambda x: -x[1])[:10]:
        rep.append("| %s | %.1f | %.0f | %d |" % (k, ph, need, cr_))
    rep += ["", "## 10 Option: one aisle (RAW + KIT) or two aisles", "",
            "| Option | Layout cost (unit-load m/month) | AGV hours | AGVs | Investment estimate EUR |", "|---|---|---|---|---|"]
    names = list(opt)
    rep.append("| %s | %.0f | %.0f | %d | %.0f |" % (names[0], opt[names[0]]["layout_cost"], opt[names[0]]["agv_hours"], opt[names[0]]["agvs"], cost["two_aisles_EUR"]))
    rep.append("| %s | %.0f | %.0f | %d | %.0f |" % (names[1], opt[names[1]]["layout_cost"], opt[names[1]]["agv_hours"], opt[names[1]]["agvs"], cost["one_aisle_EUR"]))
    choice = "one aisle" if cost["one_aisle_EUR"] <= cost["two_aisles_EUR"] else "two aisles"
    rep += ["", "Two-aisle geometry: RAW %d bays / %d positions, KIT %d bays / %d positions. **Decision: %s.**" % (
        cost["geo_raw"]["bays"], cost["geo_raw"]["positions"], cost["geo_kit"]["bays"], cost["geo_kit"]["positions"], choice), "",
        "One-aisle layout rows: " + " | ".join(opt[names[1]]["rows"][0]) + "  //  " + " | ".join(opt[names[1]]["rows"][1])]
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(rep) + "\n")
    # design_result.json for the 3D / electrical / PLC programs
    res = {"version": a["version"], "crate": a["crate"], "rack": {k: geo[k] for k in geo}, "rack_input": a["rack"],
           "crane": {"mass": ms, "input": a["crane"], "drives": dr, "fem": {k: fem[k] for k in ("SC", "DC", "t_fork", "travel_L", "lift_H")}},
           "struct": st, "zones": {"RAW_positions": tot["raw_pos"], "KIT_positions": tot["kit_pos"]},
           "moves": mv, "decision": choice, "io": {"infeed_conveyor": 1, "outfeed_conveyor": 1, "pick_station": 1, "contour_check": 1,
                                                  "transfer_x_m": 0.0, "conveyor_speed_m_s": 0.2, "conveyor_top_m": 0.70}}
    with open(os.path.join(out, "design_result.json"), "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1)
    write_bom(a, R, os.path.join(out, "bom_mech.csv"))
    print("\n".join(rep))
    return 0


def write_bom(a, R, path):
    geo, dr, ms = R["geo"], R["drives"], R["mass"]
    up_n = 2 * (geo["bays"] + 1) * 2               # 2 sides, front + rear upright per frame -> frames x 2
    rows = [["item", "description", "qty", "unit", "make_buy", "note"],
            ["A1", "Upright frame %.2f m (2 uprights 100x? perforated, bracing), S355 galv." % geo["rack_height_m"], 2 * (geo["bays"] + 1), "pc", "B", "rack supplier, EN 15512 tested section"],
            ["A2", "Pallet beam pair box 120x50x2.0, clear %d mm, with safety locks" % geo["clear_beam_mm"], 2 * geo["bays"] * geo["levels"], "pair", "B", "rack supplier"],
            ["A3", "Crate support rails / guides (centring) 1200 mm", 2 * geo["positions"] // 2, "pc", "B", "one pair per position"],
            ["A4", "Base plates + anchors M12 (chemical)", up_n, "set", "B", "floor slab check"],
            ["A5", "Top tie beams + top guide rail 100x20 S355", 1, "set", "M/B", "length %.1f m" % (geo["length_m"] + 3)],
            ["A6", "Bottom rail flat bar 50x30 S355 on grout + clamps", 1, "set", "B", "length %.1f m" % (geo["length_m"] + 4.5)],
            ["A7", "End stops with buffers (polyurethane) both ends", 2, "pc", "B", "EN 528: energy absorption"],
            ["B1", "Crane bottom frame welded S355 (wheel boxes, drive console)", 1, "pc", "M", "%.0f kg" % a["crane"]["m_bottom_kg"]],
            ["B2", "Mast box %dx%dx%d S355, height %.2f m" % (a["crane"]["mast"]["h"], a["crane"]["mast"]["b"], a["crane"]["mast"]["t"], ms["H_mast_m"]), 1, "pc", "M", "%.0f kg" % ms["m_mast"]],
            ["B3", "Top frame with guide rollers (polyurethane, 4x)", 1, "pc", "M", ""],
            ["B4", "Lifting carriage with guide rollers, slack-rope and overload device", 1, "pc", "M", "%.0f kg incl. fork" % a["crane"]["m_carriage_kg"]],
            ["B5", "Travel wheel D%d (drive) with bearing housing" % a["crane"]["wheel_D_mm"], 1, "pc", "M/B", "GGG70 or 42CrMo4 tread hardened"],
            ["B6", "Travel wheel D%d (idler)" % a["crane"]["wheel_D_mm"], 1, "pc", "M/B", ""],
            ["B7", "Lateral guide rollers bottom (4x)", 4, "pc", "B", ""],
            ["C1", "Travel geared motor %.1f kW 4-pole, brake, encoder, i = %.1f, out %.0f N m" % (dr["travel"]["motor_kW"], dr["travel"]["ratio"], dr["travel"]["torque_out_Nm"]), 1, "pc", "B", "helical-bevel, SEW/Nord/Lenze class"],
            ["C2", "Hoist geared motor %.1f kW 4-pole, brake (2x for EN 528 if required), encoder, i = %.1f" % (dr["hoist"]["motor_kW"], dr["hoist"]["ratio"]), 1, "pc", "B", "hoist duty, brake torque >= 1.6 x load torque"],
            ["C3", "Rope drum D%d grooved + wire rope D%d (F_min %d kN), safety %.1f" % (a["crane"]["drum_D_mm"], a["crane"]["rope_dia_mm"], a["crane"]["rope_Fmin_kN"], dr["hoist"]["rope_safety"]), 1, "set", "M/B", "rope class per FEM 9.661 - check"],
            ["C4", "Telescopic fork 2-stage, stroke +-%.2f m, %d kg, geared motor %.2f kW, i = %.1f" % (a["crane"]["fork_stroke_m"], a["crate"]["max_gross_kg"], dr["fork"]["motor_kW"], dr["fork"]["ratio"]), 1, "set", "B/M", "see docs/39"],
            ["D1", "Laser distance meter travel axis (+-2 mm, 0-%.0f m, PROFINET/SSI) + reflector" % (geo["length_m"] + 5), 1, "set", "B", ""],
            ["D2", "Barcode position system hoist (+-1 mm) + code tape %.1f m" % (geo["rack_height_m"] + 1), 1, "set", "B", ""],
            ["D3", "Data light barrier (optical data transmission) crane <-> ground", 1, "pair", "B", ""],
            ["D4", "Power rail (enclosed conductor rail) 5-pole, %.0f m + current collector" % (geo["length_m"] + 4), 1, "set", "B", ""],
            ["E1", "Infeed chain conveyor 1200 mm with contour / weight / ID check station", 1, "set", "B", "item F4 details"],
            ["E2", "Outfeed chain conveyor to AGV handover", 1, "set", "B", "item F4"],
            ["E3", "Pick (kitting) station with crate presentation + pick-to-light", 1, "set", "B", "item F4 / F6"],
            ["E4", "Aisle access door with safety interlock, maintenance platform on crane", 1, "set", "B", "EN 528"],
            ["E5", "Perimeter fence + light curtains at I/O (ISO 13855)", 1, "set", "B", "item F8"]]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        csv.writer(fh).writerows(rows)


# ----------------------------------------------------------------------------- self-test
def selftest(a):
    ok = []

    def check(n, c):
        ok.append(bool(c))
        print("  [%s] %s" % ("PASS" if c else "FAIL", n))

    check("trapezoid: long move d/v + v/a (30 m: %.2f s)" % trap(30, 3, 0.5), abs(trap(30, 3, 0.5) - (10 + 6)) < 1e-12)
    check("trapezoid: short move 2 sqrt(d/a) (4 m: %.3f s)" % trap(4, 3, 0.5), abs(trap(4, 3, 0.5) - 2 * math.sqrt(8)) < 1e-12)
    # docs/31 reference case: 392 slots, 7 levels, 14 bays x 2 crates (bay 1925)
    aa = copy.deepcopy(a)
    aa["rack"]["clear_height_m"] = 9.5 + 0.3
    aa["rack"]["top_clearance_m"] = 1.0
    geo = rack_geometry(aa, 392 * aa["rack"]["fill_factor"])
    check("docs/31 geometry reproduced: bay 1925 mm, 7 levels, 14 bays, 392 positions (%d/%d/%d/%d)" % (
        geo["bay_mm"], geo["levels"], geo["bays"], geo["positions"]),
        geo["bay_mm"] == 1925 and geo["levels"] == 7 and geo["bays"] == 14 and geo["positions"] == 392)
    # docs/31 drive numbers with its masses (4200 kg moving, 300 kg load): travel P_peak 9.35 kW -> 7.5; hoist 10.39 -> 11
    ms = {"m_crane": 4200.0, "H_mast_m": 9.3, "m_mast": 1000.0}
    dr = drives(a, ms)
    check("docs/31 travel P_peak 9.35 kW reproduced (%.2f) -> motor 7.5 kW" % dr["travel"]["P_peak_kW"],
          abs(dr["travel"]["P_peak_kW"] - 9.35) < 0.05 and dr["travel"]["motor_kW"] == 7.5)
    check("docs/31 hoist P_static 10.39 kW reproduced (%.2f) -> motor 11 kW" % dr["hoist"]["P_static_kW"],
          abs(dr["hoist"]["P_static_kW"] - 10.39) < 0.01 and dr["hoist"]["motor_kW"] == 11.0)
    st = structure(a, {"clear_beam_mm": 1825, "levels": 7}, ms)
    check("docs/31 beam: I 1.217e6 mm4, stress 48.3 N/mm2, deflection 1.04 mm (%.3e / %.1f / %.2f)" % (st["beam_I"], st["beam_sig"], st["beam_defl"]),
          abs(st["beam_I"] - 1.217e6) / 1.217e6 < 0.002 and abs(st["beam_sig"] - 48.3) < 0.3 and abs(st["beam_defl"] - 1.04) < 0.02)
    check("docs/31 upright chi 0.864, N_b,Rd 159.4 kN (%.3f / %.1f)" % (st["up_chi"], st["up_N_bRd"]),
          abs(st["up_chi"] - 0.864) < 0.002 and abs(st["up_N_bRd"] - 159.4) < 0.5)
    # capacity function
    fem = {"SC": 36.0, "DC": 60.0}
    check("capacity p=0 -> 3600/SC, p=1 -> 7200/DC", abs(capacity(fem, 0) - 100) < 1e-9 and abs(capacity(fem, 1) - 120) < 1e-9)
    # full design plausibility
    R = design(a)
    check("positions >= need and need >= RAW + KIT", R["geo"]["positions"] >= R["geo"]["need"] >= R["tot"]["raw_pos"] + R["tot"]["kit_pos"])
    check("every raw crate within max gross %d kg" % a["crate"]["max_gross_kg"], all(f["crate_kg_raw"] <= a["crate"]["max_gross_kg"] for f in R["flows"].values()))
    check("crane utilisation at peak < 60 %", R["moves"]["peak_h"] / capacity(R["fem"], 0.5) < 0.6)
    check("structure utilisations < 100 %% (beam %.0f, upright %.0f, wheel %.0f)" % (100 * R["struct"]["beam_util"], 100 * R["struct"]["up_util"], 100 * R["struct"]["wheel_util"]),
          max(R["struct"]["beam_util"], R["struct"]["up_util"], R["struct"]["wheel_util"]) < 1)
    check("mast f1 >= 1.8 Hz (%.2f)" % R["struct"]["mast_f1_Hz"], R["struct"]["mast_f1_Hz"] >= 1.8)
    check("mast top deflection < 5 mm (%.2f)" % R["struct"]["mast_defl_mm"], R["struct"]["mast_defl_mm"] < 5.0)
    check("positioning RSS inside allowance", R["budget"]["x"]["rss"] < R["budget"]["x"]["allow"] and R["budget"]["z"]["rss"] < R["budget"]["z"]["allow"])
    check("rope safety >= 5 (%.1f)" % R["drives"]["hoist"]["rope_safety"], R["drives"]["hoist"]["rope_safety"] >= 5)
    print("SELFTEST %s (%d/%d)" % ("PASS" if all(ok) else "FAIL", sum(ok), len(ok)))
    return 0 if all(ok) else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=DATA)
    sp = ap.add_subparsers(dest="cmd")
    sp.add_parser("selftest")
    r = sp.add_parser("run"); r.add_argument("--out", default=os.path.join(HERE, "out"))
    x = ap.parse_args(argv)
    a = load(x.data)
    if x.cmd == "selftest":
        return selftest(a)
    if x.cmd == "run":
        return cmd_run(a, x.out)
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
