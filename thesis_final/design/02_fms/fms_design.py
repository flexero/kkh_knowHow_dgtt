#!/usr/bin/env python3
"""Final thesis item F2 - production programme -> optimised combined FMS (VC20 compressor + Roots blowers).

Python 3 standard library only, offline. Data: fms_data.json + the F1 routings (../01_products/products.py).
Guide: Doctor paper/59_final_fms_design.md

Commands
  python fms_design.py selftest          method checks (max-flow, B&B = brute force, MVA = closed form, DES ~ MVA, layout)
  python fms_design.py run [--out out]   full design: loads, machines, combined vs separate, ramp stages, HMC cell
                                         (MVA + DES), robustness, layout, AGV estimate, investment -> report.md, CSV, SVG
  python fms_design.py loads             machine-type loads per month (with alternatives and set-ups)
  python fms_design.py machines          optimal machine counts (branch and bound + max-flow)
  python fms_design.py cell              HMC pallet cell: pallets per fixture type, load stations, MVA + DES
  python fms_design.py --scale 1.2 run   same with all demands x 1.2 (what-if); --data other.json for another programme

Method (chapter numbers of guide 59)
  4  load L_g = sum_i q_i t_ig + sum_i ceil(q_i/lot_i) s_g  for each routing group g = set of allowed machine types
  5  capacity per machine c_t = H*60*OEE_t*u_max ; choose integer counts m_t minimising annual cost
       C = sum_t m_t (price_t (CRF + maint) + op_t H 12 w) + energy
     subject to: the routing groups can be served = max-flow(source->groups->types->sink) equals total load
     solved by depth-first branch and bound over the flexible types (cost bound = partial cost + lower bounds)
  7  closed multi-class queueing network (exact MVA recursion, Seidmann multi-server approximation)
       R_rk(n) = D_rk/c_k (1 + Q_k(n - e_r)) + D_rk (c_k - 1)/c_k ;  X_r(n) = n_r / sum_k R_rk(n) ;  Q_k = sum_r X_r R_rk
     validated with a discrete-event simulation of the same cell
  8  Monte Carlo robustness: time factors lognormal(sigma), demand normal(sigma) -> P(capacity sufficient)
  9  spine layout (2 rows along an AGV aisle), cost = sum flow_ij * d_ij, simulated annealing from an SLP start
 10  NPV = -I + sum_t CF_t/(1+i)^t ; CRF = i(1+i)^n/((1+i)^n - 1)
"""

import argparse
import copy
import csv
import heapq
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "01_products"))
import products as P  # noqa: E402  (F1 program: routings, quantities, families)

DATA = os.path.join(HERE, "fms_data.json")
LINE_TYPES = ("ASSY", "TEST", "PAINT", "PACK")


# ----------------------------------------------------------------------------- data
def load_all(path=DATA, scale=1.0):
    with open(path, encoding="utf-8") as fh:
        d = json.load(fh)
    if scale != 1.0:
        d["programme"]["demand_month"] = {k: v * scale for k, v in d["programme"]["demand_month"].items()}
    return d, P.load()


def crf(i, n):
    return i * (1 + i) ** n / ((1 + i) ** n - 1)


def cap_min(d, t, u=None):
    m = d["machines"][t]
    return d["programme"]["H_month"] * 60.0 * m["OEE"] * (d["programme"]["u_max"] if u is None else u)


# ----------------------------------------------------------------------------- 4 loads
def routing(pdata):
    """All routing rows of all variants (F1), with the family of each part."""
    fam = {}
    for p in pdata["products"].values():
        for part in p["parts"]:
            fam[part["id"]] = part["family"]
    rows = []
    for pk, vk, params in P.variants(pdata):
        for r in P.routing_rows(pdata, pk, vk, params):
            r = dict(r)
            r["family"] = fam.get(r["part"], "PRODUCT")
            rows.append(r)
    return rows


def loads(d, rows, frac=1.0, demand=None, timefac=None, products=None):
    """Routing groups {frozenset(types): minutes per month} + per-row detail.
    Set-ups: ceil(q/lot) per part-operation, charged with the set-up time of the primary machine type."""
    dem = demand or d["programme"]["demand_month"]
    groups, detail = {}, []
    for r in rows:
        v = r["variant"]
        if products and v not in products:
            continue
        q = dem.get(v, 0.0) * frac
        if q <= 0:
            continue
        tf = (timefac or {}).get(r["machine"], 1.0)
        run = q * r["qty"] * r["total_s"] / 60.0 * tf
        lots = math.ceil(q / d["programme"]["lot"][v]) if r["part"] != "ASSY" else 0
        setup = lots * d["machines"][r["machine"]]["setup"]
        allowed = frozenset([r["machine"]] + [a for a in r["alt"].split("/") if a])
        groups[allowed] = groups.get(allowed, 0.0) + run + setup
        detail.append((v, r["part"], r["op"], r["machine"], r["alt"], run, setup))
    return groups, detail


# ----------------------------------------------------------------------------- 5 max-flow + branch and bound
def maxflow(groups, caps):
    """Edmonds-Karp on source -> groups -> types -> sink. Returns (flow, {(group, type): minutes})."""
    gl = list(groups)
    types = sorted({t for g in gl for t in g})
    S, T = "S", "T"
    cap = {}
    adj = {}

    def edge(a, b, c):
        cap[(a, b)] = cap.get((a, b), 0.0) + c
        cap.setdefault((b, a), 0.0)
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)

    for i, g in enumerate(gl):
        edge(S, ("g", i), groups[g])
        for t in g:
            edge(("g", i), ("t", t), 1e18)
    for t in types:
        edge(("t", t), T, caps.get(t, 0.0))
    flow = 0.0
    while True:
        par = {S: None}
        q = [S]
        for a in q:
            for b in adj.get(a, ()):
                if b not in par and cap[(a, b)] > 1e-9:
                    par[b] = a
                    q.append(b)
            if T in par:
                break
        if T not in par:
            break
        b, f = T, float("inf")
        while par[b] is not None:
            f = min(f, cap[(par[b], b)]); b = par[b]
        b = T
        while par[b] is not None:
            a = par[b]; cap[(a, b)] -= f; cap[(b, a)] += f; b = a
        flow += f
    assign = {}
    for i, g in enumerate(gl):
        for t in g:
            used = cap[(("t", t), ("g", i))]
            if used > 1e-6:
                assign[(g, t)] = used
    return flow, assign


def annual_cost(d, t, m, load_min=0.0):
    pr = d["programme"]; mc = d["machines"][t]
    cap = pr["H_month"] * 60.0 * mc["OEE"] * m
    util = min(1.0, load_min / cap) if cap else 0.0
    capital = m * mc["price"] * (crf(pr["interest"], pr["years"]) + pr["maintenance_share"])
    labour = m * mc["op"] * pr["H_month"] * 12 * pr["labour_EUR_h"]
    energy = m * mc["kW"] * pr["H_month"] * 12 * pr["energy_EUR_kWh"] * util
    return capital + labour + energy


def feasible(groups, counts, d, u=None):
    caps = {t: counts.get(t, 0) * cap_min(d, t, u) for t in d["machines"] if not t.startswith("_")}
    total = sum(groups.values())
    f, a = maxflow(groups, caps)
    return f >= total - 1e-6 * max(1.0, total), a


