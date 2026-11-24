import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {acceptChapter,chapterText,readerAnalysis,gradeReader,recordPractice,readerGradePreview,validateChapter} from '../reader-core.js';
import {defaultState} from '../storage.js';
import {scheduleFor} from '../study-engine.js';
import {normalizeGrammar} from '../grammar.js';
import {createReader} from '../reader-ui.js';

const chapter=n=>{
 const bytes=fs.readFileSync(new URL(`../reader/panlong/chapters/${String(n).padStart(3,'0')}.json`,import.meta.url));
 return {p:JSON.parse(bytes),bytes,digest:createHash('sha256').update(bytes).digest('hex')};
};
function loaded(n=1){const {p,bytes,digest}=chapter(n),s=defaultState();acceptChapter(s,p,digest);return {s,b:s.reader.panlong,c:s.reader.panlong.chapters[0],p,bytes,digest};}

test('v089: all twenty-three chapters preserve the original Chinese narrative and explicitly classify their lexicon',()=>{
 for(let n=1;n<=23;n++){
  const {p}=chapter(n);
  validateChapter(p);
  const text=fs.readFileSync(new URL(`../reader/panlong/reference/${String(n).padStart(3,'0')}.txt`,import.meta.url),'utf8');
  assert.equal(chapterText(p),text,`chapter ${n} prose changed`);
  assert.deepEqual(Object.values(p.lexicon).map(list=>list.length),[
   Object.values(p.items).filter(w=>w.kind==='vocab').length,
   Object.values(p.items).filter(w=>w.kind==='grammar').length,
   Object.values(p.items).filter(w=>w.kind==='term').length
  ]);
  assert.equal(Object.keys(p.grammarCards).length,p.lexicon.grammar.length);
 }
});

test('v089: new readers have zero readiness; chapter terms stay out of master vocab and grammar gets Reader tags',()=>{
 const {s,b,c,p}=loaded();
 const a=readerAnalysis(s,b,c);
 assert.equal(a.keys.length,validateChapter(p).length+p.lexicon.grammar.length);
 assert.equal(a.weak.length,a.keys.length);
 assert.equal(a.ready,false);
 assert.ok(s.cards.some(w=>w.hanzi==='斑驳'&&w.tags.includes('Reader/盘龙')));
 assert.ok(!s.cards.some(w=>w.hanzi==='希尔曼'));
 assert.ok(!s.cards.some(w=>w.hanzi==='林雷'));
 for(const key of p.lexicon.grammar){
  const pattern=p.items[key].hanzi;
  const g=s.grammar.find(x=>x.readerPattern===pattern);
  assert.ok(g&&g.tags.includes('Reader/盘龙'),pattern);
 }
});

test('v089: chapter grammar grades update global Grammar mastery; imported historical progress is retained',()=>{
 const {s,b,c,p,digest}=loaded();
 const key=p.lexicon.grammar[0],pattern=p.items[key].hanzi;
 const grammar=s.grammar.find(g=>g.readerPattern===pattern);
 const now=Date.now();
 assert.ok(gradeReader(s,b,key,3,now));
 assert.equal(scheduleFor(s,'grammar',grammar.id),b.progress[key]);
 assert.equal(s.grammarHistory.at(-1).grammarId,grammar.id);
 assert.deepEqual(readerGradePreview(s,b,key,now).length,4);
 const newer=structuredClone(s);
 delete newer.skillSchedules.grammar[grammar.id];
 acceptChapter(newer,p,digest);
 assert.deepEqual(newer.skillSchedules.grammar[grammar.id],newer.reader.panlong.progress[key]);
 const ahead=structuredClone(s);
 ahead.skillSchedules.grammar[grammar.id]={...ahead.skillSchedules.grammar[grammar.id],score:1.8,dueAt:new Date(now+86400000).toISOString()};
 assert.ok(readerAnalysis(ahead,ahead.reader.panlong,ahead.reader.panlong.chapters[0],now).qualifies(key));
});

test('v089: Reader new vocabulary shares the main daily cap; new terms pause at the cap',()=>{
 const {s,b,c,p}=loaded();const now=Date.now();s.settings.newWordsPerDay=1;
 const [first,second]=p.lexicon.vocabulary.filter(k=>!s.schedules[s.cards.find(w=>w.hanzi===p.items[k].hanzi)?.id]).slice(0,2);
 assert.ok(gradeReader(s,b,first,3,now));
 const firstCard=s.cards.find(w=>w.hanzi===p.items[first].hanzi);
 assert.ok(s.schedules[firstCard.id]);
 assert.equal(s.history.at(-1).first,true);
 const history=s.history.length;
 assert.equal(gradeReader(s,b,second,3,now+20),false);
 assert.equal(s.history.length,history);
 const a=readerAnalysis(s,b,c,now+20);
 assert.ok(a.blocked.includes(second));
 assert.ok(!a.queue.includes(second),'Daily limit cannot be bypassed through the default Reader queue');
 const term=p.lexicon.terms[0];
 assert.ok(a.blocked.includes(term));
 assert.ok(!a.queue.includes(term));
 assert.equal(gradeReader(s,b,term,3,now+20),false);
});

