"""Device list of the compressor FMS (from the factory design config/factory.json) with IP plan and Modbus addressing.

IP plan [example]: 10.70.<zone>.<host>, Modbus TCP port 502, unit id 1, one VLAN per zone:
  zone 10 FMS crankcase cell · 11 cylinder + crankshaft machining · 12 assembly + test · 13 paint, final, packing ·
  20 material handling (pallet system, AGV access points, AS/RS) · 1 servers (FMS controller 10.70.1.10)
For the virtual plant every device listens on 127.0.0.1:<15100 + n> instead.
"""
from __future__ import annotations

import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')

# id, device type, zone, host, description
DEVICES = [
    ('LOAD-CC', 'LOAD', 10, 11, 'Fixture load / unload station of the crankcase FMS'),
    ('PPS-1', 'PALLET', 10, 10, 'Linear pallet pool system: 12 rack locations, shuttle, serves load station + 3 HMC'),
    ('HMC-01', 'CNC', 10, 21, 'Horizontal machining centre 1 (crankcase), pallet changer'),
    ('HMC-02', 'CNC', 10, 22, 'Horizontal machining centre 2 (crankcase), pallet changer'),
    ('HMC-03', 'CNC', 10, 23, 'Horizontal machining centre 3 (crankcase), pallet changer'),
    ('WASH-01', 'STATION', 10, 31, 'Crankcase washer'),
    ('VMC-01', 'CNC', 11, 21, 'Vertical machining centre (cylinders)'),
    ('HONE-01', 'CNC', 11, 22, 'Honing machine (cylinder bores)'),
    ('LATHE-01', 'CNC', 11, 23, 'CNC lathe (crankshaft)'),
    ('GRIND-01', 'CNC', 11, 24, 'Cylindrical grinder (crankshaft journals)'),
    ('ASSY-01', 'STATION', 12, 21, 'Pump assembly station'),
    ('ROBOT-01', 'STATION', 12, 22, 'Robot station (valve plate / head bolting)'),
    ('TEST-01', 'TEST', 12, 31, 'Performance test bench 1 (ISO 1217 FAD, power, noise, leak)'),
    ('TEST-02', 'TEST', 12, 32, 'Performance test bench 2'),
    ('PAINT-01', 'STATION', 13, 21, 'Paint booth + oven'),
    ('FINAL-01', 'STATION', 13, 22, 'Final assembly (tank, motor, pressure switch)'),
    ('PACK-01', 'STATION', 13, 23, 'Packing station'),
    ('AGV-01', 'AGV', 20, 41, 'Automated guided vehicle 1 (Wi-Fi, Modbus TCP)'),
    ('AGV-02', 'AGV', 20, 42, 'Automated guided vehicle 2'),
    ('ASRS-RAW', 'ASRS', 20, 51, 'AS/RS crane RAW + KIT zones (760 locations, final thesis F3)'),
    ('ASRS-FG', 'ASRS', 20, 52, 'Finished goods AS/RS crane (optional, not in the final F2 layout)'),
]

# AGV nodes [example]: node -> (x, z) in metres on the hall layout
NODES = {1: (-41, 9.6), 2: (-33.2, -12), 3: (-8, -4), 4: (-4, -4), 5: (16, -4), 6: (26, -4), 7: (33, 10), 8: (10, 18), 9: (-17, 15.6), 10: (-14.6, 15.6)}
NODE_NAMES = {1: 'raw AS/RS I/O', 2: 'load station buffer', 3: 'machining out', 4: 'assembly in', 5: 'test in', 6: 'paint in',
              7: 'final out', 8: 'FG AS/RS I/O', 9: 'charger 1', 10: 'charger 2'}


def device_table(virtual=True, base_port=15100):
    out = []
    for n, (did, typ, zone, host, desc) in enumerate(DEVICES):
        out.append({'id': did, 'type': typ, 'ip': f'10.70.{zone}.{host}', 'port_real': 502,
                    'host': '127.0.0.1' if virtual else f'10.70.{zone}.{host}', 'port': base_port + n if virtual else 502,
                    'unit': 1, 'desc': desc})
    return out


def factory_config():
    return json.load(open(os.path.join(ROOT, 'config', 'factory.json'), encoding='utf-8'))


def station_params():
    """Cycle time per variant [s], MTBF [h], MTTR [min], scrap from the design (Table 4.2 of the thesis)."""
    c = factory_config()
    prods = {p['id']: p for p in c['products']}
    out = {}
    for s in c['stations']:
        key = s['id'].split('-')[0]
        cyc = {}
        for i, v in enumerate(('VC10', 'VC20', 'VC30'), start=1):
            cyc[i] = float((prods[v].get('cycle_s') or {}).get(key, s['cycle_time_s']))
        out[s['id']] = {'cycle': cyc, 'mtbf_h': s.get('mtbf_h', 100), 'mttr_min': s.get('mttr_min', 10),
                        'scrap': s.get('base_scrap_rate') or 0.0}
    return out
