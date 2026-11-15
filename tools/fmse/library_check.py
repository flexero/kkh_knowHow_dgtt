#!/usr/bin/env python3
"""Rule checks over the module circuit library and a kit (item 8): tag length and uniqueness, unique designations,
IO spare >= 20 % per card type, safety signals only on F-DI / F-DO, two-channel inputs in pairs, PSU reserve >= 25 %,
feeder breaker >= installed current, cable Iz*k >= breaker In, a feeder for every module with motors, power cable
cross-section >= calculated size, and safety inputs (F-DI) with a safety function output (F-DO).

Python 3 standard library only, offline. Data = examples/item8_examples.json, expanded by circuit_lib_core.py (the
same expansion as circuit_library.py / module_power.py). Guide: docs/FMS system design/68_module_circuits.md.

Rules (one finding per violation):
  R1 tag    tag length <= 48 characters (item-5 rule) ; tags unique inside a module and inside the kit
  R2 desig  device designations unique per module ; cable numbers unique per module
  R3 spare  spare(type) >= 20 % of used(type) for every IO type with used > 0
  R4 safety every safety signal of a safety-related pattern is F-DI / F-DO (ESTOP, ENABLE, MODE_SWITCH, DOOR_LOCK,
            DOOR_2CH, LC, SCANNER, TWOHAND, SAFE_VALVE, COUPLING, CONT_PAIR_EDM, VFD_STO STO) and present
  R5 pairs  two-channel inputs come in pairs (Ok/Ok2, Ossd1/Ossd2, Left/Left2, FbA/FbB ...): both present, both F-DI ;
            also generic: an F-DI signal 'X2' needs 'X' (or 'X1'), an F-DI 'X1' needs 'X2'
  R6 psu    PSU rating >= 1.25 * 24 V current
  R7 feeder breaker In >= I_inst (and a standard size exists) ; corrected cable Iz*k_temp*k_group >= In
  R8 motors every module with motors has a feeder (In > 0)
  R9 pcable (rev. 2026-11-15) every power instance (DOL, VFD_STO, HEATER, FEEDER_EXT): cross-section in the cores
            text of its power cable (4G<A>...) >= A calculated by rule power_cable (Ib -> Ip -> Iz >= Ip/(k_temp*k_group))
            and a standard breaker / cable size exists
  R10 sfout (rev. 2026-11-15) a kit with F-DI safety inputs must have F-DO safety function outputs (error) ;
            a module with F-DI but no F-DO gives a WARNING: its safety function output must sit in another module
            (M18 zone outputs ZONE_OUT) - confirm it in the zone matrix (item 7)

Usage:
  python tools/fmse/library_check.py                       (= --example: all 22 modules + the library kit)
  python tools/fmse/library_check.py --modules M01,M01,M04 (an own kit)
  python tools/fmse/library_check.py --examples my_library.json --csv findings.csv
  python tools/fmse/library_check.py --json
  python tools/fmse/library_check.py --selftest             (also tests deliberately broken library copies)

Exit code 0 = no findings, 1 = findings (warnings do not change the exit code). All values are EXAMPLES; passing these checks does not replace the
verification and sign-off by a qualified electrical / safety engineer (IEC 60204-1, ISO 13849-2, current standards).
"""

import argparse
import json

from fmse_common import SelfTest, fmt_table, run_main, write_csv
import circuit_lib_core as core
from circuit_lib_core import NOTE

SAFE_TYPES = ("FDI", "FDO")


def finding(rule, scope, msg):
    return {"rule": rule, "scope": scope, "message": msg}


def check_patterns(L):
    """R4 / R5 on the pattern definitions (independent of the modules)."""
    out = []
    for pname, sigs in core.SAFETY_SIGNALS.items():
        if pname not in L["patterns"]:
            continue
        io = {e[0]: e[1] for e in L["patterns"][pname]["io"]}
        for s in sigs:
            if s not in io:
                out.append(finding("R4 safety", f"pattern {pname}", f"safety signal '{s}' is missing"))
            elif io[s] not in SAFE_TYPES:
                out.append(finding("R4 safety", f"pattern {pname}",
                                   f"safety signal '{s}' is {io[s]} - must be F-DI / F-DO"))
        for a, b in core.TWO_CHANNEL.get(pname, []):
            have = [x for x in (a, b) if x in io]
            if len(have) < 2:
                miss = [x for x in (a, b) if x not in io]
                out.append(finding("R5 pairs", f"pattern {pname}", f"two-channel input {a}/{b}: {miss} missing"))
            elif io[a] != "FDI" or io[b] != "FDI":
                out.append(finding("R5 pairs", f"pattern {pname}", f"two-channel input {a}/{b} must be F-DI on both "
                                   f"channels (is {io[a]}/{io[b]})"))
    for pname, P in L["patterns"].items():                 # generic pair rule for every pattern
        fdi = [e[0] for e in P["io"] if e[1] == "FDI"]
        for s in fdi:
            if s.endswith("2") and s[:-1] not in fdi and s[:-1] + "1" not in fdi:
                out.append(finding("R5 pairs", f"pattern {pname}", f"F-DI '{s}' has no first channel"))
            if s.endswith("1") and s[:-1] + "2" not in fdi:
                out.append(finding("R5 pairs", f"pattern {pname}", f"F-DI '{s}' has no second channel"))
    return out


