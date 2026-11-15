#!/usr/bin/env python3
"""Interface sheet of the standard module data block: Modbus, PROFINET, OPC UA, MQTT Sparkplug B and tag name.

Python 3 standard library only, offline. The mappings are the ones of the web page 6F (web/fmse6.js drawMap);
BLOCK / EXTRA / KITS / MODDEV are read from web/fmse6_data.js and UNIT from web/fmse6.js. The tag name is the item-5
data-block tag (examples/item5_examples.json "_formulas.datablock_tags", same as tag_namer.py --generate) and is
checked with the item-5 tag rule. Guide: docs/FMS system design/66_communication.md.

Per block row (words 0-19 standard + module part from word 20):
  Modbus     word range ; holding register 4xxxx = '4' + (base + word + 1) with 4 digits (1-based) ;
             PDU address = base + word (0-based) ; access: in = write (FC06 / FC16), out = read (FC03), in/out both
  PROFINET   module outputs ('out') are controller INPUTS %IB, 'in' are OUTPUTS %QB, 'in/out' both ; byte
             counters start at the start byte and grow by 2 x words in the order of the block
  OPC UA     browse path Objects/<unit>/<group>/<item> ; NodeId ns=2;s=<unit>.<name> ; type INT Int16, DINT Int32,
             REAL Float, WORD / UINT UInt16, STRING String, others UInt16 ; access in Read/Write, out Read (subscribe)
  Sparkplug  metric = name with the first '.' -> '/' ; topic spBv1.0/<group>/DCMD|DDATA/<edge>/<unit>
             (DCMD for 'in', DDATA for 'out' and 'in/out')
  Tag        <site>.<area>.<cell>.<unit>.<group>.<item> (6 parts), <= 48 characters
A kit (web KITS) gives the units like the IP plan: unit = UNIT code + 2-digit counter per module; the network /
SCADA / MES modules M20-M22 have no data block (same as the module list of web 6F).

Usage:
  python tools/fmse/datablock_map.py                          (kit of the JSON ip_plan = --example)
  python tools/fmse/datablock_map.py --module M01 --unit MC02 --base 0
  python tools/fmse/datablock_map.py --md sheet.md --csv sheet.csv
  python tools/fmse/datablock_map.py --kit "FMC (1 HMC + rack)" --json
  python tools/fmse/datablock_map.py --selftest
"""

import argparse
import json
import re
from pathlib import Path

from fmse_common import ITEM5_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, read_js_const, run_main, write_csv
from ip_plan import WEB_DATA, kit_units, read_unit
import tag_namer

HERE = Path(__file__).resolve().parent
ITEM6_EXAMPLES = HERE / "examples" / "item6_examples.json"
UATYPE = {"INT": "Int16", "DINT": "Int32", "REAL": "Float", "WORD": "UInt16", "UINT": "UInt16"}
NO_BLOCK = ("M20", "M21", "M22")
HEAD = ["Unit", "Module", "Word", "HoldingReg", "PDU", "Name", "Type", "Dir", "ModbusAccess", "PNArea", "PNAddress",
        "UABrowsePath", "UANodeId", "UAType", "UAAccess", "SPMetric", "SPTopic", "Tag", "TagLen", "TagCheck"]


def words(t):
    return 2 if re.search(r"DINT|REAL", t) else 10 if re.search(r"STRING\[20\]", t) else 1


def ua_type(t):
    return UATYPE.get(t) or ("String" if t.startswith("STRING") else "UInt16")


