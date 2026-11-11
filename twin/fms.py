"""
FMS view - everything about the flexible manufacturing part of the twin in one place:

* product family     - the models (VC10 / VC20 / VC30), mix, orders, WIP, output
* dispatching rule   - which work order / pallet goes first (FIFO, EDD, SPT, SETUP)
* FMS cell           - machining centers with tool magazines, pallet pool, castings per model
* kanban             - cylinder and crankshaft supermarkets per model
* changeovers        - setups per station: how often, how long, share of time
"""

from __future__ import annotations

from .analytics import machine_oee
from .mes import OPEN_WO
from .model import RULES

RULE_TEXT = {
    "FIFO": "First in, first out: the oldest work order / pallet first. Simple and fair, but the "
            "models alternate, so machines change over often.",
    "EDD": "Earliest due date first: the most urgent customer date first. Good for on-time delivery, "
           "but also more changeovers when urgent orders of different models mix.",
    "SPT": "Shortest processing time first: small models (VC10) first. Many units finish quickly and "
           "the WIP is low, but big models (VC30) can wait long.",
    "SETUP": "Least changeover (batching): orders due in the same time window (e.g. 8 h) form one batch, "
             "and inside the window the model that is running now goes first. The machining centers prefer "
             "pallets whose tools are already in the magazine. A window that is too big makes long batches: "
             "they empty the kanban supermarkets and the assembly cell must change over anyway.",
}


def view(f, mes, erp) -> dict:
    t = max(f.sim_time, 1.0)
    fg = f.sinks[0]
    open_so = [s for s in erp.sos if s["status"] in ("OPEN", "PARTIAL")] if erp.enabled else []
    products = []
    for v, p in f.products.items():
        products.append({
            "id": v, "sku": p.get("sku", v), "name": p.get("name", v), "color": p.get("color"),
            "mix": f.mix[v], "spec_flow_m3_h": p.get("spec_flow_m3_h"), "price": p.get("price"),
            "work_min": round(mes.work_s.get(v, 0) / 60, 1),
            "backlog": sum(s["qty"] - s["shipped"] for s in open_so if s.get("product") == v),
            "open_orders": sum(1 for s in open_so if s.get("product") == v),
            "to_start": mes.units_to_start(v),
            "wip": sum(1 for u in mes.wip_units.values() if u.get("product") == v),
            "in_stock": sum(1 for it in fg.items if it.get("v") == v),
            "started": f.started_v.get(v, 0), "finished": f.finished_v.get(v, 0),
        })

    def mrow(m):
        return {"id": m.id, "name": m.name, "state": m.state, "reason": m.reason,
                "model": m.cur_v if m.has_part else None, "set_up_for": m.setup_v,
                "sn": m.item.get("sn") if m.item else None,
                "progress": round(min(1.0, m.progress), 3) if m.has_part else 0,
                "setup_left_s": round(max(0.0, m.setup_left)) if m.state == "SETUP" else 0,
                "tools": list(m.tools) if m.mag_sets else None, "mag_sets": m.mag_sets or None,
                "tool_load_s": m.mag_load_s if m.mag_sets else None,
                "setup_s": m.setup_s, "setups": m.setups, "setup_h": round(m.setup_time / 3600, 2),
                "setup_share": m.setup_time / t, "busy": m.active_recent,
                "oee": machine_oee(m)["oee"], "parts_v": m.parts_v,
                "cycle_v": {k: round(x) for k, x in m.cycle_v.items()}}

    cell = [mrow(m) for m in f.machines if m.mag_sets or m.pick == "rule"]
    load = next((m for m in f.machines if m.serial_prefix), None)
    pallets = None
    if load is not None:
        b0 = load.inputs[0][0]
        pool = load.seize_pool
        pal_buf = load.output
        pallets = {
            "load_station": mrow(load),
            "castings": [{"v": v, "count": b0.count_v(v), "incoming": b0.incoming_v.get(v, 0),
                          "places": b0.per_variant or None, "need": f.variant_need(b0, v)} for v in f.variants],
            "pool": None if pool is None else {"count": pool.count, "free": pool.free, "in_use": pool.count - pool.free},
            "loaded": [{"v": v, "count": pal_buf.count_v(v)} for v in f.variants],
            "loaded_total": pal_buf.count, "queue_cap": pal_buf.capacity,
        }
    kanbans = []
    for m in f.machines:
        if not (m.kanban and m.kanban_chain):
            continue
        sm = m.kanban_chain[0][-1]
        tgt = int(m.kanban.get("target", 10))
        kanbans.append({
            "machine": mrow(m), "buffer": sm.id, "name": sm.name, "part": sm.part,
            "target": tgt, "trigger": int(m.kanban.get("trigger", tgt // 2)),
            "levels": [{"v": v, "level": m._kanban_level(v), "stock": sm.count_v(v)} for v in f.variants],
            "line": [x.id for x in m.kanban_chain[1]],
        })
    changeovers = [mrow(m) for m in f.machines if m.setup_s or m.mag_sets]
    queue = [{"id": w["id"], "product": w.get("product"), "sku": w.get("item"), "left": w["qty"] - (w["started"] - w["scrap"]),
              "qty": w["qty"], "due": w["due"], "priority": w["priority"], "so": w.get("so"), "status": w["status"]}
             for w in mes.queue()[:14]]
    planned = [{"id": w["id"], "product": w.get("product"), "qty": w["qty"], "due": w["due"]}
               for w in mes.wos if w["status"] in ("PLANNED", "ON_HOLD")][:10]
    return {
        "sim_time": f.sim_time, "rule": f.rule, "rules": list(RULES), "rule_text": RULE_TEXT,
        "window_h": f.window_h, "last_v": f.last_v, "run_len": f.run_len,
        "products": products, "cell": cell, "pallets": pallets, "kanbans": kanbans,
        "changeovers": changeovers, "queue": queue, "planned": planned,
        "open_wos": sum(1 for w in mes.wos if w["status"] in OPEN_WO),
        "setups_total": sum(m.setups for m in f.machines),
        "setup_h_total": round(sum(m.setup_time for m in f.machines) / 3600, 2),
    }
