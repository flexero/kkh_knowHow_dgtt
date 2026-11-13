"""
Ball screw + guide factory (item 6) - MES service (stdlib only): work orders, lots, scheduling, dispatch, confirmations, downtime,
holds, serial numbers + genealogy, heat-treatment loads, transport requests, kanban, finished goods, OEE, shift report.
Guide: docs/45_bsf_mes.md.  Page: web/bsfmes.js (#bfItem6).  Browser twin of this service: web/bsfmes_core.js (same model + paths).

INERT UNTIL USED: importing starts nothing (no thread, no port, no file). server.py routes /api/bsf/mes/... (and /api/bsf/v1/mes/...)
here with a lazy import. Persistence: one SQLite file, opened and written ONLY after the first state-changing request (POST):
  path = env BSF_MES_DB, else <folder of the server's --db>/bsf_mes.sqlite, else <repo>/data/bsf_mes.sqlite
  table state (k, v JSON, t) = whole MES state (saved at most every 5 s, at once for planner / quality / terminal actions),
  table journal (seq, t, kind, text) = audit trail. Turn off with POST /api/bsf/mes/control {"action": "persist", "on": false}.

Links (all in the same Python process, all HTTP-shaped):
  * gateway (item 4, twin/bsf_comm.py): order download = Gateway.command() (FC16 block 200-225 + FC06 REQ toggle + FC03 ACK poll);
    counters (hs.lotDone, std.good/scrap) + states (std.stateCode, std.alarm) are pulled on read (max. 1 per second) -> confirmations, downtime
  * quality (item 5, twin/bsf_qa.py): NOK results + open NCRs -> lot hold, 2 of 3 NOK of one characteristic on one machine -> SPC stop;
    trace?serial= shows the measurement records of that serial
  * AGV fleet + ERP demo (item 4, twin/bsf_comm_api.py): POST agv/transportorders, POST erp/goodsmovements
Conventions = item 4: JSON camelCase, Idempotency-Key (or body msgId) for POST, problem+json errors (RFC 9457), paging.
Routes: see API below (= web/bsfmes_data.js API6). ALL VALUES ARE EXAMPLES.
"""

from __future__ import annotations

import calendar as _cal
import collections
import json
import math
import os
import sqlite3
import sys
import threading
import time

from twin import bsf_mes_core as C

VERSION = "bsf_mes 1.0"
LOCK = threading.RLock()
S: dict = {}
IDEM = collections.OrderedDict()
PERSIST = {"on": True, "path": None, "db": None, "loaded": False, "saved": 0.0, "dirty": False, "error": ""}
PULL = {"gw": 0.0, "qa": 0.0}

API = [
    ["GET", "/api/bsf/mes/health", "service health, counts, persistence file, gateway reachable?"],
    ["GET", "/api/bsf/mes/api", "this route list"],
    ["GET", "/api/bsf/mes/workorders?status=&page=1&size=20", "work orders (paged)"],
    ["POST", "/api/bsf/mes/workorders", "create {product, qty, due | dueDays, erpOrder, priority, lots?} (Idempotency-Key)"],
    ["GET", "/api/bsf/mes/workorders/{id}", "one work order with lines, lots and operations"],
    ["POST", "/api/bsf/mes/workorders/{id}/release", "readiness check + release; 409 wrong state, 422 not ready ({force: true} overrides)"],
    ["POST", "/api/bsf/mes/workorders/{id}/cancel", "cancel a 'created' work order {reason}"],
    ["GET", "/api/bsf/mes/lots?wo=&status=", "lots"],
    ["GET", "/api/bsf/mes/lots/{id}", "one lot with operations, serials, heat, hold"],
    ["POST", "/api/bsf/mes/lots/{id}/hold", "quality hold {reason, ncr, by}"],
    ["POST", "/api/bsf/mes/lots/{id}/release", "release a hold {by, text}"],
    ["GET", "/api/bsf/mes/dispatch?machine=BS-TGR-03", "dispatch list of one machine"],
    ["POST", "/api/bsf/mes/confirmations", "confirmation {lot | wo, op, machine, good, scrap, setupMin, runMin, serial} (Idempotency-Key)"],
    ["GET", "/api/bsf/mes/confirmations?lot=&n=50", "newest confirmations"],
    ["POST", "/api/bsf/mes/schedule", "finite-capacity schedule {rule: EDD|SPT|CR|FIFO|FAM, dbr, bufferH, compare, case?}"],
    ["GET", "/api/bsf/mes/schedule", "last schedule"],
    ["GET", "/api/bsf/mes/machines", "MES view of all machines"],
    ["POST", "/api/bsf/mes/machines/{id}/download", "order download {lot} -> gateway (FC16 + FC06 toggle + FC03 ACK)"],
    ["POST", "/api/bsf/mes/machines/{id}/spc", "SPC alarm on / off {alarm, char}"],
    ["GET", "/api/bsf/mes/downtime?machine=&open=1", "downtime records"],
    ["POST", "/api/bsf/mes/downtime", "downtime from the terminal {machine, reason, minutes | start/end, comment}"],
    ["POST", "/api/bsf/mes/downtime/{id}/reason", "classify {reason, by}"],
    ["GET", "/api/bsf/mes/reasons", "reason codes"],
    ["GET", "/api/bsf/mes/andon", "andon board"],
    ["POST", "/api/bsf/mes/andon/call", "andon call {machine, kind: supervisor|maintenance|quality|logistics}"],
    ["GET", "/api/bsf/mes/oee?machine=&type=", "OEE per machine / type / line / plant (ISO 22400)"],
    ["GET", "/api/bsf/mes/report?hours=7.5", "shift report"],
    ["GET", "/api/bsf/mes/pareto", "downtime Pareto (all records)"],
    ["GET", "/api/bsf/mes/serials?lot=", "serial numbers"],
    ["POST", "/api/bsf/mes/serials", "create serials {lot, n} -> GS1 label data"],
    ["POST", "/api/bsf/mes/genealogy/link", "assembly scan {parent, children}"],
    ["GET", "/api/bsf/mes/trace?serial= | ?heat=", "genealogy + operations + measurement records / where-used"],
    ["GET", "/api/bsf/mes/htloads", "furnace loads"],
    ["POST", "/api/bsf/mes/htloads", "build a furnace load {furnace, lots}"],
    ["POST", "/api/bsf/mes/transport", "transport request -> AGV fleet POST /api/bsf/agv/transportorders"],
    ["GET", "/api/bsf/mes/kanban", "kanban loops"],
    ["POST", "/api/bsf/mes/kanban/{item}/scan", "empty bin scanned -> replenishment signal"],
    ["POST", "/api/bsf/mes/fg", "finished-goods booking {lot, qty} -> ERP goods receipt"],
    ["POST", "/api/bsf/mes/twin", "shop-floor state from the twin page -> confirmations, downtime, loads"],
    ["POST", "/api/bsf/mes/sync", "pull the Modbus TCP gateway now"],
    ["POST", "/api/bsf/mes/eval", "calculation cross-check {kind: oee | schedule | kanban | little}"],
    ["GET", "/api/bsf/mes/events?since=0", "audit journal"],
    ["POST", "/api/bsf/mes/control", "{action: reset | persist, on}"],
]
STATE_COLOR = {"RUN": "green", "SETUP": "blue", "IDLE": "grey", "OFF": "grey", "STARVED": "yellow", "BLOCKED": "yellow", "DOWN": "red"}
STATE_CODES = {0: "OFF", 1: "IDLE", 2: "RUN", 3: "SETUP", 4: "DOWN", 5: "BLOCKED", 6: "STARVED"}


def now():
    return time.time()


def fmt(t):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t)) if t is not None else None


def tod0():
    lt = time.localtime()
    return ((lt.tm_hour * 60 + lt.tm_min + lt.tm_sec / 60) - 360) % 1440


def date_of(t):
    return time.strftime("%y%m%d", time.localtime(t))


def parse_due(s):
    s = str(s)
    for f, n in (("%Y-%m-%dT%H:%M:%S", 19), ("%Y-%m-%d", 10)):
        try:
            return float(_cal.timegm(time.strptime(s[:n], f)))
        except (ValueError, OverflowError):
            continue
    return None


def r2(v, d=2):
    return round(v, d)


# ====================================================================== state
def _machines():
    from twin import bsf_comm_map as MAP  # pure data (machine list + IP plan), no threads
    return [(m["id"], m["type"]) for m in MAP.MACHINES]


def _fresh():
    st = {"wo": {}, "lots": {}, "conf": [], "ser": {}, "heats": [{"heat": h[0], "mat": h[1], "route": h[2], "qty": h[3], "used": 0, "cert": "EN 10204 3.1"} for h in C.HEATS],
          "ht": {}, "dt": [], "tr": {}, "calls": [], "fg": [], "kb": {}, "mach": {}, "sched": None, "events": [], "seq": {}, "serialNo": {},
          "twin": {"orders": {}, "lotSeen": {}, "kpi": None, "t": 0}}
    for item, n, per, use, cc, lt, a in C.KANBAN:
        D = per * C.KANBAN_DAY.get(use, 100)
        N = C.kanban_bins(D, lt, a, cc)
        st["kb"][item] = {"item": item, "n": n, "per": per, "use": use, "C": cc, "LT": lt, "a": a, "D": D, "N": N, "full": N, "signals": 0, "pending": [], "used": 0}
    for mid, typ in _machines():
        st["mach"][mid] = {"id": mid, "type": typ, "state": "IDLE", "lot": "", "spcStop": None, "download": None, "live": None, "dtOpen": None}
    return st


def nid(p, w=5):
    S["seq"][p] = S["seq"].get(p, 0) + 1
    return f"{p}-{S['seq'][p]:0{w}d}"


def ev(kind, text, **extra):
    S["seq"]["ev"] = S["seq"].get("ev", 0) + 1
    e = {"seq": S["seq"]["ev"], "t": now(), "at": fmt(now()), "kind": kind, "text": text, **extra}
    S["events"].append(e)
    if len(S["events"]) > 2000:
        del S["events"][0]
    _journal(e)
    return e


