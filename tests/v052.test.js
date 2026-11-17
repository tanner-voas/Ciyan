import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultState,migrateState,makeBackup,parseBackup} from '../storage.js';
import {replaceMaster} from '../master.js';
import {MASTER} from '../master-data.js';
import {ensureStudy,modeCounts,nextExercise,newVocabRemaining,sessionAvailability} from '../study-engine.js';
import {newWordOdds,weightForNewCard,validatedTagWeights,leafTagPaths} from '../tag-weights.js';
import {scheduleReview} from '../review-scheduler.js';
const now=Date.parse('2026-11-17T07:00:00Z');
const card=(id,tags=[])=>({id,hanzi:id,pinyin:'x',english:id,tags});
const session=(mode='words',pool='all',filters=null)=>({mode,pool,filters:filters||{tags:{},search:''},skipped:[],deferred:{},turn:0});
const due=(s,c,at=now)=>({...scheduleReview(null,3,at-86400000,s.settings),dueAt:new Date(at-1).toISOString()});
const future=(s,c,at=now)=>({...scheduleReview(null,3,at,s.settings),dueAt:new Date(at+86400000).toISOString()});

test('v0.5.2 leaf weight is max(1, 1 + sum) with neutral, negative, decimal and mixed paths',()=>{
 const a=card('a',['HSK/HSK1','Food/fruit']),b=card('b',['HSK/HSK1']),c=card('c',[]);
 const weights={'HSK/HSK1':-5.5,'Food/fruit':5.25};
 assert.equal(weightForNewCard(a,weights),1); // 1 + (-5.5 + 5.25) clamps to 1
 assert.equal(weightForNewCard(b,weights),1);
 assert.equal(weightForNewCard(c,weights),1);
 assert.equal(weightForNewCard(a,{'HSK/HSK1':1.2,'Food/fruit':.5}),2.7);
 assert.equal(weightForNewCard(a,{}),1);
 assert.equal(weightForNewCard(b,{'HSK/HSK1':-100000}),1);
 assert.deepEqual(validatedTagWeights({'HSK/HSK1':0,'Food/fruit':-0.125}),{'HSK/HSK1':0,'Food/fruit':-0.125});
});

test('tag odds are inclusive across multi-tag cards and reflect clamped card weight',()=>{
 const cards=[card('a',['Food/fruit','HSK/HSK1']),card('b',['HSK/HSK1']),card('c',['Food/fruit'])];
 const weights={'Food/fruit':2.5,'HSK/HSK1':-1.5}; // a=2, b=1, c=3.5
 const x=newWordOdds(cards,{},weights);
 assert.equal(x.totalWeight,6.5);
 assert.equal(x.odds['Food/fruit'],100*5.5/6.5);
 assert.equal(x.odds['HSK/HSK1'],100*3/6.5);
 const y=newWordOdds(cards,{a:{}},weights);
 assert.equal(y.totalWeight,4.5);
 assert.equal(y.odds['Food/fruit'],100*3.5/4.5);
 assert.equal(y.odds['HSK/HSK1'],100/4.5);
});

test('migrate old auto-populated 1 to 0 once, preserve custom values and explicit new-version 1',()=>{
 const legacy=defaultState();delete legacy.settings.tagWeightDefaultsVersion;
 legacy.settings.tagWeights={'HSK/HSK1':1,'Food/china-food':2.5,'Activities/climbing':-1.25};
 const converted=migrateState(legacy);
 assert.equal(converted.settings.tagWeights['HSK/HSK1'],0);
 assert.equal(converted.settings.tagWeights['Food/china-food'],2.5);
 assert.equal(converted.settings.tagWeights['Activities/climbing'],-1.25);
 assert.equal(converted.settings.tagWeightDefaultsVersion,'v0.5.2');
 ensureStudy(converted);assert.equal(converted.settings.tagWeights['HSK/HSK1'],0);
 const restored=parseBackup(makeBackup(converted));
 assert.equal(restored.settings.tagWeights['Food/china-food'],2.5);
 assert.equal(restored.settings.tagWeights['HSK/HSK1'],0);
 restored.settings.tagWeights['HSK/HSK1']=1;
 ensureStudy(restored);assert.equal(restored.settings.tagWeights['HSK/HSK1'],1);
 const oldBackup=makeBackup(legacy);const migratedBackup=parseBackup(oldBackup);
 assert.equal(migratedBackup.settings.tagWeights['HSK/HSK1'],0);
});

test('all new neutral tag values are added on first population and after master changes',()=>{
 const s=defaultState();replaceMaster(s,MASTER);ensureStudy(s);
 const leaves=leafTagPaths(s.cards);
 assert.ok(leaves.length>50);
 assert.equal(leaves.filter(t=>s.settings.tagWeights[t]!==0).length,0);
 const extra=card('new-word',['Topics/BrandNew']);s.cards.push(extra);ensureStudy(s);
 assert.equal(s.settings.tagWeights['Topics/BrandNew'],0);
});

test('vocabulary total is due + min(filtered new, daily remaining), excluding future reviews',()=>{
 const s=defaultState();s.cards=[card('a',['Food/fruit']),card('b',['Food/fruit']),card('c',['Food/fruit']),card('d',['Food/fruit']),card('e',['HSK/HSK1']),card('f',['HSK/HSK1'])];
 s.grammar=[];s.settings.newWordsPerDay=1;
 s.schedules.a=due(s,s.cards[0]);s.schedules.b=future(s,s.cards[1]);
 let count=modeCounts(s,'words',null,now);
 assert.deepEqual([count.due,count.started,count.new,count.newTotal,count.available],[1,1,1,4,2]);
 count=modeCounts(s,'words',{tags:{Food:1},search:''},now);
 assert.deepEqual([count.due,count.started,count.new,count.newTotal,count.available],[1,1,1,2,2]);
 count=modeCounts(s,'words',{tags:{HSK:1},search:''},now);
 assert.deepEqual([count.due,count.started,count.new,count.newTotal,count.available],[0,0,1,2,1]);
 s.history.push({cardId:'c',first:true,at:new Date(now).toISOString()});
 count=modeCounts(s,'words',{tags:{Food:1},search:''},now);
 assert.deepEqual([count.due,count.started,count.new,count.newTotal,count.available],[1,1,0,2,1]);
 s.settings.newWordsPerDay=null;assert.equal(modeCounts(s,'words',null,now).available,5);
});

test('zero daily budget still shows due, but not new; pool and mode apply to displayed availability',()=>{
 const s=defaultState();s.cards=[card('a'),card('b'),card('c')];s.grammar=[];s.settings.newWordsPerDay=0;
 s.schedules.a=due(s,s.cards[0]);s.schedules.b=future(s,s.cards[1]);
 const all=session(),dueOnly=session('words','due'),newOnly=session('words','new');
 assert.deepEqual([sessionAvailability(s,all,now).available,sessionAvailability(s,dueOnly,now).available,sessionAvailability(s,newOnly,now).available],[1,1,0]);
 assert.equal(nextExercise(s,all,now,()=>0).id,'a');
 assert.equal(nextExercise(s,newOnly,now,()=>0),null);
});
