"""Item 1 acceptance test: register map V1.2 + Modbus driver + virtual plant (virtual commissioning).

    python -m fmsctl.tests.test_item1
Starts the virtual plant (speed x200), then checks every device and runs one complete crankcase pallet cycle:
rack -> load station (operator loads a raw casting) -> HMC-01 pallet changer -> machining -> back to the rack,
plus a test-bench test, an AGV transport, an AS/RS store, rejections and write protection.
"""
import struct
import sys
import time

from fmsctl.core.device import DeviceLink, HandshakeError
from fmsctl.core.modbus import ModbusError
from fmsctl.sim import virtual_plant
from fmsctl.spec import plant, regmap as R

RESULTS = []


def check(name, ok, detail=''):
    RESULTS.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} | {name}" + (f' | {detail}' if detail else ''))


def main():
    devs = virtual_plant.start(speed=200.0, seed=3, base_port=15300)
    table = plant.device_table(virtual=True, base_port=15300)
    links = {d['id']: DeviceLink(d) for d in table}
    time.sleep(0.3)

    # 1 every device answers with the right header
    bad = [i for i, l in links.items() if l.read('hdr.mapVersion') != R.MAP_VERSION or l.read('hdr.typeCode') != R.TYPE_CODES[l.info['type']]]
    check(f'{len(links)} devices answer, map V1.2 and type code correct', not bad, f'bad: {bad}' if bad else '')
    hb0 = {i: l.read('hdr.heartbeat') for i, l in links.items()}
    time.sleep(2.2)
    stuck = [i for i, l in links.items() if l.read('hdr.heartbeat') == hb0[i]]
    check('heartbeat increments on every device', not stuck, f'stuck: {stuck}' if stuck else '')

    pps, load, hmc = links['PPS-1'], links['LOAD-CC'], links['HMC-01']
    # 2 impossible pallet move is rejected
    try:
        pps.command(11, {'move.palletId': 5, 'move.src': 1, 'move.dst': 2})
        check('pallet system rejects move of a pallet that is not at the source', False)
    except HandshakeError as e:
        check('pallet system rejects move of a pallet that is not at the source', 'bad data' in str(e), str(e))

    # 3 full pallet cycle
    t0 = time.time()
    j = pps.command(11, {'move.palletId': 1, 'move.src': 1, 'move.dst': 13}); r = pps.wait_done(j)
    check('move pallet 1 rack 1 -> load station', r['result'] == 0 and pps.read('pal.slot13') == 1, str(r))
    j = load.command(12, {'task.type': 1, 'task.palletId': 1, 'task.variant': 2}); r = load.wait_done(j)
    check('operator loads raw VC20 casting on pallet 1', r['result'] == 0 and pps.read('pal.state01') == 1, f"{r}, pallet state {pps.read('pal.state01')}")
    try:
        hmc.command(10, {'job.palletId': 1, 'job.programNo': 1020, 'job.variant': 2, 'job.qty': 1, 'job.fixtureId': 1})
        check('HMC-01 rejects a job for a pallet that is not at its pallet changer', False)
    except HandshakeError as e:
        check('HMC-01 rejects a job for a pallet that is not at its pallet changer', 'bad data' in str(e), str(e))
    j = pps.command(11, {'move.palletId': 1, 'move.src': 13, 'move.dst': 14}); r = pps.wait_done(j)
    check('move pallet 1 load station -> HMC-01 pallet changer', r['result'] == 0 and pps.read('pal.slot14') == 1, str(r))
    ev0, good0 = hmc.read('evt.counter'), hmc.read('std.good') + hmc.read('std.scrap')
    j = hmc.command(10, {'job.palletId': 1, 'job.programNo': 1020, 'job.variant': 2, 'job.qty': 1, 'job.fixtureId': 1})
    try:
        hmc.command(10, {'job.palletId': 1, 'job.programNo': 1020, 'job.variant': 2, 'job.qty': 1})
        check('HMC-01 rejects a second job while busy', False)
    except HandshakeError as e:
        check('HMC-01 rejects a second job while busy', 'busy' in str(e), str(e))
    r = hmc.wait_done(j)
    cnt = hmc.read('std.good') + hmc.read('std.scrap')
    check('HMC-01 machines pallet 1 (program O1020, VC20)', r['result'] in (0, 1) and cnt == good0 + 1 and pps.read('pal.state01') in (2, 3),
          f"{r}, simulated cycle {r['cycle_s']} s (design 345 s), pallet state {pps.read('pal.state01')}")
    check('event block counted the state changes (counter + ring)', hmc.read('evt.counter') >= ev0 + 2,
          f"counter {ev0} -> {hmc.read('evt.counter')}, newest ring state {hmc.read_block(108, 1)[0]}")
    j = pps.command(11, {'move.palletId': 1, 'move.src': 14, 'move.dst': 1}); r = pps.wait_done(j)
    check('move machined pallet back to rack location 1', r['result'] == 0 and pps.read('pal.slot01') == 1, str(r))
    check('complete pallet cycle on the virtual plant', True, f'{time.time() - t0:.1f} s wall time at speed x200')

    # 4 test bench, AGV, AS/RS
    tb = links['TEST-01']
    j = tb.command(13, {'job.variant': 2, 'job.text': 'VC20-000123'}); r = tb.wait_done(j)
    check('test bench tests VC20-000123', tb.read('test.verdict') in (1, 2) and tb.read('test.serial') == 'VC20-000123',
          f"FAD {tb.read('test.fad_m3h'):.2f} m3/h, {tb.read('test.power_kW'):.2f} kW, {tb.read('test.noise_dBA'):.1f} dB(A), verdict {tb.read('test.verdict')}")
    agv = links['AGV-01']
    j = agv.command(20, {'tr.fromNode': 1, 'tr.toNode': 2, 'tr.loadType': 1}); r = agv.wait_done(j)
    check('AGV-01 transports a casting box raw AS/RS -> load station buffer', r['result'] == 0 and agv.read('agv.node') == 2, f"{r}, battery {agv.read('agv.battery_pct')} %")
    asrs = links['ASRS-FG']
    j = asrs.command(30, {'loc.bay': 12, 'loc.level': 3, 'loc.side': 1, 'job.text': 'VC20-000123'}); r = asrs.wait_done(j)
    check('ASRS-FG stores a compressor at bay 12 / level 3', r['result'] == 0, str(r))

    # 5 protection
    try:
        hmc.cli.write1(4, 1)
        check('write to a read-only register is refused (exception 02)', False)
    except ModbusError as e:
        check('write to a read-only register is refused (exception 02)', e.code == 2, str(e))
    try:
        links['WASH-01'].command(13, {'job.variant': 1})
        check('unknown command for the device type is rejected', False)
    except HandshakeError as e:
        check('unknown command for the device type is rejected', 'unknown command' in str(e), str(e))

    # 6 robustness added after the textbook review (guide 53 ch. 28)
    try:
        hmc.cli._transact(struct.pack('>BHH', 3, 0, 126))           # raw FC03 frame (read() would split it into 125 + 1)
        check('read of 126 registers is refused with exception 03 (quantity)', False)
    except ModbusError as e:
        check('read of 126 registers is refused with exception 03 (quantity)', e.code == 3, str(e))
    tb2 = links['TEST-02']
    j = tb2.command(13, {'job.variant': 2, 'job.text': 'VC20-000777'})
    tb2.write('job.text', 'WRONG-WHILE-BUSY')                    # a write during the job must not change the running job
    tb2.wait_done(j, timeout=60)
    check('job parameters are latched when the job is accepted', tb2.read('test.serial') == 'VC20-000777', f"serial {tb2.read('test.serial')}")
    asf = links['ASRS-RAW']
    asf.cli.write1(226, 1)                                         # arms the gateway watchdog ...
    time.sleep(virtual_plant.WATCHDOG_S + 1.5)                     # ... and lets it expire
    try:
        asf.command(30, {'loc.bay': 2, 'loc.level': 1, 'loc.side': 1, 'job.text': 'HU-WD'})
        wd_ok = False
    except HandshakeError as e:
        wd_ok = 'not ready' in str(e)
    ready_off = not (asf.read('hs.status') & 16)
    asf.cli.write1(226, 2)                                         # heartbeat moves again -> READY comes back
    time.sleep(0.1)
    j = asf.command(30, {'loc.bay': 2, 'loc.level': 1, 'loc.side': 1, 'job.text': 'HU-WD'}); r = asf.wait_done(j, timeout=60)
    check('gateway watchdog: frozen heartbeat (register 226) -> READY off, job refused; heartbeat back -> job accepted',
          wd_ok and ready_off and r['result'] == 0, f'refused while frozen: {wd_ok}, READY off: {ready_off}, after recovery {r}')

    # 7 stale REQ toggle (late frame of an old TCP connection) must not run the last job again (sequence guard, map V1.2a)
    tb1 = links['TEST-01']
    done0 = tb1.read('job.idDone')
    ctl_now = tb1.read('cmd.ctl')
    tb1.cli.write1(202, ctl_now ^ 1)                               # stale toggle, cmd.seq unchanged (= last ackSeq)
    time.sleep(0.3)
    ran_again = bool(tb1.read('hs.status') & 2) or tb1.read('job.idDone') != done0
    j = tb1.command(13, {'job.variant': 1, 'job.text': 'VC10-000001'}); r = tb1.wait_done(j, timeout=60)
    check('stale REQ toggle ignored (sequence guard); the next command still runs once', not ran_again and r['result'] in (0, 1)
          and tb1.read('test.serial') == 'VC10-000001', f'job started by stale toggle: {ran_again}, next command {r}')

    n_ok = sum(RESULTS)
    print(f'\n{n_ok} / {len(RESULTS)} checks passed')
    return 0 if n_ok == len(RESULTS) else 1


if __name__ == '__main__':
    sys.exit(main())
