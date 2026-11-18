import {hskTagFor} from './hsk-tag-map.js';
import {scheduleReview} from './review-scheduler.js';

const check=(ok,message)=>{if(!ok)throw Error(message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const string=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max;
const safeKey=k=>string(k,160)&&!Object.hasOwn(Object.prototype,k)&&k!=='prototype';
const integer=n=>Number.isSafeInteger(n)&&n>0;
function validateItems(items){
 check(object(items),'Missing reader dictionary');
 for(const [id,c] of Object.entries(items)){
  check(safeKey(id)&&object(c)&&['vocab','term','grammar'].includes(c.kind)&&string(c.hanzi,120)&&string(c.english,500)&&string(c.pinyin,160),'Invalid reader flashcard');
 }
}
function checkIds(ids,items){
 check(Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.every(k=>safeKey(k)&&Object.hasOwn(items,k)),'Invalid reader study list');
}
export function validateChapter(p){
 check(p?.format==='ciyan-chapter'&&p.version===1,'Choose a version 1 .ciyan chapter file');
 check(safeKey(p.novel)&&/^[a-z0-9-]+$/.test(p.novel)&&integer(p.number)&&integer(p.revision)&&string(p.book,120)&&string(p.title,200),'Invalid chapter identity');
 validateItems(p.items);checkIds(p.authored,p.items);
 check(Array.isArray(p.paragraphs)&&p.paragraphs.length>0,'This chapter has no paragraphs');
 const used=new Set(),anchors=new Set();
 for(const row of p.paragraphs){
  check(safeKey(row.id)&&!anchors.has(row.id)&&Array.isArray(row.tokens)&&row.tokens.length,'Invalid paragraph');
  anchors.add(row.id);
  for(const span of row.tokens){
   if(typeof span==='string'){check(!/\p{Script=Han}/u.test(span),'Unannotated Chinese text');continue;}
   check(Array.isArray(span)&&(span.length===1||span.length===2&&string(span[1],120))&&Object.hasOwn(p.items,span[0])&&p.items[span[0]].kind!=='grammar','Invalid reading span');
   used.add(span[0]);
  }
 }
 check(used.size&&p.authored.length,'Empty reading gate');
 for(const id of Object.keys(p.items))check(used.has(id)||p.items[id].kind==='grammar','Unused vocabulary');
 return [...used];
}
export function paragraphText(p,row){return row.tokens.map(t=>typeof t==='string'?t:(t[1]??p.items[t[0]].hanzi)).join('');}
export function chapterText(p){return [p.title,...p.paragraphs.map(r=>paragraphText(p,r))].join('\n\n');}
export function acceptChapter(s,p,digest){
 const all=validateChapter(p);
 s.reader??={};
 const b=s.reader[p.novel]??{title:p.book,chapters:[],items:{},progress:{},history:[],current:1};
 const next=b.chapters.length+1;
 check(p.number<=next,'Load chapter '+next+' of '+p.book+' next.');
 const old=b.chapters[p.number-1];
 check(!old||p.revision>old.revision||digest===old.digest,'This revision differs from the saved chapter. Import the original or a newer revision.');
 b.items={...b.items};
 for(const [key,c] of Object.entries(p.items)){
  const existing=b.items[key];
  check(!existing||(existing.kind===c.kind&&existing.hanzi===c.hanzi),'Reader item identity conflict');
  b.items[key]={kind:c.kind,hanzi:c.hanzi,pinyin:c.pinyin,english:c.english};
 }
 let position=old?.position;
 if(position&&!p.paragraphs.some(r=>r.id===position.id)){
  const index=Math.min(position.index||0,p.paragraphs.length-1);
  position={id:p.paragraphs[index].id,index,offset:0};
 }
 b.chapters[p.number-1]={number:p.number,title:p.title,revision:p.revision,digest,authored:p.authored,all,unlocked:old?.unlocked||false,complete:old?.complete||false,position:position||null};
 b.current=p.number;s.reader[p.novel]=b;
}
export function validateReader(books={}){
 check(object(books),'Invalid reader backup');
 for(const [id,b] of Object.entries(books)){
  check(safeKey(id)&&/^[a-z0-9-]+$/.test(id)&&string(b.title,120)&&Array.isArray(b.chapters)&&object(b.progress)&&Array.isArray(b.history),'Invalid novel backup');
  validateItems(b.items);
  check(integer(b.current)&&b.current<=b.chapters.length,'Invalid current chapter');
  for(const [i,c] of b.chapters.entries()){
   check(c.number===i+1&&integer(c.revision)&&/^[a-f0-9]{64}$/.test(c.digest)&&string(c.title,200)&&typeof c.unlocked==='boolean'&&typeof c.complete==='boolean','Invalid saved chapter');
   checkIds(c.all,b.items);checkIds(c.authored,b.items);
   if(c.position)check(safeKey(c.position.id)&&Number.isInteger(c.position.index)&&c.position.index>=0&&Number.isInteger(c.position.offset)&&c.position.offset>=0,'Invalid bookmark');
  }
  for(const [key,r] of Object.entries(b.progress))check(Object.hasOwn(b.items,key)&&Number.isFinite(r.score)&&Number.isFinite(Date.parse(r.dueAt)),'Invalid reader schedule');
  for(const h of b.history)check(Object.hasOwn(b.items,h.key)&&integer(h.grade)&&h.grade<=4&&Number.isFinite(Date.parse(h.at)),'Invalid reader review');
 }
 return books;
}
export function readerAnalysis(s,b,c,now=Date.now()){
 const byWord=new Map([...(s.archived?.cards||[]),...s.cards].map(w=>[w.hanzi,w.id]));
 const schedule=key=>{const w=b.items[key];return w.kind==='vocab'?s.schedules[byWord.get(w.hanzi)]:b.progress[key];};
 const score=key=>schedule(key)?.score||0;
 const keys=s.settings.readerGate==='auto'?c.all:c.authored;
 const average=keys.reduce((sum,k)=>sum+score(k),0)/keys.length;
 const weak=keys.filter(k=>score(k)<1.5),ready=average>=2&&!weak.length;
 const previous=new Set(b.chapters.slice(0,c.number-1).flatMap(ch=>[...ch.all,...ch.authored]));
 const current=new Set([...keys,...c.authored]);
 const due=k=>schedule(k)&&Date.parse(schedule(k).dueAt)<=now;
 const earlier=[...previous].filter(k=>!current.has(k)&&due(k));
 const rank=arr=>arr.sort((a,b)=>score(a)-score(b)||Date.parse(schedule(a)?.lastReviewedAt||'1970')-Date.parse(schedule(b)?.lastReviewedAt||'1970'));
 const weakSet=new Set(weak);
 const queue=[...rank(weak),...rank(keys.filter(k=>!weakSet.has(k)&&(!ready&&score(k)<3||due(k)))),...rank(earlier),...c.authored.filter(k=>!keys.includes(k)&&(!schedule(k)||due(k)))];
 return {average,weak,ready,keys,earlier,queue,score};
}
export function gradeReader(s,b,key,grade,now=Date.now()){
 const item=b.items[key];check(item&&integer(grade)&&grade<=4,'Invalid reader grade');
 const at=new Date(now).toISOString();
 if(item.kind==='vocab'){
  const tag='Reader/'+b.title;
  let card=s.cards.find(c=>c.hanzi===item.hanzi);
  if(!card){
   check(s.cards.length<20000,'Dictionary limit reached');
   card=s.archived?.cards.find(c=>c.hanzi===item.hanzi)||{id:crypto.randomUUID(),hanzi:item.hanzi,pinyin:item.pinyin,english:item.english,tags:[],source:'Reader',createdAt:at};
   if(s.archived)s.archived.cards=s.archived.cards.filter(c=>c.id!==card.id);
   const hsk=hskTagFor(item.hanzi);
   if(hsk&&!card.tags.some(t=>t.startsWith('HSK/')))card={...card,tags:[...card.tags,'HSK/'+hsk.toUpperCase()]};
   for(const t of card.tags)s.settings.tagWeights[t]??=0;
   s.cards=[...s.cards,card];
  }
  s.settings.tagWeights??={};s.settings.tagWeights[tag]??=0;
  if(!card.tags.includes(tag))s.cards=s.cards.map(c=>c.id===card.id?{...c,tags:[...c.tags,tag]}:c);
  const prev=s.schedules[card.id],after=scheduleReview(prev,grade,now,s.settings);
  s.schedules[card.id]=after;
  s.history.push({id:crypto.randomUUID(),cardId:card.id,mode:'words',grade,score:after.score,at,first:!prev,nextDueAt:after.dueAt,source:'Reader'});
 }else b.progress[key]=scheduleReview(b.progress[key],grade,now,s.settings);
 b.history.push({key,grade,at});
}
export function resetReaderProgress(s){
 for(const b of Object.values(s.reader||{})){
  b.progress={};b.history=[];b.current=1;
  for(const c of b.chapters){c.unlocked=false;c.complete=false;c.position=null;}
 }
}
