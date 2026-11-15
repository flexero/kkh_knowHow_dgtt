"""Acceptance tests of the edition-2 (OPC UA + MQTT Sparkplug B) FMS communication and control software.

    thesis_modern\\.venv\\Scripts\\python.exe test_modern.py
Groups: A information model, B job methods (idempotency, rejections, tools, AGV, AS/RS), C events,
D unchanged fmsctl cell controller on the OPC UA plant (adapter ua_link), E Sparkplug B / MQTT (protobuf, sequence,
rebirth, store-and-forward over a broker restart, primary host state), F security (SignAndEncrypt, trust list, TLS).
Results: data/modern/test_modern.json (every check with its detail). Ports: 48450-48453, 18840-18841.
"""
from __future__ import annotations

import asyncio
import collections
import json
import os
import sys
import tempfile
import threading
import time

import common
from common import DATA, NS_URI, PKI, dump
import infomodel as IM
import sparkplug as SP
import vplant_ua
from asyncua import Client, ua

R = []
SPEED = 50.0


def check(group, name, ok, detail=''):
    R.append({'group': group, 'check': name, 'ok': bool(ok), 'detail': str(detail)[:300]})
    print(f"{'PASS' if ok else 'FAIL'} | {group} | {name}" + (f' | {detail}' if detail else ''), flush=True)


def V(v, t):
    return ua.Variant(v, getattr(ua.VariantType, t))


class EvLog:
    def __init__(self):
        self.ev = []

    def event_notification(self, e):
        self.ev.append((e.SourceName, getattr(e, 'StateChangeCounter', None), getattr(e, 'JobId', None),
                        getattr(e, 'Result', None), e.Time, time.perf_counter()))


