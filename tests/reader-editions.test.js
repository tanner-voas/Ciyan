import test from 'node:test';
import assert from 'node:assert/strict';
import {learnerIndex,deriveEdition} from '../reader-editions.js';
import catalog from '../chapters/index.js';
import {MASTER} from '../master-data.js';
test('all graded assets map back to hosted originals and introduce their teaching words on schedule',async()=>{
 const base=new Set(MASTER.cards.filter(c=>c.tags.some(t=>/^HSK\/HSK[1-6]$|^TSK\/TSK(0[1-9]|1[0-2])$/.test(t))).map(c=>c.hanzi));
 let count=0;const seen=new Set();
 for(const entry of catalog.filter(e=>e.novel==='panlong')){
  const {default:a}=await import('../chapters/graded-v090/'+entry.number+'.js');
  assert.equal(a.sourceDigest,entry.digest);const extras=new Set(a.extras);
  for(const row of a.paragraphs){
   count++;assert.equal(row.anchors.length,row.tokens.length);
   for(const t of row.tokens)if(Array.isArray(t)){
    const item=a.items[t[0]];assert.ok(item);
    if(item.kind==='vocab'){assert.ok(base.has(item.hanzi)||extras.has(item.hanzi));if(extras.has(item.hanzi))seen.add(item.hanzi);}
   }
  }
  assert.deepEqual(seen,extras);
 }
 assert.equal(count,1648);assert.equal(seen.size,200);
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
