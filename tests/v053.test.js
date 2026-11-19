import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_VERSION,normalizeAppVersion,prepareVersionedBackup} from '../backup-versions.js';
import {defaultState,makeBackup,parseBackup,migrateState} from '../storage.js';
import {scheduleReview} from '../review-scheduler.js';

const previousRetry=[{value:10,unit:'minutes'},{value:6,unit:'hours'},{value:2,unit:'days'},{value:2,unit:'weeks'}];

test('v0.5.4 full backup embeds exact app version separately from backup format version',()=>{
 const s=defaultState();
 assert.equal(s.appVersion,APP_VERSION);
 const backup=makeBackup(s);
 assert.equal(backup.format,'ciyan-backup');assert.equal(backup.version,2);
 assert.equal(backup.appVersion,'0.7.7');assert.equal(backup.state.appVersion,APP_VERSION);
 const result=parseBackup(JSON.parse(JSON.stringify(backup)));
 assert.equal(result.appVersion,'0.7.7');
});

test('versioned backup migration steps are sequential and do not touch unrelated settings',()=>{
 const s=defaultState();s.settings.tagWeights['HSK/HSK1']=1;
 s.settings.retryIntervals=structuredClone(previousRetry);
 const backup=makeBackup(s);backup.appVersion='0.5.2';backup.state.appVersion='0.5.2';
 const before=structuredClone(backup.state);
 const upgraded=prepareVersionedBackup(backup);
 assert.equal(upgraded.appVersion,'0.7.7');assert.deepEqual(upgraded.state,before);
 assert.equal(backup.appVersion,'0.5.2');
 const parsed=parseBackup(backup);
 assert.equal(parsed.settings.tagWeights['HSK/HSK1'],1);
 assert.deepEqual(parsed.settings.retryIntervals,previousRetry);
 assert.equal(parsed.appVersion,'0.7.7');
});

test('unstamped legacy backup is accepted without guessing version-specific data edits',()=>{
 const s=defaultState();s.settings.retryIntervals=structuredClone(previousRetry);
 s.settings.tagWeights['HSK/HSK1']=1;
 const unversioned=makeBackup(s);delete unversioned.appVersion;delete unversioned.state.appVersion;
 assert.equal(prepareVersionedBackup(unversioned),unversioned);
 const parsed=parseBackup(unversioned);
 assert.equal(parsed.settings.tagWeights['HSK/HSK1'],1);
 assert.deepEqual(parsed.settings.retryIntervals,previousRetry);
});

test('unsupported future, malformed and missing migration steps fail without modifying backup',()=>{
 const backup=makeBackup(defaultState());const original=structuredClone(backup);
 for(const input of [true,null,{},'0.5.3.1','new']){
  const fake={...backup,appVersion:input};assert.throws(()=>prepareVersionedBackup(fake));
 }
 assert.equal(normalizeAppVersion('v0.5.5'),'0.5.5');
 assert.throws(()=>prepareVersionedBackup({...backup,appVersion:'0.7.8'}),/newer Cíyán/);
 assert.throws(()=>prepareVersionedBackup({...backup,appVersion:'0.5.1'}),/No supported backup migration/);
 assert.deepEqual(backup,original);
});

test('current schema normalization never silently adjusts scores, retry anchors, or tag weights',()=>{
 const s=defaultState(),id=s.cards[0].id,now=Date.parse('2026-11-17T08:00:00Z');
 s.settings.tagWeights['HSK/HSK1']=1;s.settings.retryIntervals=structuredClone(previousRetry);
 s.schedules[id]={...scheduleReview(null,4,now,s.settings),score:3};
 const normalized=migrateState(s);
 assert.equal(normalized.settings.tagWeights['HSK/HSK1'],1);
 assert.deepEqual(normalized.settings.retryIntervals,previousRetry);
 assert.equal(normalized.schedules[id].score,3);
 assert.equal(normalized.schedules[id].dueAt,s.schedules[id].dueAt);
});

test('v0.5.3 through v0.5.5 are identity migrations of backup data',()=>{
 const s=defaultState();s.settings.tagWeights['Food/china-food']=-2.25;s.settings.newWordsPerDay=5;
 s.history=[{id:'1',cardId:s.cards[0].id,at:'2026-11-17T08:15:00Z',grade:3}];
 const backup=makeBackup(s);backup.appVersion='0.5.3';backup.state.appVersion='0.5.3';
 const before=structuredClone(backup.state),source=structuredClone(backup);
 const migrated=prepareVersionedBackup(backup);
 assert.equal(migrated.appVersion,'0.7.7');assert.deepEqual(migrated.state,before);
 assert.deepEqual(backup,source);
});
