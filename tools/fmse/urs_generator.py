#!/usr/bin/env python3
"""URS generator: turns the answers of the 40-question FMS requirements questionnaire into a
User Requirement Specification (URS) draft in Markdown plus a traceability CSV.

Offline, Python standard library only.

Input (exported by the web questionnaire, FMS engineering tab -> item 1 -> 1D):
    {"format": "fms-requirements-v1", "date": "2027-02-01",
     "answers": {"q01": "Crankcases VC10/20/30 (cast iron)", "q02": "12", ...}}
  Missing or empty answers become open points (TBD).

Output:
  - URS_draft.md : chapters 1 Purpose & scope ... 13 Acceptance criteria, 14 Open points.
    Every answer becomes one requirement with a stable ID (URS-<chapter code>-<no>, e.g.
    URS-PRD-001 = question q01) and a "Verification:" line (inspection / test / analysis /
    demonstration) with the proposed method.
  - trace.csv    : URS ID; requirement text; FDS reference (empty); verification method;
                   test reference (empty)  -> the integrator fills FDS and test references.
  - Vagueness checker: flags words like "fast", "reliable", "approximately", "state of the
    art" ... with a rewrite hint, and answers that should contain a number but do not.

The 40 questions (ids, groups, texts, why, example, type) are a copy of QUEST in
web/fmse_data.js. --selftest checks that the web file still has q01..q40.
Use --make-example FILE to write a questionnaire filled with the example answers.
"""

import argparse
import datetime as dt
import json
import re
from pathlib import Path

from fmse_common import InputError, SelfTest, load_json, run_main, write_csv

HERE = Path(__file__).resolve().parent
WEB_DATA = HERE.parents[1] / "web" / "fmse_data.js"
FORMAT = "fms-requirements-v1"