def optimise(d, groups, u=None):
    """Integer machine counts with minimum annual cost such that all routing groups fit (max-flow)."""
    types = sorted({t for g in groups for t in g})
    lb, ub = {}, {}
    for t in types:
        only = sum(v for g, v in groups.items() if g == frozenset([t]))
        anyl = sum(v for g, v in groups.items() if t in g)
        c = cap_min(d, t, u)
        lb[t] = max(math.ceil(only / c - 1e-9), d["machines"][t].get("min", 0) if anyl > 0 else 0)
        ub[t] = max(lb[t], math.ceil(anyl / c - 1e-9))
    flex = [t for t in types if ub[t] > lb[t]]
    fixed = {t: lb[t] for t in types if t not in flex}
    # cost of a type at a count (energy with an upper-bound load, harmless for ranking)
    unit = {t: annual_cost(d, t, 1, 0.0) for t in types}
    best = {"cost": float("inf"), "counts": None, "nodes": 0}

    def dfs(i, counts, cost):
        best["nodes"] += 1
        bound = cost + sum(lb[t] * unit[t] for t in flex[i:])
        if bound >= best["cost"] - 1e-6:
            return
        if i == len(flex):
            ok, _ = feasible(groups, counts, d, u)
            if ok:
                best["cost"], best["counts"] = cost, dict(counts)
            return
        t = flex[i]
        for m in range(lb[t], ub[t] + 1):
            counts[t] = m
            dfs(i + 1, counts, cost + m * unit[t])
        del counts[t]

    start = dict(fixed)
    dfs(0, start, sum(fixed[t] * unit[t] for t in fixed))
    counts = best["counts"]
    ok, assign = feasible(groups, counts, d, u)
    tl = {}
    for (g, t), v in assign.items():
        tl[t] = tl.get(t, 0.0) + v
    cost = sum(annual_cost(d, t, counts[t], tl.get(t, 0.0)) for t in counts)
    return {"counts": counts, "assign": assign, "type_load": tl, "cost": cost, "lb": lb, "ub": ub, "flex": flex,
            "nodes": best["nodes"]}


def brute_force(d, groups, u=None):
    """Reference for the self-test: full enumeration of the same problem."""
    import itertools
    sol = optimise(d, groups, u)
    types = sorted(sol["lb"])
    unit = {t: annual_cost(d, t, 1, 0.0) for t in types}
    best = (float("inf"), None)
    for combo in itertools.product(*[range(sol["lb"][t], sol["ub"][t] + 1) for t in types]):
        c = dict(zip(types, combo))
        cost = sum(c[t] * unit[t] for t in types)
        if cost < best[0] and feasible(groups, c, d, u)[0]:
            best = (cost, c)
    return best


# ----------------------------------------------------------------------------- 7 queueing network (MVA) + DES
def mva(classes, stations, N):
    """Exact multi-class MVA with Seidmann's multi-server approximation.
    classes: list of names; stations: {k: (servers, {r: demand})}; N: {r: population}.
    Returns X {r: throughput per minute}, R {r: cycle time}, U {k: utilisation}, Q {k: mean number}."""
    import itertools
    rs = list(classes)
    Q = {tuple(0 for _ in rs): {k: 0.0 for k in stations}}
    order = sorted(itertools.product(*[range(N[r] + 1) for r in rs]), key=sum)
    X = {}
    for n in order:
        if sum(n) == 0:
            continue
        Rk = {}
        Xn = {}
        for j, r in enumerate(rs):
            if n[j] == 0:
                continue
            prev = list(n); prev[j] -= 1
            qp = Q[tuple(prev)]
            tot = 0.0
            for k, (c, dem) in stations.items():
                D = dem.get(r, 0.0)
                rk = D / c * (1 + qp[k]) + D * (c - 1) / c
                Rk[(r, k)] = rk
                tot += rk
            Xn[r] = n[j] / tot if tot > 0 else 0.0
        Q[n] = {k: sum(Xn.get(r, 0.0) * (Rk.get((r, k), 0.0) - stations[k][1].get(r, 0.0) * (stations[k][0] - 1) / stations[k][0])
                       for r in rs) for k in stations}
        X = Xn
        Rlast = Rk
    full = tuple(N[r] for r in rs)
    R = {r: sum(v for (rr, k), v in Rlast.items() if rr == r) for r in rs if N[r] > 0}
    U = {k: sum(X.get(r, 0.0) * stations[k][1].get(r, 0.0) for r in rs) / stations[k][0] for k in stations}
    return {"X": X, "R": R, "U": U, "Q": Q[full]}


def lognorm(rng, mean, cv):
    if mean <= 0:
        return 0.0
    if cv is None:
        return rng.expovariate(1.0 / mean)
    s2 = math.log(1 + cv * cv)
    return rng.lognormvariate(math.log(mean) - s2 / 2, math.sqrt(s2))


def des_cell(stations, route, N, hours, warmup, cv, seed):
    """Closed network DES. stations {k: servers}; route: list of station names visited in a cycle;
    N {class: pallets}; cv(k) -> coefficient of variation (None = exponential); demand(r,k) in minutes.
    Returns throughput per minute per class (completions at the last machine station after warm-up)."""
    rng = random.Random(seed)
    srv, dem = stations
    busy = {k: 0 for k in srv}
    queue = {k: [] for k in srv}
    ev = []
    seq = 0
    done = {r: 0 for r in N}
    tend = hours * 60.0
    twarm = warmup * 60.0
    busy_time = {k: 0.0 for k in srv}

    def start(k, r, pid, t):
        nonlocal seq
        busy[k] += 1
        st = lognorm(rng, dem[r].get(k, 0.0), cv(k))
        if t >= twarm:
            busy_time[k] += st
        seq += 1
        heapq.heappush(ev, (t + st, seq, k, r, pid))

    def arrive(k, r, pid, t):
        if busy[k] < srv[k]:
            start(k, r, pid, t)
        else:
            queue[k].append((r, pid))

    pos = {}
    pid = 0
    for r, n in N.items():
        for _ in range(n):
            pos[pid] = 0
            arrive(route[0], r, pid, 0.0)
            pid += 1
    while ev:
        t, _, k, r, p = heapq.heappop(ev)
        if t > tend:
            break
        busy[k] -= 1
        if queue[k]:
            r2, p2 = queue[k].pop(0)
            start(k, r2, p2, t)
        if k == "HMC" and t >= twarm:
            done[r] += 1
        pos[p] = (pos[p] + 1) % len(route)
        arrive(route[pos[p]], r, p, t)
    span = tend - twarm
    return {r: done[r] / span for r in N}, {k: busy_time[k] / span / srv[k] for k in srv}


