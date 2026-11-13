"""
Ball screw + guide factory (item 7) - ERP service (stdlib only): master data, configurator, quotations + sales orders with ATP / CTP,
MRP, purchasing + goods receipt with incoming inspection, stock per location / batch, valuation, production orders released to the MES
over HTTP (confirmations back), costing + variances, simple finance, KPIs.
Guide: docs/46_bsf_erp.md.  Page: web/bsferp.js (#bfItem7).  Browser twin of this service: web/bsferp_core.js (same model + paths).

INERT UNTIL USED: importing starts nothing (no thread, no port, no file). server.py routes /api/bsf/erp/... (and /api/bsf/v1/erp/...) here with
a lazy import; the former item-4 demo ERP routes (twin/bsf_comm_api.py) are handed over to this module with the same paths + fields.
Persistence: one SQLite file, opened and written ONLY after the first state-changing request (POST):
  path = env BSF_ERP_DB, else <folder of the server's --db>/bsf_erp.sqlite, else <repo>/data/bsf_erp.sqlite
  table state (k, v JSON, t) = whole ERP state, table journal (seq, t, kind, text) = audit trail.
  Off: POST /api/bsf/erp/control {"action": "persist", "on": false}.
Link to the MES (item 6, twin/bsf_mes.py): in-process HTTP-shaped calls bsf_mes.handle(method, path, query, body, headers) - the same JSON
as over the wire; every call is written to the message log (GET /api/bsf/erp/log). The ERP lock is NOT held while the MES runs (the MES
books finished goods back into the ERP from its own lock - no deadlock).
Conventions = items 4 / 6: JSON camelCase, Idempotency-Key (or body msgId) for POST, problem+json errors (RFC 9457), paging. ALL VALUES ARE EXAMPLES.
"""

from __future__ import annotations

import collections
import json
import math
import os
import sqlite3
import sys
import threading
import time

from twin import bsf_erp_core as E

VERSION = "bsf_erp 1.0"
LOCK = threading.RLock()
PERSIST = {"on": True, "path": None, "db": None, "loaded": False, "saved": 0.0, "error": ""}
J = "application/json; charset=utf-8"
PJ = "application/problem+json; charset=utf-8"
MP = E.MD["plant"]


def now():
    return time.time()


def fmt(t):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t)) if t is not None else None


def prob(status, title, detail="", **extra):
    return status, {"type": "https://plant.example/problems/" + title.replace(" ", "-"), "title": title, "status": status, "detail": detail, **extra}, PJ


def ok(status, body):
    return status, body, J


def _q(query, k, d=""):
    v = (query or {}).get(k, [d])
    return v[0] if isinstance(v, list) else v


def r2(v, d=2):
    return round(float(v), d)


# ====================================================================== MES link (HTTP-shaped, in-process)
def _mes_call(method, path, body=None, headers=None):
    try:
        from twin import bsf_mes
        u = path.split("?", 1)
        q = {}
        if len(u) > 1:
            for kv in u[1].split("&"):
                if "=" in kv:
                    a, b = kv.split("=", 1)
                    q[a] = [b]
        st, d, _ct = bsf_mes.handle(method, u[0], q, body or {}, headers)
        return st, d
    except Exception as e:  # noqa: BLE001
        return 503, {"title": "MES not reachable", "detail": f"{type(e).__name__}: {e}"}


class _H(dict):
    def get(self, k, d=None):
        return super().get(k, d)


