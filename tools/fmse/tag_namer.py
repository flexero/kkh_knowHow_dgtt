#!/usr/bin/env python3
"""Tag naming: check tag names against the naming rule, generate the data-block tag list of a cell,
show an IEC 81346 reference designation.

Python 3 standard library only, offline. Rules = "_formulas.tag" and "_formulas.datablock_tags" in
examples/item5_examples.json. The 15 standard data-block items (BLOCK) and the module parts (EXTRA) are copied
from web/fmse6_data.js; the self-test checks that the web file still has the same tables.
Guides: docs/FMS system design/65_control_architecture.md (section 5) and 66_communication.md (section 8).

Tag rule (site.area.cell.unit.equipment.signal, EXACTLY 6 parts):
  0 parts            exactly 6 parts joined by '.', no empty part
  1 bad characters   parts 1-5 only A-Z a-z 0-9 (no '-', '_', space, umlaut); the signal (part 6) also
                     only A-Z a-z 0-9, plus at most ONE '_' followed by a unit suffix (SpindleLoad_pct,
                     Torque_Nm, LastCycle_s)
  2 unit number      the unit part = unit code (letters) + 2-digit number, e.g. MC02 (MC2 or MC002 is wrong)
  3 length           whole tag <= max_len characters (example 48)
  4 negative word    the signal must not start with Not / No / Non / Un followed by an upper-case letter or
                     the end ('NotOK', 'NoAir' are wrong - name the positive state: 'OK', 'AirOK')
  5 duplicate        the same tag twice in one list is an error (the second one is reported)
Data-block tags: for every unit instance (code + 01..n): site.area.cell.unit.group.item for the 15 standard
  items (e.g. Status.StateCurrent -> group Status = equipment part, item StateCurrent = signal) + the EXTRA
  items of its module (NC.ProgramNo -> group NC). Every generated tag must pass the same rule (no exception).
"""

import argparse
import re
from pathlib import Path

from fmse_common import (ITEM5_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, read_js_const,
                         run_main, write_csv)

WEB_DATA = Path(__file__).resolve().parent.parent.parent / "web" / "fmse6_data.js"

