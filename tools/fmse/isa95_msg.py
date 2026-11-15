#!/usr/bin/env python3
"""ISA-95 / B2MML-style example messages for the jobs of the cell-controller simulation: production order
(PROCESS), job order (PROCESS), ACKNOWLEDGE, production performance / confirmation (SHOW); a validator for the
required fields; an idempotency demo (the same message ID twice -> the second is ignored).

    *** FORMAT: B2MML-STYLE EXAMPLE. The element names follow the ISA-95 object model and the B2MML verb/noun
    *** idea (Process / Acknowledge / Show + ApplicationArea + DataArea), but this is NOT schema-validated
    *** B2MML. Check the B2MML schema version you use (e.g. V0600 / V0700) and map the fields to it.

Python 3 standard library only, offline. Inputs: section cell_sim of examples/item5_examples.json; the times
come from cell_controller_sim.py (scenario A): the job order is sent when the cell receives the JOB, the
acknowledge in the same minute, the performance message when the confirmation is sent (SEND_CONF).
Fixed example start time 2026-11-20T06:00:00Z (minute 0 of the simulation), so the output is deterministic.
Guide: docs/FMS system design/65_control_architecture.md (one pallet through all levels).

Message header (ApplicationArea): Sender, Receiver, CreationDateTime (UTC), BODID = message ID
"<sender>-<sequence 6 digits>", SequenceNumber = 1, 2, 3 ... per sender (the receiver can see gaps).
Idempotency: the receiver stores every processed BODID; a message with a known BODID is ignored (it is a
re-send after a lost acknowledge), so a confirmation is never booked twice.
"""

import argparse
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cell_controller_sim import check_cell, simulate
from fmse_common import ITEM5_EXAMPLES, InputError, SelfTest, fmt_table, load_examples, run_main, write_csv

BASE = datetime(2026, 11, 20, 6, 0, 0, tzinfo=timezone.utc)
NS = "http://www.mesa.org/xml/B2MML"
FORMAT_NOTE = "B2MML-style example - check the B2MML schema version you use; not schema-validated"
PARTY = {"ERP": "ERP", "MES": "MES", "CELL": "CELL-FMS1"}
HEADER_REQ = ["ApplicationArea.Sender.LogicalID", "ApplicationArea.Receiver.LogicalID",
              "ApplicationArea.CreationDateTime", "ApplicationArea.BODID", "ApplicationArea.SequenceNumber"]
BODY_REQ = {
    "ProcessProductionSchedule": ["DataArea.Process", "DataArea.ProductionSchedule.ID",
                                  "DataArea.ProductionSchedule.ProductionRequest.ID",
                                  "DataArea.ProductionSchedule.ProductionRequest.SegmentRequirement.ProcessSegmentID",
                                  "DataArea.ProductionSchedule.ProductionRequest.SegmentRequirement.Duration"],
    "ProcessJobOrder": ["DataArea.Process", "DataArea.JobOrder.ID", "DataArea.JobOrder.WorkMasterID",
                        "DataArea.JobOrder.ProductionRequestID", "DataArea.JobOrder.HierarchyScope.EquipmentID"],
    "AcknowledgeJobOrder": ["DataArea.Acknowledge.OriginalBODID", "DataArea.Acknowledge.ResponseCriteria",
                            "DataArea.JobOrder.ID"],
    "ShowProductionPerformance": ["DataArea.Show", "DataArea.ProductionPerformance.ID",
                                  "DataArea.ProductionPerformance.ProductionResponse.JobOrderID",
                                  "DataArea.ProductionPerformance.ProductionResponse.SegmentResponse.ActualStartTime",
                                  "DataArea.ProductionPerformance.ProductionResponse.SegmentResponse.ActualEndTime",
                                  "DataArea.ProductionPerformance.ProductionResponse.SegmentResponse.EquipmentActual.EquipmentID",
                                  "DataArea.ProductionPerformance.ProductionResponse.SegmentResponse.Quantity.QuantityString"],
}
TS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def ts(minute):
    return (BASE + timedelta(minutes=minute)).strftime("%Y-%m-%dT%H:%M:%SZ")


