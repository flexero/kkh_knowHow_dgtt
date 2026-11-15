#!/usr/bin/env python3
"""Final thesis item F4.4 - the assembly carrier line (assembly -> test -> paint -> pack) and its tank / motor feed.

  A  carrier       frame bending over the transfer span, product stability (tipping, sliding) at start, E-stop, bumper
  B  ergonomics    working height per task and operator (P5 female .. P95 male) -> range of the spur lift table
  C  conveyor      twin-strand accumulation chain: pull with moving + accumulated carriers -> drive sections, motors;
                   stopper load (line pressure + impact)
  D  transfers     lift-transfer cycle, spur and main-line occupation
  E  closed loop   discrete-event simulation of N carriers through LOAD-ASSY-TEST-PAINT-PACK-UNLOAD -> throughput(N),
                   N_min for the design rate; compared with the Little estimate of F4.1
  F  feed          tank racks + motor crates -> AGV moves (input F5), tank buffer, tank lifter
  G  balancers     NIOSH for the line-fed heavy parts, lifts per hour, balancers per station pair
  H  modules, cost, test-bench docking list

Python 3 standard library only, offline. Data: asm_data.json + F2 machine loads (../02_fms/out/machines.csv).
Outputs (out/assembly/): assembly_report.md, des_throughput.csv, assembly_specs.json, modules_assembly.csv.
Guide: Doctor paper/61 chapters 36-48.

Commands
  python asm_line.py selftest
  python asm_line.py run

Formulas
  A  beam over the transfer span: two loads P at +-x_f -> M = P a, delta = P a (3 L^2 - 4 a^2) / (24 E I)  (a = (L - x_f)/2)
     tipping:  a_tip = g (feet_x / 2) / h_cg ; sliding: a_slide = mu g ; bumper: E = m v^2 / 2, a = 2 E / (m s)
  B  target work height h_w = elbow + offset (light work -100 mm) ; carrier top = h_w - task height
  C  per strand: F = q L g f_s (top + return) + 1/2 [n_mov m g f_r + n_acc m g mu_acc] + 1/2 m_tot a
     section length limit: F(L) <= F_allow ; stopper: F = n_queue m g mu_acc ; E = m v^2 / 2
  D  t_transfer = t_lift + l_spur / v + t_lower ; main-line occupation = rate x 2 x t_transfer
  E  closed network (FCFS, c servers per group, lognormal times, fixed transport) -> TH(N)
  F  racks = units / tanks_per_rack (x 2 incl. empties) ; motor crates = units / 8
  G  RWL = 23 (25/H)(1 - 0.003|V-75|)(0.82 + 4.5/D) FM CM ; LI = m / RWL
"""