# ====================================================================== the ERP model (same as web/bsferp_core.js createERP)
class ERP:
    def __init__(self, now_fn=now, mes=None):
        self.now = now_fn
        self.mes_fn = mes
        self.S = None
        self.idem = collections.OrderedDict()
        self.fresh()

    # ------------------------------------------------------------ helpers
    def nid(self, p, w=5):
        S = self.S
        S["seq"][p] = S["seq"].get(p, 0) + 1
        return f"{p}-{S['seq'][p]:0{w}d}"

    def today(self):
        return E.day0(self.now())

    def ev(self, kind, text, **extra):
        S = self.S
        S["seq"]["ev"] = S["seq"].get("ev", 0) + 1
        e = {"seq": S["seq"]["ev"], "t": self.now(), "at": fmt(self.now()), "kind": kind, "text": text, **extra}
        S["events"].append(e)
        if len(S["events"]) > 1500:
            del S["events"][0]
        if self.on_event:
            self.on_event(e)
        return e

    on_event = None

    def log(self, direction, method, path, req, status, resp, ms=0.0):
        S = self.S
        S["seq"]["log"] = S["seq"].get("log", 0) + 1
        txt = json.dumps(resp, default=str)
        S["log"].append({"seq": S["seq"]["log"], "at": fmt(self.now()), "dir": direction, "method": method, "path": path, "req": req, "status": status,
                         "resp": resp if len(txt) < 1500 else {"_shortened": txt[:1500] + " …"}, "ms": r2(ms, 1)})
        if len(S["log"]) > 400:
            del S["log"][0]

    def mes(self, method, path, body=None, headers=None):
        t0 = time.perf_counter()
        if not self.mes_fn:
            st, d = 503, {"title": "MES not reachable", "detail": "no MES link configured"}
        else:
            st, d = self.mes_fn(method, path, body, headers)
        self.log("ERP → MES", method, path, body, st, d, (time.perf_counter() - t0) * 1000)
        return st, d

    # ------------------------------------------------------------ state
    def fresh(self):
        today = self.today()
        S = self.S = {"stock": [], "mav": {}, "so": {}, "qt": {}, "dn": {}, "inv": {}, "pr": {}, "po": {}, "insp": {}, "prod": {}, "conf": [], "mov": [], "ppv": [], "settled": [],
                      "mrp": None, "planned": {}, "log": [], "events": [], "seq": {}, "ctp": {}, "twin": {"orders": 0, "stores": None, "clock": ""}, "day0": today}
        for m in E.MAT.values():
            S["mav"][m["id"]] = E.std_price(m["id"])
        for mat, loc, batch, q in E.MD["stock0"]:
            S["stock"].append({"mat": mat, "loc": loc, "batch": batch, "qty": float(q), "status": "free"})
        for sup, mat, q, price, wk in E.MD["openPurchase"]:
            pid = self.nid("PU")
            S["po"][pid] = {"id": pid, "supplier": sup, "status": "sent", "created": fmt(self.now()), "lines": [{"pos": 10, "material": mat, "qty": float(q), "price": price, "due": E.iso_day(E.add_wd(today, wk * 5)), "received": 0.0}],
                            "sent": {"via": E.SUPP[sup]["channel"], "at": fmt(self.now())}, "source": "seed"}
        for pid, mat, q, wk, wo, st in E.MD["openProduction"]:
            S["prod"][pid] = self._prod_new(pid, mat, q, E.add_wd(today, wk * 5 + 2), "seed")
            S["prod"][pid].update({"status": st, "mesWorkOrder": wo if st != "created" else "", "releasedAt": fmt(self.now()) if st != "created" else None})
        S["seq"]["PO"] = 260003
        for cust, code, q, wk in E.MD["salesSeed"]:
            so = self._so_new(cust, [{"code": code, "qty": q}], E.add_wd(today, wk * 5 + 3), "seed")
            so["status"] = "confirmed"
            for ln in so["lines"]:
                ln["confirmed"] = so["due"]
                ln["method"] = "seed"
            so["confirmed"] = so["due"]
        self.seed_pipeline()
        self.ev("system", f"ERP initialised: {len(E.MAT)} materials, {len(E.CUST)} customers, {len(E.SUPP)} suppliers (example data)")

    # ------------------------------------------------------------ stock
    def free(self, mat):
        return sum(s["qty"] for s in self.S["stock"] if s["mat"] == mat and s["status"] == "free")

    def onhand(self, mat):
        return sum(s["qty"] for s in self.S["stock"] if s["mat"] == mat)

    def default_loc(self, mat):
        s = next((x for x in E.MD["stock0"] if x[0] == mat), None)
        if s:
            return s[1]
        t = E.MAT[mat]["type"]
        return {"fg": "FG-01" if E.route_of(mat) in ("FABS", "FALG") else "SM-01", "raw": "RM-01", "buy": "SM-02", "pack": "PK-01", "mro": "TS-01"}.get(t, "SM-01")

    def post(self, typ, mat, qty, order="", loc=None, batch="", status="free", price=None, text=""):
        """goods movement: GR (+) / GI (−) / transfer. Returns the movement (GI takes FIFO over the free stock rows)."""
        S = self.S
        if typ == "GR":
            loc = loc or self.default_loc(mat)
            row = next((s for s in S["stock"] if s["mat"] == mat and s["loc"] == loc and s["batch"] == batch and s["status"] == status), None)
            if row:
                row["qty"] += qty
            else:
                S["stock"].append({"mat": mat, "loc": loc, "batch": batch, "qty": float(qty), "status": status})
            if price is not None:
                q0 = self.onhand(mat) - qty
                S["mav"][mat] = E.mav(max(0.0, q0), S["mav"].get(mat, price), qty, price)
        else:
            left = qty
            for s in S["stock"]:
                if s["mat"] == mat and s["status"] == "free" and s["qty"] > 0 and left > 0:
                    take = min(s["qty"], left)
                    s["qty"] -= take
                    left -= take
            S["stock"] = [s for s in S["stock"] if s["qty"] > 1e-9]
        mv = {"id": self.nid("MV"), "type": typ, "material": mat, "qty": qty, "order": order, "loc": loc or "", "batch": batch, "stock": self.free(mat), "t": fmt(self.now()),
              "value": r2(qty * S["mav"].get(mat, 0)), "text": text}
        S["mov"].append(mv)
        if len(S["mov"]) > 3000:
            del S["mov"][0]
        return mv

    # ------------------------------------------------------------ sales
    def price_of(self, code, cust):
        g = E.CUST.get(cust, {}).get("group", "–")
        return E.list_price(code) * E.MD["priceGroups"].get(g, 1.0)

    def _so_new(self, cust, lines, due_day, source="api"):
        sid = self.nid("SO")
        ls = []
        for i, ln in enumerate(lines):
            p = ln.get("price") if ln.get("price") is not None else self.price_of(ln["code"], cust)
            ls.append({"pos": 10 * (i + 1), "code": ln["code"], "qty": float(ln["qty"]), "price": r2(p), "value": r2(p * float(ln["qty"])), "config": ln.get("config"), "confirmed": None, "method": "", "delivered": 0.0})
        so = {"id": sid, "customer": cust, "customerName": E.CUST.get(cust, {}).get("n", cust), "lines": ls, "product": ls[0]["code"], "qty": ls[0]["qty"], "due": E.iso_day(due_day),
              "status": "open", "created": fmt(self.now()), "createdDay": self.today(), "value": r2(sum(x["value"] for x in ls)), "confirmed": None, "source": source, "deliveries": [], "invoices": []}
        self.S["so"][sid] = so
        self.ev("sales", f"{sid} created: {cust} · " + ", ".join(f"{x['qty']:g} × {x['code']}" for x in ls) + f" · {so['value']:.0f} €")
        return so

    def atp(self, code, qty, exclude=None):
        today, H = self.today(), 40
        free = self.free(code)
        mps = E.MD["forecast"].get(code, 0) / MP["weekDays"]
        commit = [0.0] * (H + 1)
        for so in self.S["so"].values():
            if so["id"] == exclude or so["customer"] == "C-1000" or so["status"] in ("delivered", "invoiced", "paid", "cancelled", "open"):
                continue
            for ln in so["lines"]:
                if ln["code"] == code and ln["confirmed"] and ln["method"] != "CTP":
                    d = max(0, E.wd_between(today, E.parse_day(ln["confirmed"]) or today))
                    commit[min(H, d)] += ln["qty"] - ln["delivered"]
        cum, c = [], 0.0
        for d in range(H + 1):
            c += (free if d == 0 else mps) - commit[d]
            cum.append(c)
        avail = [min(cum[d:]) for d in range(H + 1)]
        atp_day = next((d for d in range(H + 1) if avail[d] >= qty - 1e-9), None)
        steps = [f"free stock {free:g}, MPS {mps:g} per working day (forecast / 5), committed {sum(commit):g} → ATP now {max(0, avail[0]):g}"]
        res = {"product": code, "qty": qty, "today": E.iso_day(today), "freeStock": free, "mps": mps, "atpNow": max(0.0, avail[0]), "atpDays": [r2(x, 1) for x in avail[:11]], "atpDay": atp_day}
        b = E.bottleneck(code)
        ctp = None
        if b:
            booked = self.S["ctp"].get(b["type"], {})
            base = E.mps_load(b["type"])
            fm = [max(0.0, b["cap"] - base - booked.get(str(E.add_wd(today, d)), 0.0)) for d in range(H)]
            up = MP["atp"]["upstreamDays"]
            r = E.route_of(code)
            raw_need, raw_free, raw_mat = 0.0, 0.0, ""
            for m_, q_ in E.explode_buy(code).items():
                if E.MAT[m_]["type"] == "raw":
                    raw_mat, raw_need, raw_free = m_, q_ * max(0.0, qty - max(0.0, avail[0])), self.free(m_)
                    if raw_need > raw_free:
                        up = max(up, E.MAT[m_]["lt"])
                    break
            ctp = E.ctp_case({"q": qty, "free": max(0.0, avail[0]), "minPerPc": b["minPerPc"], "freeMin": fm, "upstream": up, "after": MP["atp"]["afterDays"], "ship": MP["shipDays"]})
            ctp.update({"bottleneck": b["type"], "machines": b["n"], "capMin": b["cap"], "mpsLoadMin": base, "freeMinDay0": fm[0], "upstream": up, "route": r, "raw": raw_mat, "rawNeed": raw_need, "rawFree": raw_free})
            steps.append(f"CTP: {ctp['rem']:g} pcs × {b['minPerPc']:.2f} min = {ctp['need']:.0f} min on {b['type']} ({b['n']} machines, capacity {b['cap']:.0f} min/day, MPS load {base:.0f}, free ≈ {fm[0]:.0f} min/day)"
                         + (f"; raw {raw_mat} short ({raw_free:g} < {raw_need:g}) → start after {up} days" if raw_need > raw_free else f"; start after {up} days (soft + heat treatment)"))
        cands = []
        if atp_day is not None:
            cands.append((atp_day + MP["shipDays"], "ATP"))
        if ctp and ctp.get("promiseDay") is not None:
            cands.append((ctp["promiseDay"], "CTP"))
        if not cands:
            res.update({"ok": False, "ctp": ctp, "steps": steps + ["no date in the horizon of 40 working days – ask planning"], "method": "none"})
            return res
        pd, meth = min(cands)
        steps.append(f"promise = working day +{pd} ({meth}) = {E.iso_day(E.add_wd(today, pd))}")
        res.update({"ok": True, "ctp": ctp, "promiseDay": pd, "promiseDate": E.iso_day(E.add_wd(today, pd)), "method": meth, "steps": steps})
        return res

    def confirm_so(self, so):
        if so["status"] not in ("open", "confirmed"):
            return prob(409, "wrong state", f"{so['id']} is '{so['status']}'")
        out, last = [], self.today()
        for ln in so["lines"]:
            a = self.atp(ln["code"], ln["qty"] - ln["delivered"], exclude=so["id"])
            if not a.get("ok"):
                return prob(422, "no delivery date", "; ".join(a["steps"]), atp=a)
            ln["confirmed"], ln["method"] = a["promiseDate"], a["method"]
            if a["method"] == "CTP" and a["ctp"]:
                bk = self.S["ctp"].setdefault(a["ctp"]["bottleneck"], {})
                for d, m in a["ctp"]["used"]:
                    k = str(E.add_wd(self.today(), d))
                    bk[k] = bk.get(k, 0.0) + m
            last = max(last, E.parse_day(a["promiseDate"]))
            out.append(a)
        so["confirmed"], so["status"] = E.iso_day(last), "confirmed"
        so["ack"] = {"text": f"Order confirmation {so['id']}: we deliver " + "; ".join(f"{x['qty']:g} × {x['code']} on {x['confirmed']} ({x['method']})" for x in so["lines"]) + f". Total {so['value']:.2f} € net, terms {E.CUST.get(so['customer'], {}).get('terms', 30)} days.", "at": fmt(self.now())}
        self.ev("sales", f"{so['id']} confirmed for {so['confirmed']} (" + ", ".join(x["method"] for x in so["lines"]) + ")")
        return ok(200, {**so, "atp": out})

    def deliver(self, so):
        if so["status"] not in ("confirmed", "open", "ready"):
            return prob(409, "wrong state", f"{so['id']} is '{so['status']}'")
        for ln in so["lines"]:
            need = ln["qty"] - ln["delivered"]
            if self.free(ln["code"]) < need - 1e-9:
                return prob(409, "not enough stock", f"{ln['code']}: free {self.free(ln['code']):g} < {need:g} – produce first (MRP / production order)")
        dn = {"id": self.nid("DN"), "so": so["id"], "customer": so["customer"], "lines": [], "at": fmt(self.now()), "day": self.today()}
        for ln in so["lines"]:
            need = ln["qty"] - ln["delivered"]
            self.post("GI", ln["code"], need, so["id"], text="delivery " + dn["id"])
            ln["delivered"] += need
            dn["lines"].append({"code": ln["code"], "qty": need})
        conf = E.parse_day(so["confirmed"] or so["due"]) or self.today()
        dn["onTime"] = self.today() <= conf
        self.S["dn"][dn["id"]] = dn
        so["status"] = "delivered"
        so["deliveries"].append(dn["id"])
        self.ev("sales", f"{dn['id']} delivered {so['id']} ({'on time' if dn['onTime'] else 'LATE'})")
        return ok(201, dn)

    def invoice(self, so):
        if so["status"] != "delivered":
            return prob(409, "wrong state", f"{so['id']} is '{so['status']}' – deliver first")
        net = sum(ln["value"] for ln in so["lines"])
        terms = E.CUST.get(so["customer"], {}).get("terms", 30)
        inv = {"id": self.nid("INV"), "so": so["id"], "customer": so["customer"], "net": r2(net), "vatRate": MP["vat"], "vat": r2(net * MP["vat"]), "gross": r2(net * (1 + MP["vat"])),
               "date": E.iso_day(self.today()), "due": E.iso_day(self.today() + terms), "status": "open"}
        self.S["inv"][inv["id"]] = inv
        so["status"] = "invoiced"
        so["invoices"].append(inv["id"])
        self.ev("finance", f"{inv['id']} for {so['id']}: {inv['gross']:.2f} € gross, due {inv['due']}")
        return ok(201, inv)

    # ------------------------------------------------------------ MRP
    def mrp_inputs(self, H):
        today = self.today()
        items, indep = {}, {}
        for m in E.MAT.values():
            if m["type"] == "mro" or m.get("variant"):
                continue
            ltw = math.ceil(m["lt"] / MP["weekDays"]) if m["proc"] != "phantom" else 0
            price = E.std_price(m["id"]) or 1.0
            if m["proc"] == "make":
                S_ = sum(o["setup"] / 60 * E.mhr(o["m"])["rate"] for o in E.ops_of(E.route_of(m["id"])))
            else:
                S_ = MP["orderCost"]
            items[m["id"]] = {"oh": self.free(m["id"]), "ss": m["ss"], "lt": ltw, "lot": m["lot"], "q": m["lotQ"], "sr": [0.0] * H, "S": S_, "Hw": MP["holdRate"] * price / 50, "phantom": m["proc"] == "phantom",
                              "name": m["n"], "uom": m["uom"], "proc": m["proc"], "type": m["type"]}
        for po in self.S["po"].values():
            if po["status"] in ("cancelled", "closed"):
                continue
            for ln in po["lines"]:
                rest = ln["qty"] - ln["received"]
                if rest > 0 and ln["material"] in items:
                    items[ln["material"]]["sr"][min(H - 1, E.week_of(E.parse_day(ln["due"]) or today, today))] += rest
        for p in self.S["prod"].values():
            if p["status"] in ("done", "settled", "cancelled") or p["material"] not in items:
                continue
            rest = p["qty"] - p["good"]
            if rest > 0:
                items[p["material"]]["sr"][min(H - 1, E.week_of(E.parse_day(p["due"]) or today, today))] += rest
        firm = collections.defaultdict(lambda: [0.0] * H)
        for so in self.S["so"].values():
            if so["customer"] == "C-1000" or so["status"] in ("delivered", "invoiced", "paid", "cancelled"):
                continue
            for ln in so["lines"]:
                if ln["code"] in items:
                    firm[ln["code"]][min(H - 1, E.week_of(E.parse_day(ln["confirmed"] or so["due"]) or today, today))] += ln["qty"] - ln["delivered"]
        wd = (today + 3) % 7
        rest0 = max(0, 5 - wd) / 5 if wd < 5 else 0.0          # week 0: only the remaining working days of this week (past forecast is consumed)
        for code in items:
            fc = E.MD["forecast"].get(code, 0)
            f = firm.get(code, [0.0] * H)
            indep[code] = [max(fc * (rest0 if t == 0 else 1.0), f[t]) for t in range(H)]
        return items, indep

    def seed_pipeline(self):
        """a running plant already has open orders for the cumulative lead time: every planned order whose release would lie in the past becomes an open order (seed)."""
        t0 = self.today()
        mon = t0 - (t0 + 3) % 7
        for _it in range(12):              # level by level: the parents' new receipts change the children's gross requirements
            items, indep = self.mrp_inputs(MP["horizon"])
            res = E.mrp(items, indep, MP["horizon"])
            lv = [r["llc"] for i, r in res.items() if not items[i]["phantom"] and any(x.get("planned") for x in r["exceptions"])]
            n = 0
            for i, r in res.items():
                if items[i]["phantom"] or not lv or r["llc"] != min(lv):
                    continue
                for x in r["exceptions"]:
                    if not x.get("planned"):
                        continue
                    n += 1
                    due = max(t0, mon + 7 * x["bucket"] + 4)
                    if items[i]["proc"] == "make":
                        p = self._prod_new(self.nid("PO", 6), i, x["qty"], due, "pipeline (seed)")
                        p["status"], p["releasedAt"] = "released", fmt(self.now())
                    else:
                        pid, sup = self.nid("PU"), E.MAT[i]["sup"]
                        self.S["po"][pid] = {"id": pid, "supplier": sup, "status": "sent", "created": fmt(self.now()), "lines": [{"pos": 10, "material": i, "qty": x["qty"], "price": float(E.MAT[i]["price"]), "due": E.iso_day(due), "received": 0.0}],
                                             "sent": {"via": E.SUPP[sup]["channel"], "at": fmt(self.now())}, "source": "pipeline (seed)"}
            if not n:
                break

    def run_mrp(self, H=None):
        H = int(H or MP["horizon"])
        H = max(4, min(26, H))
        items, indep = self.mrp_inputs(H)
        res = E.mrp(items, indep, H)
        planned, exc = [], []
        self.S["seq"]["PL"] = 0
        mon = self.today() - (self.today() + 3) % 7
        for i, r in res.items():
            it = items[i]
            r.update({"name": it["name"], "uom": it["uom"], "proc": it["proc"], "type": it["type"], "oh": it["oh"], "ss": it["ss"], "lt": it["lt"], "lot": it["lot"], "q": it["q"], "indep": indep.get(i)})
            for x in r["exceptions"]:
                exc.append({"item": i, **x})
            if it["phantom"]:
                continue
            for t in range(H):
                q = r["prl"][t]
                if q > 1e-9:
                    pl = {"id": self.nid("PL"), "item": i, "qty": r2(q, 3), "release": t, "due": t + it["lt"], "releaseDate": E.iso_day(max(self.today(), mon + 7 * t)),
                          "dueDate": E.iso_day(mon + 7 * (t + it["lt"]) + 4), "kind": "production" if it["proc"] == "make" else "purchase", "status": "planned"}
                    planned.append(pl)
        self.S["planned"] = {p["id"]: p for p in planned}
        self.S["mrp"] = {"at": fmt(self.now()), "H": H, "weekStart": E.iso_day(mon), "items": res, "planned": [p["id"] for p in planned], "exceptions": exc}
        self.ev("mrp", f"MRP run: {len(res)} items, {len(planned)} planned orders, {len(exc)} exception messages")
        return {"at": self.S["mrp"]["at"], "H": H, "weekStart": E.iso_day(mon), "items": len(res), "planned": planned, "exceptions": exc,
                "summary": {i: {k: res[i][k] for k in ("llc", "gross", "sr", "poh", "net", "prc", "prl")} for i in list(res)[:60]}}

    def convert(self, pl):
        if pl["status"] != "planned":
            return prob(409, "wrong state", f"{pl['id']} is '{pl['status']}'")
        if pl["kind"] == "purchase":
            pr = {"id": self.nid("PR"), "material": pl["item"], "qty": pl["qty"], "need": pl["dueDate"], "supplier": E.MAT[pl["item"]]["sup"], "from": pl["id"], "status": "open", "created": fmt(self.now())}
            self.S["pr"][pr["id"]] = pr
            pl["status"], pl["to"] = "converted", pr["id"]
            self.ev("purchasing", f"{pl['id']} → requisition {pr['id']}: {pr['qty']:g} {pl['item']}")
            return ok(201, pr)
        p = self._prod_new(self.nid("PO", 6), pl["item"], pl["qty"], E.parse_day(pl["dueDate"]), "MRP " + pl["id"])
        pl["status"], pl["to"] = "converted", p["id"]
        self.ev("production", f"{pl['id']} → production order {p['id']}: {p['qty']:g} {p['material']}")
        return ok(201, self.prod_view(p))

    # ------------------------------------------------------------ purchasing + inventory
    def po_create(self, b):
        if b.get("requisition"):
            pr = self.S["pr"].get(b["requisition"])
            if not pr:
                return prob(404, "unknown requisition", str(b["requisition"]))
            if pr["status"] != "open":
                return prob(409, "wrong state", f"{pr['id']} is '{pr['status']}'")
            sup, lines = pr["supplier"], [{"material": pr["material"], "qty": pr["qty"], "due": pr["need"]}]
        else:
            sup, lines = b.get("supplier"), b.get("lines") or ([{"material": b.get("material"), "qty": b.get("qty")}] if b.get("material") else [])
            pr = None
        if sup not in E.SUPP:
            return prob(400, "unknown supplier", str(sup))
        if not lines:
            return prob(400, "lines needed", "[{material, qty, price?, due?}]")
        ls = []
        for i, ln in enumerate(lines):
            m = E.mat_id(ln.get("material"))
            if not m or E.MAT[m]["proc"] != "buy":
                return prob(400, "unknown purchased material", str(ln.get("material")))
            q = float(ln.get("qty") or 0)
            if q <= 0:
                return prob(422, "quantity must be > 0")
            due = ln.get("due") or E.iso_day(E.add_wd(self.today(), E.MAT[m]["lt"]))
            ls.append({"pos": 10 * (i + 1), "material": m, "qty": q, "price": float(ln.get("price") or E.MAT[m]["price"]), "due": due, "received": 0.0})
        po = {"id": self.nid("PU"), "supplier": sup, "status": "created", "created": fmt(self.now()), "lines": ls, "sent": None, "source": pr["id"] if pr else "api",
              "value": r2(sum(x["qty"] * x["price"] for x in ls))}
        self.S["po"][po["id"]] = po
        if pr:
            pr["status"], pr["po"] = "ordered", po["id"]
        self.ev("purchasing", f"{po['id']} created for {sup}: " + ", ".join(f"{x['qty']:g} {x['material']}" for x in ls))
        return ok(201, po)

    def po_send(self, po):
        if po["status"] not in ("created", "sent"):
            return prob(409, "wrong state", f"{po['id']} is '{po['status']}'")
        sup = E.SUPP[po["supplier"]]
        msg = {"orderNumber": po["id"], "buyer": "Ball screw + guide factory (example)", "supplier": po["supplier"], "currency": "EUR", "incoterm": "FCA",
               "lines": [{"pos": x["pos"], "material": x["material"], "text": E.MAT[x["material"]]["n"], "qty": x["qty"], "uom": E.MAT[x["material"]]["uom"], "price": x["price"], "due": x["due"]} for x in po["lines"]],
               "certificate": "EN 10204 3.1" if any(E.MAT[x["material"]]["type"] == "raw" for x in po["lines"]) else "", "deliveryAddress": "Goods-in gate 1 (example)"}
        http = "portal" in sup["channel"] or "HTTP" in sup["channel"]
        po["sent"] = {"via": sup["channel"], "at": fmt(self.now()), "http": http, "message": msg,
                      "note": "POST https://portal.supplier.example/api/orders (JSON over HTTPS)" if http else "PDF by e-mail (the supplier has no portal) – the ERP still keeps the JSON"}
        po["status"] = "sent"
        self.log("ERP → supplier", "POST" if http else "MAIL", "/api/orders (supplier portal)" if http else "e-mail PDF", msg, 202 if http else 0, {"accepted": True, "supplierRef": "SR-" + po["id"][3:]} if http else {"note": "e-mail queued"})
        self.ev("purchasing", f"{po['id']} sent to {po['supplier']} via {sup['channel']}")
        return ok(200, po)

    def goods_receipt(self, b):
        po = self.S["po"].get(b.get("po"))
        if not po:
            return prob(404, "unknown purchase order", str(b.get("po")))
        mat = E.mat_id(b.get("material")) if b.get("material") else None
        ln = next((x for x in po["lines"] if (not mat or x["material"] == mat) and x["qty"] - x["received"] > 1e-9), None)
        if not ln:
            return prob(409, "nothing open", f"{po['id']}: all lines received")
        q = float(b.get("qty") or (ln["qty"] - ln["received"]))
        if q <= 0 or q > (ln["qty"] - ln["received"]) * 1.1 + 1e-9:
            return prob(422, "quantity", f"1 … {ln['qty'] - ln['received']:g} (+10 % tolerance)")
        m = E.MAT[ln["material"]]
        batch = str(b.get("batch") or (("H" if m["type"] == "raw" else "L") + str(8000 + self.S["seq"].get("GR", 0) + 1)))
        gr = {"id": self.nid("GR"), "po": po["id"], "pos": ln["pos"], "material": ln["material"], "qty": q, "batch": batch, "at": fmt(self.now())}
        mv = self.post("GR", ln["material"], q, po["id"], loc="QI-01", batch=batch, status="blocked", price=ln["price"], text="goods receipt " + gr["id"])
        ln["received"] += q
        po["status"] = "received" if all(x["received"] >= x["qty"] - 1e-9 for x in po["lines"]) else "partly received"
        std = float(m["price"])
        ppv = {"gr": gr["id"], "po": po["id"], "material": ln["material"], "qty": q, "price": ln["price"], "std": std, "ppv": r2((ln["price"] - std) * q)}
        self.S["ppv"].append(ppv)
        if m["type"] == "raw":
            plan = {"letter": "–", "n": 1, "ac": 0, "re": 1, "aql": "cert", "text": "check the EN 10204 3.1 certificate (chemistry, heat no.) + 1 hardness / chemistry sample per heat"}
        else:
            plan = E.aql_plan(int(q), "1.0")
            plan["text"] = f"ISO 2859-1 normal, level II, AQL 1.0: lot {q:g} → code {plan['letter']} → sample n = {plan['n']}, accept ≤ {plan['ac']}, reject ≥ {plan['re']} (item 5 sampling)"
        il = {"id": self.nid("IL"), "gr": gr["id"], "po": po["id"], "material": ln["material"], "qty": q, "batch": batch, "plan": plan, "status": "open", "decision": None, "at": fmt(self.now())}
        self.S["insp"][il["id"]] = il
        gr["inspection"], gr["movement"], gr["ppv"] = il["id"], mv["id"], ppv["ppv"]
        self.ev("stores", f"{gr['id']}: {q:g} {ln['material']} batch {batch} → blocked stock QI-01, inspection {il['id']} (n = {plan['n']})")
        return ok(201, gr)

    def decide(self, il, b):
        if il["status"] != "open":
            return prob(409, "wrong state", f"{il['id']} is '{il['status']}'")
        d = str(b.get("decision") or "").lower()
        defects = int(b.get("defects") or 0)
        if d not in ("accept", "reject"):
            d = "accept" if defects <= il["plan"]["ac"] else "reject"
        row = next((s for s in self.S["stock"] if s["mat"] == il["material"] and s["batch"] == il["batch"] and s["status"] == "blocked"), None)
        q = min(il["qty"], row["qty"]) if row else 0.0
        if row:
            row["qty"] -= q
        self.S["stock"] = [s for s in self.S["stock"] if s["qty"] > 1e-9]
        if d == "accept":
            row2 = next((s for s in self.S["stock"] if s["mat"] == il["material"] and s["loc"] == self.default_loc(il["material"]) and s["batch"] == il["batch"] and s["status"] == "free"), None)
            if row2:
                row2["qty"] += q
            else:
                self.S["stock"].append({"mat": il["material"], "loc": self.default_loc(il["material"]), "batch": il["batch"], "qty": q, "status": "free"})
            self.post("TR", il["material"], 0, il["id"], text=f"release {q:g} from QI-01 to {self.default_loc(il['material'])}")
        else:
            self.post("RET", il["material"], q, il["po"], text="returned to the supplier (rejected)")
        il["status"], il["decision"], il["defects"], il["by"] = "done", d, defects, str(b.get("by") or "quality")
        self.ev("quality", f"{il['id']} {il['material']} batch {il['batch']}: {d.upper()} ({defects} defects, Ac {il['plan']['ac']})")
        return ok(200, il)

    def goodsmovement(self, b):
        t = b.get("type")
        mat = E.mat_id(b.get("material"))
        try:
            qty = float(b.get("qty") or 0)
        except (TypeError, ValueError):
            qty = 0
        if t not in ("GI", "GR"):
            return prob(400, "type must be GI (goods issue) or GR (goods receipt)")
        if not mat:
            return prob(404, "unknown material", str(b.get("material")))
        if qty <= 0:
            return prob(422, "quantity must be > 0")
        if t == "GI" and self.free(mat) < qty - 1e-9:
            return prob(409, "not enough stock", f"{mat}: {self.free(mat):g} < {qty:g}")
        order = str(b.get("order") or "")
        mv = self.post(t, mat, qty, order, batch=str(b.get("batch") or (order if t == "GR" else "")), price=E.std_price(mat) if t == "GR" else None, text=str(b.get("text") or ""))
        if t == "GR" and order:
            p = next((x for x in self.S["prod"].values() if x["mesWorkOrder"] == order or x["id"] == order), None)
            if p:
                p["grQty"] += qty
                mv["productionOrder"] = p["id"]
            if order.startswith("WO-"):
                self.log("MES → ERP", "POST", "/api/bsf/erp/goodsmovements", b, 201, {"id": mv["id"], "stock": mv["stock"]})
        return ok(201, mv)

    # ------------------------------------------------------------ production orders ↔ MES
    def _prod_new(self, pid, mat, qty, due_day, source="api"):
        p = {"id": pid, "material": mat, "qty": float(qty), "due": E.iso_day(due_day), "status": "created", "mesWorkOrder": "", "lots": [], "created": fmt(self.now()), "releasedAt": None,
             "source": source, "good": 0.0, "scrap": 0.0, "grQty": 0.0, "ops": [], "issued": {}, "conf": [], "serials": [], "syncedAt": None, "settlement": None, "push": []}
        self.S["prod"][pid] = p
        return p

    def prod_view(self, p):
        c = E.cost_rollup(p["material"])
        return {**p, "materialName": E.MAT.get(p["material"], {}).get("n", ""), "stdCost": r2(c["std"]) if c else None, "stdTotal": r2(c["std"] * p["qty"]) if c else None}

    def release(self, pid, b, phase=None):
        """runs in 3 phases in the server (ERP lock released while the MES works)."""
        p = self.S["prod"].get(pid)
        if not p:
            mat = E.mat_id(b.get("product") or b.get("material"))
            if not mat or E.MAT[mat]["proc"] != "make":
                return prob(400, "unknown product", "product = BS | BN | LG | LB | FABS | FALG or a make material code")
            q = int(float(b.get("qty") or 20))
            if q <= 0:
                return prob(422, "quantity must be > 0")
            p = self._prod_new(pid, mat, q, E.add_wd(self.today(), int(b.get("dueDays") or 5)), "api (item 4 compatible)")
        if p["status"] != "created":
            return prob(409, "wrong state", f"{pid} is '{p['status']}', only 'created' can be released (MES work order {p['mesWorkOrder']})")
        return None

    def release_mes(self, pid):
        """the MES part (no ERP lock needed): look for a work order with erpOrder = pid, else create + release one."""
        p = self.S["prod"][pid]
        st, d = self.mes("GET", "/api/bsf/mes/workorders?size=200")
        if st >= 500 or st == 0:
            return st, d, None
        w = next((x for x in (d.get("items") or []) if x.get("erpOrder") == pid and x.get("status") != "cancelled"), None)
        if w and w["status"] == "created":
            st2, d2 = self.mes("POST", f"/api/bsf/mes/workorders/{w['id']}/release", {"force": True}, {"Idempotency-Key": f"erp-rel-{pid}"})
        elif w:
            st2, d2 = self.mes("GET", f"/api/bsf/mes/workorders/{w['id']}")
        else:
            body = {"product": p["material"], "qty": int(round(p["qty"])), "due": p["due"] + "T14:00:00Z", "erpOrder": pid, "priority": 5, "release": True}
            st2, d2 = self.mes("POST", "/api/bsf/mes/workorders", body, {"Idempotency-Key": f"erp-rel-{pid}"})
        return st2, d2, w

    def release_done(self, pid, st2, d2):
        p = self.S["prod"][pid]
        if st2 >= 500 or st2 == 0:
            self.ev("production", f"{pid}: MES not reachable – order stays 'created' (retry later)")
            return prob(503, "MES not reachable", (d2 or {}).get("detail", "") + " – the production order stays 'created'; retry with the same Idempotency-Key")
        if st2 not in (200, 201):
            return st2, {**(d2 or {}), "productionOrder": pid}, PJ
        p.update({"status": "released", "mesWorkOrder": d2["id"], "lots": d2.get("lots", []), "releasedAt": fmt(self.now())})
        self.ev("production", f"{pid} released → MES work order {d2['id']} ({len(d2.get('lots', []))} lots, status {d2.get('status')})")
        return ok(201, {"productionOrder": pid, "status": d2.get("status"), "mesWorkOrder": d2["id"], "lots": d2.get("lots", []), "order": self.prod_view(p)})

    def sync_mes(self, pid):
        p = self.S["prod"].get(pid)
        st, w = self.mes("GET", f"/api/bsf/mes/workorders/{p['mesWorkOrder']}")
        if st != 200:
            return st, w, None, None
        st2, cf = self.mes("GET", "/api/bsf/mes/confirmations?n=5000")
        confs = [c for c in (cf.get("items") or []) if c.get("wo") == p["mesWorkOrder"]] if st2 == 200 else []
        sers = []
        main = [x for x in w.get("lines", []) if x["route"] == w.get("route")]
        for lid in (main[0]["lots"] if main else [])[:4]:
            s3, sv = self.mes("GET", f"/api/bsf/mes/serials?lot={lid}&n=200")
            if s3 == 200:
                sers += [x.get("sn") for x in sv.get("items", [])]
        return 200, w, confs, sers

    def sync_done(self, pid, w, confs, sers):
        p = self.S["prod"][pid]
        k = E.k_of(p["material"])
        ops = []
        for o in w.get("operations", []):
            act = sum(float(c.get("setupMin") or 0) + float(c.get("runMin") or 0) for c in confs if c.get("op") == o["op"] and str(c.get("lot", "")).split("-")[-2:-1] == [o["route"]])
            ro = next((x for x in E.ops_of(o["route"]) if x["no"] == o["op"]), None)
            t = E.eff_time(ro, k if o["route"] == E.route_of(p["material"]) else 1.0) if ro else 0.0
            stdmin = t * (o["good"] + o["scrap"]) / MP["oee"]
            ops.append({**o, "stdMin": r2(stdmin, 1), "actMin": r2(act if act > 0 else stdmin, 1), "actualFromMes": act > 0})
        p["ops"] = ops
        p["good"] = float(w.get("good", 0))
        p["scrap"] = float(sum(o["scrap"] for o in ops))
        p["conf"] = [{k2: c.get(k2) for k2 in ("id", "lot", "op", "machine", "good", "scrap", "setupMin", "runMin", "at")} for c in confs][-60:]
        p["serials"] = sers[:200]
        p["syncedAt"] = fmt(self.now())
        if w.get("status") == "done":
            p["status"] = "done"
        elif w.get("status") in ("running", "released") and p["status"] == "released":
            p["status"] = "running" if w.get("status") == "running" else "released"
        # backflush: raw = pieces started at the first op × BOM, other bought parts = good × BOM (consumed at assembly)
        posted = []
        rmain = E.route_of(p["material"])
        for m_, q_ in E.explode_buy(p["material"]).items():
            if E.MAT[m_]["type"] == "raw":       # raw = pieces STARTED at the first operation of the route that uses this bar / profile
                r = rmain if rmain not in E.MC.SETS else next((x for x, _k in E.MC.SETS[rmain] if m_ in E.explode_buy(E.REF[x])), rmain)
                per = q_ if r == rmain else E.explode_buy(E.REF[r])[m_]
                first = next((o for o in ops if o["route"] == r), None)
                target = per * ((first["good"] + first["scrap"]) if first else 0)
            else:
                target = q_ * p["good"]
            delta = target - p["issued"].get(m_, 0.0)
            if delta > 1e-9:
                take = min(delta, self.free(m_))
                if take > 1e-9:
                    self.post("GI", m_, take, pid, text="backflush from MES confirmations")
                    p["issued"][m_] = p["issued"].get(m_, 0.0) + take
                    posted.append([m_, r2(take, 3)])
                if take < delta - 1e-9:
                    posted.append([m_, "short " + str(r2(delta - take, 3))])
        self.ev("production", f"{pid} synced from MES {p['mesWorkOrder']}: good {p['good']:g}, scrap {p['scrap']:g}, {len(confs)} confirmations, backflush {len(posted)} lines")
        return ok(200, {**self.prod_view(p), "backflush": posted})

    def confirm_push(self, b):
        pid = b.get("erpOrder") or ""
        p = self.S["prod"].get(pid) or next((x for x in self.S["prod"].values() if x["mesWorkOrder"] and x["mesWorkOrder"] == b.get("mesWorkOrder")), None)
        if not p:
            return prob(404, "unknown production order", str(pid or b.get("mesWorkOrder")))
        try:
            g, s = float(b.get("good") or 0), float(b.get("scrap") or 0)
        except (TypeError, ValueError):
            return prob(400, "good / scrap must be numbers")
        if g < 0 or s < 0:
            return prob(400, "negative quantity")
        c = {"id": self.nid("CO"), "order": p["id"], "op": str(b.get("op") or ""), "good": g, "scrap": s, "setupMin": float(b.get("setupMin") or 0), "runMin": float(b.get("runMin") or 0),
             "serials": list(b.get("serials") or [])[:200], "final": bool(b.get("final")), "at": fmt(self.now())}
        p["push"].append(c)
        self.S["conf"].append(c)
        if c["final"]:
            p["good"] += g
            p["scrap"] += s
            p["serials"] += c["serials"]
        if p["status"] == "released":
            p["status"] = "running"
        self.log("MES → ERP", "POST", "/api/bsf/erp/confirmations", b, 201, {"id": c["id"]})
        self.ev("production", f"confirmation {c['id']} for {p['id']} op {c['op']}: {g:g} good / {s:g} scrap")
        return ok(201, c)

    def settle(self, p, force=False):
        if p["status"] not in ("done",) and not force:
            return prob(409, "wrong state", f"{p['id']} is '{p['status']}' – settle after the MES reports 'done' (or force)")
        c = E.cost_rollup(p["material"])
        good = p["good"]
        std_total = good * c["std"]
        qv = 0.0
        lines = []
        for m_, q_ in E.explode_buy(p["material"]).items():
            stdq = q_ * good
            act = p["issued"].get(m_, 0.0)
            v = (act - stdq) * float(E.MAT[m_]["price"])
            qv += v
            if abs(v) > 0.005:
                lines.append({"material": m_, "stdQty": r2(stdq, 3), "actQty": r2(act, 3), "variance": r2(v)})
        ev_ = 0.0
        sv = 0.0
        for o in p["ops"]:
            R = E.mhr(o["machineType"])
            if not R:
                continue
            ev_ += (o["actMin"] - o["stdMin"]) / 60 * (R["rate"] + R["labourRate"])
            rc = E.cost_rollup(E.REF.get(o["route"])) if E.REF.get(o["route"]) else None
            if rc and o["scrap"]:
                cum = next((x["cumConv"] for x in rc["ops"] if x["no"] == o["op"]), 0.0)
                sv += o["scrap"] * cum
        total = qv + ev_ + sv
        st = {"order": p["id"], "material": p["material"], "good": good, "stdCost": r2(c["std"]), "stdTotal": r2(std_total), "qtyVariance": r2(qv), "efficiencyVariance": r2(ev_),
              "scrapVariance": r2(sv), "totalVariance": r2(total), "actualTotal": r2(std_total + total), "actualPerPc": r2((std_total + total) / good) if good else None, "materialLines": lines,
              "at": fmt(self.now()), "note": "material at standard price (price variance = PPV at goods receipt) · conversion at machine hour rate + labour · scrap at the cumulative std value of the op"}
        p["settlement"], p["status"] = st, "settled"
        self.S["settled"].append(st)
        self.ev("finance", f"{p['id']} settled: std {std_total:.2f} €, variance {total:+.2f} € (qty {qv:+.2f}, efficiency {ev_:+.2f}, scrap {sv:+.2f})")
        return ok(200, st)

    # ------------------------------------------------------------ analysis
    def annual_use(self):
        use = collections.defaultdict(float)
        for code, wk in E.MD["forecast"].items():
            for m_, q_ in E.explode_buy(code).items():
                use[m_] += wk * 50 * q_
        for m_, d in E.MD["mroDay"].items():
            use[m_] += d * MP["days"]
        return use

    def abc(self):
        use = self.annual_use()
        rows = []
        for m_, q in use.items():
            M = E.MAT[m_]
            rows.append({"material": m_, "name": M["n"], "type": M["type"], "annualQty": r2(q, 1), "price": float(M["price"]), "value": r2(q * float(M["price"]))})
        rows.sort(key=lambda r: -r["value"])
        tot = sum(r["value"] for r in rows) or 1
        cum = 0.0
        for r in rows:
            cum += r["value"]
            r["cumPct"] = r2(cum / tot, 4)
            r["abc"] = "A" if cum / tot <= 0.80 + 1e-9 or r is rows[0] else ("B" if cum / tot <= 0.95 + 1e-9 else "C")
            d = r["annualQty"] / MP["days"]
            sg = E.MD["sigmaDay"].get(r["material"])
            cv = (sg / d) if sg is not None and d > 0 else 0.15
            r["cv"] = r2(cv, 3)
            r["xyz"] = "X" if cv < 0.25 else ("Y" if cv < 0.5 else "Z")
            lt = E.MAT[r["material"]]["lt"]
            if sg is not None:
                ss = E.safety_stock(1.65, sg, lt)
                r.update({"dDay": r2(d, 2), "sigmaDay": sg, "LT": lt, "SS": r2(ss, 1), "ROP": r2(E.rop(d, lt, ss), 1)})
        return {"items": rows, "total": r2(tot), "rule": "A = first 80 % of the value, B = next 15 %, C = last 5 % · X: CV < 0.25, Y: < 0.5, Z: ≥ 0.5 · SS = z·σ·√LT (z 1.65 = 95 %), ROP = d·LT + SS"}

    def valuation(self):
        per = collections.OrderedDict()
        for s in self.S["stock"]:
            per.setdefault(s["mat"], 0.0)
            per[s["mat"]] += s["qty"]
        rows, tot_m, tot_s = [], 0.0, 0.0
        bytype = collections.defaultdict(float)
        for m_, q in per.items():
            mav_ = self.S["mav"].get(m_, 0.0)
            std = E.std_price(m_)
            rows.append({"material": m_, "type": E.MAT[m_]["type"], "qty": r2(q, 3), "mav": r2(mav_, 4), "std": r2(std, 4), "valueMav": r2(q * mav_), "valueStd": r2(q * std)})
            tot_m += q * mav_
            tot_s += q * std
            bytype[E.MAT[m_]["type"]] += q * mav_
        cogs = self.plan_cogs()
        return {"items": rows, "totalMav": r2(tot_m), "totalStd": r2(tot_s), "byType": {k: r2(v) for k, v in bytype.items()}, "cogsYear": r2(cogs), "turns": r2(cogs / tot_m, 2) if tot_m else None,
                "daysOfSupply": r2(tot_m / (cogs / MP["days"]), 1) if cogs else None}

    def plan_cogs(self):
        return sum(wk * 50 * E.cost_rollup(c)["std"] for c, wk in E.MD["forecast"].items())

    def kpi(self):
        S = self.S
        t = self.now()
        real = [so for so in S["so"].values() if so["customer"] != "C-1000"]
        intake30 = sum(so["value"] for so in real if t - _ts(so["created"]) <= 30 * 86400)
        backlog = sum(so["value"] for so in S["so"].values() if so["status"] in ("open", "confirmed", "in production", "ready"))
        dns = list(S["dn"].values())
        tw = [so for so in S["so"].values() if so["customer"] == "C-1000" and so.get("onTime") is not None]
        n_ot = sum(1 for d in dns if d["onTime"]) + sum(1 for so in tw if so["onTime"])
        n_all = len(dns) + len(tw)
        val = self.valuation()
        rev = sum(wk * 50 * E.list_price(c) for c, wk in E.MD["forecast"].items())
        full = sum(wk * 50 * E.cost_rollup(c)["full"] for c, wk in E.MD["forecast"].items())
        load = {}
        for r in ("FABS", "BN", "LG", "FALG"):
            b = E.bottleneck(E.REF[r])
            if b["type"] in load:
                continue
            bk = S["ctp"].get(b["type"], {})
            nxt = sum(bk.get(str(E.add_wd(self.today(), d)), 0.0) for d in range(10)) / 10
            load[b["type"]] = r2((E.mps_load(b["type"]) + nxt) / b["cap"], 4)
        U = E.rng(17)
        week_rev = rev / 50
        trend = []
        for i in range(12):
            u1, u2, u3 = U(), U(), U()
            trend.append({"week": i - 11, "intake": r2(week_rev * (0.88 + 0.24 * u1)), "delivered": r2(week_rev * (0.9 + 0.18 * u2)), "otd": r2(0.86 + 0.12 * u3, 3),
                          "inventory": r2(val["totalMav"] * (0.92 + 0.16 * U())), "loadTGR": r2(min(1.05, load.get("BS-TGR", 0.95) * (0.93 + 0.1 * U())), 3)})
        trend[-1].update({"intake": r2(max(trend[-1]["intake"], intake30 / 4.3)), "inventory": val["totalMav"]})
        return {"intake30": r2(intake30), "backlog": r2(backlog), "otd": r2(n_ot / n_all, 4) if n_all else None, "otdCount": [n_ot, n_all], "inventory": val["totalMav"], "turns": val["turns"],
                "marginPlan": r2((rev - full) / rev, 4) if rev else None, "revenuePlan": r2(rev), "load": load, "trend": trend, "openSO": sum(1 for so in real if so["status"] in ("open", "confirmed")),
                "openPO": sum(1 for p in S["po"].values() if p["status"] in ("created", "sent", "partly received")), "prodOpen": sum(1 for p in S["prod"].values() if p["status"] in ("created", "released", "running"))}

    def twin_feed(self, b):
        n = 0
        price = {"FABS": E.list_price("FABS-3210-1000-C5"), "FALG": E.list_price("FALG-25-1000")}
        for o in (b.get("orders") or [])[-80:]:
            sid = "SO-T" + "".join(ch for ch in str(o.get("id")) if ch.isdigit()).zfill(4)
            code = E.mat_id(o.get("product")) or E.mat_id(o.get("code"))
            if not code:
                continue
            st = {"open": "in production", "complete": "ready", "shipped": "delivered"}.get(o.get("state"), "in production")
            so = self.S["so"].get(sid)
            if not so:
                p = price.get(o.get("product"), E.list_price(code))
                so = {"id": sid, "customer": "C-1000", "customerName": E.CUST["C-1000"]["n"], "lines": [{"pos": 10, "code": code, "qty": float(o.get("qty") or 0), "price": r2(p), "value": r2(p * float(o.get("qty") or 0)),
                      "confirmed": None, "method": "twin", "delivered": 0.0}], "product": code, "qty": float(o.get("qty") or 0), "due": str(b.get("clockOf", {}).get(str(o.get("id")), "")) or "twin",
                      "status": st, "created": fmt(self.now()), "createdDay": self.today(), "value": r2(p * float(o.get("qty") or 0)), "confirmed": None, "source": "twin", "deliveries": [], "invoices": [], "twinId": o.get("id")}
                self.S["so"][sid] = so
                n += 1
            so["status"] = st
            so["done"] = o.get("done")
            if o.get("tShip") is not None or o.get("tDone") is not None:
                tdone = o.get("tDone") if o.get("tDone") is not None else o.get("tShip")
                so["onTime"] = bool(o.get("due") is None or tdone <= o.get("due"))
        twin_so = [k for k in self.S["so"] if k.startswith("SO-T")]
        for k in twin_so[:-120]:
            del self.S["so"][k]
        self.S["twin"] = {"orders": len([k for k in self.S["so"] if k.startswith("SO-T")]), "stores": b.get("stores"), "clock": b.get("clock", "")}
        return {"new": n, "twinOrders": self.S["twin"]["orders"]}

    # ------------------------------------------------------------ router
    def route(self, method, path, query=None, body=None, headers=None):
        """→ (status, data, content type). Same paths as web/bsferp_core.js. MES calls are made inline (browser) - the server splits them (see handle())."""
        body = body or {}
        query = query or {}
        key = ""
        if method == "POST":
            try:
                key = (headers.get("Idempotency-Key") if headers is not None else "") or ""
            except AttributeError:
                key = ""
            key = key or str(body.get("msgId") or "")
            if key and key in self.idem:
                st, b = self.idem[key]
                return ok(200, {**b, "replay": True})
        r = self._route(method, path, query, body, headers)
        if method == "POST" and key and r[0] in (200, 201):
            self.idem[key] = (r[0], r[1])
            while len(self.idem) > 3000:
                self.idem.popitem(last=False)
        return r

    def _route(self, method, path, query, body, headers):
        if path.startswith("/api/bsf/v1/"):
            path = "/api/bsf/" + path[len("/api/bsf/v1/"):]
        P = [x for x in path[len("/api/bsf/erp"):].split("/") if x]
        res = P[0] if P else ""
        rid = P[1] if len(P) > 1 else ""
        act = P[2] if len(P) > 2 else ""
        G, PO = method == "GET", method == "POST"
        S = self.S
        if G and res in ("", "health"):
            return ok(200, {"ok": True, "version": VERSION, "mode": "server", "materials": len(E.MAT), "salesOrders": len(S["so"]), "purchaseOrders": len(S["po"]), "productionOrders": len(S["prod"]),
                            "movements": len(S["mov"]), "persist": None, "mes": None, "t": fmt(self.now())})
        if G and res == "api":
            from twin.bsf_erp import API
            return ok(200, {"version": VERSION, "routes": API})
        if G and res == "customers":
            return ok(200, {"items": list(E.CUST.values())})
        if G and res == "suppliers":
            return ok(200, {"items": list(E.SUPP.values())})
        if G and res == "materials" and not rid:
            ty = _q(query, "type")
            return ok(200, {"items": [{**m, "stock": self.onhand(m["id"]), "free": self.free(m["id"]), "std": r2(E.std_price(m["id"]), 4)} for m in E.MAT.values() if not ty or m["type"] == ty]})
        if G and res == "materials":
            m = E.MAT.get(E.mat_id(rid) or "")
            if not m:
                return prob(404, "unknown material", rid)
            used = [p for p, kids in E.BOM.items() if any(k[0] == m["id"] for k in kids)]
            return ok(200, {**m, "stock": [s for s in S["stock"] if s["mat"] == m["id"]], "free": self.free(m["id"]), "std": E.std_price(m["id"]), "mav": S["mav"].get(m["id"]), "usedIn": used,
                            "bom": E.BOM.get(m["id"], [])})
        if G and res == "boms":
            m = E.mat_id(rid)
            if not m:
                return prob(404, "unknown material", rid)
            return ok(200, bom_tree(m))
        if G and res == "routings":
            m = E.mat_id(rid)
            r = E.route_of(m) if m else ""
            if not r:
                return prob(404, "no routing", f"{rid} is not a make item")
            k = E.k_of(m)
            return ok(200, {"material": m, "route": r, "k": k, "version": f"R-{r}-01", "ops": [{"no": o["no"], "workCenter": o["m"], "name": E.MC._short(o["name"]), "setup": o["setup"], "cycle": o["cyc"] if o["mod"] == "furnace" else o["cyc"] * k,
                            "batch": o["batch"], "effMin": E.eff_time(o, k), "scrapPct": o["scrap"], "rate": E.mhr(o["m"])["rate"]} for o in E.ops_of(r)], "yield": E.route_yield(r)})
        if G and res == "workcenters":
            return ok(200, {"items": E.workcenters(), "formula": "rate = (depreciation + interest + space + energy + maintenance) / planned hours"})
        if PO and res == "configure":
            return ok(200, E.configure(body))
        # ---------------- sales
        if res == "quotations" and not rid:
            if G:
                return ok(200, {"items": list(S["qt"].values())[::-1]})
            cust = body.get("customer")
            if cust not in E.CUST:
                return prob(400, "unknown customer", str(cust))
            lines = []
            for ln in body.get("lines") or []:
                if ln.get("config"):
                    cf = E.configure(ln["config"])
                    if not cf.get("ok"):
                        return prob(422, "configuration not valid", "; ".join(cf.get("rules", [])))
                    g = E.MD["priceGroups"].get(E.CUST[cust]["group"], 1.0)
                    lines.append({"code": cf["code"], "qty": float(ln.get("qty") or 1), "price": r2(cf["price"] * g), "config": ln["config"], "text": cf["variant"]})
                else:
                    c = E.mat_id(ln.get("code"))
                    if not c or E.MAT[c]["type"] != "fg":
                        return prob(400, "unknown product", str(ln.get("code")))
                    lines.append({"code": c, "qty": float(ln.get("qty") or 1), "price": r2(self.price_of(c, cust))})
            if not lines or any(x["qty"] <= 0 for x in lines):
                return prob(422, "lines with qty > 0 needed")
            q = {"id": self.nid("QT"), "customer": cust, "lines": [{**x, "value": r2(x["qty"] * x["price"])} for x in lines], "value": r2(sum(x["qty"] * x["price"] for x in lines)),
                 "validTo": E.iso_day(self.today() + 30), "status": "open", "created": fmt(self.now()), "dueDays": int(body.get("dueDays") or 15)}
            S["qt"][q["id"]] = q
            self.ev("sales", f"{q['id']} for {cust}: {q['value']:.2f} €")
            return ok(201, q)
        if res == "quotations" and rid:
            q = S["qt"].get(rid)
            if not q:
                return prob(404, "unknown quotation", rid)
            if G:
                return ok(200, q)
            if act == "accept":
                if q["status"] != "open":
                    return prob(409, "wrong state", f"{rid} is '{q['status']}'")
                so = self._so_new(q["customer"], q["lines"], E.add_wd(self.today(), q["dueDays"]), "quotation " + rid)
                q["status"], q["so"] = "accepted", so["id"]
                return ok(201, so)
        if res == "salesorders" and not rid:
            if G:
                items = sorted(S["so"].values(), key=lambda s: s["id"], reverse=True)
                st = _q(query, "status")
                items = [s for s in items if not st or s["status"] == st]
                return ok(200, page(items, query, "/api/bsf/erp/salesorders"))
            cust = body.get("customer") or "C-1001"
            if cust not in E.CUST:
                cust_name = str(cust)
                cust = "C-1001" if not cust_name else next((c for c, v in E.CUST.items() if v["n"] == cust_name), "C-1001")
            lines = body.get("lines") or [{"code": body.get("product"), "qty": body.get("qty")}]
            ls = []
            for ln in lines:
                c = E.mat_id(ln.get("code") or ln.get("product"))
                if not c or E.MAT[c]["type"] != "fg":
                    return prob(400, "unknown product", str(ln.get("code") or ln.get("product")))
                try:
                    q = float(ln.get("qty") or 0)
                except (TypeError, ValueError):
                    q = 0
                if q <= 0:
                    return prob(422, "quantity must be > 0")
                ls.append({"code": c, "qty": q, "price": ln.get("price")})
            due = E.parse_day(body.get("due")) if body.get("due") else None
            due = due or E.add_wd(self.today(), int(body.get("dueDays") or 14))
            so = self._so_new(cust, ls, due, str(body.get("source") or "api"))
            return ok(201, so)
        if res == "salesorders" and rid:
            so = S["so"].get(rid)
            if not so:
                return prob(404, "unknown sales order", rid)
            if G:
                return ok(200, so)
            if act == "confirm":
                return self.confirm_so(so)
            if act == "deliver":
                return self.deliver(so)
            if act == "invoice":
                return self.invoice(so)
            if act == "cancel":
                if so["status"] in ("delivered", "invoiced", "paid"):
                    return prob(409, "wrong state", so["status"])
                so["status"] = "cancelled"
                return ok(200, so)
        if PO and res == "atp":
            c = E.mat_id(body.get("product"))
            if not c or E.MAT[c]["type"] != "fg":
                return prob(400, "unknown product", str(body.get("product")))
            q = float(body.get("qty") or 0)
            if q <= 0:
                return prob(422, "quantity must be > 0")
            return ok(200, self.atp(c, q))
        if G and res == "deliveries":
            return ok(200, {"items": list(S["dn"].values())[::-1]})
        if res == "invoices":
            if G and not rid:
                return ok(200, {"items": list(S["inv"].values())[::-1]})
            inv = S["inv"].get(rid)
            if not inv:
                return prob(404, "unknown invoice", rid)
            if PO and act == "pay":
                if inv["status"] == "paid":
                    return prob(409, "already paid", rid)
                inv["status"], inv["paidAt"] = "paid", fmt(self.now())
                so = S["so"].get(inv["so"])
                if so:
                    so["status"] = "paid"
                self.ev("finance", f"{rid} paid ({inv['gross']:.2f} €)")
                return ok(200, inv)
            return ok(200, inv)
        # ---------------- MRP
        if res == "mrp":
            if PO and rid == "run":
                return ok(200, self.run_mrp(body.get("horizon")))
            if G:
                if not S["mrp"]:
                    return prob(404, "no MRP run yet", "POST /api/bsf/erp/mrp/run first")
                it = _q(query, "item")
                if it:
                    i = E.mat_id(it)
                    if i not in S["mrp"]["items"]:
                        return prob(404, "item not in the MRP", it)
                    return ok(200, {"item": i, "weekStart": S["mrp"]["weekStart"], **S["mrp"]["items"][i]})
                return ok(200, {"at": S["mrp"]["at"], "H": S["mrp"]["H"], "weekStart": S["mrp"]["weekStart"], "items": S["mrp"]["items"], "exceptions": S["mrp"]["exceptions"],
                                "planned": [S["planned"][x] for x in S["mrp"]["planned"] if x in S["planned"]]})
        if res == "plannedorders":
            if G and not rid:
                return ok(200, {"items": list(S["planned"].values())})
            pl = S["planned"].get(rid)
            if not pl:
                return prob(404, "unknown planned order", rid)
            if PO and act == "convert":
                return self.convert(pl)
        if G and res == "purchaserequisitions":
            return ok(200, {"items": list(S["pr"].values())[::-1]})
        if res == "purchaseorders":
            if G and not rid:
                return ok(200, {"items": list(S["po"].values())[::-1]})
            if PO and not rid:
                return self.po_create(body)
            po = S["po"].get(rid)
            if not po:
                return prob(404, "unknown purchase order", rid)
            if G:
                return ok(200, po)
            if act == "send":
                return self.po_send(po)
        if PO and res == "goodsreceipts":
            return self.goods_receipt(body)
        if res == "inspections":
            if G and not rid:
                return ok(200, {"items": list(S["insp"].values())[::-1]})
            il = S["insp"].get(rid)
            if not il:
                return prob(404, "unknown inspection lot", rid)
            if PO and act == "decision":
                return self.decide(il, body)
            return ok(200, il)
        if res == "goodsmovements":
            if PO:
                return self.goodsmovement(body)
            n = int(_q(query, "n", "50") or 50)
            return ok(200, {"items": S["mov"][-n:][::-1]})
        if G and res == "stock":
            m = _q(query, "material")
            if m:
                mm = E.mat_id(m)
                if not mm:
                    return prob(404, "unknown material", m)
                return ok(200, {"material": mm, "qty": self.free(mm), "onHand": self.onhand(mm), "unit": E.MAT[mm]["uom"], "rows": [s for s in S["stock"] if s["mat"] == mm], "t": fmt(self.now())})
            agg = collections.OrderedDict()
            for s in S["stock"]:
                agg[s["mat"]] = agg.get(s["mat"], 0.0) + (s["qty"] if s["status"] == "free" else 0)
            return ok(200, {"items": [{"material": k, "qty": v, "unit": E.MAT[k]["uom"]} for k, v in agg.items()], "rows": S["stock"], "t": fmt(self.now())})
        if G and res == "inventory" and rid == "valuation":
            return ok(200, self.valuation())
        if G and res == "analysis" and rid == "abc":
            return ok(200, self.abc())
        # ---------------- production orders
        if res == "productionorders" and not rid:
            if G:
                return ok(200, {"items": [self.prod_view(p) for p in sorted(S["prod"].values(), key=lambda x: x["id"], reverse=True)]})
            m = E.mat_id(body.get("material") or body.get("product"))
            if not m or E.MAT[m]["proc"] != "make":
                return prob(400, "unknown make material", str(body.get("material")))
            q = float(body.get("qty") or 0)
            if q <= 0:
                return prob(422, "quantity must be > 0")
            due = E.parse_day(body.get("due")) if body.get("due") else E.add_wd(self.today(), int(body.get("dueDays") or 10))
            p = self._prod_new(self.nid("PO", 6), m, q, due)
            self.ev("production", f"{p['id']} created: {q:g} {m}")
            return ok(201, self.prod_view(p))
        if res == "productionorders" and rid:
            if PO and act == "release":
                e = self.release(rid, body)
                if e:
                    return e
                st2, d2, _w = self.release_mes(rid)
                return self.release_done(rid, st2, d2)
            p = S["prod"].get(rid)
            if not p:
                return prob(404, "unknown production order", rid)
            if G:
                return ok(200, self.prod_view(p))
            if act == "sync":
                if not p["mesWorkOrder"]:
                    return prob(409, "not released", f"{rid} has no MES work order yet")
                st, w, confs, sers = self.sync_mes(rid)
                if st != 200:
                    return prob(503 if st >= 500 else st, "MES answer", (w or {}).get("detail", ""))
                return self.sync_done(rid, w, confs, sers)
            if act == "settle":
                return self.settle(p, bool(body.get("force")))
        if PO and res == "confirmations":
            return self.confirm_push(body)
        if G and res == "confirmations":
            return ok(200, {"items": S["conf"][-100:]})
        # ---------------- costing + finance
        if G and res == "costing":
            m = E.mat_id(rid)
            c = E.cost_rollup(m) if m else None
            if not c:
                return prob(404, "not a make item", rid)
            return ok(200, c)
        if G and res == "variances":
            return ok(200, {"settled": S["settled"][::-1], "ppv": S["ppv"][::-1], "ppvTotal": r2(sum(x["ppv"] for x in S["ppv"]))})
        if G and res == "finance":
            if rid == "pnl" or rid == "cash":
                return ok(200, E.finance())
            if rid == "breakeven":
                return ok(200, E.breakeven())
        if G and res == "kpi":
            return ok(200, self.kpi())
        if G and res == "log":
            since = int(_q(query, "since", "0") or 0)
            return ok(200, {"items": [x for x in S["log"] if x["seq"] > since][-200:]})
        if G and res == "events":
            since = int(_q(query, "since", "0") or 0)
            return ok(200, {"items": [x for x in S["events"] if x["seq"] > since][-200:]})
        if PO and res == "twin":
            return ok(200, self.twin_feed(body))
        if PO and res == "eval":
            return evaluate(body)
        return prob(404, "not found", path)


