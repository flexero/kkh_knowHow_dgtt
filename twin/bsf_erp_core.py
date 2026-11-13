"""
Ball screw + guide factory (item 7) - ERP core (stdlib only): master data, machine hour rates, standard cost roll-up, MRP (BOM explosion,
net requirements, lot sizing, lead-time offset, exception messages), EOQ / POQ, safety stock + reorder point, ATP / CTP with the thread-grinder
bottleneck, configurator, ABC / XYZ, valuation, simple finance - and the ERP state + router (class ERP) used by twin/bsf_erp.py.
Guide: docs/46_bsf_erp.md.  Browser twin of this file: web/bsferp_core.js (same model, same numbers - the page self-check &bf7test compares both).

ONE SOURCE OF TRUTH: the master data are READ from web/bsferp_data.js (the JSON block between the MD-JSON markers); routings from
web/bsfmfg_data.js (via twin/bsf_mes_core.py), machine kW + footprint from the MTYPES block of web/bsfmfg_data.js, machine counts from
twin/bsf_comm_map.py (= MACHINES of item 2). Importing this module starts nothing.  ALL VALUES ARE EXAMPLES.
"""

from __future__ import annotations

import collections
import json
import math
import os
import re
import time

from twin import bsf_mes_core as MC

ROOT = MC.ROOT
EPS = 1e-9


# ====================================================================== master data
def _load_md():
    with open(os.path.join(ROOT, "web", "bsferp_data.js"), encoding="utf-8") as fh:
        t = fh.read()
    a = t.index("/*MD-JSON-BEGIN*/") + len("/*MD-JSON-BEGIN*/")
    return json.loads(t[a:t.index("/*MD-JSON-END*/")])


def _load_mtypes():
    out = {}
    with open(os.path.join(ROOT, "web", "bsfmfg_data.js"), encoding="utf-8") as fh:
        t = fh.read()
    s = t[t.index("export const MTYPES"):t.index("export const QGATES")]
    for line in s.splitlines():
        m = re.match(r'\s*"([A-Z]{2}-[A-Z0-9]{2,3})": \{ n: "((?:[^"\\]|\\.)*)", area: "(\w+)".*?kW: ([\d.]+), foot: \[([\d.]+), ([\d.]+)\]', line)
        if m:
            out[m.group(1)] = {"n": m.group(2), "area": m.group(3), "kW": float(m.group(4)), "foot": [float(m.group(5)), float(m.group(6))],
                               "shifts3": "shifts3: true" in line, "lab": "lab: true" in line}
    return out


MD = _load_md()
P = MD["plant"]
MTYPES = _load_mtypes()
try:
    from twin import bsf_comm_map as _MAP
    NMACH = dict(collections.Counter(m["type"] for m in _MAP.MACHINES))
except Exception:  # noqa: BLE001
    NMACH = {}
MCOLS = ["id", "n", "type", "uom", "proc", "lt", "lot", "lotQ", "ss", "price", "sup", "route"]
MAT = collections.OrderedDict((r[0], dict(zip(MCOLS, r))) for r in MD["materials"])
for _code, _p in MC.PROD.items():          # family variants the MES knows (configured products) - generic names, BOM = reference x k
    if _code not in MAT:
        MAT[_code] = {"id": _code, "n": f"{_p['kind']} {_p['fam']} (family variant, k = {_p['k']})", "type": "fg", "uom": "pc", "proc": "make", "lt": 10 if _p["route"] in ("BS", "BN", "LG", "LB") else 2,
                      "lot": "L4L", "lotQ": 0, "ss": 0, "price": 0, "sup": "", "route": _p["route"], "variant": True}
BOM = MD["bom"]
CUST = collections.OrderedDict((r[0], {"id": r[0], "n": r[1], "country": r[2], "terms": r[3], "creditK": r[4], "inco": r[5], "channel": r[6], "group": r[7]}) for r in MD["customers"])
SUPP = collections.OrderedDict((r[0], {"id": r[0], "n": r[1], "supplies": r[2], "lt": r[3], "terms": r[4], "rating": r[5], "channel": r[6], "cert": r[7]}) for r in MD["suppliers"])
REF = MC.REF_CODE
BOTTLE = {"BS": ("BS", "100", 1), "BN": ("BN", "60", 1), "LG": ("LG", "80", 1), "LB": ("LB", "60", 1), "FABS": ("BS", "100", 1), "FALG": ("LB", "60", 2)}


