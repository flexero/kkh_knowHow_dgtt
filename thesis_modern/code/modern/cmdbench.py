"""Command latency bench (chapter 5, measurement vi): job command as OPC UA METHOD CALL versus the edition-1
toggle-bit handshake over Modbus TCP (fmsctl.core.device.DeviceLink against the fmsctl virtual plant).

Both plants run in their own process with the SAME fmsctl process models (station WASH-01, job = run 1 part):
  OPC UA   vplant_ua.py job (port 48450)       StartJob(JobId, Variant, Quantity, SerialNumber) -> (Status, Message)
  Modbus   fmsctl.sim.virtual_plant (ports 18850+)  DeviceLink.command(10, {...}) = reads + 3 FC16 + 1 FC06 + ACK poll
Timing: perf_counter around the command call only (wait for job completion excluded). 3 repetitions x 100 commands per
variant; plus one counting run per variant through proxy.py (bytes per command, TCP payload). Loopback, no emulated PLC
scan time (the scan time is added in the sizing model, section 5.5).
Usage: thesis_modern\\.venv\\Scripts\\python.exe cmdbench.py
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import time

import common
from common import DATA, PKI, UA_JOB, dump, mean_ci, pct
from asyncua import Client, ua
from asyncua.crypto.security_policies import SecurityPolicyBasic256Sha256

PY = sys.executable
REPS, CALLS = 3, 100
MB_BASE = common.MODBUS_REF          # 18850: fmsctl virtual plant base port (WASH-01 = index 5 -> 18855)
PROXY_UA, PROXY_MB = 48901, 18899


def start_ua_plant(secure):
    args = [PY, os.path.join(common.HERE, 'vplant_ua.py'), 'job', '--speed', '2000'] + (['--secure'] if secure else [])
    return subprocess.Popen(args, cwd=common.HERE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def start_mb_plant():
    code = ('import sys,time; sys.path.insert(0, r"%s"); from fmsctl.sim import virtual_plant as v; '
            'v.start(speed=2000, base_port=%d); time.sleep(36000)') % (common.ROOT, MB_BASE)
    return subprocess.Popen([PY, '-c', code], cwd=common.ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def start_proxy(pair, t0, dur, out):
    os.makedirs(out, exist_ok=True)
    return subprocess.Popen([PY, os.path.join(common.HERE, 'proxy.py'), '--pairs', pair, '--t0', str(t0), '--dur', str(dur),
                             '--grace', '1', '--out', out], cwd=common.HERE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


async def ua_client(port, secure):
    c = Client(f'opc.tcp://127.0.0.1:{port}/fms/', timeout=10)
    c.application_uri = 'urn:compressor-fms:gateway'
    if secure:
        await c.set_security(SecurityPolicyBasic256Sha256, os.path.join(PKI, 'ua', 'gateway_cert.der'),
                             os.path.join(PKI, 'ua', 'gateway_key.pem'), server_certificate=os.path.join(PKI, 'ua', 'plant_cert.der'),
                             mode=ua.MessageSecurityMode.SignAndEncrypt)
    t = time.perf_counter()
    for _ in range(40):
        try:
            await c.connect()
            break
        except Exception:
            await asyncio.sleep(0.5)
            t = time.perf_counter()
    return c, time.perf_counter() - t


async def ua_bench(secure, port=UA_JOB, calls=CALLS, reps=REPS, job_base=1):
    c, t_conn = await ua_client(port, secure)
    idx = await c.get_namespace_index(common.NS_URI)
    dev = await c.nodes.objects.get_child([f'{idx}:Machines', f'{idx}:WASH-01'])
    m_start = await dev.get_child(f'{idx}:StartJob')
    m_res = await dev.get_child(f'{idx}:GetJobResult')
    out, dups, statuses = [], [], []
    jid = job_base * 100000
    for r in range(reps):
        lat = []
        for k in range(calls):
            jid += 1
            args = [ua.Variant(jid, ua.VariantType.UInt32), ua.Variant(1, ua.VariantType.UInt16), ua.Variant(1, ua.VariantType.UInt16),
                    ua.Variant(f'SN{jid}', ua.VariantType.String)]
            t = time.perf_counter()
            st, msg = await dev.call_method(m_start, *args)
            lat.append(time.perf_counter() - t)
            statuses.append(st)
            if k % 10 == 0:                                   # idempotent retry with the same JobId
                t = time.perf_counter()
                st2, msg2 = await dev.call_method(m_start, *args)
                dups.append((time.perf_counter() - t, st2, 'duplicate' in msg2))
            while True:                                       # wait until the job is finished (not timed)
                s, res, dur = await dev.call_method(m_res, ua.Variant(jid, ua.VariantType.UInt32))
                if s == 0:
                    break
                await asyncio.sleep(0.02)
        out.append(lat)
    await c.disconnect()
    return {'connect_s': t_conn, 'reps': out, 'dup': dups, 'status_ok': sum(1 for s in statuses if s == 0), 'n': len(statuses)}


async def ua_bytes(secure, calls=50):
    t0 = time.perf_counter() + 4
    px = start_proxy(f'{PROXY_UA}:{UA_JOB}', t0, 20, os.path.join(common.RAW, 'cmd', 'ua_sec' if secure else 'ua'))
    await asyncio.sleep(1.5)
    c, _ = await ua_client(PROXY_UA, secure)
    idx = await c.get_namespace_index(common.NS_URI)
    dev = await c.nodes.objects.get_child([f'{idx}:Machines', f'{idx}:WASH-01'])
    m_start = await dev.get_child(f'{idx}:StartJob')
    await asyncio.sleep(max(0, t0 - time.perf_counter()))
    jid = 900000 + (50000 if secure else 0)
    for _ in range(calls):
        jid += 1
        await dev.call_method(m_start, ua.Variant(jid, ua.VariantType.UInt32), ua.Variant(1, ua.VariantType.UInt16),
                              ua.Variant(1, ua.VariantType.UInt16), ua.Variant(f'SN{jid}', ua.VariantType.String))
        await asyncio.sleep(0.25)                                  # job finishes in ~0.07 s at x2000
    t1 = time.perf_counter()
    await asyncio.sleep(max(0, t0 + 20 - time.perf_counter()))     # window closes before the disconnect
    await c.disconnect()
    px.wait(timeout=30)
    return calls, t1 - t0


def mb_bench(calls=CALLS, reps=REPS, via_proxy=False):
    from fmsctl.core.device import DeviceLink
    from fmsctl.spec import plant
    info = [d for d in plant.device_table(virtual=True, base_port=MB_BASE) if d['id'] == 'WASH-01'][0]
    if via_proxy:
        info = dict(info, port=PROXY_MB)
    link = DeviceLink(info, timeout=1.0)
    for _ in range(40):
        try:
            link.read('hdr.mapVersion')
            break
        except Exception:
            time.sleep(0.5)
    ntx = [0]
    orig = link.cli._transact

    def counted(pdu):
        ntx[0] += 1
        return orig(pdu)
    link.cli._transact = counted
    out, txs = [], []
    for r in range(reps):
        lat = []
        for k in range(calls):
            ntx[0] = 0
            t = time.perf_counter()
            jid = link.command(10, {'job.variant': 1, 'job.qty': 1, 'job.text': f'SN{r}{k}'})
            lat.append(time.perf_counter() - t)
            txs.append(ntx[0])
            link.wait_done(jid, timeout=30, poll=0.02)
            if via_proxy:
                time.sleep(0.25)
        out.append(lat)
    link.cli.close()
    return {'reps': out, 'transactions_per_command': sum(txs) / len(txs)}


def stats(reps):
    allx = [x * 1000 for r in reps for x in r]
    m, h = mean_ci([1000 * sum(r) / len(r) for r in reps])
    return {'n': len(allx), 'mean_ms': m, 'ci95_ms': h, 'p50_ms': pct(allx, 50), 'p95_ms': pct(allx, 95), 'p99_ms': pct(allx, 99),
            'max_ms': max(allx)}


def main():
    common.timer_resolution_1ms()
    res = {}
    for secure in (False, True):
        p = start_ua_plant(secure)
        try:
            time.sleep(3)
            r = asyncio.run(ua_bench(secure, job_base=2 if secure else 1))
            key = 'opcua_sign_encrypt' if secure else 'opcua_none'
            res[key] = {'stats': stats(r['reps']), 'connect_s': r['connect_s'], 'status_ok': r['status_ok'], 'n': r['n'],
                        'duplicate_calls': len(r['dup']), 'duplicate_detected': sum(1 for d in r['dup'] if d[2] and d[1] == 0),
                        'duplicate_p50_ms': pct([d[0] * 1000 for d in r['dup']], 50)}
            calls, dur = asyncio.run(ua_bytes(secure))
            px = common.load(os.path.join(common.RAW, 'cmd', 'ua_sec' if secure else 'ua', 'proxy.json'))
            w = px['window']
            up = sum(v[0] for k, v in w.items() if k.endswith('up'))
            down = sum(v[0] for k, v in w.items() if k.endswith('down'))
            chunks = sum(v[1] for v in w.values())
            res[key]['bytes_per_command'] = (up + down) / calls
            res[key]['segments_per_command'] = chunks / calls
            print(key, json.dumps(res[key]), flush=True)
        finally:
            p.kill()
    p = start_mb_plant()
    try:
        time.sleep(3)
        r = mb_bench()
        res['modbus_toggle_bit'] = {'stats': stats(r['reps']), 'transactions_per_command': r['transactions_per_command']}
        t0 = time.perf_counter() + 2
        px = start_proxy(f'{PROXY_MB}:{MB_BASE + 5}', t0, 20, os.path.join(common.RAW, 'cmd', 'modbus'))
        time.sleep(max(0, t0 - time.perf_counter()))
        tb = time.perf_counter()
        from fmsctl.core.device import DeviceLink
        from fmsctl.spec import plant
        info = [d for d in plant.device_table(virtual=True, base_port=MB_BASE) if d['id'] == 'WASH-01'][0]
        link = DeviceLink(dict(info, port=PROXY_MB), timeout=1.0)
        for k in range(50):
            link.command(10, {'job.variant': 1, 'job.qty': 1, 'job.text': f'SNB{k}'})
            time.sleep(0.25)
        time.sleep(max(0, t0 + 20 - time.perf_counter()))
        link.cli.close()
        px.wait(timeout=30)
        pxd = common.load(os.path.join(common.RAW, 'cmd', 'modbus', 'proxy.json'))['window']
        res['modbus_toggle_bit']['bytes_per_command'] = sum(v[0] for v in pxd.values()) / 50
        res['modbus_toggle_bit']['segments_per_command'] = sum(v[1] for v in pxd.values()) / 50
        px.kill()
        print('modbus', json.dumps(res['modbus_toggle_bit']), flush=True)
    finally:
        p.kill()
    res['note'] = ('loopback, one PC, Python stacks; command time = call until accepted/rejected answer; job completion excluded; '
                   'no emulated PLC scan time')
    dump(os.path.join(DATA, 'cmdbench.json'), res)


if __name__ == '__main__':
    main()
