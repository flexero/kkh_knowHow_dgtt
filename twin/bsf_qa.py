"""
Ball screw + guide factory (item 5) - QUALITY + INSPECTION backend (demo, in-memory, stdlib only).
Guide: docs/44_bsf_quality_inspection.md (chapter 19 + Appendix A). Page: web/bsfqa.js (#bfItem5).

Inert until used: nothing starts at import, no thread, no port. server.py routes /api/bsf/qa/... here (lazy import).

Routes (also under /api/bsf/v1/qa/...), JSON in + out, problem+json errors (RFC 9457) - same conventions as item 4:
  GET  /api/bsf/qa/health                       {"ok": true, "results": n, "ncr": n}
  GET  /api/bsf/qa/api                          route list
  POST /api/bsf/qa/results                      one measurement record (Idempotency-Key or body msgId) -> 201 {id, decision}
  GET  /api/bsf/qa/results?serial=&char=&n=50   newest records (filter by serial / characteristic)
  GET  /api/bsf/qa/trace?serial=BS3210-...      all records of one serial number, grouped by operation
  GET  /api/bsf/qa/spc?char=BS-EP&n=5           X-bar / R limits + Cp / Cpk of the stored values of one characteristic
  POST /api/bsf/qa/ncr                          non-conformance report {serial, char, value, text, ...} -> 201 {id, status "open"}
  GET  /api/bsf/qa/ncr                          list of NCRs
  POST /api/bsf/qa/ncr/{id}/step                {"step": "contain"|"root-cause"|"action"|"verify"|"close", "text": "..."}
  POST /api/bsf/qa/eval                         {"kind": "lead"|"capability"|"grr", ...} -> the same calculation as the page
                                                 (independent stdlib implementation = cross-check of web/bsfqa_calc.js)
ALL VALUES ARE EXAMPLES - check the standards (ISO 3408-3, ISO 22514, AIAG MSA) and your customer.
"""

from __future__ import annotations

import collections
import math
import threading
import time

VERSION = "bsf_qa 1.0"
LOCK = threading.RLock()
IDEM = collections.OrderedDict()
DB = {"res": [], "ncr": {}, "seq": collections.Counter()}
MAXRES = 20000

API = [
    ["GET", "/api/bsf/qa/health", "QA service health + counts"],
    ["POST", "/api/bsf/qa/results", "measurement record {serial, part, char, value, unit, lsl, usl, gauge, machine, operator, op} (Idempotency-Key)"],
    ["GET", "/api/bsf/qa/results?serial=&char=&n=50", "newest measurement records"],
    ["GET", "/api/bsf/qa/trace?serial=BS3210-...", "all records of one serial, grouped by operation"],
    ["GET", "/api/bsf/qa/spc?char=BS-EP&n=5", "X-bar / R control limits + Cp / Cpk from the stored values"],
    ["POST", "/api/bsf/qa/ncr", "open a non-conformance report (NCR)"],
    ["GET", "/api/bsf/qa/ncr", "list of NCRs"],
    ["POST", "/api/bsf/qa/ncr/{id}/step", "8D step: contain | root-cause | action | verify | close"],
    ["POST", "/api/bsf/qa/eval", "calculation cross-check: lead (ISO 3408-3), capability (Cp/Cpk), grr (AIAG average + range and ANOVA)"],
]

# ------------------------------------------------------------------ tables (same as web/bsfqa_data.js / web/bsfprod_data.js)
ACC_BINS = [315, 400, 500, 630, 800, 1000, 1250, 1600, 2000]
ACC_EP = {"C3": [12, 13, 15, 16, 18, 21, 24, 29, 35], "C5": [23, 25, 27, 30, 35, 40, 46, 54, 65]}
ACC_VUP = {"C3": [8, 10, 10, 12, 13, 15, 16, 18, 21], "C5": [18, 20, 20, 23, 25, 27, 30, 35, 40]}
ACC_V300 = {"C3": 8, "C5": 18, "C7": 50}
ACC_V2PI = {"C3": 6, "C5": 8}
# control chart constants n = 2 ... 10
K = {
    "A2": [1.880, 1.023, 0.729, 0.577, 0.483, 0.419, 0.373, 0.337, 0.308],
    "D3": [0, 0, 0, 0, 0, 0.076, 0.136, 0.184, 0.223],
    "D4": [3.267, 2.574, 2.282, 2.114, 2.004, 1.924, 1.864, 1.816, 1.777],
    "d2": [1.128, 1.693, 2.059, 2.326, 2.534, 2.704, 2.847, 2.970, 3.078],
}
GRR_K1 = {2: 0.8862, 3: 0.5908}
GRR_K2 = {2: 0.7071, 3: 0.5231}
GRR_K3 = {2: 0.7071, 3: 0.5231, 4: 0.4467, 5: 0.4030, 6: 0.3742, 7: 0.3534, 8: 0.3375, 9: 0.3249, 10: 0.3146}


