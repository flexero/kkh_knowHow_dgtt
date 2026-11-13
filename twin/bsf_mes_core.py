"""
Ball screw + guide factory (item 6) - MES core: master data, shift calendar, finite-capacity scheduler, OEE (stdlib only).
Guide: docs/45_bsf_mes.md.  Browser twin of this file: web/bsfmes_core.js (same algorithm - the page self-check &bf6test compares both).

Master data: the routings are READ from web/bsfmfg_data.js (item 2 owns them - one source of truth), lot sizes = web/bsflay_data.js,
products / reasons / heats / kanban = web/bsfmes_data.js (copied here, keep both equal). Importing this module starts nothing.
ALL VALUES ARE EXAMPLES.
"""

from __future__ import annotations

import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPS = 1e-9

# ------------------------------------------------------------------ products (= web/bsfmes_data.js PRODUCTS6)
PRODUCTS6 = [
    ("BS-3210-1000-C5", "BS", "screw", "Ø32×10", 1.0, None), ("BS-2505-600-C7", "BS", "screw", "Ø25×5", 0.6, None),
    ("BS-3220-1200-C5", "BS", "screw", "Ø32×20", 1.2, None), ("BS-4010-1500-C5", "BS", "screw", "Ø40×10", 1.5, None),
    ("BN-3210-FL", "BN", "nut", "Ø32×10", 1.0, None), ("BN-2505-FL", "BN", "nut", "Ø25×5", 0.8, None),
    ("BN-3220-FL", "BN", "nut", "Ø32×20", 1.0, None), ("BN-4010-FL", "BN", "nut", "Ø40×10", 1.2, None),
    ("LG-25-1000", "LG", "rail", "size 25", 1.0, None), ("LG-20-800", "LG", "rail", "size 20", 0.8, None), ("LG-35-1500", "LG", "rail", "size 35", 1.5, None),
    ("LB-25-FL", "LB", "carriage", "size 25", 1.0, None), ("LB-20-FL", "LB", "carriage", "size 20", 0.85, None), ("LB-35-FL", "LB", "carriage", "size 35", 1.2, None),
    ("FABS-3210-1000-C5", "FABS", "assembly", "Ø32×10", 1.0, [("BS-3210-1000-C5", 1), ("BN-3210-FL", 1)]),
    ("FABS-4010-1500-C5", "FABS", "assembly", "Ø40×10", 1.2, [("BS-4010-1500-C5", 1), ("BN-4010-FL", 1)]),
    ("FALG-25-1000", "FALG", "assembly", "size 25", 1.0, [("LG-25-1000", 1), ("LB-25-FL", 2)]),
    ("FALG-35-1500", "FALG", "assembly", "size 35", 1.3, [("LG-35-1500", 1), ("LB-35-FL", 2)]),
]
PROD = {p[0]: {"code": p[0], "route": p[1], "kind": p[2], "fam": p[3], "k": p[4], "parts": p[5]} for p in PRODUCTS6}
REF_CODE = {"BS": "BS-3210-1000-C5", "BN": "BN-3210-FL", "LG": "LG-25-1000", "LB": "LB-25-FL", "FABS": "FABS-3210-1000-C5", "FALG": "FALG-25-1000"}
LOT6 = {"BS": 20, "BN": 40, "LG": 50, "LB": 100, "FABS": 20, "FALG": 50}
SETS = {"FABS": [("BS", 1), ("BN", 1)], "FALG": [("LG", 1), ("LB", 2)]}
FAMILY_TYPES = ["BS-TGR", "BN-ITG", "LG-PGR", "LB-RGR", "BS-CGR"]
MINOR_SETUP = 1 / 3
MARK_OP = {"BS": "30", "BN": "20", "LG": "30", "LB": "20", "FABS": "10", "FALG": "10"}
SERIAL_PREFIX = {"FABS": "A-BS", "FALG": "A-LG"}
TOOLSETS = {"BS-TGR": ["Ø32×10", "Ø25×5", "Ø32×20"], "BN-ITG": ["Ø32×10", "Ø25×5", "Ø32×20", "Ø40×10"], "LG-PGR": ["size 25", "size 20", "size 35"], "LB-RGR": ["size 25", "size 20", "size 35"]}
GAUGES6 = [("XL80-0317", "QC-LED", "laser interferometer (lead bench)", "2027-03-01"), ("RB-0102", "QC-RAL", "rail measuring bench scale", "2027-01-15"),
           ("TQ-0211", "AS-BSA", "preload torque sensor", "2026-12-04"), ("FM-0330", "QC-MAT", "drag force sensor", "2027-02-20"),
           ("HR-0007", "BS-IND", "Rockwell tester (induction gate)", "2026-12-18"), ("BM-0415", "BS-TGR", "ball-pin micrometer (pitch Ø)", "2027-04-10")]