def dur(minutes):
    return f"PT{minutes}M"


# ----------------------------------------------------------------------------- build the messages
def job_times(C):
    """From the scenario-A log: per job {job, start, done, machine, pallet, conf} (minutes)."""
    r = simulate(C)
    info = {}
    for line in r["log"]:
        p = line.split()
        t, ev = int(p[0]), p[1]
        if ev == "JOB":
            info.setdefault(p[2], {})["job"] = t
        elif ev == "START":
            info.setdefault(p[4], {}).update(start=t, machine=p[2], pallet=p[3])
        elif ev == "DONE":
            info.setdefault(p[4], {})["done"] = t
        elif ev == "SEND_CONF":
            info.setdefault(p[2], {})["conf"] = t
    return info


def build(C):
    """All messages in time order: list of dicts {type, job, t, sender, receiver, msg (dict)}."""
    info = job_times(C)
    jobs = {j[0]: j for j in C["jobs"]}
    seq = {k: 0 for k in PARTY}
    events = []                                             # (t, order, kind, job)
    for k, j in enumerate(C["jobs"]):
        events.append((0, 0, k, "PO", j[0]))
        if "job" in info.get(j[0], {}):
            events.append((info[j[0]]["job"], 1, k, "JO", j[0]))
        if "conf" in info.get(j[0], {}):
            events.append((info[j[0]]["conf"], 3, k, "PP", j[0]))
    events.sort()
    out, jo_bodid = [], {}

    def header(sender, receiver, t):
        seq[sender] += 1
        bodid = f"{sender}-{seq[sender]:06d}"
        return bodid, {"Sender": {"LogicalID": PARTY[sender]}, "Receiver": {"LogicalID": PARTY[receiver]},
                       "CreationDateTime": ts(t), "BODID": bodid, "SequenceNumber": seq[sender]}

    for t, _, _, kind, jid in events:
        _, prog, mins = jobs[jid]
        if kind == "PO":
            bodid, aa = header("ERP", "MES", t)
            m = {"ApplicationArea": aa, "DataArea": {"Process": {}, "ProductionSchedule": {
                "ID": f"PS-{jid}", "ProductionRequest": {
                    "ID": f"PO-{jid}", "Description": f"production order for job {jid}",
                    "SegmentRequirement": {"ProcessSegmentID": prog, "EarliestStartTime": ts(0),
                                           "Duration": dur(mins),
                                           "Quantity": {"QuantityString": "1", "UnitOfMeasure": "pallet"}}}}}}
            out.append({"type": "ProcessProductionSchedule", "job": jid, "t": t, "sender": "ERP",
                        "receiver": "MES", "msg": m})
        elif kind == "JO":
            bodid, aa = header("MES", "CELL", t)
            jo_bodid[jid] = bodid
            m = {"ApplicationArea": aa, "DataArea": {"Process": {}, "JobOrder": {
                "ID": jid, "ProductionRequestID": f"PO-{jid}", "WorkMasterID": prog,
                "HierarchyScope": {"EquipmentID": "FMS1", "EquipmentElementLevel": "WorkCell"},
                "PlannedDuration": dur(mins), "DispatchStatus": "Released"}}}
            out.append({"type": "ProcessJobOrder", "job": jid, "t": t, "sender": "MES", "receiver": "CELL", "msg": m})
            _, aa = header("CELL", "MES", t)
            m = {"ApplicationArea": aa, "DataArea": {"Acknowledge": {"OriginalBODID": bodid,
                                                                     "ResponseCriteria": "Accepted"},
                                                     "JobOrder": {"ID": jid}}}
            out.append({"type": "AcknowledgeJobOrder", "job": jid, "t": t, "sender": "CELL", "receiver": "MES",
                        "msg": m})
        else:
            i = info[jid]
            _, aa = header("CELL", "MES", t)
            m = {"ApplicationArea": aa, "DataArea": {"Show": {}, "ProductionPerformance": {
                "ID": f"PP-{jid}", "ProductionResponse": {
                    "ID": f"RESP-{jid}", "ProductionRequestID": f"PO-{jid}", "JobOrderID": jid,
                    "ProductionState": "Completed",
                    "SegmentResponse": {"ProcessSegmentID": prog, "ActualStartTime": ts(i["start"]),
                                        "ActualEndTime": ts(i["done"]),
                                        "EquipmentActual": {"EquipmentID": i["machine"]},
                                        "PalletID": i["pallet"],
                                        "Quantity": {"QuantityString": "1", "UnitOfMeasure": "pallet"}}}}}}
            out.append({"type": "ShowProductionPerformance", "job": jid, "t": t, "sender": "CELL", "receiver": "MES",
                        "msg": m})
    return out


