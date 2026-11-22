// Build the locked Pass 45 editions. Text is immutable; only token metadata is generated.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {MASTER} from '../master-data.js';
import {chapterText,validateChapter} from '../reader-core.js';
import oldLexicon from '../chapters/panlong-lexicon.js';
const dir=new URL('../reader/panlong/',import.meta.url), dist=new URL('../chapters/',import.meta.url);
const read=f=>JSON.parse(fs.readFileSync(new URL(f,dir),'utf8'));
const write=(f,x)=>fs.writeFileSync(new URL(f,dir),JSON.stringify(x)+'\n');
const corpus=read('pass45/corpus.json'),reg=read('pass45/register.json'),notes=read('pass45/notes.json');
const stem=n=>String(n).padStart(3,'0');
const originals=corpus.map(c=>read('chapters/'+stem(c.number)+'.json'));
const dict=new Map(),baseline=new Set(reg.baseline),extra=new Set(reg.ordinary.map(r=>r.word)),terms=new Set(reg.terms.map(r=>r.term));
const han=/\p{Script=Han}/u;
const add=(hanzi,pinyin,english,kind='vocab')=>{if(hanzi&&pinyin&&english)dict.set(hanzi,{kind,hanzi,pinyin:pinyin.slice(0,160),english:english.slice(0,500)});};
for(const [surface,[id,kind,h,p,e]] of oldLexicon)if(surface===h)add(h,p,e);
for(const p of originals)for(const r of Object.values(p.items))if(r.kind!=='grammar')add(r.hanzi,r.pinyin,r.english);
for(const c of MASTER.cards)add(c.hanzi,c.pinyin,c.english);
for(const r of reg.ordinary)add(r.word,r.pinyin,r.english);
for(const r of reg.terms)add(r.term,r.pinyin,r.english,'term');
add('燃','rán','to burn; ignite');
add('燃起','rán qǐ','to ignite; to kindle or rise (of a feeling)');
add('木柴','mù chái','firewood');add('柴','chái','firewood');add('噼啪','pī pā','crack; popping sound');add('噼','pī','cracking sound');
add('恼','nǎo','annoyed; vexed');
add('刹那','chà nà','an instant; a moment');add('刹','chà','instant (as in 刹那)');
add('锯齿','jù chǐ','saw teeth');add('齿','chǐ','tooth');add('唾沫','tuò mo','saliva; spit');add('唾','tuò','spit');add('凌空','líng kōng','high in the air');add('凌','líng','rise above');add('呆滞','dāi zhì','dazed; dull');add('滞','zhì','stagnant');add('见状','jiàn zhuàng','seeing this; on seeing the situation');add('状','zhuàng','state; condition');add('幼崽','yòu zǎi','young animal; cub');add('崽','zǎi','young animal');
// Persist fallback dictionary from the old asset set on first generation, so
// rerunning the compiler does not depend on an overwritten original.
const fallbackURL=new URL('pass45/fallback.json',dir);
if(fs.existsSync(fallbackURL)){for(const r of JSON.parse(fs.readFileSync(fallbackURL)))add(r.hanzi,r.pinyin,r.english);}
else fs.writeFileSync(fallbackURL,JSON.stringify([...dict.values()].filter(r=>!baseline.has(r.hanzi)&&!extra.has(r.hanzi)&&!terms.has(r.hanzi)))+'\n');
const index=words=>{const out=new Map();for(const w of words){let a=out.get(w[0]);if(!a)out.set(w[0],a=[]);a.push(w);}for(const a of out.values())a.sort((x,y)=>y.length-x.length||x.localeCompare(y));return out;};
const termIndex=index(terms),extraIndex=index([...extra].filter(w=>w.length>1)),baseIndex=index([...baseline,...extra]),fullIndex=index(dict.keys());
const missing=new Set(),gradedFallback=new Set();
// Fallback DP preserves real annotated Chinese instead of silently dropping text.
// Prefer whole allowed words; fallback only when no allowed segmentation exists.
function splitRun(text,graded){
 const dp=Array(text.length+1);dp[text.length]={cost:0,words:[]};
 for(let i=text.length-1;i>=0;i--){
  for(const w of (graded?baseIndex:fullIndex).get(text[i])||[]){if(!text.startsWith(w,i)||!dp[i+w.length])continue;
   const cost=dp[i+w.length].cost+1+1/w.length;if(!dp[i]||cost<dp[i].cost)dp[i]={cost,words:[w,...dp[i+w.length].words]};}
  if(graded)for(const w of fullIndex.get(text[i])||[]){if(!text.startsWith(w,i)||!dp[i+w.length])continue;
   const cost=dp[i+w.length].cost+1000+1/w.length;if(!dp[i]||cost<dp[i].cost)dp[i]={cost,words:[w,...dp[i+w.length].words]};}
  if(!dp[i]&&dp[i+1])dp[i]={cost:dp[i+1].cost+100000,words:[text[i],...dp[i+1].words]};
 }
 return dp[0].words;
}
function tokenize(text,items,graded){
 let tokens=[],buf='';
 function emit(w){if(!han.test(w)){tokens.push(w);return;}const r=dict.get(w);if(!r){missing.add(w);console.error('missing',w,graded,text);return;}
  const id=r.kind+'-'+w;items[id]=r;tokens.push([id]);if(graded&&!terms.has(w)&&!extra.has(w)&&!baseline.has(w))gradedFallback.add(w);}
 function flush(){if(!buf)return;for(const s of splitRun(buf,graded))emit(s);buf='';}
 for(let i=0;i<text.length;){
  const term=termIndex.get(text[i])?.find(w=>text.startsWith(w,i));
  const e=graded&&extraIndex.get(text[i])?.find(w=>text.startsWith(w,i));
  const w=term||e;if(w){flush();emit(w);i+=w.length;continue;}
  if(han.test(text[i]))buf+=text[i];else{flush();tokens.push(text[i]);}i++;
 }flush();return tokens;
}
const surface=(t,items)=>typeof t==='string'?t:t[1]??items[t[0]].hanzi;
for(const c of corpus){for(const t of c.original)tokenize(t,{},false);for(const t of c.graded)tokenize(t,{},true);}
if(missing.size)throw Error('Missing glosses: '+[...missing].join(' '));
const allTerms=new Set(),allExtra=new Set(),independentTerms=new Set();
const stats=[];
fs.mkdirSync(new URL('graded-v091/',dist),{recursive:true});
for(const c of corpus){
 const n=c.number,old=originals[n-1];
 // Keep the old grammar study cards and identities, and add the reviewed
 // excerpts to the new graded edition using distinct stable pattern IDs.
 const oldGrammar=Object.fromEntries(Object.entries(old.items).filter(([k,v])=>v.kind==='grammar'));
 function build(graded){const items={...oldGrammar},grammarCards={...old.grammarCards};
  const paragraphs=(graded?c.graded:c.original).map((text,i)=>{
   const tokens=tokenize(text,items,graded);let at=0;
   const anchors=tokens.map(t=>{const start=at;at+=surface(t,items).length;return graded?c.anchors[i][start]??0:start;});
   return {id:'p'+(i+1),tokens,...graded?{anchors}:{}};
  });
  if(graded)for(const [i,note] of notes.entries())if(note.chapter===n){
   if(!c.graded[note.paragraph-1].includes(note.example))throw Error('Stale note '+i);
   // Tokenize the example itself separately: it need not start on a paragraph token boundary.
   const tmp={},ts=tokenize(note.example,tmp,true);const markup=ts.map(t=>typeof t==='string'?t:'{'+surface(t,tmp)+'}').join('');
   const pinyin=ts.map(t=>typeof t==='string'?t:tmp[t[0]].pinyin).join(' ');
   const label=`盘龙 ${n}.${note.paragraph} · ${note.pattern}`,id=`grammar-pass45-${i+1}`;
   items[id]={kind:'grammar',hanzi:label,pinyin:pinyin.slice(0,160),english:note.english+' — '+note.note};
   grammarCards[id]={markup,pinyin,english:note.english,pattern:label,explanation:note.note};
  }
  const nestedTerms=[];
  const texts=graded?c.graded:c.original;
  for(const w of terms){const id='term-'+w;if(!items[id]&&texts.some(t=>t.includes(w))){items[id]=dict.get(w);nestedTerms.push(id);}}
  const lexicon={vocabulary:[],grammar:[],terms:[]};
  for(const [k,r] of Object.entries(items))lexicon[r.kind==='vocab'?'vocabulary':r.kind==='term'?'terms':'grammar'].push(k);
  const focus=[...lexicon.terms,...lexicon.grammar];
  const p={format:'ciyan-chapter',version:1,novel:'panlong',book:'盘龙',number:n,title:c.title,author:'我吃西红柿',volume:1,volumeTitle:'盘龙之戒',revision:45,editionVersion:45,paragraphs,items,focus,lexicon,grammarCards,nestedTerms};
  if(missing.size)throw Error('Missing glosses: '+[...missing].join(' '));
  validateChapter(p);if(chapterText(p)!==[c.title,...(graded?c.graded:c.original)].join('\n\n'))throw Error('Text mismatch '+n);
  return p;
 }
 const original=build(false),graded=build(true);
 // All original chapter bytes, including the tokenization, determine the asset binding.
 const ref=[c.title,...c.original].join('\n\n');
 fs.writeFileSync(new URL('reference/'+stem(n)+'.txt',dir),ref);
 original.boundaries='pass45-original';
 const text=JSON.stringify(original)+'\n';fs.writeFileSync(new URL('chapters/'+stem(n)+'.json',dir),text);
 const sourceDigest=createHash('sha256').update(text).digest('hex');
 const a={sourceDigest,items:graded.items,paragraphs:graded.paragraphs,focus:graded.focus,lexicon:graded.lexicon,grammarCards:graded.grammarCards,nestedTerms:graded.nestedTerms,extras:[...extra],fallbackVocabulary:graded.lexicon.vocabulary.map(k=>graded.items[k].hanzi).filter(w=>!baseline.has(w)&&!extra.has(w)),editionVersion:45};
 fs.writeFileSync(new URL('graded-v091/'+n+'.js',dist),'export default '+JSON.stringify(a)+';\n');
 for(const row of graded.paragraphs)for(const t of row.tokens)if(Array.isArray(t)&&graded.items[t[0]].kind==='term')independentTerms.add(graded.items[t[0]].hanzi);
 for(const r of Object.values(graded.items)){if(r.kind==='term')allTerms.add(r.hanzi);else if(extra.has(r.hanzi))allExtra.add(r.hanzi);}
 stats.push({chapter:n,original:original.lexicon.vocabulary.length,graded:graded.lexicon.vocabulary.length,originalTerms:original.lexicon.terms.length,gradedTerms:graded.lexicon.terms.length,gradedGrammar:graded.lexicon.grammar.length});
}
console.log('Missing ordinary independent matches:',[...extra].filter(w=>!allExtra.has(w)));console.log('Nested term forms:',[...terms].filter(w=>!independentTerms.has(w)));console.log('Graded fallback', [...gradedFallback]);
write('pass45/build-report.json',{stats,ordinaryMatched:allExtra.size,registeredTermsMatched:allTerms.size,nestedTerms:[...terms].filter(w=>!independentTerms.has(w)),gradedFallback:[...gradedFallback]});
