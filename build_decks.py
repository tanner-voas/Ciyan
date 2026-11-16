#!/usr/bin/env python3
"""Rebuild versioned, optional decks from reviewed local content. No network or packages."""
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'decks';OUT.mkdir(exist_ok=True)
levels=json.loads((ROOT/'content/hsk2021-levels.json').read_text())
STAMP='2026-11-17T00:00:00.000Z'
def uid(word):return 'v3-word-'+hashlib.sha256(word.encode()).hexdigest()[:16]
def card(word,pinyin,english,tags):
    return dict(id=uid(word),hanzi=word,pinyin=pinyin,english=english,tags=list(dict.fromkeys(tags)),source='Ciyan optional decks v0.3',createdAt=STAMP)
def dump(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
decks=[];master={}
for line in (ROOT/'content/topics.txt').read_text().splitlines():
    if not line.strip():continue
    if line.startswith('# '):
        id,title,tags=line[2:].split('|');tags=tags.split(',')
        current=dict(id=id,title=title,description='Practical vocabulary for '+title.lower()+'.',cards=[],grammar=[]);decks.append(current)
    else:
        word,pinyin,english=line.split('|')
        t=tags.copy()
        if word in levels:t+=['hsk-2021-'+str(levels[word])]
        c=card(word,pinyin,english,t);current['cards'].append(c)
        if word not in master:master[word]=dict(c)
        else:master[word]['tags']=list(dict.fromkeys(master[word]['tags']+t))
# Selected HSK lists are frequency-prioritized candidates, with local editorial corrections.
for n in range(1,5):
    cards=[]
    for line in (ROOT/f'content/hsk-{n}.tsv').read_text().splitlines():
        w,p,e=line.split('\t');c=card(w,p,e,['hsk','hsk-2021-'+str(n)])
        if w in master:
            c={**master[w],'tags':list(dict.fromkeys(master[w]['tags']+c['tags']))}
        cards.append(c)
        if w not in master:master[w]=dict(c)
        else:master[w]['tags']=list(dict.fromkeys(master[w]['tags']+c['tags']))
    decks.append(dict(id=f'hsk-2021-{n}',title=f'HSK 3.0 (2021): selected level {n}',description=f'{len(cards)} useful entries at level {n} of GF 0025–2021. Selective, not the complete syllabus. Level membership is checked against the reference list.',cards=cards,grammar=[]))
# Grammar dependencies included, regardless of whether another deck was loaded.
extras='''我|wǒ|I; me
你|nǐ|You
他|tā|He; him
吗|ma|Question particle
有|yǒu|Have; there is
吃|chī|Eat
了|le|Completion or change-of-state particle
没|méi|Not; did not; have not
请|qǐng|Please; invite
说|shuō|Say; speak
一遍|yī biàn|One time through; once
喝|hē|Drink
茶|chá|Tea
买|mǎi|Buy
比|bǐ|Compared with; than
被|bèi|Passive construction marker
高|gāo|Tall; high
喜欢|xǐ huan|Like
给|gěi|Give; for
一|yī|One
杯|bēi|Cup; cupful
水|shuǐ|Water
个|ge|General classifier
两|liǎng|Two (before most classifiers)
二|èr|Two (number)
在|zài|At; in; action-in-progress marker
工作|gōng zuò|Work; job
正在|zhèng zài|In the process of
的|de|Possessive or attributive particle
名字|míng zi|Name
去|qù|Go
很|hěn|Very; quite
累|lèi|Tired
开心|kāi xīn|Happy
先|xiān|First; beforehand
然后|rán hòu|Then; after that
开始|kāi shǐ|Begin; start
这|zhè|This
双|shuāng|Pair; classifier for pairs
太|tài|Too; extremely
把|bǎ|Object-disposal construction marker; grasp
放|fàng|Put; place
桌子|zhuō zi|Table; desk
上|shàng|On; above; go up
过|guo|Past-experience particle
着|zhe|Ongoing-state particle'''
for line in extras.splitlines():
    w,p,e=line.split('|')
    # In a grammar dependency deck these glosses explain the sense used in the sentence.
    if w not in master:master[w]=card(w,p,e,['grammar-words'])
grammar=[];required=[]
for i,(markup,pinyin,english,dist) in enumerate(json.loads((ROOT/'content/grammar.json').read_text()),1):
    grammar.append(dict(id=f'v3-grammar-{i:03}',markup=markup,pinyin=pinyin,english=english,distractors=[dict(index=n,word=w) for n,w in dist],source='Ciyan practical grammar v0.3',createdAt=STAMP))
    required.extend(re.findall(r'\{([^{}]+)\}',markup));required.extend(w for _,w in dist)
missing=set(required)-master.keys()
assert not missing,missing
# Uniform canonical content across decks; all semantic tags merge regardless of load order.
for d in decks:d['cards']=[master[c['hanzi']] for c in d['cards']]
decks.append(dict(id='practical-grammar',title='Practical grammar starter',description='24 short sentence-building exercises, with every answer word and distractor included. Grammar unlocks as those words become familiar.',cards=[master[w] for w in dict.fromkeys(required)],grammar=grammar))
allwords={}
for d in decks:
    for c in d['cards']:allwords[c['hanzi']]=c
combined=dict(id='all-decks',title='All optional decks',description='Every optional word and grammar card in one import. Overlapping words are deduplicated.',cards=list(allwords.values()),grammar=grammar)
decks.append(combined)
catalog=[]
for d in decks:
    payload=dict(format='ciyan-deck',version=2,records=False,title=d['title'],description=d['description'],license='CC-BY-SA-4.0; see ATTRIBUTION.md',cards=d['cards'],grammar=d['grammar'])
    dump(OUT/(d['id']+'.json'),payload)
    catalog.append(dict(id=d['id'],title=d['title'],description=d['description'],wordCount=len(d['cards']),grammarCount=len(d['grammar']),words=[c['hanzi'] for c in d['cards']]))
dump(OUT/'manifest.json',catalog)
(ROOT/'deck-catalog.js').write_text('// Generated by build_decks.py. No user data.\nexport const DECKS = '+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n')
print('Unique optional words:',len(allwords),'Grammar:',len(grammar),'Individual decks:',len(decks)-1)
for c in catalog:print(c['id'],c['wordCount'],c['grammarCount'])
