import {scheduleReview as fsrsReview,previewIntervals as fsrsPreview} from './fsrs.js';
export const UNITS={seconds:1,minutes:60,hours:3600,days:86400,weeks:604800};
export const DEFAULT_RETRY=[{value:10,unit:'minutes'},{value:6,unit:'hours'},{value:3,unit:'days'},{value:2,unit:'weeks'}];
export function retrySeconds(config=DEFAULT_RETRY){
 if(!Array.isArray(config)||config.length!==4)throw new Error('Set all four retry intervals.');
 const values=config.map(x=>Number(x.value)*UNITS[x.unit]);
 if(values.some(n=>!Number.isFinite(n)||n<1||n>315360000))throw new Error('Retry intervals must be between 1 second and 10 years.');
 if(values.some((n,i)=>i&&n<values[i-1]))throw new Error('Intervals must increase (or stay equal) from Again to Easy.');
 return values;
}
export function interpolatedSeconds(score,config=DEFAULT_RETRY){
 const values=retrySeconds(config),s=Math.max(0,Number(score)||0);
 if(s>=3)return values[3]*(s-2); // Linear extrapolation above 3: score 3.2 = 2 weeks × 1.2.
 const lo=Math.floor(s),hi=lo+1;return values[lo]*Math.pow(values[hi]/values[lo],s-lo);
}
// Gradual evidence accumulation. Short retries earn less credit than spaced recall.
export function historyScore(previous,grade,now=Date.now()){
 if(![1,2,3,4].includes(grade))throw new Error('Invalid rating');
 const old=Math.max(0,Number.isFinite(previous?.score)?previous.score:0);
 if(grade===1)return old*.8;
 const elapsed=previous?.lastReviewedAt?Math.max(0,(now-Date.parse(previous.lastReviewedAt))/1000):0;
 const spacing=Math.min(1,elapsed/Math.max(21600,(previous?.intervalMinutes||0)*30));
 const alpha=(previous?.reps||0)>0 ? .08+.12*spacing : .18;
 if(grade===4)return Math.max(old+.2,old+alpha*(3-old));
 return Math.max(0,old+alpha*((grade-1)-old));
}
export function scheduleReview(previous,grade,now=Date.now(),settings={}){
 if(typeof settings==='number')settings={scheduler:'fsrs',desiredRetention:settings};
 const after=fsrsReview(previous,grade,now,settings.desiredRetention||.9);
 after.score=historyScore(previous,grade,now);after.scoreModel='gradual-v2';after.fsrsIntervalMinutes=after.intervalMinutes;
 if((settings.scheduler||'score')==='fsrs')return after;
 const targets=retrySeconds(settings.retryIntervals||DEFAULT_RETRY);
 // A mature lapse must be retried promptly without destroying accumulated score.
 // Hard/Again constrain the immediate interval; Good/Easy keep the score curve.
 const seconds=grade===1?Math.min(interpolatedSeconds(after.score,settings.retryIntervals||DEFAULT_RETRY),targets[0]):
  grade===2?Math.min(interpolatedSeconds(after.score,settings.retryIntervals||DEFAULT_RETRY),targets[1]):
  interpolatedSeconds(after.score,settings.retryIntervals||DEFAULT_RETRY);
 return {...after,dueAt:new Date(now+seconds*1000).toISOString(),intervalMinutes:seconds/60,learning:grade<=2,scheduler:'score'};
}
export function intervalText(seconds){
 const n=Math.max(0,Number(seconds)||0);
 const [unit,scale]=n>=604800?['w',604800]:n>=86400?['d',86400]:n>=3600?['h',3600]:n>=60?['m',60]:['s',1];
 return `${(n/scale).toFixed(1)}${unit}`;
}
export function previewOutcomes(previous,now=Date.now(),settings={}){
 if(typeof settings==='number')settings={scheduler:'fsrs',desiredRetention:settings};
 return [1,2,3,4].map(grade=>{const next=scheduleReview(previous,grade,now,settings);return {grade,score:next.score,interval:intervalText(next.intervalMinutes*60),dueAt:next.dueAt};});
}
export function previewIntervals(previous,now=Date.now(),settings={}){
 if(typeof settings==='number')settings={scheduler:'fsrs',desiredRetention:settings};
 return previewOutcomes(previous,now,settings).map(x=>x.interval);
}
export function rescheduleExisting(schedule,settings){
 const score=Number.isFinite(schedule.score)?schedule.score:Math.max(0,(schedule.lastRating||1)-1);
 const targets=retrySeconds(settings.retryIntervals||DEFAULT_RETRY);
 const curved=interpolatedSeconds(score,settings.retryIntervals||DEFAULT_RETRY);
 const adjusted=schedule.lastRating===1?Math.min(curved,targets[0]):schedule.lastRating===2?Math.min(curved,targets[1]):curved;
 const minutes=settings.scheduler==='fsrs'?(schedule.fsrsIntervalMinutes||schedule.intervalMinutes):adjusted/60;
 return {...schedule,score,intervalMinutes:minutes,dueAt:new Date(Date.parse(schedule.lastReviewedAt)+minutes*60000).toISOString(),scheduler:settings.scheduler};
}
// One bin boundary is always now; each item goes in exactly one bucket.
export function dueHistogram(entries,width=360,now=Date.now()){
 const values=entries.filter(e=>Number.isFinite(Date.parse(e.dueAt))).map(e=>({...e,offset:(Date.parse(e.dueAt)-now)/1000}));
 if(!values.length)return {bins:[],step:0};
 const limit=Math.max(5,Math.min(18,Math.floor(width/48))),min=Math.min(0,...values.map(e=>e.offset)),max=Math.max(1,...values.map(e=>e.offset));
 const sizes=[1,5,10,30,60,300,600,1800,3600,10800,21600,43200,86400,259200,604800,1209600,2592000,7776000,31536000,315360000];
 let step=sizes.find(s=>Math.ceil(max/s)-Math.floor(min/s)<=limit)||Math.ceil((max-min)/limit);
 const first=Math.floor(min/step),last=Math.max(first+1,Math.ceil(max/step));
 const bins=Array.from({length:last-first},(_,i)=>({start:(first+i)*step,end:(first+i+1)*step,counts:{words:0,grammar:0,drawing:0,particles:0},total:0}));
 for(const v of values){const i=Math.max(0,Math.min(bins.length-1,Math.floor(v.offset/step)-first));if(Object.hasOwn(bins[i].counts,v.mode)){bins[i].counts[v.mode]++;bins[i].total++;}}
 return {bins,step};
}

