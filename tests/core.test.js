import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCards} from '../cards.js';
import {scheduleReview, retrievability, previewIntervals, MODEL} from '../fsrs.js';
import {defaultState, makeBackup, parseBackup, normalizeCard, mergeDeck, migrateState, clearLearningRecords, makeDeck} from '../storage.js';
import {initialGrammar, normalizeGrammar, grammarScores, toneTargets, grammarTokens, grammarTags} from '../grammar.js';

const T = Date.parse('2026-11-16T09:00:00Z');
test('starter deck has unique IDs, useful Chinese, and topic tags', () => {
  const cards = initialCards();
  assert.equal(cards.length, 32);
  assert.equal(new Set(cards.map(c=>c.id)).size, cards.length);
  assert.ok(cards.every(c=>c.hanzi && c.english && c.tags.length));
  assert.ok(cards.some(c=>c.tags.includes('food')));
});
test('FSRS-4.5 grades produce increasing first intervals', () => {
  assert.equal(MODEL, 'FSRS-4.5');
  const schedules = [1,2,3,4].map(g=>scheduleReview(null,g,T));
  assert.deepEqual(schedules.slice(0,2).map(s=>s.intervalMinutes),[1,10]);
  assert.ok(schedules[2].intervalMinutes < schedules[3].intervalMinutes);
  assert.ok(schedules.every(s=>s.reps===1 && s.dueAt && s.stability>0));
  assert.ok(schedules[0].lapses===1);
  assert.equal(previewIntervals(null,T).length,4);
});
test('retrievability decays with elapsed time', () => {
  const schedule = scheduleReview(null,3,T);
  assert.ok(retrievability(schedule,T+86400000) < retrievability(schedule,T));
  assert.ok(retrievability(schedule,T+10*86400000) < retrievability(schedule,T+86400000));
});
test('successful overdue review grows stability, lapse reduces it', () => {
  const first = scheduleReview(null,3,T);
  const due = Date.parse(first.dueAt);
  const good = scheduleReview(first,3,due);
  const fail = scheduleReview(first,1,due);
  assert.ok(good.stability > first.stability);
  assert.ok(fail.stability <= first.stability);
  assert.ok(good.intervalMinutes>fail.intervalMinutes);
});
test('JSON backup roundtrip preserves review records and active session', () => {
  const initial=defaultState();
  initial.revision=10;
  const id=initial.cards[0].id;
  initial.schedules[id]=scheduleReview(null,3,T);
  initial.history.push({id:'review-001',cardId:id,grade:3,at:new Date(T).toISOString(),first:true});
  initial.activeSession={id:'sess-001',startedAt:new Date(T).toISOString(),queue:[initial.cards[1].id],initialTotal:2,results:[{cardId:id,grade:3}],newWords:1,correct:1};
  const data=JSON.parse(JSON.stringify(makeBackup(initial)));
  const restored=parseBackup(data);
  assert.equal(restored.cards.length,52);
  assert.equal(restored.history.length,1);
  assert.equal(restored.activeSession.queue.length,1);
  assert.equal(restored.schedules[id].reps,1);
  assert.equal(restored.backedUpRevision,10);
});
test('invalid backups rejected without affecting user data', () => {
  assert.throws(()=>parseBackup({}));
  assert.throws(()=>parseBackup({format:'ciyan-backup',version:2,state:{}}));
});
test('user cards are sanitized, validated, and tagged', () => {
  const c=normalizeCard({hanzi:' 测试 ',english:' Test ',tags:['Food','food',' Work ']},'test-1');
  assert.equal(c.hanzi,'测试');
  assert.deepEqual(c.tags,['food','work']);
  assert.throws(()=>normalizeCard({hanzi:'',english:'meaning'}));
});