# ----------------------------------------------------------------------------- questions
# copy of QUEST in web/fmse_data.js: [id, group, question, why it matters, example answer, type]
# type: t = text, n = number, s:opt1|opt2 = choice
QUEST = [
    ["q01", "Products", "Which part families / products shall the system make?", "Decides machine type, size, fixtures.", "Crankcases VC10/20/30 (cast iron)", "t"],
    ["q02", "Products", "Number of different part numbers (variety)", "Volume–variety chart → system type.", "12", "n"],
    ["q03", "Products", "Largest part: size (mm) and mass (kg)", "Machine work area, pallet size, robot / crane payload.", "400 × 350 × 300 mm, 28 kg", "t"],
    ["q04", "Products", "Material(s) and raw-part condition (casting, forging, bar, sheet …)", "Process, tools, chips, cleaning.", "EN-GJL-250 castings", "t"],
    ["q05", "Products", "Tightest tolerances and surface requirements", "Machine class, temperature control, measuring.", "Bore Ø52 H7, flatness 0.02, Ra 0.8", "t"],
    ["q06", "Volume", "Annual volume per part number now and in 5 years", "Capacity and expansion reserve.", "VC20: 4 000 → 9 000 / year", "t"],
    ["q07", "Volume", "Typical lot / order size and order frequency", "Set-up share, storage, scheduling rules.", "20–60 per order, weekly", "t"],
    ["q08", "Volume", "Required delivery lead time", "Buffer and WIP limits.", "≤ 5 working days", "t"],
    ["q09", "Volume", "Working time: shifts / day, days / year, unmanned hours wanted", "Available time, storage size for unmanned shifts.", "2 shifts + 1 unmanned, 240 days", "t"],
    ["q10", "Process", "Process steps per part (routing) with estimated times", "Number of machines, balancing.", "OP10 rough 8 min, OP20 finish 6 min, wash 2 min", "t"],
    ["q11", "Process", "Process domain", "Typical modules (see table 1B).", "Machining (prismatic)", "s:Machining (prismatic)|Machining (rotational)|Assembly|Robot welding|Sheet metal|Injection / casting|Electronics|Painting|Mixed"],
    ["q12", "Process", "Set-up / changeover today (min) and number per week", "SMED potential, fixture and tool strategy.", "90 min, 12 per week", "t"],
    ["q13", "Process", "Fixtures: dedicated, modular, zero-point system?", "Pallet / fixture count and cost.", "Dedicated tombstones per model", "t"],
    ["q14", "Process", "Tools: number of different tools, tool life, central tool store wanted?", "Magazine size, tool management module.", "120 tools, 30 sister tools", "t"],
    ["q15", "Quality", "Inspection: what, where, how often (100 %, sampling, in-process)?", "CMM / gauges / vision modules, SPC.", "CMM first part + 1 in 10", "t"],
    ["q16", "Quality", "Traceability level: lot, serial, data per serial?", "Marking, RFID, MES data model.", "Serial + process data", "s:None|Lot|Serial|Serial + process data"],
    ["q17", "Quality", "Customer / sector standards (IATF 16949, ISO 9001, AS9100, medical …)", "Documentation, validation effort.", "ISO 9001", "t"],
    ["q18", "Existing technology", "Existing machines to integrate (brand, control, age, interface)", "Retrofit / interface effort.", "2 × HMC Fanuc 31i, 2015, Ethernet", "t"],
    ["q19", "Existing technology", "Company standard PLC / robot / CNC brands", "Spare parts, skills, module library choice.", "Siemens S7-1500, Fanuc robots", "t"],
    ["q20", "Existing technology", "Allowed networks and protocols", "Communication design (item 6).", "Ethernet + Modbus TCP + HTTP only", "t"],
    ["q21", "Existing technology", "Existing ERP / MES / software", "Integration (items 11–12).", "ERP: Odoo; no MES", "t"],
    ["q22", "Logistics", "How do raw parts arrive and finished parts leave (pallet, box, crane, AGV)?", "Load / unload stations, storage, transport.", "Euro pallets by forklift", "t"],
    ["q23", "Logistics", "Storage needed: raw, WIP, finished (places / pallets)", "AS/RS or rack size.", "40 raw, 20 WIP pallets", "t"],
    ["q24", "Logistics", "Internal transport today and wanted (forklift, AGV/AMR, conveyor, RGV)", "Transport module choice.", "Forklift → AGV wanted", "t"],
    ["q25", "Site", "Available floor area (m × m), height, crane", "Layout, AS/RS height.", "40 × 18 m, 8 m, 10 t crane", "t"],
    ["q26", "Site", "Floor / foundation (thickness, flatness)", "Machine foundations, AGV floor flatness.", "200 mm concrete, ±5 mm / 2 m", "t"],
    ["q27", "Site", "Power supply (V, Hz, kVA available), compressed air, cooling water", "Utilities design.", "400 V 50 Hz, 400 kVA, 7 bar", "t"],
    ["q28", "Site", "Climate: temperature range, dust, humidity", "Accuracy, cabinet cooling, IP class.", "15–35 °C, no air-con", "t"],
    ["q29", "People", "Operators per shift, skill level, languages", "Automation level, HMI, training.", "2 operators, CNC basic, local language", "t"],
    ["q30", "People", "Maintenance and programming skills in house", "Choice of technology, service contract.", "1 electrician, no PLC programmer", "t"],
    ["q31", "Safety", "Country / legal framework (e.g. EU Machinery Regulation, local law)", "CE / conformity, standards.", "EU – Machinery Regulation (EU) 2023/1230", "t"],
    ["q32", "Safety", "Special risks (heavy parts, hot, explosive dust, robots with people)", "Safety concept, guards, collaborative zones.", "Parts 28 kg → no manual lifting", "t"],
    ["q33", "IT / OT", "IT security rules: internet allowed? remote access? network owner?", "Architecture, offline operation, remote service.", "No internet on shop floor; VPN by IT only", "t"],
    ["q34", "IT / OT", "Data wanted: OEE, energy, tool life, quality, alarms, history period", "Data model, historian size.", "OEE + alarms + energy, 2 years", "t"],
    ["q35", "Business", "Budget range and payback target", "Variant choice.", "2.5–3.2 M€, payback ≤ 7 years", "t"],
    ["q36", "Business", "Target dates (order, FAT, SAT, full output)", "Schedule, feasibility.", "Order 03/2027, full output 09/2028", "t"],
    ["q37", "Business", "Guaranteed KPIs wanted (output, OEE, availability, scrap)", "Acceptance criteria in URS / contract.", "≥ 14 parts/h, availability ≥ 95 %", "t"],
    ["q38", "Business", "Role of our company in this project", "Which tasks of each phase are ours.", "Integrator", "s:Factory owner|Integrator|Machine builder|Consultant"],
    ["q39", "Business", "Future: new parts expected? Expansion planned?", "Modularity, reserve space, software openness.", "+2 product families in 3 years", "t"],
    ["q40", "Business", "Biggest pain point today (one sentence)", "Keeps the project focused.", "Set-up times eat 25 % of machine time", "t"],
]

