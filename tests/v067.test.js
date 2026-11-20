import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';
import {FONT_LEVELS,FONT_CATALOG,requiredFonts,fontSources} from '../fonts.js';
import {prepareVerifiedBackup} from '../backup-integrity.js';
import {defaultState,makeBackup,parseBackup} from '../storage.js';
import {scheduleReview,rescheduleExisting,previewOutcomes,retrySeconds,DEFAULT_RETRY} from '../review-scheduler.js';

test('v0.6.7 version and exact installed font names are exposed to users',()=>{
 assert.equal(APP_VERSION,'0.8.14');
 assert.equal(prepareVersionedBackup({...makeBackup(defaultState()),appVersion:'0.6.6'}).appVersion,'0.8.14');
 const expected={xiaowei:'xiaowei',kuaile:'HappyZcool-2016',zhushi:'YRDZST',mashan:'Ma Shan Zheng',muyao:'Muyao-Softbrush',zhimang:'Zhi Mang Xing'};
 for(const [id,alias] of Object.entries(expected)){
  assert.equal(FONT_CATALOG[id].aliases[0],alias);
  assert.ok(fontSources(id).includes(JSON.stringify(alias)));
  assert.ok(Object.values(FONT_LEVELS).flat().some(([key,label])=>key===id&&label.includes(alias)),id);
 }
 for(const level of ['intermediate','advanced','expert'])assert.equal(requiredFonts({fontDifficulty:level,fontChoice:'mixed'}).length,2);
 assert.deepEqual(requiredFonts({enabledFonts:['print','xiaowei','muyao']}),['xiaowei','muyao']);
});

test('export validation catches lost records, checks settings, and never changes the live state',()=>{
 const state=defaultState();state.history=[{cardId:state.cards[0].id,grade:3,at:'2026-11-18T07:20:00Z'}];
 const before=JSON.stringify(state);
 const result=prepareVerifiedBackup(state);
 assert.ok(result.bytes>0);
 const parsed=parseBackup(JSON.parse(result.json));
 assert.equal(parsed.history.length,1);
 assert.equal(parsed.cards.length,state.cards.length);
 assert.deepEqual(parsed.settings.enabledFonts,['print']);
 assert.equal(JSON.stringify(state),before);
 const damaged={...state,skillHistory:[{id:'bad',mode:'drawing',grade:1234,at:'2026-11-18T07:20:00Z'}]};
 assert.throws(()=>prepareVerifiedBackup(damaged),/integrity error.*skillHistory/);
});

test('lapses retain gradual score but Again and Hard get prompt bounded retries',()=>{
 const now=Date.UTC(2026,10,18,7,30);
 const before={...scheduleReview(null,4,now-7*86400000),score:3.15,reps:12,lastReviewedAt:new Date(now-7*86400000).toISOString(),intervalMinutes:14*24*60};
 const retry=DEFAULT_RETRY;
 const previews=previewOutcomes(before,now,{scheduler:'score',retryIntervals:retry});
 assert.ok(previews[0].score>2,'single lapse must not reset accumulated score');
 assert.ok(previews[0].score<before.score,'lapse reduces strength');
 assert.equal((Date.parse(previews[0].dueAt)-now)/60000,10);
 assert.ok((Date.parse(previews[1].dueAt)-now)<=6*3600000);
 assert.ok(previews[2].score>previews[1].score&&previews[3].score>previews[2].score);
 const again=scheduleReview(before,1,now,{scheduler:'score',retryIntervals:retry});
 const rescheduled=rescheduleExisting(again,{scheduler:'score',retryIntervals:retry});
 assert.equal((Date.parse(rescheduled.dueAt)-now)/60000,10);
 const tuned=[{value:2,unit:'minutes'},{value:20,unit:'minutes'},{value:2,unit:'days'},{value:3,unit:'weeks'}];
 assert.deepEqual(retrySeconds(tuned),[120,1200,172800,1814400]);
 const shorter=scheduleReview(before,1,now,{scheduler:'score',retryIntervals:tuned});
 assert.equal((Date.parse(shorter.dueAt)-now)/60000,2);
 const fsrs=scheduleReview(before,1,now,{scheduler:'fsrs',retryIntervals:retry});
 assert.equal(fsrs.scheduler,undefined,'FSRS behavior remains unchanged');
 assert.equal(fsrs.intervalMinutes,1);
});

test('re-importing an older backup merges new content without dropping its learned IDs or scores',async()=>{
 const {mergeRestoredContent}=await import('../backup-restore.js');
 const {MASTER}=await import('../master-data.js');
 const restored=defaultState();restored.cards=[{id:'old-id',hanzi:'你好',pinyin:'nǐ hǎo',english:'hello',tags:[]}];restored.grammar=[];
 restored.schedules={'old-id':{score:2.6,reps:8,dueAt:'2026-12-05T04:00:00Z'}};
 restored.history=[{cardId:'old-id',at:'2026-11-18T04:00:00Z',grade:3}];
 const current=defaultState();current.cards.push({id:'reader-specific',hanzi:'测试甲',english:'test',pinyin:'cè shì jiǎ',tags:['Reader/Example']});
 current.grammar.push({id:'reader-grammar',markup:'{测试甲}。',pinyin:'Cè shì jiǎ.',english:'Novel term.',distractors:[]});
 mergeRestoredContent(restored,current,MASTER);
 assert.equal(restored.schedules['old-id'].score,2.6);
 assert.equal(restored.history.length,1);
 assert.ok(restored.cards.some(c=>c.id==='reader-specific'));
 assert.ok(restored.grammar.some(g=>g.id==='reader-grammar'));
 assert.ok(restored.cards.length>=MASTER.cards.length);
 assert.ok(restored.grammar.length>=MASTER.grammar.length);
 const before=[restored.cards.length,restored.grammar.length];
 mergeRestoredContent(restored,current,MASTER);
 assert.deepEqual([restored.cards.length,restored.grammar.length],before);
 const collision=defaultState();collision.cards=[{id:'same-id',hanzi:'甲',english:'a',pinyin:'jiǎ',tags:[]}];
 assert.throws(()=>mergeRestoredContent(collision,{cards:[{id:'same-id',hanzi:'乙'}],grammar:[]},{cards:[],grammar:[]}),/ID conflict/);
});
