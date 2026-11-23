import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {MASTER} from '../master-data.js';
import catalog from '../chapters/index.js';
import {validateChapter,paragraphText,importChapterLexicon,acceptChapter} from '../reader-core.js';
import {defaultState,normalizeCard} from '../storage.js';
import {normalizeGrammar} from '../grammar.js';
import {reconcileBundledEditorial,reconcileBundledMaster} from '../master.js';
const root=new URL('../',import.meta.url);
const source=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));
const gradeFiles={hsk4:'graded-v099-hsk4',hsk5:'graded-v095-hsk5',hsk6:'graded-v094'};
const cardByWord=new Map(MASTER.cards.map(card=>[card.hanzi,card]));

test('v0.9.9 includes every annotated ordinary word, with nonempty Pinyin and English',async()=>{
 assert.equal(MASTER.cards.length,13391);
 assert.equal(MASTER.grammar.length,3449);
 for(const card of MASTER.cards)normalizeCard(card);
 for(const grammar of MASTER.grammar)normalizeGrammar(grammar);
 const covered={original:new Set(),hsk4:new Set(),hsk5:new Set(),hsk6:new Set()};
 for(let n=1;n<=23;n++){
  const original=source(`reader/panlong/chapters/${String(n).padStart(3,'0')}.json`);
  const assets={original};
  for(const [grade,folder] of Object.entries(gradeFiles))assets[grade]=(await import(`../chapters/${folder}/${n}.js`)).default;
  for(const [grade,asset] of Object.entries(assets)){
   validateChapter({...original,...asset});
   for(const item of Object.values(asset.items))if(item.kind==='vocab')covered[grade].add(item.hanzi);
  }
 }
 for(const [grade,words] of Object.entries(covered)){
  assert.ok(words.size>1000,grade);
  for(const word of words){
   const card=cardByWord.get(word);
   assert.ok(card,`${grade} is missing ${word}`);
   assert.ok(card.pinyin?.trim()&&card.english?.trim(),`${grade} incomplete dictionary for ${word}`);
  }
 }
});

test('v0.9.9 original annotation fix leaves source prose intact and upgrades Chapter 2 safely',()=>{
 const current=source('reader/panlong/chapters/002.json');
 const catalogEntry=catalog.find(x=>x.novel==='panlong'&&x.number===2);
 assert.equal(current.revision,47);assert.equal(current.editionVersion,46);
 assert.equal(catalogEntry.previousDigest,'e8b04f39e7180d613026987aea729ad9356b56675a27330abaaa7d01b6c20cbd');
 assert.ok(catalogEntry.previousDigests.includes('1899ed6ebb3823943e5cd2c8556eb48124af878d21fa2dbc67f30da7927915df'));
 const idx=current.paragraphs.findIndex(row=>paragraphText(current,row).includes('历史上传说中'));
 assert.ok(idx>=0);
 const words=current.paragraphs[idx].tokens.map(t=>typeof t==='string'?t:(t[1]??current.items[t[0]].hanzi));
 assert.ok(words.join('|').includes('历史|上|传说|中'));
 assert.ok(!words.includes('上传'));
 const previous={...current,revision:46};const state=defaultState();
 const first=source('reader/panlong/chapters/001.json');
 acceptChapter(state,first,catalog.find(x=>x.novel==='panlong'&&x.number===1).digest);
 acceptChapter(state,previous,catalogEntry.previousDigest);
 const saved=state.reader.panlong.chapters[1];
 saved.editionPrefs={graded:true,level:'hsk4',auto:true,restored:['p1:0']};
 saved.position={id:'p1',offset:0,sourceOffset:0,wordIndex:0};
 acceptChapter(state,current,catalogEntry.digest);
 assert.equal(state.reader.panlong.chapters[1].revision,47);
 assert.equal(state.reader.panlong.chapters[1].editionPrefs.level,'hsk4');
 assert.deepEqual(state.reader.panlong.chapters[1].editionPrefs.restored,[]);
});

test('v0.9.9 scored synonym graph has 4,374 reciprocal undirected pairs',()=>{
 const idMap=new Map(MASTER.cards.map(card=>[card.id,card]));
 const pairs=new Set();
 for(const card of MASTER.cards)for(const edge of card.synonyms||[]){
  assert.ok(edge.similarity>0&&edge.similarity<=1);
  const target=idMap.get(edge.id);
  assert.ok(target,`${card.hanzi} references absent synonym ${edge.id}`);
  assert.equal(target.synonyms?.find(reverse=>reverse.id===card.id)?.similarity,edge.similarity);
  pairs.add([card.id,target.id].sort().join('|'));
 }
 assert.equal(pairs.size,4374);
});

