import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {MASTER} from '../master-data.js';
import {PARTICLES,OMIT,normalizeParticle,particleCorrect,particleSentence,particleError,particleWords} from '../particles.js';
import {defaultState,makeBackup,parseBackup} from '../storage.js';
import {replaceMaster} from '../master.js';
import {candidates,recordExercise,contextFor} from '../study-engine.js';
import {rememberAnswer,undoAnswer} from '../session-controls.js';
import {familyEvidence,characterEvidence,weaknessWeight} from '../learning-feedback.js';
import {normalizeGrammar,grammarTokens,grammarMistakes,grammarScores,toneTargets} from '../grammar.js';
const byWord=new Map(MASTER.cards.map(c=>[c.hanzi,c]));
const now=Date.parse('2026-11-17T00:00:00Z');
function state(){const s=defaultState();replaceMaster(s,MASTER);return s;}

test('all 72 particle exercises validate, retain unique IDs and have real prerequisites',()=>{
 assert.equal(PARTICLES.length,72);assert.equal(new Set(PARTICLES.map(p=>p.id)).size,72);
 for(const p of PARTICLES){normalizeParticle(p);for(const w of particleWords(p))assert.ok(byWord.has(w),`${p.id}: ${w}`);for(const a of p.accepted)assert.ok(particleCorrect(p,a.choice,a.slot));}
});
test('omission does not require a slot, changes no sentence and distinguishes four error types',()=>{
 const p=PARTICLES.find(p=>p.id==='particle-v06-le-havent-eaten');
 assert.ok(particleCorrect(p,OMIT,undefined));assert.equal(particleSentence(p),'我昨天没吃早饭');assert.equal(particleError(p,'了',3),'unnecessary');
 const le=PARTICLES[0];assert.equal(particleError(le,OMIT,-1),'omission');assert.equal(particleError(le,'的',3),'choice');assert.equal(particleError(le,'了',0),'placement');assert.equal(particleError(le,'了',3),null);
 assert.throws(()=>normalizeParticle({...le,accepted:[{choice:'了',slot:-1}]}));
});
test('omission choices do not lock prerequisites and no mode bypasses min/mean gates',()=>{
 const s=state(),p=PARTICLES.find(p=>p.id==='particle-v06-le-havent-eaten');
 for(const w of particleWords(p))s.schedules[s.cards.find(c=>c.hanzi===w).id]={score:2};
 assert.ok(candidates(s,'particles').some(e=>e.id===p.id));
 s.schedules[s.cards.find(c=>c.hanzi==='我').id].score=.99;assert.ok(!candidates(s,'particles').some(e=>e.id===p.id));
});
test('family evidence pools distinct exercises, caps recent evidence, and weight is bounded',()=>{
 const s=state(),p=PARTICLES.find(p=>p.id==='particle-v06-le-havent-eaten');
 s.skillHistory=Array.from({length:25},(_,i)=>({mode:'particles',id:p.id,correct:i<5,errorType:'unnecessary'}));
 const x=familyEvidence(s).get('了');assert.equal(x.total,20);assert.equal(x.errors,20);assert.equal(x.types.unnecessary,20);assert.ok(weaknessWeight(x)>1&&weaknessWeight(x)<3);
 assert.equal(weaknessWeight(),1);
});
test('repeated character reports count once per word review and never infer ungraded characters',()=>{
 const s=state();s.skillHistory=[{mode:'drawing',id:'a',characters:[{character:'人',rating:'recalled'},{character:'人',rating:'forgotten'},{character:'口',rating:'difficult'}]},{mode:'drawing',id:'b',characters:[{character:'人',rating:'difficult'}]}];
 const x=characterEvidence(s);assert.equal(x[0].character,'人');assert.equal(x[0].total,2);assert.equal(x[0].forgotten,1);assert.equal(x[0].words,2);assert.equal(x.length,2);
});
test('drawing feedback survives backup and undo, but completed strokes are not archived',()=>{
 const s=state(),id=s.cards[0].id,a={current:{mode:'drawing',id},input:{pads:[[[[.1,.2]]]],characterRatings:{0:'forgotten'}},spent:{},results:[],mode:'drawing',continuous:true};
 rememberAnswer(s,a);assert.equal(a.undo[0].input.pads,undefined);
 recordExercise(s,a,2,{characters:[{character:'米',rating:'forgotten'}]},now);
 const backup=makeBackup(s),restored=parseBackup(backup);assert.equal(characterEvidence(restored)[0].forgotten,1);
 undoAnswer(s,a);assert.equal(characterEvidence(s).length,0);assert.equal(a.input.characterRatings[0],'forgotten');
});
test('checked correctness, not ease rating, drives grammar usage with an explicit sample count',()=>{
 const s=state(),g=s.grammar[0],a={current:{mode:'grammar',id:g.id},input:{},spent:{},results:[]};
 recordExercise(s,a,2,{correct:true},now);
 let score=grammarScores(g,s.cards,s.schedules,()=>1,s.grammarHistory);assert.equal(score.usage,0);assert.equal(score.usageAttempts,1);
 s.grammarHistory.push({grammarId:g.id,correct:false});score=grammarScores(g,s.cards,s.schedules,()=>1,s.grammarHistory);assert.equal(score.usage,.5);assert.equal(score.usageAttempts,2);
 assert.equal(grammarScores(g,s.cards,s.schedules,()=>1,[]).usageAttempts,0);
});
test('explicit alternative order is accepted without accepting arbitrary permutations',()=>{
 const g=normalizeGrammar({markup:'{我}{明天}{去}{北京}。',english:'I am going to Beijing tomorrow.',acceptedOrders:[['明天','我','去','北京']]});
 assert.deepEqual(grammarMistakes(g,['t1','t0','t2','t3']),[]);assert.ok(grammarMistakes(g,['t3','t0','t2','t1']).length);
 assert.throws(()=>normalizeGrammar({...g,acceptedOrders:[['我','明天','去','上海']]}));
});
test('drawing context avoids showing target characters in other tiles and prefers familiar shorter contexts',()=>{
 const s=state(),c=byWord.get('我');s.grammar=[{id:'leak',markup:'{我}{我们}',pinyin:'wǒ wǒmen'},{id:'safe',markup:'{我}{喝}{茶}',pinyin:'wǒ hē chá'}];
 assert.equal(contextFor(s,c).grammar.id,'safe');s.grammar=s.grammar.slice(0,1);assert.equal(contextFor(s,c),null);
});
test('new grammar validates with complete lexical links, pinyin, and no unreviewed templates',()=>{
 const original=JSON.parse(fs.readFileSync(new URL('../content/base-master-v055.json',import.meta.url)));
 assert.deepEqual(MASTER.grammar.slice(0,1549),original.grammar);
 for(const g of MASTER.grammar.slice(1549)){normalizeGrammar(g);assert.ok(g.pinyin&&g.english);assert.doesNotMatch(g.source,/unreviewed|automatic_pos_template/);for(const w of grammarTokens(g))assert.ok(byWord.has(w),`${g.id}:${w}`);assert.ok(grammarTokens(g).length<=35);}
});
test('coverage ledger states the real gap rather than treating rejected templates as examples',()=>{
 const report=JSON.parse(fs.readFileSync(new URL('../content/coverage-summary.json',import.meta.url)));
 const covered=new Set(MASTER.grammar.flatMap(grammarTokens));assert.equal(report.covered_words,MASTER.cards.filter(c=>covered.has(c.hanzi)).length);assert.equal(report.vocabulary,MASTER.cards.length);assert.equal(report.uncovered_words,report.vocabulary-report.covered_words);assert.ok(report.uncovered_words<8718);assert.equal(report.template_candidates_excluded,9056);
});