# ----------------------------------------------------------------------------- URS structure
# chapter no -> (title, code)
CHAPTERS = [
    (1, "Purpose & scope", "SCO"), (2, "Products", "PRD"), (3, "Volumes & capacity", "VOL"),
    (4, "Process", "PRC"), (5, "Quality & traceability", "QUA"),
    (6, "Existing technology & interfaces", "TEC"), (7, "Logistics", "LOG"),
    (8, "Site & utilities", "SIT"), (9, "People & training", "PPL"), (10, "Safety & legal", "SAF"),
    (11, "IT/OT & data", "ITO"), (12, "Commercial & schedule", "COM"), (13, "Acceptance criteria", "ACC"),
    (14, "Open points", "TBD"),
]
# question -> (chapter no, requirement template, verification method, how it is verified)
RULES = {
    "q40": (1, "The project shall remove this main problem (pain point): {a}.", "analysis",
            "Compare baseline KPIs before the project with KPIs after ramp-up"),
    "q38": (1, "Role of the author company in this project: {a}. The scope split shall be fixed in the scope matrix.",
            "inspection", "Check of the signed scope matrix"),
    "q39": (1, "The system shall be expandable for: {a} (reserve space, modular design, open software).",
            "analysis", "Review of layout reserve and module concept in the FDS"),
    "q01": (2, "The system shall manufacture these part families / products: {a}.", "inspection",
            "First parts checked against the drawings (CMM report)"),
    "q02": (2, "The system shall handle {a} different part numbers without hardware change.", "demonstration",
            "Run all part numbers (or a representative set) at FAT / SAT"),
    "q03": (2, "The system shall accept parts up to this size and mass: {a}.", "test",
            "Run with the largest and heaviest part"),
    "q04": (2, "The system shall process these materials / raw-part conditions: {a}.", "inspection",
            "Check of process plan and test cuts on real raw parts"),
    "q05": (2, "The system shall reach these tolerances and surface values: {a}.", "test",
            "CMM / roughness measurement; Cpk >= 1.33 on the key features over >= 50 parts"),
    "q06": (3, "The system shall be designed for these annual volumes (now -> in 5 years): {a}.", "analysis",
            "Capacity calculation + simulation with >= 15 % reserve"),
    "q07": (3, "The system shall run economically with these lot / order sizes and frequencies: {a}.",
            "demonstration", "Mixed-lot run at FAT with the agreed lot sizes"),
    "q08": (3, "The system shall support a delivery lead time of {a}.", "analysis",
            "Simulation of order flow (lead time, WIP) in the twin"),
    "q09": (3, "The system shall be designed for this working time: {a}.", "demonstration",
            "Unmanned shift run at SAT without operator action"),
    "q10": (4, "The system shall perform these process steps (routing, estimated times): {a}.", "test",
            "Time study of each operation at FAT"),
    "q11": (4, "The process domain of the system is: {a}.", "inspection", "Check of the concept / FDS"),
    "q12": (4, "Changeover situation today (baseline): {a}. The supplier shall state the guaranteed changeover "
                 "time in the offer.", "test", "Timed changeover at FAT / SAT"),
    "q13": (4, "The fixture concept shall be: {a}.", "inspection", "Design review of fixtures / pallets"),
    "q14": (4, "The tool concept shall cover: {a}.", "analysis",
            "Tool pocket calculation for all parts + unmanned shifts in the FDS"),
    "q15": (5, "Inspection shall be done as follows: {a}.", "demonstration",
            "Run of the inspection sequence incl. NOK handling at FAT"),
    "q16": (5, "Traceability level: {a}.", "test", "Trace a test part from raw part to finished part in the data"),
    "q17": (5, "The system and its documentation shall support these standards: {a}.", "inspection",
            "Check of documentation against the standard"),
    "q18": (6, "These existing machines shall be integrated: {a}.", "test",
            "Interface test of each existing machine (signals + data block)"),
    "q19": (6, "Only these company standard brands shall be used: {a}.", "inspection",
            "Check of parts lists and circuit diagrams"),
    "q20": (6, "Only these networks and protocols shall be used: {a}.", "test",
            "Network scan + read / write test of all interfaces"),
    "q21": (6, "The system shall connect to this existing software: {a}.", "test",
            "Message test with the test system of the ERP / MES"),
    "q22": (7, "Material flow in and out: {a}.", "demonstration", "Delivery and pick-up of real loads on site"),
    "q23": (7, "Storage capacity shall be at least: {a}.", "inspection", "Count of storage places in the layout / on site"),
    "q24": (7, "Internal transport: {a}.", "demonstration", "Transport run with the chosen system"),
    "q25": (8, "The layout shall fit into: {a}.", "inspection", "Layout drawing check incl. service areas"),
    "q26": (8, "Existing floor: {a}. The supplier shall state any extra foundation requirement.", "analysis",
            "Foundation / floor check by the supplier (drawing + load calculation)"),
    "q27": (8, "The system shall run with these utilities: {a}.", "test",
            "Measurement of power, air and water consumption at SAT"),
    "q28": (8, "The system shall keep accuracy and function in this climate: {a}.", "analysis",
            "Thermal / cabinet cooling calculation, IP class check"),
    "q29": (9, "The system shall be operable by: {a}; HMI language and training shall match.", "demonstration",
            "Operators run the system after training (signed training records)"),
    "q30": (9, "In-house skills: {a}. The supplier shall provide training / service to cover the gaps.",
            "inspection", "Check of training plan and service contract"),
    "q31": (10, "The system shall comply with: {a}.", "inspection",
            "Risk assessment, PL verification, declaration of conformity"),
    "q32": (10, "The safety concept shall cover these special risks: {a}.", "analysis",
            "Risk assessment (ISO 12100) reviewed at 30 / 60 / 90 %"),
    "q33": (11, "The system shall follow these IT security rules: {a}.", "test",
            "Security check by IT (zones, conduits, remote access)"),
    "q34": (11, "The system shall record and keep this data: {a}.", "demonstration",
            "Show data in the historian / MES for the agreed period"),
    "q35": (12, "Budget range and payback target: {a}.", "analysis", "Business case (NPV, IRR, payback)"),
    "q36": (12, "The project shall meet these target dates: {a}.", "inspection",
            "Master schedule (CPM) and milestone reports"),
    "q37": (13, "The supplier shall guarantee these KPIs: {a}.", "test",
            "Capacity run at FAT and availability run at SAT; A = (T_run - T_owner - T_supplier) / (T_run - T_owner)"),
}
NEEDS_NUMBER = {"q02", "q03", "q05", "q06", "q07", "q08", "q09", "q10", "q12", "q23", "q25", "q26", "q27",
                "q28", "q35", "q36", "q37"}

