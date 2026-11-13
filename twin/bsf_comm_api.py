"""
Ball screw + guide factory (item 4) - HTTP APIs of the BUSINESS LAYER (demo, in-memory): MES, ERP, AGV fleet, label printer.
Guide: docs/43_bsf_communication_modbus_http.md chapters 10 - 12. The MES routes /api/bsf/mes/... are served by the real MES
(item 6, twin/bsf_mes.py, delegated below); the ERP routes /api/bsf/erp/... by the real ERP (item 7, twin/bsf_erp.py, delegated below). Here every other resource exists with realistic JSON so that the contracts (paths, fields, status codes, errors) can be tested.

Conventions (all routes, also under /api/bsf/v1/...):
  * JSON in + out (RFC 8259), UTF-8, field names camelCase, times ISO 8601 UTC ("2026-11-13T08:15:00Z")
  * POST that creates something: header "Idempotency-Key: <uuid>" (or body "msgId") - the same key returns the
    same answer (status 200 + "replay": true) instead of creating a second object
  * lists: ?page=1&size=20 -> {"items": [...], "page": 1, "size": 20, "total": 57, "next": "...page=2..."}
  * errors: RFC 9457 problem+json {"type", "title", "status", "detail"}; 400 bad request, 401/403 auth, 404 unknown,
    409 conflict (state does not allow it), 422 business rule failed, 429 too many requests, 503 not available
  * auth: "Authorization: Bearer <api key>" over HTTPS in the real plant (not enforced in this demo)
ALL VALUES ARE EXAMPLES.
"""

from __future__ import annotations

import collections
import threading
import time

LOCK = threading.RLock()
IDEM = collections.OrderedDict()          # idempotency key -> (status, body)
DB = {"so": {}, "po": {}, "mov": [], "to": {}, "jobs": {}, "seq": collections.Counter()}

API = [
    ["GET", "/api/bsf/mes/workorders?status=released&page=1&size=20", "MES work orders (paged) - item 6 MES twin/bsf_mes.py"],
    ["POST", "/api/bsf/mes/workorders", "create a work order {product, qty, due} (Idempotency-Key) - item 6 MES"],
    ["GET", "/api/bsf/mes/workorders/{id}", "one work order with lots + operations - item 6 MES"],
    ["POST", "/api/bsf/mes/workorders/{id}/release", "readiness check + release (409 if not 'created', 422 not ready) - item 6 MES"],
    ["GET", "/api/bsf/mes/dispatch?machine=BS-TGR-03", "dispatch list of one machine - item 6 MES"],
    ["POST", "/api/bsf/mes/confirmations", "operation confirmation {wo | lot, op, machine, good, scrap} (Idempotency-Key) - item 6 MES"],
    ["GET", "/api/bsf/mes/trace?serial=BS3210-...", "genealogy + operations + measured values - item 6 MES (full list: GET /api/bsf/mes/api)"],
    ["GET", "/api/bsf/erp/salesorders", "ERP sales orders - item 7 ERP twin/bsf_erp.py"],
    ["POST", "/api/bsf/erp/salesorders", "create a sales order {customer, product, qty, due} - item 7 ERP"],
    ["POST", "/api/bsf/erp/productionorders/{id}/release", "release a production order -> creates + releases the MES work order - item 7 ERP"],
    ["POST", "/api/bsf/erp/goodsmovements", "goods issue (GI) / goods receipt (GR) {type, material, qty, order} - item 7 ERP"],
    ["GET", "/api/bsf/erp/stock?material=LB-25-FL", "stock per material - item 7 ERP (full list: GET /api/bsf/erp/api)"],
    ["POST", "/api/bsf/agv/transportorders", "AGV transport order {from, to, load, priority} (VDA 5050 ideas over HTTP)"],
    ["GET", "/api/bsf/agv/transportorders/{id}", "transport order state CREATED -> ASSIGNED -> PICKING -> DELIVERING -> FINISHED"],
    ["POST", "/api/bsf/printer/jobs", "label print job {printer, template, data} -> print server (HTTP)"],
    ["GET", "/api/bsf/printer/jobs/{id}", "print job state"],
]


def iso(t=None):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t or time.time()))


def nid(prefix):
    DB["seq"][prefix] += 1
    return f"{prefix}-{DB['seq'][prefix]:05d}"


def prob(status, title, detail=""):
    return status, {"type": f"https://plant.example/problems/{title.replace(' ', '-')}", "title": title, "status": status, "detail": detail}, "application/problem+json; charset=utf-8"


def ok(status, body):
    return status, body, "application/json; charset=utf-8"


def page(items, query, base):
    def q(k, d):
        v = query.get(k, [d])
        return v[0] if isinstance(v, list) else v
    p = max(1, int(q("page", "1") or 1))
    s = max(1, min(200, int(q("size", "20") or 20)))
    tot = len(items)
    out = {"items": items[(p - 1) * s:p * s], "page": p, "size": s, "total": tot}
    if p * s < tot:
        out["next"] = f"{base}?page={p + 1}&size={s}"
    return out


def _seed():
    if DB["so"]:
        return
    DB["so"]["SO-00001"] = {"id": "SO-00001", "customer": "Machine builder A (example)", "product": "FABS", "qty": 40, "due": iso(time.time() + 86400 * 10), "status": "open", "created": iso()}
    DB["seq"]["SO"] = 1


