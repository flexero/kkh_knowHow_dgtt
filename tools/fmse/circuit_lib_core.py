"""Shared core of the item-8 tools (module library: complete circuits per module).

Python 3 standard library only, offline. Not a CLI. Used by circuit_library.py, module_power.py,
circuit_svg.py and library_check.py so that there is ONE implementation of the rules in
examples/item8_examples.json (key "_rules"):

  expand      walk the instances of a module in list order; each instance adds the pattern's io, dev and cab
              entries in pattern order. unit = UNIT code + '01' (in a kit: counts up per module code)
  tag         'PLT1.MACH.FMS1.' + unit + '.' + group + '.' + signal   (max 48 characters)
  designation '=FMS1.' + unit + '-' + class + running number per class in the module ; cables 'WD' + n
  io cards    cards = 0 if used = 0 else ceil(used*(1 + 0.2)/channels) ; spare = cards*channels - used ;
              address of the k-th entry of a type = TYPE + (k // ch + 1) + '.' + (k % ch, 2 digits)
  station     i24 = 0.3 + 0.05*cards ; loss = 4 + 1*cards W ; BOM bus interface + cards
  terminals   -XD2: io entries + pattern 'tx' extras, numbered 1..n (io first, then the extras of the instance)
  motor       In = kW*1000/(sqrt(3)*400*eta*cos) (eta 0.88, cos 0.82) ; DOL contactor = smallest AC-3 >= In ;
              VFD size = smallest vfd_kw >= kW ; VFD loss = 3 % of kW
  power       demand: P = sum kW*ku, Q = sum P_i*tan(acos cos_i), S = sqrt(P^2+Q^2), I = S*1000/(sqrt(3)*400)
              installed (ku = 1): I_inst ; feeder In = smallest breaker >= I_inst ;
              cable = smallest table size with Iz >= In/(k_temp*k_group) ; S_inst = 0 -> no feeder
  dc24        i24 = sum pattern i24 + station ; PSU = smallest size >= 1.25*i24 (0 if i24 = 0)
  loss        pattern losses + station + PSU*24*(1/0.92 - 1)
  power cable (rev. 2026-11-15) per instance of a pattern with 'pcab' (DOL, VFD_STO, HEATER, FEEDER_EXT):
              Ib = motor In (DOL / VFD_STO) or kW*1000/(sqrt(3)*400*cos) (HEATER, FEEDER_EXT) ;
              Ip = Ib round 2 (MPCB / inverter overload setting) or smallest breaker >= Ib (HEATER, FEEDER_EXT) ;
              A = smallest table size with Iz >= Ip/(k_temp*k_group) ; cores = prefix + A + suffix (e.g. 4G6)
  zone out    (rev. 2026-11-15) pattern ZONE_OUT = 1 F-DO zone release + 1 F-DI EDM feedback ; M18 has Zone1..4

All values are EXAMPLES. Real circuits are designed and signed off by qualified electrical / safety engineers
to IEC 60204-1 and the current standards.
"""

import copy
import math
import re
from pathlib import Path

from fmse_common import InputError, load_json

HERE = Path(__file__).resolve().parent
ITEM8_EXAMPLES = HERE / "examples" / "item8_examples.json"
NOTE = ("NOTE: all values are EXAMPLES for teaching. Real circuits are designed, checked and signed off by qualified "
        "electrical / safety engineers to IEC 60204-1 (and IEC 60364, IEC 61439, ISO 13849) in the current editions, "
        "with the manufacturers' data.")
IO_TYPES = ["DI", "DO", "AI", "AO", "FDI", "FDO"]
U_LINE = 400.0
ETA_DEF, COS_DEF, KU_MOTOR = 0.88, 0.82, 0.7
KU_HEATER, COS_HEATER = 0.8, 1.0
KU_CTRL, COS_CTRL, PSU_EFF = 0.6, 0.95, 0.9
PSU_LOSS_EFF = 0.92
STATION_I0, STATION_I_CARD, STATION_W0, STATION_W_CARD = 0.3, 0.05, 4.0, 1.0
PSU_RESERVE = 1.25
TAG_MAX = 48
# devices drawn inside the control cabinet (the others are field devices)
CABINET_CLASSES = {"FC", "QA", "TA", "TB", "XD"}
POWER_KINDS = ("motor", "vfd", "heater", "load")
CABINET_KF_PATTERNS = {"SAFETY_PLC", "IPC", "SWITCH", "FIREWALL", "HANDSHAKE_HW", "COUPLING"}
# safety-related patterns: their safety signals (must be F-DI / F-DO) and two-channel input pairs
SAFETY_SIGNALS = {
    "ESTOP": ["Ok", "Ok2"],
    "ENABLE": ["Ok", "Ok2"],
    "MODE_SWITCH": ["Auto", "Maint"],
    "DOOR_LOCK": ["Closed", "Closed2", "Locked", "Locked2", "LockCmd"],
    "DOOR_2CH": ["Closed", "Closed2"],
    "LC": ["Ossd1", "Ossd2"],
    "SCANNER": ["Ossd1", "Ossd2"],
    "TWOHAND": ["Left", "Left2", "Right", "Right2"],
    "SAFE_VALVE": ["ValveA", "ValveB", "FbA", "FbB"],
    "COUPLING": ["EstopIn", "EstopIn2", "ZoneFree", "ZoneFree2", "EstopOut", "EnableOut"],
    "CONT_PAIR_EDM": ["Enable", "EDM"],
    "VFD_STO": ["STO"],
    "ZONE_OUT": ["Release", "Fb"],
}
TWO_CHANNEL = {
    "ESTOP": [("Ok", "Ok2")],
    "ENABLE": [("Ok", "Ok2")],
    "DOOR_LOCK": [("Closed", "Closed2"), ("Locked", "Locked2")],
    "DOOR_2CH": [("Closed", "Closed2")],
    "LC": [("Ossd1", "Ossd2")],
    "SCANNER": [("Ossd1", "Ossd2")],
    "TWOHAND": [("Left", "Left2"), ("Right", "Right2")],
    "SAFE_VALVE": [("FbA", "FbB")],
    "COUPLING": [("EstopIn", "EstopIn2"), ("ZoneFree", "ZoneFree2")],
}


