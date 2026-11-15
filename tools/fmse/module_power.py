#!/usr/bin/env python3
"""Power of a module and of a kit (item 8): motors (rated current, contactor or inverter size, MPCB setting),
demand load list, installed current, feeder breaker, feeder cable, 24 V current + PSU, cabinet losses, and the
distribution-board schedule of a kit (one feeder per module instance).

Python 3 standard library only, offline. Rules = "_rules" motor / power / dc24 / loss in
examples/item8_examples.json (one implementation in circuit_lib_core.py). Guide:
docs/FMS system design/68_module_circuits.md. Item 7 gives the principles (load_list.py, cable_size.py).

  motor     In = kW*1000/(sqrt(3)*400*eta*cos)   eta 0.88, cos 0.82 unless given
            DOL: contactor = smallest AC-3 rating >= In, MPCB setting = In ; VFD: size = smallest vfd_kw >= kW
  demand    P = sum kW*ku ; Q = sum P_i*tan(acos cos_i) ; S = sqrt(P^2 + Q^2) ; I = S*1000/(sqrt(3)*400)
            ku: feeder from params, motors 0.7, heater 0.8, control power (PSU*24/0.9/1000 kW) 0.6
  feeder    installed values (ku = 1): I_inst ; breaker In = smallest rating >= I_inst ;
            cable = smallest size with Iz_table >= In/(k_temp*k_group) ; no load -> no feeder
  24 V      i24 = sum pattern i24 + IO station (0.3 + 0.05*cards) ; PSU = smallest size >= 1.25*i24
  losses    pattern losses (VFD 3 % of kW) + IO station (4 + 1*cards W) + PSU*24*(1/0.92 - 1)
  board     one feeder per module instance: =FMS1.<unit>-FC<next free number>, breaker In, cable mm2
  power cable (rev. 2026-11-15) per DOL / VFD_STO / HEATER / FEEDER_EXT instance:
            Ib = motor In or kW*1000/(sqrt(3)*400*cos) ; Ip = Ib (MPCB / inverter setting, round 2) or smallest
            breaker >= Ib (heater, feeder) ; A = smallest size with Iz >= Ip/(k_temp*k_group) ; cores 4G<A>

Usage:
  python tools/fmse/module_power.py                        (= --example: all modules + library kit board)
  python tools/fmse/module_power.py --module M03           (one module in detail)
  python tools/fmse/module_power.py --kit                  (distribution-board schedule of the library kit)
  python tools/fmse/module_power.py --cables               (power cable sizing table of every module)
  python tools/fmse/module_power.py --modules M01,M01,M03,M10 --md board.md --csv board.csv
  python tools/fmse/module_power.py --json
  python tools/fmse/module_power.py --selftest

All values are EXAMPLES (motor kW used as electrical kW in the load list). Real feeders and starters are sized and
signed off by a qualified electrical engineer to IEC 60204-1 / IEC 60364 with the current editions and data sheets.
"""

import argparse
import json
from pathlib import Path

from fmse_common import SelfTest, fmt_table, run_main, write_csv
import circuit_lib_core as core
from circuit_lib_core import NOTE

MOD_HEAD = ["module", "unit", "motors", "i24 A", "PSU A", "P kW", "S kVA", "I A", "I_inst A", "In A", "cable mm2",
            "loss W"]
PCAB_HEAD = ["module", "cable", "group", "pattern", "kW", "Ib A", "Ip A", "Ip from", "Iz req A", "A mm2",
             "Iz*k A", "cores"]
BOARD_HEAD = ["no", "designation", "module", "unit", "P_inst kW", "I_inst A", "I demand A", "breaker In A",
              "cable mm2", "Iz corr A"]


def r(x, n):
    return round(x + 0.0, n)


def module_row(m):
    f = m["feeder"]
    return [m["code"], m["unit"], len(m["motors"]), f"{m['i24']:.3f}", f"{m['psu']:g}", f"{m['P']:.3f}",
            f"{m['S']:.3f}", f"{m['I']:.2f}", f"{m['I_inst']:.2f}", f"{f['In']:g}", f"{f['A']:g}", f"{m['loss']:.1f}"]


def motor_rows(m):
    out = []
    for x in m["motors"]:
        if x["pattern"] == "DOL":
            size = f"contactor AC-3 {x['size']} A, MPCB set {x['mpcb_setting']:.2f} A"
        else:
            size = f"inverter {x['size']:g} kW"
        out.append([x["group"], x["pattern"], f"{x['kW']:g}", f"{x['In']:.3f}", size if x["size"] else
                    "NO STANDARD SIZE - check the tables"])
    return out


