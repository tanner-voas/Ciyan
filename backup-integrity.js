import {makeBackup,parseBackup} from './storage.js';

// Independent export round trip. This runs only when the user exports a file;
// per-answer IndexedDB writes remain incremental and fast.
export function prepareVerifiedBackup(state){
 const object=makeBackup(state);
 const json=JSON.stringify(object);
 const bytes=new Blob([json]).size;
 if(bytes>40*1024*1024)throw new Error('Backup exceeds the 40 MB import limit. Export cannot be verified for a future restore.');
 let decoded;
 try{decoded=JSON.parse(json);}catch{throw new Error('Could not serialize the full backup as valid JSON.');}
 const restored=parseBackup(decoded);
 const fields=['cards','grammar','history','grammarHistory','skillHistory','sessions','grammarSessions','mixedSessions'];
 for(const field of fields){
  if(restored[field].length!==state[field].length)throw new Error(`Backup integrity error: ${field} count changed (${state[field].length} → ${restored[field].length}).`);
 }
 const count=s=>Object.keys(s||{}).length;
 if(count(restored.schedules)!==count(state.schedules))throw new Error('Backup integrity error: vocabulary schedules were lost.');
 for(const mode of ['grammar','drawing','particles']){
  if(count(restored.skillSchedules[mode])!==count(state.skillSchedules?.[mode]))throw new Error(`Backup integrity error: ${mode} schedules were lost.`);
 }
 for(const key of Object.keys(state.settings))
  if(JSON.stringify(restored.settings[key])!==JSON.stringify(state.settings[key]))
   throw new Error(`Backup integrity error: setting ${key} changed.`);
 for(const field of ['activePractice','activeSession','activeGrammarSession']){
  if(state[field]&&!restored[field])throw new Error(`Backup integrity error: active ${field} was lost.`);
 }
 return {json,bytes,counts:Object.fromEntries(fields.map(f=>[f,restored[f].length]))};
}
