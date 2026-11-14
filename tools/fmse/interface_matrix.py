#!/usr/bin/env python3
"""Interface (N-squared) matrix and interface sheets for a modular FMS.

Offline, Python standard library only. Inputs: "kits" and "interfaces" in
examples/item1_examples.json (same kits as the web tab: fms, fmc, asm = assembly,
weld = robot welding, sheet = sheet metal).

How the interfaces are found
  Every entry in "interfaces" is [module A, module B, type, content]. An interface exists in a
  system when BOTH modules are in the chosen kit. Module B can be a wildcard:
    '*'          = every module of the kit except the control modules M19-M22
    '*physical'  = every module with moving parts = all except M09 and M19-M22
    '*networked' = every module with a controller = all except M02 (wired into M01); M18 is included
  A module never gets an interface with itself. If two entries give the same pair, their types
  and texts are merged.

Matrix letters:  M = mechanical, S = signal, D = data, U = utility, F = safety (functional
safety), N = network. The matrix is symmetric (the row and the column show the same pair).

Interface sheets (--sheets DIR): one Markdown stub per pair with the 9 faces of the module
standard (mechanical, electrical, safety, state model PackML, function block, handshake,
communication with the standard data block words 0-19 + module part, HMI & alarms,
documents & tests) and fields to fill. Plus 00_index.md with the list.
"""

import argparse
import re
from pathlib import Path

from fmse_common import DEFAULT_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main, write_csv

# copied from web/fmse_data.js MODULES: code -> (name, group, typical IO DI/DO/AI)
MODULES = {
    "M01": ("Machine tool (CNC) interface", "Process", "24 / 16 / 0"),
    "M02": ("Automatic pallet changer (APC)", "Handling", "12 / 8 / 0"),
    "M03": ("Pallet rack / pallet pool + stacker", "Storage", "40 / 24 / 2"),
    "M04": ("Load / unload station", "Handling", "16 / 10 / 0"),
    "M05": ("Robot loading cell", "Handling", "32 / 32 / 0"),
    "M06": ("AGV / AMR interface", "Transport", "8 / 8 / 0"),
    "M07": ("Conveyor / carrier transport", "Transport", "24 / 16 / 0"),
    "M08": ("AS/RS (automatic storage)", "Storage", "48 / 32 / 4"),
    "M09": ("Tool management", "Process", "16 / 8 / 0"),
    "M10": ("Washing / cleaning machine", "Process", "16 / 12 / 4"),
    "M11": ("Measuring station (CMM / gauging / vision)", "Quality", "12 / 8 / 4"),
    "M12": ("Marking & identification", "Quality", "8 / 8 / 0"),
    "M13": ("Assembly station (screw / press / dispense)", "Process", "24 / 16 / 4"),
    "M14": ("Test station (leak / function)", "Quality", "16 / 12 / 8"),
    "M15": ("Robot welding cell", "Process", "32 / 24 / 2"),
    "M16": ("Press / bending / punching", "Process", "24 / 16 / 4"),
    "M17": ("Utilities (air, coolant, chips, extraction)", "Infrastructure", "16 / 8 / 8"),
    "M18": ("Cell safety controller", "Infrastructure", "32 / 16 / 0"),
    "M19": ("Cell controller (line PLC / cell computer)", "Control", "- (network)"),
    "M20": ("SCADA / HMI system", "Control", "- (network)"),
    "M21": ("MES / ERP connector", "Control", "- (network)"),
    "M22": ("Network & IT/OT infrastructure", "Infrastructure", "-"),
}
CONTROL = {"M19", "M20", "M21", "M22"}
NOT_PHYSICAL = {"M09"} | CONTROL
NOT_NETWORKED = {"M02"}

LETTER = {"mech": "M", "signal": "S", "data": "D", "utility": "U", "safety": "F", "network": "N"}
LETTER_ORDER = "MSDUFN"
KIT_NAMES = {"fms": "FMS (machining)", "fmc": "FMC (machining cell)", "asm": "Assembly",
             "weld": "Robot welding", "sheet": "Sheet metal"}

