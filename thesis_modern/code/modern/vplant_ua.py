"""OPC UA virtual plant of the compressor FMS (edition 2) - asyncua servers with the information model of infomodel.py.

Two modes
  gen  measurement mode (chapter 5): every device changes state at random times with the event mix of edition 1
       (30 % short pulses U(0.05, 0.5) s, 70 % states Exp(mean 5 s); all durations divided by --rate), logs the TRUE
       time of every change, and writes it as a native OPC UA server would: FmsState + StateChangeCounter values with
       SourceTimestamp, an FmsStateChangedEventType event, MachineryItemState; additionally ElectricalPower every 1 s,
       EnergyConsumption every 10 s, PartsGood / LastCycleTime at the end of every RUN state, and a variable
       FmsStateSampled that is refreshed only every --sample_ms (emulates a server that samples a PLC tag).
  job  control mode (chapter 8): the PROCESS MODELS OF fmsctl (fmsctl.sim.virtual_plant.Device: machining with
       failures and tool wear, pallet shuttle, operator tasks, test bench, AGV, AS/RS) are imported unchanged; their
       register images are mirrored into the OPC UA model and every job is a METHOD (StartJob, MovePallet, ...)
       with JobId as idempotency key, instead of the toggle-bit handshake. Used by test_modern.py and cmdbench.py.

Topologies: --topology single (one server, N device objects under Objects/Machines) or perdev (one server per device,
port 48500 + i, as when every machine has its own embedded OPC UA server).
Usage (measurement): python vplant_ua.py gen --n 21 --topology single --rate 1 --seed 1 --t0 <perf> --dur 60 --out DIR
"""
from __future__ import annotations

import argparse
import asyncio
import collections
import logging
import os
import random
import threading
import time
from pathlib import Path

import common
from common import NS_URI, PKI, UA_JOB, UA_PERDEV, UA_SINGLE, dump, perf_to_dt, working_set_mb
import infomodel as IM
from asyncua import Server, ua
from asyncua.crypto.truststore import TrustStore
from asyncua.crypto.validator import CertificateValidator, CertificateValidatorOptions

for _n in ('asyncua', 'asyncua.server', 'asyncua.common'):
    logging.getLogger(_n).setLevel(logging.ERROR)

GEN_STATES = [1, 2, 4, 5]          # IDLE, RUN, DOWN, BLOCKED (edition 1: idle, processing, down, blocked)


async def make_server(port, name, secure):
    srv = Server()
    await srv.init()
    srv.set_endpoint(f'opc.tcp://127.0.0.1:{port}/fms/')
    srv.set_server_name(name)
    await srv.set_application_uri('urn:compressor-fms:plant')
    if secure:
        await srv.load_certificate(os.path.join(PKI, 'ua', 'plant_cert.der'))
        await srv.load_private_key(os.path.join(PKI, 'ua', 'plant_key.pem'))
        srv.set_security_policy([ua.SecurityPolicyType.Basic256Sha256_SignAndEncrypt])
        trust = TrustStore([Path(PKI) / 'ua' / 'trusted'], [])
        await trust.load()
        srv.set_certificate_validator(CertificateValidator(
            CertificateValidatorOptions.TRUSTED | CertificateValidatorOptions.TIME_RANGE | CertificateValidatorOptions.PEER_CLIENT, trust))
    else:
        srv.set_security_policy([ua.SecurityPolicyType.NoSecurity])
    idx = await srv.register_namespace(NS_URI)
    types, ev_state, ev_job = await IM.create_types(srv, idx)
    machines = await srv.nodes.objects.add_folder(idx, 'Machines')
    await machines.add_property(idx, 'FmsModelVersion', '2.0.0')
    return {'srv': srv, 'idx': idx, 'types': types, 'ev_state': ev_state, 'ev_job': ev_job, 'machines': machines}