import argparse
import csv
import heapq
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def load(path=os.path.join(HERE, "asm_data.json")):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def f2_times(d):
    loads = {}
    with open(os.path.join(HERE, "..", "02_fms", "out", "machines.csv"), encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            loads[r["type"]] = float(r["load_h"])
    units = sum(p["units_month"] for p in d["products"].values())
    t = {k: loads[k] * 60.0 / units for k in ("ASSY", "TEST", "PAINT", "PACK")}
    t["LOAD"] = d["times"]["load_on_min"]
    t["UNLOAD"] = d["times"]["unload_min"]
    return t, units


# ============================================================================= A carrier
def carrier(d):
    g = d["g"]
    C = d["carrier"]
    out = {}
    E = 210000.0
    for k, p in d["products"].items():
        m_tot = C["mass_kg"] + C["adapter_kg"]["VC20" if k == "VC20" else "RB"] + p["mass_kg"]
        P = p["mass_kg"] * g / 4                         # per foot; one beam carries 2 feet (one side)
        L = C["support_span_mm"]
        a = (L - p["feet_x_mm"]) / 2
        if a < 0:
            a = 0.0
        Pb = 2 * P / 2 * 1.0                              # each beam: 2 loads of P (feet on that side)
        M = P * a
        dl = P * a * (3 * L ** 2 - 4 * a ** 2) / (24 * E * C["beam"]["I_mm4"]) if a > 0 else 0.0
        a_tip = g * (p["feet_x_mm"] / 2) / p["cg_mm"]
        a_slide = C["pad_mu"] * g
        v = d["conveyor"]["v_m_s"]
        Eb = 0.5 * m_tot * v ** 2
        a_bump = 2 * Eb / (m_tot * C["bumper_stroke_mm"] / 1000)
        a_lat_tip = g * (p["feet_y_mm"] / 2) / p["cg_mm"]
        out[k] = {"m_tot": m_tot, "M": M, "sigma": M / C["beam"]["W_mm3"], "delta": dl, "delta_lim": L / C["defl_limit"],
                  "a_tip": a_tip, "a_lat_tip": a_lat_tip, "a_slide": a_slide, "E_bump": Eb, "a_bump": a_bump,
                  "a_estop": d["conveyor"]["estop_decel"], "a_start": 0.3,
                  "ok": M / C["beam"]["W_mm3"] <= C["sigma_allow_MPa"] and dl <= L / C["defl_limit"]
                  and min(a_tip, a_slide) > max(a_bump, d["conveyor"]["estop_decel"])}
    return out


# ============================================================================= B ergonomics
def ergonomics(d):
    e = d["ergo"]
    rows = []
    need = []
    for k, p in d["products"].items():
        for task, h in p["tasks_mm"]:
            for who, el in e["elbow_mm"].items():
                hw = el + e["offset_light_mm"]
                ct = hw - h
                rows.append([k, task, h, who, hw, ct])
                need.append(ct)
    lo, hi = e["lift_min_mm"], e["lift_max_mm"]
    covered = sum(1 for r in rows if lo <= r[5] <= hi)
    residual = [r for r in rows if not (lo <= r[5] <= hi)]
    for r in residual:
        r.append(lo - r[5] if r[5] < lo else r[5] - hi)
    return {"rows": rows, "need_min": min(need), "need_max": max(need), "lo": lo, "hi": hi, "covered": covered, "n": len(rows), "residual": residual}


# ============================================================================= C conveyor
def chain(d, n_carriers):
    g = d["g"]
    c = d["conveyor"]
    m = d["carrier"]["mass_kg"] + 12 + max(p["mass_kg"] for p in d["products"].values())
    pitch = d["carrier"]["pitch_m"]

    def pull(L, n_acc, n_mov):
        F = c["chain_kg_m"] * L * g * c["f_chain_slide"] * 2                        # top + return strand sliding
        F += 0.5 * (n_mov * m * g * c["f_roll"] + n_acc * m * g * c["mu_acc"])
        F += 0.5 * (n_mov * m + c["chain_kg_m"] * 2 * L * 2) * 0.3                   # start acceleration
        return F
    # worst case for a section: full of carriers, all accumulated except one moving
    Lmax = 0.0
    for L10 in range(10, 2000):
        L = L10 / 10.0
        n = int(L / pitch)
        if pull(L, max(0, n - 1), 1) > c["F_allow_N"]:
            break
        Lmax = L
    sec = c["section_m"]
    n_sec = math.ceil(c["loop_m"] / sec)
    n_in = min(int(sec / pitch), n_carriers)
    F_sec = pull(sec, max(0, n_in - 1), 1)
    P = 2 * F_sec * c["v_m_s"] / c["eta"]
    motors = [0.18, 0.25, 0.37, 0.55, 0.75]
    Pm = next(x for x in motors if x * 1000 >= 1.4 * P)
    return {"m": m, "L_max_full": Lmax, "n_sec": n_sec, "sec": sec, "F_sec": F_sec, "P": P, "P_motor": Pm, "pull": pull}


def stopper(d, q_places):
    g = d["g"]
    m = d["carrier"]["mass_kg"] + 12 + max(p["mass_kg"] for p in d["products"].values())
    F = q_places * m * g * d["conveyor"]["mu_acc"]
    E = 0.5 * m * d["conveyor"]["v_m_s"] ** 2
    return {"F": F, "E": E, "ok": F <= d["stopper"]["F_static_N"] and E <= d["stopper"]["E_max_J"]}


# ============================================================================= D transfers
def transfers(d, lam, groups):
    T = d["transfer"]
    t = T["lift_s"] + T["spur_m"] / T["v_m_s"] + T["lower_s"]
    occ = {g: lam * 2 * t / 3600 for g in groups}
    per_spur = {g: lam / c * 2 * t / 3600 for g, c in groups.items()}
    return {"t": t, "main_occ": occ, "spur_occ": per_spur}


# ============================================================================= E closed-loop DES
ORDER = ["LOAD", "ASSY", "TEST", "PAINT", "PACK", "UNLOAD"]


def des_loop(d, t_mean, N, hours=None, seed=None):
    T = d["times"]
    rng = random.Random(T["seed"] if seed is None else seed)
    cv = T["cv"]
    s2 = math.log(1 + cv * cv)
    v = d["conveyor"]["v_m_s"]
    seg = [T["seg_m"]["%s-%s" % (ORDER[i], ORDER[(i + 1) % 6])] / v / 60.0 for i in range(6)]
    tr = (d["transfer"]["lift_s"] + d["transfer"]["spur_m"] / d["transfer"]["v_m_s"] + d["transfer"]["lower_s"]) / 60.0
    c = d["stations"]
    H = (T["des_hours"] if hours is None else hours) * 60.0
    W = T["warmup_h"] * 60.0
    busy = {k: 0 for k in ORDER}
    queue = {k: [] for k in ORDER}
    ev = []
    done = 0
    qmax = {k: 0 for k in ORDER}
    ctr = 0

    def service(k):
        m = t_mean[k]
        return rng.lognormvariate(math.log(m) - s2 / 2, math.sqrt(s2)) + (2 * tr if k in ("ASSY", "TEST", "PAINT", "PACK") else 0.0)

    def arrive(t, k, cid):
        nonlocal ctr
        if busy[k] < c[k]:
            busy[k] += 1
            ctr += 1
            heapq.heappush(ev, (t + service(k), ctr, "end", k, cid))
        else:
            queue[k].append(cid)
            qmax[k] = max(qmax[k], len(queue[k])) if t > W else qmax[k]
    for i in range(N):
        ctr += 1
        heapq.heappush(ev, (i * 0.5, ctr, "arr", "LOAD", i))
    while ev:
        t, _, typ, k, cid = heapq.heappop(ev)
        if t > H + W:
            break
        if typ == "arr":
            arrive(t, k, cid)
        else:
            busy[k] -= 1
            if k == "UNLOAD" and t > W:
                done += 1
            if queue[k]:
                nxt = queue[k].pop(0)
                busy[k] += 1
                ctr += 1
                heapq.heappush(ev, (t + service(k), ctr, "end", k, nxt))
            i = ORDER.index(k)
            ctr += 1
            heapq.heappush(ev, (t + seg[i], ctr, "arr", ORDER[(i + 1) % 6], cid))
    return {"N": N, "TH_h": done / (H / 60.0), "qmax": qmax}


def seg_capacity(d):
    """Carriers that can wait on the main-line segment IN FRONT of each group (accumulation on the line)."""
    pitch = d["carrier"]["pitch_m"]
    cap = {}
    for i, k in enumerate(ORDER):
        prev = ORDER[i - 1]
        cap[k] = int(d["times"]["seg_m"]["%s-%s" % (prev, k)] // pitch)
    return cap


def des_curve(d, t_mean, lam_design, Ns=range(8, 31, 2)):
    rows = [des_loop(d, t_mean, n) for n in Ns]
    nmin = next((r["N"] for r in rows if r["TH_h"] >= lam_design), None)
    return rows, nmin


# ============================================================================= F feed, G balancers
def feed(d, units):
    F = d["feed"]
    vc = d["products"]["VC20"]["units_month"]
    rb = sum(p["units_month"] for k, p in d["products"].items() if k.startswith("RB"))
    rack_mass = F["tanks_per_rack"] * F["tank_kg"] + F["rack_kg"]
    racks = vc / F["tanks_per_rack"]
    frames = rb / F["rb_frames_per_rack"]
    motor_crates = vc / F["motors_per_crate"] + rb / F["motors_per_crate"]
    agv = 2 * (racks + frames) + 2 * motor_crates                 # full + empty back
    H = 330.0
    peak = vc / H * d["peak_factor"]
    buf_tanks = math.ceil(peak * F["buffer_h"])
    buf_racks = math.ceil(buf_tanks / F["tanks_per_rack"]) + 1
    return {"rack_mass": rack_mass, "rack_ok": rack_mass <= F["agv_payload_kg"], "racks_m": racks, "frames_m": frames, "motor_crates_m": motor_crates,
            "agv_moves_m": agv, "agv_moves_h_peak": agv / H * d["peak_factor"], "buf_tanks": buf_tanks, "buf_racks": buf_racks,
            "racks_total": buf_racks + 4}


def balancers(d, lam):
    B = d["balancer"]
    N = B["niosh"]
    RWL = 23 * (25 / N["H"]) * (1 - 0.003 * abs(N["V"] - 75)) * (0.82 + 4.5 / N["D"]) * N["FM"] * N["CM"]
    rows = []
    lifts_h = 0.0
    tot = sum(p["units_month"] for p in d["products"].values())
    for k, parts in B["lines"].items():
        share = d["products"][k]["units_month"] / tot
        for name, m in parts:
            LI = m / RWL
            need = LI > 1.0
            rows.append([k, name, m, round(LI, 2), "balancer" if need else "by hand"])
            if need:
                lifts_h += lam * share
    n_bal = math.ceil(d["stations"]["ASSY"] / B["stations_per_balancer"])
    util = lifts_h * B["lift_s"] / 3600 / n_bal
    return {"RWL": RWL, "rows": rows, "lifts_h": lifts_h, "n_bal": n_bal, "util": util}


# ============================================================================= build / report
def build(d, des=True):
    t, units = f2_times(d)
    lam_avg = units / 330.0
    lam = lam_avg * d["peak_factor"]
    car = carrier(d)
    erg = ergonomics(d)
    sys.path.insert(0, HERE)
    import conv_system as CS
    asy41 = CS.assembly(CS.load(), CS.inputs())
    qp = {g["type"]: g["queue_places"] for g in asy41["groups"]}
    ch = chain(d, asy41["carriers"])
    st = stopper(d, max(qp.values()))
    tf = transfers(d, lam, {k: d["stations"][k] for k in ("ASSY", "TEST", "PAINT", "PACK")})
    curve, nmin = des_curve(d, t, lam) if des else ([], None)
    fd = feed(d, units)
    bl = balancers(d, lam)
    return {"t": t, "units": units, "lam": lam, "lam_avg": lam_avg, "car": car, "erg": erg, "asy41": asy41, "qp": qp, "ch": ch, "st": st,
            "tf": tf, "curve": curve, "nmin": nmin, "fd": fd, "bl": bl}


def modules(d, R):
    C = d["cost_EUR"]
    n_car = max(R["nmin"] or 0, R["asy41"]["carriers"])
    rows = [["carrier", n_car, C["carrier"]], ["adapter_set (VC20 + RB)", n_car, C["adapter_set"]],
            ["loop_per_m", d["conveyor"]["loop_m"], C["loop_per_m"]], ["section_drive", R["ch"]["n_sec"], C["section_drive"]],
            ["corner_unit", d["conveyor"]["corner_units"], C["corner_unit"]],
            ["spur_unit", sum(d["stations"][k] for k in ("ASSY", "TEST", "PAINT", "PACK")), C["spur_unit"]],
            ["lift_table (ASSY spurs)", d["stations"]["ASSY"], C["lift_table"]], ["lift_pit 250 mm (ASSY spurs)", d["stations"]["ASSY"], C["lift_pit"]],
            ["lift_locate (all stations)", sum(d["stations"].values()), C["lift_locate"]],
            ["test_dock", d["stations"]["TEST"], C["test_dock"]], ["load_station", 1, C["load_station"]], ["tank_lifter", 1, C["tank_lifter"]],
            ["tank_rack", R["fd"]["racks_total"], C["tank_rack"]], ["balancer", R["bl"]["n_bal"], C["balancer"]],
            ["stopper", sum(d["stations"].values()) + 4, C["stopper"]],
            ["gate_section (personnel access + escape, interlocked)", d["gates"]["n"], C["gate_section"]]]
    for r in rows:
        r.append(r[1] * r[2])
    return rows, sum(r[3] for r in rows), n_car


def report(d, R):
    L = ["# F4.4 - assembly carrier line (asm_line.py)", "", "All values: DESIGN / REFERENCE ESTIMATE; DES = SIMULATED.", "",
         "Station times per unit (F2 loads / %d units): " % R["units"] + ", ".join("%s %.1f min" % (k, v) for k, v in R["t"].items()) +
         "; rate %.1f /h average, %.1f /h design." % (R["lam_avg"], R["lam"]), "",
         "## A Carrier and product stability", "",
         "| product | m on carrier kg | beam M N mm | sigma MPa | delta mm (lim %.1f) | a_tip long. | a_tip lat. | a_slide | bumper E J / a m/s2 | E-stop | ok |" % (
             d["carrier"]["support_span_mm"] / d["carrier"]["defl_limit"]), "|---|---|---|---|---|---|---|---|---|---|---|"]
    for k, r in R["car"].items():
        L.append("| %s | %.0f | %.0f | %.1f | %.2f | %.1f | %.1f | %.1f | %.1f / %.1f | %.1f | %s |" % (
            k, r["m_tot"], r["M"], r["sigma"], r["delta"], r["a_tip"], r["a_lat_tip"], r["a_slide"], r["E_bump"], r["a_bump"], r["a_estop"], "yes" if r["ok"] else "NO"))
    e = R["erg"]
    L += ["", "## B Working height -> lift table", "",
          "Required carrier top over all tasks and operators (P5 female .. P95 male, light work = elbow - 100): %.0f .. %.0f mm; lift table %d .. %d mm covers %d of %d cases." % (
              e["need_min"], e["need_max"], e["lo"], e["hi"], e["covered"], e["n"]), "", "| product | task | task height | operator | work height | carrier top needed |", "|---|---|---|---|---|---|"]
    for r in e["rows"]:
        L.append("| %s | %s | %d | %s | %d | %d |" % tuple(r[:6]))
    L += ["", "Not covered (%d): " % len(e["residual"]) + "; ".join("%s %s %s: %d mm outside" % (r[0], r[1].split(" ")[0], r[3], r[6]) for r in e["residual"]), ""]
    ch, st, tf = R["ch"], R["st"], R["tf"]
    L += ["## C Accumulation chain", "",
          "Carrier + adapter + heaviest product = %.0f kg. A section FULL of accumulated carriers may be at most %.1f m long (F_allow %d N per strand)." % (ch["m"], ch["L_max_full"], d["conveyor"]["F_allow_N"]),
          "Design: %d sections of %.0f m; with the %d carriers of the loop the worst section pull is %.0f N per strand -> drive %.0f W -> **%.2f kW** per section." % (
              ch["n_sec"], ch["sec"], R["asy41"]["carriers"], ch["F_sec"], ch["P"], ch["P_motor"]),
          "Stopper in front of the largest queue (%d places): line pressure %.0f N, impact %.1f J (stopper class %d N / %.0f J) -> %s." % (
              max(R["qp"].values()), st["F"], st["E"], d["stopper"]["F_static_N"], d["stopper"]["E_max_J"], "OK" if st["ok"] else "NOT OK"), "",
          "## D Lift-transfers", "",
          "Transfer cycle %.0f s (lift %.0f + spur %.0f m at %.1f m/s + lower %.0f). Main-line occupation at a group: %s. Per spur: %s." % (
              tf["t"], d["transfer"]["lift_s"], d["transfer"]["spur_m"], d["transfer"]["v_m_s"], d["transfer"]["lower_s"],
              ", ".join("%s %.1f %%" % (k, 100 * v) for k, v in tf["main_occ"].items()), ", ".join("%s %.1f %%" % (k, 100 * v) for k, v in tf["spur_occ"].items())), "",
          "## E Closed loop - throughput versus number of carriers (simulated, %d h each)" % d["times"]["des_hours"], "",
          "| carriers N | throughput /h | max queue ASSY | TEST | PAINT | PACK |", "|---|---|---|---|---|---|"]
    for r in R["curve"]:
        L.append("| %d | %.2f | %d | %d | %d | %d |" % (r["N"], r["TH_h"], r["qmax"]["ASSY"], r["qmax"]["TEST"], r["qmax"]["PAINT"], r["qmax"]["PACK"]))
    cap = seg_capacity(d)
    r21 = [r for r in R["curve"] if r["N"] == max(R["nmin"] or 0, R["asy41"]["carriers"]) or r["N"] == max(R["nmin"] or 0, R["asy41"]["carriers"]) + 1]
    L += ["", "N_min for the design rate %.1f /h: **%s**; F4.1 Little estimate: %d (incl. 10 %% spare). Decision: **%d carriers** = DES minimum + spare for maintenance and product changeover." % (
        R["lam"], R["nmin"], R["asy41"]["carriers"], max(R["nmin"] or 0, R["asy41"]["carriers"])),
          "Queues wait ON the main line in front of their group (all carriers follow the same sequence, so a queue blocks nobody who could pass). Segment capacity in front of each group: " +
          ", ".join("%s %d" % (k, cap[k]) for k in ("ASSY", "TEST", "PAINT", "PACK")) + " carriers; max simulated queue at %d carriers: " % (r21[0]["N"] if r21 else 0) +
          ", ".join("%s %d" % (k, r21[0]["qmax"][k]) for k in ("ASSY", "TEST", "PAINT", "PACK")) + ".", ""]
    fd, bl = R["fd"], R["bl"]
    L += ["## F Tank / motor feed", "",
          "Tank rack %d x %d kg + %d kg = %.0f kg (AGV payload %d kg -> %s). Per month: %.0f tank racks, %.0f RB frame racks, %.0f motor crates -> **%.0f AGV moves/month** (full + empty), %.1f /h at peak -> input F5." % (
              d["feed"]["tanks_per_rack"], d["feed"]["tank_kg"], d["feed"]["rack_kg"], fd["rack_mass"], d["feed"]["agv_payload_kg"], "OK" if fd["rack_ok"] else "NO",
              fd["racks_m"], fd["frames_m"], fd["motor_crates_m"], fd["agv_moves_m"], fd["agv_moves_h_peak"]),
          "Tank buffer at the load station for %.0f h: %d tanks = %d rack places (incl. the rack in use); %d racks in circulation." % (d["feed"]["buffer_h"], fd["buf_tanks"], fd["buf_racks"], fd["racks_total"]), "",
          "## G Line-fed heavy parts at assembly", "",
          "NIOSH at the assembly fixture (H %d, V %d, D %d, FM %.2f): RWL = %.1f kg." % (d["balancer"]["niosh"]["H"], d["balancer"]["niosh"]["V"], d["balancer"]["niosh"]["D"], d["balancer"]["niosh"]["FM"], bl["RWL"]), "",
          "| product | part | kg | LI | handling |", "|---|---|---|---|---|"]
    for r in bl["rows"]:
        L.append("| %s | %s | %.1f | %.2f | %s |" % tuple(r))
    L += ["", "Balancer lifts %.1f /h at peak; %d balancers (one per %d stations) -> utilisation %.1f %%." % (bl["lifts_h"], bl["n_bal"], d["balancer"]["stations_per_balancer"], 100 * bl["util"]), ""]
    mods, cost, n_car = modules(d, R)
    L += ["## H Modules and cost", "", "| module | qty | EUR each | EUR |", "|---|---|---|---|"] + ["| %s | %s | %s | %.0f |" % tuple(r) for r in mods]
    L += ["", "Total **%.0f EUR** (F4.1 estimate for the assembly line: %d EUR)." % (cost, 110000 + 133000 + 32000 + 13650 + 12000), "",
          "Test-bench docking: " + "; ".join(d["test_dock"]) + ".", ""]
    return "\n".join(L)


def cmd_run(d):
    out = os.path.join(HERE, "out", "assembly")
    os.makedirs(out, exist_ok=True)
    R = build(d)
    with open(os.path.join(out, "assembly_report.md"), "w", encoding="utf-8") as fh:
        fh.write(report(d, R))
    with open(os.path.join(out, "des_throughput.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["N", "TH_h"] + ["qmax_" + k for k in ORDER])
        for r in R["curve"]:
            w.writerow([r["N"], round(r["TH_h"], 3)] + [r["qmax"][k] for k in ORDER])
    mods, cost, n_car = modules(d, R)
    with open(os.path.join(out, "modules_assembly.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["module", "qty", "EUR_each", "EUR"])
        w.writerows(mods)
    spec = {"_note": "input of asm_3d.py (mm)", "carrier": d["carrier"], "conveyor_top": d["conveyor"]["top_mm"], "products": d["products"],
            "lift_table": [d["ergo"]["lift_min_mm"], d["ergo"]["lift_max_mm"]], "carriers": n_car, "loop_m": d["conveyor"]["loop_m"],
            "sections": R["ch"]["n_sec"], "section_kW": R["ch"]["P_motor"], "stations": d["stations"], "seg_m": d["times"]["seg_m"],
            "queue_places": R["qp"], "transfer": d["transfer"], "feed": d["feed"], "rack_places": R["fd"]["buf_racks"], "balancers": R["bl"]["n_bal"],
            "test_dock": d["test_dock"]}
    with open(os.path.join(out, "assembly_specs.json"), "w", encoding="utf-8") as fh:
        json.dump(spec, fh, indent=1)
    print(report(d, R))
    print("written to", out)


def selftest(d):
    res = []

    def ck(n, c):
        res.append(bool(c))
        print(("PASS " if c else "FAIL ") + n)
    R = build(d)
    t = R["t"]
    ck("station times from F2: ASSY %.1f, TEST %.1f min (F4.1 used the same)" % (t["ASSY"], t["TEST"]), abs(t["ASSY"] - 31.7) < 0.1 and abs(t["TEST"] - 25.6) < 0.1)
    vc = R["car"]["VC20"]
    ck("carrier beam: M = P a with a = (1200 - 900)/2 = 150 mm", abs(vc["M"] - 125 * 9.81 / 4 * 150) < 1e-6)
    ck("all products: beam, tipping and sliding OK (a_tip VC20 %.1f, a_slide %.1f > bumper %.1f, E-stop %.1f m/s2)" % (vc["a_tip"], vc["a_slide"], vc["a_bump"], vc["a_estop"]),
       all(r["ok"] for r in R["car"].values()))
    ck("bumper: E = m v^2/2 for the VC20 carrier (%.2f J)" % vc["E_bump"], abs(vc["E_bump"] - 0.5 * vc["m_tot"] * 0.04) < 1e-9)
    e = R["erg"]
    ck("ergonomics: needed carrier top %.0f..%.0f mm; lift table 350-800 covers %d of %d cases" % (e["need_min"], e["need_max"], e["covered"], e["n"]),
       e["covered"] >= 0.75 * e["n"])
    ck("ergonomics: every not-covered case is within the 250 mm reach-up / step margin", all(r[6] <= d["ergo"]["max_reach_up_mm"] for r in e["residual"]))
    ch = R["ch"]
    hand = d["conveyor"]["chain_kg_m"] * 10 * 9.81 * 0.15 * 2 + 0.5 * (1 * ch["m"] * 9.81 * 0.05 + 4 * ch["m"] * 9.81 * 0.05) + 0.5 * (ch["m"] + 2.0 * 2 * 10 * 2) * 0.3
    ck("chain pull hand value for 10 m, 4 accumulated + 1 moving = %.0f N" % hand, abs(ch["pull"](10.0, 4, 1) - hand) < 1e-6)
    ck("section %.0f m <= max full section %.1f m; pull %.0f N <= %d N" % (ch["sec"], ch["L_max_full"], ch["F_sec"], d["conveyor"]["F_allow_N"]),
       ch["sec"] <= ch["L_max_full"] and ch["F_sec"] <= d["conveyor"]["F_allow_N"])
    ck("stopper: line pressure %.0f N and impact %.1f J inside the class" % (R["st"]["F"], R["st"]["E"]), R["st"]["ok"])
    ck("transfers: main-line occupation < 15 %% at every group", all(v < 0.15 for v in R["tf"]["main_occ"].values()))
    cur = R["curve"]
    ths = [r["TH_h"] for r in cur]
    ck("DES: throughput rises with N and saturates below the bottleneck (TEST %.1f /h)" % (7 * 60 / t["TEST"]),
       ths[-1] >= ths[0] and max(ths) <= 7 * 60 / t["TEST"] * 1.03)
    ck("DES: N_min = %s carriers reach the design rate %.1f /h" % (R["nmin"], R["lam"]), R["nmin"] is not None)
    ck("DES vs Little: N_min %s within +-40 %% of the F4.1 estimate %d" % (R["nmin"], R["asy41"]["carriers"]),
       R["nmin"] is not None and abs(R["nmin"] - R["asy41"]["carriers"]) <= 0.4 * R["asy41"]["carriers"])
    r1 = des_loop(d, t, 1, hours=200)
    cyc = sum(t.values()) + sum(d["times"]["seg_m"].values()) / 0.2 / 60 + 4 * 2 * R["tf"]["t"] / 60
    ck("DES with ONE carrier: throughput = 60 / cycle time %.1f min (+-5 %%)" % cyc, abs(r1["TH_h"] - 60 / cyc) / (60 / cyc) < 0.05)
    cap = seg_capacity(d)
    rN = [r for r in cur if r["N"] in (20, 22)]
    ck("queues at 20-22 carriers fit their main-line segments (%s)" % ", ".join("%s %d/%d" % (k, max(r["qmax"][k] for r in rN), cap[k]) for k in ("ASSY", "TEST", "PAINT", "PACK")),
       all(max(r["qmax"][k] for r in rN) <= cap[k] for k in ("ASSY", "TEST", "PAINT", "PACK")))
    fd = R["fd"]
    ck("tank rack %.0f kg <= AGV payload 300 kg" % fd["rack_mass"], fd["rack_ok"])
    ck("feed: %.0f AGV moves/month handed to F5" % fd["agv_moves_m"], fd["agv_moves_m"] > 0)
    bl = R["bl"]
    lis = {r[1]: r[3] for r in bl["rows"] if r[0] == "VC20"}
    ck("NIOSH: crankcase LI %.2f > 1 -> balancer; flywheel LI %.2f" % (lis["C01 crankcase"], lis["C09 flywheel"]), lis["C01 crankcase"] > 1)
    ck("balancers %d, utilisation %.0f %% < 50 %%" % (bl["n_bal"], 100 * bl["util"]), bl["util"] < 0.5)
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
