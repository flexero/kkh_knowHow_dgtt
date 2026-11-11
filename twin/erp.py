"""
ERP - the business side of the factory (ISA-95 level 4), manufacturing part only.

* Item master + BOM  - the bill of materials is derived from the factory model
                       (1 crankcase, 2 cylinders, 1 crankshaft, 1 tank, 1 motor).
* Sales orders       - customer orders (manual, or random demand for training).
* MRP                - Material Requirements Planning, every hour:
      FG level:       net = open sales demand + safety stock - FG in stock - open work orders
                      -> new work order for the MES (rounded up to the WO lot size)
      material level: net = requirement + safety stock - on hand - on order, where
                      requirement = max(units in open work orders not yet started,
                                        planned production during the supplier lead time)
                      -> purchase order (rounded up to the purchase lot size)
* Purchasing         - purchase orders arrive after the supplier lead time; the goods
                       receipt puts the material away into the AS/RS (crane jobs).
* Shipping           - complete orders are picked from the finished-goods AS/RS
                       (crane retrievals) and shipped; partial shipment when late.
* Costing / finance  - standard cost per unit, revenue, COGS, inventory value.

Accounting, HR, payroll and similar ERP modules are NOT included: use a real
ERP (e.g. Odoo, ERPNext) for those and connect it through the HTTP API.
"""

from __future__ import annotations

import math
import random
import re
from collections import deque

from . import comm
from .mes import OPEN_WO

OPEN_SO = ("OPEN", "PARTIAL")


def _round_up(x, lot):
    lot = max(1, int(lot))
    return int(math.ceil(x / lot) * lot)


def _uses(m, b) -> bool:
    """Does station m consume parts from buffer b (also model-specific stores)?"""
    return any(ib is b for ib, _ in m.inputs) or any(b in alts.values() for alts in m.alts.values())


