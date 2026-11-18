/** Optional private test backup path: node tools/audit-v067.mjs /path/to/backup.json
 * No personal backup or history data are shipped or copied into the repository.
 */
import fs from 'node:fs';import {performance} from 'node:perf_hooks';
import {parseBackup} from '../storage.js';import {prepareVerifiedBackup} from '../backup-integrity.js';
import {contextIndex} from '../context-matching.js';import {scheduleReview,retrySeconds,DEFAULT_RETRY} from '../review-scheduler.js';
import {MASTER} from '../master-data.js';
const probe={at:new Date().toISOString(),mockBackupAvailable:!!process.argv[2],source:'Bundled master plus optional locally supplied mock backup'};
function timed(name,fn){const t=performance.now(),v=fn();probe[`${name}Ms`]=Math.round(performance.now()-t);return v;}
const index=timed('contextIndex',()=>contextIndex(MASTER.grammar,MASTER.cards));
probe.master={words:MASTER.cards.length,grammar:MASTER.grammar.length,matchedWords:MASTER.cards.filter(c=>index.has(c.hanzi)).length};
probe.scheduling={};const now=Date.UTC(2026,10,18,7,30),settings={scheduler:'score',retryIntervals:DEFAULT_RETRY};
for(const prior of [null,...[.5,1,2,3,3.5].map(score=>({...scheduleReview(null,4,now-7*86400000,settings),score,reps:15,lastReviewedAt:new Date(now-7*86400000).toISOString()}))]){
 const key=prior?String(prior.score):'new';
 const outcomes=[1,2,3,4].map(g=>scheduleReview(prior,g,now,settings));
 const intervals=outcomes.map(s=>Math.round((Date.parse(s.dueAt)-now)/60000));
 const scores=outcomes.map(s=>+s.score.toFixed(3));
 if(intervals.some((v,i)=>i>0&&v<intervals[i-1]))throw Error('Nonmonotonic intervals at '+key);
 if(scores.some((v,i)=>i>0&&v<scores[i-1]))throw Error('Nonmonotonic scores at '+key);
 probe.scheduling[key]={scores,minutes:intervals};
}
if(process.argv[2]){
 const raw=timed('readBackup',()=>fs.readFileSync(process.argv[2],'utf8'));
 const payload=timed('decodeBackup',()=>JSON.parse(raw));
 const state=timed('parseBackup',()=>parseBackup(payload));
 const verified=timed('verifiedExport',()=>prepareVerifiedBackup(state));
 const reloaded=timed('verifiedRestore',()=>parseBackup(JSON.parse(verified.json)));
 probe.roundTrip={bytesOriginal:Buffer.byteLength(raw),bytesVerified:verified.bytes,counts:verified.counts,
  wordSchedules:Object.keys(reloaded.schedules).length,grammarSchedules:Object.keys(reloaded.skillSchedules.grammar).length,
  drawingSchedules:Object.keys(reloaded.skillSchedules.drawing).length,
  particlesSchedules:Object.keys(reloaded.skillSchedules.particles).length,
  acceptedFont:{difficulty:reloaded.settings.fontDifficulty,choice:reloaded.settings.fontChoice},
  retainedVocabHistory:reloaded.history.length===state.history.length,
  retainedGrammarHistory:reloaded.grammarHistory.length===state.grammarHistory.length,
  retainedDrawingHistory:reloaded.skillHistory.length===state.skillHistory.length,
  retainedMaster:reloaded.cards.length===state.cards.length&&reloaded.grammar.length===state.grammar.length,
  consistentIds:reloaded.cards.every((c,i)=>c.id===state.cards[i].id)&&reloaded.grammar.every((g,i)=>g.id===state.grammar[i].id)};
 if(Object.entries(probe.roundTrip).some(([k,v])=>k.startsWith('retained')&&!v)||!probe.roundTrip.consistentIds)throw Error('Real backup round trip lost user data');
}
console.log(JSON.stringify(probe,null,2));
