"""
Material handling - how parts move when no conveyor connects two places.

* Pool       - a fixed number of fixture pallets that circulate in a pallet
               pool system (FMS): a part can only start if a free pallet exists,
               so the pallet count limits work in progress.
* ASRS       - automated storage and retrieval system: a rack plus one stacker
               crane. Every store or retrieval keeps the crane busy for
               `crane_cycle_s`. Retrievals for production go first.
* AGV / AMR  - automated guided vehicles that drive along the aisle, carry a
               load from a source buffer to a destination buffer, wait for the
               crane, load/unload, and go to a charger when the battery is low.
* Transport  - a kanban loop served by the AGV fleet: when the destination has
               room for a full load (or is empty) and the source has parts, a
               transport task is created and the nearest free AGV takes it.

Everything is simulated in the same 1-second steps as the machines.
"""

from __future__ import annotations

import math


class Pool:
    def __init__(self, cfg: dict):
        self.id = cfg["id"]
        self.name = cfg.get("name", self.id)
        self.count = int(cfg.get("count", 6))
        self.free = self.count

    def snapshot(self):
        return {"id": self.id, "name": self.name, "count": self.count, "free": self.free,
                "in_use": self.count - self.free}


class ASRS:
    def __init__(self, cfg: dict, rng):
        self.id = cfg["id"]
        self.name = cfg.get("name", self.id)
        self.cfg = cfg
        self.rng = rng
        self.io = list(cfg.get("io", cfg.get("pos", [0, 0])))
        self.cycle = float(cfg.get("crane_cycle_s", 60))
        self.levels = int(cfg.get("levels", 6))
        self.bays = int(cfg.get("bays", max(4, int(float(cfg.get("length", 20)) / 1.4))))   # crate positions per side along the aisle
        self.slots = int(cfg.get("slots", 2 * self.bays * self.levels))
        self.unit_load = cfg.get("unit_load", {})       # parts per load unit, per buffer
        self.io_capacity = int(cfg.get("io_capacity", 3))  # loads that fit on the I/O conveyor
        self.buffers: list = []
        self.jobs: list = []
        self.cur = None
        self.timer = 0.0
        self.target = [0, 0, 0]
        self.busy_s = 0.0
        self.total_s = 0.0
        self.active_recent = 0.0          # busy share of about the last hour (bottleneck finder)
        self.stores = 0
        self.retrievals = 0

    def request(self, kind: str, on_done=None, label: str = "") -> dict:
        job = {"kind": kind, "on_done": on_done, "done": False, "label": label}
        self.jobs.append(job)
        return job

    def step(self, dt: float):
        self.total_s += dt
        if self.cur is None and self.jobs:
            # production first: retrievals before put-away
            job = next((j for j in self.jobs if j["kind"] == "retrieve"), self.jobs[0])
            self.jobs.remove(job)
            self.cur = job
            self.timer = self.cycle
            self.target = [self.rng.randrange(self.bays), self.rng.randrange(self.levels),
                           self.rng.randrange(2)]
        self.active_recent += ((1.0 if self.cur is not None else 0.0) - self.active_recent) * min(1.0, dt / 3600.0)
        if self.cur is not None:
            self.busy_s += dt
            self.timer -= dt
            if self.timer <= 0:
                job, self.cur = self.cur, None
                job["done"] = True
                if job["kind"] == "store":
                    self.stores += 1
                else:
                    self.retrievals += 1
                if job["on_done"]:
                    job["on_done"]()

    def io_waiting(self) -> int:
        """Loads delivered by AGVs that wait on the I/O conveyor for the crane."""
        return sum(1 for j in self.jobs if j.get("io")) + (1 if self.cur is not None and self.cur.get("io") else 0)

    def loads_used(self) -> int:
        n = 0
        for b in self.buffers:
            ul = max(1, int(self.unit_load.get(b.id, 1)))
            n += math.ceil(b.count / ul)
        return n

    def snapshot(self):
        return {
            "id": self.id, "name": self.name, "busy": self.cur is not None,
            "kind": self.cur["kind"] if self.cur else None,
            "label": self.cur["label"] if self.cur else "",
            "progress": round(1 - self.timer / self.cycle, 3) if self.cur else 0.0,
            "target": self.target, "queue": len(self.jobs), "io_waiting": self.io_waiting(),
            "io_capacity": self.io_capacity,
            "util": round(self.busy_s / self.total_s, 3) if self.total_s else 0.0,
            "slots": self.slots, "used": self.loads_used(),
            "stores": self.stores, "retrievals": self.retrievals, "crane_cycle_s": self.cycle,
            "stock": [{"buffer": b.id, "name": b.name, "count": b.count, "part": b.part,
                       "unit_load": int(self.unit_load.get(b.id, 1))} for b in self.buffers],
        }


