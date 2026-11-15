#!/usr/bin/env python3
"""Module circuit library: expand a module (or a kit of modules) into its complete circuit lists (item 8):
IO list with tags and addresses, devices with IEC 81346 designations, cables (WD numbers), terminal plan -XD2,
IO cards and the bill of materials (BOM). Markdown and CSV export.

Python 3 standard library only, offline. Rules = "_rules" in examples/item8_examples.json (one implementation in
circuit_lib_core.py, shared with module_power.py, circuit_svg.py and library_check.py).
Guide: docs/FMS system design/68_module_circuits.md.

  tag          PLT1.MACH.FMS1.<unit>.<group>.<signal>          (unit = UNIT code + 01, 02 ... in a kit)
  designation  =FMS1.<unit>-<class><n>   (n counts per class code in the module) ; cables WD1, WD2 ...
  cards        ceil(used*1.2/channels) per IO type (DI 16, DO 16, AI 4, AO 2, FDI 8, FDO 4) ; spare = cards*ch - used
  address      k-th entry of a type -> TYPE<k//ch + 1>.<k%ch, 2 digits>   e.g. DI1.00, FDI2.07
  terminals    -XD2 1..n: io entries + pattern 'tx' supply terminals (+24V / 0V), io first per instance
  BOM          device items + IO station (bus interface + cards) + 24 V PSU + control terminals
  power cable  (rev. 2026-11-15) per DOL / VFD_STO / HEATER / FEEDER_EXT instance: Ib (motor In or
               kW*1000/(sqrt(3)*400*cos)) -> Ip (MPCB / inverter setting = In, or breaker >= Ib) ->
               A = smallest size with Iz >= Ip/(k_temp*k_group) -> cores text e.g. 4G6 (18 kW heater), 4G35 (M01)

Usage:
  python tools/fmse/circuit_library.py --list                      (modules and patterns)
  python tools/fmse/circuit_library.py --module M03                (= --example: pallet pool + stacker crane)
  python tools/fmse/circuit_library.py --kit                       (the library kit, one block per module instance)
  python tools/fmse/circuit_library.py --modules M01,M01,M04 --out my_kit_lists
  python tools/fmse/circuit_library.py --module M03 --md M03.md --out M03_lists
  python tools/fmse/circuit_library.py --module M03 --json
  python tools/fmse/circuit_library.py --selftest

--out DIR writes io_list.csv, devices.csv, cables.csv, terminals.csv, bom.csv and (modules with power circuits)
power_cables.csv (for a kit: one sub-folder per module instance + kit_bom.csv + kit_cable_types.csv). All values are EXAMPLES. Real circuits need sign-off by qualified electrical / safety
engineers to IEC 60204-1 and the current standards.
"""

import argparse
import json
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, run_main, write_csv
import circuit_lib_core as core
from circuit_lib_core import NOTE

IO_HEAD = ["address", "tag", "type", "description", "group", "pattern"]
DEV_HEAD = ["designation", "class", "description", "BOM item", "group", "location"]
CAB_HEAD = ["cable", "cores", "length m", "description", "group"]
TERM_HEAD = ["strip", "terminal", "kind", "tag", "address", "text"]
BOM_HEAD = ["item", "qty"]
PCAB_HEAD = ["cable", "group", "pattern", "kW", "Ib A", "Ip A", "Ip from", "Iz req A", "A mm2", "Iz*k A", "cores"]
TYPE_HEAD = ["cores", "metres"]


def io_rows(m):
    return [[e["address"], e["tag"], e["type"], e["description"], e["group"], e["pattern"]] for e in m["io"]]


def dev_rows(m):
    return [[d["designation"], d["class"], d["description"], d["bom"], d["group"], d["location"]] for d in m["devices"]]


def cab_rows(m):
    return [[c["cable"], c["cores"], f"{c['length']:g}", c["description"], c["group"]] for c in m["cables"]]


def term_rows(m):
    return [[t["strip"], t["terminal"], t["kind"], t["tag"], t["address"], t["text"]] for t in m["terminals"]]


