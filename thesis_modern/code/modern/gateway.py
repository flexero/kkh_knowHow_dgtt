"""Edge gateway / twin client (edition 2): OPC UA subscriptions -> (optional) MQTT Sparkplug B unified namespace.

OPC UA side (asyncua client, one session per server):
  measurement subscriptions (--subs), e.g.  dc:FmsState:q1:p250   data change, queue size 1, publishing interval 250 ms
                                            dc:FmsStateSampled:q10:p1000   variable refreshed every 100 ms by the server
                                            ev:q0:p100            FmsStateChangedEventType events (queue unlimited)
  Every notification is logged with the receive time (perf_counter); the source time stamp identifies the true change.
Sparkplug side (--mqtt): edge node spBv1.0/fms/<NBIRTH|NDEATH|DBIRTH|DDATA>/gw1/<device>, protobuf payloads encoded by
  hand (sparkplug.py), one sequence number 0..255 for all messages of the edge node, bdSeq in NBIRTH / NDEATH (last
  will), aliases in DDATA, rebirth on NCMD "Node Control/Rebirth", primary-host awareness (publishes only while
  spBv1.0/STATE/twin is online) and store-and-forward (--sf): messages are kept until the broker acknowledges them
  (QoS 1/2) and re-sent after a reconnect, flagged is_historical when they were created while offline.
Usage: python gateway.py --n 21 --t0 <perf> --dur 60 --out DIR --subs ev:q0:p100 [--mqtt --qos 1 --sf] [--secure] [--tls]
"""
from __future__ import annotations

import argparse
import asyncio
import collections
import json
import logging
import os
import ssl
import threading
import time

import common
from common import EDGE, GROUP, HOST_ID, MQTT_PORT, MQTT_TLS_PORT, NS_URI, PKI, UA_PERDEV, UA_SINGLE, dt_to_perf, dump, working_set_mb
import sparkplug as SP
from asyncua import Client, ua
from asyncua.crypto.security_policies import SecurityPolicyBasic256Sha256

for _n in ('asyncua', 'asyncua.client', 'asyncua.common'):
    logging.getLogger(_n).setLevel(logging.ERROR)

DC_REGS = {'Monitoring/AlarmCode': 'UInt16', 'Monitoring/OperationModeCode': 'UInt16', 'Production/PartsGood': 'UInt32',
           'Production/PartsScrap': 'UInt32', 'Production/LastCycleTime': 'Double', 'Monitoring/ElectricalPower': 'Float',
           'Monitoring/EnergyConsumption': 'Float'}
METRICS = [('Monitoring/FmsState', 'UInt16'), ('Monitoring/StateChangeCounter', 'UInt32'),
           ('MachineryItemState/CurrentState', 'String')] + list(DC_REGS.items())
ALIAS_LOCAL = {name: k + 1 for k, (name, _) in enumerate(METRICS)}
DTYPE = dict(METRICS)


def alias(i, name):
    return i * 64 + ALIAS_LOCAL[name]                    # unique within the edge node (Sparkplug rule)


def ms(t_perf):
    return int(round((t_perf + 1767225600.0) * 1000))     # perf seconds -> epoch ms (BASE = 2026-01-01)