def _ts(s):
    try:
        return float(__import__("calendar").timegm(time.strptime(str(s)[:19], "%Y-%m-%dT%H:%M:%S")))
    except (ValueError, TypeError):
        return 0.0


def page(items, query, base):
    p = max(1, int(_q(query, "page", "1") or 1))
    s = max(1, min(200, int(_q(query, "size", "20") or 20)))
    out = {"items": items[(p - 1) * s:p * s], "page": p, "size": s, "total": len(items)}
    if p * s < len(items):
        out["next"] = f"{base}?page={p + 1}&size={s}"
    return out


def bom_tree(code, qty=1.0, level=0, out=None):
    out = [] if out is None else out
    if level == 0:
        out.append({"level": 0, "material": code, "qty": 1.0, "uom": E.MAT[code]["uom"], "proc": E.MAT[code]["proc"], "type": E.MAT[code]["type"], "name": E.MAT[code]["n"], "pos": ""})
    kids, kk = E._children(code)
    for child, q, pos in kids:
        c = E.MAT.get(child)
        if not c:
            continue
        qq = qty * q * (kk if c["type"] == "raw" else 1.0)
        out.append({"level": level + 1, "material": child, "qty": qq, "uom": c["uom"], "proc": c["proc"], "type": c["type"], "name": c["n"], "pos": pos, "price": float(c["price"]) if c["proc"] == "buy" else None})
        if c["proc"] in ("make", "phantom"):
            bom_tree(child, qq, level + 1, out)
    if level == 0:
        llc = E.low_level_codes([m for m in E.MAT if not E.MAT[m].get("variant")])
        for r in out:
            r["llc"] = llc.get(r["material"], 0)
        return {"material": code, "rows": out, "levels": max(r["level"] for r in out)}
    return out