def load_rows(m):
    return [[ld["name"], ld["kind"], f"{ld['kW']:.4g}", f"{ld['ku']:g}", f"{ld['cos']:g}", f"{ld['kW'] * ld['ku']:.3f}"]
            for ld in m["loads"]]


def pcab_rows(m):
    return [[m["code"], x["cable"], x["group"], x["pattern"], f"{x['kW']:g}", f"{x['Ib']:.2f}", f"{x['Ip']:g}",
             x["ip_kind"], f"{x['Iz_req']:.2f}", f"{x['A']:g}", f"{x['Iz_corr']:.2f}", x["cores"]]
            for x in m["power_cables"]]


def report_cables(mods):
    print("POWER CABLE SIZING  (Ib <= Ip <= Iz*k_temp*k_group ; A = smallest size with Iz >= Ip/(k_temp*k_group))")
    rows = [rw for m in mods for rw in pcab_rows(m)]
    print(fmt_table(PCAB_HEAD, rows, "llllrrrlrrrl"))


def board_rows(K):
    rows, n = [], 0
    for m in K["modules"]:
        f = m["feeder"]
        if not f["In"]:
            continue
        n += 1
        rows.append([n, f["designation"], m["code"], m["unit"], f"{m['P_inst']:.3f}", f"{m['I_inst']:.2f}",
                     f"{m['I']:.2f}", f"{f['In']:g}", f"{f['A']:g}", f"{f['Iz_corr']:.2f}"])
    return rows


def report_module(m):
    f = m["feeder"]
    print(f"MODULE {m['code']}  {m['location']}  {m['title']}")
    if m["motors"]:
        print("\nMOTORS  (In = kW*1000/(sqrt(3)*400*eta*cos))")
        print(fmt_table(["group", "pattern", "kW", "In A", "starter / inverter"], motor_rows(m), "llrrl"))
    if m["power_cables"]:
        print("\nPOWER CABLE SIZING  (Ib -> Ip -> Iz_req = Ip/(k_temp*k_group) -> A)")
        print(fmt_table(PCAB_HEAD[1:], [rw[1:] for rw in pcab_rows(m)], "lllrrrlrrrl"))
    if m["loads"]:
        print("\nLOAD LIST (demand)")
        print(fmt_table(["load", "kind", "kW", "ku", "cos", "P_d kW"], load_rows(m), "llrrrr"))
    print(f"\n  demand     P = {m['P']:.3f} kW  Q = {m['Q']:.3f} kvar  S = {m['S']:.3f} kVA  I = {m['I']:.2f} A")
    print(f"  installed  P = {m['P_inst']:.3f} kW  S = {m['S_inst']:.3f} kVA  I_inst = {m['I_inst']:.2f} A")
    if f["In"]:
        print(f"  feeder {f['designation']}: breaker In = {f['In']:g} A >= I_inst {m['I_inst']:.2f} A ; "
              f"required Iz = {f['In']:g}/({m['k_cable']:.4f}) = {f['Iz_req']:.2f} A -> {f['A']:g} mm2 "
              f"(table {f['Iz']:g} A, corrected {f['Iz_corr']:.2f} A)")
    else:
        print("  no electrical load -> no feeder")
    print(f"  24 V: patterns {m['i24_patterns']:.3f} A + IO station {m['station_i24']:.3f} A = {m['i24']:.3f} A ; "
          f"x1.25 = {m['psu_need']:.3f} A -> PSU {m['psu']:g} A")
    print(f"  losses: patterns {m['loss_patterns']:.1f} W + station {m['station_loss']:.1f} W + PSU "
          f"{m['psu_loss']:.1f} W = {m['loss']:.1f} W")


def report_all(L, mods):
    print("MODULE POWER (one instance of every module)")
    print(fmt_table(MOD_HEAD, [module_row(m) for m in mods]))


def report_board(K):
    T = K["totals"]
    print(f"DISTRIBUTION-BOARD SCHEDULE  kit: {K['name']}  ({len(K['modules'])} module instances)")
    print(fmt_table(BOARD_HEAD, board_rows(K)))
    nofeed = [m["unit"] for m in K["modules"] if not m["feeder"]["In"]]
    if nofeed:
        print(f"  no feeder (no load): {', '.join(nofeed)}")
    print(f"  kit demand P = {T['P']:.3f} kW, S = {T['S']:.3f} kVA (arithmetic sum of the module S, ks = 1), "
          f"sum I = {T['I']:.2f} A")
    print(f"  kit PSU sum = {T['psu']:g} A, 24 V current sum = {T['i24']:.3f} A, cabinet losses = {T['loss']:.1f} W")


