#!/usr/bin/env python3
"""IP plan of an FMS cell: subnet calculator, overlap and duplicate checks, kit IP plan with PROFINET names, CSV.

Python 3 standard library only, offline. Rules = "_formulas.subnet", "_formulas.ip_plan" and
"_formulas.profinet_name" in examples/item6_examples.json. The kit tables (KITS, MODDEV, RANGES, ZONES) are read
directly from web/fmse6_data.js and UNIT from web/fmse6.js, so the plan is the one of the web page (6D drawIP).
Guide: docs/FMS system design/66_communication.md.

Subnet a.b.c.d/p: mask = p ones ; network = ip AND mask ; broadcast = network OR NOT mask ;
  usable hosts = 2^(32-p) - 2 (p <= 30) ; first = network + 1 ; last = broadcast - 1 ;
  two subnets overlap if one contains the other's network address.
Kit IP plan (= web drawIP): third octet = VLAN % 256 ; subnet 10.site.third.0/24 ; gateway .1 ; unit = UNIT code +
  2-digit counter per module ; each device of MODDEV[module] takes the next free address of its range group
  (RANGES .10 PLCs, .50 IO/drives, .100 HMIs/PCs, .150 CNCs/robots, .200 spare, .240 network) ;
  tag = cell.unit ; beyond the range end -> 'range full!'.
PROFINET device name = lower-case '<cell>-<unit>-<slug>' (slug = device name, runs of non a-z0-9 -> '-',
  no leading/trailing '-') ; valid: only a-z 0-9 '-' '.', each label <= 63, total <= 240, not starting 'port-'.

Usage:
  python tools/fmse/ip_plan.py                               (all JSON parts = --example)
  python tools/fmse/ip_plan.py --cidr 10.1.101.0/24 172.16.5.77/20
  python tools/fmse/ip_plan.py --kit "FMC (1 HMC + rack)" --cell FMC2 --vlan 102 --site 1 --csv ip_fmc2.csv
  python tools/fmse/ip_plan.py --json
  python tools/fmse/ip_plan.py --selftest
"""

import argparse
import json
import re
from pathlib import Path

from fmse_common import InputError, SelfTest, fmt_table, load_examples, read_js_const, run_main, write_csv

HERE = Path(__file__).resolve().parent
ITEM6_EXAMPLES = HERE / "examples" / "item6_examples.json"
WEB_DATA = HERE.parent.parent / "web" / "fmse6_data.js"
WEB_JS = HERE.parent.parent / "web" / "fmse6.js"
CSV_HEAD = ["Tag", "Device", "Module", "IP", "Subnet", "Gateway", "VLAN", "PNName"]


