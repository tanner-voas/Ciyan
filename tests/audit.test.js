import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultState,mergeDeck,makeBackup,parseBackup,normalizeCard} from '../storage.js';
import {linkedWords,grammarTags,grammarMistakes,toneTargets,requiredWords,normalizeGrammar} from '../grammar.js';
import {scheduleReview} from '../fsrs.js';
import {DECKS} from '../deck-catalog.js';
const read=id=>JSON.parse(fs.readFileSync(new URL('../decks/'+id+'.json',import.meta.url)));
test('the bundled master validates and has unique word and grammar IDs',()=>{
 const all=read('all-decks');let state=defaultState();const result=mergeDeck(state,all);state=result.draft;
 assert.equal(all.cards.length,2278);assert.equal(all.grammar.length,1549);
 assert.equal(new Set(state.cards.map(c=>c.hanzi)).size,state.cards.length);
 assert.equal(new Set(state.cards.map(c=>c.id)).size,state.cards.length);
 assert.equal(new Set(state.grammar.map(g=>g.id)).size,state.grammar.length);
 const repeated=mergeDeck(state,all);assert.equal(repeated.addedWords,0);assert.equal(repeated.addedGrammar,0);
});
test('expanded decks preserve learned schedules and customized words',()=>{
 let state=defaultState();const card=state.cards[0];card.english='My own meaning';
 state.schedules[card.id]=scheduleReview(null,3,Date.now());state.history=[{cardId:card.id,grade:3,at:new Date().toISOString()}];
 const before=structuredClone(state);const merged=mergeDeck(state,read('all-decks')).draft;
 assert.deepEqual(merged.schedules,before.schedules);assert.deepEqual(merged.history,before.history);
 assert.equal(merged.cards.find(c=>c.id===card.id).english,'My own meaning');assert.deepEqual(state,before);
 const restored=parseBackup(makeBackup(merged));assert.deepEqual(restored.cards,merged.cards);assert.deepEqual(restored.history,merged.history);
});
test('grammar deck includes every prerequisite and valid distractor index',()=>{
 const d=read('practical-grammar');
 for(const g of d.grammar){assert.doesNotThrow(()=>normalizeGrammar(g));assert.ok(requiredWords(g,d.cards).every(x=>x.card),g.markup);}
});
test('grammar links use tokens, not substrings',()=>{
 const cards=[{hanzi:'我',tags:['person']},{hanzi:'时间',tags:['time']},{hanzi:'间',tags:['wrong']}];
 const g={markup:'{我}{有}{时间}。'};assert.deepEqual(linkedWords(g,cards).map(c=>c.hanzi),['我','时间']);assert.deepEqual(grammarTags(g,cards),['person','time']);
});
test('interchangeable duplicate words and identical distractors grade by visible text',()=>{
 const g={markup:'{我}{吃}{了}，{你}{吃}{吗}？',distractors:[{index:2,word:'吃'}]};
 assert.deepEqual(grammarMistakes(g,['t0','t4','t2','t3','t1','t5']),[]);
 assert.deepEqual(grammarMistakes(g,['t0','d0','t2','t3','t4','t5']),[]);
 assert.deepEqual(grammarMistakes(g,['t1','t0','t2','t3','t4','t5']),[0,1]);
});
test('all generated pinyin matches character count and explicit syllable tones',()=>{
 const marks='āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
 for(const c of read('all-decks').cards){
  const syll=c.pinyin.split(/\s+/);
  const actual=toneTargets(c.hanzi,c.pinyin);
  assert.equal(actual?.length,[...c.hanzi].length,c.hanzi);
  if(syll.length===[...c.hanzi].length){
    const expected=syll.map(s=>Math.max(0,...[...s].map(ch=>marks.includes(ch)?marks.indexOf(ch)%4+1:0)));
    assert.deepEqual(actual,expected,c.hanzi);
  }
 }
 assert.deepEqual(toneTargets('西安','xī ān'),[1,1]);assert.deepEqual(toneTargets('你好','ni3 hao3'),[3,3]);
});
test('exactly one canonical HSK band is used by every matching vocabulary word',()=>{
 const ref=JSON.parse(fs.readFileSync(new URL('../content/hsk-levels-032.json',import.meta.url)));
 const all=read('all-decks');
 const bands=new Set(['hsk1','hsk2','hsk3','hsk4','hsk5','hsk6','hsk7-9'].map(x=>'HSK/'+x.toUpperCase()));
 for(const c of all.cards){
  const matching=c.tags.filter(t=>bands.has(t)).map(t=>t.split("/")[1].toLowerCase());
  assert.deepEqual(matching,ref[c.hanzi]?[ref[c.hanzi].toLowerCase()]:[],c.hanzi);
  assert.ok(c.tags.every(t=>!t.startsWith('hsk-2021')&&t!=='hsk'&&!t.includes('3.0')),c.hanzi);
 }
 for(const band of bands){
  const d=read(band.split("/")[1].toLowerCase());
  const tagged=all.cards.filter(c=>c.tags.includes(band));
  assert.ok(tagged.length>0,band);
  const names=new Set(d.cards.map(c=>c.hanzi));
  for(const c of tagged)if(c.hanzi!=='地')assert.ok(names.has(c.hanzi),`${band}: ${c.hanzi}`);
 }
 for(let n=1;n<=4;n++){
  const original=fs.readFileSync(new URL(`../content/hsk-${n}.tsv`,import.meta.url),'utf8').trim().split('\n');
  const allNames=new Set(all.cards.map(c=>c.hanzi));
  for(const row of original)assert.ok(allNames.has(row.split('\t')[0]),row);
 }
});
test('reject corrupt numeric schedules and reserved object keys',()=>{
 const state=defaultState(),id=state.cards[0].id;state.schedules[id]=scheduleReview(null,3,Date.now());
 for(const bad of ['oops',null,-1,Infinity]){const b=makeBackup(structuredClone(state));b.state.schedules[id].stability=bad;assert.throws(()=>parseBackup(b),/Invalid memory schedule/);}
 for(const id of ['__proto__','constructor','prototype',' toString ',' __proto__ '])assert.throws(()=>normalizeCard({id,hanzi:'词',english:'word'}),/Reserved/);
});
test('future deck versions are rejected without modifying data',()=>{
 const state=defaultState(),before=structuredClone(state);assert.throws(()=>mergeDeck(state,{format:'ciyan-deck',version:999,cards:[]}),/version/);assert.deepEqual(state,before);
});