def mat_id(x):
    if x is None:
        return None
    x = str(x)
    if x in MAT:
        return x
    if x in REF:
        return REF[x]
    u = x.upper()
    return next((k for k in MAT if k.upper() == u), None)


def route_of(code):
    m = MAT.get(code) or {}
    r = m.get("route") or ""
    return r.split(":")[0] if m.get("proc") == "make" else ""


def k_of(code):
    p = MC.prod_info(code)
    return p["k"] if p else 1.0


def ops_of(route):
    return MC.ops_g(route)


def eff_time(o, k=1.0):
    """minutes per piece incl. set-up share = cyc (× k, furnaces not) + setup / batch (= effCycle of item 2)."""
    cyc = o["cyc"] if o["mod"] == "furnace" else o["cyc"] * k
    return cyc + (o["setup"] / o["batch"] if o["batch"] else 0)


def route_yield(route, from_no=None):
    y = 1.0
    on = from_no is None
    for o in ops_of(route):
        if o["no"] == from_no:
            on = True
        if on:
            y *= 1 - o["scrap"] / 100
    return y


def shifts_of(t):
    return 3 if MTYPES.get(t, {}).get("shifts3") else 2


# ====================================================================== machine hour rate
def mhr(t):
    """machine hour rate = (depreciation + interest + space + energy + maintenance) / planned hours per year."""
    T, W = MTYPES.get(t), MD["wc"].get(t)
    if not T or not W:
        return None
    price = W[0] * 1000.0
    hours = P["days"] * shifts_of(t) * P["shiftH"]
    area = T["foot"][0] * T["foot"][1] * P["access"]
    dep = price / P["life"]
    intr = price / 2 * P["interest"]
    space = area * P["room"][T["area"]]
    energy = T["kW"] * P["loadFactor"] * hours * P["energy"]
    maint = P["maint"][T["area"]] * price
    total = dep + intr + space + energy + maint
    return {"type": t, "name": T["n"], "area": T["area"], "kW": T["kW"], "price": price, "life": P["life"], "hours": hours, "areaM2": area, "dep": dep, "int": intr,
            "space": space, "energy": energy, "maint": maint, "total": total, "rate": total / hours, "energyRate": energy / hours, "nonCashRate": (dep + intr) / hours,
            "crew": W[1], "labourRate": W[1] * P["labour"], "n": NMACH.get(t, 0)}


def workcenters():
    return [mhr(t) for t in MD["wc"] if mhr(t)]


# ====================================================================== standard cost roll-up
def _children(code):
    if code in BOM:
        return BOM[code], 1.0
    r = route_of(code)
    if r and REF.get(r) in BOM:
        return BOM[REF[r]], k_of(code)       # family variant: reference BOM, raw material × k
    return [], 1.0


def std_price(code, _memo=None):
    m = MAT.get(code)
    if not m:
        return 0.0
    if m["proc"] == "buy":
        return float(m["price"])
    if m["proc"] == "phantom":
        return 0.0
    return cost_rollup(code)["std"]


def _material(code, k, factor=1.0, out=None):
    """BOM explosion for costing: make children = their std cost, phantoms pass through, bought items at standard price."""
    out = [] if out is None else out
    kids, kk = _children(code)
    for child, qty, pos in kids:
        c = MAT.get(child)
        if not c:
            continue
        q = qty * factor * (kk if c["type"] == "raw" else 1.0)
        if c["proc"] == "phantom":
            _material(child, k, q, out)
        elif c["proc"] == "make":
            out.append({"pos": pos, "child": child, "qty": q, "price": std_price(child), "kind": "make", "type": c["type"], "uom": c["uom"]})
        else:
            out.append({"pos": pos, "child": child, "qty": q, "price": float(c["price"]), "kind": "buy", "type": c["type"], "uom": c["uom"]})
    return out


_COST = {}


