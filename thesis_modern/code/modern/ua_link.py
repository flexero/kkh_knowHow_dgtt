"""Supervisory controller adapter: lets the UNCHANGED fmsctl cell controller, tool manager and logistics manager run on
OPC UA machines instead of Modbus registers.

UaDeviceLink has the interface of fmsctl.core.device.DeviceLink (read, read_block, write, command, wait_done):
  * status: ONE OPC UA session per endpoint (UaSession) subscribes to every mapped variable of every device
    (data change, queue size 10, publishing interval 50 ms); the notifications are written back into a local
    register image through the inverse of the mapping table (infomodel.mapping), so read_block(0, 12) etc. are local
    reads of always-fresh data - no polling traffic.
  * commands: command(code, params, job_id) -> OPC UA method call (StartJob, MovePallet, ..., AckAlarm) with the JobId
    as IDEMPOTENCY KEY. If the answer is lost (time-out, broken channel) the adapter repeats the SAME call with the
    SAME JobId; the device returns the original result and never starts the job twice. Status != 0 raises
    HandshakeError with the edition-1 wording ("rejected – busy"), a lost connection raises ModbusError, so the
    controller's job-state logic (sent / noack / rejected / unknown) is reused unchanged.
Usage (dependency injection):
    import ua_link; ua_link.install('opc.tcp://127.0.0.1:48450/fms/')    # replaces DeviceLink in fmsctl modules
    ctl = CellController(plant.device_table(...), db, ...)               # controller code unchanged
"""
from __future__ import annotations

import asyncio
import logging
import threading
import time

import common
import infomodel as IM
from asyncua import Client, ua
from fmsctl.core.device import HandshakeError
from fmsctl.core.modbus import ModbusError
from fmsctl.spec import regmap as R

logging.getLogger('asyncua').setLevel(logging.ERROR)
ENDPOINT = {'url': None, 'secure': False}
_SESSIONS = {}
OFFLINE = set()                 # device ids treated as "no session" (test hook: machine switched off)


class UaSession:
    def __init__(self, url, secure=False, publishing_ms=50):
        self.url, self.secure, self.pub = url, secure, publishing_ms
        self.loop = asyncio.new_event_loop()
        self.images, self.types, self.objs, self.methods = {}, {}, {}, {}
        self.node_map = {}
        self.lock = threading.RLock()
        self.ready = threading.Event()
        self.error = None
        self.stats = {'calls': 0, 'retries': 0, 'notifications': 0}
        self.inject_lost_reply = 0          # test hook: drop the next n method replies after the server executed them
        threading.Thread(target=self._run, daemon=True).start()
        if not self.ready.wait(60) or self.error:
            raise ModbusError(f'OPC UA session failed: {self.error}')

    def _run(self):
        asyncio.set_event_loop(self.loop)
        try:
            self.loop.run_until_complete(self._start())
        except Exception as e:
            self.error = repr(e)
            self.ready.set()
            return
        self.loop.run_forever()

    async def _start(self):
        self.c = Client(self.url, timeout=5)
        self.c.application_uri = 'urn:compressor-fms:gateway'
        if self.secure:
            import os
            from asyncua.crypto.security_policies import SecurityPolicyBasic256Sha256
            await self.c.set_security(SecurityPolicyBasic256Sha256, os.path.join(common.PKI, 'ua', 'gateway_cert.der'),
                                      os.path.join(common.PKI, 'ua', 'gateway_key.pem'),
                                      server_certificate=os.path.join(common.PKI, 'ua', 'plant_cert.der'))
        await self.c.connect()
        self.idx = await self.c.get_namespace_index(common.NS_URI)
        mach = await self.c.nodes.objects.get_child([f'{self.idx}:Machines'])
        nodes = []
        for obj in await mach.get_children():
            did = (await obj.read_browse_name()).Name
            if did == 'FmsModelVersion':
                continue
            tdef = await obj.read_type_definition()
            tname = (await self.c.get_node(tdef).read_browse_name()).Name
            dtype = {v: k for k, v in IM.TYPE_NAME.items()}[tname]
            self.types[did], self.objs[did] = dtype, obj
            self.images[did] = [0] * R.MAP_SIZE
            ms = {}
            for ch in await obj.get_children():
                bn = (await ch.read_browse_name()).Name
                if await ch.read_node_class() == ua.NodeClass.Method:
                    ms[bn] = ch
            self.methods[did] = ms
            for row in IM.mapping(dtype):
                if row['kind'] != 'variable':
                    continue
                n = await obj.get_child([f'{self.idx}:{p}' for p in row['target'].split('/')])
                self.node_map[n.nodeid] = (did, row['reg'], row['addr'], row['rtype'])
                nodes.append(n)
            for p, bit in (('Production/JobActive', 2), ('Production/ReadyForJob', 16)):
                n = await obj.get_child([f'{self.idx}:{x}' for x in p.split('/')])
                self.node_map[n.nodeid] = (did, p, 8, bit)
                nodes.append(n)
        sub = await self.c.create_subscription(self.pub, self)
        for k in range(0, len(nodes), 200):
            await sub.subscribe_data_change(nodes[k:k + 200], queuesize=10)
        await asyncio.sleep(0.3)
        self.ready.set()

    # subscription handler: write notification into the register image
    def datachange_notification(self, node, val, data):
        did, reg, addr, rt = self.node_map[node.nodeid]
        img = self.images[did]
        with self.lock:
            self.stats['notifications'] += 1
            if addr == 8:                                    # synthesised handshake word (BUSY bit1, READY bit4)
                img[8] = (img[8] | rt) if val else (img[8] & ~rt)
                return
            v = IM.from_ua(reg, val)
            img[addr:addr + R.NREG[rt]] = R.enc(rt, v if v is not None else 0)
            if reg == 'std.stateCode':
                img[6] = int(v)

    def status_change_notification(self, status):
        self.error = f'subscription status {status}'          # e.g. session lost: reported, controller sees stale data

    def call(self, did, mname, args, timeout):
        async def _c():
            obj, m = self.objs[did], self.methods[did][mname]
            return await obj.call_method(m, *args)
        for attempt in (1, 2):
            self.stats['calls'] += 1
            try:
                fut = asyncio.run_coroutine_threadsafe(_c(), self.loop)
                res = fut.result(timeout)
                if self.inject_lost_reply > 0:               # reply "lost" after the server executed the call
                    self.inject_lost_reply -= 1
                    raise TimeoutError('injected loss of the method reply')
                return res
            except (TimeoutError, asyncio.TimeoutError, ConnectionError, OSError) as e:
                if attempt == 2:
                    raise ModbusError(f'no answer to {mname}: {e}')
                self.stats['retries'] += 1                   # same JobId again: safe because the device is idempotent
            except ua.UaStatusCodeError as e:
                raise HandshakeError(f'{did}: {mname} failed – {e}')


