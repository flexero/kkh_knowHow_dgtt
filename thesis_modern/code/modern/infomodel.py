"""OPC UA information model of the compressor FMS (namespace urn:compressor-fms:ua:fms, model version 2.0.0),
derived from register map V1.2 (fmsctl/spec/regmap.py) and structured after OPC UA for Machinery (OPC 40001-1)
and OPC UA for Machine Tools (OPC 40501-1):

    Objects/Machines/<DeviceId>                      (FmsMachineToolType, FmsPalletSystemType, ... - see TYPE_NAME)
        Identification/        Manufacturer, Model, SerialNumber, ProductInstanceUri, DeviceClass, Location, ...
        MachineryItemState/    CurrentState  (NotAvailable | OutOfService | NotExecuting | Executing)
        MachineryOperationMode/CurrentState  (None | Maintenance | Setup | Processing)
        Monitoring/            FmsState (0-6), AlarmCode, ElectricalPower, EnergyConsumption, StateChangeCounter, ...
        Production/            ActiveJob/..., LastJob/..., LastCycleTime, PartsGood, PartsScrap, JobActive, ReadyForJob
        Equipment/Tools/       Pocket01..30/RemainingLife, LastToolData/...          (CNC only)
        PalletSystem/, LoadStation/, TestBench/, Vehicle/, Crane/                  (device-type blocks)
        methods                StartJob, MovePallet, OperatorTask, StartTest, Transport, Charge, Store, Retrieve,
                               WriteToolData, AckAlarm, GetJobResult
    Events (emitted through the Server object, SourceNode = device): FmsStateChangedEventType, FmsJobFinishedEventType

Simplification (stated in thesis section 5.4): the companion-specification NodeSet2 files (Opc.Ua.Di, Opc.Ua.Machinery,
Opc.Ua.MachineTool) are not available offline here; the model therefore uses the same browse names and structure in
its own namespace, with object types without instance declarations. With the NodeSet files at hand the same builder
can instantiate the standard types (server.import_xml) - the mapping table does not change.

mapping(dtype) is the machine-readable mapping table (register -> node | method argument | replaced by a UA mechanism).
"""
from __future__ import annotations

import common  # noqa: F401  (puts the project root on sys.path)
from fmsctl.spec import regmap as R

TYPE_NAME = {'CNC': 'FmsMachineToolType', 'PALLET': 'FmsPalletSystemType', 'LOAD': 'FmsLoadStationType',
             'STATION': 'FmsStationType', 'TEST': 'FmsTestBenchType', 'AGV': 'FmsAgvType', 'ASRS': 'FmsAsrsCraneType'}
DEVICE_CLASS = {'CNC': 'MachineTool', 'PALLET': 'PalletSystem', 'LOAD': 'LoadStation', 'STATION': 'AssemblyStation',
                'TEST': 'TestBench', 'AGV': 'AutomatedGuidedVehicle', 'ASRS': 'StorageRetrievalMachine'}
UATYPE = {'UINT16': 'UInt16', 'INT16': 'Int16', 'UINT32': 'UInt32', 'REAL': 'Float', 'ASCII20': 'String'}
ITEM_STATE = {0: 'NotAvailable', 1: 'NotExecuting', 2: 'Executing', 3: 'NotExecuting', 4: 'OutOfService',
              5: 'NotExecuting', 6: 'NotExecuting'}                        # FMS state code -> OPC 40001-1 state
OP_MODE = {0: 'None', 1: 'Processing', 2: 'Setup', 3: 'Maintenance'}       # std.mode -> OPC 40001-1 operation mode
BOOL_FIELDS = {'load.clamped', 'load.operatorReady', 'load.partPresent', 'pal.shuttleBusy', 'agv.loaded',
               'asrs.loadOnFork', 'asrs.ioReady'}