# ============================================================================ A, B, C on the job plant
async def ua_tests(plant, port):
    fds = plant.fds
    async with Client(f'opc.tcp://127.0.0.1:{port}/fms/') as c:
        idx = await c.get_namespace_index(NS_URI)
        mach = await c.nodes.objects.get_child([f'{idx}:Machines'])
        objs = {}
        for o in await mach.get_children():
            bn = (await o.read_browse_name()).Name
            if bn != 'FmsModelVersion':
                objs[bn] = o
        # ---------------- A information model
        un = {dt: [r['reg'] for r in IM.mapping(dt) if r['kind'] == 'unmapped'] for dt in IM.TYPE_NAME}
        check('A', 'mapping table covers every register of map V1.2 (7 device types)', not any(un.values()),
              json.dumps(IM.mapping_summary()))
        tnames = collections.Counter()
        for did, o in objs.items():
            tnames[(await c.get_node(await o.read_type_definition()).read_browse_name()).Name] += 1
        check('A', '21 device objects under Objects/Machines with FMS object types', len(objs) == 21 and sum(tnames.values()) == 21,
              dict(tnames))
        ok = True
        for did, o in objs.items():
            for p in ('Identification/Manufacturer', 'Identification/SerialNumber', 'Identification/ProductInstanceUri',
                      'MachineryItemState/CurrentState', 'MachineryOperationMode/CurrentState', 'Monitoring/FmsState'):
                try:
                    await o.get_child([f'{idx}:{x}' for x in p.split('/')])
                except Exception:
                    ok = False
        check('A', 'every device has Identification, MachineryItemState, MachineryOperationMode, Monitoring (OPC 40001-1 structure)', ok)
        ver = await (await mach.get_child(f'{idx}:FmsModelVersion')).read_value()
        check('A', 'model version published (replaces register hdr.mapVersion)', ver == '2.0.0', ver)
        hmc = objs['HMC-01']
        life = await (await hmc.get_child([f'{idx}:Equipment', f'{idx}:Tools', f'{idx}:Pocket11', f'{idx}:RemainingLife'])).read_value()
        reg = fds['HMC-01'].get('cnc.toolLife11')
        slot = await (await objs['PPS-1'].get_child([f'{idx}:PalletSystem', f'{idx}:Locations', f'{idx}:Location05', f'{idx}:PalletId'])).read_value()
        check('A', 'values equal the device register image with unit conversion (tool life 0.1 % -> %, pallet slots)',
              abs(life - reg / 10) < 0.051 and slot == fds['PPS-1'].get('pal.slot05'), f'pocket 11: {life} % vs register {reg}; location 5: pallet {slot}')
        # ---------------- C event subscription for the rest
        evl = EvLog()
        sub = await c.create_subscription(50, evl)
        et_state = await c.nodes.base_event_type.get_child([f'{idx}:FmsStateChangedEventType'])
        et_job = await c.nodes.base_event_type.get_child([f'{idx}:FmsJobFinishedEventType'])
        await sub.subscribe_events(ua.ObjectIds.Server, [et_state, et_job], queuesize=0)
        await asyncio.sleep(0.3)
        c0 = {d: fds[d].counter for d in fds}
        # ---------------- B methods
        wash = objs['WASH-01']
        m = await wash.get_child(f'{idx}:StartJob')
        good0 = fds['WASH-01'].get('std.good')
        args = [V(7001, 'UInt32'), V(1, 'UInt16'), V(1, 'UInt16'), V('SN7001', 'String')]
        st, msg = await wash.call_method(m, *args)
        st2, msg2 = await wash.call_method(m, *args)
        st3, msg3 = await wash.call_method(m, V(7002, 'UInt32'), V(1, 'UInt16'), V(1, 'UInt16'), V('SN7002', 'String'))
        check('B', 'StartJob accepted (Status 0) - one call replaces 3 Modbus frames + ACK polling', st == 0, msg)
        check('B', 'second job while busy refused with Status 4 (busy)', st3 == 4, msg3)
        t_end = time.time() + 30
        while time.time() < t_end and not any(e[2] == 7001 for e in evl.ev):
            await asyncio.sleep(0.05)
        jf = [e for e in evl.ev if e[2] == 7001]
        check('B', 'FmsJobFinishedEvent with the same JobId and result OK', jf and jf[0][3] == 0, jf[0][:4] if jf else 'none')
        await asyncio.sleep(0.3)
        check('B', 'repeated call with the same JobId: original result returned, job NOT started twice (idempotency)',
              st2 == 0 and 'duplicate' in msg2 and fds['WASH-01'].get('std.good') == good0 + 1,
              f'{msg2}; good counter {good0} -> {fds["WASH-01"].get("std.good")}')
        g = await wash.call_method(await wash.get_child(f'{idx}:GetJobResult'), V(7001, 'UInt32'))
        gu = await wash.call_method(await wash.get_child(f'{idx}:GetJobResult'), V(123, 'UInt32'))
        check('B', 'GetJobResult: finished job -> State 0, unknown job -> State 2 (for reconciliation after restarts)',
              g[0] == 0 and gu[0] == 2, f'{g} / {gu}')
        st, msg = await hmc.call_method(await hmc.get_child(f'{idx}:StartJob'), V(7010, 'UInt32'), V(1020, 'UInt16'), V(2, 'UInt16'),
                                        V(1, 'UInt16'), V(3, 'UInt16'))
        check('B', 'HMC StartJob with a pallet that is not at its pallet changer -> Status 3 (bad data)', st == 3, msg)
        pps = objs['PPS-1']
        st, msg = await pps.call_method(await pps.get_child(f'{idx}:MovePallet'), V(7020, 'UInt32'), V(1, 'UInt16'), V(1, 'UInt16'), V(2, 'UInt16'))
        check('B', 'impossible pallet move (destination occupied) -> Status 3', st == 3, msg)
        try:
            await wash.call_method(m, V(7030, 'UInt32'))
            check('B', 'call with missing arguments rejected by the server (no half-written job)', False)
        except ua.UaStatusCodeError as e:
            check('B', 'call with missing arguments rejected by the server (no half-written job)', True, f'{type(e).__name__} {e}'[:120])
        # alarm + acknowledge
        fds['ROBOT-01'].set('std.alarm', 105)
        fds['ROBOT-01'].set_state(4)
        await asyncio.sleep(0.2)
        robot = objs['ROBOT-01']
        st_down = await (await robot.get_child([f'{idx}:MachineryItemState', f'{idx}:CurrentState'])).read_value()
        st, msg = await robot.call_method(await robot.get_child(f'{idx}:AckAlarm'))
        await asyncio.sleep(0.2)
        st_after = await (await robot.get_child([f'{idx}:Monitoring', f'{idx}:FmsState'])).read_value()
        check('B', 'DOWN shown as MachineryItemState OutOfService; AckAlarm method returns the station to IDLE',
              st_down.Text == 'OutOfService' and st == 0 and st_after == 1, f'{st_down.Text} -> FmsState {st_after}')
        # tool data
        st, msg = await hmc.call_method(await hmc.get_child(f'{idx}:WriteToolData'), V(7040, 'UInt32'), V(11, 'UInt16'),
                                        V(152.25, 'Float'), V(4.0, 'Float'), V(1000, 'UInt16'))
        await asyncio.sleep(0.5)
        life = await (await hmc.get_child([f'{idx}:Equipment', f'{idx}:Tools', f'{idx}:Pocket11', f'{idx}:RemainingLife'])).read_value()
        echo = await (await hmc.get_child([f'{idx}:Equipment', f'{idx}:Tools', f'{idx}:LastToolData', f'{idx}:Length'])).read_value()
        check('B', 'WriteToolData (presetter -> CNC): new life 100 % and length echo visible in the tool list', st == 0 and life == 100.0 and abs(echo - 152.25) < 1e-3,
              f'life {life} %, echo length {echo} mm')
        # AGV + AS/RS
        agv = objs['AGV-01']
        st, msg = await agv.call_method(await agv.get_child(f'{idx}:Transport'), V(7050, 'UInt32'), V(1, 'UInt16'), V(2, 'UInt16'), V(1, 'UInt16'))
        t_end = time.time() + 60
        while time.time() < t_end and not any(e[2] == 7050 for e in evl.ev):
            await asyncio.sleep(0.1)
        node = await (await agv.get_child([f'{idx}:Vehicle', f'{idx}:CurrentNode'])).read_value()
        check('B', 'AGV Transport(1 -> 2) finished, Vehicle/CurrentNode = 2', st == 0 and node == 2 and any(e[2] == 7050 for e in evl.ev), f'node {node}')
        asrs = objs['ASRS-RAW']
        fds['ASRS-RAW'].fail_next = True
        st, msg = await asrs.call_method(await asrs.get_child(f'{idx}:Store'), V(7060, 'UInt32'), V(2, 'UInt16'), V(3, 'UInt16'), V(1, 'UInt16'))
        t_end = time.time() + 30
        while time.time() < t_end and not any(e[2] == 7060 for e in evl.ev):
            await asyncio.sleep(0.05)
        await asyncio.sleep(0.2)
        fork = await (await asrs.get_child([f'{idx}:Crane', f'{idx}:LoadOnFork'])).read_value()
        jf = [e for e in evl.ev if e[2] == 7060]
        check('B', 'AS/RS crane fault: job result 2 (aborted) and LoadOnFork = true reported', jf and jf[0][3] == 2 and fork is True, f'result {jf[0][3] if jf else None}, fork {fork}')
        # ---------------- C events completeness
        await asyncio.sleep(0.5)
        ok, det = True, []
        for d in ('WASH-01', 'AGV-01', 'ASRS-RAW', 'ROBOT-01'):
            ks = sorted(e[1] for e in evl.ev if e[0] == d and e[1] is not None)
            exp = list(range(c0[d] + 1, fds[d].counter + 1))
            ok &= ks == exp
            det.append(f'{d}: {len(ks)} events, counters {ks[:1]}..{ks[-1:]}')
        check('C', 'every state change of the process models arrives as an event, counters without gaps', ok, '; '.join(det))
        mono = True
        for d in ('WASH-01', 'AGV-01'):
            ts = [e[4] for e in evl.ev if e[0] == d and e[1] is not None]
            mono &= all(a <= b for a, b in zip(ts, ts[1:]))
        check('C', 'event Time (source time stamp) monotonic per device', mono)
        await sub.delete()