# standard data block words 0-19 (docs/FMS system design/66_communication.md section 8)
DATA_BLOCK = [
    ("0", "Status.StateCurrent", "INT", "out", "PackML state 1-17"),
    ("1", "Status.UnitModeCurrent", "INT", "out", "1 Production / 2 Maintenance / 3 Manual"),
    ("2", "Command.CntrlCmd", "INT", "in", "PackML command 1-9"),
    ("3", "Command.Bits", "WORD", "in", "b0 CmdChangeRequest, b1 HS.Request, b2 HS.Ack, b3 FaultReset"),
    ("4", "Status.Bits", "WORD", "out", "b0 Ready, b1 Busy, b2 Done, b3 Fault, b4 Warning, b5 Auto, "
                                         "b6 PartPresent, b7 HS.Ready"),
    ("5", "Command.UnitMode", "INT", "in", "requested mode"),
    ("6 / 7", "Admin.AlarmNo / WarningNo", "INT", "out", "active alarm / warning number"),
    ("8-9", "Admin.ProdProcessedCount", "DINT", "out", "OEE counter"),
    ("10-11", "Admin.ProdDefectiveCount", "DINT", "out", "OEE counter"),
    ("12-13", "Job.Id", "DINT", "in", "job / work order"),
    ("14-15", "Job.PalletId", "DINT", "in/out", "pallet / carrier ID"),
    ("16-17", "Status.LastCycle_s", "REAL", "out", "last cycle time"),
    ("18", "Status.Heartbeat", "UINT", "out", "+1 per second"),
    ("19", "Command.Heartbeat", "UINT", "in", "+1 per second from cell controller"),
]
# examples of the module part (word 20+); from docs/66 section 8 where given, else suggestions
MODULE_PART = {
    "M01": "program number, spindle load, lowest tool life, door / clamp bits",
    "M02": "pallet position (machine / set-up), clamp state, change counter",
    "M03": "move from / to, fork position, free places",
    "M04": "station state, pallet ID read, operator release, light-curtain state",
    "M05": "robot program, tray / drawer position, gripper state",
    "M06": "dock ready-to-give / ready-to-take bits, AGV ID, transfer state",
    "M07": "carrier ID at stop, stopper state, zone occupied bits",
    "M08": "move from / to, free places, crane position, WMS order",
    "M09": "tool ID, length, radius, remaining life, transfer request",
    "M10": "wash program, bath temperature, level, cycle state",
    "M11": "measuring program, OK / NOK, key measured values",
    "M12": "code read, RFID read / write result, mark job",
    "M13": "recipe, torque / angle or force / distance result, OK / NOK",
    "M14": "test program, leak rate / test result, OK / NOK",
    "M15": "weld job number, arc on, table index, torch service",
    "M16": "tool set, stroke counter, part count, bend program",
    "M17": "coolant level / temperature, air pressure, chip conveyor state",
    "M18": "safety zone states, E-stop chain, door lock states (read-only)",
    "M19": "orders, routing, module coordination (master of the block)",
    "M20": "screen / alarm acknowledge commands (via M19)",
    "M21": "job download, confirmations, quality and OEE upload (via M19)",
    "M22": "switch port status, link up / down, time-sync state",
}
PACKML_STATES = ("Stopped 2, Resetting 15, Idle 4, Starting 3, Execute 6, Completing 16, Complete 17, "
                 "Holding 10 / Held 11 / Unholding 12, Suspending 13 / Suspended 5 / Unsuspending 14, "
                 "Stopping 7, Aborting 8 / Aborted 9, Clearing 1")
PACKML_CMDS = "Reset 1, Start 2, Stop 3, Hold 4, Unhold 5, Suspend 6, Unsuspend 7, Abort 8, Clear 9"


# ----------------------------------------------------------------------------- core
def check_modules(codes):
    """Validate module codes; return them sorted and unique."""
    bad = [c for c in codes if c not in MODULES]
    if bad:
        raise InputError(f"unknown module code(s): {', '.join(bad)} (valid: M01 .. M22)")
    return sorted(set(codes))


