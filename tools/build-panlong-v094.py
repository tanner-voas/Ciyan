#!/usr/bin/env python3
"""Reproduce the Ciyan v0.9.4 HSK6+TSK12 editorial overlay.

Uses the immutable v0.9.3 Pass 46 graded assets, not the HSK5 adaptation.
Only the annotated graded assets are rebuilt: original chapters, historical
source digests, reader bookmarks, and the user's study history stay unchanged.
After running this, run tools/package-chapters.py for the new catalog paths.
"""
import copy
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'chapters'
MANIFEST = json.loads((ROOT / 'reader/panlong/v094-edits.json').read_text(encoding='utf-8'))
BASELINE = set(json.loads((ROOT / 'reader/panlong/pass46/baseline.json').read_text(encoding='utf-8')))
SOURCE_CORPUS = json.loads((ROOT / 'reader/panlong/pass46/corpus.json').read_text(encoding='utf-8'))
HAN = re.compile(r'[\u3400-\u9fff]')


def load_js(path):
    text = path.read_text(encoding='utf-8')
    assert text.startswith('export default ') and text.endswith(';\n'), path
    return json.loads(text[len('export default '):-2])


def word(token, items):
    if isinstance(token, str):
        return token
    return token[1] if len(token) > 1 else items[token[0]]['hanzi']


def seen_terms(asset):
    return {k for k in asset['lexicon']['terms'] if k in asset['items']}


def build():
    edits = defaultdict(list)
    for edit in MANIFEST['edits']:
        edits[edit['chapter']].append(edit)
    assert len(MANIFEST['edits']) == 71
    results = {}
    for n in range(1, 24):
        old = load_js(ASSETS / f'graded-v092/{n}.js')
        out = copy.deepcopy(old)
        original = (ROOT / f'reader/panlong/chapters/{n:03}.json').read_bytes()
        assert hashlib.sha256(original).hexdigest() == out['sourceDigest'], f'Chapter {n} source digest changed'
        old_terms = seen_terms(old)
        for edit in sorted(edits[n], key=lambda e:(e['paragraph'],e['tokenStart']), reverse=True):
            j = edit['paragraph'] - 1
            row = out['paragraphs'][j]
            first, stop = edit['tokenStart'], edit['tokenEnd']
            previous = ''.join(word(t, out['items']) for t in row['tokens'][first:stop])
            assert previous == edit['oldWindow'], (n, j + 1, previous, edit['oldWindow'])
            assert previous.count(edit['before']) == 1, (n, j + 1)
            next_text = previous.replace(edit['before'], edit['after'], 1)
            assert next_text == ''.join(t['text'] for t in edit['newTokens']), (n, j + 1)
            replacements = []
            for token in edit['newTokens']:
                surface = token['text']
                if not token['annotated']:
                    assert not HAN.search(surface), (n, j+1, surface)
                    replacements.append(surface)
                    continue
                key = f'term-{surface}' if f'term-{surface}' in out['items'] else f'vocab-{surface}'
                if key not in out['items']:
                    assert surface in MANIFEST['wordGlosses'], (n, j+1, surface)
                    record = MANIFEST['wordGlosses'][surface]
                    assert record['hanzi'] == surface and record['kind'] == 'vocab', (n, j+1, surface)
                    out['items'][key] = record
                replacements.append([key])
            anchors = row['anchors']
            lower = anchors[first]
            upper = anchors[stop] if stop < len(anchors) else len(SOURCE_CORPUS[n-1]['original'][j]) - 1
            # Do not assume source token count equals source character length.
            # For the final window, the source text length is the upper bound.
            if stop == len(anchors):
                upper = len(SOURCE_CORPUS[n-1]['original'][j]) - 1
            upper = max(lower, upper)
            length = max(1, len(next_text))
            offset = 0
            newanchors = []
            for token in edit['newTokens']:
                newanchors.append(min(upper, lower + (upper-lower)*offset // length))
                offset += len(token['text'])
            row['tokens'][first:stop] = replacements
            row['anchors'][first:stop] = newanchors
        if 'vocab-说道' in out['items']:
            out['items']['vocab-说道'] = MANIFEST['glossaryCorrection']['说道']
        assert seen_terms(out) == old_terms, (n, 'protected term register changed')
        assert len(out['paragraphs']) == len(old['paragraphs']), (n, 'paragraph drift')
        used = {t[0] for p in out['paragraphs'] for t in p['tokens'] if isinstance(t, list)}
        # Prune vocabulary cards no longer used after a wording correction.
        for key in list(out['items']):
            if out['items'][key]['kind'] == 'vocab' and key not in used:
                del out['items'][key]
        vocabulary = [k for k in old['lexicon']['vocabulary'] if k in used]
        present = set(vocabulary)
        for p in out['paragraphs']:
            for token in p['tokens']:
                if isinstance(token, list):
                    k = token[0]
                    assert k in out['items'], (n, k)
                    if out['items'][k]['kind'] == 'vocab' and k not in present:
                        vocabulary.append(k); present.add(k)
        out['lexicon']['vocabulary'] = vocabulary
        for j, p in enumerate(out['paragraphs']):
            assert p['id'] == old['paragraphs'][j]['id'], (n,j)
            assert len(p['tokens']) == len(p['anchors'])
            assert all(isinstance(a, int) and 0 <= a < len(SOURCE_CORPUS[n-1]['original'][j]) for a in p['anchors']), (n,j)
            assert p['anchors'] == sorted(p['anchors']), (n,j, 'nonmonotonic anchors')
        results[n] = out
    # Extras are a volume-wide allowlist for auto-simplification and must cover
    # the revised text, not the superseded Pass 46 segmentation.
    all_words = {results[n]['items'][t[0]]['hanzi'] for n in results for p in results[n]['paragraphs'] for t in p['tokens'] if isinstance(t,list) and results[n]['items'][t[0]]['kind']=='vocab'}
    extras = sorted(all_words - BASELINE)
    dest = ASSETS / 'graded-v094'
    dest.mkdir(exist_ok=True)
    for n, asset in results.items():
        asset['extras'] = extras
        (dest / f'{n}.js').write_text('export default ' + json.dumps(asset, ensure_ascii=False, separators=(',',':')) + ';\n', encoding='utf-8')
    print(f'Rebuilt {len(results)} HSK6+TSK12 graded assets, {len(MANIFEST["edits"])} source-aligned corrections, {len(extras)} volume OOV forms')


if __name__ == '__main__':
    build()
