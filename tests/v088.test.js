import test from 'node:test';
import assert from 'node:assert/strict';
import {dueCompletion,progressDisplay,studyProgressMarkup,dueReviewedToday,dueKeysForSession,sessionDueProgress,homeDueProgress} from '../study-progress.js';
import {defaultState,makeBackup,parseBackup} from '../storage.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';
import fs from 'node:fs';

const iso='2026-11-20T08:00:00.000Z',now=Date.parse(iso);
const progress=(s,session)=>sessionDueProgress(s,session,now);
const due=(minutes=0)=>({score:2,intervalMinutes:60,lastReviewedAt:'2026-11-19T08:00:00.000Z',dueAt:new Date(now+minutes*60000).toISOString()});

test('v0.8.8 progress renders only Due when the new-vocabulary cap is unlimited',()=>{
 assert.equal(APP_VERSION,'0.8.17');
 const html=studyProgressMarkup({done:2,total:5},43,null);
 assert.match(html,/study-mini-label">Due/);
 assert.doesNotMatch(html,/study-mini-label">New/);
 assert.match(html,/2 \/ 5/);
 assert.match(html,/width:40%/);
 assert.match(html,/role="progressbar"/);
});

test('New row shows distinct words seen today and daily vocabulary cap, including zero and over-limit',()=>{
 assert.equal(progressDisplay({done:0,total:0},3,10).new.percent,30);
 assert.equal(progressDisplay({done:5,total:5},7,5).new.percent,100);
 assert.equal(progressDisplay({done:0,total:0},0,0).new.percent,0);
 assert.equal(progressDisplay({done:0,total:0},0,null).new,undefined);
 assert.match(studyProgressMarkup({done:0,total:0},5,5),/New.*?study-mini-track/s);
 assert.match(studyProgressMarkup({done:0,total:0},5,5),/5 \/ 5/);
});

test('Due progress excludes all new cards and does not count duplicate due reviews twice',()=>{
 assert.deepEqual(dueCompletion(['words:A','words:B'],['words:B'],['words:A','words:A','words:C']),{done:2,total:3});
 assert.deepEqual(dueCompletion(['words:A'],['words:A'],[]),{done:0,total:1});
 assert.deepEqual(dueCompletion([],[],[]),{done:0,total:0});
});

test('session progress counts only currently scheduled due cards, not the fresh pool',()=>{
 const state=defaultState(),c=state.cards[0];
 const fresh=state.cards[1];
 state.cards=[c,fresh];state.grammar=[];
 state.schedules={[c.id]:due(-10)};
 const session={mode:'words',filters:null,allowedWords:null,results:[],skipped:[],dueAtStart:[`words:${c.id}`]};
 assert.deepEqual(dueKeysForSession(state,session,now),[`words:${c.id}`]);
 assert.deepEqual(progress(state,session),{done:0,total:1});
 state.schedules[c.id]=due(60);
 session.results.push({mode:'words',id:c.id,reason:'review due'});
 assert.deepEqual(progress(state,session),{done:1,total:1});
 // Fresh words are not counted even after introducing them.
 state.schedules[fresh.id]=due(60);
 session.results.push({mode:'words',id:fresh.id,reason:'first practice'});
 assert.deepEqual(progress(state,session),{done:1,total:1});
 // When a future exercise becomes due it belongs in the Due bar.
 state.schedules[c.id]=due(-1);
 assert.deepEqual(progress(state,session),{done:0,total:1});
});

test('skipping due cards does not make their progress bar complete',()=>{
 const s=defaultState(),c=s.cards[0];s.cards=[c];s.grammar=[];s.schedules={[c.id]:due(-5)};
 const session={mode:'words',filters:null,allowedWords:null,results:[],skipped:[`words:${c.id}`],dueAtStart:[`words:${c.id}`]};
 assert.deepEqual(progress(s,session),{done:0,total:1});
});

test('today due reviews ignore first introductions and use local calendar day',()=>{
 const s=defaultState(),c=s.cards[0],d=s.cards[1];
 s.cards=[c,d];s.grammar=[];
 s.history=[
  {at:iso,cardId:c.id,reason:'review due',dueAt:due(-5).dueAt},
  {at:iso,cardId:c.id,reason:'review due',dueAt:due(-5).dueAt},
  {at:iso,cardId:d.id,first:true,reason:'first practice'},
  {at:'2026-11-19T08:00:00Z',cardId:d.id,reason:'review due',dueAt:'2026-11-19T07:00:00Z'}
 ];
 assert.equal(dueReviewedToday(s,now).size,1);
 s.schedules={[d.id]:due(-1),[c.id]:due(70)};
 assert.deepEqual(homeDueProgress(s,now,['words']),{done:1,total:2});
});

test('v0.8.7 backups migrate by identity into v0.8.8',()=>{
 const state=defaultState();state.settings.newWordsPerDay=7;
 const backup=makeBackup(state);backup.appVersion='0.8.7';backup.state.appVersion='0.8.7';
 const original=structuredClone(backup.state);
 const migrated=prepareVersionedBackup(backup);
 assert.equal(migrated.appVersion,'0.8.17');assert.deepEqual(migrated.state,original);
 assert.equal(parseBackup(backup).settings.newWordsPerDay,7);
});

test('Ciyan app package includes progress module for host precaching',()=>{
 const pkg=fs.readFileSync(new URL('../package.py',import.meta.url),'utf8');
 assert.match(pkg,/study-progress\.js/);
});