# ----------------------------------------------------------------------------- loading
def load_library(path=None):
    """Read item8_examples.json (or a project copy) and check the structure."""
    L = load_json(path or ITEM8_EXAMPLES)
    check_library(L)
    return L


def check_library(L):
    for k in ("constants", "unit_codes", "patterns", "modules"):
        if k not in L:
            raise InputError(f"library: section '{k}' is missing")
    C = L["constants"]
    for k in ("site", "area", "cell", "reserve", "channels", "contactor_ac3", "vfd_kw", "breaker_ratings",
              "psu_sizes", "ampacity_table", "k_temp", "k_group"):
        if k not in C:
            raise InputError(f"library constants: '{k}' is missing")
    for name, p in L["patterns"].items():
        for k in ("io", "dev", "cab"):
            if k not in p:
                raise InputError(f"pattern {name}: '{k}' is missing")
        for e in p["io"]:
            if len(e) != 3 or e[1] not in C["channels"]:
                raise InputError(f"pattern {name}: io entry {e!r} must be [signal, type, description] with a "
                                 f"type of {', '.join(C['channels'])}")
    for code, m in L["modules"].items():
        if code not in L["unit_codes"]:
            raise InputError(f"module {code}: no unit code in 'unit_codes'")
        for inst in m.get("instances", []):
            if len(inst) < 2 or inst[0] not in L["patterns"]:
                raise InputError(f"module {code}: instance {inst!r} uses an unknown pattern")


def module_codes(L, text):
    """'M01,M01,M04' -> ['M01', 'M01', 'M04'] (checked)."""
    codes = [c.strip().upper() for c in str(text).split(",") if c.strip()]
    if not codes:
        raise InputError("module list is empty")
    for c in codes:
        if c not in L["modules"]:
            raise InputError(f"unknown module '{c}'; modules are {', '.join(L['modules'])}")
    return codes


# ----------------------------------------------------------------------------- helpers
def pick(sizes, x):
    """Smallest standard size >= x (float tolerance); None if all are too small."""
    for s in sorted(sizes):
        if s >= x - 1e-9:
            return s
    return None


def tan_phi(cos):
    return math.tan(math.acos(cos))


def fmt_g(x):
    """2.5 -> '2.5', 5.0 -> '5'."""
    return f"{x:g}"


def card_name(typ, ch):
    return f"{typ} {ch} card"


def motor_in(kw, eta=ETA_DEF, cos=COS_DEF):
    return kw * 1000 / (math.sqrt(3) * U_LINE * eta * cos)


def cores_mm2(text):
    """Cross-section of a power-cable cores text: '4G6' -> 6.0, '4G2.5 + shield' -> 2.5, '4G (..)' -> None."""
    m = re.match(r"\s*\d+\s*G\s*(\d+(?:\.\d+)?)", str(text))
    return float(m.group(1)) if m else None


def power_cable_sizing(C, P, par):
    """Rule '_rules.power_cable' for one instance: Ib, Ip, A (or None if the pattern has no power kind).
    Returns also the cab index / text parts of 'pcab' (sized = False if the pattern has no 'pcab')."""
    kind = P.get("power")
    if kind not in POWER_KINDS:
        return None
    kw = float(par.get("kW", 0))
    if kind in ("motor", "vfd"):
        Ib = motor_in(kw, float(par.get("eta", ETA_DEF)), float(par.get("cos", COS_DEF))) if kw > 0 else 0.0
        Ip = round(Ib, 2)
        ip_kind = "MPCB setting" if kind == "motor" else "inverter overload setting"
        ip_ok = True
    else:
        Ib = kw * 1000 / (math.sqrt(3) * U_LINE * float(par.get("cos", 1.0)))
        Ip = pick(C["breaker_ratings"], Ib)
        ip_ok = Ip is not None
        Ip = Ip if ip_ok else max(C["breaker_ratings"])
        ip_kind = "breaker"
    k = C["k_temp"] * C["k_group"]
    iz_req = Ip / k
    row = next((r for r in sorted(C["ampacity_table"]) if r[1] >= iz_req - 1e-9), None)
    a_ok = row is not None
    row = row or max(C["ampacity_table"])
    pc = P.get("pcab")
    return {"kW": kw, "Ib": Ib, "Ip": Ip, "ip_kind": ip_kind, "Iz_req": iz_req, "A": row[0], "Iz": row[1],
            "Iz_corr": row[1] * k, "ok": ip_ok and a_ok, "sized": bool(pc),
            "index": int(pc.get("index", 0)) if pc else 0,
            "text": (pc.get("prefix", "4G") + fmt_g(row[0]) + pc.get("suffix", "")) if pc else None}


def _apparent(loads, installed):
    P = sum(ld["kW"] * (1.0 if installed else ld["ku"]) for ld in loads)
    Q = sum(ld["kW"] * (1.0 if installed else ld["ku"]) * tan_phi(ld["cos"]) for ld in loads)
    S = math.hypot(P, Q)
    return P, Q, S, S * 1000 / (math.sqrt(3) * U_LINE)


