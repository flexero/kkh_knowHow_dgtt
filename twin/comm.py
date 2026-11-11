"""
Communication layers - who talks to whom, with which protocol (ISA-95 / automation pyramid).

The twin itself moves data with Python calls and HTTP JSON. This module records every
important message as it WOULD travel in a real smart factory (EDI, B2MML, OPC UA, MQTT,
VDA 5050, IO-Link ...), so the UI can show the end-to-end workflow with live messages.

    customer --EDI--> ERP --B2MML--> MES --OPC UA--> PLC/CNC --IO-Link--> sensors
                         <--------------- confirmations, results, alarms ---------------

All protocol choices are typical examples, not the only possible ones.
"""

from __future__ import annotations

from collections import deque

ORDER = ["EXT", "L4", "L3", "L2", "L1", "L0"]

LAYERS = [
    {"id": "EXT", "level": "Outside", "name": "Customers and suppliers", "time": "days",
     "systems": "customer purchasing, supplier sales, carriers",
     "twin": "Order flow form, ERP tab (simulated customers and suppliers)"},
    {"id": "L4", "level": "Level 4", "name": "ERP - business planning", "time": "days / hours",
     "systems": "sales orders, MRP, purchasing, inventory, cost, invoices",
     "twin": "twin/erp.py - ERP tab"},
    {"id": "L3", "level": "Level 3", "name": "MES - manufacturing operations", "time": "hours / minutes",
     "systems": "work orders, dispatching rule, serial numbers, quality (SPC), maintenance, WMS",
     "twin": "twin/mes.py - MES, FMS and Order flow tabs"},
    {"id": "L2", "level": "Level 2", "name": "SCADA / HMI / historian / digital twin", "time": "seconds",
     "systems": "live view, alarms, trends, AGV fleet manager, AS/RS control",
     "twin": "Live factory tab, data/history.db, twin/analytics.py"},
    {"id": "L1", "level": "Level 1", "name": "Control - PLC, CNC, robot and AGV controllers", "time": "milliseconds",
     "systems": "machine sequence, NC programs, safety, part counters",
     "twin": "twin/model.py (simulated) or a real gateway -> POST /api/ingest"},
    {"id": "L0", "level": "Level 0", "name": "Field - sensors and actuators", "time": "micro- to milliseconds",
     "systems": "vibration, temperature, power meter, flow meter, motors, valves, barcode/RFID",
     "twin": "simulated signals in twin/model.py"},
]

# links between neighbour layers: typical protocols (first = the one used in the workflow below)
LINKS = [
    {"id": "EXT-L4", "a": "EXT", "b": "L4", "net": "Internet (encrypted)",
     "protocols": ["EDI (EDIFACT / X12)", "REST API", "customer / supplier portal"]},
    {"id": "L4-L3", "a": "L4", "b": "L3", "net": "Office IT network -> firewall / DMZ -> plant network",
     "protocols": ["ISA-95 B2MML (XML / JSON)", "REST or SOAP", "message queue (AMQP, Kafka)"]},
    {"id": "L3-L2", "a": "L3", "b": "L2", "net": "Plant network (Ethernet, IEC 62443 zones)",
     "protocols": ["OPC UA", "MQTT / Sparkplug B (Unified Namespace)", "SQL / historian API"]},
    {"id": "L2-L1", "a": "L2", "b": "L1", "net": "Control network (industrial Ethernet, Wi-Fi for AGVs)",
     "protocols": ["OPC UA", "MTConnect (CNC)", "VDA 5050 over MQTT (AGV)", "PROFINET / EtherNet/IP"]},
    {"id": "L1-L0", "a": "L1", "b": "L0", "net": "Field bus and wires",
     "protocols": ["IO-Link", "4-20 mA / 0-10 V", "24 V digital I/O", "PROFINET IO / EtherCAT"]},
]

