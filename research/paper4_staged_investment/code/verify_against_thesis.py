"""Check that the paper-4 engine reproduces the thesis staging experiment exactly (scenarios 1-40, beta = 0).

Compares data/main.csv with thesis/data/staging_b0.0.csv policy by policy (NPV to 1 EUR, final configuration).
"""
import csv
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
mine = {(int(r['scenario']), r['policy']): r for r in csv.DictReader(open(os.path.join(HERE, '..', 'data', 'main.csv'), encoding='utf-8'))}
thesis = list(csv.DictReader(open(os.path.join(HERE, '..', '..', '..', 'thesis', 'data', 'staging_b0.0.csv'), encoding='utf-8')))
bad = 0
for r in thesis:
    m = mine.get((int(r['scenario']), r['policy']))
    if m is None or abs(float(m['npv']) - float(r['npv'])) > 1.0 or m['final'] != r['final']:
        bad += 1
        print('MISMATCH', r['scenario'], r['policy'], r['npv'], m and m['npv'])
print(f'{len(thesis) - bad} of {len(thesis)} thesis rows reproduced exactly')
sys.exit(1 if bad else 0)