def prob(status, title, detail="", **extra):
    return status, {"type": "https://plant.example/problems/" + title.replace(" ", "-"), "title": title, "status": status, "detail": detail, **extra}, "application/problem+json; charset=utf-8"


def ok(status, body):
    return status, body, "application/json; charset=utf-8"


# ====================================================================== persistence (SQLite, lazy)
def _db_path():
    if os.environ.get("BSF_MES_DB"):
        return os.environ["BSF_MES_DB"]
    a = sys.argv
    for i, x in enumerate(a):
        if x == "--db" and i + 1 < len(a):
            return os.path.join(os.path.dirname(os.path.abspath(a[i + 1])), "bsf_mes.sqlite")
        if x.startswith("--db="):
            return os.path.join(os.path.dirname(os.path.abspath(x[5:])), "bsf_mes.sqlite")
    return os.path.join(C.ROOT, "data", "bsf_mes.sqlite")


def _ensure():
    """first access: load the saved state if the file exists (never creates it)."""
    global S
    if S:
        return
    S = _fresh()
    p = PERSIST["path"] = _db_path()
    if PERSIST["on"] and os.path.exists(p):
        try:
            db = sqlite3.connect(p, check_same_thread=False)
            row = db.execute("SELECT v FROM state WHERE k = 'mes'").fetchone()
            if row:
                saved = json.loads(row[0])
                base = _fresh()
                base.update({k: v for k, v in saved.items() if k in base and k != "mach"})
                for mid, m in (saved.get("mach") or {}).items():
                    if mid in base["mach"]:
                        base["mach"][mid].update({k: m.get(k) for k in ("spcStop", "download")})
                S = base
                PERSIST["loaded"] = True
            PERSIST["db"] = db
        except (sqlite3.Error, ValueError) as e:
            PERSIST["error"] = f"load failed: {e}"
    if not S["wo"]:
        _seed()


def _open_db():
    if PERSIST["db"] is not None or not PERSIST["on"]:
        return PERSIST["db"]
    try:
        p = PERSIST["path"] or _db_path()
        os.makedirs(os.path.dirname(p), exist_ok=True)
        db = sqlite3.connect(p, check_same_thread=False)
        db.execute("CREATE TABLE IF NOT EXISTS state (k TEXT PRIMARY KEY, v TEXT, t REAL)")
        db.execute("CREATE TABLE IF NOT EXISTS journal (seq INTEGER, t REAL, kind TEXT, text TEXT)")
        db.commit()
        PERSIST["db"], PERSIST["path"] = db, p
    except (sqlite3.Error, OSError) as e:
        PERSIST["error"] = f"open failed: {e}"
    return PERSIST["db"]


def _journal(e):
    db = PERSIST["db"]
    if db is not None and PERSIST["on"]:
        try:
            db.execute("INSERT INTO journal VALUES (?, ?, ?, ?)", (e["seq"], e["t"], e["kind"], e["text"]))
        except sqlite3.Error:
            pass


def _save(force=False):
    if not PERSIST["on"]:
        return
    PERSIST["dirty"] = True
    if not force and now() - PERSIST["saved"] < 5:
        return
    db = _open_db()
    if db is None:
        return
    try:
        snap = {k: v for k, v in S.items() if k != "mach"}
        snap["mach"] = {k: {"spcStop": m["spcStop"], "download": m["download"]} for k, m in S["mach"].items()}
        db.execute("INSERT OR REPLACE INTO state VALUES ('mes', ?, ?)", (json.dumps(snap, default=str), now()))
        db.commit()
        PERSIST["saved"], PERSIST["dirty"] = now(), False
    except (sqlite3.Error, TypeError, ValueError) as e:
        PERSIST["error"] = f"save failed: {e}"


# ====================================================================== work orders + lots
def make_lot(lid, wo, route, code, qty):
    L = {"id": lid, "wo": wo["id"], "route": route, "code": code, "fam": (C.prod_info(code) or {}).get("fam", ""), "qty": qty, "qty0": qty,
         "status": "planned" if wo["status"] == "created" else "queued", "i": 0, "hold": None, "heat": "", "ops": C.route_ops(route, code), "serials": [],
         "t0": now(), "tDone": None, "machine": "", "started": False}
    if L["ops"]:
        L["ops"][0]["qtyIn"] = qty
    S["lots"][lid] = L
    wo["lots"].append(lid)
    return L


def create_wo(b, id_override=None):
    p = C.prod_info(b.get("product"))
    if not p:
        return prob(400, "unknown product", "product = code (e.g. BS-3210-1000-C5) or BS | BN | LG | LB | FABS | FALG")
    try:
        qty = int(round(float(b.get("qty") or 0)))
    except (TypeError, ValueError):
        qty = 0
    if not 1 <= qty <= 5000:
        return prob(422, "quantity out of range", "1 ... 5000")
    if b.get("dueT") is not None:
        due = float(b["dueT"])
    elif b.get("dueDays") is not None:
        due = now() + float(b["dueDays"]) * 86400
    else:
        due = (parse_due(b["due"]) if b.get("due") else None) or now() + 5 * 86400
    wid = id_override or nid("WO")
    wo = {"id": wid, "erpOrder": str(b.get("erpOrder", ""))[:30], "product": p["code"], "route": p["route"], "qty": qty, "due": due, "dueAt": fmt(due),
          "priority": int(b.get("priority") or 5), "routingVersion": f"R-{p['route']}-01", "status": "created", "created": now(), "createdAt": fmt(now()),
          "released": None, "releasedAt": None, "done": None, "lines": [], "lots": [], "source": str(b.get("source", "api"))[:16], "good": 0}
    S["wo"][wid] = wo
    if p["route"] in C.SETS:
        lines = []
        for r, k in C.SETS[p["route"]]:
            pc = next((x[0] for x in p["parts"] if C.prod_info(x[0])["route"] == r), r)
            lines.append({"route": r, "code": C.prod_info(pc)["code"], "need": qty * k})
        lines.append({"route": p["route"], "code": p["code"], "need": qty})
    else:
        lines = [{"route": p["route"], "code": p["code"], "need": qty}]
    given = b.get("lots") if isinstance(b.get("lots"), list) else None
    for ln in lines:
        ln["start"] = ln["need"] if ln["route"] in C.SETS else math.ceil(ln["need"] / C.route_yield(ln["route"]) - C.EPS)
        ln["lots"] = []
        if given is not None:
            continue
        n = math.ceil(ln["start"] / C.LOT6[ln["route"]])
        for k in range(n):
            q = min(C.LOT6[ln["route"]], ln["start"] - k * C.LOT6[ln["route"]])
            L = make_lot(f"{wid}-{ln['route']}-{k + 1:02d}", wo, ln["route"], ln["code"], q)
            ln["lots"].append(L["id"])
    for x in given or []:
        ln = next((l for l in lines if l["route"] == x.get("route")), None)
        if ln:
            L = make_lot(str(x["id"]), wo, x["route"], ln["code"], int(x.get("qty") or 1))
            ln["lots"].append(L["id"])
    wo["lines"] = lines
    ev("wo", f"{wid} created: {qty} × {p['code']}, due {wo['dueAt']}" + (f" (ERP {wo['erpOrder']})" if wo["erpOrder"] else ""), wo=wid)
    if b.get("release"):
        release_wo(wo, True)
    return ok(201, wo_view(wo))


def readiness(wo):
    items = []
    today = time.strftime("%Y-%m-%d")
    for ln in wo["lines"]:
        if ln["route"] in C.SETS:
            items.append({"kind": "material", "item": f"components for {ln['route']}", "ok": True, "text": "made in this work order (component lots)"})
            continue
        free = sum(h["qty"] - h["used"] for h in S["heats"] if h["route"] == ln["route"])
        items.append({"kind": "material", "item": f"{ln['route']} raw material (heat lots)", "ok": free >= ln["start"], "text": f"need {ln['start']}, free {free}"})
        fam = (C.prod_info(ln["code"]) or {}).get("fam")
        ops = C.route_ops(ln["route"], ln["code"])
        for o in ops:
            if o["m"] in C.TOOLSETS:
                have = fam in C.TOOLSETS[o["m"]]
                items.append({"kind": "tool", "item": f"{o['m']} wheel + dresser set {fam}", "ok": have, "text": "in the tool store, measured" if have else "NOT available – order the dresser / wheel set"})
        for gid, typ, gname, due in C.GAUGES6:
            if any(o["m"] == typ for o in ops):
                items.append({"kind": "gauge", "item": f"{gid} {gname}", "ok": due > today, "text": f"calibration due {due}"})
    return {"ok": all(i["ok"] for i in items), "items": items}


def release_wo(wo, force=False):
    if wo["status"] != "created":
        return prob(409, "wrong state", f"{wo['id']} is '{wo['status']}', only 'created' can be released")
    r = readiness(wo)
    if not r["ok"] and not force:
        return prob(422, "not ready", "; ".join(f"{i['item']}: {i['text']}" for i in r["items"] if not i["ok"]), readiness=r)
    for lid in wo["lots"]:
        L = S["lots"][lid]
        if L["status"] == "planned":
            L["status"] = "queued"
        assign_heat(L)
    wo["status"], wo["released"], wo["releasedAt"] = "released", now(), fmt(now())
    ev("wo", f"{wo['id']} released ({len(wo['lots'])} lots)" + ("" if r["ok"] else " – FORCED, not ready: " + ", ".join(i["item"] for i in r["items"] if not i["ok"])), wo=wo["id"])
    return ok(200, {**wo_view(wo), "readiness": r})


def assign_heat(L):
    """material issue: FIFO from the heat lots; the ERP keeps at least one full heat lot in stock (demo goods receipt)."""
    if L["route"] in C.SETS or L["heat"]:
        return
    h = next((x for x in S["heats"] if x["route"] == L["route"] and x["qty"] - x["used"] >= L["qty"]), None) or receive_heat(L["route"])
    if not h:
        return
    h["used"] += L["qty"]
    L["heat"] = h["heat"]
    base = next((x for x in C.HEATS if x[2] == L["route"]), None)
    free = sum(x["qty"] - x["used"] for x in S["heats"] if x["route"] == L["route"])
    if base and free < base[3]:
        receive_heat(L["route"])