# ----------------------------------------------------------------------------- expansion of one module
def expand_module(L, code, unit=None):
    """Expand module `code` with unit name (default UNIT + '01'). Returns a dict with every derived list."""
    if code not in L["modules"]:
        raise InputError(f"unknown module '{code}'; modules are {', '.join(L['modules'])}")
    C = L["constants"]
    unit = unit or (L["unit_codes"][code] + "01")
    prefix = f"{C['site']}.{C['area']}.{C['cell']}.{unit}."
    loc = f"={C['cell']}.{unit}"
    mod = L["modules"][code]
    io, devs, cabs, terms, inst_out, pcables = [], [], [], [], [], []
    k_type = {t: 0 for t in C["channels"]}
    n_class = {}
    i24_p, loss_p = 0.0, 0.0
    motors, loads = [], []
    for ii, inst in enumerate(mod.get("instances", [])):
        pname, group = inst[0], inst[1]
        par = inst[2] if len(inst) > 2 and inst[2] else {}
        P = L["patterns"][pname]
        rec = {"index": ii, "pattern": pname, "group": group, "params": par, "io": [], "dev": [], "cab": []}
        for sig, typ, desc in P["io"]:
            ch = C["channels"][typ]
            k = k_type[typ]
            k_type[typ] += 1
            e = {"tag": prefix + group + "." + sig, "type": typ, "address": f"{typ}{k // ch + 1}.{k % ch:02d}",
                 "card": k // ch + 1, "channel": k % ch, "description": desc, "group": group, "signal": sig,
                 "pattern": pname, "inst": ii}
            io.append(e)
            rec["io"].append(e)
        for cls, desc, bom in P["dev"]:
            n_class[cls] = n_class.get(cls, 0) + 1
            short = f"{cls}{n_class[cls]}"
            cab_side = cls in CABINET_CLASSES or (cls == "KF" and pname in CABINET_KF_PATTERNS)
            d = {"designation": f"{loc}-{short}", "short": short, "class": cls, "description": desc, "bom": bom,
                 "group": group, "pattern": pname, "inst": ii, "location": "cabinet" if cab_side else "field"}
            devs.append(d)
            rec["dev"].append(d)
        pz = power_cable_sizing(C, P, par)
        for ci, (desc, cores, length) in enumerate(P["cab"]):
            ln = float(par.get("len", length))
            is_pc = pz is not None and ci == pz["index"]
            if is_pc and pz["sized"]:
                cores = pz["text"]
            c = {"cable": f"WD{len(cabs) + 1}", "description": desc, "cores": cores, "length": ln, "group": group,
                 "pattern": pname, "inst": ii, "power_cable": is_pc}
            cabs.append(c)
            rec["cab"].append(c)
            if is_pc:
                pcables.append({"group": group, "pattern": pname, "inst": ii, "cable": c["cable"], "cores": cores,
                                "length": ln, "A_cable": cores_mm2(cores), **pz})
        if pz is not None and pz["index"] >= len(P["cab"]):
            pcables.append({"group": group, "pattern": pname, "inst": ii, "cable": "", "cores": "", "length": 0,
                            "A_cable": None, **pz})
        rec["pcab"] = pz
        for e in rec["io"]:
            terms.append({"terminal": len(terms) + 1, "strip": "-XD2", "kind": "io", "tag": e["tag"],
                          "address": e["address"], "group": group, "text": e["description"]})
        for x in range(int(P.get("tx", 0))):
            pot = "+24V" if x % 2 == 0 else "0V"
            terms.append({"terminal": len(terms) + 1, "strip": "-XD2", "kind": pot, "tag": "", "address": "",
                          "group": group, "text": f"{pot} supply for {group}"})
        i24_p += float(P.get("i24", 0))
        kind = P.get("power")
        if kind in ("motor", "vfd"):
            kw = float(par.get("kW", 0))
            eta = float(par.get("eta", ETA_DEF))
            cos = float(par.get("cos", COS_DEF))
            In = motor_in(kw, eta, cos) if kw > 0 else 0.0
            m = {"group": group, "pattern": pname, "kW": kw, "eta": eta, "cos": cos, "In": In}
            if kind == "motor":
                m["contactor"] = pick(C["contactor_ac3"], In)
                m["mpcb_setting"] = round(In, 2)
                m["size"] = m["contactor"]
            else:
                m["inverter_kW"] = pick(C["vfd_kw"], kw)
                m["size"] = m["inverter_kW"]
            motors.append(m)
            loads.append({"name": group, "kind": pname, "kW": kw, "ku": float(par.get("ku", KU_MOTOR)), "cos": cos})
        elif kind == "load":
            loads.append({"name": group, "kind": pname, "kW": float(par.get("kW", 0)),
                          "ku": float(par.get("ku", 1.0)), "cos": float(par.get("cos", 1.0))})
        elif kind == "heater":
            loads.append({"name": group, "kind": pname, "kW": float(par.get("kW", 0)),
                          "ku": float(par.get("ku", KU_HEATER)), "cos": float(par.get("cos", COS_HEATER))})
        lp = P.get("loss", 0)
        if isinstance(lp, str) and lp.endswith("%"):
            loss_p += float(lp[:-1]) / 100 * float(par.get("kW", 0)) * 1000
        else:
            loss_p += float(lp)
        inst_out.append(rec)

    used = {t: k_type[t] for t in C["channels"]}
    cards, spare = {}, {}
    for t, ch in C["channels"].items():
        cards[t] = 0 if used[t] == 0 else math.ceil(used[t] * (1 + C["reserve"]) / ch - 1e-9)
        spare[t] = cards[t] * ch - used[t]
    n_cards = sum(cards.values())
    station = bool(io)
    st_i24 = STATION_I0 + STATION_I_CARD * n_cards if station else 0.0
    st_loss = STATION_W0 + STATION_W_CARD * n_cards if station else 0.0
    i24 = i24_p + st_i24
    psu_need = i24 * PSU_RESERVE
    psu = 0 if i24 <= 0 else (pick(C["psu_sizes"], psu_need) or max(C["psu_sizes"]))
    psu_loss = psu * 24 * (1 / PSU_LOSS_EFF - 1) if psu else 0.0
    loss = loss_p + st_loss + psu_loss
    if psu:
        loads.append({"name": "24 V control power", "kind": "CONTROL", "kW": psu * 24 / PSU_EFF / 1000,
                      "ku": KU_CTRL, "cos": COS_CTRL})
    P, Q, S, I = _apparent(loads, False)
    P_i, Q_i, S_i, I_i = _apparent(loads, True)
    k = C["k_temp"] * C["k_group"]
    if S_i <= 0:
        feeder = {"In": 0, "A": 0, "Iz": 0, "Iz_corr": 0, "Iz_req": 0, "breaker_ok": True, "cable_ok": True}
    else:
        In = pick(C["breaker_ratings"], I_i)
        breaker_ok = In is not None
        In = In if breaker_ok else max(C["breaker_ratings"])
        iz_req = In / k
        row = next((r for r in sorted(C["ampacity_table"]) if r[1] >= iz_req - 1e-9), None)
        cable_ok = row is not None
        row = row or max(C["ampacity_table"])
        feeder = {"In": In, "A": row[0], "Iz": row[1], "Iz_corr": row[1] * k, "Iz_req": iz_req,
                  "breaker_ok": breaker_ok, "cable_ok": cable_ok}
    n_fc = sum(1 for d in devs if d["class"] == "FC")
    feeder["designation"] = f"{loc}-FC{n_fc + 1}" if feeder["In"] else ""

    bom = {}
    for d in devs:
        bom[d["bom"]] = bom.get(d["bom"], 0) + 1
    if station:
        bom["IO station bus interface"] = bom.get("IO station bus interface", 0) + 1
        for t, n in cards.items():
            if n:
                nm = card_name(t, C["channels"][t])
                bom[nm] = bom.get(nm, 0) + n
    if psu:
        nm = f"24 V power supply {fmt_g(psu)} A"
        bom[nm] = bom.get(nm, 0) + 1
    if terms:
        bom["Control terminal"] = bom.get("Control terminal", 0) + len(terms)
    bom = dict(sorted(bom.items()))

    cores = {}
    for c in cabs:
        cores[c["cores"]] = cores.get(c["cores"], 0) + c["length"]
    return {"code": code, "unit": unit, "title": mod.get("title", ""), "location": loc, "instances": inst_out,
            "io": io, "devices": devs, "cables": cabs, "terminals": terms, "used": used, "cards": cards,
            "spare": spare, "channels": dict(C["channels"]), "n_cards": n_cards, "station": station,
            "station_i24": st_i24, "station_loss": st_loss, "i24_patterns": i24_p, "i24": i24, "psu_need": psu_need,
            "psu": psu, "psu_loss": psu_loss, "loss_patterns": loss_p, "loss": loss, "motors": motors,
            "loads": loads, "P": P, "Q": Q, "S": S, "I": I, "P_inst": P_i, "Q_inst": Q_i, "S_inst": S_i,
            "I_inst": I_i, "feeder": feeder, "k_cable": k, "bom": bom, "cable_metres": sum(c["length"] for c in cabs),
            "metres_by_cores": cores, "power_cables": pcables, "max_tag": max((len(e["tag"]) for e in io), default=0)}


