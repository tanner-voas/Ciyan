// Build Panlong V1 chapters 12–23 from the reader-provided UTF-8 source files.
// Source text is immutable: tokenized chapterText MUST exactly match each input.
// The focus list intentionally repeats recurring terms in every chapter that uses
// them. All other vocabulary is studied automatically by the reader.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MASTER} from '../master-data.js';
import {chapterText,validateChapter} from '../reader-core.js';

const root=fileURLToPath(new URL('../reader/panlong/',import.meta.url));
const read=(name)=>fs.readFileSync(path.join(root,name),'utf8');
const special=new Map();
const dict=new Map(MASTER.cards.map(c=>[c.hanzi,{kind:'vocab',hanzi:c.hanzi,pinyin:c.pinyin,english:c.english}]));
// Carry over canonical term/vocabulary identities to avoid an incompatibility
// when a reader progresses from an existing chapter to a new one.
const previousKinds=new Map();
for(let chapter=1;chapter<=11;chapter++){
 const data=JSON.parse(read(`chapters/${String(chapter).padStart(3,'0')}.json`));
 for(const record of Object.values(data.items)){
  if(record.kind==='grammar')continue;
  previousKinds.set(record.hanzi,record.kind);
  dict.set(record.hanzi,{kind:record.kind,hanzi:record.hanzi,pinyin:record.pinyin,english:record.english});
  if(record.kind==='term')special.set(record.hanzi,true);
 }
}
const addGloss=(name,expectedKind,force=true)=>{
 if(!fs.existsSync(path.join(root,name)))return;
 for(const line of read(name).trim().split(/\r?\n/u)){
  if(!line||line.startsWith('#'))continue;
  const fields=line.split('\t');
  if(fields.length!==3||fields.some(s=>!s.trim()))throw Error(`Bad glossary ${name}: ${line}`);
  const [hanzi,pinyin,english]=fields;
  const kind=previousKinds.get(hanzi)||expectedKind;
  const prior=dict.get(hanzi);
  if(prior?.kind==='term'&&kind==='vocab')continue;
  dict.set(hanzi,{kind,hanzi,pinyin:prior?.kind==='term'?prior.pinyin:pinyin,english:prior?.kind==='term'?prior.english:english});
  if(force&&kind==='term')special.set(hanzi,true);
 }
};
// Preserve familiar spellings and established translations from chapters 1–11.
for(const [name,kind,force] of [
 ['lexicon.tsv','term',true],['vocabulary.tsv','vocab',false],
 ['characters.tsv','vocab',false],['extended-lexicon.tsv','vocab',false],
 ['extra-characters.tsv','vocab',false],
 ['volume-1-ch12-23-terms.tsv','term',true],['volume-1-ch12-23-vocabulary.tsv','vocab',false],
 ['volume-1-ch12-23-characters.tsv','vocab',false]])addGloss(name,kind,force);