# vague words / phrases -> rewrite hint (longest phrases are checked first)
VAGUE = {
    "as soon as possible": "give a date or a duration (e.g. 'within 4 weeks after order')",
    "asap": "give a date or a duration",
    "as fast as possible": "give a time with unit (maximum allowed)",
    "as quickly as possible": "give a time with unit (maximum allowed)",
    "state of the art": "name the standard, technology or value you expect",
    "state-of-the-art": "name the standard, technology or value you expect",
    "maximum possible": "give the limit value with unit",
    "minimum possible": "give the limit value with unit",
    "as low as possible": "give the maximum allowed value with unit",
    "as high as possible": "give the minimum required value with unit",
    "user-friendly": "describe the task and a measurable limit (steps, training hours)",
    "user friendly": "describe the task and a measurable limit (steps, training hours)",
    "easy to use": "describe the task and a measurable limit (steps, training hours)",
    "if possible": "decide: required ('shall') or not required",
    "and so on": "list all items",
    "etc": "list all items",
    "fast": "give a time with unit, e.g. 'cycle time <= 60 s'",
    "quick": "give a time with unit, e.g. 'changeover <= 10 min'",
    "quickly": "give a time with unit",
    "reliable": "give availability (%) or MTBF (h) and how it is measured",
    "robust": "name the load / disturbance and the required behaviour",
    "flexible": "list the variants and the allowed changeover time",
    "approximately": "give a range or a value with tolerance, e.g. '40-60' or '50 +/- 5'",
    "approx": "give a range or a value with tolerance",
    "about": "give a range or a value with tolerance",
    "around": "give a range or a value with tolerance",
    "roughly": "give a range or a value with tolerance",
    "sufficient": "give the required number with unit",
    "adequate": "give the required number with unit",
    "enough": "give the required number with unit",
    "appropriate": "say exactly what is meant (value, standard)",
    "suitable": "say exactly what is meant (value, standard)",
    "minimal": "give the maximum allowed value with unit",
    "optimal": "give the target value and the criterion",
    "optimum": "give the target value and the criterion",
    "efficient": "give the target value (e.g. OEE %, energy kWh/part)",
    "modern": "name the technology or standard",
    "intuitive": "describe the task and a measurable limit",
    "simple": "describe what must be simple and how it is checked",
    "easy": "describe what must be easy and how it is checked",
    "several": "give the number",
    "many": "give the number",
    "some": "give the number",
    "high quality": "give tolerances / Cpk / scrap rate",
    "low cost": "give the budget or cost per part",
    "best": "give the criterion and the value",
    "normally": "say what happens in all cases, including exceptions",
    "should": "use 'shall' for a requirement, or move it to 'nice to have'",
}