def receive_heat(route):
    b = next((x for x in C.HEATS if x[2] == route), None)
    if not b:
        return None
    k = "heat" + route
    S["seq"][k] = S["seq"].get(k, 0) + 1
    h = {"heat": b[0][0] + str(int(b[0][1:]) + 100 + 7 * S["seq"][k]), "mat": b[1], "route": route, "qty": b[3], "used": 0, "cert": "EN 10204 3.1", "received": fmt(now()), "note": "goods receipt (demo)"}
    S["heats"].append(h)
    same = [x for x in S["heats"] if x["route"] == route]
    if len(same) > 12:
        old = next((x for x in same if x["used"] >= x["qty"]), None)
        if old:
            S["heats"].remove(old)
    return h


def wo_view(wo):
    lots = [S["lots"][i] for i in wo["lots"] if i in S["lots"]]
    ops = []
    for ln in wo["lines"]:
        ls = [l for l in lots if l["route"] == ln["route"]]
        tmpl = ls[0]["ops"] if ls else C.route_ops(ln["route"], ln["code"])
        for j, o in enumerate(tmpl):
            st = "done" if ls and all(len(l["ops"]) > j and l["ops"][j]["status"] == "done" for l in ls) else \
                "running" if any(len(l["ops"]) > j and l["ops"][j]["status"] != "open" for l in ls) else "open"
            ops.append({"op": o["no"], "machineType": o["m"], "route": ln["route"], "name": o["n"], "status": st,
                        "good": sum(l["ops"][j]["good"] for l in ls if len(l["ops"]) > j), "scrap": sum(l["ops"][j]["scrap"] for l in ls if len(l["ops"]) > j)})
    return {"id": wo["id"], "erpOrder": wo["erpOrder"], "product": wo["product"], "route": wo["route"], "material": wo["product"], "qty": wo["qty"], "due": wo["dueAt"],
            "dueT": wo["due"], "priority": wo["priority"], "routingVersion": wo["routingVersion"], "status": wo["status"], "created": wo["createdAt"],
            "released": wo["releasedAt"], "good": wo["good"], "lines": [{k: l[k] for k in ("route", "code", "need", "start", "lots")} for l in wo["lines"]],
            "lots": wo["lots"], "operations": ops, "holds": [l["id"] for l in lots if l["hold"]], "source": wo["source"]}


def wo_row(w):
    return {"id": w["id"], "erpOrder": w["erpOrder"], "product": w["product"], "route": w["route"], "material": w["product"], "qty": w["qty"], "due": w["dueAt"],
            "dueT": w["due"], "status": w["status"], "good": w["good"], "lots": len(w["lots"]), "source": w["source"],
            "holds": sum(1 for i in w["lots"] if i in S["lots"] and S["lots"][i]["hold"])}


def lot_view(L):
    w = S["wo"].get(L["wo"], {})
    cur = L["ops"][L["i"]] if L["i"] < len(L["ops"]) else None
    return {**L, "woProduct": w.get("product"), "dueT": w.get("due"), "due": w.get("dueAt"), "opNow": cur["no"] if cur else "", "mNow": cur["m"] if cur else ""}


# ====================================================================== confirmations
def confirm(b, source=None):
    L = S["lots"].get(b.get("lot")) if b.get("lot") else None
    if b.get("lot") and not L:
        return prob(404, "unknown lot", str(b.get("lot")))
    wo = S["wo"].get(L["wo"]) if L else S["wo"].get(b.get("wo"))
    if not wo:
        return prob(404, "unknown work order", str(b.get("wo")))
    if wo["status"] not in ("released", "running"):
        return prob(409, "wrong state", f"{wo['id']} is '{wo['status']}'")
    try:
        g, s = int(round(float(b.get("good") or 0))), int(round(float(b.get("scrap") or 0)))
    except (TypeError, ValueError):
        return prob(400, "good / scrap must be numbers")
    if g < 0 or s < 0:
        return prob(400, "negative quantity")
    op_no = str(b.get("op") if b.get("op") is not None else "")
    mt = str(b.get("machine") or "").rsplit("-", 1)[0] if str(b.get("machine") or "")[-2:].isdigit() else str(b.get("machine") or "")
    if not L:
        lots = [S["lots"][i] for i in wo["lots"] if i in S["lots"]]
        L = next((l for l in lots if any(o["no"] == op_no and o["m"] == mt and o["status"] != "done" for o in l["ops"])), None) or \
            next((l for l in lots if any(o["no"] == op_no and o["status"] != "done" for o in l["ops"])), None) or \
            next((l for l in lots if any(o["no"] == op_no for o in l["ops"])), None)
    jj = -1
    if L:
        if op_no:
            jj = next((j for j, o in enumerate(L["ops"]) if o["no"] == op_no and (not mt or o["m"] == mt)), -1)
            if jj < 0:
                jj = next((j for j, o in enumerate(L["ops"]) if o["no"] == op_no), -1)
        else:
            jj = L["i"] if L["i"] < len(L["ops"]) else -1
    if not L or jj < 0:
        return prob(422, "unknown operation", op_no)
    if L["hold"] and source != "twin":
        return prob(423, "lot on hold", f"{L['id']}: {L['hold']['reason']}")
    op = L["ops"][jj]
    op["good"] += g
    op["scrap"] += s
    op["machine"] = b.get("machine") or op["machine"]
    if op["tStart"] is None:
        op["tStart"] = b.get("tStart") if b.get("tStart") is not None else now()
    op["status"] = "running"
    L["started"] = True
    if not op["qtyIn"]:
        op["qtyIn"] = L["qty"]
    c = {"id": nid("CF"), "wo": wo["id"], "lot": L["id"], "op": op["no"], "machine": str(b.get("machine") or ""), "good": g, "scrap": s,
         "setupMin": float(b.get("setupMin") or 0), "runMin": float(b.get("runMin") or 0), "source": source or str(b.get("source") or "api"),
         "serial": str(b.get("serial") or ""), "grade": str(b.get("grade") or ""), "t": now(), "at": fmt(now())}
    S["conf"].append(c)
    if len(S["conf"]) > 20000:
        del S["conf"][: len(S["conf"]) - 20000]
    if wo["status"] == "released":
        wo["status"] = "running"
    if b.get("serial") and b["serial"] in S["ser"] and b.get("grade"):
        S["ser"][b["serial"]]["grade"] = b["grade"]
    if op["good"] + op["scrap"] >= op["qtyIn"] or b.get("final"):
        finish_op(L, jj, b.get("tEnd") if b.get("tEnd") is not None else now())
    return ok(201, c)


def finish_op(L, j, t_end):
    op = L["ops"][j]
    op["status"], op["tEnd"] = "done", t_end
    L["qty"] = op["good"]
    if op["no"] == C.MARK_OP.get(L["route"]):
        make_serials(L, op["good"], op["machine"])
    if L["route"] in C.KANBAN_OP and op["no"] == C.KANBAN_OP[L["route"]]:
        use_kanban(L["route"], op["good"])
    if j == L["i"]:
        L["i"] = j + 1
        while L["i"] < len(L["ops"]) and L["ops"][L["i"]]["status"] == "done":
            L["i"] += 1
    if L["i"] < len(L["ops"]):
        L["ops"][L["i"]]["qtyIn"] = L["qty"]
    if L["qty"] <= 0:
        L["status"], L["tDone"] = "scrapped", t_end
        ev("lot", f"{L['id']} fully scrapped at op {op['no']}", lot=L["id"])
    elif L["i"] >= len(L["ops"]):
        L["status"], L["tDone"] = "done", t_end
        lot_done(L)
    elif not L["hold"]:
        L["status"] = "queued"


def lot_done(L):
    wo = S["wo"].get(L["wo"])
    ev("lot", f"{L['id']} done: {L['qty']} good {L['code']}", lot=L["id"])
    if wo and wo["route"] == L["route"]:
        wo["good"] += L["qty"]
        S["fg"].append({"id": nid("FG"), "lot": L["id"], "wo": wo["id"], "code": L["code"], "qty": L["qty"], "t": now(), "at": fmt(now()), "auto": True, "erp": _erp_gr(L["code"], L["qty"], wo["id"])})
    if wo and all(S["lots"][i]["status"] in ("done", "scrapped") for i in wo["lots"] if i in S["lots"]) and wo["status"] != "done":
        wo["status"], wo["done"] = "done", now()
        ev("wo", f"{wo['id']} done ({wo['good']} good of {wo['qty']})", wo=wo["id"])


# ====================================================================== serials + genealogy
def _prefix(L):
    return C.SERIAL_PREFIX[L["route"]] if L["route"] in C.SETS else "".join(L["code"].split("-")[:2])


def new_serial(L):
    k = _prefix(L) + "-" + date_of(now())
    S["serialNo"][k] = S["serialNo"].get(k, 0) + 1
    return f"{k}-{S['serialNo'][k]:04d}"


def make_serials(L, n, machine=""):
    out = []
    kind = (C.prod_info(L["code"]) or {}).get("kind", "part")
    n = max(0, min(n, L["qty0"] * 2) - len(L["serials"]))
    for _ in range(n):
        sn = new_serial(L)
        s = {"sn": sn, "code": L["code"], "kind": kind, "route": L["route"], "lot": L["id"], "wo": L["wo"], "heat": L["heat"], "status": "ok", "parent": "",
             "children": [], "grade": "", "t": now(), "at": fmt(now()), "machine": machine or "", "label": C.gs1_element(sn, L["id"][:20], L["code"], date_of(now()))["hr"]}
        if L["route"] in C.SETS:
            _link(s, L)
        S["ser"][sn] = s
        L["serials"].append(sn)
        out.append(s)
    if len(S["ser"]) > 8000:
        for k in list(S["ser"])[: len(S["ser"]) - 8000]:
            del S["ser"][k]
    return out


