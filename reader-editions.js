// Direct edges only. Unlisted senses and constructions keep their source wording.
const equivalents=new Map(Object.entries({
 忽然:['突然'],突然:['忽然'],竟然:['居然'],居然:['竟然'],依旧:['依然'],依然:['依旧'],
 心中:['心里'],心里:['心中'],仿佛:['好像','似乎'],好像:['仿佛','似乎'],似乎:['好像','仿佛'],
 如果:['假如','倘若'],假如:['如果'],即使:['就算','即便'],无论:['不管'],如今:['现在'],
 立即:['立刻','马上'],立刻:['立即','马上'],仍然:['仍'],仅仅:['仅'],此刻:['此时'],
 其实:['实际上','事实上'],实际上:['其实','事实上'],的确:['确实'],确实:['的确'],
 毕竟:['终究'],所以:['因此'],因此:['所以'],而且:['并且'],再次:['再度'],
 这里:['这儿'],最终:['最后'],最后:['最终'],其他:['别的'],书籍:['书'],小时:['钟头'],
 午餐:['午饭'],早晨:['早上'],故乡:['家乡'],家乡:['故乡'],事情:['事'],全身:['浑身'],
 牙齿:['牙'],汗水:['汗'],眼泪:['泪水'],墙壁:['墙'],害怕:['怕'],畏惧:['害怕'],
 喜悦:['高兴'],担心:['担忧'],担忧:['担心'],逐渐:['渐渐'],渐渐:['逐渐'],缓缓:['慢慢'],
 盼望:['期望'],思索:['思考'],猛然:['忽然','突然'],平时:['平常'],往常:['平常'],
 将来:['未来'],比如:['例如'],另外:['此外'],一辈子:['一生'],住处:['住宅'],
 竟:['竟然'],然而:['但是','可是'],倘若:['如果'],略微:['稍微'],反而:['反倒']
}));
const phraseOptions={情不自禁:['忍','不','住'],小心翼翼:['十分','小心'],庞然大物:['巨大','的','东西']};
const grammarChunks=p=>Object.values(p.grammarCards||{}).flatMap(g=>
 Array.from((g.markup||'').matchAll(/\{([^{}]+)\}/gu),m=>m[1]));
export function learnerIndex(state){
 const cards=[...(state.archived?.cards||[]),...(state.cards||[])],words=new Map(cards.map(c=>[c.hanzi,c]));
 const ids=new Map(cards.map(c=>[c.id,c])),days=new Map(),last=new Map();
 for(const h of state.history||[]){
  if((h.mode&&h.mode!=='words')||!ids.has(h.cardId)||!h.at)continue;
  const time=Date.parse(h.at);if(!Number.isFinite(time))continue;
  if(!last.has(h.cardId)||time>=last.get(h.cardId).time)last.set(h.cardId,{time,grade:h.grade});
  if(h.grade>=3){
   let set=days.get(h.cardId);if(!set)days.set(h.cardId,set=new Set());
   const date=new Date(time);set.add(date.toDateString());
  }
 }
 const score=w=>state.schedules?.[words.get(w)?.id]?.score||0;
 const familiar=w=>{const id=words.get(w)?.id;return score(w)>=1.5&&days.get(id)?.size>=2&&last.get(id)?.grade>=3;};
 return {words,ids,score,familiar};
}
export function deriveEdition(p,index,minimum,{restore=new Set(),permit=()=>true,termScore=()=>0}={}){
 const items={...p.items},changes=new Map(),unresolved=new Map(),terms=new Set(),scores=[],pairs=new Map();
 const protectedWords=new Set(grammarChunks(p)),denied={missing:0,context:0,threshold:0,unfamiliar:0};
 let total=0,before=0,after=0,displayed=0,phrases=0,unknown=0,densest=null,eligible=0;
 const paragraphs=p.paragraphs.map(row=>{
  let count=0,lex=0,offset=0;const tokens=[],anchors=[];
  function push(t,anchor){tokens.push(t);anchors.push(anchor);}
  for(const [i,t] of row.tokens.entries()){
   const word=typeof t==='string'?t:(t[1]??p.items[t[0]].hanzi),anchor=row.anchors?.[i]??offset;offset+=word.length;
   if(typeof t==='string'||p.items[t[0]].kind==='term'){
    if(typeof t!=='string'&&termScore(t[0])<1.5)terms.add(t[0]);
    push(t,anchor);continue;
   }
   const src=p.items[t[0]].hanzi,score=index.score(src),loc=row.id+':'+i;
   before+=score;total++;let targets=null,similarity=null;
   if(score<1.5){
    eligible++;
    const card=index.words.get(src),edges=card?.synonyms||[],reviewed=equivalents.get(src)||[];
    const next=row.tokens[i+1],nextText=typeof next==='string'?next:next?p.items[next[0]].hanzi:'';
    const veto=restore.has(loc)||word!==src||protectedWords.has(src)||!nextText&&src==='不过';
    if(!veto){
     const phrase=phraseOptions[src];
     if(phrase&&phrase.every(w=>permit(w)&&index.familiar(w)))targets=phrase;
     else{
      const candidates=edges.map(e=>({w:index.ids.get(e.id)?.hanzi,s:e.similarity}))
       .filter(e=>reviewed.includes(e.w)&&permit(e.w)).sort((a,b)=>b.s-a.s||index.score(b.w)-index.score(a.w)||a.w.localeCompare(b.w));
      const strong=candidates.filter(e=>e.s>=minimum);
      const best=strong.find(e=>index.familiar(e.w));
      if(best){targets=[best.w];similarity=best.s;}
      else denied[!edges.length?'missing':!candidates.length?'context':!strong.length?'threshold':'unfamiliar']++;
     }
    }else denied.context++;
   }
   if(targets){
    const previous=row.tokens[i-1],prevText=typeof previous==='string'?previous:previous?p.items[previous[0]].hanzi:'';
    const next=row.tokens[i+1],nextText=typeof next==='string'?next:next?p.items[next[0]].hanzi:'';
    const crosses=(a,b)=>{for(let l=1;l<=Math.min(6,a.length);l++)for(let r=1;r<=Math.min(6,b.length);r++)if(index.words.has(a.slice(-l)+b.slice(0,r)))return true;return false;};
    if(crosses(prevText,targets[0])||crosses(targets.at(-1),nextText)){targets=null;denied.context++;}
   }
   if(!targets){
    push(t,anchor);after+=score;displayed++;lex++;if(score<1.5){count++;unknown++;unresolved.set(src,(unresolved.get(src)||0)+1);}continue;
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
