#!/usr/bin/env python3
"""Final thesis item F4.1 - system definition and sizing of all load stations and conveyors of the combined FMS.

What this program decides (guide Doctor paper/61_final_conveyors_load_stations.md, chapter 1-9):
  1 which stations exist: AS/RS front U-loop, one AGV handover (P&D) station per department, the assembly carrier line
  2 how many crate places every lane needs (Poisson overflow rule, line-side buffers of F3 refined)
  3 whether the AS/RS front works in the busiest hour (discrete-event simulation, 1 s steps)
  4 how many workpiece carriers the assembly line needs (Erlang C queues + Little's law)
  5 the list of conveyor modules (input of F4.2 mechanics), I/O estimate (input of F4.5), cost against the F2 budget

Python 3 standard library only, offline. Inputs: conv_data.json + F2 (../02_fms) + F3 (../03_asrs).
Outputs (out/): system_report.md, stations.csv, zones.csv, modules.csv, des_asrs_front.csv, asrs_front_layout.svg,
system_overview.svg, design_result.json.

Commands
  python conv_system.py selftest
  python conv_system.py run
  python conv_system.py des [--hours 200] [--agv 240]    AS/RS front simulation only

Formulas
  department flow     T_d = sum of the F2 AGV flows touching d (unit loads/month) ; in = out = T_d / 2
  peak rate           lambda = T_d / 2 / H * k_peak                     (H = 330 h/month, k_peak = 1.6)
  Poisson lane rule   places = min k with P(N > k) <= p , N ~ Poisson(lambda * W)  (p = 1 %)
  inbound lane        places = line-side crates(d) + Poisson places(lambda_in * W_pull)
  zone transit        t_zone = pitch / v (+ lift time at a transfer unit)
  Erlang C            C(c, a) = (a^c / c!) / ((1 - rho) * sum_{k<c} a^k/k! + a^c / c!) , a = lambda t , rho = a / c
                      W_q = C t / (c (1 - rho)) ; P(N_q >= k) = C rho^k  -> queue places k with C rho^k <= p_q
  Little              carriers = lambda_peak * (t_load + sum(t_s + W_q,s) + t_unload + L_loop / v) * (1 + spare)
"""

import argparse
import csv
import json
import math
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
F2DIR = os.path.join(HERE, "..", "02_fms")
F3DIR = os.path.join(HERE, "..", "03_asrs")


