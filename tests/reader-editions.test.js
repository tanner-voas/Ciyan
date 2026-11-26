import test from 'node:test';
import assert from 'node:assert/strict';
import {learnerIndex,deriveEdition,synonymRange} from '../reader-editions.js';
import catalog from '../chapters/index.js';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateChapter,chapterText,acceptChapter,importChapterLexicon,readerAnalysis} from '../reader-core.js';
import {defaultState} from '../storage.js';
const source=path=>JSON.parse(fs.readFileSync(new URL('../reader/panlong/'+path,import.meta.url)));
const corpus=source('pass46/corpus.json'),reg=source('pass45/register.json');
const historical=source('pass45/corpus.json'),report=source('pass46/build-report.json');
const extras=new Set(report.ordinary),terms=new Set(reg.terms.map(r=>r.term)),base=new Set(source('pass46/baseline.json'));

test('v0.9.9 retains hosted source identity and complete reader lexicons',async()=>{
 const reader=source('v099/hsk4/manuscript.json');
 assert.equal(reader.length,23);
 const termIds=new Set(),grammarIds=new Set();let paragraphs=0;
 for(const entry of catalog.filter(e=>e.novel==='panlong')){
  const n=entry.number,bytes=fs.readFileSync(new URL('../reader/panlong/chapters/'+String(n).padStart(3,'0')+'.json',import.meta.url));
  const original=JSON.parse(bytes),current=(await import('../chapters/graded-v099-hsk4/'+n+'.js')).default;
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.digest);
  assert.equal(current.sourceDigest,entry.digest);
  validateChapter(original);validateChapter({...original,...current});
  for(const row of current.paragraphs){paragraphs++;assert.equal(row.anchors.length,row.tokens.length);}
  assert.equal(current.paragraphs.length,reader[n-1].graded.length);
  for(const id of current.lexicon.terms)termIds.add(current.items[id].hanzi);
  for(const id of Object.keys(current.grammarCards))if(id.startsWith('grammar-pass45-'))grammarIds.add(id);
 }
 assert.equal(paragraphs,1648);assert.equal(termIds.size,198);assert.equal(grammarIds.size,40);
});

test('preview obeys threshold and mastery, respects restored occurrences, and leaves history unchanged',()=>{
 const state={cards:[{id:'a',hanzi:'忽然',synonyms:[{id:'b',similarity:.94}]},{id:'b',hanzi:'突然',english:'suddenly',pinyin:'tūrán'}],history:[],schedules:{b:{score:2}}};
 const p={paragraphs:[{id:'p1',tokens:[['a'],'。']}],items:{a:{kind:'vocab',hanzi:'忽然'}}};
 function run(min,opts){return deriveEdition(p,learnerIndex(state),min,opts);}
 assert.equal(run(.90).changes.size,1);
 state.history=[1,2].map(day=>({cardId:'b',grade:3,at:'2026-11-0'+day+'T08:00:00Z'}));
 const copy=structuredClone(state);assert.equal(run(.95).changes.size,0);
 const r=run(.94);assert.equal(r.changes.size,1);assert.equal(r.stats.strength,.94);assert.equal(r.stats.after,2);
 assert.equal(run(.94,{restore:new Set(['p1:0'])}).changes.size,0);assert.deepEqual(copy,state);
});
test('v0.9.1 → v0.9.2 keeps saved progress, graded preference, and bookmark while clearing stale overrides',async()=>{
 const entry=catalog.find(e=>e.novel==='panlong'&&e.number===1);
 const next=source('chapters/001.json'),old={...next,revision:45,editionVersion:45,boundaries:'pass45-original'};
 const a=(await import('../chapters/graded-v091/1.js')).default;
 const s=defaultState();acceptChapter(s,old,a.sourceDigest);
 const b=s.reader.panlong,ch=b.chapters[0],term=next.lexicon.terms[0];
 const graded={...old,...a};importChapterLexicon(s,graded);b.items={...b.items,...graded.items};
 ch.editionPrefs={graded:true,auto:true,minimum:.94,restored:['p1:1']};ch.unlocked=true;ch.complete=true;
 ch.position={id:'p1',index:0,offset:0,sourceOffset:0,wordIndex:0};
 b.progress[term]={score:2,dueAt:'2027-01-01T00:00:00.000Z'};
 acceptChapter(s,next,entry.digest);
 const updated=s.reader.panlong.chapters[0];assert.equal(updated.revision,46);assert.equal(updated.digest,entry.digest);
 assert.deepEqual(updated.editionPrefs,{graded:true,auto:true,minimum:.94,restored:[]});
 assert.equal(updated.position.id,'p1');assert.equal(updated.position.sourceOffset,0);assert.ok(updated.unlocked&&updated.complete);
 assert.deepEqual(s.reader.panlong.progress[term],{score:2,dueAt:'2027-01-01T00:00:00.000Z'});
});

test('range uses only best known direct edge, including uncurated synonyms and exact mastery boundary',()=>{
 const cards=[{id:'a',hanzi:'甲',synonyms:[{id:'b',similarity:.97},{id:'c',similarity:.34}]},{id:'b',hanzi:'乙'},{id:'c',hanzi:'丙'},{id:'d',hanzi:'丁',synonyms:[{id:'c',similarity:.42}]}];
 const index=learnerIndex({cards,schedules:{b:{score:2},c:{score:3}}});
 const p={items:{a:{kind:'vocab',hanzi:'甲'},d:{kind:'vocab',hanzi:'丁'}},paragraphs:[{id:'p',tokens:[['a'],['d']]}]};
 assert.deepEqual(synonymRange(p,index,2),{min:.42,max:.97,available:true});
 assert.deepEqual(synonymRange(p,index,2.1),{min:.34,max:.42,available:true});
 assert.equal(deriveEdition(p,index,.43,{threshold:2}).changes.size,1);
 assert.equal(synonymRange(p,index,0).available,false);
});