# ----------------------------------------------------------------------------- logic
def vague_findings(text):
    """Return a list of (word, hint) found in text (whole words, case-insensitive, each word once)."""
    found, taken = [], []
    low = text.lower()
    for phrase in sorted(VAGUE, key=len, reverse=True):
        for m in re.finditer(r"(?<![\w-])" + re.escape(phrase) + r"(?![\w-])", low):
            span = (m.start(), m.end())
            if any(s < span[1] and span[0] < e for s, e in taken):
                continue
            taken.append(span)
            if phrase not in [f[0] for f in found]:
                found.append((phrase, VAGUE[phrase]))
    return found


def check_answer(q, answer):
    """Quality findings for one answer: list of strings (vague words, missing numbers, bad choices)."""
    qid, typ = q[0], q[5]
    out = [f"vague word '{w}' -> {h}" for w, h in vague_findings(answer)]
    if typ == "n":
        try:
            float(answer.replace(",", ".").replace(" ", ""))
        except ValueError:
            out.append("a number is expected here")
    elif qid in NEEDS_NUMBER and not re.search(r"\d", answer):
        out.append("no number found -> add the value with its unit")
    if typ.startswith("s:"):
        opts = typ[2:].split("|")
        if answer not in opts:
            out.append(f"answer is not one of the standard choices ({' / '.join(opts)}) - check")
    return out