def cost_rollup(code):
    if code in _COST:
        return _COST[code]
    m = MAT.get(code)
    if not m or m["proc"] != "make":
        return None
    route, k = route_of(code), k_of(code)
    mat = _material(code, k)
    for x in mat:
        x["value"] = x["qty"] * x["price"]
    mat_buy = sum(x["value"] for x in mat if x["kind"] == "buy")
    mat_make = sum(x["value"] for x in mat if x["kind"] == "make")
    moh = P["moh"] * mat_buy
    ops, cum, mach, lab, fix_nc, fix_c, ener = [], 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
    for o in ops_of(route):
        R = mhr(o["m"])
        t = eff_time(o, k)
        f = t / 60 / P["oee"]
        cm, cl = f * R["rate"], f * R["labourRate"]
        mach += cm
        lab += cl
        fix_nc += f * R["nonCashRate"]
        ener += f * R["energyRate"]
        fix_c += f * (R["rate"] - R["nonCashRate"] - R["energyRate"])
        cum += (cm + cl) * (1 + P["poh"])
        ops.append({"no": o["no"], "m": o["m"], "name": MC._short(o["name"]), "t": t, "rate": R["rate"], "crew": R["crew"], "machine": cm, "labour": cl, "scrap": o["scrap"], "cumConv": cum})
    poh = P["poh"] * (mach + lab)
    base = mat_buy + mat_make + moh + mach + lab + poh
    y = route_yield(route)
    scrap = base * (1 / y - 1)
    std = base + scrap
    full = std * (1 + P["sga"])
    price = float(MD["prices"].get(code, 0)) or None
    semi = {}
    for sid, sm in MAT.items():
        if sm["proc"] == "phantom" and sm["route"].split(":")[0] == route and code == REF.get(route):
            upto = sm["route"].split(":")[1]
            raw = sum(x["value"] for x in mat if x["type"] == "raw")
            conv = next((o["cumConv"] for o in ops if o["no"] == upto), 0.0)
            semi[sid] = raw * (1 + P["moh"]) + conv
    # cost elements rolled through the make children (for variable / fixed split, cash view, break-even): own + Σ child × qty, all × 1 / yield
    roll = {"mat": mat_buy, "moh": moh, "labour": lab, "energy": ener, "fixCash": fix_c, "fixNonCash": fix_nc, "poh": poh}
    for x in mat:
        if x["kind"] == "make":
            cr = cost_rollup(x["child"])["roll"]
            for kk in roll:
                roll[kk] += cr[kk] * x["qty"]
    roll = {kk: v / y for kk, v in roll.items()}
    var = roll["mat"] + roll["moh"] + roll["labour"] + roll["energy"]
    r = {"code": code, "route": route, "k": k, "material": mat, "matBuy": mat_buy, "matMake": mat_make, "moh": moh, "ops": ops, "machine": mach, "labour": lab,
         "poh": poh, "base": base, "yield": y, "scrap": scrap, "std": std, "sga": std * P["sga"], "full": full, "price": price,
         "margin": (price - full) if price else None, "marginPct": ((price - full) / price) if price else None, "semi": semi,
         "fixNonCash": fix_nc, "fixCash": fix_c, "energy": ener, "variable": var, "roll": roll, "fixed": roll["fixCash"] + roll["fixNonCash"] + roll["poh"]}
    _COST[code] = r
    return r


# ====================================================================== lot sizing, EOQ, SS / ROP
def eoq(D, S, H):
    return math.sqrt(2 * D * S / H) if H > 0 and D > 0 else 0.0


def safety_stock(z, sigma, LT):
    return z * sigma * math.sqrt(LT)


def rop(d, LT, SS):
    return d * LT + SS


def mav(q0, p0, q1, p1):
    return (q0 * p0 + q1 * p1) / (q0 + q1) if q0 + q1 > 0 else p1


def lot_compare(net, S, H, foq):
    """the 4 lot-sizing rules on one net-requirement row (no stock at start, no lead time): orders, end inventory, cost = set-ups × S + Σ end stock × H."""
    n = len(net)
    avg = sum(net) / n if n else 0
    Q = eoq(avg, S, H)
    Pp = max(1, int(round(Q / avg))) if avg > 0 else 1
    res = {}
    for rule in ("L4L", "FOQ", "EOQ", "POQ"):
        inv, orders, ends = 0.0, [0.0] * n, []
        for t in range(n):
            if inv < net[t] - EPS:
                need = net[t] - inv
                if rule == "L4L":
                    q = need
                elif rule == "FOQ":
                    q = math.ceil(need / foq - EPS) * foq
                elif rule == "EOQ":
                    q = max(round(Q), need)
                else:
                    q = sum(net[t:t + Pp]) - inv
                orders[t] = q
                inv += q
            inv -= net[t]
            ends.append(inv)
        setups = sum(1 for q in orders if q > 0)
        res[rule] = {"orders": orders, "end": ends, "setups": setups, "setupCost": setups * S, "holdCost": sum(ends) * H, "cost": setups * S + sum(ends) * H}
    return {"net": net, "S": S, "H": H, "EOQ": Q, "P": Pp, "FOQ": foq, "rules": res}


