#!/usr/bin/env python3
"""Build finalized Panlong Volume 1 HSK5+TSK10 native reader assets.

Keeps the v0.9.4 HSK6+TSK12 files and original source digests untouched.
The frozen manuscript, 40 grammar notes, and aligned token annotations are
versioned in reader/panlong/hsk5-final for a deterministic rebuild.
"""
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'reader/panlong/hsk5-final'
OUT = ROOT / 'chapters/graded-v095-hsk5'

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def load_asset(n):
    text=(ROOT/f'chapters/graded-v094/{n}.js').read_text(encoding='utf-8')
    assert text.startswith('export default ') and text.endswith(';\n')
    return json.loads(text[len('export default '):-2])

def token_text(t, items):
    return t if isinstance(t,str) else (t[1] if len(t)>1 else items[t[0]]['hanzi'])

def build():
    corpus=load(DATA/'manuscript.json')
    spans=load(DATA/'spans.json')
    glossary=load(DATA/'glossary.json')
    protected=set(load(DATA/'terms.json'))
    notes=load(DATA/'grammar-notes.json')
    hsk5_baseline=set(load(ROOT/'reader/panlong/hsk5-final/baseline.json'))
    assert len(corpus)==len(spans)==23 and len(notes)==40 and len(protected)==198
    all_oov=set()
    for chapter in corpus:
        n=chapter['number']; original=load(ROOT/f'reader/panlong/chapters/{n:03}.json'); graded6=load_asset(n)
        raw=(ROOT/f'reader/panlong/chapters/{n:03}.json').read_bytes()
        assert hashlib.sha256(raw).hexdigest()==graded6['sourceDigest']
        assert len(chapter['graded'])==len(chapter['anchors'])==len(spans[str(n)])==len(original['paragraphs'])
        out=copy.deepcopy(graded6)
        out['items']={k:v for k,v in out['items'].items() if v['kind'] in ('term','grammar')}
        # Use the approved final edition's chapter-specific term definitions.
        for k,v in out['items'].items():
            if v['kind']=='term' and v['hanzi'] in glossary:
                out['items'][k]=copy.deepcopy(glossary[v['hanzi']])
        paragraphs=[];vocab_order=[];seen_vocab=set();seen_terms=set();term_ids=set(graded6['lexicon']['terms'])
        for pi,(text,source_chars,tokens,orig_row) in enumerate(zip(chapter['graded'],chapter['anchors'],spans[str(n)],original['paragraphs'])):
            assert len(text)==len(source_chars) and len(text)>0
            assert ''.join(t['text'] for t in tokens)==text,(n,pi+1,'spans differ from manuscript')
            assert len(source_chars)>0 and len(orig_row['tokens'])>0
            new_tokens=[];new_anchors=[];offset=0
            # Current character-offset mapping is the frozen source alignment.
            for t in tokens:
                word=t['text']
                if t['annotated']:
                    is_term=word in protected
                    id=('term-' if is_term else 'vocab-')+word
                    record=glossary[word]
                    assert record['kind']==('term' if is_term else 'vocab'),(n,word,record['kind'])
                    if id not in out['items']:out['items'][id]=copy.deepcopy(record)
                    if is_term:seen_terms.add(id)
                    elif id not in seen_vocab:
                        vocab_order.append(id);seen_vocab.add(id)
                    if not is_term and word not in hsk5_baseline:all_oov.add(word)
                    new_tokens.append([id])
                else:
                    assert not any('\u3400'<=c<='\u9fff' for c in word),(n,pi+1,word)
                    new_tokens.append(word)
                pos=source_chars[offset]
                assert isinstance(pos,int) and 0<=pos<len(''.join(token_text(t,original['items']) for t in orig_row['tokens'])),(n,pi+1,pos)
                new_anchors.append(pos)
                offset+=len(word)
            assert offset==len(text)
            assert new_anchors==sorted(new_anchors),(n,pi+1,'nonmonotone anchors')
            paragraphs.append({'id':orig_row['id'],'tokens':new_tokens,'anchors':new_anchors})
        # Original lesson focus and protected glossary remain shared across editions.
        assert term_ids==set(out['lexicon']['terms'])
        assert seen_terms.issubset(term_ids),(n,seen_terms-term_ids)
        for id in term_ids:
            assert id in out['items'],(n,id)
        out['paragraphs']=paragraphs
        out['lexicon']['vocabulary']=vocab_order
        out['gradeTarget']='hsk5'
        out['fallbackVocabulary']=[]
        out['sourceDigest']=graded6['sourceDigest']
        out['editionVersion']=graded6['editionVersion']
        # Align grammar notes' explanations to the finalized chapter manuscript.
        for note in [x for x in notes if x['chapter']==n]:
            matches=[(id,card) for id,card in out['grammarCards'].items()
                    if id.startswith('grammar-pass45-') and card['pattern']==f'盘龙 {n}.{note["paragraph"]} · {note["pattern"]}']
            assert len(matches)==1,(n,note['paragraph'],note['pattern'])
            id,card=matches[0]
            card['english']=note['english'];card['explanation']=note['note']
            # Where the high-level passage had different wording, use the final
            # lesson example and its existing pinyin/markup when still accurate.
            plain=card['markup'].replace('{','').replace('}','')
            # Rebuild the example markup/pinyin only if the finalized wording
            # differs from the old high-level lesson (three examples).
            if plain!=note['example']:
                paragraph=chapter['graded'][note['paragraph']-1]
                tokens=spans[str(n)][note['paragraph']-1]
                start=paragraph.index(note['example']);end=start+len(note['example'])
                position=0;selected=[]
                for t in tokens:
                    next_position=position+len(t['text'])
                    if position<end and next_position>start:
                        assert position>=start and next_position<=end,(n,note['paragraph'],'partial token')
                        selected.append(t)
                    position=next_position
                assert ''.join(t['text'] for t in selected)==note['example']
                card['markup']=''.join('{'+t['text']+'}' if t['annotated'] else t['text'] for t in selected)
                card['pinyin']=' '.join(glossary[t['text']]['pinyin'] if t['annotated'] else t['text'] for t in selected)
            out['items'][id]['english']=note['note']
        OUT.mkdir(exist_ok=True)
        (OUT/f'{n}.js').write_text('export default '+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    assert len(all_oov)==952,(len(all_oov),'expected 952 annotated ordinary OOV words')
    for n in range(1,24):
        file=OUT/f'{n}.js'
        text=file.read_text(encoding='utf-8');asset=json.loads(text[len('export default '):-2]);asset['extras']=sorted(all_oov)
        file.write_text('export default '+json.dumps(asset,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    print(f'Built 23 HSK5+TSK10 editions with {len(all_oov)} OOV words; retained 23 HSK6 editions')

if __name__=='__main__':build()