def type_letters(type_text):
    """'mech+signal' -> 'MS' (unknown words raise InputError)."""
    out = set()
    for w in type_text.split("+"):
        w = w.strip().lower()
        if w not in LETTER:
            raise InputError(f"interface type '{w}' unknown (use {', '.join(LETTER)})")
        out.add(LETTER[w])
    return "".join(c for c in LETTER_ORDER if c in out)


def expand_target(target, kit):
    """Resolve module B of an interface entry (code or wildcard) to a list of kit modules."""
    if target == "*":
        return [m for m in kit if m not in CONTROL]
    if target == "*physical":
        return [m for m in kit if m not in NOT_PHYSICAL]
    if target == "*networked":
        return [m for m in kit if m not in NOT_NETWORKED]
    if target.startswith("*"):
        raise InputError(f"unknown wildcard '{target}' (use *, *physical, *networked)")
    return [target] if target in kit else []


def resolve(kit, interfaces):
    """List of interface dicts {a, b, letters, types, texts} for the modules in 'kit'."""
    kit = check_modules(kit)
    pairs = {}
    for k, row in enumerate(interfaces, start=1):
        if len(row) < 4:
            raise InputError(f"interfaces entry {k}: needs [A, B, type, content]")
        a, b, typ, text = row[0], row[1], row[2], row[3]
        if a not in kit:
            continue
        letters = type_letters(typ)
        for m in expand_target(b, kit):
            if m == a:
                continue
            key = frozenset((a, m))
            if key not in pairs:
                pairs[key] = {"a": a, "b": m, "letters": "", "types": [], "texts": []}
            p = pairs[key]
            p["letters"] = "".join(c for c in LETTER_ORDER if c in set(p["letters"] + letters))
            if typ not in p["types"]:
                p["types"].append(typ)
            if text not in p["texts"]:
                p["texts"].append(text)
    return sorted(pairs.values(), key=lambda p: (p["a"], p["b"]))


def matrix_text(kit, ifs):
    """N x N matrix text (rows and columns = modules, cell = interface letters)."""
    kit = check_modules(kit)
    cell = {}
    for p in ifs:
        cell[(p["a"], p["b"])] = p["letters"]
        cell[(p["b"], p["a"])] = p["letters"]
    w = max(3, max((len(p["letters"]) for p in ifs), default=1) + 1)
    head = "     " + "".join(m[1:].rjust(w) for m in kit)
    lines = [head]
    for r in kit:
        cells = []
        for c in kit:
            cells.append(("\\" if r == c else cell.get((r, c), ".")).rjust(w))
        lines.append(f"{r} " + " " + "".join(cells) + f"   {MODULES[r][0]}")
    return "\n".join(lines)


def counts_by_letter(ifs):
    """How many interfaces contain each letter."""
    return {L: sum(1 for p in ifs if L in p["letters"]) for L in LETTER_ORDER}