# ====================================================================== MRP
def low_level_codes(items):
    llc = {i: 0 for i in items}
    changed = True
    while changed:
        changed = False
        for parent, kids in BOM.items():
            for child, _q, _p in kids:
                if child in llc and parent in llc and llc[child] < llc[parent] + 1:
                    llc[child] = llc[parent] + 1
                    changed = True
    return llc


def mrp_item(it, gross, H):
    """one item, H buckets. it = {oh, ss, lt, lot, q, sr[], S, Hw, phantom} → poh, net, receipts, releases, exceptions."""
    sr = list(it.get("sr") or [0] * H) + [0] * H
    oh, ss, lt, rule = float(it.get("oh", 0)), float(it.get("ss", 0)), int(it.get("lt", 0)), it.get("lot", "L4L")
    avg = sum(gross) / H if H else 0
    Q = eoq(avg, it.get("S", 0), it.get("Hw", 0)) if rule in ("EOQ", "POQ") else 0
    Pp = max(1, int(round(Q / avg))) if rule == "POQ" and avg > 0 and Q > 0 else 1
    poh, net, prc, prl, exc = [], [0.0] * H, [0.0] * H, [0.0] * (H + lt + 1), []
    last = oh
    for t in range(H):
        avail = last + sr[t] - gross[t]
        if avail < ss - EPS:
            n = ss - avail
            net[t] = n
            if it.get("phantom") or rule == "L4L":
                q = n
            elif rule == "FOQ":
                q = math.ceil(n / it["q"] - EPS) * it["q"] if it.get("q") else n
            elif rule == "EOQ":
                q = max(round(Q), n) if Q else n
            elif rule == "POQ":
                q = sum(gross[t:t + Pp]) + ss - (last + sum(sr[t:t + Pp]))
                q = max(q, n)
            else:
                q = n
            prc[t] = q
            avail += q
            rt = t - lt
            if rt < 0:
                exc.append({"kind": "expedite", "bucket": t, "qty": q, "planned": True, "text": f"planned order due in week {t} needs release in week {rt} (past) - expedite / shorten lead time"})
                rt = 0
            prl[rt] += q
        poh.append(avail)
        last = avail
    # exception messages for the scheduled receipts: compare each receipt with the week it is really needed
    need_last, used = oh, 0
    srs = [(t, sr[t]) for t in range(H) if sr[t] > 0]
    for t_r, q_r in srs:
        need_at = None
        inv = need_last
        for t in range(H):
            inv2 = inv - gross[t] + (sr[t] if any(t == x[0] for x in srs[:used]) else 0)
            if inv2 < ss - EPS and need_at is None:
                need_at = t
            inv = inv2
        if need_at is None:
            exc.append({"kind": "cancel", "bucket": t_r, "text": f"receipt of {q_r:g} in week {t_r} is not needed in the horizon - cancel or reduce"})
        elif need_at > t_r:
            exc.append({"kind": "push out", "bucket": t_r, "text": f"receipt of {q_r:g} in week {t_r} is needed only in week {need_at} - push out"})
        elif need_at < t_r:
            exc.append({"kind": "expedite", "bucket": t_r, "text": f"receipt of {q_r:g} in week {t_r} is needed already in week {need_at} - pull in (expedite)"})
        used += 1
    return {"gross": gross, "sr": sr[:H], "poh": poh, "net": net, "prc": prc, "prl": prl[:H], "exceptions": exc, "EOQ": Q, "P": Pp}


def mrp(items, indep, H):
    """items: {id: {oh, ss, lt, lot, q, sr, S, Hw, phantom}}, indep: {id: [gross per bucket]}.  Level by level (low-level codes)."""
    llc = low_level_codes(list(items))
    order = sorted(items, key=lambda i: (llc[i], i))
    gross = {i: list(indep.get(i, [0] * H)) for i in items}
    out = collections.OrderedDict()
    for i in order:
        r = mrp_item(items[i], gross[i], H)
        r["llc"] = llc[i]
        out[i] = r
        for child, q, _p in BOM.get(i, []):
            if child in gross:
                for t in range(H):
                    gross[child][t] += r["prl"][t] * q
    return out