class ERP:
    def __init__(self, factory, mes, config, historian=None, manual: bool = False):
        self.f = factory
        self.mes = mes
        e = config.get("erp") or {}
        self.enabled = bool(e)
        self.currency = e.get("currency", "USD")

        def prod(p, v, mix):
            return {"id": v, "sku": p.get("sku", "PRODUCT"), "name": p.get("name", config.get("product", "")),
                    "price": float(p.get("price", 1000)), "other_parts_cost": float(p.get("other_parts_cost", 0)),
                    "wo_lot": int(p.get("wo_lot", 10)), "safety_stock": int(p.get("safety_stock", 0)),
                    "mix": mix, "color": p.get("color")}
        # product models (FMS): from the factory "products"; one product when there are none
        if factory.products:
            self.products = {v: prod(p, v, factory.mix[v]) for v, p in factory.products.items()}
        else:
            self.products = {None: prod(e.get("product", {}), None, 1.0)}
        self.default_product = mes.default_product if mes.default_product in self.products else next(iter(self.products))
        self.product = self.products[self.default_product]
        self.fg = factory.sinks[0]
        bufs = factory.buf_by_id
        self.items = []
        for it in e.get("items", []):
            b = bufs.get(it["buffer"])
            if b is None:
                raise ValueError(f"ERP item {it['sku']}: unknown buffer {it['buffer']}")
            # product = model this item is only used for (None = used by every model)
            self.items.append({**it, "buf": b, "bom_qty": factory.multiplier.get(b.id, 1.0), "product": b.variant})
        self.rates = e.get("rates_per_h", {})
        self.energy_price = float(e.get("energy_price_kwh", 0.1))
        d = e.get("demand", {})
        self.settings = {"auto_demand": bool(d.get("auto", False)),
                         "units_per_day": float(d.get("units_per_day", 200)),
                         "auto_mrp": True, "auto_release": True, "auto_ship": True}
        self.mrp_interval = float(e.get("mrp_interval_h", 1)) * 3600
        self.demand_cfg = d
        self.customers = e.get("customers", ["Customer"])
        self.rng = random.Random(f"{config.get('random_seed', 1)}-erp")
        self.sos: list = []
        self.pos: list = []
        self._so_seq = 0
        self._po_seq = 0
        self.ledger = {"revenue": 0.0, "cogs": 0.0, "purchases": 0.0, "shipped": 0}
        self.mrp_log = deque(maxlen=40)
        self._mrp_timer = 0.0
        self._ship_timer = 0.0
        self._next_demand = self._demand_gap()
        if manual:
            # manual factory: empty order book, nothing happens until the user acts
            self.settings.update(auto_demand=False, auto_mrp=False, auto_release=False, auto_ship=False)
        elif self.enabled:
            for o in e.get("initial_orders", []):
                self.create_so(o["customer"], o["qty"], o["due_h"],
                               product=o.get("product") if o.get("product") in self.products else None)
            self.run_mrp("start")
            self._mrp_timer = self.mrp_interval

    # ------------------------------------------------------------ helpers
    def _event(self, text, level="info"):
        e = {"t": self.f.sim_time, "machine": "ERP", "level": level, "text": text}
        self.f.events.append(e)
        self.f.side_events.append(e)

    def _demand_gap(self):
        d = self.demand_cfg
        mean_qty = (int(d.get("order_min", 5)) + int(d.get("order_max", 30))) / 2
        orders_per_h = max(1e-6, self.settings["units_per_day"] / 24 / mean_qty)
        return self.rng.expovariate(orders_per_h) * 3600

    # -------------------------------------------------------- sales orders
    def prod_of(self, v):
        return self.products.get(v) or self.product

    def create_so(self, customer: str, qty: int, due_h: float, mto: bool = False, auto: bool = False,
                  product: str | None = None) -> dict:
        """mto = make-to-order: the order gets its own work order(s) and its units are
        reserved for it (pegging). MRP leaves it alone. auto = the system does every
        step of this order by itself; otherwise the user clicks each step (Order flow tab).
        product = model (e.g. VC10, VC20, VC30)."""
        if int(qty) <= 0:
            raise ValueError("quantity must be > 0")
        if product in (None, ""):
            product = self.default_product
        if product not in self.products:
            raise ValueError(f"unknown product model {product} (use {', '.join(str(v) for v in self.products)})")
        p = self.products[product]
        self._so_seq += 1
        so = {"id": f"SO-{self._so_seq:04d}", "customer": str(customer)[:60], "qty": int(qty),
              "product": product, "sku": p["sku"],
              "shipped": 0, "picking": 0, "status": "OPEN", "created": self.f.sim_time,
              "due": self.f.sim_time + float(due_h) * 3600, "shipped_t": None, "on_time": None,
              "value": int(qty) * p["price"], "mto": bool(mto), "auto": bool(auto)}
        self.sos.append(so)
        self._event(f"{so['id']} received from {so['customer']}: {so['qty']} x {p['sku']}, due in {float(due_h):.0f} h"
                    + (" (make-to-order, " + ("automatic" if auto else "manual steps") + ")" if mto else ""))
        comm.send(self.f, 1, f"{so['id']} from {so['customer']}: {so['qty']} x {p['sku']}",
                  {"EDI": "ORDERS", "BGM": so["id"], "NAD_BY": so["customer"], "LIN": p["sku"],
                   "QTY": so["qty"], "DTM_due_in_h": round(float(due_h), 1), "PRI_usd": p["price"]})
        if mto and auto:
            self._auto_order(so)
        return so

    def so_by_id(self, so_id):
        so = next((s for s in self.sos if s["id"] == so_id), None)
        if so is None:
            raise ValueError(f"unknown sales order {so_id}")
        return so

    # ------------------------------------------- make-to-order (Order flow)
    def _wos_of(self, so):
        return [w for w in self.mes.wos if w.get("so") == so["id"]]

    def plan_so(self, so_id: str, release: bool = False) -> str:
        """Step 2: create a work order for exactly this customer order."""
        so = self.so_by_id(so_id)
        if so["status"] not in OPEN_SO:
            raise ValueError(f"{so_id} is {so['status'].lower()}")
        planned = sum(w["qty"] for w in self._wos_of(so) if w["status"] != "CLOSED")
        qty = so["qty"] - planned
        if qty <= 0:
            raise ValueError(f"{so_id} is already planned ({planned} units in work orders)")
        so["mto"] = True
        w = self.mes.create_wo(qty, so["due"], release=release, source=so["id"], so=so["id"], priority=3,
                               product=so.get("product"))
        return f"{w['id']} created for {so_id}: {qty} x {w['item']}" + (" and released" if release else "")

    def buy_for_so(self, so_id: str) -> str:
        """Step 3: purchase orders for the material this order is still missing."""
        so = self.so_by_id(so_id)
        made = []
        for m in self._materials(so):
            if m["to_buy"] > 0:
                it = next(i for i in self.items if i["sku"] == m["sku"])
                po = self.create_po(m["sku"], _round_up(m["to_buy"], it.get("lot", 1)), f"for {so_id}")
                made.append(po["id"])
        so["bought"] = True
        return f"purchase orders {', '.join(made)}" if made else "all material is available - nothing to buy"

    def receive_now(self, po_id: str) -> str:
        """Training shortcut: the supplier delivers immediately."""
        po = next((p for p in self.pos if p["id"] == po_id), None)
        if po is None or po["status"] != "OPEN":
            raise ValueError(f"{po_id} is not open")
        po["due"] = self.f.sim_time
        self._event(f"{po_id}: express delivery requested")
        return f"{po_id} arrives now - the crane will store it"

    def set_so_auto(self, so_id: str, auto: bool) -> str:
        so = self.so_by_id(so_id)
        so["auto"] = bool(auto)
        so["mto"] = True
        if so["auto"]:
            self._auto_order(so)
        return f"{so_id}: {'automatic' if so['auto'] else 'manual steps'}"

    def _auto_order(self, so):
        """Do the next step(s) of an automatic make-to-order order."""
        if so["status"] not in OPEN_SO:
            return
        wos = self._wos_of(so)
        planned = sum(w["qty"] for w in wos if w["status"] != "CLOSED")
        if planned < so["qty"]:
            self.plan_so(so["id"], release=True)
            wos = self._wos_of(so)
        for w in wos:
            if w["status"] in ("PLANNED", "ON_HOLD"):
                self.mes.wo_action(w["id"], "release")
        if not so.get("bought"):
            self.buy_for_so(so["id"])

    def _late_use_step(self, b):
        """Parts used by a later station (tank, motor at final assembly): the route step
        where they are consumed; None for parts used when a unit starts."""
        for m in self.f.machines:
            if not m.serial_prefix and _uses(m, b):
                self.mes.flow_steps()
                return self.mes._flow_idx["m"].get(m.id, 10**6)
        return None

    def _line_stock(self, it) -> int:
        """Parts of this item already moved from the store to the line (by AGV)."""
        b = it["buf"]
        n = 0
        for t in self.f.handling.transports:
            if t.src is b:
                n += (t.dst.count_v(b.variant) + t.dst.incoming_v.get(b.variant, 0)) if b.variant \
                    else t.dst.count + t.dst.incoming
        return n

    def bom_of(self, v) -> list:
        """Items used by model v (shared items + the model's own items)."""
        return [it for it in self.items if it["product"] in (None, v)]

    def _materials(self, so, units=None) -> list:
        wos = self._wos_of(so)
        to_start = sum(max(0, w["qty"] - (w["started"] - w["scrap"])) for w in wos if w["status"] in OPEN_WO)
        units = units if units is not None else self._units_of(so, self.mes.locate_all())
        out = []
        for it in self.bom_of(so.get("product")):
            b = it["buf"]
            # stock is shared: units other open work orders (that use this item) still have to start come first
            others = sum(max(0, w["qty"] - (w["started"] - w["scrap"])) for w in self.mes.wos
                         if w["status"] in OPEN_WO and w.get("so") != so["id"]
                         and (it["product"] is None or w.get("product") == it["product"]))
            n = to_start
            step = self._late_use_step(b)
            if step is not None:            # units already running still need this part later
                n += sum(1 for u in units if u["step"] is not None and
                         (u["step"] < step or (u["step"] == step and u["kind"] == "queue")))
            need = int(math.ceil(n * it["bom_qty"]))
            line = self._line_stock(it)
            other = int(math.ceil(others * it["bom_qty"]))
            have = b.count + b.incoming + line - other
            open_pos = [p for p in self.pos if p["sku"] == it["sku"] and p["status"] == "OPEN"]
            on_order = sum(p["qty"] for p in open_pos)
            short = max(0, need - have)
            out.append({"sku": it["sku"], "name": it["name"], "per_unit": it["bom_qty"], "need": need,
                        "store": b.count, "putaway": b.incoming, "line": line, "other": other, "on_order": on_order,
                        "arrives": min((p["due"] for p in open_pos), default=None),
                        "lead_h": it.get("lead_time_h"), "supplier": it.get("supplier", ""),
                        "short": short, "to_buy": max(0, short - on_order),
                        "status": "OK" if short == 0 else ("ON ORDER" if short <= on_order else "SHORT")})
        return out

    def _units_of(self, so, loc) -> list:
        wo_ids = {w["id"] for w in self._wos_of(so)}
        out = []
        for sn, l in loc.items():
            it = l["item"]
            if it.get("so") == so["id"] or it.get("wo") in wo_ids:
                out.append({"sn": sn, "kind": l["kind"], "where": l["where"], "step": l["step"],
                            "progress": l.get("progress"), "machine": l.get("machine"), "fad": it.get("fad"),
                            "start": it.get("start_t"), "wo": it.get("wo")})
        for sn, c in self.mes.unit_cache.items():
            if sn in loc:
                continue
            r = c["rec"]
            if r.get("so") == so["id"] and r["status"] == "SHIPPED":
                out.append({"sn": sn, "kind": "shipped", "where": f"Shipped to {r.get('customer')}", "step": None,
                            "progress": None, "fad": r.get("fad"), "start": r.get("start"), "wo": r.get("wo")})
            elif r.get("wo") in wo_ids and r["status"] == "SCRAPPED":
                out.append({"sn": sn, "kind": "scrapped", "where": f"Scrapped at {self.f.by_id[r['where']].name if r.get('where') in self.f.by_id else r.get('where')}",
                            "step": None, "progress": None, "fad": r.get("fad"), "start": r.get("start"), "wo": r.get("wo")})
        out.sort(key=lambda u: u["sn"])
        return out

    def track(self, so_id: str | None = None) -> dict:
        """Everything about one customer order, from order entry to shipping."""
        mto = [s for s in self.sos if s.get("mto")]
        if not so_id:
            # newest open make-to-order order, else newest make-to-order, else newest open order
            pick = [s for s in mto if s["status"] in OPEN_SO] or mto or [s for s in self.sos if s["status"] in OPEN_SO] or self.sos
            if not pick:
                return {"so": None, "orders": [], "mode": self.mode, "steps": self._steps_view(None, [], self.mes.locate_all())}
            so = pick[-1]
        else:
            so = self.so_by_id(so_id)
        f, mes = self.f, self.mes
        loc = mes.locate_all()
        units = self._units_of(so, loc)
        wos = self._wos_of(so)
        mats = self._materials(so, units)
        kinds = {}
        for u in units:
            kinds[u["kind"]] = kinds.get(u["kind"], 0) + 1
        planned = sum(w["qty"] for w in wos if w["status"] != "CLOSED")
        released = any(w["status"] in ("RELEASED", "IN_PROGRESS", "COMPLETED") for w in wos)
        to_start = sum(max(0, w["qty"] - (w["started"] - w["scrap"])) for w in wos if w["status"] in OPEN_WO)
        in_prod = sum(kinds.get(k, 0) for k in ("machine", "queue", "agv", "io"))
        fg = kinds.get("fg", 0)
        counts = {"qty": so["qty"], "planned": planned, "to_start": to_start, "in_production": in_prod,
                  "in_stock": fg, "picking": so["picking"],
                  "shipped": so["shipped"], "scrapped": sum(w["scrap"] for w in wos)}
        short = [m for m in mats if m["status"] == "SHORT"]
        on_order = [m for m in mats if m["status"] == "ON ORDER"]
        done_units = so["shipped"] + so["picking"] + fg
        stages = [
            ("order", "1. Customer order (ERP)", True, f"{so['qty']} units for {so['customer']}"),
            ("plan", "2. Plan work order (ERP → MES)", planned >= so["qty"],
             ", ".join(f"{w['id']} ({w['qty']})" for w in wos) or "no work order yet"),
            ("material", "3. Check material (ERP)", planned >= so["qty"] and not short and not on_order,
             "all material available" if not short and not on_order else
             (f"{len(short)} item(s) missing" if short else f"waiting for {len(on_order)} delivery(ies)")),
            ("release", "4. Release to shop floor (MES)", released,
             "released" if released else "waiting for release"),
            ("produce", "5. Production (machines)", planned > 0 and to_start == 0 and in_prod == 0 and done_units >= so["qty"],
             f"{in_prod} in production · {to_start} not started"),
            ("stock", "6. Finished goods store (AS/RS)", done_units >= so["qty"],
             f"{done_units} of {so['qty']} finished"),
            ("ship", "7. Ship to customer (ERP)", so["status"] == "SHIPPED",
             f"{so['shipped']} shipped" + (f" · {so['picking']} being picked" if so["picking"] else "")),
        ]
        active = next((k for k, _, d, _ in stages if not d), None)
        pat = re.compile(r"\b(" + "|".join(re.escape(x) for x in [so["id"]] + [w["id"] for w in wos]) + r")\b")
        log = [e for e in f.events if pat.search(e["text"])][-30:][::-1]
        return {"so": so, "mode": self.mode, "product": self.prod_of(so.get("product")),
                "orders": [{"id": s["id"], "customer": s["customer"], "qty": s["qty"], "sku": s.get("sku"),
                            "status": s["status"], "mto": s.get("mto", False)}
                           for s in self.sos[::-1][:60]],
                "wos": wos, "counts": counts, "materials": mats, "units": units,
                "pos": [p for p in self.pos if p["status"] == "OPEN" or p["source"] == f"for {so['id']}"][-15:][::-1],
                "stages": [{"key": k, "label": l, "done": d, "detail": t, "active": k == active} for k, l, d, t in stages],
                "steps": self._steps_view(so, units, loc), "log": log,
                "can_ship": so["status"] in OPEN_SO and fg > 0, "complete_in_stock": fg + so["shipped"] + so["picking"] >= so["qty"]}

    def _steps_view(self, so, units, loc=None) -> list:
        """The route as columns with machines, waiting units and feeding parts."""
        f, mes = self.f, self.mes
        steps = mes.flow_steps()
        mine = {u["sn"] for u in units}
        loc = loc or {}
        out = []
        for i, s in enumerate(steps):
            col = {"i": i, "kind": s["kind"], "name": s["name"], "machines": [], "waiting": [], "others": 0, "feeds": []}
            for sn, l in loc.items():
                if l["step"] == i and l["kind"] in ("queue", "agv", "io", "fg", "picking"):
                    if sn in mine:
                        col["waiting"].append({"sn": sn, "kind": l["kind"]})
                    else:
                        col["others"] += 1
            if s["kind"] == "station":
                for mid in s["machines"]:
                    m = f.by_id[mid]
                    it = m.item if m.item and m.item.get("sn") else None
                    col["machines"].append({"id": m.id, "name": m.name, "state": m.state, "reason": m.reason,
                                            "sn": it["sn"] if it else None, "mine": bool(it and it["sn"] in mine),
                                            "progress": round(min(1.0, m.progress), 3) if m.has_part else 0,
                                            "cycle_s": round(m.total_time)})
                for bid, q in s["feeds"]:
                    b = f.buf_by_id[bid]
                    col["feeds"].append({"name": b.name, "part": b.part, "count": b.count, "per_unit": q})
            elif s["kind"] == "agv":
                tr = next(t for t in f.handling.transports if t.id == s["transport"])
                col["agvs"] = [v.id for v in f.handling.agvs if v.task and v.task["tr"] is tr]
            elif s["kind"] == "fg":
                a = f.handling.asrs_by_id.get(s.get("asrs"))
                col["crane"] = None if a is None else ("busy: " + a.cur["label"] if a.cur else "idle")
            out.append(col)
        return out

    @property
    def mode(self) -> str:
        keys = ("auto_demand", "auto_mrp", "auto_release", "auto_ship")
        on = [self.settings[k] for k in keys]
        return "auto" if all(on) else "manual" if not any(on) else "mixed"

    def set_mode(self, mode: str) -> str:
        if mode not in ("auto", "manual"):
            raise ValueError("mode must be auto or manual")
        v = mode == "auto"
        self.settings.update(auto_demand=v, auto_mrp=v, auto_release=v, auto_ship=v)
        if v:
            self._next_demand = self._demand_gap()
            self._mrp_timer = 0.0
        self._event(f"Factory switched to {'AUTOMATIC' if v else 'MANUAL'} mode")
        return f"{'automatic' if v else 'manual'} mode"

    # ----------------------------------------------------- purchase orders
    def create_po(self, sku: str, qty: int, source: str = "Manual") -> dict:
        it = next((i for i in self.items if i["sku"] == sku), None)
        if it is None:
            raise ValueError(f"unknown item {sku}")
        if int(qty) <= 0:
            raise ValueError("quantity must be > 0")
        self._po_seq += 1
        po = {"id": f"PO-{self._po_seq:04d}", "sku": sku, "name": it["name"], "supplier": it.get("supplier", ""),
              "qty": int(qty), "cost": int(qty) * float(it["cost"]), "status": "OPEN", "source": source,
              "ordered": self.f.sim_time, "due": self.f.sim_time + float(it.get("lead_time_h", 24)) * 3600,
              "received": None, "lot": None}
        self.pos.append(po)
        self._event(f"{po['id']} to {po['supplier']}: {po['qty']} x {it['name']} ({source})")
        comm.send(self.f, 3, f"{po['id']} to {po['supplier']}: {po['qty']} x {sku}",
                  {"EDI": "ORDERS", "BGM": po["id"], "NAD_SU": po["supplier"], "LIN": sku, "QTY": po["qty"],
                   "DTM_delivery_in_h": float(it.get("lead_time_h", 24)), "MOA_usd": round(po["cost"])})
        return po

    def _receive(self, po):
        it = next(i for i in self.items if i["sku"] == po["sku"])
        po["status"] = "RECEIVED"
        po["received"] = self.f.sim_time
        po["lot"] = f"{it['buf'].prefix}-L{int(po['id'][3:]):04d}"
        self.f.handling.receive(it["buf"], po["lot"], po["qty"])
        self.ledger["purchases"] += po["cost"]
        self._event(f"Goods receipt {po['id']}: {po['qty']} x {it['name']}, lot {po['lot']}")
        comm.send(self.f, 4, f"{po['id']} delivered: {po['qty']} x {po['sku']}, lot {po['lot']}",
                  {"EDI": "DESADV", "order": po["id"], "LIN": po["sku"], "QTY": po["qty"], "lot": po["lot"],
                   "scan": "GS1-128 barcode", "putaway": it["buf"].name})

    # ------------------------------------------------------------- MRP
    def run_mrp(self, why: str = "manual") -> dict:
        """MRP, one product model after the other:
           FG level:       net = demand + safety stock - free FG stock - open work orders
           material level: net = requirement + safety stock - on hand - on order"""
        t = self.f.sim_time
        # make-to-order orders have their own work orders and units (Order flow): not netted here
        open_all = [s for s in self.sos if s["status"] in OPEN_SO and not s.get("mto")]
        mto_open = {s["id"] for s in self.sos if s["status"] in OPEN_SO and s.get("mto")}
        fg_rows, new_wos = [], []
        for v, p in self.products.items():
            open_sos = [s for s in open_all if s.get("product") == v]
            demand = sum(s["qty"] - s["shipped"] - s["picking"] for s in open_sos)
            mine = [it for it in self.fg.items if it.get("v") == v]
            pegged = sum(1 for it in mine if it.get("so") in mto_open and not it.get("_picking"))
            picking = sum(1 for it in mine if it.get("_picking"))
            incoming = self._fg_incoming(v)
            fg_free = len(mine) - picking - pegged + incoming
            wo_open = sum(w["qty"] - w["done"] for w in self.mes.wos
                          if w["status"] in OPEN_WO and not w.get("so") and w.get("product") == v)
            net = demand + p["safety_stock"] - fg_free - wo_open
            wo = None
            if net > 0:
                qty = _round_up(net, p["wo_lot"])
                due = min((s["due"] for s in open_sos), default=t + 24 * 3600)
                wo = self.mes.create_wo(qty, due, release=self.settings["auto_release"], source="MRP", product=v)
                new_wos.append(wo)
            fg_rows.append({"product": v, "sku": p["sku"], "demand": demand, "safety": p["safety_stock"],
                            "fg_free": fg_free, "wo_open": wo_open, "net": net,
                            "wo": wo["id"] if wo else None, "wo_qty": wo["qty"] if wo else 0})
        in_wip_v = {}
        for u in self.mes.wip_units.values():
            k = u.get("product")
            in_wip_v[k] = in_wip_v.get(k, 0) + 1
        # planned production rate (forecast): expected demand, but never above capacity
        # (when a backlog is being worked off the factory runs faster than demand)
        recent = len(self.f.finished_times)            # units finished in the last hour

        def plan(v):
            """(units to start, planned units per hour, units in WIP) for model v (None = all models)."""
            if v is None:
                to_start = self.mes.units_to_start()
                share, wip = 1.0, len(self.mes.wip_units)
            else:
                to_start = self.mes.units_to_start(v)
                share, wip = self.products[v]["mix"], in_wip_v.get(v, 0)
            forecast = self.settings["units_per_day"] * share / 24 if self.settings["auto_demand"] else to_start / 24
            return to_start, min(self.f.ideal_rate_h * share, max(forecast, recent * share)), wip
        new_pos = []
        lines = []
        for it in self.items:
            b = it["buf"]
            lead_h = float(it.get("lead_time_h", 24))
            # castings leave the store (by AGV) about when a unit starts; parts used
            # directly by a later station (tank + motor at final assembly) are still
            # needed for the units already in progress
            late_use = any(_uses(m, b) for m in self.f.machines if not m.serial_prefix)
            to_start, rate_h, in_wip = plan(it["product"] if it["product"] in self.products else None)
            # requirement until the next delivery can arrive: the larger of the open
            # work orders and the planned production during the supplier lead time
            units = max(to_start, rate_h * lead_h) + (in_wip if late_use else 0)
            gross = it["bom_qty"] * units
            on_hand = b.count + b.incoming
            on_order = sum(p["qty"] for p in self.pos if p["sku"] == it["sku"] and p["status"] == "OPEN")
            net_i = gross + it.get("safety_stock", 0) - on_hand - on_order
            po = None
            if net_i > 0:
                po = self.create_po(it["sku"], max(_round_up(net_i, it.get("lot", 1)), it.get("lot", 1)), "MRP")
                new_pos.append(po["id"])
            lines.append({"sku": it["sku"], "gross": round(gross), "on_hand": on_hand, "on_order": on_order,
                          "safety": it.get("safety_stock", 0), "net": round(net_i), "po": po["id"] if po else None})
        res = {"t": t, "why": why, "fg": fg_rows,
               "demand": sum(r["demand"] for r in fg_rows), "fg_free": sum(r["fg_free"] for r in fg_rows),
               "wo_open": sum(r["wo_open"] for r in fg_rows), "net_fg": sum(max(0, r["net"]) for r in fg_rows),
               "wo": ", ".join(w["id"] for w in new_wos) or None, "wo_qty": sum(w["qty"] for w in new_wos),
               "pos": new_pos, "lines": lines}
        self.mrp_log.append(res)
        comm.send(self.f, 2, f"MRP ({why}): {len(new_wos)} work order(s), {len(new_pos)} purchase order(s)",
                  {"net_requirements": {r["sku"]: r["net"] for r in fg_rows},
                   "new_work_orders": [w["id"] for w in new_wos], "new_purchase_orders": new_pos})
        return res

    def _fg_incoming(self, v) -> int:
        """Finished units of model v on the way into the FG store (on an AGV or at the crane)."""
        h = self.f.handling
        n = sum(1 for a in h.asrs for j in a.jobs + ([a.cur] if a.cur else [])
                for it in (j.get("items") or []) if it.get("v") == v and it.get("sn"))
        n += sum(1 for x in h.agvs if x.task and x.task["items"] and x.task["tr"].dst is self.fg
                 for it in x.task["items"] if it.get("v") == v)
        return n

    # ------------------------------------------------------------ shipping
    def _fg_for(self, so):
        """Finished units this order may take: its own (pegged) units first, then free stock
        (units not made for another open order)."""
        open_ids = {s["id"] for s in self.sos if s["status"] in OPEN_SO}
        mine, free = [], []
        for it in self.fg.items:
            if it.get("_picking") or it.get("v") != so.get("product"):
                continue                     # another model is no use for this order
            p = it.get("so")
            if p == so["id"]:
                mine.append(it)
            elif not p or p not in open_ids:
                free.append(it)
        return mine, free

    def _ship(self, orders):
        hold_free = set()              # models whose free stock is kept for an older order
        for so in sorted(orders, key=lambda s: (s["due"], s["id"])):
            need = so["qty"] - so["shipped"] - so["picking"]
            if need <= 0:
                continue
            mine, free = self._fg_for(so)
            v = so.get("product")
            pool = mine + ([] if v in hold_free else free)
            if len(pool) < need and self.f.sim_time < so["due"]:
                hold_free.add(v)       # keep this model's free stock for the oldest order: ship complete orders when on time
                continue
            for it in pool[:need]:
                if self.f.handling.ship(self.fg, lambda item, so=so: self._shipped(so, item), it):
                    so["picking"] += 1

    def _shipped(self, so, item):
        so["picking"] -= 1
        so["shipped"] += 1
        self.ledger["shipped"] += 1
        self.ledger["revenue"] += self.prod_of(so.get("product"))["price"]
        self.ledger["cogs"] += self.standard_cost(so.get("product"))["total"]
        self.mes.mark_shipped(item, so)
        if so["shipped"] >= so["qty"]:
            so["status"] = "SHIPPED"
            so["shipped_t"] = self.f.sim_time
            so["on_time"] = so["shipped_t"] <= so["due"]
            self._event(f"{so['id']} shipped to {so['customer']} ({so['qty']} units, "
                        f"{'on time' if so['on_time'] else 'LATE'})", "info" if so["on_time"] else "warning")
            comm.send(self.f, 14, f"{so['id']} shipped to {so['customer']}: {so['qty']} x {so['sku']}, "
                                  f"invoice ${round(so['value']):,} ({'on time' if so['on_time'] else 'LATE'})",
                      {"EDI": ["DESADV", "INVOIC"], "order": so["id"], "customer": so["customer"], "LIN": so["sku"],
                       "QTY": so["qty"], "MOA_usd": so["value"], "on_time": so["on_time"]})
        else:
            so["status"] = "PARTIAL"

    # ---------------------------------------------------------------- step
    def step(self, dt: float):
        if not self.enabled:
            return
        t = self.f.sim_time
        if self.settings["auto_demand"]:
            self._next_demand -= dt
            if self._next_demand <= 0:
                d = self.demand_cfg
                vs = list(self.products)
                self.create_so(self.rng.choice(self.customers),
                               self.rng.randint(int(d.get("order_min", 5)), int(d.get("order_max", 30))),
                               self.rng.uniform(float(d.get("due_h_min", 24)), float(d.get("due_h_max", 72))),
                               product=self.rng.choices(vs, weights=[self.products[v]["mix"] for v in vs])[0])
                self._next_demand = self._demand_gap()
        for po in self.pos:
            if po["status"] == "OPEN" and po["due"] <= t:
                self._receive(po)
        self._ship_timer -= dt
        if self._ship_timer <= 0:
            self._ship_timer = 30.0
            for so in self.sos:                       # automatic make-to-order orders
                if so.get("mto") and so.get("auto") and so["status"] in OPEN_SO:
                    self._auto_order(so)
            orders = [s for s in self.sos if s["status"] in OPEN_SO and
                      (s.get("auto") if s.get("mto") else self.settings["auto_ship"])]
            if orders:
                self._ship(orders)
        if self.settings["auto_mrp"]:
            self._mrp_timer -= dt
            if self._mrp_timer <= 0:
                self._mrp_timer = self.mrp_interval
                self.run_mrp("hourly")

    def set(self, settings: dict) -> str:
        for k, v in settings.items():
            if k not in self.settings:
                raise ValueError(f"unknown setting {k}")
            self.settings[k] = float(v) if k == "units_per_day" else bool(v)
        if "units_per_day" in settings:
            self._next_demand = self._demand_gap()
        return "settings saved"

    def ship_now(self, so_id: str) -> str:
        so = next((s for s in self.sos if s["id"] == so_id), None)
        if so is None or so["status"] not in OPEN_SO:
            raise ValueError(f"order {so_id} is not open")
        need = so["qty"] - so["shipped"] - so["picking"]
        mine, free = self._fg_for(so)
        k = 0
        for it in (mine + free)[:need]:
            if self.f.handling.ship(self.fg, lambda item, so=so: self._shipped(so, item), it):
                so["picking"] += 1
                k += 1
        if k == 0:
            raise ValueError(f"{so_id}: no finished units in stock yet")
        return f"{so_id}: the crane is picking {k} unit(s) from the AS/RS"

    # ----------------------------------------------------------- costing
    def standard_cost(self, v="default") -> dict:
        """Standard cost of one unit of model v: material (BOM) + machine/labour time + energy."""
        if v == "default":
            v = self.default_product
        p = self.prod_of(v)
        mat = [{"sku": it["sku"], "name": it["name"], "qty": it["bom_qty"], "cost": it["cost"],
                "ext": it["bom_qty"] * it["cost"]} for it in self.bom_of(v)]
        material = sum(m["ext"] for m in mat) + p["other_parts_cost"]
        conv = []
        for g in self.f.capacity_groups:
            m = self.f.by_id[g["stations"][0]]
            per_unit_s = (m.time_for(v) + m.handling_s) * self.f.multiplier.get(m.output.id, 1.0)
            rate = float(self.rates.get(m.type, 25))
            conv.append({"station": m.name, "type": m.type, "min_per_unit": round(per_unit_s / 60, 1),
                         "rate_h": rate, "cost": per_unit_s / 3600 * rate})
        conversion = sum(c["cost"] for c in conv)
        kwh = self.f.energy_kwh / self.f.finished_goods if self.f.finished_goods else 10.0
        # energy grows with the machine time of the model
        avg_s = sum(m.total_time for m in self.f.machines) or 1.0
        energy = kwh * self.energy_price * sum(m.time_for(v) + m.handling_s for m in self.f.machines) / avg_s
        total = material + conversion + energy
        return {"product": v, "sku": p["sku"], "name": p["name"],
                "material": material, "conversion": conversion, "energy": energy, "total": total,
                "other_parts": p["other_parts_cost"], "lines": mat, "conv_lines": conv,
                "price": p["price"], "margin_pct": (p["price"] - total) / p["price"]}

    # -------------------------------------------------------------- views
    def inventory(self) -> list:
        out = []
        for it in self.items:
            b = it["buf"]
            on_order = sum(p["qty"] for p in self.pos if p["sku"] == it["sku"] and p["status"] == "OPEN")
            share = self.products[it["product"]]["mix"] if it["product"] in self.products else 1.0
            rate_h = self.f.ideal_rate_h * it["bom_qty"] * share
            out.append({"sku": it["sku"], "name": it["name"], "location": b.asrs_id or "Floor store",
                        "product": it["product"],
                        "on_hand": b.count, "putaway": b.incoming, "on_order": on_order,
                        "safety": it.get("safety_stock", 0), "cost": it["cost"], "value": b.count * it["cost"],
                        "coverage_h": b.count / rate_h if rate_h else None,
                        "lots": [[l, q] for l, q in list(b.lots)[:4]],
                        "status": "SHORT" if b.count == 0 else "LOW" if b.count < it.get("safety_stock", 0) else "OK"})
        for v, p in self.products.items():
            fg_cost = self.standard_cost(v)["total"]
            n = sum(1 for it in self.fg.items if it.get("v") == v)
            out.append({"sku": p["sku"], "name": p["name"], "location": self.fg.asrs_id or "FG store", "product": v,
                        "on_hand": n, "putaway": self._fg_incoming(v), "on_order": None,
                        "safety": p["safety_stock"], "cost": round(fg_cost, 2),
                        "value": n * fg_cost, "coverage_h": None, "lots": [], "status": "OK", "fg": True})
        return out

    def finance(self) -> dict:
        sc = self.standard_cost()
        inv = sum(i["value"] for i in self.inventory())
        wip_val = len(self.mes.wip_units) * sc["material"]
        shipped_sos = [s for s in self.sos if s["status"] == "SHIPPED"]
        on_time = sum(1 for s in shipped_sos if s["on_time"])
        open_sos = [s for s in self.sos if s["status"] in OPEN_SO]
        return {"revenue": self.ledger["revenue"], "cogs": self.ledger["cogs"],
                "gross_profit": self.ledger["revenue"] - self.ledger["cogs"],
                "purchases": self.ledger["purchases"], "shipped_units": self.ledger["shipped"],
                "inventory_value": inv + wip_val, "wip_value": wip_val,
                "otd": on_time / len(shipped_sos) if shipped_sos else None,
                "backlog_units": sum(s["qty"] - s["shipped"] for s in open_sos),
                "late_orders": sum(1 for s in open_sos if s["due"] < self.f.sim_time),
                "open_orders": len(open_sos)}

    def summary(self) -> dict | None:
        if not self.enabled:
            return None
        fin = self.finance()
        return {k: fin[k] for k in ("backlog_units", "late_orders", "open_orders", "otd", "revenue",
                                    "shipped_units")} | {"currency": self.currency}

    def full(self) -> dict:
        sos = sorted(self.sos, key=lambda s: (s["status"] not in OPEN_SO, s["due"] if s["status"] in OPEN_SO else -s["created"]))
        pos = sorted(self.pos, key=lambda p: (p["status"] != "OPEN", -p["ordered"]))
        return {"enabled": self.enabled, "currency": self.currency, "product": self.product,
                "products": list(self.products.values()),
                "settings": self.settings, "mode": self.mode, "customers": self.customers,
                "items": [{k: v for k, v in it.items() if k != "buf"} for it in self.items],
                "sales_orders": sos[:40], "purchase_orders": pos[:40], "inventory": self.inventory(),
                "cost": self.standard_cost(), "costs": [self.standard_cost(v) for v in self.products],
                "finance": self.finance(),
                "mrp": list(self.mrp_log)[-10:][::-1]}
