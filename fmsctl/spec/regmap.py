"""Register map V1.2 for the compressor FMS – the contract between every machine PLC and the FMS control system.

V1.2 = map V1.1 of the factory design (guide 43 / 47: FAST 0-11, COUNTERS 20-45, ENERGY 100-103, COMMAND 200-226,
gateway heartbeat 226) UNCHANGED, plus
  EVENT   104-131  change counter, last-change time stamp, 8-entry event ring (thesis chapter 5, Table 5.2)
  TYPE    300-399  device-type status (CNC, pallet system, load station, AGV, AS/RS, test bench, generic station)
  JOB     400-449  device-type command parameters, executed with the V1.1 toggle-bit handshake (cmd.code >= 10)
Conventions as V1.1: holding registers (FC03, also FC04), 0-based; UINT32 / REAL = 2 registers, high word first
(REAL big-endian "ABCD"); ASCII20 = 10 registers; 2-register values start at even offsets; writes (FC06 / FC16)
only to 200-226 and 400-449; other addresses -> exception 02 (write) – reads of gaps return 0.
V1.2a = V1.2 + sequence guard (a REQ toggle with cmd.seq == hs.ackSeq is ignored).
V1.2b = V1.2a + AS/RS (final thesis item F3): commands 32 relocate / 33 park, status 304 - 309 (crane state, detail code,
x / z position), job parameters 405 - 409 (source location, crate id). ADDITIVE ONLY - no existing address changed, so the
header value stays 0x0102. PLC templates: input AllowedCmdsHi (bits for codes 32 - 63) in FB_FmsIf_V12.
ALL VALUES ARE EXAMPLES until the machine makers confirm them. Standard library only.
"""
from __future__ import annotations

import struct

MAP_VERSION = 0x0102
MAP_SIZE = 450
WRITABLE = [(200, 226), (400, 449)]
NREG = {'UINT16': 1, 'INT16': 1, 'UINT32': 2, 'REAL': 2, 'ASCII20': 10}

TYPE_CODES = {'CNC': 1, 'PALLET': 2, 'LOAD': 3, 'STATION': 4, 'TEST': 5, 'AGV': 6, 'ASRS': 7}