def mrp_check():
    c = MD["check"]["mrp"]
    A, B = c["A"], c["B"]
    H = len(A["gross"])
    ra = mrp_item({"oh": A["oh"], "ss": A["ss"], "lt": A["lt"], "lot": A["lot"]}, A["gross"], H)
    gb = [x * B["per"] for x in ra["prl"]]
    rb = mrp_item({"oh": B["oh"], "ss": B["ss"], "lt": B["lt"], "lot": B["lot"], "q": B["q"], "sr": B["sr"]}, gb, H)
    rc = mrp_item({"oh": 0, "ss": 0, "lt": 1, "lot": "L4L", "sr": [0, 50, 0, 0]}, [0, 0, 0, 50], 4)
    rd = mrp_item({"oh": 0, "ss": 0, "lt": 2, "lot": "L4L"}, [30, 0, 0, 0], 4)
    return {"A": ra, "B": rb, "grossB": gb, "C": rc, "D": rd}


# ====================================================================== ATP / CTP
def ctp_case(c):
    """pure capable-to-promise: rem = q − free, minutes = rem × minPerPc, fill the free bottleneck minutes per day from day 'upstream' on."""
    rem = max(0.0, c["q"] - c.get("free", 0))
    need = rem * c["minPerPc"]
    if need <= EPS:
        return {"rem": 0, "need": 0, "doneDay": 0, "promiseDay": c.get("ship", 1), "used": []}
    acc, used = 0.0, []
    fm = c["freeMin"]
    for d in range(int(c.get("upstream", 0)), len(fm)):
        take = min(fm[d], need - acc)
        if take > 0:
            used.append([d, take])
        acc += fm[d]
        if acc >= need - EPS:
            return {"rem": rem, "need": need, "doneDay": d, "promiseDay": d + c.get("after", 0) + c.get("ship", 1), "used": used}
    return {"rem": rem, "need": need, "doneDay": None, "promiseDay": None, "used": used, "text": "not possible in the horizon"}


def bottleneck(code):
    r = route_of(code)
    if r not in BOTTLE:
        return None
    br, opno, per = BOTTLE[r]
    o = next((x for x in ops_of(br) if x["no"] == opno), None)
    if not o:
        return None
    t = o["m"]
    cap = NMACH.get(t, 1) * shifts_of(t) * P["shiftH"] * 60 * P["oee"]
    kk = k_of(code) if r not in ("FABS", "FALG") else (k_of(REF[br]) if REF.get(br) else 1.0)
    mpp = eff_time(o, kk) / route_yield(br, opno) * per
    return {"type": t, "route": br, "op": opno, "per": per, "cap": cap, "minPerPc": mpp, "n": NMACH.get(t, 1), "effTime": eff_time(o, kk), "yieldAfter": route_yield(br, opno)}


def mps_load(btype):
    """minutes per day the MPS (= forecast / 5) puts on a machine type: every route of the product (sets: component routes × qty),
    every op on that type, time per good piece = t / yield from that op to the end of its route."""
    s = 0.0
    for code, wk in MD["forecast"].items():
        r = route_of(code)
        routes = [(r, 1, k_of(code))] if r not in MC.SETS else [(r, 1, 1.0)] + [(x, q, 1.0) for x, q in MC.SETS[r]]
        for rr, per, kk in routes:
            for o in ops_of(rr):
                if o["m"] == btype:
                    s += wk / P["weekDays"] * per * eff_time(o, kk) / route_yield(rr, o["no"])
    return s


