#!/usr/bin/env python3
"""Deterministically build Panlong v0.9.9 graded editions from reviewed, aligned data.

Original prose remains untouched. All editions share source paragraph IDs,
novel-specific term registers and grammar identities, preserving study progress.
"""
from __future__ import annotations
import copy
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'reader/panlong/v099'
GRADES={'hsk4':('graded-v099-hsk4','hsk4'),'hsk5':('graded-v095-hsk5','hsk5'),'hsk6':('graded-v094','hsk6')}

def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def asset(path):
 text=Path(path).read_text(encoding='utf-8')
 assert text.startswith('export default ') and text.endswith(';\n'),path
 return json.loads(text[len('export default '):-2])
def full_text(row,items):return ''.join(x if isinstance(x,str) else (x[1] if len(x)>1 else items[x[0]]['hanzi']) for x in row['tokens'])
def card_markup(text,tokens,glossary):
 """Mark the exact attested grammar example, preserving complete token boundaries."""
 offset=text.find(tokens['example'])
 assert offset>=0,(tokens['example'],text[:60])
 stop=offset+len(tokens['example']);pos=0;chosen=[]
 for token in tokens['words']:
  end=pos+len(token['text'])
  if pos>=offset and end<=stop:chosen.append(token)
  elif pos<stop and end>offset:
   # Rare offset cuts through a compound: still quote the exact example.
   return '{'+tokens['example']+'}',tokens['pinyinFallback']
  pos=end
 assert ''.join(t['text'] for t in chosen)==tokens['example']
 markup=''.join('{'+t['text']+'}' if t['annotated'] else t['text'] for t in chosen)
 pinyin=' '.join(glossary[t['text']]['pinyin'] if t['annotated'] else t['text'] for t in chosen)
 return markup,pinyin

