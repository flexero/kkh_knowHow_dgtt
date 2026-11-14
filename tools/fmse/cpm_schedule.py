#!/usr/bin/env python3
"""CPM project schedule (critical path method) for an FMS project. Offline, standard library only.

Input: the default 25-task FMS project from examples/item1_examples.json ("cpm_project"), or your
own CSV file (--tasks). CSV format (semicolon separated, header line optional):

    id;name;duration;predecessors
    T01;Need statement;2;
    T02;Questionnaire;4;T01
    T15;Virtual commissioning;4;T13,T14

  - duration in the project unit (weeks by default, decimals allowed)
  - predecessors = comma-separated ids (finish-to-start, no lag), empty for a start task
  - lines starting with '#' are ignored

Method (same as "_formulas" -> "cpm" in the shared JSON):
    1. topological sort (Kahn); a loop in the predecessors is reported as an error
    2. forward pass   ES = max(EF of predecessors) (0 for start tasks),  EF = ES + d
    3. backward pass  LF = min(LS of successors) (project end for end tasks),  LS = LF - d
    4. total float    TF = LS - ES ;  free float FF = min(ES of successors) - EF
    5. critical task  TF = 0 ; critical path = chain of critical tasks from start to end

Calendar: week w starts on  start_date + 7*w days. A task with ES = 2, EF = 6 runs from the
start of week 2 to the last day of week 5 (= start_date + 7*EF - 1 day).

Outputs: text table, critical path(s), optional CSV (--csv) and an offline HTML Gantt chart
(--html, one self-contained file with inline CSS + SVG, no internet needed).
"""

import argparse
import csv
import datetime as dt
import html
import sys
from pathlib import Path

from fmse_common import (DEFAULT_EXAMPLES, InputError, SelfTest, fmt_table, load_examples,
                         run_main, write_csv)

EPS = 1e-9


# ----------------------------------------------------------------------------- input
def tasks_from_json(cpm):
    """Convert the JSON 'cpm_project' section into a list of task dicts."""
    out = []
    for row in cpm.get("tasks", []):
        if len(row) < 4:
            raise InputError(f"cpm_project task {row!r}: needs [id, name, duration, [predecessors]]")
        out.append({"id": str(row[0]), "name": str(row[1]), "d": float(row[2]),
                    "pred": [str(p) for p in row[3]]})
    return out


def tasks_from_csv(path):
    """Read tasks from a semicolon CSV (see module help). Raises InputError with the line number."""
    p = Path(path)
    if not p.is_file():
        raise InputError(f"Task file not found: {p}")
    out = []
    with p.open("r", encoding="utf-8-sig", newline="") as fh:
        for ln, row in enumerate(csv.reader(fh, delimiter=";"), start=1):
            if not row or not "".join(row).strip() or row[0].strip().startswith("#"):
                continue
            if len(row) < 3:
                raise InputError(f"{p} line {ln}: need at least id;name;duration (got {';'.join(row)!r})")
            tid, name, dur = row[0].strip(), row[1].strip(), row[2].strip().replace(",", ".")
            preds = row[3] if len(row) > 3 else ""
            try:
                d = float(dur)
            except ValueError:
                if not out and ln == 1 or tid.lower() == "id":
                    continue  # header line
                raise InputError(f"{p} line {ln}: duration '{row[2]}' is not a number")
            if d < 0:
                raise InputError(f"{p} line {ln}: duration must be >= 0")
            if not tid:
                raise InputError(f"{p} line {ln}: empty task id")
            out.append({"id": tid, "name": name, "d": d,
                        "pred": [x.strip() for x in preds.replace(" ", ",").split(",") if x.strip()]})
    if not out:
        raise InputError(f"{p}: no tasks found")
    return out


def validate(tasks):
    """Check ids are unique and all predecessors exist."""
    seen = set()
    for t in tasks:
        if t["id"] in seen:
            raise InputError(f"task id '{t['id']}' is used twice")
        seen.add(t["id"])
        if t["d"] < 0:
            raise InputError(f"task {t['id']}: duration must be >= 0")
    for t in tasks:
        for p in t["pred"]:
            if p not in seen:
                raise InputError(f"task {t['id']}: predecessor '{p}' does not exist")
            if p == t["id"]:
                raise InputError(f"task {t['id']} is its own predecessor")


# ----------------------------------------------------------------------------- CPM core
def topo_sort(tasks):
    """Kahn topological sort. Returns ids in order; raises InputError naming a loop if one exists."""
    ids = [t["id"] for t in tasks]
    pred = {t["id"]: list(dict.fromkeys(t["pred"])) for t in tasks}
    succ = {i: [] for i in ids}
    for i in ids:
        for p in pred[i]:
            succ[p].append(i)
    indeg = {i: len(pred[i]) for i in ids}
    ready = [i for i in ids if indeg[i] == 0]
    order = []
    while ready:
        i = ready.pop(0)
        order.append(i)
        for s in succ[i]:
            indeg[s] -= 1
            if indeg[s] == 0:
                ready.append(s)
    if len(order) < len(ids):
        left = [i for i in ids if i not in order]
        raise InputError("loop in predecessors: " + " -> ".join(find_cycle(left, pred)))
    return order