# ====================================================================== configurator
def configure(b):
    kind = (b.get("kind") or "screw").lower()
    C = MD["config"]
    rules, ok = [], True
    if kind in ("screw", "bs"):
        c = C["bs"]
        d, lead, L = int(b.get("d", 32)), int(b.get("lead", 10)), int(b.get("length", 1000))
        g, pre = str(b.get("grade", "C5")), str(b.get("preload", "P1"))
        if d not in c["d"]:
            return {"ok": False, "rules": [f"diameter {d} not in the family {c['d']}"]}
        if lead not in c["lead"][str(d)]:
            ok = False
            rules.append(f"lead {lead} not available for Ø{d} (possible {c['lead'][str(d)]})")
        lmax = min(c["lenMax"], c["slender"] * d)
        if not c["lenMin"] <= L <= lmax:
            ok = False
            rules.append(f"length {L} outside {c['lenMin']} … {lmax} mm (slenderness L/d ≤ {c['slender']})")
        if g not in c["grade"]:
            return {"ok": False, "rules": [f"grade {g} unknown (C3 / C5 / C7)"]}
        if g == "C3" and L > c["c3Max"]:
            ok = False
            rules.append(f"C3 only up to {c['c3Max']} mm (lead measuring + thread grinding limit)")
        if pre not in c["preload"]:
            return {"ok": False, "rules": [f"preload {pre} unknown (P0 / P1 / P2)"]}
        screw = (c["base"][str(d)] * c["leadF"][str(lead)] + c["perM"][str(d)] * L / 1000) * c["grade"][g]
        nut = c["nut"][str(d)] * c["preload"][pre]
        code_s, code_n = f"BS-{d}{lead:02d}-{L}-{g}", f"BN-{d}{lead:02d}-FL"
        code_set = f"FABS-{d}{lead:02d}-{L}-{g}"
        price = screw + nut + c["setAdd"]
        rules.append(f"screw = ({c['base'][str(d)]} × {c['leadF'][str(lead)]} + {c['perM'][str(d)]} × {L / 1000:g}) × {c['grade'][g]} = {screw:.2f} €")
        rules.append(f"nut = {c['nut'][str(d)]} × {c['preload'][pre]} = {nut:.2f} € · set = screw + nut + {c['setAdd']} € assembly / run-in")
        return {"ok": ok, "kind": "screw", "code": code_set, "codes": {"set": code_set, "screw": code_s, "nut": code_n}, "variant": f"{code_s} / {code_n} {pre}",
                "price": price, "parts": {"screw": screw, "nut": nut, "assembly": c["setAdd"]}, "k": L / 1000, "known": code_set in MAT or code_s in MAT, "rules": rules}
    c = C["lg"]
    s, L = int(b.get("size", 25)), int(b.get("length", 1000))
    bt, pre, cl, nb = str(b.get("block", "FL")), str(b.get("preload", "Z1")), str(b.get("cls", "H")), int(b.get("blocks", 2))
    if s not in c["size"]:
        return {"ok": False, "rules": [f"size {s} not in the family {c['size']}"]}
    if bt not in c["blockType"] or pre not in c["preload"] or cl not in c["cls"]:
        return {"ok": False, "rules": ["block FL / NA, preload Z0 / Z1 / Z2, class N / H / P"]}
    if not c["lenMin"] <= L <= c["lenMax"]:
        ok = False
        rules.append(f"rail length {L} outside {c['lenMin']} … {c['lenMax']} mm (longer: butt-jointed matched rails)")
    pitch = c["pitch"][str(s)]
    if L % pitch:
        rules.append(f"note: {L} mm is not a multiple of the hole pitch {pitch} mm – end distance E = {(L % pitch) / 2 + pitch / 2:g} mm each side (check E ≥ min.)")
    if not 1 <= nb <= 6:
        ok = False
        rules.append("1 … 6 carriages per rail")
    rail = c["rail"][str(s)] * L / 1000 * c["cls"][cl]
    blk = c["block"][str(s)] * c["blockType"][bt] * c["preload"][pre] * c["cls"][cl]
    price = rail + nb * blk
    code_r, code_b, code_set = f"LG-{s}-{L}", f"LB-{s}-{bt}", f"FALG-{s}-{L}"
    rules.append(f"rail = {c['rail'][str(s)]} × {L / 1000:g} × {c['cls'][cl]} = {rail:.2f} € · carriage = {c['block'][str(s)]} × {c['blockType'][bt]} × {c['preload'][pre]} × {c['cls'][cl]} = {blk:.2f} €")
    return {"ok": ok, "kind": "guide", "code": code_set, "codes": {"set": code_set, "rail": code_r, "block": code_b}, "variant": f"{code_r} + {nb} × {code_b} {pre} {cl}",
            "price": price, "parts": {"rail": rail, "block": blk, "blocks": nb}, "k": L / 1000, "known": code_set in MAT or code_r in MAT, "rules": rules}


def list_price(code):
    if code in MD["prices"]:
        return float(MD["prices"][code])
    p = MC.prod_info(code)
    if not p:
        return 0.0
    m = re.match(r"(FABS|BS|BN)-(\d\d)(\d\d)(?:-(\d+)-(C\d))?", code)
    if m and p["route"] in ("BS", "FABS", "BN"):
        d, lead = int(m.group(2)), int(m.group(3))
        L, g = int(m.group(4) or 1000), m.group(5) or "C5"
        cf = configure({"kind": "screw", "d": d, "lead": lead, "length": L, "grade": g})
        if p["route"] == "BN":
            return cf.get("parts", {}).get("nut", 0.0)
        return cf.get("price", 0.0) if p["route"] == "FABS" else cf.get("parts", {}).get("screw", 0.0)
    m = re.match(r"(FALG|LG|LB)-(\d\d)-(\d+|FL|NA)", code)
    if m:
        s = int(m.group(2))
        L = int(m.group(3)) if m.group(3).isdigit() else 1000
        cf = configure({"kind": "guide", "size": s, "length": L})
        if p["route"] == "LB":
            return cf.get("parts", {}).get("block", 0.0)
        return cf.get("price", 0.0) if p["route"] == "FALG" else cf.get("parts", {}).get("rail", 0.0)
    return 0.0


