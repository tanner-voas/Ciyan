import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {acceptChapter,readerAnalysis,gradeReader,validateChapter} from '../reader-core.js';
import {clearDictionary,reloadCards} from '../collection-reset.js';
import {defaultState,parseBackup,clearLearningRecords} from '../storage.js';
import {replaceMaster} from '../master.js';
import {prepareVerifiedBackup} from '../backup-integrity.js';
import {scheduleReview} from '../review-scheduler.js';
const chapters=[1,2,3].map(n=>{
 const bytes=fs.readFileSync(new URL('../reader/panlong/chapters/00'+n+'.ciyan',import.meta.url));
 return [JSON.parse(bytes),createHash('sha256').update(bytes).digest('hex')];
});
function restored(s){return parseBackup(JSON.parse(prepareVerifiedBackup(s).json));}
test('three chapters retain recurring and overdue cards through text-free backup and out-of-order reload',()=>{
 const s=defaultState();assert.throws(()=>acceptChapter(s,...chapters[1]),/chapter 1/);
 acceptChapter(s,...chapters[0]);const b=s.reader.panlong,c=b.chapters[0];
 const first=readerAnalysis(s,b,c);assert.equal(first.keys.length,20);assert.ok(first.weak.includes('grammar-即使……也……'));
 s.settings.newWordsPerDay=0;const t=Date.UTC(2026,10,1);
 for(const k of first.keys)for(let i=0;i<11;i++)gradeReader(s,b,k,4,t+i*1000);
 assert.ok(readerAnalysis(s,b,c).ready);c.unlocked=true;c.position={id:'p12',index:11,offset:6};
 assert.ok(s.cards.some(w=>w.hanzi==='斑驳'&&w.tags.includes('Reader/盘龙')));
 assert.ok(!s.cards.some(w=>w.hanzi==='希尔曼'||w.hanzi.includes('……')));
 s.settings.readerGate='auto';const auto=readerAnalysis(s,b,c);
 assert.equal(auto.keys.length,c.all.length);assert.ok(!auto.ready);assert.ok(c.unlocked);
 s.settings.readerGate='authored';acceptChapter(s,...chapters[1]);
 const second=readerAnalysis(s,b,b.chapters[1],t+120*86400000);
 assert.ok(second.earlier.includes('term-蕴气式'));assert.ok(!second.weak.includes('term-林雷'));
 const r=restored(s);assert.deepEqual(r.reader,s.reader);
 assert.ok(!JSON.stringify(r.reader).includes('"tokens"'));
 acceptChapter(r,...chapters[2]);acceptChapter(r,...chapters[0]);
 assert.equal(r.reader.panlong.chapters.length,3);assert.equal(r.reader.panlong.chapters[0].position.offset,6);
 assert.throws(()=>acceptChapter(r,chapters[0][0],'a'.repeat(64)),/revision/);
 clearLearningRecords(r);assert.equal(r.reader.panlong.chapters[0].position,null);assert.equal(r.reader.panlong.history.length,0);
});
test('clear dictionary keeps drawing-only and grammar records; default reload archives studied custom entries',()=>{
 const s=defaultState(),now=Date.now(),master={cards:s.cards,grammar:s.grammar};
 const extra={...s.cards[0],id:'custom-lit',hanzi:'斑驳'};s.cards=[...s.cards,extra];s.schedules[extra.id]=scheduleReview(null,3,now,s.settings);
 s.skillSchedules.drawing[s.cards[0].id]=scheduleReview(null,2,now,s.settings);
 s.grammarHistory.push({grammarId:s.grammar[0].id,at:new Date(now).toISOString(),grade:3});
 clearDictionary(s);assert.equal(s.cards.length,2);assert.equal(s.grammar.length,1);
 assert.deepEqual(restored(s).cards,s.cards);reloadCards(s,master,replaceMaster);
 assert.ok(!s.cards.some(w=>w.id===extra.id));assert.equal(restored(s).schedules[extra.id].reps,1);
 acceptChapter(s,...chapters[0]);gradeReader(s,s.reader.panlong,'vocab-斑驳',3);assert.equal(s.schedules[extra.id].reps,2);assert.equal(restored(s).archived.cards.length,0);
});
test('malformed packages cannot skip annotated text or supply dangling authored cards',()=>{
 const p=structuredClone(chapters[0][0]);p.authored.push('absent');assert.throws(()=>validateChapter(p));
 p.authored.pop();p.paragraphs[0].tokens=['漏'];assert.throws(()=>validateChapter(p),/Unannotated/);
});

test('reader screen handles a graded file import, settings gate, unlock, missing text and actual rendered paragraphs',async()=>{
 const {createReader}=await import('../reader-ui.js');
 const s=defaultState(),messages=[],cached=new Map(),listeners={};let file,done,html,definition;
 globalThis.document={addEventListener:(t,fn)=>listeners[t]=fn,createElement:()=>({files:[file],click(){done=this.onchange();}})};
 globalThis.location={href:'https://example.test/app/'};
 globalThis.caches={open:async()=>({put:async(k,v)=>cached.set(k,v),match:async k=>cached.get(k)?.clone()})};
 const adapter={state:()=>s,change:async(fn)=>{try{fn(s);return true;}catch(e){messages.push(e.message);return false;}},esc:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;'),modal:(title)=>definition=title,toast:m=>messages.push(m),applyFonts:()=>{},render:()=>html=ui.view()};
 const ui=createReader(adapter);
 const action=(n,data={})=>ui.action(n,{dataset:data});
 async function upload(n){file=new Blob([fs.readFileSync(new URL('../reader/panlong/chapters/00'+n+'.ciyan',import.meta.url))]);await action('import');await done;}
 await upload(2);assert.match(messages.at(-1),/chapter 1/);
 await upload(1);assert.match(html,/Authored study list · 20/);
 s.settings.readerGate='auto';assert.match(ui.view(),/All words and terms · 1086/);
 s.settings.readerGate='authored';await action('study');await action('reveal');
 const key=html.match(/data-action="reader-grade" data-key="([^"]+)"/)[1];
 await action('grade',{key,grade:'4'});assert.equal(s.reader.panlong.history.length,1);
 const b=s.reader.panlong;for(const k of b.chapters[0].authored)for(let i=0;i<11;i++)gradeReader(s,b,k,4);
 await action('read');assert.match(html,/id="reader-pages"/);assert.equal(b.chapters[0].unlocked,true);
 const text=[...html.matchAll(/<p data-pid="[^"]+" data-index="\d+">(.*?)<\/p>/gs)].map(x=>x[1].replace(/<[^>]+>/g,'').replaceAll('&amp;','&'));
 const ref=fs.readFileSync(new URL('../reader/panlong/reference/001.txt',import.meta.url),'utf8');
 assert.equal([b.chapters[0].title,...text].join('\n\n'),ref);
 await action('define',{key:'term-乌山镇'});assert.equal(definition,'乌山镇');
 ui.reset();ui.view();await action('read');assert.match(html,/id="reader-pages"/);
 cached.clear();ui.reset();ui.view();await action('read');assert.match(html,/Reload chapter 1/);
 await upload(1);await upload(2);await upload(3);assert.equal(b.chapters.length,3);
});