class UaDev:
    """Runtime wrapper of one device object: typed writes with source time stamps, event triggering."""

    def __init__(self, ctx, dn):
        self.ctx, self.dn, self.srv, self.info = ctx, dn, ctx['srv'], dn.info
        self.gen_state = self.gen_job = None

    async def init_events(self):
        # events are emitted through the Server object (one event subscription serves all devices); SourceNode = device
        self.gen_state = await self.srv.get_event_generator(self.ctx['ev_state'], ua.ObjectIds.Server)
        self.gen_state.event.SourceNode = self.dn.obj.nodeid
        self.gen_state.event.SourceName = self.info['id']
        self.gen_job = await self.srv.get_event_generator(self.ctx['ev_job'], ua.ObjectIds.Server)
        self.gen_job.event.SourceNode = self.dn.obj.nodeid
        self.gen_job.event.SourceName = self.info['id']

    async def write_node(self, node, vt, value, t):
        dv = ua.DataValue(ua.Variant(value, vt), SourceTimestamp=perf_to_dt(t), ServerTimestamp=perf_to_dt(time.perf_counter()))
        await self.srv.write_attribute_value(node.nodeid, dv)

    async def write(self, reg, value, t=None):
        t = time.perf_counter() if t is None else t
        node, vt = self.dn.var[reg]
        await self.write_node(node, vt, IM.to_ua(reg, value), t)
        if reg == 'std.stateCode':
            n, v = self.dn.extra['MachineryItemState/CurrentState']
            await self.write_node(n, v, ua.LocalizedText(IM.ITEM_STATE.get(value, 'NotAvailable')), t)
        elif reg == 'std.mode':
            n, v = self.dn.extra['MachineryOperationMode/CurrentState']
            await self.write_node(n, v, ua.LocalizedText(IM.OP_MODE.get(value, 'None')), t)

    async def write_extra(self, path, value, t=None):
        n, vt = self.dn.extra[path]
        await self.write_node(n, vt, value, time.perf_counter() if t is None else t)

    async def state_event(self, old, new, counter, t):
        e = self.gen_state.event
        e.NewStateCode = ua.Variant(new, ua.VariantType.UInt16)
        e.OldStateCode = ua.Variant(old, ua.VariantType.UInt16)
        e.StateChangeCounter = ua.Variant(counter, ua.VariantType.UInt32)
        e.MachineryItemState = IM.ITEM_STATE.get(new, 'NotAvailable')
        e.Severity = 500 if new == 4 else 100
        await self.gen_state.trigger(time_attr=perf_to_dt(t), message=f"{self.info['id']} state {old}->{new}")

    async def job_event(self, job_id, result, duration, t):
        e = self.gen_job.event
        e.JobId = ua.Variant(job_id, ua.VariantType.UInt32)
        e.Result = ua.Variant(result, ua.VariantType.UInt16)
        e.Duration = ua.Variant(float(duration), ua.VariantType.Double)
        await self.gen_job.trigger(time_attr=perf_to_dt(t), message=f"{self.info['id']} job {job_id} finished, result {result}")


async def build_plant(devices, topology, secure, base_port=None, sampled=False):
    """Create servers + device objects. Returns (contexts, [UaDev])."""
    ctxs, devs = [], []
    if topology == 'single':
        ctx = await make_server(base_port or UA_SINGLE, 'FMS virtual plant (single server)', secure)
        ctxs.append(ctx)
        for info in devices:
            dn = await IM.build_device(ctx['srv'], ctx['idx'], ctx['machines'], info, ctx['types'])
            devs.append(UaDev(ctx, dn))
    else:
        for info in devices:
            ctx = await make_server((base_port or UA_PERDEV) + info['i'], f"{info['id']} embedded server", secure)
            ctxs.append(ctx)
            dn = await IM.build_device(ctx['srv'], ctx['idx'], ctx['machines'], info, ctx['types'])
            devs.append(UaDev(ctx, dn))
    for d in devs:
        await d.init_events()
        if sampled:
            mon = await d.dn.obj.get_child(f"{d.ctx['idx']}:Monitoring")
            node = await mon.add_variable(d.ctx['idx'], 'FmsStateSampled', ua.Variant(1, ua.VariantType.UInt16))
            d.dn.extra['Monitoring/FmsStateSampled'] = (node, ua.VariantType.UInt16)
    return ctxs, devs