def load_questionnaire(path):
    """Read and check the questionnaire JSON; return (meta dict, answers dict of str, warnings)."""
    data = load_json(path)
    if not isinstance(data, dict):
        raise InputError(f"{path}: the top level must be a JSON object")
    warn = []
    fmt = data.get("format")
    if fmt != FORMAT:
        if fmt is None:
            warn.append(f"no 'format' field (expected '{FORMAT}')")
        else:
            raise InputError(f"{path}: format '{fmt}' is not supported (expected '{FORMAT}')")
    ans = data.get("answers")
    if not isinstance(ans, dict):
        raise InputError(f"{path}: 'answers' must be an object like {{\"q01\": \"...\"}}")
    ids = {q[0] for q in QUEST}
    clean = {}
    for k, v in ans.items():
        if k not in ids:
            warn.append(f"unknown question id '{k}' ignored")
            continue
        if v is None:
            v = ""
        if isinstance(v, (list, tuple)):
            v = "; ".join(str(x) for x in v)
        clean[k] = " ".join(str(v).split())   # one line, single spaces
    meta = {k: data[k] for k in data if k not in ("answers",)}
    return meta, clean, warn


def build_requirements(answers):
    """Create the requirement list from the answers. Stable ids: position of the question in its chapter."""
    code = {no: c for no, _, c in CHAPTERS}
    counter = {}
    reqs = []
    qby = {q[0]: q for q in QUEST}
    for qid in sorted(RULES, key=lambda k: RULES[k][0]):   # chapter order, then order in RULES
        q = qby[qid]
        ch, tmpl, method, how = RULES[qid]
        counter[ch] = counter.get(ch, 0) + 1
        rid = f"URS-{code[ch]}-{counter[ch]:03d}"
        a = answers.get(qid, "").strip()
        tbd = not a
        text = f"TBD - {q[2]}" if tbd else tmpl.format(a=a.rstrip("."))
        reqs.append({"id": rid, "chapter": ch, "q": q, "answer": a, "text": text, "tbd": tbd,
                     "method": method, "how": how, "findings": [] if tbd else check_answer(q, a)})
    return reqs


