import {normalizeParticle} from './particles.js';
// Independent, editable sentence cards. Curly braces delimit draggable word tiles;
// punctuation and spaces outside braces are fixed in the answer strip.
export const STARTER_GRAMMAR = [
  {id:'grammar-001',markup:'{吃}{什么}？{我}{都}{随便}。',pinyin:'Chī shénme? Wǒ dōu suíbiàn.',english:'What should we eat? Anything is fine with me.',distractors:[{index:4,word:'多'}]},
  {id:'grammar-002',markup:'{你}{现在}{有}{时间}{吗}？',pinyin:'Nǐ xiànzài yǒu shíjiān ma?',english:'Do you have time right now?',distractors:[{index:4,word:'时候'}]},
  {id:'grammar-003',markup:'{我}{想}{去}{攀岩}，{但是}{今天}{要}{加班}。',pinyin:'Wǒ xiǎng qù pānyán, dànshì jīntiān yào jiābān.',english:'I want to go climbing, but I have to work overtime today.',distractors:[{index:7,word:'会'}]},
  {id:'grammar-004',markup:'{我}{已经}{吃}{了}，{你}{还}{想}{吃}{吗}？',pinyin:'Wǒ yǐjīng chī le, nǐ hái xiǎng chī ma?',english:'I have already eaten. Do you still want to eat?',distractors:[{index:2,word:'还'},{index:6,word:'已经'}]}
];

export function parseSegments(markup) {
  const source=String(markup||'');
  const segments=[];
  const pattern=/\{([^{}]+)\}/g;
  let last=0, match, index=0;
  while((match=pattern.exec(source))) {
    if(match.index>last)segments.push({type:'fixed',text:source.slice(last,match.index)});
    const word=match[1].trim();
    if(!word)throw new Error('Empty {...} word token');
    segments.push({type:'token',text:word,index:index++});
    last=pattern.lastIndex;
  }
  if(last<source.length)segments.push({type:'fixed',text:source.slice(last)});
  if(!index || /[{}]/.test(segments.filter(s=>s.type==='fixed').map(s=>s.text).join(''))) {
    throw new Error('Wrap each movable word in braces, e.g. {我}{吃}{饭}。');
  }
  return segments;
}
const tokenCache=new WeakMap();
export function grammarTokens(g){const cached=tokenCache.get(g);if(cached?.markup===g.markup)return cached.tokens;const tokens=parseSegments(g.markup).filter(x=>x.type==='token').map(x=>x.text);tokenCache.set(g,{markup:g.markup,tokens});return tokens;}
const vocabCache=new WeakMap();
function vocabIndex(cards){let cached=vocabCache.get(cards);if(!cached||cached.size!==cards.length){cached={size:cards.length,map:new Map(cards.map(c=>[c.hanzi,c]))};vocabCache.set(cards,cached);}return cached.map;}
export const plainSentence = markup => String(markup||'').replace(/[{}]/g,'');
const clean=(v,max=600)=>String(v??'').trim().slice(0,max);
export function parseDistractors(raw) {
  if(Array.isArray(raw))return raw.map(v=>({index:Number(v.index),word:clean(v.word,80)}));
  if(!raw)return [];
  return String(raw).split(/\n|;/).filter(s=>s.trim()).map(line=>{
    const m=line.trim().match(/^(\d+)\s*:\s*\[([^\]]+)\]$/);
    if(!m)throw new Error('Distractor format: 4: [多] (one-based word index)');
    return {index:Number(m[1]),word:clean(m[2],80)};
  });
}
export function normalizeGrammar(source,fallbackId=null) {
  if(!source||typeof source!=='object')throw new Error('Invalid grammar entry');
  const markup=clean(source.markup,900), english=clean(source.english,900);
  if(!english||!markup)throw new Error('Grammar needs a marked Chinese sentence and English translation');
  const tokens=grammarTokens({markup});
  if(tokens.length>35)throw new Error('Grammar sentence has too many tokens (max 35)');
  const distractors=parseDistractors(source.distractors);
  if(distractors.length>20)throw new Error('Too many distractors');
  for(const d of distractors)if(!Number.isSafeInteger(d.index)||d.index<1||d.index>tokens.length||!d.word)throw new Error('Distractor index must identify a word token (starting at 1)');
  const id=clean(source.id||fallbackId||crypto.randomUUID(),120);if(id==='prototype'||Object.hasOwn(Object.prototype,id))throw new Error('Reserved grammar ID');
  return {id,markup,pinyin:clean(source.pinyin,900),english,
    distractors,particleTests:(source.particleTests||[]).map(normalizeParticle),source:clean(source.source||'My grammar',80),createdAt:clean(source.createdAt||new Date().toISOString(),80)};
}
export function initialGrammar(){return STARTER_GRAMMAR.map(g=>normalizeGrammar({...g,source:'Starter Mandarin',createdAt:'2026-11-16T00:00:00.000Z'}));}
export function linkedWords(grammar,cards) {
  const terms=new Set(grammarTokens(grammar));
  return cards.filter(c=>terms.has(c.hanzi));
}
export function grammarTags(grammar,cards) {
  return [...new Set(linkedWords(grammar,cards).flatMap(c=>c.tags||[]))].sort();
}
export function requiredWords(grammar,cards) {
  const terms=[...new Set([...grammarTokens(grammar),...grammar.distractors.map(d=>d.word)])];
  const index=vocabIndex(cards);return terms.map(word=>({word,card:index.get(word)||null}));
}
export function wordKnowledge(schedule, recall=1) {
  if(!schedule?.reps)return 0;
  const quality={1:.12,2:.58,3:.95,4:1}[schedule.lastRating]||0;
  const maturity=Math.min(1,.85+.075*Math.max(0,schedule.reps-1));
  return Math.max(0,Math.min(1,quality*maturity*Math.max(0,Math.min(1,recall||0))));
}
export function grammarScores(grammar,cards,schedules,getRecall) {
  const required=requiredWords(grammar,cards);
  const numbers=required.map(({card})=>card?wordKnowledge(schedules[card.id],getRecall(schedules[card.id])):0);
  const knowledge=numbers.length?numbers.reduce((a,b)=>a+b,0)/numbers.length:0;
  const usage=0; // Reserved: future grammar-error penalty, not mastery-by-completion.
  const ready=required.length>0&&required.every(({card},i)=>card&&numbers[i]>=.75);
  return {knowledge,usage,combined:knowledge*(1-usage),ready,required,weak:required.filter((_,i)=>numbers[i]<.75)};
}