def check_module(m):
    """R1 (length, unique in the module), R2, R3, R6, R7, R8 on one expanded module."""
    out, sc = [], f"{m['code']} {m['unit']}"
    seen = set()
    for e in m["io"]:
        if len(e["tag"]) > core.TAG_MAX:
            out.append(finding("R1 tag", sc, f"tag '{e['tag']}' has {len(e['tag'])} characters (> {core.TAG_MAX})"))
        if e["tag"] in seen:
            out.append(finding("R1 tag", sc, f"tag '{e['tag']}' is used twice"))
        seen.add(e["tag"])
    for key, what in (("devices", "designation"), ("cables", "cable")):
        names = [x[what] for x in m[key]]
        for n in sorted({x for x in names if names.count(x) > 1}):
            out.append(finding("R2 desig", sc, f"{what} '{n}' is used {names.count(n)} times"))
    for t, used in m["used"].items():
        if used and m["spare"][t] < 0.2 * used - 1e-9:
            out.append(finding("R3 spare", sc, f"{t}: spare {m['spare'][t]} < 20 % of used {used} "
                               f"({m['cards'][t]} cards x {m['channels'][t]})"))
    if m["i24"] > 0 and m["psu"] < core.PSU_RESERVE * m["i24"] - 1e-9:
        out.append(finding("R6 psu", sc, f"PSU {m['psu']:g} A < 1.25 x {m['i24']:.3f} A = {1.25 * m['i24']:.3f} A"))
    f = m["feeder"]
    if f["In"]:
        if not f["breaker_ok"] or f["In"] < m["I_inst"] - 1e-9:
            out.append(finding("R7 feeder", sc, f"breaker In {f['In']:g} A < I_inst {m['I_inst']:.2f} A"))
        if not f["cable_ok"] or f["Iz_corr"] < f["In"] - 1e-9:
            out.append(finding("R7 feeder", sc, f"cable {f['A']:g} mm2: Iz*k = {f['Iz_corr']:.2f} A < In {f['In']:g} A"))
    if m["motors"] and not f["In"]:
        out.append(finding("R8 motors", sc, f"{len(m['motors'])} motor(s) but no feeder"))
    for x in m.get("power_cables", []):
        name = f"{x['group']} ({x['pattern']}) {x['cable'] or 'no cable'}"
        if not x["ok"]:
            out.append(finding("R9 pcable", sc, f"{name}: no standard breaker / cable size for Ib {x['Ib']:.2f} A"))
        if x["A_cable"] is None:
            out.append(finding("R9 pcable", sc, f"{name}: cores text '{x['cores']}' has no cross-section, "
                               f"needs >= {x['A']:g} mm2 (Ib {x['Ib']:.2f} A, Ip {x['Ip']:g} A)"))
        elif x["A_cable"] < x["A"] - 1e-9:
            out.append(finding("R9 pcable", sc, f"{name}: cable {x['cores']} = {x['A_cable']:g} mm2 < calculated "
                               f"{x['A']:g} mm2 (Ib {x['Ib']:.2f} A, Ip {x['Ip']:g} A, Iz req {x['Iz_req']:.2f} A)"))
    return out


def warn_module(m):
    """R10 warning: F-DI safety inputs but no F-DO safety function output in this module."""
    if m["used"].get("FDI", 0) and not m["used"].get("FDO", 0):
        return [finding("R10 sfout", f"{m['code']} {m['unit']}",
                        f"WARNING: {m['used']['FDI']} F-DI safety input(s) but no F-DO in the module - the safety "
                        f"function output must be in another module (M18 zone outputs); confirm in the zone matrix")]
    return []