# ---- copied from web/fmse6_data.js (self-test compares) --------------------------------------------------
BLOCK = [
    [0, "Status.StateCurrent", "INT", "out", "PackML state 1–17 (item 5)"],
    [1, "Status.UnitModeCurrent", "INT", "out", "1 Production · 2 Maintenance · 3 Manual"],
    [2, "Command.CntrlCmd", "INT", "in", "PackML command 1–9"],
    [3, "Command.Bits", "WORD", "in", "bit0 CmdChangeRequest · bit1 HS.Request · bit2 HS.Ack · bit3 FaultReset · bit8–15 spare"],
    [4, "Status.Bits", "WORD", "out", "bit0 Ready · bit1 Busy · bit2 Done · bit3 Fault · bit4 Warning · bit5 Auto · bit6 PartPresent · bit7 HS.Ready"],
    [5, "Command.UnitMode", "INT", "in", "requested mode"],
    [6, "Admin.AlarmNo", "INT", "out", "active alarm number (0 = none), module-range × 1000 + n"],
    [7, "Admin.WarningNo", "INT", "out", "active warning number"],
    [8, "Admin.ProdProcessedCount", "DINT", "out", "2 words – counter for OEE"],
    [10, "Admin.ProdDefectiveCount", "DINT", "out", "2 words"],
    [12, "Job.Id", "DINT", "in", "job / work order number from the cell controller"],
    [14, "Job.PalletId", "DINT", "in/out", "pallet / carrier ID (RFID)"],
    [16, "Status.LastCycle_s", "REAL", "out", "2 words, IEEE 754"],
    [18, "Status.Heartbeat", "UINT", "out", "+1 every second – the partner checks it (time-out 3 s)"],
    [19, "Command.Heartbeat", "UINT", "in", "+1 every second from the cell controller"],
]
EXTRA = {
    "M01": [[20, "NC.ProgramNo", "DINT", "in", "program to run"], [22, "NC.SpindleLoad_pct", "INT", "out", ""],
            [23, "NC.ToolLifeMin_pct", "INT", "out", "lowest remaining tool life"],
            [24, "NC.DoorClosed", "BOOL→WORD bit0", "out", "+ bit1 PalletClamped, bit2 ReadyForLoad"]],
    "M03": [[20, "Move.From", "INT", "in", "place number"], [21, "Move.To", "INT", "in", "place number"],
            [22, "Move.PalletAt", "INT", "out", "current place of the fork"], [23, "Rack.FreePlaces", "INT", "out", ""]],
    "M04": [[20, "LS.OperatorRelease", "WORD bit0", "out", "+ bit1 LightCurtainOK, bit2 ClampPressureOK"],
            [21, "LS.PartsOnPallet", "INT", "out", ""], [22, "LS.SerialFirst", "STRING[20]", "out", "10 words"]],
    "M06": [[20, "Dock.ReadyToGive", "WORD bit0", "out", "+ bit1 ReadyToTake, bit2 TransferActive, bit3 TransferDone"],
            [21, "Dock.AGVPresent", "WORD bit0", "in", "+ bit1 AGVReadyToTransfer"]],
    "M11": [[20, "Meas.ProgramNo", "INT", "in", ""], [21, "Meas.ResultOK", "WORD bit0", "out", "+ bit1 NOK, bit2 ResultValid"],
            [22, "Meas.FeaturesOut", "INT", "out", "number of features out of tolerance"]],
    "M13": [[20, "Asm.RecipeNo", "INT", "in", ""], [21, "Asm.Torque_Nm", "REAL", "out", "2 words"],
            [23, "Asm.Angle_deg", "REAL", "out", "2 words"], [25, "Asm.ResultOK", "WORD bit0", "out", ""]],
    "M15": [[20, "Weld.JobNo", "INT", "in", "robot + power source job"], [21, "Weld.ArcOnTime_s", "REAL", "out", "2 words"],
            [23, "Weld.TableSide", "INT", "out", "1 = A at robot, 2 = B"]],
}

PART_OK = re.compile(r"^[A-Za-z0-9]+$")
UNIT_OK = re.compile(r"^[A-Za-z]+[0-9]{2}$")
SIGNAL_OK = re.compile(r"^[A-Za-z0-9]+(_[A-Za-z0-9]+)?$")       # at most one '_' + unit suffix


def check_naming(N):
    for k in ("site", "area", "cell", "max_len", "negative_words", "units"):
        if k not in N:
            raise InputError(f"naming: value '{k}' is missing")
    for u in N["units"]:
        if len(u) != 3 or not isinstance(u[2], int) or u[2] < 1 or u[2] > 99:
            raise InputError(f"naming: unit {u!r} must be [module, code, count 1..99]")


def negative(signal, words):
    """Return the negative word the signal starts with (followed by upper case or end), else None."""
    for w in sorted(words, key=len, reverse=True):          # 'Non' before 'No'
        if signal.startswith(w):
            rest = signal[len(w):]
            if rest == "" or rest[0].isupper():
                return w
    return None


def check_tag(tag, N, seen=None):
    """Return a list of reasons (empty = OK). `seen` is a set for the duplicate check (updated)."""
    reasons = []
    parts = tag.split(".")
    if len(parts) != 6:
        reasons.append(f"parts: {len(parts)} parts, need exactly 6 (site.area.cell.unit.equipment.signal)")
    bad = [p for k, p in enumerate(parts)
           if not (SIGNAL_OK if (k == len(parts) - 1 and len(parts) == 6) else PART_OK).match(p)]
    if bad:
        reasons.append("bad characters in: " + ", ".join(repr(p) for p in bad)
                       + " (only A-Z a-z 0-9; signal: one '_' + unit suffix allowed)")
    if len(parts) >= 4 and not UNIT_OK.match(parts[3]):
        reasons.append(f"unit number format: '{parts[3]}' must be unit code + 2-digit number (e.g. MC02)")
    if len(tag) > N["max_len"]:
        reasons.append(f"length: {len(tag)} characters > {N['max_len']}")
    if len(parts) == 6:
        w = negative(parts[-1], N["negative_words"])
        if w:
            reasons.append(f"negative word: signal '{parts[-1]}' starts with '{w}' - name the positive state")
    if seen is not None:
        if tag in seen:
            reasons.append("duplicate: same tag already in the list")
        seen.add(tag)
    return reasons


