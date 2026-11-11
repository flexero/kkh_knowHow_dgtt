"""
Twin engine - keeps the virtual factory running in a background thread,
synchronised with (simulated or real) data, and publishes snapshots to the UI.
"""

from __future__ import annotations

import json
import threading
import time
from collections import deque

from . import analytics, comm, fms
from .erp import ERP
from .historian import Historian
from .mes import MES
from .model import OFFLINE, Factory
from .plc import PLCNet
from .scada import SCADA

TICK_S = 0.1                 # real seconds between simulation updates
MAX_SUBSTEP = 1.0            # simulation seconds per physics step
EXTERNAL_TIMEOUT_S = 30      # real seconds without data -> machine OFFLINE
TREND_POINTS = 360


class TwinEngine:
    def __init__(self, config_path: str, db_path: str):
        self.config_path = config_path
        with open(config_path, encoding="utf-8") as fh:
            self.config = json.load(fh)
        self.historian = Historian(db_path)
        self.lock = threading.RLock()
        self.cond = threading.Condition()
        self.time_scale = 20.0
        self.paused = False
        self._reset_locked()
        self.snapshot_json = "{}"
        self.version = 0
        self._stop = threading.Event()
        self._step_req: list = []        # (seconds, Event) from the "step" command

    # ------------------------------------------------------------ lifecycle
    def _reset_locked(self, manual: bool = False):
        self.historian.new_run()
        self.factory = Factory(self.config, track=True)
        self.factory.bus = comm.Bus(self.factory)        # message log for the Communication tab
        self.mes = MES(self.factory, self.config, self.historian)
        self.erp = ERP(self.factory, self.mes, self.config, self.historian, manual=manual)
        self.scada = SCADA(self.factory, self.config, self.historian)
        self.plc = PLCNet(self.factory, self.config)
        self.trends = {m.id: deque(maxlen=TREND_POINTS) for m in self.factory.machines}
        self._hist_timer = 0.0
        self._pending_events = []

    def _step(self, d):
        f = self.factory
        evs = f.step(d)
        self.mes.step(d)
        self.erp.step(d)
        self.scada.step(d)
        self.plc.step(d)
        # MES / ERP / SCADA messages go to the historian as well
        if f.side_events:
            evs, f.side_events = evs + f.side_events, []
        return evs

    def start(self):
        threading.Thread(target=self._loop, name="twin-sim", daemon=True).start()

    def stop(self):
        self._stop.set()

    def _loop(self):
        last = time.time()
        pub_timer = 0.0
        while not self._stop.is_set():
            time.sleep(TICK_S)
            now = time.time()
            real_dt = now - last
            last = now
            with self.lock:
                if not self.paused:
                    self._advance(real_dt * self.time_scale)
                stepped = []
                while self._step_req:
                    sec, done = self._step_req.pop(0)
                    self._advance(sec)
                    stepped.append(done)
                self._check_external(now)
            if stepped:
                self._publish()
                for done in stepped:
                    done.set()
                pub_timer = 0.0
            pub_timer += real_dt
            if pub_timer >= 0.5:
                pub_timer = 0.0
                self._publish()

    def _advance(self, sim_dt: float):
        interval = float(self.config.get("history_interval_s", 10))
        while sim_dt > 1e-9:
            d = min(MAX_SUBSTEP, sim_dt)
            self._pending_events += self._step(d)
            sim_dt -= d
            self._hist_timer += d
            if self._hist_timer >= interval:
                self._hist_timer = 0.0
                self._sample()

    def _sample(self):
        f = self.factory
        for m in f.machines:
            self.trends[m.id].append([round(f.sim_time), round(m.temperature, 2),
                                      round(m.vibration, 3), round(m.power, 2)])
        self.historian.write(f.sim_time, f.machines, self._pending_events)
        self._pending_events = []
        # 4 signals per machine (state, temperature, vibration, power): counted, not logged one by one
        m = f.machines[0] if f.machines else None
        if m is not None:
            comm.send(f, 10, f"{len(f.machines)} machines x 4 signals -> historian", {
                "topic": f"plant/{m.id}/telemetry", "state": m.state, "temp_c": round(m.temperature, 1),
                "vib_mm_s": round(m.vibration, 2), "power_kw": round(m.power, 1), "t": round(f.sim_time)},
                count=4 * len(f.machines), log=False)

    def _check_external(self, now):
        for m in self.factory.machines:
            if m.external and (m.last_ingest_wall is None
                               or now - m.last_ingest_wall > EXTERNAL_TIMEOUT_S):
                m.state, m.reason = OFFLINE, "No data from gateway"

    # ------------------------------------------------------------ outputs
    def build_snapshot(self) -> dict:
        f = self.factory
        return {
            "factory_name": f.name,
            "product": self.config.get("product", ""),
            "sim_time": f.sim_time,
            "time_scale": self.time_scale,
            "paused": self.paused,
            "kpis": analytics.line_kpis(f),
            "machines": [analytics.machine_snapshot(m) for m in f.machines],
            "buffers": [b.snapshot() for b in f.buffers],
            "handling": f.handling.snapshot(),
            "mes": self.mes.summary(),
            "erp": self.erp.summary(),
            "fms": {"rule": f.rule, "window_h": f.window_h, "last_v": f.last_v,
                    "finished_v": f.finished_v, "setups": sum(m.setups for m in f.machines)},
            "alarms": analytics.active_alarms(f),
            "events": list(f.events)[-25:][::-1],
        }

    def config_view(self) -> dict:
        """Configuration plus derived geometry (AGV routes, rack sizes) for the 3D view."""
        with self.lock:
            return {**self.config, "_handling": self.factory.handling.layout()}

    # ------------------------------------------------------------ MES / ERP
    def mes_view(self) -> dict:
        with self.lock:
            return self.mes.full()

    def erp_view(self) -> dict:
        with self.lock:
            return self.erp.full()

    def order_view(self, so_id: str | None) -> dict:
        with self.lock:
            d = self.erp.track(so_id or None)
            d["sim_time"] = self.factory.sim_time
            d["paused"] = self.paused
            d["time_scale"] = self.time_scale
            return d

    def unit(self, sn: str) -> dict:
        with self.lock:
            return self.mes.unit(sn)

    def fms_view(self) -> dict:
        with self.lock:
            return fms.view(self.factory, self.mes, self.erp)

    def comm_view(self, since: int = 0) -> dict:
        with self.lock:
            return self.factory.bus.view(since)

    def scada_view(self) -> dict:
        with self.lock:
            return self.scada.view()

    def scada_action(self, body: dict) -> str:
        with self.lock:
            return self.scada.action(body)

    def plc_view(self) -> dict:
        with self.lock:
            return self.plc.view()

    def plc_action(self, body: dict) -> str:
        with self.lock:
            return self.plc.action(body)

    def scada_trend(self, tags: list, hours: float) -> dict:
        with self.lock:
            scada = self.scada
        return scada.trend(tags, max(0.1, min(72.0, hours)))

    def mes_action(self, body: dict) -> str:
        a = body.get("action")
        with self.lock:
            if a == "create_wo":
                qty = int(body.get("qty", 0))
                if qty <= 0:
                    raise ValueError("quantity must be > 0")
                w = self.mes.create_wo(qty, self.factory.sim_time + float(body.get("due_h", 24)) * 3600,
                                       release=bool(body.get("release", False)),
                                       priority=int(body.get("priority", 5)),
                                       product=body.get("product") or None)
                return f"{w['id']} created: {qty} x {w['item']}"
            if a in ("release", "hold", "close"):
                return self.mes.wo_action(body.get("id", ""), a)
            if a in ("mwo_start", "mwo_close"):
                return self.mes.mwo_action(body.get("id", ""), a[4:])
        raise ValueError(f"unknown MES action {a}")

    def erp_action(self, body: dict) -> str:
        a = body.get("action")
        with self.lock:
            if not self.erp.enabled:
                raise ValueError("ERP is not configured (add an 'erp' section to the config)")
            if a == "create_so":
                so = self.erp.create_so(body.get("customer") or "Walk-in customer", int(body.get("qty", 0)),
                                        float(body.get("due_h", 48)), mto=bool(body.get("mto", False)),
                                        auto=bool(body.get("auto", False)), product=body.get("product") or None)
                return f"{so['id']} created: {so['qty']} x {so['sku']}"
            if a == "plan_so":
                return self.erp.plan_so(body.get("id", ""), release=bool(body.get("release", False)))
            if a == "buy_so":
                return self.erp.buy_for_so(body.get("id", ""))
            if a == "receive_now":
                return self.erp.receive_now(body.get("id", ""))
            if a == "so_auto":
                return self.erp.set_so_auto(body.get("id", ""), bool(body.get("auto")))
            if a == "mode":
                return self.erp.set_mode(body.get("mode", ""))
            if a == "create_po":
                po = self.erp.create_po(body.get("sku", ""), int(body.get("qty", 0)))
                return f"{po['id']} ordered"
            if a == "run_mrp":
                r = self.erp.run_mrp("manual")
                return (f"MRP done: {'new ' + r['wo'] + ' (' + str(r['wo_qty']) + ' units)' if r['wo'] else 'no new work order'}"
                        f", {len(r['pos'])} purchase order(s)")
            if a == "settings":
                return self.erp.set(body.get("settings", {}))
            if a == "ship":
                return self.erp.ship_now(body.get("id", ""))
        raise ValueError(f"unknown ERP action {a}")

    def _publish(self):
        with self.lock:
            snap = json.dumps(self.build_snapshot())
        with self.cond:
            self.snapshot_json = snap
            self.version += 1
            self.cond.notify_all()

    def wait_snapshot(self, last_version: int, timeout: float = 15.0):
        with self.cond:
            self.cond.wait_for(lambda: self.version != last_version, timeout=timeout)
            return self.version, self.snapshot_json

    def trend(self, machine_id: str):
        with self.lock:
            if machine_id not in self.trends:
                raise KeyError(machine_id)
            return list(self.trends[machine_id])

    # ------------------------------------------------------------ inputs
    def command(self, cmd: dict) -> str:
        action = cmd.get("action")
        with self.lock:
            if action == "pause":
                self.paused = True
                return "paused"
            if action == "resume":
                self.paused = False
                return "resumed"
            if action == "time_scale":
                self.time_scale = max(1.0, min(600.0, float(cmd.get("value", 1))))
                return f"time scale {self.time_scale:g}x"
            if action == "rule":
                # FMS dispatching rule (which work order / pallet goes first) and max batch size
                f = self.factory
                r = str(cmd.get("value", f.rule)).upper()
                if r not in analytics.RULES:
                    raise ValueError(f"rule must be one of {', '.join(analytics.RULES)}")
                f.rule = r
                if cmd.get("window_h") not in (None, ""):
                    f.window_h = max(0.5, min(168.0, float(cmd["window_h"])))
                extra = f" (batch window {f.window_h:g} h)" if r == "SETUP" else ""
                f.events.append({"t": f.sim_time, "machine": "MES", "level": "info",
                                 "text": f"Dispatching rule set to {r}{extra}"})
                return f"dispatching rule {r}{extra}"
            if action == "pallet_change_s":
                # pallet changer design (APC tab): use the calculated change time in the running twin (not saved)
                v = max(3.0, min(120.0, float(cmd.get("value", 15))))
                ms = [m for m in self.factory.machines if m.pallet_changer]
                if not ms:
                    raise ValueError("no machine with a pallet changer in this factory")
                old = ms[0].handling_s
                for m in ms:
                    m.handling_s = v
                self.factory.events.append({"t": self.factory.sim_time, "machine": "APC", "level": "info",
                                            "text": f"Pallet change time {old:g} s -> {v:g} s on {', '.join(m.id for m in ms)}"})
                return f"pallet change time {old:g} s -> {v:g} s on {len(ms)} machines (until reset)"
            if action == "reset":
                manual = cmd.get("mode") == "manual"
                self._reset_locked(manual=manual)
                return "empty factory in MANUAL mode - enter a customer order" if manual else "factory reset"
            if action == "step":
                # step-by-step: advance the simulated time by N seconds (works while paused).
                # The simulation thread does it (the history database belongs to that thread).
                sec = max(1.0, min(4 * 3600.0, float(cmd.get("value", 60))))
                done = threading.Event()
                self._step_req.append((sec, done))
            else:
                done = None
        if done is not None:
            done.wait(timeout=120)
            return f"+{sec / 60:g} min simulated"
        with self.lock:
            m = self.factory.by_id.get(cmd.get("machine"))
            if m is None:
                raise ValueError("unknown machine")
            msg = m.command(action, cmd.get("value"))
            self.factory.events.append({"t": self.factory.sim_time, "machine": m.id,
                                        "level": "info", "text": f"{m.name}: {msg}"})
            return msg

    def ingest(self, data: dict) -> str:
        items = data if isinstance(data, list) else [data]
        with self.lock:
            for d in items:
                m = self.factory.by_id.get(d.get("machine_id"))
                if m is None:
                    raise ValueError(f"unknown machine_id {d.get('machine_id')}")
                new_events = []
                m.ingest(d, self.factory.sim_time, new_events, time.time())
                comm.send(self.factory, 10, f"Gateway data from {m.name}", d, src="L1", dst="L2")
                self.factory.events.extend(new_events)
                self._pending_events += new_events
        return f"accepted {len(items)} message(s)"

    def what_if(self, req: dict) -> dict:
        with self.lock:
            cfg = json.loads(json.dumps(self.config))
        return analytics.what_if(cfg, req.get("changes", {}),
                                 req.get("hours", 8), req.get("replications", 3))