def pcab_rows(m):
    return [[x["cable"], x["group"], x["pattern"], f"{x['kW']:g}", f"{x['Ib']:.2f}", f"{x['Ip']:g}", x["ip_kind"],
             f"{x['Iz_req']:.2f}", f"{x['A']:g}", f"{x['Iz_corr']:.2f}", x["cores"]] for x in m["power_cables"]]


def type_rows(cores):
    return [[k, f"{v:g}"] for k, v in cores.items()]


def bom_rows(bom):
    return [[k, v] for k, v in bom.items()]


def card_rows(m):
    return [[t, m["used"][t], m["channels"][t], m["cards"][t], m["spare"][t],
             f"{m['spare'][t] / m['used'][t] * 100:.0f} %" if m["used"][t] else "-"]
            for t in core.IO_TYPES if t in m["channels"] and (m["used"][t] or m["cards"][t])]


def summary(m):
    io_t = ", ".join(f"{t} {m['used'][t]}" for t in core.IO_TYPES if m["used"].get(t))
    return [f"io entries {len(m['io'])} ({io_t or 'none'}), IO cards {m['n_cards']}",
            f"devices {len(m['devices'])}, cables {len(m['cables'])} = {m['cable_metres']:g} m, "
            f"terminals -XD2 {len(m['terminals'])}, longest tag {m['max_tag']} characters (max {core.TAG_MAX})"]


def report_module(m, brief=False):
    print(f"MODULE {m['code']}  {m['location']}  {m['title']}")
    for s in summary(m):
        print("  " + s)
    if brief:
        return
    if m["io"]:
        print("\nIO LIST")
        print(fmt_table(IO_HEAD[:5], [r[:5] for r in io_rows(m)], "lllll"))
        print("\nIO CARDS  (cards = ceil(used*1.2/channels), spare = cards*channels - used)")
        print(fmt_table(["type", "used", "channels", "cards", "spare", "spare/used"], card_rows(m), "lrrrrr"))
    if m["devices"]:
        print("\nDEVICES (IEC 81346)")
        print(fmt_table(DEV_HEAD, dev_rows(m), "llllll"))
    if m["cables"]:
        print("\nCABLES")
        print(fmt_table(CAB_HEAD, cab_rows(m), "llrll"))
        print("  metres per cable type: " + ", ".join(f"{k} {v:g} m" for k, v in m["metres_by_cores"].items()))
    if m["power_cables"]:
        print("\nPOWER CABLE SIZING  (Ib -> Ip -> Iz_req = Ip/(k_temp*k_group) -> A = smallest size with Iz >= Iz_req)")
        print(fmt_table(PCAB_HEAD, pcab_rows(m), "lllrrrlrrrl"))
    if m["terminals"]:
        print("\nTERMINAL PLAN")
        print(fmt_table(TERM_HEAD, term_rows(m), "lrllll"))
    print("\nBOM")
    print(fmt_table(BOM_HEAD, bom_rows(m["bom"]), "lr"))


def report_kit(K, brief=True):
    T = K["totals"]
    print(f"KIT  {K['name']}  ({len(K['modules'])} module instances)")
    rows = [[m["unit"], m["code"], len(m["io"]), m["n_cards"], len(m["terminals"]), len(m["cables"]),
             f"{m['cable_metres']:g}", len(m["devices"]), m["max_tag"]] for m in K["modules"]]
    rows.append(["TOTAL", "", T["io"], sum(T["cards"].values()), T["terms"], T["cables"], f"{T['metres']:g}",
                 T["devices"], ""])
    print(fmt_table(["unit", "module", "io", "cards", "terminals", "cables", "metres", "devices", "max tag"], rows))
    print("  io used per type: " + ", ".join(f"{t} {v}" for t, v in T["used"].items()))
    print("  cards per type:   " + ", ".join(f"{t} {v}" for t, v in T["cards"].items()))
    print("  metres per cable type: " + ", ".join(f"{k} {v:g} m" for k, v in T["metres_by_cores"].items()))
    if not brief:
        for m in K["modules"]:
            print()
            report_module(m)
    print("\nKIT BOM")
    print(fmt_table(BOM_HEAD, bom_rows(T["bom"]), "lr"))


def md_table(head, rows):
    out = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return out


