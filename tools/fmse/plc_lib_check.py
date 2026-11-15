#!/usr/bin/env python3
"""Rule checks of the ST device FB library tools/fmse/plc_lib (item 10A).

Python 3 standard library only, offline. Every .st file is parsed with the interpreter of st_sim.py (so the library
stays inside the supported ST subset), then:

  C1  every FB type of item 9 codegen.fb_types has its own .st file with a FUNCTION_BLOCK of the same name
  C2  for ALL 22 modules of the item-8 library the code of st_codegen.py is checked against the .st interfaces:
      every call parameter x<Signal> / i<Signal> is a VAR_INPUT, every <group>.q<Signal> / .w<Signal> a VAR_OUTPUT
      (exact spelling); then the generated FB_<unit>_Devices is loaded with the library and RUN for 3 cycles
  C3  every FB file has the header (purpose, rule, interface table with every input / output, version, alarm table,
      timing note, Siemens note, example-values notice); the alarm table = fb_library.LIBRARY
  C4  no library FB writes a global variable (so it can never write an F-signal) and none reads a global variable
      except the constants of TYPES.st; no FB has an output named after an F-output of its pattern; the generated code
      has no assignment to an F-output
  C5  interfaces = examples/item10a_examples.json fb_interfaces (inputs + configuration with defaults, outputs in
      order) and = the Python classes of fb_library.py (all 29 FBs)
  C6  TYPES.st: enumerations E_PackMLState / E_PackMLCmd = the item-5 tables, GC_CYCLE_MS = 100 ms test base;
      every file ASCII, '\\n' line ends, no TAB

Usage:
  python tools/fmse/plc_lib_check.py                     (all checks, summary table; = --example)
  python tools/fmse/plc_lib_check.py --modules           (+ C2 per module: FB instances, parameters, cycles)
  python tools/fmse/plc_lib_check.py --lib other_lib --md check.md --json
  python tools/fmse/plc_lib_check.py --selftest
"""

import argparse
import json
import re
from pathlib import Path

import circuit_lib_core as core
import fb_library as fbl
import st_codegen
import st_sim
from fmse_common import InputError, SelfTest, fmt_table, load_json, run_main

HERE = Path(__file__).resolve().parent
PLC_LIB = HERE / "plc_lib"
HEADER_KEYS = ["Library   :", "Version :", "Rule      :", "Purpose   :", "Interface :", "Alarms    :", "Timing    :",
               "Siemens   :", "NOTICE    :", "EXAMPLES"]


def read_sources(lib_dir):
    d = Path(lib_dir)
    if not d.is_dir():
        raise InputError(f"PLC library folder not found: {d}")
    src = {}
    for p in sorted(d.glob("*.st"), key=lambda q: (q.name.upper() != "TYPES.ST", q.name.lower())):
        src[p.name] = p.read_bytes().decode("utf-8", errors="replace")
    if not src:
        raise InputError(f"no .st files in {d}")
    return src


def build(src):
    lib = st_sim.Library()
    for name, text in src.items():
        lib.load_text(text, name)
    return lib


def roots_written(stmts):
    """Root variable names written by assignments / '=>' outputs (lower case)."""
    out = []
    for s in st_sim.walk_stmts(stmts):
        if s[0] == "assign":
            out.append((root(s[2]), s[1]))
        elif s[0] == "call":
            out += [(root(e), s[1]) for n, kind, e in s[3] if kind == "=>"]
        elif s[0] == "for":
            out.append((s[2].lower(), s[1]))
    return out


def root(e):
    while e[0] in ("field", "index"):
        e = e[1]
    return e[1]


def names_read(node, acc):
    """All plain variable names read in an AST node (lower case)."""
    if isinstance(node, tuple):
        if node and node[0] == "var":
            acc.add(node[1])
            return acc
        if node and node[0] == "field" and node[1][0] == "var":
            acc.add(node[1][1])
            return acc
        for x in node[1:]:
            names_read(x, acc)
    elif isinstance(node, list):
        for x in node:
            names_read(x, acc)
    return acc


