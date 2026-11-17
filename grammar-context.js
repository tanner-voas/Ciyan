import {grammarTokens} from './grammar.js';
// The exact same min/mean rule as grammar eligibility; distractors participate.
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
 const all=state.grammar.filter(g=>grammarTokens(g).includes(card.hanzi)).map(grammar=>({grammar,...grammarQualification(grammar,byHanzi,score)}));
 const qualified=all.filter(x=>x.qualified);
 if(qualified.length)return qualified;
 if(!all.length)return [];
 // Maximize the weaker threshold first. Once tied, prefer greater average.
 const quality=x=>Math.min(1,x.min)+Math.min(1,x.mean/2);
 const max=Math.max(...all.map(quality));const ties=all.filter(x=>Math.abs(quality(x)-max)<1e-10);
 return [ties[Math.min(ties.length-1,Math.floor(Math.max(0,Math.min(.9999999999,random()))*ties.length))]];
}
