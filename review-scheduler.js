import {scheduleReview as fsrsReview,previewIntervals as fsrsPreview} from './fsrs.js';
export const UNITS={seconds:1,minutes:60,hours:3600,days:86400,weeks:604800};
export const DEFAULT_RETRY=[{value:1,unit:'minutes'},{value:10,unit:'minutes'},{value:3,unit:'days'},{value:2,unit:'weeks'}];
export function retrySeconds(config=DEFAULT_RETRY){
 if(!Array.isArray(config)||config.length!==4)throw new Error('Set all four retry intervals.');
 const values=config.map(x=>Number(x.value)*UNITS[x.unit]);
 if(values.some(n=>!Number.isFinite(n)||n<1||n>315360000))throw new Error('Retry intervals must be between 1 second and 10 years.');
 if(values.some((n,i)=>i&&n<values[i-1]))throw new Error('Intervals must increase (or stay equal) from Again to Easy.');
 return values;
}
export function interpolatedSeconds(score,config=DEFAULT_RETRY){
 const values=retrySeconds(config),s=Math.max(0,Math.min(3,Number(score)||0)),lo=Math.floor(s),hi=Math.min(3,lo+1);
 return values[lo]*Math.pow(values[hi]/values[lo],s-lo);
}
export function historyScore(previous,grade){
 if(grade===1)return 0; // A lapse must not retain a long interval from past successes.
 const current=grade-1;
 if(!previous?.reps)return current;
 const old=Number.isFinite(previous.score)?previous.score:previous.lastRating-1;
 return Math.max(0,Math.min(3,.65*current+.35*old));
}
export function scheduleReview(previous,grade,now=Date.now(),settings={}){
 if(typeof settings==='number')settings={scheduler:'fsrs',desiredRetention:settings};
 const after=fsrsReview(previous,grade,now,settings.desiredRetention||.9);
 after.score=historyScore(previous,grade);after.fsrsIntervalMinutes=after.intervalMinutes;
 if((settings.scheduler||'score')==='fsrs')return after;
 const seconds=interpolatedSeconds(after.score,settings.retryIntervals||DEFAULT_RETRY);
 return {...after,dueAt:new Date(now+seconds*1000).toISOString(),intervalMinutes:seconds/60,learning:grade<=2,scheduler:'score'};
}
export function intervalText(seconds){
 if(seconds<60)return `${Math.round(seconds)}s`;
 if(seconds<3600)return `${+(seconds/60).toFixed(1)}m`;
 if(seconds<86400)return `${+(seconds/3600).toFixed(1)}h`;
 if(seconds<604800)return `${+(seconds/86400).toFixed(1)}d`;
 return `${+(seconds/604800).toFixed(1)}w`;
}
export function previewIntervals(previous,now=Date.now(),settings={}){
 if(typeof settings==='number')return fsrsPreview(previous,now,settings);
 return [1,2,3,4].map(g=>intervalText(scheduleReview(previous,g,now,settings).intervalMinutes*60));
}
export function rescheduleExisting(schedule,settings){
 const score=Number.isFinite(schedule.score)?schedule.score:Math.max(0,(schedule.lastRating||1)-1);
 const minutes=settings.scheduler==='fsrs'?(schedule.fsrsIntervalMinutes||schedule.intervalMinutes):interpolatedSeconds(score,settings.retryIntervals)/60;
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