def evaluate(b):
    k = b.get("kind")
    try:
        if k == "eoq":
            return ok(200, {"Q": E.eoq(float(b["D"]), float(b["S"]), float(b["H"]))})
        if k == "rop":
            ss = E.safety_stock(float(b["z"]), float(b["sigma"]), float(b["LT"]))
            return ok(200, {"SS": ss, "ROP": E.rop(float(b["d"]), float(b["LT"]), ss)})
        if k == "mrp":
            return ok(200, E.mrp_check())
        if k == "mhr":
            return ok(200, E.mhr(str(b.get("type") or "BS-TGR")))
        if k == "stdcost":
            c = E.cost_rollup(E.mat_id(b.get("code")) or "")
            return ok(200, c) if c else prob(404, "not a make item", str(b.get("code")))
        if k == "atp":
            return ok(200, E.ctp_case(b.get("case") or E.MD["check"]["atp"]))
        if k == "lot":
            L = E.MD["lotExample"]
            return ok(200, E.lot_compare(b.get("net") or L["net"], float(b.get("S") or L["S"]), float(b.get("H") or L["Hweek"]), float(b.get("foq") or L["FOQ"])))
        if k == "config":
            return ok(200, E.configure(b.get("config") or {}))
        if k == "mav":
            return ok(200, {"avg": E.mav(float(b["q0"]), float(b["p0"]), float(b["q1"]), float(b["p1"]))})
        if k == "finance":
            return ok(200, {"pnl": E.finance(), "breakeven": E.breakeven()})
        if k == "aql":
            return ok(200, E.aql_plan(int(b.get("lot") or 1000), str(b.get("aql") or "1.0")))
    except (KeyError, TypeError, ValueError) as e:
        return prob(400, "bad input", str(e))
    return prob(400, "unknown kind", "eoq | rop | mrp | mhr | stdcost | atp | lot | config | mav | finance | aql")