def unit_rows(unit, module, BLOCK, EXTRA, naming, N5, base=0, pn_start=0):
    """All interface rows of one unit (list of lists, columns HEAD)."""
    rows = []
    ib = qb = pn_start
    pre = f"{naming['site']}.{naming['area']}.{naming['cell']}"
    for o, n, t, d, mn in [list(r) for r in BLOCK] + [list(r) for r in EXTRA.get(module, [])]:
        w = words(t)
        word = f"{o}" + (f"-{o + w - 1}" if w > 1 else "")
        hr = "4" + str(base + o + 1).rjust(4, "0")
        acc = "write (FC06 / FC16)" if d == "in" else "read (FC03)" if d == "out" else "read + write"
        ln = 2 * w
        if d == "out":
            area, addr = "Input (module → controller)", f"%IB{ib}…{ib + ln - 1}"
            ib += ln
        elif d == "in":
            area, addr = "Output (controller → module)", f"%QB{qb}…{qb + ln - 1}"
            qb += ln
        else:
            area, addr = "both", f"%IB{ib} / %QB{qb}"
            ib += ln
            qb += ln
        grp, nm = n.split(".")[:2] if "." in n else ("Data", n)
        tag = f"{pre}.{unit}.{n}"
        chk = tag_namer.check_tag(tag, N5)
        rows.append([unit, module, word, hr, base + o, n, t, d, acc, area, addr,
                     f"Objects/{unit}/{grp}/{nm}", f"ns=2;s={unit}.{n}", ua_type(t),
                     "Read (subscribe)" if d == "out" else "Read/Write",
                     n.replace(".", "/", 1),
                     f"spBv1.0/{naming['sparkplug_group']}/{'DCMD' if d == 'in' else 'DDATA'}/{naming['sparkplug_edge']}/{unit}",
                     tag, len(tag), "OK" if not chk else "; ".join(chk)])
    return rows


def kit_rows(kit_modules, UNIT, BLOCK, EXTRA, naming, N5, base=0, pn_start=0):
    rows = []
    for m, u in kit_units(kit_modules, UNIT):
        if m in NO_BLOCK:
            continue
        rows += unit_rows(u, m, BLOCK, EXTRA, naming, N5, base, pn_start)
    return rows


def load_all(path):
    _, naming = load_examples(path, "naming")
    _, IP = load_examples(path, "ip_plan")
    _, N5 = load_examples(ITEM5_EXAMPLES, "naming")
    N5 = dict(N5, site=naming["site"], area=naming["area"], cell=naming["cell"])
    return naming, IP, N5