def check_kit(K):
    """R1 uniqueness across the whole kit + every module."""
    out = []
    for m in K["modules"]:
        out += check_module(m)
    tags = {}
    for k, m in enumerate(K["modules"]):
        for e in m["io"]:
            tags.setdefault(e["tag"], {})[k] = f"{m['code']} {m['unit']}"
    for tag, where in tags.items():
        if len(where) > 1:
            out.append(finding("R1 tag", f"kit {K['name']}", f"tag '{tag}' appears in {list(where.values())}"))
    U = K["totals"]["used"]
    if U.get("FDI", 0) and not U.get("FDO", 0):
        out.append(finding("R10 sfout", f"kit {K['name']}", f"{U['FDI']} F-DI safety input(s) but no F-DO safety "
                           f"function output in the whole kit (add M18 with ZONE_OUT zones or F-DO circuits)"))
    return out


def run_warnings(L, K):
    """R10 warnings for every library module and every kit module (unique by scope)."""
    W, seen = [], set()
    for m in [core.expand_module(L, c) for c in L["modules"]] + K["modules"]:
        for w in warn_module(m):
            if w["scope"] not in seen:
                seen.add(w["scope"])
                W.append(w)
    return W


def run_checks(L, codes=None):
    """Pattern checks + every module of the library + the kit (library kit or `codes`)."""
    F = check_patterns(L)
    for c in L["modules"]:
        F += check_module(core.expand_module(L, c))
    K = core.expand_kit(L, codes) if codes else core.library_kit(L)
    F += check_kit(K)
    uniq, seen = [], set()
    for f in F:                                   # a module in the kit repeats its own module findings once only
        key = (f["rule"], f["message"])
        if key not in seen:
            seen.add(key)
            uniq.append(f)
    return uniq, K


