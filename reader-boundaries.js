// Choose whole dictionary entries across old token boundaries. Existing term
// spans and surface aliases are indivisible. Punctuation separates word runs.
import {MASTER} from './master-data.js';
import panlong from './chapters/panlong-lexicon.js';

export function normalizeBoundaries(p,state={}){
 const dictionary=new Map(), items={...p.items};
 const joiners=new Set();
 let longest=1;
 function add(surface,id,card){
  if(card.kind==='grammar'||!surface||surface.length>120||!card.pinyin||!card.english||card.pinyin.length>160||card.english.length>500)return;
  if(surface.length>1)for(const ch of surface)if(/[^\p{Script=Han}]/u.test(ch))joiners.add(ch);
  if(dictionary.get(surface)?.card.kind==='term'&&card.kind!=='term')return;
  dictionary.set(surface,{id,card});longest=Math.max(longest,surface.length);
 }
 for(const c of [...MASTER.cards,...(state.archived?.cards||[]),...(state.cards||[])])
  add(c.hanzi,'vocab-'+c.hanzi,{kind:'vocab',hanzi:c.hanzi,pinyin:c.pinyin,english:c.english});
 if(p.novel==='panlong')for(const [surface,[id,kind,hanzi,pinyin,english]] of panlong)
  add(surface,id,{kind,hanzi,pinyin,english});
 for(const [id,c] of Object.entries(state.reader?.[p.novel]?.items||{}))add(c.hanzi,id,c);
 for(const [id,c] of Object.entries(items))add(c.hanzi,id,c);
 for(const row of p.paragraphs)for(const t of row.tokens)if(Array.isArray(t)&&t[1])add(t[1],t[0],items[t[0]]);
 const used=new Set(),terms=new Set(),oldFocus=p.focus??p.authored??[];
 let signature=2166136261;
 function segment(run){
  let text='';const locked=new Map(),inside=new Set(),original=new Map(),literals=new Map(),prior=new Map();
  for(const t of run){
   if(typeof t==='string'){
    for(const ch of t){literals.set(text.length,ch);text+=ch;}
    continue;
   }
   const start=text.length,s=t[1]??items[t[0]].hanzi;prior.set(start,t[0]);text+=s;original.set(start,s);
   if(items[t[0]].kind==='term'||t[1]){
    locked.set(start,{end:text.length,id:t[0]});
    for(let j=start+1;j<text.length;j++)inside.add(j);
   }
  }
  const locksBefore=[0];
  for(let j=0;j<text.length;j++)locksBefore.push(locksBefore[j]+Number(locked.has(j)));
  // Work backwards so a long match cannot strand an undefined character.
  const choices=new Array(text.length+1);choices[text.length]={terms:0,cuts:0,cost:0};
  for(let i=text.length-1;i>=0;i--){
   if(inside.has(i))continue;
   const literal=literals.get(i);
   if(literal&&choices[i+literal.length]){
    const end=i+literal.length;
    choices[i]={...choices[end],cost:choices[end].cost+1,end,surface:literal,entry:null};
   }
   for(let j=Math.min(i+longest,text.length);j>i;j--){
    if(!choices[j])continue;
    const surface=text.slice(i,j);let entry=dictionary.get(surface);
    const originalId=prior.get(i);
    if(originalId&&surface===original.get(i)&&(items[originalId].kind==='term'||entry?.card.kind!=='term'))
     entry={id:originalId,card:items[originalId]};
    if(!entry)continue;
    // In 三个人, 个 counts people. The lexical noun 个人 means “individual”.
    if(entry.card.kind==='vocab'&&surface==='个人'&&!locked.has(i)&&i>0&&/[零〇一二两三四五六七八九十百千万几]/u.test(text[i-1])&&dictionary.has('个')&&dictionary.has('人'))continue;
    const lock=locked.get(i);
    if(lock&&j<lock.end)continue;
    // A longer term may contain a shorter term. Vocabulary cannot absorb one.
    if(entry.card.kind!=='term'&&locksBefore[j]>locksBefore[i]&&!(lock?.end===j&&entry.id===lock.id))continue;
    const count=choices[j].terms+(entry.card.kind==='term'?surface.length:0);
    const cuts=choices[j].cuts+(original.has(i)?0:1);
    const cost=choices[j].cost+1+(surface===original.get(i)?0:0.01);
    if(!choices[i]||count>choices[i].terms||count===choices[i].terms&&(cuts<choices[i].cuts||cuts===choices[i].cuts&&cost<choices[i].cost))
     choices[i]={end:j,entry,surface,terms:count,cuts,cost};
   }
  }
  if(!choices[0])throw Error('Reader dictionary cannot resolve an annotated word.');
  const result=[];
  for(let i=0;i<text.length;){
   const {entry,surface,end}=choices[i];i=end;
   if(!entry){result.push(surface);continue;}
   let {id,card}=entry;
   while(items[id]&&(items[id].kind!==card.kind||items[id].hanzi!==card.hanzi))id='r-'+id;
   for(const ch of id+'\0'+surface+'\n')signature=Math.imul(signature^ch.charCodeAt(0),16777619);
   items[id]??=card;used.add(id);if(card.kind==='term'&&!Object.hasOwn(p.items,id))terms.add(id);
   result.push(surface===card.hanzi?[id]:[id,surface]);
  }
  return result;
 }
 const paragraphs=p.paragraphs.map(row=>{
  const tokens=[];let run=[];
  const flush=()=>{if(run.length)tokens.push(...segment(run));run=[];};
  for(const t of row.tokens){if(typeof t==='string'&&(!t||![...t].every(ch=>joiners.has(ch)))){flush();tokens.push(t);}else run.push(t);}
  flush();return {...row,tokens};
 });
 const retained=Object.fromEntries(Object.entries(items).filter(([id,c])=>used.has(id)||c.kind==='grammar'));
 const ids=kind=>Object.keys(retained).filter(id=>retained[id].kind===kind);
 const result={...p,boundaries:(signature>>>0).toString(16),items:retained,paragraphs,focus:[...new Set([...oldFocus.filter(id=>retained[id]&&retained[id].kind!=='vocab'),...terms])],
  lexicon:{terms:ids('term'),vocabulary:ids('vocab'),grammar:ids('grammar')}};
 delete result.authored;return result;
}