def check_list(tags, N):
    seen = set()
    return [(tg, check_tag(tg, N, seen)) for tg in tags]


def instances(N):
    """[(module, unit instance)] e.g. ('M01', 'MC01')."""
    return [(m, f"{code}{i:02d}") for m, code, n in N["units"] for i in range(1, n + 1)]


def generate(N):
    """Data-block tag rows: [tag, unit, module, word, item, type, dir, meaning, length]."""
    pre = f"{N['site']}.{N['area']}.{N['cell']}"
    rows = []
    for mod, unit in instances(N):
        for off, name, typ, d, mean in BLOCK + EXTRA.get(mod, []):
            tag = f"{pre}.{unit}.{name}"                    # name = group.item -> equipment.signal
            rows.append([tag, unit, mod, off, name, typ, d, mean, len(tag)])
    return rows


def iec81346(N):
    e = N.get("iec81346_example")
    if not e:
        return None
    return e, f"{e['function']}{e['location']}{e['product']}"


# ----------------------------------------------------------------------------- output
def show_check(results, title):
    print(title)
    rows = []
    for k, (tg, rs) in enumerate(results, 1):
        rows.append([k, tg, "OK" if not rs else "ERROR", rs[0] if rs else ""])
        for r in rs[1:]:
            rows.append(["", "", "", r])
    print(fmt_table(["#", "tag", "verdict", "reason"], rows, "rlll"))
    n_bad = sum(1 for _, rs in results if rs)
    print(f"  {len(results) - n_bad} OK, {n_bad} with errors")


def show_generate(N, csv_path):
    rows = generate(N)
    inst = instances(N)
    print(f"DATA-BLOCK TAG LIST  ({N['site']}.{N['area']}.{N['cell']}.<unit>.<group>.<item>)")
    cnt = []
    for m, code, n in N["units"]:
        ex = len(EXTRA.get(m, []))
        cnt.append([m, code, n, f"{code}01" + (f"..{code}{n:02d}" if n > 1 else ""), len(BLOCK), ex,
                    n * (len(BLOCK) + ex)])
    print(fmt_table(["module", "code", "instances", "units", "standard", "module part", "tags"], cnt, "llrlrrr"))
    n_std = len(inst) * len(BLOCK)
    print(f"  {len(inst)} unit instances x {len(BLOCK)} standard items = {n_std} + module parts "
          f"{len(rows) - n_std} = {len(rows)} tags")
    res = check_list([r[0] for r in rows], N)
    bad = [(tg, rs) for tg, rs in res if rs]
    lon = max(rows, key=lambda r: r[8])
    print(f"  longest tag {lon[8]} characters (max_len {N['max_len']}): {lon[0]}")
    print(f"  rule check of all generated tags: {len(rows) - len(bad)} OK, {len(bad)} with errors")
    for tg, rs in bad:
        print(f"    ERROR {tg}: {'; '.join(rs)}")
    print()
    print("  first unit as an example:")
    print(fmt_table(["tag", "word", "type", "dir"], [[r[0], r[3], r[5], r[6]] for r in rows if r[1] == inst[0][1]],
                    "lrll"))
    if csv_path:
        p = write_csv(csv_path, ["tag", "unit", "module", "word", "item", "type", "dir", "meaning", "length"], rows)
        print(f"\nCSV written: {p}")
    return rows