# ----------------------------------------------------------------------------- checks
def run_checks(src, with_run=True):
    """Return dict(results=[(id, title, n_checked, problems[])], modules=[rows], lib=Library)."""
    res, mods = [], []
    lib = build(src)
    pous = {p.name: p for p in lib.user_pous()}
    CG = st_codegen.load_fb_types()
    fbt = CG["fb_types"]
    L8 = core.load_library()
    D = fbl.load10a()

    # C1
    prob, types = [], sorted(set(fbt.values()))
    for t in types:
        if f"{t}.st" not in src:
            prob.append(f"{t}: file {t}.st missing")
        elif t not in pous or pous[t].kind != "FUNCTION_BLOCK" or pous[t].file != f"{t}.st":
            prob.append(f"{t}: {t}.st has no FUNCTION_BLOCK {t}")
    res.append(("C1", "every codegen fb_type has its .st file", len(types), prob))

    # C2 + C4 (generated code)
    prob, prob4g, n_par, n_out, gen_texts = [], [], 0, 0, []
    for code in L8["modules"]:
        g = st_codegen.generate(L8, code, fbt)
        E = core.expand_module(L8, code, None)
        unit = g["unit"]
        inst_type = dict(re.findall(r"^  (\w+) : (FB_\w+); \(\*", g["text"], re.M))
        np_ = no_ = 0
        for line in g["text"].split("\n"):
            m = re.fullmatch(r"(\w+)\((.*)\);", line)
            if m and m.group(1) in inst_type:
                pou = pous.get(inst_type[m.group(1)])
                for prm in [x.strip() for x in m.group(2).split(",") if x.strip()]:
                    n = prm.split(":=")[0].strip()
                    np_ += 1
                    d = pou.var(n) if pou else None
                    if d is None or d.section != "VAR_INPUT" or d.name != n:
                        prob.append(f"{code} {m.group(1)}: '{n}' is not a VAR_INPUT of {inst_type[m.group(1)]}"
                                    + (f" (declared '{d.name}')" if d is not None and d.name != n else ""))
                continue
            m = re.fullmatch(r"(\w+) := (\w+)\.([qw]\w+);", line)
            if m:
                pou = pous.get(inst_type.get(m.group(2), ""))
                no_ += 1
                d = pou.var(m.group(3)) if pou else None
                if d is None or d.section != "VAR_OUTPUT" or d.name != m.group(3):
                    prob.append(f"{code} {m.group(2)}: '{m.group(3)}' is not a VAR_OUTPUT of "
                                f"{inst_type.get(m.group(2), '?')}")
        fdo = {f"{unit}_{e['group']}_{e['signal']}".lower() for e in E["io"] if e["type"] == "FDO"}
        for r in E["instances"]:
            if not r["io"]:
                continue
            pou = pous.get(fbt.get(r["pattern"], ""))
            for e in r["io"]:
                if e["type"] == "FDO" and pou is not None:
                    for cand in ("q" + e["signal"], "w" + e["signal"], e["signal"]):
                        d = pou.var(cand)
                        if d is not None and d.section == "VAR_OUTPUT":
                            prob4g.append(f"{pou.name}: output '{d.name}' looks like the F-output {e['signal']}")
        n_par += np_
        n_out += no_
        gen_texts.append((code, unit, g, fdo, np_, no_))
    # load all generated modules with the library and run them
    run_ok = {}
    if with_run:
        glib = build(src)
        for code, unit, g, fdo, np_, no_ in gen_texts:
            try:
                glib.load_text(g["text"], f"{code}_{unit}.st")
                pou = glib.pous[f"fb_{unit.lower()}_devices"]
                for v, ln in roots_written(pou.body):
                    if v in fdo:
                        prob4g.append(f"{code}: generated code writes the F-output {v} (line {ln})")
                inst = glib.instantiate(pou.name)
                for _ in range(3):
                    glib.call(inst)
                run_ok[code] = True
            except InputError as exc:
                run_ok[code] = False
                prob.append(f"{code}: generated code does not load / run with the library: {exc}")
    for code, unit, g, fdo, np_, no_ in gen_texts:
        mods.append([code, unit, g["fb"], np_, no_, len(fdo), ("ok" if run_ok.get(code) else "FAIL") if with_run
                     else "-"])
    res.append(("C2", f"codegen names = .st interfaces, 22 modules ({n_par} inputs, {n_out} outputs), run 3 cycles",
                n_par + n_out, prob))

    # C3 headers
    prob, n = [], 0
    for p in pous.values():
        h = p.header
        n += 1
        for k in HEADER_KEYS:
            if k not in h:
                prob.append(f"{p.name}: header item '{k.strip(' :')}' missing")
        if f"Version : {fbl.LIB_VERSION}" not in h:
            prob.append(f"{p.name}: header version is not {fbl.LIB_VERSION}")
        for d in p.section("VAR_INPUT") + p.section("VAR_OUTPUT"):
            if not re.search(r"^    (IN|CFG|OUT)\s+" + re.escape(d.name) + r"\s", h, re.M):
                prob.append(f"{p.name}: '{d.name}' missing in the interface table of the header")
        alarms = {}
        if "Alarms    :" in h:
            blk = h.split("Alarms    :", 1)[1].split("Timing    :", 1)[0]
            alarms = {int(a): t.strip() for a, t in re.findall(r"^    (\d)  (.+)$", blk, re.M)}
        want = fbl.LIBRARY[p.name][2] if p.name in fbl.LIBRARY else {}
        if alarms != want:
            prob.append(f"{p.name}: alarm table {alarms} differs from fb_library {want}")
    res.append(("C3", "header: purpose, rule, interface, version, alarm table, notes", n, prob))

    # C4 globals / F-signals in the library
    prob, n = list(prob4g), 0
    for p in pous.values():
        local = {v.name.lower() for v in p.vars} | ({p.name.lower()} if p.kind == "FUNCTION" else set())
        for v, ln in roots_written(p.body):
            n += 1
            if v not in local:
                prob.append(f"{p.name} ({p.file}:{ln}): writes the global '{v}'")
        reads = names_read(p.body, set())
        for v in sorted(reads - local):
            if v in lib.gvals and v not in lib.gconsts:
                prob.append(f"{p.name}: reads the global variable '{v}' (only constants allowed)")
    res.append(("C4", "no FB writes a global / F-signal; generated code never writes an F-output", n, prob))

    # C5 interfaces
    prob, n = [], 0
    for name, spec in D["fb_interfaces"].items():
        n += 1
        p = pous.get(name)
        if p is None:
            prob.append(f"{name}: no FUNCTION_BLOCK")
            continue
        ins = [d.name for d in p.section("VAR_INPUT")]
        outs = [d.name for d in p.section("VAR_OUTPUT")]
        if set(ins) != set(spec["in"]) | set(spec["cfg"]):
            prob.append(f"{name}: inputs {ins} != JSON in + cfg {spec['in'] + list(spec['cfg'])}")
        if outs != spec["out"]:
            prob.append(f"{name}: outputs {outs} != JSON {spec['out']}")
        inst = lib.instantiate(name)
        for k, v in spec["cfg"].items():
            if k.lower() in inst.vals and inst.vals[k.lower()] != v:
                prob.append(f"{name}: default {k} = {inst.vals[k.lower()]} != JSON {v}")
    for name, (cls, kind, alarms) in fbl.LIBRARY.items():
        n += 1
        p = pous.get(name)
        if p is None:
            prob.append(f"{name}: no FUNCTION_BLOCK in the .st library")
            continue
        inst = lib.instantiate(name)
        py_in = dict(cls.IN)
        py_in.update(cls.CFG)
        st_in = {d.name: inst.vals[d.name.lower()] for d in p.section("VAR_INPUT")}
        if st_in != py_in:
            prob.append(f"{name}: ST inputs/defaults {st_in} != Python {py_in}")
        if [d.name for d in p.section("VAR_OUTPUT")] != list(cls().o):
            prob.append(f"{name}: ST outputs != Python outputs {list(cls().o)}")
    res.append(("C5", "interfaces = JSON fb_interfaces (17) and = fb_library classes (29)", n, prob))

    # C6 types + text hygiene
    prob, n = [], 0
    st_states = {k.upper(): v for k, v in fbl.STATES.items()}
    st_cmds = {k.upper(): v for k, v in fbl.CMDS.items()}
    for en, want in (("e_packmlstate", st_states), ("e_packmlcmd", st_cmds)):
        n += 1
        got = {k.upper(): v for k, v in lib.enums.get(en, ("", {}, ""))[1].items() if v != 0}
        if got != want:
            prob.append(f"TYPES.st {en}: {got} != item-5 table {want}")
    n += 1
    if lib.gvals.get("gc_cycle_ms") != fbl.DT:
        prob.append(f"TYPES.st GC_CYCLE_MS = {lib.gvals.get('gc_cycle_ms')}, test base is {fbl.DT} ms")
    for fname, text in src.items():
        n += 1
        if "\r" in text:
            prob.append(f"{fname}: CR line ends (use '\\n')")
        if "\t" in text:
            prob.append(f"{fname}: TAB character")
        if any(ord(c) > 127 for c in text):
            prob.append(f"{fname}: non-ASCII character (portability)")
    res.append(("C6", "TYPES.st = item-5 tables, GC_CYCLE_MS 100; ASCII, LF, no TAB", n, prob))
    return {"results": res, "modules": mods, "lib": lib}