def stats(L, K):
    mods = [core.expand_module(L, c) for c in L["modules"]]
    return {"patterns": len(L["patterns"]), "modules": len(mods), "kit_instances": len(K["modules"]),
            "tags": sum(len(m["io"]) for m in mods), "kit_tags": K["totals"]["io"],
            "max_tag": max(m["max_tag"] for m in mods),
            "min_spare_pct": min((m["spare"][t] / m["used"][t] * 100 for m in mods for t in m["used"]
                                  if m["used"][t]), default=0),
            "min_psu_reserve_pct": min((m["psu"] / m["i24"] * 100 - 100 for m in mods if m["i24"] > 0), default=0)}


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("library_check")
    L = core.load_library(path)
    F, K = run_checks(L)
    t.equal("library + kit: no findings", F, [])
    st = stats(L, K)
    t.equal("longest tag in the library 41 characters (WELD01) <= 48", st["max_tag"], 41)
    t.true("smallest IO spare in the library >= 20 %", st["min_spare_pct"] >= 20, f"{st['min_spare_pct']:.1f} %")
    t.true("smallest PSU reserve >= 25 %", st["min_psu_reserve_pct"] >= 25 - 1e-9, f"{st['min_psu_reserve_pct']:.1f} %")
    t.equal("kit: 210 tags checked for uniqueness", st["kit_tags"], 210)
    W = run_warnings(L, K)
    wmods = sorted({w["scope"].split()[0] for w in W})
    t.equal("R10 warnings (F-DI, no F-DO in the module): M06 M07 M10 M12 M13 M14 - M18 no longer (4 ZONE_OUT)",
            wmods, ["M06", "M07", "M10", "M12", "M13", "M14"])
    m18 = core.expand_module(L, "M18")
    t.equal("M18 SAFE01: FDI 10, FDO 4 -> no R10 warning", (m18["used"]["FDI"], m18["used"]["FDO"], warn_module(m18)),
            (10, 4, []))
    npc = sum(len(core.expand_module(L, c)["power_cables"]) for c in L["modules"])
    t.equal("R9: 29 power cable instances in the 22 modules, all sized >= calculated A", npc, 29)

    def rules(Lb, codes=None):
        return sorted({f["rule"] for f in run_checks(Lb, codes)[0]})

    def msgs(Lb, codes=None):
        return [f["message"] for f in run_checks(Lb, codes)[0]]

    B = core.broken_copy(L)                                   # R1: too long group name
    B["modules"]["M03"]["instances"][8][1] = "TravelLimitForwardOverrun"
    t.equal("broken: long group name -> R1 tag (length)", rules(B), ["R1 tag"])
    t.true("broken: the message names the 50-character tag (22 + 25 + 3)",
           any("TravelLimitForwardOverrun.On' has 50 characters (> 48)" in s for s in msgs(B)))
    B = core.broken_copy(L)                                   # R1: duplicate tag in a module
    B["modules"]["M04"]["instances"].append(["SENSOR", "PalPresent", {}])
    t.equal("broken: second SENSOR 'PalPresent' in M04 -> R1 tag (twice)", rules(B), ["R1 tag"])
    B = core.broken_copy(L)                                   # R1: kit uniqueness (two module types, same unit code)
    B["modules"]["M23"] = core.broken_copy(L["modules"]["M04"])
    B["unit_codes"]["M23"] = "LS"
    kit_f = [f for f in run_checks(B, ["M04", "M23"])[0] if "appears in" in f["message"]]
    t.equal("broken: copy of M04 as M23 with unit code LS -> both LS01 -> 20 kit tag findings", len(kit_f), 20)
    B = core.broken_copy(L)                                   # R3: no reserve
    B["constants"]["reserve"] = 0.0
    r3 = [(f["scope"], f["message"]) for f in run_checks(B)[0] if f["rule"] == "R3 spare"]
    t.true("broken: reserve 0 -> R3 spare, e.g. M13 FDI 8 used on 1 card of 8 -> spare 0",
           ("M13 ST01", "FDI: spare 0 < 20 % of used 8 (1 cards x 8)") in r3, str(r3[:4]))
    B = core.broken_copy(L)                                   # R4: e-stop on a standard DI
    B["patterns"]["ESTOP"]["io"][0][1] = "DI"
    t.true("broken: ESTOP Ok on DI -> R4 safety", "R4 safety" in rules(B))
    B = core.broken_copy(L)                                   # R4: STO on a standard DO
    B["patterns"]["VFD_STO"]["io"][0][1] = "DO"
    t.true("broken: VFD STO on DO -> R4 safety", any("'STO' is DO" in s for s in msgs(B)))
    B = core.broken_copy(L)                                   # R5: second channel missing
    B["patterns"]["LC"]["io"] = [e for e in B["patterns"]["LC"]["io"] if e[0] != "Ossd2"]
    t.true("broken: LC without Ossd2 -> R4 (missing) + R5 (pair, and Ossd1 without second channel)",
           {"R4 safety", "R5 pairs"} <= set(rules(B)) and any("'Ossd1' has no second channel" in s for s in msgs(B)))
    B = core.broken_copy(L)                                   # R5: generic rule on a non-safety pattern
    B["patterns"]["SENSOR"]["io"].append(["Ch2", "FDI", "second channel without first"])
    t.true("broken: SENSOR with F-DI 'Ch2' only -> R5 generic pair rule",
           any("'Ch2' has no first channel" in s for s in msgs(B)))
    B = core.broken_copy(L)                                   # R6: PSU too small
    B["constants"]["psu_sizes"] = [2.5]
    t.true("broken: only 2.5 A PSUs -> R6 psu for M03 (3.02 A x 1.25 = 3.775 A)",
           any("PSU 2.5 A < 1.25 x 3.020 A" in s for s in msgs(B)))
    B = core.broken_copy(L)                                   # R7: breaker list too short
    B["constants"]["breaker_ratings"] = [6, 10, 16, 25, 40]
    t.true("broken: breakers only up to 40 A -> R7 for MC01 (64.63 A)",
           any("breaker In 40 A < I_inst 64.63 A" in s for s in msgs(B)))
    B = core.broken_copy(L)                                   # R7: ampacity table too short
    B["constants"]["ampacity_table"] = [[1.5, 22], [2.5, 30], [4, 40]]
    t.true("broken: cables only up to 4 mm2 -> R7 cable finding", any("Iz*k" in s for s in msgs(B)))
    B = core.broken_copy(L)                                   # R8: motors with kW 0 and no other load
    B["modules"]["M07"]["instances"] = [["DOL", "Zone1", {"kW": 0}]]
    B["patterns"]["DOL"]["i24"] = 0.0
    B["patterns"]["DOL"]["io"] = []
    t.true("broken: motor module without any load -> R8 motors", "R8 motors" in rules(B))
    B = core.broken_copy(L)                                   # R9: heater without 'pcab' keeps fixed 4G2.5
    del B["patterns"]["HEATER"]["pcab"]
    r9 = [f for f in run_checks(B)[0] if f["rule"] == "R9 pcable"]
    t.true("broken (planted): HEATER without pcab -> R9 M10 Heater 4G2.5 = 2.5 mm2 < calculated 6 mm2",
           len(r9) == 1 and r9[0]["scope"] == "M10 WASH01" and "4G2.5 = 2.5 mm2 < calculated 6 mm2" in r9[0]["message"],
           str(r9))
    B = core.broken_copy(L)                                   # R9: DOL without 'pcab' -> 15 kW pump on 4G1.5
    del B["patterns"]["DOL"]["pcab"]
    r9 = [(f["scope"], f["message"].split(":")[0]) for f in run_checks(B)[0] if f["rule"] == "R9 pcable"]
    t.true("broken (planted): DOL without pcab -> R9 for M10 SprayPump (2.5) and M16 HydPump (6 mm2)",
           ("M10 WASH01", "SprayPump (DOL) WD1") in r9 and ("M16 PRESS01", "HydPump (DOL) WD1") in r9, str(r9))
    B = core.broken_copy(L)                                   # R10: old M18 (no ZONE_OUT) alone as a kit
    B["modules"]["M18"]["instances"] = [i for i in B["modules"]["M18"]["instances"] if i[0] != "ZONE_OUT"]
    F10, K10 = run_checks(B, ["M18"])
    t.true("broken (planted): M18 without ZONE_OUT as a kit -> R10 kit error (6 F-DI, no F-DO) + module warning",
           any(f["rule"] == "R10 sfout" and "6 F-DI" in f["message"] for f in F10) and
           any(w["scope"] == "M18 SAFE01" for w in run_warnings(B, K10)), str(F10))
    F10 = run_checks(L, ["M06", "M07"])[0]
    t.equal("broken (planted): kit M06,M07 (e-stops only, no F-DO) -> exactly one R10 finding",
            [f["rule"] for f in F10], ["R10 sfout"])
    t.equal("library kit with M18 zones: no R10 finding", [f for f in run_checks(L)[0] if f["rule"] == "R10 sfout"], [])
    B = core.broken_copy(L)                                   # R2: duplicate designation (hand-made duplicate)
    m = core.expand_module(B, "M03")
    m["devices"].append(dict(m["devices"][0]))
    t.true("broken: duplicated device -> R2 desig", any(f["rule"] == "R2 desig" for f in check_module(m)))
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(core.ITEM8_EXAMPLES), help="library JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="check the library + its kit (also the default)")
    ap.add_argument("--modules", help="own kit: comma list of module codes")
    ap.add_argument("--csv", help="write the findings as CSV")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    L = core.load_library(a.examples)
    codes = core.module_codes(L, a.modules) if a.modules else None
    F, K = run_checks(L, codes)
    W = run_warnings(L, K)
    st = stats(L, K)
    if a.json:
        print(json.dumps({"findings": F, "warnings": W, "stats": st, "note": NOTE}, indent=1, ensure_ascii=False))
        return 0 if not F else 1
    print(f"LIBRARY CHECK  {st['patterns']} patterns, {st['modules']} modules ({st['tags']} tags), kit "
          f"'{K['name']}' with {st['kit_instances']} module instances ({st['kit_tags']} tags)")
    print(f"  longest tag {st['max_tag']} characters (max {core.TAG_MAX}), smallest IO spare "
          f"{st['min_spare_pct']:.0f} % (min 20 %), smallest PSU reserve {st['min_psu_reserve_pct']:.0f} % (min 25 %)")
    print("  rules: R1 tags, R2 designations, R3 IO spare, R4 safety signals F-DI/F-DO, R5 two-channel pairs, "
          "R6 PSU reserve, R7 feeder breaker + cable, R8 feeder for motors, R9 power cable size, "
          "R10 safety inputs need safety outputs")
    print()
    if F:
        print(fmt_table(["rule", "scope", "finding"], [[f["rule"], f["scope"], f["message"]] for f in F], "lll"))
        print(f"\n{len(F)} finding(s).")
    else:
        print("No findings: every rule R1-R10 is met.")
    if W:
        print(f"\n{len(W)} warning(s) (R10, review - not an error):")
        print(fmt_table(["rule", "scope", "warning"], [[w["rule"], w["scope"], w["message"]] for w in W], "lll"))
    if a.csv:
        print(f"CSV written: {write_csv(a.csv, ['rule', 'scope', 'finding'], [[f['rule'], f['scope'], f['message']] for f in F])}")
    print()
    print(NOTE)
    return 0 if not F else 1


if __name__ == "__main__":
    run_main(main)
