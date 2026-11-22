import test from 'node:test';
import assert from 'node:assert/strict';
import {learnerIndex,deriveEdition} from '../reader-editions.js';
import catalog from '../chapters/index.js';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateChapter,chapterText,acceptChapter,importChapterLexicon,readerAnalysis} from '../reader-core.js';
import {defaultState} from '../storage.js';
const source=path=>JSON.parse(fs.readFileSync(new URL('../reader/panlong/'+path,import.meta.url)));
const corpus=source('pass45/corpus.json'),reg=source('pass45/register.json');
const extras=new Set(reg.ordinary.map(r=>r.word)),terms=new Set(reg.terms.map(r=>r.term)),base=new Set(reg.baseline);
test('Pass 45: all 23 aligned editions reproduce the locked prose, vocabulary, notes and term register',async()=>{
 const seen=new Set(),named=new Set(),fallback=new Set(),noteIds=new Set();let count=0;
 for(const entry of catalog.filter(e=>e.novel==='panlong')){
  const n=entry.number,stem=String(n).padStart(3,'0'),locked=corpus[n-1];
  const bytes=fs.readFileSync(new URL('../reader/panlong/chapters/'+stem+'.json',import.meta.url));
  const original=JSON.parse(bytes),{default:a}=await import('../chapters/'+entry.gradedFile);
  const p={...original,...a};validateChapter(p);validateChapter(original);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.digest);
  assert.equal(a.sourceDigest,entry.digest);assert.deepEqual(new Set(a.extras),extras);
  assert.equal(chapterText(original),[locked.title,...locked.original].join('\n\n'));
  assert.equal(chapterText(p),[locked.title,...locked.graded].join('\n\n'));
  const actualFallback=new Set();
  for(const [i,row] of a.paragraphs.entries()){
   count++;assert.equal(row.id,original.paragraphs[i].id);assert.equal(row.anchors.length,row.tokens.length);
   assert.ok(row.anchors.every((x,j)=>Number.isInteger(x)&&x>=0&&x<locked.original[i].length&&(!j||x>=row.anchors[j-1])));
   for(const t of row.tokens)if(Array.isArray(t)){
    const item=a.items[t[0]];assert.ok(item);
    if(item.kind==='vocab'){if(extras.has(item.hanzi))seen.add(item.hanzi);else if(!base.has(item.hanzi))actualFallback.add(item.hanzi);}
   }
  }
  assert.deepEqual(actualFallback,new Set(a.fallbackVocabulary));for(const w of actualFallback)fallback.add(w);
  for(const id of a.lexicon.terms){const w=a.items[id].hanzi;assert.ok(terms.has(w));named.add(w);assert.ok(original.lexicon.terms.includes(id),'Original must include graded term '+w);}
  for(const id of Object.keys(a.grammarCards))if(id.startsWith('grammar-pass45-'))noteIds.add(id);
 }
 assert.equal(count,1648);assert.equal(seen.size,336);assert.deepEqual(seen,extras);assert.deepEqual(named,terms);
 assert.equal(noteIds.size,40);assert.deepEqual(fallback,new Set(source('pass45/build-report.json').gradedFallback));
});
test('preview obeys threshold and evidence, respects restored occurrences, and leaves history unchanged',()=>{
 const state={cards:[{id:'a',hanzi:'忽然',synonyms:[{id:'b',similarity:.94}]},{id:'b',hanzi:'突然',english:'suddenly',pinyin:'tūrán'}],history:[],schedules:{b:{score:2}}};
 const p={paragraphs:[{id:'p1',tokens:[['a'],'。']}],items:{a:{kind:'vocab',hanzi:'忽然'}}};
 function run(min,opts){return deriveEdition(p,learnerIndex(state),min,opts);}
 assert.equal(run(.90).changes.size,0);
 state.history=[1,2].map(day=>({cardId:'b',grade:3,at:'2026-11-0'+day+'T08:00:00Z'}));
 const copy=structuredClone(state);assert.equal(run(.95).changes.size,0);
 const r=run(.94);assert.equal(r.changes.size,1);assert.equal(r.stats.strength,.94);assert.equal(r.stats.after,2);
 assert.equal(run(.94,{restore:new Set(['p1:0'])}).changes.size,0);assert.deepEqual(copy,state);
});