# ----------------------------------------------------------------------------- kits
def kit_units(L, codes):
    """[(code, unit), ...]: the unit number counts up per module code (MC01, MC02, MC03 ...)."""
    seen, out = {}, []
    for c in codes:
        seen[c] = seen.get(c, 0) + 1
        out.append((c, f"{L['unit_codes'][c]}{seen[c]:02d}"))
    return out


def expand_kit(L, codes, name="custom kit"):
    """Expand every module instance of a kit and sum the totals (rule '_rules.kit')."""
    mods = [expand_module(L, c, u) for c, u in kit_units(L, codes)]
    T = {"io": sum(len(m["io"]) for m in mods),
         "cards": {t: sum(m["cards"][t] for m in mods) for t in L["constants"]["channels"]},
         "used": {t: sum(m["used"][t] for m in mods) for t in L["constants"]["channels"]},
         "terms": sum(len(m["terminals"]) for m in mods), "cables": sum(len(m["cables"]) for m in mods),
         "metres": sum(m["cable_metres"] for m in mods), "devices": sum(len(m["devices"]) for m in mods),
         # sums of the module values AS PRINTED (P, S 3 decimals, I 2, loss 1) - the same numbers as the guide / web
         "P": round(sum(round(m["P"], 3) for m in mods), 3), "S": round(sum(round(m["S"], 3) for m in mods), 3),
         "I": round(sum(round(m["I"], 2) for m in mods), 2),
         "P_inst": round(sum(round(m["P_inst"], 3) for m in mods), 3), "psu": sum(m["psu"] for m in mods),
         "i24": round(sum(round(m["i24"], 3) for m in mods), 3),
         "loss": round(sum(round(m["loss"], 1) for m in mods), 1)}
    bom = {}
    for m in mods:
        for k, v in m["bom"].items():
            bom[k] = bom.get(k, 0) + v
    T["bom"] = dict(sorted(bom.items()))
    cores = {}
    for m in mods:
        for k, v in m["metres_by_cores"].items():
            cores[k] = cores.get(k, 0) + v
    T["metres_by_cores"] = dict(sorted(cores.items()))
    T["power_cables"] = sum(len(m["power_cables"]) for m in mods)
    return {"name": name, "codes": list(codes), "modules": mods, "totals": T}


def library_kit(L):
    K = L.get("kit") or {}
    if not K.get("modules"):
        raise InputError("library: section 'kit' with 'modules' is missing")
    return expand_kit(L, K["modules"], K.get("name", "kit"))


def broken_copy(L):
    """Deep copy of a library for the self-tests (mutate it to make deliberately broken cases)."""
    return copy.deepcopy(L)