def cell_model(d, pdata, n_hmc, n_ls, frac=1.0):
    """Station demands per visit (minutes) for the HMC pallet cell, from the F1 routings."""
    pr = d["programme"]; hc = d["hmc_cell"]
    oee = d["machines"]["HMC"]["OEE"]
    dem, target = {}, {}
    for cname, c in hc["classes"].items():
        tot_q = sum(pr["demand_month"].get(v, 0) for v in c["products"]) * frac
        hmc = ls = 0.0
        for v in c["products"]:
            q = pr["demand_month"].get(v, 0) * frac
            if q == 0:
                continue
            pk = "VC20" if v.startswith("VC") else "RB"
            params = pdata["products"][pk]["variants"][v]
            mm = P.machine_minutes(pdata, pk, v, params)
            # only the tombstone parts of this fixture class are on the pallet (HMC rows of P-L / kit parts)
            rows = [r for r in P.routing_rows(pdata, pk, v, params) if r["machine"] == "HMC"]
            on_pal = [r for r in rows if r["part"] in pal_parts(cname)]
            hmc += q * sum(r["total_s"] * r["qty"] for r in on_pal) / 60.0
            ls += q * sum(r["load_s"] * r["qty"] for r in on_pal) / 60.0
            del mm
        dem[cname] = {"LS": ls / tot_q if tot_q else 0.0, "TR": hc["transport_min_per_visit"],
                      "HMC": hmc / tot_q / oee if tot_q else 0.0}
        target[cname] = tot_q / (pr["H_month"] * 60.0)
    stations = {"LS": (n_ls, {r: dem[r]["LS"] for r in dem}), "TR": (1, {r: dem[r]["TR"] for r in dem}),
                "HMC": (n_hmc, {r: dem[r]["HMC"] for r in dem})}
    return stations, dem, target


def pal_parts(cname):
    return {"FA": ("C01",), "FC": ("R01", "R02", "R03")}[cname]


def pallet_search(d, pdata, n_hmc, frac=1.0, nmax=16):
    """Minimum fixture cost (pallets per class) and load stations (1 or 2) meeting the target throughput (MVA)."""
    hc = d["hmc_cell"]
    best = None
    curves = {}
    for n_ls in (1, 2):
        stations, dem, target = cell_model(d, pdata, n_hmc, n_ls, frac)
        cls = [c for c in dem if target[c] > 0]
        for na in range(1, nmax + 1):
            for nc in range(1 if "FC" in cls else 0, nmax + 1):
                N = {"FA": na, "FC": nc}
                N = {c: N[c] for c in cls}
                res = mva(cls, stations, N)
                ok = all(res["X"].get(c, 0) >= target[c] for c in cls)
                if ok:
                    cost = sum(N[c] * (hc["classes"][c]["fixture_EUR"] + hc["pallet_rack_slot_EUR"]) for c in cls) \
                        + n_ls * hc["load_station_EUR"]
                    if best is None or cost < best["cost"]:
                        best = {"cost": cost, "N": N, "n_ls": n_ls, "res": res, "target": target, "dem": dem,
                                "stations": stations}
                    break
    # throughput curve: FA pallets with FC fixed at the optimum, for the report figure
    if best:
        stations = best["stations"]
        for na in range(1, nmax + 1):
            N = dict(best["N"]); N["FA"] = na
            curves[na] = mva(list(N), stations, N)["X"]
    return best, curves


# ----------------------------------------------------------------------------- 8 Monte Carlo robustness
def robustness(d, rows, counts, n=None, add=None):
    mc = d["monte_carlo"]
    rng = random.Random(mc["seed"])
    n = n or mc["n"]
    types = [t for t in d["machines"] if not t.startswith("_")]
    ok = 0
    short = {}
    for _ in range(n):
        tf = {t: rng.lognormvariate(-mc["sigma_time"] ** 2 / 2, mc["sigma_time"]) for t in types}
        dem = {v: q * max(0.0, rng.gauss(1.0, mc["sigma_demand"])) for v, q in d["programme"]["demand_month"].items()}
        g, _ = loads(d, rows, demand=dem, timefac=tf)
        c = dict(counts)
        if add:
            c[add] = c.get(add, 0) + 1
        good, _ = feasible(g, c, d, u=1.0)
        if good:
            ok += 1
        else:
            for t in types:
                if t in c or any(t in gg for gg in g):
                    c2 = dict(c); c2[t] = c2.get(t, 0) + 1
                    if feasible(g, c2, d, u=1.0)[0]:
                        short[t] = short.get(t, 0) + 1
    return ok / n, short


# ----------------------------------------------------------------------------- 9 layout
DEPT_NAMES = {"RAW": "AS/RS raw + receiving", "HMC": "HMC pallet cell", "VMC": "VMC small-part cell",
              "ROT": "Rotational cell", "FIN": "Honing / lapping / washing", "QC": "Measuring room (CMM)",
              "KIT": "AS/RS parts + kitting", "ASY": "Assembly VC20 + RB", "TST": "Test benches",
              "PNT": "Paint", "PCK": "Final inspection + pack", "SHP": "Finished goods + shipping",
              "BUY": "Bought parts, tanks, motors", "TOOL": "Tool room + presetting", "MNT": "Maintenance",
              "CHIP": "Chips + coolant"}


def flows(d, rows, pdata):
    """Unit-load flows per month between departments (parts in crates by family; products singly)."""
    dem = d["programme"]["demand_month"]
    ul = d["layout"]["unit_load"]
    dept = {t: v["dept"] for t, v in d["machines"].items() if not t.startswith("_")}
    F = {}
    alias = d["layout"].get("dept_alias", {})

    def add(a, b, x):
        a, b = alias.get(a, a), alias.get(b, b)
        if a != b and x > 0:
            k = tuple(sorted((a, b)))
            F[k] = F.get(k, 0.0) + x

    seqs = {}
    for r in rows:
        if r["part"] == "ASSY":
            continue
        seqs.setdefault((r["variant"], r["part"]), []).append(r)
    for (v, part), rr in seqs.items():
        q = dem.get(v, 0) * rr[0]["qty"]
        u = ul[rr[0]["family"]]
        path = ["RAW"] + [dept[r["machine"]] for r in rr] + ["KIT"]
        clean = [path[0]]
        for p in path[1:]:
            if p != clean[-1]:
                clean.append(p)
        for a, b in zip(clean, clean[1:]):
            add(a, b, q / u)
    for v, q in dem.items():
        if v.startswith("VC"):
            add("BUY", "ASY", q)          # tank + motor per unit (1 pallet)
        else:
            add("BUY", "ASY", q * 0.5)    # motor + base frame
        add("BUY", "KIT", q / 10.0)       # small bought parts in kit boxes (10 units per box)
    for k in ("HMC", "VMC", "ROT"):
        add("TOOL", k, 400.0)             # tool trolleys per month (design estimate)
        add("CHIP", k, 60.0)              # chip bins per month
    for v, q in dem.items():
        for a, b in (("KIT", "ASY"), ("ASY", "TST"), ("TST", "PNT"), ("PNT", "PCK"), ("PCK", "SHP")):
            add(a, b, q / ul["PRODUCT"])
    return F


def dept_areas(d, counts):
    lay = d["layout"]
    alias = lay.get("dept_alias", {})
    A = {}
    for t, m in counts.items():
        k = alias.get(d["machines"][t]["dept"], d["machines"][t]["dept"])
        A[k] = A.get(k, 0.0) + m * d["machines"][t]["area"] * lay["area_factor"]
    for k, v in lay["extra_depts"].items():
        if v["area"] > 0:
            k2 = alias.get(k, k)
            A[k2] = A.get(k2, 0.0) + v["area"]
    return A