# direct variable mappings: register name -> browse path (relative to the device object)
DIRECT = {
    'std.stateCode': 'Monitoring/FmsState', 'std.alarm': 'Monitoring/AlarmCode', 'std.mode': 'Monitoring/OperationModeCode',
    'std.power_kW': 'Monitoring/ElectricalPower', 'std.energy_kWh': 'Monitoring/EnergyConsumption',
    'evt.counter': 'Monitoring/StateChangeCounter',
    'std.good': 'Production/PartsGood', 'std.scrap': 'Production/PartsScrap', 'std.lastCycle_s': 'Production/LastCycleTime',
    'std.order': 'Production/ActiveJob/Identifier', 'std.part': 'Production/ActiveJob/PartIdentifier',
    'hs.lotDone': 'Production/ActiveJob/RunsCompleted',
    'job.idDone': 'Production/LastJob/JobId', 'job.result': 'Production/LastJob/Result', 'job.cycle_s': 'Production/LastJob/Duration',
    'cnc.programNo': 'Production/ActiveProgram/ProgramNo', 'cnc.palletWork': 'Equipment/PalletChanger/WorkPallet',
    'cnc.palletSetup': 'Equipment/PalletChanger/SetupPallet', 'cnc.toolNo': 'Monitoring/Spindle/ToolInSpindle',
    'cnc.spindleLoad_pct': 'Monitoring/Spindle/Load', 'cnc.feedOverride_pct': 'Monitoring/Channel/FeedOverride',
    'tool.lastPocket': 'Equipment/Tools/LastToolData/Pocket', 'tool.lastLength_mm': 'Equipment/Tools/LastToolData/Length',
    'tool.lastRadius_mm': 'Equipment/Tools/LastToolData/Radius',
    'pal.shuttlePos': 'PalletSystem/Shuttle/Position', 'pal.shuttleBusy': 'PalletSystem/Shuttle/Busy',
    'load.palletId': 'LoadStation/PalletId', 'load.clamped': 'LoadStation/Clamped', 'load.operatorReady': 'LoadStation/OperatorReady',
    'load.partPresent': 'LoadStation/PartPresent', 'st.serialIn': 'Production/ActiveJob/SerialNumber',
    'test.fad_m3h': 'TestBench/LastResult/FreeAirDelivery', 'test.power_kW': 'TestBench/LastResult/Power',
    'test.pmax_bar': 'TestBench/LastResult/MaxPressure', 'test.noise_dBA': 'TestBench/LastResult/SoundPressureLevel',
    'test.oilTemp_C': 'TestBench/LastResult/OilTemperature', 'test.verdict': 'TestBench/LastResult/Verdict',
    'test.failCode': 'TestBench/LastResult/FailCode', 'test.serial': 'TestBench/LastResult/SerialNumber',
    'agv.node': 'Vehicle/CurrentNode', 'agv.targetNode': 'Vehicle/TargetNode', 'agv.battery_pct': 'Vehicle/BatteryCharge',
    'agv.loaded': 'Vehicle/Loaded', 'agv.state': 'Vehicle/VehicleState',
    'asrs.bay': 'Crane/Bay', 'asrs.level': 'Crane/Level', 'asrs.loadOnFork': 'Crane/LoadOnFork', 'asrs.ioReady': 'Crane/IOReady',
}
for _i in range(1, 31):
    DIRECT[f'cnc.toolLife{_i:02d}'] = f'Equipment/Tools/Pocket{_i:02d}/RemainingLife'      # 0.1 % -> %
for _i in range(1, 17):
    DIRECT[f'pal.slot{_i:02d}'] = f'PalletSystem/Locations/Location{_i:02d}/PalletId'
    DIRECT[f'pal.state{_i:02d}'] = f'PalletSystem/Pallets/Pallet{_i:02d}/Content'

# registers replaced by an OPC UA mechanism
REPLACED = {
    'hdr.mapVersion': 'NamespaceMetadata/NamespaceVersion "2.0.0" of the FMS namespace',
    'hdr.typeCode': 'HasTypeDefinition (FmsMachineToolType ...) and Identification/DeviceClass',
    'hdr.unitId': 'endpoint URL + Identification/ProductInstanceUri',
    'hdr.heartbeat': 'session keep-alive and Server/ServerStatus/CurrentTime',
    'std.status': 'MachineryItemState/CurrentState + Monitoring/FmsState (status word not needed)',
    'evt.tLast_ms': 'SourceTimestamp of every value and Time field of every event',
    'hs.status': 'synchronous method result; Production/JobActive and Production/ReadyForJob',
    'hs.ackSeq': 'method call request handle (no application sequence number needed)',
    'hs.result': 'output argument Status of the job method',
    'cmd.code': 'choice of the method (StartJob, MovePallet, ...)',
    'cmd.seq': 'JobId argument (idempotency key)', 'cmd.ctl': 'method call itself (no toggle bit)',
    'cmd.order': 'StartJob argument (station jobs) / not used by FMS jobs', 'cmd.part': 'not used by FMS jobs',
    'cmd.recipe': 'ProgramNo argument', 'cmd.lotQty': 'Quantity argument',
    'cmd.gwHeartbeat': 'session timeout: the device accepts jobs only while a controller session is active',
    'job.id': 'JobId argument of every job method',
    'job.fixtureId': 'checked by the cell controller against the pallet record (not sent to the machine)', 'job.text': 'SerialNumber argument (station, test bench)',
}
for _k in range(8):
    REPLACED[f'evt.ring{_k}'] = 'FmsStateChangedEventType events, queued per monitored item (no 8-entry limit)'

