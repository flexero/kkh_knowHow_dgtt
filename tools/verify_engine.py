"""Verification: compare the twin engine with answers that can be calculated by hand."""
import json, math, sys, copy
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from twin.model import Factory
from twin.analytics import apply_changes, what_if

def st(id, cyc, inp, out, **kw):
    d = {"id": id, "type": "assembly", "cycle_time_s": cyc, "mtbf_h": 0, "mttr_min": 10,
         "base_scrap_rate": 0, "tool_wear_per_part_pct": 0,
         "inputs": [{"buffer": b, "qty": q} for b, q in inp], "output": out}
    d.update(kw); return d

def buf(id, cap=10, **kw):
    d = {"id": id, "capacity": cap}; d.update(kw); return d

def run(cfg, hours, seed=1):
    f = Factory(cfg, seed=seed, record_events=False)
    for _ in range(int(hours * 3600)): f.step(1.0)
    return f

rows = []
def check(name, hand, sim, tol_pct):
    err = (sim - hand) / hand * 100
    ok = abs(err) <= tol_pct
    rows.append((name, hand, sim, err, ok))

# 1. one machine, 60 s per part, 8 h, nothing random -> 480 parts
cfg = {"stations": [st("M", 60, [("RAW", 1)], "FG")],
       "buffers": [buf("RAW", infinite=True), buf("FG", finished=True)]}
check("1 machine, 60 s, 8 h", 8 * 3600 / 60, run(cfg, 8).finished_goods, 0.5)

# 2. serial line 50 s -> 80 s -> 60 s : slowest is 80 s -> 45/h
cfg = {"stations": [st("A", 50, [("RAW", 1)], "B1"), st("B", 80, [("B1", 1)], "B2"),
                    st("C", 60, [("B2", 1)], "FG")],
       "buffers": [buf("RAW", infinite=True), buf("B1"), buf("B2"), buf("FG", finished=True)]}
f = run(cfg, 100)
check("Serial line, slowest 80 s (units/h)", 3600 / 80, f.finished_goods / 100, 0.5)

# 3. two machines in parallel, 120 s each -> 60/h
cfg = {"stations": [st("P1", 120, [("RAW", 1)], "FG"), st("P2", 120, [("RAW", 1)], "FG")],
       "buffers": [buf("RAW", infinite=True), buf("FG", finished=True)]}
check("2 parallel machines, 120 s (units/h)", 60, run(cfg, 100).finished_goods / 100, 0.5)

# 4. assembly needs 2 cylinders: cylinder machine 100 s -> 18 units/h
cfg = {"stations": [st("CYL", 100, [("RAW", 1)], "BC", ), st("ASM", 60, [("BC", 2)], "FG")],
       "buffers": [buf("RAW", infinite=True), buf("BC"), buf("FG", finished=True)]}
check("Assembly needs 2 cylinders @100 s (units/h)", 18, run(cfg, 100).finished_goods / 100, 0.5)

# 5. breakdowns: MTBF 2 h, MTTR 30 min -> availability 2/(2+0.5) = 80% -> 48/h
cfg = {"stations": [st("M", 60, [("RAW", 1)], "FG", mtbf_h=2, mttr_min=30)],
       "buffers": [buf("RAW", infinite=True), buf("FG", finished=True)]}
tot = 0
for s in range(5): tot += run(cfg, 400, seed=s).finished_goods
check("Breakdowns MTBF 2 h / MTTR 30 min (units/h)", 60 * 2 / 2.5, tot / 2000, 2.0)

# 6. scrap 5% -> 95% good
cfg = {"stations": [st("M", 60, [("RAW", 1)], "FG", base_scrap_rate=0.05)],
       "buffers": [buf("RAW", infinite=True), buf("FG", finished=True)]}
f = run(cfg, 400)
m = f.machines[0]
check("Scrap 5% -> good share (%)", 95, 100 * m.good_count / m.total_count, 0.5)

# 7. test bench: FAD ~ Normal(20.4, 0.44), limit 19.4 -> reject share
cfg = {"stations": [st("T", 60, [("RAW", 1)], "FG", type="test")],
       "buffers": [buf("RAW", infinite=True), buf("FG", finished=True)]}
f = Factory(cfg, seed=1, record_events=False)
for _ in range(400 * 3600):
    f.machines[0].bearing_fault = False; f.machines[0].bearing_severity = 0.0
    f.step(1.0)
m = f.machines[0]
z = (19.4 - 20.4) / 0.44
hand = 100 * 0.5 * (1 + math.erf(z / math.sqrt(2)))
check("Test bench reject share (%)", hand, 100 * m.scrap_count / m.total_count, 25)