# ----------------------------------------------------------------------------- output
def summary_rows(R):
    return [[cid, "PASS" if not p else "FAIL", n, len(p), title] for cid, title, n, p in R["results"]]


def text_report(R, with_modules):
    out = [f"PLC LIBRARY CHECK  version {fbl.LIB_VERSION}: {len(R['lib'].user_pous())} POUs, "
           f"{len(R['lib'].enums)} enumerations"]
    out.append(fmt_table(["check", "result", "checked", "problems", "what"], summary_rows(R), "llrrl"))
    for cid, title, n, p in R["results"]:
        for x in p:
            out.append(f"  {cid}: {x}")
    if with_modules:
        out.append("")
        out.append(fmt_table(["module", "unit", "FB inst.", "inputs", "outputs", "F-outputs", "run 3 cycles"],
                             R["modules"], "llrrrrl"))
    ok = all(not p for _, _, _, p in R["results"])
    out.append(f"RESULT: {'ALL CHECKS PASSED' if ok else 'PROBLEMS FOUND'}")
    return "\n".join(out)


def md_report(R):
    L = ["# PLC library check (item 10A)", "", "| check | result | checked | problems | what |", "|---|---|---:|---:|---|"]
    L += [f"| {a} | {b} | {c} | {d} | {e} |" for a, b, c, d, e in summary_rows(R)]
    L += ["", "| module | unit | FB instances | inputs | outputs | F-outputs | run |", "|---|---|---:|---:|---:|---:|---|"]
    L += ["| " + " | ".join(str(x) for x in r) + " |" for r in R["modules"]]
    probs = [f"- {cid}: {x}" for cid, _, _, p in R["results"] for x in p]
    L += ["", "Problems:" if probs else "No problems."] + probs
    return "\n".join(L) + "\n"