HEATS = [("H7741", "50CrMo4 +QT bar Ø36", "BS", 400), ("H7802", "50CrMo4 +QT bar Ø36", "BS", 400), ("H5512", "20MnCr5 bar Ø85", "BN", 600),
         ("H5590", "20MnCr5 bar Ø85", "BN", 600), ("P3307", "C55 drawn rail profile 25", "LG", 800), ("P3351", "C55 drawn rail profile 25", "LG", 800),
         ("B9120", "20CrMo4 drawn block profile", "LB", 2000), ("B9188", "20CrMo4 drawn block profile", "LB", 2000)]
REASONS = [
    ("100", "Breakdown – mechanical (spindle, axis, bearing)", "breakdown", "A"), ("110", "Breakdown – electrical / control / drive", "breakdown", "A"),
    ("120", "Breakdown – hydraulics / pneumatics / coolant", "breakdown", "A"), ("130", "Grinding-oil temperature / chiller", "breakdown", "A"),
    ("140", "Heat-treatment process out of window", "breakdown", "A"), ("200", "Set-up / change-over", "set-up", "A"),
    ("210", "Wheel dressing outside the cycle", "set-up", "A"), ("220", "Tool change / tool breakage", "tooling", "A"),
    ("300", "No material / parts (starved)", "logistics", "A"), ("310", "Waiting for AGV / transport", "logistics", "A"),
    ("320", "No operator", "organisation", "A"), ("330", "Waiting for first-part release (quality)", "quality", "A"),
    ("400", "Blocked – out-buffer full", "logistics", "A"), ("500", "Planned maintenance", "planned", "PDOT"),
    ("510", "Cleaning / 5S (planned)", "planned", "PDOT"), ("520", "Break / meeting (planned)", "planned", "PDOT"),
    ("600", "Quality problem – adjust / re-measure", "quality", "A"), ("700", "No order (idle)", "no demand", "NP"),
    ("900", "Manual stop – reason not given yet", "unknown", "A"),
]
REASON = {r[0]: {"code": r[0], "text": r[1], "cat": r[2], "oee": r[3]} for r in REASONS}
# kanban: item, name, pieces per product, use route, container C, lead time days, safety factor a
KANBAN = [("BALL-6.35-G5", "Balls Ø6.35 G5 (nut)", 60, "BN", 5000, 5, 0.2), ("DEFL-3210", "Deflector MIM (nut)", 4, "BN", 500, 10, 0.2),
          ("SEAL-3210", "Wiper seal (nut)", 2, "BN", 200, 10, 0.2), ("RING-472", "Snap ring DIN 472 (nut)", 2, "BN", 1000, 5, 0.2),
          ("BALL-4.763-G10", "Balls Ø4.763 G10 (carriage)", 120, "LB", 20000, 5, 0.2), ("CAP-LB25", "End cap POM (carriage)", 2, "LB", 500, 15, 0.25),
          ("SEAL-LB25", "End seal (carriage)", 2, "LB", 500, 10, 0.2), ("CAPH-11", "Rail hole cap Ø11", 17, "LG", 2000, 10, 0.2)]
KANBAN_DAY = {"BN": 120, "LB": 400, "LG": 200}
KANBAN_OP = {"BN": "80", "LB": "80", "LG": "100"}
GTIN_BASE = "0950110100000"