# ====================================================================== service: persistence + lock + dispatch
API = [list(x) for x in [
    ["GET", "/api/bsf/erp/health", "service health, counts, persistence file, MES reachable?"], ["GET", "/api/bsf/erp/api", "this route list"],
    ["GET", "/api/bsf/erp/customers", "customers"], ["GET", "/api/bsf/erp/suppliers", "suppliers"], ["GET", "/api/bsf/erp/materials?type=", "material masters"],
    ["GET", "/api/bsf/erp/materials/{id}", "one material with stock, BOM use, std cost"], ["GET", "/api/bsf/erp/boms/{id}", "multi-level BOM (exploded, low-level codes)"],
    ["GET", "/api/bsf/erp/routings/{id}", "routing with work centres + times"], ["GET", "/api/bsf/erp/workcenters", "work centres with machine hour rate build-up"],
    ["POST", "/api/bsf/erp/configure", "product configurator {kind: screw|guide, …} → codes + price + rules"],
    ["GET", "/api/bsf/erp/quotations", "quotations"], ["POST", "/api/bsf/erp/quotations", "create {customer, lines: [{code | config, qty}]} (Idempotency-Key)"],
    ["POST", "/api/bsf/erp/quotations/{id}/accept", "quotation → sales order"], ["GET", "/api/bsf/erp/salesorders?page=&size=&status=", "sales orders (paged)"],
    ["POST", "/api/bsf/erp/salesorders", "create {customer, product | lines, qty, due} (Idempotency-Key)"], ["GET", "/api/bsf/erp/salesorders/{id}", "one sales order"],
    ["POST", "/api/bsf/erp/salesorders/{id}/confirm", "ATP / CTP → confirmed date + order confirmation"], ["POST", "/api/bsf/erp/salesorders/{id}/deliver", "delivery → delivery note (goods issue)"],
    ["POST", "/api/bsf/erp/salesorders/{id}/invoice", "invoice"], ["POST", "/api/bsf/erp/salesorders/{id}/cancel", "cancel"],
    ["POST", "/api/bsf/erp/atp", "available / capable to promise {product, qty}"], ["GET", "/api/bsf/erp/deliveries", "delivery notes"],
    ["GET", "/api/bsf/erp/invoices", "invoices"], ["POST", "/api/bsf/erp/invoices/{id}/pay", "incoming payment"],
    ["POST", "/api/bsf/erp/mrp/run", "MRP run {horizon}"], ["GET", "/api/bsf/erp/mrp?item=", "last MRP result"],
    ["GET", "/api/bsf/erp/plannedorders", "planned orders"], ["POST", "/api/bsf/erp/plannedorders/{id}/convert", "→ purchase requisition / production order"],
    ["GET", "/api/bsf/erp/purchaserequisitions", "purchase requisitions"], ["GET", "/api/bsf/erp/purchaseorders", "purchase orders"],
    ["POST", "/api/bsf/erp/purchaseorders", "create {supplier, lines} | {requisition} (Idempotency-Key)"], ["POST", "/api/bsf/erp/purchaseorders/{id}/send", "send to the supplier portal (HTTP)"],
    ["POST", "/api/bsf/erp/goodsreceipts", "goods receipt {po, material, qty, batch} → blocked stock + inspection lot"],
    ["GET", "/api/bsf/erp/inspections", "inspection lots"], ["POST", "/api/bsf/erp/inspections/{id}/decision", "{decision: accept | reject, defects}"],
    ["POST", "/api/bsf/erp/goodsmovements", "GI / GR {type, material, qty, order} (MES finished goods)"], ["GET", "/api/bsf/erp/goodsmovements?n=", "last movements"],
    ["GET", "/api/bsf/erp/stock?material=", "stock (locations + batches)"], ["GET", "/api/bsf/erp/inventory/valuation", "stock value + turns"],
    ["GET", "/api/bsf/erp/analysis/abc", "ABC / XYZ + reorder points"], ["GET", "/api/bsf/erp/productionorders", "production orders"],
    ["POST", "/api/bsf/erp/productionorders", "create {material, qty, due} (Idempotency-Key)"], ["GET", "/api/bsf/erp/productionorders/{id}", "one production order"],
    ["POST", "/api/bsf/erp/productionorders/{id}/release", "release → MES work order"], ["POST", "/api/bsf/erp/productionorders/{id}/sync", "pull confirmations + serials from the MES"],
    ["POST", "/api/bsf/erp/productionorders/{id}/settle", "settlement → variances"], ["POST", "/api/bsf/erp/confirmations", "MES → ERP confirmation push (Idempotency-Key)"],
    ["GET", "/api/bsf/erp/costing/{id}", "standard cost roll-up"], ["GET", "/api/bsf/erp/variances", "variances + PPV"],
    ["GET", "/api/bsf/erp/finance/pnl", "P&L per month"], ["GET", "/api/bsf/erp/finance/cash", "cash view"], ["GET", "/api/bsf/erp/finance/breakeven", "break-even"],
    ["GET", "/api/bsf/erp/kpi", "dashboard KPIs + trends"], ["GET", "/api/bsf/erp/log?since=", "HTTP message log ERP ↔ MES"], ["GET", "/api/bsf/erp/events?since=", "audit journal"],
    ["POST", "/api/bsf/erp/twin", "twin orders from the page"], ["POST", "/api/bsf/erp/eval", "calculation cross-check"], ["POST", "/api/bsf/erp/control", "{action: reset | persist}"],
]]

