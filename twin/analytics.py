"""
Analytics layer - turns raw twin data into decisions.

* OEE (Overall Equipment Effectiveness) = Availability x Performance x Quality
* Health index and predictive maintenance (remaining useful life)
* Alarms
* What-if scenarios: run the virtual line faster than real time with changed
  parameters and compare against the current design.
"""

from __future__ import annotations

import copy
import math

from .model import (BLOCKED, DOWN, MAINTENANCE, OFFLINE, RULES, RUNNING, SETUP,
                    STARVED, STOPPED, Factory, Machine)


# ------------------------------------------------------------------ OEE
def machine_oee(m: Machine) -> dict:
    """
    Availability = operating time / planned time      (losses: breakdowns, changeovers)
    Performance  = ideal cycle x count / operating time (losses: waiting, slow speed)
    Quality      = good parts / total parts            (losses: scrap)
    Planned time excludes operator stops and planned maintenance.
    With several product models the ideal time is summed per part (each model has its own cycle).
    """
    st = m.state_time
    planned = sum(st.values()) - st[STOPPED] - st[MAINTENANCE] - st[OFFLINE]
    operating = planned - st[DOWN] - st.get(SETUP, 0.0)
    if planned <= 0 or operating <= 0:
        return {"availability": 0.0, "performance": 0.0, "quality": 0.0, "oee": 0.0}
    a = operating / planned
    ideal = m.ideal_done if m.ideal_done > 0 else m.cycle_time * m.total_count
    p = min(1.0, ideal / operating)
    q = m.good_count / m.total_count if m.total_count else 1.0
    return {"availability": a, "performance": p, "quality": q, "oee": a * p * q}


def state_breakdown(m: Machine) -> dict:
    total = sum(m.state_time.values()) or 1.0
    return {k: v / total for k, v in m.state_time.items()}


def find_bottleneck(f: Factory) -> str:
    """Active-period method: the station that was busy (running or broken)
    the largest share of the RECENT time (about the last hour) limits the
    factory. Using recent time avoids being fooled by the start-up phase."""
    if not f.machines:
        return None
    top = max(m.active_recent for m in f.machines)
    # nearly equally busy (e.g. everything runs flat out while buffers fill up):
    # the one with the lowest design capacity is the real constraint
    cap = {sid: g["products_per_h"] for g in f.capacity_groups for sid in g["stations"]}
    candidates = [m for m in f.machines if m.active_recent >= top - 0.03]
    best = min(candidates, key=lambda m: (cap.get(m.id, 1e9), -m.active_recent)).id
    # material handling can be the constraint too: a crane or the AGV fleet that is
    # (almost) always busy while the busiest machine still has to wait
    h = f.handling
    mh = [(a.id, a.active_recent) for a in h.asrs]
    if h.agvs:
        mh.append(("AGV-FLEET", h.fleet_recent))
    if mh:
        mid, util = max(mh, key=lambda x: x[1])
        if util > 0.88 and util > top + 0.02:
            return mid
    return best


def resource_name(f: Factory, rid: str | None) -> str | None:
    if rid in f.by_id:
        return f.by_id[rid].name
    if rid == "AGV-FLEET":
        return "AGV fleet"
    a = f.handling.asrs_by_id.get(rid)
    return f"{a.name} (crane)" if a else rid


# ------------------------------------------------------- health / RUL
def _slope(points) -> float:
    """Least squares slope (units per second)."""
    n = len(points)
    if n < 6:
        return 0.0
    mx = sum(p[0] for p in points) / n
    my = sum(p[1] for p in points) / n
    sxx = sum((p[0] - mx) ** 2 for p in points)
    if sxx == 0:
        return 0.0
    return sum((p[0] - mx) * (p[1] - my) for p in points) / sxx