def _link(s, L):
    for r, k in C.SETS[L["route"]]:
        for _ in range(k):
            free = [x for x in S["ser"].values() if x["route"] == r and not x["parent"] and x["status"] == "ok"]
            c = next((x for x in free if x["wo"] == L["wo"]), None) or (free[0] if free else None)
            if c:
                c["parent"] = s["sn"]
                s["children"].append(c["sn"])
            else:
                s["children"].append(f"(missing {r})")
    if L["route"] == "FALG":
        s["match"] = "rail + 2 carriages matched: height class H, pair variation ≤ 15 µm (example)"


def link_manual(parent, children):
    p = S["ser"].get(parent)
    if not p:
        return prob(404, "unknown serial", str(parent))
    bad = [c for c in children if c not in S["ser"]]
    if bad:
        return prob(404, "unknown serial", ", ".join(bad))
    used = [c for c in children if S["ser"][c]["parent"] and S["ser"][c]["parent"] != parent]
    if used:
        return prob(409, "already built in", ", ".join(f"{c} -> {S['ser'][c]['parent']}" for c in used))
    for c in children:
        S["ser"][c]["parent"] = parent
        if c not in p["children"]:
            p["children"].append(c)
    ev("trace", f"scan: {', '.join(children)} built into {parent}")
    return ok(200, trace_serial(parent))


def _qa_records(sn):
    try:
        from twin import bsf_qa
        return [{k: r.get(k) for k in ("char", "name", "value", "unit", "lsl", "usl", "decision", "op", "machine", "gauge", "operator", "tMeas")} for r in bsf_qa.DB["res"] if r["serial"] == sn][-40:]
    except Exception:  # noqa: BLE001 - item 5 optional
        return []


def _node(sn, depth=0):
    s = S["ser"].get(sn)
    if not s:
        return {"sn": sn, "missing": True}
    L = S["lots"].get(s["lot"])
    h = next((x for x in S["heats"] if x["heat"] == s["heat"]), None)
    ops = [{"op": o["no"], "name": o["n"], "machine": o["machine"], "good": o["good"], "scrap": o["scrap"], "start": fmt(o["tStart"]) if o["tStart"] is not None else "",
            "end": fmt(o["tEnd"]) if o["tEnd"] is not None else "", "gate": o["gate"]} for o in (L["ops"] if L else []) if o["status"] != "open"]
    return {"sn": sn, "code": s["code"], "kind": s["kind"], "lot": s["lot"], "wo": s["wo"], "heat": s["heat"], "heatInfo": {"mat": h["mat"], "cert": h["cert"]} if h else None,
            "status": s["status"], "grade": s["grade"], "created": s["at"], "label": s["label"], "match": s.get("match", ""), "lotStatus": L["status"] if L else "",
            "ops": ops, "qa": _qa_records(sn), "children": [_node(c, depth + 1) for c in s["children"]] if depth < 3 else []}


def trace_serial(sn):
    s = S["ser"].get(sn)
    if not s:
        return None
    return {"serial": sn, "parent": s["parent"], "root": s["parent"] or sn, "tree": _node(s["parent"] or sn), "self": _node(sn)}


def trace_heat(heat):
    parts = [s for s in S["ser"].values() if s["heat"] == heat]
    return {"heat": heat, "info": next((h for h in S["heats"] if h["heat"] == heat), None), "lots": sorted({s["lot"] for s in parts}), "serials": [s["sn"] for s in parts],
            "assemblies": sorted({s["parent"] for s in parts if s["parent"]}), "count": len(parts), "lotsAll": [L["id"] for L in S["lots"].values() if L["heat"] == heat]}


# ====================================================================== holds + quality link
def hold(L, reason="", by="", ncr=""):
    if L["status"] in ("done", "scrapped"):
        return prob(409, "wrong state", f"{L['id']} is {L['status']}")
    L["hold"] = {"reason": reason or "quality hold", "by": by or "quality", "ncr": ncr or "", "t": now(), "at": fmt(now())}
    L["status"] = "hold"
    ev("quality", f"HOLD {L['id']}: {L['hold']['reason']}", lot=L["id"])
    return ok(200, lot_view(L))


def unhold(L, by="", text=""):
    if not L["hold"]:
        return prob(409, "not on hold", L["id"])
    ev("quality", f"RELEASE {L['id']} (was: {L['hold']['reason']}) by {by or 'quality'}" + (f" – {text}" if text else ""), lot=L["id"])
    L["hold"] = None
    L["status"] = "done" if L["i"] >= len(L["ops"]) else "queued"
    return ok(200, lot_view(L))


def qa_sync(force=False):
    if not force and now() - PULL["qa"] < 2:
        return 0
    PULL["qa"] = now()
    try:
        from twin import bsf_qa
        recs = list(bsf_qa.DB["res"][-500:])
        ncrs = list(bsf_qa.DB["ncr"].values())
    except Exception:  # noqa: BLE001
        return 0
    seen = S.setdefault("qaSeen", {"res": "", "ncr": []})
    n = 0
    new = recs
    if seen["res"]:
        ids = [r["id"] for r in recs]
        new = recs[ids.index(seen["res"]) + 1:] if seen["res"] in ids else recs
    for r in new:
        if r.get("decision") != "NOK":
            continue
        s = S["ser"].get(r["serial"])
        L = S["lots"].get(s["lot"]) if s else S["lots"].get(r.get("lot"))
        if L and not L["hold"] and L["status"] not in ("done", "scrapped"):
            hold(L, f"QA NOK {r['char']} = {r['value']} {r.get('unit', '')} (serial {r['serial']})", "QA (item 5)")
            n += 1
    if recs:
        seen["res"] = recs[-1]["id"]
    for c in ncrs:
        if c["status"] == "closed" or c["id"] in seen["ncr"]:
            continue
        seen["ncr"].append(c["id"])
        s = S["ser"].get(c.get("serial"))
        L = S["lots"].get(s["lot"]) if s else None
        if L and L["status"] not in ("done", "scrapped"):
            hold(L, f"NCR {c['id']}: {str(c.get('text', ''))[:60]}", "QA (item 5)", c["id"])
            n += 1
    by = collections.defaultdict(list)
    for r in new:
        if r.get("machine") and r.get("char"):
            by[(r["machine"], r["char"])].append(r)
    for (mid, ch), v in by.items():
        bad = sum(1 for r in v[-3:] if r.get("decision") == "NOK")
        M = S["mach"].get(mid)
        if bad >= 2 and M and not M["spcStop"]:
            M["spcStop"] = {"char": ch, "t": now(), "at": fmt(now()), "text": f"{bad} of the last 3 {ch} NOK"}
            ev("quality", f"SPC STOP {mid}: {bad} of the last 3 {ch} NOK – no dispatch")
            n += 1
    return n


# ====================================================================== gateway link (item 4)
def _gw():
    try:
        from twin import bsf_comm
        return bsf_comm.STATE.get("gw")
    except Exception:  # noqa: BLE001
        return None


def download(mid, b):
    M = S["mach"].get(mid)
    if not M:
        return prob(404, "unknown machine", mid)
    if M["spcStop"]:
        return prob(423, "machine stopped by SPC", f"{mid}: {M['spcStop']['text']} – quality must release it")
    L = S["lots"].get(b.get("lot"))
    if not L:
        return prob(404, "unknown lot", str(b.get("lot")))
    if L["hold"]:
        return prob(423, "lot on hold", f"{L['id']}: {L['hold']['reason']}")
    op = L["ops"][L["i"]] if L["i"] < len(L["ops"]) else None
    if not op or op["m"] != M["type"]:
        return prob(422, "wrong machine type", f"{L['id']} next op {op['no'] + ' needs ' + op['m'] if op else 'none'}, machine is {M['type']}")
    body = {"id": mid, "cmd": "order", "order": L["id"][:20], "part": L["code"][:20], "qty": L["qty"], "recipe": int(op["no"]), "msgId": b.get("msgId") or f"{L['id']}/{op['no']}/{mid}"}
    gw = _gw()
    if not gw:
        return prob(409, "gateway not running", "start it with POST /api/bsf/control {\"action\": \"start\"} (item 4) - the page simulates the handshake meanwhile")
    try:
        res = gw.command(body)
    except KeyError as e:
        return prob(404, "machine not in the gateway", str(e))
    base = 0
    M["download"] = {"lot": L["id"], "op": op["no"], "qty": L["qty"], "t": now(), "at": fmt(now()), "body": body, "result": res, "base": base, "done": 0}
    if res.get("ok"):
        M["lot"], L["status"], L["machine"] = L["id"], "running", mid
        op["machine"], op["status"] = mid, "running"
        if op["tStart"] is None:
            op["tStart"] = now()
        ev("machine", f"order download {L['id']} op {op['no']} -> {mid} (ACK {res.get('resultText')}, {len(res.get('steps', []))} Modbus frames)", lot=L["id"])
    return ok(200 if res.get("ok") else 422, {"machine": mid, "lot": L["id"], "op": op["no"], "command": body, "gateway": res, "simulated": False})