# ----------------------------------------------------------------------------- self-test
def selftest(lib_dir):
    t = SelfTest("plc_lib_check")
    src = read_sources(lib_dir)
    R = run_checks(src)
    res = {cid: (n, p) for cid, _, n, p in R["results"]}
    for cid, title, n, p in R["results"]:
        t.equal(f"{cid} {title}: no problem", p, [])
    t.equal("C1: 24 FB types in codegen.fb_types (25 patterns, ANALOG_P + ANALOG_T -> FB_AnalogIn)", res["C1"][0], 24)
    t.equal("31 .st files (29 FBs + F_CmdAllowed + TYPES)", len(src), 31)
    t.equal("C2: 22 modules checked, all run 3 cycles", (len(R["modules"]), all(m[6] == "ok" for m in R["modules"])),
            (22, True))
    t.equal("C2: FB instances per module = st_codegen REF_FB (sum 154)", {m[0]: m[2] for m in R["modules"]},
            st_codegen.REF_FB)
    t.equal("C2: M02 APC01: 5 FB, 7 inputs, 3 outputs checked", R["modules"][1][:5], ["M02", "APC01", 5, 7, 3])
    t.true("C2: more than 300 parameter names checked", res["C2"][0] > 300, f"{res['C2'][0]}")
    t.equal("C5: 17 JSON interfaces + 29 Python classes", res["C5"][0], 46)
    # negative tests (mutated sources in memory)
    bad = dict(src)
    bad["FB_Valve2.st"] = src["FB_Valve2.st"].replace("xPosB", "xPosBB")
    Rb = {cid: p for cid, _, _, p in run_checks(bad, with_run=False)["results"]}
    t.true("mutation: renamed input xPosB of FB_Valve2 -> C2 finds it in the M02 call",
           any("M02 Rotate: 'xPosB'" in x for x in Rb["C2"]))
    t.true("mutation: renamed input -> C5 (JSON interface) finds it", any("FB_Valve2: inputs" in x for x in Rb["C5"]))
    bad = dict(src)
    bad["FB_Feeder.st"] = src["FB_Feeder.st"].replace("xOk := xSupplyOn;", "xOk := xSupplyOn;\nGC_DUMMY := 1;")
    bad["TYPES.st"] = src["TYPES.st"].replace("VAR_GLOBAL CONSTANT", "VAR_GLOBAL\n  GC_DUMMY : INT;\nEND_VAR\n"
                                              "VAR_GLOBAL CONSTANT")
    Rb = {cid: p for cid, _, _, p in run_checks(bad, with_run=False)["results"]}
    t.true("mutation: FB writes a global -> C4 finds it", any("writes the global 'gc_dummy'" in x for x in Rb["C4"]))
    bad = dict(src)
    bad["FB_Ups.st"] = src["FB_Ups.st"].replace("Version : 1.0.0", "Version : 0.9")
    bad["FB_Sensor.st"] = src["FB_Sensor.st"].replace("    OUT  xValue", "    OUT  yValue")
    Rb = {cid: p for cid, _, _, p in run_checks(bad, with_run=False)["results"]}
    t.true("mutation: wrong header version -> C3", any("FB_Ups: header version" in x for x in Rb["C3"]))
    t.true("mutation: output missing in the header table -> C3", any("'xValue' missing" in x for x in Rb["C3"]))
    bad = dict(src)
    bad["FB_Heater.st"] = src["FB_Heater.st"].replace("    4  feedback without command", "    4  welded")
    Rb = {cid: p for cid, _, _, p in run_checks(bad, with_run=False)["results"]}
    t.true("mutation: alarm text differs from fb_library -> C3", any("FB_Heater: alarm table" in x for x in Rb["C3"]))
    bad = dict(src)
    del bad["FB_Scanner.st"]
    Rb = {cid: p for cid, _, _, p in run_checks(bad, with_run=False)["results"]}
    t.true("missing FB_Scanner.st -> C1 and C5 report it",
           "FB_Scanner: file FB_Scanner.st missing" in Rb["C1"] and any("FB_Scanner" in x for x in Rb["C5"]))
    bad = dict(src)
    bad["FB_Scanner.st"] = src["FB_Scanner.st"].replace("iAlarm := 0;", "iAlarm := 0.0;", 1)
    t.true("ST outside the subset / type error is found when the generated code runs (C2)",
           any("REAL" in x for x in run_checks(bad)["results"][1][3]))
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lib", default=str(PLC_LIB), help="folder with the .st library (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="check tools/fmse/plc_lib (default)")
    ap.add_argument("--modules", action="store_true", help="add the C2 table per module")
    ap.add_argument("--md", help="write a Markdown report")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.lib)
    R = run_checks(read_sources(a.lib))
    ok = all(not p for _, _, _, p in R["results"])
    if a.md:
        Path(a.md).write_text(md_report(R), encoding="utf-8")
    if a.json:
        print(json.dumps({"ok": ok, "checks": [{"id": c, "what": w, "checked": n, "problems": p}
                                               for c, w, n, p in R["results"]],
                          "modules": [dict(zip(["module", "unit", "fb", "inputs", "outputs", "fdo", "run"], m))
                                      for m in R["modules"]]}, indent=1))
        return 0 if ok else 1
    print(text_report(R, a.modules))
    if a.md:
        print(f"\nMarkdown written: {a.md}")
    return 0 if ok else 1


if __name__ == "__main__":
    run_main(main)
