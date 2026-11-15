#!/usr/bin/env python3
"""IEC 61131-3 Structured Text generator: global IO variables + the device FB of a module, generated from the
item-8 circuit library (module expansion, IO list, card addresses and card counts of circuit_lib_core.py).

Python 3 standard library only, offline. Rule = "_rules.codegen" in examples/item9_examples.json, applied EXACTLY;
the library is tools/fmse/examples/item8_examples.json, expanded by circuit_lib_core.expand_module (no second copy
of the item-8 rules). Guide docs/FMS system design/69_plc_programming.md and the web page generate the same text, so
lines, characters and the Adler-32 checksum are identical.

Generated text (lines joined with '\\n', final '\\n'):
  2 comment lines (module, unit, title ; IO count per type) - VAR_GLOBAL - one line per io entry in expansion order:
    DI  '<unit>_<group>_<signal> AT %IX<byte>.<bit> : BOOL;'   byte = 2*(k//16) + (k%16)//8, bit = k%8
    DO  same with %QX ; AI '%IW<2*cards_DI + 8*(k//4) + 2*(k%4)> : INT;' ; AO '%QW<2*cards_DO + 4*(k//2) + 2*(k%2)>'
    FDI / FDO no address (F-program copies) ; comment '(* <tag> | <card address> | <description> *)'
  END_VAR - FUNCTION_BLOCK FB_<unit>_Devices - one FB instance per pattern instance with io (fb_types) - calls:
    '<group>(x<Sig> := <sym>, i<Sig> := <sym>);' (DI/FDI 'x', AI 'i') then '<sym> := <group>.q<Sig>;' (DO) and
    '<sym> := <group>.w<Sig>;' (AO) ; FDO: no line (written only by the F-program) - END_FUNCTION_BLOCK.

Usage:
  python tools/fmse/st_codegen.py                         (= --module M02: print the generated text)
  python tools/fmse/st_codegen.py --module M03 --out M03.st
  python tools/fmse/st_codegen.py --all                   (every module: IO, FB instances, lines, chars, Adler-32)
  python tools/fmse/st_codegen.py --all --out-dir st_out  (one .st file per module)
  python tools/fmse/st_codegen.py --kit                   (library kit: FB instances per module instance, total)
  python tools/fmse/st_codegen.py --kit --out-dir kit_st  (one file per module instance, units MC01, MC02 ...)
  python tools/fmse/st_codegen.py --all --md codegen.md --json
  python tools/fmse/st_codegen.py --selftest
"""

import argparse
import json
import zlib
from pathlib import Path

import circuit_lib_core as core
from fmse_common import InputError, SelfTest, fmt_table, load_json, run_main

HERE = Path(__file__).resolve().parent
ITEM9_EXAMPLES = HERE / "examples" / "item9_examples.json"
TYPES = ["DI", "DO", "AI", "AO", "FDI", "FDO"]


def load_fb_types(path=None):
    D = load_json(path or ITEM9_EXAMPLES)
    if "codegen" not in D or "fb_types" not in D["codegen"]:
        raise InputError(f"{path or ITEM9_EXAMPLES}: section 'codegen.fb_types' is missing")
    return D["codegen"]


def adler(text):
    return format(zlib.adler32(text.encode("utf-8")) & 0xFFFFFFFF, "08x")