def main():
 reference=read(ROOT/'reader/panlong/hsk5-final/baseline.json')
 bases={'hsk4':set(read(DATA/'hsk4/baseline.json')),'hsk5':set(reference),'hsk6':set(read(ROOT/'reader/panlong/pass46/baseline.json'))}
 protected=set(read(ROOT/'reader/panlong/hsk5-final/terms.json'))
 assert len(protected)==198
 source_digests={n:hashlib.sha256((ROOT/f'reader/panlong/chapters/{n:03}.json').read_bytes()).hexdigest() for n in range(1,24)}
 prepared={}
 for grade in GRADES:
  folder=DATA/grade
  corpus=read(folder/'manuscript.json');spans=read(folder/'spans.json');glossary=read(folder/'glossary.json');notes=read(folder/'grammar-notes.json')
  assert len(corpus)==len(spans)==23 and len(notes)==40,(grade,'incomplete corpus')
  result={};all_oov=set();all_terms=set();count=0
  for chapter in corpus:
   n=chapter['number'];base=asset(ROOT/f'chapters/graded-v094/{n}.js') if grade=='hsk6' else asset(ROOT/f'chapters/graded-v095-hsk5/{n}.js')
   orig=read(ROOT/f'reader/panlong/chapters/{n:03}.json')
   assert base['sourceDigest']==source_digests[n] or n==2,(grade,n,'stale reader base source digest')
   assert len(chapter['graded'])==len(chapter['anchors'])==len(spans[str(n)])==len(orig['paragraphs'])
   assert all(full_text(row,orig['items'])==source for row,source in zip(orig['paragraphs'],chapter['original'])),(grade,n,'source prose changed')
   out=copy.deepcopy(base);out['sourceDigest']=source_digests[n]
   out['items']={key:copy.deepcopy(value) for key,value in base['items'].items() if value['kind']!='vocab'}
   for key,value in out['items'].items():
    if value['kind']=='term' and value['hanzi'] in glossary:out['items'][key]=copy.deepcopy(glossary[value['hanzi']])
   paragraph_rows=[];seen_vocab=set();vocab_order=[];seen_terms=set()
   for pi,(text,anchors,tokens,oldrow) in enumerate(zip(chapter['graded'],chapter['anchors'],spans[str(n)],orig['paragraphs'])):
    assert text and len(text)==len(anchors) and ''.join(t['text'] for t in tokens)==text,(grade,n,pi)
    row={'id':oldrow['id'],'tokens':[],'anchors':[]};pos=0
    for t in tokens:
     word=t['text']
     if t['annotated']:
      record=glossary[word];kind=record['kind'];assert kind in ('vocab','term'),(grade,n,word,kind)
      if kind=='term':assert word in protected,(grade,n,word);seen_terms.add(word);all_terms.add(word)
      else:
       assert word not in protected,(grade,n,word,'protected term treated as vocab')
       if word not in bases[grade]:all_oov.add(word)
      key=f'{kind}-{word}'
      if key not in out['items']:out['items'][key]=copy.deepcopy(record)
      assert out['items'][key]['hanzi']==word
      row['tokens'].append([key]);row['anchors'].append(min(anchors[pos],len(full_text(oldrow,orig['items']))-1));
      if kind=='vocab' and key not in seen_vocab:seen_vocab.add(key);vocab_order.append(key)
     else:
      assert not any('\u3400'<=char<='\u9fff' for char in word),(grade,n,pi,word)
      row['tokens'].append(word);row['anchors'].append(min(anchors[pos],len(full_text(oldrow,orig['items']))-1))
     assert anchors[pos]>=0,(grade,n,pi,word,anchors[pos])
     pos+=len(word)
    assert pos==len(text)
    assert row['anchors']==sorted(row['anchors']),(grade,n,pi,'nonmonotonic')
    paragraph_rows.append(row);count+=1
   out['paragraphs']=paragraph_rows;out['lexicon']['vocabulary']=vocab_order
   out['gradeTarget']=grade;out['fallbackVocabulary']=[]
   assert set(out['lexicon']['terms'])==set(base['lexicon']['terms'])
   assert seen_terms.issubset({out['items'][t]['hanzi'] for t in out['lexicon']['terms']}),(grade,n,'unregistered protected term')
   # Keep the existing grammar IDs (so users keep study history) and bind
   # reviewed per-edition explanations/examples to the accurate new prose.
   chapter_notes=[x for x in notes if x['chapter']==n]
   matched_grammar=set()
   for note in chapter_notes:
    prefix=f'盘龙 {n}.{note["paragraph"]} · '
    matches=[(key,card) for key,card in out['grammarCards'].items() if key not in matched_grammar and card['pattern']==prefix+note['pattern']]
    if not matches:
     matches=[(key,card) for key,card in out['grammarCards'].items() if key not in matched_grammar and card['pattern'].startswith(prefix)]
     if len(matches)>1:
      from difflib import SequenceMatcher
      matches.sort(key=lambda v:SequenceMatcher(None,v[1]['markup'].replace('{','').replace('}',''),note['example']).ratio(),reverse=True)
      matches=matches[:1]
    assert len(matches)==1,(grade,n,note['paragraph'],'grammar identity',[(k,x['pattern']) for k,x in matches])
    key,card=matches[0];matched_grammar.add(key)
    assert note['example'] in chapter['graded'][note['paragraph']-1],(grade,n,note['paragraph'],note['example'])
    card['pattern']=prefix+note['pattern'];card['english']=note['english'];card['explanation']=note['note']
    words=spans[str(n)][note['paragraph']-1]
    markup,pinyin=card_markup(chapter['graded'][note['paragraph']-1],{'example':note['example'],'words':words,'pinyinFallback':card['pinyin']},glossary)
    card['markup']=markup;card['pinyin']=pinyin
    out['items'][key]['english']=note['note']
   result[n]=out
  assert count==1648 and len(result)==23,(grade,count,len(result))
  prepared[grade]=(result,all_oov)
  print(grade,'paragraphs',count,'unknown word forms',len(all_oov),'unique terms seen',len(all_terms))
 for grade,(res,oov) in prepared.items():
  path=ROOT/'chapters'/GRADES[grade][0];path.mkdir(parents=True,exist_ok=True)
  for n,chapter in sorted(res.items()):
   chapter['extras']=sorted(oov)
   (path/f'{n}.js').write_text('export default '+json.dumps(chapter,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
 print('All 69 graded editions built; Original source paragraphs unmodified.')
if __name__=='__main__':main()
