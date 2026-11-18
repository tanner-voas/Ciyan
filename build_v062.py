#!/usr/bin/env python3
"""Rebuild content-only changes for Ciyan 0.6.2; keep v0.6.1 words unchanged."""
from pathlib import Path
import json,hashlib,re,collections,csv,subprocess,sys
R=Path(__file__).resolve().parent
# Reconstruct the complete, checked v0.6.1 baseline from the committed sources.
subprocess.run([sys.executable,str(R/'build_v06.py')],cwd=R,check=True,capture_output=True)
base=json.loads((R/'master-data.js').read_text().split('=',1)[1].rsplit(';',1)[0])
legacy=json.loads((R/'content/expanded-grammar-v061.json').read_text())
removed=set(json.loads((R/'content/pruned-context-ids-v062.json').read_text())['ids'])
byword={c['hanzi']:c for c in base['cards']}
grammar=[g for g in base['grammar']+legacy if g['id'] not in removed]
assert len(byword)==11893 and len(legacy)==805
new=[];error=[];used={g['markup'] for g in grammar}
punctuation={'，':',','。':'.','？':'?','！':'!','；':';','：':':','、':',','“':'"','”':'"'}
for n,line in enumerate((R/'content/context-additions-v062.tsv').read_text().splitlines(),1):
 if not line or line.startswith('#'):continue
 if '\t' not in line:error.append((n,'missing delimiter',line[:120]));continue
 zh,en=line.split('\t',1);seq=re.split(r'(\||[，。？！；：、])',zh);raw=[w.strip() for w in seq if w and w!='|'];mk=[];py=[]
 for token in raw:
  if token in punctuation:mk.append(token);py.append(punctuation[token]);continue
  parts=token.split('@');w=parts[0]
  if w not in byword:error.append((n,'word absent',w));continue
  p=parts[1] if len(parts)>1 else byword[w].get('pinyin','')
  if not p:error.append((n,'pinyin missing',w));continue
  if len(parts)==1:
   if w in ['得','的','地']:p='de'
   elif w=='了':p='le'
   elif w=='着':p='zhe'
   elif w=='过':p='guo'
   elif w=='不':p='bù'
   elif w=='一':p='yī'
  mk.append('{'+w+'}');py.append(p)
 if len(mk)!=len(raw):continue
 chinese=''.join(mk)
 if chinese in used:continue
 tok=re.findall(r'\{([^}]+)\}',chinese)
 if len(tok)>35:error.append((n,'too many tokens',len(tok)));continue
 if not chinese.endswith(('。','？','！')):error.append((n,'no end punctuation',chinese));continue
 # Correct grammatical tone for 一、不 before the following fourth-tone syllable.
 for i,t in enumerate(raw):
  if t not in ['一','不']:continue
  nxt=next((p for p in py[i+1:] if p not in punctuation.values()),'').strip().split(' ')[0]
  fourth=any(ch in nxt for ch in 'àèìòùǜ')
  py[i]=('yí' if fourth else 'yì') if t=='一' else ('bú' if fourth else 'bù')
 linepy=' '.join(py).strip();linepy=re.sub(r'\s+([,.;:!?])',r'\1',linepy);linepy=re.sub(r'([,;:!?])(?=[^\s])',r'\1 ',linepy)
 linepy=linepy[0].upper()+linepy[1:]
 id_='v062-grammar-'+hashlib.sha256(chinese.encode()).hexdigest()[:20]
 new.append({'id':id_,'markup':chinese,'pinyin':linepy,'english':en.strip(),'distractors':[],'source':'Ciyan v0.6.2 authored usage','createdAt':'2026-11-18T00:00:00.000Z'});used.add(chinese)
if error:
 print('ERRORS',len(error));[print(x) for x in error[:100]];sys.exit(2)
base['grammar']=grammar+new
base['title']='Ciyan v0.6.2 master with rule-aware contexts'
base['description']='Complete matching of literal tokens, adjacent full tokens or contained substrings; see context-matching.js.'
(R/'master-data.js').write_text('// Bundled content; rebuild with python3 build_v062.py.\nexport const MASTER='+json.dumps(base,ensure_ascii=False,separators=(',',':'))+';\n')
(R/'content/context-additions-built-v062.json').write_text(json.dumps(new,ensure_ascii=False,indent=1)+'\n')
report={'vocabulary':len(base['cards']),'grammarBeforePruning':1896+805,'prunedGrammar':len(removed),'newGrammar':len(new),'grammar':len(base['grammar']),'baselineV061':1896,'importedV061':805}
(R/'content/context-content-report-v062.json').write_text(json.dumps(report,indent=2)+'\n')
print(report)
