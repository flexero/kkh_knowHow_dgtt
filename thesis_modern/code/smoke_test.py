"""Smoke test of the offline-installed protocol stacks (run with thesis_modern/.venv):

    thesis_modern/.venv/Scripts/python thesis_modern/code/smoke_test.py

1 OPC UA: asyncua server with one variable, client reads it and receives a data-change subscription.
2 MQTT:   amqtt broker on localhost, paho-mqtt publisher + subscriber, QoS 1 message round trip.
"""
import asyncio
import threading
import time

from asyncua import Client, Server
import paho.mqtt.client as mqtt

OPC_PORT, MQTT_PORT = 48400, 18830


async def opcua_test():
    srv = Server()
    await srv.init()
    srv.set_endpoint(f'opc.tcp://127.0.0.1:{OPC_PORT}/fms/')
    idx = await srv.register_namespace('urn:compressor-fms:test')
    obj = await srv.nodes.objects.add_object(idx, 'HMC01')
    state = await obj.add_variable(idx, 'StateCode', 1)
    await state.set_writable()
    got = []

    class Handler:
        def datachange_notification(self, node, val, data):
            got.append(val)

    async with srv:
        async with Client(f'opc.tcp://127.0.0.1:{OPC_PORT}/fms/') as cli:
            n = cli.get_node(state.nodeid)
            first = await n.read_value()
            sub = await cli.create_subscription(50, Handler())
            await sub.subscribe_data_change(n)
            for v in (2, 4, 1):
                await state.write_value(v)
                await asyncio.sleep(0.2)
            await asyncio.sleep(0.3)
    return first, got


def mqtt_test():
    from amqtt.broker import Broker
    cfg = {'listeners': {'default': {'type': 'tcp', 'bind': f'127.0.0.1:{MQTT_PORT}'}},
           'sys_interval': 0, 'auth': {'allow-anonymous': True}, 'topic-check': {'enabled': False}}
    loop = asyncio.new_event_loop()

    def run():
        asyncio.set_event_loop(loop)
        broker = Broker(cfg, loop=loop)
        loop.run_until_complete(broker.start())
        loop.run_forever()
    threading.Thread(target=run, daemon=True).start()
    time.sleep(1.0)
    got = []
    sub = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id='sub')
    sub.on_message = lambda c, u, m: got.append((m.topic, m.payload.decode(), time.perf_counter()))
    sub.connect('127.0.0.1', MQTT_PORT); sub.subscribe('spBv1.0/fms/DDATA/cell/HMC01', qos=1); sub.loop_start()
    pub = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id='pub')
    pub.connect('127.0.0.1', MQTT_PORT); pub.loop_start()
    time.sleep(0.5)
    t0 = time.perf_counter()
    pub.publish('spBv1.0/fms/DDATA/cell/HMC01', '{"StateCode": 2}', qos=1).wait_for_publish()
    time.sleep(0.5)
    pub.loop_stop(); sub.loop_stop()
    return got, (got[0][2] - t0) * 1000 if got else None


if __name__ == '__main__':
    first, changes = asyncio.run(opcua_test())
    print(f'OPC UA: read {first}, data changes received {changes}')
    got, ms = mqtt_test()
    print(f'MQTT:   received {[(t, p) for t, p, _ in got]}, publish -> receive {ms:.1f} ms' if got else 'MQTT: nothing received')