# 8. the real compressor factory (3 models, mixed sequence) with no breakdowns / scrap / changeovers
#    (includes AGVs, AS/RS cranes and the pallet pool; material always available,
#     finished goods shipped as soon as they are stored - same as the what-if engine)
#    hand calculation: time per unit of a station = sum(mix x cycle of the model) x parts per unit
#    / parallel machines; the largest one is the bottleneck
real = json.load(open(os.path.join(ROOT, "config", "factory.json"), encoding="utf-8"))
ideal = apply_changes(real, {})
for s in ideal["stations"]:
    s.update(mtbf_h=0, base_scrap_rate=0, tool_wear_per_part_pct=0, setup_s=0)
    s.pop("tool_magazine", None)
    if s.get("type") != "test": s["type"] = "assembly"   # no random bearing faults
ideal["fms"]["rule"] = "FIFO"                            # mixed sequence: VC20, VC10, VC20, VC30 ...
prods = ideal["products"]
mix = {p["id"]: p["mix"] / sum(q["mix"] for q in prods) for p in prods}
def cyc(st, v):
    p = next(q for q in prods if q["id"] == v)
    c = p.get("cycle_s", {})
    return c.get(st["id"], c.get(st["id"].split("-")[0], st["cycle_time_s"]))
groups = {}
for st_ in ideal["stations"]:
    groups.setdefault((st_["output"], json.dumps(st_["inputs"])), []).append(st_)
per_unit = {"B_CYL1": 2, "B_CYL": 2}                     # 2 cylinders per compressor
worst = 0
for (out, _), sts in groups.items():
    s0 = sts[0]
    hand_s = s0.get("pallet_changer", {}).get("change_s", 0) if s0.get("pallet_changer") else 0
    t = (sum(mix[v] * cyc(s0, v) for v in mix) + hand_s) * per_unit.get(out, 1) / len(sts)
    worst = max(worst, t)
f = Factory(ideal, seed=1, record_events=False)
f.handling.auto_ship = True
for _ in range(200 * 3600): f.step(1.0)
check("Compressor factory, 3 models, perfect machines (units/h)", 3600 / worst,
      f.finished_goods / 200, 3.0)   # test bench rejects ~1% of units

# 8b. changeover: one machine, 2 models alternating, 60 s each + 30 s setup at every change
#     -> 90 s per part -> 40/h ; same models in batches of 10 -> (10 x 60 + 30) / 10 = 63 s -> 57.1/h
def two_models(rule, batch):
    return {"products": [{"id": "A", "mix": 0.5, "cycle_s": {}}, {"id": "B", "mix": 0.5, "cycle_s": {}}],
            "fms": {"rule": rule, "max_batch": batch},
            "stations": [st("M", 60, [("RAW", 1)], "FG", serial="X", setup_s=30)],
            "buffers": [buf("RAW", infinite=True), buf("FG", finished=True)]}
check("Changeover 30 s, models alternate (units/h)", 40, run(two_models("FIFO", 1), 50).finished_goods / 50, 0.5)
check("Changeover 30 s, batches of 10 (units/h)", 3600 / 63, run(two_models("SETUP", 10), 50).finished_goods / 50, 0.5)

# 9. two unreliable machines (each 80% available) with a very big buffer between them
#    -> the buffer absorbs all stops -> line = 80% x 60/h = 48/h
def two(cap):
    return {"stations": [st("A", 60, [("RAW", 1)], "B", mtbf_h=1, mttr_min=15),
                         st("B", 60, [("B", 1)], "FG", mtbf_h=1, mttr_min=15)],
            "buffers": [buf("RAW", infinite=True), buf("B", cap, initial=cap // 2),
                        buf("FG", finished=True)]}
tot = sum(run(two(5000), 400, seed=s).finished_goods for s in range(3))
check("2 machines 80% avail, huge buffer (units/h)", 48, tot / 1200, 2.0)
tot1 = sum(run(two(1), 400, seed=s).finished_goods for s in range(3)) / 1200
tot10 = sum(run(two(10), 400, seed=s).finished_goods for s in range(3)) / 1200
print(f"Buffer effect (theory: no buffer = 60/(1+0.25+0.25) = 40/h, huge buffer = 48/h, small buffers in between): "
      f"buffer 1 = {tot1:.1f}/h, buffer 10 = {tot10:.1f}/h")

for name, hand, sim, err, ok in rows:
    print(f"{'PASS' if ok else 'FAIL'} | {name:48s} | hand {hand:8.2f} | twin {sim:8.2f} | diff {err:+6.2f}%")

# 9. same scenario twice -> identical answer (repeatable)
a = what_if(real, {}, hours=8, replications=2); b = what_if(real, {}, hours=8, replications=2)
print("Repeatable:", a["baseline"]["good"] == b["baseline"]["good"], a["baseline"]["good"])

