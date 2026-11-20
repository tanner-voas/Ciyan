/** Compact progress for scheduled work only; new introductions are never due progress. */
import {availableModes,modeCounts,newVocabToday} from './study-engine.js';

const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const num=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
const dayKey=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`:'';};
const dueAt=(entry,at)=>{
 const old=entry?.previousDueAt||entry?.dueAt;
 return old&&Number.isFinite(Date.parse(old))&&Date.parse(old)<=Date.parse(at);
};

/** Count distinct reviews of previously due exercises made on the user's local day.
 *  Some legacy records have previousDueAt while current records have reason/dueAt.
 */
export function dueReviewedToday(state,now=Date.now(),modes=['words','grammar','drawing','particles','listening']){
 const today=dayKey(now),included=new Set(modes),keys=new Set();
 const eligible=(h,mode)=>included.has(mode)&&dayKey(h.at)===today&&(
  h.reason==='review due'||h.reason==='relearning due'||dueAt(h,h.at)||
  (mode==='words'&&h.source==='Reader'&&h.first===false));
 for(const h of state.history||[])if(eligible(h,'words')&&h.cardId)keys.add(`words:${h.cardId}`);
 for(const h of state.grammarHistory||[])if(eligible(h,'grammar')&&(h.grammarId||h.id))keys.add(`grammar:${h.grammarId||h.id}`);
 for(const h of state.skillHistory||[])if(h.mode&&h.id&&eligible(h,h.mode))keys.add(`${h.mode}:${h.id}`);
 return keys;
}

export function dueKeysForSession(state,session,now=Date.now()){
 if(!session)return [];
 // Skipping/postponing must not falsely count as a completed review.
 const scope={...session,skipped:[]};
 return availableModes(state,session).flatMap(mode=>modeCounts(state,mode,session.filters||null,now,scope).eligible
  .filter(e=>e.dueAt&&Date.parse(e.dueAt)<=now).map(e=>`${mode}:${e.id}`));
}

/** A fixed starting backlog + any newly due exercises, minus those still due. */
export function dueCompletion(startingKeys,currentlyDueKeys,reviewedKeys=[]){
 const outstanding=new Set(currentlyDueKeys),all=new Set([...startingKeys,...currentlyDueKeys,...reviewedKeys]);
 let completed=0;for(const k of all)if(!outstanding.has(k))completed++;
 return {done:completed,total:all.size};
}

export function sessionDueProgress(state,session,now=Date.now()){
 const due=dueKeysForSession(state,session,now);
 const reviewed=(session?.results||[]).filter(e=>e.reason==='review due'||e.reason==='relearning due')
  .map(e=>`${e.mode}:${e.id}`);
 return dueCompletion(session?.dueAtStart||[],due,reviewed);
}

export function homeDueProgress(state,now=Date.now(),modes=['words','grammar','drawing','particles','listening']){
 const available=new Set(modes.flatMap(mode=>modeCounts(state,mode,null,now).eligible
  .filter(e=>e.dueAt&&Date.parse(e.dueAt)<=now).map(e=>`${mode}:${e.id}`)));
 const reviewed=dueReviewedToday(state,now,modes);
 return dueCompletion(reviewed,available);
}

/** Values are plain numeric data. Limit null/undefined = unlimited (no New row). */
export function progressDisplay(due,seen,limit){
 const done=num(due?.done),total=Math.max(done,num(due?.total));
 const result={due:{done,total,percent:total?clamp(100*done/total,0,100):100}};
 if(limit!==null&&limit!==undefined&&Number.isFinite(Number(limit))){
  const cap=clamp(Math.floor(Number(limit)),0,20000),used=num(seen);
  result.new={done:used,total:cap,percent:cap?clamp(100*used/cap,0,100):0};
 }
 return result;
}

export function studyProgressMarkup(due,seen,limit){
 const rows=progressDisplay(due,seen,limit);
 const row=(label,values,description)=>{
  const right=values.total?`${values.done} / ${values.total}`:(label==='Due'?'0 due':'0 / 0');
  const aria=`${label}: ${description}; ${right}`;
  return `<div class="study-mini-row"><span class="study-mini-label">${label}</span><div class="study-mini-track" role="progressbar" aria-label="${aria}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(values.percent)}"><span class="study-mini-fill${label==='New'?' study-mini-fill-new':''}" style="width:${values.percent}%"></span></div><span class="study-mini-value" aria-hidden="true">${right}</span></div>`;
 };
 return `<div class="study-mini-progress" aria-label="Study progress">${row('Due',rows.due,'scheduled reviews cleared')}${rows.new?row('New',rows.new,'vocabulary words first seen today of daily limit'):''}</div>`;
}

export function studyProgressForState(state,due){return studyProgressMarkup(due,newVocabToday(state),state.settings?.newWordsPerDay);}
