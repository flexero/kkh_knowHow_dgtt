"""Twin side of the unified namespace: Sparkplug B primary host application (paho-mqtt).

Publishes spBv1.0/STATE/twin {"online": true} (retained, last will = offline), subscribes spBv1.0/fms/#, decodes the
hand-made protobuf payloads, resolves aliases from DBIRTH, checks the edge node's sequence numbers (gap -> rebirth
request NCMD "Node Control/Rebirth") and logs every received state change (device, StateChangeCounter, receive time).
End-to-end completeness (--replay, default on): the twin keeps the last StateChangeCounter per device; a jump in a
DDATA or a DBIRTH counter that is higher than the last one received means lost messages (e.g. accepted by a broker that
then restarted) and the twin asks the edge node to re-send them (NCMD "Node Control/Replay" = "<device>:<from>:<to>",
an application extension; the edge keeps the last 4096 state events per device).
Usage: python twin_sub.py --n 21 --t0 <perf> --dur 60 --qos 1 --out DIR [--tls] [--no-replay]
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import ssl
import threading
import time

import common
from common import EDGE, GROUP, HOST_ID, MQTT_PORT, MQTT_TLS_PORT, PKI, dump, working_set_mb
import sparkplug as SP
import paho.mqtt.client as mqtt

COUNTER = 'Monitoring/StateChangeCounter'


class PrimaryHost:
    def __init__(self, port, qos=1, tls=False, replay=True, dev_index=None, client_id='twin-primary-host'):
        self.qos, self.replay = qos, replay
        self.dev_index = dev_index
        self.aliases = collections.defaultdict(dict)
        self.rec, self.births, self.stats = [], [], collections.Counter()
        self.last_seq = None
        self.seqs = []
        self.last_k = {}
        self.nbytes = 0
        self.online = True
        self.state_topic = f'spBv1.0/STATE/{HOST_ID}'
        self.connected = threading.Event()
        c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id, clean_session=True)
        c.will_set(self.state_topic, json.dumps({'online': False, 'timestamp': int(time.time() * 1000)}), qos=1, retain=True)
        if tls:
            c.tls_set(ca_certs=os.path.join(PKI, 'mqtt', 'ca_cert.pem'), cert_reqs=ssl.CERT_REQUIRED)
        c.reconnect_delay_set(0.25, 1)
        c.on_connect, c.on_message = self._on_connect, self._on_message
        self.c = c
        for _ in range(60):
            try:
                c.connect('127.0.0.1', port, keepalive=5)
                break
            except OSError:
                time.sleep(0.25)
        c.loop_start()

    def _on_connect(self, cl, u, f, rc, p=None):
        self.stats['connects'] += 1
        cl.subscribe(f'spBv1.0/{GROUP}/#', qos=self.qos)
        cl.publish(self.state_topic, json.dumps({'online': self.online, 'timestamp': int(time.time() * 1000)}), qos=1, retain=True)
        self.connected.set()

    def set_online(self, online):
        self.online = online
        self.c.publish(self.state_topic, json.dumps({'online': online, 'timestamp': int(time.time() * 1000)}), qos=1, retain=True)

    def ncmd(self, name, dt, value):
        self.c.publish(SP.topic('NCMD', group=GROUP, edge=EDGE),
                       SP.encode_payload(int(time.time() * 1000), [{'name': name, 'datatype': dt, 'value': value}]), qos=1)

    def _gap(self, dev, k):
        """k = a counter value that is known to exist for dev; request everything missing below it."""
        last = self.last_k.get(dev)
        if last is not None and k > last + 1 and self.replay:
            self.stats['replay_requests'] += 1
            self.stats['replay_requested_events'] += k - last - 1
            self.ncmd('Node Control/Replay', 'String', f'{dev}:{last + 1}:{k - 1}')

    def _on_message(self, cl, u, msg):
        t = time.perf_counter()
        self.nbytes += len(msg.topic) + len(msg.payload)
        pt = SP.parse_topic(msg.topic)
        if not pt or pt['kind'] == 'STATE':
            return
        self.stats[pt['kind']] += 1
        if pt['kind'] in ('NCMD', 'DCMD'):
            return
        p = SP.decode_payload(msg.payload)
        seq = p.get('seq')
        self.seqs.append(seq)
        if pt['kind'] == 'NBIRTH':
            self.last_seq = seq
            self.births.append(t)
            return
        if pt['kind'] == 'NDEATH':
            self.last_seq = None
            return
        if seq is not None and self.last_seq is not None and seq != (self.last_seq + 1) % 256:
            self.stats['seq_gaps'] += 1
            self.ncmd('Node Control/Rebirth', 'Boolean', True)
        self.last_seq = seq
        dev = pt['device']
        if pt['kind'] == 'DBIRTH':
            for m in p['metrics']:
                if m.get('alias') is not None:
                    self.aliases[dev][m['alias']] = m['name']
                if m.get('name') == COUNTER:
                    k = m.get('value') or 0
                    if self.last_k.get(dev) is None:
                        self.last_k[dev] = k                # first birth: baseline
                    elif k > self.last_k[dev]:
                        self._gap(dev, k + 1)              # counter k was published -> 1 .. k must have arrived
                        self.last_k[dev] = k
            return
        if pt['kind'] == 'DDATA':
            amap = self.aliases.get(dev)
            if amap is None:
                self.stats['ddata_before_birth'] += 1
                return
            for m in p['metrics']:
                name = m.get('name') or amap.get(m.get('alias'))
                if name == COUNTER:
                    k = m['value']
                    self.rec.append((self.dev_index[dev] if self.dev_index else dev, k, t, bool(m.get('is_historical'))))
                    last = self.last_k.get(dev)
                    if last is None or k > last:
                        self._gap(dev, k)
                        self.last_k[dev] = k
                elif name is None:
                    self.stats['unknown_alias'] += 1

    def close(self):
        self.c.loop_stop()
        try:
            self.c.disconnect()
        except Exception:
            pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=21)
    ap.add_argument('--qos', type=int, default=1)
    ap.add_argument('--tls', action='store_true')
    ap.add_argument('--no-replay', dest='replay', action='store_false')
    ap.add_argument('--port', type=int, default=None)
    ap.add_argument('--t0', type=float, required=True)
    ap.add_argument('--dur', type=float, default=60)
    ap.add_argument('--grace', type=float, default=6)
    ap.add_argument('--out', default='.')
    a = ap.parse_args()
    common.timer_resolution_1ms()
    devices = common.device_table(a.n)
    h = PrimaryHost(a.port or (MQTT_TLS_PORT if a.tls else MQTT_PORT), a.qos, a.tls, a.replay, {d['id']: d['i'] for d in devices})
    open(os.path.join(a.out, 'twin.ready'), 'w').write(f'{time.perf_counter()}')
    while time.perf_counter() < a.t0:
        time.sleep(0.05)
    cpu0 = common.cpu_s()
    while time.perf_counter() < a.t0 + a.dur:
        time.sleep(0.05)
    cpu = common.cpu_s() - cpu0
    ws, peak = working_set_mb()
    while time.perf_counter() < a.t0 + a.dur + a.grace:
        time.sleep(0.05)
    h.close()
    dump(os.path.join(a.out, 'twin.json'), {'recv': h.rec, 'births': h.births, 'stats': dict(h.stats), 'bytes_app': h.nbytes,
                                           'replay': a.replay, 'cpu_s': cpu, 'ws_mb': ws, 'peak_mb': peak})


if __name__ == '__main__':
    main()