def machine_health(m: Machine) -> dict:
    out = {"index": 100.0, "tool_rul_parts": None, "tool_rul_h": None,
           "vib_to_alarm_h": None, "recommendation": "Healthy - no action needed",
           "level": "good"}

    # tool wear -> remaining useful life
    wear_score = 0.0
    if m.wear_per_part > 0:
        per_part = m.wear_per_part * (m.speed_pct / 100.0) ** 1.5
        parts_left = max(0.0, (100.0 - m.tool_wear) / per_part)
        out["tool_rul_parts"] = int(parts_left)
        out["tool_rul_h"] = parts_left * m.total_time / (m.speed_pct / 100.0) / 3600
        # wear below 50% is normal; health falls from 100 to 0 between 50% and 100% wear
        wear_score = max(0.0, (m.tool_wear - 50.0) / 50.0)

    # vibration trend -> time until alarm level
    recent = list(m.vib_trend)[-40:]          # about the last 20 running minutes
    slope = _slope(recent)
    normal = m.base_vib
    vib_score = max(0.0, (m.vib_ewma - normal * 1.3) / (m.vib_alarm - normal * 1.3))
    # only predict when vibration is clearly elevated (normal tool wear also raises it a little)
    if slope > 1e-5 and m.vib_warn * 0.6 < m.vib_ewma < m.vib_alarm:
        out["vib_to_alarm_h"] = (m.vib_alarm - m.vib_ewma) / slope / 3600

    out["index"] = round(100.0 * (1.0 - min(1.0, max(wear_score, vib_score))), 1)

    recs = []
    if m.state == DOWN:
        recs.append(f"Repair needed: {m.reason}")
    if out["tool_rul_h"] is not None and m.tool_wear > 85:
        recs.append(f"Change tool NOW - only ~{out['tool_rul_parts']} parts left, scrap is rising")
    elif out["tool_rul_h"] is not None and m.tool_wear > 65:
        recs.append(f"Plan tool change within {out['tool_rul_h']:.1f} h "
                    f"(~{out['tool_rul_parts']} parts left)")
    if m.vib_ewma >= m.vib_alarm:
        recs.append("Vibration ALARM - stop and inspect spindle bearing")
    elif out["vib_to_alarm_h"] is not None and out["vib_to_alarm_h"] < 4 and m.vib_ewma > m.vib_warn * 0.7:
        recs.append(f"Vibration rising - bearing alarm expected in ~{out['vib_to_alarm_h']:.1f} h. "
                    "Plan maintenance.")
    elif m.vib_ewma >= m.vib_warn:
        recs.append("Vibration above warning level - inspect at next stop")
    if m.temperature > m.temp_limit:
        recs.append("Over temperature - check coolant / reduce speed")
    if recs:
        out["recommendation"] = " | ".join(recs)
    idx = out["index"]
    out["level"] = "good" if idx >= 70 else "warning" if idx >= 40 else "critical"
    if m.state == DOWN:
        out["level"] = "critical"
    return out


# ------------------------------------------------------------- alarms
def active_alarms(f: Factory) -> list:
    alarms = []
    for m in f.machines:
        def add(level, text):
            alarms.append({"machine": m.id, "name": m.name, "level": level, "text": text})
        if m.state == DOWN:
            add("critical", f"Machine down - {m.reason}")
        if m.state == OFFLINE:
            add("warning", "No live data from machine")
        if m.vib_ewma >= m.vib_alarm:
            add("serious", f"Vibration {m.vib_ewma:.1f} mm/s >= alarm {m.vib_alarm}")
        elif m.vib_ewma >= m.vib_warn:
            add("warning", f"Vibration {m.vib_ewma:.1f} mm/s >= warning {m.vib_warn}")
        if m.temperature > m.temp_limit:
            add("serious", f"Temperature {m.temperature:.0f} C > limit {m.temp_limit:.0f}")
        if m.wear_per_part > 0 and m.tool_wear >= 85:
            add("warning", f"Tool wear {m.tool_wear:.0f}%")
    for b in f.buffers:
        if b.store and b.count == 0:
            alarms.append({"machine": b.id, "name": b.name, "level": "serious",
                           "text": "Stock-out - production will stop" + (" (put-away in progress)" if b.incoming else "")})
    for v in f.handling.agvs:
        if v.battery < 10:
            alarms.append({"machine": v.id, "name": v.id, "level": "warning",
                           "text": f"Battery {v.battery:.0f}% - no free charger?"})
    order = {"critical": 0, "serious": 1, "warning": 2}
    alarms.sort(key=lambda a: order[a["level"]])
    return alarms