def generate(L, code, fb_types, unit=None):
    """Generate the ST text of one module instance. Returns dict(text, lines, chars, adler32, fb, io, unit)."""
    E = core.expand_module(L, code, unit)
    unit, cards, used = E["unit"], E["cards"], E["used"]
    lines = [f"(* AUTO-GENERATED from the item 8 circuit library: {code} {unit} - {E['title']} *)",
             f"(* IO: {len(E['io'])} points (DI {used['DI']}, DO {used['DO']}, AI {used['AI']}, AO {used['AO']}, "
             f"FDI {used['FDI']}, FDO {used['FDO']}) - do not edit by hand, regenerate *)", "VAR_GLOBAL"]
    cnt = {t: 0 for t in TYPES}
    for e in E["io"]:
        t = e["type"]
        sym = f"{unit}_{e['group']}_{e['signal']}"
        k = cnt[t]
        cnt[t] += 1
        com = f"{e['tag']} | {e['address']} | {e['description']}"
        if t in ("DI", "DO"):
            byte, bit = 2 * (k // 16) + (k % 16) // 8, k % 8
            lines.append(f"  {sym} AT %{'I' if t == 'DI' else 'Q'}X{byte}.{bit} : BOOL; (* {com} *)")
        elif t == "AI":
            lines.append(f"  {sym} AT %IW{2 * cards['DI'] + 8 * (k // 4) + 2 * (k % 4)} : INT; (* {com} *)")
        elif t == "AO":
            lines.append(f"  {sym} AT %QW{2 * cards['DO'] + 4 * (k // 2) + 2 * (k % 2)} : INT; (* {com} *)")
        elif t == "FDI":
            lines.append(f"  {sym} : BOOL; (* {e['tag']} | {e['address']} | F-input, read-only copy from the "
                         f"F-program *)")
        else:
            lines.append(f"  {sym} : BOOL; (* {e['tag']} | {e['address']} | F-output, written only by the "
                         f"F-program *)")
    lines += ["END_VAR", "", f"FUNCTION_BLOCK FB_{unit}_Devices", "VAR"]
    inst = [r for r in E["instances"] if r["io"]]
    for r in inst:
        if r["pattern"] not in fb_types:
            raise InputError(f"codegen: no FB type for pattern '{r['pattern']}' in codegen.fb_types")
        lines.append(f"  {r['group']} : {fb_types[r['pattern']]}; (* {r['pattern']} *)")
    lines.append("END_VAR")
    for r in inst:
        g = r["group"]
        sym = lambda s: f"{unit}_{g}_{s}"
        prm = [(f"x{e['signal']} := {sym(e['signal'])}" if e["type"] in ("DI", "FDI") else
                f"i{e['signal']} := {sym(e['signal'])}") for e in r["io"] if e["type"] in ("DI", "FDI", "AI")]
        lines.append(f"{g}({', '.join(prm)});")
        for e in r["io"]:
            if e["type"] == "DO":
                lines.append(f"{sym(e['signal'])} := {g}.q{e['signal']};")
            elif e["type"] == "AO":
                lines.append(f"{sym(e['signal'])} := {g}.w{e['signal']};")
    lines.append("END_FUNCTION_BLOCK")
    text = "\n".join(lines) + "\n"
    return {"code": code, "unit": unit, "title": E["title"], "text": text, "lines": len(lines), "chars": len(text),
            "adler32": adler(text), "fb": len(inst), "io": len(E["io"]), "used": used}


def kit_fb(L, fb_types):
    """FB instances generated over the library kit (each module instance counts). Returns (rows, total)."""
    K = L.get("kit") or {}
    if not K.get("modules"):
        raise InputError("library: section 'kit' with 'modules' is missing")
    rows = [generate(L, c, fb_types, u) for c, u in core.kit_units(L, K["modules"])]
    return rows, sum(r["fb"] for r in rows)


def write_text(path, text):
    p = Path(path)
    if p.parent and not p.parent.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    return p


# ----------------------------------------------------------------------------- output
def table(rows):
    return fmt_table(["module", "unit", "io", "DI", "DO", "AI", "AO", "FDI", "FDO", "FB inst.", "lines", "chars",
                      "Adler-32", "title"],
                     [[r["code"], r["unit"], r["io"]] + [r["used"][t] for t in TYPES]
                      + [r["fb"], r["lines"], r["chars"], r["adler32"], r["title"]] for r in rows],
                     "llrrrrrrrrrrll")


def md_rows(title, rows, total=None):
    L = [f"# {title}", "", "| module | unit | io | FB instances | lines | chars | Adler-32 | title |",
         "|---|---|---:|---:|---:|---:|---|---|"]
    L += [f"| {r['code']} | {r['unit']} | {r['io']} | {r['fb']} | {r['lines']} | {r['chars']} | {r['adler32']} | "
          f"{r['title']} |" for r in rows]
    if total is not None:
        L += ["", f"FB instances in total: **{total}**"]
    return "\n".join(L) + "\n"


# ----------------------------------------------------------------------------- self-test
REF_GEN = {"M02": (32, 1830, "0f66079f", 5), "M03": (70, 5169, "b0c1f5f1", 13), "M10": (56, 4004, "5ab5ac95", 10)}
REF_FB = {"M01": 3, "M02": 5, "M03": 13, "M04": 9, "M05": 7, "M06": 6, "M07": 12, "M08": 15, "M09": 3, "M10": 10,
          "M11": 3, "M12": 5, "M13": 10, "M14": 8, "M15": 12, "M16": 11, "M17": 5, "M18": 9, "M19": 1, "M20": 0,
          "M21": 0, "M22": 1}
REF_M02_HEAD = ["(* AUTO-GENERATED from the item 8 circuit library: M02 APC01 - Automatic pallet changer (APC) *)",
                "(* IO: 10 points (DI 6, DO 3, AI 1, AO 0, FDI 0, FDO 0) - do not edit by hand, regenerate *)",
                "VAR_GLOBAL",
                "  APC01_Rotate_SolA AT %QX0.0 : BOOL; (* PLT1.MACH.FMS1.APC01.Rotate.SolA | DO1.00 | solenoid A *)"]


def selftest(path):
    t = SelfTest("st_codegen")
    CG = load_fb_types(path)
    L = core.load_library()
    fbt = CG["fb_types"]
    t.equal("codegen modules of the JSON = M02, M03, M10", CG["modules"], ["M02", "M03", "M10"])
    for code, w in REF_GEN.items():
        g = generate(L, code, fbt)
        t.equal(f"{code}: lines {w[0]}, chars {w[1]}, Adler-32 {w[2]}, FB instances {w[3]} (reference text)",
                (g["lines"], g["chars"], g["adler32"], g["fb"]), w)
    g2 = generate(L, "M02", fbt)
    t.equal("M02: first 4 lines", g2["text"].split("\n")[:4], REF_M02_HEAD)
    t.true("M02: AI ClampPress at %IW2 (= 2*cards_DI 1 + 0)", "APC01_ClampPress_Value AT %IW2 : INT;" in g2["text"])
    t.true("M02: call line of the double valve", "Rotate(xPosA := APC01_Rotate_PosA, xPosB := APC01_Rotate_PosB);"
           in g2["text"])
    t.true("text ends with one newline, no CR", g2["text"].endswith("END_FUNCTION_BLOCK\n") and "\r" not in g2["text"])
    allfb = {c: generate(L, c, fbt)["fb"] for c in L["modules"]}
    t.equal("FB instances per module M01..M22 = reference", allfb, REF_FB)
    rows, total = kit_fb(L, fbt)
    t.equal("kit: 18 module instances, FB instances 95", (len(rows), total), (18, 95))
    t.true("kit: second HMC is unit MC02 with its own symbols", rows[1]["unit"] == "MC02" and "MC02_" in rows[1]["text"])
    g3 = generate(L, "M03", fbt)
    t.true("M03: F-inputs have no %I address, F-outputs no assignment line",
           "POOL01_Enable_Ok2 : BOOL; (*" in g3["text"] and "POOL01_DriveSup_Enable :=" not in g3["text"])
    bad = dict(fbt)
    bad.pop("SENSOR")
    try:
        generate(L, "M02", bad)
        t.true("missing FB type -> InputError", False)
    except InputError:
        t.true("missing FB type -> InputError", True)
    try:
        generate(L, "M99", fbt)
        t.true("unknown module -> InputError", False)
    except InputError:
        t.true("unknown module -> InputError", True)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM9_EXAMPLES), help="item-9 JSON with fb_types (default: %(default)s)")
    ap.add_argument("--library", default=str(core.ITEM8_EXAMPLES), help="item-8 library (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="= --module M02 (default)")
    ap.add_argument("--module", help="generate one module, e.g. M02")
    ap.add_argument("--out", help="write the generated text of --module to this .st file")
    ap.add_argument("--all", action="store_true", help="every module: counts and checksums")
    ap.add_argument("--kit", action="store_true", help="library kit: FB instances per module instance")
    ap.add_argument("--out-dir", help="with --all / --kit: write one .st file per module (instance)")
    ap.add_argument("--md", help="with --all / --kit: write a Markdown table")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    CG = load_fb_types(a.examples)
    L = core.load_library(a.library)
    fbt = CG["fb_types"]
    if a.all or a.kit:
        if a.kit:
            rows, total = kit_fb(L, fbt)
            title = f"ST code generation - library kit '{L['kit'].get('name', 'kit')}'"
        else:
            rows = [generate(L, c, fbt) for c in L["modules"]]
            total = sum(r["fb"] for r in rows)
            title = "ST code generation - all modules of the item-8 library"
        if a.out_dir:
            for r in rows:
                write_text(Path(a.out_dir) / f"{r['code']}_{r['unit']}.st", r["text"])
        if a.md:
            Path(a.md).write_text(md_rows(title, rows, total), encoding="utf-8")
        if a.json:
            print(json.dumps({"title": title, "fb_total": total,
                              "rows": [{k: v for k, v in r.items() if k != "text"} for r in rows]}, indent=1))
            return 0
        print(title.upper())
        print(table(rows))
        print(f"  FB instances in total: {total}" + (" (each module instance counts)" if a.kit else ""))
        for p, what in ((a.out_dir, f"{len(rows)} .st files written to"), (a.md, "Markdown written:")):
            if p:
                print(f"\n{what} {p}")
        return 0
    code = (a.module or "M02").upper()
    g = generate(L, code, fbt)
    if a.out:
        write_text(a.out, g["text"])
    if a.json:
        print(json.dumps({k: v for k, v in g.items()}, indent=1))
        return 0
    if a.out:
        print(f"{code} {g['unit']}: {g['lines']} lines, {g['chars']} characters, Adler-32 {g['adler32']}, "
              f"{g['fb']} FB instances -> written {a.out}")
    else:
        print(g["text"], end="")
        print(f"(* {g['lines']} lines, {g['chars']} characters, Adler-32 {g['adler32']}, {g['fb']} FB instances *)")
    return 0


if __name__ == "__main__":
    run_main(main)