test('v0.9.9 bundled enrichment preserves user edits and review identity',()=>{
 const source=cardByWord.get('合同');
 const other=MASTER.cards.find(c=>(source.synonyms||[]).some(e=>e.id===c.id));
 assert.ok(other);
 const local={id:source.id,hanzi:'合同',pinyin:'hé tong',english:'CUSTOM EDIT',tags:['My/custom'],synonyms:[]};
 const copy={id:other.id,hanzi:other.hanzi,pinyin:other.pinyin,english:other.english,tags:[],synonyms:[]};
 const state={cards:[local,copy],grammar:[],schedules:{[local.id]:{score:2.5}},history:[{cardId:local.id,grade:4}]};
 const first=reconcileBundledEditorial(state,MASTER);
 assert.ok(first.changed);assert.equal(local.pinyin,'hé tóng');assert.equal(local.english,'CUSTOM EDIT');
 assert.ok(local.tags.includes('My/custom'));
 assert.equal(local.synonyms.find(e=>e.id===copy.id)?.similarity,source.synonyms.find(e=>e.id===copy.id)?.similarity);
 const snapshot=structuredClone(state);const second=reconcileBundledEditorial(state,MASTER);
 assert.equal(second.changed,false);assert.deepEqual(state,snapshot);
 assert.equal(state.schedules[local.id].score,2.5);assert.equal(state.history.length,1);
});


test('v0.9.9 merges synonyms safely when custom card IDs collide with new bundled cards',()=>{
 const bundled={cards:[
  {id:'entry-huran',hanzi:'忽然',pinyin:'hū rán',english:'suddenly',tags:['Topic/time'],synonyms:[{id:'entry-turan',similarity:.94}]},
  {id:'entry-turan',hanzi:'突然',pinyin:'tū rán',english:'abruptly',tags:[],synonyms:[{id:'entry-huran',similarity:.94}]},
 ],grammar:[]};
 const custom={id:'entry-huran',hanzi:'自定义',pinyin:'zì dìng yì',english:'Custom item',tags:['My/custom'],synonyms:[]};
 const existing={id:'my-turan',hanzi:'突然',pinyin:'tū rán',english:'MY DEFINITION',tags:['My/custom'],synonyms:[]};
 const state={cards:[custom,existing],grammar:[],history:[{cardId:'entry-huran',grade:5}],schedules:{'entry-huran':{score:3}}};
 const merge=reconcileBundledMaster(state,bundled);
 assert.equal(merge.addedCards,1);
 const newCard=state.cards.find(card=>card.hanzi==='忽然');
 assert.notEqual(newCard.id,custom.id);
 assert.deepEqual(newCard.synonyms,[{id:existing.id,similarity:.94}]);
 const editorial=reconcileBundledEditorial(state,bundled);
 assert.equal(editorial.links,1);
 assert.deepEqual(existing.synonyms,[{id:newCard.id,similarity:.94}]);
 assert.equal(existing.english,'MY DEFINITION');
 assert.equal(state.schedules[custom.id].score,3);
 assert.equal(state.history[0].cardId,custom.id);
 assert.equal(reconcileBundledEditorial(state,bundled).changed,false);
});

test('v0.9.9 mirrors existing one-way synonym scores without replacing user ratings',()=>{
 const bundled={cards:[
  {id:'a-source',hanzi:'安静',synonyms:[{id:'b-source',similarity:.92}],tags:[]},
  {id:'b-source',hanzi:'宁静',synonyms:[{id:'a-source',similarity:.92}],tags:[]},
 ],grammar:[]};
 const first={id:'a-local',hanzi:'安静',tags:[],synonyms:[{id:'b-local',similarity:.66}]};
 const second={id:'b-local',hanzi:'宁静',tags:[],synonyms:[]};
 const state={cards:[first,second],grammar:[]};
 const result=reconcileBundledEditorial(state,bundled);
 assert.equal(result.links,1);
 assert.deepEqual(first.synonyms,[{id:'b-local',similarity:.66}]);
 assert.deepEqual(second.synonyms,[{id:'a-local',similarity:.66}]);
 assert.equal(reconcileBundledEditorial(state,bundled).changed,false);
});