def find_cycle(left, pred):
    """Return one cycle (list of ids, first = last) among the ids that could not be sorted."""
    left_set = set(left)
    start = left[0]
    path, pos = [], {}
    node = start
    while node not in pos:
        pos[node] = len(path)
        path.append(node)
        node = next(p for p in pred[node] if p in left_set)
    cyc = path[pos[node]:] + [node]
    return list(reversed(cyc))


def cpm(tasks):
    """Run the critical path method. Returns (result dict per id, order, total duration, succ map)."""
    validate(tasks)
    order = topo_sort(tasks)
    by = {t["id"]: t for t in tasks}
    succ = {t["id"]: [] for t in tasks}
    for t in tasks:
        for p in t["pred"]:
            succ[p].append(t["id"])
    r = {}
    for i in order:
        es = max((r[p]["EF"] for p in by[i]["pred"]), default=0.0)
        r[i] = {"ES": es, "EF": es + by[i]["d"]}
    total = max((x["EF"] for x in r.values()), default=0.0)
    for i in reversed(order):
        lf = min((r[s]["LS"] for s in succ[i]), default=total)
        r[i]["LF"] = lf
        r[i]["LS"] = lf - by[i]["d"]
    for i in order:
        x = r[i]
        x["TF"] = x["LS"] - x["ES"]
        x["FF"] = min((r[s]["ES"] for s in succ[i]), default=total) - x["EF"]
        x["critical"] = abs(x["TF"]) < EPS
    return r, order, total, succ


def critical_paths(r, order, total, succ, by, limit=50):
    """All chains of critical tasks from project start to project end (max 'limit' paths)."""
    starts = [i for i in order if r[i]["critical"] and abs(r[i]["ES"]) < EPS
              and not any(r[p]["critical"] and abs(r[p]["EF"] - r[i]["ES"]) < EPS for p in by[i]["pred"])]
    paths = []

    def walk(i, path):
        if len(paths) >= limit:
            return
        nxt = [s for s in succ[i] if r[s]["critical"] and abs(r[s]["ES"] - r[i]["EF"]) < EPS]
        if not nxt:
            if abs(r[i]["EF"] - total) < EPS:
                paths.append(path)
            return
        for s in nxt:
            walk(s, path + [s])

    for s in starts:
        walk(s, [s])
    return paths


def week_dates(start, es, ef, d):
    """Calendar start and finish date for a task (finish = last day of the last week)."""
    s = start + dt.timedelta(days=round(es * 7))
    if d <= EPS:
        return s, s
    return s, start + dt.timedelta(days=round(ef * 7) - 1)


def num(x):
    """Show 2.0 as '2' and 2.5 as '2.5'."""
    return str(int(round(x))) if abs(x - round(x)) < EPS else f"{x:.2f}".rstrip("0")


# ----------------------------------------------------------------------------- outputs
def result_rows(tasks, r, start):
    """Rows for the text table / CSV: id, name, d, pred, ES, EF, LS, LF, TF, FF, crit, dates."""
    rows = []
    for t in tasks:
        x = r[t["id"]]
        s, f = week_dates(start, x["ES"], x["EF"], t["d"])
        rows.append([t["id"], t["name"], num(t["d"]), ",".join(t["pred"]), num(x["ES"]), num(x["EF"]),
                     num(x["LS"]), num(x["LF"]), num(x["TF"]), num(x["FF"]),
                     "YES" if x["critical"] else "", s.isoformat(), f.isoformat()])
    return rows


HEAD = ["id", "name", "d", "pred", "ES", "EF", "LS", "LF", "TF", "FF", "crit", "start", "finish"]


