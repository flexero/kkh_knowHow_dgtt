"""
MES - Manufacturing Execution System (ISA-95 level 3).

What it does in this twin:
* Work orders    - production orders (from ERP/MRP or manual), one product model
                   each. The serial-number station only starts a new unit when a
                   RELEASED work order still needs units ("order release"). When
                   several orders wait, the DISPATCHING RULE picks one:
                     FIFO  - oldest work order first
                     EDD   - earliest due date first
                     SPT   - shortest processing time (smallest model) first
                     SETUP - orders due in the same window (window_h, e.g. 8 h)
                             form a batch; inside it the model running now goes
                             first (fewer changeovers)
                   Work-order priority always comes first (1 = most urgent).
* Traceability   - every compressor gets a serial number; the MES records its
                   route (station + time), components and lots (genealogy),
                   test result, and later the customer it was shipped to.
* Quality        - test results (SPC chart, Cpk, first-pass yield), scrap and
                   non-conformance records per station.
* Maintenance    - maintenance work orders: corrective (breakdowns), predictive
                   (rising vibration) and preventive (tool wear); actual MTBF/MTTR.
"""

from __future__ import annotations

import re
from collections import OrderedDict, deque

from . import analytics, comm
from .model import DOWN, MAINTENANCE

OPEN_WO = ("PLANNED", "RELEASED", "IN_PROGRESS", "ON_HOLD")