# ------------------------------------------------------------------ calculations (independent of the JavaScript)
def lsq(x, y):
    n = len(x)
    mx, my = sum(x) / n, sum(y) / n
    sxx = sum((a - mx) ** 2 for a in x)
    sxy = sum((a - mx) * (b - my) for a, b in zip(x, y))
    b = sxy / sxx if sxx else 0.0
    return my - b * mx, b


def window_range(x, r, w):
    """largest (max - min) of r inside any window of length w (x sorted). Whole range if the travel is shorter than w."""
    n = len(x)
    if x[-1] - x[0] <= w + 1e-9:
        return max(r) - min(r)
    best, j = 0.0, 0
    for i in range(n):
        if x[i] + w > x[-1] + 1e-9:
            break
        lo = hi = r[i]
        j = i
        while j < n and x[j] <= x[i] + w + 1e-9:
            lo, hi = min(lo, r[j]), max(hi, r[j])
            j += 1
        best = max(best, hi - lo)
    return best


def lead_eval(x, e, T=0.0, ph=10.0):
    """ISO 3408-3 evaluation. x mm (sorted), e = actual travel deviation um (already at 20 degC), T = travel compensation um over l_u."""
    lu = x[-1] - x[0]
    a, b = lsq(x, e)
    E = b * lu
    r = [ei - (a + b * xi) for xi, ei in zip(x, e)]
    vu = max(r) - min(r)
    v300 = window_range(x, r, 300.0)
    v2pi = window_range(x, r, ph)
    k = next((i for i, v in enumerate(ACC_BINS) if lu <= v), len(ACC_BINS) - 1)
    dev = E - T
    lim = {
        "C3": {"ep": ACC_EP["C3"][k], "vup": ACC_VUP["C3"][k], "v300": ACC_V300["C3"], "v2pi": ACC_V2PI["C3"]},
        "C5": {"ep": ACC_EP["C5"][k], "vup": ACC_VUP["C5"][k], "v300": ACC_V300["C5"], "v2pi": ACC_V2PI["C5"]},
        "C7": {"ep": lu / 300.0 * ACC_V300["C7"], "vup": None, "v300": ACC_V300["C7"], "v2pi": None},
    }
    ok = {}
    for g, L in lim.items():
        ok[g] = abs(dev) <= L["ep"] + 1e-9 and v300 <= L["v300"] + 1e-9 and (L["vup"] is None or vu <= L["vup"] + 1e-9) and (L["v2pi"] is None or v2pi <= L["v2pi"] + 1e-9)
    grade = next((g for g in ("C3", "C5", "C7") if ok[g]), "reject")
    return {"lu": lu, "a": a, "b_um_per_mm": b, "E": E, "T": T, "dev": dev, "vu": vu, "v300": v300, "v2pi": v2pi, "bin": ACC_BINS[k], "limits": lim, "ok": ok, "grade": grade}


def mean(v):
    return sum(v) / len(v)


def sdev(v):
    m = mean(v)
    return math.sqrt(sum((a - m) ** 2 for a in v) / (len(v) - 1)) if len(v) > 1 else 0.0


def capability(groups, lsl=None, usl=None):
    """groups = list of subgroups (equal size n >= 2). Within sigma = R-bar / d2, overall = s of all values."""
    n = len(groups[0])
    xb = [mean(g) for g in groups]
    rr = [max(g) - min(g) for g in groups]
    xbb, rb = mean(xb), mean(rr)
    i = n - 2
    sw = rb / K["d2"][i]
    allv = [a for g in groups for a in g]
    so = sdev(allv)
    out = {"n": n, "k": len(groups), "xbarbar": xbb, "rbar": rb, "sigmaWithin": sw, "sigmaOverall": so,
           "UCLx": xbb + K["A2"][i] * rb, "LCLx": xbb - K["A2"][i] * rb, "UCLr": K["D4"][i] * rb, "LCLr": K["D3"][i] * rb}

    def idx(s):
        c = []
        if usl is not None:
            c.append((usl - xbb) / (3 * s))
        if lsl is not None:
            c.append((xbb - lsl) / (3 * s))
        return min(c) if c else None
    if sw > 0:
        out["Cp"] = (usl - lsl) / (6 * sw) if usl is not None and lsl is not None else None
        out["Cpk"] = idx(sw)
    if so > 0:
        out["Pp"] = (usl - lsl) / (6 * so) if usl is not None and lsl is not None else None
        out["Ppk"] = idx(so)
    return out


