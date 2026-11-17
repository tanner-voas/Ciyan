import {allParticles} from './particles.js';
import {scheduleFor,candidates,MODES} from './study-engine.js';
export const itemKey=e=>`${e.mode}:${e.id}`;
export function rememberAnswer(s,session){
 const e=session.current;
 const snapshot={current:structuredClone(e),input:structuredClone(session.input),itemStartedAt:session.itemStartedAt,
  previous:structuredClone(scheduleFor(s,e.mode,e.id)||null),history:s.history.length,grammarHistory:s.grammarHistory.length,skillHistory:s.skillHistory.length,
  modeSeconds:structuredClone(s.settings.modeSeconds||{}),spent:structuredClone(session.spent),resultsLength:session.results.length};
 session.undo??=[];session.undo.push(snapshot);if(session.undo.length>20)session.undo.shift();
}
export function undoAnswer(s,session){
 const snap=session.undo?.pop();if(!snap)return false;
 const map=snap.current.mode==='words'?s.schedules:s.skillSchedules[snap.current.mode];
 if(snap.previous)map[snap.current.id]=snap.previous;else delete map[snap.current.id];
 s.history.length=snap.history;s.grammarHistory.length=snap.grammarHistory;s.skillHistory.length=snap.skillHistory;
 s.settings.modeSeconds=snap.modeSeconds;session.spent=snap.spent;session.results.length=snap.resultsLength;
 session.current=snap.current;session.input=snap.input;session.itemStartedAt=Date.now();
 return true;
}
export function skipItem(session){session.skipped??=[];const key=itemKey(session.current);if(!session.skipped.includes(key))session.skipped.push(key);session.current=null;session.input={};}
export function postponeItem(s,session,seconds,now=Date.now()){
 if(!Number.isFinite(seconds)||seconds<1||seconds>604800)throw new Error('Invalid postpone time');
 s.postponed??={};s.postponed[itemKey(session.current)]=new Date(now+seconds*1000).toISOString();const schedule=scheduleFor(s,session.current.mode,session.current.id);if(schedule)schedule.dueAt=s.postponed[itemKey(session.current)];session.current=null;session.input={};
}
export function availability(s,session,now=Date.now()){
 const enabled=Object.keys(MODES).filter(m=>session.mode==='auto'?s.settings.autoModes[m]:m===session.mode);
 const modes=enabled.map(mode=>{
  const all=candidates(s,mode,session.mode==='auto',now,true).filter(e=>!session.skipped?.includes(itemKey(e))&&(!session.allowedWords||mode!=='words'||session.allowedWords.includes(e.id)));
  const upcoming=all.map(e=>Math.max(Date.parse(scheduleFor(s,mode,e.id)?.dueAt||0)||0,Date.parse(s.postponed?.[itemKey(e)]||0)||0)).filter(t=>t>now);
  const structural=mode==='words'?(session.allowedWords?.length??s.cards.length):mode==='grammar'?s.grammar.length:mode==='drawing'?s.cards.filter(c=>/^[\p{Script=Han}]+$/u.test(c.hanzi)&&c.pinyin).length:mode==='particles'?allParticles(s).length:null;
  return {mode,available:all.length,due:candidates(s,mode,session.mode==='auto',now).filter(e=>!session.skipped?.includes(itemKey(e))).length,nextAt:upcoming.length?Math.min(...upcoming):null,blocked:structural===null?null:Math.max(0,structural-all.length-(session.skipped||[]).filter(k=>k.startsWith(mode+':')).length)};
 });
 const times=modes.map(m=>m.nextAt).filter(Boolean);
 const recentDrawing=session.results.slice(-3).filter(r=>now-Date.parse(r.at)<600000);
 if(enabled.includes('drawing')&&recentDrawing.length)times.push(...recentDrawing.map(r=>Date.parse(r.at)+600000));
 return {modes,nextAt:times.length?Math.min(...times):null,blocked:modes.some(m=>m.blocked>0),skipped:session.skipped?.length||0};
}