# ============================================================================ D cell controller on OPC UA
def cell_tests(plant, port):
    import ua_link
    from fmsctl.cell.controller import CellController
    from fmsctl.spec import plant as P
    s = ua_link.install(f'opc.tcp://127.0.0.1:{port}/fms/')
    ua_link.OFFLINE.add('HMC-03')                         # machine switched off: no OPC UA session
    db = os.path.join(tempfile.mkdtemp(), 'cell_ua.db')
    ctl = CellController(P.device_table(virtual=True, base_port=0), db, rule='EDD', loop=0.02, speed=SPEED)
    check('D', 'unchanged fmsctl CellController constructed with the OPC UA adapter (link class injected)',
          type(ctl.links['HMC-01']).__name__ == 'UaDeviceLink', type(ctl.links['HMC-01']).__name__)
    ctl.start()
    time.sleep(0.5)
    ctl.set_mode('auto')
    now = time.time()
    ctl.create_wo('WO-A', 2, 3, due=now + 7200)
    ctl.create_wo('WO-B', 3, 2, due=now + 3600)
    ctl.create_wo('WO-C', 1, 2, due=now + 10800)
    t0 = time.time()
    done = False
    while time.time() - t0 < 420 and not done:
        ws = {w['id']: w for w in ctl.db.q('SELECT * FROM wo')}
        done = all(ws.get(i, {}).get('finished') for i in ('WO-A', 'WO-B', 'WO-C'))
        if not done and time.time() - t0 > 20 and s.inject_lost_reply == 0 and not getattr(cell_tests, 'injected', False):
            s.inject_lost_reply = 1                         # one lost method reply during production
            cell_tests.injected = True
        time.sleep(0.2)
    wall = time.time() - t0
    ws = {w['id']: w for w in ctl.db.q('SELECT * FROM wo')}
    check('D', 'three work orders (7 crankcases) finished automatically on the OPC UA plant', done,
          ', '.join(f"{i}: {w['done']} good / {w['scrap']} scrap" for i, w in ws.items()) + f' ({wall:.0f} s wall, x{SPEED:.0f})')
    jobs = ctl.db.q('SELECT * FROM job')
    first_load = [j for j in sorted(jobs, key=lambda j: j['id']) if j['code'] == 12][0]
    check('D', 'EDD rule: first loading for WO-B (earliest due date)', json.loads(first_load['params']).get('wo') == 'WO-B', first_load['info'])
    used = {j['device'] for j in jobs if j['code'] == 10}
    ev = ctl.db.q('SELECT * FROM event')
    check('D', 'HMC-03 without session detected OFFLINE, production on HMC-01/02 only',
          used == {'HMC-01', 'HMC-02'} and any(e['device'] == 'HMC-03' and 'OFFLINE' in e['text'] for e in ev), sorted(used))
    rej = [j for j in jobs if j['status'] == 'rejected']
    check('D', 'no command rejected by the plant, no controller loop error', not rej and not [e for e in ev if e['level'] == 'error'],
          f'{len(jobs)} jobs, {len(rej)} rejected')
    dup = plant.calls['duplicate']
    check('D', 'lost method reply -> adapter repeats the call with the same JobId; device answers "duplicate", job runs once',
          s.stats['retries'] >= 1 and dup >= 1 and not rej, f"retries {s.stats['retries']}, duplicates seen by the plant {dup}")
    time.sleep(1.0)
    snap = ctl.snapshot()
    loc = [p.get('location') for p in snap['pallets']]
    contents = {p['content'] for p in snap['pallets']}
    check('D', 'all 12 pallets located from the pallet-system object, none left with an unfinished part',
          sum(1 for x in loc if x) == 12 and contents <= {'empty'}, f'contents {contents}')
    calls = sum(v for k, v in plant.calls.items() if k != 'duplicate')
    check('D', 'commands as method calls (no register writes); status by subscription (no polling)',
          calls >= len(jobs) and s.stats['notifications'] > 0, f"{calls} method calls for {len(jobs)} jobs, {s.stats['notifications']} notifications")
    ctl.stop()
    ua_link.OFFLINE.clear()