export function timingImpact(state,settings,now=Date.now()){
 const before={due:0,total:0},after={due:0,total:0};let additional=0,later=0;
 for(const [mode,map] of [['words',state.schedules],...Object.entries(state.skillSchedules||{})])for(const [id,item] of Object.entries(map)){
  const deferred=Date.parse(state.postponed?.[`${mode}:${id}`]||'')||0;
  const b=Math.max(Date.parse(item.dueAt),deferred)<=now,a=Math.max(Date.parse(rescheduleExisting(item,settings).dueAt),deferred)<=now;
  before.total++;after.total++;if(b)before.due++;if(a)after.due++;if(a&&!b)additional++;if(b&&!a)later++;
 }
 return {before,after,additional,later};
}

// Correct v0.4 scores only when a complete recorded review sequence is available.
// Historical events remain untouched; memory-model fields retain their values.
export function upgradeScores(state){
 let changed=false;
 for(const [mode,map] of [['words',state.schedules],...Object.entries(state.skillSchedules||{})]){
  const history=mode==='words'?state.history:mode==='grammar'?state.grammarHistory:state.skillHistory.filter(h=>h.mode===mode);
  const byId=new Map();for(const h of history){const id=mode==='words'?h.cardId:mode==='grammar'?h.grammarId:h.id;if(!byId.has(id))byId.set(id,[]);byId.get(id).push(h);}
  for(const [id,s] of Object.entries(map)){
   if(s.scoreModel==='gradual-v1')continue;
   const records=(byId.get(id)||[]).filter(h=>[1,2,3,4].includes(h.grade)&&Number.isFinite(Date.parse(h.at))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
   if(records.length!==s.reps)continue;
   let replay=null;for(const h of records)replay=scheduleReview(replay,h.grade,Date.parse(h.at),state.settings);
   if(!replay)continue;
   const corrected={...s,score:replay.score,scoreModel:'gradual-v1'};
   map[id]=(state.settings.scheduler||'score')==='score'?rescheduleExisting(corrected,state.settings):corrected;
   const deferred=state.postponed?.[`${mode}:${id}`];if(deferred&&Date.parse(deferred)>Date.parse(map[id].dueAt))map[id].dueAt=deferred;
   changed=true;
  }
 }
 return changed;
}