# ====================================================================== Sparkplug edge node (MQTT, own thread)
class SpbEdge:
    def __init__(self, devices, qos=1, sf=True, tls=False, port=None, rebirth_on_gap=True):
        import paho.mqtt.client as mqtt
        self.mqtt = mqtt
        self.devices, self.qos, self.sf, self.tls = devices, qos, sf, tls
        self.port = port or (MQTT_TLS_PORT if tls else MQTT_PORT)
        self.lock = threading.Lock()
        self.cond = threading.Condition(self.lock)
        self.outbox = collections.deque()
        self.inflight = {}
        self.acks, self.ev = collections.deque(), collections.deque()
        self.client = None
        self.connected = self.host_online = self.born = False
        self.seq, self.bdseq, self.eid = 0, 0, 0
        self.last = {d['i']: {} for d in devices}           # last submitted values (for DBIRTH of devices not yet published)
        self.pub_last = {d['i']: {} for d in devices}       # last PUBLISHED values -> DBIRTH (twin detects lost messages)
        self.hist = {d['i']: collections.OrderedDict() for d in devices}   # StateChangeCounter -> metrics (replay buffer)
        self.dev_index = {d['id']: d['i'] for d in devices}
        self.stats = collections.Counter()
        self.bytes_app = 0
        self.log = []                                     # (event, perf) connection log
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    # ---------------------------------------------- called from the asyncio thread
    def submit(self, i, metrics):
        """metrics: [(name, value, t_perf)]"""
        for name, v, t in metrics:
            self.last[i][name] = (v, t)
            if name == 'Monitoring/StateChangeCounter':
                h = self.hist[i]
                h[v] = metrics
                if len(h) > 4096:
                    h.popitem(last=False)
        with self.cond:
            online = self.connected and self.host_online and self.born
            if not online and not self.sf:
                self.stats['dropped_offline'] += 1
                return
            self.eid += 1
            self.outbox.append((self.eid, i, metrics, not online))
            self.stats['submitted'] += 1
            self.cond.notify()

    # ---------------------------------------------- MQTT thread
    def _next_seq(self):
        s = self.seq
        self.seq = (self.seq + 1) % 256
        return s

    def _pub(self, topic, payload, qos):
        info = self.client.publish(topic, payload, qos=qos)
        self.bytes_app += len(topic) + len(payload)
        return info.mid

    def _connect(self):
        mq = self.mqtt
        c = mq.Client(mq.CallbackAPIVersion.VERSION2, client_id=EDGE, clean_session=True)
        c.max_inflight_messages_set(1000)
        self.bdseq = (self.bdseq + 1) % 256
        death = SP.encode_payload(ms(time.perf_counter()), [{'name': 'bdSeq', 'datatype': 'UInt64', 'value': self.bdseq}])
        c.will_set(SP.topic('NDEATH', group=GROUP, edge=EDGE), death, qos=1)
        if self.tls:
            c.tls_set(ca_certs=os.path.join(PKI, 'mqtt', 'ca_cert.pem'), cert_reqs=ssl.CERT_REQUIRED)
        c.on_connect = lambda cl, u, f, rc, p=None: self._wake(self.ev, ('conn', rc))
        c.on_disconnect = lambda cl, u, f, rc, p=None: self._wake(self.ev, ('disc', rc))
        c.on_publish = lambda cl, u, mid, rc=None, p=None: self._wake(self.acks, mid)
        c.on_message = self._on_message
        c.connect('127.0.0.1', self.port, keepalive=5)
        c.loop_start()
        self.client = c

    def _wake(self, dq, item):
        dq.append(item)                                   # paho thread: never holds self.cond while paho is called
        with self.cond:
            self.cond.notify()

    def _on_message(self, cl, u, msg):
        pt = SP.parse_topic(msg.topic)
        if pt and pt['kind'] == 'STATE':
            try:
                self._wake(self.ev, ('host', bool(json.loads(msg.payload.decode())['online'])))
            except Exception:
                pass
        elif pt and pt['kind'] == 'NCMD':
            for m in SP.decode_payload(msg.payload)['metrics']:
                if m.get('name') == 'Node Control/Rebirth' and m.get('value'):
                    self._wake(self.ev, ('rebirth', None))
                elif m.get('name') == 'Node Control/Replay' and m.get('value'):   # application extension (not in Sparkplug 3.0)
                    try:
                        dev, k1, k2 = str(m['value']).split(':')
                        self._wake(self.ev, ('replay', (self.dev_index[dev], int(k1), int(k2))))
                    except (ValueError, KeyError):
                        pass

    def _teardown(self):
        with self.cond:
            back = sorted(self.inflight.values(), key=lambda e: e[0])
            self.inflight.clear()
            self.outbox.extendleft(reversed([(e[0], e[1], e[2], True) for e in back]))   # re-send, flagged historical
            self.stats['requeued'] += len(back)
            self.connected = self.host_online = self.born = False
        try:
            self.client.loop_stop()
            self.client.disconnect()
        except Exception:
            pass
        self.client = None

    def _births(self):
        t = time.perf_counter()
        self.seq = 0
        nb = [{'name': 'bdSeq', 'datatype': 'UInt64', 'value': self.bdseq},
              {'name': 'Node Control/Rebirth', 'datatype': 'Boolean', 'value': False}]
        self._pub(SP.topic('NBIRTH', group=GROUP, edge=EDGE), SP.encode_payload(ms(t), nb, self._next_seq()), 1)
        for d in self.devices:
            i = d['i']
            mets = [{'name': 'Identification/ProductInstanceUri', 'datatype': 'String', 'value': f"urn:compressor-fms:device:{d['id']}"},
                    {'name': 'Identification/DeviceClass', 'datatype': 'String', 'value': d['type']}]
            for name, dt in METRICS:
                v, tt = self.pub_last[i].get(name) or self.last[i].get(name, (None, t))
                if name == 'Monitoring/StateChangeCounter':
                    v, tt = self.pub_last[i].get(name, (0, t))
                mets.append({'name': name, 'alias': alias(i, name), 'timestamp': ms(tt), 'datatype': dt, 'value': v})
            self._pub(SP.topic('DBIRTH', d['id'], GROUP, EDGE), SP.encode_payload(ms(t), mets, self._next_seq()), 1)
        self.stats['births'] += 1
        self.born = True
        self.log.append(('birth', t))

    def _run(self):
        while self.running:
            if self.client is None:
                try:
                    self._connect()
                except OSError:
                    time.sleep(0.25)
                    continue
            while self.ev:
                k, v = self.ev.popleft()
                if k == 'conn':
                    self.connected = True
                    self.client.subscribe(f'spBv1.0/STATE/{HOST_ID}', qos=1)
                    self.client.subscribe(SP.topic('NCMD', group=GROUP, edge=EDGE), qos=1)
                    self.log.append(('connected', time.perf_counter()))
                elif k == 'disc':
                    self.stats['disconnects'] += 1
                    self.log.append(('disconnected', time.perf_counter()))
                    self._teardown()
                    break
                elif k == 'host':
                    if v != self.host_online:
                        self.born = False                 # offline: hold everything; online again: rebirth first
                    self.host_online = v
                    self.log.append(('host_' + ('online' if v else 'offline'), time.perf_counter()))
                elif k == 'rebirth':
                    self.born = False
                    self.stats['rebirth_requests'] += 1
                elif k == 'replay':
                    i, k1, k2 = v
                    with self.cond:
                        ents = [(0, i, self.hist[i][c], True) for c in range(k1, k2 + 1) if c in self.hist[i]]
                        self.outbox.extendleft(reversed(ents))
                    self.stats['replay_requests'] += 1
                    self.stats['replayed'] += len(ents)
            if self.client is None:
                continue
            while self.acks:
                mid = self.acks.popleft()
                with self.cond:
                    if self.inflight.pop(mid, None) is not None:
                        self.stats['acked'] += 1
            if self.connected and self.host_online and not self.born:
                self._births()
            if self.born and self.host_online and self.connected:
                with self.cond:
                    batch = []
                    while self.outbox and len(self.inflight) + len(batch) < 900:
                        batch.append(self.outbox.popleft())
                for e in batch:
                    eid, i, metrics, hist = e
                    t = time.perf_counter()
                    mets = [{'alias': alias(i, n), 'timestamp': ms(tt), 'datatype': DTYPE[n], 'value': v, 'is_historical': hist}
                            for n, v, tt in metrics]
                    mid = self._pub(SP.topic('DDATA', self.devices[i]['id'], GROUP, EDGE), SP.encode_payload(ms(t), mets, self._next_seq()), self.qos)
                    for n, v, tt in metrics:
                        old = self.pub_last[i].get(n)
                        if n != 'Monitoring/StateChangeCounter' or old is None or v > old[0]:
                            self.pub_last[i][n] = (v, tt)
                    self.stats['published'] += 1
                    if self.qos > 0:
                        with self.cond:
                            self.inflight[mid] = e
            with self.cond:
                if not self.outbox and not self.ev and not self.acks:
                    self.cond.wait(0.1)

    def close(self):
        self.running = False
        with self.cond:
            self.cond.notify()
        self.thread.join(2)
        if self.client:
            try:
                self.client.loop_stop()
                self.client.disconnect()
            except Exception:
                pass