# ----------------------------------------------------------------------------- sheets
def sheet_markdown(p, kit_label):
    """Markdown interface sheet stub for one pair."""
    a, b = p["a"], p["b"]
    na, nb = MODULES[a][0], MODULES[b][0]
    text = "\n".join(f"- {t}" for t in p["texts"])
    L = p["letters"]
    hs = ("Ready -> Request -> Busy -> Done (timeouts below). Signals named in the content: "
          + "; ".join(p["texts"])) if "S" in L else "No hard-wired handshake expected (check)."
    db_rows = "\n".join(f"| {w} | {n} | {t} | {d} | {m} | |" for w, n, t, d, m in DATA_BLOCK)

    def field_table(rows):
        return "\n| Item | Value / decision | Owner | Status |\n|---|---|---|---|\n" + \
               "\n".join(f"| {r} | ___ | ___ | open |" for r in rows)

    return f"""# Interface sheet {a} <-> {b}

| | |
|---|---|
| Module A | **{a}** {na} (typical IO {MODULES[a][2]}) |
| Module B | **{b}** {nb} (typical IO {MODULES[b][2]}) |
| System / kit | {kit_label} |
| Interface type | {' + '.join(p['types'])}  (matrix letters: **{L}**) |
| Sheet number / revision | IF-{a}-{b} / rev 0 (draft) |
| Responsible (one owner!) | ___ |

**Content (from the module standard):**

{text}

> Fill every `___`. A sheet is valid only when both sides have signed (section 10).
> Faces that do not apply: write "not applicable" + reason, do not delete them.

## 1. Mechanical interface {'(applies: M)' if 'M' in L else '(check)'}
{field_table(["Hand-over position (x, y, z) and tolerance (mm)", "Transfer height (mm)",
              "Centring / locating elements (cones, pins)", "Floor fixing / mounting, reference point",
              "Guards and reach (ISO 13857)", "Pallet / part / carrier type and mass (kg)"])}

## 2. Electrical interface
{field_table(["Power feed (V, A, who supplies)", "Control voltage 24 V DC (from which cabinet)",
              "IO list reference (DI / DO / AI)", "Terminal plan / connector type",
              "Cable owner and cable route", "Utility connection (air bar, coolant, water) " + ("(applies: U)" if "U" in L else "")])}

## 3. Safety {'(applies: F)' if 'F' in L else ''}
{field_table(["Safety functions shared (E-stop, door, light curtain, zone)", "PL required / PL reached (ISO 13849)",
              "Safe stop category (0 / 1 / 2)", "Muting / access zones", "Hard-wired or safety bus (PROFIsafe, CIP Safety)",
              "Reset concept (local / central)"])}

## 4. State model (PackML)
Both modules use the same PackML states and commands (docs/65 section 6).
- States: {PACKML_STATES}
- Commands: {PACKML_CMDS}
- Modes: 1 Production, 2 Maintenance, 3 Manual (mode change only in Stopped, Idle or Aborted)

{field_table(["Which state of A blocks B (and back)", "Reaction of B when A goes to Held / Suspended / Aborted",
              "Restart after E-stop: sequence", "Allowed modes for the hand-over"])}

## 5. PLC function block
{field_table([f"FB name {a} (library version)", f"FB name {b} (library version)",
              "Commands used", "Status used", "Alarm range of each module"])}

## 6. Hand-over (handshake)
{hs}

| Step | Signal | From -> To | Condition | Timeout (s) | Fault reaction |
|---|---|---|---|---|---|
| 1 | Ready (HS.Ready) | ___ | ___ | ___ | ___ |
| 2 | Request (HS.Request) | ___ | ___ | ___ | ___ |
| 3 | Busy / TransferActive | ___ | ___ | ___ | ___ |
| 4 | Done / TransferDone (HS.Ack) | ___ | ___ | ___ | ___ |

## 7. Communication {'(applies: D / N)' if ('D' in L or 'N' in L) else ''}
Standard data block (docs/66 section 8) - words 0-19 are the same in every module.

| Word | Name | Type | Direction (module view) | Meaning | Used here? |
|---|---|---|---|---|---|
{db_rows}

Module part (word 20+):

| Word | {a} module data | {b} module data |
|---|---|---|
| 20+ | {MODULE_PART.get(a, '___')} | {MODULE_PART.get(b, '___')} |

{field_table(["Protocol (Modbus TCP / PROFINET / OPC UA / MQTT)", "IP addresses, VLAN, switch port " + ("(applies: N)" if "N" in L else ""),
              "Unit ID / slot / NodeId root", "Numbering (0- or 1-based), 32-bit word order (standard: high word first)",
              "Poll / update time (ms), timeout 500 ms, heartbeat 3 s", "Firewall conduit (IEC 62443 zone)"])}

## 8. HMI & alarms
{field_table(["Screen(s) that show this interface", "Alarm numbers and texts (both sides)",
              "Operator help text for each alarm", "Who acknowledges, where"])}

## 9. Documents & tests
{field_table(["Drawings / circuit diagram pages", "FAT test steps for this interface",
              "SAT test steps", "Spare parts at the interface", "Maintenance points"])}

| Test | Method | Expected result | FAT | SAT |
|---|---|---|---|---|
| Normal hand-over x 10 | demonstration | no fault, within cycle time | ___ | ___ |
| Each timeout / fault reaction | test | module goes to the agreed state, alarm shown | ___ | ___ |
| E-stop during hand-over | test | safe stop of both, restart as agreed | ___ | ___ |
| Data block read / write | test (Modbus client / tool) | all words correct, heartbeat alive | ___ | ___ |

## 10. Sign-off

| Side | Company | Name | Date | Signature |
|---|---|---|---|---|
| {a} supplier | ___ | ___ | ___ | ___ |
| {b} supplier | ___ | ___ | ___ | ___ |
| Integrator | ___ | ___ | ___ | ___ |
| Owner | ___ | ___ | ___ | ___ |

*Generated by tools/fmse/interface_matrix.py (offline). Template only - check every value for your project.*
"""