# ----------------------------------------------------------------------------- web tables
def read_unit(path=WEB_JS):
    """UNIT = {M01: "MC", ...} of web/fmse6.js (a plain `const`, not exported -> own small parser)."""
    p = Path(path)
    if not p.is_file():
        raise InputError(f"File not found: {p}")
    m = re.search(r"const UNIT\s*=\s*(\{[^}]*\})", p.read_text(encoding="utf-8"))
    if not m:
        raise InputError(f"{p}: constant 'UNIT' not found")
    js = re.sub(r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:', r'\1"\2":', m.group(1))
    try:
        return json.loads(re.sub(r",(\s*})", r"\1", js))
    except json.JSONDecodeError as exc:
        raise InputError(f"{p}: UNIT could not be read ({exc.msg})")


def web_tables():
    return {"KITS": read_js_const(WEB_DATA, "KITS"), "MODDEV": read_js_const(WEB_DATA, "MODDEV"),
            "RANGES": read_js_const(WEB_DATA, "RANGES"), "ZONES": read_js_const(WEB_DATA, "ZONES"),
            "UNIT": read_unit()}


def kit_units(kit_modules, UNIT):
    """[(module, unit)] with a counter per module code, e.g. ('M01', 'MC01') = web drawIP / 6F."""
    cnt, out = {}, []
    for m in kit_modules:
        cnt[m] = cnt.get(m, 0) + 1
        out.append((m, f"{UNIT[m]}{cnt[m]:02d}"))
    return out


# ----------------------------------------------------------------------------- subnet arithmetic
def ip2int(s):
    parts = s.strip().split(".")
    if len(parts) != 4:
        raise InputError(f"'{s}' is not an IPv4 address a.b.c.d")
    try:
        v = [int(p) for p in parts]
    except ValueError:
        raise InputError(f"'{s}' is not an IPv4 address a.b.c.d")
    if any(x < 0 or x > 255 for x in v):
        raise InputError(f"'{s}': every octet must be 0..255")
    return (v[0] << 24) | (v[1] << 16) | (v[2] << 8) | v[3]


def int2ip(n):
    return ".".join(str((n >> s) & 255) for s in (24, 16, 8, 0))


def subnet(cidr):
    if "/" not in cidr:
        raise InputError(f"'{cidr}' must be a.b.c.d/prefix")
    ip_s, p_s = cidr.split("/", 1)
    try:
        p = int(p_s)
    except ValueError:
        raise InputError(f"'{cidr}': prefix must be a whole number 0..32")
    if not 0 <= p <= 32:
        raise InputError(f"'{cidr}': prefix must be 0..32")
    ip = ip2int(ip_s)
    mask = (0xFFFFFFFF << (32 - p)) & 0xFFFFFFFF if p else 0
    net = ip & mask
    bc = net | (~mask & 0xFFFFFFFF)
    usable = 2 ** (32 - p) - 2 if p <= 30 else 0
    return {"cidr": cidr, "ip": int2ip(ip), "prefix": p, "mask": int2ip(mask), "network": int2ip(net),
            "broadcast": int2ip(bc), "first": int2ip(net + 1) if p <= 30 else "-",
            "last": int2ip(bc - 1) if p <= 30 else "-", "usable": usable, "_net": net, "_bc": bc,
            "host_bits_set": ip != net}


def contains(a, ip_int):
    return a["_net"] <= ip_int <= a["_bc"]


def overlaps(plan):
    S = [subnet(c) for c in plan]
    out = []
    for i in range(len(S)):
        for j in range(i + 1, len(S)):
            if contains(S[i], S[j]["_net"]) or contains(S[j], S[i]["_net"]):
                out.append((plan[i], plan[j]))
    return out


def duplicates(devices):
    seen, out = {}, []
    for name, ip in devices:
        ip2int(ip)
        if ip in seen:
            out.append((ip, seen[ip], name))
        else:
            seen[ip] = name
    return out


# ----------------------------------------------------------------------------- PROFINET names
def pn_slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def pn_name(cell, unit, device):
    return f"{cell}-{unit}-{pn_slug(device)}".lower()


def pn_check(name):
    """Return a list of rule violations of a PROFINET device name (empty = valid)."""
    bad = []
    if not re.fullmatch(r"[a-z0-9.\-]+", name or ""):
        bad.append("only a-z 0-9 '-' '.' allowed")
    if any(len(lb) > 63 for lb in name.split(".")):
        bad.append("label longer than 63 characters")
    if any(len(lb) == 0 for lb in name.split(".")):
        bad.append("empty label")
    if len(name) > 240:
        bad.append("longer than 240 characters")
    if name.startswith("port-"):
        bad.append("must not start with 'port-'")
    return bad


# ----------------------------------------------------------------------------- kit IP plan (= web drawIP)
def kit_plan(T, kit, site, cell, vlan):
    if kit not in T["KITS"]:
        raise InputError(f"kit '{kit}' unknown: {', '.join(T['KITS'])}")
    site = max(0, min(255, int(site)))
    cell = re.sub(r"[^A-Za-z0-9]", "", cell or "") or "CELL"
    third = vlan % 256
    net, gw = f"10.{site}.{third}.0/24", f"10.{site}.{third}.1"
    nxt = [r[0] for r in T["RANGES"]]
    rows = []
    for m, unit in kit_units(T["KITS"][kit], T["UNIT"]):
        for dn, g in T["MODDEV"].get(m, []):
            ip = nxt[g]
            nxt[g] += 1
            rows.append([f"{cell}.{unit}", dn, m, f"10.{site}.{third}.{ip}" if ip <= T["RANGES"][g][1] else "range full!",
                         net, gw, vlan, pn_name(cell, unit, dn)])
    return {"rows": rows, "net": net, "gw": gw, "site": site, "cell": cell, "vlan": vlan, "third": third,
            "zones": [[v, n, f"10.{site}.{v}.0/24", c] for v, n, c in T["ZONES"]]}


# ----------------------------------------------------------------------------- output
def show_subnets(cidrs):
    print("SUBNET CALCULATOR")
    rows = []
    for c in cidrs:
        s = subnet(c)
        rows.append([c, s["mask"], s["network"], s["broadcast"], s["first"], s["last"], s["usable"],
                     "host bits set -> network is " + s["network"] if s["host_bits_set"] else ""])
    print(fmt_table(["CIDR", "mask", "network", "broadcast", "first host", "last host", "usable", "note"], rows,
                    "llllllrl"))


def show_plan_checks(D):
    print("OVERLAP CHECK OF THE ADDRESS PLAN  " + ", ".join(D["plan"]))
    ov = overlaps(D["plan"])
    for a, b in ov:
        print(f"  OVERLAP  {a} and {b}")
    print(f"  {len(ov)} overlap(s)" if ov else "  no overlaps")
    print()
    print("DUPLICATE-IP CHECK OF THE DEVICE LIST")
    du = duplicates(D["devices"])
    for ip, a, b in du:
        print(f"  DUPLICATE  {ip}: '{a}' and '{b}'")
    print(f"  {len(du)} duplicate(s) in {len(D['devices'])} devices" if du else "  no duplicates")
    plan = [subnet(c) for c in D["plan"]]
    for name, ip in D["devices"]:
        n = ip2int(ip)
        hits = [s for s in plan if contains(s, n)]
        if not hits:
            print(f"  NOT IN PLAN  {name} {ip}")
        for s in hits:
            if n in (s["_net"], s["_bc"]):
                print(f"  RESERVED  {name} {ip} is the network / broadcast address of {s['cidr']}")


def show_kit(P, kit, csv_path):
    print(f"KIT IP PLAN  kit '{kit}', cell {P['cell']}, VLAN {P['vlan']} -> subnet {P['net']}, gateway {P['gw']}")
    print(fmt_table(["#", "Tag", "Device", "Module", "IP", "PROFINET name", "PN check"],
                    [[k, r[0], r[1], r[2], r[3], r[7], "OK" if not pn_check(r[7]) else "; ".join(pn_check(r[7]))]
                     for k, r in enumerate(P["rows"], 1)], "rllllll"))
    full = sum(1 for r in P["rows"] if r[3] == "range full!")
    print(f"  {len(P['rows'])} devices, {full} 'range full!'")
    print()
    print("ZONES / VLANs")
    zr = [[v, n, s, c] for v, n, s, c in P["zones"]]
    zr.append([P["vlan"], f"Cell {P['cell']} (L1–2)", P["net"], f"{len(P['rows'])} devices, gateway {P['gw']} (firewall)"])
    print(fmt_table(["VLAN", "zone", "subnet", "content"], zr, "rlll"))
    if csv_path:
        print(f"\nCSV written: {write_csv(csv_path, CSV_HEAD, P['rows'])}")


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("ip_plan")
    _, D = load_examples(path, "subnet")
    _, IP = load_examples(path, "ip_plan")
    s = subnet("10.1.101.0/24")
    t.equal("/24: mask 255.255.255.0", s["mask"], "255.255.255.0")
    t.equal("/24: broadcast 10.1.101.255, 254 hosts", (s["broadcast"], s["usable"]), ("10.1.101.255", 254))
    t.equal("/24: first .1 last .254", (s["first"], s["last"]), ("10.1.101.1", "10.1.101.254"))
    s = subnet("10.1.101.64/26")
    t.equal("/26: mask .192, .64-.127, 62 hosts", (s["mask"], s["network"], s["broadcast"], s["usable"]),
            ("255.255.255.192", "10.1.101.64", "10.1.101.127", 62))
    s = subnet("10.1.30.0/23")
    t.equal("/23: 255.255.254.0, broadcast 10.1.31.255, 510 hosts", (s["mask"], s["broadcast"], s["usable"]),
            ("255.255.254.0", "10.1.31.255", 510))
    t.equal("/23: last host 10.1.31.254", s["last"], "10.1.31.254")
    s = subnet("192.168.10.130/25")
    t.equal("/25 from a host address: network .128, broadcast .255", (s["network"], s["broadcast"]),
            ("192.168.10.128", "192.168.10.255"))
    t.equal("/25: first .129 last .254, 126 hosts", (s["first"], s["last"], s["usable"]),
            ("192.168.10.129", "192.168.10.254", 126))
    t.true("/25: host bits set flagged", s["host_bits_set"])
    t.equal("/30: 2 hosts, /31: 0 by the formula", (subnet("10.0.0.0/30")["usable"], subnet("10.0.0.0/31")["usable"]),
            (2, 0))
    t.equal("overlap: only 10.1.101.0/24 with 10.1.101.128/25", overlaps(D["plan"]),
            [("10.1.101.0/24", "10.1.101.128/25")])
    t.equal("duplicate: 10.1.101.10 POOL01 PLC and CC01", duplicates(D["devices"]),
            [("10.1.101.10", "FMS1.POOL01 PLC", "FMS1.CC01 Cell controller")])
    try:
        subnet("10.1.300.0/24")
        t.true("bad octet -> InputError", False)
    except InputError:
        t.true("bad octet -> InputError", True)
    t.equal("PN name FMS1 MC01 'PLC (machine)' -> fms1-mc01-plc-machine", pn_name("FMS1", "MC01", "PLC (machine)"),
            "fms1-mc01-plc-machine")
    t.equal("PN name 'IO + RFID' -> ls01 io-rfid", pn_name("FMS1", "LS01", "IO + RFID"), "fms1-ls01-io-rfid")
    t.true("PN check: 'port-001' invalid", pn_check("port-001") != [])
    t.true("PN check: upper case invalid", pn_check("FMS1-mc01") != [])
    t.true("PN check: 64-char label invalid", pn_check("a" * 64) != [])
    t.true("PN check: 241 chars invalid", pn_check(".".join(["a" * 60] * 4)) != [])
    if not (WEB_DATA.is_file() and WEB_JS.is_file()):
        print("  NOTE  web files not found - kit plan checks skipped")
        return t.finish()
    T = web_tables()
    t.equal("UNIT from web/fmse6.js: 22 module codes, M01 MC, M19 CC", (len(T["UNIT"]), T["UNIT"]["M01"],
                                                                        T["UNIT"]["M19"]), (22, "MC", "CC"))
    P = kit_plan(T, IP["kit"], IP["site"], IP["cell"], IP["vlan"])
    R = P["rows"]
    t.equal("kit FMS: 31 devices (9 + 3 + 4 + 4 + 1+1+1+2+1+1+1+1+2)", len(R), 31)
    t.equal("subnet 10.1.101.0/24, gateway 10.1.101.1", (P["net"], P["gw"]), ("10.1.101.0/24", "10.1.101.1"))
    t.equal("row 1 = FMS1.MC01 CNC 10.1.101.150", R[0][:4], ["FMS1.MC01", "CNC", "M01", "10.1.101.150"])
    t.equal("row 2 = FMS1.MC01 PLC (machine) 10.1.101.10", R[1][:4], ["FMS1.MC01", "PLC (machine)", "M01", "10.1.101.10"])
    t.equal("row 3 = FMS1.MC01 HMI 10.1.101.100", R[2][3], "10.1.101.100")
    t.equal("MC03 CNC .152", [r[3] for r in R if r[0] == "FMS1.MC03" and r[1] == "CNC"], ["10.1.101.152"])
    t.equal("APC01..03 IO .50 .51 .52", [r[3] for r in R if r[2] == "M02"], ["10.1.101.50", "10.1.101.51", "10.1.101.52"])
    t.equal("cell controller CC01 .17 (8th PLC-group device)", [r[3] for r in R if r[0] == "FMS1.CC01"], ["10.1.101.17"])
    t.equal("last rows: NET01 core switch .240, firewall .241", [r[3] for r in R[-2:]], ["10.1.101.240", "10.1.101.241"])
    t.equal("no 'range full!'", sum(1 for r in R if r[3] == "range full!"), 0)
    t.equal("no duplicate IP in the kit plan", len({r[3] for r in R}), len(R))
    t.equal("all PROFINET names valid", sum(1 for r in R if pn_check(r[7])), 0)
    t.equal("MC01 PROFINET names", [r[7] for r in R if r[0] == "FMS1.MC01"],
            ["fms1-mc01-cnc", "fms1-mc01-plc-machine", "fms1-mc01-hmi"])
    t.equal("CSV columns", CSV_HEAD, ["Tag", "Device", "Module", "IP", "Subnet", "Gateway", "VLAN", "PNName"])
    t.equal("VLAN 357 -> third octet 101 (357 % 256)", kit_plan(T, IP["kit"], 1, "FMS1", 357)["net"], "10.1.101.0/24")
    big = dict(T)
    big["KITS"] = {"x": ["M01"] * 41}
    t.equal("41 x M01: 41st PLC -> 'range full!' (.10-.49 = 40 addresses)",
            [r[3] for r in kit_plan(big, "x", 1, "C", 101)["rows"] if r[1] == "PLC (machine)"][-1], "range full!")
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--examples", default=str(ITEM6_EXAMPLES), help="example JSON (default: %(default)s)")
    ap.add_argument("--example", action="store_true", help="run the JSON example (also the default)")
    ap.add_argument("--cidr", nargs="+", help="only the subnet calculator for these CIDRs")
    ap.add_argument("--kit", help="kit name (web/fmse6_data.js KITS), default = JSON ip_plan.kit")
    ap.add_argument("--site", type=int, help="site number = 2nd octet")
    ap.add_argument("--cell", help="cell code")
    ap.add_argument("--vlan", type=int, help="cell VLAN (2..4094)")
    ap.add_argument("--csv", help="write the kit IP plan as CSV (Tag;Device;Module;IP;Subnet;Gateway;VLAN;PNName)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    if a.cidr:
        if a.json:
            print(json.dumps([{k: v for k, v in subnet(c).items() if not k.startswith("_")} for c in a.cidr], indent=1))
        else:
            show_subnets(a.cidr)
        return 0
    _, D = load_examples(a.examples, "subnet")
    _, IP = load_examples(a.examples, "ip_plan")
    T = web_tables()
    vlan = IP["vlan"] if a.vlan is None else a.vlan
    if not 2 <= vlan <= 4094:
        raise InputError("--vlan must be 2..4094")
    kit = a.kit or IP["kit"]
    P = kit_plan(T, kit, IP["site"] if a.site is None else a.site, a.cell or IP["cell"], vlan)
    if a.json:
        print(json.dumps({"subnets": [{k: v for k, v in subnet(c).items() if not k.startswith("_")} for c in D["cidrs"]],
                          "overlaps": overlaps(D["plan"]), "duplicates": duplicates(D["devices"]),
                          "kit_plan": [dict(zip(CSV_HEAD, r)) for r in P["rows"]], "zones": P["zones"]},
                         indent=1, ensure_ascii=False))
        return 0
    show_subnets(D["cidrs"])
    print()
    show_plan_checks(D)
    print()
    show_kit(P, kit, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