def markdown_module(m):
    L = [f"# Module {m['code']} {m['location']}: {m['title']}", ""] + ["- " + s for s in summary(m)] + [""]
    if m["io"]:
        L += ["## IO list", ""] + md_table(IO_HEAD, io_rows(m)) + [""]
        L += ["## IO cards", ""] + md_table(["type", "used", "channels", "cards", "spare", "spare/used"],
                                             card_rows(m)) + [""]
    if m["devices"]:
        L += ["## Devices (IEC 81346)", ""] + md_table(DEV_HEAD, dev_rows(m)) + [""]
    if m["cables"]:
        L += ["## Cables", ""] + md_table(CAB_HEAD, cab_rows(m)) + [""]
        L += ["Metres per cable type: " + ", ".join(f"{k} {v:g} m" for k, v in m["metres_by_cores"].items()), ""]
    if m["power_cables"]:
        L += ["## Power cable sizing", "", "Ib -> Ip (MPCB / inverter setting or breaker) -> Iz_req = Ip/(k_temp*k_group)"
              " -> A = smallest table size with Iz >= Iz_req.", ""] + md_table(PCAB_HEAD, pcab_rows(m)) + [""]
    if m["terminals"]:
        L += ["## Terminal plan -XD2", ""] + md_table(TERM_HEAD, term_rows(m)) + [""]
    L += ["## BOM", ""] + md_table(BOM_HEAD, bom_rows(m["bom"])) + ["", "_" + NOTE + "_"]
    return "\n".join(L) + "\n"


def markdown_kit(K):
    T = K["totals"]
    L = [f"# Kit: {K['name']}", "", f"Modules: {', '.join(m['unit'] for m in K['modules'])}", "",
         f"- io {T['io']}, cards {sum(T['cards'].values())}, terminals {T['terms']}, cables {T['cables']} = "
         f"{T['metres']:g} m, devices {T['devices']}", ""]
    L += ["## Kit BOM", ""] + md_table(BOM_HEAD, bom_rows(T["bom"])) + [""]
    L += ["## Kit cable types (metres per cores)", ""] + md_table(TYPE_HEAD, type_rows(T["metres_by_cores"])) + [""]
    for m in K["modules"]:
        L += [markdown_module(m).replace("# Module", "## Module", 1).replace("\n## ", "\n### ")]
    L += ["_" + NOTE + "_"]
    return "\n".join(L) + "\n"


def write_lists(m, folder):
    d = Path(folder)
    d.mkdir(parents=True, exist_ok=True)
    files = [write_csv(d / "io_list.csv", IO_HEAD, io_rows(m)), write_csv(d / "devices.csv", DEV_HEAD, dev_rows(m)),
             write_csv(d / "cables.csv", CAB_HEAD, cab_rows(m)),
             write_csv(d / "terminals.csv", TERM_HEAD, term_rows(m)),
             write_csv(d / "bom.csv", BOM_HEAD, bom_rows(m["bom"]))]
    if m["power_cables"]:
        files.append(write_csv(d / "power_cables.csv", PCAB_HEAD, pcab_rows(m)))
    return files


def write_kit(K, folder):
    files = []
    for m in K["modules"]:
        files += write_lists(m, Path(folder) / m["unit"])
    files.append(write_csv(Path(folder) / "kit_bom.csv", BOM_HEAD, bom_rows(K["totals"]["bom"])))
    files.append(write_csv(Path(folder) / "kit_cable_types.csv", TYPE_HEAD, type_rows(K["totals"]["metres_by_cores"])))
    return files


def list_library(L):
    print("MODULES")
    rows = [[c, L["unit_codes"][c], len(m.get("instances", [])), m.get("title", "")] for c, m in L["modules"].items()]
    print(fmt_table(["code", "unit", "instances", "title"], rows, "llrl"))
    print("\nPATTERNS")
    rows = [[n, len(p["io"]), len(p["dev"]), len(p["cab"]), p.get("title", "")] for n, p in L["patterns"].items()]
    print(fmt_table(["pattern", "io", "dev", "cab", "title"], rows, "lrrrl"))
    print(f"\nlibrary kit: {', '.join(L.get('kit', {}).get('modules', []))}")


