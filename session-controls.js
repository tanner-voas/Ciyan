import {scheduleFor,sessionAvailability} from './study-engine.js';
export const itemKey=e=>`${e.mode}:${e.id}`;
export function rememberAnswer(s,session){
 const e=session.current;
 const snapshot={current:structuredClone(e),input:structuredClone(session.input),itemStartedAt:session.itemStartedAt,
  previous:structuredClone(scheduleFor(s,e.mode,e.id)||null),history:s.history.length,grammarHistory:s.grammarHistory.length,skillHistory:s.skillHistory.length,
  modeSeconds:structuredClone(s.settings.modeSeconds||{}),spent:structuredClone(session.spent),resultsLength:session.results.length,
  turn:session.turn||0,deferred:structuredClone(session.deferred||{}),skipped:structuredClone(session.skipped||[])};
 session.undo??=[];session.undo.push(snapshot);if(session.undo.length>20)session.undo.shift();
}
export function undoAnswer(s,session){
 const snap=session.undo?.pop();if(!snap)return false;
 const map=snap.current.mode==='words'?s.schedules:s.skillSchedules[snap.current.mode];
 if(snap.previous)map[snap.current.id]=snap.previous;else delete map[snap.current.id];
 s.history.length=snap.history;s.grammarHistory.length=snap.grammarHistory;s.skillHistory.length=snap.skillHistory;
 s.settings.modeSeconds=snap.modeSeconds;session.spent=snap.spent;session.results.length=snap.resultsLength;
 session.turn=snap.turn;session.deferred=snap.deferred;session.skipped=snap.skipped;
 session.current=snap.current;session.input=snap.input;session.itemStartedAt=Date.now();
 return true;
}
// Skip removes the exercise for this session. No grade, history or due-date edit.
export function skipItem(session){session.skipped??=[];const key=itemKey(session.current);if(!session.skipped.includes(key))session.skipped.push(key);session.turn=(session.turn||0)+1;session.current=null;session.input={};}
// Postpone clears the current work (including drawing strokes) and makes it
// eligible later in the SAME session, after two other turns or 15 seconds.
// It neither grades the card nor changes the persisted schedule/due date.
export function postponeItem(_state,session,_seconds=0,now=Date.now()){
 session.deferred??={};session.deferred[itemKey(session.current)]={turn:(session.turn||0)+2,at:now+15000};
 session.current=null;session.input={};
}
export function availability(s,session,now=Date.now()){return sessionAvailability(s,session,now);}
