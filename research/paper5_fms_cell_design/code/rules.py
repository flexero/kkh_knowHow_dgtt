"""Dispatching-rule variants of the real cell controller (fmsctl.cell.controller.CellController) for the rule study.

The subclass changes ONLY the decision step `dispatch()`; polling, job handshake, job closing and the database are the
unchanged production code. Four switches reproduce the first controller version (all False) and the present version
(all True):

  fb      fixture balance: if the most urgent open work order needs a fixture type with no pallet in circulation, the
          load station only unloads pallets of the other type and the shuttle brings an empty pallet of the needed type
  nr      nearest-rack storage: a pallet that goes to the rack is put on the free rack location nearest to the load
          station (location 13); empty pallets are also picked nearest-first.  False = lowest free location number
          first (first controller: farthest from the load station)
  oldest  oldest-first pick: the machined pallet that has waited longest goes to the load station first.
          False = lowest location number first (first controller)
  lw      longest-waiting machine: an idle HMC that has waited longest is fed first.  False = fixed order HMC-01, 02, 03

Everything else (EDD order of work orders, priority order (a) empty a finished machine, (b) feed an idle machine,
(c) serve the load station, (d) clear the load station) is identical in all variants.
"""
from __future__ import annotations

import time

from fmsctl.cell.controller import (CellController, FIXTURE_FOR, HMC_SLOT, LOAD_SLOT, NC_PROGRAM, PARK_AFTER_S, RACK,
                                    VARIANT_NAME)

RULESETS = {                       # name -> switches
    'before': dict(fb=False, nr=False, oldest=False, lw=False),   # first controller
    'fb':     dict(fb=True, nr=False, oldest=False, lw=False),    # + fixture balance only
    'nro':    dict(fb=False, nr=True, oldest=True, lw=True),      # storage / pick / machine rules, no fixture balance
    'after':  dict(fb=True, nr=True, oldest=True, lw=True),       # present controller
}