test('grammar has independent sentence tokens and indexed distractors', () => {
 const g=initialGrammar()[0];
 assert.deepEqual(grammarTokens(g),['吃','什么','我','都','随便']);
 assert.deepEqual(g.distractors,[{index:4,word:'多'}]);
 assert.equal(defaultState().grammar.length,4);
 assert.throws(()=>normalizeGrammar({markup:'{你好}',english:'hello',distractors:[{index:5,word:'坏'}]}));
});
test('grammar readiness requires every answer and confusing word known', () => {
 const s=defaultState(),g=s.grammar[0];
 let score=grammarScores(g,s.cards,s.schedules,()=>1);
 assert.equal(score.ready,false);
 assert.ok(score.weak.length>0);
 for(const word of score.required){s.schedules[word.card.id]=scheduleReview(null,3,T);}
 score=grammarScores(g,s.cards,s.schedules,()=>1);
 assert.equal(score.ready,true);
 assert.ok(score.knowledge>.75);
 assert.equal(score.usage,0);
 assert.equal(score.combined,score.knowledge);
 assert.ok(grammarTags(g,s.cards).includes('food'));
});
test('tone parser aligns tone marks and neutral syllables per character',()=>{
 assert.deepEqual(toneTargets('你好','nǐ hǎo'),[3,3]);
 assert.deepEqual(toneTargets('随便','suíbiàn'),[2,4]);
 assert.deepEqual(toneTargets('不好意思','bù hǎoyìsi'),[4,3,4,0]);
 assert.deepEqual(toneTargets('有点儿','yǒudiǎnr'),[3,3,0]);
 assert.equal(toneTargets('四个',''),null);
});
test('importing record-bearing backups as decks only merges new words, grammar and tags',()=>{
 const old=defaultState(),id=old.cards.find(c=>c.hanzi==='随便').id;
 old.schedules[id]=scheduleReview(null,3,T);
 old.history.push({cardId:id,at:new Date(T).toISOString(),grade:3});
 const incoming={format:'ciyan-backup',version:2,state:{...defaultState(),cards:[
  {hanzi:'随便',english:'Overwritten?',tags:['new-tag']},
  {hanzi:'学会',pinyin:'xuéhuì',english:'To master',tags:['study']}
 ],grammar:[{markup:'{我}{学会}。',english:'I mastered it.'}],history:[],schedules:{}}};
 const merged=mergeDeck(old,incoming);
 assert.equal(merged.addedWords,1);
 assert.equal(merged.addedGrammar,1);
 assert.equal(merged.tagsUpdated,1);
 assert.equal(merged.draft.cards.find(c=>c.hanzi==='随便').english,'Whatever; any is fine');
 assert.ok(merged.draft.cards.find(c=>c.hanzi==='随便').tags.includes('new-tag'));
 assert.equal(merged.draft.history.length,1);
 assert.equal(merged.draft.schedules[id].reps,1);
 assert.equal('history' in makeDeck(old),false);
});
test('old v0.1 state migrates examples without altering review records',()=>{
 const orig=defaultState();
 const legacy={...orig,schemaVersion:1,cards:orig.cards.slice(0,32).map(c=>({...c,
   example:'吃什么？我都随便。',examplePinyin:'Chī shénme? Wǒ dōu suíbiàn.',exampleEnglish:'Whatever.'})),
   grammar:undefined,grammarHistory:undefined,grammarSessions:undefined,settings:{dailyNew:8,sessionSize:12,desiredRetention:.9}};
 legacy.history=[{cardId:legacy.cards[0].id,at:new Date(T).toISOString(),grade:3}];
 legacy.schedules={[legacy.cards[0].id]:scheduleReview(null,3,T)};
 const migrated=migrateState(legacy);
 assert.equal(migrated.schemaVersion,2);
 assert.equal(migrated.cards.length,52);
 assert.ok(migrated.grammar.length>4);
 assert.equal(migrated.history.length,1);
 assert.equal(migrated.schedules[legacy.cards[0].id].reps,1);
 assert.equal('dailyNew' in migrated.settings,false);
});
test('clearing learning data retains full vocabulary and grammar',()=>{
 const state=defaultState();state.schedules={a:{reps:1}};state.grammarHistory.push({id:'test'});
 clearLearningRecords(state);
 assert.equal(state.cards.length,52);assert.equal(state.grammar.length,4);
 assert.deepEqual(state.schedules,{});assert.deepEqual(state.grammarHistory,[]);
});
