import {retrievability} from './fsrs.js';
import {scheduleReview,DEFAULT_RETRY} from './review-scheduler.js';
import {grammarTokens,grammarScores,wordKnowledge} from './grammar.js';
import {allParticles} from './particles.js';
export const MODES={words:'Vocabulary',grammar:'Grammar',drawing:'Drawing',particles:'Particle Zoo'};
export const SHARES={words:.60,grammar:.20,drawing:.12,particles:.08};
export const COSTS={words:12,grammar:35,drawing:50,particles:25};
export function ensureStudy(s){
 s.skillSchedules??={grammar:{},drawing:{},particles:{}};
 for(const m of ['grammar','drawing','particles'])s.skillSchedules[m]??={};
 s.skillHistory??=[];s.mixedSessions??=[];s.activePractice??=null;
 s.settings.scheduler??='score';s.settings.retryIntervals??=structuredClone(DEFAULT_RETRY);
 s.settings.autoModes={words:true,grammar:true,drawing:true,particles:true,...s.settings.autoModes};
 return s;
}
export function scheduleFor(s,mode,id){return mode==='words'?s.schedules[id]:s.skillSchedules?.[mode]?.[id];}
export function knowledge(s,c,now=Date.now()){return c?wordKnowledge(s.schedules[c.id],retrievability(s.schedules[c.id],now)):0;}
export function contextFor(s,card,now=Date.now(),index=null,lookup=null){
 const byWord=lookup||new Map(s.cards.map(c=>[c.hanzi,c]));
 return (index?(index.get(card.hanzi)||[]):s.grammar.filter(g=>g.pinyin&&grammarTokens(g).includes(card.hanzi))).map(g=>{
  const other=[...new Set(grammarTokens(g).filter(w=>w!==card.hanzi))];
  const familiarity=other.length?other.reduce((n,w)=>n+knowledge(s,byWord.get(w),now),0)/other.length:1;
  return {grammar:g,familiarity};
 }).sort((a,b)=>b.familiarity-a.familiarity||grammarTokens(a.grammar).length-grammarTokens(b.grammar).length)[0]||null;
}
export function candidates(s,mode,auto=false,now=Date.now()){
 const byWord=new Map(s.cards.map(c=>[c.hanzi,c]));
 let items=[];
 if(mode==='words')items=s.cards.map(c=>({id:c.id,wordIds:[c.id]}));
 if(mode==='grammar')items=s.grammar.filter(g=>grammarScores(g,s.cards,s.schedules,x=>retrievability(x,now)).ready).map(g=>({id:g.id,wordIds:grammarTokens(g).map(w=>byWord.get(w)?.id).filter(Boolean)}));
 const contextIndex=new Map();if(mode==='drawing')for(const g of s.grammar){if(!g.pinyin)continue;for(const w of new Set(grammarTokens(g))){if(!contextIndex.has(w))contextIndex.set(w,[]);contextIndex.get(w).push(g);}}
 if(mode==='drawing')items=s.cards.filter(c=>/^[\p{Script=Han}]+$/u.test(c.hanzi)&&c.pinyin).flatMap(c=>{
  if(auto&&knowledge(s,c,now)<.75)return [];
  const ctx=contextFor(s,c,now,contextIndex,byWord);
  if(auto&&(!ctx||ctx.familiarity<.6))return [];
  return [{id:c.id,contextId:ctx?.grammar.id||null,wordIds:[c.id]}];
 });
 if(mode==='particles')items=allParticles(s).filter(p=>!auto||p.base.reduce((n,w)=>n+knowledge(s,byWord.get(w),now),0)/p.base.length>=.6).map(p=>({id:p.id,wordIds:p.base.map(w=>byWord.get(w)?.id).filter(Boolean)}));
 return items.flatMap(item=>{
  const sched=scheduleFor(s,mode,item.id);
  if(sched&&Date.parse(sched.dueAt)>now)return [];
  const r=sched?retrievability(sched,now):1;
  const overdue=sched?Math.max(0,(now-Date.parse(sched.dueAt))/86400000):0;
  const urgency=sched?(sched.learning?3:2)+Math.max(0,s.settings.desiredRetention-r)*4+Math.min(1,overdue/30):1;
  return [{...item,mode,urgency,reason:!sched?'first practice':sched.learning?'relearning due':'review due'}];
 }).sort((a,b)=>b.urgency-a.urgency||a.id.localeCompare(b.id));
}
// Weighted fair queuing in estimated seconds. Urgency adjusts each mode's soft
// share; it is not a fitted or clinically validated optimization model.
export function nextExercise(s,session,now=Date.now()){
 const enabled=Object.keys(MODES).filter(m=>session.mode==='auto'?s.settings.autoModes[m]:m===session.mode);
 const recent=session.results.slice(-3).flatMap(r=>r.wordIds||[]);
 const pool=enabled.map(mode=>{
  const list=candidates(s,mode,session.mode==='auto',now);
  const candidate=list.find(x=>!(mode==='drawing'&&x.wordIds.some(id=>recent.includes(id)))&&!session.results.some(r=>r.mode===mode&&r.id===x.id&&now-Date.parse(r.at)<60000));
  return candidate;
 }).filter(Boolean);
 if(!pool.length)return null;
 const urgent=pool.filter(p=>p.reason==='relearning due');
 const due=pool.filter(p=>p.reason!=='first practice');
 const available=urgent.length?urgent:due.length?due:pool;
 return available.sort((a,b)=>{
  const cost=m=>Math.max(COSTS[m]*.5,Math.min(COSTS[m]*2,s.settings.modeSeconds?.[m]||COSTS[m]));
  const priority=x=>((session.spent[x.mode]||0)+cost(x.mode))/(SHARES[x.mode]*Math.min(2,x.urgency));
  return priority(a)-priority(b)||b.urgency-a.urgency;
 })[0];
}
export function recordExercise(s,session,grade,details={},now=Date.now()){
 const e=session.current,previous=scheduleFor(s,e.mode,e.id);
 const after=scheduleReview(previous,grade,now,s.settings);
 if(e.mode==='words')s.schedules[e.id]=after;else s.skillSchedules[e.mode][e.id]=after;
 const seconds=Math.max(2,Math.min(180,Number(details.seconds)||COSTS[e.mode]));
 const record={...e,...details,grade,score:after.score,at:new Date(now).toISOString(),seconds,nextDueAt:after.dueAt};
 if(e.mode==='words')s.history.push({...record,id:crypto.randomUUID(),cardId:e.id,first:!previous});
 else if(e.mode==='grammar')s.grammarHistory.push({...record,id:crypto.randomUUID(),grammarId:e.id,correct:grade>=3});
 else s.skillHistory.push(record);
 s.settings.modeSeconds??={};s.settings.modeSeconds[e.mode]=.8*(s.settings.modeSeconds[e.mode]||COSTS[e.mode])+.2*seconds;
 session.spent[e.mode]=(session.spent[e.mode]||0)+seconds;
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