# --------------------------------------------------------- line KPIs
def line_kpis(f: Factory) -> dict:
    hours = f.sim_time / 3600.0
    good = f.finished_goods
    scrap = sum(m.scrap_count for m in f.machines)
    total_ops = sum(m.total_count for m in f.machines)   # scrap rate per machining/assembly operation
    bottleneck = find_bottleneck(f) if f.sim_time > 0 else None
    ideal = f.ideal_rate_h
    line_oee = min(1.0, good / (ideal * hours)) if hours > 0 and ideal > 0 else 0.0
    return {
        "sim_hours": hours,
        "finished_good": good,
        "scrap": scrap,
        "scrap_rate": scrap / total_ops if total_ops else 0.0,
        "throughput_last_hour": len(f.finished_times),
        "avg_throughput_per_h": good / hours if hours > 0 else 0.0,
        "ideal_throughput_per_h": ideal,
        "line_oee": line_oee,
        "wip": f.wip,
        "bottleneck": bottleneck,
        "bottleneck_name": resource_name(f, bottleneck),
        "power_kw": sum(m.power for m in f.machines),
        "energy_kwh": f.energy_kwh,
        "kwh_per_good_part": f.energy_kwh / good if good else 0.0,
    }


def _spec_now(m: Machine) -> float:
    """Nominal air flow of the unit on the test bench now (each model has its own)."""
    return m.spec_v.get(m.cur_v, m.spec_flow) if m.has_part else m.last_spec


def machine_snapshot(m: Machine) -> dict:
    return {
        "id": m.id, "name": m.name, "type": m.type, "external": m.external, "line": m.line,
        "inputs": [{"buffer": b.id, "qty": q} for b, q in m.inputs],
        "output": m.output.id if m.output else None,
        "state": m.state, "reason": m.reason, "progress": round(m.progress, 3),
        "speed_pct": m.speed_pct, "cycle_time_s": m.cycle_time,
        "handling_s": m.handling_s, "pallet_changer": m.pallet_changer,
        "item": None if not m.item else {"id": m.item.get("sn") or m.item["id"], "wo": m.item.get("wo"),
                                         "v": m.item.get("v")},
        "last_cycle_s": round(m.last_cycle_s, 1),
        # flexible manufacturing: model, changeover, tool magazine, routing
        "fms": {"model": m.cur_v if m.has_part else None, "set_up_for": m.setup_v,
                "cycle_now_s": round(m.cur_time, 1) if m.has_part else None,
                "setup_left_s": round(max(0.0, m.setup_left)) if m.state == SETUP else 0,
                "setup_s": m.setup_s, "setups": m.setups, "setup_h": round(m.setup_time / 3600, 2),
                "tools": list(m.tools) if m.mag_sets else None, "mag_sets": m.mag_sets or None,
                "tool_load_s": m.mag_load_s if m.mag_sets else None,
                "pick": m.pick, "kanban": m.kanban, "cycle_v": m.cycle_v, "parts_v": m.parts_v},
        "sensors": {
            "temperature_c": round(m.temperature, 2),
            "vibration_mm_s": round(m.vibration, 3),
            "vibration_avg_mm_s": round(m.vib_ewma, 3),
            "power_kw": round(m.power, 2),
            "spindle_rpm": round(m.rpm),
            "tool_wear_pct": round(m.tool_wear, 1),
            "flow_m3_h": None if m.flow is None else round(m.flow, 2),
            "pressure_bar": None if m.pressure is None else round(m.pressure, 2),
        },
        "test": None if m.type != "test" else {
            "spec_flow_m3_h": _spec_now(m),
            "min_flow_m3_h": round(_spec_now(m) * (1 - m.flow_tolerance / 100), 2),
            "last_min_m3_h": round(m.last_spec * (1 - m.flow_tolerance / 100), 2),
            "last_flow_m3_h": None if m.last_test_flow is None else round(m.last_test_flow, 2),
        },
        "limits": {"temp_c": m.temp_limit, "vib_warn": m.vib_warn,
                   "vib_alarm": m.vib_alarm},
        "counters": {"total": m.total_count, "good": m.good_count, "scrap": m.scrap_count},
        "oee": machine_oee(m),
        "states": state_breakdown(m),
        "health": machine_health(m),
    }


