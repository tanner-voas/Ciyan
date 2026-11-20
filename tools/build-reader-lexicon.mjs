// Compile the shared Panlong vocabulary so early chapters can use later definitions offline.
import fs from 'node:fs';
import {MASTER} from '../master-data.js';
const root=new URL('../reader/panlong/',import.meta.url);
const known=new Set(MASTER.cards.map(card=>card.hanzi));
const words=new Map();
function add(surface,id,card){
 if(words.get(surface)?.[1]==='term'&&card.kind!=='term')return;
 words.set(surface,[id,card.kind,card.hanzi,card.pinyin,card.english]);
}
for(const name of ['vocabulary.tsv','extended-lexicon.tsv','lexicon.tsv','volume-1-ch12-23-terms.tsv']){
 const kind=name.includes('terms')||name==='lexicon.tsv'?'term':'vocab';
 for(const line of fs.readFileSync(new URL(name,root),'utf8').trim().split(/\r?\n/)){
  const [hanzi,pinyin,english]=line.split('\t');
  if(hanzi&&pinyin&&english)add(hanzi,kind+'-'+hanzi,{kind,hanzi,pinyin,english});
 }
}
for(const file of fs.readdirSync(new URL('chapters/',root)).sort()){
 const p=JSON.parse(fs.readFileSync(new URL('chapters/'+file,root)));
 for(const [id,card] of Object.entries(p.items))if(card.kind!=='grammar')add(card.hanzi,id,card);
 for(const row of p.paragraphs)for(const t of row.tokens)if(Array.isArray(t)&&t[1])add(t[1],t[0],p.items[t[0]]);
}
const entries=[...words].filter(([s,[,kind,h]])=>kind==='term'||s!==h||!known.has(s));
fs.writeFileSync(new URL('../chapters/panlong-lexicon.js',import.meta.url),'export default '+JSON.stringify(entries)+';\n');