def _idem(headers, body):
    k = ""
    if headers is not None:
        try:
            k = headers.get("Idempotency-Key") or ""
        except AttributeError:
            k = ""
    return k or str(body.get("msgId") or "")


def handle(method, sub, query, body, headers=None):
    """sub = path after /api/bsf/ (e.g. 'mes/workorders/WO-00001/release')."""
    parts = [p for p in sub.split("/") if p]
    if parts and parts[0] == "mes":   # item 6: the real MES (twin/bsf_mes.py) took over the former demo MES routes
        from twin import bsf_mes
        return bsf_mes.handle(method, "/api/bsf/" + "/".join(parts), query, body, headers)
    if parts and parts[0] == "erp":   # item 7: the real ERP (twin/bsf_erp.py) took over the former demo ERP routes (same paths + fields)
        from twin import bsf_erp
        return bsf_erp.handle(method, "/api/bsf/" + "/".join(parts), query, body, headers)
    with LOCK:
        _seed()
        key = _idem(headers, body) if method == "POST" else ""
        if key and key in IDEM:
            st, b = IDEM[key]
            return ok(200, {**b, "replay": True})
        r = _route(method, parts, query, body)
        if key and r[0] in (200, 201):
            IDEM[key] = (r[0], r[1])
            while len(IDEM) > 500:
                IDEM.popitem(last=False)
        return r


def _route(method, P, query, body):
    def q(k, d=""):
        v = query.get(k, [d])
        return v[0] if isinstance(v, list) else v
    area = P[0]
    res = P[1] if len(P) > 1 else ""
    rid = P[2] if len(P) > 2 else ""
    act = P[3] if len(P) > 3 else ""
    # MES routes: item 6 (twin/bsf_mes.py) - delegated in handle() above
    # ERP routes: item 7 (twin/bsf_erp.py) - delegated in handle() above (the former in-memory demo ERP was removed)
    # ------------------------------------------------------------ AGV fleet (VDA 5050 ideas mapped to REST)
    if area == "agv":
        if res == "transportorders" and not rid and method == "POST":
            fr, to = body.get("from"), body.get("to")
            if not fr or not to or fr == to:
                return prob(400, "from and to needed (different stations)")
            o = {"id": nid("TO"), "from": fr, "to": to, "load": body.get("load", ""), "priority": int(body.get("priority", 5) or 5),
                 "state": "CREATED", "vehicle": None, "created": iso(), "t0": time.time()}
            DB["to"][o["id"]] = o
            return ok(201, _to_view(o))
        if res == "transportorders" and rid and method == "GET":
            o = DB["to"].get(rid)
            if not o:
                return prob(404, "unknown transport order", rid)
            return ok(200, _to_view(o))
        if res == "transportorders" and not rid and method == "GET":
            return ok(200, page([_to_view(o) for o in DB["to"].values()], query, "/api/bsf/agv/transportorders"))
        if res == "vehicles" and method == "GET":
            return ok(200, {"items": [{"id": "AGV-01", "ip": "10.60.50.51", "state": "IDLE", "soc": 78}, {"id": "AGV-02", "ip": "10.60.50.52", "state": "DRIVING", "soc": 64}]})
    # ------------------------------------------------------------ label printer (via print server - HTTP)
    if area == "printer":
        if res == "jobs" and not rid and method == "POST":
            d = body.get("data") or {}
            if not body.get("template"):
                return prob(400, "template needed", "e.g. 'BS-box-100x50'")
            zpl = "^XA^FO40,30^A0N,40,40^FD{}^FS^FO40,80^BCN,80,Y,N,N^FD{}^FS^FO40,200^A0N,28,28^FDqty {}  lot {}^FS^XZ".format(
                d.get("part", "BS-3210-1000-C5"), d.get("serial", "BS-0001"), d.get("qty", 1), d.get("lot", "WO-00001-L01"))
            j = {"id": nid("PJ"), "printer": body.get("printer", "PRT-PCK-01"), "template": body["template"], "state": "QUEUED", "created": iso(), "t0": time.time(),
                 "zplPreview": zpl, "note": "the print server sends ZPL to the printer (raw TCP 9100 inside the print server - the MES only talks HTTP)"}
            DB["jobs"][j["id"]] = j
            return ok(201, {k: v for k, v in j.items() if k != "t0"})
        if res == "jobs" and rid and method == "GET":
            j = DB["jobs"].get(rid)
            if not j:
                return prob(404, "unknown print job", rid)
            j["state"] = "PRINTED" if time.time() - j["t0"] > 2 else "PRINTING"
            return ok(200, {k: v for k, v in j.items() if k != "t0"})
    return prob(404, "not found", "/api/bsf/" + "/".join(P))


def _to_view(o):
    el = time.time() - o["t0"]
    st = "CREATED" if el < 1 else "ASSIGNED" if el < 3 else "PICKING" if el < 6 else "DELIVERING" if el < 12 else "FINISHED"
    o["state"] = st
    if st != "CREATED":
        o["vehicle"] = o["vehicle"] or "AGV-01"
    return {k: v for k, v in o.items() if k != "t0"}