# ---------------------------------------------------------------- common blocks (identical to V1.1 + event block)
COMMON = [
    (0, 'hdr.mapVersion', 'UINT16', '', 'R', 'map version 0x0102 = V1.2 (V1.1 + event block + type blocks)'),
    (1, 'hdr.typeCode', 'UINT16', '', 'R', 'device type: 1 CNC, 2 pallet system, 3 load station, 4 station, 5 test bench, 6 AGV, 7 AS/RS'),
    (2, 'hdr.unitId', 'UINT16', '', 'R', 'unit id (plausibility: wrong IP / cable)'),
    (3, 'hdr.heartbeat', 'UINT16', '', 'R', '+1 every second, wraps 65535 -> 0; frozen = PLC program stopped'),
    (4, 'std.status', 'UINT16', '', 'R', 'bit0 run, bit1 idle, bit2 set-up, bit3 alarm, bit4 e-stop (copy), bit5 blocked, bit6 starved, bit7 no shift'),
    (5, 'std.mode', 'UINT16', '', 'R', '0 manual, 1 auto, 2 set-up, 3 maintenance'),
    (6, 'std.stateCode', 'UINT16', '', 'R', '0 OFF 1 IDLE 2 RUN 3 SETUP 4 DOWN 5 BLOCKED 6 STARVED'),
    (7, 'std.alarm', 'UINT16', '', 'R', 'alarm code, 0 = none'),
    (8, 'hs.status', 'UINT16', '', 'R', 'bit0 ACK toggle (= REQ when accepted), bit1 BUSY, bit2 DONE toggle, bit3 REJECT, bit4 READY'),
    (9, 'hs.ackSeq', 'UINT16', '', 'R', 'sequence number of the last accepted / rejected command'),
    (10, 'hs.result', 'UINT16', '', 'R', '0 OK, 1 unknown command, 2 not ready, 3 bad data, 4 busy'),
    (11, 'hs.lotDone', 'UINT16', 'pcs', 'R', 'pieces done of the current job'),
    (20, 'std.good', 'UINT32', 'pcs', 'R', 'good parts counter'),
    (22, 'std.scrap', 'UINT32', 'pcs', 'R', 'scrap counter'),
    (24, 'std.lastCycle_s', 'REAL', 's', 'R', 'last cycle time'),
    (26, 'std.order', 'ASCII20', '', 'R', 'current job / work order'),
    (36, 'std.part', 'ASCII20', '', 'R', 'current part code'),
    (100, 'std.power_kW', 'REAL', 'kW', 'R', 'electrical power'),
    (102, 'std.energy_kWh', 'REAL', 'kWh', 'R', 'energy counter'),
    (104, 'evt.counter', 'UINT32', '', 'R', 'number of state changes since power-on (event block, thesis Table 5.2)'),
    (106, 'evt.tLast_ms', 'UINT32', 'ms', 'R', 'PLC time of the last state change'),
] + [(108 + 3 * k, f'evt.ring{k}', 'UINT16', '', 'R', f'event ring entry {k} (newest first): state code; followed by time ms (UINT32, 2 registers)') for k in range(8)] + [
    (200, 'cmd.code', 'UINT16', '', 'RW', '1 load order, 2 start, 3 stop, 4 ack alarm, 5 recipe; 10 run job, 11 move pallet, 12 operator task, 13 start test, 14 tool data, 20 transport, 21 charge, 30 store, 31 retrieve, 32 relocate, 33 park at the maintenance position (AS/RS, V1.2b)'),
    (201, 'cmd.seq', 'UINT16', '', 'RW', 'message counter (+1 per command), copied to hs.ackSeq'),
    (202, 'cmd.ctl', 'UINT16', '', 'RW', 'bit0 REQ toggle – write LAST; device answers ACK = REQ'),
    (203, 'cmd.order', 'ASCII20', '', 'RW', 'work order for command 1'),
    (213, 'cmd.part', 'ASCII20', '', 'RW', 'part code for command 1'),
    (223, 'cmd.recipe', 'UINT16', '', 'RW', 'recipe / NC program no. for commands 1 and 5'),
    (224, 'cmd.lotQty', 'UINT32', 'pcs', 'RW', 'lot quantity for command 1'),
    (226, 'cmd.gwHeartbeat', 'UINT16', '', 'W', 'gateway heartbeat (+1 per second, FC06); PLC watchdog 5 s'),
    # common job block (all device types)
    (390, 'job.idDone', 'UINT32', '', 'R', 'id of the last finished job'),
    (392, 'job.result', 'UINT16', '', 'R', '0 OK, 1 NOK / scrap, 2 aborted, 3 rejected'),
    (394, 'job.cycle_s', 'REAL', 's', 'R', 'duration of the last job'),
    (400, 'job.id', 'UINT32', '', 'RW', 'job id from the cell controller (commands >= 10)'),
    (410, 'job.text', 'ASCII20', '', 'RW', 'serial no. / item code of the job'),
]