# job methods: name -> (command code, [(argument, ua type, register name or None)], device types)
METHODS = {
    'StartJob@CNC': (10, [('ProgramNo', 'UInt16', 'job.programNo'), ('Variant', 'UInt16', 'job.variant'),
                          ('Quantity', 'UInt16', 'job.qty'), ('PalletId', 'UInt16', 'job.palletId')]),
    'WriteToolData@CNC': (14, [('Pocket', 'UInt16', 'tool.pocket'), ('Length', 'Float', 'tool.length_mm'),
                               ('Radius', 'Float', 'tool.radius_mm'), ('LifeSet', 'UInt16', 'tool.lifeSet')]),
    'StartJob@STATION': (10, [('Variant', 'UInt16', 'job.variant'), ('Quantity', 'UInt16', 'job.qty'),
                              ('SerialNumber', 'String', 'job.text')]),
    'MovePallet@PALLET': (11, [('PalletId', 'UInt16', 'move.palletId'), ('Source', 'UInt16', 'move.src'),
                               ('Destination', 'UInt16', 'move.dst')]),
    'OperatorTask@LOAD': (12, [('TaskType', 'UInt16', 'task.type'), ('PalletId', 'UInt16', 'task.palletId'),
                               ('Variant', 'UInt16', 'task.variant')]),
    'StartTest@TEST': (13, [('Variant', 'UInt16', 'job.variant'), ('SerialNumber', 'String', 'job.text')]),
    'Transport@AGV': (20, [('FromNode', 'UInt16', 'tr.fromNode'), ('ToNode', 'UInt16', 'tr.toNode'),
                           ('LoadType', 'UInt16', 'tr.loadType')]),
    'Charge@AGV': (21, [('ChargerNode', 'UInt16', 'tr.toNode')]),
    'Store@ASRS': (30, [('Bay', 'UInt16', 'loc.bay'), ('Level', 'UInt16', 'loc.level'), ('Side', 'UInt16', 'loc.side')]),
    'Retrieve@ASRS': (31, [('Bay', 'UInt16', 'loc.bay'), ('Level', 'UInt16', 'loc.level'), ('Side', 'UInt16', 'loc.side')]),
}
STATUS = {0: 'OK', 1: 'unknown command', 2: 'not ready', 3: 'bad data', 4: 'busy'}


def methods_of(dtype):
    """{method name: (code, args)} for one device type (JobId is always the first argument)."""
    return {k.split('@')[0]: v for k, v in METHODS.items() if k.split('@')[1] == dtype}


def method_for_code(dtype, code):
    for name, (c, args) in methods_of(dtype).items():
        if c == code:
            return name, args
    return None, None


def conv(name):
    if name.startswith('cnc.toolLife'):
        return 'x0.1'
    if name in BOOL_FIELDS:
        return 'bool'
    return ''


def ua_type(name, rtype):
    c = conv(name)
    if c == 'x0.1':
        return 'Float'
    if c == 'bool':
        return 'Boolean'
    if name in ('std.lastCycle_s', 'job.cycle_s'):
        return 'Double'
    return UATYPE[rtype]


def mapping(dtype):
    """Mapping table rows: dict(addr, reg, rtype, kind, target, uatype, conv)."""
    rows, method_args = [], {}
    for mname, (code, args) in methods_of(dtype).items():
        for a, t, reg in args:
            method_args.setdefault(reg, []).append(f'{mname}.{a}')
    seen = set()
    for addr, name, rtype, unit, acc, desc in R.fields(dtype):
        if name in seen:
            continue
        seen.add(name)
        if name in DIRECT:
            rows.append(dict(addr=addr, reg=name, rtype=rtype, kind='variable', target=DIRECT[name],
                             uatype=ua_type(name, rtype), conv=conv(name), unit=unit))
        elif name in method_args:
            rows.append(dict(addr=addr, reg=name, rtype=rtype, kind='method argument', target=', '.join(method_args[name]),
                             uatype='', conv='', unit=unit))
        elif name in REPLACED:
            rows.append(dict(addr=addr, reg=name, rtype=rtype, kind='replaced', target=REPLACED[name], uatype='', conv='', unit=unit))
        else:
            rows.append(dict(addr=addr, reg=name, rtype=rtype, kind='unmapped', target='', uatype='', conv='', unit=unit))
    return rows


def to_ua(name, value):
    c = conv(name)
    if c == 'x0.1':
        return round(value * 0.1, 1)
    if c == 'bool':
        return bool(value)
    return value


def from_ua(name, value):
    c = conv(name)
    if c == 'x0.1':
        return int(round(value * 10))
    if c == 'bool':
        return 1 if value else 0
    return value