def layout_cost(rowsplit, A, F, lay):
    depth, aisle = lay["row_depth_m"], lay["aisle_m"]
    pos = {}
    for ri, row in enumerate(rowsplit):
        x = 0.0
        for k in row:
            w = A[k] / depth
            pos[k] = (x + w / 2, ri)
            x += w
    c = 0.0
    for (a, b), f in F.items():
        if a in pos and b in pos:
            xa, ra = pos[a]; xb, rb = pos[b]
            c += f * (abs(xa - xb) + (depth + aisle if ra != rb else 0.0))
    for k, f in lay.get("dock_flows", {}).items():      # virtual DOCK node at x = 0 in the aisle
        k = lay.get("dept_alias", {}).get(k, k)
        if k in pos:
            c += f * (pos[k][0] + (depth + aisle) / 2)
    return c, pos


def optimise_layout(d, A, F):
    """Best of several independent simulated-annealing runs (restarts with different seeds)."""
    an = d["layout"]["anneal"]
    best = None
    for k in range(an.get("restarts", 1)):
        dd = copy.deepcopy(d)
        dd["layout"]["anneal"]["seed"] = an["seed"] + 101 * k
        r = _anneal_layout(dd, A, F)
        if best is None or r["cost"] < best["cost"]:
            best = r
    return best


def _anneal_layout(d, A, F):
    """Spine layout: RAW fixed at the start of row 0 (receiving dock), SHP fixed at the start of row 1 (shipping dock,
    same end wall = one truck yard). Moves: swap two free departments or move one to the other row; simulated annealing."""
    lay = d["layout"]; an = lay["anneal"]
    rng = random.Random(an["seed"])
    free = [k for k in A if k not in ("RAW", "SHP")]
    # SLP start: order by the strongest flow chain from RAW, alternate rows
    order = sorted(free, key=lambda k: -sum(f for (a, b), f in F.items() if k in (a, b)))
    rows = [["RAW"], ["SHP"]]
    for i, k in enumerate(order):
        rows[i % 2].append(k)
    cur, _ = layout_cost(rows, A, F, lay)
    start = cur
    best, brows = cur, copy.deepcopy(rows)
    T = an["T0"]
    for it in range(an["iters"]):
        cand = copy.deepcopy(rows)
        if rng.random() < 0.6:
            ra, rb = rng.randrange(2), rng.randrange(2)
            if len(cand[ra]) < 2 or len(cand[rb]) < 2:
                continue
            ia, ib = rng.randrange(1, len(cand[ra])), rng.randrange(1, len(cand[rb]))
            cand[ra][ia], cand[rb][ib] = cand[rb][ib], cand[ra][ia]
        else:
            ra = rng.randrange(2)
            if len(cand[ra]) < 2:
                continue
            k = cand[ra].pop(rng.randrange(1, len(cand[ra])))
            rb = 1 - ra
            cand[rb].insert(rng.randrange(1, len(cand[rb]) + 1), k)
        c, _ = layout_cost(cand, A, F, lay)
        if c < cur or rng.random() < math.exp(-(c - cur) / max(T, 1e-9)):
            rows, cur = cand, c
            if c < best:
                best, brows = c, copy.deepcopy(cand)
        T *= 0.9995
    return {"rows": brows, "cost": best, "start_cost": start}