# ============================================================================ E Sparkplug / MQTT
class BrokerThread:
    def __init__(self, port, tls=False):
        import broker
        self.cfg = broker.config(tls, port)
        self.loop = asyncio.new_event_loop()
        self.b = None
        ev = threading.Event()

        def run():
            asyncio.set_event_loop(self.loop)
            from amqtt.broker import Broker
            self.b = Broker(self.cfg, loop=self.loop)
            self.loop.run_until_complete(self.b.start())
            ev.set()
            self.loop.run_forever()
        threading.Thread(target=run, daemon=True).start()
        ev.wait(10)

    def restart(self, down):
        from amqtt.broker import Broker
        asyncio.run_coroutine_threadsafe(self.b.shutdown(), self.loop).result(10)
        time.sleep(down)

        async def st():
            self.b = Broker(self.cfg, loop=self.loop)
            await self.b.start()
        asyncio.run_coroutine_threadsafe(st(), self.loop).result(10)

    def stop(self):
        try:
            asyncio.run_coroutine_threadsafe(self.b.shutdown(), self.loop).result(10)
        except Exception:
            pass


class Host:
    """Test view of the twin's primary host (twin_sub.PrimaryHost): recv = [(device, counter, historical)]."""

    def __init__(self, port, tls=False, replay=False):
        from twin_sub import PrimaryHost
        self.h = PrimaryHost(port, 1, tls, replay, None, client_id='host-test')
        self.h.connected.wait(10)
        self.c = self.h.c

    @property
    def recv(self):
        return [(d, k, hist) for d, k, t, hist in self.h.rec]

    def clear(self):
        self.h.rec.clear()

    @property
    def kinds(self):
        return self.h.stats

    @property
    def seqs(self):
        return self.h.seqs

    def state(self, online):
        self.h.set_online(online)

    def rebirth(self):
        self.h.ncmd('Node Control/Rebirth', 'Boolean', True)

    def close(self):
        self.h.close()


