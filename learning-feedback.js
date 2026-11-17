import {scheduleReview} from './review-scheduler.js';
import {allParticles,particleFamily} from './particles.js';
// Derive analytics from review records. No second mutable score system.
export function familyEvidence(state){
 const families=new Map(allParticles(state).map(p=>[p.id,particleFamily(p)])),groups=new Map();
 for(const h of state.skillHistory||[]){if(h.mode!=='particles'||typeof h.correct!=='boolean')continue;
  const name=families.get(h.id);if(!name)continue;
  const list=groups.get(name)||[];list.push(h);if(list.length>20)list.shift();groups.set(name,list);
 }
 return new Map([...groups].map(([name,list])=>[name,{total:list.length,errors:list.filter(h=>!h.correct).length,types:list.reduce((out,h)=>{if(!h.correct&&['omission','unnecessary','placement','choice'].includes(h.errorType))out[h.errorType]=(out[h.errorType]||0)+1;return out;},{})}]));
}
export function weaknessWeight(e){return e?1+2*e.errors/(e.total+4):1;}
// Replay explicit character grades only. Older three-label reports remain usable.
// Derived data makes undo, backup restoration and deletion immediately consistent.
export function characterEvidence(state){
 const result=new Map(),legacy={forgotten:1,difficult:2,recalled:3};
 const history=(state.skillHistory||[]).filter(h=>h.mode==='drawing'&&Array.isArray(h.characters));
 history.sort((a,b)=>(Date.parse(a.at)||0)-(Date.parse(b.at)||0));
 for(const h of history){
  const attempts=new Map();
  for(const c of h.characters){const grade=c?.grade??legacy[c?.rating];
   if(!c||!/^\p{Script=Han}$/u.test(c.character)||![1,2,3,4].includes(grade))continue;
   attempts.set(c.character,Math.min(attempts.get(c.character)??4,grade));
  }
  for(const [character,grade] of attempts){
   const x=result.get(character)||{character,total:0,recalled:0,difficult:0,forgotten:0,ids:new Set(),recent:[],schedule:null};
   x.total++;x[grade===1?'forgotten':grade===2?'difficult':'recalled']++;x.ids.add(h.id);
   x.recent.push(grade);if(x.recent.length>20)x.recent.shift();
   // No invented review time for legacy records without timestamps.
   const at=Date.parse(h.at);if(Number.isFinite(at))x.schedule=scheduleReview(x.schedule,grade,at,state.settings||{});
   result.set(character,x);
  }
 }
 return [...result.values()].map(({ids,recent,...x})=>{
  let errors=0,weight=0;
  recent.forEach((g,i)=>{const w=Math.pow(.85,recent.length-1-i);errors+=w*(g===1?1:g===2?.5:0);weight+=w;});
  return {...x,words:ids.size,wordIds:[...ids],score:x.schedule?.score??null,weakness:errors/(weight+2),recentAttempts:recent.length};
 }).sort((a,b)=>b.weakness-a.weakness||b.total-a.total||a.character.localeCompare(b.character));
}
export function drawingProfile(card,schedule,evidence){
 const known=[...new Set([...card.hanzi])].map(ch=>evidence.get(ch)).filter(Boolean);
 const ranked=known.slice().sort((a,b)=>b.weakness-a.weakness);
 const max=ranked[0]?.weakness||0,mean=known.length?known.reduce((n,x)=>n+x.weakness,0)/known.length:0;
 const score=Number.isFinite(schedule?.score)?Math.max(0,schedule.score):0;
 // Whole-word weakness plus pooled character evidence; bounded below 3x.
 const weight=1+.5*(1-Math.min(3,score)/3)+1.5*(.7*max+.3*mean);
 return {weight,weakest:ranked.filter(x=>x.weakness>0).slice(0,3),rated:known.length};
}