M: ERP | None = None


def _db_path():
    if os.environ.get("BSF_ERP_DB"):
        return os.environ["BSF_ERP_DB"]
    a = sys.argv
    for i, x in enumerate(a):
        if x == "--db" and i + 1 < len(a):
            return os.path.join(os.path.dirname(os.path.abspath(a[i + 1])), "bsf_erp.sqlite")
        if x.startswith("--db="):
            return os.path.join(os.path.dirname(os.path.abspath(x[5:])), "bsf_erp.sqlite")
    return os.path.join(E.ROOT, "data", "bsf_erp.sqlite")


def _journal(e):
    db = PERSIST["db"]
    if db is not None and PERSIST["on"]:
        try:
            db.execute("INSERT INTO journal VALUES (?, ?, ?, ?)", (e["seq"], e["t"], e["kind"], e["text"]))
        except sqlite3.Error:
            pass


def _ensure():
    global M
    if M is not None:
        return
    M = ERP(now, _mes_call)
    M.on_event = _journal
    p = PERSIST["path"] = _db_path()
    if PERSIST["on"] and os.path.exists(p):
        try:
            db = sqlite3.connect(p, check_same_thread=False)
            row = db.execute("SELECT v FROM state WHERE k = 'erp'").fetchone()
            if row:
                saved = json.loads(row[0])
                M.S.update({k: v for k, v in saved.items() if k in M.S})
                PERSIST["loaded"] = True
            PERSIST["db"] = db
        except (sqlite3.Error, ValueError) as e:
            PERSIST["error"] = f"load failed: {e}"


