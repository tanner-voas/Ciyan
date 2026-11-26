// Direct dictionary edges; mastery alone determines eligibility.
export function learnerIndex(state){
 const cards=[...(state.archived?.cards||[]),...(state.cards||[])],words=new Map(cards.map(c=>[c.hanzi,c]));
 const ids=new Map(cards.map(c=>[c.id,c]));
 const score=w=>state.schedules?.[words.get(w)?.id]?.score??0;
 return {words,ids,score};
}
export function deriveEdition(p,index,minimum,{restore=new Set(),threshold=1.5,termScore=()=>0}={}){
 const items={...p.items},changes=new Map(),unresolved=new Map(),terms=new Set(),scores=[],pairs=new Map();
 const denied={missing:0,context:0,threshold:0,unfamiliar:0};
 let total=0,before=0,after=0,displayed=0,phrases=0,unknown=0,densest=null,eligible=0;
 const paragraphs=p.paragraphs.map(row=>{
  let count=0,lex=0,offset=0;const tokens=[],anchors=[];
  function push(t,anchor){tokens.push(t);anchors.push(anchor);}
  for(const [i,t] of row.tokens.entries()){
   const word=typeof t==='string'?t:(t[1]??p.items[t[0]].hanzi),anchor=row.anchors?.[i]??offset;offset+=word.length;
   if(typeof t==='string'||p.items[t[0]].kind==='term'){
    if(typeof t!=='string'&&termScore(t[0])<threshold)terms.add(t[0]);
    push(t,anchor);continue;
   }
   const src=p.items[t[0]].hanzi,score=index.score(src),loc=row.id+':'+i;
   before+=score;total++;let targets=null,similarity=null;
   if(score<threshold){
    eligible++;
    const edges=index.words.get(src)?.synonyms||[];
    if(restore.has(loc)||word!==src)denied.context++;
    else {
     const candidates=edges.map(e=>({w:index.ids.get(e.id)?.hanzi,s:e.similarity}))
      .filter(e=>e.w&&e.w!==src&&Number.isFinite(e.s)&&e.s>=0&&e.s<=1)
      .sort((a,b)=>b.s-a.s||index.score(b.w)-index.score(a.w)||a.w.localeCompare(b.w));
     const best=candidates.find(e=>index.score(e.w)>=threshold);
     if(best&&best.s>=minimum){targets=[best.w];similarity=best.s;}
     else denied[!candidates.length?'missing':!best?'unfamiliar':'threshold']++;
    }
   }
   if(!targets){
    push(t,anchor);after+=score;displayed++;lex++;if(score<threshold){count++;unknown++;unresolved.set(src,(unresolved.get(src)||0)+1);}continue;
   }
   const start=tokens.length;
   for(const w of targets){
    let key='vocab-'+w;while(items[key]&&(items[key].kind!=='vocab'||items[key].hanzi!==w))key='r-'+key;
    const {pinyin,english}=index.words.get(w);items[key]??={kind:'vocab',hanzi:w,pinyin,english};push([key],anchor);
    after+=index.score(w);displayed++;lex++;
   }
   changes.set(loc,{src,targets,start,end:tokens.length,row:row.id,similarity});
   if(similarity===null)phrases++;else{scores.push(similarity);pairs.set(src+'→'+targets[0],similarity);}
  }
  if(count&&(!densest||count/lex>densest.density))densest={id:row.id,density:count/lex};
  return {...row,tokens,anchors};
 });
 const mean=a=>a.length?a.reduce((sum,n)=>sum+n,0)/a.length:null;
 const strength=mean(scores),density=displayed?unknown/displayed:null,low=scores.filter(s=>s<.90).length;
 const tier=Math.max(density>.10?3:density>.05?2:density>.02?1:0,unresolved.size>=36?3:unresolved.size>=16?2:unresolved.size>=6?1:0,
  strength===null?0:strength<.88?3:strength<.92?2:strength<.95?1:0,scores.length&&low/scores.length>=.2?2:scores.some(s=>s<.92)?1:0);
 return {p:{...p,items,paragraphs},changes,stats:{total,eligible,displayed,unknown,unresolved,terms,denied,densest,tier,phrases,strength,
  count:scores.length,min:scores.length?Math.min(...scores):null,low,pairMean:mean([...pairs.values()]),before:total?before/total:null,after:displayed?after/displayed:null}};
}

// Only strongest known alternatives contribute to the slider bounds.
export function synonymRange(base,index,threshold,restore=new Set()){
 const scores=[...deriveEdition(base,index,0,{threshold,restore}).changes.values()].map(c=>c.similarity);
 return scores.length?{min:Math.min(...scores),max:Math.max(...scores),available:true}:{min:0,max:0,available:false};
}