def alarm_reason(code):
    c = int(code or 0)
    if c == 900:
        return "900"
    if c == 213:
        return "130"
    if c in (211, 202):
        return "210"
    if c in (102, 151):
        return "220"
    if 400 <= c < 500:
        return "140"
    if c in (302, 203, 103, 801):
        return "120"
    if c in (301, 104, 201, 212, 502, 601, 701, 802, 153):
        return "110"
    if c == 602:
        return "600"
    if c == 702:
        return "300"
    return "100"


def prod_info(c):
    return PROD.get(REF_CODE.get(c, c))


def gtin_check(d13):
    s = sum(int(d13[12 - i]) * (3 if i % 2 == 0 else 1) for i in range(13))
    return str((10 - s % 10) % 10)


def gs1_element(serial, lot, code, date="261113"):
    gt = GTIN_BASE + gtin_check(GTIN_BASE)
    G = chr(29)
    return {"gtin": gt, "hr": f"(01){gt}(11){date}(21){serial}(10){lot}(240){code}", "raw": f"01{gt}11{date}21{serial}{G}10{lot}{G}240{code}"}


# ------------------------------------------------------------------ routings: parsed from web/bsfmfg_data.js (item 2)
_FALLBACK = {  # only used if the JS file cannot be read: (no, m, mod, setup, cyc, batch, scrap, gate, name)
    "BS": [("10", "MS-SAW", "saw", 10, 1.0, 60, 0.2, "", "Saw"), ("100", "BS-TGR", "threadgrind", 45, 40, 20, 1.5, "QG-BS-4", "Thread grinding")],
}


def _parse_routes():
    path = os.path.join(ROOT, "web", "bsfmfg_data.js")
    try:
        with open(path, encoding="utf-8") as fh:
            t = fh.read()
        s = t[t.index("export const ROUTES"):t.index("export const ROUTE_KEYS")]
    except (OSError, ValueError):
        return {k: [dict(zip(("no", "m", "mod", "setup", "cyc", "batch", "scrap", "gate", "name"), o), v=None, buy=False) for o in v] for k, v in _FALLBACK.items()}
    blocks = re.split(r"\n  (BS|BN|LG|LB|FABS|FALG): \{", s)
    out = {}
    for i in range(1, len(blocks), 2):
        key, b = blocks[i], blocks[i + 1]
        ops = []
        for o in re.split(r"\{ no: ", b)[1:]:
            def g(rx, d=None):
                m = re.search(rx, o)
                return m.group(1) if m else d
            cyc = g(r"\bcyc: (\{[^}]*\}|[\d.]+)", "0")
            if cyc.startswith("{"):
                mm = re.search(r"G: ([\d.]+)", cyc)
                cyc = mm.group(1) if mm else "0"
            v = g(r"\bv: \[([^\]]*)\]")
            ops.append({"no": re.match(r'"([^"]+)"', o).group(1), "m": g(r'\bm: "([^"]+)"'), "mod": g(r'\bmod: "([^"]+)"', ""), "setup": float(g(r"\bsetup: ([\d.]+)", "0")),
                        "cyc": float(cyc), "batch": int(float(g(r"\bbatch: ([\d.]+)", "1"))), "scrap": float(g(r"\bscrap: ([\d.]+)", "0")), "gate": g(r'\bgate: "([^"]+)"', ""),
                        "name": g(r'op: "([^"]*)"', ""), "v": [x.strip().strip('"') for x in v.split(",")] if v else None, "buy": "buy: true" in o})
        out[key] = ops
    return out


ROUTES = _parse_routes()


def ops_g(route):
    return [o for o in ROUTES.get(route, []) if (not o["v"] or "G" in o["v"]) and not o["buy"]]


def _short(name):
    return re.split(r"[(:–,]", name)[0].strip()[:42]