# end-to-end workflow: (number, from, to, message, protocol, what happens, how this twin does it)
STEPS = [
    (1, "EXT", "L4", "Customer order", "EDI ORDERS or web portal (REST)",
     "The ERP creates a sales order: customer, model, quantity, due date.",
     "POST /api/erp {action: create_so} - Order flow / ERP tab, or random demand"),
    (2, "L4", "L4", "MRP run", "inside the ERP",
     "net = demand + safety stock - free stock - open work orders -> new work orders and purchase orders.",
     "erp.run_mrp() every hour, or the button Run MRP now"),
    (3, "L4", "EXT", "Purchase order", "EDI ORDERS or supplier portal",
     "Material needed during the supplier lead time is ordered.",
     "erp.create_po()"),
    (4, "EXT", "L4", "Delivery and goods receipt", "EDI DESADV + barcode / RFID scan",
     "The supplier delivers. The lot number is booked and the AS/RS crane stores the material.",
     "erp._receive() -> handling.receive()"),
    (5, "L4", "L3", "Work order", "ISA-95 B2MML ProductionSchedule",
     "ERP sends the MES what to make: model, quantity, due date (and the customer order for make-to-order).",
     "mes.create_wo() - POST /api/mes {action: create_wo}"),
    (6, "L3", "L1", "Release and recipe", "OPC UA method call (through SCADA)",
     "The MES dispatching rule (FIFO / EDD / SPT / SETUP) picks the order; the serial station may start units.",
     "mes.wo_action(release) + mes.gate() for every unit"),
    (7, "L3", "L1", "Transport order", "VDA 5050 over MQTT (AGV fleet manager)",
     "Kanban signal: a line-side rack has room -> an AGV gets a pick-up and drop-off order.",
     "handling._assign()"),
    (8, "L1", "L3", "Unit started, serial number", "OPC UA (PLC -> MES)",
     "The load station clamps a casting and marks the serial number; the MES links it to the work order.",
     "factory.assign_serial() -> mes._on_start()"),
    (9, "L3", "L1", "Changeover / NC program", "OPC UA file transfer or MTConnect",
     "A new model arrives: the CNC program, chuck jaws, test limits or a tool set are changed.",
     "machine._changeover() -> state SETUP"),
    (10, "L0", "L2", "Sensor data", "IO-Link / 4-20 mA -> PLC -> OPC UA or MQTT",
     "Temperature, vibration, power and state of every machine, every 10 s, into the historian.",
     "engine._sample() -> data/history.db; real machines: POST /api/ingest"),
    (11, "L1", "L3", "Test result", "OPC UA or MQTT JSON",
     "The test bench sends the measured air flow; the MES checks the spec and updates the SPC chart.",
     "mes._on_test()"),
    (12, "L1", "L3", "Alarm -> maintenance order", "OPC UA Alarms & Conditions",
     "A breakdown (PLC alarm) or a rising vibration trend (twin analytics) creates a maintenance order.",
     "mes._new_mwo()"),
    (13, "L3", "L4", "Production confirmation", "ISA-95 B2MML ProductionPerformance",
     "Each finished unit is reported; the ERP books the finished-goods stock. Completed work orders are closed.",
     "mes._on_fg()"),
    (14, "L4", "EXT", "Shipment and invoice", "EDI DESADV (dispatch advice) + INVOIC",
     "The AS/RS crane picks the units, the truck leaves, the customer gets the delivery note and the invoice.",
     "erp._shipped()"),
]
STEP_BY_N = {s[0]: s for s in STEPS}


class Bus:
    """Records the messages of the running twin (only the live engine has one)."""

    def __init__(self, factory, maxlen: int = 300):
        self.f = factory
        self.log = deque(maxlen=maxlen)
        self.seq = 0
        self.steps = {s[0]: {"count": 0, "last_t": None, "last": None} for s in STEPS}
        self.links = {l["id"]: {"down": 0, "up": 0} for l in LINKS}

    def send(self, n: int, text: str, payload: dict | None = None, count: int = 1,
             log: bool = True, src: str | None = None, dst: str | None = None):
        d = STEP_BY_N[n]
        src = src or d[1]
        dst = dst or d[2]
        t = self.f.sim_time
        st = self.steps[n]
        st["count"] += count
        st["last_t"] = t
        msg = {"id": self.seq + 1, "t": t, "step": n, "src": src, "dst": dst, "msg": d[3],
               "proto": d[4], "text": text, "payload": payload or {}}
        st["last"] = msg
        # count the message on every link it crosses
        i, j = ORDER.index(src), ORDER.index(dst)
        lo, hi = min(i, j), max(i, j)
        for k in range(lo, hi):
            self.links[LINKS[k]["id"]]["down" if j > i else "up"] += count
        if log:
            self.seq += 1
            self.log.append(msg)

    def view(self, since: int = 0) -> dict:
        t = max(1.0, self.f.sim_time)
        steps = []
        for s in STEPS:
            st = self.steps[s[0]]
            steps.append({"n": s[0], "src": s[1], "dst": s[2], "msg": s[3], "proto": s[4], "what": s[5],
                          "twin": s[6], "count": st["count"], "per_h": round(st["count"] / t * 3600, 1),
                          "last_t": st["last_t"], "last": st["last"]})
        links = [{**l, **self.links[l["id"]],
                  "per_h": round((self.links[l["id"]]["down"] + self.links[l["id"]]["up"]) / t * 3600)}
                 for l in LINKS]
        return {"sim_time": self.f.sim_time, "layers": LAYERS, "links": links, "steps": steps,
                "seq": self.seq, "log": [m for m in list(self.log)[-80:] if m["id"] > since][::-1]}


def send(f, n: int, text: str, payload: dict | None = None, **kw):
    """Record a message if this factory has a bus (the what-if copies have none)."""
    b = getattr(f, "bus", None)
    if b is not None:
        b.send(n, text, payload, **kw)