def gw_sync(force=False):
    """pull the gateway: counters of downloaded lots -> confirmations (idempotent per count), states -> downtime records."""
    gw = _gw()
    if not gw or (not force and now() - PULL["gw"] < 1):
        return {"gateway": bool(gw), "confirmations": 0, "downtime": 0}
    PULL["gw"] = now()
    nc = nd = 0
    try:
        rows = gw.machines()
    except Exception:  # noqa: BLE001
        return {"gateway": True, "error": "read failed"}
    for r in rows:
        M = S["mach"].get(r["id"])
        if not M:
            continue
        main = r.get("main") or {}
        st = STATE_CODES.get(int(main.get("std.stateCode") or 1), "IDLE") if r.get("status") == "online" else "OFF"
        prev = M["state"]
        M["state"] = st
        M["gw"] = {"status": r.get("status"), "good": main.get("std.good"), "scrap": main.get("std.scrap"), "alarm": main.get("std.alarm"), "order": main.get("std.order"), "power_kW": main.get("std.power_kW")}
        if M["live"] is None or M["live"].get("source") == "gateway":
            M["live"] = {"source": "gateway", "id": M["id"], "type": M["type"], "state": st, "alarm": main.get("std.alarm") or 0, "lot": main.get("std.order") or "", "since": now() if st != prev else (M["live"] or {}).get("since", now())}
        if st == "DOWN" and prev != "DOWN" and not M["dtOpen"]:
            rc = C.alarm_reason(main.get("std.alarm"))
            R = C.REASON[rc]
            M["dtOpen"] = {"id": nid("DT"), "machine": M["id"], "type": M["type"], "start": now(), "end": None, "reason": rc, "reasonText": R["text"], "cat": R["cat"], "oee": R["oee"],
                           "source": f"gateway (alarm {main.get('std.alarm') or 0})", "comment": "", "by": "auto", "classified": False, "startAt": fmt(now())}
            nd += 1
        if st != "DOWN" and M["dtOpen"] and M["dtOpen"]["source"].startswith("gateway"):
            _close_dt(M)
        D = M["download"]
        if D and D.get("result") and D["result"].get("ok") and not D.get("finished"):
            try:
                vals = gw.machine(M["id"])["values"]
            except Exception:  # noqa: BLE001
                continue
            if str(vals.get("std.order", "")) != D["lot"][:20]:
                continue
            done = int(vals.get("hs.lotDone") or 0)
            L = S["lots"].get(D["lot"])
            if L and done > D["done"]:
                key = f"gw/{M['id']}/{D['lot']}/{done}"
                if key not in IDEM:
                    rr = confirm({"lot": L["id"], "op": D["op"], "machine": M["id"], "good": done - D["done"], "scrap": 0}, "gateway")
                    IDEM[key] = (rr[0], rr[1])
                    if rr[0] == 201:
                        nc += 1
                D["done"] = done
            if done >= D["qty"] or not (int(vals.get("hs.status") or 0) & 2):
                D["finished"] = True
    return {"gateway": True, "confirmations": nc, "downtime": nd}


def _close_dt(M):
    d = M["dtOpen"]
    d["end"], d["endAt"] = now(), fmt(now())
    d["min"] = r2((d["end"] - d["start"]) / 60, 1)
    S["dt"].append(d)
    if len(S["dt"]) > 5000:
        del S["dt"][0]
    M["dtOpen"] = None


# ====================================================================== downtime, andon, OEE, reports
def downtime_add(b):
    M = S["mach"].get(b.get("machine"))
    if not M:
        return prob(404, "unknown machine", str(b.get("machine")))
    R = C.REASON.get(str(b.get("reason")))
    if not R:
        return prob(400, "unknown reason", "see GET /api/bsf/mes/reasons")
    end = float(b["end"]) if b.get("end") is not None else now()
    start = float(b["start"]) if b.get("start") is not None else end - float(b.get("minutes") or 0) * 60
    if end < start:
        return prob(400, "end before start")
    d = {"id": nid("DT"), "machine": M["id"], "type": M["type"], "start": start, "end": end, "min": r2((end - start) / 60, 1), "reason": R["code"], "reasonText": R["text"],
         "cat": R["cat"], "oee": R["oee"], "source": str(b.get("source") or "terminal"), "comment": str(b.get("comment") or "")[:200], "by": str(b.get("by") or "operator")[:30],
         "startAt": fmt(start), "endAt": fmt(end)}
    S["dt"].append(d)
    ev("downtime", f"{M['id']} {d['min']} min {R['code']} {R['text']}")
    return ok(201, d)


def classify(did, reason, by=""):
    d = next((x for x in S["dt"] if x["id"] == did), None) or next((m["dtOpen"] for m in S["mach"].values() if m["dtOpen"] and m["dtOpen"]["id"] == did), None)
    if not d:
        return prob(404, "unknown downtime", did)
    R = C.REASON.get(str(reason))
    if not R:
        return prob(400, "unknown reason")
    d.update({"reason": R["code"], "reasonText": R["text"], "cat": R["cat"], "oee": R["oee"], "by": by or "operator", "classified": True})
    ev("downtime", f"{d['machine']} {d['id']} classified {R['code']} {R['text']} by {d['by']}")
    return ok(200, d)


def andon():
    ms = []
    for M in S["mach"].values():
        l = M["live"] or {}
        st = l.get("state") or M["state"]
        ms.append({"id": M["id"], "type": M["type"], "state": st, "color": "red" if M["spcStop"] else STATE_COLOR.get(st, "grey"), "lot": l.get("lot") or M["lot"], "op": l.get("op", ""),
                   "pcs": f"{l.get('pcsDone')}/{l.get('pcsLot')}" if l.get("pcsLot") else "", "progress": l.get("progress", 0), "alarm": l.get("alarm", 0), "alarmText": l.get("alarmText", ""),
                   "since": l.get("since"), "spcStop": M["spcStop"],
                   "dt": {"id": M["dtOpen"]["id"], "reason": M["dtOpen"]["reason"], "text": M["dtOpen"]["reasonText"], "classified": bool(M["dtOpen"].get("classified"))} if M["dtOpen"] else None,
                   "call": [c["kind"] for c in S["calls"] if c["machine"] == M["id"] and not c["done"]], "oee": (l.get("oee") or {}).get("OEE")})
    cnt = collections.Counter(m["color"] for m in ms)
    k = S["twin"]["kpi"] or {}
    return {"t": now(), "at": fmt(now()), "machines": ms, "count": dict(cnt), "calls": [c for c in S["calls"] if not c["done"]],
            "holds": [{"lot": L["id"], "reason": L["hold"]["reason"]} for L in S["lots"].values() if L["hold"]],
            "targets": {"today": k.get("outToday", {}), "target": k.get("target")} if k.get("target") else None, "spcStops": [m["id"] for m in ms if m["spcStop"]]}


def oee_machine(M):
    l = M["live"]
    if not l or not l.get("t"):
        return None
    t = l["t"]
    PBT = (t["run"] + t["setup"] + t["down"] + t["blocked"] + t["starved"]) / 60
    if PBT <= 0:
        return {"id": M["id"], "type": M["type"], "PBT": 0, "A": 0, "E": 0, "Q": 0, "OEE": 0}
    E = (l.get("oee") or {}).get("P", 0)
    Q = (l.get("oee") or {}).get("Q", 0)
    run = t["run"] / 60
    A = run / PBT
    return {"id": M["id"], "type": M["type"], "PBT": r2(PBT, 1), "run": r2(run, 1), "setup": r2(t["setup"] / 60, 1), "down": r2(t["down"] / 60, 1), "starved": r2(t["starved"] / 60, 1),
            "blocked": r2(t["blocked"] / 60, 1), "A": r2(A, 4), "E": r2(E, 4), "Q": r2(Q, 4), "OEE": r2(A * E * Q, 4), "speedLoss": r2(run * (1 - E), 1),
            "qualityLoss": r2(run * E * (1 - Q), 1), "good": l.get("good"), "scrap": l.get("scrap"), "energy": l.get("energy_kWh")}


def oee(q):
    rows = [r for r in (oee_machine(M) for M in S["mach"].values()) if r and r["PBT"] > 0]

    def agg(lst):
        # A = sum APT / sum PBT; E and Q weighted by APT over the machines that finished parts in the window
        P = sum(r["PBT"] for r in lst)
        if not P:
            return None
        run = sum(r.get("run", 0) for r in lst)
        wq = [r for r in lst if r["E"] > 0 and r["Q"] > 0]
        wr = sum(r["run"] for r in wq)
        A = run / P
        E = sum(r["E"] * r["run"] for r in wq) / wr if wr else 0
        Q = sum(r["Q"] * r["run"] for r in wq) / wr if wr else 0
        return {"PBT": r2(P, 1), "A": r2(A, 4), "E": r2(E, 4), "Q": r2(Q, 4), "OEE": r2(A * E * Q, 4), "n": len(lst), "nEQ": len(wq)}
    types = collections.defaultdict(list)
    for r in rows:
        types[r["type"]].append(r)
    sel = [r for r in rows if r["id"] == q.get("machine")] if q.get("machine") else [r for r in rows if r["type"] == q.get("type")] if q.get("type") else rows
    return {"machines": sel, "types": {k: agg(v) for k, v in types.items()}, "plant": agg(rows),
            "formula": "OEE = A × E × Q (ISO 22400-2): A = APT / PBT, E = PRI × PQ / APT, Q = GQ / PQ; PBT = run + set-up + down + blocked + starved; line / plant: A = Σ APT / Σ PBT, E and Q weighted by APT of the machines with finished parts",
            "note": "machine times come from the twin page (POST /api/bsf/mes/twin); without it only gateway states are known" if not rows else ""}


def pareto(t0=-math.inf):
    by = {}
    for d in S["dt"]:
        if d["end"] is not None and d["end"] >= t0:
            x = by.setdefault(d["reason"], {"reason": d["reason"], "text": d["reasonText"], "min": 0.0, "n": 0})
            x["min"] += min(d["min"], (d["end"] - max(t0, d["start"])) / 60)
            x["n"] += 1
    for M in S["mach"].values():
        if M["dtOpen"]:
            d = M["dtOpen"]
            x = by.setdefault(d["reason"], {"reason": d["reason"], "text": d["reasonText"], "min": 0.0, "n": 0})
            x["min"] += (now() - max(t0, d["start"])) / 60
            x["n"] += 1
    lst = sorted(({**x, "min": r2(x["min"], 1)} for x in by.values()), key=lambda x: -x["min"])
    tot = sum(x["min"] for x in lst)
    cum = 0.0
    out = []
    for x in lst:
        cum += x["min"]
        out.append({**x, "pct": r2(100 * x["min"] / tot, 1) if tot else 0, "cum": r2(100 * cum / tot, 1) if tot else 0})
    return out