def layout_svg(d, A, lay_res, path):
    lay = d["layout"]; depth, aisle = lay["row_depth_m"], lay["aisle_m"]
    s = 11.0  # px per m
    L = max(sum(A[k] for k in r) / depth for r in lay_res["rows"])
    W = 2 * depth + aisle
    pw, ph = int(L * s + 80), int(W * s + 130)
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" font-family="Arial" font-size="11">' % (pw, ph, pw, ph),
           '<rect width="100%" height="100%" fill="#fff"/>',
           '<text x="20" y="22" font-size="14" font-weight="bold">Combined FMS - optimised spine layout (%.0f m x %.0f m = %.0f m2)</text>' % (L, W, L * W)]
    x0, y0 = 40, 40
    pal = {"BUY": "#d9e2f3", "TOOL": "#f2f2f2", "MNT": "#f2f2f2", "CHIP": "#f2f2f2", "RAW": "#d9e2f3", "KIT": "#d9e2f3", "SHP": "#d9e2f3", "HMC": "#f8cbad", "VMC": "#fbe5d6", "ROT": "#ffe699",
           "FIN": "#e2efda", "QC": "#e2efda", "ASY": "#deebf7", "TST": "#deebf7", "PNT": "#ededed", "PCK": "#ededed"}
    for ri, row in enumerate(lay_res["rows"]):
        x = 0.0
        y = y0 + (0 if ri == 0 else (depth + aisle) * s)
        for k in row:
            w = A[k] / depth
            out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" stroke="#333"/>' % (
                x0 + x * s, y, w * s, depth * s, pal.get(k, "#eee")))
            if w * s >= 58:
                out.append('<text x="%.1f" y="%.1f" font-weight="bold">%s</text>' % (x0 + x * s + 4, y + 16, k))
                out.append('<text x="%.1f" y="%.1f">%.0f m2</text>' % (x0 + x * s + 4, y + 30, A[k]))
            else:   # narrow department: vertical label
                cx = x0 + (x + w / 2) * s + 4
                out.append('<text x="%.1f" y="%.1f" transform="rotate(-90 %.1f %.1f)" font-weight="bold">%s %.0f m2</text>' % (
                    cx, y + depth * s - 8, cx, y + depth * s - 8, k, A[k]))
            x += w
    ya = y0 + depth * s
    out.append('<rect x="%d" y="%.1f" width="%.1f" height="%.1f" fill="#fafafa" stroke="#999" stroke-dasharray="6 4"/>' % (
        x0, ya, L * s, aisle * s))
    out.append('<text x="%d" y="%.1f" fill="#555">AGV main aisle (%.0f m) - receiving and shipping docks at the left wall</text>' % (
        x0 + 8, ya + aisle * s / 2 + 4, aisle))
    leg = "  ".join("%s=%s" % (k, DEPT_NAMES.get(k, k)) for r in lay_res["rows"] for k in r)
    yl = y0 + W * s + 22
    words, line = leg.split("  "), ""
    maxc = int((pw - 40) / 6.2)
    for w_ in words:
        if len(line) + len(w_) > maxc:
            out.append('<text x="20" y="%d">%s</text>' % (yl, line)); yl += 14; line = ""
        line += w_ + "   "
    out.append('<text x="20" y="%d">%s</text>' % (yl, line))
    out.append("</svg>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out))
    return L, W


def agv_estimate(F, pos, speed=1.0, handling_s=60, avail=0.75, H=330):
    """Unit-load moves by AGV between departments (assembly line flows excluded: conveyor)."""
    line = {("ASY", "TST"), ("PNT", "TST"), ("PCK", "PNT"), ("PCK", "SHP")}
    moves = dist = 0.0
    for (a, b), f in F.items():
        if (a, b) in line or (b, a) in line:
            continue
        xa, ra = pos[a]; xb, rb = pos[b]
        dd = abs(xa - xb) + (28 if ra != rb else 0)
        moves += f
        dist += f * dd * 2  # loaded + empty return
    t_h = (dist / speed + moves * handling_s) / 3600.0
    return {"moves_month": moves, "km_month": dist / 1000, "agv_hours": t_h, "agvs": math.ceil(t_h / (H * avail))}


# ----------------------------------------------------------------------------- SVG chart (throughput vs pallets)
def curve_svg(curves, target, best, path):
    W, H = 640, 380
    ml, mr, mt, mb = 60, 150, 40, 50
    xs = sorted(curves)
    ymax = max(max(v.values()) for v in curves.values()) * 60 * 1.1
    sx = lambda x: ml + (x - xs[0]) / (xs[-1] - xs[0]) * (W - ml - mr)  # noqa: E731
    sy = lambda y: H - mb - y / ymax * (H - mt - mb)  # noqa: E731
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" font-family="Arial" font-size="12">' % (W, H, W, H),
           '<rect width="100%" height="100%" fill="#fff"/>',
           '<text x="%d" y="22" font-size="14" font-weight="bold">HMC cell throughput vs FA pallets (MVA, FC = %d)</text>' % (ml, best["N"].get("FC", 0))]
    for k in range(0, 6):
        y = ymax * k / 5
        out.append('<line x1="%d" x2="%d" y1="%.1f" y2="%.1f" stroke="#e5e5e5"/>' % (ml, W - mr, sy(y), sy(y)))
        out.append('<text x="%d" y="%.1f" text-anchor="end" fill="#555">%.1f</text>' % (ml - 6, sy(y) + 4, y))
    for x in xs:
        out.append('<text x="%.1f" y="%d" text-anchor="middle" fill="#555">%d</text>' % (sx(x), H - mb + 16, x))
    out.append('<text x="%.1f" y="%d" text-anchor="middle" fill="#333">FA pallets (crankcase fixtures)</text>' % ((ml + W - mr) / 2, H - 12))
    out.append('<text x="16" y="%d" fill="#333" transform="rotate(-90 16 %d)">units per hour</text>' % (H / 2 + 30, H / 2 + 30))
    colors = {"FA": "#2a6fbb", "FC": "#d4762c"}
    for c, col in colors.items():
        pts = [(sx(x), sy(curves[x].get(c, 0) * 60)) for x in xs if c in curves[x]]
        if not pts:
            continue
        out.append('<polyline fill="none" stroke="%s" stroke-width="2" points="%s"/>' % (col, " ".join("%.1f,%.1f" % p for p in pts)))
        for p in pts:
            out.append('<circle cx="%.1f" cy="%.1f" r="4" fill="%s" stroke="#fff" stroke-width="2"/>' % (p[0], p[1], col))
        ty = sy(target[c] * 60)
        out.append('<line x1="%d" x2="%d" y1="%.1f" y2="%.1f" stroke="%s" stroke-dasharray="5 4"/>' % (ml, W - mr, ty, ty, col))
        lab = "VC20 crankcase (FA)" if c == "FA" else "Roots kit (FC)"
        out.append('<text x="%d" y="%.1f" fill="#222">%s</text>' % (W - mr + 8, pts[-1][1] + (4 if c == "FA" else -10), lab))
        out.append('<text x="%d" y="%.1f" fill="#555">target %s %.2f/h</text>' % (W - mr - 120, ty - 5, c, target[c] * 60))
    bx = sx(best["N"]["FA"])
    out.append('<line x1="%.1f" x2="%.1f" y1="%d" y2="%d" stroke="#888"/>' % (bx, bx, mt, H - mb))
    out.append('<text x="%.1f" y="%d" fill="#333">chosen %d</text>' % (bx + 4, mt + 12, best["N"]["FA"]))
    out.append("</svg>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out))


# ----------------------------------------------------------------------------- 10 investment + NPV
def economics(d, counts, cell, area_m2, building_EUR_m2=450.0):
    pr = d["programme"]
    mach = sum(d["machines"][t]["price"] * m for t, m in counts.items())
    hc = d["hmc_cell"]
    fix = sum(cell["N"][c] * (hc["classes"][c]["fixture_EUR"] + hc["pallet_rack_slot_EUR"]) for c in cell["N"])
    ls = cell["n_ls"] * hc["load_station_EUR"]
    bld = area_m2 * building_EUR_m2
    other = sum(pr["other_investment"].values())
    contrib = {v: pr["price"][v] * (1 - pr["variable_share"]) - pr["material_EUR"][v] for v in pr["demand_month"]}
    material_m = sum(pr["demand_month"][v] * pr["material_EUR"][v] for v in pr["demand_month"])
    wc = pr["working_capital_months"] * material_m
    inv = mach + fix + ls + bld + other + wc
    contrib_m = sum(pr["demand_month"][v] * contrib[v] for v in pr["demand_month"])
    labour_m = sum(d["machines"][t]["op"] * m for t, m in counts.items()) * pr["H_month"] * pr["labour_EUR_h"] \
        + cell["n_ls"] * pr["H_month"] * pr["labour_EUR_h"]
    maint_m = mach * pr["maintenance_share"] / 12
    i = pr["interest"]
    ramp = pr["ramp"]
    npv = -inv
    cum = -inv
    payback = None
    for y in range(1, pr["years"] + 1):
        f = sum(ramp) / len(ramp) if y == 1 else 1.0
        cf = 12 * (contrib_m * f - labour_m - maint_m - pr["fixed_overhead_month"])
        npv += cf / (1 + i) ** y
        if payback is None and cum + cf >= 0:
            payback = y - 1 + (-cum) / cf
        cum += cf
    return {"machines": mach, "fixtures": fix, "load_stations": ls, "building": bld, "other": other, "wc": wc,
            "contrib_unit": contrib, "investment": inv, "overhead_month": pr["fixed_overhead_month"],
            "contribution_month": contrib_m, "labour_month": labour_m, "maint_month": maint_m, "npv": npv,
            "payback_years": payback}


# ----------------------------------------------------------------------------- commands
def fmt_counts(c):
    return ", ".join("%s %d" % (t, m) for t, m in sorted(c.items()) if m)


def cmd_loads(d, rows):
    g, det = loads(d, rows)
    print("%-28s %12s %10s" % ("routing group (allowed types)", "min/month", "h/month"))
    for k, v in sorted(g.items(), key=lambda kv: -kv[1]):
        print("%-28s %12.0f %10.1f" % ("/".join(sorted(k)), v, v / 60))
    print("total %.0f h per month" % (sum(g.values()) / 60))
    return g


def cmd_machines(d, rows, quiet=False):
    g, _ = loads(d, rows)
    sol = optimise(d, g)
    if not quiet:
        print("optimal counts:", fmt_counts(sol["counts"]))
        print("annual cost %.0f EUR; B&B nodes %d; flexible types %s" % (sol["cost"], sol["nodes"], sol["flex"]))
        for t in sorted(sol["counts"]):
            m = sol["counts"][t]
            if m:
                print("  %-6s %d  load %7.1f h  capacity %7.1f h  utilisation %5.1f %% (of H x OEE)" % (
                    t, m, sol["type_load"].get(t, 0) / 60, m * cap_min(d, t, 1.0) / 60,
                    100 * sol["type_load"].get(t, 0) / (m * cap_min(d, t, 1.0))))
    return g, sol


def cmd_cell(d, pdata, n_hmc, quiet=False):
    best, curves = pallet_search(d, pdata, n_hmc)
    st = best["stations"]
    des = d["hmc_cell"]["des"]
    srv = {k: v[0] for k, v in st.items()}
    dem = {r: {k: st[k][1][r] * (0.5 if k == "TR" else 1.0) for k in st} for r in best["N"]}  # 2 transport legs per cycle
    cvf = lambda k: des["cv_load"] if k == "LS" else (des["cv_machining"] if k == "HMC" else 0.2)  # noqa: E731
    hc = d["hmc_cell"]
    best["N_mva"] = dict(best["N"])
    for _ in range(12):                      # MVA finds the minimum; DES verifies (class-dependent FCFS is not product form)
        Xd, Ud = des_cell((srv, dem), ["LS", "TR", "HMC", "TR"], best["N"], des["hours"], des["warmup"], cvf, des["seed"])
        short = [c for c in best["N"] if Xd[c] < best["target"][c]]
        if not short:
            break
        worst = min(short, key=lambda c: Xd[c] / best["target"][c])
        best["N"][worst] += 1
    best["cost"] = sum(best["N"][c] * (hc["classes"][c]["fixture_EUR"] + hc["pallet_rack_slot_EUR"]) for c in best["N"]) \
        + best["n_ls"] * hc["load_station_EUR"]
    best["res"] = mva(list(best["N"]), st, best["N"])
    best["des_X"], best["des_U"] = Xd, Ud
    if not quiet:
        print("HMC cell: %d HMC, %d load station(s), pallets %s, fixture+LS cost %.0f EUR" % (
            n_hmc, best["n_ls"], best["N"], best["cost"]))
        for c in best["N"]:
            print("  %s: demand/visit LS %.2f  TR %.2f  HMC %.2f min (incl. 1/OEE); target %.2f/h; MVA %.2f/h; DES %.2f/h" % (
                c, best["dem"][c]["LS"], best["dem"][c]["TR"], best["dem"][c]["HMC"], best["target"][c] * 60,
                best["res"]["X"][c] * 60, Xd[c] * 60))
        print("  utilisation MVA: " + ", ".join("%s %.0f %%" % (k, 100 * v) for k, v in best["res"]["U"].items()))
        print("  utilisation DES: " + ", ".join("%s %.0f %%" % (k, 100 * v) for k, v in Ud.items()))
    return best, curves


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        for r in rows:
            w.writerow(r)


def cmd_run(d, pdata, out):
    os.makedirs(out, exist_ok=True)
    rows = routing(pdata)
    rep = ["# F2 combined FMS - generated design report", "",
           "Generated by `fms_design.py run` (%s). Programme: %s per month, H = %d h/month, u_max = %.2f. "
           "Prices = reference estimates." % (d["version"], ", ".join("%s %g" % kv for kv in d["programme"]["demand_month"].items()),
                                             d["programme"]["H_month"], d["programme"]["u_max"]), ""]
    g, sol = cmd_machines(d, rows, quiet=True)
    rep += ["## 1 Loads per routing group (machine hours per month)", "", "| Allowed machine types | h/month |", "|---|---|"]
    rep += ["| %s | %.1f |" % ("/".join(sorted(k)), v / 60) for k, v in sorted(g.items(), key=lambda kv: -kv[1])]
    rep += ["", "## 2 Optimal machine counts (branch and bound + max-flow)", "",
            "| Type | Count | Load h | Capacity h (H x OEE) | Utilisation | Price each EUR |", "|---|---|---|---|---|---|"]
    mrows = [["type", "count", "load_h", "capacity_h", "utilisation", "price_EUR"]]
    for t in sorted(sol["counts"]):
        m = sol["counts"][t]
        if not m:
            continue
        L = sol["type_load"].get(t, 0) / 60; C = m * cap_min(d, t, 1.0) / 60
        rep.append("| %s | %d | %.1f | %.1f | %.1f %% | %d |" % (t, m, L, C, 100 * L / C, d["machines"][t]["price"]))
        mrows.append([t, m, round(L, 1), round(C, 1), round(L / C, 3), d["machines"][t]["price"]])
    write_csv(os.path.join(out, "machines.csv"), mrows)
    moved = [(g_, t, v) for (g_, t), v in sol["assign"].items() if len(g_) > 1 and v > 1]
    rep += ["", "Routing groups with alternatives - where the optimiser put the load:", ""]
    rep += ["- %s -> %s: %.1f h/month" % ("/".join(sorted(g_)), t, v / 60) for g_, t, v in sorted(moved, key=lambda x: -x[2])]
    rep.append("\nAnnual cost (capital recovery + maintenance + operators + energy): **%.0f EUR**; B&B nodes %d." % (sol["cost"], sol["nodes"]))
    # combined vs separate
    gv, _ = loads(d, rows, products=["VC20"])
    gr, _ = loads(d, rows, products=["RB50", "RB100", "RB150"])
    sv, sr = optimise(d, gv), optimise(d, gr)
    inv = lambda c: sum(d["machines"][t]["price"] * m for t, m in c.items())  # noqa: E731
    comb = {"inv": inv(sol["counts"]), "cost": sol["cost"], "n": sum(sol["counts"].values())}
    sep = {"inv": inv(sv["counts"]) + inv(sr["counts"]), "cost": sv["cost"] + sr["cost"],
           "n": sum(sv["counts"].values()) + sum(sr["counts"].values())}
    rep += ["", "## 3 Combined factory vs two separate factories", "",
            "| Design | Machines | Machine investment EUR | Annual cost EUR |", "|---|---|---|---|",
            "| VC20 alone | %d | %.0f | %.0f |" % (sum(sv["counts"].values()), inv(sv["counts"]), sv["cost"]),
            "| RB alone | %d | %.0f | %.0f |" % (sum(sr["counts"].values()), inv(sr["counts"]), sr["cost"]),
            "| **Two separate factories** | %d | %.0f | %.0f |" % (sep["n"], sep["inv"], sep["cost"]),
            "| **Combined FMS** | %d | %.0f | %.0f |" % (comb["n"], comb["inv"], comb["cost"]),
            "| Saving of combining | %d | %.0f (%.1f %%) | %.0f (%.1f %%) |" % (
                sep["n"] - comb["n"], sep["inv"] - comb["inv"], 100 * (sep["inv"] - comb["inv"]) / sep["inv"],
                sep["cost"] - comb["cost"], 100 * (sep["cost"] - comb["cost"]) / sep["cost"]),
            "", "VC20 alone: " + fmt_counts(sv["counts"]), "", "RB alone: " + fmt_counts(sr["counts"])]
    # ramp stages
    rep += ["", "## 4 Ramp-up stages (purchase plan)", "", "| Stage | Volume | Counts | Machines to add |", "|---|---|---|---|"]
    have = {}
    for f in d["programme"]["ramp"]:
        gs, _ = loads(d, rows, frac=f)
        s = optimise(d, gs)
        add = {t: max(0, m - have.get(t, 0)) for t, m in s["counts"].items()}
        for t, m in s["counts"].items():
            have[t] = max(have.get(t, 0), m)
        rep.append("| %.0f %% | VC20 %.0f, RB %.0f | %s | %s |" % (
            100 * f, f * d["programme"]["demand_month"]["VC20"],
            f * sum(v for k, v in d["programme"]["demand_month"].items() if k.startswith("RB")),
            fmt_counts(s["counts"]), fmt_counts(add) or "-"))
    # HMC cell
    best, curves = cmd_cell(d, pdata, sol["counts"]["HMC"], quiet=True)
    rep += ["", "## 5 HMC pallet cell (closed queueing network, MVA + DES)", "",
            "%d HMCs, **%d load station(s)**, pallets **%s** (MVA minimum %s, raised until the DES meets the target); fixtures + rack slots + load stations %.0f EUR." % (
                sol["counts"]["HMC"], best["n_ls"], ", ".join("%s %d" % kv for kv in best["N"].items()),
                ", ".join("%s %d" % kv for kv in best["N_mva"].items()), best["cost"]), "",
            "| Class | LS min/visit | Transport | HMC min/visit (/OEE) | Target /h | MVA /h | DES /h |", "|---|---|---|---|---|---|---|"]
    for c in best["N"]:
        rep.append("| %s | %.2f | %.2f | %.2f | %.2f | %.2f | %.2f |" % (
            c, best["dem"][c]["LS"], best["dem"][c]["TR"], best["dem"][c]["HMC"], best["target"][c] * 60,
            best["res"]["X"][c] * 60, best["des_X"][c] * 60))
    rep.append("\nUtilisation MVA: " + ", ".join("%s %.0f %%" % (k, 100 * v) for k, v in best["res"]["U"].items()) +
               "; DES: " + ", ".join("%s %.0f %%" % (k, 100 * v) for k, v in best["des_U"].items()))
    curve_svg(curves, best["target"], best, os.path.join(out, "cell_throughput.svg"))
    # robustness
    p0, short = robustness(d, rows, sol["counts"])
    worst = max(short, key=short.get) if short else None
    sol_r = dict(sol["counts"])
    rep += ["", "## 6 Robustness (Monte Carlo, %d samples: times lognormal sigma %.2f per type, demand sigma %.2f)" % (
        d["monte_carlo"]["n"], d["monte_carlo"]["sigma_time"], d["monte_carlo"]["sigma_demand"]), "",
        "P(capacity sufficient at OEE, without u_max reserve) = **%.1f %%**." % (100 * p0)]
    if worst:
        p1, _ = robustness(d, rows, sol["counts"], add=worst)
        rep.append("Most frequent relief machine: %s (would cure %d of the failures); with +1 %s: **%.1f %%**." % (
            worst, short[worst], worst, 100 * p1))
        rep.append("Relief counts: " + ", ".join("%s %d" % kv for kv in sorted(short.items(), key=lambda kv: -kv[1])))
    robust = dict(sol["counts"])
    p, steps = p0, []
    while p < d["programme"]["p_target"] and len(steps) < 8:
        _, sh = robustness(d, rows, robust)
        if not sh:
            break
        t = max(sh, key=lambda k: sh[k] / d["machines"][k]["price"])   # most failures cured per EUR
        robust[t] = robust.get(t, 0) + 1
        p, _ = robustness(d, rows, robust)
        steps.append((t, p))
    extra = sum(d["machines"][t]["price"] for t, _ in steps)
    rep += ["", "**Robust design** (add the machine that cures most failures per EUR until P >= %.0f %%):" % (100 * d["programme"]["p_target"]), ""]
    rep += ["- +1 %s -> P = %.1f %%" % (t, 100 * pp) for t, pp in steps]
    rep.append("\nCost of robustness: %.0f EUR investment (%.1f %% of the machines). Robust counts: %s" % (
        extra, 100 * extra / sum(d["machines"][t]["price"] * m for t, m in sol["counts"].items()), fmt_counts(robust)))
    sol_r = robust
    # layout
    A = dept_areas(d, sol_r)
    F = flows(d, rows, pdata)
    lr = optimise_layout(d, A, F)
    _, pos = layout_cost(lr["rows"], A, F, d["layout"])
    L, W = layout_svg(d, A, lr, os.path.join(out, "layout.svg"))
    agv = agv_estimate(F, pos, H=d["programme"]["H_month"])
    rep += ["", "## 7 Layout (spine, simulated annealing, robust machine counts)", "",
            "Transport cost: start (SLP order) %.0f -> optimised %.0f unit-load-m per month (%.1f %% less; best of the annealing restarts). Hall %.0f x %.0f m = %.0f m2." % (
                lr["start_cost"], lr["cost"], 100 * (1 - lr["cost"] / lr["start_cost"]), L, W, L * W), "",
            "Row 1 (from the dock wall): " + " | ".join(lr["rows"][0]), "",
            "Row 2 (from the dock wall): " + " | ".join(lr["rows"][1]), "",
            "| Department | Area m2 |", "|---|---|"]
    rep += ["| %s %s | %.0f |" % (k, DEPT_NAMES.get(k, ""), A[k]) for k in sorted(A, key=lambda k: -A[k])]
    rep += ["", "Strongest flows (unit loads per month):", ""]
    rep += ["- %s - %s: %.0f" % (a, b, f) for (a, b), f in sorted(F.items(), key=lambda kv: -kv[1])[:10]]
    rep += ["", "AGV estimate (input of F5): %.0f unit-load moves/month, %.0f km/month, %.0f AGV-hours -> **%d AGVs** "
            "(1 m/s, 60 s handling per move, 75 %% availability; assembly line flows on conveyors)." % (
                agv["moves_month"], agv["km_month"], agv["agv_hours"], agv["agvs"])]
    write_csv(os.path.join(out, "flows.csv"), [["from", "to", "unit_loads_month"]] + [[a, b, round(f, 1)] for (a, b), f in F.items()])
    # economics
    eco = economics(d, sol_r, best, L * W)
    ops = sum(d["machines"][t]["op"] * m for t, m in sol_r.items()) + best["n_ls"]
    rep += ["", "## 8 Direct operators", "", "Direct operators per shift (machine attendance + assembly + test + paint + pack + load stations): **%.1f**, i.e. about %d people in 2 shifts (+ indirect staff in the overhead)." % (ops, math.ceil(ops) * 2)]
    rep += ["", "## 9 Investment and NPV (reference estimates)", "",
            "| Item | EUR |", "|---|---|",
            "| Machines (robust design) | %.0f |" % eco["machines"], "| HMC fixtures + rack slots | %.0f |" % eco["fixtures"],
            "| Load stations | %.0f |" % eco["load_stations"], "| Building (%.0f m2 x 450) | %.0f |" % (L * W, eco["building"]),
            "| Other items F3-F12 (placeholders, see fms_data.json) | %.0f |" % eco["other"],
            "| Working capital (%.1f months of material) | %.0f |" % (d["programme"]["working_capital_months"], eco["wc"]),
            "| **Total investment** | **%.0f** |" % eco["investment"], "",
            "Contribution per unit (price x (1 - variable share) - material): " + ", ".join("%s %.0f" % kv for kv in eco["contrib_unit"].items()) + " EUR.", "",
            "Contribution %.0f EUR/month, direct labour %.0f, maintenance %.0f, fixed overhead %.0f EUR/month. NPV (%d years, %.0f %%) **%.1f M EUR**, payback %.1f years." % (
                eco["contribution_month"], eco["labour_month"], eco["maint_month"], eco["overhead_month"], d["programme"]["years"],
                100 * d["programme"]["interest"], eco["npv"] / 1e6, eco["payback_years"] or float("nan"))]
    with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(rep) + "\n")
    print("\n".join(rep))
    print("\nwritten to", out, ":", ", ".join(sorted(os.listdir(out))))
    return 0


