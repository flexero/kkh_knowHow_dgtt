"""MQTT broker for the laboratory: amqtt (pure Python, MQTT 3.1.1) - optional TLS listener and a scheduled restart.

The production recommendation is Eclipse Mosquitto (C); it cannot be installed in this offline lab, so all broker
results here are CONSERVATIVE (a Python broker is slower than Mosquitto). In-memory sessions and retained messages are
lost on a restart, exactly the worst case the store-and-forward design must survive.
Usage: python broker.py --until <perf> [--restart_at <perf> --down 5] [--tls] [--out DIR]
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import time

import common
from common import MQTT_PORT, MQTT_TLS_PORT, PKI, dump, working_set_mb

logging.getLogger('amqtt').setLevel(logging.CRITICAL)
logging.getLogger('transitions').setLevel(logging.CRITICAL)


def config(tls, port=None):
    if tls:
        lst = {'type': 'tcp', 'bind': f'127.0.0.1:{port or MQTT_TLS_PORT}', 'ssl': True,
               'certfile': os.path.join(PKI, 'mqtt', 'broker_cert.pem'), 'keyfile': os.path.join(PKI, 'mqtt', 'broker_key.pem')}
    else:
        lst = {'type': 'tcp', 'bind': f'127.0.0.1:{port or MQTT_PORT}'}
    return {'listeners': {'default': lst}, 'sys_interval': 0, 'auth': {'allow-anonymous': True},
            'topic-check': {'enabled': False}}


async def run(a):
    from amqtt.broker import Broker
    loop = asyncio.get_running_loop()
    b = Broker(config(a.tls, a.port), loop=loop)
    await b.start()
    open(os.path.join(a.out, 'broker.ready'), 'w').write(f'{time.perf_counter()}')
    events = []

    async def cpu_window():
        await asyncio.sleep(max(0.0, a.t0 - time.perf_counter()))
        c0 = common.cpu_s()
        await asyncio.sleep(max(0.0, a.t0 + a.dur - time.perf_counter()))
        cpu_w.append(common.cpu_s() - c0)
    cpu_w = []
    if a.t0:
        asyncio.create_task(cpu_window())
    if a.restart_at:
        await asyncio.sleep(max(0.0, a.restart_at - time.perf_counter()))
        events.append(('stop', time.perf_counter()))
        await b.shutdown()
        await asyncio.sleep(a.down)
        b = Broker(config(a.tls, a.port), loop=loop)
        await b.start()
        events.append(('start', time.perf_counter()))
    await asyncio.sleep(max(0.0, a.until - time.perf_counter()))
    ws, peak = working_set_mb()
    dump(os.path.join(a.out, 'broker.json'), {'events': events, 'cpu_s': cpu_w[0] if cpu_w else None, 'ws_mb': ws, 'peak_mb': peak})
    try:
        await asyncio.wait_for(b.shutdown(), 3)
    except Exception:
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--until', type=float, required=True)
    ap.add_argument('--restart_at', type=float, default=None)
    ap.add_argument('--down', type=float, default=5.0)
    ap.add_argument('--tls', action='store_true')
    ap.add_argument('--t0', type=float, default=None)
    ap.add_argument('--dur', type=float, default=60)
    ap.add_argument('--port', type=int, default=None)
    ap.add_argument('--out', default='.')
    a = ap.parse_args()
    asyncio.run(run(a))


if __name__ == '__main__':
    main()