# ====================================================================== gen mode
async def run_gen(a):
    common.timer_resolution_1ms()
    devices = common.device_table(a.n)
    t_build = time.perf_counter()
    ctxs, devs = await build_plant(devices, a.topology, a.secure, sampled=True)
    for c in ctxs:
        await c['srv'].start()
    build_s = time.perf_counter() - t_build
    open(os.path.join(a.out, 'plant.ready'), 'w').write(f'{time.perf_counter()}')
    rng = random.Random(a.seed)
    truth = []
    stop_t = a.t0 + a.dur
    state = {d.info['i']: 1 for d in devs}
    last_change = {d.info['i']: (1, a.t0) for d in devs}

    async def machine(d, r):
        i, cnt, good = d.info['i'], 0, 0
        await d.write('std.stateCode', 1, a.t0 - 1)
        await d.write('std.mode', 1, a.t0 - 1)
        t_next = a.t0
        while True:
            dwell = r.uniform(0.05, 0.5) if r.random() < 0.3 else r.expovariate(1 / 5.0)
            t_next += dwell / a.rate
            if t_next >= stop_t:
                return
            await asyncio.sleep(max(0.0, t_next - time.perf_counter()))
            old = state[i]
            new = r.choice([s for s in GEN_STATES if s != old])
            t = time.perf_counter()
            cnt += 1
            state[i] = new
            last_change[i] = (new, t)
            truth.append((i, cnt, new, t))
            await d.write('std.stateCode', new, t)
            await d.write('evt.counter', cnt, t)
            await d.state_event(old, new, cnt, t)
            if old == 2:                                   # end of a RUN segment = one part
                good += 1
                await d.write('std.good', good, t)
                await d.write('std.lastCycle_s', dwell / a.rate, t)

    async def analog():
        """ElectricalPower every 1 s, EnergyConsumption every 10 s (staggered over the devices)."""
        r = random.Random(a.seed + 7)
        pw = {d.info['i']: 5.0 for d in devs}
        en = {d.info['i']: 0.0 for d in devs}
        k = 0
        await asyncio.sleep(max(0.0, a.t0 - time.perf_counter()))
        while time.perf_counter() < stop_t:
            k += 1
            for d in devs:
                i = d.info['i']
                p = {2: 7.5, 1: 1.2, 4: 0.4, 5: 1.0}.get(state[i], 1.0)
                pw[i] = round(0.7 * pw[i] + 0.3 * p + r.gauss(0, 0.05), 2)
                en[i] += pw[i] / 3600
                await d.write('std.power_kW', pw[i])
                if k % 10 == i % 10:
                    await d.write('std.energy_kWh', round(en[i], 4))
            await asyncio.sleep(max(0.0, a.t0 + k - time.perf_counter()))

    async def sampler():
        """FmsStateSampled: copy of the internal state every sample_ms (time stamp = time of that state's change)."""
        seen = {d.info['i']: None for d in devs}
        k = 0
        await asyncio.sleep(max(0.0, a.t0 - time.perf_counter()))
        while time.perf_counter() < stop_t + 0.5:
            k += 1
            for d in devs:
                i = d.info['i']
                s, t = last_change[i]
                if seen[i] != (s, t):
                    seen[i] = (s, t)
                    await d.write_extra('Monitoring/FmsStateSampled', s, t)
            await asyncio.sleep(max(0.0, a.t0 + k * a.sample_ms / 1000 - time.perf_counter()))

    cpu0, w0 = common.cpu_s(), time.perf_counter()
    tasks = [asyncio.create_task(machine(d, random.Random(rng.random()))) for d in devs]
    tasks += [asyncio.create_task(analog()), asyncio.create_task(sampler())]
    await asyncio.gather(*tasks)
    cpu_gen = common.cpu_s() - cpu0
    wall_gen = time.perf_counter() - w0
    await asyncio.sleep(max(0.0, stop_t + a.grace - time.perf_counter()))
    ws, peak = working_set_mb()
    dump(os.path.join(a.out, 'truth.json'), {'n': a.n, 'topology': a.topology, 'rate': a.rate, 'seed': a.seed, 't0': a.t0,
                                            'dur': a.dur, 'build_s': build_s, 'cpu_s': cpu_gen, 'wall_s': wall_gen,
                                            'ws_mb': ws, 'peak_mb': peak, 'events': truth,
                                            'devices': [d['id'] for d in devices]})
    for c in ctxs:
        await c['srv'].stop()


# ====================================================================== job mode (fmsctl process models + methods)
class _NoModbus:
    """Replaces fmsctl's ModbusServer: the job-mode plant speaks OPC UA only."""

    def __init__(self, *a, **k):
        pass

    def stop(self):
        pass