def module_json(m):
    keep = ("code", "unit", "title", "location", "io", "devices", "cables", "terminals", "used", "cards", "spare",
            "n_cards", "bom", "cable_metres", "metres_by_cores", "power_cables", "max_tag")
    return {k: m[k] for k in keep}


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    import tempfile
    t = SelfTest("circuit_library")
    L = core.load_library(path)
    t.equal("22 modules, 32 patterns (ZONE_OUT added 2026-11-15)", (len(L["modules"]), len(L["patterns"])), (22, 32))
    for code, R in core.REF_MODULES.items():
        m = core.expand_module(L, code)
        io_t = {k: v for k, v in m["used"].items() if v}
        cards = {k: v for k, v in m["cards"].items() if v}
        t.equal(f"{code} {R['unit']}: io {R['io']} {R['io_t']}", (m["unit"], len(m["io"]), io_t),
                (R["unit"], R["io"], R["io_t"]))
        t.equal(f"{code} cards {R['cards']}", cards, R["cards"])
        t.equal(f"{code} terminals {R['term']}, cables {R['cab']} = {R['m']} m, devices {R['dev']}, max tag "
                f"{R['maxtag']}", (len(m["terminals"]), len(m["cables"]), m["cable_metres"], len(m["devices"]),
                                   m["max_tag"]), (R["term"], R["cab"], R["m"], R["dev"], R["maxtag"]))
    m = core.expand_module(L, "M03")
    got = [(e["address"], e["tag"], e["type"]) for e in m["io"]]
    t.equal("M03 IO list: 31 entries, tags + addresses + types = reference", got, [tuple(x) for x in core.REF_M03_IO])
    t.equal("M03 first entry FDO1.00 DriveSup.Enable", got[0][:2], ("FDO1.00", "PLT1.MACH.FMS1.POOL01.DriveSup.Enable"))
    t.equal("M03 9th FDI goes to card 2: FDI2.00 Enable.Ok2", got[20][:2], ("FDI2.00", "PLT1.MACH.FMS1.POOL01.Enable.Ok2"))
    t.equal("M03 BOM = reference", m["bom"], core.REF_M03_BOM)
    t.equal("M03 spare FDI 2*8-11 = 5, FDO 2*4-5 = 3", (m["spare"]["FDI"], m["spare"]["FDO"]), (5, 3))
    des = [d["designation"] for d in m["devices"]]
    t.equal("M03 designations: QA1, QA2 (contactor pair), FC1, TA1, MA1 ...", des[:5],
            ["=FMS1.POOL01-QA1", "=FMS1.POOL01-QA2", "=FMS1.POOL01-FC1", "=FMS1.POOL01-TA1", "=FMS1.POOL01-MA1"])
    t.equal("M03 last device = signal tower PF1", des[-1], "=FMS1.POOL01-PF1")
    t.equal("M03 cables WD1 = Travel motor cable sized 4G4 + shield (11 kW, 22.0 A), WD16 = tower 7x0.5",
            (m["cables"][0]["cable"], m["cables"][0]["cores"], m["cables"][-1]["cable"], m["cables"][-1]["cores"]),
            ("WD1", "4G4 + shield", "WD16", "7x0.5"))
    t.equal("M03 cable cores list = reference (Travel 4G4, Hoist 4G2.5, Fork 4G1.5 + shield)",
            [c["cores"] for c in m["cables"]], core.REF_M03_CORES)
    for code, R in core.REF_PCABS.items():
        mm = core.expand_module(L, code)
        got = [(x["group"], x["pattern"], round(x["Ib"], 2), x["Ip"], x["A"]) for x in mm["power_cables"]]
        t.equal(f"{code} power cables (group, pattern, Ib, Ip, A) = {R}", got, R)
    nopc = [c for c in L["modules"] if c not in core.REF_PCABS and core.expand_module(L, c)["power_cables"]]
    t.equal("modules without pcab instances have no power-cable rows", nopc, [])
    m10 = core.expand_module(L, "M10")
    h = next(x for x in m10["power_cables"] if x["group"] == "Heater")
    t.close("hand: heater 18 kW Ib = 18000/(sqrt(3)*400*1.0) = 25.98 A", h["Ib"], 25.981, 1e-3)
    t.equal("heater Ip 32 A, Iz_req 32/(0.87*0.77) = 47.77 A -> 6 mm2 (51 A) -> cores 4G6",
            (h["Ip"], round(h["Iz_req"], 2), h["A"], h["cores"]), (32, 47.77, 6, "4G6"))
    hp = core.expand_module(L, "M16")["power_cables"][0]
    t.equal("M16 HydPump 15 kW: Ib 30.0 A = Ip, Iz_req 44.78 A -> 4G6", (round(hp["Ib"], 2), hp["Ip"],
            round(hp["Iz_req"], 2), hp["cores"]), (30.0, 30.0, 44.78, "4G6"))
    wp = [x for x in core.expand_module(L, "M15")["power_cables"] if x["group"] == "WeldPwr"][0]
    t.equal("M15 WeldPwr 4G10, M01 Supply 4G35",
            (wp["cores"], core.expand_module(L, "M01")["power_cables"][0]["cores"]), ("4G10", "4G35"))
    t.true("every power cable: cores text cross-section = A, Iz*k >= Ip >= Ib",
           all(x["A_cable"] == x["A"] and x["Iz_corr"] >= x["Ip"] - 1e-9 and x["Ip"] >= round(x["Ib"], 2) - 1e-9
               for c in L["modules"] for x in core.expand_module(L, c)["power_cables"]))
    m18 = core.expand_module(L, "M18")
    t.equal("M18 IO list (4 ZONE_OUT zones first: FDO1.00 Zone1.Release, FDI1.00 Zone1.Fb ...) = reference",
            [(e["address"], e["tag"], e["type"]) for e in m18["io"]], [tuple(x) for x in core.REF_M18_IO])
    t.equal("M18 BOM = reference (4 zone interface terminal blocks, FDO 4 card x2)", m18["bom"], core.REF_M18_BOM)
    t.equal("M18 cables: 4 x 'Control cable to the zone' 4x0.75 20 m",
            [(c["cores"], c["length"]) for c in m18["cables"] if c["description"] == "Control cable to the zone"],
            [("4x0.75", 20.0)] * 4)
    tm = m["terminals"]
    t.equal("M03 door instance: terminals 12..17 = 6 io, then 18 +24V, 19 0V",
            [(x["terminal"], x["kind"]) for x in tm[11:19]],
            [(12, "io"), (13, "io"), (14, "io"), (15, "io"), (16, "io"), (17, "io"), (18, "+24V"), (19, "0V")])
    t.equal("M03 terminal numbers run 1..42 without gaps", [x["terminal"] for x in tm], list(range(1, 43)))
    m21 = core.expand_module(L, "M21")
    t.equal("M21 (no field circuits): no io, no station, empty BOM", (len(m21["io"]), m21["station"], m21["bom"]),
            (0, False, {}))
    K = core.library_kit(L)
    T, R = K["totals"], core.REF_KIT
    t.equal(f"kit: 18 module instances, units MC01..MC03", [m["unit"] for m in K["modules"][:3]],
            ["MC01", "MC02", "MC03"])
    t.equal(f"kit io {R['io']}", T["io"], R["io"])
    t.equal(f"kit cards {R['cards']}", T["cards"], R["cards"])
    t.equal(f"kit used {R['used']}", T["used"], R["used"])
    t.equal(f"kit terminals {R['terms']}, cables {R['cables']} = {R['metres']} m, devices {R['devices']}",
            (T["terms"], T["cables"], T["metres"], T["devices"]), (R["terms"], R["cables"], R["metres"], R["devices"]))
    tags = [e["tag"] for m in K["modules"] for e in m["io"]]
    t.equal("kit: 210 tags, all unique (own unit number per module instance)", (len(tags), len(set(tags))), (210, 210))
    t.equal("kit cards total 57 (FDI 12, FDO 9)", sum(T["cards"].values()), 57)
    t.equal("kit metres per cable type = reference (4G35 45 m, 4G6 10 m, 4G4 + shield 15 m ...)",
            T["metres_by_cores"], core.REF_KIT_CORES)
    t.true("kit: MC02 has its own tags", "PLT1.MACH.FMS1.MC02.Safety.EstopIn" in tags)
    C = core.expand_kit(L, core.module_codes(L, "m01, M01,M04"))
    t.equal("custom kit M01,M01,M04 -> MC01, MC02, LS01; io 8+8+20", ([m["unit"] for m in C["modules"]],
            C["totals"]["io"]), (["MC01", "MC02", "LS01"], 36))
    for bad in ("M99", ""):
        try:
            core.module_codes(L, bad)
            t.true(f"bad module list {bad!r} rejected", False)
        except InputError:
            t.true(f"bad module list {bad!r} rejected", True)
    with tempfile.TemporaryDirectory() as d:
        files = write_lists(m, d)
        t.equal("--out writes 6 CSV files (M03 has power cables)", sorted(p.name for p in files),
                ["bom.csv", "cables.csv", "devices.csv", "io_list.csv", "power_cables.csv", "terminals.csv"])
        cl = (Path(d) / "cables.csv").read_text(encoding="utf-8-sig").splitlines()
        t.equal("cables.csv row WD1 shows the sized text 4G4 + shield", cl[1].split(";")[:2], ["WD1", "4G4 + shield"])
        pl = (Path(d) / "power_cables.csv").read_text(encoding="utf-8-sig").splitlines()
        t.equal("power_cables.csv: header + 3 rows, Travel 22.00 A -> 4 mm2",
                (len(pl), pl[1].split(";")[1], pl[1].split(";")[4], pl[1].split(";")[8]), (4, "Travel", "22.00", "4"))
        lines = (Path(d) / "io_list.csv").read_text(encoding="utf-8-sig").splitlines()
        t.equal("io_list.csv: header + 31 rows, first row FDO1.00", (len(lines), lines[1].split(";")[0]), (32, "FDO1.00"))
        kf = write_kit(C, Path(d) / "kit")
        t.equal("kit export: 3 folders x 6 files + kit_bom.csv + kit_cable_types.csv", len(kf), 20)
    md = markdown_module(m)
    t.true("markdown has IO list, devices, terminal plan and the note",
           all(s in md for s in ("## IO list", "## Devices", "## Terminal plan", "EXAMPLES")))
    t.true("markdown has the power cable sizing table with 4G4 + shield", "## Power cable sizing" in md and
           "| 4G4 + shield |" in md)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(core.ITEM8_EXAMPLES), help="library JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the example (module M03, also the default)")
    ap.add_argument("--list", action="store_true", help="list modules and patterns")
    ap.add_argument("--module", help="module code, e.g. M03")
    ap.add_argument("--kit", action="store_true", help="the library kit (section 'kit')")
    ap.add_argument("--modules", help="own kit: comma list of module codes, e.g. M01,M01,M04")
    ap.add_argument("--full", action="store_true", help="kit: print every module's lists too")
    ap.add_argument("--md", help="write Markdown")
    ap.add_argument("--out", help="write the CSV lists into this folder")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    L = core.load_library(a.examples)
    if a.list:
        list_library(L)
        return 0
    if a.kit or a.modules:
        K = core.library_kit(L) if a.kit else core.expand_kit(L, core.module_codes(L, a.modules))
        if a.json:
            print(json.dumps({"name": K["name"], "totals": K["totals"], "modules": [module_json(m) for m in
                              K["modules"]], "note": NOTE}, indent=1, ensure_ascii=False))
            return 0
        report_kit(K, brief=not a.full)
        out_md, files = markdown_kit(K), write_kit(K, a.out) if a.out else []
    else:
        code = (a.module or "M03").upper()
        m = core.expand_module(L, code)
        if a.json:
            out = module_json(m)
            out["note"] = NOTE
            print(json.dumps(out, indent=1, ensure_ascii=False))
            return 0
        report_module(m)
        out_md, files = markdown_module(m), write_lists(m, a.out) if a.out else []
    print()
    print(NOTE)
    if a.md:
        p = Path(a.md)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(out_md, encoding="utf-8")
        print(f"\nMarkdown written: {p}")
    if files:
        print(f"CSV written: {len(files)} files in {a.out}")
    return 0


if __name__ == "__main__":
    run_main(main)
