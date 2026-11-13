"""Fill the measurement placeholders of chapter 5 from the campaign data (run once after commbench/httpbench)."""
import json
import os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
runs = [json.loads(l) for l in open('data/comm_runs.jsonl')]
h = json.load(open('data/http_bench.json'))
tot = sum(r['events'] for r in runs)

rows = ["**Table 5.3** Measurement results, 60 s per run, 36-register FC03 polls [measured; PLC timing emulated].",
        "| $N$ | Polling | $P$ [s] | $t_{scan}$ [ms] | Cycle mean / p95 [ms] | Achieved rate [Hz] | RTT median / p99 [ms] "
        "| Events | State-only: changes reported | Event block: loss | Latency mean / p95 / max [s] |",
        "|---|---|---|---|---|---|---|---|---|---|---|"]
for r in runs:
    rows.append("| {N} | {mode} | {P} | {scan:.0f} | {cm:.1f} / {cp:.1f} | {rate:.2f} | {rm:.2f} / {rp:.2f} | {ev} | {S:.1f} % | "
                "{R:.2f} % | {lm:.2f} / {lp:.2f} / {lx:.2f} |".format(
                    N=r['N'], mode='sequential' if r['mode'] == 'seq' else 'parallel', P=r['period_s'],
                    scan=r['plc_scan_ms'], cm=1000 * r['cycle_mean_s'], cp=1000 * r['cycle_p95_s'],
                    rate=r['achieved_rate_hz'], rm=r['rtt_median_ms'], rp=r['rtt_p99_ms'], ev=r['events'],
                    S=100 * r['S_share_reported'], R=100 * r['R_loss'], lm=r['lat_R_mean_s'], lp=r['lat_R_p95_s'],
                    lx=r['lat_R_max_s']))
table = '\n'.join(rows)

text = open('code/ch05_text_results.md', encoding='utf-8').read().replace('{TOTAL}', f'{tot:,}')

http_rows = [f"**Table 5.4** HTTP/JSON API on the same PC, 10 s per configuration, keep-alive connections [measured].",
             "| Request | Clients | Requests/s | Median latency [ms] | p99 latency [ms] |", "|---|---|---|---|---|"]
for kind, label in (('GET', f"GET /api/state (160 machines, {h['snapshot_bytes'] / 1000:.1f} kB JSON)"),
                    ('POST', 'POST /api/event (MES booking)')):
    for i, k in enumerate((1, 4, 16)):
        d = h[f'{kind}_k{k}']
        http_rows.append(f"| {label if i == 0 else ''} | {k} | {d['req_per_s']:,.0f} | {d['median_ms']} | {d['p99_ms']} |")
http_table = '\n'.join(http_rows) + '\n\n' + open('code/ch05_text_http.md', encoding='utf-8').read()

p = 'ch05_architecture.md'
s = open(p, encoding='utf-8').read()
s = s.replace('{TABLE_RUNS}', table).replace('{TEXT_RESULTS}', text).replace('{TABLE_HTTP}', http_table)
s = s.replace('{TEXT_H1}', open('code/ch05_text_h1.md', encoding='utf-8').read())
s = s.replace('{TEXT_SUMMARY}', open('code/ch05_text_summary.md', encoding='utf-8').read())
open(p, 'w', encoding='utf-8').write(s)
print('events', tot, 'words', len(s.split()), 'placeholders left', s.count('{TABLE') + s.count('{TEXT'))