def report(q):
    t_end = now()
    t0 = float(q["from"]) if q.get("from") else t_end - float(q.get("hours") or 7.5) * 3600
    cf = [c for c in S["conf"] if c["t"] >= t0]
    out, scrap = collections.Counter(), collections.Counter()
    for c in cf:
        L = S["lots"].get(c["lot"])
        if not L:
            continue
        op = next((o for o in L["ops"] if o["no"] == c["op"]), None)
        if op is not None and L["ops"][-1] is op:
            out[L["route"]] += c["good"]
        if c["scrap"] > 0:
            scrap[f"{L['route']} {c['op']} {op['n'] if op else ''}".strip()] += c["scrap"]
    k = S["twin"]["kpi"] or {}
    return {"from": fmt(t0), "to": fmt(t_end), "hours": r2((t_end - t0) / 3600, 2), "output": dict(out), "confirmations": len(cf),
            "scrapByCause": [{"cause": a, "pcs": b} for a, b in scrap.most_common()], "downtime": pareto(t0), "oee": oee({})["plant"], "wip": k.get("wip"), "little": k.get("little"),
            "leadTime_h": k.get("leadTime_h"), "kWhPerSet": k.get("kWhPerSet"), "energyPerDay_kWh": k.get("energyPerDay_kWh"),
            "holds": sum(1 for L in S["lots"].values() if L["hold"]), "spcStops": [M["id"] for M in S["mach"].values() if M["spcStop"]], "events": [e for e in S["events"] if e["t"] >= t0][-30:]}


# ====================================================================== scheduling + dispatch
def _types():
    out = collections.OrderedDict()
    for mid, typ in _machines():
        out.setdefault(typ, []).append(mid)
    return out


HT3 = {"BS-IND", "HT-TMP", "HT-CAR", "LG-IND"}   # 3-shift machine types (bsfmfg_data.js MTYPES shifts3)


def sched_input(b):
    t = now()
    machines, lots = {}, []
    for typ, ids in _types().items():
        lst = []
        for mid in ids:
            M = S["mach"][mid]
            l = M["live"] or {}
            free = 1e7 if M["spcStop"] else (max(30.0, (l.get("mttr_h") or 2) * 60 - (t - (l.get("since") or t)) / 60) if l.get("state") == "DOWN" else 0)
            lst.append({"id": mid, "free": free, "ht": typ in HT3, "lastKey": f"{l.get('part')}/{l.get('op')}" if l.get("part") and l.get("op") else "", "lastFam": ""})
        machines[typ] = lst
    for L in S["lots"].values():
        if L["status"] in ("done", "scrapped") or L["hold"]:
            continue
        wo = S["wo"].get(L["wo"])
        if not wo or wo["status"] in ("created", "cancelled"):
            continue
        ops = [{"no": o["no"], "m": o["m"], "setup": o["setup"], "setupMinor": o["setupMinor"], "cyc": o["cyc"], "batch": o["batch"], "furnace": o["furnace"],
                "key": f"{L['code']}/{o['no']}", "fam": o["fam"]} for o in L["ops"][L["i"]:]]
        if not ops:
            continue
        fixed = None
        if L["status"] == "running" and L["machine"] and L["machine"] in _types().get(ops[0]["m"], []):
            live = S["mach"][L["machine"]]["live"] or {}
            done = live.get("pcsDone", 0) if L["id"] in str(live.get("lot", "")) else 0
            o = ops[0]
            fixed = {"machine": L["machine"], "end": max(1.0, o["cyc"] * o["batch"] * (1 - (live.get("progress") or 0)) if o["furnace"] else (L["qty"] - done) * o["cyc"])}
        lots.append({"id": L["id"], "wo": L["wo"], "code": L["code"], "route": L["route"], "qty": L["qty"], "due": (wo["due"] - t) / 60, "release": 0,
                     "started": L["started"] or L["i"] > 0, "fixed": fixed, "ops": ops})
    return {"rule": b.get("rule") or "EDD", "tod0": tod0(), "shifts": int(b.get("shifts") or 2), "calendar": "shift", "transfer": b.get("transfer", 30),
            "dbr": {"drum": b.get("drum") or "BS-TGR", "bufferMin": float(b.get("bufferH", 16)) * 60} if b.get("dbr") else None, "machines": machines, "lots": lots}


def run_schedule(b):
    if isinstance(b.get("case"), dict):
        return ok(200, {"case": True, **C.schedule(b["case"])})
    inp = sched_input(b)
    r = C.schedule(inp)
    prev = S["sched"]["kpi"] if S["sched"] else None
    S["sched"] = {"t": now(), "at": fmt(now()), "rule": inp["rule"], "dbr": bool(inp["dbr"]), "reason": b.get("reason") or "manual", "ops": r["ops"], "kpi": r["kpi"],
                  "lots": r["lots"], "tod0": inp["tod0"], "shifts": inp["shifts"], "prev": prev}
    if b.get("compare"):
        cmpl = []
        for rule in ("EDD", "SPT", "CR", "FIFO", "FAM"):
            for d in (False, True):
                k = C.schedule({**inp, "rule": rule, "dbr": {"drum": "BS-TGR", "bufferMin": float(b.get("bufferH", 16)) * 60} if d else None})["kpi"]
                k.pop("dbr", None)
                cmpl.append({"rule": rule, "dbr": d, "kpi": k})
        S["sched"]["compare"] = cmpl
    ev("schedule", f"schedule {inp['rule']}{' + DBR' if inp['dbr'] else ''}: {len(r['ops'])} operations, on time {r2(r['kpi']['onTimePct'], 1)} %, {r['kpi']['majors']} set-ups")
    return ok(200, S["sched"])


def dispatch(mid):
    M = S["mach"].get(mid)
    if not M:
        return prob(404, "unknown machine", mid)
    held = [{"lot": L["id"], "reason": L["hold"]["reason"]} for L in S["lots"].values() if L["hold"] and L["i"] < len(L["ops"]) and L["ops"][L["i"]]["m"] == M["type"]]
    if M["spcStop"]:
        return ok(200, {"machine": mid, "machineType": M["type"], "blocked": M["spcStop"], "items": [], "held": held, "generated": fmt(now())})
    items = []
    if S["sched"]:
        rows = sorted((o for o in S["sched"]["ops"] if o["machine"] == mid and o["lot"] in S["lots"] and not S["lots"][o["lot"]]["hold"] and S["lots"][o["lot"]]["status"] != "done"), key=lambda o: o["start"])
        for i, o in enumerate(rows):
            L = S["lots"][o["lot"]]
            items.append({"seq": i + 1, "wo": L["wo"], "lot": o["lot"], "op": o["no"], "product": L["code"], "qty": o["qty"], "setup": o["setup"], "setupKind": o["setupKind"],
                          "startIn_min": round(o["start"]), "due": S["wo"].get(L["wo"], {}).get("dueAt"), "load": o.get("load", "")})
    if not items:
        q = sorted((L for L in S["lots"].values() if not L["hold"] and L["status"] in ("queued", "running", "planned") and L["i"] < len(L["ops"]) and L["ops"][L["i"]]["m"] == M["type"]
                    and S["wo"].get(L["wo"], {}).get("status") in ("released", "running")), key=lambda L: S["wo"].get(L["wo"], {}).get("due", 0))
        items = [{"seq": i + 1, "wo": L["wo"], "lot": L["id"], "op": L["ops"][L["i"]]["no"], "product": L["code"], "qty": L["qty"], "setup": L["ops"][L["i"]]["setup"],
                  "due": S["wo"].get(L["wo"], {}).get("dueAt")} for i, L in enumerate(q)]
    return ok(200, {"machine": mid, "machineType": M["type"], "items": items[:30], "held": held, "from": f"schedule {S['sched']['at']}" if S["sched"] else "queue (EDD)", "generated": fmt(now())})


# ====================================================================== logistics: transport, kanban, FG, furnace loads
def _bapi(method, sub, body):
    try:
        from twin import bsf_comm_api as BAPI
        return BAPI.handle(method, sub, {}, body, None)
    except Exception as e:  # noqa: BLE001
        return 503, {"title": "not available", "detail": str(e)}, ""


def _erp_gr(code, qty, order):
    st, b, _ = _bapi("POST", "erp/goodsmovements", {"type": "GR", "material": code, "qty": qty, "order": order})
    return {"status": st, "id": b.get("id"), "stock": b.get("stock"), "title": b.get("title")}


def transport(b):
    if not b.get("from") or not b.get("to") or b.get("from") == b.get("to"):
        return prob(400, "from and to needed (different stations)")
    r = {"id": nid("TR"), "lot": str(b.get("lot") or ""), "from": b["from"], "to": b["to"], "priority": int(b.get("priority") or 5), "state": "REQUESTED", "t": now(), "at": fmt(now()), "agvOrder": None}
    st, a, _ = _bapi("POST", "agv/transportorders", {"from": b["from"], "to": b["to"], "load": r["lot"], "priority": r["priority"]})
    if st == 201:
        r["agvOrder"], r["state"] = a.get("id"), a.get("state", "CREATED")
    else:
        r["state"] = f"AGV fleet answered {st}"
    S["tr"][r["id"]] = r
    ev("logistics", f"transport {r['id']} {r['lot']} {r['from']} -> {r['to']} (AGV order {r['agvOrder'] or '-'})")
    return ok(201, r)


def transport_view():
    out = []
    for r in list(S["tr"].values())[-60:]:
        if r["agvOrder"]:
            st, a, _ = _bapi("GET", f"agv/transportorders/{r['agvOrder']}", {})
            if st == 200:
                r["state"] = a.get("state", r["state"])
                r["vehicle"] = a.get("vehicle")
        out.append(r)
    return {"items": out}


def use_kanban(route, n):
    for k in S["kb"].values():
        if k["use"] != route:
            continue
        k["used"] += n * k["per"]
        while k["used"] >= k["C"] and k["full"] > 0:
            k["used"] -= k["C"]
            k["full"] -= 1
            kb_signal(k, "consumed")


def kb_signal(k, why):
    k["signals"] += 1
    due = now() + k["LT"] * 86400
    k["pending"].append({"id": nid("KB"), "t": now(), "due": due, "dueAt": fmt(due)})
    ev("logistics", f"kanban {k['item']}: bin empty ({why}) -> replenishment signal, {k['full']}/{k['N']} full")