# ====================================================================== OPC UA side
async def connect(url, secure):
    c = Client(url, timeout=10)
    c.application_uri = 'urn:compressor-fms:gateway'
    c.session_timeout = 30000
    if secure:
        await c.set_security(SecurityPolicyBasic256Sha256, os.path.join(PKI, 'ua', 'gateway_cert.der'),
                             os.path.join(PKI, 'ua', 'gateway_key.pem'),
                             server_certificate=os.path.join(PKI, 'ua', 'plant_cert.der'),
                             mode=ua.MessageSecurityMode.SignAndEncrypt)
    await c.connect()
    return c


class DCHandler:
    def __init__(self, label, node_map, sink):
        self.label, self.node_map, self.sink = label, node_map, sink

    def datachange_notification(self, node, val, data):
        t = time.perf_counter()
        i, reg = self.node_map[node.nodeid]
        src = data.monitored_item.Value.SourceTimestamp
        self.sink(self.label, i, reg, val, dt_to_perf(src) if src else None, t)


class EVHandler:
    def __init__(self, label, name_map, sink):
        self.label, self.name_map, self.sink = label, name_map, sink

    def event_notification(self, ev):
        t = time.perf_counter()
        i = self.name_map.get(ev.SourceName)
        if i is not None:
            self.sink(self.label, i, ev, t)


