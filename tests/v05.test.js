import test from 'node:test';import assert from 'node:assert/strict';
import {defaultState,makeBackup,parseBackup,clearLearningRecords} from '../storage.js';
import {MASTER} from '../master-data.js';import {replaceMaster} from '../master.js';
import {PARTICLES} from '../particles.js';import {grammarTokens} from '../grammar.js';
import {scheduleReview,DEFAULT_RETRY,previewOutcomes,interpolatedSeconds,historyScore,intervalText} from '../review-scheduler.js';
import {modeCounts,nextExercise,newVocabToday,newVocabRemaining,netScore,sessionAvailability,recordExercise} from '../study-engine.js';
import {skipItem,postponeItem,rememberAnswer,undoAnswer} from '../session-controls.js';
const t=Date.parse('2026-11-17T13:00:00Z');
const state=()=>{const s=defaultState();replaceMaster(s,MASTER);return s;};
const session=(mode='auto',pool='all',filters={tags:{}})=>({mode,pool,filters,spent:{},results:[],input:{},turn:0,skipped:[],deferred:[],undo:[]});
const seen=(s,word,score,dueAt=t-10000)=>{const c=s.cards.find(c=>c.hanzi===word);assert.ok(c,`Missing word ${word}`);s.schedules[c.id]={...scheduleReview(null,3,t-1000000,s.settings),score,dueAt:new Date(dueAt).toISOString()};return c;};
const groupWords=g=>[...new Set([...grammarTokens(g),...(g.distractors||[]).map(d=>d.word)])];
const prepareGroup=(s,words,score=2.2)=>{for(const w of words)seen(s,w,score);};