def route_ops(route, code):
    p = prod_info(code) or {}
    k, fam = p.get("k", 1.0), p.get("fam", "")
    out = []
    for o in ops_g(route):
        furnace = o["mod"] == "furnace"
        is_fam = o["m"] in FAMILY_TYPES
        setup = int(o["setup"]) if float(o["setup"]).is_integer() else o["setup"]
        out.append({"no": o["no"], "m": o["m"], "n": _short(o["name"]), "setup": setup, "setupMinor": round(o["setup"] * MINOR_SETUP) if is_fam else setup,
                    "cyc": o["cyc"] if furnace else round(o["cyc"] * k, 3), "batch": o["batch"] or 1, "furnace": furnace, "gate": o["gate"], "fam": fam if is_fam else "",
                    "scrapPct": o["scrap"], "status": "open", "machine": "", "good": 0, "scrap": 0, "qtyIn": 0, "tStart": None, "tEnd": None})
    return out


def route_yield(route):
    y = 1.0
    for o in ops_g(route):
        y *= 1 - o["scrap"] / 100
    return y


# ------------------------------------------------------------------ shift calendar (minutes from now)
class Calendar:
    def __init__(self, tod0=0.0, shifts=2, cal="shift"):
        self.tod0, self.shifts, self.cal = tod0, shifts, cal

    def H(self, ht):
        if self.cal == "247":
            return 1440
        return min(1440, (max(3, self.shifts) if ht else self.shifts) * 450)

    def pos(self, t):
        a = self.tod0 + t
        d = math.floor(a / 1440)
        return d, a - d * 1440

    def next_work(self, t, ht=False):
        h = self.H(ht)
        if h >= 1440:
            return t
        d, r = self.pos(t)
        return t if r < h else (d + 1) * 1440 - self.tod0

    def add_work(self, t, dur, ht=False):
        h = self.H(ht)
        if h >= 1440:
            return t + dur
        x, rest = self.next_work(t, ht), dur
        for _ in range(100000):
            _, r = self.pos(x)
            av = h - r
            if rest <= av + EPS:
                return x + rest
            rest -= av
            x = self.next_work(x + av, ht)
        return x + rest

    def work_between(self, a, b, ht=False):
        h = self.H(ht)
        if h >= 1440:
            return max(0.0, b - a)
        s, x = 0.0, self.next_work(a, ht)
        for _ in range(100000):
            if x >= b:
                break
            _, r = self.pos(x)
            s += min(h - r, b - x)
            x = self.next_work(x + (h - r), ht)
        return s


# ------------------------------------------------------------------ finite-capacity forward scheduler (same as web/bsfmes_core.js schedule())
def schedule(inp):
    lots = [dict(L) for L in inp.get("lots", [])]
    r = _sched_once(inp, lots)
    dbr = None
    if inp.get("dbr"):
        drum = inp["dbr"].get("drum") or "BS-TGR"
        buf = inp["dbr"].get("bufferMin", 960)
        moved = 0
        new = []
        for L in lots:
            if L.get("started") or L.get("fixed"):
                new.append(L)
                continue
            j = next((i for i, o in enumerate(L["ops"]) if o["m"] == drum), -1)
            e = next((o for o in r["ops"] if o["lot"] == L["id"] and o["k"] == j), None) if j >= 0 else None
            if e is None:
                new.append(L)
                continue
            up = 0.0
            for i in range(j):
                o = L["ops"][i]
                up += o["cyc"] * o["batch"] if o.get("furnace") else o["setup"] + L["qty"] * o["cyc"]
            rel = max(L.get("release") or 0, e["start"] - up - buf)
            if rel > (L.get("release") or 0) + EPS:
                moved += 1
            new.append({**L, "release": rel})
        lots = new
        before = r["kpi"]
        r = _sched_once(inp, lots)
        dbr = {"drum": drum, "bufferMin": buf, "moved": moved, "before": before}
    r["kpi"]["dbr"] = dbr
    r["rule"] = inp.get("rule") or "EDD"
    r["releases"] = {L["id"]: L.get("release") or 0 for L in lots}
    return r