def write_html(path, tasks, r, total, paths, start, unit, title):
    """Write a self-contained offline HTML Gantt chart (inline CSS + SVG, no external links)."""
    row_h, label_w, px = 22, 330, max(6, min(14, int(900 / max(total, 1))))
    width = label_w + int(total * px) + 40
    height = 40 + row_h * len(tasks) + 20
    svg = [f'<svg width="{width}" height="{height}" '
           f'viewBox="0 0 {width} {height}" role="img" aria-label="Gantt chart">']
    # week grid + labels
    step = 1 if total <= 30 else (4 if total <= 120 else 13)
    w = 0
    while w <= total + EPS:
        x = label_w + w * px
        svg.append(f'<line x1="{x}" y1="30" x2="{x}" y2="{height - 20}" class="grid"/>')
        svg.append(f'<text x="{x}" y="22" class="axis">{num(w)}</text>')
        w += step
    for k, t in enumerate(tasks):
        x = r[t["id"]]
        y = 40 + k * row_h
        if k % 2 == 0:
            svg.append(f'<rect x="0" y="{y - 3}" width="{width}" height="{row_h}" class="band"/>')
        label = html.escape(f"{t['id']}  {t['name']}")
        svg.append(f'<text x="6" y="{y + 12}" class="lbl">{label[:60]}</text>')
        bx = label_w + x["ES"] * px
        bw = max(t["d"] * px, 2)
        cls = "crit" if x["critical"] else "norm"
        tip = html.escape(f"{t['id']} {t['name']}: ES {num(x['ES'])}, EF {num(x['EF'])}, "
                          f"float {num(x['TF'])} {unit}")
        if x["TF"] > EPS:
            svg.append(f'<rect x="{label_w + x["EF"] * px}" y="{y + 5}" width="{x["TF"] * px}" height="6" '
                       f'class="float"><title>float {num(x["TF"])} {unit}</title></rect>')
        svg.append(f'<rect x="{bx}" y="{y}" width="{bw}" height="16" rx="3" class="{cls}">'
                   f'<title>{tip}</title></rect>')
    svg.append(f'<text x="{label_w}" y="{height - 4}" class="axis">{html.escape(unit)} from start '
               f'({start.isoformat()})</text>')
    svg.append("</svg>")
    rows = result_rows(tasks, r, start)
    trs = "\n".join("<tr{}>{}</tr>".format(' class="c"' if row[10] else "",
                                           "".join(f"<td>{html.escape(str(c))}</td>" for c in row))
                    for row in rows)
    end = week_dates(start, 0, total, total)[1]
    cp = "<br>".join(html.escape(" → ".join(p)) for p in paths) or "none"
    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