def grr(data, tol=None):
    """data[operator][part][trial]. AIAG MSA 4th ed. average + range method AND two-way ANOVA with interaction."""
    a, b, r = len(data), len(data[0]), len(data[0][0])
    rbar_op = [mean([max(p) - min(p) for p in op]) for op in data]
    xbar_op = [mean([v for p in op for v in p]) for op in data]
    rbb = mean(rbar_op)
    ev = rbb * GRR_K1[r]
    xdiff = max(xbar_op) - min(xbar_op)
    av = math.sqrt(max(0.0, (xdiff * GRR_K2[a]) ** 2 - ev ** 2 / (b * r)))
    g = math.sqrt(ev ** 2 + av ** 2)
    xp = [mean([data[o][p][t] for o in range(a) for t in range(r)]) for p in range(b)]
    rp = max(xp) - min(xp)
    pv = rp * GRR_K3[b]
    tv = math.sqrt(g ** 2 + pv ** 2)
    ar = {"rbarOp": rbar_op, "xbarOp": xbar_op, "rbarbar": rbb, "xdiff": xdiff, "Rp": rp, "EV": ev, "AV": av, "GRR": g, "PV": pv, "TV": tv,
          "pctEV": 100 * ev / tv, "pctAV": 100 * av / tv, "pctGRR": 100 * g / tv, "pctPV": 100 * pv / tv, "ndc": int(math.floor(1.41 * pv / g)) if g > 0 else None,
          "pctTol": 100 * 6 * g / tol if tol else None}
    # ANOVA
    allv = [data[o][p][t] for o in range(a) for p in range(b) for t in range(r)]
    gm = mean(allv)
    mo = [mean([data[o][p][t] for p in range(b) for t in range(r)]) for o in range(a)]
    mp = xp
    cell = [[mean(data[o][p]) for p in range(b)] for o in range(a)]
    ss_o = b * r * sum((m - gm) ** 2 for m in mo)
    ss_p = a * r * sum((m - gm) ** 2 for m in mp)
    ss_c = r * sum((cell[o][p] - gm) ** 2 for o in range(a) for p in range(b))
    ss_i = ss_c - ss_o - ss_p
    ss_t = sum((v - gm) ** 2 for v in allv)
    ss_e = ss_t - ss_c
    df_o, df_p, df_i, df_e = a - 1, b - 1, (a - 1) * (b - 1), a * b * (r - 1)
    ms_o, ms_p, ms_i, ms_e = ss_o / df_o, ss_p / df_p, ss_i / df_i, ss_e / df_e
    v_e = ms_e
    v_i = max(0.0, (ms_i - ms_e) / r)
    v_o = max(0.0, (ms_o - ms_i) / (b * r))
    v_p = max(0.0, (ms_p - ms_i) / (a * r))
    v_g = v_e + v_o + v_i
    sg, sp = math.sqrt(v_g), math.sqrt(v_p)
    stv = math.sqrt(v_g + v_p)
    an = {"SS": {"part": ss_p, "operator": ss_o, "interaction": ss_i, "error": ss_e, "total": ss_t},
          "df": {"part": df_p, "operator": df_o, "interaction": df_i, "error": df_e},
          "MS": {"part": ms_p, "operator": ms_o, "interaction": ms_i, "error": ms_e},
          "F_interaction": ms_i / ms_e if ms_e else None,
          "var": {"repeatability": v_e, "operator": v_o, "interaction": v_i, "part": v_p, "GRR": v_g},
          "sigmaGRR": sg, "sigmaPart": sp, "sigmaTV": stv, "pctGRR": 100 * sg / stv, "ndc": int(math.floor(1.41 * sp / sg)) if sg > 0 else None,
          "pctTol": 100 * 6 * sg / tol if tol else None}
    return {"ar": ar, "anova": an}