def kanban_view():
    t = now()
    items = []
    for k in S["kb"].values():
        arr = [p for p in k["pending"] if p["due"] <= t]
        if arr:
            k["pending"] = [p for p in k["pending"] if p["due"] > t]
            k["full"] = min(k["N"], k["full"] + len(arr))
        items.append({**{x: k[x] for x in ("item", "n", "per", "use", "D", "LT", "a", "C", "N", "full", "signals")}, "empty": k["N"] - k["full"], "open": len(k["pending"]),
                      "red": k["full"] <= math.ceil(k["N"] * 0.3), "formula": f"N = ceil({k['D']} × {k['LT']} × {1 + k['a']} / {k['C']}) = {k['N']}"})
    return {"items": items}


def fg_book(b):
    L = S["lots"].get(b.get("lot"))
    if not L:
        return prob(404, "unknown lot", str(b.get("lot")))
    if L["status"] != "done":
        return prob(409, "lot not finished", f"{L['id']} is {L['status']}")
    qty = int(b.get("qty") or L["qty"])
    if not 0 < qty <= L["qty"]:
        return prob(422, "quantity", f"1 ... {L['qty']}")
    f = {"id": nid("FG"), "lot": L["id"], "wo": L["wo"], "code": L["code"], "qty": qty, "t": now(), "at": fmt(now()), "auto": False, "erp": _erp_gr(L["code"], qty, L["wo"])}
    S["fg"].append(f)
    ev("logistics", f"FG booking {f['id']}: {qty} × {L['code']} (lot {L['id']})")
    return ok(201, f)


def ht_load(b):
    T = str(b.get("furnace") or "")
    if T not in ("HT-TMP", "HT-CAR"):
        return prob(400, "furnace must be HT-TMP or HT-CAR")
    ids = b.get("lots") or []
    lots = [S["lots"].get(i) for i in ids]
    if not lots or any(L is None for L in lots):
        return prob(404, "unknown lot", ", ".join(i for i in ids if i not in S["lots"]) or "lots: [...] needed")
    wrong = [L for L in lots if L["i"] >= len(L["ops"]) or L["ops"][L["i"]]["m"] != T]
    if wrong:
        return prob(422, "lot not at this furnace", ", ".join(f"{L['id']} next {L['ops'][L['i']]['m'] if L['i'] < len(L['ops']) else '-'}" for L in wrong))
    cap = lots[0]["ops"][lots[0]["i"]]["batch"]
    q = sum(L["qty"] for L in lots)
    if q > cap:
        return prob(422, "load too big", f"{q} pcs > capacity {cap}")
    h = {"id": nid("HT"), "furnace": T, "machine": b.get("machine") or _types()[T][0], "lots": [L["id"] for L in lots], "qty": q, "cap": cap, "fill": r2(q / cap, 3),
         "program": "temper 170 °C 2 h" if T == "HT-TMP" else "carburise 930 °C, 0.8 %C, quench, temper 170 °C", "t": now(), "at": fmt(now()), "status": "built", "source": b.get("source") or "planner"}
    S["ht"][h["id"]] = h
    ev("heat", f"furnace load {h['id']} {T}: {' + '.join(h['lots'])} = {q}/{cap} pcs")
    return ok(201, h)


# ====================================================================== the twin page = shop floor (state every 2 s)
def twin_sync(snap):
    t = now()
    nconf = ndt = nwo = 0
    S["twin"]["t"] = snap.get("t")
    if snap.get("kpi"):
        S["twin"]["kpi"] = snap["kpi"]
    for o in snap.get("orders") or []:
        wid = S["twin"]["orders"].get(o["id"])
        if not wid:
            wid = "WO-T" + "".join(ch for ch in str(o["id"]) if ch.isdigit()).zfill(4)
            if wid in S["wo"]:
                S["twin"]["orders"][o["id"]] = wid
            else:
                r = create_wo({"product": o.get("product"), "qty": o.get("qty"), "dueDays": max(0.0, (float(o.get("due") or 0) - float(snap.get("t") or 0)) / 86400), "erpOrder": o["id"], "source": "twin", "lots": []}, wid)
                if r[0] != 201:
                    continue
                S["twin"]["orders"][o["id"]] = wid
                w = S["wo"][wid]
                w["status"], w["released"], w["releasedAt"] = "released", t, fmt(t)
                nwo += 1
        w = S["wo"].get(wid)
        if w and o.get("done") is not None:
            w["good"] = max(w["good"], int(o.get("done") or 0))
        if w and o.get("state") in ("complete", "shipped") and w["status"] != "done":
            w["status"], w["done"] = "done", t
    todo, xs = [], {}
    for x in snap.get("lots") or []:
        wid = S["twin"]["orders"].get(x.get("order"))
        if not wid or wid not in S["wo"]:
            continue
        wo = S["wo"][wid]
        L = S["lots"].get(x["id"])
        if not L:
            ln = next((l for l in wo["lines"] if l["route"] == x.get("route")), None)
            L = make_lot(x["id"], wo, x["route"], ln["code"] if ln else C.prod_info(x["route"])["code"], int(x.get("qty0") or x.get("qty") or 1))
            if ln:
                ln["lots"].append(L["id"])
            L["status"] = "queued"
            assign_heat(L)
        seen = S["twin"]["lotSeen"].get(x["id"], 0)
        h = x.get("h") or []
        for e in h[seen:]:
            todo.append((L, e))
        S["twin"]["lotSeen"][x["id"]] = len(h)
        xs[L["id"]] = x
    todo.sort(key=lambda a: a[1][3])      # confirm in time order (components before the assembly that uses them)
    for L, e in todo:
        op_no, mid, t_in, t_out, good, scrap = e[:6]
        if not any(o["no"] == str(op_no) and o["status"] != "done" and jj >= L["i"] for jj, o in enumerate(L["ops"])):
            continue
        off = t - float(snap.get("t") or 0)      # twin clock -> server clock
        r = confirm({"lot": L["id"], "op": str(op_no), "machine": mid, "good": good, "scrap": scrap, "runMin": r2((t_out - t_in) / 60, 1), "tStart": t_in + off, "tEnd": t_out + off, "final": True}, "twin")
        if r[0] == 201:
            nconf += 1
    for lid, x in xs.items():
        L = S["lots"].get(lid)
        if L and not L["hold"] and L["status"] not in ("done", "scrapped"):
            L["machine"] = x.get("machine") or ""
            st = x.get("state")
            if st in ("run", "setup"):
                L["status"] = "running"
            elif st in ("agv", "move", "wait-agv"):
                L["status"] = "moving"
            elif st in ("queue", "blocked"):
                L["status"] = "queued"
    for m in snap.get("machines") or []:
        M = S["mach"].get(m.get("id"))
        if not M:
            continue
        prev = (M["live"] or {}).get("state")
        M["live"], M["state"], M["lot"] = m, m.get("state"), m.get("lot") or ""
        if m.get("state") == "DOWN" and prev != "DOWN" and not M["dtOpen"]:
            rc = C.alarm_reason(m.get("alarm"))
            R = C.REASON[rc]
            M["dtOpen"] = {"id": nid("DT"), "machine": M["id"], "type": M["type"], "start": t, "end": None, "reason": rc, "reasonText": R["text"], "cat": R["cat"], "oee": R["oee"],
                           "source": f"twin (alarm {m.get('alarm') or 0})", "alarmText": m.get("alarmText", ""), "comment": "", "by": "auto", "classified": False, "startAt": fmt(t)}
            ndt += 1
            ev("downtime", f"{M['id']} DOWN alarm {m.get('alarm')} {m.get('alarmText', '')} -> reason {rc} (operator to confirm)")
        if m.get("state") != "DOWN" and M["dtOpen"] and not M["dtOpen"]["source"].startswith("gateway"):
            _close_dt(M)
    for lid in list(S["lots"]):
        L = S["lots"][lid]
        if L["status"] in ("done", "scrapped") and L["tDone"] is not None and t - L["tDone"] > 3 * 86400:
            del S["lots"][lid]
            S["twin"]["lotSeen"].pop(lid, None)
    return {"orders": nwo, "confirmations": nconf, "downtime": ndt}


def _reset():
    global S
    S = _fresh()
    _seed()
    IDEM.clear()


def _seed():
    create_wo({"product": "BS", "qty": 20, "dueDays": 2, "erpOrder": "PO-260001"})
    release_wo(S["wo"]["WO-00001"], True)
    create_wo({"product": "LG", "qty": 50, "dueDays": 3, "erpOrder": "PO-260002"})
    release_wo(S["wo"]["WO-00002"], True)
    create_wo({"product": "LB", "qty": 100, "dueDays": 4, "erpOrder": "PO-260003"})


# ====================================================================== HTTP dispatch
def _q(query, k, d=""):
    v = query.get(k, [d])
    return v[0] if isinstance(v, list) else v


def _page(items, query, base):
    p = max(1, int(_q(query, "page", "1") or 1))
    s = max(1, min(200, int(_q(query, "size", "20") or 20)))
    out = {"items": items[(p - 1) * s:p * s], "page": p, "size": s, "total": len(items)}
    if p * s < len(items):
        out["next"] = f"{base}?page={p + 1}&size={s}"
    return out


def handle(method, path, query=None, body=None, headers=None):
    """-> (status, obj, content type). Never raises."""
    query = query or {}
    body = body or {}
    if path.startswith("/api/bsf/v1/"):
        path = "/api/bsf/" + path[len("/api/bsf/v1/"):]
    try:
        with LOCK:
            _ensure()
            key = ""
            if method == "POST":
                try:
                    key = (headers.get("Idempotency-Key") if headers is not None else "") or ""
                except AttributeError:
                    key = ""
                key = key or str(body.get("msgId") or "")
                if key and key in IDEM:
                    st, b = IDEM[key]
                    return ok(200, {**b, "replay": True})
            r = _route(method, path, query, body)
            if method == "POST":
                if key and r[0] in (200, 201):
                    IDEM[key] = (r[0], r[1])
                    while len(IDEM) > 5000:
                        IDEM.popitem(last=False)
                if r[0] < 400 or r[0] == 422:
                    _save(force=not path.endswith("/twin"))
            return r
    except Exception as e:  # noqa: BLE001 - the MES must answer, never crash the main server
        return prob(500, "internal error", f"{type(e).__name__}: {e}")