body{{font-family:Segoe UI,Arial,sans-serif;margin:16px;color:#222;background:#fff}}
h1{{font-size:20px;margin:0 0 6px}} .meta{{color:#555;margin-bottom:10px}}
.wrap{{overflow-x:auto;border:1px solid #ccc;padding:4px}}
.grid{{stroke:#ddd;stroke-width:1}} .axis{{font-size:10px;fill:#666}} .lbl{{font-size:11px;fill:#222}}
.band{{fill:#f6f6f6}} .crit{{fill:#d62828}} .norm{{fill:#4a7ab8}} .float{{fill:#b9cde6}}
table{{border-collapse:collapse;font-size:12px;margin-top:14px}} td,th{{border:1px solid #ccc;padding:2px 6px}}
th{{background:#eee}} tr.c td{{color:#b00000;font-weight:600}}
.key span{{display:inline-block;width:14px;height:10px;margin:0 4px 0 12px;vertical-align:middle}}
</style></head><body>
<h1>{html.escape(title)}</h1>
<div class="meta">Total duration: <b>{num(total)} {html.escape(unit)}</b> · start {start.isoformat()} ·
end {end.isoformat()} · {len(tasks)} tasks<br>Critical path: <b>{cp}</b></div>
<div class="key">Key:<span style="background:#d62828"></span>critical (float 0)
<span style="background:#4a7ab8"></span>not critical<span style="background:#b9cde6"></span>total float</div>
<div class="wrap">{''.join(svg)}</div>
<table><tr>{''.join(f'<th>{h}</th>' for h in HEAD)}</tr>
{trs}</table>
<p class="meta">ES/EF = early start/finish, LS/LF = late start/finish, TF = total float, FF = free float
(all in {html.escape(unit)}). Made offline by tools/fmse/cpm_schedule.py.</p>
</body></html>
"""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(doc, encoding="utf-8")
    return p


# ----------------------------------------------------------------------------- self-test
def selftest(path):
    """Asserts against a hand-worked forward / backward pass of the example project."""
    t = SelfTest("cpm_schedule")
    _, sec = load_examples(path, "cpm_project")
    tasks = tasks_from_json(sec)
    r, order, total, succ = cpm(tasks)
    by = {x["id"]: x for x in tasks}
    t.close("total duration (weeks)", total, 87)
    paths = critical_paths(r, order, total, succ, by)
    want = ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T12", "T13", "T15",
            "T19", "T20", "T21", "T22", "T23", "T25"]
    t.equal("one critical path", len(paths), 1)
    t.equal("critical path ids", paths[0] if paths else None, want)
    hand = {"T10": (27, 57, 3), "T11": (33, 55, 4), "T14": (33, 43, 12), "T16": (33, 43, 19),
            "T17": (41, 47, 12), "T18": (57, 59, 3), "T24": (71, 74, 1), "T25": (75, 87, 0)}
    for k, (es, ef, tf) in hand.items():
        t.true(f"{k} ES/EF/TF = {es}/{ef}/{tf}",
               (r[k]["ES"], r[k]["EF"], r[k]["TF"]) == (es, ef, tf),
               f"got {r[k]['ES']}/{r[k]['EF']}/{r[k]['TF']}")
    s, f = week_dates(dt.date(2027, 1, 4), 0, total, total)
    t.equal("project end date from 2027-01-04", f.isoformat(), "2028-09-03")  # hand: 2027-01-04 + 608 days
    # loop detection
    try:
        cpm([{"id": "A", "name": "a", "d": 1, "pred": ["C"]}, {"id": "B", "name": "b", "d": 1, "pred": ["A"]},
             {"id": "C", "name": "c", "d": 1, "pred": ["B"]}])
        t.true("loop is detected", False)
    except InputError as exc:
        t.true("loop is detected", "loop" in str(exc), str(exc))
    # two parallel critical paths
    r2, o2, tot2, s2 = cpm([{"id": "A", "name": "", "d": 2, "pred": []}, {"id": "B", "name": "", "d": 3, "pred": ["A"]},
                            {"id": "C", "name": "", "d": 3, "pred": ["A"]}, {"id": "D", "name": "", "d": 1, "pred": ["B", "C"]}])
    p2 = critical_paths(r2, o2, tot2, s2, {"A": {"pred": []}, "B": {"pred": ["A"]}, "C": {"pred": ["A"]},
                                           "D": {"pred": ["B", "C"]}})
    t.equal("two parallel critical paths", sorted(p2), [["A", "B", "D"], ["A", "C", "D"]])
    return t.finish()


# ----------------------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python tools/fmse/cpm_schedule.py --start 2027-01-04 --html gantt.html --csv cpm.csv\n"
               "  python tools/fmse/cpm_schedule.py --tasks my_project.csv --html my_gantt.html")
    ap.add_argument("--examples", default=str(DEFAULT_EXAMPLES), help="shared example JSON (default: %(default)s)")
    ap.add_argument("--tasks", help="CSV task file id;name;duration;predecessors (default: example project)")
    ap.add_argument("--start", default="2027-01-04", help="calendar date of week 0 (YYYY-MM-DD, default %(default)s)")
    ap.add_argument("--unit", help="duration unit text (default from JSON, else 'weeks')")
    ap.add_argument("--html", help="write an offline HTML Gantt chart to this file")
    ap.add_argument("--csv", help="write the result table to this CSV file")
    ap.add_argument("--title", default="FMS project schedule (CPM)", help="title of the HTML page")
    ap.add_argument("--selftest", action="store_true", help="run built-in checks and exit")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.examples)
    try:
        start = dt.date.fromisoformat(a.start)
    except ValueError:
        raise InputError(f"--start '{a.start}' is not a date like 2027-01-04")
    unit = a.unit or "weeks"
    if a.tasks:
        tasks = tasks_from_csv(a.tasks)
        src = a.tasks
    else:
        _, sec = load_examples(a.examples, "cpm_project")
        tasks = tasks_from_json(sec)
        unit = a.unit or sec.get("unit", "weeks")
        src = f"{a.examples} (cpm_project)"
    r, order, total, succ = cpm(tasks)
    by = {t["id"]: t for t in tasks}
    paths = critical_paths(r, order, total, succ, by)
    rows = result_rows(tasks, r, start)
    print(f"CPM SCHEDULE   source: {src}")
    print(f"{len(tasks)} tasks, unit = {unit}, week 0 starts {start.isoformat()} ({start.strftime('%A')})")
    print()
    print(fmt_table(HEAD, rows, "llrlrrrrrrlll"))
    print()
    end = week_dates(start, 0, total, total)[1]
    print(f"Total duration: {num(total)} {unit}   (end {end.isoformat()})")
    crit = [i for i in order if r[i]["critical"]]
    print(f"Critical tasks ({len(crit)}): {', '.join(crit)}")
    for k, p in enumerate(paths, 1):
        print(f"Critical path {k}: {' -> '.join(p)}   (sum of durations {num(sum(by[i]['d'] for i in p))})")
    near = sorted((i for i in order if 0 < r[i]["TF"] <= 4 + EPS), key=lambda i: r[i]["TF"])
    if near:
        print("Near-critical (float <= 4): " + ", ".join(f"{i} ({num(r[i]['TF'])})" for i in near))
    if a.csv:
        print(f"CSV written: {write_csv(a.csv, HEAD, rows)}")
    if a.html:
        print(f"HTML Gantt written: {write_html(a.html, tasks, r, total, paths, start, unit, a.title)}")
    return 0


if __name__ == "__main__":
    run_main(main)
