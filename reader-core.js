import {defaultTagWeight} from './tag-weights.js';
import {hskTagFor} from './hsk-tag-map.js';
import {newVocabRemaining} from './study-engine.js';
import {normalizeGrammar} from './grammar.js';
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
// The old format carried an authored list of words, terms and grammar.
// It remains importable, but only terms and grammar are chapter-specific.
export function chapterFocus(chapter,items){
 const focus=chapter.focus??chapter.authored?.filter(id=>items?.[id]?.kind!=='vocab')??[];
 return focus;
}
function checkIds(ids,items){
 check(Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.every(k=>safeKey(k)&&Object.hasOwn(items,k)),'Invalid reader study list');
}
export function validateChapter(p){
 check(p?.format==='ciyan-chapter'&&p.version===1,'Choose a version 1 .json chapter file');
 check(safeKey(p.novel)&&/^[a-z0-9-]+$/.test(p.novel)&&integer(p.number)&&integer(p.revision)&&string(p.book,120)&&string(p.title,200)&&
  (p.author===undefined||string(p.author,120))&&
  (p.volume===undefined||integer(p.volume)&&p.volume<=999)&&
  (p.volumeTitle===undefined||p.volume!==undefined&&string(p.volumeTitle,120)),'Invalid chapter identity');
 validateItems(p.items);
 if(p.authored!==undefined)checkIds(p.authored,p.items); // Legacy chapter compatibility.
 const focus=chapterFocus(p,p.items);checkIds(focus,p.items);
 check(focus.every(id=>['term','grammar'].includes(p.items[id].kind)),'Chapter focus must contain only terms and grammar');
 if(p.lexicon){
  check(object(p.lexicon),'Invalid chapter lexicon');
  for(const [name,kind] of [['vocabulary','vocab'],['grammar','grammar'],['terms','term']]){
   checkIds(p.lexicon[name],p.items);
   check(p.lexicon[name].every(k=>p.items[k].kind===kind),'Incorrect chapter lexicon category');
   check(p.lexicon[name].length===Object.values(p.items).filter(x=>x.kind===kind).length,'Incomplete chapter lexicon');
  }
 }
 if(p.grammarCards){
  check(object(p.grammarCards),'Invalid chapter grammar cards');
  for(const [id,g] of Object.entries(p.grammarCards)){
   check(p.items[id]?.kind==='grammar'&&object(g),'Invalid chapter grammar example');
   normalizeGrammar({...g,id:'reader-check-'+id});
  }
  check(Object.keys(p.grammarCards).length===Object.values(p.items).filter(x=>x.kind==='grammar').length,'Chapter grammar examples missing');
 }
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
 check(used.size,'This chapter has no annotated Chinese');
 check(focus.every(id=>p.items[id].kind==='grammar'||used.has(id)),'Focused term is not present in the chapter');
 for(const id of Object.keys(p.items))check(used.has(id)||p.items[id].kind==='grammar','Unused vocabulary');
 return [...used];
}
export function paragraphText(p,row){return row.tokens.map(t=>typeof t==='string'?t:(t[1]??p.items[t[0]].hanzi)).join('');}
export function chapterText(p){return [p.title,...p.paragraphs.map(r=>paragraphText(p,r))].join('\n\n');}
export function importChapterLexicon(s,p){
 const tag=`Reader/${p.book}`;
 s.settings??={};s.settings.tagWeights??={};s.settings.tagWeights[tag]??=defaultTagWeight(tag);
 const byWord=new Map(s.cards.map(c=>[c.hanzi,c]));
 const ids=new Set(s.cards.map(c=>c.id));
 for(const [key,item] of Object.entries(p.items)){
  if(item.kind!=='vocab')continue;
  let card=byWord.get(item.hanzi);
  if(!card){
   check(s.cards.length<20000,'Dictionary limit reached');
   let id=`reader-${p.novel}-${key}`;let suffix=1;
   while(ids.has(id))id=`reader-${p.novel}-${key}-${suffix++}`;
   ids.add(id);
   const hsk=hskTagFor(item.hanzi);
   const archived=s.archived?.cards?.find(w=>w.hanzi===item.hanzi);
   card=archived?{...archived,tags:[...new Set([...archived.tags,tag])]}:{id,hanzi:item.hanzi,pinyin:item.pinyin,english:item.english,tags:[tag,...(hsk?[`HSK/${hsk.toUpperCase()}`]:[])],source:'Reader',createdAt:new Date().toISOString()};
   if(archived)s.archived.cards=s.archived.cards.filter(w=>w.hanzi!==item.hanzi);
   s.cards.push(card);byWord.set(card.hanzi,card);
  }else if(!card.tags.includes(tag)){
   // Retain IDs, definitions and all accumulated learning history.
   card.tags=[...card.tags,tag];
  }
  for(const t of card.tags)s.settings.tagWeights[t]??=defaultTagWeight(t);
 }
 if(!p.grammarCards)return;
 const known=new Map(s.grammar.map(g=>[g.markup,g]));
 const existingIds=new Set(s.grammar.map(g=>g.id));
 for(const [key,example] of Object.entries(p.grammarCards)){
  const markup=example.markup;
  const pattern=p.items[key]?.hanzi;
  let card=known.get(markup);
  if(card){
   // Previously existing grammar is still part of the novel's lexicon.
   // Do not reset its score or duplicate the card.
   card.tags=[...new Set([...(card.tags||[]),tag])];
   card.readerPattern??=pattern;
  }else{
   let id=`reader-grammar-${p.novel}-${key}`,i=1;
   while(existingIds.has(id))id=`reader-grammar-${p.novel}-${key}-${i++}`;
   card=normalizeGrammar({...example,id,readerPattern:pattern,source:`Reader/${p.book}`,tags:[tag]});
   s.grammar.push(card);known.set(markup,card);existingIds.add(id);
  }
  // Preserve reviews made in previous reader versions, but only when the
  // corresponding general grammar entry has not been studied yet.
  const legacy=s.reader?.[p.novel]?.progress?.[key];
  s.skillSchedules??={};s.skillSchedules.grammar??={};
  if(legacy&&!s.skillSchedules.grammar[card.id])s.skillSchedules.grammar[card.id]=structuredClone(legacy);
 }
}
export function acceptChapter(s,p,digest){
 const all=validateChapter(p);
 importChapterLexicon(s,p);
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
 if(position&&old.digest!==digest){
  const row=p.paragraphs.find(r=>r.id===position.id);
  if(row){
   let offset=0,wordIndex=-1,restored=null;
   for(const token of row.tokens){
    const text=typeof token==='string'?token:token[1]??p.items[token[0]].hanzi;
    if(Array.isArray(token)&&(!restored||offset<=position.offset))restored={wordIndex:++wordIndex,offset};
    offset+=text.length;
   }
   if(restored)position={...position,...restored};
  }
 }
 if(position&&!p.paragraphs.some(r=>r.id===position.id)){
  const index=Math.min(position.index||0,p.paragraphs.length-1);
  position={id:p.paragraphs[index].id,index,offset:0};
 }
 b.chapters[p.number-1]={number:p.number,title:p.title,revision:p.revision,digest,focus:chapterFocus(p,p.items),all,unlocked:old?.unlocked||false,complete:old?.complete||false,position:position||null};
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
   checkIds(c.all,b.items);
   // Normalize imported v0.8.2 backups and split IndexedDB reader catalogs.
   if(c.authored!==undefined&&c.focus===undefined)c.focus=chapterFocus(c,b.items);
   delete c.authored;
   checkIds(c.focus??[],b.items);
   check((c.focus??[]).every(id=>['term','grammar'].includes(b.items[id].kind)),'Invalid reader focus');
   if(c.position)check(safeKey(c.position.id)&&Number.isInteger(c.position.index)&&c.position.index>=0&&Number.isInteger(c.position.offset)&&c.position.offset>=0&&
    (c.position.wordIndex===undefined||Number.isSafeInteger(c.position.wordIndex)&&c.position.wordIndex>=0)&&
    (c.position.guided===undefined||typeof c.position.guided==='boolean'),'Invalid bookmark');
  }
  for(const [key,r] of Object.entries(b.progress))check(Object.hasOwn(b.items,key)&&Number.isFinite(r.score)&&Number.isFinite(Date.parse(r.dueAt)),'Invalid reader schedule');
  for(const h of b.history)check(Object.hasOwn(b.items,h.key)&&integer(h.grade)&&h.grade<=4&&Number.isFinite(Date.parse(h.at)),'Invalid reader review');
 }
 return books;
}
// Evidence lives in the reader controller for the lifetime of this document.
export function recordPractice(evidence,key,grade){
 const previous=evidence.get(key)||{goods:0,easy:false,turn:0};
 evidence.set(key,{goods:previous.goods+Number(grade===3),easy:previous.easy||grade===4,turn:previous.turn+1});
}
export function readerAnalysis(s,b,c,now=Date.now(),evidence=new Map()){
 const byWord=new Map([...(s.archived?.cards||[]),...s.cards].map(w=>[w.hanzi,w.id]));
 const byGrammar=new Map(s.grammar.filter(g=>g.readerPattern).map(g=>[g.readerPattern,g.id]));
 const schedule=key=>{const w=b.items[key];return w.kind==='vocab'?s.schedules[byWord.get(w.hanzi)]:w.kind==='grammar'?(s.skillSchedules?.grammar?.[byGrammar.get(w.hanzi)]||b.progress[key]):b.progress[key];};
 const score=key=>schedule(key)?.score||0;
 const focused=new Set(chapterFocus(c,b.items));
 const keys=[...new Set([...c.all,...focused])];
 // No inferred HSK proficiency: only actual learning records or this session's
 // provisional chapter evidence can make an item ready.
 const qualifies=k=>score(k)>=1.5||evidence.get(k)?.goods>=3||evidence.get(k)?.easy;
 const due=k=>schedule(k)&&Date.parse(schedule(k).dueAt)<=now;
 const group=k=>due(k)?0:schedule(k)?2:1;
 const order=(a,b)=>group(a)-group(b)||(evidence.get(a)?.turn||0)-(evidence.get(b)?.turn||0)||
  (Date.parse(schedule(a)?.dueAt)||0)-(Date.parse(schedule(b)?.dueAt)||0);
 const weak=keys.filter(k=>!qualifies(k)).sort(order);
 const selected=new Set(keys);
 const previous=new Set(b.chapters.slice(0,c.number-1).flatMap(ch=>[...ch.all,...chapterFocus(ch,b.items)]));
 const earlier=[...previous].filter(k=>!selected.has(k)&&due(k)).sort(order);
 const remaining=newVocabRemaining(s,now);
 // The daily vocabulary limit also pauses introduction of novel-specific terms
 // and grammar. These do not themselves consume vocabulary quota.
 const quotaBlocked=k=>remaining<=0&&!schedule(k);
 const queue=[...new Set([...earlier,...keys.filter(k=>!quotaBlocked(k)&&(due(k)||!qualifies(k)) )])].sort(order);
 const blocked=keys.filter(k=>quotaBlocked(k)&&!qualifies(k));
 const focus=new Set([...focused,...b.chapters.slice(0,c.number-1).flatMap(ch=>chapterFocus(ch,b.items))]);
 return {weak,ready:weak.length===0,keys,earlier,queue,blocked,score,schedule,group,qualifies,focus};
}
// Chapter-specific terms and grammar receive 6x selection weight. Due cards
// still receive a modest boost, without permanently starving other vocabulary.
export function pickReaderItem(queue,analysis,random=Math.random){
 if(!queue.length)return undefined;
 const weights=queue.map(id=>(analysis.focus.has(id)?6:1)*(analysis.group(id)===0?2:1));
 let remaining=weights.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(1,random()));
 for(let i=0;i<queue.length;i++)if((remaining-=weights[i])<0)return queue[i];
 return queue.at(-1);
}
export function gradeReader(s,b,key,grade,now=Date.now()){
 const item=b.items[key];check(item&&integer(grade)&&grade<=4,'Invalid reader grade');
 const existing=item.kind==='vocab'?(s.cards.find(c=>c.hanzi===item.hanzi)||s.archived?.cards?.find(c=>c.hanzi===item.hanzi)):null;
 const grammar=item.kind==='grammar'?s.grammar.find(g=>g.readerPattern===item.hanzi):null;
 const previous=item.kind==='vocab'?s.schedules[existing?.id]:grammar?(s.skillSchedules?.grammar?.[grammar.id]||b.progress[key]):b.progress[key];
 if(previous&&Date.parse(previous.dueAt)>now)return false;
 // Do not allow direct grades to bypass the reader's exhausted new-card gate.
 if(!previous&&newVocabRemaining(s,now)<=0)return false;
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
   for(const t of card.tags)s.settings.tagWeights[t]??=defaultTagWeight(t);
   s.cards=[...s.cards,card];
  }
  s.settings.tagWeights??={};s.settings.tagWeights[tag]??=0;
  if(!card.tags.includes(tag))s.cards=s.cards.map(c=>c.id===card.id?{...c,tags:[...c.tags,tag]}:c);
  const prev=s.schedules[card.id],after=scheduleReview(prev,grade,now,s.settings);
  s.schedules[card.id]=after;
  s.history.push({id:crypto.randomUUID(),cardId:card.id,mode:'words',grade,score:after.score,at,first:!prev,nextDueAt:after.dueAt,source:'Reader'});
 }else if(grammar){
  const after=scheduleReview(previous,grade,now,s.settings);
  s.skillSchedules.grammar[grammar.id]=after;
  // Retain the chapter-level record for old backups and the Reader's own
  // history, while sharing the mastery schedule with main Grammar practice.
  b.progress[key]=after;
  s.grammarHistory.push({id:crypto.randomUUID(),grammarId:grammar.id,mode:'grammar',grade,score:after.score,at,nextDueAt:after.dueAt,correct:grade>=3,source:'Reader'});
 }else b.progress[key]=scheduleReview(previous,grade,now,s.settings);
 b.history.push({key,grade,at});
 return true;
}
export function readerGradePreview(s,b,key,now=Date.now()){
 const item=b.items[key];if(!item)return [];
 const card=item.kind==='vocab'?s.cards.find(w=>w.hanzi===item.hanzi):null;
 const grammar=item.kind==='grammar'?s.grammar.find(g=>g.readerPattern===item.hanzi):null;
 const previous=item.kind==='vocab'?s.schedules[card?.id]:grammar?(s.skillSchedules?.grammar?.[grammar.id]||b.progress[key]):b.progress[key];
 return [1,2,3,4].map(grade=>scheduleReview(previous,grade,now,s.settings));
}
export function resetReaderProgress(s){
 for(const b of Object.values(s.reader||{})){
  b.progress={};b.history=[];b.current=1;
  for(const c of b.chapters){c.unlocked=false;c.complete=false;c.position=null;}
 }
}