# ------------------------------------------------------------------ builder (asyncua)
async def create_types(server, idx):
    """Object types + event types of the FMS namespace (once per server)."""
    from asyncua import ua
    base = server.nodes.base_object_type
    types = {}
    for dt, tname in TYPE_NAME.items():
        types[dt] = await base.add_object_type(idx, tname)
    ev_state = await server.create_custom_event_type(
        idx, 'FmsStateChangedEventType', ua.ObjectIds.BaseEventType,
        [('NewStateCode', ua.VariantType.UInt16), ('OldStateCode', ua.VariantType.UInt16),
         ('StateChangeCounter', ua.VariantType.UInt32), ('MachineryItemState', ua.VariantType.String)])
    ev_job = await server.create_custom_event_type(
        idx, 'FmsJobFinishedEventType', ua.ObjectIds.BaseEventType,
        [('JobId', ua.VariantType.UInt32), ('Result', ua.VariantType.UInt16), ('Duration', ua.VariantType.Double)])
    return types, ev_state, ev_job


class DeviceNodes:
    """Nodes of one device object: var[register name] -> (node, VariantType), extra[path] -> (node, VariantType)."""

    def __init__(self, info, obj):
        self.info, self.obj, self.var, self.extra, self.methods = info, obj, {}, {}, {}


async def build_device(server, idx, parent, info, types, ns_short='fms'):
    """Create the object of one device with all mapped variables; methods are added by the caller (mode-specific)."""
    from asyncua import ua
    dtype = info['type']
    obj = await parent.add_object(idx, info['id'], objecttype=types[dtype].nodeid)
    dn = DeviceNodes(info, obj)
    folders = {'': obj}

    async def folder(path):
        if path in folders:
            return folders[path]
        head, _, leaf = path.rpartition('/')
        p = await folder(head)
        folders[path] = await p.add_object(idx, leaf)
        return folders[path]

    async def var(path, value, vtype):
        head, _, leaf = path.rpartition('/')
        p = await folder(head)
        n = await p.add_variable(idx, leaf, ua.Variant(value, vtype))
        return n
    ident = {'Manufacturer': 'to be confirmed by supplier', 'Model': info.get('desc', '')[:60], 'SerialNumber': f"SN-{info['id']}",
             'ProductInstanceUri': f"urn:compressor-fms:device:{info['id']}", 'DeviceClass': DEVICE_CLASS[dtype],
             'Location': info.get('ip', ''), 'YearOfConstruction': 2027}
    for k, v in ident.items():
        dn.extra[f'Identification/{k}'] = (await var(f'Identification/{k}', v, ua.VariantType.UInt16 if k == 'YearOfConstruction'
                                                     else ua.VariantType.String), None)
    dn.extra['MachineryItemState/CurrentState'] = (await var('MachineryItemState/CurrentState', ua.LocalizedText('NotExecuting'),
                                                             ua.VariantType.LocalizedText), ua.VariantType.LocalizedText)
    dn.extra['MachineryOperationMode/CurrentState'] = (await var('MachineryOperationMode/CurrentState', ua.LocalizedText('Processing'),
                                                                 ua.VariantType.LocalizedText), ua.VariantType.LocalizedText)
    for p in ('Production/JobActive', 'Production/ReadyForJob'):
        dn.extra[p] = (await var(p, False, ua.VariantType.Boolean), ua.VariantType.Boolean)
    for row in mapping(dtype):
        if row['kind'] != 'variable':
            continue
        vt = getattr(ua.VariantType, row['uatype'])
        init = {'String': '', 'Boolean': False, 'Float': 0.0, 'Double': 0.0}.get(row['uatype'], 0)
        dn.var[row['reg']] = (await var(row['target'], init, vt), vt)
    return dn


def mapping_summary():
    """Counts per device type: variables, method arguments, replaced, unmapped."""
    out = {}
    for dt in R.TYPE_BLOCKS:
        rows = mapping(dt)
        out[dt] = {k: sum(1 for r in rows if r['kind'] == k) for k in ('variable', 'method argument', 'replaced', 'unmapped')}
        out[dt]['registers'] = sum(R.NREG[r['rtype']] for r in rows)
    return out


if __name__ == '__main__':
    import json
    import os
    from common import DATA, dump
    s = mapping_summary()
    print(json.dumps(s, indent=1))
    full = {dt: mapping(dt) for dt in R.TYPE_BLOCKS}
    dump(os.path.join(DATA, 'mapping_v12_to_ua.json'), {'summary': s, 'rows': full})
    for dt, rows in full.items():
        un = [r['reg'] for r in rows if r['kind'] == 'unmapped']
        if un:
            print(dt, 'UNMAPPED', un)