class RuleController(CellController):
    def __init__(self, *a, fb=True, nr=True, oldest=True, lw=True, **kw):
        self.fb, self.nr, self.oldest, self.lw = fb, nr, oldest, lw
        super().__init__(*a, **kw)

    def dispatch(self):
        L = self.live
        pps = L.get('PPS-1', {})
        if not pps.get('online'):
            return
        slots = pps['slots']
        pallets = {p['id']: p for p in self.db.q('SELECT * FROM pallet')}
        where = {pid: s for s, pid in slots.items() if pid}
        starving = self._starving_fixture(pallets, where) if self.fb else None

        # ---- HMC jobs (unchanged)
        for m, s in HMC_SLOT.items():
            d = L.get(m, {})
            pid = slots.get(s, 0)
            if pid and d.get('online') and d.get('ready') and not d.get('busy') and not self._active(m) \
                    and pallets[pid]['content'] == 'raw' and not self._pallet_busy(pid):
                v = pallets[pid]['variant']
                if self.tools and not self.tools.check(m, NC_PROGRAM[('HMC', v)], 1)[0]:
                    continue
                self._send(m, 10, {'job.palletId': pid, 'job.programNo': NC_PROGRAM[('HMC', v)], 'job.variant': v,
                                   'job.qty': 1, 'job.fixtureId': pid}, f'machine pallet {pid} {VARIANT_NAME[v]}')

        # ---- load station operator task
        lp = slots.get(LOAD_SLOT, 0)
        ld = L.get('LOAD-CC', {})
        if lp and ld.get('online') and ld.get('ready') and not self._active('LOAD-CC') and not self._pallet_busy(lp):
            pal = pallets[lp]
            wos = self._open_wos(pal['fixture'])
            if starving and pal['fixture'] != starving:
                wos = []
            if pal['content'] in ('machined', 'nok'):
                if wos:
                    w = wos[0]
                    self._send('LOAD-CC', 12, {'task.type': 3, 'task.palletId': lp, 'task.variant': w['variant'], 'wo': w['id']},
                               f"unload + load {VARIANT_NAME[w['variant']]} for {w['id']}")
                else:
                    self._send('LOAD-CC', 12, {'task.type': 2, 'task.palletId': lp, 'task.variant': 0, 'wo': ''}, 'unload')
            elif pal['content'] == 'empty' and wos:
                w = wos[0]
                self._send('LOAD-CC', 12, {'task.type': 1, 'task.palletId': lp, 'task.variant': w['variant'], 'wo': w['id']},
                           f"load {VARIANT_NAME[w['variant']]} for {w['id']}")

        # ---- shuttle: one move at a time
        if pps.get('shuttleBusy') or self._active('PPS-1') or not pps.get('ready'):
            return
        free = [s for s in RACK if not slots.get(s)]
        free_rack = sorted(free, key=lambda s: abs(LOAD_SLOT - s)) if self.nr else sorted(free)
        idle_hmc = [m for m, s in HMC_SLOT.items() if not slots.get(s) and L.get(m, {}).get('online')
                    and L[m].get('state') != 4 and not L[m].get('busy')]
        if self.lw:
            idle_hmc.sort(key=lambda m: self.last_end[m])

        def move(pid, dst, why):
            return self._send('PPS-1', 11, {'move.palletId': pid, 'move.src': where[pid], 'move.dst': dst}, why)

        def pick_empty(cands):
            return sorted(cands, key=lambda pid: abs(LOAD_SLOT - where[pid])) if self.nr else list(cands)

        # (a) empty a finished machine; park a raw pallet of a machine that is down / offline too long
        for m, s in HMC_SLOT.items():
            pid = slots.get(s, 0)
            if not pid or self._pallet_busy(pid):
                continue
            d = L.get(m, {})
            if pallets[pid]['content'] in ('machined', 'nok', 'empty') and not d.get('busy'):
                if not slots.get(LOAD_SLOT) and (pallets[pid]['content'] != 'empty'):
                    return move(pid, LOAD_SLOT, f'{m} finished -> load station')
                if free_rack:
                    return move(pid, free_rack[0], f'{m} finished -> rack {free_rack[0]}')
            if pallets[pid]['content'] == 'raw' and free_rack and not d.get('busy'):
                since = self.offline_since.get(m) if not d.get('online') else self.down_since.get(m)
                if since and time.time() - since > PARK_AFTER_S / self.speed:
                    return move(pid, free_rack[0], f'{m} down / offline - raw pallet {pid} parked')
        # (b) feed an idle machine with the most urgent raw pallet (EDD)
        if idle_hmc:
            raw = [pid for pid, s in where.items() if pallets[pid]['content'] == 'raw' and (s in RACK or s == LOAD_SLOT)
                   and not self._pallet_busy(pid)]
            if raw:
                due = {w['id']: (w['due'], w['created']) for w in self.db.q('SELECT * FROM wo')}
                raw.sort(key=lambda pid: due.get(pallets[pid]['wo'], (9e18, 9e18)) if self.rule == 'EDD'
                         else due.get(pallets[pid]['wo'], (0, 9e18))[1])
                for pid in raw:
                    prog = NC_PROGRAM[('HMC', pallets[pid]['variant'])]
                    fit = [m for m in idle_hmc if not self.tools or self.tools.check(m, prog, 1)[0]]
                    if fit:
                        return move(pid, HMC_SLOT[fit[0]], f'raw pallet {pid} -> {fit[0]}')
        # (c) serve the load station
        if not slots.get(LOAD_SLOT):
            if starving:
                empty = pick_empty(pid for pid, s in where.items() if s in RACK and pallets[pid]['content'] == 'empty'
                                   and pallets[pid]['fixture'] == starving and not self._pallet_busy(pid))
                if empty:
                    return move(empty[0], LOAD_SLOT, f'empty pallet {empty[0]} (fixture {starving}) -> load station')
            done = [pid for pid, s in where.items() if s in RACK and pallets[pid]['content'] in ('machined', 'nok')
                    and not self._pallet_busy(pid)]
            if self.oldest:
                done.sort(key=lambda pid: pallets[pid]['since'] or 0)
            if done:
                return move(done[0], LOAD_SLOT, f'machined pallet {done[0]} -> load station')
            for w in self._open_wos():
                empty = pick_empty(pid for pid, s in where.items() if s in RACK and pallets[pid]['content'] == 'empty'
                                   and pallets[pid]['fixture'] == FIXTURE_FOR[w['variant']] and not self._pallet_busy(pid))
                if empty:
                    return move(empty[0], LOAD_SLOT, f"empty pallet {empty[0]} -> load station for {w['id']}")
        # (d) clear the load station when its pallet waits
        lp = slots.get(LOAD_SLOT, 0)
        if lp and not self._pallet_busy(lp) and free_rack:
            c = pallets[lp]['content']
            if c == 'raw' or (c == 'empty' and (not self._open_wos(pallets[lp]['fixture'])
                                                or (starving and pallets[lp]['fixture'] != starving))):
                return move(lp, free_rack[0], f'pallet {lp} load station -> rack {free_rack[0]}')
