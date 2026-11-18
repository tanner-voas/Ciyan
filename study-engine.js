import {normalizeFontSettings} from './fonts.js';
import {defaultTagWeight,weightForNewCard,leafTagPaths,validatedTagWeights} from './tag-weights.js';
import {retrievability} from './fsrs.js';
import {scheduleReview,DEFAULT_RETRY} from './review-scheduler.js';
import {grammarTokens,wordKnowledge} from './grammar.js';
import {contextMatches} from './context-matching.js';
import {allParticles,particleWords,particleFamily} from './particles.js';
import {familyEvidence,weaknessWeight,characterEvidence,drawingProfile} from './learning-feedback.js';
import {matchesTagFilters} from './tags.js';
export const MODES={words:'Vocabulary',grammar:'Grammar',drawing:'Drawing',particles:'Particle Zoo'};
export const SHARES={words:.60,grammar:.20,drawing:.12,particles:.08};
export const COSTS={words:12,grammar:35,drawing:50,particles:25};
export const POOLS=['all','due','new'];
const HAS_HAN=/^[\p{Script=Han}]+$/u;
export function ensureStudy(s){
 s.skillSchedules??={grammar:{},drawing:{},particles:{}};
 for(const m of ['grammar','drawing','particles'])s.skillSchedules[m]??={};
 s.postponed??={};s.skillHistory??=[];s.mixedSessions??=[];s.activePractice??=null;
 Object.assign(s.settings,normalizeFontSettings(s.settings));
 s.settings.scheduler??='score';s.settings.retryIntervals??=structuredClone(DEFAULT_RETRY);
 s.settings.autoShares={...SHARES,...s.settings.autoShares};
 s.settings.tagWeights=validatedTagWeights(s.settings.tagWeights);
 for(const tag of leafTagPaths(s.cards||[]))if(s.settings.tagWeights[tag]===undefined)s.settings.tagWeights[tag]=defaultTagWeight(tag);
 s.settings.autoModes={words:true,grammar:true,drawing:true,particles:true,...s.settings.autoModes};
 // Null means unlimited. Zero is a meaningful limit, unlike a blank field.
 const limit=s.settings.newWordsPerDay;
 s.settings.newWordsPerDay=limit===undefined||limit===null||limit===''?null:Math.max(0,Math.min(20000,Math.floor(Number(limit)||0)));
 return s;
}
export function scheduleFor(s,mode,id){return mode==='words'?s.schedules[id]:s.skillSchedules?.[mode]?.[id];}
export function netScore(s,wordId){const x=s.schedules[wordId]?.score;return Number.isFinite(x)?Math.max(0,x):0;}
export function knowledge(s,c,now=Date.now()){return c?wordKnowledge(s.schedules[c.id],retrievability(s.schedules[c.id],now)):0;}
export function contextFor(s,card,now=Date.now(),_index=null,lookup=null){
 const byWord=lookup||new Map(s.cards.map(c=>[c.hanzi,c]));
 const targetChars=new Set([...card.hanzi]);
 const matches=contextMatches(s,card).filter(m=>m.grammar.pinyin&&
  grammarTokens(m.grammar).filter((_,i)=>i<m.start||i>m.end)
   .every(w=>![...w].some(ch=>targetChars.has(ch))));
 return matches.map(m=>{
  const other=[...new Set(grammarTokens(m.grammar).filter((_,i)=>i<m.start||i>m.end))];
  const familiarity=other.length?other.reduce((n,w)=>n+knowledge(s,byWord.get(w),now),0)/other.length:1;
  return {...m,familiarity};
 }).sort((a,b)=>(a.rule==='exact'?0:a.rule==='whole'?1:2)-(b.rule==='exact'?0:b.rule==='whole'?1:2)||
  b.familiarity-a.familiarity||grammarTokens(a.grammar).length-grammarTokens(b.grammar).length)[0]||null;
}
const dayKey=(date)=>{const d=new Date(date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function newVocabToday(s,now=Date.now()){
 const today=dayKey(now),unique=new Set();
 for(const h of s.history)if(h?.cardId&&h.first===true&&dayKey(h.at)===today)unique.add(h.cardId);
 return unique.size;
}
export function newVocabRemaining(s,now=Date.now()){
 const limit=s.settings?.newWordsPerDay;
 return limit===null||limit===undefined?Infinity:Math.max(0,limit-newVocabToday(s,now));
}
export function currentPool(session){return POOLS.includes(session?.pool)?session.pool:'all';}
function anchorMatches(card,filters){
 if(!filters||(!filters.search&&!Object.values(filters.tags||{}).some(Boolean)))return true;
 if(!card||!matchesTagFilters(card.tags||[],filters.tags||{}))return false;
 const q=String(filters.search||'').trim().toLowerCase();
 return !q||[card.hanzi,card.pinyin,card.english,...(card.tags||[])].join(' ').toLowerCase().includes(q);
}
function isFiltered(filters){return !!filters&&(!!String(filters.search||'').trim()||Object.values(filters.tags||{}).some(Boolean));}
function info(s,mode,now,filters){
 const byWord=new Map(s.cards.map(c=>[c.hanzi,c])),cards=s.cards;
 const toCard=w=>byWord.get(w);
 const acceptsGroup=(words)=>{
  const terms=[...new Set(words)].map(w=>({word:w,card:toCard(w)}));
  if(!terms.length||terms.some(x=>!x.card||netScore(s,x.card.id)<1))return false;
  const average=terms.reduce((sum,x)=>sum+netScore(s,x.card.id),0)/terms.length;
  if(average<2)return false;
  if(isFiltered(filters)&&!terms.some(x=>netScore(s,x.card.id)>=2&&anchorMatches(x.card,filters)))return false;
  return true;
 };
 if(mode==='words')return cards.filter(c=>anchorMatches(c,filters)).map(c=>({id:c.id,wordIds:[c.id]}));
 if(mode==='drawing'){
  return cards.filter(c=>HAS_HAN.test(c.hanzi)&&c.pinyin&&netScore(s,c.id)>=2&&anchorMatches(c,filters)).map(c=>({id:c.id,wordIds:[c.id]}));
 }
 if(mode==='grammar')return s.grammar.filter(g=>acceptsGroup([...grammarTokens(g),...(g.distractors||[]).map(d=>d.word)])).map(g=>({id:g.id,wordIds:[...new Set([...grammarTokens(g),...(g.distractors||[]).map(d=>d.word)])].map(w=>toCard(w)?.id).filter(Boolean)}));
 if(mode==='particles')return allParticles(s).filter(p=>acceptsGroup(particleWords(p))).map(p=>({id:p.id,family:particleFamily(p),wordIds:[...new Set(particleWords(p))].map(w=>toCard(w)?.id).filter(Boolean)}));
 return [];
}
export function candidates(s,mode,_auto=false,now=Date.now(),includeFuture=false,filters=null){
 const newWeightLeaves=mode==='words'?new Set(leafTagPaths(s.cards)):null;
 const wordMap=['words','drawing'].includes(mode)?new Map(s.cards.map(c=>[c.id,c])):null;
 const evidence=mode==='particles'?familyEvidence(s):null;
 const chars=mode==='drawing'?new Map(characterEvidence(s).map(x=>[x.character,x])):null;
 return info(s,mode,now,filters).flatMap(item=>{
  const sched=scheduleFor(s,mode,item.id);
  if(!includeFuture&&sched&&Date.parse(sched.dueAt)>now)return [];
  const interval=Math.max(1,(sched?.intervalMinutes||1)*60000);
  const elapsed=sched?Math.max(0,now-Date.parse(sched.lastReviewedAt)):0;
  const weight=sched?Math.max(.000001,elapsed/interval):mode==='words'?weightForNewCard(wordMap.get(item.id),s.settings.tagWeights,newWeightLeaves):1;
  const drawing=chars?drawingProfile(wordMap.get(item.id),sched,chars):null;
  return [{...item,mode,drawingWeight:drawing?.weight,urgency:weight*(drawing?.weight||1)*(evidence?weaknessWeight(evidence.get(item.family)):1),reason:!sched?'first practice':sched.learning?'relearning due':'review due',dueAt:sched?.dueAt||null}];
 });
}
export function availableModes(s,session){return Object.keys(MODES).filter(m=>session?.mode==='auto'?s.settings.autoModes[m]:m===(session?.mode||'words'));}
function deferredUntil(session,item,now){
 const data=session?.deferred?.[`${item.mode}:${item.id}`];
 if(!data)return 0;
 // After another two exercises, or after 15 seconds if no other work remains.
 return (session.turn||0)>=(data.turn||0)?0:(now>=data.at?0:data.at);
}
function sessionAllowed(s,session,item,now){
 if(session?.skipped?.includes(`${item.mode}:${item.id}`))return false;
 if(session?.allowedWords&&item.mode==='words'&&!session.allowedWords.includes(item.id))return false;
 if(deferredUntil(session,item,now)>now)return false;
 if(!item.dueAt&&item.mode==='words'&&newVocabRemaining(s,now)<=0)return false;
 return true;
}
export function modeCounts(s,mode,filters=null,now=Date.now(),session=null){
 const all=candidates(s,mode,false,now,true,filters).filter(item=>!session?.skipped?.includes(`${mode}:${item.id}`)&&(!session?.allowedWords||mode!=='words'||session.allowedWords.includes(item.id)));
 const due=all.filter(x=>x.dueAt&&Date.parse(x.dueAt)<=now);
 const started=all.filter(x=>x.dueAt&&Date.parse(x.dueAt)>now);
 const fresh=all.filter(x=>!x.dueAt);
 const newCount=mode==='words'?Math.min(fresh.length,newVocabRemaining(s,now)):fresh.length;
 // Future-due exercises are shown separately but cannot be selected now.
 return {mode,due:due.length,started:started.length,new:newCount,newTotal:fresh.length,available:due.length+newCount,eligible:all,blocked:Math.max(0,(mode==='words'?s.cards.length:mode==='grammar'?s.grammar.length:mode==='drawing'?s.cards.filter(c=>HAS_HAN.test(c.hanzi)&&c.pinyin).length:allParticles(s).length)-all.length)};
}
export function sessionAvailability(s,session,now=Date.now()){
 const modes=availableModes(s,session).map(m=>modeCounts(s,m,session?.filters||null,now,session));
 const keySet=new Set();let earliest=null;
 for(const row of modes)for(const item of row.eligible){
  if(item.dueAt&&Date.parse(item.dueAt)>now)earliest=earliest===null?Date.parse(item.dueAt):Math.min(earliest,Date.parse(item.dueAt));
  const defer=deferredUntil(session,item,now);
  if(defer>now)earliest=earliest===null?defer:Math.min(earliest,defer);
  keySet.add(`${item.mode}:${item.id}`);
 }
 const remaining=newVocabRemaining(s,now),due=modes.reduce((sum,x)=>sum+x.due,0),fresh=modes.reduce((sum,x)=>sum+x.new,0);
 const pool=currentPool(session);
 return {modes,due,new:fresh,started:modes.reduce((sum,x)=>sum+x.started,0),available:pool==='due'?due:pool==='new'?fresh:due+fresh,nextAt:earliest,remaining,blocked:modes.some(m=>m.blocked),skipped:session?.skipped?.length||0};
}
function pickWeighted(pool,rng){
 const list=pool.map(p=>({p,w:Math.max(.001,Number(p.urgency)||1)})),total=list.reduce((n,x)=>n+x.w,0);
 let r=Math.min(.9999999999,Math.max(0,rng()))*total;
 for(const entry of list){r-=entry.w;if(r<0)return entry.p;}
 return list.at(-1)?.p||null;
}
// Randomly choose a mode according to preferences, then draw a random eligible
// card using overdue/forgetting urgency. A large deck does not overwhelm modes.
export function nextExercise(s,session,now=Date.now(),rng=Math.random){
 const all=availableModes(s,session).flatMap(mode=>candidates(s,mode,false,now,false,session.filters||null))
  .filter(item=>sessionAllowed(s,session,item,now));
 const pool=currentPool(session);
 const due=all.filter(item=>!!item.dueAt),fresh=all.filter(item=>!item.dueAt);
 const selected=pool==='due'?due:pool==='new'?fresh:due.length?due:fresh;
 if(!selected.length)return null;
 const choices=new Map();for(const entry of selected){if(!choices.has(entry.mode))choices.set(entry.mode,[]);choices.get(entry.mode).push(entry);}
 const selectedContext=item=>{if(item?.mode!=='drawing')return item;const card=s.cards.find(c=>c.id===item.id);const ctx=card?contextFor(s,card,now):null;return {...item,contextId:ctx?.grammar.id||null,contextRule:ctx?.rule||null};};
 if(session.mode!=='auto')return selectedContext(pickWeighted(selected,rng));
 const weighted=[...choices].map(([mode,items])=>({mode,items,urgency:(s.settings.autoShares?.[mode]||SHARES[mode])*(selected[0]?.dueAt?items.reduce((n,x)=>n+x.urgency,0)/items.length:1)}));
 const group=pickWeighted(weighted.map(x=>({urgency:x.urgency,...x})),rng);
 return selectedContext(pickWeighted(group.items,rng));
}
export function recordExercise(s,session,grade,details={},now=Date.now()){
 const e=session.current,previous=scheduleFor(s,e.mode,e.id),after=scheduleReview(previous,grade,now,s.settings);
 if(e.mode==='words')s.schedules[e.id]=after;else s.skillSchedules[e.mode][e.id]=after;
 const seconds=Math.max(2,Math.min(180,Number(details.seconds)||COSTS[e.mode]));
 const record={...e,...details,grade,score:after.score,at:new Date(now).toISOString(),seconds,nextDueAt:after.dueAt};
 if(e.mode==='words')s.history.push({...record,id:crypto.randomUUID(),cardId:e.id,first:!previous});
 else if(e.mode==='grammar')s.grammarHistory.push({...record,id:crypto.randomUUID(),grammarId:e.id,correct:typeof details.correct==='boolean'?details.correct:grade>=3});
 else s.skillHistory.push(record);
 s.settings.modeSeconds??={};s.settings.modeSeconds[e.mode]=.8*(s.settings.modeSeconds[e.mode]||COSTS[e.mode])+.2*seconds;
 session.spent[e.mode]=(session.spent[e.mode]||0)+seconds;
 session.turn=(session.turn||0)+1;
 session.results.push(record);session.current=null;session.input={};
 return record;
}
export function skillSummary(s,mode,now=Date.now()){
 const schedules=Object.values(mode==='words'?s.schedules:s.skillSchedules?.[mode]||{});
 const history=mode==='words'?s.history:mode==='grammar'?s.grammarHistory:s.skillHistory.filter(h=>h.mode===mode);
 return {seen:schedules.length,due:schedules.filter(x=>Date.parse(x.dueAt)<=now).length,attempts:history.length,
  success:history.length?history.filter(h=>h.grade?h.grade>=3:h.correct).length/history.length:null,
  recall:schedules.length?schedules.reduce((n,x)=>n+(retrievability(x,now)||0),0)/schedules.length:null};
}
