import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {acceptChapter,readerAnalysis,gradeReader,recordPractice} from '../reader-core.js';
import {defaultState} from '../storage.js';
import {createReader} from '../reader-ui.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';

const bytes=fs.readFileSync(new URL('../reader/panlong/chapters/001.json',import.meta.url));
const p=JSON.parse(bytes),digest=createHash('sha256').update(bytes).digest('hex');
function fixture(){const s=defaultState();acceptChapter(s,p,digest);s.settings.newWordsPerDay=1;return {s,b:s.reader.panlong,c:s.reader.panlong.chapters[0]};}
function reader(s,records){
 const listeners={};globalThis.document={addEventListener:(name,fn)=>{listeners[name]=fn},querySelector:()=>null};
 const ui=createReader({state:()=>s,change:async fn=>{fn(s);return true},render:()=>{},esc:String,modal:(title,html)=>records.push({title,html}),closeModal(){},toast:message=>{throw Error(message)},applyFonts(){}});
 ui.view();return {ui,listeners};
}
function useQuota(s,b){const key=p.lexicon.vocabulary[0];assert.equal(gradeReader(s,b,key,3,Date.now()-2000),true);return key;}

test('v0811: clean version migration preserves 0.8.10 backups',()=>{
 assert.equal(APP_VERSION,'0.8.18');
 const migrated=prepareVersionedBackup({format:'ciyan-backup',version:2,appVersion:'0.8.10',state:{sample:true}});
 assert.equal(migrated.appVersion,'0.8.18');assert.deepEqual(migrated.state,{sample:true});
});

test('v0811: reaching the vocabulary quota blocks new terms and grammar across all reader scopes',async()=>{
 const {s,b,c}=fixture(),now=Date.now();useQuota(s,b);
 const a=readerAnalysis(s,b,c,now);
 for(const kind of ['vocab','term','grammar']){
  const key=Object.keys(b.items).find(key=>b.items[key].kind===kind&&a.blocked.includes(key));
  assert.ok(key,`missing blocked ${kind}`);assert.ok(!a.queue.includes(key));
  assert.equal(gradeReader(s,b,key,3,now),false,`graded new ${kind} past quota`);
 }
 const records=[],{ui,listeners}=reader(s,records);
 await ui.action('study',{dataset:{}});
 for(const scope of ['gate','weak','full']){
  listeners.change({target:{id:'reader-scope',value:scope}});
  const html=ui.view(),chosen=html.match(/data-study-key="([^"]+)"/);
  if(chosen)assert.ok(readerAnalysis(s,b,c).schedule(chosen[1]),`${scope} included new card`);
 }
 assert.doesNotMatch(ui.view(),/data-action="reader-read"[^>]*>Read chapter/);
 assert.doesNotMatch(ui.view(),/reader-quota-notice/);
});

test('v0811: non-due prior cards remain eligible, with no warning; three Goods exhaust practice and open the limit popup',async()=>{
 const {s,b,c}=fixture(),now=Date.now();
 const term=p.lexicon.terms[0];assert.ok(gradeReader(s,b,term,1,now-2000));
 const first=useQuota(s,b),card=s.cards.find(x=>x.hanzi===b.items[first].hanzi);
 s.schedules[card.id].score=1.5;
 let a=readerAnalysis(s,b,c);assert.deepEqual(a.queue,[term]);assert.ok(a.blocked.length);
 const baseline=structuredClone(b.progress[term]),history=b.history.length;
 const records=[],{ui}=reader(s,records);
 await ui.action('study',{dataset:{}});assert.equal(records.length,0,'warning while valid practice remains');
 for(let i=0;i<3;i++){
  let html=ui.view();assert.match(html,/reader-study-card/);assert.match(html,/data-study-key="/);
  await ui.action('reveal',{dataset:{}});
  html=ui.view();const key=html.match(/data-study-key="([^"]+)"/)[1];assert.equal(key,term);
  await ui.action('grade',{dataset:{key,grade:'3'}});
  if(i<2)assert.equal(records.length,0);
 }
 assert.deepEqual(b.progress[term],baseline,'practice must not reschedule prior card');
 assert.equal(b.history.length,history,'practice must not create scheduled-review history');
 a=readerAnalysis(s,b,c,Date.now(),new Map([[term,{goods:3,easy:false,turn:3}]]));
 assert.equal(a.queue.length,0);
 assert.equal(records.length,1);assert.equal(records[0].title,'Daily study limit reached');
 assert.match(records[0].html,/increase the daily limit in Settings/i);
 assert.match(records[0].html,/data-page="settings"/);
 assert.doesNotMatch(ui.view(),/data-action="reader-read"[^>]*>Read chapter/);
 await ui.action('reveal',{dataset:{}});assert.equal(records.length,1,'no repeated modal');
});

test('v0811: no duplicate Read chapter actions in review or active study',async()=>{
 const {s}=fixture();const records=[],{ui}=reader(s,records);
 const overview=ui.view();assert.match(overview,/data-read-state="caution"/);
 assert.match(overview,/reader-readiness-actions/);
 assert.doesNotMatch(overview,/reader-readiness-actions[^]*?data-action="reader-read"/);
 await ui.action('study',{dataset:{}});
 const html=ui.view();assert.match(html,/reader-study-card/);
 assert.equal((html.match(/data-action="reader-read"/g)||[]).length,1,'only top Read tab');
});