# ------------------------------------------------------------------ HTTP
def iso(t=None):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t if t is not None else time.time()))


def nid(prefix):
    DB["seq"][prefix] += 1
    return f"{prefix}-{DB['seq'][prefix]:05d}"


def prob(status, title, detail=""):
    return status, {"type": "about:blank", "title": title, "status": status, "detail": detail}, "application/problem+json; charset=utf-8"


def ok(status, body):
    return status, body, "application/json; charset=utf-8"


def _num(v):
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def _decide(rec):
    v, lo, hi = rec.get("value"), rec.get("lsl"), rec.get("usl")
    if rec.get("result") in ("OK", "NOK"):
        return rec["result"]
    if v is None:
        return "NOK"
    if (lo is not None and v < lo) or (hi is not None and v > hi):
        return "NOK"
    return "OK"


def handle(method, path, query=None, body=None, headers=None):
    """-> (status, obj, content type). Never raises."""
    query = query or {}
    body = body or {}
    if path.startswith("/api/bsf/v1/"):
        path = "/api/bsf/" + path[len("/api/bsf/v1/"):]
    try:
        with LOCK:
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
            if key and r[0] in (200, 201):
                IDEM[key] = (r[0], r[1])
                while len(IDEM) > 2000:
                    IDEM.popitem(last=False)
            return r
    except Exception as e:  # noqa: BLE001 - a demo service must answer, never crash the server
        return prob(500, "internal error", f"{type(e).__name__}: {e}")


def _q(query, k, d=""):
    v = query.get(k, [d])
    return v[0] if isinstance(v, list) else v


