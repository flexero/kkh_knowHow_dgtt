"""
Factory model - the "virtual copy" of the production system.

The factory is a network of STATIONS (machines, work cells) connected by
BUFFERS (conveyors, racks, pallets, stores):

    AS/RS -> AGV -> [load station] -> pallet pool -> [HMC-01..03] -> [WASH] ------\
    AS/RS -> AGV -> [VMC] -> [HONE] ----------------------------------------------+-> [ASSEMBLY] -> ... -> AGV -> AS/RS
    AS/RS -> AGV -> [LATHE] -> [GRIND] -------------------------------------------/

* A station takes `qty` parts from EACH of its input buffers (e.g. assembly
  takes 1 crankcase + 2 cylinders + 1 crankshaft), processes them for
  `cycle_time_s` (+ load/unload or pallet-change time), and puts 1 part into its
  output buffer.
* Several stations with the same input and output work in PARALLEL.
* Every part is a small record (id, lot, serial number, components, route), so
  each finished compressor can be traced back to its castings (genealogy).
* Material handling (AGVs, AS/RS cranes, pallet pools) lives in handling.py.
* If `inputs`/`output` are missing in the config, a simple serial line is
  assumed: buffers[i] -> stations[i] -> buffers[i+1].

Flexible manufacturing (FMS) - several product models on the same machines:
* `products` in the config: each model (variant, e.g. VC10 / VC20 / VC30) has
  its own cycle times per station, test specification and price. Every part
  record carries its model in `v`.
* Changeover (setup): a station with `setup_s` loses that time when the next
  part is a different model than the last one (new program, fixture, jaws).
  A machining center with a `tool_magazine` holds the tool sets of only a few
  models; a part of another model first needs a tool-set exchange (`load_s`).
* Routing: machines with `"pick": "rule"` (the machining centers of the FMS
  cell) choose the next pallet from the pallet pool by the dispatching rule:
  FIFO, EDD (earliest due date), SPT (shortest processing time) or SETUP
  (prefer the model whose tools are loaded = fewer changeovers).
* Kanban supermarkets: the cylinder and crankshaft lines machine the model
  whose supermarket stock (+ parts on the way) is below its target. The
  assembly cell (`"pick": "kit"`) only starts a crankcase when its kit
  (2 cylinders + 1 crankshaft of the same model) is complete.
* `alt` on an input: a model-specific part store (e.g. 100 L / 300 L / 500 L tank).

Each station is a small state machine plus a simple physical model that
produces sensor values (temperature, vibration, power, spindle speed, tool
wear, and for the test bench: air flow and pressure). In a real factory the
sensor values come from the machines (PLC / OPC UA / MQTT); here a simulator
generates them so you can learn and test before connecting hardware.

Units: time in seconds (simulation time), temperature in C, vibration in mm/s
RMS (ISO 10816 style), power in kW, flow in m3/h, pressure in bar.
"""

from __future__ import annotations

import math
import random
from collections import deque

from .handling import Handling, Pool

# Machine states
RUNNING = "RUNNING"          # processing a part
STARVED = "STARVED"          # waiting - inputs not available
BLOCKED = "BLOCKED"          # finished part cannot move - output buffer full
DOWN = "DOWN"                # unplanned stop (breakdown)
MAINTENANCE = "MAINTENANCE"  # planned maintenance in progress
STOPPED = "STOPPED"          # stopped by the operator
OFFLINE = "OFFLINE"          # external machine, no data received
SETUP = "SETUP"              # changeover to another product model (program, fixture, tools)

ALL_STATES = [RUNNING, SETUP, STARVED, BLOCKED, DOWN, MAINTENANCE, STOPPED, OFFLINE]
RULES = ("FIFO", "EDD", "SPT", "SETUP")

BASE_VIBRATION = {"cnc": 1.2, "robot": 0.8, "inspection": 0.3, "packaging": 1.0,
                  "washer": 0.6, "assembly": 0.2, "test": 2.2, "paint": 0.4, "load": 0.2}
HEAT_RISE = {"assembly": 4.0, "packaging": 8.0, "inspection": 10.0, "robot": 20.0, "load": 3.0}