def _save():
    if not PERSIST["on"]:
        return
    if PERSIST["db"] is None:
        try:
            p = PERSIST["path"] or _db_path()
            os.makedirs(os.path.dirname(p), exist_ok=True)
            db = sqlite3.connect(p, check_same_thread=False)
            db.execute("CREATE TABLE IF NOT EXISTS state (k TEXT PRIMARY KEY, v TEXT, t REAL)")
            db.execute("CREATE TABLE IF NOT EXISTS journal (seq INTEGER, t REAL, kind TEXT, text TEXT)")
            for e in M.S["events"]:
                db.execute("INSERT INTO journal VALUES (?, ?, ?, ?)", (e["seq"], e["t"], e["kind"], e["text"]))
            db.commit()
            PERSIST["db"], PERSIST["path"] = db, p
        except (sqlite3.Error, OSError) as e:
            PERSIST["error"] = f"open failed: {e}"
            return
    try:
        PERSIST["db"].execute("INSERT OR REPLACE INTO state VALUES ('erp', ?, ?)", (json.dumps(M.S, default=str), now()))
        PERSIST["db"].commit()
        PERSIST["saved"] = now()
    except (sqlite3.Error, TypeError, ValueError) as e:
        PERSIST["error"] = f"save failed: {e}"


def _mes_ok():
    try:
        st, d = _mes_call("GET", "/api/bsf/mes/health")
        return st == 200
    except Exception:  # noqa: BLE001
        return False