# ----------------------------------------------------------------------------- render
def to_json(e):
    return json.dumps({"_format": FORMAT_NOTE, e["type"]: e["msg"]}, indent=2, ensure_ascii=False)


def _xml(parent, key, val):
    el = ET.SubElement(parent, key)
    if isinstance(val, dict):
        for k, v in val.items():
            _xml(el, k, v)
    else:
        el.text = str(val)


def to_xml(e):
    root = ET.Element(e["type"], {"xmlns": NS, "releaseID": "example"})
    for k, v in e["msg"].items():
        _xml(root, k, v)
    ET.indent(root, "  ")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<!-- {FORMAT_NOTE} -->\n' + ET.tostring(root, "unicode")


# ----------------------------------------------------------------------------- validator + idempotency
def get(d, path):
    for k in path.split("."):
        if not isinstance(d, dict) or k not in d:
            return None
        d = d[k]
    return d


def validate(mtype, msg):
    """Return a list of errors (empty = valid)."""
    if mtype not in BODY_REQ:
        return [f"unknown message type '{mtype}'"]
    err = []
    for p in HEADER_REQ + BODY_REQ[mtype]:
        v = get(msg, p)
        if v is None or (v == "" and not p.endswith(("Process", "Show"))):
            err.append(f"missing {p}")
    for p in ("ApplicationArea.CreationDateTime",
              "DataArea.ProductionPerformance.ProductionResponse.SegmentResponse.ActualStartTime",
              "DataArea.ProductionPerformance.ProductionResponse.SegmentResponse.ActualEndTime"):
        v = get(msg, p)
        if v is not None and not TS_RE.match(str(v)):
            err.append(f"{p} '{v}' is not UTC time YYYY-MM-DDThh:mm:ssZ")
    s = get(msg, "ApplicationArea.SequenceNumber")
    if s is not None and (not isinstance(s, int) or s < 1):
        err.append("ApplicationArea.SequenceNumber must be an integer >= 1")
    a = get(msg, "DataArea.ProductionPerformance.ProductionResponse.SegmentResponse.ActualStartTime")
    b = get(msg, "DataArea.ProductionPerformance.ProductionResponse.SegmentResponse.ActualEndTime")
    if a and b and TS_RE.match(str(a)) and TS_RE.match(str(b)) and b < a:
        err.append("ActualEndTime before ActualStartTime")
    return err


class Receiver:
    """MES side: books each confirmation once; duplicates (same BODID) are ignored; sequence gaps reported."""

    def __init__(self):
        self.seen, self.last_seq, self.booked = set(), {}, []

    def receive(self, e):
        aa = e["msg"]["ApplicationArea"]
        bod, snd, sq = aa["BODID"], aa["Sender"]["LogicalID"], aa["SequenceNumber"]
        if bod in self.seen:
            return f"{bod} DUPLICATE - ignored (already processed), acknowledge again"
        errs = validate(e["type"], e["msg"])
        if errs:
            return f"{bod} REJECTED - {errs[0]}"
        note = ""
        last = self.last_seq.get(snd)
        if last is not None and sq != last + 1:
            note = f" (sequence gap: expected {last + 1}, got {sq} - ask the sender for the missing ones)"
        self.last_seq[snd] = max(sq, last or 0)
        self.seen.add(bod)
        if e["type"] == "ShowProductionPerformance":
            self.booked.append(e["job"])
            return f"{bod} processed: confirmation of job {e['job']} booked{note}"
        return f"{bod} processed: {e['type']} job {e['job']}{note}"


