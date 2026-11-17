import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_RETRY,interpolatedSeconds,scheduleReview} from '../review-scheduler.js';
import {defaultState,makeBackup,parseBackup} from '../storage.js';
import {leafTagPaths,newWordOdds,weightForNewCard,validatedTagWeights} from '../tag-weights.js';
import {contextsForWord,grammarQualification} from '../grammar-context.js';
import {candidates,nextExercise,ensureStudy} from '../study-engine.js';
const at=Date.parse('2026-11-17T12:00:00Z');
const card=(id,tags)=>({id,hanzi:id,pinyin:'x',english:id,tags});
const session=(mode='words',pool='all')=>({mode,pool,spent:{},results:[],skipped:[],turn:0,filters:{tags:{},search:''}});

test('new default score 2 is three days; other anchors stay unchanged',()=>{
 assert.deepEqual(DEFAULT_RETRY,[{value:10,unit:'minutes'},{value:6,unit:'hours'},{value:3,unit:'days'},{value:2,unit:'weeks'}]);
 assert.equal(interpolatedSeconds(2),259200);
 assert.equal(interpolatedSeconds(1),21600);
 assert.equal(interpolatedSeconds(3),14*86400);
});
test('leaf paths use actual loaded tags; a card sums its leaf weights',()=>{
 const cards=[card('a',['Food/Chinese/Noodles','HSK/HSK2']),card('b',['Food/Chinese/Soup']),card('c',[])];
 assert.deepEqual(leafTagPaths(cards),['Food/Chinese/Noodles','Food/Chinese/Soup','HSK/HSK2']);
 const weights={'Food/Chinese/Noodles':3,'HSK/HSK2':2,'Food/Chinese/Soup':4};
 assert.equal(weightForNewCard(cards[0],weights),5);assert.equal(weightForNewCard(cards[1],weights),4);assert.equal(weightForNewCard(cards[2],weights),1);
 const all=newWordOdds(cards,{},weights);assert.equal(all.totalWeight,10);assert.equal(all.untagged,1);
 assert.equal(all.odds['Food/Chinese/Noodles'],50);assert.equal(all.odds['HSK/HSK2'],50);assert.equal(all.odds['Food/Chinese/Soup'],40);
 assert.equal(all.newCount,3); // Inclusive tag percentages overlap by design.
});
test('odds decline as tagged words are introduced, without modifying saved preferences',()=>{
 const cards=[card('a',['HSK/HSK1']),card('b',['HSK/HSK1']),card('c',['Food/food'])],prefs={'HSK/HSK1':4,'Food/food':1};
 const initial=newWordOdds(cards,{},prefs);assert.equal(initial.odds['HSK/HSK1'],800/9/1); // 8 / 9
 const remaining=newWordOdds(cards,{a:{dueAt:new Date(at).toISOString()}},prefs);
 assert.equal(remaining.odds['HSK/HSK1'],80);assert.equal(remaining.newCount,2);assert.deepEqual(prefs,{'HSK/HSK1':4,'Food/food':1});
 const empty=newWordOdds(cards,Object.fromEntries(cards.map(c=>[c.id,{}])),prefs);
 assert.equal(empty.totalWeight,0);assert.equal(empty.odds['HSK/HSK1'],0);
});
test('tag settings validate 1 minimum and protect against malicious keys',()=>{
 for(const v of [0,-1,NaN,Infinity,1000001,'abc'])assert.throws(()=>validatedTagWeights({'Food/food':v}));
 assert.equal(validatedTagWeights({'Food/food':2.5})['Food/food'],2.5);
 assert.throws(()=>validatedTagWeights(JSON.parse('{"__proto__": 2}')));
});
test('new vocabulary selections use total tag weight, not per-tag frequency alone',()=>{
 const s=defaultState();s.cards=[card('a',['Food/food','HSK/HSK1']),card('b',['Food/food']),card('c',[])];s.grammar=[];
 s.settings.tagWeights={'Food/food':2,'HSK/HSK1':3};
 const items=candidates(s,'words',false,at);
 assert.deepEqual(items.map(x=>x.urgency),[5,2,1]);
 assert.equal(nextExercise(s,session('words','new'),at,()=>0).id,'a');
 assert.equal(nextExercise(s,session('words','new'),at,()=>.8).id,'b');
 assert.equal(nextExercise(s,session('words','new'),at,()=>.99).id,'c');
});
test('due review weight is exactly elapsed time / scheduled interval',()=>{
 const s=defaultState();s.cards=s.cards.slice(0,2);s.grammar=[];
 const interval=2.34*60*60*1000;
 for(const [i,h] of [13,2.34].entries()){
  const c=s.cards[i],prior=scheduleReview(null,3,at-h*3600000,s.settings);
  s.schedules[c.id]={...prior,lastReviewedAt:new Date(at-h*3600000).toISOString(),intervalMinutes:interval/60000,dueAt:new Date(at-h*3600000+interval).toISOString()};
 }
 const due=candidates(s,'words',false,at);
 assert.ok(Math.abs(due[0].urgency-13/2.34)<1e-10);assert.ok(Math.abs(due[1].urgency-1)<1e-10);
 assert.equal(nextExercise(s,session('words','due'),at,()=>0).id,s.cards[0].id);
 assert.equal(nextExercise(s,session('words','due'),at,()=>.99).id,s.cards[1].id);
});
test('due selection uses actual review interval even if user changes future-only anchors',()=>{
 const s=defaultState();s.cards=s.cards.slice(0,1);const c=s.cards[0];
 s.schedules[c.id]={...scheduleReview(null,4,at-13*3600000,s.settings),intervalMinutes:2.34*60,lastReviewedAt:new Date(at-13*3600000).toISOString(),dueAt:new Date(at-10*3600000).toISOString()};
 s.settings.retryIntervals[2]={value:1,unit:'days'};
 assert.ok(Math.abs(candidates(s,'words',false,at)[0].urgency-13/2.34)<1e-10);
});
test('new grammar remains unweighted by vocabulary tag totals',()=>{
 const s=defaultState();s.settings.tagWeights={'Food/food':1000};
 for(const c of s.cards)s.schedules[c.id]={...scheduleReview(null,4,at-86400000,s.settings),score:2.5};
 const grammar=candidates(s,'grammar',false,at);
 assert.ok(grammar.length>0);assert.ok(grammar.every(x=>x.urgency===1));
});
test('context shows every qualified grammar and no unqualified when qualified exist',()=>{
 const a=card('a',[]),b=card('b',[]),c=card('c',[]);
 const gram=(id,words,alts=[])=>({id,markup:words.map(w=>`{${w}}`).join('')+'。',pinyin:'xx',english:'example',distractors:alts.map(word=>({index:1,word}))});
 const s=defaultState();s.cards=[a,b,c];s.grammar=[gram('g1',['a','b']),gram('g2',['a','c']),gram('g3',['a','b'],['c'])];
 for(const [id,score] of [['a',2.5],['b',2.2],['c',.5]])s.schedules[id]={...scheduleReview(null,3,at,s.settings),score};
 const examples=contextsForWord(s,a);assert.deepEqual(examples.map(x=>x.grammar.id),['g1']);
 s.schedules.c.score=2.2;assert.deepEqual(contextsForWord(s,a).map(x=>x.grammar.id),['g1','g2','g3']);
 const map=new Map(s.cards.map(c=>[c.hanzi,c]));assert.equal(grammarQualification(s.grammar[0],map,id=>s.schedules[id].score).qualified,true);
});
test('no qualified context uses one top-scoring example and randomizes exact ties',()=>{
 const a=card('a',[]),b=card('b',[]),c=card('c',[]);
 const g=(id,w)=>({id,markup:`{a}{${w}}。`,pinyin:'xy',english:id,distractors:[]});
 const s=defaultState();s.cards=[a,b,c];s.grammar=[g('g1','b'),g('g2','c')];
 for(const id of ['a','b','c'])s.schedules[id]={...scheduleReview(null,2,at,s.settings),score:.5};
 assert.equal(contextsForWord(s,a,()=>0).length,1);assert.equal(contextsForWord(s,a,()=>0)[0].grammar.id,'g1');
 assert.equal(contextsForWord(s,a,()=>.99)[0].grammar.id,'g2');
 s.schedules.b.score=1.5;assert.equal(contextsForWord(s,a,()=>.99)[0].grammar.id,'g1');
});
test('tag preferences live in full backups, not master files, and missing tags initialize to 1',()=>{
 const s=defaultState();s.settings.tagWeights={'HSK/HSK1':7,'Food/china-food':2};
 const restored=parseBackup(makeBackup(s));assert.equal(restored.settings.tagWeights['HSK/HSK1'],7);
 assert.equal(restored.settings.tagWeights['Food/china-food'],2);
 assert.equal(restored.cards[0].tagWeights,undefined);
 const fresh=defaultState();fresh.cards.push(card('new',['Topics/NewTopic']));ensureStudy(fresh);
 assert.equal(fresh.settings.tagWeights['Topics/NewTopic'],1);
 const bad=makeBackup(s);bad.state.settings.tagWeights['HSK/HSK1']=0;assert.throws(()=>parseBackup(bad));
});
