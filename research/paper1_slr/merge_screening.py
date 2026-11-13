"""Merge title/abstract screening decisions into the screening sheet and print PRISMA counts.

Usage: python research/paper1_slr/merge_screening.py <search_folder> <decisions_folder>
  <search_folder>/screening.csv           (from search_openalex.py)
  <decisions_folder>/decisions*.csv       (id,decision,reason,sq,note)
Writes <search_folder>/screening_decided.csv and <search_folder>/prisma_counts.txt
"""
import collections, csv, glob, os, sys

search, dec_folder = sys.argv[1], sys.argv[2]
rows = list(csv.DictReader(open(os.path.join(search, 'screening.csv'), encoding='utf-8-sig')))
dec = {}
for fn in sorted(glob.glob(os.path.join(dec_folder, 'decisions*.csv'))):
    for d in csv.DictReader(open(fn, encoding='utf-8-sig')):
        dec[d['id'].strip()] = d
missing = [r['id'] for r in rows if r['id'] not in dec]
for r in rows:
    d = dec.get(r['id'], {})
    r['decision'] = (d.get('decision') or '').strip().upper()
    r['reason'] = (d.get('reason') or '').strip().upper()
    r['sq'] = (d.get('sq') or '').strip()
    r['note'] = (d.get('note') or '').strip()
    r['screened_by'] = ('correction (Claude check)' if 'Duplicate' in (d.get('note') or '') or 'Harmonised' in (d.get('note') or '') else 'AI pre-screen (verify)') if d else ''
fields = ['id', 'decision', 'reason', 'sq', 'note', 'screened_by', 'priority', 'year', 'title', 'authors', 'venue',
          'type', 'doi', 'cited_by', 'has_abstract', 'strings', 'abstract']
order = {'I': 0, 'U': 1, 'E': 2, '': 3}
rows.sort(key=lambda r: (order.get(r['decision'], 3), -int(r['priority'] or 0)))
with open(os.path.join(search, 'screening_decided.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
    w.writeheader()
    w.writerows(rows)
c = collections.Counter(r['decision'] for r in rows)
reasons = collections.Counter(r['reason'] for r in rows if r['decision'] == 'E')
sq = collections.Counter(s for r in rows if r['decision'] in 'IU' and r['decision'] for s in r['sq'].split(';') if s)
lines = [f'Records screened (title/abstract): {len(rows)}', f'Missing decisions: {len(missing)} {missing[:10]}',
         f"Included (I): {c['I']}", f"Unsure (U, to full text): {c['U']}", f"Excluded (E): {c['E']}"]
lines += [f'  {k}: {v}' for k, v in sorted(reasons.items())]
lines += [f'To full-text assessment (I + U): {c["I"] + c["U"]}', 'Review questions among I+U:']
lines += [f'  {k}: {v}' for k, v in sorted(sq.items())]
open(os.path.join(search, 'prisma_counts.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('\n'.join(lines))
