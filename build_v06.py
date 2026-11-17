"""Rebuild the checked v0.6 content, coverage ledger, and deployment master.
No template candidates are silently promoted to study content.
"""
from pathlib import Path
import json,re,hashlib,csv
R=Path(__file__).resolve().parent
load=lambda p:json.loads((R/p).read_text())
d=load('content/base-master-v055.json');v={c['hanzi']:c for c in d['cards']}
for line in (R/'content/prerequisites-v06.tsv').read_text().splitlines():
 w,p,e,t=line.split('\t')
 if w not in v:
  c={'id':'v06-word-'+hashlib.sha256(w.encode()).hexdigest()[:20],'hanzi':w,'pinyin':p,'english':e,'tags':[t],'source':'Ciyan v0.6 sentence prerequisites','createdAt':'2026-11-17T00:00:00.000Z'}
  v[w]=c;d['cards'].append(c)
# Each replacement below was reviewed in the surrounding sentence.
fixes={'{城市}{化}':'{城市化}','{原}{定}':'{原定}','{加}{大}':'{加大}','{科学}{家}':'{科学家}','{竞争}{力}':'{竞争力}','{生物}{多样}{性}':'{生物}{多样性}','{投资}{者}':'{投资者}','{算}{法}':'{算法}','{可靠}{性}':'{可靠性}','{公平}{性}':'{公平性}','{废}{气}':'{废气}','{降}{水}{量}':'{降水量}','{并列}{出}':'{并}{列出}','{精}{度}':'{精度}','{湿}{地}':'{湿地}','{不必}{要}':'{不}{必要}','{先进}{行}':'{先}{进行}','{注意}{力}':'{注意力}','{记忆}{力}':'{记忆力}','{这个}':'{这}{个}','{已有}':'{已}{有}'}
# Where a lexical item is absent, use its compositional pieces only if all exist.
def safe_tokens(s):
 if s in v:return [s]
 n=len(s);dp={n:[]}
 for i in range(n-1,-1,-1):
  for j in range(n,i,-1):
   if s[i:j] in v and j in dp:dp[i]=[s[i:j]]+dp[j];break
 if 0 not in dp:raise ValueError('Missing prerequisite: '+s)
 return dp[0]
def markup_tokens(markup):
 return re.sub(r'\{([^{}]+)\}',lambda m:''.join('{'+w+'}' for w in safe_tokens(m[1])),markup)
new=[]
for g in load('content/reviewed-draft-v06.json'):
 g={k:x for k,x in g.items() if k not in ['draftQuality','reviewStatus','reviewPriority']}
 for a,b in fixes.items():g['markup']=g['markup'].replace(a,b)
 # Do not conflate population structure changes with aging specifically.
 if g['id']=='v06-grammar-00037':g['english']='As the population structure changes, public healthcare services face growing pressure.'
 g['markup']=markup_tokens(g['markup']);g['source']='Ciyan v0.6 reviewed draft examples';new.append(g)
# Dictionary pinyin used only after explicit lexical segmentation. Contextual readings below.
overrides={'琢磨':'zuó mo','地':'de','得':'de','了':'le','着':'zhe','过':'guo','为':'wèi','与':'yǔ','不':'bù','一':'yī','还':'hái','看似':'kàn sì','薄雾':'bó wù','炸焦':'zhá jiāo'}
def pin(w):return overrides.get(w,v[w]['pinyin']).replace('-',' ')
for i,line in enumerate(((R/'content/grammar-v06.tsv').read_text()+'\n'+(R/'content/grammar-v061.tsv').read_text()).strip().splitlines()):
 if not line.strip():continue
 han,en=line.split('\t');tokens=[]
 for w in han.strip().split('|'):
  if re.fullmatch('[，。！？、；：]',w):tokens.append(w)
  else:tokens.extend(safe_tokens(w))
 markup=''.join(w if re.fullmatch('[，。！？、；：]',w) else '{'+w+'}' for w in tokens)
 py=' '.join({'，':',','。':'.','！':'!','？':'?','、':',','；':';','：':':'}.get(w,pin(w) if w in v else w) for w in tokens)
 py=re.sub(r'\s+([,.!?;:])',r'\1',py);py=py[0].upper()+py[1:]
 # 为 is wéi in 以…为背景 and 不是…为; in the present authored set only one standalone occurrence.
 if '以|' in han and '|为|背景' in han:py=py.replace(' wèi ', ' wéi ')
 if '|过|海关|' in han:py=py.replace('guo hǎi guān','guò hǎi guān')
 if '|大大|' in han:py=py.replace('dà da','dà dà')
 g={'id':'v060-context-'+hashlib.sha256(markup.encode()).hexdigest()[:20],'markup':markup,'pinyin':py,'english':en.strip(),'distractors':[],'source':'Ciyan v0.6 authored contexts','createdAt':'2026-11-17T00:00:00.000Z'}
 new.append(g)
for p in load('content/particle-examples-v06.json'):
 for a in p['accepted']:
  tokens=p['base'].copy()
  if a['choice']!='∅':tokens.insert(a['slot'],a['choice'])
  markup=markup_tokens(''.join('{'+w+'}' for w in tokens))+('？' if p['pinyin'].endswith('?') else '。')
  # Prompt first sentence supplies the intended meaning, stripped of teaching directions.
  en=p['prompt'].split('. ')[0].rstrip('.')+'.'
  py=p['pinyin']
  if a['choice']=='∅' and len(p['accepted'])>1:py=py.replace(' de ',' ')
  new.append({'id':'v060-context-'+hashlib.sha256(markup.encode()).hexdigest()[:20],'markup':markup,'pinyin':py,'english':en,'distractors':[],'source':'Ciyan v0.6 particle context','createdAt':'2026-11-17T00:00:00.000Z'})
for g in new:
 if g['markup']=='{我}{明天}{去}{北京}。':g['acceptedOrders']=[['明天','我','去','北京']]
 if g['markup']=='{我}{昨天}{没}{吃}{早饭}。':g['acceptedOrders']=[['昨天','我','没','吃','早饭']]
seen={g['markup'] for g in d['grammar']}
for g in new:
 if g['markup'] not in seen:d['grammar'].append(g);seen.add(g['markup'])
d['title']='Ciyan v0.6.1 master';d['description']='Expanded vocabulary, synonyms, and reviewed usage examples. Full-vocabulary usage coverage remains incomplete.'
(R/'master-data.js').write_text('// Bundled content; rebuild with python3 build_v06.py.\nexport const MASTER='+json.dumps(d,ensure_ascii=False,separators=(',',':'))+';\n')
coverage={w:[] for w in v}
for g in d['grammar']:
 for w in set(re.findall(r'\{([^{}]+)\}',g['markup'])):
  if w in coverage:coverage[w].append(g['id'])
with (R/'content/coverage-v060.csv').open('w') as f:
 writer=csv.writer(f,lineterminator="\n");writer.writerow(['id','hanzi','examples','grammar_ids'])
 for w,c in v.items():writer.writerow([c['id'],w,len(coverage[w]),'|'.join(coverage[w])])
summary={'vocabulary':len(d['cards']),'grammar':len(d['grammar']),'new_grammar':len(d['grammar'])-1549,'covered_words':sum(bool(x) for x in coverage.values()),'uncovered_words':sum(not x for x in coverage.values()),'template_candidates_excluded':9056}
(R/'content/coverage-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(summary)