// Tone detection is based on the card's written pinyin, not on Mandarin tone sandhi.
const marked='āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const plain='aaaaeeeeiiiioooouuuuuuuu';
const accentTone=ch=>{const i=marked.indexOf(ch);return i<0?0:i%4+1;};
const initialList=['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h','j','q','x','r','z','c','s','y','w',''];
const finalList=['a','ai','an','ang','ao','e','ei','en','eng','er','i','ia','ian','iang','iao','ie','in','ing','iong','iu','o','ong','ou','u','ua','uai','uan','uang','ue','ui','un','uo','ü','üe','üan','ün','r','m','n','ng'];
const syllables=new Set(initialList.flatMap(i=>finalList.map(f=>i+f)));
// Disallow impossible initial+final pairings by preferring syllables that contain a tone mark,
// and minimize one-letter neutral fragments. Full exact character count is required.
export function toneTargets(hanzi,pinyin) {
  const chars=[...String(hanzi)].filter(ch=>/\p{Script=Han}/u.test(ch));
  if(!chars.length)return [];
  const accented=String(pinyin||'').toLowerCase().normalize('NFC');
  // Respect explicit syllable boundaries; never move an accent to another character.
  const separated=accented.split(/[\s'’·-]+/).filter(Boolean);
  if(separated.length===chars.length && separated.every(s=>/^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+[0-5]?$/.test(s))){
    return separated.map(s=>/[0-5]$/.test(s)?Number(s.slice(-1))%5:Math.max(0,...[...s].map(accentTone)));
  }
  if(/[0-9]/.test(accented))return null; // Don't silently discard numeric tones.
  const letters=[...accented].filter(ch=>/[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u.test(ch));
  const raw=letters.join('');
  const norm=[...raw].map(ch=>{const i=marked.indexOf(ch);return i<0?ch:plain[i];}).join('');
  const memo=new Map();
  const solve=(pos,num)=>{
    if(pos===norm.length&&num===chars.length)return {penalty:0,tones:[]};
    if(pos>=norm.length||num>=chars.length)return null;
    const key=`${pos}:${num}`;
    if(memo.has(key))return memo.get(key);
    let best=null;
    for(let end=pos+1;end<=Math.min(norm.length,pos+7);end++){
      const part=norm.slice(pos,end);
      if(!syllables.has(part))continue;
      if(letters.slice(pos,end).filter(ch=>accentTone(ch)>0).length>1)continue;
      const rest=solve(end,num+1);if(!rest)continue;
      const partOriginal=letters.slice(pos,end);
      const tone=Math.max(0,...partOriginal.map(accentTone));
      const penalty=rest.penalty+(part.length===1?2:0)+(part==='r'?0:0)+(part.length>5?1:0);
      if(!best||penalty<best.penalty)best={penalty,tones:[tone,...rest.tones]};
    }
    memo.set(key,best);return best;
  };
  const solved=solve(0,0);
  return solved?.tones?.length===chars.length?solved.tones:null;
}

// Identical tiles are interchangeable: evaluate visible words, never tile identity.
export function grammarMistakes(grammar,picks){
  const tokens=grammarTokens(grammar);
  const bank=Object.fromEntries([...tokens.map((word,i)=>['t'+i,word]),...grammar.distractors.map((d,i)=>['d'+i,d.word])]);
  return tokens.flatMap((word,i)=>bank[picks[i]]===word?[]:[i]);
}