class JobPlant:
    """fmsctl process models behind an OPC UA server (21 devices, single server). Runs in its own thread/loop.

        p = JobPlant(speed=50, seed=1, port=48450).start()      # p.fds = {id: fmsctl Device}
        ... p.stop()
    """

    def __init__(self, speed=50.0, seed=1, port=UA_JOB, secure=False):
        self.speed, self.seed, self.port, self.secure = speed, seed, port, secure
        self.loop = asyncio.new_event_loop()
        self.ready = threading.Event()
        self.jobs = collections.defaultdict(collections.OrderedDict)    # device -> {JobId: status}  (idempotency)
        self.calls = collections.Counter()
        self.error = None

    def start(self, timeout=60):
        threading.Thread(target=self._run, daemon=True).start()
        if not self.ready.wait(timeout) or self.error:
            raise RuntimeError(f'job plant did not start: {self.error}')
        return self

    def stop(self):
        async def _s():
            await self.ctx['srv'].stop()
        try:
            asyncio.run_coroutine_threadsafe(_s(), self.loop).result(10)
        except Exception:
            pass
        self.loop.call_soon_threadsafe(self.loop.stop)

    def _run(self):
        asyncio.set_event_loop(self.loop)
        try:
            self.loop.run_until_complete(self._main())
            self.loop.run_forever()
        except Exception as e:                      # pragma: no cover
            self.error = repr(e)
            self.ready.set()

    async def _main(self):
        from fmsctl.sim import virtual_plant as VP
        VP.ModbusServer = _NoModbus                  # process models only; no Modbus ports are opened
        self.q = asyncio.Queue()
        self.fds = VP.start(speed=self.speed, seed=self.seed, base_port=0)
        infos = []
        for i, (did, fd) in enumerate(self.fds.items()):
            infos.append({'id': did, 'type': fd.type, 'desc': fd.info['desc'], 'i': i, 'ip': fd.info['ip']})
        ctxs, devs = await build_plant(infos, 'single', self.secure, base_port=self.port)
        self.ctx = ctxs[0]
        self.uadev = {d.info['id']: d for d in devs}
        for did, fd in self.fds.items():
            await self._sync_all(did)
            self._hook(did, fd)
            await self._add_methods(did)
        self.loop.create_task(self._writer())
        await self.ctx['srv'].start()
        self.ready.set()

    async def _sync_all(self, did):
        fd, d = self.fds[did], self.uadev[did]
        for reg in d.dn.var:
            await d.write(reg, fd.get(reg))
        st = fd.get('hs.status')
        await d.write_extra('Production/JobActive', bool(st & 2))
        await d.write_extra('Production/ReadyForJob', bool(st & 16))
        d.last_done = (st >> 2) & 1

    def _push(self, item):
        self.loop.call_soon_threadsafe(self.q.put_nowait, item)

    def _hook(self, did, fd):
        d, mapped = self.uadev[did], set(self.uadev[did].dn.var)
        orig_set, orig_state = fd.set, fd.set_state

        def hset(name, v, _o=orig_set):
            _o(name, v)
            t = time.perf_counter()
            if name in mapped:
                self._push(('var', did, name, v, t))
            elif name == 'hs.status':
                done = (int(v) >> 2) & 1
                ev = None
                if done != getattr(d, 'last_done', 0):
                    d.last_done = done
                    ev = (fd.get('job.idDone'), fd.get('job.result'), fd.get('job.cycle_s'))
                self._push(('hs', did, int(v), ev, t))

        def hstate(s, _o=orig_state):
            with fd.lock:
                old, c0 = fd.state, fd.counter
                _o(s)
                if fd.counter != c0:
                    self._push(('state', did, old, s, fd.counter, time.perf_counter()))
        fd.set, fd.set_state = hset, hstate

    async def _writer(self):
        while True:
            item = await self.q.get()
            try:
                kind, did = item[0], item[1]
                d = self.uadev[did]
                if kind == 'var':
                    await d.write(item[2], item[3], item[4])
                elif kind == 'hs':
                    v, ev, t = item[2], item[3], item[4]
                    await d.write_extra('Production/JobActive', bool(v & 2), t)
                    await d.write_extra('Production/ReadyForJob', bool(v & 16), t)
                    if ev:
                        await d.job_event(ev[0], ev[1], ev[2], t)
                elif kind == 'state':
                    await d.state_event(item[2], item[3], item[4], item[5])
            except Exception as e:                     # never stop the writer
                logging.getLogger('vplant').warning('writer: %r', e)

    async def _add_methods(self, did):
        # callbacks are coroutines: asyncua runs plain functions in a thread-pool executor (extra latency)
        d, fd = self.uadev[did], self.fds[did]
        idx = self.ctx['idx']

        def arg(name, t):
            a = ua.Argument()
            a.Name, a.DataType, a.ValueRank = name, ua.NodeId(getattr(ua.ObjectIds, t)), -1
            return a
        out = [arg('Status', 'UInt16'), arg('Message', 'String')]
        for mname, (code, args) in IM.methods_of(fd.type).items():
            inargs = [arg('JobId', 'UInt32')] + [arg(n, t) for n, t, _ in args]
            regs = [r for _, _, r in args]

            async def cb(parent, *vals, _code=code, _regs=regs, _m=mname, _types=[t for _, t in [('JobId', 'UInt32')] + [(n, t) for n, t, _ in args]]):
                # asyncua does not check the call against the InputArguments property - the server must do it
                if len(vals) < len(_types):
                    return ua.StatusCode(ua.StatusCodes.BadArgumentsMissing)
                if len(vals) > len(_types):
                    return ua.StatusCode(ua.StatusCodes.BadTooManyArguments)
                if any(v.VariantType != getattr(ua.VariantType, t) for v, t in zip(vals, _types)):
                    return ua.StatusCode(ua.StatusCodes.BadTypeMismatch)
                st, msg = self.start_job(did, _code, vals[0].Value, {r: v.Value for r, v in zip(_regs, vals[1:])}, _m)
                return [ua.Variant(st, ua.VariantType.UInt16), ua.Variant(msg, ua.VariantType.String)]
            m = await d.dn.obj.add_method(idx, mname, cb, inargs, out)
            d.dn.methods[mname] = m

        async def ack(parent):
            st, msg = self.start_job(did, 4, None, {}, 'AckAlarm')
            return [ua.Variant(st, ua.VariantType.UInt16), ua.Variant(msg, ua.VariantType.String)]
        d.dn.methods['AckAlarm'] = await d.dn.obj.add_method(idx, 'AckAlarm', ack, [], out)

        async def result(parent, jid):
            j = jid.Value
            if fd.get('job.idDone') == j and not fd.busy:
                st, res, dur = 0, fd.get('job.result'), fd.get('job.cycle_s')
            elif self.jobs[did].get(j) == 0:
                st, res, dur = 1, 0, 0.0                       # accepted, running
            elif j in self.jobs[did]:
                st, res, dur = 3, self.jobs[did][j], 0.0       # rejected with this status
            else:
                st, res, dur = 2, 0, 0.0                       # unknown to the device (e.g. lost in a restart)
            return [ua.Variant(st, ua.VariantType.UInt16), ua.Variant(res, ua.VariantType.UInt16), ua.Variant(float(dur), ua.VariantType.Double)]
        d.dn.methods['GetJobResult'] = await d.dn.obj.add_method(
            idx, 'GetJobResult', result, [arg('JobId', 'UInt32')], [arg('State', 'UInt16'), arg('Result', 'UInt16'), arg('Duration', 'Double')])

    def start_job(self, did, code, job_id, params, mname):
        """Executes one job method on the fmsctl process model (in-process handshake). Idempotent per JobId."""
        fd = self.fds[did]
        self.calls[mname] += 1
        if job_id is not None and job_id in self.jobs[did]:
            st = self.jobs[did][job_id]
            self.calls['duplicate'] += 1
            return st, f'duplicate JobId {job_id}: original result returned, job not started again'
        for reg, v in params.items():
            fd.set(reg, v)
        if job_id is not None:
            fd.set('job.id', job_id)
        fd.set('cmd.code', code)
        fd.set('cmd.seq', (fd.get('cmd.seq') + 1) & 0xFFFF)
        req = (fd.ack & 1) ^ 1
        fd.set('cmd.ctl', req)
        fd.on_write(202, [req])
        st = fd.get('hs.result')
        if job_id is not None:
            self.jobs[did][job_id] = st
            while len(self.jobs[did]) > 256:
                self.jobs[did].popitem(last=False)
        return st, IM.STATUS.get(st, str(st))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['gen', 'job'])
    ap.add_argument('--n', type=int, default=21)
    ap.add_argument('--topology', choices=['single', 'perdev'], default='single')
    ap.add_argument('--rate', type=float, default=1.0)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--t0', type=float, default=None)
    ap.add_argument('--dur', type=float, default=60.0)
    ap.add_argument('--grace', type=float, default=4.0)
    ap.add_argument('--sample_ms', type=float, default=100.0)
    ap.add_argument('--secure', action='store_true')
    ap.add_argument('--speed', type=float, default=50.0)
    ap.add_argument('--out', default='.')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    if a.t0 is None:
        a.t0 = time.perf_counter() + 10
    if a.mode == 'gen':
        asyncio.run(run_gen(a))
    else:
        p = JobPlant(a.speed, a.seed, secure=a.secure).start()
        print(f'job plant: 21 devices on opc.tcp://127.0.0.1:{UA_JOB}/fms/ (speed x{a.speed}); Ctrl+C to stop')
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            p.stop()


if __name__ == '__main__':
    main()