# ----------------------------------------------------------- what-if
def _run(config: dict, hours: float, seed: int) -> dict:
    f = Factory(config, seed=seed, record_events=False)
    f.handling.auto_ship = True          # finished goods are shipped as soon as they are stored
    steps = int(hours * 3600)
    for _ in range(steps):
        f.step(1.0)
    k = line_kpis(f)
    hs = f.handling.snapshot()
    return {
        "setups": sum(m.setups for m in f.machines),
        "setup_h": sum(m.setup_time for m in f.machines) / 3600,
        "by_model": dict(f.finished_v),
        "agv_util": hs["fleet_util"],
        "asrs_util": {a["id"]: a["util"] for a in hs["asrs"]},
        "good": f.finished_goods,
        "scrap": k["scrap"],
        "throughput_per_h": k["avg_throughput_per_h"],
        "line_oee": k["line_oee"],
        "bottleneck": k["bottleneck"],
        "kwh_per_good_part": k["kwh_per_good_part"],
        "stations": {m.id: {"oee": machine_oee(m)["oee"], **state_breakdown(m)}
                     for m in f.machines},
    }


def apply_changes(config: dict, changes: dict) -> dict:
    """changes = {"stations": {"MILL-01": {"cycle_time_s": 45}}, "buffers": {"B2": {"capacity": 12}},
                  "fms": {"rule": "EDD", "max_batch": 10}, "products": {"VC10": {"mix": 0.5}}}
    A station with {"enabled": 0} is removed (only possible when a parallel twin machine remains)."""
    cfg = copy.deepcopy(config)
    fms = changes.get("fms") or {}
    if fms:
        cfg.setdefault("fms", {})
        if fms.get("rule"):
            if fms["rule"] not in RULES:
                raise ValueError(f"rule must be one of {', '.join(RULES)}")
            cfg["fms"]["rule"] = fms["rule"]
        if fms.get("max_batch") not in (None, ""):
            cfg["fms"]["max_batch"] = max(1, int(fms["max_batch"]))
        if fms.get("window_h") not in (None, ""):
            cfg["fms"]["window_h"] = max(0.5, float(fms["window_h"]))
    for pid, params in (changes.get("products") or {}).items():
        p = next((x for x in cfg.get("products", []) if x["id"] == pid), None)
        if p is None:
            raise ValueError(f"unknown product {pid}")
        if params.get("mix") not in (None, ""):
            p["mix"] = max(0.0, float(params["mix"]))
    if cfg.get("products") and sum(float(p.get("mix", 1)) for p in cfg["products"]) <= 0:
        raise ValueError("product mix: at least one model needs a share above 0")
    for sid, params in (changes.get("stations") or {}).items():
        st = next((s for s in cfg["stations"] if s["id"] == sid), None)
        if st is None:
            raise ValueError(f"unknown station {sid}")
        if params.get("enabled") not in (None, "") and not float(params["enabled"]):
            sig = (st.get("output"), tuple((i["buffer"], i.get("qty", 1)) for i in st.get("inputs", [])))
            twins = [s for s in cfg["stations"] if s is not st and
                     (s.get("output"), tuple((i["buffer"], i.get("qty", 1)) for i in s.get("inputs", []))) == sig]
            if not twins:
                raise ValueError(f"{st.get('name', sid)} cannot be switched off: no other machine does its work")
            cfg["stations"].remove(st)
            continue
        for k, v in params.items():
            if v is None or v == "" or k == "enabled":
                continue
            if k in ("kanban_target", "kanban_trigger"):
                kb = st.get("kanban")
                if kb:
                    kb[k.split("_")[1]] = max(1, int(v))
                    if k == "kanban_target":
                        kb["trigger"] = max(1, kb["target"] // 2)
                        sm = next((b for b in cfg["buffers"] if b["id"] == kb.get("buffer")), None)
                        if sm is not None:     # the supermarket must have room for the new target
                            sm["per_variant"] = kb["target"]
                            sm["capacity"] = kb["target"] * max(1, len(cfg.get("products", [])))
                continue
            if k in ("tool_sets", "tool_load_s"):
                if st.get("tool_magazine"):
                    st["tool_magazine"]["sets" if k == "tool_sets" else "load_s"] = max(1, int(v)) if k == "tool_sets" else float(v)
                continue
            if k == "pallet_changer":
                if float(v) and not st.get("pallet_changer"):
                    st["pallet_changer"] = {"change_s": 15}
                elif not float(v):
                    st.pop("pallet_changer", None)
                    st.setdefault("load_unload_s", 120)
                continue
            st[k] = float(v)
    for bid, params in (changes.get("buffers") or {}).items():
        b = next((x for x in cfg["buffers"] if x["id"] == bid), None)
        if b is None:
            raise ValueError(f"unknown buffer {bid}")
        if params.get("capacity") not in (None, ""):
            b["capacity"] = int(params["capacity"])
    # material handling
    for k, v in (changes.get("agv") or {}).items():
        if k not in ("count", "speed_m_s", "load_s", "unload_s", "battery_h", "charge_h"):
            raise ValueError(f"unknown AGV setting {k}")
        cfg.setdefault("agv", {})[k] = int(v) if k == "count" else float(v)
    for aid, params in (changes.get("asrs") or {}).items():
        a = next((x for x in cfg.get("asrs", []) if x["id"] == aid), None)
        if a is None:
            raise ValueError(f"unknown AS/RS {aid}")
        if params.get("crane_cycle_s") not in (None, ""):
            a["crane_cycle_s"] = float(params["crane_cycle_s"])
    for pid, params in (changes.get("pools") or {}).items():
        p = next((x for x in cfg.get("pools", []) if x["id"] == pid), None)
        if p is None:
            raise ValueError(f"unknown pallet pool {pid}")
        if params.get("count") not in (None, ""):
            p["count"] = max(1, int(params["count"]))
    for st in cfg["stations"]:
        st["external"] = False  # what-if is always pure simulation
    for b in cfg["buffers"]:     # purchasing is assumed to work: stores never run empty
        if b.get("store") or (b.get("asrs") and not b.get("finished")):
            b["stock"] = 10**6
    return cfg


def what_if(config: dict, changes: dict, hours: float = 8.0, replications: int = 3) -> dict:
    hours = max(0.5, min(float(hours), 72.0))
    replications = max(1, min(int(replications), 5))
    scenario_cfg = apply_changes(config, changes)
    base_cfg = apply_changes(config, {})

    def avg(cfg):
        runs = [_run(cfg, hours, seed=1000 + r) for r in range(replications)]
        res = {
            "setups": sum(r["setups"] for r in runs) / len(runs),
            "setup_h": sum(r["setup_h"] for r in runs) / len(runs),
            "by_model": {k: sum(r["by_model"].get(k, 0) for r in runs) / len(runs) for k in runs[0]["by_model"]},
            "good": sum(r["good"] for r in runs) / len(runs),
            "scrap": sum(r["scrap"] for r in runs) / len(runs),
            "throughput_per_h": sum(r["throughput_per_h"] for r in runs) / len(runs),
            "line_oee": sum(r["line_oee"] for r in runs) / len(runs),
            "kwh_per_good_part": sum(r["kwh_per_good_part"] for r in runs) / len(runs),
            "agv_util": sum(r["agv_util"] for r in runs) / len(runs),
            "asrs_util": {k: sum(r["asrs_util"][k] for r in runs) / len(runs) for k in runs[0]["asrs_util"]},
            "bottleneck": max(set(r["bottleneck"] for r in runs),
                              key=[r["bottleneck"] for r in runs].count),
            "stations": {},
            "runs": [r["good"] for r in runs],
        }
        for sid in runs[0]["stations"]:
            res["stations"][sid] = {
                k: sum(r["stations"][sid][k] for r in runs) / len(runs)
                for k in runs[0]["stations"][sid]
            }
        return res

    base = avg(base_cfg)
    scen = avg(scenario_cfg)
    gain = (scen["good"] - base["good"]) / base["good"] if base["good"] else math.nan
    # uncertainty of the gain: standard error of the paired differences (same seeds)
    diffs = [s - b for s, b in zip(scen["runs"], base["runs"])]
    err = None
    if len(diffs) >= 2 and base["good"]:
        md = sum(diffs) / len(diffs)
        sd = math.sqrt(sum((d - md) ** 2 for d in diffs) / (len(diffs) - 1))
        err = sd / math.sqrt(len(diffs)) / base["good"] * 100
    return {"hours": hours, "replications": replications,
            "baseline": base, "scenario": scen, "gain_pct": gain * 100, "gain_err_pct": err}