class MES:
    def __init__(self, factory, config, historian=None):
        self.f = factory
        self.h = historian
        factory.release_gate = self.gate
        factory.variant_need = self.need_for
        factory.wo_due = self.due_of
        # total work content per model (sum of all station times) - for the SPT rule
        self.work_s = {v: sum(m.time_for(v) for m in factory.machines) for v in factory.variants}
        self.default_product = max(factory.variants, key=lambda v: factory.mix[v]) if factory.variants else None
        self.tests_v: dict = {}
        self.wos: list = []
        self._wo_seq = 0
        self.wip_units: dict = {}
        self.done_units = deque(maxlen=300)
        self.unit_cache: OrderedDict = OrderedDict()   # sn -> full record (last 1000)
        self.tests = deque(maxlen=400)
        self.ncr = deque(maxlen=200)
        self._ncr_seq = 0
        self.scrap_by_station: dict = {}
        self.tested = 0
        self.passed = 0
        self.mwos: list = []
        self._mwo_seq = 0
        self.rel = {m.id: {"failures": 0, "repair_s": 0.0, "down_since": None, "prev": m.state}
                    for m in factory.machines}
        self._maint_timer = 0.0

    # ------------------------------------------------------------ helpers
    def _event(self, text, level="info", machine="MES"):
        e = {"t": self.f.sim_time, "machine": machine, "level": level, "text": text}
        self.f.events.append(e)
        self.f.side_events.append(e)

    def wo_by_id(self, wid):
        return next((w for w in self.wos if w["id"] == wid), None)

    # -------------------------------------------------------- work orders
    def sku_of(self, v):
        p = self.f.products.get(v)
        if p:
            return p.get("sku", v)
        return (self.f.config.get("erp") or {}).get("product", {}).get("sku", "PRODUCT")

    def create_wo(self, qty: int, due: float, release: bool = False, source: str = "Manual",
                  so: str | None = None, priority: int = 5, product: str | None = None) -> dict:
        if product is None:
            product = self.default_product
        if self.f.variants and product not in self.f.products:
            raise ValueError(f"unknown product model {product} (use {', '.join(self.f.variants)})")
        self._wo_seq += 1
        w = {"id": f"WO-{self._wo_seq:04d}", "n": self._wo_seq, "item": self.sku_of(product), "product": product,
             "qty": int(qty), "started": 0, "done": 0, "scrap": 0, "status": "PLANNED", "due": float(due),
             "created": self.f.sim_time, "released": None, "completed": None,
             "source": source, "so": so, "priority": int(priority)}
        self.wos.append(w)
        self._event(f"{w['id']} created: {w['qty']} x {w['item']} ({source})")
        from_erp = source != "Manual"
        comm.send(self.f, 5, f"{w['id']}: {w['qty']} x {w['item']} ({source})"
                  + ("" if from_erp else " - entered in the MES by the planner"),
                  {"ProductionSchedule": {"ID": w["id"], "MaterialDefinitionID": w["item"], "Quantity": w["qty"],
                                          "DueIn_h": round((w["due"] - self.f.sim_time) / 3600, 1),
                                          "Priority": w["priority"], "SalesOrder": so}},
                  src=None if from_erp else "L3")
        if release:
            self.wo_action(w["id"], "release")
        return w

    def wo_action(self, wid: str, action: str) -> str:
        w = self.wo_by_id(wid)
        if w is None:
            raise ValueError(f"unknown work order {wid}")
        if action == "release" and w["status"] in ("PLANNED", "ON_HOLD"):
            w["status"] = "IN_PROGRESS" if w["started"] else "RELEASED"
            w["released"] = w["released"] or self.f.sim_time
        elif action == "hold" and w["status"] in ("RELEASED", "IN_PROGRESS"):
            w["status"] = "ON_HOLD"
        elif action == "close" and w["status"] in OPEN_WO:
            w["status"] = "CLOSED"
            w["completed"] = self.f.sim_time
        else:
            raise ValueError(f"cannot {action} {wid} in status {w['status']}")
        self._event(f"{wid}: {action} -> {w['status']}")
        if action in ("release", "hold"):
            st = next((m for m in self.f.machines if m.serial_prefix), None)
            comm.send(self.f, 6, f"{wid} {action} -> {st.name if st else 'serial station'} (rule {self.f.rule})",
                      {"method": "StartOrder" if action == "release" else "HoldOrder",
                       "node": f"ns=2;s={st.id if st else 'LOAD'}.Orders", "order": wid, "material": w["item"],
                       "recipe": f"{w['product']}_v1", "qty": w["qty"] - w["started"] + w["scrap"],
                       "rule": self.f.rule})
        return f"{wid} {w['status']}"

    def _released(self):
        return [w for w in self.wos if w["status"] in ("RELEASED", "IN_PROGRESS")
                and w["started"] - w["scrap"] < w["qty"]]

    def rule_key(self, w):
        """Sort key of a work order under the active dispatching rule (smallest first)."""
        f = self.f
        r = f.rule
        if r == "EDD":
            return (w["priority"], w["due"], w["n"])
        if r == "SPT":
            return (w["priority"], self.work_s.get(w["product"], 0), w["due"], w["n"])
        if r == "SETUP":
            # orders due in the same window (e.g. 8 h) form one batch: the model running now goes first
            return (w["priority"], f.window_of(w["due"]), 0 if w["product"] == f.last_v else 1, w["due"], w["n"])
        return (w["priority"], w["n"])                       # FIFO: first created, first started

    def gate(self, machine, avail=None):
        """Order release: called by the serial-number station before it starts a unit.
        Returns (work order id, model) or a text saying why nothing may start."""
        cands = self._released()
        if not cands:
            return "No released work order"
        ok = [w for w in cands if avail is None or w["product"] in avail]
        if not ok:
            need = sorted({w["product"] or "-" for w in cands})
            return f"Waiting for castings ({', '.join(need)}) - AGV is bringing them"
        w = min(ok, key=self.rule_key)
        w["started"] += 1
        if w["status"] == "RELEASED":
            w["status"] = "IN_PROGRESS"
            self._event(f"{w['id']} started on {machine.name}")
        return (w["id"], w["product"])

    def queue(self) -> list:
        """Released work orders in the order the rule will start them (for the FMS tab)."""
        return sorted(self._released(), key=self.rule_key)

    def need_for(self, buf, v) -> int:
        """Castings of model v the released work orders still need (AGV brings only these)."""
        return sum(w["qty"] - (w["started"] - w["scrap"]) for w in self._released() if w["product"] == v)

    def due_of(self, wid):
        w = self.wo_by_id(wid) if wid else None
        return None if w is None else w["priority"] * 1e9 + w["due"]

    def units_to_start(self, product="*") -> int:
        return sum(max(0, w["qty"] - (w["started"] - w["scrap"])) for w in self.wos
                   if w["status"] in OPEN_WO and (product == "*" or w.get("product") == product))

    # ----------------------------------------------------------- step
    def step(self, dt: float):
        evs = self.f.unit_events
        if evs:
            self.f.unit_events = []
            for ev in evs:
                getattr(self, "_on_" + ev["k"])(ev)
        self._maint_timer -= dt
        if self._maint_timer <= 0:
            self._maint_timer = 10.0
            self._maintenance()

    def _on_start(self, ev):
        it = ev["item"]
        w = self.wo_by_id(it.get("wo"))
        if w and w.get("so"):
            it["so"] = w["so"]          # pegged: this unit is made for that customer order
        self.wip_units[it["sn"]] = {"sn": it["sn"], "wo": it.get("wo"), "product": it.get("v"), "start": ev["t"]}
        comm.send(self.f, 8, f"{it['sn']} started for {it.get('wo') or '-'}",
                  {"node": f"ns=2;s={ev['st']}.UnitStarted", "serial": it["sn"], "order": it.get("wo"),
                   "model": it.get("v"), "casting_lot": it.get("lot")})

    def _on_test(self, ev):
        it = ev["item"]
        self.tested += 1
        self.passed += 1 if ev["ok"] else 0
        spec = ev.get("spec") or 0
        v = it.get("v")
        # several models with different nominal flow: the SPC chart uses % of the nominal flow
        self.tests.append({"t": ev["t"], "sn": it.get("sn") or it["id"], "st": ev["st"], "v": v,
                           "fad": ev["fad"], "spec": spec, "pct": round(ev["fad"] / spec * 100, 2) if spec else None,
                           "ok": ev["ok"]})
        s = self.tests_v.setdefault(v, {"tested": 0, "passed": 0, "sum": 0.0})
        s["tested"] += 1
        s["passed"] += 1 if ev["ok"] else 0
        s["sum"] += ev["fad"]
        comm.send(self.f, 11, f"{it.get('sn') or it['id']}: {ev['fad']:.2f} m³/h -> {'PASS' if ev['ok'] else 'FAIL'}",
                  {"topic": f"plant/{ev['st']}/test", "serial": it.get("sn"), "model": v,
                   "fad_m3_h": round(ev["fad"], 2), "lsl_m3_h": round(spec * 0.97, 2) if spec else None,
                   "result": "PASS" if ev["ok"] else "FAIL"})

    def _on_scrap(self, ev):
        it = ev["item"]
        self.scrap_by_station[ev["st"]] = self.scrap_by_station.get(ev["st"], 0) + 1
        self._ncr_seq += 1
        self.ncr.append({"id": f"NCR-{self._ncr_seq:05d}", "t": ev["t"], "station": ev["st"],
                         "part": it.get("sn") or it["id"], "lot": it.get("lot"), "reason": ev.get("reason", "")})
        sn = it.get("sn")
        if sn:
            self.wip_units.pop(sn, None)
            w = self.wo_by_id(it.get("wo"))
            if w:
                w["scrap"] += 1
            self._finish_unit(it, "SCRAPPED", ev["t"], ev["st"])

    def _on_fg(self, ev):
        it = ev["item"]
        sn = it.get("sn")
        if not sn:
            return
        self.wip_units.pop(sn, None)
        w = self.wo_by_id(it.get("wo"))
        if w:
            w["done"] += 1
            if w["done"] >= w["qty"] and w["status"] in OPEN_WO:
                w["status"] = "COMPLETED"
                w["completed"] = ev["t"]
                self._event(f"{w['id']} completed: {w['done']} units, {w['scrap']} scrapped")
                comm.send(self.f, 13, f"{w['id']} completed: {w['done']} good, {w['scrap']} scrap",
                          {"ProductionPerformance": {"ID": w["id"], "Status": "COMPLETED", "GoodQty": w["done"],
                                                     "ScrapQty": w["scrap"]}})
        comm.send(self.f, 13, f"{sn} -> finished-goods stock ({it.get('wo') or '-'})",
                  {"ProductionPerformance": {"Order": it.get("wo"), "Serial": sn, "Material": self.sku_of(it.get("v")),
                                             "Qty": 1, "Location": ev.get("st")}})
        self._finish_unit(it, "IN STOCK", ev["t"], None)

    def _finish_unit(self, it, status, t, where):
        rec = {"sn": it["sn"], "wo": it.get("wo"), "product": it.get("v"), "status": status, "start": it.get("start_t"),
               "end": t, "fad": it.get("fad"), "where": where, "so": None, "customer": None}
        self.done_units.append(rec)
        self.unit_cache[it["sn"]] = {"rec": rec, "item": it}
        while len(self.unit_cache) > 1000:
            self.unit_cache.popitem(last=False)
        if self.h:
            self.h.unit_write(rec, it)

    def mark_shipped(self, item, so):
        sn = item.get("sn")
        if not sn:
            return
        c = self.unit_cache.get(sn)
        if c:
            c["rec"].update(status="SHIPPED", so=so["id"], customer=so["customer"], shipped=self.f.sim_time)
        if self.h:
            self.h.unit_ship(sn, so["id"], so["customer"], self.f.sim_time)

    # ---------------------------------------------------- maintenance
    def _new_mwo(self, m, kind, text, status="OPEN"):
        self._mwo_seq += 1
        w = {"id": f"MWO-{self._mwo_seq:04d}", "machine": m.id, "name": m.name, "type": kind,
             "text": text, "status": status, "created": self.f.sim_time, "closed": None, "downtime_min": None}
        self.mwos.append(w)
        comm.send(self.f, 12, f"{w['id']} {kind.lower()}: {m.name} - {text}",
                  {"alarm": {"source": m.id, "severity": 800 if kind == "CORRECTIVE" else 500,
                             "message": text, "condition": m.state}, "maintenance_order": w["id"], "type": kind},
                  src="L1" if kind == "CORRECTIVE" else "L2")
        if kind != "CORRECTIVE":
            self._event(f"{w['id']} {kind.lower()} maintenance for {m.name}: {text}", "warning", m.id)
        return w

    def _open_mwo(self, mid, kind):
        return next((w for w in self.mwos if w["machine"] == mid and w["type"] == kind
                     and w["status"] in ("OPEN", "IN_PROGRESS")), None)

    def _close(self, w, t):
        w["status"] = "DONE"
        w["closed"] = t

    def _maintenance(self):
        t = self.f.sim_time
        for m in self.f.machines:
            r = self.rel[m.id]
            if m.state == DOWN and r["down_since"] is None:
                r["down_since"] = t
                r["failures"] += 1
                self._new_mwo(m, "CORRECTIVE", f"Repair: {m.reason}", "IN_PROGRESS")
            elif m.state != DOWN and r["down_since"] is not None:
                r["repair_s"] += t - r["down_since"]
                w = self._open_mwo(m.id, "CORRECTIVE")
                if w:
                    self._close(w, t)
                    w["downtime_min"] = round((t - r["down_since"]) / 60, 1)
                r["down_since"] = None
                # the repair also fixed what a planned order was waiting for
                for kind in ("PREDICTIVE", "PREVENTIVE"):
                    p = self._open_mwo(m.id, kind)
                    if p and (kind == "PREDICTIVE" and not m.bearing_fault or kind == "PREVENTIVE" and m.tool_wear < 20):
                        self._close(p, t)
                        p["text"] += " - too late: machine broke down first (see corrective order)"
            if r["prev"] == MAINTENANCE and m.state != MAINTENANCE:
                for kind in ("PREDICTIVE", "PREVENTIVE"):
                    w = self._open_mwo(m.id, kind)
                    if w:
                        self._close(w, t)
            r["prev"] = m.state
            if m.state in (DOWN, MAINTENANCE) or m.external:
                continue
            h = analytics.machine_health(m)
            if h["vib_to_alarm_h"] is not None and h["vib_to_alarm_h"] < 6 \
                    and not self._open_mwo(m.id, "PREDICTIVE"):
                self._new_mwo(m, "PREDICTIVE",
                              f"Vibration rising - inspect spindle bearing (alarm in ~{h['vib_to_alarm_h']:.1f} h)")
            if m.wear_per_part > 0 and m.tool_wear >= 85 and not self._open_mwo(m.id, "PREVENTIVE"):
                self._new_mwo(m, "PREVENTIVE", f"Tool change (wear {m.tool_wear:.0f}%)")
            w = self._open_mwo(m.id, "PREVENTIVE")
            if w and m.tool_wear < 20:
                self._close(w, t)

    def mwo_action(self, wid: str, action: str) -> str:
        w = next((x for x in self.mwos if x["id"] == wid), None)
        if w is None:
            raise ValueError(f"unknown maintenance order {wid}")
        m = self.f.by_id[w["machine"]]
        if action == "start" and w["status"] == "OPEN":
            m.command("maintenance")
            w["status"] = "IN_PROGRESS"
        elif action == "close" and w["status"] in ("OPEN", "IN_PROGRESS"):
            self._close(w, self.f.sim_time)
        else:
            raise ValueError(f"cannot {action} {wid} in status {w['status']}")
        self._event(f"{wid}: {action} ({m.name})", machine=m.id)
        return f"{wid} {w['status']}"

    # ------------------------------------------------- order flow / route
    def flow_steps(self) -> list:
        """The main route of a unit (the part that carries the serial number):
        serial station -> ... -> finished-goods store. Parallel machines form one step."""
        if getattr(self, "_flow", None) is not None:
            return self._flow
        f = self.f
        steps, seen = [], set()
        group = [m for m in f.machines if m.serial_prefix]
        while group and len(steps) < 60:
            seen.update(m.id for m in group)
            first = group[0]
            steps.append({"kind": "station", "name": _group_name(group), "machines": [m.id for m in group],
                          "queue": first.inputs[0][0].id if first.serial_prefix is None else None,
                          "feeds": [[b.id, q] for b, q in first.inputs[1:]]})
            b = first.output
            for _ in range(5):                       # AGV transports after this station
                tr = next((t for t in f.handling.transports if t.src is b), None)
                if tr is None:
                    break
                steps.append({"kind": "agv", "name": f"AGV: {tr.name}", "transport": tr.id, "queue": b.id})
                b = tr.dst
            if b.finished:
                steps.append({"kind": "fg", "name": b.name, "buffer": b.id, "asrs": b.asrs_id})
                break
            nxt = [m for m in f.machines if m.inputs and m.inputs[0][0] is b and m.id not in seen]
            if not nxt:
                break
            group = nxt
        idx = {"m": {}, "b": {}, "t": {}}
        for i, s in enumerate(steps):
            for mid in s.get("machines", []):
                idx["m"][mid] = i
            if s.get("queue"):
                idx["b"][s["queue"]] = i
            if s.get("transport"):
                idx["t"][s["transport"]] = i
            if s["kind"] == "fg":
                idx["b"][s["buffer"]] = i
                idx["fg"] = i
        self._flow, self._flow_idx = steps, idx
        return steps

    def locate_all(self) -> dict:
        """sn -> where the unit is now (machine, queue, AGV, AS/RS entrance, finished-goods store)."""
        self.flow_steps()
        idx = self._flow_idx
        f = self.f
        loc = {}
        for m in f.machines:
            it = m.item
            if it and it.get("sn"):
                loc[it["sn"]] = {"item": it, "kind": "machine", "where": m.name, "machine": m.id,
                                 "step": idx["m"].get(m.id), "progress": round(min(1.0, m.progress), 3),
                                 "state": m.state}
        for b in f.buffers:
            if b.store:
                continue
            for it in b.items:
                if it.get("sn"):
                    kind = ("picking" if it.get("_picking") else "fg") if b.finished else "queue"
                    loc[it["sn"]] = {"item": it, "kind": kind, "step": idx["b"].get(b.id),
                                     "where": ("Finished goods AS/RS" if b.finished else f"Waiting in {b.name}")
                                     + (" - crane is taking it out for shipping" if kind == "picking" else "")}
        for v in f.handling.agvs:
            if v.task and v.task["items"]:
                for it in v.task["items"]:
                    if it.get("sn"):
                        loc[it["sn"]] = {"item": it, "kind": "agv", "where": f"On {v.id}",
                                         "step": idx["t"].get(v.task["tr"].id)}
        for a in f.handling.asrs:
            for j in a.jobs + ([a.cur] if a.cur else []):
                for it in (j.get("items") or []):
                    if it.get("sn"):
                        loc[it["sn"]] = {"item": it, "kind": "io", "step": idx.get("fg"),
                                         "where": f"{a.name} entrance - waiting for the crane"}
        return loc

    # ---------------------------------------------------- traceability
    def _locate(self, sn):
        f = self.f
        for m in f.machines:
            if m.item and m.item.get("sn") == sn:
                return m.item, f"In machine: {m.name}"
        for b in f.buffers:
            for it in b.items:
                if it.get("sn") == sn:
                    return it, ("Finished goods AS/RS" if b.finished else f"Buffer: {b.name}")
        for v in f.handling.agvs:
            if v.task and v.task["items"]:
                for it in v.task["items"]:
                    if it.get("sn") == sn:
                        return it, f"On {v.id}"
        return None, None

    def unit(self, sn: str) -> dict:
        sn = sn.strip().upper()
        item, where = self._locate(sn)
        rec = None
        if item is None and sn in self.unit_cache:
            c = self.unit_cache[sn]
            item, rec = c["item"], c["rec"]
            where = {"SHIPPED": f"Shipped to {rec.get('customer')} ({rec.get('so')})",
                     "SCRAPPED": f"Scrapped at {rec.get('where')}"}.get(rec["status"], "Finished goods AS/RS")
        if item is None and self.h:
            row = self.h.unit_get(sn)
            if row:
                return row
        if item is None:
            raise KeyError(sn)
        if rec is None:
            rec = self.unit_cache.get(sn, {}).get("rec") or {"sn": sn, "wo": item.get("wo"),
                                                            "status": "WIP" if "Finished" not in where else "IN STOCK"}
        return {"sn": sn, "status": rec["status"], "where": where, "wo": item.get("wo"), "product": item.get("v"),
                "sku": self.sku_of(item.get("v")) if item.get("v") else None,
                "so": rec.get("so"), "customer": rec.get("customer"), "fad": item.get("fad"),
                "start": item.get("start_t"), "end": rec.get("end"),
                "route": item.get("route", []), "components": _components(item)}

    # ------------------------------------------------------------ views
    def quality(self) -> dict:
        tb = next((m for m in self.f.machines if m.type == "test"), None)
        # with several models the chart shows FAD in % of the model's nominal flow (100% = spec)
        pct_mode = len(self.f.variants) > 1
        key = "pct" if pct_mode else "fad"
        pts = [x[key] for x in self.tests if x.get(key) is not None]
        out = {"tested": self.tested, "passed": self.passed, "unit": "%" if pct_mode else "m³/h",
               "fpy": self.passed / self.tested if self.tested else None,
               "points": [[x["t"], x[key]] for x in self.tests if x.get(key) is not None][-200:],
               "by_product": [{"product": v, "tested": s["tested"], "passed": s["passed"],
                               "fpy": s["passed"] / s["tested"] if s["tested"] else None,
                               "mean_fad": s["sum"] / s["tested"] if s["tested"] else None,
                               "spec": tb.spec_v.get(v, tb.spec_flow) if tb else None}
                              for v, s in sorted(self.tests_v.items(), key=lambda x: str(x[0]))],
               "scrap_by_station": self.scrap_by_station, "ncr": list(self.ncr)[-30:][::-1]}
        if len(pts) >= 8:
            mean = sum(pts) / len(pts)
            mr = [abs(a - b) for a, b in zip(pts[1:], pts[:-1])]
            sigma = (sum(mr) / len(mr)) / 1.128            # individuals chart (I-MR)
            lsl = None
            if tb:
                lsl = (100.0 if pct_mode else tb.spec_flow) * (1 - tb.flow_tolerance / 100)
            out.update(mean=mean, sigma=sigma, ucl=mean + 3 * sigma, lcl=mean - 3 * sigma, lsl=lsl,
                       cpk=(mean - lsl) / (3 * sigma) if (lsl and sigma > 0) else None,
                       out_of_control=sum(1 for p in pts[-50:] if abs(p - mean) > 3 * sigma))
        return out

    def reliability(self) -> list:
        out = []
        for m in self.f.machines:
            r = self.rel[m.id]
            run_h = m.state_time.get("RUNNING", 0) / 3600
            out.append({"machine": m.id, "name": m.name, "failures": r["failures"],
                        "mtbf_h": run_h / r["failures"] if r["failures"] else None,
                        "mttr_min": r["repair_s"] / 60 / r["failures"] if r["failures"] else None,
                        "plan_mtbf_h": m.mtbf_s / 3600, "plan_mttr_min": m.mttr_s / 60})
        return out

    def summary(self) -> dict:
        open_wos = [w for w in self.wos if w["status"] in OPEN_WO]
        return {"open_wos": len(open_wos), "wip_units": len(self.wip_units),
                "to_start": self.units_to_start(),
                "open_mwos": sum(1 for w in self.mwos if w["status"] in ("OPEN", "IN_PROGRESS")),
                "fpy": self.passed / self.tested if self.tested else None}

    def full(self) -> dict:
        wos = sorted(self.wos, key=lambda w: (w["status"] not in OPEN_WO, -w["n"]))[:40]
        return {"work_orders": wos, "summary": self.summary(),
                "units": list(self.done_units)[-25:][::-1],
                "wip": sorted(self.wip_units.values(), key=lambda u: u["start"])[-25:],
                "quality": self.quality(),
                "maintenance": sorted(self.mwos, key=lambda w: (w["status"] == "DONE", -w["created"]))[:40],
                "reliability": self.reliability()}


def _group_name(group) -> str:
    if len(group) == 1:
        return group[0].name
    base = re.sub(r"\s*\d+$", "", group[0].name)
    return f"{base} (x{len(group)})"


def _components(item) -> list:
    # the serial number is marked on the crankcase, so the unit record itself is the crankcase
    out = [{"id": item["id"], "part": item["part"], "lot": item.get("lot"), "route": []}]
    for c in item.get("comps", []):
        out.append({"id": c["id"], "part": c["part"], "lot": c.get("lot"), "route": c.get("route", [])})
        for cc in c.get("comps", []):
            out.append({"id": cc["id"], "part": cc["part"], "lot": cc.get("lot"), "route": cc.get("route", [])})
    return out