class Buffer:
    """Parts waiting between stations (conveyor, rack, pallet, store...).

    Kinds:
      normal    - holds up to `capacity` part records (FIFO)
      infinite  - endless raw material (simple examples)
      store     - inventory location with stock in LOTS (raw material store,
                  AS/RS); stock is changed by goods receipts and withdrawals
      finished  - finished-goods store; `received` counts everything that
                  ever arrived (output), `count` is what is in stock now
    """

    def __init__(self, cfg: dict):
        self.id = cfg["id"]
        self.name = cfg.get("name", self.id)
        self.infinite = bool(cfg.get("infinite", False))
        self.finished = bool(cfg.get("finished", False))
        self.asrs_id = cfg.get("asrs")
        self.store = bool(cfg.get("store", False) or (self.asrs_id and not self.finished))
        self.capacity = int(cfg.get("capacity", 10**9 if (self.store or self.finished) else 10))
        self.part = cfg.get("part", "part")
        self.prefix = cfg.get("prefix") or self.part[:3].upper()
        self.items: deque = deque()
        self.lots: deque = deque()        # store: [lot_id, qty]
        self.stock = 0                    # store: total qty in lots
        self.received = 0                 # finished: cumulative arrivals
        self.arrivals: list = []          # finished: items that arrived this step
        self.reserved = 0                 # promised to an AGV / shipment
        self.incoming = 0                 # on the way here (AGV / crane)
        self.variant = cfg.get("variant")             # model-specific store (e.g. VC10 castings)
        self.per_variant = int(cfg.get("per_variant", 0))   # supermarket: max parts per model
        self.incoming_v: dict = {}                    # on the way here, per model
        self._seq = 0
        if self.store:
            stock = int(cfg.get("stock", 0))
            if stock:
                self.add_lot(cfg.get("initial_lot", f"{self.prefix}-L0000"), stock)
        for _ in range(int(cfg.get("initial", 0))):
            self.items.append(self.new_item())

    # ------------------------------------------------------------ items
    def new_item(self, lot=None) -> dict:
        self._seq += 1
        it = {"id": f"{self.prefix}-{self._seq:06d}", "part": self.part, "lot": lot}
        if self.variant:
            it["v"] = self.variant
        return it

    # ------------------------------------------------- product models (FMS)
    @property
    def bulk(self) -> bool:
        """Stores and endless sources hold no individual part records."""
        return self.store or self.infinite

    def count_v(self, v) -> int:
        """Parts of model v (exactly v) in this buffer."""
        if self.bulk:
            return self.count if self.variant == v else 0
        return sum(1 for it in self.items if it.get("v") == v)

    def by_variant(self) -> dict:
        out = {}
        for it in self.items:
            k = it.get("v")
            if k:
                out[k] = out.get(k, 0) + 1
        return out

    def variants_avail(self, all_variants) -> set:
        """Models a station could start from this buffer now."""
        if self.bulk:
            if self.available <= 0:
                return set()
            return {self.variant} if self.variant else (set(all_variants) or {None})
        return {it.get("v") for it in self.items}

    def can_take_v(self, n: int, v) -> bool:
        """n parts usable for model v (parts without a model fit every model)."""
        if self.infinite:
            return True
        if self.store or v is None:
            return self.available >= n
        k = sum(1 for it in self.items if it.get("v") in (None, v))
        return k - self.reserved >= n

    def take_v(self, n: int, v) -> list:
        if self.bulk or v is None:
            return self.take(n)
        out = []
        for it in list(self.items):
            if len(out) >= n:
                break
            if it.get("v") in (None, v):
                self.items.remove(it)
                out.append(it)
        return out

    def add_lot(self, lot: str, qty: int):
        if qty <= 0:
            return
        if self.lots and self.lots[-1][0] == lot:
            self.lots[-1][1] += qty
        else:
            self.lots.append([lot, qty])
        self.stock += qty

    @property
    def count(self) -> int:
        return self.stock if self.store else len(self.items)

    @property
    def available(self) -> int:
        if self.infinite:
            return 10**9
        return self.count - self.reserved

    def can_take(self, n: int = 1) -> bool:
        return self.infinite or self.available >= n

    def take(self, n: int = 1, reserved: bool = False) -> list:
        """Remove n parts and return their records. `reserved=True` uses
        parts that were reserved before (by an AGV task or a shipment)."""
        if reserved:
            self.reserved -= n
        if self.infinite:
            return [self.new_item() for _ in range(n)]
        if self.store:
            out = []
            while len(out) < n and self.lots:
                lot = self.lots[0]
                k = min(n - len(out), lot[1])
                out += [self.new_item(lot[0]) for _ in range(k)]
                lot[1] -= k
                self.stock -= k
                if lot[1] <= 0:
                    self.lots.popleft()
            return out
        return [self.items.popleft() for _ in range(min(n, len(self.items)))]

    def can_put(self, n: int = 1) -> bool:
        return self.finished or self.store or len(self.items) + n <= self.capacity

    def put(self, item: dict | None = None) -> bool:
        if not self.can_put():
            return False
        if item is None:
            item = self.new_item()
        if self.per_variant and item.get("v") and self.count_v(item["v"]) >= self.per_variant:
            return False                  # this model's place in the supermarket is full
        if self.store:
            self.add_lot(item.get("lot") or "RETURN", 1)
            return True
        self.items.append(item)
        if self.finished:
            self.received += 1
            self.arrivals.append(item)
        return True

    def snapshot(self) -> dict:
        return {"id": self.id, "name": self.name, "count": self.count,
                "capacity": self.capacity if self.capacity < 10**8 else None,
                "infinite": self.infinite, "finished": self.finished, "store": self.store,
                "asrs": self.asrs_id, "part": self.part, "reserved": self.reserved,
                "incoming": self.incoming,
                "lots": [[l, q] for l, q in list(self.lots)[:6]] if self.store else None,
                "variant": self.variant, "per_variant": self.per_variant or None,
                "by_v": None if self.bulk else self.by_variant(),
                # serial no. + work order + model of the first parts (oldest first) - for the 3D view
                "units": None if (self.store or self.finished or self.infinite) else
                [[it.get("sn"), it.get("wo"), it.get("v")] for it in list(self.items)[:12]]}