def urs_markdown(meta, reqs, source):
    """The URS draft as Markdown text."""
    today = dt.date.today().isoformat()
    n_tbd = sum(r["tbd"] for r in reqs)
    n_find = sum(len(r["findings"]) for r in reqs)
    title = meta.get("project") or meta.get("title") or "FMS project"
    L = [f"# User Requirement Specification (URS) - DRAFT", "",
         f"**Project:** {title}  ", f"**Questionnaire date:** {meta.get('date', '-')}  ",
         f"**Generated:** {today} from `{source}` by tools/fmse/urs_generator.py  ",
         f"**Status:** draft for review - {len(reqs) - n_tbd} of {len(reqs)} questions answered, "
         f"{n_tbd} open points, {n_find} wording findings", "",
         "| Rev | Date | Author | Change |", "|---|---|---|---|", f"| 0 | {today} | ___ | first draft from questionnaire |", "",
         "> How to use: every requirement has a stable ID, one sentence with 'shall' and a verification method.",
         "> Review each sentence, replace vague words (see chapter 14), add numbers with units, then hand",
         "> the URS to the suppliers. The integrator answers in the FDS (traceability CSV: FDS reference).", "",
         "Verification methods: **inspection** (look / check documents), **test** (measure under defined "
         "conditions), **analysis** (calculation / simulation), **demonstration** (show the function works).", ""]
    for no, title_c, code in CHAPTERS:
        L.append(f"## {no}. {title_c}")
        L.append("")
        if no == 1:
            L += ["This URS describes WHAT the owner needs from the flexible manufacturing system. HOW the "
                  "supplier meets it is written in the supplier's Functional Design Specification (FDS).", ""]
        if no == 14:
            break
        for r in (x for x in reqs if x["chapter"] == no):
            q = r["q"]
            flag = " **[TBD]**" if r["tbd"] else ""
            L.append(f"**{r['id']}**{flag} {r['text']}  ")
            L.append(f"*Source:* {q[0]} - {q[2]}  ")
            L.append(f"*Verification:* {r['method']} - {r['how']}")
            for f in r["findings"]:
                L.append(f"> Check wording: {f}")
            L.append("")
        if no == 13:
            L += ["Proposed standard acceptance tests (adapt and confirm):", "",
                  "- FAT: functions, sequences, fault reactions, E-stop, capacity run (e.g. 8 h) with real parts.",
                  "- SAT: availability run (e.g. 72 h); A = (T_run - T_owner - T_supplier) / (T_run - T_owner) "
                  ">= agreed target; stops caused by the owner are removed from the base.",
                  "- Cycle time: mean of >= 10 measured cycles <= guaranteed cycle time.",
                  "- Quality: Cpk = min(USL - mean, mean - LSL) / (3 s) >= 1.33 on key features over >= 50 parts.",
                  "- Interfaces: read / write test of the standard data block words 0-19 of every module.", ""]
    # chapter 14
    tbd = [r for r in reqs if r["tbd"]]
    L.append("### 14.1 Open points (TBD)")
    L.append("")
    if tbd:
        L += ["| URS ID | Question | Why it matters | Example answer | Owner | Due |", "|---|---|---|---|---|---|"]
        L += [f"| {r['id']} | {r['q'][0]} {r['q'][2]} | {r['q'][3]} | {r['q'][4]} | ___ | ___ |" for r in tbd]
    else:
        L.append("No open points - all 40 questions are answered.")
    L += ["", "### 14.2 Wording findings (vagueness checker)", ""]
    fr = [(r, f) for r in reqs for f in r["findings"]]
    if fr:
        L += ["| URS ID | Answer | Finding / rewrite hint |", "|---|---|---|"]
        L += [f"| {r['id']} | {r['answer'].replace('|', '/')} | {f} |" for r, f in fr]
    else:
        L.append("No vague words found and all numeric answers contain numbers.")
    L += ["", "---", "*Draft generated offline. All requirements must be reviewed by the owner before release.*", ""]
    return "\n".join(L)


def trace_rows(reqs):
    """Rows for the traceability CSV."""
    return [[r["id"], r["text"], "", r["method"], ""] for r in reqs]


def example_questionnaire():
    """Questionnaire dict filled with the example answers (5th field of QUEST)."""
    return {"format": FORMAT, "date": "2027-02-01", "project": "Example: crankcase FMS (VC10/20/30)",
            "answers": {q[0]: q[4] for q in QUEST}}