# ---------------------------------------------------------------- device-type blocks
TYPE_BLOCKS = {
    'CNC': [
        (300, 'cnc.programNo', 'UINT16', '', 'R', 'running NC program (O-number)'),
        (301, 'cnc.palletWork', 'UINT16', '', 'R', 'pallet id in the working area (0 = none)'),
        (302, 'cnc.palletSetup', 'UINT16', '', 'R', 'pallet id at the pallet-changer set-up side (0 = none / no APC)'),
        (303, 'cnc.toolNo', 'UINT16', '', 'R', 'tool in the spindle'),
        (304, 'cnc.spindleLoad_pct', 'REAL', '%', 'R', 'spindle load'),
        (306, 'cnc.feedOverride_pct', 'UINT16', '%', 'R', 'feed override'),
    ] + [(310 + i, f'cnc.toolLife{i + 1:02d}', 'UINT16', '0.1 %', 'R', f'remaining life of tool pocket {i + 1} (0-1000 = 0-100 %)') for i in range(30)] + [
        (340, 'tool.lastPocket', 'UINT16', '', 'R', 'pocket of the last tool-data command (echo)'),
        (342, 'tool.lastLength_mm', 'REAL', 'mm', 'R', 'length offset written last (echo)'),
        (344, 'tool.lastRadius_mm', 'REAL', 'mm', 'R', 'radius offset written last (echo)'),
        (402, 'job.palletId', 'UINT16', '', 'RW', 'pallet to machine'),
        (402, 'tool.pocket', 'UINT16', '', 'RW', 'command 14 (tool data): magazine pocket 1-30'),
        (404, 'tool.length_mm', 'REAL', 'mm', 'RW', 'command 14: tool length offset from the presetter'),
        (406, 'tool.radius_mm', 'REAL', 'mm', 'RW', 'command 14: tool radius offset from the presetter'),
        (408, 'tool.lifeSet', 'UINT16', '0.1 %', 'RW', 'command 14: remaining life to set (1000 = new tool)'),
        (403, 'job.programNo', 'UINT16', '', 'RW', 'NC program (O-number) – must exist in the CNC memory'),
        (404, 'job.variant', 'UINT16', '', 'RW', '1 VC10, 2 VC20, 3 VC30'),
        (405, 'job.qty', 'UINT16', 'pcs', 'RW', 'parts on the pallet / in the job'),
        (406, 'job.fixtureId', 'UINT16', '', 'RW', 'fixture on the pallet (plausibility check)'),
    ],
    'PALLET': [(300 + i, f'pal.slot{i + 1:02d}', 'UINT16', '', 'R', f'pallet id at location {i + 1} (0 = empty); 1-12 rack, 13 load station, 14-16 HMC 1-3 pallet changer') for i in range(16)] + [
        (320, 'pal.shuttlePos', 'UINT16', '', 'R', 'shuttle location (1-16)'),
        (321, 'pal.shuttleBusy', 'UINT16', '', 'R', '1 = moving'),
    ] + [(330 + i, f'pal.state{i + 1:02d}', 'UINT16', '', 'R', f'state of pallet {i + 1}: 0 empty fixture, 1 raw part, 2 machined, 3 NOK') for i in range(16)] + [
        (402, 'move.palletId', 'UINT16', '', 'RW', 'pallet to move (command 11)'),
        (403, 'move.src', 'UINT16', '', 'RW', 'source location'),
        (404, 'move.dst', 'UINT16', '', 'RW', 'destination location'),
    ],
    'LOAD': [
        (300, 'load.palletId', 'UINT16', '', 'R', 'pallet at the load station'),
        (301, 'load.clamped', 'UINT16', '', 'R', '1 = fixture clamped (pressure switch)'),
        (302, 'load.operatorReady', 'UINT16', '', 'R', '1 = operator pressed READY'),
        (303, 'load.partPresent', 'UINT16', '', 'R', '1 = part present sensor'),
        (402, 'task.type', 'UINT16', '', 'RW', '1 load raw part, 2 unload machined, 3 unload + load, 4 change fixture'),
        (403, 'task.palletId', 'UINT16', '', 'RW', 'pallet of the task'),
        (404, 'task.variant', 'UINT16', '', 'RW', 'variant to load (1-3)'),
    ],
    'STATION': [
        (300, 'st.serialIn', 'ASCII20', '', 'R', 'serial no. of the unit in the station'),
        (404, 'job.variant', 'UINT16', '', 'RW', '1 VC10, 2 VC20, 3 VC30'),
        (405, 'job.qty', 'UINT16', 'pcs', 'RW', 'quantity'),
    ],
    'TEST': [
        (300, 'test.fad_m3h', 'REAL', 'm³/h', 'R', 'free air delivery (ISO 1217)'),
        (302, 'test.power_kW', 'REAL', 'kW', 'R', 'shaft / electrical power'),
        (304, 'test.pmax_bar', 'REAL', 'bar', 'R', 'maximum pressure reached'),
        (306, 'test.noise_dBA', 'REAL', 'dB(A)', 'R', 'sound pressure level at 1 m'),
        (308, 'test.oilTemp_C', 'REAL', '°C', 'R', 'oil temperature at end of test'),
        (310, 'test.verdict', 'UINT16', '', 'R', '0 none, 1 pass, 2 fail'),
        (311, 'test.failCode', 'UINT16', '', 'R', '0 none, 1 FAD low, 2 power high, 3 noise, 4 leak, 5 temperature'),
        (312, 'test.serial', 'ASCII20', '', 'R', 'serial no. of the tested unit'),
        (404, 'job.variant', 'UINT16', '', 'RW', '1 VC10, 2 VC20, 3 VC30'),
    ],
    'AGV': [
        (300, 'agv.node', 'UINT16', '', 'R', 'current / last node'),
        (301, 'agv.targetNode', 'UINT16', '', 'R', 'target node'),
        (302, 'agv.battery_pct', 'UINT16', '%', 'R', 'battery state of charge'),
        (303, 'agv.loaded', 'UINT16', '', 'R', '1 = load on board'),
        (304, 'agv.state', 'UINT16', '', 'R', '0 idle, 1 moving, 2 loading / unloading, 3 charging, 4 error'),
        (402, 'tr.fromNode', 'UINT16', '', 'RW', 'pick-up node (command 20)'),
        (403, 'tr.toNode', 'UINT16', '', 'RW', 'drop node (command 20) / charger node (command 21)'),
        (404, 'tr.loadType', 'UINT16', '', 'RW', '1 casting box, 2 cylinder tray, 3 crankshaft tray, 4 compressor, 5 empty container'),
    ],
    'ASRS': [
        (300, 'asrs.bay', 'UINT16', '', 'R', 'crane bay position (crate column)'),
        (301, 'asrs.level', 'UINT16', '', 'R', 'crane level position'),
        (302, 'asrs.loadOnFork', 'UINT16', '', 'R', '1 = load on the fork'),
        (303, 'asrs.ioReady', 'UINT16', '', 'R', '1 = I/O point free for the next load'),
        (304, 'asrs.craneState', 'UINT16', '', 'R', 'V1.2b: 0 OFF 1 HOMING 2 IDLE 3 MOVE_TO_SOURCE 4 PICK 5 MOVE_TO_DEST 6 PUT 7 RETURN 8 FAULT 9 MANUAL 10 MAINTENANCE'),
        (305, 'asrs.detail', 'UINT16', '', 'R', 'V1.2b: detail of the last job / alarm: 11 range, 12 not possible, 21 double occupancy, 22 source empty, 23 contour, 24 I/O not ready, 31 safety stop, 32 axis, 33 fork'),
        (306, 'asrs.x_mm', 'UINT32', 'mm', 'R', 'V1.2b: travel position (laser)'),
        (308, 'asrs.z_mm', 'UINT16', 'mm', 'R', 'V1.2b: hoist position (barcode positioning)'),
        (402, 'loc.bay', 'UINT16', '', 'RW', 'bay (crate column) of the location (commands 30 / 31 / 32 destination)'),
        (403, 'loc.level', 'UINT16', '', 'RW', 'level of the location'),
        (404, 'loc.side', 'UINT16', '', 'RW', '1 left, 2 right'),
        (405, 'src.bay', 'UINT16', '', 'RW', 'V1.2b: source column (command 32 relocate)'),
        (406, 'src.level', 'UINT16', '', 'RW', 'V1.2b: source level (command 32)'),
        (407, 'src.side', 'UINT16', '', 'RW', 'V1.2b: source side (command 32)'),
        (408, 'crate.id', 'UINT32', '', 'RW', 'V1.2b: crate / handling-unit number (plausibility, barcode item F6)'),
    ],
}