const aliases=JSON.parse(read('aliases.json'));
for(const [alternate,base] of Object.entries(aliases)){
 if(!dict.has(base))throw Error(`Missing alias base ${base}`);
 dict.set(alternate,dict.get(base));
 special.set(alternate,true);
}
const expression=new RegExp('('+[...special.keys()].sort((a,b)=>b.length-a.length||a.localeCompare(b))
 .map(word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gu');
const segmenter=new Intl.Segmenter('zh-Hans',{granularity:'word'});
const unknown=new Map();
const getWords=text=>{
 // Prefer longest annotated compounds. A one-character fallback is allowed
 // during discovery, but every resulting character must have a real glossary entry.
 const memo=new Array(text.length+1);memo[text.length]={cost:0,words:[]};
 for(let pos=text.length-1;pos>=0;pos--){
  let best=null;
  for(let end=pos+1;end<=Math.min(text.length,pos+13);end++){
   const word=text.slice(pos,end),known=dict.has(word);
   if(!known&&end!==pos+1||!memo[end])continue;
   const cost=memo[end].cost+(known?0:250)+1/word.length**2;
   if(!best||cost<best.cost)best={cost,words:[word,...memo[end].words]};
  }
  memo[pos]=best;
 }
 return memo[0]?.words??[...text];
};
const tokensFor=(s)=>{
 const tokens=[];
 for(const piece of s.split(expression).filter(Boolean)){
  const sub=dict.has(piece)?[piece]:[...segmenter.segment(piece)].map(r=>r.segment);
  for(const word of sub)for(const part of (word.match(/\p{Script=Han}+|[^\p{Script=Han}]+/gu)||[])){
   if(!/\p{Script=Han}/u.test(part)){tokens.push(part);continue;}
   for(const term of getWords(part)){
    const card=dict.get(term);
    if(!card){unknown.set(term,(unknown.get(term)||0)+1);continue;}
    // Alias surface spelling is retained verbatim in the two-element form.
    const id=card.kind+'-'+card.hanzi;
    tokens.push(term===card.hanzi?[id]:[id,term]);
   }
  }
 }
 return tokens;
};
const grammarSpec=JSON.parse(read('volume-1-grammar-12-23.json'));
const grammarTrigger={
 '一旦……就……':'一旦','如果……就……':'如果','即使……也……':'即使',
 '虽然……可是……':'虽然','无论……都……':'无论','不管……都……':'不管',
 '连……都……':'连','被……':'被','将……':'将','把……':'把',
 '……不由……':'不由','只见……':'只见','……竟然……':'竟然',
 '……顿时……':'顿时','……仿佛……':'仿佛','……如同……':'如同',
 '……犹如……':'犹如','……这才……':'这才','……原本……':'原本',
 '……甚至……':'甚至','……乃至于……':'乃至于','……按照……':'按照',
 '……之所以……':'之所以','……似乎……':'似乎','……毕竟……':'毕竟',
 '……难以……':'难以','等到……':'等到','……既然……':'既然',
 '……只有……才……':'只有','……除非……':'除非','……唯有……':'唯有',
 '……越来越……':'越来越','……而是……':'而是','……才……':'才',
 '……再也……':'再也','……终于……':'终于','……然而……':'然而',
 '……甚至于……':'甚至于','……若是……':'若是'
};
const reports=[];
for(let number=12;number<=23;number++){
 const stem=String(number).padStart(3,'0');
 const source=read(`volume-1-raw/${stem}.txt`).replace(/\r\n/g,'\n');
 const [header,...body]=source.trimEnd().split('\n\n');
 const lines=header.split('\n');
 if(lines.length!==2||lines[0]!=='第一集 盘龙之戒'||!lines[1].startsWith(`第`))throw Error(`Unexpected header chapter ${number}`);
 const title=lines[1];
 if(!body.length||body.some(x=>!x.length))throw Error(`Unexpected paragraph ${number}`);
 const reference=[title,...body].join('\n\n');
 const paragraphs=body.map((text,index)=>({id:`p${index+1}`,tokens:tokensFor(text)}));
 if(unknown.size)continue;
 const used=new Set(paragraphs.flatMap(p=>p.tokens).filter(Array.isArray).map(item=>item[0]));
 const items={};
 for(const id of used){
  const token=id.slice(id.indexOf('-')+1),record=dict.get(token);
  if(!record||record.kind+'-'+record.hanzi!==id)throw Error(`Bad identity ${id}`);
  items[id]=record;
 }
 const focus=[...used].filter(id=>items[id].kind==='term');
 const selected=grammarSpec.chapters[number];
 if(!selected||selected.length<5)throw Error(`Missing grammar specification ${number}`);
 for(const name of selected){
  const trigger=grammarTrigger[name],entry=grammarSpec.patterns[name];
  if(!trigger||!entry||!body.some(text=>text.includes(trigger)))throw Error(`Grammar ${name} has no evidence in chapter ${number}`);
  const id='grammar-'+name;
  items[id]={kind:'grammar',hanzi:name,pinyin:entry[0],english:entry[1]};
  focus.push(id);
 }
 const chapter={format:'ciyan-chapter',version:1,novel:'panlong',book:'盘龙',number,title,revision:1,
   author:'我吃西红柿',volume:1,volumeTitle:'盘龙之戒',paragraphs,items,focus};
 validateChapter(chapter);
 if(chapterText(chapter)!==reference)throw Error(`Text mismatch ${number}`);
 reports.push({number,paragraphs:paragraphs.length,items:Object.keys(items).length,terms:focus.filter(id=>id.startsWith('term-')).length,grammar:focus.filter(id=>id.startsWith('grammar-')).length,focus});
 fs.writeFileSync(path.join(root,'reference',stem+'.txt'),reference);
 fs.writeFileSync(path.join(root,'chapters',stem+'.json'),JSON.stringify(chapter));
}
if(unknown.size){
 console.error('Undefined Chinese characters; add meanings and pinyin to volume-1-ch12-23-characters.tsv:',JSON.stringify([...unknown].sort((a,b)=>b[1]-a[1])));
 process.exitCode=1;
}else {
 fs.writeFileSync(path.join(root,'volume-1-ch12-23-report.json'),JSON.stringify(reports,null,2));
 reports.forEach(r=>console.log(r.number,r.paragraphs,'paragraphs;',r.terms,'terms;',r.grammar,'grammar;',r.items,'items'));
}