# ====================================================================== AQL (incoming inspection, = item 5 aqlPlan, ISO 2859-1 normal, level II)
AQL_LOTS = [[2, 8, "A"], [9, 15, "B"], [16, 25, "C"], [26, 50, "D"], [51, 90, "E"], [91, 150, "F"], [151, 280, "G"], [281, 500, "H"], [501, 1200, "J"], [1201, 3200, "K"],
            [3201, 10000, "L"], [10001, 35000, "M"], [35001, 150000, "N"], [150001, 500000, "P"], [500001, 1e12, "Q"]]
AQL_L = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R"]
AQL_N = [2, 3, 5, 8, 13, 20, 32, 50, 80, 125, 200, 315, 500, 800, 1250, 2000]
AQL_AC0 = {"0.65": "F", "1.0": "E", "1.5": "D", "2.5": "C", "4.0": "B", "6.5": "A"}
AQL_SEQ = [1, 2, 3, 5, 7, 10, 14, 21]


def aql_plan(lot, aql="1.0"):
    row = next((r for r in AQL_LOTS if r[0] <= lot <= r[1]), AQL_LOTS[-1])
    li, i0 = AQL_L.index(row[2]), AQL_L.index(AQL_AC0[aql])
    k = li
    if li <= i0:
        k, ac = i0, 0
    elif li == i0 + 1:
        k, ac = i0, 0
    elif li == i0 + 2:
        k, ac = i0 + 3, 1
    else:
        s = li - (i0 + 3)
        if s < len(AQL_SEQ):
            ac = AQL_SEQ[s]
        else:
            k, ac = i0 + 3 + len(AQL_SEQ) - 1, AQL_SEQ[-1]
    k = min(k, len(AQL_N) - 1)
    n = AQL_N[k]
    return {"letter": row[2], "useLetter": AQL_L[k], "n": min(n, int(lot)), "ac": ac, "re": ac + 1, "aql": aql}


# ====================================================================== deterministic random (same as web/bsfqa_calc.js rng)
def rng(seed=7):
    s = [(seed & 0xFFFFFFFF) or 1]

    def nxt():
        x = s[0]
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        s[0] = x & 0xFFFFFFFF
        return s[0] / 4294967296
    return nxt