def markdown(rows, title):
    cols = ["Unit", "Word", "HoldingReg", "PDU", "Name", "Type", "Dir", "PNAddress", "UANodeId", "UAType",
            "SPTopic", "Tag"]
    idx = [HEAD.index(c) for c in cols]
    L = [f"# {title}", "", "Modbus: 32-bit values high word first ('ABCD'), REAL = IEEE 754, bit 0 = LSB, "
         "time-out 500 ms, heartbeat check 3 s.", "",
         "| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    L += ["| " + " | ".join(str(r[i]) for i in idx) + " |" for r in rows]
    return "\n".join(L) + "\n"


def summary(rows, max_len):
    units = []
    for r in rows:
        if r[0] not in units:
            units.append(r[0])
    lon = max(r[18] for r in rows)
    return {"units": units, "rows": len(rows), "longest": lon,
            "longest_tags": [r[17] for r in rows if r[18] == lon],
            "bad": [r for r in rows if r[19] != "OK"], "over": [r for r in rows if r[18] > max_len]}


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("datablock_map")
    naming, IP, N5 = load_all(path)
    BLOCK, EXTRA = read_js_const(WEB_DATA, "BLOCK"), read_js_const(WEB_DATA, "EXTRA")
    KITS, UNIT = read_js_const(WEB_DATA, "KITS"), read_unit()
    R = unit_rows("MC02", "M01", BLOCK, EXTRA, naming, N5)
    t.equal("MC02 (M01): 15 + 4 = 19 rows", len(R), 19)
    r0 = R[0]
    t.equal("row 0: word 0, 40001, PDU 0", (r0[2], r0[3], r0[4]), ("0", "40001", 0))
    t.equal("row 0: OPC UA path / NodeId / Int16 / Read (subscribe)", (r0[11], r0[12], r0[13], r0[14]),
            ("Objects/MC02/Status/StateCurrent", "ns=2;s=MC02.Status.StateCurrent", "Int16", "Read (subscribe)"))
    t.equal("row 0: Sparkplug metric + DDATA topic", (r0[15], r0[16]),
            ("Status/StateCurrent", "spBv1.0/FMS1/DDATA/CC1/MC02"))
    t.equal("row 0: tag = item-5 data-block tag", r0[17], "PLT1.MACH.FMS1.MC02.Status.StateCurrent")
    t.equal("row 0: PROFINET %IB0…1", r0[10], "%IB0…1")
    jid = [r for r in R if r[5] == "Job.Id"][0]
    t.equal("Job.Id: words 12-13, 40013, write, DCMD, Int32", (jid[2], jid[3], jid[8], jid[16].split("/")[2], jid[13]),
            ("12-13", "40013", "write (FC06 / FC16)", "DCMD", "Int32"))
    t.equal("PROFINET outputs: CntrlCmd %QB0…1, Bits %QB2…3, UnitMode %QB4…5, Job.Id %QB6…9",
            [r[10] for r in R if r[5] in ("Command.CntrlCmd", "Command.Bits", "Command.UnitMode", "Job.Id")],
            ["%QB0…1", "%QB2…3", "%QB4…5", "%QB6…9"])
    pal = [r for r in R if r[5] == "Job.PalletId"][0]
    t.equal("Job.PalletId (in/out): %IB18 / %QB10, read + write, DDATA", (pal[10], pal[8], pal[16].split("/")[2]),
            ("%IB18 / %QB10", "read + write", "DDATA"))
    t.equal("LastCycle_s REAL: %IB22…25, Float", [(r[10], r[13]) for r in R if r[5] == "Status.LastCycle_s"],
            [("%IB22…25", "Float")])
    t.equal("NC.DoorClosed 'BOOL→WORD bit0' -> UInt16, 40025", [(r[13], r[3]) for r in R if r[5] == "NC.DoorClosed"],
            [("UInt16", "40025")])
    Rb = unit_rows("MC02", "M01", BLOCK, EXTRA, naming, N5, base=100)
    t.equal("base 100: word 0 -> 40101, PDU 100; word 24 -> 40125", (Rb[0][3], Rb[0][4], Rb[-1][3]),
            ("40101", 100, "40125"))
    L4 = unit_rows("LS01", "M04", BLOCK, EXTRA, naming, N5)
    t.equal("M04 STRING[20]: words 22-31, String, %IB…", [(r[2], r[13]) for r in L4 if r[5] == "LS.SerialFirst"],
            [("22-31", "String")])
    K = kit_rows(KITS[IP["kit"]], UNIT, BLOCK, EXTRA, naming, N5)
    S = summary(K, N5["max_len"])
    t.equal("kit FMS: 16 units with a data block (18 modules - M20 - M22)", len(S["units"]), 16)
    t.equal("kit FMS: 16 x 15 + 3x4 (M01) + 4 (M03) + 2x3 (M04) + 2 (M06) + 3 (M11) = 267 rows", S["rows"], 267)
    t.equal("longest tag 47: AGVST01 ProdProcessedCount / ProdDefectiveCount", (S["longest"], sorted(S["longest_tags"])),
            (47, ["PLT1.MACH.FMS1.AGVST01.Admin.ProdDefectiveCount", "PLT1.MACH.FMS1.AGVST01.Admin.ProdProcessedCount"]))
    t.equal("all kit tags pass the item-5 rule and are <= 48", (len(S["bad"]), len(S["over"])), (0, 0))
    t.equal("no duplicate tags / NodeIds in the kit", (len({r[17] for r in K}), len({r[12] for r in K})), (267, 267))
    gen = {r[0] for r in tag_namer.generate(dict(N5, units=[["M01", "MC", 3]]))}
    t.true("tags identical to tag_namer.generate for MC01..MC03",
           {r[17] for r in K if r[1] == "M01"} == gen)
    t.equal("units in kit order", S["units"][:4] + S["units"][-3:],
            ["MC01", "MC02", "MC03", "APC01", "UTIL01", "SAFE01", "CC01"])
    t.true("markdown has one row per block row", markdown(K, "x").count("\n| ") == 267 + 1)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM6_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="the kit of the JSON ip_plan (also the default)")
    ap.add_argument("--kit", help="kit name of web/fmse6_data.js KITS")
    ap.add_argument("--module", help="one module (e.g. M01) instead of a kit")
    ap.add_argument("--unit", help="unit name for --module (default UNIT code + 01)")
    ap.add_argument("--base", type=int, default=0, help="Modbus base register (default 0)")
    ap.add_argument("--pn-start", type=int, default=0, help="PROFINET start byte address per unit (default 0)")
    ap.add_argument("--md", help="write the interface sheet as Markdown")
    ap.add_argument("--csv", help="write all columns as CSV")
    ap.add_argument("--full", action="store_true", help="print all rows (default: first unit + summary)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    if a.base < 0 or a.pn_start < 0:
        raise InputError("--base and --pn-start must be >= 0")
    naming, IP, N5 = load_all(a.examples)
    BLOCK, EXTRA = read_js_const(WEB_DATA, "BLOCK"), read_js_const(WEB_DATA, "EXTRA")
    UNIT = read_unit()
    if a.module:
        if a.module not in UNIT or a.module in NO_BLOCK:
            raise InputError(f"module '{a.module}' has no data block (M01..M19)")
        unit = re.sub(r"[^A-Za-z0-9]", "", a.unit or f"{UNIT[a.module]}01")
        rows = unit_rows(unit, a.module, BLOCK, EXTRA, naming, N5, a.base, a.pn_start)
        title = f"Interface sheet {naming['cell']}.{unit} ({a.module})"
    else:
        KITS = read_js_const(WEB_DATA, "KITS")
        kit = a.kit or IP["kit"]
        if kit not in KITS:
            raise InputError(f"kit '{kit}' unknown: {', '.join(KITS)}")
        rows = kit_rows(KITS[kit], UNIT, BLOCK, EXTRA, naming, N5, a.base, a.pn_start)
        title = f"Interface sheet {naming['cell']} - kit {kit}"
    S = summary(rows, N5["max_len"])
    if a.json:
        print(json.dumps({"title": title, "rows": [dict(zip(HEAD, r)) for r in rows],
                          "summary": {k: S[k] for k in ("units", "rows", "longest", "longest_tags")}},
                         indent=1, ensure_ascii=False))
        return 0
    print(title.upper())
    show = rows if a.full else [r for r in rows if r[0] == S["units"][0]]
    print(fmt_table(["unit", "word", "4xxxx", "PDU", "name", "type", "dir", "PROFINET", "OPC UA NodeId", "UA type",
                     "Sparkplug topic", "tag"],
                    [[r[0], r[2], r[3], r[4], r[5], r[6], r[7], r[10], r[12], r[13], r[16], r[17]] for r in show],
                    "lllrllllllll"))
    if not a.full and len(S["units"]) > 1:
        print(f"  (first unit shown; --full for all {S['rows']} rows)")
    print()
    print(f"  units: {', '.join(S['units'])}")
    print(f"  {len(S['units'])} units, {S['rows']} rows; longest tag {S['longest']} characters (max {N5['max_len']}): "
          f"{', '.join(S['longest_tags'])}")
    print(f"  tag rule check (item 5): {S['rows'] - len(S['bad'])} OK, {len(S['bad'])} with errors")
    for r in S["bad"]:
        print(f"    ERROR {r[17]}: {r[19]}")
    if a.md:
        p = Path(a.md)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(markdown(rows, title), encoding="utf-8")
        print(f"\nMarkdown written: {p}")
    if a.csv:
        print(f"CSV written: {write_csv(a.csv, HEAD, rows)}")
    return 1 if S["bad"] else 0


if __name__ == "__main__":
    run_main(main)