class Machine:
    """One station, with its state machine and physics."""

    def __init__(self, cfg: dict, rng: random.Random, ambient_c: float):
        self.cfg = cfg
        self.id = cfg["id"]
        self.name = cfg.get("name", self.id)
        self.type = cfg.get("type", "cnc")
        self.line = cfg.get("line", "")
        self.rng = rng
        self.ambient = ambient_c
        self.external = bool(cfg.get("external", False))

        self.cycle_time = float(cfg.get("cycle_time_s", 60))
        # part handling: with a pallet changer the next part is clamped on a
        # second pallet while the machine cuts, so only the change time is lost
        pc = cfg.get("pallet_changer")
        self.pallet_changer = bool(pc)
        if pc:
            self.handling_s = float(pc.get("change_s", 15) if isinstance(pc, dict) else 15)
        else:
            self.handling_s = float(cfg.get("load_unload_s", 0))
        self.idle_power = float(cfg.get("idle_power_kw", 1.0))
        self.run_power = float(cfg.get("run_power_kw", 5.0))
        self.nominal_rpm = float(cfg.get("spindle_rpm", 0))
        self.temp_limit = float(cfg.get("temp_limit_c", 75))
        self.vib_warn = float(cfg.get("vibration_warn_mm_s", 4.5))
        self.vib_alarm = float(cfg.get("vibration_alarm_mm_s", 7.1))
        self.wear_per_part = float(cfg.get("tool_wear_per_part_pct", 0.0))
        self.base_scrap = float(cfg.get("base_scrap_rate", 0.0))
        self.mtbf_s = float(cfg.get("mtbf_h", 50)) * 3600
        self.mttr_s = float(cfg.get("mttr_min", 10)) * 60
        self.base_vib = BASE_VIBRATION.get(self.type, 1.0)
        self.heat_offset = float(cfg.get("process_temp_c", 0))   # e.g. paint curing oven
        # temperature rise above ambient at full power (a manual bench barely heats up)
        self.heat_rise = float(cfg.get("heat_rise_c", HEAT_RISE.get(self.type, 30.0)))
        # test bench specification
        self.spec_flow = float(cfg.get("spec_flow_m3_h", 20.0))
        self.flow_tolerance = float(cfg.get("flow_tolerance_pct", 3.0))
        self.test_pressure = float(cfg.get("test_pressure_bar", 8.0))
        self.serial_prefix = cfg.get("serial")       # this station gives each unit its serial number

        # flexible manufacturing: product models, changeover, tool magazine, routing
        self.setup_s = float(cfg.get("setup_s", 0))  # changeover time when the model changes
        mag = cfg.get("tool_magazine") or {}
        self.mag_sets = int(mag.get("sets", 0))      # tool sets (models) the magazine can hold
        self.mag_load_s = float(mag.get("load_s", 600))
        self.tools = list(mag.get("initial", []))[: self.mag_sets]   # oldest use first
        self.pick = cfg.get("pick")                  # "rule" | "kit" | None (= first in, first out)
        self.kanban = cfg.get("kanban")              # {"buffer", "target", "trigger"}
        self.kanban_chain = None                     # (buffers, machines) down to the supermarket
        self.alts: dict = {}                         # input index -> {model: model-specific buffer}
        self.cycle_v: dict = {}                      # model -> processing time (set by Factory)
        self.spec_v: dict = {}                       # model -> nominal air flow (test bench)
        self.avg_cycle = self.cycle_time             # processing time averaged over the product mix
        self.setup_v = cfg.get("set_up_for")         # model the machine is set up for now
        self.setup_left = 0.0
        self.setups = 0                              # number of changeovers
        self.setup_time = 0.0                        # seconds spent in changeover
        self.cur_v = None                            # model of the part in the machine
        self.cur_time = self.cycle_time + self.handling_s
        self.ideal_done = 0.0                        # ideal processing seconds of all parts made (OEE)
        self.parts_v: dict = {}                      # parts made per model

        # wiring - set by Factory
        self.inputs: list = []    # [(Buffer, qty)]
        self.output: Buffer | None = None
        self.seize_pool: Pool | None = None     # takes a fixture pallet when it starts
        self.release_pool: Pool | None = None   # gives the pallet back when it finishes
        self.factory = None

        # dynamic state
        self.state = OFFLINE if self.external else STARVED
        self.reason = ""
        self.has_part = False
        self.part_done = False
        self.item: dict | None = None
        self.progress = 0.0
        self.speed_pct = 100.0
        self.repair_timer = 0.0
        self.time_to_failure = self._sample_ttf()
        self.bearing_fault = False
        self.bearing_severity = 0.0
        self.last_ingest_wall = None

        # sensors
        self.temperature = ambient_c + 2.0
        self.vibration = self.base_vib * 0.3
        self.power = self.idle_power
        self.rpm = 0.0
        self.tool_wear = rng.uniform(5, 40) if self.wear_per_part > 0 else 0.0
        self.flow = None if self.type != "test" else 0.0
        self.pressure = None if self.type != "test" else 0.0
        self._unit_flow = self.spec_flow
        self.last_test_flow = None
        self.last_spec = self.spec_flow

        # counters
        self.total_count = 0
        self.good_count = 0
        self.scrap_count = 0
        self.state_time = {s: 0.0 for s in ALL_STATES}
        self.active_recent = 0.0
        self.last_cycle_s = 0.0
        self._cycle_elapsed = 0.0
        self._start_t = 0.0

        self.vib_ewma = self.vibration
        self.vib_trend = deque(maxlen=120)
        self._trend_timer = 0.0

    @property
    def total_time(self) -> float:
        """Time per part = cutting/processing + part handling (averaged over the product mix)."""
        return self.avg_cycle + self.handling_s

    def time_for(self, v) -> float:
        """Processing time of one part of model v."""
        return self.cycle_v.get(v, self.cycle_time)

    def configure_products(self, products: dict, mix: dict):
        key = self.id.split("-")[0]               # "HMC-02" -> "HMC"
        for v, p in products.items():
            c = p.get("cycle_s") or {}
            t = c.get(self.id, c.get(key))
            self.cycle_v[v] = float(t) if t is not None else self.cycle_time * float(p.get("time_factor", 1.0))
            if p.get("spec_flow_m3_h"):
                self.spec_v[v] = float(p["spec_flow_m3_h"])
        if mix:
            self.avg_cycle = sum(mix[v] * self.cycle_v[v] for v in mix)

    # ---------------------------------------------------------------- helpers
    def _sample_ttf(self) -> float:
        return self.rng.expovariate(1.0 / self.mtbf_s) if self.mtbf_s > 0 else math.inf

    def _go_down(self, reason: str, repair_s: float, events: list, sim_t: float):
        self.state = DOWN
        self.reason = reason
        self.repair_timer = repair_s
        events.append({"t": sim_t, "machine": self.id, "level": "critical",
                       "text": f"{self.name} DOWN: {reason}"})

    # ------------------------------------------------- choosing the next part
    def _buf(self, i: int, v):
        """Input buffer i for model v (model-specific store, e.g. 100 L tanks for VC10)."""
        alt = self.alts.get(i)
        return alt.get(v, self.inputs[i][0]) if alt and v is not None else self.inputs[i][0]

    def _missing(self, v):
        """First other input (2nd, 3rd ...) that has not enough parts for model v."""
        for i in range(1, len(self.inputs)):
            b = self._buf(i, v)
            if not b.can_take_v(self.inputs[i][1], v):
                return b
        return None

    def _rule_key(self, it: dict, idx: int):
        rule = self.factory.rule if self.factory is not None else "FIFO"
        v = it.get("v")
        due = self.factory.wo_due(it.get("wo")) if (self.factory is not None and rule != "FIFO") else None
        due = due if due is not None else 1e18
        if rule == "EDD":
            return (due, idx)
        if rule == "SPT":
            return (self.time_for(v), due, idx)
        if rule == "SETUP":
            # orders are grouped in due-date windows; inside a window, no changeover first
            ready = (v in self.tools) if self.mag_sets else (v == self.setup_v)
            return (self.factory.window_of(due), 0 if ready else 1, due, idx)
        return (idx,)

    def _kanban_level(self, v) -> int:
        bufs, ms = self.kanban_chain
        return sum(b.count_v(v) for b in bufs) + sum(1 for m in ms if m.has_part and m.item and m.item.get("v") == v)

    def _kanban_variant(self):
        """Kanban: make the model whose supermarket (+ parts on the way) is below target.
        Stay on the current model while it is below target (fewer changeovers); switch only
        to a model that fell to its trigger level (= a full batch of kanban cards)."""
        f = self.factory
        target = int(self.kanban.get("target", 10))
        trigger = int(self.kanban.get("trigger", target // 2))
        # models with no demand (mix 0 and never started) get no stock
        vs = [v for v in f.variants if f.mix.get(v, 1) > 0 or f.started_v.get(v, 0) > 0]
        lvl = {v: self._kanban_level(v) for v in vs}
        need = [v for v in vs if lvl[v] < target]
        if self.setup_v in need:
            return self.setup_v
        low = [v for v in need if lvl[v] <= trigger]
        if not low:
            return None
        return min(low, key=lambda v: (lvl[v] / target, vs.index(v)))

    def _plan(self):
        """Decide which part to start next. Returns (plan, reason); plan None = wait."""
        if self.seize_pool is not None and self.seize_pool.free <= 0:
            return None, "No free fixture pallet"
        f = self.factory
        b0, q0 = self.inputs[0]
        if self.serial_prefix and f is not None:
            # order release: the MES chooses the work order (and so the model)
            g = f.release_gate(self, b0.variants_avail(f.variants))
            if g is None or isinstance(g, str):
                return None, g or "No released work order"
            wo, v = g
            return {"v": v, "wo": wo}, ""
        if self.kanban and f is not None and f.variants and self.kanban_chain:
            if not b0.can_take(q0):
                return None, ""
            v = self._kanban_variant()
            if v is None:
                return None, "Kanban full - no part needed now"
            miss = self._missing(v)
            if miss is not None:
                return None, f"Waiting for {miss.name}"
            return {"v": v, "assign": True}, ""
        if self.pick in ("rule", "kit") and not b0.bulk:
            items = list(b0.items)[: (1 if b0.reserved else 24)]
            if not items:
                return None, ""
            # "rule": the dispatching rule decides; "kit": same, but only complete kits can start
            # (the buffer in front of the assembly cell also re-sequences the models)
            order = sorted(range(len(items)), key=lambda i: self._rule_key(items[i], i))
            miss = None
            for i in order:
                it = items[i]
                m = self._missing(it.get("v"))
                if m is None:
                    return {"v": it.get("v"), "item": it}, ""
                miss = miss or m
            return None, f"Kit not complete - waiting for {miss.name}"
        if not b0.can_take(q0):
            return None, ""
        v = b0.items[0].get("v") if (not b0.bulk and b0.items) else b0.variant
        miss = self._missing(v)
        if miss is not None:
            return None, f"Waiting for {miss.name}"
        return {"v": v}, ""

    def _take(self, plan: dict) -> dict:
        v = plan.get("v")
        b0, q0 = self.inputs[0]
        if plan.get("item") is not None:
            b0.items.remove(plan["item"])
            first = [plan["item"]] + (b0.take_v(q0 - 1, v) if q0 > 1 else [])
        elif plan.get("wo") is not None and v is not None:
            first = b0.take_v(q0, v)
        else:
            first = b0.take(q0)
        rest = [self._buf(i, v).take_v(self.inputs[i][1], v) for i in range(1, len(self.inputs))]
        flat = first + [it for grp in rest for it in grp]
        if not flat:
            return {"id": f"{self.id}-X", "part": "part"}
        item = flat[0]
        if plan.get("assign") or (v is not None and not item.get("v")):
            item["v"] = v                  # the part becomes this model (program / castings chosen for it)
        if len(flat) > 1:
            item.setdefault("comps", []).extend(flat[1:])
        if self.seize_pool is not None:
            self.seize_pool.free -= 1
        return item

    def _changeover(self, v) -> float:
        """Setup time before a part of model v (0 when nothing changes)."""
        if v is None:
            return 0.0
        s = 0.0
        what, prev = [], self.setup_v
        if self.mag_sets:
            if v in self.tools:
                self.tools.remove(v)                   # most recently used goes last
            else:
                s += self.mag_load_s                   # exchange a tool set in the magazine
                what.append(f"tool set {v}")
                if len(self.tools) >= self.mag_sets:
                    self.tools.pop(0)
            self.tools.append(v)
        if self.setup_s and self.setup_v is not None and v != self.setup_v:
            s += self.setup_s
            what.append(f"program {prev} -> {v}")
        self.setup_v = v
        if s > 0:
            self.setups += 1
            if self.factory is not None and getattr(self.factory, "bus", None) is not None:
                from . import comm
                comm.send(self.factory, 9, f"{self.name}: {', '.join(what)} ({s / 60:.0f} min)",
                          {"machine": self.id, "program": f"O{self.id.replace('-', '')}_{v}.nc",
                           "from_model": prev, "to_model": v, "setup_s": round(s), "tools_loaded": list(self.tools)})
        return s

    def _inputs_ready(self) -> bool:
        if self.seize_pool is not None and self.seize_pool.free <= 0:
            return False
        return all(b.can_take(q) for b, q in self.inputs)

    def _take_inputs(self) -> dict:
        """First in, first out (used for live machines that report finished parts)."""
        taken = [b.take(q) for b, q in self.inputs]
        flat = [it for group in taken for it in group]
        if not flat:
            return {"id": f"{self.id}-X", "part": "part"}
        item = flat[0]
        if len(flat) > 1:
            item.setdefault("comps", []).extend(flat[1:])
        if self.seize_pool is not None:
            self.seize_pool.free -= 1
        return item

    def _scrap(self, reason: str, sim_t: float):
        self.scrap_count += 1
        if self.factory is not None and self.item is not None:
            self.factory.unit_event("scrap", self.item, self, sim_t, reason=reason)
        self.item = None
        self.has_part = False
        self.part_done = False

    # --------------------------------------------------------------- commands
    def command(self, action: str, value=None) -> str:
        if action == "stop":
            if self.state not in (DOWN, MAINTENANCE):
                self.state, self.reason = STOPPED, "Stopped by operator"
            return "stopped"
        if action == "start":
            if self.state == STOPPED:
                self.state, self.reason = STARVED, ""
            return "started"
        if action == "maintenance":
            self.state = MAINTENANCE
            self.reason = "Planned maintenance (tool change + bearing check)"
            self.repair_timer = max(self.mttr_s * 0.6, 120)
            return "maintenance started"
        if action == "inject_bearing_fault":
            self.bearing_fault = True
            self.bearing_severity = max(self.bearing_severity, 0.02)
            return "bearing fault injected - watch the vibration trend"
        if action == "set_speed":
            self.speed_pct = max(50.0, min(130.0, float(value)))
            return f"speed set to {self.speed_pct:.0f}%"
        raise ValueError(f"unknown action {action}")

    # ------------------------------------------------------------ simulation
    def step(self, dt: float, sim_t: float, events: list) -> int:
        """Advance the machine by dt seconds. Returns 1 if a good part left."""
        self.state_time[self.state] = self.state_time.get(self.state, 0.0) + dt
        # share of recent time (about the last hour) the station was busy or broken
        active = 1.0 if self.state in (RUNNING, DOWN) else 0.0
        self.active_recent += (active - self.active_recent) * min(1.0, dt / 3600.0)
        if self.external:
            return 0  # driven by ingest(), not by the simulator

        produced = 0
        if self.state in (DOWN, MAINTENANCE):
            self.repair_timer -= dt
            if self.repair_timer <= 0:
                if self.state == MAINTENANCE or "Tool" in self.reason or "Bearing" in self.reason:
                    self.tool_wear = 0.0
                    self.bearing_fault = False
                    self.bearing_severity = 0.0
                events.append({"t": sim_t, "machine": self.id, "level": "info",
                               "text": f"{self.name} back in service"})
                self.state, self.reason = STARVED, ""
                self.time_to_failure = self._sample_ttf()
        elif self.state != STOPPED:
            if self.part_done:
                if self.output.put(self.item):
                    self.part_done = False
                    self.has_part = False
                    self.item = None
                    produced = 1
                else:
                    self.state, self.reason = BLOCKED, "Output full"
            if not self.has_part:
                plan, why = self._plan()
                if plan is None:
                    self.state, self.reason = STARVED, why
                else:
                    self.item = self._take(plan)
                    v = self.item.get("v") if plan.get("v") is None else plan["v"]
                    if self.serial_prefix and self.factory is not None:
                        self.factory.assign_serial(self.item, self, plan.get("wo", ""), sim_t)
                    self.has_part = True
                    self.progress = 0.0
                    self._cycle_elapsed = 0.0
                    self._start_t = sim_t
                    self.cur_v = v
                    self.cur_time = self.time_for(v) + self.handling_s
                    self.setup_left = self._changeover(v)
                    if self.type == "test":
                        spec = self.spec_v.get(v, self.spec_flow)
                        self._unit_flow = self.rng.gauss(spec * 1.02, spec * 0.022)
            if self.has_part and not self.part_done and self.setup_left > 0:
                # changeover: new NC program, fixture / chuck jaws, tool set, test adapter ...
                self.state, self.reason = SETUP, f"Changeover to {self.cur_v}"
                self.setup_left -= dt
                self.setup_time += dt
            elif self.has_part and not self.part_done:
                self.state, self.reason = RUNNING, ""
                self.progress += dt * (self.speed_pct / 100.0) / self.cur_time
                self._cycle_elapsed += dt
                self.time_to_failure -= dt * (self.speed_pct / 100.0) ** 2
                if self.time_to_failure <= 0:
                    self._go_down("Random breakdown", self.rng.expovariate(1 / self.mttr_s),
                                  events, sim_t)
                elif self.progress >= 1.0 - 1e-9:   # tolerance: float sums like 80 x (1/80) = 0.99999...
                    self._finish_part(sim_t, events)

        if not self.bearing_fault and self.state == RUNNING and self.type in ("cnc", "robot", "test"):
            if self.rng.random() < dt / (3600 * 40):
                self.bearing_fault = True
                self.bearing_severity = 0.02
        if self.bearing_fault and self.state == RUNNING:
            self.bearing_severity = min(1.0, self.bearing_severity
                                        + dt * (0.00004 + self.bearing_severity * 0.00025))
            if self.vibration > self.vib_alarm * 1.35 and self.state != DOWN:
                self._go_down("Bearing failure", self.mttr_s * 3, events, sim_t)

        self._update_sensors(dt, sim_t)
        return produced

    def _finish_part(self, sim_t: float, events: list):
        self.last_cycle_s = self._cycle_elapsed
        self.total_count += 1
        self.ideal_done += self.time_for(self.cur_v)
        if self.cur_v is not None:
            self.parts_v[self.cur_v] = self.parts_v.get(self.cur_v, 0) + 1
        self.tool_wear += self.wear_per_part * (self.speed_pct / 100.0) ** 1.5
        if self.release_pool is not None:
            self.release_pool.free = min(self.release_pool.count, self.release_pool.free + 1)
        if self.factory is not None and self.factory.track and self.item is not None:
            self.item.setdefault("route", []).append([self.id, round(self._start_t), round(sim_t)])
        if self.type == "test":
            # quality is decided by the measured free air delivery (FAD)
            # the bench measures the compressor; a worn bench bearing raises bench
            # vibration but does not change the unit's air flow
            self.last_test_flow = self._unit_flow
            spec = self.spec_v.get(self.cur_v, self.spec_flow)
            self.last_spec = spec
            ok = self.last_test_flow >= spec * (1 - self.flow_tolerance / 100)
            if self.item is not None:
                self.item["fad"] = round(self.last_test_flow, 2)
            if self.factory is not None:
                self.factory.unit_event("test", self.item, self, sim_t,
                                        fad=round(self.last_test_flow, 2), ok=ok, spec=spec)
            if ok:
                self.good_count += 1
                self.part_done = True
            else:
                limit = spec * (1 - self.flow_tolerance / 100)
                self._scrap(f"FAD {self.last_test_flow:.2f} < {limit:.1f} m3/h", sim_t)
                events.append({"t": sim_t, "machine": self.id, "level": "info",
                               "text": f"{self.name}: unit rejected, FAD {self.last_test_flow:.2f} m3/h "
                                       f"< {limit:.1f}"})
            return
        scrap_p = self.base_scrap
        if self.tool_wear > 70:
            scrap_p += (self.tool_wear - 70) / 30 * 0.15
        if self.temperature > self.temp_limit:
            scrap_p += 0.05
        scrap_p += self.bearing_severity * 0.1
        if self.tool_wear >= 100:
            self._scrap("Tool broken", sim_t)
            self._go_down("Tool broken (wear 100%)", self.mttr_s, events, sim_t)
            return
        if self.rng.random() < scrap_p:
            self._scrap("Worn tool" if self.tool_wear > 70 else "Process defect", sim_t)
        else:
            self.good_count += 1
            self.part_done = True

    def _update_sensors(self, dt: float, sim_t: float):
        n = self.rng.gauss
        running = self.state == RUNNING
        sp = self.speed_pct / 100.0
        wear = self.tool_wear / 100.0
        if self.state in (DOWN, STOPPED):
            target_power = self.idle_power * 0.3
        elif running:
            target_power = (self.idle_power + self.run_power * sp
                            * (1 + 0.25 * wear + 0.3 * self.bearing_severity))
        else:
            target_power = self.idle_power
        self.power = max(0.0, target_power + n(0, 0.03 * max(target_power, 0.5)))

        k = self.heat_rise / max(self.run_power + self.idle_power, 0.1)
        heat = self.heat_offset if self.state not in (DOWN, STOPPED) else 0.0
        target_t = self.ambient + k * self.power + 20 * self.bearing_severity + heat
        tau = 600.0
        self.temperature += (target_t - self.temperature) * min(1.0, dt / tau)
        self.temperature += n(0, 0.05)

        load = 1.0 if running else 0.25
        vib = self.base_vib * load * (0.8 + 0.2 * sp) + 1.5 * wear * load \
            + 8.5 * self.bearing_severity + abs(n(0, 0.08))
        if self.state in (DOWN, STOPPED, MAINTENANCE):
            vib = abs(n(0, 0.05))
        self.vibration = vib
        self.rpm = self.nominal_rpm * sp + n(0, 5) if (running and self.nominal_rpm) else 0.0

        if self.type == "test":
            if running:
                ramp = min(1.0, self.progress / 0.3)
                self.pressure = max(0.0, self.test_pressure * ramp + n(0, 0.03))
                self.flow = max(0.0, self._unit_flow * min(1.0, self.progress / 0.15) + n(0, 0.08))
            else:
                self.pressure = max(0.0, (self.pressure or 0) * 0.9)
                self.flow = 0.0

        if running:
            self.vib_ewma += (self.vibration - self.vib_ewma) * min(1.0, dt / 60.0)
            self._trend_timer += dt
            if self._trend_timer >= 30:
                self._trend_timer = 0.0
                self.vib_trend.append((sim_t, self.vib_ewma))

    # ----------------------------------------------------------- live data
    def ingest(self, data: dict, sim_t: float, events: list, wall_t: float):
        """Apply real data coming from the physical machine (PLC / gateway)."""
        s = data.get("sensors", {})
        if "temperature_c" in s:
            self.temperature = float(s["temperature_c"])
        if "vibration_mm_s" in s:
            self.vibration = float(s["vibration_mm_s"])
            self.vib_ewma += (self.vibration - self.vib_ewma) * 0.2
            self.vib_trend.append((sim_t, self.vib_ewma))
        if "power_kw" in s:
            self.power = float(s["power_kw"])
        if "spindle_rpm" in s:
            self.rpm = float(s["spindle_rpm"])
        if "tool_wear_pct" in s:
            self.tool_wear = float(s["tool_wear_pct"])
        if "flow_m3_h" in s:
            self.flow = float(s["flow_m3_h"])
        if "pressure_bar" in s:
            self.pressure = float(s["pressure_bar"])
        st = data.get("state")
        if st:
            st = st.upper()
            if st not in ALL_STATES:
                raise ValueError(f"state must be one of {ALL_STATES}")
            if st == DOWN and self.state != DOWN:
                events.append({"t": sim_t, "machine": self.id, "level": "critical",
                               "text": f"{self.name} DOWN: {data.get('reason', 'reported by machine')}"})
            self.state = st
            self.reason = data.get("reason", "")
        part = data.get("part_done")
        if part is not None:
            self.item = self._take_inputs()
            if self.release_pool is not None:
                self.release_pool.free = min(self.release_pool.count, self.release_pool.free + 1)
            self.total_count += 1
            if "flow_m3_h" in part:
                self.last_test_flow = float(part["flow_m3_h"])
                self.item["fad"] = self.last_test_flow
            if part.get("good", True):
                self.good_count += 1
                self.output.put(self.item)
                self.item = None
            else:
                self._scrap("Reported by machine", sim_t)
            if "cycle_time_s" in part:
                self.last_cycle_s = float(part["cycle_time_s"])
        self.last_ingest_wall = wall_t


class Factory:
    """The whole factory: stations, buffers, material handling, clock and counters."""

    def __init__(self, config: dict, seed: int | None = None, record_events: bool = True,
                 track: bool | None = None):
        self.config = config
        self.name = config.get("factory_name", "Factory")
        base_seed = config.get("random_seed", 1) if seed is None else seed
        self.rng = random.Random(base_seed)
        self.track = record_events if track is None else track   # keep unit history (MES)
        ambient = float(config.get("ambient_temp_c", 25))
        # each machine gets its own random stream, so changing one machine in a
        # what-if scenario does not change the random events of the others
        self.machines = [Machine(c, random.Random(f"{base_seed}-{c['id']}"), ambient)
                         for c in config["stations"]]
        # product models (FMS): cycle times per model, product mix, dispatching rule
        prods = config.get("products") or []
        self.products = {p["id"]: p for p in prods}
        self.variants = list(self.products)
        tot = sum(float(p.get("mix", 1)) for p in prods) or 1.0
        self.mix = {p["id"]: float(p.get("mix", 1)) / tot for p in prods}
        fms = config.get("fms") or {}
        self.rule = fms.get("rule", "FIFO") if fms.get("rule", "FIFO") in RULES else "FIFO"
        self.max_batch = max(1, int(fms.get("max_batch", 10)))       # SETUP rule without MES (what-if)
        self.window_h = max(0.5, float(fms.get("window_h", 8)))     # SETUP rule: due-date window
        for m in self.machines:
            m.configure_products(self.products, self.mix)
        self.buffers = [Buffer(c) for c in config["buffers"]]
        self.buf_by_id = {b.id: b for b in self.buffers}
        self.by_id = {m.id: m for m in self.machines}
        self.pools = {p["id"]: Pool(p) for p in config.get("pools", [])}
        self._wire(config)
        self.handling = Handling(config, self, random.Random(f"{base_seed}-handling"))
        self.order = self._step_order()
        self.sinks = [b for b in self.buffers if b.finished] or [self.buffers[-1]]
        for b in self.sinks:
            b.finished = True
        self.multiplier, self.ideal_rate_h, self.capacity_groups = self._capacity()
        self.sim_time = 0.0
        self.energy_kwh = 0.0
        self.finished_times = deque()
        self.events = deque(maxlen=300)
        self.record_events = record_events
        self.unit_events: list = []          # read and cleared by the MES
        self.side_events: list = []          # MES / ERP messages for the historian
        self.serial_seq = 0
        self.started_v = {v: 0 for v in self.variants}    # units started per model
        self.finished_v = {v: 0 for v in self.variants}   # units into the finished-goods store
        self.last_v, self.run_len = None, 0                # model of the last started unit, run length
        # MES hooks. release_gate(machine, models available) -> (work order id, model), or a
        # text = reason why nothing may start. Without MES the product mix decides.
        self.release_gate = self._default_gate
        # castings of model v still needed (None = no limit); without MES: none for models with mix 0
        self.variant_need = lambda buf, v: 0 if self.mix.get(v, 1) <= 0 else None
        self.wo_due = lambda wo: None               # due time of a work order (EDD rule)

    def window_of(self, due) -> int:
        """SETUP rule: number of the due-date window (orders due in the same window are batched)."""
        if due is None or due >= 1e17:
            return 10**9
        return int(due // (self.window_h * 3600))

    def _default_gate(self, machine, avail):
        """No MES: start the models in the product-mix proportions (what-if simulation)."""
        if not self.variants:
            return ("", None)
        cands = [v for v in self.variants if v in avail and self.mix.get(v, 0) > 0]
        if not cands:
            return "Waiting for castings"
        if self.rule == "SETUP" and self.last_v in cands and self.run_len < self.max_batch:
            return ("", self.last_v)
        total = sum(self.started_v.values()) + 1
        return ("", max(cands, key=lambda v: (self.mix[v] * total - self.started_v[v], -self.variants.index(v))))

    # ----------------------------------------------------------- topology
    def _wire(self, config):
        serial = all("output" not in s for s in config["stations"])
        if serial and len(self.buffers) != len(self.machines) + 1:
            raise ValueError("serial config: number of buffers must be number of stations + 1")
        for i, (m, s) in enumerate(zip(self.machines, config["stations"])):
            m.factory = self
            if serial:
                m.inputs = [(self.buffers[i], 1)]
                m.output = self.buffers[i + 1]
                continue
            try:
                m.inputs = [(self.buf_by_id[x["buffer"]], int(x.get("qty", 1)))
                            for x in s.get("inputs", [])]
                m.output = self.buf_by_id[s["output"]]
            except KeyError as e:
                raise ValueError(f"station {m.id}: unknown buffer {e}") from None
            if not m.inputs:
                raise ValueError(f"station {m.id}: needs at least one input")
            for idx, x in enumerate(s.get("inputs", [])):
                if x.get("alt"):
                    try:
                        m.alts[idx] = {v: self.buf_by_id[b] for v, b in x["alt"].items()}
                    except KeyError as e:
                        raise ValueError(f"station {m.id}: unknown buffer {e}") from None
            for key, attr in (("seize", "seize_pool"), ("release", "release_pool")):
                if s.get(key):
                    if s[key] not in self.pools:
                        raise ValueError(f"station {m.id}: unknown pallet pool {s[key]}")
                    setattr(m, attr, self.pools[s[key]])
        # kanban: the buffers and machines between a kanban machine and its supermarket
        for m in self.machines:
            if not m.kanban:
                continue
            bufs, ms, b = [], [m], m.output
            for _ in range(10):
                bufs.append(b)
                if b.id == m.kanban.get("buffer"):
                    m.kanban_chain = (bufs, ms)
                    break
                nxt = [x for x in self.machines if x.inputs and x.inputs[0][0] is b]
                if not nxt:
                    break
                ms += nxt
                b = nxt[0].output
            if m.kanban_chain is None:
                raise ValueError(f"station {m.id}: kanban buffer {m.kanban.get('buffer')} is not downstream")

    def _feeders(self, buffer_id: str) -> list:
        """Buffers that feed this buffer by AGV (transport source buffers)."""
        return [t.src.id for t in self.handling.transports if t.dst.id == buffer_id]

    def _step_order(self):
        """Downstream stations are stepped first, so space frees up before
        upstream stations try to put parts."""
        producers = {}
        for m in self.machines:
            producers.setdefault(m.output.id, []).append(m)
        depth = {}

        def ups_of(buf_id, seen=()):
            out = list(producers.get(buf_id, []))
            for src in self._feeders(buf_id):
                if src not in seen:
                    out += ups_of(src, seen + (src,))
            return out

        def d(m, seen=()):
            if m.id in depth:
                return depth[m.id]
            if m.id in seen:
                return 0
            ups = [p for b, _ in m.inputs for p in ups_of(b.id)]
            depth[m.id] = 1 + max((d(p, seen + (m.id,)) for p in ups), default=0)
            return depth[m.id]

        for m in self.machines:
            d(m)
        return sorted(self.machines, key=lambda m: -depth[m.id])

    def _capacity(self):
        """Units of each buffer needed per finished product, and the ideal
        output rate of the whole factory (products per hour)."""
        mult = {b.id: 1.0 for b in self.sinks}
        changed = True
        while changed:
            changed = False
            for t in self.handling.transports:          # AGV moves do not change quantities
                if t.dst.id in mult and mult.get(t.src.id) != mult[t.dst.id]:
                    mult[t.src.id] = mult[t.dst.id]
                    changed = True
            for m in self.machines:
                if m.output.id in mult:
                    for b, q in m.inputs:
                        v = mult[m.output.id] * q
                        if mult.get(b.id) != v:
                            mult[b.id] = v
                            changed = True
        for m in self.machines:                         # model-specific stores (tank 100/300/500 L)
            for idx, alts in m.alts.items():
                base = m.inputs[idx][0]
                for ab in alts.values():
                    mult.setdefault(ab.id, mult.get(base.id, 1.0))
        groups = {}
        for m in self.machines:
            key = (m.output.id, tuple(sorted((b.id, q) for b, q in m.inputs)))
            groups.setdefault(key, []).append(m)
        cap = []
        for key, ms in groups.items():
            k = mult.get(key[0], 1.0)
            rate = sum(3600.0 / m.total_time for m in ms) / k
            cap.append({"stations": [m.id for m in ms], "products_per_h": rate})
        ideal = min((c["products_per_h"] for c in cap), default=0.0)
        return mult, ideal, cap

    # ------------------------------------------------------- MES hooks
    def unit_event(self, kind: str, item: dict | None, machine, sim_t: float, **kw):
        if self.track and item is not None:
            self.unit_events.append({"k": kind, "t": sim_t, "item": item,
                                     "st": machine.id if machine else None, **kw})

    def assign_serial(self, item: dict, machine, wo: str, sim_t: float):
        self.serial_seq += 1
        v = item.get("v")
        item["sn"] = f"{v or machine.serial_prefix}-{self.serial_seq:06d}"
        item["wo"] = wo or None
        item["start_t"] = round(sim_t)
        if v in self.started_v:
            self.started_v[v] += 1
            self.run_len = self.run_len + 1 if v == self.last_v else 1
            self.last_v = v
        self.unit_event("start", item, machine, sim_t)

    # ---------------------------------------------------------- simulation
    def step(self, dt: float) -> list:
        new_events: list = []
        for m in self.order:
            m.step(dt, self.sim_time, new_events)
        self.handling.step(dt, self.sim_time, new_events)
        for b in self.sinks:
            if b.arrivals:
                for it in b.arrivals:
                    self.finished_times.append(self.sim_time)
                    if it.get("v") in self.finished_v:
                        self.finished_v[it["v"]] += 1
                    if self.track:
                        self.unit_events.append({"k": "fg", "t": self.sim_time, "item": it, "st": b.id})
                b.arrivals.clear()
        self.energy_kwh += sum(m.power for m in self.machines) * dt / 3600.0
        self.sim_time += dt
        while self.finished_times and self.finished_times[0] < self.sim_time - 3600:
            self.finished_times.popleft()
        if self.record_events:
            self.events.extend(new_events)
        return new_events

    @property
    def finished_goods(self) -> int:
        return sum(b.received for b in self.sinks)

    @property
    def wip(self) -> int:
        inner = sum(b.count for b in self.buffers
                    if not b.infinite and not b.finished and not b.store)
        return inner + sum(1 for m in self.machines if m.has_part) + self.handling.wip