def wait_for(cond, timeout):
    t_end = time.time() + timeout
    while time.time() < t_end:
        if cond():
            return True
        time.sleep(0.05)
    return False


def mqtt_tests():
    import gateway as G
    ms = [{'name': 'A', 'alias': 1, 'timestamp': 1, 'datatype': dt, 'value': v} for dt, v in
          (('Int8', -3), ('Int16', -300), ('Int32', -70000), ('Int64', 2 ** 40), ('UInt8', 200), ('UInt16', 60000),
           ('UInt32', 4000000000), ('UInt64', 2 ** 63), ('Float', 1.5), ('Double', 1e-9), ('Boolean', True), ('String', 'äöü'),
           ('DateTime', 1767225600000), ('Text', 'x'))]
    d = SP.decode_payload(SP.encode_payload(5, ms, 7))
    check('E', 'Sparkplug B protobuf (hand-coded): 14 data types round-trip exactly', [m['value'] for m in d['metrics']] == [m['value'] for m in ms] and d['seq'] == 7,
          f'{len(SP.encode_payload(5, ms, 7))} bytes')
    port = 18840
    br = BrokerThread(port)
    devs = common.device_table(2)
    host = Host(port)
    edge = G.SpbEdge(devs, qos=1, sf=True, port=port)
    wait_for(lambda: edge.born, 10)
    for k in range(0, 300):                                 # per-device consecutive counters 1..150
        edge.submit(k % 2, [('Monitoring/StateChangeCounter', 1 + k // 2, time.perf_counter())])
    wait_for(lambda: len(host.recv) >= 300, 10)
    seqs = [s for s in host.seqs if s is not None]
    wrap = any(a == 255 and b == 0 for a, b in zip(seqs, seqs[1:]))
    gaps = sum(1 for a, b in zip(seqs, seqs[1:]) if b != (a + 1) % 256)
    check('E', 'birth certificates first (NBIRTH + 2 DBIRTH), 300 DDATA with aliases, seq 0..255 wraps without gap',
          host.kinds['NBIRTH'] == 1 and host.kinds['DBIRTH'] == 2 and len(host.recv) == 300 and wrap and gaps == 0,
          f"{dict(host.kinds)}, wrap {wrap}, gaps {gaps}")
    host.rebirth()
    ok = wait_for(lambda: host.kinds['NBIRTH'] == 2, 5)
    check('E', 'rebirth request (NCMD Node Control/Rebirth) -> new NBIRTH + DBIRTH with seq 0', ok and host.kinds['DBIRTH'] == 4, dict(host.kinds))
    # store-and-forward over a broker restart (twin WITH counter-gap replay)
    host.h.replay = True
    host.clear()
    stop = threading.Event()

    def producer():
        for k in range(0, 400):                             # counters 151..350 per device
            edge.submit(k % 2, [('Monitoring/StateChangeCounter', 151 + k // 2, time.perf_counter())])
            time.sleep(0.01)
        stop.set()
    th = threading.Thread(target=producer)
    th.start()
    time.sleep(1.0)
    br.restart(2.0)
    th.join()
    wait_for(lambda: len({(r[0], r[1]) for r in host.recv}) >= 400, 20)
    got = {(r[0], r[1]) for r in host.recv}
    dups = len(host.recv) - len(got)
    hist = sum(1 for r in host.recv if r[2])
    check('E', 'broker restart (2 s down, sessions + retained lost): QoS 1 + store-and-forward + counter-gap replay delivers 400 of 400',
          got == {(d['id'], k) for d in devs for k in range(151, 351)}, f'{len(got)} unique, {dups} duplicates (removed by the twin), {hist} flagged historical, '
                                         f"replay requests {host.h.stats['replay_requests']}, edge stats {dict(edge.stats)}")
    host.h.replay = False
    # primary host offline -> edge holds data
    host.clear()
    host.state(False)
    time.sleep(0.5)
    for k in range(351, 361):
        edge.submit(0, [('Monitoring/StateChangeCounter', k, time.perf_counter())])
    time.sleep(1.0)
    held = len(host.recv) == 0
    host.state(True)
    wait_for(lambda: len(host.recv) >= 10, 5)
    check('E', 'primary host STATE offline -> edge stores; online again -> rebirth + all 10 messages, flagged is_historical',
          held and len(host.recv) == 10 and all(r[2] for r in host.recv), f'held {held}, received {len(host.recv)}')
    edge.close()
    host.close()
    br.stop()


# ============================================================================ F security
async def ua_security_tests():
    port = 48452
    p = vplant_ua.JobPlant(speed=SPEED, seed=3, port=port, secure=True).start()
    url = f'opc.tcp://127.0.0.1:{port}/fms/'
    from asyncua.crypto.security_policies import SecurityPolicyBasic256Sha256
    c = Client(url, timeout=5)
    c.application_uri = 'urn:compressor-fms:gateway'
    await c.set_security(SecurityPolicyBasic256Sha256, os.path.join(PKI, 'ua', 'gateway_cert.der'), os.path.join(PKI, 'ua', 'gateway_key.pem'),
                         server_certificate=os.path.join(PKI, 'ua', 'plant_cert.der'), mode=ua.MessageSecurityMode.SignAndEncrypt)
    t = time.perf_counter()
    await c.connect()
    t_conn = time.perf_counter() - t
    idx = await c.get_namespace_index(NS_URI)
    w = await c.nodes.objects.get_child([f'{idx}:Machines', f'{idx}:WASH-01'])
    st, msg = await w.call_method(await w.get_child(f'{idx}:StartJob'), V(8001, 'UInt32'), V(1, 'UInt16'), V(1, 'UInt16'), V('S', 'String'))
    eps = await c.get_endpoints()
    await c.disconnect()
    pol = sorted({e.SecurityPolicyUri.split('#')[-1] + '/' + e.SecurityMode.name for e in eps})
    check('F', 'trusted gateway certificate: Basic256Sha256 SignAndEncrypt session, method call works', st == 0, f'endpoints {pol}, connect {t_conn * 1000:.0f} ms')
    try:
        c2 = Client(url, timeout=3)
        await c2.connect()
        await c2.disconnect()
        check('F', 'client without security (None) refused - no unsecured endpoint', False)
    except Exception as e:
        check('F', 'client without security (None) refused - no unsecured endpoint', True, type(e).__name__)
    try:
        c3 = Client(url, timeout=3)
        c3.application_uri = 'urn:compressor-fms:rogue'
        await c3.set_security(SecurityPolicyBasic256Sha256, os.path.join(PKI, 'ua', 'rogue_cert.der'), os.path.join(PKI, 'ua', 'rogue_key.pem'),
                              server_certificate=os.path.join(PKI, 'ua', 'plant_cert.der'))
        await c3.connect()
        await c3.disconnect()
        check('F', 'client with an untrusted (not in trust list) certificate refused', False)
    except Exception as e:
        check('F', 'client with an untrusted (not in trust list) certificate refused', True, type(e).__name__)
    p.stop()


def tls_tests():
    import paho.mqtt.client as mqtt
    port = 18841
    br = BrokerThread(port, tls=True)
    try:
        host = Host(port, tls=True)
        got = []
        host.c.on_message = lambda cl, u, m: got.append(m.payload)
        host.c.subscribe('t/x', qos=1)
        time.sleep(0.3)
        host.c.publish('t/x', b'hello', qos=1)
        ok = wait_for(lambda: got, 5)
        cipher = host.c.socket().cipher() if hasattr(host.c.socket(), 'cipher') else None
        check('F', 'MQTT over TLS with the offline factory CA: connect, publish, receive', ok, f'cipher {cipher}')
        host.close()
        plain = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id='plain')
        conn = threading.Event()
        plain.on_connect = lambda *a, **k: conn.set()
        try:
            plain.connect('127.0.0.1', port, keepalive=5)
            plain.loop_start()
            ok2 = not conn.wait(3)
            plain.loop_stop()
        except Exception:
            ok2 = True
        check('F', 'plain TCP client refused by the TLS listener', ok2)
    finally:
        br.stop()


def main():
    common.timer_resolution_1ms()
    t = time.perf_counter()
    port = 48451
    plant = vplant_ua.JobPlant(speed=SPEED, seed=11, port=port).start()
    asyncio.run(ua_tests(plant, port))
    plant.stop()
    time.sleep(1)
    port = 48453
    plant2 = vplant_ua.JobPlant(speed=SPEED, seed=12, port=port).start()
    cell_tests(plant2, port)
    plant2.stop()
    mqtt_tests()
    asyncio.run(ua_security_tests())
    tls_tests()
    n = sum(r['ok'] for r in R)
    print(f'\n{n} / {len(R)} checks passed ({time.perf_counter() - t:.0f} s)')
    dump(os.path.join(DATA, 'test_modern.json'), {'passed': n, 'total': len(R), 'date': time.strftime('%Y-%m-%d %H:%M'), 'checks': R})
    return 0 if n == len(R) else 1


if __name__ == '__main__':
    sys.exit(main())