def session():
    url = ENDPOINT['url']
    if url not in _SESSIONS:
        _SESSIONS[url] = UaSession(url, ENDPOINT['secure'])
    return _SESSIONS[url]


class _SessionKeepAlive:
    """The controller's gateway heartbeat (FC06 to register 226 every second) is replaced by the OPC UA session
    keep-alive; writes to the heartbeat register are therefore accepted and ignored."""

    def write1(self, addr, value):
        if addr != 226:
            raise HandshakeError('direct register writes do not exist in the OPC UA model - use a method')

    def close(self):
        pass


class UaDeviceLink:
    RESULT = IM.STATUS

    def __init__(self, info, timeout=0.5):
        self.info, self.did = info, info['id']
        self.timeout = max(2.0, timeout)
        self.s = session()
        self.dtype = self.s.types[self.did]
        self.idx = R.index(self.dtype)
        self.job_seq = int(time.time()) % 100000 * 10
        self.cli = _SessionKeepAlive()

    def _check(self):
        if self.did in OFFLINE:
            raise ModbusError('no connection: OPC UA session to the device not available')

    def read_block(self, start, n):
        self._check()
        with self.s.lock:
            return list(self.s.images[self.did][start:start + n])

    def read(self, name):
        a, t = self.idx[name]
        return R.dec(t, self.read_block(a, R.NREG[t]))

    def write(self, name, value):
        raise HandshakeError('direct register writes do not exist in the OPC UA model - use a method')

    def command(self, code, params=None, job_id=None, timeout=5.0):
        self._check()
        params = params or {}
        if code == 4:
            st, msg = self.s.call(self.did, 'AckAlarm', [], self.timeout)
        else:
            mname, args = IM.method_for_code(self.dtype, code)
            if mname is None:
                raise HandshakeError(f'{self.did}: command {code} rejected – unknown command')
            if job_id is None:
                self.job_seq += 1
                job_id = self.job_seq
            vals = [ua.Variant(int(job_id), ua.VariantType.UInt32)]
            for a, t, reg in args:
                v = params.get(reg, '' if t == 'String' else 0)
                vals.append(ua.Variant(str(v) if t == 'String' else (float(v) if t == 'Float' else int(v)), getattr(ua.VariantType, t)))
            st, msg = self.s.call(self.did, mname, vals, self.timeout)
        if st != 0:
            raise HandshakeError(f"{self.did}: command {code} rejected – {self.RESULT.get(st, st)}")
        return job_id

    def wait_done(self, job_id, timeout=120.0, poll=0.05):
        t_end = time.time() + timeout
        while time.time() < t_end:
            if self.read('job.idDone') == job_id and not (self.read('hs.status') & 2):
                return {'result': self.read('job.result'), 'cycle_s': round(self.read('job.cycle_s'), 1)}
            time.sleep(poll)
        raise HandshakeError(f"{self.did}: job {job_id} not done within {timeout} s")


def install(url, secure=False):
    """Dependency injection: fmsctl modules use UaDeviceLink instead of the Modbus DeviceLink."""
    ENDPOINT['url'], ENDPOINT['secure'] = url, secure
    import fmsctl.cell.controller as C
    import fmsctl.logistics.manager as L
    C.DeviceLink = UaDeviceLink
    L.DeviceLink = UaDeviceLink
    return session()
