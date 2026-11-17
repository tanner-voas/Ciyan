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
export function characterEvidence(state){
 const result=new Map();
 for(const h of state.skillHistory||[]){if(h.mode!=='drawing'||!Array.isArray(h.characters))continue;
  // Repeated characters within the same word count once, using the weaker report.
  const attempts=new Map(),rank={recalled:0,difficult:1,forgotten:2};
  for(const c of h.characters){if(!c||!/^\p{Script=Han}$/u.test(c.character)||!Object.hasOwn(rank,c.rating))continue;const old=attempts.get(c.character);if(!old||rank[c.rating]>rank[old])attempts.set(c.character,c.rating);}
  for(const [character,rating] of attempts){const x=result.get(character)||{character,total:0,recalled:0,difficult:0,forgotten:0,ids:new Set()};x.total++;x[rating]++;x.ids.add(h.id);result.set(character,x);}
 }
 return [...result.values()].map(({ids,...x})=>({...x,words:ids.size})).sort((a,b)=>(b.forgotten*2+b.difficult)-(a.forgotten*2+a.difficult)||b.total-a.total||a.character.localeCompare(b.character));
}
