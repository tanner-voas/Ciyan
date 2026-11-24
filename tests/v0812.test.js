import test from 'node:test';
import assert from 'node:assert/strict';
import {MASTER} from '../master-data.js';
import {matchesTagFilters,tagMatches,nextTagFilterState,TAG_AND,TAG_OR,TAG_NOT} from '../tags.js';
import {defaultState} from '../storage.js';
import {normalizeGrammar,grammarTags} from '../grammar.js';
import {modeCounts,nextExercise} from '../study-engine.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';

const inTier=(card,max=12)=>card.tags.some(tag=>/^TSK\/TSK(0[1-9]|1[0-2])$/.test(tag)&&Number(tag.slice(-2))<=max);
const isHsk=card=>card.tags.some(tag=>tag.startsWith('HSK/'));

test('v0.8.12: TSK contains the exact non-HSK counts, and OR selects multiple exclusive tiers',()=>{
 assert.equal(MASTER.cards.filter(card=>inTier(card,8)&&!isHsk(card)).length,800);
 assert.equal(MASTER.cards.filter(card=>inTier(card)&&!isHsk(card)).length,1200);
 const firstEight=Object.fromEntries(Array.from({length:8},(_,i)=>[`TSK/TSK${String(i+1).padStart(2,'0')}`,TAG_OR]));
 const filters={...firstEight,HSK:TAG_NOT};
 assert.equal(MASTER.cards.filter(card=>matchesTagFilters(card.tags,filters)).length,800);
 assert.equal(MASTER.cards.filter(card=>matchesTagFilters(card.tags,{TSK:TAG_AND,HSK:TAG_NOT})).length,1200);
 assert.equal(MASTER.cards.filter(card=>matchesTagFilters(card.tags,{...filters,Food:TAG_AND})).every(card=>tagMatches(card.tags,'Food')),true);
});

test('v0.8.12: exact AND/OR/NOT semantics, exclusions win, parent paths and cycling',()=>{
 const mixed=['TSK/TSK01','HSK/HSK6','Food/china-food'];
 assert.equal(matchesTagFilters(mixed,{'TSK/TSK01':TAG_AND,Food:TAG_AND}),true);
 assert.equal(matchesTagFilters(mixed,{'TSK/TSK01':TAG_AND,Work:TAG_AND}),false);
 assert.equal(matchesTagFilters(mixed,{'TSK/TSK01':TAG_OR,'TSK/TSK02':TAG_OR}),true);
 assert.equal(matchesTagFilters(mixed,{'TSK/TSK02':TAG_OR,'TSK/TSK03':TAG_OR}),false);
 assert.equal(matchesTagFilters(mixed,{HSK:TAG_NOT,'TSK/TSK01':TAG_OR}),false);
 assert.equal(matchesTagFilters(mixed,{HSK:TAG_AND,'TSK/TSK02':TAG_OR}),false);
 assert.equal(matchesTagFilters(mixed,{HSK:TAG_AND,'TSK/TSK01':TAG_OR,Food:TAG_NOT}),false);
 assert.equal(matchesTagFilters(mixed,{}),true);
 assert.deepEqual([0,1,2,-1].map(nextTagFilterState),[1,2,-1,0]);
});

test('v0.8.12: grammar uses constituent vocabulary tag union for all three modes',()=>{
 const s=defaultState(),now=Date.now();
 s.cards=[
  {id:'a',hanzi:'我',pinyin:'wǒ',english:'I',tags:['HSK/HSK1','Everyday/daily']},
  {id:'b',hanzi:'去',pinyin:'qù',english:'go',tags:['Travel/transport','TSK/TSK01']},
  {id:'c',hanzi:'上班',pinyin:'shàngbān',english:'go to work',tags:['Work/work','HSK/HSK4']}
 ];
 s.grammar=[normalizeGrammar({id:'test-grammar',markup:'{我}{去}{上班}。',pinyin:'Wǒ qù shàngbān.',english:'I go to work.',tags:['Topics/Extra']})];
 s.schedules=Object.fromEntries(s.cards.map(card=>[card.id,{score:3,reps:2,dueAt:new Date(now+86400000).toISOString()}]));
 const g=s.grammar[0];assert.ok(grammarTags(g,s.cards).includes('Work/work'));
 const count=(tags)=>modeCounts(s,'grammar',{tags,search:''},now).eligible.length;
 assert.equal(count({HSK:TAG_AND,Travel:TAG_AND}),1); // different words satisfy each AND
 assert.equal(count({Work:TAG_NOT}),0); // no matching work word may remain
 assert.equal(count({TSK:TAG_OR,Food:TAG_OR}),1);
 assert.equal(count({Food:TAG_OR,Health:TAG_OR}),0);
 assert.equal(count({Work:TAG_NOT,Travel:TAG_OR}),0);
 assert.equal(count({'Topics/Extra':TAG_AND}),1); // explicit grammar tag
 assert.equal(count({HSK:TAG_NOT}),0);
 assert.equal(modeCounts(s,'words',{tags:{Work:TAG_NOT},search:''},now).eligible.length,2);
 const session={mode:'grammar',pool:'new',filters:{tags:{Work:TAG_NOT},search:''},skipped:[],deferred:{},turn:0};
 assert.equal(nextExercise(s,session,now),null);
});

test('v0.8.12: v0.8.11 backups migrate without modifying user data',()=>{
 assert.equal(APP_VERSION,'0.9.13');
 const prior={format:'ciyan-backup',version:2,appVersion:'0.8.11',state:{history:[{id:1}],filters:{tags:{Food:1}}}};
 const result=prepareVersionedBackup(prior);
 assert.equal(result.appVersion,'0.9.13');assert.deepEqual(result.state,prior.state);
});