test('v089: not-yet-due Reader practice never changes schedule; 3 Good or 1 Easy makes it ready this chapter',()=>{
 const {s,b,c,p}=loaded();const key=p.lexicon.terms[0],now=Date.now(),evidence=new Map();
 assert.ok(gradeReader(s,b,key,1,now));
 const before=structuredClone(b.progress[key]),hist=b.history.length;
 assert.equal(gradeReader(s,b,key,3,now+10),false);
 assert.deepEqual(b.progress[key],before);
 assert.equal(b.history.length,hist);
 for(let i=0;i<3;i++)recordPractice(evidence,key,3);
 const a=readerAnalysis(s,b,c,now+10,evidence);
 assert.ok(a.qualifies(key));assert.ok(!a.queue.includes(key));
 const key2=p.lexicon.terms[1];recordPractice(evidence,key2,4);
 assert.ok(readerAnalysis(s,b,c,now+10,evidence).qualifies(key2));
});

test('v089: Reader data never imports a generic grammar description as an unannotated master sentence',()=>{
 const {s,p}=loaded();
 for(const key of p.lexicon.grammar){
  const target=s.grammar.find(g=>g.readerPattern===p.items[key].hanzi);
  assert.ok(target);
  assert.ok(target.markup.includes('{'));
  assert.equal(normalizeGrammar(target).readerPattern,target.readerPattern);
 }
});

test('v089: Reading is available at 0% with a warning, dictionary details are full, and term highlighting is separate',async()=>{
 const {s,p,bytes,digest}=loaded();
 s.settings.readerAidLevel=1;
 let latest='',content='';
 globalThis.location={href:'https://ciyan-local.test/'};
 globalThis.caches={open:async()=>({match:async()=>new Response(bytes),put:async()=>{}})};
 globalThis.document={addEventListener(){},querySelector(){return null}};
 const ui=createReader({state:()=>s,change:async fn=>{fn(s);return true;},render(){},esc:String,modal:(title,html)=>{latest=title;content=html;},closeModal(){},toast:m=>{throw Error(m)},applyFonts(){}});
 const overview=ui.view();
 assert.match(overview,/0% ready/);
 assert.doesNotMatch(overview,/reader-read-action--caution/);
 assert.doesNotMatch(overview,/data-action="reader-read"(?=[^>]*>Read chapter)/);
 assert.match(overview,/data-read-state="caution"/);
 assert.doesNotMatch(overview,/How chapter preparation works/);
 assert.match(overview,/data-action="card-detail"/);
 assert.doesNotMatch(overview,/data-action="reader-define"/);
 await ui.action('read',{dataset:{}});
 assert.match(latest,/Read before finishing study/);
 assert.match(content,new RegExp('0 out of '+(validateChapter(p).length+p.lexicon.grammar.length)));
 assert.match(content,/reader-read-anyway/);
 await ui.action('read-anyway',{dataset:{}});
 const reading=ui.view();
 assert.match(reading,/id="reader-pages"/);
 assert.match(reading,/show-weak/);
 assert.match(reading,/show-terms/);
 assert.match(reading,/reader-term/);
 assert.match(reading,/reader-weak/);
 assert.match(reading,/reader-term reader-weak/);
 assert.match(reading,/reader-terms-in-book/);
});

test('v089: Reader weak/full scopes cannot bypass the daily new-word quota',async()=>{
 const {s,b,c,p}=loaded();s.settings.newWordsPerDay=1;
 const now=Date.now(),first=p.lexicon.vocabulary[0];
 assert.ok(gradeReader(s,b,first,3,now));
 const listeners={};globalThis.document={addEventListener:(name,fn)=>listeners[name]=fn,querySelector(){return null}};
 const ui=createReader({state:()=>s,change:async fn=>{fn(s);return true},render(){},esc:String,modal(){},toast:m=>{throw Error(m)},applyFonts(){}});
 ui.view();await ui.action('study',{dataset:{}});
 let html=ui.view();
 assert.doesNotMatch(html,/Daily study limit reached/);
 const match=html.match(/data-study-key="([^"]+)"/);assert.ok(match);
 assert.ok(readerAnalysis(s,b,c).schedule(match[1]),'Only previously introduced cards can appear after quota');
 for(const value of ['weak','full']){
  listeners.change({target:{id:'reader-scope',value}});
  html=ui.view();
  const chosen=html.match(/data-study-key="([^"]+)"/);assert.ok(chosen);
  assert.ok(readerAnalysis(s,b,c).schedule(chosen[1]),`${value} circumvented the new-card limit`);
  assert.doesNotMatch(html,/Daily study limit reached/);
 }
});