def write_sheets(directory, ifs, kit_label):
    """Write one Markdown sheet per interface plus 00_index.md; return list of paths."""
    d = Path(directory)
    d.mkdir(parents=True, exist_ok=True)
    paths = []
    idx = [f"# Interface sheets - {kit_label}", "",
           f"{len(ifs)} interfaces. Letters: M mechanical, S signal, D data, U utility, F safety, N network.", "",
           "| No. | Sheet | Module A | Module B | Letters | Content |", "|---|---|---|---|---|---|"]
    for k, p in enumerate(ifs, start=1):
        name = f"IF_{p['a']}_{p['b']}.md"
        (d / name).write_text(sheet_markdown(p, kit_label), encoding="utf-8")
        paths.append(d / name)
        first = p["texts"][0]
        idx.append(f"| {k} | [{name}]({name}) | {p['a']} {MODULES[p['a']][0]} | {p['b']} {MODULES[p['b']][0]} | "
                   f"{p['letters']} | {first[:80]}{'...' if len(first) > 80 else ''} |")
    (d / "00_index.md").write_text("\n".join(idx) + "\n", encoding="utf-8")
    return paths


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    """Asserts against interface counts worked out by hand from the rules."""
    t = SelfTest("interface_matrix")
    data, kits = load_examples(path, "kits")
    ifs_all = data.get("interfaces", [])
    # Hand counts = explicit pairs + M18 '*physical' + M19 '*' + M20/M21 -> M19 (2) + M22 '*networked'
    # (interface list incl. the 2026-11-14 additions M11-M01, M17-M15, M05-M16, M08-M16, M17-M16):
    #   fms   explicit 13 (8 mech+signal, 1 signal+data, 2 data, 2 utility+signal) + 10 + 12 + 2 + 14 = 51
    #   fmc   explicit  6 (3 MS, 1 SD, 1 D, 1 US)                                 +  6 +  8 + 2 + 10 = 32
    #   asm   explicit  6 (4 MS, 2 SD)                                            +  6 +  7 + 2 + 10 = 31
    #   weld  explicit  4 (2 MS, 1 SD, 1 US)                                      +  6 +  7 + 2 + 10 = 29
    #   sheet explicit  5 (4 MS, 1 US)                                            +  7 +  8 + 2 + 11 = 33
    # Letter counts: M = MS pairs; S = MS + SD + US; D = SD + data + M19 '*' + 2; U = US; F = M18; N = M22.
    hand = {"fms": (51, {"M": 8, "S": 11, "D": 17, "U": 2, "F": 10, "N": 14}),
            "fmc": (32, {"M": 3, "S": 5, "D": 12, "U": 1, "F": 6, "N": 10}),
            "asm": (31, {"M": 4, "S": 6, "D": 11, "U": 0, "F": 6, "N": 10}),
            "weld": (29, {"M": 2, "S": 4, "D": 10, "U": 1, "F": 6, "N": 10}),
            "sheet": (33, {"M": 4, "S": 5, "D": 10, "U": 1, "F": 7, "N": 11})}
    for k, (n, letters) in hand.items():
        got = resolve(kits[k], ifs_all)
        t.equal(f"{k} interface count (hand {n})", len(got), n)
        t.equal(f"{k} letter counts (hand {letters})", counts_by_letter(got), letters)
    fms = {(p["a"], p["b"]): p for p in resolve(kits["fms"], ifs_all)}
    t.equal("M01-M02 letters MS", fms[("M01", "M02")]["letters"], "MS")
    t.true("no M18 safety link to M09 (no moving parts)", ("M18", "M09") not in fms)
    t.true("no M22 network link to M02 (wired into M01)", ("M22", "M02") not in fms)
    t.true("M22 network link to M18 exists", ("M22", "M18") in fms)
    t.true("M19 has no '*' data link to M20 (control module)", ("M19", "M20") not in fms
           and ("M20", "M19") in fms)
    t.equal("type letters 'utility+signal'", type_letters("utility+signal"), "SU")
    # web data cross-check: module names
    web = Path(__file__).resolve().parents[2] / "web" / "fmse_data.js"
    if web.is_file():
        txt = web.read_text(encoding="utf-8")
        # [code, name, ...] rows only (skip KIT lists like ["M01", "M07", ...])
        found = dict(re.findall(r'\["(M\d\d)",\s*"(?!M\d\d")([^"]+)"', txt))
        diff = [c for c in MODULES if found.get(c) != MODULES[c][0]]
        t.true("module names match web/fmse_data.js", not diff, f"differ: {diff}" if diff else "")
    else:
        print("  SKIP  web/fmse_data.js not found (module name cross-check)")
    try:
        resolve(["M01", "M99"], ifs_all)
        t.true("unknown module rejected", False)
    except InputError:
        t.true("unknown module rejected", True)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/interface_matrix.py --kit fms\n"
               "  python tools/fmse/interface_matrix.py --kit fms --sheets tools/fmse/examples/interface_sheets_fms\n"
               "  python tools/fmse/interface_matrix.py --modules M01,M02,M03,M04,M18,M19,M22 --csv if.csv")
    ap.add_argument("--examples", default=str(DEFAULT_EXAMPLES), help="shared example JSON (default: %(default)s)")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--kit", choices=["fms", "fmc", "asm", "weld", "sheet"], help="standard module kit")
    g.add_argument("--modules", help="your own module list, e.g. M01,M02,M03,M19")
    ap.add_argument("--sheets", help="write one Markdown interface sheet per pair into this folder")
    ap.add_argument("--csv", help="write the interface list to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    data, kits = load_examples(a.examples, "kits")
    if "interfaces" not in data:
        raise InputError("section 'interfaces' is missing in the example file")
    if a.modules:
        kit = check_modules([m.strip().upper() for m in a.modules.split(",") if m.strip()])
        label = "custom: " + ",".join(kit)
    else:
        k = a.kit or "fms"
        if k not in kits:
            raise InputError(f"kit '{k}' not in the example file")
        kit = check_modules(kits[k])
        label = KIT_NAMES.get(k, k)
    ifs = resolve(kit, data["interfaces"])
    print(f"INTERFACE MATRIX   {label}   {len(kit)} modules, {len(ifs)} interfaces")
    print("Letters: M mechanical, S signal, D data, U utility, F safety, N network   (\\ = same module, . = none)")
    print()
    print(matrix_text(kit, ifs))
    print()
    rows = [[k, p["a"], p["b"], p["letters"], " | ".join(p["texts"])[:90]] for k, p in enumerate(ifs, 1)]
    print(fmt_table(["no", "A", "B", "type", "content"], rows, "rllll"))
    c = counts_by_letter(ifs)
    print()
    print(f"Total: {len(ifs)} interfaces  -  " + ", ".join(f"{L} {c[L]}" for L in LETTER_ORDER))
    per = {m: sum(1 for p in ifs if m in (p["a"], p["b"])) for m in kit}
    print("Interfaces per module: " + ", ".join(f"{m} {per[m]}" for m in kit))
    if a.csv:
        p = write_csv(a.csv, ["no", "module_A", "name_A", "module_B", "name_B", "letters", "types", "content"],
                      [[k, x["a"], MODULES[x["a"]][0], x["b"], MODULES[x["b"]][0], x["letters"],
                        " + ".join(x["types"]), " | ".join(x["texts"])] for k, x in enumerate(ifs, 1)])
        print(f"CSV written: {p}")
    if a.sheets:
        paths = write_sheets(a.sheets, ifs, label)
        print(f"{len(paths)} interface sheets + 00_index.md written to {a.sheets}")
    return 0


if __name__ == "__main__":
    run_main(main)