# ----------------------------------------------------------------------------- reference values for the self-tests
# Values of an independent implementation of "_rules" (revision 2026-11-15: power_cable + ZONE_OUT in M18) (rounded: P/S 3, I 2, i24 3, loss 1, motor In 3 decimals).
REF_MODULES = {
    'M01': {'unit': 'MC01', 'io': 8, 'io_t': {'DI': 2, 'FDI': 4, 'FDO': 2}, 'cards': {'DI': 1, 'FDI': 1, 'FDO': 1}, 'term': 12, 'cab': 4, 'm': 60, 'dev': 4, 'i24': 0.58, 'psu': 2.5, 'P': 22.84, 'S': 26.864, 'I': 38.78, 'Iinst': 64.63, 'In': 80, 'A': 35, 'loss': 19.2, 'maxtag': 36, 'motors': []},
    'M02': {'unit': 'APC01', 'io': 10, 'io_t': {'DI': 6, 'DO': 3, 'AI': 1}, 'cards': {'DI': 1, 'DO': 1, 'AI': 1}, 'term': 23, 'cab': 9, 'm': 60, 'dev': 9, 'i24': 0.795, 'psu': 2.5, 'P': 0.04, 'S': 0.042, 'I': 0.06, 'Iinst': 0.1, 'In': 6, 'A': 1.5, 'loss': 17.2, 'maxtag': 37, 'motors': []},
    'M03': {'unit': 'POOL01', 'io': 31, 'io_t': {'DI': 11, 'DO': 4, 'FDI': 11, 'FDO': 5}, 'cards': {'DI': 1, 'DO': 1, 'FDI': 2, 'FDO': 2}, 'term': 42, 'cab': 16, 'm': 149, 'dev': 22, 'i24': 3.02, 'psu': 5, 'P': 14.08, 'S': 17.154, 'I': 24.76, 'Iinst': 35.4, 'In': 40, 'A': 10, 'loss': 631.4, 'maxtag': 37, 'motors': [('Travel', 'VFD_STO', 11, 22.003, 11), ('Hoist', 'VFD_STO', 7.5, 15.002, 7.5), ('Fork', 'VFD_STO', 1.5, 3.0, 1.5)]},
    'M04': {'unit': 'LS01', 'io': 20, 'io_t': {'DI': 8, 'DO': 6, 'AI': 1, 'FDI': 4, 'FDO': 1}, 'cards': {'DI': 1, 'DO': 1, 'AI': 1, 'FDI': 1, 'FDO': 1}, 'term': 35, 'cab': 15, 'm': 128, 'dev': 15, 'i24': 3.535, 'psu': 5, 'P': 0.605, 'S': 0.721, 'I': 1.04, 'Iinst': 1.52, 'In': 6, 'A': 1.5, 'loss': 81.4, 'maxtag': 36, 'motors': [('Rotary', 'VFD_STO', 0.75, 1.5, 0.75)]},
    'M05': {'unit': 'ROB01', 'io': 25, 'io_t': {'DI': 6, 'DO': 4, 'FDI': 12, 'FDO': 3}, 'cards': {'DI': 1, 'DO': 1, 'FDI': 2, 'FDO': 1}, 'term': 37, 'cab': 10, 'm': 105, 'dev': 11, 'i24': 1.61, 'psu': 2.5, 'P': 2.54, 'S': 2.82, 'I': 4.07, 'Iinst': 8.12, 'In': 10, 'A': 1.5, 'loss': 31.7, 'maxtag': 40, 'motors': []},
    'M06': {'unit': 'AGVST01', 'io': 19, 'io_t': {'DI': 10, 'DO': 7, 'FDI': 2}, 'cards': {'DI': 1, 'DO': 1, 'FDI': 1}, 'term': 29, 'cab': 6, 'm': 75, 'dev': 8, 'i24': 1.34, 'psu': 2.5, 'P': 0.299, 'S': 0.356, 'I': 0.51, 'Iinst': 0.75, 'In': 6, 'A': 1.5, 'loss': 26.2, 'maxtag': 39, 'motors': [('Transfer', 'DOL', 0.37, 0.74, 9)]},
    'M07': {'unit': 'CONV01', 'io': 23, 'io_t': {'DI': 16, 'DO': 5, 'FDI': 2}, 'cards': {'DI': 2, 'DO': 1, 'FDI': 1}, 'term': 43, 'cab': 16, 'm': 145, 'dev': 22, 'i24': 1.24, 'psu': 2.5, 'P': 1.195, 'S': 1.449, 'I': 2.09, 'Iinst': 3.0, 'In': 6, 'A': 1.5, 'loss': 33.2, 'maxtag': 35, 'motors': [('Zone1', 'DOL', 0.55, 1.1, 9), ('Zone2', 'DOL', 0.55, 1.1, 9), ('Zone3', 'DOL', 0.55, 1.1, 9)]},
    'M08': {'unit': 'ASRS01', 'io': 33, 'io_t': {'DI': 13, 'DO': 4, 'FDI': 11, 'FDO': 5}, 'cards': {'DI': 1, 'DO': 1, 'FDI': 2, 'FDO': 2}, 'term': 48, 'cab': 18, 'm': 169, 'dev': 24, 'i24': 3.08, 'psu': 5, 'P': 19.82, 'S': 24.154, 'I': 34.86, 'Iinst': 49.83, 'In': 50, 'A': 16, 'loss': 877.4, 'maxtag': 37, 'motors': [('Travel', 'VFD_STO', 15, 30.004, 15), ('Hoist', 'VFD_STO', 11, 22.003, 11), ('Fork', 'VFD_STO', 2.2, 4.401, 2.2)]},
    'M09': {'unit': 'TOOL01', 'io': 3, 'io_t': {'DI': 3}, 'cards': {'DI': 1}, 'term': 7, 'cab': 5, 'm': 60, 'dev': 5, 'i24': 0.66, 'psu': 2.5, 'P': 0.54, 'S': 0.568, 'I': 0.82, 'Iinst': 1.62, 'In': 6, 'A': 1.5, 'loss': 18.2, 'maxtag': 40, 'motors': []},
    'M10': {'unit': 'WASH01', 'io': 22, 'io_t': {'DI': 12, 'DO': 5, 'AI': 1, 'FDI': 4}, 'cards': {'DI': 1, 'DO': 1, 'AI': 1, 'FDI': 1}, 'term': 33, 'cab': 14, 'm': 140, 'dev': 22, 'i24': 1.165, 'psu': 2.5, 'P': 22.049, 'S': 22.683, 'I': 32.74, 'Iinst': 43.19, 'In': 50, 'A': 16, 'loss': 38.7, 'maxtag': 39, 'motors': [('SprayPump', 'DOL', 7.5, 15.002, 18), ('RinsePump', 'DOL', 3, 6.001, 9), ('Conveyor', 'DOL', 0.37, 0.74, 9)]},
    'M11': {'unit': 'CMM01', 'io': 3, 'io_t': {'DI': 2, 'AI': 1}, 'cards': {'DI': 1, 'AI': 1}, 'term': 6, 'cab': 4, 'm': 50, 'dev': 4, 'i24': 0.455, 'psu': 2.5, 'P': 3.64, 'S': 4.042, 'I': 5.83, 'Iinst': 9.72, 'In': 10, 'A': 1.5, 'loss': 16.2, 'maxtag': 36, 'motors': []},
    'M12': {'unit': 'MARK01', 'io': 10, 'io_t': {'DI': 6, 'DO': 2, 'FDI': 2}, 'cards': {'DI': 1, 'DO': 1, 'FDI': 1}, 'term': 18, 'cab': 9, 'm': 90, 'dev': 11, 'i24': 0.76, 'psu': 2.5, 'P': 1.165, 'S': 1.3, 'I': 1.88, 'Iinst': 2.91, 'In': 6, 'A': 1.5, 'loss': 24.7, 'maxtag': 39, 'motors': [('Exhaust', 'DOL', 0.75, 1.5, 9)]},
    'M13': {'unit': 'ST01', 'io': 20, 'io_t': {'DI': 9, 'DO': 3, 'FDI': 8}, 'cards': {'DI': 1, 'DO': 1, 'FDI': 2}, 'term': 37, 'cab': 14, 'm': 125, 'dev': 13, 'i24': 1.37, 'psu': 2.5, 'P': 0.79, 'S': 0.832, 'I': 1.2, 'Iinst': 2.38, 'In': 6, 'A': 1.5, 'loss': 26.7, 'maxtag': 38, 'motors': []},
    'M14': {'unit': 'TEST01', 'io': 16, 'io_t': {'DI': 7, 'DO': 6, 'AI': 1, 'FDI': 2}, 'cards': {'DI': 1, 'DO': 1, 'AI': 1, 'FDI': 1}, 'term': 32, 'cab': 14, 'm': 120, 'dev': 14, 'i24': 1.095, 'psu': 2.5, 'P': 0.64, 'S': 0.674, 'I': 0.97, 'Iinst': 1.62, 'In': 6, 'A': 1.5, 'loss': 26.2, 'maxtag': 37, 'motors': []},
    'M15': {'unit': 'WELD01', 'io': 29, 'io_t': {'DI': 12, 'DO': 1, 'FDI': 12, 'FDO': 4}, 'cards': {'DI': 1, 'DO': 1, 'FDI': 2, 'FDO': 2}, 'term': 45, 'cab': 15, 'm': 178, 'dev': 18, 'i24': 2.32, 'psu': 5, 'P': 18.15, 'S': 20.505, 'I': 29.6, 'Iinst': 49.18, 'In': 50, 'A': 16, 'loss': 78.4, 'maxtag': 41, 'motors': [('Turntable', 'VFD_STO', 1.1, 2.2, 1.1), ('Fume', 'DOL', 4, 8.001, 9)]},
    'M16': {'unit': 'PRESS01', 'io': 25, 'io_t': {'DI': 9, 'DO': 3, 'AI': 1, 'FDI': 10, 'FDO': 2}, 'cards': {'DI': 1, 'DO': 1, 'AI': 1, 'FDI': 2, 'FDO': 1}, 'term': 44, 'cab': 15, 'm': 125, 'dev': 15, 'i24': 2.075, 'psu': 5, 'P': 10.58, 'S': 12.886, 'I': 18.6, 'Iinst': 26.6, 'In': 32, 'A': 6, 'loss': 43.9, 'maxtag': 38, 'motors': [('HydPump', 'DOL', 15, 30.004, 32)]},
    'M17': {'unit': 'UTIL01', 'io': 7, 'io_t': {'DI': 4, 'DO': 1, 'AI': 2}, 'cards': {'DI': 1, 'DO': 1, 'AI': 1}, 'term': 13, 'cab': 6, 'm': 70, 'dev': 8, 'i24': 0.66, 'psu': 2.5, 'P': 3.89, 'S': 4.735, 'I': 6.84, 'Iinst': 9.78, 'In': 10, 'A': 1.5, 'loss': 17.2, 'maxtag': 38, 'motors': [('CoolPump', 'DOL', 5.5, 11.001, 12)]},
    'M18': {'unit': 'SAFE01', 'io': 20, 'io_t': {'DI': 1, 'DO': 5, 'FDI': 10, 'FDO': 4}, 'cards': {'DI': 1, 'DO': 1, 'FDI': 2, 'FDO': 2}, 'term': 22, 'cab': 10, 'm': 123, 'dev': 10, 'i24': 1.82, 'psu': 2.5, 'P': 0.04, 'S': 0.042, 'I': 0.06, 'Iinst': 0.1, 'In': 6, 'A': 1.5, 'loss': 37.2, 'maxtag': 35, 'motors': []},
    'M19': {'unit': 'CC01', 'io': 2, 'io_t': {'DI': 2}, 'cards': {'DI': 1}, 'term': 2, 'cab': 1, 'm': 5, 'dev': 3, 'i24': 3.45, 'psu': 5, 'P': 0.08, 'S': 0.084, 'I': 0.12, 'Iinst': 0.2, 'In': 6, 'A': 1.5, 'loss': 73.4, 'maxtag': 33, 'motors': []},
    'M20': {'unit': 'SCADA01', 'io': 0, 'io_t': {}, 'cards': {}, 'term': 0, 'cab': 2, 'm': 15, 'dev': 2, 'i24': 3.7, 'psu': 5, 'P': 0.08, 'S': 0.084, 'I': 0.12, 'Iinst': 0.2, 'In': 6, 'A': 1.5, 'loss': 75.4, 'maxtag': 0, 'motors': []},
    'M21': {'unit': 'MESCON01', 'io': 0, 'io_t': {}, 'cards': {}, 'term': 0, 'cab': 0, 'm': 0, 'dev': 0, 'i24': 0, 'psu': 0, 'P': 0, 'S': 0.0, 'I': 0.0, 'Iinst': 0, 'In': 0, 'A': 0, 'loss': 0, 'maxtag': 0, 'motors': []},
    'M22': {'unit': 'NET01', 'io': 2, 'io_t': {'DI': 2}, 'cards': {'DI': 1}, 'term': 2, 'cab': 0, 'm': 0, 'dev': 4, 'i24': 1.85, 'psu': 2.5, 'P': 0.04, 'S': 0.042, 'I': 0.06, 'Iinst': 0.1, 'In': 6, 'A': 1.5, 'loss': 46.2, 'maxtag': 34, 'motors': []},
}
REF_M03_IO = [
    ('FDO1.00', 'PLT1.MACH.FMS1.POOL01.DriveSup.Enable', 'FDO'),
    ('FDI1.00', 'PLT1.MACH.FMS1.POOL01.DriveSup.EDM', 'FDI'),
    ('FDO1.01', 'PLT1.MACH.FMS1.POOL01.Travel.STO', 'FDO'),
    ('DI1.00', 'PLT1.MACH.FMS1.POOL01.Travel.Ready', 'DI'),
    ('DI1.01', 'PLT1.MACH.FMS1.POOL01.Travel.Fault', 'DI'),
    ('FDO1.02', 'PLT1.MACH.FMS1.POOL01.Hoist.STO', 'FDO'),
    ('DI1.02', 'PLT1.MACH.FMS1.POOL01.Hoist.Ready', 'DI'),
    ('DI1.03', 'PLT1.MACH.FMS1.POOL01.Hoist.Fault', 'DI'),
    ('FDO1.03', 'PLT1.MACH.FMS1.POOL01.Fork.STO', 'FDO'),
    ('DI1.04', 'PLT1.MACH.FMS1.POOL01.Fork.Ready', 'DI'),
    ('DI1.05', 'PLT1.MACH.FMS1.POOL01.Fork.Fault', 'DI'),
    ('FDI1.01', 'PLT1.MACH.FMS1.POOL01.Door.Closed', 'FDI'),
    ('FDI1.02', 'PLT1.MACH.FMS1.POOL01.Door.Closed2', 'FDI'),
    ('FDI1.03', 'PLT1.MACH.FMS1.POOL01.Door.Locked', 'FDI'),
    ('FDI1.04', 'PLT1.MACH.FMS1.POOL01.Door.Locked2', 'FDI'),
    ('FDO2.00', 'PLT1.MACH.FMS1.POOL01.Door.LockCmd', 'FDO'),
    ('DI1.06', 'PLT1.MACH.FMS1.POOL01.Door.Request', 'DI'),
    ('FDI1.05', 'PLT1.MACH.FMS1.POOL01.Estop.Ok', 'FDI'),
    ('FDI1.06', 'PLT1.MACH.FMS1.POOL01.Estop.Ok2', 'FDI'),
    ('FDI1.07', 'PLT1.MACH.FMS1.POOL01.Enable.Ok', 'FDI'),
    ('FDI2.00', 'PLT1.MACH.FMS1.POOL01.Enable.Ok2', 'FDI'),
    ('FDI2.01', 'PLT1.MACH.FMS1.POOL01.Mode.Auto', 'FDI'),
    ('FDI2.02', 'PLT1.MACH.FMS1.POOL01.Mode.Maint', 'FDI'),
    ('DI1.07', 'PLT1.MACH.FMS1.POOL01.TravLimF.On', 'DI'),
    ('DI1.08', 'PLT1.MACH.FMS1.POOL01.TravLimR.On', 'DI'),
    ('DI1.09', 'PLT1.MACH.FMS1.POOL01.PalOnFork.On', 'DI'),
    ('DI1.10', 'PLT1.MACH.FMS1.POOL01.ForkMid.On', 'DI'),
    ('DO1.00', 'PLT1.MACH.FMS1.POOL01.Tower.Red', 'DO'),
    ('DO1.01', 'PLT1.MACH.FMS1.POOL01.Tower.Yellow', 'DO'),
    ('DO1.02', 'PLT1.MACH.FMS1.POOL01.Tower.Green', 'DO'),
    ('DO1.03', 'PLT1.MACH.FMS1.POOL01.Tower.Buzzer', 'DO'),
]
REF_M03_BOM = {'24 V power supply 5 A': 1, 'Bus connection (port on the cell switch)': 1, 'Control terminal': 42, 'DI 16 card': 1, 'DO 16 card': 1, 'Emergency-stop push-button': 1, 'Enabling switch': 1, 'FDI 8 card': 2, 'FDO 4 card': 2, 'Frequency inverter': 3, 'Guard-locking interlock switch': 1, 'IO station bus interface': 1, 'Illuminated push-button': 1, 'Inverter line protection': 3, 'Key mode selector': 1, 'Motor (part of the mechanics)': 3, 'Safety contactor': 2, 'Sensor PNP M12': 4, 'Signal tower': 1}
REF_KIT = {'io': 210, 'cards': {'DI': 17, 'DO': 11, 'AI': 8, 'AO': 0, 'FDI': 12, 'FDO': 9}, 'used': {'DI': 90, 'DO': 45, 'AI': 9, 'AO': 0, 'FDI': 49, 'FDO': 17}, 'terms': 342, 'cables': 137, 'metres': 1333, 'P': 115.213, 'S': 132.682, 'psu': 57.5, 'loss': 1258.6, 'devices': 163}