def handle(method, path, query=None, body=None, headers=None):
    """-> (status, obj, content type). Never raises. The ERP lock is released while the MES is called (release / sync)."""
    global M
    query = query or {}
    body = body or {}
    if path.startswith("/api/bsf/v1/"):
        path = "/api/bsf/" + path[len("/api/bsf/v1/"):]
    try:
        P = [x for x in path[len("/api/bsf/erp"):].split("/") if x]
        from_mes = headers is None and method == "POST" and P[:1] == ["goodsmovements"]
        got = LOCK.acquire(timeout=1.0 if from_mes else 15.0)
        if not got:
            return prob(503, "ERP busy", "retry in a moment (Retry-After: 2)")
        try:
            _ensure()
            if method == "GET" and P[:1] in ([], ["health"]):
                st, d, ct = M.route(method, path, query, body, headers)
                d["persist"] = {"on": PERSIST["on"], "path": PERSIST["path"], "exists": bool(PERSIST["path"] and os.path.exists(PERSIST["path"])), "loaded": PERSIST["loaded"],
                                "savedAt": fmt(PERSIST["saved"]) if PERSIST["saved"] else None, "error": PERSIST["error"]}
                d["mes"] = _mes_ok()
                return st, d, ct
            if method == "POST" and P[:1] == ["control"]:
                a = body.get("action")
                if a == "reset":
                    M = ERP(now, _mes_call)
                    M.on_event = _journal
                    _save()
                    return ok(200, {"reset": True})
                if a == "persist":
                    PERSIST["on"] = bool(body.get("on", True))
                    return ok(200, {"persist": PERSIST["on"], "path": PERSIST["path"]})
                return prob(400, "unknown action", "reset | persist")
            special = method == "POST" and len(P) == 3 and P[0] == "productionorders" and P[2] in ("release", "sync")
            if not special:
                r = M.route(method, path, query, body, headers)
                if method == "POST" and (r[0] < 400 or r[0] == 422) and P[:1] not in (["eval"], ["configure"], ["atp"]):
                    _save()
                return r
            # ---- release / sync: phase 1 (lock) → MES (no ERP lock) → phase 3 (lock)
            key = ""
            try:
                key = (headers.get("Idempotency-Key") if headers is not None else "") or ""
            except AttributeError:
                key = ""
            key = key or str(body.get("msgId") or "")
            if key and key in M.idem:
                st, b = M.idem[key]
                return ok(200, {**b, "replay": True})
            pid = P[1]
            if P[2] == "release":
                e = M.release(pid, body)
                if e:
                    return e
            else:
                p = M.S["prod"].get(pid)
                if not p:
                    return prob(404, "unknown production order", pid)
                if not p["mesWorkOrder"]:
                    return prob(409, "not released", f"{pid} has no MES work order yet")
        finally:
            LOCK.release()
        # phase 2 - the MES runs without the ERP lock (it may book goods receipts back into the ERP)
        if P[2] == "release":
            st2, d2, _w = M.release_mes(pid)
        else:
            stS, w, confs, sers = M.sync_mes(pid)
        with LOCK:
            if P[2] == "release":
                r = M.release_done(pid, st2, d2)
            else:
                r = M.sync_done(pid, w, confs, sers) if stS == 200 else prob(503 if stS >= 500 else stS, "MES answer", (w or {}).get("detail", ""))
            if key and r[0] in (200, 201):
                M.idem[key] = (r[0], r[1])
            _save()
            return r
    except Exception as e:  # noqa: BLE001 - the ERP must answer, never crash the main server
        import traceback
        return prob(500, "internal error", f"{type(e).__name__}: {e} @ {traceback.format_exc().splitlines()[-3].strip()[:160]}")


__all__ = ["handle", "API", "VERSION", "ERP", "evaluate", "bom_tree"]