def _route(method, path, query, body):
    P = [p for p in path[len("/api/bsf/qa"):].split("/") if p]
    res = P[0] if P else ""
    if method == "GET" and res in ("", "health"):
        return ok(200, {"ok": True, "version": VERSION, "results": len(DB["res"]), "ncr": len(DB["ncr"]), "t": iso()})
    if method == "GET" and res == "api":
        return ok(200, {"version": VERSION, "routes": API})
    if res == "results":
        if method == "POST":
            recs = body.get("records") if isinstance(body.get("records"), list) else [body]
            out = []
            for b in recs:
                if not isinstance(b, dict):
                    return prob(400, "record must be a JSON object")
                if not b.get("serial") or not b.get("char"):
                    return prob(400, "missing field", "serial and char are required")
                v = _num(b.get("value"))
                if v is None and b.get("result") not in ("OK", "NOK"):
                    return prob(422, "no value", "value (number) or result OK / NOK is required")
                rec = {"id": nid("QR"), "serial": str(b["serial"])[:40], "part": str(b.get("part", ""))[:40], "char": str(b["char"])[:24],
                       "name": str(b.get("name", ""))[:80], "value": v, "unit": str(b.get("unit", ""))[:12], "lsl": _num(b.get("lsl")), "usl": _num(b.get("usl")),
                       "result": b.get("result"), "op": str(b.get("op", ""))[:8], "machine": str(b.get("machine", ""))[:24], "gauge": str(b.get("gauge", ""))[:40],
                       "operator": str(b.get("operator", ""))[:24], "lot": str(b.get("lot", ""))[:40], "heat": str(b.get("heat", ""))[:40],
                       "tMeas": str(b.get("tMeas") or iso()), "t": iso(), "source": str(b.get("source", "http"))[:16]}
                if isinstance(b.get("curve"), dict):
                    rec["curve"] = {k: b["curve"][k] for k in list(b["curve"])[:6]}
                rec["decision"] = _decide(rec)
                DB["res"].append(rec)
                out.append({"id": rec["id"], "serial": rec["serial"], "char": rec["char"], "decision": rec["decision"]})
            if len(DB["res"]) > MAXRES:
                del DB["res"][: len(DB["res"]) - MAXRES]
            return ok(201, out[0] if len(out) == 1 and "records" not in body else {"items": out, "n": len(out)})
        if method == "GET":
            sn, ch = _q(query, "serial"), _q(query, "char")
            n = max(1, min(1000, int(_q(query, "n", "50") or 50)))
            items = [r for r in DB["res"] if (not sn or r["serial"] == sn) and (not ch or r["char"] == ch)]
            return ok(200, {"items": items[-n:], "total": len(items)})
    if method == "GET" and res == "trace":
        sn = _q(query, "serial")
        items = [r for r in DB["res"] if r["serial"] == sn]
        if not items:
            return prob(404, "unknown serial", f"no records for {sn!r} - POST /api/bsf/qa/results first")
        ops = collections.OrderedDict()
        for r in items:
            ops.setdefault(r["op"] or "-", []).append({k: r[k] for k in ("char", "name", "value", "unit", "decision", "machine", "gauge", "operator", "tMeas")})
        f = items[-1]
        return ok(200, {"serial": sn, "part": f["part"], "lot": f["lot"], "heat": f["heat"], "operations": [{"op": k, "records": v} for k, v in ops.items()],
                        "decision": "NOK" if any(r["decision"] == "NOK" for r in items) else "OK"})
    if method == "GET" and res == "spc":
        ch = _q(query, "char")
        n = max(2, min(10, int(_q(query, "n", "5") or 5)))
        vals = [r for r in DB["res"] if r["char"] == ch and r["value"] is not None]
        if len(vals) < 2 * n:
            return prob(409, "not enough data", f"{len(vals)} values of {ch!r}, need >= {2 * n}")
        k = len(vals) // n
        use = vals[-k * n:]
        groups = [[r["value"] for r in use[i * n:(i + 1) * n]] for i in range(k)]
        c = capability(groups, use[-1]["lsl"], use[-1]["usl"])
        return ok(200, {"char": ch, "values": len(vals), "subgroups": k, **c})
    if res == "ncr":
        if method == "POST" and len(P) == 1:
            if not body.get("text") and not body.get("char"):
                return prob(400, "missing field", "text or char is required")
            n = {"id": nid("NCR"), "status": "open", "serial": str(body.get("serial", ""))[:40], "char": str(body.get("char", ""))[:24],
                 "value": _num(body.get("value")), "text": str(body.get("text", ""))[:500], "machine": str(body.get("machine", ""))[:24],
                 "qty": int(_num(body.get("qty")) or 1), "steps": [{"step": "detect", "text": str(body.get("text", ""))[:500], "t": iso()}], "created": iso()}
            DB["ncr"][n["id"]] = n
            return ok(201, n)
        if method == "GET" and len(P) == 1:
            return ok(200, {"items": list(DB["ncr"].values())[-100:], "total": len(DB["ncr"])})
        if len(P) >= 2:
            n = DB["ncr"].get(P[1])
            if not n:
                return prob(404, "unknown NCR", P[1])
            if method == "GET" and len(P) == 2:
                return ok(200, n)
            if method == "POST" and len(P) == 3 and P[2] == "step":
                order = ["detect", "contain", "root-cause", "action", "verify", "close"]
                st = str(body.get("step", ""))
                if st not in order:
                    return prob(400, "unknown step", f"one of {order[1:]}")
                if n["status"] == "closed":
                    return prob(409, "NCR closed", n["id"])
                done = [s["step"] for s in n["steps"]]
                if order.index(st) > order.index(done[-1]) + 1:
                    return prob(409, "step out of order", f"last step '{done[-1]}', next is '{order[order.index(done[-1]) + 1]}'")
                n["steps"].append({"step": st, "text": str(body.get("text", ""))[:500], "t": iso()})
                n["status"] = "closed" if st == "close" else st
                return ok(200, n)
    if method == "POST" and res == "eval":
        kind = body.get("kind")
        if kind == "lead":
            x, e = body.get("x") or [], body.get("e") or []
            if len(x) < 3 or len(x) != len(e):
                return prob(400, "x and e must be lists of equal length >= 3")
            return ok(200, lead_eval([float(v) for v in x], [float(v) for v in e], float(body.get("T", 0) or 0), float(body.get("ph", 10) or 10)))
        if kind == "capability":
            g = body.get("groups") or []
            if len(g) < 2 or any(len(s) != len(g[0]) for s in g) or not 2 <= len(g[0]) <= 10:
                return prob(400, "groups must be >= 2 subgroups of equal size 2 ... 10")
            return ok(200, capability(g, _num(body.get("lsl")), _num(body.get("usl"))))
        if kind == "grr":
            d = body.get("data") or []
            try:
                return ok(200, grr(d, _num(body.get("tol"))))
            except (KeyError, IndexError, ZeroDivisionError, TypeError, ValueError) as ex:
                return prob(400, "bad data", f"data[operator][part][trial], 2 - 3 operators, 2 - 3 trials, 2 - 10 parts ({ex})")
        return prob(400, "unknown kind", "lead | capability | grr")
    return prob(404, "unknown QA resource", path)