# ----------------------------------------------------------------------------- self-test
def selftest():
    """Checks of the embedded questions, the web copy, the generator and the vagueness checker."""
    t = SelfTest("urs_generator")
    ids = [q[0] for q in QUEST]
    t.equal("40 embedded questions q01..q40", ids, [f"q{k:02d}" for k in range(1, 41)])
    t.equal("every question has a URS rule", sorted(RULES), sorted(ids))
    if WEB_DATA.is_file():
        txt = WEB_DATA.read_text(encoding="utf-8")
        blk = txt[txt.find("export const QUEST"):]
        blk = blk[:blk.find("];")]
        web_ids = re.findall(r'\[\s*"(q\d\d)"', blk)
        t.equal("web/fmse_data.js QUEST has q01..q40", web_ids, [f"q{k:02d}" for k in range(1, 41)])
        web_rows = {}
        for line in re.findall(r'^\s*(\["q\d\d".*\]),\s*$', blk, re.M):
            try:
                row = json.loads(line)
                web_rows[row[0]] = row
            except json.JSONDecodeError:
                pass
        same = [q[0] for q in QUEST if web_rows.get(q[0]) == q]
        t.true("embedded questions identical to web copy", len(same) == 40,
               f"{40 - len(same)} differ - update QUEST in urs_generator.py" if len(same) != 40 else "")
    else:
        print("  SKIP  web/fmse_data.js not found (copy check)")
    reqs = build_requirements(example_questionnaire()["answers"])
    t.equal("40 requirements from example", len(reqs), 40)
    t.equal("no TBD in example", sum(r["tbd"] for r in reqs), 0)
    by_q = {r["q"][0]: r for r in reqs}
    t.equal("q01 -> URS-PRD-001", by_q["q01"]["id"], "URS-PRD-001")
    t.equal("q05 -> URS-PRD-005", by_q["q05"]["id"], "URS-PRD-005")
    t.equal("q40 -> URS-SCO-001", by_q["q40"]["id"], "URS-SCO-001")
    t.equal("q37 -> URS-ACC-001", by_q["q37"]["id"], "URS-ACC-001")
    t.true("every requirement has a valid method",
           all(r["method"] in ("inspection", "test", "analysis", "demonstration") for r in reqs))
    v = [w for w, _ in vague_findings("The cell shall be fast, reliable and user-friendly with approximately "
                                      "50 parts as soon as possible, state of the art")]
    for w in ("fast", "reliable", "user-friendly", "approximately", "as soon as possible", "state of the art"):
        t.true(f"vague word '{w}' found", w in v)
    t.equal("no false hit in 'Fastening, robustness, abouts'", vague_findings("Fastening robustness"), [])
    r2 = build_requirements({"q01": "Housings", "q02": "many"})
    t.equal("empty answers -> 38 TBD", sum(r["tbd"] for r in r2), 38)
    q02 = next(r for r in r2 if r["q"][0] == "q02")
    t.true("'many' as variety flagged (number expected)", any("number" in f for f in q02["findings"]))
    md = urs_markdown({"date": "x"}, reqs, "selftest")
    for no, title, _ in CHAPTERS:
        t.true(f"chapter {no} '{title}' present", f"## {no}. {title}" in md)
    t.equal("one Verification line per requirement", md.count("*Verification:*"), 40)
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/urs_generator.py tools/fmse/examples/questionnaire_example.json "
               "--out URS_draft.md --trace trace.csv\n"
               "  python tools/fmse/urs_generator.py --make-example my_questionnaire.json")
    ap.add_argument("questionnaire", nargs="?", help="questionnaire JSON exported by the web page")
    ap.add_argument("--out", help="URS draft Markdown file (default: URS_draft.md next to the questionnaire)")
    ap.add_argument("--trace", help="traceability CSV file (default: trace.csv next to the questionnaire)")
    ap.add_argument("--make-example", metavar="FILE", help="write a questionnaire with the example answers and exit")
    ap.add_argument("--examples", help="(not used by this tool; accepted for a common command line)")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if a.make_example:
        p = Path(a.make_example)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(example_questionnaire(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"Example questionnaire written: {p}")
        return 0
    if not a.questionnaire:
        ap.error("give a questionnaire JSON file (or --make-example / --selftest)")
    src = Path(a.questionnaire)
    meta, answers, warn = load_questionnaire(src)
    for w in warn:
        print(f"WARNING: {w}")
    reqs = build_requirements(answers)
    out = Path(a.out) if a.out else src.with_name("URS_draft.md")
    trace = Path(a.trace) if a.trace else src.with_name("trace.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(urs_markdown(meta, reqs, src.name), encoding="utf-8")
    write_csv(trace, ["URS ID", "requirement text", "FDS reference", "verification method", "test reference"],
              trace_rows(reqs))
    n_tbd = sum(r["tbd"] for r in reqs)
    print(f"URS draft written: {out}  ({len(reqs)} requirements, {n_tbd} open points TBD)")
    print(f"Traceability CSV written: {trace}")
    counts = {}
    for r in reqs:
        counts[r["method"]] = counts.get(r["method"], 0) + 1
    print("Verification methods: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    fr = [(r["id"], f) for r in reqs for f in r["findings"]]
    print(f"Wording findings: {len(fr)}")
    for rid, f in fr:
        print(f"  {rid}: {f}")
    return 0


if __name__ == "__main__":
    run_main(main)
