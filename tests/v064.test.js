import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';
import {cloneProgressState,migrateState,makeBackup,parseBackup} from '../storage.js';
import {grammarTags,grammarScores} from '../grammar.js';
import {MASTER} from '../master-data.js';
import {retrievability} from '../fsrs.js';

test('v0.6.4 preserves the v0.6.3 master and upgrades historical backups by identity',()=>{
 assert.equal(APP_VERSION,'0.7.5');assert.equal(MASTER.cards.length,11893);assert.equal(MASTER.grammar.length,3444);
 const old={format:'ciyan-backup',version:2,appVersion:'0.6.3',state:{appVersion:'0.6.3',schemaVersion:2}};
 const migrated=prepareVersionedBackup(old);assert.equal(migrated.appVersion,'0.7.5');
 assert.deepEqual(migrated.state,old.state);assert.equal(old.appVersion,'0.6.3');
});

test('sharing immutable content during review cannot change prior state or lose history',()=>{
 const state=migrateState({schemaVersion:2,cards:MASTER.cards,grammar:MASTER.grammar,
  schedules:{},history:[{cardId:'word-1',grade:3,at:'2026-11-18T00:00:00Z'}],
  skillHistory:[],grammarHistory:[],sessions:[],grammarSessions:[],mixedSessions:[],
  settings:{newWordsPerDay:null},revision:42});
 const draft=cloneProgressState(state);
 assert.equal(draft.cards,state.cards);assert.equal(draft.grammar,state.grammar);
 assert.notEqual(draft.history,state.history);assert.equal(draft.history[0],state.history[0]);
 draft.history.push({cardId:'word-2',grade:2,at:'2026-11-18T01:00:00Z'});
 draft.settings.newWordsPerDay=10;
 assert.equal(state.history.length,1);assert.equal(state.settings.newWordsPerDay,null);
 assert.equal(draft.history.length,2);assert.equal(draft.cards.length,11893);
 const content=cloneProgressState(state,true);
 assert.notEqual(content.cards,state.cards);assert.notEqual(content.grammar,state.grammar);
 content.cards[0].english='Test edit';assert.notEqual(content.cards[0].english,state.cards[0].english);
});

test('indexed tag lookups and indexed grammar history preserve original semantics',()=>{
 const cards=MASTER.cards,grammar=MASTER.grammar.slice(0,250),byHanzi=new Map(cards.map(c=>[c.hanzi,c]));
 for(const g of grammar){
  const tokens=new Set([...g.markup.matchAll(/\{([^{}]+)\}/g)].map(x=>x[1]));
  const baseline=[...new Set(cards.filter(c=>tokens.has(c.hanzi)).flatMap(c=>c.tags))].sort();
  assert.deepEqual(grammarTags(g,cards),baseline);
 }
 const hist=[];const g=grammar[0];const score=()=>grammarScores(g,cards,{},()=>1,hist);
 assert.equal(score().usageAttempts,0);hist.push({grammarId:g.id,correct:false});assert.equal(score().usage,1);
 hist.push({grammarId:g.id,correct:true});assert.equal(score().usage,0.5);
});

test('backup JSON remains complete, independent of internal database chunk layout',()=>{
 const s={...migrateState({schemaVersion:2,cards:MASTER.cards,grammar:MASTER.grammar,
  schedules:{},history:[],sessions:[],grammarHistory:[],grammarSessions:[],settings:{},revision:7}),
  history:[{id:'review64',cardId:MASTER.cards[0].id,grade:3,at:'2026-11-18T00:00:00Z'}]};
 const exported=makeBackup(s);
 assert.equal(exported.format,'ciyan-backup');assert.equal(exported.version,2);
 assert.equal(exported.state.cards.length,11893);assert.equal(exported.state.grammar.length,3444);
 assert.equal(exported.state.history.length,1);
 assert.equal(exported.state.__historyChunks,undefined);
 const parsed=parseBackup(exported);assert.equal(parsed.history.length,1);
 assert.equal(parsed.history[0].id,'review64');
});