def fields(dtype):
    """Full register list of a device type, sorted by address."""
    return sorted(COMMON + TYPE_BLOCKS[dtype], key=lambda f: f[0])


def index(dtype):
    return {f[1]: (f[0], f[2]) for f in fields(dtype)}


def writable(addr, n=1):
    return all(any(a <= x <= b for a, b in WRITABLE) for x in range(addr, addr + n))


# ---------------------------------------------------------------- codec
def enc(typ, v):
    if typ in ('UINT16', 'INT16'):
        return [int(v) & 0xFFFF]
    if typ == 'UINT32':
        v = int(v) & 0xFFFFFFFF
        return [v >> 16, v & 0xFFFF]
    if typ == 'REAL':
        b = struct.pack('>f', float(v))
        return [int.from_bytes(b[0:2], 'big'), int.from_bytes(b[2:4], 'big')]
    if typ == 'ASCII20':
        b = str(v).encode('ascii', 'replace')[:20].ljust(20, b'\0')
        return [int.from_bytes(b[i:i + 2], 'big') for i in range(0, 20, 2)]
    raise ValueError(typ)


def dec(typ, regs):
    if typ == 'UINT16':
        return regs[0]
    if typ == 'INT16':
        return regs[0] - 65536 if regs[0] > 32767 else regs[0]
    if typ == 'UINT32':
        return (regs[0] << 16) | regs[1]
    if typ == 'REAL':
        return struct.unpack('>f', regs[0].to_bytes(2, 'big') + regs[1].to_bytes(2, 'big'))[0]
    if typ == 'ASCII20':
        return b''.join(r.to_bytes(2, 'big') for r in regs[:10]).rstrip(b'\0').decode('ascii', 'replace')
    raise ValueError(typ)
