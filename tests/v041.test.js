import test from 'node:test';import assert from 'node:assert/strict';
import {defaultState,makeBackup,parseBackup,clearLearningRecords} from '../storage.js';
import {scheduleReview,previewIntervals,intervalText,timingImpact,interpolatedSeconds,upgradeScores} from '../review-scheduler.js';
import {rememberAnswer,undoAnswer,skipItem,postponeItem,availability} from '../session-controls.js';
import {recordExercise,nextExercise} from '../study-engine.js';
import {replaceMaster} from '../master.js';import {MASTER} from '../master-data.js';
import {wordKnowledge} from '../grammar.js';import {tagLabel,matchesTagFilters} from '../tags.js';
const now=Date.parse('2026-11-17T00:00:00Z');
const practice=(s,mode='words')=>({id:'test-session',mode,continuous:true,spent:{},results:[],undo:[],input:{revealed:true},current:{mode,id:mode==='words'?s.cards[0].id:mode==='grammar'?s.grammar[0].id:s.cards[0].id,wordIds:[s.cards[0].id]},itemStartedAt:now});
test('new Good and Easy are gradual and the displayed intervals equal committed results',()=>{
 const settings=defaultState().settings,labels=previewIntervals(null,now,settings);
 assert.deepEqual(labels,['10.0m','19.1m','36.3m','1.2h']);
 for(let grade=1;grade<=4;grade++){const after=scheduleReview(null,grade,now,settings);assert.equal(labels[grade-1],intervalText((Date.parse(after.dueAt)-now)/1000));assert.ok(after.score<1);assert.ok(wordKnowledge(after,1)<.2);}
 const lapse=scheduleReview(null,1,now,settings),easy=scheduleReview(lapse,4,now+60000,settings);assert.ok(easy.score<.25);assert.equal(intervalText(easy.intervalMinutes*60),'23.7m');
});
test('format uses one largest unit and exactly one decimal',()=>{
 for(const [n,v] of [[1,'1.0s'],[60,'1.0m'],[150,'2.5m'],[3600,'1.0h'],[90000,'1.0d'],[1209600,'2.0w']])assert.equal(intervalText(n),v);
});
test('undo restores actual schedules, histories, counters and adaptive timing for all skills',()=>{
 for(const mode of ['words','grammar','drawing','particles']){
  const s=defaultState(),a=practice(s,mode);s.activePractice=a;
  const before=structuredClone({schedules:s.schedules,skills:s.skillSchedules,history:s.history,grammar:s.grammarHistory,skillsHistory:s.skillHistory});
  rememberAnswer(s,a);recordExercise(s,a,3,{seconds:20},now);assert.equal(a.results.length,1);assert.ok(undoAnswer(s,a));
  assert.deepEqual(s.schedules,before.schedules);assert.deepEqual(s.skillSchedules,before.skills);assert.deepEqual(s.history,before.history);assert.deepEqual(s.grammarHistory,before.grammar);assert.deepEqual(s.skillHistory,before.skillsHistory);assert.equal(a.results.length,0);assert.deepEqual(a.spent,{});assert.ok(a.input.revealed);
 }
});
test('skip leaves no review; postpone defers an unstudied item without making it learned',()=>{
 const s=defaultState(),a=practice(s),id=a.current.id;a.allowedWords=[id];skipItem(a);assert.equal(nextExercise(s,a,now),null);assert.equal(s.history.length,0);assert.equal(s.schedules[id],undefined);
 const b=practice(s);b.allowedWords=[id];postponeItem(s,b,300,now);assert.equal(nextExercise(s,b,now),null);assert.equal(availability(s,b,now).nextAt,now+15000);assert.equal(nextExercise(s,b,now+16000).id,id);assert.equal(s.schedules[id],undefined);assert.equal(s.history.length,0);
});
test('continuous waiting and postponed items survive backup, clear removes them',()=>{
 const s=defaultState(),a=practice(s);a.allowedWords=[a.current.id];postponeItem(s,a,300,now);s.activePractice=a;
 const restored=parseBackup(makeBackup(s));assert.ok(restored.activePractice);assert.equal(restored.activePractice.current,null);assert.deepEqual(restored.postponed,s.postponed);clearLearningRecords(restored);assert.deepEqual(restored.postponed,{});
});
test('impact preview calculates additional due items without mutating schedules',()=>{
 const s=defaultState(),id=s.cards[0].id;s.schedules[id]={...scheduleReview(null,4,now-3600000,s.settings),score:3,dueAt:new Date(now+86400000).toISOString()};
 const before=structuredClone(s.schedules),settings={...s.settings,retryIntervals:[0,1,2,3].map(()=>({value:1,unit:'minutes'}))};
 const impact=timingImpact(s,settings,now);assert.equal(impact.additional,1);assert.deepEqual(s.schedules,before);
});
test('one master is complete, replaces content and preserves matched review IDs',()=>{
 const s=defaultState(),old=s.cards[0];s.schedules[old.id]=scheduleReview(null,3,now,s.settings);
 replaceMaster(s,MASTER);assert.equal(s.cards.length,11893);assert.equal(s.grammar.length,3444);assert.equal(s.cards.find(c=>c.hanzi===old.hanzi).id,old.id);assert.equal(s.schedules[old.id].reps,1);
 const edited=structuredClone(MASTER);edited.cards[0].english='Custom wording';replaceMaster(s,edited);assert.equal(s.cards.find(c=>c.hanzi===edited.cards[0].hanzi).english,'Custom wording');replaceMaster(s,MASTER);assert.notEqual(s.cards.find(c=>c.hanzi===edited.cards[0].hanzi).english,'Custom wording');
 assert.throws(()=>replaceMaster(s,{cards:[...MASTER.cards,MASTER.cards[0]],grammar:MASTER.grammar}));
});
test('friendly labels do not change tag matching or stored paths',()=>{
 assert.equal(tagLabel('Food/china-food'),'Food / Chinese food');assert.equal(matchesTagFilters(['Food/china-food'],{Food:1}),true);
});
test('v0.4 first-Easy inflation is corrected from history once without deleting events',()=>{
 const s=defaultState(),id=s.cards[0].id;s.schedules[id]={...scheduleReview(null,4,now,s.settings),score:3};delete s.schedules[id].scoreModel;
 s.history=[{id:'event',cardId:id,grade:4,at:new Date(now).toISOString()}];const history=structuredClone(s.history);
 assert.ok(upgradeScores(s));assert.equal(s.schedules[id].score,.54);assert.equal(upgradeScores(s),false);assert.deepEqual(s.history,history);
});
