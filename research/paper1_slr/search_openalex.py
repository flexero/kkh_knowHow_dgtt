"""Supplementary SLR search in OpenAlex (free, open database) - stdlib only.

Runs search strings S1-S3 of Doctor paper/51_slr_protocol.md (OpenAlex syntax), removes duplicates,
and writes into an output folder:
  records.ris       -> import into Zotero (File > Import)
  screening.csv     -> open in Excel / LibreOffice, fill 'decision' and 'reason'
  search_log.txt    -> date, exact strings, hit counts (copy into protocol section 10)

Usage:  python research/paper1_slr/search_openalex.py [output_folder]
Needs internet. Without an OpenAlex API key the daily budget is small; one run uses about 6-10 requests.
The 'priority' column is only a keyword score to sort the list - it is NOT a screening decision.
"""
import csv, datetime, json, os, sys, time, urllib.error, urllib.parse, urllib.request

A = '("digital twin" OR "digital shadow" OR "virtual factory" OR "discrete event simulation")'
B = '("flexible manufacturing" OR "manufacturing system" OR "production system" OR "machining line" OR CNC)'
C = {
    'S1': '(uncertainty OR bayesian OR calibration OR "parameter updating" OR "data assimilation" OR "live fitting")',
    'S2': '("ramp-up" OR "ramp up" OR commissioning OR "factory design" OR "system design" OR "factory planning")',
    'S3': '(SME OR "small and medium" OR "emerging economies" OR "developing countries" OR "low-cost" OR legacy OR retrofit OR Modbus)',
}
FILTER_TAIL = ',publication_year:2015-<this year>,type:article|review'
PRIORITY_TERMS = {  # keyword -> weight (sorting help only)
    'flexible manufacturing': 3, 'ramp-up': 3, 'ramp up': 3, 'bayesian': 3, 'input uncertainty': 3,
    'calibration': 2, 'uncertainty': 2, 'commissioning': 2, 'sme': 2, 'small and medium': 2,
    'developing countr': 2, 'emerging econom': 2, 'legacy': 2, 'retrofit': 2, 'modbus': 3, 'low-cost': 2,
    'design': 1, 'validation': 1, 'real data': 1, 'case study': 1, 'machining': 1, 'cnc': 1,
}


def api(params):
    url = 'https://api.openalex.org/works?' + urllib.parse.urlencode(params)
    for attempt in range(4):
        time.sleep(3)  # OpenAlex: max 1 request/s for long boolean queries without API key
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'slr-client'})
            return json.load(urllib.request.urlopen(req, timeout=90))
        except urllib.error.HTTPError as e:
            if e.code in (401, 429) and attempt < 3:
                time.sleep(10 * (attempt + 1))
                continue
            print('OpenAlex error', e.code, e.read()[:400])
            raise


def abstract(inv):
    if not inv:
        return ''
    pos = {}
    for word, idx in inv.items():
        for i in idx:
            pos[i] = word
    return ' '.join(pos[i] for i in sorted(pos))


SELECT = 'id,doi,title,publication_year,type,primary_location,authorships,abstract_inverted_index,cited_by_count'


def fetch_years(query, y1, y2):
    """One page of max 200; if more hits, split the year range (no cursor paging -> no API key needed)."""
    flt = f'title_and_abstract.search:{query},publication_year:{y1}-{y2},type:article|review'
    data = api({'filter': flt, 'per-page': 200, 'select': SELECT})
    n = data['meta']['count']
    if n <= 200 or y1 == y2:
        if n > 200:
            print(f'  warning: {n} hits in {y1}, only 200 downloaded')
        return n, data['results']
    mid = (y1 + y2) // 2
    n1, r1 = fetch_years(query, y1, mid)
    n2, r2 = fetch_years(query, mid + 1, y2)
    return n1 + n2, r1 + r2


def fetch(string_id):
    query = f'{A} AND {B} AND {C[string_id]}'
    count, out = fetch_years(query, 2015, datetime.date.today().year)
    return query, count, out


def main():
    today = datetime.date.today().isoformat()
    folder = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), f'search_{today}')
    os.makedirs(folder, exist_ok=True)
    records, log = {}, [f'OpenAlex search {today}', f'Filter tail: {FILTER_TAIL}', '']
    for sid in C:
        query, count, items = fetch(sid)
        log += [f'{sid}: hits {count}, downloaded {len(items)}', f'  title_and_abstract.search: {query}', '']
        print(sid, count, len(items))
        for w in items:
            r = records.setdefault(w['id'], {'w': w, 'strings': []})
            r['strings'].append(sid)
    log.append(f'Unique records after duplicate removal: {len(records)}')

    rows = []
    for key, r in records.items():
        w = r['w']
        loc = w.get('primary_location') or {}
        venue = ((loc.get('source') or {}).get('display_name')) or ''
        authors = [a['author']['display_name'] for a in w.get('authorships', []) if a.get('author')]
        ab = abstract(w.get('abstract_inverted_index'))
        text = ((w.get('title') or '') + ' ' + ab).lower()
        prio = sum(v for k, v in PRIORITY_TERMS.items() if k in text)
        rows.append({'id': key.rsplit('/', 1)[-1], 'strings': '+'.join(r['strings']), 'priority': prio,
                     'year': w.get('publication_year'), 'title': w.get('title') or '', 'authors': '; '.join(authors),
                     'venue': venue, 'type': w.get('type'), 'doi': (w.get('doi') or '').replace('https://doi.org/', ''),
                     'cited_by': w.get('cited_by_count', 0), 'has_abstract': 'yes' if ab else 'no',
                     'abstract': ab, 'decision': '', 'reason': ''})
    rows.sort(key=lambda x: (-x['priority'], -(x['year'] or 0)))

    with open(os.path.join(folder, 'screening.csv'), 'w', newline='', encoding='utf-8-sig') as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(rows)
    with open(os.path.join(folder, 'records.ris'), 'w', encoding='utf-8') as f:
        for x in rows:
            f.write('TY  - JOUR\n' if x['type'] != 'review' else 'TY  - JOUR\nN1  - review\n')
            f.write(f"TI  - {x['title']}\n")
            for a in x['authors'].split('; '):
                if a:
                    f.write(f'AU  - {a}\n')
            f.write(f"PY  - {x['year']}\nT2  - {x['venue']}\n")
            if x['doi']:
                f.write(f"DO  - {x['doi']}\n")
            if x['abstract']:
                f.write(f"AB  - {x['abstract']}\n")
            f.write(f"KW  - SLR-{x['strings']}\nN1  - OpenAlex {x['id']}\nER  - \n\n")
    with open(os.path.join(folder, 'search_log.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(log) + '\n')
    no_ab = sum(1 for x in rows if x['has_abstract'] == 'no')
    print(f'unique {len(rows)}, without abstract {no_ab}, written to {folder}')


if __name__ == '__main__':
    main()
