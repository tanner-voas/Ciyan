import {grammarTokens} from './grammar.js';
import {contextMatches} from './context-matching.js';
// Only actual grammar tiles and distractors count as prerequisites; substring
// matches provide contexts, never artificial grammatical mastery.
export function grammarQualification(grammar,byHanzi,scoreById){
 const tokens=[...new Set([...grammarTokens(grammar),...(grammar.distractors||[]).map(d=>d.word)])];
 const scores=tokens.map(w=>{
  const c=byHanzi.get(w);
  return c?Math.max(0,scoreById(c.id)||0):0;
 });
 const min=scores.length?Math.min(...scores):0;
 const mean=scores.length?scores.reduce((n,v)=>n+v,0)/scores.length:0;
 return {min,mean,qualified:scores.length>0&&min>=1&&mean>=2};
}
export function contextsForWord(state,card,random=Math.random){
 if(!card)return [];
 const byHanzi=new Map(state.cards.map(c=>[c.hanzi,c]));
 const score=id=>state.schedules[id]?.score??0;
 const all=contextMatches(state,card).map(match=>({...match,...grammarQualification(match.grammar,byHanzi,score)}));
 if(!all.length)return [];
 // Prefer explicit tokens, then complete-token phrases, then contained strings.
 // A suffix alone must not outweigh an available authored whole-word example.
 const bestRule=all[0].rule==='exact'?'exact':all.some(x=>x.rule==='exact')?'exact':all.some(x=>x.rule==='whole')?'whole':'within';
 const preferred=all.filter(x=>x.rule===bestRule),qualified=preferred.filter(x=>x.qualified);
 if(qualified.length)return qualified.sort((a,b)=>b.mean-a.mean||a.grammar.markup.length-b.grammar.markup.length).slice(0,6);
 // Fallback when prerequisite vocab is not yet known.
 const quality=x=>Math.min(1,x.min)+Math.min(1,x.mean/2);
 const max=Math.max(...preferred.map(quality));
 const ties=preferred.filter(x=>Math.abs(quality(x)-max)<1e-10);
 return [ties[Math.min(ties.length-1,Math.floor(Math.max(0,Math.min(.9999999999,random()))*ties.length))]];
}
