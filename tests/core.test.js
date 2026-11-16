import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCards} from '../cards.js';
import {scheduleReview, retrievability, previewIntervals, MODEL} from '../fsrs.js';
import {defaultState, makeBackup, parseBackup, normalizeCard} from '../storage.js';

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
  assert.equal(restored.cards.length,32);
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