class AGV:
    def __init__(self, i: int, pos):
        self.id = f"AGV-{i + 1:02d}"
        self.x, self.z = float(pos[0]), float(pos[1])
        self.state = "IDLE"
        self.path = [[self.x, self.z]]
        self.seg = []
        self.dist = 0.0
        self.total = 0.0
        self.battery = 100.0
        self.task = None
        self.timer = 0.0
        self.idle_s = 0.0
        self.busy_s = 0.0
        self.total_s = 0.0
        self.odometer_m = 0.0
        self.charger = None
        self.park = list(pos)

    def go(self, pts):
        clean = [list(map(float, pts[0]))]
        for p in pts[1:]:
            if math.hypot(p[0] - clean[-1][0], p[1] - clean[-1][1]) > 0.01:
                clean.append(list(map(float, p)))
        self.path = clean
        self.seg = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(clean, clean[1:])]
        self.total = sum(self.seg)
        self.dist = 0.0

    def move(self, dt: float, speed: float) -> bool:
        step = min(speed * dt, self.total - self.dist)
        self.dist += step
        self.odometer_m += step
        d = self.dist
        last = len(self.seg) - 1
        for i, L in enumerate(self.seg):
            if d <= L or i == last:
                a, b = self.path[i], self.path[i + 1]
                f = min(1.0, d / L) if L else 1.0
                self.x, self.z = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
                break
            d -= L
        return self.dist >= self.total - 1e-6


class Transport:
    def __init__(self, cfg: dict, src, dst, src_pt, dst_pt, src_asrs, dst_asrs):
        self.id = cfg["id"]
        self.name = cfg.get("name", f"{src.name} -> {dst.name}")
        self.src, self.dst = src, dst
        self.batch = int(cfg.get("batch", 1))
        self.src_pt, self.dst_pt = list(src_pt), list(dst_pt)
        self.src_asrs, self.dst_asrs = src_asrs, dst_asrs
        self.variant = src.variant          # e.g. VC10 castings: brought only when that model is needed
        self.trips = 0
        self.moved = 0
        self.open_tasks = 0


MOVING = ("TO_PICKUP", "TO_DROP", "TO_CHARGE", "TO_PARK")
BUSY = ("TO_PICKUP", "WAIT_CRANE", "LOADING", "TO_DROP", "UNLOADING")


