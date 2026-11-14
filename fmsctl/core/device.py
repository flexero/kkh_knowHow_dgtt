"""Typed device access + toggle-bit job handshake (used by the cell controller and the tests).

    dev = DeviceLink(info)               # info from spec.plant.device_table()
    dev.read('std.stateCode')            # typed read by register name
    jid = dev.command(10, {'job.palletId': 3, 'job.programNo': 1020, 'job.variant': 2, 'job.qty': 1})
    dev.wait_done(jid, timeout=60)       # -> {'result': 0, 'cycle_s': 341.2}
"""
from __future__ import annotations

import time

from fmsctl.core.modbus import ModbusClient, ModbusError
from fmsctl.spec import regmap as R


class HandshakeError(Exception):
    pass


class DeviceLink:
    RESULT = {0: 'OK', 1: 'unknown command', 2: 'not ready', 3: 'bad data', 4: 'busy'}

    def __init__(self, info, timeout=0.5):
        self.info = info
        self.idx = R.index(info['type'])
        self.cli = ModbusClient(info['host'], info['port'], info['unit'], timeout)
        self.seq = 0
        self.job_seq = int(time.time()) % 100000 * 10

    def read(self, name):
        a, t = self.idx[name]
        return R.dec(t, self.cli.read(a, R.NREG[t]))

    def read_block(self, start, n):
        return self.cli.read(start, n)

    def write(self, name, value):
        a, t = self.idx[name]
        regs = R.enc(t, value)
        if len(regs) == 1:
            self.cli.write1(a, regs[0])
        else:
            self.cli.write(a, regs)

    def command(self, code, params=None, job_id=None, timeout=5.0):
        """Toggle-bit handshake, 3 frames + ACK polling:
        0 the previous command must be acknowledged (REQ == ACK); an old unanswered request is cancelled first
        1 FC16: job id + parameters (400-449, contiguous runs in one frame each)
        2 FC16: cmd.code + cmd.seq (200-201)
        3 FC06: flip REQ (202) LAST, then wait for ACK + ackSeq. Returns the job id."""
        if job_id is None:
            self.job_seq += 1
            job_id = self.job_seq
        ctl, st = self.read('cmd.ctl'), self.read('hs.status')
        if (ctl & 1) != (st & 1):                      # previous request never acknowledged (e.g. PLC was in STOP)
            time.sleep(0.2)
            st = self.read('hs.status')
            if (ctl & 1) != (st & 1):                  # cancel it: REQ back to ACK, then send the new command
                self.write('cmd.ctl', (ctl & ~1) | (st & 1))
                ctl = (ctl & ~1) | (st & 1)
        img = {}
        for k, v in [('job.id', job_id)] + list((params or {}).items()):
            a, t = self.idx[k]
            for i, r in enumerate(R.enc(t, v)):
                img[a + i] = r
        for start, regs in self._runs(img):
            self.cli.write(start, regs)
        self.seq = (self.read('hs.ackSeq') + 1) & 0xFFFF
        self.cli.write(self.idx['cmd.code'][0], [code, self.seq])
        req = (ctl & 1) ^ 1
        self.write('cmd.ctl', req)
        t_end = time.time() + timeout
        while time.time() < t_end:
            st = self.read('hs.status')
            if (st & 1) == req and self.read('hs.ackSeq') == self.seq:
                res = self.read('hs.result')
                if res != 0:
                    raise HandshakeError(f"{self.info['id']}: command {code} rejected – {self.RESULT.get(res, res)}")
                return job_id
            time.sleep(0.02)
        raise HandshakeError(f"{self.info['id']}: no ACK within {timeout} s")

    @staticmethod
    def _runs(img):
        """{addr: reg} -> [(start, [regs])] contiguous runs (max 123 registers per FC16 frame)."""
        out = []
        for a in sorted(img):
            if out and a == out[-1][0] + len(out[-1][1]) and len(out[-1][1]) < 123:
                out[-1][1].append(img[a])
            else:
                out.append((a, [img[a]]))
        return out

    def wait_done(self, job_id, timeout=120.0, poll=0.05):
        t_end = time.time() + timeout
        while time.time() < t_end:
            if self.read('job.idDone') == job_id and not (self.read('hs.status') & 2):
                return {'result': self.read('job.result'), 'cycle_s': round(self.read('job.cycle_s'), 1)}
            time.sleep(poll)
        raise HandshakeError(f"{self.info['id']}: job {job_id} not done within {timeout} s")