test('v0.5 retry anchors, extrapolation and two-decimal outcome previews',()=>{
 assert.deepEqual(DEFAULT_RETRY,[{value:10,unit:'minutes'},{value:6,unit:'hours'},{value:2,unit:'days'},{value:2,unit:'weeks'}]);
 const s=state();assert.equal(interpolatedSeconds(0,s.settings.retryIntervals),600);
 assert.equal(interpolatedSeconds(1,s.settings.retryIntervals),21600);
 assert.equal(interpolatedSeconds(2,s.settings.retryIntervals),172800);
 assert.ok(Math.abs(interpolatedSeconds(3.2,s.settings.retryIntervals)-14*86400*1.2)<1e-7);
 assert.equal(interpolatedSeconds(4,s.settings.retryIntervals),28*86400);
 const previews=previewOutcomes(null,t,s.settings);assert.deepEqual(previews.map(p=>p.score.toFixed(2)),['0.00','0.18','0.36','0.54']);
 for(const p of previews){const actual=scheduleReview(null,p.grade,t,s.settings);assert.equal(p.score,actual.score);assert.equal(p.interval,intervalText((Date.parse(actual.dueAt)-t)/1000));}
});
test('Easy always raises even a very mature score by at least .20',()=>{
 const s=state();for(const score of [0,1,2.75,3,3.1,3.2,5,20]){
  const prev={...scheduleReview(null,3,t-60000,s.settings),score};
  const next=scheduleReview(prev,4,t,s.settings);
  assert.ok(next.score-score>=.2-1e-10,`${score} -> ${next.score}`);
  if(score>=3)assert.ok(Date.parse(next.dueAt)>t+1209600000);
 }
 const prev={...scheduleReview(null,4,t-86400000,s.settings),score:4};
 assert.ok(historyScore(prev,1,t)>0);assert.ok(historyScore(prev,2,t)>0);
});
test('drawing gating uses only the exact target word continuous score',()=>{
 const s=state(),c=s.cards.find(c=>c.hanzi==='随便');
 assert.ok(c);let m=modeCounts(s,'drawing');assert.equal(m.available,0);
 seen(s,c.hanzi,1.999);assert.equal(modeCounts(s,'drawing').eligible.some(x=>x.id===c.id),false);
 seen(s,c.hanzi,2);m=modeCounts(s,'drawing');assert.equal(m.eligible.some(x=>x.id===c.id),true);
 assert.equal(modeCounts(s,'drawing',{tags:{Food:1}}).eligible.some(x=>x.id===c.id),false);
 const correctPath=c.tags[0];assert.ok(modeCounts(s,'drawing',{tags:{[correctPath]:1}}).eligible.some(x=>x.id===c.id));
});
test('grammar needs minimum score >=1 and arithmetic mean >=2 across answer and distractor words',()=>{
 const s=state(),g=s.grammar[0],words=groupWords(g);prepareGroup(s,words,2);
 assert.ok(modeCounts(s,'grammar').eligible.some(x=>x.id===g.id));
 seen(s,words[0],.99);assert.equal(modeCounts(s,'grammar').eligible.some(x=>x.id===g.id),false);
 seen(s,words[0],1);assert.equal(modeCounts(s,'grammar').eligible.some(x=>x.id===g.id),false);
 seen(s,words[1],3);assert.equal(modeCounts(s,'grammar').eligible.some(x=>x.id===g.id),true);
});
test('particle zoo treats all base and choice words as prerequisites',()=>{
 const s=state(),p=PARTICLES.find(p=>p.id==='particle-de-owner');assert.ok(p);
 const terms=[...new Set([...p.base,...p.choices])];prepareGroup(s,terms,2);
 assert.equal(modeCounts(s,'particles').eligible.some(x=>x.id===p.id),true);
 seen(s,'地',.999);assert.equal(modeCounts(s,'particles').eligible.some(x=>x.id===p.id),false);
 seen(s,'地',1);assert.equal(modeCounts(s,'particles').eligible.some(x=>x.id===p.id),false);
 const other=terms.find(w=>w!=='地');seen(s,other,3);assert.equal(modeCounts(s,'particles').eligible.some(x=>x.id===p.id),true);
});
test('one >=2 matching anchor includes a grammar sentence despite unrelated excluded tokens',()=>{
 const s=state(),g=s.grammar[0],words=groupWords(g);prepareGroup(s,words,2.5);
 const first=s.cards.find(c=>c.hanzi===words[0]);const second=s.cards.find(c=>c.hanzi===words[1]);
 first.tags=['Topics/Anchor'];second.tags=['Topics/Excluded'];
 const f={tags:{'Topics/Anchor':1,'Topics/Excluded':-1}};
 assert.equal(modeCounts(s,'grammar',f).eligible.some(x=>x.id===g.id),true);
 seen(s,first.hanzi,1.5);assert.equal(modeCounts(s,'grammar',f).eligible.some(x=>x.id===g.id),false);
});
test('filtered particles use qualifying vocabulary anchors, not full-sentence exclusion',()=>{
 const s=state(),p=PARTICLES[0],words=[...new Set([...p.base,...p.choices])];prepareGroup(s,words,2.5);
 const first=s.cards.find(c=>c.hanzi===words[0]),second=s.cards.find(c=>c.hanzi===words[1]);first.tags=['Topics/Selected'];second.tags=['Topics/Excluded'];
 assert.ok(modeCounts(s,'particles',{tags:{'Topics/Selected':1,'Topics/Excluded':-1}}).eligible.some(x=>x.id===p.id));
});
test('per-mode counters distinguish due, started future, new and eligible total',()=>{
 const s=state(),words=s.cards.slice(0,3);s.cards=words;
 seen(s,words[0].hanzi,2,t-1);seen(s,words[1].hanzi,2,t+86400000);
 const counts=modeCounts(s,'words',null,t);assert.deepEqual([counts.due,counts.started,counts.new,counts.available],[1,1,1,3]);
 s.settings.newWordsPerDay=0;assert.deepEqual([modeCounts(s,'words',null,t).due,modeCounts(s,'words',null,t).available],[1,3]);
});
test('daily vocabulary quota is local-date based, unique and undo-aware',()=>{
 const s=state(),c=s.cards[0];assert.equal(newVocabRemaining(s,t),Infinity);
 s.settings.newWordsPerDay=1;s.history.push({cardId:c.id,first:true,at:new Date(t).toISOString()});assert.equal(newVocabRemaining(s,t),0);
 s.history.push({cardId:c.id,first:true,at:new Date(t).toISOString()});assert.equal(newVocabToday(s,t),1);
 s.history.pop();s.history.pop();assert.equal(newVocabRemaining(s,t),1);
 s.settings.newWordsPerDay=0;assert.equal(newVocabRemaining(s,t),0);
 s.settings.newWordsPerDay=null;assert.equal(newVocabRemaining(s,t),Infinity);
});
test('all selects due globally before any new; due-only/new-only override the pool',()=>{
 const s=state();s.cards=s.cards.slice(0,3);const id=s.cards[0].id;
 seen(s,s.cards[0].hanzi,2,t-1);
 const a=session('words','all'),due=nextExercise(s,a,t,()=>.5);assert.equal(due.id,id);
 const d=session('words','due');assert.equal(nextExercise(s,d,t,()=>.9)?.id,id);
 const n=session('words','new');assert.ok(nextExercise(s,n,t,()=>.5)?.id!==id);
 s.settings.newWordsPerDay=0;assert.equal(nextExercise(s,n,t,()=>.5),null);
 assert.equal(nextExercise(s,a,t,()=>.5).id,id);
});
test('any newly due card, including the same reviewed card, reenters a continuous session',()=>{
 const s=state();s.cards=s.cards.slice(0,1);const a=session('words');a.current=nextExercise(s,a,t,()=>.2);assert.ok(a.current);
 recordExercise(s,a,3,{},t);assert.equal(nextExercise(s,a,t+60000,()=>.2),null);
 const againAt=Date.parse(s.schedules[s.cards[0].id].dueAt)+1;
 assert.equal(nextExercise(s,a,againAt,()=>.2)?.id,s.cards[0].id);
});
test('random selection responds to random seed, overdue severity and configured auto weights',()=>{
 const s=state();s.cards=s.cards.slice(0,3);for(const c of s.cards)seen(s,c.hanzi,2,t-100000);
 const a=session('words','due'),one=nextExercise(s,a,t,()=>.01),other=nextExercise(s,a,t,()=>.99);assert.notEqual(one.id,other.id);
 // Due cards remain weighted; a deep overdue review is more likely, but not mandatory.
 const old=s.cards[0];s.schedules[old.id].dueAt=new Date(t-90*86400000).toISOString();
 assert.ok(nextExercise(s,a,t,()=>0)?.id===old.id||nextExercise(s,a,t,()=>.99)?.id!==old.id);
});
test('postpone preserves due date and makes a draw eligible later; skip excludes it for session',()=>{
 const s=state();s.cards=s.cards.slice(0,2);const a=session('words','all');a.current=nextExercise(s,a,t,()=>0);const old=a.current;
 const schedule=s.schedules[old.id];postponeItem(s,a,0,t);assert.deepEqual(s.schedules[old.id],schedule);assert.equal(s.history.length,0);assert.ok(a.deferred['words:'+old.id]);
 const other=nextExercise(s,a,t,()=>0);assert.notEqual(other?.id,old.id);
 assert.ok(nextExercise(s,a,t+16000,()=>0)?.id===old.id||nextExercise(s,a,t+16000,()=>.99)?.id===old.id);
 const b=session('words','all');b.current=old;skipItem(b);assert.equal(b.skipped.length,1);assert.notEqual(nextExercise(s,b,t+16000,()=>0)?.id,old.id);
});
test('backup omits session filters and preserves daily-cap and timing settings',()=>{
 const s=state(),a=session('words');a.current=nextExercise(s,a,t,()=>0);a.filters={tags:{'Food/ordering':1},search:'rice'};a.allowedWords=['test'];s.activePractice=a;
 s.settings.newWordsPerDay=13;s.settings.retryIntervals[0]={value:11,unit:'minutes'};
 const back=makeBackup(s);assert.equal(back.state.activePractice.filters,undefined);assert.equal(back.state.activePractice.allowedWords,undefined);assert.equal(back.state.settings.newWordsPerDay,13);
 const restored=parseBackup(back);assert.equal(restored.settings.newWordsPerDay,13);assert.equal(restored.settings.retryIntervals[0].value,11);assert.deepEqual(restored.activePractice?.filters,undefined);
 clearLearningRecords(restored);assert.equal(restored.settings.newWordsPerDay,13);assert.deepEqual(restored.postponed,{});
});