class Handling:
    def __init__(self, config: dict, factory, rng):
        self.f = factory
        self.rng = rng
        self.auto_ship = False        # what-if: finished goods leave the AS/RS right away
        bufs = factory.buf_by_id
        self.asrs = [ASRS(a, rng) for a in config.get("asrs", [])]
        self.asrs_by_id = {a.id: a for a in self.asrs}
        for b in factory.buffers:
            if b.asrs_id:
                if b.asrs_id not in self.asrs_by_id:
                    raise ValueError(f"buffer {b.id}: unknown AS/RS {b.asrs_id}")
                self.asrs_by_id[b.asrs_id].buffers.append(b)

        a = config.get("agv") or {}
        self.speed = float(a.get("speed_m_s", 1.2))
        self.load_s = float(a.get("load_s", 20))
        self.unload_s = float(a.get("unload_s", 20))
        self.battery_h = float(a.get("battery_h", 8))
        self.charge_h = float(a.get("charge_h", 1.5))
        self.low = float(a.get("low_battery_pct", 25))
        self.aisle_z = float(a.get("aisle_z", 0))
        parks = a.get("park") or [[0, 0]]
        self.chargers = a.get("chargers") or []
        self.charger_used = [None] * len(self.chargers)
        n = int(a.get("count", 0))
        self.agvs = [AGV(i, parks[i % len(parks)]) for i in range(n)]
        for i, v in enumerate(self.agvs):
            v.park = list(parks[i % len(parks)])
            v.battery = 100.0 - 7.0 * i         # not all vehicles need charging at the same time

        st_by_id = {s["id"]: s for s in config["stations"]}
        cfg_by_buf = {b["id"]: b for b in config["buffers"]}

        def point(buf_id, explicit, as_source):
            if explicit:
                return explicit
            b = bufs[buf_id]
            if b.asrs_id:
                return self.asrs_by_id[b.asrs_id].io
            if cfg_by_buf[buf_id].get("pos"):
                return cfg_by_buf[buf_id]["pos"]
            for s in st_by_id.values():          # next to the station that uses it
                if (as_source and s.get("output") == buf_id) or \
                        (not as_source and any(i["buffer"] == buf_id for i in s.get("inputs", []))):
                    return s.get("pos", [0, 0])
            return [0, 0]

        self.transports = []
        for t in config.get("transports", []):
            if t["from"] not in bufs or t["to"] not in bufs:
                raise ValueError(f"transport {t['id']}: unknown buffer")
            src, dst = bufs[t["from"]], bufs[t["to"]]
            self.transports.append(Transport(
                t, src, dst, point(src.id, t.get("from_pt"), True), point(dst.id, t.get("to_pt"), False),
                self.asrs_by_id.get(src.asrs_id), self.asrs_by_id.get(dst.asrs_id)))
        self._dispatch_timer = 0.0
        self.fleet_recent = 0.0           # share of vehicles busy or charging, about the last hour

    # ------------------------------------------------------------- helpers
    def route(self, a, b):
        """Drive to the main aisle, along it, then to the target (Manhattan path)."""
        a, b = list(a), list(b)
        if abs(a[0] - b[0]) < 0.05 or abs(a[1] - b[1]) < 0.05:
            return [a, b]
        return [a, [a[0], self.aisle_z], [b[0], self.aisle_z], b]

    def _free_space(self, tr) -> int:
        d = tr.dst
        if d.asrs_id and d.finished:
            return self.asrs_by_id[d.asrs_id].slots - d.count - d.incoming
        if d.store or d.finished or d.infinite:
            return 10**9
        free = d.capacity - d.count - d.incoming
        if tr.variant and d.per_variant:            # each model has its own places at the line
            free = min(free, d.per_variant - d.count_v(tr.variant) - d.incoming_v.get(tr.variant, 0))
        return free

    def _have_v(self, tr) -> int:
        return tr.dst.count_v(tr.variant) + tr.dst.incoming_v.get(tr.variant, 0)

    def _put(self, buf, items):
        for it in items:
            buf.put(it)
            v = it.get("v")
            if v and buf.incoming_v.get(v):
                buf.incoming_v[v] -= 1
        buf.incoming -= len(items)
        if self.auto_ship and buf.finished and buf.asrs_id:
            for _ in items:
                self.ship(buf, lambda it: None)

    @property
    def wip(self) -> int:
        return sum(len(v.task["items"]) for v in self.agvs if v.task and v.task["items"])

    # ------------------------------------------------ ERP / MES services
    def receive(self, buf, lot: str, qty: int):
        """Goods receipt: put purchased material away into its store."""
        if buf.asrs_id:
            a = self.asrs_by_id[buf.asrs_id]
            ul = max(1, int(a.unit_load.get(buf.id, 1)))
            buf.incoming += qty
            left = qty
            while left > 0:
                k = min(ul, left)
                left -= k

                def done(k=k):
                    buf.add_lot(lot, k)
                    buf.incoming -= k
                a.request("store", done, f"Put-away {buf.name}")
        else:
            buf.add_lot(lot, qty)

    def ship(self, buf, on_item, item=None) -> bool:
        """Take one unit out of a store for shipping (crane retrieval if AS/RS).
        `item` = a specific unit (e.g. one made for this sales order); default: the oldest."""
        if buf.available < 1:
            return False
        buf.reserved += 1
        if item is not None:
            item["_picking"] = True

        def take():
            if item is not None and item in buf.items:
                buf.items.remove(item)
                buf.reserved -= 1
                item.pop("_picking", None)
                return item
            return buf.take(1, reserved=True)[0]

        if buf.asrs_id:
            self.asrs_by_id[buf.asrs_id].request("retrieve", lambda: on_item(take()), f"Shipping {buf.name}")
        else:
            on_item(take())
        return True

    # ----------------------------------------------------------- dispatch
    def _dispatch(self, t):
        idle = [v for v in self.agvs if self._available(v)]
        cands = []
        for tr in self.transports:
            free, avail = self._free_space(tr), tr.src.available
            q = min(tr.batch, free, avail)
            if q <= 0:
                continue
            # the I/O conveyor of an AS/RS only holds a few loads: no new delivery when full
            if tr.dst_asrs and tr.dst_asrs.io_waiting() + tr.open_tasks >= tr.dst_asrs.io_capacity:
                continue
            line_side = not tr.dst.store and not tr.dst.finished
            if tr.variant and line_side:
                # model-specific castings: only when released work orders need that model
                need = self.f.variant_need(tr.dst, tr.variant)
                if need is not None and self._have_v(tr) >= need:
                    continue
            if q < tr.batch:
                have = self._have_v(tr) if tr.variant else tr.dst.count + tr.dst.incoming
                if not (line_side and have == 0):
                    continue
            if tr.variant and line_side and tr.dst.per_variant:
                urg = 1 - self._have_v(tr) / tr.dst.per_variant
            elif line_side:
                urg = 1 - (tr.dst.count + tr.dst.incoming) / max(1, tr.dst.capacity)
            else:
                urg = (tr.src.count - tr.src.reserved) / max(1, tr.src.capacity)
            cands.append((urg, tr, q))
        cands.sort(key=lambda c: -c[0])
        for _, tr, q in cands:
            if not self.agvs:                      # no vehicles configured: instant transfer
                tr.src.reserved += q
                tr.dst.incoming += q
                self._put(tr.dst, tr.src.take(q, reserved=True))
                tr.trips += 1
                tr.moved += q
                continue
            if not idle:
                break
            v = min(idle, key=lambda v: abs(v.x - tr.src_pt[0]) + abs(v.z - tr.src_pt[1]))
            idle.remove(v)
            self._assign(v, tr, q, t)

    def _available(self, v) -> bool:
        if v.task is not None:
            return False
        if v.state in ("IDLE", "TO_PARK"):
            return v.battery > self.low
        return v.state == "CHARGING" and v.battery >= 60

    def _assign(self, v, tr, q, t):
        tr.src.reserved += q
        tr.dst.incoming += q
        if tr.variant:
            tr.dst.incoming_v[tr.variant] = tr.dst.incoming_v.get(tr.variant, 0) + q
        tr.open_tasks += 1
        job = tr.src_asrs.request("retrieve", None, tr.src.name) if tr.src_asrs else None
        v.task = {"tr": tr, "qty": q, "job": job, "items": None, "t0": t}
        if getattr(self.f, "bus", None) is not None:
            from . import comm
            comm.send(self.f, 7, f"{v.id}: {q} x {tr.variant + ' ' if tr.variant else ''}{tr.src.name} -> {tr.dst.name}",
                      {"vda5050": "order", "serialNumber": v.id, "orderId": f"T{self.f.bus.steps[7]['count'] + 1:05d}",
                       "nodes": [tr.src.name, tr.dst.name], "load": {"type": tr.variant or tr.src.name, "qty": q},
                       "battery_pct": round(v.battery)})
        if v.charger is not None:
            self.charger_used[v.charger] = None
            v.charger = None
        v.state = "TO_PICKUP"
        v.go(self.route((v.x, v.z), tr.src_pt))

    # --------------------------------------------------------------- step
    def step(self, dt: float, t: float, events: list):
        for a in self.asrs:
            a.step(dt)
        if not self.transports:
            return
        self._dispatch_timer -= dt
        if self._dispatch_timer <= 0:
            self._dispatch_timer = 2.0
            self._dispatch(t)
        for v in self.agvs:
            self._agv_step(v, dt, t, events)
        if self.agvs:
            # a charging vehicle is not available either, so it counts as busy here
            busy = sum(1 for v in self.agvs if v.state in BUSY or v.state in ("TO_CHARGE", "CHARGING"))
            self.fleet_recent += (busy / len(self.agvs) - self.fleet_recent) * min(1.0, dt / 3600.0)

    def _agv_step(self, v, dt, t, events):
        v.total_s += dt
        if v.state in BUSY:
            v.busy_s += dt
        drain = dt * 100.0 / (self.battery_h * 3600.0)
        if v.state != "CHARGING":
            v.battery = max(0.0, v.battery - (drain if (v.state in MOVING or v.state in BUSY) else drain * 0.15))
        if v.state in MOVING:
            if not v.move(dt, self.speed):
                return
            if v.state == "TO_PICKUP":
                job = v.task["job"]
                if job is not None and not job["done"]:
                    v.state = "WAIT_CRANE"
                else:
                    v.state, v.timer = "LOADING", self.load_s
            elif v.state == "TO_DROP":
                v.state, v.timer = "UNLOADING", self.unload_s
            elif v.state == "TO_CHARGE":
                v.state = "CHARGING"
            elif v.state == "TO_PARK":
                v.state, v.idle_s = "IDLE", 0.0
            return
        if v.state == "WAIT_CRANE":
            if v.task["job"]["done"]:
                v.state, v.timer = "LOADING", self.load_s
        elif v.state == "LOADING":
            v.timer -= dt
            if v.timer <= 0:
                tr = v.task["tr"]
                v.task["items"] = tr.src.take(v.task["qty"], reserved=True)
                v.state = "TO_DROP"
                v.go(self.route(tr.src_pt, tr.dst_pt))
        elif v.state == "UNLOADING":
            v.timer -= dt
            if v.timer <= 0:
                tr, items = v.task["tr"], v.task["items"]
                if tr.dst_asrs:
                    a = tr.dst_asrs
                    ul = max(1, int(a.unit_load.get(tr.dst.id, 1)))
                    for i in range(0, len(items), ul):
                        chunk = items[i:i + ul]
                        job = a.request("store", lambda c=chunk, d=tr.dst: self._put(d, c), f"Store {tr.dst.name}")
                        job["io"] = True
                        job["items"] = chunk          # so the MES can find units on the I/O conveyor
                else:
                    self._put(tr.dst, items)
                tr.trips += 1
                tr.moved += len(items)
                tr.open_tasks -= 1
                v.task = None
                v.state, v.idle_s = "IDLE", 0.0
        elif v.state == "IDLE":
            v.idle_s += dt
            if v.battery <= self.low and None in self.charger_used:
                i = self.charger_used.index(None)
                self.charger_used[i] = v.id
                v.charger = i
                v.state = "TO_CHARGE"
                v.go(self.route((v.x, v.z), self.chargers[i]))
                events.append({"t": t, "machine": v.id, "level": "info",
                               "text": f"{v.id} battery {v.battery:.0f}% - going to charger"})
            elif v.idle_s > 45 and abs(v.x - v.park[0]) + abs(v.z - v.park[1]) > 0.5:
                v.state = "TO_PARK"
                v.go(self.route((v.x, v.z), v.park))
        elif v.state == "CHARGING":
            v.battery = min(100.0, v.battery + dt * 100.0 / (self.charge_h * 3600.0))
            if v.battery >= 98:
                self.charger_used[v.charger] = None
                v.charger = None
                v.state, v.idle_s = "IDLE", 0.0

    # ------------------------------------------------------------ output
    def layout(self) -> dict:
        """Static geometry for the 3D view."""
        return {
            "aisle_z": self.aisle_z,
            "chargers": self.chargers,
            "parks": [v.park for v in self.agvs],
            "transports": [{"id": tr.id, "name": tr.name, "from": tr.src.id, "to": tr.dst.id,
                            "src_pt": tr.src_pt, "dst_pt": tr.dst_pt,
                            "path": self.route(tr.src_pt, tr.dst_pt)} for tr in self.transports],
            "asrs": [{"id": a.id, "bays": a.bays, "levels": a.levels, "slots": a.slots, "io": a.io,
                      "buffers": [b.id for b in a.buffers]} for a in self.asrs],
        }

    def snapshot(self) -> dict:
        agvs = []
        for v in self.agvs:
            load = None
            if v.task and v.task["items"]:
                load = {"part": v.task["tr"].src.part, "qty": len(v.task["items"]), "v": v.task["tr"].variant}
            agvs.append({
                "id": v.id, "state": v.state, "x": round(v.x, 2), "z": round(v.z, 2),
                "path": v.path if v.state in MOVING else None, "dist": round(v.dist, 2),
                "speed": self.speed if v.state in MOVING else 0.0,
                "battery": round(v.battery, 1), "load": load,
                "task": v.task["tr"].name if v.task else "",
                "util": round(v.busy_s / v.total_s, 3) if v.total_s else 0.0,
                "km": round(v.odometer_m / 1000, 2),
            })
        busy = [v.busy_s / v.total_s for v in self.agvs if v.total_s]
        return {
            "agvs": agvs,
            "fleet_util": round(sum(busy) / len(busy), 3) if busy else 0.0,
            "asrs": [a.snapshot() for a in self.asrs],
            "pools": [p.snapshot() for p in self.f.pools.values()],
            "transports": [{"id": tr.id, "name": tr.name, "trips": tr.trips, "moved": tr.moved,
                            "open": tr.open_tasks} for tr in self.transports],
        }