def markdown(K, mods):
    def tab(head, rows):
        return ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)] + \
               ["| " + " | ".join(str(c) for c in rw) + " |" for rw in rows]
    T = K["totals"]
    L = ["# Module power and distribution board", "", "## Modules", ""] + tab(MOD_HEAD, [module_row(m) for m in mods])
    L += ["", "## Power cable sizing (per instance)", ""] + tab(PCAB_HEAD, [rw for m in mods for rw in pcab_rows(m)])
    L += ["", f"## Distribution-board schedule: {K['name']}", ""] + tab(BOARD_HEAD, board_rows(K))
    L += ["", f"- kit P = {T['P']:.3f} kW, S = {T['S']:.3f} kVA, PSU sum {T['psu']:g} A, losses {T['loss']:.1f} W",
          "", "_" + NOTE + "_"]
    return "\n".join(L) + "\n"


def module_json(m):
    keep = ("code", "unit", "motors", "loads", "P", "Q", "S", "I", "P_inst", "S_inst", "I_inst", "feeder", "i24",
            "psu", "loss", "power_cables")
    return {k: m[k] for k in keep}


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("module_power")
    L = core.load_library(path)
    for code, R in core.REF_MODULES.items():
        m = core.expand_module(L, code)
        f = m["feeder"]
        t.equal(f"{code} i24 {R['i24']} A, PSU {R['psu']} A, loss {R['loss']} W",
                (r(m["i24"], 3), m["psu"], r(m["loss"], 1)), (R["i24"], R["psu"], R["loss"]))
        t.equal(f"{code} demand P {R['P']} kW, S {R['S']} kVA, I {R['I']} A",
                (r(m["P"], 3), r(m["S"], 3), r(m["I"], 2)), (R["P"], R["S"], R["I"]))
        t.equal(f"{code} I_inst {R['Iinst']} A -> feeder In {R['In']} A, cable {R['A']} mm2",
                (r(m["I_inst"], 2), f["In"], f["A"]), (R["Iinst"], R["In"], R["A"]))
        got = [(x["group"], x["pattern"], x["kW"], r(x["In"], 3), x["size"]) for x in m["motors"]]
        if R["motors"]:
            t.equal(f"{code} motors {R['motors']}", got, R["motors"])
    m = core.expand_module(L, "M10")
    t.close("hand: 7.5 kW In = 7500/(sqrt(3)*400*0.88*0.82) = 15.002 A", m["motors"][0]["In"], 15.0021, 1e-3)
    t.equal("M10 spray pump 15.002 A -> contactor 18 A, MPCB set 15.0 A",
            (m["motors"][0]["contactor"], m["motors"][0]["mpcb_setting"]), (18, 15.0))
    t.close("M10 demand P = 0.7*(7.5+3+0.37) + 0.8*18 + 0.6*2.5*24/0.9/1000 = 22.049", m["P"], 22.049, 1e-9)
    m = core.expand_module(L, "M01")
    t.close("M01 I_inst: 38 kW cos 0.85 + 0.0667 kW cos 0.95 -> 64.626 A", m["I_inst"], 64.6258, 1e-3)
    t.close("M01 required Iz 80/(0.87*0.77) = 119.42 > 119 (25 mm2) -> 35 mm2", m["feeder"]["Iz_req"], 119.42, 0.01)
    t.equal("M01 feeder designation (FEEDER_EXT already has FC1) = =FMS1.MC01-FC2", m["feeder"]["designation"],
            "=FMS1.MC01-FC2")
    m = core.expand_module(L, "M03")
    t.close("M03 losses: 6 + 3 % of 20 kW = 600 + 2 + 3 + station 10 + PSU 10.435 = 631.43 W", m["loss"], 631.435,
            1e-3)
    for code, R in core.REF_PCABS.items():
        mm = core.expand_module(L, code)
        got = [(x["group"], x["pattern"], round(x["Ib"], 2), x["Ip"], x["A"]) for x in mm["power_cables"]]
        t.equal(f"{code} power cable sizing (Ib, Ip, A) = reference", got, R)
    h = [x for x in core.expand_module(L, "M10")["power_cables"] if x["group"] == "Heater"][0]
    t.equal("M10 heater 18 kW: Ib 25.98 A -> breaker Ip 32 A -> 6 mm2 -> 4G6 (was 4G2.5)",
            (round(h["Ib"], 2), h["Ip"], h["ip_kind"], h["A"], h["cores"]), (25.98, 32, "breaker", 6, "4G6"))
    hp = core.expand_module(L, "M16")["power_cables"][0]
    t.equal("M16 HydPump 15 kW: Ib = Ip = 30.0 A (MPCB setting) -> 6 mm2 -> 4G6 (was 4G1.5)",
            (round(hp["Ib"], 2), hp["Ip"], hp["ip_kind"], hp["cores"]), (30.0, 30.0, "MPCB setting", "4G6"))
    sup = core.expand_module(L, "M01")["power_cables"][0]
    t.equal("M01 Supply 38 kW cos 0.85 (FEEDER_EXT, ku ignored): Ib 64.53 A -> 80 A -> 35 mm2 -> 4G35",
            (round(sup["Ib"], 2), sup["Ip"], sup["cores"]), (64.53, 80, "4G35"))
    t.true("every power cable: Ib <= Ip <= Iz*k (item 7 rule)",
           all(round(x["Ib"], 2) <= x["Ip"] + 1e-9 and x["Ip"] <= x["Iz_corr"] + 1e-9
               for c in L["modules"] for x in core.expand_module(L, c)["power_cables"]))
    m18 = core.expand_module(L, "M18")
    t.equal("M18 with 4 ZONE_OUT: i24 1.82 A (0.05 per zone), PSU 2.5 A, loss 37.2 W",
            (r(m18["i24"], 3), m18["psu"], r(m18["loss"], 1)), (1.82, 2.5, 37.2))
    m21 = core.expand_module(L, "M21")
    t.equal("M21: no load -> In 0, cable 0, PSU 0, no designation",
            (m21["feeder"]["In"], m21["feeder"]["A"], m21["psu"], m21["feeder"]["designation"]), (0, 0, 0, ""))
    K = core.library_kit(L)
    T, R = K["totals"], core.REF_KIT
    t.equal(f"kit P {R['P']} kW, S {R['S']} kVA (sum of module S), PSU {R['psu']} A, loss {R['loss']} W",
            (T["P"], T["S"], T["psu"], T["loss"]), (R["P"], R["S"], R["psu"], R["loss"]))
    rows = board_rows(K)
    t.equal("board: 18 instances, all have a load -> 18 feeders", len(rows), 18)
    t.equal("board row 1 = =FMS1.MC01-FC2, 80 A, 35 mm2", (rows[0][1], rows[0][7], rows[0][8]),
            ("=FMS1.MC01-FC2", "80", "35"))
    t.equal("board POOL01 = =FMS1.POOL01-FC4 (3 inverter FC), 40 A, 10 mm2", (rows[6][1], rows[6][7], rows[6][8]),
            ("=FMS1.POOL01-FC4", "40", "10"))
    t.true("board: every feeder In >= I_inst and Iz corrected >= In",
           all(m["feeder"]["In"] >= m["I_inst"] and m["feeder"]["Iz_corr"] >= m["feeder"]["In"] - 1e-9
               for m in K["modules"] if m["feeder"]["In"]))
    md = markdown(K, [core.expand_module(L, c) for c in L["modules"]])
    t.true("markdown has the board schedule and the note", "Distribution-board" in md and "EXAMPLES" in md)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(core.ITEM8_EXAMPLES), help="library JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="all modules + library kit board (also the default)")
    ap.add_argument("--module", help="one module in detail, e.g. M03")
    ap.add_argument("--kit", action="store_true", help="distribution-board schedule of the library kit")
    ap.add_argument("--cables", action="store_true", help="power cable sizing table of every module")
    ap.add_argument("--modules", help="own kit: comma list of module codes")
    ap.add_argument("--md", help="write Markdown (modules + board)")
    ap.add_argument("--csv", help="write the board schedule as CSV")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    L = core.load_library(a.examples)
    K = core.expand_kit(L, core.module_codes(L, a.modules)) if a.modules else core.library_kit(L)
    if a.module and not (a.kit or a.modules):
        m = core.expand_module(L, a.module.upper())
        if a.json:
            print(json.dumps({**module_json(m), "note": NOTE}, indent=1, ensure_ascii=False))
            return 0
        report_module(m)
        print()
        print(NOTE)
        return 0
    mods = [core.expand_module(L, c) for c in L["modules"]]
    if a.cables and not a.json:
        report_cables(mods)
        print()
        print(NOTE)
        return 0
    if a.json:
        print(json.dumps({"modules": [module_json(m) for m in mods], "kit": K["name"],
                          "board": [dict(zip(BOARD_HEAD, rw)) for rw in board_rows(K)], "totals":
                          {k: v for k, v in K["totals"].items() if k != "bom"}, "note": NOTE}, indent=1,
                         ensure_ascii=False))
        return 0
    if not (a.kit or a.modules):
        report_all(L, mods)
        print()
        report_cables(mods)
        print()
    report_board(K)
    print()
    print(NOTE)
    if a.md:
        p = Path(a.md)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(markdown(K, mods), encoding="utf-8")
        print(f"\nMarkdown written: {p}")
    if a.csv:
        print(f"CSV written: {write_csv(a.csv, BOARD_HEAD, board_rows(K))}")
    return 0


if __name__ == "__main__":
    run_main(main)
