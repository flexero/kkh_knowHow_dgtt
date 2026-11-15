"""TCP byte-counting relay (asyncio): listen_port -> target_port on 127.0.0.1, counts bytes and receive chunks per
direction. Used only in the 'bytes on the wire' runs (it adds a relay hop, so latency is not measured in those runs).
TCP payload bytes are counted exactly; Ethernet / IP / TCP framing is added in the analysis (78 bytes per data segment,
84 bytes per acknowledgement frame, as in edition-1 Eq. 5.1), with the receive chunks as an estimate of the segments.
Usage: python proxy.py --pairs 48900:48410,18890:18830 --t0 <perf> --dur 60 --out DIR
"""
from __future__ import annotations

import argparse
import asyncio
import collections
import os
import time

import common
from common import dump


async def run(a):
    common.timer_resolution_1ms()
    cnt = collections.defaultdict(lambda: [0, 0])          # (pair, dir) -> [bytes, chunks] inside the window
    tot = collections.defaultdict(lambda: [0, 0])          # whole run incl. connection set-up

    async def pipe(r, w, key):
        try:
            while True:
                b = await r.read(65536)
                if not b:
                    break
                now = time.perf_counter()
                tot[key][0] += len(b)
                tot[key][1] += 1
                if a.t0 <= now < a.t0 + a.dur:
                    cnt[key][0] += len(b)
                    cnt[key][1] += 1
                w.write(b)
                await w.drain()
        except Exception:
            pass
        finally:
            try:
                w.close()
            except Exception:
                pass

    servers = []
    for pair in a.pairs.split(','):
        lp, tp = (int(x) for x in pair.split(':'))

        async def handle(cr, cw, lp=lp, tp=tp):
            try:
                sr, sw = await asyncio.open_connection('127.0.0.1', tp)
            except OSError:
                cw.close()
                return
            for s in (cw, sw):
                sock = s.get_extra_info('socket')
                if sock is not None:
                    import socket
                    sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            await asyncio.gather(pipe(cr, sw, f'{lp}>up'), pipe(sr, cw, f'{lp}>down'))
        servers.append(await asyncio.start_server(handle, '127.0.0.1', lp))
    open(os.path.join(a.out, 'proxy.ready'), 'w').write(f'{time.perf_counter()}')
    await asyncio.sleep(max(0.0, a.t0 + a.dur + a.grace - time.perf_counter()))
    dump(os.path.join(a.out, 'proxy.json'), {'window': {k: v for k, v in cnt.items()}, 'total': {k: v for k, v in tot.items()},
                                            'dur': a.dur})
    for s in servers:
        s.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pairs', required=True)
    ap.add_argument('--t0', type=float, required=True)
    ap.add_argument('--dur', type=float, default=60)
    ap.add_argument('--grace', type=float, default=3)
    ap.add_argument('--out', default='.')
    a = ap.parse_args()
    asyncio.run(run(a))


if __name__ == '__main__':
    main()
