import test from 'node:test';import assert from 'node:assert/strict';
import {defaultState,makeBackup,parseBackup,clearLearningRecords,mergeDeck} from '../storage.js';
import {MODES,candidates,nextExercise,recordExercise,scheduleFor,contextFor} from '../study-engine.js';
import {PARTICLES,particleCorrect,normalizeParticle} from '../particles.js';
import {normalizeGrammar} from '../grammar.js';
import {tagNodes,matchesTagFilters,normalizeTags} from '../tags.js';
import {scheduleReview,interpolatedSeconds,retrySeconds,historyScore,rescheduleExisting,dueHistogram} from '../review-scheduler.js';
import {attachPad,drawPad} from '../drawing.js';
const now=Date.parse('2026-11-17T00:00:00Z');
function known(){const s=defaultState();for(const c of s.cards)s.schedules[c.id]={...scheduleReview(null,3,now,s.settings),score:2.8};return s;}
function session(mode='auto'){return {mode,spent:{},results:[],input:{},limit:20};}

test('hierarchical parent inclusion, descendant exclusion, intersections, and boundaries',()=>{
 const tags=['HSK/HSK2','Food/Chinese/Noodles'];
 assert.equal(matchesTagFilters(tags,{HSK:1}),true);
 assert.equal(matchesTagFilters(tags,{HSK:1,'HSK/HSK2':-1}),false);
 assert.equal(matchesTagFilters(tags,{'HSK/HSK1':1}),false);
 assert.equal(matchesTagFilters(tags,{HSK:1,Food:1}),true);
 assert.equal(matchesTagFilters(tags,{HSK:1,Work:1}),false);
 assert.equal(matchesTagFilters(['HSK/HSK10'],{'HSK/HSK1':1}),false);
 assert.deepEqual(tagNodes(tagNodes(tags).map(n=>n.path)),tagNodes(tags));
 assert.deepEqual(normalizeTags(['Food/Chinese/Noodles','Food/Chinese/Noodles','hsk2']),['Food/Chinese/Noodles','HSK/HSK2']);
});
test('retry interpolation matches requested 2.5 example and exact anchors',()=>{
 const config=[{value:1,unit:'minutes'},{value:10,unit:'minutes'},{value:3,unit:'days'},{value:2,unit:'weeks'}];
 assert.ok(Math.abs(interpolatedSeconds(2.5,config)/86400-Math.sqrt(42))<1e-10);
 assert.equal(interpolatedSeconds(0,config),60);assert.equal(interpolatedSeconds(3,config),14*86400);
 assert.throws(()=>retrySeconds([{value:0,unit:'seconds'},...config.slice(1)]));
 assert.throws(()=>retrySeconds([config[3],...config.slice(1)]));
 const oneSecond=[{value:1,unit:'seconds'},...config.slice(1)];assert.equal(interpolatedSeconds(0,oneSecond),1);
});
test('scores grow gradually and a lapse reduces rather than resets them',()=>{
 const s=scheduleReview(null,4,now,{});assert.ok(Math.abs(s.score-.54)<1e-10);
 assert.ok(historyScore(s,1,now)>0);assert.ok(historyScore(s,1,now)<s.score);
 const fast=historyScore(s,4,now+60000),spaced=historyScore(s,4,now+86400000);assert.ok(fast<spaced);assert.ok(fast<1);
 const mature={...s,score:3},settings=defaultState().settings;settings.retryIntervals[3]={value:3,unit:'weeks'};
 assert.equal(Date.parse(rescheduleExisting(mature,settings).dueAt),now+21*86400000);
 assert.equal(scheduleReview(null,3,now,{scheduler:'fsrs'}).intervalMinutes,5760);
});
test('skills are independent and disabled auto modes cannot appear',()=>{
 const s=known(),a=session();s.settings.autoModes={words:false,grammar:false,drawing:false,particles:true};
 const next=nextExercise(s,a,now);assert.ok(next);assert.equal(next.mode,'particles');
 a.current=next;const previous=structuredClone(s.schedules);recordExercise(s,a,3,{},now);
 assert.deepEqual(s.schedules,previous);assert.equal(s.skillSchedules.particles[next.id].reps,1);
 assert.equal(s.skillHistory.length,1);assert.equal(s.grammarHistory.length,0);
 s.settings.autoModes={words:false,grammar:false,drawing:false,particles:false};assert.equal(nextExercise(s,a,now),null);
});
test('auto prerequisites block unfamiliar contexts while manual drawing and particles are available',()=>{
 const s=defaultState();assert.equal(candidates(s,'drawing',true,now).length,0);
 assert.equal(candidates(s,'grammar',true,now).length,0);assert.equal(candidates(s,'particles',true,now).length,0);
 assert.ok(candidates(s,'drawing',false,now).length);assert.equal(candidates(s,'particles',false,now).length,PARTICLES.length);
 const k=known(),c=k.cards.find(c=>c.hanzi==='随便');assert.equal(contextFor(k,c,now).grammar.id,'grammar-001');
 assert.ok(candidates(k,'drawing',true,now).some(x=>x.id===c.id));
});
test('due reviews precede new items, and immediate answer exposure blocks drawing',()=>{
 const s=known(),a=session();const c=s.cards[0];s.schedules[c.id].dueAt=new Date(now-1000).toISOString();
 const next=nextExercise(s,a,now);assert.equal(next.mode,'words');assert.equal(next.id,c.id);
 const b=session('drawing');b.results=[{mode:'words',id:c.id,wordIds:[c.id],at:new Date(now).toISOString()}];
 assert.notEqual(nextExercise(s,b,now)?.id,c.id);
});
test('weighted scheduling eventually serves every enabled mode with eligible work',()=>{
 const s=known();for(const c of s.cards)s.schedules[c.id].dueAt=new Date(now-1000).toISOString();
 // Give each mode a due candidate so fresh/due prioritization does not dominate fairness.
 for(const m of ['grammar','drawing','particles'])for(const x of candidates(s,m,false,now))s.skillSchedules[m][x.id]={...scheduleReview(null,3,now,s.settings),dueAt:new Date(now-1000).toISOString()};
 const a=session(),seen=new Set();for(let i=0;i<30;i++){a.current=nextExercise(s,a,now);if(!a.current)break;seen.add(a.current.mode);recordExercise(s,a,3,{seconds:20},now);}
 assert.deepEqual([...seen].sort(),Object.keys(MODES).sort());
});
test('particle validation, choice and placement, and accepted alternatives',()=>{
 for(const p of PARTICLES){const n=normalizeParticle(p);for(const a of n.accepted)assert.ok(particleCorrect(n,a.choice,a.slot));assert.equal(particleCorrect(n,'invalid',0),false);}
 const p=normalizeParticle({...PARTICLES[0],accepted:[...PARTICLES[0].accepted,{choice:'了',slot:6}]});assert.ok(particleCorrect(p,'了',6));
 assert.throws(()=>normalizeParticle({...p,accepted:[{choice:'不存在',slot:0}]}));
 const g=normalizeGrammar({markup:'{我}{去}。',english:'I go.',particleTests:[PARTICLES[0]]});assert.equal(g.particleTests.length,1);
});
test('backup round trip includes separate skills, settings, active pads, and deck test metadata; clear keeps content',()=>{
 const s=known(),a=session('drawing'),c=s.cards[0];a.current={mode:'drawing',id:c.id,wordIds:[c.id],reason:'first practice'};
 recordExercise(s,a,3,{},now);a.current={mode:'drawing',id:s.cards[1].id,wordIds:[s.cards[1].id]};a.input={pad:1,pads:[[[[.1,.2],[.4,.8]]]],revealed:false};s.activePractice=a;
 s.grammar[0].particleTests=[PARTICLES[0]];
 const restored=parseBackup(JSON.parse(JSON.stringify(makeBackup(s))));
 assert.deepEqual(restored.skillSchedules,s.skillSchedules);assert.deepEqual(restored.skillHistory,s.skillHistory);assert.deepEqual(restored.activePractice.input,a.input);assert.deepEqual(restored.settings.retryIntervals,s.settings.retryIntervals);
 assert.equal(restored.grammar[0].particleTests.length,1);
 const before=JSON.stringify([restored.cards,restored.grammar]);clearLearningRecords(restored);
 assert.equal(JSON.stringify([restored.cards,restored.grammar]),before);assert.equal(restored.activePractice,null);assert.deepEqual(restored.skillSchedules,{grammar:{},drawing:{},particles:{}});
 const invalid=makeBackup(s);invalid.state.activePractice.input.pads=[[[[Infinity,0]]]];assert.throws(()=>parseBackup(invalid));
});
test('adaptive histogram counts every scheduled skill exactly once and changes density with width',()=>{
 const entries=Array.from({length:120},(_,i)=>({mode:Object.keys(MODES)[i%4],dueAt:new Date(now+(i-30)*3600000).toISOString()}));
 const small=dueHistogram(entries,320,now),large=dueHistogram(entries,900,now);
 for(const data of [small,large]){assert.equal(data.bins.reduce((n,b)=>n+b.total,0),120);assert.ok(data.bins.some(b=>b.start===0));}
 assert.ok(large.bins.length>small.bins.length);assert.ok(large.step<small.step);assert.deepEqual(dueHistogram([],320,now).bins,[]);
});
test('drawing captures normalized strokes and redraws them without losing pads',()=>{
 const ctx={clearRect(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 const canvas={width:600,getContext:()=>ctx,getBoundingClientRect:()=>({left:10,top:20,width:200,height:200}),setPointerCapture(){}};
 let saved;const strokes=[];attachPad(canvas,strokes,s=>{saved=structuredClone(s);});
 const event=(x,y)=>({pointerId:1,button:0,clientX:x,clientY:y,preventDefault(){}});
 canvas.onpointerdown(event(10,20));canvas.onpointermove(event(110,120));canvas.onpointerup(event(210,220));
 assert.deepEqual(saved,[[[0,0],[.5,.5]]]);drawPad(canvas,saved);
 canvas.onpointerdown(event(210,220));canvas.onpointercancel(event(210,220));assert.equal(saved.length,2);assert.deepEqual(saved[1],[[1,1]]);
});