def load(path=os.path.join(HERE, "conv_data.json")):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# ============================================================================= 1 inputs from F2 and F3
def inputs():
    sys.path.insert(0, F2DIR)
    sys.path.insert(0, F3DIR)
    import fms_design as F2
    import asrs_design as A3
    d2, pdata = F2.load_all()
    rows = F2.routing(pdata)
    fl = F2.flows(d2, rows, pdata)
    a3 = A3.load()
    pf, _ = A3.part_flows(a3)
    bf = A3.buffers(a3, pf, d2)
    with open(os.path.join(F3DIR, "out", "design_result.json"), encoding="utf-8") as fh:
        r3 = json.load(fh)
    rep = open(os.path.join(F2DIR, "out", "report.md"), encoding="utf-8").read()
    rows_l = [re.search(r"Row %d \(from the dock wall\): (.*)" % k, rep).group(1).split(" | ") for k in (1, 2)]
    sec = rep[rep.index("| Department | Area m2 |"):]
    sec = sec[:sec.index("\n\n")]
    areas = {m.group(1): float(m.group(2)) for m in re.finditer(r"^\| ([A-Z]{2,4}) [^|]*\| (\d+) \|$", sec, re.M)}
    loads = {}
    with open(os.path.join(F2DIR, "out", "machines.csv"), encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            loads[r["type"]] = float(r["load_h"])
    cf = crate_flows(d2, rows, pf, F2)
    return {"H": d2["programme"]["H_month"], "flows": cf, "flows_f2": fl, "buffers": bf, "r3": r3, "rows": rows_l, "areas": areas, "loads": loads}


def crate_flows(d2, rows, pf, F2):
    """Crate flows per month between departments with the REAL crate contents of F3 (ppc_raw for the first leg from the
    AS/RS, ppc_mach afterwards) instead of the F2 family unit loads (P-L = 1 part per unit load). Kits go to assembly in
    kit trolleys of 30 units (F3), bought parts as in F2, tool trolleys and chip bins as in F2."""
    dept = {t: v["dept"] for t, v in d2["machines"].items() if not t.startswith("_")}
    alias = d2["layout"].get("dept_alias", {})
    dem = d2["programme"]["demand_month"]
    F = {}

    def add(x, y, v):
        x, y = alias.get(x, x), alias.get(y, y)
        if x != y and v > 0:
            k = tuple(sorted((x, y)))
            F[k] = F.get(k, 0.0) + v
    seqs = {}
    for r in rows:
        if r["part"] != "ASSY":
            seqs.setdefault((r["variant"], r["part"]), []).append(r)
    for (v, part), rr in seqs.items():
        key = part if v == "VC20" else part + "-" + v
        f = pf.get(key)
        if not f or not dem.get(v):
            continue
        path = ["RAW"] + [dept[r["machine"]] for r in rr] + ["KIT"]
        clean = [path[0]]
        for x in path[1:]:
            if alias.get(x, x) != alias.get(clean[-1], clean[-1]):
                clean.append(x)
        for k, (x, y) in enumerate(zip(clean, clean[1:])):
            add(x, y, f["pcs_month"] / (f["ppc_raw"] if k == 0 else f["ppc_mach"]))
    for v, q in dem.items():
        add("BUY", "ASY", q if v.startswith("VC") else q * 0.5)
        add("BUY", "KIT", q / 10.0)
        add("KIT", "ASY", q / 30.0)              # kit trolley per 30 units (F3)
    for k in ("HMC", "VMC", "ROT"):
        add("TOOL", k, 400.0)
        add("CHIP", k, 60.0)
    for v, q in dem.items():
        for x, y in (("ASY", "TST"), ("TST", "PNT"), ("PNT", "PCK"), ("PCK", "SHP")):
            add(x, y, q)
    return F


# ============================================================================= 2 department demand and lane sizing
def poisson_places(mean, p):
    """Smallest k with P(N > k) <= p for N ~ Poisson(mean)."""
    k, term, cdf = 0, math.exp(-mean), math.exp(-mean)
    while 1.0 - cdf > p:
        k += 1
        term *= mean / k
        cdf += term
    return k


def line_side(d, bf):
    """F3 line-side crates per department. Refinement: only ONE Roots variant runs at a time (lot = 1 week),
    so the RB crates are the maximum over the variants, not the sum (F3 counted all three)."""
    out, rb = {}, {}
    for part, ph, need, cr in bf:
        base = part.split("-")[0]
        dept = d["first_op_dept"][base]
        if "-" in part:
            rb[base] = max(rb.get(base, 0), cr)
        else:
            out[dept] = out.get(dept, 0) + cr
    for base, cr in rb.items():
        dept = d["first_op_dept"][base]
        out[dept] = out.get(dept, 0) + cr
    return out, sum(b[3] for b in bf)


def departments(d, I):
    asm = set(d["assembly_line_depts"])
    T = {}
    for (a, b), v in I["flows"].items():
        if a in asm and b in asm:
            continue                      # products on the assembly line conveyor
        if [a, b] in d["non_crate_pairs"]:
            continue                      # tanks / motors: separate feed (F4.4)
        for x in (a, b):
            T[x] = T.get(x, 0.0) + v
    ls, ls_f3 = line_side(d, I["buffers"])
    st = []
    for dept, t in sorted(T.items(), key=lambda kv: -kv[1]):
        lam = t / 2.0 / I["H"] * d["peak_factor"]
        row = {"dept": dept, "T_month": t, "lam_in_h": lam, "lam_out_h": lam, "line_side": ls.get(dept, 0)}
        if dept == "RAW":
            row.update(kind="ASRS_FRONT", lanes="U-loop CV1/CV2/CV3, sized with the F3 crane moves (incl. receiving infeed and empty crates)")
        elif dept in d["no_conveyor_depts"]:
            row.update(kind="FLOOR", lanes=d["no_conveyor_depts"][dept])
        else:
            q_out = max(2, poisson_places(lam * d["agv_response_design_min"] / 60.0, d["overflow_p"]))
            q_in = max(1, poisson_places(lam * d["inbound_pull_min"] / 60.0, d["overflow_p"]))
            row.update(kind="PD", out_places=q_out, in_queue=q_in, in_places=ls.get(dept, 0) + q_in,
                       lanes="inbound %d + outbound %d places" % (ls.get(dept, 0) + q_in, q_out))
        st.append(row)
    return st, ls, ls_f3


# ============================================================================= 3 AS/RS front - discrete-event simulation (1 s steps)
class Front:
    """U-loop: cv1 = [TU1, Z12 .. Z16 (P&D in)], cv2 = [Z26 (P&D out) .. Z22, TU2], cv3 = pick/rework position.
    Zero-pressure accumulation: a crate moves to the next zone only when it is empty; a move takes pitch / v.
    Deadlock rules (proved by the self-test with long runs):
      R0 the check (contour frame, scale, ID) is done ON TU1; an AGV crate that fails goes back onto the docked AGV
      R1 Z31 stays reserved for a returning kit crate until it has passed the check on TU1 (a fail goes back to Z31)
      R2 a kit crate leaves TU2 into cv3 only when cv3 is free and not reserved
      R3 cv3 returns into TU1 before a waiting AGV may drop (frees the pick place first)
      R4 the crane stores whenever a crate waits at the P&D in (dual cycle if a retrieval is also possible)"""

    def __init__(self, d, r3, lam_in, lam_out, lam_kit, agv_mean=None, seed=None, pickups=None):
        C, F = d["conveyor"], d["asrs_front"]
        self.pickups = F["pickup_index"] if pickups is None else pickups
        self.tz = C["zone_pitch_chain_m"] / C["v_m_s"]
        self.lift, self.check, self.rej, self.rework = C["tu_lift_s"], C["check_s"], C["reject_rate"], C["rework_s"]
        self.SC, self.DC = r3["crane"]["fem"]["SC"], r3["crane"]["fem"]["DC"]
        self.pick_m, self.pick_cv = F["pick_s_mean"], F["pick_cv"]
        self.agv = F["agv_wait_mean_s"] if agv_mean is None else agv_mean
        self.rng = random.Random(F["seed"] if seed is None else seed)
        self.l_in, self.l_out, self.l_kit = lam_in / 3600.0, lam_out / 3600.0, lam_kit / 3600.0
        self.cv1, self.cv2 = [None] * 6, [None] * 6
        self.cv3, self.cv3_res = None, False
        self.crane_free, self.crane_put = 0.0, None
        self.orders, self.agvq = [], []
        self.n = 0
        self.st = {"stored": 0, "retrieved": 0, "agv_wait": [], "lead": [], "busy": 0.0, "occ1": [], "occ2": [], "agvq": [],
                   "rejects": 0, "kit_done": 0, "cv2_full_block": 0, "t": 0}

    def _lognorm(self, m, cv):
        s2 = math.log(1 + cv * cv)
        return self.rng.lognormvariate(math.log(m) - s2 / 2, math.sqrt(s2))

    def _crate(self, kind, t):
        self.n += 1
        return {"id": self.n, "kind": kind, "ready": t, "checked": False, "reject": False, "t0": t}

    def step(self, t, rec):
        rng = self.rng
        # arrivals
        if rng.random() < self.l_in:
            self.agvq.append(t)
        if rng.random() < self.l_out:
            self.orders.append(("out", t))
        if rng.random() < self.l_kit:
            self.orders.append(("kit", t))
        # crane
        if self.crane_put and t >= self.crane_put[0]:
            c = self.crane_put[1]
            c["ready"] = t
            self.cv2[0] = c
            self.crane_put = None
            if rec:
                self.st["retrieved"] += 1
        if t >= self.crane_free and self.crane_put is None:
            c1 = self.cv1[5]
            can_store = c1 is not None and c1["ready"] <= t
            can_ret = bool(self.orders) and self.cv2[0] is None
            if self.orders and self.cv2[0] is not None and not can_store and rec:
                self.st["cv2_full_block"] += 1
            if can_store or can_ret:
                f = rng.uniform(0.6, 1.4)
                dur = (self.DC if (can_store and can_ret) else self.SC) * f
                if can_store:
                    self.cv1[5] = None
                    if rec:
                        self.st["stored"] += 1
                if can_ret:
                    kind, t0 = self.orders.pop(0)
                    c = self._crate(kind, t + dur)
                    c["t0"] = t0
                    c["checked"] = True
                    if kind == "out":                     # AGV dispatched when the crane starts the retrieval
                        c["pickup"] = t + rng.expovariate(1.0 / self.agv)
                    self.crane_put = (t + dur, c)
                self.crane_free = t + dur
                if rec:
                    self.st["busy"] += dur
        # cv2 forward (index 0 -> 5)
        for i in range(4, -1, -1):
            c = self.cv2[i]
            if c and c["ready"] <= t and self.cv2[i + 1] is None and "taking" not in c:
                self.cv2[i + 1], self.cv2[i] = c, None
                c["ready"] = t + self.tz + (self.lift if (i + 1) in self.pickups else 0)
        for k in self.pickups:                            # AGV takes its crate at any pick-up transfer (10 s)
            c = self.cv2[k]
            if c and c["kind"] == "out" and c["ready"] <= t and t >= c["pickup"]:
                if "taking" not in c:
                    c["taking"] = t + 10.0
                elif t >= c["taking"]:
                    self.cv2[k] = None
                    if rec:
                        self.st["lead"].append(t - c["t0"])
        c = self.cv2[5]
        if c and c["ready"] <= t:
            if c["kind"] == "kit" and self.cv3 is None and not self.cv3_res:           # R2
                self.cv2[5] = None
                c["ready"] = t + self.tz + self.lift + self._lognorm(self.pick_m, self.pick_cv)
                c["checked"] = False
                if rec:
                    self.st["lead"].append(t - c["t0"])
                self.cv3 = c
        # cv1: TU1 = weighing transfer with contour frame + ID reader; every crate is checked ON TU1 (check_s)
        for i in range(4, 0, -1):
            c = self.cv1[i]
            if c and c["ready"] <= t and self.cv1[i + 1] is None:
                self.cv1[i + 1], self.cv1[i] = c, None
                c["ready"] = t + self.tz
        c = self.cv1[0]
        if c and c["ready"] <= t:
            if c["reject"]:
                if c["kind"] == "in":                       # back onto the AGV that is still docked
                    self.cv1[0] = None
                    if rec:
                        self.st["rejects"] += 1
                else:                                       # kit return: back to Z31 (still reserved for it)
                    self.cv1[0] = None
                    c["reject"] = False
                    c["ready"] = t + self.tz + self.lift + self.rework
                    self.cv3 = c
                    if rec:
                        self.st["rejects"] += 1
            elif self.cv1[1] is None:
                self.cv1[1], self.cv1[0] = c, None
                c["ready"] = t + self.tz + self.lift
                if c.get("from3"):
                    self.cv3_res = False                    # R1: Z31 released only after the check passed
                    if rec:
                        self.st["kit_done"] += 1
        # cv3 -> TU1 first (R3), then an AGV may drop
        c = self.cv3
        if c and c["ready"] <= t and self.cv1[0] is None:
            self.cv1[0], self.cv3 = c, None
            self.cv3_res = True
            c["from3"] = True
            c["ready"] = t + self.tz + self.lift + self.check
            c["reject"] = rng.random() < self.rej
        elif self.agvq and self.cv1[0] is None and not (self.cv3 and self.cv3["ready"] <= t + 15):
            ta = self.agvq.pop(0)
            c = self._crate("in", t)
            c["ready"] = t + 10.0 + self.check             # 10 s AGV roller transfer + check while the AGV waits
            c["reject"] = rng.random() < self.rej
            self.cv1[0] = c
            if rec:
                self.st["agv_wait"].append(t - ta)
        if rec:
            self.st["occ1"].append(sum(1 for z in self.cv1 if z))
            self.st["occ2"].append(sum(1 for z in self.cv2 if z))
            self.st["agvq"].append(len(self.agvq))
            self.st["t"] += 1


def pct(xs, q):
    if not xs:
        return 0.0
    s = sorted(xs)
    return s[min(len(s) - 1, int(q * len(s)))]


def run_front(d, I, hours=None, agv=None, seed=None, factor=1.0, pickups=None, kit_factor=1.0, pick_mean=None):
    F = d["asrs_front"]
    mv = I["r3"]["moves"]
    visits = mv["batches_month"] * 10.0
    agv_moves = (mv["raw_month"] + mv["kit_month"] - 2 * visits) / 2.0
    lam = agv_moves / I["H"] * d["peak_factor"] * factor
    lam_kit = visits / I["H"] * d["peak_factor"] * factor * kit_factor
    fr = Front(d, I["r3"], lam, lam, lam_kit, agv, seed, pickups)
    if pick_mean is not None:
        fr.pick_m = pick_mean
    T = int(3600 * (F["des_hours"] if hours is None else hours))
    W = int(3600 * F["warmup_h"])
    for t in range(T + W):
        fr.step(float(t), t >= W)
    s = fr.st
    h = s["t"] / 3600.0
    occ1, occ2 = s["occ1"], s["occ2"]
    res = {"lam_in_h": lam, "lam_out_h": lam, "lam_kit_h": lam_kit, "hours": h,
           "crane_util": s["busy"] / s["t"], "moves_h": (s["stored"] + s["retrieved"]) / h,
           "agv_wait_mean_s": sum(s["agv_wait"]) / max(1, len(s["agv_wait"])), "agv_wait_p95_s": pct(s["agv_wait"], 0.95),
           "agv_wait_max_s": max(s["agv_wait"] or [0]), "agvq_max": max(s["agvq"] or [0]),
           "occ1_p99": pct(occ1, 0.99), "occ1_max": max(occ1 or [0]), "occ2_p99": pct(occ2, 0.99), "occ2_max": max(occ2 or [0]),
           "cv1_full_share": sum(1 for x in occ1 if x == 6) / max(1, len(occ1)),
           "lead_p95_s": pct(s["lead"], 0.95), "rejects_h": s["rejects"] / h, "kit_h": s["kit_done"] / h,
           "cv2_block_share": s["cv2_full_block"] / s["t"], "backlog_end": len(fr.orders) + len(fr.agvq),
           "occ1_hist": [sum(1 for x in occ1 if x == k) / len(occ1) for k in range(7)],
           "occ2_hist": [sum(1 for x in occ2 if x == k) / len(occ2) for k in range(7)]}
    return res


# ============================================================================= 4 assembly carrier line
def erlang_c(c, a):
    rho = a / c
    if rho >= 1:
        return 1.0, rho
    s = sum(a ** k / math.factorial(k) for k in range(c))
    top = a ** c / math.factorial(c)
    return top / ((1 - rho) * s + top), rho


def assembly(d, I):
    A = d["assembly"]
    lam_avg = A["units_month"] / I["H"]
    lam = lam_avg * A["peak_factor"]
    out, tot_t = [], A["load_on_min"] + A["unload_min"]
    for typ, c in A["stations"].items():
        t = I["loads"][typ] * 60.0 / A["units_month"]
        C, rho = erlang_c(c, lam * t / 60.0)
        wq = C * t / (c * (1 - rho)) if rho < 1 else float("inf")
        k = 0
        while C * rho ** k > A["queue_p"]:
            k += 1
        out.append({"type": typ, "c": c, "t_min": t, "rho": rho, "C": C, "Wq_min": wq, "queue_places": k})
        tot_t += t + wq
    w = lambda dep: I["areas"].get(dep, 0) * A["area_factor"] / A["row_depth_m"]
    one_way = w("ASY") + w("TST") + w("PNT") + w("PCK") + w("SHP") / 2.0
    L = 2 * one_way + 2 * 3.0
    t_loop = L / A["loop_v_m_s"] / 60.0
    little = lam * (tot_t + t_loop) / 60.0
    n = math.ceil(little * (1 + A["spare_share"]))
    places = sum(2 * s["c"] for s in out) + sum(s["queue_places"] for s in out) + int(L / A["carrier"]["pitch_m"]) + 2
    return {"lam_avg_h": lam_avg, "lam_h": lam, "groups": out, "loop_m": L, "t_loop_min": t_loop, "flow_min": tot_t + t_loop,
            "little": little, "carriers": n, "places": places, "widths": {k: w(k) for k in ("ASY", "TST", "PNT", "PCK", "SHP")}}


# ============================================================================= 5 modules, I/O, cost
def modules(d, st, asy):
    F = d["asrs_front"]
    C = d["cost_EUR"]
    m = {}

    def add(k, n, where):
        m.setdefault(k, {"n": 0, "where": []})
        m[k]["n"] += n
        m[k]["where"].append("%s %g" % (where, n))
    zones = F["CV1"] + F["CV2"] + F["CV3"]
    for z in zones:
        add(z[1], 1, "AS/RS front")
    add("contour_gate", 1, "AS/RS front")
    add("scale", 1, "AS/RS front")
    for s in st:
        if s["kind"] == "PD":
            add("RL", s["in_places"] + s["out_places"], s["dept"])
            add("PD_end", 2, s["dept"])
    add("loop_per_m", round(asy["loop_m"]), "assembly loop")
    add("spur_unit", sum(g["c"] for g in asy["groups"]), "assembly spurs")
    add("corner_unit", 4, "assembly loop")
    add("carrier", asy["carriers"], "assembly")
    add("assy_load_station", 1, "assembly start (tank onto carrier)")
    io = {"CC": (2, 2, 0), "TU": (4, 4, 0), "RCX": (2, 2, 0), "RL": (2, 1, 0), "PD_end": (4, 2, 0), "contour_gate": (6, 0, 0),
          "scale": (0, 0, 1), "spur_unit": (6, 4, 0), "corner_unit": (4, 3, 0), "assy_load_station": (6, 4, 0), "loop_per_m": (0.5, 0.25, 0)}
    tot_di = tot_do = tot_ai = 0.0
    cost = 0.0
    rows = []
    for k, v in m.items():
        di, do, ai = io.get(k, (0, 0, 0))
        tot_di += di * v["n"]
        tot_do += do * v["n"]
        tot_ai += ai * v["n"]
        c = C.get(k, 0) * v["n"]
        cost += c
        rows.append([k, v["n"], C.get(k, 0), c, "; ".join(v["where"])])
    return rows, cost, {"DI": math.ceil(tot_di), "DO": math.ceil(tot_do), "AI": math.ceil(tot_ai)}


# ============================================================================= 6 SVG drawings
def svg_front(d):
    F = d["asrs_front"]
    S = 70.0                    # px per m
    ox, oy = 760.0, 330.0       # x = 0, y = 0
    X = lambda x: ox + x * S
    Y = lambda y: oy - y * S
    o = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" font-family="Arial">',
         '<rect width="100%" height="100%" fill="#fff"/>',
         '<text x="20" y="28" font-size="17" font-weight="bold">AS/RS front U-loop (F4.1) - plan view, 1 m = %d px</text>' % S,
         '<text x="20" y="48" font-size="12">x = 0 transfer line at the aisle end; crate centre y = +-1.4 m (F3 fork pick point); chain zones 1.2 m, crate 800 leading</text>']
    o.append('<rect x="%.0f" y="%.0f" width="%.0f" height="%.0f" fill="#f2f2f2" stroke="#666"/>' % (X(0.6), Y(2.05), 400, 4.1 * S))
    o.append('<text x="%.0f" y="%.0f" font-size="13" fill="#555">rack + aisle (crane) -></text>' % (X(1.0), Y(0) + 5))
    col = {"TU": "#ffe0b3", "CC": "#e6f0ff", "RCX": "#e8f7e8"}
    for line in ("CV1", "CV2", "CV3"):
        for zid, typ, x, y, txt in F[line]:
            w, h = (0.8, 1.2) if typ != "RCX" else (1.2, 0.8)
            o.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" stroke="#000" stroke-width="1.5"/>' % (
                X(x - w / 2), Y(y + h / 2), w * S, h * S, col[typ]))
            o.append('<text x="%.1f" y="%.1f" font-size="11" text-anchor="middle" font-weight="bold">%s</text>' % (X(x), Y(y) + 4, zid))
    # arrows
    def arrow(x1, y1, x2, y2, c="#c00"):
        o.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2" marker-end="url(#a)"/>' % (X(x1), Y(y1), X(x2), Y(y2), c))
    o.insert(2, '<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c00"/></marker></defs>')
    arrow(-5.4, -2.25, -0.6, -2.25); o.append('<text x="%.0f" y="%.0f" font-size="12" fill="#c00">CV1 infeed -> P&amp;D in</text>' % (X(-4.6), Y(-2.25) + 18))
    arrow(-0.6, 2.25, -5.4, 2.25); o.append('<text x="%.0f" y="%.0f" font-size="12" fill="#c00">CV2 outfeed &lt;- P&amp;D out</text>' % (X(-4.6), Y(2.25) - 8))
    arrow(-6.0, 0.75, -6.0, 0.45); arrow(-6.0, -0.45, -6.0, -0.75)
    # AGV docks
    for xd, y, lab in ((-6.0, -2.75, "AGV drop-off (sideways into TU1)"), (-6.0, 2.75, "AGV pick-up 1 (TU2)"), (-3.6, 2.75, "AGV pick-up 2 (TU3)")):
        o.append('<rect x="%.0f" y="%.0f" width="%.0f" height="%.0f" fill="none" stroke="#7a3fb0" stroke-dasharray="6 4" stroke-width="2"/>' % (
            X(xd - 0.6), Y(y + 0.55), 1.2 * S, 1.1 * S))
        o.append('<text x="%.0f" y="%.0f" font-size="12" fill="#7a3fb0">%s</text>' % (X(xd - 0.6) - 8 if xd < -5 else X(xd + 0.7), Y(y) + 4, lab) if xd > -5 else
                 '<text x="%.0f" y="%.0f" font-size="12" fill="#7a3fb0" text-anchor="end">%s</text>' % (X(xd - 0.7), Y(y) + 4, lab))
    # operator, fence, gate, scanner
    o.append('<rect x="%.0f" y="%.0f" width="%.0f" height="%.0f" fill="#fff4e6" stroke="#c06000"/>' % (X(-7.6), Y(0.9), 0.8 * S, 1.8 * S))
    o.append('<text x="%.0f" y="%.0f" font-size="12" fill="#c06000" text-anchor="end">operator: pick / rework</text>' % (X(-7.7), Y(0) + 4))
    for y0 in (0.95, -0.95):
        o.append('<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#c06000" stroke-width="3"/>' % (X(-8.0), Y(y0), X(-6.7), Y(y0)))
    o.append('<rect x="%.0f" y="%.0f" width="%.0f" height="%.0f" fill="none" stroke="#2a8a2a" stroke-width="4"/>' % (X(-6.5), Y(-0.75), 1.0 * S, 1.3 * S))
    o.append('<text x="%.0f" y="%.0f" font-size="11" fill="#2a8a2a">TU1: contour frame + scale + ID</text>' % (X(-5.4), Y(-0.6)))
    o.append('<text x="20" y="620" font-size="12">Flows: AGV crate -> TU1 check (8 s, AGV waits) -> Z12..Z15 accumulation -> Z16 P&amp;D in -> crane.  Crane -> Z26 P&amp;D out -> Z25..Z22 -> TU2 -> AGV.</text>')
    o.append('<text x="20" y="640" font-size="12">Kit visit: TU2 -> Z31 pick (90 s) -> TU1 check -> rack (fail: back to Z31, rework 180 s).  AGV crate that fails (2 %%): back onto the AGV -> rework area.</text>')
    o.append('<text x="20" y="660" font-size="12">Safety (F4.5/F8): fences, light curtains with muting at both AGV docks, enabling at the operator place; EN 619, ISO 3691-4.</text>')
    o.append('<text x="20" y="700" font-size="11" fill="#b00000">DESIGN - F4.1 sizing layout; mechanical detail in F4.2/F4.3 (3D). Replaces the simple I/O sketch of F3 Part A (contour check moved onto TU1, pick place = Z31).</text>')
    o.append("</svg>")
    return "\n".join(o)


def svg_overview(d, I, st, asy):
    rows = I["rows"]
    A = d["assembly"]
    w = lambda dep: max(2.5, I["areas"].get(dep, 30) * A["area_factor"] / A["row_depth_m"])
    S = min(1120.0 / max(sum(w(x) for x in row) for row in rows), 9.0)
    o = ['<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="600" viewBox="0 0 1180 600" font-family="Arial">',
         '<rect width="100%" height="100%" fill="#fff"/>',
         '<text x="20" y="28" font-size="17" font-weight="bold">Material handling system overview (F4.1) - F2 spine layout, stations of F4</text>']
    bystat = {s["dept"]: s for s in st}
    y0 = {0: 60, 1: 60 + 22 * S + 6 * S}
    for r, row in enumerate(rows):
        x = 30.0
        for dep in row:
            ww = w(dep) * S
            o.append('<rect x="%.0f" y="%.0f" width="%.0f" height="%.0f" fill="#f7f7f7" stroke="#444"/>' % (x, y0[r], ww, 22 * S))
            o.append('<text x="%.0f" y="%.0f" font-size="12" font-weight="bold">%s</text>' % (x + 4, y0[r] + 16, dep))
            s = bystat.get(dep)
            ya = y0[r] + 22 * S - 30 if r == 0 else y0[r] + 6
            if s and s["kind"] == "PD":
                o.append('<rect x="%.0f" y="%.0f" width="%.0f" height="24" fill="#e6f0ff" stroke="#2a6fbb"/>' % (x + 4, ya, min(ww - 8, 70)))
                o.append('<text x="%.0f" y="%.0f" font-size="10">P&amp;D %d/%d</text>' % (x + 8, ya + 16, s["in_places"], s["out_places"]))
            elif s and s["kind"] == "ASRS_FRONT":
                o.append('<rect x="%.0f" y="%.0f" width="%.0f" height="24" fill="#ffe0b3" stroke="#c06000"/>' % (x + 4, ya, min(ww - 8, 110)))
                o.append('<text x="%.0f" y="%.0f" font-size="10">AS/RS front U-loop</text>' % (x + 8, ya + 16))
            elif s and s["kind"] == "FLOOR":
                o.append('<text x="%.0f" y="%.0f" font-size="10" fill="#777">floor station</text>' % (x + 4, ya + 16))
            x += ww
    # AGV spine
    ys = y0[0] + 22 * S
    o.append('<rect x="30" y="%.0f" width="%.0f" height="%.0f" fill="#f3ecfa" stroke="#7a3fb0" stroke-dasharray="6 4"/>' % (ys, max(sum(w(x) for x in row) for row in rows) * S, 6 * S))
    o.append('<text x="40" y="%.0f" font-size="12" fill="#7a3fb0">AGV spine aisle 6 m (fleet size: F5, with the crate flows of F4.1) - every P&amp;D station docks on this aisle</text>' % (ys + 3 * S + 4))
    # assembly loop drawn in row 2 over SHP..ASY
    x = 30.0
    xs = {}
    for dep in rows[1]:
        xs[dep] = (x, x + w(dep) * S)
        x += w(dep) * S
    xa, xb = xs["SHP"][0] + w("SHP") * S / 2, xs["ASY"][1] - 10
    yl1, yl2 = y0[1] + 60, y0[1] + 22 * S - 40
    o.append('<rect x="%.0f" y="%.0f" width="%.0f" height="%.0f" fill="none" stroke="#2a8a2a" stroke-width="4" rx="18"/>' % (xa, yl1, xb - xa, yl2 - yl1))
    o.append('<text x="%.0f" y="%.0f" font-size="11" fill="#2a8a2a">assembly carrier loop %.0f m, %d carriers: ASSY %d / TEST %d / PAINT %d / PACK %d spurs</text>' % (
        xa + 6, yl2 + 18, asy["loop_m"], asy["carriers"], *[g["c"] for g in asy["groups"]]))
    o.append('<text x="20" y="%.0f" font-size="11" fill="#b00000">Numbers P&amp;D' % (y0[1] + 22 * S + 22) + ' in/out = crate places of the inbound / outbound lane (Poisson rule + line-side crates). DESIGN F4.1.</text>')
    o.append("</svg>")
    return "\n".join(o)


# ============================================================================= 7 build / report
def build(d, I=None, des_hours=None):
    I = I or inputs()
    st, ls, ls_f3 = departments(d, I)
    fr = run_front(d, I, hours=des_hours)
    asy = assembly(d, I)
    mrows, cost, io = modules(d, st, asy)
    return {"I": I, "stations": st, "line_side": ls, "line_side_f3": ls_f3, "front": fr, "asy": asy, "modules": mrows, "cost": cost, "io": io}


def report(d, R):
    I, fr, asy = R["I"], R["front"], R["asy"]
    L = ["# F4.1 - load stations and conveyors: system definition and sizing (conv_system.py)", "",
         "All values: DESIGN or REFERENCE ESTIMATE; DES results = SIMULATED.", "",
         "## 1 Stations per department (crate flows, peak factor %.1f, H = %d h/month)" % (d["peak_factor"], I["H"]), "",
         "| Dept | crates/month | peak in = out /h | station | line-side crates | lanes |", "|---|---|---|---|---|---|"]
    for s in R["stations"]:
        L.append("| %s | %.0f | %.2f | %s | %d | %s |" % (s["dept"], s["T_month"], s["lam_in_h"], s["kind"], s["line_side"], s["lanes"]))
    t2 = {}
    for (x, y), v in I["flows_f2"].items():
        if not (x in d["assembly_line_depts"] and y in d["assembly_line_depts"]):
            for z in (x, y):
                t2[z] = t2.get(z, 0.0) + v
    tot_c = sum(s["T_month"] for s in R["stations"]) / 2
    tot_2 = sum(t2.values()) / 2
    L += ["", "**Crate flows vs F2 unit loads.** F2 counted transport units by family (P-L = 1 part per unit load, one kit per product); "
          "with the real crate contents of F3 the AGV flows are **%.0f** instead of **%.0f** unit loads per month (%.0f %%). "
          "F5 sizes the AGV fleet with the crate flows." % (tot_c, tot_2, 100 * tot_c / tot_2), "",
          "| Dept | F2 unit loads | crates (F4.1) |", "|---|---|---|"]
    for s_ in R["stations"]:
        L.append("| %s | %.0f | %.0f |" % (s_["dept"], t2.get(s_["dept"], 0), s_["T_month"]))
    nc = sum(v for k, v in I["flows"].items() if list(k) in d["non_crate_pairs"])
    L += ["", "Not crates: BUY -> ASY %.0f unit loads/month (300 L tanks + motors) -> separate tank/motor feed of the assembly load station (F4.4)." % nc]
    L += ["", "Line-side crates (F3 ch. 10 refined): %d instead of %d - only one Roots variant runs at a time (weekly lot)." % (
        sum(R["line_side"].values()), R["line_side_f3"]), "",
          "## 2 AS/RS front U-loop - simulation of the busiest hour (%.0f h simulated)" % fr["hours"], "",
          "| Quantity | Value |", "|---|---|",
          "| arrivals by AGV / retrievals to AGV / kit visits per h | %.1f / %.1f / %.1f |" % (fr["lam_in_h"], fr["lam_out_h"], fr["lam_kit_h"]),
          "| crane moves per h (simulated) | %.1f |" % fr["moves_h"],
          "| crane utilisation | %.1f %% |" % (100 * fr["crane_util"]),
          "| AGV wait at TU1: mean / p95 / max | %.1f / %.0f / %.0f s |" % (fr["agv_wait_mean_s"], fr["agv_wait_p95_s"], fr["agv_wait_max_s"]),
          "| AGVs queuing at TU1 (max) | %d |" % fr["agvq_max"],
          "| crates on CV1 (6 places): p99 / max; share of time full | %d / %d; %.2f %% |" % (fr["occ1_p99"], fr["occ1_max"], 100 * fr["cv1_full_share"]),
          "| crates on CV2 (6 places): p99 / max | %d / %d |" % (fr["occ2_p99"], fr["occ2_max"]),
          "| retrieval lead time p95 (order -> crate at TU2 / pick) | %.0f s |" % fr["lead_p95_s"],
          "| rejects / kit visits done per h | %.2f / %.1f |" % (fr["rejects_h"], fr["kit_h"]),
          "| crane waiting because P&D out occupied | %.2f %% of time |" % (100 * fr["cv2_block_share"]),
          "| open orders + waiting AGVs at the end (stability) | %d |" % fr["backlog_end"], "",
          "CV1 occupancy distribution (0..6 crates): " + ", ".join("%.1f %%" % (100 * x) for x in fr["occ1_hist"]), "",
          "CV2 occupancy distribution (0..6 crates): " + ", ".join("%.1f %%" % (100 * x) for x in fr["occ2_hist"]), "",
          "## 3 Assembly carrier line", "",
          "Products %.1f /h average, %.1f /h design (peak %.1f). Loop %.0f m (department widths ASY %.1f, TST %.1f, PNT %.1f, PCK %.1f, SHP %.1f m), transit %.1f min." % (
              asy["lam_avg_h"], asy["lam_h"], d["assembly"]["peak_factor"], asy["loop_m"], *asy["widths"].values(), asy["t_loop_min"]), "",
          "| Group | stations c | t min/unit | rho | Erlang C | W_q min | queue places (P <= %.0f %%) |" % (100 * d["assembly"]["queue_p"]), "|---|---|---|---|---|---|---|"]
    for g in asy["groups"]:
        L.append("| %s | %d | %.1f | %.2f | %.3f | %.2f | %d |" % (g["type"], g["c"], g["t_min"], g["rho"], g["C"], g["Wq_min"], g["queue_places"]))
    L += ["", "Flow time per product %.1f min -> Little: %.1f carriers in the system -> **%d carriers** (+%.0f %% spare); physical places on loop + spurs + queues: %d." % (
        asy["flow_min"], asy["little"], asy["carriers"], 100 * d["assembly"]["spare_share"], asy["places"]), "",
          "## 4 Module list (input of F4.2), I/O estimate (input of F4.5), cost", "",
          "| Module | qty | EUR each | EUR | where |", "|---|---|---|---|---|"]
    for r in R["modules"]:
        L.append("| %s | %s | %s | %.0f | %s |" % tuple(r))
    L += ["", "Total **%.0f EUR** against the F2 placeholder %d EUR (%.0f %%). I/O estimate: DI %d, DO %d, AI %d." % (
        R["cost"], d["budget_F2_EUR"], 100 * R["cost"] / d["budget_F2_EUR"], R["io"]["DI"], R["io"]["DO"], R["io"]["AI"]), ""]
    return "\n".join(L)


def cmd_run(d):
    out = os.path.join(HERE, "out")
    os.makedirs(out, exist_ok=True)
    R = build(d)
    with open(os.path.join(out, "system_report.md"), "w", encoding="utf-8") as fh:
        fh.write(report(d, R))

    def wcsv(name, head, rows):
        with open(os.path.join(out, name), "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(head)
            w.writerows(rows)
    wcsv("stations.csv", ["dept", "T_month", "lam_peak_h", "kind", "line_side", "in_places", "out_places", "lanes"],
         [[s["dept"], round(s["T_month"]), round(s["lam_in_h"], 2), s["kind"], s["line_side"], s.get("in_places", ""), s.get("out_places", ""), s["lanes"]] for s in R["stations"]])
    F = d["asrs_front"]
    wcsv("zones.csv", ["zone", "line", "type", "x_m", "y_m", "function"], [[z[0], ln, z[1], z[2], z[3], z[4]] for ln in ("CV1", "CV2", "CV3") for z in F[ln]])
    wcsv("modules.csv", ["module", "qty", "EUR_each", "EUR", "where"], R["modules"])
    fr = R["front"]
    wcsv("des_asrs_front.csv", ["quantity", "value"], [[k, v if not isinstance(v, float) else round(v, 4)] for k, v in fr.items() if not k.endswith("hist")])
    with open(os.path.join(out, "asrs_front_layout.svg"), "w", encoding="utf-8") as fh:
        fh.write(svg_front(d))
    with open(os.path.join(out, "system_overview.svg"), "w", encoding="utf-8") as fh:
        fh.write(svg_overview(d, R["I"], R["stations"], R["asy"]))
    res = {"version": d["version"], "stations": R["stations"], "line_side": R["line_side"], "front": {k: v for k, v in fr.items()},
           "assembly": {k: v for k, v in R["asy"].items()}, "modules": R["modules"], "cost_EUR": R["cost"], "io": R["io"],
           "asrs_front_zones": {ln: F[ln] for ln in ("CV1", "CV2", "CV3")}, "conveyor": d["conveyor"], "crate": d["crate"]}
    with open(os.path.join(out, "design_result.json"), "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1)
    print(report(d, R))
    print("written to", out)


# ============================================================================= 8 self-test
def selftest(d):
    res = []

    def ck(n, c):
        res.append(bool(c))
        print(("PASS " if c else "FAIL ") + n)

    I = inputs()
    # Poisson rule against a hand value: mean 1.0, p 1 % -> P(N>3) = 1.9 %, P(N>4) = 0.37 % -> 4
    ck("Poisson rule: mean 1.0, p 1 %% -> 4 places", poisson_places(1.0, 0.01) == 4)
    ck("Poisson rule: mean 0 -> 0 places", poisson_places(0.0, 0.01) == 0)
    st, ls, ls_f3 = departments(d, I)
    kinds = {s["dept"]: s["kind"] for s in st}
    ck("RAW = AS/RS front, TOOL/CHIP = floor stations, assembly line flows excluded", kinds.get("RAW") == "ASRS_FRONT"
       and kinds.get("TOOL") == "FLOOR" and kinds.get("CHIP") == "FLOOR" and "TST" not in kinds and "PNT" not in kinds)
    ck("PD stations for HMC, VMC, ROT, FIN, QC, ASY, BUY", all(kinds.get(k) == "PD" for k in ("HMC", "VMC", "ROT", "FIN", "QC", "ASY", "BUY")))
    ck("flow balance: sum of department totals = 2 x crate flows", abs(sum(s["T_month"] for s in st) - 2 * sum(
        v for (a, b), v in I["flows"].items() if not (a in d["assembly_line_depts"] and b in d["assembly_line_depts"]) and [a, b] not in d["non_crate_pairs"])) < 1e-6)
    ck("line-side crates: F3 = 42, refined = %d (one RB variant), HMC %d / VMC %d / ROT %d" % (sum(ls.values()), ls.get("HMC", 0), ls.get("VMC", 0), ls.get("ROT", 0)),
       ls_f3 == 42 and sum(ls.values()) == 28)
    s_vmc = [s for s in st if s["dept"] == "VMC"][0]
    ck("VMC inbound lane = 13 line-side + queue places", s_vmc["in_places"] == 13 + s_vmc["in_queue"])
    # DES
    fr = run_front(d, I, hours=120)
    ck("DES: crane moves %.1f/h = demand %.1f/h (stable, no backlog growth)" % (fr["moves_h"], 2 * fr["lam_in_h"] + 2 * fr["lam_kit_h"]),
       abs(fr["moves_h"] - (2 * fr["lam_in_h"] + 2 * fr["lam_kit_h"])) / fr["moves_h"] < 0.08 and fr["backlog_end"] < 15)
    ck("DES: crane utilisation %.0f %% between 35 and 60 %% (F3: 47 %%)" % (100 * fr["crane_util"]), 0.35 < fr["crane_util"] < 0.6)
    ck("DES: AGV wait p95 %.0f s <= 60 s with 6 places on CV1" % fr["agv_wait_p95_s"], fr["agv_wait_p95_s"] <= 60)
    ck("DES: kit visits and rejects pass through Z31 (no deadlock): %.1f kit/h, %.2f rejects/h" % (fr["kit_h"], fr["rejects_h"]),
       abs(fr["kit_h"] - fr["lam_kit_h"]) / fr["lam_kit_h"] < 0.2 and fr["rejects_h"] > 0)
    st2 = run_front(d, I, hours=60, factor=1.6)
    ck("DES stress x1.6 (= 2.56 x average): still no deadlock, crane util %.0f %%" % (100 * st2["crane_util"]), st2["kit_h"] > 0 and st2["moves_h"] > fr["moves_h"])
    slow = run_front(d, I, hours=60, agv=900)
    ck("DES: slow AGVs (15 min) fill CV2 (p99 %d) - shows why F5 must meet the 4 min pick-up" % slow["occ2_p99"], slow["occ2_p99"] >= fr["occ2_p99"])
    # Erlang C hand check: c = 1 -> C = rho (M/M/1)
    C1, r1 = erlang_c(1, 0.5)
    ck("Erlang C: c = 1 gives C = rho (M/M/1)", abs(C1 - 0.5) < 1e-12)
    C2, _ = erlang_c(2, 1.0)
    ck("Erlang C: c = 2, a = 1 -> 1/3 (textbook value)", abs(C2 - 1 / 3.0) < 1e-12)
    asy = assembly(d, I)
    ck("assembly: utilisations < 1 (ASSY %.2f, TEST %.2f)" % (asy["groups"][0]["rho"], asy["groups"][1]["rho"]), all(g["rho"] < 1 for g in asy["groups"]))
    ck("assembly: %d carriers fit into %d physical places" % (asy["carriers"], asy["places"]), asy["carriers"] <= asy["places"])
    ck("assembly: Little check carriers >= lambda x flow time", asy["carriers"] >= asy["lam_h"] * asy["flow_min"] / 60.0)
    mrows, cost, io = modules(d, st, asy)
    n = {r[0]: r[1] for r in mrows}
    ck("AS/RS front modules: 9 CC + 3 TU (TU1 check, TU2 + TU3 pick-up) + 1 RCX", n.get("CC") == 9 and n.get("TU") == 3 and n.get("RCX") == 1)
    raw = [s_ for s_ in st if s_["dept"] == "RAW"][0]["T_month"]
    mv = I["r3"]["moves"]
    agv3 = mv["raw_month"] + mv["kit_month"] - 2 * mv["batches_month"] * 10 + mv["batches_month"] * 0
    ck("AS/RS front sized conservatively: F3 crane-side AGV moves %.0f/month >= department crate flows at RAW %.0f/month (difference = receiving infeed + empty crates)" % (agv3, raw), agv3 >= raw)
    ck("cost %.0f EUR within +-40 %% of the F2 placeholder 450 kEUR" % cost, 0.6 * d["budget_F2_EUR"] <= cost <= 1.4 * d["budget_F2_EUR"])
    ck("SVG drawings are well-formed XML", all(__import__("xml.dom.minidom").dom.minidom.parseString(s) for s in (svg_front(d), svg_overview(d, I, st, asy))))
    print("\n%d/%d checks passed" % (sum(res), len(res)))
    return all(res)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sp = ap.add_subparsers(dest="cmd")
    sp.add_parser("selftest")
    sp.add_parser("run")
    q = sp.add_parser("des"); q.add_argument("--hours", type=float, default=200); q.add_argument("--agv", type=float, default=None)
    a = ap.parse_args(argv)
    d = load()
    if a.cmd == "selftest":
        sys.exit(0 if selftest(d) else 1)
    elif a.cmd == "run":
        cmd_run(d)
    elif a.cmd == "des":
        r = run_front(d, inputs(), hours=a.hours, agv=a.agv)
        for k, v in r.items():
            print(k, v)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
