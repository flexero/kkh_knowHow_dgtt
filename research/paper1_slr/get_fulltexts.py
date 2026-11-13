"""Find and download open-access full texts for records marked I or U.

Usage: python research/paper1_slr/get_fulltexts.py <search_folder> <pdf_folder>
Asks OpenAlex for the open-access location of up to 50 works per request (few requests, no API key),
downloads PDFs that are freely available, and writes <search_folder>/fulltext_status.csv
(id, title, doi, oa_status, pdf_url, file, status). Paywalled papers are listed for manual retrieval
(university library). Only open-access copies are downloaded.
"""
import csv, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'


def api(params):
    url = 'https://api.openalex.org/works?' + urllib.parse.urlencode(params)
    for attempt in range(4):
        time.sleep(3)
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'slr-client'}), timeout=90))
        except urllib.error.HTTPError as e:
            if e.code in (401, 429) and attempt < 3:
                time.sleep(10 * (attempt + 1))
                continue
            raise


def download(url, path):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/pdf,*/*'})
        data = urllib.request.urlopen(req, timeout=120).read()
    except Exception as e:  # noqa: BLE001 - report any network problem as status
        return f'fail: {type(e).__name__}'
    if not data.startswith(b'%PDF'):
        return 'fail: not a PDF (landing page or blocked)'
    open(path, 'wb').write(data)
    return 'ok'


def main():
    search, pdf_dir = sys.argv[1], sys.argv[2]
    os.makedirs(pdf_dir, exist_ok=True)
    rows = [r for r in csv.DictReader(open(os.path.join(search, 'screening_decided.csv'), encoding='utf-8-sig'))
            if r['decision'] in ('I', 'U')]
    info = {}
    ids = [r['id'] for r in rows]
    for i in range(0, len(ids), 50):
        data = api({'filter': 'openalex:' + '|'.join(ids[i:i + 50]), 'per-page': 50,
                    'select': 'id,open_access,best_oa_location,locations'})
        for w in data['results']:
            info[w['id'].rsplit('/', 1)[-1]] = w
    out = []
    for r in rows:
        w = info.get(r['id'], {})
        oa = w.get('open_access') or {}
        urls = []
        for loc in [w.get('best_oa_location')] + (w.get('locations') or []):
            if loc and loc.get('pdf_url') and loc['pdf_url'] not in urls:
                urls.append(loc['pdf_url'])
        first = (r['authors'].split(';')[0].split()[-1] if r['authors'] else 'anon')
        name = re.sub(r'[^A-Za-z0-9]+', '_', f"{first}{r['year']}_{r['title'][:60]}").strip('_') + '.pdf'
        path = os.path.join(pdf_dir, name)
        status = 'no open-access PDF known'
        if os.path.exists(path):
            status = 'ok (already)'
        else:
            for u in urls:
                status = download(u, path)
                if status == 'ok':
                    break
                time.sleep(1)
        out.append({'id': r['id'], 'decision': r['decision'], 'title': r['title'], 'doi': r['doi'],
                    'oa_status': oa.get('oa_status', ''), 'pdf_url': urls[0] if urls else '',
                    'file': name if status.startswith('ok') else '', 'status': status})
        print(status[:40].ljust(42), r['title'][:70])
    with open(os.path.join(search, 'fulltext_status.csv'), 'w', newline='', encoding='utf-8-sig') as f:
        wr = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        wr.writeheader()
        wr.writerows(out)
    ok = sum(1 for x in out if x['file'])
    print(f'{ok} of {len(out)} full texts downloaded; others: see fulltext_status.csv')


if __name__ == '__main__':
    main()