def _route(method, path, query, body):
    P = [p for p in path[len("/api/bsf/mes"):].split("/") if p]
    res = P[0] if P else ""
    rid = P[1] if len(P) > 1 else ""
    act = P[2] if len(P) > 2 else ""
    G = method == "GET"
    if G and res in ("andon", "machines", "health", "lots", "workorders", "dispatch", "report"):
        gw_sync()
        qa_sync()
    if G and res in ("", "health"):
        gw = _gw()
        return ok(200, {"ok": True, "version": VERSION, "mode": "server", "workorders": len(S["wo"]), "lots": len(S["lots"]), "serials": len(S["ser"]), "confirmations": len(S["conf"]),
                        "persist": {"on": PERSIST["on"], "path": PERSIST["path"], "exists": bool(PERSIST["path"] and os.path.exists(PERSIST["path"])), "loaded": PERSIST["loaded"],
                                    "savedAt": fmt(PERSIST["saved"]) if PERSIST["saved"] else None, "error": PERSIST["error"]},
                        "gateway": bool(gw), "t": fmt(now())})
    if G and res == "api":
        return ok(200, {"version": VERSION, "routes": API})
    if res == "workorders" and not rid:
        if G:
            items = sorted((w for w in S["wo"].values() if not _q(query, "status") or w["status"] == _q(query, "status")), key=lambda w: w["id"], reverse=True)
            return ok(200, _page([wo_row(w) for w in items], query, "/api/bsf/mes/workorders"))
        if method == "POST":
            return create_wo(body)
    if res == "workorders" and rid:
        w = S["wo"].get(rid)
        if not w:
            return prob(404, "unknown work order", rid)
        if G and not act:
            return ok(200, wo_view(w))
        if method == "POST" and act == "release":
            return release_wo(w, bool(body.get("force")))
        if method == "POST" and act == "cancel":
            if w["status"] != "created":
                return prob(409, "wrong state", "only 'created' can be cancelled")
            w["status"] = "cancelled"
            ev("wo", f"{w['id']} cancelled: {body.get('reason', '')}")
            return ok(200, wo_view(w))
    if res == "lots" and not rid and G:
        return ok(200, {"items": [{"id": L["id"], "wo": L["wo"], "route": L["route"], "code": L["code"], "qty": L["qty"], "status": L["status"],
                                   "op": L["ops"][L["i"]]["no"] if L["i"] < len(L["ops"]) else "", "m": L["ops"][L["i"]]["m"] if L["i"] < len(L["ops"]) else "", "hold": L["hold"], "heat": L["heat"]}
                                  for L in S["lots"].values() if (not _q(query, "wo") or L["wo"] == _q(query, "wo")) and (not _q(query, "status") or L["status"] == _q(query, "status"))][-500:]})
    if res == "lots" and rid:
        L = S["lots"].get(rid)
        if not L:
            return prob(404, "unknown lot", rid)
        if G:
            return ok(200, lot_view(L))
        if act == "hold":
            return hold(L, body.get("reason", ""), body.get("by", ""), body.get("ncr", ""))
        if act == "release":
            return unhold(L, body.get("by", ""), body.get("text", ""))
    if res == "dispatch" and G:
        return dispatch(_q(query, "machine", "BS-TGR-01"))
    if res == "confirmations":
        if method == "POST":
            return confirm(body, str(body.get("source") or "api"))
        n = int(_q(query, "n", "50") or 50)
        return ok(200, {"items": [c for c in S["conf"] if not _q(query, "lot") or c["lot"] == _q(query, "lot")][-n:]})
    if res == "schedule":
        if method == "POST":
            return run_schedule(body)
        return ok(200, S["sched"]) if S["sched"] else prob(404, "no schedule yet", "POST /api/bsf/mes/schedule first")
    if res == "machines" and not rid and G:
        return ok(200, {"items": [{k: M.get(k) for k in ("id", "type", "state", "lot", "download", "spcStop", "dtOpen", "gw")} for M in S["mach"].values()]})
    if res == "machines" and rid:
        if act == "download" and method == "POST":
            return download(rid, body)
        M = S["mach"].get(rid)
        if not M:
            return prob(404, "unknown machine", rid)
        if act == "spc" and method == "POST":
            M["spcStop"] = {"char": body.get("char", ""), "t": now(), "at": fmt(now()), "text": body.get("text") or f"SPC alarm {body.get('char', '')}"} if body.get("alarm") else None
            ev("quality", f"SPC {'STOP' if body.get('alarm') else 'release'} {rid} {body.get('char', '')}")
            return ok(200, {"id": rid, "spcStop": M["spcStop"]})
        if G:
            return ok(200, M)
    if res == "downtime":
        if method == "POST" and not rid:
            return downtime_add(body)
        if method == "POST" and act == "reason":
            return classify(rid, body.get("reason"), body.get("by", ""))
        items = S["dt"] + [m["dtOpen"] for m in S["mach"].values() if m["dtOpen"]]
        items = [d for d in items if (not _q(query, "machine") or d["machine"] == _q(query, "machine")) and (not _q(query, "open") or d["end"] is None)]
        return ok(200, {"items": items[-int(_q(query, "n", "200") or 200):]})
    if res == "reasons" and G:
        return ok(200, {"items": [{"code": r[0], "text": r[1], "cat": r[2], "oee": r[3]} for r in C.REASONS]})
    if res == "andon":
        if method == "POST" and rid == "call":
            if body.get("machine") not in S["mach"]:
                return prob(404, "unknown machine", str(body.get("machine")))
            c = {"id": nid("AC"), "machine": body["machine"], "kind": str(body.get("kind") or "supervisor"), "t": now(), "at": fmt(now()), "done": False}
            S["calls"].append(c)
            ev("andon", f"call {c['kind']} at {c['machine']}")
            return ok(201, c)
        if method == "POST" and rid == "ack":
            c = next((x for x in S["calls"] if x["id"] == body.get("id")), None)
            if not c:
                return prob(404, "unknown call")
            c["done"] = True
            return ok(200, c)
        return ok(200, andon())
    if res == "oee" and G:
        return ok(200, oee({"machine": _q(query, "machine"), "type": _q(query, "type")}))
    if res == "report" and G:
        return ok(200, report({"hours": _q(query, "hours"), "from": _q(query, "from")}))
    if res == "pareto" and G:
        return ok(200, {"items": pareto()})
    if res == "serials":
        if method == "POST":
            L = S["lots"].get(body.get("lot"))
            if not L:
                return prob(404, "unknown lot", str(body.get("lot")))
            n = max(1, min(200, int(body.get("n") or 1)))
            made = make_serials(L, n + len(L["serials"]) if n + len(L["serials"]) <= L["qty0"] * 2 else 0, body.get("machine", ""))
            return ok(201, {"lot": L["id"], "items": [{**s, "gs1": C.gs1_element(s["sn"], L["id"][:20], s["code"], date_of(now()))} for s in made]})
        return ok(200, {"items": [s for s in S["ser"].values() if not _q(query, "lot") or s["lot"] == _q(query, "lot")][-int(_q(query, "n", "200") or 200):]})
    if res == "genealogy" and rid == "link" and method == "POST":
        return link_manual(body.get("parent"), body.get("children") or [])
    if res == "trace" and G:
        if _q(query, "heat"):
            return ok(200, trace_heat(_q(query, "heat")))
        tr = trace_serial(_q(query, "serial"))
        return ok(200, tr) if tr else prob(404, "unknown serial", _q(query, "serial"))
    if res == "htloads":
        if method == "POST":
            return ht_load(body)
        return ok(200, {"items": list(S["ht"].values())[-60:]})
    if res == "transport":
        if method == "POST":
            return transport(body)
        return ok(200, transport_view())
    if res == "kanban":
        if method == "POST" and act == "scan":
            k = S["kb"].get(rid)
            if not k:
                return prob(404, "unknown kanban item", rid)
            if k["full"] <= 0:
                return prob(409, "no full bin left", rid)
            k["full"] -= 1
            kb_signal(k, "scanned")
            return ok(200, next(x for x in kanban_view()["items"] if x["item"] == rid))
        return ok(200, kanban_view())
    if res == "fg":
        if method == "POST":
            return fg_book(body)
        return ok(200, {"items": S["fg"][-60:]})
    if res == "twin" and method == "POST":
        return ok(200, twin_sync(body))
    if res == "sync" and method == "POST":
        return ok(200, {**gw_sync(force=True), "qaHolds": qa_sync(force=True)})
    if res == "eval" and method == "POST":
        k = body.get("kind")
        if k == "oee":
            return ok(200, C.oee_iso(float(body.get("PBT", 0)), float(body.get("down", 0)), float(body.get("setup", 0)), float(body.get("PRI", 0)), float(body.get("PQ", 0)), float(body.get("GQ", 0))))
        if k == "schedule":
            return ok(200, C.schedule(body.get("case") or body))
        if k == "kanban":
            return ok(200, {"N": C.kanban_bins(float(body["D"]), float(body["LT"]), float(body["a"]), float(body["C"]))})
        if k == "little":
            return ok(200, {"WIP": float(body["TH"]) * float(body["LT"])})
        return prob(400, "unknown kind", "oee | schedule | kanban | little")
    if res == "events" and G:
        since = int(_q(query, "since", "0") or 0)
        return ok(200, {"items": [e for e in S["events"] if e["seq"] > since][-200:]})
    if res == "control" and method == "POST":
        a = body.get("action")
        if a == "reset":
            _reset()
            return ok(200, {"reset": True})
        if a == "persist":
            PERSIST["on"] = bool(body.get("on", True))
            return ok(200, {"persist": PERSIST["on"], "path": PERSIST["path"]})
        return prob(400, "unknown action", "reset | persist")
    return prob(404, "not found", path)


__all__ = ["handle", "API", "VERSION"]