# ----------------------------------------------------------------------------- self-test
def selftest(d, pdata):
    ok = []

    def check(name, cond):
        ok.append(bool(cond))
        print("  [%s] %s" % ("PASS" if cond else "FAIL", name))

    # 1 max-flow
    g = {frozenset(["A"]): 50.0, frozenset(["A", "B"]): 80.0, frozenset(["B"]): 30.0}
    f, a = maxflow(g, {"A": 100.0, "B": 60.0})
    check("max-flow 160 -> 160 (A 100 = 50 own + 50 shared, B 60)", abs(f - 160) < 1e-6)
    f, _ = maxflow(g, {"A": 40.0, "B": 200.0})
    check("max-flow limited by the A-only group (40 + 110 = 150)", abs(f - 150) < 1e-6)
    # 2 B&B = brute force on a small instance
    dd = copy.deepcopy(d)
    dd["programme"]["H_month"] = 10
    g2 = {frozenset(["HMC"]): 900.0, frozenset(["VMC", "HMC"]): 700.0, frozenset(["VMC"]): 500.0,
          frozenset(["LATHE", "TMILL"]): 800.0, frozenset(["TMILL"]): 200.0}
    sol = optimise(dd, g2)
    bf = brute_force(dd, g2)
    unit = {t: annual_cost(dd, t, 1, 0) for t in sol["counts"]}
    check("branch and bound cost = brute force cost (%s)" % fmt_counts(sol["counts"]),
          abs(sum(sol["counts"][t] * unit[t] for t in sol["counts"]) - bf[0]) < 1e-6)
    check("solution is feasible (max-flow = load)", feasible(g2, sol["counts"], dd)[0])
    # 3 MVA closed forms
    st = {"A": (1, {"x": 2.0}), "B": (1, {"x": 2.0})}
    for N in (1, 3, 6):
        X = mva(["x"], st, {"x": N})["X"]["x"]
        if abs(X - N / (2.0 * (N + 1))) > 1e-12:
            break
    else:
        N = None
    check("MVA balanced 2-station network X(N) = N/(D(N+1))", N is None)
    st = {"A": (2, {"x": 4.0}), "Z": (1, {"x": 0.0})}
    X = mva(["x"], st, {"x": 1})["X"]["x"]
    check("Seidmann: one customer at a 2-server station sees D (X = 1/4)", abs(X - 0.25) < 1e-12)
    X = mva(["x"], st, {"x": 40})["X"]["x"]
    check("Seidmann: many customers -> X = c/D = 0.5 (%.4f)" % X, abs(X - 0.5) < 1e-3)
    # 4 DES vs MVA (exponential, single servers, 2 classes) within 5 %
    # BCMP product form needs class-independent service times at FCFS stations -> same demand per class here
    stn = {"A": (1, {"p": 3.0, "q": 3.0}), "B": (1, {"p": 1.0, "q": 1.0}), "HMC": (1, {"p": 2.0, "q": 2.0})}
    N = {"p": 3, "q": 2}
    mv = mva(["p", "q"], stn, N)["X"]
    Xd, _ = des_cell(({k: v[0] for k, v in stn.items()}, {r: {k: stn[k][1][r] for k in stn} for r in N}),
                     ["A", "B", "HMC"], N, 20000, 500, lambda k: None, 5)
    err = max(abs(Xd[r] - mv[r]) / mv[r] for r in N)
    check("DES (exponential, product form) = exact MVA within 5 %% (max error %.1f %%)" % (100 * err), err < 0.05)
    # 5 loads from F1: VC20 HMC hours = 3000 x 11.93 min (no set-ups on HMC)
    rows = routing(pdata)
    gl, det = loads(d, rows)
    hmc_only = sum(v for k, v in gl.items() if k == frozenset(["HMC"]))
    vc_hmc = sum(r[5] for r in det if r[0] == "VC20" and r[3] == "HMC")
    mm = P.machine_minutes(pdata, "VC20", "VC20", {})["HMC"] * 3000
    check("VC20 HMC load = demand x F1 minutes (%.0f = %.0f min)" % (vc_hmc, mm), abs(vc_hmc - mm) < 1e-6)
    check("all load placed in some group (%.0f h)" % (sum(gl.values()) / 60), hmc_only > 0 and sum(gl.values()) > 0)
    # 6 set-ups counted: VMC set-ups = lots x 20 min per VMC part-op
    su = sum(r[6] for r in det if r[3] == "VMC")
    check("set-up minutes > 0 on VMC (%.0f min/month)" % su, su > 0)
    # 7 layout SA never worse than start, and areas positive
    sol = optimise(d, gl)
    A = dept_areas(d, sol["counts"])
    F = flows(d, rows, pdata)
    lr = optimise_layout(d, A, F)
    check("layout annealing <= SLP start (%.0f <= %.0f)" % (lr["cost"], lr["start_cost"]), lr["cost"] <= lr["start_cost"] + 1e-9)
    check("RAW and SHP stay at the dock wall", lr["rows"][0][0] == "RAW" and lr["rows"][1][0] == "SHP")
    # 8 data
    vars_ = {vk for _, vk, _ in P.variants(pdata)}
    check("programme variants exist in F1", set(d["programme"]["demand_month"]) <= vars_)
    check("every F1 machine type has catalogue data", all(r["machine"] in d["machines"] for r in rows))
    print("SELFTEST %s (%d/%d)" % ("PASS" if all(ok) else "FAIL", sum(ok), len(ok)))
    return 0 if all(ok) else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=DATA)
    ap.add_argument("--scale", type=float, default=1.0)
    sp = ap.add_subparsers(dest="cmd")
    sp.add_parser("selftest")
    r = sp.add_parser("run"); r.add_argument("--out", default=os.path.join(HERE, "out"))
    sp.add_parser("loads"); sp.add_parser("machines"); sp.add_parser("cell")
    a = ap.parse_args(argv)
    d, pdata = load_all(a.data, a.scale)
    if a.cmd == "selftest":
        return selftest(d, pdata)
    if a.cmd == "run":
        return cmd_run(d, pdata, a.out)
    rows = routing(pdata)
    if a.cmd == "loads":
        cmd_loads(d, rows); return 0
    if a.cmd == "machines":
        cmd_machines(d, rows); return 0
    if a.cmd == "cell":
        _, sol = cmd_machines(d, rows, quiet=True)
        cmd_cell(d, pdata, sol["counts"]["HMC"]); return 0
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
