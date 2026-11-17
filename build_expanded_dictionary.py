#!/usr/bin/env python3
"""Regenerate the v0.5.5 bundled master; pure Python, no remote inputs.

Only the approved, compact vocabulary and symmetric pair sources are used. This
never changes original IDs/definitions/grammar or invents grammar usages.
"""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'content'
BASE = json.loads((SOURCE / 'v055_base_master.json').read_text())
NEW = json.loads((SOURCE / 'v055_new_words.json').read_text())
PAIRS = json.loads((SOURCE / 'v055_synonym_pairs.json').read_text())

cards = [dict(c) for c in BASE['cards']] + [{**c, 'source': 'HSK 3.0 vocabulary', 'createdAt': '2026-11-17T00:00:00.000Z'} for c in NEW]
assert len(cards) == 11760, len(cards)
ids = {c['id'] for c in cards}
assert len(ids) == len(cards), 'Duplicate vocabulary IDs'
assert len({c['hanzi'] for c in cards}) == len(cards), 'Duplicate Chinese headwords'
synonyms = defaultdict(list)
seen = set()
for a, b, score in PAIRS:
    assert a != b and a in ids and b in ids, (a, b)
    assert isinstance(score, (int, float)) and 0 < score <= 1
    key = tuple(sorted((a, b)))
    assert key not in seen, ('Duplicate pair', key)
    seen.add(key)
    synonyms[a].append({'id': b, 'similarity': score})
    synonyms[b].append({'id': a, 'similarity': score})

for c in cards:
    relations = synonyms.get(c['id'])
    if relations:
        c['synonyms'] = sorted(relations, key=lambda p: (-p['similarity'], p['id']))
    assert isinstance(c['tags'], list) and c['pinyin'] and c['english']

master = {**BASE, 'title': 'Cíyán master collection',
          'description': 'Single bundled vocabulary dictionary with HSK 3.0, topic tags and scored synonyms; curated grammar retained.',
          'cards': cards}
out = ROOT / 'decks' / 'all-decks.json'
out.write_text(json.dumps(master, ensure_ascii=False, indent=2) + '\n')
# The canonical HSK lookup must include all newly imported advanced entries.
hsk = {}
for card in cards:
    bands = [t.split('/', 1)[1].lower() for t in card['tags'] if t.startswith('HSK/')]
    assert len(bands) <= 1, ('More than one HSK band', card['hanzi'])
    if bands:
        hsk[card['hanzi']] = bands[0]
(ROOT / 'hsk-tag-map.js').write_text('// Bundled HSK 3.0 lookup generated from the single master collection.\n'
    + 'export const HSK_LEVELS = ' + json.dumps(hsk, ensure_ascii=False, separators=(',', ':')) + ';\n'
    + 'export const hskTagFor = word => HSK_LEVELS[word] || null;\n')
# Keep internal generator metadata accurate even though optional decks are not
# part of the shipped PWA. Regeneration from legacy topic sources cannot undo
# the expanded canonical dictionary.
manifest_path = ROOT / 'decks' / 'manifest.json'
if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text())
    for deck in manifest:
        if deck['id'] == 'all-decks':
            deck['wordCount'] = len(cards)
            deck['grammarCount'] = len(BASE['grammar'])
            deck['words'] = [c['hanzi'] for c in cards]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'deck-catalog.js').write_text('// Internal content catalogue; not shipped as optional decks.\n'
      + 'export const DECKS = ' + json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + ';\n')
# build_master.py only compacts the same JSON source into a JS import.
import subprocess
import sys
subprocess.run([sys.executable, str(ROOT / 'build_master.py')], check=True)
print(f'Bundled {len(cards):,} vocab, {len(BASE["grammar"]):,} grammar, {len(seen):,} unique symmetric synonym pairs.')