# ====================================================================== dates (working days, UTC)
def day0(t):
    return int(t // 86400)                         # days since 1970-01-01 (UTC)


def is_work(d):
    return (d + 3) % 7 < 5                         # 1970-01-01 = Thursday → weekday index (d + 3) % 7, Mon = 0


def add_wd(d, n):
    while not is_work(d):
        d += 1
    while n > 0:
        d += 1
        if is_work(d):
            n -= 1
    return d


def wd_between(a, b):
    n, d = 0, a
    while d < b:
        d += 1
        if is_work(d):
            n += 1
    return n


def iso_day(d):
    return time.strftime("%Y-%m-%d", time.gmtime(d * 86400))


def parse_day(s):
    try:
        return int(time.mktime(time.strptime(str(s)[:10], "%Y-%m-%d")) - time.timezone) // 86400
    except (ValueError, OverflowError):
        return None


def week_of(d, today):
    mon = today - (today + 3) % 7
    return max(0, (d - mon) // 7)


# ====================================================================== finance (plan year)
def finance():
    F = MD["fin"]
    rows = []
    fixed_month_conv = 0.0
    for code, perday in F["mix"].items():
        c = cost_rollup(code)
        fixed_month_conv += perday * (sum(F["monthDays"]) / 12) * c["fixed"]
    fixed_mach = sum((R["dep"] + R["int"] + R["space"] + R["maint"]) * R["n"] for R in workcenters()) / 12
    absorbed = sum(q * (sum(F["monthDays"]) / 12) * (cost_rollup(p)["roll"]["fixCash"] + cost_rollup(p)["roll"]["fixNonCash"]) for p, q in F["mix"].items())
    idle = max(0.0, fixed_mach - absorbed)
    dep_int = sum((R["dep"] + R["int"]) * R["n"] for R in workcenters()) / 12      # non-cash (depreciation + calculatory interest)          # machine cost of the hours nobody planned (machines bought for peaks / balance)
    cash = F["openingCash"]
    for i, mname in enumerate(F["months"]):
        units = {p: F["monthDays"][i] * q * F["index"][i] for p, q in F["mix"].items()}
        normal = {p: F["monthDays"][i] * q for p, q in F["mix"].items()}
        rev = sum(units[p] * float(MD["prices"][p]) for p in units)
        cogs = sum(units[p] * cost_rollup(p)["std"] for p in units)
        fixu = {p: cost_rollup(p)["fixed"] for p in units}
        volvar = sum((normal[p] - units[p]) * fixu[p] for p in units)
        gm = rev - cogs - volvar
        ebit = gm - idle - F["sgaMonth"]
        rows.append({"month": mname, "days": F["monthDays"][i], "units": units, "revenue": rev, "cogs": cogs, "volVar": volvar, "gross": gm, "idle": idle, "sga": F["sgaMonth"], "ebit": ebit,
                     "ebitPct": ebit / rev if rev else 0, "material": _mat_cash(units)})
    for i, r in enumerate(rows):
        rec = rows[i - F["dso"]]["revenue"] if i >= F["dso"] else r["revenue"]
        pay_mat = rows[i - F["dpo"]]["material"] if i >= F["dpo"] else r["material"]
        other = r["cogs"] + r["volVar"] + r["idle"] + r["sga"] - r["material"] - dep_int
        capex = F["capexMonth"][i]
        net = rec - pay_mat - other - capex
        cash += net
        r.update({"receipts": rec, "payMaterial": pay_mat, "payOther": other, "nonCash": dep_int, "capex": capex, "netCash": net, "cash": cash})
    return {"rows": rows, "year": {k: sum(r[k] for r in rows) for k in ("revenue", "cogs", "volVar", "gross", "idle", "sga", "ebit", "netCash")}, "fixedConvMonth": fixed_month_conv, "fixedMachMonth": fixed_mach, "absorbedMonth": absorbed}


def _mat_cash(units):
    s = 0.0
    for p, u in units.items():
        for m_, q_ in explode_buy(p).items():
            s += u * q_ * float(MAT[m_]["price"])
    return s


def explode_buy(code, factor=1.0, out=None):
    """BOM explosion down to bought items (raw / buy / pack): [(material, qty per 1 code)]."""
    out = collections.OrderedDict() if out is None else out
    kids, kk = _children(code)
    for child, q, _p in kids:
        c = MAT.get(child)
        if not c:
            continue
        qq = q * factor * (kk if c["type"] == "raw" else 1.0)
        if c["proc"] in ("make", "phantom"):
            explode_buy(child, qq, out)
        else:
            out[child] = out.get(child, 0.0) + qq
    return out


def breakeven():
    F = MD["fin"]
    days = sum(F["monthDays"]) / 12
    contrib = 0.0
    rev = 0.0
    lines = []
    for p, q in F["mix"].items():
        c = cost_rollup(p)
        price = float(MD["prices"][p])
        cm = price - c["variable"]
        contrib += q * cm
        rev += q * price
        lines.append({"code": p, "perDay": q, "price": price, "variable": c["variable"], "contribution": cm, "cmPct": cm / price})
    fixed_mach = sum((R["dep"] + R["int"] + R["space"] + R["maint"]) * R["n"] for R in workcenters()) / 12
    poh_month = sum(q * days * cost_rollup(p)["roll"]["poh"] for p, q in F["mix"].items())
    fixed = fixed_mach + poh_month + F["sgaMonth"]
    be_days = fixed / contrib
    return {"lines": lines, "contribPerDay": contrib, "revenuePerDay": rev, "fixedMachMonth": fixed_mach, "pohMonth": poh_month, "sgaMonth": F["sgaMonth"], "fixedMonth": fixed,
            "beDays": be_days, "planDays": days, "bePct": be_days / days, "beRevenueMonth": be_days * rev, "safetyMargin": 1 - be_days / days}


__all__ = ["MD", "MAT", "BOM", "mhr", "cost_rollup", "mrp", "mrp_item", "eoq", "lot_compare", "ctp_case", "configure", "aql_plan", "finance", "breakeven"]