def idempotency_demo(msgs, n_show=2):
    """Feed the cell's messages (in order) up to the n_show-th confirmation; the first confirmation is
    received twice (re-send). Returns (result lines, booked jobs)."""
    order, shows = [], 0
    for e in msgs:
        if e["sender"] != "CELL":
            continue
        order.append(e)
        if e["type"] == "ShowProductionPerformance":
            shows += 1
            if shows == 1:
                order.append(e)                    # the re-send with the same BODID
            if shows == n_show:
                break
    rx = Receiver()
    return [rx.receive(e) for e in order], rx.booked


# ----------------------------------------------------------------------------- output
def show(C, fmt, job, out_dir, csv_path):
    msgs = build(C)
    if not any(e["job"] == job for e in msgs):
        raise InputError(f"--job {job}: no messages (jobs: {', '.join(j[0] for j in C['jobs'])})")
    print(f"ISA-95 MESSAGES FOR THE CELL-SIM JOBS  (scenario A, minute 0 = {ts(0)})")
    print(f"*** {FORMAT_NOTE} ***")
    print()
    rows = [[k, e["msg"]["ApplicationArea"]["CreationDateTime"][11:16], e["t"], e["type"],
             f"{e['sender']}->{e['receiver']}", e["msg"]["ApplicationArea"]["BODID"],
             e["msg"]["ApplicationArea"]["SequenceNumber"], e["job"]] for k, e in enumerate(msgs, 1)]
    print(fmt_table(["#", "time", "min", "message", "from->to", "BODID (message ID)", "seq", "job"], rows, "rrrlllrl"))
    n_err = 0
    for e in msgs:
        n_err += len(validate(e["type"], e["msg"]))
    print(f"\n  {len(msgs)} messages; validator: {n_err} errors")
    sel = [e for e in msgs if e["job"] == job]
    if not sel:
        raise InputError(f"--job {job}: no messages (jobs: {', '.join(j[0] for j in C['jobs'])})")
    print()
    print(f"ALL MESSAGES OF JOB {job}  ({fmt.upper()})")
    for e in sel:
        print()
        print(to_xml(e) if fmt == "xml" else to_json(e))
    print()
    print("VALIDATOR DEMO  (required fields per message type)")
    bad = json.loads(json.dumps(sel[-1]["msg"]))
    sr = get(bad, "DataArea.ProductionPerformance.ProductionResponse.SegmentResponse")
    if sr is not None:
        del sr["ActualEndTime"]
    bad["ApplicationArea"]["CreationDateTime"] = "20.11.2026 06:44"
    for x in validate(sel[-1]["type"], bad):
        print(f"  broken copy of {sel[-1]['msg']['ApplicationArea']['BODID']}: {x}")
    print()
    print("IDEMPOTENCY DEMO  (the cell re-sends a confirmation because the acknowledge was lost)")
    lines, booked = idempotency_demo(msgs)
    for k, ln in enumerate(lines, 1):
        print(f"  receive {k}: {ln}")
    print(f"  booked confirmations: {', '.join(booked)}  (each job once)")
    if out_dir:
        d = Path(out_dir)
        d.mkdir(parents=True, exist_ok=True)
        for k, e in enumerate(msgs, 1):
            name = f"{k:03d}_{e['msg']['ApplicationArea']['BODID']}_{e['type']}_{e['job']}.{fmt}"
            (d / name).write_text(to_xml(e) if fmt == "xml" else to_json(e), encoding="utf-8")
        print(f"\n{len(msgs)} message files written to {d}")
    if csv_path:
        p = write_csv(csv_path, ["no", "time", "minute", "message", "from_to", "bodid", "seq", "job"], rows)
        print(f"\nCSV written: {p}")
    return msgs


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    t = SelfTest("isa95_msg")
    _, C = load_examples(path, "cell_sim")
    check_cell(C)
    msgs = build(C)
    t.equal("12 jobs x 4 messages = 48", len(msgs), 48)
    t.equal("all messages valid", sum(len(validate(e["type"], e["msg"])) for e in msgs), 0)
    j1 = [e for e in msgs if e["job"] == "J01"]
    t.equal("J01: PO, job order, ack, performance",
            [e["type"] for e in j1], ["ProcessProductionSchedule", "ProcessJobOrder", "AcknowledgeJobOrder",
                                      "ShowProductionPerformance"])
    t.equal("J01 job order at minute 0 (log '0 JOB J01')", j1[1]["t"], 0)
    sr = get(j1[3]["msg"], "DataArea.ProductionPerformance.ProductionResponse.SegmentResponse")
    t.equal("J01 start 06:12 (log '12 START MC01 P1 J01')", sr["ActualStartTime"], "2026-11-20T06:12:00Z")
    t.equal("J01 end 06:42 (12 + 30 min)", sr["ActualEndTime"], "2026-11-20T06:42:00Z")
    t.equal("J01 machine MC01", sr["EquipmentActual"]["EquipmentID"], "MC01")
    t.equal("J01 confirmation at minute 44 (ARRIVE_LS + SEND_CONF)", j1[3]["t"], 44)
    t.equal("ack refers to the job-order BODID", j1[2]["msg"]["DataArea"]["Acknowledge"]["OriginalBODID"],
            j1[1]["msg"]["ApplicationArea"]["BODID"])
    t.equal("first ERP message ID", msgs[0]["msg"]["ApplicationArea"]["BODID"], "ERP-000001")
    ids = [e["msg"]["ApplicationArea"]["BODID"] for e in msgs]
    t.equal("message IDs unique", len(set(ids)), 48)
    ok = True
    for snd in PARTY:
        sq = [e["msg"]["ApplicationArea"]["SequenceNumber"] for e in msgs if e["sender"] == snd]
        ok &= sq == list(range(1, len(sq) + 1))
    t.true("sequence numbers 1, 2, 3 ... per sender without gaps", ok)
    t.true("messages in time order", all(msgs[k]["t"] <= msgs[k + 1]["t"] for k in range(47)))
    bad = json.loads(json.dumps(j1[3]["msg"]))
    del bad["DataArea"]["ProductionPerformance"]["ProductionResponse"]["SegmentResponse"]["ActualEndTime"]
    t.equal("validator: missing ActualEndTime found", len(validate(j1[3]["type"], bad)), 1)
    bad["ApplicationArea"]["CreationDateTime"] = "today"
    t.equal("validator: bad timestamp found too", len(validate(j1[3]["type"], bad)), 2)
    lines, booked = idempotency_demo(msgs)
    k1 = next(k for k, ln in enumerate(lines) if "booked" in ln)
    t.true("idempotency: second receive of the same ID ignored", "DUPLICATE" in lines[k1 + 1])
    t.true("idempotency: no sequence gap in the cell's messages", not any("gap" in ln for ln in lines))
    t.equal("idempotency: each job booked once", len(booked), len(set(booked)))
    x = to_xml(j1[1])
    t.true("XML parses and carries the format note", ET.fromstring(x.split("-->", 1)[1]) is not None
           and "B2MML-style example" in x)
    t.true("JSON parses", json.loads(to_json(j1[1]))["ProcessJobOrder"]["DataArea"]["JobOrder"]["ID"] == "J01")
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python tools/fmse/isa95_msg.py                     (list + J01 messages in XML)\n"
               "  python tools/fmse/isa95_msg.py --json --job J05\n"
               "  python tools/fmse/isa95_msg.py --xml --out msgs_xml --csv messages.csv")
    ap.add_argument("--examples", default=str(ITEM5_EXAMPLES), help="example JSON (default: %(default)s)")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--xml", action="store_true", help="show the messages as XML (default)")
    g.add_argument("--json", action="store_true", help="show the messages as JSON")
    ap.add_argument("--job", default="J01", help="job whose messages are printed in full (default J01)")
    ap.add_argument("--out", help="write every message as a file into this folder")
    ap.add_argument("--csv", help="write the message list to this CSV file")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    _, C = load_examples(a.examples, "cell_sim")
    check_cell(C)
    show(C, "json" if a.json else "xml", a.job, a.out, a.csv)
    return 0


if __name__ == "__main__":
    run_main(main)
