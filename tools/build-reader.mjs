import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {MASTER} from '../master-data.js';
const dir=fileURLToPath(new URL('../reader/panlong/',import.meta.url));
const focusSpec=JSON.parse(fs.readFileSync(dir+'../focus-grammar.json','utf8'));
const dict=new Map(MASTER.cards.map(({hanzi,pinyin,english})=>[hanzi,{kind:'vocab',hanzi,pinyin,english}]));
const specials=[];
for(const [file,kind] of [['lexicon','term'],['vocabulary','vocab'],['characters','vocab']]){
 for(const line of fs.readFileSync(dir+file+'.tsv','utf8').trim().split('\n').filter(Boolean)){
  const [hanzi,pinyin,english]=line.split('\t');
  dict.set(hanzi,{kind,hanzi,pinyin,english});if(file!=='characters')specials.push(hanzi);
 }
}
for(const [word,english] of Object.entries(focusSpec.termOverrides))if(dict.has(word))dict.set(word,{...dict.get(word),kind:'term',english});
const aliases=JSON.parse(fs.readFileSync(dir+'aliases.json','utf8'));
for(const [surface,key] of Object.entries(aliases)){dict.set(surface,dict.get(key));specials.push(surface);}
const special=new RegExp('('+specials.sort((a,b)=>b.length-a.length).join('|')+')','gu');
const segmenter=new Intl.Segmenter('zh-Hans',{granularity:'word'});
const missing=new Set();
for(let number=1;number<=3;number++){
 const stem=String(number).padStart(3,'0');
 const output=dir+'chapters/'+stem+'.json';
 if(fs.existsSync(output)&&JSON.parse(fs.readFileSync(output,'utf8')).revision>1)continue;
 const [title,...lines]=fs.readFileSync(dir+'reference/'+stem+'.txt','utf8').split('\n\n');
 const items={}, paragraphs=[];
 for(const [i,line] of lines.entries()){
  const tokens=[];
  for(const piece of line.split(special).filter(Boolean)){
   const words=dict.has(piece)?[piece]:Array.from(segmenter.segment(piece),s=>s.segment);
   const resolved=[];
   for(const chunk of words){
    if(dict.has(chunk)||! /\p{Script=Han}/u.test(chunk)){resolved.push(chunk);continue;}
    for(let start=0;start<chunk.length;){
     let end=chunk.length;
     while(end>start+1&&!dict.has(chunk.slice(start,end)))end--;
     resolved.push(chunk.slice(start,end));start=end;
    }
   }
   for(const word of resolved){
    if(!/\p{Script=Han}/u.test(word)){tokens.push(word);continue;}
    if(!dict.has(word)){missing.add(word);continue;}
    const item=dict.get(word),key=item.kind+'-'+item.hanzi;
    items[key]=item;tokens.push(word===item.hanzi?[key]:[key,word]);
   }
  }
  paragraphs.push({id:'p'+(i+1),tokens});
 }
 const focus=Object.entries(items).filter(([id,item])=>item.kind==='term').map(([id])=>id);
 for(const pattern of focusSpec.chapters.panlong[number]){
  const entry=focusSpec.grammar[pattern],id='grammar-'+pattern;items[id]={kind:'grammar',...entry};focus.push(id);
 }
 if(!missing.size){
  for(const id of focus)if(!items[id])throw Error('Missing focus item '+id);
  fs.writeFileSync(dir+'chapters/'+stem+'.json',JSON.stringify({format:'ciyan-chapter',version:1,novel:'panlong',book:'盘龙',number,title,revision:1,paragraphs,items,focus}));
 }
}
if(missing.size){console.error([...missing].join(' '));process.exitCode=1;}