def show_iec(N):
    r = iec81346(N)
    if not r:
        return
    e, full = r
    print("IEC 81346 REFERENCE DESIGNATION (example)")
    print(fmt_table(["aspect", "prefix", "value", "meaning"],
                    [["function", "=", e["function"], "what it does (cell FMS1, machine MC02)"],
                     ["location", "+", e["location"], "where it is (hall 1, field A3)"],
                     ["product", "-", e["product"], "what it is (KF = control device)"]], "llll"))
    print(f"  full designation: {full}")
    print(f"  {e.get('note', '')}")
    print("  The tag name (software) and the reference designation (drawings, labels) are two keys for the same"
          " object;\n  keep a cross-reference list.")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("tag_namer")
    _, N = load_examples(path, "naming")
    check_naming(N)
    res = check_list(N["test_tags"], N)
    kinds = [rs[0].split(":")[0] if rs else "OK" for _, rs in res]
    t.equal("test tag 1 MC02.APC.ClampOK -> OK", kinds[0], "OK")
    t.equal("test tag 2 MC2 -> unit number format", kinds[1], "unit number format")
    t.equal("test tag 3 NotOK -> negative word", kinds[2], "negative word")
    t.equal("test tag 4 Pos-Ok -> bad characters", kinds[3], "bad characters in")
    L5 = len("PLT1.MACH.FMS1.WASH01.Tank.LevelHighHighAlarmWithDelay")
    t.equal("test tag 5 length 15+7+5+27 = 54 characters", L5, 54)
    t.equal("test tag 5 -> length", kinds[4], "length")
    t.equal("test tag 6 (= tag 1 again) -> duplicate", kinds[5], "duplicate")
    t.true("every bad test tag has exactly one reason", all(len(rs) == 1 for _, rs in res[1:]))
    t.equal("negative: 'NoAir' -> No", negative("NoAir", N["negative_words"]), "No")
    t.equal("negative: 'Normal' -> none", negative("Normal", N["negative_words"]), None)
    t.equal("negative: 'NonStop' -> Non", negative("NonStop", N["negative_words"]), "Non")
    t.equal("negative: 'Un' alone -> Un", negative("Un", N["negative_words"]), "Un")
    t.equal("negative: 'Unit' -> none", negative("Unit", N["negative_words"]), None)
    t.equal("MC002 -> unit number format", check_tag("PLT1.MACH.FMS1.MC002.Door.Closed", N)[0].split(":")[0],
            "unit number format")
    rows = generate(N)
    inst = instances(N)
    t.equal("18 unit instances (3+3+1+2+1+1+1+1+1+1+1+1+1)", len(inst), 18)
    t.equal("standard tags 18 x 15 = 270", sum(1 for r in rows if r[3] < 20), 270)
    t.equal("module parts 3x4 (M01) + 4 (M03) + 2x3 (M04) + 2 (M06) + 3 (M11) = 27",
            sum(1 for r in rows if r[3] >= 20), 27)
    t.equal("total 297 data-block tags", len(rows), 297)
    t.equal("first tag (6 parts, group.item kept)", rows[0][0], "PLT1.MACH.FMS1.MC01.Status.StateCurrent")
    t.true("EXTRA NC.ProgramNo -> PLT1.MACH.FMS1.MC01.NC.ProgramNo",
           "PLT1.MACH.FMS1.MC01.NC.ProgramNo" in [r[0] for r in rows])
    t.equal("all 297 generated tags pass the rule", sum(1 for _, rs in check_list([r[0] for r in rows], N) if rs), 0)
    lon = max(rows, key=lambda r: r[8])
    t.equal("longest = AGVST01.Admin.ProdProcessedCount / ProdDefectiveCount: 15+8+6+18 = 47 (both)",
            sorted(r[0] for r in rows if r[8] == lon[8]),
            ["PLT1.MACH.FMS1.AGVST01.Admin.ProdDefectiveCount", "PLT1.MACH.FMS1.AGVST01.Admin.ProdProcessedCount"])
    t.equal("longest length 47", lon[8], 47)
    t.true("longest 47 <= max_len 48", lon[8] <= N["max_len"] == 48)
    t.equal("signal 'SpindleLoad_pct' OK (one '_' + unit suffix)",
            check_tag("PLT1.MACH.FMS1.MC01.NC.SpindleLoad_pct", N), [])
    t.equal("signal 'A_b_c' -> bad characters (two '_')",
            check_tag("PLT1.MACH.FMS1.MC01.NC.A_b_c", N)[0].split(":")[0], "bad characters in")
    t.equal("'_' in the equipment part -> bad characters",
            check_tag("PLT1.MACH.FMS1.MC01.N_C.Load", N)[0].split(":")[0], "bad characters in")
    t.equal("5 parts -> parts error", check_tag("PLT1.MACH.FMS1.MC01.Load", N)[0].split(":")[0], "parts")
    t.equal("no duplicate data-block tags", len({r[0] for r in rows}), len(rows))
    t.equal("IEC 81346 full designation", iec81346(N)[1], "=FMS1.MC02+HALL1.A3-KF1")
    if WEB_DATA.is_file():
        t.equal("web/fmse6_data.js BLOCK = copy in this tool", read_js_const(WEB_DATA, "BLOCK"), BLOCK)
        t.equal("web/fmse6_data.js EXTRA = copy in this tool", read_js_const(WEB_DATA, "EXTRA"), EXTRA)
    else:
        print(f"  NOTE  {WEB_DATA} not found - web comparison skipped")
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/tag_namer.py                 (check the 6 JSON test tags + IEC 81346)\n"
               "  python tools/fmse/tag_namer.py --check PLT1.MACH.FMS1.MC01.Door.Closed PLT1.MACH.FMS1.LS1.X.Y\n"
               "  python tools/fmse/tag_namer.py --check-file my_tags.txt     (one tag per line, # = comment)\n"
               "  python tools/fmse/tag_namer.py --generate --csv datablock_tags.csv")
    ap.add_argument("--examples", default=str(ITEM5_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--check", nargs="+", metavar="TAG", help="check these tags")
    ap.add_argument("--check-file", help="check the tags in this text file (one per line)")
    ap.add_argument("--generate", action="store_true", help="generate the data-block tag list of the JSON units")
    ap.add_argument("--csv", help="write the generated list (or the check result) to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, N = load_examples(a.examples, "naming")
    check_naming(N)
    if a.generate:
        show_generate(N, a.csv)
        return 0
    if a.check or a.check_file:
        tags = list(a.check or [])
        if a.check_file:
            p = Path(a.check_file)
            if not p.is_file():
                raise InputError(f"File not found: {p}")
            for line in p.read_text(encoding="utf-8-sig").splitlines():
                if line.strip() and not line.strip().startswith("#"):
                    tags.append(line.strip())
        title = "TAG CHECK (your tags)"
    else:
        tags = N.get("test_tags", [])
        title = "TAG CHECK (test_tags of the JSON)"
    res = check_list(tags, N)
    print(f"Rule: {N['site']}.{N['area']}.{N['cell']}.<unit>.<equipment>.<signal> (6 parts), parts A-Z a-z 0-9 (signal: + one _unit), unit = code + "
          f"2 digits, <= {N['max_len']} chars,\n      no negative signal ({', '.join(N['negative_words'])} + upper case),"
          " no duplicates")
    print()
    show_check(res, title)
    if a.csv:
        p = write_csv(a.csv, ["tag", "verdict", "reasons"],
                      [[tg, "OK" if not rs else "ERROR", " | ".join(rs)] for tg, rs in res])
        print(f"\nCSV written: {p}")
    if not (a.check or a.check_file):
        print()
        show_iec(N)
    return 1 if any(rs for _, rs in res) and (a.check or a.check_file) else 0


if __name__ == "__main__":
    run_main(main)