def _sched_once(inp, lots_in):
    rule = inp.get("rule") or "EDD"
    C = Calendar(inp.get("tod0") or 0, inp.get("shifts") or 2, inp.get("calendar") or "shift")
    tr = inp.get("transfer") or 0
    M, by_id = {}, {}
    for typ, lst in (inp.get("machines") or {}).items():
        M[typ] = [{"id": m["id"], "type": typ, "free": m.get("free") or 0, "lastKey": m.get("lastKey") or "", "lastFam": m.get("lastFam") or "", "ht": bool(m.get("ht")), "busy": 0.0} for m in lst]
        for m in M[typ]:
            by_id[m["id"]] = m
    X = [{"L": L, "k": 0, "ready": L.get("release") or 0} for L in lots_in]
    out = []
    majors = minors = n_load = unsched = 0
    setup_min = 0.0

    def p_t(op, qty):
        return op["cyc"] * op["batch"] if op.get("furnace") else qty * op["cyc"]

    def fam_pref(m, op):
        if m["lastKey"] and m["lastKey"] == op.get("key"):
            return 2
        if op.get("fam") and m["lastFam"] == op.get("fam"):
            return 1
        return 0

    def setup_of(m, op):
        f = fam_pref(m, op)
        if op.get("furnace") or f == 2:
            return 0, ""
        if f == 1:
            sm = op.get("setupMinor")
            return (op["setup"] if sm is None else sm), "minor"
        return op["setup"], ("major" if op["setup"] > 0 else "")

    for x in X:
        F = x["L"].get("fixed")
        if not F or not x["L"]["ops"]:
            continue
        m, op = by_id.get(F["machine"]), x["L"]["ops"][0]
        L = x["L"]
        out.append({"lot": L["id"], "wo": L.get("wo", ""), "code": L.get("code", ""), "route": L.get("route", ""), "k": 0, "no": op["no"], "m": op["m"], "machine": F["machine"],
                    "start": 0, "end": F["end"], "setup": 0, "setupKind": "", "qty": L["qty"], "load": "", "due": L["due"], "fixed": True})
        if m:
            m["free"] = max(m["free"], F["end"])
            m["lastKey"] = op.get("key", "")
            if op.get("fam"):
                m["lastFam"] = op["fam"]
            m["busy"] += F["end"]
        x["ready"] = F["end"] + tr
        x["k"] = 1

    def rem_work(x):
        return sum(o["setup"] + p_t(o, x["L"]["qty"]) for o in x["L"]["ops"][x["k"]:])

    def key(c, t):
        L, op = c["x"]["L"], c["op"]
        if rule == "FIFO":
            return [L.get("release") or 0]
        if rule == "SPT":
            return [setup_of(c["m"], op)[0] + p_t(op, L["qty"])]
        if rule == "CR":
            return [(L["due"] - t) / max(EPS, rem_work(c["x"]))]
        if rule == "FAM":
            return [0 if fam_pref(c["m"], op) >= 1 else 1, L["due"]]
        return [L["due"]]

    def cmp(a, b, t):
        ka, kb = key(a, t), key(b, t)
        for i in range(len(ka)):
            if ka[i] < kb[i] - EPS:
                return -1
            if ka[i] > kb[i] + EPS:
                return 1
        ia, ib = a["x"]["L"]["id"], b["x"]["L"]["id"]
        return -1 if ia < ib else 1 if ia > ib else a["x"]["k"] - b["x"]["k"]

    import functools
    for _ in range(200000):
        cand = []
        for x in X:
            if x["k"] >= len(x["L"]["ops"]):
                continue
            op = x["L"]["ops"][x["k"]]
            ms = M.get(op["m"])
            if not ms:
                unsched += 1
                x["k"] = len(x["L"]["ops"])
                continue
            best = None
            for m in ms:
                est = C.next_work(max(x["ready"], m["free"]), m["ht"])
                if best is None or est < best["est"] - EPS or (abs(est - best["est"]) <= EPS and fam_pref(m, op) > fam_pref(best["m"], op)):
                    best = {"m": m, "est": est}
            cand.append({"x": x, "op": op, "m": best["m"], "est": best["est"]})
        if not cand:
            break
        tmin = min(c["est"] for c in cand)
        conf = [c for c in cand if c["est"] <= tmin + EPS]
        conf.sort(key=functools.cmp_to_key(lambda a, b: cmp(a, b, tmin)))
        pick = conf[0]
        m, op, start = pick["m"], pick["op"], pick["est"]
        if op.get("furnace"):
            load, q = [pick], pick["x"]["L"]["qty"]
            others = [c for c in cand if c is not pick and c["op"]["m"] == op["m"] and c["op"].get("furnace") and c["x"]["ready"] <= start + EPS]
            others.sort(key=functools.cmp_to_key(lambda a, b: cmp(a, b, start)))
            for c in others:
                if q + c["x"]["L"]["qty"] <= op["batch"]:
                    load.append(c)
                    q += c["x"]["L"]["qty"]
            dur = op["cyc"] * op["batch"]
            end = C.add_work(start, dur, m["ht"])
            n_load += 1
            lid = f"LOAD-{n_load:03d}"
            for c in load:
                L = c["x"]["L"]
                out.append({"lot": L["id"], "wo": L.get("wo", ""), "code": L.get("code", ""), "route": L.get("route", ""), "k": c["x"]["k"], "no": c["op"]["no"], "m": op["m"],
                            "machine": m["id"], "start": start, "end": end, "setup": 0, "setupKind": "", "qty": L["qty"], "load": lid, "fill": q, "cap": op["batch"], "due": L["due"]})
                c["x"]["ready"] = end + tr
                c["x"]["k"] += 1
            m["free"] = end
            m["busy"] += dur
        else:
            st, sk = setup_of(m, op)
            L = pick["x"]["L"]
            dur = st + L["qty"] * op["cyc"]
            end = C.add_work(start, dur, m["ht"])
            out.append({"lot": L["id"], "wo": L.get("wo", ""), "code": L.get("code", ""), "route": L.get("route", ""), "k": pick["x"]["k"], "no": op["no"], "m": op["m"],
                        "machine": m["id"], "start": start, "end": end, "setup": st, "setupKind": sk, "qty": L["qty"], "load": "", "due": L["due"]})
            if sk == "major":
                majors += 1
            elif sk == "minor":
                minors += 1
            setup_min += st
            m["free"] = end
            m["lastKey"] = op.get("key", "")
            if op.get("fam"):
                m["lastFam"] = op["fam"]
            m["busy"] += dur
            pick["x"]["ready"] = end + tr
            pick["x"]["k"] += 1
    lot_res, horizon = {}, 0.0
    for o in out:
        horizon = max(horizon, o["end"])
        r = lot_res.setdefault(o["lot"], {"end": 0.0, "due": o["due"], "release": 0})
        r["end"] = max(r["end"], o["end"])
    on_time = n = 0
    tard = max_t = flow = 0.0
    for x in X:
        r = lot_res.get(x["L"]["id"])
        if not r:
            continue
        n += 1
        r["release"] = x["L"].get("release") or 0
        t = max(0.0, r["end"] - x["L"]["due"])
        r["tard"] = t
        tard += t
        max_t = max(max_t, t)
        if t <= EPS:
            on_time += 1
        flow += r["end"] - r["release"]
    util = {}
    for typ, ms in M.items():
        busy = sum(m["busy"] for m in ms)
        av = sum(C.work_between(0, horizon, m["ht"]) for m in ms)
        util[typ] = busy / av if av > 0 else 0
    kpi = {"lots": n, "onTimePct": 100 * on_time / n if n else 100, "tardSum": tard, "tardMax": max_t, "flowMean": flow / n if n else 0,
           "wipMean": flow / horizon if horizon > 0 else 0, "makespan": horizon, "majors": majors, "minors": minors, "setupMin": setup_min,
           "loads": n_load, "unscheduled": unsched, "util": util}
    return {"ops": out, "kpi": kpi, "lots": lot_res}


# ------------------------------------------------------------------ OEE (ISO 22400-2)
def oee_iso(PBT, down=0.0, setup=0.0, PRI=0.0, PQ=0, GQ=0):
    APT = max(0.0, PBT - down - setup)
    A = APT / PBT if PBT > 0 else 0.0
    E = PRI * PQ / APT if APT > 0 else 0.0
    Q = GQ / PQ if PQ > 0 else 0.0
    return {"APT": APT, "A": A, "E": E, "Q": Q, "OEE": A * E * Q}


def kanban_bins(D, LT, a, C):
    return math.ceil(D * LT * (1 + a) / C - EPS)
