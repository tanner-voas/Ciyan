import {parseSegments} from './grammar.js';

// Grammar braces, not arbitrary string occurrence, determine vocabulary usage.
// Allowed: one complete {word}, an unbroken run of complete adjacent {tokens},
// or a contiguous substring entirely within one {token}. No partial-token
// span may cross into another token, even if the Chinese characters are adjacent.
export const CONTEXT_RULES=Object.freeze({exact:0,whole:1,within:2});
const cachedIndex=new WeakMap();
let recentContent=null;
function contentSignature(grammars,cards){
 // O(content size) only after a cloned state is first used; subsequent lookups
 // for that clone use WeakMap. This prevents a full rebuild after each review.
 let h=2166136261;
 const feed=s=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}h^=255;h=Math.imul(h,16777619);};
 feed(String(cards.length));feed(String(grammars.length));
 for(const c of cards)feed(c.hanzi);
 for(const g of grammars){feed(g.id);feed(g.markup);feed(g.pinyin||'');feed(g.english||'');}
 return h>>>0;
}
const rank={exact:0,whole:1,within:2};

export function matchWordInGrammar(grammar,word){
 const matches=allMatches(grammar,word);
 return matches.sort((a,b)=>rank[a.rule]-rank[b.rule]||a.start-b.start||a.charStart-b.charStart)[0]||null;
}
export function allMatches(grammar,word){
 if(!word||typeof word!=='string')return [];
 const segments=parseSegments(grammar.markup);const matches=[];
 const groups=[];let current=[];
 for(const s of segments){
  if(s.type==='token')current.push(s);
  else if(s.text.length){if(current.length)groups.push(current);current=[];}
 }
 if(current.length)groups.push(current);
 for(const g of groups){for(let i=0;i<g.length;i++){
  const t=g[i];
  if(t.text===word)matches.push({rule:'exact',start:t.index,end:t.index,matchedTokens:[t.text],charStart:0,matchedText:word});
  else if(t.text.includes(word)){
   // Within a single lexical token, including multi-character substrings.
   for(let at=t.text.indexOf(word);at>=0;at=t.text.indexOf(word,at+word.length))
    matches.push({rule:'within',start:t.index,end:t.index,matchedTokens:[t.text],charStart:at,matchedText:word});
  }
  let combined=t.text;
  for(let j=i+1;j<g.length;j++){
   combined+=g[j].text;
   if(combined===word)matches.push({rule:'whole',start:t.index,end:g[j].index,matchedTokens:g.slice(i,j+1).map(t=>t.text),charStart:0,matchedText:word});
   if(combined.length>=word.length)break;
  }
 }}
 return matches;
}
// Kept as one shared, memoized inverted index to avoid searching thousands of
// grammar examples on every phone render. Each grammar array is immutable between
// state updates; mutations to cards are handled using a fresh word-lexicon key.
export function contextIndex(grammars,cards){
 let entry=cachedIndex.get(grammars);
 if(entry&&entry.cards===cards&&entry.cardCount===cards.length&&entry.grammarCount===grammars.length)return entry.index;
 const signature=contentSignature(grammars,cards);
 if(recentContent?.signature===signature){
  cachedIndex.set(grammars,{cards,cardCount:cards.length,grammarCount:grammars.length,index:recentContent.index});
  return recentContent.index;
 }
 const dictionary=new Set(cards.map(c=>c.hanzi));
 const maxLen=Math.max(1,...cards.map(c=>c.hanzi.length));
 const index=new Map();
 for(const grammar of grammars){
  let segments;
  try{segments=parseSegments(grammar.markup);}catch{continue;}
  const best=new Map();let group=[];
  function offer(word,rule,start,end,literal,charStart=0){
   if(!dictionary.has(word))return;
   const match={grammar,rule,start,end,matchedTokens:literal,matchedText:word,charStart};
   const prior=best.get(word);
   if(!prior||rank[rule]<rank[prior.rule]||(rule===prior.rule&&start<prior.start))best.set(word,match);
  }
  function flush(){
   for(let i=0;i<group.length;i++){
    const token=group[i],w=token.text;
    offer(w,'exact',token.index,token.index,[w]);
    if(w.length>1){
     for(let a=0;a<w.length;a++)for(let b=a+1;b<=Math.min(w.length,a+maxLen);b++){
      if(a===0&&b===w.length)continue;
      offer(w.slice(a,b),'within',token.index,token.index,[w],a);
     }
    }
    let combined=w;
    for(let j=i+1;j<group.length;j++){
     combined+=group[j].text;
     if(combined.length>maxLen)break;
     offer(combined,'whole',token.index,group[j].index,group.slice(i,j+1).map(t=>t.text));
    }
   }
   group=[];
  }
  for(const seg of segments){if(seg.type==='token')group.push(seg);else if(seg.text.length)flush();}
  flush();
  for(const [word,match] of best){
   let list=index.get(word);if(!list){list=[];index.set(word,list);}
   list.push(match);
  }
 }
 recentContent={signature,index};
 cachedIndex.set(grammars,{cards,cardCount:cards.length,grammarCount:grammars.length,index});
 return index;
}
export function contextMatches(state,card){
 if(!card)return [];
 return contextIndex(state.grammar,state.cards).get(card.hanzi)||[];
}
export function contextSort(a,b){return rank[a.rule]-rank[b.rule]||Number(b.qualified)-Number(a.qualified)||b.knowledge-a.knowledge||a.grammar.markup.length-b.grammar.markup.length;}
export function contextMatchLabel(match){
 if(!match)return 'Unmatched';
 if(match.rule==='exact')return 'Exact token';
 if(match.rule==='whole')return 'Complete adjacent tokens';
 return 'Inside one token';
}
export function contextMatchSource(match){
 if(!match)return '';
 const source=match.matchedTokens.map(t=>`{${t}}`).join('');
 return match.rule==='within'?`${source} contains ${match.matchedText}`:`${source} → ${match.matchedText}`;
}
export function literalGrammarTokens(grammar){return parseSegments(grammar.markup).filter(s=>s.type==='token').map(s=>`{${s.text}}`).join(' ');}