# rule '_rules.power_cable': (group, pattern, Ib round 2, Ip, A mm2) per pcab instance of every module (independent ref.)
REF_PCABS = {
    'M01': [('Supply', 'FEEDER_EXT', 64.53, 80, 35)],
    'M03': [('Travel', 'VFD_STO', 22.0, 22.0, 4), ('Hoist', 'VFD_STO', 15.0, 15.0, 2.5), ('Fork', 'VFD_STO', 3.0, 3.0, 1.5)],
    'M04': [('Rotary', 'VFD_STO', 1.5, 1.5, 1.5)],
    'M05': [('RobotSup', 'FEEDER_EXT', 8.02, 10, 1.5)],
    'M06': [('Transfer', 'DOL', 0.74, 0.74, 1.5)],
    'M07': [('Zone1', 'DOL', 1.1, 1.1, 1.5), ('Zone2', 'DOL', 1.1, 1.1, 1.5), ('Zone3', 'DOL', 1.1, 1.1, 1.5)],
    'M08': [('Travel', 'VFD_STO', 30.0, 30.0, 6), ('Hoist', 'VFD_STO', 22.0, 22.0, 4), ('Fork', 'VFD_STO', 4.4, 4.4, 1.5)],
    'M09': [('Presetter', 'FEEDER_EXT', 1.52, 6, 1.5)],
    'M10': [('SprayPump', 'DOL', 15.0, 15.0, 2.5), ('RinsePump', 'DOL', 6.0, 6.0, 1.5), ('Heater', 'HEATER', 25.98, 32, 6), ('Conveyor', 'DOL', 0.74, 0.74, 1.5)],
    'M11': [('CmmSup', 'FEEDER_EXT', 9.62, 10, 1.5)],
    'M12': [('Laser', 'FEEDER_EXT', 1.52, 6, 1.5), ('Exhaust', 'DOL', 1.5, 1.5, 1.5)],
    'M13': [('Nutrunner', 'FEEDER_EXT', 2.28, 6, 1.5)],
    'M14': [('Tester', 'FEEDER_EXT', 1.52, 6, 1.5)],
    'M15': [('RobotSup', 'FEEDER_EXT', 8.02, 10, 1.5), ('WeldPwr', 'FEEDER_EXT', 32.08, 40, 10), ('Turntable', 'VFD_STO', 2.2, 2.2, 1.5), ('Fume', 'DOL', 8.0, 8.0, 1.5)],
    'M16': [('HydPump', 'DOL', 30.0, 30.0, 6)],
    'M17': [('CoolPump', 'DOL', 11.0, 11.0, 1.5)],
}
REF_M18_IO = [
    ('FDO1.00', 'PLT1.MACH.FMS1.SAFE01.Zone1.Release', 'FDO'), ('FDI1.00', 'PLT1.MACH.FMS1.SAFE01.Zone1.Fb', 'FDI'),
    ('FDO1.01', 'PLT1.MACH.FMS1.SAFE01.Zone2.Release', 'FDO'), ('FDI1.01', 'PLT1.MACH.FMS1.SAFE01.Zone2.Fb', 'FDI'),
    ('FDO1.02', 'PLT1.MACH.FMS1.SAFE01.Zone3.Release', 'FDO'), ('FDI1.02', 'PLT1.MACH.FMS1.SAFE01.Zone3.Fb', 'FDI'),
    ('FDO1.03', 'PLT1.MACH.FMS1.SAFE01.Zone4.Release', 'FDO'), ('FDI1.03', 'PLT1.MACH.FMS1.SAFE01.Zone4.Fb', 'FDI'),
    ('FDI1.04', 'PLT1.MACH.FMS1.SAFE01.Estop1.Ok', 'FDI'), ('FDI1.05', 'PLT1.MACH.FMS1.SAFE01.Estop1.Ok2', 'FDI'),
    ('FDI1.06', 'PLT1.MACH.FMS1.SAFE01.Estop2.Ok', 'FDI'), ('FDI1.07', 'PLT1.MACH.FMS1.SAFE01.Estop2.Ok2', 'FDI'),
    ('FDI2.00', 'PLT1.MACH.FMS1.SAFE01.Mode.Auto', 'FDI'), ('FDI2.01', 'PLT1.MACH.FMS1.SAFE01.Mode.Maint', 'FDI'),
    ('DI1.00', 'PLT1.MACH.FMS1.SAFE01.Reset.Pb', 'DI'), ('DO1.00', 'PLT1.MACH.FMS1.SAFE01.Reset.Lamp', 'DO'),
    ('DO1.01', 'PLT1.MACH.FMS1.SAFE01.Tower.Red', 'DO'), ('DO1.02', 'PLT1.MACH.FMS1.SAFE01.Tower.Yellow', 'DO'),
    ('DO1.03', 'PLT1.MACH.FMS1.SAFE01.Tower.Green', 'DO'), ('DO1.04', 'PLT1.MACH.FMS1.SAFE01.Tower.Buzzer', 'DO'),
]
REF_M18_BOM = {'24 V power supply 2.5 A': 1, 'Control terminal': 22, 'DI 16 card': 1, 'DO 16 card': 1, 'Emergency-stop push-button': 2, 'FDI 8 card': 2, 'FDO 4 card': 2, 'IO station bus interface': 1, 'Illuminated push-button': 1, 'Key mode selector': 1, 'Safety PLC CPU': 1, 'Signal tower': 1, 'Zone interface terminal block': 4}
REF_M03_CORES = ['4G4 + shield', '4x0.34 (PROFINET / Ethernet)', '4G2.5 + shield', '4x0.34 (PROFINET / Ethernet)', '4G1.5 + shield', '4x0.34 (PROFINET / Ethernet)', '8x0.25', '4x0.75', '7x0.5', '4x0.75', '3x0.34', '3x0.34', '3x0.34', '3x0.34', '4x0.34 (PROFINET / Ethernet)', '7x0.5']
REF_KIT_CORES = {'12x0.25': 10, '12x0.75': 80, '3x0.25': 100, '3x0.34': 260, '3x0.34 + shield': 90, '3x0.75': 45, '4G1.5': 105, '4G1.5 + shield': 45, '4G2.5': 15, '4G2.5 + shield': 15, '4G35': 45, '4G4 + shield': 15, '4G6': 10, '4x0.34': 20, '4x0.34 (PROFINET / Ethernet)': 163, '4x0.5': 15, '4x0.75': 165, '5x0.34': 60, '7x0.5': 45, '8x0.25': 30}