async def run(a):
    common.timer_resolution_1ms()
    devices = common.device_table(a.n)
    name_map = {d['id']: d['i'] for d in devices}
    recv = collections.defaultdict(list)
    edge = SpbEdge(devices, a.qos, a.sf, a.tls, a.mqtt_port) if a.mqtt else None
    pending = collections.defaultdict(dict)
    loop = asyncio.get_running_loop()
    flush_scheduled = [False]

    def flush():
        flush_scheduled[0] = False
        for i, mets in pending.items():
            edge.submit(i, [(n, v, t) for n, (v, t) in mets.items()])
        pending.clear()

    def dc_sink(label, i, reg, val, src, t):
        if label == 'mqtt-dc':
            pending[i][reg] = (val, src if src is not None else t)
            if not flush_scheduled[0]:
                flush_scheduled[0] = True
                loop.call_soon(flush)
        else:
            recv[label].append((i, src, t))

    def ev_sink(label, i, ev, t):
        k = int(ev.StateChangeCounter)
        src = dt_to_perf(ev.Time)
        recv[label].append((i, k, src, t))
        if edge is not None and label == 'mqtt-ev':
            edge.submit(i, [('Monitoring/FmsState', int(ev.NewStateCode), src), ('Monitoring/StateChangeCounter', k, src),
                            ('MachineryItemState/CurrentState', str(ev.MachineryItemState), src)])

    t_setup = time.perf_counter()
    if a.topology == 'single':
        urls = [(f'opc.tcp://127.0.0.1:{a.ua_port or UA_SINGLE}/fms/', devices)]
    else:
        urls = [(f'opc.tcp://127.0.0.1:{(a.ua_port or UA_PERDEV) + d["i"]}/fms/', [d]) for d in devices]
    sem = asyncio.Semaphore(16)

    async def conn(u):
        async with sem:
            for attempt in range(20):
                try:
                    return await connect(u, a.secure)
                except Exception:
                    await asyncio.sleep(0.5)
            raise RuntimeError(f'cannot connect {u}')
    clients = await asyncio.gather(*[conn(u) for u, _ in urls])
    t_connected = time.perf_counter()
    specs = a.subs.split(',') if a.subs else []
    if a.mqtt:
        specs += [f'mqtt-ev:q0:p{a.ev_pub_ms}', f'mqtt-dc:q10:p{a.dc_pub_ms}']
    subs = []
    for c, (u, devs) in zip(clients, urls):
        idx = await c.get_namespace_index(NS_URI)
        mach = await c.nodes.objects.get_child([f'{idx}:Machines'])
        etype = await c.nodes.base_event_type.get_child([f'{idx}:FmsStateChangedEventType'])
        for spec in specs:
            parts = spec.split(':')
            if parts[0] == 'dc' or parts[0] == 'mqtt-dc':
                if parts[0] == 'dc':
                    var, q, p = parts[1], int(parts[2][1:]), float(parts[3][1:])
                    label = spec
                    paths = {('Monitoring', var): var}
                else:
                    q, p = int(parts[1][1:]), float(parts[2][1:])
                    label = 'mqtt-dc'
                    paths = {tuple(r.split('/')): r for r in DC_REGS}
                node_map, nodes = {}, []
                for d in devs:
                    for path, reg in paths.items():
                        n = await mach.get_child([f"{idx}:{d['id']}"] + [f'{idx}:{x}' for x in path])
                        node_map[n.nodeid] = (d['i'], reg)
                        nodes.append(n)
                params = ua.CreateSubscriptionParameters(RequestedPublishingInterval=p, RequestedLifetimeCount=600,
                                                         RequestedMaxKeepAliveCount=20, MaxNotificationsPerPublish=0,
                                                         PublishingEnabled=True, Priority=0)
                sub = await c.create_subscription(params, DCHandler(label, node_map, dc_sink))
                await sub.subscribe_data_change(nodes, queuesize=q, sampling_interval=0.0)
            else:
                label = spec if parts[0] == 'ev' else 'mqtt-ev'
                q, p = int(parts[1][1:]), float(parts[2][1:])
                params = ua.CreateSubscriptionParameters(RequestedPublishingInterval=p, RequestedLifetimeCount=600,
                                                         RequestedMaxKeepAliveCount=20, MaxNotificationsPerPublish=0,
                                                         PublishingEnabled=True, Priority=0)
                sub = await c.create_subscription(params, EVHandler(label, name_map, ev_sink))
                await sub.subscribe_events(ua.ObjectIds.Server, etype, queuesize=q)
            subs.append(sub)
    t_sub = time.perf_counter()
    open(os.path.join(a.out, 'gateway.ready'), 'w').write(f'{t_sub}')
    await asyncio.sleep(max(0.0, a.t0 - time.perf_counter()))
    cpu0, w0 = common.cpu_s(), time.perf_counter()
    await asyncio.sleep(max(0.0, a.t0 + a.dur - time.perf_counter()))
    cpu1, w1 = common.cpu_s(), time.perf_counter()
    ws, peak = working_set_mb()
    await asyncio.sleep(max(0.0, a.t0 + a.dur + a.grace - time.perf_counter()))
    out = {'n': a.n, 'topology': a.topology, 'secure': a.secure, 't0': a.t0, 'dur': a.dur, 'subscribed_at': t_sub,
           'connect_s': t_connected - t_setup, 'subscribe_s': t_sub - t_connected, 'sessions': len(clients),
           'cpu_s': cpu1 - cpu0, 'wall_s': w1 - w0, 'ws_mb': ws, 'peak_mb': peak, 'recv': dict(recv)}
    if edge:
        out['mqtt'] = {'qos': a.qos, 'sf': a.sf, 'tls': a.tls, 'stats': dict(edge.stats), 'bytes_app': edge.bytes_app,
                       'log': edge.log, 'outbox_left': len(edge.outbox), 'inflight_left': len(edge.inflight)}
        edge.close()
    dump(os.path.join(a.out, 'gateway.json'), out)
    for c in clients:
        try:
            await asyncio.wait_for(c.disconnect(), 3)
        except Exception:
            pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=21)
    ap.add_argument('--topology', choices=['single', 'perdev'], default='single')
    ap.add_argument('--ua_port', type=int, default=None)
    ap.add_argument('--secure', action='store_true')
    ap.add_argument('--subs', default='')
    ap.add_argument('--mqtt', action='store_true')
    ap.add_argument('--mqtt_port', type=int, default=None)
    ap.add_argument('--qos', type=int, default=1)
    ap.add_argument('--sf', action='store_true')
    ap.add_argument('--tls', action='store_true')
    ap.add_argument('--ev_pub_ms', type=float, default=100)
    ap.add_argument('--dc_pub_ms', type=float, default=500)
    ap.add_argument('--t0', type=float, required=True)
    ap.add_argument('--dur', type=float, default=60)
    ap.add_argument('--grace', type=float, default=3)
    ap.add_argument('--out', default='.')
    a = ap.parse_args()
    asyncio.run(run(a))


if __name__ == '__main__':
    main()
