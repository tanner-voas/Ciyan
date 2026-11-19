import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MASTER} from '../master-data.js';
import {HSK_LEVELS} from '../hsk-tag-map.js';
import {defaultState,makeBackup,parseBackup,normalizeCard} from '../storage.js';
import {replaceMaster} from '../master.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';
import {tagMatches} from '../tags.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const old=read('../content/v055_base_master.json'),additions=read('../content/v055_new_words.json'),pairs=read('../content/v055_synonym_pairs.json');
const cards=MASTER.cards,byId=new Map(cards.map(c=>[c.id,c])),byWord=new Map(cards.map(c=>[c.hanzi,c]));

test('v0.5.5 bundled master contains all words with unchanged old definitions, IDs, and all grammar',()=>{
 assert.equal(APP_VERSION,'0.7.8');assert.ok(cards.length>=11760);assert.ok(MASTER.grammar.length>=1549);
 assert.equal(byWord.size,cards.length);assert.equal(byId.size,cards.length);
 const retained=old.grammar.filter(g=>MASTER.grammar.some(x=>x.id===g.id));assert.deepEqual(MASTER.grammar.slice(0,retained.length),retained);
 for(const before of old.cards){const after=byWord.get(before.hanzi);assert.ok(after,before.hanzi);
  for(const field of ['id','hanzi','pinyin','english','tags','source','createdAt'])assert.deepEqual(field==='tags'?after.tags.filter(t=>!t.startsWith('TSK/')):after[field],before[field],`${before.hanzi}:${field}`);}
 assert.equal(additions.length,9482);
 for(const c of additions)assert.equal(byWord.get(c.hanzi)?.id,c.id,c.hanzi);
});

test('every v3 synonym edge is imported only as an ID and numeric score and is exactly reciprocal',()=>{
 assert.equal(pairs.length,3088);let count=0;const pairSet=new Set();
 for(const c of cards){for(const s of c.synonyms||[]){
  assert.deepEqual(Object.keys(s).sort(),['id','similarity']);
  assert.ok(s.similarity>0&&s.similarity<=1);const target=byId.get(s.id);assert.ok(target,`${c.hanzi}:${s.id}`);
  assert.equal(target.synonyms?.find(x=>x.id===c.id)?.similarity,s.similarity,`${c.hanzi}→${target.hanzi}`);
  pairSet.add([c.id,s.id].sort().join('|'));count++;
 }}
 assert.equal(count,6176);assert.equal(pairSet.size,3088);
 for(const [a,b,similarity] of pairs){assert.equal(byId.get(a)?.synonyms?.find(x=>x.id===b)?.similarity,similarity);}
 const tomato=byWord.get('番茄'),other=byWord.get('西红柿');assert.ok(tomato.synonyms.find(x=>x.id===other.id)?.similarity>=.95);
});

test('HSK 3.0 band tags are canonical, and advanced words also inherit safe existing topics',()=>{
 const bands=['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6','HSK7-9'];
 const counts=Object.fromEntries(bands.map(x=>[x,0]));let topical=0;
 for(const c of cards){const found=c.tags.filter(x=>x.startsWith('HSK/'));assert.ok(found.length<=1,c.hanzi);
  if(found.length){assert.equal(found[0],`HSK/${HSK_LEVELS[c.hanzi].toUpperCase()}`,c.hanzi);counts[found[0].split('/')[1]]++;}
  if(c.tags.some(x=>!x.startsWith('HSK/')))topical++;
  assert.ok(c.tags.every(t=>!t.includes('3.0')),c.hanzi);
 }
 assert.ok(counts['HSK7-9']>=5000);assert.ok(topical>4500);
 assert.ok(tagMatches(byWord.get('番茄').tags,'Food'));
 assert.ok(additions.some(c=>c.tags.some(t=>t==='Work/technology')));
 assert.ok(additions.some(c=>c.tags.some(t=>t==='Nature/weather')));
});

test('minimal synonym schema is preserved in a complete master, backup roundtrip and on edits',()=>{
 const s=defaultState();replaceMaster(s,MASTER);const tomato=s.cards.find(c=>c.hanzi==='番茄');
 assert.ok(tomato?.synonyms?.length);
 const original=structuredClone(tomato);
 const normal=normalizeCard(tomato);assert.deepEqual(normal.synonyms,original.synonyms);
 s.schedules[tomato.id]={dueAt:'2026-11-17T08:00:00.000Z',lastReviewedAt:'2026-11-16T08:00:00.000Z',stability:1,difficulty:5,lastRating:3,reps:1,score:.36};
 const restored=parseBackup(makeBackup(s));assert.deepEqual(restored.cards.find(c=>c.id===tomato.id).synonyms,original.synonyms);
 assert.deepEqual(restored.schedules[tomato.id],{...s.schedules[tomato.id],lapses:0});
});

test('v0.5.4 backup migrations preserve all settings/history exactly',()=>{
 const s=defaultState();s.settings.newWordsPerDay=17;s.settings.tagWeights['Food/food']=-1.2;
 const backup=makeBackup(s);backup.appVersion='0.5.4';backup.state.appVersion='0.5.4';
 const prev=structuredClone(backup.state),upgraded=prepareVersionedBackup(backup);
 assert.deepEqual(upgraded.state,prev);assert.equal(upgraded.appVersion,'0.7.8');assert.equal(backup.appVersion,'0.5.4');
 const restored=parseBackup(backup);assert.equal(restored.appVersion,'0.7.8');assert.equal(restored.settings.tagWeights['Food/food'],-1.2);
});

test('malformed synonym input fails validation rather than executing markup or corrupting links',()=>{
 const base={id:'test',hanzi:'测试词',english:'Test word'};
 assert.throws(()=>normalizeCard({...base,synonyms:[{id:'next',similarity:1.1}]}),/Invalid synonym/);
 assert.throws(()=>normalizeCard({...base,synonyms:'bad'}),/Invalid synonym/);
 assert.throws(()=>normalizeCard({...base,synonyms:[{id:'next',similarity:'0.95'}]}),/Invalid synonym/);
 assert.deepEqual(normalizeCard({...base,synonyms:[{id:'next',similarity:.98},{id:'next',similarity:.7},{id:'test',similarity:.99}]}).synonyms,[{id:'next',similarity:.98}]);
});
